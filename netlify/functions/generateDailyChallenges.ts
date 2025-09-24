import { Handler } from "@netlify/functions";
import admin from "firebase-admin";
import { GoogleGenAI, Type } from "@google/genai";
import { Subject, StudentProgress, Question, DailyChallenge, GlossaryTerm } from '../../src/types.server';

// --- Variáveis de Ambiente ---
const {
    FIREBASE_PROJECT_ID,
    FIREBASE_PRIVATE_KEY,
    FIREBASE_CLIENT_EMAIL,
    GEMINI_API_KEY,
    VITE_GEMINI_API_KEY,
    DAILY_CHALLENGE_API_KEY,
} = process.env;

// --- Interfaces ---
interface TopicWithContext {
    id: string;
    name: string;
    subjectId: string;
    subjectName: string;
    questions: Question[];
    glossary: GlossaryTerm[];
}

// --- Funções Auxiliares ---

const shuffleArray = <T>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

// --- SCHEMA PARA GERAÇÃO DE QUESTÕES DE PORTUGUÊS ---
const portugueseQuestionSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        statement: {
          type: Type.STRING,
          description: "A frase completa que contém o erro sutil.",
        },
        options: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Um array com exatamente 5 strings, onde cada string é um trecho da frase do enunciado.",
        },
        correctAnswer: {
          type: Type.STRING,
          description: "A string exata do trecho da frase que contém o erro gramatical.",
        },
        justification: {
          type: Type.STRING,
          description: "A justificativa detalhada explicando o erro gramatical e como corrigi-lo.",
        },
        optionJustifications: {
          type: Type.ARRAY,
          description: "Um array de objetos com justificativas para CADA alternativa.",
          items: {
            type: Type.OBJECT,
            properties: {
                option: { type: Type.STRING },
                justification: { type: Type.STRING },
            },
            required: ["option", "justification"]
          }
        },
        errorCategory: {
            type: Type.STRING,
            description: "A categoria do erro gramatical (ex: 'Crase', 'Concordância Verbal')."
        }
      },
      required: ["statement", "options", "correctAnswer", "justification", "errorCategory", "optionJustifications"],
    },
};


// Inicializa os serviços Firebase e Gemini, verificando todas as chaves de API necessárias.
let servicesInitialized = false;
const initializeServices = () => {
    if (servicesInitialized) return;

    const requiredFirebaseVars = { FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL };
    for (const [key, value] of Object.entries(requiredFirebaseVars)) {
        if (!value) throw new Error(`FATAL: Missing required environment variable: ${key}`);
    }

    const geminiApiKey = GEMINI_API_KEY || VITE_GEMINI_API_KEY;
    if (!geminiApiKey) {
        throw new Error(`FATAL: Missing required environment variables: GEMINI_API_KEY or VITE_GEMINI_API_KEY`);
    }

    if (admin.apps.length === 0) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: FIREBASE_PROJECT_ID,
                privateKey: FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
                clientEmail: FIREBASE_CLIENT_EMAIL,
            }),
        });
    }

    servicesInitialized = true;
};

// --- Lógica Principal do Handler ---

export const handler: Handler = async (event) => {
    const today = new Date();
    const dateISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    console.log(`[HANDLER_START] Running for date: ${dateISO}`);

    try {
        // 1. Inicialização e Autenticação
        console.log("[INIT] Initializing services...");
        initializeServices();
        console.log("[INIT] Services initialized successfully.");

        const secretKey = DAILY_CHALLENGE_API_KEY;
        if (!secretKey) {
            console.error("[AUTH_FAIL] Server configuration error: Missing trigger secret key.");
            throw new Error("Server configuration error: Missing trigger secret key.");
        }
        if (event.queryStringParameters?.apiKey !== secretKey) {
            console.error("[AUTH_FAIL] Unauthorized access attempt.");
            return { statusCode: 401, body: "Unauthorized" };
        }
        console.log("[AUTH_SUCCESS] API Key validated.");
        
        const db = admin.firestore();
        const geminiApiKey = GEMINI_API_KEY || VITE_GEMINI_API_KEY;
        const ai = new GoogleGenAI({ apiKey: geminiApiKey! });

        // 2. Coleta de Dados Globais (Otimizada e Robustecida)
        console.log("[DATA] Fetching subjects and students...");
        const subjectsSnapshot = await db.collection('subjects').get();
        const allSubjects = subjectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
        
        const allQuestionsWithContext = allSubjects.flatMap(subject => {
            if (!subject.topics || !Array.isArray(subject.topics)) {
                console.warn(`[DATA_WARN] Subject ${subject.id} ('${subject.name}') has missing or invalid 'topics' array.`);
                return [];
            }
            return subject.topics.flatMap(topic => {
                if (!topic) return [];
                const topicQuestions = (topic.questions || []).map(q => ({ ...q, subjectId: subject.id, topicId: topic.id }));
                const tecQuestions = (topic.tecQuestions || []).map(q => ({ ...q, subjectId: subject.id, topicId: topic.id }));
                
                if (!topic.subtopics || !Array.isArray(topic.subtopics)) {
                     console.warn(`[DATA_WARN] Topic ${topic.id} in Subject ${subject.id} has missing or invalid 'subtopics' array.`);
                     return [...topicQuestions, ...tecQuestions];
                }

                const subtopicQuestions = topic.subtopics.flatMap(st => {
                    if (!st) return [];
                    const stQuestions = (st.questions || []).map(q => ({ ...q, subjectId: subject.id, topicId: st.id }));
                    const stTecQuestions = (st.tecQuestions || []).map(q => ({ ...q, subjectId: subject.id, topicId: st.id }));
                    return [...stQuestions, ...stTecQuestions];
                });
                
                return [...topicQuestions, ...tecQuestions, ...subtopicQuestions];
            });
        });

        const studentsSnapshot = await db.collection('users').where('role', '==', 'aluno').get();
        const allStudents = studentsSnapshot.docs.map(doc => doc.id);

        console.log(`[DATA] Found ${allStudents.length} students.`);
        if (allStudents.length === 0) {
            console.log("[PROCESS] No students to process. Exiting.");
            return { statusCode: 200, body: "No students to process." };
        }

        // 3. Processamento de Alunos em Paralelo
        console.log(`[PROCESS] Starting parallel processing for ${allStudents.length} students...`);
        const studentProcessingPromises = allStudents.map(async (studentId) => {
            try {
                const progressRef = db.collection('studentProgress').doc(studentId);
                const progressDoc = await progressRef.get();
                if (!progressDoc.exists) {
                    console.log(`[SKIP] No progress document for student ${studentId}.`);
                    return null;
                }
                const progress = progressDoc.data() as StudentProgress;
                
                const updatePayload: { [key: string]: DailyChallenge<any> } = {};

                // --- Geração do Desafio de Revisão ---
                try {
                    let reviewQuestions: Question[] = [];
                    const reviewMode = progress.dailyReviewMode || 'standard';
                    const reviewQuestionCount = progress.advancedReviewQuestionCount || 5;
                    const topicAttempts = Object.values(progress.progressByTopic).flatMap(subject => Object.values(subject).flatMap(topic => topic.lastAttempt));
                    const reviewAttempts = (progress.reviewSessions || []).flatMap(session => session.attempts || []);
                    const allAttempts = [...topicAttempts, ...reviewAttempts];
                    const attemptedIds = new Set(allAttempts.map(a => a.questionId));
                    const correctIds = new Set(allAttempts.filter(a => a.isCorrect).map(a => a.questionId));
                    const incorrectIds = new Set(Array.from(attemptedIds).filter(id => !correctIds.has(id)));
                    let candidateQuestions = allQuestionsWithContext;
                    if (reviewMode === 'advanced' && progress.advancedReviewSubjectIds?.length) {
                        const subjectIdSet = new Set(progress.advancedReviewSubjectIds);
                        candidateQuestions = candidateQuestions.filter(q => subjectIdSet.has(q.subjectId));
                        if (progress.advancedReviewTopicIds?.length) {
                            const topicIdSet = new Set(progress.advancedReviewTopicIds);
                            candidateQuestions = candidateQuestions.filter(q => topicIdSet.has(q.topicId));
                        }
                    }
                    const questionType = progress.advancedReviewQuestionType || 'incorrect';
                    if (questionType !== 'mixed') {
                        candidateQuestions = candidateQuestions.filter(q => {
                            if (questionType === 'incorrect') return incorrectIds.has(q.id);
                            if (questionType === 'correct') return correctIds.has(q.id);
                            if (questionType === 'unanswered') return !attemptedIds.has(q.id);
                            return false;
                        });
                    }
                    reviewQuestions = shuffleArray(candidateQuestions).slice(0, reviewQuestionCount);
                    updatePayload.reviewChallenge = { date: dateISO, items: reviewQuestions, isCompleted: false, attemptsMade: 0 };
                } catch (e: any) {
                    console.error(`[CHALLENGE_ERROR] Failed to generate REVIEW challenge for student ${studentId}: ${e.message}`);
                    updatePayload.reviewChallenge = { date: dateISO, items: [], isCompleted: true, attemptsMade: 0 };
                }

                // --- Geração do Desafio de Glossário ---
                try {
                    let glossaryQuestions: Question[] = [];
                    const glossaryMode = progress.glossaryChallengeMode || 'standard';
                    const glossaryQuestionCount = progress.glossaryChallengeQuestionCount || 5;
                    const allGlossaryTermsWithContext = allSubjects.flatMap(subject => (subject.topics || []).flatMap(topic => [...(topic.glossary || []).map(term => ({ ...term, subjectId: subject.id, topicId: topic.id })), ...(topic.subtopics || []).flatMap(subtopic => (subtopic.glossary || []).map(term => ({ ...term, subjectId: subject.id, topicId: subtopic.id })))]));
                    let candidateTerms: GlossaryTerm[] = allGlossaryTermsWithContext;
                    if (glossaryMode === 'advanced' && progress.advancedGlossarySubjectIds?.length) {
                        const subjectIdSet = new Set(progress.advancedGlossarySubjectIds);
                        let filteredTerms = allGlossaryTermsWithContext.filter(term => subjectIdSet.has(term.subjectId));
                        if (progress.advancedGlossaryTopicIds?.length) {
                            const topicIdSet = new Set(progress.advancedGlossaryTopicIds);
                            filteredTerms = filteredTerms.filter(term => topicIdSet.has(term.topicId));
                        }
                        candidateTerms = filteredTerms;
                    }
                    const uniqueTerms = Array.from(new Map(candidateTerms.map(item => [item.term, item])).values());
                    if (uniqueTerms.length >= 4) {
                        const selectedTerms = shuffleArray(uniqueTerms).slice(0, glossaryQuestionCount);
                        glossaryQuestions = selectedTerms.map((term, index) => {
                            const correctAnswer = term.definition;
                            const wrongDefinitions = shuffleArray(uniqueTerms.filter(t => t.term !== term.term)).slice(0, 4).map(t => t.definition);
                            const options = shuffleArray([correctAnswer, ...wrongDefinitions]);
                            return { id: `glossary-challenge-${dateISO}-${index}`, statement: `Qual a definição de "${term.term}"?`, options, correctAnswer, justification: `"${term.term}" significa: ${term.definition}` };
                        });
                    }
                    updatePayload.glossaryChallenge = { date: dateISO, items: glossaryQuestions, isCompleted: false, attemptsMade: 0 };
                } catch(e: any) {
                    console.error(`[CHALLENGE_ERROR] Failed to generate GLOSSARY challenge for student ${studentId}: ${e.message}`);
                    updatePayload.glossaryChallenge = { date: dateISO, items: [], isCompleted: true, attemptsMade: 0 };
                }
                
                // --- Geração do Desafio de Português ---
                try {
                    const ptQuestionCount = progress.portugueseChallengeQuestionCount || 1;
                    const errorFocusPrompt = progress.portugueseErrorStats ? `A partir das estatísticas de erro do aluno, foque nos tipos de erro mais comuns: ${JSON.stringify(progress.portugueseErrorStats)}.` : '';
                    const portugueseChallengePrompt = `Crie ${ptQuestionCount} questão(ões) para um desafio de gramática da língua portuguesa...`; // (prompt omitted for brevity)
                    
                    console.log(`[GEMINI] Generating ${ptQuestionCount} Portuguese questions for student ${studentId}...`);
                    const ptResponse = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: portugueseChallengePrompt, config: { responseMimeType: 'application/json', responseSchema: portugueseQuestionSchema } });
                    console.log(`[GEMINI_RAW_RESPONSE] Student ${studentId}: ${ptResponse.text}`);
                    
                    let parsedQuestions: any[] = [];
                    if (ptResponse.text) {
                        try {
                            parsedQuestions = JSON.parse(ptResponse.text.trim());
                        } catch (e: any) {
                             console.error(`[PARSE_ERROR] PT Student ${studentId}. Raw Text: "${ptResponse.text}"`);
                        }
                    }
                    
                    updatePayload.portugueseChallenge = {
                        date: dateISO,
                        items: parsedQuestions.filter(q => q && typeof q === 'object').map((q, i) => {
                            const optionJustifications: { [key: string]: string } = {};
                            if (Array.isArray(q.optionJustifications)) {
                                q.optionJustifications.forEach((item: { option: string; justification: string }) => { if (item?.option && item.justification) optionJustifications[item.option] = item.justification; });
                            }
                            return { id: `port-challenge-${dateISO}-${i}`, statement: q.statement || '', options: q.options || [], correctAnswer: q.correctAnswer || '', justification: q.justification || '', optionJustifications, errorCategory: q.errorCategory };
                        }),
                        isCompleted: false,
                        attemptsMade: 0,
                    };
                } catch(e: any) {
                    console.error(`[CHALLENGE_ERROR] Failed to generate PORTUGUESE challenge for student ${studentId}: ${e.message}`);
                    updatePayload.portugueseChallenge = { date: dateISO, items: [], isCompleted: true, attemptsMade: 0 };
                }
                
                return { studentId, updatePayload };

            } catch (studentError: any) {
                console.error(`[CRITICAL_STUDENT_ERROR] Failed for student ${studentId}:`, studentError.message);
                return null;
            }
        });
        
        console.log("[PROCESS] All student promises created. Awaiting settlement...");
        const results = await Promise.allSettled(studentProcessingPromises);
        console.log("[PROCESS] All promises settled.");
        
        // 4. Commit das Alterações
        const batch = db.batch();
        let successfulUpdates = 0;
        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value) {
                const { studentId, updatePayload } = result.value;
                if (Object.keys(updatePayload).length > 0) {
                    batch.update(db.collection('studentProgress').doc(studentId), updatePayload);
                    successfulUpdates++;
                }
            } else if (result.status === 'rejected') {
                console.error("[BATCH_ERROR] A student promise was rejected:", result.reason);
            }
        });

        if (successfulUpdates > 0) {
            console.log(`[FIRESTORE] Committing batch with ${successfulUpdates} updates...`);
            await batch.commit();
            console.log("[FIRESTORE] Batch commit successful.");
        }

        const successMessage = `Execution finished successfully. Daily challenges generated for ${successfulUpdates}/${allStudents.length} students.`;
        console.log(`[HANDLER_END] ${successMessage}`);
        return { statusCode: 200, body: JSON.stringify({ message: successMessage }) };

    } catch (error: any) {
        console.error("[FATAL_HANDLER_ERROR]", { message: error.message, stack: error.stack });
        return { statusCode: 500, body: JSON.stringify({ error: "An internal error occurred.", details: error.message }) };
    }
};

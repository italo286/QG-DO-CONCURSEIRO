import { Handler } from "@netlify/functions";
import admin from "firebase-admin";
import { GoogleGenAI, Type } from "@google/genai";
import { Subject, StudentProgress, Question, DailyChallenge, GlossaryTerm, QuestionAttempt } from '../../src/types.server';

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
    console.log(`[HANDLER] Running for date: ${dateISO}`);

    try {
        // 1. Inicialização e Autenticação
        initializeServices();

        const secretKey = DAILY_CHALLENGE_API_KEY;
        if (!secretKey) throw new Error("Server configuration error: Missing trigger secret key.");
        if (event.queryStringParameters?.apiKey !== secretKey) {
            return { statusCode: 401, body: "Unauthorized" };
        }
        console.log("[AUTH] API Key validated.");
        
        const db = admin.firestore();
        const geminiApiKey = GEMINI_API_KEY || VITE_GEMINI_API_KEY;
        const ai = new GoogleGenAI({ apiKey: geminiApiKey! });

        // 2. Coleta de Dados Globais (Otimizada)
        console.log("[DATA] Fetching subjects and students...");
        const subjectsSnapshot = await db.collection('subjects').get();
        const allSubjects = subjectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
        const allQuestionsWithContext = allSubjects.flatMap(subject =>
            subject.topics.flatMap(topic => [
                ...topic.questions.map(q => ({ ...q, subjectId: subject.id, topicId: topic.id })),
                ...(topic.tecQuestions || []).map(q => ({ ...q, subjectId: subject.id, topicId: topic.id })),
                ...topic.subtopics.flatMap(st => [
                    ...st.questions.map(q => ({ ...q, subjectId: subject.id, topicId: st.id })),
                    ...(st.tecQuestions || []).map(q => ({ ...q, subjectId: subject.id, topicId: st.id })),
                ])
            ])
        );

        const studentsSnapshot = await db.collection('users').where('role', '==', 'aluno').get();
        const allStudents = studentsSnapshot.docs.map(doc => doc.id);

        console.log(`[DATA] Found ${allStudents.length} students.`);
        if (allStudents.length === 0) return { statusCode: 200, body: "No students to process." };

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

                // --- Geração do Desafio de Revisão ---
                let reviewQuestions: Question[] = [];
                const reviewMode = progress.dailyReviewMode || 'standard';
                const reviewQuestionCount = progress.advancedReviewQuestionCount || 5;

                const topicAttempts = Object.values(progress.progressByTopic)
                    .flatMap(subject => Object.values(subject).flatMap(topic => topic.lastAttempt));
                const reviewAttempts = (progress.reviewSessions || []).flatMap(session => session.attempts || []);
                const allAttempts = [...topicAttempts, ...reviewAttempts];

                const attemptedIds = new Set(allAttempts.map(a => a.questionId));
                const correctIds = new Set(allAttempts.filter(a => a.isCorrect).map(a => a.questionId));
                const incorrectIds = new Set(Array.from(attemptedIds).filter(id => !correctIds.has(id)));

                let candidateQuestions = allQuestionsWithContext;
                if (reviewMode === 'advanced' && progress.advancedReviewSubjectIds && progress.advancedReviewSubjectIds.length > 0) {
                    const subjectIdSet = new Set(progress.advancedReviewSubjectIds);
                    candidateQuestions = candidateQuestions.filter(q => subjectIdSet.has(q.subjectId));
                    if (progress.advancedReviewTopicIds && progress.advancedReviewTopicIds.length > 0) {
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
                const reviewChallenge: DailyChallenge<Question> = { date: dateISO, items: reviewQuestions, isCompleted: false, attemptsMade: 0 };

                // --- Geração do Desafio de Glossário ---
                let glossaryQuestions: Question[] = [];
                const glossaryMode = progress.glossaryChallengeMode || 'standard';
                const glossaryQuestionCount = progress.glossaryChallengeQuestionCount || 5;
                
                const allGlossaryTermsWithContext = allSubjects.flatMap(subject =>
                    subject.topics.flatMap(topic => [
                        ...(topic.glossary || []).map(term => ({ ...term, subjectId: subject.id, topicId: topic.id })),
                        ...topic.subtopics.flatMap(subtopic =>
                            (subtopic.glossary || []).map(term => ({ ...term, subjectId: subject.id, topicId: subtopic.id }))
                        )
                    ])
                );

                let candidateTerms: GlossaryTerm[] = allGlossaryTermsWithContext;

                if (glossaryMode === 'advanced' && progress.advancedGlossarySubjectIds && progress.advancedGlossarySubjectIds.length > 0) {
                    const subjectIdSet = new Set(progress.advancedGlossarySubjectIds);
                    let filteredTerms = allGlossaryTermsWithContext.filter(term => subjectIdSet.has(term.subjectId));

                    if (progress.advancedGlossaryTopicIds && progress.advancedGlossaryTopicIds.length > 0) {
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
                        return {
                            id: `glossary-challenge-${dateISO}-${index}`,
                            statement: `Qual a definição de "${term.term}"?`,
                            options,
                            correctAnswer,
                            justification: `"${term.term}" significa: ${term.definition}`
                        };
                    });
                }
                const glossaryChallenge: DailyChallenge<Question> = { date: dateISO, items: glossaryQuestions, isCompleted: false, attemptsMade: 0 };
                
                // --- Geração do Desafio de Português ---
                const ptQuestionCount = progress.portugueseChallengeQuestionCount || 1;
                const errorFocusPrompt = progress.portugueseErrorStats ? `A partir das estatísticas de erro do aluno, foque nos tipos de erro mais comuns: ${JSON.stringify(progress.portugueseErrorStats)}.` : '';

                const portugueseChallengePrompt = `Crie ${ptQuestionCount} questão(ões) para um desafio de gramática da língua portuguesa no seguinte formato:
                1. A questão é uma única frase que contém um erro gramatical sutil (concordância, regência, crase, pontuação, etc.).
                2. ${errorFocusPrompt}
                3. A frase deve ser dividida em 5 partes (alternativas).
                4. A alternativa correta ('correctAnswer') é o trecho que contém o erro.
                5. Para cada questão, inclua uma 'errorCategory' que classifique o erro (ex: 'Crase', 'Concordância Verbal', 'Regência', 'Pontuação').
                6. Forneça uma 'justification' geral explicando o erro e como corrigi-lo.
                7. Forneça um array 'optionJustifications' com uma justificativa para CADA alternativa. Para a alternativa correta, reforce a explicação do erro. Para as alternativas incorretas (que são gramaticalmente corretas no contexto da frase), a justificativa deve ser "Este trecho não contém erros.".

                Retorne a(s) questão(ões) como um array de objetos JSON, seguindo estritamente o schema fornecido.
                `;

                console.log(`[GEMINI] Generating ${ptQuestionCount} Portuguese questions for student ${studentId}...`);
                const ptResponse = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: portugueseChallengePrompt,
                    config: {
                        responseMimeType: 'application/json',
                        responseSchema: portugueseQuestionSchema,
                    }
                });

                let parsedQuestions: any[] = [];
                if (ptResponse.text) {
                    try {
                        const parsedData = JSON.parse(ptResponse.text.trim());
                        if (Array.isArray(parsedData)) {
                            parsedQuestions = parsedData;
                        } else if (typeof parsedData === 'object' && parsedData !== null) {
                            parsedQuestions = [parsedData]; // Wrap single object
                        } else {
                            console.warn(`[GEMINI_WARN] Unexpected JSON type for student ${studentId}. Type: ${typeof parsedData}`);
                        }
                    } catch (e) {
                        console.error(`[PARSE_ERROR] PT Student ${studentId}:`, e);
                    }
                } else {
                    console.warn(`[GEMINI_WARN] Empty response from Gemini for student ${studentId}. Might be due to safety filters.`);
                }
                
                const portugueseChallenge: DailyChallenge<Question> = {
                    date: dateISO,
                    items: parsedQuestions.map((q, i) => ({ ...q, id: `port-challenge-${dateISO}-${i}` })),
                    isCompleted: false,
                    attemptsMade: 0,
                };
                
                return { studentId, updatePayload: { reviewChallenge, glossaryChallenge, portugueseChallenge } };

            } catch (studentError: any) {
                console.error(`[STUDENT_ERROR] Failed for student ${studentId}:`, studentError.message);
                return null;
            }
        });
        
        const results = await Promise.allSettled(studentProcessingPromises);
        
        // 4. Commit das Alterações
        const batch = db.batch();
        let successfulUpdates = 0;
        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value) {
                const { studentId, updatePayload } = result.value;
                batch.update(db.collection('studentProgress').doc(studentId), updatePayload);
                successfulUpdates++;
            } else if (result.status === 'rejected') {
                console.error("[BATCH_ERROR] A student promise was rejected:", result.reason);
            }
        });

        if (successfulUpdates > 0) {
            console.log(`[FIRESTORE] Committing batch with ${successfulUpdates} updates...`);
            await batch.commit();
            console.log("[FIRESTORE] Batch commit successful.");
        }

        console.log(`[HANDLER] Execution finished. Successful updates: ${successfulUpdates}/${allStudents.length}`);
        return { statusCode: 200, body: JSON.stringify({ message: `Processed ${successfulUpdates}/${allStudents.length} students.` }) };

    } catch (error: any) {
        console.error("[FATAL_HANDLER_ERROR]", { message: error.message, stack: error.stack });
        return { statusCode: 500, body: JSON.stringify({ error: "An internal error occurred.", details: error.message }) };
    }
};
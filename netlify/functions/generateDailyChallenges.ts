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

// Inicializa os serviços Firebase e Gemini, verificando todas as chaves de API necessárias.
let servicesInitialized = false;
const initializeServices = () => {
    if (servicesInitialized) return;

    console.log("[DIAGNOSTIC] Initializing services...");
    const requiredFirebaseVars = { FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL };
    for (const [key, value] of Object.entries(requiredFirebaseVars)) {
        if (!value) throw new Error(`FATAL: Missing required environment variable: ${key}`);
    }

    const geminiApiKey = GEMINI_API_KEY || VITE_GEMINI_API_KEY;
    if (!geminiApiKey) {
        throw new Error(`FATAL: Missing required environment variables: GEMINI_API_KEY or VITE_GEMINI_API_KEY`);
    }

    if (admin.apps.length === 0) {
        console.log("[DIAGNOSTIC] Initializing Firebase Admin SDK...");
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: FIREBASE_PROJECT_ID,
                privateKey: FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
                clientEmail: FIREBASE_CLIENT_EMAIL,
            }),
        });
        console.log("[DIAGNOSTIC] Firebase Admin SDK initialized successfully.");
    }

    servicesInitialized = true;
    console.log("[DIAGNOSTIC] All services initialized successfully.");
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

                const allAttempts = Object.values(progress.progressByTopic).flatMap(s => Object.values(s).flatMap(t => t.lastAttempt));
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
                let candidateTerms: GlossaryTerm[] = allSubjects.flatMap(s => s.topics.flatMap(t => [...(t.glossary || []), ...t.subtopics.flatMap(st => st.glossary || [])]));
                
                if (glossaryMode === 'advanced' && progress.advancedGlossarySubjectIds && progress.advancedGlossarySubjectIds.length > 0) {
                     const subjectIdSet = new Set(progress.advancedGlossarySubjectIds);
                     const topicIdSet = progress.advancedGlossaryTopicIds ? new Set(progress.advancedGlossaryTopicIds) : null;
                     
                     candidateTerms = allSubjects
                        .filter(s => subjectIdSet.has(s.id))
                        .flatMap(s => s.topics.flatMap(t => 
                            (topicIdSet === null || topicIdSet.has(t.id)) ? t.glossary || [] : []
                        ).concat(
                            s.topics.flatMap(t => t.subtopics.flatMap(st => 
                                (topicIdSet === null || topicIdSet.has(st.id)) ? st.glossary || [] : []
                            ))
                        ));
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
                const ptPrompt = `Crie ${ptQuestionCount} questão de português... (seu prompt aqui)`;
                const ptResponse = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: ptPrompt, config: { responseMimeType: 'application/json' /*, responseSchema: ...*/ } });

                let portugueseQuestions: Question[] = [];
                if (ptResponse.text) {
                     try { portugueseQuestions = JSON.parse(ptResponse.text.trim()); } catch (e) { console.error(`[PARSE_ERROR] PT Student ${studentId}:`, e); }
                }
                const portugueseChallenge: DailyChallenge<Question> = {
                    date: dateISO,
                    items: portugueseQuestions.map((q, i) => ({ ...q, id: `port-challenge-${dateISO}-${i}` })),
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
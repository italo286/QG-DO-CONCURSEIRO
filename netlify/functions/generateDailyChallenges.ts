import { Handler } from "@netlify/functions";
import admin from "firebase-admin";
import { GoogleGenAI, Type } from "@google/genai";
import { Subject, StudentProgress, Question, DailyChallenge } from '../../src/types.server';

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
    glossary: { term: string; definition: string }[];
}

// --- Funções Auxiliares ---

// Inicializa os serviços Firebase e Gemini, verificando todas as chaves de API necessárias.
let servicesInitialized = false;
const initializeServices = () => {
    console.log("[DIAGNOSTIC] Attempting to initialize services...");
    if (servicesInitialized) {
        console.log("[DIAGNOSTIC] Services already initialized.");
        return;
    }

    const requiredFirebaseVars = { FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL };
    for (const [key, value] of Object.entries(requiredFirebaseVars)) {
        if (!value) {
            console.error(`[DIAGNOSTIC] FATAL: Missing required environment variable: ${key}`);
            throw new Error(`FATAL: Missing required environment variable: ${key}`);
        }
    }

    if (!GEMINI_API_KEY && !VITE_GEMINI_API_KEY) {
        console.error(`[DIAGNOSTIC] FATAL: Missing required environment variables: GEMINI_API_KEY`);
        throw new Error(`FATAL: Missing required environment variables: GEMINI_API_KEY`);
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
    console.log("[DIAGNOSTIC] --- Handler execution started ---");
    const today = new Date();
    const dateISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    console.log(`[DIAGNOSTIC] Running for date: ${dateISO}`);

    try {
        // 1. Inicialização e Autenticação
        initializeServices();

        const secretKey = DAILY_CHALLENGE_API_KEY;
        if (!secretKey) {
            console.error("[DIAGNOSTIC] FATAL: DAILY_CHALLENGE_API_KEY is not set.");
            throw new Error("Server configuration error: Missing trigger secret key.");
        }
        if (event.queryStringParameters?.apiKey !== secretKey) {
            console.warn(`[DIAGNOSTIC] Unauthorized trigger attempt.`);
            return { statusCode: 401, body: "Unauthorized" };
        }

        console.log("[DIAGNOSTIC] API Key validated. Proceeding with challenge generation.");

        const db = admin.firestore();
        const geminiApiKey = GEMINI_API_KEY || VITE_GEMINI_API_KEY;
        const ai = new GoogleGenAI({ apiKey: geminiApiKey! });

        // 2. Coleta de Dados
        console.log("[DIAGNOSTIC] Fetching subjects and students from Firestore...");
        const subjectsSnapshot = await db.collection('subjects').get();
        const allSubjects = subjectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));

        const studentsSnapshot = await db.collection('users').where('role', '==', 'aluno').get();
        const allStudents = studentsSnapshot.docs.map(doc => doc.id);

        console.log(`[DIAGNOSTIC] Found ${allSubjects.length} subjects and ${allStudents.length} students.`);
        if (allStudents.length === 0) {
            console.log("[DIAGNOSTIC] No students to process. Exiting.");
            return { statusCode: 200, body: "No students to process." };
        }

        const allTopicsWithContext = allSubjects.flatMap(subject =>
            subject.topics.flatMap(topic => [
                { id: topic.id, name: topic.name, subjectId: subject.id, subjectName: subject.name, questions: [...topic.questions, ...(topic.tecQuestions || [])], glossary: topic.glossary || [] },
                ...topic.subtopics.map(st => ({ id: st.id, name: st.name, subjectId: subject.id, subjectName: subject.name, questions: [...st.questions, ...(st.tecQuestions || [])], glossary: st.glossary || [] }))
            ])
        );

        // 3. Processamento de Alunos
        const batch = db.batch();
        console.log("[DIAGNOSTIC] Starting to process each student...");
        for (const studentId of allStudents) {
            try {
                console.log(`[DIAGNOSTIC] Processing student: ${studentId}`);
                const progressRef = db.collection('studentProgress').doc(studentId);
                const progressDoc = await progressRef.get();
                if (!progressDoc.exists) {
                    console.log(`[DIAGNOSTIC] No progress document for student ${studentId}, skipping.`);
                    continue;
                }
                const progress = progressDoc.data() as StudentProgress;

                // Lógica para gerar desafio de revisão (reviewChallenge)
                console.log(`[DIAGNOSTIC] Generating review challenge for student ${studentId}...`);
                // (Sua lógica de seleção de questões de revisão aqui)
                const reviewQuestions: Question[] = []; // Placeholder
                 const reviewChallenge: DailyChallenge<Question> = {
                    date: dateISO,
                    items: reviewQuestions,
                    isCompleted: false,
                    attemptsMade: 0,
                };

                // Lógica para gerar desafio de glossário (glossaryChallenge)
                console.log(`[DIAGNOSTIC] Generating glossary challenge for student ${studentId}...`);
                 // (Sua lógica de seleção de termos de glossário e criação de questões aqui)
                const glossaryQuestions: Question[] = []; // Placeholder
                 const glossaryChallenge: DailyChallenge<Question> = {
                    date: dateISO,
                    items: glossaryQuestions,
                    isCompleted: false,
                    attemptsMade: 0,
                };

                // Lógica para gerar desafio de português (portugueseChallenge)
                console.log(`[DIAGNOSTIC] Generating Portuguese challenge for student ${studentId}...`);
                const questionCount = progress.portugueseChallengeQuestionCount || 1;
                const prompt = `Crie ${questionCount} questão de português para um desafio... (seu prompt aqui)`;
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                    config: { responseMimeType: 'application/json' /*, responseSchema: ...*/ }
                });
                
                let portugueseQuestions: Question[] = [];
                if (response.text) {
                    try {
                        const parsed = JSON.parse(response.text.trim());
                        portugueseQuestions = Array.isArray(parsed) ? parsed : [parsed];
                        console.log(`[DIAGNOSTIC] Successfully generated ${portugueseQuestions.length} Portuguese questions.`);
                    } catch (parseError) {
                         console.error(`[DIAGNOSTIC] Failed to parse Gemini response for student ${studentId}`, { response: response.text, error: parseError });
                    }
                }
                 const portugueseChallenge: DailyChallenge<Question> = {
                    date: dateISO,
                    items: portugueseQuestions.map((q, i) => ({ ...q, id: `port-challenge-${dateISO}-${i}` })),
                    isCompleted: false,
                    attemptsMade: 0,
                };
                
                console.log(`[DIAGNOSTIC] Updating progress for student ${studentId} in batch.`);
                batch.update(progressRef, {
                    reviewChallenge,
                    glossaryChallenge,
                    portugueseChallenge
                });
            } catch (studentError: any) {
                 console.error(`[DIAGNOSTIC] Error processing student ${studentId}:`, { message: studentError.message, stack: studentError.stack });
                 // Continua para o próximo aluno
            }
        }

        // 4. Commit das Alterações
        console.log("[DIAGNOSTIC] Committing batch updates to Firestore...");
        await batch.commit();
        console.log("[DIAGNOSTIC] Batch commit successful. Handler execution finished.");

        return {
            statusCode: 200,
            body: JSON.stringify({ message: `Successfully processed ${allStudents.length} students.` }),
        };

    } catch (error: any) {
        console.error("[DIAGNOSTIC] --- FATAL ERROR in handler ---", {
            message: error.message,
            stack: error.stack,
        });
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "An internal error occurred.", details: error.message }),
        };
    }
};

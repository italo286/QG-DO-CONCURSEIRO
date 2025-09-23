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
        
        const db = admin.firestore();
        const geminiApiKey = GEMINI_API_KEY || VITE_GEMINI_API_KEY;
        const ai = new GoogleGenAI({ apiKey: geminiApiKey! });

        // 2. Coleta de Dados
        const studentsSnapshot = await db.collection('users').where('role', '==', 'aluno').get();
        const allStudents = studentsSnapshot.docs.map(doc => doc.id);

        console.log(`[DATA] Found ${allStudents.length} students.`);
        if (allStudents.length === 0) {
            return { statusCode: 200, body: "No students to process." };
        }

        // 3. Processamento de Alunos em Paralelo
        const studentProcessingPromises = allStudents.map(async (studentId) => {
            try {
                const progressRef = db.collection('studentProgress').doc(studentId);
                const progressDoc = await progressRef.get();
                if (!progressDoc.exists) {
                    console.log(`[SKIP] No progress document for student ${studentId}.`);
                    return null;
                }
                const progress = progressDoc.data() as StudentProgress;

                // Gerar desafio de revisão (placeholder)
                const reviewChallenge: DailyChallenge<Question> = { date: dateISO, items: [], isCompleted: false, attemptsMade: 0 };

                // Gerar desafio de glossário (placeholder)
                const glossaryChallenge: DailyChallenge<Question> = { date: dateISO, items: [], isCompleted: false, attemptsMade: 0 };
                
                // Gerar desafio de português
                const questionCount = progress.portugueseChallengeQuestionCount || 1;
                const prompt = `Crie ${questionCount} questão de português... (seu prompt aqui)`;
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
                    } catch (e) {
                        console.error(`[PARSE_ERROR] Student ${studentId}:`, e);
                    }
                }
                const portugueseChallenge: DailyChallenge<Question> = {
                    date: dateISO,
                    items: portugueseQuestions.map((q, i) => ({ ...q, id: `port-challenge-${dateISO}-${i}` })),
                    isCompleted: false,
                    attemptsMade: 0,
                };
                
                return {
                    studentId,
                    updatePayload: {
                        reviewChallenge,
                        glossaryChallenge,
                        portugueseChallenge
                    }
                };
            } catch (studentError: any) {
                console.error(`[STUDENT_ERROR] Failed to process student ${studentId}:`, studentError.message);
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
                const progressRef = db.collection('studentProgress').doc(studentId);
                batch.update(progressRef, updatePayload);
                successfulUpdates++;
            } else if (result.status === 'rejected') {
                console.error("[BATCH_ERROR] A promise for a student was rejected:", result.reason);
            }
        });

        if (successfulUpdates > 0) {
            await batch.commit();
        }

        console.log(`[HANDLER] Execution finished. Successful updates: ${successfulUpdates}/${allStudents.length}`);
        return {
            statusCode: 200,
            body: JSON.stringify({ message: `Successfully processed ${successfulUpdates} of ${allStudents.length} students.` }),
        };

    } catch (error: any) {
        console.error("[FATAL_HANDLER_ERROR]", { message: error.message, stack: error.stack });
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "An internal error occurred.", details: error.message }),
        };
    }
};
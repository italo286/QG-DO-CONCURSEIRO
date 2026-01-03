
import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';
import { GoogleGenAI } from "@google/genai";

/** 
 * Tipos definidos localmente para garantir isolamento da função serverless
 */
interface QuestionAttempt {
    questionId: string;
    isCorrect: boolean;
}

interface StudentProgress {
    dailyReviewMode?: 'standard' | 'advanced';
    advancedReviewQuestionType?: 'incorrect' | 'correct' | 'unanswered' | 'mixed';
    advancedReviewQuestionCount?: number;
    advancedReviewSubjectIds?: string[];
    advancedReviewTopicIds?: string[];
    portugueseChallengeQuestionCount?: number;
    glossaryChallengeMode?: 'standard' | 'advanced';
    glossaryChallengeQuestionCount?: number;
    advancedGlossarySubjectIds?: string[];
    advancedGlossaryTopicIds?: string[];
    progressByTopic: { [subjectId: string]: { [topicId: string]: { lastAttempt: QuestionAttempt[], score: number } } };
    reviewSessions: { attempts?: QuestionAttempt[] }[];
    studentId: string;
}

// Inicialização segura e resiliente do Firebase Admin
const getFirestoreTools = () => {
    const firebaseAdmin = (admin as any).default || admin;
    
    if (!firebaseAdmin.apps.length) {
        let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
        privateKey = privateKey.trim().replace(/^"/, '').replace(/"$/, '').replace(/\\n/g, '\n');

        firebaseAdmin.initializeApp({
            credential: firebaseAdmin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                privateKey: privateKey,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            }),
        });
    }

    const db = firebaseAdmin.firestore();
    const FieldPath = firebaseAdmin.firestore.FieldPath;
    const FieldValue = firebaseAdmin.firestore.FieldValue;
    
    if (!FieldPath || !FieldValue) {
        throw new Error("Não foi possível localizar 'FieldPath' ou 'FieldValue' no SDK do Firebase Admin.");
    }

    return { db, FieldPath, FieldValue, firebaseAdmin };
};

const logGenerationEvent = async (db: admin.firestore.Firestore, FieldValue: any, data: {
    studentId: string;
    challengeType: string;
    status: 'success' | 'error' | 'started';
    message: string;
    metadata?: any;
    errorDetails?: string;
}) => {
    try {
        await db.collection('generationLogs').add({
            ...data,
            timestamp: FieldValue.serverTimestamp(),
        });
    } catch (e) {
        console.error("Erro crítico ao gravar log no Firestore:", e);
    }
};

const shuffleArray = <T>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

const cleanJsonResponse = (text: string) => {
    try {
        let cleanText = text.trim();
        if (cleanText.includes('```')) {
            const matches = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (matches && matches[1]) cleanText = matches[1];
        }
        return JSON.parse(cleanText);
    } catch (e) {
        throw new Error(`Erro de processamento da IA.`);
    }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { apiKey, studentId, challengeType } = req.query;
    const startTime = Date.now();

    if (!apiKey || apiKey !== process.env.VITE_DAILY_CHALLENGE_API_KEY) {
        return res.status(401).json({ error: 'Acesso não autorizado.' });
    }

    let firestore: any = null;

    try {
        firestore = getFirestoreTools();
        const { db, FieldPath, FieldValue } = firestore;

        await logGenerationEvent(db, FieldValue, {
            studentId: studentId as string,
            challengeType: challengeType as string,
            status: 'started',
            message: `Iniciando geração para ${challengeType}`
        });

        const geminiKey = process.env.API_KEY;
        if (!geminiKey) throw new Error("API_KEY do Gemini não configurada.");
        const ai = new GoogleGenAI({ apiKey: geminiKey });

        const studentDoc = await db.collection('studentProgress').doc(studentId as string).get();
        if (!studentDoc.exists) throw new Error('Progresso não encontrado.');
        const studentProgress = studentDoc.data() as StudentProgress;

        // --- PORTUGUÊS ---
        if (challengeType === 'portuguese') {
            const targetCount = studentProgress.portugueseChallengeQuestionCount || 1;
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Gere exatamente ${targetCount} questões inéditas de Língua Portuguesa para concursos. 
                Cada questão DEVE ter uma "justification" detalhada explicando por que a alternativa correta é a certa e por que as outras estão erradas.
                Formato JSON: [{"statement": string, "options": string[], "correctAnswer": string, "justification": string, "subjectName": "Língua Portuguesa", "topicName": "Gramática e Interpretação"}]`,
                config: { responseMimeType: "application/json" }
            });
            const items = cleanJsonResponse(response.text || '[]');
            
            await logGenerationEvent(db, FieldValue, {
                studentId: studentId as string,
                challengeType: challengeType as string,
                status: 'success',
                message: `Geradas ${items.length} questões de português com justificativas.`,
                metadata: { duration: Date.now() - startTime }
            });

            return res.status(200).json(items);
        }

        // --- CARREGAMENTO DE DISCIPLINAS (PARA REVISÃO/GLOSSÁRIO) ---
        const coursesSnap = await db.collection('courses').where('enrolledStudentIds', 'array-contains', studentId).get();
        const subjectIds = new Set<string>();
        coursesSnap.docs.forEach(doc => (doc.data().disciplines || []).forEach((d: any) => subjectIds.add(d.subjectId)));

        const subjects: any[] = [];
        const subjectIdsArray = Array.from(subjectIds);

        if (subjectIdsArray.length > 0) {
            for (let i = 0; i < subjectIdsArray.length; i += 10) {
                const chunk = subjectIdsArray.slice(i, i + 10);
                const subjectDocs = await db.collection('subjects').where(FieldPath.documentId(), 'in', chunk).get();
                for (const doc of subjectDocs.docs) {
                    const topicsSnap = await doc.ref.collection('topics').get();
                    subjects.push({ 
                        id: doc.id, 
                        name: doc.data().name, 
                        topics: topicsSnap.docs.map(t => ({ id: t.id, ...t.data() })) 
                    });
                }
            }
        }

        // --- REVISÃO ---
        if (challengeType === 'review') {
            const isAdvanced = studentProgress.dailyReviewMode === 'advanced';
            const filterType = isAdvanced ? (studentProgress.advancedReviewQuestionType || 'incorrect') : 'unanswered';
            const targetCount = isAdvanced ? (studentProgress.advancedReviewQuestionCount || 5) : 5;
            
            const everCorrect = new Set<string>();
            const everIncorrect = new Set<string>();
            const allAnswered = new Set<string>();

            const processAttempt = (a: QuestionAttempt) => {
                if (!a?.questionId) return;
                allAnswered.add(a.questionId);
                if (a.isCorrect) everCorrect.add(a.questionId);
                else everIncorrect.add(a.questionId);
            };

            Object.values(studentProgress.progressByTopic || {}).forEach(s => 
                Object.values(s || {}).forEach(t => (t.lastAttempt || []).forEach(processAttempt))
            );
            (studentProgress.reviewSessions || []).forEach(s => (s.attempts || []).forEach(processAttempt));

            let pool: any[] = [];
            subjects.forEach(subject => {
                subject.topics.forEach((topic: any) => {
                    const processT = (t: any) => {
                        const qs = [
                            ...(t.questions || []).map((q: any) => ({ ...q, subjectId: subject.id, topicId: t.id, subjectName: subject.name, topicName: t.name })),
                            ...(t.tecQuestions || []).map((q: any) => ({ ...q, subjectId: subject.id, topicId: t.id, subjectName: subject.name, topicName: t.name }))
                        ];
                        pool.push(...qs);
                    };
                    processT(topic);
                    (topic.subtopics || []).forEach(processT);
                });
            });

            let filtered = [];
            if (filterType === 'incorrect') filtered = pool.filter(q => everIncorrect.has(q.id));
            else if (filterType === 'correct') filtered = pool.filter(q => everCorrect.has(q.id));
            else if (filterType === 'unanswered') filtered = pool.filter(q => !allAnswered.has(q.id));
            else filtered = pool;

            const finalPool = shuffleArray(filtered).slice(0, targetCount);
            return res.status(200).json(finalPool);
        }

        // --- GLOSSÁRIO ---
        if (challengeType === 'glossary') {
            const glossaryPool: any[] = [];
            subjects.forEach(s => s.topics.forEach((t: any) => {
                (t.glossary || []).forEach((g: any) => glossaryPool.push({ ...g, subjectName: s.name, topicName: t.name }));
                (t.subtopics || []).forEach((st: any) => {
                    (st.glossary || []).forEach((g: any) => glossaryPool.push({ ...g, subjectName: s.name, topicName: `${t.name} / ${st.name}` }));
                });
            }));

            const unique = Array.from(new Map(glossaryPool.map(t => [t.term, t])).values());
            if (unique.length === 0) return res.status(200).json([]);

            const selectedTerms = shuffleArray(unique).slice(0, 5);
            const items = [];

            for (const g of selectedTerms) {
                // Usamos a IA para gerar alternativas plausíveis para o termo do glossário
                const gen = await ai.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: `Com base no termo "${g.term}" e sua definição "${g.definition}", gere uma questão de múltipla escolha.
                    As 4 opções incorretas devem ser termos técnicos ou conceitos plausíveis da mesma área, não use placeholders.
                    Retorne JSON: {"statement": string, "options": string[], "correctAnswer": string, "justification": string}
                    Onde "correctAnswer" deve ser exatamente igual à definição original fornecida.`,
                    config: { responseMimeType: "application/json" }
                });
                const q = cleanJsonResponse(gen.text || '{}');
                items.push({ 
                    ...q, 
                    id: `gloss-${Date.now()}-${Math.random()}`, 
                    subjectName: g.subjectName, 
                    topicName: g.topicName 
                });
            }

            return res.status(200).json(items);
        }

        throw new Error("Tipo inválido.");

    } catch (error: any) {
        console.error("ERRO:", error);
        return res.status(500).json({ error: error.message });
    }
}

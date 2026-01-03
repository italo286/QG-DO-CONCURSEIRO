
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
    // FIX: Added missing properties used in Portuguese and Glossary challenge generation to resolve type errors.
    portugueseChallengeQuestionCount?: number;
    glossaryChallengeMode?: 'standard' | 'advanced';
    glossaryChallengeQuestionCount?: number;
    advancedGlossarySubjectIds?: string[];
    advancedGlossaryTopicIds?: string[];
    progressByTopic: { [subjectId: string]: { [topicId: string]: { lastAttempt: QuestionAttempt[], score: number } } };
    reviewSessions: { attempts?: QuestionAttempt[] }[];
    studentId: string;
}

// Inicialização segura e resiliente
const getFirestoreTools = () => {
    const firebaseAdmin = (admin as any).default || admin;
    
    if (!firebaseAdmin.apps.length) {
        let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
        privateKey = privateKey.trim().replace(/^"/, '').replace(/"$/, '').replace(/\\n/g, '\n');

        firebaseAdmin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                privateKey: privateKey,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            }),
        });
    }

    const db = firebaseAdmin.firestore();
    const FieldPath = firebaseAdmin.firestore.FieldPath || (admin as any).firestore?.FieldPath;
    
    if (!FieldPath) {
        throw new Error("Não foi possível localizar 'FieldPath' no SDK do Firebase Admin.");
    }

    return { db, FieldPath };
};

const logGenerationEvent = async (db: admin.firestore.Firestore, data: {
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
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (e) {
        console.error("Erro ao gravar log no Firestore:", e);
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
        throw new Error("A IA retornou um formato de dados inválido.");
    }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { apiKey, studentId, challengeType } = req.query;
    const startTime = Date.now();

    if (!apiKey || apiKey !== process.env.VITE_DAILY_CHALLENGE_API_KEY) {
        return res.status(401).json({ error: 'Acesso não autorizado.' });
    }

    const { db, FieldPath } = getFirestoreTools();

    try {
        await logGenerationEvent(db, {
            studentId: studentId as string,
            challengeType: challengeType as string,
            status: 'started',
            message: `Iniciando geração de ${challengeType}`
        });

        const geminiKey = process.env.API_KEY;
        if (!geminiKey) throw new Error("API_KEY do Gemini não configurada.");
        const ai = new GoogleGenAI({ apiKey: geminiKey });

        const studentDoc = await db.collection('studentProgress').doc(studentId as string).get();
        if (!studentDoc.exists) throw new Error('Progresso do aluno não encontrado.');
        const studentProgress = studentDoc.data() as StudentProgress;

        // --- PORTUGUÊS ---
        if (challengeType === 'portuguese') {
            const targetCount = studentProgress.portugueseChallengeQuestionCount || 1;
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Gere exatamente ${targetCount} questões de múltipla escolha de Língua Portuguesa para concursos. JSON: [{"statement": string, "options": string[], "correctAnswer": string, "justification": string}]`,
                config: { responseMimeType: "application/json" }
            });
            const items = cleanJsonResponse(response.text || '[]');
            
            await logGenerationEvent(db, {
                studentId: studentId as string,
                challengeType: challengeType as string,
                status: 'success',
                message: `Geradas ${items.length} questões de português`,
                metadata: { duration: Date.now() - startTime, count: items.length }
            });

            return res.status(200).json(items);
        }

        // --- CARREGAMENTO DE DISCIPLINAS ---
        const coursesSnap = await db.collection('courses').where('enrolledStudentIds', 'array-contains', studentId).get();
        const subjectIds = new Set<string>();
        coursesSnap.docs.forEach(doc => (doc.data().disciplines || []).forEach((d: any) => {
            if (d.subjectId) subjectIds.add(d.subjectId);
        }));

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

            await logGenerationEvent(db, {
                studentId: studentId as string,
                challengeType: challengeType as string,
                status: 'success',
                message: `Filtradas ${finalPool.length} questões de revisão do pool de ${pool.length}`,
                metadata: { 
                    totalPool: pool.length, 
                    filteredPool: filtered.length, 
                    filterType,
                    duration: Date.now() - startTime 
                }
            });

            return res.status(200).json(finalPool);
        }

        // --- GLOSSÁRIO ---
        if (challengeType === 'glossary') {
            const isAdvanced = studentProgress.glossaryChallengeMode === 'advanced';
            const targetCount = isAdvanced ? (studentProgress.glossaryChallengeQuestionCount || 5) : 5;
            const selSubIds = isAdvanced ? (studentProgress.advancedGlossarySubjectIds || []) : [];
            const selTopIds = isAdvanced ? (studentProgress.advancedGlossaryTopicIds || []) : [];

            const glossaryPool = subjects.flatMap(s => {
                if (selSubIds.length > 0 && !selSubIds.includes(s.id)) return [];
                return s.topics.flatMap((t: any) => {
                    const terms = [];
                    if (selTopIds.length === 0 || selTopIds.includes(t.id)) terms.push(...(t.glossary || []));
                    (t.subtopics || []).forEach((st: any) => {
                        if (selTopIds.length === 0 || selTopIds.includes(st.id)) terms.push(...(st.glossary || []));
                    });
                    return terms;
                });
            });

            const unique = Array.from(new Map(glossaryPool.map(t => [t.term, t])).values());
            const items = shuffleArray(unique).slice(0, targetCount).map(g => ({
                id: `gloss-${Date.now()}-${Math.random()}`,
                statement: `Qual a definição correta para o termo: **${g.term}**?`,
                options: shuffleArray([g.definition, "Incorreta 1", "Incorreta 2", "Incorreta 3", "Incorreta 4"]),
                correctAnswer: g.definition,
                justification: `Definição: ${g.definition}`
            }));

            await logGenerationEvent(db, {
                studentId: studentId as string,
                challengeType: challengeType as string,
                status: 'success',
                message: `Gerado glossário com ${items.length} termos de um pool de ${unique.length}`,
                metadata: { duration: Date.now() - startTime }
            });

            return res.status(200).json(items);
        }

        throw new Error("Tipo de desafio não reconhecido");

    } catch (error: any) {
        console.error("ERRO NO HANDLER:", error);
        await logGenerationEvent(db, {
            studentId: studentId as string,
            challengeType: challengeType as string,
            status: 'error',
            message: `Falha crítica: ${error.message}`,
            errorDetails: error.stack,
            metadata: { duration: Date.now() - startTime }
        });

        return res.status(500).json({ 
            error: "Erro no processamento da requisição.", 
            details: error.message
        });
    }
}

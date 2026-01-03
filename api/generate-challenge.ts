

import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';
// FIX: Added GenerateContentResponse to imports to properly type AI responses
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

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

// Helper para retry com backoff exponencial
async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
    try {
        return await fn();
    } catch (error: any) {
        if (retries > 0 && (error.status === 429 || error.message?.includes('429'))) {
            await new Promise(resolve => setTimeout(resolve, delay));
            // FIX: Pass generic type T to recursive call to ensure return type safety
            return retryWithBackoff<T>(fn, retries - 1, delay * 2);
        }
        throw error;
    }
}

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
    return { db, FieldPath: firebaseAdmin.firestore.FieldPath, FieldValue: firebaseAdmin.firestore.FieldValue };
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
        throw new Error(`Erro de parse JSON da IA: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { apiKey, studentId, challengeType } = req.query;
    if (!apiKey || apiKey !== process.env.VITE_DAILY_CHALLENGE_API_KEY) {
        return res.status(401).json({ error: 'Não autorizado' });
    }

    const { db, FieldPath } = getFirestoreTools();

    try {
        const studentDoc = await db.collection('studentProgress').doc(studentId as string).get();
        if (!studentDoc.exists) throw new Error('Progresso não encontrado');
        const studentProgress = studentDoc.data() as StudentProgress;

        // FIX: Initializing GoogleGenAI with process.env.API_KEY directly as per guidelines
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

        // --- PORTUGUÊS ---
        if (challengeType === 'portuguese') {
            const targetCount = studentProgress.portugueseChallengeQuestionCount || 1;
            // FIX: Added explicit type parameter <GenerateContentResponse> to retryWithBackoff call to resolve 'unknown' type error
            const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Gere exatamente ${targetCount} questões inéditas de múltipla escolha de Língua Portuguesa para concursos. JSON: [{"statement": string, "options": string[], "correctAnswer": string, "justification": string, "subjectName": "Português", "topicName": "Geral"}]`,
                config: { responseMimeType: "application/json" }
            }));
            const items = cleanJsonResponse(response.text || '[]').map((it: any, idx: number) => ({
                ...it, id: `port-${Date.now()}-${idx}`
            }));
            return res.status(200).json(items.slice(0, targetCount));
        }

        // --- CARREGAMENTO DE DISCIPLINAS E CONTEÚDO ---
        const coursesSnap = await db.collection('courses').where('enrolledStudentIds', 'array-contains', studentId).get();
        const allEnrolledSubjectIds = new Set<string>();
        coursesSnap.docs.forEach(doc => (doc.data().disciplines || []).forEach((d: any) => allEnrolledSubjectIds.add(d.subjectId)));

        const subjects: any[] = [];
        const subjectIdsToFetch = Array.from(allEnrolledSubjectIds);

        if (subjectIdsToFetch.length > 0) {
            for (let i = 0; i < subjectIdsToFetch.length; i += 10) {
                const chunk = subjectIdsToFetch.slice(i, i + 10);
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
            const isAdv = studentProgress.dailyReviewMode === 'advanced';
            const selSubIds = isAdv ? (studentProgress.advancedReviewSubjectIds || []) : [];
            const selTopIds = isAdv ? (studentProgress.advancedReviewTopicIds || []) : [];
            const filterType = isAdv ? (studentProgress.advancedReviewQuestionType || 'incorrect') : 'unanswered';
            const targetCount = isAdv ? (studentProgress.advancedReviewQuestionCount || 5) : 10;

            const correctIds = new Set<string>();
            const incorrectIds = new Set<string>();
            const allAnsweredIds = new Set<string>();

            const processAttempt = (a: QuestionAttempt) => {
                if (!a?.questionId) return;
                allAnsweredIds.add(a.questionId);
                if (a.isCorrect) { correctIds.add(a.questionId); incorrectIds.delete(a.questionId); }
                else { incorrectIds.add(a.questionId); }
            };

            Object.values(studentProgress.progressByTopic || {}).forEach(s => 
                Object.values(s || {}).forEach(t => (t.lastAttempt || []).forEach(processAttempt))
            );
            (studentProgress.reviewSessions || []).forEach(s => (s.attempts || []).forEach(processAttempt));

            let pool: any[] = [];
            subjects.forEach(subject => {
                if (selSubIds.length > 0 && !selSubIds.includes(subject.id)) return;
                subject.topics.forEach((topic: any) => {
                    const processT = (t: any) => {
                        const hasTopicSelection = selTopIds.length > 0;
                        if (hasTopicSelection && !selTopIds.includes(t.id)) return;
                        const qs = [
                            ...(t.questions || []).map((q: any) => ({ ...q, subjectId: subject.id, topicId: t.id, subjectName: subject.name, topicName: t.name, mnemonicTopic: t.name })),
                            ...(t.tecQuestions || []).map((q: any) => ({ ...q, subjectId: subject.id, topicId: t.id, subjectName: subject.name, topicName: t.name, mnemonicTopic: t.name }))
                        ];
                        pool.push(...qs);
                    };
                    processT(topic);
                    (topic.subtopics || []).forEach(processT);
                });
            });

            let filtered = [];
            if (filterType === 'incorrect') filtered = pool.filter(q => incorrectIds.has(q.id));
            else if (filterType === 'correct') filtered = pool.filter(q => correctIds.has(q.id));
            else if (filterType === 'unanswered') filtered = pool.filter(q => !allAnsweredIds.has(q.id));
            else filtered = pool;

            const final = shuffleArray(filtered).slice(0, targetCount);
            return res.status(200).json(final);
        }

        // --- GLOSSÁRIO ---
        if (challengeType === 'glossary') {
            const isAdv = studentProgress.glossaryChallengeMode === 'advanced';
            const selSubIds = isAdv ? (studentProgress.advancedGlossarySubjectIds || []) : [];
            const selTopIds = isAdv ? (studentProgress.advancedGlossaryTopicIds || []) : [];
            const targetCount = isAdv ? (studentProgress.glossaryChallengeQuestionCount || 5) : 5;

            const glossaryPool: any[] = [];
            subjects.forEach(s => {
                if (selSubIds.length > 0 && !selSubIds.includes(s.id)) return;
                s.topics.forEach((t: any) => {
                    const processGloss = (item: any) => {
                        if (selTopIds.length > 0 && !selTopIds.includes(item.id)) return;
                        (item.glossary || []).forEach((g: any) => glossaryPool.push({ ...g, subjectName: s.name, topicName: item.name }));
                    };
                    processGloss(t);
                    (t.subtopics || []).forEach((st: any) => processGloss(st));
                });
            });

            const unique = Array.from(new Map(glossaryPool.map(t => [t.term, t])).values());
            const selectedTerms = shuffleArray(unique).slice(0, targetCount);
            
            if (selectedTerms.length === 0) return res.status(200).json([]);

            // OTIMIZAÇÃO: Gerar todas as questões de uma vez só para poupar cota de IA
            const termsPrompt = selectedTerms.map(g => `Termo: "${g.term}", Definição: "${g.definition}"`).join('; ');
            // FIX: Added explicit type parameter <GenerateContentResponse> to retryWithBackoff call to resolve 'unknown' type error
            const gen = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Baseado nos seguintes pares de termos técnicos e definições de concurso, gere exatamente uma questão de múltipla escolha para CADA par. Retorne um array JSON. 
                Pares: ${termsPrompt}. 
                JSON Format: [{"statement": string, "options": string[], "correctAnswer": string, "justification": string, "mnemonicTopic": string}]`,
                config: { responseMimeType: "application/json" }
            }));
            
            const questions = cleanJsonResponse(gen.text || '[]');
            const finalItems = questions.map((q: any, idx: number) => {
                const originalTerm = selectedTerms[idx] || selectedTerms[0];
                return { 
                    ...q, 
                    id: `gloss-${Date.now()}-${idx}`, 
                    subjectName: originalTerm.subjectName, 
                    topicName: originalTerm.topicName 
                };
            });

            return res.status(200).json(finalItems);
        }

        return res.status(400).json({ error: 'Tipo inválido' });
    } catch (e: any) {
        console.error("Server Error:", e);
        return res.status(500).json({ error: e.message });
    }
}

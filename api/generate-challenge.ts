
import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';
import { GoogleGenAI } from "@google/genai";

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
        throw new Error(`Erro de parse JSON da IA`);
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

        const geminiKey = process.env.API_KEY;
        const ai = new GoogleGenAI({ apiKey: geminiKey! });

        // --- PORTUGUÊS (Rigor: Quantidade) ---
        if (challengeType === 'portuguese') {
            const targetCount = studentProgress.portugueseChallengeQuestionCount || 1;
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Gere exatamente ${targetCount} questões inéditas de múltipla escolha de Língua Portuguesa para concursos. JSON: [{"statement": string, "options": string[], "correctAnswer": string, "justification": string, "subjectName": "Português", "topicName": "Geral"}]`,
                config: { responseMimeType: "application/json" }
            });
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

        // --- REVISÃO (Rigor: Filtros de Erro/Acerto + Tópicos) ---
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
                // Filtro de Disciplina
                if (selSubIds.length > 0 && !selSubIds.includes(subject.id)) return;
                
                subject.topics.forEach((topic: any) => {
                    const processT = (t: any) => {
                        // Filtro de Tópico (se houver seleção específica)
                        const hasTopicSelection = selTopIds.length > 0;
                        if (hasTopicSelection && !selTopIds.includes(t.id)) return;

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
            if (filterType === 'incorrect') filtered = pool.filter(q => incorrectIds.has(q.id));
            else if (filterType === 'correct') filtered = pool.filter(q => correctIds.has(q.id));
            else if (filterType === 'unanswered') filtered = pool.filter(q => !allAnsweredIds.has(q.id));
            else filtered = pool;

            // Se for rigoroso "Misto" ou se o filtro não retornar o suficiente, completamos até a meta se permitido ou retornamos o que tem
            const final = shuffleArray(filtered).slice(0, targetCount);
            return res.status(200).json(final);
        }

        // --- GLOSSÁRIO (Rigor: Tópicos Selecionados) ---
        if (challengeType === 'glossary') {
            const isAdv = studentProgress.glossaryChallengeMode === 'advanced';
            const selSubIds = isAdv ? (studentProgress.advancedGlossarySubjectIds || []) : [];
            const selTopIds = isAdv ? (studentProgress.advancedGlossaryTopicIds || []) : [];
            const targetCount = isAdv ? (studentProgress.glossaryChallengeQuestionCount || 5) : 5;

            const glossaryPool: any[] = [];
            subjects.forEach(s => {
                if (selSubIds.length > 0 && !selSubIds.includes(s.id)) return;
                s.topics.forEach((t: any) => {
                    const processGloss = (item: any, parent: any) => {
                        if (selTopIds.length > 0 && !selTopIds.includes(item.id)) return;
                        (item.glossary || []).forEach((g: any) => glossaryPool.push({ ...g, subjectName: s.name, topicName: item.name }));
                    };
                    processGloss(t, null);
                    (t.subtopics || []).forEach((st: any) => processGloss(st, t));
                });
            });

            const unique = Array.from(new Map(glossaryPool.map(t => [t.term, t])).values());
            const selectedTerms = shuffleArray(unique).slice(0, targetCount);
            const items = [];

            for (const g of selectedTerms) {
                const gen = await ai.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: `Termo: "${g.term}", Definição: "${g.definition}". Gere 1 questão de múltipla escolha. JSON: {"statement": string, "options": string[], "correctAnswer": string, "justification": string}`,
                    config: { responseMimeType: "application/json" }
                });
                const q = cleanJsonResponse(gen.text || '{}');
                items.push({ ...q, id: `gloss-${Date.now()}-${Math.random()}`, subjectName: g.subjectName, topicName: g.topicName });
            }
            return res.status(200).json(items);
        }

        return res.status(400).json({ error: 'Tipo inválido' });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}


import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';
import { GoogleGenAI } from "@google/genai";

/** 
 * Tipos definidos localmente para evitar problemas de caminho relativo 
 * no ambiente de build da Vercel (Serverless Functions)
 */
interface QuestionAttempt {
    questionId: string;
    isCorrect: boolean;
}

interface Question {
    id: string;
    statement: string;
    options: string[];
    correctAnswer: string;
    justification: string;
    subjectId?: string;
    topicId?: string;
    subjectName?: string;
    topicName?: string;
}

interface StudentProgress {
    dailyReviewMode?: 'standard' | 'advanced';
    advancedReviewQuestionType?: 'incorrect' | 'correct' | 'unanswered' | 'mixed';
    advancedReviewQuestionCount?: number;
    advancedReviewSubjectIds?: string[];
    advancedReviewTopicIds?: string[];
    progressByTopic: { [subjectId: string]: { [topicId: string]: { lastAttempt: QuestionAttempt[], score: number } } };
    reviewSessions: { attempts?: QuestionAttempt[] }[];
    customQuizzes: { attempts?: QuestionAttempt[] }[];
    simulados?: { attempts?: QuestionAttempt[] }[];
    glossaryChallengeMode?: 'standard' | 'advanced';
    glossaryChallengeQuestionCount?: number;
    advancedGlossarySubjectIds?: string[];
    advancedGlossaryTopicIds?: string[];
    portugueseChallengeQuestionCount?: number;
    xp: number;
    studentId: string;
}

interface Subject {
    id: string;
    name: string;
    topics: { id: string, name: string, glossary?: { term: string, definition: string }[], questions: any[], tecQuestions?: any[], subtopics: any[] }[];
}

// Inicialização segura
const initFirebase = () => {
    if (!admin.apps.length) {
        let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
        
        // Limpeza profunda da chave privada para evitar erros de aspas/quebra de linha no Vercel
        privateKey = privateKey.trim();
        if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
            privateKey = privateKey.substring(1, privateKey.length - 1);
        }
        privateKey = privateKey.replace(/\\n/g, '\n');

        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                privateKey: privateKey,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            }),
        });
    }
    return admin.firestore();
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
            if (matches && matches[1]) {
                cleanText = matches[1];
            }
        }
        return JSON.parse(cleanText);
    } catch (e) {
        console.error("Erro parse Gemini JSON:", text);
        throw new Error("Formato de JSON inválido retornado pela IA.");
    }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { apiKey, studentId, challengeType } = req.query;

    // Validação de segurança básica
    if (!apiKey || apiKey !== process.env.VITE_DAILY_CHALLENGE_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized: Chave de API inválida.' });
    }

    try {
        const db = initFirebase();
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const studentDoc = await db.collection('studentProgress').doc(studentId as string).get();
        if (!studentDoc.exists) return res.status(404).json({ error: 'Aluno não encontrado' });
        const studentProgress = studentDoc.data() as StudentProgress;

        // --- PORTUGUÊS (Não depende de busca de disciplinas) ---
        if (challengeType === 'portuguese') {
            const targetCount = studentProgress.portugueseChallengeQuestionCount || 1;
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Gere ${targetCount} questões de múltipla escolha de Língua Portuguesa para concursos. JSON: [{"statement": string, "options": string[], "correctAnswer": string, "justification": string}]`,
                config: { responseMimeType: "application/json" }
            });
            return res.status(200).json(cleanJsonResponse(response.text || '[]'));
        }

        // Para os outros, precisamos das disciplinas
        const coursesSnap = await db.collection('courses').where('enrolledStudentIds', 'array-contains', studentId).get();
        const subjectIds = new Set<string>();
        coursesSnap.docs.forEach(doc => (doc.data().disciplines || []).forEach((d: any) => subjectIds.add(d.subjectId)));

        const subjects: Subject[] = [];
        const subjectIdsArray = Array.from(subjectIds);

        if (subjectIdsArray.length > 0) {
            // Firestore 'in' query limitada a 10
            for (let i = 0; i < subjectIdsArray.length; i += 10) {
                const chunk = subjectIdsArray.slice(i, i + 10);
                const subjectDocs = await db.collection('subjects').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();
                for (const doc of subjectDocs.docs) {
                    const topicsSnap = await doc.ref.collection('topics').get();
                    subjects.push({ 
                        id: doc.id, 
                        name: doc.data().name, 
                        topics: topicsSnap.docs.map(t => ({ id: t.id, ...t.data() } as any)) 
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

            Object.values(studentProgress.progressByTopic || {}).forEach(s => Object.values(s || {}).forEach(t => (t.lastAttempt || []).forEach(processAttempt)));
            (studentProgress.reviewSessions || []).forEach(s => (s.attempts || []).forEach(processAttempt));

            let pool: Question[] = [];
            subjects.forEach(subject => {
                subject.topics.forEach(topic => {
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

            let filtered: Question[] = [];
            if (filterType === 'incorrect') filtered = pool.filter(q => everIncorrect.has(q.id));
            else if (filterType === 'correct') filtered = pool.filter(q => everCorrect.has(q.id));
            else if (filterType === 'unanswered') filtered = pool.filter(q => !allAnswered.has(q.id));
            else filtered = pool;

            if (filtered.length < targetCount) {
                const remains = pool.filter(q => !filtered.some(fq => fq.id === q.id));
                filtered = [...filtered, ...shuffleArray(remains).slice(0, targetCount - filtered.length)];
            }
            return res.status(200).json(shuffleArray(filtered).slice(0, targetCount));
        }

        // --- GLOSSÁRIO ---
        if (challengeType === 'glossary') {
            const isAdvanced = studentProgress.glossaryChallengeMode === 'advanced';
            const targetCount = isAdvanced ? (studentProgress.glossaryChallengeQuestionCount || 5) : 5;

            const glossaryPool = subjects.flatMap(s => s.topics.flatMap(t => {
                const terms = [...(t.glossary || [])];
                (t.subtopics || []).forEach((st: any) => terms.push(...(st.glossary || [])));
                return terms;
            }));

            const unique = Array.from(new Map(glossaryPool.map(t => [t.term, t])).values());
            const items = shuffleArray(unique).slice(0, targetCount).map(g => ({
                id: `gloss-${Date.now()}-${Math.random()}`,
                statement: `Qual a definição correta para: **${g.term}**?`,
                options: shuffleArray([g.definition, "Definição incorreta 1", "Definição incorreta 2", "Definição incorreta 3", "Definição incorreta 4"]),
                correctAnswer: g.definition,
                justification: `O termo ${g.term} define-se como: ${g.definition}`
            }));
            return res.status(200).json(items);
        }

        return res.status(400).json({ error: 'Tipo inválido' });

    } catch (error: any) {
        console.error("ERRO API:", error);
        return res.status(500).json({ 
            error: "Falha na execução da função", 
            details: error.message,
            stack: error.stack 
        });
    }
}

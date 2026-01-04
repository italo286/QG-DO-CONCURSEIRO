
import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';

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

        // --- PORTUGUÊS (IA) ---
        if (challengeType === 'portuguese') {
            const { GoogleGenAI } = await import("@google/genai");
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
            const targetCount = studentProgress.portugueseChallengeQuestionCount || 1;
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Gere exatamente ${targetCount} questões inéditas de múltipla escolha de Língua Portuguesa para concursos de nível superior. Retorne um array JSON com: statement, options (5 itens), correctAnswer (string exata), justification.`,
                config: { responseMimeType: "application/json" }
            });
            const text = response.text || '[]';
            const items = JSON.parse(text.includes('```') ? text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)?.[1] || text : text);
            return res.status(200).json(items.map((it: any, idx: number) => ({
                ...it, id: `port-${Date.now()}-${idx}`, subjectName: "Português", topicName: "Geral"
            })));
        }

        // --- CARREGAMENTO DE DISCIPLINAS ---
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

            const incorrectIds = new Set<string>();
            const allAnsweredIds = new Set<string>();

            const processAttempt = (a: QuestionAttempt) => {
                if (!a?.questionId) return;
                allAnsweredIds.add(a.questionId);
                if (!a.isCorrect) incorrectIds.add(a.questionId);
                else incorrectIds.delete(a.questionId);
            };

            Object.values(studentProgress.progressByTopic || {}).forEach(s => 
                Object.values(s || {}).forEach(t => (t.lastAttempt || []).forEach(processAttempt))
            );

            let pool: any[] = [];
            subjects.forEach(subject => {
                if (selSubIds.length > 0 && !selSubIds.includes(subject.id)) return;
                subject.topics.forEach((topic: any) => {
                    const processT = (t: any) => {
                        if (selTopIds.length > 0 && !selTopIds.includes(t.id)) return;
                        pool.push(...(t.questions || []).map((q: any) => ({ ...q, subjectName: subject.name, topicName: t.name })));
                        pool.push(...(t.tecQuestions || []).map((q: any) => ({ ...q, subjectName: subject.name, topicName: t.name })));
                    };
                    processT(topic);
                    (topic.subtopics || []).forEach(processT);
                });
            });

            let filtered = filterType === 'incorrect' ? pool.filter(q => incorrectIds.has(q.id)) : pool.filter(q => !allAnsweredIds.has(q.id));
            if (filtered.length === 0) filtered = pool;
            return res.status(200).json(shuffleArray(filtered).slice(0, targetCount));
        }

        // --- GLOSSÁRIO (LÓGICA DETERMINÍSTICA E ISOLADA) ---
        if (challengeType === 'glossary') {
            const isAdv = studentProgress.glossaryChallengeMode === 'advanced';
            const selSubIds = isAdv ? (studentProgress.advancedGlossarySubjectIds || []) : [];
            const selTopIds = isAdv ? (studentProgress.advancedGlossaryTopicIds || []) : [];
            const targetCount = isAdv ? (studentProgress.glossaryChallengeQuestionCount || 5) : 5;

            // 1. Agrupa termos por disciplina para garantir o isolamento solicitado
            const termsBySubject: Record<string, { subjectName: string, items: any[] }> = {};
            
            subjects.forEach(s => {
                if (selSubIds.length > 0 && !selSubIds.includes(s.id)) return;
                
                s.topics.forEach((t: any) => {
                    const collect = (item: any) => {
                        if (selTopIds.length > 0 && !selTopIds.includes(item.id)) return;
                        (item.glossary || []).forEach((g: any) => {
                            if (!termsBySubject[s.id]) termsBySubject[s.id] = { subjectName: s.name, items: [] };
                            termsBySubject[s.id].items.push({ 
                                ...g, 
                                subjectId: s.id, 
                                subjectName: s.name, 
                                topicName: item.name 
                            });
                        });
                    };
                    collect(t);
                    (t.subtopics || []).forEach(collect);
                });
            });

            // 2. Cria lista de disciplinas elegíveis (mínimo de 2 termos para haver distrator)
            const eligibleSubjects = Object.keys(termsBySubject).filter(sid => termsBySubject[sid].items.length >= 2);
            if (eligibleSubjects.length === 0) return res.status(200).json([]);

            // 3. Sorteia os termos alvo proporcionalmente ou aleatoriamente entre as disciplinas elegíveis
            const allPossibleTargets = eligibleSubjects.flatMap(sid => termsBySubject[sid].items);
            const selectedTargets = shuffleArray(allPossibleTargets).slice(0, targetCount);

            // 4. Constrói as questões respeitando o isolamento total de disciplinas
            const questions = selectedTargets.map((target, idx) => {
                const subjectPool = termsBySubject[target.subjectId].items;
                const otherTermsSameSubject = subjectPool.filter(t => t.term !== target.term);
                
                const isTypeA = Math.random() > 0.5; // Alterna entre Termo->Definição e Definição->Termo
                let statement = "";
                let correctAnswer = "";
                let distractors = [];

                if (isTypeA) {
                    // TIPO A: "Qual a definição correta do Termo?"
                    statement = `Qual das alternativas abaixo apresenta a definição correta para o termo técnico: **${target.term}**?`;
                    correctAnswer = target.definition;
                    // Sorteia apenas outras DEFINIÇÕES da mesma matéria
                    distractors = shuffleArray(otherTermsSameSubject).slice(0, 4).map(t => t.definition);
                } else {
                    // TIPO B: "Esta definição se refere a qual Termo?"
                    statement = `"${target.definition}"\n\nO conceito descrito acima refere-se a qual termo técnico da disciplina de **${target.subjectName}**?`;
                    correctAnswer = target.term;
                    // Sorteia apenas outros NOMES de termos da mesma matéria
                    distractors = shuffleArray(otherTermsSameSubject).slice(0, 4).map(t => t.term);
                }

                // Garante que temos no máximo 5 opções totais
                const options = shuffleArray([correctAnswer, ...distractors]);

                return {
                    id: `gloss-${Date.now()}-${idx}`,
                    statement,
                    options,
                    correctAnswer,
                    justification: isTypeA 
                        ? `O termo **${target.term}** é definido literalmente como: ${target.definition}.`
                        : `O termo técnico correspondente à definição apresentada é **${target.term}**.`,
                    subjectName: target.subjectName,
                    topicName: target.topicName
                };
            });

            return res.status(200).json(questions);
        }

        return res.status(400).json({ error: 'Tipo inválido' });
    } catch (e: any) {
        console.error("Challenge Generation Error:", e);
        return res.status(500).json({ error: e.message });
    }
}

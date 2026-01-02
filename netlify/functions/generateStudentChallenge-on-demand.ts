
import { Handler, HandlerEvent } from '@netlify/functions';
import * as admin from 'firebase-admin';
import { GoogleGenAI } from "@google/genai";
import { StudentProgress, Subject, Question, Topic, SubTopic, QuestionAttempt } from '../../src/types.server';

function checkEnvVars() {
    const required = [
        'FIREBASE_PROJECT_ID',
        'FIREBASE_PRIVATE_KEY',
        'FIREBASE_CLIENT_EMAIL',
        'API_KEY',
        'VITE_DAILY_CHALLENGE_API_KEY'
    ];
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Variáveis de ambiente ausentes no Netlify: ${missing.join(', ')}`);
    }
}

try {
    if (!admin.apps.length) {
        checkEnvVars();
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            }),
        });
    }
} catch (e) {
    console.error("Erro crítico na inicialização do Firebase Admin:", e);
}

const db = admin.firestore();

const shuffleArray = <T>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

// Busca as disciplinas apenas quando necessário para economizar tempo/recursos
async function fetchEnrolledSubjects(studentId: string): Promise<Subject[]> {
    const coursesSnap = await db.collection('courses').where('enrolledStudentIds', 'array-contains', studentId).get();
    const subjectIds = new Set<string>();
    coursesSnap.docs.forEach(doc => (doc.data().disciplines || []).forEach((d: any) => subjectIds.add(d.subjectId)));

    const subjects: Subject[] = [];
    const subjectIdsArray = Array.from(subjectIds);

    if (subjectIdsArray.length > 0) {
        const chunks = [];
        for (let i = 0; i < subjectIdsArray.length; i += 10) {
            chunks.push(subjectIdsArray.slice(i, i + 10));
        }

        for (const chunk of chunks) {
            const subjectDocs = await db.collection('subjects').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();
            for (const doc of subjectDocs.docs) {
                const topicsSnap = await doc.ref.collection('topics').get();
                subjects.push({ 
                    id: doc.id, 
                    ...doc.data(), 
                    topics: topicsSnap.docs.map(t => ({ id: t.id, ...t.data() } as Topic)) 
                } as Subject);
            }
        }
    }
    return subjects;
}

async function getReviewPool(studentProgress: StudentProgress, subjects: Subject[]): Promise<Question[]> {
    if (subjects.length === 0) return [];
    const isAdvanced = studentProgress.dailyReviewMode === 'advanced';
    const filterType = isAdvanced ? (studentProgress.advancedReviewQuestionType || 'incorrect') : 'unanswered';
    const targetCount = isAdvanced ? (studentProgress.advancedReviewQuestionCount || 5) : 10;
    const selectedSubjectIds = isAdvanced ? (studentProgress.advancedReviewSubjectIds || []) : [];
    const selectedTopicIds = isAdvanced ? (studentProgress.advancedReviewTopicIds || []) : [];

    const everCorrect = new Set<string>();
    const everIncorrect = new Set<string>();
    const allAnswered = new Set<string>();

    const processAttempt = (a: QuestionAttempt) => {
        if (!a || !a.questionId) return;
        allAnswered.add(a.questionId);
        if (a.isCorrect) everCorrect.add(a.questionId);
        else everIncorrect.add(a.questionId);
    };

    Object.values(studentProgress.progressByTopic || {}).forEach(s => 
        Object.values(s || {}).forEach(t => (t.lastAttempt || []).forEach(processAttempt))
    );
    (studentProgress.reviewSessions || []).forEach(s => (s.attempts || []).forEach(processAttempt));
    (studentProgress.customQuizzes || []).forEach(s => (s.attempts || []).forEach(processAttempt));
    (studentProgress.simulados || []).forEach(s => (s.attempts || []).forEach(processAttempt));

    let pool: Question[] = [];
    subjects.forEach(subject => {
        if (selectedSubjectIds.length > 0 && !selectedSubjectIds.includes(subject.id)) return;
        subject.topics.forEach(topic => {
            const processT = (t: Topic | SubTopic) => {
                if (selectedTopicIds.length > 0 && !selectedTopicIds.includes(t.id)) return;
                const questions = [
                    ...(t.questions || []).map(q => ({ ...q, subjectId: subject.id, topicId: t.id, subjectName: subject.name, topicName: t.name })),
                    ...(t.tecQuestions || []).map(q => ({ ...q, subjectId: subject.id, topicId: t.id, subjectName: subject.name, topicName: t.name }))
                ];
                pool.push(...questions);
            };
            processT(topic);
            (topic.subtopics || []).forEach(processT);
        });
    });

    let filtered: Question[] = [];
    switch (filterType) {
        case 'incorrect': filtered = pool.filter(q => everIncorrect.has(q.id)); break;
        case 'correct': filtered = pool.filter(q => everCorrect.has(q.id)); break;
        case 'unanswered': filtered = pool.filter(q => !allAnswered.has(q.id)); break;
        case 'mixed': default: filtered = pool; break;
    }
    if (filtered.length < targetCount) {
        const remainingNeeded = targetCount - filtered.length;
        const remainingOptions = pool.filter(q => !filtered.some(fq => fq.id === q.id));
        filtered = [...filtered, ...shuffleArray(remainingOptions).slice(0, remainingNeeded)];
    }
    return shuffleArray(filtered).slice(0, targetCount);
}

const handler: Handler = async (event: HandlerEvent) => {
    const { apiKey, studentId, challengeType } = event.queryStringParameters || {};
    if (!apiKey || apiKey !== process.env.VITE_DAILY_CHALLENGE_API_KEY) {
        return { statusCode: 401, body: 'Unauthorized: API Key interna inválida.' };
    }

    if (!process.env.API_KEY) {
        return { statusCode: 400, body: 'Erro: API_KEY do Gemini não configurada no Netlify.' };
    }

    try {
        checkEnvVars();

        // Busca APENAS o progresso do aluno primeiro
        const studentDoc = await db.collection('studentProgress').doc(studentId!).get();
        if (!studentDoc.exists) return { statusCode: 404, body: 'Student Progress not found' };
        const studentProgress = studentDoc.data() as StudentProgress;

        let items: any[] = [];
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        if (challengeType === 'portuguese') {
            // FLUXO RÁPIDO: Português não depende de disciplinas do Firestore
            const targetCount = studentProgress.portugueseChallengeQuestionCount || 1;
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Gere exatamente ${targetCount} questões de múltipla escolha de Língua Portuguesa (Gramática/Interpretação) para concursos nível superior. Retorne APENAS um array JSON de objetos: {"statement": string, "options": string[], "correctAnswer": string, "justification": string}.`,
                config: { responseMimeType: "application/json" }
            });
            try {
                items = JSON.parse(response.text || '[]');
                if (items.length > targetCount) items = items.slice(0, targetCount);
            } catch (e) {
                console.error("Erro parse Gemini:", response.text);
                throw new Error("Falha ao processar resposta da IA.");
            }
        } else {
            // FLUXO LENTO: Revisão e Glossário dependem do Firestore (apenas chamados se necessário)
            const subjects = await fetchEnrolledSubjects(studentId!);

            if (challengeType === 'review') {
                items = await getReviewPool(studentProgress, subjects);
            } else if (challengeType === 'glossary') {
                const isAdvanced = studentProgress.glossaryChallengeMode === 'advanced';
                const targetCount = isAdvanced ? (studentProgress.glossaryChallengeQuestionCount || 5) : 5;
                const selSubIds = isAdvanced ? (studentProgress.advancedGlossarySubjectIds || []) : [];
                const selTopIds = isAdvanced ? (studentProgress.advancedGlossaryTopicIds || []) : [];

                const glossaryPool = subjects.flatMap(s => {
                    if (selSubIds.length > 0 && !selSubIds.includes(s.id)) return [];
                    return s.topics.flatMap(t => {
                        const terms = [];
                        if (selTopIds.length === 0 || selTopIds.includes(t.id)) terms.push(...(t.glossary || []));
                        (t.subtopics || []).forEach(st => {
                            if (selTopIds.length === 0 || selTopIds.includes(st.id)) terms.push(...(st.glossary || []));
                        });
                        return terms;
                    });
                });

                const uniqueTerms = Array.from(new Map(glossaryPool.map(t => [t.term, t])).values());
                items = shuffleArray(uniqueTerms).slice(0, targetCount).map(g => ({
                    id: `gloss-${Date.now()}-${Math.random()}`,
                    statement: `Qual a definição correta para o termo técnico: **${g.term}**?`,
                    options: shuffleArray([g.definition, "Opção incorreta 1", "Opção incorreta 2", "Opção incorreta 3", "Opção incorreta 4"]),
                    correctAnswer: g.definition,
                    justification: `O termo ${g.term} define-se como: ${g.definition}.`
                }));
            }
        }

        return { 
            statusCode: 200, 
            body: JSON.stringify(items), 
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
        };
    } catch (error: any) {
        console.error("Erro na função:", error);
        return { 
            statusCode: error.message.includes('timeout') ? 504 : 500, 
            body: JSON.stringify({ error: error.message }),
            headers: { 'Content-Type': 'application/json' }
        };
    }
};

export { handler };

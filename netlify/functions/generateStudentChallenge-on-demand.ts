
import { Handler, HandlerEvent } from '@netlify/functions';
import * as admin from 'firebase-admin';
import { GoogleGenAI } from "@google/genai";
import { StudentProgress, Subject, Question, Topic, SubTopic, QuestionAttempt } from '../../src/types.server';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
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

async function getReviewPool(studentProgress: StudentProgress, subjects: Subject[]): Promise<Question[]> {
    const isAdvanced = studentProgress.dailyReviewMode === 'advanced';
    const filterType = isAdvanced ? (studentProgress.advancedReviewQuestionType || 'incorrect') : 'unanswered';
    const targetCount = isAdvanced ? (studentProgress.advancedReviewQuestionCount || 5) : 10;
    const selectedSubjectIds = isAdvanced ? studentProgress.advancedReviewSubjectIds : [];
    const selectedTopicIds = isAdvanced ? studentProgress.advancedReviewTopicIds : [];

    const everCorrect = new Set<string>();
    const everIncorrect = new Set<string>();
    const allAnswered = new Set<string>();

    const processAttempt = (a: QuestionAttempt) => {
        allAnswered.add(a.questionId);
        if (a.isCorrect) everCorrect.add(a.questionId);
        else everIncorrect.add(a.questionId);
    };

    // Coleta histórico de todas as fontes possíveis
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
                const questions = [...(t.questions || []), ...(t.tecQuestions || [])];
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

    // Fallback: se o filtro for muito restrito, pega o que estiver disponível para não deixar o aluno sem desafio
    if (filtered.length < targetCount) {
        const remainingNeeded = targetCount - filtered.length;
        const fallbackOptions = pool.filter(q => !filtered.some(fq => fq.id === q.id));
        filtered.push(...shuffleArray(fallbackOptions).slice(0, remainingNeeded));
    }

    return shuffleArray(filtered).slice(0, targetCount);
}

const handler: Handler = async (event: HandlerEvent) => {
    const { apiKey, studentId, challengeType } = event.queryStringParameters || {};
    if (!apiKey || apiKey !== process.env.VITE_DAILY_CHALLENGE_API_KEY) return { statusCode: 401, body: 'Unauthorized' };

    try {
        const studentDoc = await db.collection('studentProgress').doc(studentId!).get();
        if (!studentDoc.exists) return { statusCode: 404, body: 'Progress not found' };
        const studentProgress = studentDoc.data() as StudentProgress;

        const coursesSnap = await db.collection('courses').where('enrolledStudentIds', 'array-contains', studentId).get();
        const subjectIds = new Set<string>();
        coursesSnap.docs.forEach(doc => (doc.data().disciplines || []).forEach((d: any) => subjectIds.add(d.subjectId)));

        const subjects: Subject[] = [];
        if (subjectIds.size > 0) {
            const subjectDocs = await db.collection('subjects').where(admin.firestore.FieldPath.documentId(), 'in', Array.from(subjectIds).slice(0, 10)).get();
            for (const doc of subjectDocs.docs) {
                const topicsSnap = await doc.ref.collection('topics').get();
                subjects.push({ id: doc.id, ...doc.data(), topics: topicsSnap.docs.map(t => ({ id: t.id, ...t.data() } as Topic)) } as Subject);
            }
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        let items: any[] = [];

        if (challengeType === 'review') {
            items = await getReviewPool(studentProgress, subjects);
        } else if (challengeType === 'glossary') {
            const glossaryPool = subjects.flatMap(s => s.topics.flatMap(t => [...(t.glossary || []), ...t.subtopics.flatMap(st => st.glossary || [])]));
            items = shuffleArray(glossaryPool).slice(0, 5).map(g => ({
                id: `gloss-${Date.now()}-${Math.random()}`,
                statement: `Qual a definição correta para: **${g.term}**?`,
                options: shuffleArray([g.definition, "Opção incorreta 1", "Opção incorreta 2", "Opção incorreta 3", "Opção incorreta 4"]),
                correctAnswer: g.definition,
                justification: `Termo: ${g.term}. Definição: ${g.definition}`
            }));
        } else if (challengeType === 'portuguese') {
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: "Gere 3 questões de português (gramática/interpretação) nível concurso no formato JSON array de objetos com statement, options (5 itens), correctAnswer e justification.",
                config: { responseMimeType: "application/json" }
            });
            items = JSON.parse(response.text || '[]');
        }

        return { statusCode: 200, body: JSON.stringify(items), headers: { 'Content-Type': 'application/json' } };
    } catch (error: any) {
        return { statusCode: 500, body: error.message };
    }
};

export { handler };

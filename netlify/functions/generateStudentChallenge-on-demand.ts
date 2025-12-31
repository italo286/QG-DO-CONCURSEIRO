
import { Handler, HandlerEvent } from '@netlify/functions';
import * as admin from 'firebase-admin';
import { GoogleGenAI, Type } from "@google/genai";
import { StudentProgress, Subject, Course, Question, Topic, SubTopic, QuestionAttempt } from '../../src/types.server';

// --- Firebase Admin Initialization ---
let db: admin.firestore.Firestore;
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}
db = admin.firestore();

// --- Helper Functions ---
const parseJsonResponse = <T,>(jsonString: string, expectedType: 'array' | 'object'): T => {
    try {
        let cleanJsonString = jsonString;
        const codeBlockRegex = /```(json)?\s*([\s\S]*?)\s*```/;
        const match = codeBlockRegex.exec(jsonString);
        if (match && match[2]) cleanJsonString = match[2];
        const parsed = JSON.parse(cleanJsonString);
        if (expectedType === 'array' && !Array.isArray(parsed)) throw new Error("IA response is not an array.");
        return parsed;
    } catch(e) {
        throw new Error("Invalid JSON format from AI response.");
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

// --- Challenge Generation Logic ---

async function generateReviewChallenge(studentProgress: StudentProgress, allEnrolledSubjects: Subject[]): Promise<Question[]> {
    const isAdvancedMode = studentProgress.dailyReviewMode === 'advanced';
    const filterType = isAdvancedMode ? (studentProgress.advancedReviewQuestionType || 'incorrect') : 'unanswered';
    const targetCount = isAdvancedMode ? (studentProgress.advancedReviewQuestionCount || 5) : 10;
    const selectedSubjectIds = isAdvancedMode ? studentProgress.advancedReviewSubjectIds : [];
    const selectedTopicIds = isAdvancedMode ? studentProgress.advancedReviewTopicIds : [];

    // 1. Mapear histórico do aluno
    const everCorrect = new Set<string>();
    const everIncorrect = new Set<string>();
    const allAnswered = new Set<string>();

    const processAttempt = (a: QuestionAttempt) => {
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

    // Questões que o aluno ainda erra (errou e nunca acertou depois)
    const currentlyIncorrect = new Set([...everIncorrect].filter(id => !everCorrect.has(id)));

    // 2. Coletar todas as questões elegíveis
    let pool: Question[] = [];
    allEnrolledSubjects.forEach(subject => {
        if (isAdvancedMode && selectedSubjectIds.length > 0 && !selectedSubjectIds.includes(subject.id)) return;

        subject.topics.forEach(topic => {
            const processTopic = (t: Topic | SubTopic) => {
                if (isAdvancedMode && selectedTopicIds.length > 0 && !selectedTopicIds.includes(t.id)) return;
                const questions = [...(t.questions || []), ...(t.tecQuestions || [])].map(q => ({
                    ...q,
                    subjectId: subject.id,
                    subjectName: subject.name,
                    topicId: t.id,
                    topicName: t.name
                }));
                pool.push(...questions);
            };
            processTopic(topic);
            (topic.subtopics || []).forEach(processTopic);
        });
    });

    // 3. Filtrar a pool
    let filteredPool: Question[] = [];
    switch (filterType) {
        case 'incorrect':
            filteredPool = pool.filter(q => currentlyIncorrect.has(q.id));
            break;
        case 'correct':
            filteredPool = pool.filter(q => everCorrect.has(q.id));
            break;
        case 'unanswered':
            filteredPool = pool.filter(q => !allAnswered.has(q.id));
            break;
        case 'mixed':
        default:
            filteredPool = pool;
            break;
    }

    // Se a pool filtrada for vazia, tenta pegar qualquer uma para não travar o app
    if (filteredPool.length === 0) filteredPool = pool;

    return shuffleArray(filteredPool).slice(0, targetCount);
}

const handler: Handler = async (event: HandlerEvent) => {
    const { apiKey, studentId, challengeType } = event.queryStringParameters || {};

    if (!apiKey || apiKey !== process.env.VITE_DAILY_CHALLENGE_API_KEY) {
        return { statusCode: 401, body: 'Unauthorized' };
    }

    try {
        const studentDoc = await db.collection('studentProgress').doc(studentId!).get();
        if (!studentDoc.exists) return { statusCode: 404, body: 'Progress not found' };
        const studentProgress = studentDoc.data() as StudentProgress;

        // Buscar assuntos matriculados
        const coursesSnapshot = await db.collection('courses').where('enrolledStudentIds', 'array-contains', studentId).get();
        const subjectIds = new Set<string>();
        coursesSnapshot.docs.forEach(doc => (doc.data().disciplines || []).forEach((d: any) => subjectIds.add(d.subjectId)));

        const subjects: Subject[] = [];
        if (subjectIds.size > 0) {
            const subjectDocs = await db.collection('subjects').where(admin.firestore.FieldPath.documentId(), 'in', Array.from(subjectIds).slice(0, 10)).get();
            for (const doc of subjectDocs.docs) {
                const topicsSnap = await doc.ref.collection('topics').get();
                subjects.push({ 
                    id: doc.id, 
                    ...doc.data(), 
                    topics: topicsSnap.docs.map(t => ({ id: t.id, ...t.data() } as Topic))
                } as Subject);
            }
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        let challengeItems: any[] = [];

        if (challengeType === 'review') {
            challengeItems = await generateReviewChallenge(studentProgress, subjects);
        } else if (challengeType === 'glossary') {
            const isAdvanced = studentProgress.glossaryChallengeMode === 'advanced';
            const count = isAdvanced ? (studentProgress.glossaryChallengeQuestionCount || 5) : 5;
            
            const glossaryPool = subjects.flatMap(s => s.topics.flatMap(t => [
                ...(t.glossary || []),
                ...t.subtopics.flatMap(st => st.glossary || [])
            ]));
            
            // Filtro de "Nunca vistos" se possível ou aleatório
            challengeItems = shuffleArray(glossaryPool).slice(0, count).map(g => ({
                id: `gloss-${Date.now()}-${Math.random()}`,
                statement: `Qual a definição correta para o termo: **${g.term}**?`,
                options: shuffleArray([g.definition, "Definição incorreta A", "Definição incorreta B", "Definição incorreta C", "Definição incorreta D"]),
                correctAnswer: g.definition,
                justification: `O termo ${g.term} refere-se a: ${g.definition}`
            }));
        } else if (challengeType === 'portuguese') {
            const count = studentProgress.portugueseChallengeQuestionCount || 1;
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Gere ${count} questões de gramática de língua portuguesa (padrão concursos) no formato JSON. Cada questão deve ser uma frase dividida em 5 partes, onde o aluno deve clicar na parte que contém um erro gramatical. Retorne um array de objetos com: statement (frase completa), options (array com as 5 partes), correctAnswer (a parte exata com erro), justification (explicação) e errorCategory.`,
                config: { responseMimeType: "application/json" }
            });
            challengeItems = parseJsonResponse(response.text || '[]', 'array');
        }

        return {
            statusCode: 200,
            body: JSON.stringify(challengeItems),
            headers: { 'Content-Type': 'application/json' },
        };

    } catch (error: any) {
        return { statusCode: 500, body: error.message };
    }
};

export { handler };

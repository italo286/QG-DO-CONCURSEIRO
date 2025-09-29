

import { Handler, HandlerEvent } from '@netlify/functions';
import * as admin from 'firebase-admin';
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { StudentProgress, Subject, Course, Question, Topic, SubTopic, DailyChallenge } from '../../src/types.server';

// --- Firebase Admin Initialization ---
let db: admin.firestore.Firestore;
try {
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  };

  if (!serviceAccount.projectId || !serviceAccount.privateKey || !serviceAccount.clientEmail) {
    throw new Error('Firebase Admin credentials not set.');
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
  db = admin.firestore();
} catch (e: any) {
  console.error('FATAL: Firebase admin initialization failed:', e.message);
}

// --- Gemini API Initialization ---
const ai = new GoogleGenAI({apiKey: process.env.VITE_GEMINI_API_KEY});

// --- Helper Functions from original file ---
async function retryWithBackoff<T>( apiCall: () => Promise<T>, maxRetries: number = 3, initialDelay: number = 1000): Promise<T> {
    let delay = initialDelay;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await apiCall();
        } catch (error: any) {
            const errorMessage = error.toString().toLowerCase();
            const isTransientError = errorMessage.includes('503') || errorMessage.includes('500') || errorMessage.includes('429') || errorMessage.includes('unavailable') || errorMessage.includes('overloaded');
            if (isTransientError && i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
            } else {
                throw error;
            }
        }
    }
    throw new Error('Max retries reached for API call.');
}

const parseJsonResponse = <T,>(jsonString: string, expectedType: 'array' | 'object'): T => {
    try {
        let cleanJsonString = jsonString;
        const codeBlockRegex = /```(json)?\s*([\s\S]*?)\s*```/;
        const match = codeBlockRegex.exec(jsonString);
        if (match && match[2]) {
            cleanJsonString = match[2];
        }
        const parsed = JSON.parse(cleanJsonString);
        if (expectedType === 'array' && !Array.isArray(parsed)) throw new Error("IA response is not an array.");
        if (expectedType === 'object' && (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null)) throw new Error("IA response is not an object.");
        return parsed;
    } catch(e) {
        console.error("Error parsing AI JSON response: ", e);
        console.error("Received string:", jsonString);
        throw new Error("Invalid JSON format from AI response.");
    }
};

const questionSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        statement: { type: Type.STRING },
        options: { type: Type.ARRAY, items: { type: Type.STRING } },
        correctAnswer: { type: Type.STRING },
        justification: { type: Type.STRING },
        optionJustifications: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { option: { type: Type.STRING }, justification: { type: Type.STRING } },
            required: ["option", "justification"]
          }
        },
        errorCategory: { type: Type.STRING }
      },
      required: ["statement", "options", "correctAnswer", "justification"],
    },
};

const getStudentProgress = async (studentId: string): Promise<StudentProgress | null> => {
    const doc = await db.collection('studentProgress').doc(studentId).get();
    return doc.exists ? (doc.data() as StudentProgress) : null;
};

const getEnrolledSubjects = async (studentId: string): Promise<Subject[]> => {
    const coursesSnapshot = await db.collection('courses').where('enrolledStudentIds', 'array-contains', studentId).get();
    if (coursesSnapshot.empty) return [];
    
    const subjectIds = new Set<string>();
    coursesSnapshot.docs.forEach(doc => {
        const course = doc.data() as Course;
        course.disciplines.forEach(d => subjectIds.add(d.subjectId));
    });

    if (subjectIds.size === 0) return [];
    
    const subjectIdArray = Array.from(subjectIds);
    const chunks: string[][] = [];
    for (let i = 0; i < subjectIdArray.length; i += 10) { chunks.push(subjectIdArray.slice(i, i + 10)); }

    const allSubjects: Subject[] = [];
    for (const chunk of chunks) {
        if (chunk.length > 0) {
            const subjectDocs = await db.collection('subjects').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();
            subjectDocs.docs.forEach(doc => { allSubjects.push({ id: doc.id, ...doc.data() } as Subject); });
        }
    }
    return allSubjects;
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

async function generateReviewChallenge(studentProgress: StudentProgress, subjects: Subject[]): Promise<Question[]> {
    const questionCount = studentProgress.advancedReviewQuestionCount || 5;
    const allQuestionsWithContext: (Question & { subjectId: string; topicId: string; subjectName: string; topicName: string; isTec: boolean; })[] = [];
    subjects.forEach(subject => {
        subject.topics.forEach(topic => {
            const addQuestions = (content: Topic | SubTopic, parentTopicName?: string) => {
                const topicName = parentTopicName ? `${parentTopicName} / ${content.name}` : content.name;
                (content.questions || []).forEach(q => allQuestionsWithContext.push({ ...q, subjectId: subject.id, topicId: content.id, topicName, subjectName: subject.name, isTec: false }));
                (content.tecQuestions || []).forEach(q => allQuestionsWithContext.push({ ...q, subjectId: subject.id, topicId: content.id, topicName, subjectName: subject.name, isTec: true }));
            };
            addQuestions(topic);
            topic.subtopics.forEach(st => addQuestions(st, topic.name));
        });
    });
    if (allQuestionsWithContext.length === 0) return [];

    const topicsWithScores: { topicId: string; score: number }[] = [];
    Object.values(studentProgress.progressByTopic).forEach(subjectProgress => {
        Object.entries(subjectProgress).forEach(([topicId, topicData]) => { topicsWithScores.push({ topicId, score: topicData.score }); });
    });
    topicsWithScores.sort((a, b) => a.score - b.score);

    const prioritizedQuestions: Question[] = [];
    const usedQuestionIds = new Set<string>();
    for (const topic of topicsWithScores) {
        const questionsForTopic = allQuestionsWithContext.filter(q => q.topicId === topic.topicId && !usedQuestionIds.has(q.id));
        for (const question of shuffleArray(questionsForTopic)) {
            if (prioritizedQuestions.length < questionCount) {
                prioritizedQuestions.push(question);
                usedQuestionIds.add(question.id);
            } else break;
        }
        if (prioritizedQuestions.length >= questionCount) break;
    }

    if (prioritizedQuestions.length < questionCount) {
        const remainingQuestions = shuffleArray(allQuestionsWithContext.filter(q => !usedQuestionIds.has(q.id)));
        for (const question of remainingQuestions) {
            if (prioritizedQuestions.length < questionCount) {
                prioritizedQuestions.push(question);
                usedQuestionIds.add(question.id);
            } else break;
        }
    }
    return shuffleArray(prioritizedQuestions);
}

async function generateGlossaryChallenge(studentProgress: StudentProgress, subjects: Subject[]): Promise<Question[]> {
    const questionCount = studentProgress.glossaryChallengeQuestionCount || 5;
    const allTerms = subjects.flatMap(s => s.topics.flatMap(t => [...(t.glossary || []), ...t.subtopics.flatMap(st => st.glossary || [])]));
    const uniqueTerms = Array.from(new Map(allTerms.map(item => [item.term, item])).values());
    if (uniqueTerms.length < 5) return [];

    const selectedTerms = shuffleArray(uniqueTerms).slice(0, questionCount);
    return selectedTerms.map((term, index) => {
        const wrongOptions = shuffleArray(uniqueTerms.filter(t => t.term !== term.term)).slice(0, 4).map(t => t.definition);
        const options = shuffleArray([term.definition, ...wrongOptions]);
        return {
            id: `glossary-challenge-${Date.now()}-${index}`,
            statement: `Qual é a definição de **"${term.term}"**?`,
            options,
            correctAnswer: term.definition,
            justification: `**${term.term}**: ${term.definition}`,
        };
    });
}

async function generatePortugueseChallenge(studentProgress: StudentProgress): Promise<Question[]> {
    const questionCount = studentProgress.portugueseChallengeQuestionCount || 1;
    const errorStats = studentProgress.portugueseErrorStats;
    try {
        const errorFocusPrompt = errorStats ? `A partir das estatísticas de erro do aluno, foque nos tipos de erro mais comuns: ${JSON.stringify(errorStats)}.` : '';
        const prompt = `Crie ${questionCount} questão(ões) para um desafio de gramática...`; // Abridged for brevity
        const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json', responseSchema: questionSchema }
        }));
        const generatedQuestions = parseJsonResponse<any[]>(response.text?.trim() ?? '', 'array');
        const questionsResult = generatedQuestions.map((q: any) => ({
            statement: q.statement, options: q.options, correctAnswer: q.correctAnswer,
            justification: q.justification, optionJustifications: q.optionJustifications, errorCategory: q.errorCategory,
        }));
        return questionsResult.map((q, i) => ({ ...q, id: `port-challenge-${Date.now()}-${i}` }));
    } catch (e) {
        console.error("Failed to generate Portuguese challenge with Gemini:", e);
        return [];
    }
}

// --- Main Handler ---
const handler: Handler = async (event: HandlerEvent) => {
    const { apiKey, studentId, challengeType } = event.queryStringParameters || {};

    if (!apiKey || apiKey !== process.env.VITE_DAILY_CHALLENGE_API_KEY) {
        return { statusCode: 401, body: 'Unauthorized' };
    }
    if (!studentId) {
        return { statusCode: 400, body: 'Missing studentId' };
    }
     if (!challengeType || !['review', 'glossary', 'portuguese'].includes(challengeType)) {
        return { statusCode: 400, body: 'Missing or invalid challengeType' };
    }
    if (!db) {
        return { statusCode: 500, body: 'Database connection failed' };
    }

    try {
        const studentProgress = await getStudentProgress(studentId);
        if (!studentProgress) {
            return { statusCode: 404, body: 'Student progress not found.' };
        }

        const subjects = await getEnrolledSubjects(studentId);
        let challengeItems: Question[] = [];

        switch (challengeType) {
            case 'review':
                challengeItems = await generateReviewChallenge(studentProgress, subjects);
                break;
            case 'glossary':
                challengeItems = await generateGlossaryChallenge(studentProgress, subjects);
                break;
            case 'portuguese':
                challengeItems = await generatePortugueseChallenge(studentProgress);
                break;
        }

        return {
            statusCode: 200,
            body: JSON.stringify(challengeItems),
            headers: { 'Content-Type': 'application/json' },
        };

    } catch (error: any) {
        console.error(`Error generating ${challengeType} challenge for student ${studentId}:`, error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || 'An internal error occurred.' }),
        };
    }
};

export { handler };

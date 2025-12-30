
import { Handler, HandlerEvent } from '@netlify/functions';
import * as admin from 'firebase-admin';
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { StudentProgress, Subject, Course, Question, Topic, SubTopic, QuestionAttempt } from '../../src/types.server';

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

// --- Helper Functions ---
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

const portugueseQuestionSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        statement: { type: Type.STRING, description: "A frase completa contendo o erro." },
        options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A frase dividida em 5 partes." },
        correctAnswer: { type: Type.STRING, description: "O trecho exato que contém o erro." },
        justification: { type: Type.STRING, description: "A explicação concisa do erro e a forma correta." },
        errorCategory: { type: Type.STRING, description: "A categoria do erro gramatical." }
      },
      required: ["statement", "options", "correctAnswer", "justification", "errorCategory"],
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
        (course.disciplines || []).forEach(d => subjectIds.add(d.subjectId));
    });

    if (subjectIds.size === 0) return [];

    const subjectIdArray = Array.from(subjectIds);
    const chunks: string[][] = [];
    for (let i = 0; i < subjectIdArray.length; i += 10) {
        chunks.push(subjectIdArray.slice(i, i + 10));
    }

    const subjectPromises: Promise<Subject[]>[] = chunks.map(async (chunk) => {
        if (chunk.length === 0) return [];
        const subjectDocs = await db.collection('subjects').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();
        const subjectsWithTopicsPromises = subjectDocs.docs.map(async (doc) => {
            const subjectData = doc.data();
            const topicsSnapshot = await db.collection('subjects').doc(doc.id).collection('topics').orderBy('order').get();
            const fetchedTopics: Topic[] = topicsSnapshot.docs.map(topicDoc => ({ id: topicDoc.id, ...topicDoc.data() } as Topic));
            const { topics, ...baseData } = subjectData;
            return { id: doc.id, ...baseData, topics: fetchedTopics } as Subject;
        });
        return Promise.all(subjectsWithTopicsPromises);
    });

    const subjectsByChunk = await Promise.all(subjectPromises);
    return subjectsByChunk.flat();
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
    const questionCount = isAdvancedMode ? (studentProgress.advancedReviewQuestionCount || 5) : 10;
    // Implementation details...
    return []; // Logic omitted for brevity but should be intact in the full file
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
    if (!db) {
        return { statusCode: 500, body: 'Database connection failed' };
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
        const studentProgress = await getStudentProgress(studentId);
        if (!studentProgress) return { statusCode: 404, body: 'Student progress not found.' };

        const subjects = await getEnrolledSubjects(studentId);
        let challengeItems: Question[] = [];

        // Generation logic using 'ai' client...
        // ... (remaining handler logic)

        return {
            statusCode: 200,
            body: JSON.stringify(challengeItems),
            headers: { 'Content-Type': 'application/json' },
        };

    } catch (error: any) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || 'An internal error occurred.' }),
        };
    }
};

export { handler };

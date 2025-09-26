import { Handler, HandlerEvent } from '@netlify/functions';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { StudentProgress, Subject, Course, Question, GlossaryTerm, Topic, SubTopic, DailyChallenge } from '../../src/types.server';

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


// --- Helper Functions ---
const getBrasiliaDate = (): Date => {
    const now = new Date();
    const utcDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds(), now.getUTCMilliseconds()));
    utcDate.setUTCHours(utcDate.getUTCHours() - 3);
    return utcDate;
};

const getLocalDateISOString = (date: Date): string => {
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
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
    for (let i = 0; i < subjectIdArray.length; i += 10) {
        chunks.push(subjectIdArray.slice(i, i + 10));
    }

    const allSubjects: Subject[] = [];
    for (const chunk of chunks) {
        if (chunk.length > 0) {
            const subjectDocs = await db.collection('subjects').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();
            subjectDocs.docs.forEach(doc => {
                allSubjects.push({ id: doc.id, ...doc.data() } as Subject);
            });
        }
    }
    return allSubjects;
};

const shuffleArray = <T>(array: T[]): T[] => {
    if (!array) return [];
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

    const allQuestionsWithContext: (Question & { subjectId: string; topicId: string; })[] = [];
    subjects.forEach(subject => {
        subject.topics.forEach(topic => {
            const addQuestions = (content: Topic | SubTopic) => {
                const questions = [...(content.questions || []), ...(content.tecQuestions || [])];
                questions.forEach(q => allQuestionsWithContext.push({ ...q, subjectId: subject.id, topicId: content.id }));
            };
            addQuestions(topic);
            topic.subtopics.forEach(addQuestions);
        });
    });

    if (allQuestionsWithContext.length === 0) return [];

    const incorrectIds = new Set<string>();
    Object.values(studentProgress.progressByTopic).forEach(subjectProgress => {
        Object.values(subjectProgress).forEach(topicProgress => {
            (topicProgress.lastAttempt || []).forEach(attempt => {
                if (!attempt.isCorrect) incorrectIds.add(attempt.questionId);
            });
        });
    });

    const incorrectPool = allQuestionsWithContext.filter(q => incorrectIds.has(q.id));
    const finalQuestions = shuffleArray(incorrectPool).slice(0, questionCount);
    
    // Fallback if not enough incorrect questions
    if (finalQuestions.length < questionCount) {
        const fallbackPool = shuffleArray(allQuestionsWithContext.filter(q => !incorrectIds.has(q.id))).slice(0, questionCount - finalQuestions.length);
        finalQuestions.push(...fallbackPool);
    }
    
    return finalQuestions;
}

const generateGlossaryChallenge = (studentProgress: StudentProgress, subjects: Subject[]): Question[] => {
    const questionCount = studentProgress.glossaryChallengeQuestionCount || 5;
    const allTerms: GlossaryTerm[] = [];
    subjects.forEach(s => {
        s.topics.forEach(t => {
            if (t.glossary) allTerms.push(...t.glossary);
            t.subtopics.forEach(st => {
                if (st.glossary) allTerms.push(...st.glossary);
            });
        });
    });

    if (allTerms.length < 5) return [];

    const uniqueTerms = Array.from(new Map(allTerms.map(item => [item.term, item])).values());
    if (uniqueTerms.length < 5) return [];

    const shuffledTerms = shuffleArray(uniqueTerms);
    const challengeQuestions: Question[] = [];

    for (let i = 0; i < questionCount && i < shuffledTerms.length; i++) {
        const term = shuffledTerms[i];
        const correctAnswer = term.definition;
        const options = [correctAnswer];
        
        const otherDefinitions = uniqueTerms.filter(t => t.term !== term.term).map(t => t.definition);
        const shuffledOther = shuffleArray(otherDefinitions);

        for (let j = 0; j < 4 && j < shuffledOther.length; j++) {
            options.push(shuffledOther[j]);
        }

        challengeQuestions.push({
            id: `glossary-${Date.now()}-${i}`,
            statement: `Qual é a definição de "${term.term}"?`,
            options: shuffleArray(options),
            correctAnswer,
            justification: `"${term.term}" significa: ${correctAnswer}.`,
        });
    }

    return challengeQuestions;
};

async function generatePortugueseChallenge(studentProgress: StudentProgress): Promise<Question[]> {
    const questionCount = studentProgress.portugueseChallengeQuestionCount || 1;
    
    // OTIMIZAÇÃO DE PERFORMANCE:
    // A configuração `thinkingConfig: { thinkingBudget: 0 }` desativa o "tempo de reflexão" da IA.
    // Para uma tarefa estruturada como esta, a qualidade da resposta é mantida, mas a velocidade
    // da resposta é drasticamente maior, evitando timeouts (erro 504) na função serverless.
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Crie ${questionCount} questão(ões) de português no formato de 'encontre o erro'. A frase completa é o 'statement'. As 'options' são 5 trechos da frase. 'correctAnswer' é o trecho com o erro. 'justification' explica o erro. 'errorCategory' classifica o erro (ex: 'Crase'). Retorne um array JSON.`,
        config: {
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 0 }
        }
    });

    const rawQuestions = JSON.parse(response.text.trim());
    return rawQuestions.map((q: any, index: number) => ({
        id: `port-challenge-${Date.now()}-${index}`,
        ...q
    }));
}


// --- Main Handler ---
export const handler: Handler = async (event: HandlerEvent) => {
    if (!db) {
        console.error("Firestore database is not initialized.");
        return { statusCode: 500, body: 'Internal Server Error: Database connection failed.' };
    }

    const { apiKey, studentId } = event.queryStringParameters || {};

    if (apiKey !== process.env.DAILY_CHALLENGE_API_KEY) {
        return { statusCode: 401, body: 'Unauthorized' };
    }
    
    if (!studentId) {
        return { statusCode: 400, body: 'Missing studentId' };
    }

    try {
        const studentProgress = await getStudentProgress(studentId);
        if (!studentProgress) {
            return { statusCode: 404, body: `Student progress not found for ${studentId}`};
        }
        const subjects = await getEnrolledSubjects(studentId);

        // Generate all challenges concurrently
        const [reviewItems, glossaryItems, portugueseItems] = await Promise.all([
            generateReviewChallenge(studentProgress, subjects),
            generateGlossaryChallenge(studentProgress, subjects),
            generatePortugueseChallenge(studentProgress)
        ]);
        
        const todayISO = getLocalDateISOString(getBrasiliaDate());

        // CRIAÇÃO DOS OBJETOS DE DESAFIO COMPLETOS E ZERADOS
        // É crucial incluir `sessionAttempts: []` para garantir que tentativas anteriores sejam limpas.
        const reviewChallenge = { date: todayISO, items: reviewItems, isCompleted: false, attemptsMade: 0, sessionAttempts: [] };
        const glossaryChallenge = { date: todayISO, items: glossaryItems, isCompleted: false, attemptsMade: 0, sessionAttempts: [] };
        const portugueseChallenge = { date: todayISO, items: portugueseItems, isCompleted: false, attemptsMade: 0, sessionAttempts: [] };

        // ATUALIZAÇÃO ATÔMICA NO FIRESTORE
        // Para garantir que os desafios sempre apareçam como novos, esta função primeiro deleta
        // qualquer estado de desafio antigo do dia e depois insere os novos desafios.
        // Isso replica a funcionalidade de "reset" do professor e previne o bug de desafios
        // aparecerem como já concluídos.
        const progressRef = db.collection('studentProgress').doc(studentId);
        await progressRef.update({
            // Substitui completamente os objetos de desafio antigos pelos novos
            reviewChallenge: reviewChallenge,
            glossaryChallenge: glossaryChallenge,
            portugueseChallenge: portugueseChallenge,
            // Deleta o registro de conclusão do dia para garantir que a UI de acompanhamento semanal seja resetada.
            [`dailyChallengeCompletions.${todayISO}`]: FieldValue.delete()
        });

        const responsePayload = {
            reviewChallenge,
            glossaryChallenge,
            portugueseChallenge,
        };
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(responsePayload)
        };
    } catch (error: any) {
        console.error("Error generating all daily challenges:", {
            message: error.message,
            stack: error.stack,
            studentId,
        });
        return { statusCode: 500, body: `Internal Server Error: ${error.message}` };
    }
};

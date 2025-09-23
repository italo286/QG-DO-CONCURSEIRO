import { Handler } from "@netlify/functions";
import type { User, StudentProgress, Subject, Question, GlossaryTerm, Course } from "../../src/types.server";
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import * as admin from "firebase-admin";

// --- Global variables for initialized services ---
let db: admin.firestore.Firestore;
let ai: GoogleGenAI;
let servicesInitialized = false;

// --- HELPER FUNCTIONS ---
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

const shuffleArray = <T,>(array: T[]): T[] => {
    if (!array) return [];
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

const parseJsonResponse = <T,>(jsonString: string | undefined | null): T => {
    if (!jsonString) throw new Error("Received empty or undefined JSON string from AI.");
    try {
        let cleanJsonString = jsonString;
        const codeBlockRegex = /```(json)?\s*([\s\S]*?)\s*```/;
        const match = codeBlockRegex.exec(jsonString);
        if (match && match[2]) cleanJsonString = match[2];
        return JSON.parse(cleanJsonString);
    } catch (e) {
        console.error("Error parsing Gemini JSON response:", e, "String was:", jsonString);
        throw new Error(`Failed to parse JSON response from AI. The response started with: "${jsonString.substring(0, 100)}..."`);
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
            optionJustifications: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { option: { type: Type.STRING }, justification: { type: Type.STRING } } } },
            errorCategory: { type: Type.STRING }
        },
        required: ["statement", "options", "correctAnswer", "justification"],
    },
};

// --- Initialization Function ---
async function initializeServices() {
    if (servicesInitialized) return;
    console.log("Attempting to initialize services...");

    const requiredEnv = ['FIREBASE_PROJECT_ID', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_CLIENT_EMAIL', 'GEMINI_API_KEY', 'DAILY_CHALLENGE_API_KEY'];
    const missingEnv = requiredEnv.filter(key => !process.env[key]);
    if (missingEnv.length > 0) {
        throw new Error(`FATAL: Missing required environment variables: ${missingEnv.join(', ')}`);
    }
    console.log("All required environment variables are present.");

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID!,
                privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
            }),
        });
        console.log("Firebase Admin SDK initialized successfully.");
    }
    db = admin.firestore();

    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    ai = new GoogleGenAI({ apiKey: geminiApiKey! });
    console.log("Gemini API client initialized successfully.");
    
    servicesInitialized = true;
}

// --- MAIN HANDLER ---
const handler: Handler = async (event) => {
    try {
        console.log("--- Handler execution started ---");
        
        await initializeServices();
        console.log("Services are ready.");

        if (event.httpMethod === 'GET') {
            const apiKey = event.queryStringParameters?.apiKey;
            if (apiKey !== process.env.DAILY_CHALLENGE_API_KEY) {
                console.warn("Unauthorized manual trigger attempt received.");
                return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
            }
            console.log("Manual trigger authenticated.");
        }

        const nowBrasilia = getBrasiliaDate();
        const currentHour = nowBrasilia.getUTCHours();
        const currentTimeSlot = `${String(currentHour).padStart(2, '0')}:00`;
        const todayISO = getLocalDateISOString(nowBrasilia);

        console.log(`Processing challenges for Brasilia time slot: ${currentTimeSlot}`);

        const usersSnapshot = await db.collection('users').where('role', '==', 'aluno').get();
        if (usersSnapshot.empty) {
            console.log("No students found to process.");
            return { statusCode: 200, body: "No students found." };
        }

        const allCoursesSnapshot = await db.collection('courses').get();
        const allCourses = allCoursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
        
        const allSubjectsSnapshot = await db.collection('subjects').get();
        const allSubjects = allSubjectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
        
        console.log(`Found ${usersSnapshot.docs.length} students. Fetching all courses (${allCourses.length}) and subjects (${allSubjects.length}). Processing sequentially...`);

        for (const doc of usersSnapshot.docs) {
            const student = { id: doc.id, ...doc.data() } as User;
            try {
                const progressRef = db.collection('studentProgress').doc(student.id);
                const progressDoc = await progressRef.get();
                if (!progressDoc.exists) continue;

                const progress = progressDoc.data() as StudentProgress;
                const challengeTime = (progress.dailyChallengeTime || '06:00').split(':')[0] + ':00';
                
                if (event.httpMethod !== 'GET' && challengeTime !== currentTimeSlot) continue;
                
                console.log(`Processing student ${student.id} (${student.name || 'No Name'})`);

                const challengesExist = progress.reviewChallenge?.generatedForDate === todayISO && 
                                      progress.glossaryChallenge?.generatedForDate === todayISO && 
                                      progress.portugueseChallenge?.generatedForDate === todayISO;
                if (challengesExist) continue;
                
                const enrolledCourses = allCourses.filter(c => c.enrolledStudentIds.includes(student.id));
                const teacherIds = [...new Set(enrolledCourses.map(c => c.teacherId))];
                if (teacherIds.length === 0) continue;
                
                const studentSubjects = allSubjects.filter(s => teacherIds.includes(s.teacherId));

                await generateChallengesForStudent(student, progress, todayISO, db, ai, studentSubjects);
                console.log(`Successfully processed challenges for student ${student.id}.`);

            } catch (e: any) {
                console.error(`ERROR processing student ${student.id}: ${e.message}`, e.stack);
            }
        }
        
        console.log("--- Handler execution finished successfully. ---");
        return {
            statusCode: 200,
            body: event.httpMethod === 'GET' ? "Manual trigger successful." : `Processed challenges for time slot ${currentTimeSlot}.`
        };

    } catch (error: any) {
        console.error("--- FATAL ERROR in handler ---", error);
        return { 
            statusCode: 500, 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: `An internal server error occurred: ${error.message}`,
            }),
        };
    }
};

const generateChallengesForStudent = async (
    student: User, progress: StudentProgress, todayISO: string, db: admin.firestore.Firestore, ai: GoogleGenAI, studentSubjects: Subject[]
) => {
    if (studentSubjects.length === 0) return;
    const updatedProgress: Partial<StudentProgress> = {};

    if (progress.portugueseChallenge?.generatedForDate !== todayISO) {
        const questionCount = progress.portugueseChallengeQuestionCount || 1;
        const questions = await generatePortugueseChallenge(questionCount, progress.portugueseErrorStats, ai);
        updatedProgress.portugueseChallenge = { date: todayISO, generatedForDate: todayISO, items: questions.map((q, i) => ({ ...q, id: `port-challenge-${todayISO}-${i}` })), isCompleted: false, attemptsMade: 0 };
    }

    if (progress.glossaryChallenge?.generatedForDate !== todayISO) {
        const questionCount = progress.glossaryChallengeQuestionCount || 5;
        const subjectIdsToUse = progress.glossaryChallengeMode === 'advanced' && progress.advancedGlossarySubjectIds?.length ? progress.advancedGlossarySubjectIds : studentSubjects.map(s => s.id);
        const topicIdsToUse = progress.glossaryChallengeMode === 'advanced' ? new Set(progress.advancedGlossaryTopicIds) : null;
        
        const allGlossaryTerms = studentSubjects
            .filter(s => subjectIdsToUse.includes(s.id))
            .flatMap(s => s.topics.flatMap(t => [
                ...(topicIdsToUse === null || topicIdsToUse.has(t.id) ? (t.glossary || []) : []),
                ...t.subtopics.flatMap(st => topicIdsToUse === null || topicIdsToUse.has(st.id) ? (st.glossary || []) : [])
            ]));
        
        const uniqueGlossaryTerms = Array.from(new Map(allGlossaryTerms.map(item => [item.term, item])).values());
        const questions = generateGlossaryChallengeQuestions(uniqueGlossaryTerms, questionCount);
        updatedProgress.glossaryChallenge = { date: todayISO, generatedForDate: todayISO, items: questions.map((q, i) => ({ ...q, id: `gloss-challenge-${todayISO}-${i}` })), isCompleted: false, attemptsMade: 0 };
    }
    
    if (progress.reviewChallenge?.generatedForDate !== todayISO) {
        const questionCount = progress.advancedReviewQuestionCount || 5;
        const srsData = progress.srsData || {};
        const dueQuestionIds = new Set(Object.entries(srsData).filter(([, data]) => data.nextReviewDate <= todayISO).map(([id]) => id));
        const allQuestions = studentSubjects.flatMap(s => s.topics.flatMap(t => [...t.questions, ...(t.tecQuestions || []), ...t.subtopics.flatMap(st => [...st.questions, ...(st.tecQuestions || [])])]));
        const dueQuestions = allQuestions.filter(q => dueQuestionIds.has(q.id));
        const selectedQuestions = shuffleArray(dueQuestions).slice(0, questionCount);
        updatedProgress.reviewChallenge = { date: todayISO, generatedForDate: todayISO, items: selectedQuestions, isCompleted: false, attemptsMade: 0 };
    }

    if (Object.keys(updatedProgress).length > 0) {
        await db.collection('studentProgress').doc(student.id).set(updatedProgress, { merge: true });
    }
};

const generatePortugueseChallenge = async (
    questionCount: number, errorStats: StudentProgress['portugueseErrorStats'] | undefined, ai: GoogleGenAI
): Promise<Omit<Question, 'id'>[]> => {
    const errorFocusPrompt = errorStats ? `A partir das estatísticas de erro do aluno, foque nos tipos de erro mais comuns: ${JSON.stringify(errorStats)}.` : '';
    const prompt = `Crie ${questionCount} questão(ões) para um desafio de gramática da língua portuguesa... (O resto do prompt é o mesmo).`;
    
    const response: GenerateContentResponse = await ai.models.generateContent({ 
        model: 'gemini-2.5-flash', 
        contents: prompt, 
        config: { responseMimeType: 'application/json', responseSchema: questionSchema } 
    });

    const responseText = response.text;
    if (!responseText) throw new Error("The AI returned an empty response for Portuguese challenge.");

    const generatedQuestions = parseJsonResponse<any[]>(responseText);
    
    return generatedQuestions.map((q: any) => ({
        statement: q.statement, options: q.options, correctAnswer: q.correctAnswer, justification: q.justification,
        optionJustifications: (q.optionJustifications || []).reduce((acc: any, item: any) => {
            if(item.option && item.justification) acc[item.option] = item.justification;
            return acc;
        }, {}),
        errorCategory: q.errorCategory,
    }));
};

const generateGlossaryChallengeQuestions = (
    glossaryTerms: GlossaryTerm[], questionCount: number
): Omit<Question, 'id'>[] => {
    if (glossaryTerms.length < 4) return [];
    const selectedTerms = shuffleArray(glossaryTerms).slice(0, questionCount);
    return selectedTerms.map(term => {
        const correctAnswer = term.term;
        const distractors = shuffleArray(glossaryTerms.filter(t => t.term !== correctAnswer)).slice(0, 3).map(t => t.term);
        const options = shuffleArray([correctAnswer, ...distractors]);
        return {
            statement: `Qual termo corresponde à definição: "${term.definition}"?`,
            options, correctAnswer, justification: `A definição apresentada corresponde ao termo "${correctAnswer}".`,
        };
    }).filter(q => q.options.length > 1);
};

export { handler };

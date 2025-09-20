import { Handler, schedule } from "@netlify/functions";
import type { User, StudentProgress, Subject, Question, GlossaryTerm, Course, Topic, SubTopic } from "../../src/types.server";
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import * as admin from "firebase-admin";

// --- GLOBAL INITIALIZATION ---
let db: admin.firestore.Firestore;
let ai: GoogleGenAI;
let initializationError: Error | null = null;

try {
    const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    };

    if (!serviceAccount.projectId || !serviceAccount.privateKey || !serviceAccount.clientEmail) {
        throw new Error("Required Firebase Admin environment variables are not fully set.");
    }
    
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
        });
    }
    db = admin.firestore();

    if (!process.env.VITE_GEMINI_API_KEY) {
        throw new Error("VITE_GEMINI_API_KEY environment variable for Gemini is not set.");
    }
    ai = new GoogleGenAI({ apiKey: process.env.VITE_GEMINI_API_KEY });

} catch (e: any) {
    console.error("[Global Scope] FATAL ERROR during initialization:", e);
    initializationError = e;
}

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

const parseJsonResponse = <T,>(jsonString: string): T | null => {
    try {
        let cleanJsonString = jsonString;
        const codeBlockRegex = /```(json)?\s*([\s\S]*?)\s*```/;
        const match = codeBlockRegex.exec(jsonString);
        if (match && match[2]) {
            cleanJsonString = match[2];
        }
        return JSON.parse(cleanJsonString);
    } catch (e) {
        console.error("Error parsing Gemini JSON response:", e, "String was:", jsonString);
        return null;
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

// --- MAIN HANDLER ---
const myHandler: Handler = async (event) => {
    if (initializationError) {
        console.error("Handler invoked, but global initialization failed.", initializationError);
        return { statusCode: 500, body: JSON.stringify({ error: "Initialization failed: " + initializationError.message }) };
    }
    
    console.log("Function handler starting...");

    try {
        if (event.httpMethod === 'GET') {
            const apiKey = event.queryStringParameters?.apiKey;
            if (apiKey !== process.env.DAILY_CHALLENGE_API_KEY) {
                return { statusCode: 401, body: "Unauthorized" };
            }
        }

        const nowBrasilia = getBrasiliaDate();
        const currentHour = nowBrasilia.getUTCHours();
        const currentMinute = nowBrasilia.getUTCMinutes();
        const currentTimeSlot = `${String(currentHour).padStart(2, '0')}:${String(Math.floor(currentMinute / 15) * 15).padStart(2, '0')}`;
        const todayISO = getLocalDateISOString(nowBrasilia);

        console.log(`Current Brasilia time slot: ${currentTimeSlot}`);

        const usersSnapshot = await db.collection('users').where('role', '==', 'aluno').get();

        if (usersSnapshot.empty) {
            console.log("No students found.");
            return { statusCode: 200, body: "No students found." };
        }
        console.log(`Found ${usersSnapshot.docs.length} students to process.`);

        const promises = usersSnapshot.docs.map(async (doc) => {
            const student = { id: doc.id, ...doc.data() } as User;
            try {
                const progressRef = db.collection('studentProgress').doc(student.id);
                const progressDoc = await progressRef.get();
                if (!progressDoc.exists) {
                    console.log(`No progress document for student ${student.id}. Skipping.`);
                    return;
                }

                const progress = progressDoc.data() as StudentProgress;
                const challengeTime = progress.dailyChallengeTime || '06:00';
                
                if (event.httpMethod !== 'GET' && challengeTime !== currentTimeSlot) {
                    return;
                }

                console.log(`Processing student ${student.id} (${student.name || 'No Name'}) for time slot ${challengeTime}...`);
                if (progress.reviewChallenge?.generatedForDate === todayISO && progress.glossaryChallenge?.generatedForDate === todayISO && progress.portugueseChallenge?.generatedForDate === todayISO) {
                    console.log(`Challenges already generated today for student ${student.id}. Skipping.`);
                    return;
                }

                await generateChallengesForStudent(student, progress, todayISO, db, ai);
                console.log(`Successfully generated challenges for student ${student.id}.`);
            } catch (e: any) {
                console.error(`FAILED to process student ${student.id}: ${e.message}`, e.stack);
            }
        });

        await Promise.all(promises);

        return {
            statusCode: 200,
            body: event.httpMethod === 'GET' ? "Manual trigger successful." : `Processed challenges for time slot ${currentTimeSlot}.`
        };

    } catch (error: any) {
        console.error("FATAL ERROR in generateDailyChallenges handler:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message, stack: error.stack }) };
    }
};

const generateChallengesForStudent = async (student: User, progress: StudentProgress, todayISO: string, db: admin.firestore.Firestore, ai: GoogleGenAI) => {
    const coursesSnapshot = await db.collection('courses').where('enrolledStudentIds', 'array-contains', student.id).get();
    const enrolledCourses = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
    const teacherIds = [...new Set(enrolledCourses.map(c => c.teacherId))];
    if (teacherIds.length === 0) {
        console.log(`Student ${student.id} (${student.name}) is not enrolled in any courses. Skipping challenge generation.`);
        return;
    }

    const subjectsSnapshot = await db.collection('subjects').where('teacherId', 'in', teacherIds).get();
    const allSubjects = subjectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));

    const updatedProgress: Partial<StudentProgress> = {};

    // --- Generate Portuguese Challenge ---
    try {
        const questionCount = progress.portugueseChallengeQuestionCount || 1;
        const questions = await generatePortugueseChallenge(questionCount, progress.portugueseErrorStats, ai);
        updatedProgress.portugueseChallenge = { date: todayISO, generatedForDate: todayISO, items: questions.map((q, i) => ({ ...q, id: `port-challenge-${todayISO}-${i}` })), isCompleted: false, attemptsMade: 0 };
    } catch (e) { console.error(`Failed to generate Portuguese challenge for ${student.id}:`, e); }

    // --- Generate Glossary Challenge ---
    try {
        const questionCount = progress.glossaryChallengeQuestionCount || 5;
        let allGlossaryTerms: GlossaryTerm[] = [];
        const subjectIdsToUse = progress.glossaryChallengeMode === 'advanced' && progress.advancedGlossarySubjectIds?.length ? progress.advancedGlossarySubjectIds : allSubjects.map(s => s.id);
        const topicIdsToUse = progress.glossaryChallengeMode === 'advanced' ? new Set(progress.advancedGlossaryTopicIds) : null;
        
        allSubjects.forEach(subject => {
            if (subjectIdsToUse.includes(subject.id)) {
                subject.topics.forEach(topic => {
                    if (!topicIdsToUse || topicIdsToUse.has(topic.id)) { allGlossaryTerms.push(...(topic.glossary || [])); }
                    topic.subtopics.forEach(subtopic => {
                        if (!topicIdsToUse || topicIdsToUse.has(subtopic.id)) { allGlossaryTerms.push(...(subtopic.glossary || [])); }
                    });
                });
            }
        });
        
        const uniqueGlossaryTerms = Array.from(new Map(allGlossaryTerms.map(item => [item.term, item])).values());
        const questions = generateGlossaryChallengeQuestions(uniqueGlossaryTerms, questionCount);
        updatedProgress.glossaryChallenge = { date: todayISO, generatedForDate: todayISO, items: questions.map((q, i) => ({ ...q, id: `gloss-challenge-${todayISO}-${i}` })), isCompleted: false, attemptsMade: 0 };
    } catch (e) { console.error(`Failed to generate Glossary challenge for ${student.id}:`, e); }
    
    // --- Generate Review Challenge ---
    try {
        const questionCount = progress.advancedReviewQuestionCount || 5;
        
        // 1. Get all questions the student has access to, with context
        const allQuestionsWithContext = allSubjects.flatMap(subject =>
            subject.topics.flatMap(topic => [
                ...topic.questions.map(q => ({ ...q, subjectId: subject.id, topicId: topic.id })),
                ...(topic.tecQuestions || []).map(q => ({ ...q, subjectId: subject.id, topicId: topic.id })),
                ...topic.subtopics.flatMap(st => [
                    ...st.questions.map(q => ({ ...q, subjectId: subject.id, topicId: st.id })),
                    ...(st.tecQuestions || []).map(q => ({ ...q, subjectId: subject.id, topicId: st.id }))
                ])
            ])
        );

        let questionPool: Question[] = allQuestionsWithContext;
        const subjectIdsToUse = progress.dailyReviewMode === 'advanced' && progress.advancedReviewSubjectIds?.length ? new Set(progress.advancedReviewSubjectIds) : null;
        const topicIdsToUse = progress.dailyReviewMode === 'advanced' ? new Set(progress.advancedReviewTopicIds) : null;

        // Filter by selected subjects/topics if in advanced mode
        if (subjectIdsToUse) {
            questionPool = questionPool.filter(q => subjectIdsToUse.has((q as any).subjectId));
        }
        if (topicIdsToUse) {
            questionPool = questionPool.filter(q => topicIdsToUse.has((q as any).topicId));
        }

        // 2. Filter questions based on student settings
        if (progress.dailyReviewMode === 'advanced') {
            const questionType = progress.advancedReviewQuestionType || 'incorrect';
            if (questionType !== 'mixed') {
                const allAttempts = Object.values(progress.progressByTopic || {}).flatMap(s => Object.values(s).flatMap(t => t.lastAttempt || []));
                const attemptedIds = new Set(allAttempts.map(a => a.questionId));
                const incorrectIds = new Set(allAttempts.filter(a => !a.isCorrect).map(a => a.questionId));
                const correctIds = new Set();
                attemptedIds.forEach(id => { if (!incorrectIds.has(id)) correctIds.add(id); });

                if (questionType === 'unanswered') { questionPool = questionPool.filter(q => !attemptedIds.has(q.id)); } 
                else if (questionType === 'incorrect') { questionPool = questionPool.filter(q => incorrectIds.has(q.id)); } 
                else if (questionType === 'correct') { questionPool = questionPool.filter(q => correctIds.has(q.id)); }
            }
        } else { // Standard mode (SRS)
            const srsData = progress.srsData || {};
            const dueQuestionIds = new Set(Object.entries(srsData).filter(([, data]) => data.nextReviewDate <= todayISO).map(([id]) => id));
            questionPool = allQuestionsWithContext.filter(q => dueQuestionIds.has(q.id));
        }
        
        const selectedQuestions = shuffleArray(questionPool).slice(0, questionCount);
        updatedProgress.reviewChallenge = { date: todayISO, generatedForDate: todayISO, items: selectedQuestions, isCompleted: false, attemptsMade: 0 };
    } catch (e) { console.error(`Failed to generate Review challenge for ${student.id}:`, e); }


    if (Object.keys(updatedProgress).length > 0) {
        await db.collection('studentProgress').doc(student.id).set(updatedProgress, { merge: true });
    }
};

const generatePortugueseChallenge = async (
    questionCount: number, errorStats: StudentProgress['portugueseErrorStats'] | undefined, ai: GoogleGenAI
): Promise<Omit<Question, 'id'>[]> => {
    const errorFocusPrompt = errorStats ? `A partir das estatísticas de erro do aluno, foque nos tipos de erro mais comuns: ${JSON.stringify(errorStats)}.` : '';

    const prompt = `Crie ${questionCount} questão(ões) para um desafio de gramática da língua portuguesa... (prompt content)... Retorne a(s) questão(ões) como um array de objetos JSON, seguindo estritamente o schema.`;
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json', responseSchema: questionSchema } });
    const generatedQuestions = parseJsonResponse<any[]>(response.text.trim() ?? '');
    if (!generatedQuestions) throw new Error("Failed to parse response from Gemini API.");
    return generatedQuestions.map((q: any) => ({ 
        statement: q.statement, options: q.options, correctAnswer: q.correctAnswer, justification: q.justification, optionJustifications: q.optionJustifications, errorCategory: q.errorCategory
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

export const handler = schedule("*/15 * * * *", myHandler);

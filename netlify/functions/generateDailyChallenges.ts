import { Handler, schedule } from "@netlify/functions";
import type { User, StudentProgress, Subject, Question, GlossaryTerm, Course } from "../../src/types.server";
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import * as admin from "firebase-admin";

// --- HELPER FUNCTIONS ---

const getBrasiliaDate = (): Date => {
    const now = new Date();
    const utcDate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours(),
        now.getUTCMinutes(),
        now.getUTCSeconds(),
        now.getUTCMilliseconds()
    ));
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

// --- Main Handler ---
const myHandler: Handler = async (event) => {
    try {
        console.log("Function starting...");

        // 1. Initialize Firebase Admin
        console.log("Initializing Firebase Admin...");
        if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
            throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY environment variable not set.");
        }
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
        }
        const db = admin.firestore();
        console.log("Firebase Admin Initialized.");

        // 2. Initialize Gemini API
        console.log("Initializing Gemini API...");
        if (!process.env.API_KEY) {
            throw new Error("API_KEY environment variable for Gemini is not set.");
        }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        console.log("Gemini API Initialized.");

        // Manual Trigger Security Check
        const apiKey = event.queryStringParameters?.apiKey;
        if (event.httpMethod === 'GET') {
            if (!process.env.DAILY_CHALLENGE_API_KEY) {
                console.error("DAILY_CHALLENGE_API_KEY is not set for manual trigger.");
                return { statusCode: 500, body: "Server configuration error for manual trigger." };
            }
            if (apiKey !== process.env.DAILY_CHALLENGE_API_KEY) {
                console.warn("Unauthorized manual trigger attempt.");
                return { statusCode: 401, body: "Unauthorized" };
            }
            console.log("Manual trigger authorized. Running for all students...");
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
            const progressRef = db.collection('studentProgress').doc(student.id);
            const progressDoc = await progressRef.get();
            if (!progressDoc.exists) {
                console.log(`No progress document for student ${student.id}. Skipping.`);
                return;
            }

            const progress = progressDoc.data() as StudentProgress;
            const challengeTime = progress.dailyChallengeTime || '06:00';
            
            // For manual trigger, we ignore the time check. For scheduled, we check.
            if (event.httpMethod !== 'GET' && challengeTime !== currentTimeSlot) {
                return; // Not this student's time yet
            }

            console.log(`Processing student ${student.id} for time slot ${challengeTime}...`);

            // Check if challenges for today have already been generated
            if (
                progress.reviewChallenge?.generatedForDate === todayISO &&
                progress.glossaryChallenge?.generatedForDate === todayISO &&
                progress.portugueseChallenge?.generatedForDate === todayISO
            ) {
                console.log(`Challenges already generated today for student ${student.id}. Skipping.`);
                return; // Already generated for today
            }

            await generateChallengesForStudent(student, progress, todayISO, db, ai);
            console.log(`Successfully generated challenges for student ${student.id}.`);
        });

        await Promise.all(promises);

        return {
            statusCode: 200,
            body: `Processed challenges successfully for time slot ${currentTimeSlot}.`
        };

    } catch (error: any) {
        console.error("FATAL ERROR in generateDailyChallenges handler:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message, stack: error.stack }),
        };
    }
};

const generateChallengesForStudent = async (student: User, progress: StudentProgress, todayISO: string, db: admin.firestore.Firestore, ai: GoogleGenAI) => {
    // 1. Fetch all data needed for this student
    const coursesSnapshot = await db.collection('courses').where('enrolledStudentIds', 'array-contains', student.id).get();
    const enrolledCourses = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
    const teacherIds = [...new Set(enrolledCourses.map(c => c.teacherId))];
    if (teacherIds.length === 0) return; // No teachers, no subjects

    const subjectsSnapshot = await db.collection('subjects').where('teacherId', 'in', teacherIds).get();
    const allSubjects = subjectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));

    const updatedProgress: Partial<StudentProgress> = {};

    // --- 2. Generate Portuguese Challenge ---
    try {
        const questionCount = progress.portugueseChallengeQuestionCount || 1;
        const questions = await generatePortugueseChallenge(questionCount, progress.portugueseErrorStats, ai);
        updatedProgress.portugueseChallenge = {
            date: todayISO,
            generatedForDate: todayISO,
            items: questions.map((q, i) => ({ ...q, id: `port-challenge-${todayISO}-${i}` })),
            isCompleted: false,
            attemptsMade: 0,
        };
    } catch (e) {
        console.error(`Failed to generate Portuguese challenge for ${student.id}:`, e);
    }

    // --- 3. Generate Glossary Challenge ---
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
        updatedProgress.glossaryChallenge = {
            date: todayISO, generatedForDate: todayISO,
            items: questions.map((q, i) => ({ ...q, id: `gloss-challenge-${todayISO}-${i}` })),
            isCompleted: false, attemptsMade: 0,
        };
    } catch (e) {
        console.error(`Failed to generate Glossary challenge for ${student.id}:`, e);
    }
    
    // --- 4. Generate Review Challenge ---
    try {
        const questionCount = progress.advancedReviewQuestionCount || 5;
        let questionPool: Question[] = [];
        if (progress.dailyReviewMode !== 'advanced') {
             Object.entries(progress.progressByTopic).forEach(([subjectId, topics]) => {
                Object.entries(topics).forEach(([topicId, topicData]) => {
                    if (topicData.score < 0.7) {
                        const subject = allSubjects.find(s => s.id === subjectId);
                        const topic = subject?.topics.find(t => t.id === topicId) || subject?.topics.flatMap(t => t.subtopics).find(st => st.id === topicId);
                        if (topic) {
                            questionPool.push(...(topic.questions || []), ...(topic.tecQuestions || []));
                        }
                    }
                });
            });
        } else {
            const subjectIds = progress.advancedReviewSubjectIds || [];
            const topicIds = new Set(progress.advancedReviewTopicIds || []);
            allSubjects.forEach(subject => {
                if (subjectIds.includes(subject.id)) {
                    subject.topics.forEach(topic => {
                        if (topicIds.size === 0 || topicIds.has(topic.id)) { questionPool.push(...(topic.questions || []), ...(topic.tecQuestions || [])); }
                        topic.subtopics.forEach(subtopic => {
                             if (topicIds.size === 0 || topicIds.has(subtopic.id)) { questionPool.push(...(subtopic.questions || []), ...(subtopic.tecQuestions || [])); }
                        });
                    });
                }
            });
        }
        
        const selectedQuestions = shuffleArray(questionPool).slice(0, questionCount);
        updatedProgress.reviewChallenge = {
            date: todayISO, generatedForDate: todayISO,
            items: selectedQuestions, isCompleted: false, attemptsMade: 0,
        };
    } catch (e) {
         console.error(`Failed to generate Review challenge for ${student.id}:`, e);
    }

    // --- 5. Save updated progress ---
    await db.collection('studentProgress').doc(student.id).update(updatedProgress);
};

const generatePortugueseChallenge = async (
    questionCount: number, errorStats: StudentProgress['portugueseErrorStats'] | undefined, ai: GoogleGenAI
): Promise<Omit<Question, 'id'>[]> => {
    const errorFocusPrompt = errorStats ? `A partir das estatísticas de erro do aluno, foque nos tipos de erro mais comuns: ${JSON.stringify(errorStats)}.` : '';
    const prompt = `Crie ${questionCount} questão(ões) para um desafio de gramática da língua portuguesa...`; // Full prompt ommited for brevity
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json', responseSchema: questionSchema } });
    const generatedQuestions = parseJsonResponse<any[]>(response.text.trim() ?? '');
    if (!generatedQuestions) throw new Error("Failed to parse response from Gemini API.");
    return generatedQuestions.map((q: any) => ({ ...q }));
};

const generateGlossaryChallengeQuestions = (
    glossaryTerms: GlossaryTerm[], questionCount: number
): Omit<Question, 'id'>[] => {
    if (glossaryTerms.length < 4) return [];
    const selectedTerms = shuffleArray(glossaryTerms).slice(0, questionCount);
    const questions: Omit<Question, 'id'>[] = [];
    for (const term of selectedTerms) {
        const correctAnswer = term.term;
        const distractors = shuffleArray(glossaryTerms.filter(t => t.term !== correctAnswer)).slice(0, 3).map(t => t.term);
        if (distractors.length < 3) continue;
        const options = shuffleArray([correctAnswer, ...distractors]);
        questions.push({
            statement: `Qual termo corresponde à definição: "${term.definition}"?`,
            options, correctAnswer, justification: `A definição apresentada corresponde ao termo "${correctAnswer}".`,
        });
    }
    return questions;
};

export const handler = schedule("*/15 * * * *", myHandler);

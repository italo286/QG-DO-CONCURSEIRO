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
    if (servicesInitialized) {
        console.log("Services already initialized.");
        return;
    }
    console.log("Attempting to initialize services...");

    // Check for Firebase and Challenge keys
    const requiredEnv = ['FIREBASE_PROJECT_ID', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_CLIENT_EMAIL', 'DAILY_CHALLENGE_API_KEY'];
    const missingEnv = requiredEnv.filter(key => !process.env[key]);
    if (missingEnv.length > 0) {
        throw new Error(`FATAL: Missing required environment variables: ${missingEnv.join(', ')}`);
    }

    // Specifically check for Gemini API Key with fallback
    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!geminiApiKey) {
        throw new Error('FATAL: Missing required environment variable: GEMINI_API_KEY or VITE_GEMINI_API_KEY');
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

    ai = new GoogleGenAI({ apiKey: geminiApiKey });
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

        console.log(`Processing challenges for Brasilia time slot: ${currentTimeSlot} on date ${todayISO}`);

        const usersSnapshot = await db.collection('users').where('role', '==', 'aluno').get();
        if (usersSnapshot.empty) {
            console.log("No students found to process.");
            return { statusCode: 200, body: "No students found." };
        }
        console.log(`Found ${usersSnapshot.docs.length} students.`);

        const allCoursesSnapshot = await db.collection('courses').get();
        const allCourses = allCoursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
        console.log(`Found ${allCourses.length} total courses.`);
        
        const allSubjectsSnapshot = await db.collection('subjects').get();
        const allSubjects = allSubjectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
        console.log(`Found ${allSubjects.length} total subjects. Processing all students in parallel...`);
        
        const processingPromises = usersSnapshot.docs.map(async (doc) => {
            const student = { id: doc.id, ...doc.data() } as User;
            console.log(`[${student.id}] Starting processing for student.`);
            try {
                const progressRef = db.collection('studentProgress').doc(student.id);
                const progressDoc = await progressRef.get();
                if (!progressDoc.exists) {
                    console.log(`[${student.id}] Skipping: No progress document found.`);
                    return;
                }

                const progress = progressDoc.data() as StudentProgress;
                const challengeTime = (progress.dailyChallengeTime || '06:00').split(':')[0] + ':00';
                console.log(`[${student.id}] Configured challenge time: ${challengeTime}`);
                
                if (event.httpMethod !== 'GET' && challengeTime !== currentTimeSlot) {
                    console.log(`[${student.id}] Skipping: Time slot mismatch (current: ${currentTimeSlot}).`);
                    return;
                }
                
                const challengesExist = progress.reviewChallenge?.generatedForDate === todayISO && 
                                      progress.glossaryChallenge?.generatedForDate === todayISO && 
                                      progress.portugueseChallenge?.generatedForDate === todayISO;
                if (challengesExist) {
                    console.log(`[${student.id}] Skipping: Challenges for ${todayISO} already exist.`);
                    return;
                }
                
                const enrolledCourses = allCourses.filter(c => c.enrolledStudentIds.includes(student.id));
                const enrolledSubjectIds = new Set(enrolledCourses.flatMap(c => c.disciplines.map(d => d.subjectId)));
                if (enrolledSubjectIds.size === 0) {
                     console.log(`[${student.id}] Skipping: Not enrolled in any subjects.`);
                    return;
                }
                
                const studentSubjects = allSubjects.filter(s => enrolledSubjectIds.has(s.id));
                 console.log(`[${student.id}] Found ${enrolledCourses.length} enrolled courses and ${studentSubjects.length} relevant subjects.`);

                await generateChallengesForStudent(student, progress, todayISO, db, ai, studentSubjects);
                console.log(`[${student.id}] Successfully processed and updated challenges.`);

            } catch (e: any) {
                console.error(`[${student.id}] ERROR during processing: ${e.message}`, e.stack);
            }
        });

        await Promise.all(processingPromises);
        
        console.log("--- Handler execution finished successfully. ---");
        return {
            statusCode: 200,
            body: event.httpMethod === 'GET' ? "Manual trigger successful." : `Processed challenges for time slot ${currentTimeSlot}.`
        };

    } catch (error: any) {
        console.error("--- FATAL ERROR in handler ---", error.message, error.stack);
        return { 
            statusCode: 500, 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: `An internal server error occurred: ${error.message}`,
                stack: error.stack,
            }),
        };
    }
};

const generateChallengesForStudent = async (
    student: User, progress: StudentProgress, todayISO: string, db: admin.firestore.Firestore, ai: GoogleGenAI, studentSubjects: Subject[]
) => {
    console.log(`[${student.id}] Starting generation of challenges for date ${todayISO}.`);
    if (studentSubjects.length === 0) {
        console.log(`[${student.id}] No subjects found for this student. Aborting challenge generation.`);
        return;
    }
    const updatedProgress: Partial<StudentProgress> = {};

    if (progress.portugueseChallenge?.generatedForDate !== todayISO) {
        const questionCount = progress.portugueseChallengeQuestionCount || 1;
        console.log(`[${student.id}] Generating Portuguese challenge (${questionCount} questions).`);
        try {
            const questions = await generatePortugueseChallenge(questionCount, progress.portugueseErrorStats, ai);
            console.log(`[${student.id}] Generated ${questions.length} Portuguese questions.`);
            updatedProgress.portugueseChallenge = { date: todayISO, generatedForDate: todayISO, items: questions.map((q, i) => ({ ...q, id: `port-challenge-${todayISO}-${i}` })), isCompleted: false, attemptsMade: 0 };
        } catch (e: any) {
             console.error(`[${student.id}] Failed to generate Portuguese challenge: ${e.message}`);
        }
    }

    if (progress.glossaryChallenge?.generatedForDate !== todayISO) {
        try {
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
            console.log(`[${student.id}] Generating Glossary challenge (${questionCount} questions) from ${uniqueGlossaryTerms.length} available terms.`);
            const questions = generateGlossaryChallengeQuestions(uniqueGlossaryTerms, questionCount);
            console.log(`[${student.id}] Generated ${questions.length} Glossary questions.`);
            updatedProgress.glossaryChallenge = { date: todayISO, generatedForDate: todayISO, items: questions.map((q, i) => ({ ...q, id: `gloss-challenge-${todayISO}-${i}` })), isCompleted: false, attemptsMade: 0 };
        } catch (e: any) {
            console.error(`[${student.id}] Failed to generate Glossary challenge: ${e.message}`);
        }
    }
    
    if (progress.reviewChallenge?.generatedForDate !== todayISO) {
        try {
            const questionCount = progress.advancedReviewQuestionCount || 5;
            const srsData = progress.srsData || {};
            const dueQuestionIds = new Set(Object.entries(srsData).filter(([, data]) => data.nextReviewDate <= todayISO).map(([id]) => id));
            const allQuestions = studentSubjects.flatMap(s => s.topics.flatMap(t => [...t.questions, ...(t.tecQuestions || []), ...t.subtopics.flatMap(st => [...st.questions, ...(st.tecQuestions || [])])]));
            const dueQuestions = allQuestions.filter(q => dueQuestionIds.has(q.id));
            console.log(`[${student.id}] Generating Review challenge (${questionCount} questions) from ${dueQuestions.length} due questions.`);
            const selectedQuestions = shuffleArray(dueQuestions).slice(0, questionCount);
            console.log(`[${student.id}] Selected ${selectedQuestions.length} Review questions.`);
            updatedProgress.reviewChallenge = { date: todayISO, generatedForDate: todayISO, items: selectedQuestions, isCompleted: false, attemptsMade: 0 };
        } catch (e: any) {
            console.error(`[${student.id}] Failed to generate Review challenge: ${e.message}`);
        }
    }

    if (Object.keys(updatedProgress).length > 0) {
        console.log(`[${student.id}] Updating Firestore with new challenges.`);
        await db.collection('studentProgress').doc(student.id).set(updatedProgress, { merge: true });
        console.log(`[${student.id}] Firestore update successful.`);
    } else {
         console.log(`[${student.id}] No new challenges needed to be generated.`);
    }
};

const generatePortugueseChallenge = async (
    questionCount: number, errorStats: StudentProgress['portugueseErrorStats'] | undefined, ai: GoogleGenAI
): Promise<Omit<Question, 'id'>[]> => {
    const errorFocusPrompt = errorStats ? `A partir das estatísticas de erro do aluno, foque nos tipos de erro mais comuns: ${JSON.stringify(errorStats)}.` : '';
    const prompt = `Crie ${questionCount} questão(ões) para um desafio de gramática da língua portuguesa no seguinte formato: 1. A questão é uma única frase que contém um erro gramatical sutil (concordância, regência, crase, pontuação, etc.). 2. ${errorFocusPrompt} 3. A frase deve ser dividida em 5 partes (alternativas). 4. A alternativa correta ('correctAnswer') é o trecho que contém o erro. 5. Para cada questão, inclua uma 'errorCategory' que classifique o erro (ex: 'Crase', 'Concordância Verbal', 'Regência', 'Pontuação'). 6. Forneça uma 'justification' geral explicando o erro e como corrigi-lo. 7. Forneça um array 'optionJustifications' com uma justificativa para CADA alternativa. Para a alternativa correta, reforce a explicação do erro. Para as alternativas incorretas (que são gramaticalmente corretas no contexto da frase), a justificativa deve ser "Este trecho não contém erros.". Retorne a(s) questão(ões) como um array de objetos JSON, seguindo estritamente o schema.`;
    
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
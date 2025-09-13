import { Handler } from "@netlify/functions";
import * as admin from "firebase-admin";
// FIX: Use @google/genai per guidelines
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { StudentProgress, Subject, Question, GlossaryTerm } from "../../src/types";

// Firebase Admin SDK initialization
// Ensure you have set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL in your Netlify environment variables
try {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID!,
                privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
            }),
        });
    }
} catch (error) {
    console.error("Firebase Admin initialization error", error);
}

const db = admin.firestore();

// Gemini API initialization
// FIX: Initialize Gemini API client as per guidelines, using API_KEY from environment variables.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });


// --- UTILITY FUNCTIONS ---

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

async function retryWithBackoff<T>(apiCall: () => Promise<T>, maxRetries = 3, initialDelay = 1000): Promise<T> {
    let delay = initialDelay;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await apiCall();
        } catch (error: any) {
            const errorMessage = error.toString().toLowerCase();
            const isTransientError = errorMessage.includes('503') || errorMessage.includes('500') || errorMessage.includes('429') || errorMessage.includes('unavailable') || errorMessage.includes('overloaded');
            if (isTransientError && i < maxRetries - 1) {
                console.warn(`API call failed, retrying in ${delay}ms... (Attempt ${i + 1})`, error);
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
        throw new Error("Invalid JSON format from AI.");
    }
}

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
            properties: {
                option: { type: Type.STRING },
                justification: { type: Type.STRING },
            },
            required: ["option", "justification"]
          }
        },
        errorCategory: { type: Type.STRING }
      },
      required: ["statement", "options", "correctAnswer", "justification"],
    },
};

// --- AI CHALLENGE GENERATION LOGIC (Adapted from geminiService) ---

const generatePortugueseChallenge = async (questionCount: number, errorStats?: StudentProgress['portugueseErrorStats']): Promise<Omit<Question, 'id'>[]> => {
    const errorFocusPrompt = errorStats ? `Based on the student's error stats, focus on the most common error types: ${JSON.stringify(errorStats)}.` : '';
    const prompt = `Create ${questionCount} question(s) for a Portuguese grammar challenge in the following format:
    1. The question is a single sentence containing a subtle grammatical error (e.g., agreement, punctuation).
    2. ${errorFocusPrompt}
    3. The sentence must be split into exactly 5 parts (the options).
    4. The 'correctAnswer' is the part containing the error.
    5. For each question, include an 'errorCategory' (e.g., 'Crase', 'Concordância Verbal').
    6. Provide a general 'justification' explaining the error.
    7. Provide an 'optionJustifications' array explaining each option. For the correct option, explain the error. For incorrect options, the justification should be "Este trecho não contém erros.".
    Return the question(s) as a JSON array, strictly following the schema.`;

    const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: questionSchema
        }
    }));
    
    const generatedQuestions = parseJsonResponse<any[]>(response.text || '', 'array');

    return generatedQuestions.map((q: any) => {
        const cleanedOptionJustifications: { [key: string]: string } = {};
        if (Array.isArray(q.optionJustifications)) {
            q.optionJustifications.forEach((item: { option: string; justification: string }) => {
                if (item.option && item.justification) cleanedOptionJustifications[item.option] = item.justification;
            });
        }
        return {
            statement: q.statement,
            options: q.options,
            correctAnswer: q.correctAnswer,
            justification: q.justification,
            optionJustifications: cleanedOptionJustifications,
            errorCategory: q.errorCategory,
        };
    });
};

const generateGlossaryChallenge = async (terms: GlossaryTerm[], questionCount: number): Promise<Omit<Question, 'id'>[]> => {
    if (terms.length < 4) return [];

    const prompt = `From the following list of glossary terms, create ${questionCount} multiple-choice question(s).
    For each question:
    1. The 'statement' will be the DEFINITION of a term.
    2. The 'options' will be an array of 5 TERMS, one of which is the correct one for the definition. The other 4 should be plausible distractors from the list.
    3. The 'correctAnswer' is the correct TERM.
    4. The 'justification' should simply be "This is the correct term for the provided definition."
    5. The 'optionJustifications' array should be empty.
    
    Glossary Terms: ${JSON.stringify(terms)}

    Return the question(s) as a JSON array, strictly following the schema.`;

    const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: questionSchema,
        }
    }));

    const generatedQuestions = parseJsonResponse<any[]>(response.text || '', 'array');
    return generatedQuestions.map(q => ({
        statement: q.statement,
        options: q.options,
        correctAnswer: q.correctAnswer,
        justification: q.justification,
        optionJustifications: {},
    }));
};

// --- MAIN HANDLER ---

export const handler: Handler = async () => {
    try {
        const now = getBrasiliaDate();
        const todayISO = getLocalDateISOString(now);
        const currentTime = `${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')}`;

        console.log(`Running generateDailyChallenges at ${now.toISOString()} (Brasilia: ${todayISO} ${currentTime})`);

        const [progressSnap, subjectsSnap] = await Promise.all([
            db.collection('studentProgress').get(),
            db.collection('subjects').get()
        ]);

        const allProgress: StudentProgress[] = progressSnap.docs.map(doc => doc.data() as StudentProgress);
        const allSubjects: Subject[] = subjectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));

        const writeBatch = db.batch();

        for (const progress of allProgress) {
            const challengeTime = progress.dailyChallengeTime || '06:00';
            const hasGeneratedToday = progress.reviewChallenge?.date === todayISO || progress.glossaryChallenge?.date === todayISO || progress.portugueseChallenge?.date === todayISO;

            if (currentTime >= challengeTime && !hasGeneratedToday) {
                console.log(`Generating challenges for student ${progress.studentId}...`);

                let needsUpdate = false;
                const updatedProgress: StudentProgress = { ...progress };

                // 1. Review Challenge
                const reviewQuestionCount = progress.advancedReviewQuestionCount ?? 5;
                const incorrectQuestionIds = new Set<string>();
                Object.values(progress.progressByTopic).forEach(subject => {
                    Object.values(subject).forEach(topic => {
                        topic.lastAttempt?.forEach(attempt => {
                            if (!attempt.isCorrect) incorrectQuestionIds.add(attempt.questionId);
                        });
                    });
                });
                const allQuestions = allSubjects.flatMap(s => s.topics.flatMap(t => [...t.questions, ...(t.subtopics.flatMap(st => st.questions))]));
                const reviewQuestions = allQuestions.filter(q => incorrectQuestionIds.has(q.id)).slice(0, reviewQuestionCount);
                if (reviewQuestions.length > 0) {
                    updatedProgress.reviewChallenge = {
                        date: todayISO,
                        items: reviewQuestions,
                        isCompleted: false,
                        attemptsMade: 0
                    };
                    needsUpdate = true;
                }

                // 2. Glossary Challenge
                const glossaryQuestionCount = progress.glossaryChallengeQuestionCount ?? 5;
                const allGlossaryTerms = allSubjects.flatMap(s => s.topics.flatMap(t => [...(t.glossary || []), ...(t.subtopics.flatMap(st => st.glossary || []))]));
                if (allGlossaryTerms.length >= 4) {
                    const glossaryQuestions = await generateGlossaryChallenge(allGlossaryTerms, glossaryQuestionCount);
                    if (glossaryQuestions.length > 0) {
                         updatedProgress.glossaryChallenge = {
                            date: todayISO,
                            items: glossaryQuestions,
                            isCompleted: false,
                            attemptsMade: 0
                        };
                        needsUpdate = true;
                    }
                }

                // 3. Portuguese Challenge
                const portugueseQuestionCount = progress.portugueseChallengeQuestionCount ?? 1;
                const portugueseQuestions = await generatePortugueseChallenge(portugueseQuestionCount, progress.portugueseErrorStats);
                if(portugueseQuestions.length > 0) {
                    updatedProgress.portugueseChallenge = {
                        date: todayISO,
                        items: portugueseQuestions.map((q, i) => ({...q, id: `port-challenge-${todayISO}-${i}`})),
                        isCompleted: false,
                        attemptsMade: 0
                    };
                    needsUpdate = true;
                }
                
                // Set catch-up challenge from yesterday if not completed
                const yesterday = getBrasiliaDate();
                yesterday.setUTCDate(yesterday.getUTCDate() - 1);
                const yesterdayISO = getLocalDateISOString(yesterday);

                (['reviewChallenge', 'glossaryChallenge', 'portugueseChallenge'] as const).forEach(key => {
                    const challenge = progress[key];
                    if (challenge && challenge.date === yesterdayISO && !challenge.isCompleted) {
                        updatedProgress[key] = { ...challenge, generatedForDate: yesterdayISO, date: todayISO };
                        needsUpdate = true;
                    }
                });


                if (needsUpdate) {
                    const progressRef = db.collection('studentProgress').doc(progress.studentId);
                    writeBatch.set(progressRef, updatedProgress);
                }
            }
        }
        
        await writeBatch.commit();
        console.log(`Batch commit successful.`);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Daily challenges generated successfully." }),
        };
    } catch (error: any) {
        console.error("Error generating daily challenges:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: `Failed to generate daily challenges: ${error.message}` }),
        };
    }
};

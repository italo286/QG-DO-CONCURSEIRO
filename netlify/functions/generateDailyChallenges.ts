import { Handler, schedule } from "@netlify/functions";
import * as admin from "firebase-admin";
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { StudentProgress, User, Subject, Question, GlossaryTerm, QuestionAttempt, Course } from "../../src/types.server";

// Firebase Admin initialization
try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY environment variable not set.");
    }
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
    }
} catch (error) {
    console.error("Firebase Admin initialization error:", error);
}

const db = admin.firestore();

// Gemini API initialization
if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable for Gemini is not set.");
}
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });


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

const generateChallengesForStudent = async (student: User, progress: StudentProgress, todayISO: string) => {
    // 1. Fetch all data needed for this student
    const coursesSnapshot = await db.collection('courses').where('enrolledStudentIds', 'array-contains', student.id).get();
    const enrolledCourses = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
    const teacherIds = [...new Set(enrolledCourses.map(c => c.teacherId))];
    if (teacherIds.length === 0) return; // No teachers, no subjects

    const subjectsSnapshot = await db.collection('subjects').where('teacherId', 'in', teacherIds).get();
    const allSubjects = subjectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));

    const updatedProgress = { ...progress };

    // --- 2. Generate Portuguese Challenge ---
    try {
        const questionCount = progress.portugueseChallengeQuestionCount || 1;
        const questions = await GeminiService.generatePortugueseChallenge(questionCount, progress.portugueseErrorStats);
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
        // Collect glossary terms based on settings
        let allGlossaryTerms: GlossaryTerm[] = [];
        const subjectIdsToUse = progress.glossaryChallengeMode === 'advanced' && progress.advancedGlossarySubjectIds?.length ? progress.advancedGlossarySubjectIds : allSubjects.map(s => s.id);
        const topicIdsToUse = progress.glossaryChallengeMode === 'advanced' ? new Set(progress.advancedGlossaryTopicIds) : null;
        
        allSubjects.forEach(subject => {
            if (subjectIdsToUse.includes(subject.id)) {
                subject.topics.forEach(topic => {
                    if (!topicIdsToUse || topicIdsToUse.has(topic.id)) {
                        allGlossaryTerms.push(...(topic.glossary || []));
                    }
                    topic.subtopics.forEach(subtopic => {
                        if (!topicIdsToUse || topicIdsToUse.has(subtopic.id)) {
                             allGlossaryTerms.push(...(subtopic.glossary || []));
                        }
                    });
                });
            }
        });
        
        const uniqueGlossaryTerms = Array.from(new Map(allGlossaryTerms.map(item => [item.term, item])).values());
        const questions = await GeminiService.generateGlossaryChallengeQuestions(uniqueGlossaryTerms, questionCount);
        updatedProgress.glossaryChallenge = {
            date: todayISO,
            generatedForDate: todayISO,
            items: questions.map((q, i) => ({ ...q, id: `gloss-challenge-${todayISO}-${i}` })),
            isCompleted: false,
            attemptsMade: 0,
        };
    } catch (e) {
        console.error(`Failed to generate Glossary challenge for ${student.id}:`, e);
    }
    
    // --- 4. Generate Review Challenge ---
    try {
        const questionCount = progress.advancedReviewQuestionCount || 5;
        let questionPool: Question[] = [];
        // Standard mode: get questions from topics with low scores
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
        } else { // Advanced mode
            const subjectIds = progress.advancedReviewSubjectIds || [];
            const topicIds = new Set(progress.advancedReviewTopicIds || []);

            allSubjects.forEach(subject => {
                if (subjectIds.includes(subject.id)) {
                    subject.topics.forEach(topic => {
                        if (topicIds.size === 0 || topicIds.has(topic.id)) {
                            questionPool.push(...(topic.questions || []), ...(topic.tecQuestions || []));
                        }
                        topic.subtopics.forEach(subtopic => {
                             if (topicIds.size === 0 || topicIds.has(subtopic.id)) {
                                questionPool.push(...(subtopic.questions || []), ...(subtopic.tecQuestions || []));
                            }
                        });
                    });
                }
            });
        }
        
        const selectedQuestions = shuffleArray(questionPool).slice(0, questionCount);
        updatedProgress.reviewChallenge = {
            date: todayISO,
            generatedForDate: todayISO,
            items: selectedQuestions,
            isCompleted: false,
            attemptsMade: 0,
        };
    } catch (e) {
         console.error(`Failed to generate Review challenge for ${student.id}:`, e);
    }


    // --- 5. Save updated progress ---
    await db.collection('studentProgress').doc(student.id).update(updatedProgress);
};


const myHandler: Handler = async () => {
    if (!admin.apps.length) {
        console.error("Firebase Admin not initialized. Exiting function.");
        return { statusCode: 500, body: "Server configuration error." };
    }

    const nowBrasilia = getBrasiliaDate();
    const currentHour = nowBrasilia.getUTCHours();
    const currentMinute = nowBrasilia.getUTCMinutes();
    // Check for the time slot every 15 minutes
    const currentTimeSlot = `${String(currentHour).padStart(2, '0')}:${String(Math.floor(currentMinute / 15) * 15).padStart(2, '0')}`;
    const todayISO = getLocalDateISOString(nowBrasilia);

    try {
        const usersSnapshot = await db.collection('users')
            .where('role', '==', 'aluno')
            .get();
        
        if (usersSnapshot.empty) {
            return { statusCode: 200, body: "No students found." };
        }

        const promises = usersSnapshot.docs.map(async (doc) => {
            const student = { id: doc.id, ...doc.data() } as User;
            const progressRef = db.collection('studentProgress').doc(student.id);
            const progressDoc = await progressRef.get();
            if (!progressDoc.exists) return;
            
            const progress = progressDoc.data() as StudentProgress;
            const challengeTime = progress.dailyChallengeTime || '06:00';

            if (challengeTime !== currentTimeSlot) {
                return; // Not this student's time yet
            }

            // Check if challenges for today have already been generated
            if (
                progress.reviewChallenge?.generatedForDate === todayISO &&
                progress.glossaryChallenge?.generatedForDate === todayISO &&
                progress.portugueseChallenge?.generatedForDate === todayISO
            ) {
                return; // Already generated for today
            }

            await generateChallengesForStudent(student, progress, todayISO);
        });

        await Promise.all(promises);

        return {
            statusCode: 200,
            body: `Processed challenges for time slot ${currentTimeSlot}.`
        };

    } catch (error: any) {
        console.error("Error in daily challenge generation:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};

// This function is for Gemini Service calls.
const GeminiService = {
    generatePortugueseChallenge: async (
        questionCount: number,
        errorStats?: StudentProgress['portugueseErrorStats']
    ): Promise<Omit<Question, 'id'>[]> => {
        
        const errorFocusPrompt = errorStats ? `A partir das estatísticas de erro do aluno, foque nos tipos de erro mais comuns: ${JSON.stringify(errorStats)}.` : '';

        const prompt = `Crie ${questionCount} questão(ões) para um desafio de gramática da língua portuguesa no seguinte formato:
1. A questão é uma única frase que contém um erro gramatical sutil (concordância, regência, crase, pontuação, etc.).
2. ${errorFocusPrompt}
3. A frase deve ser dividida em 5 partes (alternativas).
4. A alternativa correta ('correctAnswer') é o trecho que contém o erro.
5. Para cada questão, inclua uma 'errorCategory' que classifique o erro (ex: 'Crase', 'Concordância Verbal', 'Regência', 'Pontuação').
6. Forneça uma 'justification' geral explicando o erro e como corrigi-lo.
7. Forneça um array 'optionJustifications' com uma justificativa para CADA alternativa. Para a alternativa correta, reforce a explicação do erro. Para as alternativas incorretas (que são gramaticalmente corretas no contexto da frase), a justificativa deve ser "Este trecho não contém erros.".

Retorne a(s) questão(ões) como um array de objetos JSON, seguindo estritamente o schema.
`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: questionSchema
            }
        });

        const generatedQuestions = parseJsonResponse<any[]>(response.text.trim() ?? '');
        if (!generatedQuestions) {
            throw new Error("Failed to parse response from Gemini API.");
        }

        return generatedQuestions.map((q: any) => ({
            statement: q.statement,
            options: q.options,
            correctAnswer: q.correctAnswer,
            justification: q.justification,
            optionJustifications: q.optionJustifications,
            errorCategory: q.errorCategory,
        }));
    },
    generateGlossaryChallengeQuestions: async (
        glossaryTerms: GlossaryTerm[],
        questionCount: number
    ): Promise<Omit<Question, 'id'>[]> => {
        if (glossaryTerms.length < 4) return [];
    
        const selectedTerms = shuffleArray(glossaryTerms).slice(0, questionCount);
        const questions: Omit<Question, 'id'>[] = [];
    
        for (const term of selectedTerms) {
            const correctAnswer = term.term;
            const distractors = shuffleArray(glossaryTerms.filter(t => t.term !== correctAnswer))
                .slice(0, 3) // 3 distractors + 1 correct = 4 options
                .map(t => t.term);
            
            if (distractors.length < 3) continue;
    
            const options = shuffleArray([correctAnswer, ...distractors]);
            questions.push({
                statement: `Qual termo corresponde à definição: "${term.definition}"?`,
                options,
                correctAnswer,
                justification: `A definição apresentada corresponde ao termo "${correctAnswer}".`,
            });
        }
    
        return questions;
    }
};

// Netlify will run this handler on schedule.
export const handler = schedule("*/15 * * * *", myHandler);

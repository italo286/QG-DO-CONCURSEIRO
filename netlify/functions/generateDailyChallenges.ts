import { Handler } from "@netlify/functions";
import * as admin from "firebase-admin";
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { StudentProgress, Subject, Question, GlossaryTerm, User } from "../../src/types";

// Firebase Admin SDK initialization
try {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(JSON.parse(serviceAccountKey)),
            });
        }
    } else {
        console.error("FIREBASE_SERVICE_ACCOUNT_KEY is not set.");
    }
} catch (error) {
    console.error("Firebase Admin initialization error", error);
}

const db = admin.firestore();

// Gemini API initialization
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error("VITE_GEMINI_API_KEY is not set.");
}
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY! });


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

// --- AI CHALLENGE GENERATION LOGIC ---

const generatePortugueseChallenge = async (questionCount: number, errorStats?: StudentProgress['portugueseErrorStats']): Promise<Omit<Question, 'id'>[]> => {
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
    
    const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: questionSchema
        }
    }));

    const generatedQuestions = parseJsonResponse<any[]>(response.text?.trim() ?? '', 'array');

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

    const prompt = `A partir da lista de termos de glossário a seguir, crie ${questionCount} questão(ões) de múltipla escolha.
    Para cada questão:
    1. O 'statement' será a DEFINIÇÃO de um termo.
    2. As 'options' serão um array de 5 TERMOS, um dos quais é o correto para a definição. Os outros 4 devem ser distratores plausíveis da lista.
    3. O 'correctAnswer' é o TERMO correto.
    4. A 'justification' deve ser simplesmente "Este é o termo correto para a definição fornecida."
    5. O array 'optionJustifications' deve estar vazio.
    
    Termos do Glossário: ${JSON.stringify(terms)}

    Retorne a(s) questão(ões) como um array JSON, seguindo estritamente o schema.`;

    const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: questionSchema,
        }
    }));

    const generatedQuestions = parseJsonResponse<any[]>(response.text?.trim() ?? '', 'array');
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

        const [progressSnap, subjectsSnap, usersSnap] = await Promise.all([
            db.collection('studentProgress').get(),
            db.collection('subjects').get(),
            db.collection('users').get()
        ]);

        const allProgress: StudentProgress[] = progressSnap.docs.map(doc => doc.data() as StudentProgress);
        const allSubjects: Subject[] = subjectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
        const allUsers: User[] = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));

        const writeBatch = db.batch();
        
        // --- Build a comprehensive map of all questions for efficient lookup ---
        const allQuestionsMap = new Map<string, Question>();
        allSubjects.forEach(subject => {
            subject.topics.forEach(topic => {
                const addQuestionsToMap = (qList: Question[] | undefined, isTec: boolean) => {
                    (qList || []).forEach(q => {
                        allQuestionsMap.set(q.id, {
                            ...q,
                            subjectName: subject.name,
                            topicName: topic.name + (isTec ? ' (TEC)' : ''),
                        });
                    });
                };
                addQuestionsToMap(topic.questions, false);
                addQuestionsToMap(topic.tecQuestions, true);
                topic.subtopics.forEach(subtopic => {
                    const addSubtopicQuestionsToMap = (qList: Question[] | undefined, isTec: boolean) => {
                        (qList || []).forEach(q => {
                            allQuestionsMap.set(q.id, {
                                ...q,
                                subjectName: subject.name,
                                topicName: `${topic.name} / ${subtopic.name}` + (isTec ? ' (TEC)' : ''),
                            });
                        });
                    };
                    addSubtopicQuestionsToMap(subtopic.questions, false);
                    addSubtopicQuestionsToMap(subtopic.tecQuestions, true);
                });
            });
        });

        for (const progress of allProgress) {
            const challengeTime = progress.dailyChallengeTime || '06:00';
            const hasGeneratedToday = progress.reviewChallenge?.date === todayISO;

            if (currentTime >= challengeTime && !hasGeneratedToday) {
                console.log(`Generating challenges for student ${progress.studentId}...`);

                const updatedProgress: StudentProgress = JSON.parse(JSON.stringify(progress)); // Deep copy to avoid mutation issues
                let needsUpdate = false;

                // --- 1. Review Challenge ---
                const reviewQuestionCount = progress.advancedReviewQuestionCount ?? 5;
                const incorrectQuestionIds = new Set<string>();
                Object.values(progress.progressByTopic).forEach(subject => {
                    Object.values(subject).forEach(topic => {
                        topic.lastAttempt?.forEach(attempt => {
                            if (!attempt.isCorrect) incorrectQuestionIds.add(attempt.questionId);
                        });
                    });
                });
                const reviewQuestions = Array.from(incorrectQuestionIds)
                                            .map(id => allQuestionsMap.get(id))
                                            .filter((q): q is Question => q !== undefined)
                                            .slice(0, reviewQuestionCount);
                
                updatedProgress.reviewChallenge = {
                    date: todayISO,
                    items: reviewQuestions,
                    isCompleted: reviewQuestions.length === 0,
                    attemptsMade: 0
                };
                needsUpdate = true;
                
                // --- 2. Glossary Challenge ---
                const glossaryQuestionCount = progress.glossaryChallengeQuestionCount ?? 5;
                const allGlossaryTerms = allSubjects.flatMap(s => s.topics.flatMap(t => [...(t.glossary || []), ...(t.subtopics.flatMap(st => st.glossary || []))]));
                const uniqueGlossaryTerms = Array.from(new Map(allGlossaryTerms.map(item => [item.term, item])).values());
                
                if (uniqueGlossaryTerms.length >= 4) {
                    try {
                        const glossaryQuestions = await generateGlossaryChallenge(uniqueGlossaryTerms, glossaryQuestionCount);
                        updatedProgress.glossaryChallenge = {
                            date: todayISO,
                            items: glossaryQuestions.map((q, i) => ({ ...q, id: `gloss-challenge-${todayISO}-${i}` })),
                            isCompleted: glossaryQuestions.length === 0,
                            attemptsMade: 0
                        };
                    } catch (e) {
                         console.error(`Failed to generate glossary challenge for ${progress.studentId}`, e);
                         updatedProgress.glossaryChallenge = { date: todayISO, items: [], isCompleted: true, attemptsMade: 0 };
                    }
                } else {
                    updatedProgress.glossaryChallenge = { date: todayISO, items: [], isCompleted: true, attemptsMade: 0 };
                }
                
                // --- 3. Portuguese Challenge ---
                 try {
                    const portugueseQuestionCount = progress.portugueseChallengeQuestionCount ?? 1;
                    const portugueseQuestions = await generatePortugueseChallenge(portugueseQuestionCount, progress.portugueseErrorStats);
                    updatedProgress.portugueseChallenge = {
                        date: todayISO,
                        items: portugueseQuestions.map((q, i) => ({...q, id: `port-challenge-${todayISO}-${i}`})),
                        isCompleted: portugueseQuestions.length === 0,
                        attemptsMade: 0
                    };
                } catch (e) {
                    console.error(`Failed to generate portuguese challenge for ${progress.studentId}`, e);
                    updatedProgress.portugueseChallenge = { date: todayISO, items: [], isCompleted: true, attemptsMade: 0 };
                }

                // --- 4. Streak Reset ---
                const yesterday = getBrasiliaDate();
                yesterday.setUTCDate(yesterday.getUTCDate() - 1);
                const yesterdayISO = getLocalDateISOString(yesterday);
                if (progress.dailyChallengeStreak && progress.dailyChallengeStreak.lastCompletedDate < yesterdayISO) {
                    updatedProgress.dailyChallengeStreak = { ...progress.dailyChallengeStreak, current: 0 };
                }
                
                // --- 5. Push Notification ---
                const studentUser = allUsers.find(u => u.id === progress.studentId);
                if (studentUser && studentUser.fcmToken) {
                    const message = {
                        notification: {
                            title: 'Seus desafios diários estão prontos!',
                            body: 'Clique para começar a praticar e manter sua sequência! 🔥',
                        },
                        token: studentUser.fcmToken,
                    };
                    try {
                        await admin.messaging().send(message);
                        console.log(`Notification sent to ${studentUser.name}`);
                    } catch (error) {
                        console.error(`Error sending notification to ${studentUser.name}:`, error);
                    }
                }

                if (needsUpdate) {
                    const progressRef = db.collection('studentProgress').doc(progress.studentId);
                    writeBatch.set(progressRef, updatedProgress);
                }
            }
        }
        
        await writeBatch.commit();
        console.log(`Batch commit successful. Updated challenges for students.`);

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

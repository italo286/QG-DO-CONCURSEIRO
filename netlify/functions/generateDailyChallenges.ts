
import { Handler, HandlerEvent } from '@netlify/functions';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
// FIX: Added 'Type' to imports for defining the question schema.
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
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

// FIX: Added helper functions and schema required for generatePortugueseChallenge, which were previously in a separate client-side file.
// Helper for retrying API calls with exponential backoff for transient errors
async function retryWithBackoff<T>(
    apiCall: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
): Promise<T> {
    let delay = initialDelay;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await apiCall();
        } catch (error: any) {
            const errorMessage = error.toString().toLowerCase();
            const isTransientError = 
                errorMessage.includes('503') || 
                errorMessage.includes('500') ||
                errorMessage.includes('429') ||
                errorMessage.includes('unavailable') ||
                errorMessage.includes('overloaded');

            if (isTransientError && i < maxRetries - 1) {
                console.warn(`API call failed with transient error, retrying in ${delay}ms... (Attempt ${i + 1})`, error);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Exponential backoff
            } else {
                throw error; // Re-throw if it's not a transient error or retries are exhausted
            }
        }
    }
    // This line should not be reachable, but is needed for TypeScript's control flow analysis
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
        if (expectedType === 'array' && !Array.isArray(parsed)) {
            throw new Error("A resposta da IA não é um array.");
        }
        if (expectedType === 'object' && (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null)) {
            throw new Error("A resposta da IA não é um objeto.");
        }
        return parsed;
    } catch(e) {
        console.error("Erro ao fazer o parse da resposta JSON da IA: ", e);
        console.error("String recebida:", jsonString);
        throw new Error("A resposta da IA não está em um formato JSON válido.");
    }
}

const questionSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        statement: {
          type: Type.STRING,
          description: "A pergunta clara e concisa baseada no texto.",
        },
        options: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          },
          description: "Um array com exatamente 5 alternativas de resposta.",
        },
        correctAnswer: {
          type: Type.STRING,
          description: "A string exata da alternativa correta, que deve estar presente no array de 'options'.",
        },
        justification: {
          type: Type.STRING,
          description: "A justificativa detalhada APENAS para a resposta CORRETA, baseada diretamente no conteúdo do PDF fornecido.",
        },
        optionJustifications: {
          type: Type.ARRAY,
          description: "Um array de objetos com justificativas para CADA alternativa. Cada objeto deve ter 'option' (o texto exato da alternativa) e 'justification'. Se não for solicitado, deve ser um array vazio.",
          items: {
            type: Type.OBJECT,
            properties: {
                option: { type: Type.STRING, description: "O texto exato de uma das 5 alternativas." },
                justification: { type: Type.STRING, description: "A justificativa explicando por que a alternativa está certa ou errada." },
            },
            required: ["option", "justification"]
          }
        },
        errorCategory: {
            type: Type.STRING,
            description: "A categoria do erro gramatical (ex: 'Crase', 'Concordância Verbal'). Apenas para questões de português. Para outros tipos, pode ser omitido."
        }
      },
      required: ["statement", "options", "correctAnswer", "justification"],
    },
};

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

    const allQuestionsWithContext: (Question & { subjectId: string; topicId: string; subjectName: string; topicName: string; })[] = [];
    subjects.forEach(subject => {
        subject.topics.forEach(topic => {
            const addQuestions = (content: Topic | SubTopic, parentTopicName?: string) => {
                const questions = [...(content.questions || []), ...(content.tecQuestions || [])];
                const topicName = parentTopicName ? `${parentTopicName} / ${content.name}` : content.name;
                questions.forEach(q => allQuestionsWithContext.push({ 
                    ...q, 
                    subjectId: subject.id, 
                    topicId: content.id,
                    topicName: topicName,
                    subjectName: subject.name,
                }));
            };
            addQuestions(topic);
            topic.subtopics.forEach(st => addQuestions(st, topic.name));
        });
    });

    if (allQuestionsWithContext.length === 0) return [];

    // Prioritize questions from topics with lower scores
    const topicsWithScores: { topicId: string; score: number }[] = [];
    Object.values(studentProgress.progressByTopic).forEach(subjectProgress => {
        Object.entries(subjectProgress).forEach(([topicId, topicData]) => {
            topicsWithScores.push({ topicId, score: topicData.score });
        });
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
            } else {
                break;
            }
        }
        if (prioritizedQuestions.length >= questionCount) break;
    }

    // Fill with random questions if not enough were found through prioritization
    if (prioritizedQuestions.length < questionCount) {
        const remainingQuestions = shuffleArray(allQuestionsWithContext.filter(q => !usedQuestionIds.has(q.id)));
        for (const question of remainingQuestions) {
            if (prioritizedQuestions.length < questionCount) {
                prioritizedQuestions.push(question);
                usedQuestionIds.add(question.id);
            } else {
                break;
            }
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

// FIX: Replaced call to non-existent 'GeminiService' with a local implementation of the function.
async function generatePortugueseChallenge(studentProgress: StudentProgress): Promise<Question[]> {
    const questionCount = studentProgress.portugueseChallengeQuestionCount || 1;
    const errorStats = studentProgress.portugueseErrorStats;
    try {
        const errorFocusPrompt = errorStats ? `A partir das estatísticas de erro do aluno, foque nos tipos de erro mais comuns: ${JSON.stringify(errorStats)}.` : '';

        const prompt = `Crie ${questionCount} questão(ões) para um desafio de gramática da língua portuguesa no seguinte formato:
    1. A questão é uma única frase que contém um erro gramatical sutil (concordância, regência, crase, pontuação, etc.).
    2. ${errorFocusPrompt}
    3. A frase deve ser dividida em 5 partes (alternativas).
    4. A alternativa correta ('correctAnswer') é o trecho que contém o erro.
    5. Para cada questão, inclua uma 'errorCategory' que classifique o erro (ex: 'Crase', 'Concordância Verbal', 'Regência', 'Pontuação').
    6. Forneça uma 'justification' geral explicando o erro e como corrigi-lo.
    7. Forneça um array 'optionJustifications' com uma justificativa para CADA alternativa. Para a alternativa correta, reforce a explicação do erro. Para as alternativas incorretas (que são gramaticalmente corretas no contexto da frase), a justificativa deve ser "Este trecho não contém erros.".
    
    Exemplo: "A multidão, que aguardavam o resultado, estavam apreensivos."
    Alternativas: ["A multidão,", "que aguardavam", "o resultado,", "estavam", "apreensivos."]
    Resposta Correta: "que aguardavam"
    errorCategory: "Concordância Verbal"
    Justificativa: "O verbo 'aguardar' deveria concordar com o substantivo coletivo 'multidão', ficando no singular: 'que aguardava'."
    OptionJustifications: [
        { "option": "A multidão,", "justification": "Este trecho não contém erros." },
        { "option": "que aguardavam", "justification": "O verbo 'aguardar' deveria estar no singular ('aguardava') para concordar com 'A multidão'." }
    ]

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

        const questionsResult = generatedQuestions.map((q: any) => {
            const cleanedOptionJustifications: { [key: string]: string } = {};
            if (Array.isArray(q.optionJustifications)) {
                q.optionJustifications.forEach((item: { option: string; justification: string }) => {
                    if (item.option && item.justification) {
                        cleanedOptionJustifications[item.option] = item.justification;
                    }
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

        return questionsResult.map((q, i) => ({ ...q, id: `port-challenge-${Date.now()}-${i}` }));
    } catch (e) {
        console.error("Failed to generate Portuguese challenge with Gemini:", e);
        return [];
    }
}

// --- Main Handler ---
const handler: Handler = async (event: HandlerEvent) => {
    const { apiKey, studentId } = event.queryStringParameters || {};

    if (!apiKey || apiKey !== process.env.VITE_DAILY_CHALLENGE_API_KEY) {
        return { statusCode: 401, body: 'Unauthorized' };
    }
    if (!studentId) {
        return { statusCode: 400, body: 'Missing studentId' };
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
        const todayISO = getLocalDateISOString(getBrasiliaDate());

        // Check if challenges for today were already generated
        if (studentProgress.reviewChallenge?.date === todayISO && studentProgress.glossaryChallenge?.date === todayISO && studentProgress.portugueseChallenge?.date === todayISO) {
             return {
                statusCode: 200,
                body: JSON.stringify({
                    reviewChallenge: studentProgress.reviewChallenge,
                    glossaryChallenge: studentProgress.glossaryChallenge,
                    portugueseChallenge: studentProgress.portugueseChallenge,
                }),
                headers: { 'Content-Type': 'application/json' },
            };
        }

        const [reviewItems, glossaryItems, portugueseItems] = await Promise.all([
            generateReviewChallenge(studentProgress, subjects),
            generateGlossaryChallenge(studentProgress, subjects),
            generatePortugueseChallenge(studentProgress),
        ]);

        const reviewChallenge: DailyChallenge<Question> = { date: todayISO, items: reviewItems, isCompleted: false, attemptsMade: 0 };
        const glossaryChallenge: DailyChallenge<Question> = { date: todayISO, items: glossaryItems, isCompleted: false, attemptsMade: 0 };
        const portugueseChallenge: DailyChallenge<Question> = { date: todayISO, items: portugueseItems, isCompleted: false, attemptsMade: 0 };

        // Save generated challenges to Firestore
        await db.collection('studentProgress').doc(studentId).update({
            reviewChallenge,
            glossaryChallenge,
            portugueseChallenge,
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ reviewChallenge, glossaryChallenge, portugueseChallenge }),
            headers: { 'Content-Type': 'application/json' },
        };

    } catch (error: any) {
        console.error('Error generating daily challenges:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || 'An internal error occurred.' }),
        };
    }
};

export { handler };

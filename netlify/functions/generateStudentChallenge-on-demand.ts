
import { Handler, HandlerEvent } from '@netlify/functions';
import * as admin from 'firebase-admin';
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { StudentProgress, Subject, Course, Question, Topic, SubTopic, QuestionAttempt } from '../../src/types.server';

/*
 * HISTÓRICO DE MANUTENÇÃO E OTIMIZAÇÃO (Desafio de Português):
 * Esta função enfrentou repetidos erros de '504 Gateway Timeout' por exceder o tempo limite de execução da Netlify Function.
 *
 * PROBLEMA: A geração da questão de português, mesmo com um prompt simplificado, era uma tarefa complexa que levava a IA
 * a demorar muito para responder.
 *
 * TENTATIVAS ANTERIORES:
 * 1. Simplificação do prompt e do schema JSON para reduzir a carga cognitiva da IA. (Não foi suficiente)
 *
 * SOLUÇÃO APLICADA:
 * 1. Adição do `thinkingConfig: { thinkingBudget: 0 }`. Esta configuração instrui o modelo 'gemini-2.5-flash' a
 *    desativar seu processo de "pensamento" (um passo interno para melhorar a qualidade da resposta) e gerar a
 *    resposta o mais rápido possível. Isso é ideal para tarefas que exigem baixa latência.
 *
 * CUIDADO AO MODIFICAR: A remoção do `thinkingConfig` ou o aumento da complexidade do prompt pode reintroduzir
 * o problema de timeout. A velocidade aqui foi priorizada sobre a qualidade máxima que o modelo poderia oferecer.
 */

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
    // Firestore 'in' query is limited to 10 elements
    const chunks: string[][] = [];
    for (let i = 0; i < subjectIdArray.length; i += 10) {
        chunks.push(subjectIdArray.slice(i, i + 10));
    }

    const subjectPromises: Promise<Subject[]>[] = chunks.map(async (chunk) => {
        if (chunk.length === 0) return [];
        
        const subjectDocs = await db.collection('subjects').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();
        
        const subjectsWithTopicsPromises = subjectDocs.docs.map(async (doc) => {
            const subjectData = doc.data();
            
            // Fetch topics from the subcollection, which is the new data model
            const topicsSnapshot = await db.collection('subjects').doc(doc.id).collection('topics').orderBy('order').get();
            const fetchedTopics: Topic[] = topicsSnapshot.docs.map(topicDoc => ({ id: topicDoc.id, ...topicDoc.data() } as Topic));
            
            // Reconstruct the full subject object, ignoring the legacy 'topics' array from the main doc
            const { topics, ...baseData } = subjectData;
            
            return { 
                id: doc.id,
                ...baseData,
                topics: fetchedTopics // This ensures .topics is always an array
            } as Subject;
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
    // FIX: Set question count based on mode. Standard mode now has a fixed count (10)
    // and no longer incorrectly uses the advanced setting.
    const questionCount = isAdvancedMode ? (studentProgress.advancedReviewQuestionCount || 5) : 10;

    let subjectsToConsider = allEnrolledSubjects;
    
    if (isAdvancedMode && studentProgress.advancedReviewSubjectIds && studentProgress.advancedReviewSubjectIds.length > 0) {
        const subjectIdSet = new Set(studentProgress.advancedReviewSubjectIds);
        subjectsToConsider = allEnrolledSubjects.filter(s => subjectIdSet.has(s.id));
    }

    let allQuestionsWithContext: (Question & { subjectId: string; topicId: string; subjectName: string; topicName: string; isTec: boolean; })[] = [];
    subjectsToConsider.forEach(subject => {
        (subject.topics || []).forEach(topic => {
            const addQuestions = (content: Topic | SubTopic, parentTopicName?: string) => {
                const topicName = parentTopicName ? `${parentTopicName} / ${content.name}` : content.name;
                (content.questions || []).forEach(q => allQuestionsWithContext.push({ ...q, subjectId: subject.id, topicId: content.id, topicName, subjectName: subject.name, isTec: false }));
                (content.tecQuestions || []).forEach(q => allQuestionsWithContext.push({ ...q, subjectId: subject.id, topicId: content.id, topicName, subjectName: subject.name, isTec: true }));
            };
            addQuestions(topic);
            (topic.subtopics || []).forEach(st => addQuestions(st, topic.name));
        });
    });

    if (allQuestionsWithContext.length === 0) return [];

    if (isAdvancedMode) {
        let filteredQuestions = allQuestionsWithContext;
        const topicIds = studentProgress.advancedReviewTopicIds;
        if (topicIds && topicIds.length > 0) {
            const topicIdSet = new Set(topicIds);
            filteredQuestions = filteredQuestions.filter(q => topicIdSet.has(q.topicId));
        }

        const questionType = studentProgress.advancedReviewQuestionType || 'incorrect';
        if (questionType !== 'mixed') {
            const attemptedIds = new Set<string>();
            const correctIds = new Set<string>();
            Object.values(studentProgress.progressByTopic).forEach(subject => {
                Object.values(subject).forEach(topic => {
                    topic.lastAttempt.forEach(attempt => {
                        attemptedIds.add(attempt.questionId);
                        if (attempt.isCorrect) correctIds.add(attempt.questionId);
                    });
                });
            });
             (studentProgress.reviewSessions || []).forEach(session => {
                (session.attempts || []).forEach(attempt => {
                    attemptedIds.add(attempt.questionId);
                    if (attempt.isCorrect) correctIds.add(attempt.questionId);
                });
            });
            const incorrectIds = new Set([...attemptedIds].filter(id => !correctIds.has(id)));

            switch (questionType) {
                case 'unanswered': filteredQuestions = filteredQuestions.filter(q => !attemptedIds.has(q.id)); break;
                case 'incorrect': filteredQuestions = filteredQuestions.filter(q => incorrectIds.has(q.id)); break;
                case 'correct': filteredQuestions = filteredQuestions.filter(q => correctIds.has(q.id)); break;
            }
        }
        return shuffleArray(filteredQuestions).slice(0, questionCount);
    }
    
    // Standard mode: Prioritize by lowest score
    const topicsWithScores: { topicId: string; score: number }[] = [];
    Object.values(studentProgress.progressByTopic).forEach(subjectProgress => {
        Object.entries(subjectProgress).forEach(([topicId, topicData]) => { topicsWithScores.push({ topicId, score: topicData.score }); });
    });
    topicsWithScores.sort((a, b) => a.score - b.score);

    let prioritizedQuestions: Question[] = [];
    const usedQuestionIds = new Set<string>();
    for (const topic of topicsWithScores) {
        const questionsForTopic = allQuestionsWithContext.filter(q => q.topicId === topic.topicId && !usedQuestionIds.has(q.id));
        for (const question of shuffleArray(questionsForTopic)) {
            if (prioritizedQuestions.length < questionCount) {
                prioritizedQuestions.push(question);
                usedQuestionIds.add(question.id);
            } else break;
        }
        if (prioritizedQuestions.length >= questionCount) break;
    }

    if (prioritizedQuestions.length < questionCount) {
        const remainingQuestions = shuffleArray(allQuestionsWithContext.filter(q => !usedQuestionIds.has(q.id)));
        for (const question of remainingQuestions) {
            if (prioritizedQuestions.length < questionCount) {
                prioritizedQuestions.push(question);
                usedQuestionIds.add(question.id);
            } else break;
        }
    }
    // FIX: Safely slice the result to ensure it respects the question count.
    const finalStandardQuestions = shuffleArray(prioritizedQuestions);
    return finalStandardQuestions.slice(0, questionCount);
}

async function generateGlossaryChallenge(studentProgress: StudentProgress, subjects: Subject[]): Promise<Question[]> {
    const questionCount = studentProgress.glossaryChallengeQuestionCount || 5;
    
    let subjectsToConsider = subjects;
     if (studentProgress.glossaryChallengeMode === 'advanced' && studentProgress.advancedGlossarySubjectIds && studentProgress.advancedGlossarySubjectIds.length > 0) {
        const subjectIdSet = new Set(studentProgress.advancedGlossarySubjectIds);
        subjectsToConsider = subjects.filter(s => subjectIdSet.has(s.id));
    }

    let allTerms = subjectsToConsider.flatMap(s => 
        (s.topics || []).flatMap(t => [
            ...(t.glossary || []), 
            ...(t.subtopics || []).flatMap(st => st.glossary || [])
        ])
    );
    
    if (studentProgress.glossaryChallengeMode === 'advanced' && studentProgress.advancedGlossaryTopicIds && studentProgress.advancedGlossaryTopicIds.length > 0) {
        const topicIdSet = new Set(studentProgress.advancedGlossaryTopicIds);
        const termsWithContext = subjectsToConsider.flatMap(s => 
            (s.topics || []).flatMap(t => 
                (t.glossary || []).map(term => ({...term, topicId: t.id})).concat(
                    (t.subtopics || []).flatMap(st => (st.glossary || []).map(term => ({...term, topicId: st.id})))
                )
            )
        );
        allTerms = termsWithContext.filter(t => topicIdSet.has(t.topicId));
    }

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

async function generatePortugueseChallenge(studentProgress: StudentProgress): Promise<Question[]> {
    const questionCount = studentProgress.portugueseChallengeQuestionCount || 1;
    const errorStats = studentProgress.portugueseErrorStats;

    const errorFocusPrompt = errorStats ? `A partir das estatísticas de erro do aluno, foque nos tipos de erro mais comuns: ${JSON.stringify(errorStats)}.` : '';

    const prompt = `Aja como um professor de português criando uma questão de "identifique o erro". Gere ${questionCount} questão(ões) em JSON.
Crie uma questão **nova e diferente** das que você já gerou. A data de hoje é ${new Date().toISOString()} para garantir a exclusividade.
Para cada questão, siga estritamente o formato do exemplo. A resposta deve ser um array JSON.

Exemplo de formato para uma questão:
{
    "statement": "Faziam dois anos que ele não aparecia.",
    "options": ["Faziam", "dois anos", "que ele", "não", "aparecia."],
    "correctAnswer": "Faziam",
    "errorCategory": "Concordância Verbal",
    "justification": "O verbo 'fazer', indicando tempo, é impessoal e fica no singular: 'Fazia'."
}

${errorFocusPrompt}`;

    try {
        const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { 
                responseMimeType: 'application/json', 
                responseSchema: portugueseQuestionSchema,
                thinkingConfig: { thinkingBudget: 0 }
            }
        }));

        const generatedQuestions = parseJsonResponse<any[]>(response.text?.trim() ?? '', 'array');
        
        const questionsResult = generatedQuestions.map((q: any) => ({
            statement: q.statement, 
            options: q.options, 
            correctAnswer: q.correctAnswer,
            justification: q.justification, 
            errorCategory: q.errorCategory,
        }));
        
        return questionsResult.map((q, i) => ({ ...q, id: `port-challenge-${Date.now()}-${i}` }));

    } catch (e) {
        console.error("Failed to generate Portuguese challenge with Gemini:", e);
        return [];
    }
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
     if (!challengeType || !['review', 'glossary', 'portuguese'].includes(challengeType)) {
        return { statusCode: 400, body: 'Missing or invalid challengeType' };
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
        let challengeItems: Question[] = [];

        switch (challengeType) {
            case 'review':
                challengeItems = await generateReviewChallenge(studentProgress, subjects);
                break;
            case 'glossary':
                challengeItems = await generateGlossaryChallenge(studentProgress, subjects);
                break;
            case 'portuguese':
                challengeItems = await generatePortugueseChallenge(studentProgress);
                break;
        }

        return {
            statusCode: 200,
            body: JSON.stringify(challengeItems),
            headers: { 'Content-Type': 'application/json' },
        };

    } catch (error: any) {
        console.error(`Error generating ${challengeType} challenge for student ${studentId}:`, error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || 'An internal error occurred.' }),
        };
    }
};

export { handler };

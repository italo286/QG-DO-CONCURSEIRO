import { Handler, HandlerEvent } from '@netlify/functions';
import * as admin from 'firebase-admin';
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { StudentProgress, Subject, Course, Question, GlossaryTerm, Topic, SubTopic } from '../../src/types.server';

// --- Firebase Admin Initialization ---
let db: admin.firestore.Firestore;
try {
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  };

  if (!serviceAccount.projectId || !serviceAccount.privateKey || !serviceAccount.clientEmail) {
    throw new Error('Firebase Admin credentials (FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL) are not set in environment variables.');
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
  db = admin.firestore();
} catch (e: any) {
  console.error('FATAL: Firebase admin initialization failed:', e.message);
  // db will remain undefined, the handler will catch this and return a 500 error.
}


// --- Gemini API Initialization ---
const ai = new GoogleGenAI({apiKey: process.env.VITE_GEMINI_API_KEY});

// --- Schemas for Gemini ---
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
    const questionType = studentProgress.advancedReviewQuestionType || 'incorrect';

    // 1. Get all questions from all enrolled subjects, with context
    const allQuestionsWithContext: (Question & { subjectId: string; topicId: string; topicName: string, subjectName: string })[] = [];
    subjects.forEach(subject => {
        subject.topics.forEach(topic => {
            const addQuestions = (content: Topic | SubTopic, topicName: string) => {
                const questions = [...(content.questions || []), ...(content.tecQuestions || [])];
                questions.forEach(q => {
                    allQuestionsWithContext.push({
                        ...q,
                        subjectId: subject.id,
                        topicId: content.id,
                        topicName: topicName,
                        subjectName: subject.name
                    });
                });
            };
            addQuestions(topic, topic.name);
            topic.subtopics.forEach(subtopic => addQuestions(subtopic, `${topic.name} / ${subtopic.name}`));
        });
    });

    if (allQuestionsWithContext.length === 0) return [];

    // 2. Create sets of question IDs based on student's history
    const attemptedIds = new Set<string>();
    const correctIds = new Set<string>();
    const incorrectIds = new Set<string>();

    Object.values(studentProgress.progressByTopic).forEach(subjectProgress => {
        Object.values(subjectProgress).forEach(topicProgress => {
            (topicProgress.lastAttempt || []).forEach(attempt => {
                attemptedIds.add(attempt.questionId);
                if (attempt.isCorrect) {
                    correctIds.add(attempt.questionId);
                } else {
                    incorrectIds.add(attempt.questionId);
                }
            });
        });
    });
    (studentProgress.reviewSessions || []).forEach(session => {
        (session.attempts || []).forEach(attempt => {
            attemptedIds.add(attempt.questionId);
            if (attempt.isCorrect) {
                correctIds.add(attempt.questionId);
            } else {
                incorrectIds.add(attempt.questionId);
            }
        });
    });
    
    // 3. Identify weak topics (lowest scores) for prioritization
    const topicScores: { topicId: string; score: number }[] = [];
    Object.entries(studentProgress.progressByTopic).forEach(([, topics]) => {
        Object.entries(topics).forEach(([topicId, progress]) => {
            if (progress && typeof progress.score === 'number') {
                topicScores.push({ topicId, score: progress.score });
            }
        });
    });
    topicScores.sort((a, b) => a.score - b.score);
    const weakTopicIds = new Set(topicScores.map(t => t.topicId));

    // 4. Create pools of questions based on type and weakness
    const pools = {
        incorrect: allQuestionsWithContext.filter(q => incorrectIds.has(q.id)),
        unanswered: allQuestionsWithContext.filter(q => !attemptedIds.has(q.id)),
        correct: allQuestionsWithContext.filter(q => correctIds.has(q.id)),
        all: allQuestionsWithContext
    };

    // Prioritize questions from weak topics within each pool
    const prioritizeByWeakness = (pool: (typeof allQuestionsWithContext)) => {
        const weak = pool.filter(q => weakTopicIds.has(q.topicId));
        const other = pool.filter(q => !weakTopicIds.has(q.topicId));
        return shuffleArray([...weak, ...other]);
    };

    Object.keys(pools).forEach(key => {
        pools[key as keyof typeof pools] = prioritizeByWeakness(pools[key as keyof typeof pools]);
    });

    // 5. Build the final quiz
    const finalQuestions: Question[] = [];
    const usedIds = new Set<string>();

    const addQuestion = (q: Question) => {
        if (q && !usedIds.has(q.id)) {
            finalQuestions.push(q);
            usedIds.add(q.id);
        }
    };

    const fillFromPool = (pool: Question[]) => {
        for (const q of pool) {
            if (finalQuestions.length >= questionCount) break;
            addQuestion(q);
        }
    };
    
    // Determine the order of pools based on questionType
    if (questionType === 'incorrect') {
        fillFromPool(pools.incorrect);
        fillFromPool(pools.unanswered);
        fillFromPool(pools.all); // Fallback
    } else if (questionType === 'unanswered') {
        fillFromPool(pools.unanswered);
        fillFromPool(pools.incorrect);
        fillFromPool(pools.all); // Fallback
    } else if (questionType === 'correct') {
        fillFromPool(pools.correct);
        fillFromPool(pools.unanswered);
        fillFromPool(pools.incorrect);
        fillFromPool(pools.all); // Fallback
    } else { // mixed
        const mixedPool = shuffleArray([
            ...pools.incorrect,
            ...pools.unanswered.slice(0, pools.unanswered.length / 2), // Don't overwhelm with new questions
            ...pools.correct.slice(0, pools.correct.length / 4) // Few correct questions
        ]);
        fillFromPool(mixedPool);
        fillFromPool(pools.all); // Fallback
    }
    
    return finalQuestions.slice(0, questionCount);
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

    const definitionToTermMap = new Map(uniqueTerms.map(t => [t.definition, t.term]));
    const challengeQuestions: Question[] = [];
    const usedTerms = new Set<string>();

    for (let i = 0; i < questionCount && usedTerms.size < uniqueTerms.length; i++) {
        let term: GlossaryTerm;
        do {
            term = uniqueTerms[Math.floor(Math.random() * uniqueTerms.length)];
        } while (usedTerms.has(term.term));
        usedTerms.add(term.term);

        const correctAnswer = term.definition;
        const options = [correctAnswer];
        
        const otherDefinitions = uniqueTerms.filter(t => t.term !== term.term).map(t => t.definition);
        const shuffledOther = shuffleArray(otherDefinitions);

        for (let j = 0; j < 4 && j < shuffledOther.length; j++) {
            options.push(shuffledOther[j]);
        }
        
        const shuffledOptions = shuffleArray(options);

        const optionJustifications: { [optionText: string]: string } = {};
        shuffledOptions.forEach(option => {
            if (option === correctAnswer) {
                optionJustifications[option] = `Esta é a definição correta para o termo "${term.term}".`;
            } else {
                const correspondingTerm = definitionToTermMap.get(option);
                if (correspondingTerm) {
                    optionJustifications[option] = `Esta definição se refere ao termo "${correspondingTerm}", e não a "${term.term}".`;
                } else {
                    optionJustifications[option] = `Esta definição está incorreta para o termo "${term.term}".`;
                }
            }
        });

        challengeQuestions.push({
            id: `glossary-${Date.now()}-${i}`,
            statement: `Qual é a definição de "${term.term}"?`,
            options: shuffledOptions,
            correctAnswer: correctAnswer,
            justification: `"${term.term}" significa: ${term.definition}.`,
            optionJustifications: optionJustifications,
        });
    }

    return challengeQuestions;
};

async function generatePortugueseChallenge(studentProgress: StudentProgress): Promise<Question[]> {
    const questionCount = studentProgress.portugueseChallengeQuestionCount || 1;
    const errorStats = studentProgress.portugueseErrorStats;

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
    
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: questionSchema
        }
    });

    const rawQuestions = JSON.parse(response.text.trim());
    
    // Process questions to match the Question type, especially the optionJustifications
    return rawQuestions.map((q: any, index: number) => {
        const cleanedOptionJustifications: { [key: string]: string } = {};
        if (Array.isArray(q.optionJustifications)) {
            q.optionJustifications.forEach((item: { option: string; justification: string }) => {
                // Ensure the option from justification exists in the main options array
                if (item.option && item.justification && q.options.includes(item.option)) {
                    cleanedOptionJustifications[item.option] = item.justification;
                }
            });
        }

        return {
            id: `port-challenge-${Date.now()}-${index}`,
            statement: q.statement,
            options: q.options,
            correctAnswer: q.correctAnswer,
            justification: q.justification,
            optionJustifications: cleanedOptionJustifications,
            errorCategory: q.errorCategory,
        };
    });
}


// --- Main Handler ---

export const handler: Handler = async (event: HandlerEvent) => {
    // Fail fast if Firebase Admin SDK is not initialized
    if (!db) {
        console.error("Firestore database is not initialized. Check Firebase Admin credentials in Netlify environment variables.");
        return { 
            statusCode: 500, 
            body: 'Internal Server Error: Could not connect to the database. Check server logs for credential errors.' 
        };
    }

    const { apiKey, studentId, challengeType } = event.queryStringParameters || {};

    if (apiKey !== process.env.DAILY_CHALLENGE_API_KEY) {
        return { statusCode: 401, body: 'Unauthorized' };
    }
    
    if (!studentId || !challengeType) {
        return { statusCode: 400, body: 'Missing studentId or challengeType' };
    }

    try {
        const studentProgress = await getStudentProgress(studentId);
        if (!studentProgress) {
            return { statusCode: 404, body: `Student progress not found for ${studentId}`};
        }

        let questions: Question[] = [];

        if (challengeType === 'review' || challengeType === 'glossary') {
            const subjects = await getEnrolledSubjects(studentId);
            if (subjects.length === 0) {
                 return { statusCode: 200, body: JSON.stringify([]) };
            }
            if (challengeType === 'review') {
                questions = await generateReviewChallenge(studentProgress, subjects);
            } else { // glossary
                questions = generateGlossaryChallenge(studentProgress, subjects);
            }
        } else if (challengeType === 'portuguese') {
            questions = await generatePortugueseChallenge(studentProgress);
        } else {
             return { statusCode: 400, body: `Invalid challengeType: ${challengeType}` };
        }
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(questions)
        };
    } catch (error: any) {
        console.error("Error generating challenge:", {
            message: error.message,
            stack: error.stack,
            studentId,
            challengeType,
        });
        return { statusCode: 500, body: `Internal Server Error: ${error.message}` };
    }
};
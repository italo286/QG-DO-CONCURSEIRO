import { Handler } from "@netlify/functions";
import admin from "firebase-admin";
import { GoogleGenAI, Type } from "@google/genai";
import { Subject, StudentProgress, Question, DailyChallenge, GlossaryTerm, QuestionAttempt } from '../../src/types.server';

const {
    FIREBASE_PROJECT_ID,
    FIREBASE_PRIVATE_KEY,
    FIREBASE_CLIENT_EMAIL,
    GEMINI_API_KEY,
    VITE_GEMINI_API_KEY,
    DAILY_CHALLENGE_API_KEY,
} = process.env;

let servicesInitialized = false;
const initializeServices = () => {
    if (servicesInitialized) return;
    const requiredFirebaseVars = { FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL };
    for (const [key, value] of Object.entries(requiredFirebaseVars)) {
        if (!value) throw new Error(`FATAL: Missing required environment variable: ${key}`);
    }
    const geminiApiKey = GEMINI_API_KEY || VITE_GEMINI_API_KEY;
    if (!geminiApiKey) {
        throw new Error(`FATAL: Missing required environment variables: GEMINI_API_KEY or VITE_GEMINI_API_KEY`);
    }
    if (admin.apps.length === 0) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: FIREBASE_PROJECT_ID,
                privateKey: FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
                clientEmail: FIREBASE_CLIENT_EMAIL,
            }),
        });
    }
    servicesInitialized = true;
};

const shuffleArray = <T>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
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
        optionJustifications: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { option: { type: Type.STRING }, justification: { type: Type.STRING } },
            required: ["option", "justification"]
          }
        },
        errorCategory: { type: Type.STRING }
      },
      required: ["statement", "options", "correctAnswer", "justification", "errorCategory", "optionJustifications"],
    },
};

const generateReviewChallenge = async (progress: StudentProgress, allQuestionsWithContext: (Question & { subjectId: string, topicId: string })[]): Promise<Question[]> => {
    const reviewMode = progress.dailyReviewMode || 'standard';
    const reviewQuestionCount = progress.advancedReviewQuestionCount || 5;

    const topicAttempts = Object.values(progress.progressByTopic)
        .flatMap(subject => Object.values(subject).flatMap(topic => topic.lastAttempt));
    const reviewAttempts = (progress.reviewSessions || []).flatMap(session => session.attempts || []);
    const allAttempts = [...topicAttempts, ...reviewAttempts];

    const attemptedIds = new Set(allAttempts.map(a => a.questionId));
    const correctIds = new Set(allAttempts.filter(a => a.isCorrect).map(a => a.questionId));
    const incorrectIds = new Set(Array.from(attemptedIds).filter(id => !correctIds.has(id)));

    let candidateQuestions = allQuestionsWithContext;
    if (reviewMode === 'advanced' && progress.advancedReviewSubjectIds?.length) {
        const subjectIdSet = new Set(progress.advancedReviewSubjectIds);
        candidateQuestions = candidateQuestions.filter(q => subjectIdSet.has(q.subjectId));
        if (progress.advancedReviewTopicIds?.length) {
            const topicIdSet = new Set(progress.advancedReviewTopicIds);
            candidateQuestions = candidateQuestions.filter(q => topicIdSet.has(q.topicId));
        }
    }

    const questionType = progress.advancedReviewQuestionType || 'incorrect';
    if (questionType !== 'mixed') {
        candidateQuestions = candidateQuestions.filter(q => {
            if (questionType === 'incorrect') return incorrectIds.has(q.id);
            if (questionType === 'correct') return correctIds.has(q.id);
            if (questionType === 'unanswered') return !attemptedIds.has(q.id);
            return false;
        });
    }
    
    return shuffleArray(candidateQuestions).slice(0, reviewQuestionCount);
};

const generateGlossaryChallenge = async (progress: StudentProgress, allSubjects: Subject[]): Promise<Question[]> => {
    const glossaryMode = progress.glossaryChallengeMode || 'standard';
    const glossaryQuestionCount = progress.glossaryChallengeQuestionCount || 5;
    const dateISO = new Date().toISOString().split('T')[0];
    
    const allGlossaryTermsWithContext = allSubjects.flatMap(subject =>
        subject.topics.flatMap(topic => [
            ...(topic.glossary || []).map(term => ({ ...term, subjectId: subject.id, topicId: topic.id })),
            ...topic.subtopics.flatMap(subtopic =>
                (subtopic.glossary || []).map(term => ({ ...term, subjectId: subject.id, topicId: subtopic.id }))
            )
        ])
    );

    let candidateTerms = allGlossaryTermsWithContext;
    if (glossaryMode === 'advanced' && progress.advancedGlossarySubjectIds?.length) {
        const subjectIdSet = new Set(progress.advancedGlossarySubjectIds);
        candidateTerms = candidateTerms.filter(term => subjectIdSet.has(term.subjectId));
        if (progress.advancedGlossaryTopicIds?.length) {
            const topicIdSet = new Set(progress.advancedGlossaryTopicIds);
            candidateTerms = candidateTerms.filter(term => topicIdSet.has(term.topicId));
        }
    }

    const uniqueTerms = Array.from(new Map(candidateTerms.map(item => [item.term, item])).values());
    if (uniqueTerms.length < 4) return [];

    const selectedTerms = shuffleArray(uniqueTerms).slice(0, glossaryQuestionCount);
    return selectedTerms.map((term, index) => {
        const correctAnswer = term.definition;
        const wrongDefinitions = shuffleArray(uniqueTerms.filter(t => t.term !== term.term)).slice(0, 4).map(t => t.definition);
        const options = shuffleArray([correctAnswer, ...wrongDefinitions]);
        return {
            id: `glossary-challenge-${dateISO}-${index}`,
            statement: `Qual a definição de "${term.term}"?`,
            options,
            correctAnswer,
            justification: `"${term.term}" significa: ${term.definition}`
        };
    });
};

const generatePortugueseChallenge = async (progress: StudentProgress, ai: GoogleGenAI): Promise<Question[]> => {
    const ptQuestionCount = progress.portugueseChallengeQuestionCount || 1;
    const dateISO = new Date().toISOString().split('T')[0];
    const ptPrompt = `Crie ${ptQuestionCount} questão(ões) para um desafio de gramática da língua portuguesa no seguinte formato:
1. A questão é uma única frase que contém um erro gramatical sutil (concordância, regência, crase, pontuação, etc.).
2. A frase deve ser dividida em 5 partes (alternativas). O enunciado ('statement') deve ser a frase completa.
3. A alternativa correta ('correctAnswer') é o trecho que contém o erro.
4. Para cada questão, inclua uma 'errorCategory' que classifique o erro (ex: 'Crase', 'Concordância Verbal').
5. Forneça uma 'justification' geral explicando o erro e como corrigi-lo.
6. Forneça um array 'optionJustifications' com uma justificativa para CADA alternativa.

Retorne a(s) questão(ões) como um array de objetos JSON, seguindo estritamente o schema.`;

    const ptResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: ptPrompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: questionSchema,
            thinkingConfig: { thinkingBudget: 0 }
        }
    });

    let parsedQuestions: Question[] = [];
    if (ptResponse.text) {
        try {
            const parsedData = JSON.parse(ptResponse.text.trim());
            if (Array.isArray(parsedData)) parsedQuestions = parsedData;
            else if (typeof parsedData === 'object' && parsedData !== null) parsedQuestions = [parsedData];
        } catch (e) { console.error(`[PARSE_ERROR] PT Generation:`, e); }
    }
    return parsedQuestions.map((q, i) => ({ ...q, id: `port-challenge-${dateISO}-${i}` }));
};

export const handler: Handler = async (event) => {
    try {
        initializeServices();
        const { studentId, challengeType } = event.queryStringParameters || {};
        const secretKey = DAILY_CHALLENGE_API_KEY;
        if (!secretKey) throw new Error("Server configuration error: Missing trigger secret key.");
        if (event.queryStringParameters?.apiKey !== secretKey) {
            return { statusCode: 401, body: "Unauthorized" };
        }
        if (!studentId || !challengeType) {
            return { statusCode: 400, body: "Missing studentId or challengeType" };
        }

        const db = admin.firestore();
        const geminiApiKey = GEMINI_API_KEY || VITE_GEMINI_API_KEY;
        const ai = new GoogleGenAI({ apiKey: geminiApiKey! });

        const progressDoc = await db.collection('studentProgress').doc(studentId).get();
        if (!progressDoc.exists) {
            return { statusCode: 404, body: "Student progress not found" };
        }
        const progress = progressDoc.data() as StudentProgress;

        let items: Question[] = [];

        switch (challengeType) {
            case 'review': {
                const subjectsSnapshot = await db.collection('subjects').get();
                const allSubjects = subjectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
                const allQuestionsWithContext = allSubjects.flatMap(subject =>
                    subject.topics.flatMap(topic => [
                        ...topic.questions.map(q => ({ ...q, subjectId: subject.id, topicId: topic.id })),
                        ...(topic.tecQuestions || []).map(q => ({ ...q, subjectId: subject.id, topicId: topic.id })),
                        ...topic.subtopics.flatMap(st => [
                            ...st.questions.map(q => ({ ...q, subjectId: subject.id, topicId: st.id })),
                            ...(st.tecQuestions || []).map(q => ({ ...q, subjectId: subject.id, topicId: st.id })),
                        ])
                    ])
                );
                items = await generateReviewChallenge(progress, allQuestionsWithContext);
                break;
            }
            case 'glossary': {
                const subjectsSnapshot = await db.collection('subjects').get();
                const allSubjects = subjectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
                items = await generateGlossaryChallenge(progress, allSubjects);
                break;
            }
            case 'portuguese': {
                items = await generatePortugueseChallenge(progress, ai);
                break;
            }
            default:
                return { statusCode: 400, body: "Invalid challengeType" };
        }

        return {
            statusCode: 200,
            body: JSON.stringify(items),
            headers: { 'Content-Type': 'application/json' }
        };

    } catch (error: any) {
        console.error("[FATAL_HANDLER_ERROR]", { message: error.message, stack: error.stack });
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};

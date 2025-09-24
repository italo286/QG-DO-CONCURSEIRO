
import { Handler, HandlerEvent } from "@netlify/functions";
import * as admin from "firebase-admin";
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { StudentProgress, Subject, Question, Course, GlossaryTerm, QuestionAttempt } from "../../src/types.server";

// Initialize Firebase Admin SDK
try {
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "{}");
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
} catch (e) {
  console.error('Firebase admin initialization error', e);
}
const db = admin.firestore();

// Initialize Gemini AI
const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY!});

// Helper to shuffle arrays
const shuffleArray = <T>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

const getEnrolledSubjects = async (studentId: string): Promise<Subject[]> => {
    const coursesQuery = db.collection("courses").where("enrolledStudentIds", "array-contains", studentId);
    const coursesSnap = await coursesQuery.get();
    if (coursesSnap.empty) return [];

    const courses = coursesSnap.docs.map(doc => doc.data() as Course);
    // FIX: Replaced `flatMap` with `reduce` to ensure correct type inference for `allSubjectIds` as `string[]`, resolving a TypeScript error where it was being inferred as `unknown[]`.
    const allSubjectIds = [...new Set(courses.reduce((acc, c) => acc.concat((c.disciplines || []).map(d => d.subjectId)), [] as string[]))];
    
    if (allSubjectIds.length === 0) return [];
    
    const chunks: string[][] = [];
    for (let i = 0; i < allSubjectIds.length; i += 10) {
        chunks.push(allSubjectIds.slice(i, i + 10));
    }

    const subjectPromises = chunks.map(chunk => 
        db.collection("subjects").where(admin.firestore.FieldPath.documentId(), "in", chunk).get()
    );

    const subjectSnapshots = await Promise.all(subjectPromises);
    return subjectSnapshots.flatMap(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
};

// --- Challenge Generation Logic ---

const generateReviewChallenge = async (studentProgress: StudentProgress, allSubjects: Subject[]): Promise<Question[]> => {
    const settings = {
        mode: studentProgress.dailyReviewMode || 'standard',
        subjectIds: studentProgress.advancedReviewSubjectIds || [],
        topicIds: studentProgress.advancedReviewTopicIds || [],
        questionType: studentProgress.advancedReviewQuestionType || 'incorrect',
        questionCount: studentProgress.advancedReviewQuestionCount || 5
    };

    const allQuestionsWithContext: (Question & { subjectId: string, topicId: string })[] = allSubjects.flatMap(subject =>
        subject.topics.flatMap(topic => [
            ...topic.questions.map(q => ({ ...q, subjectId: subject.id, topicId: topic.id })),
            ...(topic.tecQuestions || []).map(q => ({ ...q, subjectId: subject.id, topicId: topic.id })),
            ...topic.subtopics.flatMap(st => [
                ...st.questions.map(q => ({ ...q, subjectId: subject.id, topicId: st.id })),
                ...(st.tecQuestions || []).map(q => ({ ...q, subjectId: subject.id, topicId: st.id })),
            ])
        ])
    );
    
    let questionPool = allQuestionsWithContext;
    if (settings.mode === 'advanced') {
        if (settings.subjectIds.length > 0) {
            const subjectIdSet = new Set(settings.subjectIds);
            questionPool = questionPool.filter(q => subjectIdSet.has(q.subjectId));
        }
        if (settings.topicIds.length > 0) {
            const topicIdSet = new Set(settings.topicIds);
            questionPool = questionPool.filter(q => topicIdSet.has(q.topicId));
        }
    }
    
    const allAttempts = [
        ...Object.values(studentProgress.progressByTopic).flatMap(s => Object.values(s).flatMap(t => t.lastAttempt)),
        ...(studentProgress.reviewSessions || []).flatMap(r => r.attempts || [])
    ];
    const attemptedIds = new Set(allAttempts.map(a => a.questionId));
    const correctIds = new Set(allAttempts.filter(a => a.isCorrect).map(a => a.questionId));
    const incorrectIds = new Set(allAttempts.filter(a => !a.isCorrect).map(a => a.questionId));

    let finalPool: Question[];
    switch (settings.questionType) {
        case 'correct': finalPool = questionPool.filter(q => correctIds.has(q.id)); break;
        case 'unanswered': finalPool = questionPool.filter(q => !attemptedIds.has(q.id)); break;
        case 'mixed': finalPool = questionPool; break;
        case 'incorrect':
        default: finalPool = questionPool.filter(q => incorrectIds.has(q.id)); break;
    }

    return shuffleArray(finalPool).slice(0, settings.questionCount);
};

const generateGlossaryChallenge = async (studentProgress: StudentProgress, allSubjects: Subject[]): Promise<Question[]> => {
    const settings = {
        mode: studentProgress.glossaryChallengeMode || 'standard',
        subjectIds: studentProgress.advancedGlossarySubjectIds || [],
        topicIds: studentProgress.advancedGlossaryTopicIds || [],
        questionCount: studentProgress.glossaryChallengeQuestionCount || 5
    };
    
    const allGlossaryTermsWithContext: (GlossaryTerm & { subjectId: string, topicId: string })[] = allSubjects.flatMap(subject =>
        subject.topics.flatMap(topic => [
            ...(topic.glossary || []).map(g => ({...g, subjectId: subject.id, topicId: topic.id})),
            ...topic.subtopics.flatMap(st => (st.glossary || []).map(g => ({...g, subjectId: subject.id, topicId: st.id})))
        ])
    );

    let termPool = allGlossaryTermsWithContext;
    if (settings.mode === 'advanced') {
        if (settings.subjectIds.length > 0) {
            const subjectIdSet = new Set(settings.subjectIds);
            termPool = termPool.filter(t => subjectIdSet.has(t.subjectId));
        }
        if (settings.topicIds.length > 0) {
            const topicIdSet = new Set(settings.topicIds);
            termPool = termPool.filter(t => topicIdSet.has(t.topicId));
        }
    }

    if (termPool.length < 5) return [];

    const selectedTerms = shuffleArray(termPool).slice(0, settings.questionCount);
    
    return selectedTerms.map(term => {
        const otherTerms = shuffleArray(termPool.filter(t => t.term !== term.term)).slice(0, 4);
        const options = shuffleArray([term.term, ...otherTerms.map(t => t.term)]);
        return {
            id: `glossary-${Date.now()}-${Math.random()}`,
            statement: `Qual termo corresponde à seguinte definição: "${term.definition}"?`,
            options,
            correctAnswer: term.term,
            justification: `A definição se refere a "${term.term}".`
        };
    });
};

const generatePortugueseChallenge = async (studentProgress: StudentProgress): Promise<Question[]> => {
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
                        required: ["option", "justification"],
                    }
                },
                errorCategory: { type: Type.STRING }
            },
            required: ["statement", "options", "correctAnswer", "justification", "optionJustifications", "errorCategory"],
        },
    };

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: questionSchema
        }
    });

    const parsed = JSON.parse(response.text.trim() ?? '[]');
    return parsed.map((q: any) => ({
        ...q,
        id: `port-challenge-${Date.now()}-${Math.random()}`
    }));
};

// Main handler
const handler: Handler = async (event: HandlerEvent) => {
    const { apiKey, studentId, challengeType } = event.queryStringParameters || {};

    if (apiKey !== process.env.DAILY_CHALLENGE_API_KEY) {
        return { statusCode: 401, body: "Unauthorized" };
    }
    if (!studentId || !challengeType) {
        return { statusCode: 400, body: "Missing studentId or challengeType" };
    }

    try {
        const progressDoc = await db.collection("studentProgress").doc(studentId).get();
        if (!progressDoc.exists) {
            return { statusCode: 404, body: "Student progress not found" };
        }
        const studentProgress = progressDoc.data() as StudentProgress;
        
        const allSubjects = await getEnrolledSubjects(studentId);

        let items: Question[] = [];

        switch (challengeType) {
            case "review":
                items = await generateReviewChallenge(studentProgress, allSubjects);
                break;
            case "glossary":
                items = await generateGlossaryChallenge(studentProgress, allSubjects);
                break;
            case "portuguese":
                items = await generatePortugueseChallenge(studentProgress);
                break;
            default:
                return { statusCode: 400, body: "Invalid challenge type" };
        }

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(items),
        };
    } catch (error: any) {
        console.error(`Error generating ${challengeType} challenge for ${studentId}:`, error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to generate challenge.", details: error.message }),
        };
    }
};

export { handler };

import { Handler, HandlerEvent } from '@netlify/functions';
import * as admin from 'firebase-admin';
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { StudentProgress, Subject, Course, Question, GlossaryTerm } from '../../src/types.server';

// --- Firebase Admin Initialization ---
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            }),
        });
    } catch (e) {
        console.error('Firebase admin initialization error', e);
    }
}
const db = admin.firestore();

// --- Gemini API Initialization ---
const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});

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

    const questionBank: (Question & {subjectName: string, topicName: string})[] = [];
    subjects.forEach(subject => {
        subject.topics.forEach(topic => {
            topic.questions.forEach(question => questionBank.push({ ...question, subjectName: subject.name, topicName: topic.name }));
            topic.subtopics.forEach(subtopic => {
                subtopic.questions.forEach(question => questionBank.push({ ...question, subjectName: subject.name, topicName: subtopic.name }));
            })
        });
    });
    
    if (questionBank.length === 0) return [];

    const prompt = `
        Você é um tutor de IA especialista em preparação para concursos. Sua tarefa é criar uma sessão de revisão inteligente e personalizada para um aluno.
        Abaixo estão dois blocos de dados em JSON:
        1. 'studentProgress': Contém o histórico de desempenho do aluno, incluindo pontuações por tópico. Um score baixo (menor que 0.7) indica dificuldade.
        2. 'questionBank': Uma lista completa de todas as questões disponíveis.

        Analise o 'studentProgress' para identificar os tópicos onde o aluno tem maior dificuldade. Com base nessa análise, selecione um conjunto de ${questionCount} questões do 'questionBank' que reforcem esses pontos fracos. Priorize questões dos tópicos com piores scores.
        Retorne um array JSON contendo APENAS os ${questionCount} objetos de questão selecionados, seguindo estritamente o schema fornecido.

        ### DADOS ###
        'studentProgress': ${JSON.stringify(studentProgress)}
        'questionBank': ${JSON.stringify(questionBank)}
    `;

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: questionSchema,
        }
    });
    
    const reviewQuestions = JSON.parse(response.text.trim());
    return reviewQuestions as Question[];
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
        
        challengeQuestions.push({
            id: `glossary-${Date.now()}-${i}`,
            statement: `Qual é a definição de "${term.term}"?`,
            options: shuffleArray(options),
            correctAnswer: correctAnswer,
            justification: `"${term.term}" significa: ${term.definition}.`
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

    const generatedQuestions = JSON.parse(response.text.trim());
    return generatedQuestions as Question[];
}


// --- Main Handler ---

export const handler: Handler = async (event: HandlerEvent) => {
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

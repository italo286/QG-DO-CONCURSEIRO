import { Handler } from '@netlify/functions';
import * as admin from 'firebase-admin';
import { GoogleGenAI } from "@google/genai";
import { Question, StudentProgress, Subject, DailyChallenge, GlossaryTerm } from '../../src/types';

// Initialize Firebase Admin only once
if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
    });
}
const db = admin.firestore();

// Initialize Gemini
if (!process.env.VITE_GEMINI_API_KEY) {
    throw new Error("Gemini API key is missing in environment variables.");
}
const ai = new GoogleGenAI({ apiKey: process.env.VITE_GEMINI_API_KEY });

// --- Helper Functions ---

const getBrasiliaDateISO = (): string => {
    const now = new Date();
    // Brasilia is UTC-3
    now.setHours(now.getHours() - 3);
    return now.toISOString().split('T')[0];
};

const shuffleArray = <T>(array: T[]): T[] => {
    if(!array) return [];
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

const questionSchema = {
    type: "ARRAY",
    items: {
      type: "OBJECT",
      properties: {
        statement: { type: "STRING" },
        options: { type: "ARRAY", items: { type: "STRING" } },
        correctAnswer: { type: "STRING" },
        justification: { type: "STRING" },
        optionJustifications: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
                option: { type: "STRING" },
                justification: { type: "STRING" },
            },
            required: ["option", "justification"]
          }
        },
        errorCategory: { type: "STRING" }
      },
      required: ["statement", "options", "correctAnswer", "justification"],
    },
};

const generatePortugueseChallengeQuestions = async (
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
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: questionSchema
        }
    });

    const parsed = JSON.parse(response.text.trim());
    if (Array.isArray(parsed)) {
        return parsed as Omit<Question, 'id'>[];
    }
    return [];
};


// --- Netlify Function Handler ---

export const handler: Handler = async (event) => {
    // Security check
    if (event.headers['x-api-key'] !== process.env.DAILY_CHALLENGE_API_KEY) {
        return { statusCode: 401, body: 'Unauthorized' };
    }

    try {
        const todayISO = getBrasiliaDateISO();
        console.log(`Starting daily challenge generation for ${todayISO}`);

        // 1. Fetch data
        const subjectsSnap = await db.collection('subjects').get();
        const allSubjects = subjectsSnap.docs.map(doc => doc.data() as Subject);
        
        const allQuestions: Question[] = [];
        const allGlossaryTerms: GlossaryTerm[] = [];
        allSubjects.forEach(subject => {
            subject.topics.forEach(topic => {
                allQuestions.push(...(topic.questions || []));
                if(topic.glossary) allGlossaryTerms.push(...topic.glossary);
                topic.subtopics.forEach(subtopic => {
                    allQuestions.push(...(subtopic.questions || []));
                    if(subtopic.glossary) allGlossaryTerms.push(...subtopic.glossary);
                });
            });
        });

        // 2. Process each student
        const studentsSnap = await db.collection('users').where('role', '==', 'aluno').get();
        for (const studentDoc of studentsSnap.docs) {
            const studentId = studentDoc.id;
            const progressSnap = await db.collection('studentProgress').doc(studentId).get();
            if (!progressSnap.exists) continue;
            
            const progress = progressSnap.data() as StudentProgress;
            const updatedProgress = { ...progress };
            let hasChanges = false;
            
            // Generate Review Challenge
            if (!progress.reviewChallenge || progress.reviewChallenge.date !== todayISO) {
                const qCount = progress.advancedReviewQuestionCount || 5;
                const reviewQuestions = shuffleArray(allQuestions).slice(0, qCount);
                if (reviewQuestions.length > 0) {
                    updatedProgress.reviewChallenge = {
                        date: todayISO, items: reviewQuestions, isCompleted: false, attemptsMade: 0,
                    };
                    hasChanges = true;
                }
            }

            // Generate Glossary Challenge
            if (!progress.glossaryChallenge || progress.glossaryChallenge.date !== todayISO) {
                const qCount = progress.glossaryChallengeQuestionCount || 5;
                const glossaryItems = shuffleArray(allGlossaryTerms);
                const glossaryQuestions: Question[] = [];

                for (let i = 0; i < Math.min(qCount, glossaryItems.length); i++) {
                    const term = glossaryItems[i];
                    const incorrectOptions = shuffleArray(glossaryItems.filter(g => g.term !== term.term)).slice(0, 4).map(g => g.definition);
                    if(incorrectOptions.length < 4) continue;
                    glossaryQuestions.push({
                        id: `glossary-${todayISO}-${i}`,
                        statement: `Qual a definição de "${term.term}"?`,
                        options: shuffleArray([term.definition, ...incorrectOptions]),
                        correctAnswer: term.definition,
                        justification: `"${term.term}" significa: ${term.definition}.`
                    });
                }
                if (glossaryQuestions.length > 0) {
                    updatedProgress.glossaryChallenge = {
                        date: todayISO, items: glossaryQuestions, isCompleted: false, attemptsMade: 0
                    };
                    hasChanges = true;
                }
            }
            
            // Generate Portuguese Challenge
            if (!progress.portugueseChallenge || progress.portugueseChallenge.date !== todayISO) {
                 const qCount = progress.portugueseChallengeQuestionCount || 5;
                 try {
                     const questions = await generatePortugueseChallengeQuestions(qCount, progress.portugueseErrorStats);
                     if (questions.length > 0) {
                         updatedProgress.portugueseChallenge = {
                            date: todayISO,
                            items: questions.map(q => ({...q, id: `port-${todayISO}-${Math.random()}`})),
                            isCompleted: false,
                            attemptsMade: 0
                         };
                         hasChanges = true;
                     }
                 } catch (e) {
                     console.error(`Failed to generate Portuguese challenge for ${studentId}:`, e);
                 }
            }
            
            if (hasChanges) {
                await db.collection('studentProgress').doc(studentId).set(updatedProgress, { merge: true });
                console.log(`Generated challenges for student ${studentId}`);
            }
        }

        return { statusCode: 200, body: JSON.stringify({ message: "Success" }) };
    } catch (error: any) {
        console.error("Error generating daily challenges:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
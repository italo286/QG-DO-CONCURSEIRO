import { Handler } from '@netlify/functions';
import * as admin from 'firebase-admin';
import { GoogleGenAI, Type } from "@google/genai";
import { Question, StudentProgress, Subject, DailyChallenge, GlossaryTerm } from '../../src/types';

// --- Helper Functions ---

const getBrasiliaDateISO = (): string => {
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
    const year = utcDate.getUTCFullYear();
    const month = (utcDate.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = utcDate.getUTCDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
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

const generatePortugueseChallengeQuestions = async (
    ai: GoogleGenAI,
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

export const handler: Handler = async () => {
    console.log("Handler da função 'generateDailyChallenges' iniciado.");

    try {
        // 1. Initialize Firebase Admin
        if (admin.apps.length === 0) {
            console.log("Inicializando Firebase Admin...");
            const privateKey = process.env.FIREBASE_PRIVATE_KEY;
            if (!process.env.FIREBASE_PROJECT_ID || !privateKey || !process.env.FIREBASE_CLIENT_EMAIL) {
                console.error("ERRO: Variáveis de ambiente do Firebase ausentes!");
                throw new Error("Credenciais do Firebase ausentes nas variáveis de ambiente.");
            }
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    privateKey: privateKey.replace(/\\n/g, '\n'),
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                }),
            });
            console.log("Firebase Admin inicializado com sucesso.");
        }
        const db = admin.firestore();

        // 2. Initialize Gemini
        console.log("Inicializando Gemini AI...");
        const geminiApiKey = process.env.VITE_GEMINI_API_KEY;
        if (!geminiApiKey) {
            console.error("ERRO: Chave da API do Gemini ausente!");
            throw new Error("Chave da API do Gemini ausente nas variáveis de ambiente.");
        }
        const ai = new GoogleGenAI({ apiKey: geminiApiKey });
        console.log("Gemini AI inicializado com sucesso.");
        
        const todayISO = getBrasiliaDateISO();
        console.log(`Iniciando geração de desafios diários para ${todayISO}`);

        // 3. Fetch data
        console.log("Buscando disciplinas (subjects) do Firestore...");
        const subjectsSnap = await db.collection('subjects').get();
        console.log(`Encontradas ${subjectsSnap.docs.length} disciplinas.`);
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
        console.log(`Total de ${allQuestions.length} questões e ${allGlossaryTerms.length} termos de glossário carregados.`);

        // 4. Process each student
        console.log("Buscando todos os alunos...");
        const studentsSnap = await db.collection('users').where('role', '==', 'aluno').get();
        console.log(`Encontrados ${studentsSnap.docs.length} alunos para processar.`);

        for (const studentDoc of studentsSnap.docs) {
            const studentId = studentDoc.id;
            console.log(`--- Processando aluno: ${studentId} ---`);
            const progressSnap = await db.collection('studentProgress').doc(studentId).get();
            if (!progressSnap.exists) {
                console.log(`Progresso não encontrado para o aluno ${studentId}. Pulando.`);
                continue;
            }
            
            const progress = progressSnap.data() as StudentProgress;
            const updatedProgress = { ...progress };
            let hasChanges = false;
            
            // Generate Review Challenge
            if (!progress.reviewChallenge || progress.reviewChallenge.date !== todayISO) {
                console.log(`Gerando Desafio da Revisão para ${studentId}...`);
                const qCount = progress.advancedReviewQuestionCount || 5;
                const reviewQuestions = shuffleArray(allQuestions).slice(0, qCount);
                if (reviewQuestions.length > 0) {
                    updatedProgress.reviewChallenge = {
                        date: todayISO, generatedForDate: todayISO, items: reviewQuestions, isCompleted: false, attemptsMade: 0,
                    };
                    hasChanges = true;
                }
            }

            // Generate Glossary Challenge
            if (!progress.glossaryChallenge || progress.glossaryChallenge.date !== todayISO) {
                console.log(`Gerando Desafio do Glossário para ${studentId}...`);
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
                        date: todayISO, generatedForDate: todayISO, items: glossaryQuestions, isCompleted: false, attemptsMade: 0
                    };
                    hasChanges = true;
                }
            }
            
            // Generate Portuguese Challenge
            if (!progress.portugueseChallenge || progress.portugueseChallenge.date !== todayISO) {
                 console.log(`Gerando Desafio de Português para ${studentId}...`);
                 const qCount = progress.portugueseChallengeQuestionCount || 1;
                 try {
                     const questions = await generatePortugueseChallengeQuestions(ai, qCount, progress.portugueseErrorStats);
                     if (questions.length > 0) {
                         updatedProgress.portugueseChallenge = {
                            date: todayISO,
                            generatedForDate: todayISO,
                            items: questions.map(q => ({...q, id: `port-${todayISO}-${Math.random()}`})),
                            isCompleted: false,
                            attemptsMade: 0
                         };
                         hasChanges = true;
                     }
                 } catch (e) {
                     console.error(`Falha ao gerar Desafio de Português para ${studentId}:`, e);
                 }
            }
            
            if (hasChanges) {
                await db.collection('studentProgress').doc(studentId).set(updatedProgress, { merge: true });
                console.log(`Desafios gerados e salvos para o aluno ${studentId}`);
            } else {
                 console.log(`Nenhum novo desafio necessário para o aluno ${studentId}`);
            }
        }

        console.log("Geração de desafios diários concluída com sucesso.");
        return { statusCode: 200, body: JSON.stringify({ message: "Success" }) };

    } catch (error: any) {
        console.error("!!! ERRO FATAL NA FUNÇÃO generateDailyChallenges !!!");
        console.error("Mensagem do Erro:", error.message);
        console.error("Stack do Erro:", error.stack);
        console.error("Objeto Completo do Erro:", JSON.stringify(error, null, 2));
        
        return { 
            statusCode: 500, 
            body: JSON.stringify({ 
                error: "Ocorreu um erro interno no servidor.",
                message: error.message,
                stack: error.stack 
            }) 
        };
    }
};

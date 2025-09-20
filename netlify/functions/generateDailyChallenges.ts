import { Handler, HandlerEvent } from '@netlify/functions';
// FIX: Statically import GoogleGenAI and Type to make them available in module scope for type annotations and schema definitions.
import { GoogleGenAI, Type } from "@google/genai";
import { Question, StudentProgress, Subject, DailyChallenge, GlossaryTerm, QuestionAttempt } from '../../src/types.server';

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

const shuffleArray = <T,>(array: T[]): T[] => {
    if(!array) return [];
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

// --- Netlify Function Handler ---

export const handler: Handler = async (event: HandlerEvent) => {
    try {
        console.log("HANDLER INICIADO: Função 'generateDailyChallenges' acionada.");
        
        // --- DYNAMIC IMPORTS & INITIALIZATION ---
        console.log("Importando dependências dinamicamente...");
        const admin = await import('firebase-admin');
        console.log("Dependências importadas. Inicializando serviços...");
        
        // 1. Initialize Firebase Admin
        if (admin.apps.length === 0) {
            const privateKey = process.env.FIREBASE_PRIVATE_KEY;
            if (!process.env.FIREBASE_PROJECT_ID || !privateKey || !process.env.FIREBASE_CLIENT_EMAIL) {
                throw new Error("Credenciais do Firebase ausentes nas variáveis de ambiente.");
            }
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    privateKey: privateKey.replace(/\\n/g, '\n'),
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                }),
            });
            console.log("Firebase Admin inicializado.");
        }
        const db = admin.firestore();

        // 2. Initialize Gemini
        const geminiApiKey = process.env.VITE_GEMINI_API_KEY;
        if (!geminiApiKey) {
            throw new Error("Chave da API do Gemini (VITE_GEMINI_API_KEY) ausente.");
        }
        const ai = new GoogleGenAI({ apiKey: geminiApiKey });
        console.log("Gemini AI inicializado.");

        // --- AUTHENTICATION (for manual trigger) ---
        if (event.httpMethod === 'GET') {
            console.log("Acionamento manual (GET) detectado. Verificando a chave da API...");
            if (event.queryStringParameters?.apiKey !== process.env.DAILY_CHALLENGE_API_KEY) {
                console.error("ERRO: Tentativa de acionamento manual com chave da API inválida ou ausente.");
                return { statusCode: 401, body: JSON.stringify({ error: "Não autorizado." }) };
            }
            console.log("Chave da API validada com sucesso.");
        } else {
            console.log("Acionamento agendado detectado.");
        }
        
        // --- CORE LOGIC ---
        const todayISO = getBrasiliaDateISO();
        console.log(`Iniciando geração de desafios diários para ${todayISO}`);

        console.log("Buscando disciplinas (subjects) do Firestore...");
        const subjectsSnap = await db.collection('subjects').get();
        console.log(`Encontradas ${subjectsSnap.docs.length} disciplinas.`);
        const allSubjects = subjectsSnap.docs.map(doc => doc.data() as Subject);
        
        const allQuestions: Question[] = [];
        const allGlossaryTerms: GlossaryTerm[] = [];

        (allSubjects || []).forEach(subject => {
            if (!subject || !Array.isArray(subject.topics)) return;
            subject.topics.forEach(topic => {
                if (!topic) return;
                allQuestions.push(...(topic.questions || []));
                allQuestions.push(...(topic.tecQuestions || []));
                allGlossaryTerms.push(...(topic.glossary || []));
                if (!Array.isArray(topic.subtopics)) return;
                topic.subtopics.forEach(subtopic => {
                    if (!subtopic) return;
                    allQuestions.push(...(subtopic.questions || []));
                    allQuestions.push(...(subtopic.tecQuestions || []));
                    allGlossaryTerms.push(...(subtopic.glossary || []));
                });
            });
        });

        const validQuestions = allQuestions.filter(q => q && q.id && q.statement && q.options && q.correctAnswer);
        const validGlossaryTerms = allGlossaryTerms.filter(g => g && g.term && g.definition);
        
        console.log(`Total de ${validQuestions.length} questões válidas e ${validGlossaryTerms.length} termos de glossário válidos carregados.`);

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
                const allAttempts: QuestionAttempt[] = [];
                if (progress.progressByTopic) {
                    Object.values(progress.progressByTopic).forEach(subjectProgress => {
                        Object.values(subjectProgress).forEach(topicProgress => {
                            if (topicProgress.lastAttempt) allAttempts.push(...topicProgress.lastAttempt);
                        });
                    });
                }
                const incorrectQuestionIds = new Set(allAttempts.filter(a => !a.isCorrect).map(a => a.questionId));
                const incorrectQuestions = validQuestions.filter(q => incorrectQuestionIds.has(q.id));
                const otherQuestions = validQuestions.filter(q => !incorrectQuestionIds.has(q.id));
                let reviewQuestions = shuffleArray(incorrectQuestions);
                if (reviewQuestions.length < qCount) {
                    reviewQuestions.push(...shuffleArray(otherQuestions).slice(0, qCount - reviewQuestions.length));
                }
                reviewQuestions = reviewQuestions.slice(0, qCount);

                if (reviewQuestions.length > 0) {
                    updatedProgress.reviewChallenge = { date: todayISO, generatedForDate: todayISO, items: reviewQuestions, isCompleted: false, attemptsMade: 0, };
                    hasChanges = true;
                }
            }

            // Generate Glossary Challenge
            if (!progress.glossaryChallenge || progress.glossaryChallenge.date !== todayISO) {
                console.log(`Gerando Desafio do Glossário para ${studentId}...`);
                const qCount = progress.glossaryChallengeQuestionCount || 5;
                const glossaryItems = shuffleArray(validGlossaryTerms);
                const glossaryQuestions: Question[] = [];

                for (const term of glossaryItems) {
                    if (glossaryQuestions.length >= qCount) break;
                    const otherTerms = glossaryItems.filter(g => g.term !== term.term);
                    if (otherTerms.length < 4) continue;
                    const incorrectOptions = shuffleArray(otherTerms).slice(0, 4).map(g => g.definition);
                    glossaryQuestions.push({ id: `glossary-${todayISO}-${glossaryQuestions.length}`, statement: `Qual a definição de "${term.term}"?`, options: shuffleArray([term.definition, ...incorrectOptions]), correctAnswer: term.definition, justification: `"${term.term}" significa: ${term.definition}.` });
                }

                if (glossaryQuestions.length > 0) {
                    updatedProgress.glossaryChallenge = { date: todayISO, generatedForDate: todayISO, items: glossaryQuestions, isCompleted: false, attemptsMade: 0 };
                    hasChanges = true;
                }
            }
            
            // Generate Portuguese Challenge
            if (!progress.portugueseChallenge || progress.portugueseChallenge.date !== todayISO) {
                 console.log(`Gerando Desafio de Português para ${studentId}...`);
                 const qCount = progress.portugueseChallengeQuestionCount || 1;
                 try {
                     // FIX: Removed 'Type' argument as it is now available in module scope from static import.
                     const questions = await generatePortugueseChallengeQuestions(ai, qCount, progress.portugueseErrorStats);
                     if (questions.length > 0) {
                         updatedProgress.portugueseChallenge = { date: todayISO, generatedForDate: todayISO, items: questions.map(q => ({...q, id: `port-${todayISO}-${Math.random()}`})), isCompleted: false, attemptsMade: 0 };
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

        const successMessage = "Geração de desafios diários concluída com sucesso.";
        console.log(successMessage);
        return {
            statusCode: 200,
            body: JSON.stringify({ message: successMessage }),
            headers: { 'Content-Type': 'application/json' }
        };

    } catch (error: any) {
        console.error("!!! ERRO FATAL NO HANDLER DA FUNÇÃO !!!");
        console.error("Mensagem do Erro:", error.message);
        console.error("Stack do Erro:", error.stack);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ 
                error: "Ocorreu um erro fatal no handler da função.",
                message: error.message,
                stack: error.stack 
            }) 
        };
    }
};

// --- AI Helper (needs to be defined before handler if called from inside) ---

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

// FIX: Removed the 'Type' parameter as it's now available from the static import and updated type annotation for 'ai'.
const generatePortugueseChallengeQuestions = async (
    ai: GoogleGenAI,
    questionCount: number,
    errorStats: StudentProgress['portugueseErrorStats'] | undefined
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
            responseSchema: {
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
            }
        }
    });

    if (!response.text) {
        console.error("Gemini response is missing text body for Portuguese challenge.");
        return [];
    }

    const parsed = JSON.parse(response.text.trim());
    if (Array.isArray(parsed)) {
        return parsed as Omit<Question, 'id'>[];
    }
    return [];
};

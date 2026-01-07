
import { GoogleGenAI, Type, Chat, GenerateContentResponse } from "@google/genai";
import { Question, StudentProgress, Subject, QuestionAttempt, Topic, SubTopic, Flashcard, EditalInfo, MiniGameType, GlossaryTerm, MiniGame } from '../types';

// Modelos padronizados para alta performance e limites de cota elevados
const MODEL_TEXT = 'gemini-3-flash-preview';
const MODEL_PRO = 'gemini-3-flash-preview'; // Alterado de Pro para Flash para estabilidade de cota

/**
 * Helper for retrying API calls with exponential backoff for transient errors
 */
async function retryWithBackoff<T>(
    apiCall: () => Promise<T>,
    maxRetries: number = 4,
    initialDelay: number = 2000
): Promise<T> {
    let delay = initialDelay;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await apiCall();
        } catch (error: any) {
            const errorStr = JSON.stringify(error).toLowerCase();
            const errorMsg = (error.message || '').toLowerCase();
            
            const isQuotaError = 
                error.status === 429 || 
                errorStr.includes('429') || 
                errorStr.includes('quota') ||
                errorStr.includes('exhausted') ||
                errorMsg.includes('429') ||
                errorMsg.includes('quota') ||
                errorMsg.includes('exhausted');

            const isTransientError = 
                isQuotaError ||
                errorStr.includes('503') || 
                errorStr.includes('500') ||
                errorStr.includes('unavailable') ||
                errorStr.includes('overloaded');

            if (isTransientError && i < maxRetries - 1) {
                const backoffDelay = isQuotaError ? delay * 2.5 : delay;
                console.warn(`Gemini API: Erro temporário ou de cota. Tentativa ${i + 1}/${maxRetries}. Aguardando ${backoffDelay}ms...`);
                
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
                delay *= 2; 
            } else {
                if (isQuotaError) {
                    throw new Error("O limite de uso da IA foi atingido temporariamente. Por favor, aguarde 60 segundos e tente novamente.");
                }
                throw error;
            }
        }
    }
    throw new Error('Não foi possível obter resposta da IA após várias tentativas.');
}

/**
 * Helper to parse and clean JSON responses from the model.
 */
const parseJsonResponse = <T,>(jsonString: string, expectedType: 'array' | 'object'): T => {
    try {
        let cleanJsonString = jsonString.trim();
        
        if (cleanJsonString.includes('```')) {
            const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
            const match = codeBlockRegex.exec(cleanJsonString);
            if (match && match[1]) cleanJsonString = match[1].trim();
        }
        
        const parsed = JSON.parse(cleanJsonString);

        // Se o schema retornar o novo formato de justificativas em array, convertemos de volta para o formato de objeto que o app espera
        if (expectedType === 'array' && Array.isArray(parsed)) {
            return parsed.map(q => {
                if (q.optionJustifications && Array.isArray(q.optionJustifications)) {
                    const obj: Record<string, string> = {};
                    q.optionJustifications.forEach((item: any) => {
                        obj[item.option] = item.justification;
                    });
                    q.optionJustifications = obj;
                }
                return q;
            }) as unknown as T;
        }

        if (expectedType === 'array' && !Array.isArray(parsed)) throw new Error("A IA não retornou uma lista conforme esperado.");
        return parsed;
    } catch(e) {
        console.error("Erro ao processar JSON da IA. Conteúdo bruto:", jsonString);
        throw new Error("A resposta da IA não está em um formato válido. Tente reduzir o volume de dados enviado.");
    }
}

// --- SCHEMAS ---

const questionSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        statement: { type: Type.STRING, description: "A pergunta clara e concisa baseada no texto." },
        options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Um array com exatamente 5 alternativas de resposta. Não inclua prefixos como a), b), etc." },
        correctAnswer: { type: Type.STRING, description: "O texto exato de uma das opções que representa a resposta correta. Deve ser IDÊNTICO a uma das entradas no array options." },
        justification: { type: Type.STRING, description: "Justificativa detalhada para a correta." },
        optionJustifications: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              option: { type: Type.STRING, description: "O texto da alternativa (IDÊNTICO ao que está em options)." },
              justification: { type: Type.STRING, description: "Por que esta alternativa está certa ou errada." }
            },
            required: ["option", "justification"]
          },
          description: "Lista de justificativas para cada alternativa."
        },
        errorCategory: { type: Type.STRING }
      },
      required: ["statement", "options", "correctAnswer", "justification"],
    },
};

const topicSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            subtopics: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        description: { type: Type.STRING }
                    },
                    required: ["name", "description"]
                }
            }
        },
        required: ["name", "description", "subtopics"]
    }
};

const flashcardSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            front: { type: Type.STRING },
            back: { type: Type.STRING }
        },
        required: ["front", "back"]
    }
};

const glossarySchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            term: { type: Type.STRING },
            definition: { type: Type.STRING }
        },
        required: ["term", "definition"]
    }
};

const editalSchema = {
    type: Type.OBJECT,
    properties: {
        cargosEVagas: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    cargo: { type: Type.STRING },
                    vagas: { type: Type.STRING },
                    cadastroReserva: { type: Type.STRING }
                },
                required: ["cargo", "vagas"]
            }
        },
        requisitosEscolaridade: { type: Type.STRING },
        bancaOrganizadora: { type: Type.STRING },
        formatoProva: { type: Type.STRING },
        distribuicaoQuestoes: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    disciplina: { type: Type.STRING },
                    quantidade: { type: Type.NUMBER }
                },
                required: ["disciplina", "quantidade"]
            }
        },
        totalQuestoes: { type: Type.NUMBER },
        remuneracao: { type: Type.STRING },
        dataProva: { type: Type.STRING }
    },
    required: ["cargosEVagas", "requisitosEscolaridade", "bancaOrganizadora", "formatoProva", "distribuicaoQuestoes", "totalQuestoes", "remuneracao", "dataProva"]
};

const bulkContentSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            video: {
                type: Type.OBJECT,
                properties: { name: { type: Type.STRING }, url: { type: Type.STRING } }
            },
            fullPdf: {
                type: Type.OBJECT,
                properties: { name: { type: Type.STRING }, url: { type: Type.STRING } }
            },
            summaryPdf: {
                type: Type.OBJECT,
                properties: { name: { type: Type.STRING }, url: { type: Type.STRING } }
            }
        }
    }
};

// --- IMPLEMENTATIONS ---

/**
 * Converte comentários LaTeX em HTML estilizado para as questões do TEC.
 */
export const parseTecJustificationsFromLatex = async (latexText: string): Promise<string[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `Analise o seguinte documento LaTeX contendo comentários de questões.
    Sua tarefa é extrair as justificativas de cada questão na ordem em que aparecem.
    Converta comandos LaTeX de estilo para HTML (strong, em, span style color). Preserve parágrafos.
    Retorne um ARRAY JSON de strings.
    
    DOCUMENTO LATEX:
    ${latexText}`;

    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_PRO,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    }));
    
    return parseJsonResponse(response.text ?? '[]', 'array');
};

/**
 * Gera questões de múltipla escolha a partir de um PDF.
 */
export const generateQuestionsFromPdf = async (pdfBase64: string, questionCount: number = 20, _generateJustifications: boolean): Promise<Omit<Question, 'id'>[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const pdfPart = { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } };
    const prompt = `Gere ${questionCount} questões de múltipla escolha baseadas no PDF. Siga o schema. ATENÇÃO: o campo correctAnswer deve ser IDÊNTICO ao texto de uma das opções.`;
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: { parts: [{ text: prompt }, pdfPart] },
        config: { responseMimeType: "application/json", responseSchema: questionSchema }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

/**
 * Gera questões de múltipla escolha a partir de texto.
 */
export const generateQuestionsFromText = async (text: string, questionCount: number = 20, _generateJustifications: boolean): Promise<Omit<Question, 'id'>[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Gere ${questionCount} questões de múltipla escolha baseadas no texto: ${text}. Siga o schema. ATENÇÃO: o campo correctAnswer deve ser IDÊNTICO ao texto de uma das opções.`;
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: questionSchema }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

/**
 * Gera questões para um quiz personalizado.
 */
export const generateCustomQuizQuestions = async (params: any): Promise<Omit<Question, 'id'>[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    let contents: any;
    if (params.source.type === 'pdf') {
        contents = { parts: [{ text: `Gere ${params.questionCount} questões customizadas. Tipo: ${params.questionType}. Dificuldade: ${params.difficulty}. ATENÇÃO: o campo correctAnswer deve ser IDÊNTICO ao texto de uma das opções.` }, { inlineData: { mimeType: 'application/pdf', data: params.source.content } }] };
    } else {
        contents = `Gere ${params.questionCount} questões customizadas sobre: ${params.source.content}. Tipo: ${params.questionType}. Dificuldade: ${params.difficulty}. ATENÇÃO: o campo correctAnswer deve ser IDÊNTICO ao texto de uma das opções.`;
    }
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: contents,
        config: { responseMimeType: "application/json", responseSchema: questionSchema }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

/**
 * Extrai questões de um PDF do TEC Concursos.
 */
export const extractQuestionsFromTecPdf = async (pdfBase64: string, _generateJustifications: boolean): Promise<Omit<Question, 'id'>[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const pdfPart = { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } };
    const prompt = `Aja como um extrator de ALTA FIDELIDADE para cadernos do TEC Concursos. SCANEIE O DOCUMENTO NA ÍNTEGRA e EXTRAIA TODAS AS QUESTÕES. Mantenha negritos e parágrafos via HTML. O campo correctAnswer deve ser IDÊNTICO ao texto de uma das opções geradas no array options.`;
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_PRO,
        contents: { parts: [{ text: prompt }, pdfPart] },
        config: { 
            responseMimeType: "application/json", 
            responseSchema: questionSchema,
            thinkingConfig: { thinkingBudget: 16000 }
        }
    }));
    return parseJsonResponse(response.text ?? '[]', 'array');
};

/**
 * Extrai questões de um texto do TEC Concursos.
 */
export const extractQuestionsFromTecText = async (text: string, _generateJustifications: boolean): Promise<Omit<Question, 'id'>[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Aja como um extrator de ALTA FIDELIDADE para cadernos do TEC Concursos. EXTRAIA TODAS AS QUESTÕES do texto a seguir. Mantenha negritos e parágrafos via HTML. O campo correctAnswer deve ser IDÊNTICO ao texto de uma das opções geradas no array options. Texto: ${text}`;
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_PRO,
        contents: prompt,
        config: { 
            responseMimeType: "application/json", 
            responseSchema: { ...questionSchema },
            thinkingConfig: { thinkingBudget: 16000 }
        }
    }));
    return parseJsonResponse(response.text ?? '[]', 'array');
};

/**
 * Identifica estrutura de tópicos em um texto.
 */
export const generateTopicsFromText = async (text: string): Promise<any[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: `Analise o texto e gere uma lista de tópicos e subtópicos com nomes e descrições curtas. Texto: ${text}`,
        config: { responseMimeType: "application/json", responseSchema: topicSchema }
    }));
    return parseJsonResponse(response.text ?? '[]', 'array');
};

/**
 * Analisa dificuldades de um aluno com base em erros.
 */
export const analyzeStudentDifficulties = async (questions: any[], attempts: QuestionAttempt[]): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Analise o desempenho do aluno. Questões: ${JSON.stringify(questions)}. Tentativas: ${JSON.stringify(attempts)}. Identifique padrões de erro e sugira pontos de estudo em Markdown.`;
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_PRO,
        contents: prompt,
        config: { thinkingConfig: { thinkingBudget: 8000 } }
    }));
    return response.text ?? 'Não foi possível gerar a análise no momento.';
};

/**
 * Gera um mini-jogo a partir de um PDF.
 */
export const generateGameFromPdf = async (pdfBase64: string, type: MiniGameType): Promise<any> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const pdfPart = { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } };
    const prompt = `Gere os dados JSON para um jogo educativo do tipo "${type}" baseado no conteúdo do PDF.`;
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: { parts: [{ text: prompt }, pdfPart] },
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '{}', 'object');
};

/**
 * Gera um mini-jogo a partir de texto.
 */
export const generateGameFromText = async (text: string, type: MiniGameType): Promise<any> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Gere os dados JSON para um jogo educativo do tipo "${type}" baseado neste texto: ${text}`;
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '{}', 'object');
};

/**
 * Gera o desafio de Português.
 */
export const generatePortugueseChallenge = async (count: number): Promise<Omit<Question, 'id'>[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Gere exatamente ${count} questões de Língua Portuguesa para concursos de nível superior (Gramática e Interpretação). Siga o schema. O campo correctAnswer deve ser IDÊNTICO ao texto de uma das opções.`;
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: questionSchema }
    }));
    return parseJsonResponse(response.text ?? '[]', 'array');
};

/**
 * Inicia chat com tutor sobre um tópico.
 */
export const startTopicChat = (topic: Topic | SubTopic, subject: Subject): Chat => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return ai.chats.create({
        model: MODEL_TEXT,
        config: {
            systemInstruction: `Você é um tutor de IA especialista no tópico "${topic.name}" da disciplina "${subject.name}". Ajude o aluno a sanar dúvidas de forma pedagógica e focada em aprovação.`
        }
    });
};

/**
 * Gera flashcards de um PDF.
 */
export const generateFlashcardsFromPdf = async (pdfBase64: string): Promise<Omit<Flashcard, 'id'>[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const pdfPart = { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } };
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: { parts: [{ text: "Gere flashcards concisos baseados no PDF. Siga o schema." }, pdfPart] },
        config: { responseMimeType: "application/json", responseSchema: flashcardSchema }
    }));
    return parseJsonResponse(response.text ?? '[]', 'array');
};

/**
 * Explicação detalhada de texto.
 */
export const getAiExplanationForText = async (text: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: MODEL_TEXT,
        contents: `Explique de forma didática e profunda o seguinte trecho para um concurseiro: ${text}`
    });
    return response.text ?? '';
};

/**
 * Resumo de texto.
 */
export const getAiSummaryForText = async (text: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: MODEL_TEXT,
        contents: `Resuma os pontos cruciais deste texto em tópicos de fácil memorização: ${text}`
    });
    return response.text ?? '';
};

/**
 * Cria uma questão rápida a partir de texto.
 */
export const getAiQuestionForText = async (text: string): Promise<Omit<Question, 'id'>> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: `Com base neste texto, crie UMA questão de múltipla escolha inédita: ${text}`,
        config: { 
            responseMimeType: "application/json", 
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    statement: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    correctAnswer: { type: Type.STRING },
                    justification: { type: Type.STRING }
                },
                required: ["statement", "options", "correctAnswer", "justification"]
            }
        }
    }));
    return parseJsonResponse(response.text ?? '{}', 'object');
};

/**
 * Analisa Edital em PDF.
 */
export const analyzeEditalFromPdf = async (pdfBase64: string): Promise<EditalInfo> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const pdfPart = { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } };
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_PRO,
        contents: { parts: [{ text: "Extraia todas as informações vitais deste edital de concurso conforme o schema." }, pdfPart] },
        config: { responseMimeType: "application/json", responseSchema: editalSchema }
    }));
    return parseJsonResponse(response.text ?? '{}', 'object');
};

/**
 * Gera Glossário de PDF.
 */
export const generateGlossaryFromPdf = async (pdfBase64: string): Promise<GlossaryTerm[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const pdfPart = { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } };
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: { parts: [{ text: "Extraia os principais termos técnicos e suas definições do PDF." }, pdfPart] },
        config: { responseMimeType: "application/json", responseSchema: glossarySchema }
    }));
    return parseJsonResponse(response.text ?? '[]', 'array');
};

/**
 * Analisa incidência de tópicos em relatórios.
 */
export const analyzeTopicFrequencies = async (text: string, topics: { id: string, name: string }[]): Promise<{ [id: string]: 'alta' | 'media' | 'baixa' | 'nenhuma' }> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: `Cruze estes tópicos: ${JSON.stringify(topics)} com este relatório de incidência: ${text}. Atribua uma frequência ("alta", "media", "baixa", "nenhuma") para cada ID. Retorne um objeto JSON.`,
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '{}', 'object');
};

/**
 * Gera vários tipos de jogos de um texto.
 */
export const generateAllGamesFromText = async (text: string): Promise<Omit<MiniGame, 'id'>[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: `Gere 5 mini-jogos de tipos diferentes baseados neste conteúdo: ${text}. Siga o formato JSON de MiniGame.`,
        config: { 
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        type: { type: Type.STRING },
                        data: { type: Type.OBJECT }
                    },
                    required: ["name", "type", "data"]
                }
            }
        }
    }));
    return parseJsonResponse(response.text ?? '[]', 'array');
};

/**
 * Gera Revisão Inteligente baseada no progresso.
 */
export const generateSmartReview = async (progress: StudentProgress, subjects: Subject[]): Promise<Question[]> => {
    const allQs: (Question & { subjectId: string, topicId: string })[] = [];
    subjects.forEach(s => {
        s.topics.forEach(t => {
            t.questions.forEach(q => allQs.push({ ...q, subjectId: s.id, topicId: t.id }));
            (t.tecQuestions || []).forEach(q => allQs.push({ ...q, subjectId: s.id, topicId: t.id }));
            t.subtopics.forEach(st => {
                st.questions.forEach(q => allQs.push({ ...q, subjectId: s.id, topicId: st.id }));
                (st.tecQuestions || []).forEach(q => allQs.push({ ...q, subjectId: s.id, topicId: st.id }));
            });
        });
    });

    const errorIds = new Set<string>();
    Object.values(progress.progressByTopic).forEach(subj => {
        Object.values(subj).forEach(topic => {
            topic.lastAttempt.forEach(att => {
                if (!att.isCorrect) errorIds.add(att.questionId);
            });
        });
    });

    const pool = allQs.filter(q => errorIds.has(q.id));
    if (pool.length === 0) return allQs.sort(() => Math.random() - 0.5).slice(0, 10);
    return pool.sort(() => Math.random() - 0.5).slice(0, 10);
};

/**
 * Gera Flashcards de questões com erro.
 */
export const generateFlashcardsFromIncorrectAnswers = async (questions: Question[]): Promise<Omit<Flashcard, 'id'>[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: `Crie flashcards que foquem em sanar as dúvidas destas questões que o aluno errou: ${JSON.stringify(questions)}. Siga o schema.`,
        config: { responseMimeType: "application/json", responseSchema: flashcardSchema }
    }));
    return parseJsonResponse(response.text ?? '[]', 'array');
};

/**
 * Parse em massa de links para criação de aulas.
 */
export const parseBulkTopicContent = async (name: string, rawLinks: string, isReplication: boolean): Promise<any[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Analise a lista bruta: ${rawLinks}. Extraia nomes e links de vídeos e PDFs. Título base: ${name}. Replicação: ${isReplication}. Siga o schema.`;
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: bulkContentSchema }
    }));
    return parseJsonResponse(response.text ?? '[]', 'array');
};

/**
 * Limpa nomes de subtópicos em massa.
 */
export const cleanSubtopicNames = async (rawText: string): Promise<string[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: `Extraia e limpe a lista de nomes a seguir, removendo emojis, extensões e numerações redundantes: ${rawText}. Retorne apenas um array JSON de strings.`,
        config: { 
            responseMimeType: "application/json",
            responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
    }));
    return parseJsonResponse(response.text ?? '[]', 'array');
};

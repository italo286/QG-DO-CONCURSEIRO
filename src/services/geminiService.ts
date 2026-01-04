
import { GoogleGenAI, Type, Chat, GenerateContentResponse } from "@google/genai";
import { Question, StudentProgress, Subject, QuestionAttempt, Topic, SubTopic, Flashcard, EditalInfo, MiniGameType, GlossaryTerm } from '../types';

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
    throw new Error('Max retries reached for API call.');
}

const questionSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        statement: { type: Type.STRING, description: "A pergunta clara e concisa baseada no texto." },
        options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Um array com exatamente 5 alternativas de resposta." },
        correctAnswer: { type: Type.STRING, description: "A string exata da alternativa correta." },
        justification: { type: Type.STRING, description: "Justificativa detalhada para a correta." },
        optionJustifications: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
                option: { type: Type.STRING },
                justification: { type: Type.STRING }
            },
            required: ["option", "justification"]
          }
        },
        errorCategory: { type: Type.STRING }
      },
      required: ["statement", "options", "correctAnswer", "justification"],
    },
};

const parseJsonResponse = <T,>(jsonString: string, expectedType: 'array' | 'object'): T => {
    try {
        let cleanJsonString = jsonString;
        const codeBlockRegex = /```(json)?\s*([\s\S]*?)\s*```/;
        const match = codeBlockRegex.exec(jsonString);
        if (match && match[2]) cleanJsonString = match[2];
        const parsed = JSON.parse(cleanJsonString);
        if (expectedType === 'array' && !Array.isArray(parsed)) throw new Error("IA response is not an array.");
        return parsed;
    } catch(e) {
        throw new Error("A resposta da IA não está em um formato JSON válido.");
    }
}

export const generateQuestionsFromPdf = async (pdfBase64: string, questionCount: number = 20, _generateJustifications: boolean): Promise<Omit<Question, 'id'>[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const pdfPart = { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } };
    const prompt = `Gere ${questionCount} questões de múltipla escolha baseadas no PDF. Siga o schema.`;
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: prompt }, pdfPart] },
        config: { responseMimeType: "application/json", responseSchema: questionSchema }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const generateQuestionsFromText = async (text: string, questionCount: number = 20, _generateJustifications: boolean): Promise<Omit<Question, 'id'>[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Gere ${questionCount} questões de múltipla escolha baseadas no texto: ${text}. Siga o schema.`;
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: questionSchema }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const generateCustomQuizQuestions = async (params: any): Promise<Omit<Question, 'id'>[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Gere questões customizadas. Tipo: ${params.questionType}. Dificuldade: ${params.difficulty}.`,
        config: { responseMimeType: "application/json", responseSchema: questionSchema }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const extractQuestionsFromTecPdf = async (pdfBase64: string, _generateJustifications: boolean): Promise<Omit<Question, 'id'>[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const pdfPart = { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } };
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: "Extraia questões deste PDF do TEC Concursos." }, pdfPart] },
        config: { responseMimeType: "application/json", responseSchema: questionSchema }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const extractQuestionsFromTecText = async (text: string, _generateJustifications: boolean): Promise<Omit<Question, 'id'>[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Extraia questões deste texto do TEC: ${text}`,
        config: { responseMimeType: "application/json", responseSchema: questionSchema }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const generateSmartReview = async (progress: StudentProgress, _allSubjects: Subject[]): Promise<Question[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Crie uma revisão baseada no progresso: ${JSON.stringify(progress)}`,
        config: { responseMimeType: "application/json", responseSchema: questionSchema }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const generateTopicsFromText = async (text: string): Promise<any[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Extraia tópicos e subtópicos deste texto: ${text}`,
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const generateFlashcardsFromPdf = async (pdfBase64: string): Promise<Omit<Flashcard, 'id'>[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const pdfPart = { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } };
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: "Gere flashcards deste PDF." }, pdfPart] },
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const analyzeStudentDifficulties = async (_questions: any[], attempts: QuestionAttempt[]): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analise as dificuldades baseadas nas tentativas: ${JSON.stringify(attempts)}`,
    }));
    return response.text ?? '';
};

export const getAiExplanationForText = async (text: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Explique: ${text}`,
    }));
    return response.text ?? '';
};

export const getAiSummaryForText = async (text: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Resuma: ${text}`,
    }));
    return response.text ?? '';
};

export const getAiQuestionForText = async (text: string): Promise<Omit<Question, 'id'>> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Crie uma questão sobre: ${text}`,
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '', 'object');
};

export const startTopicChat = (topic: Topic | SubTopic, subject: Subject): Chat => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: { systemInstruction: `Tutor de ${subject.name}. Foco no tópico ${topic.name}.` }
    });
};

export const generateFlashcardsFromIncorrectAnswers = async (_incorrectQuestions: Question[]): Promise<Omit<Flashcard, 'id'>[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Gere flashcards das questões erradas.`,
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const generateQuizFeedback = async (_questions: Question[], attempts: QuestionAttempt[]): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Feedback do quiz: ${JSON.stringify(attempts)}`,
    }));
    return response.text ?? '';
};

export const analyzeEditalFromPdf = async (pdfBase64: string): Promise<EditalInfo> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const pdfPart = { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } };
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: "Analise este edital." }, pdfPart] },
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '', 'object');
};

export const generateReviewSummaryForIncorrectQuestions = async (_incorrectQuestions: Question[]): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Resumo de revisão para erros.`,
    }));
    return response.text ?? '';
};

export const generateJustificationsForQuestion = async (question: any): Promise<any> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Justifique as alternativas da questão: ${JSON.stringify(question)}`,
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '', 'object');
};

export const generateGameFromPdf = async (pdfBase64: string, gameType: MiniGameType): Promise<any> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const pdfPart = { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } };
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: `Gere dados para o jogo ${gameType} baseado no PDF.` }, pdfPart] },
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '', 'object');
};

export const generateGameFromText = async (text: string, gameType: MiniGameType): Promise<any> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Gere jogo ${gameType} do texto: ${text}`,
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '', 'object');
};

export const generateAllGamesFromText = async (text: string): Promise<any[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Gere todos os jogos possíveis do texto: ${text}`,
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const generateAdaptiveStudyPlan = async (_subjects: Subject[], _progress: StudentProgress, days: number = 7): Promise<any> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Crie plano adaptativo de ${days} dias baseado no progresso.`,
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '', 'object');
};

export const generateGlossaryFromPdf = async (pdfBase64: string): Promise<GlossaryTerm[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const pdfPart = { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } };
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: "Gere um glossário deste PDF." }, pdfPart] },
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const generatePortugueseChallenge = async (questionCount: number, _errorStats?: any): Promise<any[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Gere ${questionCount} desafios de português.`,
        config: { responseMimeType: "application/json", responseSchema: questionSchema }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const analyzeTopicFrequencies = async (analysisText: string, topics: any[]): Promise<any> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analise a frequência de cobrança destes tópicos: ${JSON.stringify(topics)} baseado no texto: ${analysisText}`,
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

/**
 * Processa um texto com nomes e links de arquivos e agrupa em pares de PDF e Vídeo para criação de aulas.
 */
export const parseBulkTopicContent = async (genericName: string, rawContent: string, isReplication: boolean = false): Promise<any[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    let prompt = "";
    if (isReplication) {
        prompt = `Analise a lista de arquivos e links para o tópico "${genericName}".
        Esta lista está no MODO REPLICAÇÃO:
        1. Identifique um ou dois PDFs base na lista. 
           - Se houver um PDF que contenha no nome "material original", ele será o "fullPdf".
           - Se houver um PDF que contenha no nome "material simplificado", ele será o "summaryPdf".
           - Se houver apenas um PDF genérico, considere-o como "fullPdf".
        2. Identifique todos os links de VÍDEO. Cada vídeo representa uma nova aula individual.
        3. Para CADA vídeo encontrado, gere um item no array.
        4. No modo replicação, você deve REPLICAR (repetir) os PDFs base em TODOS os itens gerados.
        5. IMPORTANTE: Para o campo 'name' de vídeos e PDFs, limpe os nomes originais removendo extensões (.mp4, .pdf) e prefixos redundantes de organização como "Vídeo 1 - ", "Video 02 -", "Aula 3:", etc. Deixe apenas o título descritivo do assunto (ex: de "Vídeo 1 - Sílaba Tônica.mp4" para "Sílaba Tônica").
        
        Retorne um array JSON de objetos ordenado crescentemente pela ordem dos vídeos.
        O formato deve ser rigorosamente: 
        { "originalAulaNumber": number, "fullPdf": { "name": string, "url": string } | null, "summaryPdf": { "name": string, "url": string } | null, "video": { "name": string, "url": string } | null }
        
        Conteúdo para análise:
        ${rawContent}`;
    } else {
        prompt = `Analise a seguinte lista de arquivos e links para o tópico base "${genericName}". 
        Identifique os pares de arquivos correspondentes (ex: o PDF e o Vídeo de uma mesma aula).
        Agrupe os arquivos logicamente.
        IMPORTANTE: Para o campo 'name' de vídeos e PDFs, limpe os nomes originais removendo extensões (.mp4, .pdf) e prefixos redundantes de organização como "Vídeo 1 - ", "Video 02 -", "Aula 3:", etc. Deixe apenas o título descritivo do assunto (ex: de "Vídeo 1 - Sílaba Tônica.mp4" para "Sílaba Tônica").
        Retorne um array JSON de objetos ordenado crescentemente com base na numeração detectada nos nomes originais.
        O formato deve ser rigorosamente: 
        { "originalAulaNumber": number, "fullPdf": { "name": string, "url": string } | null, "video": { "name": string, "url": string } | null }
        
        Conteúdo para análise:
        ${rawContent}`;
    }

    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

/**
 * Limpa e extrai títulos de assuntos de uma lista bruta colada pelo usuário.
 */
export const cleanSubtopicNames = async (rawList: string): Promise<string[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `Analise a seguinte lista de títulos de aulas/vídeos:
    "${rawList}"

    Sua tarefa é extrair APENAS o nome descritivo do assunto para cada item da lista.
    REGRAS DE LIMPEZA:
    1. Remova emojis (ex: 🎥, 📚).
    2. Remova prefixos de organização como "Vídeo 1 -", "Video 02 :", "Aula 3 -", "01.", "Parte 1:".
    3. Remova extensões de arquivo (ex: .mp4, .pdf).
    4. Remova espaços extras.
    5. O resultado deve ter EXATAMENTE o mesmo número de itens que linhas/itens fornecidos no texto original.
    6. Retorne um array JSON contendo apenas strings dos títulos limpos.

    Exemplo de saída esperada: ["Preposições", "Conjunções Coordenativas", "Crase"]`;

    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: "application/json" }
    }));
    
    return parseJsonResponse(response.text ?? '[]', 'array');
};

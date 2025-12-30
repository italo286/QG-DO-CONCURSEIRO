
import { GoogleGenAI, Type, Chat, GenerateContentResponse } from "@google/genai";
import { Question, StudentProgress, Subject, QuestionAttempt, Topic, SubTopic, Flashcard, EditalInfo, MiniGameType, MemoryGameData, AssociationGameData, OrderGameData, IntruderGameData, CategorizeGameData, StudyPlan, GlossaryTerm, MiniGame } from '../types';

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

const shuffleArray = <T>(array: T[]): T[] => {
    if (!array) return [];
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

const stripOptionPrefix = (option: string): string => {
    return option.replace(/^[A-Ea-e][.)]\s*/, '').trim();
};

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

export const generateQuestionsFromPdf = async (pdfBase64: string, questionCount: number = 20, generateJustifications: boolean): Promise<Omit<Question, 'id'>[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const pdfPart = { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } };
    const prompt = `Gere ${questionCount} questões de múltipla escolha baseadas no PDF. Siga o schema.`;
    // FIX: Added explicit GenerateContentResponse generic type to retryWithBackoff call to resolve 'unknown' property access errors.
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: prompt }, pdfPart] },
        config: { responseMimeType: "application/json", responseSchema: questionSchema }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const generateQuestionsFromText = async (text: string, questionCount: number = 20, generateJustifications: boolean): Promise<Omit<Question, 'id'>[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Gere ${questionCount} questões de múltipla escolha baseadas no texto: ${text}. Siga o schema.`;
    // FIX: Added explicit GenerateContentResponse generic type to retryWithBackoff call to resolve 'unknown' property access errors.
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: questionSchema }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const generateCustomQuizQuestions = async (params: any): Promise<Omit<Question, 'id'>[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // FIX: Added explicit GenerateContentResponse generic type to retryWithBackoff call to resolve 'unknown' property access errors.
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Gere questões customizadas. Tipo: ${params.questionType}. Dificuldade: ${params.difficulty}.`,
        config: { responseMimeType: "application/json", responseSchema: questionSchema }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const extractQuestionsFromTecPdf = async (pdfBase64: string, generateJustifications: boolean): Promise<Omit<Question, 'id'>[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const pdfPart = { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } };
    // FIX: Added explicit GenerateContentResponse generic type to retryWithBackoff call to resolve 'unknown' property access errors.
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: "Extraia questões deste PDF do TEC Concursos." }, pdfPart] },
        config: { responseMimeType: "application/json", responseSchema: questionSchema }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const extractQuestionsFromTecText = async (text: string, generateJustifications: boolean): Promise<Omit<Question, 'id'>[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // FIX: Added explicit GenerateContentResponse generic type to retryWithBackoff call to resolve 'unknown' property access errors.
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Extraia questões deste texto do TEC: ${text}`,
        config: { responseMimeType: "application/json", responseSchema: questionSchema }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const generateSmartReview = async (progress: StudentProgress, allSubjects: Subject[]): Promise<Question[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // FIX: Added explicit GenerateContentResponse generic type to retryWithBackoff call to resolve 'unknown' property access errors.
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Crie uma revisão baseada no progresso: ${JSON.stringify(progress)}`,
        config: { responseMimeType: "application/json", responseSchema: questionSchema }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const generateTopicsFromText = async (text: string): Promise<any[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // FIX: Added explicit GenerateContentResponse generic type to retryWithBackoff call to resolve 'unknown' property access errors.
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
    // FIX: Added explicit GenerateContentResponse generic type to retryWithBackoff call to resolve 'unknown' property access errors.
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: "Gere flashcards deste PDF." }, pdfPart] },
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const analyzeStudentDifficulties = async (questions: any[], attempts: QuestionAttempt[]): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // FIX: Added explicit GenerateContentResponse generic type to retryWithBackoff call to resolve 'unknown' property access errors.
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analise as dificuldades baseadas nas tentativas: ${JSON.stringify(attempts)}`,
    }));
    return response.text ?? '';
};

export const getAiExplanationForText = async (text: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // FIX: Added explicit GenerateContentResponse generic type to retryWithBackoff call to resolve 'unknown' property access errors.
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Explique: ${text}`,
    }));
    return response.text ?? '';
};

export const getAiSummaryForText = async (text: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // FIX: Added explicit GenerateContentResponse generic type to retryWithBackoff call to resolve 'unknown' property access errors.
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Resuma: ${text}`,
    }));
    return response.text ?? '';
};

export const getAiQuestionForText = async (text: string): Promise<Omit<Question, 'id'>> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // FIX: Added explicit GenerateContentResponse generic type to retryWithBackoff call to resolve 'unknown' property access errors.
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

export const generateFlashcardsFromIncorrectAnswers = async (incorrectQuestions: Question[]): Promise<Omit<Flashcard, 'id'>[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // FIX: Added explicit GenerateContentResponse generic type to retryWithBackoff call to resolve 'unknown' property access errors.
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Gere flashcards das questões erradas: ${JSON.stringify(incorrectQuestions)}`,
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const generateQuizFeedback = async (questions: Question[], attempts: QuestionAttempt[]): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // FIX: Added explicit GenerateContentResponse generic type to retryWithBackoff call to resolve 'unknown' property access errors.
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Feedback do quiz: ${JSON.stringify(attempts)}`,
    }));
    return response.text ?? '';
};

export const analyzeEditalFromPdf = async (pdfBase64: string): Promise<EditalInfo> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const pdfPart = { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } };
    // FIX: Added explicit GenerateContentResponse generic type to retryWithBackoff call to resolve 'unknown' property access errors.
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: "Analise este edital." }, pdfPart] },
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '', 'object');
};

export const generateReviewSummaryForIncorrectQuestions = async (incorrectQuestions: Question[]): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // FIX: Added explicit GenerateContentResponse generic type to retryWithBackoff call to resolve 'unknown' property access errors.
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Resumo de revisão para erros: ${JSON.stringify(incorrectQuestions)}`,
    }));
    return response.text ?? '';
};

export const generateJustificationsForQuestion = async (question: any): Promise<any> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // FIX: Added explicit GenerateContentResponse generic type to retryWithBackoff call to resolve 'unknown' property access errors.
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
    // FIX: Added explicit GenerateContentResponse generic type to retryWithBackoff call to resolve 'unknown' property access errors.
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: `Gere dados para o jogo ${gameType} baseado no PDF.` }, pdfPart] },
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '', 'object');
};

export const generateGameFromText = async (text: string, gameType: MiniGameType): Promise<any> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // FIX: Added explicit GenerateContentResponse generic type to retryWithBackoff call to resolve 'unknown' property access errors.
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Gere jogo ${gameType} do texto: ${text}`,
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '', 'object');
};

export const generateAllGamesFromText = async (text: string): Promise<any[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // FIX: Added explicit GenerateContentResponse generic type to retryWithBackoff call to resolve 'unknown' property access errors.
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Gere todos os jogos possíveis do texto: ${text}`,
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const generateAdaptiveStudyPlan = async (subjects: Subject[], progress: StudentProgress, days: number = 7): Promise<any> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // FIX: Added explicit GenerateContentResponse generic type to retryWithBackoff call to resolve 'unknown' property access errors.
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
    // FIX: Added explicit GenerateContentResponse generic type to retryWithBackoff call to resolve 'unknown' property access errors.
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: "Gere um glossário deste PDF." }, pdfPart] },
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const generatePortugueseChallenge = async (questionCount: number, errorStats?: any): Promise<any[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // FIX: Added explicit GenerateContentResponse generic type to retryWithBackoff call to resolve 'unknown' property access errors.
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Gere ${questionCount} desafios de português.`,
        config: { responseMimeType: "application/json", responseSchema: questionSchema }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const analyzeTopicFrequencies = async (analysisText: string, topics: any[]): Promise<any> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // FIX: Added explicit GenerateContentResponse generic type to retryWithBackoff call to resolve 'unknown' property access errors.
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analise a frequência de cobrança destes tópicos: ${JSON.stringify(topics)} baseado no texto: ${analysisText}`,
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

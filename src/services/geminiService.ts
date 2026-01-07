
import { GoogleGenAI, Type, Chat, GenerateContentResponse } from "@google/genai";
import { Question, StudentProgress, Subject, QuestionAttempt, Topic, SubTopic, Flashcard, EditalInfo, MiniGameType, GlossaryTerm } from '../types';

// Modelos padronizados conforme diretrizes
const MODEL_TEXT = 'gemini-3-flash-preview';
const MODEL_PRO = 'gemini-3-pro-preview'; // Modelo superior para tarefas complexas de extração
const MODEL_UTILITY = 'gemini-flash-lite-latest'; 

// Helper for retrying API calls with exponential backoff for transient errors
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

const parseJsonResponse = <T,>(jsonString: string, expectedType: 'array' | 'object'): T => {
    try {
        let cleanJsonString = jsonString.trim();
        
        if (cleanJsonString.includes('```')) {
            const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
            const match = codeBlockRegex.exec(cleanJsonString);
            if (match && match[1]) cleanJsonString = match[1].trim();
        }
        
        const parsed = JSON.parse(cleanJsonString);
        if (expectedType === 'array' && !Array.isArray(parsed)) throw new Error("A IA não retornou uma lista conforme esperado.");
        return parsed;
    } catch(e) {
        console.error("Erro ao processar JSON da IA. Conteúdo bruto:", jsonString);
        throw new Error("A resposta da IA não está em um formato válido. Tente reduzir o volume de dados enviado.");
    }
}

/**
 * Converte comentários LaTeX em HTML estilizado para as questões do TEC.
 */
export const parseTecJustificationsFromLatex = async (latexText: string): Promise<string[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `Analise o seguinte documento LaTeX contendo comentários de questões.
    Sua tarefa é extrair as justificativas de cada questão na ordem em que aparecem.
    
    REGRAS DE CONVERSÃO PARA CADA COMENTÁRIO:
    1. Converta comandos LaTeX de estilo para HTML:
       - \\textbf{...} -> <strong>...</strong>
       - \\textit{...} -> <em>...</em>
       - \\textcolor[RGB]{R,G,B}{...} -> <span style="color: rgb(R,G,B)">...</span>
       - \\textcolor{colorName}{...} -> <span style="color: colorName">...</span>
    2. Preserve quebras de linha (\\) como <br/>.
    3. Preserve parágrafos (espaço duplo ou comandos de seção) separando-os com tags <p>.
    4. Remova o enunciado e as alternativas (\\textsf{a) ...}), focando APENAS no texto explicativo do comentário.
    5. Ignore comandos de preâmbulo (\\documentclass, \\usepackage, etc.) e metadados (\\title, \\author).
    6. Identifique cada bloco de comentário geralmente começando após as alternativas.
    
    Retorne um ARRAY JSON de strings, onde cada string é o HTML purificado do comentário de uma questão.
    
    Exemplo de saída: ["<p>O <strong>intervalo</strong> de células...</p>", "<p>A função <em>MAIOR</em>...</p>"]
    
    DOCUMENTO LATEX:
    ${latexText}`;

    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_PRO,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    }));
    
    return parseJsonResponse(response.text ?? '[]', 'array');
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

export const generateQuestionsFromPdf = async (pdfBase64: string, questionCount: number = 20, _generateJustifications: boolean): Promise<Omit<Question, 'id'>[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const pdfPart = { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } };
    const prompt = `Gere ${questionCount} questões de múltipla escolha baseadas no PDF. Siga o schema.`;
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: { parts: [{ text: prompt }, pdfPart] },
        config: { responseMimeType: "application/json", responseSchema: questionSchema }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const generateQuestionsFromText = async (text: string, questionCount: number = 20, _generateJustifications: boolean): Promise<Omit<Question, 'id'>[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Gere ${questionCount} questões de múltipla escolha baseadas no texto: ${text}. Siga o schema.`;
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: questionSchema }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const generateCustomQuizQuestions = async (params: any): Promise<Omit<Question, 'id'>[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: `Gere questões customizadas. Tipo: ${params.questionType}. Dificuldade: ${params.difficulty}.`,
        config: { responseMimeType: "application/json", responseSchema: questionSchema }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const extractQuestionsFromTecPdf = async (pdfBase64: string, _generateJustifications: boolean): Promise<Omit<Question, 'id'>[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const pdfPart = { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } };
    const prompt = `Sua tarefa é agir como um extrator de alta precisão para cadernos do TEC Concursos.
    
    DIRETRIZES CRÍTICAS PARA EXTRAÇÃO TOTAL:
    1. SCANEIE O DOCUMENTO NA ÍNTEGRA: Não pare após extrair as primeiras questões. Percorra o documento até a última página.
    2. EXTRAIA ABSOLUTAMENTE TODAS as questões numeradas (1, 2, 3, etc.) encontradas.
    3. PRESERVAÇÃO DE ESTILOS: Use HTML para manter negritos (<strong>), itálicos (<em>) e cores.
    4. PRESERVAÇÃO DO LAYOUT: Mantenha quebras de linha (<br/>) e parágrafos (<p>).
    5. ORDEM ORIGINAL: NÃO embaralhe as alternativas. Mantenha a ordem (a, b, c, d, e).
    6. GABARITO: O 'correctAnswer' deve ser o texto exato da alternativa correta.
    
    Certifique-se de que a contagem final de questões no JSON corresponda ao total de questões visíveis no documento.`;

    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_PRO,
        contents: { parts: [{ text: prompt }, pdfPart] },
        config: { 
            responseMimeType: "application/json", 
            responseSchema: questionSchema,
            thinkingConfig: { thinkingBudget: 4000 } // Dá mais tempo para o modelo processar a estrutura
        }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const extractQuestionsFromTecText = async (text: string, _generateJustifications: boolean): Promise<Omit<Question, 'id'>[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Extraia RIGOROSAMENTE TODAS as questões deste texto do TEC Concursos.
    
    REGRAS DE OURO:
    - NÃO IGNORE NENHUMA QUESTÃO. Extraia desde a primeira até a última numerada.
    - CONVERTA ESTILOS PARA HTML: Negrito (\\textbf{...} ou similar) -> <strong>...</strong>.
    - PRESERVE QUEBRAS DE LINHA: Use <br/> para quebras únicas e <p> para parágrafos.
    - ORDEM: Preserve a posição original das alternativas e do gabarito.
    
    TEXTO FONTE:
    ${text}`;

    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_PRO,
        contents: prompt,
        config: { 
            responseMimeType: "application/json", 
            responseSchema: questionSchema,
            thinkingConfig: { thinkingBudget: 4000 }
        }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const generateSmartReview = async (progress: StudentProgress, _allSubjects: Subject[]): Promise<Question[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: `Crie uma revisão baseada no progresso: ${JSON.stringify(progress)}`,
        config: { responseMimeType: "application/json", responseSchema: questionSchema }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const generateTopicsFromText = async (text: string): Promise<any[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_UTILITY,
        contents: `Extraia tópicos e subtópicos deste texto: ${text}`,
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const generateFlashcardsFromPdf = async (pdfBase64: string): Promise<Omit<Flashcard, 'id'>[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const pdfPart = { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } };
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: { parts: [{ text: "Gere flashcards deste PDF." }, pdfPart] },
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const analyzeStudentDifficulties = async (_questions: any[], attempts: QuestionAttempt[]): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: `Analise as dificuldades baseadas nas tentativas: ${JSON.stringify(attempts)}`,
    }));
    return response.text ?? '';
};

export const getAiExplanationForText = async (text: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: `Explique: ${text}`,
    }));
    return response.text ?? '';
};

export const getAiSummaryForText = async (text: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: `Resuma: ${text}`,
    }));
    return response.text ?? '';
};

export const getAiQuestionForText = async (text: string): Promise<Omit<Question, 'id'>> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: `Crie uma questão sobre: ${text}`,
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '', 'object');
};

export const startTopicChat = (topic: Topic | SubTopic, subject: Subject): Chat => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return ai.chats.create({
        model: MODEL_TEXT,
        config: { systemInstruction: `Tutor de ${subject.name}. Foco no tópico ${topic.name}.` }
    });
};

export const generateFlashcardsFromIncorrectAnswers = async (_incorrectQuestions: Question[]): Promise<Omit<Flashcard, 'id'>[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: `Gere flashcards das questões erradas.`,
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const generateQuizFeedback = async (_questions: Question[], attempts: QuestionAttempt[]): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: `Feedback do quiz: ${JSON.stringify(attempts)}`,
    }));
    return response.text ?? '';
};

export const analyzeEditalFromPdf = async (pdfBase64: string): Promise<EditalInfo> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const pdfPart = { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } };
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: { parts: [{ text: "Analise este edital." }, pdfPart] },
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '', 'object');
};

export const generateReviewSummaryForIncorrectQuestions = async (_incorrectQuestions: Question[]): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: `Resumo de revisão para erros.`,
    }));
    return response.text ?? '';
};

export const generateJustificationsForQuestion = async (question: any): Promise<any> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: `Justifique as alternativas da questão: ${JSON.stringify(question)}`,
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '', 'object');
};

export const generateGameFromPdf = async (pdfBase64: string, gameType: MiniGameType): Promise<any> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const pdfPart = { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } };
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: { parts: [{ text: `Gere dados para o jogo ${gameType} baseado no PDF.` }, pdfPart] },
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '', 'object');
};

export const generateGameFromText = async (text: string, gameType: MiniGameType): Promise<any> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: `Gere jogo ${gameType} do texto: ${text}`,
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '', 'object');
};

export const generateAllGamesFromText = async (text: string): Promise<any[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_UTILITY,
        contents: `Gere todos os jogos possíveis do texto: ${text}`,
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const generateAdaptiveStudyPlan = async (_subjects: Subject[], _progress: StudentProgress, days: number = 7): Promise<any> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: `Crie plano adaptativo de ${days} dias baseado no progresso.`,
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '', 'object');
};

export const generateGlossaryFromPdf = async (pdfBase64: string): Promise<GlossaryTerm[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const pdfPart = { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } };
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: { parts: [{ text: "Gere um glossário deste PDF." }, pdfPart] },
        config: { responseMimeType: "application/json" }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const generatePortugueseChallenge = async (questionCount: number, _errorStats?: any): Promise<any[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_TEXT,
        contents: `Gere ${questionCount} desafios de português.`,
        config: { responseMimeType: "application/json", responseSchema: questionSchema }
    }));
    return parseJsonResponse(response.text ?? '', 'array');
};

export const analyzeTopicFrequencies = async (analysisText: string, topics: any[]): Promise<any> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODEL_UTILITY,
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
        prompt = `Analise the following lista de arquivos e links para o tópico base "${genericName}". 
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
        model: MODEL_UTILITY,
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
        model: MODEL_UTILITY,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    }));
    
    return parseJsonResponse(response.text ?? '[]', 'array');
};

import { GoogleGenAI, Type, Chat, GenerateContentResponse } from "@google/genai";
import { Question, StudentProgress, Subject, QuestionAttempt, Topic, SubTopic, Flashcard, EditalInfo, MiniGameType, MemoryGameData, AssociationGameData, OrderGameData, IntruderGameData, CategorizeGameData, StudyPlan, GlossaryTerm, MiniGame } from '../types';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  // In a real app, you'd want to handle this more gracefully.
  // For this environment, we'll alert and log, but the app will fail on API calls.
  console.error("Gemini API key is missing. Please set the VITE_GEMINI_API_KEY environment variable in your .env file.");
  // alert("Chave da API do Gemini não encontrada. A funcionalidade de IA está desabilitada.");
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY! });

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
    // This line should not be reachable, but is needed for TypeScript's control flow analysis
    throw new Error('Max retries reached for API call.');
}


// Helper to shuffle array elements for randomizing question options
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
    // This regex matches a letter (A-E), followed by a period or parenthesis, and optional whitespace.
    // e.g., "A. ", "B) ", "c."
    return option.replace(/^[A-Ea-e][.)]\s*/, '').trim();
};


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
  
const topicGenerationSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            name: {
                type: Type.STRING,
                description: "O nome curto e conciso do tópico de estudo principal.",
            },
            description: {
                type: Type.STRING,
                description: "Uma breve descrição (1-2 frases) sobre o que o tópico principal abrange.",
            },
            subtopics: {
                type: Type.ARRAY,
                description: "Uma lista de subtópicos aninhados dentro deste tópico principal. Se não houver subtópicos claros, retorne um array vazio.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: {
                            type: Type.STRING,
                            description: "O nome do subtópico.",
                        },
                        description: {
                            type: Type.STRING,
                            description: "A descrição concisa do subtópico.",
                        },
                    },
                    required: ["name", "description"],
                }
            }
        },
        required: ["name", "description"],
    },
};

const flashcardSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        front: {
          type: Type.STRING,
          description: "O termo, conceito ou pergunta curta que aparecerá na frente do flashcard.",
        },
        back: {
          type: Type.STRING,
          description: "A definição, resposta ou explicação que aparecerá no verso do flashcard.",
        },
      },
      required: ["front", "back"],
    },
};

const glossarySchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            term: {
                type: Type.STRING,
                description: "O termo ou conceito chave extraído do texto.",
            },
            definition: {
                type: Type.STRING,
                description: "A definição clara e concisa do termo, baseada no contexto do documento.",
            },
        },
        required: ["term", "definition"],
    },
};

const editalAnalysisSchema = {
    type: Type.OBJECT,
    properties: {
        cargosEVagas: {
            type: Type.ARRAY,
            description: "Lista de cargos oferecidos, com número de vagas e se há cadastro de reserva.",
            items: {
                type: Type.OBJECT,
                properties: {
                    cargo: { type: Type.STRING, description: "Nome do cargo." },
                    vagas: { type: Type.STRING, description: "Número de vagas (ex: '5', '10 + CR')." },
                    cadastroReserva: { type: Type.STRING, description: "Indicação de cadastro de reserva (ex: 'Sim', 'Não', 'CR')." }
                },
                required: ["cargo", "vagas"]
            }
        },
        requisitosEscolaridade: { type: Type.STRING, description: "Nível de escolaridade exigido." },
        bancaOrganizadora: { type: Type.STRING, description: "Nome da banca organizadora." },
        formatoProva: { type: Type.STRING, description: "Descrição do formato da prova (múltipla escolha, certo/errado, discursiva, etc.)." },
        distribuicaoQuestoes: {
            type: Type.ARRAY,
            description: "Distribuição de questões por disciplina.",
            items: {
                type: Type.OBJECT,
                properties: {
                    disciplina: { type: Type.STRING },
                    quantidade: { type: Type.INTEGER }
                },
                required: ["disciplina", "quantidade"]
            }
        },
        totalQuestoes: { type: Type.INTEGER, description: "Número total de questões da prova objetiva." },
        remuneracao: { type: Type.STRING, description: "Valor do salário inicial e benefícios, se houver." },
        dataProva: { type: Type.STRING, description: "Data da prova no formato AAAA-MM-DD. Se houver mais de uma, liste a principal." }
    },
    required: ["cargosEVagas", "requisitosEscolaridade", "bancaOrganizadora", "remuneracao", "dataProva"]
};

const memoryGameSchema = {
    type: Type.OBJECT,
    properties: {
        items: {
            type: Type.ARRAY,
            description: "A list of 8 to 15 key terms or short concepts from the text for a memory game.",
            items: { type: Type.STRING }
        }
    },
    required: ["items"]
};

const associationGameSchema = {
    type: Type.OBJECT,
    properties: {
        pairs: {
            type: Type.ARRAY,
            description: "A list of pairs, each with a key concept and its corresponding definition from the text.",
            items: {
                type: Type.OBJECT,
                properties: {
                    concept: { type: Type.STRING, description: "The key concept or term." },
                    definition: { type: Type.STRING, description: "The definition or associated value." }
                },
                required: ["concept", "definition"]
            }
        }
    },
    required: ["pairs"]
};

const orderGameSchema = {
    type: Type.OBJECT,
    properties: {
        description: { type: Type.STRING, description: "A short instruction for the user, like 'Order the historical events chronologically.'." },
        items: {
            type: Type.ARRAY,
            description: "A list of items (3 to 8 items) from the text that have a clear sequential order, in the correct order.",
            items: { type: Type.STRING }
        }
    },
    required: ["description", "items"]
};

const intruderGameSchema = {
    type: Type.OBJECT,
    properties: {
        categoryName: { type: Type.STRING, description: "The name of the category that unites the correct items." },
        correctItems: {
            type: Type.ARRAY,
            description: "A list of 4 to 6 items that belong to the category.",
            items: { type: Type.STRING }
        },
        intruder: { type: Type.STRING, description: "A single item that is related but does NOT belong to the category." }
    },
    required: ["categoryName", "correctItems", "intruder"]
};

const categorizeGameSchema = {
    type: Type.OBJECT,
    properties: {
        categories: {
            type: Type.ARRAY,
            description: "A list of 2 to 4 categories, each with a name and a list of items belonging to it.",
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: "The name of the category." },
                    items: {
                        type: Type.ARRAY,
                        description: "A list of items (3 to 6 items) for this category.",
                        items: { type: Type.STRING }
                    }
                },
                required: ["name", "items"]
            }
        }
    },
    required: ["categories"]
};

const allGamesSchemaWithNames = {
    type: Type.OBJECT,
    properties: {
        memory: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, data: memoryGameSchema }, required: ['name', 'data'] },
        association: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, data: associationGameSchema }, required: ['name', 'data'] },
        order: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, data: orderGameSchema }, required: ['name', 'data'] },
        intruder: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, data: intruderGameSchema }, required: ['name', 'data'] },
        categorize: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, data: categorizeGameSchema }, required: ['name', 'data'] },
    }
};

const frequencyAnalysisSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            id: { type: Type.STRING, description: "O ID do tópico ou subtópico." },
            frequency: {
                type: Type.STRING,
                description: "O nível de frequência, que deve ser 'alta', 'media', 'baixa', ou 'nenhuma'."
            }
        },
        required: ["id", "frequency"]
    }
};


const parseJsonResponse = <T,>(jsonString: string, expectedType: 'array' | 'object'): T => {
    try {
        let cleanJsonString = jsonString;
        const codeBlockRegex = /```(json)?\s*([\s\S]*?)\s*```/;
        const match = codeBlockRegex.exec(jsonString);
        if (match && match[2]) {
            cleanJsonString = match[2];
        }

        const parsed = JSON.parse(cleanJsonString);
        if (expectedType === 'array' && !Array.isArray(parsed)) {
            throw new Error("A resposta da IA não é um array.");
        }
        if (expectedType === 'object' && (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null)) {
            throw new Error("A resposta da IA não é um objeto.");
        }
        return parsed;
    } catch(e) {
        console.error("Erro ao fazer o parse da resposta JSON da IA: ", e);
        console.error("String recebida:", jsonString);
        throw new Error("A resposta da IA não está em um formato JSON válido.");
    }
}


export const generateQuestionsFromPdf = async (
  pdfBase64: string,
  questionCount: number = 20,
  generateJustifications: boolean
): Promise<Omit<Question, 'id'>[]> => {
  try {
    const pdfPart = {
      inlineData: {
        mimeType: 'application/pdf',
        data: pdfBase64,
      },
    };
    
    const justificationPromptPart = generateJustifications
      ? "e um array 'optionJustifications'. O array 'optionJustifications' deve conter um objeto para cada uma das 5 alternativas, com as chaves 'option' (o texto da alternativa) e 'justification' (a explicação)."
      : "O campo 'optionJustifications' deve ser um array vazio.";
    
    const textPart = {
        text: `Com base no conteúdo deste documento PDF, gere um array JSON de ${questionCount} questões de múltipla escolha. Cada questão deve ter: enunciado, 5 alternativas ('options'), resposta correta ('correctAnswer'), uma justificativa geral para a resposta correta ('justification') ${justificationPromptPart} Siga estritamente o schema JSON fornecido.`
    };

    const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [textPart, pdfPart] },
        config: {
            responseMimeType: "application/json",
            responseSchema: questionSchema,
        }
    }));

    const generatedQuestions = parseJsonResponse<any[]>(response.text?.trim() ?? '', 'array');
    
    return generatedQuestions.map((q: any) => {
        const cleanedOptions = (q.options || []).map(stripOptionPrefix);
        const cleanedCorrectAnswer = stripOptionPrefix(q.correctAnswer || '');
        
        const cleanedOptionJustifications: { [key: string]: string } = {};
        if (Array.isArray(q.optionJustifications)) {
            q.optionJustifications.forEach((item: { option: string; justification: string }) => {
                if (item.option && item.justification) {
                    cleanedOptionJustifications[stripOptionPrefix(item.option)] = item.justification;
                }
            });
        }
        
        return {
            statement: q.statement,
            options: shuffleArray(cleanedOptions),
            correctAnswer: cleanedCorrectAnswer,
            justification: q.justification,
            optionJustifications: cleanedOptionJustifications,
        };
    });

  } catch (error) {
    console.error("Erro ao gerar questões com a IA:", error);
    throw new Error("Não foi possível gerar as questões. A API pode estar sobrecarregada. Tente novamente mais tarde.");
  }
};

export const generateQuestionsFromText = async (
  text: string,
  questionCount: number = 20,
  generateJustifications: boolean
): Promise<Omit<Question, 'id'>[]> => {
    try {
        const justificationPromptPart = generateJustifications
            ? "e um array 'optionJustifications'. O array 'optionJustifications' deve conter um objeto para cada uma das 5 alternativas, com as chaves 'option' (o texto da alternativa) e 'justification' (a explicação)."
            : "O campo 'optionJustifications' deve ser um array vazio.";
            
        const prompt = `Com base no seguinte texto, gere um array JSON de ${questionCount} questões de múltipla escolha. Cada questão deve ter: enunciado, 5 alternativas ('options'), resposta correta ('correctAnswer'), uma justificativa geral para a resposta correta ('justification') ${justificationPromptPart} Siga estritamente o schema JSON fornecido.\n\nTexto: """${text}"""`;

        const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: questionSchema,
            }
        }));

        const generatedQuestions = parseJsonResponse<any[]>(response.text?.trim() ?? '', 'array');
        
         return generatedQuestions.map((q: any) => {
            const cleanedOptions = (q.options || []).map(stripOptionPrefix);
            const cleanedCorrectAnswer = stripOptionPrefix(q.correctAnswer || '');
            
            const cleanedOptionJustifications: { [key: string]: string } = {};
            if (Array.isArray(q.optionJustifications)) {
                q.optionJustifications.forEach((item: { option: string; justification: string }) => {
                    if (item.option && item.justification) {
                        cleanedOptionJustifications[stripOptionPrefix(item.option)] = item.justification;
                    }
                });
            }
            
            return {
                statement: q.statement,
                options: shuffleArray(cleanedOptions),
                correctAnswer: cleanedCorrectAnswer,
                justification: q.justification,
                optionJustifications: cleanedOptionJustifications,
            };
        });
    } catch (error) {
        console.error("Erro ao gerar questões com a IA a partir de texto:", error);
        throw new Error("Não foi possível gerar as questões. A API pode estar sobrecarregada. Tente novamente mais tarde.");
    }
};

export const generateCustomQuizQuestions = async (params: {
    source: { type: 'theme'; content: string } | { type: 'text'; content: string } | { type: 'pdf'; content: string };
    questionCount: number;
    questionType: 'multiple_choice' | 'true_false';
    numAlternatives?: number;
    difficulty: 'Fácil' | 'Médio' | 'Difícil' | 'Misto';
}): Promise<Omit<Question, 'id'>[]> => {
    try {
        const { source, questionCount, questionType, numAlternatives, difficulty } = params;

        const optionsDescription = questionType === 'true_false'
            ? "exatamente 2 alternativas ('Certo', 'Errado')"
            : `exatamente ${numAlternatives || 5} alternativas de resposta`;

        let contents: any;

        const basePrompt = `Aja como um especialista em criar provas para concursos públicos. Gere um array JSON de ${questionCount} questões do tipo "${questionType === 'true_false' ? 'Certo ou Errado' : 'Múltipla Escolha'}" no nível de dificuldade "${difficulty}". As questões devem ser bem elaboradas, no estilo de concurso, e com alternativas plausíveis que testem o conhecimento do candidato. Cada questão deve ter: um enunciado claro, ${optionsDescription}, a resposta correta ('correctAnswer'), uma justificativa geral para a resposta correta ('justification'), e um array 'optionJustifications' com justificativas para CADA alternativa. Siga estritamente o schema JSON fornecido.`;

        if (source.type === 'theme') {
            const prompt = `${basePrompt} O tema das questões deve ser: "${source.content}".`;
            contents = prompt;
        } else {
            const sourcePrompt = `Com base no conteúdo do ${source.type === 'pdf' ? 'documento PDF' : 'texto'} a seguir, ${basePrompt.toLowerCase()}`;
            if (source.type === 'pdf') {
                contents = { parts: [{ text: sourcePrompt }, { inlineData: { mimeType: 'application/pdf', data: source.content } }] };
            } else { // text
                contents = `${sourcePrompt}\n\nTexto: """${source.content}"""`;
            }
        }
        
        const customQuestionSchema = JSON.parse(JSON.stringify(questionSchema)); // Deep copy
        if (questionType === 'multiple_choice' && numAlternatives) {
            customQuestionSchema.items.properties.options.description = `Um array com exatamente ${numAlternatives} alternativas de resposta.`;
        }

        const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
            config: {
                responseMimeType: "application/json",
                responseSchema: customQuestionSchema,
            }
        }));

        const generatedQuestions = parseJsonResponse<any[]>(response.text?.trim() ?? '', 'array');

        return generatedQuestions.slice(0, questionCount).map((q: any) => {
            const cleanedOptions = (q.options || []).map(stripOptionPrefix);
            const cleanedCorrectAnswer = stripOptionPrefix(q.correctAnswer || '');
            
            const cleanedOptionJustifications: { [key: string]: string } = {};
            if (Array.isArray(q.optionJustifications)) {
                q.optionJustifications.forEach((item: { option: string; justification: string }) => {
                    if (item.option && item.justification) {
                        cleanedOptionJustifications[stripOptionPrefix(item.option)] = item.justification;
                    }
                });
            }
            
            return {
                statement: q.statement,
                options: shuffleArray(cleanedOptions),
                correctAnswer: cleanedCorrectAnswer,
                justification: q.justification,
                optionJustifications: cleanedOptionJustifications,
            };
        });

    } catch (error) {
        console.error("Erro ao gerar questões personalizadas com a IA:", error);
        throw new Error("Não foi possível gerar as questões. A API pode estar sobrecarregada ou os parâmetros são inválidos. Tente novamente.");
    }
};

export const extractQuestionsFromTecPdf = async (
    pdfBase64: string,
    generateJustifications: boolean
): Promise<Omit<Question, 'id'>[]> => {
    try {
        const pdfPart = {
            inlineData: {
                mimeType: 'application/pdf',
                data: pdfBase64,
            },
        };
        
        const justificationPromptPart = generateJustifications
            ? "A partir do 'Comentário do Professor', gere também um array 'optionJustifications' com uma justificativa individual para CADA alternativa. Cada item no array deve ser um objeto com as chaves 'option' (o texto exato da alternativa) e 'justification' (a explicação)."
            : "O campo 'optionJustifications' deve ser um array vazio.";
        
        const textPart = {
            text: `Analise este PDF do TEC Concursos. Para cada questão, extraia: 1) o enunciado, 2) as 5 alternativas, 3) a alternativa correta (Gabarito). Gere também uma 'justification' principal para a alternativa correta baseada no 'Comentário do Professor'. ${justificationPromptPart} Preserve formatação com Markdown. Formate a saída como um array de objetos JSON, seguindo estritamente o schema.`
        };

        const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [textPart, pdfPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: questionSchema,
            }
        }));

        const generatedQuestions = parseJsonResponse<any[]>(response.text?.trim() ?? '', 'array');
        return generatedQuestions.map((q: any) => {
            const cleanedOptions = (q.options || []).map(stripOptionPrefix);
            const cleanedCorrectAnswer = stripOptionPrefix(q.correctAnswer || '');

            const cleanedOptionJustifications: { [key: string]: string } = {};
            if (Array.isArray(q.optionJustifications)) {
                q.optionJustifications.forEach((item: { option: string; justification: string }) => {
                    if (item.option && item.justification) {
                        cleanedOptionJustifications[stripOptionPrefix(item.option)] = item.justification;
                    }
                });
            }
            
            return {
                statement: q.statement,
                options: shuffleArray(cleanedOptions),
                correctAnswer: cleanedCorrectAnswer,
                justification: q.justification,
                optionJustifications: cleanedOptionJustifications,
            };
        });

    } catch (error) {
        console.error("Erro ao extrair questões do PDF do TEC:", error);
        throw new Error("Não foi possível extrair as questões. A API pode estar sobrecarregada. Tente um arquivo diferente ou verifique o console.");
    }
};

export const extractQuestionsFromTecText = async (
    text: string,
    generateJustifications: boolean
): Promise<Omit<Question, 'id'>[]> => {
    try {
        const justificationPromptPart = generateJustifications
            ? "A partir do 'Comentário do Professor', gere também um array 'optionJustifications' com uma justificativa individual para CADA alternativa. Cada item no array deve ser um objeto com as chaves 'option' (o texto exato da alternativa) e 'justification' (a explicação)."
            : "O campo 'optionJustifications' deve ser um array vazio.";

        const prompt = `Analise este texto do TEC Concursos. Para cada questão, extraia: 1) o enunciado, 2) as 5 alternativas, 3) a alternativa correta (Gabarito). Gere também uma 'justification' principal para a alternativa correta baseada no 'Comentário do Professor'. ${justificationPromptPart} Preserve formatação com Markdown. Formate a saída como um array de objetos JSON, seguindo estritamente o schema.\n\nTexto: """${text}"""`;

        const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: questionSchema,
            }
        }));

        const generatedQuestions = parseJsonResponse<any[]>(response.text?.trim() ?? '', 'array');
        return generatedQuestions.map((q: any) => {
            const cleanedOptions = (q.options || []).map(stripOptionPrefix);
            const cleanedCorrectAnswer = stripOptionPrefix(q.correctAnswer || '');

            const cleanedOptionJustifications: { [key: string]: string } = {};
             if (Array.isArray(q.optionJustifications)) {
                q.optionJustifications.forEach((item: { option: string; justification: string }) => {
                    if (item.option && item.justification) {
                        cleanedOptionJustifications[stripOptionPrefix(item.option)] = item.justification;
                    }
                });
            }
            
            return {
                statement: q.statement,
                options: shuffleArray(cleanedOptions),
                correctAnswer: cleanedCorrectAnswer,
                justification: q.justification,
                optionJustifications: cleanedOptionJustifications,
            };
        });

    } catch (error) {
        console.error("Erro ao extrair questões do texto do TEC:", error);
        throw new Error("Não foi possível extrair as questões do texto. A API pode estar sobrecarregada. Tente novamente mais tarde.");
    }
};

export const generateSmartReview = async (
    progress: StudentProgress,
    allSubjects: Subject[],
): Promise<Question[]> => {
    try {
        // Build a comprehensive question bank from all subjects
        const questionBank: (Question & {subjectName: string, topicName: string})[] = [];
        allSubjects.forEach(subject => {
            subject.topics.forEach(topic => {
                topic.questions.forEach(question => {
                    questionBank.push({ ...question, subjectName: subject.name, topicName: topic.name });
                });
                topic.subtopics.forEach(subtopic => {
                    subtopic.questions.forEach(question => {
                        questionBank.push({ ...question, subjectName: subject.name, topicName: subtopic.name });
                    });
                })
            });
        });
        
        if (questionBank.length < 15) {
            // Not enough questions for a meaningful review
            return questionBank;
        }

        const textPart = {
            text: `Você é um tutor de IA especialista em preparação para concursos. Sua tarefa é criar uma sessão de revisão inteligente e personalizada para um aluno.
            
            Abaixo estão dois blocos de dados em JSON:
            1. 'studentProgress': Contém o histórico de desempenho do aluno, incluindo pontuações por tópico e últimas tentativas. Um score baixo (menor que 0.7) indica dificuldade.
            2. 'questionBank': Uma lista completa de todas as questões disponíveis.

            Analise o 'studentProgress' para identificar os tópicos onde o aluno tem maior dificuldade. Com base nessa análise, selecione um conjunto de 15 questões do 'questionBank' que reforcem esses pontos fracos. Priorize questões dos tópicos com piores scores.
            
            Retorne um array JSON contendo APENAS os 15 objetos de questão selecionados, seguindo estritamente o schema fornecido.

            ### DADOS ###
            'studentProgress': ${JSON.stringify(progress)}
            
            'questionBank': ${JSON.stringify(questionBank)}
            `
        };

        const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: questionSchema,
            }
        }));
        
        const reviewQuestions = parseJsonResponse<Question[]>(response.text?.trim() ?? '', 'array');
        return reviewQuestions;

    } catch (error) {
        console.error("Erro ao gerar revisão inteligente:", error);
        throw new Error("Não foi possível gerar a revisão inteligente. Verifique se há dados de progresso suficientes.");
    }
};

export const generateTopicsFromText = async (
  text: string,
): Promise<{name: string, description: string, subtopics: {name: string, description: string}[]}[]> => {
    try {
        const textPart = {
            text: `A partir do texto a seguir, que é um índice ou resumo de material de estudo para concurso, extraia os principais tópicos e seus respectivos subtópicos. Para cada tópico e subtópico, forneça um nome e uma breve descrição. Se um tópico não tiver subtópicos evidentes, retorne um array 'subtopics' vazio para ele. Formate a saída como um array JSON, seguindo estritamente o schema fornecido. Texto: """${text}"""`
        };

        const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: topicGenerationSchema,
            }
        }));

        const generatedTopics = parseJsonResponse<any[]>(response.text?.trim() ?? '', 'array');

        // Validate and structure the response
        return generatedTopics.map((t: any) => ({
            name: t.name,
            description: t.description,
            subtopics: Array.isArray(t.subtopics) ? t.subtopics.map((st: any) => ({
                name: st.name,
                description: st.description
            })) : [],
        }));

    } catch (error) {
        console.error("Erro ao gerar tópicos com a IA:", error);
        throw new Error("Não foi possível gerar os tópicos. Verifique o console para mais detalhes.");
    }
};

export const generateFlashcardsFromPdf = async (
  pdfBase64: string,
): Promise<Omit<Flashcard, 'id'>[]> => {
  try {
    const pdfPart = {
      inlineData: {
        mimeType: 'application/pdf',
        data: pdfBase64,
      },
    };
    
    const textPart = {
        text: `Com base no conteúdo deste documento PDF, identifique os principais termos, conceitos e suas definições. Gere um array JSON de flashcards para estudo. Cada flashcard deve ter uma frente ('front') com o termo/conceito e um verso ('back') com a definição clara e concisa. Siga estritamente o schema JSON fornecido.`
    };

    const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [textPart, pdfPart] },
        config: {
            responseMimeType: "application/json",
            responseSchema: flashcardSchema,
        }
    }));

    const generatedFlashcards = parseJsonResponse<any[]>(response.text?.trim() ?? '', 'array');
    
    return generatedFlashcards.map((f: any) => ({
        front: f.front,
        back: f.back,
    }));

  } catch (error) {
    console.error("Erro ao gerar flashcards com a IA:", error);
    throw new Error("Não foi possível gerar os flashcards. Verifique o console para mais detalhes.");
  }
};

export const analyzeStudentDifficulties = async (
    questions: (Question & { topicName: string; subjectName: string; })[],
    attempts: QuestionAttempt[]
): Promise<string> => {
    try {
        const incorrectAttempts = attempts.filter(a => !a.isCorrect);
        if (incorrectAttempts.length < 5) {
            return "Não há dados suficientes sobre erros para uma análise aprofundada. Incentive os alunos a praticarem mais.";
        }

        const dataForAnalysis = incorrectAttempts.map(attempt => {
            const question = questions.find(q => q.id === attempt.questionId);
            return {
                questionStatement: question?.statement,
                selectedAnswer: attempt.selectedAnswer,
                correctAnswer: question?.correctAnswer,
                topic: question?.topicName,
                subject: question?.subjectName
            };
        });

        const prompt = `Como um tutor especialista em concursos, analise o seguinte conjunto de erros cometidos por uma turma de alunos. Identifique os padrões de dificuldade, os tópicos mais problemáticos e os tipos de erro mais comuns (ex: erro de interpretação, confusão entre conceitos, falta de atenção). Forneça um resumo conciso e acionável para o professor, com sugestões de como abordar esses pontos fracos. Formate a resposta em markdown. Dados dos erros: ${JSON.stringify(dataForAnalysis)}`;
        
        const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        }));

        return response.text?.trim() ?? "Não foi possível gerar a análise no momento.";

    } catch (error) {
        console.error("Erro ao analisar dificuldades com a IA:", error);
        throw new Error("Não foi possível completar a análise. Verifique o console para detalhes.");
    }
};

export const getAiExplanationForText = async (text: string): Promise<string> => {
    const prompt = `Explique o seguinte texto de forma clara e didática, como se fosse para um aluno de concurso que está vendo o assunto pela primeira vez. Use analogias e exemplos simples, se possível. Formate a resposta em markdown. Texto: "${text}"`;
    const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    }));
    return response.text?.trim() ?? "Não foi possível gerar a explicação.";
};

export const getAiSummaryForText = async (text: string): Promise<string> => {
    const prompt = `Resuma o seguinte texto em pontos-chave (bullet points), focando nos conceitos mais importantes para memorização em um concurso. Formate a resposta em markdown. Texto: "${text}"`;
    const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    }));
    return response.text?.trim() ?? "Não foi possível gerar o resumo.";
};

export const getAiQuestionForText = async (text: string): Promise<Omit<Question, 'id'>> => {
     const prompt = `Com base no texto a seguir, crie UMA questão de múltipla escolha (com 5 alternativas) no estilo de concurso. A questão deve ser desafiadora, mas justa. Forneça a alternativa correta e uma justificativa detalhada para a resposta correta e para as incorretas. Formate a saída como um único objeto JSON, seguindo estritamente o schema fornecido. Texto: "${text}"`;
     
      const singleQuestionSchema = {
        type: Type.OBJECT,
        properties: questionSchema.items.properties,
        required: questionSchema.items.required,
    };
     
    const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: singleQuestionSchema
        }
    }));

    const generatedQuestion = parseJsonResponse<any>(response.text?.trim() ?? '', 'object');
    const cleanedOptions = (generatedQuestion.options || []).map(stripOptionPrefix);
    const cleanedCorrectAnswer = stripOptionPrefix(generatedQuestion.correctAnswer || '');

    const cleanedOptionJustifications: { [key: string]: string } = {};
    if (Array.isArray(generatedQuestion.optionJustifications)) {
        generatedQuestion.optionJustifications.forEach((item: { option: string; justification: string }) => {
            if (item.option && item.justification) {
                cleanedOptionJustifications[stripOptionPrefix(item.option)] = item.justification;
            }
        });
    }

    return {
        statement: generatedQuestion.statement,
        options: shuffleArray(cleanedOptions),
        correctAnswer: cleanedCorrectAnswer,
        justification: generatedQuestion.justification,
        optionJustifications: cleanedOptionJustifications,
    };
};

export const startTopicChat = (topic: Topic | SubTopic, subject: Subject): Chat => {
    const systemInstruction = `Você é um tutor de IA amigável e especialista na disciplina de "${subject.name}". Seu foco é ajudar o aluno a entender o tópico específico de "${topic.name}". Seja conciso, didático e incentive o aprendizado. Não responda sobre outros tópicos ou assuntos.`;
    return ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: systemInstruction,
        },
    });
};

export const generateFlashcardsFromIncorrectAnswers = async (incorrectQuestions: Question[]): Promise<Omit<Flashcard, 'id'>[]> => {
    const prompt = `Analise a lista de questões que um aluno errou. Para cada questão, crie um flashcard que ajude a solidificar o conhecimento correto. A frente do flashcard deve ser uma pergunta direta ou um termo-chave, e o verso deve ser a resposta ou definição concisa. Foque no "porquê" da resposta correta. Retorne um array de objetos JSON de flashcards, seguindo estritamente o schema fornecido. Questões erradas: ${JSON.stringify(incorrectQuestions)}`;

    const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: flashcardSchema,
        }
    }));

    const generatedFlashcards = parseJsonResponse<any[]>(response.text?.trim() ?? '', 'array');
    return generatedFlashcards.map((f: any) => ({ front: f.front, back: f.back }));
};

export const generateQuizFeedback = async (questions: Question[], attempts: QuestionAttempt[]): Promise<string> => {
    const prompt = `Você é um tutor de IA. Analise o desempenho do aluno neste quiz. Forneça um feedback construtivo e motivacional. Identifique os padrões de erro (se houver) e dê dicas de estudo personalizadas com base nas questões erradas. Formate a resposta em markdown. Dados do Quiz: Questões: ${JSON.stringify(questions)}, Respostas do Aluno: ${JSON.stringify(attempts)}`;
    const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    }));
    return response.text?.trim() ?? "Não foi possível gerar o feedback.";
};

export const analyzeEditalFromPdf = async (pdfBase64: string): Promise<EditalInfo> => {
  const pdfPart = { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } };
  const textPart = { text: "Analise o conteúdo deste edital de concurso público e extraia as informações estruturadas conforme o schema JSON fornecido. Preencha todos os campos da forma mais completa e precisa possível." };
  
  const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: [textPart, pdfPart] },
    config: {
      responseMimeType: "application/json",
      responseSchema: editalAnalysisSchema,
    }
  }));

  return parseJsonResponse<EditalInfo>(response.text?.trim() ?? '', 'object');
};

export const analyzeEditalFromUrl = async (_url: string): Promise<EditalInfo> => {
    // This is a placeholder. In a real backend scenario, you would fetch the URL,
    // get the PDF content, and then pass it to the analysis function.
    // For a pure frontend app, we can't directly fetch cross-origin URLs like this.
    // We will simulate this by asking the user to upload for now.
    // The Gemini API itself does not fetch URLs.
    throw new Error("A análise de URL não é suportada diretamente. Por favor, faça o upload do arquivo PDF.");
};

export const generateReviewSummaryForIncorrectQuestions = async (incorrectQuestions: Question[]): Promise<string> => {
    const prompt = `Como um tutor de IA, analise as seguintes questões que um aluno errou. Crie um resumo conciso dos principais tópicos e conceitos que o aluno precisa revisar, com base nessas questões. Formate a resposta em markdown. Questões erradas: ${JSON.stringify(incorrectQuestions.map(q => ({ statement: q.statement, justification: q.justification })))}`;
    const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    }));
    return response.text?.trim() ?? "Não foi possível gerar o resumo no momento.";
};

export const generateJustificationsForQuestion = async (
    question: Pick<Question, 'statement' | 'options' | 'correctAnswer'>
): Promise<{ [optionText: string]: string }> => {
    const prompt = `Dada a seguinte questão de múltipla escolha, gere uma justificativa concisa para CADA uma das alternativas, explicando por que ela está correta ou incorreta.
    
    Enunciado: "${question.statement}"
    Alternativas: ${JSON.stringify(question.options)}
    Resposta Correta: "${question.correctAnswer}"

    Retorne um objeto JSON onde cada chave é o texto exato de uma alternativa e o valor é sua respectiva justificativa.`;

    // Dynamically construct the 'properties' object for the schema.
    // Each option from the question becomes a required key in the JSON response.
    const properties: { [key: string]: { type: Type, description: string } } = {};
    question.options.forEach(option => {
        properties[option] = {
            type: Type.STRING,
            description: `A justificativa para a alternativa: "${option.slice(0, 80)}..."`
        };
    });

    const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: properties,
                required: question.options // Ensure all options have justifications
            }
        }
    }));

    return parseJsonResponse<{ [optionText: string]: string }>(response.text?.trim() ?? '', 'object');
};

export const generateGameFromPdf = async (
  pdfBase64: string,
  gameType: MiniGameType
): Promise<MemoryGameData | AssociationGameData | OrderGameData | IntruderGameData | CategorizeGameData> => {

    const pdfPart = {
      inlineData: {
        mimeType: 'application/pdf',
        data: pdfBase64,
      },
    };

    let schema: any;
    let prompt: string;

    switch (gameType) {
        case 'memory':
            schema = memoryGameSchema;
            prompt = "Analyze the provided PDF document and extract 8 to 15 key terms or very short concepts to create data for a memory game. Return a JSON object with a single key 'items' containing an array of these strings.";
            break;
        case 'association':
            schema = associationGameSchema;
            prompt = "From the PDF, extract several key concepts and their corresponding definitions. Format this as a JSON object with a 'pairs' key, which is an array of objects, each having 'concept' and 'definition' keys.";
            break;
        case 'order':
            schema = orderGameSchema;
            prompt = "Identify a process, timeline, or a sequence of 3 to 8 steps in the PDF. Create data for an ordering game. Return a JSON object with a 'description' (e.g., 'Order the steps of the process') and an 'items' array with the steps in the correct sequence.";
            break;
        case 'intruder':
            schema = intruderGameSchema;
            prompt = "Find a clear category with 4-6 members in the PDF. Also find one 'intruder' item that is related but does not belong to that category. Return a JSON object with 'categoryName', an array 'correctItems', and the 'intruder' string.";
            break;
        case 'categorize':
            schema = categorizeGameSchema;
            prompt = "Identify 2 to 4 distinct categories in the PDF and list 3 to 6 items for each. Format this as a JSON object with a 'categories' key, which is an array of objects, each having 'name' and an 'items' array.";
            break;
        default:
            throw new Error("Unsupported game type for AI generation.");
    }
    
    try {
        const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{text: prompt}, pdfPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        }));
    
        const gameData = parseJsonResponse<any>(response.text?.trim() ?? '', 'object');
        return gameData;
    } catch (error) {
        console.error(`Error generating ${gameType} game with AI:`, error);
        throw new Error(`Failed to generate the ${gameType} game data. Please check the PDF content or try a different game type.`);
    }
};

export const generateGameFromText = async (
  text: string,
  gameType: MiniGameType
): Promise<MemoryGameData | AssociationGameData | OrderGameData | IntruderGameData | CategorizeGameData> => {

    let schema: any;
    let prompt: string;

    const basePrompt = `Analise o seguinte texto e gere os dados para um jogo do tipo '${gameType}'. Siga estritamente o schema JSON fornecido.\n\nTexto: """${text}"""`;

    switch (gameType) {
        case 'memory':
            schema = memoryGameSchema;
            prompt = basePrompt + "\nExtraia 8 a 15 termos chave ou conceitos curtos.";
            break;
        case 'association':
            schema = associationGameSchema;
            prompt = basePrompt + "\nExtraia vários conceitos chave e suas definições correspondentes.";
            break;
        case 'order':
            schema = orderGameSchema;
            prompt = basePrompt + "\nIdentifique um processo, linha do tempo ou sequência de 3 a 8 passos.";
            break;
        case 'intruder':
            schema = intruderGameSchema;
            prompt = basePrompt + "\nEncontre uma categoria clara com 4-6 membros e um item 'intruso' que seja relacionado mas não pertença à categoria.";
            break;
        case 'categorize':
            schema = categorizeGameSchema;
            prompt = basePrompt + "\nIdentifique 2 a 4 categorias distintas e liste 3 a 6 itens para cada uma.";
            break;
        default:
            throw new Error("Unsupported game type for AI generation.");
    }
    
    try {
        const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        }));
    
        const gameData = parseJsonResponse<any>(response.text?.trim() ?? '', 'object');
        return gameData;
    } catch (error) {
        console.error(`Error generating ${gameType} game from text with AI:`, error);
        throw new Error(`Failed to generate the ${gameType} game data. Please check the text content or try a different game type.`);
    }
};

export const generateAllGamesFromText = async (text: string): Promise<Omit<MiniGame, 'id'>[]> => {
    const prompt = `A partir do texto fornecido, gere dados para o maior número possível de tipos de jogos diferentes. Se um tipo de jogo não for aplicável ao texto, omita-o da resposta. Dê um nome criativo para cada jogo gerado, baseado no conteúdo. Retorne um objeto JSON seguindo o schema fornecido. Texto: """${text}"""`;
    
    try {
        const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: allGamesSchemaWithNames,
            }
        }));

        const result = parseJsonResponse<any>(response.text?.trim() ?? '', 'object');
        const games: Omit<MiniGame, 'id'>[] = [];

        Object.keys(result).forEach((gameType) => {
            const gameInfo = result[gameType as MiniGameType];
            if (gameInfo && gameInfo.data) {
                games.push({
                    type: gameType as MiniGameType,
                    name: gameInfo.name,
                    data: gameInfo.data
                });
            }
        });

        return games;
    } catch (error) {
        console.error(`Error generating all games from text with AI:`, error);
        throw new Error(`Failed to generate the games. Please check the text content or try again.`);
    }
};


export const generateAdaptiveStudyPlan = async (
    subjects: Subject[],
    progress: StudentProgress,
    days: number = 7,
): Promise<StudyPlan['plan']> => {
    const allTopics = subjects.flatMap(s =>
        s.topics.flatMap(t => [
            { id: t.id, name: t.name, subjectName: s.name, score: progress.progressByTopic[s.id]?.[t.id]?.score, completed: progress.progressByTopic[s.id]?.[t.id]?.completed || false },
            ...t.subtopics.map(st => ({ id: st.id, name: st.name, subjectName: s.name, score: progress.progressByTopic[s.id]?.[st.id]?.score, completed: progress.progressByTopic[s.id]?.[st.id]?.completed || false }))
        ])
    );
    
    const today = new Date();
    const futureDates: string[] = [];
    for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        futureDates.push(date.toISOString().split('T')[0]);
    }

    const prompt = `
        Você é um tutor de IA especialista em criar planos de estudo adaptativos para concursos.
        Sua tarefa é criar um plano de estudo para os próximos ${days} dias.

        DADOS:
        1.  **allTopics**: Uma lista de todos os tópicos disponíveis, incluindo o progresso do aluno (score e se foi concluído). Um score baixo (menor que 0.7) indica dificuldade.
            \`\`\`json
            ${JSON.stringify(allTopics)}
            \`\`\`
        2.  **futureDates**: As datas para as quais o plano deve ser criado.
            \`\`\`json
            ${JSON.stringify(futureDates)}
            \`\`\`

        INSTRUÇÕES:
        1.  Analise os tópicos em 'allTopics'. Priorize os tópicos que o aluno ainda não completou ('completed: false') e aqueles com 'score' baixo.
        2.  Distribua de 2 a 3 tópicos por dia entre as datas fornecidas em 'futureDates'. Evite colocar muitos tópicos do mesmo assunto no mesmo dia.
        3.  Tópicos já concluídos com score alto (acima de 0.9) devem ter baixa prioridade.
        4.  Retorne a resposta como um objeto JSON. As chaves devem ser as datas no formato 'YYYY-MM-DD', e os valores devem ser um array de IDs de tópicos (strings).
        5.  Não agende estudos para sábado e domingo, a menos que seja estritamente necessário para cobrir os tópicos com baixa performance.

        SCHEMA:
        \`\`\`json
        {
            "type": "OBJECT",
            "properties": {
                "${futureDates[0]}": { "type": "ARRAY", "items": { "type": "STRING" } },
                "${futureDates[1]}": { "type": "ARRAY", "items": { "type": "STRING" } }
            },
            "additionalProperties": {
                "type": "ARRAY",
                "items": { "type": "STRING" }
            }
        }
        \`\`\`
    `;

    const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
        }
    }));

    return parseJsonResponse<StudyPlan['plan']>(response.text?.trim() ?? '', 'object');
};


export const generateGlossaryFromPdf = async (pdfBase64: string): Promise<GlossaryTerm[]> => {
    const pdfPart = { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } };
    const textPart = { text: "Analise este documento PDF e extraia os termos chave e suas definições para criar um glossário. Formate a saída como um array JSON, seguindo estritamente o schema." };

    const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [textPart, pdfPart] },
        config: {
            responseMimeType: "application/json",
            responseSchema: glossarySchema,
        }
    }));
    
    return parseJsonResponse<GlossaryTerm[]>(response.text?.trim() ?? '', 'array');
};

export const generatePortugueseChallenge = async (
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
    
    const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: questionSchema
        }
    }));

    const generatedQuestions = parseJsonResponse<any[]>(response.text?.trim() ?? '', 'array');

    return generatedQuestions.map((q: any) => {
        const cleanedOptionJustifications: { [key: string]: string } = {};
        if (Array.isArray(q.optionJustifications)) {
            q.optionJustifications.forEach((item: { option: string; justification: string }) => {
                if (item.option && item.justification) {
                    cleanedOptionJustifications[item.option] = item.justification;
                }
            });
        }
        
        return {
            statement: q.statement,
            options: q.options,
            correctAnswer: q.correctAnswer,
            justification: q.justification,
            optionJustifications: cleanedOptionJustifications,
            errorCategory: q.errorCategory,
        };
    });
};

export const analyzeTopicFrequencies = async (
    analysisText: string,
    topics: { id: string, name: string }[]
): Promise<{ [id: string]: 'alta' | 'media' | 'baixa' | 'nenhuma' }> => {
    const prompt = `
        Analise o seguinte texto, que contém estatísticas de frequência de tópicos em provas de concurso.
        Com base nesse texto, classifique cada um dos tópicos da lista fornecida como 'alta', 'media', 'baixa' ou 'nenhuma' frequência.
        
        Texto para análise:
        """${analysisText}"""

        Lista de tópicos para classificar (JSON):
        ${JSON.stringify(topics)}

        Retorne um array JSON contendo objetos, cada um com o 'id' do tópico e sua 'frequency' classificada.
        Siga estritamente o schema JSON fornecido.
    `;

    const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: frequencyAnalysisSchema
        }
    }));
    
    const results = parseJsonResponse<{ id: string, frequency: 'alta' | 'media' | 'baixa' | 'nenhuma' }[]>(response.text?.trim() ?? '', 'array');
    
    const frequencyMap: { [id: string]: 'alta' | 'media' | 'baixa' | 'nenhuma' } = {};
    results.forEach(item => {
        frequencyMap[item.id] = item.frequency;
    });

    return frequencyMap;
};

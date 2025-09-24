import { GoogleGenAI, Type, Chat, GenerateContentResponse } from "@google/genai";
import { Question, StudentProgress, Subject, QuestionAttempt, Topic, SubTopic, Flashcard, EditalInfo, MiniGameType, MemoryGameData, AssociationGameData, OrderGameData, IntruderGameData, CategorizeGameData, StudyPlan, GlossaryTerm, MiniGame } from '../types';

// FIX: Per @google/genai coding guidelines, API key must be from process.env.API_KEY
// The API key must be obtained exclusively from the environment variable process.env.API_KEY. 
// Assume this variable is pre-configured, valid, and accessible in the execution context where the API client is initialized.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
            propertyOrdering: ["option", "justification"]
          }
        },
        errorCategory: {
            type: Type.STRING,
            description: "A categoria do erro gramatical (ex: 'Crase', 'Concordância Verbal'). Apenas para questões de português. Para outros tipos, pode ser omitido."
        }
      },
      propertyOrdering: ["statement", "options", "correctAnswer", "justification", "optionJustifications", "errorCategory"],
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
                    propertyOrdering: ["name", "description"],
                }
            }
        },
        propertyOrdering: ["name", "description", "subtopics"],
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
      propertyOrdering: ["front", "back"],
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
        propertyOrdering: ["term", "definition"],
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
                propertyOrdering: ["cargo", "vagas", "cadastroReserva"]
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
                propertyOrdering: ["disciplina", "quantidade"]
            }
        },
        totalQuestoes: { type: Type.INTEGER, description: "Número total de questões da prova objetiva." },
        remuneracao: { type: Type.STRING, description: "Valor do salário inicial e benefícios, se houver." },
        dataProva: { type: Type.STRING, description: "Data da prova no formato AAAA-MM-DD. Se houver mais de uma, liste a principal." }
    },
    propertyOrdering: ["cargosEVagas", "requisitosEscolaridade", "bancaOrganizadora", "remuneracao", "dataProva", "formatoProva", "distribuicaoQuestoes", "totalQuestoes"]
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
    propertyOrdering: ["items"]
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
                propertyOrdering: ["concept", "definition"]
            }
        }
    },
    propertyOrdering: ["pairs"]
};

const orderGameSchema = {
    type: Type.OBJECT,
    properties: {
        description: { type: Type.STRING, description: "A short instruction for the user, like 'Order the historical events chronologically.'." },
        items: {
            
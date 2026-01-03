
import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';
import { GoogleGenAI } from "@google/genai";
import { StudentProgress, Subject, Question, Topic, SubTopic, QuestionAttempt } from '../src/types.server';

// Inicialização do Firebase Admin com tratamento robusto para Vercel
if (!admin.apps.length) {
    try {
        const privateKey = process.env.FIREBASE_PRIVATE_KEY 
            ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
            : undefined;

        if (!privateKey) {
            console.error("FIREBASE_PRIVATE_KEY não encontrada no ambiente.");
        }

        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                privateKey: privateKey,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            }),
        });
        console.log("Firebase Admin inicializado com sucesso.");
    } catch (e) {
        console.error("Erro fatal na inicialização do Firebase Admin:", e);
    }
}

const db = admin.firestore();

// Helper para limpar a resposta da IA e extrair apenas o JSON
const cleanJsonResponse = (text: string) => {
    try {
        let cleanText = text.trim();
        // Remove blocos de código markdown se existirem
        if (cleanText.includes('```')) {
            const matches = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (matches && matches[1]) {
                cleanText = matches[1];
            }
        }
        return JSON.parse(cleanText);
    } catch (e) {
        console.error("Erro ao fazer parse do JSON da Gemini:", text);
        throw new Error("A resposta da IA não pôde ser convertida em lista de questões.");
    }
};

const shuffleArray = <T>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

async function fetchEnrolledSubjects(studentId: string): Promise<Subject[]> {
    try {
        const coursesSnap = await db.collection('courses').where('enrolledStudentIds', 'array-contains', studentId).get();
        const subjectIds = new Set<string>();
        coursesSnap.docs.forEach(doc => {
            const data = doc.data();
            (data.disciplines || []).forEach((d: any) => {
                if (d.subjectId) subjectIds.add(d.subjectId);
            });
        });

        const subjects: Subject[] = [];
        const subjectIdsArray = Array.from(subjectIds);

        if (subjectIdsArray.length > 0) {
            // Firestore 'in' query limita a 10 itens por vez
            for (let i = 0; i < subjectIdsArray.length; i += 10) {
                const chunk = subjectIdsArray.slice(i, i + 10);
                const subjectDocs = await db.collection('subjects').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();
                
                for (const doc of subjectDocs.docs) {
                    const topicsSnap = await doc.ref.collection('topics').get();
                    subjects.push({ 
                        id: doc.id, 
                        ...doc.data(), 
                        topics: topicsSnap.docs.map(t => ({ id: t.id, ...t.data() } as Topic)) 
                    } as Subject);
                }
            }
        }
        return subjects;
    } catch (err) {
        console.error("Erro ao buscar disciplinas matriculadas:", err);
        throw new Error("Erro na comunicação com o banco de dados (Subjects).");
    }
}

async function getReviewPool(studentProgress: StudentProgress, subjects: Subject[]): Promise<Question[]> {
    if (subjects.length === 0) return [];
    
    const isAdvanced = studentProgress.dailyReviewMode === 'advanced';
    const filterType = isAdvanced ? (studentProgress.advancedReviewQuestionType || 'incorrect') : 'unanswered';
    const targetCount = isAdvanced ? (studentProgress.advancedReviewQuestionCount || 5) : 5;
    const selectedSubjectIds = isAdvanced ? (studentProgress.advancedReviewSubjectIds || []) : [];
    const selectedTopicIds = isAdvanced ? (studentProgress.advancedReviewTopicIds || []) : [];

    const everCorrect = new Set<string>();
    const everIncorrect = new Set<string>();
    const allAnswered = new Set<string>();

    const processAttempt = (a: QuestionAttempt) => {
        if (!a || !a.questionId) return;
        allAnswered.add(a.questionId);
        if (a.isCorrect) everCorrect.add(a.questionId);
        else everIncorrect.add(a.questionId);
    };

    // Mapear progresso existente
    Object.values(studentProgress.progressByTopic || {}).forEach(s => 
        Object.values(s || {}).forEach(t => (t.lastAttempt || []).forEach(processAttempt))
    );
    (studentProgress.reviewSessions || []).forEach(s => (s.attempts || []).forEach(processAttempt));

    let pool: Question[] = [];
    subjects.forEach(subject => {
        if (selectedSubjectIds.length > 0 && !selectedSubjectIds.includes(subject.id)) return;
        
        subject.topics.forEach(topic => {
            const processT = (t: Topic | SubTopic) => {
                if (selectedTopicIds.length > 0 && !selectedTopicIds.includes(t.id)) return;
                
                const normalQuestions = (t.questions || []).map(q => ({ ...q, subjectId: subject.id, topicId: t.id, subjectName: subject.name, topicName: t.name }));
                const tecQuestions = (t.tecQuestions || []).map(q => ({ ...q, subjectId: subject.id, topicId: t.id, subjectName: subject.name, topicName: t.name }));
                
                pool.push(...normalQuestions, ...tecQuestions);
            };
            
            processT(topic);
            (topic.subtopics || []).forEach(processT);
        });
    });

    let filtered: Question[] = [];
    switch (filterType) {
        case 'incorrect': filtered = pool.filter(q => everIncorrect.has(q.id)); break;
        case 'correct': filtered = pool.filter(q => everCorrect.has(q.id)); break;
        case 'unanswered': filtered = pool.filter(q => !allAnswered.has(q.id)); break;
        case 'mixed': default: filtered = pool; break;
    }
    
    // Fallback se não houver questões suficientes do tipo filtrado
    if (filtered.length < targetCount && pool.length > 0) {
        const remainingNeeded = targetCount - filtered.length;
        const usedIds = new Set(filtered.map(q => q.id));
        const remainingOptions = pool.filter(q => !usedIds.has(q.id));
        filtered = [...filtered, ...shuffleArray(remainingOptions).slice(0, remainingNeeded)];
    }
    
    return shuffleArray(filtered).slice(0, targetCount);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { apiKey, studentId, challengeType } = req.query;

    // 1. Verificação de API Key interna
    if (!apiKey || apiKey !== process.env.VITE_DAILY_CHALLENGE_API_KEY) {
        return res.status(401).json({ error: 'Não autorizado: Chave de API inválida.' });
    }

    // 2. Verificação de API Key do Gemini
    if (!process.env.API_KEY) {
        return res.status(500).json({ error: 'Configuração ausente: API_KEY do Gemini não definida.' });
    }

    try {
        console.log(`API Desafio: Iniciando ${challengeType} para aluno ${studentId}`);
        
        const studentDoc = await db.collection('studentProgress').doc(studentId as string).get();
        if (!studentDoc.exists) {
            return res.status(404).json({ error: 'Perfil do aluno não encontrado no banco de dados.' });
        }
        
        const studentProgress = studentDoc.data() as StudentProgress;
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        // --- TIPO: PORTUGUÊS ---
        if (challengeType === 'portuguese') {
            const targetCount = studentProgress.portugueseChallengeQuestionCount || 1;
            const prompt = `Gere ${targetCount} questões inéditas de múltipla escolha (A a E) de Língua Portuguesa nível superior para concursos. Foco em Gramática e Interpretação de Texto. Retorne um array JSON.`;
            
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: { 
                    responseMimeType: "application/json",
                    systemInstruction: "Você é um professor de português especialista em bancas como FGV, FCC e Cebraspe. Gere apenas o JSON solicitado."
                }
            });
            
            const items = cleanJsonResponse(response.text || '[]');
            return res.status(200).json(items);
        }

        // Para os demais desafios, precisamos das disciplinas
        const subjects = await fetchEnrolledSubjects(studentId as string);

        // --- TIPO: REVISÃO ---
        if (challengeType === 'review') {
            const items = await getReviewPool(studentProgress, subjects);
            return res.status(200).json(items);
        }

        // --- TIPO: GLOSSÁRIO ---
        if (challengeType === 'glossary') {
            const isAdvanced = studentProgress.glossaryChallengeMode === 'advanced';
            const targetCount = isAdvanced ? (studentProgress.glossaryChallengeQuestionCount || 5) : 5;
            const selSubIds = isAdvanced ? (studentProgress.advancedGlossarySubjectIds || []) : [];
            const selTopIds = isAdvanced ? (studentProgress.advancedGlossaryTopicIds || []) : [];

            const glossaryPool = subjects.flatMap(s => {
                if (selSubIds.length > 0 && !selSubIds.includes(s.id)) return [];
                return s.topics.flatMap(t => {
                    const terms = [];
                    if (selTopIds.length === 0 || selTopIds.includes(t.id)) {
                        terms.push(...(t.glossary || []));
                    }
                    (t.subtopics || []).forEach(st => {
                        if (selTopIds.length === 0 || selTopIds.includes(st.id)) {
                            terms.push(...(st.glossary || []));
                        }
                    });
                    return terms;
                });
            });

            // Remover duplicados por termo
            const uniqueTerms = Array.from(new Map(glossaryPool.map(t => [t.term.toLowerCase(), t])).values());
            
            if (uniqueTerms.length === 0) {
                return res.status(200).json([]);
            }

            const selectedTerms = shuffleArray(uniqueTerms).slice(0, targetCount);
            const items = selectedTerms.map(g => {
                // Tenta pegar definições de outros termos para usar como opções erradas
                const otherDefinitions = uniqueTerms
                    .filter(t => t.term !== g.term)
                    .map(t => t.definition);
                
                const distractors = shuffleArray(otherDefinitions).slice(0, 4);
                
                // Se não tiver distratores suficientes do banco, usa genéricos
                while(distractors.length < 4) {
                    distractors.push("Definição incorreta baseada em conceitos transversais da matéria.");
                }

                return {
                    id: `gloss-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    statement: `Sobre o termo técnico **${g.term}**, selecione a definição correta:`,
                    options: shuffleArray([g.definition, ...distractors]),
                    correctAnswer: g.definition,
                    justification: `O termo **${g.term}** é corretamente definido como: ${g.definition}.`
                };
            });
            
            return res.status(200).json(items);
        }

        return res.status(400).json({ error: `Tipo de desafio '${challengeType}' desconhecido.` });
        
    } catch (error: any) {
        console.error(`ERRO CRÍTICO na API (${challengeType}):`, error);
        
        // Retorna o erro real no body para depuração no console do navegador
        return res.status(500).json({ 
            error: "Falha interna no servidor ao processar o desafio.",
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}

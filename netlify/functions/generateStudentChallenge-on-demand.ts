
import { Handler, HandlerEvent } from '@netlify/functions';
import * as admin from 'firebase-admin';
import { GoogleGenAI } from "@google/genai";
import { StudentProgress, Subject, Question, Topic, SubTopic, QuestionAttempt } from '../../src/types.server';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}
const db = admin.firestore();

const shuffleArray = <T>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

async function getReviewPool(studentProgress: StudentProgress, subjects: Subject[]): Promise<Question[]> {
    if (subjects.length === 0) return [];

    const isAdvanced = studentProgress.dailyReviewMode === 'advanced';
    const filterType = isAdvanced ? (studentProgress.advancedReviewQuestionType || 'incorrect') : 'unanswered';
    const targetCount = isAdvanced ? (studentProgress.advancedReviewQuestionCount || 5) : 10;
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

    // Coleta histórico de todas as fontes possíveis
    Object.values(studentProgress.progressByTopic || {}).forEach(s => 
        Object.values(s || {}).forEach(t => (t.lastAttempt || []).forEach(processAttempt))
    );
    (studentProgress.reviewSessions || []).forEach(s => (s.attempts || []).forEach(processAttempt));
    (studentProgress.customQuizzes || []).forEach(s => (s.attempts || []).forEach(processAttempt));
    (studentProgress.simulados || []).forEach(s => (s.attempts || []).forEach(processAttempt));

    let pool: Question[] = [];
    subjects.forEach(subject => {
        // Se houver filtro de disciplinas, pula as que não estão incluídas
        if (selectedSubjectIds.length > 0 && !selectedSubjectIds.includes(subject.id)) return;

        subject.topics.forEach(topic => {
            const processT = (t: Topic | SubTopic) => {
                // Se houver filtro de tópicos, pula os que não estão incluídas
                if (selectedTopicIds.length > 0 && !selectedTopicIds.includes(t.id)) return;
                
                const questions = [
                    ...(t.questions || []).map(q => ({ ...q, subjectId: subject.id, topicId: t.id, subjectName: subject.name, topicName: t.name })),
                    ...(t.tecQuestions || []).map(q => ({ ...q, subjectId: subject.id, topicId: t.id, subjectName: subject.name, topicName: t.name }))
                ];
                pool.push(...questions);
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

    // FALLBACK ROBUSTO: Se o filtro for muito restrito (ex: pedir só erradas mas não ter nenhuma), 
    // ou se o pool filtrado for menor que o desejado, completa com o que houver disponível no pool geral
    if (filtered.length < targetCount) {
        const remainingNeeded = targetCount - filtered.length;
        const remainingOptions = pool.filter(q => !filtered.some(fq => fq.id === q.id));
        const additional = shuffleArray(remainingOptions).slice(0, remainingNeeded);
        filtered = [...filtered, ...additional];
    }

    return shuffleArray(filtered).slice(0, targetCount);
}

const handler: Handler = async (event: HandlerEvent) => {
    const { apiKey, studentId, challengeType } = event.queryStringParameters || {};
    
    // Validação de API Key interna
    if (!apiKey || apiKey !== process.env.VITE_DAILY_CHALLENGE_API_KEY) {
        return { statusCode: 401, body: 'Unauthorized' };
    }

    try {
        const studentDoc = await db.collection('studentProgress').doc(studentId!).get();
        if (!studentDoc.exists) return { statusCode: 404, body: 'Student Progress not found' };
        const studentProgress = studentDoc.data() as StudentProgress;

        // Busca cursos onde o aluno está matriculado
        const coursesSnap = await db.collection('courses').where('enrolledStudentIds', 'array-contains', studentId).get();
        const subjectIds = new Set<string>();
        coursesSnap.docs.forEach(doc => (doc.data().disciplines || []).forEach((d: any) => subjectIds.add(d.subjectId)));

        const subjects: Subject[] = [];
        const subjectIdsArray = Array.from(subjectIds);

        if (subjectIdsArray.length > 0) {
            // Firestore limite de 10 no 'in'. Pegamos os 10 primeiros por simplicidade
            const subjectDocs = await db.collection('subjects').where(admin.firestore.FieldPath.documentId(), 'in', subjectIdsArray.slice(0, 10)).get();
            
            for (const doc of subjectDocs.docs) {
                const topicsSnap = await doc.ref.collection('topics').get();
                subjects.push({ 
                    id: doc.id, 
                    ...doc.data(), 
                    topics: topicsSnap.docs.map(t => ({ id: t.id, ...t.data() } as Topic)) 
                } as Subject);
            }
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        let items: any[] = [];

        if (challengeType === 'review') {
            items = await getReviewPool(studentProgress, subjects);
        } else if (challengeType === 'glossary') {
            // Pool de glossário baseado nas matérias do aluno
            const glossaryPool = subjects.flatMap(s => s.topics.flatMap(t => [
                ...(t.glossary || []), 
                ...(t.subtopics || []).flatMap(st => st.glossary || [])
            ]));

            // Fallback para glossário caso as matérias do aluno não tenham termos cadastrados
            let selectedTerms = shuffleArray(glossaryPool).slice(0, 5);
            if (selectedTerms.length === 0) {
                // Se o aluno não tem glossário nas matérias dele, buscamos termos genéricos de concurso se necessário
                // (Aqui mantemos vazio por enquanto para incentivar cadastro do professor)
            }

            items = selectedTerms.map(g => ({
                id: `gloss-${Date.now()}-${Math.random()}`,
                statement: `Considerando o vocabulário técnico jurídico e administrativo, qual a definição correta para o termo: **${g.term}**?`,
                options: shuffleArray([
                    g.definition, 
                    "Procedimento de urgência aplicado apenas em casos de calamidade pública.", 
                    "Regra de conduta moral que não possui força vinculativa no direito positivo.", 
                    "Extinção de um ato administrativo por razões de conveniência e oportunidade.", 
                    "Manifestação unilateral de vontade que visa criar, modificar ou extinguir direitos."
                ]),
                correctAnswer: g.definition,
                justification: `O termo ${g.term} refere-se precisamente a: ${g.definition}. As demais opções trazem conceitos de revogação, ato administrativo genérico ou definições de outras áreas.`
            }));
        } else if (challengeType === 'portuguese') {
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: "Gere 3 questões de Língua Portuguesa focadas em gramática (sintaxe, pontuação, concordância) e interpretação de texto para concursos de alto nível. Retorne APENAS um array JSON de objetos, cada um com as chaves: 'statement' (string com o enunciado), 'options' (array de 5 strings), 'correctAnswer' (string, deve ser idêntica a uma das opções) e 'justification' (string com a explicação pedagógica).",
                config: { 
                    responseMimeType: "application/json",
                    temperature: 0.7
                }
            });
            const textResult = response.text || '[]';
            try {
                items = JSON.parse(textResult.replace(/```json/g, '').replace(/```/g, '').trim());
            } catch (e) {
                console.error("Erro ao parsear questões de português da IA:", e);
                items = [];
            }
        }

        return { 
            statusCode: 200, 
            body: JSON.stringify(items), 
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            } 
        };
    } catch (error: any) {
        console.error("Erro na função de geração de desafio:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};

export { handler };

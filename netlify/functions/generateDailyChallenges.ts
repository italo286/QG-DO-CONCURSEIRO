import { Handler } from '@netlify/functions';
import * as admin from 'firebase-admin';
import { User, StudentProgress, Question, Subject, GlossaryTerm, DailyChallenge } from '../../src/types';
import * as GeminiService from '../../src/services/geminiService';
import { getBrasiliaDate, getLocalDateISOString } from '../../src/utils';

// --- INICIALIZAÇÃO DO FIREBASE ADMIN ---
// Isso garante que o app do Firebase seja inicializado apenas uma vez.
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
} catch (e) {
  console.error('Falha ao inicializar o Firebase Admin:', e);
}

const db = admin.firestore();

// Helper para embaralhar arrays
const shuffle = <T,>(array: T[]): T[] => {
    if (!array || array.length === 0) return [];
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

// --- O HANDLER PRINCIPAL DA FUNÇÃO NETLIFY ---
export const handler: Handler = async () => {
  console.log('Iniciando a geração de desafios diários...');

  try {
    const todayISO = getLocalDateISOString(getBrasiliaDate());
    const yesterday = getBrasiliaDate();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayISO = getLocalDateISOString(yesterday);

    const studentsSnapshot = await db.collection('users').where('role', '==', 'aluno').get();
    const subjectsSnapshot = await db.collection('subjects').get();
    const allSubjects = subjectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Subject);

    if (studentsSnapshot.empty) {
      return { statusCode: 200, body: 'Nenhum aluno encontrado.' };
    }

    const batch = db.batch();

    for (const studentDoc of studentsSnapshot.docs) {
      const student = { id: studentDoc.id, ...studentDoc.data() } as User;
      const progressRef = db.collection('studentProgress').doc(student.id);
      const progressDoc = await progressRef.get();
      
      if (!progressDoc.exists) {
        console.log(`Aluno ${student.name} sem dados de progresso. Pulando.`);
        continue;
      }
      
      const progressData = progressDoc.data() as StudentProgress;

      // --- 1. Lógica de Streak ---
      const streak = progressData.dailyChallengeStreak || { current: 0, longest: 0, lastCompletedDate: '' };
      if (streak.lastCompletedDate && streak.lastCompletedDate !== yesterdayISO) {
          streak.current = 0; // Quebrou a sequência
      }
      progressData.dailyChallengeStreak = streak;


      // --- 2. Lógica de Geração de Desafios ---

      // a) Desafio de Revisão
      if (!progressData.reviewChallenge || progressData.reviewChallenge.generatedForDate !== todayISO) {
          // FIX: Added explicit typing to `allQuestions` and included `tecQuestions` to prevent type errors and ensure all questions are considered.
          const allQuestions: Question[] = allSubjects.flatMap(s =>
            (s.topics || []).flatMap(t => [
              ...(t.questions || []),
              ...(t.tecQuestions || []),
              ...(t.subtopics || []).flatMap(st => [
                ...(st.questions || []),
                ...(st.tecQuestions || []),
              ]),
            ]),
          );
          const incorrectIds = new Set<string>();
          Object.values(progressData.progressByTopic).forEach(subject => {
            Object.values(subject).forEach(topic => {
              topic.lastAttempt.forEach(attempt => {
                if (!attempt.isCorrect) incorrectIds.add(attempt.questionId);
              });
            });
          });
          const questions = shuffle(allQuestions.filter(q => incorrectIds.has(q.id))).slice(0, 5);
          progressData.reviewChallenge = { date: todayISO, generatedForDate: todayISO, items: questions, isCompleted: questions.length === 0, attemptsMade: 0 };
      }

      // b) Desafio de Glossário
      if (!progressData.glossaryChallenge || progressData.glossaryChallenge.generatedForDate !== todayISO) {
        // FIX: Added explicit typing to `allGlossaryTerms` to resolve downstream type errors on properties like 'term' and 'definition'.
        const allGlossaryTerms: GlossaryTerm[] = allSubjects.flatMap(s =>
            (s.topics || []).flatMap(t => [
                ...(t.glossary || []),
                ...(t.subtopics || []).flatMap(st => st.glossary || []),
            ]),
        );
        const uniqueTerms = Array.from(new Map(allGlossaryTerms.map(item => [item.term, item])).values());
        let questions: Question[] = [];
        if (uniqueTerms.length >= 5) {
            const selectedTerms = shuffle(uniqueTerms).slice(0, 5);
            questions = selectedTerms.map((term, i) => ({
                id: `gloss-chal-${todayISO}-${i}`,
                statement: `Qual termo corresponde à definição: "${term.definition}"?`,
                options: shuffle([term.term, ...shuffle(uniqueTerms.filter(t => t.term !== term.term)).slice(0, 4).map(t => t.term)]),
                correctAnswer: term.term,
                justification: `O termo correto é **${term.term}**.`,
            }));
        }
        progressData.glossaryChallenge = { date: todayISO, generatedForDate: todayISO, items: questions, isCompleted: questions.length === 0, attemptsMade: 0 };
      }

      // c) Desafio de Português
      if (!progressData.portugueseChallenge || progressData.portugueseChallenge.generatedForDate !== todayISO) {
        const questionCount = progressData.portugueseChallengeQuestionCount || 1;
        const generated = await GeminiService.generatePortugueseChallenge(questionCount, progressData.portugueseErrorStats);
        const questions = generated.map((q, i) => ({ ...q, id: `port-chal-${todayISO}-${i}`}));
        progressData.portugueseChallenge = { date: todayISO, generatedForDate: todayISO, items: questions, isCompleted: questions.length === 0, attemptsMade: 0 };
      }
      
      batch.set(progressRef, progressData, { merge: true });
    }

    await batch.commit();

    console.log(`Desafios gerados com sucesso para ${studentsSnapshot.size} alunos.`);
    return {
      statusCode: 200,
      body: `Desafios diários gerados para ${studentsSnapshot.size} alunos.`,
    };
  } catch (error) {
    console.error('Erro durante a geração de desafios:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Falha ao gerar desafios diários.' }),
    };
  }
};
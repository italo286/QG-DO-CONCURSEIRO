import { Handler } from '@netlify/functions';
import * as admin from 'firebase-admin';
import { User, StudentProgress, Question, Subject, GlossaryTerm } from '../../src/types';
import * as GeminiService from '../../src/services/geminiService';
import { getBrasiliaDate, getLocalDateISOString } from '../../src/utils';

// --- INICIALIZAÇÃO DO FIREBASE ADMIN ---
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
    
    // Create a flat map of all questions for easy lookup
    const allQuestionsMap = new Map<string, Question>();
    allSubjects.forEach(s => {
        (s.topics || []).forEach(t => {
            (t.questions || []).forEach(q => allQuestionsMap.set(q.id, q));
            (t.tecQuestions || []).forEach(q => allQuestionsMap.set(q.id, q));
            (t.subtopics || []).forEach(st => {
                (st.questions || []).forEach(q => allQuestionsMap.set(q.id, q));
                (st.tecQuestions || []).forEach(q => allQuestionsMap.set(q.id, q));
            });
        });
    });


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
      if (streak.lastCompletedDate && streak.lastCompletedDate !== yesterdayISO && streak.lastCompletedDate !== todayISO) {
          streak.current = 0; // Quebrou a sequência
      }
      progressData.dailyChallengeStreak = streak;

      // --- 2. Lógica de Geração de Desafios ---

      // a) Desafio de Revisão (Ponderado)
      if (!progressData.reviewChallenge || progressData.reviewChallenge.generatedForDate !== todayISO) {
          const questionCount = progressData.advancedReviewQuestionCount || 5;
          let reviewQuestions: Question[] = [];

          // Priority 1: SRS Questions due today
          const srsDueIds = Object.entries(progressData.srsData || {})
              .filter(([, data]) => data.nextReviewDate <= todayISO)
              .map(([id]) => id);
          const srsQuestions = srsDueIds.map(id => allQuestionsMap.get(id)).filter((q): q is Question => !!q);
          
          // Priority 2: Frequently incorrect questions
          const errorCounts = new Map<string, number>();
          Object.values(progressData.progressByTopic).forEach(subject => {
              Object.values(subject).forEach(topic => {
                  (topic.lastAttempt || []).forEach(attempt => {
                      if (!attempt.isCorrect) {
                          errorCounts.set(attempt.questionId, (errorCounts.get(attempt.questionId) || 0) + 1);
                      }
                  });
              });
          });
          
          const frequentlyIncorrectQuestions = Array.from(errorCounts.entries())
              .sort((a, b) => b[1] - a[1]) // Sort by count desc
              .map(([id]) => allQuestionsMap.get(id))
              .filter((q): q is Question => !!q);
          
          // Combine and deduplicate
          const candidatePool = [...srsQuestions, ...frequentlyIncorrectQuestions];
          const uniqueCandidates = Array.from(new Map(candidatePool.map(q => [q.id, q])).values());
          
          reviewQuestions = uniqueCandidates.slice(0, questionCount);

          // Smart Plan B: If pool is still not full, find low-scoring topics
          if (reviewQuestions.length < questionCount) {
              const lowScoringTopics: { topicId: string, score: number }[] = [];
              Object.values(progressData.progressByTopic).forEach(subject => {
                  Object.entries(subject).forEach(([topicId, topicData]) => {
                      if (topicData.score < 0.7) { // 70% threshold
                          lowScoringTopics.push({ topicId, score: topicData.score });
                      }
                  });
              });
              
              const sortedLowScoring = lowScoringTopics.sort((a, b) => a.score - b.score);
              const existingQuestionIds = new Set(reviewQuestions.map(q => q.id));
              
              for (const { topicId } of sortedLowScoring) {
                  if (reviewQuestions.length >= questionCount) break;

                  const questionsFromTopic = shuffle([...allQuestionsMap.values()].filter(q => 
                      (q.topicName?.includes(topicId) || q.id.startsWith(topicId)) && !existingQuestionIds.has(q.id)
                  ));

                  const needed = questionCount - reviewQuestions.length;
                  reviewQuestions.push(...questionsFromTopic.slice(0, needed));
              }
          }
          
          progressData.reviewChallenge = { date: todayISO, generatedForDate: todayISO, items: reviewQuestions, isCompleted: reviewQuestions.length === 0, attemptsMade: 0 };
      }

      // b) Desafio de Glossário (Contextual)
      if (!progressData.glossaryChallenge || progressData.glossaryChallenge.generatedForDate !== todayISO) {
          const studiedTopicIds = new Set(Object.values(progressData.progressByTopic).flatMap(s => Object.keys(s)));
          
          let contextualTerms: GlossaryTerm[] = [];
          allSubjects.forEach(s => {
              s.topics.forEach(t => {
                  if (studiedTopicIds.has(t.id)) contextualTerms.push(...(t.glossary || []));
                  t.subtopics.forEach(st => {
                      if (studiedTopicIds.has(st.id)) contextualTerms.push(...(st.glossary || []));
                  });
              });
          });
          
          let sourcePool = Array.from(new Map(contextualTerms.map(item => [item.term, item])).values());
          
          // Fallback if not enough contextual terms
          if (sourcePool.length < 5) {
            const allGlossaryTerms = allSubjects.flatMap(s => (s.topics || []).flatMap(t => [...(t.glossary || []), ...(t.subtopics || []).flatMap(st => st.glossary || [])]));
            sourcePool = Array.from(new Map(allGlossaryTerms.map(item => [item.term, item])).values());
          }

          let questions: Question[] = [];
          if (sourcePool.length >= 5) {
              const questionCount = progressData.glossaryChallengeQuestionCount || 5;
              const selectedTerms = shuffle(sourcePool).slice(0, questionCount);
              questions = selectedTerms.map((term, i) => ({
                  id: `gloss-chal-${todayISO}-${i}`,
                  statement: `Qual termo corresponde à definição: "${term.definition}"?`,
                  options: shuffle([term.term, ...shuffle(sourcePool.filter(t => t.term !== term.term)).slice(0, 4).map(t => t.term)]),
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

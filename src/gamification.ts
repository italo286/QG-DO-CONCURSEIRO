import React from "react";
// FIX: Added imports for types used in the new gamification logic functions.
import { StudentProgress, Subject, QuestionAttempt, Badge } from "./types";
import { getBrasiliaDate, getLocalDateISOString } from './utils';
import { 
    StarIcon,
    FireIcon,
    BrainIcon,
    TrophyIcon,
    CalendarIcon,
    CheckCircleIcon,
    GameControllerIcon,
} from './components/Icons';


// --- Gamification & Helper Constants ---
export const XP_CONFIG = {
    CORRECT_ANSWER: 10,
    CORRECT_REVIEW_ANSWER: 15,
    TOPIC_COMPLETE: 50,
    REVIEW_SESSION_COMPLETE: 75,
    MINI_GAME_COMPLETE: 25,
    DAILY_CHALLENGE_COMPLETE: 50,
    CATCH_UP_CHALLENGE_COMPLETE: 25, // Reduced XP for catch-up
    GAME_ERROR_PENALTY: 5,
    STREAK_BONUS: {
        3: 50,
        7: 100,
        15: 250,
        30: 500
    }
};

export const LEVEL_XP_REQUIREMENT = 500;
export const LEVEL_TITLES = [
  "Novato", "Iniciante", "Aspirante", "Cadete", "Estudante Dedicado",
  "Concurseiro Focado", "Veterano dos Estudos", "Mestre do Tópico", "Sábio da Disciplina", "Lenda da Aprovação"
];

export const calculateLevel = (xp: number) => Math.floor(xp / LEVEL_XP_REQUIREMENT) + 1;
export const getLevelTitle = (level: number) => LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];

// Spaced Repetition System Intervals (in days)
export const SRS_INTERVALS = [1, 3, 7, 14, 30, 60, 120, 180, 365];

export const TOPIC_BADGES = {
    bronze: { name: "Medalha de Bronze", description: "Acertou 70% ou mais das questões!", icon: TrophyIcon },
    silver: { name: "Medalha de Prata", description: "Acertou 90% ou mais das questões!", icon: TrophyIcon },
    gold: { name: "Medalha de Ouro", description: "Gabaritou o quiz!", icon: TrophyIcon },
};

export const ALL_BADGES: { 
    [id: string]: { 
        name: string;
        description: string;
        icon: React.FC<{className?: string}>;
        condition: (
            progress: StudentProgress, 
            subjects: Subject[],
            allProgress?: { [studentId: string]: StudentProgress }
        ) => boolean | { name: string; description: string; };
    } 
} = {
    'first-topic': { name: 'Iniciante', description: 'Primeiro Tópico Concluído!', icon: StarIcon, condition: (p) => Object.values(p.progressByTopic).some(s => Object.values(s).some(t => t.completed)) },
    'marathoner-50': { name: 'Maratonista', description: 'Respondeu 50 questões em um dia.', icon: FireIcon, condition: (p) => Object.values(p.dailyActivity).some((d: {questionsAnswered: number}) => d.questionsAnswered >= 50) },
    'streaker-3': { name: 'Focado', description: 'Estudou por 3 dias seguidos.', icon: BrainIcon, condition: (p) => {
        let consecutiveDays = 0;
        for (let i = 0; i < 3; i++) {
            const checkDate = getBrasiliaDate(); // Get current Brasilia date
            checkDate.setUTCDate(checkDate.getUTCDate() - i); // Set it to i days ago
            const dateStr = getLocalDateISOString(checkDate);
            if (p.dailyActivity[dateStr] && p.dailyActivity[dateStr].questionsAnswered > 0) {
                consecutiveDays++;
            } else {
                break; // Not consecutive
            }
        }
        return consecutiveDays >= 3;
    }},
    'streaker-7': { name: 'Dedicação Diária', description: 'Estudou por 7 dias seguidos.', icon: CalendarIcon, condition: (p) => {
        let consecutiveDays = 0;
        for (let i = 0; i < 7; i++) {
            const checkDate = getBrasiliaDate(); // Get current Brasilia date
            checkDate.setUTCDate(checkDate.getUTCDate() - i); // Set it to i days ago
            const dateStr = getLocalDateISOString(checkDate);
            if (p.dailyActivity[dateStr] && p.dailyActivity[dateStr].questionsAnswered > 0) {
                consecutiveDays++;
            } else {
                break;
            }
        }
        return consecutiveDays >= 7;
    }},
    'streak-3-day-challenge': { name: 'Ritmo Certo', description: 'Completou os desafios diários por 3 dias seguidos!', icon: FireIcon, condition: (p) => (p.dailyChallengeStreak?.current || 0) >= 3 },
    'streak-7-day-challenge': { name: 'Força do Hábito', description: 'Completou os desafios diários por 7 dias seguidos!', icon: FireIcon, condition: (p) => (p.dailyChallengeStreak?.current || 0) >= 7 },
    'streak-15-day-challenge': { name: 'Implacável', description: 'Completou os desafios diários por 15 dias seguidos!', icon: FireIcon, condition: (p) => (p.dailyChallengeStreak?.current || 0) >= 15 },
    'streak-30-day-challenge': { name: 'Lenda Diária', description: 'Completou os desafios diários por 30 dias seguidos!', icon: FireIcon, condition: (p) => (p.dailyChallengeStreak?.current || 0) >= 30 },
    'subject-completer': { name: 'Finalizador', description: 'Concluiu todos os tópicos de uma disciplina.', icon: CheckCircleIcon, condition: (p, subjects) => {
        for (const subject of subjects) {
            const allTopicsAndSubtopics = subject.topics.flatMap(t => [t, ...t.subtopics]);
            if (allTopicsAndSubtopics.length === 0) continue;
            
            const allCompleted = allTopicsAndSubtopics.every(topic => p.progressByTopic[subject.id]?.[topic.id]?.completed);
            
            if (allCompleted) {
                 return { name: `Finalizador de ${subject.name}`, description: `Concluiu todos os tópicos de ${subject.name}!` };
            }
        }
        return false;
    }},
    'game-master-10': { name: 'Mestre dos Jogos', description: 'Completou 10 minijogos.', icon: GameControllerIcon, condition: (p) => (p.gamesCompletedCount || 0) >= 10 },
    'perfect-quiz-10': { name: 'Performance Perfeita', description: 'Gabaritou um quiz com 10+ questões.', icon: TrophyIcon, condition: (p, subjects) => {
        const allContentItems = subjects.flatMap(s => s.topics.flatMap(t => [t, ...t.subtopics]));

        for (const subjectId in p.progressByTopic) {
            const subjectProgress = p.progressByTopic[subjectId];
            for (const topicId in subjectProgress) {
                if (subjectProgress[topicId].score === 1) {
                    const isTecQuiz = topicId.endsWith('-tec');
                    const originalTopicId = isTecQuiz ? topicId.replace('-tec', '') : topicId;
                    
                    const contentItem = allContentItems.find(item => item.id === originalTopicId);
                    const questionCount = isTecQuiz ? contentItem?.tecQuestions?.length : contentItem?.questions?.length;
                    if (questionCount && questionCount >= 10) {
                        return true;
                    }
                }
            }
        }
        return false;
    }},
    'leaderboard-first': { name: 'Topo do Pódio', description: 'Alcançou o 1º lugar no ranking.', icon: TrophyIcon, condition: (p, _subjects, allProgress) => {
        if (!allProgress || Object.keys(allProgress).length < 2) return false;
        const myXp = p.xp;
        const maxOtherXp = Math.max(...Object.values(allProgress)
            .filter(prog => prog.studentId !== p.studentId)
            .map(prog => prog.xp)
        );
        return myXp > maxOtherXp;
    }},
    'mastery': { name: 'Mestre', description: 'Alcançou 100% em uma disciplina!', icon: TrophyIcon, condition: (p, subjects) => {
        for (const subject of subjects) {
            const allTopics = subject.topics.length > 0;
            const allPerfect = subject.topics.every(topic => p.progressByTopic[subject.id]?.[topic.id]?.score === 1);
            if(allTopics && allPerfect) {
                return { name: `Mestre em ${subject.name}`, description: `100% de acertos em ${subject.name}!` };
            }
        }
        return false;
    }}
};

// FIX: Added missing gamification logic functions.
export const checkAndAwardBadges = (
    progress: StudentProgress,
    subjects: Subject[],
    allProgress?: { [studentId: string]: StudentProgress }
): (Badge & {id: string})[] => {
    const newlyAwarded: (Badge & {id: string})[] = [];
    for (const badgeId in ALL_BADGES) {
        if (!progress.earnedBadgeIds.includes(badgeId)) {
            const badgeInfo = ALL_BADGES[badgeId];
            const result = badgeInfo.condition(progress, subjects, allProgress);
            if (result) {
                if (typeof result === 'object') {
                    newlyAwarded.push({ id: badgeId, ...badgeInfo, ...result });
                } else {
                    newlyAwarded.push({ id: badgeId, ...badgeInfo });
                }
            }
        }
    }
    return newlyAwarded;
};

export const updateSrsFlashcard = (
    progress: StudentProgress,
    flashcardId: string,
    performance: 'good' | 'bad'
): StudentProgress => {
    const newProgress = { ...progress };
    if (!newProgress.srsFlashcardData) {
        newProgress.srsFlashcardData = {};
    }

    let currentStage = newProgress.srsFlashcardData[flashcardId]?.stage || 0;

    if (performance === 'good') {
        currentStage = Math.min(currentStage + 1, SRS_INTERVALS.length - 1);
    } else { // 'bad'
        currentStage = Math.max(0, currentStage - 1);
    }

    const nextReviewInterval = SRS_INTERVALS[currentStage];
    const nextReviewDate = getBrasiliaDate();
    nextReviewDate.setUTCDate(nextReviewDate.getUTCDate() + nextReviewInterval);
    
    newProgress.srsFlashcardData[flashcardId] = {
        stage: currentStage,
        nextReviewDate: getLocalDateISOString(nextReviewDate),
    };

    return newProgress;
};

export const processQuizCompletion = (
    progress: StudentProgress,
    subjectId: string,
    topicId: string,
    attempts: QuestionAttempt[],
    addXp: (amount: number) => void
): StudentProgress => {
    if (attempts.length === 0) return progress;

    const correctCount = attempts.filter(a => a.isCorrect).length;
    const score = correctCount / attempts.length;
    
    addXp(correctCount * XP_CONFIG.CORRECT_ANSWER);

    const newProgress = { ...progress };
    if (!newProgress.progressByTopic[subjectId]) newProgress.progressByTopic[subjectId] = {};
    const oldScore = newProgress.progressByTopic[subjectId][topicId]?.score || 0;

    newProgress.progressByTopic[subjectId][topicId] = {
        completed: true,
        score,
        lastAttempt: attempts
    };

    if (score > oldScore) {
        addXp(XP_CONFIG.TOPIC_COMPLETE);
    }

    const newBadges = [];
    if (score >= 0.7) newBadges.push('bronze');
    if (score >= 0.9) newBadges.push('silver');
    if (score === 1) newBadges.push('gold');
    
    if (newBadges.length > 0) {
        if (!newProgress.earnedTopicBadgeIds) newProgress.earnedTopicBadgeIds = {};
        const existingBadges = newProgress.earnedTopicBadgeIds[topicId] || [];
        newProgress.earnedTopicBadgeIds[topicId] = [...new Set([...existingBadges, ...newBadges])];
    }
    
    const todayISO = getLocalDateISOString(getBrasiliaDate());
    if (!newProgress.dailyActivity[todayISO]) {
        newProgress.dailyActivity[todayISO] = { questionsAnswered: 0 };
    }
    newProgress.dailyActivity[todayISO].questionsAnswered += attempts.length;

    return newProgress;
};

export const processReviewCompletion = (
    progress: StudentProgress,
    reviewId: string,
    attempts: QuestionAttempt[],
    addXp: (amount: number) => void
): StudentProgress => {
    const newProgress = { ...progress };
    const reviewIndex = newProgress.reviewSessions.findIndex(r => r.id === reviewId);
    if (reviewIndex === -1) return newProgress;

    const review = newProgress.reviewSessions[reviewIndex];
    review.isCompleted = true;
    review.attempts = attempts;
    
    addXp(XP_CONFIG.REVIEW_SESSION_COMPLETE);

    if (review.type === 'srs') {
        if (!newProgress.srsData) newProgress.srsData = {};
        attempts.forEach(attempt => {
            const currentStage = newProgress.srsData[attempt.questionId]?.stage || 0;
            let nextStage: number;

            if (attempt.isCorrect) {
                nextStage = Math.min(currentStage + 1, SRS_INTERVALS.length - 1);
                addXp(XP_CONFIG.CORRECT_REVIEW_ANSWER);
            } else {
                nextStage = Math.max(0, Math.floor(currentStage / 2));
            }
            
            const nextReviewInterval = SRS_INTERVALS[nextStage];
            const nextReviewDate = getBrasiliaDate();
            nextReviewDate.setUTCDate(nextReviewDate.getUTCDate() + nextReviewInterval);
            
            newProgress.srsData[attempt.questionId] = {
                stage: nextStage,
                nextReviewDate: getLocalDateISOString(nextReviewDate),
            };
        });
    } else {
        const correctCount = attempts.filter(a => a.isCorrect).length;
        addXp(correctCount * XP_CONFIG.CORRECT_REVIEW_ANSWER);
    }

    return newProgress;
};

export const processGameCompletion = (
    progress: StudentProgress,
    topicId: string,
    gameId: string,
    addXp: (amount: number) => void
): StudentProgress => {
    const newProgress = { ...progress };
    addXp(XP_CONFIG.MINI_GAME_COMPLETE);

    if (topicId !== 'custom') {
        if (!newProgress.earnedGameBadgeIds) newProgress.earnedGameBadgeIds = {};
        if (!newProgress.earnedGameBadgeIds[topicId]) newProgress.earnedGameBadgeIds[topicId] = [];
        
        const existingBadges = newProgress.earnedGameBadgeIds[topicId];
        if (!existingBadges.includes(gameId)) {
            newProgress.earnedGameBadgeIds[topicId] = [...existingBadges, gameId];
        }
    }

    newProgress.gamesCompletedCount = (newProgress.gamesCompletedCount || 0) + 1;
    
    return newProgress;
};

export const processCustomQuizCompletion = (
    progress: StudentProgress,
    quizId: string,
    attempts: QuestionAttempt[],
    addXp: (amount: number) => void
): StudentProgress => {
    const newProgress = { ...progress };
    if (!newProgress.customQuizzes) {
        newProgress.customQuizzes = [];
    }
    const quizIndex = newProgress.customQuizzes.findIndex(q => q.id === quizId);
    if (quizIndex === -1) return newProgress;
    
    const correctCount = attempts.filter(a => a.isCorrect).length;
    addXp(correctCount * XP_CONFIG.CORRECT_ANSWER);

    newProgress.customQuizzes[quizIndex] = {
        ...newProgress.customQuizzes[quizIndex],
        isCompleted: true,
        attempts: attempts
    };
    
    const todayISO = getLocalDateISOString(getBrasiliaDate());
    if (!newProgress.dailyActivity[todayISO]) {
        newProgress.dailyActivity[todayISO] = { questionsAnswered: 0 };
    }
    newProgress.dailyActivity[todayISO].questionsAnswered += attempts.length;

    return newProgress;
};

export const processSimuladoCompletion = (
    progress: StudentProgress,
    simuladoId: string,
    attempts: QuestionAttempt[],
    addXp: (amount: number) => void
): StudentProgress => {
    const newProgress = { ...progress };
    if (!newProgress.simulados) {
        newProgress.simulados = [];
    }
    const simuladoIndex = newProgress.simulados.findIndex(s => s.id === simuladoId);
    if (simuladoIndex === -1) return newProgress;
    
    const correctCount = attempts.filter(a => a.isCorrect).length;
    addXp(correctCount * XP_CONFIG.CORRECT_ANSWER);

    newProgress.simulados[simuladoIndex] = {
        ...newProgress.simulados[simuladoIndex],
        isCompleted: true,
        attempts: attempts
    };
    
    const todayISO = getLocalDateISOString(getBrasiliaDate());
    if (!newProgress.dailyActivity[todayISO]) {
        newProgress.dailyActivity[todayISO] = { questionsAnswered: 0 };
    }
    newProgress.dailyActivity[todayISO].questionsAnswered += attempts.length;

    return newProgress;
};
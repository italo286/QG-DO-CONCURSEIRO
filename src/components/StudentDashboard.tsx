import { useState, useEffect, useCallback, useMemo } from 'react';
import * as FirebaseService from '../../services/firebaseService';
import * as GeminiService from '../../services/geminiService';
import { User, Subject, Topic, Question, StudentProgress, TeacherMessage, StudyPlan, Badge, Course, SubTopic, ReviewSession, MiniGame, QuestionAttempt, MessageReply, GlossaryTerm, Flashcard, CourseDiscipline } from '../../types';
import { getLocalDateISOString, getBrasiliaDate } from '../../utils';
import { XP_CONFIG, ALL_BADGES, calculateLevel, getLevelTitle, SRS_INTERVALS, TOPIC_BADGES } from '../../gamification';

import { Spinner, Modal } from '../ui';
import { 
    ArrowRightIcon,
} from '../Icons';

import { XpToastDisplay } from './XpToastDisplay';
import { BadgeAwardModal } from './BadgeAwardModal';
import { EditProfileModal } from './EditProfileModal';
import { StudentGamePlayerModal } from './StudentGamePlayerModal';
import { StudentGameEditorModal } from './StudentGameEditorModal';
import { LevelUpModal } from './LevelUpModal';
import { NewMessageModal } from './NewMessageModal';
import { StudentViewRouter } from './StudentViewRouter';
import { StudentHeader } from './StudentHeader';
import { AiAssistant } from './AiAssistant';

const shuffle = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

interface StudentDashboardProps {
    user: User; 
    onLogout: () => void; 
    onUpdateUser: (user: User) => void;
    isPreview?: boolean; 
    onToggleStudentView?: () => void;
}

export const StudentDashboard = ({ user, onLogout, onUpdateUser, isPreview, onToggleStudentView }: StudentDashboardProps) => {
    // --- State Management ---
    const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
    const [allStudents, setAllStudents] = useState<User[]>([]);
    const [allStudentProgress, setAllStudentProgress] = useState<{[studentId: string]: StudentProgress}>({});
    const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [studentProgress, setStudentProgress] = useState<StudentProgress | null>(null);
    const [studyPlan, setStudyPlan] = useState<StudyPlan['plan']>({});
    const [messages, setMessages] = useState<TeacherMessage[]>([]);
    const [teacherProfiles, setTeacherProfiles] = useState<User[]>([]);
    
    // --- View & Selection State ---
    // FIX: Added 'daily_challenge_results' to the view state type to align with ViewType and fix type errors when passing setView to child components.
    const [view, setView] = useState<'dashboard' | 'course' | 'subject' | 'topic' | 'schedule' | 'performance' | 'reviews' | 'review_quiz' | 'games' | 'daily_challenge_quiz' | 'daily_challenge_results'>('dashboard');
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
    const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
    const [selectedSubtopic, setSelectedSubtopic] = useState<SubTopic | null>(null);
    const [selectedReview, setSelectedReview] = useState<ReviewSession | null>(null);
    const [activeChallenge, setActiveChallenge] = useState<{ type: 'review' | 'glossary' | 'portuguese', questions: Question[], sessionAttempts: QuestionAttempt[] } | null>(null);
    const [quizInstanceKey, setQuizInstanceKey] = useState(0);
    const [dailyChallengeResults, setDailyChallengeResults] = useState<{ questions: Question[], sessionAttempts: QuestionAttempt[] } | null>(null);


    // --- UI State & Modals ---
    const [isGeneratingReview, setIsGeneratingReview] = useState(false);
    const [justAwardedBadges, setJustAwardedBadges] = useState<Badge[]>([]);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [playingGame, setPlayingGame] = useState<{ game: MiniGame; topicId: string; } | null>(null);
    const [editingCustomGame, setEditingCustomGame] = useState<MiniGame | null>(null);
    const [isCustomGameModalOpen, setIsCustomGameModalOpen] = useState(false);
    const [xpToasts, setXpToasts] = useState<{ id: number; amount: number; message?: string }[]>([]);
    const [isChatModalOpen, setIsChatModalOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isSplitView, setIsSplitView] = useState(false);
    const [isLevelUpModalOpen, setIsLevelUpModalOpen] = useState(false);
    const [leveledUpTo, setLeveledUpTo] = useState(0);
    const [isNewMessageModalOpen, setIsNewMessageModalOpen] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timerId = setInterval(() => {
            setCurrentTime(new Date());
        }, 10000); // Re-check every 10 seconds for responsiveness
    
        return () => clearInterval(timerId);
    }, []);

    const showXpToast = (amount: number, message?: string) => {
        const id = Date.now();
        setXpToasts(prev => [...prev, { id, amount, message }]);
        setTimeout(() => {
            setXpToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };
    
    const updateStudentProgress = useCallback(async (
        newProgress: StudentProgress, 
        fromState?: StudentProgress | null, 
        xpGained?: number, 
        xpMessage?: string,
        context?: { type: 'quiz_update', subjectId: string, topicId: string }
    ) => {
        if (isPreview || !newProgress) return;
        const stateBeforeUpdate = fromState || studentProgress;
        if (!stateBeforeUpdate) return;
        
        if (xpGained && xpGained > 0) {
            showXpToast(xpGained, xpMessage);
        }

        const oldLevel = calculateLevel(stateBeforeUpdate.xp);
        const newLevel = calculateLevel(newProgress.xp);
        if (newLevel > oldLevel) {
            setLeveledUpTo(newLevel);
            setIsLevelUpModalOpen(true);
        }

        const newBadges: Badge[] = [];
        const currentBadges = stateBeforeUpdate.earnedBadgeIds;
        Object.keys(ALL_BADGES).forEach(id => {
            const badgeInfo = ALL_BADGES[id as keyof typeof ALL_BADGES];
            if (!currentBadges.includes(id)) {
                const conditionResult = badgeInfo.condition(newProgress, allSubjects, allStudentProgress);
                if (conditionResult) {
                    let name = badgeInfo.name;
                    let description = badgeInfo.description;
                    if (typeof conditionResult === 'object' && conditionResult !== null) {
                        name = conditionResult.name;
                        description = conditionResult.description;
                    }
                    const newBadge: Badge = { id, icon: badgeInfo.icon, name, description };
                    newBadges.push(newBadge);
                    newProgress.earnedBadgeIds.push(id);
                }
            }
        });
        
        if (context?.type === 'quiz_update') {
            const { subjectId, topicId } = context;
            const score = newProgress.progressByTopic[subjectId]?.[topicId]?.score;
            const contentItem = allSubjects.flatMap((s: Subject) => s.topics.flatMap((t: Topic) => [t, ...t.subtopics])).find(item => item.id === topicId.replace('-tec', ''));
            
            if (score !== undefined && contentItem) {
                if (!newProgress.earnedTopicBadgeIds) newProgress.earnedTopicBadgeIds = {};
                const earnedBadgesForTopic = newProgress.earnedTopicBadgeIds[topicId] || [];
                const stateBeforeBadges = stateBeforeUpdate.earnedTopicBadgeIds?.[topicId] || [];
                
                const awardIfEligible = (threshold: number, badgeId: 'bronze' | 'silver' | 'gold') => {
                    if (score >= threshold && !stateBeforeBadges.includes(badgeId)) {
                        if(!earnedBadgesForTopic.includes(badgeId)) earnedBadgesForTopic.push(badgeId);
                        const badgeInfo = TOPIC_BADGES[badgeId];
                        const newBadge: Badge = {
                            id: `${topicId}-${badgeId}`,
                            name: `${badgeInfo.name} em ${contentItem.name}`,
                            description: badgeInfo.description,
                            icon: badgeInfo.icon,
                        };
                        newBadges.push(newBadge);
                    }
                };
                awardIfEligible(0.7, 'bronze');
                awardIfEligible(0.9, 'silver');
                awardIfEligible(1.0, 'gold');
                newProgress.earnedTopicBadgeIds[topicId] = earnedBadgesForTopic;
            }
        }
        
        setStudentProgress(newProgress);
        await FirebaseService.saveStudentProgress(newProgress);
        if (newBadges.length > 0) setJustAwardedBadges(prev => [...prev, ...newBadges]);
    }, [isPreview, studentProgress, allSubjects, allStudentProgress]);
    
    const handleAddBonusXp = useCallback((amount: number, message: string) => {
        if (isPreview || !studentProgress) return;
        const newProgress = {
            ...studentProgress,
            xp: studentProgress.xp + amount,
        };
        updateStudentProgress(newProgress, studentProgress, amount, message);
    }, [isPreview, studentProgress, updateStudentProgress]);

    const updateSrsData = useCallback((attempts: QuestionAttempt[], progress: StudentProgress) => {
        if (isPreview) return progress;
        if (!progress.srsData) progress.srsData = {};
        attempts.forEach(attempt => {
            const currentStage = progress.srsData[attempt.questionId]?.stage || 0;
            let newStage = attempt.isCorrect ? currentStage + 1 : Math.max(0, Math.floor(currentStage / 2));
            const nextReview = new Date();
            if (newStage > 0) nextReview.setDate(nextReview.getDate() + SRS_INTERVALS[Math.min(newStage - 1, SRS_INTERVALS.length - 1)]);
            else nextReview.setDate(nextReview.getDate() + 1);
            progress.srsData[attempt.questionId] = { stage: newStage, nextReviewDate: nextReview.toISOString().split('T')[0] };
        });
        return progress;
    }, [isPreview]);

    const saveQuizProgress = useCallback((subjectId: string, topicId: string, attempt: QuestionAttempt) => {
        if (isPreview || !studentProgress) return;
        const today = getLocalDateISOString(new Date());
        let newProgress: StudentProgress = JSON.parse(JSON.stringify(studentProgress));
        if (!newProgress.progressByTopic[subjectId]) newProgress.progressByTopic[subjectId] = {};
        if (!newProgress.progressByTopic[subjectId][topicId]) newProgress.progressByTopic[subjectId][topicId] = { completed: false, score: 0, lastAttempt: [] };
        const topicProgress = newProgress.progressByTopic[subjectId][topicId];
        
        const attemptIndex = topicProgress.lastAttempt.findIndex((a: QuestionAttempt) => a.questionId === attempt.questionId);
        if (attemptIndex > -1) {
            topicProgress.lastAttempt[attemptIndex] = attempt;
        } else {
            topicProgress.lastAttempt.push(attempt);
        }
        
        const correctAnswers = topicProgress.lastAttempt.filter((a: QuestionAttempt) => a.isCorrect).length;
        
        let totalQuestions = 0;
        const isTecQuiz = topicId.endsWith('-tec');
        const originalTopicId = isTecQuiz ? topicId.replace('-tec', '') : topicId;

        const contentItem = allSubjects
            .flatMap(s => s.topics)
            .find(t => t.id === originalTopicId) || allSubjects
            .flatMap(s => s.topics.flatMap((t: Topic) => t.subtopics))
            .find(st => st.id === originalTopicId);

        if (contentItem) {
            totalQuestions = (isTecQuiz ? contentItem.tecQuestions?.length : contentItem.questions.length) || topicProgress.lastAttempt.length;
        } else {
            totalQuestions = topicProgress.lastAttempt.length;
        }

        topicProgress.score = totalQuestions > 0 ? correctAnswers / totalQuestions : 0;
        const xpGained = attempt.isCorrect ? XP_CONFIG.CORRECT_ANSWER : 0;
        newProgress.xp += xpGained;
        if (!newProgress.dailyActivity[today]) newProgress.dailyActivity[today] = { questionsAnswered: 0 };
        newProgress.dailyActivity[today].questionsAnswered += 1;
        newProgress = updateSrsData([attempt], newProgress);
        updateStudentProgress(newProgress, studentProgress, xpGained, undefined, { type: 'quiz_update', subjectId, topicId });
    }, [isPreview, studentProgress, allSubjects, updateStudentProgress, updateSrsData]);
    
    const saveReviewProgress = useCallback((reviewId: string, attempt: QuestionAttempt) => {
        if (isPreview || !studentProgress) return;
        const today = getLocalDateISOString(new Date());
        let newProgress: StudentProgress = JSON.parse(JSON.stringify(studentProgress));
        const reviewIndex = newProgress.reviewSessions.findIndex((r: ReviewSession) => r.id === reviewId);
        if (reviewIndex !== -1) {
            const reviewSession = newProgress.reviewSessions[reviewIndex];
            if (!reviewSession.attempts) reviewSession.attempts = [];
            
            const attemptIndex = reviewSession.attempts.findIndex((a: QuestionAttempt) => a.questionId === attempt.questionId);
            if (attemptIndex > -1) {
                reviewSession.attempts[attemptIndex] = attempt;
            } else {
                reviewSession.attempts.push(attempt);
            }
            
            const xpGained = attempt.isCorrect ? XP_CONFIG.CORRECT_REVIEW_ANSWER : 0;
            newProgress.xp += xpGained;
            if (!newProgress.dailyActivity[today]) newProgress.dailyActivity[today] = { questionsAnswered: 0 };
            newProgress.dailyActivity[today].questionsAnswered += 1;
            newProgress = updateSrsData([attempt], newProgress);
            updateStudentProgress(newProgress, studentProgress, xpGained);
        }
    }, [isPreview, studentProgress, updateStudentProgress, updateSrsData]);

    const handleTopicQuizComplete = useCallback((subjectId: string, topicId: string, _attempts: QuestionAttempt[]) => {
        if (isPreview || !studentProgress) return;
        const newProgress: StudentProgress = JSON.parse(JSON.stringify(studentProgress));
        const topicProgress = newProgress.progressByTopic[subjectId]?.[topicId];
        if (topicProgress && !topicProgress.completed) {
            topicProgress.completed = true;
            const xpGained = XP_CONFIG.TOPIC_COMPLETE;
            newProgress.xp = (newProgress.xp || 0) + xpGained;
            updateStudentProgress(newProgress, studentProgress, xpGained, undefined, { type: 'quiz_update', subjectId, topicId });
        }
    }, [isPreview, studentProgress, updateStudentProgress]);

    const handleReviewQuizComplete = useCallback((reviewId: string, _attempts: QuestionAttempt[]) => {
        if (isPreview || !studentProgress) return;
        const newProgress: StudentProgress = JSON.parse(JSON.stringify(studentProgress));
        const reviewIndex = newProgress.reviewSessions.findIndex((r: ReviewSession) => r.id === reviewId);
        if (reviewIndex !== -1 && !newProgress.reviewSessions[reviewIndex].isCompleted) {
            newProgress.reviewSessions[reviewIndex].isCompleted = true;
            const xpGained = XP_CONFIG.REVIEW_SESSION_COMPLETE;
            newProgress.xp = (newProgress.xp || 0) + xpGained;
            updateStudentProgress(newProgress, studentProgress, xpGained);
        }
    }, [isPreview, studentProgress, updateStudentProgress]);
    
    const handleGameComplete = useCallback((gameId: string) => {
        if (isPreview || !studentProgress || !playingGame) return;
    
        const { topicId } = playingGame;
        const newProgress: StudentProgress = JSON.parse(JSON.stringify(studentProgress));
    
        const xpGained = XP_CONFIG.MINI_GAME_COMPLETE;
        newProgress.xp = (newProgress.xp || 0) + xpGained;
        newProgress.gamesCompletedCount = (newProgress.gamesCompletedCount || 0) + 1;
    
        if (!newProgress.earnedGameBadgeIds) newProgress.earnedGameBadgeIds = {};
        if (!newProgress.earnedGameBadgeIds[topicId]) newProgress.earnedGameBadgeIds[topicId] = [];
        if (!newProgress.earnedGameBadgeIds[topicId].includes(gameId)) {
            newProgress.earnedGameBadgeIds[topicId].push(gameId);
        }
    
        updateStudentProgress(newProgress, studentProgress, xpGained);
    }, [isPreview, studentProgress, playingGame, updateStudentProgress]);
    
    const handleGameError = useCallback(() => {
        if (isPreview) return;
    }, [isPreview]);
    
    const handleGenerateSrsReview = useCallback(async (questions: Question[]) => {
        if (isPreview || !studentProgress) return;
        if (questions.length === 0) { alert("Nenhuma questão para revisar hoje. Bom trabalho!"); return; }
        const newSession: ReviewSession = { id: `rev-srs-${Date.now()}`, name: 'Revisão Diária', type: 'srs', createdAt: Date.now(), questions, isCompleted: false };
        const newProgress = {...studentProgress, reviewSessions: [newSession, ...studentProgress.reviewSessions.filter((r: ReviewSession) => r.type !== 'srs' || r.isCompleted)]};
        await updateStudentProgress(newProgress, studentProgress);
        setSelectedReview(newSession);
        setView('review_quiz');
    }, [isPreview, studentProgress, updateStudentProgress]);
    
    const handleGenerateSmartReview = useCallback(async () => {
        if (isPreview || !studentProgress) return;
        setIsGeneratingReview(true);
        try {
            const questions = await GeminiService.generateSmartReview(studentProgress, allSubjects);
            if (questions.length > 0) {
                 const newSession: ReviewSession = { id: `rev-ai-${Date.now()}`, name: 'Revisão Inteligente', type: 'ai', createdAt: Date.now(), questions, isCompleted: false };
                const newProgress = {...studentProgress, reviewSessions: [newSession, ...studentProgress.reviewSessions]};
                await updateStudentProgress(newProgress, studentProgress);
                showXpToast(0);
            } else {
                alert("Não foi possível gerar uma revisão. Estude mais um pouco para termos dados para analisar!");
            }
        } catch (e: any) {
            alert(`Erro ao gerar revisão: ${e.message}`);
        } finally {
            setIsGeneratingReview(false);
        }
    }, [isPreview, studentProgress, allSubjects, updateStudentProgress]);
    
    const handleNoteSave = useCallback((contentId: string, content: string) => {
        if (isPreview || !studentProgress) return;
        if (!studentProgress) return;
        const newProgress = { ...studentProgress, notesByTopic: {...studentProgress.notesByTopic, [contentId]: content} };
        updateStudentProgress(newProgress);
    }, [isPreview, studentProgress, updateStudentProgress]);

    const handleTopicCompletionToggle = useCallback((subjectId: string, topicId: string, isCompleted: boolean) => {
        if (isPreview || !studentProgress) return;
        
        const newProgress: StudentProgress = JSON.parse(JSON.stringify(studentProgress));
        
        if (!newProgress.progressByTopic[subjectId]) {
            newProgress.progressByTopic[subjectId] = {};
        }
        
        const topicProgress = newProgress.progressByTopic[subjectId][topicId];
        
        if (topicProgress) {
            topicProgress.completed = isCompleted;
        } else {
            newProgress.progressByTopic[subjectId][topicId] = {
                completed: isCompleted,
                score: 0,
                lastAttempt: []
            };
        }

        let xpGained = 0;
        const wasPreviouslyCompleted = studentProgress.progressByTopic[subjectId]?.[topicId]?.completed || false;
        if (isCompleted && !wasPreviouslyCompleted) {
            xpGained = XP_CONFIG.TOPIC_COMPLETE;
            newProgress.xp = (newProgress.xp || 0) + xpGained;
        }
        
        updateStudentProgress(newProgress, studentProgress, xpGained);
    }, [isPreview, studentProgress, updateStudentProgress]);

    const allQuestionsWithContext = useMemo(() => {
        return allSubjects.flatMap((subject: Subject) => 
            subject.topics.flatMap((topic: Topic) => 
                [
                    ...topic.questions.map((q: Question) => ({...q, subjectId: subject.id, topicId: topic.id, topicName: topic.name, subjectName: subject.name})),
                    ...(topic.tecQuestions || []).map((q: Question) => ({...q, subjectId: subject.id, topicId: topic.id, topicName: topic.name, subjectName: subject.name})),
                    ...topic.subtopics.flatMap((st: SubTopic) => [
                        ...st.questions.map((q: Question) => ({...q, subjectId: subject.id, topicId: st.id, topicName: `${topic.name} / ${st.name}`, subjectName: subject.name})),
                        ...(st.tecQuestions || []).map((q: Question) => ({...q, subjectId: subject.id, topicId: st.id, topicName: `${topic.name} / ${st.name}`, subjectName: subject.name})),
                    ])
                ]
            )
        );
    }, [allSubjects]);
    
    const incorrectQuestions = useMemo(() => {
        if (!studentProgress) return [];
        
        const correctQuestionIds = new Set<string>();
        const incorrectQuestionIds = new Set<string>();

        type TopicProgress = { lastAttempt: QuestionAttempt[] };
        type SubjectTopicProgress = { [topicId: string]: TopicProgress };

        const allAttempts: QuestionAttempt[] = [
            ...Object.values(studentProgress.progressByTopic).flatMap(
                (s: SubjectTopicProgress) => Object.values(s).flatMap((t: TopicProgress) => t.lastAttempt)
            ),
            ...studentProgress.reviewSessions.flatMap((r: ReviewSession) => r.attempts || [])
        ];
        
        allAttempts.forEach(attempt => {
            if (attempt.isCorrect) {
                correctQuestionIds.add(attempt.questionId);
            } else {
                incorrectQuestionIds.add(attempt.questionId);
            }
        });

        const finalIncorrectIds = Array.from(incorrectQuestionIds).filter(id => !correctQuestionIds.has(id));
        
        return allQuestionsWithContext.filter(q => finalIncorrectIds.includes(q.id));
    }, [studentProgress, allQuestionsWithContext]);

    const saveDailyChallengeAttempt = (challengeType: 'review' | 'glossary' | 'portuguese', attempt: QuestionAttempt) => {
        if (isPreview || !studentProgress) return;

        const newProgress: StudentProgress = JSON.parse(JSON.stringify(studentProgress));
        const challengeKey = `${challengeType}Challenge` as const;
        const challenge = newProgress[challengeKey];
        
        if (challenge) {
            if (!challenge.sessionAttempts) {
                challenge.sessionAttempts = [];
            }
            
            const existingAttemptIndex = challenge.sessionAttempts.findIndex((a: QuestionAttempt) => a.questionId === attempt.questionId);
            if (existingAttemptIndex > -1) {
                challenge.sessionAttempts[existingAttemptIndex] = attempt;
            } else {
                challenge.sessionAttempts.push(attempt);
            }
            
            const xpGained = attempt.isCorrect ? XP_CONFIG.CORRECT_ANSWER : 0;
            newProgress.xp += xpGained;

            updateStudentProgress(newProgress, studentProgress, xpGained);
        }
    };

    const handleDailyChallengeComplete = (finalSessionAttempts: QuestionAttempt[]) => {
        if (isPreview || !studentProgress || !activeChallenge) return;
    
        const challengeType = activeChallenge.type;
        const challengeKey = `${challengeType}Challenge` as const;
        const challenge = studentProgress[challengeKey];
        if (!challenge) return;
    
        setDailyChallengeResults({
            questions: activeChallenge.questions,
            sessionAttempts: finalSessionAttempts,
        });
    
        const newProgress: StudentProgress = JSON.parse(JSON.stringify(studentProgress));
        const newChallengeState = newProgress[challengeKey]!;
    
        newChallengeState.sessionAttempts = finalSessionAttempts;
    
        const allQuestionsAnswered = newChallengeState.items.length > 0 && finalSessionAttempts.length >= newChallengeState.items.length;
    
        if (allQuestionsAnswered && !challenge.isCompleted) {
            const xpGained = XP_CONFIG.DAILY_CHALLENGE_COMPLETE;
            newProgress.xp += xpGained;
            newChallengeState.isCompleted = true;
            updateStudentProgress(newProgress, studentProgress, xpGained, "Desafio Diário Completo!");
        } else {
            setStudentProgress(prev => {
                if (!prev) return null;
                const updatedProgress = { ...prev };
                (updatedProgress as any)[challengeKey] = newChallengeState;
                FirebaseService.saveStudentProgress(updatedProgress);
                return updatedProgress;
            });
        }
    
        setView('daily_challenge_results');
        setActiveChallenge(null);
    };
    
    const handleGenerateSmartFlashcards = async (questionsToUse: Question[]) => {
        if (isPreview || !studentProgress) return;
        if (questionsToUse.length === 0) {
            alert("Você não tem erros na seleção atual para gerar flashcards. Continue praticando!");
            return;
        }
        try {
            const newCards = await GeminiService.generateFlashcardsFromIncorrectAnswers(questionsToUse);
            if (newCards.length > 0) {
                const newFlashcardsWithIds = newCards.map((c: Omit<Flashcard, 'id'>) => ({ ...c, id: `fc-ai-${Date.now()}-${Math.random()}` }));
                const newProgress: StudentProgress = JSON.parse(JSON.stringify(studentProgress));
                newProgress.aiGeneratedFlashcards = [...(newProgress.aiGeneratedFlashcards || []), ...newFlashcardsWithIds];
                if (!newProgress.srsFlashcardData) newProgress.srsFlashcardData = {};
                
                const today = getLocalDateISOString(new Date());
                newFlashcardsWithIds.forEach((fc: Flashcard) => {
                    newProgress.srsFlashcardData![fc.id] = { stage: 0, nextReviewDate: today };
                });
                
                await updateStudentProgress(newProgress, studentProgress);
                showXpToast(0);
            } else {
                alert("A IA não conseguiu gerar flashcards dos seus erros no momento.");
            }
        } catch(e) {
            alert(`Erro ao gerar flashcards: ${(e as Error).message}`);
        }
    };
    
    const handleFlashcardReview = (flashcardId: string, performance: 'good' | 'bad') => {
        if (isPreview || !studentProgress) return;
        const newProgress: StudentProgress = JSON.parse(JSON.stringify(studentProgress));
        if (!newProgress.srsFlashcardData) newProgress.srsFlashcardData = {};
        
        const currentStage = newProgress.srsFlashcardData[flashcardId]?.stage || 0;
        const newStage = performance === 'good' ? currentStage + 1 : Math.max(0, Math.floor(currentStage / 2));
        
        const nextReview = new Date();
        const interval = newStage > 0 ? SRS_INTERVALS[Math.min(newStage - 1, SRS_INTERVALS.length - 1)] : 1;
        nextReview.setDate(nextReview.getDate() + interval);
        
        newProgress.srsFlashcardData[flashcardId] = { stage: newStage, nextReviewDate: getLocalDateISOString(nextReview) };
        updateStudentProgress(newProgress, studentProgress);
    };

    useEffect(() => {
        if (isPreview) {
            setIsLoading(false);
            return;
        };

        const unsubs: (() => void)[] = [];
        
        unsubs.push(FirebaseService.listenToEnrolledCourses(user.id, (courses: Course[]) => {
            setEnrolledCourses(courses);
            const teacherIds = [...new Set(courses.map((c: Course) => c.teacherId))];
            
            if(teacherIds.length > 0) {
                FirebaseService.getUserProfilesByIds(teacherIds).then(setTeacherProfiles);
                FirebaseService.listenToStudents((all: User[]) => setAllStudents(all.filter((s: User) => s.role === 'aluno')));
                unsubs.push(FirebaseService.listenToAllStudentProgress(setAllStudentProgress));
                unsubs.push(FirebaseService.listenToSubjects(teacherIds, setAllSubjects));
                unsubs.push(FirebaseService.listenToMessagesForStudent(user.id, teacherIds, setMessages));
            } else {
                 setAllSubjects([]);
                 setMessages([]);
                 setTeacherProfiles([]);
            }
        }));

        unsubs.push(FirebaseService.listenToStudentProgress(user.id, (progress: StudentProgress | null) => {
            setStudentProgress(progress);
            if (isLoading) {
                setIsLoading(false);
            }
        }));
        unsubs.push(FirebaseService.listenToStudyPlanForStudent(user.id, (plan: StudyPlan) => setStudyPlan(plan.plan)));

        return () => unsubs.forEach(unsub => unsub());
    }, [user.id, isPreview]);

    useEffect(() => {
        const checkAndGenerateChallenges = async () => {
            if (isPreview || !studentProgress || allSubjects.length === 0) return;
    
            const brasiliaNow = getBrasiliaDate();
            const todayISO = getLocalDateISOString(brasiliaNow);
            const preferredTimeStr = studentProgress.dailyChallengeTime || '06:00';
    
            // --- CONSOLE LOGGING FOR DEBUG ---
            console.groupCollapsed(`Verificação de Desafio Diário @ ${new Date().toLocaleTimeString('pt-BR')}`);
            console.log(`Horário Brasília (UTC-3): ${String(brasiliaNow.getUTCHours()).padStart(2, '0')}:${String(brasiliaNow.getUTCMinutes()).padStart(2, '0')}`);
            console.log(`Data ISO (UTC-3): ${todayISO}`);
            console.log(`Horário Agendado: ${preferredTimeStr}`);
            console.log('--- Status Atual ---');
            console.log('Revisão:', studentProgress.reviewChallenge ? { date: studentProgress.reviewChallenge.date, generatedAt: studentProgress.reviewChallenge.generatedAtTime, completed: studentProgress.reviewChallenge.isCompleted } : 'Nenhum');
            console.log('Glossário:', studentProgress.glossaryChallenge ? { date: studentProgress.glossaryChallenge.date, generatedAt: studentProgress.glossaryChallenge.generatedAtTime, completed: studentProgress.glossaryChallenge.isCompleted } : 'Nenhum');
            console.log('Português:', studentProgress.portugueseChallenge ? { date: studentProgress.portugueseChallenge.date, generatedAt: studentProgress.portugueseChallenge.generatedAtTime, completed: studentProgress.portugueseChallenge.isCompleted } : 'Nenhum');
    
            const [prefHours, prefMinutes] = preferredTimeStr.split(':').map(Number);
            const preferredTimeInMinutes = prefHours * 60 + prefMinutes;
            const currentTimeInMinutes = brasiliaNow.getUTCHours() * 60 + brasiliaNow.getUTCMinutes();
    
            if (currentTimeInMinutes < preferredTimeInMinutes) {
                console.log("Ainda não é o horário agendado. Verificação encerrada.");
                console.groupEnd();
                return;
            }
    
            const updatesToApply: Partial<Pick<StudentProgress, 'reviewChallenge' | 'glossaryChallenge' | 'portugueseChallenge'>> = {};
            let needsUpdate = false;
    
            // --- Review Challenge ---
            const currentReviewChallenge = studentProgress.reviewChallenge;
            const shouldGenerateReview = !currentReviewChallenge || currentReviewChallenge.date !== todayISO || (currentReviewChallenge.date === todayISO && !currentReviewChallenge.isCompleted && currentReviewChallenge.generatedAtTime !== preferredTimeStr);
    
            if (shouldGenerateReview) {
                console.log("[REVISÃO] Condições para gerar atendidas. Buscando questões...");
                const reviewMode = studentProgress.dailyReviewMode || 'standard';
                let challengeQuestions: Question[] = [];
                if (reviewMode === 'advanced') {
                    const subjectIdsInCourses = new Set(enrolledCourses.flatMap(c => c.disciplines.map(d => d.subjectId)));
                    let subjectsForStudent = allSubjects.filter(s => subjectIdsInCourses.has(s.id));
                    const selectedSubjectIds = studentProgress.advancedReviewSubjectIds;
                    if (selectedSubjectIds && selectedSubjectIds.length > 0) {
                        subjectsForStudent = subjectsForStudent.filter(s => new Set(selectedSubjectIds).has(s.id));
                    }
                    subjectsForStudent.forEach(subject => {
                        const incorrectInSubject = incorrectQuestions.filter(q => q.subjectId === subject.id);
                        challengeQuestions.push(...shuffle(incorrectInSubject).slice(0, 5));
                    });
                } else {
                    challengeQuestions = shuffle(incorrectQuestions).slice(0, 5);
                }
    
                if (challengeQuestions.length > 0) {
                    console.log(`[REVISÃO] ${challengeQuestions.length} questões encontradas. Gerando desafio.`);
                    const uncompletedCount = (currentReviewChallenge && !currentReviewChallenge.isCompleted && currentReviewChallenge.date !== todayISO) ? (currentReviewChallenge.uncompletedCount || 0) + 1 : 0;
                    updatesToApply.reviewChallenge = {
                        date: todayISO,
                        generatedAtTime: preferredTimeStr,
                        items: challengeQuestions,
                        isCompleted: false,
                        attemptsMade: 0,
                        uncompletedCount,
                        sessionAttempts: [],
                    };
                    needsUpdate = true;
                } else {
                    console.log("[REVISÃO] Nenhuma questão incorreta encontrada para gerar o desafio.");
                    if (studentProgress.reviewChallenge) {
                        updatesToApply.reviewChallenge = undefined;
                        needsUpdate = true;
                    }
                }
            } else {
                console.log("[REVISÃO] Não é necessário gerar novo desafio.");
            }
    
            // --- Portuguese Challenge (Async) ---
            const currentPortugueseChallenge = studentProgress.portugueseChallenge;
            const shouldGeneratePortuguese = !currentPortugueseChallenge || currentPortugueseChallenge.date !== todayISO || (currentPortugueseChallenge.date === todayISO && !currentPortugueseChallenge.isCompleted && currentPortugueseChallenge.generatedAtTime !== preferredTimeStr);
    
            if (shouldGeneratePortuguese) {
                console.log("[PORTUGUÊS] Condições para gerar atendidas. Gerando novo desafio.");
                try {
                    const questionCount = studentProgress.portugueseChallengeQuestionCount || 1;
                    const questions = await GeminiService.generatePortugueseChallenge(questionCount);
                    const uncompletedCount = (currentPortugueseChallenge && !currentPortugueseChallenge.isCompleted && currentPortugueseChallenge.date !== todayISO) ? (currentPortugueseChallenge.uncompletedCount || 0) + 1 : 0;
                    updatesToApply.portugueseChallenge = {
                        date: todayISO,
                        generatedAtTime: preferredTimeStr,
                        items: questions.map((q, i) => ({ ...q, id: `port-challenge-${todayISO}-${i}` })),
                        isCompleted: false,
                        attemptsMade: 0,
                        uncompletedCount,
                        sessionAttempts: [],
                    };
                    needsUpdate = true;
                } catch (error) {
                    console.error("[PORTUGUÊS] Falha ao gerar desafio:", error);
                }
            } else {
                console.log("[PORTUGUÊS] Não é necessário gerar novo desafio.");
            }
    
            // --- Glossary Challenge ---
            const currentGlossaryChallenge = studentProgress.glossaryChallenge;
            const shouldGenerateGlossary = !currentGlossaryChallenge || currentGlossaryChallenge.date !== todayISO || (currentGlossaryChallenge.date === todayISO && !currentGlossaryChallenge.isCompleted && currentGlossaryChallenge.generatedAtTime !== preferredTimeStr);
    
            if (shouldGenerateGlossary) {
                console.log("[GLOSSÁRIO] Condições para gerar atendidas. Buscando termos...");
                const allGlossaryTerms = allSubjects.flatMap(s => s.topics.flatMap(t => [...(t.glossary || []).map(g => ({ ...g, subjectId: s.id })), ...t.subtopics.flatMap(st => (st.glossary || []).map(g => ({ ...g, subjectId: s.id })))]));
                const uniqueGlossaryTerms = Array.from(new Map(allGlossaryTerms.map(item => [item.term, item])).values());
                const termsBySubject = uniqueGlossaryTerms.reduce((acc, term) => {
                    if (!acc[term.subjectId]) acc[term.subjectId] = [];
                    acc[term.subjectId].push(term);
                    return acc;
                }, {} as { [subjectId: string]: (GlossaryTerm & { subjectId: string })[] });
    
                const questionableTerms = uniqueGlossaryTerms.filter(term => (termsBySubject[term.subjectId]?.length || 0) >= 5);
    
                if (questionableTerms.length > 0) {
                    const questionCount = Math.min(studentProgress.glossaryChallengeQuestionCount || 5, questionableTerms.length);
                    const challengeTerms = shuffle(questionableTerms).slice(0, questionCount);
                    const glossaryQuestions: Question[] = challengeTerms.map((term, index) => {
                        const distractors = shuffle(termsBySubject[term.subjectId].filter(t => t.term !== term.term)).slice(0, 4).map(t => t.definition);
                        return { id: `gloss-challenge-${todayISO}-${index}`, statement: `Qual é a definição de "${term.term}"?`, options: shuffle([term.definition, ...distractors]), correctAnswer: term.definition, justification: `A definição correta para "${term.term}" é: ${term.definition}` };
                    });
    
                    if (glossaryQuestions.length > 0) {
                        console.log(`[GLOSSÁRIO] ${glossaryQuestions.length} questões geradas. Criando desafio.`);
                        const uncompletedCount = (currentGlossaryChallenge && !currentGlossaryChallenge.isCompleted && currentGlossaryChallenge.date !== todayISO) ? (currentGlossaryChallenge.uncompletedCount || 0) + 1 : 0;
                        updatesToApply.glossaryChallenge = {
                            date: todayISO,
                            generatedAtTime: preferredTimeStr,
                            items: glossaryQuestions,
                            isCompleted: false,
                            attemptsMade: 0,
                            uncompletedCount,
                            sessionAttempts: [],
                        };
                        needsUpdate = true;
                    }
                } else {
                    console.log("[GLOSSÁRIO] Não há termos suficientes para gerar o desafio.");
                    if (studentProgress.glossaryChallenge) {
                        updatesToApply.glossaryChallenge = undefined;
                        needsUpdate = true;
                    }
                }
            } else {
                console.log("[GLOSSÁRIO] Não é necessário gerar novo desafio.");
            }
    
            console.groupEnd();
            if (needsUpdate) {
                console.log("Atualizando progresso do aluno com novos desafios...");
                setStudentProgress(currentProgress => {
                    if (!currentProgress) return null;
    
                    const updatedProgress = { ...currentProgress };
    
                    // Apply updates, handling undefined to mean 'delete'
                    Object.keys(updatesToApply).forEach(keyStr => {
                        const key = keyStr as keyof typeof updatesToApply;
                        if (updatesToApply[key] === undefined) {
                            delete (updatedProgress as any)[key];
                        } else {
                            (updatedProgress as any)[key] = updatesToApply[key];
                        }
                    });
    
                    FirebaseService.saveStudentProgress(updatedProgress);
    
                    return updatedProgress;
                });
            }
        };
    
        checkAndGenerateChallenges();
    }, [studentProgress, isPreview, incorrectQuestions, allSubjects, enrolledCourses, currentTime]);

    const handleCloseDailyChallengeResults = () => {
        setView('dashboard');
        setDailyChallengeResults(null);
    };

    const handleProfileSave = (updatedUser: User) => {
        onUpdateUser(updatedUser);
    };

    const handleBack = () => {
        if (view === 'topic') {
            setView('subject');
            setSelectedTopic(null);
            setSelectedSubtopic(null);
        } else if (view === 'subject') {
            setView('course');
            setSelectedSubject(null);
        } else {
            setView('dashboard');
            setSelectedCourse(null);
            setSelectedSubject(null);
            setSelectedTopic(null);
            setSelectedSubtopic(null);
            setSelectedReview(null);
        }
    };

    const handleCourseSelect = (course: Course) => {
        setSelectedCourse(course);
        setView('course');
    };

    const handleSubjectSelect = (subject: Subject) => {
        setSelectedSubject(subject);
        setView('subject');
    };
    
    const handleTopicSelect = (topic: Topic | SubTopic, parentTopic?: Topic) => {
        if ('subtopics' in topic) {
            setSelectedTopic(topic);
            setSelectedSubtopic(null);
        } else {
            setSelectedTopic(parentTopic!);
            setSelectedSubtopic(topic);
        }
        setIsSplitView(false);
        setView('topic');
    };
    
    const handleNavigateToTopicById = (topicId: string) => {
        for (const subject of allSubjects) {
            for (const topic of subject.topics) {
                if(topic.id === topicId) {
                    setSelectedSubject(subject);
                    handleTopicSelect(topic);
                    return;
                }
                const subtopic = topic.subtopics.find((st: SubTopic) => st.id === topicId);
                if (subtopic) {
                    setSelectedSubject(subject);
                    handleTopicSelect(subtopic, topic);
                    return;
                }
            }
        }
    };
    
    const handleSavePlan = async (plan: StudyPlan['plan']) => {
        if (isPreview || !studentProgress) return;
        const newPlan: StudyPlan = {
            studentId: user.id,
            plan: plan,
        };
        await FirebaseService.saveStudyPlanForStudent(newPlan);
        showXpToast(0, 'Cronograma salvo!');
    };
    
    const handleStartReview = (review: ReviewSession) => {
        setSelectedReview(review);
        setView('review_quiz');
    };
    
    const handleAcknowledgeMessage = async (messageId: string) => {
        if(isPreview) return;
        await FirebaseService.acknowledgeMessage(messageId, user.id);
    };

    const handleSendReply = async (messageId: string, reply: Omit<MessageReply, 'timestamp'>) => {
        if (isPreview) return;
        await FirebaseService.addReplyToMessage(messageId, reply);
    };
    
    const handleSendMessage = async (teacherId: string, text: string) => {
        if (isPreview) return;
        
        const existingThread = messages.find(m => m.teacherId === teacherId && m.studentId === user.id);

        if (existingThread) {
            await handleSendReply(existingThread.id, {
                senderId: user.id,
                name: user.name || user.username,
                avatarUrl: user.avatarUrl,
                text: text,
            });
        } else {
            await FirebaseService.addMessage({
                senderId: user.id,
                teacherId: teacherId,
                studentId: user.id,
                message: text,
            });
        }
        setIsNewMessageModalOpen(false);
    };

    const handleCustomGameSave = (game: MiniGame) => {
        if (!studentProgress) return;
        const isEditing = studentProgress.customGames.some((g: MiniGame) => g.id === game.id);
        const updatedGames = isEditing
            ? studentProgress.customGames.map((g: MiniGame) => g.id === game.id ? game : g)
            : [...studentProgress.customGames, game];
        updateStudentProgress({ ...studentProgress, customGames: updatedGames });
    };

    const handleCustomGameDelete = (gameId: string) => {
        if (!studentProgress || !window.confirm("Tem certeza que deseja apagar este jogo?")) return;
        const updatedGames = studentProgress.customGames.filter((g: MiniGame) => g.id !== gameId);
        updateStudentProgress({ ...studentProgress, customGames: updatedGames });
    };

    const handlePlayGame = (game: MiniGame, topicId: string) => {
        setPlayingGame({ game, topicId });
    };
    
    const handleSelectTargetCargo = (courseId: string, cargoName: string) => {
        if (!studentProgress) return;

        const newTargetCargoByCourse = {
            ...studentProgress.targetCargoByCourse,
            [courseId]: cargoName,
        };
        
        const newProgress = {
            ...studentProgress,
            targetCargoByCourse: newTargetCargoByCourse,
        };
        updateStudentProgress(newProgress, studentProgress);
    };

    const handleStartDailyChallenge = (challengeType: 'review' | 'glossary' | 'portuguese') => {
        if (isPreview || !studentProgress) return;
    
        const newProgress: StudentProgress = JSON.parse(JSON.stringify(studentProgress));
        const challengeKey = `${challengeType}Challenge` as const;
        const challenge = newProgress[challengeKey];
        if (!challenge) return;

        let maxAttempts: number | 'unlimited' = 1;
        switch (challengeType) {
            case 'review':
                maxAttempts = newProgress.dailyReviewMode === 'standard' ? 1 : (newProgress.advancedReviewMaxAttempts ?? 1);
                break;
            case 'glossary':
                maxAttempts = newProgress.glossaryChallengeMode === 'standard' ? 1 : (newProgress.glossaryChallengeMaxAttempts ?? 1);
                break;
            case 'portuguese':
                maxAttempts = newProgress.portugueseChallengeMaxAttempts ?? 1;
                break;
        }

        if (maxAttempts !== 'unlimited') {
            challenge.attemptsMade = (challenge.attemptsMade || 0) + 1;
            setStudentProgress(newProgress);
            FirebaseService.saveStudentProgress(newProgress);
        }
        
        setQuizInstanceKey(prev => prev + 1);

        setActiveChallenge({
            type: challengeType,
            questions: challenge.items as Question[],
            sessionAttempts: challenge.sessionAttempts || [],
        });
        setView('daily_challenge_quiz');
    };
    
    const handleReportQuestion = async (subjectId: string, topicId: string, questionId: string, isTec: boolean, reason: string) => {
        if (isPreview) {
            alert("Ação desabilitada no modo de pré-visualização.");
            return;
        }
        try {
            const reportInfo = { reason, studentId: user.id };
            await FirebaseService.updateSubjectQuestion(subjectId, topicId, questionId, isTec, reportInfo);
            
            const subject = allSubjects.find(s => s.id === subjectId);
            if (subject) {
                const topicContent = subject.topics.flatMap((t: Topic) => [t, ...t.subtopics]).find(item => item.id === topicId.replace('-tec', ''));
                const questionContent = topicContent ? 
                    [...(topicContent.questions || []), ...(topicContent.tecQuestions || [])].find(q => q.id === questionId)
                    : undefined;

                if(topicContent && questionContent) {
                    await FirebaseService.createReportNotification(
                        subject.teacherId,
                        user,
                        subject.name,
                        topicContent.name,
                        questionContent.statement,
                        reason
                    );
                }
            }
            
            showXpToast(0, 'Questão reportada. Obrigado!');
        } catch (error) {
            console.error("Error reporting question:", error);
            alert("Não foi possível reportar a questão. Tente novamente mais tarde.");
        }
    };
    
    if (isLoading || !studentProgress) {
        return <div className="min-h-screen flex items-center justify-center"><Spinner /></div>
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <XpToastDisplay toasts={xpToasts} />
            <BadgeAwardModal isOpen={justAwardedBadges.length > 0} onClose={() => setJustAwardedBadges([])} badges={justAwardedBadges} />
            <LevelUpModal isOpen={isLevelUpModalOpen} onClose={() => setIsLevelUpModalOpen(false)} newLevel={leveledUpTo} levelTitle={getLevelTitle(leveledUpTo)} />

            <StudentHeader
                user={user}
                studentProgress={studentProgress}
                view={view}
                selectedTopicName={selectedSubtopic?.name || selectedTopic?.name}
                selectedCourseName={selectedCourse?.name}
                onSetView={setView}
                onOpenProfile={() => setIsProfileModalOpen(true)}
                onLogout={isPreview ? onToggleStudentView! : onLogout}
                isLogoutIcon={!isPreview}
            />

            <main>
                {view !== 'dashboard' && (
                    <button onClick={handleBack} className="text-cyan-400 hover:text-cyan-300 mb-6 flex items-center">
                        <ArrowRightIcon className="h-4 w-4 mr-2 transform rotate-180" aria-hidden="true" /> Voltar
                    </button>
                )}
                <StudentViewRouter
                    view={view}
                    isPreview={isPreview}
                    currentUser={user}
                    studentProgress={studentProgress}
                    allSubjects={allSubjects}
                    allStudents={allStudents}
                    allStudentProgress={allStudentProgress}
                    enrolledCourses={enrolledCourses}
                    studyPlan={studyPlan}
                    messages={messages}
                    teacherProfiles={teacherProfiles}
                    selectedCourse={selectedCourse}
                    selectedSubject={selectedSubject}
                    selectedTopic={selectedTopic}
                    selectedSubtopic={selectedSubtopic}
                    selectedReview={selectedReview}
                    activeChallenge={activeChallenge}
                    isGeneratingReview={isGeneratingReview}
                    isSplitView={isSplitView}
                    isSidebarCollapsed={isSidebarCollapsed}
                    onAcknowledgeMessage={handleAcknowledgeMessage}
                    onCourseSelect={handleCourseSelect}
                    onSubjectSelect={handleSubjectSelect}
                    onTopicSelect={handleTopicSelect}
                    onStartDailyChallenge={handleStartDailyChallenge}
                    onNavigateToTopic={handleNavigateToTopicById}
                    onToggleTopicCompletion={handleTopicCompletionToggle}
                    onOpenNewMessageModal={() => setIsNewMessageModalOpen(true)}
                    onSavePlan={handleSavePlan}
                    onStartReview={handleStartReview}
                    onGenerateSmartReview={handleGenerateSmartReview}
                    onGenerateSrsReview={handleGenerateSrsReview}
                    onGenerateSmartFlashcards={handleGenerateSmartFlashcards}
                    onFlashcardReview={handleFlashcardReview}
                    onUpdateStudentProgress={updateStudentProgress}
                    saveQuizProgress={saveQuizProgress}
                    saveReviewProgress={saveReviewProgress}
                    handleTopicQuizComplete={handleTopicQuizComplete}
                    handleReviewQuizComplete={handleReviewQuizComplete}
                    handleDailyChallengeComplete={handleDailyChallengeComplete}
                    onAddBonusXp={handleAddBonusXp}
                    onPlayGame={handlePlayGame}
                    onDeleteCustomGame={handleCustomGameDelete}
                    onOpenCustomGameModal={(game: MiniGame | null) => { setEditingCustomGame(game); setIsCustomGameModalOpen(true); }}
                    onSelectTargetCargo={handleSelectTargetCargo}
                    onNoteSave={handleNoteSave}
                    onToggleSplitView={() => setIsSplitView(prev => !prev)}
                    onSetIsSidebarCollapsed={setIsSidebarCollapsed}
                    onOpenChatModal={() => setIsChatModalOpen(true)}
                    setView={setView}
                    setActiveChallenge={setActiveChallenge}
                    quizInstanceKey={quizInstanceKey}
                    onSaveDailyChallengeAttempt={saveDailyChallengeAttempt}
                    handleGameComplete={handleGameComplete}
                    handleGameError={handleGameError}
                    onReportQuestion={handleReportQuestion}
                    dailyChallengeResults={dailyChallengeResults}
                    onCloseDailyChallengeResults={handleCloseDailyChallengeResults}
                />
            </main>
            
            <EditProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} user={user} onSave={handleProfileSave} />
            {playingGame && <StudentGamePlayerModal isOpen={!!playingGame} onClose={() => setPlayingGame(null)} game={playingGame.game} onGameComplete={handleGameComplete} onGameError={handleGameError} />}
            {isCustomGameModalOpen && <StudentGameEditorModal isOpen={isCustomGameModalOpen} onClose={() => setIsCustomGameModalOpen(false)} game={editingCustomGame} onSave={handleCustomGameSave} />}
            <NewMessageModal 
                isOpen={isNewMessageModalOpen}
                onClose={() => setIsNewMessageModalOpen(false)}
                teachers={teacherProfiles}
                onSendMessage={handleSendMessage}
            />
            <Modal isOpen={isChatModalOpen} onClose={() => setIsChatModalOpen(false)} title="Assistente IA" size="3xl">
                <div className="h-[70vh]">
                     {(selectedTopic || selectedSubtopic) && selectedSubject && <AiAssistant subject={selectedSubject} topic={selectedSubtopic || selectedTopic!} />}
                </div>
            </Modal>
        </div>
    );
};
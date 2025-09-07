import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    User, Subject, Topic, SubTopic, Course, ReviewSession, Question, QuestionAttempt,
    MiniGame, CustomQuiz, TeacherMessage, StudentProgress
} from '../../types';
import * as FirebaseService from '../../services/firebaseService';
import * as GeminiService from '../../services/geminiService';
import { useStudentData } from '../../hooks/useStudentData';
import { Spinner, Modal, Button } from '../ui';
import { StudentHeader } from './StudentHeader';
import { StudentViewRouter } from './StudentViewRouter';
import { EditProfileModal } from './EditProfileModal';
import { LevelUpModal } from './LevelUpModal';
import { BadgeAwardModal } from './BadgeAwardModal';
import { XpToastDisplay } from './XpToastDisplay';
import { StudentGamePlayerModal } from './StudentGamePlayerModal';
// FIX: Corrected import to a valid component module.
import { MessageThreadModal } from '../MessageThreadModal';
import { NewMessageModal } from './NewMessageModal';
import { AiAssistant } from './AiAssistant';
import { StudentCustomQuizCreatorModal } from './StudentCustomQuizCreatorModal';
import { calculateLevel, getLevelTitle, XP_CONFIG, ALL_BADGES, SRS_INTERVALS } from '../../gamification';
import { getBrasiliaDate, getLocalDateISOString } from '../../utils';
import { ArrowRightIcon } from '../Icons';

type ViewType = 'dashboard' | 'course' | 'subject' | 'topic' | 'schedule' | 'performance' | 'reviews' | 'review_quiz' | 'games' | 'daily_challenge_quiz' | 'daily_challenge_results' | 'custom_quiz_list' | 'custom_quiz_player';

interface PaineldoAlunoProps {
    user: User;
    onLogout: () => void;
    onUpdateUser: (user: User) => void;
    isPreview?: boolean;
    onToggleStudentView?: () => void;
}

export const PaineldoAluno: React.FC<PaineldoAlunoProps> = ({ user, onLogout, onUpdateUser, isPreview = false, onToggleStudentView, }) => {
    const [view, setView] = useState<ViewType>('dashboard');
    const [history, setHistory] = useState<ViewType[]>(['dashboard']);
    const {
        isLoading, allSubjects, allStudents, allStudentProgress, enrolledCourses, studentProgress, setStudentProgress,
        studyPlan, messages, teacherProfiles,
    } = useStudentData(user, isPreview);

    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
    const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
    const [selectedSubtopic, setSelectedSubtopic] = useState<SubTopic | null>(null);
    const [selectedReview, setSelectedReview] = useState<ReviewSession | null>(null);
    
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isChatModalOpen, setIsChatModalOpen] = useState(false);
    const [isNewMessageModalOpen, setIsNewMessageModalOpen] = useState(false);
    const [isCustomQuizCreatorOpen, setIsCustomQuizCreatorOpen] = useState(false);
    const [quizToDeleteId, setQuizToDeleteId] = useState<string | null>(null);
    const [gameToDeleteId, setGameToDeleteId] = useState<string | null>(null);
    
    const [levelUpInfo, setLevelUpInfo] = useState<{ level: number; title: string } | null>(null);
    const [awardedBadges, setAwardedBadges] = useState<any[]>([]);
    const [xpToasts, setXpToasts] = useState<{ id: number; amount: number; message?: string }[]>([]);
    
    const [playingGame, setPlayingGame] = useState<{ game: MiniGame; topicId: string } | null>(null);
    const [activeThread, setActiveThread] = useState<TeacherMessage | null>(null);
    
    const [isSplitView, setIsSplitView] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    
    const [activeChallenge, setActiveChallenge] = useState<{ type: 'review' | 'glossary' | 'portuguese', questions: Question[], sessionAttempts: QuestionAttempt[] } | null>(null);
    const [dailyChallengeResults, setDailyChallengeResults] = useState<{ questions: Question[], sessionAttempts: QuestionAttempt[] } | null>(null);
    
    const [isGeneratingReview, setIsGeneratingReview] = useState(false);
    const [quizInstanceKey, setQuizInstanceKey] = useState(Date.now());
    const [activeCustomQuiz, setActiveCustomQuiz] = useState<CustomQuiz | null>(null);

    // FIX: Moved useMemo to the top of the component with other hooks to prevent conditional rendering errors.
    const quizInfoForDeleteModal = useMemo(() => {
        if (!quizToDeleteId || !studentProgress?.customQuizzes) return null;
        return studentProgress.customQuizzes.find(q => q.id === quizToDeleteId);
    }, [quizToDeleteId, studentProgress]);

    const gameInfoForDeleteModal = useMemo(() => {
        if (!gameToDeleteId || !studentProgress?.customGames) return null;
        return studentProgress.customGames.find(g => g.id === gameToDeleteId);
    }, [gameToDeleteId, studentProgress]);

    useEffect(() => { if (!isSplitView) { setIsSidebarCollapsed(false); } }, [isSplitView]);
    
    const changeView = (newView: ViewType) => {
        setView(newView);
        if (newView !== 'topic') setIsSplitView(false);
        setHistory(prev => [...prev, newView]);
    };

    const handleGoHome = () => {
        setView('dashboard');
        setHistory(['dashboard']);
        setSelectedCourse(null);
        setSelectedSubject(null);
        setSelectedTopic(null);
        setSelectedSubtopic(null);
        setSelectedReview(null);
        setActiveChallenge(null);
        setDailyChallengeResults(null);
        setActiveCustomQuiz(null);
    };
    
    const handleBack = () => {
        if (isSplitView) {
            setIsSplitView(false);
            return;
        }

        if (history.length > 1) {
            const newHistory = [...history];
            newHistory.pop();
            const prevView = newHistory[newHistory.length - 1];
            
            // Reset state when going back to broader views
            if (prevView === 'dashboard') {
                setSelectedCourse(null);
                setSelectedSubject(null);
                setSelectedTopic(null);
                setSelectedSubtopic(null);
            } else if (prevView === 'course') {
                setSelectedSubject(null);
                setSelectedTopic(null);
                setSelectedSubtopic(null);
            } else if (prevView === 'subject') {
                setSelectedTopic(null);
                setSelectedSubtopic(null);
            }

            setView(prevView);
            setHistory(newHistory);
        } else if (isPreview && onToggleStudentView) {
            onToggleStudentView();
        } else {
            // Fallback to home if back is pressed at the root view
            handleGoHome();
        }
    };
    
    const handleTopicSelect = (topic: Topic | SubTopic, parent?: Topic) => {
        if ('subtopics' in topic) { // It's a Topic
            setSelectedTopic(topic);
            setSelectedSubtopic(null);
        } else { // It's a SubTopic
            setSelectedTopic(parent!);
            setSelectedSubtopic(topic);
        }
        changeView('topic');
    };
    
    const onNavigateToTopic = (topicId: string) => {
        for (const subject of allSubjects) {
            const course = enrolledCourses.find(c => c.disciplines.some(d => d.subjectId === subject.id));
            if (!course) continue;

            for (const topic of subject.topics) {
                if (topic.id === topicId) {
                    setSelectedCourse(course);
                    setSelectedSubject(subject);
                    handleTopicSelect(topic);
                    return;
                }
                const subtopic = topic.subtopics.find(st => st.id === topicId);
                if (subtopic) {
                    setSelectedCourse(course);
                    setSelectedSubject(subject);
                    handleTopicSelect(subtopic, topic);
                    return;
                }
            }
        }
    };
    
    const handleUpdateStudentProgress = useCallback(async (newProgress: StudentProgress, fromState: StudentProgress | null = studentProgress) => {
        if (isPreview) { setStudentProgress(newProgress); return; }
        if (fromState) {
            if (calculateLevel(newProgress.xp) > calculateLevel(fromState.xp)) {
                setLevelUpInfo({ level: calculateLevel(newProgress.xp), title: getLevelTitle(calculateLevel(newProgress.xp)) });
            }
            
            const newlyAwardedBadges = Object.keys(ALL_BADGES)
                .filter(id => !(fromState.earnedBadgeIds || []).includes(id) && ALL_BADGES[id].condition(newProgress, allSubjects, allStudentProgress))
                .map(id => ({ ...ALL_BADGES[id], id }));
                
            if (newlyAwardedBadges.length > 0) {
                setAwardedBadges(prev => [...prev, ...newlyAwardedBadges]);
                const newBadgeIds = newlyAwardedBadges.map(b => b.id);
                // This is the fix. Add the new badges to the progress object itself.
                newProgress.earnedBadgeIds = [...(newProgress.earnedBadgeIds || []), ...newBadgeIds];
            }
        }
        setStudentProgress(newProgress);
        await FirebaseService.saveStudentProgress(newProgress);
    }, [isPreview, studentProgress, setStudentProgress, allSubjects, allStudentProgress]);

    const addXp = useCallback((amount: number, message?: string) => {
        if (isPreview) return;
        setXpToasts(prev => [...prev, { id: Date.now(), amount, message }]);
        setTimeout(() => setXpToasts(prev => prev.slice(1)), 3000);
        if (!studentProgress) return;
        handleUpdateStudentProgress({ ...studentProgress, xp: studentProgress.xp + amount }, studentProgress);
    }, [isPreview, studentProgress, handleUpdateStudentProgress]);
    
    const handleNoteSave = (contentId: string, content: string) => { if (studentProgress) handleUpdateStudentProgress({ ...studentProgress, notesByTopic: { ...studentProgress.notesByTopic, [contentId]: content } }); };
    
    const saveQuizProgress = (subjectId: string, topicId: string, attempt: QuestionAttempt) => {
        if (!studentProgress) return;
        const newProgress = JSON.parse(JSON.stringify(studentProgress));

        // START: BUG FIX - Save individual attempt to topic progress
        if (!newProgress.progressByTopic[subjectId]) {
            newProgress.progressByTopic[subjectId] = {};
        }
        if (!newProgress.progressByTopic[subjectId][topicId]) {
            newProgress.progressByTopic[subjectId][topicId] = { completed: false, score: 0, lastAttempt: [] };
        }
        const existingAttempts = newProgress.progressByTopic[subjectId][topicId].lastAttempt || [];
        const attemptIndex = existingAttempts.findIndex((a: QuestionAttempt) => a.questionId === attempt.questionId);
        if (attemptIndex > -1) {
            existingAttempts[attemptIndex] = attempt;
        } else {
            existingAttempts.push(attempt);
        }
        newProgress.progressByTopic[subjectId][topicId].lastAttempt = existingAttempts;
        // END: BUG FIX

        const today = getLocalDateISOString(getBrasiliaDate());
        newProgress.dailyActivity[today] = newProgress.dailyActivity[today] || { questionsAnswered: 0 };
        newProgress.dailyActivity[today].questionsAnswered++;
        const srsData = newProgress.srsData[attempt.questionId] || { stage: 0 };
        const newStage = attempt.isCorrect ? Math.min(srsData.stage + 1, SRS_INTERVALS.length - 1) : Math.max(0, srsData.stage - 1);
        const nextReview = getBrasiliaDate();
        nextReview.setUTCDate(nextReview.getUTCDate() + SRS_INTERVALS[newStage]);
        newProgress.srsData[attempt.questionId] = { stage: newStage, nextReviewDate: getLocalDateISOString(nextReview) };
        if(attempt.isCorrect) addXp(XP_CONFIG.CORRECT_ANSWER);
        handleUpdateStudentProgress(newProgress);
    };

    const handleTopicQuizComplete = (subjectId: string, topicId: string, attempts: QuestionAttempt[]) => {
        if (!studentProgress) return;
        const score = attempts.length > 0 ? attempts.filter(a => a.isCorrect).length / attempts.length : 0;
        const newProgress = JSON.parse(JSON.stringify(studentProgress));
        
        // START: BUG FIX - Ensure progress structure exists and save final state
        if (!newProgress.progressByTopic[subjectId]) {
            newProgress.progressByTopic[subjectId] = {};
        }
        if (!newProgress.progressByTopic[subjectId][topicId]) {
            newProgress.progressByTopic[subjectId][topicId] = { completed: false, score: 0, lastAttempt: [] };
        }
        newProgress.progressByTopic[subjectId][topicId].score = score;
        newProgress.progressByTopic[subjectId][topicId].lastAttempt = attempts;
        
        // BUG FIX: Award topic medals based on score
        if (!newProgress.earnedTopicBadgeIds) {
            newProgress.earnedTopicBadgeIds = {};
        }
        const earnedBadges = new Set(newProgress.earnedTopicBadgeIds[topicId] || []);
        if (score === 1) {
            earnedBadges.add('gold');
            earnedBadges.add('silver');
            earnedBadges.add('bronze');
        } else if (score >= 0.9) {
            earnedBadges.add('silver');
            earnedBadges.add('bronze');
        } else if (score >= 0.7) {
            earnedBadges.add('bronze');
        }
        newProgress.earnedTopicBadgeIds[topicId] = Array.from(earnedBadges);
        
        if (score >= 0.7 && !newProgress.progressByTopic[subjectId][topicId].completed) {
            newProgress.progressByTopic[subjectId][topicId].completed = true;
            addXp(XP_CONFIG.TOPIC_COMPLETE, 'Tópico Concluído!');
        }
        handleUpdateStudentProgress(newProgress);
    };
    
    const saveReviewProgress = (reviewId: string, attempt: QuestionAttempt) => {
        if (!studentProgress) return;
        const newProgress = JSON.parse(JSON.stringify(studentProgress));
        const reviewIndex = newProgress.reviewSessions.findIndex((r: ReviewSession) => r.id === reviewId);
        if (reviewIndex > -1) {
            const review = newProgress.reviewSessions[reviewIndex];
            if (!review.attempts) review.attempts = [];
            const attemptIndex = review.attempts.findIndex((a: QuestionAttempt) => a.questionId === attempt.questionId);
            if(attemptIndex > -1) {
                review.attempts[attemptIndex] = attempt;
            } else {
                review.attempts.push(attempt);
            }
        }
        if (attempt.isCorrect) addXp(XP_CONFIG.CORRECT_REVIEW_ANSWER);
        handleUpdateStudentProgress(newProgress);
    };
    
    const handleReviewQuizComplete = (reviewId: string, attempts: QuestionAttempt[]) => {
        if (!studentProgress) return;
        const newProgress = JSON.parse(JSON.stringify(studentProgress));
        const reviewIndex = newProgress.reviewSessions.findIndex((r: ReviewSession) => r.id === reviewId);
        if (reviewIndex > -1) {
            newProgress.reviewSessions[reviewIndex].isCompleted = true;
            newProgress.reviewSessions[reviewIndex].attempts = attempts;
            addXp(XP_CONFIG.REVIEW_SESSION_COMPLETE, 'Revisão Concluída!');
        }
        handleUpdateStudentProgress(newProgress);
    };
    
    const onSaveDailyChallengeAttempt = (challengeType: 'review' | 'glossary' | 'portuguese', attempt: QuestionAttempt) => {
        if (!studentProgress) return;
        const newProgress = JSON.parse(JSON.stringify(studentProgress));
        
        const challengeKey = `${challengeType}Challenge` as 'reviewChallenge' | 'glossaryChallenge' | 'portugueseChallenge';
        const challenge = newProgress[challengeKey];

        if (challenge) {
            if (!challenge.sessionAttempts) challenge.sessionAttempts = [];
            
            const attemptIndex = challenge.sessionAttempts.findIndex((a: QuestionAttempt) => a.questionId === attempt.questionId);
            if (attemptIndex > -1) {
                challenge.sessionAttempts[attemptIndex] = attempt;
            } else {
                challenge.sessionAttempts.push(attempt);
            }
        }
        
        if (attempt.isCorrect) addXp(XP_CONFIG.CORRECT_ANSWER);
        handleUpdateStudentProgress(newProgress);
    };

    const handleDailyChallengeComplete = (finalAttempts: QuestionAttempt[]) => {
        if (!studentProgress || !activeChallenge) return;

        const { type } = activeChallenge;
        const newProgress = JSON.parse(JSON.stringify(studentProgress));
        const challengeKey = `${type}Challenge` as 'reviewChallenge' | 'glossaryChallenge' | 'portugueseChallenge';
        const challenge = newProgress[challengeKey];

        if (challenge) {
            challenge.sessionAttempts = finalAttempts;
            challenge.attemptsMade = (challenge.attemptsMade || 0) + 1;
            const score = finalAttempts.length > 0 ? finalAttempts.filter(a => a.isCorrect).length / finalAttempts.length : 0;

            if (score >= 0.6) { // 60% to pass
                challenge.isCompleted = true;
                const xpAmount = XP_CONFIG.DAILY_CHALLENGE_COMPLETE;
                newProgress.xp = (newProgress.xp || 0) + xpAmount;
                setXpToasts(prev => [...prev, { id: Date.now(), amount: xpAmount, message: 'Desafio Diário Concluído!' }]);
                setTimeout(() => setXpToasts(prev => prev.slice(1)), 3000);
            }
            setDailyChallengeResults({ questions: challenge.items, sessionAttempts: finalAttempts });
            changeView('daily_challenge_results');
        }
        handleUpdateStudentProgress(newProgress);
    };

    const saveCustomQuizAttempt = (attempt: QuestionAttempt) => {
        if (!studentProgress || !activeCustomQuiz) return;
        const newProgress = JSON.parse(JSON.stringify(studentProgress));
        
        const quizIndex = (newProgress.customQuizzes || []).findIndex((q: CustomQuiz) => q.id === activeCustomQuiz.id);
        if (quizIndex > -1) {
            const quiz = newProgress.customQuizzes[quizIndex];
            if (!quiz.attempts) quiz.attempts = [];
            
            const attemptIndex = quiz.attempts.findIndex((a: QuestionAttempt) => a.questionId === attempt.questionId);
            if (attemptIndex > -1) {
                quiz.attempts[attemptIndex] = attempt;
            } else {
                quiz.attempts.push(attempt);
            }
        }
        
        if (attempt.isCorrect) addXp(XP_CONFIG.CORRECT_ANSWER);
        handleUpdateStudentProgress(newProgress);
    };
    
    const handleCustomQuizComplete = (finalAttempts: QuestionAttempt[]) => {
        if (!studentProgress || !activeCustomQuiz) return;
        
        const newProgress = JSON.parse(JSON.stringify(studentProgress));
        const quizIndex = (newProgress.customQuizzes || []).findIndex((q: CustomQuiz) => q.id === activeCustomQuiz.id);
        
        if (quizIndex > -1) {
            newProgress.customQuizzes[quizIndex].isCompleted = true;
            newProgress.customQuizzes[quizIndex].attempts = finalAttempts;
        }
        
        handleUpdateStudentProgress(newProgress);
    };


    const handleStartDailyChallenge = (type: 'review' | 'glossary' | 'portuguese') => {
        if(!studentProgress) return;
        const challenge = type === 'review' ? studentProgress.reviewChallenge : type === 'glossary' ? studentProgress.glossaryChallenge : studentProgress.portugueseChallenge;
        if(challenge && !challenge.isCompleted) {
            setActiveChallenge({type, questions: challenge.items, sessionAttempts: challenge.sessionAttempts || []});
            setQuizInstanceKey(Date.now());
            changeView('daily_challenge_quiz');
        }
    };
    
    const handleGameComplete = (gameId: string) => {
        if (!studentProgress) return;
        addXp(XP_CONFIG.MINI_GAME_COMPLETE, 'Jogo Concluído!');
        const contentId = playingGame!.topicId;
        const newProgress = { ...studentProgress };
        newProgress.gamesCompletedCount = (newProgress.gamesCompletedCount || 0) + 1;
        newProgress.earnedGameBadgeIds = newProgress.earnedGameBadgeIds || {};
        newProgress.earnedGameBadgeIds[contentId] = [...new Set([...(newProgress.earnedGameBadgeIds[contentId] || []), gameId])];
        handleUpdateStudentProgress(newProgress);
    };

    const handleGameError = () => { addXp(-XP_CONFIG.GAME_ERROR_PENALTY, 'Erro no jogo'); };

    const onPlayGame = (game: MiniGame, topicId: string) => { setPlayingGame({ game, topicId }); };
    
    const onStartReview = (session: ReviewSession) => {
        setSelectedReview(session);
        changeView('review_quiz');
    };

    const onReportQuestion = async (subjectId: string, topicId: string, questionId: string, isTec: boolean, reason: string) => {
        const subject = allSubjects.find(s => s.id === subjectId);
        if(!subject) return;
        const topic = subject.topics.find(t => t.id === topicId) || subject.topics.flatMap(t => t.subtopics).find(st => st.id === topicId);
        if(!topic) return;
        const question = (isTec ? topic.tecQuestions : topic.questions)?.find(q => q.id === questionId);
        if (!question) return;
        const reportInfo = { reason, studentId: user.id };
        await FirebaseService.updateSubjectQuestion(subjectId, topicId, questionId, isTec, reportInfo);
        const teacher = teacherProfiles.find(t => t.id === subject.teacherId);
        if (teacher) {
            await FirebaseService.createReportNotification(teacher.id, user, subject.name, topic.name, question.statement, reason);
        }
    };

    const onSelectTargetCargo = (courseId: string, cargoName: string) => {
        if (!studentProgress) return;
        const newTargets = {...studentProgress.targetCargoByCourse, [courseId]: cargoName};
        const newProgress = {...studentProgress, targetCargoByCourse: newTargets};
        handleUpdateStudentProgress(newProgress);
    };

    const onGenerateSmartReview = async () => {
        if (!studentProgress) return;
        setIsGeneratingReview(true);
        try {
            const questions = await GeminiService.generateSmartReview(studentProgress, allSubjects);
            if (questions.length > 0) {
                const newSession: ReviewSession = {
                    id: `rev-ai-${Date.now()}`,
                    name: "Revisão Inteligente da IA",
                    type: 'ai',
                    createdAt: Date.now(),
                    questions: questions,
                    isCompleted: false,
                };
                onStartReview(newSession);
            } else {
                alert("Não há dados de erros suficientes para gerar uma revisão inteligente.");
            }
        } catch (e) {
            console.error(e);
            alert("Erro ao gerar revisão inteligente.");
        } finally {
            setIsGeneratingReview(false);
        }
    };

    const handleOpenCustomQuizCreator = useCallback(() => {
        setIsCustomQuizCreatorOpen(true);
    }, []);

    const handleCloseCustomQuizCreator = useCallback(() => {
        setIsCustomQuizCreatorOpen(false);
    }, []);

    const handleCustomQuizSave = useCallback((quiz: CustomQuiz) => {
        if (!studentProgress) return;
        const newQuizzes = [...(studentProgress.customQuizzes || []), quiz];
        handleUpdateStudentProgress({ ...studentProgress, customQuizzes: newQuizzes });
    }, [studentProgress, handleUpdateStudentProgress]);
    
    const handleDeleteCustomQuiz = useCallback((quizId: string) => {
        setQuizToDeleteId(quizId);
    }, []);

    const confirmDeleteQuiz = useCallback(() => {
        if (!studentProgress || !quizToDeleteId) return;
        const updatedQuizzes = (studentProgress.customQuizzes || []).filter(q => q.id !== quizToDeleteId);
        handleUpdateStudentProgress({ ...studentProgress, customQuizzes: updatedQuizzes });
        setQuizToDeleteId(null);
    }, [studentProgress, quizToDeleteId, handleUpdateStudentProgress]);
    
    const handleDeleteCustomGame = useCallback((gameId: string) => {
        setGameToDeleteId(gameId);
    }, []);

    const confirmDeleteGame = useCallback(() => {
        if (!studentProgress || !gameToDeleteId) return;
        const updatedGames = (studentProgress.customGames || []).filter(g => g.id !== gameToDeleteId);
        handleUpdateStudentProgress({ ...studentProgress, customGames: updatedGames });
        setGameToDeleteId(null);
    }, [studentProgress, gameToDeleteId, handleUpdateStudentProgress]);

    const handleToggleTopicCompletion = useCallback((subjectId: string, topicId: string, isCompleted: boolean) => {
        if (!studentProgress) return;
        const newProgress = JSON.parse(JSON.stringify(studentProgress));
        if (!newProgress.progressByTopic) newProgress.progressByTopic = {};
        if (!newProgress.progressByTopic[subjectId]) newProgress.progressByTopic[subjectId] = {};
        if (!newProgress.progressByTopic[subjectId][topicId]) {
            newProgress.progressByTopic[subjectId][topicId] = { completed: false, score: 0, lastAttempt: [] };
        }
        newProgress.progressByTopic[subjectId][topicId].completed = isCompleted;
        handleUpdateStudentProgress(newProgress);
    }, [studentProgress, handleUpdateStudentProgress]);

    const onGenerateSmartFlashcards = async (questions: Question[]) => {
        if (!studentProgress) return;
        const cards = await GeminiService.generateFlashcardsFromIncorrectAnswers(questions);
        const cardsWithIds = cards.map(c => ({...c, id: `fc-ai-${Date.now()}-${Math.random()}`}));
        const newProgress = { ...studentProgress, aiGeneratedFlashcards: [...(studentProgress.aiGeneratedFlashcards || []), ...cardsWithIds] };
        handleUpdateStudentProgress(newProgress);
    };

    const handleStartQuiz = useCallback((quiz: CustomQuiz) => {
        if (!studentProgress) return;

        let quizToStart = quiz;
        
        // If the quiz is being redone, reset its state
        if (quiz.isCompleted) {
            quizToStart = {
                ...quiz,
                isCompleted: false,
                attempts: [],
            };
    
            const updatedQuizzes = (studentProgress.customQuizzes || []).map(q =>
                q.id === quiz.id ? quizToStart : q
            );
            const newProgress = { ...studentProgress, customQuizzes: updatedQuizzes };
            
            handleUpdateStudentProgress(newProgress);
        }
        
        setActiveCustomQuiz(quizToStart);
        setQuizInstanceKey(Date.now());
        changeView('custom_quiz_player');
    }, [studentProgress, handleUpdateStudentProgress]);
    
    // Callback for SRS Flashcard review
    const onFlashcardReview = (flashcardId: string, performance: 'good' | 'bad') => {
        if (!studentProgress) return;
        const newProgress = JSON.parse(JSON.stringify(studentProgress));
        
        // BUG FIX: Initialize srsFlashcardData if it doesn't exist
        newProgress.srsFlashcardData = newProgress.srsFlashcardData || {};
        
        const srsData = newProgress.srsFlashcardData[flashcardId] || { stage: 0 };
        const newStage = performance === 'good' ? Math.min(srsData.stage + 1, SRS_INTERVALS.length - 1) : Math.max(0, srsData.stage - 1);
        const nextReview = getBrasiliaDate();
        nextReview.setUTCDate(nextReview.getUTCDate() + SRS_INTERVALS[newStage]);
        newProgress.srsFlashcardData[flashcardId] = { stage: newStage, nextReviewDate: getLocalDateISOString(nextReview) };
        handleUpdateStudentProgress(newProgress);
    };

    if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-900"><Spinner /></div>;
    if (!studentProgress) return <div className="min-h-screen flex items-center justify-center bg-gray-900">Erro ao carregar dados do aluno.</div>;

    return (
        <div className="p-4 md:p-8 max-w-screen-2xl mx-auto">
            <StudentHeader
                user={user} studentProgress={studentProgress} view={view} onSetView={changeView}
                selectedTopicName={selectedSubtopic?.name || selectedTopic?.name}
                selectedCourseName={selectedCourse?.name}
                onOpenProfile={() => setIsProfileModalOpen(true)} 
                onLogout={onLogout}
                onGoHome={handleGoHome}
            />
            <main>
                {view !== 'dashboard' && (
                    <button
                        onClick={handleBack}
                        className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-cyan-700 hover:bg-cyan-800 focus:outline-none mb-6"
                    >
                        <ArrowRightIcon className="h-4 w-4 mr-2 transform rotate-180" aria-hidden="true" /> Voltar
                    </button>
                )}
                <StudentViewRouter
                    view={view} isPreview={isPreview} currentUser={user} studentProgress={studentProgress} allSubjects={allSubjects} allStudents={allStudents} allStudentProgress={allStudentProgress}
                    enrolledCourses={enrolledCourses} studyPlan={studyPlan} messages={messages} teacherProfiles={teacherProfiles} selectedCourse={selectedCourse} selectedSubject={selectedSubject}
                    selectedTopic={selectedTopic} selectedSubtopic={selectedSubtopic} selectedReview={selectedReview} activeChallenge={activeChallenge} dailyChallengeResults={dailyChallengeResults}
                    isGeneratingReview={isGeneratingReview} isSplitView={isSplitView} isSidebarCollapsed={isSidebarCollapsed} quizInstanceKey={quizInstanceKey} activeCustomQuiz={activeCustomQuiz}
                    onAcknowledgeMessage={(id) => FirebaseService.acknowledgeMessage(id, user.id)}
                    onCourseSelect={(course) => { setSelectedCourse(course); changeView('course'); }}
                    onSubjectSelect={(subject) => { setSelectedSubject(subject); changeView('subject'); }}
                    onTopicSelect={(topic, parent) => handleTopicSelect(topic, parent)}
                    onStartDailyChallenge={handleStartDailyChallenge}
                    onNavigateToTopic={onNavigateToTopic}
                    onToggleTopicCompletion={handleToggleTopicCompletion}
                    onOpenNewMessageModal={() => setIsNewMessageModalOpen(true)}
                    onSavePlan={async (plan) => { if(studentProgress) await FirebaseService.saveStudyPlanForStudent({studentId: user.id, plan}); }}
                    onStartReview={onStartReview}
                    onGenerateSmartReview={onGenerateSmartReview}
                    onGenerateSrsReview={(questions) => { if(questions.length > 0) setSelectedReview({id: `srs-${Date.now()}`, name: "Revisão Diária (SRS)", type: 'srs', createdAt: Date.now(), questions, isCompleted: false}); changeView('review_quiz'); }}
                    onGenerateSmartFlashcards={onGenerateSmartFlashcards}
                    onFlashcardReview={onFlashcardReview}
                    onUpdateStudentProgress={handleUpdateStudentProgress}
                    saveQuizProgress={saveQuizProgress}
                    saveReviewProgress={saveReviewProgress}
                    handleTopicQuizComplete={handleTopicQuizComplete}
                    handleReviewQuizComplete={handleReviewQuizComplete}
                    handleDailyChallengeComplete={handleDailyChallengeComplete}
                    onAddBonusXp={addXp}
                    onPlayGame={onPlayGame}
                    onDeleteCustomGame={handleDeleteCustomGame}
                    onOpenCustomGameModal={() => {}}
                    onSelectTargetCargo={onSelectTargetCargo}
                    onNoteSave={handleNoteSave}
                    onToggleSplitView={() => setIsSplitView(p => !p)}
                    onSetIsSidebarCollapsed={setIsSidebarCollapsed}
                    onOpenChatModal={() => setIsChatModalOpen(true)}
                    setView={changeView}
                    setActiveChallenge={setActiveChallenge}
                    onSaveDailyChallengeAttempt={onSaveDailyChallengeAttempt}
                    handleGameComplete={handleGameComplete}
                    handleGameError={handleGameError}
                    onReportQuestion={onReportQuestion}
                    onCloseDailyChallengeResults={() => { setDailyChallengeResults(null); setView('dashboard'); }}
                    onOpenCreator={handleOpenCustomQuizCreator}
                    onStartQuiz={handleStartQuiz}
                    onDeleteQuiz={handleDeleteCustomQuiz}
                    saveCustomQuizAttempt={saveCustomQuizAttempt}
                    handleCustomQuizComplete={handleCustomQuizComplete}
                />
            </main>
            <EditProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} user={user} onSave={onUpdateUser} />
            {levelUpInfo && <LevelUpModal isOpen={!!levelUpInfo} onClose={() => setLevelUpInfo(null)} newLevel={levelUpInfo.level} levelTitle={levelUpInfo.title} />}
            {awardedBadges.length > 0 && <BadgeAwardModal isOpen={true} onClose={() => setAwardedBadges(prev => prev.slice(1))} badges={awardedBadges} />}
            <XpToastDisplay toasts={xpToasts} />
            <StudentGamePlayerModal isOpen={!!playingGame} onClose={() => setPlayingGame(null)} game={playingGame?.game || null} onGameComplete={handleGameComplete} onGameError={handleGameError} />
            {isChatModalOpen && selectedTopic && selectedSubject && <Modal isOpen={isChatModalOpen} onClose={() => setIsChatModalOpen(false)} title="Assistente IA" size="2xl"><div className="h-[70vh]"><AiAssistant subject={selectedSubject} topic={selectedSubtopic || selectedTopic} /></div></Modal>}
            <NewMessageModal isOpen={isNewMessageModalOpen} onClose={() => setIsNewMessageModalOpen(false)} teachers={teacherProfiles} onSendMessage={async (teacherId, text) => { await FirebaseService.addMessage({ senderId: user.id, teacherId, studentId: user.id, message: text }); }}/>
            {activeThread && <MessageThreadModal isOpen={!!activeThread} onClose={() => setActiveThread(null)} thread={activeThread} currentUser={user} participants={{...teacherProfiles.reduce((acc, t) => ({...acc, [t.id]: t}), {}), [user.id]: user}} onSendReply={FirebaseService.addReplyToMessage} onDelete={(id) => FirebaseService.deleteMessageForUser(id, user.id)} />}
            <StudentCustomQuizCreatorModal
                isOpen={isCustomQuizCreatorOpen}
                onClose={handleCloseCustomQuizCreator}
                onSave={handleCustomQuizSave}
            />
            {quizInfoForDeleteModal && (
                <Modal
                    isOpen={!!quizToDeleteId}
                    onClose={() => setQuizToDeleteId(null)}
                    title="Confirmar Exclusão"
                >
                    <div className="space-y-4">
                        <p>Tem certeza que deseja apagar o quiz "{quizInfoForDeleteModal.name}"? Esta ação não pode ser desfeita.</p>
                        <div className="flex justify-end gap-4 pt-4">
                            <Button onClick={() => setQuizToDeleteId(null)} className="bg-gray-600 hover:bg-gray-500">
                                Cancelar
                            </Button>
                            <Button onClick={confirmDeleteQuiz} className="bg-red-600 hover:bg-red-700">
                                Apagar
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
            {gameInfoForDeleteModal && (
                <Modal
                    isOpen={!!gameToDeleteId}
                    onClose={() => setGameToDeleteId(null)}
                    title="Confirmar Exclusão"
                >
                    <div className="space-y-4">
                        <p>Tem certeza que deseja apagar o jogo "{gameInfoForDeleteModal.name}"? Esta ação não pode ser desfeita.</p>
                        <div className="flex justify-end gap-4 pt-4">
                            <Button onClick={() => setGameToDeleteId(null)} className="bg-gray-600 hover:bg-gray-500">
                                Cancelar
                            </Button>
                            <Button onClick={confirmDeleteGame} className="bg-red-600 hover:bg-red-700">
                                Apagar
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};
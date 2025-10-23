import React, { useState, useEffect, useCallback } from 'react';
// FIX: Added 'Flashcard' to the type import to resolve type errors.
import { User, Subject, StudentProgress, Course, Topic, SubTopic, ReviewSession, MiniGame, Question, QuestionAttempt, CustomQuiz, DailyChallenge, Simulado, Badge, Flashcard } from '../../types';
import * as FirebaseService from '../../services/firebaseService';
import * as Gamification from '../../gamification';
import { useStudentData } from '../../hooks/useStudentData';
import { Spinner } from '../ui';
import { StudentHeader } from './StudentHeader';
import { StudentViewRouter } from './StudentViewRouter';
import { EditProfileModal } from './EditProfileModal';
import { StudentGamePlayerModal } from './StudentGamePlayerModal';
import { LevelUpModal } from './LevelUpModal';
import { BadgeAwardModal } from './BadgeAwardModal';
import { XpToastDisplay } from './XpToastDisplay';
import { NewMessageModal } from './NewMessageModal';
import { TopicChat } from './TopicChat';
import { StudentCustomQuizCreatorModal } from './StudentCustomQuizCreatorModal';
import { getLocalDateISOString, getBrasiliaDate } from '../../utils';
import * as GeminiService from '../../services/geminiService';
import { ArrowRightIcon } from '../Icons';

type ViewType = 'dashboard' | 'course' | 'subject' | 'topic' | 'schedule' | 'performance' | 'reviews' | 'review_quiz' | 'games' | 'daily_challenge_quiz' | 'daily_challenge_results' | 'practice_area' | 'custom_quiz_player' | 'simulado_player';

type XpToast = {
    id: number;
    amount: number;
    message?: string;
};

interface StudentDashboardProps {
    user: User;
    onLogout: () => void;
    onUpdateUser: (user: User) => void;
    isPreview?: boolean;
    onToggleStudentView?: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ user, onLogout, onUpdateUser, isPreview }) => {
    const [view, setView] = useState<ViewType>('dashboard');
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
    const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
    const [selectedSubtopic, setSelectedSubtopic] = useState<SubTopic | null>(null);
    const [selectedReview, setSelectedReview] = useState<ReviewSession | null>(null);
    const [activeCustomQuiz, setActiveCustomQuiz] = useState<CustomQuiz | null>(null);
    const [activeSimulado, setActiveSimulado] = useState<Simulado | null>(null);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isGamePlayerOpen, setIsGamePlayerOpen] = useState(false);
    const [playingGame, setPlayingGame] = useState<{ game: MiniGame, topicId: string } | null>(null);
    const [isLevelUpModalOpen, setIsLevelUpModalOpen] = useState(false);
    const [newLevelInfo, setNewLevelInfo] = useState({ level: 0, title: '' });
    const [awardedBadges, setAwardedBadges] = useState<Badge[]>([]);
    const [xpToasts, setXpToasts] = useState<XpToast[]>([]);
    const [isNewMessageModalOpen, setIsNewMessageModalOpen] = useState(false);
    const [isChatModalOpen, setIsChatModalOpen] = useState(false);
    const [isGeneratingReview, setIsGeneratingReview] = useState(false);
    const [isSplitView, setIsSplitView] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [quizInstanceKey, setQuizInstanceKey] = useState(Date.now());
    const [activeChallenge, setActiveChallenge] = useState<{ type: 'review' | 'glossary' | 'portuguese', questions: Question[], sessionAttempts: QuestionAttempt[], isCatchUp?: boolean } | null>(null);
    const [dailyChallengeResults, setDailyChallengeResults] = useState<{ questions: Question[], sessionAttempts: QuestionAttempt[] } | null>(null);
    const [isCustomQuizCreatorOpen, setIsCustomQuizCreatorOpen] = useState(false);
    const [isGeneratingAllChallenges, setIsGeneratingAllChallenges] = useState(false);

    const {
        isLoading,
        allSubjects,
        allStudents,
        allStudentProgress,
        enrolledCourses,
        studentProgress,
        setStudentProgress,
        studyPlan,
        messages,
        teacherProfiles
    } = useStudentData(user, isPreview);

    const handleBack = useCallback((): boolean => {
        if (view === 'topic') {
            setView('subject');
            setSelectedTopic(null);
            setSelectedSubtopic(null);
            return true;
        }
        if (view === 'subject') {
            setView('course');
            setSelectedSubject(null);
            return true;
        }
        if (view === 'course') {
            setView('dashboard');
            setSelectedCourse(null);
            return true;
        }
        if (['schedule', 'performance', 'reviews', 'games', 'practice_area'].includes(view)) {
            setView('dashboard');
            return true;
        }
        if (view === 'review_quiz' || view === 'daily_challenge_quiz') {
            setView(view === 'review_quiz' ? 'reviews' : 'dashboard');
            setSelectedReview(null);
            setActiveChallenge(null);
            return true;
        }
        if (view === 'custom_quiz_player' || view === 'simulado_player') {
            setView('practice_area');
            setActiveCustomQuiz(null);
            setActiveSimulado(null);
            return true;
        }
        return false;
    }, [view]);
    
    useEffect(() => {
        window.customGoBack = handleBack;
        return () => {
            if(window.customGoBack === handleBack) {
                window.customGoBack = undefined;
            }
        };
    }, [handleBack]);


    const handleUpdateStudentProgress = useCallback(async (newProgress: StudentProgress, fromState?: StudentProgress | null) => {
        if (isPreview) return;
        setStudentProgress(newProgress);
        await FirebaseService.saveStudentProgress(newProgress);

        const oldLevel = fromState ? Gamification.calculateLevel(fromState.xp) : 0;
        const newLevel = Gamification.calculateLevel(newProgress.xp);
        if (newLevel > oldLevel) {
            setNewLevelInfo({ level: newLevel, title: Gamification.getLevelTitle(newLevel) });
            setIsLevelUpModalOpen(true);
        }
    }, [isPreview, setStudentProgress]);

    const addXp = useCallback((amount: number, message?: string) => {
        if (isPreview || amount === 0) return;
        setXpToasts(prev => [...prev, { id: Date.now(), amount, message }]);
        setTimeout(() => setXpToasts(prev => prev.slice(1)), 3000);
        
        setStudentProgress(prev => {
            if (!prev) return null;
            const newProgress = { ...prev, xp: (prev.xp || 0) + amount };
            handleUpdateStudentProgress(newProgress, prev);
            return newProgress;
        });
    }, [isPreview, handleUpdateStudentProgress, setStudentProgress]);

    useEffect(() => {
        if (!studentProgress) return;
        const awarded = Gamification.checkAndAwardBadges(studentProgress, allSubjects, allStudentProgress);
        if (awarded.length > 0) {
            setAwardedBadges(prev => [...prev, ...awarded]);
            const newProgress = {
                ...studentProgress,
                earnedBadgeIds: [...new Set([...studentProgress.earnedBadgeIds, ...awarded.map(b => b.id)])]
            };
            handleUpdateStudentProgress(newProgress, studentProgress);
        }
    }, [studentProgress, allSubjects, allStudentProgress, handleUpdateStudentProgress]);
    
    const handleCourseSelect = (course: Course) => { setSelectedCourse(course); setView('course'); };
    const handleSubjectSelect = (subject: Subject) => { setSelectedSubject(subject); setView('subject'); };
    const handleTopicSelect = (topic: Topic | SubTopic, parentTopic?: Topic) => {
        if ('subtopics' in topic) { setSelectedTopic(topic); setSelectedSubtopic(null); } 
        else { setSelectedTopic(parentTopic!); setSelectedSubtopic(topic); }
        setView('topic');
    };

    const handleNavigateToTopic = (topicId: string) => {
        for (const subject of allSubjects) {
            for (const topic of subject.topics) {
                if (topic.id === topicId) { setSelectedSubject(subject); setSelectedTopic(topic); setSelectedSubtopic(null); setView('topic'); return; }
                const subtopic = topic.subtopics.find(st => st.id === topicId);
                if (subtopic) { setSelectedSubject(subject); setSelectedTopic(topic); setSelectedSubtopic(subtopic); setView('topic'); return; }
            }
        }
    };
    
    const onStartReview = (session: ReviewSession) => { setSelectedReview(session); setQuizInstanceKey(Date.now()); setView('review_quiz'); };

    const saveDailyChallengeAttempt = (challengeType: 'review' | 'glossary' | 'portuguese', attempt: QuestionAttempt) => {
        if (isPreview) return;

        setStudentProgress(prevProgress => {
            if (!prevProgress) return null;

            const newProgress = JSON.parse(JSON.stringify(prevProgress));
            const challengeKey = `${challengeType}Challenge` as const;
            const challenge = newProgress[challengeKey];
            if (!challenge) return prevProgress;

            if (!challenge.sessionAttempts) {
                challenge.sessionAttempts = [];
            }
            const existingAttemptIndex = challenge.sessionAttempts.findIndex((a: QuestionAttempt) => a.questionId === attempt.questionId);
            if (existingAttemptIndex > -1) {
                challenge.sessionAttempts[existingAttemptIndex] = attempt;
            } else {
                challenge.sessionAttempts.push(attempt);
            }
            
            setActiveChallenge(prev => prev ? { ...prev, sessionAttempts: challenge.sessionAttempts || [] } : null);
            
            FirebaseService.saveStudentProgress(newProgress); // Fire-and-forget save
            return newProgress;
        });
    };

    const handleDailyChallengeComplete = (finalAttempts: QuestionAttempt[], isCatchUp: boolean = false) => {
        if (!activeChallenge || isPreview) return;
        const challengeType = activeChallenge.type;

        const xpToastsToAdd: XpToast[] = [];
        let totalXpGained = 0;

        const addChallengeXp = (amount: number, message?: string) => {
            totalXpGained += amount;
            if (message) {
                xpToastsToAdd.push({ id: Date.now() + Math.random(), amount, message });
            }
        };

        setStudentProgress(prevProgress => {
            if (!prevProgress) return null;

            const newProgress = JSON.parse(JSON.stringify(prevProgress));
            const challengeKey = `${challengeType}Challenge` as const;
            const challenge = newProgress[challengeKey];
            if (!challenge) return prevProgress;

            challenge.isCompleted = true;
            challenge.sessionAttempts = finalAttempts;
            challenge.attemptsMade = (challenge.attemptsMade || 0) + 1;
            
            const correctCount = finalAttempts.filter(a => a.isCorrect).length;
            const score = challenge.items.length > 0 ? correctCount / challenge.items.length : 0;
            
            const todayISO = getLocalDateISOString(getBrasiliaDate());

            if (score >= 0.6) {
                if (isCatchUp) {
                    addChallengeXp(Gamification.XP_CONFIG.CATCH_UP_CHALLENGE_COMPLETE, "Desafio Recuperado!");
                } else {
                    addChallengeXp(Gamification.XP_CONFIG.DAILY_CHALLENGE_COMPLETE, "Desafio Diário Concluído!");
                    const yesterday = getBrasiliaDate();
                    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
                    const yesterdayISO = getLocalDateISOString(yesterday);
                    
                    const streak = newProgress.dailyChallengeStreak || { current: 0, longest: 0, lastCompletedDate: '' };
                    if (streak.lastCompletedDate === yesterdayISO) streak.current += 1;
                    else if (streak.lastCompletedDate !== todayISO) streak.current = 1;
                    streak.lastCompletedDate = todayISO;
                    streak.longest = Math.max(streak.current, streak.longest);
                    newProgress.dailyChallengeStreak = streak;

                    const streakBonus = Gamification.XP_CONFIG.STREAK_BONUS as Record<number, number>;
                    if (streakBonus[streak.current]) {
                        addChallengeXp(streakBonus[streak.current], `Ofensiva de ${streak.current} dias! 🔥`);
                    }
                }
                
                if (!newProgress.dailyChallengeCompletions) newProgress.dailyChallengeCompletions = {};
                if (!newProgress.dailyChallengeCompletions[todayISO]) newProgress.dailyChallengeCompletions[todayISO] = {};
                newProgress.dailyChallengeCompletions[todayISO][challengeType] = true;
            }

            newProgress.xp = (newProgress.xp || 0) + totalXpGained;
            
            FirebaseService.saveStudentProgress(newProgress);
            
            // Side effects after state update
            setTimeout(() => {
                setXpToasts(prev => [...prev, ...xpToastsToAdd]);
                setTimeout(() => setXpToasts(prev => prev.filter(t => !xpToastsToAdd.some(tt => tt.id === t.id))), 3000);

                const oldLevel = Gamification.calculateLevel(prevProgress.xp);
                const newLevel = Gamification.calculateLevel(newProgress.xp);
                if (newLevel > oldLevel) {
                    setNewLevelInfo({ level: newLevel, title: Gamification.getLevelTitle(newLevel) });
                    setIsLevelUpModalOpen(true);
                }
            }, 100);

            return newProgress;
        });

        setDailyChallengeResults({ questions: activeChallenge.questions, sessionAttempts: finalAttempts });
    };

    const handleNavigateToDailyChallengeResults = () => {
        if (!activeChallenge) return;
        setDailyChallengeResults({ 
            questions: activeChallenge.questions, 
            sessionAttempts: activeChallenge.sessionAttempts 
        });
        setView('daily_challenge_results');
        setActiveChallenge(null);
    };
    
    const startDailyChallenge = (challenge: DailyChallenge<any>, type: 'review' | 'glossary' | 'portuguese', isCatchUp = false) => {
        if (challenge && challenge.items.length > 0) {
            setActiveChallenge({ type, questions: challenge.items, sessionAttempts: challenge.sessionAttempts || [], isCatchUp });
            setQuizInstanceKey(Date.now());
            setView('daily_challenge_quiz');
        }
    };

    const handleGenerateAllDailyChallenges = async () => {
        if (isPreview || !studentProgress) return;
    
        setIsGeneratingAllChallenges(true);
        try {
            const apiKey = import.meta.env.VITE_DAILY_CHALLENGE_API_KEY;
            const types: Array<'review' | 'glossary' | 'portuguese'> = ['review', 'glossary', 'portuguese'];
            
            const challengePromises = types.map(type => 
                fetch(`/.netlify/functions/generateStudentChallenge-on-demand?apiKey=${apiKey}&studentId=${user.id}&challengeType=${type}`)
                    .then(async res => {
                        if (!res.ok) {
                             const errorBody = await res.text();
                             throw new Error(`Falha ao gerar desafio de ${type}: ${res.status} ${errorBody}`);
                        }
                        return res.json();
                    })
            );
            
            const [reviewItems, glossaryItems, portugueseItems] = await Promise.all(challengePromises);
            
            const todayISO = getLocalDateISOString(getBrasiliaDate());
    
            const newReviewChallenge: DailyChallenge<Question> = { date: todayISO, items: reviewItems, isCompleted: false, attemptsMade: 0, sessionAttempts: [] };
            const newGlossaryChallenge: DailyChallenge<Question> = { date: todayISO, items: glossaryItems, isCompleted: false, attemptsMade: 0, sessionAttempts: [] };
            const newPortugueseChallenge: DailyChallenge<Question> = { date: todayISO, items: portugueseItems, isCompleted: false, attemptsMade: 0, sessionAttempts: [] };
            
            const newProgress = {
                ...studentProgress,
                reviewChallenge: newReviewChallenge,
                glossaryChallenge: newGlossaryChallenge,
                portugueseChallenge: newPortugueseChallenge,
            };
            
            handleUpdateStudentProgress(newProgress, studentProgress);
    
        } catch (error) {
            console.error("Erro ao gerar todos os desafios diários:", error);
            alert(`Não foi possível gerar todos os desafios. Por favor, tente novamente. Detalhes: ${error}`);
        } finally {
            setIsGeneratingAllChallenges(false);
        }
    };

    if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-900"><Spinner /></div>;
    if (!studentProgress) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Erro ao carregar dados do aluno.</div>;

    return (
        <div className="bg-gray-900 text-white min-h-screen p-4 sm:p-6 lg:p-8">
            <StudentHeader user={user} studentProgress={studentProgress} view={view} selectedTopicName={selectedSubtopic?.name || selectedTopic?.name} selectedCourseName={selectedCourse?.name} onSetView={setView} onOpenProfile={() => setIsProfileModalOpen(true)} onLogout={onLogout} onGoHome={() => setView('dashboard')} />
            <main>
                {view !== 'dashboard' && !isPreview && (
                    <button onClick={() => handleBack()} className="text-cyan-400 hover:text-cyan-300 mb-6 flex items-center">
                        <ArrowRightIcon className="h-4 w-4 mr-2 transform rotate-180" aria-hidden="true" /> Voltar
                    </button>
                )}
                <StudentViewRouter
                    view={view} isPreview={isPreview} currentUser={user} studentProgress={studentProgress} allSubjects={allSubjects} allStudents={allStudents} allStudentProgress={allStudentProgress} enrolledCourses={enrolledCourses} studyPlan={studyPlan} messages={messages} teacherProfiles={teacherProfiles} selectedCourse={selectedCourse} selectedSubject={selectedSubject} selectedTopic={selectedTopic} selectedSubtopic={selectedSubtopic} selectedReview={selectedReview} activeChallenge={activeChallenge} dailyChallengeResults={dailyChallengeResults} isGeneratingReview={isGeneratingReview} isSplitView={isSplitView} isSidebarCollapsed={isSidebarCollapsed} quizInstanceKey={quizInstanceKey} activeCustomQuiz={activeCustomQuiz} activeSimulado={activeSimulado} isGeneratingAllChallenges={isGeneratingAllChallenges}
                    onAcknowledgeMessage={(messageId) => FirebaseService.acknowledgeMessage(messageId, user.id)}
                    onCourseSelect={handleCourseSelect}
                    onSubjectSelect={handleSubjectSelect}
                    onTopicSelect={handleTopicSelect}
                    onStartDailyChallenge={startDailyChallenge}
                    onGenerateAllChallenges={handleGenerateAllDailyChallenges}
                    onNavigateToTopic={handleNavigateToTopic}
                    onToggleTopicCompletion={(subjectId, topicId, isCompleted) => {
                        const newProgress = { ...studentProgress };
                        if (!newProgress.progressByTopic[subjectId]) newProgress.progressByTopic[subjectId] = {};
                        if (!newProgress.progressByTopic[subjectId][topicId]) newProgress.progressByTopic[subjectId][topicId] = { completed: false, score: 0, lastAttempt: [] };
                        newProgress.progressByTopic[subjectId][topicId].completed = isCompleted;
                        handleUpdateStudentProgress(newProgress, studentProgress);
                    }}
                    onOpenNewMessageModal={() => setIsNewMessageModalOpen(true)}
                    onSavePlan={async (plan) => { await FirebaseService.saveStudyPlanForStudent({ studentId: user.id, plan }); }}
                    onStartReview={onStartReview}
                    onGenerateSmartReview={async () => {
                        setIsGeneratingReview(true);
                        try {
                            const questions = await GeminiService.generateSmartReview(studentProgress, allSubjects);
                            if (questions.length > 0) {
                                onStartReview({ id: `rev-ai-${Date.now()}`, name: "Revisão Inteligente da IA", type: 'ai', createdAt: Date.now(), questions, isCompleted: false });
                            } else { alert("Não há dados suficientes para gerar uma revisão inteligente."); }
                        } catch (e) { console.error(e); } finally { setIsGeneratingReview(false); }
                    }}
                    onGenerateSrsReview={(questions) => {
                        if (questions.length > 0) {
                            onStartReview({ id: `rev-srs-${Date.now()}`, name: "Revisão Diária (SRS)", type: 'srs', createdAt: Date.now(), questions, isCompleted: false });
                        } else { alert("Nenhuma questão agendada para revisão hoje."); }
                    }}
                    onGenerateSmartFlashcards={async (questions) => {
                        const flashcards = await GeminiService.generateFlashcardsFromIncorrectAnswers(questions);
                        // FIX: Removed redundant type annotation for 'f' to allow TypeScript to correctly infer its type from the 'flashcards' array.
                        const newProgress = { ...studentProgress, aiGeneratedFlashcards: [...(studentProgress.aiGeneratedFlashcards || []), ...flashcards.map((f) => ({...f, id: `fc-ai-${Date.now()}-${Math.random()}`}))] };
                        handleUpdateStudentProgress(newProgress, studentProgress);
                    }}
                    onFlashcardReview={(flashcardId, performance) => {
                        const newProgress = Gamification.updateSrsFlashcard(studentProgress, flashcardId, performance);
                        handleUpdateStudentProgress(newProgress, studentProgress);
                    }}
                    onUpdateStudentProgress={handleUpdateStudentProgress}
                    saveQuizProgress={(subjectId, topicId, attempt) => {
                         const newProgress = { ...studentProgress };
                         if (!newProgress.progressByTopic[subjectId]) newProgress.progressByTopic[subjectId] = {};
                         if (!newProgress.progressByTopic[subjectId][topicId]) newProgress.progressByTopic[subjectId][topicId] = { completed: false, score: 0, lastAttempt: [] };
                         newProgress.progressByTopic[subjectId][topicId].lastAttempt.push(attempt);
                         handleUpdateStudentProgress(newProgress, studentProgress);
                    }}
                    saveReviewProgress={(reviewId, attempt) => {
                        const newProgress = { ...studentProgress };
                        const reviewIndex = newProgress.reviewSessions.findIndex(r => r.id === reviewId);
                        if (reviewIndex > -1) {
                            if (!newProgress.reviewSessions[reviewIndex].attempts) newProgress.reviewSessions[reviewIndex].attempts = [];
                            newProgress.reviewSessions[reviewIndex].attempts!.push(attempt);
                            handleUpdateStudentProgress(newProgress, studentProgress);
                        }
                    }}
                    handleTopicQuizComplete={(subjectId, topicId, attempts) => {
                        const newProgress = Gamification.processQuizCompletion(studentProgress, subjectId, topicId, attempts, addXp);
                        handleUpdateStudentProgress(newProgress, studentProgress);
                    }}
                    handleReviewQuizComplete={(reviewId, attempts) => {
                        const newProgress = Gamification.processReviewCompletion(studentProgress, reviewId, attempts, addXp);
                        handleUpdateStudentProgress(newProgress, studentProgress);
                    }}
                    handleDailyChallengeComplete={handleDailyChallengeComplete}
                    onAddBonusXp={addXp}
                    onPlayGame={(game, topicId) => { setPlayingGame({ game, topicId }); setIsGamePlayerOpen(true); }}
                    onDeleteCustomGame={(gameId) => {
                        const newProgress = { ...studentProgress, customGames: studentProgress.customGames.filter(g => g.id !== gameId) };
                        handleUpdateStudentProgress(newProgress, studentProgress);
                    }}
                    onOpenCustomGameModal={() => {}}
                    onSelectTargetCargo={(courseId, cargoName) => {
                        const newProgress = { ...studentProgress, targetCargoByCourse: { ...(studentProgress.targetCargoByCourse || {}), [courseId]: cargoName } };
                        handleUpdateStudentProgress(newProgress, studentProgress);
                    }}
                    onNoteSave={(contentId, content) => {
                        const newProgress = { ...studentProgress, notesByTopic: { ...studentProgress.notesByTopic, [contentId]: content } };
                        handleUpdateStudentProgress(newProgress, studentProgress);
                    }}
                    onToggleSplitView={() => setIsSplitView(!isSplitView)}
                    onSetIsSidebarCollapsed={setIsSidebarCollapsed}
                    onOpenChatModal={() => setIsChatModalOpen(true)}
                    setView={setView}
                    setActiveChallenge={setActiveChallenge}
                    onSaveDailyChallengeAttempt={saveDailyChallengeAttempt}
                    handleGameComplete={(gameId) => {
                        const newProgress = Gamification.processGameCompletion(studentProgress, playingGame!.topicId, gameId, addXp);
                        handleUpdateStudentProgress(newProgress, studentProgress);
                    }}
                    handleGameError={() => addXp(-Gamification.XP_CONFIG.GAME_ERROR_PENALTY)}
                    onReportQuestion={(subjectId, topicId, questionId, isTec, reason) => {
                        FirebaseService.updateSubjectQuestion(subjectId, topicId, questionId, isTec, { reason, studentId: user.id });
                        FirebaseService.createReportNotification(allSubjects.find(s=>s.id === subjectId)!.teacherId, user, allSubjects.find(s => s.id === subjectId)!.name, selectedSubtopic?.name || selectedTopic!.name, (isTec ? (selectedSubtopic || selectedTopic)?.tecQuestions : (selectedSubtopic || selectedTopic)?.questions)?.find(q=>q.id === questionId)?.statement || 'N/A', reason);
                    }}
                    onCloseDailyChallengeResults={() => { setDailyChallengeResults(null); setView('dashboard'); }}
                    onNavigateToDailyChallengeResults={handleNavigateToDailyChallengeResults}
                    onOpenCreator={() => setIsCustomQuizCreatorOpen(true)}
                    onStartQuiz={(quiz) => { setActiveCustomQuiz(quiz); setQuizInstanceKey(Date.now()); setView('custom_quiz_player'); }}
                    onDeleteQuiz={(quizId) => {
                         if (window.confirm("Tem certeza que deseja apagar este quiz?")) {
                            const newProgress = { ...studentProgress, customQuizzes: (studentProgress.customQuizzes || []).filter(q => q.id !== quizId) };
                            handleUpdateStudentProgress(newProgress, studentProgress);
                        }
                    }}
                    saveCustomQuizAttempt={(attempt) => {
                        setActiveCustomQuiz(prev => {
                            if (!prev) return null;
                            const newAttempts = [...(prev.attempts || []), attempt];
                            return { ...prev, attempts: newAttempts };
                        });
                    }}
                    handleCustomQuizComplete={(finalAttempts) => {
                        const newProgress = Gamification.processCustomQuizCompletion(studentProgress, activeCustomQuiz!.id, finalAttempts, addXp);
                        handleUpdateStudentProgress(newProgress, studentProgress);
                        setView('practice_area');
                        setActiveCustomQuiz(null);
                    }}
                    onSaveSimulado={(simulado) => {
                        const newProgress = { ...studentProgress, simulados: [...(studentProgress.simulados || []), simulado] };
                        handleUpdateStudentProgress(newProgress, studentProgress);
                    }}
                    onStartSimulado={(simulado) => { setActiveSimulado(simulado); setQuizInstanceKey(Date.now()); setView('simulado_player'); }}
                    onDeleteSimulado={(simuladoId) => {
                        if (window.confirm("Tem certeza que deseja apagar este simulado?")) {
                            const newProgress = { ...studentProgress, simulados: (studentProgress.simulados || []).filter(s => s.id !== simuladoId) };
                            handleUpdateStudentProgress(newProgress, studentProgress);
                        }
                    }}
                     saveSimuladoAttempt={(attempt) => {
                        setActiveSimulado(prev => {
                            if (!prev) return null;
                            const newAttempts = [...(prev.attempts || []), attempt];
                            return { ...prev, attempts: newAttempts };
                        });
                    }}
                    handleSimuladoComplete={(finalAttempts) => {
                        const newProgress = Gamification.processSimuladoCompletion(studentProgress, activeSimulado!.id, finalAttempts, addXp);
                        handleUpdateStudentProgress(newProgress, studentProgress);
                        setView('practice_area');
                        setActiveSimulado(null);
                    }}
                />
            </main>

            <XpToastDisplay toasts={xpToasts} />
            <EditProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} user={user} onSave={onUpdateUser} />
            <StudentGamePlayerModal isOpen={isGamePlayerOpen} onClose={() => setIsGamePlayerOpen(false)} game={playingGame?.game || null} onGameComplete={(gameId) => {
                const newProgress = Gamification.processGameCompletion(studentProgress, playingGame!.topicId, gameId, addXp);
                handleUpdateStudentProgress(newProgress, studentProgress);
            }} onGameError={() => addXp(-Gamification.XP_CONFIG.GAME_ERROR_PENALTY)} />
            <LevelUpModal isOpen={isLevelUpModalOpen} onClose={() => setIsLevelUpModalOpen(false)} newLevel={newLevelInfo.level} levelTitle={newLevelInfo.title} />
            <BadgeAwardModal isOpen={awardedBadges.length > 0} onClose={() => setAwardedBadges(prev => prev.slice(1))} badges={awardedBadges} />
             <NewMessageModal isOpen={isNewMessageModalOpen} onClose={() => setIsNewMessageModalOpen(false)} teachers={teacherProfiles} onSendMessage={async (teacherId, message) => {
                await FirebaseService.addMessage({ senderId: user.id, teacherId, studentId: user.id, message });
            }} />
            {isChatModalOpen && selectedTopic && (
                 <div className="fixed bottom-4 right-4 h-[60vh] w-[400px] z-50 bg-gray-800 rounded-lg shadow-2xl border border-gray-700 flex flex-col">
                    <div className="flex justify-between items-center p-2 border-b border-gray-700 bg-gray-900/50 rounded-t-lg"><h3 className="font-bold text-sm">Assistente IA</h3><button onClick={() => setIsChatModalOpen(false)} className="text-gray-400 hover:text-white">&times;</button></div>
                    <TopicChat subject={selectedSubject!} topic={selectedSubtopic || selectedTopic} isVisible={isChatModalOpen} />
                </div>
            )}
            <StudentCustomQuizCreatorModal isOpen={isCustomQuizCreatorOpen} onClose={() => setIsCustomQuizCreatorOpen(false)} onSave={(quiz) => {
                const newProgress = { ...studentProgress, customQuizzes: [...(studentProgress.customQuizzes || []), quiz] };
                handleUpdateStudentProgress(newProgress, studentProgress);
            }}/>
        </div>
    );
};

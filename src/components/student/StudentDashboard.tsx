
import React, { useState, useEffect, useCallback, useRef } from 'react';
// FIX: Added 'Flashcard' to the type import to resolve type errors.
import { User, Subject, StudentProgress, Course, Topic, SubTopic, ReviewSession, MiniGame, Question, QuestionAttempt, CustomQuiz, DailyChallenge, Simulado, Badge, TeacherMessage } from '../../types';
import * as FirebaseService from '../../services/firebaseService';
import * as Gamification from '../../gamification';
import { useStudentData } from '../../hooks/useStudentData';
import { Spinner, ConfirmModal } from '../ui';
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
import { NotificationToast, NotificationItem } from './NotificationToast';

window.androidGoBack = () => {
  if (window.customGoBack && typeof window.customGoBack === 'function') {
    return window.customGoBack();
  }
  return false;
};

// FIX: Added 'settings' to ViewType to ensure compatibility with StudentHeader's expectations and resolve type mismatch errors.
type ViewType = 'dashboard' | 'course' | 'subject' | 'topic' | 'schedule' | 'performance' | 'reviews' | 'settings' | 'review_quiz' | 'games' | 'daily_challenge_quiz' | 'daily_challenge_results' | 'practice_area' | 'custom_quiz_player' | 'simulado_player';

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
    const [challengeGenerationStatus, setChallengeGenerationStatus] = useState<string>('');
    const [confirmDeleteMessageId, setConfirmDeleteMessageId] = useState<string | null>(null);
    
    const [activeNotifications, setActiveNotifications] = useState<NotificationItem[]>([]);
    const notifiedScheduleItems = useRef<Set<string>>(new Set());
    const lastMessageIds = useRef<Set<string>>(new Set());
    const scheduleAudio = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));
    const messageAudio = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3'));

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

    const addNotification = useCallback((notif: Omit<NotificationItem, 'id'>) => {
        const id = `notif-${Date.now()}`;
        setActiveNotifications(prev => [...prev, { ...notif, id }]);
        setTimeout(() => {
            setActiveNotifications(prev => prev.filter(n => n.id !== id));
        }, 8000);
    }, []);

    const removeNotification = (id: string) => {
        setActiveNotifications(prev => prev.filter(n => n.id !== id));
    };

    // Cronograma: Lógica unificada com o relógio de Brasília imune ao fuso local
    useEffect(() => {
        if (isPreview || !studyPlan || !studyPlan.activePlanId) return;

        const checkSchedule = () => {
            const nowBr = getBrasiliaDate();
            const todayIndex = nowBr.getDay();
            const currentTotalMinutes = nowBr.getHours() * 60 + nowBr.getMinutes();
            
            const activePlan = studyPlan.plans.find(p => p.id === studyPlan.activePlanId);
            if (!activePlan) return;

            const todayItems = activePlan.weeklyRoutine[todayIndex] || {};
            const sortedTimes = Object.keys(todayItems).sort();

            let activeTimeSlot: string | null = null;
            for (let i = 0; i < sortedTimes.length; i++) {
                const [h, m] = sortedTimes[i].split(':').map(Number);
                const slotMinutes = h * 60 + m;
                const nextTime = sortedTimes[i + 1];
                const nextMinutes = nextTime ? (parseInt(nextTime.split(':')[0]) * 60 + parseInt(nextTime.split(':')[1])) : 1440;

                // O slot só é ativo se os minutos atuais baterem exatamente com o intervalo programado
                if (currentTotalMinutes >= slotMinutes && currentTotalMinutes < nextMinutes) {
                    activeTimeSlot = sortedTimes[i];
                    break;
                }
            }

            if (activeTimeSlot) {
                const todayKey = `${getLocalDateISOString(nowBr)}-${activeTimeSlot}`;
                const taskContent = todayItems[activeTimeSlot];

                if (taskContent && !notifiedScheduleItems.current.has(todayKey)) {
                    notifiedScheduleItems.current.add(todayKey);
                    
                    let taskName = taskContent;
                    for (const sub of allSubjects) {
                        const topic = sub.topics.find(t => t.id === taskContent);
                        if (topic) { taskName = topic.name; break; }
                        for (const t of sub.topics) {
                            const st = t.subtopics.find(s => s.id === taskContent);
                            if (st) { taskName = st.name; break; }
                        }
                    }

                    addNotification({
                        type: 'schedule',
                        title: 'MISSÃO ATIVADA',
                        message: `Iniciando agora: "${taskName}". Mantenha o foco!`
                    });
                    scheduleAudio.current.play().catch(() => {});
                }
            }
        };

        const interval = setInterval(checkSchedule, 15000);
        checkSchedule();
        return () => clearInterval(interval);
    }, [studyPlan, allSubjects, isPreview, addNotification]);

    useEffect(() => {
        if (isPreview || !messages.length) return;

        const currentIds = new Set(messages.map(m => m.id));
        if (lastMessageIds.current.size === 0) {
            lastMessageIds.current = currentIds;
            return;
        }

        const newMessages = messages.filter(m => !lastMessageIds.current.has(m.id));

        if (newMessages.length > 0) {
            newMessages.forEach(msg => {
                const isBroadcast = msg.studentId === null;
                const teacher = teacherProfiles.find(t => t.id === msg.teacherId);
                const teacherName = teacher?.name || 'Professor';

                addNotification({
                    type: isBroadcast ? 'announcement' : 'message',
                    title: isBroadcast ? 'COMUNICADO DO QG' : 'MENSAGEM DE COMANDO',
                    message: isBroadcast ? msg.message : `${teacherName} enviou orientações.`
                });
            });
            messageAudio.current.play().catch(() => {});
            lastMessageIds.current = currentIds;
        }
    }, [messages, teacherProfiles, isPreview, addNotification]);

    const handleBack = useCallback((): boolean => {
        if (view === 'topic') { setView('subject'); setSelectedTopic(null); setSelectedSubtopic(null); return true; }
        if (view === 'subject') { setView('course'); setSelectedSubject(null); return true; }
        if (view === 'course') { setView('dashboard'); setSelectedCourse(null); return true; }
        if (['schedule', 'performance', 'reviews', 'settings', 'review_quiz', 'games', 'practice_area'].includes(view)) { setView('dashboard'); return true; }
        if (view === 'review_quiz' || view === 'daily_challenge_quiz') { setView(view === 'review_quiz' ? 'reviews' : 'dashboard'); setSelectedReview(null); setActiveChallenge(null); return true; }
        if (view === 'custom_quiz_player' || view === 'simulado_player') { setView('practice_area'); setActiveCustomQuiz(null); setActiveSimulado(null); return true; }
        return false;
    }, [view]);
    
    useEffect(() => {
        window.customGoBack = handleBack;
        return () => { if(window.customGoBack === handleBack) window.customGoBack = undefined; };
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

    const startDailyChallenge = (challenge: DailyChallenge<Question>, type: 'review' | 'glossary' | 'portuguese', isCatchUp = false) => {
        if (challenge && challenge.items.length > 0) {
            setActiveChallenge({ type, questions: challenge.items, sessionAttempts: challenge.sessionAttempts || [], isCatchUp });
            setQuizInstanceKey(Date.now());
            setView('daily_challenge_quiz');
        }
    };

    const executeDeleteMessage = async () => {
        if (confirmDeleteMessageId) {
            try {
                await FirebaseService.deleteMessageForUser(confirmDeleteMessageId, user.id);
            } catch (error) {
                console.error("Erro ao descartar mensagem:", error);
            }
            setConfirmDeleteMessageId(null);
        }
    };

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
        if (studentProgress) {
            const newProgress = { ...studentProgress, lastAccessedTopicId: topic.id };
            handleUpdateStudentProgress(newProgress, studentProgress);
        }
        setView('topic');
    };

    const handleNavigateToTopic = (topicId: string) => {
        for (const subject of allSubjects) {
            for (const topic of subject.topics) {
                const foundTopic = topic.id === topicId;
                const foundSubtopic = topic.subtopics.find(st => st.id === topicId);
                if (foundTopic || foundSubtopic) {
                    const associatedCourse = enrolledCourses.find(c => c.disciplines.some(d => d.subjectId === subject.id));
                    if (associatedCourse) setSelectedCourse(associatedCourse);
                    setSelectedSubject(subject);
                    setSelectedTopic(topic);
                    setSelectedSubtopic(foundSubtopic || null);
                    if (studentProgress) {
                        const newProgress = { ...studentProgress, lastAccessedTopicId: topicId };
                        handleUpdateStudentProgress(newProgress, studentProgress);
                    }
                    setView('topic');
                    return;
                }
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
            if (!challenge.sessionAttempts) challenge.sessionAttempts = [];
            const existingAttemptIndex = challenge.sessionAttempts.findIndex((a: QuestionAttempt) => a.questionId === attempt.questionId);
            if (existingAttemptIndex > -1) challenge.sessionAttempts[existingAttemptIndex] = attempt;
            else challenge.sessionAttempts.push(attempt);
            setActiveChallenge(prev => prev ? { ...prev, sessionAttempts: challenge.sessionAttempts || [] } : null);
            FirebaseService.saveStudentProgress(newProgress);
            return newProgress;
        });
    };

    const handleDailyChallengeComplete = async (finalAttempts: QuestionAttempt[], isCatchUp: boolean = false) => {
        if (!activeChallenge || isPreview || !studentProgress) return;
        const challengeType = activeChallenge.type;
        const xpToastsToAdd: XpToast[] = [];
        let totalXpGained = 0;
        
        const addChallengeXp = (amount: number, message?: string) => {
            totalXpGained += amount;
            if (message) xpToastsToAdd.push({ id: Date.now() + Math.random(), amount, message });
        };

        const newProgress = JSON.parse(JSON.stringify(studentProgress));
        const challengeKey = `${challengeType}Challenge` as const;
        const challenge = newProgress[challengeKey];
        if (!challenge) return;

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
                const yesterdayBr = getBrasiliaDate(); yesterdayBr.setDate(yesterdayBr.getDate() - 1);
                const yesterdayISO = getLocalDateISOString(yesterdayBr);
                const streak = newProgress.dailyChallengeStreak || { current: 0, longest: 0, lastCompletedDate: '' };
                if (streak.lastCompletedDate === yesterdayISO) streak.current += 1;
                else if (streak.lastCompletedDate !== todayISO) streak.current = 1;
                streak.lastCompletedDate = todayISO;
                streak.longest = Math.max(streak.current, streak.longest);
                newProgress.dailyChallengeStreak = streak;
                const streakBonus = Gamification.XP_CONFIG.STREAK_BONUS as Record<number, number>;
                if (streakBonus[streak.current]) addChallengeXp(streakBonus[streak.current], `Ofensiva de ${streak.current} dias! 🔥`);
            }

            if (!newProgress.dailyChallengeCompletions) newProgress.dailyChallengeCompletions = {};
            if (!newProgress.dailyChallengeCompletions[todayISO]) newProgress.dailyChallengeCompletions[todayISO] = {};
            newProgress.dailyChallengeCompletions[todayISO][challengeType] = true;
        }

        newProgress.xp = (newProgress.xp || 0) + totalXpGained;
        
        // Persistência unificada
        await handleUpdateStudentProgress(newProgress, studentProgress);
        
        setXpToasts(prev => [...prev, ...xpToastsToAdd]);
        setDailyChallengeResults({ questions: activeChallenge.questions, sessionAttempts: finalAttempts });
    };

    const handleGenerateAllDailyChallenges = async () => {
        if (isPreview || !studentProgress) return;
        setIsGeneratingAllChallenges(true);
        setChallengeGenerationStatus('Sincronizando com o QG...');
        try {
            const apiKey = process.env.VITE_DAILY_CHALLENGE_API_KEY;
            const types: Array<'review' | 'glossary' | 'portuguese'> = ['review', 'glossary', 'portuguese'];
            const results: Record<string, any[]> = {};
            for (const type of types) {
                setChallengeGenerationStatus(`Preparando ${type}...`);
                const res = await fetch(`/api/generate-challenge?apiKey=${apiKey}&studentId=${user.id}&challengeType=${type}`);
                if (!res.ok) throw new Error(`Falha no sistema de missões: ${type}`);
                results[type] = await res.json();
                await new Promise(r => setTimeout(r, 1000));
            }
            const todayISO = getLocalDateISOString(getBrasiliaDate());
            const newProgress = {
                ...studentProgress,
                reviewChallenge: { date: todayISO, items: results['review'], isCompleted: false, attemptsMade: 0, sessionAttempts: [] },
                glossaryChallenge: { date: todayISO, items: results['glossary'], isCompleted: false, attemptsMade: 0, sessionAttempts: [] },
                portugueseChallenge: { date: todayISO, items: results['portuguese'], isCompleted: false, attemptsMade: 0, sessionAttempts: [] },
            };
            await handleUpdateStudentProgress(newProgress, studentProgress);
        } catch (error: any) { alert(error.message || `Erro operacional na IA.`); } finally { setIsGeneratingAllChallenges(false); setChallengeGenerationStatus(''); }
    };

    if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-900"><Spinner /></div>;
    if (!studentProgress) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Erro ao carregar dados do aluno.</div>;

    return (
        <div className="bg-gray-900 text-white min-h-screen">
            <StudentHeader 
                user={user} studentProgress={studentProgress} view={view} 
                selectedTopicName={selectedSubtopic?.name || selectedTopic?.name} 
                selectedSubjectName={selectedSubject?.name} selectedCourseName={selectedCourse?.name} 
                activeChallengeType={activeChallenge?.type} onSetView={(v) => setView(v)} onLogout={onLogout} onGoHome={() => setView('dashboard')} 
                onOpenProfile={() => setView('settings')}
            />
            
            <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[70] flex flex-col gap-4 pointer-events-none items-center w-full max-w-lg px-4">
                {activeNotifications.map(notification => (
                    <NotificationToast key={notification.id} notification={notification} onClose={removeNotification} />
                ))}
            </div>

            <main className="p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto">
                {view !== 'dashboard' && !isPreview && (
                    <button onClick={() => handleBack()} className="text-cyan-400 hover:text-cyan-300 mb-6 flex items-center bg-gray-800/50 px-4 py-2 rounded-xl border border-white/5 transition-all font-black text-[10px] uppercase tracking-widest">
                        <ArrowRightIcon className="h-4 w-4 mr-2 transform rotate-180" aria-hidden="true" /> Voltar para Painel
                    </button>
                )}
                {isGeneratingAllChallenges && challengeGenerationStatus && (
                    <div className="mb-6 p-4 bg-cyan-900/30 border border-cyan-500/50 rounded-xl flex items-center gap-4 animate-pulse">
                        <Spinner />
                        <span className="font-black text-cyan-400 uppercase tracking-widest text-xs">{challengeGenerationStatus}</span>
                    </div>
                )}
                <StudentViewRouter
                    view={view} isPreview={isPreview} currentUser={user} studentProgress={studentProgress} allSubjects={allSubjects} allStudents={allStudents} allStudentProgress={allStudentProgress} enrolledCourses={enrolledCourses} fullStudyPlan={studyPlan} messages={messages} teacherProfiles={teacherProfiles} selectedCourse={selectedCourse} selectedSubject={selectedSubject} selectedTopic={selectedTopic} selectedSubtopic={selectedSubtopic} selectedReview={selectedReview} activeChallenge={activeChallenge} dailyChallengeResults={dailyChallengeResults} isGeneratingReview={isGeneratingReview} isSplitView={isSplitView} isSidebarCollapsed={isSidebarCollapsed} quizInstanceKey={quizInstanceKey} activeCustomQuiz={activeCustomQuiz} activeSimulado={activeSimulado} isGeneratingAllChallenges={isGeneratingAllChallenges}
                    onUpdateUser={onUpdateUser}
                    onAcknowledgeMessage={(messageId) => FirebaseService.acknowledgeMessage(messageId, user.id)}
                    onCourseSelect={handleCourseSelect} onSubjectSelect={handleSubjectSelect} onTopicSelect={handleTopicSelect}
                    onStartDailyChallenge={startDailyChallenge} onGenerateAllChallenges={handleGenerateAllDailyChallenges}
                    onNavigateToTopic={handleNavigateToTopic}
                    onToggleTopicCompletion={(subjectId, topicId, isCompleted) => {
                        const newProgress = { ...studentProgress };
                        if (!newProgress.progressByTopic[subjectId]) newProgress.progressByTopic[subjectId] = {};
                        if (!newProgress.progressByTopic[subjectId][topicId]) newProgress.progressByTopic[subjectId][topicId] = { completed: false, score: 0, lastAttempt: [] };
                        newProgress.progressByTopic[subjectId][topicId].completed = isCompleted;
                        handleUpdateStudentProgress(newProgress, studentProgress);
                    }}
                    onOpenNewMessageModal={() => setIsNewMessageModalOpen(true)}
                    onSaveFullPlan={async (fullPlan) => { await FirebaseService.saveStudyPlanForStudent(fullPlan); }}
                    onStartReview={onStartReview}
                    onGenerateSmartReview={async () => {
                        setIsGeneratingReview(true);
                        try {
                            const questions = await GeminiService.generateSmartReview(studentProgress, allSubjects);
                            if (questions.length > 0) onStartReview({ id: `rev-ai-${Date.now()}`, name: "Revisão Inteligente da IA", type: 'ai', createdAt: Date.now(), questions, isCompleted: false });
                            else alert("Dados insuficientes para IA.");
                        } catch (e) { console.error(e); } finally { setIsGeneratingReview(false); }
                    }}
                    onGenerateSrsReview={(questions) => {
                        if (questions.length > 0) onStartReview({ id: `rev-srs-${Date.now()}`, name: "Revisão Diária (SRS)", type: 'srs', createdAt: Date.now(), questions, isCompleted: false });
                        else alert("Nada para revisar hoje.");
                    }}
                    onGenerateSmartFlashcards={async (questions) => {
                        const flashcards = await GeminiService.generateFlashcardsFromIncorrectAnswers(questions);
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
                    onAddBonusXp={addXp} onPlayGame={(game, topicId) => { setPlayingGame({ game, topicId }); setIsGamePlayerOpen(true); }}
                    onDeleteCustomGame={(gameId) => {
                        const newProgress = { ...studentProgress, customGames: studentProgress.customGames.filter(g => g.id !== gameId) };
                        handleUpdateStudentProgress(newProgress, studentProgress);
                    }}
                    onOpenCustomGameModal={() => {}} onSelectTargetCargo={(courseId, cargoName) => {
                        const newProgress = { ...studentProgress, targetCargoByCourse: { ...(studentProgress.targetCargoByCourse || {}), [courseId]: cargoName } };
                        handleUpdateStudentProgress(newProgress, studentProgress);
                    }}
                    onNoteSave={(contentId, content) => {
                        const newProgress = { ...studentProgress, notesByTopic: { ...studentProgress.notesByTopic, [contentId]: content } };
                        handleUpdateStudentProgress(newProgress, studentProgress);
                    }}
                    onToggleSplitView={() => setIsSplitView(!isSplitView)} onSetIsSidebarCollapsed={setIsSidebarCollapsed}
                    onOpenChatModal={() => setIsChatModalOpen(true)} onDeleteMessage={(id) => setConfirmDeleteMessageId(id)}
                    setView={(v) => setView(v)} setActiveChallenge={setActiveChallenge} onSaveDailyChallengeAttempt={saveDailyChallengeAttempt}
                    handleGameComplete={(gameId: string) => {
                        const newProgress = Gamification.processGameCompletion(studentProgress, playingGame!.topicId, gameId, addXp);
                        handleUpdateStudentProgress(newProgress, studentProgress);
                    }}
                    handleGameError={() => addXp(-Gamification.XP_CONFIG.GAME_ERROR_PENALTY)}
                    onReportQuestion={(subjectId, topicId, questionId, isTec, reason) => {
                        FirebaseService.updateSubjectQuestion(subjectId, topicId, questionId, isTec, { reason, studentId: user.id });
                        FirebaseService.createReportNotification(allSubjects.find(s=>s.id === subjectId)!.teacherId, user, allSubjects.find(s => s.id === subjectId)!.name, selectedSubtopic?.name || selectedTopic!.name, (isTec ? (selectedSubtopic || selectedTopic)?.tecQuestions : (selectedSubtopic || selectedTopic)?.questions)?.find(q=>q.id === questionId)?.statement || 'N/A', reason);
                    }}
                    onCloseDailyChallengeResults={() => { setDailyChallengeResults(null); setView('dashboard'); }}
                    onNavigateToDailyChallengeResults={() => setView('daily_challenge_results')}
                    onOpenCreator={() => setIsCustomQuizCreatorOpen(true)}
                    onStartQuiz={(quiz) => { setActiveCustomQuiz(quiz); setQuizInstanceKey(Date.now()); setView('custom_quiz_player'); }}
                    onDeleteQuiz={(quizId) => {
                         if (window.confirm("Apagar este quiz?")) {
                            const newProgress = { ...studentProgress, customQuizzes: (studentProgress.customQuizzes || []).filter(q => q.id !== quizId) };
                            handleUpdateStudentProgress(newProgress, studentProgress);
                        }
                    }}
                    saveCustomQuizAttempt={(attempt) => {
                        setActiveCustomQuiz(prev => { if (!prev) return null; return { ...prev, attempts: [...(prev.attempts || []), attempt] }; });
                    }}
                    handleCustomQuizComplete={(finalAttempts) => {
                        const newProgress = Gamification.processCustomQuizCompletion(studentProgress, activeCustomQuiz!.id, finalAttempts, addXp);
                        handleUpdateStudentProgress(newProgress, studentProgress); setView('practice_area'); setActiveCustomQuiz(null);
                    }}
                    onSaveSimulado={(simulado) => {
                        const newProgress = { ...studentProgress, simulados: [...(studentProgress.simulados || []), simulado] };
                        handleUpdateStudentProgress(newProgress, studentProgress);
                    }}
                    onStartSimulado={(simulado) => { setActiveSimulado(simulado); setQuizInstanceKey(Date.now()); setView('simulado_player'); }}
                    onDeleteSimulado={(simuladoId) => {
                        if (window.confirm("Apagar este simulado?")) {
                            const newProgress = { ...studentProgress, simulados: (studentProgress.simulados || []).filter(s => s.id !== simuladoId) };
                            handleUpdateStudentProgress(newProgress, studentProgress);
                        }
                    }}
                    saveSimuladoAttempt={(attempt) => {
                        setActiveSimulado(prev => { if (!prev) return null; return { ...prev, attempts: [...(prev.attempts || []), attempt] }; });
                    }}
                    handleSimuladoComplete={(finalAttempts) => {
                        const newProgress = Gamification.processSimuladoCompletion(studentProgress, activeSimulado!.id, finalAttempts, addXp);
                        handleUpdateStudentProgress(newProgress, studentProgress); setView('practice_area'); setActiveSimulado(null);
                    }}
                />
            </main>

            <ConfirmModal 
                isOpen={!!confirmDeleteMessageId} onClose={() => setConfirmDeleteMessageId(null)} onConfirm={executeDeleteMessage}
                title="Descartar Aviso" message="Tem certeza que deseja descartar este aviso?" variant="danger" confirmLabel="Descartar"
            />

            <XpToastDisplay toasts={xpToasts} />
            <StudentGamePlayerModal isOpen={isGamePlayerOpen} onClose={() => setIsGamePlayerOpen(false)} game={playingGame?.game || null} onGameComplete={(gameId: string) => {
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

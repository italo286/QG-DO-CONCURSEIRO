import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User, Subject, StudentProgress, Course, Topic, SubTopic, ReviewSession, MiniGame, Question, QuestionAttempt, CustomQuiz } from '../../types';
import * as FirebaseService from '../../services/firebaseService';
import * as Gamification from '../../gamification';
import { useStudentData } from '../../hooks/useStudentData';
import { Spinner, Toast } from '../ui';
import { StudentHeader } from './StudentHeader';
import { StudentViewRouter } from './StudentViewRouter';
import { EditProfileModal } from './EditProfileModal';
import { StudentGamePlayerModal } from './StudentGamePlayerModal';
import { LevelUpModal } from './LevelUpModal';
import { BadgeAwardModal } from './BadgeAwardModal';
import { XpToastDisplay } from './XpToastDisplay';
import { MessageThreadModal } from '../MessageThreadModal';
import { NewMessageModal } from './NewMessageModal';
import { TopicChat } from './TopicChat';
import { StudentCustomQuizCreatorModal } from './StudentCustomQuizCreatorModal';
import { getLocalDateISOString, getBrasiliaDate } from '../../utils';
// FIX: Imported GeminiService to resolve reference errors.
import * as GeminiService from '../../services/geminiService';

type ViewType = 'dashboard' | 'course' | 'subject' | 'topic' | 'schedule' | 'performance' | 'reviews' | 'review_quiz' | 'games' | 'daily_challenge_quiz' | 'daily_challenge_results' | 'custom_quiz_list' | 'custom_quiz_player';

type XpToast = {
    id: number;
    amount: number;
    message?: string;
};

interface PaineldoAlunoProps {
    user: User;
    onLogout: () => void;
    onUpdateUser: (user: User) => void;
    isPreview?: boolean;
    onToggleStudentView?: () => void;
}

export const PaineldoAluno: React.FC<PaineldoAlunoProps> = ({ user, onLogout, onUpdateUser, isPreview, onToggleStudentView }) => {
    const [view, setView] = useState<ViewType>('dashboard');
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
    const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
    const [selectedSubtopic, setSelectedSubtopic] = useState<SubTopic | null>(null);
    const [selectedReview, setSelectedReview] = useState<ReviewSession | null>(null);
    const [activeCustomQuiz, setActiveCustomQuiz] = useState<CustomQuiz | null>(null);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isGamePlayerOpen, setIsGamePlayerOpen] = useState(false);
    const [playingGame, setPlayingGame] = useState<{ game: MiniGame, topicId: string } | null>(null);
    const [isLevelUpModalOpen, setIsLevelUpModalOpen] = useState(false);
    const [newLevelInfo, setNewLevelInfo] = useState({ level: 0, title: '' });
    const [awardedBadges, setAwardedBadges] = useState<any[]>([]);
    const [xpToasts, setXpToasts] = useState<XpToast[]>([]);
    const [isNewMessageModalOpen, setIsNewMessageModalOpen] = useState(false);
    const [isChatModalOpen, setIsChatModalOpen] = useState(false);
    const [isGeneratingReview, setIsGeneratingReview] = useState(false);
    const [isSplitView, setIsSplitView] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [quizInstanceKey, setQuizInstanceKey] = useState(Date.now());
    const [activeChallenge, setActiveChallenge] = useState<{ type: 'review' | 'glossary' | 'portuguese', questions: Question[], sessionAttempts: QuestionAttempt[] } | null>(null);
    const [dailyChallengeResults, setDailyChallengeResults] = useState<{ questions: Question[], sessionAttempts: QuestionAttempt[] } | null>(null);
    const [isCustomQuizCreatorOpen, setIsCustomQuizCreatorOpen] = useState(false);

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

    const handleBack = useCallback(() => {
        if (view === 'topic') {
            setView('subject');
            setSelectedTopic(null);
            setSelectedSubtopic(null);
        } else if (view === 'subject') {
            setView('course');
            setSelectedSubject(null);
        } else if (view === 'course') {
            setView('dashboard');
            setSelectedCourse(null);
        } else if (['schedule', 'performance', 'reviews', 'games', 'custom_quiz_list'].includes(view)) {
            setView('dashboard');
        } else if (view === 'review_quiz' || view === 'daily_challenge_quiz') {
            setView(view === 'review_quiz' ? 'reviews' : 'dashboard');
            setSelectedReview(null);
            setActiveChallenge(null);
        } else if (view === 'custom_quiz_player') {
            setView('custom_quiz_list');
            setActiveCustomQuiz(null);
        }
        return true;
    }, [view]);
    
    useEffect(() => {
        window.customGoBack = handleBack;
        return () => {
            if(window.customGoBack === handleBack) {
                window.customGoBack = undefined;
            }
        };
    }, [handleBack]);


    const handleUpdateStudentProgress = useCallback(async (newProgress: StudentProgress, fromState: StudentProgress | null) => {
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
// FIX: Corrected function call to Gamification.checkAndAwardBadges.
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
    
    // Navigation handlers
    const handleCourseSelect = (course: Course) => {
        setSelectedCourse(course);
        setView('course');
    };
    const handleSubjectSelect = (subject: Subject) => {
        setSelectedSubject(subject);
        setView('subject');
    };
    const handleTopicSelect = (topic: Topic | SubTopic, parentTopic?: Topic) => {
        if ('subtopics' in topic) { // It's a Topic
            setSelectedTopic(topic);
            setSelectedSubtopic(null);
        } else { // It's a SubTopic
            setSelectedTopic(parentTopic!);
            setSelectedSubtopic(topic);
        }
        setView('topic');
    };

    const handleNavigateToTopic = (topicId: string) => {
        for (const subject of allSubjects) {
            for (const topic of subject.topics) {
                if (topic.id === topicId) {
                    setSelectedSubject(subject);
                    setSelectedTopic(topic);
                    setSelectedSubtopic(null);
                    setView('topic');
                    return;
                }
                const subtopic = topic.subtopics.find(st => st.id === topicId);
                if (subtopic) {
                    setSelectedSubject(subject);
                    setSelectedTopic(topic);
                    setSelectedSubtopic(subtopic);
                    setView('topic');
                    return;
                }
            }
        }
    };
    
    const onStartReview = (session: ReviewSession) => {
        setSelectedReview(session);
        setQuizInstanceKey(Date.now());
        setView('review_quiz');
    };

    const handleDailyChallengeComplete = (finalAttempts: QuestionAttempt[]) => {
        if (!activeChallenge || !studentProgress) return;

        const newProgress = { ...studentProgress };
        const challengeType = activeChallenge.type;
        const challengeKey = `${challengeType}Challenge` as 'reviewChallenge' | 'glossaryChallenge' | 'portugueseChallenge';

        const challenge = newProgress[challengeKey];
        if (!challenge) return;

        challenge.isCompleted = true;
        challenge.sessionAttempts = finalAttempts;
        challenge.attemptsMade = (challenge.attemptsMade || 0) + 1;

        const correctCount = finalAttempts.filter(a => a.isCorrect).length;
        const score = challenge.items.length > 0 ? correctCount / challenge.items.length : 0;
        
        if (score >= 0.6) { // 60% to pass
            addXp(Gamification.XP_CONFIG.DAILY_CHALLENGE_COMPLETE, "Desafio Diário Concluído!");
            
            // Streak Logic
            const yesterday = getBrasiliaDate();
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            const yesterdayISO = getLocalDateISOString(yesterday);
            const todayISO = getLocalDateISOString(getBrasiliaDate());

            const streak = newProgress.dailyChallengeStreak || { current: 0, longest: 0, lastCompletedDate: '' };
            if (streak.lastCompletedDate === yesterdayISO) {
                streak.current += 1;
            } else if (streak.lastCompletedDate !== todayISO) {
                streak.current = 1; // Start a new streak
            }
            streak.lastCompletedDate = todayISO;
            streak.longest = Math.max(streak.current, streak.longest);
            newProgress.dailyChallengeStreak = streak;

            // Check for streak bonus XP
            if (Gamification.XP_CONFIG.STREAK_BONUS[streak.current]) {
                const bonusXp = Gamification.XP_CONFIG.STREAK_BONUS[streak.current];
                addXp(bonusXp, `Ofensiva de ${streak.current} dias! 🔥`);
            }
        }
        
        setDailyChallengeResults({ questions: activeChallenge.questions, sessionAttempts: finalAttempts });
        handleUpdateStudentProgress(newProgress, studentProgress);
        setView('daily_challenge_results');
        setActiveChallenge(null);
    };

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-900"><Spinner /></div>;
    }
    if (!studentProgress) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Erro ao carregar dados do aluno.</div>;
    }

    return (
        <div className="bg-gray-900 text-white min-h-screen p-4 sm:p-6 lg:p-8">
            <StudentHeader 
                user={user} 
                studentProgress={studentProgress}
                view={view}
                selectedTopicName={selectedSubtopic?.name || selectedTopic?.name}
                selectedCourseName={selectedCourse?.name}
                onSetView={setView}
                onOpenProfile={() => setIsProfileModalOpen(true)}
                onLogout={onLogout}
                onGoHome={() => setView('dashboard')}
            />
            <main>
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
                    dailyChallengeResults={dailyChallengeResults}
                    isGeneratingReview={isGeneratingReview}
                    isSplitView={isSplitView}
                    isSidebarCollapsed={isSidebarCollapsed}
                    quizInstanceKey={quizInstanceKey}
                    activeCustomQuiz={activeCustomQuiz}
                    onAcknowledgeMessage={(messageId) => FirebaseService.acknowledgeMessage(messageId, user.id)}
                    onCourseSelect={handleCourseSelect}
                    onSubjectSelect={handleSubjectSelect}
                    onTopicSelect={handleTopicSelect}
                    onStartDailyChallenge={async (type) => {
                        const challenge = studentProgress[type === 'review' ? 'reviewChallenge' : type === 'glossary' ? 'glossaryChallenge' : 'portugueseChallenge'];
                        if(challenge && challenge.items.length > 0) {
                            setActiveChallenge({ type, questions: challenge.items, sessionAttempts: challenge.sessionAttempts || [] });
                            setQuizInstanceKey(Date.now());
                            setView('daily_challenge_quiz');
                        }
                    }}
                    onNavigateToTopic={handleNavigateToTopic}
                    onToggleTopicCompletion={(subjectId, topicId, isCompleted) => {
                        const newProgress = { ...studentProgress };
                        if (!newProgress.progressByTopic[subjectId]) newProgress.progressByTopic[subjectId] = {};
                        if (!newProgress.progressByTopic[subjectId][topicId]) newProgress.progressByTopic[subjectId][topicId] = { completed: false, score: 0, lastAttempt: [] };
                        newProgress.progressByTopic[subjectId][topicId].completed = isCompleted;
                        handleUpdateStudentProgress(newProgress, studentProgress);
                    }}
                    onOpenNewMessageModal={() => setIsNewMessageModalOpen(true)}
                    onSavePlan={async (plan) => {
                        const newStudyPlan = { studentId: user.id, plan };
                        await FirebaseService.saveStudyPlanForStudent(newStudyPlan);
                    }}
                    onStartReview={onStartReview}
                    onGenerateSmartReview={async () => {
                        setIsGeneratingReview(true);
                        try {
// FIX: Corrected function call to use GeminiService instead of Gamification.
                            const questions = await GeminiService.generateSmartReview(studentProgress, allSubjects);
                            if (questions.length > 0) {
                                const smartSession: ReviewSession = { id: `rev-ai-${Date.now()}`, name: "Revisão Inteligente da IA", type: 'ai', createdAt: Date.now(), questions, isCompleted: false };
                                onStartReview(smartSession);
                            } else {
                                alert("Não há dados suficientes para gerar uma revisão inteligente.");
                            }
                        } catch (e) {
                            console.error(e);
                        } finally {
                            setIsGeneratingReview(false);
                        }
                    }}
                    onGenerateSrsReview={(questions) => {
                        if (questions.length > 0) {
                            const srsSession: ReviewSession = { id: `rev-srs-${Date.now()}`, name: "Revisão Diária (SRS)", type: 'srs', createdAt: Date.now(), questions, isCompleted: false };
                            onStartReview(srsSession);
                        } else {
                            alert("Nenhuma questão agendada para revisão hoje.");
                        }
                    }}
                    onGenerateSmartFlashcards={async (questions) => {
// FIX: Corrected function call to use GeminiService for AI-based generation.
                        const flashcards = await GeminiService.generateFlashcardsFromIncorrectAnswers(questions);
                        const newProgress = { ...studentProgress, aiGeneratedFlashcards: [...(studentProgress.aiGeneratedFlashcards || []), ...flashcards.map(f => ({...f, id: `fc-ai-${Date.now()}-${Math.random()}`}))] };
                        handleUpdateStudentProgress(newProgress, studentProgress);
                    }}
                    onFlashcardReview={(flashcardId, performance) => {
// FIX: Corrected function call to Gamification.updateSrsFlashcard.
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
// FIX: Corrected function call to Gamification.processQuizCompletion.
                        const newProgress = Gamification.processQuizCompletion(studentProgress, subjectId, topicId, attempts, addXp);
                        handleUpdateStudentProgress(newProgress, studentProgress);
                    }}
                    handleReviewQuizComplete={(reviewId, attempts) => {
// FIX: Corrected function call to Gamification.processReviewCompletion.
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
                    onOpenCustomGameModal={(game) => { /* Logic to open custom game modal */ }}
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
                    onSaveDailyChallengeAttempt={(challengeType, attempt) => {
                        setActiveChallenge(prev => {
                            if(!prev) return null;
                            const updatedChallenge = {...prev};
                            if (!updatedChallenge.sessionAttempts) {
                                updatedChallenge.sessionAttempts = [];
                            }
                            updatedChallenge.sessionAttempts.push(attempt);
                            return updatedChallenge;
                        });
                    }}
                    handleGameComplete={(gameId) => {
// FIX: Corrected function call to Gamification.processGameCompletion.
                        const newProgress = Gamification.processGameCompletion(studentProgress, playingGame!.topicId, gameId, addXp);
                        handleUpdateStudentProgress(newProgress, studentProgress);
                    }}
                    handleGameError={() => addXp(-Gamification.XP_CONFIG.GAME_ERROR_PENALTY)}
                    onReportQuestion={(subjectId, topicId, questionId, isTec, reason) => {
                        FirebaseService.updateSubjectQuestion(subjectId, topicId, questionId, isTec, { reason, studentId: user.id });
                        FirebaseService.createReportNotification(
                            allSubjects.find(s=>s.id === subjectId)!.teacherId,
                            user,
                            allSubjects.find(s => s.id === subjectId)!.name,
                            selectedSubtopic?.name || selectedTopic!.name,
                            (isTec ? (selectedSubtopic || selectedTopic)?.tecQuestions : (selectedSubtopic || selectedTopic)?.questions)?.find(q=>q.id === questionId)?.statement || 'N/A',
                            reason
                        );
                    }}
                    onCloseDailyChallengeResults={() => { setDailyChallengeResults(null); setView('dashboard'); }}
                    onOpenCreator={() => setIsCustomQuizCreatorOpen(true)}
                    onStartQuiz={(quiz) => {
                        setActiveCustomQuiz(quiz);
                        setQuizInstanceKey(Date.now());
                        setView('custom_quiz_player');
                    }}
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
// FIX: Corrected function call to Gamification.processCustomQuizCompletion.
                        const newProgress = Gamification.processCustomQuizCompletion(studentProgress, activeCustomQuiz!.id, finalAttempts, addXp);
                        handleUpdateStudentProgress(newProgress, studentProgress);
                        setView('custom_quiz_list');
                        setActiveCustomQuiz(null);
                    }}
                />
            </main>

            {/* Modals */}
            <XpToastDisplay toasts={xpToasts} />
            <EditProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} user={user} onSave={onUpdateUser} />
            <StudentGamePlayerModal 
                isOpen={isGamePlayerOpen} 
                onClose={() => setIsGamePlayerOpen(false)} 
                game={playingGame?.game || null}
                onGameComplete={(gameId) => {
// FIX: Corrected function call to Gamification.processGameCompletion.
                    const newProgress = Gamification.processGameCompletion(studentProgress, playingGame!.topicId, gameId, addXp);
                    handleUpdateStudentProgress(newProgress, studentProgress);
                }}
                onGameError={() => addXp(-Gamification.XP_CONFIG.GAME_ERROR_PENALTY)}
            />
            <LevelUpModal isOpen={isLevelUpModalOpen} onClose={() => setIsLevelUpModalOpen(false)} newLevel={newLevelInfo.level} levelTitle={newLevelInfo.title} />
            <BadgeAwardModal isOpen={awardedBadges.length > 0} onClose={() => setAwardedBadges(prev => prev.slice(1))} badges={awardedBadges} />
             <NewMessageModal
                isOpen={isNewMessageModalOpen}
                onClose={() => setIsNewMessageModalOpen(false)}
                teachers={teacherProfiles}
                onSendMessage={async (teacherId, message) => {
                    await FirebaseService.addMessage({ senderId: user.id, teacherId, studentId: user.id, message });
                }}
            />
            {isChatModalOpen && selectedTopic && (
                 <div className="fixed bottom-4 right-4 h-[60vh] w-[400px] z-50 bg-gray-800 rounded-lg shadow-2xl border border-gray-700 flex flex-col">
                    <div className="flex justify-between items-center p-2 border-b border-gray-700 bg-gray-900/50 rounded-t-lg">
                        <h3 className="font-bold text-sm">Assistente IA</h3>
                        <button onClick={() => setIsChatModalOpen(false)} className="text-gray-400 hover:text-white">&times;</button>
                    </div>
                    <TopicChat subject={selectedSubject!} topic={selectedSubtopic || selectedTopic} isVisible={isChatModalOpen} />
                </div>
            )}
            <StudentCustomQuizCreatorModal 
                isOpen={isCustomQuizCreatorOpen}
                onClose={() => setIsCustomQuizCreatorOpen(false)}
                onSave={(quiz) => {
                    const newProgress = { ...studentProgress, customQuizzes: [...(studentProgress.customQuizzes || []), quiz] };
                    handleUpdateStudentProgress(newProgress, studentProgress);
                }}
            />
        </div>
    );
};

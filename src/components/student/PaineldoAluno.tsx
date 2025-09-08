import React, { useState, useEffect, useCallback } from 'react';
import {
    User, Subject, Topic, SubTopic, Course, ReviewSession, Question,
    QuestionAttempt, MiniGame, StudentProgress, TeacherMessage, CustomQuiz, Badge, StudyPlan
} from '../../types';
import { useStudentData } from '../../hooks/useStudentData';
import { Spinner, Button, Modal } from '../ui';
import { StudentHeader } from './StudentHeader';
import { StudentViewRouter } from './StudentViewRouter';
import { EditProfileModal } from './EditProfileModal';
import { NewMessageModal } from './NewMessageModal';
import { MessageThreadModal } from '../MessageThreadModal';
import { StudentGamePlayerModal } from './StudentGamePlayerModal';
import { XpToastDisplay } from './XpToastDisplay';
import { LevelUpModal } from './LevelUpModal';
import { BadgeAwardModal } from './BadgeAwardModal';
import { AiAssistant } from './AiAssistant';
import { StudentGameEditorModal } from './StudentGameEditorModal';
import { CreateCustomQuizModal } from './CreateCustomQuizModal';
import * as FirebaseService from '../../services/firebaseService';
import { XP_CONFIG, calculateLevel, getLevelTitle, ALL_BADGES, TOPIC_BADGES, SRS_INTERVALS } from '../../gamification';
// FIX: Import 'getBrasiliaDate' to resolve reference error.
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

export const PaineldoAluno: React.FC<PaineldoAlunoProps> = ({ user, onLogout, onUpdateUser, isPreview = false, onToggleStudentView }) => {
    const { 
        isLoading: isDataLoading, 
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

    const [view, setView] = useState<ViewType>('dashboard');
    const [history, setHistory] = useState<ViewType[]>(['dashboard']);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
    const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
    const [selectedSubtopic, setSelectedSubtopic] = useState<SubTopic | null>(null);
    const [selectedReview, setSelectedReview] = useState<ReviewSession | null>(null);
    const [activeChallenge, setActiveChallenge] = useState<{ type: 'review' | 'glossary' | 'portuguese', questions: Question[], sessionAttempts: QuestionAttempt[] } | null>(null);
    const [dailyChallengeResults, setDailyChallengeResults] = useState<{ questions: Question[], sessionAttempts: QuestionAttempt[] } | null>(null);
    const [activeCustomQuiz, setActiveCustomQuiz] = useState<CustomQuiz | null>(null);

    // Modals state
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isNewMessageModalOpen, setIsNewMessageModalOpen] = useState(false);
    const [activeThread, setActiveThread] = useState<TeacherMessage | null>(null);
    const [isChatAssistantOpen, setIsChatAssistantOpen] = useState(false);
    
    // Gamification state
    const [playingGame, setPlayingGame] = useState<{ game: MiniGame, topicId: string } | null>(null);
    const [xpToasts, setXpToasts] = useState<{ id: number, amount: number, message?: string }[]>([]);
    const [levelUpInfo, setLevelUpInfo] = useState<{ newLevel: number, levelTitle: string } | null>(null);
    const [newlyEarnedBadges, setNewlyEarnedBadges] = useState<Badge[]>([]);
    const [isCustomGameModalOpen, setIsCustomGameModalOpen] = useState(false);
    const [editingCustomGame, setEditingCustomGame] = useState<MiniGame | null>(null);
    const [isCustomQuizCreatorOpen, setIsCustomQuizCreatorOpen] = useState(false);

    // Topic view state
    const [isSplitView, setIsSplitView] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    
    // For re-rendering quiz view on new quiz start
    const [quizInstanceKey, setQuizInstanceKey] = useState(Date.now());

    const updateStudentProgress = useCallback(async (newProgress: StudentProgress, fromState: StudentProgress | null = studentProgress) => {
        if (isPreview || !fromState) return;
        setStudentProgress(newProgress);
        await FirebaseService.saveStudentProgress(newProgress);
    }, [isPreview, studentProgress, setStudentProgress]);

    const addXp = useCallback((amount: number, message?: string) => {
        if (isPreview || !studentProgress) return;
        
        const currentLevel = calculateLevel(studentProgress.xp);
        const newXp = studentProgress.xp + amount;
        const newLevel = calculateLevel(newXp);

        setXpToasts(toasts => [...toasts, { id: Date.now(), amount, message }]);
        setTimeout(() => setXpToasts(t => t.slice(1)), 3000);

        if (newLevel > currentLevel) {
            setLevelUpInfo({ newLevel, levelTitle: getLevelTitle(newLevel) });
        }

        const updatedProgress = { ...studentProgress, xp: newXp };
        // We call updateStudentProgress directly here to ensure state consistency
        updateStudentProgress(updatedProgress, studentProgress);

    }, [studentProgress, isPreview, updateStudentProgress]);


    const checkForNewBadges = useCallback((progress: StudentProgress, subjects: Subject[]) => {
        const newlyEarned: Badge[] = [];
        Object.entries(ALL_BADGES).forEach(([id, badgeInfo]) => {
            if (!progress.earnedBadgeIds.includes(id)) {
                const conditionResult = badgeInfo.condition(progress, subjects, allStudentProgress);
                if (conditionResult) {
                    let badgeDetails: Badge = { id, ...badgeInfo };
                    if (typeof conditionResult === 'object') {
                        badgeDetails = { ...badgeDetails, ...conditionResult };
                    }
                    newlyEarned.push(badgeDetails);
                }
            }
        });

        if (newlyEarned.length > 0) {
            setNewlyEarnedBadges(prev => [...prev, ...newlyEarned]);
            const newBadgeIds = newlyEarned.map(b => b.id);
            const updatedProgress = { ...progress, earnedBadgeIds: [...progress.earnedBadgeIds, ...newBadgeIds] };
            updateStudentProgress(updatedProgress, progress);
        }
    }, [allStudentProgress, updateStudentProgress]);
    
    useEffect(() => {
        if (studentProgress && allSubjects.length > 0) {
            checkForNewBadges(studentProgress, allSubjects);
        }
    }, [studentProgress, allSubjects, checkForNewBadges]);
    
     const changeView = (newView: ViewType) => {
        setView(newView);
        if (newView !== 'topic') setIsSplitView(false);
        setHistory(prev => [...prev, newView]);
    };

    const handleBack = useCallback((): boolean => {
        if (isSplitView && view === 'topic') {
            setIsSplitView(false);
            return true;
        }

        if (history.length > 1) {
            const newHistory = [...history];
            newHistory.pop();
            const prevView = newHistory[newHistory.length - 1];

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
            return true;
        }
        return false;
    }, [history, view, isSplitView]);

    useEffect(() => {
        window.customGoBack = handleBack;
        return () => { if (window.customGoBack === handleBack) window.customGoBack = undefined; };
    }, [handleBack]);


    const handleProfileSave = (updatedUser: User) => { onUpdateUser(updatedUser); };
    const handleLogout = () => { onLogout(); };
    
    const onAcknowledgeMessage = (messageId: string) => FirebaseService.acknowledgeMessage(messageId, user.id);
    const onCourseSelect = (course: Course) => { setSelectedCourse(course); changeView('course'); };
    const onSubjectSelect = (subject: Subject) => { setSelectedSubject(subject); changeView('subject'); };
    const onTopicSelect = (topic: Topic | SubTopic, parentTopic?: Topic) => {
        setSelectedTopic(parentTopic || topic as Topic);
        if (parentTopic) setSelectedSubtopic(topic as SubTopic);
        else setSelectedSubtopic(null);
        changeView('topic');
    };
    
    const onStartReview = (session: ReviewSession) => { setSelectedReview(session); changeView('review_quiz'); };
    
    const saveQuizProgress = (subjectId: string, topicId: string, attempt: QuestionAttempt) => {
        if (!studentProgress) return;
        const newProgress = { ...studentProgress };
        
        if (!newProgress.progressByTopic[subjectId]) newProgress.progressByTopic[subjectId] = {};
        if (!newProgress.progressByTopic[subjectId][topicId]) {
            newProgress.progressByTopic[subjectId][topicId] = { completed: false, score: 0, lastAttempt: [] };
        }
        
        const newAttempts = [...newProgress.progressByTopic[subjectId][topicId].lastAttempt.filter(a => a.questionId !== attempt.questionId), attempt];
        newProgress.progressByTopic[subjectId][topicId].lastAttempt = newAttempts;
        
        // SRS
        if (!newProgress.srsData) newProgress.srsData = {};
        const srsData = newProgress.srsData[attempt.questionId] || { stage: 0, nextReviewDate: getLocalDateISOString(new Date()) };
        srsData.stage = attempt.isCorrect ? Math.min(srsData.stage + 1, SRS_INTERVALS.length - 1) : Math.max(0, srsData.stage - 1);
        const interval = SRS_INTERVALS[srsData.stage];
        const nextReview = new Date();
        nextReview.setDate(nextReview.getDate() + interval);
        srsData.nextReviewDate = getLocalDateISOString(nextReview);
        newProgress.srsData[attempt.questionId] = srsData;
        
        // Daily Activity
        const today = getLocalDateISOString(getBrasiliaDate());
        if (!newProgress.dailyActivity[today]) newProgress.dailyActivity[today] = { questionsAnswered: 0 };
        newProgress.dailyActivity[today].questionsAnswered++;
        
        updateStudentProgress(newProgress);
        if (attempt.isCorrect) addXp(XP_CONFIG.CORRECT_ANSWER);
    };

    const handleTopicQuizComplete = (subjectId: string, topicId: string, attempts: QuestionAttempt[]) => {
        if (!studentProgress) return;
        const correctCount = attempts.filter(a => a.isCorrect).length;
        const score = attempts.length > 0 ? correctCount / attempts.length : 0;
        
        const newProgress = { ...studentProgress };
        if (!newProgress.progressByTopic[subjectId]) newProgress.progressByTopic[subjectId] = {};
        newProgress.progressByTopic[subjectId][topicId] = { completed: true, score: score, lastAttempt: attempts };
        
        addXp(XP_CONFIG.TOPIC_COMPLETE);
        
        const newTopicBadges: string[] = [];
        if (score >= 1.0) newTopicBadges.push('gold');
        if (score >= 0.9) newTopicBadges.push('silver');
        if (score >= 0.7) newTopicBadges.push('bronze');
        
        if (newTopicBadges.length > 0) {
            if (!newProgress.earnedTopicBadgeIds) newProgress.earnedTopicBadgeIds = {};
            const existingBadges = new Set(newProgress.earnedTopicBadgeIds[topicId] || []);
            newTopicBadges.forEach(b => existingBadges.add(b));
            newProgress.earnedTopicBadgeIds[topicId] = Array.from(existingBadges);
            
            const highestNewBadge = newTopicBadges.includes('gold') ? 'gold' : newTopicBadges.includes('silver') ? 'silver' : 'bronze';
            const badgeInfo = TOPIC_BADGES[highestNewBadge as keyof typeof TOPIC_BADGES];
            setNewlyEarnedBadges(prev => [...prev, {id: `topic-${topicId}-${highestNewBadge}`, ...badgeInfo}]);
        }
        updateStudentProgress(newProgress);
    };

    const handleDailyChallengeComplete = (finalAttempts: QuestionAttempt[]) => {
        if (!studentProgress || !activeChallenge) return;
        
        const correctCount = finalAttempts.filter(a => a.isCorrect).length;
        const passedChallenge = correctCount / activeChallenge.questions.length >= 0.6;
        
        const newProgress = { ...studentProgress };
        const challengeKey = `${activeChallenge.type}Challenge` as 'reviewChallenge' | 'glossaryChallenge' | 'portugueseChallenge';
        
        if (newProgress[challengeKey]) {
            newProgress[challengeKey]!.isCompleted = passedChallenge;
            newProgress[challengeKey]!.sessionAttempts = finalAttempts;
            newProgress[challengeKey]!.attemptsMade = (newProgress[challengeKey]!.attemptsMade || 0) + 1;
        }

        if (passedChallenge) {
            addXp(XP_CONFIG.DAILY_CHALLENGE_COMPLETE, `Desafio Concluído! +${XP_CONFIG.DAILY_CHALLENGE_COMPLETE} XP`);
        }

        setDailyChallengeResults({ questions: activeChallenge.questions, sessionAttempts: finalAttempts });
        changeView('daily_challenge_results');
        updateStudentProgress(newProgress);
    };
    
    const onPlayGame = (game: MiniGame, topicId: string) => setPlayingGame({game, topicId});
    
    const handleGameComplete = (gameId: string) => {
        if (!studentProgress || !playingGame) return;
        addXp(XP_CONFIG.MINI_GAME_COMPLETE);
        
        const newProgress = { ...studentProgress };
        const topicId = playingGame.topicId;

        if (!newProgress.earnedGameBadgeIds) newProgress.earnedGameBadgeIds = {};
        if (!newProgress.earnedGameBadgeIds[topicId]) newProgress.earnedGameBadgeIds[topicId] = [];
        if (!newProgress.earnedGameBadgeIds[topicId].includes(gameId)) {
            newProgress.earnedGameBadgeIds[topicId].push(gameId);
        }
        newProgress.gamesCompletedCount = (newProgress.gamesCompletedCount || 0) + 1;

        updateStudentProgress(newProgress);
    };

    const handleGameError = () => addXp(-XP_CONFIG.GAME_ERROR_PENALTY);
    
    const onNoteSave = (contentId: string, content: string) => {
        if (!studentProgress) return;
        const newProgress = { ...studentProgress, notesByTopic: { ...studentProgress.notesByTopic, [contentId]: content } };
        updateStudentProgress(newProgress);
    };

    const onStartDailyChallenge = (challengeType: 'review' | 'glossary' | 'portuguese') => {
        if (!studentProgress) return;
        const challengeKey = `${challengeType}Challenge` as const;
        const challengeData = studentProgress[challengeKey];

        if (challengeData && challengeData.items.length > 0) {
            setActiveChallenge({
                type: challengeType,
                questions: challengeData.items,
                sessionAttempts: challengeData.sessionAttempts || [],
            });
            setQuizInstanceKey(Date.now());
            changeView('daily_challenge_quiz');
        }
    };
    
    const onSavePlan = async (plan: StudyPlan['plan']) => { if(studentProgress) await FirebaseService.saveStudyPlanForStudent({ studentId: studentProgress.studentId, plan }); };
    
    if (isDataLoading || !studentProgress) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-900"><Spinner /></div>;
    }
    
    return (
        <div className="bg-gray-900 text-white min-h-screen p-4 sm:p-6 lg:p-8">
             {isPreview && onToggleStudentView && (
                <div className="fixed bottom-4 right-4 z-50">
                    <Button onClick={onToggleStudentView} className="bg-purple-600 hover:bg-purple-700">
                         <ArrowRightIcon className="h-4 w-4 mr-2 transform rotate-180" />
                        Voltar para Visão do Professor
                    </Button>
                </div>
            )}
            
            <StudentHeader 
                user={user} 
                studentProgress={studentProgress}
                view={view}
                onSetView={changeView}
                onOpenProfile={() => setIsProfileModalOpen(true)}
                onLogout={handleLogout}
                selectedTopicName={selectedSubtopic?.name || selectedTopic?.name}
                selectedCourseName={selectedCourse?.name}
                onGoHome={() => {
                    setView('dashboard');
                    setHistory(['dashboard']);
                }}
            />

            <main className="mt-6">
                {view !== 'dashboard' && (
                    <button
                        onClick={handleBack}
                        className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-cyan-700 hover:bg-cyan-800 focus:outline-none mb-6"
                    >
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
                    dailyChallengeResults={dailyChallengeResults}
                    isGeneratingReview={false} // Placeholder
                    isSplitView={isSplitView}
                    isSidebarCollapsed={isSidebarCollapsed}
                    quizInstanceKey={quizInstanceKey}
                    activeCustomQuiz={activeCustomQuiz}
                    
                    // Callbacks
                    onAcknowledgeMessage={onAcknowledgeMessage}
                    onCourseSelect={onCourseSelect}
                    onSubjectSelect={onSubjectSelect}
                    onTopicSelect={onTopicSelect}
                    onStartDailyChallenge={onStartDailyChallenge}
                    onNavigateToTopic={(topicId: string) => {}} // TODO
                    onToggleTopicCompletion={(subjectId: string, topicId: string, isCompleted: boolean) => {}} // TODO
                    onOpenNewMessageModal={() => setIsNewMessageModalOpen(true)}
                    onSavePlan={onSavePlan}
                    onStartReview={onStartReview}
                    onGenerateSmartReview={() => {}} // TODO
                    onGenerateSrsReview={() => {}} // TODO
                    onGenerateSmartFlashcards={async () => {}} // TODO
                    onFlashcardReview={() => {}} // TODO
                    onUpdateStudentProgress={updateStudentProgress}
                    saveQuizProgress={saveQuizProgress}
                    saveReviewProgress={() => {}} // TODO
                    handleTopicQuizComplete={handleTopicQuizComplete}
                    handleReviewQuizComplete={() => {}} // TODO
                    handleDailyChallengeComplete={handleDailyChallengeComplete}
                    onAddBonusXp={addXp}
                    onPlayGame={onPlayGame}
                    onDeleteCustomGame={(gameId: string) => {}} // TODO
                    onOpenCustomGameModal={(game: MiniGame | null) => { setEditingCustomGame(game); setIsCustomGameModalOpen(true); }}
                    onSelectTargetCargo={(courseId: string, cargoName: string) => {}} // TODO
                    onNoteSave={onNoteSave}
                    onToggleSplitView={() => setIsSplitView(prev => !prev)}
                    onSetIsSidebarCollapsed={setIsSidebarCollapsed}
                    onOpenChatModal={() => setIsChatAssistantOpen(true)}
                    setView={changeView}
                    setActiveChallenge={setActiveChallenge}
                    onSaveDailyChallengeAttempt={() => {}} // TODO
                    handleGameComplete={handleGameComplete}
                    handleGameError={handleGameError}
                    onReportQuestion={(subjectId: string, topicId: string, questionId: string, isTec: boolean, reason: string) => {}} // TODO
                    onCloseDailyChallengeResults={() => { setDailyChallengeResults(null); changeView('dashboard'); }}
                    onOpenCreator={() => setIsCustomQuizCreatorOpen(true)}
                    onStartQuiz={(quiz: CustomQuiz) => { setActiveCustomQuiz(quiz); setQuizInstanceKey(Date.now()); changeView('custom_quiz_player'); }}
                    onDeleteQuiz={(quizId: string) => {}} // TODO
                    saveCustomQuizAttempt={() => {}} // TODO
                    handleCustomQuizComplete={() => {}} // TODO
                />
            </main>
            
            {/* Modals and Global UI Elements */}
            <XpToastDisplay toasts={xpToasts} />
            <EditProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} user={user} onSave={handleProfileSave} />
            <NewMessageModal isOpen={isNewMessageModalOpen} onClose={() => setIsNewMessageModalOpen(false)} teachers={teacherProfiles} onSendMessage={async (teacherId, text) => await FirebaseService.addMessage({ senderId: user.id, teacherId, studentId: user.id, message: text })} />
            {activeThread && <MessageThreadModal isOpen={!!activeThread} onClose={() => setActiveThread(null)} thread={activeThread} currentUser={user} participants={{...teacherProfiles.reduce((acc, t) => ({...acc, [t.id]: t}), {}), [user.id]: user}} onSendReply={FirebaseService.addReplyToMessage} onDelete={(id) => FirebaseService.deleteMessageForUser(id, user.id)} />}
            {playingGame && <StudentGamePlayerModal isOpen={!!playingGame} onClose={() => setPlayingGame(null)} game={playingGame.game} onGameComplete={handleGameComplete} onGameError={handleGameError} />}
            {levelUpInfo && <LevelUpModal isOpen={!!levelUpInfo} onClose={() => setLevelUpInfo(null)} newLevel={levelUpInfo.newLevel} levelTitle={levelUpInfo.levelTitle} />}
            <BadgeAwardModal isOpen={newlyEarnedBadges.length > 0} onClose={() => setNewlyEarnedBadges(b => b.slice(1))} badges={newlyEarnedBadges} />
            {isChatAssistantOpen && selectedTopic && selectedSubject && <Modal isOpen={isChatAssistantOpen} onClose={() => setIsChatAssistantOpen(false)} title="Assistente IA" size="3xl"><div className="h-[70vh]"><AiAssistant subject={selectedSubject} topic={selectedSubtopic || selectedTopic}/></div></Modal>}
            <StudentGameEditorModal isOpen={isCustomGameModalOpen} onClose={() => setIsCustomGameModalOpen(false)} game={editingCustomGame} onSave={() => {}} />
            <CreateCustomQuizModal isOpen={isCustomQuizCreatorOpen} onClose={() => setIsCustomQuizCreatorOpen(false)} onSave={() => {}} />
        </div>
    );
};

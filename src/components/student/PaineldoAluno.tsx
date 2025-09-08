
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    User, Subject, Topic, SubTopic, Course, ReviewSession, Question,
    QuestionAttempt, MiniGame, StudentProgress, TeacherMessage, CustomQuiz, Flashcard, Badge
} from '../../types';
import { useStudentData } from '../../hooks/useStudentData';
import { Spinner } from '../ui';
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
import { getLocalDateISOString } from '../../utils';
import { Button } from '../ui';
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

        if (newLevel > currentLevel) {
            setLevelUpInfo({ newLevel, levelTitle: getLevelTitle(newLevel) });
        }

        const updatedProgress = { ...studentProgress, xp: newXp };
        setStudentProgress(updatedProgress); // update state locally first
        FirebaseService.saveStudentProgress(updatedProgress); // then save to db
    }, [studentProgress, isPreview, setStudentProgress]);


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
    
    // Check for badges whenever progress changes
    useEffect(() => {
        if (studentProgress && allSubjects.length > 0) {
            checkForNewBadges(studentProgress, allSubjects);
        }
    }, [studentProgress, allSubjects, checkForNewBadges]);
    
    const handleBack = useCallback(() => {
        switch(view) {
            case 'course': setView('dashboard'); setSelectedCourse(null); break;
            case 'subject': setView('course'); setSelectedSubject(null); break;
            case 'topic': setView('subject'); setSelectedTopic(null); setSelectedSubtopic(null); break;
            default: setView('dashboard'); break;
        }
        return true;
    }, [view]);
    
    useEffect(() => {
        window.customGoBack = handleBack;
        return () => { if (window.customGoBack === handleBack) window.customGoBack = undefined; };
    }, [handleBack]);


    const handleProfileSave = (updatedUser: User) => { onUpdateUser(updatedUser); };
    const handleLogout = () => { onLogout(); };
    
    // ... all other handlers
    const onAcknowledgeMessage = (messageId: string) => FirebaseService.acknowledgeMessage(messageId, user.id);
    const onCourseSelect = (course: Course) => { setSelectedCourse(course); setView('course'); };
    const onSubjectSelect = (subject: Subject) => { setSelectedSubject(subject); setView('subject'); };
    const onTopicSelect = (topic: Topic | SubTopic, parentTopic?: Topic) => {
        setSelectedTopic(parentTopic || topic as Topic);
        if (parentTopic) setSelectedSubtopic(topic as SubTopic);
        else setSelectedSubtopic(null);
        setView('topic');
    };
    
    const onStartReview = (session: ReviewSession) => { setSelectedReview(session); setView('review_quiz'); };
    const onGenerateSmartReview = () => {}; // TODO
    const onGenerateSrsReview = () => {}; // TODO
    const onGenerateSmartFlashcards = async () => {}; // TODO
    const onFlashcardReview = () => {}; // TODO
    const saveQuizProgress = () => {}; // TODO
    const saveReviewProgress = () => {}; // TODO
    const handleTopicQuizComplete = () => {}; // TODO
    const handleReviewQuizComplete = () => {}; // TODO
    const handleDailyChallengeComplete = () => {}; // TODO
    const onPlayGame = (game: MiniGame, topicId: string) => setPlayingGame({game, topicId});
    const handleGameComplete = () => {}; // TODO
    const handleGameError = () => addXp(-XP_CONFIG.GAME_ERROR_PENALTY);
    const onNoteSave = () => {}; // TODO
    const onStartDailyChallenge = () => {}; // TODO
    const onNavigateToTopic = () => {}; // TODO
    const onToggleTopicCompletion = () => {}; // TODO
    const onOpenNewMessageModal = () => setIsNewMessageModalOpen(true);
    const onSavePlan = async (plan: StudyPlan['plan']) => { if(studentProgress) await FirebaseService.saveStudyPlanForStudent({ studentId: studentProgress.studentId, plan }); };
    const onDeleteCustomGame = () => {}; // TODO
    const onOpenCustomGameModal = (game: MiniGame | null) => { setEditingCustomGame(game); setIsCustomGameModalOpen(true); };
    const onSelectTargetCargo = () => {}; // TODO
    const onToggleSplitView = () => setIsSplitView(prev => !prev);
    const onSetIsSidebarCollapsed = (collapsed: boolean) => setIsSidebarCollapsed(collapsed);
    const onOpenChatModal = () => setIsChatAssistantOpen(true);
    const onSaveDailyChallengeAttempt = () => {}; // TODO
    const onReportQuestion = () => {}; // TODO
    const onCloseDailyChallengeResults = () => setView('dashboard');
    const onOpenCreator = () => setIsCustomQuizCreatorOpen(true);
    const onStartQuiz = (quiz: CustomQuiz) => { setActiveCustomQuiz(quiz); setQuizInstanceKey(Date.now()); setView('custom_quiz_player'); };
    const onDeleteQuiz = () => {}; // TODO
    const saveCustomQuizAttempt = () => {}; // TODO
    const handleCustomQuizComplete = () => {}; // TODO


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
                onSetView={setView}
                onOpenProfile={() => setIsProfileModalOpen(true)}
                onLogout={handleLogout}
                selectedTopicName={selectedSubtopic?.name || selectedTopic?.name}
                selectedCourseName={selectedCourse?.name}
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
                    onNavigateToTopic={onNavigateToTopic}
                    onToggleTopicCompletion={onToggleTopicCompletion}
                    onOpenNewMessageModal={onOpenNewMessageModal}
                    onSavePlan={onSavePlan}
                    onStartReview={onStartReview}
                    onGenerateSmartReview={onGenerateSmartReview}
                    onGenerateSrsReview={onGenerateSrsReview}
                    onGenerateSmartFlashcards={onGenerateSmartFlashcards}
                    onFlashcardReview={onFlashcardReview}
                    onUpdateStudentProgress={updateStudentProgress}
                    saveQuizProgress={saveQuizProgress}
                    saveReviewProgress={saveReviewProgress}
                    handleTopicQuizComplete={handleTopicQuizComplete}
                    handleReviewQuizComplete={handleReviewQuizComplete}
                    handleDailyChallengeComplete={handleDailyChallengeComplete}
                    onAddBonusXp={addXp}
                    onPlayGame={onPlayGame}
                    onDeleteCustomGame={onDeleteCustomGame}
                    onOpenCustomGameModal={onOpenCustomGameModal}
                    onSelectTargetCargo={onSelectTargetCargo}
                    onNoteSave={onNoteSave}
                    onToggleSplitView={onToggleSplitView}
                    onSetIsSidebarCollapsed={setIsSidebarCollapsed}
                    onOpenChatModal={onOpenChatModal}
                    setView={setView}
                    setActiveChallenge={setActiveChallenge}
                    onSaveDailyChallengeAttempt={onSaveDailyChallengeAttempt}
                    handleGameComplete={handleGameComplete}
                    handleGameError={handleGameError}
                    onReportQuestion={onReportQuestion}
                    onCloseDailyChallengeResults={onCloseDailyChallengeResults}
                    onOpenCreator={onOpenCreator}
                    onStartQuiz={onStartQuiz}
                    onDeleteQuiz={onDeleteQuiz}
                    saveCustomQuizAttempt={saveCustomQuizAttempt}
                    handleCustomQuizComplete={handleCustomQuizComplete}
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

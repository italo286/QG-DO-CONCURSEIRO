import React, { useState, useEffect, useCallback } from 'react';
import { User, Subject, StudentProgress, Course, Topic, SubTopic, ReviewSession, MiniGame, Question, QuestionAttempt, CustomQuiz, DailyChallenge } from '../../types';
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

type ViewType = 'dashboard' | 'course' | 'subject' | 'topic' | 'schedule' | 'performance' | 'reviews' | 'review_quiz' | 'games' | 'daily_challenge_quiz' | 'daily_challenge_results' | 'custom_quiz_list' | 'custom_quiz_player';

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
        if (['schedule', 'performance', 'reviews', 'games', 'custom_quiz_list'].includes(view)) {
            setView('dashboard');
            return true;
        }
        if (view === 'review_quiz' || view === 'daily_challenge_quiz') {
            setView(view === 'review_quiz' ? 'reviews' : 'dashboard');
            setSelectedReview(null);
            setActiveChallenge(null);
            return true;
        }
        if (view === 'custom_quiz_player') {
            setView('custom_quiz_list');
            setActiveCustomQuiz(null);
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

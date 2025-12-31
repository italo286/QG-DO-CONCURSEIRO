
import React, { useMemo } from 'react';
import { User, Subject, StudentProgress, Course, Topic, SubTopic, ReviewSession, MiniGame, Question, QuestionAttempt, CustomQuiz, DailyChallenge, Simulado, StudyPlan, Flashcard, TeacherMessage } from '../../types';
import { DashboardHome } from './views/DashboardHome';
import { CourseView } from './views/CourseView';
import { SubjectView } from './views/SubjectView';
import { TopicView } from './views/TopicView';
import { StudentScheduler } from './StudentScheduler';
import { StudentPerformanceDashboard } from './StudentPerformanceDashboard';
import { StudentReviewsView } from './StudentReviewsView';
import { QuizView } from './QuizView';
import { DailyChallengeResultsView } from './views/DailyChallengeResultsView';
import { StudentPracticeAreaView } from './views/StudentPracticeAreaView';

type ViewType = 'dashboard' | 'course' | 'subject' | 'topic' | 'schedule' | 'performance' | 'reviews' | 'review_quiz' | 'games' | 'daily_challenge_quiz' | 'daily_challenge_results' | 'practice_area' | 'custom_quiz_player' | 'simulado_player';

interface StudentViewRouterProps {
    view: ViewType;
    isPreview?: boolean;
    currentUser: User;
    studentProgress: StudentProgress;
    allSubjects: Subject[];
    allStudents: User[];
    allStudentProgress: { [studentId: string]: StudentProgress };
    enrolledCourses: Course[];
    fullStudyPlan: StudyPlan;
    messages: TeacherMessage[];
    teacherProfiles: User[];
    selectedCourse: Course | null;
    selectedSubject: Subject | null;
    selectedTopic: Topic | null;
    selectedSubtopic: SubTopic | null;
    selectedReview: ReviewSession | null;
    activeChallenge: { type: 'review' | 'glossary' | 'portuguese', questions: Question[], sessionAttempts: QuestionAttempt[], isCatchUp?: boolean } | null;
    dailyChallengeResults: { questions: Question[], sessionAttempts: QuestionAttempt[] } | null;
    isGeneratingReview: boolean;
    isSplitView: boolean;
    isSidebarCollapsed: boolean;
    quizInstanceKey: number;
    activeCustomQuiz: CustomQuiz | null;
    activeSimulado: Simulado | null;
    isGeneratingAllChallenges: boolean;
    onAcknowledgeMessage: (messageId: string) => void;
    onCourseSelect: (course: Course) => void;
    onSubjectSelect: (subject: Subject) => void;
    onTopicSelect: (topic: Topic | SubTopic, parentTopic?: Topic) => void;
    onStartDailyChallenge: (challenge: DailyChallenge<Question>, type: 'review' | 'glossary' | 'portuguese') => void;
    onGenerateAllChallenges: () => void;
    onNavigateToTopic: (topicId: string) => void;
    onToggleTopicCompletion: (subjectId: string, topicId: string, isCompleted: boolean) => void;
    onOpenNewMessageModal: () => void;
    onSaveFullPlan: (fullPlan: StudyPlan) => Promise<void>;
    onStartReview: (session: ReviewSession) => void;
    onGenerateSmartReview: () => void;
    onGenerateSrsReview: (questions: Question[]) => void;
    onGenerateSmartFlashcards: (questions: Question[]) => Promise<void>;
    onFlashcardReview: (flashcardId: string, performance: 'good' | 'bad') => void;
    onUpdateStudentProgress: (newProgress: StudentProgress, fromState?: StudentProgress | null) => void;
    saveQuizProgress: (subjectId: string, topicId: string, attempt: QuestionAttempt) => void;
    saveReviewProgress: (reviewId: string, attempt: QuestionAttempt) => void;
    handleTopicQuizComplete: (subjectId: string, topicId: string, attempts: QuestionAttempt[]) => void;
    handleReviewQuizComplete: (reviewId: string, attempts: QuestionAttempt[]) => void;
    handleDailyChallengeComplete: (finalAttempts: QuestionAttempt[], isCatchUp?: boolean) => void;
    onAddBonusXp: (amount: number, message: string) => void;
    onPlayGame: (game: MiniGame, topicId: string) => void;
    onDeleteCustomGame: (gameId: string) => void;
    onOpenCustomGameModal: (game: MiniGame | null) => void;
    onSelectTargetCargo: (courseId: string, cargoName: string) => void;
    onNoteSave: (contentId: string, content: string) => void;
    onToggleSplitView: () => void;
    onSetIsSidebarCollapsed: (collapsed: boolean) => void;
    onOpenChatModal: () => void;
    setView: (view: ViewType) => void;
    setActiveChallenge: (challenge: any) => void;
    onSaveDailyChallengeAttempt: (type: 'review' | 'glossary' | 'portuguese', attempt: QuestionAttempt) => void;
    onReportQuestion: (subjectId: string, topicId: string, questionId: string, isTec: boolean, reason: string) => void;
    onCloseDailyChallengeResults: () => void;
    onNavigateToDailyChallengeResults: () => void;
    onOpenCreator: () => void;
    onStartQuiz: (quiz: CustomQuiz) => void;
    onDeleteQuiz: (quizId: string) => void;
    saveCustomQuizAttempt: (attempt: QuestionAttempt) => void;
    handleCustomQuizComplete: (attempts: QuestionAttempt[]) => void;
    onSaveSimulado: (simulado: Simulado) => void;
    onStartSimulado: (simulado: Simulado) => void;
    onDeleteSimulado: (simuladoId: string) => void;
    saveSimuladoAttempt: (attempt: QuestionAttempt) => void;
    handleSimuladoComplete: (attempts: QuestionAttempt[]) => void;
    handleGameComplete: (gameId: string) => void;
    handleGameError: () => void;
}

export const StudentViewRouter: React.FC<StudentViewRouterProps> = (props) => {
    if (props.isPreview && props.view !== 'dashboard') {
        return <div className="text-center text-gray-400 p-8"><p>Navegação desabilitada no modo de pré-visualização.</p></div>;
    }

    const allQuestions = useMemo(() => {
        return props.allSubjects.flatMap(subject => 
            subject.topics.flatMap(topic => 
                [
                    ...topic.questions.map(q => ({...q, subjectId: subject.id, topicId: topic.id, topicName: topic.name, subjectName: subject.name})),
                    ...(topic.tecQuestions || []).map(q => ({...q, subjectId: subject.id, topicId: topic.id, topicName: topic.name, subjectName: subject.name})),
                    ...topic.subtopics.flatMap(st => [
                        ...st.questions.map(q => ({...q, subjectId: subject.id, topicId: st.id, topicName: `${topic.name} / ${st.name}`, subjectName: subject.name})),
                        ...(st.tecQuestions || []).map(q => ({...q, subjectId: subject.id, topicId: st.id, topicName: `${topic.name} / ${st.name}`, subjectName: subject.name})),
                    ])
                ]
            )
        );
    }, [props.allSubjects]);

    const incorrectQuestions = useMemo(() => {
        const attemptedIds = new Set<string>();
        const correctIds = new Set<string>();

        const processAttempt = (attempt: QuestionAttempt) => {
            attemptedIds.add(attempt.questionId);
            if (attempt.isCorrect) correctIds.add(attempt.questionId);
        };

        Object.values(props.studentProgress.progressByTopic).forEach(subject => {
            Object.values(subject).forEach(topic => topic.lastAttempt.forEach(processAttempt));
        });

        return allQuestions.filter(q => attemptedIds.has(q.id) && !correctIds.has(q.id));
    }, [allQuestions, props.studentProgress]);

    const srsFlashcardsDue = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        const allFlashcards = props.allSubjects.flatMap(s => s.topics.flatMap(t => [...t.flashcards, ...t.subtopics.flatMap(st => st.flashcards)]));
        const dueIds = Object.entries(props.studentProgress.srsFlashcardData || {})
            .filter(([, data]) => data.nextReviewDate <= today)
            .map(([id]) => id);
        return allFlashcards.filter(f => dueIds.includes(f.id));
    }, [props.allSubjects, props.studentProgress.srsFlashcardData]);

    switch (props.view) {
        case 'dashboard': return <DashboardHome {...props} />;
        case 'course': return props.selectedCourse ? <CourseView {...props} course={props.selectedCourse} currentUserId={props.currentUser.id} /> : null;
        case 'subject': return props.selectedSubject && props.selectedCourse ? <SubjectView subject={props.selectedSubject} studentProgress={props.studentProgress} onTopicSelect={props.onTopicSelect} course={props.selectedCourse}/> : null;
        case 'topic': return props.selectedTopic && props.selectedSubject ? <TopicView {...props} selectedSubject={props.selectedSubject} selectedTopic={props.selectedTopic} studentProgress={props.studentProgress} /> : null;
        case 'schedule': return <StudentScheduler fullStudyPlan={props.fullStudyPlan} subjects={props.allSubjects} onSaveFullPlan={props.onSaveFullPlan} />;
        case 'performance': return <StudentPerformanceDashboard studentProgress={props.studentProgress} subjects={props.allSubjects} />;
        case 'reviews': return <StudentReviewsView {...props} isGenerating={props.isGeneratingReview} studentProgress={props.studentProgress} incorrectQuestions={incorrectQuestions as any} srsFlashcardsDue={srsFlashcardsDue} allQuestions={allQuestions} />;
        case 'review_quiz': return props.selectedReview ? <QuizView questions={props.selectedReview.questions} initialAttempts={props.selectedReview.attempts || []} onSaveAttempt={(a) => props.saveReviewProgress(props.selectedReview!.id, a)} onComplete={(as) => props.handleReviewQuizComplete(props.selectedReview!.id, as)} onBack={() => props.setView('reviews')} quizTitle={props.selectedReview.name} studentProgress={props.studentProgress} /> : null;
        case 'daily_challenge_quiz': return props.activeChallenge ? <QuizView key={props.quizInstanceKey} questions={props.activeChallenge.questions} initialAttempts={props.activeChallenge.sessionAttempts} onSaveAttempt={(a) => props.onSaveDailyChallengeAttempt(props.activeChallenge!.type, a)} onComplete={(as) => props.handleDailyChallengeComplete(as, props.activeChallenge?.isCatchUp)} onBack={() => { props.setView('dashboard'); props.setActiveChallenge(null); }} quizTitle={`Desafio Diário`} studentProgress={props.studentProgress} /> : null;
        case 'daily_challenge_results': return props.dailyChallengeResults ? <DailyChallengeResultsView challengeData={props.dailyChallengeResults} onBack={props.onCloseDailyChallengeResults} /> : null;
        case 'practice_area': return <StudentPracticeAreaView {...props} />;
        case 'custom_quiz_player': return props.activeCustomQuiz ? <QuizView key={props.quizInstanceKey} questions={props.activeCustomQuiz.questions} initialAttempts={props.activeCustomQuiz.attempts || []} onSaveAttempt={props.saveCustomQuizAttempt} onComplete={props.handleCustomQuizComplete} onBack={() => props.setView('practice_area')} quizTitle={props.activeCustomQuiz.name} studentProgress={props.studentProgress} /> : null;
        case 'simulado_player': return props.activeSimulado ? <QuizView key={props.quizInstanceKey} questions={props.activeSimulado.questions} initialAttempts={props.activeSimulado.attempts || []} onSaveAttempt={props.saveSimuladoAttempt} onComplete={props.handleSimuladoComplete} onBack={() => props.setView('practice_area')} quizTitle={props.activeSimulado.name} durationInSeconds={props.activeSimulado.config.durationInSeconds} studentProgress={props.studentProgress} /> : null;
        default: return <DashboardHome {...props} />;
    }
};

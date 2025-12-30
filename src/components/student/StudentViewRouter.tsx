
import React from 'react';
import {
    User, Subject, Topic, Question, StudentProgress, TeacherMessage, StudyPlan, Course, SubTopic, ReviewSession, MiniGame, QuestionAttempt, CustomQuiz, DailyChallenge, Simulado
} from '../../types';
import { getLocalDateISOString } from '../../utils';

// Import all view components
import { StudentPerformanceDashboard } from './StudentPerformanceDashboard';
import { StudentScheduler } from './StudentScheduler';
import { StudentReviewsView } from './StudentReviewsView';
import { QuizView } from './QuizView';
import { GamesView } from './views/GamesView';
import { TopicView } from './views/TopicView';
import { SubjectView } from './views/SubjectView';
import { CourseView } from './views/CourseView';
import { DashboardHome } from './views/DashboardHome';
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
    studyPlan: StudyPlan['plan'];
    weeklyRoutine: StudyPlan['weeklyRoutine'];
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

    // Callbacks
    onAcknowledgeMessage: (messageId: string) => void;
    onCourseSelect: (course: Course) => void;
    onSubjectSelect: (subject: Subject) => void;
    onTopicSelect: (topic: Topic | SubTopic, parentTopic?: Topic) => void;
    onStartDailyChallenge: (challenge: DailyChallenge<any>, type: 'review' | 'glossary' | 'portuguese', isCatchUp?: boolean) => void;
    onGenerateAllChallenges: () => void;
    onNavigateToTopic: (topicId: string) => void;
    onToggleTopicCompletion: (subjectId: string, topicId: string, isCompleted: boolean) => void;
    onOpenNewMessageModal: () => void;
    onSavePlan: (plan: StudyPlan['plan'], weeklyRoutine: StudyPlan['weeklyRoutine']) => Promise<void>;
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
    setActiveChallenge: (challenge: { type: 'review' | 'glossary' | 'portuguese', questions: Question[], sessionAttempts: QuestionAttempt[], isCatchUp?: boolean } | null) => void;
    onSaveDailyChallengeAttempt: (challengeType: 'review' | 'glossary' | 'portuguese', attempt: QuestionAttempt) => void;
    handleGameComplete: (gameId: string) => void;
    handleGameError: () => void;
    onReportQuestion: (subjectId: string, topicId: string, questionId: string, isTec: boolean, reason: string) => void;
    onCloseDailyChallengeResults: () => void;
    onNavigateToDailyChallengeResults?: () => void;
    onOpenCreator: () => void;
    onStartQuiz: (quiz: CustomQuiz) => void;
    onDeleteQuiz: (quizId: string) => void;
    saveCustomQuizAttempt: (attempt: QuestionAttempt) => void;
    handleCustomQuizComplete: (finalAttempts: QuestionAttempt[]) => void;
    onSaveSimulado: (simulado: Simulado) => void;
    onStartSimulado: (simulado: Simulado) => void;
    onDeleteSimulado: (simuladoId: string) => void;
    saveSimuladoAttempt: (attempt: QuestionAttempt) => void;
    handleSimuladoComplete: (finalAttempts: QuestionAttempt[]) => void;
}

export const StudentViewRouter: React.FC<StudentViewRouterProps> = (props) => {
    if (props.isPreview && props.view !== 'dashboard') {
        return (
            <div className="text-center text-gray-400 p-8">
                <p>Navegação desabilitada no modo de pré-visualização.</p>
            </div>
        );
    }

    const incorrectQuestions = React.useMemo(() => {
        if (!props.studentProgress) return [];
        const correctQuestionIds = new Set<string>();
        const incorrectQuestionIds = new Set<string>();
        const allAttempts = [
            ...Object.values(props.studentProgress.progressByTopic).flatMap((s: any) => Object.values(s).flatMap((t: any) => t.lastAttempt)),
            ...props.studentProgress.reviewSessions.flatMap(r => r.attempts || [])
        ];
        allAttempts.forEach(attempt => {
            if (attempt.isCorrect) correctQuestionIds.add(attempt.questionId);
            else incorrectQuestionIds.add(attempt.questionId);
        });
        const finalIncorrectIds = Array.from(incorrectQuestionIds).filter(id => !correctQuestionIds.has(id));
        const allQuestionsWithContext = props.allSubjects.flatMap(subject =>
            subject.topics.flatMap(topic =>
                [
                    ...topic.questions.map(q => ({ ...q, subjectId: subject.id, topicId: topic.id, topicName: topic.name, subjectName: subject.name })),
                    ...(topic.tecQuestions || []).map(q => ({ ...q, subjectId: subject.id, topicId: topic.id, topicName: topic.name, subjectName: subject.name })),
                    ...topic.subtopics.flatMap(st => [
                        ...st.questions.map(q => ({ ...q, subjectId: subject.id, topicId: st.id, topicName: `${topic.name} / ${st.name}`, subjectName: subject.name })),
                        ...(st.tecQuestions || []).map(q => ({ ...q, subjectId: subject.id, topicId: st.id, topicName: `${topic.name} / ${st.name}`, subjectName: subject.name })),
                    ])
                ]
            )
        );
        return allQuestionsWithContext.filter(q => finalIncorrectIds.includes(q.id));
    }, [props.studentProgress, props.allSubjects]);

    const srsFlashcardsDue = React.useMemo(() => {
        const today = getLocalDateISOString(new Date());
        const allFlashcards = [
            ...(props.studentProgress?.aiGeneratedFlashcards || []),
            ...props.allSubjects.flatMap(s => s.topics.flatMap(t => [...(t.flashcards || []), ...t.subtopics.flatMap(st => st.flashcards || [])]))
        ];
        const uniqueFlashcards = allFlashcards.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
        if (!props.studentProgress?.srsFlashcardData) return [];
        return uniqueFlashcards.filter(fc => {
            const srsData = props.studentProgress.srsFlashcardData![fc.id];
            return srsData && srsData.nextReviewDate <= today;
        });
    }, [props.studentProgress, props.allSubjects]);

    const allQuestions = React.useMemo(() => {
        return props.allSubjects.flatMap(s => s.topics.flatMap(t => [...t.questions, ...(t.tecQuestions || []), ...t.subtopics.flatMap(st => [...st.questions, ...(st.tecQuestions || [])])]));
    }, [props.allSubjects]);


    switch (props.view) {
        case 'dashboard':
            return <DashboardHome {...props} />;
        case 'course':
            if (!props.selectedCourse) return null;
            return <CourseView {...props} course={props.selectedCourse} currentUserId={props.currentUser.id} />;
        case 'subject':
            if (!props.selectedSubject || !props.selectedCourse) return null;
            return <SubjectView subject={props.selectedSubject} studentProgress={props.studentProgress} onTopicSelect={props.onTopicSelect} course={props.selectedCourse}/>;
        case 'topic':
            if (!props.selectedTopic || !props.selectedSubject) return null;
            return <TopicView {...props} selectedSubject={props.selectedSubject} selectedTopic={props.selectedTopic} />;
        case 'schedule':
            return <StudentScheduler studyPlan={props.studyPlan} weeklyRoutine={props.weeklyRoutine} subjects={props.allSubjects} studentProgress={props.studentProgress} onSavePlan={props.onSavePlan} enrolledCourses={props.enrolledCourses} />;
        case 'performance':
            return <StudentPerformanceDashboard studentProgress={props.studentProgress} subjects={props.allSubjects} />;
        case 'reviews':
            return <StudentReviewsView {...props} isGenerating={props.isGeneratingReview} incorrectQuestions={incorrectQuestions} srsFlashcardsDue={srsFlashcardsDue} allQuestions={allQuestions} />;
        case 'review_quiz':
            if (!props.selectedReview) return null;
            return <QuizView
                questions={props.selectedReview.questions}
                initialAttempts={props.selectedReview.attempts || []}
                onSaveAttempt={(attempt) => props.saveReviewProgress(props.selectedReview!.id, attempt)}
                onComplete={(attempts) => props.handleReviewQuizComplete(props.selectedReview!.id, attempts)}
                onBack={() => props.setView('reviews')}
                quizTitle={props.selectedReview.name}
                subjectName={props.selectedReview.type === 'ai' ? 'Revisão Inteligente' : props.selectedReview.type === 'srs' ? 'Revisão Diária' : "Revisão"}
                onAddBonusXp={props.onAddBonusXp}
            />;
        case 'daily_challenge_quiz':
            if (!props.activeChallenge) return null;
            return <QuizView
                key={props.quizInstanceKey}
                questions={props.activeChallenge.questions}
                initialAttempts={props.activeChallenge.sessionAttempts}
                onSaveAttempt={(attempt) => props.onSaveDailyChallengeAttempt(props.activeChallenge!.type, attempt)}
                onComplete={(attempts) => props.handleDailyChallengeComplete(attempts, props.activeChallenge?.isCatchUp)}
                onBack={() => { props.setView('dashboard'); props.setActiveChallenge(null); }}
                quizTitle={`Desafio Diário: ${props.activeChallenge.type === 'review' ? 'Revisão' : props.activeChallenge.type === 'glossary' ? 'Glossário' : 'Português'}`}
                subjectName="Desafio Diário"
                onAddBonusXp={props.onAddBonusXp}
                isDailyChallenge={true}
                dailyChallengeType={props.activeChallenge.type}
                hideBackButtonOnResults={true}
                onNavigateToDailyChallengeResults={props.onNavigateToDailyChallengeResults}
                onReportQuestion={props.activeChallenge.type === 'review' 
                    ? (question, reason) => {
                        if (question.subjectId && question.topicId) {
                            props.onReportQuestion(question.subjectId, question.topicId, question.id, !!question.isTec, reason);
                        }
                    } 
                    : undefined}
            />;
        case 'daily_challenge_results':
            if (!props.dailyChallengeResults) return null;
            return <DailyChallengeResultsView challengeData={props.dailyChallengeResults} onBack={props.onCloseDailyChallengeResults} />;
        case 'games':
            return <GamesView {...props} />;
        case 'practice_area':
            return <StudentPracticeAreaView {...props} />;
        case 'custom_quiz_player':
            if (!props.activeCustomQuiz) return null;
            return <QuizView
                key={props.quizInstanceKey}
                questions={props.activeCustomQuiz.questions}
                initialAttempts={props.activeCustomQuiz.attempts || []}
                onSaveAttempt={props.saveCustomQuizAttempt}
                onComplete={props.handleCustomQuizComplete}
                onBack={() => props.setView('practice_area')}
                quizTitle={props.activeCustomQuiz.name}
                subjectName="Quiz Personalizado"
                onAddBonusXp={props.onAddBonusXp}
            />;
        case 'simulado_player':
            if (!props.activeSimulado) return null;
            return <QuizView
                key={props.quizInstanceKey}
                questions={props.activeSimulado.questions}
                initialAttempts={props.activeSimulado.attempts || []}
                onSaveAttempt={props.saveSimuladoAttempt}
                onComplete={props.handleSimuladoComplete}
                onBack={() => props.setView('practice_area')}
                quizTitle={props.activeSimulado.name}
                subjectName="Simulado Personalizado"
                onAddBonusXp={props.onAddBonusXp}
                durationInSeconds={props.activeSimulado.config.durationInSeconds}
                feedbackMode={props.activeSimulado.config.feedbackMode}
            />;
        default:
            return <DashboardHome {...props} />;
    }
};

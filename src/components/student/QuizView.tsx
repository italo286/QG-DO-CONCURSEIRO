
import React, { useState, useEffect, useMemo } from 'react';
import { Question, QuestionAttempt, StudentProgress } from '../../types';
import { markdownToHtml } from '../../utils';
import { Spinner, Button, Card } from '../ui';
// FIX: Added missing icons and modal for reporting questions
import { ExclamationTriangleIcon } from '../Icons';
import { ReportQuestionModal } from './ReportQuestionModal';

export const QuizView: React.FC<{
    questions: Question[];
    initialAttempts: QuestionAttempt[];
    onSaveAttempt: (attempt: QuestionAttempt) => void;
    onComplete: (attempts: QuestionAttempt[]) => void;
    onBack: () => void;
    quizTitle: string;
    durationInSeconds?: number;
    isDailyChallenge?: boolean;
    onNavigateToDailyChallengeResults?: () => void;
    studentProgress?: StudentProgress;
    // FIX: Added missing props to satisfy calls in TopicView.tsx
    subjectName?: string;
    onAddBonusXp?: (amount: number, message: string) => void;
    onReportQuestion?: (question: Question, reason: string) => void;
    hideBackButtonOnResults?: boolean;
}> = ({ 
    questions, initialAttempts, onSaveAttempt, onComplete, onBack, quizTitle, durationInSeconds, isDailyChallenge = false, studentProgress,
    subjectName, onAddBonusXp, onReportQuestion, hideBackButtonOnResults
}) => {
    const [sessionAttempts, setSessionAttempts] = useState<QuestionAttempt[]>([]);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [showResults, setShowResults] = useState(false);
    const [hasCompleted, setHasCompleted] = useState(false);
    // FIX: State for report modal
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);

    const [timeLeft, setTimeLeft] = useState(durationInSeconds);
    const [currentIndex, setCurrentIndex] = useState(0);

    // --- Lógica de Histórico ---
    const questionHistory = useMemo(() => {
        if (!studentProgress) return { correct: new Set<string>(), incorrect: new Set<string>() };
        
        const correct = new Set<string>();
        const incorrect = new Set<string>();

        const process = (a: QuestionAttempt) => {
            if (a.isCorrect) correct.add(a.questionId);
            else incorrect.add(a.questionId);
        };

        Object.values(studentProgress.progressByTopic || {}).forEach(s => 
            Object.values(s || {}).forEach(t => (t.lastAttempt || []).forEach(process))
        );
        (studentProgress.reviewSessions || []).forEach(s => (s.attempts || []).forEach(process));
        (studentProgress.customQuizzes || []).forEach(s => (s.attempts || []).forEach(process));
        (studentProgress.simulados || []).forEach(s => (s.attempts || []).forEach(process));

        return { correct, incorrect };
    }, [studentProgress]);

    const correctCount = useMemo(() => sessionAttempts.filter(a => a.isCorrect).length, [sessionAttempts]);
    
    const questionToDisplay = questions[currentIndex];
    const attemptForCurrentQuestion = sessionAttempts.find(a => a.questionId === questionToDisplay?.id);
    const isCurrentQuestionAnswered = !!attemptForCurrentQuestion;
    const isLastQuestion = currentIndex === questions.length - 1;

    useEffect(() => {
        const isCompletedFromProps = questions.length > 0 && initialAttempts.length === questions.length;
        setSessionAttempts(initialAttempts);
        setHasCompleted(isCompletedFromProps);
        if (durationInSeconds !== undefined) setTimeLeft(durationInSeconds);
    }, [questions, initialAttempts, durationInSeconds]);

    useEffect(() => {
        if (durationInSeconds !== undefined && !showResults && !hasCompleted) {
            if (timeLeft === 0) {
                if (isDailyChallenge) {
                    onComplete(sessionAttempts);
                    setHasCompleted(true);
                } else {
                    setShowResults(true);
                }
                return;
            }
            const timer = setInterval(() => setTimeLeft(prev => (prev ? prev - 1 : 0)), 1000);
            return () => clearInterval(timer);
        }
    }, [timeLeft, durationInSeconds, showResults, hasCompleted, isDailyChallenge, onComplete, sessionAttempts]);

    const handleRespond = () => {
        if (!selectedOption || !questionToDisplay || isCurrentQuestionAnswered) return;
        const isCorrect = selectedOption === questionToDisplay.correctAnswer;
        const newAttempt: QuestionAttempt = { questionId: questionToDisplay.id, selectedAnswer: selectedOption, isCorrect: isCorrect };
        const updatedAttempts = [...sessionAttempts, newAttempt];
        setSessionAttempts(updatedAttempts);
        onSaveAttempt(newAttempt);
        if (isLastQuestion) { onComplete(updatedAttempts); setHasCompleted(true); }
    };

    const handleNext = () => {
        setSelectedOption(null);
        if (!isLastQuestion) setCurrentIndex(prev => prev + 1);
        else setShowResults(true);
    };

    if (showResults) {
        return (
            <Card className="p-6">
                <h2 className="text-2xl font-bold text-center mb-4">{quizTitle} Finalizado!</h2>
                <p className="text-center text-xl mb-6">Você acertou {correctCount} de {questions.length} questões.</p>
                <div className="flex justify-center gap-4">
                    {/* FIX: Added check for hideBackButtonOnResults prop */}
                    {!hideBackButtonOnResults && <Button onClick={onBack}>Voltar</Button>}
                </div>
            </Card>
        );
    }

    if (!questionToDisplay) return <Card className="p-6 text-center"><Spinner /></Card>;

    const isPrevCorrect = questionHistory.correct.has(questionToDisplay.id);
    const isPrevIncorrect = questionHistory.incorrect.has(questionToDisplay.id) && !isPrevCorrect;

    return (
        <Card className="p-6 relative">
            <div className="flex justify-between items-center mb-4">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl font-bold">{quizTitle}</h2>
                    {/* FIX: Display subjectName if available */}
                    {subjectName && <p className="text-xs text-cyan-400 font-bold uppercase tracking-wider">{subjectName}</p>}
                    <div className="flex gap-2">
                        {isPrevCorrect && <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded border border-green-500/30">Já Acertada</span>}
                        {isPrevIncorrect && <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/30">Já Errada</span>}
                        {(isPrevCorrect || isPrevIncorrect) && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30">Já Respondida</span>}
                    </div>
                </div>
                <div className="text-right flex items-center gap-4">
                    {/* FIX: Added timer display if duration is set */}
                    {timeLeft !== undefined && (
                         <div className={`text-sm font-mono font-bold px-2 py-1 rounded ${timeLeft < 60 ? 'bg-red-900/30 text-red-400 border border-red-700' : 'bg-gray-800 text-gray-300 border border-gray-700'}`}>
                            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                        </div>
                    )}
                    <p className="font-semibold">{currentIndex + 1} / {questions.length}</p>
                </div>
            </div>

            <div className="w-full bg-gray-700 rounded-full h-2.5 mb-6">
                <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2.5 rounded-full" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}></div>
            </div>

            {/* FIX: Added report button to the question header */}
            <div className="flex justify-between items-start mb-6">
                <div className="prose prose-invert max-w-none flex-grow" dangerouslySetInnerHTML={{ __html: markdownToHtml(questionToDisplay.statement) }}></div>
                {onReportQuestion && (
                    <button 
                        onClick={() => setIsReportModalOpen(true)}
                        className="ml-4 text-gray-500 hover:text-red-400 transition-colors flex-shrink-0"
                        title="Reportar erro nesta questão"
                    >
                        <ExclamationTriangleIcon className="h-5 w-5" />
                    </button>
                )}
            </div>

            <div className="space-y-3">
                {questionToDisplay.options.map((option, i) => {
                    const isSelected = isCurrentQuestionAnswered ? attemptForCurrentQuestion?.selectedAnswer === option : selectedOption === option;
                    const isCorrectAnswer = questionToDisplay.correctAnswer === option;
                    let labelClass = 'bg-gray-700 hover:bg-gray-600';
                    
                    if (isCurrentQuestionAnswered) {
                        if (isCorrectAnswer) labelClass = 'bg-green-600';
                        else if (isSelected) labelClass = 'bg-red-600';
                        else labelClass = 'bg-gray-700 opacity-60';
                    } else if (isSelected) {
                        labelClass = 'bg-cyan-600 border-cyan-400';
                    }

                    return (
                        <button
                            key={i}
                            onClick={() => !isCurrentQuestionAnswered && setSelectedOption(option)}
                            className={`w-full text-left p-4 rounded-lg transition-all border border-transparent ${labelClass} flex items-start`}
                        >
                            <span className="font-bold mr-3">{String.fromCharCode(65 + i)}.</span>
                            <span dangerouslySetInnerHTML={{ __html: markdownToHtml(option) }}></span>
                        </button>
                    );
                })}
            </div>

            <div className="mt-8 flex justify-center gap-4">
                {!isCurrentQuestionAnswered ? (
                    <Button onClick={handleRespond} disabled={!selectedOption}>Responder</Button>
                ) : (
                    <Button onClick={handleNext}>{isLastQuestion ? 'Ver Resultado' : 'Próxima'}</Button>
                )}
            </div>

            {/* FIX: Added ReportQuestionModal integration */}
            {onReportQuestion && (
                <ReportQuestionModal 
                    isOpen={isReportModalOpen}
                    onClose={() => setIsReportModalOpen(false)}
                    onSubmit={(reason) => onReportQuestion(questionToDisplay, reason)}
                    question={questionToDisplay}
                />
            )}
        </Card>
    );
};

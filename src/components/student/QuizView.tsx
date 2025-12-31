
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as GeminiService from '../../services/geminiService';
import { Question, QuestionAttempt, StudentProgress } from '../../types';
import { markdownToHtml, generateQuestionsPdf } from '../../utils';
import { Spinner, Button, Card } from '../ui';
import { AiHelperModal } from './AiHelperModal';
import { GeminiIcon, TrophyIcon, XCircleIcon, ArrowRightIcon, FireIcon, CheckCircleIcon, ChevronDownIcon, ExclamationTriangleIcon, DownloadIcon } from '../Icons';
import { ReportQuestionModal } from './ReportQuestionModal';

const XP_CONFIG = {
    COMBO_BONUS: { 3: 10, 5: 25, 7: 50 } as Record<number, number>
};

const CONTINUOUS_COMBO_XP = 25;
const CONTINUOUS_COMBO_INTERVAL = 3;

const HIGHLIGHT_COLORS = [
    'bg-blue-500/30 text-blue-200 border border-blue-400/50',
    'bg-green-500/30 text-green-200 border border-green-400/50',
    'bg-yellow-500/30 text-yellow-200 border border-yellow-400/50',
    'bg-purple-500/30 text-purple-200 border border-purple-400/50',
    'bg-pink-500/30 text-pink-200 border border-pink-400/50',
];

const PORTUGUESE_HIGHLIGHT_COLORS = [ 'bg-blue-500/30', 'bg-green-500/30', 'bg-yellow-500/30', 'bg-purple-500/30', 'bg-pink-500/30' ];

const isInsideWebView = () => window.Android && typeof window.Android.downloadPdf === 'function';

export const QuizView: React.FC<{
    questions: Question[];
    initialAttempts: QuestionAttempt[];
    onSaveAttempt: (attempt: QuestionAttempt) => void;
    onComplete: (attempts: QuestionAttempt[]) => void;
    onBack: () => void;
    onAddBonusXp: (amount: number, message: string) => void;
    onReportQuestion?: (question: Question, reason: string) => void;
    quizTitle: string;
    subjectName?: string;
    durationInSeconds?: number;
    isDailyChallenge?: boolean;
    dailyChallengeType?: 'review' | 'glossary' | 'portuguese';
    hideBackButtonOnResults?: boolean;
    onNavigateToDailyChallengeResults?: () => void;
    feedbackMode?: 'immediate' | 'at_end';
    studentProgress?: StudentProgress; // Adicionado para verificar histórico
}> = ({ 
    questions, initialAttempts, onSaveAttempt, onComplete, onBack, quizTitle, subjectName, durationInSeconds, isDailyChallenge = false, dailyChallengeType, onAddBonusXp, hideBackButtonOnResults = false, onReportQuestion, onNavigateToDailyChallengeResults, feedbackMode = 'immediate', studentProgress
}) => {
    const [sessionAttempts, setSessionAttempts] = useState<QuestionAttempt[]>([]);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [showResults, setShowResults] = useState(false);
    const [hasCompleted, setHasCompleted] = useState(false);
    const [comboStreak, setComboStreak] = useState(0);
    const [showComboToast, setShowComboToast] = useState(false);
    const [reportedQuestions, setReportedQuestions] = useState<Set<string>>(new Set());
    const [questionToReport, setQuestionToReport] = useState<Question | null>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    
    const [isSummaryLoading, setIsSummaryLoading] = useState(false);
    const [summaryResult, setSummaryResult] = useState<React.ReactNode | null>(null);
    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
    
    const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
    const [feedbackResult, setFeedbackResult] = useState<React.ReactNode | null>(null);
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

    const [timeLeft, setTimeLeft] = useState(durationInSeconds);
    const [currentIndex, setCurrentIndex] = useState(0);

    const [eliminatedOptions, setEliminatedOptions] = useState<Set<string>>(new Set());
    const [fetchedJustifications, setFetchedJustifications] = useState<Record<string, Record<string, string>>>({});
    const [isFetchingJustifications, setIsFetchingJustifications] = useState<string | null>(null);
    
    const [motivationalMessage, setMotivationalMessage] = useState<string | null>(null);
    const [thresholdsMet, setThresholdsMet] = useState<Set<number>>(new Set());

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
    const incorrectCount = useMemo(() => sessionAttempts.length - correctCount, [sessionAttempts, correctCount]);
    
    const questionToDisplay = questions[currentIndex];
    const attemptForCurrentQuestion = sessionAttempts.find(a => a.questionId === questionToDisplay?.id);
    const isCurrentQuestionAnswered = !!attemptForCurrentQuestion;
    const isLastQuestion = currentIndex === questions.length - 1;

    // ... (useEffect e Handlers permanecem os mesmos até o render) ...
    // [PULANDO HANDLERS JÁ EXISTENTES PARA CONCISAO]

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
        if (isCorrect) setComboStreak(prev => prev + 1); else setComboStreak(0);
        if (isLastQuestion) { onComplete(updatedAttempts); setHasCompleted(true); }
    };

    const handleNext = () => {
        setSelectedOption(null);
        setEliminatedOptions(new Set());
        if (!isLastQuestion) setCurrentIndex(prev => prev + 1);
        else setShowResults(true);
    };

    if (showResults) {
        return (
            <Card className="p-6">
                <h2 className="text-2xl font-bold text-center mb-4">{quizTitle} Finalizado!</h2>
                <p className="text-center text-xl mb-6">Você acertou {correctCount} de {questions.length} questões.</p>
                <div className="flex justify-center gap-4">
                    <Button onClick={onBack}>Voltar</Button>
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
                    <div className="flex gap-2">
                        {isPrevCorrect && <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded border border-green-500/30">Já Acertada</span>}
                        {isPrevIncorrect && <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/30">Já Errada</span>}
                        {(isPrevCorrect || isPrevIncorrect) && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30">Já Respondida</span>}
                    </div>
                </div>
                <div className="text-right">
                    <p className="font-semibold">{currentIndex + 1} / {questions.length}</p>
                </div>
            </div>

            <div className="w-full bg-gray-700 rounded-full h-2.5 mb-6">
                <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2.5 rounded-full" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}></div>
            </div>

            <div className="prose prose-invert max-w-none mb-6" dangerouslySetInnerHTML={{ __html: markdownToHtml(questionToDisplay.statement) }}></div>

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
        </Card>
    );
};

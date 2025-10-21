import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as GeminiService from '../../services/geminiService';
import { Question, QuestionAttempt } from '../../types';
import { markdownToHtml, generateQuestionsPdf } from '../../utils';
import { Spinner, Button, Card } from '../ui';
import { AiHelperModal } from './AiHelperModal';
import { GeminiIcon, TrophyIcon, XCircleIcon, ArrowRightIcon, FireIcon, CheckCircleIcon, ChevronDownIcon, ExclamationTriangleIcon, DownloadIcon } from '../Icons';
import { ReportQuestionModal } from './ReportQuestionModal';

const XP_CONFIG = {
    COMBO_BONUS: {
        3: 10,
        5: 25,
        7: 50
    } as Record<number, number>
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

const PORTUGUESE_HIGHLIGHT_COLORS = [
    'bg-blue-500/30',
    'bg-green-500/30',
    'bg-yellow-500/30',
    'bg-purple-500/30',
    'bg-pink-500/30',
];

const isInsideWebView = () => {
    return window.Android && typeof window.Android.downloadPdf === 'function';
};

const ComboProgressBar: React.FC<{ streak: number }> = ({ streak }) => {
    if (streak <= 0) return null;

    let goal: number;
    let progress: number;
    let previousMilestone: number;
    let nextBonus: number | null = null;
    let message: string;

    if (streak < 3) {
        goal = 3;
        previousMilestone = 0;
        nextBonus = XP_CONFIG.COMBO_BONUS[3];
        progress = (streak / goal) * 100;
        message = `Acerte mais ${goal - streak} para +${nextBonus} XP!`;
    } else if (streak < 5) {
        goal = 5;
        previousMilestone = 3;
        nextBonus = XP_CONFIG.COMBO_BONUS[5];
        progress = ((streak - previousMilestone) / (goal - previousMilestone)) * 100;
        message = `Acerte mais ${goal - streak} para +${nextBonus} XP!`;
    } else if (streak < 7) {
        goal = 7;
        previousMilestone = 5;
        nextBonus = XP_CONFIG.COMBO_BONUS[7];
        progress = ((streak - previousMilestone) / (goal - previousMilestone)) * 100;
        message = `Acerte mais ${goal - streak} para +${nextBonus} XP!`;
    } else { // streak >= 7
        const streakAfter7 = streak - 7;
        const stepsAfter7 = Math.floor(streakAfter7 / CONTINUOUS_COMBO_INTERVAL);
        goal = 7 + (stepsAfter7 + 1) * CONTINUOUS_COMBO_INTERVAL;
        previousMilestone = 7 + stepsAfter7 * CONTINUOUS_COMBO_INTERVAL;
        nextBonus = CONTINUOUS_COMBO_XP;

        progress = ((streak - previousMilestone) / (goal - previousMilestone)) * 100;
        const needed = goal - streak;
        message = `Em chamas! Acerte mais ${needed} para +${nextBonus} XP Bônus!`;
    }

    return (
        <div className="flex items-center gap-3 p-2 bg-gray-800/50 rounded-lg">
            <FireIcon className="h-6 w-6 text-orange-400 animate-pulse" />
            <div className="w-full bg-gray-700 rounded-full h-4 relative overflow-hidden">
                <div 
                    className="bg-gradient-to-r from-orange-400 to-red-500 h-4 rounded-full transition-all duration-300 flex items-center justify-end pr-2" 
                    style={{ width: `${progress}%` }}
                >
                </div>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-md">
                   {streak >= 7 ? `🔥 Combo x${streak}` : `${streak} / ${goal}`}
                </span>
            </div>
            <span className="text-sm font-semibold text-orange-300 whitespace-nowrap">{message}</span>
        </div>
    );
};


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
}> = ({ 
    questions, initialAttempts, onSaveAttempt, onComplete, onBack, quizTitle, subjectName, durationInSeconds, isDailyChallenge = false, dailyChallengeType, onAddBonusXp, hideBackButtonOnResults = false, onReportQuestion, onNavigateToDailyChallengeResults, feedbackMode = 'immediate'
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


    const correctCount = useMemo(() => sessionAttempts.filter(a => a.isCorrect).length, [sessionAttempts]);
    const incorrectCount = useMemo(() => sessionAttempts.length - correctCount, [sessionAttempts, correctCount]);
    
    const correctlyAnsweredQuestions = useMemo(() => {
        return sessionAttempts
            .filter(a => a.isCorrect)
            .map(a => ({
                attempt: a,
                question: questions.find(q => q.id === a.questionId)
            }))
            .filter((item): item is { attempt: QuestionAttempt; question: Question } => !!item.question);
    }, [sessionAttempts, questions]);

    const incorrectlyAnsweredQuestions = useMemo(() => {
        return sessionAttempts
            .filter(a => !a.isCorrect)
            .map(a => ({
                attempt: a,
                question: questions.find(q => q.id === a.questionId)
            }))
            .filter((item): item is { attempt: QuestionAttempt; question: Question } => !!item.question);
    }, [sessionAttempts, questions]);


    const prevQuizIdRef = useRef<string | null>(null);
    const quizId = useMemo(() => questions.length > 0 ? questions.map(q => q.id).join(',') : null, [questions]);

    useEffect(() => {
        const isCompletedFromProps = questions.length > 0 && initialAttempts.length === questions.length;
        const isNewQuiz = prevQuizIdRef.current !== quizId;

        if (isNewQuiz) {
            prevQuizIdRef.current = quizId;

            // Full reset for a new quiz
            setShowResults(isDailyChallenge ? false : isCompletedFromProps);
            setCurrentIndex(isCompletedFromProps ? 0 : initialAttempts.length);
            
            // Reset UI and other secondary state
            setSelectedOption(null);
            setTimeLeft(durationInSeconds);
            setComboStreak(0);
            setMotivationalMessage(null);
            setThresholdsMet(new Set());
            setShowComboToast(false);
            setEliminatedOptions(new Set());
            setFetchedJustifications({});
            setIsFetchingJustifications(null);
            setReportedQuestions(new Set());
            setQuestionToReport(null);
        }

        // Always sync these states with props
        setSessionAttempts(initialAttempts);
        setHasCompleted(isCompletedFromProps);

    }, [questions, initialAttempts, durationInSeconds, isDailyChallenge, quizId]);
    
    useEffect(() => {
        if (motivationalMessage) {
            const timer = setTimeout(() => {
                setMotivationalMessage(null);
            }, 4000); // Message disappears after 4 seconds
            return () => clearTimeout(timer);
        }
    }, [motivationalMessage]);

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
            const timer = setInterval(() => {
                setTimeLeft(prev => (prev ? prev - 1 : 0));
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [timeLeft, durationInSeconds, showResults, hasCompleted, isDailyChallenge, onComplete, sessionAttempts]);

    useEffect(() => {
        if (showResults && !hasCompleted) {
            onComplete(sessionAttempts);
            setHasCompleted(true);
        }
    }, [showResults, hasCompleted, onComplete, sessionAttempts]);
    
    const questionToDisplay = questions[currentIndex];
    const attemptForCurrentQuestion = sessionAttempts.find(a => a.questionId === questionToDisplay?.id);
    const isCurrentQuestionAnswered = !!attemptForCurrentQuestion;
    const isLastQuestion = currentIndex === questions.length - 1;

    const handleRespond = () => {
        if (!selectedOption || !questionToDisplay || isCurrentQuestionAnswered) return;

        const isCorrect = selectedOption === questionToDisplay.correctAnswer;
        const newAttempt: QuestionAttempt = {
            questionId: questionToDisplay.id,
            selectedAnswer: selectedOption,
            isCorrect: isCorrect,
        };
        
        const updatedAttempts = [...sessionAttempts, newAttempt];
        setSessionAttempts(updatedAttempts);
        onSaveAttempt(newAttempt);
        
        if (feedbackMode === 'at_end') {
            if (isLastQuestion) {
                setShowResults(true);
            } else {
                handleNext();
            }
            return;
        }

        setMotivationalMessage(null);
        setTimeout(() => {
            let message: string | null = null;
    
            if (isCorrect) {
                message = 'Mandou bem! Resposta correta!';
                
                const newCorrectCount = correctCount + 1;
                const newTotal = sessionAttempts.length + 1;
                const newScore = newCorrectCount / newTotal;
    
                if (newScore >= 0.9 && !thresholdsMet.has(90)) {
                    message = 'Uau! Desempenho excelente, acima de 90% de acertos!';
                    setThresholdsMet(prev => new Set(prev).add(90));
                } else if (newScore >= 0.7 && !thresholdsMet.has(70)) {
                    message = 'Ótimo trabalho! Você já acertou mais de 70% das questões!';
                    setThresholdsMet(prev => new Set(prev).add(70));
                }
    
            } else { // Incorrect answer
                message = 'Não desanime, o erro faz parte do aprendizado!';
            }
    
            setMotivationalMessage(message);
        }, 400);

        if (isCorrect) {
            const newStreak = comboStreak + 1;
            setComboStreak(newStreak);

            let bonusXp = 0;
            if (XP_CONFIG.COMBO_BONUS[newStreak]) {
                bonusXp = XP_CONFIG.COMBO_BONUS[newStreak];
            } else if (newStreak > 7 && (newStreak - 7) % CONTINUOUS_COMBO_INTERVAL === 0) {
                bonusXp = CONTINUOUS_COMBO_XP;
            }

            if (bonusXp > 0) {
                onAddBonusXp(bonusXp, `Combo x${newStreak}! +${bonusXp} XP Bônus 🔥`);
                setShowComboToast(true);
                setTimeout(() => setShowComboToast(false), 2000);
            }
        } else {
            setComboStreak(0);
        }

        if (isLastQuestion) {
            onComplete(updatedAttempts);
            setHasCompleted(true);
        }
    };

    const handleNext = () => {
        setSelectedOption(null);
        setEliminatedOptions(new Set());
        setMotivationalMessage(null);
        if (!isLastQuestion) {
            setCurrentIndex(prev => prev + 1);
        } else {
            setShowResults(true);
        }
    };
    
    const handlePrevious = () => {
        setSelectedOption(null);
        setEliminatedOptions(new Set());
        setMotivationalMessage(null);
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    const handleGoToLastAnswered = () => {
        const answeredQuestionIds = new Set(sessionAttempts.map(a => a.questionId));
        if (answeredQuestionIds.size === 0) return;

        for (let i = questions.length - 1; i >= 0; i--) {
            if (answeredQuestionIds.has(questions[i].id)) {
                if (i !== currentIndex) {
                    setCurrentIndex(i);
                    setSelectedOption(null);
                    setEliminatedOptions(new Set());
                }
                return; 
            }
        }
    };

    const handleReportSubmit = (reason: string) => {
        if (onReportQuestion && questionToReport) {
            onReportQuestion(questionToReport, reason);
            setReportedQuestions(prev => new Set(prev).add(questionToReport.id));
        }
        setQuestionToReport(null);
    };

    const handleGenerateSummary = async () => {
        const incorrectQuestions = sessionAttempts
            .filter(a => !a.isCorrect)
            .map(a => questions.find(q => q.id === a.questionId))
            .filter((q): q is Question => q !== undefined);
            
        if (incorrectQuestions.length === 0) return;

        setIsSummaryLoading(true);
        setSummaryResult(null);
        setIsSummaryModalOpen(true);
        try {
            const resultText = await GeminiService.generateReviewSummaryForIncorrectQuestions(incorrectQuestions);
            const resultNode = <div className="bg-white text-gray-900 p-4 rounded-lg prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: markdownToHtml(resultText) }} />;
            setSummaryResult(resultNode);
        } catch(e: any) {
            setSummaryResult(<p className="text-red-400">{e.message}</p>);
        } finally {
            setIsSummaryLoading(false);
        }
    };

    const handleGenerateFeedback = async () => {
        setIsFeedbackLoading(true);
        setFeedbackResult(null);
        setIsFeedbackModalOpen(true);
        try {
            const resultText = await GeminiService.generateQuizFeedback(questions, sessionAttempts);
            const resultNode = <div className="bg-white text-gray-900 p-4 rounded-lg prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: markdownToHtml(resultText) }} />;
            setFeedbackResult(resultNode);
        } catch (e: any) {
            setFeedbackResult(<p className="text-red-400">{e.message}</p>);
        } finally {
            setIsFeedbackLoading(false);
        }
    };

    const handleGenerateJustifications = async (question: Question) => {
        setIsFetchingJustifications(question.id);
        try {
            const justifications = await GeminiService.generateJustificationsForQuestion(question);
            setFetchedJustifications(prev => ({ ...prev, [question.id]: justifications }));
        } catch (error) {
            console.error("Failed to fetch justifications", error);
            alert("Não foi possível gerar as justificativas. Tente novamente.");
        } finally {
            setIsFetchingJustifications(null);
        }
    };

    const handleDoubleClickOption = (optionText: string) => {
        if (isCurrentQuestionAnswered) return;
        setEliminatedOptions(prev => {
            const newSet = new Set(prev);
            if (newSet.has(optionText)) {
                newSet.delete(optionText);
            } else {
                newSet.add(optionText);
            }
            return newSet;
        });
    };
    
    const handleCloseSummaryModal = useCallback(() => setIsSummaryModalOpen(false), []);
    const handleCloseFeedbackModal = useCallback(() => setIsFeedbackModalOpen(false), []);
    
    const handleGeneratePdf = async () => {
        setIsGeneratingPdf(true);
        try {
            const topicName = quizTitle.replace(/^(Questões de Conteúdo: |Questões Extraídas?: )/, '');
            const dataUri = generateQuestionsPdf(questions, topicName, subjectName);
    
            if (dataUri) {
                if (isInsideWebView()) {
                    const base64Data = dataUri.split(',')[1];
                    const fileName = `${topicName}.pdf`;
                    window.Android!.downloadPdf(base64Data, fileName);
                } else {
                    const link = document.createElement('a');
                    link.href = dataUri;
                    link.download = `${topicName}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
            }
        } catch (error) {
            console.error("Erro ao gerar PDF:", error);
            alert("Ocorreu um erro ao gerar o PDF.");
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    if (showResults) {
        const score = questions.length > 0 ? (correctCount / questions.length) * 100 : 0;
        const passedChallenge = score >= 60; // 60% to pass daily challenge
        
        return (
            <>
            <Card className="p-6">
                <h2 className="text-2xl font-bold text-center mb-4">{quizTitle} Finalizado!</h2>
                
                {isDailyChallenge && (
                    <div className="text-center mb-6">
                        {passedChallenge ? (
                            <TrophyIcon className="h-16 w-16 text-yellow-400 mx-auto" />
                        ) : (
                            <XCircleIcon className="h-16 w-16 text-red-400 mx-auto" />
                        )}
                        <p className="text-xl mt-2">{passedChallenge ? "Desafio diário concluído com sucesso!" : "Não foi desta vez. Continue estudando!"}</p>
                    </div>
                )}
                
                <p className="text-center text-xl mb-6">Você acertou {correctCount} de {questions.length} questões ({score.toFixed(0)}%).</p>
                
                <div className="mt-6 space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                    {incorrectlyAnsweredQuestions.length > 0 && (
                        <details className="bg-gray-800/50 rounded-lg" open>
                            <summary className="p-4 cursor-pointer list-none flex justify-between items-center">
                                <h3 className="font-bold text-lg text-red-400">Questões Erradas ({incorrectlyAnsweredQuestions.length})</h3>
                                <ChevronDownIcon className="h-5 w-5 transition-transform details-open:rotate-180" />
                            </summary>
                            <div className="border-t border-gray-700 p-4 space-y-4">
                                {incorrectlyAnsweredQuestions.map(({ question, attempt }) => (
                                    <div key={question.id} className="p-4 bg-gray-900/50 rounded-lg space-y-2">
                                        <div className="font-semibold" dangerouslySetInnerHTML={{ __html: markdownToHtml(question.statement) }} />
                                        <ul className="space-y-1 text-sm">
                                            {question.options.map(option => {
                                                const isSelected = attempt.selectedAnswer === option;
                                                const isCorrect = question.correctAnswer === option;
                                                const justifications = fetchedJustifications[question.id] || question.optionJustifications;
                                                return (
                                                    <li key={option} className={`flex flex-col p-2 rounded ${isCorrect ? 'bg-green-900/50 text-green-300' : isSelected ? 'bg-red-900/50 text-red-300' : 'bg-gray-700/30'}`}>
                                                        <div className="flex items-start gap-2">
                                                            {isCorrect ? <CheckCircleIcon className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" /> : isSelected ? <XCircleIcon className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" /> : <div className="w-5 h-5 flex-shrink-0" />}
                                                            <span dangerouslySetInnerHTML={{ __html: markdownToHtml(option) }} />
                                                        </div>
                                                        {justifications?.[option] && <p className="text-xs text-gray-400 mt-1 pl-7 italic">{justifications[option]}</p>}
                                                    </li>
                                                )
                                            })}
                                        </ul>
                                        {!question.optionJustifications && !fetchedJustifications[question.id] && (
                                             <div className="text-center pt-2">
                                                <Button onClick={() => handleGenerateJustifications(question)} disabled={isFetchingJustifications === question.id} className="text-xs py-1 px-2">
                                                    {isFetchingJustifications === question.id ? <Spinner/> : <><GeminiIcon className="h-4 w-4 mr-1"/> Analisar com IA</>}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </details>
                    )}

                    {correctlyAnsweredQuestions.length > 0 && (
                        <details className="bg-gray-800/50 rounded-lg">
                            <summary className="p-4 cursor-pointer list-none flex justify-between items-center">
                                <h3 className="font-bold text-lg text-green-400">Questões Corretas ({correctlyAnsweredQuestions.length})</h3>
                                <ChevronDownIcon className="h-5 w-5 transition-transform details-open:rotate-180" />
                            </summary>
                            <div className="border-t border-gray-700 p-4 space-y-4">
                                {correctlyAnsweredQuestions.map(({ question, attempt }) => (
                                     <div key={question.id} className="p-4 bg-gray-900/50 rounded-lg space-y-2">
                                        <div className="font-semibold" dangerouslySetInnerHTML={{ __html: markdownToHtml(question.statement) }} />
                                        <p className="text-sm">Sua resposta: <span className="text-green-400 font-semibold">{attempt.selectedAnswer}</span></p>
                                        <p className="text-xs text-cyan-400 pt-2 font-bold">Justificativa:</p>
                                        <div className="text-xs text-gray-300 prose prose-sm prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: markdownToHtml(question.justification) }} />
                                    </div>
                                ))}
                            </div>
                        </details>
                    )}
                </div>

                <div className="text-center mt-6 flex justify-center flex-wrap gap-2">
                    {!hideBackButtonOnResults && <Button onClick={onBack} className="bg-gray-600 hover:bg-gray-500"><ArrowRightIcon className="h-4 w-4 mr-2 transform rotate-180"/> Voltar</Button>}
                    <Button onClick={handleGenerateFeedback} disabled={isFeedbackLoading}>
                        {isFeedbackLoading ? <Spinner/> : <><GeminiIcon className="h-5 w-5 mr-2" /> Gerar Feedback</>}
                    </Button>
                    {incorrectCount > 0 && (
                        <Button onClick={handleGenerateSummary} disabled={isSummaryLoading}>
                            {isSummaryLoading ? <Spinner/> : <><GeminiIcon className="h-5 w-5 mr-2" /> Resumir Pontos para Revisão</>}
                        </Button>
                    )}
                </div>
            </Card>
            <AiHelperModal isOpen={isSummaryModalOpen} onClose={handleCloseSummaryModal} title="Resumo para Revisão" content={summaryResult} isLoading={isSummaryLoading} />
            <AiHelperModal isOpen={isFeedbackModalOpen} onClose={handleCloseFeedbackModal} title="Feedback do Quiz" content={feedbackResult} isLoading={isFeedbackLoading} />
            </>
        )
    }

    if (!questionToDisplay) {
        return (
            <Card className="p-6 text-center">
                {questions.length > 0 ? (
                     <Spinner />
                ) : (
                    <p className="text-gray-400">Nenhuma questão disponível neste tópico.</p>
                )}
            </Card>
        );
    }

    const { statement, options, correctAnswer, imageUrl, id: questionId, optionJustifications } = questionToDisplay;
    const isCorrect = isCurrentQuestionAnswered && attemptForCurrentQuestion.isCorrect;
    const currentJustifications = fetchedJustifications[questionId] || optionJustifications;
    
    return (
        <>
            <Card className="p-6">
                {showComboToast && (
                     <div className="absolute top-4 right-4 bg-gradient-to-r from-orange-500 to-yellow-400 text-white font-bold py-2 px-4 rounded-full shadow-lg animate-bounce z-10">
                        <div className="flex items-center">
                            <FireIcon className="h-6 w-6 mr-2" />
                            <span>Combo x{comboStreak}!</span>
                        </div>
                    </div>
                )}
                <div className="flex justify-between items-center mb-4 flex-wrap gap-x-4">
                    <h2 className="text-xl font-bold">{quizTitle}</h2>
                    <div className="text-right">
                        <p className="font-semibold">{currentIndex + 1} / {questions.length}</p>
                        {durationInSeconds !== undefined && timeLeft !== undefined && (
                            <p className="text-sm text-gray-400">Tempo: {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</p>
                        )}
                    </div>
                </div>

                <div className="mb-4 space-y-2">
                    <div className="w-full bg-gray-700 rounded-full h-2.5">
                        <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2.5 rounded-full" style={{ width: `${((currentIndex + 1) / (questions.length || 1)) * 100}%` }}></div>
                    </div>
                    {feedbackMode !== 'at_end' && (
                        <div className="flex justify-between text-sm text-gray-400">
                            <span>Acertos: <span className="font-bold text-green-400">{correctCount}</span></span>
                            <span>Erros: <span className="font-bold text-red-400">{incorrectCount}</span></span>
                        </div>
                    )}
                </div>
                
                {comboStreak > 0 && !isCurrentQuestionAnswered && (
                    <div key={comboStreak} className="my-3 animate-fade-in">
                        <ComboProgressBar streak={comboStreak} />
                    </div>
                )}
                
                {motivationalMessage && (
                    <div key={motivationalMessage} className="text-center my-3 p-2 bg-gray-800/50 rounded-lg animate-fade-in">
                        <p className="text-sm font-semibold text-cyan-300">{motivationalMessage}</p>
                    </div>
                )}
                
                {imageUrl && <img src={imageUrl} alt="Imagem da questão" className="max-h-60 w-auto rounded-lg mx-auto mb-4"/>}
                
                {isDailyChallenge && dailyChallengeType === 'review' && questionToDisplay.subjectName && questionToDisplay.topicName && (
                    <div className="mb-4 text-base font-bold text-cyan-300">
                        {questionToDisplay.subjectName} &gt; {questionToDisplay.topicName}
                    </div>
                )}

                {dailyChallengeType !== 'portuguese' && (
                    <div className="prose prose-invert max-w-none mb-4" dangerouslySetInnerHTML={{ __html: markdownToHtml(statement) }}></div>
                )}

                {dailyChallengeType === 'portuguese' ? (
                    <div className="text-lg leading-relaxed my-4 p-4 bg-gray-900/50 rounded-lg">
                        <p className="text-sm text-gray-400 mb-2">Clique no trecho que contém o erro gramatical:</p>
                        <div className="flex flex-wrap gap-x-2 gap-y-2 items-center">
                            {options.map((option, i) => {
                                const isSelected = isCurrentQuestionAnswered ? attemptForCurrentQuestion.selectedAnswer === option : selectedOption === option;
                                const isTheCorrectAnswer = correctAnswer === option;
                                const colorIndex = i % PORTUGUESE_HIGHLIGHT_COLORS.length;

                                let partClass = `px-2 py-1 rounded transition-colors duration-300 ${isCurrentQuestionAnswered ? 'cursor-default' : 'cursor-pointer hover:ring-2 hover:ring-white'}`;
                                
                                if (isCurrentQuestionAnswered) {
                                    if (isTheCorrectAnswer) {
                                        partClass += ' bg-red-600 text-white ring-2 ring-red-400 underline decoration-wavy';
                                    } else if (isSelected && !isTheCorrectAnswer) {
                                        partClass += ' bg-red-800/50 text-gray-300 line-through';
                                    } else {
                                        partClass += ' text-gray-300';
                                    }
                                } else {
                                    partClass += ` ${PORTUGUESE_HIGHLIGHT_COLORS[colorIndex]}`;
                                    if(isSelected) {
                                        partClass += ' ring-2 ring-offset-2 ring-offset-gray-800 ring-white scale-105';
                                    }
                                }
                                
                                return (
                                    <button
                                        key={i}
                                        onClick={() => !isCurrentQuestionAnswered && setSelectedOption(option)}
                                        disabled={isCurrentQuestionAnswered}
                                        className={partClass}
                                    >
                                        {option}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {options.map((option, i) => {
                            const isSelected = isCurrentQuestionAnswered ? attemptForCurrentQuestion.selectedAnswer === option : selectedOption === option;
                            const isCorrectAnswer = correctAnswer === option;
                            const colorIndex = i % HIGHLIGHT_COLORS.length;
                            const isEliminated = eliminatedOptions.has(option);
                            
                            let labelClass = 'bg-gray-700 hover:bg-gray-600';
                            if (isCurrentQuestionAnswered && feedbackMode === 'immediate') {
                                if(isCorrectAnswer) labelClass = 'bg-green-600 text-white';
                                else if (isSelected) labelClass = 'bg-red-600 text-white';
                                else labelClass = 'bg-gray-700 opacity-60';
                            } else if (isSelected) {
                                labelClass = HIGHLIGHT_COLORS[colorIndex];
                            }

                            return (
                                <button
                                    key={i}
                                    onClick={() => setSelectedOption(option)}
                                    onDoubleClick={() => handleDoubleClickOption(option)}
                                    disabled={isCurrentQuestionAnswered}
                                    className={`w-full text-left p-4 rounded-lg transition-all duration-200 block ${!isCurrentQuestionAnswered ? 'cursor-pointer' : ''} ${labelClass} flex items-start ${isEliminated ? 'line-through opacity-50' : ''}`}
                                >
                                    <span className="font-semibold mr-3">{String.fromCharCode(65 + i)}.</span>
                                    <div className="prose prose-sm prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: markdownToHtml(option) }}></div>
                                </button>
                            )
                        })}
                    </div>
                )}

                <div className="mt-6">
                    {hasCompleted && isDailyChallenge && onNavigateToDailyChallengeResults ? (
                        <div className="text-center mt-6 flex justify-center flex-wrap gap-2">
                            <p className="w-full text-green-400 font-semibold mb-2">Desafio Concluído!</p>
                            <Button onClick={onNavigateToDailyChallengeResults}>Ver Resumo Final</Button>
                            <Button onClick={onBack} className="bg-gray-600 hover:bg-gray-500">Voltar ao Painel</Button>
                        </div>
                    ) : (
                        <div className="flex justify-center items-center mt-6 space-x-4">
                            {!showResults && (
                                <Button onClick={handleGoToLastAnswered} disabled={sessionAttempts.length === 0} className="bg-gray-600 hover:bg-gray-500 text-sm py-2 px-4" title="Ir para a última questão respondida">
                                    Última Respondida
                                </Button>
                            )}
                            <Button onClick={handlePrevious} disabled={currentIndex === 0} className="bg-gray-600 hover:bg-gray-500">
                                <ArrowRightIcon className="h-5 w-5 transform rotate-180"/>
                            </Button>
                            {!isCurrentQuestionAnswered ? (
                                <Button onClick={handleRespond}>Responder</Button>
                            ) : (
                                <Button onClick={handleNext}>
                                    {isLastQuestion ? 'Ver Resultados' : 'Próxima'}
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                {isCurrentQuestionAnswered && feedbackMode === 'immediate' && (
                    <div className="mt-6 p-4 bg-gray-900/50 rounded-lg animate-fade-in">
                        <p className={`font-bold text-lg ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                            {isCorrect ? 'Resposta Correta!' : 'Resposta Incorreta.'}
                        </p>
                        {currentJustifications ? (
                            <div className="mt-2 space-y-3">
                                {options.map((option, i) => {
                                    const isCorrectAnswer = correctAnswer === option;
                                    const justificationText = currentJustifications[option];
                                    return (
                                        <div key={i}>
                                            <p className={`font-semibold text-sm ${isCorrectAnswer ? 'text-green-400' : 'text-red-400'}`}>
                                                {String.fromCharCode(65 + i)}) {isCorrectAnswer ? "Correta" : "Incorreta"}
                                            </p>
                                            <p className="text-xs text-gray-300 ml-2 italic">{justificationText || "Justificativa não disponível."}</p>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : questionToDisplay.justification ? (
                            <div className="mt-2">
                                <h5 className="font-bold text-cyan-400">Justificativa:</h5>
                                <div 
                                    className="mt-1 text-gray-300 prose prose-sm prose-invert max-w-none" 
                                    dangerouslySetInnerHTML={{ __html: markdownToHtml(questionToDisplay.justification) }} 
                                />
                            </div>
                        ) : (
                            <div className="mt-2 text-center">
                                <Button onClick={() => handleGenerateJustifications(questionToDisplay)} disabled={isFetchingJustifications === questionId} className="text-sm py-2 px-3">
                                    {isFetchingJustifications === questionId ? <Spinner/> : <><GeminiIcon className="h-4 w-4 mr-2"/> Analisar Alternativas com IA</>}
                                </Button>
                            </div>
                        )}
                    </div>
                )}
                
                <div className="mt-4 pt-4 border-t border-gray-700 flex justify-center items-center gap-4">
                    <Button
                        onClick={handleGeneratePdf}
                        disabled={isGeneratingPdf || questions.length === 0}
                        className="text-xs py-1 px-3 bg-gray-600 hover:bg-cyan-700"
                    >
                        {isGeneratingPdf ? <Spinner /> : <DownloadIcon className="h-4 w-4 mr-2" />}
                        {isGeneratingPdf ? 'Gerando...' : 'Baixar PDF'}
                    </Button>
                    {onReportQuestion && (
                        <Button
                            onClick={() => setQuestionToReport(questionToDisplay)}
                            disabled={!!questionToDisplay.reportInfo || reportedQuestions.has(questionId)}
                            className="text-xs py-1 px-3 bg-gray-600 hover:bg-red-700 disabled:bg-gray-500 disabled:opacity-70"
                        >
                            <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
                            {questionToDisplay.reportInfo || reportedQuestions.has(questionId) ? 'Erro Reportado!' : 'Reportar Erro'}
                        </Button>
                    )}
                </div>

            </Card>
            {questionToReport && (
                <ReportQuestionModal
                    isOpen={!!questionToReport}
                    onClose={() => setQuestionToReport(null)}
                    onSubmit={handleReportSubmit}
                    question={questionToReport}
                />
            )}
        </>
    );
};

import React, { useState, useEffect } from 'react';
import { Question, QuestionAttempt, StudentProgress } from '../../types';
import { markdownToHtml } from '../../utils';
import { Spinner, Button, Card } from '../ui';
import { CheckCircleIcon, XCircleIcon, SparklesIcon, LightBulbIcon, UserCircleIcon } from '../Icons';

export const QuizView: React.FC<{
    questions: Question[];
    initialAttempts: QuestionAttempt[];
    onSaveAttempt: (attempt: QuestionAttempt) => void;
    onComplete: (attempts: QuestionAttempt[]) => void;
    onBack: () => void;
    quizTitle: string;
    durationInSeconds?: number | 'unlimited';
    maxAttempts?: number | 'unlimited';
    studentProgress?: StudentProgress;
    subjectName?: string;
    onAddBonusXp?: (amount: number, message: string) => void;
    onReportQuestion?: (question: Question, reason: string) => void;
    hideBackButtonOnResults?: boolean;
}> = ({ 
    questions, initialAttempts, onSaveAttempt, onComplete, onBack, quizTitle, durationInSeconds, 
    maxAttempts = 'unlimited', studentProgress, subjectName: manualSubjectName
}) => {
    const [sessionAttempts, setSessionAttempts] = useState<QuestionAttempt[]>([]);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [discardedOptions, setDiscardedOptions] = useState<Set<string>>(new Set());
    const [showResults, setShowResults] = useState(false);
    const [hasCompleted, setHasCompleted] = useState(false);
    
    const isTimerActive = durationInSeconds !== undefined && durationInSeconds !== 'unlimited';
    const initialTime = typeof durationInSeconds === 'number' ? durationInSeconds : 0;
    const [timeLeft, setTimeLeft] = useState(initialTime);
    
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        setSelectedOption(null);
        setDiscardedOptions(new Set()); // Reset discarded on question change
    }, [currentIndex]);

    const questionToDisplay = questions[currentIndex];
    const attemptForCurrentQuestion = sessionAttempts.find(a => a.questionId === questionToDisplay?.id);
    const isCurrentQuestionAnswered = !!attemptForCurrentQuestion;
    const isLastQuestion = currentIndex === questions.length - 1;

    useEffect(() => {
        setSessionAttempts(initialAttempts);
        setHasCompleted(questions.length > 0 && initialAttempts.length === questions.length);
        if (isTimerActive) setTimeLeft(initialTime);
    }, [questions, initialAttempts, initialTime, isTimerActive]);

    useEffect(() => {
        if (isTimerActive && !showResults && !hasCompleted) {
            if (timeLeft === 0) { setShowResults(true); return; }
            const timer = setInterval(() => setTimeLeft(prev => (prev > 0 ? prev - 1 : 0)), 1000);
            return () => clearInterval(timer);
        }
    }, [timeLeft, isTimerActive, showResults, hasCompleted]);

    const handleOptionClick = (option: string) => {
        if (isCurrentQuestionAnswered) return;
        if (discardedOptions.has(option)) return;
        setSelectedOption(option);
    };

    const handleOptionDoubleClick = (option: string) => {
        if (isCurrentQuestionAnswered) return;
        
        setDiscardedOptions(prev => {
            const next = new Set(prev);
            if (next.has(option)) {
                next.delete(option);
            } else {
                next.add(option);
                if (selectedOption === option) {
                    setSelectedOption(null);
                }
            }
            return next;
        });
    };

    const handleRespond = () => {
        if (!selectedOption || !questionToDisplay || isCurrentQuestionAnswered) return;
        const isCorrect = selectedOption === questionToDisplay.correctAnswer;
        const newAttempt: QuestionAttempt = { questionId: questionToDisplay.id, selectedAnswer: selectedOption, isCorrect };
        const updatedAttempts = [...sessionAttempts, newAttempt];
        setSessionAttempts(updatedAttempts);
        onSaveAttempt(newAttempt);
        if (isLastQuestion && updatedAttempts.length === questions.length) {
            onComplete(updatedAttempts);
            setHasCompleted(true);
        }
    };

    const handleNext = () => {
        if (!isLastQuestion) setCurrentIndex(prev => prev + 1);
        else setShowResults(true);
    };

    if (showResults) {
        const correctCount = sessionAttempts.filter(a => a.isCorrect).length;
        return (
            <Card className="p-10 text-center animate-fade-in bg-gray-900 border-2 border-cyan-500/30 shadow-[0_0_50px_-12px_rgba(34,211,238,0.3)]">
                <TrophyIcon className="h-20 w-20 text-yellow-400 mx-auto mb-6 animate-bounce" />
                <h2 className="text-3xl font-black mb-2 text-white uppercase tracking-tighter">{quizTitle} Finalizado!</h2>
                <p className="text-gray-400 mb-8">Desempenho Diário</p>
                <div className="flex justify-center gap-4 mb-10">
                    <div className="bg-gray-800 p-4 rounded-2xl border border-gray-700 min-w-[120px]">
                        <p className="text-xs font-bold text-gray-500 uppercase mb-1">Acertos</p>
                        <p className="text-3xl font-black text-green-400">{correctCount}</p>
                    </div>
                    <div className="bg-gray-800 p-4 rounded-2xl border border-gray-700 min-w-[120px]">
                        <p className="text-xs font-bold text-gray-500 uppercase mb-1">Questões</p>
                        <p className="text-3xl font-black text-white">{questions.length}</p>
                    </div>
                </div>
                <Button onClick={onBack} className="w-full py-4 text-lg font-black uppercase tracking-widest">Voltar ao Painel</Button>
            </Card>
        );
    }

    if (!questionToDisplay) return <Card className="p-6 text-center"><Spinner /></Card>;

    const progressPercent = ((currentIndex + 1) / questions.length) * 100;
    const timerHue = isTimerActive ? Math.max(0, (timeLeft / initialTime) * 120) : 120;

    return (
        <div className="max-w-4xl mx-auto space-y-4">
            {/* Timer e Progresso Superior */}
            <div className="flex items-center gap-4 bg-gray-800/80 backdrop-blur-md p-3 rounded-2xl border border-gray-700 sticky top-0 z-10 shadow-xl">
                <div className="relative h-12 w-12 flex-shrink-0">
                    <svg className="h-full w-full -rotate-90">
                        <circle cx="24" cy="24" r="20" fill="transparent" stroke="#374151" strokeWidth="4" />
                        <circle 
                            cx="24" cy="24" r="20" fill="transparent" 
                            stroke={`hsl(${timerHue}, 100%, 50%)`} 
                            strokeWidth="4" 
                            strokeDasharray={125.6} 
                            strokeDashoffset={isTimerActive ? 125.6 * (1 - timeLeft / initialTime) : 0}
                            className="transition-all duration-1000"
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold text-white">
                        {isTimerActive ? `${Math.floor(timeLeft/60)}:${(timeLeft%60).toString().padStart(2,'0')}` : '∞'}
                    </div>
                </div>
                <div className="flex-grow">
                    <div className="flex justify-between text-[10px] font-black uppercase text-gray-500 mb-1 tracking-widest">
                        <span>Progresso da Missão</span>
                        <span>{currentIndex + 1} de {questions.length}</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                </div>
            </div>

            <Card className="p-8 relative overflow-hidden group shadow-2xl border border-gray-700/50">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity">
                    <LightBulbIcon className="h-32 w-32" />
                </div>

                <div className="mb-8">
                    {(questionToDisplay.subjectName || manualSubjectName) && (
                        <div className="inline-flex items-center gap-2 bg-cyan-500/10 text-cyan-400 px-3 py-1 rounded-full border border-cyan-500/20 text-[10px] font-black uppercase mb-4 tracking-widest">
                            <SparklesIcon className="h-3 w-3" />
                            {questionToDisplay.subjectName || manualSubjectName}
                        </div>
                    )}
                    <div className="prose prose-invert max-w-none text-xl font-medium leading-relaxed text-gray-100" dangerouslySetInnerHTML={{ __html: markdownToHtml(questionToDisplay.statement) }}></div>
                    <p className="mt-4 text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1">
                        <LightBulbIcon className="h-3 w-3" /> Dica: Clique duas vezes para descartar uma alternativa.
                    </p>
                </div>

                <div className="space-y-3">
                    {questionToDisplay.options.map((option, i) => {
                        const isSelected = isCurrentQuestionAnswered ? attemptForCurrentQuestion?.selectedAnswer === option : selectedOption === option;
                        const isCorrectAnswer = questionToDisplay.correctAnswer === option;
                        const isDiscarded = discardedOptions.has(option);
                        
                        let stateClass = 'bg-gray-800/50 border-gray-700 hover:bg-gray-700 hover:border-gray-600';
                        
                        if (isCurrentQuestionAnswered) {
                            if (isCorrectAnswer) stateClass = 'bg-green-500/20 border-green-500 text-green-100 shadow-[0_0_20px_-5px_rgba(34,197,94,0.3)]';
                            else if (isSelected) stateClass = 'bg-red-500/20 border-red-500 text-red-100 shadow-[0_0_20px_-5px_rgba(239,68,68,0.3)]';
                            else stateClass = 'bg-gray-800/40 border-gray-800 opacity-40 grayscale';
                        } else if (isDiscarded) {
                            stateClass = 'bg-gray-900/30 border-gray-800 opacity-30 grayscale scale-[0.98] blur-[0.3px]';
                        } else if (isSelected) {
                            stateClass = 'bg-cyan-500/10 border-cyan-500 ring-2 ring-cyan-500/20 text-white';
                        }

                        return (
                            <button 
                                key={`${currentIndex}-${i}`} 
                                onClick={() => handleOptionClick(option)}
                                onDoubleClick={() => handleOptionDoubleClick(option)}
                                className={`w-full text-left p-5 rounded-2xl transition-all border-2 flex items-start group relative select-none ${stateClass}`} 
                                disabled={isCurrentQuestionAnswered}
                            >
                                <span className={`font-black mr-4 w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0 transition-colors ${isSelected ? 'bg-cyan-500 text-white' : 'bg-gray-700 text-gray-400 group-hover:text-white'} ${isDiscarded ? 'line-through opacity-50' : ''}`}>
                                    {String.fromCharCode(65 + i)}
                                </span>
                                <span className={`flex-grow pt-1 text-sm md:text-base font-semibold ${isDiscarded ? 'line-through text-gray-500' : ''}`} dangerouslySetInnerHTML={{ __html: markdownToHtml(option) }}></span>
                                
                                {isCurrentQuestionAnswered && isCorrectAnswer && <CheckCircleIcon className="h-6 w-6 text-green-500 ml-2 flex-shrink-0" />}
                                {isCurrentQuestionAnswered && isSelected && !isCorrectAnswer && <XCircleIcon className="h-6 w-6 text-red-500 ml-2 flex-shrink-0" />}
                                {!isCurrentQuestionAnswered && isDiscarded && (
                                    <div className="ml-2 flex-shrink-0 text-red-500/50">
                                        <XCircleIcon className="h-5 w-5" title="Alternativa Descartada" />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {isCurrentQuestionAnswered && (
                    <div className="mt-8 space-y-4 animate-fade-in">
                        <div className="p-6 bg-gray-900/80 rounded-3xl border border-gray-700 shadow-inner">
                            <div className="flex justify-between items-start mb-4">
                                <h4 className="font-black text-cyan-400 tracking-widest text-xs uppercase flex items-center gap-2">
                                    <LightBulbIcon className="h-4 w-4" /> Justificativa do Mestre
                                </h4>
                                {questionToDisplay.commentSource === 'tec' && (
                                    <div className="flex items-center gap-2 bg-gray-800 px-3 py-1 rounded-full border border-gray-700">
                                        <UserCircleIcon className="h-3.5 w-3.5 text-gray-500" />
                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Comentário de um professor do TEC</span>
                                    </div>
                                )}
                            </div>
                            {/* Renderizamos como HTML puro pois o Gemini gerou tags HTML para preservar LaTeX */}
                            <div 
                                className="text-sm text-gray-300 leading-relaxed italic prose prose-invert prose-sm max-w-none" 
                                dangerouslySetInnerHTML={{ __html: questionToDisplay.justification }}
                            />
                            
                            <div className="mt-6 pt-6 border-t border-gray-800 flex justify-end items-center">
                                <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">ID: {questionToDisplay.id.split('-')[0]}</span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-10 flex justify-center">
                    {!isCurrentQuestionAnswered ? (
                        <Button 
                            onClick={handleRespond} 
                            disabled={!selectedOption} 
                            className="px-16 py-5 text-xl font-black uppercase tracking-widest shadow-[0_20px_40px_-15px_rgba(34,211,238,0.4)] hover:scale-105 active:scale-95 transition-all"
                        >
                            Confirmar Resposta
                        </Button>
                    ) : (
                        <Button 
                            onClick={handleNext} 
                            className="px-16 py-5 text-xl font-black uppercase tracking-widest bg-gray-700 hover:bg-gray-600 border-none transition-all shadow-xl"
                        >
                            {isLastQuestion ? 'Finalizar Missão' : 'Próximo Alvo'}
                        </Button>
                    )}
                </div>
            </Card>
        </div>
    );
};

const TrophyIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
);

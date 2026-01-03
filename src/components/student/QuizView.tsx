
import React, { useState, useEffect, useMemo } from 'react';
import { Question, QuestionAttempt, StudentProgress } from '../../types';
import { markdownToHtml } from '../../utils';
import { Spinner, Button, Card } from '../ui';
import { CheckCircleIcon, XCircleIcon } from '../Icons';

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
    const [showResults, setShowResults] = useState(false);
    const [hasCompleted, setHasCompleted] = useState(false);

    // Timer logic handles 'unlimited'
    const isTimerActive = durationInSeconds !== undefined && durationInSeconds !== 'unlimited';
    const initialTime = typeof durationInSeconds === 'number' ? durationInSeconds : 0;
    const [timeLeft, setTimeLeft] = useState(initialTime);
    
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        setSelectedOption(null);
    }, [currentIndex]);

    const questionHistory = useMemo(() => {
        const correct = new Set<string>();
        const incorrect = new Set<string>();
        if (!studentProgress) return { correct, incorrect };
        const process = (a: QuestionAttempt) => {
            if (a.isCorrect) correct.add(a.questionId);
            else incorrect.add(a.questionId);
        };
        Object.values(studentProgress.progressByTopic || {}).forEach(s => 
            Object.values(s || {}).forEach(t => (t.lastAttempt || []).forEach(process))
        );
        (studentProgress.reviewSessions || []).forEach(s => (s.attempts || []).forEach(process));
        return { correct, incorrect };
    }, [studentProgress]);

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
            <Card className="p-6 text-center animate-fade-in">
                <h2 className="text-2xl font-bold mb-4">{quizTitle} Finalizado!</h2>
                <p className="text-xl mb-6">Você acertou {correctCount} de {questions.length} questões.</p>
                <Button onClick={onBack}>Voltar ao Painel</Button>
            </Card>
        );
    }

    if (!questionToDisplay) return <Card className="p-6 text-center"><Spinner /></Card>;

    return (
        <Card className="p-6 relative max-w-4xl mx-auto shadow-2xl">
            <div className="flex justify-between items-start mb-6">
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] bg-cyan-900/50 text-cyan-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider border border-cyan-700/50">Questão {currentIndex + 1}/{questions.length}</span>
                        {isTimerActive && <span className="text-[10px] bg-gray-700 text-white px-2 py-0.5 rounded font-mono border border-gray-600">Tempo: {Math.floor(timeLeft/60)}:{(timeLeft%60).toString().padStart(2,'0')}</span>}
                    </div>
                    {(questionToDisplay.subjectName || manualSubjectName) && (
                        <h3 className="text-xs font-black text-gray-500 uppercase tracking-tighter truncate">
                            {questionToDisplay.subjectName || manualSubjectName} {questionToDisplay.topicName && <span className="text-cyan-600/60 mx-1">•</span>} {questionToDisplay.topicName}
                        </h3>
                    )}
                    <h2 className="text-lg font-bold text-white truncate">{quizTitle}</h2>
                </div>
            </div>

            <div className="w-full bg-gray-700 rounded-full h-1.5 mb-8 overflow-hidden">
                <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-500" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}></div>
            </div>

            <div className="prose prose-invert max-w-none mb-8 text-gray-200 leading-relaxed" dangerouslySetInnerHTML={{ __html: markdownToHtml(questionToDisplay.statement) }}></div>

            <div className="space-y-3">
                {questionToDisplay.options.map((option, i) => {
                    const isSelected = isCurrentQuestionAnswered ? attemptForCurrentQuestion?.selectedAnswer === option : selectedOption === option;
                    const isCorrectAnswer = questionToDisplay.correctAnswer === option;
                    let btnClass = 'bg-gray-800 border-gray-700 hover:bg-gray-700 hover:border-gray-600';
                    if (isCurrentQuestionAnswered) {
                        if (isCorrectAnswer) btnClass = 'bg-green-600/20 border-green-500 text-green-100';
                        else if (isSelected) btnClass = 'bg-red-600/20 border-red-500 text-red-100';
                        else btnClass = 'bg-gray-800/40 border-gray-800 opacity-40 text-gray-500';
                    } else if (isSelected) btnClass = 'bg-cyan-900/40 border-cyan-500 ring-1 ring-cyan-500/50 text-white';

                    return (
                        <button key={`${currentIndex}-${i}`} onClick={() => !isCurrentQuestionAnswered && setSelectedOption(option)} className={`w-full text-left p-4 rounded-xl transition-all border-2 flex items-start group ${btnClass}`} disabled={isCurrentQuestionAnswered}>
                            <span className={`font-black mr-4 w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 transition-colors ${isSelected ? 'bg-cyan-500 text-white' : 'bg-gray-700 text-gray-400 group-hover:text-white'}`}>{String.fromCharCode(65 + i)}</span>
                            <span className="flex-grow pt-0.5" dangerouslySetInnerHTML={{ __html: markdownToHtml(option) }}></span>
                        </button>
                    );
                })}
            </div>

            {isCurrentQuestionAnswered && (
                <div className="mt-8 p-5 bg-gray-900/60 rounded-2xl border border-gray-700 animate-fade-in">
                    <div className="flex items-center gap-3 mb-3">
                        {attemptForCurrentQuestion.isCorrect ? <CheckCircleIcon className="h-6 w-6 text-green-400" /> : <XCircleIcon className="h-6 w-6 text-red-400" />}
                        <h4 className="font-black text-white tracking-tight text-lg">{attemptForCurrentQuestion.isCorrect ? 'Resposta Correta!' : 'Resposta Incorreta'}</h4>
                    </div>
                    <p className="text-xs font-black text-cyan-500 uppercase tracking-widest mb-2">Justificativa da IA</p>
                    <div className="text-sm text-gray-300 leading-relaxed border-l-2 border-gray-700 pl-4 italic" dangerouslySetInnerHTML={{ __html: markdownToHtml(questionToDisplay.justification) }}></div>
                </div>
            )}

            <div className="mt-10 flex justify-center">
                {!isCurrentQuestionAnswered ? (
                    <Button onClick={handleRespond} disabled={!selectedOption} className="px-12 py-4 text-lg font-black shadow-xl shadow-cyan-900/20">Responder</Button>
                ) : (
                    <Button onClick={handleNext} className="px-12 py-4 text-lg font-black bg-gray-700 border-none hover:bg-gray-600 transition-all">{isLastQuestion ? 'Finalizar' : 'Próxima'}</Button>
                )}
            </div>
        </Card>
    );
};

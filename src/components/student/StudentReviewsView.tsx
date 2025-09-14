import React, { useState } from 'react';
import { StudentProgress, ReviewSession, Question, Flashcard } from '../../types';
import { Card, Button, Spinner } from '../ui';
import { SparklesIcon, CycleIcon, BrainIcon, ArrowRightIcon } from '../Icons';
import { FlashcardPlayer } from './FlashcardPlayer';

interface StudentReviewsViewProps {
    studentProgress: StudentProgress;
    onStartReview: (session: ReviewSession) => void;
    isGenerating: boolean;
    onGenerateSmartReview: () => void;
    onGenerateSrsReview: (questions: Question[]) => void;
    incorrectQuestions: Question[];
    srsFlashcardsDue: Flashcard[];
    allQuestions: Question[];
    onFlashcardReview: (flashcardId: string, performance: 'good' | 'bad') => void;
    onGenerateSmartFlashcards: (questions: Question[]) => Promise<void>;
}

export const StudentReviewsView: React.FC<StudentReviewsViewProps> = ({
    studentProgress,
    onStartReview,
    isGenerating,
    onGenerateSmartReview,
    onGenerateSrsReview,
    incorrectQuestions,
    srsFlashcardsDue,
    allQuestions,
    onFlashcardReview,
    onGenerateSmartFlashcards
}) => {
    const [view, setView] = useState<'main' | 'flashcards' | 'ai_flashcards'>('main');
    const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);

    const srsQuestionsDue = React.useMemo(() => {
        if (!studentProgress.srsData) return [];
        const today = new Date().toISOString().split('T')[0];
        const dueQuestionIds = Object.entries(studentProgress.srsData)
            .filter(([, data]) => data.nextReviewDate <= today)
            .map(([questionId]) => questionId);
        
        return allQuestions.filter(q => dueQuestionIds.includes(q.id));
    }, [studentProgress.srsData, allQuestions]);
    
    const handleGenerateFlashcards = async () => {
        setIsGeneratingFlashcards(true);
        await onGenerateSmartFlashcards(incorrectQuestions);
        setIsGeneratingFlashcards(false);
    };


    if (view === 'flashcards') {
        return (
            <div>
                <Button onClick={() => setView('main')} className="mb-4 text-sm py-2 px-3 bg-gray-600 hover:bg-gray-500">
                    <ArrowRightIcon className="h-4 w-4 mr-2 transform rotate-180"/> Voltar
                </Button>
                <Card className="p-6">
                    <h3 className="text-xl font-bold mb-4">Flashcards para Revisão (SRS)</h3>
                    <FlashcardPlayer flashcards={srsFlashcardsDue} onReview={onFlashcardReview} />
                </Card>
            </div>
        );
    }
    
    if (view === 'ai_flashcards') {
        return (
             <div>
                <Button onClick={() => setView('main')} className="mb-4 text-sm py-2 px-3 bg-gray-600 hover:bg-gray-500">
                    <ArrowRightIcon className="h-4 w-4 mr-2 transform rotate-180"/> Voltar
                </Button>
                <Card className="p-6">
                    <h3 className="text-xl font-bold mb-4">Flashcards Gerados pela IA</h3>
                    <FlashcardPlayer flashcards={studentProgress.aiGeneratedFlashcards || []} />
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold">Minhas Revisões</h2>
            
            <Card className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex flex-col items-center text-center p-4 bg-gray-900/50 rounded-lg">
                    <SparklesIcon className="h-10 w-10 text-purple-400 mb-3" />
                    <h3 className="font-bold text-lg text-white">Revisão Inteligente</h3>
                    <p className="text-sm text-gray-400 my-2 flex-grow">A IA analisa seus pontos fracos e cria uma revisão personalizada.</p>
                    <Button onClick={onGenerateSmartReview} disabled={isGenerating} className="w-full">
                        {isGenerating ? <Spinner /> : 'Gerar Revisão'}
                    </Button>
                </div>
                <div className="flex flex-col items-center text-center p-4 bg-gray-900/50 rounded-lg">
                    <CycleIcon className="h-10 w-10 text-blue-400 mb-3" />
                    <h3 className="font-bold text-lg text-white">Revisão Agendada (SRS)</h3>
                    <p className="text-sm text-gray-400 my-2 flex-grow">Revise questões com base no sistema de repetição espaçada.</p>
                    <Button onClick={() => onGenerateSrsReview(srsQuestionsDue)} disabled={srsQuestionsDue.length === 0} className="w-full">
                        Iniciar ({srsQuestionsDue.length})
                    </Button>
                </div>
                <div className="flex flex-col items-center text-center p-4 bg-gray-900/50 rounded-lg">
                    <BrainIcon className="h-10 w-10 text-teal-400 mb-3" />
                    <h3 className="font-bold text-lg text-white">Flashcards de Erros</h3>
                    <p className="text-sm text-gray-400 my-2 flex-grow">Crie flashcards com IA a partir das questões que você errou.</p>
                    <Button onClick={handleGenerateFlashcards} disabled={incorrectQuestions.length === 0 || isGeneratingFlashcards} className="w-full">
                        {isGeneratingFlashcards ? <Spinner /> : 'Gerar Flashcards'}
                    </Button>
                </div>
            </Card>

            <Card className="p-6">
                 <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">Flashcards</h3>
                    <div>
                        <Button onClick={() => setView('flashcards')} disabled={srsFlashcardsDue.length === 0} className="text-sm py-2 px-3 mr-2">
                            Revisão SRS ({srsFlashcardsDue.length})
                        </Button>
                         <Button onClick={() => setView('ai_flashcards')} disabled={!studentProgress.aiGeneratedFlashcards || studentProgress.aiGeneratedFlashcards.length === 0} className="text-sm py-2 px-3">
                            Gerados por IA ({studentProgress.aiGeneratedFlashcards?.length || 0})
                        </Button>
                    </div>
                </div>
                 <p className="text-gray-400 text-center">Use os botões acima para iniciar uma sessão de flashcards.</p>
            </Card>
            
            <Card className="p-6">
                <h3 className="text-xl font-bold mb-4">Revisões Salvas</h3>
                <div className="space-y-3">
                    {studentProgress.reviewSessions.length > 0 ? (
                        studentProgress.reviewSessions.sort((a,b) => b.createdAt - a.createdAt).map(session => {
                            const correctCount = session.attempts?.filter(a => a.isCorrect).length || 0;
                            const total = session.questions.length;
                            return (
                                <div key={session.id} className="p-4 bg-gray-800/50 rounded-lg flex justify-between items-center">
                                    <div>
                                        <p className={`font-semibold ${session.isCompleted ? 'text-gray-400' : 'text-white'}`}>{session.name}</p>
                                        <p className="text-sm text-gray-400">{total} questões</p>
                                        {session.isCompleted && <p className="text-sm text-green-400">Concluído - {correctCount}/{total} acertos</p>}
                                    </div>
                                    <Button onClick={() => onStartReview(session)} className="text-sm py-2 px-3">
                                        {session.isCompleted ? 'Refazer' : 'Iniciar'}
                                    </Button>
                                </div>
                            );
                        })
                    ) : (
                        <p className="text-gray-500 text-center">Nenhuma sessão de revisão salva.</p>
                    )}
                </div>
            </Card>
        </div>
    );
};

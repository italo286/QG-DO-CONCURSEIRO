import React from 'react';
import { CustomQuiz, StudentProgress } from '../../../types';
import { Card, Button } from '../../ui';
import { PlusIcon, TrashIcon, CheckCircleIcon } from '../../Icons';

interface CustomQuizListViewProps {
    studentProgress: StudentProgress;
    onStartQuiz: (quiz: CustomQuiz) => void;
    onDeleteQuiz: (quizId: string) => void;
    onOpenCreator: () => void;
}

export const CustomQuizListView: React.FC<CustomQuizListViewProps> = ({ studentProgress, onStartQuiz, onDeleteQuiz, onOpenCreator }) => {
    const customQuizzes = studentProgress.customQuizzes || [];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Minhas Questões Personalizadas</h2>
                <Button onClick={onOpenCreator}>
                    <PlusIcon className="h-5 w-5 mr-2" />
                    Criar Novo Quiz
                </Button>
            </div>
            <p className="text-gray-400">Crie seus próprios quizzes com a ajuda da IA para focar nos temas que mais precisa.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {customQuizzes.map(quiz => (
                    <Card key={quiz.id} className={`flex flex-col p-6 transition-all ${quiz.isCompleted ? 'bg-green-900/20 border-green-700/50' : ''}`}>
                        <div className="flex-grow">
                            <div className="flex justify-between items-start">
                                <h3 className="text-xl font-bold text-cyan-400">{quiz.name}</h3>
                                {quiz.isCompleted && <CheckCircleIcon className="h-6 w-6 text-green-400" title="Concluído" />}
                            </div>
                            <p className="text-sm text-gray-400 mt-2">{quiz.questions.length} questões</p>
                            <p className="text-xs text-gray-500 mt-1">Criado em: {new Date(quiz.createdAt).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div className="mt-4 flex space-x-2">
                            <Button onClick={() => onStartQuiz(quiz)} className="text-sm flex-1 py-2">
                                {quiz.isCompleted ? 'Refazer Quiz' : 'Iniciar Quiz'}
                            </Button>
                            <Button onClick={() => onDeleteQuiz(quiz.id)} className="text-sm py-2 px-3 bg-red-600 hover:bg-red-700">
                                <TrashIcon className="h-4 w-4" />
                            </Button>
                        </div>
                    </Card>
                ))}
                {customQuizzes.length === 0 && (
                    <Card className="md:col-span-2 lg:col-span-3 text-center text-gray-400 p-10">
                        <p>Você ainda não criou nenhum quiz personalizado.</p>
                        <Button onClick={onOpenCreator} className="mt-4">
                            <PlusIcon className="h-5 w-5 mr-2" />
                            Criar meu primeiro Quiz
                        </Button>
                    </Card>
                )}
            </div>
        </div>
    );
};

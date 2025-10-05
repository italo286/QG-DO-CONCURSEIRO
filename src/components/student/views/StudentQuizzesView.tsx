import React, { useState } from 'react';
import { CustomQuiz, StudentProgress, MockExam } from '../../../types';
import { Card, Button } from '../../ui';
import { PlusIcon, TrashIcon, CheckCircleIcon, ClipboardCheckIcon } from '../../Icons';

interface StudentQuizzesViewProps {
    studentProgress: StudentProgress;
    onStartQuiz: (quiz: CustomQuiz | MockExam) => void;
    onDeleteQuiz: (quizId: string, type: 'ai' | 'mock') => void;
    onOpenAiQuizCreator: () => void;
    onOpenMockExamCreator: () => void;
}

export const StudentQuizzesView: React.FC<StudentQuizzesViewProps> = ({ studentProgress, onStartQuiz, onDeleteQuiz, onOpenAiQuizCreator, onOpenMockExamCreator }) => {
    const [activeTab, setActiveTab] = useState<'ai' | 'mock'>('mock');
    
    const customQuizzes = studentProgress.customQuizzes || [];
    const mockExams = studentProgress.mockExams || [];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <h2 className="text-2xl font-bold text-white">Meus Quizzes e Simulados</h2>
                <div className="flex items-center gap-2">
                    <Button onClick={onOpenMockExamCreator} className="text-sm py-2 px-3">
                        <PlusIcon className="h-4 w-4 mr-2" /> Criar Simulado
                    </Button>
                    <Button onClick={onOpenAiQuizCreator} className="text-sm py-2 px-3 bg-gradient-to-r from-purple-500 to-indigo-500">
                        <PlusIcon className="h-4 w-4 mr-2" /> Criar Quiz com IA
                    </Button>
                </div>
            </div>
            <p className="text-gray-400">Crie seus próprios simulados a partir do banco de questões ou gere quizzes sobre qualquer tema com a ajuda da IA.</p>
            
            <div className="flex border-b border-gray-700" role="tablist">
                <button 
                    onClick={() => setActiveTab('mock')}
                    className={`flex-1 py-3 text-sm font-medium ${activeTab === 'mock' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400'}`}
                    role="tab" aria-selected={activeTab === 'mock'}
                >
                    Simulados ({mockExams.length})
                </button>
                <button 
                    onClick={() => setActiveTab('ai')}
                    className={`flex-1 py-3 text-sm font-medium ${activeTab === 'ai' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400'}`}
                    role="tab" aria-selected={activeTab === 'ai'}
                >
                    Quizzes da IA ({customQuizzes.length})
                </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeTab === 'mock' ? (
                    <>
                        {mockExams.map(quiz => (
                            <Card key={quiz.id} className={`flex flex-col p-6 transition-all ${quiz.isCompleted ? 'bg-green-900/20 border-green-700/50' : ''}`}>
                                <div className="flex-grow">
                                    <div className="flex justify-between items-start">
                                        <h3 className="text-xl font-bold text-cyan-400 flex items-center gap-2"><ClipboardCheckIcon className="h-5 w-5"/>{quiz.name}</h3>
                                        {quiz.isCompleted && <CheckCircleIcon className="h-6 w-6 text-green-400" title="Concluído" />}
                                    </div>
                                    <p className="text-sm text-gray-400 mt-2">{quiz.questions.length} questões</p>
                                    <p className="text-xs text-gray-500 mt-1">Criado em: {new Date(quiz.createdAt).toLocaleDateString('pt-BR')}</p>
                                </div>
                                <div className="mt-4 flex space-x-2">
                                    <Button onClick={() => onStartQuiz(quiz)} className="text-sm flex-1 py-2">
                                        {quiz.isCompleted ? 'Refazer Simulado' : 'Iniciar Simulado'}
                                    </Button>
                                    <Button onClick={() => onDeleteQuiz(quiz.id, 'mock')} className="text-sm py-2 px-3 bg-red-600 hover:bg-red-700">
                                        <TrashIcon className="h-4 w-4" />
                                    </Button>
                                </div>
                            </Card>
                        ))}
                        {mockExams.length === 0 && (
                            <Card className="md:col-span-2 lg:col-span-3 text-center text-gray-400 p-10">
                                <p>Você ainda não criou nenhum simulado.</p>
                                <Button onClick={onOpenMockExamCreator} className="mt-4">
                                    <PlusIcon className="h-5 w-5 mr-2" />
                                    Criar meu primeiro Simulado
                                </Button>
                            </Card>
                        )}
                    </>
                ) : (
                    <>
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
                                    <Button onClick={() => onDeleteQuiz(quiz.id, 'ai')} className="text-sm py-2 px-3 bg-red-600 hover:bg-red-700">
                                        <TrashIcon className="h-4 w-4" />
                                    </Button>
                                </div>
                            </Card>
                        ))}
                        {customQuizzes.length === 0 && (
                            <Card className="md:col-span-2 lg:col-span-3 text-center text-gray-400 p-10">
                                <p>Você ainda não criou nenhum quiz com IA.</p>
                                <Button onClick={onOpenAiQuizCreator} className="mt-4">
                                    <PlusIcon className="h-5 w-5 mr-2" />
                                    Criar meu primeiro Quiz com IA
                                </Button>
                            </Card>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
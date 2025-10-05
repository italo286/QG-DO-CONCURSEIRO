import React, { useState } from 'react';
import { CustomQuiz, StudentProgress, Subject, Simulado } from '../../../types';
import { Card, Button, Spinner } from '../../ui';
import { PlusIcon, TrashIcon, CheckCircleIcon, DownloadIcon } from '../../Icons';
import { SimuladoCreatorModal } from '../SimuladoCreatorModal';
import { generateQuestionsPdf } from '../../../utils';

interface StudentPracticeAreaViewProps {
    studentProgress: StudentProgress;
    allSubjects: Subject[];
    onStartQuiz: (quiz: CustomQuiz) => void;
    onDeleteQuiz: (quizId: string) => void;
    onOpenCreator: () => void;
    onSaveSimulado: (simulado: Simulado) => void;
    onStartSimulado: (simulado: Simulado) => void;
    onDeleteSimulado: (simuladoId: string) => void;
}

const isInsideWebView = () => {
    return window.Android && typeof window.Android.downloadPdf === 'function';
};

export const StudentPracticeAreaView: React.FC<StudentPracticeAreaViewProps> = ({ 
    studentProgress,
    allSubjects, 
    onStartQuiz, 
    onDeleteQuiz, 
    onOpenCreator,
    onSaveSimulado,
    onStartSimulado,
    onDeleteSimulado,
}) => {
    const [activeTab, setActiveTab] = useState<'quizzes' | 'simulados'>('simulados');
    const [isSimuladoCreatorOpen, setIsSimuladoCreatorOpen] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState<string | null>(null);

    const customQuizzes = studentProgress.customQuizzes || [];
    const simulados = studentProgress.simulados || [];

    const handleGeneratePdf = async (simulado: Simulado) => {
        setIsGeneratingPdf(simulado.id);
        try {
            const dataUri = generateQuestionsPdf(simulado.questions, simulado.name, "Simulado Personalizado");
    
            if (dataUri) {
                if (isInsideWebView()) {
                    const base64Data = dataUri.split(',')[1];
                    const fileName = `${simulado.name}.pdf`;
                    window.Android!.downloadPdf(base64Data, fileName);
                } else {
                    const link = document.createElement('a');
                    link.href = dataUri;
                    link.download = `${simulado.name}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
            }
        } catch (error) {
            console.error("Erro ao gerar PDF:", error);
            alert("Ocorreu um erro ao gerar o PDF.");
        } finally {
            setIsGeneratingPdf(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Área de Prática</h2>
                <Button onClick={activeTab === 'quizzes' ? onOpenCreator : () => setIsSimuladoCreatorOpen(true)}>
                    <PlusIcon className="h-5 w-5 mr-2" />
                    {activeTab === 'quizzes' ? 'Criar Novo Quiz' : 'Criar Novo Simulado'}
                </Button>
            </div>
            <p className="text-gray-400">Crie seus próprios quizzes e simulados com a ajuda da IA para focar nos temas que mais precisa.</p>
            
             <div className="flex border-b border-gray-700" role="tablist">
                <button 
                    onClick={() => setActiveTab('simulados')} 
                    className={`flex-1 py-3 text-sm font-medium ${activeTab === 'simulados' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:text-white'}`}
                >
                    Meus Simulados
                </button>
                <button 
                    onClick={() => setActiveTab('quizzes')} 
                    className={`flex-1 py-3 text-sm font-medium ${activeTab === 'quizzes' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:text-white'}`}
                >
                    Quizzes da IA
                </button>
            </div>

            {activeTab === 'simulados' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                    {simulados.map(simulado => (
                        <Card key={simulado.id} className={`flex flex-col p-6 transition-all ${simulado.isCompleted ? 'bg-green-900/20 border-green-700/50' : ''}`}>
                             <div className="flex-grow">
                                <div className="flex justify-between items-start">
                                    <h3 className="text-xl font-bold text-cyan-400">{simulado.name}</h3>
                                    {simulado.isCompleted && <CheckCircleIcon className="h-6 w-6 text-green-400" title="Concluído" />}
                                </div>
                                <p className="text-sm text-gray-400 mt-2">{simulado.questions.length} questões</p>
                                <p className="text-xs text-gray-500 mt-1">Criado em: {new Date(simulado.createdAt).toLocaleDateString('pt-BR')}</p>
                            </div>
                            <div className="mt-4 flex flex-col gap-2">
                                <Button onClick={() => onStartSimulado(simulado)} className="w-full text-sm py-2">
                                    {simulado.isCompleted ? 'Refazer Simulado' : 'Iniciar Simulado'}
                                </Button>
                                <div className="flex gap-2">
                                    <Button onClick={() => handleGeneratePdf(simulado)} disabled={isGeneratingPdf === simulado.id} className="w-full text-sm py-2 px-3 bg-gray-600 hover:bg-gray-500">
                                        {isGeneratingPdf === simulado.id ? <Spinner/> : <DownloadIcon className="h-4 w-4"/>}
                                    </Button>
                                    <Button onClick={() => onDeleteSimulado(simulado.id)} className="text-sm py-2 px-3 bg-red-600 hover:bg-red-700">
                                        <TrashIcon className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                     {simulados.length === 0 && (
                        <Card className="md:col-span-2 lg:col-span-3 text-center text-gray-400 p-10">
                            <p>Você ainda não criou nenhum simulado.</p>
                            <Button onClick={() => setIsSimuladoCreatorOpen(true)} className="mt-4">
                                <PlusIcon className="h-5 w-5 mr-2" />
                                Criar meu primeiro Simulado
                            </Button>
                        </Card>
                    )}
                </div>
            )}
            
            {activeTab === 'quizzes' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
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
            )}
             <SimuladoCreatorModal
                isOpen={isSimuladoCreatorOpen}
                onClose={() => setIsSimuladoCreatorOpen(false)}
                onSave={onSaveSimulado}
                allSubjects={allSubjects}
                studentProgress={studentProgress}
            />
        </div>
    );
};
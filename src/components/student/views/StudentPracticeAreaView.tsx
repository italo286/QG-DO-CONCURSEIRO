
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
                    window.Android!.downloadPdf(dataUri.split(',')[1], `${simulado.name}.pdf`);
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
            alert("Erro ao gerar PDF.");
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
            
             <div className="flex border-b border-gray-700" role="tablist">
                <button onClick={() => setActiveTab('simulados')} className={`flex-1 py-3 text-sm font-medium ${activeTab === 'simulados' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:text-white'}`}>Meus Simulados</button>
                <button onClick={() => setActiveTab('quizzes')} className={`flex-1 py-3 text-sm font-medium ${activeTab === 'quizzes' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:text-white'}`}>Quizzes da IA</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                {(activeTab === 'simulados' ? simulados : customQuizzes).map((item: any) => (
                    <Card key={item.id} className={`flex flex-col p-6 ${item.isCompleted ? 'bg-green-900/10 border-green-700/30' : ''}`}>
                        <div className="flex-grow">
                            <div className="flex justify-between items-start">
                                <h3 className="text-xl font-bold text-cyan-400">{item.name}</h3>
                                {item.isCompleted && <CheckCircleIcon className="h-5 w-5 text-green-400" />}
                            </div>
                            <p className="text-sm text-gray-400 mt-2">{item.questions.length} questões</p>
                        </div>
                        <div className="mt-6 flex flex-col gap-2">
                            <Button onClick={() => activeTab === 'quizzes' ? onStartQuiz(item) : onStartSimulado(item)}>
                                {item.isCompleted ? 'Refazer' : 'Iniciar'}
                            </Button>
                            <div className="flex gap-2">
                                {activeTab === 'simulados' && (
                                    <Button onClick={() => handleGeneratePdf(item)} disabled={!!isGeneratingPdf} className="flex-1 bg-gray-700 hover:bg-gray-600">
                                        {isGeneratingPdf === item.id ? <Spinner /> : <DownloadIcon className="h-4 w-4" />}
                                    </Button>
                                )}
                                <Button onClick={() => activeTab === 'quizzes' ? onDeleteQuiz(item.id) : onDeleteSimulado(item.id)} className="p-2 bg-red-600 hover:bg-red-700">
                                    <TrashIcon className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
            <SimuladoCreatorModal isOpen={isSimuladoCreatorOpen} onClose={() => setIsSimuladoCreatorOpen(false)} onSave={onSaveSimulado} allSubjects={allSubjects} studentProgress={studentProgress} />
        </div>
    );
};

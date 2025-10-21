import React, { useState } from 'react';
import { User, Simulado } from '../../types';
import * as GeminiService from '../../services/geminiService';
import * as FirebaseService from '../../services/firebaseService';
import { fileToBase64 } from '../../utils';
import { Modal, Button, Spinner } from '../ui';
import { GeminiIcon, UserCircleIcon } from '../Icons';

interface AiSimuladoGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    allStudents: User[];
    setToastMessage: (message: string) => void;
}

export const AiSimuladoGeneratorModal: React.FC<AiSimuladoGeneratorModalProps> = ({
    isOpen,
    onClose,
    allStudents,
    setToastMessage,
}) => {
    const [file, setFile] = useState<File | null>(null);
    const [simuladoName, setSimuladoName] = useState('');
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleGenerateAndSend = async () => {
        if (!file) {
            setError('Por favor, selecione um arquivo PDF.');
            return;
        }
        if (!simuladoName.trim()) {
            setError('Por favor, dê um nome ao simulado.');
            return;
        }
        if (selectedStudentIds.length === 0) {
            setError('Selecione pelo menos um aluno para enviar o simulado.');
            return;
        }

        setError('');
        setIsLoading(true);

        try {
            const base64 = await fileToBase64(file);
            const questions = await GeminiService.extractQuestionsFromTecPdf(base64, true);

            if (questions.length === 0) {
                throw new Error('Nenhuma questão foi extraída do PDF. Verifique o formato do arquivo.');
            }

            const simuladoData: Omit<Simulado, 'id' | 'isCompleted' | 'attempts' | 'createdAt'> = {
                name: simuladoName,
                questions: questions.map(q => ({ ...q, id: `q-sim-prof-${Date.now()}-${Math.random()}`})),
                config: {
                    subjects: [], // Not applicable for this generation method
                    filter: 'mixed',
                    durationInSeconds: questions.length * 2 * 60, // 2 minutes per question
                    feedbackMode: 'at_end',
                },
            };

            await FirebaseService.addSimuladoToStudents(selectedStudentIds, simuladoData);

            setToastMessage('Simulado gerado e enviado para os alunos com sucesso!');
            onClose();

        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleStudent = (studentId: string) => {
        setSelectedStudentIds(prev =>
            prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
        );
    };

    const handleToggleAll = () => {
        if (selectedStudentIds.length === allStudents.length) {
            setSelectedStudentIds([]);
        } else {
            setSelectedStudentIds(allStudents.map(s => s.id));
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Gerar Simulado de PDF com IA" size="2xl">
            <div className="space-y-4">
                <p className="text-gray-400">
                    Faça o upload de um simulado em PDF. A IA irá extrair as questões e criar uma atividade na área de prática dos alunos selecionados.
                </p>
                
                <div>
                    <label htmlFor="simulado-ai-name" className="block text-sm font-medium text-gray-300">Nome do Simulado</label>
                    <input id="simulado-ai-name" type="text" value={simuladoName} onChange={e => setSimuladoName(e.target.value)} required className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white" />
                </div>
                
                <div className="flex items-center space-x-4">
                    <label className="cursor-pointer bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md">
                        <span>Selecionar PDF</span>
                        <input type="file" accept="application/pdf" onChange={e => e.target.files && setFile(e.target.files[0])} className="hidden" />
                    </label>
                    {file && <span className="text-gray-300 truncate">{file.name}</span>}
                </div>

                <div>
                    <div className="flex justify-between items-center mb-1">
                        <h4 className="text-sm font-medium text-gray-300">Selecione os Alunos</h4>
                        <label className="flex items-center space-x-2 text-xs cursor-pointer">
                            <input type="checkbox" checked={allStudents.length > 0 && selectedStudentIds.length === allStudents.length} onChange={handleToggleAll} className="h-4 w-4 rounded" />
                            <span>Todos</span>
                        </label>
                    </div>
                    <div className="h-48 overflow-y-auto space-y-2 p-2 bg-gray-900/50 rounded-lg border border-gray-700">
                        {allStudents.map(student => (
                            <label key={student.id} className="flex items-center space-x-3 p-2 hover:bg-gray-700 cursor-pointer rounded-md">
                                <input type="checkbox" checked={selectedStudentIds.includes(student.id)} onChange={() => handleToggleStudent(student.id)} className="h-4 w-4 rounded" />
                                <div className="flex items-center gap-2">
                                    {student.avatarUrl ? <img src={student.avatarUrl} alt="" className="h-6 w-6 rounded-full"/> : <UserCircleIcon className="h-6 w-6 text-gray-500"/>}
                                    <span className="text-sm">{student.name || student.username}</span>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="pt-4 flex justify-end items-center gap-4">
                     {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                    <Button onClick={handleGenerateAndSend} disabled={isLoading || !file || !simuladoName.trim() || selectedStudentIds.length === 0}>
                        {isLoading ? <><Spinner /> Gerando...</> : <><GeminiIcon className="h-5 w-5 mr-2" /> Gerar e Enviar</>}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

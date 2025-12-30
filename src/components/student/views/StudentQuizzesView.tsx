
import React from 'react';
import { StudentProgress, Simulado } from '../../../types';
import { Card, Button } from '../../ui';
import { CheckCircleIcon, TrashIcon } from '../../Icons';

interface StudentQuizzesViewProps {
    studentProgress: StudentProgress;
    onStartSimulado: (simulado: Simulado) => void;
    onDeleteSimulado: (simuladoId: string) => void;
}

export const StudentQuizzesView: React.FC<StudentQuizzesViewProps> = ({ studentProgress, onStartSimulado, onDeleteSimulado }) => {
    const simulados = studentProgress.simulados || [];

    if (simulados.length === 0) {
        return <p className="text-gray-400 text-center col-span-full">Nenhum simulado criado ainda.</p>;
    }

    return (
        <>
            {simulados.map((simulado: Simulado) => (
                <Card key={simulado.id} className={`flex flex-col p-6 transition-all ${simulado.isCompleted ? 'bg-green-900/20 border-green-700/50' : ''}`}>
                    <div className="flex-grow">
                        <div className="flex justify-between items-start">
                            <h3 className="text-xl font-bold text-cyan-400">{simulado.name}</h3>
                            {simulado.isCompleted && <CheckCircleIcon className="h-6 w-6 text-green-400" title="Concluído" />}
                        </div>
                        <p className="text-sm text-gray-400 mt-2">{simulado.questions.length} questões</p>
                        <p className="text-xs text-gray-500 mt-1">Criado em: {new Date(simulado.createdAt).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div className="mt-4 flex space-x-2">
                        <Button onClick={() => onStartSimulado(simulado)} className="text-sm flex-1 py-2">
                            {simulado.isCompleted ? 'Refazer Simulado' : 'Iniciar Simulado'}
                        </Button>
                        <Button onClick={() => onDeleteSimulado(simulado.id)} className="text-sm py-2 px-3 bg-red-600 hover:bg-red-700">
                            <TrashIcon className="h-4 w-4" />
                        </Button>
                    </div>
                </Card>
            ))}
        </>
    );
};

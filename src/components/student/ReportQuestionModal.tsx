import React, { useState } from 'react';
import { Modal, Button } from '../ui';
import { Question } from '../../types';

interface ReportQuestionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (reason: string) => void;
    question: Question;
}

const REPORT_REASONS = [
    "Questão incompleta",
    "Gabarito Errado",
    "Sem gabarito",
];

export const ReportQuestionModal: React.FC<ReportQuestionModalProps> = ({ isOpen, onClose, onSubmit, question }) => {
    const [selectedReason, setSelectedReason] = useState<string>('');
    
    const handleSubmit = () => {
        if (selectedReason) {
            onSubmit(selectedReason);
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Reportar Erro na Questão">
            <div className="space-y-4">
                <p className="text-gray-400">Ajude a melhorar o material selecionando o motivo do seu reporte para a questão:</p>
                <p className="p-3 bg-gray-900/50 rounded-md text-sm text-gray-300 truncate">"{question.statement}"</p>
                
                <fieldset className="space-y-2">
                    <legend className="sr-only">Motivos do reporte</legend>
                    {REPORT_REASONS.map(reason => (
                        <label key={reason} className="flex items-center space-x-3 p-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg cursor-pointer">
                            <input
                                type="radio"
                                name="report-reason"
                                value={reason}
                                checked={selectedReason === reason}
                                onChange={() => setSelectedReason(reason)}
                                className="h-5 w-5 text-cyan-500 bg-gray-800 border-gray-600 focus:ring-cyan-600"
                            />
                            <span className="text-white">{reason}</span>
                        </label>
                    ))}
                </fieldset>
                
                <div className="pt-4 flex justify-end">
                    <Button onClick={handleSubmit} disabled={!selectedReason}>
                        Enviar Reporte
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
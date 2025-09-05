import React, { useState, useEffect } from 'react';
import { Question } from '../../types';
import { Modal, Button } from '../ui';

interface ProfessorQuestionEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (question: Question) => void;
    question: Question | null;
}

export const ProfessorQuestionEditorModal: React.FC<ProfessorQuestionEditorModalProps> = ({ isOpen, onClose, onSave, question }) => {
    const [editedQuestion, setEditedQuestion] = useState<Question | null>(question);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setEditedQuestion(question);
            setError('');
        }
    }, [isOpen, question]);

    if (!isOpen || !editedQuestion) return null;

    const handleFieldChange = (field: keyof Question, value: string) => {
        setEditedQuestion(prev => prev ? { ...prev, [field]: value } : null);
    };
    
    const handleOptionChange = (optionIndex: number, value: string) => {
        if (!editedQuestion) return;
        const newOptions = [...editedQuestion.options];
        const oldOptionValue = editedQuestion.options[optionIndex];
        newOptions[optionIndex] = value;
        
        const newCorrectAnswer = editedQuestion.correctAnswer === oldOptionValue ? value : editedQuestion.correctAnswer;

        const newOptionJustifications = { ...editedQuestion.optionJustifications };
        if (newOptionJustifications && newOptionJustifications[oldOptionValue]) {
            newOptionJustifications[value] = newOptionJustifications[oldOptionValue];
            delete newOptionJustifications[oldOptionValue];
        }

        setEditedQuestion({ ...editedQuestion, options: newOptions, correctAnswer: newCorrectAnswer, optionJustifications: newOptionJustifications });
    };

    const handleCorrectAnswerChange = (newCorrectAnswer: string) => {
        if (!editedQuestion) return;
        setEditedQuestion({ ...editedQuestion, correctAnswer: newCorrectAnswer });
    };
    
    const handleOptionJustificationChange = (optionText: string, justification: string) => {
        if (!editedQuestion) return;
        const newOptionJustifications = { ...editedQuestion.optionJustifications, [optionText]: justification };
        setEditedQuestion({ ...editedQuestion, optionJustifications: newOptionJustifications });
    };

    const handleSaveClick = () => {
        if (editedQuestion) {
            if (!editedQuestion.correctAnswer || !editedQuestion.options.includes(editedQuestion.correctAnswer)) {
                setError('Por favor, selecione uma alternativa correta.');
                return;
            }
            setError('');
            onSave(editedQuestion);
            onClose();
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Editar Questão">
            <div className="space-y-4">
                 <div>
                    <label htmlFor="statement-edit" className="text-sm font-medium text-gray-400">Enunciado</label>
                    <textarea
                        id="statement-edit"
                        value={editedQuestion.statement}
                        onChange={e => handleFieldChange('statement', e.target.value)}
                        rows={5}
                        className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white"
                    />
                </div>
                 <div>
                    <label className="text-sm font-medium text-gray-400">Alternativas e Justificativas</label>
                    <div className="space-y-4 mt-1">
                        {editedQuestion.options.map((option, optionIndex) => (
                            <div key={optionIndex} className="p-2 bg-gray-800/60 rounded-md">
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="radio"
                                        name="correct-answer-edit"
                                        checked={editedQuestion.correctAnswer === option}
                                        onChange={() => handleCorrectAnswerChange(option)}
                                        className="h-5 w-5 text-cyan-500 bg-gray-600 border-gray-500 focus:ring-cyan-600"
                                    />
                                    <input
                                        type="text"
                                        value={option}
                                        onChange={e => handleOptionChange(optionIndex, e.target.value)}
                                        className="flex-grow bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white"
                                    />
                                </div>
                                <textarea
                                    value={editedQuestion.optionJustifications?.[option] || ''}
                                    onChange={e => handleOptionJustificationChange(option, e.target.value)}
                                    rows={2}
                                    placeholder={`Justificativa para a alternativa ${String.fromCharCode(65 + optionIndex)}...`}
                                    className="mt-2 block w-full bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white text-xs"
                                />
                            </div>
                        ))}
                    </div>
                </div>
                 <div>
                    <label htmlFor="justification-edit" className="text-sm font-medium text-gray-400">Justificativa da Resposta Correta (Geral)</label>
                    <textarea
                        id="justification-edit"
                        value={editedQuestion.justification}
                        onChange={e => handleFieldChange('justification', e.target.value)}
                        rows={4}
                        className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white"
                    />
                </div>
                <div className="pt-4 flex justify-end items-center gap-4">
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    <Button onClick={handleSaveClick}>Salvar Alterações</Button>
                </div>
            </div>
        </Modal>
    );
};
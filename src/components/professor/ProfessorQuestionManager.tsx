import React, { useState } from 'react';
import { Question } from '../../types';
import { Card, Button } from '../ui';
import { PlusIcon, SparklesIcon, TrashIcon, PencilIcon } from '../Icons';
import { AiQuestionGeneratorModal } from './AiQuestionGeneratorModal';
import { ProfessorQuestionEditorModal } from './ProfessorQuestionEditorModal';

interface ProfessorQuestionManagerProps {
    questions: Question[];
    onQuestionsChange: (questions: Question[]) => void;
    isTecExtraction?: boolean;
}

export const ProfessorQuestionManager: React.FC<ProfessorQuestionManagerProps> = ({ questions, onQuestionsChange, isTecExtraction = false }) => {
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

    const handleAddManualQuestion = () => {
        const newQuestion: Question = {
            id: `q-${Date.now()}`,
            statement: '',
            options: ['', '', '', '', ''],
            correctAnswer: '',
            justification: '',
            optionJustifications: {}
        };
        setEditingQuestion(newQuestion);
        setIsEditorModalOpen(true);
    };

    const handleEditQuestion = (question: Question) => {
        setEditingQuestion(question);
        setIsEditorModalOpen(true);
    };

    const handleDeleteQuestion = (questionId: string) => {
        if (window.confirm("Tem certeza que deseja apagar esta questão?")) {
            onQuestionsChange(questions.filter(q => q.id !== questionId));
        }
    };

    const handleSaveQuestion = (savedQuestion: Question) => {
        const index = questions.findIndex(q => q.id === savedQuestion.id);
        if (index > -1) {
            const newQuestions = [...questions];
            newQuestions[index] = savedQuestion;
            onQuestionsChange(newQuestions);
        } else {
            onQuestionsChange([...questions, savedQuestion]);
        }
    };

    const handleSaveAiQuestions = (newQuestions: Omit<Question, 'id'>[]) => {
        const questionsWithIds = newQuestions.map(q => ({
            ...q,
            id: `q-${Date.now()}-${Math.random()}`
        }));
        onQuestionsChange([...questions, ...questionsWithIds]);
    };

    return (
        <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">{isTecExtraction ? 'Questões Extraídas (TEC)' : 'Questões de Conteúdo'}</h3>
                <div className="flex items-center gap-2">
                    <Button onClick={() => setIsAiModalOpen(true)} className="text-sm py-2 px-3">
                        <SparklesIcon className="h-4 w-4 mr-2" /> {isTecExtraction ? 'Extrair com IA' : 'Gerar com IA'}
                    </Button>
                    <Button onClick={handleAddManualQuestion} className="text-sm py-2 px-3">
                        <PlusIcon className="h-4 w-4 mr-2" /> Adicionar Manualmente
                    </Button>
                </div>
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                {questions.map((q, index) => (
                    <div key={q.id} className="p-3 bg-gray-800/50 rounded-lg">
                        <div className="flex justify-between items-start">
                            <p className="text-sm text-gray-300 flex-grow pr-4"><strong>{index + 1}.</strong> {q.statement}</p>
                            <div className="flex space-x-2 flex-shrink-0">
                                <Button onClick={() => handleEditQuestion(q)} className="!p-2 text-sm"><PencilIcon className="h-4 w-4"/></Button>
                                <Button onClick={() => handleDeleteQuestion(q.id)} className="!p-2 text-sm bg-red-600 hover:bg-red-700"><TrashIcon className="h-4 w-4"/></Button>
                            </div>
                        </div>
                    </div>
                ))}
                {questions.length === 0 && <p className="text-center text-gray-500 py-4">Nenhuma questão adicionada.</p>}
            </div>

            <AiQuestionGeneratorModal 
                isOpen={isAiModalOpen} 
                onClose={() => setIsAiModalOpen(false)}
                onSaveQuestions={handleSaveAiQuestions}
                isTecExtraction={isTecExtraction}
            />

            <ProfessorQuestionEditorModal
                isOpen={isEditorModalOpen}
                onClose={() => setIsEditorModalOpen(false)}
                onSave={handleSaveQuestion}
                question={editingQuestion}
            />
        </Card>
    );
};
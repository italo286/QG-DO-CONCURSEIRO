import React, { useState, useEffect, useMemo } from 'react';
import { MockExam, Question, QuestionAttempt, StudentProgress, Subject, Topic, SubTopic } from '../../types';
import { Modal, Button, Spinner } from '../ui';
import { PlusIcon, TrashIcon } from '../Icons';

type FilterType = 'mixed' | 'incorrect' | 'correct' | 'unanswered' | 'answered';

interface StudentMockExamCreatorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (mockExam: MockExam) => void;
    allSubjects: Subject[];
    studentProgress: StudentProgress;
}

export const StudentMockExamCreatorModal: React.FC<StudentMockExamCreatorModalProps> = ({ isOpen, onClose, onSave, allSubjects, studentProgress }) => {
    const [mockExamName, setMockExamName] = useState('');
    const [subjectConfig, setSubjectConfig] = useState<{ [subjectId: string]: number }>({});
    const [questionFilter, setQuestionFilter] = useState<FilterType>('mixed');
    const [timerDuration, setTimerDuration] = useState<string>('unlimited');
    const [feedbackMode, setFeedbackMode] = useState<'instant' | 'final'>('final');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [availableCounts, setAvailableCounts] = useState<{ [subjectId: string]: number }>({});

    useEffect(() => {
        if (!isOpen) {
            setMockExamName('');
            setSubjectConfig({});
            setQuestionFilter('mixed');
            setTimerDuration('unlimited');
            setFeedbackMode('final');
            setIsLoading(false);
            setError('');
        }
    }, [isOpen]);

    const { allAnsweredIds, correctIds, incorrectIds } = useMemo(() => {
        const allAnsweredIds = new Set<string>();
        const correctAttempts: { [key: string]: boolean } = {};

        if (!studentProgress) return { allAnsweredIds, correctIds: new Set(), incorrectIds: new Set() };
        
        const allAttempts = [
            ...Object.values(studentProgress.progressByTopic).flatMap(s => Object.values(s).flatMap(t => t.lastAttempt)),
            ...(studentProgress.reviewSessions || []).flatMap(r => r.attempts || [])
        ];
        
        for (const attempt of allAttempts) {
            allAnsweredIds.add(attempt.questionId);
            correctAttempts[attempt.questionId] = attempt.isCorrect;
        }
        
        const correctIds = new Set<string>();
        const incorrectIds = new Set<string>();
        
        for (const qId in correctAttempts) {
            if (correctAttempts[qId]) {
                correctIds.add(qId);
            } else {
                incorrectIds.add(qId);
            }
        }

        return { allAnsweredIds, correctIds, incorrectIds };
    }, [studentProgress]);

    const getAvailableQuestions = (subject: Subject, filter: FilterType): Question[] => {
        let questions: Question[] = [];
        subject.topics.forEach(topic => {
            questions.push(...topic.questions);
            if (topic.tecQuestions) questions.push(...topic.tecQuestions);
            topic.subtopics.forEach(subtopic => {
                questions.push(...subtopic.questions);
                if (subtopic.tecQuestions) questions.push(...subtopic.tecQuestions);
            });
        });

        switch (filter) {
            case 'answered':
                return questions.filter(q => allAnsweredIds.has(q.id));
            case 'unanswered':
                return questions.filter(q => !allAnsweredIds.has(q.id));
            case 'correct':
                return questions.filter(q => correctIds.has(q.id));
            case 'incorrect':
                return questions.filter(q => incorrectIds.has(q.id));
            case 'mixed':
            default:
                return questions;
        }
    };

    useEffect(() => {
        const counts: { [subjectId: string]: number } = {};
        allSubjects.forEach(subject => {
            counts[subject.id] = getAvailableQuestions(subject, questionFilter).length;
        });
        setAvailableCounts(counts);
    }, [questionFilter, allSubjects, allAnsweredIds, correctIds, incorrectIds]);

    const handleSubjectToggle = (subjectId: string, isChecked: boolean) => {
        setSubjectConfig(prev => {
            const newConfig = { ...prev };
            if (isChecked) {
                newConfig[subjectId] = 10; // Default to 10 questions
            } else {
                delete newConfig[subjectId];
            }
            return newConfig;
        });
    };

    const handleQuestionCountChange = (subjectId: string, count: number) => {
        const maxCount = availableCounts[subjectId] || 0;
        const newCount = Math.max(0, Math.min(count, maxCount));
        setSubjectConfig(prev => ({ ...prev, [subjectId]: newCount }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mockExamName.trim()) {
            setError("Por favor, dê um nome ao seu simulado.");
            return;
        }
        if (Object.keys(subjectConfig).length === 0) {
            setError("Selecione pelo menos uma disciplina.");
            return;
        }
        setIsLoading(true);
        setError('');

        const finalQuestions: Question[] = [];
        const subjectsToProcess = Object.entries(subjectConfig);

        for (const [subjectId, questionCount] of subjectsToProcess) {
            if (questionCount > 0) {
                const subject = allSubjects.find(s => s.id === subjectId);
                if (subject) {
                    const available = getAvailableQuestions(subject, questionFilter);
                    if (available.length < questionCount) {
                        setError(`A disciplina "${subject.name}" não tem ${questionCount} questões disponíveis para o filtro selecionado (apenas ${available.length}).`);
                        setIsLoading(false);
                        return;
                    }
                    const shuffled = [...available].sort(() => 0.5 - Math.random());
                    finalQuestions.push(...shuffled.slice(0, questionCount));
                }
            }
        }
        
        if (finalQuestions.length === 0) {
            setError("Nenhuma questão foi selecionada. Por favor, adicione questões para pelo menos uma disciplina.");
            setIsLoading(false);
            return;
        }

        const newMockExam: MockExam = {
            id: `mock-exam-${Date.now()}`,
            name: mockExamName,
            questions: finalQuestions,
            isCompleted: false,
            attempts: [],
            createdAt: Date.now(),
            durationInSeconds: timerDuration === 'unlimited' ? 'unlimited' : Number(timerDuration),
            feedbackMode,
            config: {
                subjects: Object.entries(subjectConfig).map(([subjectId, questionCount]) => ({ subjectId, questionCount })),
                filter: questionFilter,
            }
        };

        onSave(newMockExam);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Criar Simulado Personalizado" size="3xl">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="mock-name" className="block text-sm font-medium text-gray-300">Nome do Simulado</label>
                    <input id="mock-name" type="text" value={mockExamName} onChange={e => setMockExamName(e.target.value)} required className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white" />
                </div>

                <div>
                    <label htmlFor="question-filter" className="block text-sm font-medium text-gray-300">Filtrar Questões</label>
                    <select id="question-filter" value={questionFilter} onChange={e => setQuestionFilter(e.target.value as FilterType)} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white">
                        <option value="mixed">Todas (Misto)</option>
                        <option value="unanswered">Nunca Respondidas</option>
                        <option value="incorrect">Questões que Errei</option>
                        <option value="correct">Questões que Acertei</option>
                        <option value="answered">Todas Respondidas</option>
                    </select>
                </div>

                <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-2">Disciplinas e Quantidade de Questões</h4>
                    <div className="space-y-3 max-h-60 overflow-y-auto p-2 border border-gray-700 rounded-lg">
                        {allSubjects.map(subject => (
                            <div key={subject.id} className="p-3 bg-gray-800 rounded-md">
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center space-x-3 cursor-pointer">
                                        <input type="checkbox" checked={!!subjectConfig[subject.id]} onChange={e => handleSubjectToggle(subject.id, e.target.checked)} className="h-5 w-5 rounded text-cyan-500 bg-gray-700 border-gray-600"/>
                                        <span className="font-semibold">{subject.name}</span>
                                    </label>
                                    <span className="text-xs text-gray-400">Disponíveis: {availableCounts[subject.id] ?? 0}</span>
                                </div>
                                {subjectConfig[subject.id] !== undefined && (
                                    <div className="mt-2 pl-8">
                                        <label htmlFor={`count-${subject.id}`} className="text-xs text-gray-400">Nº de questões:</label>
                                        <input
                                            id={`count-${subject.id}`}
                                            type="number"
                                            value={subjectConfig[subject.id]}
                                            onChange={e => handleQuestionCountChange(subject.id, parseInt(e.target.value, 10) || 0)}
                                            min="0"
                                            max={availableCounts[subject.id] || 0}
                                            className="ml-2 w-20 bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white"
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                        <label htmlFor="timer-duration" className="block text-sm font-medium text-gray-300">Tempo de Prova</label>
                        <select id="timer-duration" value={timerDuration} onChange={e => setTimerDuration(e.target.value)} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white">
                            <option value="unlimited">Sem limite de tempo</option>
                            <option value="1800">30 minutos</option>
                            <option value="3600">1 hora</option>
                            <option value="5400">1 hora e 30 minutos</option>
                            <option value="7200">2 horas</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300">Modo de Feedback</label>
                        <div className="mt-2 flex gap-4">
                            <label className="flex items-center"><input type="radio" name="feedback-mode" value="final" checked={feedbackMode === 'final'} onChange={e => setFeedbackMode(e.target.value as any)} className="h-4 w-4 mr-2"/>Gabarito no Final</label>
                            <label className="flex items-center"><input type="radio" name="feedback-mode" value="instant" checked={feedbackMode === 'instant'} onChange={e => setFeedbackMode(e.target.value as any)} className="h-4 w-4 mr-2"/>Resposta Imediata</label>
                        </div>
                    </div>
                </div>

                <div className="pt-4 flex justify-end items-center gap-4">
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    <Button type="submit" disabled={isLoading}>
                        {isLoading ? <Spinner /> : 'Criar Simulado'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

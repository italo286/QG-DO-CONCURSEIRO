import React, { useState, useEffect, useMemo } from 'react';
import { Simulado, StudentProgress, Subject, SimuladoConfig, Question, QuestionAttempt } from '../../types';
import { Modal, Button, Spinner } from '../ui';
import { PlusIcon, TrashIcon } from '../Icons';

interface SimuladoCreatorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (simulado: Simulado) => void;
    allSubjects: Subject[];
    studentProgress: StudentProgress;
}

export const SimuladoCreatorModal: React.FC<SimuladoCreatorModalProps> = ({ isOpen, onClose, onSave, allSubjects, studentProgress }) => {
    const [simuladoName, setSimuladoName] = useState('');
    const [config, setConfig] = useState<SimuladoConfig>({
        subjects: [],
        filter: 'mixed',
        durationInSeconds: 3600, // 1 hour default
        feedbackMode: 'at_end',
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setSimuladoName('');
            setConfig({
                subjects: [],
                filter: 'mixed',
                durationInSeconds: 3600,
                feedbackMode: 'at_end',
            });
            setIsLoading(false);
            setError('');
        }
    }, [isOpen]);
    
    const allQuestionsWithContext = useMemo(() => {
        return allSubjects.flatMap(subject => 
            subject.topics.flatMap(topic => 
                [
                    ...topic.questions.map(q => ({...q, subjectId: subject.id, topicId: topic.id })),
                    ...(topic.tecQuestions || []).map(q => ({...q, subjectId: subject.id, topicId: topic.id })),
                    ...topic.subtopics.flatMap(st => [
                        ...st.questions.map(q => ({...q, subjectId: subject.id, topicId: st.id})),
                        ...(st.tecQuestions || []).map(q => ({...q, subjectId: subject.id, topicId: st.id})),
                    ])
                ]
            )
        );
    }, [allSubjects]);

    const { attemptedIds, correctIds, incorrectIds } = useMemo(() => {
        const attempted = new Set<string>();
        const everCorrect = new Set<string>();
        const everIncorrect = new Set<string>();

        const processAttempts = (attempts: QuestionAttempt[] | undefined) => {
            (attempts || []).forEach(attempt => {
                attempted.add(attempt.questionId);
                if (attempt.isCorrect) {
                    everCorrect.add(attempt.questionId);
                } else {
                    everIncorrect.add(attempt.questionId);
                }
            });
        };
        
        // From topic quizzes
        Object.values(studentProgress.progressByTopic || {}).forEach(subject => {
            Object.values(subject || {}).forEach(topic => processAttempts(topic.lastAttempt));
        });
        // From review sessions
        (studentProgress.reviewSessions || []).forEach(session => processAttempts(session.attempts));
        // From custom quizzes
        (studentProgress.customQuizzes || []).forEach(quiz => processAttempts(quiz.attempts));
        // From past simulados
        (studentProgress.simulados || []).forEach(simulado => processAttempts(simulado.attempts));

        // "Certas": questions answered correctly and NEVER incorrectly.
        const correctOnlyIds = new Set([...everCorrect].filter(id => !everIncorrect.has(id)));
        
        // "Erradas": questions that have been answered incorrectly at least once.
        const incorrectEverIds = everIncorrect;

        return { attemptedIds: attempted, correctIds: correctOnlyIds, incorrectIds: incorrectEverIds };
    }, [studentProgress]);

    const getAvailableQuestionCount = (subjectId: string, filter: string): number => {
        let subjectQuestions = allQuestionsWithContext.filter(q => q.subjectId === subjectId);

        switch (filter) {
            case 'unanswered':
                return subjectQuestions.filter(q => !attemptedIds.has(q.id)).length;
            case 'incorrect':
                return subjectQuestions.filter(q => incorrectIds.has(q.id)).length;
            case 'correct':
                return subjectQuestions.filter(q => correctIds.has(q.id)).length;
            case 'answered':
                return subjectQuestions.filter(q => attemptedIds.has(q.id)).length;
            case 'mixed':
            default:
                return subjectQuestions.length;
        }
    };

    const handleSave = () => {
        if (!simuladoName.trim()) {
            setError('Por favor, dê um nome ao simulado.');
            return;
        }
        if (config.subjects.length === 0 || config.subjects.every(s => s.questionCount === 0)) {
            setError('Adicione pelo menos uma disciplina com questões.');
            return;
        }
        setError('');

        let filteredQuestions = allQuestionsWithContext;

        switch (config.filter) {
            case 'unanswered':
                filteredQuestions = allQuestionsWithContext.filter(q => !attemptedIds.has(q.id));
                break;
            case 'incorrect':
                filteredQuestions = allQuestionsWithContext.filter(q => incorrectIds.has(q.id));
                break;
            case 'correct':
                 filteredQuestions = allQuestionsWithContext.filter(q => correctIds.has(q.id));
                break;
            case 'answered':
                 filteredQuestions = allQuestionsWithContext.filter(q => attemptedIds.has(q.id));
                break;
            case 'mixed':
            default:
                break;
        }
        
        const finalQuestions: Question[] = [];
        config.subjects.forEach(subjectConfig => {
            const questionsForSubject = filteredQuestions.filter(q => q.subjectId === subjectConfig.subjectId);
            const shuffled = [...questionsForSubject].sort(() => 0.5 - Math.random());
            finalQuestions.push(...shuffled.slice(0, subjectConfig.questionCount));
        });

        if(finalQuestions.length === 0) {
            setError('Nenhuma questão encontrada com os filtros selecionados.');
            return;
        }

        const newSimulado: Simulado = {
            id: `simulado-${Date.now()}`,
            name: simuladoName,
            createdAt: Date.now(),
            questions: finalQuestions.sort(() => 0.5 - Math.random()), // Shuffle final list
            config,
            isCompleted: false,
        };
        onSave(newSimulado);
        onClose();
    };

    const handleSubjectConfigChange = (index: number, field: 'subjectId' | 'questionCount', value: string | number) => {
        const newSubjects = [...config.subjects];
        if (field === 'questionCount') {
            const subjectId = newSubjects[index].subjectId;
            const maxQuestions = getAvailableQuestionCount(subjectId, config.filter);
            (newSubjects[index] as any)[field] = Math.min(Number(value), maxQuestions);
        } else {
            (newSubjects[index] as any)[field] = value;
        }
        setConfig(prev => ({ ...prev, subjects: newSubjects }));
    };

    const addSubjectConfig = () => {
        const firstAvailableSubject = allSubjects.find(s => !config.subjects.some(cs => cs.subjectId === s.id));
        if (firstAvailableSubject) {
            setConfig(prev => ({ ...prev, subjects: [...prev.subjects, { subjectId: firstAvailableSubject.id, questionCount: 10 }] }));
        }
    };

    const removeSubjectConfig = (index: number) => {
        setConfig(prev => ({...prev, subjects: prev.subjects.filter((_, i) => i !== index)}));
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Criar Novo Simulado" size="2xl">
            <div className="space-y-6">
                <div>
                    <label htmlFor="simulado-name" className="block text-sm font-medium text-gray-300">Nome do Simulado</label>
                    <input id="simulado-name" type="text" value={simuladoName} onChange={e => setSimuladoName(e.target.value)} required className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white" />
                </div>

                <div className="space-y-2 p-3 bg-gray-900/50 rounded-lg">
                    <h4 className="font-semibold text-gray-300">Disciplinas e Questões</h4>
                    {config.subjects.map((subjectConfig, index) => (
                        <div key={index} className="grid grid-cols-3 gap-2 items-center">
                             <select value={subjectConfig.subjectId} onChange={e => handleSubjectConfigChange(index, 'subjectId', e.target.value)} className="col-span-2 bg-gray-700 rounded p-2 text-sm">
                                {allSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <div className="flex items-center">
                                <input type="number" value={subjectConfig.questionCount} onChange={e => handleSubjectConfigChange(index, 'questionCount', Number(e.target.value))} min="1" max="100" placeholder="Qtd" className="bg-gray-700 rounded p-2 text-sm flex-grow w-full" />
                                <span className="text-xs text-gray-400 ml-2 whitespace-nowrap">
                                    / {getAvailableQuestionCount(subjectConfig.subjectId, config.filter)}
                                </span>
                                <button onClick={() => removeSubjectConfig(index)} className="p-1 text-red-500 hover:text-red-400"><TrashIcon className="h-4 w-4"/></button>
                            </div>
                        </div>
                    ))}
                    <Button onClick={addSubjectConfig} type="button" className="text-xs py-1 px-2"><PlusIcon className="h-3 w-3 mr-1"/> Adicionar Disciplina</Button>
                </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div>
                        <label htmlFor="simulado-filter" className="block text-sm font-medium text-gray-300">Filtrar Questões</label>
                        <select id="simulado-filter" value={config.filter} onChange={e => setConfig(prev => ({ ...prev, filter: e.target.value as any }))} className="mt-1 block w-full bg-gray-700 rounded p-2 text-sm">
                            <option value="mixed">Todas</option>
                            <option value="incorrect">Apenas Erradas</option>
                            <option value="correct">Apenas Certas</option>
                            <option value="unanswered">Apenas Não Respondidas</option>
                             <option value="answered">Todas Respondidas</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="simulado-duration" className="block text-sm font-medium text-gray-300">Duração (minutos)</label>
                        <input id="simulado-duration" type="number" value={(config.durationInSeconds || 0) / 60} onChange={e => setConfig(prev => ({ ...prev, durationInSeconds: Number(e.target.value) * 60 }))} min="5" className="mt-1 block w-full bg-gray-700 rounded p-2 text-sm" />
                    </div>
                    <div>
                        <label htmlFor="simulado-feedback" className="block text-sm font-medium text-gray-300">Feedback</label>
                         <select id="simulado-feedback" value={config.feedbackMode} onChange={e => setConfig(prev => ({ ...prev, feedbackMode: e.target.value as any }))} className="mt-1 block w-full bg-gray-700 rounded p-2 text-sm">
                            <option value="at_end">Apenas no Final</option>
                            <option value="immediate">Imediato</option>
                        </select>
                    </div>
                 </div>

                <div className="pt-4 flex justify-end items-center gap-4">
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    <Button onClick={handleSave} disabled={isLoading}>
                        {isLoading ? <Spinner /> : 'Criar e Salvar Simulado'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
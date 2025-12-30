
import React, { useState, useEffect, useMemo } from 'react';
import * as FirebaseService from '../../services/firebaseService';
import { User, Subject, StudyPlan } from '../../types';
import { getWeekDates, getLocalDateISOString } from '../../utils';
import { Card, Button, Spinner } from '../ui';

export const ProfessorScheduler: React.FC<{ subjects: Subject[], students: User[] }> = ({ subjects, students }) => {
    const [selectedStudentId, setSelectedStudentId] = useState<string>('');
    const [weekStart, setWeekStart] = useState(new Date());
    const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
    const [allStudyPlans, setAllStudyPlans] = useState<{ [studentId: string]: StudyPlan }>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [editedPlan, setEditedPlan] = useState<StudyPlan['plan'] | null>(null);
    const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
    const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

    useEffect(() => {
        setIsLoading(true);
        const studentIds = students.map(s => s.id);
        const unsubscribe = FirebaseService.listenToStudyPlansForTeacher(studentIds, (plans) => {
            setAllStudyPlans(plans);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [students]);
    
    useEffect(() => {
        // Set initial selected subject
        if (subjects.length > 0 && !selectedSubjectId) {
            setSelectedSubjectId(subjects[0].id);
        }
    }, [subjects, selectedSubjectId]);

    useEffect(() => {
        if (selectedStudentId && allStudyPlans[selectedStudentId]) {
            setEditedPlan(allStudyPlans[selectedStudentId].plan);
        } else if (selectedStudentId) {
            setEditedPlan({});
        } else {
            setEditedPlan(null);
        }
    }, [selectedStudentId, allStudyPlans]);
    
    const changeWeek = (direction: 'prev' | 'next') => {
        const newDate = new Date(weekStart);
        newDate.setDate(newDate.getDate() + (direction === 'prev' ? -7 : 7));
        setWeekStart(newDate);
    };

    const handleStudentChange = (studentId: string) => {
        setSelectedStudentId(studentId);
    };

    const handleSavePlan = async () => {
        if (!selectedStudentId || editedPlan === null) {
            alert('Por favor, selecione um aluno.');
            return;
        }
        setIsSaving(true);
        // FIX: Added missing 'plans' property by spreading current student plan to satisfy StudyPlan interface.
        await FirebaseService.saveStudyPlanForStudent({
            ...(allStudyPlans[selectedStudentId] || { plans: [] }),
            studentId: selectedStudentId,
            plan: editedPlan,
        });
        setIsSaving(false);
        alert('Cronograma salvo com sucesso!');
    };
    
    const addTopicToDate = (topicId: string, dateISO: string) => {
        if (!topicId || editedPlan === null) return;
        const topicsForDay = editedPlan[dateISO] || [];
        if (!topicsForDay.includes(topicId)) {
            const newPlan = { ...editedPlan };
            newPlan[dateISO] = [...topicsForDay, topicId];
            setEditedPlan(newPlan);
        }
    };

    const handleTopicClick = (topicId: string) => {
        setSelectedTopicId(prev => prev === topicId ? null : topicId);
    };

    const handleDayClick = (dateISO: string) => {
        if (selectedTopicId) {
            addTopicToDate(selectedTopicId, dateISO);
            setSelectedTopicId(null); // Deselect after placing
        }
    };

    const removeTopicFromPlan = (dateISO: string, topicId: string) => {
        if (editedPlan === null) return;
        const updatedTopics = (editedPlan[dateISO] || []).filter(id => id !== topicId);
        const newPlan = { ...editedPlan, [dateISO]: updatedTopics };
        setEditedPlan(newPlan);
    }
    
    const allTopicsAndSubtopics = useMemo(() => {
        const items: {id: string, name: string}[] = [];
        subjects.forEach(s => {
            s.topics.forEach(t => {
                items.push({ id: t.id, name: t.name });
                t.subtopics.forEach(st => {
                    items.push({ id: st.id, name: st.name });
                })
            })
        });
        return items;
    }, [subjects]);

    const getTopicName = (topicId: string) => {
        return allTopicsAndSubtopics.find(t => t.id === topicId)?.name || 'Tópico inválido';
    };

    const topicsForSelectedSubject = useMemo(() => {
        if (!selectedSubjectId) return [];
        const subject = subjects.find(s => s.id === selectedSubjectId);
        if (!subject) return [];
        return subject.topics;
    }, [selectedSubjectId, subjects]);

    return (
        <div 
            className="flex gap-8" 
            style={{ height: 'calc(100vh - 220px)' }}
        >
            <aside className="w-96 flex-shrink-0">
                <Card className="p-6 flex flex-col h-full">
                    <h3 className="text-lg font-bold mb-4 text-white">Clique em um Tópico, depois no dia</h3>
                    {!selectedStudentId && (
                        <div className="p-3 mb-4 rounded-md bg-yellow-900/50 border border-yellow-700 text-yellow-200 text-sm">
                            <p>Selecione um aluno para começar a planejar.</p>
                        </div>
                    )}
                     <select
                        value={selectedSubjectId}
                        onChange={e => setSelectedSubjectId(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white mb-4"
                        aria-label="Selecionar Disciplina"
                    >
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>

                    <ul className="space-y-2 overflow-y-auto flex-grow pr-2">
                        {topicsForSelectedSubject.map(topic => (
                            <React.Fragment key={topic.id}>
                                <li
                                    onClick={() => !!selectedStudentId && handleTopicClick(topic.id)}
                                    className={`p-3 rounded-md text-base font-semibold transition-colors ${!!selectedStudentId ? 'cursor-pointer hover:bg-gray-600' : 'bg-gray-800 text-gray-500 cursor-not-allowed'} ${selectedTopicId === topic.id ? 'ring-2 ring-cyan-400 bg-gray-600' : 'bg-gray-700'}`}
                                    aria-disabled={!selectedStudentId}
                                >
                                    {topic.name}
                                </li>
                                {topic.subtopics.length > 0 && (
                                    <ul className="space-y-1.5 pl-4">
                                        {topic.subtopics.map(subtopic => (
                                            <li
                                                key={subtopic.id}
                                                onClick={() => !!selectedStudentId && handleTopicClick(subtopic.id)}
                                                className={`p-2.5 rounded-md text-sm transition-colors ${!!selectedStudentId ? 'cursor-pointer hover:bg-gray-500' : 'bg-gray-700 text-gray-500 cursor-not-allowed'} ${selectedTopicId === subtopic.id ? 'ring-2 ring-cyan-400 bg-gray-500' : 'bg-gray-600'}`}
                                                aria-disabled={!selectedStudentId}
                                            >
                                                {subtopic.name}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </React.Fragment>
                        ))}
                    </ul>
                </Card>
            </aside>

            <div className="flex-1">
                <Card className="p-6 flex flex-col h-full">
                    <div className="flex justify-between items-center mb-4 flex-shrink-0">
                        <select
                            value={selectedStudentId}
                            onChange={e => handleStudentChange(e.target.value)}
                            className="bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
                            aria-label="Selecionar Aluno"
                        >
                            <option value="" disabled>Selecione um Aluno</option>
                            {students.map(s => <option key={s.id} value={s.id}>{s.name || s.username}</option>)}
                        </select>

                        <Button onClick={handleSavePlan} disabled={!selectedStudentId || isSaving || isLoading}>
                            {isSaving ? <Spinner/> : 'Salvar Cronograma'}
                        </Button>
                    </div>

                    <div className="flex justify-center items-center gap-4 mb-4 flex-shrink-0">
                        <Button onClick={() => changeWeek('prev')} className="py-2 px-3 text-sm">&lt; Anterior</Button>
                        <div className="text-center font-semibold text-lg text-white">
                            {weekDates[0].toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})} - {weekDates[6].toLocaleDateString('pt-BR', {day: '2-digit', month: 'short', year: 'numeric'})}
                        </div>
                        <Button onClick={() => changeWeek('next')} className="py-2 px-3 text-sm">Próxima &gt;</Button>
                    </div>


                    {selectedStudentId ? (
                        <div className="flex flex-row gap-4 flex-grow">
                            {weekDates.map((date) => {
                                const dateISO = getLocalDateISOString(date);
                                const topicsForDay = editedPlan?.[dateISO] || [];
                                return (
                                    <div
                                        key={dateISO}
                                        onClick={() => handleDayClick(dateISO)}
                                        className={`flex-1 bg-gray-900/50 rounded-lg p-4 flex flex-col gap-2 overflow-y-auto transition-colors ${selectedTopicId ? 'cursor-pointer hover:bg-gray-800' : ''}`}
                                    >
                                        <div className="text-center flex-shrink-0">
                                            <p className="font-bold text-white capitalize text-lg">{date.toLocaleDateString('pt-BR', {weekday: 'short'}).replace('.', '')}</p>
                                            <p className="text-sm text-gray-400">{date.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})}</p>
                                        </div>
                                        <ul className="space-y-2 flex-grow">
                                            {topicsForDay.map(topicId => (
                                                <li key={topicId} className="relative group p-2 bg-cyan-800/70 rounded text-sm text-white">
                                                    {getTopicName(topicId)}
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); removeTopicFromPlan(dateISO, topicId); }}
                                                        className="absolute -top-1 -right-1 bg-red-500 rounded-full h-4 w-4 text-white text-xs hidden group-hover:flex items-center justify-center"
                                                        aria-label={`Remover ${getTopicName(topicId)}`}
                                                    >
                                                        &times;
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex-grow flex items-center justify-center text-gray-500">
                            <p>Selecione um aluno para visualizar ou editar o cronograma.</p>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};

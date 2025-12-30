
import React, { useState, useEffect, useMemo } from 'react';
import { StudyPlan, Subject, StudentProgress, Course } from '../../types';
import { getWeekDates, getLocalDateISOString } from '../../utils';
import { Card, Button, Spinner } from '../ui';
import { GeminiIcon, TrophyIcon, CalendarIcon, ListBulletIcon } from '../Icons';
import * as GeminiService from '../../services/geminiService';
import { WeeklyStudyGrid } from './WeeklyStudyGrid';

export const StudentScheduler: React.FC<{
    studyPlan: StudyPlan['plan'];
    weeklyRoutine: StudyPlan['weeklyRoutine'];
    subjects: Subject[];
    studentProgress: StudentProgress | null;
    onSavePlan: (plan: StudyPlan['plan'], weeklyRoutine: StudyPlan['weeklyRoutine']) => Promise<void>;
    enrolledCourses: Course[];
}> = ({ studyPlan, weeklyRoutine, subjects, studentProgress, onSavePlan, enrolledCourses }) => {
    const [activeTab, setActiveTab] = useState<'dates' | 'weekly'>('dates');
    const [editedPlan, setEditedPlan] = useState<StudyPlan['plan'] | null>(null);
    const [editedWeekly, setEditedWeekly] = useState<StudyPlan['weeklyRoutine'] | null>(null);
    const [weekStart, setWeekStart] = useState(new Date());
    const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
    const [isSaving, setIsSaving] = useState(false);
    const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
    const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
    const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

    useEffect(() => {
        setEditedPlan(studyPlan);
        setEditedWeekly(weeklyRoutine || {});
    }, [studyPlan, weeklyRoutine]);
    
    useEffect(() => {
        if (subjects.length > 0 && !selectedSubjectId) {
            setSelectedSubjectId(subjects[0].id);
        }
    }, [subjects, selectedSubjectId]);
    
    const allTopicsAndSubtopics = useMemo(() => {
        const items: {id: string, name: string, color?: string}[] = [];
        subjects.forEach(s => {
            s.topics.forEach(t => {
                items.push({ id: t.id, name: t.name, color: t.color });
                t.subtopics.forEach(st => {
                    items.push({ id: st.id, name: `${t.name} / ${st.name}`, color: st.color });
                })
            })
        });
        return items;
    }, [subjects]);

    const examDates = useMemo(() => {
        const events: { [dateISO: string]: { courseName: string }[] } = {};
        enrolledCourses.forEach(course => {
            if (course.editalInfo?.dataProva) {
                const dateObj = new Date(course.editalInfo.dataProva + 'T00:00:00');
                const dateISO = getLocalDateISOString(dateObj);
                if (!events[dateISO]) {
                    events[dateISO] = [];
                }
                events[dateISO].push({ courseName: course.name });
            }
        });
        return events;
    }, [enrolledCourses]);

    const getTopicName = (topicId: string) => {
        return allTopicsAndSubtopics.find(t => t.id === topicId)?.name || 'Tópico inválido';
    };

    const getTopicColor = (topicId: string) => {
        return allTopicsAndSubtopics.find(t => t.id === topicId)?.color;
    }
    
    const changeWeek = (direction: 'prev' | 'next') => {
        const newDate = new Date(weekStart);
        newDate.setDate(newDate.getDate() + (direction === 'prev' ? -7 : 7));
        setWeekStart(newDate);
    };

    const handleSave = async () => {
        if (!editedPlan || !editedWeekly) return;
        setIsSaving(true);
        await onSavePlan(editedPlan, editedWeekly);
        setIsSaving(false);
    };

    const addTopicToDate = (topicId: string, dateISO: string) => {
        if (!topicId || editedPlan === null) return;
        const newPlan = { ...editedPlan };
        const topicsForDay = newPlan[dateISO] || [];
        if (!topicsForDay.includes(topicId)) {
            newPlan[dateISO] = [...topicsForDay, topicId];
            setEditedPlan(newPlan);
        }
    };

    const updateWeeklyRoutine = (day: number, time: string, topicId: string | null) => {
        if (editedWeekly === null) return;
        const newWeekly = { ...editedWeekly };
        if (!newWeekly[day]) newWeekly[day] = {};
        
        if (topicId) {
            newWeekly[day][time] = topicId;
        } else {
            delete newWeekly[day][time];
        }
        setEditedWeekly(newWeekly);
    };

    const handleTopicClick = (topicId: string) => {
        setSelectedTopicId(prev => prev === topicId ? null : topicId);
    };

    const handleDayClick = (dateISO: string) => {
        if (selectedTopicId) {
            addTopicToDate(selectedTopicId, dateISO);
            setSelectedTopicId(null);
        }
    };

    const removeTopicFromPlan = (dateISO: string, topicId: string) => {
        if (editedPlan === null) return;
        const updatedTopics = (editedPlan[dateISO] || []).filter(id => id !== topicId);
        const newPlan = { ...editedPlan, [dateISO]: updatedTopics };
        setEditedPlan(newPlan);
    }

    const handleGenerateAiPlan = async () => {
        if (!studentProgress) return;
        setIsGeneratingPlan(true);
        try {
            const plan = await GeminiService.generateAdaptiveStudyPlan(subjects, studentProgress, 7);
            setEditedPlan(plan);
        } catch (error) {
            console.error("Error generating AI schedule:", error);
            alert("Não foi possível gerar o cronograma com a IA. Tente novamente.");
        } finally {
            setIsGeneratingPlan(false);
        }
    };
    
    const topicsForSelectedSubject = useMemo(() => {
        if (!selectedSubjectId) return [];
        const subject = subjects.find(s => s.id === selectedSubjectId);
        if (!subject) return [];
        return subject.topics;
    }, [selectedSubjectId, subjects]);

    return (
        <div 
            className="flex flex-col md:flex-row gap-8" 
            style={{ height: 'calc(100vh - 220px)' }}
        >
            <aside className="w-full md:w-96 flex-shrink-0">
                <Card className="p-6 flex flex-col h-full">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-white">Clique para Agendar</h3>
                         <Button onClick={handleGenerateAiPlan} disabled={isGeneratingPlan} className="text-sm py-1 px-2">
                            {isGeneratingPlan ? <Spinner /> : <><GeminiIcon className="h-4 w-4 mr-1"/> Gerar com IA</>}
                        </Button>
                    </div>

                    <p className="text-sm text-gray-400 mb-2">Selecione uma disciplina para ver os tópicos.</p>
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
                                    onClick={() => handleTopicClick(topic.id)}
                                    className={`p-3 rounded-md text-base font-semibold transition-colors cursor-pointer hover:bg-gray-600 ${selectedTopicId === topic.id ? 'ring-2 ring-cyan-400 bg-gray-600' : 'bg-gray-700'}`}
                                >
                                    {topic.name}
                                </li>
                                {topic.subtopics.length > 0 && (
                                    <ul className="space-y-1.5 pl-4">
                                        {topic.subtopics.map(subtopic => (
                                            <li
                                                key={subtopic.id}
                                                onClick={() => handleTopicClick(subtopic.id)}
                                                className={`p-2.5 rounded-md text-sm transition-colors cursor-pointer hover:bg-gray-500 ${selectedTopicId === subtopic.id ? 'ring-2 ring-cyan-400 bg-gray-500' : 'bg-gray-600'}`}
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

            <div className="flex-1 overflow-hidden flex flex-col gap-4">
                <div className="flex justify-between items-center flex-shrink-0">
                    <div className="flex bg-gray-800 p-1 rounded-lg">
                        <button 
                            onClick={() => setActiveTab('dates')} 
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'dates' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            <CalendarIcon className="h-4 w-4" /> Plano Diário
                        </button>
                        <button 
                            onClick={() => setActiveTab('weekly')} 
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'weekly' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            <ListBulletIcon className="h-4 w-4" /> Grade Semanal
                        </button>
                    </div>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Spinner/> : 'Salvar Cronograma'}
                    </Button>
                </div>

                <Card className="flex-grow p-6 flex flex-col overflow-hidden">
                    {activeTab === 'dates' ? (
                        <>
                            <div className="flex justify-center items-center gap-4 mb-4 flex-shrink-0">
                                <Button onClick={() => changeWeek('prev')} className="py-2 px-3 text-sm">&lt; Anterior</Button>
                                <div className="text-center font-semibold text-lg text-white">
                                    {weekDates[0].toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})} - {weekDates[6].toLocaleDateString('pt-BR', {day: '2-digit', month: 'short', year: 'numeric'})}
                                </div>
                                <Button onClick={() => changeWeek('next')} className="py-2 px-3 text-sm">Próxima &gt;</Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-7 gap-4 flex-grow overflow-y-auto">
                                {weekDates.map((date) => {
                                    const dateISO = getLocalDateISOString(date);
                                    const topicsForDay = editedPlan?.[dateISO] || [];
                                    const examsForDay = examDates[dateISO] || [];
                                    const isToday = new Date().toISOString().split('T')[0] === dateISO;
                                    
                                    return (
                                        <div
                                            key={dateISO}
                                            onClick={() => handleDayClick(dateISO)}
                                            className={`rounded-lg p-4 flex flex-col gap-2 transition-colors ${isToday ? 'bg-cyan-900/50 border border-cyan-700' : 'bg-gray-800'} ${selectedTopicId ? 'cursor-pointer hover:bg-gray-700' : ''}`}
                                        >
                                            <div className="text-center flex-shrink-0">
                                                <p className={`font-bold capitalize ${isToday ? 'text-cyan-400' : 'text-white'}`}>{date.toLocaleDateString('pt-BR', {weekday: 'short'}).replace('.', '')}</p>
                                                <p className="text-sm text-gray-400">{date.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})}</p>
                                            </div>
                                            <ul className="space-y-2 flex-grow">
                                                {examsForDay.map((exam, index) => (
                                                    <li
                                                        key={`exam-${index}`}
                                                        className="relative group p-2 bg-yellow-800/70 rounded text-sm text-yellow-200 flex items-center gap-2"
                                                    >
                                                        <TrophyIcon className="h-5 w-5 flex-shrink-0" />
                                                        <span className="font-bold uppercase text-[10px]">PROVA: {exam.courseName}</span>
                                                    </li>
                                                ))}
                                                {topicsForDay.map(topicId => (
                                                    <li
                                                        key={topicId}
                                                        className="relative group p-2 bg-cyan-800/70 rounded text-sm text-white"
                                                    >
                                                        {getTopicName(topicId)}
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); removeTopicFromPlan(dateISO, topicId); }}
                                                            className="absolute -top-1 -right-1 bg-red-500 rounded-full h-4 w-4 text-white text-xs hidden group-hover:flex items-center justify-center"
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
                        </>
                    ) : (
                        <div className="flex flex-col h-full">
                            <p className="text-sm text-gray-400 mb-4">Selecione um tópico na lista à esquerda e clique nos horários desejados na grade abaixo para montar sua rotina semanal.</p>
                            <div className="flex-grow overflow-y-auto">
                                <WeeklyStudyGrid 
                                    weeklyRoutine={editedWeekly || {}}
                                    onUpdateRoutine={updateWeeklyRoutine}
                                    selectedTopicId={selectedTopicId}
                                    getTopicName={getTopicName}
                                    getTopicColor={getTopicColor}
                                />
                            </div>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};

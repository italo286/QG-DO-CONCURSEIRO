
import React, { useState, useEffect, useMemo } from 'react';
import { StudyPlan, StudyPlanItem, Subject, StudentProgress, Course } from '../../types';
import { Card, Button, Spinner, Modal } from '../ui';
import { PlusIcon, TrashIcon, CheckCircleIcon, PencilIcon, BookOpenIcon, ListBulletIcon } from '../Icons';
import { WeeklyStudyGrid } from './WeeklyStudyGrid';

export const StudentScheduler: React.FC<{
    fullStudyPlan: StudyPlan;
    subjects: Subject[];
    studentProgress: StudentProgress | null;
    onSaveFullPlan: (fullPlan: StudyPlan) => Promise<void>;
    enrolledCourses: Course[];
}> = ({ fullStudyPlan, subjects, studentProgress, onSaveFullPlan, enrolledCourses }) => {
    const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newPlanName, setNewPlanName] = useState('');
    const [newPlanType, setNewPlanType] = useState<'standard' | 'custom'>('standard');
    const [isSaving, setIsSaving] = useState(false);

    const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
    const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

    const plans = fullStudyPlan.plans || [];
    const editingPlan = plans.find(p => p.id === editingPlanId);

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

    const getTopicName = (topicId: string) => {
        return allTopicsAndSubtopics.find(t => t.id === topicId)?.name || 'Tópico inválido';
    };

    const getTopicColor = (topicId: string) => {
        return allTopicsAndSubtopics.find(t => t.id === topicId)?.color;
    }

    const handleCreatePlan = async () => {
        if (!newPlanName.trim()) return;
        const newPlan: StudyPlanItem = {
            id: `plan-${Date.now()}`,
            name: newPlanName,
            type: newPlanType,
            weeklyRoutine: {}
        };
        const updatedPlan: StudyPlan = {
            ...fullStudyPlan,
            plans: [...plans, newPlan],
            activePlanId: fullStudyPlan.activePlanId || newPlan.id
        };
        await onSaveFullPlan(updatedPlan);
        setIsCreateModalOpen(false);
        setNewPlanName('');
        setEditingPlanId(newPlan.id);
    };

    const handleDeletePlan = async (id: string) => {
        if (!window.confirm('Excluir este planejamento permanentemente?')) return;
        const updatedPlans = plans.filter(p => p.id !== id);
        let activeId = fullStudyPlan.activePlanId;
        if (activeId === id) activeId = updatedPlans[0]?.id || undefined;
        
        await onSaveFullPlan({
            ...fullStudyPlan,
            plans: updatedPlans,
            activePlanId: activeId
        });
    };

    const handleSetActive = async (id: string) => {
        await onSaveFullPlan({ ...fullStudyPlan, activePlanId: id });
    };

    const updatePlanRoutine = async (day: number, time: string, content: string | null) => {
        if (!editingPlan) return;
        const newPlans = plans.map(p => {
            if (p.id === editingPlanId) {
                const routine = { ...p.weeklyRoutine };
                if (!routine[day]) routine[day] = {};
                if (content) routine[day][time] = content;
                else delete routine[day][time];
                return { ...p, weeklyRoutine: routine };
            }
            return p;
        });
        onSaveFullPlan({ ...fullStudyPlan, plans: newPlans });
    };

    const renameTimeSlot = async (oldTime: string, newTime: string) => {
        if (!editingPlan) return;
        const newPlans = plans.map(p => {
            if (p.id === editingPlanId) {
                const routine = { ...p.weeklyRoutine };
                for (let d = 0; d <= 6; d++) {
                    if (routine[d]?.[oldTime]) {
                        routine[d][newTime] = routine[d][oldTime];
                        delete routine[d][oldTime];
                    }
                }
                return { ...p, weeklyRoutine: routine };
            }
            return p;
        });
        onSaveFullPlan({ ...fullStudyPlan, plans: newPlans });
    };

    const removeTimeSlot = async (time: string) => {
        if (!editingPlan || !window.confirm(`Remover horário ${time}?`)) return;
        const newPlans = plans.map(p => {
            if (p.id === editingPlanId) {
                const routine = { ...p.weeklyRoutine };
                for (let d = 0; d <= 6; d++) delete routine[d]?.[time];
                return { ...p, weeklyRoutine: routine };
            }
            return p;
        });
        onSaveFullPlan({ ...fullStudyPlan, plans: newPlans });
    };

    const topicsForSelectedSubject = useMemo(() => {
        if (!selectedSubjectId) return [];
        return subjects.find(s => s.id === selectedSubjectId)?.topics || [];
    }, [selectedSubjectId, subjects]);

    if (editingPlan) {
        return (
            <div className="flex flex-col md:flex-row gap-8 h-[calc(100vh-220px)] animate-fade-in">
                {editingPlan.type === 'standard' && (
                    <aside className="w-full md:w-80 flex-shrink-0">
                        <Card className="p-6 flex flex-col h-full bg-gray-800/50 border-gray-700">
                            <h3 className="font-bold text-white mb-4">Temas da Plataforma</h3>
                            <select
                                value={selectedSubjectId}
                                onChange={e => setSelectedSubjectId(e.target.value)}
                                className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white mb-4 text-sm"
                            >
                                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <div className="flex-grow overflow-y-auto pr-2 space-y-1">
                                {topicsForSelectedSubject.map(topic => (
                                    <React.Fragment key={topic.id}>
                                        <div
                                            onClick={() => setSelectedTopicId(prev => prev === topic.id ? null : topic.id)}
                                            className={`p-2 rounded cursor-pointer transition-colors text-xs font-semibold ${selectedTopicId === topic.id ? 'bg-cyan-600 text-white ring-2 ring-cyan-400' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                                        >
                                            {topic.name}
                                        </div>
                                        {topic.subtopics.map(st => (
                                            <div
                                                key={st.id}
                                                onClick={() => setSelectedTopicId(prev => prev === st.id ? null : st.id)}
                                                className={`p-2 ml-3 rounded cursor-pointer transition-colors text-[10px] ${selectedTopicId === st.id ? 'bg-cyan-700 text-white ring-2 ring-cyan-400' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                                            >
                                                {st.name}
                                            </div>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </div>
                        </Card>
                    </aside>
                )}

                <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                    <div className="flex justify-between items-center">
                        <div>
                            <button onClick={() => setEditingPlanId(null)} className="text-cyan-400 text-sm hover:underline">← Galeria</button>
                            <h2 className="text-xl font-bold text-white mt-1">{editingPlan.name} <span className="text-xs font-normal text-gray-500">({editingPlan.type === 'standard' ? 'Padrão' : 'Personalizado'})</span></h2>
                        </div>
                        <div className="flex gap-2">
                             {fullStudyPlan.activePlanId !== editingPlan.id && (
                                 <Button onClick={() => handleSetActive(editingPlan.id)} className="text-xs py-1 px-3 bg-indigo-600 hover:bg-indigo-500">Ativar no Dashboard</Button>
                             )}
                        </div>
                    </div>
                    <Card className="flex-grow p-4 overflow-hidden flex flex-col bg-gray-800/30 border-gray-700">
                        <div className="flex-grow overflow-y-auto">
                            <WeeklyStudyGrid 
                                weeklyRoutine={editingPlan.weeklyRoutine}
                                onUpdateRoutine={updatePlanRoutine}
                                onRenameTime={renameTimeSlot}
                                onRemoveTime={removeTimeSlot}
                                onAddTime={() => {}}
                                selectedTopicId={selectedTopicId}
                                getTopicName={getTopicName}
                                getTopicColor={getTopicColor}
                                mode={editingPlan.type}
                            />
                        </div>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-white">Cronogramas de Estudo</h2>
                <Button onClick={() => setIsCreateModalOpen(true)}>
                    <PlusIcon className="h-5 w-5 mr-2" /> Novo Planejamento
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {plans.map(plan => (
                    <Card key={plan.id} className={`p-6 flex flex-col border-2 transition-all ${fullStudyPlan.activePlanId === plan.id ? 'border-cyan-500 bg-cyan-900/10' : 'border-gray-700 bg-gray-800/40'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex-grow">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                                    {fullStudyPlan.activePlanId === plan.id && (
                                        <span className="bg-cyan-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center">
                                            <CheckCircleIcon className="h-3 w-3 mr-1" /> ATIVO
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-semibold">
                                    Tipo: {plan.type === 'standard' ? 'Padrão (Semanal)' : 'Personalizado (Diário)'}
                                </p>
                            </div>
                            <button onClick={() => handleDeletePlan(plan.id)} className="text-gray-500 hover:text-red-400 p-1">
                                <TrashIcon className="h-5 w-5" />
                            </button>
                        </div>
                        
                        <div className="mt-auto flex gap-2">
                            <Button onClick={() => setEditingPlanId(plan.id)} className="flex-1 text-sm py-2 bg-gray-700 hover:bg-gray-600">
                                <PencilIcon className="h-4 w-4 mr-2" /> Editar
                            </Button>
                            {fullStudyPlan.activePlanId !== plan.id && (
                                <Button onClick={() => handleSetActive(plan.id)} className="flex-1 text-sm py-2 bg-indigo-600 hover:bg-indigo-500">
                                    Selecionar
                                </Button>
                            )}
                        </div>
                    </Card>
                ))}
                {plans.length === 0 && (
                    <Card className="col-span-full p-12 flex flex-col items-center justify-center text-center bg-gray-800/20 border-dashed border-gray-700">
                        <ListBulletIcon className="h-16 w-16 text-gray-600 mb-4" />
                        <h3 className="text-xl font-bold text-gray-400">Nenhum cronograma criado</h3>
                        <p className="text-gray-500 mt-2 max-w-sm">Crie seu primeiro planejamento para organizar seus estudos semanais ou diários.</p>
                        <Button onClick={() => setIsCreateModalOpen(true)} className="mt-6">Criar Agora</Button>
                    </Card>
                )}
            </div>

            <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Novo Planejamento">
                <div className="space-y-6 p-2">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Nome do Planejamento</label>
                        <input 
                            type="text" 
                            value={newPlanName} 
                            onChange={e => setNewPlanName(e.target.value)}
                            placeholder="Ex: Concurso Bombeiros 2025"
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-cyan-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-3">Tipo de Planejamento</label>
                        <div className="grid grid-cols-2 gap-4">
                            <button 
                                onClick={() => setNewPlanType('standard')}
                                className={`p-4 rounded-xl border-2 text-left transition-all ${newPlanType === 'standard' ? 'border-cyan-500 bg-cyan-900/20' : 'border-gray-700 bg-gray-800 hover:border-gray-600'}`}
                            >
                                <BookOpenIcon className="h-8 w-8 text-cyan-400 mb-2" />
                                <p className="font-bold text-white text-sm">Padrão</p>
                                <p className="text-[10px] text-gray-400 mt-1">Utilize as disciplinas e tópicos da plataforma.</p>
                            </button>
                            <button 
                                onClick={() => setNewPlanType('custom')}
                                className={`p-4 rounded-xl border-2 text-left transition-all ${newPlanType === 'custom' ? 'border-cyan-500 bg-cyan-900/20' : 'border-gray-700 bg-gray-800 hover:border-gray-600'}`}
                            >
                                <PencilIcon className="h-8 w-8 text-purple-400 mb-2" />
                                <p className="font-bold text-white text-sm">Personalizado</p>
                                <p className="text-[10px] text-gray-400 mt-1">Digite manualmente seu conteúdo por horário.</p>
                            </button>
                        </div>
                    </div>
                    <Button onClick={handleCreatePlan} disabled={!newPlanName.trim()} className="w-full py-4 mt-4">Criar Planejamento</Button>
                </div>
            </Modal>
        </div>
    );
};

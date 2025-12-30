
import React, { useState, useMemo } from 'react';
import { StudyPlan, StudyPlanItem, Subject } from '../../types';
import { Card, Button, Modal, Spinner, Toast, ConfirmModal } from '../ui';
import { PlusIcon, TrashIcon, CheckCircleIcon, PencilIcon, SaveIcon, ArrowRightIcon, CalendarIcon, GeminiIcon, BellIcon, CycleIcon } from '../Icons';
import { WeeklyStudyGrid } from './WeeklyStudyGrid';

export const StudentScheduler: React.FC<{
    fullStudyPlan: StudyPlan;
    subjects: Subject[];
    onSaveFullPlan: (fullPlan: StudyPlan) => Promise<void>;
}> = ({ fullStudyPlan, subjects, onSaveFullPlan }) => {
    const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newPlanName, setNewPlanName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    // Topic Picker Modal State
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [pickerTarget, setPickerTarget] = useState<{ day: number, time: string } | null>(null);
    const [pickerSearch, setPickerSearch] = useState('');

    const plans = fullStudyPlan.plans || [];
    const editingPlan = plans.find(p => p.id === editingPlanId);

    const allTopicsAndSubtopics = useMemo(() => {
        const items: {id: string, name: string, subjectName: string, color?: string}[] = [];
        subjects.forEach(s => {
            s.topics.forEach(t => {
                items.push({ id: t.id, name: t.name, subjectName: s.name, color: t.color });
                t.subtopics.forEach(st => {
                    items.push({ id: st.id, name: st.name, subjectName: `${s.name} > ${t.name}`, color: st.color });
                })
            })
        });
        return items;
    }, [subjects]);

    const filteredPickerItems = useMemo(() => {
        if (!pickerSearch.trim()) return allTopicsAndSubtopics;
        const search = pickerSearch.toLowerCase();
        return allTopicsAndSubtopics.filter(item => 
            item.name.toLowerCase().includes(search) || 
            item.subjectName.toLowerCase().includes(search)
        );
    }, [allTopicsAndSubtopics, pickerSearch]);

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
            type: 'standard',
            settings: {
                recurrence: 'weekly',
                notifications: true,
                intensity: 'moderate'
            },
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
        setToastMessage("Planejamento criado com sucesso!");
    };

    const executeDeletePlan = async () => {
        if (!confirmDeleteId) return;
        const updatedPlans = plans.filter(p => p.id !== confirmDeleteId);
        let activeId = fullStudyPlan.activePlanId;
        if (activeId === confirmDeleteId) activeId = updatedPlans.length > 0 ? updatedPlans[0].id : "";
        const updatedPlan: StudyPlan = { ...fullStudyPlan, plans: updatedPlans, activePlanId: activeId || "" };
        await onSaveFullPlan(updatedPlan);
        setToastMessage("Planejamento excluído.");
        setConfirmDeleteId(null);
    };

    const handleSetActive = async (id: string) => {
        await onSaveFullPlan({ ...fullStudyPlan, activePlanId: id });
        setToastMessage("Este agora é seu plano principal!");
    };

    const handleManualSave = async () => {
        setIsSaving(true);
        try {
            await onSaveFullPlan(fullStudyPlan);
            setToastMessage("Alterações salvas com sucesso!");
        } finally {
            setIsSaving(false);
        }
    }

    const updatePlanSettings = (field: string, value: any) => {
        if (!editingPlan) return;
        const newPlans = plans.map(p => {
            if (p.id === editingPlanId) {
                return { ...p, settings: { ...p.settings, [field]: value } };
            }
            return p;
        });
        onSaveFullPlan({ ...fullStudyPlan, plans: newPlans });
    };

    const updatePlanRoutine = async (day: number, time: string, content: string | null) => {
        if (!editingPlan) return;
        const newPlans = plans.map(p => {
            if (p.id === editingPlanId) {
                const routine = { ...p.weeklyRoutine };
                if (!routine[day]) routine[day] = {};
                if (content !== null) routine[day][time] = content;
                else delete routine[day][time];
                return { ...p, weeklyRoutine: routine };
            }
            return p;
        });
        onSaveFullPlan({ ...fullStudyPlan, plans: newPlans });
    };

    const addTimeSlot = () => {
        if (!editingPlan) return;
        
        const currentTimes = new Set<string>();
        Object.values(editingPlan.weeklyRoutine).forEach(day => {
            Object.keys(day).forEach(t => currentTimes.add(t));
        });

        let nextTime = "08:00";
        if (currentTimes.size > 0) {
            const sorted = Array.from(currentTimes).sort();
            const last = sorted[sorted.length - 1];
            const [h, m] = last.split(':').map(Number);
            nextTime = `${(h + 1).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        }

        // Adiciona um placeholder vazio na segunda-feira para a linha aparecer
        updatePlanRoutine(1, nextTime, "");
    };

    const renameTimeSlot = async (oldTime: string, newTime: string) => {
        if (!editingPlan) return;
        const newPlans = plans.map(p => {
            if (p.id === editingPlanId) {
                const routine = { ...p.weeklyRoutine };
                for (let d = 0; d <= 6; d++) {
                    if (routine[d] && routine[d].hasOwnProperty(oldTime)) {
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
        if (!editingPlan) return;
        const newPlans = plans.map(p => {
            if (p.id === editingPlanId) {
                const routine = { ...p.weeklyRoutine };
                for (let d = 0; d <= 6; d++) {
                    if (routine[d]) delete routine[d][time];
                }
                return { ...p, weeklyRoutine: routine };
            }
            return p;
        });
        onSaveFullPlan({ ...fullStudyPlan, plans: newPlans });
    };

    const handleOpenPicker = (day: number, time: string) => {
        setPickerTarget({ day, time });
        setPickerSearch('');
        setIsPickerOpen(true);
    };

    const handlePickTopic = (topicId: string) => {
        if (pickerTarget) {
            updatePlanRoutine(pickerTarget.day, pickerTarget.time, topicId);
            setIsPickerOpen(false);
            setPickerTarget(null);
        }
    };

    if (editingPlan) {
        return (
            <div className="flex flex-col gap-4 h-[calc(100vh-130px)] animate-fade-in">
                {toastMessage && <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />}
                
                {/* Header Integrado e Compacto */}
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 bg-gray-800/60 p-4 rounded-xl border border-gray-700/50 shadow-lg">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setEditingPlanId(null)} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-cyan-400 transition-colors shadow-sm border border-gray-600">
                            <ArrowRightIcon className="h-5 w-5 rotate-180" />
                        </button>
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-3">
                                {editingPlan.name}
                                <span className="hidden sm:inline text-[10px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-full uppercase tracking-tighter">Editor</span>
                            </h2>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                        {/* Recorrência */}
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/60 rounded-lg border border-gray-700/50">
                            <CycleIcon className="h-4 w-4 text-cyan-400" />
                            <select 
                                value={editingPlan.settings?.recurrence}
                                onChange={(e) => updatePlanSettings('recurrence', e.target.value)}
                                className="bg-transparent text-xs font-bold text-gray-300 focus:outline-none cursor-pointer appearance-none pr-1"
                            >
                                <option value="weekly">Semanal</option>
                                <option value="once">Única</option>
                            </select>
                        </div>

                        {/* Notificações */}
                        <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-900/60 rounded-lg border border-gray-700/50">
                            <BellIcon className={`h-4 w-4 ${editingPlan.settings?.notifications ? 'text-emerald-400' : 'text-gray-500'}`} />
                            <button 
                                onClick={() => updatePlanSettings('notifications', !editingPlan.settings?.notifications)}
                                className={`w-8 h-4 rounded-full relative transition-all ${editingPlan.settings?.notifications ? 'bg-emerald-600' : 'bg-gray-700'}`}
                            >
                                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${editingPlan.settings?.notifications ? 'left-4.5' : 'left-0.5'}`} />
                            </button>
                        </div>

                        {/* Salvar */}
                        <Button onClick={handleManualSave} disabled={isSaving} className="text-xs py-2 px-6 bg-emerald-600 hover:bg-emerald-500 border-none shadow-lg shadow-emerald-900/20 font-bold">
                            {isSaving ? <Spinner /> : <><SaveIcon className="h-4 w-4 mr-2" /> Salvar</>}
                        </Button>
                    </div>
                </div>

                {/* Grid Full Width - Ocupa o máximo de espaço */}
                <Card className="flex-grow p-1 overflow-hidden flex flex-col bg-gray-900/20 border-gray-800">
                    <div className="flex-grow overflow-y-auto custom-scrollbar">
                        <WeeklyStudyGrid 
                            weeklyRoutine={editingPlan.weeklyRoutine}
                            onUpdateRoutine={updatePlanRoutine}
                            onRenameTime={renameTimeSlot}
                            onRemoveTime={removeTimeSlot}
                            onAddTime={addTimeSlot}
                            onOpenPicker={handleOpenPicker}
                            selectedTopicId={null}
                            getTopicName={getTopicName}
                            getTopicColor={getTopicColor}
                        />
                    </div>
                </Card>

                {/* Modal Global de Picker */}
                <Modal isOpen={isPickerOpen} onClose={() => setIsPickerOpen(false)} title="Escolher Conteúdo" size="xl">
                    <div className="space-y-4">
                        <div className="relative">
                            <GeminiIcon className="absolute left-3 top-3 h-5 w-5 text-cyan-400" />
                            <input 
                                type="text"
                                value={pickerSearch}
                                onChange={e => setPickerSearch(e.target.value)}
                                placeholder="Pesquisar matéria ou assunto..."
                                className="w-full bg-gray-700 border border-gray-600 rounded-xl py-3 pl-11 pr-4 text-white focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                                autoFocus
                            />
                        </div>
                        <div className="max-h-[50vh] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                            {filteredPickerItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => handlePickTopic(item.id)}
                                    className="w-full text-left p-3 rounded-xl bg-gray-800 border border-gray-700 hover:border-cyan-500 hover:bg-gray-700 transition-all group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-cyan-500/70 mb-0.5">{item.subjectName}</p>
                                            <p className="font-bold text-white group-hover:text-cyan-400 transition-colors">{item.name}</p>
                                        </div>
                                        <div 
                                            className="w-3 h-3 rounded-full shadow-sm" 
                                            style={{ backgroundColor: item.color || '#0ea5e9' }}
                                        />
                                    </div>
                                </button>
                            ))}
                            {filteredPickerItems.length === 0 && (
                                <div className="text-center py-8 text-gray-500 italic">
                                    Nenhum tópico encontrado para "{pickerSearch}"
                                </div>
                            )}
                        </div>
                    </div>
                </Modal>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {toastMessage && <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />}
            
            <ConfirmModal 
                isOpen={!!confirmDeleteId}
                onClose={() => setConfirmDeleteId(null)}
                onConfirm={executeDeletePlan}
                title="Excluir Planejamento"
                message="Tem certeza que deseja excluir este planejamento permanentemente? Esta ação não pode ser desfeita."
                confirmLabel="Excluir"
                variant="danger"
            />

            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-white tracking-tight">Meus Cronogramas</h2>
                <Button onClick={() => setIsCreateModalOpen(true)}>
                    <PlusIcon className="h-5 w-5 mr-2" /> Novo Cronograma
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {plans.map(plan => (
                    <Card key={plan.id} className={`p-6 flex flex-col border-2 transition-all group ${fullStudyPlan.activePlanId === plan.id ? 'border-cyan-500 bg-cyan-900/10' : 'border-gray-700 bg-gray-800/40 hover:border-gray-600'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex-grow">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xl font-bold text-white group-hover:text-cyan-400 transition-colors">{plan.name}</h3>
                                    {fullStudyPlan.activePlanId === plan.id && (
                                        <span className="bg-cyan-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center animate-pulse">
                                            <CheckCircleIcon className="h-3 w-3 mr-1" /> ATIVO
                                        </span>
                                    )}
                                </div>
                                <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider font-bold">
                                    {plan.settings?.recurrence === 'weekly' ? 'Repete Semanalmente' : 'Válido para esta semana'}
                                </p>
                            </div>
                            <button onClick={() => setConfirmDeleteId(plan.id)} className="text-gray-500 hover:text-red-400 p-1">
                                <TrashIcon className="h-5 w-5" />
                            </button>
                        </div>
                        
                        <div className="mt-auto flex gap-2 pt-4">
                            <Button onClick={() => setEditingPlanId(plan.id)} className="flex-1 text-sm py-2 bg-gray-700 hover:bg-gray-600 border-none">
                                <PencilIcon className="h-4 w-4 mr-2" /> Configurar
                            </Button>
                            {fullStudyPlan.activePlanId !== plan.id && (
                                <Button onClick={() => handleSetActive(plan.id)} className="flex-1 text-sm py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 border-none font-bold">
                                    Ativar
                                </Button>
                            )}
                        </div>
                    </Card>
                ))}
                {plans.length === 0 && (
                    <Card className="col-span-full p-16 flex flex-col items-center justify-center text-center bg-gray-800/20 border-dashed border-2 border-gray-700/50 rounded-2xl">
                        <div className="bg-gray-800 p-6 rounded-full mb-6">
                            <CalendarIcon className="h-16 w-16 text-gray-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-300">Organize sua Aprovação</h3>
                        <p className="text-gray-500 mt-2 max-w-sm">Crie seu primeiro planejamento personalizado para gerenciar seus horários de estudo de forma eficiente.</p>
                        <Button onClick={() => setIsCreateModalOpen(true)} className="mt-8 scale-110">Criar Agora</Button>
                    </Card>
                )}
            </div>

            <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Novo Cronograma">
                <div className="space-y-6">
                    <div>
                        <label htmlFor="plan-name-input" className="block text-sm font-medium text-gray-400 mb-2">Qual o nome do seu planejamento?</label>
                        <input 
                            id="plan-name-input"
                            type="text" 
                            value={newPlanName} 
                            onChange={e => setNewPlanName(e.target.value)}
                            placeholder="Ex: Pós-Edital PF 2025"
                            className="w-full bg-gray-700 border border-gray-600 rounded-xl p-4 text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-all"
                            autoFocus
                        />
                    </div>
                    <Button onClick={handleCreatePlan} disabled={!newPlanName.trim()} className="w-full py-4 text-lg font-bold">Gerar Planejamento</Button>
                </div>
            </Modal>
        </div>
    );
};

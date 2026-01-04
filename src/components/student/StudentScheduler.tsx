
import React, { useState, useMemo, useEffect } from 'react';
import { StudyPlan, StudyPlanItem, Subject, SubTopic } from '../../types';
import { Card, Button, Modal, Spinner, Toast, ConfirmModal } from '../ui';
import { PlusIcon, TrashIcon, CheckCircleIcon, PencilIcon, SaveIcon, ArrowRightIcon, GeminiIcon, BellIcon, CycleIcon, DownloadIcon, SubjectIcon } from '../Icons';
import { WeeklyStudyGrid } from './WeeklyStudyGrid';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const StudentScheduler: React.FC<{
    fullStudyPlan: StudyPlan;
    subjects: Subject[];
    onSaveFullPlan: (fullPlan: StudyPlan) => Promise<void>;
}> = ({ fullStudyPlan, subjects, onSaveFullPlan }) => {
    const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newPlanName, setNewPlanName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    // Topic Picker Modal State
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [pickerTarget, setPickerTarget] = useState<{ day: number, time: string } | null>(null);
    const [pickerSearch, setPickerSearch] = useState('');
    const [selectedSubjectForPicker, setSelectedSubjectForPicker] = useState<string | null>(null);

    const plans = fullStudyPlan.plans || [];
    const editingPlan = plans.find(p => p.id === editingPlanId);

    useEffect(() => {
        if (!isPickerOpen) {
            setSelectedSubjectForPicker(null);
            setPickerSearch('');
        }
    }, [isPickerOpen]);

    const allTopicsAndSubtopics = useMemo(() => {
        const items: {id: string, name: string, subjectId: string, subjectName: string}[] = [];
        subjects.forEach(s => {
            s.topics.forEach(t => {
                items.push({ id: t.id, name: t.name, subjectId: s.id, subjectName: s.name });
                t.subtopics.forEach(st => {
                    items.push({ id: st.id, name: st.name, subjectId: s.id, subjectName: `${s.name} > ${t.name}` });
                })
            })
        });
        return items;
    }, [subjects]);

    const filteredPickerItems = useMemo(() => {
        let items = allTopicsAndSubtopics;
        if (selectedSubjectForPicker) {
            items = items.filter(item => item.subjectId === selectedSubjectForPicker);
        }
        if (!pickerSearch.trim()) return items;
        const search = pickerSearch.toLowerCase();
        return items.filter(item => item.name.toLowerCase().includes(search));
    }, [allTopicsAndSubtopics, pickerSearch, selectedSubjectForPicker]);

    const getTopicName = (topicId: string) => {
        return allTopicsAndSubtopics.find(t => t.id === topicId)?.name || 'Tópico inválido';
    };

    const handleCreatePlan = async () => {
        if (!newPlanName.trim()) return;
        const newPlan: StudyPlanItem = {
            id: `plan-${Date.now()}`,
            name: newPlanName,
            type: 'standard',
            settings: { recurrence: 'weekly', notifications: true, intensity: 'moderate' },
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

    const handleDownloadPdf = () => {
        if (!editingPlan) return;
        const doc = new jsPDF('landscape');
        const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        
        doc.setFontSize(18);
        doc.text(`Cronograma: ${editingPlan.name}`, 14, 15);
        doc.setFontSize(10);
        doc.text(`Gerado em: ${new Date().toLocaleDateString()}`, 14, 22);

        const allTimes = new Set<string>();
        Object.values(editingPlan.weeklyRoutine).forEach(day => {
            Object.keys(day).forEach(t => allTimes.add(t));
        });
        const sortedTimes = Array.from(allTimes).sort();

        const tableBody = sortedTimes.map(time => {
            const row = [time];
            for (let d = 0; d <= 6; d++) {
                const content = editingPlan.weeklyRoutine[d]?.[time] || '';
                const isTopic = content.startsWith('t') || content.startsWith('st');
                row.push(isTopic ? getTopicName(content) : content);
            }
            return row;
        });

        autoTable(doc, {
            head: [['Hora', ...days]],
            body: tableBody,
            startY: 28,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [14, 165, 233] }
        });

        const pdfBase64 = doc.output('datauristring').split(',')[1];
        const fileName = `${editingPlan.name}.pdf`;

        if (window.Android && typeof window.Android.downloadPdf === 'function') {
            window.Android.downloadPdf(pdfBase64, fileName);
        } else {
            doc.save(fileName);
            setToastMessage("PDF gerado com sucesso!");
        }
    };

    const updatePlanSettings = (field: string, value: any) => {
        if (!editingPlan) return;
        const newPlans = plans.map(p => {
            if (p.id === editingPlanId) return { ...p, settings: { ...p.settings, [field]: value } };
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
            nextTime = `${((h + 1) % 24).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        }
        updatePlanRoutine(1, nextTime, "");
    };

    const renameTimeSlot = async (oldTime: string, newTime: string) => {
        if (!editingPlan) return;
        const newPlans = plans.map(p => {
            if (p.id === editingPlanId) {
                const routine = { ...p.weeklyRoutine };
                for (let d = 0; d <= 6; d++) {
                    if (routine[d]?.hasOwnProperty(oldTime)) {
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
                for (let d = 0; d <= 6; d++) if (routine[d]) delete routine[d][time];
                return { ...p, weeklyRoutine: routine };
            }
            return p;
        });
        onSaveFullPlan({ ...fullStudyPlan, plans: newPlans });
    };

    const handleOpenPicker = (day: number, time: string) => {
        setPickerTarget({ day, time });
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
                
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 bg-gray-800/60 p-4 rounded-xl border border-gray-700/50 shadow-lg">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setEditingPlanId(null)} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-cyan-400 transition-colors shadow-sm border border-gray-600" title="Voltar para galeria">
                            <ArrowRightIcon className="h-5 w-5 rotate-180" />
                        </button>
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-3">
                                {editingPlan.name}
                                <button 
                                    onClick={() => setIsReadOnly(!isReadOnly)}
                                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all border ${isReadOnly ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'}`}
                                >
                                    {isReadOnly ? 'Modo Visualização' : 'Modo Edição'}
                                </button>
                            </h2>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                        <Button onClick={handleDownloadPdf} className="text-xs py-2 px-4 bg-gray-700 hover:bg-gray-600 border-none">
                            <DownloadIcon className="h-4 w-4 mr-2" /> PDF
                        </Button>
                        
                        {!isReadOnly && (
                            <>
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

                                <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-900/60 rounded-lg border border-gray-700/50">
                                    <BellIcon className={`h-4 w-4 ${editingPlan.settings?.notifications ? 'text-emerald-400' : 'text-gray-500'}`} />
                                    <button 
                                        onClick={() => updatePlanSettings('notifications', !editingPlan.settings?.notifications)}
                                        className={`w-8 h-4 rounded-full relative transition-all ${editingPlan.settings?.notifications ? 'bg-emerald-600' : 'bg-gray-700'}`}
                                    >
                                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${editingPlan.settings?.notifications ? 'left-4.5' : 'left-0.5'}`} />
                                    </button>
                                </div>

                                <Button onClick={handleManualSave} disabled={isSaving} className="text-xs py-2 px-6 bg-emerald-600 hover:bg-emerald-500 border-none shadow-lg shadow-emerald-900/20 font-bold">
                                    {isSaving ? <Spinner /> : <><SaveIcon className="h-4 w-4 mr-2" /> Salvar</>}
                                </Button>
                            </>
                        )}
                    </div>
                </div>

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
                            readOnly={isReadOnly}
                        />
                    </div>
                </Card>

                <Modal isOpen={isPickerOpen} onClose={() => setIsPickerOpen(false)} title={selectedSubjectForPicker ? "Escolher Conteúdo" : "Selecione a Disciplina"} size="2xl">
                    <div className="space-y-6">
                        {!selectedSubjectForPicker ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
                                {subjects.map(subject => (
                                    <button key={subject.id} onClick={() => setSelectedSubjectForPicker(subject.id)} className="text-left p-4 rounded-xl bg-gray-800 border border-gray-700 hover:border-cyan-500 hover:bg-gray-700 transition-all flex items-center gap-4 group">
                                        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center border border-gray-700 shadow-sm flex-shrink-0">
                                            <SubjectIcon subjectName={subject.name} className="h-5 w-5 text-cyan-400" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-white group-hover:text-cyan-400 transition-colors truncate">{subject.name}</p>
                                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{subject.topics.length} Tópicos</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-4 animate-fade-in">
                                <div className="flex items-center justify-between gap-4">
                                    <button onClick={() => setSelectedSubjectForPicker(null)} className="text-cyan-400 text-xs font-bold flex items-center gap-1 hover:underline">
                                        <ArrowRightIcon className="h-3 w-3 rotate-180" /> Voltar para Disciplinas
                                    </button>
                                    <span className="text-[10px] bg-gray-700 text-gray-400 px-2 py-1 rounded font-bold uppercase">
                                        {subjects.find(s => s.id === selectedSubjectForPicker)?.name}
                                    </span>
                                </div>
                                <div className="relative">
                                    <GeminiIcon className="absolute left-3 top-3 h-5 w-5 text-cyan-400" />
                                    <input type="text" value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} placeholder="Filtrar nesta disciplina..." className="w-full bg-gray-700 border border-gray-600 rounded-xl py-3 pl-11 pr-4 text-white focus:ring-2 focus:ring-cyan-500 outline-none transition-all" autoFocus />
                                </div>
                                <div className="max-h-[50vh] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                                    {filteredPickerItems.map(item => (
                                        <button key={item.id} onClick={() => handlePickTopic(item.id)} className="w-full text-left p-3 rounded-xl bg-gray-800 border border-gray-700 hover:border-cyan-500 hover:bg-gray-700 transition-all group">
                                            <div className="flex items-center justify-between">
                                                <div className="min-w-0 pr-4">
                                                    <p className="text-[9px] uppercase font-bold text-cyan-500/70 mb-0.5 truncate">{item.subjectName}</p>
                                                    <p className="font-bold text-white group-hover:text-cyan-400 transition-colors text-sm truncate">{item.name}</p>
                                                </div>
                                                <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_cyan] flex-shrink-0" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </Modal>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {toastMessage && <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />}
            <ConfirmModal isOpen={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} onConfirm={executeDeletePlan} title="Excluir Planejamento" message="Tem certeza que deseja excluir este planejamento permanentemente?" confirmLabel="Excluir" variant="danger" />
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-white tracking-tight">Meus Cronogramas</h2>
                <Button onClick={() => setIsCreateModalOpen(true)}><PlusIcon className="h-5 w-5 mr-2" /> Novo Cronograma</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {plans.map(plan => (
                    <Card key={plan.id} className={`p-6 flex flex-col border-2 transition-all group ${fullStudyPlan.activePlanId === plan.id ? 'border-cyan-500 bg-cyan-900/10' : 'border-gray-700 bg-gray-800/40 hover:border-gray-600'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex-grow">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xl font-bold text-white group-hover:text-cyan-400 transition-colors">{plan.name}</h3>
                                    {fullStudyPlan.activePlanId === plan.id && <span className="bg-cyan-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center animate-pulse"><CheckCircleIcon className="h-3 w-3 mr-1" /> ATIVO</span>}
                                </div>
                                <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider font-bold">{plan.settings?.recurrence === 'weekly' ? 'Repete Semanalmente' : 'Válido para esta semana'}</p>
                            </div>
                            <button onClick={() => setConfirmDeleteId(plan.id)} className="text-gray-500 hover:text-red-400 p-1"><TrashIcon className="h-5 w-5" /></button>
                        </div>
                        <div className="mt-auto flex gap-2 pt-4">
                            <Button onClick={() => setEditingPlanId(plan.id)} className="flex-1 text-sm py-2 bg-gray-700 hover:bg-gray-600 border-none"><PencilIcon className="h-4 w-4 mr-2" /> Configurar</Button>
                            {fullStudyPlan.activePlanId !== plan.id && <Button onClick={() => handleSetActive(plan.id)} className="flex-1 text-sm py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 border-none font-bold">Ativar</Button>}
                        </div>
                    </Card>
                ))}
            </div>
            <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Novo Cronograma">
                <div className="space-y-6">
                    <label htmlFor="plan-name-input" className="block text-sm font-medium text-gray-400 mb-2">Qual o nome do seu planejamento?</label>
                    <input id="plan-name-input" type="text" value={newPlanName} onChange={e => setNewPlanName(e.target.value)} placeholder="Ex: Pós-Edital PF 2025" className="w-full bg-gray-700 border border-gray-600 rounded-xl p-4 text-white focus:ring-2 focus:ring-cyan-500 transition-all" autoFocus />
                    <Button onClick={handleCreatePlan} disabled={!newPlanName.trim()} className="w-full py-4 text-lg font-bold">Gerar Planejamento</Button>
                </div>
            </Modal>
        </div>
    );
};

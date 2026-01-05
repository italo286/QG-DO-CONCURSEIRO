
import React, { useState, useEffect } from 'react';
import { StudyPlan, Subject, StudentProgress } from '../../types';
import { Card } from '../ui';
import { CalendarIcon, PencilIcon, ArrowRightIcon, CheckIcon, XCircleIcon } from '../Icons';
import { getBrasiliaDate } from '../../utils';

export const DailySchedule: React.FC<{
    fullStudyPlan: StudyPlan;
    subjects: Subject[];
    studentProgress: StudentProgress;
    onNavigateToTopic: (topicId: string) => void;
    onToggleTopicCompletion: (subjectId: string, topicId: string, isCompleted: boolean) => void;
    onViewFullSchedule?: () => void;
    onUpdateRoutine?: (day: number, time: string, content: string | null) => void;
}> = ({ fullStudyPlan, subjects, studentProgress, onNavigateToTopic, onToggleTopicCompletion, onViewFullSchedule, onUpdateRoutine }) => {
    
    // Usamos um Date objeto completo como fonte de verdade
    const [currentBrTime, setCurrentBrTime] = useState(() => getBrasiliaDate());

    const [editingSlot, setEditingSlot] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentBrTime(getBrasiliaDate());
        }, 1000); // Sincronização a cada segundo
        return () => clearInterval(timer);
    }, []);

    const currentMinutesTotal = currentBrTime.getHours() * 60 + currentBrTime.getMinutes();
    const activePlan = (fullStudyPlan.plans || []).find(p => p.id === fullStudyPlan.activePlanId);
    const todayIndex = currentBrTime.getDay();

    const getTopicInfo = (topicId: string): { name: string; subjectName: string; subjectId: string } | null => {
        for (const subject of subjects) {
            for (const topic of (subject.topics || [])) {
                if (topic.id === topicId) return { name: topic.name, subjectName: subject.name, subjectId: subject.id };
                const subtopic = (topic.subtopics || []).find(st => st.id === topicId);
                if (subtopic) return { name: subtopic.name, subjectName: subject.name, subjectId: subject.id };
            }
        }
        return null;
    };

    const timeToMinutes = (timeStr: string) => {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    };

    const handleStartEdit = (time: string, currentContent: string) => {
        setEditingSlot(time);
        setEditValue(currentContent);
    };

    const handleSaveEdit = (time: string) => {
        if (onUpdateRoutine) onUpdateRoutine(todayIndex, time, editValue);
        setEditingSlot(null);
    };

    if (!activePlan) {
        return (
            <Card className="p-4 bg-gray-800/40 border-gray-700/50 text-center rounded-[1.5rem]">
                <CalendarIcon className="h-8 w-8 text-gray-600 mx-auto mb-2"/>
                <p className="text-gray-500 text-xs leading-relaxed">Nenhum planejamento ativo.</p>
            </Card>
        );
    }

    const todayItems = activePlan.weeklyRoutine[todayIndex] || {};
    const sortedTimes = Object.keys(todayItems).sort();

    return (
        <Card className="p-5 bg-[#0a0f1d]/90 border-white/5 shadow-2xl relative overflow-hidden rounded-[2rem] backdrop-blur-xl">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <CalendarIcon className="h-20 w-20" />
            </div>

            <div className="mb-6">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-1.5 h-7 bg-cyan-500 rounded-full shadow-[0_0_12px_cyan]"></div>
                    <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic leading-none">Agenda</h3>
                </div>
                <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.3em] ml-5 opacity-70">
                    {currentBrTime.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                </p>
            </div>

            {sortedTimes.length === 0 ? (
                <div className="py-8 text-center border-2 border-dashed border-gray-800 rounded-[1.5rem]">
                    <p className="text-gray-600 text-[10px] font-black uppercase tracking-widest italic">Folga Programada</p>
                </div>
            ) : (
                <div className="relative ml-1">
                    <div className="absolute left-[11px] top-4 bottom-4 w-[1px] bg-cyan-500/10" />

                    <div className="space-y-6">
                        {sortedTimes.map((time, index) => {
                            const content = todayItems[time];
                            const isTopicId = content.startsWith('t') || content.startsWith('st');
                            const topicInfo = isTopicId ? getTopicInfo(content) : null;
                            
                            const itemMinutes = timeToMinutes(time);
                            const nextTimeStr = sortedTimes[index + 1];
                            const nextItemMinutes = nextTimeStr ? timeToMinutes(nextTimeStr) : 1440;
                            
                            // Lógica rigorosa de status baseada no relógio sincronizado
                            const isActive = currentMinutesTotal >= itemMinutes && currentMinutesTotal < nextItemMinutes;
                            const isPast = currentMinutesTotal >= nextItemMinutes;

                            return (
                                <div key={time} className="relative pl-10 group">
                                    <div className={`absolute left-[11px] top-6 h-[calc(100%+1.5rem)] w-[1px] transition-all duration-700 
                                        ${isActive ? 'bg-cyan-400 shadow-[0_0_10px_cyan]' : 'bg-cyan-500/10'}`} 
                                    />

                                    <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-4 border-[#0a0f1d] z-10 transition-all duration-500 flex items-center justify-center 
                                        ${isActive ? 'bg-cyan-400 shadow-[0_0_20px_cyan] scale-110' : 
                                          isPast ? 'bg-cyan-900 border-cyan-500/20' : 'bg-gray-800 border-gray-700'}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white animate-pulse' : 'bg-transparent'}`} />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <span className={`text-base font-black font-mono tracking-tighter transition-colors ${isActive ? 'text-cyan-400' : isPast ? 'text-cyan-900' : 'text-gray-600'}`}>
                                                {time}
                                            </span>
                                            {isActive && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[8px] bg-cyan-400 text-black px-2 py-0.5 rounded-sm font-black uppercase tracking-widest animate-pulse">MISSÃO ATIVA</span>
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className={`p-4 rounded-2xl border transition-all duration-500 relative overflow-hidden
                                            ${isActive ? 'border-cyan-400/60 bg-cyan-400/10 shadow-[0_0_30px_rgba(6,182,212,0.1)] ring-1 ring-cyan-400/30' : 
                                              isPast ? 'border-gray-800 bg-gray-900/40 opacity-40' : 'border-white/5 bg-gray-900/10'}`}>
                                            
                                            <div className="flex justify-between items-center gap-3">
                                                <div className="flex gap-4 items-center min-w-0 flex-grow">
                                                    {editingSlot === time ? (
                                                        <div className="flex items-center gap-2 w-full">
                                                            <input autoFocus type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(time)} className="bg-gray-800 border border-cyan-500/50 rounded-lg px-3 py-1.5 text-sm text-white w-full outline-none" />
                                                            <button onClick={() => handleSaveEdit(time)} className="p-1.5 bg-green-500/20 text-green-400 rounded-lg"><CheckIcon className="h-4 w-4" /></button>
                                                            <button onClick={() => setEditingSlot(null)} className="p-1.5 bg-red-500/20 text-red-400 rounded-lg"><XCircleIcon className="h-4 w-4" /></button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <button 
                                                                onClick={() => handleStartEdit(time, topicInfo?.name || content)}
                                                                className={`p-2.5 rounded-xl flex-shrink-0 transition-all ${isActive ? 'bg-cyan-400 text-black shadow-lg scale-105' : 'bg-gray-800 text-gray-500 hover:text-cyan-400'}`}
                                                            >
                                                                <PencilIcon className="h-4 w-4" />
                                                            </button>
                                                            <div className="min-w-0">
                                                                <p className={`text-base font-black truncate leading-tight ${isActive ? 'text-white' : 'text-gray-400'}`}>
                                                                    "{topicInfo?.name || content}"
                                                                </p>
                                                                {topicInfo && (
                                                                    <p className={`text-[10px] font-black uppercase tracking-widest mt-1 truncate ${isActive ? 'text-cyan-500/70' : 'text-gray-600'}`}>
                                                                        {topicInfo.subjectName}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                                {topicInfo && editingSlot !== time && (
                                                    <button 
                                                        onClick={() => onNavigateToTopic(content)}
                                                        className={`p-3 rounded-xl transition-all ${isActive ? 'bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.5)] scale-110' : 'bg-gray-800 text-gray-600 hover:text-white'}`}
                                                    >
                                                        <ArrowRightIcon className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="mt-8 pt-4 border-t border-gray-800 flex justify-center">
                 <button onClick={onViewFullSchedule} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 hover:text-cyan-400 transition-colors group">
                    Ver Cronograma Completo
                    <ArrowRightIcon className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                 </button>
            </div>
        </Card>
    );
};

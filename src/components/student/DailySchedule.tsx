
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
    
    const [currentMinutes, setCurrentMinutes] = useState(() => {
        const now = getBrasiliaDate();
        return now.getUTCHours() * 60 + now.getUTCMinutes();
    });

    const [editingSlot, setEditingSlot] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');

    useEffect(() => {
        const timer = setInterval(() => {
            const now = getBrasiliaDate();
            setCurrentMinutes(now.getUTCHours() * 60 + now.getUTCMinutes());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const activePlan = (fullStudyPlan.plans || []).find(p => p.id === fullStudyPlan.activePlanId);
    const now = getBrasiliaDate();
    const todayIndex = now.getUTCDay();

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
        if (onUpdateRoutine) {
            onUpdateRoutine(todayIndex, time, editValue);
        }
        setEditingSlot(null);
    };

    if (!activePlan) {
        return (
            <Card className="p-4 bg-gray-800/40 border-gray-700/50 text-center rounded-[1rem]">
                <CalendarIcon className="h-6 w-6 text-gray-600 mx-auto mb-1"/>
                <p className="text-gray-500 text-xs leading-relaxed">Nenhum planejamento ativo.</p>
            </Card>
        );
    }

    const todayItems = activePlan.weeklyRoutine[todayIndex] || {};
    const sortedTimes = Object.keys(todayItems).sort();

    return (
        <Card className="p-4 bg-[#0a0f1d]/85 border-white/5 shadow-2xl relative overflow-hidden rounded-[1.8rem] backdrop-blur-xl">
            <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
                <CalendarIcon className="h-16 w-16" />
            </div>

            <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-6 bg-cyan-500 rounded-full shadow-[0_0_8px_cyan]"></div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic leading-none">Agenda</h3>
                </div>
                <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.3em] ml-4 opacity-60">
                    {now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                </p>
            </div>

            {sortedTimes.length === 0 ? (
                <div className="py-6 text-center border border-dashed border-gray-800 rounded-[1.2rem]">
                    <p className="text-gray-600 text-xs font-black uppercase tracking-widest italic">Folga</p>
                </div>
            ) : (
                <div className="relative ml-0.5">
                    {/* LINHA DE FUNDO DA TIMELINE */}
                    <div className="absolute left-[9px] top-3 bottom-3 w-[1px] bg-cyan-500/10" />

                    <div className="space-y-4">
                        {sortedTimes.map((time, index) => {
                            const content = todayItems[time];
                            const isTopicId = content.startsWith('t') || content.startsWith('st');
                            const topicInfo = isTopicId ? getTopicInfo(content) : null;
                            
                            const itemMinutes = timeToMinutes(time);
                            const nextTime = sortedTimes[index + 1];
                            const nextItemMinutes = nextTime ? timeToMinutes(nextTime) : 1440;
                            
                            const isActive = currentMinutes >= itemMinutes && currentMinutes < nextItemMinutes;
                            const isPast = currentMinutes >= nextItemMinutes;

                            return (
                                <div key={time} className="relative pl-8 group">
                                    {/* LINHA DE CONEXÃO: SÓ BRILHA SE O ITEM JÁ PASSOU */}
                                    {index < sortedTimes.length - 1 && (
                                        <div className={`absolute left-[9px] top-4 h-[calc(100%+1rem)] w-[1px] transition-all duration-700 
                                            ${isPast ? 'bg-cyan-400 shadow-[0_0_6px_cyan]' : 'bg-cyan-500/10'}`} 
                                        />
                                    )}

                                    {/* CÍRCULO DA TIMELINE COMPACTO */}
                                    <div className={`absolute left-0 top-0.5 w-5 h-5 rounded-full border-[3px] border-[#0a0f1d] z-10 transition-all duration-500 flex items-center justify-center 
                                        ${isActive ? 'bg-cyan-400 shadow-[0_0_12px_cyan] scale-110' : 
                                          isPast ? 'bg-cyan-800 border-cyan-400/40' : 'bg-gray-800 border-gray-700'}`}>
                                        <div className={`w-1 h-1 rounded-full ${isActive ? 'bg-white animate-pulse' : 'bg-transparent'}`} />
                                    </div>

                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2.5">
                                            <span className={`text-sm font-black font-mono tracking-tighter uppercase transition-colors ${isActive ? 'text-cyan-400' : isPast ? 'text-cyan-800' : 'text-gray-600'}`}>
                                                {time}
                                            </span>
                                            {isActive && <span className="text-[8px] bg-cyan-400 text-black px-2 py-0.5 rounded-sm font-black uppercase tracking-widest animate-pulse">LIVE</span>}
                                        </div>
                                        
                                        <div className={`p-3.5 rounded-xl border transition-all duration-300 relative overflow-hidden
                                            ${isActive ? 'border-cyan-400/30 bg-cyan-400/5 shadow-xl' : 
                                              isPast ? 'border-gray-800 bg-gray-900/30 opacity-40' : 'border-white/5 bg-gray-900/10'}`}>
                                            
                                            <div className="flex justify-between items-center gap-2">
                                                <div className="flex gap-3 items-center min-w-0 flex-grow">
                                                    {editingSlot === time ? (
                                                        <div className="flex items-center gap-2 w-full">
                                                            <input 
                                                                autoFocus
                                                                type="text" 
                                                                value={editValue} 
                                                                onChange={(e) => setEditValue(e.target.value)}
                                                                onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(time)}
                                                                className="bg-gray-800 border border-cyan-500/50 rounded px-2 py-1 text-sm text-white w-full outline-none"
                                                            />
                                                            <button onClick={() => handleSaveEdit(time)} className="text-green-400 hover:text-green-300">
                                                                <CheckIcon className="h-5 w-5" />
                                                            </button>
                                                            <button onClick={() => setEditingSlot(null)} className="text-red-400 hover:text-red-300">
                                                                <XCircleIcon className="h-5 w-5" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <button 
                                                                onClick={() => handleStartEdit(time, topicInfo?.name || content)}
                                                                className={`p-2 rounded-lg flex-shrink-0 transition-all ${isActive ? 'bg-cyan-400 text-black shadow-md' : 'bg-gray-800 text-gray-500 hover:text-cyan-400'}`}
                                                                title="Editar item"
                                                            >
                                                                <PencilIcon className="h-4 w-4" />
                                                            </button>
                                                            <div className="min-w-0">
                                                                <p className={`text-sm font-black truncate ${isActive ? 'text-white' : 'text-gray-400'}`}>
                                                                    "{topicInfo?.name || content}"
                                                                </p>
                                                                {topicInfo && (
                                                                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mt-1 truncate">
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
                                                        className={`p-2 rounded-lg transition-all ${isActive ? 'bg-cyan-400 text-black shadow-lg scale-105' : 'bg-gray-800 text-gray-600 hover:text-white'}`}
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
                 <button 
                    onClick={onViewFullSchedule}
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 hover:text-cyan-400 transition-colors group"
                 >
                    Ver Cronograma Completo
                    <ArrowRightIcon className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                 </button>
            </div>
        </Card>
    );
};

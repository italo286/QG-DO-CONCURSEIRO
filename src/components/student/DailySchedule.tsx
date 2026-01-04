
import React, { useState, useEffect } from 'react';
import { StudyPlan, Subject, StudentProgress } from '../../types';
import { Card } from '../ui';
import { CalendarIcon, PencilIcon, ArrowRightIcon } from '../Icons';
import { getBrasiliaDate } from '../../utils';

export const DailySchedule: React.FC<{
    fullStudyPlan: StudyPlan;
    subjects: Subject[];
    studentProgress: StudentProgress;
    onNavigateToTopic: (topicId: string) => void;
    onToggleTopicCompletion: (subjectId: string, topicId: string, isCompleted: boolean) => void;
    onViewFullSchedule?: () => void;
}> = ({ fullStudyPlan, subjects, studentProgress, onNavigateToTopic, onToggleTopicCompletion, onViewFullSchedule }) => {
    
    const [currentMinutes, setCurrentMinutes] = useState(() => {
        const now = getBrasiliaDate();
        return now.getUTCHours() * 60 + now.getUTCMinutes();
    });

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

    if (!activePlan) {
        return (
            <Card className="p-5 bg-gray-800/40 border-gray-700/50 text-center rounded-[1.5rem]">
                <CalendarIcon className="h-8 w-8 text-gray-600 mx-auto mb-2"/>
                <p className="text-gray-500 text-xs leading-relaxed">Nenhum planejamento ativo.</p>
            </Card>
        );
    }

    const todayItems = activePlan.weeklyRoutine[todayIndex] || {};
    const sortedTimes = Object.keys(todayItems).sort();

    return (
        <Card className="p-6 bg-[#0a0f1d]/80 border-white/5 shadow-2xl relative overflow-hidden rounded-[2rem] backdrop-blur-xl">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <CalendarIcon className="h-24 w-24" />
            </div>

            <div className="mb-8">
                <div className="flex items-center gap-2.5 mb-1">
                    <div className="w-1.5 h-6 bg-cyan-500 rounded-full shadow-[0_0_10px_cyan]"></div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic leading-none">Agenda do Dia</h3>
                </div>
                <p className="text-[9px] text-cyan-400 font-black uppercase tracking-[0.3em] ml-4 opacity-70">
                    {now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                </p>
            </div>

            {sortedTimes.length === 0 ? (
                <div className="py-8 text-center border-2 border-dashed border-gray-800 rounded-[1.5rem]">
                    <p className="text-gray-600 text-[9px] font-black uppercase tracking-widest italic">Descanso Programado</p>
                </div>
            ) : (
                <div className="relative ml-1">
                    {/* LINHA DE FUNDO DA TIMELINE */}
                    <div className="absolute left-[11px] top-4 bottom-4 w-[1px] bg-cyan-500/10" />

                    <div className="space-y-8">
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
                                <div key={time} className="relative pl-10 group">
                                    {/* LINHA DE CONEXÃO: SÓ BRILHA SE O PRÓXIMO ITEM JÁ FOI ALCANÇADO (ISPAST) */}
                                    {index < sortedTimes.length - 1 && (
                                        <div className={`absolute left-[11px] top-6 h-[calc(100%+2rem)] w-[1px] transition-all duration-700 
                                            ${isPast ? 'bg-cyan-400 shadow-[0_0_8px_cyan]' : 'bg-cyan-500/10'}`} 
                                        />
                                    )}

                                    {/* CÍRCULO DA TIMELINE */}
                                    <div className={`absolute left-0 top-0.5 w-6 h-6 rounded-full border-4 border-[#0a0f1d] z-10 transition-all duration-500 flex items-center justify-center 
                                        ${isActive ? 'bg-cyan-400 shadow-[0_0_15px_cyan] scale-110' : 
                                          isPast ? 'bg-cyan-800 border-cyan-400/50' : 'bg-gray-800 border-gray-700'}`}>
                                        <div className={`w-1 h-1 rounded-full ${isActive ? 'bg-white animate-pulse' : 'bg-transparent'}`} />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2.5">
                                            <span className={`text-xs font-black font-mono tracking-tighter uppercase transition-colors ${isActive ? 'text-cyan-400' : isPast ? 'text-cyan-700' : 'text-gray-600'}`}>
                                                {time}
                                            </span>
                                            {isActive && <span className="text-[7px] bg-cyan-400 text-black px-1.5 py-0.5 rounded-sm font-black uppercase tracking-widest animate-pulse">EM ANDAMENTO</span>}
                                        </div>
                                        
                                        <div className={`p-4 rounded-xl border transition-all duration-500 relative overflow-hidden
                                            ${isActive ? 'border-cyan-400/30 bg-cyan-400/5 shadow-xl' : 
                                              isPast ? 'border-gray-800 bg-gray-900/40 opacity-40' : 'border-white/5 bg-gray-900/10'}`}>
                                            
                                            <div className="flex justify-between items-center gap-3">
                                                <div className="flex gap-3 items-center min-w-0">
                                                    <div className={`p-2 rounded-lg flex-shrink-0 transition-colors ${isActive ? 'bg-cyan-400 text-black shadow-[0_0_10px_rgba(34,211,238,0.5)]' : 'bg-gray-800 text-gray-500'}`}>
                                                        <PencilIcon className="h-3.5 w-3.5" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className={`text-xs font-bold truncate ${isActive ? 'text-white' : 'text-gray-400'}`}>
                                                            "{topicInfo?.name || content}"
                                                        </p>
                                                        {topicInfo && (
                                                            <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest mt-0.5">
                                                                {topicInfo.subjectName}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                {topicInfo && (
                                                    <button 
                                                        onClick={() => onNavigateToTopic(content)}
                                                        className={`p-2 rounded-lg transition-all ${isActive ? 'bg-cyan-400 text-black shadow-lg scale-105' : 'bg-gray-800 text-gray-600 hover:text-white'}`}
                                                    >
                                                        <ArrowRightIcon className="h-3 w-3" />
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

            {/* BOTÃO CRONOGRAMA COMPLETO */}
            <div className="mt-8 pt-4 border-t border-gray-800 flex justify-center">
                 <button 
                    onClick={onViewFullSchedule}
                    className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 hover:text-cyan-400 transition-colors group"
                 >
                    Ver Cronograma Completo
                    <ArrowRightIcon className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                 </button>
            </div>
        </Card>
    );
};


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
}> = ({ fullStudyPlan, subjects, studentProgress, onNavigateToTopic, onToggleTopicCompletion }) => {
    
    const [currentMinutes, setCurrentMinutes] = useState(() => {
        const now = getBrasiliaDate();
        return now.getUTCHours() * 60 + now.getUTCMinutes();
    });

    useEffect(() => {
        const timer = setInterval(() => {
            const now = getBrasiliaDate();
            setCurrentMinutes(now.getUTCHours() * 60 + now.getUTCMinutes());
        }, 1000); // Atualiza a cada segundo para precisão total com o relógio
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
            <Card className="p-6 bg-gray-800/40 border-gray-700/50 text-center rounded-[2rem]">
                <CalendarIcon className="h-10 w-10 text-gray-600 mx-auto mb-3"/>
                <h3 className="text-lg font-bold text-white uppercase tracking-tighter">Cronograma</h3>
                <p className="text-gray-500 text-xs mt-2 leading-relaxed">Nenhum planejamento ativo.</p>
            </Card>
        );
    }

    const todayItems = activePlan.weeklyRoutine[todayIndex] || {};
    const sortedTimes = Object.keys(todayItems).sort();

    return (
        <Card className="p-8 bg-[#0a0f1d]/80 border-white/5 shadow-2xl relative overflow-hidden rounded-[2.5rem] backdrop-blur-xl">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <CalendarIcon className="h-32 w-32" />
            </div>

            <div className="mb-12">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-2 h-7 bg-cyan-500 rounded-full shadow-[0_0_15px_cyan]"></div>
                    <h3 className="text-4xl font-black text-white uppercase tracking-tighter italic leading-none">Agenda do Dia</h3>
                </div>
                <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.4em] ml-6 opacity-70">
                    {now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                </p>
            </div>

            {sortedTimes.length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed border-gray-800 rounded-[2rem]">
                    <p className="text-gray-600 text-[10px] font-black uppercase tracking-widest italic">Descanso Programado</p>
                </div>
            ) : (
                <div className="relative ml-2">
                    {/* LINHA DA TIMELINE CIANO */}
                    <div className="absolute left-[13px] top-4 bottom-4 w-[1px] bg-cyan-500/20" />

                    <div className="space-y-12">
                        {sortedTimes.map((time, index) => {
                            const content = todayItems[time];
                            const isTopicId = content.startsWith('t') || content.startsWith('st');
                            const topicInfo = isTopicId ? getTopicInfo(content) : null;
                            
                            const itemMinutes = timeToMinutes(time);
                            const nextTime = sortedTimes[index + 1];
                            const nextItemMinutes = nextTime ? timeToMinutes(nextTime) : 1440; // fim do dia
                            
                            const isActive = currentMinutes >= itemMinutes && currentMinutes < nextItemMinutes;
                            const isPast = currentMinutes >= nextItemMinutes;

                            return (
                                <div key={time} className="relative pl-12 group">
                                    {/* LINHA ATIVA COM BRILHO */}
                                    {(isActive || isPast) && index < sortedTimes.length - 1 && (
                                        <div className="absolute left-[13px] top-6 h-[calc(100%+3rem)] w-[1px] bg-cyan-400 shadow-[0_0_10px_cyan] z-0" />
                                    )}

                                    {/* CÍRCULO DA TIMELINE ESTILO ORIGINAL */}
                                    <div className={`absolute left-0 top-1 w-7 h-7 rounded-full border-4 border-[#0a0f1d] z-10 transition-all duration-500 flex items-center justify-center 
                                        ${isActive ? 'bg-cyan-400 shadow-[0_0_20px_cyan] scale-110' : 
                                          isPast ? 'bg-cyan-800 border-cyan-400/50' : 'bg-gray-800 border-gray-700'}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white animate-pulse' : 'bg-transparent'}`} />
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <span className={`text-sm font-black font-mono tracking-tighter uppercase transition-colors ${isActive ? 'text-cyan-400' : isPast ? 'text-cyan-700' : 'text-gray-600'}`}>
                                                {time}
                                            </span>
                                            {isActive && <span className="text-[8px] bg-cyan-400 text-black px-2 py-0.5 rounded-sm font-black uppercase tracking-widest animate-pulse">EM ANDAMENTO</span>}
                                        </div>
                                        
                                        <div className={`p-5 rounded-2xl border transition-all duration-500 relative overflow-hidden
                                            ${isActive ? 'border-cyan-400/40 bg-cyan-400/5 shadow-[0_0_40px_-10px_rgba(34,211,238,0.2)]' : 
                                              isPast ? 'border-gray-800 bg-gray-900/40 opacity-50' : 'border-white/5 bg-gray-900/20'}`}>
                                            
                                            <div className="flex justify-between items-center gap-4">
                                                <div className="flex gap-4 items-center min-w-0">
                                                    <div className={`p-2.5 rounded-xl flex-shrink-0 transition-colors ${isActive ? 'bg-cyan-400 text-black' : 'bg-gray-800 text-gray-500'}`}>
                                                        <PencilIcon className="h-4 w-4" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className={`text-sm font-bold truncate ${isActive ? 'text-white' : 'text-gray-400'}`}>
                                                            "{topicInfo?.name || content}"
                                                        </p>
                                                        {topicInfo && (
                                                            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mt-1">
                                                                {topicInfo.subjectName}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                {topicInfo && (
                                                    <button 
                                                        onClick={() => onNavigateToTopic(content)}
                                                        className={`p-3 rounded-xl transition-all ${isActive ? 'bg-cyan-400 text-black shadow-lg scale-105' : 'bg-gray-800 text-gray-600 hover:text-white'}`}
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
        </Card>
    );
};

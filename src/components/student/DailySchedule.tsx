
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
        }, 60000);
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
            <Card className="p-6 bg-gray-800/40 border-gray-700/50 text-center">
                <CalendarIcon className="h-10 w-10 text-gray-600 mx-auto mb-3"/>
                <h3 className="text-lg font-bold text-white uppercase tracking-tighter">Cronograma</h3>
                <p className="text-gray-500 text-xs mt-2 leading-relaxed">Nenhum planejamento ativo.<br/>Configure em "Cronograma".</p>
            </Card>
        );
    }

    const todayItems = activePlan.weeklyRoutine[todayIndex] || {};
    const sortedTimes = Object.keys(todayItems).sort();

    return (
        <Card className="p-8 bg-[#0a0f1d]/60 border-white/5 shadow-2xl relative overflow-hidden rounded-[2.5rem]">
            <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12 pointer-events-none">
                <CalendarIcon className="h-24 w-24" />
            </div>

            <div className="mb-10">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-2.5 h-7 bg-cyan-500 rounded-full shadow-[0_0_15px_cyan]"></div>
                    <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic">Agenda do Dia</h3>
                </div>
                <p className="text-[10px] text-cyan-400/50 font-black uppercase tracking-[0.3em] ml-6">
                    {now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                </p>
            </div>

            {sortedTimes.length === 0 ? (
                <div className="py-10 text-center border-2 border-dashed border-gray-800 rounded-3xl">
                    <p className="text-gray-600 text-[10px] font-black uppercase tracking-widest italic">Descanso Programado</p>
                </div>
            ) : (
                <div className="relative ml-2">
                    {/* LINHA DA TIMELINE */}
                    <div className="absolute left-[13px] top-4 bottom-4 w-0.5 bg-cyan-950/50" />

                    <div className="space-y-10">
                        {sortedTimes.map((time, index) => {
                            const content = todayItems[time];
                            const isTopicId = content.startsWith('t') || content.startsWith('st');
                            const topicInfo = isTopicId ? getTopicInfo(content) : null;
                            const isCompleted = topicInfo ? (studentProgress.progressByTopic[topicInfo.subjectId]?.[content]?.completed || false) : false;
                            
                            const itemMinutes = timeToMinutes(time);
                            const isNext = index < sortedTimes.length - 1 && currentMinutes >= timeToMinutes(sortedTimes[index+1]);
                            const isActive = currentMinutes >= itemMinutes && !isNext;

                            return (
                                <div key={time} className="relative pl-12 group">
                                    {/* LINHA ATIVA */}
                                    {index < sortedTimes.length - 1 && currentMinutes >= itemMinutes && (
                                        <div className="absolute left-[13px] top-4 h-full w-0.5 bg-cyan-500 shadow-[0_0_10px_cyan]" />
                                    )}

                                    {/* CÍRCULO DA TIMELINE */}
                                    <div className={`absolute left-0 top-0.5 w-7 h-7 rounded-full border-4 border-gray-900 z-10 transition-all duration-700 flex items-center justify-center 
                                        ${isActive ? 'bg-cyan-500 shadow-[0_0_20px_cyan] scale-110' : 
                                          currentMinutes > itemMinutes ? 'bg-cyan-700 border-cyan-500' : 'bg-gray-800 border-gray-700'}`}>
                                        <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-white animate-ping' : 'bg-transparent'}`} />
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <span className={`text-xs font-black font-mono tracking-tighter uppercase transition-colors ${isActive ? 'text-cyan-400' : 'text-gray-500'}`}>
                                                {time}
                                            </span>
                                            {isActive && <span className="text-[8px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded font-black uppercase tracking-widest animate-pulse">AGORA</span>}
                                        </div>
                                        
                                        <div className={`p-5 rounded-2xl border transition-all duration-500 relative overflow-hidden bg-[#111827]/40
                                            ${isActive ? 'border-cyan-500/40 shadow-2xl bg-cyan-500/5' : 'border-white/5 hover:border-white/10'}`}>
                                            
                                            {topicInfo ? (
                                                <div className="flex justify-between items-center gap-4">
                                                    <div className="flex gap-4 items-center min-w-0">
                                                        <div className={`p-2 rounded-lg ${isActive ? 'bg-cyan-500 text-white shadow-[0_0_10px_cyan]' : 'bg-gray-800 text-gray-500'}`}>
                                                            <PencilIcon className="h-4 w-4" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className={`text-sm font-bold truncate ${isActive ? 'text-white' : 'text-gray-400'}`}>
                                                                "{topicInfo.name}"
                                                            </p>
                                                            <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mt-1">
                                                                {topicInfo.subjectName}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button 
                                                        onClick={() => onNavigateToTopic(content)}
                                                        className={`p-3 rounded-xl transition-all ${isActive ? 'bg-cyan-500 text-white shadow-xl' : 'bg-gray-800 text-gray-600 hover:text-white'}`}
                                                    >
                                                        <ArrowRightIcon className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-4">
                                                    <div className="p-2 rounded-lg bg-gray-800/50 text-gray-600">
                                                        <PencilIcon className="h-4 w-4" />
                                                    </div>
                                                    <p className={`text-sm font-bold italic truncate ${isActive ? 'text-cyan-200' : 'text-gray-500'}`}>"{content}"</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            
            <div className="mt-12 flex justify-center">
                 <button className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 hover:text-cyan-400 hover:border-cyan-500/30 transition-all">
                    Visualizar Protocolo Completo
                 </button>
            </div>
        </Card>
    );
};

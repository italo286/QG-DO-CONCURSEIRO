
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
        <Card className="p-6 bg-gray-800/60 border-cyan-500/20 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12 pointer-events-none">
                <CalendarIcon className="h-24 w-24" />
            </div>

            <div className="mb-8">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-2 h-6 bg-cyan-500 rounded-full"></div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">Agenda do Dia</h3>
                </div>
                <p className="text-[10px] text-cyan-400/70 font-black uppercase tracking-[0.2em]">
                    {now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                </p>
            </div>

            {sortedTimes.length === 0 ? (
                <div className="py-10 text-center border-2 border-dashed border-gray-700 rounded-2xl">
                    <p className="text-gray-500 text-sm font-bold uppercase tracking-widest italic">Descanso Programado</p>
                </div>
            ) : (
                <div className="relative space-y-6">
                    {sortedTimes.map((time, index) => {
                        const content = todayItems[time];
                        const isTopicId = content.startsWith('t') || content.startsWith('st');
                        const topicInfo = isTopicId ? getTopicInfo(content) : null;
                        const isCompletedManually = topicInfo ? (studentProgress.progressByTopic[topicInfo.subjectId]?.[content]?.completed || false) : false;
                        
                        const itemMinutes = timeToMinutes(time);
                        const isPast = currentMinutes >= itemMinutes;
                        const isCircleActive = isPast || isCompletedManually;

                        const nextTime = sortedTimes[index + 1];
                        const isLineActive = nextTime ? (currentMinutes >= timeToMinutes(nextTime)) : false;

                        const isLast = index === sortedTimes.length - 1;

                        return (
                            <div key={time} className="relative pl-10 group">
                                {!isLast && (
                                    <div className={`absolute left-3.5 top-7 w-0.5 h-full z-0 transition-colors duration-700 ${isLineActive ? 'bg-cyan-500' : 'bg-gray-700'}`} />
                                )}

                                <div className={`absolute left-0 top-1 w-7 h-7 rounded-full border-4 border-gray-900 flex items-center justify-center z-10 transition-all duration-700 ${isCircleActive ? 'bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.6)]' : 'bg-gray-700 group-hover:bg-gray-600'}`}>
                                    {isCompletedManually ? (
                                        <CheckIcon className="h-3 w-3 text-white" />
                                    ) : isPast ? (
                                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                                    ) : null}
                                </div>

                                <div className="space-y-1">
                                    <span className={`text-[10px] font-black font-mono tracking-tighter uppercase transition-colors ${isCircleActive ? 'text-cyan-400' : 'text-gray-500'}`}>
                                        {time}
                                    </span>
                                    
                                    <div 
                                        className={`p-3 rounded-xl border transition-all duration-300 ${isCircleActive ? 'bg-cyan-500/5 border-cyan-500/30' : 'bg-gray-900/40 border-gray-700 hover:border-gray-600'}`}
                                    >
                                        {topicInfo ? (
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="min-w-0">
                                                    <p className={`text-xs font-black uppercase tracking-tighter mb-0.5 truncate ${isCircleActive ? 'text-cyan-500/70' : 'text-gray-500'}`}>
                                                        {topicInfo.subjectName}
                                                    </p>
                                                    <p className={`text-sm font-bold leading-tight ${isCircleActive ? 'text-white' : 'text-gray-300'}`}>
                                                        {topicInfo.name}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <button 
                                                        onClick={() => onToggleTopicCompletion(topicInfo.subjectId, content, !isCompletedManually)}
                                                        className={`h-6 w-6 rounded-lg flex items-center justify-center transition-all ${isCompletedManually ? 'text-cyan-500 bg-cyan-500/10' : 'text-gray-500 bg-gray-800 hover:text-white hover:bg-cyan-600'}`}
                                                        title={isCompletedManually ? "Desmarcar conclusão" : "Marcar como concluído"}
                                                    >
                                                        <CheckIcon className="h-3 w-3" />
                                                    </button>
                                                    {!isCompletedManually && (
                                                        <button 
                                                            /* FIX: Changed handleNavigateToTopic to onNavigateToTopic as per reported error */
                                                            onClick={() => onNavigateToTopic(content)}
                                                            className={`h-6 w-6 rounded-lg flex items-center justify-center transition-all ${isCircleActive ? 'bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600' : 'bg-gray-800 text-gray-500 hover:bg-cyan-600'} hover:text-white`}
                                                            title="Ir para aula"
                                                        >
                                                            <ArrowRightIcon className="h-3 w-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <PencilIcon className={`h-3 w-3 flex-shrink-0 ${isCircleActive ? 'text-cyan-400' : 'text-purple-400'}`} />
                                                <p className={`text-xs italic line-clamp-2 ${isCircleActive ? 'text-cyan-100/70' : 'text-gray-400'}`}>"{content}"</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            
            <div className="mt-8 pt-4 border-t border-gray-700/50 flex justify-center">
                 <button className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-cyan-400 transition-colors">
                    Ver Plano Completo
                 </button>
            </div>
        </Card>
    );
};

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);


import React from 'react';
import { StudyPlan, Subject, StudentProgress } from '../../types';
import { Card, Button } from '../ui';
// FIX: Added missing ArrowRightIcon import from Icons component.
import { CalendarIcon, PencilIcon, BookOpenIcon, CheckCircleIcon, ArrowRightIcon } from '../Icons';
import { getBrasiliaDate } from '../../utils';

export const DailySchedule: React.FC<{
    fullStudyPlan: StudyPlan;
    subjects: Subject[];
    studentProgress: StudentProgress;
    onNavigateToTopic: (topicId: string) => void;
    onToggleTopicCompletion: (subjectId: string, topicId: string, isCompleted: boolean) => void;
}> = ({ fullStudyPlan, subjects, studentProgress, onNavigateToTopic, onToggleTopicCompletion }) => {
    
    const activePlan = (fullStudyPlan.plans || []).find(p => p.id === fullStudyPlan.activePlanId);
    const now = getBrasiliaDate();
    const todayIndex = now.getUTCDay();

    const getTopicInfo = (topicId: string): { name: string; subjectName: string; subjectId: string; color?: string } | null => {
        for (const subject of subjects) {
            for (const topic of (subject.topics || [])) {
                if (topic.id === topicId) return { name: topic.name, subjectName: subject.name, subjectId: subject.id, color: topic.color };
                const subtopic = (topic.subtopics || []).find(st => st.id === topicId);
                if (subtopic) return { name: subtopic.name, subjectName: subject.name, subjectId: subject.id, color: subtopic.color };
            }
        }
        return null;
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
                <div className="relative space-y-6 before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-700">
                    {sortedTimes.map(time => {
                        const content = todayItems[time];
                        const isTopicId = content.startsWith('t') || content.startsWith('st');
                        const topicInfo = isTopicId ? getTopicInfo(content) : null;
                        const isCompleted = topicInfo ? (studentProgress.progressByTopic[topicInfo.subjectId]?.[content]?.completed || false) : false;
                        
                        return (
                            <div key={time} className="relative pl-10 group">
                                {/* Ponto da Timeline */}
                                <div className={`absolute left-0 top-1 w-7 h-7 rounded-full border-4 border-gray-900 flex items-center justify-center z-10 transition-colors ${isCompleted ? 'bg-green-500' : 'bg-gray-700 group-hover:bg-cyan-500'}`}>
                                    {isCompleted && <CheckIcon className="h-3 w-3 text-white" />}
                                </div>

                                <div className="space-y-1">
                                    <span className="text-[10px] font-black text-gray-500 font-mono tracking-tighter uppercase">{time}</span>
                                    
                                    <div 
                                        className={`p-3 rounded-xl border transition-all duration-300 ${isCompleted ? 'bg-green-900/10 border-green-500/20 opacity-60 scale-[0.98]' : 'bg-gray-900/40 border-gray-700 hover:border-cyan-500/30'}`}
                                        style={(!isCompleted && topicInfo?.color) ? { borderLeft: `3px solid ${topicInfo.color}` } : {}}
                                    >
                                        {topicInfo ? (
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="min-w-0">
                                                    <p className={`text-xs font-black uppercase text-gray-500 tracking-tighter mb-0.5 truncate`}>
                                                        {topicInfo.subjectName}
                                                    </p>
                                                    <p className={`text-sm font-bold leading-tight ${isCompleted ? 'line-through text-gray-500' : 'text-white'}`}>
                                                        {topicInfo.name}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <button 
                                                        onClick={() => onToggleTopicCompletion(topicInfo.subjectId, content, !isCompleted)}
                                                        className={`h-6 w-6 rounded-lg flex items-center justify-center transition-all ${isCompleted ? 'text-green-500 bg-green-500/10' : 'text-gray-500 bg-gray-800 hover:text-white hover:bg-cyan-600'}`}
                                                        title={isCompleted ? "Desmarcar conclusão" : "Marcar como concluído"}
                                                    >
                                                        <CheckIcon className="h-3 w-3" />
                                                    </button>
                                                    {!isCompleted && (
                                                        <button 
                                                            onClick={() => onNavigateToTopic(content)}
                                                            className="h-6 w-6 rounded-lg bg-cyan-600/20 text-cyan-400 flex items-center justify-center hover:bg-cyan-600 hover:text-white transition-all"
                                                            title="Ir para aula"
                                                        >
                                                            <ArrowRightIcon className="h-3 w-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <PencilIcon className="h-3 w-3 text-purple-400 flex-shrink-0" />
                                                <p className="text-xs text-gray-300 italic line-clamp-2">"{content}"</p>
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

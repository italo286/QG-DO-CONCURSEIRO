
import React from 'react';
import { StudyPlan, Subject, StudentProgress } from '../../types';
import { Card, Button } from '../ui';
import { CalendarIcon, PencilIcon } from '../Icons';
import { getBrasiliaDate } from '../../utils';

export const DailySchedule: React.FC<{
    fullStudyPlan: StudyPlan;
    subjects: Subject[];
    studentProgress: StudentProgress;
    onNavigateToTopic: (topicId: string) => void;
    onToggleTopicCompletion: (subjectId: string, topicId: string, isCompleted: boolean) => void;
}> = ({ fullStudyPlan, subjects, studentProgress, onNavigateToTopic, onToggleTopicCompletion }) => {
    
    const activePlan = (fullStudyPlan.plans || []).find(p => p.id === fullStudyPlan.activePlanId);
    
    // Day of week from Brasília time (0-6)
    const now = getBrasiliaDate();
    const todayIndex = now.getUTCDay();

    const getTopicInfo = (topicId: string): { name: string; subjectName: string; subjectId: string; } | null => {
        for (const subject of subjects) {
            for (const topic of (subject.topics || [])) {
                if (topic.id === topicId) return { name: topic.name, subjectName: subject.name, subjectId: subject.id };
                const subtopic = (topic.subtopics || []).find(st => st.id === topicId);
                if (subtopic) return { name: subtopic.name, subjectName: subject.name, subjectId: subject.id };
            }
        }
        return null;
    };

    if (!activePlan) {
        return (
            <Card className="p-6 bg-gray-800/40 border-gray-700">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center"><CalendarIcon className="h-6 w-6 mr-3 text-cyan-400"/> Cronograma</h3>
                <p className="text-gray-500 text-center py-4 text-sm">Nenhum planejamento ativo. Vá em "Cronograma" para criar e selecionar um.</p>
            </Card>
        );
    }

    const todayItems = activePlan.weeklyRoutine[todayIndex] || {};
    const sortedTimes = Object.keys(todayItems).sort();

    if (sortedTimes.length === 0) {
        return (
            <Card className="p-6">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center">
                    <CalendarIcon className="h-6 w-6 mr-3 text-cyan-400"/> 
                    {activePlan.name}
                </h3>
                <p className="text-gray-400 text-center py-4 text-sm">Nada programado para hoje ({now.toLocaleDateString('pt-BR', { weekday: 'long' })}).</p>
            </Card>
        );
    }
    
    return (
        <Card className="p-6 bg-gradient-to-br from-gray-800 to-gray-900 border-cyan-500/20">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-xl font-bold text-white flex items-center">
                        <CalendarIcon className="h-6 w-6 mr-3 text-cyan-400"/> 
                        {activePlan.name}
                    </h3>
                    <p className="text-xs text-cyan-400/70 ml-9 uppercase font-bold tracking-widest mt-1">Hoje: {now.toLocaleDateString('pt-BR', { weekday: 'long' })}</p>
                </div>
            </div>

            <ul className="space-y-4">
                {sortedTimes.map(time => {
                    const content = todayItems[time];
                    const topicInfo = activePlan.type === 'standard' ? getTopicInfo(content) : null;
                    const isCompleted = topicInfo ? (studentProgress.progressByTopic[topicInfo.subjectId]?.[content]?.completed || false) : false;
                    
                    return (
                        <li key={time} className={`p-4 rounded-xl flex items-center justify-between transition-all border ${isCompleted ? 'bg-green-900/10 border-green-500/20 opacity-60' : 'bg-gray-800/50 border-gray-700'}`}>
                           <div className="flex items-center gap-4 min-w-0">
                             <div className="text-cyan-400 font-mono font-bold text-sm bg-gray-900 px-2 py-1 rounded border border-gray-700">
                                 {time}
                             </div>
                             <div className="min-w-0">
                                {activePlan.type === 'standard' && topicInfo ? (
                                    <>
                                        <p className={`font-bold truncate ${isCompleted ? 'line-through text-gray-500' : 'text-gray-100'}`}>{topicInfo.name}</p>
                                        <p className="text-[10px] text-gray-500 uppercase font-bold">{topicInfo.subjectName}</p>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <PencilIcon className="h-3 w-3 text-purple-400 flex-shrink-0" />
                                        <p className="text-sm text-gray-200 line-clamp-2 italic">"{content}"</p>
                                    </div>
                                )}
                             </div>
                           </div>
                           
                           {activePlan.type === 'standard' && topicInfo && (
                               <div className="flex items-center gap-2 ml-4">
                                    <button 
                                        onClick={() => onToggleTopicCompletion(topicInfo.subjectId, content, !isCompleted)}
                                        className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors ${isCompleted ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-500 border border-gray-600 hover:border-cyan-500'}`}
                                    >
                                        <CheckIcon className="h-4 w-4" />
                                    </button>
                                    <Button onClick={() => onNavigateToTopic(content)} className="h-8 py-0 px-3 text-xs bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-600 hover:text-white">
                                        Abrir
                                    </Button>
                               </div>
                           )}
                        </li>
                    );
                })}
            </ul>
        </Card>
    );
};

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

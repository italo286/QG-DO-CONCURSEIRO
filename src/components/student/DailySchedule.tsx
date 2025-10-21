import React from 'react';
import { StudyPlan, Subject, StudentProgress } from '../../types';
import { Card, Button } from '../ui';
import { CalendarIcon, ArrowRightIcon } from '../Icons';
import { getLocalDateISOString } from '../../utils';

export const DailySchedule: React.FC<{
    studyPlan: StudyPlan['plan'];
    subjects: Subject[];
    studentProgress: StudentProgress;
    onNavigateToTopic: (topicId: string) => void;
    onToggleTopicCompletion: (subjectId: string, topicId: string, isCompleted: boolean) => void;
}> = ({ studyPlan, subjects, studentProgress, onNavigateToTopic, onToggleTopicCompletion }) => {
    const todayISO = getLocalDateISOString(new Date());
    const topicIds = studyPlan[todayISO] || [];

    const getTopicInfo = (topicId: string): { name: string; subjectName: string; subjectId: string; } | null => {
        for (const subject of subjects) {
            for (const topic of (subject.topics || [])) {
                if (topic.id === topicId) {
                    return { name: topic.name, subjectName: subject.name, subjectId: subject.id };
                }
                const subtopic = (topic.subtopics || []).find(st => st.id === topicId);
                if (subtopic) {
                    return { name: subtopic.name, subjectName: subject.name, subjectId: subject.id };
                }
            }
        }
        return null;
    };

    if (topicIds.length === 0) {
        return (
            <Card className="p-6">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center"><CalendarIcon className="h-6 w-6 mr-3 text-cyan-400"/> Plano de Estudos para Hoje</h3>
                <p className="text-gray-400 text-center py-4">Nenhuma tarefa agendada para hoje. Aproveite para revisar ou explorar novos tópicos!</p>
            </Card>
        );
    }
    
    return (
        <Card className="p-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center"><CalendarIcon className="h-6 w-6 mr-3 text-cyan-400"/> Plano de Estudos para Hoje</h3>
            <ul className="space-y-3">
                {topicIds.map(topicId => {
                    const topicInfo = getTopicInfo(topicId);
                    if (!topicInfo) return null;

                    const isCompleted = studentProgress.progressByTopic[topicInfo.subjectId]?.[topicId]?.completed || false;
                    
                    return (
                        <li key={topicId} className={`p-3 rounded-lg flex items-center justify-between transition-colors ${isCompleted ? 'bg-green-900/30' : 'bg-gray-700/50'}`}>
                           <div className="flex items-center">
                             <label htmlFor={`task-${topicId}`} className="flex items-center cursor-pointer">
                                <input
                                    id={`task-${topicId}`}
                                    type="checkbox"
                                    checked={isCompleted}
                                    onChange={(e) => onToggleTopicCompletion(topicInfo.subjectId, topicId, e.target.checked)}
                                    className="h-6 w-6 rounded-full text-cyan-500 bg-gray-800 border-gray-600 focus:ring-cyan-600 focus:ring-offset-gray-800"
                                />
                                <div className="ml-4">
                                    <p className={`font-semibold ${isCompleted ? 'line-through text-gray-400' : 'text-gray-200'}`}>{topicInfo.name}</p>
                                    <p className="text-xs text-gray-400">{topicInfo.subjectName}</p>
                                </div>
                             </label>
                           </div>
                           <Button onClick={() => onNavigateToTopic(topicId)} className="py-2 px-3 text-sm">
                                Acessar <ArrowRightIcon className="h-4 w-4 ml-1" />
                           </Button>
                        </li>
                    );
                })}
            </ul>
        </Card>
    );
};
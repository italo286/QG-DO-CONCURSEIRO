import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { StudentProgress, Subject, QuestionAttempt } from '../../types';
import { Card } from '../ui';
import { ChartBarIcon } from '../Icons';
import { getLocalDateISOString } from '../../utils';
import { calculateLevel, getLevelTitle } from '../../gamification';
import { MedalHall } from './MedalHall';

const calculateLevelProgress = (xp: number) => (xp % 500) / 500 * 100;

type TopicProgressData = {
    completed: boolean;
    score: number;
    lastAttempt: QuestionAttempt[];
};

export const StudentPerformanceDetails: React.FC<{
    studentProgress: StudentProgress;
    subjects: Subject[];
}> = ({ studentProgress, subjects }) => {

    const level = calculateLevel(studentProgress.xp);
    const levelProgress = calculateLevelProgress(studentProgress.xp);

    const performanceData = useMemo(() => {
        const data = {
            bySubject: [] as { name: string; score: number; completion: number }[],
            recentActivity: [] as { date: string, questions: number }[],
            subjectsByErrorRate: [] as { name: string; errorRate: number, totalAttempts: number, incorrectAttempts: number }[],
            topicsByErrorRate: [] as { name: string; subject: string, errorRate: number, totalAttempts: number, incorrectAttempts: number }[],
            subjectsBySuccessRate: [] as { name: string; successRate: number, totalAttempts: number, correctAttempts: number }[],
            topicsBySuccessRate: [] as { name: string; subject: string, successRate: number, totalAttempts: number, correctAttempts: number }[],
        };

        subjects.forEach(subject => {
            const subjectProgress = studentProgress.progressByTopic[subject.id];
            const allSubjectTopics = (subject.topics || []).flatMap(t => [{...t, isSubtopic: false}, ...(t.subtopics || []).map(st => ({...st, isSubtopic: true}))]);
            
            if (!subjectProgress) {
                data.bySubject.push({ name: subject.name, score: 0, completion: 0 });
                return;
            }

            let totalScoreSum = 0;
            let topicsWithScoreCount = 0;
            let completedCount = 0;
            let subjectTotalAttempts = 0;
            let subjectIncorrectAttempts = 0;
            let subjectCorrectAttempts = 0;

            Object.entries(subjectProgress).forEach(([topicId, topicProgress]: [string, TopicProgressData]) => {
                const totalAttempts = topicProgress.lastAttempt?.length || 0;
                
                if (totalAttempts > 0) {
                    const incorrectAttempts = topicProgress.lastAttempt.filter(a => !a.isCorrect).length;
                    const correctAttempts = totalAttempts - incorrectAttempts;
                    
                    subjectTotalAttempts += totalAttempts;
                    subjectIncorrectAttempts += incorrectAttempts;
                    subjectCorrectAttempts += correctAttempts;

                    const originalTopicId = topicId.replace('-tec', '');
                    const allTopicsAndSubtopics = (subject.topics || []).flatMap(t => [t, ...(t.subtopics || [])]);
                    const topicInfo = allTopicsAndSubtopics.find(t => t.id === originalTopicId);
                    const topicName = topicInfo ? `${topicInfo.name}${topicId.endsWith('-tec') ? ' (Questões Extraídas)' : ''}` : 'Tópico Desconhecido';

                    data.topicsByErrorRate.push({
                        name: topicName,
                        subject: subject.name,
                        errorRate: (incorrectAttempts / totalAttempts) * 100,
                        totalAttempts: totalAttempts,
                        incorrectAttempts: incorrectAttempts
                    });

                    data.topicsBySuccessRate.push({
                        name: topicName,
                        subject: subject.name,
                        successRate: (correctAttempts / totalAttempts) * 100,
                        totalAttempts: totalAttempts,
                        correctAttempts: correctAttempts,
                    });
                }
                
                if (topicProgress.lastAttempt && topicProgress.lastAttempt.length > 0) {
                    totalScoreSum += topicProgress.score;
                    topicsWithScoreCount++;
                }
            });

            if (subjectTotalAttempts > 0) {
                data.subjectsByErrorRate.push({
                    name: subject.name,
                    errorRate: (subjectIncorrectAttempts / subjectTotalAttempts) * 100,
                    totalAttempts: subjectTotalAttempts,
                    incorrectAttempts: subjectIncorrectAttempts,
                });
                data.subjectsBySuccessRate.push({
                    name: subject.name,
                    successRate: (subjectCorrectAttempts / subjectTotalAttempts) * 100,
                    totalAttempts: subjectTotalAttempts,
                    correctAttempts: subjectCorrectAttempts,
                });
            }

            allSubjectTopics.forEach(topic => {
                if (subjectProgress[topic.id]?.completed) {
                    completedCount++;
                }
            });

            const avgScore = topicsWithScoreCount > 0 ? (totalScoreSum / topicsWithScoreCount) * 100 : 0;
            const completion = allSubjectTopics.length > 0 ? (completedCount / allSubjectTopics.length) * 100 : 0;

            data.bySubject.push({
                name: subject.name,
                score: isNaN(avgScore) ? 0 : avgScore,
                completion: isNaN(completion) ? 0 : completion,
            });
        });

        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = getLocalDateISOString(date);
            const dayData = studentProgress.dailyActivity[dateStr];
            data.recentActivity.push({
                date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit'}),
                questions: dayData?.questionsAnswered || 0,
            });
        }
        
        data.subjectsByErrorRate.sort((a, b) => b.errorRate - a.errorRate);
        data.topicsByErrorRate.sort((a, b) => b.errorRate - a.errorRate);
        data.subjectsBySuccessRate.sort((a, b) => b.successRate - a.successRate);
        data.topicsBySuccessRate.sort((a, b) => b.successRate - a.successRate);

        return data;

    }, [studentProgress, subjects]);

    return (
        <div className="space-y-8">
            <Card className="p-6">
                <h3 className="text-xl font-bold text-white mb-4">Progresso Geral</h3>
                <div className="flex items-center space-x-4 mb-2">
                    <div className="text-5xl font-bold text-cyan-400 bg-gray-700/50 rounded-full h-20 w-20 flex items-center justify-center">{level}</div>
                    <div>
                        <p className="text-2xl font-bold text-white">Nível {level}</p>
                        <p className="text-lg text-gray-300">"{getLevelTitle(level)}"</p>
                        <p className="text-gray-400">{studentProgress.xp} XP Total</p>
                    </div>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-4">
                    <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-4 rounded-full" style={{ width: `${levelProgress}%` }}></div>
                </div>
                 <p className="text-right text-sm text-gray-400 mt-1">{500 - (studentProgress.xp % 500)} XP para o próximo nível</p>
            </Card>

            <MedalHall studentProgress={studentProgress} subjects={subjects} />

             <Card className="p-6">
                <h3 className="text-xl font-bold mb-4">Média de Acertos por Disciplina</h3>
                 <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={performanceData.bySubject} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#4B5563"/>
                        <XAxis dataKey="name" stroke="#9CA3AF" />
                        <YAxis stroke="#9CA3AF" unit="%" />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }} />
                        <Legend wrapperStyle={{ color: '#D1D5DB' }}/>
                        <Bar dataKey="score" name="Acertos" fill="#22D3EE" unit="%" />
                        <Bar dataKey="completion" name="Conclusão" fill="#3B82F6" unit="%" />
                    </BarChart>
                </ResponsiveContainer>
             </Card>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Success Column */}
                <Card className="p-6">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><ChartBarIcon className="h-6 w-6 text-green-400" /> Disciplinas com Mais Acertos</h3>
                    <ul className="space-y-4 max-h-96 overflow-y-auto pr-2">
                        {performanceData.subjectsBySuccessRate.filter(s => s.successRate > 0).length > 0 ? performanceData.subjectsBySuccessRate.filter(s => s.successRate > 0).map((s, i) => (
                            <li key={i}>
                                <div className="flex justify-between items-baseline mb-1">
                                    <span className="font-semibold text-gray-200">{s.name}</span>
                                    <span className="text-sm font-mono text-green-400">{s.successRate.toFixed(1)}%</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2.5">
                                    <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${s.successRate}%` }}></div>
                                </div>
                                <p className="text-xs text-right text-gray-400 mt-1">{s.correctAttempts}/{s.totalAttempts} corretas</p>
                            </li>
                        )) : <p className="text-gray-500 text-center py-4">Nenhum acerto registrado ainda. Continue praticando!</p>}
                    </ul>
                </Card>

                 <Card className="p-6">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><ChartBarIcon className="h-6 w-6 text-teal-400" /> Tópicos com Mais Acertos</h3>
                    <ul className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {performanceData.topicsBySuccessRate.filter(t => t.successRate > 0).length > 0 ? performanceData.topicsBySuccessRate.filter(t => t.successRate > 0).map((t, i) => (
                             <li key={i} className="p-3 bg-gray-900/50 rounded-md">
                                <p className="font-semibold text-gray-200">{t.name}</p>
                                <p className="text-xs text-gray-400 mb-1">{t.subject}</p>
                                 <div className="flex justify-between items-baseline mb-1">
                                    <span className="text-sm text-teal-400">{t.successRate.toFixed(1)}% de acerto</span>
                                    <span className="text-xs text-gray-400">{t.correctAttempts}/{t.totalAttempts} corretas</span>
                                 </div>
                                 <div className="w-full bg-gray-700 rounded-full h-1.5">
                                    <div className="bg-teal-500 h-1.5 rounded-full" style={{ width: `${t.successRate}%` }}></div>
                                </div>
                            </li>
                        )) : <p className="text-gray-500 text-center py-4">Nenhum acerto registrado nos tópicos. Continue assim!</p>}
                    </ul>
                </Card>

                {/* Error Column */}
                <Card className="p-6">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><ChartBarIcon className="h-6 w-6 text-orange-400" /> Disciplinas com Mais Erros</h3>
                    <ul className="space-y-4 max-h-96 overflow-y-auto pr-2">
                        {performanceData.subjectsByErrorRate.filter(s => s.errorRate > 0).length > 0 ? performanceData.subjectsByErrorRate.filter(s => s.errorRate > 0).map((s, i) => (
                            <li key={i}>
                                <div className="flex justify-between items-baseline mb-1">
                                    <span className="font-semibold text-gray-200">{s.name}</span>
                                    <span className="text-sm font-mono text-orange-400">{s.errorRate.toFixed(1)}%</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2.5">
                                    <div className="bg-orange-500 h-2.5 rounded-full" style={{ width: `${s.errorRate}%` }}></div>
                                </div>
                                <p className="text-xs text-right text-gray-400 mt-1">{s.incorrectAttempts}/{s.totalAttempts} erradas</p>
                            </li>
                        )) : <p className="text-gray-500 text-center py-4">Nenhum erro registrado. Continue assim!</p>}
                    </ul>
                </Card>

                <Card className="p-6">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><ChartBarIcon className="h-6 w-6 text-red-400" /> Tópicos com Mais Erros</h3>
                    <ul className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {performanceData.topicsByErrorRate.filter(t => t.errorRate > 0).length > 0 ? performanceData.topicsByErrorRate.filter(t => t.errorRate > 0).map((t, i) => (
                             <li key={i} className="p-3 bg-gray-900/50 rounded-md">
                                <p className="font-semibold text-gray-200">{t.name}</p>
                                <p className="text-xs text-gray-400 mb-1">{t.subject}</p>
                                 <div className="flex justify-between items-baseline mb-1">
                                    <span className="text-sm text-red-400">{t.errorRate.toFixed(1)}% de erro</span>
                                    <span className="text-xs text-gray-400">{t.incorrectAttempts}/{t.totalAttempts} erradas</span>
                                 </div>
                                 <div className="w-full bg-gray-700 rounded-full h-1.5">
                                    <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${t.errorRate}%` }}></div>
                                </div>
                            </li>
                        )) : <p className="text-gray-500 text-center py-4">Nenhum erro registrado nos tópicos. Parabéns!</p>}
                    </ul>
                </Card>
            </div>
            
            <Card className="p-6">
                 <h3 className="text-xl font-bold mb-4">Atividade Recente (Últimos 7 dias)</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={performanceData.recentActivity}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#4B5563"/>
                        <XAxis dataKey="date" stroke="#9CA3AF" />
                        <YAxis stroke="#9CA3AF" allowDecimals={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }} />
                        <Bar dataKey="questions" name="Questões Resolvidas" fill="#818CF8" />
                    </BarChart>
                </ResponsiveContainer>
            </Card>
        </div>
    );
};
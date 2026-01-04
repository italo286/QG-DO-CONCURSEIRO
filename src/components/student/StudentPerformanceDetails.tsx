
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { StudentProgress, Subject, QuestionAttempt } from '../../types';
import { Card } from '../ui';
import { ChartBarIcon, TrophyIcon, FireIcon, CheckCircleIcon, ClipboardCheckIcon, StarIcon } from '../Icons';
import { getLocalDateISOString } from '../../utils';
import { calculateLevel, getLevelTitle, LEVEL_XP_REQUIREMENT } from '../../gamification';
import { MedalHall } from './MedalHall';

const calculateLevelProgress = (xp: number) => (xp % LEVEL_XP_REQUIREMENT) / LEVEL_XP_REQUIREMENT * 100;

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
    const levelTitle = getLevelTitle(level);
    const levelProgress = calculateLevelProgress(studentProgress.xp);
    const nextLevelXp = LEVEL_XP_REQUIREMENT - (studentProgress.xp % LEVEL_XP_REQUIREMENT);

    const totalQuestionsResolved = useMemo(() => {
        // FIX: Cast curr to any to avoid "Property 'questionsAnswered' does not exist on type 'unknown'" error.
        return Object.values(studentProgress.dailyActivity).reduce((acc, curr: any) => acc + (curr.questionsAnswered || 0), 0);
    }, [studentProgress.dailyActivity]);

    const performanceData = useMemo(() => {
        const data = {
            bySubject: [] as { name: string; score: number; completion: number }[],
            recentActivity: [] as { date: string, questions: number }[],
            subjectsBySuccessRate: [] as { name: string; successRate: number, totalAttempts: number, correctAttempts: number }[],
        };

        subjects.forEach(subject => {
            const subjectProgress = studentProgress.progressByTopic[subject.id];
            const allSubjectTopics = subject.topics.flatMap(t => [t, ...t.subtopics]);
            
            if (!subjectProgress) {
                data.bySubject.push({ name: subject.name, score: 0, completion: 0 });
                return;
            }

            let totalScoreSum = 0;
            let topicsWithScoreCount = 0;
            let completedCount = 0;
            let subjectTotalAttempts = 0;
            let subjectCorrectAttempts = 0;

            Object.entries(subjectProgress).forEach(([topicId, topicProgress]: [string, any]) => {
                const totalAttempts = topicProgress.lastAttempt?.length || 0;
                if (totalAttempts > 0) {
                    const correctAttempts = topicProgress.lastAttempt.filter((a: any) => a.isCorrect).length;
                    subjectTotalAttempts += totalAttempts;
                    subjectCorrectAttempts += correctAttempts;
                }
                
                if (topicProgress.lastAttempt && topicProgress.lastAttempt.length > 0) {
                    totalScoreSum += topicProgress.score;
                    topicsWithScoreCount++;
                }
            });

            if (subjectTotalAttempts > 0) {
                data.subjectsBySuccessRate.push({
                    name: subject.name,
                    successRate: (subjectCorrectAttempts / subjectTotalAttempts) * 100,
                    totalAttempts: subjectTotalAttempts,
                    correctAttempts: subjectCorrectAttempts,
                });
            }

            allSubjectTopics.forEach(topic => {
                if (subjectProgress[topic.id]?.completed) completedCount++;
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
            data.recentActivity.push({
                date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit'}),
                questions: studentProgress.dailyActivity[dateStr]?.questionsAnswered || 0,
            });
        }
        
        return data;
    }, [studentProgress, subjects]);

    return (
        <div className="space-y-8 animate-fade-in">
            {/* CABEÇALHO DE NÍVEL E XP - ESTILO ALTA PERFORMANCE */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-2 p-8 bg-[#020617] border-cyan-500/30 rounded-[2.5rem] relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl"></div>
                    <div className="flex items-center gap-8 relative">
                        <div className="relative">
                            <div className="absolute inset-0 bg-cyan-500/20 blur-2xl rounded-full"></div>
                            <div className="relative h-24 w-24 rounded-full border-4 border-cyan-500 flex items-center justify-center bg-gray-900 shadow-[0_0_30px_rgba(6,182,212,0.6)]">
                                <span className="text-5xl font-black text-white">{level}</span>
                            </div>
                        </div>
                        <div className="flex-grow">
                            <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic">{levelTitle}</h3>
                            <div className="mt-4 space-y-2">
                                <div className="flex justify-between items-end">
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{studentProgress.xp} XP TOTAL</span>
                                    <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">{nextLevelXp} XP PARA O NÍVEL {level + 1}</span>
                                </div>
                                <div className="h-3 bg-gray-800 rounded-full overflow-hidden p-0.5 border border-white/5">
                                    <div className="h-full bg-cyan-500 rounded-full shadow-[0_0_12px_cyan]" style={{ width: `${levelProgress}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>

                <div className="grid grid-cols-2 md:grid-cols-1 gap-4">
                    <Card className="p-6 bg-gray-800/40 border-gray-700/50 rounded-[2rem] flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-1">
                            <ClipboardCheckIcon className="h-5 w-5 text-green-400" />
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Resolvidas</span>
                        </div>
                        <p className="text-4xl font-black text-white">{totalQuestionsResolved}</p>
                        <p className="text-[10px] font-bold text-gray-600 uppercase mt-1">Questões totais</p>
                    </Card>
                    <Card className="p-6 bg-gray-800/40 border-gray-700/50 rounded-[2rem] flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-1">
                            <StarIcon className="h-5 w-5 text-yellow-400" />
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Conquistas</span>
                        </div>
                        <p className="text-4xl font-black text-white">{studentProgress.earnedBadgeIds.length}</p>
                        <p className="text-[10px] font-bold text-gray-600 uppercase mt-1">Medalhas e Troféus</p>
                    </Card>
                </div>
            </div>

            <MedalHall studentProgress={studentProgress} subjects={subjects} />

             <Card className="p-8 bg-gray-800/20 border-gray-700/30 rounded-[2.5rem]">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-1.5 h-6 bg-cyan-500 rounded-full"></div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">Desempenho por Disciplina</h3>
                </div>
                 <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={performanceData.bySubject} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false}/>
                        <XAxis dataKey="name" stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#6B7280" fontSize={10} unit="%" tickLine={false} axisLine={false} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '1rem', color: '#fff' }}
                            itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', paddingTop: '20px' }}/>
                        <Bar dataKey="score" name="Acertos" fill="#06b6d4" radius={[4, 4, 0, 0]} unit="%" />
                        <Bar dataKey="completion" name="Conclusão" fill="#6366f1" radius={[4, 4, 0, 0]} unit="%" />
                    </BarChart>
                </ResponsiveContainer>
             </Card>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="p-8 bg-emerald-500/5 border-emerald-500/20 rounded-[2.5rem]">
                    <h3 className="text-xl font-black text-emerald-400 mb-6 flex items-center gap-3 uppercase italic tracking-tighter">
                        <CheckCircleIcon className="h-6 w-6" /> Pontos Fortes
                    </h3>
                    <ul className="space-y-6">
                        {performanceData.subjectsBySuccessRate.filter(s => s.successRate >= 70).length > 0 ? 
                         performanceData.subjectsBySuccessRate.filter(s => s.successRate >= 70).map((s, i) => (
                            <li key={i} className="bg-emerald-950/20 p-4 rounded-2xl border border-emerald-500/10">
                                <div className="flex justify-between items-baseline mb-2">
                                    <span className="font-black text-white text-sm uppercase tracking-tight">{s.name}</span>
                                    <span className="text-lg font-black text-emerald-400 italic">{s.successRate.toFixed(1)}%</span>
                                </div>
                                <div className="w-full bg-emerald-900/30 rounded-full h-2">
                                    <div className="bg-emerald-500 h-full rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: `${s.successRate}%` }}></div>
                                </div>
                                <p className="text-[10px] font-bold text-emerald-600 uppercase mt-2">{s.correctAttempts} acertos de {s.totalAttempts} questões</p>
                            </li>
                        )) : <p className="text-gray-500 text-center py-10 font-bold italic opacity-40 uppercase text-xs tracking-widest">Nenhuma disciplina acima de 70% ainda.</p>}
                    </ul>
                </Card>

                 <Card className="p-8 bg-red-500/5 border-red-500/20 rounded-[2.5rem]">
                    <h3 className="text-xl font-black text-red-400 mb-6 flex items-center gap-3 uppercase italic tracking-tighter">
                        <FireIcon className="h-6 w-6" /> Pontos de Atenção
                    </h3>
                    <ul className="space-y-6">
                        {performanceData.subjectsBySuccessRate.filter(s => s.successRate < 70 && s.successRate > 0).length > 0 ? 
                         performanceData.subjectsBySuccessRate.filter(s => s.successRate < 70 && s.successRate > 0).map((s, i) => (
                            <li key={i} className="bg-red-950/20 p-4 rounded-2xl border border-red-500/10">
                                <div className="flex justify-between items-baseline mb-2">
                                    <span className="font-black text-white text-sm uppercase tracking-tight">{s.name}</span>
                                    <span className="text-lg font-black text-red-400 italic">{s.successRate.toFixed(1)}%</span>
                                </div>
                                <div className="w-full bg-red-900/30 rounded-full h-2">
                                    <div className="bg-red-500 h-full rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)]" style={{ width: `${s.successRate}%` }}></div>
                                </div>
                                <p className="text-[10px] font-bold text-red-600 uppercase mt-2">Requer revisão intensiva</p>
                            </li>
                        )) : <p className="text-gray-500 text-center py-10 font-bold italic opacity-40 uppercase text-xs tracking-widest">Excelente! Nenhuma disciplina abaixo de 70%.</p>}
                    </ul>
                </Card>
            </div>
            
            <Card className="p-8 bg-gray-800/10 border-gray-700/20 rounded-[2.5rem]">
                 <h3 className="text-xl font-black text-white mb-6 uppercase tracking-tighter italic">Ritmo de Batalha (Questões/Dia)</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={performanceData.recentActivity}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                        <XAxis dataKey="date" stroke="#6B7280" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis stroke="#6B7280" fontSize={10} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '1rem', border: 'none' }} />
                        <Bar dataKey="questions" name="Questões" fill="#fbbf24" radius={[4, 4, 4, 4]} />
                    </BarChart>
                </ResponsiveContainer>
            </Card>
        </div>
    );
};

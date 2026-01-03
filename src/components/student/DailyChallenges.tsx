
import React, { useState, useEffect } from 'react';
import { StudentProgress, DailyChallenge, Question } from '../../types';
import { Card, Button, Spinner } from '../ui';
import { CycleIcon, TagIcon, TranslateIcon, CheckCircleIcon, CheckIcon, FireIcon, XCircleIcon, GeminiIcon, TrophyIcon } from '../Icons';
import { getBrasiliaDate, getLocalDateISOString } from '../../utils';

interface DailyChallengesProps {
    studentProgress: StudentProgress;
    onStartDailyChallenge: (challenge: DailyChallenge<Question>, type: 'review' | 'glossary' | 'portuguese') => void;
    onGenerateAllChallenges: () => void;
    isGeneratingAll: boolean;
}

const WEEK_DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const CountdownTimer: React.FC = () => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = getBrasiliaDate();
            const tomorrow = new Date(now);
            tomorrow.setUTCDate(now.getUTCDate() + 1);
            tomorrow.setUTCHours(0, 0, 0, 0); 

            const diff = tomorrow.getTime() - now.getTime();
            if (diff <= 0) return '00:00:00';

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff / 1000 / 60) % 60);
            const seconds = Math.floor((diff / 1000) % 60);
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        };
        const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000);
        setTimeLeft(calculateTimeLeft());
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="flex items-center gap-2 bg-gray-900/60 px-4 py-2 rounded-full border border-gray-700/50">
            <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Próxima Recarga</span>
            <span className="text-sm font-mono font-bold text-cyan-400">{timeLeft}</span>
        </div>
    );
};

const WeeklyProgressTracker: React.FC<{ studentProgress: StudentProgress }> = ({ studentProgress }) => {
    const todayBrasilia = getBrasiliaDate();
    const todayClean = new Date(todayBrasilia);
    todayClean.setUTCHours(0, 0, 0, 0);

    const todayDayOfWeek = todayBrasilia.getUTCDay(); 
    const weekStart = new Date(todayBrasilia);
    weekStart.setUTCDate(todayBrasilia.getUTCDate() - todayDayOfWeek);
    weekStart.setUTCHours(0, 0, 0, 0);

    const weekDateObjects = Array.from({ length: 7 }).map((_, i) => {
        const date = new Date(weekStart.getTime());
        date.setUTCDate(weekStart.getUTCDate() + i);
        return date;
    });

    return (
        <div className="grid grid-cols-7 gap-1 md:gap-2 my-6">
            {weekDateObjects.map((date, index) => {
                const dateISO = getLocalDateISOString(date);
                const completions = studentProgress.dailyChallengeCompletions?.[dateISO];
                const isFullyCompleted = completions?.review && completions?.glossary && completions?.portuguese;
                const isPastDay = date.getTime() < todayClean.getTime();
                const isCurrentDay = date.getTime() === todayClean.getTime();

                let styles = 'relative h-14 rounded-2xl flex flex-col items-center justify-center transition-all duration-500 border-2 ';
                let statusIcon = null;

                if (isFullyCompleted) {
                    styles += 'bg-green-500/10 border-green-500/50 shadow-[0_0_15px_-5px_rgba(34,197,94,0.4)]';
                    statusIcon = <CheckIcon className="h-4 w-4 text-green-400" />;
                } else if (isPastDay) {
                    styles += 'bg-red-500/5 border-red-500/20';
                    statusIcon = <XCircleIcon className="h-4 w-4 text-red-500/50" />;
                } else if (isCurrentDay) {
                    styles += 'bg-cyan-500/10 border-cyan-500 animate-pulse-border';
                    statusIcon = <div className="h-1.5 w-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_cyan]" />;
                } else {
                    styles += 'bg-gray-800/30 border-gray-700/50 opacity-40';
                }

                return (
                    <div key={dateISO} className={styles} title={date.toLocaleDateString()}>
                        <span className={`text-[10px] font-black uppercase ${isCurrentDay ? 'text-cyan-400' : 'text-gray-500'}`}>{WEEK_DAYS[index]}</span>
                        <div className="mt-1">{statusIcon}</div>
                        {isCurrentDay && <div className="absolute -top-1 -right-1 bg-cyan-500 w-2 h-2 rounded-full ring-2 ring-gray-900" />}
                    </div>
                );
            })}
        </div>
    );
};

const ChallengeItem: React.FC<{
    title: string;
    icon: React.FC<{ className?: string }>;
    challenge: DailyChallenge<Question> | undefined;
    challengeType: 'review' | 'glossary' | 'portuguese';
    onStart: (challenge: DailyChallenge<Question>, type: 'review' | 'glossary' | 'portuguese') => void;
    gradient: string;
}> = ({ title, icon: Icon, challenge, challengeType, onStart, gradient }) => {

    if (!challenge) return null;

    return (
        <div className={`group relative p-5 rounded-3xl transition-all duration-300 border-2 ${challenge.isCompleted ? 'bg-green-500/5 border-green-500/20' : 'bg-gray-800/40 border-gray-700 hover:border-gray-600 hover:translate-y-[-2px] hover:shadow-xl'}`}>
            <div className="flex items-center gap-5">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg ${gradient}`}>
                    <Icon className="h-7 w-7 text-white" />
                </div>
                <div className="flex-grow">
                    <div className="flex items-center gap-2">
                        <h4 className={`font-black uppercase tracking-tighter text-lg ${challenge.isCompleted ? 'text-gray-500 line-through' : 'text-white'}`}>{title}</h4>
                        {challenge.isCompleted && <CheckCircleIcon className="h-5 w-5 text-green-500" />}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{challenge.items.length} Missões</span>
                        {challenge.sessionAttempts && challenge.sessionAttempts.length > 0 && !challenge.isCompleted && (
                            <span className="text-[9px] bg-cyan-900/40 text-cyan-400 px-2 py-0.5 rounded-full font-black border border-cyan-500/20">Em Andamento</span>
                        )}
                    </div>
                </div>
                {!challenge.isCompleted && (
                    <Button onClick={() => onStart(challenge, challengeType)} className="rounded-2xl py-3 px-6 text-xs font-black uppercase tracking-widest shadow-xl shadow-black/20 group-hover:scale-105 active:scale-95 transition-all">
                        {challenge.sessionAttempts?.length > 0 ? 'Retomar' : 'Iniciar'}
                    </Button>
                )}
            </div>
            {challenge.isCompleted && (
                <div className="absolute inset-0 bg-gray-900/10 rounded-3xl pointer-events-none" />
            )}
        </div>
    );
};

export const DailyChallenges: React.FC<DailyChallengesProps> = ({
    studentProgress,
    onStartDailyChallenge,
    onGenerateAllChallenges,
    isGeneratingAll,
}) => {
    const todayISO = getLocalDateISOString(getBrasiliaDate());
    const challengesGeneratedToday = studentProgress.reviewChallenge?.date === todayISO;
    const streak = studentProgress.dailyChallengeStreak?.current || 0;
    
    return (
        <div className="space-y-6">
            <header className="flex justify-between items-end">
                <div>
                    <h3 className="text-4xl font-black text-white uppercase tracking-tighter mb-1">Central de Missões</h3>
                    <p className="text-gray-400 text-sm font-medium">Complete seus objetivos diários e ganhe XP de elite.</p>
                </div>
                {challengesGeneratedToday && <CountdownTimer />}
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1 p-6 bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700">
                    <div className="flex flex-col items-center text-center">
                        <div className="relative mb-4">
                            <div className="h-24 w-24 rounded-full border-4 border-orange-500/30 flex items-center justify-center">
                                <FireIcon className={`h-14 w-14 ${streak > 0 ? 'text-orange-500 animate-pulse' : 'text-gray-700'}`} />
                            </div>
                            {streak > 0 && (
                                <div className="absolute -bottom-2 -right-2 bg-orange-500 text-white font-black px-3 py-1 rounded-full text-lg shadow-lg">
                                    {streak}
                                </div>
                            )}
                        </div>
                        <h4 className="text-xl font-black text-white uppercase tracking-tight">Ofensiva Atual</h4>
                        <p className="text-gray-500 text-xs mt-2 max-w-[180px]">
                            {streak > 0 
                                ? `Você está pegando fogo! ${streak} dias de consistência pura.`
                                : "Comece uma ofensiva hoje e ganhe bônus de XP acumulativos!"}
                        </p>
                        
                        <div className="w-full mt-6 pt-6 border-t border-gray-700">
                             <WeeklyProgressTracker studentProgress={studentProgress} />
                        </div>
                    </div>
                </Card>

                <div className="lg:col-span-2 space-y-4">
                    {challengesGeneratedToday ? (
                        <div className="grid grid-cols-1 gap-4 animate-fade-in">
                            <ChallengeItem
                                title="Revisão Diária"
                                icon={CycleIcon}
                                challenge={studentProgress.reviewChallenge}
                                challengeType="review"
                                onStart={onStartDailyChallenge}
                                gradient="bg-gradient-to-br from-emerald-400 to-green-600"
                            />
                            <ChallengeItem
                                title="Desafio do Glossário"
                                icon={TagIcon}
                                challenge={studentProgress.glossaryChallenge}
                                challengeType="glossary"
                                onStart={onStartDailyChallenge}
                                gradient="bg-gradient-to-br from-blue-400 to-cyan-600"
                            />
                            <ChallengeItem
                                title="Desafio de Português"
                                icon={TranslateIcon}
                                challenge={studentProgress.portugueseChallenge}
                                challengeType="portuguese"
                                onStart={onStartDailyChallenge}
                                gradient="bg-gradient-to-br from-indigo-400 to-purple-600"
                            />
                        </div>
                    ) : (
                        <Card className="h-full flex flex-col items-center justify-center p-12 text-center bg-gray-800/40 border-dashed border-2 border-gray-700 group hover:border-cyan-500/50 transition-colors">
                            <div className="w-20 h-20 bg-cyan-500/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <GeminiIcon className="h-10 w-10 text-cyan-400" />
                            </div>
                            <h4 className="text-2xl font-black text-white uppercase tracking-tighter mb-3">Missões Disponíveis</h4>
                            <p className="text-gray-400 mb-8 max-w-sm">O QG está pronto para gerar seus novos alvos de estudo com base no seu desempenho atual.</p>
                            <Button onClick={onGenerateAllChallenges} disabled={isGeneratingAll} className="px-12 py-4 text-lg font-black uppercase tracking-widest shadow-[0_15px_30px_-10px_rgba(6,182,212,0.5)]">
                                {isGeneratingAll ? <Spinner /> : 'Gerar Novas Missões'}
                            </Button>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};

import React, { useState, useEffect } from 'react';
import { StudentProgress, DailyChallenge, Question } from '../../types';
import { Card, Button, Spinner } from '../ui';
import { CycleIcon, TagIcon, TranslateIcon, CheckCircleIcon, CheckIcon, FireIcon, XCircleIcon } from '../Icons';
import { getBrasiliaDate, getLocalDateISOString } from '../../utils';

interface DailyChallengesProps {
    studentProgress: StudentProgress;
    onStartDailyChallenge: (challenge: DailyChallenge<Question>, type: 'review' | 'glossary' | 'portuguese') => void;
    onGenerateAllChallenges: () => void;
    isGeneratingAll: boolean;
}

const WEEK_DAYS = ['D', '2ª', '3ª', '4ª', '5ª', '6ª', 'S'];

const CountdownTimer: React.FC = () => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = getBrasiliaDate();
            const tomorrow = new Date(now);
            tomorrow.setUTCDate(now.getUTCDate() + 1);
            tomorrow.setUTCHours(0, 0, 0, 0); // Midnight in Brasília

            const diff = tomorrow.getTime() - now.getTime();
            
            if (diff <= 0) {
                return '00:00:00';
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff / 1000 / 60) % 60);
            const seconds = Math.floor((diff / 1000) % 60);
            
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        };

        const timer = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        // Initial calculation
        setTimeLeft(calculateTimeLeft());

        return () => clearInterval(timer);
    }, []);

    return (
        <div className="text-center my-6">
            <p className="text-gray-300 mb-2">Você já gerou os desafios de hoje. Volte amanhã!</p>
            <div className="text-2xl font-bold text-cyan-400 font-mono" aria-live="polite">{timeLeft}</div>
            <p className="text-xs text-gray-500">para novos desafios</p>
        </div>
    );
};

const WeeklyProgressTracker: React.FC<{ studentProgress: StudentProgress }> = ({ studentProgress }) => {
    const todayBrasilia = getBrasiliaDate();
    const todayClean = new Date(todayBrasilia);
    todayClean.setUTCHours(0, 0, 0, 0);

    const todayDayOfWeek = todayBrasilia.getUTCDay(); // 0 for Sunday

    // Calculate the start of the week (Sunday)
    const weekStart = new Date(todayBrasilia);
    weekStart.setUTCDate(todayBrasilia.getUTCDate() - todayDayOfWeek);
    weekStart.setUTCHours(0, 0, 0, 0);

    const weekDateObjects = Array.from({ length: 7 }).map((_, i) => {
        const date = new Date(weekStart.getTime());
        date.setUTCDate(weekStart.getUTCDate() + i);
        return date;
    });

    return (
        <div className="flex justify-center items-center gap-3 md:gap-4 my-4">
            {weekDateObjects.map((date, index) => {
                const dateISO = getLocalDateISOString(date);
                const completions = studentProgress.dailyChallengeCompletions?.[dateISO];
                const isFullyCompleted = completions?.review && completions?.glossary && completions?.portuguese;

                const isPastDay = date.getTime() < todayClean.getTime();
                const isCurrentDay = date.getTime() === todayClean.getTime();

                let styles = 'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors duration-300 ';
                let content: React.ReactNode = WEEK_DAYS[index];
                
                if (isCurrentDay) {
                    styles += 'bg-cyan-500 text-white ring-2 ring-offset-2 ring-offset-gray-800 ring-cyan-400';
                    if (isFullyCompleted) {
                        content = <CheckIcon className="h-6 w-6" />;
                    } else {
                        content = WEEK_DAYS[index];
                    }
                } else if (isPastDay) {
                    if (isFullyCompleted) {
                        styles += 'bg-green-500 text-white';
                        content = <CheckIcon className="h-6 w-6" />;
                    } else { // Not fully completed (partial or zero)
                        styles += 'bg-red-800 text-red-300';
                        content = <XCircleIcon className="h-8 w-8" />;
                    }
                } else { // isFutureDay
                    styles += 'bg-gray-700 text-gray-400';
                    content = WEEK_DAYS[index];
                }

                const title = date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC' });

                return (
                    <div key={dateISO} className={styles} title={title}>
                        {content}
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

    const buttonAction = () => onStart(challenge, challengeType);

    return (
        <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
            <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${gradient}`}>
                    <Icon className="h-7 w-7 text-white" />
                </div>
                <div>
                    <h4 className="font-bold text-white">{title}</h4>
                    <p className="text-sm text-gray-400">{challenge.items.length} {challenge.items.length === 1 ? 'questão' : 'questões'}</p>
                </div>
            </div>
            {challenge.isCompleted ? (
                <div className="flex items-center gap-2 text-green-400 font-semibold text-sm">
                    <CheckCircleIcon className="h-5 w-5" />
                    Concluído
                </div>
            ) : (
                <Button onClick={buttonAction} className="py-2 px-4 text-sm whitespace-nowrap">
                    {challenge.sessionAttempts && challenge.sessionAttempts.length > 0 ? 'Continuar' : 'Começar'}
                </Button>
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
    
    const hasPendingChallenges = !challengesGeneratedToday || (
        !studentProgress.reviewChallenge?.isCompleted ||
        !studentProgress.glossaryChallenge?.isCompleted ||
        !studentProgress.portugueseChallenge?.isCompleted
    );

    const shouldHighlight = !challengesGeneratedToday || hasPendingChallenges;

    return (
        <Card className={`p-6 transition-all duration-500 ${shouldHighlight ? 'bg-gradient-to-br from-yellow-500/70 to-orange-500/70 backdrop-blur-lg border border-yellow-500/30 shadow-lg shadow-orange-500/20' : ''}`}>
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-2xl font-bold text-white">Sua Trilha Diária</h3>
                {streak > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-orange-500/20 border border-orange-500 rounded-full">
                        <FireIcon className="h-5 w-5 text-orange-400" />
                        <span className="font-bold text-white">{streak}</span>
                        <span className="text-sm text-gray-300">{streak === 1 ? 'dia' : 'dias'}</span>
                    </div>
                )}
            </div>
            <p className="text-gray-200 mb-4">Complete os desafios para ganhar XP e manter sua ofensiva.</p>
            
            <WeeklyProgressTracker studentProgress={studentProgress} />
            
            {challengesGeneratedToday ? (
                <CountdownTimer />
            ) : (
                <div className="text-center my-6">
                    <Button onClick={onGenerateAllChallenges} disabled={isGeneratingAll}>
                        {isGeneratingAll ? <Spinner /> : 'Gerar Desafios de Hoje'}
                    </Button>
                </div>
            )}
            
            {challengesGeneratedToday && (
                 <div className="space-y-4 animate-fade-in">
                    <ChallengeItem
                        title="Desafio da Revisão"
                        icon={CycleIcon}
                        challenge={studentProgress.reviewChallenge}
                        challengeType="review"
                        onStart={onStartDailyChallenge}
                        gradient="bg-gradient-to-br from-teal-500 to-green-500"
                    />
                     <ChallengeItem
                        title="Desafio do Glossário"
                        icon={TagIcon}
                        challenge={studentProgress.glossaryChallenge}
                        challengeType="glossary"
                        onStart={onStartDailyChallenge}
                        gradient="bg-gradient-to-br from-sky-500 to-blue-500"
                    />
                     <ChallengeItem
                        title="Desafio de Português"
                        icon={TranslateIcon}
                        challenge={studentProgress.portugueseChallenge}
                        challengeType="portuguese"
                        onStart={onStartDailyChallenge}
                        gradient="bg-gradient-to-br from-purple-500 to-indigo-500"
                    />
                </div>
            )}
        </Card>
    );
};
import React, { useState, useEffect } from 'react';
import { StudentProgress, DailyChallenge, Question } from '../../types';
import { Card, Button, Spinner } from '../ui';
import { TagIcon, TranslateIcon, RefreshIcon, FireIcon } from '../Icons';
import { getBrasiliaDate, getLocalDateISOString } from '../../utils';

const Countdown: React.FC<{ targetTime: string }> = ({ targetTime }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        const calculateAndSetTime = () => {
            const now = getBrasiliaDate();
            
            const [hours, minutes] = targetTime.split(':').map(Number);
            let targetDate = getBrasiliaDate();
            targetDate.setUTCHours(hours, minutes, 0, 0);
            
            if (now.getTime() > targetDate.getTime()) {
                targetDate.setUTCDate(targetDate.getUTCDate() + 1);
            }

            const difference = targetDate.getTime() - now.getTime();
            if (difference > 0) {
                const h = Math.floor((difference / (1000 * 60 * 60)));
                const m = Math.floor((difference / 1000 / 60) % 60);
                const s = Math.floor((difference / 1000) % 60);
                setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
            } else {
                setTimeLeft('Carregando...');
            }
        };

        calculateAndSetTime();
        const timer = setInterval(calculateAndSetTime, 1000);

        return () => clearInterval(timer);
    }, [targetTime]);

    return (
        <div className="text-center">
            <p className="text-sm text-gray-400">Próximo desafio em:</p>
            <p className="text-2xl font-mono font-bold text-cyan-400">{timeLeft}</p>
        </div>
    );
};


interface DailyChallengesProps {
    studentProgress: StudentProgress;
    onStartDailyChallenge: (challengeType: 'review' | 'glossary' | 'portuguese') => void;
}

const ChallengeCard: React.FC<{
    title: string;
    description: string;
    Icon: React.FC<{className?: string}>;
    challenge: DailyChallenge<Question> | undefined | null;
    onStart: () => void;
    gradient: string;
    studentProgress: StudentProgress;
}> = ({ title, description, Icon, challenge, onStart, gradient, studentProgress }) => {
    const todayISO = getLocalDateISOString(getBrasiliaDate());
    const isTodayChallenge = challenge?.date === todayISO || challenge?.generatedForDate === todayISO;
    const isCompleted = challenge?.isCompleted;
    const isPartiallyDone = (challenge?.sessionAttempts?.length || 0) > 0 && !isCompleted;
    const preferredTimeStr = studentProgress.dailyChallengeTime || '06:00';

    return (
        <Card className={`p-6 flex flex-col justify-between ${gradient}`}>
            <div>
                <h3 className="text-xl font-bold text-white flex items-center">
                    <Icon className="h-6 w-6 mr-3" /> {title}
                </h3>
                <p className="text-gray-200 mt-2 text-sm">{description}</p>
            </div>
            <div className="mt-4 text-center">
                {isTodayChallenge && !isCompleted ? (
                     <Button onClick={onStart} className="bg-white/20 hover:bg-white/30 w-full">
                        {isPartiallyDone ? 'Continuar Desafio' : 'Iniciar Desafio!'}
                     </Button>
                ) : (
                    <Countdown targetTime={preferredTimeStr} />
                )}
            </div>
        </Card>
    );
};


export const DailyChallenges: React.FC<DailyChallengesProps> = ({ studentProgress, onStartDailyChallenge }) => {
    const streak = studentProgress.dailyChallengeStreak?.current || 0;

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Desafios Diários</h2>
                {streak > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-orange-500/20 border border-orange-500/50 rounded-full text-orange-300 font-semibold animate-pulse-orange">
                        <FireIcon className="h-5 w-5" />
                        <span>{streak} dia{streak > 1 ? 's' : ''} de ofensiva!</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <ChallengeCard
                    title="Desafio da Revisão"
                    description="Acerte questões que você errou anteriormente."
                    Icon={RefreshIcon}
                    challenge={studentProgress.reviewChallenge}
                    onStart={() => onStartDailyChallenge('review')}
                    gradient="bg-gradient-to-br from-cyan-900 to-blue-900"
                    studentProgress={studentProgress}
                />
                <ChallengeCard
                    title="Desafio do Glossário"
                    description="Teste seu conhecimento dos termos técnicos."
                    Icon={TagIcon}
                    challenge={studentProgress.glossaryChallenge}
                    onStart={() => onStartDailyChallenge('glossary')}
                    gradient="bg-gradient-to-br from-emerald-900 to-teal-900"
                    studentProgress={studentProgress}
                />
                 <ChallengeCard
                    title="Desafio de Português"
                    description="Encontre o erro gramatical na frase."
                    Icon={TranslateIcon}
                    challenge={studentProgress.portugueseChallenge}
                    onStart={() => onStartDailyChallenge('portuguese')}
                    gradient="bg-gradient-to-br from-rose-900 to-pink-900"
                    studentProgress={studentProgress}
                />
            </div>
        </div>
    );
};
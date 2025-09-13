import React from 'react';
import { StudentProgress, DailyChallenge } from '../../types';
import { Card, Button } from '../ui';
import { CheckBadgeIcon, ClipboardListIcon, TranslateIcon, FireIcon } from '../Icons';
import { getLocalDateISOString, getBrasiliaDate } from '../../utils';

interface DailyChallengesProps {
    studentProgress: StudentProgress | null;
    onStartDailyChallenge: (challengeType: 'review' | 'glossary' | 'portuguese') => void;
}

const ChallengeCard: React.FC<{
    title: string;
    icon: React.FC<{className?: string}>;
    challenge: DailyChallenge<any> | undefined;
    onStart: () => void;
    type: string;
    studentProgress: StudentProgress | null;
}> = ({ title, icon: Icon, challenge, onStart, type, studentProgress }) => {
    
    const maxAttemptsKey = `${type}ChallengeMaxAttempts` as keyof StudentProgress;
    const maxAttempts = studentProgress?.[maxAttemptsKey] as number | 'unlimited' | undefined ?? 1;

    const isEffectivelyCompleted = challenge?.isCompleted || (
        challenge && maxAttempts !== 'unlimited' &&
        (challenge.attemptsMade || 0) >= maxAttempts
    );

    const hasStarted = challenge && (challenge.sessionAttempts?.length || 0) > 0;
    const itemsCount = challenge?.items?.length || 0;
    
    // Countdown logic
    const getNextChallengeTime = () => {
        const challengeTime = studentProgress?.dailyChallengeTime || '06:00';
        const [hours, minutes] = challengeTime.split(':').map(Number);
        const now = getBrasiliaDate();
        
        let nextDate = getBrasiliaDate();
        nextDate.setUTCHours(hours, minutes, 0, 0);

        if (now > nextDate) {
            nextDate.setUTCDate(nextDate.getUTCDate() + 1);
        }
        
        return nextDate;
    };
    
    const Countdown: React.FC = () => {
        const [timeLeft, setTimeLeft] = React.useState('');

        React.useEffect(() => {
            const timer = setInterval(() => {
                const difference = +getNextChallengeTime() - +getBrasiliaDate();
                if (difference > 0) {
                    const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
                    const minutes = Math.floor((difference / 1000 / 60) % 60);
                    const seconds = Math.floor((difference / 1000) % 60);
                    setTimeLeft(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
                } else {
                    setTimeLeft('00:00:00');
                }
            }, 1000);
            return () => clearInterval(timer);
        }, []);

        return (
            <div className="mt-3 text-center">
                <p className="text-sm text-gray-400">Próximo desafio em:</p>
                <p className="font-mono font-bold text-lg text-cyan-400">{timeLeft}</p>
            </div>
        );
    };


    return (
        <div className={`p-4 rounded-lg flex flex-col justify-between text-center transition-all ${isEffectivelyCompleted ? 'bg-green-900/30' : 'bg-gray-700/50'}`}>
            <div>
                <Icon className={`h-10 w-10 mx-auto mb-2 ${isEffectivelyCompleted ? 'text-green-400' : 'text-cyan-400'}`} />
                <h4 className="font-bold text-white">{title}</h4>
                <p className="text-xs text-gray-400 mt-1">{itemsCount} {type === 'portuguese' ? 'frases' : (type === 'glossary' ? 'termos' : 'questões')}</p>
            </div>
            
            {isEffectivelyCompleted ? (
                <Countdown />
            ) : (
                <Button onClick={onStart} disabled={itemsCount === 0} className="mt-3 text-sm py-2 px-3 w-full">
                    {itemsCount > 0 ? (hasStarted ? 'Continuar Desafio' : 'Começar') : 'N/A para hoje'}
                </Button>
            )}
        </div>
    );
};


export const DailyChallenges: React.FC<DailyChallengesProps> = ({ studentProgress, onStartDailyChallenge }) => {
    if (!studentProgress) return null;

    const { reviewChallenge, glossaryChallenge, portugueseChallenge, dailyChallengeStreak } = studentProgress;
    const streak = dailyChallengeStreak?.current || 0;

    return (
        <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">Desafios Diários</h3>
                {streak > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-orange-500/20 border border-orange-500/50 rounded-full text-orange-300">
                        <FireIcon className="h-5 w-5" />
                        <span className="font-bold text-sm">{streak} dia(s) de ofensiva</span>
                    </div>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ChallengeCard 
                    title="Desafio da Revisão"
                    icon={ClipboardListIcon}
                    challenge={reviewChallenge}
                    onStart={() => onStartDailyChallenge('review')}
                    type="review"
                    studentProgress={studentProgress}
                />
                <ChallengeCard 
                    title="Desafio do Glossário"
                    icon={TranslateIcon}
                    challenge={glossaryChallenge}
                    onStart={() => onStartDailyChallenge('glossary')}
                    type="glossary"
                    studentProgress={studentProgress}
                />
                 <ChallengeCard 
                    title="Desafio de Português"
                    icon={TranslateIcon}
                    challenge={portugueseChallenge}
                    onStart={() => onStartDailyChallenge('portuguese')}
                    type="portuguese"
                    studentProgress={studentProgress}
                />
            </div>
        </Card>
    );
};
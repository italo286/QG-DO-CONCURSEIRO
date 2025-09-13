import React from 'react';
import { StudentProgress, DailyChallenge } from '../../types';
import { Card, Button } from '../ui';
import { TranslateIcon, FireIcon, CycleIcon, TagIcon, SparklesIcon } from '../Icons';
import { getBrasiliaDate, getLocalDateISOString } from '../../utils';

interface DailyChallengesProps {
    studentProgress: StudentProgress | null;
    onStartDailyChallenge: (challenge: DailyChallenge<any>, type: 'review' | 'glossary' | 'portuguese', isCatchUp?: boolean) => void;
}

const ChallengeCard: React.FC<{
    title: string;
    icon: React.FC<{className?: string}>;
    challenge: DailyChallenge<any> | undefined;
    onStart: () => void;
    type: 'review' | 'glossary' | 'portuguese';
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

    let cardClasses = 'bg-gradient-to-br border transition-all duration-300 ';
    let iconColor = 'text-cyan-300';
    
    if (isEffectivelyCompleted) {
        cardClasses += 'bg-green-900/30 border-green-800/50';
        iconColor = 'text-green-400';
    } else {
        switch(type) {
            case 'review':
                cardClasses += 'from-rose-900 to-red-900 border-rose-700/50 hover:border-rose-400';
                break;
            case 'glossary':
                cardClasses += 'from-indigo-900 to-blue-900 border-indigo-700/50 hover:border-indigo-400';
                break;
            case 'portuguese':
                cardClasses += 'from-teal-900 to-green-900 border-teal-700/50 hover:border-teal-400';
                break;
        }
    }

    return (
        <div className={`p-4 rounded-lg flex flex-col justify-between text-center ${cardClasses}`}>
            <div>
                <Icon className={`h-10 w-10 mx-auto mb-2 ${iconColor}`} />
                <h4 className="font-bold text-white">{title}</h4>
                <p className="text-xs text-gray-400 mt-1">{itemsCount} {type === 'portuguese' ? 'frases' : (type === 'glossary' ? 'termos' : 'questões')}</p>
            </div>
            
            {isEffectivelyCompleted ? (
                <Countdown />
            ) : (
                <Button 
                    onClick={onStart} 
                    disabled={itemsCount === 0} 
                    className="mt-3 text-sm py-2 px-3 w-full bg-black/20 hover:bg-black/40 border border-white/20"
                >
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

    const yesterday = getBrasiliaDate();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayISO = getLocalDateISOString(yesterday);

    const missedChallenges = (['review', 'glossary', 'portuguese'] as const)
        .map(type => {
            const challengeKey = `${type}Challenge` as const;
            const challenge = studentProgress[challengeKey];
            if (challenge && challenge.generatedForDate === yesterdayISO && !challenge.isCompleted) {
                return { type, challenge };
            }
            return null;
        })
        .filter((c): c is { type: 'review' | 'glossary' | 'portuguese', challenge: DailyChallenge<any> } => c !== null);

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
            {missedChallenges.length > 0 && (
                <div className="mb-4 p-4 rounded-lg bg-yellow-500/20 border border-yellow-500/30 text-center animate-pulse-orange">
                    <h4 className="font-bold text-yellow-300">Não perca sua ofensiva! 🔥</h4>
                    <p className="text-sm text-yellow-200/80 my-2">Você tem desafios de ontem pendentes. Complete-os para manter sua sequência.</p>
                    <div className="flex justify-center gap-2 mt-3">
                    {missedChallenges.map(({ type, challenge }) => (
                        <Button key={type} onClick={() => onStartDailyChallenge(challenge, type, true)} className="text-sm py-2 px-3 bg-yellow-600 hover:bg-yellow-500">
                            <SparklesIcon className="h-4 w-4 mr-2"/>
                            Recuperar Desafio de {type === 'review' ? 'Revisão' : type === 'glossary' ? 'Glossário' : 'Português'}
                        </Button>
                    ))}
                    </div>
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ChallengeCard 
                    title="Desafio da Revisão"
                    icon={CycleIcon}
                    challenge={reviewChallenge}
                    onStart={() => onStartDailyChallenge(reviewChallenge!, 'review')}
                    type="review"
                    studentProgress={studentProgress}
                />
                <ChallengeCard 
                    title="Desafio do Glossário"
                    icon={TagIcon}
                    challenge={glossaryChallenge}
                    onStart={() => onStartDailyChallenge(glossaryChallenge!, 'glossary')}
                    type="glossary"
                    studentProgress={studentProgress}
                />
                 <ChallengeCard 
                    title="Desafio de Português"
                    icon={TranslateIcon}
                    challenge={portugueseChallenge}
                    onStart={() => onStartDailyChallenge(portugueseChallenge!, 'portuguese')}
                    type="portuguese"
                    studentProgress={studentProgress}
                />
            </div>
        </Card>
    );
};

import React, { useState, useEffect } from 'react';
import { StudentProgress, DailyChallenge } from '../../types';
import { Card, Button } from '../ui';
import { TagIcon, TranslateIcon, RefreshIcon } from '../Icons';
import { getBrasiliaDate } from '../../utils';

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
                setTimeLeft('00:00:00');
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
    challenge: DailyChallenge<any> | undefined | null;
    onStart: () => void;
    gradient: string;
    studentProgress: StudentProgress;
    challengeType: 'review' | 'glossary' | 'portuguese';
}> = ({ title, description, Icon, challenge, onStart, gradient, studentProgress, challengeType }) => {
    const uncompletedCount = challenge?.uncompletedCount || 0;
    const answeredCount = challenge?.sessionAttempts?.length || 0;
    const isCompleted = challenge?.isCompleted;
    const attemptsMade = challenge?.attemptsMade || 0;
    const preferredTimeStr = studentProgress.dailyChallengeTime || '06:00';
    
    let maxAttempts: number | 'unlimited' = 1;
    switch (challengeType) {
        case 'review':
            maxAttempts = studentProgress.dailyReviewMode === 'standard' ? 1 : (studentProgress.advancedReviewMaxAttempts ?? 1);
            break;
        case 'glossary':
            maxAttempts = studentProgress.glossaryChallengeMode === 'standard' ? 1 : (studentProgress.glossaryChallengeMaxAttempts ?? 1);
            break;
        case 'portuguese':
            maxAttempts = studentProgress.portugueseChallengeMaxAttempts ?? 1;
            break;
    }

    const hasUsedAttempts = maxAttempts !== 'unlimited' && attemptsMade >= maxAttempts;
    
    const isPartiallyDone = answeredCount > 0 && !isCompleted;
    const buttonText = isPartiallyDone ? 'Continuar Desafio' : 'Iniciar Desafio!';

    return (
        <Card className={`p-6 flex flex-col justify-between ${gradient}`}>
            <div>
                <h3 className="text-xl font-bold text-white flex items-center">
                    <Icon className="h-6 w-6 mr-3" /> {title}
                </h3>
                <p className="text-gray-200 mt-2 text-sm">{description}</p>
                {uncompletedCount > 0 && <p className="text-yellow-300 text-xs mt-1">{uncompletedCount} desafio(s) anterior(es) não concluído(s).</p>}
            </div>
            <div className="mt-4 text-center">
                {challenge ? (
                    (isCompleted || hasUsedAttempts) ? (
                        <Countdown targetTime={preferredTimeStr} />
                    ) : (
                        <Button onClick={onStart} className="bg-white/20 hover:bg-white/30 w-full">
                           {buttonText}
                        </Button>
                    )
                ) : (
                    <p className="text-sm font-semibold text-gray-400">Indisponível</p>
                )}
            </div>
        </Card>
    );
};


export const DailyChallenges: React.FC<DailyChallengesProps> = ({ studentProgress, onStartDailyChallenge }) => {
    
    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">Desafios Diários</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <ChallengeCard
                    title="Desafio da Revisão"
                    description="Acerte questões que você errou anteriormente."
                    Icon={RefreshIcon}
                    challenge={studentProgress.reviewChallenge}
                    onStart={() => onStartDailyChallenge('review')}
                    gradient="bg-gradient-to-br from-cyan-900 to-blue-900"
                    studentProgress={studentProgress}
                    challengeType="review"
                />
                <ChallengeCard
                    title="Desafio do Glossário"
                    description="Teste seu conhecimento dos termos técnicos."
                    Icon={TagIcon}
                    challenge={studentProgress.glossaryChallenge}
                    onStart={() => onStartDailyChallenge('glossary')}
                    gradient="bg-gradient-to-br from-emerald-900 to-teal-900"
                    studentProgress={studentProgress}
                    challengeType="glossary"
                />
                 <ChallengeCard
                    title="Desafio de Português"
                    description="Encontre o erro gramatical na frase."
                    Icon={TranslateIcon}
                    challenge={studentProgress.portugueseChallenge}
                    onStart={() => onStartDailyChallenge('portuguese')}
                    gradient="bg-gradient-to-br from-rose-900 to-pink-900"
                    studentProgress={studentProgress}
                    challengeType="portuguese"
                />
            </div>
        </div>
    );
};
import React from 'react';
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

const WEEK_DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const WeeklyProgressTracker: React.FC<{ studentProgress: StudentProgress }> = ({ studentProgress }) => {
    const today = getBrasiliaDate();
    today.setUTCHours(0, 0, 0, 0); // Normalize to start of day for comparison
    const todayIndex = today.getUTCDay();

    const weekStart = getBrasiliaDate();
    weekStart.setUTCDate(today.getUTCDate() - todayIndex);
    weekStart.setUTCHours(0, 0, 0, 0);

    const weekDates = Array.from({ length: 7 }).map((_, i) => {
        const date = new Date(weekStart.getTime());
        date.setUTCDate(weekStart.getUTCDate() + i);
        return getLocalDateISOString(date);
    });

    return (
        <div className="flex justify-center items-center gap-3 md:gap-4 my-4">
            {weekDates.map((dateISO, index) => {
                const dateObj = new Date(dateISO + 'T00:00:00Z');
                const completions = studentProgress.dailyChallengeCompletions?.[dateISO];
                const isFullyCompleted = completions?.review && completions?.glossary && completions?.portuguese;
                const isPastDay = dateObj < today;
                const isCurrentDay = dateObj.getTime() === today.getTime();

                let styles = 'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors duration-300 ';
                let content: React.ReactNode = WEEK_DAYS[index];

                if (isFullyCompleted) {
                    styles += 'bg-green-500 text-white';
                    content = <CheckIcon className="h-6 w-6" />;
                } else if (isPastDay && completions) { // A past day with partial (but not full) completion
                    styles += 'bg-red-800 text-red-300';
                    content = <XCircleIcon className="h-8 w-8" />;
                } else if (isCurrentDay) {
                    styles += 'bg-cyan-500 text-white ring-2 ring-offset-2 ring-offset-gray-800 ring-cyan-400';
                } else {
                    styles += 'bg-gray-700 text-gray-400';
                }

                return (
                    <div key={dateISO} className={styles} title={new Date(dateISO + 'T12:00:00Z').toLocaleDateString('pt-BR')}>
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
    const needsGeneration = !studentProgress.reviewChallenge || studentProgress.reviewChallenge.date !== todayISO;
    const streak = studentProgress.dailyChallengeStreak?.current || 0;
    
    const hasPendingChallenges = !needsGeneration && (
        !studentProgress.reviewChallenge?.isCompleted ||
        !studentProgress.glossaryChallenge?.isCompleted ||
        !studentProgress.portugueseChallenge?.isCompleted
    );

    const shouldHighlight = needsGeneration || hasPendingChallenges;

    return (
        <Card className={`p-6 transition-all duration-500 ${shouldHighlight ? 'bg-gradient-to-br from-yellow-400/70 to-orange-500/70 backdrop-blur-sm border border-yellow-500/20' : ''}`}>
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
            
            <div className="text-center my-6">
                 <Button onClick={onGenerateAllChallenges} disabled={isGeneratingAll}>
                    {isGeneratingAll ? <Spinner /> : (needsGeneration ? 'Gerar Desafios de Hoje' : 'Refazer Desafios Diários')}
                </Button>
            </div>
            
            {!needsGeneration && (
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

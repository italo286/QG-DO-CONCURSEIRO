import React from 'react';
import { StudentProgress, DailyChallenge } from '../../types';
import { Card, Button, Spinner } from '../ui';
import { TranslateIcon, FireIcon, CycleIcon, TagIcon, SparklesIcon, CheckIcon } from '../Icons';
import { getBrasiliaDate, getLocalDateISOString } from '../../utils';

interface DailyChallengesProps {
    studentProgress: StudentProgress | null;
    onStartDailyChallenge: (challenge: DailyChallenge<any>, type: 'review' | 'glossary' | 'portuguese') => void;
    onGenerateAllChallenges: () => void;
    isGeneratingAll: boolean;
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
    
    let cardClasses = 'bg-gradient-to-br border transition-all duration-300 ';
    let iconColor = 'text-cyan-300';
    
    if (isEffectivelyCompleted) {
        cardClasses += 'bg-green-900/30 border-green-800/50';
        iconColor = 'text-green-400';
    } else {
        switch(type) {
            case 'review': cardClasses += 'from-rose-900 to-red-900 border-rose-700/50'; break;
            case 'glossary': cardClasses += 'from-indigo-900 to-blue-900 border-indigo-700/50'; break;
            case 'portuguese': cardClasses += 'from-teal-900 to-green-900 border-teal-700/50'; break;
        }
    }

    const renderButtonOrStatus = () => {
        if (isEffectivelyCompleted) {
            return <p className="text-sm mt-3 text-green-300 font-semibold">Concluído hoje!</p>;
        }
        if (challenge) {
             if (itemsCount > 0) {
                return <Button onClick={onStart} className="mt-3 text-sm py-2 px-3 w-full bg-black/20 hover:bg-black/40 border border-white/20">{hasStarted ? 'Continuar Desafio' : 'Começar Desafio'}</Button>;
            } else {
                return <p className="text-sm mt-3 text-gray-400">Nenhum item disponível hoje.</p>;
            }
        }
        return <p className="text-sm mt-3 text-gray-500">Aguardando geração...</p>;
    };

    return (
        <div className={`p-4 rounded-lg flex flex-col justify-between text-center ${cardClasses}`}>
            <div>
                <Icon className={`h-10 w-10 mx-auto mb-2 ${iconColor}`} />
                <h4 className="font-bold text-white">{title}</h4>
                <p className="text-xs text-gray-400 mt-1">{challenge ? `${itemsCount} itens` : 'Pronto para gerar'}</p>
            </div>
            {renderButtonOrStatus()}
        </div>
    );
};

const WeeklyProgressTracker: React.FC<{ completions: StudentProgress['dailyChallengeCompletions'] }> = ({ completions }) => {
    const today = getBrasiliaDate();
    const todayIndex = today.getUTCDay(); // Sunday = 0, Monday = 1, ...

    const weekDays = Array.from({ length: 7 }).map((_, i) => {
        const date = new Date(today);
        date.setUTCDate(today.getUTCDate() - (todayIndex - i));
        return {
            date,
            dayInitial: ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][i],
        };
    });

    return (
        <div className="flex justify-around items-center p-3 bg-gray-900/50 rounded-lg">
            {weekDays.map(({ date, dayInitial }, index) => {
                const dateISO = getLocalDateISOString(date);
                const dayCompletion = completions?.[dateISO];
                const isCompleted = dayCompletion?.review && dayCompletion?.glossary && dayCompletion?.portuguese;
                const isToday = index === todayIndex;

                return (
                    <div key={dateISO} className="flex flex-col items-center gap-2">
                        <span className={`text-xs font-bold ${isToday ? 'text-cyan-400' : 'text-gray-400'}`}>
                            {dayInitial}
                        </span>
                        <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all
                                ${isCompleted ? 'bg-green-500' : 'bg-gray-700'}
                                ${isToday ? 'ring-2 ring-cyan-400' : ''}`
                            }
                            title={isCompleted ? `Desafios concluídos em ${date.toLocaleDateString('pt-BR')}` : date.toLocaleDateString('pt-BR')}
                        >
                            {isCompleted && <CheckIcon className="w-5 h-5 text-white" />}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};


export const DailyChallenges: React.FC<DailyChallengesProps> = ({ studentProgress, onStartDailyChallenge, onGenerateAllChallenges, isGeneratingAll }) => {
    if (!studentProgress) return null;

    const { reviewChallenge, glossaryChallenge, portugueseChallenge, dailyChallengeStreak, dailyChallengeCompletions } = studentProgress;
    const streak = dailyChallengeStreak?.current || 0;

    const todayISO = getLocalDateISOString(getBrasiliaDate());
    const isGenerationNeeded = !reviewChallenge || reviewChallenge.date !== todayISO ||
                               !glossaryChallenge || glossaryChallenge.date !== todayISO ||
                               !portugueseChallenge || portugueseChallenge.date !== todayISO;
    const cardHighlightClass = isGenerationNeeded ? 'animate-pulse-border border-yellow-400/50' : '';

    return (
        <Card className={`p-6 transition-colors duration-500 ${cardHighlightClass}`}>
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-xl font-bold text-white">Desafios Diários</h3>
                    <p className="text-sm text-gray-400">Clique no botão para gerar ou refazer seus desafios do dia.</p>
                </div>
                {streak > 0 && (
                    <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1 bg-orange-500/20 border border-orange-500/50 rounded-full text-orange-300">
                        <FireIcon className="h-5 w-5" />
                        <span className="font-bold text-sm">{streak} dia(s) de ofensiva</span>
                    </div>
                )}
            </div>

            <WeeklyProgressTracker completions={dailyChallengeCompletions} />

            <div className="my-6 text-center border-t border-b border-gray-700/50 py-4">
                <Button onClick={onGenerateAllChallenges} disabled={isGeneratingAll}>
                    {isGeneratingAll ? <Spinner /> : <SparklesIcon className="h-5 w-5 mr-2" />}
                    {isGeneratingAll ? 'Gerando...' : 'Gerar / Refazer Desafios Diários'}
                </Button>
            </div>
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
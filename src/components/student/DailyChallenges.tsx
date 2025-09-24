import React from 'react';
import { StudentProgress, DailyChallenge } from '../../types';
import { Card, Button, Spinner } from '../ui';
import { TranslateIcon, FireIcon, CycleIcon, TagIcon } from '../Icons';

interface DailyChallengesProps {
    studentProgress: StudentProgress | null;
    onStartDailyChallenge: (challenge: DailyChallenge<any>, type: 'review' | 'glossary' | 'portuguese') => void;
    onGenerateChallenge: (type: 'review' | 'glossary' | 'portuguese') => void;
    isGenerating: {
        review: boolean;
        glossary: boolean;
        portuguese: boolean;
    };
}

const ChallengeCard: React.FC<{
    title: string;
    icon: React.FC<{className?: string}>;
    challenge: DailyChallenge<any> | undefined;
    onStart: () => void;
    onGenerate: () => void;
    isGenerating: boolean;
    type: 'review' | 'glossary' | 'portuguese';
    studentProgress: StudentProgress | null;
}> = ({ title, icon: Icon, challenge, onStart, onGenerate, isGenerating, type, studentProgress }) => {
    
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
            case 'review': cardClasses += 'from-rose-900 to-red-900 border-rose-700/50 hover:border-rose-400'; break;
            case 'glossary': cardClasses += 'from-indigo-900 to-blue-900 border-indigo-700/50 hover:border-indigo-400'; break;
            case 'portuguese': cardClasses += 'from-teal-900 to-green-900 border-teal-700/50 hover:border-teal-400'; break;
        }
    }

    const renderButton = () => {
        if (isGenerating) {
            return <Button disabled className="mt-3 text-sm py-2 px-3 w-full bg-black/20"><Spinner /> Gerando...</Button>;
        }
        if (isEffectivelyCompleted) {
            return <p className="text-sm mt-3 text-green-300 font-semibold">Concluído hoje!</p>;
        }
        if (challenge && itemsCount > 0) {
            return <Button onClick={onStart} className="mt-3 text-sm py-2 px-3 w-full bg-black/20 hover:bg-black/40 border border-white/20">{hasStarted ? 'Continuar Desafio' : 'Começar Desafio'}</Button>;
        }
        return <Button onClick={onGenerate} className="mt-3 text-sm py-2 px-3 w-full bg-black/20 hover:bg-black/40 border border-white/20">Gerar Desafio</Button>;
    };

    return (
        <div className={`p-4 rounded-lg flex flex-col justify-between text-center ${cardClasses}`}>
            <div>
                <Icon className={`h-10 w-10 mx-auto mb-2 ${iconColor}`} />
                <h4 className="font-bold text-white">{title}</h4>
                <p className="text-xs text-gray-400 mt-1">{challenge ? `${itemsCount} itens` : 'Pronto para gerar'}</p>
            </div>
            {renderButton()}
        </div>
    );
};


export const DailyChallenges: React.FC<DailyChallengesProps> = ({ studentProgress, onStartDailyChallenge, onGenerateChallenge, isGenerating }) => {
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
                    icon={CycleIcon}
                    challenge={reviewChallenge}
                    onStart={() => onStartDailyChallenge(reviewChallenge!, 'review')}
                    onGenerate={() => onGenerateChallenge('review')}
                    isGenerating={isGenerating.review}
                    type="review"
                    studentProgress={studentProgress}
                />
                <ChallengeCard 
                    title="Desafio do Glossário"
                    icon={TagIcon}
                    challenge={glossaryChallenge}
                    onStart={() => onStartDailyChallenge(glossaryChallenge!, 'glossary')}
                    onGenerate={() => onGenerateChallenge('glossary')}
                    isGenerating={isGenerating.glossary}
                    type="glossary"
                    studentProgress={studentProgress}
                />
                 <ChallengeCard 
                    title="Desafio de Português"
                    icon={TranslateIcon}
                    challenge={portugueseChallenge}
                    onStart={() => onStartDailyChallenge(portugueseChallenge!, 'portuguese')}
                    onGenerate={() => onGenerateChallenge('portuguese')}
                    isGenerating={isGenerating.portuguese}
                    type="portuguese"
                    studentProgress={studentProgress}
                />
            </div>
        </Card>
    );
};

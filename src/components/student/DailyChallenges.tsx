
import React from 'react';
import { StudentProgress } from '../../types';
import { Card, Button } from '../ui';
import { CheckBadgeIcon, ClipboardListIcon, TranslateIcon, FireIcon } from '../Icons';

interface DailyChallengesProps {
    studentProgress: StudentProgress | null;
    onStartDailyChallenge: (challengeType: 'review' | 'glossary' | 'portuguese') => void;
}

const ChallengeCard: React.FC<{
    title: string;
    icon: React.FC<{className?: string}>;
    challenge: StudentProgress['reviewChallenge']; // Using one type, structure is the same
    onStart: () => void;
    type: string;
}> = ({ title, icon: Icon, challenge, onStart, type }) => {
    const isCompleted = challenge?.isCompleted || false;
    const itemsCount = challenge?.items?.length || 0;
    
    return (
        <div className={`p-4 rounded-lg flex flex-col justify-between text-center transition-all ${isCompleted ? 'bg-green-900/30' : 'bg-gray-700/50'}`}>
            <div>
                <Icon className={`h-10 w-10 mx-auto mb-2 ${isCompleted ? 'text-green-400' : 'text-cyan-400'}`} />
                <h4 className="font-bold text-white">{title}</h4>
                <p className="text-xs text-gray-400 mt-1">{itemsCount} {type}</p>
            </div>
            {isCompleted ? (
                <div className="mt-3 flex items-center justify-center text-green-400">
                    <CheckBadgeIcon className="h-5 w-5 mr-2" />
                    <span className="text-sm font-semibold">Concluído!</span>
                </div>
            ) : (
                <Button onClick={onStart} disabled={itemsCount === 0} className="mt-3 text-sm py-2 px-3 w-full">
                    {itemsCount > 0 ? 'Começar' : 'N/A'}
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
                    type="questões"
                />
                <ChallengeCard 
                    title="Desafio do Glossário"
                    icon={TranslateIcon}
                    challenge={glossaryChallenge}
                    onStart={() => onStartDailyChallenge('glossary')}
                    type="termos"
                />
                 <ChallengeCard 
                    title="Desafio de Português"
                    icon={TranslateIcon} // Reusing icon for consistency
                    challenge={portugueseChallenge}
                    onStart={() => onStartDailyChallenge('portuguese')}
                    type="frases"
                />
            </div>
        </Card>
    );
};

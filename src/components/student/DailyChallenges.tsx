import React from 'react';
import { StudentProgress, DailyChallenge, Question } from '../../types';
import { Card, Button, Spinner } from '../ui';
import { CycleIcon, TagIcon, TranslateIcon, CheckCircleIcon, FireIcon } from '../Icons';
import { getLocalDateISOString, getBrasiliaDate } from '../../utils';

interface DailyChallengesProps {
    studentProgress: StudentProgress;
    onStartDailyChallenge: (challenge: DailyChallenge<Question>, type: 'review' | 'glossary' | 'portuguese', isCatchUp?: boolean) => void;
    onGenerateAllChallenges: () => void;
    isGeneratingAll: boolean;
}

const ChallengeCard: React.FC<{
    title: string;
    description: string;
    icon: React.FC<{ className?: string }>;
    challenge: DailyChallenge<Question> | undefined;
    challengeType: 'review' | 'glossary' | 'portuguese';
    onStart: (challenge: DailyChallenge<Question>, type: 'review' | 'glossary' | 'portuguese', isCatchUp?: boolean) => void;
}> = ({ title, description, icon: Icon, challenge, challengeType, onStart }) => {
    const todayISO = getLocalDateISOString(getBrasiliaDate());
    const isTodayChallenge = challenge?.date === todayISO;
    const isCatchUp = !!challenge?.uncompletedCount && challenge.uncompletedCount > 0 && !challenge.isCompleted;

    const buttonText = isCatchUp ? `Recuperar Desafio (${challenge.uncompletedCount})` : 'Iniciar Desafio';
    const buttonAction = () => onStart(challenge!, challengeType, isCatchUp);

    return (
        <Card className="p-6 flex flex-col items-center text-center">
            <Icon className="h-12 w-12 text-cyan-400 mb-3" />
            <h4 className="text-xl font-bold text-white">{title}</h4>
            <p className="text-gray-400 text-sm mt-2 flex-grow">{description}</p>
            <div className="mt-4 w-full">
                {isTodayChallenge ? (
                    challenge.isCompleted ? (
                        <div className="flex items-center justify-center text-green-400 font-semibold p-3 bg-green-900/50 rounded-lg">
                            <CheckCircleIcon className="h-6 w-6 mr-2" />
                            Concluído Hoje!
                        </div>
                    ) : (
                        <Button onClick={buttonAction} className="w-full">
                            {buttonText}
                        </Button>
                    )
                ) : (
                    <div className="p-3 bg-gray-700/50 rounded-lg text-gray-400 text-sm">
                        Volte amanhã para um novo desafio!
                    </div>
                )}
            </div>
        </Card>
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

    if (needsGeneration) {
        return (
            <Card className="p-6 text-center">
                <h3 className="text-2xl font-bold text-white mb-2">Desafios Diários</h3>
                <p className="text-gray-400 mb-6">Complete os desafios todos os dias para ganhar XP bônus e manter sua ofensiva!</p>
                <Button onClick={onGenerateAllChallenges} disabled={isGeneratingAll}>
                    {isGeneratingAll ? <Spinner /> : 'Gerar Desafios de Hoje'}
                </Button>
            </Card>
        );
    }
    
    return (
        <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold text-white">Desafios Diários</h3>
                {streak > 0 && (
                     <div className="flex items-center gap-2 px-3 py-1 bg-orange-500/20 border border-orange-500 rounded-full">
                        <FireIcon className="h-5 w-5 text-orange-400" />
                        <span className="font-bold text-white">{streak}</span>
                        <span className="text-sm text-gray-300">{streak === 1 ? 'dia' : 'dias'}</span>
                    </div>
                )}
            </div>
            <p className="text-gray-400 mb-6">Complete os desafios para ganhar XP e manter sua ofensiva.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <ChallengeCard
                    title="Desafio da Revisão"
                    description="Teste seus conhecimentos com questões de tópicos que precisam de atenção."
                    icon={CycleIcon}
                    challenge={studentProgress.reviewChallenge}
                    challengeType="review"
                    onStart={onStartDailyChallenge}
                />
                 <ChallengeCard
                    title="Desafio do Glossário"
                    description="Acerte as definições dos termos mais importantes dos seus estudos."
                    icon={TagIcon}
                    challenge={studentProgress.glossaryChallenge}
                    challengeType="glossary"
                    onStart={onStartDailyChallenge}
                />
                 <ChallengeCard
                    title="Desafio de Português"
                    description="Encontre o erro gramatical e afie suas habilidades na língua portuguesa."
                    icon={TranslateIcon}
                    challenge={studentProgress.portugueseChallenge}
                    challengeType="portuguese"
                    onStart={onStartDailyChallenge}
                />
            </div>
        </Card>
    );
};

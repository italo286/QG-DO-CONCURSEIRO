import React from 'react';
import { Question, QuestionAttempt } from '../../../types';
import { Card, Button } from '../../ui';
import { TrophyIcon, XCircleIcon } from '../../Icons';

interface DailyChallengeResultsViewProps {
    challengeData: {
        questions: Question[];
        sessionAttempts: QuestionAttempt[];
    };
    onBack: () => void;
}

export const DailyChallengeResultsView: React.FC<DailyChallengeResultsViewProps> = ({ challengeData, onBack }) => {
    const { questions, sessionAttempts } = challengeData;

    const correctCount = sessionAttempts.filter(a => a.isCorrect).length;
    const totalCount = questions.length;
    const score = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;
    const passed = score >= 60;

    return (
        <Card className="p-8 max-w-2xl mx-auto text-center animate-fade-in">
            <h2 className="text-3xl font-bold text-white mb-4">Desafio Diário Finalizado!</h2>
            
            <div className="my-6">
                {passed ? (
                    <TrophyIcon className="h-24 w-24 text-yellow-400 mx-auto" />
                ) : (
                    <XCircleIcon className="h-24 w-24 text-red-400 mx-auto" />
                )}
            </div>

            <p className="text-5xl font-bold text-cyan-400 my-4">{score.toFixed(0)}%</p>
            <p className="text-xl text-gray-300">
                Você acertou <span className="font-bold text-green-400">{correctCount}</span> de <span className="font-bold">{totalCount}</span> questões.
            </p>

            <p className="text-lg text-gray-400 mt-6">
                {passed ? "Excelente desempenho! Continue assim." : "Não desanime! A prática leva à perfeição."}
            </p>

            <Button onClick={onBack} className="mt-8">
                Voltar ao Painel
            </Button>
        </Card>
    );
};

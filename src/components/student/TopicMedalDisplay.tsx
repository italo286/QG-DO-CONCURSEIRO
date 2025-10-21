import React from 'react';
import { StudentProgress, Topic, SubTopic } from '../../types';
import { TOPIC_BADGES } from '../../gamification';
import { Card } from '../ui';
import { GameControllerIcon } from '../Icons';

interface TopicMedalDisplayProps {
    studentProgress: StudentProgress;
    content: Topic | SubTopic;
}

export const TopicMedalDisplay: React.FC<TopicMedalDisplayProps> = ({ studentProgress, content }) => {
    const topicId = content.id;
    const earnedBadgesForTopic = studentProgress.earnedTopicBadgeIds?.[topicId] || [];
    const earnedBadgesForTecQuiz = studentProgress.earnedTopicBadgeIds?.[`${topicId}-tec`] || [];
    const hasTecQuestions = (content.tecQuestions?.length || 0) > 0;
    const earnedGameBadgeIds = studentProgress.earnedGameBadgeIds?.[topicId] || [];
    const hasGames = (content.miniGames?.length || 0) > 0;

    const MedalSet: React.FC<{title: string, earnedBadges: string[]}> = ({ title, earnedBadges }) => (
        <div className="p-4 bg-gray-900/50 rounded-lg">
            <h4 className="font-bold text-lg text-white mb-4">{title}</h4>
            <div className="flex justify-around items-center">
                {Object.entries(TOPIC_BADGES).map(([id, badgeInfo]) => {
                    const isEarned = earnedBadges.includes(id);
                    const { name, description, icon: Icon } = badgeInfo;
                    
                    const colorClass = 
                        id === 'gold' ? 'text-yellow-400' :
                        id === 'silver' ? 'text-gray-400' :
                        'text-orange-400';

                    return (
                        <div key={id} title={description} className={`flex flex-col items-center text-center transition-all duration-300 ${isEarned ? '' : 'opacity-40'}`}>
                            <Icon className={`h-20 w-20 mb-2 ${isEarned ? colorClass : 'text-gray-600 filter grayscale'}`} />
                            <p className={`font-bold ${isEarned ? 'text-white' : 'text-gray-400'}`}>{name}</p>
                            <p className="text-xs text-gray-500">{description}</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );


    return (
        <div className="p-4 space-y-6">
            <h3 className="text-2xl font-bold text-center">Quadro de Medalhas de {content.name}</h3>
            
            <MedalSet title="Questões de Conteúdo" earnedBadges={earnedBadgesForTopic} />

            {hasTecQuestions && (
                <MedalSet title="Questões Extraídas (TEC)" earnedBadges={earnedBadgesForTecQuiz} />
            )}
            
            {hasGames && (
                <Card className="p-4 bg-gray-900/50 rounded-lg">
                    <h4 className="font-bold text-lg text-white mb-4">Medalhas de Jogos</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {content.miniGames.map(game => {
                            const isEarned = earnedGameBadgeIds.includes(game.id);
                            return (
                                <div key={game.id} title={game.name} className={`p-3 rounded-lg border flex flex-col items-center text-center transition-all duration-300 ${isEarned ? 'bg-gray-700/50 border-cyan-500/30' : 'bg-gray-800 border-gray-700'}`}>
                                    <GameControllerIcon className={`h-12 w-12 mb-2 ${isEarned ? 'text-yellow-400' : 'text-gray-500 filter grayscale'}`} />
                                    <p className={`font-bold text-xs ${isEarned ? 'text-white' : 'text-gray-400'}`}>{game.name}</p>
                                </div>
                            )
                        })}
                    </div>
                </Card>
           )}
        </div>
    );
};

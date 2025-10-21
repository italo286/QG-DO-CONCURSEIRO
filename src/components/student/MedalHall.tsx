
import React from 'react';
import { StudentProgress, Subject } from '../../types';
import { ALL_BADGES } from '../../gamification';
import { Card } from '../ui';

export const MedalHall: React.FC<{
    studentProgress: StudentProgress;
    subjects: Subject[];
}> = ({ studentProgress, subjects }) => {

    const getBadgeDetails = (badgeId: string, badgeInfo: typeof ALL_BADGES[string]) => {
        // For badges with dynamic names, re-evaluate their condition to get the specific name/description
        if (badgeId === 'mastery' || badgeId === 'subject-completer') {
             const result = badgeInfo.condition(studentProgress, subjects);
             if (typeof result === 'object') {
                 return { ...badgeInfo, name: result.name, description: result.description };
             }
        }
        return badgeInfo;
    };

    return (
        <Card className="p-6">
            <h3 className="text-xl font-bold text-white mb-4">Galeria de Medalhas</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Object.entries(ALL_BADGES).map(([id, badgeInfo]) => {
                    const isEarned = studentProgress.earnedBadgeIds.includes(id);
                    const details = isEarned ? getBadgeDetails(id, badgeInfo) : badgeInfo;
                    const { name, description, icon: Icon } = details;

                    return (
                        <div key={id} title={description} className={`p-4 rounded-lg border flex flex-col items-center text-center transition-all duration-300 ${isEarned ? 'bg-gray-700/50 border-cyan-500/30' : 'bg-gray-800 border-gray-700'}`}>
                            <Icon className={`h-16 w-16 mb-3 ${isEarned ? 'text-yellow-400' : 'text-gray-500 filter grayscale'}`} />
                            <p className={`font-bold text-sm ${isEarned ? 'text-white' : 'text-gray-400'}`}>{name}</p>
                            {!isEarned && (
                                <p className="text-xs text-gray-500 mt-1">{description}</p>
                            )}
                        </div>
                    );
                })}
            </div>
        </Card>
    );
};

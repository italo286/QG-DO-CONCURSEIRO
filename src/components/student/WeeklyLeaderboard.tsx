import React, { useMemo } from 'react';
import { User, StudentProgress } from '../../types';
import { Card } from '../ui';
import { TrophyIcon, UserCircleIcon } from '../Icons';

export const WeeklyLeaderboard: React.FC<{
    allStudents: User[];
    allProgress: { [studentId: string]: StudentProgress };
    currentUserId: string;
    courseStudentIds?: string[];
    courseName?: string;
}> = ({ allStudents, allProgress, currentUserId, courseStudentIds, courseName }) => {

    const leaderboardData = useMemo(() => {
        if (!allStudents.length || !Object.keys(allProgress).length) {
            return [];
        }

        const studentsInLeaderboard = courseStudentIds
            ? allStudents.filter(student => courseStudentIds.includes(student.id))
            : allStudents;

        return studentsInLeaderboard
            .map(student => {
                const progress = allProgress[student.id];
                return {
                    id: student.id,
                    name: student.name || student.username,
                    avatarUrl: student.avatarUrl,
                    xp: progress?.xp || 0,
                };
            })
            .sort((a, b) => b.xp - a.xp);

    }, [allStudents, allProgress, courseStudentIds]);

    const currentUserRank = useMemo(() => {
        return leaderboardData.findIndex(s => s.id === currentUserId) + 1;
    }, [leaderboardData, currentUserId]);

    const currentUserData = leaderboardData.find(s => s.id === currentUserId);

    const getMedalColor = (rank: number) => {
        if (rank === 1) return 'text-yellow-400';
        if (rank === 2) return 'text-gray-400';
        if (rank === 3) return 'text-orange-400';
        return 'text-gray-600';
    };

    return (
        <Card className="p-6">
            <h3 className="text-xl font-bold text-white mb-2 flex items-center">
                <TrophyIcon className="h-6 w-6 mr-3 text-cyan-400"/>
                {courseName ? `Pódio do Curso` : 'Pódio Geral'}
            </h3>
             {courseName && <p className="text-sm text-gray-400 mb-4">{courseName}</p>}

            <ul className="space-y-3">
                {leaderboardData.slice(0, 5).map((student, index) => (
                    <li key={student.id} className={`p-3 rounded-lg flex items-center justify-between transition-colors ${student.id === currentUserId ? 'bg-cyan-900/50 border border-cyan-700' : 'bg-gray-700/50'}`}>
                        <div className="flex items-center space-x-3">
                            <span className={`font-bold w-6 text-center ${index < 3 ? getMedalColor(index + 1) : 'text-gray-500'}`}>
                                {index < 3 ? <TrophyIcon className="h-6 w-6" /> : `${index + 1}.`}
                            </span>
                            {student.avatarUrl ? (
                                <img src={student.avatarUrl} alt={student.name} className="h-10 w-10 rounded-full object-cover"/>
                            ) : (
                                <UserCircleIcon className="h-10 w-10 text-gray-500" />
                            )}
                            <span className="font-semibold text-gray-200">{student.name}</span>
                        </div>
                        <span className="font-bold text-yellow-400">{student.xp} XP</span>
                    </li>
                ))}
            </ul>
             {currentUserRank > 5 && currentUserData && (
                <>
                    <div className="text-center my-2 text-gray-500">...</div>
                     <div className="p-3 rounded-lg flex items-center justify-between bg-cyan-900/50 border border-cyan-700">
                         <div className="flex items-center space-x-3">
                             <span className="font-bold w-6 text-center text-gray-500">{currentUserRank}.</span>
                             {currentUserData.avatarUrl ? (
                                <img src={currentUserData.avatarUrl} alt={currentUserData.name} className="h-10 w-10 rounded-full object-cover"/>
                             ) : (
                                <UserCircleIcon className="h-10 w-10 text-gray-500" />
                             )}
                             <span className="font-semibold text-gray-200">{currentUserData.name}</span>
                         </div>
                        <span className="font-bold text-yellow-400">{currentUserData.xp} XP</span>
                     </div>
                 </>
             )}
        </Card>
    );
};
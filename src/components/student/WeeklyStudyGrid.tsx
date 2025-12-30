
import React from 'react';
import { TrashIcon } from '../Icons';

interface WeeklyStudyGridProps {
    weeklyRoutine: { [day: number]: { [time: string]: string } };
    onUpdateRoutine: (day: number, time: string, topicId: string | null) => void;
    selectedTopicId: string | null;
    getTopicName: (id: string) => string;
    getTopicColor: (id: string) => string | undefined;
}

const DAYS = [
    { id: 0, label: 'Dom' },
    { id: 1, label: 'Seg' },
    { id: 2, label: 'Ter' },
    { id: 3, label: 'Qua' },
    { id: 4, label: 'Qui' },
    { id: 5, label: 'Sex' },
    { id: 6, label: 'Sáb' },
];

const HOURS = Array.from({ length: 19 }).map((_, i) => {
    const h = i + 5; // Start at 05:00
    return `${h.toString().padStart(2, '0')}:00`;
});

export const WeeklyStudyGrid: React.FC<WeeklyStudyGridProps> = ({
    weeklyRoutine,
    onUpdateRoutine,
    selectedTopicId,
    getTopicName,
    getTopicColor,
}) => {
    const handleCellClick = (dayId: number, time: string) => {
        if (selectedTopicId) {
            onUpdateRoutine(dayId, time, selectedTopicId);
        }
    };

    const handleClearCell = (e: React.MouseEvent, dayId: number, time: string) => {
        e.stopPropagation();
        onUpdateRoutine(dayId, time, null);
    };

    return (
        <div className="overflow-x-auto rounded-lg border border-gray-700 bg-gray-900/50">
            <table className="w-full text-xs md:text-sm border-collapse min-w-[600px]">
                <thead>
                    <tr className="bg-gray-800">
                        <th className="p-2 border-r border-b border-gray-700 w-16">Hora</th>
                        {DAYS.map((day) => (
                            <th key={day.id} className="p-2 border-b border-gray-700">
                                {day.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {HOURS.map((time) => (
                        <tr key={time}>
                            <td className="p-1 text-center font-mono text-gray-500 border-r border-gray-700 bg-gray-800/30">
                                {time}
                            </td>
                            {DAYS.map((day) => {
                                const topicId = weeklyRoutine[day.id]?.[time];
                                const topicColor = topicId ? getTopicColor(topicId) : null;
                                
                                return (
                                    <td
                                        key={day.id}
                                        onClick={() => handleCellClick(day.id, time)}
                                        className={`p-1 border border-gray-700 h-16 min-w-[80px] relative group transition-colors hover:bg-gray-700/30 cursor-pointer`}
                                    >
                                        {topicId ? (
                                            <div 
                                                className="w-full h-full rounded p-1 flex flex-col justify-between overflow-hidden"
                                                style={{ backgroundColor: topicColor ? `${topicColor}44` : '#0ea5e944', borderLeft: `3px solid ${topicColor || '#0ea5e9'}` }}
                                            >
                                                <span className="text-[10px] md:text-xs font-medium text-white line-clamp-2">
                                                    {getTopicName(topicId)}
                                                </span>
                                                <button
                                                    onClick={(e) => handleClearCell(e, day.id, time)}
                                                    className="absolute top-0 right-0 p-0.5 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300"
                                                    title="Remover"
                                                >
                                                    <TrashIcon className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ) : (
                                            selectedTopicId && (
                                                <div className="w-full h-full opacity-0 group-hover:opacity-20 bg-cyan-400 rounded"></div>
                                            )
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

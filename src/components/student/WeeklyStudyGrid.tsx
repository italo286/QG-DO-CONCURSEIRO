
import React from 'react';
import { TrashIcon, PlusIcon } from '../Icons';

interface WeeklyStudyGridProps {
    weeklyRoutine: { [day: number]: { [time: string]: string } };
    onUpdateRoutine: (day: number, time: string, topicId: string | null) => void;
    onRenameTime: (oldTime: string, newTime: string) => void;
    onRemoveTime: (time: string) => void;
    onAddTime: () => void;
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

export const WeeklyStudyGrid: React.FC<WeeklyStudyGridProps> = ({
    weeklyRoutine,
    onUpdateRoutine,
    onRenameTime,
    onRemoveTime,
    onAddTime,
    selectedTopicId,
    getTopicName,
    getTopicColor,
}) => {
    // Coletar todos os horários únicos definidos em todos os dias
    const allTimes = React.useMemo(() => {
        const timesSet = new Set<string>();
        // Garantir que existam horários padrão se a rotina estiver vazia
        const defaultHours = Array.from({ length: 14 }).map((_, i) => `${(i + 7).toString().padStart(2, '0')}:00`);
        
        defaultHours.forEach(t => timesSet.add(t));
        
        Object.values(weeklyRoutine).forEach(dayRoutine => {
            Object.keys(dayRoutine).forEach(time => timesSet.add(time));
        });
        
        return Array.from(timesSet).sort();
    }, [weeklyRoutine]);

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
            <table className="w-full text-xs md:text-sm border-collapse min-w-[700px]">
                <thead>
                    <tr className="bg-gray-800">
                        <th className="p-2 border-r border-b border-gray-700 w-24">Hora</th>
                        {DAYS.map((day) => (
                            <th key={day.id} className="p-2 border-b border-gray-700">
                                {day.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {allTimes.map((time) => (
                        <tr key={time} className="group/row">
                            <td className="p-1 text-center font-mono border-r border-gray-700 bg-gray-800/30 relative">
                                <div className="flex items-center justify-between gap-1 px-1">
                                    <input 
                                        type="time" 
                                        defaultValue={time}
                                        onBlur={(e) => {
                                            if (e.target.value && e.target.value !== time) {
                                                onRenameTime(time, e.target.value);
                                            }
                                        }}
                                        className="bg-transparent border-none focus:ring-0 text-white w-full text-xs md:text-sm p-0 text-center"
                                    />
                                    <button 
                                        onClick={() => onRemoveTime(time)}
                                        className="opacity-0 group-hover/row:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
                                        title="Remover linha"
                                    >
                                        <TrashIcon className="h-3 w-3" />
                                    </button>
                                </div>
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
                                                <span className="text-[10px] md:text-xs font-medium text-white line-clamp-2 leading-tight">
                                                    {getTopicName(topicId)}
                                                </span>
                                                <button
                                                    onClick={(e) => handleClearCell(e, day.id, time)}
                                                    className="absolute top-0 right-0 p-0.5 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300"
                                                    title="Remover tópico"
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
                    <tr className="bg-gray-800/30">
                        <td className="p-2 border-r border-gray-700">
                            <button 
                                onClick={onAddTime}
                                className="w-full flex items-center justify-center gap-1 text-cyan-400 hover:text-cyan-300 py-1"
                                title="Adicionar novo horário"
                            >
                                <PlusIcon className="h-4 w-4" />
                                <span className="text-[10px] uppercase font-bold">Novo</span>
                            </button>
                        </td>
                        {DAYS.map(day => <td key={day.id} className="p-2 border-gray-700"></td>)}
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

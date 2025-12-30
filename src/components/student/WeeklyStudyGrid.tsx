
import React from 'react';
import { TrashIcon, PlusIcon, PencilIcon, BookOpenIcon, StarIcon } from '../Icons';

interface WeeklyStudyGridProps {
    weeklyRoutine: { [day: number]: { [time: string]: string } };
    onUpdateRoutine: (day: number, time: string, content: string | null) => void;
    onRenameTime: (oldTime: string, newTime: string) => void;
    onRemoveTime: (time: string) => void;
    onAddTime: () => void;
    onOpenPicker: (day: number, time: string) => void;
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
    onOpenPicker,
    selectedTopicId,
    getTopicName,
    getTopicColor,
}) => {
    const allTimes = React.useMemo(() => {
        const timesSet = new Set<string>();
        const defaultHours = Array.from({ length: 14 }).map((_, i) => `${(i + 7).toString().padStart(2, '0')}:00`);
        defaultHours.forEach(t => timesSet.add(t));
        Object.values(weeklyRoutine).forEach(dayRoutine => {
            Object.keys(dayRoutine).forEach(time => timesSet.add(time));
        });
        return Array.from(timesSet).sort();
    }, [weeklyRoutine]);

    const handleCellAction = (dayId: number, time: string) => {
        if (selectedTopicId) {
            onUpdateRoutine(dayId, time, selectedTopicId);
        }
    };

    const handleTextChange = (dayId: number, time: string, text: string) => {
        onUpdateRoutine(dayId, time, text || null);
    };

    return (
        <div className="space-y-3">
            {/* Banner de Dicas Minimalista */}
            <div className="bg-cyan-500/10 border-l-4 border-cyan-500 px-3 py-1.5 flex items-center justify-between text-[10px] text-cyan-200">
                <div className="flex items-center gap-2">
                    <BookOpenIcon className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Dica: Clique no ícone de livro nas células vazias para adicionar tópicos do curso.</span>
                </div>
                <span className="opacity-40 uppercase font-bold hidden sm:inline">Cronograma Inteligente</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-950/40">
                <table className="w-full text-xs border-collapse min-w-[800px]">
                    <thead>
                        <tr className="bg-gray-900/80">
                            <th className="p-2 border-r border-b border-gray-800 w-24 text-gray-500 font-mono text-[9px] uppercase tracking-widest">HORA</th>
                            {DAYS.map((day) => (
                                <th key={day.id} className="p-2 border-b border-gray-800 text-gray-300 font-bold uppercase tracking-widest text-[10px]">
                                    {day.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {allTimes.map((time) => (
                            <tr key={time} className="group/row border-b border-gray-800/50 last:border-0">
                                <td className="p-1 text-center font-mono border-r border-gray-800 bg-gray-900/20 relative">
                                    <div className="flex items-center justify-between gap-1 px-1">
                                        <input 
                                            type="time" 
                                            defaultValue={time}
                                            onBlur={(e) => {
                                                if (e.target.value && e.target.value !== time) {
                                                    onRenameTime(time, e.target.value);
                                                }
                                            }}
                                            className="bg-transparent border-none focus:ring-0 text-white w-full text-[11px] p-0 text-center font-bold opacity-60 group-hover/row:opacity-100 transition-opacity"
                                        />
                                        <button 
                                            onClick={() => onRemoveTime(time)}
                                            className="opacity-0 group-hover/row:opacity-100 text-red-500 hover:text-red-400 transition-opacity"
                                            title="Remover linha"
                                        >
                                            <TrashIcon className="h-3 w-3" />
                                        </button>
                                    </div>
                                </td>
                                {DAYS.map((day) => {
                                    const content = weeklyRoutine[day.id]?.[time] || '';
                                    const isTopicId = content.startsWith('t') || content.startsWith('st');
                                    const topicName = isTopicId ? getTopicName(content) : null;
                                    const topicColor = isTopicId ? getTopicColor(content) : null;
                                    
                                    return (
                                        <td
                                            key={day.id}
                                            onClick={() => handleCellAction(day.id, time)}
                                            className="p-1 border-r border-gray-800/50 last:border-0 h-16 min-w-[110px] relative group transition-colors hover:bg-gray-800/20"
                                        >
                                            {isTopicId ? (
                                                <div 
                                                    className="w-full h-full rounded-md p-1.5 flex flex-col justify-between overflow-hidden shadow-inner animate-fade-in relative"
                                                    style={{ backgroundColor: topicColor ? `${topicColor}10` : '#0ea5e910', borderLeft: `3px solid ${topicColor || '#0ea5e9'}` }}
                                                >
                                                    <div className="flex items-center justify-between gap-1 mb-0.5">
                                                        <span className="text-[7px] uppercase font-black text-white/20 tracking-tighter">ESTUDO</span>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onUpdateRoutine(day.id, time, null); }}
                                                            className="p-0.5 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition-opacity"
                                                            title="Remover"
                                                        >
                                                            <TrashIcon className="h-2.5 w-2.5" />
                                                        </button>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-gray-100 line-clamp-2 leading-tight">
                                                        {topicName || 'Tópico Removido'}
                                                    </span>
                                                    <div className="flex justify-end opacity-5">
                                                        <StarIcon className="w-2 h-2 text-white" />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="w-full h-full relative">
                                                    <textarea
                                                        value={content}
                                                        onChange={(e) => handleTextChange(day.id, time, e.target.value)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        placeholder="..."
                                                        className="w-full h-full bg-transparent border-none focus:ring-1 focus:ring-cyan-500/10 text-[10px] text-gray-400 placeholder-gray-800 resize-none p-1 font-medium leading-tight custom-scrollbar"
                                                    />
                                                    
                                                    {!content && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onOpenPicker(day.id, time); }}
                                                            className="absolute bottom-1 right-1 p-1 rounded bg-gray-800 text-cyan-400 opacity-0 group-hover:opacity-100 hover:bg-cyan-600 hover:text-white transition-all shadow-md border border-gray-700"
                                                            title="Buscar Conteúdo"
                                                        >
                                                            <BookOpenIcon className="w-2.5 h-2.5" />
                                                        </button>
                                                    )}

                                                    {content && (
                                                         <div className="absolute bottom-1 right-1 opacity-5 pointer-events-none">
                                                            <PencilIcon className="w-2 h-2 text-white" />
                                                         </div>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                        <tr className="bg-gray-900/20">
                            <td className="p-1 border-r border-gray-800">
                                <button 
                                    onClick={onAddTime}
                                    className="w-full flex items-center justify-center gap-1 text-cyan-500/40 hover:text-cyan-400 py-1.5 transition-all"
                                    title="Adicionar Horário"
                                >
                                    <PlusIcon className="h-3.5 w-3.5" />
                                </button>
                            </td>
                            {DAYS.map(day => <td key={day.id} className="p-1 border-r border-gray-800/30 last:border-0"></td>)}
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

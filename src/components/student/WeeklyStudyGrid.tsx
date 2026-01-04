
import React, { useState } from 'react';
import { TrashIcon, PlusIcon, PencilIcon, BookOpenIcon, CalendarIcon, XCircleIcon } from '../Icons';

interface WeeklyStudyGridProps {
    weeklyRoutine: { [day: number]: { [time: string]: string } };
    onUpdateRoutine: (day: number, time: string, content: string | null) => void;
    onRenameTime: (oldTime: string, newTime: string) => void;
    onRemoveTime: (time: string) => void;
    onAddTime: () => void;
    onOpenPicker: (day: number, time: string) => void;
    selectedTopicId: string | null;
    getTopicName: (id: string) => string;
    readOnly?: boolean;
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
    getTopicName,
    readOnly = false
}) => {
    const [activeSelectionCell, setActiveSelectionCell] = useState<{ day: number, time: string } | null>(null);
    const [manualEditCell, setManualEditCell] = useState<{ day: number, time: string } | null>(null);

    const allTimes = React.useMemo(() => {
        const timesSet = new Set<string>();
        Object.values(weeklyRoutine).forEach(dayRoutine => {
            Object.keys(dayRoutine).forEach(time => timesSet.add(time));
        });
        return Array.from(timesSet).sort();
    }, [weeklyRoutine]);

    const handleCellClick = (dayId: number, time: string, hasContent: boolean) => {
        if (readOnly) return;
        if (!hasContent) {
            setActiveSelectionCell({ day: dayId, time });
        } else {
            const content = weeklyRoutine[dayId]?.[time] || '';
            if (content.startsWith('t') || content.startsWith('st')) {
                setActiveSelectionCell({ day: dayId, time });
            } else {
                setManualEditCell({ day: dayId, time });
            }
        }
    };

    const handleTextChange = (dayId: number, time: string, text: string) => {
        onUpdateRoutine(dayId, time, text || "");
    };

    return (
        <div className="space-y-3">
            {!readOnly && (
                <div className="bg-cyan-500/10 border-l-4 border-cyan-500 px-3 py-1.5 flex items-center justify-between text-[10px] text-cyan-200">
                    <div className="flex items-center gap-2">
                        <BookOpenIcon className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Dica: Clique em uma célula para escolher entre digitar ou selecionar conteúdo do curso.</span>
                    </div>
                    <span className="opacity-40 uppercase font-bold hidden sm:inline">Editor Ativo</span>
                </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-950/40">
                <table className="w-full text-xs border-collapse min-w-[800px]">
                    <thead>
                        <tr className="bg-gray-900/80">
                            <th className="p-2 border-r border-b border-gray-800 w-24 text-gray-500 font-mono text-[9px] uppercase tracking-widest text-center">HORA</th>
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
                                            disabled={readOnly}
                                            onBlur={(e) => {
                                                if (!readOnly && e.target.value && e.target.value !== time) {
                                                    onRenameTime(time, e.target.value);
                                                }
                                            }}
                                            className={`bg-transparent border-none focus:ring-0 text-white w-full text-[11px] p-0 text-center font-bold transition-opacity ${readOnly ? 'opacity-100' : 'opacity-60 group-hover/row:opacity-100'}`}
                                        />
                                        {!readOnly && (
                                            <button 
                                                onClick={() => onRemoveTime(time)}
                                                className="opacity-0 group-hover/row:opacity-100 text-red-500 hover:text-red-400 transition-opacity"
                                                title="Remover linha"
                                            >
                                                <TrashIcon className="h-3 w-3" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                                {DAYS.map((day) => {
                                    const content = weeklyRoutine[day.id]?.[time] || '';
                                    const isTopicId = content.startsWith('t') || content.startsWith('st');
                                    const topicName = isTopicId ? getTopicName(content) : null;
                                    const isSelected = activeSelectionCell?.day === day.id && activeSelectionCell?.time === time;
                                    const isEditingManual = manualEditCell?.day === day.id && manualEditCell?.time === time;
                                    
                                    return (
                                        <td
                                            key={day.id}
                                            onClick={() => !isEditingManual && handleCellClick(day.id, time, !!content)}
                                            className={`p-1 border-r border-gray-800/50 last:border-0 h-20 min-w-[110px] relative group transition-colors ${readOnly ? '' : 'hover:bg-gray-800/20 cursor-pointer'}`}
                                        >
                                            {isSelected && !readOnly && (
                                                <div className="absolute inset-0 z-10 bg-gray-900/95 flex flex-col items-center justify-center gap-2 p-1 animate-fade-in shadow-2xl">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setManualEditCell({ day: day.id, time }); setActiveSelectionCell(null); }}
                                                        className="w-full py-1 text-[9px] font-bold bg-gray-700 hover:bg-cyan-600 text-white rounded flex items-center justify-center gap-1"
                                                    >
                                                        <PencilIcon className="h-2.5 w-2.5" /> DIGITAR
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); onOpenPicker(day.id, time); setActiveSelectionCell(null); }}
                                                        className="w-full py-1 text-[9px] font-bold bg-cyan-600 hover:bg-cyan-500 text-white rounded flex items-center justify-center gap-1"
                                                    >
                                                        <BookOpenIcon className="h-2.5 w-2.5" /> CONTEÚDO
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setActiveSelectionCell(null); }}
                                                        className="absolute -top-1 -right-1 text-gray-500 hover:text-white"
                                                    >
                                                        <XCircleIcon className="h-3.5 w-3.5 fill-gray-900" />
                                                    </button>
                                                </div>
                                            )}

                                            {isTopicId ? (
                                                <div 
                                                    className="w-full h-full rounded-md p-2 flex flex-col justify-between overflow-hidden shadow-inner animate-fade-in relative group/topic bg-cyan-900/10 border-l-2 border-cyan-500"
                                                >
                                                    <div className="flex items-center justify-between gap-1 mb-0.5">
                                                        <span className="text-[7px] uppercase font-black text-white/40 tracking-tighter">AULA</span>
                                                        {!readOnly && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); onUpdateRoutine(day.id, time, null); }}
                                                                className="p-0.5 opacity-0 group-hover/topic:opacity-100 text-red-500 hover:text-red-400 transition-opacity"
                                                            >
                                                                <TrashIcon className="h-2.5 w-2.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] font-bold text-gray-100 line-clamp-3 leading-tight">
                                                        {topicName || 'Tópico Removido'}
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="w-full h-full relative">
                                                    {(isEditingManual && !readOnly) ? (
                                                        <div className="absolute inset-0 z-10 flex flex-col">
                                                            <textarea
                                                                autoFocus
                                                                value={content}
                                                                onChange={(e) => handleTextChange(day.id, time, e.target.value)}
                                                                onBlur={() => setManualEditCell(null)}
                                                                className="w-full flex-grow bg-white text-gray-900 text-[10px] p-1 rounded font-medium resize-none border-2 border-cyan-500 focus:ring-0"
                                                                placeholder="Digite aqui..."
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="w-full h-full overflow-hidden">
                                                            <p className={`w-full h-full p-1 text-[10px] italic font-medium leading-tight whitespace-pre-wrap break-words ${content ? 'text-gray-300' : 'text-gray-600'}`}>
                                                                {content || (readOnly ? '' : '...')}
                                                            </p>
                                                            {content && !readOnly && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); onUpdateRoutine(day.id, time, null); }}
                                                                    className="absolute top-0 right-0 p-0.5 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition-opacity"
                                                                >
                                                                    <TrashIcon className="h-2.5 w-2.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                        
                        {!readOnly && (
                            <tr className="bg-gray-900/20">
                                <td className="p-1 border-r border-gray-800">
                                    <button 
                                        onClick={onAddTime}
                                        className="w-full flex items-center justify-center gap-1 text-cyan-500/40 hover:text-cyan-400 py-1.5 transition-all"
                                        title="Adicionar Horário"
                                    >
                                        <PlusIcon className="h-4 w-4" />
                                    </button>
                                </td>
                                {DAYS.map(day => <td key={day.id} className="p-1 border-r border-gray-800/30 last:border-0"></td>)}
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {allTimes.length === 0 && (
                <div className="text-center py-12 text-gray-500 border border-dashed border-gray-700 rounded-xl mt-4">
                    <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">Seu cronograma está vazio.</p>
                    {!readOnly && (
                        <button onClick={onAddTime} className="text-cyan-400 text-xs font-bold mt-2 hover:underline">
                            Adicionar meu primeiro horário
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

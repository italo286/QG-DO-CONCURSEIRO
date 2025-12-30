
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
        <div className="space-y-4">
            <div className="bg-blue-900/30 border border-blue-500/30 p-4 rounded-lg flex items-start gap-3">
                <div className="bg-blue-500 p-1 rounded-full mt-0.5">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <p className="text-xs text-blue-100 leading-relaxed">
                    <span className="font-bold">Como Adicionar Matérias:</span> 
                    1. Selecione um tópico na barra lateral e clique na célula. 
                    2. Ou clique no ícone <BookOpenIcon className="inline-block w-3 h-3 mx-0.5 text-cyan-400" /> dentro de uma célula vazia para buscar por nome.
                    3. Você também pode digitar anotações livres diretamente nas células.
                </p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-700 bg-gray-900/50">
                <table className="w-full text-xs md:text-sm border-collapse min-w-[800px]">
                    <thead>
                        <tr className="bg-gray-800">
                            <th className="p-2 border-r border-b border-gray-700 w-24">Hora</th>
                            {DAYS.map((day) => (
                                <th key={day.id} className="p-2 border-b border-gray-700 text-gray-300 font-bold">
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
                                            className="bg-transparent border-none focus:ring-0 text-white w-full text-xs md:text-sm p-0 text-center font-bold"
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
                                    const content = weeklyRoutine[day.id]?.[time] || '';
                                    const isTopicId = content.startsWith('t') || content.startsWith('st');
                                    const topicName = isTopicId ? getTopicName(content) : null;
                                    const topicColor = isTopicId ? getTopicColor(content) : null;
                                    
                                    return (
                                        <td
                                            key={day.id}
                                            onClick={() => handleCellAction(day.id, time)}
                                            className={`p-1 border border-gray-700 h-20 min-w-[110px] relative group transition-colors hover:bg-gray-800/50 ${selectedTopicId ? 'cursor-copy' : 'cursor-text'}`}
                                        >
                                            {isTopicId ? (
                                                <div 
                                                    className="w-full h-full rounded p-1.5 flex flex-col justify-between overflow-hidden shadow-inner animate-fade-in"
                                                    style={{ backgroundColor: topicColor ? `${topicColor}22` : '#0ea5e922', borderLeft: `3px solid ${topicColor || '#0ea5e9'}` }}
                                                >
                                                    <div className="flex items-center justify-between gap-1 mb-1">
                                                        <div className="flex items-center gap-1">
                                                            <BookOpenIcon className="w-3 h-3 text-white/50" />
                                                            <span className="text-[8px] uppercase font-bold text-white/40 tracking-tighter">Estudo</span>
                                                        </div>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onUpdateRoutine(day.id, time, null); }}
                                                            className="p-0.5 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
                                                            title="Remover conteúdo"
                                                        >
                                                            <TrashIcon className="h-2.5 w-2.5" />
                                                        </button>
                                                    </div>
                                                    <span className="text-[10px] md:text-[11px] font-bold text-white line-clamp-2 leading-tight">
                                                        {topicName || 'Carregando...'}
                                                    </span>
                                                    <div className="flex justify-end opacity-20">
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
                                                        className="w-full h-full bg-transparent border-none focus:ring-1 focus:ring-cyan-500/30 text-[11px] text-gray-300 resize-none p-1 font-medium leading-tight custom-scrollbar"
                                                    />
                                                    
                                                    {/* Botão de Picker Rápido em Células Vazias */}
                                                    {!content && !selectedTopicId && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onOpenPicker(day.id, time); }}
                                                            className="absolute bottom-1 right-1 p-1 rounded-md bg-gray-800 text-cyan-500 opacity-0 group-hover:opacity-100 hover:bg-cyan-600 hover:text-white transition-all shadow-lg border border-gray-700"
                                                            title="Buscar Tópico do Curso"
                                                        >
                                                            <BookOpenIcon className="w-3 h-3" />
                                                        </button>
                                                    )}

                                                    {content && (
                                                         <div className="absolute bottom-1 right-1 opacity-20 pointer-events-none">
                                                            <PencilIcon className="w-2.5 h-2.5 text-white" />
                                                         </div>
                                                    )}
                                                </div>
                                            )}
                                            {selectedTopicId && !content && (
                                                <div className="absolute inset-0 opacity-0 group-hover:opacity-20 bg-cyan-400 rounded pointer-events-none transition-opacity"></div>
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
                                    className="w-full flex items-center justify-center gap-1 text-cyan-400 hover:text-cyan-300 py-1 transition-all"
                                    title="Adicionar novo horário"
                                >
                                    <PlusIcon className="h-4 w-4" />
                                    <span className="text-[10px] uppercase font-bold tracking-wider">Novo</span>
                                </button>
                            </td>
                            {DAYS.map(day => <td key={day.id} className="p-2 border-gray-700"></td>)}
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

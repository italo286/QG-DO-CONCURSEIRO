import React, { useState, useEffect } from 'react';
import { MiniGame, MiniGameType, MemoryGameData, AssociationGameData, OrderGameData, IntruderGameData, CategorizeGameData } from '../../types';
import * as GeminiService from '../../services/geminiService';
import { fileToBase64 } from '../../utils';
import { Modal, Button, Spinner } from '../ui';
import { TrashIcon, GeminiIcon } from '../Icons';

const GAME_TYPES: { type: MiniGameType, name: string, description: string }[] = [
    { type: 'memory', name: 'Jogo da Memória', description: 'Encontre os pares de cartas.' },
    { type: 'association', name: 'Associação', description: 'Conecte conceitos a definições.' },
    { type: 'order', name: 'Desafio da Ordem', description: 'Organize itens em sequência.' },
    { type: 'intruder', name: 'Encontre o Intruso', description: 'Ache a palavra que não pertence.' },
    { type: 'categorize', name: 'Organize as Palavras', description: 'Arraste palavras para suas categorias.' },
];

export const ProfessorGameEditorModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (game: MiniGame) => void;
    game: MiniGame | null;
}> = ({ isOpen, onClose, onSave, game }) => {
    const [view, setView] = useState<'typeSelection' | 'aiCreation' | 'manualCreation'>('typeSelection');
    const [editingGame, setEditingGame] = useState<Partial<MiniGame>>({});
    const [selectedType, setSelectedType] = useState<MiniGameType | null>(null);
    const [error, setError] = useState('');
    
    // AI State
    const [aiInputMethod, setAiInputMethod] = useState<'pdf' | 'text'>('pdf');
    const [aiFile, setAiFile] = useState<File | null>(null);
    const [aiText, setAiText] = useState('');
    const [aiGameType, setAiGameType] = useState<MiniGameType>('memory');
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (game) {
                setEditingGame({ ...game });
                setSelectedType(game.type);
                setView('manualCreation');
            } else {
                setEditingGame({ name: '' });
                setSelectedType(null);
                setView('typeSelection');
                setAiFile(null);
                setAiText('');
                setIsGenerating(false);
            }
            setError('');
        }
    }, [isOpen, game]);

    const handleSave = () => {
        setError('');
        if (!editingGame.name?.trim()) {
            setError('O nome do jogo é obrigatório.');
            return;
        }
        if (!selectedType) {
            setError('O tipo de jogo não foi definido.');
            return;
        }

        const gameToSave: MiniGame = {
            id: editingGame.id || `game-${Date.now()}`,
            name: editingGame.name,
            type: selectedType,
            data: editingGame.data as any,
        };
        onSave(gameToSave);
        onClose();
    };

    const handleTypeSelect = (type: MiniGameType) => {
        setSelectedType(type);
        let defaultData: any = {};
        switch (type) {
            case 'memory': defaultData = { items: ['', ''] }; break;
            case 'association': defaultData = { pairs: [{ concept: '', definition: '' }] }; break;
            case 'order': defaultData = { items: ['', ''], description: '' }; break;
            case 'intruder': defaultData = { correctItems: ['', '', '', ''], intruder: '', categoryName: '' }; break;
            case 'categorize': defaultData = { categories: [{ name: '', items: [''] }] }; break;
        }
        setEditingGame(g => ({ ...g, data: defaultData }));
        setView('manualCreation');
    };
    
    const handleAiGenerate = async () => {
        if (aiInputMethod === 'pdf' && !aiFile) {
            setError('Por favor, selecione um arquivo PDF.');
            return;
        }
        if (aiInputMethod === 'text' && !aiText.trim()) {
            setError('Por favor, cole o texto para análise.');
            return;
        }
        setError('');
        setIsGenerating(true);

        try {
            let gameData;
            let gameNameBase = '';

            if (aiInputMethod === 'pdf') {
                const base64 = await fileToBase64(aiFile!);
                gameData = await GeminiService.generateGameFromPdf(base64, aiGameType);
                gameNameBase = aiFile!.name.replace('.pdf', '');
            } else { // text
                gameData = await GeminiService.generateGameFromText(aiText, aiGameType);
                gameNameBase = aiText.substring(0, 20);
            }
            
            setEditingGame(g => ({ ...g, name: g.name || `Jogo de ${aiGameType} sobre ${gameNameBase}`, data: gameData }));
            setSelectedType(aiGameType);
            setView('manualCreation');

        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsGenerating(false);
        }
    };


    const updateData = (newData: any) => {
        setEditingGame(g => ({ ...g, data: newData }));
    };
    
    const renderTypeSelectionView = () => (
        <div className="space-y-6">
            <div className="text-center">
                <Button onClick={() => setView('aiCreation')} className="w-full">
                     <GeminiIcon className="h-5 w-5 mr-2"/> Criar com IA
                </Button>
            </div>
            <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-gray-600" /></div>
                <div className="relative flex justify-center"><span className="bg-gray-800 px-2 text-sm text-gray-400">OU</span></div>
            </div>
            <div>
                <h3 className="text-lg font-medium text-center text-gray-300 mb-4">Criar Manualmente</h3>
                <div className="grid grid-cols-2 gap-4">
                    {GAME_TYPES.map(({ type, name, description }) => (
                        <button key={type} onClick={() => handleTypeSelect(type)} className="text-left p-4 bg-gray-700 hover:bg-cyan-600 rounded-lg transition-colors">
                            <p className="font-bold">{name}</p>
                            <p className="text-sm text-gray-400">{description}</p>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
    
     const renderAiCreationView = () => (
        <div className="space-y-4">
            <button onClick={() => setView('typeSelection')} className="text-sm text-cyan-400 hover:underline">&larr; Voltar</button>
            <p className="text-gray-400">Forneça o conteúdo da aula, e a IA irá analisá-lo para criar o jogo para você.</p>
            <div>
                <label htmlFor="ai-game-type" className="block text-sm font-medium text-gray-300">Tipo de Jogo a ser Gerado</label>
                <select id="ai-game-type" value={aiGameType} onChange={e => setAiGameType(e.target.value as MiniGameType)} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white">
                    {GAME_TYPES.map(gt => <option key={gt.type} value={gt.type}>{gt.name}</option>)}
                </select>
            </div>

            <div className="flex border-b border-gray-700" role="tablist">
                <button onClick={() => setAiInputMethod('pdf')} className={`flex-1 py-2 text-sm font-medium ${aiInputMethod === 'pdf' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:text-white'}`} role="tab" aria-selected={aiInputMethod === 'pdf'}>Upload de PDF</button>
                <button onClick={() => setAiInputMethod('text')} className={`flex-1 py-2 text-sm font-medium ${aiInputMethod === 'text' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:text-white'}`} role="tab" aria-selected={aiInputMethod === 'text'}>Colar Texto</button>
            </div>

            {aiInputMethod === 'pdf' ? (
                <div className="flex items-center space-x-4">
                    <label className="cursor-pointer bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md">
                        <span>Selecionar PDF</span>
                        <input type="file" accept="application/pdf" onChange={e => e.target.files && setAiFile(e.target.files[0])} className="hidden" />
                    </label>
                    {aiFile && <span className="text-gray-300 truncate">{aiFile.name}</span>}
                </div>
            ) : (
                <textarea
                    value={aiText}
                    onChange={e => setAiText(e.target.value)}
                    rows={6}
                    placeholder="Cole o texto base do jogo aqui..."
                    className="block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white"
                />
            )}
            
            <div className="text-center">
                <Button onClick={handleAiGenerate} disabled={isGenerating || (aiInputMethod === 'pdf' && !aiFile) || (aiInputMethod === 'text' && !aiText.trim())}>
                    {isGenerating ? <Spinner /> : <><GeminiIcon className="h-5 w-5 mr-2" /> Gerar Jogo</>}
                </Button>
            </div>
            {error && <p className="text-red-400 text-sm text-center" role="alert">{error}</p>}
        </div>
    );

    const renderManualCreationView = () => {
        const gameData = editingGame.data;
        
        const gameForms: Record<MiniGameType, React.ReactNode> = {
            'memory': (() => {
                const data = gameData as MemoryGameData;
                return (
                    <div className="space-y-2">
                        <p className="text-sm text-gray-400">Insira até 15 palavras ou frases. O jogo criará os pares.</p>
                        {(data?.items ?? []).map((item, index) => (
                            <div key={index} className="flex items-center space-x-2">
                                <input type="text" value={item} onChange={e => {
                                    const newItems = [...(data?.items ?? [])]; newItems[index] = e.target.value; updateData({ items: newItems });
                                }} className="flex-grow bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white" />
                                <button type="button" onClick={() => {
                                    const newItems = (data?.items ?? []).filter((_, i) => i !== index); updateData({ items: newItems });
                                }} className="p-1 text-red-500 hover:text-red-400"><TrashIcon className="h-4 w-4" /></button>
                            </div>
                        ))}
                        {(data?.items?.length ?? 0) < 15 && <Button type="button" onClick={() => updateData({ items: [...(data?.items ?? []), ''] })} className="text-sm py-1 px-2">+ Item</Button>}
                    </div>
                );
            })(),
            'association': (() => {
                const data = gameData as AssociationGameData;
                return (
                    <div className="space-y-3">
                         {(data?.pairs ?? []).map((pair, index) => (
                             <div key={index} className="flex items-center space-x-2 p-2 bg-gray-900/50 rounded-lg">
                                 <input type="text" placeholder="Conceito" value={pair.concept} onChange={e => { const newPairs = [...(data?.pairs ?? [])]; newPairs[index].concept = e.target.value; updateData({ pairs: newPairs }); }} className="w-1/2 bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white" />
                                 <input type="text" placeholder="Definição" value={pair.definition} onChange={e => { const newPairs = [...(data?.pairs ?? [])]; newPairs[index].definition = e.target.value; updateData({ pairs: newPairs }); }} className="w-1/2 bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white" />
                                  <button type="button" onClick={() => updateData({ pairs: (data?.pairs ?? []).filter((_, i) => i !== index)})} className="p-1 text-red-500 hover:text-red-400"><TrashIcon className="h-4 w-4" /></button>
                             </div>
                         ))}
                         <Button type="button" onClick={() => updateData({ pairs: [...(data?.pairs ?? []), { concept: '', definition: '' }] })} className="text-sm py-1 px-2">+ Par</Button>
                    </div>
                );
            })(),
            'order': (() => {
                 const data = gameData as OrderGameData;
                 return (
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Instrução (ex: "Ordene as fases da licitação")</label>
                        <input type="text" value={data?.description ?? ''} onChange={e => updateData({ ...data, description: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white"/>
                        <p className="text-sm text-gray-400 pt-2">Insira os itens na ordem correta.</p>
                        {(data?.items ?? []).map((item, index) => (
                             <div key={index} className="flex items-center space-x-2">
                                <span className="text-gray-400">{index+1}.</span>
                                <input type="text" value={item} onChange={e => { const newItems = [...(data?.items ?? [])]; newItems[index] = e.target.value; updateData({ ...data, items: newItems }); }} className="flex-grow bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white" />
                                <button type="button" onClick={() => { const newItems = (data?.items ?? []).filter((_, i) => i !== index); updateData({ ...data, items: newItems }); }} className="p-1 text-red-500 hover:text-red-400"><TrashIcon className="h-4 w-4" /></button>
                             </div>
                        ))}
                        <Button type="button" onClick={() => updateData({ ...data, items: [...(data?.items ?? []), ''] })} className="text-sm py-1 px-2">+ Item</Button>
                    </div>
                 );
            })(),
             'intruder': (() => {
                const data = gameData as IntruderGameData;
                return (
                    <div className="space-y-3">
                        <div>
                             <label className="text-sm font-medium">Nome da Categoria (ex: Tipos de Tributos)</label>
                             <input type="text" value={data?.categoryName ?? ''} onChange={e => updateData({ ...data, categoryName: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white" />
                        </div>
                        <div>
                             <label className="text-sm font-medium text-green-400">Itens Corretos</label>
                             {(data?.correctItems ?? []).map((item, index) => (
                                <div key={index} className="flex items-center space-x-2 mt-1">
                                    <input type="text" value={item} onChange={e => { const newItems = [...(data?.correctItems ?? [])]; newItems[index] = e.target.value; updateData({ ...data, correctItems: newItems }); }} className="flex-grow bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white" />
                                    <button type="button" onClick={() => { const newItems = (data?.correctItems ?? []).filter((_, i) => i !== index); updateData({ ...data, correctItems: newItems }); }} className="p-1 text-red-500 hover:text-red-400"><TrashIcon className="h-4 w-4" /></button>
                                 </div>
                             ))}
                             <Button type="button" onClick={() => updateData({ ...data, correctItems: [...(data?.correctItems ?? []), ''] })} className="text-sm py-1 px-2 mt-2">+ Item Correto</Button>
                        </div>
                         <div>
                             <label className="text-sm font-medium text-red-400">O Intruso</label>
                             <input type="text" value={data?.intruder ?? ''} onChange={e => updateData({ ...data, intruder: e.target.value })} className="w-full mt-1 bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white" />
                         </div>
                    </div>
                );
            })(),
            'categorize': (() => {
                const data = gameData as CategorizeGameData;
                return (
                    <div className="space-y-3">
                         {(data?.categories ?? []).map((category, catIndex) => (
                             <div key={catIndex} className="p-3 bg-gray-900/50 rounded-lg space-y-2">
                                 <div className="flex items-center space-x-2">
                                     <input type="text" placeholder="Nome da Categoria" value={category.name} onChange={e => { const newCats = [...(data?.categories ?? [])]; newCats[catIndex].name = e.target.value; updateData({ categories: newCats }); }} className="flex-grow bg-gray-600 border border-gray-500 rounded-md py-1 px-2 text-white" />
                                     <button type="button" onClick={() => updateData({ categories: (data?.categories ?? []).filter((_, i) => i !== catIndex)})} className="p-1 text-red-500 hover:text-red-400"><TrashIcon className="h-4 w-4" /></button>
                                 </div>
                                 {(category.items || []).map((item, itemIndex) => (
                                     <div key={itemIndex} className="flex items-center space-x-2 pl-4">
                                         <input type="text" placeholder="Item" value={item} onChange={e => { const newCats = [...(data?.categories ?? [])]; newCats[catIndex].items[itemIndex] = e.target.value; updateData({ categories: newCats }); }} className="flex-grow bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white" />
                                         <button type="button" onClick={() => { const newCats = [...(data?.categories ?? [])]; newCats[catIndex].items = newCats[catIndex].items.filter((_, i) => i !== itemIndex); updateData({ categories: newCats }); }} className="p-1 text-red-500 hover:text-red-400 text-xs"><TrashIcon className="h-3 w-3"/></button>
                                     </div>
                                 ))}
                                 <Button type="button" onClick={() => { const newCats = [...(data?.categories ?? [])]; newCats[catIndex].items.push(''); updateData({ categories: newCats }); }} className="text-xs py-1 px-2 ml-4">+ Item</Button>
                             </div>
                         ))}
                         <Button type="button" onClick={() => updateData({ categories: [...(data?.categories ?? []), { name: '', items: [''] }] })} className="text-sm py-1 px-2">+ Categoria</Button>
                    </div>
                );
            })()
        };
         
         return (
            <div className="space-y-4">
                 <button onClick={() => {
                    if(aiFile || aiText) {
                        setEditingGame({ name: '' });
                        setSelectedType(null);
                        setAiFile(null);
                        setAiText('');
                    }
                    setView('typeSelection')
                 }} className="text-sm text-cyan-400 hover:underline">&larr; Mudar Tipo / Método</button>
                <div>
                    <label htmlFor="game-name" className="block text-sm font-medium text-gray-300">Nome do Jogo</label>
                    <input id="game-name" type="text" value={editingGame.name || ''} onChange={e => setEditingGame(g => ({ ...g, name: e.target.value }))} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white" />
                </div>
                {selectedType && gameForms[selectedType]}
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div className="flex justify-end pt-4">
                    <Button type="button" onClick={handleSave}>Salvar Jogo</Button>
                </div>
            </div>
         );
    };

    const renderView = () => {
        switch (view) {
            case 'aiCreation': return renderAiCreationView();
            case 'manualCreation': return selectedType ? renderManualCreationView() : renderTypeSelectionView();
            case 'typeSelection':
            default:
                return renderTypeSelectionView();
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={game ? "Editar Jogo" : "Novo Jogo"} size="2xl">
            {renderView()}
        </Modal>
    );
};
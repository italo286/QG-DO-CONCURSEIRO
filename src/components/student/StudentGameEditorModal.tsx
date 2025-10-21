import React, { useState, useEffect } from 'react';
import { MiniGame, MiniGameType, MemoryGameData, AssociationGameData, OrderGameData, IntruderGameData, CategorizeGameData } from '../../types';
import { Modal, Button } from '../ui';
import { TrashIcon } from '../Icons';

export const StudentGameEditorModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (game: MiniGame) => void;
    game: MiniGame | null;
}> = ({ isOpen, onClose, onSave, game }) => {
    const [editingGame, setEditingGame] = useState<Partial<MiniGame>>({});
    const [selectedType, setSelectedType] = useState<MiniGameType | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (game) {
                setEditingGame({ ...game });
                setSelectedType(game.type);
            } else {
                setEditingGame({ name: '' });
                setSelectedType(null);
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

        const gameToSave: MiniGame = {
            id: editingGame.id || `game-custom-${Date.now()}`,
            name: editingGame.name,
            type: selectedType!,
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
    };

    const updateData = (newData: any) => {
        setEditingGame(g => ({ ...g, data: newData }));
    };

    const renderFormForType = () => {
        const gameData = editingGame.data;
        switch (selectedType) {
            case 'memory': {
                const data = gameData as MemoryGameData;
                return (
                    <div className="space-y-2">
                        <p className="text-sm text-gray-400">Insira até 15 palavras ou frases. O jogo criará os pares.</p>
                        {(data.items || []).map((item, index) => (
                            <div key={index} className="flex items-center space-x-2">
                                <input type="text" value={item} onChange={e => {
                                    const newItems = [...data.items]; newItems[index] = e.target.value; updateData({ items: newItems });
                                }} className="flex-grow bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white" />
                                <button type="button" onClick={() => {
                                    const newItems = data.items.filter((_, i) => i !== index); updateData({ items: newItems });
                                }} className="p-1 text-red-500 hover:text-red-400"><TrashIcon className="h-4 w-4" /></button>
                            </div>
                        ))}
                        {data.items.length < 15 && <Button type="button" onClick={() => updateData({ items: [...data.items, ''] })} className="text-sm py-1 px-2">+ Item</Button>}
                    </div>
                );
            }
            case 'association': {
                const data = gameData as AssociationGameData;
                return (
                    <div className="space-y-3">
                         {(data.pairs || []).map((pair, index) => (
                             <div key={index} className="flex items-center space-x-2 p-2 bg-gray-900/50 rounded-lg">
                                 <input type="text" placeholder="Conceito" value={pair.concept} onChange={e => { const newPairs = [...data.pairs]; newPairs[index].concept = e.target.value; updateData({ pairs: newPairs }); }} className="w-1/2 bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white" />
                                 <input type="text" placeholder="Definição" value={pair.definition} onChange={e => { const newPairs = [...data.pairs]; newPairs[index].definition = e.target.value; updateData({ pairs: newPairs }); }} className="w-1/2 bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white" />
                                  <button type="button" onClick={() => updateData({ pairs: data.pairs.filter((_, i) => i !== index)})} className="p-1 text-red-500 hover:text-red-400"><TrashIcon className="h-4 w-4" /></button>
                             </div>
                         ))}
                         <Button type="button" onClick={() => updateData({ pairs: [...data.pairs, { concept: '', definition: '' }] })} className="text-sm py-1 px-2">+ Par</Button>
                    </div>
                );
            }
            case 'order': {
                 const data = gameData as OrderGameData;
                 return (
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Instrução (ex: "Ordene as fases da licitação")</label>
                        <input type="text" value={data.description} onChange={e => updateData({ ...data, description: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white"/>
                        <p className="text-sm text-gray-400 pt-2">Insira os itens na ordem correta.</p>
                        {(data.items || []).map((item, index) => (
                             <div key={index} className="flex items-center space-x-2">
                                <span className="text-gray-400">{index+1}.</span>
                                <input type="text" value={item} onChange={e => { const newItems = [...data.items]; newItems[index] = e.target.value; updateData({ ...data, items: newItems }); }} className="flex-grow bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white" />
                                <button type="button" onClick={() => { const newItems = data.items.filter((_, i) => i !== index); updateData({ ...data, items: newItems }); }} className="p-1 text-red-500 hover:text-red-400"><TrashIcon className="h-4 w-4" /></button>
                             </div>
                        ))}
                        <Button type="button" onClick={() => updateData({ ...data, items: [...data.items, ''] })} className="text-sm py-1 px-2">+ Item</Button>
                    </div>
                 );
            }
             case 'intruder': {
                const data = gameData as IntruderGameData;
                return (
                    <div className="space-y-3">
                        <div>
                             <label className="text-sm font-medium">Nome da Categoria (ex: Tipos de Tributos)</label>
                             <input type="text" value={data.categoryName} onChange={e => updateData({ ...data, categoryName: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white" />
                        </div>
                        <div>
                             <label className="text-sm font-medium text-green-400">Itens Corretos</label>
                             {(data.correctItems || []).map((item, index) => (
                                <div key={index} className="flex items-center space-x-2 mt-1">
                                    <input type="text" value={item} onChange={e => { const newItems = [...data.correctItems]; newItems[index] = e.target.value; updateData({ ...data, correctItems: newItems }); }} className="flex-grow bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white" />
                                    <button type="button" onClick={() => { const newItems = data.correctItems.filter((_, i) => i !== index); updateData({ ...data, correctItems: newItems }); }} className="p-1 text-red-500 hover:text-red-400"><TrashIcon className="h-4 w-4" /></button>
                                 </div>
                             ))}
                             <Button type="button" onClick={() => updateData({ ...data, correctItems: [...data.correctItems, ''] })} className="text-sm py-1 px-2 mt-2">+ Item Correto</Button>
                        </div>
                         <div>
                             <label className="text-sm font-medium text-red-400">O Intruso</label>
                             <input type="text" value={data.intruder} onChange={e => updateData({ ...data, intruder: e.target.value })} className="w-full mt-1 bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white" />
                         </div>
                    </div>
                );
            }
            case 'categorize': {
                const data = gameData as CategorizeGameData;
                return (
                    <div className="space-y-3">
                         {(data.categories || []).map((category, catIndex) => (
                             <div key={catIndex} className="p-3 bg-gray-900/50 rounded-lg space-y-2">
                                 <div className="flex items-center space-x-2">
                                     <input type="text" placeholder="Nome da Categoria" value={category.name} onChange={e => { const newCats = [...data.categories]; newCats[catIndex].name = e.target.value; updateData({ categories: newCats }); }} className="flex-grow bg-gray-600 border border-gray-500 rounded-md py-1 px-2 text-white" />
                                     <button type="button" onClick={() => updateData({ categories: data.categories.filter((_, i) => i !== catIndex)})} className="p-1 text-red-500 hover:text-red-400"><TrashIcon className="h-4 w-4" /></button>
                                 </div>
                                 {(category.items || []).map((item, itemIndex) => (
                                     <div key={itemIndex} className="flex items-center space-x-2 pl-4">
                                         <input type="text" placeholder="Item" value={item} onChange={e => { const newCats = [...data.categories]; newCats[catIndex].items[itemIndex] = e.target.value; updateData({ categories: newCats }); }} className="flex-grow bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white" />
                                         <button type="button" onClick={() => { const newCats = [...data.categories]; newCats[catIndex].items = newCats[catIndex].items.filter((_, i) => i !== itemIndex); updateData({ categories: newCats }); }} className="p-1 text-red-500 hover:text-red-400 text-xs"><TrashIcon className="h-3 w-3"/></button>
                                     </div>
                                 ))}
                                 <Button type="button" onClick={() => { const newCats = [...data.categories]; newCats[catIndex].items.push(''); updateData({ categories: newCats }); }} className="text-xs py-1 px-2 ml-4">+ Item</Button>
                             </div>
                         ))}
                         <Button type="button" onClick={() => updateData({ categories: [...data.categories, { name: '', items: [''] }] })} className="text-sm py-1 px-2">+ Categoria</Button>
                    </div>
                );
            }
            default: return null;
        }
    };

    const renderTypeSelector = () => {
        const gameTypes: { type: MiniGameType, name: string, description: string }[] = [
            { type: 'memory', name: 'Jogo da Memória', description: 'Encontre os pares de cartas.' },
            { type: 'association', name: 'Associação', description: 'Conecte conceitos a definições.' },
            { type: 'order', name: 'Desafio da Ordem', description: 'Organize itens em sequência.' },
            { type: 'intruder', name: 'Encontre o Intruso', description: 'Ache a palavra que não pertence.' },
            { type: 'categorize', name: 'Organize as Palavras', description: 'Arraste palavras para suas categorias.' },
        ];
        return (
            <div className="grid grid-cols-2 gap-4">
                {gameTypes.map(({ type, name, description }) => (
                    <button key={type} onClick={() => handleTypeSelect(type)} className="text-left p-4 bg-gray-700 hover:bg-cyan-600 rounded-lg transition-colors">
                        <p className="font-bold">{name}</p>
                        <p className="text-sm text-gray-400">{description}</p>
                    </button>
                ))}
            </div>
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={game ? "Editar Jogo Personalizado" : "Novo Jogo Personalizado"} size="2xl">
            {!selectedType ? renderTypeSelector() : (
                <div className="space-y-4">
                    <div>
                        <label htmlFor="game-name" className="block text-sm font-medium text-gray-300">Nome do Jogo</label>
                        <input id="game-name" type="text" value={editingGame.name || ''} onChange={e => setEditingGame(g => ({ ...g, name: e.target.value }))} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white" />
                    </div>
                    {renderFormForType()}
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    <div className="flex justify-end pt-4">
                        <Button type="button" onClick={handleSave}>Salvar Jogo</Button>
                    </div>
                </div>
            )}
        </Modal>
    );
};

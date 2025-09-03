import React, { useState, useEffect } from 'react';
import * as GeminiService from '../../services/geminiService';
import { Modal, Button, Spinner } from '../ui';
import { GeminiIcon } from '../Icons';
import { MiniGame, MiniGameType } from '../../types';

const GAME_TYPE_NAMES: { [key in MiniGameType]: string } = {
    memory: 'Jogo da Memória',
    association: 'Associação',
    order: 'Desafio da Ordem',
    intruder: 'Encontre o Intruso',
    categorize: 'Organize as Palavras',
};

export const AiBulkGameGeneratorModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (games: MiniGame[]) => void;
}> = ({ isOpen, onClose, onSave }) => {
    const [text, setText] = useState('');
    const [generatedGames, setGeneratedGames] = useState<MiniGame[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedGameIds, setSelectedGameIds] = useState<string[]>([]);

    useEffect(() => {
        if (!isOpen) {
            setText('');
            setGeneratedGames([]);
            setError('');
            setIsLoading(false);
            setSelectedGameIds([]);
        }
    }, [isOpen]);

    const handleGenerate = async () => {
        if (!text.trim()) {
            setError('Por favor, insira o texto base.');
            return;
        }
        setError('');
        setIsLoading(true);
        try {
            const games = await GeminiService.generateAllGamesFromText(text);
            const gamesWithIds = games.map(g => ({ ...g, id: `game-${Date.now()}-${Math.random()}` }));
            setGeneratedGames(gamesWithIds);
            setSelectedGameIds(gamesWithIds.map(g => g.id)); // Select all by default
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleSelection = (gameId: string) => {
        setSelectedGameIds(prev =>
            prev.includes(gameId) ? prev.filter(id => id !== gameId) : [...prev, gameId]
        );
    };

    const handleSave = () => {
        const gamesToSave = generatedGames.filter(g => selectedGameIds.includes(g.id));
        onSave(gamesToSave);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Gerar Todos os Jogos com IA" size="3xl">
            <div className="space-y-4">
                <p className="text-gray-400">Cole o conteúdo de uma aula. A IA tentará criar um jogo de cada tipo com base no texto fornecido.</p>
                <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    rows={8}
                    placeholder="Cole seu texto aqui..."
                    className="block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-cyan-500 focus:border-cyan-500"
                    disabled={isLoading}
                />
                <div className="text-center">
                    <Button onClick={handleGenerate} disabled={isLoading || !text.trim()}>
                        {isLoading ? <Spinner /> : <><GeminiIcon className="h-5 w-5 mr-2" /> Gerar Jogos</>}
                    </Button>
                </div>
                {error && <p className="text-red-400 text-sm text-center" role="alert">{error}</p>}
                
                {generatedGames.length > 0 && (
                    <div className="border-t border-gray-700 pt-4 space-y-4">
                        <h3 className="text-lg font-semibold">Jogos Gerados</h3>
                        <p className="text-sm text-gray-400">Selecione os jogos que deseja salvar.</p>
                         <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                             {generatedGames.map((game) => (
                                 <div key={game.id} className="p-3 bg-gray-900/50 rounded-lg flex items-start space-x-3">
                                     <input
                                        type="checkbox"
                                        checked={selectedGameIds.includes(game.id)}
                                        onChange={() => handleToggleSelection(game.id)}
                                        className="mt-1 h-5 w-5 rounded text-cyan-500 bg-gray-700 border-gray-600 focus:ring-cyan-600"
                                        id={`game-select-${game.id}`}
                                     />
                                     <label htmlFor={`game-select-${game.id}`} className="flex-grow">
                                        <p className="font-semibold text-cyan-400">{game.name}</p>
                                        <p className="text-xs text-gray-400">{GAME_TYPE_NAMES[game.type]}</p>
                                     </label>
                                 </div>
                             ))}
                         </div>
                         <div className="pt-4 flex justify-end">
                            <Button onClick={handleSave} disabled={selectedGameIds.length === 0}>
                                Adicionar {selectedGameIds.length} Jogo(s)
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};
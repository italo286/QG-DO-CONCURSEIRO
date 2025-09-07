import React, { useState } from 'react';
import { MiniGame } from '../../types';
import { Card, Button } from '../ui';
import { PlusIcon, TrashIcon, PencilIcon, SparklesIcon } from '../Icons';
import { ProfessorGameEditorModal } from './ProfessorGameEditorModal';
import { AiBulkGameGeneratorModal } from './AiBulkGameGeneratorModal';

interface ProfessorGameManagerProps {
    games: MiniGame[];
    onGamesChange: (games: MiniGame[]) => void;
}

export const ProfessorGameManager: React.FC<ProfessorGameManagerProps> = ({ games, onGamesChange }) => {
    const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
    const [isBulkAiModalOpen, setIsBulkAiModalOpen] = useState(false);
    const [editingGame, setEditingGame] = useState<MiniGame | null>(null);

    const handleOpenEditor = (game: MiniGame | null) => {
        setEditingGame(game);
        setIsEditorModalOpen(true);
    };

    const handleDeleteGame = (gameId: string) => {
        if (window.confirm("Tem certeza que deseja apagar este jogo?")) {
            onGamesChange(games.filter(g => g.id !== gameId));
        }
    };

    const handleSaveGame = (savedGame: MiniGame) => {
        const index = games.findIndex(g => g.id === savedGame.id);
        if (index > -1) {
            const newGames = [...games];
            newGames[index] = savedGame;
            onGamesChange(newGames);
        } else {
            onGamesChange([...games, savedGame]);
        }
        setIsEditorModalOpen(false);
    };
    
    const handleSaveAiGames = (newGames: MiniGame[]) => {
        onGamesChange([...games, ...newGames]);
        setIsBulkAiModalOpen(false);
    }

    return (
        <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Jogos Educacionais</h3>
                <div className="flex items-center gap-2">
                     <Button onClick={() => setIsBulkAiModalOpen(true)} className="text-sm py-2 px-3">
                        <SparklesIcon className="h-4 w-4 mr-2" /> Gerar Vários com IA
                    </Button>
                    <Button onClick={() => handleOpenEditor(null)} className="text-sm py-2 px-3">
                        <PlusIcon className="h-4 w-4 mr-2" /> Adicionar Jogo
                    </Button>
                </div>
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                {games.map((game) => (
                    <div key={game.id} className="p-3 bg-gray-800/50 rounded-lg">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="font-semibold text-gray-200">{game.name}</p>
                                <p className="text-xs text-gray-400">Tipo: {game.type}</p>
                            </div>
                            <div className="flex space-x-2">
                                <Button onClick={() => handleOpenEditor(game)} className="!p-2 text-sm"><PencilIcon className="h-4 w-4"/></Button>
                                <Button onClick={() => handleDeleteGame(game.id)} className="!p-2 text-sm bg-red-600 hover:bg-red-700"><TrashIcon className="h-4 w-4"/></Button>
                            </div>
                        </div>
                    </div>
                ))}
                {games.length === 0 && <p className="text-center text-gray-500 py-4">Nenhum jogo adicionado.</p>}
            </div>

            <ProfessorGameEditorModal 
                isOpen={isEditorModalOpen} 
                onClose={() => setIsEditorModalOpen(false)}
                onSave={handleSaveGame}
                game={editingGame}
            />
            
            <AiBulkGameGeneratorModal 
                isOpen={isBulkAiModalOpen}
                onClose={() => setIsBulkAiModalOpen(false)}
                onSave={handleSaveAiGames}
            />
        </Card>
    );
};
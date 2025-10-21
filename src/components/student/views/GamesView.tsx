import React from 'react';
import { MiniGame, StudentProgress, Subject, Topic, SubTopic } from '../../../types';
import { Card, Button } from '../../ui';
import { GameControllerIcon, PlusIcon, PencilIcon, TrashIcon, ChevronDownIcon } from '../../Icons';

interface GamesViewProps {
    allSubjects: Subject[];
    studentProgress: StudentProgress;
    onPlayGame: (game: MiniGame, topicId: string) => void;
    onDeleteCustomGame: (gameId: string) => void;
    onOpenCustomGameModal: (game: MiniGame | null) => void;
}

export const GamesView: React.FC<GamesViewProps> = ({
    allSubjects,
    studentProgress,
    onPlayGame,
    onDeleteCustomGame,
    onOpenCustomGameModal
}) => {
    const gamesByTopic = allSubjects.reduce((acc, subject) => {
        subject.topics.forEach((topic: Topic) => {
            if (topic.miniGames.length > 0) {
                if (!acc[subject.name]) acc[subject.name] = {};
                acc[subject.name][topic.name] = { games: topic.miniGames, topicId: topic.id };
            }
            topic.subtopics.forEach((subtopic: SubTopic) => {
                if (subtopic.miniGames.length > 0) {
                     if (!acc[subject.name]) acc[subject.name] = {};
                     const topicAndSubtopicName = `${topic.name} / ${subtopic.name}`;
                     acc[subject.name][topicAndSubtopicName] = { games: subtopic.miniGames, topicId: subtopic.id };
                }
            });
        });
        return acc;
    }, {} as { [subjectName: string]: { [topicName: string]: { games: MiniGame[], topicId: string } } });
    
    return (
        <div className="space-y-8">
            <Card className="p-6">
                <h2 className="text-2xl font-bold mb-4">Jogos Educacionais</h2>
                <p className="text-gray-400 mb-6">Jogos criados pelos professores para reforçar o aprendizado de forma divertida.</p>
                 <div className="space-y-2">
                    {Object.entries(gamesByTopic).map(([subjectName, topics]) => (
                        <details key={subjectName} className="bg-gray-800 rounded-lg border border-gray-700/50">
                            <summary className="flex justify-between items-center p-4 cursor-pointer list-none">
                                <h3 className="font-semibold text-lg text-cyan-400">{subjectName}</h3>
                                <ChevronDownIcon className="h-5 w-5 transition-transform details-open:rotate-180" />
                            </summary>
                            <div className="border-t border-gray-700 px-4 pb-4">
                                {Object.entries(topics).map(([topicName, { games, topicId }]: [string, { games: MiniGame[], topicId: string }]) => (
                                     <details key={topicName} className="mt-2" open>
                                        <summary className="font-semibold text-gray-200 p-2 cursor-pointer list-none flex items-center">
                                           <ChevronDownIcon className="h-4 w-4 mr-2 transition-transform details-open:rotate-180" />
                                            {topicName}
                                        </summary>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-6 pt-2">
                                            {games.map((game: MiniGame) => (
                                                <button key={game.id} onClick={() => onPlayGame(game, topicId)} className="p-4 bg-gray-700 hover:bg-cyan-600 rounded-lg transition-colors text-left">
                                                    <GameControllerIcon className="h-8 w-8 mb-2 text-cyan-400" />
                                                    <p className="font-bold">{game.name}</p>
                                                    <p className="text-sm text-gray-400">Tipo: {game.type}</p>
                                                </button>
                                            ))}
                                        </div>
                                     </details>
                                ))}
                            </div>
                        </details>
                    ))}
                    {Object.keys(gamesByTopic).length === 0 && <p className="text-gray-500 col-span-full text-center py-4">Nenhum jogo disponível nos seus cursos.</p>}
                </div>
            </Card>
            <Card className="p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold">Seus Jogos Personalizados</h2>
                    <Button onClick={() => onOpenCustomGameModal(null)} className="text-sm py-2 px-3">
                        <PlusIcon className="h-4 w-4 mr-2" /> Criar Jogo
                    </Button>
                </div>
                <p className="text-gray-400 mb-6">Crie seus próprios jogos para estudar os tópicos que você mais precisa.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {studentProgress.customGames.map((game: MiniGame) => (
                        <div key={game.id} className="p-4 bg-gray-700 rounded-lg text-left flex flex-col">
                            <div className="flex-grow">
                                <p className="font-bold">{game.name}</p>
                                <p className="text-sm text-gray-400">Tipo: {game.type}</p>
                            </div>
                            <div className="mt-4 flex space-x-2">
                                <Button onClick={() => onPlayGame(game, 'custom')} className="text-sm flex-1 py-2">Jogar</Button>
                                <Button onClick={() => onOpenCustomGameModal(game)} className="text-sm py-2 px-3 bg-gray-600 hover:bg-gray-500"><PencilIcon className="h-4 w-4" /></Button>
                                <Button onClick={() => onDeleteCustomGame(game.id)} className="text-sm py-2 px-3 bg-red-600 hover:bg-red-500"><TrashIcon className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    ))}
                    {studentProgress.customGames.length === 0 && <p className="text-gray-500 col-span-full text-center">Você ainda não criou nenhum jogo.</p>}
                </div>
            </Card>
        </div>
    );
};
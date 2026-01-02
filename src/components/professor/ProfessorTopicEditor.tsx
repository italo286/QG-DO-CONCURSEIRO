
import React, { useState, useEffect, useCallback } from 'react';
import { Topic, Question, MiniGame, SubTopic } from '../../types';
import { Modal, Button, ColorPalettePicker } from '../ui';
import { GeminiIcon, GameControllerIcon, PencilIcon, TrashIcon, ExclamationTriangleIcon, CheckBadgeIcon } from '../Icons';
import { AiQuestionGeneratorModal } from './AiQuestionGeneratorModal';
import { ProfessorGameEditorModal } from './ProfessorGameEditorModal';
import { ContentLinksEditor } from './ContentLinksEditor';
import { ProfessorFlashcardEditorModal } from './ProfessorFlashcardEditorModal';
import { GlossaryEditor } from './GlossaryEditor';
import { BankProfileEditor } from './BankProfileEditor';
import { AiBulkGameGeneratorModal } from './AiBulkGameGeneratorModal';
import { ProfessorQuestionEditorModal } from './ProfessorQuestionEditorModal';
import { AiBulkTopicContentGeneratorModal } from './AiBulkTopicContentGeneratorModal';

export const ProfessorTopicEditor: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (topic: Topic) => void;
    topic: Topic | null;
}> = ({ isOpen, onClose, onSave, topic }) => {
    const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
    const [localName, setLocalName] = useState('');
    const [localDescription, setLocalDescription] = useState('');
    const [localMindMapUrl, setLocalMindMapUrl] = useState('');
    const [localColor, setLocalColor] = useState<string | undefined>('');

    const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
    const [isTecModalOpen, setIsTecModalOpen] = useState(false);
    const [isGameModalOpen, setIsGameModalOpen] = useState(false);
    const [editingGame, setEditingGame] = useState<MiniGame | null>(null);
    const [isFlashcardModalOpen, setIsFlashcardModalOpen] = useState(false);
    const [isGlossaryModalOpen, setIsGlossaryModalOpen] = useState(false);
    const [isBulkGameModalOpen, setIsBulkGameModalOpen] = useState(false);
    const [isBulkSubtopicModalOpen, setIsBulkSubtopicModalOpen] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

    useEffect(() => {
        if (isOpen) {
            const initialTopic = topic || { id: '', name: '', description: '', fullPdfs: [], summaryPdfs: [], videoUrls: [], questions: [], subtopics: [], miniGames: [], flashcards: [], glossary: [] };
            setEditingTopic(initialTopic);
            setLocalName(initialTopic.name);
            setLocalDescription(initialTopic.description || '');
            setLocalMindMapUrl(initialTopic.mindMapUrl || '');
            setLocalColor(initialTopic.color);
        } else {
            setEditingTopic(null);
        }
    }, [isOpen, topic]);

    const handleSave = () => {
        if (editingTopic) {
            if (!localName.trim()) {
                alert("O nome do tópico é obrigatório.");
                return;
            }
            const finalTopic = { 
                ...editingTopic, 
                name: localName,
                description: localDescription,
                mindMapUrl: localMindMapUrl,
                color: localColor,
                id: editingTopic.id || `t${Date.now()}` 
            };
            onSave(finalTopic);
            onClose();
        }
    };
    
    const saveGeneratedQuestions = (questions: Omit<Question, 'id'>[], isTecExtraction: boolean) => {
        const newQuestions = questions.map(q => ({...q, id: `q${Date.now()}${Math.random()}`}));
        setEditingTopic(prev => {
            if (!prev) return prev;
            if (isTecExtraction) {
                return {...prev, tecQuestions: [...(prev.tecQuestions || []), ...newQuestions] }
            } else {
                return {...prev, questions: [...prev.questions, ...newQuestions]}
            }
        });
    };

    const handleDeleteQuestion = (questionId: string, isTec: boolean) => {
        if (!editingTopic || !window.confirm("Tem certeza que deseja apagar esta questão?")) return;
        let updatedQuestions;
        if (isTec) {
            updatedQuestions = (editingTopic.tecQuestions || []).filter(q => q.id !== questionId);
            setEditingTopic({ ...editingTopic, tecQuestions: updatedQuestions });
        } else {
            updatedQuestions = editingTopic.questions.filter(q => q.id !== questionId);
            setEditingTopic({ ...editingTopic, questions: updatedQuestions });
        }
    };

    const handleSaveQuestion = (questionToSave: Question) => {
        if (!editingTopic) return;
        const isTec = (editingTopic.tecQuestions || []).some(q => q.id === questionToSave.id);
        if (isTec) {
            const updatedQuestions = (editingTopic.tecQuestions || []).map(q => q.id === questionToSave.id ? questionToSave : q);
            setEditingTopic({ ...editingTopic, tecQuestions: updatedQuestions });
        } else {
            const updatedQuestions = editingTopic.questions.map(q => q.id === questionToSave.id ? questionToSave : q);
            setEditingTopic({ ...editingTopic, questions: updatedQuestions });
        }
        setEditingQuestion(null);
    };

    const handleResolveReport = (questionId: string) => {
        setEditingTopic(prev => {
            if (!prev) return null;
            
            const updatedTopic = { ...prev };

            // Process `questions`
            updatedTopic.questions = updatedTopic.questions.map(q => {
                if (q.id === questionId) {
                    const { reportInfo, ...rest } = q;
                    return rest;
                }
                return q;
            });
    
            // Process `tecQuestions` only if it exists
            if (updatedTopic.tecQuestions) {
                updatedTopic.tecQuestions = updatedTopic.tecQuestions.map(q => {
                    if (q.id === questionId) {
                        const { reportInfo, ...rest } = q;
                        return rest;
                    }
                    return q;
                });
            }
    
            return updatedTopic;
        });
    };

    const handleOpenGameModal = (game: MiniGame | null) => {
        setEditingGame(game);
        setIsGameModalOpen(true);
    };

    const handleSaveGame = (gameToSave: MiniGame) => {
        if (!editingTopic) return;
        const isEditing = editingTopic.miniGames.some(g => g.id === gameToSave.id);
        const updatedGames = isEditing
            ? editingTopic.miniGames.map(g => (g.id === gameToSave.id ? gameToSave : g))
            : [...editingTopic.miniGames, gameToSave];
        setEditingTopic({ ...editingTopic, miniGames: updatedGames });
    };

    const handleSaveBulkGames = (games: MiniGame[]) => {
        if (!editingTopic) return;
        const newGames = [...editingTopic.miniGames, ...games];
        setEditingTopic({ ...editingTopic, miniGames: newGames });
    };

    const handleSaveAiBulkSubtopics = (newSubtopics: SubTopic[]) => {
        setEditingTopic(prev => {
            if (!prev) return null;
            return {
                ...prev,
                subtopics: [...(prev.subtopics || []), ...newSubtopics]
            };
        });
        setIsBulkSubtopicModalOpen(false);
    };

    const handleDeleteGame = (gameId: string) => {
        if (!editingTopic || !window.confirm("Tem certeza que deseja apagar este jogo?")) return;
        const updatedGames = editingTopic.miniGames.filter(g => g.id !== gameId);
        setEditingTopic({ ...editingTopic, miniGames: updatedGames });
    };

    const handleBulkDelete = (
        contentType: 'questions' | 'tecQuestions' | 'miniGames' | 'flashcards' | 'glossary',
        contentName: string
    ) => {
        if (!editingTopic) return;
        if (window.confirm(`Tem certeza de que deseja excluir permanentemente todo o conteúdo de "${contentName}" deste tópico? Esta ação não pode ser desfeita.`)) {
            setEditingTopic(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    [contentType]: []
                };
            });
        }
    };

    const handleCloseQuestionModal = useCallback(() => setIsQuestionModalOpen(false), []);
    const handleCloseTecModal = useCallback(() => setIsTecModalOpen(false), []);
    const handleCloseGameModal = useCallback(() => setIsGameModalOpen(false), []);
    const handleCloseFlashcardModal = useCallback(() => setIsFlashcardModalOpen(false), []);
    const handleCloseGlossaryModal = useCallback(() => setIsGlossaryModalOpen(false), []);
    const handleCloseBulkGameModal = useCallback(() => setIsBulkGameModalOpen(false), []);
    const handleCloseBulkSubtopicModal = useCallback(() => setIsBulkSubtopicModalOpen(false), []);

    if (!isOpen || !editingTopic) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={topic?.id ? "Editar Tópico" : "Novo Tópico"} size="4xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <ColorPalettePicker 
                            currentColor={localColor}
                            onColorSelect={setLocalColor}
                        />
                        <div className="flex-grow">
                            <label htmlFor="topic-name" className="block text-sm font-medium text-gray-300">Nome do Tópico</label>
                            <input id="topic-name" type="text" value={localName} onChange={e => setLocalName(e.target.value)} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white"/>
                        </div>
                    </div>
                     <div>
                        <label htmlFor="topic-desc" className="block text-sm font-medium text-gray-300">Descrição</label>
                        <textarea id="topic-desc" value={localDescription} onChange={e => setLocalDescription(e.target.value)} rows={3} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white"/>
                    </div>
                    <ContentLinksEditor content={editingTopic} setContent={setEditingTopic} />
                    <div>
                        <label htmlFor="topic-mindmap-url" className="block text-sm font-medium text-gray-300">Mapa Mental (URL da Imagem)</label>
                        <input
                            id="topic-mindmap-url"
                            type="url"
                            value={localMindMapUrl}
                            onChange={e => setLocalMindMapUrl(e.target.value)}
                            placeholder="https://exemplo.com/mapa.png"
                            className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white"
                        />
                    </div>
                    <BankProfileEditor
                        bankProfilePdfs={editingTopic.bankProfilePdfs || []}
                        onUpdatePdfs={(pdfs) => {
                            setEditingTopic(prev => prev ? { ...prev, bankProfilePdfs: pdfs } : null);
                        }}
                    />
                </div>
                 <div className="space-y-4">
                    <div className="p-4 bg-gray-900/50 rounded-lg space-y-3">
                        <h4 className="font-semibold text-gray-300">Gerenciamento de Conteúdo</h4>
                        <div className="flex flex-wrap gap-2">
                           <Button onClick={() => setIsQuestionModalOpen(true)} className="text-sm py-2 px-3"><GeminiIcon className="h-4 w-4 mr-2"/> Gerar Questões (Conteúdo)</Button>
                           <Button onClick={() => setIsTecModalOpen(true)} className="text-sm py-2 px-3"><GeminiIcon className="h-4 w-4 mr-2"/> Extrair Questões (TEC)</Button>
                           <Button onClick={() => handleOpenGameModal(null)} className="text-sm py-2 px-3"><GameControllerIcon className="h-4 w-4 mr-2"/> Add Jogo</Button>
                           <Button onClick={() => setIsBulkGameModalOpen(true)} className="text-sm py-2 px-3"><GeminiIcon className="h-4 w-4 mr-2"/> Gerar Todos os Jogos</Button>
                           <Button onClick={() => setIsBulkSubtopicModalOpen(true)} className="text-sm py-2 px-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 border-none font-bold"><GeminiIcon className="h-4 w-4 mr-2"/> Gerar Subtópicos em Massa</Button>
                        </div>
                    </div>
                     <div className="p-4 bg-gray-900/50 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-semibold text-gray-300">Questões (Conteúdo) ({editingTopic.questions.length})</h4>
                             <button onClick={() => handleBulkDelete('questions', 'Questões (Conteúdo)')} className="p-1 text-gray-400 hover:text-red-400" title="Excluir todas as questões de conteúdo"><TrashIcon className="h-4 w-4" /></button>
                        </div>
                        <ul className="space-y-2 max-h-40 overflow-y-auto text-sm pr-2">
                            {editingTopic.questions.map((q, i) => (
                                <li key={q.id} className={`p-3 rounded-lg transition-colors ${q.reportInfo ? 'bg-amber-900/30 border border-amber-700/60' : 'bg-gray-700'}`}>
                                    <div className="flex justify-between items-center">
                                        <span className="truncate pr-2 flex-grow">{i+1}. {q.statement}</span>
                                        <div className="flex space-x-1 flex-shrink-0">
                                            {q.reportInfo && (
                                                <button onClick={() => handleResolveReport(q.id)} className="p-1 hover:text-green-400" aria-label={`Resolver reporte da questão ${i+1}`} title="Marcar como resolvido">
                                                    <CheckBadgeIcon className="h-5 w-5 text-green-400" />
                                                </button>
                                            )}
                                            <button onClick={() => setEditingQuestion(q)} className="p-1 hover:text-cyan-400" aria-label={`Editar questão ${i+1}`}><PencilIcon className="h-4 w-4" /></button>
                                            <button onClick={() => handleDeleteQuestion(q.id, false)} className="p-1 hover:text-red-400" aria-label={`Apagar questão ${i+1}`}><TrashIcon className="h-4 w-4" /></button>
                                        </div>
                                    </div>
                                    {q.reportInfo && (
                                        <div className="mt-2 pl-3 border-l-2 border-amber-500/50">
                                            <p className="text-xs text-amber-300 font-semibold flex items-center gap-2">
                                                <ExclamationTriangleIcon className="h-4 w-4" />
                                                Erro Reportado
                                            </p>
                                            <p className="text-xs text-gray-300 mt-1 ml-6">Motivo: {q.reportInfo.reason}</p>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                     <div className="p-4 bg-gray-900/50 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-semibold text-gray-300">Questões (Extraídas do TEC) ({(editingTopic.tecQuestions || []).length})</h4>
                            <button onClick={() => handleBulkDelete('tecQuestions', 'Questões (TEC)')} className="p-1 text-gray-400 hover:text-red-400" title="Excluir todas as questões do TEC"><TrashIcon className="h-4 w-4" /></button>
                        </div>
                        <ul className="space-y-2 max-h-40 overflow-y-auto text-sm pr-2">
                            {(editingTopic.tecQuestions || []).map((q, i) => (
                                <li key={q.id} className={`p-3 rounded-lg transition-colors ${q.reportInfo ? 'bg-amber-900/30 border border-amber-700/60' : 'bg-gray-700'}`}>
                                    <div className="flex justify-between items-center">
                                        <span className="truncate pr-2 flex-grow">{i+1}. {q.statement}</span>
                                        <div className="flex space-x-1 flex-shrink-0">
                                            {q.reportInfo && (
                                                <button onClick={() => handleResolveReport(q.id)} className="p-1 hover:text-green-400" aria-label={`Resolver reporte da questão ${i+1}`} title="Marcar como resolvido">
                                                    <CheckBadgeIcon className="h-5 w-5 text-green-400" />
                                                </button>
                                            )}
                                            <button onClick={() => setEditingQuestion(q)} className="p-1 hover:text-cyan-400" aria-label={`Editar questão extraída ${i+1}`}><PencilIcon className="h-4 w-4" /></button>
                                            <button onClick={() => handleDeleteQuestion(q.id, true)} className="p-1 hover:text-red-400" aria-label={`Apagar questão extraída ${i+1}`}><TrashIcon className="h-4 w-4" /></button>
                                        </div>
                                    </div>
                                    {q.reportInfo && (
                                        <div className="mt-2 pl-3 border-l-2 border-amber-500/50">
                                            <p className="text-xs text-amber-300 font-semibold flex items-center gap-2">
                                                <ExclamationTriangleIcon className="h-4 w-4" />
                                                Erro Reportado
                                            </p>
                                            <p className="text-xs text-gray-300 mt-1 ml-6">Motivo: {q.reportInfo.reason}</p>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="p-4 bg-gray-900/50 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-semibold text-gray-300">Mini-Jogos ({editingTopic.miniGames.length})</h4>
                            <button onClick={() => handleBulkDelete('miniGames', 'Mini-Jogos')} className="p-1 text-gray-400 hover:text-red-400" title="Excluir todos os jogos"><TrashIcon className="h-4 w-4" /></button>
                        </div>
                        <ul className="space-y-1 max-h-40 overflow-y-auto text-sm pr-2">
                            {editingTopic.miniGames.map(game => (
                                <li key={game.id} className="flex justify-between items-center p-2 bg-gray-700 rounded-md">
                                    <span className="truncate pr-2">{game.name}</span>
                                    <div className="flex space-x-1">
                                        <button onClick={() => handleOpenGameModal(game)} className="p-1 hover:text-cyan-400"><PencilIcon className="h-4 w-4" /></button>
                                        <button onClick={() => handleDeleteGame(game.id)} className="p-1 hover:text-red-400"><TrashIcon className="h-4 w-4" /></button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="p-4 bg-gray-900/50 rounded-lg">
                         <div className="flex justify-between items-center mb-2">
                           <h4 className="font-semibold text-gray-300">Flashcards ({editingTopic.flashcards?.length || 0})</h4>
                            <div>
                               <button onClick={() => handleBulkDelete('flashcards', 'Flashcards')} className="p-1 text-gray-400 hover:text-red-400" title="Excluir todos os flashcards"><TrashIcon className="h-4 w-4" /></button>
                               <Button onClick={() => setIsFlashcardModalOpen(true)} className="text-xs py-1 px-2 ml-2">
                                   <PencilIcon className="h-3 w-3 mr-1"/> Gerenciar
                               </Button>
                           </div>
                        </div>
                        <ul className="space-y-1 max-h-40 overflow-y-auto text-sm pr-2">
                           {(editingTopic.flashcards || []).map((fc, i) => <li key={fc.id} className="truncate p-1 bg-gray-700/50 rounded">{i+1}. {fc.front}</li>)}
                        </ul>
                    </div>
                     <div className="p-4 bg-gray-900/50 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                           <h4 className="font-semibold text-gray-300">Glossário ({editingTopic.glossary?.length || 0})</h4>
                           <div>
                               <button onClick={() => handleBulkDelete('glossary', 'Glossário')} className="p-1 text-gray-400 hover:text-red-400" title="Excluir todo o glossário"><TrashIcon className="h-4 w-4" /></button>
                               <Button onClick={() => setIsGlossaryModalOpen(true)} className="text-xs py-1 px-2 ml-2">
                                   <PencilIcon className="h-3 w-3 mr-1"/> Gerenciar
                               </Button>
                           </div>
                        </div>
                         <ul className="space-y-1 max-h-40 overflow-y-auto text-sm pr-2">
                           {(editingTopic.glossary || []).map((g, i) => <li key={i} className="truncate p-1 bg-gray-700/50 rounded">{i+1}. {g.term}</li>)}
                        </ul>
                    </div>
                </div>
            </div>
            <div className="mt-8 pt-4 border-t border-gray-700 flex justify-end">
                <Button onClick={handleSave}>Salvar Tópico</Button>
            </div>

            <AiQuestionGeneratorModal isOpen={isQuestionModalOpen} onClose={handleCloseQuestionModal} onSaveQuestions={saveGeneratedQuestions} isTecExtraction={false} />
            <AiQuestionGeneratorModal isOpen={isTecModalOpen} onClose={handleCloseTecModal} onSaveQuestions={saveGeneratedQuestions} isTecExtraction={true} />
            <ProfessorGameEditorModal isOpen={isGameModalOpen} onClose={handleCloseGameModal} onSave={handleSaveGame} game={editingGame} />
            <AiBulkGameGeneratorModal 
                isOpen={isBulkGameModalOpen}
                onClose={handleCloseBulkGameModal}
                onSave={handleSaveBulkGames}
            />
            <AiBulkTopicContentGeneratorModal
                isOpen={isBulkSubtopicModalOpen}
                onClose={handleCloseBulkSubtopicModal}
                onSave={handleSaveAiBulkSubtopics}
                mode="subtopic"
            />
            <ProfessorFlashcardEditorModal 
                isOpen={isFlashcardModalOpen} 
                onClose={handleCloseFlashcardModal} 
                onSave={(flashcards) => setEditingTopic(prev => prev ? {...prev, flashcards} : prev)}
                initialFlashcards={editingTopic.flashcards || []}
            />
            <GlossaryEditor
                isOpen={isGlossaryModalOpen}
                onClose={handleCloseGlossaryModal}
                onSave={(glossary) => setEditingTopic(prev => prev ? { ...prev, glossary } : prev)}
                initialGlossary={editingTopic.glossary || []}
            />
             <ProfessorQuestionEditorModal 
                isOpen={!!editingQuestion}
                onClose={() => setEditingQuestion(null)}
                onSave={handleSaveQuestion}
                question={editingQuestion}
            />
        </Modal>
    );
};

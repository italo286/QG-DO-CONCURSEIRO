
import React, { useState, useEffect, useCallback } from 'react';
import { SubTopic, Question, MiniGame } from '../../types';
import { Modal, Button } from '../ui';
import { GeminiIcon, GameControllerIcon, PencilIcon, TrashIcon, ExclamationTriangleIcon, CheckBadgeIcon } from '../Icons';
import { AiQuestionGeneratorModal } from './AiQuestionGeneratorModal';
import { ProfessorGameEditorModal } from './ProfessorGameEditorModal';
import { ContentLinksEditor } from './ContentLinksEditor';
import { ProfessorFlashcardEditorModal } from './ProfessorFlashcardEditorModal';
import { GlossaryEditor } from './GlossaryEditor';
import { BankProfileEditor } from './BankProfileEditor';
import { AiBulkGameGeneratorModal } from './AiBulkGameGeneratorModal';
import { ProfessorQuestionEditorModal } from './ProfessorQuestionEditorModal';
import { AiTecJustificationModal } from './AiTecJustificationModal';

export const ProfessorSubTopicEditor: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (subtopic: SubTopic) => void;
    subtopic: SubTopic | null;
}> = ({ isOpen, onClose, onSave, subtopic }) => {
    const [editingSubTopic, setEditingSubTopic] = useState<SubTopic | null>(null);
    const [localName, setLocalName] = useState('');
    const [localDescription, setLocalDescription] = useState('');
    const [localMindMapUrl, setLocalMindMapUrl] = useState('');

    const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
    const [isTecModalOpen, setIsTecModalOpen] = useState(false);
    const [isTecJustificationModalOpen, setIsTecJustificationModalOpen] = useState(false);
    const [isGameModalOpen, setIsGameModalOpen] = useState(false);
    const [editingGame, setEditingGame] = useState<MiniGame | null>(null);
    const [isFlashcardModalOpen, setIsFlashcardModalOpen] = useState(false);
    const [isGlossaryModalOpen, setIsGlossaryModalOpen] = useState(false);
    const [isBulkGameModalOpen, setIsBulkGameModalOpen] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

    useEffect(() => {
        if (isOpen) {
            const initialSubTopic = subtopic || { id: '', name: '', description: '', fullPdfs: [], summaryPdfs: [], videoUrls: [], questions: [], miniGames: [], flashcards: [], glossary: [] };
            setEditingSubTopic(initialSubTopic);
            setLocalName(initialSubTopic.name);
            setLocalDescription(initialSubTopic.description || '');
            setLocalMindMapUrl(initialSubTopic.mindMapUrl || '');
        } else {
            setEditingSubTopic(null);
        }
    }, [isOpen, subtopic]);

    const handleSave = () => {
        if (editingSubTopic) {
            if (!localName.trim()) {
                alert("O nome do subtópico é obrigatório.");
                return;
            }
            const finalSubTopic = { 
                ...editingSubTopic, 
                name: localName,
                description: localDescription,
                mindMapUrl: localMindMapUrl,
                id: editingSubTopic.id || `st${Date.now()}` 
            };
            onSave(finalSubTopic);
            onClose();
        }
    };
    
    const saveGeneratedQuestions = (questions: Omit<Question, 'id'>[], isTecExtraction: boolean) => {
        const newQuestions = questions.map(q => ({...q, id: `q${Date.now()}${Math.random()}`, isTec: isTecExtraction }));
        setEditingSubTopic(prev => {
            if (!prev) return prev;
            if (isTecExtraction) {
                return {...prev, tecQuestions: [...(prev.tecQuestions || []), ...newQuestions] }
            } else {
                return {...prev, questions: [...prev.questions, ...newQuestions]}
            }
        });
    };

    const handleApplyTecJustifications = (justifications: string[]) => {
        setEditingSubTopic(prev => {
            if (!prev || !prev.tecQuestions) return prev;
            const updatedTecQuestions = prev.tecQuestions.map((q, idx) => ({
                ...q,
                justification: justifications[idx],
                commentSource: 'tec' as const
            }));
            return { ...prev, tecQuestions: updatedTecQuestions };
        });
    };
    
    const handleDeleteQuestion = (questionId: string, isTec: boolean) => {
        if (!editingSubTopic || !window.confirm("Tem certeza que deseja apagar esta questão?")) return;
        let updatedQuestions;
        if (isTec) {
            updatedQuestions = (editingSubTopic.tecQuestions || []).filter(q => q.id !== questionId);
            setEditingSubTopic({ ...editingSubTopic, tecQuestions: updatedQuestions });
        } else {
            updatedQuestions = editingSubTopic.questions.filter(q => q.id !== questionId);
            setEditingSubTopic({ ...editingSubTopic, questions: updatedQuestions });
        }
    };

    const handleSaveQuestion = (questionToSave: Question) => {
        if (!editingSubTopic) return;
        const isTec = (editingSubTopic.tecQuestions || []).some(q => q.id === questionToSave.id);
        if (isTec) {
            const updatedQuestions = (editingSubTopic.tecQuestions || []).map(q => q.id === questionToSave.id ? questionToSave : q);
            setEditingSubTopic({ ...editingSubTopic, tecQuestions: updatedQuestions });
        } else {
            const updatedQuestions = editingSubTopic.questions.map(q => q.id === questionToSave.id ? questionToSave : q);
            setEditingSubTopic({ ...editingSubTopic, questions: updatedQuestions });
        }
        setEditingQuestion(null);
    };

    const handleResolveReport = (questionId: string) => {
        setEditingSubTopic(prev => {
            if (!prev) return null;
            
            const updatedSubTopic = { ...prev };
            updatedSubTopic.questions = updatedSubTopic.questions.map(q => {
                if (q.id === questionId) {
                    const { reportInfo, ...rest } = q;
                    return rest;
                }
                return q;
            });
    
            if (updatedSubTopic.tecQuestions) {
                updatedSubTopic.tecQuestions = updatedSubTopic.tecQuestions.map(q => {
                    if (q.id === questionId) {
                        const { reportInfo, ...rest } = q;
                        return rest;
                    }
                    return q;
                });
            }
    
            return updatedSubTopic;
        });
    };

    const handleOpenGameModal = (game: MiniGame | null) => {
        setEditingGame(game);
        setIsGameModalOpen(true);
    };

    const handleSaveGame = (gameToSave: MiniGame) => {
        if (!editingSubTopic) return;
        const isEditing = editingSubTopic.miniGames.some(g => g.id === gameToSave.id);
        const updatedGames = isEditing
            ? editingSubTopic.miniGames.map(g => (g.id === gameToSave.id ? gameToSave : g))
            : [...editingSubTopic.miniGames, gameToSave];
        setEditingSubTopic({ ...editingSubTopic, miniGames: updatedGames });
    };
    
    const handleSaveBulkGames = (games: MiniGame[]) => {
        if (!editingSubTopic) return;
        const newGames = [...editingSubTopic.miniGames, ...games];
        setEditingSubTopic({ ...editingSubTopic, miniGames: newGames });
    };

    const handleDeleteGame = (gameId: string) => {
        if (!editingSubTopic || !window.confirm("Tem certeza que deseja apagar este jogo?")) return;
        const updatedGames = editingSubTopic.miniGames.filter(g => g.id !== gameId);
        setEditingSubTopic({ ...editingSubTopic, miniGames: updatedGames });
    };

    const handleBulkDelete = (
        contentType: 'questions' | 'tecQuestions' | 'miniGames' | 'flashcards' | 'glossary',
        contentName: string
    ) => {
        if (!editingSubTopic) return;
        if (window.confirm(`Tem certeza de que deseja excluir permanentemente todo o conteúdo de "${contentName}" deste subtópico? Esta ação não pode ser desfeita.`)) {
            setEditingSubTopic(prev => {
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

    if (!isOpen || !editingSubTopic) return null;
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={subtopic?.id ? "Editar Subtópico" : "Novo Subtópico"} size="4xl">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <div>
                        <label htmlFor="subtopic-name" className="block text-sm font-medium text-gray-300">Nome do Subtópico</label>
                        <input id="subtopic-name" type="text" value={localName} onChange={e => setLocalName(e.target.value)} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white"/>
                    </div>
                     <div>
                        <label htmlFor="subtopic-desc" className="block text-sm font-medium text-gray-300">Descrição</label>
                        <textarea id="subtopic-desc" value={localDescription} onChange={e => setLocalDescription(e.target.value)} rows={3} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white"/>
                    </div>
                    <ContentLinksEditor content={editingSubTopic} setContent={setEditingSubTopic} />
                     <div>
                        <label htmlFor="subtopic-mindmap-url" className="block text-sm font-medium text-gray-300">Mapa Mental (URL da Imagem)</label>
                        <input
                            id="subtopic-mindmap-url"
                            type="url"
                            value={localMindMapUrl}
                            onChange={e => setLocalMindMapUrl(e.target.value)}
                            placeholder="https://exemplo.com/mapa.png"
                            className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white"
                        />
                    </div>
                    <BankProfileEditor
                        bankProfilePdfs={editingSubTopic.bankProfilePdfs || []}
                        onUpdatePdfs={(pdfs) => {
                            setEditingSubTopic(prev => prev ? { ...prev, bankProfilePdfs: pdfs } : null);
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
                        </div>
                    </div>
                     <div className="p-4 bg-gray-900/50 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-semibold text-gray-300">Questões (Conteúdo) ({editingSubTopic.questions.length})</h4>
                            <button onClick={() => handleBulkDelete('questions', 'Questões (Conteúdo)')} className="p-1 text-gray-400 hover:text-red-400" title="Excluir todas as questões de conteúdo"><TrashIcon className="h-4 w-4" /></button>
                        </div>
                        <ul className="space-y-2 max-h-40 overflow-y-auto text-sm pr-2">
                             {editingSubTopic.questions.map((q, i) => (
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
                            <h4 className="font-semibold text-gray-300">Questões (Extraídas do TEC) ({(editingSubTopic.tecQuestions || []).length})</h4>
                            <div className="flex gap-2">
                                {editingSubTopic.tecQuestions && editingSubTopic.tecQuestions.length > 0 && (
                                    <button 
                                        onClick={() => setIsTecJustificationModalOpen(true)}
                                        className="text-[10px] font-black uppercase text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                                        title="Importar Justificativas LaTeX"
                                    >
                                        <GeminiIcon className="h-3 w-3" /> JUSTIF.
                                    </button>
                                )}
                                <button onClick={() => handleBulkDelete('tecQuestions', 'Questões (TEC)')} className="p-1 text-gray-400 hover:text-red-400" title="Excluir todas as questões do TEC"><TrashIcon className="h-4 w-4" /></button>
                            </div>
                        </div>
                        <ul className="space-y-2 max-h-40 overflow-y-auto text-sm pr-2">
                            {(editingSubTopic.tecQuestions || []).map((q, i) => (
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
                            <h4 className="font-semibold text-gray-300">Mini-Jogos ({editingSubTopic.miniGames.length})</h4>
                            <button onClick={() => handleBulkDelete('miniGames', 'Mini-Jogos')} className="p-1 text-gray-400 hover:text-red-400" title="Excluir todos os jogos"><TrashIcon className="h-4 w-4" /></button>
                        </div>
                        <ul className="space-y-1 max-h-40 overflow-y-auto text-sm pr-2">
                            {editingSubTopic.miniGames.map(game => (
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
                           <h4 className="font-semibold text-gray-300">Flashcards ({editingSubTopic.flashcards?.length || 0})</h4>
                           <div>
                               <button onClick={() => handleBulkDelete('flashcards', 'Flashcards')} className="p-1 text-gray-400 hover:text-red-400" title="Excluir todos os flashcards"><TrashIcon className="h-4 w-4" /></button>
                               <Button onClick={() => setIsFlashcardModalOpen(true)} className="text-xs py-1 px-2 ml-2">
                                   <PencilIcon className="h-3 w-3 mr-1"/> Gerenciar
                               </Button>
                           </div>
                        </div>
                        <ul className="space-y-1 max-h-40 overflow-y-auto text-sm pr-2">
                           {(editingSubTopic.flashcards || []).map((fc, i) => <li key={fc.id} className="truncate p-1 bg-gray-700/50 rounded">{i+1}. {fc.front}</li>)}
                        </ul>
                    </div>
                    <div className="p-4 bg-gray-900/50 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                           <h4 className="font-semibold text-gray-300">Glossário ({editingSubTopic.glossary?.length || 0})</h4>
                           <div>
                               <button onClick={() => handleBulkDelete('glossary', 'Glossário')} className="p-1 text-gray-400 hover:text-red-400" title="Excluir todo o glossário"><TrashIcon className="h-4 w-4" /></button>
                               <Button onClick={() => setIsGlossaryModalOpen(true)} className="text-xs py-1 px-2 ml-2">
                                   <PencilIcon className="h-3 w-3 mr-1"/> Gerenciar
                               </Button>
                           </div>
                        </div>
                         <ul className="space-y-1 max-h-40 overflow-y-auto text-sm pr-2">
                           {(editingSubTopic.glossary || []).map((g, i) => <li key={i} className="truncate p-1 bg-gray-700/50 rounded">{i+1}. {g.term}</li>)}
                        </ul>
                    </div>
                </div>
            </div>
            <div className="mt-8 pt-4 border-t border-gray-700 flex justify-end">
                <Button onClick={handleSave}>Salvar Subtópico</Button>
            </div>

            <AiQuestionGeneratorModal isOpen={isQuestionModalOpen} onClose={handleCloseQuestionModal} onSaveQuestions={saveGeneratedQuestions} isTecExtraction={false} />
            <AiQuestionGeneratorModal isOpen={isTecModalOpen} onClose={handleCloseTecModal} onSaveQuestions={saveGeneratedQuestions} isTecExtraction={true} />
            
            <AiTecJustificationModal 
                isOpen={isTecJustificationModalOpen} 
                onClose={() => setIsTecJustificationModalOpen(false)} 
                onApply={handleApplyTecJustifications}
                questionCount={editingSubTopic.tecQuestions?.length || 0}
            />

            <ProfessorGameEditorModal isOpen={isGameModalOpen} onClose={handleCloseGameModal} onSave={handleSaveGame} game={editingGame} />
            <AiBulkGameGeneratorModal 
                isOpen={isBulkGameModalOpen}
                onClose={handleCloseBulkGameModal}
                onSave={handleSaveBulkGames}
            />
            <ProfessorFlashcardEditorModal 
                isOpen={isFlashcardModalOpen} 
                onClose={handleCloseFlashcardModal} 
                onSave={(flashcards) => setEditingSubTopic(prev => prev ? {...prev, flashcards} : prev)}
                initialFlashcards={editingSubTopic.flashcards || []}
            />
             <GlossaryEditor
                isOpen={isGlossaryModalOpen}
                onClose={handleCloseGlossaryModal}
                onSave={(glossary) => setEditingSubTopic(prev => prev ? { ...prev, glossary } : prev)}
                initialGlossary={editingSubTopic.glossary || []}
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

import React, { useState, useEffect } from 'react';
import { Flashcard } from '../../types';
import { fileToBase64 } from '../../utils';
import * as GeminiService from '../../services/geminiService';
import { Modal, Button, Spinner } from '../ui';
import { GeminiIcon, TrashIcon, PlusIcon } from '../Icons';

const FlashcardItem: React.FC<{
    card: Flashcard;
    index: number;
    onUpdate: (id: string, field: 'front' | 'back', value: string) => void;
    onRemove: (id: string) => void;
}> = ({ card, index, onUpdate, onRemove }) => {
    const [front, setFront] = useState(card.front);
    const [back, setBack] = useState(card.back);

    useEffect(() => {
        setFront(card.front);
        setBack(card.back);
    }, [card]);

    return (
        <div className="p-4 bg-gray-900/50 rounded-lg space-y-2">
            <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-400">Card {index + 1}</span>
                <button onClick={() => onRemove(card.id)} className="text-red-500 hover:text-red-400"><TrashIcon className="h-5 w-5"/></button>
            </div>
            <textarea 
                value={front}
                onChange={e => setFront(e.target.value)}
                onBlur={() => onUpdate(card.id, 'front', front)}
                placeholder="Frente (Termo/Pergunta)"
                rows={2}
                className="block w-full bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white"
            />
            <textarea 
                value={back}
                onChange={e => setBack(e.target.value)}
                onBlur={() => onUpdate(card.id, 'back', back)}
                placeholder="Verso (Definição/Resposta)"
                rows={3}
                className="block w-full bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white"
            />
        </div>
    );
};


export const ProfessorFlashcardEditorModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (flashcards: Flashcard[]) => void;
    initialFlashcards: Flashcard[];
}> = ({ isOpen, onClose, onSave, initialFlashcards }) => {
    const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('manual');
    const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
    
    // AI Tab State
    const [file, setFile] = useState<File | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');
    const [generatedFlashcards, setGeneratedFlashcards] = useState<Omit<Flashcard, 'id'>[]>([]);

    useEffect(() => {
        if (isOpen) {
            setFlashcards(initialFlashcards);
            // Reset AI tab state
            setActiveTab('manual');
            setFile(null);
            setError('');
            setGeneratedFlashcards([]);
        }
    }, [isOpen, initialFlashcards]);

    const handleUpdateCard = (id: string, field: 'front' | 'back', value: string) => {
        setFlashcards(prev => prev.map(card => card.id === id ? { ...card, [field]: value } : card));
    };

    const handleAddCard = () => {
        setFlashcards(prev => [...prev, { id: `fc-${Date.now()}`, front: '', back: '' }]);
    };

    const handleRemoveCard = (id: string) => {
        setFlashcards(prev => prev.filter(card => card.id !== id));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };
    
    const handleGenerate = async () => {
        if (!file) {
            setError('Por favor, selecione um arquivo PDF.');
            return;
        }
        setError('');
        setIsGenerating(true);
        setGeneratedFlashcards([]);

        try {
            const base64 = await fileToBase64(file);
            const cards = await GeminiService.generateFlashcardsFromPdf(base64);
            setGeneratedFlashcards(cards);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsGenerating(false);
        }
    };
    
    const addGeneratedToManualList = () => {
        const newFlashcards = generatedFlashcards.map(fc => ({...fc, id: `fc-${Date.now()}-${Math.random()}`}));
        setFlashcards(prev => [...prev, ...newFlashcards]);
        setGeneratedFlashcards([]);
        setActiveTab('manual');
    }

    const handleSave = () => {
        const newGeneratedFlashcardsWithIds = generatedFlashcards.map(fc => ({
            ...fc,
            id: `fc-${Date.now()}-${Math.random()}`
        }));
        
        const combinedFlashcards = [...flashcards, ...newGeneratedFlashcardsWithIds];
        const validFlashcards = combinedFlashcards.filter(fc => fc.front.trim() && fc.back.trim());

        onSave(validFlashcards);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Gerenciar Flashcards" size="3xl">
            <div className="flex border-b border-gray-700 mb-4" role="tablist">
                <button 
                    onClick={() => setActiveTab('manual')} 
                    className={`flex-1 py-2 text-sm font-medium ${activeTab === 'manual' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:text-white'}`}
                    role="tab" aria-selected={activeTab === 'manual'}
                >
                    Edição Manual ({flashcards.length})
                </button>
                <button 
                    onClick={() => setActiveTab('ai')} 
                    className={`flex-1 py-2 text-sm font-medium ${activeTab === 'ai' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:text-white'}`}
                    role="tab" aria-selected={activeTab === 'ai'}
                >
                    Gerar com IA
                </button>
            </div>

            {activeTab === 'manual' && (
                <div className="space-y-4">
                    <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                        {flashcards.map((card, index) => (
                           <FlashcardItem
                                key={card.id}
                                card={card}
                                index={index}
                                onUpdate={handleUpdateCard}
                                onRemove={handleRemoveCard}
                           />
                        ))}
                    </div>
                    <Button onClick={handleAddCard} className="text-sm py-2 px-3"><PlusIcon className="h-4 w-4 mr-2"/> Adicionar Card</Button>
                </div>
            )}

            {activeTab === 'ai' && (
                <div className="space-y-4">
                     <p className="text-gray-400 text-sm">Faça o upload de um PDF com o conteúdo da matéria. A IA irá analisá-lo e criar flashcards para você.</p>
                     <div className="flex items-center space-x-4">
                        <label className="cursor-pointer bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md">
                            <span>Selecionar PDF</span>
                            <input type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
                        </label>
                        {file && <span className="text-gray-300 truncate">{file.name}</span>}
                    </div>
                     <div className="text-center">
                        <Button onClick={handleGenerate} disabled={isGenerating || !file}>
                            {isGenerating ? <Spinner /> : <><GeminiIcon className="h-5 w-5 mr-2" /> Gerar Flashcards</>}
                        </Button>
                    </div>
                    {error && <p className="text-red-400 text-sm text-center" role="alert">{error}</p>}

                     {generatedFlashcards.length > 0 && (
                        <div className="border-t border-gray-700 pt-4 space-y-4">
                            <h3 className="text-lg font-semibold">{generatedFlashcards.length} Flashcards Gerados</h3>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                {generatedFlashcards.map((fc, index) => (
                                    <div key={index} className="p-3 bg-gray-900/50 rounded-lg text-sm">
                                        <p className="font-semibold text-cyan-400">Frente:</p>
                                        <p>{fc.front}</p>
                                        <p className="font-semibold text-cyan-400 mt-2">Verso:</p>
                                        <p>{fc.back}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="pt-2 flex justify-end">
                                <Button onClick={addGeneratedToManualList}>
                                    Adicionar à Lista para Edição
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="mt-6 pt-4 border-t border-gray-700 flex justify-end">
                <Button onClick={handleSave}>Salvar Flashcards</Button>
            </div>
        </Modal>
    );
};
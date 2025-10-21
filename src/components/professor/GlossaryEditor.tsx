import React, { useState, useEffect } from 'react';
import { GlossaryTerm } from '../../types';
import { fileToBase64 } from '../../utils';
import * as GeminiService from '../../services/geminiService';
import { Modal, Button, Spinner } from '../ui';
import { GeminiIcon, TrashIcon, PlusIcon } from '../Icons';

const GlossaryTermItem: React.FC<{
    item: GlossaryTerm;
    index: number;
    onUpdate: (index: number, field: 'term' | 'definition', value: string) => void;
    onRemove: (index: number) => void;
}> = ({ item, index, onUpdate, onRemove }) => {
    const [term, setTerm] = useState(item.term);
    const [definition, setDefinition] = useState(item.definition);

    useEffect(() => {
        setTerm(item.term);
        setDefinition(item.definition);
    }, [item]);

    return (
        <div className="p-4 bg-gray-900/50 rounded-lg space-y-2">
            <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-400">Termo {index + 1}</span>
                <button onClick={() => onRemove(index)} className="text-red-500 hover:text-red-400"><TrashIcon className="h-5 w-5"/></button>
            </div>
            <input
                value={term}
                onChange={e => setTerm(e.target.value)}
                onBlur={() => onUpdate(index, 'term', term)}
                placeholder="Termo ou Conceito"
                className="block w-full bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white font-semibold"
            />
            <textarea 
                value={definition}
                onChange={e => setDefinition(e.target.value)}
                onBlur={() => onUpdate(index, 'definition', definition)}
                placeholder="Definição"
                rows={3}
                className="block w-full bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white"
            />
        </div>
    );
};


export const GlossaryEditor: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (glossary: GlossaryTerm[]) => void;
    initialGlossary: GlossaryTerm[];
}> = ({ isOpen, onClose, onSave, initialGlossary }) => {
    const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('manual');
    const [glossary, setGlossary] = useState<GlossaryTerm[]>([]);
    
    // AI Tab State
    const [file, setFile] = useState<File | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');
    const [generatedGlossary, setGeneratedGlossary] = useState<GlossaryTerm[]>([]);

    useEffect(() => {
        if (isOpen) {
            setGlossary(initialGlossary);
            setActiveTab('manual');
            setFile(null);
            setError('');
            setGeneratedGlossary([]);
        }
    }, [isOpen, initialGlossary]);

    const handleUpdateTerm = (index: number, field: 'term' | 'definition', value: string) => {
        setGlossary(prev => {
            const newGlossary = [...prev];
            newGlossary[index] = { ...newGlossary[index], [field]: value };
            return newGlossary;
        });
    };

    const handleAddTerm = () => {
        setGlossary(prev => [...prev, { term: '', definition: '' }]);
    };

    const handleRemoveTerm = (index: number) => {
        setGlossary(prev => prev.filter((_, i) => i !== index));
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
        setGeneratedGlossary([]);

        try {
            const base64 = await fileToBase64(file);
            const terms = await GeminiService.generateGlossaryFromPdf(base64);
            setGeneratedGlossary(terms);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsGenerating(false);
        }
    };
    
    const addGeneratedToManualList = () => {
        setGlossary(prev => [...prev, ...generatedGlossary]);
        setGeneratedGlossary([]);
        setActiveTab('manual');
    }

    const handleSave = () => {
        const combinedGlossary = [...glossary, ...generatedGlossary];
        const validGlossary = combinedGlossary.filter(g => g.term.trim() && g.definition.trim());
        onSave(validGlossary);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Gerenciar Glossário" size="3xl">
            <div className="flex border-b border-gray-700 mb-4" role="tablist">
                <button 
                    onClick={() => setActiveTab('manual')} 
                    className={`flex-1 py-2 text-sm font-medium ${activeTab === 'manual' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:text-white'}`}
                    role="tab" aria-selected={activeTab === 'manual'}
                >
                    Edição Manual ({glossary.length})
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
                        {glossary.map((item, index) => (
                           <GlossaryTermItem
                                key={index}
                                item={item}
                                index={index}
                                onUpdate={handleUpdateTerm}
                                onRemove={handleRemoveTerm}
                           />
                        ))}
                    </div>
                    <Button onClick={handleAddTerm} className="text-sm py-2 px-3"><PlusIcon className="h-4 w-4 mr-2"/> Adicionar Termo</Button>
                </div>
            )}

            {activeTab === 'ai' && (
                <div className="space-y-4">
                     <p className="text-gray-400 text-sm">Faça o upload de um PDF com o conteúdo da matéria. A IA irá analisá-lo e criar um glossário para você.</p>
                     <div className="flex items-center space-x-4">
                        <label className="cursor-pointer bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md">
                            <span>Selecionar PDF</span>
                            <input type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
                        </label>
                        {file && <span className="text-gray-300 truncate">{file.name}</span>}
                    </div>
                     <div className="text-center">
                        <Button onClick={handleGenerate} disabled={isGenerating || !file}>
                            {isGenerating ? <Spinner /> : <><GeminiIcon className="h-5 w-5 mr-2" /> Gerar Glossário</>}
                        </Button>
                    </div>
                    {error && <p className="text-red-400 text-sm text-center" role="alert">{error}</p>}

                     {generatedGlossary.length > 0 && (
                        <div className="border-t border-gray-700 pt-4 space-y-4">
                            <h3 className="text-lg font-semibold">{generatedGlossary.length} Termos Gerados</h3>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                {generatedGlossary.map((item, index) => (
                                    <div key={index} className="p-3 bg-gray-900/50 rounded-lg text-sm">
                                        <p className="font-semibold text-cyan-400">{item.term}</p>
                                        <p>{item.definition}</p>
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
                <Button onClick={handleSave}>Salvar Glossário</Button>
            </div>
        </Modal>
    );
};

import React, { useState, useEffect } from 'react';
import * as GeminiService from '../../services/geminiService';
import { Topic, SubTopic } from '../../types';
import { Modal, Button, Spinner, Card } from '../ui';
import { GeminiIcon, TrashIcon, PlusIcon } from '../Icons';

interface TopicBlock {
    id: string;
    topicName: string;
    genericSubtopicName: string;
    rawLinks: string;
    generationMode: 'standard' | 'replication';
}

interface AiBulkTopicContentGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (items: any[]) => void;
    mode?: 'topic' | 'subtopic';
}

export const AiBulkTopicContentGeneratorModal: React.FC<AiBulkTopicContentGeneratorModalProps> = ({ 
    isOpen, 
    onClose, 
    onSave,
    mode = 'topic'
}) => {
    const isSubtopicMode = mode === 'subtopic';
    
    const [blocks, setBlocks] = useState<TopicBlock[]>([
        { id: '1', topicName: '', genericSubtopicName: '', rawLinks: '', generationMode: 'standard' }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [previewData, setPreviewData] = useState<{ blockId: string, items: any[] }[] | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setBlocks([{ id: '1', topicName: '', genericSubtopicName: '', rawLinks: '', generationMode: 'standard' }]);
            setError('');
            setIsLoading(false);
            setPreviewData(null);
        }
    }, [isOpen]);

    const addBlock = () => {
        setBlocks([...blocks, { 
            id: Date.now().toString(), 
            topicName: '', 
            genericSubtopicName: '', 
            rawLinks: '', 
            generationMode: 'standard' 
        }]);
    };

    const removeBlock = (id: string) => {
        if (blocks.length > 1) {
            setBlocks(blocks.filter(b => b.id !== id));
        }
    };

    const updateBlock = (id: string, field: keyof TopicBlock, value: any) => {
        setBlocks(blocks.map(b => b.id === id ? { ...b, [field]: value } : b));
    };

    const handleGeneratePreview = async () => {
        const invalidBlock = blocks.find(b => !b.rawLinks.trim() || (!isSubtopicMode && !b.topicName.trim()) || !b.genericSubtopicName.trim());
        if (invalidBlock) {
            setError(`Preencha todos os campos obrigatórios em todos os blocos.`);
            return;
        }

        setError('');
        setIsLoading(true);
        try {
            const results = [];
            for (const block of blocks) {
                const data = await GeminiService.parseBulkTopicContent(block.genericSubtopicName, block.rawLinks, block.generationMode === 'replication');
                results.push({ blockId: block.id, items: data });
            }
            setPreviewData(results);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFinalSave = () => {
        if (!previewData) return;

        const timestamp = Date.now();
        
        if (isSubtopicMode) {
            const block = blocks[0];
            const data = previewData[0].items;
            const subtopics = data.map((item, i) => {
                const id = `st-bulk-${timestamp}-${i}`;
                const extractedName = item.video?.name || item.fullPdf?.name || `${block.genericSubtopicName} - Aula ${String(i + 1).padStart(2, '0')}`;
                return {
                    id,
                    name: extractedName,
                    description: `Conteúdo de ${extractedName}`,
                    fullPdfs: item.fullPdf ? [{ id: `pdf-f-${id}`, fileName: item.fullPdf.name, url: item.fullPdf.url }] : [],
                    summaryPdfs: item.summaryPdf ? [{ id: `pdf-s-${id}`, fileName: item.summaryPdf.name, url: item.summaryPdf.url }] : [],
                    videoUrls: item.video ? [{ id: `vid-${id}`, name: item.video.name, url: item.video.url }] : [],
                    questions: [],
                    tecQuestions: [],
                    miniGames: [],
                    flashcards: [],
                    glossary: [],
                    raioXPdfs: []
                };
            });
            onSave(subtopics);
        } else {
            const topics: Topic[] = blocks.map((block, blockIdx) => {
                const topicId = `t-bulk-${timestamp}-${blockIdx}`;
                const blockData = previewData.find(p => p.blockId === block.id)?.items || [];
                
                return {
                    id: topicId,
                    name: block.topicName,
                    description: `Aulas de ${block.topicName}`,
                    fullPdfs: [],
                    summaryPdfs: [],
                    raioXPdfs: [],
                    videoUrls: [],
                    questions: [],
                    tecQuestions: [],
                    miniGames: [],
                    flashcards: [],
                    glossary: [],
                    subtopics: blockData.map((item, subIdx) => {
                        const subId = `st-bulk-${timestamp}-${blockIdx}-${subIdx}`;
                        const extractedName = item.video?.name || item.fullPdf?.name || `${block.genericSubtopicName} - Aula ${String(subIdx + 1).padStart(2, '0')}`;
                        return {
                            id: subId,
                            name: extractedName,
                            description: `Conteúdo de ${extractedName}`,
                            fullPdfs: item.fullPdf ? [{ id: `pdf-f-${subId}`, fileName: item.fullPdf.name, url: item.fullPdf.url }] : [],
                            summaryPdfs: item.summaryPdf ? [{ id: `pdf-s-${subId}`, fileName: item.summaryPdf.name, url: item.summaryPdf.url }] : [],
                            videoUrls: item.video ? [{ id: `vid-${subId}`, name: item.video.name, url: item.video.url }] : [],
                            questions: [],
                            tecQuestions: [],
                            miniGames: [],
                            flashcards: [],
                            glossary: [],
                            raioXPdfs: []
                        } as SubTopic;
                    })
                };
            });
            onSave(topics);
        }
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isSubtopicMode ? "Gerar Subtópicos em Massa" : "Gerar Tópicos em Massa"} size="4xl">
            <div className="space-y-6">
                {!previewData && (
                    <>
                        <p className="text-gray-400 text-sm">
                            Configure os blocos de conteúdo abaixo. A IA irá detectar e limpar automaticamente o nome das aulas a partir dos links colados.
                        </p>

                        <div className="space-y-8">
                            {blocks.map((block, index) => (
                                <Card key={block.id} className="p-4 border-cyan-500/20 bg-gray-900/30 relative">
                                    {blocks.length > 1 && (
                                        <button 
                                            onClick={() => removeBlock(block.id)}
                                            className="absolute top-2 right-2 p-1 text-red-500 hover:bg-red-500/10 rounded"
                                            title="Remover este bloco"
                                        >
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                    )}
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {!isSubtopicMode && (
                                            <div>
                                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Título do Tópico Principal</label>
                                                <input 
                                                    type="text" 
                                                    value={block.topicName} 
                                                    onChange={e => updateBlock(block.id, 'topicName', e.target.value)} 
                                                    placeholder="Ex: Noções de Gramática"
                                                    className="w-full bg-gray-800 border border-gray-700 rounded-md py-2 px-3 text-white focus:ring-cyan-500" 
                                                />
                                            </div>
                                        )}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Assunto Base (Backup de Nome)</label>
                                            <input 
                                                type="text" 
                                                value={block.genericSubtopicName} 
                                                onChange={e => updateBlock(block.id, 'genericSubtopicName', e.target.value)} 
                                                placeholder="Ex: Fonética"
                                                className="w-full bg-gray-800 border border-gray-700 rounded-md py-2 px-3 text-white focus:ring-cyan-500" 
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-6 items-center bg-gray-800/50 p-3 rounded-lg">
                                        <div className="flex flex-col">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1">Modo de Geração</label>
                                            <div className="flex gap-4">
                                                <label className="flex items-center space-x-2 cursor-pointer">
                                                    <input type="radio" checked={block.generationMode === 'standard'} onChange={() => updateBlock(block.id, 'generationMode', 'standard')} className="text-cyan-500" />
                                                    <span className="text-xs text-gray-300">Padrão</span>
                                                </label>
                                                <label className="flex items-center space-x-2 cursor-pointer">
                                                    <input type="radio" checked={block.generationMode === 'replication'} onChange={() => updateBlock(block.id, 'generationMode', 'replication')} className="text-cyan-500" />
                                                    <span className="text-xs text-gray-300">Replicação de PDFs</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4">
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Lista de Links com Nomes</label>
                                        <textarea 
                                            value={block.rawLinks} 
                                            onChange={e => updateBlock(block.id, 'rawLinks', e.target.value)} 
                                            rows={5}
                                            placeholder="Cole aqui: Vídeo 1 - Nome da Aula https://link..."
                                            className="w-full bg-gray-800 border border-gray-700 rounded-md py-2 px-3 text-white font-mono text-xs focus:ring-cyan-500" 
                                        />
                                    </div>
                                </Card>
                            ))}
                        </div>

                        {!isSubtopicMode && (
                            <button 
                                onClick={addBlock}
                                className="w-full py-3 border-2 border-dashed border-gray-700 rounded-xl text-gray-500 hover:text-cyan-400 hover:border-cyan-500/50 transition-all flex items-center justify-center font-bold"
                            >
                                <PlusIcon className="h-5 w-5 mr-2" /> ADICIONAR OUTRO TÓPICO
                            </button>
                        )}

                        <div className="text-center pt-4">
                            <Button onClick={handleGeneratePreview} disabled={isLoading} className="w-full md:w-auto px-12">
                                {isLoading ? <Spinner /> : <><GeminiIcon className="h-5 w-5 mr-2" /> Analisar e Gerar Prévia</>}
                            </Button>
                        </div>
                        {error && <p className="text-red-400 text-sm text-center" role="alert">{error}</p>}
                    </>
                )}

                {previewData && (
                    <div className="border-t border-gray-700 pt-4 space-y-6">
                        <h3 className="text-xl font-bold text-cyan-400">Prévia da Estrutura</h3>
                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                            {blocks.map((block) => {
                                const data = previewData.find(p => p.blockId === block.id)?.items || [];
                                return (
                                    <div key={block.id} className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                                        {!isSubtopicMode && (
                                            <div className="flex items-center gap-3 mb-4 border-b border-gray-700 pb-2">
                                                <h4 className="font-bold text-white uppercase text-sm">{block.topicName}</h4>
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            {data.map((item, idx) => {
                                                const aulaTitle = item.video?.name || item.fullPdf?.name || `${block.genericSubtopicName} - Aula ${idx + 1}`;
                                                return (
                                                    <div key={idx} className="p-2 pl-4 bg-gray-900/50 rounded border-l-2 border-cyan-500/30 text-xs">
                                                        <p className="font-bold text-gray-200">{aulaTitle}</p>
                                                        <div className="flex gap-4 mt-1 opacity-60">
                                                            <span>PDF: {item.fullPdf ? '✓' : '✗'}</span>
                                                            <span>Vídeo: {item.video ? '✓' : '✗'}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="pt-4 flex justify-between gap-4">
                            <Button onClick={() => setPreviewData(null)} className="bg-gray-700 hover:bg-gray-600 flex-1">Refazer</Button>
                            <Button onClick={handleFinalSave} className="flex-1">Criar Conteúdo</Button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

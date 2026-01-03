
import React, { useState, useEffect } from 'react';
import * as GeminiService from '../../services/geminiService';
import { Topic, SubTopic } from '../../types';
import { Modal, Button, Spinner, ColorPalettePicker } from '../ui';
import { GeminiIcon, CheckCircleIcon } from '../Icons';

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
    const [genericName, setGenericName] = useState('');
    const [rawLinks, setRawLinks] = useState('');
    const [selectedColor, setSelectedColor] = useState<string | undefined>(undefined);
    const [generationMode, setGenerationMode] = useState<'standard' | 'replication'>('standard');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [previewData, setPreviewData] = useState<any[] | null>(null);

    const isSubtopic = mode === 'subtopic';

    useEffect(() => {
        if (!isOpen) {
            setGenericName('');
            setRawLinks('');
            setSelectedColor(undefined);
            setGenerationMode('standard');
            setError('');
            setIsLoading(false);
            setPreviewData(null);
        }
    }, [isOpen]);

    const handleGeneratePreview = async () => {
        if (!genericName.trim() || !rawLinks.trim()) {
            setError(`Preencha o nome genérico e a lista de links para os ${isSubtopic ? 'subtópicos' : 'tópicos'}.`);
            return;
        }
        setError('');
        setIsLoading(true);
        try {
            const data = await GeminiService.parseBulkTopicContent(genericName, rawLinks, generationMode === 'replication');
            setPreviewData(data);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFinalSave = () => {
        if (!previewData) return;

        const timestamp = Date.now();
        const newItems = previewData.map((item, i) => {
            const prefix = isSubtopic ? 'st' : 't';
            const id = `${prefix}-bulk-${timestamp}-${i}`;
            const aulaSequence = String(i + 1).padStart(2, '0');
            
            const baseItem: any = {
                id: id,
                name: `${genericName} - Aula ${aulaSequence}`,
                description: `Conteúdo da Aula ${i + 1} sobre ${genericName}`,
                color: selectedColor,
                fullPdfs: item.fullPdf ? [{ id: `pdf-full-${id}`, fileName: item.fullPdf.name, url: item.fullPdf.url }] : [],
                summaryPdfs: item.summaryPdf ? [{ id: `pdf-sum-${id}`, fileName: item.summaryPdf.name, url: item.summaryPdf.url }] : [],
                raioXPdfs: [],
                videoUrls: item.video ? [{ id: `vid-${id}`, name: item.video.name, url: item.video.url }] : [],
                questions: [],
                tecQuestions: [],
                miniGames: [],
                flashcards: [],
                glossary: []
            };

            // Topics have subtopics array, Subtopics don't
            if (!isSubtopic) {
                baseItem.subtopics = [];
            }

            return baseItem;
        });

        onSave(newItems);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Gerar ${isSubtopic ? 'Subtópicos' : 'Aulas'} em Massa com IA`} size="3xl">
            <div className="space-y-4">
                <p className="text-gray-400 text-sm">
                    Esta ferramenta cria múltiplos {isSubtopic ? 'subtópicos' : 'tópicos'} de uma vez. A IA organizará os links para você.
                </p>

                <fieldset className="p-4 bg-gray-900/30 border border-gray-700 rounded-lg">
                    <legend className="px-2 text-xs font-bold text-cyan-400 uppercase tracking-widest">Modo de Operação</legend>
                    <div className="flex gap-6 mt-1">
                        <label className="flex items-center space-x-2 cursor-pointer group">
                            <input 
                                type="radio" 
                                name="gen-mode" 
                                value="standard" 
                                checked={generationMode === 'standard'} 
                                onChange={() => setGenerationMode('standard')}
                                className="h-4 w-4 text-cyan-500 bg-gray-700 border-gray-600 focus:ring-cyan-500"
                            />
                            <div className="flex flex-col">
                                <span className={`text-sm font-bold ${generationMode === 'standard' ? 'text-white' : 'text-gray-400'}`}>Modo Padrão</span>
                                <span className="text-[10px] text-gray-500">Pares únicos de PDF/Vídeo por aula.</span>
                            </div>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer group">
                            <input 
                                type="radio" 
                                name="gen-mode" 
                                value="replication" 
                                checked={generationMode === 'replication'} 
                                onChange={() => setGenerationMode('replication')}
                                className="h-4 w-4 text-cyan-500 bg-gray-700 border-gray-600 focus:ring-cyan-500"
                            />
                            <div className="flex flex-col">
                                <span className={`text-sm font-bold ${generationMode === 'replication' ? 'text-white' : 'text-gray-400'}`}>Modo Replicação</span>
                                <span className="text-[10px] text-gray-500">Um PDF base para vários vídeos.</span>
                            </div>
                        </label>
                    </div>
                </fieldset>
                
                <div className="flex gap-4 items-end">
                    <div className="flex-grow">
                        <label htmlFor="bulk-generic-name" className="block text-sm font-medium text-gray-300">Nome Genérico do Conteúdo</label>
                        <input 
                            id="bulk-generic-name"
                            type="text" 
                            value={genericName} 
                            onChange={e => setGenericName(e.target.value)} 
                            placeholder={isSubtopic ? "Ex: Conceitos Iniciais" : "Ex: Word 2010"}
                            className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-cyan-500 focus:border-cyan-500" 
                        />
                    </div>
                    <div className="flex flex-col items-center">
                        <label className="block text-xs font-medium text-gray-400 mb-1">Cor Base</label>
                        <ColorPalettePicker 
                            currentColor={selectedColor}
                            onColorSelect={setSelectedColor}
                        />
                    </div>
                </div>

                <div>
                    <label htmlFor="bulk-links-area" className="block text-sm font-medium text-gray-300">Lista de Nomes e Links</label>
                    <textarea 
                        id="bulk-links-area"
                        value={rawLinks} 
                        onChange={e => setRawLinks(e.target.value)} 
                        rows={8}
                        placeholder={generationMode === 'replication' 
                            ? "Cole aqui: 1 ou 2 PDFs (Material Original / Material Simplificado) e todos os vídeos das aulas." 
                            : "Cole aqui a lista de arquivos e links emparelhados."}
                        className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-cyan-500 focus:border-cyan-500 font-mono text-xs" 
                    />
                    {generationMode === 'replication' && (
                        <p className="mt-2 text-[10px] text-amber-400 italic">
                            * No modo replicação, a IA aplicará os PDFs base em todas as aulas criadas a partir dos vídeos encontrados.
                        </p>
                    )}
                </div>

                {!previewData && (
                    <div className="text-center">
                        <Button onClick={handleGeneratePreview} disabled={isLoading || !genericName.trim() || !rawLinks.trim()}>
                            {isLoading ? <Spinner /> : <><GeminiIcon className="h-5 w-5 mr-2" /> Analisar e Gerar Prévia</>}
                        </Button>
                    </div>
                )}

                {error && <p className="text-red-400 text-sm text-center" role="alert">{error}</p>}

                {previewData && (
                    <div className="border-t border-gray-700 pt-4 space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-cyan-400">Prévia dos {isSubtopic ? 'Subtópicos' : 'Tópicos'}</h3>
                            <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300 uppercase font-bold tracking-widest">{generationMode === 'replication' ? 'REPLICAÇÃO' : 'PADRÃO'}</span>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                            {previewData.map((item, idx) => (
                                <div key={idx} className="p-3 bg-gray-900/50 rounded-lg border border-gray-700 text-sm" style={selectedColor ? { borderLeft: `4px solid ${selectedColor}` } : {}}>
                                    <p className="font-bold text-white mb-2">{genericName} - Aula {String(idx + 1).padStart(2, '0')}</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <div className={item.fullPdf ? 'text-green-400' : 'text-gray-600'}>
                                                <span className="font-semibold">Original:</span> {item.fullPdf ? (generationMode === 'replication' ? 'PDF Replicado' : item.fullPdf.name) : 'Não'}
                                            </div>
                                            {item.summaryPdf && (
                                                <div className="text-emerald-500">
                                                    <span className="font-semibold">Resumo:</span> Replicado
                                                </div>
                                            )}
                                        </div>
                                        <div className={item.video ? 'text-blue-400' : 'text-gray-600'}>
                                            <span className="font-semibold">Vídeo:</span> {item.video ? item.video.name : 'Não detectado'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="pt-4 flex justify-between gap-4">
                            <Button onClick={() => setPreviewData(null)} className="bg-gray-700 hover:bg-gray-600 flex-1">Refazer Análise</Button>
                            <Button onClick={handleFinalSave} className="flex-1">Criar {previewData.length} {isSubtopic ? 'Subtópicos' : 'Aulas'}</Button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

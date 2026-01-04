
import React, { useState, useEffect } from 'react';
import * as GeminiService from '../../services/geminiService';
import { SubTopic } from '../../types';
import { Modal, Button, Spinner, Card } from '../ui';
import { GeminiIcon, ArrowRightIcon } from '../Icons';

interface AiBulkRenameModalProps {
    isOpen: boolean;
    onClose: () => void;
    subtopics: SubTopic[];
    onConfirm: (renamedSubtopics: SubTopic[]) => void;
}

export const AiBulkRenameModal: React.FC<AiBulkRenameModalProps> = ({ isOpen, onClose, subtopics, onConfirm }) => {
    const [rawText, setRawText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [preview, setPreview] = useState<{ id: string, oldName: string, newName: string }[] | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setRawText('');
            setPreview(null);
            setError('');
            setIsLoading(false);
        }
    }, [isOpen]);

    const handleProcess = async () => {
        if (!rawText.trim()) {
            setError('Por favor, cole a lista de nomes.');
            return;
        }

        setError('');
        setIsLoading(true);

        try {
            const cleanedNames = await GeminiService.cleanSubtopicNames(rawText);
            
            if (cleanedNames.length !== subtopics.length) {
                setError(`Diferença de contagem: Você tem ${subtopics.length} subtópicos, mas a IA extraiu ${cleanedNames.length} nomes. Por favor, verifique se a lista colada está correta.`);
                setIsLoading(false);
                return;
            }

            const previewData = subtopics.map((st, index) => ({
                id: st.id,
                oldName: st.name,
                newName: cleanedNames[index]
            }));

            setPreview(previewData);
        } catch (e: any) {
            setError(e.message || 'Erro ao processar nomes com IA.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleApply = () => {
        if (!preview) return;
        
        const updatedSubtopics = subtopics.map(st => {
            const renameInfo = preview.find(p => p.id === st.id);
            return renameInfo ? { ...st, name: renameInfo.newName } : st;
        });

        onConfirm(updatedSubtopics);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Renomear Subtópicos com IA" size="3xl">
            <div className="space-y-6">
                {!preview ? (
                    <>
                        <p className="text-gray-400 text-sm">
                            Cole a lista bruta de nomes (ex: extraída de um site ou PDF). A IA irá limpar os nomes, removendo numerações redundantes e emojis, mapeando-os 1-para-1 na ordem atual dos seus subtópicos.
                        </p>

                        <div className="bg-cyan-500/5 border border-cyan-500/20 p-4 rounded-xl">
                            <p className="text-xs font-black text-cyan-400 uppercase tracking-widest mb-2">Exemplo de Entrada:</p>
                            <pre className="text-[10px] text-gray-500 font-mono">
                                🎥 Vídeo 1 - Crase.mp4{"\n"}
                                🎥 Vídeo 2 - Pontuação.pdf{"\n"}
                                🎥 Vídeo 3 - Sintaxe Aula 05
                            </pre>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">
                                Cole aqui (Lista de {subtopics.length} itens):
                            </label>
                            <textarea 
                                value={rawText}
                                onChange={e => setRawText(e.target.value)}
                                rows={10}
                                placeholder="Cole a lista aqui..."
                                className="w-full bg-gray-900 border border-gray-700 rounded-xl py-3 px-4 text-white font-mono text-xs focus:ring-2 focus:ring-cyan-500 outline-none"
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400 text-xs text-center animate-shake">
                                {error}
                            </div>
                        )}

                        <div className="text-center pt-2">
                            <Button onClick={handleProcess} disabled={isLoading} className="w-full md:w-auto px-12">
                                {isLoading ? <Spinner /> : <><GeminiIcon className="h-5 w-5 mr-2" /> Analisar e Limpar Nomes</>}
                            </Button>
                        </div>
                    </>
                ) : (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold text-cyan-400">Confirmar Renomeação</h3>
                            <button onClick={() => setPreview(null)} className="text-xs font-bold text-gray-500 hover:text-white transition-colors">Refazer</button>
                        </div>

                        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                            {preview.map((item, idx) => (
                                <div key={item.id} className="grid grid-cols-11 items-center gap-3 p-3 bg-gray-900/50 rounded-xl border border-gray-800">
                                    <div className="col-span-1 text-[10px] font-black text-gray-600">#{idx + 1}</div>
                                    <div className="col-span-4 text-xs text-gray-500 truncate" title={item.oldName}>{item.oldName}</div>
                                    <div className="col-span-1 flex justify-center"><ArrowRightIcon className="h-4 w-4 text-cyan-500/50" /></div>
                                    <div className="col-span-5 text-sm font-bold text-white truncate">{item.newName}</div>
                                </div>
                            ))}
                        </div>

                        <div className="pt-4 flex gap-4">
                            <Button onClick={() => setPreview(null)} className="flex-1 bg-gray-700 hover:bg-gray-600 border-none">Cancelar</Button>
                            <Button onClick={handleApply} className="flex-2">Aplicar Novos Nomes</Button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

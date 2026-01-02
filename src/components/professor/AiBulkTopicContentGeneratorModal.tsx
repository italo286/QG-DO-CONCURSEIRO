
import React, { useState, useEffect } from 'react';
import * as GeminiService from '../../services/geminiService';
import { Topic, SubTopic } from '../../types';
import { Modal, Button, Spinner } from '../ui';
import { GeminiIcon, CheckCircleIcon } from '../Icons';

interface AiBulkTopicContentGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (topics: Topic[]) => void;
}

export const AiBulkTopicContentGeneratorModal: React.FC<AiBulkTopicContentGeneratorModalProps> = ({ isOpen, onClose, onSave }) => {
    const [genericName, setGenericName] = useState('');
    const [rawLinks, setRawLinks] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [previewData, setPreviewData] = useState<any[] | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setGenericName('');
            setRawLinks('');
            setError('');
            setIsLoading(false);
            setPreviewData(null);
        }
    }, [isOpen]);

    const handleGeneratePreview = async () => {
        if (!genericName.trim() || !rawLinks.trim()) {
            setError('Preencha o nome genérico e a lista de links.');
            return;
        }
        setError('');
        setIsLoading(true);
        try {
            const data = await GeminiService.parseBulkTopicContent(genericName, rawLinks);
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
        const newTopics: Topic[] = previewData.map((item, i) => {
            const topicId = `t-bulk-${timestamp}-${i}`;
            return {
                id: topicId,
                name: `${genericName} - Aula ${item.aulaNumber}`,
                description: `Conteúdo da Aula ${item.aulaNumber} sobre ${genericName}`,
                fullPdfs: item.pdf ? [{ id: `pdf-${topicId}`, fileName: item.pdf.name, url: item.pdf.url }] : [],
                summaryPdfs: [],
                raioXPdfs: [],
                videoUrls: item.video ? [{ id: `vid-${topicId}`, name: item.video.name, url: item.video.url }] : [],
                questions: [],
                tecQuestions: [],
                subtopics: [],
                miniGames: [],
                flashcards: [],
                glossary: []
            };
        });

        onSave(newTopics);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Gerar Aulas em Massa com IA" size="3xl">
            <div className="space-y-4">
                <p className="text-gray-400 text-sm">
                    Esta ferramenta cria múltiplos tópicos de uma vez. Defina o nome base e cole a lista de nomes e links (PDFs e Vídeos). A IA organizará os pares para você.
                </p>
                
                <div>
                    <label htmlFor="bulk-generic-name" className="block text-sm font-medium text-gray-300">Nome Genérico do Tópico</label>
                    <input 
                        id="bulk-generic-name"
                        type="text" 
                        value={genericName} 
                        onChange={e => setGenericName(e.target.value)} 
                        placeholder="Ex: Word 2010"
                        className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-cyan-500 focus:border-cyan-500" 
                    />
                </div>

                <div>
                    <label htmlFor="bulk-links-area" className="block text-sm font-medium text-gray-300">Lista de Nomes e Links</label>
                    <textarea 
                        id="bulk-links-area"
                        value={rawLinks} 
                        onChange={e => setRawLinks(e.target.value)} 
                        rows={8}
                        placeholder="Cole aqui a lista de arquivos e links (ex: WORD01.pdf https://...)"
                        className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-cyan-500 focus:border-cyan-500 font-mono text-xs" 
                    />
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
                        <h3 className="text-lg font-semibold text-cyan-400">Prévia das Aulas a serem Criadas</h3>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                            {previewData.map((item, idx) => (
                                <div key={idx} className="p-3 bg-gray-900/50 rounded-lg border border-gray-700 text-sm">
                                    <p className="font-bold text-white mb-2">{genericName} - Aula {item.aulaNumber}</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className={item.pdf ? 'text-green-400' : 'text-gray-600'}>
                                            <span className="font-semibold">PDF:</span> {item.pdf ? item.pdf.name : 'Não detectado'}
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
                            <Button onClick={handleFinalSave} className="flex-1">Criar {previewData.length} Aulas</Button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

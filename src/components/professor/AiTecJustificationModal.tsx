
import React, { useState, useEffect } from 'react';
import * as GeminiService from '../../services/geminiService';
import { Modal, Button, Spinner, Card } from '../ui';
/* Added CheckCircleIcon to the imports to resolve the 'Cannot find name' error. */
import { GeminiIcon, ArrowRightIcon, ExclamationTriangleIcon, CheckCircleIcon } from '../Icons';

interface AiTecJustificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (justifications: string[]) => void;
    questionCount: number;
}

export const AiTecJustificationModal: React.FC<AiTecJustificationModalProps> = ({ 
    isOpen, 
    onClose, 
    onApply, 
    questionCount 
}) => {
    const [latexText, setLatexText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [extractedJustifications, setExtractedJustifications] = useState<string[] | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setLatexText('');
            setError('');
            setIsLoading(false);
            setExtractedJustifications(null);
        }
    }, [isOpen]);

    const handleProcess = async () => {
        if (!latexText.trim()) {
            setError('Por favor, cole o código LaTeX do documento de comentários.');
            return;
        }

        setError('');
        setIsLoading(true);
        try {
            const justifications = await GeminiService.parseTecJustificationsFromLatex(latexText);
            
            if (justifications.length !== questionCount) {
                setError(`Divergência na contagem: Você tem ${questionCount} questões extraídas, mas a IA detectou ${justifications.length} comentários no documento. Por favor, verifique o arquivo LaTeX.`);
                setIsLoading(false);
                return;
            }

            setExtractedJustifications(justifications);
        } catch (e: any) {
            setError(e.message || 'Erro ao processar LaTeX. Certifique-se de que o texto colado contém os comandos básicos de estrutura.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirm = () => {
        if (extractedJustifications) {
            onApply(extractedJustifications);
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Importar Comentários TEC (LaTeX)" size="4xl">
            <div className="space-y-6">
                {!extractedJustifications ? (
                    <>
                        <div className="bg-amber-900/20 border border-amber-500/30 p-4 rounded-xl flex gap-4 items-start">
                            <ExclamationTriangleIcon className="h-6 w-6 text-amber-400 flex-shrink-0" />
                            <div className="text-sm">
                                <p className="text-amber-200 font-bold mb-1">Regras de Importação:</p>
                                <ul className="list-disc list-inside text-gray-400 space-y-1">
                                    <li>Cole o código LaTeX completo do documento de comentários.</li>
                                    <li>A IA preservará <strong>negrito</strong>, <em>itálico</em>, <span className="text-cyan-400">cores</span> e parágrafos.</li>
                                    <li>A ordem dos comentários deve ser a mesma das questões extraídas no sistema.</li>
                                    <li>A contagem deve bater exatamente (Total: {questionCount}).</li>
                                </ul>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Código LaTeX do Documento:</label>
                            <textarea 
                                value={latexText}
                                onChange={e => setLatexText(e.target.value)}
                                rows={15}
                                placeholder="Colar aqui o \begin{document} ... \end{document}"
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
                                {isLoading ? <Spinner /> : <><GeminiIcon className="h-5 w-5 mr-2" /> Analisar e Converter LaTeX</>}
                            </Button>
                        </div>
                    </>
                ) : (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-bold text-cyan-400 flex items-center gap-2">
                                <CheckCircleIcon className="h-6 w-6" /> 
                                {extractedJustifications.length} Comentários Convertidos
                            </h3>
                            <button onClick={() => setExtractedJustifications(null)} className="text-xs font-bold text-gray-500 hover:text-white transition-colors">Voltar e Corrigir</button>
                        </div>

                        <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-2 custom-scrollbar">
                            {extractedJustifications.map((html, idx) => (
                                <div key={idx} className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                                    <div className="flex items-center gap-3 mb-3 border-b border-gray-700 pb-2">
                                        <span className="text-[10px] font-black text-cyan-500 uppercase tracking-widest">Questão {idx + 1}</span>
                                    </div>
                                    <div 
                                        className="prose prose-sm prose-invert max-w-none text-gray-300"
                                        dangerouslySetInnerHTML={{ __html: html }}
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="bg-cyan-500/10 border border-cyan-500/30 p-4 rounded-xl">
                            <p className="text-xs text-cyan-300 text-center font-bold">
                                Ao aplicar, estes comentários substituirão as justificativas atuais das {questionCount} questões do TEC neste tópico.
                            </p>
                        </div>

                        <div className="flex gap-4">
                            <Button onClick={() => setExtractedJustifications(null)} className="flex-1 bg-gray-700 hover:bg-gray-600 border-none font-bold uppercase tracking-widest text-xs">Cancelar</Button>
                            <Button onClick={handleConfirm} className="flex-2 py-4 font-black uppercase tracking-widest text-sm shadow-xl shadow-cyan-500/20">Aplicar no Banco de Dados</Button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

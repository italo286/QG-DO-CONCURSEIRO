import React, { useState, useEffect } from 'react';
import { Question, CustomQuiz } from '../../types';
import * as GeminiService from '../../services/geminiService';
import { fileToBase64 } from '../../utils';
import { Modal, Button, Spinner } from '../ui';
import { GeminiIcon } from '../Icons';

interface StudentCustomQuizCreatorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (quiz: CustomQuiz) => void;
}

export const StudentCustomQuizCreatorModal: React.FC<StudentCustomQuizCreatorModalProps> = ({ isOpen, onClose, onSave }) => {
    const [quizName, setQuizName] = useState('');
    const [sourceType, setSourceType] = useState<'theme' | 'document'>('theme');
    const [documentType, setDocumentType] = useState<'pdf' | 'text'>('pdf');
    const [theme, setTheme] = useState('');
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [pastedText, setPastedText] = useState('');
    const [questionCount, setQuestionCount] = useState(10);
    const [questionType, setQuestionType] = useState<'multiple_choice' | 'true_false'>('multiple_choice');
    const [numAlternatives, setNumAlternatives] = useState(5);
    const [difficulty, setDifficulty] = useState<'Fácil' | 'Médio' | 'Difícil' | 'Misto'>('Médio');

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [generatedQuestions, setGeneratedQuestions] = useState<Omit<Question, 'id'>[] | null>(null);
    
    useEffect(() => {
        if (!isOpen) {
            // Reset state on close
            setQuizName('');
            setSourceType('theme');
            setTheme('');
            setPdfFile(null);
            setPastedText('');
            setQuestionCount(10);
            setQuestionType('multiple_choice');
            setNumAlternatives(5);
            setDifficulty('Médio');
            setIsLoading(false);
            setError('');
            setGeneratedQuestions(null);
        }
    }, [isOpen]);
    
    const handleGenerate = async () => {
        setError('');
        setIsLoading(true);
        setGeneratedQuestions(null);

        let source: { type: 'theme'; content: string } | { type: 'text'; content: string } | { type: 'pdf'; content: string };
        if (sourceType === 'theme') {
            if (!theme.trim()) { setError('Por favor, digite um tema.'); setIsLoading(false); return; }
            source = { type: 'theme', content: theme };
        } else {
            if (documentType === 'pdf') {
                if (!pdfFile) { setError('Por favor, envie um arquivo PDF.'); setIsLoading(false); return; }
                const base64 = await fileToBase64(pdfFile);
                source = { type: 'pdf', content: base64 };
            } else {
                if (!pastedText.trim()) { setError('Por favor, cole o texto.'); setIsLoading(false); return; }
                source = { type: 'text', content: pastedText };
            }
        }

        try {
            const questions = await GeminiService.generateCustomQuizQuestions({
                source,
                questionCount,
                questionType,
                numAlternatives: questionType === 'multiple_choice' ? numAlternatives : undefined,
                difficulty,
            });
            setGeneratedQuestions(questions);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = () => {
        if (!quizName.trim()) {
            setError('Por favor, dê um nome ao seu quiz.');
            return;
        }
        if (!generatedQuestions) {
            setError('Gere as questões antes de salvar.');
            return;
        }
        
        const newQuiz: CustomQuiz = {
            id: `custom-quiz-${Date.now()}`,
            name: quizName,
            questions: generatedQuestions.map(q => ({ ...q, id: `q-${Date.now()}-${Math.random()}` })),
            isCompleted: false,
            createdAt: Date.now(),
        };
        onSave(newQuiz);
        onClose();
    };

    const isGenerateDisabled = isLoading || (sourceType === 'theme' && !theme.trim()) || (sourceType === 'document' && documentType === 'pdf' && !pdfFile) || (sourceType === 'document' && documentType === 'text' && !pastedText.trim());

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Criar Quiz Personalizado" size="3xl">
            <div className="space-y-4">
                 <div>
                    <label htmlFor="quiz-name" className="block text-sm font-medium text-gray-300">Nome do Quiz</label>
                    <input id="quiz-name" type="text" value={quizName} onChange={e => setQuizName(e.target.value)} required className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white" />
                </div>
                
                <div className="flex border-b border-gray-700" role="tablist">
                    <button onClick={() => setSourceType('theme')} className={`flex-1 py-2 text-sm font-medium ${sourceType === 'theme' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400'}`}>Gerar por Tema</button>
                    <button onClick={() => setSourceType('document')} className={`flex-1 py-2 text-sm font-medium ${sourceType === 'document' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400'}`}>Gerar de Documento/Texto</button>
                </div>

                {sourceType === 'theme' ? (
                    <div>
                        <label htmlFor="theme" className="block text-sm font-medium text-gray-300">Tema</label>
                        <input id="theme" type="text" value={theme} onChange={e => setTheme(e.target.value)} placeholder="Ex: Atos Administrativos" className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white" />
                    </div>
                ) : (
                    <div>
                         <div className="flex border-b border-gray-700" role="tablist">
                            <button onClick={() => setDocumentType('pdf')} className={`flex-1 py-2 text-xs ${documentType === 'pdf' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400'}`}>PDF</button>
                            <button onClick={() => setDocumentType('text')} className={`flex-1 py-2 text-xs ${documentType === 'text' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400'}`}>Texto</button>
                        </div>
                        {documentType === 'pdf' ? (
                             <div className="flex items-center space-x-4 mt-2">
                                <label className="cursor-pointer bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md"><input type="file" accept="application/pdf" onChange={e => setPdfFile(e.target.files ? e.target.files[0] : null)} className="hidden" />Selecionar PDF</label>
                                {pdfFile && <span className="text-gray-300 truncate">{pdfFile.name}</span>}
                            </div>
                        ) : (
                            <textarea value={pastedText} onChange={e => setPastedText(e.target.value)} rows={4} placeholder="Cole o texto aqui..." className="mt-2 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white" />
                        )}
                    </div>
                )}
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-gray-700 pt-4">
                    <div>
                        <label htmlFor="q-count" className="block text-sm font-medium text-gray-300">Nº de Questões</label>
                        <input id="q-count" type="number" value={questionCount} onChange={e => setQuestionCount(Math.min(20, Math.max(1, Number(e.target.value))))} max="20" className="mt-1 block w-full bg-gray-700 rounded p-2 text-sm" />
                    </div>
                    <div>
                        <label htmlFor="q-type" className="block text-sm font-medium text-gray-300">Tipo</label>
                        <select id="q-type" value={questionType} onChange={e => setQuestionType(e.target.value as any)} className="mt-1 block w-full bg-gray-700 rounded p-2 text-sm">
                            <option value="multiple_choice">Múltipla Escolha</option>
                            <option value="true_false">Certo e Errado</option>
                        </select>
                    </div>
                     {questionType === 'multiple_choice' && (
                        <div>
                            <label htmlFor="alt-count" className="block text-sm font-medium text-gray-300">Nº de Alternativas</label>
                            <input id="alt-count" type="number" value={numAlternatives} onChange={e => setNumAlternatives(Math.min(5, Math.max(2, Number(e.target.value))))} max="5" className="mt-1 block w-full bg-gray-700 rounded p-2 text-sm" />
                        </div>
                     )}
                     <div>
                        <label htmlFor="q-difficulty" className="block text-sm font-medium text-gray-300">Dificuldade</label>
                        <select id="q-difficulty" value={difficulty} onChange={e => setDifficulty(e.target.value as any)} className="mt-1 block w-full bg-gray-700 rounded p-2 text-sm">
                            <option value="Fácil">Fácil</option>
                            <option value="Médio">Médio</option>
                            <option value="Difícil">Difícil</option>
                            <option value="Misto">Misto</option>
                        </select>
                    </div>
                </div>

                <div className="text-center">
                    <Button onClick={handleGenerate} disabled={isGenerateDisabled}>
                        {isLoading ? <><Spinner /> Gerando...</> : <><GeminiIcon className="h-5 w-5 mr-2"/> Gerar Questões</>}
                    </Button>
                </div>
                {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                
                {generatedQuestions && (
                    <div className="border-t border-gray-700 pt-4 space-y-2">
                        <h3 className="text-lg font-semibold">{generatedQuestions.length} questões foram geradas!</h3>
                        <p className="text-sm text-gray-400">Clique em "Salvar Quiz" para adicioná-lo à sua lista.</p>
                        <div className="pt-4 flex justify-end">
                            <Button onClick={handleSave}>Salvar Quiz</Button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};
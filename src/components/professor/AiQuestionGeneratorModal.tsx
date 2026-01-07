
import React, { useState, useEffect } from 'react';
import * as GeminiService from '../../services/geminiService';
import { Question } from '../../types';
import { fileToBase64 } from '../../utils';
import { Modal, Button, Spinner } from '../ui';
import { GeminiIcon } from '../Icons';

const EditableQuestionItem: React.FC<{
    question: Omit<Question, 'id'>;
    index: number;
    onUpdate: (index: number, updatedQuestion: Omit<Question, 'id'>) => void;
    isInvalid: boolean;
}> = ({ question, index, onUpdate, isInvalid }) => {

    const handleFieldChange = (field: keyof Omit<Question, 'id' | 'options' | 'correctAnswer'>, value: string) => {
        onUpdate(index, { ...question, [field]: value });
    };

    const handleOptionChange = (optionIndex: number, value: string) => {
        const newOptions = [...question.options];
        const oldOptionValue = newOptions[optionIndex];
        newOptions[optionIndex] = value;
        
        // Se a opção editada era a correta, atualiza o gabarito para manter a consistência
        const newCorrectAnswer = question.correctAnswer === oldOptionValue ? value : question.correctAnswer;
        
        const newOptionJustifications = { ...(question.optionJustifications || {}) };
        if (newOptionJustifications[oldOptionValue]) {
            newOptionJustifications[value] = newOptionJustifications[oldOptionValue];
            delete newOptionJustifications[oldOptionValue];
        }

        onUpdate(index, { ...question, options: newOptions, correctAnswer: newCorrectAnswer, optionJustifications: newOptionJustifications });
    };

    const handleCorrectAnswerChange = (newCorrectAnswer: string) => {
        onUpdate(index, { ...question, correctAnswer: newCorrectAnswer });
    };

    const handleOptionJustificationChange = (optionText: string, justification: string) => {
        const newOptionJustifications = { ...(question.optionJustifications || {}), [optionText]: justification };
        onUpdate(index, { ...question, optionJustifications: newOptionJustifications });
    };

    return (
        <div className={`p-4 bg-gray-900/50 rounded-lg space-y-3 border-2 transition-all ${isInvalid ? 'border-red-500 bg-red-900/10' : 'border-gray-700'}`}>
            <div className="flex justify-between items-center">
                <h4 className="font-black text-gray-300 uppercase tracking-widest text-xs">Questão {index + 1}</h4>
                {isInvalid && <span className="text-[10px] font-black text-red-400 uppercase animate-pulse">Ajuste o Gabarito</span>}
            </div>
            
            <div>
                <label htmlFor={`statement-${index}`} className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Enunciado</label>
                <textarea
                    id={`statement-${index}`}
                    value={question.statement}
                    onChange={e => handleFieldChange('statement', e.target.value)}
                    rows={4}
                    className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-sm focus:ring-1 focus:ring-cyan-500 outline-none"
                />
            </div>

            <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Alternativas (Marque a correta)</label>
                <div className="space-y-3 mt-1">
                    {question.options.map((option, optionIndex) => (
                        <div key={optionIndex} className="p-3 bg-gray-800/60 rounded-xl border border-gray-700/50">
                            <div className="flex items-center space-x-3">
                                <input
                                    type="radio"
                                    id={`q-${index}-option-${optionIndex}`}
                                    name={`correct-answer-${index}`}
                                    checked={question.correctAnswer === option}
                                    onChange={() => handleCorrectAnswerChange(option)}
                                    className="h-5 w-5 text-cyan-500 bg-gray-700 border-gray-600 focus:ring-cyan-600"
                                />
                                <div className="flex-grow flex items-center bg-gray-900/40 rounded-lg px-2 border border-white/5">
                                    <span className="text-xs font-black text-gray-500 mr-2">{String.fromCharCode(65 + optionIndex)})</span>
                                    <input
                                        type="text"
                                        aria-label={`Alternativa ${optionIndex + 1}`}
                                        value={option}
                                        onChange={e => handleOptionChange(optionIndex, e.target.value)}
                                        className="flex-grow bg-transparent border-none py-1 text-white text-sm focus:ring-0"
                                    />
                                </div>
                            </div>
                             <textarea
                                value={question.optionJustifications?.[option] || ''}
                                onChange={e => handleOptionJustificationChange(option, e.target.value)}
                                rows={2}
                                placeholder={`Por que a ${String.fromCharCode(65 + optionIndex)} está ${question.correctAnswer === option ? 'correta' : 'errada'}?`}
                                className="mt-2 block w-full bg-gray-900/40 border border-gray-700 rounded-lg py-1.5 px-3 text-gray-300 text-xs italic focus:ring-1 focus:ring-cyan-500/30 outline-none"
                            />
                        </div>
                    ))}
                </div>
            </div>
             <div>
                <label htmlFor={`justification-${index}`} className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Justificativa Geral</label>
                <textarea
                    id={`justification-${index}`}
                    value={question.justification}
                    onChange={e => handleFieldChange('justification', e.target.value)}
                    rows={3}
                    className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-sm"
                />
            </div>
        </div>
    );
};


export const AiQuestionGeneratorModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSaveQuestions: (questions: Omit<Question, 'id'>[], isTecExtraction: boolean) => void;
    isTecExtraction?: boolean;
}> = ({ isOpen, onClose, onSaveQuestions, isTecExtraction = false }) => {
    const [inputMethod, setInputMethod] = useState<'pdf' | 'text'>('pdf');
    const [file, setFile] = useState<File | null>(null);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [generatedQuestions, setGeneratedQuestions] = useState<Omit<Question, 'id'>[]>([]);
    const [validationError, setValidationError] = useState<{ index: number; message: string } | null>(null);
    const [generateJustifications, setGenerateJustifications] = useState(true);

    useEffect(() => {
        if (!isOpen) {
            setFile(null);
            setInputText('');
            setIsLoading(false);
            setError('');
            setGeneratedQuestions([]);
            setInputMethod('pdf');
            setValidationError(null);
            setGenerateJustifications(true);
        }
    }, [isOpen]);

    const handleGenerate = async () => {
        if (inputMethod === 'pdf' && !file) {
            setError('Por favor, selecione um arquivo PDF.');
            return;
        }
        if (inputMethod === 'text' && !inputText.trim()) {
            setError('Por favor, cole o texto para análise.');
            return;
        }

        setError('');
        setValidationError(null);
        setIsLoading(true);
        setGeneratedQuestions([]);

        try {
            let questions;
            if (inputMethod === 'pdf') {
                const base64 = await fileToBase64(file!);
                questions = isTecExtraction 
                    ? await GeminiService.extractQuestionsFromTecPdf(base64, generateJustifications)
                    : await GeminiService.generateQuestionsFromPdf(base64, 20, generateJustifications);
            } else { // 'text'
                questions = isTecExtraction
                    ? await GeminiService.extractQuestionsFromTecText(inputText, generateJustifications)
                    : await GeminiService.generateQuestionsFromText(inputText, 20, generateJustifications);
            }
            setGeneratedQuestions(questions);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSave = () => {
        setValidationError(null);
        const questionsToSave = [...generatedQuestions];

        for (let i = 0; i < questionsToSave.length; i++) {
            const q = questionsToSave[i];
            
            // Limpeza preventiva: trim em tudo
            const cleanOptions = q.options.map(opt => opt.trim());
            const cleanCorrect = q.correctAnswer?.trim() || '';
            
            // Tenta encontrar a correspondência exata ou via limpeza de prefixos (a), b), etc)
            let matchedOption = cleanOptions.find(opt => opt === cleanCorrect);
            
            if (!matchedOption) {
                // Tenta correspondência ignorando prefixos comuns de IA (ex: "A) Texto" vs "Texto")
                matchedOption = cleanOptions.find(opt => {
                    const optClean = opt.replace(/^[a-eA-E][\)\.\-]\s*/, '').toLowerCase();
                    const correctClean = cleanCorrect.replace(/^[a-eA-E][\)\.\-]\s*/, '').toLowerCase();
                    return optClean === correctClean;
                });
            }

            if (!matchedOption && cleanOptions.length > 0) {
                setValidationError({ 
                    index: i, 
                    message: `A questão ${i + 1} possui um gabarito que não corresponde a nenhuma das alternativas. Por favor, marque a alternativa correta manualmente.` 
                });
                
                // Scroll suave para a questão problemática
                const element = document.getElementById(`statement-${i}`);
                element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }
            
            // Atualiza com os valores limpos
            questionsToSave[i] = { ...q, options: cleanOptions, correctAnswer: matchedOption || cleanCorrect };
        }
        
        onSaveQuestions(questionsToSave, isTecExtraction);
        onClose();
    };
    
    const handleQuestionUpdate = (index: number, updatedQuestion: Omit<Question, 'id'>) => {
        const newQuestions = [...generatedQuestions];
        newQuestions[index] = updatedQuestion;
        setGeneratedQuestions(newQuestions);
        // Limpa erro de validação ao editar a questão problemática
        if (validationError?.index === index) {
            setValidationError(null);
        }
    };

    const isGenerateDisabled = isLoading || (inputMethod === 'pdf' && !file) || (inputMethod === 'text' && !inputText.trim());

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isTecExtraction ? "Extrair Questões de PDF (TEC)" : "Gerar Questões com IA"} size="4xl">
            <div className="space-y-4">
                <p className="text-gray-400 text-sm leading-relaxed">
                    {isTecExtraction 
                        ? "Forneça o conteúdo de um caderno do TEC Concursos (PDF ou texto) para extração automatizada de enunciados, alternativas e comentários."
                        : "Forneça o material didático para que a IA gere 20 questões inéditas de múltipla escolha com foco em concursos."
                    }
                </p>

                <div className="flex bg-gray-900/50 p-1 rounded-xl border border-white/5" role="tablist">
                    <button onClick={() => setInputMethod('pdf')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${inputMethod === 'pdf' ? 'bg-cyan-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`} role="tab" aria-selected={inputMethod === 'pdf'}>Upload PDF</button>
                    <button onClick={() => setInputMethod('text')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${inputMethod === 'text' ? 'bg-cyan-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`} role="tab" aria-selected={inputMethod === 'text'}>Colar Texto</button>
                </div>
                
                {inputMethod === 'pdf' ? (
                    <div className="flex items-center space-x-4 p-6 border-2 border-dashed border-gray-700 rounded-2xl bg-gray-800/20">
                        <label className="cursor-pointer bg-gray-700 hover:bg-gray-600 text-white font-black text-[10px] uppercase tracking-widest py-3 px-6 rounded-xl border border-white/5 transition-all shadow-xl active:scale-95">
                            <span>Selecionar Arquivo</span>
                            <input type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
                        </label>
                        {file ? (
                            <span className="text-cyan-400 font-bold text-xs truncate max-w-[200px]">{file.name}</span>
                        ) : (
                            <span className="text-gray-500 text-xs italic">Nenhum arquivo selecionado...</span>
                        )}
                    </div>
                ) : (
                    <textarea
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        rows={8}
                        placeholder="Cole o conteúdo bruto aqui para análise..."
                        className="block w-full bg-gray-800/40 border border-gray-700 rounded-2xl py-4 px-5 text-white text-sm focus:ring-2 focus:ring-cyan-500/50 outline-none transition-all placeholder:text-gray-600"
                    />
                )}

                <div className="flex items-center space-x-3 bg-gray-900/40 p-3 rounded-xl border border-white/5">
                    <input
                        type="checkbox"
                        id="gen-justifications"
                        checked={generateJustifications}
                        onChange={(e) => setGenerateJustifications(e.target.checked)}
                        className="h-5 w-5 rounded border-gray-600 text-cyan-600 focus:ring-cyan-500 bg-gray-800"
                    />
                    <label htmlFor="gen-justifications" className="text-xs font-bold text-gray-400 cursor-pointer uppercase tracking-widest">
                        Gerar justificativas detalhadas para alternativas
                    </label>
                </div>


                <div className="text-center pt-2">
                    <Button onClick={handleGenerate} disabled={isGenerateDisabled} className="w-full md:w-auto px-16 py-4 shadow-2xl shadow-cyan-500/10">
                        {isLoading ? <Spinner /> : <><GeminiIcon className="h-5 w-5 mr-2" /> Iniciar Processamento</>}
                    </Button>
                </div>
                {error && <p className="text-red-400 text-xs font-bold text-center bg-red-900/20 p-3 rounded-lg border border-red-500/30" role="alert">{error}</p>}
                
                {generatedQuestions.length > 0 && (
                    <div className="border-t border-gray-700 pt-6 space-y-4 animate-fade-in">
                        <div className="flex justify-between items-end">
                            <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">{generatedQuestions.length} Questões Detectadas</h3>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Revise os dados antes de incorporar ao banco</p>
                            </div>
                             {validationError && (
                                <div className="bg-red-500 text-white text-[10px] font-black px-4 py-2 rounded-lg animate-bounce uppercase tracking-widest shadow-lg shadow-red-500/20">
                                    {validationError.message}
                                </div>
                            )}
                        </div>

                         <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-3 custom-scrollbar p-1">
                             {generatedQuestions.map((q, index) => (
                                <EditableQuestionItem
                                    key={index}
                                    question={q}
                                    index={index}
                                    onUpdate={handleQuestionUpdate}
                                    isInvalid={validationError?.index === index}
                                />
                             ))}
                         </div>

                         <div className="pt-6 border-t border-gray-800 flex justify-end">
                            <Button 
                                onClick={handleSave} 
                                disabled={generatedQuestions.length === 0}
                                className="w-full md:w-auto px-12 py-5 bg-gradient-to-r from-emerald-600 to-green-700 font-black text-xs uppercase tracking-[0.2em] shadow-2xl"
                            >
                                Salvar Questões no Tópico
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

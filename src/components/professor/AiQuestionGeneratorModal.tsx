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
        
        const newCorrectAnswer = question.correctAnswer === oldOptionValue ? value : question.correctAnswer;
        
        const newOptionJustifications = { ...question.optionJustifications };
        if (newOptionJustifications && newOptionJustifications[oldOptionValue]) {
            newOptionJustifications[value] = newOptionJustifications[oldOptionValue];
            delete newOptionJustifications[oldOptionValue];
        }

        onUpdate(index, { ...question, options: newOptions, correctAnswer: newCorrectAnswer, optionJustifications: newOptionJustifications });
    };

    const handleCorrectAnswerChange = (newCorrectAnswer: string) => {
        onUpdate(index, { ...question, correctAnswer: newCorrectAnswer });
    };

    const handleOptionJustificationChange = (optionText: string, justification: string) => {
        const newOptionJustifications = { ...question.optionJustifications, [optionText]: justification };
        onUpdate(index, { ...question, optionJustifications: newOptionJustifications });
    };


    return (
        <div className={`p-4 bg-gray-900/50 rounded-lg space-y-3 border ${isInvalid ? 'border-red-500' : 'border-gray-700'}`}>
            <h4 className="font-semibold text-gray-300">Questão {index + 1}</h4>
            
            <div>
                <label htmlFor={`statement-${index}`} className="text-sm font-medium text-gray-400">Enunciado</label>
                <textarea
                    id={`statement-${index}`}
                    value={question.statement}
                    onChange={e => handleFieldChange('statement', e.target.value)}
                    rows={4}
                    className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white text-sm"
                />
            </div>

            <div>
                <label htmlFor={`imageUrl-${index}`} className="text-sm font-medium text-gray-400">URL da Imagem (Opcional)</label>
                <input
                    id={`imageUrl-${index}`}
                    type="url"
                    value={question.imageUrl || ''}
                    onChange={e => handleFieldChange('imageUrl', e.target.value)}
                    placeholder="https://exemplo.com/imagem.png"
                    className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white text-sm"
                />
            </div>

            <div>
                <label className="text-sm font-medium text-gray-400">Alternativas e Justificativas</label>
                <div className="space-y-4 mt-1">
                    {question.options.map((option, optionIndex) => (
                        <div key={optionIndex} className="p-2 bg-gray-800/60 rounded-md">
                            <div className="flex items-center space-x-2">
                                <input
                                    type="radio"
                                    id={`q-${index}-option-${optionIndex}`}
                                    name={`correct-answer-${index}`}
                                    checked={question.correctAnswer === option}
                                    onChange={() => handleCorrectAnswerChange(option)}
                                    className="h-5 w-5 text-cyan-500 bg-gray-600 border-gray-500 focus:ring-cyan-600"
                                />
                                <input
                                    type="text"
                                    aria-label={`Alternativa ${optionIndex + 1}`}
                                    value={option}
                                    onChange={e => handleOptionChange(optionIndex, e.target.value)}
                                    className="flex-grow bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white text-sm"
                                />
                            </div>
                             <textarea
                                value={question.optionJustifications?.[option] || ''}
                                onChange={e => handleOptionJustificationChange(option, e.target.value)}
                                rows={2}
                                placeholder={`Justificativa para a alternativa ${String.fromCharCode(65 + optionIndex)}...`}
                                className="mt-2 block w-full bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white text-xs"
                            />
                        </div>
                    ))}
                </div>
            </div>
             <div>
                <label htmlFor={`justification-${index}`} className="text-sm font-medium text-gray-400">Justificativa da Resposta Correta (Geral)</label>
                <textarea
                    id={`justification-${index}`}
                    value={question.justification}
                    onChange={e => handleFieldChange('justification', e.target.value)}
                    rows={3}
                    className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white text-sm"
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
        for (let i = 0; i < generatedQuestions.length; i++) {
            const q = generatedQuestions[i];
            if (!q.correctAnswer || !q.options.includes(q.correctAnswer)) {
                setValidationError({ index: i, message: `A questão ${i + 1} não tem uma resposta correta selecionada.` });
                return;
            }
        }
        onSaveQuestions(generatedQuestions, isTecExtraction);
        onClose();
    };
    
    const handleQuestionUpdate = (index: number, updatedQuestion: Omit<Question, 'id'>) => {
        const newQuestions = [...generatedQuestions];
        newQuestions[index] = updatedQuestion;
        setGeneratedQuestions(newQuestions);
    };

    const isGenerateDisabled = isLoading || (inputMethod === 'pdf' && !file) || (inputMethod === 'text' && !inputText.trim());

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isTecExtraction ? "Extrair Questões de PDF (TEC)" : "Gerar Questões com IA"} size="3xl">
            <div className="space-y-4">
                <p className="text-gray-400">
                    {isTecExtraction 
                        ? "Forneça o conteúdo de um caderno do TEC Concursos, via PDF ou texto, e a IA irá extrair as questões."
                        : "Forneça o conteúdo de uma aula, via PDF ou texto, e a IA irá criar 20 questões de múltipla escolha."
                    }
                </p>

                <div className="flex border-b border-gray-700 mb-4" role="tablist">
                    <button onClick={() => setInputMethod('pdf')} className={`flex-1 py-2 text-sm font-medium ${inputMethod === 'pdf' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:text-white'}`} role="tab" aria-selected={inputMethod === 'pdf'}>Upload de PDF</button>
                    <button onClick={() => setInputMethod('text')} className={`flex-1 py-2 text-sm font-medium ${inputMethod === 'text' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:text-white'}`} role="tab" aria-selected={inputMethod === 'text'}>Colar Texto</button>
                </div>
                
                {inputMethod === 'pdf' ? (
                    <div className="flex items-center space-x-4">
                        <label className="cursor-pointer bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md">
                            <span>Selecionar PDF</span>
                            <input type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
                        </label>
                        {file && <span className="text-gray-300 truncate">{file.name}</span>}
                    </div>
                ) : (
                    <textarea
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        rows={6}
                        placeholder="Cole o texto das questões aqui..."
                        className="block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white"
                    />
                )}

                <div className="flex items-center space-x-2 pt-2">
                    <input
                        type="checkbox"
                        id="gen-justifications"
                        checked={generateJustifications}
                        onChange={(e) => setGenerateJustifications(e.target.checked)}
                        className="h-4 w-4 rounded text-cyan-500 bg-gray-700 border-gray-600 focus:ring-cyan-600"
                    />
                    <label htmlFor="gen-justifications" className="text-sm text-gray-300 cursor-pointer">
                        Gerar justificativas detalhadas para cada alternativa
                    </label>
                </div>


                <div className="text-center">
                    <Button onClick={handleGenerate} disabled={isGenerateDisabled}>
                        {isLoading ? <Spinner /> : <><GeminiIcon className="h-5 w-5 mr-2" /> Gerar</>}
                    </Button>
                </div>
                {error && <p className="text-red-400 text-sm text-center" role="alert">{error}</p>}
                {validationError && <p className="text-red-400 text-sm text-center" role="alert">{validationError.message}</p>}
                
                {generatedQuestions.length > 0 && (
                    <div className="border-t border-gray-700 pt-4 space-y-4">
                        <h3 className="text-lg font-semibold">{generatedQuestions.length} Questões Geradas (Editáveis)</h3>
                         <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
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
                         <div className="pt-4 flex justify-end">
                            <Button onClick={handleSave} disabled={generatedQuestions.length === 0}>
                                Salvar Questões
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};
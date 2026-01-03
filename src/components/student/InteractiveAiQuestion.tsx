
import React, { useState, useId } from 'react';
import { Question } from '../../types';
import { Button } from '../ui';
import { CheckCircleIcon, XCircleIcon } from '../Icons';
import { markdownToHtml } from '../../utils';

export const InteractiveAiQuestion: React.FC<{ question: Omit<Question, 'id'> }> = ({ question }) => {
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [discardedOptions, setDiscardedOptions] = useState<Set<string>>(new Set());
    const [isAnswered, setIsAnswered] = useState(false);
    const baseId = useId();

    const handleOptionClick = (option: string) => {
        if (isAnswered) return;
        if (discardedOptions.has(option)) return;
        setSelectedOption(option);
    };

    const handleOptionDoubleClick = (option: string) => {
        if (isAnswered) return;
        
        setDiscardedOptions(prev => {
            const next = new Set(prev);
            if (next.has(option)) {
                next.delete(option);
            } else {
                next.add(option);
                if (selectedOption === option) {
                    setSelectedOption(null);
                }
            }
            return next;
        });
    };

    const handleRespond = () => {
        if (!selectedOption) return;
        setIsAnswered(true);
    };

    const isCorrect = isAnswered && selectedOption === question.correctAnswer;

    return (
        <div className="space-y-4">
            {question.imageUrl && (
                <div className="mb-4 flex justify-center">
                    <img src={question.imageUrl} alt="Imagem da questão" className="max-h-60 w-auto rounded-lg" />
                </div>
            )}
            <div id={`${baseId}-q-title`} className="text-lg font-semibold" dangerouslySetInnerHTML={{ __html: markdownToHtml(question.statement) }}></div>
            
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest italic mb-2">
                Dica: Clique duplo para eliminar alternativas.
            </p>

            <fieldset aria-labelledby={`${baseId}-q-title`}>
                <legend className="sr-only">Alternativas</legend>
                <div className="space-y-3">
                    {question.options.map((option, i) => {
                        const isSelected = selectedOption === option;
                        const isCorrectAnswer = question.correctAnswer === option;
                        const isDiscarded = discardedOptions.has(option);
                        
                        let labelClass = 'bg-gray-700 peer-hover:bg-gray-600';
                        if (isAnswered) {
                            if (isCorrectAnswer) labelClass = 'bg-green-600';
                            else if (isSelected) labelClass = 'bg-red-600';
                            else labelClass = 'bg-gray-700 opacity-60';
                        } else if (isDiscarded) {
                            labelClass = 'bg-gray-800 opacity-30 grayscale scale-[0.98] line-through blur-[0.3px]';
                        } else if (isSelected) {
                            labelClass = 'bg-blue-600 ring-2 ring-blue-400';
                        }

                        return (
                            <div key={i}>
                                <input
                                    type="radio"
                                    id={`${baseId}-q-o${i}`}
                                    name={`${baseId}-q`}
                                    value={option}
                                    checked={isSelected}
                                    onChange={() => handleOptionClick(option)}
                                    disabled={isAnswered || isDiscarded}
                                    className="sr-only peer"
                                />
                                <label
                                    htmlFor={`${baseId}-q-o${i}`}
                                    onClick={(e) => {
                                        // Prevenir que o clique duplo seja interpretado como dois cliques simples rápidos que marcariam e desmarcariam o rádio
                                        if (e.detail > 1) e.preventDefault();
                                        handleOptionClick(option);
                                    }}
                                    onDoubleClick={(e) => {
                                        e.preventDefault();
                                        handleOptionDoubleClick(option);
                                    }}
                                    className={`w-full text-left p-4 rounded-lg transition-all block select-none ${isAnswered ? '' : 'cursor-pointer'} ${labelClass} flex items-start`}
                                >
                                    <span className={`font-semibold mr-2 ${isDiscarded ? 'line-through' : ''}`}>{String.fromCharCode(65 + i)}.</span>
                                    <span className={isDiscarded ? 'line-through' : ''} dangerouslySetInnerHTML={{ __html: markdownToHtml(option) }}></span>
                                    {!isAnswered && isDiscarded && (
                                        <XCircleIcon className="h-4 w-4 ml-auto text-red-500/50" />
                                    )}
                                </label>
                            </div>
                        );
                    })}
                </div>
            </fieldset>

            {!isAnswered && (
                 <div className="text-center mt-6">
                    <Button onClick={handleRespond} disabled={!selectedOption}>
                        Responder
                    </Button>
                </div>
            )}
            
            {isAnswered && (
                <div className="mt-6 p-4 bg-gray-900/50 rounded-lg animate-fade-in">
                    <div className="flex items-center gap-2 mb-2">
                         {isCorrect ? <CheckCircleIcon className="h-6 w-6 text-green-400" /> : <XCircleIcon className="h-6 w-6 text-red-400" />}
                         <h4 className="font-bold text-lg">{isCorrect ? 'Resposta Correta!' : 'Resposta Incorreta'}</h4>
                    </div>
                    <h5 className="font-bold text-cyan-400">Justificativa:</h5>
                    <div className="mt-1 text-gray-300" dangerouslySetInnerHTML={{ __html: markdownToHtml(question.justification) }}></div>
                </div>
            )}
        </div>
    );
};

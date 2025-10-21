import React, { useState } from 'react';
import * as GeminiService from '../../services/geminiService';
import { Subject, Topic, SubTopic, Question } from '../../types';
import { markdownToHtml } from '../../utils';
import { Button, Spinner } from '../ui';
import { ChatBubbleLeftRightIcon, SparklesIcon } from '../Icons';
import { InteractiveAiQuestion } from './InteractiveAiQuestion';
import { TopicChat } from './TopicChat';


const TextTools: React.FC = () => {
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<string | Omit<Question, 'id'> | null>(null);
    const [error, setError] = useState('');

    const handleAction = async (action: 'explain' | 'summarize' | 'question') => {
        if (!inputText.trim()) {
            setError('Por favor, cole um texto para analisar.');
            return;
        }
        setError('');
        setIsLoading(true);
        setResult(null);

        try {
            let res: string | Omit<Question, 'id'>;
            if (action === 'explain') {
                res = await GeminiService.getAiExplanationForText(inputText);
            } else if (action === 'summarize') {
                res = await GeminiService.getAiSummaryForText(inputText);
            } else {
                res = await GeminiService.getAiQuestionForText(inputText);
            }
            setResult(res);
        } catch (e: any) {
            setError(e.message || "Ocorreu um erro ao processar a solicitação.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 space-y-4 h-full flex flex-col">
            <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={6}
                placeholder="Cole aqui um trecho do seu material de estudo..."
                className="block w-full bg-gray-700 border border-gray-600 rounded-md p-3 text-white focus:ring-cyan-500 focus:border-cyan-500"
                disabled={isLoading}
            />
            <div className="flex justify-center flex-wrap gap-2">
                <Button onClick={() => handleAction('explain')} disabled={isLoading || !inputText.trim()} className="text-sm py-2 px-4">Explicar Texto</Button>
                <Button onClick={() => handleAction('summarize')} disabled={isLoading || !inputText.trim()} className="text-sm py-2 px-4">Resumir</Button>
                <Button onClick={() => handleAction('question')} disabled={isLoading || !inputText.trim()} className="text-sm py-2 px-4">Criar Questão</Button>
            </div>

            <div className="flex-grow mt-4 border-t border-gray-700 pt-4 overflow-y-auto">
                {isLoading && (
                    <div className="flex justify-center items-center h-full">
                        <Spinner />
                        <span className="ml-2">Analisando...</span>
                    </div>
                )}
                {error && <p className="text-red-400 text-center">{error}</p>}
                
                {result && (
                    <div className="animate-fade-in">
                        {typeof result === 'string' ? (
                             <div 
                                className="prose prose-sm max-w-none text-inherit prose-headings:text-inherit prose-strong:text-inherit" 
                                dangerouslySetInnerHTML={{ __html: markdownToHtml(result) }} 
                            />
                        ) : (
                            <InteractiveAiQuestion question={result} />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};


export const AiAssistant: React.FC<{
    subject: Subject;
    topic: Topic | SubTopic;
}> = ({ subject, topic }) => {
    const [activeTab, setActiveTab] = useState<'chat' | 'tools'>('chat');
    
    return (
        <div className="flex flex-col h-full bg-gray-800 rounded-b-lg">
            <div className="flex-shrink-0 flex border-b border-gray-700 bg-gray-900/50 rounded-t-lg" role="tablist">
                 <button 
                    onClick={() => setActiveTab('chat')} 
                    className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'chat' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:text-white'}`}
                    role="tab" aria-selected={activeTab === 'chat'}
                >
                    <ChatBubbleLeftRightIcon className="h-5 w-5"/> Chat com Tutor
                </button>
                 <button 
                    onClick={() => setActiveTab('tools')} 
                    className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'tools' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:text-white'}`}
                    role="tab" aria-selected={activeTab === 'tools'}
                >
                    <SparklesIcon className="h-5 w-5"/> Ferramentas de Texto
                </button>
            </div>
            
            <div className="flex-grow overflow-y-auto">
                {activeTab === 'chat' && <TopicChat subject={subject} topic={topic} isVisible={true} />}
                {activeTab === 'tools' && <TextTools />}
            </div>
        </div>
    );
};
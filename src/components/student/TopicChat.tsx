import React, { useState, useEffect, useRef } from 'react';
import { Chat as GeminiChat, GenerateContentResponse } from '@google/genai';
import * as GeminiService from '../../services/geminiService';
import { Subject, Topic, SubTopic, ChatMessage } from '../../types';
import { markdownToHtml } from '../../utils';
import { Button, Spinner } from '../ui';
import { GeminiIcon } from '../Icons';

export const TopicChat: React.FC<{ subject: Subject; topic: Topic | SubTopic; isVisible: boolean }> = ({ subject, topic, isVisible }) => {
    const [chat, setChat] = useState<GeminiChat | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if(isVisible) {
            const newChat = GeminiService.startTopicChat(topic, subject);
            setChat(newChat);
            setMessages([
                { role: 'model', text: `Olá! Sou seu tutor de IA. Como posso ajudar com o tópico "${topic.name}"?` }
            ]);
        }
    }, [topic, subject, isVisible]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !chat || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const result: GenerateContentResponse = await chat.sendMessage({ message: input });
            const modelMessage: ChatMessage = { role: 'model', text: result.text || '' };
            setMessages(prev => [...prev, modelMessage]);
        } catch (error) {
            console.error("Erro no chat com a IA:", error);
            const errorMessage: ChatMessage = { role: 'model', text: "Desculpe, ocorreu um erro ao processar sua mensagem." };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex-grow p-4 overflow-y-auto space-y-4">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                        {msg.role === 'model' && <GeminiIcon className="h-8 w-8 flex-shrink-0" />}
                        <div className={`max-w-xl p-3 rounded-xl ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
                           <div 
                                className="prose prose-sm max-w-none text-inherit prose-headings:text-inherit prose-strong:text-inherit" 
                                dangerouslySetInnerHTML={{ __html: markdownToHtml(msg.text) }} 
                            />
                        </div>
                    </div>
                ))}
                {isLoading && (
                     <div className="flex items-start gap-3">
                        <GeminiIcon className="h-8 w-8 flex-shrink-0" />
                        <div className="max-w-xl p-3 rounded-xl bg-gray-700 text-gray-200 flex items-center">
                            <Spinner />
                            <span className="ml-2">Pensando...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className="flex-shrink-0 p-4 border-t border-gray-700 bg-gray-900/50 flex items-center gap-3">
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Faça uma pergunta sobre o tópico..."
                    disabled={isLoading}
                    className="flex-grow bg-gray-700 border border-gray-600 rounded-full py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <Button type="submit" disabled={isLoading || !input.trim()} className="rounded-full !p-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
                </Button>
            </form>
        </div>
    );
};

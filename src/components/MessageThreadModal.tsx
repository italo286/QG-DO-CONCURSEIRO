import React, { useState, useEffect, useRef } from 'react';
import { TeacherMessage, User, MessageReply } from '../types';
import { Modal, Button, Spinner } from './ui';
import { UserCircleIcon } from './Icons';

interface MessageThreadModalProps {
    isOpen: boolean;
    onClose: () => void;
    thread: TeacherMessage;
    currentUser: User;
    participants: { [id: string]: User };
    onSendReply: (messageId: string, reply: Omit<MessageReply, 'timestamp'>) => Promise<void>;
    onDelete: (messageId: string) => void;
}

export const MessageThreadModal: React.FC<MessageThreadModalProps> = ({ isOpen, onClose, thread, currentUser, participants, onSendReply, onDelete }) => {
    const [replyText, setReplyText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [thread.replies]);

    const handleSendReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyText.trim()) return;
        setIsSending(true);
        await onSendReply(thread.id, {
            senderId: currentUser.id,
            name: currentUser.name || currentUser.username,
            avatarUrl: currentUser.avatarUrl,
            text: replyText
        });
        setReplyText('');
        setIsSending(false);
    };

    const getParticipant = (id: string | null | undefined) => {
        return id ? participants[id] : null;
    }
    
    const otherParticipant = getParticipant(currentUser.role === 'professor' ? thread.studentId : thread.teacherId);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Conversa com ${otherParticipant?.name || 'Sistema'}`} size="2xl">
            <div className="flex flex-col h-[70vh]">
                <div className="flex-grow p-4 overflow-y-auto space-y-4 bg-gray-900/50 rounded-lg">
                    <p className="text-center text-xs text-gray-500 pb-2 border-b border-gray-700">{new Date(thread.timestamp).toLocaleString('pt-BR')}</p>
                    <div className="flex items-start gap-3 justify-start">
                        {/* Initial message sender */}
                        <UserCircleIcon className="h-8 w-8 text-gray-500 flex-shrink-0" />
                        <div className="max-w-md p-3 rounded-xl bg-gray-700 text-gray-200">
                            <p>{thread.message}</p>
                        </div>
                    </div>
                    {(thread.replies || []).map((reply, index) => {
                        const isCurrentUser = reply.senderId === currentUser.id;
                        const sender = participants[reply.senderId];
                        return (
                            <div key={index} className={`flex items-start gap-3 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                                {!isCurrentUser && (sender?.avatarUrl ? <img src={sender.avatarUrl} alt={sender.name || ''} className="h-8 w-8 rounded-full" /> : <UserCircleIcon className="h-8 w-8 text-gray-500" />)}
                                <div className={`max-w-md p-3 rounded-xl ${isCurrentUser ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
                                    <p>{reply.text}</p>
                                </div>
                                {isCurrentUser && (currentUser.avatarUrl ? <img src={currentUser.avatarUrl} alt={currentUser.name || ''} className="h-8 w-8 rounded-full" /> : <UserCircleIcon className="h-8 w-8 text-gray-500" />)}
                            </div>
                        );
                    })}
                     <div ref={messagesEndRef} />
                </div>
                {thread.studentId && ( // Can't reply to broadcasts
                    <form onSubmit={handleSendReply} className="flex-shrink-0 pt-4 flex items-center gap-3">
                        <input
                            type="text"
                            value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                            placeholder="Digite sua resposta..."
                            disabled={isSending}
                            className="flex-grow bg-gray-700 border border-gray-600 rounded-full py-2 px-4 text-white disabled:opacity-50"
                        />
                        <Button type="submit" disabled={isSending || !replyText.trim()} className="rounded-full !p-3">
                             {isSending ? <Spinner /> : <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>}
                        </Button>
                    </form>
                )}
                <div className="pt-4 flex justify-end">
                    <Button onClick={() => { onDelete(thread.id); onClose(); }} className="bg-red-800 hover:bg-red-700 text-sm py-1 px-3">
                        Apagar Conversa
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

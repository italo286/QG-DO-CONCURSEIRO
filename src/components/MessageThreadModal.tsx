import React, { useState, useEffect, useRef } from 'react';
import { TeacherMessage, User, MessageReply } from '../types';
import { Modal, Button, Spinner } from './ui';
import { UserCircleIcon, TrashIcon } from './Icons';

export const MessageThreadModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    thread: TeacherMessage;
    currentUser: User;
    participants: { [id: string]: User };
    onSendReply: (messageId: string, reply: Omit<MessageReply, 'timestamp'>) => void;
    onDelete: (messageId: string) => void;
}> = ({ isOpen, onClose, thread, currentUser, participants, onSendReply, onDelete }) => {
    const [replyText, setReplyText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [isOpen, thread?.replies]);

    const handleSendReply = async () => {
        if (!replyText.trim() || isSending) return;
        setIsSending(true);
        const reply: Omit<MessageReply, 'timestamp'> = {
            senderId: currentUser.id,
            name: currentUser.name || currentUser.username,
            avatarUrl: currentUser.avatarUrl,
            text: replyText,
        };
        await onSendReply(thread.id, reply);
        setReplyText('');
        setIsSending(false);
    };

    const handleDelete = () => {
        if (window.confirm("Tem certeza que deseja remover esta conversa da sua caixa de entrada? Ela ainda ficará visível para a outra pessoa. Uma nova resposta irá restaurá-la para você.")) {
            onDelete(thread.id);
            onClose();
        }
    };


    if (!thread) return null;
    
    const originalSender = participants[thread.teacherId];
    const isBroadcast = thread.studentId === null;
    const canReply = !(isBroadcast && currentUser.role === 'aluno');
    const title = isBroadcast ? 'Aviso Geral' : (currentUser.role === 'aluno' ? `Conversa com ${originalSender?.name}` : `Conversa com ${participants[thread.studentId!]?.name}`);


    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="2xl">
            <div className="flex flex-col h-[70vh]">
                <div className="flex-grow p-4 overflow-y-auto space-y-4">
                    {/* Original Message */}
                    <div className="flex items-start gap-3">
                        {originalSender?.avatarUrl ? (
                            <img src={originalSender.avatarUrl} alt={originalSender.name} className="h-10 w-10 rounded-full flex-shrink-0" />
                        ) : (
                            <UserCircleIcon className="h-10 w-10 text-gray-500 flex-shrink-0" />
                        )}
                        <div className="max-w-xl p-3 rounded-xl bg-gray-900/50 border border-gray-700">
                            <p className="font-semibold text-cyan-400">{originalSender?.name}</p>
                            <p className="text-gray-300">{thread.message}</p>
                        </div>
                    </div>
                    
                    {/* Replies */}
                    {(thread.replies || []).map((reply, index) => {
                        const isCurrentUser = reply.senderId === currentUser.id;
                        const sender = participants[reply.senderId];
                        return (
                             <div key={index} className={`flex items-start gap-3 ${isCurrentUser ? 'justify-end' : ''}`}>
                                {!isCurrentUser && (
                                    sender?.avatarUrl ? (
                                        <img src={sender.avatarUrl} alt={sender.name} className="h-10 w-10 rounded-full flex-shrink-0" />
                                    ) : (
                                        <UserCircleIcon className="h-10 w-10 text-gray-500 flex-shrink-0" />
                                    )
                                )}
                                <div className={`max-w-xl p-3 rounded-xl ${isCurrentUser ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
                                    <p className="text-gray-300">{reply.text}</p>
                                </div>
                                 {isCurrentUser && (
                                    currentUser.avatarUrl ? (
                                        <img src={currentUser.avatarUrl} alt={currentUser.name} className="h-10 w-10 rounded-full flex-shrink-0" />
                                    ) : (
                                        <UserCircleIcon className="h-10 w-10 text-gray-500 flex-shrink-0" />
                                    )
                                )}
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                <div className="flex-shrink-0 p-4 border-t border-gray-700 bg-gray-800 flex items-center gap-3 justify-between">
                    {canReply ? (
                        <div className="flex items-center gap-3 flex-grow">
                             <input
                                type="text"
                                value={replyText}
                                onChange={e => setReplyText(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && !isSending && handleSendReply()}
                                placeholder="Digite sua resposta..."
                                disabled={isSending}
                                className="flex-grow bg-gray-700 border border-gray-600 rounded-full py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                            <Button onClick={handleSendReply} disabled={isSending || !replyText.trim()} className="rounded-full !p-3">
                                {isSending ? <Spinner /> : <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>}
                            </Button>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400 text-center flex-grow">Respostas não são permitidas neste aviso.</p>
                    )}
                    <button onClick={handleDelete} className="p-2 text-gray-400 hover:text-red-400" title="Remover conversa da sua visão">
                        <TrashIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </Modal>
    );
};

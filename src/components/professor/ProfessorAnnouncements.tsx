import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as FirebaseService from '../../services/firebaseService';
import { User, TeacherMessage, MessageReply } from '../../types';
import { Card, Button, Spinner } from '../ui';
import { BellIcon, ArrowRightIcon, UserCircleIcon, ExclamationTriangleIcon, XCircleIcon } from '../Icons';

export const ProfessorAnnouncements: React.FC<{ teacher: User; allStudents: User[] }> = ({ teacher, allStudents }) => {
    const [messages, setMessages] = useState<TeacherMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    const participants = useMemo(() => {
        const users: { [id: string]: User } = { [teacher.id]: teacher };
        allStudents.forEach(s => { users[s.id] = s; });
        return users;
    }, [teacher, allStudents]);

    useEffect(() => {
        setIsLoading(true);
        const unsubscribe = FirebaseService.listenToMessagesForTeachers([teacher.id], (messages) => {
            setMessages(messages);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [teacher.id]);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isChatOpen, selectedStudentId]);

    const dms = useMemo(() => messages.filter(m => m.studentId !== null), [messages]);
    const currentChatThread = useMemo(() => dms.find(m => m.studentId === selectedStudentId), [dms, selectedStudentId]);
    const announcementsAndNotifications = useMemo(() => messages.filter(m => m.studentId === null), [messages]);

    const handlePostAnnouncement = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        await FirebaseService.addMessage({
            senderId: teacher.id,
            teacherId: teacher.id,
            message: newMessage,
            studentId: null,
        });
        setNewMessage('');
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedStudentId) return;

        if (currentChatThread) {
            await FirebaseService.addReplyToMessage(currentChatThread.id, {
                senderId: teacher.id,
                name: teacher.name || teacher.username,
                avatarUrl: teacher.avatarUrl,
                text: newMessage,
            });
        } else {
            await FirebaseService.addMessage({
                senderId: teacher.id,
                teacherId: teacher.id,
                message: newMessage,
                studentId: selectedStudentId,
            });
        }
        setNewMessage('');
    };

    const handleDismissNotification = async (messageId: string) => {
        try {
            await FirebaseService.deleteMessageForUser(messageId, teacher.id);
        } catch (error) {
            console.error("Failed to dismiss notification:", error);
        }
    };
    
    const renderAnnouncementsView = () => (
        <>
            <div className="flex justify-between items-center">
                 <h3 className="text-xl font-bold text-white mb-4 flex items-center"><BellIcon className="h-6 w-6 mr-3 text-cyan-400" aria-hidden="true"/> Mural de Avisos</h3>
                 <Button onClick={() => setIsChatOpen(true)} className="text-sm py-2 px-4">Chat com Aluno</Button>
            </div>
            <form onSubmit={handlePostAnnouncement} className="space-y-3 mb-6">
                <label htmlFor="new-announcement" className="sr-only">Novo aviso</label>
                <textarea
                    id="new-announcement"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Escreva um novo aviso para todos..."
                    rows={3}
                    className="block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-cyan-500 focus:border-cyan-500"
                />
                <div className="text-right">
                    <Button type="submit" disabled={!newMessage.trim()} className="py-2 px-4 text-sm">
                        Publicar Aviso
                    </Button>
                </div>
            </form>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {isLoading ? <div className="flex justify-center"><Spinner /></div>
                 : announcementsAndNotifications.length > 0 ? announcementsAndNotifications.map(msg => {
                     if (msg.type === 'system') {
                        return (
                             <div key={msg.id} className="relative text-sm p-3 rounded-lg bg-indigo-900/50 border border-indigo-700">
                                <button
                                    onClick={() => handleDismissNotification(msg.id)}
                                    className="absolute top-2 right-2 p-1 text-indigo-300 hover:text-white"
                                    aria-label="Dispensar notificação"
                                >
                                    <XCircleIcon className="h-5 w-5" />
                                </button>
                                <p className="font-semibold text-indigo-300 flex items-center gap-2 pr-6"><ExclamationTriangleIcon className="h-5 w-5"/> Erro Reportado</p>
                                <p className="text-gray-200 mt-1">{msg.message}</p>
                                <span className="text-xs text-gray-500 mt-2 block"><time dateTime={new Date(msg.timestamp).toISOString()}>{new Date(msg.timestamp).toLocaleString('pt-BR')}</time></span>
                            </div>
                        )
                     }
                     // Regular broadcast
                     return (
                         <div key={msg.id} className="text-sm p-3 rounded-lg bg-gray-900/50">
                            <p className="text-gray-200">{msg.message}</p>
                            <span className="text-xs text-gray-500 mt-2 block"><time dateTime={new Date(msg.timestamp).toISOString()}>{new Date(msg.timestamp).toLocaleString('pt-BR')}</time></span>
                        </div>
                     );
                 }) : <p className="text-gray-500 text-center text-sm py-4">Nenhum aviso no mural.</p>}
            </div>
        </>
    );

    const renderChatView = () => (
        <div className="flex flex-col h-[550px]">
            <div className="flex-shrink-0 flex justify-between items-center pb-4 mb-4 border-b border-gray-700">
                <Button onClick={() => { setIsChatOpen(false); setSelectedStudentId(''); setNewMessage('')}} className="text-sm py-2 px-3 bg-gray-600 hover:bg-gray-500">
                    <ArrowRightIcon className="h-4 w-4 mr-2 transform rotate-180"/>
                    Voltar
                </Button>
                <select 
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 text-sm"
                >
                    <option value="" disabled>Selecione um aluno</option>
                    {allStudents.map(student => (
                        <option key={student.id} value={student.id}>{student.name || student.username}</option>
                    ))}
                </select>
            </div>
            <div className="flex-grow p-2 overflow-y-auto space-y-4 bg-gray-900/50 rounded-lg">
                {!selectedStudentId ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        Selecione um aluno para ver a conversa.
                    </div>
                ) : (
                    <>
                        {currentChatThread && (
                            <>
                                 <div className="flex items-start gap-3 justify-start">
                                    {participants[currentChatThread.teacherId]?.avatarUrl ? (
                                        <img src={participants[currentChatThread.teacherId]?.avatarUrl} alt={participants[currentChatThread.teacherId]?.name} className="h-8 w-8 rounded-full flex-shrink-0" />
                                    ) : (
                                        <UserCircleIcon className="h-8 w-8 text-gray-500 flex-shrink-0" />
                                    )}
                                    <div className={`max-w-md p-3 rounded-xl bg-gray-700 text-gray-200`}>
                                        <p>{currentChatThread.message}</p>
                                    </div>
                                </div>
                                {(currentChatThread.replies || []).map((reply: MessageReply, index: number) => {
                                    const isCurrentUser = reply.senderId === teacher.id;
                                    const sender = participants[reply.senderId];
                                    return (
                                        <div key={index} className={`flex items-start gap-3 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                                            {!isCurrentUser && (sender?.avatarUrl ? <img src={sender.avatarUrl} alt={sender.name} className="h-8 w-8 rounded-full" /> : <UserCircleIcon className="h-8 w-8 text-gray-500" />)}
                                            <div className={`max-w-md p-3 rounded-xl ${isCurrentUser ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
                                                <p>{reply.text}</p>
                                            </div>
                                            {isCurrentUser && (teacher.avatarUrl ? <img src={teacher.avatarUrl} alt={teacher.name} className="h-8 w-8 rounded-full" /> : <UserCircleIcon className="h-8 w-8 text-gray-500" />)}
                                        </div>
                                    );
                                })}
                            </>
                        )}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>
            <form onSubmit={handleSendMessage} className="flex-shrink-0 pt-4 flex items-center gap-3">
                <input
                    type="text"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder={selectedStudentId ? "Digite sua mensagem..." : "Selecione um aluno"}
                    disabled={!selectedStudentId}
                    className="flex-grow bg-gray-700 border border-gray-600 rounded-full py-2 px-4 text-white disabled:opacity-50"
                />
                <Button type="submit" disabled={!newMessage.trim() || !selectedStudentId} className="rounded-full !p-3">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
                </Button>
            </form>
        </div>
    );

    return (
        <Card className="p-6">
            {isChatOpen ? renderChatView() : renderAnnouncementsView()}
        </Card>
    );
};
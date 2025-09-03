import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { Modal, Button } from '../ui';

interface NewMessageModalProps {
    isOpen: boolean;
    onClose: () => void;
    teachers: User[];
    onSendMessage: (teacherId: string, text: string) => Promise<void>;
}

export const NewMessageModal: React.FC<NewMessageModalProps> = ({ isOpen, onClose, teachers, onSendMessage }) => {
    const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
    const [messageText, setMessageText] = useState('');
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        if (isOpen && teachers.length > 0 && !selectedTeacherId) {
            setSelectedTeacherId(teachers[0].id);
        }
        // If the selected teacher is no longer in the list, reset to the first one
        if (isOpen && teachers.length > 0 && !teachers.some(t => t.id === selectedTeacherId)) {
            setSelectedTeacherId(teachers[0].id);
        }
    }, [isOpen, teachers, selectedTeacherId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTeacherId || !messageText.trim()) return;

        setIsSending(true);
        await onSendMessage(selectedTeacherId, messageText);
        setIsSending(false);
        setMessageText('');
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Nova Mensagem para o Professor">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="teacher-select" className="block text-sm font-medium text-gray-300">
                        Professor(a)
                    </label>
                    <select
                        id="teacher-select"
                        value={selectedTeacherId}
                        onChange={e => setSelectedTeacherId(e.target.value)}
                        className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-cyan-500 focus:border-cyan-500"
                        required
                    >
                        {teachers.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="message-text" className="block text-sm font-medium text-gray-300">
                        Mensagem
                    </label>
                    <textarea
                        id="message-text"
                        value={messageText}
                        onChange={e => setMessageText(e.target.value)}
                        rows={5}
                        className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-cyan-500 focus:border-cyan-500"
                        required
                        placeholder="Digite sua dúvida ou mensagem aqui..."
                    />
                </div>
                <div className="pt-4 flex justify-end">
                    <Button type="submit" disabled={isSending || !messageText.trim() || !selectedTeacherId}>
                        {isSending ? 'Enviando...' : 'Enviar Mensagem'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

import React from 'react';
import { Badge } from '../../types';
import { Modal, Button } from '../ui';

export const BadgeAwardModal: React.FC<{ isOpen: boolean; onClose: () => void; badges: Badge[] }> = ({ isOpen, onClose, badges }) => {
    if (!isOpen || badges.length === 0) return null;
    const badge = badges[0];
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Nova Conquista!">
            <div className="text-center p-4">
                <badge.icon className="h-24 w-24 text-yellow-400 mx-auto animate-bounce" />
                <h3 className="text-3xl font-bold mt-4">{badge.name}</h3>
                <p className="text-lg text-gray-300 mt-2">{badge.description}</p>
                <p className="text-xl text-yellow-400 mt-4">Parabéns!</p>
                <Button onClick={onClose} className="mt-6">Continuar</Button>
            </div>
        </Modal>
    );
};

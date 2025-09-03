import React from 'react';
import { Modal, Button } from '../ui';
import { TrophyIcon } from '../Icons';

const Confetti: React.FC = () => {
    const confettiCount = 50;
    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
    
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {Array.from({ length: confettiCount }).map((_, i) => (
                <div
                    key={i}
                    className="confetti"
                    style={{
                        left: `${Math.random() * 100}%`,
                        animationDelay: `${Math.random() * 3}s`,
                        animationDuration: `${2 + Math.random() * 2}s`,
                        backgroundColor: colors[Math.floor(Math.random() * colors.length)]
                    }}
                />
            ))}
        </div>
    );
};

export const LevelUpModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    newLevel: number;
    levelTitle: string;
}> = ({ isOpen, onClose, newLevel, levelTitle }) => {
    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Parabéns!">
            <div className="relative text-center p-4 overflow-hidden">
                <Confetti />
                <TrophyIcon className="h-24 w-24 text-yellow-400 mx-auto animate-bounce" />
                <h3 className="text-4xl font-extrabold mt-4 text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-400">
                    LEVEL UP!
                </h3>
                <p className="text-lg text-gray-300 mt-4">Você alcançou o</p>
                <p className="text-3xl font-bold text-white">Nível {newLevel}</p>
                <p className="text-xl font-semibold text-cyan-400 mt-2">"{levelTitle}"</p>
                
                <p className="text-gray-400 mt-6">Continue assim, sua aprovação está cada vez mais perto!</p>
                
                <Button onClick={onClose} className="mt-8">
                    Continuar
                </Button>
            </div>
        </Modal>
    );
};
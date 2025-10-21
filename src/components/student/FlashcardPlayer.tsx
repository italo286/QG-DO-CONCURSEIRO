
import React, { useState } from 'react';
import { Flashcard } from '../../types';
import { ArrowRightIcon } from '../Icons';

const CARD_COLORS = [
    'from-cyan-500 to-blue-500',
    'from-green-500 to-teal-500',
    'from-purple-500 to-indigo-500',
    'from-pink-500 to-rose-500',
    'from-orange-500 to-amber-500',
];

export const FlashcardPlayer: React.FC<{ 
    flashcards: Flashcard[];
    onReview?: (flashcardId: string, performance: 'good' | 'bad') => void;
}> = ({ flashcards, onReview }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);

    if (!flashcards || flashcards.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400">
                <p>Nenhum flashcard disponível para este tópico.</p>
            </div>
        );
    }
    
    const goToNext = () => {
        setIsFlipped(false);
        setTimeout(() => {
            setCurrentIndex((prev) => (prev + 1) % flashcards.length);
        }, 150); // wait for flip animation
    };

    const goToPrev = () => {
        setIsFlipped(false);
        setTimeout(() => {
            setCurrentIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length);
        }, 150);
    };

    const currentCard = flashcards[currentIndex];
    const cardColor = CARD_COLORS[currentIndex % CARD_COLORS.length];

    const handleReviewClick = (performance: 'good' | 'bad') => {
        if(onReview) {
            onReview(currentCard.id, performance);
        }
        goToNext();
    }

    return (
        <div className="flex flex-col items-center justify-center h-full p-4 space-y-6">
            <div className="w-full max-w-2xl text-center">
                <h3 className="text-xl font-bold">Flashcards</h3>
                <p className="text-gray-400">Card {currentIndex + 1} de {flashcards.length}</p>
                <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
                    <div className="bg-cyan-400 h-1.5 rounded-full" style={{ width: `${((currentIndex + 1) / flashcards.length) * 100}%` }}></div>
                </div>
            </div>

            <div className="w-full max-w-2xl h-80 perspective-1000">
                <div
                    className={`relative w-full h-full transform-style-3d transition-transform duration-500 ${isFlipped ? 'rotate-y-180' : ''}`}
                    onClick={() => setIsFlipped(!isFlipped)}
                >
                    {/* Front */}
                    <div className={`absolute w-full h-full backface-hidden rounded-xl shadow-lg flex items-center justify-center p-6 text-center bg-gradient-to-br ${cardColor} cursor-pointer`}>
                        <h4 className="text-2xl md:text-3xl font-bold text-white">{currentCard.front}</h4>
                    </div>
                    {/* Back */}
                    <div className={`absolute w-full h-full backface-hidden rotate-y-180 rounded-xl shadow-lg flex items-center justify-center p-6 text-left bg-gradient-to-br ${cardColor} cursor-pointer overflow-y-auto`}>
                        <p className="text-white">{currentCard.back}</p>
                    </div>
                </div>
            </div>
            
            <div className="flex items-center space-x-4">
                <button onClick={goToPrev} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-full">
                    <ArrowRightIcon className="h-6 w-6 transform rotate-180"/>
                    <span className="sr-only">Anterior</span>
                </button>
                 {onReview ? (
                    <div className="flex items-center space-x-2">
                        <button onClick={() => handleReviewClick('bad')} className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm">Revisar de Novo</button>
                        <button onClick={() => handleReviewClick('good')} className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm">Lembrei</button>
                    </div>
                ) : (
                    <button onClick={() => setIsFlipped(!isFlipped)} className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold">
                        Virar Card
                    </button>
                )}
                <button onClick={goToNext} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-full">
                    <ArrowRightIcon className="h-6 w-6"/>
                    <span className="sr-only">Próximo</span>
                </button>
            </div>
        </div>
    );
};

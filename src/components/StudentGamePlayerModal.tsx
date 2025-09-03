import React, { useState, useEffect, DragEvent, useRef, useCallback, TouchEvent } from 'react';
import { MiniGame, MemoryGameData, AssociationGameData, OrderGameData, IntruderGameData, CategorizeGameData, MiniGameType } from '../types';
import { Modal, Button } from './ui';
import { TrophyIcon, GameControllerIcon, HeartIcon } from './Icons';

// Helper function to shuffle an array
const shuffle = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

const MemoryGame: React.FC<{ data: MemoryGameData, onComplete: () => void, onError: () => void }> = ({ data, onComplete, onError }) => {
    const [cards, setCards] = useState<{ id: number, value: string, flipped: boolean, matched: boolean }[]>([]);
    const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
    const [isChecking, setIsChecking] = useState(false);

    useEffect(() => {
        const gameCards = shuffle([...data.items, ...data.items]).map((value, id) => ({ id, value, flipped: false, matched: false }));
        setCards(gameCards);
    }, [data]);

    useEffect(() => {
        if (flippedIndices.length === 2) {
            setIsChecking(true);
            const [firstIndex, secondIndex] = flippedIndices;
            if (cards[firstIndex].value === cards[secondIndex].value) {
                setCards(prev => prev.map(card => (card.id === firstIndex || card.id === secondIndex ? { ...card, matched: true } : card)));
                setFlippedIndices([]);
                setIsChecking(false);
            } else {
                onError();
                setTimeout(() => {
                    setCards(prev => prev.map(card => (card.id === firstIndex || card.id === secondIndex ? { ...card, flipped: false } : card)));
                    setFlippedIndices([]);
                    setIsChecking(false);
                }, 1000);
            }
        }
    }, [flippedIndices, cards, onError]);

    useEffect(() => {
        if (cards.length > 0 && cards.every(c => c.matched)) {
            setTimeout(() => onComplete(), 500);
        }
    }, [cards, onComplete]);

    const handleFlip = (index: number) => {
        if (!isChecking && flippedIndices.length < 2 && !cards[index].flipped && !cards[index].matched) {
            setCards(prev => prev.map(card => (card.id === index ? { ...card, flipped: true } : card)));
            setFlippedIndices(prev => [...prev, index]);
        }
    };

    return (
        <div className="relative">
             <div className="grid grid-cols-4 md:grid-cols-6 gap-2 md:gap-4">
                {cards.map((card, index) => (
                    <div key={card.id} className="perspective-1000" onClick={() => handleFlip(index)}>
                        <div className={`transform-style-3d transition-transform duration-500 w-full aspect-square ${card.flipped ? 'rotate-y-180' : ''}`}>
                            <div className="absolute w-full h-full backface-hidden flex items-center justify-center bg-cyan-600 rounded-lg cursor-pointer">
                                <span className="text-3xl font-bold text-white">?</span>
                            </div>
                            <div className={`absolute w-full h-full backface-hidden rotate-y-180 flex items-center justify-center rounded-lg ${card.matched ? 'bg-green-700' : 'bg-gray-700'}`}>
                                <span className="text-center text-xs md:text-sm p-1">{card.value}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AssociationGame: React.FC<{ data: AssociationGameData, onComplete: () => void, onError: () => void }> = ({ data, onComplete, onError }) => {
    const [concepts, setConcepts] = useState<{ value: string, matched: boolean }[]>([]);
    const [definitions, setDefinitions] = useState<{ value: string, matched: boolean, isDropTarget: boolean }[]>([]);
    const [touchDrag, setTouchDrag] = useState<{ concept: string, ghost: HTMLElement } | null>(null);

    useEffect(() => {
        const conceptsArr = data.pairs.map(p => ({ value: p.concept, matched: false }));
        const definitionsArr = data.pairs.map(p => ({ value: p.definition, matched: false, isDropTarget: false }));
        setConcepts(shuffle(conceptsArr));
        setDefinitions(shuffle(definitionsArr));
    }, [data]);

    useEffect(() => {
        if (concepts.length > 0 && concepts.every(c => c.matched)) {
            setTimeout(() => onComplete(), 500);
        }
    }, [concepts, onComplete]);

    const checkAssociation = (concept: string, definition: string) => {
        const originalPair = data.pairs.find(p => p.concept === concept);
        if (originalPair && originalPair.definition === definition) {
            setConcepts(prev => prev.map(c => c.value === concept ? {...c, matched: true} : c));
            setDefinitions(prev => prev.map(d => d.value === definition ? {...d, matched: true} : d));
        } else {
            onError();
        }
    };

    const handleDragStart = (e: DragEvent<HTMLDivElement>, concept: string) => {
        e.dataTransfer.setData('concept', concept);
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>, definitionValue: string) => {
        e.preventDefault();
        setDefinitions(defs => defs.map(d => d.value === definitionValue ? { ...d, isDropTarget: true } : { ...d, isDropTarget: false }));
    };
    
    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDefinitions(defs => defs.map(d => ({ ...d, isDropTarget: false })));
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>, definition: string) => {
        e.preventDefault();
        const concept = e.dataTransfer.getData('concept');
        setDefinitions(defs => defs.map(d => ({ ...d, isDropTarget: false })));
        checkAssociation(concept, definition);
    };
    
    const handleTouchStart = (e: TouchEvent<HTMLDivElement>, concept: string) => {
        const target = e.currentTarget;
        const rect = target.getBoundingClientRect();
        const ghost = target.cloneNode(true) as HTMLElement;
        ghost.style.position = 'fixed';
        ghost.style.top = `${rect.top}px`;
        ghost.style.left = `${rect.left}px`;
        ghost.style.width = `${rect.width}px`;
        ghost.style.height = `${rect.height}px`;
        ghost.style.zIndex = '1000';
        ghost.style.opacity = '0.8';
        ghost.style.pointerEvents = 'none';
        document.body.appendChild(ghost);

        setTouchDrag({ concept, ghost });
        target.style.opacity = '0.5';
    };

    const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
        if (!touchDrag) return;
        e.preventDefault();
        try {
            const touch = e.touches[0];
            touchDrag.ghost.style.top = `${touch.clientY - touchDrag.ghost.offsetHeight / 2}px`;
            touchDrag.ghost.style.left = `${touch.clientX - touchDrag.ghost.offsetWidth / 2}px`;
    
            document.querySelectorAll('.drop-target-highlight').forEach(el => el.classList.remove('drop-target-highlight'));
            const elementUnder = document.elementFromPoint(touch.clientX, touch.clientY);
            elementUnder?.closest('.drop-target')?.classList.add('drop-target-highlight');
        } catch (error) {
            console.error("Error handling touch move:", error);
        }
    };

    const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
        if (!touchDrag) return;
        try {
            e.preventDefault();
            
            // Momentarily hide the ghost to reliably find the element underneath
            touchDrag.ghost.style.display = 'none';
            const touch = e.changedTouches[0];
            const elementUnder = document.elementFromPoint(touch.clientX, touch.clientY);
            
            const dropTarget = elementUnder?.closest('.drop-target');
            if (dropTarget) {
                const definition = (dropTarget as HTMLElement).dataset.definition!;
                checkAssociation(touchDrag.concept, definition);
            }
        } finally {
            document.querySelectorAll('.drop-target-highlight').forEach(el => el.classList.remove('drop-target-highlight'));
            document.querySelectorAll('[data-concept]').forEach(el => ((el as HTMLElement).style.opacity = '1'));
            touchDrag.ghost.remove();
            setTouchDrag(null);
        }
    };

    return (
        <div className="flex gap-4 md:gap-8" onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
            <div className="w-1/2 space-y-2">
                {concepts.map(c => (
                    <div 
                        key={c.value} 
                        draggable={!c.matched}
                        onDragStart={e => handleDragStart(e, c.value)}
                        onTouchStart={e => !c.matched && handleTouchStart(e, c.value)}
                        data-concept={c.value}
                        className={`w-full p-3 rounded-lg text-left text-sm transition-colors ${c.matched ? 'bg-green-800/50 text-gray-500 line-through' : 'bg-gray-700 cursor-grab'}`}
                    >
                        {c.value}
                    </div>
                ))}
            </div>
            <div className="w-1/2 space-y-2">
                 {definitions.map(d => (
                    <div 
                        key={d.value} 
                        onDrop={e => handleDrop(e, d.value)}
                        onDragOver={e => handleDragOver(e, d.value)}
                        onDragLeave={handleDragLeave}
                        data-definition={d.value}
                        className={`drop-target w-full p-3 rounded-lg text-left text-sm transition-all duration-200 border-2 ${d.matched ? 'bg-green-800/50 border-transparent' : d.isDropTarget ? 'border-cyan-400 bg-cyan-900/50' : 'border-dashed border-gray-600'}`}
                    >
                        <span className={d.matched ? 'text-gray-500 line-through' : ''}>{d.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const OrderGame: React.FC<{ data: OrderGameData, onComplete: () => void, onError: () => void }> = ({ data, onComplete, onError }) => {
    const [items, setItems] = useState<string[]>([]);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [touchDrag, setTouchDrag] = useState<{ index: number, ghost: HTMLElement } | null>(null);
    const listRef = useRef<HTMLUListElement>(null);

    useEffect(() => {
        setItems(shuffle(data.items));
    }, [data]);

    const reorderItems = (dragIndex: number, dropIndex: number) => {
        if (dragIndex === dropIndex) return;
        const newItems = [...items];
        const [draggedItem] = newItems.splice(dragIndex, 1);
        newItems.splice(dropIndex, 0, draggedItem);
        setItems(newItems);
        setIsCorrect(null);
    }

    const handleDragStart = (e: DragEvent<HTMLLIElement>, index: number) => e.dataTransfer.setData('dragIndex', index.toString());
    const handleDrop = (e: DragEvent<HTMLLIElement>, dropIndex: number) => {
        const dragIndex = parseInt(e.dataTransfer.getData('dragIndex'));
        reorderItems(dragIndex, dropIndex);
    };
    const handleDragOver = (e: DragEvent<HTMLLIElement>) => e.preventDefault();
    
    const checkOrder = () => {
        const correct = items.every((item, index) => item === data.items[index]);
        setIsCorrect(correct);
        if (correct) {
            setTimeout(() => onComplete(), 1000);
        } else {
            onError();
        }
    };
    
    const handleTouchStart = (e: TouchEvent<HTMLLIElement>, index: number) => {
        const target = e.currentTarget;
        const rect = target.getBoundingClientRect();
        const ghost = target.cloneNode(true) as HTMLElement;
        ghost.style.position = 'fixed';
        ghost.style.top = `${rect.top}px`;
        ghost.style.left = `${rect.left}px`;
        ghost.style.width = `${rect.width}px`;
        ghost.style.height = `${rect.height}px`;
        ghost.style.zIndex = '1000';
        ghost.style.opacity = '0.8';
        ghost.style.pointerEvents = 'none';
        document.body.appendChild(ghost);

        setTouchDrag({ index, ghost });
        target.style.opacity = '0.5';
    };

    const handleTouchMove = (e: TouchEvent<HTMLUListElement>) => {
        if (!touchDrag) return;
        e.preventDefault();
        try {
            const touch = e.touches[0];
            touchDrag.ghost.style.top = `${touch.clientY - touchDrag.ghost.offsetHeight / 2}px`;
            touchDrag.ghost.style.left = `${touch.clientX - touchDrag.ghost.offsetWidth / 2}px`;

            const listItems = Array.from(listRef.current?.children || []) as HTMLLIElement[];
            for (const item of listItems) {
                const rect = item.getBoundingClientRect();
                if (touch.clientY > rect.top && touch.clientY < rect.bottom) {
                    const dropIndex = parseInt(item.dataset.index!);
                    if (dropIndex !== touchDrag.index) {
                        reorderItems(touchDrag.index, dropIndex);
                        setTouchDrag(prev => prev ? { ...prev, index: dropIndex } : null);
                    }
                    break;
                }
            }
        } catch (error) {
            console.error("Error during touch move:", error);
        }
    };

    const handleTouchEnd = () => {
        if (!touchDrag) return;
        try {
            document.querySelectorAll('[data-index]').forEach(el => ((el as HTMLElement).style.opacity = '1'));
        } finally {
            touchDrag.ghost.remove();
            setTouchDrag(null);
        }
    };
    
    return (
        <div className="space-y-4">
            <p className="text-center text-lg">{data.description}</p>
            <ul ref={listRef} className="space-y-2" onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
                {items.map((item, index) => (
                    <li 
                        key={`${item}-${index}`}
                        draggable 
                        data-index={index}
                        onDragStart={e => handleDragStart(e, index)} 
                        onDrop={e => handleDrop(e, index)} 
                        onDragOver={handleDragOver}
                        onTouchStart={e => handleTouchStart(e, index)}
                        className="p-3 bg-gray-700 rounded-lg cursor-move flex items-center space-x-2"
                    >
                        <span className="text-cyan-400 font-bold">{index + 1}.</span> 
                        <span>{item}</span>
                    </li>
                ))}
            </ul>
            <div className="text-center"><Button onClick={checkOrder}>Verificar Ordem</Button></div>
            {isCorrect === true && <p className="text-green-400 text-center font-bold">Correto!</p>}
            {isCorrect === false && <p className="text-red-400 text-center font-bold">Incorreto, tente novamente.</p>}
        </div>
    );
};

const IntruderGame: React.FC<{ data: IntruderGameData, onComplete: () => void, onError: () => void }> = ({ data, onComplete, onError }) => {
    const [options, setOptions] = useState<string[]>([]);
    const [status, setStatus] = useState<'playing' | 'correct' | 'incorrect'>('playing');

    useEffect(() => setOptions(shuffle([...data.correctItems, data.intruder])), [data]);

    const handleClick = (option: string) => {
        if (status !== 'playing') return;
        if (option === data.intruder) {
            setStatus('correct');
            setTimeout(() => onComplete(), 1000);
        } else {
            setStatus('incorrect');
            onError();
            setTimeout(() => setStatus('playing'), 1000);
        }
    };
    
    return (
        <div className="space-y-4">
            <p className="text-center text-lg">Encontre o intruso no grupo: <strong>{data.categoryName}</strong></p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {options.map(option => <Button key={option} onClick={() => handleClick(option)} disabled={status !== 'playing'}>{option}</Button>)}
            </div>
            {status === 'correct' && <p className="text-green-400 text-center font-bold">Correto! O intruso era "{data.intruder}".</p>}
            {status === 'incorrect' && <p className="text-red-400 text-center font-bold animate-pulse">Incorreto, tente novamente.</p>}
        </div>
    );
};

const CategorizeGame: React.FC<{ data: CategorizeGameData, onComplete: () => void, onError: () => void }> = ({ data, onComplete, onError }) => {
    const [unassignedItems, setUnassignedItems] = useState<string[]>([]);
    const [assignments, setAssignments] = useState<{ [categoryName: string]: string[] }>({});
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [selectedItem, setSelectedItem] = useState<{ item: string, source: string | null } | null>(null);

    useEffect(() => {
        const allItems = shuffle(data.categories.flatMap(c => c.items)) as string[];
        setUnassignedItems(allItems);
        setAssignments(data.categories.reduce((acc, cat) => ({ ...acc, [cat.name]: [] }), {}));
        setIsCorrect(null);
        setSelectedItem(null);
    }, [data]);

    const moveItem = (item: string, sourceCategory: string | null, targetCategory: string | null) => {
        if (sourceCategory === targetCategory) {
            setSelectedItem(null);
            return;
        };
        
        const newAssignments = { ...assignments };
        let newUnassigned = [...unassignedItems];

        if (sourceCategory) {
            newAssignments[sourceCategory] = newAssignments[sourceCategory].filter(i => i !== item);
        } else {
            newUnassigned = newUnassigned.filter(i => i !== item);
        }

        if (targetCategory) {
            newAssignments[targetCategory] = [...(newAssignments[targetCategory] || []), item];
        } else {
            newUnassigned.push(item);
        }
        
        setAssignments(newAssignments);
        setUnassignedItems(newUnassigned);
        setIsCorrect(null);
    };

    const handleItemClick = (item: string, source: string | null) => {
        if (selectedItem && selectedItem.item === item && selectedItem.source === source) {
            setSelectedItem(null);
        } else {
            setSelectedItem({ item, source });
        }
    };

    const handleTargetClick = (targetCategory: string | null) => {
        if (!selectedItem) return;
        moveItem(selectedItem.item, selectedItem.source, targetCategory);
        setSelectedItem(null);
    };
    
    const checkCategorization = () => {
        let correct = true;
        if (unassignedItems.length > 0) {
            correct = false;
        } else {
            for (const category of data.categories) {
                const assigned = assignments[category.name] || [];
                if (assigned.length !== category.items.length || !assigned.every(item => category.items.includes(item))) {
                    correct = false;
                    break;
                }
            }
        }
        
        setIsCorrect(correct);
        if (correct) {
            setTimeout(() => onComplete(), 1000);
        } else {
            onError();
        }
    };

    return (
        <div className="space-y-4">
            <p className="text-center text-lg">Selecione um item e depois clique na categoria de destino.</p>
            <div
                onClick={() => handleTargetClick(null)}
                className={`flex flex-wrap justify-center gap-2 p-4 bg-gray-900/50 rounded-lg min-h-[60px] border-2 border-dashed  transition-all
                    ${selectedItem ? 'border-cyan-500 bg-cyan-900/50 cursor-pointer' : 'border-gray-600'}`
                }
            >
                {unassignedItems.map(item => 
                    <div 
                        key={item} 
                        onClick={(e) => { e.stopPropagation(); handleItemClick(item, null); }} 
                        className={`p-2 bg-gray-600 rounded cursor-pointer transition-all 
                            ${selectedItem?.item === item && selectedItem.source === null ? 'ring-2 ring-offset-2 ring-offset-gray-900 ring-cyan-400 scale-105' : 'hover:bg-gray-500'}`
                        }
                    >
                        {item}
                    </div>
                )}
                {unassignedItems.length === 0 && <p className="text-gray-500">Clique aqui para desagrupar um item selecionado</p>}
            </div>
            <div className="flex flex-col md:flex-row gap-4 mt-4">
                 {data.categories.map(cat => (
                     <div 
                        key={cat.name} 
                        onClick={() => handleTargetClick(cat.name)}
                        className={`flex-1 p-4 bg-gray-800 rounded-lg min-h-[150px] border-2 border-dashed transition-all
                            ${selectedItem ? 'border-cyan-500 bg-cyan-900/50 cursor-pointer' : 'border-gray-700'}`
                        }
                    >
                         <h4 className="text-center font-bold mb-2 text-cyan-400">{cat.name}</h4>
                         <div className="space-y-2">
                             {(assignments[cat.name] || []).map(item => 
                                <div 
                                    key={item} 
                                    onClick={(e) => { e.stopPropagation(); handleItemClick(item, cat.name); }} 
                                    className={`p-2 bg-cyan-900 rounded cursor-pointer text-center transition-all 
                                        ${selectedItem?.item === item && selectedItem.source === cat.name ? 'ring-2 ring-offset-2 ring-offset-gray-800 ring-cyan-400 scale-105' : 'hover:bg-cyan-800'}`
                                    }
                                >
                                    {item}
                                </div>
                            )}
                         </div>
                     </div>
                 ))}
            </div>
            <div className="text-center mt-4"><Button onClick={checkCategorization}>Verificar</Button></div>
             {isCorrect === true && <p className="text-green-400 text-center font-bold">Correto!</p>}
            {isCorrect === false && <p className="text-red-400 text-center font-bold">Incorreto, tente novamente.</p>}
        </div>
    )
};

const getGameInstructions = (type: MiniGameType): string => {
    switch (type) {
        case 'memory': return "Encontre todos os pares de cartas correspondentes. Clique em uma carta para virá-la e tente encontrar seu par.";
        case 'association': return "Conecte os conceitos às suas definições corretas. Arraste um item da esquerda e solte sobre seu par na direita.";
        case 'order': return "Organize os itens na sequência correta. Arraste e solte os itens para reordená-los e depois clique em verificar.";
        case 'intruder': return "Identifique o item que não pertence ao grupo. Analise as opções e clique no intruso.";
        case 'categorize': return "Mova cada item para a sua categoria correta. Organize todos os itens para vencer.";
        default: return "Siga as instruções na tela para jogar.";
    }
};


export const StudentGamePlayerModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    game: MiniGame | null;
    onGameComplete: (gameId: string) => void;
    onGameError: () => void;
}> = ({ isOpen, onClose, game, onGameComplete, onGameError }) => {
    const [view, setView] = useState<'instructions' | 'playing' | 'completed'>('instructions');
    const gameWrapperRef = useRef<HTMLDivElement>(null);
    const [errorCount, setErrorCount] = useState(0);
    const [maxErrors, setMaxErrors] = useState(3);
    const [gameInstanceKey, setGameInstanceKey] = useState(0); // Used to force-remount/reset the game component

    useEffect(() => {
        if (isOpen && game) {
            setView('instructions');
            setErrorCount(0);
            setGameInstanceKey(prev => prev + 1); // Reset game on open
            if (game.type === 'memory') {
                const data = game.data as MemoryGameData;
                setMaxErrors(data.items.length); 
            } else {
                setMaxErrors(3); // Default for other games
            }
        }
    }, [isOpen, game]);

    const handleComplete = () => {
        setView('completed');
        if (game) onGameComplete(game.id);
    };

    const handleError = useCallback(() => {
        onGameError();
        const newErrorCount = errorCount + 1;
        setErrorCount(newErrorCount);
        
        if (gameWrapperRef.current) {
            gameWrapperRef.current.classList.remove('animate-shake');
            void gameWrapperRef.current.offsetWidth; // Trigger reflow
            gameWrapperRef.current.classList.add('animate-shake');
        }

        if (newErrorCount >= maxErrors) {
            setTimeout(() => {
                alert(`Você cometeu ${maxErrors} erros. O jogo será reiniciado para você praticar mais!`);
                setView('instructions');
                setErrorCount(0);
                setGameInstanceKey(prev => prev + 1); // This will reset the game component
            }, 850); // After shake animation
        }
    }, [onGameError, errorCount, maxErrors]);

    const handlePlayAgain = () => {
        setView('instructions');
        setErrorCount(0);
        setGameInstanceKey(prev => prev + 1);
    };
    
    const renderGame = () => {
        if (!game) return null;
        switch(game.type) {
            case 'memory': return <MemoryGame key={gameInstanceKey} data={game.data as MemoryGameData} onComplete={handleComplete} onError={handleError} />;
            case 'association': return <AssociationGame key={gameInstanceKey} data={game.data as AssociationGameData} onComplete={handleComplete} onError={handleError} />;
            case 'order': return <OrderGame key={gameInstanceKey} data={game.data as OrderGameData} onComplete={handleComplete} onError={handleError} />;
            case 'intruder': return <IntruderGame key={gameInstanceKey} data={game.data as IntruderGameData} onComplete={handleComplete} onError={handleError} />;
            case 'categorize': return <CategorizeGame key={gameInstanceKey} data={game.data as CategorizeGameData} onComplete={handleComplete} onError={handleError} />;
            default: return <p>Tipo de jogo não suportado.</p>;
        }
    };
    
    const renderInstructionsView = () => (
        <div className="text-center p-4">
            <GameControllerIcon className="h-24 w-24 text-cyan-400 mx-auto" />
            <h3 className="text-3xl font-bold mt-4">{game?.name}</h3>
            <p className="text-lg text-gray-300 mt-4">{game ? getGameInstructions(game.type) : ''}</p>
            <p className="text-sm text-yellow-300 mt-2">Você tem {maxErrors} chance(s) antes do jogo reiniciar.</p>
            <Button onClick={() => setView('playing')} className="mt-8">
                Começar
            </Button>
        </div>
    );
    
    const renderCompletedView = () => (
        <div className="text-center p-4">
            <TrophyIcon className="h-24 w-24 text-yellow-400 mx-auto animate-bounce" />
            <h3 className="text-3xl font-bold mt-4">Parabéns!</h3>
            <p className="text-lg text-gray-300 mt-2">Você completou o jogo e ganhou uma medalha!</p>
            <div className="mt-6 flex justify-center space-x-4">
                <Button onClick={handlePlayAgain} className="bg-gray-600 hover:bg-gray-500">Jogar Novamente</Button>
                <Button onClick={onClose}>Fechar</Button>
            </div>
        </div>
    );

    const LivesCounter = () => (
         <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1 bg-gray-900/50 rounded-full border border-gray-700">
            <HeartIcon className="h-5 w-5 text-red-500" />
            <span className="font-bold text-white text-lg">{maxErrors - errorCount}</span>
            <span className="sr-only">vidas restantes</span>
        </div>
    );

    const renderContent = () => {
        switch (view) {
            case 'instructions': return renderInstructionsView();
            case 'playing': return (
                <div className="relative">
                    <LivesCounter />
                    <div ref={gameWrapperRef}>{renderGame()}</div>
                </div>
            );
            case 'completed': return renderCompletedView();
        }
    }
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={game?.name || ''} size="3xl">
            {renderContent()}
        </Modal>
    );
};
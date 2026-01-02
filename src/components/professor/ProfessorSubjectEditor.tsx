
import React, { useState, useEffect, useCallback, DragEvent, TouchEvent } from 'react';
import * as FirebaseService from '../../services/firebaseService';
import { Subject, Topic, SubTopic } from '../../types';
import { Card, Button, Spinner, ColorPalettePicker, ConfirmModal } from '../ui';
import { PlusIcon, TrashIcon, PencilIcon, ChevronDownIcon, GeminiIcon, DocumentTextIcon, ClipboardCheckIcon, GameControllerIcon, FlashcardIcon, TagIcon, ChartLineIcon, VideoCameraIcon } from '../Icons';
import { AiTopicGeneratorModal } from './AiTopicGeneratorModal';
import { AiBulkTopicContentGeneratorModal } from './AiBulkTopicContentGeneratorModal';
import { ProfessorTopicEditor } from './ProfessorTopicEditor';
import { ProfessorSubTopicEditor } from './ProfessorSubTopicEditor';

const MaterialSummary: React.FC<{ content: Topic | SubTopic }> = ({ content }) => {
    const calculateTotal = (getter: (item: Topic | SubTopic) => any[] | undefined) => {
        let total = (getter(content) as any[])?.length || 0;
        if ('subtopics' in content && content.subtopics) { // Check if it's a Topic
            total += content.subtopics.reduce((sum, subtopic) => sum + ((getter(subtopic) as any[])?.length || 0), 0);
        }
        return total;
    };

    const summaryItems = [
        { label: 'PDFs da Aula', icon: DocumentTextIcon, count: calculateTotal(c => c.fullPdfs) },
        { label: 'PDFs de Resumo', icon: DocumentTextIcon, count: calculateTotal(c => c.summaryPdfs) },
        { label: 'PDFs de Raio X', icon: ChartLineIcon, count: calculateTotal(c => c.raioXPdfs) },
        { label: 'Vídeos', icon: VideoCameraIcon, count: calculateTotal(c => c.videoUrls) },
        { label: 'Questões de Conteúdo', icon: ClipboardCheckIcon, count: calculateTotal(c => c.questions) },
        { label: 'Questões (TEC)', icon: ClipboardCheckIcon, count: calculateTotal(c => c.tecQuestions) },
        { label: 'Jogos', icon: GameControllerIcon, count: calculateTotal(c => c.miniGames) },
        { label: 'Flashcards', icon: FlashcardIcon, count: calculateTotal(c => c.flashcards) },
        { label: 'Glossário', icon: TagIcon, count: calculateTotal(c => c.glossary) },
    ].filter(item => item.count > 0);

    if (summaryItems.length === 0) {
        return null;
    }

    return (
        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-2">
            {summaryItems.map(item => (
                <div key={item.label} className="flex items-center space-x-1.5 text-gray-400" title={item.label}>
                    <item.icon className="h-4 w-4" />
                    <span className="text-xs font-mono font-semibold">{item.count}</span>
                    <span className="sr-only">{item.label}</span>
                </div>
            ))}
        </div>
    );
};

export const ProfessorSubjectEditor: React.FC<{ 
    subject: Subject;
    onBack: () => void;
    setToastMessage: (message: string) => void;
}> = ({ subject, onBack, setToastMessage }) => {
    const [currentSubject, setCurrentSubject] = useState(subject);
    const [localName, setLocalName] = useState(subject.name);
    const [localDescription, setLocalDescription] = useState(subject.description);
    const [localColor, setLocalColor] = useState(subject.color);

    const [isSaving, setIsSaving] = useState(false);
    
    const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
    const [editingTopic, setEditingTopic] = useState<Topic | null>(null);

    const [isSubTopicModalOpen, setIsSubTopicModalOpen] = useState(false);
    const [editingSubTopic, setEditingSubTopic] = useState<SubTopic | null>(null);
    const [parentTopicForSubTopic, setParentTopicForSubTopic] = useState<Topic | null>(null);

    const [isAiTopicModalOpen, setIsAiTopicModalOpen] = useState(false);
    const [isAiBulkModalOpen, setIsAiBulkModalOpen] = useState(false);
    const [isAiBulkSubtopicModalOpen, setIsAiBulkSubtopicModalOpen] = useState(false);
    const [bulkSubtopicTargetTopic, setBulkSubtopicTargetTopic] = useState<Topic | null>(null);

    const [draggedTopicIndex, setDraggedTopicIndex] = useState<number | null>(null);
    const [draggedSubtopicInfo, setDraggedSubtopicInfo] = useState<{ parentIndex: number; subtopicIndex: number } | null>(null);

    const [confirmDeleteSubject, setConfirmDeleteSubject] = useState(false);
    const [confirmDeleteTopicData, setConfirmDeleteTopicData] = useState<{ id: string, name: string } | null>(null);
    const [confirmDeleteSubtopicData, setConfirmDeleteSubtopicData] = useState<{ id: string, name: string, parent: Topic } | null>(null);
    
    useEffect(() => {
        setCurrentSubject(subject);
        setLocalName(subject.name);
        setLocalDescription(subject.description);
        setLocalColor(subject.color);
    }, [subject]);

    const updateSubjectStateAndDb = useCallback(async (updatedSubject: Subject) => {
        setIsSaving(true);
        setCurrentSubject(updatedSubject); 
        await FirebaseService.updateSubject(updatedSubject);
        setIsSaving(false);
    }, []);


    const handleDetailsBlur = () => {
        if (localName !== subject.name || localDescription !== subject.description) {
            const updatedSubject = { ...currentSubject, name: localName, description: localDescription, color: localColor };
            updateSubjectStateAndDb(updatedSubject);
            setToastMessage("Detalhes da disciplina salvos.");
        }
    };
    
    const executeDeleteSubject = async () => {
        setIsSaving(true);
        await FirebaseService.deleteSubject(subject.id);
        setIsSaving(false);
        setToastMessage("Disciplina excluída.");
        onBack();
    }
    
    const handleOpenTopicModal = (topic: Topic | null) => {
        setEditingTopic(topic);
        setIsTopicModalOpen(true);
    };

    const handleOpenSubTopicModal = (subtopic: SubTopic | null, parentTopic: Topic) => {
        setParentTopicForSubTopic(parentTopic);
        setEditingSubTopic(subtopic);
        setIsSubTopicModalOpen(true);
    };

    const handleOpenAiBulkSubtopic = (topic: Topic) => {
        setBulkSubtopicTargetTopic(topic);
        setIsAiBulkSubtopicModalOpen(true);
    };

    const handleSaveTopic = useCallback((topicToSave: Topic) => {
        let updatedTopics: Topic[];
        const isEditing = currentSubject.topics.some(t => t.id === topicToSave.id);

        if (isEditing) {
            updatedTopics = currentSubject.topics.map(t => t.id === topicToSave.id ? topicToSave : t);
            setToastMessage("Tópico atualizado!");
        } else {
            updatedTopics = [...currentSubject.topics, topicToSave];
             setToastMessage("Tópico criado!");
        }
        
        updateSubjectStateAndDb({...currentSubject, topics: updatedTopics});
        
        setIsTopicModalOpen(false);
        setEditingTopic(null);
    }, [currentSubject, updateSubjectStateAndDb, setToastMessage]);
    
    const handleSaveSubTopic = useCallback((subTopicToSave: SubTopic) => {
        if (!parentTopicForSubTopic) return;

        const isEditing = parentTopicForSubTopic.subtopics.some(st => st.id === subTopicToSave.id);
        let updatedSubtopics: SubTopic[];

        if (isEditing) {
            updatedSubtopics = parentTopicForSubTopic.subtopics.map(st => st.id === subTopicToSave.id ? subTopicToSave : st);
            setToastMessage("Subtópico atualizado!");
        } else {
            updatedSubtopics = [...parentTopicForSubTopic.subtopics, subTopicToSave];
            setToastMessage("Subtópico criado!");
        }

        const updatedParentTopic = { ...parentTopicForSubTopic, subtopics: updatedSubtopics };
        const updatedTopics = currentSubject.topics.map(t => t.id === updatedParentTopic.id ? updatedParentTopic : t);
        
        updateSubjectStateAndDb({...currentSubject, topics: updatedTopics});

        setIsSubTopicModalOpen(false);
        setEditingSubTopic(null);
        setParentTopicForSubTopic(null);
    }, [currentSubject, parentTopicForSubTopic, updateSubjectStateAndDb, setToastMessage]);

    const handleSaveAiTopics = useCallback((generatedItems: {name: string, description: string, subtopics: {name: string, description: string}[]}[]) => {
        const timestamp = Date.now();
        const newTopics: Topic[] = generatedItems.map((t, i) => {
            const topicId = `t${timestamp}${i}`;
            return {
                name: t.name,
                description: t.description,
                id: topicId,
                fullPdfs: [],
                summaryPdfs: [],
                raioXPdfs: [],
                videoUrls: [],
                questions: [],
                tecQuestions: [],
                miniGames: [],
                flashcards: [],
                glossary: [],
                subtopics: t.subtopics.map((st, j) => ({
                    name: st.name,
                    description: st.description,
                    id: `st${timestamp}${i}${j}`,
                    fullPdfs: [],
                    summaryPdfs: [],
                    raioXPdfs: [],
                    videoUrls: [],
                    questions: [],
                    tecQuestions: [],
                    miniGames: [],
                    flashcards: [],
                    glossary: []
                }))
            };
        });

        const updatedTopics = [...currentSubject.topics, ...newTopics];
        updateSubjectStateAndDb({...currentSubject, topics: updatedTopics});
        setIsAiTopicModalOpen(false);
        setToastMessage(`${newTopics.length} tópicos foram adicionados!`);
    }, [currentSubject, updateSubjectStateAndDb, setToastMessage]);

    const handleSaveAiBulkTopics = useCallback((newTopics: Topic[]) => {
        const updatedTopics = [...currentSubject.topics, ...newTopics];
        updateSubjectStateAndDb({...currentSubject, topics: updatedTopics});
        setToastMessage(`${newTopics.length} novas aulas foram criadas!`);
    }, [currentSubject, updateSubjectStateAndDb, setToastMessage]);

    const handleSaveAiBulkSubtopics = useCallback((newSubtopics: SubTopic[]) => {
        if (!bulkSubtopicTargetTopic) return;
        const updatedTopics = currentSubject.topics.map(t => {
            if (t.id === bulkSubtopicTargetTopic.id) {
                return {
                    ...t,
                    subtopics: [...(t.subtopics || []), ...newSubtopics]
                };
            }
            return t;
        });
        updateSubjectStateAndDb({ ...currentSubject, topics: updatedTopics });
        setToastMessage(`${newSubtopics.length} subtópicos adicionados a ${bulkSubtopicTargetTopic.name}!`);
        setIsAiBulkSubtopicModalOpen(false);
        setBulkSubtopicTargetTopic(null);
    }, [currentSubject, bulkSubtopicTargetTopic, updateSubjectStateAndDb, setToastMessage]);
    
    const executeDeleteTopic = () => {
        if (!confirmDeleteTopicData) return;
        const updatedTopics = currentSubject.topics.filter(t => t.id !== confirmDeleteTopicData.id);
        updateSubjectStateAndDb({...currentSubject, topics: updatedTopics});
        setToastMessage("Tópico removido.");
    };

    const executeDeleteSubtopic = () => {
         if (!confirmDeleteSubtopicData) return;
         const { id, parent } = confirmDeleteSubtopicData;
         const updatedSubtopics = parent.subtopics.filter(st => st.id !== id);
         const updatedParentTopic = { ...parent, subtopics: updatedSubtopics };
         const updatedTopics = currentSubject.topics.map(t => t.id === updatedParentTopic.id ? updatedParentTopic : t);
         updateSubjectStateAndDb({...currentSubject, topics: updatedTopics});
         setToastMessage("Subtópico removido.");
    };
    
    const handleCloseTopicModal = useCallback(() => { setIsTopicModalOpen(false); setEditingTopic(null); }, []);
    const handleCloseSubTopicModal = useCallback(() => { setIsSubTopicModalOpen(false); setEditingSubTopic(null); setParentTopicForSubTopic(null); }, []);
    const handleCloseAiTopicModal = useCallback(() => setIsAiTopicModalOpen(false), []);
    const handleCloseAiBulkModal = useCallback(() => setIsAiBulkModalOpen(false), []);
    const handleCloseAiBulkSubtopicModal = useCallback(() => { setIsAiBulkSubtopicModalOpen(false); setBulkSubtopicTargetTopic(null); }, []);

    const handleDragStart = (e: DragEvent<HTMLElement>, index: number) => {
        setDraggedTopicIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: DragEvent<HTMLElement>) => {
        e.preventDefault();
    };

    const handleDrop = (dropIndex: number) => {
        if (draggedTopicIndex === null || draggedTopicIndex === dropIndex) {
            setDraggedTopicIndex(null);
            return;
        }

        const newTopics = [...currentSubject.topics];
        const draggedItem = newTopics.splice(draggedTopicIndex, 1)[0];
        newTopics.splice(dropIndex, 0, draggedItem);
        
        const updatedSubject = { ...currentSubject, topics: newTopics };
        updateSubjectStateAndDb(updatedSubject); 
        setDraggedTopicIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedTopicIndex(null);
    };

    const handleTouchStart = (e: TouchEvent<HTMLElement>, index: number) => {
        setDraggedTopicIndex(index);
        e.currentTarget.classList.add('dragging-touch');
    };

    const handleTouchMove = (_e: TouchEvent<HTMLElement>) => {};

    const handleTouchEnd = (e: TouchEvent<HTMLElement>) => {
        if (draggedTopicIndex === null) return;
        const draggedElement = document.querySelector('.dragging-touch');
        draggedElement?.classList.remove('dragging-touch');
        const touch = e.changedTouches[0];
        const elementUnder = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!elementUnder) {
            setDraggedTopicIndex(null);
            return;
        }
        const dropTarget = elementUnder.closest('[data-topic-index]');
        if (dropTarget) {
            const dropIndex = Number((dropTarget as HTMLElement).dataset.topicIndex);
            if (dropIndex !== draggedTopicIndex) {
                handleDrop(dropIndex);
            }
        }
        setDraggedTopicIndex(null); 
    };
    
    const handleSubtopicDragStart = (e: DragEvent<HTMLDivElement>, parentIndex: number, subtopicIndex: number) => {
        setDraggedSubtopicInfo({ parentIndex, subtopicIndex });
        e.dataTransfer.effectAllowed = 'move';
        e.stopPropagation(); 
    };

    const handleSubtopicDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const reorderSubtopics = (dragParentIndex: number, dragSubtopicIndex: number, dropParentIndex: number, dropSubtopicIndex: number) => {
        if (dragParentIndex !== dropParentIndex) return;
        const newTopics = [...currentSubject.topics];
        const parentTopic = newTopics[dragParentIndex];
        const newSubtopics = [...parentTopic.subtopics];
        const [draggedItem] = newSubtopics.splice(dragSubtopicIndex, 1);
        newSubtopics.splice(dropSubtopicIndex, 0, draggedItem);
        parentTopic.subtopics = newSubtopics;
        const updatedSubject = { ...currentSubject, topics: newTopics };
        updateSubjectStateAndDb(updatedSubject);
    }

    const handleSubtopicDrop = (dropParentIndex: number, dropSubtopicIndex: number) => {
        if (!draggedSubtopicInfo || draggedSubtopicInfo.parentIndex !== dropParentIndex) {
            setDraggedSubtopicInfo(null);
            return;
        }
        const { parentIndex, subtopicIndex: dragSubtopicIndex } = draggedSubtopicInfo;
        if (dragSubtopicIndex !== dropSubtopicIndex) {
            reorderSubtopics(parentIndex, dragSubtopicIndex, dropParentIndex, dropSubtopicIndex);
        }
        setDraggedSubtopicInfo(null);
    };

    const handleSubtopicDragEnd = (e: DragEvent<HTMLDivElement>) => {
        setDraggedSubtopicInfo(null);
        e.stopPropagation();
    };
    
    const handleSubtopicTouchStart = (e: TouchEvent<HTMLDivElement>, parentIndex: number, subtopicIndex: number) => {
        setDraggedSubtopicInfo({ parentIndex, subtopicIndex });
        e.currentTarget.classList.add('dragging-touch');
        e.stopPropagation();
    };

    const handleSubtopicTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
        if (!draggedSubtopicInfo) return;
        const draggedElement = document.querySelector('.dragging-touch');
        draggedElement?.classList.remove('dragging-touch');
        const touch = e.changedTouches[0];
        const elementUnder = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!elementUnder) {
            setDraggedSubtopicInfo(null);
            return;
        }
        const dropTarget = elementUnder.closest('[data-subtopic-index]');
        if (dropTarget) {
            const dropParentIndex = Number((dropTarget as HTMLElement).dataset.parentIndex);
            const dropSubtopicIndex = Number((dropTarget as HTMLElement).dataset.subtopicIndex);
            if (draggedSubtopicInfo.parentIndex === dropParentIndex && draggedSubtopicInfo.subtopicIndex !== dropSubtopicIndex) {
                reorderSubtopics(draggedSubtopicInfo.parentIndex, draggedSubtopicInfo.subtopicIndex, dropParentIndex, dropSubtopicIndex);
            }
        }
        setDraggedSubtopicInfo(null);
        e.stopPropagation();
    };

    const handleTopicColorChange = (topicId: string, color: string | undefined) => {
        const updatedTopics = currentSubject.topics.map(t => 
            t.id === topicId ? { ...t, color } : t
        );
        updateSubjectStateAndDb({ ...currentSubject, topics: updatedTopics });
    };

    const handleSubtopicColorChange = (parentTopicId: string, subtopicId: string, color: string | undefined) => {
        const updatedTopics = currentSubject.topics.map(t => {
            if (t.id === parentTopicId) {
                const updatedSubtopics = t.subtopics.map(st => 
                    st.id === subtopicId ? { ...st, color } : st
                );
                return { ...t, subtopics: updatedSubtopics };
            }
            return t;
        });
        updateSubjectStateAndDb({ ...currentSubject, topics: updatedTopics });
    };


    return (
        <div className="max-w-4xl mx-auto">
            <ConfirmModal 
                isOpen={confirmDeleteSubject}
                onClose={() => setConfirmDeleteSubject(false)}
                onConfirm={executeDeleteSubject}
                title="Apagar Disciplina"
                message="Tem certeza que deseja apagar esta disciplina? Ela será removida de todos os cursos. Esta ação não pode ser desfeita."
                variant="danger"
                confirmLabel="Apagar permanentemente"
            />

            <ConfirmModal 
                isOpen={!!confirmDeleteTopicData}
                onClose={() => setConfirmDeleteTopicData(null)}
                onConfirm={executeDeleteTopic}
                title={`Apagar Tópico: ${confirmDeleteTopicData?.name}`}
                message="Tem certeza que deseja apagar este tópico e todos os seus subtópicos, questões e jogos associados?"
                variant="danger"
                confirmLabel="Apagar tudo"
            />

            <ConfirmModal 
                isOpen={!!confirmDeleteSubtopicData}
                onClose={() => setConfirmDeleteSubtopicData(null)}
                onConfirm={executeDeleteSubtopic}
                title={`Apagar Subtópico: ${confirmDeleteSubtopicData?.name}`}
                message="Tem certeza que deseja apagar este subtópico e todos os seus conteúdos associados?"
                variant="danger"
                confirmLabel="Apagar subtópico"
            />

            <Card className="p-6 relative">
                 {isSaving && <div className="absolute inset-0 bg-gray-900/50 flex justify-center items-center z-10 rounded-xl"><Spinner /></div>}
                 <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                        <ColorPalettePicker 
                            currentColor={localColor}
                            onColorSelect={(color) => {
                                setLocalColor(color);
                                const updatedSubject = { ...currentSubject, name: localName, description: localDescription, color: color };
                                updateSubjectStateAndDb(updatedSubject);
                                setToastMessage("Cor da disciplina atualizada.");
                            }}
                        />
                        <label htmlFor="subject-name-editor" className="sr-only">Nome da disciplina</label>
                        <input 
                            id="subject-name-editor"
                            type="text" 
                            value={localName}
                            onChange={e => setLocalName(e.target.value)}
                            onBlur={handleDetailsBlur}
                            className="text-2xl font-bold text-white bg-transparent border-b-2 border-transparent focus:border-cyan-500 focus:outline-none" 
                        />
                    </div>
                    <Button onClick={() => setConfirmDeleteSubject(true)} className="text-sm py-2 px-4 bg-red-600 hover:bg-red-700" aria-label={`Apagar disciplina ${currentSubject.name}`}>
                        <TrashIcon className="h-4 w-4" />
                    </Button>
                </div>
                 <label htmlFor="subject-description-editor" className="sr-only">Descrição da disciplina</label>
                 <textarea 
                    id="subject-description-editor"
                    value={localDescription}
                    onChange={e => setLocalDescription(e.target.value)}
                    onBlur={handleDetailsBlur}
                    rows={2} 
                    placeholder="Adicione uma descrição para a disciplina..."
                    className="mt-2 block w-full bg-gray-700/50 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-cyan-500 focus:border-cyan-500" />
            </Card>

            <section className="mt-8" aria-labelledby="topics-heading">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                    <h3 id="topics-heading" className="text-xl font-bold text-white">Tópicos e Subtópicos</h3>
                    <div className="flex flex-wrap gap-2">
                        <Button onClick={() => setIsAiBulkModalOpen(true)} className="py-2 text-sm bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600">
                             <GeminiIcon className="h-4 w-4 mr-2"/>
                             Gerar Aulas em Massa
                        </Button>
                        <Button onClick={() => setIsAiTopicModalOpen(true)} className="py-2 text-sm bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-500">
                            <GeminiIcon className="h-4 w-4 mr-2"/>
                            Extrair Estrutura IA
                        </Button>
                        <Button onClick={() => handleOpenTopicModal(null)} className="py-2 text-sm">
                            <PlusIcon className="h-4 w-4 mr-2" aria-hidden="true" />
                            Adicionar Tópico
                        </Button>
                    </div>
                </div>
                <div 
                    className="space-y-2"
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    {currentSubject.topics.map((topic, index) => (
                        <details 
                            key={topic.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={handleDragOver}
                            onDrop={() => handleDrop(index)}
                            onDragEnd={handleDragEnd}
                            onTouchStart={(e) => handleTouchStart(e, index)}
                            data-topic-index={index}
                            className={`bg-gray-800 rounded-lg border border-gray-700/50 transition-opacity ${draggedTopicIndex !== null ? 'cursor-grabbing' : 'cursor-grab'} ${draggedTopicIndex === index ? 'opacity-30' : 'opacity-100'}`}
                        >
                            <summary className="p-4 list-none cursor-pointer">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <ColorPalettePicker 
                                            currentColor={topic.color}
                                            onColorSelect={(color) => handleTopicColorChange(topic.id, color)}
                                        />
                                        <span className="font-semibold text-gray-200">{topic.name}</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <div className="flex bg-gray-700 rounded-md overflow-hidden border border-gray-600">
                                            <button 
                                                onClick={(e) => {e.stopPropagation(); handleOpenAiBulkSubtopic(topic)}} 
                                                className="p-1 px-2 text-cyan-400 hover:bg-gray-600 text-[10px] font-bold flex items-center border-r border-gray-600" 
                                                title="Gerar Subtópicos em Massa com IA"
                                            >
                                                <GeminiIcon className="h-3 w-3 mr-1"/> MASSA
                                            </button>
                                            <button 
                                                onClick={(e) => {e.stopPropagation(); handleOpenSubTopicModal(null, topic)}} 
                                                className="p-1 px-2 text-gray-300 hover:bg-gray-600 text-[10px] font-bold" 
                                                aria-label={`Adicionar subtópico em ${topic.name}`}
                                            >
                                                ADICIONAR
                                            </button>
                                        </div>
                                        <button onClick={(e) => {e.stopPropagation(); handleOpenTopicModal(topic)}} className="p-2 text-gray-400 hover:text-cyan-400" aria-label={`Editar tópico ${topic.name}`}><PencilIcon className="h-5 w-5"/></button>
                                        <button onClick={(e) => {e.stopPropagation(); setConfirmDeleteTopicData({ id: topic.id, name: topic.name })}} className="p-2 text-gray-400 hover:text-red-500" aria-label={`Apagar tópico ${topic.name}`}><TrashIcon className="h-5 w-5" /></button>
                                        <ChevronDownIcon className="h-5 w-5 transition-transform details-open:rotate-180" aria-hidden="true"/>
                                    </div>
                                </div>
                                <MaterialSummary content={topic} />
                            </summary>
                            <div className="border-t border-gray-700 px-4 pb-4">
                                {topic.subtopics.length > 0 ? (
                                    <div
                                        className="space-y-2 pt-3"
                                        onTouchMove={handleTouchMove}
                                        onTouchEnd={handleSubtopicTouchEnd}
                                    >
                                        {topic.subtopics.map((subtopic, subIndex) => (
                                            <div
                                                key={subtopic.id}
                                                draggable
                                                onDragStart={(e) => handleSubtopicDragStart(e, index, subIndex)}
                                                onDragOver={handleSubtopicDragOver}
                                                onDrop={() => handleSubtopicDrop(index, subIndex)}
                                                onDragEnd={handleSubtopicDragEnd}
                                                onTouchStart={(e) => handleSubtopicTouchStart(e, index, subIndex)}
                                                data-parent-index={index}
                                                data-subtopic-index={subIndex}
                                                className={`p-2 pl-4 bg-gray-700/50 rounded-md transition-opacity ${draggedSubtopicInfo !== null ? 'cursor-grabbing' : 'cursor-grab'} ${draggedSubtopicInfo?.parentIndex === index && draggedSubtopicInfo?.subtopicIndex === subIndex ? 'opacity-30' : 'opacity-100'}`}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-3">
                                                        <ColorPalettePicker 
                                                            currentColor={subtopic.color}
                                                            onColorSelect={(color) => handleSubtopicColorChange(topic.id, subtopic.id, color)}
                                                        />
                                                        <span className="text-sm text-gray-300">{subtopic.name}</span>
                                                    </div>
                                                    <div className="flex space-x-2">
                                                        <button onClick={() => handleOpenSubTopicModal(subtopic, topic)} className="p-1 text-gray-400 hover:text-cyan-400" aria-label={`Editar subtópico ${subtopic.name}`}><PencilIcon className="h-4 w-4"/></button>
                                                        <button onClick={() => setConfirmDeleteSubtopicData({ id: subtopic.id, name: subtopic.name, parent: topic })} className="p-1 text-gray-400 hover:text-red-500" aria-label={`Apagar subtópico ${subtopic.name}`}><TrashIcon className="h-4 w-4" /></button>
                                                    </div>
                                                </div>
                                                <MaterialSummary content={subtopic} />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 pt-3">Nenhum subtópico adicionado.</p>
                                )}
                            </div>
                        </details>
                    ))}
                    {currentSubject.topics.length === 0 && (
                        <Card className="text-center text-gray-400 p-6">
                            Nenhum tópico adicionado ainda. Use as ferramentas acima para começar.
                        </Card>
                    )}
                </div>
            </section>
            
            <AiTopicGeneratorModal
                isOpen={isAiTopicModalOpen}
                onClose={handleCloseAiTopicModal}
                onSave={handleSaveAiTopics}
            />

            <AiBulkTopicContentGeneratorModal
                isOpen={isAiBulkModalOpen}
                onClose={handleCloseAiBulkModal}
                onSave={handleSaveAiBulkTopics}
                mode="topic"
            />

            <AiBulkTopicContentGeneratorModal
                isOpen={isAiBulkSubtopicModalOpen}
                onClose={handleCloseAiBulkSubtopicModal}
                onSave={handleSaveAiBulkSubtopics}
                mode="subtopic"
            />

            <ProfessorTopicEditor
                isOpen={isTopicModalOpen}
                onClose={handleCloseTopicModal}
                onSave={handleSaveTopic}
                topic={editingTopic}
            />

            <ProfessorSubTopicEditor
                isOpen={isSubTopicModalOpen}
                onClose={handleCloseSubTopicModal}
                onSave={handleSaveSubTopic}
                subtopic={editingSubTopic}
            />
        </div>
    );
};

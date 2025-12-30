
import React, { useState, useEffect, useId } from 'react';
import * as GeminiService from '../../services/geminiService';
import { Modal, Button, Spinner } from '../ui';
import { GeminiIcon } from '../Icons';

type GeneratedTopic = {
    name: string; 
    description: string; 
    selected: boolean; 
    subtopics: {
        name: string; 
        description: string; 
        selected: boolean
    }[];
};

const EditableTopicItem: React.FC<{
    topic: GeneratedTopic;
    topicIndex: number;
    baseId: string;
    onTopicSelection: (index: number, selected: boolean) => void;
    onSubtopicSelection: (topicIndex: number, subtopicIndex: number, selected: boolean) => void;
    onUpdate: (topicIndex: number, subtopicIndex: number | null, field: 'name' | 'description', value: string) => void;
}> = ({ topic, topicIndex, baseId, onTopicSelection, onSubtopicSelection, onUpdate }) => {
    const [localName, setLocalName] = useState(topic.name);
    const [localDescription, setLocalDescription] = useState(topic.description);

    useEffect(() => {
        setLocalName(topic.name);
        setLocalDescription(topic.description);
    }, [topic]);
    
    return (
        <div className="p-3 bg-gray-900/50 rounded-lg">
            <div className="flex items-start space-x-3">
                 <input type="checkbox" checked={topic.selected} onChange={(e) => onTopicSelection(topicIndex, e.target.checked)} className="mt-2 h-5 w-5 rounded text-cyan-500 bg-gray-700 border-gray-600 focus:ring-cyan-600" aria-labelledby={`${baseId}-topic-name-${topicIndex}`}/>
                 <div className="flex-grow space-y-1">
                     <label htmlFor={`${baseId}-topic-name-${topicIndex}`} className="sr-only">Nome do tópico principal</label>
                     <input id={`${baseId}-topic-name-${topicIndex}`} type="text" value={localName} onChange={e => setLocalName(e.target.value)} onBlur={() => onUpdate(topicIndex, null, 'name', localName)} className="block w-full bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white text-sm font-semibold"/>
                     <label htmlFor={`${baseId}-topic-desc-${topicIndex}`} className="sr-only">Descrição do tópico principal</label>
                     <textarea id={`${baseId}-topic-desc-${topicIndex}`} value={localDescription} onChange={e => setLocalDescription(e.target.value)} onBlur={() => onUpdate(topicIndex, null, 'description', localDescription)} rows={1} className="block w-full bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white text-xs"/>
                 </div>
            </div>
            {topic.subtopics.length > 0 && (
                <div className="ml-8 mt-2 pl-4 border-l-2 border-gray-700 space-y-2">
                    {topic.subtopics.map((subtopic, subtopicIndex) => (
                         <EditableSubtopicItem 
                            key={subtopicIndex}
                            subtopic={subtopic}
                            topicIndex={topicIndex}
                            subtopicIndex={subtopicIndex}
                            baseId={baseId}
                            onSubtopicSelection={onSubtopicSelection}
                            onUpdate={onUpdate}
                         />
                    ))}
                </div>
            )}
         </div>
    )
};

const EditableSubtopicItem: React.FC<{
    subtopic: GeneratedTopic['subtopics'][0];
    topicIndex: number;
    subtopicIndex: number;
    baseId: string;
    onSubtopicSelection: (topicIndex: number, subtopicIndex: number, selected: boolean) => void;
    onUpdate: (topicIndex: number, subtopicIndex: number | null, field: 'name' | 'description', value: string) => void;
}> = ({ subtopic, topicIndex, subtopicIndex, baseId, onSubtopicSelection, onUpdate }) => {
    const [localName, setLocalName] = useState(subtopic.name);
    const [localDescription, setLocalDescription] = useState(subtopic.description);

    useEffect(() => {
        setLocalName(subtopic.name);
        setLocalDescription(subtopic.description);
    }, [subtopic]);

    return (
        <div className="flex items-start space-x-3">
             <input type="checkbox" checked={subtopic.selected} onChange={(e) => onSubtopicSelection(topicIndex, subtopicIndex, e.target.checked)} className="mt-2 h-4 w-4 rounded text-blue-500 bg-gray-600 border-gray-500 focus:ring-blue-600" aria-labelledby={`${baseId}-subtopic-name-${topicIndex}-${subtopicIndex}`} />
             <div className="flex-grow space-y-1">
                 <label htmlFor={`${baseId}-subtopic-name-${topicIndex}-${subtopicIndex}`} className="sr-only">Nome do subtópico</label>
                 <input id={`${baseId}-subtopic-name-${topicIndex}-${subtopicIndex}`} type="text" value={localName} onChange={e => setLocalName(e.target.value)} onBlur={() => onUpdate(topicIndex, subtopicIndex, 'name', localName)} className="block w-full bg-gray-600 border border-gray-500 rounded-md py-1 px-2 text-white text-xs font-semibold"/>
                  <label htmlFor={`${baseId}-subtopic-desc-${topicIndex}-${subtopicIndex}`} className="sr-only">Descrição do subtópico</label>
                 <textarea id={`${baseId}-subtopic-desc-${topicIndex}-${subtopicIndex}`} value={localDescription} onChange={e => setLocalDescription(e.target.value)} onBlur={() => onUpdate(topicIndex, subtopicIndex, 'description', localDescription)} rows={1} className="block w-full bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white text-xs"/>
             </div>
        </div>
    );
};


export const AiTopicGeneratorModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (topics: {name: string, description: string, subtopics: {name: string, description: string}[]}[]) => void;
}> = ({ isOpen, onClose, onSave }) => {
    const [text, setText] = useState('');
    const [generatedTopics, setGeneratedTopics] = useState<GeneratedTopic[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const baseId = useId();

    useEffect(() => {
        if (!isOpen) {
            setText('');
            setGeneratedTopics([]);
            setError('');
            setIsLoading(false);
        }
    }, [isOpen]);

    const handleGenerate = async () => {
        if (!text.trim()) {
            setError('Por favor, insira o texto base.');
            return;
        }
        setError('');
        setIsLoading(true);
        try {
            const topics = await GeminiService.generateTopicsFromText(text);
            setGeneratedTopics(topics.map(t => ({ 
                ...t, 
                selected: true,
                subtopics: t.subtopics.map((st: any) => ({ ...st, selected: true }))
            })));
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleTopicSelection = (index: number, selected: boolean) => {
        const newTopics = [...generatedTopics];
        newTopics[index].selected = selected;
        newTopics[index].subtopics.forEach((st: any) => st.selected = selected);
        setGeneratedTopics(newTopics);
    };

    const handleSubtopicSelection = (topicIndex: number, subtopicIndex: number, selected: boolean) => {
        const newTopics = [...generatedTopics];
        newTopics[topicIndex].subtopics[subtopicIndex].selected = selected;
        if (selected) {
            newTopics[topicIndex].selected = true;
        }
        setGeneratedTopics(newTopics);
    };

    const handleUpdate = (topicIndex: number, subtopicIndex: number | null, field: 'name' | 'description', value: string) => {
        const newTopics = [...generatedTopics];
        if (subtopicIndex === null) {
            newTopics[topicIndex] = {...newTopics[topicIndex], [field]: value};
        } else {
            newTopics[topicIndex].subtopics[subtopicIndex] = {...newTopics[topicIndex].subtopics[subtopicIndex], [field]: value};
        }
        setGeneratedTopics(newTopics);
    };


    const handleSave = () => {
        const selectedTopicsToSave = generatedTopics
            .filter(t => t.selected)
            .map(t => ({
                name: t.name,
                description: t.description,
                subtopics: t.subtopics
                    .filter((st: any) => st.selected)
                    .map((st: any) => ({ name: st.name, description: st.description }))
            }));
        onSave(selectedTopicsToSave);
    };
    
    const selectedCount = generatedTopics.filter(t => t.selected).length;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Gerar Tópicos com IA" size="3xl">
            <div className="space-y-4">
                <p className="text-gray-400">Cole o conteúdo (ex: índice de um livro) de onde os tópicos e subtópicos devem ser extraídos. A IA irá identificar, nomear e descrever cada item para você.</p>
                <label htmlFor="ai-topic-text" className="sr-only">Texto base para geração de tópicos</label>
                <textarea
                    id="ai-topic-text"
                    value={text}
                    onChange={e => setText(e.target.value)}
                    rows={8}
                    placeholder="Cole seu texto aqui..."
                    className="block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-cyan-500 focus:border-cyan-500"
                    disabled={isLoading}
                />
                <div className="text-center">
                    <Button onClick={handleGenerate} disabled={isLoading || !text.trim()}>
                        {isLoading ? <Spinner /> : <><GeminiIcon className="h-5 w-5 mr-2" /> Gerar Tópicos</>}
                    </Button>
                </div>
                {error && <p className="text-red-400 text-sm text-center" role="alert">{error}</p>}
                
                {generatedTopics.length > 0 && (
                    <div className="border-t border-gray-700 pt-4 space-y-4">
                        <h3 className="text-lg font-semibold">Tópicos e Subtópicos Gerados</h3>
                        <p className="text-sm text-gray-400">Revise a estrutura, edite se necessário e selecione os que deseja adicionar.</p>
                         <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                             {generatedTopics.map((topic, topicIndex) => (
                                 <EditableTopicItem
                                    key={topicIndex}
                                    topic={topic}
                                    topicIndex={topicIndex}
                                    baseId={baseId}
                                    onTopicSelection={handleTopicSelection}
                                    onSubtopicSelection={handleSubtopicSelection}
                                    onUpdate={handleUpdate}
                                 />
                             ))}
                         </div>
                         <div className="pt-4 flex justify-end">
                            <Button onClick={handleSave} disabled={selectedCount === 0}>
                                Adicionar {selectedCount} Tópico(s)
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

import React, { useState } from 'react';
import { Subject, Topic } from '../../types';
import * as FirebaseService from '../../services/firebaseService';
import { Card, Button, Spinner, Modal } from '../ui';
import { PlusIcon, TrashIcon, SparklesIcon, ArrowRightIcon } from '../Icons';
import { ProfessorTopicEditor } from './ProfessorTopicEditor';
import { AiTopicGeneratorModal } from './AiTopicGeneratorModal';

interface ProfessorSubjectEditorProps {
    subject: Subject;
    onBack: () => void;
    setToastMessage: (message: string) => void;
}

export const ProfessorSubjectEditor: React.FC<ProfessorSubjectEditorProps> = ({ subject, onBack, setToastMessage }) => {
    const [editedSubject, setEditedSubject] = useState<Subject>(subject);
    const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await FirebaseService.updateSubject(editedSubject);
            setToastMessage("Disciplina salva com sucesso!");
        } catch (error) {
            console.error("Erro ao salvar disciplina:", error);
            setToastMessage("Erro ao salvar disciplina.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddTopic = () => {
        const newTopic: Topic = {
            id: `topic-${Date.now()}`,
            name: 'Novo Tópico',
            description: '',
            fullPdfs: [],
            summaryPdfs: [],
            videoUrls: [],
            questions: [],
            miniGames: [],
            subtopics: [],
            flashcards: [],
            raioXPdfs: [],
            tecQuestions: [],
        };
        setEditedSubject(prev => ({...prev, topics: [...prev.topics, newTopic]}));
    };

    const handleUpdateTopic = (updatedTopic: Topic) => {
        setEditedSubject(prev => ({
            ...prev,
            topics: prev.topics.map(t => t.id === updatedTopic.id ? updatedTopic : t)
        }));
    };
    
    const handleDeleteTopic = (topicId: string) => {
        if(window.confirm("Tem certeza que deseja apagar este tópico e todo o seu conteúdo?")) {
            setEditedSubject(prev => ({
                ...prev,
                topics: prev.topics.filter(t => t.id !== topicId)
            }));
        }
    };
    
    const handleAiSave = (generatedTopics: {name: string, description: string, subtopics: {name: string, description: string}[]}[]) => {
        const newTopics: Topic[] = generatedTopics.map(t => ({
            id: `topic-${Date.now()}-${Math.random()}`,
            name: t.name,
            description: t.description,
            fullPdfs: [],
            summaryPdfs: [],
            videoUrls: [],
            questions: [],
            miniGames: [],
            flashcards: [],
            subtopics: t.subtopics.map(st => ({
                id: `subtopic-${Date.now()}-${Math.random()}`,
                name: st.name,
                description: st.description,
                fullPdfs: [],
                summaryPdfs: [],
                videoUrls: [],
                questions: [],
                miniGames: [],
                flashcards: [],
            }))
        }));
        
        setEditedSubject(prev => ({...prev, topics: [...prev.topics, ...newTopics]}));
        setIsAiModalOpen(false);
        setToastMessage(`${newTopics.length} tópico(s) adicionado(s) com sucesso!`);
    };

    if (selectedTopic) {
        return (
            <ProfessorTopicEditor 
                topic={selectedTopic} 
                onSave={handleUpdateTopic}
                onBack={() => setSelectedTopic(null)}
                onDelete={() => {
                    handleDeleteTopic(selectedTopic.id);
                    setSelectedTopic(null);
                }}
                setToastMessage={setToastMessage}
            />
        );
    }

    return (
        <div className="space-y-6">
            <Card className="p-6">
                <div className="flex justify-between items-start">
                    <div className="flex-grow">
                        <input
                            type="text"
                            value={editedSubject.name}
                            onChange={(e) => setEditedSubject({ ...editedSubject, name: e.target.value })}
                            className="bg-transparent text-2xl font-bold text-white w-full focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded-md p-1"
                            placeholder="Nome da Disciplina"
                        />
                         <textarea
                            value={editedSubject.description}
                            onChange={(e) => setEditedSubject({ ...editedSubject, description: e.target.value })}
                            className="mt-2 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white"
                            rows={2}
                            placeholder="Descrição da disciplina..."
                        />
                    </div>
                     <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
                        <Button onClick={handleSave} disabled={isSaving} className="text-sm py-2 px-4">{isSaving ? <Spinner /> : "Salvar Disciplina"}</Button>
                         <Button onClick={() => setIsDeleteModalOpen(true)} className="text-sm py-2 px-4 bg-red-600 hover:bg-red-700">
                             <TrashIcon className="h-4 w-4" />
                         </Button>
                    </div>
                </div>
            </Card>

            <Card className="p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">Tópicos da Disciplina</h3>
                    <div className="flex items-center gap-2">
                        <Button onClick={() => setIsAiModalOpen(true)} className="text-sm py-2 px-3">
                            <SparklesIcon className="h-4 w-4 mr-2" /> Gerar com IA
                        </Button>
                        <Button onClick={handleAddTopic} className="text-sm py-2 px-3">
                            <PlusIcon className="h-4 w-4 mr-2" /> Novo Tópico
                        </Button>
                    </div>
                </div>

                <div className="space-y-3">
                    {editedSubject.topics.map(topic => (
                        <Card key={topic.id} className="p-4 flex justify-between items-center hover:bg-gray-700/50 transition-colors">
                           <div>
                             <p className="font-semibold text-gray-200">{topic.name}</p>
                             <p className="text-xs text-gray-400">{topic.subtopics.length} subtópico(s)</p>
                           </div>
                           <Button onClick={() => setSelectedTopic(topic)} className="text-sm py-1 px-3">
                                Editar <ArrowRightIcon className="h-4 w-4 ml-1" />
                           </Button>
                        </Card>
                    ))}
                    {editedSubject.topics.length === 0 && <p className="text-center text-gray-500 py-4">Nenhum tópico adicionado.</p>}
                </div>
            </Card>

            <AiTopicGeneratorModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} onSave={handleAiSave} />
            
            <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Apagar Disciplina">
                <p>Tem certeza de que deseja apagar a disciplina "{subject.name}"? Todo o conteúdo, incluindo tópicos e questões, será permanentemente removido.</p>
                <div className="flex justify-end gap-4 mt-6">
                    <Button onClick={() => setIsDeleteModalOpen(false)} className="bg-gray-600 hover:bg-gray-500">Cancelar</Button>
                    <Button onClick={async () => {
                        await FirebaseService.deleteSubject(subject.id);
                        setToastMessage("Disciplina apagada com sucesso.");
                        onBack();
                    }} className="bg-red-600 hover:bg-red-700">Apagar</Button>
                </div>
            </Modal>
        </div>
    );
};

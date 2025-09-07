import React, { useState } from 'react';
import { Topic, SubTopic, Question, MiniGame } from '../../types';
import { Card, Button } from '../ui';
import { PlusIcon, SaveIcon, TrashIcon, ArrowRightIcon } from '../Icons';
import { ContentLinksEditor } from './ContentLinksEditor';
import { ProfessorSubTopicEditor } from './ProfessorSubTopicEditor';
import { ProfessorQuestionManager } from './ProfessorQuestionManager';
import { ProfessorGameManager } from './ProfessorGameManager';
import { ProfessorFlashcardEditorModal } from './ProfessorFlashcardEditorModal';
import { GlossaryEditor } from './GlossaryEditor';
import { BankProfileEditor } from './BankProfileEditor';

interface ProfessorTopicEditorProps {
    topic: Topic;
    onSave: (topic: Topic) => void;
    onBack: () => void;
    onDelete: () => void;
    setToastMessage: (message: string) => void;
}

export const ProfessorTopicEditor: React.FC<ProfessorTopicEditorProps> = ({ topic, onSave, onBack, onDelete, setToastMessage }) => {
    const [editedTopic, setEditedTopic] = useState<Topic>(topic);
    const [selectedSubtopic, setSelectedSubtopic] = useState<SubTopic | null>(null);
    const [view, setView] = useState<'details' | 'questions' | 'tec_questions' | 'games'>('details');
    const [isFlashcardModalOpen, setIsFlashcardModalOpen] = useState(false);
    const [isGlossaryModalOpen, setIsGlossaryModalOpen] = useState(false);

    const handleSave = () => {
        onSave(editedTopic);
        setToastMessage("Alterações no tópico salvas.");
    };
    
    const handleAddSubtopic = () => {
        const newSubtopic: SubTopic = {
            id: `subtopic-${Date.now()}`,
            name: "Novo Subtópico",
            description: "",
            fullPdfs: [],
            summaryPdfs: [],
            videoUrls: [],
            questions: [],
            miniGames: [],
            flashcards: [],
        };
        setEditedTopic(prev => ({...prev, subtopics: [...prev.subtopics, newSubtopic]}));
    };
    
    const handleUpdateSubtopic = (updatedSubtopic: SubTopic) => {
        setEditedTopic(prev => ({
            ...prev,
            subtopics: prev.subtopics.map(st => st.id === updatedSubtopic.id ? updatedSubtopic : st)
        }));
    };
    
    const handleDeleteSubtopic = (subtopicId: string) => {
         if (window.confirm("Tem certeza que deseja apagar este subtópico?")) {
            setEditedTopic(prev => ({
                ...prev,
                subtopics: prev.subtopics.filter(st => st.id !== subtopicId)
            }));
            setSelectedSubtopic(null);
        }
    };

    if (selectedSubtopic) {
        return <ProfessorSubTopicEditor
            subtopic={selectedSubtopic}
            onSave={handleUpdateSubtopic}
            onBack={() => setSelectedSubtopic(null)}
            onDelete={() => handleDeleteSubtopic(selectedSubtopic.id)}
            setToastMessage={setToastMessage}
        />
    }

    const renderDetailsView = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 space-y-4">
                <ContentLinksEditor content={editedTopic} setContent={setEditedTopic} />
                <BankProfileEditor bankProfilePdfs={editedTopic.bankProfilePdfs || []} onUpdatePdfs={(pdfs) => setEditedTopic(prev => ({...prev, bankProfilePdfs: pdfs}))} />
                <div>
                     <label className="font-semibold text-gray-300">URL do Mapa Mental (Opcional)</label>
                     <input
                         type="url"
                         placeholder="https://exemplo.com/mapa.png"
                         value={editedTopic.mindMapUrl || ''}
                         onChange={(e) => setEditedTopic(prev => ({...prev, mindMapUrl: e.target.value}))}
                         className="mt-2 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white"
                     />
                </div>
                <Button onClick={() => setIsFlashcardModalOpen(true)} className="w-full">Gerenciar Flashcards ({editedTopic.flashcards?.length || 0})</Button>
                <Button onClick={() => setIsGlossaryModalOpen(true)} className="w-full">Gerenciar Glossário ({editedTopic.glossary?.length || 0})</Button>
            </Card>
            <Card className="p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">Subtópicos</h3>
                    <Button onClick={handleAddSubtopic} className="text-sm py-1 px-2"><PlusIcon className="h-4 w-4 mr-1"/> Adicionar</Button>
                </div>
                 <div className="space-y-2">
                    {editedTopic.subtopics.map(subtopic => (
                        <Card key={subtopic.id} className="p-3 flex justify-between items-center hover:bg-gray-700/50">
                            <span>{subtopic.name}</span>
                            <Button onClick={() => setSelectedSubtopic(subtopic)} className="text-xs py-1 px-2">Editar <ArrowRightIcon className="h-3 w-3 ml-1"/></Button>
                        </Card>
                    ))}
                    {editedTopic.subtopics.length === 0 && <p className="text-gray-500 text-center text-sm">Nenhum subtópico.</p>}
                 </div>
            </Card>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <Button onClick={onBack} className="text-sm py-2 px-3 bg-gray-600 hover:bg-gray-500"><ArrowRightIcon className="h-4 w-4 mr-2 transform rotate-180"/> Voltar para Disciplina</Button>
                <div className="flex gap-2">
                    <Button onClick={handleSave}><SaveIcon className="h-5 w-5 mr-2" /> Salvar Tópico</Button>
                    <Button onClick={onDelete} className="bg-red-600 hover:bg-red-700"><TrashIcon className="h-5 w-5 mr-2"/> Apagar Tópico</Button>
                </div>
            </div>

            <Card className="p-6 space-y-2">
                <label className="text-sm font-medium text-gray-400">Nome do Tópico</label>
                <input type="text" value={editedTopic.name} onChange={e => setEditedTopic({...editedTopic, name: e.target.value})} className="bg-gray-700 text-2xl font-bold w-full p-2 rounded-md" />
                <label className="text-sm font-medium text-gray-400">Descrição</label>
                <textarea value={editedTopic.description || ''} onChange={e => setEditedTopic({...editedTopic, description: e.target.value})} className="bg-gray-700 w-full p-2 rounded-md" rows={2}/>
            </Card>
            
            <div className="flex justify-center border-b border-gray-700">
                <button onClick={() => setView('details')} className={`px-4 py-2 text-sm font-medium ${view === 'details' ? 'border-b-2 border-cyan-400 text-cyan-400' : 'text-gray-400'}`}>Conteúdo</button>
                <button onClick={() => setView('questions')} className={`px-4 py-2 text-sm font-medium ${view === 'questions' ? 'border-b-2 border-cyan-400 text-cyan-400' : 'text-gray-400'}`}>Questões ({editedTopic.questions.length})</button>
                <button onClick={() => setView('tec_questions')} className={`px-4 py-2 text-sm font-medium ${view === 'tec_questions' ? 'border-b-2 border-cyan-400 text-cyan-400' : 'text-gray-400'}`}>Questões (TEC) ({editedTopic.tecQuestions?.length || 0})</button>
                <button onClick={() => setView('games')} className={`px-4 py-2 text-sm font-medium ${view === 'games' ? 'border-b-2 border-cyan-400 text-cyan-400' : 'text-gray-400'}`}>Jogos ({editedTopic.miniGames.length})</button>
            </div>
            
            {view === 'details' && renderDetailsView()}
            {view === 'questions' && <ProfessorQuestionManager questions={editedTopic.questions} onQuestionsChange={(qs: Question[]) => setEditedTopic(p => ({...p, questions: qs}))} isTecExtraction={false} />}
            {view === 'tec_questions' && <ProfessorQuestionManager questions={editedTopic.tecQuestions || []} onQuestionsChange={(qs: Question[]) => setEditedTopic(p => ({...p, tecQuestions: qs}))} isTecExtraction={true} />}
            {view === 'games' && <ProfessorGameManager games={editedTopic.miniGames} onGamesChange={(games: MiniGame[]) => setEditedTopic(p => ({...p, miniGames: games}))} />}
            
            <ProfessorFlashcardEditorModal isOpen={isFlashcardModalOpen} onClose={() => setIsFlashcardModalOpen(false)} initialFlashcards={editedTopic.flashcards} onSave={(cards) => setEditedTopic(p => ({...p, flashcards: cards}))} />
            <GlossaryEditor isOpen={isGlossaryModalOpen} onClose={() => setIsGlossaryModalOpen(false)} initialGlossary={editedTopic.glossary || []} onSave={(glossary) => setEditedTopic(p => ({...p, glossary: glossary}))} />
        </div>
    );
};
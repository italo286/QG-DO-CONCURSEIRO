import React, { useState } from 'react';
import { SubTopic, Question, MiniGame } from '../../types';
import { Card, Button } from '../ui';
import { SaveIcon, TrashIcon, ArrowRightIcon } from '../Icons';
import { ContentLinksEditor } from './ContentLinksEditor';
import { ProfessorQuestionManager } from './ProfessorQuestionManager';
import { ProfessorGameManager } from './ProfessorGameManager';
import { ProfessorFlashcardEditorModal } from './ProfessorFlashcardEditorModal';
import { GlossaryEditor } from './GlossaryEditor';
import { BankProfileEditor } from './BankProfileEditor';

interface ProfessorSubTopicEditorProps {
    subtopic: SubTopic;
    onSave: (subtopic: SubTopic) => void;
    onBack: () => void;
    onDelete: () => void;
    setToastMessage: (message: string) => void;
}

export const ProfessorSubTopicEditor: React.FC<ProfessorSubTopicEditorProps> = ({ subtopic, onSave, onBack, onDelete, setToastMessage }) => {
    const [editedSubtopic, setEditedSubtopic] = useState<SubTopic>(subtopic);
    const [view, setView] = useState<'details' | 'questions' | 'tec_questions' | 'games'>('details');
    const [isFlashcardModalOpen, setIsFlashcardModalOpen] = useState(false);
    const [isGlossaryModalOpen, setIsGlossaryModalOpen] = useState(false);

    const handleSave = () => {
        onSave(editedSubtopic);
        setToastMessage("Alterações no subtópico salvas.");
    };

    const renderDetailsView = () => (
        <Card className="p-6 space-y-4">
            <ContentLinksEditor content={editedSubtopic} setContent={setEditedSubtopic} />
            <BankProfileEditor bankProfilePdfs={editedSubtopic.bankProfilePdfs || []} onUpdatePdfs={(pdfs) => setEditedSubtopic(prev => ({...prev, bankProfilePdfs: pdfs}))} />
            <div>
                 <label className="font-semibold text-gray-300">URL do Mapa Mental (Opcional)</label>
                 <input
                     type="url"
                     placeholder="https://exemplo.com/mapa.png"
                     value={editedSubtopic.mindMapUrl || ''}
                     onChange={(e) => setEditedSubtopic(prev => ({...prev, mindMapUrl: e.target.value}))}
                     className="mt-2 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white"
                 />
            </div>
            <Button onClick={() => setIsFlashcardModalOpen(true)} className="w-full">Gerenciar Flashcards ({editedSubtopic.flashcards?.length || 0})</Button>
            <Button onClick={() => setIsGlossaryModalOpen(true)} className="w-full">Gerenciar Glossário ({editedSubtopic.glossary?.length || 0})</Button>
        </Card>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <Button onClick={onBack} className="text-sm py-2 px-3 bg-gray-600 hover:bg-gray-500"><ArrowRightIcon className="h-4 w-4 mr-2 transform rotate-180"/> Voltar para Tópico</Button>
                <div className="flex gap-2">
                    <Button onClick={handleSave}><SaveIcon className="h-5 w-5 mr-2" /> Salvar Subtópico</Button>
                    <Button onClick={onDelete} className="bg-red-600 hover:bg-red-700"><TrashIcon className="h-5 w-5 mr-2"/> Apagar Subtópico</Button>
                </div>
            </div>

            <Card className="p-6 space-y-2">
                <label className="text-sm font-medium text-gray-400">Nome do Subtópico</label>
                <input type="text" value={editedSubtopic.name} onChange={e => setEditedSubtopic({...editedSubtopic, name: e.target.value})} className="bg-gray-700 text-2xl font-bold w-full p-2 rounded-md" />
                 <label className="text-sm font-medium text-gray-400">Descrição</label>
                <textarea value={editedSubtopic.description || ''} onChange={e => setEditedSubtopic({...editedSubtopic, description: e.target.value})} className="bg-gray-700 w-full p-2 rounded-md" rows={2}/>
            </Card>
            
            <div className="flex justify-center border-b border-gray-700">
                <button onClick={() => setView('details')} className={`px-4 py-2 text-sm font-medium ${view === 'details' ? 'border-b-2 border-cyan-400 text-cyan-400' : 'text-gray-400'}`}>Conteúdo</button>
                <button onClick={() => setView('questions')} className={`px-4 py-2 text-sm font-medium ${view === 'questions' ? 'border-b-2 border-cyan-400 text-cyan-400' : 'text-gray-400'}`}>Questões ({editedSubtopic.questions.length})</button>
                <button onClick={() => setView('tec_questions')} className={`px-4 py-2 text-sm font-medium ${view === 'tec_questions' ? 'border-b-2 border-cyan-400 text-cyan-400' : 'text-gray-400'}`}>Questões (TEC) ({editedSubtopic.tecQuestions?.length || 0})</button>
                <button onClick={() => setView('games')} className={`px-4 py-2 text-sm font-medium ${view === 'games' ? 'border-b-2 border-cyan-400 text-cyan-400' : 'text-gray-400'}`}>Jogos ({editedSubtopic.miniGames.length})</button>
            </div>
            
            {view === 'details' && renderDetailsView()}
            {view === 'questions' && <ProfessorQuestionManager questions={editedSubtopic.questions} onQuestionsChange={(qs: Question[]) => setEditedSubtopic(p => ({...p, questions: qs}))} isTecExtraction={false} />}
            {view === 'tec_questions' && <ProfessorQuestionManager questions={editedSubtopic.tecQuestions || []} onQuestionsChange={(qs: Question[]) => setEditedSubtopic(p => ({...p, tecQuestions: qs}))} isTecExtraction={true} />}
            {view === 'games' && <ProfessorGameManager games={editedSubtopic.miniGames} onGamesChange={(games: MiniGame[]) => setEditedSubtopic(p => ({...p, miniGames: games}))} />}

            <ProfessorFlashcardEditorModal isOpen={isFlashcardModalOpen} onClose={() => setIsFlashcardModalOpen(false)} initialFlashcards={editedSubtopic.flashcards} onSave={(cards) => setEditedSubtopic(p => ({...p, flashcards: cards}))} />
            <GlossaryEditor isOpen={isGlossaryModalOpen} onClose={() => setIsGlossaryModalOpen(false)} initialGlossary={editedSubtopic.glossary || []} onSave={(glossary) => setEditedSubtopic(p => ({...p, glossary: glossary}))} />
        </div>
    );
};
import React, { useState } from 'react';
import { Course, Subject, User } from '../../types';
import * as FirebaseService from '../../services/firebaseService';
import { Button, Card, Spinner } from '../ui';
import { UserGroupIcon, BookOpenIcon, PencilIcon, TrashIcon, SparklesIcon } from '../Icons';
import { ManageSubjectsModal } from './ManageSubjectsModal';
import { ManageStudentsModal } from './ManageStudentsModal';
import { ProfessorEditalEditor } from './ProfessorEditalEditor';
import { YouTubeCarouselEditor } from './YouTubeCarouselEditor';
import { AiFrequencyAnalysisModal } from './AiFrequencyAnalysisModal';

interface ProfessorCourseEditorProps {
    course: Course;
    allSubjects: Subject[];
    allStudents: User[];
    onBack: () => void;
    setToastMessage: (message: string) => void;
}

export const ProfessorCourseEditor: React.FC<ProfessorCourseEditorProps> = ({ course, allSubjects, allStudents, onBack, setToastMessage }) => {
    const [editedCourse, setEditedCourse] = useState(course);
    const [isSaving, setIsSaving] = useState(false);
    const [isManageSubjectsModalOpen, setIsManageSubjectsModalOpen] = useState(false);
    const [isManageStudentsModalOpen, setIsManageStudentsModalOpen] = useState(false);
    const [isEditalModalOpen, setIsEditalModalOpen] = useState(false);
    const [isFrequencyModalOpen, setIsFrequencyModalOpen] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await FirebaseService.updateCourse(editedCourse);
            setToastMessage("Curso atualizado com sucesso!");
        } catch (error) {
            console.error("Erro ao salvar curso:", error);
            setToastMessage("Erro ao salvar o curso.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteCourse = async () => {
        if(window.confirm(`Tem certeza que deseja apagar o curso "${course.name}"? Esta ação não pode ser desfeita.`)) {
            try {
                await FirebaseService.deleteCourse(course.id);
                setToastMessage("Curso apagado com sucesso!");
                onBack();
            } catch (error) {
                console.error("Erro ao apagar curso:", error);
                setToastMessage("Erro ao apagar o curso.");
            }
        }
    };

    const handleDisciplinesSave = (updatedCourse: Course) => {
        setEditedCourse(updatedCourse);
        // We can save immediately or wait for the main save button. Let's save immediately for simplicity.
        FirebaseService.updateCourse(updatedCourse).then(() => {
            setToastMessage("Disciplinas atualizadas.");
        });
    };
    
    const handleStudentsSave = (updatedCourse: Course) => {
        setEditedCourse(updatedCourse);
        FirebaseService.updateCourse(updatedCourse).then(() => {
            setToastMessage("Alunos matriculados atualizados.");
        });
    };
    
    const handleEditalSave = (updatedCourse: Course) => {
        setEditedCourse(updatedCourse);
         FirebaseService.updateCourse(updatedCourse).then(() => {
            setToastMessage("Informações do edital salvas.");
        });
    };

    const handleFrequencySave = (frequencyMap: { [id: string]: 'alta' | 'media' | 'baixa' | 'nenhuma' }) => {
        setEditedCourse(prev => {
            const newDisciplines = prev.disciplines.map(d => {
                const subject = allSubjects.find(s => s.id === d.subjectId);
                if (!subject) return d;
    
                const newTopicFrequencies = { ...(d.topicFrequencies || {}) };
                const allContentIds = subject.topics.flatMap(t => [t.id, ...t.subtopics.map(st => st.id)]);
                
                allContentIds.forEach(id => {
                    if (frequencyMap[id]) {
                        newTopicFrequencies[id] = frequencyMap[id];
                    }
                });
                
                return { ...d, topicFrequencies: newTopicFrequencies };
            });
            const updatedCourse = { ...prev, disciplines: newDisciplines };
            // Save immediately
            FirebaseService.updateCourse(updatedCourse).then(() => {
                setToastMessage("Frequência dos tópicos atualizada.");
            });
            return updatedCourse;
        });
    };

    return (
        <div className="space-y-6">
            <Card className="p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-2">Editar Curso</h2>
                        <div className="flex items-center gap-2">
                             <input type="text" value={editedCourse.name} onChange={e => setEditedCourse({...editedCourse, name: e.target.value})} className="bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white text-2xl font-bold"/>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Button onClick={handleSave} disabled={isSaving} className="text-sm py-2 px-4">{isSaving ? <Spinner /> : "Salvar Alterações"}</Button>
                        <Button onClick={handleDeleteCourse} className="text-sm py-2 px-4 bg-red-600 hover:bg-red-700">
                            <TrashIcon className="h-4 w-4 mr-2"/> Apagar Curso
                        </Button>
                    </div>
                </div>
                <div className="mt-4">
                    <label className="text-sm font-medium text-gray-300">URL da Imagem de Capa</label>
                    <input type="url" value={editedCourse.imageUrl || ''} onChange={e => setEditedCourse({...editedCourse, imageUrl: e.target.value})} placeholder="https://exemplo.com/imagem.png" className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white"/>
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                    <Button onClick={() => setIsManageSubjectsModalOpen(true)} className="w-full mb-4">
                        <BookOpenIcon className="h-5 w-5 mr-2" /> Gerenciar Conteúdo do Curso
                    </Button>
                     <Button onClick={() => setIsFrequencyModalOpen(true)} className="w-full">
                        <SparklesIcon className="h-5 w-5 mr-2" /> Analisar Frequência com IA
                    </Button>
                </Card>
                 <Card className="p-6">
                    <Button onClick={() => setIsManageStudentsModalOpen(true)} className="w-full">
                        <UserGroupIcon className="h-5 w-5 mr-2" /> Matricular Alunos
                    </Button>
                 </Card>
            </div>
             <YouTubeCarouselEditor videos={editedCourse.youtubeCarousel || []} onVideosChange={(videos) => setEditedCourse({...editedCourse, youtubeCarousel: videos})} />
             <Card className="p-6">
                 <h3 className="text-xl font-bold text-white mb-2">Análise de Edital</h3>
                 <p className="text-gray-400 mb-4">Envie o PDF do edital para que a IA extraia as informações mais importantes para seus alunos.</p>
                 <Button onClick={() => setIsEditalModalOpen(true)} className="w-full">
                     <PencilIcon className="h-5 w-5 mr-2" /> Gerenciar Informações do Edital
                 </Button>
             </Card>

            <ManageSubjectsModal isOpen={isManageSubjectsModalOpen} onClose={() => setIsManageSubjectsModalOpen(false)} course={editedCourse} allSubjects={allSubjects} onSave={handleDisciplinesSave} />
            <ManageStudentsModal isOpen={isManageStudentsModalOpen} onClose={() => setIsManageStudentsModalOpen(false)} course={editedCourse} allStudents={allStudents} onSave={handleStudentsSave} />
            <ProfessorEditalEditor isOpen={isEditalModalOpen} onClose={() => setIsEditalModalOpen(false)} course={editedCourse} onSave={handleEditalSave} />
            <AiFrequencyAnalysisModal isOpen={isFrequencyModalOpen} onClose={() => setIsFrequencyModalOpen(false)} course={editedCourse} allSubjects={allSubjects} onSaveFrequencies={handleFrequencySave} />
        </div>
    );
};

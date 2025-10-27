import React, { useState, useEffect } from 'react';
import { Course, Subject, User } from '../../types';
import * as FirebaseService from '../../services/firebaseService';
import { Card, Button, Spinner } from '../ui';
import { TrashIcon, UserGroupIcon, BookOpenIcon, PencilIcon, GeminiIcon } from '../Icons';
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
    const [localName, setLocalName] = useState(course.name);
    const [localImageUrl, setLocalImageUrl] = useState(course.imageUrl || '');

    const [isSaving, setIsSaving] = useState(false);
    const [isManageSubjectsModalOpen, setIsManageSubjectsModalOpen] = useState(false);
    const [isManageStudentsModalOpen, setIsManageStudentsModalOpen] = useState(false);
    const [isEditalModalOpen, setIsEditalModalOpen] = useState(false);
    const [isAiFrequencyModalOpen, setIsAiFrequencyModalOpen] = useState(false);

    useEffect(() => {
        setEditedCourse(course);
        setLocalName(course.name);
        setLocalImageUrl(course.imageUrl || '');
    }, [course]);

    const handleSave = async (updatedCourse: Course) => {
        setIsSaving(true);
        try {
            await FirebaseService.updateCourse(updatedCourse);
            setEditedCourse(updatedCourse); // Sync state after successful save
            setToastMessage('Curso atualizado com sucesso!');
        } catch (error) {
            console.error("Failed to update course:", error);
            setToastMessage('Erro ao atualizar o curso.');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleNameBlur = () => {
        if (course.name !== localName) {
            const updatedCourse = { ...editedCourse, name: localName };
            handleSave(updatedCourse);
        }
    };
    
    const handleImageUrlBlur = () => {
        if (course.imageUrl !== localImageUrl) {
            const updatedCourse = { ...editedCourse, imageUrl: localImageUrl };
            handleSave(updatedCourse);
        }
    };

    const handleDeleteCourse = async () => {
        if (window.confirm(`Tem certeza que deseja apagar o curso "${course.name}"? Esta ação não pode ser desfeita.`)) {
            setIsSaving(true);
            try {
                await FirebaseService.deleteCourse(course.id);
                setToastMessage('Curso apagado com sucesso!');
                onBack();
            } catch (error) {
                console.error("Failed to delete course:", error);
                setToastMessage('Erro ao apagar o curso.');
                setIsSaving(false);
            }
        }
    };
    
    const handleSaveFrequencies = (frequencyMap: { [id: string]: 'alta' | 'media' | 'baixa' | 'nenhuma' }) => {
        const updatedDisciplines = editedCourse.disciplines.map(discipline => {
            const newFrequencies = { ...(discipline.topicFrequencies || {}) };
            const subject = allSubjects.find(s => s.id === discipline.subjectId);
            if (subject) {
                subject.topics.forEach(topic => {
                    if (frequencyMap[topic.id]) {
                        newFrequencies[topic.id] = frequencyMap[topic.id];
                    }
                    topic.subtopics.forEach(subtopic => {
                        if (frequencyMap[subtopic.id]) {
                            newFrequencies[subtopic.id] = frequencyMap[subtopic.id];
                        }
                    });
                });
            }
            return { ...discipline, topicFrequencies: newFrequencies };
        });

        const updatedCourse = { ...editedCourse, disciplines: updatedDisciplines };
        handleSave(updatedCourse);
        setToastMessage("Frequências dos tópicos atualizadas pela IA!");
    };

    return (
        <>
            <div className="max-w-4xl mx-auto">
                <Card className="p-6 relative">
                    {isSaving && <div className="absolute inset-0 bg-gray-900/50 flex justify-center items-center z-10 rounded-xl"><Spinner /></div>}
                    <div className="flex justify-between items-start mb-4">
                         <div className="flex items-center gap-4">
                            {editedCourse.imageUrl ? (
                                <img src={editedCourse.imageUrl} alt="" className="h-24 w-24 object-cover rounded-lg" />
                            ) : (
                                <BookOpenIcon className="h-24 w-24 text-gray-700" />
                            )}
                            <div>
                                <label htmlFor="course-name-editor" className="sr-only">Nome do Curso</label>
                                <input
                                    id="course-name-editor"
                                    name="name"
                                    type="text"
                                    value={localName}
                                    onChange={e => setLocalName(e.target.value)}
                                    onBlur={handleNameBlur}
                                    className="text-2xl font-bold text-white bg-transparent border-b-2 border-transparent focus:border-cyan-500 focus:outline-none"
                                />
                                 <label htmlFor="course-imageUrl-editor" className="sr-only">URL da Imagem</label>
                                 <input
                                    id="course-imageUrl-editor"
                                    name="imageUrl"
                                    type="text"
                                    placeholder="URL da imagem de capa"
                                    value={localImageUrl}
                                    onChange={e => setLocalImageUrl(e.target.value)}
                                    onBlur={handleImageUrlBlur}
                                    className="mt-1 text-sm text-gray-400 w-full bg-transparent border-b-2 border-transparent focus:border-cyan-500 focus:outline-none"
                                />
                            </div>
                        </div>
                        <Button onClick={handleDeleteCourse} className="text-sm py-2 px-4 bg-red-600 hover:bg-red-700">
                            <TrashIcon className="h-4 w-4" />
                        </Button>
                    </div>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <Card className="p-4 flex flex-col items-center justify-center">
                        <BookOpenIcon className="h-8 w-8 text-cyan-400 mb-2"/>
                        <p className="text-2xl font-bold">{editedCourse.disciplines.length}</p>
                        <p className="text-gray-400">Disciplinas</p>
                        <Button onClick={() => setIsManageSubjectsModalOpen(true)} className="mt-4 text-sm py-2 px-4">Gerenciar</Button>
                    </Card>
                     <Card className="p-4 flex flex-col items-center justify-center">
                        <UserGroupIcon className="h-8 w-8 text-cyan-400 mb-2"/>
                        <p className="text-2xl font-bold">{editedCourse.enrolledStudentIds.length}</p>
                        <p className="text-gray-400">Alunos</p>
                        <Button onClick={() => setIsManageStudentsModalOpen(true)} className="mt-4 text-sm py-2 px-4">Gerenciar</Button>
                    </Card>
                    <Card className="p-4 flex flex-col items-center justify-center">
                        <PencilIcon className="h-8 w-8 text-cyan-400 mb-2"/>
                        <p className="text-lg font-bold">Edital do Concurso</p>
                        <p className="text-gray-400 text-sm">Analise um edital com IA</p>
                        <Button onClick={() => setIsEditalModalOpen(true)} className="mt-4 text-sm py-2 px-4">Editar</Button>
                    </Card>
                     <Card className="p-4 flex flex-col items-center justify-center text-center">
                        <GeminiIcon className="h-8 w-8 text-cyan-400 mb-2"/>
                        <p className="text-lg font-bold">Frequência IA</p>
                        <p className="text-gray-400 text-sm">Analise a incidência dos tópicos</p>
                        <Button onClick={() => setIsAiFrequencyModalOpen(true)} className="mt-4 text-sm py-2 px-4">Analisar</Button>
                    </Card>
                </div>

                 <div className="mt-6">
                    <YouTubeCarouselEditor
                        videos={editedCourse.youtubeCarousel || []}
                        onVideosChange={(videos) => {
                            const updatedCourse = { ...editedCourse, youtubeCarousel: videos };
                            handleSave(updatedCourse);
                        }}
                    />
                </div>
            </div>
            
            <ManageSubjectsModal
                isOpen={isManageSubjectsModalOpen}
                onClose={() => setIsManageSubjectsModalOpen(false)}
                course={editedCourse}
                allSubjects={allSubjects}
                onSave={handleSave}
            />
            <ManageStudentsModal
                isOpen={isManageStudentsModalOpen}
                onClose={() => setIsManageStudentsModalOpen(false)}
                course={editedCourse}
                allStudents={allStudents}
                onSave={handleSave}
            />
            <ProfessorEditalEditor
                isOpen={isEditalModalOpen}
                onClose={() => setIsEditalModalOpen(false)}
                course={editedCourse}
                onSave={handleSave}
            />
            <AiFrequencyAnalysisModal
                isOpen={isAiFrequencyModalOpen}
                onClose={() => setIsAiFrequencyModalOpen(false)}
                course={editedCourse}
                allSubjects={allSubjects}
                onSaveFrequencies={handleSaveFrequencies}
            />
        </>
    );
};
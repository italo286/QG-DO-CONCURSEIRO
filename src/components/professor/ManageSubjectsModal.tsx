
import React, { useState, useEffect, useMemo } from 'react';
import { Course, Subject, CourseDiscipline, Topic } from '../../types';
import { Modal, Button } from '../ui';
import { ChevronDownIcon } from '../Icons';

export const ManageSubjectsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    course: Course;
    allSubjects: Subject[];
    onSave: (course: Course) => void;
}> = ({ isOpen, onClose, course, allSubjects, onSave }) => {
    
    const [editedDisciplines, setEditedDisciplines] = useState<CourseDiscipline[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen) {
            const disciplinesMap = new Map(course.disciplines.map(d => [d.subjectId, d]));
            const allDisciplines = allSubjects.map(subject => {
                const existing = disciplinesMap.get(subject.id);
                return existing || { subjectId: subject.id, excludedTopicIds: [], topicFrequencies: {} };
            });
            setEditedDisciplines(allDisciplines);
            setSearchTerm(''); // Limpa a busca ao abrir
        }
    }, [course.disciplines, allSubjects, isOpen]);

    const filteredSubjects = useMemo(() => {
        if (!searchTerm.trim()) return allSubjects;
        const term = searchTerm.toLowerCase();
        return allSubjects.filter(s => s.name.toLowerCase().includes(term));
    }, [allSubjects, searchTerm]);

    const handleSaveChanges = () => {
        const finalDisciplines = editedDisciplines.filter(d => {
            const subject = allSubjects.find(s => s.id === d.subjectId);
            if (!subject) return false;
            const allContentIds = subject.topics.flatMap(t => [t.id, ...t.subtopics.map(st => st.id)]);
            return allContentIds.some(id => !d.excludedTopicIds.includes(id));
        });

        onSave({ ...course, disciplines: finalDisciplines });
        onClose();
    };
    
    const isExcluded = (subjectId: string, contentId: string) => {
        return editedDisciplines.find(d => d.subjectId === subjectId)?.excludedTopicIds.includes(contentId) ?? false;
    };
    
    const toggleExclusion = (subjectId: string, contentIds: string[], shouldExclude: boolean) => {
        setEditedDisciplines(prev => {
            const newDisciplines = [...prev];
            const discipline = newDisciplines.find(d => d.subjectId === subjectId);
            if (!discipline) return prev; 

            if (shouldExclude) {
                discipline.excludedTopicIds = [...new Set([...discipline.excludedTopicIds, ...contentIds])];
            } else {
                discipline.excludedTopicIds = discipline.excludedTopicIds.filter(id => !contentIds.includes(id));
            }
            return newDisciplines;
        });
    };
    
    const handleToggleSubtopic = (subjectId: string, parentTopic: Topic, subtopicId: string) => {
        const currentlyExcluded = isExcluded(subjectId, subtopicId);
        toggleExclusion(subjectId, [subtopicId], !currentlyExcluded);
        if (currentlyExcluded) { 
             toggleExclusion(subjectId, [parentTopic.id], false);
        }
    };

    const handleToggleTopic = (subjectId: string, topic: Topic) => {
        const allChildIds = [topic.id, ...topic.subtopics.map(st => st.id)];
        const areAllExcluded = allChildIds.every(id => isExcluded(subjectId, id));
        toggleExclusion(subjectId, allChildIds, !areAllExcluded);
    };

    const handleToggleSubject = (subject: Subject) => {
        const allContentIds = subject.topics.flatMap(t => [t.id, ...t.subtopics.map(st => st.id)]);
        const discipline = editedDisciplines.find(d => d.subjectId === subject.id);
        const includedCount = allContentIds.filter(id => !discipline?.excludedTopicIds.includes(id)).length;
        const shouldExcludeAll = includedCount > 0;
        toggleExclusion(subject.id, allContentIds, shouldExcludeAll);
    };

    const allContentIds = useMemo(() => allSubjects.flatMap(s => s.topics.flatMap(t => [t.id, ...t.subtopics.map(st => st.id)])), [allSubjects]);
    
    const includedCount = useMemo(() => {
        const excludedIds = new Set(editedDisciplines.flatMap(d => d.excludedTopicIds));
        return allContentIds.filter(id => !excludedIds.has(id)).length;
    }, [editedDisciplines, allContentIds]);

    const isAllSelected = includedCount > 0 && includedCount === allContentIds.length;
    const isIndeterminate = includedCount > 0 && !isAllSelected;

    const handleToggleAll = () => {
        const shouldSelectAll = !isAllSelected;
        setEditedDisciplines(prev => prev.map(discipline => {
            const subject = allSubjects.find(s => s.id === discipline.subjectId);
            if (!subject) return discipline;
            const subjectContentIds = subject.topics.flatMap(t => [t.id, ...t.subtopics.map(st => st.id)]);
            return {
                ...discipline,
                excludedTopicIds: shouldSelectAll ? [] : subjectContentIds,
            };
        }));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Gerenciar Conteúdo do Curso" size="3xl">
            <div className="space-y-4">
                <p className="text-gray-400">Selecione as disciplinas, tópicos e subtópicos que farão parte deste curso.</p>

                <div className="relative group">
                    <input
                        type="text"
                        placeholder="Pesquisar disciplina..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                        aria-label="Pesquisar disciplina"
                    />
                    {searchTerm && (
                        <button 
                            onClick={() => setSearchTerm('')}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                        >
                            Limpar
                        </button>
                    )}
                </div>

                <div className="p-3 border-b border-gray-700">
                    <label className="flex items-center space-x-3 text-sm font-semibold cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isAllSelected}
                            ref={el => { if (el) { el.indeterminate = isIndeterminate; } }}
                            onChange={handleToggleAll}
                            className="h-5 w-5 rounded text-cyan-500 bg-gray-700 border-gray-600 focus:ring-cyan-600"
                            aria-label="Marcar ou desmarcar tudo"
                        />
                        <span>Marcar/Desmarcar Tudo</span>
                    </label>
                </div>

                <div className="space-y-2 max-h-[50vh] overflow-y-auto pt-2 pr-2 custom-scrollbar">
                    {filteredSubjects.length > 0 ? (
                        filteredSubjects.map(subject => {
                            const allSubjContentIds = subject.topics.flatMap(t => [t.id, ...t.subtopics.map(st => st.id)]);
                            const discipline = editedDisciplines.find(d => d.subjectId === subject.id);
                            const subjIncludedCount = allSubjContentIds.filter(id => !discipline?.excludedTopicIds.includes(id)).length;
                            
                            return (
                                <details key={subject.id} className="bg-gray-800 rounded-lg border border-gray-700" open={!!searchTerm}>
                                    <summary className="flex items-center p-3 cursor-pointer list-none">
                                        <input
                                            type="checkbox"
                                            checked={subjIncludedCount > 0}
                                            ref={el => { if (el) { el.indeterminate = subjIncludedCount > 0 && subjIncludedCount < allSubjContentIds.length; } }}
                                            onChange={() => handleToggleSubject(subject)}
                                            className="h-5 w-5 rounded text-cyan-500 bg-gray-700 border-gray-600 focus:ring-cyan-600"
                                            onClick={e => e.stopPropagation()}
                                        />
                                        <span className="ml-3 font-semibold text-gray-200 flex-grow">{subject.name}</span>
                                        <ChevronDownIcon className="h-5 w-5 transition-transform details-open:rotate-180" />
                                    </summary>
                                    <div className="border-t border-gray-700 p-3 pl-6 space-y-2">
                                        {subject.topics.map(topic => {
                                            const allChildIds = [topic.id, ...topic.subtopics.map(st => st.id)];
                                            const includedChildrenCount = allChildIds.filter(id => !isExcluded(subject.id, id)).length;

                                            return (
                                                <details key={topic.id} className="bg-gray-700/50 rounded-md" open={!!searchTerm}>
                                                    <summary className="flex items-center p-2 cursor-pointer list-none gap-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={includedChildrenCount > 0}
                                                            ref={el => { if (el) { el.indeterminate = includedChildrenCount > 0 && includedChildrenCount < allChildIds.length; } }}
                                                            onChange={() => handleToggleTopic(subject.id, topic)}
                                                            className="h-4 w-4 rounded text-cyan-500 bg-gray-600 border-gray-500 focus:ring-cyan-500"
                                                            onClick={e => e.stopPropagation()}
                                                        />
                                                        <span className="text-sm font-medium text-gray-300 flex-grow">{topic.name}</span>
                                                        {topic.subtopics.length > 0 && <ChevronDownIcon className="h-4 w-4 transition-transform details-open:rotate-180" />}
                                                    </summary>
                                                    {topic.subtopics.length > 0 && (
                                                        <div className="pt-2 pl-6 space-y-1">
                                                            {topic.subtopics.map(subtopic => (
                                                                <div key={subtopic.id} className="flex items-center space-x-2 text-sm cursor-pointer p-1 gap-3">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={!isExcluded(subject.id, subtopic.id)}
                                                                        onChange={() => handleToggleSubtopic(subject.id, topic, subtopic.id)}
                                                                        className="h-4 w-4 rounded text-cyan-500 bg-gray-600 border-gray-500 focus:ring-cyan-500"
                                                                    />
                                                                    <span className="flex-grow">{subtopic.name}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </details>
                                            );
                                        })}
                                    </div>
                                </details>
                            );
                        })
                    ) : (
                        <div className="text-center py-8 text-gray-500 italic">
                            Nenhuma disciplina encontrada para "{searchTerm}".
                        </div>
                    )}
                </div>
                <div className="flex justify-end pt-4">
                    <Button onClick={handleSaveChanges}>Salvar Alterações</Button>
                </div>
            </div>
        </Modal>
    );
};

import React, { useState } from 'react';
import { Course, User } from '../../types';
import { Modal, Button } from '../ui';
import { UserCircleIcon } from '../Icons';

export const ManageStudentsModal: React.FC<{isOpen: boolean, onClose: () => void, course: Course, allStudents: User[], onSave: (course: Course) => void}> = ({ isOpen, onClose, course, allStudents, onSave }) => {
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(() => course.enrolledStudentIds);
    const availableStudents = allStudents.filter(u => u.role === 'aluno');

    const handleToggle = (studentId: string) => {
        setSelectedStudentIds(prev => 
            prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
        );
    };

    const handleSaveChanges = () => {
        onSave({ ...course, enrolledStudentIds: selectedStudentIds });
        onClose();
    };

    const allSelected = availableStudents.length > 0 && selectedStudentIds.length === availableStudents.length;

    const handleToggleAll = () => {
        if (allSelected) {
            setSelectedStudentIds([]);
        } else {
            setSelectedStudentIds(availableStudents.map(s => s.id));
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Matricular Alunos no Curso" size="xl">
            <div className="space-y-4">
                <p className="text-gray-400" id="manage-students-desc">Selecione os alunos para matricular neste curso.</p>
                
                <div className="p-2 border-b border-t border-gray-700">
                    <label className="flex items-center space-x-4 text-sm font-semibold cursor-pointer">
                        <input 
                            type="checkbox"
                            checked={allSelected}
                            onChange={handleToggleAll}
                            className="h-5 w-5 rounded text-cyan-500 bg-gray-700 border-gray-600 focus:ring-cyan-600"
                            aria-label="Marcar ou desmarcar todos os alunos"
                        />
                        <span>Marcar/Desmarcar Todos</span>
                    </label>
                </div>

                <div role="group" aria-labelledby="manage-students-desc" className="space-y-2 max-h-96 overflow-y-auto pt-2">
                    {availableStudents.map(student => (
                        <label key={student.id} className="flex items-center space-x-4 text-sm cursor-pointer p-3 hover:bg-gray-700/50 rounded-lg">
                            <input 
                                type="checkbox" 
                                checked={selectedStudentIds.includes(student.id)}
                                onChange={() => handleToggle(student.id)}
                                className="h-5 w-5 rounded text-cyan-500 bg-gray-700 border-gray-600 focus:ring-cyan-600 flex-shrink-0"
                            />
                            {student.avatarUrl ? (
                                <img src={student.avatarUrl} alt={`Avatar de ${student.name}`} className="h-10 w-10 rounded-full object-cover" />
                            ) : (
                                <UserCircleIcon className="h-10 w-10 text-gray-500" />
                            )}
                            <span>{student.name || student.username}</span>
                        </label>
                    ))}
                </div>
                <div className="flex justify-end pt-4">
                    <Button onClick={handleSaveChanges}>Salvar Alterações</Button>
                </div>
            </div>
        </Modal>
    );
};
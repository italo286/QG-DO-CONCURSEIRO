import React, { useState, useMemo } from 'react';
import { Subject } from '../../types';
import { Card, Button } from '../ui';
import { PlusIcon } from '../Icons';

interface ProfessorSubjectsViewProps {
    subjects: Subject[];
    onEditSubject: (subject: Subject) => void;
    onCreateSubject: () => void;
}

export const ProfessorSubjectsView: React.FC<ProfessorSubjectsViewProps> = ({ subjects, onEditSubject, onCreateSubject }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredAndSortedSubjects = useMemo(() => {
        return subjects
            .filter(subject => subject.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [subjects, searchTerm]);

    return (
        <Card className="p-6">
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                <h2 className="text-2xl font-bold text-white">Minhas Disciplinas</h2>
                <div className="flex items-center gap-4">
                     <input
                        type="text"
                        placeholder="Pesquisar disciplina..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full md:w-64 bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-cyan-500 focus:border-cyan-500"
                        aria-label="Pesquisar disciplina"
                    />
                    <Button onClick={onCreateSubject}>
                        <PlusIcon className="h-5 w-5 mr-2" />
                        Nova Disciplina
                    </Button>
                </div>
            </div>

            {filteredAndSortedSubjects.length > 0 ? (
                <ul className="space-y-3">
                    {filteredAndSortedSubjects.map(subject => (
                        <li key={subject.id}>
                            <button
                                onClick={() => onEditSubject(subject)}
                                className="w-full text-left p-4 bg-gray-800 rounded-lg hover:bg-gray-700/50 border border-gray-700 transition-colors"
                            >
                                <p className="font-bold text-lg text-cyan-400">{subject.name}</p>
                                <p className="text-sm text-gray-400 mt-1">{(subject.topics || []).length} tópico(s)</p>
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="text-center text-gray-400 py-8">
                    <p>Nenhuma disciplina encontrada.</p>
                </div>
            )}
        </Card>
    );
};
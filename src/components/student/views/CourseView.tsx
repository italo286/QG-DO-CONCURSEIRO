import React from 'react';
import { Course, StudentProgress, Subject, User, CourseDiscipline } from '../../../types';
import { Card } from '../../ui';
import { BookOpenIcon } from '../../Icons';
import { WeeklyLeaderboard } from '../WeeklyLeaderboard';

interface CourseViewProps {
    course: Course;
    allSubjects: Subject[];
    studentProgress: StudentProgress;
    allStudents: User[];
    allStudentProgress: { [studentId: string]: StudentProgress };
    currentUserId: string;
    onSubjectSelect: (subject: Subject) => void;
    onSelectTargetCargo: (courseId: string, cargoName: string) => void;
}

export const CourseView: React.FC<CourseViewProps> = ({ course, allSubjects, studentProgress, allStudents, allStudentProgress, currentUserId, onSubjectSelect, onSelectTargetCargo }) => {
    const courseSubjects = allSubjects.filter(s => (course.disciplines || []).some((d: CourseDiscipline) => d.subjectId === s.id));

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-6">
                 {course.imageUrl ? (
                    <img src={course.imageUrl} alt="" className="h-24 w-24 object-cover rounded-lg"/>
                ) : (
                    <BookOpenIcon className="h-24 w-24 text-gray-700" />
                )}
                 <div>
                    <h2 className="text-3xl font-bold text-white">{course.name}</h2>
                    {course.editalInfo && (
                        <div className="mt-2">
                            <label htmlFor={`cargo-select-${course.id}`} className="text-sm text-gray-400 mr-2">Meu cargo alvo:</label>
                            <select
                                id={`cargo-select-${course.id}`}
                                value={studentProgress?.targetCargoByCourse?.[course.id] || ''}
                                onChange={e => onSelectTargetCargo(course.id, e.target.value)}
                                className="bg-gray-700 border border-gray-600 rounded-md shadow-sm py-1 px-2 text-white text-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
                            >
                                <option value="">Selecione um cargo...</option>
                                {course.editalInfo.cargosEVagas.map((c: { cargo: string }) => <option key={c.cargo} value={c.cargo}>{c.cargo}</option>)}
                            </select>
                        </div>
                    )}
                 </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
                <div className="lg:col-span-2">
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {courseSubjects.map(subject => (
                            <li key={subject.id}>
                                <Card onClick={() => onSubjectSelect(subject)} className="h-full hover:border-cyan-500/50 transition-colors flex flex-col">
                                    <div className="p-6 flex-grow">
                                        <h3 className="text-xl font-bold text-cyan-400">{subject.name}</h3>
                                        <p className="text-sm text-gray-400 mt-2 line-clamp-2">{subject.description}</p>
                                    </div>
                                    <div className="p-4 border-t border-gray-700 text-right text-cyan-400 font-semibold">
                                        Ver Disciplina <span aria-hidden="true">&rarr;</span>
                                    </div>
                                </Card>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="lg:col-span-1 space-y-8">
                    <WeeklyLeaderboard
                        allStudents={allStudents}
                        allProgress={allStudentProgress}
                        currentUserId={currentUserId}
                        courseStudentIds={course.enrolledStudentIds}
                        courseName={course.name}
                    />
                </div>
            </div>
        </div>
    );
};
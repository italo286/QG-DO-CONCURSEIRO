
import React, { useMemo } from 'react';
import { Course, StudentProgress, Subject, User, CourseDiscipline } from '../../../types';
import { Card } from '../../ui';
import { BookOpenIcon, ChartBarIcon, SubjectIcon, ArrowRightIcon } from '../../Icons';
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

export const CourseView: React.FC<CourseViewProps> = ({ 
    course, 
    allSubjects, 
    studentProgress, 
    allStudents, 
    allStudentProgress, 
    currentUserId, 
    onSubjectSelect, 
    onSelectTargetCargo 
}) => {
    const courseSubjects = allSubjects.filter(s => course.disciplines.some((d: CourseDiscipline) => d.subjectId === s.id));

    const courseStats = useMemo(() => {
        let totalTopics = 0;
        let completedTopics = 0;
        
        courseSubjects.forEach(subject => {
            const subjectProgress = studentProgress?.progressByTopic[subject.id] || {};
            subject.topics.forEach(t => {
                totalTopics++;
                if (subjectProgress[t.id]?.completed) completedTopics++;
                t.subtopics.forEach(st => {
                    totalTopics++;
                    if (subjectProgress[st.id]?.completed) completedTopics++;
                });
            });
        });

        return {
            percent: totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0,
            completed: completedTopics,
            total: totalTopics
        };
    }, [courseSubjects, studentProgress]);

    return (
        <div className="space-y-10 animate-fade-in">
            {/* Hero Section */}
            <div className="relative overflow-hidden rounded-[2.5rem] bg-gray-800/40 border border-gray-700/50 p-8 md:p-12 shadow-2xl">
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="relative flex flex-col lg:flex-row gap-8 items-center lg:items-end">
                    <div className="flex-shrink-0 relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                        {course.imageUrl ? (
                            <img src={course.imageUrl} alt="" className="relative h-44 w-44 object-cover rounded-3xl shadow-2xl border-4 border-gray-900/50"/>
                        ) : (
                            <div className="relative h-44 w-44 bg-gray-900 flex items-center justify-center rounded-3xl border border-gray-700">
                                <BookOpenIcon className="h-16 w-16 text-gray-700" />
                            </div>
                        )}
                    </div>

                    <div className="flex-grow text-center lg:text-left">
                        <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-cyan-500/10 text-cyan-400 text-[10px] font-black uppercase tracking-[0.3em] mb-6 border border-cyan-500/20">
                            Foco Total: Ativo
                        </span>
                        <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-6 leading-none drop-shadow-lg">
                            {course.name}
                        </h2>

                        {course.editalInfo && (
                            <div className="inline-flex items-center gap-4 bg-gray-950/80 p-1.5 pl-5 pr-2 rounded-2xl border border-gray-800 backdrop-blur-xl">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Cargo Alvo</span>
                                <select
                                    value={studentProgress?.targetCargoByCourse?.[course.id] || ''}
                                    onChange={e => onSelectTargetCargo(course.id, e.target.value)}
                                    className="bg-cyan-500/10 hover:bg-cyan-500/20 text-sm font-black text-cyan-400 px-4 py-2 rounded-xl focus:outline-none cursor-pointer transition-colors"
                                >
                                    <option value="" className="bg-gray-900">Definir Objetivo...</option>
                                    {course.editalInfo.cargosEVagas.map((c: { cargo: string }) => (
                                        <option key={c.cargo} value={c.cargo} className="bg-gray-900">{c.cargo}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="w-full lg:w-72 space-y-4 bg-gray-950/60 p-6 rounded-[2rem] border border-gray-800/50 backdrop-blur-md shadow-inner">
                        <div className="flex justify-between items-end">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Performance Global</span>
                            <span className="text-2xl font-black text-white">{courseStats.percent}%</span>
                        </div>
                        <div className="h-2.5 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
                            <div 
                                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 shadow-[0_0_15px_rgba(6,182,212,0.6)] transition-all duration-1000" 
                                style={{ width: `${courseStats.percent}%` }}
                            ></div>
                        </div>
                        <p className="text-[10px] text-center text-gray-500 font-bold uppercase tracking-tight">
                            {courseStats.completed} de {courseStats.total} missões concluídas
                        </p>
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Subject List */}
                <div className="lg:col-span-8 space-y-8">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3 italic">
                            <ChartBarIcon className="h-7 w-7 text-cyan-500" />
                            Matriz Curricular
                        </h3>
                        <span className="text-[10px] font-black text-gray-500 bg-gray-800/50 px-3 py-1 rounded-full border border-gray-700 uppercase tracking-widest">
                            {courseSubjects.length} Disciplinas
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {courseSubjects.map(subject => {
                            return (
                                <button 
                                    key={subject.id}
                                    onClick={() => onSubjectSelect(subject)}
                                    className="group text-left"
                                >
                                    {/* Card Cor Padronizada: Deep Navy (#1e293b) para destacar do fundo #111827 */}
                                    <Card className="h-full border border-gray-700/50 bg-[#1e293b] hover:bg-[#253249] transition-all duration-500 relative overflow-hidden flex flex-col rounded-[2rem] shadow-2xl group-hover:translate-y-[-6px] group-hover:shadow-cyan-500/10 group-hover:border-cyan-500/40">
                                        
                                        {/* Brilho Superior sutil */}
                                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        
                                        {/* Ícone de Fundo Marca d'água */}
                                        <div className="absolute -top-6 -right-6 p-4 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity duration-700 rotate-12 group-hover:rotate-0">
                                            <SubjectIcon subjectName={subject.name} className="h-40 w-40 text-cyan-400" />
                                        </div>
                                        
                                        <div className="p-8 flex-grow relative z-10">
                                            <div className="flex items-start justify-between mb-8">
                                                <div className="relative">
                                                    {/* Glow de fundo no ícone */}
                                                    <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                                    <div className="relative w-16 h-16 rounded-2xl bg-gray-900 flex items-center justify-center border border-gray-700 shadow-2xl transform group-hover:scale-110 transition-transform duration-500">
                                                        <SubjectIcon subjectName={subject.name} className="h-8 w-8 text-cyan-400" />
                                                    </div>
                                                </div>
                                                <div className="bg-gray-900/80 px-4 py-2 rounded-2xl border border-gray-700 flex flex-col items-end shadow-lg">
                                                    <span className="text-[8px] font-black text-gray-500 uppercase tracking-[0.25em]">Score Médio</span>
                                                    <span className="text-base font-black text-cyan-400">--</span>
                                                </div>
                                            </div>
                                            
                                            <h4 className="text-xl font-black text-white group-hover:text-cyan-400 transition-colors line-clamp-2 uppercase tracking-tighter leading-tight mb-4 drop-shadow-md">
                                                {subject.name}
                                            </h4>
                                            
                                            <p className="text-xs text-gray-400 font-medium leading-relaxed line-clamp-2 opacity-80 group-hover:opacity-100">
                                                {subject.description || 'Aprimore sua base com mnemônicos, questões filtradas e revisões automatizadas.'}
                                            </p>
                                        </div>

                                        <div className="mt-auto p-6 bg-gray-900/40 border-t border-gray-700/30 flex justify-between items-center backdrop-blur-sm">
                                            <div className="flex gap-2 items-center">
                                                {Array.from({length: 6}).map((_, i) => (
                                                    <div key={i} className={`h-1.5 rounded-full transition-all duration-700 ${i < 2 ? 'w-6 bg-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.6)]' : 'w-2 bg-gray-700'}`}></div>
                                                ))}
                                            </div>
                                            <div className="flex items-center gap-2 text-cyan-400 text-[10px] font-black uppercase tracking-[0.2em] group-hover:translate-x-2 transition-transform">
                                                Acessar Disciplina <ArrowRightIcon className="h-3 w-3" />
                                            </div>
                                        </div>
                                    </Card>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Sidebar Leaderboard */}
                <div className="lg:col-span-4 space-y-8">
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

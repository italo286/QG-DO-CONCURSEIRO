
import React, { useMemo } from 'react';
import { Course, StudentProgress, Subject, User, CourseDiscipline } from '../../../types';
import { Card } from '../../ui';
import { BookOpenIcon, TrophyIcon, ChartBarIcon, CheckBadgeIcon, SubjectIcon } from '../../Icons';
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

    // Cálculo de progresso global do curso
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
            <div className="relative overflow-hidden rounded-3xl bg-gray-800/40 border border-gray-700/50 p-8 md:p-12 shadow-2xl">
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="relative flex flex-col lg:flex-row gap-8 items-center lg:items-end">
                    <div className="flex-shrink-0 relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                        {course.imageUrl ? (
                            <img src={course.imageUrl} alt="" className="relative h-40 w-40 object-cover rounded-2xl shadow-xl"/>
                        ) : (
                            <div className="relative h-40 w-40 bg-gray-900 flex items-center justify-center rounded-2xl border border-gray-700">
                                <BookOpenIcon className="h-16 w-16 text-gray-700" />
                            </div>
                        )}
                    </div>

                    <div className="flex-grow text-center lg:text-left">
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4 border border-cyan-500/20">
                            Curso Ativo
                        </span>
                        <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-4 leading-none">
                            {course.name}
                        </h2>

                        {course.editalInfo && (
                            <div className="inline-flex items-center gap-3 bg-gray-900/60 p-2 pl-4 pr-3 rounded-2xl border border-gray-700 backdrop-blur-md">
                                <span className="text-xs font-bold text-gray-400">CARGO ALVO:</span>
                                <select
                                    value={studentProgress?.targetCargoByCourse?.[course.id] || ''}
                                    onChange={e => onSelectTargetCargo(course.id, e.target.value)}
                                    className="bg-transparent text-sm font-black text-cyan-400 focus:outline-none cursor-pointer pr-4"
                                >
                                    <option value="">Definir Foco...</option>
                                    {course.editalInfo.cargosEVagas.map((c: { cargo: string }) => (
                                        <option key={c.cargo} value={c.cargo}>{c.cargo}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="w-full lg:w-64 space-y-3 bg-gray-900/40 p-5 rounded-2xl border border-gray-700/50 backdrop-blur-sm">
                        <div className="flex justify-between items-end">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Progresso do Curso</span>
                            <span className="text-xl font-black text-white">{courseStats.percent}%</span>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 shadow-[0_0_10px_rgba(6,182,212,0.5)] transition-all duration-1000" 
                                style={{ width: `${courseStats.percent}%` }}
                            ></div>
                        </div>
                        <p className="text-[9px] text-center text-gray-500 font-bold uppercase tracking-tighter">
                            {courseStats.completed} de {courseStats.total} tópicos dominados
                        </p>
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Subject List */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
                            <ChartBarIcon className="h-5 w-5 text-cyan-400" />
                            Matriz Curricular
                        </h3>
                        <span className="text-xs font-bold text-gray-500 uppercase">{courseSubjects.length} Disciplinas</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {courseSubjects.map(subject => {
                            const subjectProgress = studentProgress?.progressByTopic[subject.id] || {};
                            const completedCount = Object.values(subjectProgress).filter((p: any) => p.completed).length;
                            
                            return (
                                <button 
                                    key={subject.id}
                                    onClick={() => onSubjectSelect(subject)}
                                    className="group text-left"
                                >
                                    <Card className="h-full border-gray-700/50 hover:border-cyan-500/50 bg-gray-800/30 transition-all duration-300 relative overflow-hidden flex flex-col">
                                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                            <SubjectIcon subjectName={subject.name} className="h-20 w-20" />
                                        </div>
                                        
                                        <div className="p-6 flex-grow">
                                            <div className="flex items-start justify-between mb-4">
                                                <div 
                                                    className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
                                                    style={{ backgroundColor: `${subject.color || '#4B5563'}20`, color: subject.color || '#9CA3AF' }}
                                                >
                                                    <SubjectIcon subjectName={subject.name} className="h-6 w-6" />
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Score Médio</span>
                                                    <span className="text-sm font-black text-white">--</span>
                                                </div>
                                            </div>
                                            
                                            <h4 className="text-lg font-black text-white group-hover:text-cyan-400 transition-colors line-clamp-1 uppercase tracking-tight">
                                                {subject.name}
                                            </h4>
                                            <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">
                                                {subject.description || 'Explore o conteúdo detalhado desta disciplina.'}
                                            </p>
                                        </div>

                                        <div className="mt-auto p-4 bg-gray-900/30 border-t border-gray-700/30 flex justify-between items-center">
                                            <div className="flex gap-1">
                                                {Array.from({length: 5}).map((_, i) => (
                                                    <div key={i} className={`h-1 w-4 rounded-full ${i < 2 ? 'bg-cyan-500' : 'bg-gray-700'}`}></div>
                                                ))}
                                            </div>
                                            <div className="text-cyan-400 text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                                Estudar Agora →
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

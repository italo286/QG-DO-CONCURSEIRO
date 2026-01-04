
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

    // Mapeia temas visuais baseados no nome da disciplina
    const getSubjectTheme = (name: string) => {
        const lowerName = name.toLowerCase();
        if (lowerName.includes('português') || lowerName.includes('redação') || lowerName.includes('direito')) {
            return {
                bg: 'bg-gradient-to-br from-[#1e1b4b] to-[#701a75]',
                glow: 'shadow-[0_0_40px_-10px_rgba(192,38,211,0.5)]',
                iconColor: 'text-fuchsia-400',
                btnBg: 'bg-gradient-to-r from-cyan-400 to-fuchsia-500',
                dotColor: 'bg-fuchsia-400',
                dotGlow: 'shadow-[0_0_10px_rgba(232,121,249,0.8)]'
            };
        }
        if (lowerName.includes('matemática') || lowerName.includes('raciocínio') || lowerName.includes('informática') || lowerName.includes('contabilidade')) {
            return {
                bg: 'bg-gradient-to-br from-[#082f49] to-[#065f46]',
                glow: 'shadow-[0_0_40px_-10px_rgba(34,197,94,0.4)]',
                iconColor: 'text-emerald-400',
                btnBg: 'bg-gradient-to-r from-emerald-400 to-lime-500',
                dotColor: 'bg-emerald-400',
                dotGlow: 'shadow-[0_0_10px_rgba(52,211,153,0.8)]'
            };
        }
        return {
            bg: 'bg-gradient-to-br from-[#0f172a] to-[#1e3a8a]',
            glow: 'shadow-[0_0_40px_-10px_rgba(6,182,212,0.4)]',
            iconColor: 'text-cyan-400',
            btnBg: 'bg-gradient-to-r from-cyan-500 to-blue-600',
            dotColor: 'bg-cyan-400',
            dotGlow: 'shadow-[0_0_10px_rgba(34,211,238,0.8)]'
        };
    };

    const getSubjectProgressInfo = (subjectId: string) => {
        const subject = allSubjects.find(s => s.id === subjectId);
        if (!subject || !studentProgress) return { dots: 0, percent: 0 };

        const subjectProgress = studentProgress.progressByTopic[subjectId] || {};
        let total = 0;
        let done = 0;

        subject.topics.forEach(t => {
            total++;
            if (subjectProgress[t.id]?.completed) done++;
            t.subtopics.forEach(st => {
                total++;
                if (subjectProgress[st.id]?.completed) done++;
            });
        });

        if (total === 0) return { dots: 0, percent: 0 };
        const percent = Math.round((done / total) * 100);
        return { 
            dots: Math.round((done / total) * 6),
            percent 
        };
    };

    return (
        <div className="space-y-12 animate-fade-in pb-20">
            {/* Hero Section - Estilo Header High Performance */}
            <div className="relative overflow-hidden rounded-[3rem] bg-gray-950 border border-gray-800 p-10 md:p-16 shadow-2xl">
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none"></div>

                <div className="relative flex flex-col lg:flex-row gap-12 items-center lg:items-center">
                    <div className="flex-shrink-0 relative group">
                        <div className="absolute -inset-2 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-[2.5rem] blur-xl opacity-30 group-hover:opacity-60 transition duration-1000"></div>
                        {course.imageUrl ? (
                            <img src={course.imageUrl} alt="" className="relative h-56 w-56 object-cover rounded-[2rem] shadow-2xl border-2 border-white/10"/>
                        ) : (
                            <div className="relative h-56 w-56 bg-gray-900 flex items-center justify-center rounded-[2rem] border border-gray-700">
                                <BookOpenIcon className="h-20 w-20 text-gray-700" />
                            </div>
                        )}
                    </div>

                    <div className="flex-grow text-center lg:text-left space-y-6">
                        <div className="inline-flex items-center px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] font-black uppercase tracking-[0.4em] mb-4">
                            Protocolo High Performance Ativado
                        </div>
                        <h2 className="text-5xl md:text-6xl font-black text-white tracking-tighter leading-[0.9] drop-shadow-2xl">
                            {course.name}
                        </h2>

                        {course.editalInfo && (
                            <div className="inline-flex flex-wrap justify-center lg:justify-start items-center gap-4 bg-white/5 p-2 pr-4 rounded-3xl border border-white/10 backdrop-blur-2xl">
                                <div className="bg-gray-950 px-4 py-2 rounded-2xl border border-gray-800">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cargo Alvo</span>
                                </div>
                                <select
                                    value={studentProgress?.targetCargoByCourse?.[course.id] || ''}
                                    onChange={e => onSelectTargetCargo(course.id, e.target.value)}
                                    className="bg-transparent text-sm font-black text-cyan-400 focus:outline-none cursor-pointer"
                                >
                                    <option value="" className="bg-gray-900">Configurar Objetivo...</option>
                                    {course.editalInfo.cargosEVagas.map((c: { cargo: string }) => (
                                        <option key={c.cargo} value={c.cargo} className="bg-gray-900">{c.cargo}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="w-full lg:w-80 space-y-4 bg-white/5 p-8 rounded-[2.5rem] border border-white/10 backdrop-blur-3xl shadow-inner text-center lg:text-left">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Status Geral</span>
                            <span className="text-3xl font-black text-white">{courseStats.percent}%</span>
                        </div>
                        <div className="h-3 bg-gray-900 rounded-full overflow-hidden border border-white/5 p-0.5">
                            <div 
                                className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.6)] transition-all duration-1000" 
                                style={{ width: `${courseStats.percent}%` }}
                            ></div>
                        </div>
                        <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mt-4">
                            {courseStats.completed} de {courseStats.total} metas batidas
                        </p>
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                {/* Listagem de Disciplinas Estilizada */}
                <div className="lg:col-span-8 space-y-10">
                    <div className="flex items-center justify-between px-4">
                        <h3 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-4 italic">
                            <div className="w-1.5 h-8 bg-cyan-500 rounded-full"></div>
                            Trilha de Especialização
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {courseSubjects.map(subject => {
                            const { dots, percent } = getSubjectProgressInfo(subject.id);
                            const theme = getSubjectTheme(subject.name);
                            
                            return (
                                <button 
                                    key={subject.id}
                                    onClick={() => onSubjectSelect(subject)}
                                    className="group text-left"
                                >
                                    <div className={`h-full min-h-[320px] rounded-[2.5rem] ${theme.bg} ${theme.glow} p-8 flex flex-col relative overflow-hidden transition-all duration-500 group-hover:scale-[1.02] group-hover:brightness-110`}>
                                        
                                        {/* Elemento de Brilho de Fundo */}
                                        <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-[60px] pointer-events-none"></div>

                                        {/* Score Badge (Estilo Glass) */}
                                        <div className="absolute top-6 right-6">
                                            <div className="bg-black/20 backdrop-blur-md border border-white/10 px-5 py-3 rounded-2xl flex flex-col items-center min-w-[80px]">
                                                <span className="text-[8px] font-black text-white/60 uppercase tracking-widest mb-1">Score Médio</span>
                                                <span className="text-xl font-black text-white">{percent > 0 ? `${percent}%` : '--'}</span>
                                            </div>
                                        </div>

                                        {/* Ícone Neon */}
                                        <div className="mb-10 relative">
                                            <div className={`relative w-20 h-20 rounded-3xl bg-gray-950/40 flex items-center justify-center border border-white/10 shadow-2xl transition-transform duration-500 group-hover:rotate-6`}>
                                                <SubjectIcon subjectName={subject.name} className={`h-10 w-10 ${theme.iconColor} drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]`} />
                                            </div>
                                        </div>
                                        
                                        <div className="flex-grow">
                                            <h4 className="text-2xl font-black text-white uppercase tracking-tighter leading-none mb-4 group-hover:translate-x-1 transition-transform">
                                                {subject.name}
                                            </h4>
                                            
                                            <p className="text-sm text-white/60 font-medium leading-relaxed line-clamp-2 pr-4">
                                                {subject.description || 'Aprimore sua base com mnemônicos, questões filtradas e revisões automatizadas.'}
                                            </p>
                                        </div>

                                        {/* Footer do Card */}
                                        <div className="mt-10 flex justify-between items-center">
                                            {/* Segmented Dots Neon */}
                                            <div className="flex gap-2.5 items-center">
                                                {Array.from({length: 6}).map((_, i) => (
                                                    <div 
                                                        key={i} 
                                                        className={`h-2 rounded-full transition-all duration-700 
                                                            ${i < dots 
                                                                ? `w-8 ${theme.bg} ${theme.dotColor} ${theme.dotGlow}` 
                                                                : 'w-2.5 bg-black/30'
                                                            }`}
                                                    ></div>
                                                ))}
                                            </div>
                                            
                                            {/* Botão Neon Pill */}
                                            <div className={`${theme.btnBg} px-6 py-3 rounded-full flex items-center gap-3 text-white text-[10px] font-black uppercase tracking-widest shadow-xl group-hover:px-8 transition-all`}>
                                                Acessar <ArrowRightIcon className="h-3 w-3" />
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Sidebar Leaderboard - Mantendo Integridade Visual */}
                <div className="lg:col-span-4 space-y-10">
                    <div className="sticky top-10">
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
        </div>
    );
};

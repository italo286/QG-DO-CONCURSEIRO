
import React, { useMemo } from 'react';
import { Course, StudentProgress, Subject, User, CourseDiscipline } from '../../../types';
import { BookOpenIcon, SubjectIcon, ArrowRightIcon } from '../../Icons';
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
                totalTopics++; if (subjectProgress[t.id]?.completed) completedTopics++;
                t.subtopics.forEach(st => { totalTopics++; if (subjectProgress[st.id]?.completed) completedTopics++; });
            });
        });
        return {
            percent: totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0,
            completed: completedTopics, total: totalTopics
        };
    }, [courseSubjects, studentProgress]);

    const getSubjectTheme = (name: string) => {
        const lowerName = name.toLowerCase();
        if (lowerName.includes('português') || lowerName.includes('redação') || lowerName.includes('direito')) {
            return {
                bg: 'bg-gradient-to-br from-[#2e026d] via-[#5b21b6] to-[#d946ef]',
                glow: 'shadow-[0_0_40px_-10px_rgba(168,85,247,0.4)]',
                iconGlow: 'drop-shadow-[0_0_8px_rgba(217,70,239,1)]',
                btnGrad: 'from-[#22d3ee] to-[#d946ef]',
                btnGlow: 'shadow-[0_0_15px_rgba(34,211,238,0.3)]',
                dotActive: 'bg-[#22d3ee] shadow-[0_0_10px_rgba(34,211,238,0.8)]',
                scoreBg: 'bg-white/10'
            };
        }
        if (lowerName.includes('matemática') || lowerName.includes('raciocínio') || lowerName.includes('informática')) {
            return {
                bg: 'bg-gradient-to-br from-[#0c4a6e] via-[#0284c7] to-[#84cc16]',
                glow: 'shadow-[0_0_40px_-10px_rgba(14,165,233,0.4)]',
                iconGlow: 'drop-shadow-[0_0_8px_rgba(34,211,238,1)]',
                btnGrad: 'from-[#22d3ee] to-[#bef264]',
                btnGlow: 'shadow-[0_0_20px_rgba(34,211,238,0.3)]',
                dotActive: 'bg-[#bef264] shadow-[0_0_10px_rgba(190,242,100,0.8)]',
                scoreBg: 'bg-black/20'
            };
        }
        return {
            bg: 'bg-gradient-to-br from-[#0f172a] via-[#1e40af] to-[#06b6d4]',
            glow: 'shadow-[0_0_40px_-10px_rgba(6,182,212,0.3)]',
            iconGlow: 'drop-shadow-[0_0_8px_rgba(34,211,238,1)]',
            btnGrad: 'from-[#06b6d4] to-[#3b82f6]',
            btnGlow: 'shadow-[0_0_15px_rgba(6,182,212,0.3)]',
            dotActive: 'bg-[#22d3ee] shadow-[0_0_10px_rgba(34,211,238,0.8)]',
            scoreBg: 'bg-white/5'
        };
    };

    const getSubjectProgress = (subjectId: string) => {
        const subject = allSubjects.find(s => s.id === subjectId);
        if (!subject || !studentProgress) return { dots: 0, percent: 0 };
        const subjectProgress = studentProgress.progressByTopic[subjectId] || {};
        let total = 0, done = 0;
        subject.topics.forEach(t => {
            total++; if (subjectProgress[t.id]?.completed) done++;
            t.subtopics.forEach(st => { total++; if (subjectProgress[st.id]?.completed) done++; });
        });
        if (total === 0) return { dots: 0, percent: 0 };
        return { dots: Math.round((done / total) * 6), percent: Math.round((done / total) * 100) };
    };

    return (
        <div className="space-y-12 animate-fade-in pb-20">
            {/* HERO SECTION - REDUZIDA E SEM BADGE */}
            <div className="relative overflow-hidden rounded-[2.5rem] bg-[#020617] border border-white/5 p-5 md:p-8 shadow-2xl flex flex-col md:flex-row items-center gap-8">
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none"></div>

                <div className="flex-shrink-0 relative">
                    <div className="absolute -inset-2 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-[1.4rem] blur-lg opacity-20"></div>
                    {course.imageUrl ? (
                        <img src={course.imageUrl} alt="" className="relative h-24 w-24 object-cover rounded-[1.2rem] shadow-2xl border border-white/10"/>
                    ) : (
                        <div className="relative h-24 w-24 bg-gray-900 flex items-center justify-center rounded-[1.2rem] border border-gray-800">
                            <BookOpenIcon className="h-8 w-8 text-gray-700" />
                        </div>
                    )}
                </div>

                <div className="flex-grow text-center md:text-left">
                    <h2 className="text-3xl md:text-5xl font-black text-white tracking-tighter leading-tight drop-shadow-2xl uppercase italic">
                        {course.name}
                    </h2>
                </div>

                <div className="w-full md:w-56 bg-white/5 p-4 rounded-[1.8rem] border border-white/10 backdrop-blur-xl shadow-inner relative">
                    <div className="flex justify-between items-end mb-1.5">
                        <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Evolução Total</span>
                        <span className="text-xl font-black text-white">{courseStats.percent}%</span>
                    </div>
                    <div className="h-2 bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/5">
                        <div className="h-full bg-cyan-500 rounded-full shadow-[0_0_10px_cyan]" style={{ width: `${courseStats.percent}%` }}></div>
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div className="lg:col-span-8 space-y-10">
                    <div className="flex items-center justify-between px-4">
                        <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic flex items-center gap-4">
                            <div className="w-1.5 h-8 bg-cyan-500 rounded-full"></div>
                            Minhas Disciplinas
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {courseSubjects.map(subject => {
                            const { dots, percent } = getSubjectProgress(subject.id);
                            const theme = getSubjectTheme(subject.name);
                            return (
                                <button key={subject.id} onClick={() => onSubjectSelect(subject)} className="group text-left">
                                    {/* ALTURA ULTRA-COMPACTA MIN-H-[140PX] E REMOVIDA DESCRIÇÃO */}
                                    <div className={`h-full min-h-[140px] rounded-[2rem] ${theme.bg} ${theme.glow} p-6 flex flex-col relative overflow-hidden transition-all duration-500 group-hover:translate-y-[-4px] border border-white/10`}>
                                        
                                        {/* Score Badge Mínimo */}
                                        <div className="absolute top-4 right-4">
                                            <div className={`${theme.scoreBg} backdrop-blur-xl border border-white/10 px-2 py-1 rounded-lg flex flex-col items-center min-w-[60px] shadow-2xl`}>
                                                <span className="text-[6px] font-black text-white/50 uppercase tracking-widest leading-none mb-0.5">Score</span>
                                                <span className="text-xs font-black text-white">{percent > 0 ? `${percent}%` : '--'}</span>
                                            </div>
                                        </div>

                                        {/* Icon Container Compacto */}
                                        <div className="mb-3 relative">
                                            <div className={`w-10 h-10 rounded-xl bg-black/30 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-2xl transition-transform duration-500 group-hover:scale-110`}>
                                                <SubjectIcon subjectName={subject.name} className={`h-5 w-5 text-white ${theme.iconGlow}`} />
                                            </div>
                                        </div>
                                        
                                        <div className="flex-grow">
                                            <h4 className="text-lg font-black text-white uppercase tracking-tighter leading-tight group-hover:translate-x-1 transition-transform drop-shadow-lg pr-12">
                                                {subject.name}
                                            </h4>
                                        </div>

                                        {/* Rodapé Compacto */}
                                        <div className="mt-3 flex justify-between items-center">
                                            <div className="flex gap-1 items-center">
                                                {Array.from({length: 6}).map((_, i) => (
                                                    <div 
                                                        key={i} 
                                                        className={`h-1 rounded-full transition-all duration-700 
                                                            ${i < dots 
                                                                ? `w-5 ${theme.dotActive}` 
                                                                : 'w-1 bg-black/40'
                                                            }`}
                                                    ></div>
                                                ))}
                                            </div>
                                            
                                            <div className={`bg-gradient-to-r ${theme.btnGrad} ${theme.btnGlow} px-3 py-1.5 rounded-full flex items-center gap-1.5 text-white text-[7px] font-black uppercase tracking-widest shadow-2xl transition-all`}>
                                                ACESSAR <ArrowRightIcon className="h-2 w-2" />
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="lg:col-span-4 space-y-10">
                    <WeeklyLeaderboard allStudents={allStudents} allProgress={allStudentProgress} currentUserId={currentUserId} courseStudentIds={course.enrolledStudentIds} courseName={course.name} />
                </div>
            </div>
        </div>
    );
};

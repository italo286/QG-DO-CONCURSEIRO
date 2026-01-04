
import React, { useMemo } from 'react';
import { Course, StudentProgress, StudyPlan, Subject, TeacherMessage, User, DailyChallenge, Question, Topic, SubTopic } from '../../../types';
import { Card, Button } from '../../ui';
import { BellIcon, BookOpenIcon, ChatBubbleLeftRightIcon, UserCircleIcon, TrashIcon, ArrowRightIcon, CycleIcon } from '../../Icons';
import { StudentFocusPanel } from '../StudentFocusPanel';
import { DailySchedule } from '../DailySchedule';
import { DailyChallenges } from '../DailyChallenges';

interface DashboardHomeProps {
    messages: TeacherMessage[];
    enrolledCourses: Course[];
    studentProgress: StudentProgress;
    currentUser: User;
    fullStudyPlan: StudyPlan;
    allSubjects: Subject[];
    teacherProfiles: User[];
    onAcknowledgeMessage: (messageId: string) => void;
    onCourseSelect: (course: Course) => void;
    onStartDailyChallenge: (challenge: DailyChallenge<Question>, type: 'review' | 'glossary' | 'portuguese') => void;
    onGenerateAllChallenges: () => void;
    isGeneratingAllChallenges: boolean;
    onNavigateToTopic: (topicId: string) => void;
    onToggleTopicCompletion: (subjectId: string, topicId: string, isCompleted: boolean) => void;
    onOpenNewMessageModal: () => void;
    onDeleteMessage: (messageId: string) => void;
    setView: (view: any) => void;
    onSaveFullPlan: (fullPlan: StudyPlan) => Promise<void>;
}

export const DashboardHome: React.FC<DashboardHomeProps> = ({
    messages,
    enrolledCourses,
    studentProgress,
    currentUser,
    fullStudyPlan,
    allSubjects,
    teacherProfiles,
    onAcknowledgeMessage,
    onCourseSelect,
    onStartDailyChallenge,
    onGenerateAllChallenges,
    isGeneratingAllChallenges,
    onNavigateToTopic,
    onToggleTopicCompletion,
    onOpenNewMessageModal,
    onDeleteMessage,
    setView,
    onSaveFullPlan
}) => {
    const broadcasts = useMemo(() => messages.filter(m => m.studentId === null), [messages]);

    const hasUnreadBroadcasts = useMemo(() => 
        broadcasts.some(msg => !msg.acknowledgedBy.includes(currentUser.id)),
        [broadcasts, currentUser.id]
    );

    const lastAccessedInfo = useMemo(() => {
        if (!studentProgress?.lastAccessedTopicId) return null;
        
        for (const subject of allSubjects) {
            for (const topic of subject.topics) {
                if (topic.id === studentProgress.lastAccessedTopicId) {
                    return { subject, topic, subtopic: null };
                }
                const sub = topic.subtopics.find(st => st.id === studentProgress.lastAccessedTopicId);
                if (sub) {
                    return { subject, topic, subtopic: sub };
                }
            }
        }
        return null;
    }, [studentProgress, allSubjects]);

    const handleUpdateQuickRoutine = async (day: number, time: string, content: string | null) => {
        const activePlanId = fullStudyPlan.activePlanId;
        if (!activePlanId) return;

        const newPlans = fullStudyPlan.plans.map(p => {
            if (p.id === activePlanId) {
                const routine = { ...p.weeklyRoutine };
                if (!routine[day]) routine[day] = {};
                if (content !== null) routine[day][time] = content;
                else delete routine[day][time];
                return { ...p, weeklyRoutine: routine };
            }
            return p;
        });
        
        await onSaveFullPlan({ ...fullStudyPlan, plans: newPlans });
    };

    return (
        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 pb-20">
            {/* Coluna Principal */}
            <div className="lg:col-span-8 space-y-8">
                
                {/* CONTINUE DE ONDE PAROU - DESTAQUE NO TOPO */}
                {lastAccessedInfo && (
                    <Card className="p-6 bg-cyan-500/5 border-cyan-500/30 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-6 animate-fade-in group hover:bg-cyan-500/10 transition-all duration-500 shadow-xl shadow-cyan-500/5">
                        <div className="h-16 w-16 rounded-2xl bg-cyan-500 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)] flex-shrink-0 group-hover:scale-110 transition-transform">
                            <CycleIcon className="h-8 w-8 text-white" />
                        </div>
                        <div className="flex-grow text-center md:text-left min-w-0">
                            <span className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.3em] mb-1 block">Retomar Jornada</span>
                            <h4 className="text-xl font-black text-white uppercase tracking-tighter leading-none truncate">
                                {lastAccessedInfo.subtopic?.name || lastAccessedInfo.topic.name}
                            </h4>
                            <p className="text-xs text-gray-500 font-bold mt-1 uppercase tracking-widest opacity-60">
                                {lastAccessedInfo.subject.name}
                            </p>
                        </div>
                        <Button 
                            onClick={() => onNavigateToTopic(studentProgress.lastAccessedTopicId!)}
                            className="w-full md:w-auto py-4 px-10 text-[10px] font-black uppercase tracking-[0.2em] shadow-xl rounded-2xl"
                        >
                            ESTUDAR AGORA
                        </Button>
                    </Card>
                )}

                <DailyChallenges 
                    studentProgress={studentProgress}
                    onStartDailyChallenge={onStartDailyChallenge}
                    onGenerateAllChallenges={onGenerateAllChallenges}
                    isGeneratingAll={isGeneratingAllChallenges}
                />

                <StudentFocusPanel enrolledCourses={enrolledCourses} studentProgress={studentProgress} />

                <Card className="p-8 bg-gray-800/40 border-gray-700/50 rounded-[2.5rem]">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-1.5 h-7 bg-cyan-500 rounded-full shadow-[0_0_10px_cyan]"></div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">Meus Cursos</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {enrolledCourses.map(course => {
                            const teacher = teacherProfiles.find(p => p.id === course.teacherId);
                            return (
                                <Card key={course.id} onClick={() => onCourseSelect(course)} className="group hover:border-cyan-500/50 transition-all duration-500 flex flex-col !p-0 overflow-hidden bg-gray-900/60 shadow-2xl rounded-[2rem] hover:translate-y-[-4px]">
                                    {course.imageUrl ? (
                                        <div className="relative h-44 overflow-hidden">
                                            <img src={course.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"/>
                                            <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-60"></div>
                                        </div>
                                    ) : (
                                        <div className="w-full h-44 bg-gray-800 flex items-center justify-center">
                                            <BookOpenIcon className="h-10 w-10 text-gray-700"/>
                                        </div>
                                    )}
                                    <div className="p-7 flex-grow flex flex-col">
                                        <h4 className="text-xl font-black text-white group-hover:text-cyan-400 transition-colors flex-grow leading-tight uppercase tracking-tight italic">{course.name}</h4>
                                        <div className="mt-6 flex items-center justify-between border-t border-gray-800/50 pt-5">
                                            <div className="flex items-center gap-2">
                                                {teacher?.avatarUrl ? (
                                                    <img src={teacher.avatarUrl} alt={teacher.name} className="h-7 w-7 rounded-full object-cover ring-2 ring-gray-700 shadow-md" />
                                                ) : (
                                                    <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center border border-gray-600">
                                                        <UserCircleIcon className="h-4 w-4 text-gray-400" />
                                                    </div>
                                                )}
                                                <span className="text-[10px] font-black uppercase text-gray-300 tracking-widest group-hover:text-cyan-400 transition-colors">
                                                    {teacher?.name?.split(' ')[0] || 'Professor'}
                                                </span>
                                            </div>
                                            <div className="text-cyan-400 text-[10px] font-black uppercase tracking-widest flex items-center group-hover:gap-2 transition-all">
                                                ACESSAR <ArrowRightIcon className="h-3 w-3" />
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            )
                        })}
                    </div>
                </Card>
            </div>

            {/* Barra Lateral Direita */}
            <div className="lg:col-span-4 space-y-10">
                {studentProgress && (
                    <DailySchedule 
                        fullStudyPlan={fullStudyPlan} 
                        subjects={allSubjects} 
                        studentProgress={studentProgress} 
                        onNavigateToTopic={onNavigateToTopic} 
                        onToggleTopicCompletion={onToggleTopicCompletion}
                        onViewFullSchedule={() => setView('schedule')}
                        onUpdateRoutine={handleUpdateQuickRoutine}
                    />
                )}

                <div className="space-y-6">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-xl font-black text-white flex items-center uppercase tracking-tighter italic">
                            <div className="relative mr-3">
                                <BellIcon className="h-6 w-6 text-orange-400" aria-hidden="true"/> 
                                {hasUnreadBroadcasts && (
                                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></div>
                                )}
                            </div>
                            Mural de Avisos
                        </h3>
                    </div>

                    <div className="space-y-4 max-h-[550px] overflow-y-auto pr-2 custom-scrollbar">
                        {broadcasts.length > 0 ? broadcasts.map(msg => {
                            const teacher = teacherProfiles.find(t => t.id === msg.teacherId);
                            const isUnread = !msg.acknowledgedBy.includes(currentUser.id);
                            return (
                                <div key={msg.id} className={`group relative p-5 rounded-[2rem] border transition-all duration-300 ${isUnread ? 'bg-orange-500/5 border-orange-500/20 shadow-lg shadow-orange-500/5' : 'bg-gray-800/40 border-gray-700/40'}`}>
                                    <button onClick={() => onDeleteMessage(msg.id)} className="absolute top-4 right-4 p-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100"><TrashIcon className="h-5 w-5" /></button>
                                    <div className="flex gap-4 items-start" onClick={() => isUnread && onAcknowledgeMessage(msg.id)}>
                                        <div className="flex-shrink-0">
                                            {teacher?.avatarUrl ? <img src={teacher.avatarUrl} alt="" className="h-10 w-10 rounded-xl object-cover" /> : <div className="h-10 w-10 rounded-xl bg-gray-700 flex items-center justify-center"><UserCircleIcon className="h-6 w-6 text-gray-500" /></div>}
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest truncate">Prof. {teacher?.name || 'QG'}</p>
                                            <p className={`text-sm mt-1 leading-relaxed ${isUnread ? 'text-white font-bold' : 'text-gray-400'}`}>{msg.message}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        }) : <p className="text-center text-gray-600 text-xs font-black uppercase py-10 border-2 border-dashed border-gray-800 rounded-[2rem]">Nenhum aviso</p>}
                    </div>
                </div>
            </div>

            <button
                onClick={onOpenNewMessageModal}
                className="fixed bottom-10 right-10 w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-[1.8rem] shadow-[0_15px_30px_-5px_rgba(6,182,212,0.4)] flex items-center justify-center text-white hover:scale-110 active:scale-90 transition-all z-50 border border-white/10"
            >
                <ChatBubbleLeftRightIcon className="h-8 w-8" />
            </button>
        </div>
    );
};

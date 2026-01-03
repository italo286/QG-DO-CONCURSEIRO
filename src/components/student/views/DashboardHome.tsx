
import React, { useMemo } from 'react';
import { Course, StudentProgress, StudyPlan, Subject, TeacherMessage, User, DailyChallenge, Question, Topic, SubTopic } from '../../../types';
import { Card, Button } from '../../ui';
import { BellIcon, BookOpenIcon, ChatBubbleLeftRightIcon, XCircleIcon, UserCircleIcon, TrashIcon, ArrowRightIcon } from '../../Icons';
import { StudentFocusPanel } from '../StudentFocusPanel';
import { DailySchedule } from '../DailySchedule';
import { DailyChallenges } from '../DailyChallenges';
import * as FirebaseService from '../../../services/firebaseService';

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
    onDeleteMessage
}) => {
    const broadcasts = useMemo(() => messages.filter(m => m.studentId === null), [messages]);

    const renderAnnouncementsView = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
                <h3 className="text-xl font-black text-white flex items-center uppercase tracking-tighter italic">
                    <div className="relative mr-3">
                        <BellIcon className="h-6 w-6 text-orange-400" aria-hidden="true"/> 
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                    </div>
                    Mural de Inteligência
                </h3>
                <span className="text-[10px] font-black text-gray-500 bg-gray-900/50 px-2 py-1 rounded-md border border-gray-800">
                    {broadcasts.length} ALERTAS
                </span>
            </div>

            <div className="space-y-4 max-h-[550px] overflow-y-auto pr-2 custom-scrollbar">
                {broadcasts.length > 0 ? broadcasts.map(msg => {
                    const teacher = teacherProfiles.find(t => t.id === msg.teacherId);
                    const isUnread = !msg.acknowledgedBy.includes(currentUser.id);
                    const date = new Date(msg.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
                    
                    // Extrair contexto de subtópico se houver (lógica simulada para o botão solicitado)
                    const targetSubtopicId = msg.context?.subtopicId || msg.context?.topicId;

                    return (
                        <div 
                            key={msg.id} 
                            className={`group relative p-5 rounded-3xl border transition-all duration-300 backdrop-blur-xl shadow-2xl
                                ${isUnread 
                                    ? 'bg-orange-500/5 border-orange-500/20 hover:bg-orange-500/10' 
                                    : 'bg-gray-800/40 border-gray-700/40 hover:bg-gray-800/60'
                                }`}
                        >
                            {/* Botão Descartar */}
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteMessage(msg.id);
                                }}
                                className="absolute top-4 right-4 p-2 rounded-xl text-gray-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all z-10"
                                title="Descartar este aviso"
                            >
                                <TrashIcon className="h-5 w-5" />
                            </button>

                            <div className="flex gap-4 items-start" onClick={() => isUnread && onAcknowledgeMessage(msg.id)}>
                                <div className="flex-shrink-0">
                                    {teacher?.avatarUrl ? (
                                        <img src={teacher.avatarUrl} alt="" className="h-12 w-12 rounded-2xl object-cover ring-2 ring-gray-700/50 shadow-lg" />
                                    ) : (
                                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                                            <UserCircleIcon className="h-7 w-7 text-gray-500" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-grow min-w-0">
                                    <div className="flex justify-between items-center mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="font-black text-cyan-400 text-xs uppercase tracking-widest truncate">
                                                Prof. {teacher?.name || 'QG'}
                                            </span>
                                            <span className="w-1 h-1 rounded-full bg-gray-700"></span>
                                            <span className="text-[10px] font-mono text-gray-500 uppercase">{date}</span>
                                        </div>
                                    </div>
                                    <p className={`text-sm leading-relaxed mb-4 ${isUnread ? 'text-white font-bold' : 'text-gray-400 font-medium italic'}`}>
                                        "{msg.message}"
                                    </p>
                                    
                                    <div className="flex items-center gap-3">
                                        {targetSubtopicId && (
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onNavigateToTopic(targetSubtopicId);
                                                }}
                                                className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-900/20"
                                            >
                                                Acessar Conteúdo <ArrowRightIcon className="h-3 w-3" />
                                            </button>
                                        )}
                                        {isUnread && (
                                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20">
                                                <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></div>
                                                <span className="text-[9px] font-black text-orange-400 uppercase tracking-tighter">Novo</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                }) : (
                    <div className="flex flex-col items-center justify-center py-16 px-8 border-2 border-dashed border-gray-800 rounded-[2.5rem] opacity-30">
                        <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
                            <BellIcon className="h-8 w-8 text-gray-600" />
                        </div>
                        <p className="text-center text-xs font-black uppercase tracking-widest text-gray-600">Frequência Limpa</p>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 pb-20">
            {/* Coluna Principal */}
            <div className="lg:col-span-8 space-y-8">
                <DailyChallenges 
                    studentProgress={studentProgress}
                    onStartDailyChallenge={onStartDailyChallenge}
                    onGenerateAllChallenges={onGenerateAllChallenges}
                    isGeneratingAll={isGeneratingAllChallenges}
                />

                <StudentFocusPanel enrolledCourses={enrolledCourses} studentProgress={studentProgress} />

                <Card className="p-8 bg-gray-800/40 border-gray-700/50 rounded-[2rem]">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-2 h-6 bg-cyan-500 rounded-full"></div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Academia de Cursos</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {enrolledCourses.map(course => (
                            <Card key={course.id} onClick={() => onCourseSelect(course)} className="group hover:border-cyan-500/50 transition-all duration-500 flex flex-col !p-0 overflow-hidden bg-gray-900/60 shadow-2xl rounded-[1.5rem] hover:translate-y-[-4px]">
                                {course.imageUrl ? (
                                    <div className="relative h-40 overflow-hidden">
                                        <img src={course.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"/>
                                        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-60"></div>
                                    </div>
                                ) : (
                                    <div className="w-full h-40 bg-gray-800 flex items-center justify-center">
                                        <BookOpenIcon className="h-10 w-10 text-gray-700"/>
                                    </div>
                                )}
                                <div className="p-6 flex-grow flex flex-col">
                                    <h4 className="text-xl font-black text-white group-hover:text-cyan-400 transition-colors flex-grow leading-tight uppercase tracking-tight">{course.name}</h4>
                                    <div className="mt-6 flex items-center justify-between border-t border-gray-800 pt-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center">
                                                <UserCircleIcon className="h-3.5 w-3.5 text-gray-400" />
                                            </div>
                                            <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">
                                                {teacherProfiles.find(p => p.id === course.teacherId)?.name?.split(' ')[0] || 'Professor'}
                                            </span>
                                        </div>
                                        <div className="text-cyan-400 text-[10px] font-black uppercase tracking-widest flex items-center group-hover:gap-2 transition-all">
                                            TREINAR <ArrowRightIcon className="h-3 w-3" />
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                        {enrolledCourses.length === 0 && <p className="text-gray-500 md:col-span-2 text-center py-16 border-2 border-dashed border-gray-800 rounded-3xl">Inicie sua jornada matriculando-se em um curso.</p>}
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
                    />
                )}

                {/* Mural de Avisos adaptado para a lateral */}
                <div className="p-1">
                    {renderAnnouncementsView()}
                </div>
            </div>

            {/* Botão Flutuante de Chat */}
            <button
                onClick={onOpenNewMessageModal}
                className="fixed bottom-10 right-10 w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-3xl shadow-[0_15px_30px_-5px_rgba(6,182,212,0.4)] flex items-center justify-center text-white hover:scale-110 active:scale-90 hover:rotate-3 transition-all duration-300 z-50 group"
                aria-label="Falar com o Professor"
            >
                <ChatBubbleLeftRightIcon className="h-8 w-8" />
                <span className="absolute right-24 bg-gray-900/90 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest py-3 px-6 rounded-2xl opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap border border-gray-700/50 shadow-2xl pointer-events-none translate-x-4 group-hover:translate-x-0">
                    Comunicação Direta
                </span>
            </button>
        </div>
    );
};

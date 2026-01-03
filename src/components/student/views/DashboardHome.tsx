
import React, { useMemo } from 'react';
import { Course, StudentProgress, StudyPlan, Subject, TeacherMessage, User, DailyChallenge, Question } from '../../../types';
import { Card, Button } from '../../ui';
import { BellIcon, BookOpenIcon, ChatBubbleLeftRightIcon, XCircleIcon, UserCircleIcon, TrashIcon } from '../../Icons';
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

            <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                {broadcasts.length > 0 ? broadcasts.map(msg => {
                    const teacher = teacherProfiles.find(t => t.id === msg.teacherId);
                    const isUnread = !msg.acknowledgedBy.includes(currentUser.id);
                    const date = new Date(msg.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
                    
                    return (
                        <div 
                            key={msg.id} 
                            className={`group relative p-4 rounded-2xl border transition-all duration-300 backdrop-blur-md shadow-lg
                                ${isUnread 
                                    ? 'bg-orange-500/5 border-orange-500/20 hover:bg-orange-500/10' 
                                    : 'bg-gray-800/40 border-gray-700/50 hover:bg-gray-800/60'
                                }`}
                        >
                            {/* Botão Descartar */}
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteMessage(msg.id);
                                }}
                                className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all z-10"
                                title="Descartar este aviso"
                            >
                                <TrashIcon className="h-4 w-4" />
                            </button>

                            <div className="flex gap-4 items-start" onClick={() => isUnread && onAcknowledgeMessage(msg.id)}>
                                <div className="flex-shrink-0 pt-1">
                                    {teacher?.avatarUrl ? (
                                        <img src={teacher.avatarUrl} alt="" className="h-10 w-10 rounded-xl object-cover ring-2 ring-gray-700/50" />
                                    ) : (
                                        <div className="h-10 w-10 rounded-xl bg-gray-700 flex items-center justify-center">
                                            <UserCircleIcon className="h-6 w-6 text-gray-500" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-grow min-w-0">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-black text-cyan-400 text-[10px] uppercase tracking-widest truncate">
                                            Prof. {teacher?.name?.split(' ')[0] || 'QG'}
                                        </span>
                                        <span className="text-[9px] font-mono text-gray-500 uppercase">{date}</span>
                                    </div>
                                    <p className={`text-sm leading-relaxed ${isUnread ? 'text-white font-bold' : 'text-gray-400 font-medium italic'}`}>
                                        "{msg.message}"
                                    </p>
                                    {isUnread && (
                                        <div className="mt-2 flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                                            <span className="text-[9px] font-black text-orange-400 uppercase tracking-tighter">Novo Alerta</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                }) : (
                    <div className="flex flex-col items-center justify-center py-12 px-6 border-2 border-dashed border-gray-800 rounded-3xl opacity-40">
                        <BellIcon className="h-12 w-12 text-gray-600 mb-3" />
                        <p className="text-center text-xs font-bold uppercase tracking-widest text-gray-600">Mural Limpo. Sem novos avisos.</p>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 pb-20">
            {/* Coluna Principal */}
            <div className="lg:col-span-8 space-y-8">
                {/* Central de Missões agora em destaque no topo */}
                <DailyChallenges 
                    studentProgress={studentProgress}
                    onStartDailyChallenge={onStartDailyChallenge}
                    onGenerateAllChallenges={onGenerateAllChallenges}
                    isGeneratingAll={isGeneratingAllChallenges}
                />

                <StudentFocusPanel enrolledCourses={enrolledCourses} studentProgress={studentProgress} />

                <Card className="p-6 bg-gray-800/40 border-gray-700/50">
                    <h3 className="text-xl font-black text-white mb-6 uppercase tracking-tighter">Meus Cursos Ativos</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {enrolledCourses.map(course => (
                            <Card key={course.id} onClick={() => onCourseSelect(course)} className="group hover:border-cyan-500/50 transition-all duration-300 flex flex-col !p-0 overflow-hidden bg-gray-900/60 shadow-lg">
                                {course.imageUrl ? (
                                    <img src={course.imageUrl} alt="" className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-500"/>
                                ) : (
                                    <div className="w-full h-32 bg-gray-800 flex items-center justify-center">
                                        <BookOpenIcon className="h-10 w-10 text-gray-700"/>
                                    </div>
                                )}
                                <div className="p-5 flex-grow flex flex-col">
                                    <h4 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors flex-grow leading-tight">{course.name}</h4>
                                    <div className="mt-4 flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">
                                            {teacherProfiles.find(p => p.id === course.teacherId)?.name || 'Professor'}
                                        </span>
                                        <div className="text-cyan-400 text-xs font-bold flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            ACESSAR <span className="ml-1">→</span>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                        {enrolledCourses.length === 0 && <p className="text-gray-500 md:col-span-2 text-center py-10 border-2 border-dashed border-gray-700 rounded-2xl">Você não está matriculado em nenhum curso.</p>}
                    </div>
                </Card>
            </div>

            {/* Barra Lateral Direita */}
            <div className="lg:col-span-4 space-y-8">
                {/* Cronograma Diário agora na lateral com design vertical */}
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

            {/* Botão Flutuante de Chat (FAB) */}
            <button
                onClick={onOpenNewMessageModal}
                className="fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full shadow-[0_8px_30px_rgb(6,182,212,0.4)] flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all duration-300 z-50 group"
                aria-label="Falar com o Professor"
            >
                <ChatBubbleLeftRightIcon className="h-8 w-8" />
                <span className="absolute right-20 bg-gray-900 text-white text-xs font-bold py-2 px-4 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-gray-700 pointer-events-none">
                    Chat com o Professor
                </span>
            </button>
        </div>
    );
};

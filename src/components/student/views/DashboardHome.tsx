
import React, { useMemo } from 'react';
import { Course, StudentProgress, StudyPlan, Subject, TeacherMessage, User, DailyChallenge, Question } from '../../../types';
import { Card, Button } from '../../ui';
import { BellIcon, BookOpenIcon, ChatBubbleLeftRightIcon } from '../../Icons';
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
}) => {
    const broadcasts = useMemo(() => messages.filter(m => m.studentId === null), [messages]);

    const renderAnnouncementsView = () => (
        <div className="space-y-4">
            <h3 className="text-lg font-black text-white flex items-center uppercase tracking-tighter">
                <BellIcon className="h-5 w-5 mr-2 text-orange-400" aria-hidden="true"/> 
                Mural de Avisos
            </h3>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {broadcasts.length > 0 ? broadcasts.map(msg => {
                    const teacher = teacherProfiles.find(t => t.id === msg.teacherId);
                    const isUnread = !msg.acknowledgedBy.includes(currentUser.id);
                    return (
                        <div 
                            key={msg.id} 
                            onClick={() => isUnread && onAcknowledgeMessage(msg.id)}
                            className={`p-3 rounded-xl border transition-all ${isUnread ? 'bg-orange-500/10 border-orange-500/30 cursor-pointer animate-pulse-orange' : 'bg-gray-800/50 border-gray-700'}`}
                        >
                            <p className="font-bold text-gray-300 text-xs">Aviso de {teacher?.name || 'Professor'}</p>
                            <p className="text-gray-100 text-sm mt-1 leading-snug">"{msg.message}"</p>
                        </div>
                    );
                }) : <p className="text-center text-gray-500 py-4 text-sm italic">Nenhum aviso no momento.</p>}
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
                <Card className="p-6 bg-gray-800/80 border-gray-700 shadow-xl">
                    {renderAnnouncementsView()}
                </Card>
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

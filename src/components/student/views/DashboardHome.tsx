
import React, { useMemo } from 'react';
import { Course, StudentProgress, StudyPlan, Subject, TeacherMessage, User, DailyChallenge, Question } from '../../../types';
import { Card, Button } from '../../ui';
import { BellIcon, BookOpenIcon } from '../../Icons';
import { StudentFocusPanel } from '../StudentFocusPanel';
import { DailySchedule } from '../DailySchedule';
import { YouTubeCarousel } from '../YouTubeCarousel';
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
    
    const professorVideos = useMemo(() => {
        const allVideos = enrolledCourses.flatMap(course => course.youtubeCarousel || []);
        // Remove duplicates by URL
        return Array.from(new Map(allVideos.map(v => [v.url, v])).values());
    }, [enrolledCourses]);

    const renderAnnouncementsView = () => (
        <>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white flex items-center"><BellIcon className="h-6 w-6 mr-3 text-cyan-400"/> Mural de Avisos</h3>
                <Button onClick={onOpenNewMessageModal} className="text-sm py-2 px-4">Chat com o Professor</Button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                {broadcasts.length > 0 ? broadcasts.map(msg => {
                    const teacher = teacherProfiles.find(t => t.id === msg.teacherId);
                    const isUnread = !msg.acknowledgedBy.includes(currentUser.id);
                    return (
                        <div 
                            key={msg.id} 
                            onClick={() => isUnread && onAcknowledgeMessage(msg.id)}
                            className={`w-full text-left p-3 rounded-lg ${isUnread ? 'bg-orange-500/20 cursor-pointer' : 'bg-gray-700/50'}`}
                        >
                            <p className="font-semibold text-gray-300 text-sm">Aviso de {teacher?.name}</p>
                            <p className="text-gray-200 text-sm mt-1">"{msg.message}"</p>
                        </div>
                    );
                }) : <p className="text-center text-gray-500 py-4">Nenhum aviso geral no momento.</p>}
            </div>
        </>
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                {studentProgress && <DailySchedule fullStudyPlan={fullStudyPlan} subjects={allSubjects} studentProgress={studentProgress} onNavigateToTopic={onNavigateToTopic} onToggleTopicCompletion={onToggleTopicCompletion} />}
                
                <DailyChallenges 
                    studentProgress={studentProgress}
                    onStartDailyChallenge={onStartDailyChallenge}
                    onGenerateAllChallenges={onGenerateAllChallenges}
                    isGeneratingAll={isGeneratingAllChallenges}
                />

                <StudentFocusPanel enrolledCourses={enrolledCourses} studentProgress={studentProgress} />

                <Card className="p-6">
                    <h3 className="text-xl font-bold text-white mb-4">Meus Cursos</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {enrolledCourses.map(course => (
                            <Card key={course.id} onClick={() => onCourseSelect(course)} className="hover:border-cyan-500/50 transition-colors flex flex-col !p-0 overflow-hidden">
                                {course.imageUrl ? (
                                    <img src={course.imageUrl} alt="" className="w-full h-32 object-cover"/>
                                ) : (
                                    <div className="w-full h-32 bg-gray-700 flex items-center justify-center"><BookOpenIcon className="h-12 w-12 text-gray-500"/></div>
                                )}
                                <div className="p-4 flex-grow flex flex-col">
                                    <h4 className="text-lg font-bold text-cyan-400 flex-grow">{course.name}</h4>
                                    <p className="text-sm text-gray-400 mt-2">
                                        {teacherProfiles.find(p => p.id === course.teacherId)?.name || 'Professor'}
                                    </p>
                                    <div className="mt-4 text-right text-cyan-400 text-sm font-semibold">
                                        Acessar Curso <span aria-hidden="true">&rarr;</span>
                                    </div>
                                </div>
                            </Card>
                        ))}
                        {enrolledCourses.length === 0 && <p className="text-gray-500 md:col-span-2 text-center">Você não está matriculado em nenhum curso.</p>}
                    </div>
                </Card>
                
            </div>
            <div className="lg:col-span-1 space-y-8">
                <YouTubeCarousel videos={professorVideos} />
                 <Card className="p-6 bg-gray-800">
                    {renderAnnouncementsView()}
                </Card>
            </div>
        </div>
    );
};

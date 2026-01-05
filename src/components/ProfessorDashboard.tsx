
import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as FirebaseService from '../services/firebaseService';
import { User, Subject, Course } from '../types';
import { Spinner, Button, Card, Modal, Toast, ConfirmModal } from './ui';
import { BookOpenIcon, PlusIcon, ArrowRightIcon, UserCircleIcon } from './Icons';
import { StudentHeader } from './student/StudentHeader';

import { ProfessorAnnouncements } from './professor/ProfessorAnnouncements';
import { ProfessorCourseEditor } from './professor/ProfessorCourseEditor';
import { ProfessorSubjectEditor } from './professor/ProfessorSubjectEditor';
import { ProfessorScheduler } from './professor/ProfessorScheduler';
import { ProfessorClassPerformance } from './professor/ProfessorClassPerformance';
import { ProfessorReviewsDashboard } from './professor/ProfessorReviewsDashboard';
import { EditProfileModal } from './student/EditProfileModal';
import { ProfessorSubjectsView } from './professor/ProfessorSubjectsView';
import { ProfessorDiagnosticTool } from './professor/ProfessorDiagnosticTool';

export const ProfessorDashboard: React.FC<{ user: User; onLogout: () => void; onUpdateUser: (user: User) => void; }> = ({ user, onLogout, onUpdateUser }) => {
    const [courses, setCourses] = useState<Course[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [students, setStudents] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [view, setView] = useState<'courses' | 'edit_course' | 'edit_subject' | 'scheduler' | 'performance' | 'reviews' | 'subjects' | 'diagnostics'>('courses');
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

    const [isNewCourseModalOpen, setIsNewCourseModalOpen] = useState(false);
    const [newCourseName, setNewCourseName] = useState("");
    const [newCourseImageUrl, setNewCourseImageUrl] = useState("");
    
    const [isNewSubjectModalOpen, setIsNewSubjectModalOpen] = useState(false);
    const [newSubjectName, setNewSubjectName] = useState("");
    
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    useEffect(() => {
        setIsLoading(true);
        const unsubscribers = [
            FirebaseService.listenToCourses(user.id, setCourses),
            FirebaseService.listenToSubjects([user.id], setSubjects),
            FirebaseService.listenToStudents((studentsData: User[]) => {
                setStudents(studentsData);
                setIsLoading(false); 
            })
        ];

        return () => unsubscribers.forEach(unsub => unsub());
    }, [user.id]);
    
    const handleCourseSelect = (course: Course) => {
        const fullCourseData = courses.find(c => c.id === course.id);
        if (fullCourseData) {
            setSelectedCourse(fullCourseData);
            setView('edit_course');
        }
    };

    const handleSubjectSelect = (subject: Subject) => {
        const fullSubjectData = subjects.find(s => s.id === subject.id);
        if (fullSubjectData) {
            setSelectedSubject(fullSubjectData);
            setView('edit_subject');
        }
    };

    const handleBackToDashboard = () => {
        setSelectedCourse(null);
        setSelectedSubject(null);
        setView('courses');
    };

    const handleSaveNewCourse = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!newCourseName.trim()) return;
        
        const courseData: Omit<Course, 'id'> = {
            name: newCourseName,
            teacherId: user.id,
            disciplines: [],
            enrolledStudentIds: [],
            imageUrl: newCourseImageUrl,
        };
        await FirebaseService.saveCourse(courseData);

        setNewCourseName("");
        setNewCourseImageUrl("");
        setIsNewCourseModalOpen(false);
        setToastMessage(`Curso '${newCourseName}' criado com sucesso!`);
    };

    const handleSaveNewSubject = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!newSubjectName.trim()) return;
        const newSubjectData: Omit<Subject, 'id'> = {
            name: newSubjectName,
            teacherId: user.id,
            description: '',
            topics: []
        };
        await FirebaseService.saveSubject(newSubjectData);
        setNewSubjectName("");
        setIsNewSubjectModalOpen(false);
        setToastMessage(`Disciplina '${newSubjectName}' criada com sucesso!`);
    };
    
    const handleCloseNewCourseModal = useCallback(() => {
        setIsNewCourseModalOpen(false);
    }, []);

    const handleCloseNewSubjectModal = useCallback(() => {
        setIsNewSubjectModalOpen(false);
    }, []);

    const handleProfileSave = (updatedUser: User) => {
        onUpdateUser(updatedUser);
    };

    const renderContent = () => {
        if(isLoading) {
             return <div className="flex justify-center items-center h-64"><Spinner /></div>;
        }

        const courseForEditor = courses.find(c => c.id === selectedCourse?.id);
        if (view === 'edit_course' && courseForEditor) {
            return <ProfessorCourseEditor
                course={courseForEditor}
                allSubjects={subjects}
                allStudents={students}
                onBack={handleBackToDashboard}
                setToastMessage={setToastMessage}
            />;
        }

        const subjectForEditor = subjects.find(s => s.id === selectedSubject?.id);
        if (view === 'edit_subject' && subjectForEditor) {
            return <ProfessorSubjectEditor 
                subject={subjectForEditor} 
                onBack={() => setView('subjects')}
                setToastMessage={setToastMessage}
            />;
        }

        if (view === 'scheduler') {
            return <ProfessorScheduler subjects={subjects} students={students} />;
        }
        
        if (view === 'performance') {
            return <ProfessorClassPerformance subjects={subjects} students={students} />;
        }
        
        if (view === 'reviews') {
            return <ProfessorReviewsDashboard students={students} subjects={subjects} setToastMessage={setToastMessage} />;
        }

        if (view === 'subjects') {
            return <ProfessorSubjectsView 
                subjects={subjects} 
                onEditSubject={handleSubjectSelect}
                onCreateSubject={() => setIsNewSubjectModalOpen(true)}
            />;
        }

        if (view === 'diagnostics') {
            return <ProfessorDiagnosticTool students={students} />;
        }
        
        return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <section className="lg:col-span-2 space-y-8" aria-labelledby="courses-heading">
                    <div className="flex justify-between items-center">
                        <h2 id="courses-heading" className="text-2xl font-bold text-white uppercase tracking-tighter italic">Meus Cursos</h2>
                        <Button onClick={() => setIsNewCourseModalOpen(true)}>
                            <PlusIcon className="h-5 w-5 mr-2" aria-hidden="true"/>
                            Novo Curso
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {courses.map(course => (
                            <Card key={course.id} onClick={() => handleCourseSelect(course)} className="group hover:border-cyan-500/50 transition-all duration-500 flex flex-col !p-0 overflow-hidden bg-gray-900 shadow-2xl rounded-[2.2rem]">
                                {course.imageUrl ? (
                                    <div className="relative h-32 overflow-hidden">
                                        <img src={course.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                    </div>
                                ) : (
                                    <div className="w-full h-32 bg-gray-800 flex items-center justify-center">
                                        <BookOpenIcon className="h-12 w-12 text-gray-700" aria-hidden="true" />
                                    </div>
                                )}
                                <div className="p-6 flex flex-col flex-grow">
                                    <h3 className="text-xl font-black text-white group-hover:text-cyan-400 transition-colors flex-grow uppercase tracking-tight italic">{course.name}</h3>
                                    <div className="mt-4 flex justify-between text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                        <span>{course.disciplines.length} Disciplinas</span>
                                        <span>{course.enrolledStudentIds.length} Alunos</span>
                                    </div>
                                </div>
                            </Card>
                        ))}
                         {courses.length === 0 && !isLoading && <p className="text-gray-500 md:col-span-2 text-center p-12 border-2 border-dashed border-gray-800 rounded-[2.5rem] uppercase font-black text-xs tracking-widest">Nenhum curso operacional.</p>}
                    </div>
                </section>
                <div className="lg:col-span-1 space-y-6">
                    <section aria-labelledby="subjects-heading">
                        <Card className="p-6 rounded-[2.2rem]">
                            <div className="flex justify-between items-center mb-6">
                                <h3 id="subjects-heading" className="text-xl font-black text-white uppercase tracking-tighter italic">Disciplinas</h3>
                                <Button onClick={() => setIsNewSubjectModalOpen(true)} className="py-1 px-3 text-sm" aria-label="Adicionar nova disciplina">
                                    <PlusIcon className="h-4 w-4" />
                                </Button>
                            </div>
                            <ul className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                {subjects.map(subject => (
                                    <li key={subject.id}>
                                        <button onClick={() => {
                                          setSelectedSubject(subject);
                                          setView('edit_subject');
                                        }} className="w-full text-left p-3 bg-gray-800/50 rounded-xl hover:bg-gray-700 transition-all border border-transparent hover:border-gray-600">
                                            <p className="font-bold text-gray-200 text-sm">{subject.name}</p>
                                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{subject.topics.length} tópicos registrados</p>
                                        </button>
                                    </li>
                                ))}
                                 {subjects.length === 0 && !isLoading && <p className="text-gray-600 text-center py-4 font-bold text-xs uppercase">Vazio</p>}
                            </ul>
                        </Card>
                    </section>
                    <section aria-label="Mural de avisos do professor">
                        <ProfessorAnnouncements teacher={user} allStudents={students} />
                    </section>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-900 text-white min-h-screen">
            <StudentHeader 
                user={user} 
                view={view} 
                isProfessorView={true}
                onSetView={(v) => {
                    setSelectedCourse(null);
                    setSelectedSubject(null);
                    setView(v);
                }} 
                onLogout={onLogout} 
                onGoHome={() => {
                    setSelectedCourse(null);
                    setSelectedSubject(null);
                    setView('courses');
                }} 
            />
            
            <main className="p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto">
                {toastMessage && <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />}
                
                {view !== 'courses' && view !== 'subjects' && (
                    <button onClick={view.startsWith('edit_') ? () => setView(view.endsWith('course') ? 'courses' : 'subjects') : handleBackToDashboard} className="text-cyan-400 hover:text-cyan-300 mb-6 flex items-center bg-gray-800/50 px-4 py-2 rounded-xl border border-white/5 transition-all">
                        <ArrowRightIcon className="h-4 w-4 mr-2 transform rotate-180" aria-hidden="true" /> Voltar ao Painel
                    </button>
                )}

                {renderContent()}
            </main>

            <Modal isOpen={isNewCourseModalOpen} onClose={handleCloseNewCourseModal} title="Novo Curso Operacional">
                <form onSubmit={handleSaveNewCourse} className="space-y-4">
                    <div>
                        <label htmlFor="new-course-name" className="block text-sm font-medium text-gray-400 uppercase tracking-widest font-black text-[10px] mb-1">Título da Missão</label>
                        <input id="new-course-name" type="text" value={newCourseName} onChange={e => setNewCourseName(e.target.value)} required className="mt-1 block w-full bg-gray-800 border border-gray-700 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-cyan-500" />
                    </div>
                    <div>
                         <label htmlFor="new-course-image-url" className="block text-sm font-medium text-gray-400 uppercase tracking-widest font-black text-[10px] mb-1">Link da Identidade Visual</label>
                         <input
                            id="new-course-image-url"
                            type="url"
                            value={newCourseImageUrl}
                            onChange={e => setNewCourseImageUrl(e.target.value)}
                            placeholder="https://..."
                            className="mt-1 block w-full bg-gray-800 border border-gray-700 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-cyan-500"
                         />
                    </div>
                    <div className="pt-4 flex justify-end">
                        <Button type="submit">Ativar Curso</Button>
                    </div>
                </form>
            </Modal>
             <Modal isOpen={isNewSubjectModalOpen} onClose={handleCloseNewSubjectModal} title="Nova Célula Disciplinar">
                <form onSubmit={handleSaveNewSubject} className="space-y-4">
                    <div>
                        <label htmlFor="new-subject-name" className="block text-sm font-medium text-gray-400 uppercase tracking-widest font-black text-[10px] mb-1">Nome da Célula</label>
                        <input id="new-subject-name" type="text" value={newSubjectName} onChange={e => setNewSubjectName(e.target.value)} required className="mt-1 block w-full bg-gray-800 border border-gray-700 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-cyan-500" />
                    </div>
                    <div className="pt-4 flex justify-end">
                        <Button type="submit">Salvar Disciplina</Button>
                    </div>
                </form>
            </Modal>
            <EditProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} user={user} onSave={handleProfileSave} />
        </div>
    );
};


import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as FirebaseService from '../services/firebaseService';
import { User, Subject, Course } from '../types';
import { Spinner, Button, Card, Modal, Toast, ConfirmModal } from './ui';
import { BookOpenIcon, PlusIcon, ArrowRightIcon, LogoutIcon, UserCircleIcon, PencilIcon, ChevronDownIcon, ChartBarIcon } from './Icons';

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
    const [isNavOpen, setIsNavOpen] = useState(false);
    const navRef = useRef<HTMLDivElement>(null);

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
    
     useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (navRef.current && !navRef.current.contains(event.target as Node)) {
                setIsNavOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

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
                        <h2 id="courses-heading" className="text-2xl font-bold text-white">Meus Cursos</h2>
                        <Button onClick={() => setIsNewCourseModalOpen(true)}>
                            <PlusIcon className="h-5 w-5 mr-2" aria-hidden="true"/>
                            Novo Curso
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {courses.map(course => (
                            <Card key={course.id} onClick={() => handleCourseSelect(course)} className="hover:border-cyan-500/50 transition-all duration-300 flex flex-col !p-0 overflow-hidden">
                                {course.imageUrl ? (
                                    <img src={course.imageUrl} alt="" className="w-full h-32 object-cover" />
                                ) : (
                                    <div className="w-full h-32 bg-gray-700 flex items-center justify-center">
                                        <BookOpenIcon className="h-12 w-12 text-gray-500" aria-hidden="true" />
                                    </div>
                                )}
                                <div className="p-4 flex flex-col flex-grow">
                                    <h3 className="text-xl font-bold text-cyan-400 flex-grow">{course.name}</h3>
                                    <div className="mt-4 flex justify-around text-sm text-gray-400">
                                        <span>{course.disciplines.length} disciplina(s)</span>
                                        <span>{course.enrolledStudentIds.length} aluno(s)</span>
                                    </div>
                                    <div className="mt-6 text-right text-cyan-400 text-sm font-semibold">
                                        Gerenciar <span aria-hidden="true">&rarr;</span>
                                    </div>
                                </div>
                            </Card>
                        ))}
                         {courses.length === 0 && !isLoading && <p className="text-gray-400 md:col-span-2 text-center p-6">Nenhum curso criado. Clique em "Novo Curso" para começar.</p>}
                    </div>
                </section>
                <div className="lg:col-span-1 space-y-6">
                    <section aria-labelledby="subjects-heading">
                        <Card className="p-6">
                            <div className="flex justify-between items-center">
                                <h3 id="subjects-heading" className="text-xl font-bold text-white mb-4">Minhas Disciplinas</h3>
                                <Button onClick={() => setIsNewSubjectModalOpen(true)} className="py-1 px-3 text-sm" aria-label="Adicionar nova disciplina">
                                    <PlusIcon className="h-4 w-4" />
                                </Button>
                            </div>
                            <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                {subjects.map(subject => (
                                    <li key={subject.id}>
                                        <button onClick={() => {
                                          setSelectedSubject(subject);
                                          setView('edit_subject');
                                        }} className="w-full text-left p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700">
                                            <p className="font-semibold text-gray-200">{subject.name}</p>
                                            <p className="text-xs text-gray-400">{subject.topics.length} tópico(s)</p>
                                        </button>
                                    </li>
                                ))}
                                 {subjects.length === 0 && !isLoading && <p className="text-gray-500 text-center">Nenhuma disciplina criada.</p>}
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

    const navigationItems = [
        { label: 'Cursos', view: 'courses' as const },
        { label: 'Disciplinas', view: 'subjects' as const },
        { label: 'Revisões', view: 'reviews' as const },
        { label: 'Planejamento', view: 'scheduler' as const },
        { label: 'Desempenho', view: 'performance' as const },
        { label: 'Diagnóstico', view: 'diagnostics' as const },
    ];

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {toastMessage && <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-4">
                    <img src="https://i.ibb.co/FbmLfsBw/Google-AI-Studio-2025-08-10-T15-45-10.png" alt="Logo" className="h-14 w-auto rounded-lg shadow-xl" />
                    <div className="flex flex-col">
                        <h1 className="text-2xl font-black text-white uppercase tracking-tighter italic leading-none">QG DO <span className="text-cyan-400">CONCURSEIRO</span></h1>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mt-1">Base de Comando do Professor</p>
                    </div>
                </div>
                 <div className="flex items-center space-x-4">
                    <div ref={navRef} className="relative">
                        <button onClick={() => setIsNavOpen(prev => !prev)} className="flex items-center space-x-2 px-4 py-2 text-sm font-black uppercase tracking-widest rounded-lg bg-gray-800 border border-white/5 hover:bg-gray-700 transition-all">
                            <span>Sistemas</span>
                            <ChevronDownIcon className={`h-4 w-4 transition-transform ${isNavOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isNavOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                                {navigationItems.map(item => (
                                    <button
                                        key={item.view}
                                        onClick={() => {
                                            setSelectedCourse(null);
                                            setSelectedSubject(null);
                                            setView(item.view);
                                            setIsNavOpen(false);
                                        }}
                                        className={`w-full text-left px-5 py-3 text-xs font-black uppercase tracking-widest transition-all ${view === item.view ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:bg-white/5'}`}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                     <div className="w-px h-8 bg-gray-800" aria-hidden="true"></div>
                     <button onClick={() => setIsProfileModalOpen(true)} className="flex items-center space-x-3 p-1 rounded-full hover:bg-gray-800 transition-all">
                         {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover border-2 border-cyan-500/20" />
                        ) : (
                            <UserCircleIcon className="h-10 w-10 text-gray-500" aria-hidden="true" />
                        )}
                        <div className="hidden sm:flex flex-col text-left">
                            <span className="text-xs font-black text-white uppercase tracking-tight">{user.name || user.username}</span>
                            <span className="text-[8px] font-bold text-cyan-500 uppercase tracking-widest">Base de Comando</span>
                        </div>
                        <PencilIcon className="h-4 w-4 text-gray-600" aria-hidden="true" />
                    </button>
                    <button onClick={onLogout} className="flex items-center text-xs font-black uppercase tracking-widest text-rose-500 hover:text-rose-400 p-2">
                        <LogoutIcon className="h-5 w-5 md:mr-1" aria-hidden="true" />
                        <span className="hidden md:inline">Desconectar</span>
                    </button>
                </div>
            </header>
            
            <main>
                {view !== 'courses' && view !== 'subjects' && (
                    <button onClick={view.startsWith('edit_') ? () => setView(view.endsWith('course') ? 'courses' : 'subjects') : handleBackToDashboard} className="text-cyan-400 hover:text-cyan-300 mb-6 flex items-center bg-gray-800/50 px-4 py-2 rounded-xl border border-white/5 transition-all font-black text-[10px] uppercase tracking-widest">
                        <ArrowRightIcon className="h-4 w-4 mr-2 transform rotate-180" aria-hidden="true" /> Voltar para Base
                    </button>
                )}

                {renderContent()}
            </main>

            <Modal isOpen={isNewCourseModalOpen} onClose={handleCloseNewCourseModal} title="Instanciar Novo Curso">
                <form onSubmit={handleSaveNewCourse} className="space-y-4">
                    <div>
                        <label htmlFor="new-course-name" className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Nome da Operação</label>
                        <input id="new-course-name" type="text" value={newCourseName} onChange={e => setNewCourseName(e.target.value)} required className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-cyan-500 focus:border-cyan-500" />
                    </div>
                    <div>
                         <label htmlFor="new-course-image-url" className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Capa da Operação (URL)</label>
                         <input
                            id="new-course-image-url"
                            type="url"
                            value={newCourseImageUrl}
                            onChange={e => setNewCourseImageUrl(e.target.value)}
                            placeholder="https://exemplo.com/imagem.png"
                            className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-cyan-500 focus:border-cyan-500"
                         />
                         {newCourseImageUrl && <img src={newCourseImageUrl} alt="Pré-visualização" className="mt-4 h-32 w-full rounded-xl object-cover border border-white/10" />}
                    </div>
                    <div className="pt-4 flex justify-end">
                        <Button type="submit">
                            Iniciar Operação
                        </Button>
                    </div>
                </form>
            </Modal>
             <Modal isOpen={isNewSubjectModalOpen} onClose={handleCloseNewSubjectModal} title="Codificar Nova Disciplina">
                <form onSubmit={handleSaveNewSubject} className="space-y-4">
                    <div>
                        <label htmlFor="new-subject-name" className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Título da Disciplina</label>
                        <input id="new-subject-name" type="text" value={newSubjectName} onChange={e => setNewSubjectName(e.target.value)} required className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-cyan-500 focus:border-cyan-500" />
                    </div>
                    <div className="pt-4 flex justify-end">
                        <Button type="submit">
                           Salvar Dados
                        </Button>
                    </div>
                </form>
            </Modal>
            <EditProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} user={user} onSave={handleProfileSave} />
        </div>
    );
};

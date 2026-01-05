
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
import { StudentHeader } from './student/StudentHeader';

export const ProfessorDashboard: React.FC<{ user: User; onLogout: () => void; onUpdateUser: (user: User) => void; }> = ({ user, onLogout, onUpdateUser }) => {
    const [courses, setCourses] = useState<Course[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [students, setStudents] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [view, setView] = useState<'courses' | 'subjects' | 'reviews' | 'scheduler' | 'performance' | 'diagnostics' | 'edit_course' | 'edit_subject'>('courses');
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
    
    const handleProfileSave = (updatedUser: User) => {
        onUpdateUser(updatedUser);
    };

    const renderContent = () => {
        if(isLoading) {
             return <div className="flex justify-center items-center h-64"><Spinner /></div>;
        }

        if (view === 'edit_course' && selectedCourse) {
            const courseForEditor = courses.find(c => c.id === selectedCourse.id);
            if (courseForEditor) {
                return <ProfessorCourseEditor
                    course={courseForEditor}
                    allSubjects={subjects}
                    allStudents={students}
                    onBack={handleBackToDashboard}
                    setToastMessage={setToastMessage}
                />;
            }
        }

        if (view === 'edit_subject' && selectedSubject) {
            const subjectForEditor = subjects.find(s => s.id === selectedSubject.id);
            if (subjectForEditor) {
                return <ProfessorSubjectEditor 
                    subject={subjectForEditor} 
                    onBack={() => setView('subjects')}
                    setToastMessage={setToastMessage}
                />;
            }
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
                <section className="lg:col-span-2 space-y-8" aria-labelledby="courses-heading">
                    <div className="flex justify-between items-center px-2">
                        <h2 id="courses-heading" className="text-3xl font-black text-white uppercase italic tracking-tighter">Meus Cursos</h2>
                        <Button onClick={() => setIsNewCourseModalOpen(true)} className="rounded-xl px-6">
                            <PlusIcon className="h-5 w-5 mr-2" aria-hidden="true"/>
                            Novo Curso
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {courses.map(course => (
                            <Card key={course.id} onClick={() => handleCourseSelect(course)} className="group hover:border-cyan-500/50 transition-all duration-500 flex flex-col !p-0 overflow-hidden bg-gray-900/60 shadow-2xl rounded-[2.2rem] hover:translate-y-[-4px]">
                                {course.imageUrl ? (
                                    <div className="relative h-48 overflow-hidden">
                                        <img src={course.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-60"></div>
                                    </div>
                                ) : (
                                    <div className="w-full h-48 bg-gray-800 flex items-center justify-center">
                                        <BookOpenIcon className="h-12 w-12 text-gray-700" aria-hidden="true" />
                                    </div>
                                )}
                                <div className="p-8 flex flex-col flex-grow">
                                    <h3 className="text-2xl font-black text-white group-hover:text-cyan-400 transition-colors flex-grow uppercase tracking-tight italic leading-tight">{course.name}</h3>
                                    <div className="mt-8 flex justify-around text-[10px] font-black text-gray-500 uppercase tracking-widest border-t border-gray-800/50 pt-6">
                                        <span>{course.disciplines.length} Disciplina(s)</span>
                                        <div className="w-px h-3 bg-gray-800"></div>
                                        <span>{course.enrolledStudentIds.length} Aluno(s)</span>
                                    </div>
                                    <div className="mt-6 text-right text-cyan-400 text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-end gap-2 group-hover:translate-x-1 transition-all">
                                        GERENCIAR <ArrowRightIcon className="h-3 w-3" aria-hidden="true" />
                                    </div>
                                </div>
                            </Card>
                        ))}
                         {courses.length === 0 && !isLoading && <p className="text-gray-500 md:col-span-2 text-center p-12 border-2 border-dashed border-gray-800 rounded-[2rem] font-bold uppercase text-xs tracking-widest">Nenhum curso criado. Inicie agora mesmo.</p>}
                    </div>
                </section>
                <div className="lg:col-span-1 space-y-8">
                    <section aria-label="Mural de avisos do professor">
                        <ProfessorAnnouncements teacher={user} allStudents={students} />
                    </section>
                    <section aria-labelledby="subjects-quick-heading">
                        <Card className="p-8 rounded-[2rem]">
                            <div className="flex justify-between items-center mb-6">
                                <h3 id="subjects-quick-heading" className="text-xl font-black text-white uppercase italic tracking-tighter">Disciplinas</h3>
                                <Button onClick={() => setIsNewSubjectModalOpen(true)} className="p-2.5 rounded-xl text-sm" aria-label="Adicionar nova disciplina">
                                    <PlusIcon className="h-5 w-5" />
                                </Button>
                            </div>
                            <ul className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {subjects.map(subject => (
                                    <li key={subject.id}>
                                        <button onClick={() => {
                                          setSelectedSubject(subject);
                                          setView('edit_subject');
                                        }} className="w-full text-left p-4 bg-gray-700/30 rounded-2xl hover:bg-gray-700 transition-all border border-transparent hover:border-cyan-500/20 group">
                                            <p className="font-black text-white uppercase tracking-tight text-sm group-hover:text-cyan-400 transition-colors">{subject.name}</p>
                                            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-1">{subject.topics.length} tópico(s) cadastrados</p>
                                        </button>
                                    </li>
                                ))}
                                 {subjects.length === 0 && !isLoading && <p className="text-gray-600 text-center text-[10px] font-black uppercase py-4">Vazio</p>}
                            </ul>
                        </Card>
                    </section>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#020617] text-white">
            {toastMessage && <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />}
            
            <StudentHeader 
                user={user} 
                view={view} 
                isProfessorView={true}
                onSetView={setView} 
                onLogout={onLogout} 
                onGoHome={() => setView('courses')} 
            />

            <main className="p-8 max-w-[1920px] mx-auto pb-20">
                {view !== 'courses' && view !== 'subjects' && (
                    <button 
                        onClick={view.startsWith('edit_') ? () => setView(view.endsWith('course') ? 'courses' : 'subjects') : handleBackToDashboard} 
                        className="text-cyan-400 hover:text-cyan-300 mb-8 flex items-center bg-gray-800/40 px-5 py-2.5 rounded-xl border border-white/5 transition-all shadow-lg"
                    >
                        <ArrowRightIcon className="h-4 w-4 mr-2 transform rotate-180" aria-hidden="true" /> Voltar
                    </button>
                )}

                {renderContent()}
            </main>

            <Modal isOpen={isNewCourseModalOpen} onClose={() => setIsNewCourseModalOpen(false)} title="Criar Novo Curso">
                <form onSubmit={handleSaveNewCourse} className="space-y-4">
                    <div>
                        <label htmlFor="new-course-name" className="block text-sm font-medium text-gray-300">Nome do Curso</label>
                        <input id="new-course-name" type="text" value={newCourseName} onChange={e => setNewCourseName(e.target.value)} required className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-cyan-500 focus:border-cyan-500" />
                    </div>
                    <div>
                         <label htmlFor="new-course-image-url" className="block text-sm font-medium text-gray-300">URL da Imagem de Capa (Opcional)</label>
                         <input
                            id="new-course-image-url"
                            type="url"
                            value={newCourseImageUrl}
                            onChange={e => setNewCourseImageUrl(e.target.value)}
                            placeholder="https://exemplo.com/imagem.png"
                            className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-cyan-500 focus:border-cyan-500"
                         />
                         {newCourseImageUrl && <img src={newCourseImageUrl} alt="Pré-visualização da capa" className="mt-2 h-24 w-auto rounded-md object-cover border border-gray-600" />}
                    </div>
                    <div className="pt-4 flex justify-end">
                        <Button type="submit">
                            Criar Curso
                        </Button>
                    </div>
                </form>
            </Modal>
             <Modal isOpen={isNewSubjectModalOpen} onClose={() => setIsNewSubjectModalOpen(false)} title="Criar Nova Disciplina">
                <form onSubmit={handleSaveNewSubject} className="space-y-4">
                    <div>
                        <label htmlFor="new-subject-name" className="block text-sm font-medium text-gray-300">Nome da Disciplina</label>
                        <input id="new-subject-name" type="text" value={newSubjectName} onChange={e => setNewSubjectName(e.target.value)} required className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-cyan-500 focus:border-cyan-500" />
                    </div>
                    <div className="pt-4 flex justify-end">
                        <Button type="submit">
                           Salvar
                        </Button>
                    </div>
                </form>
            </Modal>
            <EditProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} user={user} onSave={handleProfileSave} />
        </div>
    );
};

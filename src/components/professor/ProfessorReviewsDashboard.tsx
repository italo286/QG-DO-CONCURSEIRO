import React, { useState, useMemo, useEffect } from 'react';
import * as FirebaseService from '../../services/firebaseService';
import { User, Subject, ReviewSession, StudentProgress, Question } from '../../types';
import { Card, Button, Spinner } from '../ui';
import { UserCircleIcon, ChevronDownIcon, RefreshIcon, GeminiIcon } from '../Icons';
import { AiSimuladoGeneratorModal } from './AiSimuladoGeneratorModal';

export const ProfessorReviewsDashboard: React.FC<{
    students: User[];
    subjects: Subject[];
    setToastMessage: (msg: string) => void;
}> = ({ students, subjects, setToastMessage }) => {
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
    const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
    const [reviewName, setReviewName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    
    const [allProgress, setAllProgress] = useState<{ [studentId: string]: StudentProgress }>({});
    const [isLoadingProgress, setIsLoadingProgress] = useState(true);
    const [selectedStudentForReset, setSelectedStudentForReset] = useState<string>('');
    const [isResetting, setIsResetting] = useState(false);
    const [isAiSimuladoModalOpen, setIsAiSimuladoModalOpen] = useState(false);

    useEffect(() => {
        setIsLoadingProgress(true);
        const studentIds = students.map(s => s.id);
        const unsubscribe = FirebaseService.listenToStudentProgressForTeacher(studentIds, (progressData) => {
            setAllProgress(progressData);
            setIsLoadingProgress(false);
        });
        return () => unsubscribe();
    }, [students]);

    const incorrectQuestionsByTopic = useMemo(() => {
        const questionErrorCount: { [id: string]: { count: number, studentIds: Set<string> } } = {};
        
        Object.values(allProgress).forEach((progress: StudentProgress) => {
            const allAttempts = [
                ...Object.values(progress.progressByTopic).flatMap(s => Object.values(s).flatMap(t => t.lastAttempt)),
                ...(progress.reviewSessions || []).flatMap(r => r.attempts || [])
            ];
            allAttempts.forEach(attempt => {
                if (!attempt.isCorrect) {
                    if (!questionErrorCount[attempt.questionId]) {
                        questionErrorCount[attempt.questionId] = { count: 0, studentIds: new Set() };
                    }
                    questionErrorCount[attempt.questionId].count++;
                    questionErrorCount[attempt.questionId].studentIds.add(progress.studentId);
                }
            });
        });
        
        const grouped: { [subjectName: string]: { [topicName: string]: { question: Question, errorCount: number, studentCount: number }[] } } = {};
        
        Object.entries(questionErrorCount).forEach(([questionId, errorData]) => {
            for (const subject of subjects) {
                let found = false;
                for (const topic of subject.topics) {
                    const q = topic.questions.find(q => q.id === questionId) || topic.tecQuestions?.find(q => q.id === questionId);
                    if (q) {
                        if (!grouped[subject.name]) grouped[subject.name] = {};
                        if (!grouped[subject.name][topic.name]) grouped[subject.name][topic.name] = [];
                        grouped[subject.name][topic.name].push({ question: q, errorCount: errorData.count, studentCount: errorData.studentIds.size });
                        found = true;
                        break;
                    }
                    for (const subtopic of topic.subtopics) {
                        const sq = subtopic.questions.find(q => q.id === questionId) || subtopic.tecQuestions?.find(q => q.id === questionId);
                        if(sq) {
                            const combinedTopicName = `${topic.name} / ${subtopic.name}`;
                            if (!grouped[subject.name]) grouped[subject.name] = {};
                            if (!grouped[subject.name][combinedTopicName]) grouped[subject.name][combinedTopicName] = [];
                            grouped[subject.name][combinedTopicName].push({ question: sq, errorCount: errorData.count, studentCount: errorData.studentIds.size });
                            found = true;
                            break;
                        }
                    }
                    if(found) break;
                }
                if(found) break;
            }
        });

        for (const subjectName in grouped) {
            for (const topicName in grouped[subjectName]) {
                grouped[subjectName][topicName].sort((a,b) => b.errorCount - a.errorCount);
            }
        }

        return grouped;
    }, [allProgress, subjects]);

    const allIncorrectQuestionIds = useMemo(() => {
        return Object.values(incorrectQuestionsByTopic).flatMap(topics => 
            Object.values(topics).flatMap(questions => 
                questions.map(q => q.question.id)
            )
        );
    }, [incorrectQuestionsByTopic]);

    const toggleAllStudents = () => {
        if (selectedStudentIds.length === students.length) {
            setSelectedStudentIds([]);
        } else {
            setSelectedStudentIds(students.map(s => s.id));
        }
    };

    const toggleAllQuestions = () => {
        if (selectedQuestionIds.length === allIncorrectQuestionIds.length) {
            setSelectedQuestionIds([]);
        } else {
            setSelectedQuestionIds(allIncorrectQuestionIds);
        }
    };


    const allQuestions = useMemo(() => subjects.flatMap(s => s.topics.flatMap(t => [...t.questions, ...(t.tecQuestions || []), ...t.subtopics.flatMap(st => [...st.questions, ...(st.tecQuestions || [])])])), [subjects]);

    const handleCreateReview = async () => {
        if (selectedStudentIds.length === 0 || selectedQuestionIds.length === 0 || !reviewName.trim()) {
            alert("Por favor, dê um nome para a revisão, selecione pelo menos um aluno e uma questão.");
            return;
        }
        setIsSaving(true);

        const questionsForSession = allQuestions.filter(q => selectedQuestionIds.includes(q.id));
        const session: Omit<ReviewSession, 'id' | 'createdAt'> = {
            name: reviewName,
            type: 'manual',
            questions: questionsForSession,
            isCompleted: false
        };

        await FirebaseService.addReviewSessionToStudents(selectedStudentIds, session);
        
        setIsSaving(false);
        setReviewName('');
        setSelectedStudentIds([]);
        setSelectedQuestionIds([]);
        setToastMessage("Sessão de revisão enviada com sucesso!");
    };

    const toggleStudent = (id: string) => setSelectedStudentIds(prev => prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]);
    const toggleQuestion = (id: string) => setSelectedQuestionIds(prev => prev.includes(id) ? prev.filter(qid => qid !== id) : [...prev, id]);

    const handleResetChallenges = async () => {
        if (!selectedStudentForReset) {
            setToastMessage("Por favor, selecione um aluno.");
            return;
        }
    
        const studentName = students.find(s => s.id === selectedStudentForReset)?.name || 'o aluno';
        if (window.confirm(`Tem certeza que deseja resetar os desafios diários de hoje para ${studentName}? Isso permitirá que ele(a) gere os desafios novamente.`)) {
            setIsResetting(true);
            try {
                await FirebaseService.resetDailyChallengesForStudent(selectedStudentForReset);
                setToastMessage(`Desafios para ${studentName} resetados com sucesso!`);
            } catch (error) {
                console.error("Failed to reset daily challenges:", error);
                setToastMessage("Ocorreu um erro ao resetar os desafios.");
            } finally {
                setIsResetting(false);
            }
        }
    };

    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <Card className="p-6">
                        <h3 className="font-bold text-lg text-cyan-400">Pontos de Dificuldade da Turma</h3>
                        <p className="text-sm text-gray-400 mb-4">Questões com mais erros. Selecione-as para criar uma revisão.</p>
                        
                        <div className="px-2 pb-2 mb-2 border-b border-gray-700">
                            <label className="flex items-center space-x-3 text-sm font-semibold cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={allIncorrectQuestionIds.length > 0 && selectedQuestionIds.length === allIncorrectQuestionIds.length}
                                    onChange={toggleAllQuestions}
                                    disabled={allIncorrectQuestionIds.length === 0}
                                    className="h-5 w-5 rounded text-cyan-500 bg-gray-700 border-gray-600 focus:ring-cyan-600"
                                    aria-label="Marcar ou desmarcar todas as questões"
                                />
                                <span>Marcar/Desmarcar Todas as Questões ({selectedQuestionIds.length}/{allIncorrectQuestionIds.length})</span>
                            </label>
                        </div>

                        <div className="h-[65vh] overflow-y-auto space-y-2 p-2 bg-gray-900/50 rounded-lg">
                            {isLoadingProgress && <div className="flex justify-center p-4"><Spinner /></div>}
                            {!isLoadingProgress && Object.keys(incorrectQuestionsByTopic).length === 0 && <p className="text-center text-gray-500 p-4">Nenhum erro registrado pela turma ainda.</p>}
                            {Object.entries(incorrectQuestionsByTopic).map(([subjectName, topics]) => (
                                <details key={subjectName} className="bg-gray-800 rounded-lg" open>
                                    <summary className="p-3 font-semibold cursor-pointer flex justify-between items-center list-none">{subjectName} <ChevronDownIcon className="h-5 w-5 transition-transform details-open:rotate-180" /></summary>
                                    <div className="border-t border-gray-700 p-2 space-y-2">
                                        {Object.entries(topics).map(([topicName, questions]) => (
                                            <details key={topicName} className="bg-gray-700/50 rounded" open>
                                                <summary className="p-2 text-sm font-semibold cursor-pointer list-none flex justify-between items-center">{topicName} <ChevronDownIcon className="h-4 w-4 transition-transform details-open:rotate-180" /></summary>
                                                <div className="border-t border-gray-600 p-2 space-y-2">
                                                    {questions.map(({ question, errorCount, studentCount }) => (
                                                        <label key={question.id} className="block p-2 hover:bg-gray-700 cursor-pointer rounded-md">
                                                            <div className="flex items-start space-x-3">
                                                                <input type="checkbox" checked={selectedQuestionIds.includes(question.id)} onChange={() => toggleQuestion(question.id)} className="mt-1 h-4 w-4 rounded text-cyan-500 bg-gray-700 border-gray-600 focus:ring-cyan-600"/>
                                                                <div className="text-sm flex-grow">
                                                                    <p className="text-gray-300">{question.statement}</p>
                                                                    <p className="text-xs text-red-400 mt-1">{errorCount} erro(s) de {studentCount} aluno(s)</p>
                                                                </div>
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>
                                            </details>
                                        ))}
                                    </div>
                                </details>
                            ))}
                        </div>
                    </Card>
                </div>
                <div className="lg:col-span-1 space-y-8 self-start sticky top-8">
                    <Card className="p-6">
                        {isSaving && <div className="absolute inset-0 bg-gray-900/50 flex justify-center items-center z-10 rounded-xl"><Spinner /></div>}
                        <h3 className="font-bold text-lg text-cyan-400 mb-4">Criar Nova Revisão</h3>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="review-name" className="block text-sm font-medium text-gray-300">1. Nome da Revisão</label>
                                <input 
                                    id="review-name"
                                    type="text" 
                                    value={reviewName} 
                                    onChange={e => setReviewName(e.target.value)} 
                                    placeholder="Ex: Reforço de Atos Administrativos"
                                    className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <h4 className="text-sm font-medium text-gray-300">2. Selecione os Alunos</h4>
                                    <label className="flex items-center space-x-2 text-xs cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={students.length > 0 && selectedStudentIds.length === students.length}
                                            onChange={toggleAllStudents}
                                            disabled={students.length === 0}
                                            className="h-4 w-4 rounded text-cyan-500 bg-gray-700 border-gray-600 focus:ring-cyan-600"
                                            aria-label="Marcar ou desmarcar todos os alunos"
                                        />
                                        <span>Todos</span>
                                    </label>
                                </div>
                                <div className="h-48 overflow-y-auto space-y-2 p-2 bg-gray-900/50 rounded-lg">
                                    {students.map(student => (
                                        <label key={student.id} className="flex items-center space-x-3 p-2 hover:bg-gray-700 cursor-pointer rounded-md">
                                            <input type="checkbox" checked={selectedStudentIds.includes(student.id)} onChange={() => toggleStudent(student.id)} className="h-4 w-4 rounded text-cyan-500 bg-gray-700 border-gray-600 focus:ring-cyan-600"/>
                                            <div className="flex items-center gap-2">
                                                {student.avatarUrl ? <img src={student.avatarUrl} alt="" className="h-6 w-6 rounded-full"/> : <UserCircleIcon className="h-6 w-6 text-gray-500"/>}
                                                <span className="text-sm">{student.name || student.username}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="border-t border-gray-700 pt-4">
                                <p className="text-sm text-gray-300">
                                    <span className="font-bold">{selectedQuestionIds.length}</span> questão(ões) selecionada(s) para <span className="font-bold">{selectedStudentIds.length}</span> aluno(s).
                                </p>
                                <Button onClick={handleCreateReview} disabled={isSaving || selectedStudentIds.length === 0 || selectedQuestionIds.length === 0 || !reviewName.trim()} className="w-full mt-4">
                                    Enviar Revisão
                                </Button>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6">
                        <h3 className="font-bold text-lg text-cyan-400 mb-4 flex items-center gap-2"><GeminiIcon className="h-5 w-5" /> Ferramentas de IA</h3>
                        <Button onClick={() => setIsAiSimuladoModalOpen(true)} className="w-full">
                            Gerar Simulado de PDF com IA
                        </Button>
                    </Card>

                    <Card className="p-6">
                        <h3 className="font-bold text-lg text-yellow-400 mb-4 flex items-center gap-2">
                            <RefreshIcon className="h-5 w-5" /> Ferramenta de Teste
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="student-reset-select" className="block text-sm font-medium text-gray-300">Resetar Desafios Diários</label>
                                <p className="text-xs text-gray-400 mb-2">Selecione um aluno para limpar os desafios gerados hoje, permitindo um novo teste.</p>
                                <select
                                    id="student-reset-select"
                                    value={selectedStudentForReset}
                                    onChange={e => setSelectedStudentForReset(e.target.value)}
                                    className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white"
                                >
                                    <option value="" disabled>Selecione um aluno...</option>
                                    {students.map(student => (
                                        <option key={student.id} value={student.id}>
                                            {student.name || student.username}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <Button
                                onClick={handleResetChallenges}
                                disabled={isResetting || !selectedStudentForReset}
                                className="w-full bg-yellow-600 hover:bg-yellow-700"
                            >
                                {isResetting ? <Spinner /> : 'Resetar Desafios de Hoje'}
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
            <AiSimuladoGeneratorModal
                isOpen={isAiSimuladoModalOpen}
                onClose={() => setIsAiSimuladoModalOpen(false)}
                allStudents={students}
                setToastMessage={setToastMessage}
            />
        </>
    );
};
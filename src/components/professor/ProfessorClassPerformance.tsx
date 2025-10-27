
import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import * as FirebaseService from '../../services/firebaseService';
import * as GeminiService from '../../services/geminiService';
import { User, Subject, StudentProgress, QuestionAttempt } from '../../types';
import { markdownToHtml } from '../../utils';
import { Card, Spinner, Button } from '../ui';
import { GeminiIcon, ArrowRightIcon, UserCircleIcon } from '../Icons';
import { StudentPerformanceDetails } from '../student/StudentPerformanceDetails';

export const ProfessorClassPerformance: React.FC<{ subjects: Subject[]; students: User[] }> = ({ subjects, students }) => {
    const [allProgress, setAllProgress] = useState<{ [studentId: string]: StudentProgress }>({});
    const [isLoading, setIsLoading] = useState(true);
    const [analysisResult, setAnalysisResult] = useState<string>('');
    const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<User | null>(null);

    useEffect(() => {
        setIsLoading(true);
        const studentIds = students.map(s => s.id);
        const unsubscribe = FirebaseService.listenToStudentProgressForTeacher(studentIds, (progressData) => {
            setAllProgress(progressData);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [students]);

    const handleAnalyze = async () => {
        setIsAnalysisLoading(true);
        setAnalysisResult('');
        const allQuestionsWithContext = subjects.flatMap(s =>
            s.topics.flatMap(t =>
                t.questions.map(q => ({ ...q, topicName: t.name, subjectName: s.name }))
                .concat(t.subtopics.flatMap(st => st.questions.map(q => ({...q, topicName: st.name, subjectName: s.name}))))
            )
        );

        // FIX: Added filters and checks to safely handle potentially incomplete progress data.
        const allAttempts: QuestionAttempt[] = Object.values(allProgress)
            .filter((p): p is StudentProgress => !!p?.progressByTopic)
            .flatMap(p => Object.values(p.progressByTopic))
            .flatMap(subjectProgress => subjectProgress ? Object.values(subjectProgress) : [])
            .flatMap(topicProgress => topicProgress?.lastAttempt ?? []);

        try {
            const result = await GeminiService.analyzeStudentDifficulties(allQuestionsWithContext, allAttempts);
            setAnalysisResult(markdownToHtml(result));
        } catch (e: any) {
            setAnalysisResult(`<p class="text-red-400">${e.message}</p>`);
        }
        setIsAnalysisLoading(false);
    };

    const classPerformanceData = useMemo(() => {
        if (students.length === 0 || subjects.length === 0 || Object.keys(allProgress).length === 0) return [];
        
        return students.map(student => {
            const progress: StudentProgress | undefined = allProgress[student.id];
            // FIX: Added a check for `progress.progressByTopic` to safely handle incomplete progress data and resolve the type error.
            if (!progress || !progress.progressByTopic) return { name: student.name || student.username, score: 0, studentId: student.id };

            let totalScore = 0;
            let topicsWithScore = 0;
            
            subjects.forEach(subject => {
                const subjectProgress = progress.progressByTopic[subject.id];
                if (subjectProgress) {
                     Object.values(subjectProgress).forEach((topicProgress: { score: number; completed: boolean; lastAttempt: QuestionAttempt[] }) => {
                        // A topic with a score of 0 should be included in the average calculation.
                        // The existence of topicProgress implies an attempt has been made.
                        totalScore += topicProgress.score;
                        topicsWithScore++;
                    });
                }
            });
            
            return {
                name: student.name || student.username,
                score: topicsWithScore > 0 ? (totalScore / topicsWithScore) * 100 : 0,
                studentId: student.id,
            };
        }).sort((a, b) => b.score - a.score);

    }, [allProgress, students, subjects]);

    if (isLoading) {
        return <div className="flex justify-center p-8"><Spinner /></div>;
    }

    const selectedStudentProgress = selectedStudent ? allProgress[selectedStudent.id] : null;

    if (selectedStudent && selectedStudentProgress) {
        return (
            <div>
                 <button onClick={() => setSelectedStudent(null)} className="text-cyan-400 hover:text-cyan-300 mb-6 flex items-center">
                    <ArrowRightIcon className="h-4 w-4 mr-2 transform rotate-180" aria-hidden="true" /> Voltar para a Turma
                </button>
                <h2 className="text-3xl font-bold">Desempenho de {selectedStudent.name}</h2>
                <p className="text-gray-400 mb-4">Análise detalhada do progresso individual do aluno.</p>
                <StudentPerformanceDetails studentProgress={selectedStudentProgress} subjects={subjects} />
            </div>
        );
    }
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
                <Card className="p-6">
                    <h3 className="text-xl font-bold mb-4">Média de Acertos por Aluno</h3>
                    <ResponsiveContainer width="100%" height={students.length * 40 + 50}>
                        <BarChart data={classPerformanceData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#4B5563"/>
                            <XAxis type="number" stroke="#9CA3AF" unit="%" domain={[0, 100]} />
                            <YAxis type="category" dataKey="name" stroke="#9CA3AF" width={100} tick={{ fontSize: 12 }} />
                            <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }} />
                            <Bar dataKey="score" name="Média de Acertos" fill="#22D3EE" barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>
            </div>
            <div className="lg:col-span-1 space-y-8">
                 <Card className="p-6">
                    <h3 className="text-lg font-bold text-gray-300 mb-4">Análise Detalhada</h3>
                     <ul className="space-y-3 max-h-80 overflow-y-auto pr-2 mb-4">
                        {students.map(student => (
                            <li key={student.id}>
                                <button onClick={() => setSelectedStudent(student)} className="w-full flex items-center space-x-3 p-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-left">
                                     {student.avatarUrl ? (
                                        <img src={student.avatarUrl} alt="" className="h-10 w-10 rounded-full"/>
                                    ) : (
                                        <UserCircleIcon className="h-10 w-10 text-gray-500"/>
                                    )}
                                    <div>
                                        <p className="font-semibold text-gray-200">{student.name || student.username}</p>
                                        <p className="text-xs text-gray-400">Ver detalhes</p>
                                    </div>
                                </button>
                            </li>
                        ))}
                     </ul>
                </Card>
                 <Card className="p-6">
                    <h3 className="text-lg font-bold text-gray-300 mb-4">Análise de Dificuldades com IA</h3>
                    <Button onClick={handleAnalyze} disabled={isAnalysisLoading} className="w-full">
                        {isAnalysisLoading ? <Spinner/> : <><GeminiIcon className="h-5 w-5 mr-2" /> Analisar Erros da Turma</>}
                    </Button>
                    {analysisResult && (
                        <div className="mt-4 border-t border-gray-700 pt-4 max-h-96 overflow-y-auto">
                           <div className="prose prose-sm text-gray-300 max-w-none prose-headings:text-cyan-400" dangerouslySetInnerHTML={{ __html: analysisResult }} />
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};

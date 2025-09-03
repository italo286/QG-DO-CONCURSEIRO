import { useState, useEffect } from 'react';
import * as FirebaseService from '../services/firebaseService';
import { User, Subject, StudentProgress, TeacherMessage, StudyPlan, Course } from '../types';
import { getLocalDateISOString } from '../utils';
import * as GeminiService from '../services/geminiService';

export const useStudentData = (user: User, isPreview?: boolean) => {
    const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
    const [allStudents, setAllStudents] = useState<User[]>([]);
    const [allStudentProgress, setAllStudentProgress] = useState<{ [studentId: string]: StudentProgress }>({});
    const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [studentProgress, setStudentProgress] = useState<StudentProgress | null>(null);
    const [studyPlan, setStudyPlan] = useState<StudyPlan['plan']>({});
    const [messages, setMessages] = useState<TeacherMessage[]>([]);
    const [teacherProfiles, setTeacherProfiles] = useState<User[]>([]);

    useEffect(() => {
        if (isPreview) {
            setIsLoading(false);
            return;
        }

        const unsubs: (() => void)[] = [];

        unsubs.push(FirebaseService.listenToEnrolledCourses(user.id, (courses) => {
            setEnrolledCourses(courses);
            const teacherIds = [...new Set(courses.map(c => c.teacherId))];

            if (teacherIds.length > 0) {
                FirebaseService.getUserProfilesByIds(teacherIds).then(setTeacherProfiles);
                FirebaseService.listenToStudents((all) => setAllStudents(all.filter(s => s.role === 'aluno')));
                unsubs.push(FirebaseService.listenToAllStudentProgress(setAllStudentProgress));
                unsubs.push(FirebaseService.listenToSubjects(teacherIds, setAllSubjects));
                unsubs.push(FirebaseService.listenToMessagesForStudent(user.id, teacherIds, setMessages));
            } else {
                setAllSubjects([]);
                setMessages([]);
                setTeacherProfiles([]);
            }
        }));

        unsubs.push(FirebaseService.listenToStudentProgress(user.id, (progress) => {
            setStudentProgress(progress);
            if (isLoading) {
                setIsLoading(false);
            }
        }));
        unsubs.push(FirebaseService.listenToStudyPlanForStudent(user.id, (plan) => setStudyPlan(plan.plan)));

        return () => unsubs.forEach(unsub => unsub());

    }, [user.id, isPreview, isLoading]);

    // Daily Challenge Generation Logic
    useEffect(() => {
        const checkAndGenerateChallenges = async () => {
            if (isPreview || !studentProgress || allSubjects.length === 0 || enrolledCourses.length === 0) return;
    
            const todayISO = getLocalDateISOString(new Date());
            let needsUpdate = false;
            const newProgress = JSON.parse(JSON.stringify(studentProgress));
    
            const allQuestionsWithContext = allSubjects.flatMap(subject =>
                subject.topics.flatMap(topic =>
                    [
                        ...topic.questions.map(q => ({ ...q, subjectId: subject.id, topicId: topic.id })),
                        ...(topic.tecQuestions || []).map(q => ({ ...q, subjectId: subject.id, topicId: topic.id })),
                        ...topic.subtopics.flatMap(st => [
                            ...st.questions.map(q => ({ ...q, subjectId: subject.id, topicId: st.id })),
                            ...(st.tecQuestions || []).map(q => ({ ...q, subjectId: subject.id, topicId: st.id })),
                        ])
                    ]
                )
            );
    
            const incorrectQuestions = (() => {
                const correctQuestionIds = new Set<string>();
                const incorrectQuestionIds = new Set<string>();
                const allAttempts = [
                    ...Object.values(studentProgress.progressByTopic).flatMap(s => Object.values(s).flatMap(t => t.lastAttempt)),
                    ...studentProgress.reviewSessions.flatMap(r => r.attempts || [])
                ];
                allAttempts.forEach(attempt => {
                    if (attempt.isCorrect) correctQuestionIds.add(attempt.questionId);
                    else incorrectQuestionIds.add(attempt.questionId);
                });
                const finalIncorrectIds = Array.from(incorrectQuestionIds).filter(id => !correctQuestionIds.has(id));
                return allQuestionsWithContext.filter(q => finalIncorrectIds.includes(q.id));
            })();
    
            // Review Challenge
            const currentReviewChallenge = studentProgress.reviewChallenge;
            if (!currentReviewChallenge || currentReviewChallenge.date !== todayISO) {
                const incorrectInCourses = incorrectQuestions.filter(q => enrolledCourses.some(c => c.disciplines.some(d => d.subjectId === q.subjectId)));
                const questionsForChallenge = incorrectInCourses.slice(0, 5); // Simple selection for now
                if (questionsForChallenge.length > 0) {
                    newProgress.reviewChallenge = {
                        date: todayISO,
                        items: questionsForChallenge,
                        isCompleted: false,
                        attemptsMade: 0,
                        uncompletedCount: (currentReviewChallenge && !currentReviewChallenge.isCompleted) ? (currentReviewChallenge.uncompletedCount || 0) + 1 : 0
                    };
                    needsUpdate = true;
                }
            }
    
            // Portuguese Challenge
            const currentPortugueseChallenge = studentProgress.portugueseChallenge;
            if (!currentPortugueseChallenge || currentPortugueseChallenge.date !== todayISO) {
                try {
                    const questions = await GeminiService.generatePortugueseChallenge(1);
                    newProgress.portugueseChallenge = {
                        date: todayISO,
                        items: questions.map((q, i) => ({ ...q, id: `port-challenge-${todayISO}-${i}` })),
                        isCompleted: false,
                        attemptsMade: 0,
                        uncompletedCount: (currentPortugueseChallenge && !currentPortugueseChallenge.isCompleted) ? (currentPortugueseChallenge.uncompletedCount || 0) + 1 : 0
                    };
                    needsUpdate = true;
                } catch (error) {
                    console.error("Failed to generate Portuguese challenge:", error);
                }
            }
    
            if (needsUpdate) {
                await FirebaseService.saveStudentProgress(newProgress);
            }
        };
    
        checkAndGenerateChallenges();
    }, [studentProgress, isPreview, allSubjects, enrolledCourses]);

    return {
        isLoading,
        allSubjects,
        allStudents,
        allStudentProgress,
        enrolledCourses,
        studentProgress,
        setStudentProgress,
        studyPlan,
        messages,
        teacherProfiles,
    };
};

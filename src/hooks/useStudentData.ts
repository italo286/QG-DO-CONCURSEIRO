import { useState, useEffect, useMemo } from 'react';
import * as FirebaseService from '../services/firebaseService';
import { User, Subject, StudentProgress, TeacherMessage, StudyPlan, Course } from '../types';

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
    
    // Memoize complex data calculations
    const allQuestionsWithContext = useMemo(() => allSubjects.flatMap(subject =>
        subject.topics.flatMap(topic =>
            [
                ...topic.questions.map(q => ({ ...q, subjectId: subject.id, subjectName: subject.name, topicId: topic.id, topicName: topic.name })),
                ...(topic.tecQuestions || []).map(q => ({ ...q, subjectId: subject.id, subjectName: subject.name, topicId: topic.id, topicName: topic.name })),
                ...topic.subtopics.flatMap(st => [
                    ...st.questions.map(q => ({ ...q, subjectId: subject.id, subjectName: subject.name, topicId: st.id, topicName: `${topic.name} / ${st.name}` })),
                    ...(st.tecQuestions || []).map(q => ({ ...q, subjectId: subject.id, subjectName: subject.name, topicId: st.id, topicName: `${topic.name} / ${st.name}` })),
                ])
            ]
        )
    ), [allSubjects]);
    
    const allGlossaryTermsWithContext = useMemo(() => allSubjects.flatMap(subject =>
        subject.topics.flatMap(topic => [
            ...(topic.glossary || []).map(term => ({ ...term, subjectId: subject.id, topicId: topic.id })),
            ...topic.subtopics.flatMap(subtopic =>
                (subtopic.glossary || []).map(term => ({ ...term, subjectId: subject.id, topicId: subtopic.id }))
            )
        ])
    ), [allSubjects]);

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
        allQuestionsWithContext,
        allGlossaryTermsWithContext,
    };
};
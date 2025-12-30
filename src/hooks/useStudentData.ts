
import { useState, useEffect } from 'react';
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
    const [weeklyRoutine, setWeeklyRoutine] = useState<StudyPlan['weeklyRoutine']>({});
    const [messages, setMessages] = useState<TeacherMessage[]>([]);
    const [teacherProfiles, setTeacherProfiles] = useState<User[]>([]);

    useEffect(() => {
        if (isPreview) {
            setIsLoading(false);
            return;
        }

        const unsubs: (() => void)[] = [];
        
        let progressUnsub: (() => void) | null = null;
        
        const studentsUnsub = FirebaseService.listenToStudents((students: User[]) => {
            setAllStudents(students.filter(s => s.role === 'aluno'));
            const studentIds = students.map(s => s.id);

            if (progressUnsub) {
                progressUnsub();
            }

            if (studentIds.length > 0) {
                progressUnsub = FirebaseService.listenToStudentProgressForTeacher(studentIds, setAllStudentProgress);
            }
        });
        unsubs.push(studentsUnsub);
        unsubs.push(() => {
            if (progressUnsub) {
                progressUnsub();
            }
        });

        let subjectUnsub: (() => void) | null = null;
        let messagesUnsub: (() => void) | null = null;

        const coursesUnsub = FirebaseService.listenToEnrolledCourses(user.id, (courses: Course[]) => {
            setEnrolledCourses(courses);
            const teacherIds = [...new Set(courses.map(c => c.teacherId))];

            if (subjectUnsub) subjectUnsub();
            if (messagesUnsub) messagesUnsub();

            if (teacherIds.length > 0) {
                FirebaseService.getUserProfilesByIds(teacherIds).then(setTeacherProfiles);
                subjectUnsub = FirebaseService.listenToSubjects(teacherIds, setAllSubjects);
                messagesUnsub = FirebaseService.listenToMessagesForStudent(user.id, teacherIds, setMessages);
            } else {
                setAllSubjects([]);
                setMessages([]);
                setTeacherProfiles([]);
            }
        });
        unsubs.push(coursesUnsub);
        unsubs.push(() => {
            if (subjectUnsub) subjectUnsub();
            if (messagesUnsub) messagesUnsub();
        });


        unsubs.push(FirebaseService.listenToStudentProgress(user.id, (progress: StudentProgress | null) => {
            setStudentProgress(progress);
            if (isLoading) {
                setIsLoading(false);
            }
        }));
        unsubs.push(FirebaseService.listenToStudyPlanForStudent(user.id, (plan: StudyPlan) => {
            setStudyPlan(plan.plan);
            setWeeklyRoutine(plan.weeklyRoutine || {});
        }));

        return () => unsubs.forEach((unsub: () => void) => unsub());

    }, [user.id, isPreview, isLoading]);
    
    return {
        isLoading,
        allSubjects,
        allStudents,
        allStudentProgress,
        enrolledCourses,
        studentProgress,
        setStudentProgress,
        studyPlan,
        weeklyRoutine,
        messages,
        teacherProfiles,
    };
};

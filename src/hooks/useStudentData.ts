import { useState, useEffect } from 'react';
import * as FirebaseService from '../../services/firebaseService';
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
        
        // This variable will hold the unsubscribe function for the progress listener
        let progressUnsub: (() => void) | null = null;
        
        // FIX: Replaced non-existent `listenToAllStudentProgress` with a mechanism that uses `listenToStudents`
        // and the existing `listenToStudentProgressForTeacher` to correctly fetch progress data for all students.
        // This also prevents a memory leak by cleaning up the previous progress listener when the student list changes.
        const studentsUnsub = FirebaseService.listenToStudents((students) => {
            setAllStudents(students.filter(s => s.role === 'aluno'));
            const studentIds = students.map(s => s.id);

            // Clean up old progress listener before creating a new one
            if (progressUnsub) {
                progressUnsub();
            }

            if (studentIds.length > 0) {
                progressUnsub = FirebaseService.listenToStudentProgressForTeacher(studentIds, setAllStudentProgress);
            }
        });
        unsubs.push(studentsUnsub);
        // Ensure progress listener is cleaned up on unmount
        unsubs.push(() => {
            if (progressUnsub) {
                progressUnsub();
            }
        });


        // These listeners depend on teacherIds from enrolled courses.
        // We manage their lifecycle to prevent memory leaks if courses change.
        let subjectUnsub: (() => void) | null = null;
        let messagesUnsub: (() => void) | null = null;

        const coursesUnsub = FirebaseService.listenToEnrolledCourses(user.id, (courses) => {
            setEnrolledCourses(courses);
            const teacherIds = [...new Set(courses.map(c => c.teacherId))];

            // Unsubscribe from previous listeners before creating new ones
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


        unsubs.push(FirebaseService.listenToStudentProgress(user.id, (progress) => {
            setStudentProgress(progress);
            if (isLoading) {
                setIsLoading(false);
            }
        }));
        unsubs.push(FirebaseService.listenToStudyPlanForStudent(user.id, (plan) => setStudyPlan(plan.plan)));

        return () => unsubs.forEach(unsub => unsub());

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
        messages,
        teacherProfiles,
    };
};

import { useState, useEffect, useMemo } from 'react';
import * as FirebaseService from '../services/firebaseService';
import { User, Subject, StudentProgress, TeacherMessage, StudyPlan, Course, Question } from '../types';
import { getBrasiliaDate, getLocalDateISOString } from '../utils';
import * as GeminiService from '../services/geminiService';

// Helper to shuffle array elements for randomizing question options
const shuffle = <T,>(array: T[]): T[] => {
    if (!array) return [];
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};


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


    // Daily Challenge Generation Logic
    useEffect(() => {
        const checkAndGenerateChallenges = async () => {
            if (isPreview || !studentProgress || allSubjects.length === 0 || enrolledCourses.length === 0) return;

            const now = getBrasiliaDate();
            const todayISO = getLocalDateISOString(now);

            const preferredTimeStr = studentProgress.dailyChallengeTime || '06:00';
            const [hours, minutes] = preferredTimeStr.split(':').map(Number);
            const generationTime = getBrasiliaDate();
            generationTime.setUTCHours(hours, minutes, 0, 0);

            if (now.getTime() < generationTime.getTime()) {
                return; // Not time yet to generate today's challenges
            }

            let needsUpdate = false;
            const newProgress = JSON.parse(JSON.stringify(studentProgress));

            // --- Review Challenge ---
            const currentReviewChallenge = studentProgress.reviewChallenge;
            if (!currentReviewChallenge || currentReviewChallenge.date !== todayISO) {
                const mode = studentProgress.dailyReviewMode || 'standard';
                const questionCount = studentProgress.advancedReviewQuestionCount || 5;
                let questionsForChallenge: Question[] = [];

                let availableQuestions: (Question & { subjectId: string; topicId: string; })[] = [];
                const questionType = studentProgress.advancedReviewQuestionType || 'incorrect';
                
                if (mode === 'standard') {
                    availableQuestions = allQuestionsWithContext;
                } else { // Advanced mode
                    const subjectIds = new Set(studentProgress.advancedReviewSubjectIds || []);
                    const topicIds = new Set(studentProgress.advancedReviewTopicIds || []);
                    
                    if (subjectIds.size > 0) {
                        const filteredBySubject = allQuestionsWithContext.filter(q => subjectIds.has(q.subjectId));
                        if (topicIds.size > 0) {
                            availableQuestions = filteredBySubject.filter(q => topicIds.has(q.topicId));
                        } else {
                            availableQuestions = filteredBySubject;
                        }
                    } 
                    // If no subjects are selected in advanced mode, availableQuestions remains empty, which is correct.
                }
                
                const attemptedIds = new Set<string>();
                const correctIds = new Set<string>();
                
                // From Topic Quizzes, Manual Reviews, and previous Daily Challenges
                const allSources = [
                    ...Object.values(studentProgress.progressByTopic).flatMap(s => Object.values(s).flatMap(t => t.lastAttempt)),
                    ...(studentProgress.reviewSessions || []).flatMap(r => r.attempts || []),
                    ...(studentProgress.reviewChallenge?.sessionAttempts || []),
                    ...(studentProgress.glossaryChallenge?.sessionAttempts || []),
                    ...(studentProgress.portugueseChallenge?.sessionAttempts || [])
                ];

                allSources.forEach(attempt => {
                    if (attempt) {
                        attemptedIds.add(attempt.questionId);
                        if (attempt.isCorrect) {
                            correctIds.add(attempt.questionId);
                        }
                    }
                });
                
                const incorrectIds = new Set<string>();
                attemptedIds.forEach(id => { if (!correctIds.has(id)) incorrectIds.add(id); });

                let finalSelectionPool: Question[] = [];
                if (questionType === 'unanswered') {
                    finalSelectionPool = availableQuestions.filter(q => !attemptedIds.has(q.id));
                } else if (questionType === 'incorrect') {
                    finalSelectionPool = availableQuestions.filter(q => incorrectIds.has(q.id));
                } else if (questionType === 'correct') {
                    finalSelectionPool = availableQuestions.filter(q => correctIds.has(q.id));
                } else { // mixed
                    finalSelectionPool = availableQuestions;
                }
                
                questionsForChallenge = shuffle(finalSelectionPool).slice(0, questionCount);

                if (questionsForChallenge.length > 0) {
                    newProgress.reviewChallenge = { date: todayISO, items: questionsForChallenge, isCompleted: false, attemptsMade: 0, uncompletedCount: (currentReviewChallenge && !currentReviewChallenge.isCompleted) ? (currentReviewChallenge.uncompletedCount || 0) + 1 : 0 };
                    needsUpdate = true;
                }
            }
            
            // --- Glossary Challenge ---
            const currentGlossaryChallenge = studentProgress.glossaryChallenge;
            if (!currentGlossaryChallenge || currentGlossaryChallenge.date !== todayISO) {
                const mode = studentProgress.glossaryChallengeMode || 'standard';
                const questionCount = studentProgress.glossaryChallengeQuestionCount || 5;
                let availableTerms = allGlossaryTermsWithContext;

                if (mode === 'advanced') {
                    const subjectIds = new Set(studentProgress.advancedGlossarySubjectIds || []);
                    const topicIds = new Set(studentProgress.advancedGlossaryTopicIds || []);
                    if (subjectIds.size > 0) {
                        availableTerms = availableTerms.filter(term => subjectIds.has(term.subjectId));
                        if (topicIds.size > 0) {
                            availableTerms = availableTerms.filter(term => topicIds.has(term.topicId));
                        }
                    }
                }

                const uniqueTerms = Array.from(new Map(availableTerms.map(item => [item.term, item])).values());
                if (uniqueTerms.length >= 4) {
                    const selectedTerms = shuffle(uniqueTerms).slice(0, questionCount);
                    const glossaryQuestions: Question[] = selectedTerms.map((correctTerm, index) => {
                        const distractors = shuffle(uniqueTerms.filter(t => t.term !== correctTerm.term)).slice(0, 4).map(t => t.term);
                        const options = shuffle([correctTerm.term, ...distractors]);
                        return { id: `gloss-challenge-${todayISO}-${index}`, statement: `Qual termo corresponde à definição: "${correctTerm.definition}"?`, options, correctAnswer: correctTerm.term, justification: `O termo correto é **${correctTerm.term}**.` };
                    });

                    if (glossaryQuestions.length > 0) {
                        newProgress.glossaryChallenge = { date: todayISO, items: glossaryQuestions, isCompleted: false, attemptsMade: 0, uncompletedCount: (currentGlossaryChallenge && !currentGlossaryChallenge.isCompleted) ? (currentGlossaryChallenge.uncompletedCount || 0) + 1 : 0 };
                        needsUpdate = true;
                    }
                }
            }

            // --- Portuguese Challenge ---
            const currentPortugueseChallenge = studentProgress.portugueseChallenge;
            if (!currentPortugueseChallenge || currentPortugueseChallenge.date !== todayISO) {
                try {
                    const questionCount = studentProgress.portugueseChallengeQuestionCount || 1;
                    const questions = await GeminiService.generatePortugueseChallenge(questionCount);
                    if (questions.length > 0) {
                        newProgress.portugueseChallenge = { date: todayISO, items: questions.map((q, i) => ({ ...q, id: `port-challenge-${todayISO}-${i}` })), isCompleted: false, attemptsMade: 0, uncompletedCount: (currentPortugueseChallenge && !currentPortugueseChallenge.isCompleted) ? (currentPortugueseChallenge.uncompletedCount || 0) + 1 : 0 };
                        needsUpdate = true;
                    }
                } catch (error) {
                    console.error("Failed to generate Portuguese challenge:", error);
                }
            }

            if (needsUpdate) {
                await FirebaseService.saveStudentProgress(newProgress);
            }
        };

        checkAndGenerateChallenges();
    }, [studentProgress, isPreview, allSubjects, enrolledCourses, allQuestionsWithContext, allGlossaryTermsWithContext]);


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
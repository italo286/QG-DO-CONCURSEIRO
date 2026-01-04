
import { db, storage, firebase } from '../firebaseConfig';
import { User, Subject, Course, StudentProgress, TeacherMessage, StudyPlan, ReviewSession, MessageReply, Topic, Question, Simulado } from '../types';
import { getBrasiliaDate, getLocalDateISOString } from '../utils';

type Unsubscribe = () => void;

// --- Notificações ---
export const updateUserFcmToken = async (uid: string, token: string): Promise<void> => {
    const userRef = db.collection('users').doc(uid);
    await userRef.update({ fcmToken: token });
};

// --- User Management ---
export const getUserProfile = async (uid: string): Promise<User | null> => {
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (userSnap.exists) {
    return { id: userSnap.id, ...userSnap.data() } as User;
  }
  return null;
};

export const getUserProfilesByIds = async (uids: string[]): Promise<User[]> => {
    if (uids.length === 0) return [];
    
    const chunks = [];
    for (let i = 0; i < uids.length; i += 10) {
        chunks.push(uids.slice(i, i + 10));
    }

    const allUsers: User[] = [];
    for (const chunk of chunks) {
        if (chunk.length > 0) {
            const usersRef = db.collection('users');
            const q = usersRef.where(firebase.firestore.FieldPath.documentId(), 'in', chunk);
            const querySnapshot = await q.get();
            const users = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
            allUsers.push(...users);
        }
    }
    
    return allUsers;
};

export const createUserProfile = async (uid: string, username: string, name: string, role: 'aluno' | 'professor'): Promise<void> => {
  const userRef = db.collection('users').doc(uid);
  await userRef.set({
    username,
    name: name || username,
    role,
    avatarUrl: 'https://cdn-icons-png.flaticon.com/512/921/921124.png',
  });

  if (role === 'aluno') {
    const progressRef = db.collection('studentProgress').doc(uid);
    const initialProgress: StudentProgress = {
        studentId: uid,
        progressByTopic: {},
        reviewSessions: [],
        xp: 0,
        earnedBadgeIds: [],
        notesByTopic: {},
        dailyActivity: {},
        srsData: {},
        customGames: [],
        earnedTopicBadgeIds: {},
        earnedGameBadgeIds: {},
        customQuizzes: [],
        targetCargoByCourse: {},
        aiGeneratedFlashcards: [],
        srsFlashcardData: {},
        dailyReviewMode: 'standard',
        advancedReviewSubjectIds: [],
        advancedReviewTopicIds: [],
        advancedReviewQuestionType: 'incorrect',
        advancedReviewQuestionCount: 5,
        advancedReviewTimerDuration: 300,
        advancedReviewMaxAttempts: 1,
        glossaryChallengeMode: 'standard',
        advancedGlossarySubjectIds: [],
        advancedGlossaryTopicIds: [],
        glossaryChallengeQuestionCount: 5,
        glossaryChallengeTimerDuration: 300,
        glossaryChallengeMaxAttempts: 1,
        portugueseChallengeQuestionCount: 1,
        portugueseChallengeTimerDuration: 300,
        portugueseChallengeMaxAttempts: 1,
        portugueseErrorStats: {},
        gamesCompletedCount: 0,
        dailyChallengeStreak: {
            current: 0,
            longest: 0,
            lastCompletedDate: '',
        },
        dailyChallengeCompletions: {},
    };
    await progressRef.set(initialProgress);
  }
};

export const updateUserProfile = async (uid: string, data: Partial<User>): Promise<void> => {
    const userRef = db.collection('users').doc(uid);
    await userRef.update(data);
};

export const listenToStudents = (callback: (students: User[]) => void): Unsubscribe => {
    const usersRef = db.collection('users');
    const q = usersRef.where('role', '==', 'aluno');
    return q.onSnapshot((querySnapshot) => {
        const students = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        callback(students);
    });
};

// --- Monitoring ---
export const listenToGenerationLogs = (limit: number, callback: (logs: any[]) => void): Unsubscribe => {
    return db.collection('generationLogs')
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .onSnapshot(snap => {
            callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
};

export const clearAllLogs = async (): Promise<void> => {
    const logs = await db.collection('generationLogs').get();
    const batch = db.batch();
    logs.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
};

// --- File Management ---
export const uploadImage = async (path: string, file: File): Promise<string> => {
    const storageRef = storage.ref(path);
    await storageRef.put(file);
    return await storageRef.getDownloadURL();
};

// --- Subject Management ---
export const listenToSubjects = (teacherIds: string[], callback: (subjects: Subject[]) => void): Unsubscribe => {
    if (teacherIds.length === 0) {
        callback([]);
        return () => {};
    }

    const subjectsRef = db.collection('subjects');
    const q = subjectsRef.where('teacherId', 'in', teacherIds);

    let executionId = 0;

    const unsub = q.onSnapshot(async (querySnapshot) => {
        const currentExecutionId = ++executionId;

        const subjectsDataPromises = querySnapshot.docs.map(async (doc) => {
            const subjectData = doc.data();
            const topicsSnapshot = await db.collection('subjects').doc(doc.id).collection('topics').orderBy('order').get();
            let fetchedTopics: Topic[] = [];

            if (!topicsSnapshot.empty) {
                fetchedTopics = topicsSnapshot.docs.map(topicDoc => ({ id: topicDoc.id, ...topicDoc.data() } as Topic));
            } else if (Array.isArray(subjectData.topics) && subjectData.topics.length > 0) {
                fetchedTopics = subjectData.topics;
            }
            
            const { topics, ...baseData } = subjectData;
            
            return { 
                id: doc.id,
                ...baseData,
                topics: fetchedTopics
            } as Subject;
        });

        const subjectsWithTopics = await Promise.all(subjectsDataPromises);
        
        if (currentExecutionId === executionId) {
            callback(subjectsWithTopics);
        }
    });
    
    return () => unsub();
};

export const saveSubject = async (subjectData: Omit<Subject, 'id'>): Promise<Subject> => {
    const { topics, ...baseSubjectData } = subjectData;
    const newDocRef = db.collection("subjects").doc();
    await newDocRef.set(baseSubjectData);
    
    if (topics && topics.length > 0) {
        const batch = db.batch();
        const topicsRef = newDocRef.collection('topics');
        topics.forEach((topic, index) => {
            const topicDoc = topicsRef.doc(topic.id);
            batch.set(topicDoc, {...topic, order: index });
        });
        await batch.commit();
    }
    
    return { ...subjectData, id: newDocRef.id };
};

export const updateSubject = async (subject: Subject): Promise<void> => {
    const { id, topics, ...baseSubjectData } = subject;
    const subjectRef = db.collection('subjects').doc(id);
    const topicsRef = subjectRef.collection('topics');

    const batch = db.batch();
    const updateData = {
        ...baseSubjectData,
        topics: firebase.firestore.FieldValue.delete()
    };
    batch.update(subjectRef, updateData);

    const existingTopicsSnapshot = await topicsRef.get();
    const existingTopicIds = new Set<string>(existingTopicsSnapshot.docs.map(doc => doc.id as string));
    const newTopicIds = new Set<string>(topics.map(t => t.id));

    existingTopicIds.forEach((topicId: string) => {
        if (!newTopicIds.has(topicId)) {
            batch.delete(topicsRef.doc(topicId));
        }
    });
    
    topics.forEach((topic, index) => {
        const topicDocRef = topicsRef.doc(topic.id);
        batch.set(topicDocRef, {...topic, order: index });
    });

    await batch.commit();
};

export const updateSubjectQuestion = async (
    subjectId: string,
    topicId: string,
    questionId: string,
    isTec: boolean,
    reportInfo: { reason: string; studentId: string; } | null
): Promise<void> => {
    const topicDocRef = db.collection('subjects').doc(subjectId).collection('topics').doc(topicId);

    await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(topicDocRef);
        if (!doc.exists) {
            throw new Error(`Topic document with ID ${topicId as string} not found in subject ${subjectId as string}`);
        }

        const topicData = doc.data() as Topic;
        let wasUpdated = false;

        const updateQuestionInList = (questions: Question[] | undefined): Question[] | undefined => {
            if (!questions) return undefined;
            const questionIndex = questions.findIndex(q => q.id === questionId);
            if (questionIndex === -1) return questions;

            wasUpdated = true;
            const updatedQuestions = [...questions];
            const updatedQuestion = { ...updatedQuestions[questionIndex] };

            if (reportInfo) {
                updatedQuestion.reportInfo = reportInfo;
            } else {
                delete updatedQuestion.reportInfo;
            }
            updatedQuestions[questionIndex] = updatedQuestion;
            return updatedQuestions;
        };

        if (isTec) {
            topicData.tecQuestions = updateQuestionInList(topicData.tecQuestions);
        } else {
            const updatedQuestions = updateQuestionInList(topicData.questions);
            if (updatedQuestions) {
                topicData.questions = updatedQuestions;
            }
        }

        if (!wasUpdated && topicData.subtopics) {
            topicData.subtopics = topicData.subtopics.map(subtopic => {
                if (isTec) {
                    const updatedTec = updateQuestionInList(subtopic.tecQuestions);
                    if (updatedTec !== subtopic.tecQuestions) return { ...subtopic, tecQuestions: updatedTec };
                } else {
                    const updatedNormal = updateQuestionInList(subtopic.questions);
                    if (updatedNormal && updatedNormal !== subtopic.questions) {
                         return { ...subtopic, questions: updatedNormal };
                    }
                }
                return subtopic;
            });
        }
        
        if (wasUpdated) {
            transaction.update(topicDocRef, topicData);
        }
    });
};

export const deleteSubject = async (subjectId: string): Promise<void> => {
    const subjectRef = db.collection('subjects').doc(subjectId);
    const topicsRef = subjectRef.collection('topics');

    const topicsSnapshot = await topicsRef.get();
    if (!topicsSnapshot.empty) {
        const batch = db.batch();
        topicsSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
    }
    
    await subjectRef.delete();
};

// --- Course Management ---
export const listenToCourses = (teacherId: string, callback: (courses: Course[]) => void): Unsubscribe => {
    const coursesRef = db.collection('courses');
    const q = coursesRef.where('teacherId', '==', teacherId);
    return q.onSnapshot((querySnapshot) => {
        const courses = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
        callback(courses);
    });
};

export const listenToEnrolledCourses = (studentId: string, callback: (courses: Course[]) => void): Unsubscribe => {
    const coursesRef = db.collection('courses');
    const q = coursesRef.where('enrolledStudentIds', 'array-contains', studentId);
     return q.onSnapshot((querySnapshot) => {
        const courses = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
        callback(courses);
    });
}

export const saveCourse = async (courseData: Omit<Course, 'id'>): Promise<Course> => {
    const newDocRef = db.collection("courses").doc();
    const newCourse = { ...courseData, id: newDocRef.id };
    await newDocRef.set(courseData);
    return newCourse;
};

export const updateCourse = async (course: Course): Promise<void> => {
    const courseRef = db.collection('courses').doc(course.id);
    const dataToUpdate = { ...course };
    delete (dataToUpdate as any).id;
    await courseRef.update(dataToUpdate);
};

export const deleteCourse = async (courseId: string): Promise<void> => {
    const courseRef = db.collection('courses').doc(courseId);
    await courseRef.delete();
};

// --- Student Progress ---
export const saveStudentProgress = async (progress: StudentProgress): Promise<void> => {
    const progressRef = db.collection('studentProgress').doc(progress.studentId);
    await progressRef.set(progress, { merge: true });
};

export const listenToStudentProgress = (studentId: string, callback: (progress: StudentProgress | null) => void): Unsubscribe => {
    const progressRef = db.collection('studentProgress').doc(studentId);
    return progressRef.onSnapshot((doc) => {
        if(doc.exists) {
            callback(doc.data() as StudentProgress);
        } else {
            const initialProgress: StudentProgress = {
                studentId: studentId,
                progressByTopic: {},
                reviewSessions: [],
                xp: 0,
                earnedBadgeIds: [],
                notesByTopic: {},
                dailyActivity: {},
                srsData: {},
                customGames: [],
                earnedTopicBadgeIds: {},
                earnedGameBadgeIds: {},
                customQuizzes: [],
                targetCargoByCourse: {},
                aiGeneratedFlashcards: [],
                srsFlashcardData: {},
                dailyReviewMode: 'standard',
                advancedReviewSubjectIds: [],
                advancedReviewTopicIds: [],
                advancedReviewQuestionType: 'incorrect',
                advancedReviewQuestionCount: 5,
                advancedReviewTimerDuration: 300,
                advancedReviewMaxAttempts: 1,
                glossaryChallengeMode: 'standard',
                advancedGlossarySubjectIds: [],
                advancedGlossaryTopicIds: [],
                glossaryChallengeQuestionCount: 5,
                glossaryChallengeTimerDuration: 300,
                glossaryChallengeMaxAttempts: 1,
                portugueseChallengeQuestionCount: 1,
                portugueseChallengeTimerDuration: 300,
                portugueseChallengeMaxAttempts: 1,
                portugueseErrorStats: {},
                gamesCompletedCount: 0,
                dailyChallengeStreak: {
                    current: 0,
                    longest: 0,
                    lastCompletedDate: '',
                },
                dailyChallengeCompletions: {},
            };
            progressRef.set(initialProgress).catch(err => console.error("Failed to create initial student progress:", err));
            callback(initialProgress);
        }
    });
};

export const listenToStudentProgressForTeacher = (studentIds: string[], callback: (progress: {[studentId: string]: StudentProgress}) => void): Unsubscribe => {
    if (studentIds.length === 0) {
        callback({});
        return () => {};
    }

    const chunks: string[][] = [];
    for (let i = 0; i < studentIds.length; i += 10) {
        chunks.push(studentIds.slice(i, i + 10));
    }

    const progressByChunk: { [chunkIndex: number]: { [id: string]: StudentProgress } } = {};
    const unsubs: Unsubscribe[] = [];

    const processAndCallback = () => {
        const mergedProgress = Object.values(progressByChunk).reduce((acc, chunk) => ({...acc, ...chunk}), {});
        callback(mergedProgress);
    };

    chunks.forEach((chunk, chunkIndex) => {
        if (chunk.length > 0) {
            const progressRef = db.collection('studentProgress');
            const q = progressRef.where(firebase.firestore.FieldPath.documentId(), 'in', chunk);
            const unsub = q.onSnapshot((querySnapshot) => {
                const chunkProgress: { [id: string]: StudentProgress } = {};
                querySnapshot.docs.forEach(doc => {
                    chunkProgress[doc.id] = doc.data() as StudentProgress;
                });
                progressByChunk[chunkIndex] = chunkProgress;
                processAndCallback();
            }, (error) => {
                console.error("Error in listenToStudentProgressForTeacher snapshot:", error);
            });
            unsubs.push(unsub);
        }
    });
    
    return () => unsubs.forEach(unsub => unsub());
};

export const resetDailyChallengesForStudent = async (studentId: string): Promise<void> => {
    const progressRef = db.collection('studentProgress').doc(studentId);
    const todayISO = getLocalDateISOString(getBrasiliaDate());

    await progressRef.update({
        reviewChallenge: firebase.firestore.FieldValue.delete(),
        glossaryChallenge: firebase.firestore.FieldValue.delete(),
        portugueseChallenge: firebase.firestore.FieldValue.delete(),
        [`dailyChallengeCompletions.${todayISO}`]: firebase.firestore.FieldValue.delete()
    });
};

// --- Messages ---
export const addMessage = async (
    data: { senderId: string, teacherId: string, studentId: string | null, message: string }
): Promise<void> => {
    const timestamp = Date.now();
    const newMessage: Omit<TeacherMessage, 'id'> = {
        teacherId: data.teacherId,
        studentId: data.studentId,
        message: data.message,
        timestamp: timestamp,
        acknowledgedBy: [data.senderId],
        replies: [],
        lastReplyTimestamp: timestamp,
        deletedBy: []
    };
    await db.collection('messages').add(newMessage);
};

export const createReportNotification = async (
    teacherId: string,
    student: User,
    subjectName: string,
    topicName: string,
    questionStatement: string,
    reason: string,
): Promise<void> => {
    const timestamp = Date.now();
    const studentDisplayName = student.name || student.username;
    const message = `Aluno ${studentDisplayName} reportou um erro na questão "${questionStatement.substring(0, 50)}..." no tópico "${topicName}". Motivo: ${reason}.`;

    const newNotification: Omit<TeacherMessage, 'id'> = {
        teacherId,
        studentId: null,
        message,
        timestamp,
        acknowledgedBy: [],
        replies: [],
        lastReplyTimestamp: timestamp,
        deletedBy: [],
        type: 'system',
        context: {
            studentName: studentDisplayName as string,
            subjectName: subjectName as string,
            topicName: topicName as string,
            questionStatement: questionStatement as string,
        }
    };
    await db.collection('messages').add(newNotification);
};

export const addReplyToMessage = async (messageId: string, reply: Omit<MessageReply, 'timestamp'>) => {
    const messageRef = db.collection('messages').doc(messageId);
    const newReply = { ...reply, timestamp: Date.now() };

    await messageRef.update({
        replies: firebase.firestore.FieldValue.arrayUnion(newReply),
        lastReplyTimestamp: newReply.timestamp,
        acknowledgedBy: [reply.senderId],
        deletedBy: [] 
    });
};

export const acknowledgeMessage = async (messageId: string, userId: string) => {
    const messageRef = db.collection('messages').doc(messageId);
    await messageRef.update({
        acknowledgedBy: firebase.firestore.FieldValue.arrayUnion(userId)
    });
};

export const listenToMessagesForTeachers = (teacherIds: string[], callback: (messages: TeacherMessage[]) => void): Unsubscribe => {
    if (teacherIds.length === 0) {
        callback([]);
        return () => {};
    }
    const teacherId = teacherIds[0]; 
    const messagesRef = db.collection('messages');
    const q = messagesRef.where('teacherId', 'in', teacherIds);
    
    return q.onSnapshot((querySnapshot) => {
        const allMessages = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeacherMessage));
        const filteredMessages = allMessages.filter(msg => !msg.deletedBy?.includes(teacherId));
        const sortedMessages = filteredMessages.sort((a, b) => {
            const timeA = a.lastReplyTimestamp || a.timestamp;
            const timeB = b.lastReplyTimestamp || b.timestamp;
            return timeB - timeA;
        });
        callback(sortedMessages);
    });
};

export const listenToMessagesForStudent = (studentId: string, teacherIds: string[], callback: (messages: TeacherMessage[]) => void): Unsubscribe => {
    const messagesRef = db.collection('messages');
    const studentMessagesQ = messagesRef.where('studentId', '==', studentId);

    const chunks: string[][] = [];
    if (teacherIds.length > 0) {
        for (let i = 0; i < teacherIds.length; i += 10) {
            chunks.push(teacherIds.slice(i, i + 10));
        }
    }

    let studentMessages: TeacherMessage[] = [];
    const broadcastMessagesByChunk: { [key: number]: TeacherMessage[] } = {};

    const processAndCallback = () => {
        const allBroadcasts = Object.values(broadcastMessagesByChunk).flat();
        const combined = [...studentMessages, ...allBroadcasts];
        const unique = Array.from(new Map(combined.map(m => [m.id, m])).values());
        const filtered = unique.filter(msg => !msg.deletedBy?.includes(studentId) && msg.type !== 'system');
        const sorted = filtered.sort((a, b) => {
            const timeA = a.lastReplyTimestamp || a.timestamp;
            const timeB = b.lastReplyTimestamp || b.timestamp;
            return timeB - timeA;
        });
        callback(sorted);
    };

    const unsubStudent = studentMessagesQ.onSnapshot(snap => {
        studentMessages = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeacherMessage));
        processAndCallback();
    });

    const broadcastUnsubs = chunks.map((chunk, index) => {
        const broadcastQ = messagesRef.where('studentId', '==', null).where('teacherId', 'in', chunk);
        return broadcastQ.onSnapshot(snap => {
            broadcastMessagesByChunk[index] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeacherMessage));
            processAndCallback();
        });
    });
    
    if (chunks.length === 0) {
        processAndCallback();
    }
    
    return () => {
        unsubStudent();
        broadcastUnsubs.forEach(unsub => unsub());
    };
};

export const deleteMessageForUser = async (messageId: string, userId: string): Promise<void> => {
    const messageRef = db.collection('messages').doc(messageId);
    const doc = await messageRef.get();
    if (!doc.exists) return;

    const message = doc.data() as TeacherMessage;
    const { studentId, teacherId, deletedBy = [] } = message;
    const otherPartyId = studentId ? (userId === teacherId ? studentId : teacherId) : null;

    if (otherPartyId && deletedBy.includes(otherPartyId)) {
        await messageRef.delete();
    } else {
        await messageRef.update({
            deletedBy: firebase.firestore.FieldValue.arrayUnion(userId)
        });
    }
};

// --- Study Plan ---
export const saveStudyPlanForStudent = async (plan: StudyPlan): Promise<void> => {
    const planRef = db.collection('studyPlans').doc(plan.studentId);
    const sanitizedPlan = JSON.parse(JSON.stringify(plan));
    if (sanitizedPlan.activePlanId === undefined) {
        sanitizedPlan.activePlanId = "";
    }
    await planRef.set(sanitizedPlan);
};

export const listenToStudyPlanForStudent = (studentId: string, callback: (plan: StudyPlan) => void): Unsubscribe => {
    const planRef = db.collection('studyPlans').doc(studentId);
    return planRef.onSnapshot((doc) => {
        if(doc.exists) {
            callback(doc.data() as StudyPlan);
        } else {
            callback({ studentId, plans: [] });
        }
    });
};

export const listenToStudyPlansForTeacher = (studentIds: string[], callback: (plans: {[studentId: string]: StudyPlan}) => void): Unsubscribe => {
    if (studentIds.length === 0) {
        callback({});
        return () => {};
    }

    const chunks: string[][] = [];
    for (let i = 0; i < studentIds.length; i += 10) {
        chunks.push(studentIds.slice(i, i + 10));
    }

    const plansByChunk: { [chunkIndex: number]: { [id: string]: StudyPlan } } = {};
    const unsubs: Unsubscribe[] = [];
    
    const processAndCallback = () => {
        const mergedPlans = Object.values(plansByChunk).reduce((acc, chunk) => ({...acc, ...chunk}), {});
        callback(mergedPlans);
    };

    chunks.forEach((chunk, chunkIndex) => {
        if (chunk.length > 0) {
            const plansRef = db.collection('studyPlans');
            const q = plansRef.where(firebase.firestore.FieldPath.documentId(), 'in', chunk);
            const unsub = q.onSnapshot((querySnapshot) => {
                const chunkPlans: { [id: string]: StudyPlan } = {};
                querySnapshot.docs.forEach(doc => {
                    chunkPlans[doc.id] = doc.data() as StudyPlan;
                });
                // FIX: Use plansByChunk instead of progressByChunk to resolve the 'Cannot find name' error.
                plansByChunk[chunkIndex] = chunkPlans;
                processAndCallback();
            }, (error) => {
                 console.error("Error in listenToStudyPlansForTeacher snapshot:", error);
            });
            unsubs.push(unsub);
        }
    });
    
    return () => unsubs.forEach(unsub => unsub());
};

// --- Review Sessions & Simulados ---
export const addReviewSessionToStudents = async (studentIds: string[], session: Omit<ReviewSession, 'id' | 'createdAt'>) => {
    const batch = db.batch();
    
    studentIds.forEach(studentId => {
        const studentProgressRef = db.collection('studentProgress').doc(studentId);
        const newSession: ReviewSession = {
            ...session,
            id: `rev-manual-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            createdAt: Date.now()
        };
        batch.update(studentProgressRef, {
            reviewSessions: firebase.firestore.FieldValue.arrayUnion(newSession)
        });
    });

    await batch.commit();
};

export const addSimuladoToStudents = async (
    studentIds: string[],
    simuladoData: Omit<Simulado, 'id' | 'isCompleted' | 'attempts' | 'createdAt'>
) => {
    const batch = db.batch();
    
    studentIds.forEach(studentId => {
        const studentProgressRef = db.collection('studentProgress').doc(studentId);
        const newSimulado: Simulado = {
            ...simuladoData,
            id: `sim-prof-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            createdAt: Date.now(),
            isCompleted: false,
            attempts: [],
        };
        batch.update(studentProgressRef, {
            simulados: firebase.firestore.FieldValue.arrayUnion(newSimulado)
        });
    });

    await batch.commit();
};

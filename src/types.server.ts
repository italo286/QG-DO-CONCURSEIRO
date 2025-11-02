// This file contains types that are shared between the server (Netlify functions)
// and the client, but do NOT have any frontend-specific dependencies like React.

export type UserRole = 'professor' | 'aluno';

export interface User {
  id: string; // This will be the Firebase Auth UID
  username: string; // email for login
  name?: string;
  role: UserRole;
  avatarUrl?: string; // Changed from base64 to URL
  fcmToken?: string;
}

export interface Question {
  id: string;
  statement: string;
  options: string[];
  correctAnswer: string;
  justification: string;
  optionJustifications?: { [optionText: string]: string };
  imageUrl?: string;
  reportInfo?: {
      reason: string;
      studentId: string;
  };
  subjectName?: string;
  topicName?: string;
  errorCategory?: string; // For adaptive Portuguese challenges
  isTec?: boolean;
  // FIX: Added optional properties to hold context for questions in cross-topic quizzes like daily challenges.
  subjectId?: string;
  topicId?: string;
}

export interface PdfFile {
    id: string;
    fileName: string;
    url?: string;
}

export interface VideoFile {
    id: string;
    name: string;
    url: string;
}

// --- Mini Games ---
export type MiniGameType = 'memory' | 'association' | 'order' | 'intruder' | 'categorize';

export interface MemoryGameData {
  items: string[]; // Professor provides up to 15 unique strings. Game creates pairs.
}

export interface AssociationGameData {
  pairs: { concept: string; definition: string }[];
}

export interface OrderGameData {
  items: string[];
  description: string;
}

export interface IntruderGameData {
  correctItems: string[];
  intruder: string;
  categoryName: string;
}

export interface CategorizeGameData {
  categories: { name: string; items: string[] }[];
}

export interface MiniGame {
    id: string;
    type: MiniGameType;
    name: string;
    data: MemoryGameData | AssociationGameData | OrderGameData | IntruderGameData | CategorizeGameData;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
}

export interface GlossaryTerm {
  term: string;
  definition: string;
}

export interface BankProfilePdf {
  id: string;
  bankName: string;
  url: string;
}

export interface SubTopic {
  id: string;
  name: string;
  description?: string;
  fullPdfs: PdfFile[];
  summaryPdfs: PdfFile[];
  raioXPdfs?: PdfFile[];
  videoUrls?: VideoFile[];
  mindMapUrl?: string;
  bankProfilePdfs?: BankProfilePdf[];
  questions: Question[];
  tecQuestions?: Question[];
  tecUrl?: string;
  miniGames: MiniGame[];
  flashcards: Flashcard[];
  glossary?: GlossaryTerm[];
  color?: string;
}

export interface Topic {
  id:string;
  name: string;
  description?: string;
  fullPdfs: PdfFile[];
  summaryPdfs: PdfFile[];
  raioXPdfs?: PdfFile[];
  videoUrls?: VideoFile[];
  mindMapUrl?: string;
  bankProfilePdfs?: BankProfilePdf[];
  questions: Question[];
  tecQuestions?: Question[];
  tecUrl?: string;
  miniGames: MiniGame[];
  subtopics: SubTopic[];
  flashcards: Flashcard[];
  glossary?: GlossaryTerm[];
  color?: string;
}

export interface Subject {
  id: string;
  teacherId: string;
  name: string;
  description: string;
  topics: Topic[];
  color?: string;
}

export interface CourseDiscipline {
  subjectId: string;
  excludedTopicIds: string[];
  topicFrequencies?: { [topicOrSubtopicId: string]: 'alta' | 'media' | 'baixa' | 'nenhuma'; };
}

export interface EditalInfo {
  cargosEVagas: { cargo: string; vagas: string; cadastroReserva?: string; }[];
  requisitosEscolaridade: string;
  bancaOrganizadora: string;
  formatoProva: string;
  distribuicaoQuestoes: { disciplina: string; quantidade: number }[];
  totalQuestoes: number;
  remuneracao: string;
  dataProva: string; // ISO format 'YYYY-MM-DD'
}

export interface Course {
  id: string;
  teacherId: string;
  name: string;
  imageUrl?: string;
  disciplines: CourseDiscipline[];
  enrolledStudentIds: string[];
  editalUrl?: string;
  editalInfo?: EditalInfo;
  youtubeCarousel?: VideoFile[];
}

export interface ReviewSession {
    id: string;
    name: string;
    type: 'manual' | 'ai' | 'srs';
    createdAt: number; // timestamp
    questions: Question[];
    attempts?: QuestionAttempt[];
    isCompleted: boolean;
}

export interface DailyChallenge<T> {
    date: string; // ISO Date 'YYYY-MM-DD'
    generatedForDate?: string; // ISO Date 'YYYY-MM-DD', used for catch-up challenges
    generatedAtTime?: string; // e.g., "08:00", the time setting when it was generated
    items: T[];
    isCompleted: boolean;
    attemptsMade: number;
    uncompletedCount?: number; // Number of previous uncompleted challenges
    sessionAttempts?: QuestionAttempt[];
}

export interface CustomQuiz {
  id: string;
  name: string;
  questions: Question[];
  isCompleted: boolean;
  attempts?: QuestionAttempt[];
  createdAt: number; // timestamp
}

export interface SimuladoConfig {
  subjects: { subjectId: string; questionCount: number }[];
  filter: 'incorrect' | 'correct' | 'unanswered' | 'answered' | 'mixed';
  durationInSeconds?: number;
  feedbackMode: 'immediate' | 'at_end';
}

export interface Simulado {
  id: string;
  name: string;
  createdAt: number;
  questions: Question[];
  config: SimuladoConfig;
  isCompleted: boolean;
  attempts?: QuestionAttempt[];
}

export interface StudentProgress {
  studentId: string;
  progressByTopic: {
    [subjectId: string]: {
      [topicId: string]: {
        completed: boolean;
        score: number; // e.g., 0.8 for 80%
        lastAttempt: QuestionAttempt[];
      };
    };
  };
  reviewSessions: ReviewSession[];
  xp: number;
  earnedBadgeIds: string[];
  earnedTopicBadgeIds?: { [topicId: string]: string[] };
  earnedGameBadgeIds?: { [topicId: string]: string[] };
  notesByTopic: { [topicId: string]: string; };
  dailyActivity: { [dateISO: string]: { questionsAnswered: number } };
  srsData: {
      [questionId: string]: {
          stage: number; // 0-8 for example
          nextReviewDate: string; // ISO Date 'YYYY-MM-DD'
      }
  };
  customGames: MiniGame[];
  customQuizzes?: CustomQuiz[];
  simulados?: Simulado[];
  targetCargoByCourse?: { [courseId: string]: string; };
  aiGeneratedFlashcards?: Flashcard[];
  srsFlashcardData?: {
      [flashcardId: string]: {
          stage: number;
          nextReviewDate: string;
      }
  };
  // Review Challenge Settings
  dailyReviewMode?: 'standard' | 'advanced';
  advancedReviewSubjectIds?: string[];
  advancedReviewTopicIds?: string[];
  advancedReviewQuestionType?: 'incorrect' | 'correct' | 'unanswered' | 'mixed';
  advancedReviewQuestionCount?: number;
  advancedReviewTimerDuration?: number | 'unlimited';
  advancedReviewMaxAttempts?: number | 'unlimited';

  // Glossary Challenge Settings
  glossaryChallengeMode?: 'standard' | 'advanced';
  advancedGlossarySubjectIds?: string[];
  advancedGlossaryTopicIds?: string[];
  glossaryChallengeQuestionCount?: number;
  glossaryChallengeTimerDuration?: number | 'unlimited';
  glossaryChallengeMaxAttempts?: number | 'unlimited';

  // Portuguese Challenge Settings
  portugueseChallengeQuestionCount?: number;
  portugueseChallengeTimerDuration?: number | 'unlimited';
  portugueseChallengeMaxAttempts?: number | 'unlimited';
  portugueseErrorStats?: { [category: string]: { correct: number; incorrect: number; } };

  // Daily Challenge Data
  reviewChallenge?: DailyChallenge<Question>;
  glossaryChallenge?: DailyChallenge<Question>;
  portugueseChallenge?: DailyChallenge<Question>;
  gamesCompletedCount?: number;
  dailyChallengeStreak?: {
      current: number;
      longest: number;
      lastCompletedDate: string; // ISO Date 'YYYY-MM-DD'
  };
  dailyChallengeCompletions?: {
    [dateISO: string]: {
        review?: boolean;
        glossary?: boolean;
        portuguese?: boolean;
    }
  };
}


export interface QuestionAttempt {
  questionId: string;
  selectedAnswer: string;
  isCorrect: boolean;
}

export interface MessageReply {
    senderId: string;
    name: string;
    avatarUrl?: string;
    text: string;
    timestamp: number;
}

export interface TeacherMessage {
    id: string;
    teacherId: string;
    studentId?: string | null; // null for broadcasts
    message: string;
    timestamp: number;
    acknowledgedBy: string[]; // used for read receipts
    replies?: MessageReply[];
    lastReplyTimestamp?: number; // for sorting threads
    deletedBy?: string[]; // Array of UIDs who have "deleted" the chat from their view
    type?: 'system' | 'user'; // 'user' is default, 'system' for notifications
    context?: {
        studentName?: string;
        subjectName?: string;
        topicName?: string;
        questionStatement?: string;
    };
}


export interface StudyPlan {
    studentId: string;
    plan: {
      [dateISO: string]: string[]; // date 'YYYY-MM-DD', value is array of topic IDs
    }
}

export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}
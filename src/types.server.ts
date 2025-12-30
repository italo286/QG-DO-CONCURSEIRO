export type UserRole = 'aluno' | 'professor';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
}

export interface PdfFile {
  id: string;
  url: string;
  fileName: string;
}

export interface VideoFile {
  id: string;
  url: string;
  name: string;
}

export interface BankProfilePdf {
  id: string;
  url: string;
  bankName: string;
}

export interface Question {
  id: string;
  statement: string;
  options: string[];
  correctAnswer: string;
  justification: string;
  optionJustifications?: { [key: string]: string };
  imageUrl?: string;
  errorCategory?: string;
  reportInfo?: { reason: string; studentId: string };
  subjectId?: string;
  topicId?: string;
  subjectName?: string;
  topicName?: string;
  isTec?: boolean;
}

export interface QuestionAttempt {
  questionId: string;
  selectedAnswer: string;
  isCorrect: boolean;
  timestamp?: number;
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

export interface MiniGame {
  id: string;
  name: string;
  type: MiniGameType;
  data: MemoryGameData | AssociationGameData | OrderGameData | IntruderGameData | CategorizeGameData;
}

export type MiniGameType = 'memory' | 'association' | 'order' | 'intruder' | 'categorize';

export interface MemoryGameData {
  items: string[];
}

export interface AssociationGameData {
  pairs: { concept: string; definition: string }[];
}

export interface OrderGameData {
  description: string;
  items: string[];
}

export interface IntruderGameData {
  categoryName: string;
  correctItems: string[];
  intruder: string;
}

export interface CategorizeGameData {
  categories: { name: string; items: string[] }[];
}

export interface Topic {
  id: string;
  name: string;
  description: string;
  order?: number;
  fullPdfs: PdfFile[];
  summaryPdfs: PdfFile[];
  raioXPdfs?: PdfFile[];
  videoUrls: VideoFile[];
  questions: Question[];
  tecQuestions?: Question[];
  subtopics: SubTopic[];
  miniGames: MiniGame[];
  flashcards: Flashcard[];
  glossary: GlossaryTerm[];
  tecUrl?: string;
  mindMapUrl?: string;
  bankProfilePdfs?: BankProfilePdf[];
  color?: string;
}

export interface SubTopic {
  id: string;
  name: string;
  description: string;
  fullPdfs: PdfFile[];
  summaryPdfs: PdfFile[];
  raioXPdfs?: PdfFile[];
  videoUrls: VideoFile[];
  questions: Question[];
  tecQuestions?: Question[];
  miniGames: MiniGame[];
  flashcards: Flashcard[];
  glossary: GlossaryTerm[];
  tecUrl?: string;
  mindMapUrl?: string;
  bankProfilePdfs?: BankProfilePdf[];
  color?: string;
}

export interface Subject {
  id: string;
  name: string;
  teacherId: string;
  description: string;
  topics: Topic[];
  color?: string;
}

export interface CourseDiscipline {
  subjectId: string;
  excludedTopicIds: string[];
  topicFrequencies: { [id: string]: 'alta' | 'media' | 'baixa' | 'nenhuma' };
}

export interface EditalInfo {
  cargosEVagas: { cargo: string; vagas: string; cadastroReserva?: string }[];
  requisitosEscolaridade: string;
  bancaOrganizadora: string;
  formatoProva: string;
  distribuicaoQuestoes: { disciplina: string; quantidade: number }[];
  totalQuestoes: number;
  remuneracao: string;
  dataProva: string;
}

export interface Course {
  id: string;
  name: string;
  teacherId: string;
  disciplines: CourseDiscipline[];
  enrolledStudentIds: string[];
  imageUrl?: string;
  editalInfo?: EditalInfo;
  youtubeCarousel?: VideoFile[];
}

export interface DailyChallenge<T> {
  date: string;
  items: T[];
  isCompleted: boolean;
  attemptsMade: number;
  sessionAttempts: QuestionAttempt[];
}

export interface ReviewSession {
  id: string;
  name: string;
  type: 'standard' | 'ai' | 'srs' | 'manual';
  createdAt: number;
  questions: Question[];
  isCompleted: boolean;
  attempts?: QuestionAttempt[];
}

export interface CustomQuiz {
  id: string;
  name: string;
  questions: Question[];
  isCompleted: boolean;
  createdAt: number;
  attempts?: QuestionAttempt[];
}

export interface SimuladoConfig {
  subjects: { subjectId: string, questionCount: number }[];
  filter: 'unanswered' | 'incorrect' | 'correct' | 'answered' | 'mixed';
  durationInSeconds: number;
  feedbackMode: 'immediate' | 'at_end';
}

export interface Simulado {
  id: string;
  name: string;
  questions: Question[];
  isCompleted: boolean;
  createdAt: number;
  attempts?: QuestionAttempt[];
  config: SimuladoConfig;
}

export interface StudentProgress {
  studentId: string;
  progressByTopic: { [subjectId: string]: { [topicId: string]: { completed: boolean, score: number, lastAttempt: QuestionAttempt[] } } };
  reviewSessions: ReviewSession[];
  xp: number;
  earnedBadgeIds: string[];
  notesByTopic: { [topicId: string]: string };
  dailyActivity: { [dateISO: string]: { questionsAnswered: number } };
  srsData: { [questionId: string]: { stage: number, nextReviewDate: string } };
  customGames: MiniGame[];
  earnedTopicBadgeIds: { [topicId: string]: string[] };
  earnedGameBadgeIds: { [topicId: string]: string[] };
  customQuizzes: CustomQuiz[];
  targetCargoByCourse: { [courseId: string]: string };
  aiGeneratedFlashcards: Flashcard[];
  srsFlashcardData: { [flashcardId: string]: { stage: number, nextReviewDate: string } };
  dailyReviewMode: 'standard' | 'advanced';
  advancedReviewSubjectIds: string[];
  advancedReviewTopicIds: string[];
  advancedReviewQuestionType: 'incorrect' | 'correct' | 'unanswered' | 'mixed';
  advancedReviewQuestionCount: number;
  advancedReviewTimerDuration: number | 'unlimited';
  advancedReviewMaxAttempts: number | 'unlimited';
  glossaryChallengeMode: 'standard' | 'advanced';
  advancedGlossarySubjectIds: string[];
  advancedGlossaryTopicIds: string[];
  glossaryChallengeQuestionCount: number;
  glossaryChallengeTimerDuration: number | 'unlimited';
  glossaryChallengeMaxAttempts: number | 'unlimited';
  portugueseChallengeQuestionCount: number;
  portugueseChallengeTimerDuration: number | 'unlimited';
  portugueseChallengeMaxAttempts: number | 'unlimited';
  portugueseErrorStats: { [category: string]: number };
  gamesCompletedCount: number;
  dailyChallengeStreak: { current: number, longest: number, lastCompletedDate: string };
  dailyChallengeCompletions: { [dateISO: string]: { [type: string]: boolean } };
  reviewChallenge?: DailyChallenge<Question>;
  glossaryChallenge?: DailyChallenge<Question>;
  portugueseChallenge?: DailyChallenge<Question>;
  simulados?: Simulado[];
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
  studentId: string | null;
  message: string;
  timestamp: number;
  acknowledgedBy: string[];
  replies: MessageReply[];
  lastReplyTimestamp: number;
  deletedBy: string[];
  type?: 'system';
  context?: any;
}

export interface StudyPlanItem {
  id: string;
  name: string;
  type: 'standard';
  settings: {
    recurrence: 'weekly' | 'once';
    notifications: boolean;
    intensity: 'light' | 'moderate' | 'hardcore';
  };
  weeklyRoutine: {
      [day: number]: {
          [time: string]: string;
      };
  };
}

export interface StudyPlan {
    studentId: string;
    activePlanId?: string;
    plans: StudyPlanItem[];
    // Legacy support for migration
    plan?: {
      [dateISO: string]: string[];
    };
}

export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

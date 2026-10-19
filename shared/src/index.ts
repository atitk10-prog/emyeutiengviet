import { z } from 'zod';

// ==========================================
// 1. DOMAIN ENUMS & LITERALS
// ==========================================

export type Grade = 2 | 3;
export const GRADES: Grade[] = [2, 3];

export type QuestionType = 'multiple_choice' | 'true_false' | 'sequence';
export const QUESTION_TYPES: QuestionType[] = ['multiple_choice', 'true_false', 'sequence'];

export type DifficultyLevel = 'nhan_biet' | 'thong_hieu' | 'van_dung';
export const DIFFICULTY_LEVELS: DifficultyLevel[] = ['nhan_biet', 'thong_hieu', 'van_dung'];

export type SkillTag =
  | 'thong_tin_truc_tiep'
  | 'tu_trong_ngu_canh'
  | 'noi_dung_chinh'
  | 'sap_xep_trinh_tu'
  | 'lien_he_van_dung';

export const SKILL_TAGS: SkillTag[] = [
  'thong_tin_truc_tiep',
  'tu_trong_ngu_canh',
  'noi_dung_chinh',
  'sap_xep_trinh_tu',
  'lien_he_van_dung'
];

export const SKILL_LABELS: Record<SkillTag, string> = {
  thong_tin_truc_tiep: 'Tìm thông tin trực tiếp',
  tu_trong_ngu_canh: 'Hiểu từ trong ngữ cảnh',
  noi_dung_chinh: 'Hiểu nội dung chính',
  sap_xep_trinh_tu: 'Sắp xếp trình tự',
  lien_he_van_dung: 'Liên hệ / Vận dụng đơn giản'
};

export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  nhan_biet: 'Nhận biết',
  thong_hieu: 'Thông hiểu',
  van_dung: 'Vận dụng'
};

export const QUESTION_TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'Trắc nghiệm A/B/C',
  true_false: 'Đúng / Sai',
  sequence: 'Sắp xếp sự việc'
};

// ==========================================
// 2. VOCABULARY & QUESTIONS
// ==========================================

export interface VocabularyItem {
  word: string;
  meaning: string;
  example: string;
}

export const VocabularyItemSchema = z.object({
  word: z.string().min(1, 'Từ không được để trống'),
  meaning: z.string().min(1, 'Nghĩa của từ không được để trống'),
  example: z.string().default('')
});

export interface PublicQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: string[]; // Exactly 3 options for multiple_choice (A, B, C)
  statement?: string; // For true_false question
  items?: string[]; // 3 items for sequence
  skillTag: SkillTag;
  difficulty: DifficultyLevel;
  relatedPassagePart?: string;
}

export interface QuestionAnswerDetail {
  correctAnswer: string | boolean | string[]; // 'A'|'B'|'C', true|false, or string[] in correct chronological order
  hint: string;
  explanation: string;
  scoringRules?: Record<string, any>;
}

export interface PrivateAnswerKey {
  versionId: string;
  answers: Record<string, QuestionAnswerDetail>;
  createdAt: number;
}

// Full question format returned by AI or manual authoring before splitting
export interface FullAuthoringQuestion extends PublicQuestion {
  answer: string | boolean | string[];
  hint: string;
  explanation: string;
}

export const FullAuthoringQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(['multiple_choice', 'true_false', 'sequence']),
  prompt: z.string().min(3, 'Câu hỏi quá ngắn'),
  options: z.array(z.string()).optional(),
  statement: z.string().optional(),
  items: z.array(z.string()).optional(),
  skillTag: z.enum([
    'thong_tin_truc_tiep',
    'tu_trong_ngu_canh',
    'noi_dung_chinh',
    'sap_xep_trinh_tu',
    'lien_he_van_dung'
  ]),
  difficulty: z.enum(['nhan_biet', 'thong_hieu', 'van_dung']),
  relatedPassagePart: z.string().optional(),
  answer: z.union([z.string(), z.boolean(), z.array(z.string())]),
  hint: z.string().min(3, 'Gợi ý cần có ý nghĩa sư phạm'),
  explanation: z.string().min(3, 'Giải thích cần rõ ràng cho học sinh')
}).superRefine((data, ctx) => {
  if (data.type === 'multiple_choice') {
    if (!data.options || data.options.length !== 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Trắc nghiệm phải có đúng 3 lựa chọn (A, B, C)',
        path: ['options']
      });
    }
  } else if (data.type === 'sequence') {
    if (!data.items || data.items.length !== 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Bài tập sắp xếp phải có đúng 3 sự việc',
        path: ['items']
      });
    }
  }
});

export type TextGenre = 'narrative' | 'informational' | 'poetry' | 'descriptive';
export const TEXT_GENRES: TextGenre[] = ['narrative', 'informational', 'poetry', 'descriptive'];
export const TEXT_GENRE_LABELS: Record<TextGenre, string> = {
  narrative: 'Văn bản tự sự (Truyện kể)',
  informational: 'Văn bản thông tin',
  poetry: 'Thơ ca',
  descriptive: 'Văn miêu tả'
};

export type LessonVerificationStatus = 'verified_sgk' | 'ai_curriculum_aligned' | 'teacher_created';

export const AudioMetadataSchema = z.object({
  lessonId: z.string().optional(),
  lessonVersionId: z.string().optional(),
  storagePath: z.string(),
  audioUrl: z.string().optional(),
  downloadUrl: z.string(),
  engine: z.enum(['gemini_tts', 'teacher_upload', 'piper_tts', 'vieneu_tts', 'speech_synthesis', 'sample_synthetic']).optional(),
  model: z.string().optional(),
  voiceId: z.string().optional(),
  duration: z.number().optional(),
  durationSeconds: z.number().optional(),
  size: z.number().optional(),
  sizeBytes: z.number().optional(),
  status: z.enum(['approved', 'pending', 'pending_approval', 'draft', 'rejected']).optional(),
  createdAt: z.string().optional(),
  uploadedBy: z.string().optional(),
  uploadedAt: z.string().optional(),
  fileName: z.string().optional(),
  mimeType: z.string().optional(),
  approvalStatus: z.enum(['approved', 'pending_review', 'rejected']).optional(),
  voiceType: z.enum(['teacher_voice', 'piper_tts', 'vieneu_tts', 'gemini_tts', 'sample_synthetic']).optional(),
  versionNumber: z.number().optional(),
  passageHash: z.string().optional()
});

// Full Lesson Draft Schema from AI or Authoring Form
export const LessonDraftSchema = z.object({
  lessonId: z.string().optional(),
  title: z.string().min(3, 'Tiêu đề bài đọc không được để trống'),
  passage: z.string().min(50, 'Bài đọc quá ngắn (tối thiểu 50 từ)'),
  grade: z.union([z.literal(2), z.literal(3)]),
  semester: z.union([z.literal(1), z.literal(2)]).default(1),
  week: z.number().min(1).max(35).default(1),
  topic: z.string().min(2, 'Chủ đề không được để trống'),
  genre: z.enum(['narrative', 'informational', 'poetry', 'descriptive']).default('narrative'),
  curriculumRequirement: z.string().optional(),
  source: z.string().default('ai_curriculum_aligned'),
  referenceSource: z.string().optional(),
  verificationStatus: z.enum(['verified_sgk', 'ai_curriculum_aligned', 'teacher_created']).default('ai_curriculum_aligned'),
  vocabulary: z.array(VocabularyItemSchema).default([]),
  audioUrl: z.string().optional(),
  audioMetadata: AudioMetadataSchema.optional(),
  questions: z.array(FullAuthoringQuestionSchema).min(1, 'Bài đọc cần tối thiểu 1 câu hỏi').max(20, 'Tối đa 20 câu hỏi'),
  status: z.enum(['draft', 'review', 'published', 'archived']).optional(),
  academicYearScope: z.enum(['shared', 'specific']).default('shared').optional(),
  academicYear: z.string().nullable().optional()
});

export type LessonDraftInput = z.infer<typeof LessonDraftSchema>;

export interface AudioMetadata {
  lessonId?: string;
  lessonVersionId?: string;
  storagePath: string;
  audioUrl?: string;
  downloadUrl: string;
  engine?: 'gemini_tts' | 'teacher_upload' | 'piper_tts' | 'vieneu_tts' | 'speech_synthesis' | 'sample_synthetic';
  model?: string;
  voiceId?: string;
  duration?: number;
  durationSeconds?: number;
  size?: number;
  sizeBytes?: number;
  status?: 'approved' | 'pending' | 'pending_approval' | 'draft' | 'rejected';
  createdAt?: string;
  uploadedAt?: string;
  uploadedBy?: string;
  fileName?: string;
  mimeType?: string;
  approvalStatus?: 'approved' | 'pending_review' | 'rejected';
  voiceType?: 'teacher_voice' | 'piper_tts' | 'vieneu_tts' | 'gemini_tts' | 'sample_synthetic';
  versionNumber?: number;
  passageHash?: string;
}

// ==========================================
// 3. LESSON & VERSIONS IN FIRESTORE
// ==========================================

export type LessonStatus = 'draft' | 'review' | 'published' | 'archived';

export interface Lesson {
  id: string;
  teacherUid: string;
  title: string;
  topic: string;
  grade: Grade;
  semester?: 1 | 2;
  week?: number;
  genre?: TextGenre;
  academicYearScope?: 'shared' | 'specific';
  academicYear?: string | null;
  curriculumRequirement?: string;
  source?: string;
  referenceSource?: string;
  verificationStatus?: LessonVerificationStatus;
  status: LessonStatus;
  currentVersionId: string;
  currentVersionNumber?: number;
  totalVersions?: number;
  totalQuestions?: number;
  assignedClassCount?: number;
  draftData?: LessonDraftInput | null;
  approvedAt?: number | null;
  approvedBy?: string | null;
  audioUrl?: string;
  audioMetadata?: AudioMetadata;
  createdAt: number;
  updatedAt: number;
}

export interface LessonVersion {
  versionId: string;
  lessonId: string;
  versionNumber: number;
  passage: string;
  vocabulary: VocabularyItem[];
  publicQuestions: PublicQuestion[];
  grade: Grade;
  semester?: 1 | 2;
  week?: number;
  genre?: TextGenre;
  academicYearScope?: 'shared' | 'specific';
  academicYear?: string | null;
  curriculumRequirement?: string;
  source?: string;
  referenceSource?: string;
  verificationStatus?: LessonVerificationStatus;
  topic: string;
  title: string;
  skillTags: SkillTag[];
  audioUrl?: string;
  audioMetadata?: AudioMetadata;
  totalQuestions?: number;
  publishedAt: number | null;
  approvedAt?: number | null;
  approvedBy?: string | null;
  createdAt: number;
}

// ==========================================
// 4. CLASSROOM & STUDENTS
// ==========================================

export interface Classroom {
  id: string;
  teacherUid: string;
  name: string;
  grade: Grade;
  classCode: string; // 6-digit uppercase alphanumeric, e.g., 'TV2024'
  academicYear?: string; // e.g. '2025-2026'
  status: 'active' | 'archived';
  studentCount?: number;
  updatedAt?: number;
  teacherName?: string;
  createdAt: number;
}

export interface Student {
  id: string;
  classId: string;
  studentCode: string; // School ID / code assigned by teacher
  displayAlias: string; // Child-friendly name or pseudonym, e.g. "Họa Mi", "Sơn Ca"
  status: 'active' | 'archived' | 'suspended';
  lastPinRotatedAt?: number;
  previousClassId?: string;
  transferredAt?: number;
  updatedAt?: number;
  createdAt: number;
}

export interface StudentSecret {
  studentId: string;
  accessCodeHash: string; // Salted SHA-256 hash of the 6-character access pin
  salt: string;
  rotatedAt: number;
}

export interface StudentSession {
  authUid: string;
  studentId: string;
  classId: string;
  displayAlias: string;
  validUntil: number;
  revokedAt?: number | null;
  createdAt: number;
}

// ==========================================
// 5. ASSIGNMENTS & ATTEMPTS
// ==========================================

export interface Assignment {
  id: string;
  classId: string;
  academicYear?: string;
  lessonId: string;
  lessonVersionId: string;
  teacherUid: string;
  lessonTitle: string;
  grade: Grade;
  topic: string;
  availableFrom: number;
  availableUntil: number | null;
  maxAttempts: number;
  isPreTest?: boolean; // For paired Pre/Post assessment
  isPostTest?: boolean; // For paired Pre/Post assessment
  pairedAssessmentId?: string; // Links pre and post assignments
  roundName?: string; // Optional custom round, e.g., "Đợt 1", "Luyện tập lần 2"
  isDuplicatePrevented?: boolean;
  status: 'active' | 'closed';
  createdAt: number;
}

export interface Attempt {
  id: string;
  studentId: string;
  classId: string;
  assignmentId: string;
  lessonId: string;
  lessonVersionId: string;
  teacherUid: string;
  startedAt: number;
  completedAt: number | null;
  status: 'in_progress' | 'completed';
  firstTryCorrectCount: number;
  finalCorrectCount: number;
  hintCount: number;
  totalQuestions: number;
  starsEarned: number;
  scorePercentage: number;
  primaryScore?: number; // Điểm luyện tập chính thang 10 = (firstTryCorrectCount / totalQuestions) * 10
  finalScore?: number; // Điểm sau gợi ý thang 10 = (finalCorrectCount / totalQuestions) * 10
  progressCount?: number; // finalCorrectCount - firstTryCorrectCount
  progressPercentagePoints?: number; // ((finalCorrectCount - firstTryCorrectCount) / totalQuestions) * 100
  firstTryScorePercentage?: number; // (firstTryCorrectCount / totalQuestions) * 100
  idempotencyKey?: string;
}

export interface AttemptResponseRecord {
  questionId: string;
  firstAnswer: any;
  retryAnswer?: any;
  firstTryCorrect: boolean;
  finalCorrect: boolean;
  hintUsed: boolean;
  hintSent?: string;
  explanationSent?: string;
  recordedAt: number;
}

// ==========================================
// 6. CALLABLE FUNCTIONS CONTRACTS
// ==========================================

export interface JoinClassRequest {
  classCode: string;
  accessCode: string;
}

export interface JoinClassResponse {
  success: boolean;
  student: {
    id: string;
    displayAlias: string;
    classId: string;
    className: string;
    grade: Grade;
  };
  token?: string; // Optional custom token or session acknowledgment
}

export interface StartAttemptRequest {
  assignmentId: string;
  idempotencyKey?: string;
}

export interface StartAttemptResponse {
  attemptId: string;
  assignment: Assignment;
  lessonVersion: LessonVersion;
  alreadyCompleted?: boolean;
}

export interface SubmitAnswerRequest {
  attemptId: string;
  questionId: string;
  answer: string | boolean | string[];
  phase: 'first_try' | 'retry';
  requestId: string; // Idempotency per question submission
}

export interface SubmitAnswerResponse {
  correct: boolean;
  isFirstTry: boolean;
  hint?: string; // Only sent if phase is 'first_try' and answer is incorrect!
  canRetry: boolean;
  explanation?: string; // Only sent after final attempt or if correct
  correctAnswer?: string | boolean | string[]; // Only sent after final attempt or if correct
}

export interface FinishAttemptRequest {
  attemptId: string;
  idempotencyKey: string;
}

export interface FinishAttemptResponse {
  success: boolean;
  attempt: Attempt;
  responses: Record<string, AttemptResponseRecord>;
}

export interface GenerateLessonAIRequest {
  grade: Grade;
  topic: string;
  genre?: 'narrative' | 'informational';
  readingGoal?: string;
  targetWordCount?: number;
  difficulty?: DifficultyLevel;
  questionCount?: number;
  customVocabulary?: string[];
  localContext?: string;
}

export interface RemediationQuestionInsight {
  questionId: string;
  prompt: string;
  skillTag: SkillTag;
  skillLabel: string;
  testedCount: number;
  incorrectCount: number;
  incorrectPercentage: number;
}

export interface RemediationSkillDetail {
  skillTag: SkillTag;
  label: string;
  testedCount: number;
  firstTryCorrectCount: number;
  finalCorrectCount: number;
  firstTryAccuracy: number | null; // null if testedCount === 0
  finalAccuracy: number | null;
  progressPercentagePoints: number | null;
  studentsNeedingHelp: number;
  status: 'good' | 'needs_remediation' | 'no_data';
}

export interface RemediationClassStatistics {
  classId: string;
  className: string;
  grade: number;
  academicYear: string;
  semester?: number | string;
  totalStudents: number;
  participatedStudents: number;
  notParticipatedStudents: number;
  completionRate: number;
  totalAttempts: number;
  assignedLessonsCount: number;
  avgFirstTryAccuracy: number;
  avgFinalAccuracy: number;
  avgProgressPoints: number;
  skills: RemediationSkillDetail[];
  goodSkills: RemediationSkillDetail[];
  weakSkills: RemediationSkillDetail[];
  untestedSkills: RemediationSkillDetail[];
  highErrorQuestions: RemediationQuestionInsight[];
  updatedAt: number;
}

// ==========================================
// 7. REMEDIATION & MULTI-DIMENSIONAL ANALYSIS (V5.6)
// ==========================================

export type AnalysisScope =
  | 'toan_lop'               // 1. Toàn lớp
  | 'tung_hoc_sinh'          // 2. Từng học sinh
  | 'nhom_hoc_sinh'          // 3. Nhóm học sinh cần hỗ trợ hoặc phát triển
  | 'bai_doc_va_dot_giao'    // 4. Từng bài đọc và đợt giao bài
  | 'tung_ky_nang'           // 5. Từng kỹ năng đọc hiểu
  | 'tung_cau_hoi'           // 6. Từng câu hỏi và dạng câu hỏi
  | 'tien_bo';               // 7. Tiến bộ qua các lần luyện tập, tuần và học kỳ

export const ANALYSIS_SCOPE_LABELS: Record<AnalysisScope, string> = {
  toan_lop: 'Toàn lớp',
  tung_hoc_sinh: 'Từng học sinh',
  nhom_hoc_sinh: 'Nhóm phân hóa học sinh',
  bai_doc_va_dot_giao: 'Từng bài đọc & đợt giao',
  tung_ky_nang: 'Từng kỹ năng đọc hiểu',
  tung_cau_hoi: 'Từng câu hỏi & dạng bài',
  tien_bo: 'Tiến bộ qua các lần luyện'
};

export const ANALYSIS_SCOPE_DESCRIPTIONS: Record<AnalysisScope, string> = {
  toan_lop: 'Tổng quan kết quả đọc hiểu của toàn bộ học sinh trong lớp',
  tung_hoc_sinh: 'Hồ sơ năng lực, kết quả làm bài và tiến bộ của từng cá nhân',
  nhom_hoc_sinh: 'Phân nhóm cần hỗ trợ (< 70%) và nhóm phát triển năng khiếu',
  bai_doc_va_dot_giao: 'Phân tích kết quả theo bài đọc và vòng đời giao bài cụ thể',
  tung_ky_nang: 'Đào sâu 5 năng lực đọc hiểu cốt lõi theo chuẩn GDPT 2018',
  tung_cau_hoi: 'Thống kê tỷ lệ sai sót theo dạng trắc nghiệm, đúng/sai, sắp xếp',
  tien_bo: 'Theo dõi chỉ số tăng trưởng (+% điểm pp) từ lần 1 sang lần sau gợi ý'
};

export const ANALYSIS_SCOPE_DETAILS: Record<AnalysisScope, { label: string; desc: string }> = {
  toan_lop: { label: 'Toàn lớp', desc: 'Tổng quan kết quả đọc hiểu của toàn bộ học sinh trong lớp' },
  tung_hoc_sinh: { label: 'Từng học sinh', desc: 'Hồ sơ năng lực, kết quả làm bài và tiến bộ của từng cá nhân' },
  nhom_hoc_sinh: { label: 'Nhóm học sinh', desc: 'Phân nhóm cần hỗ trợ (< 70%) và nhóm phát triển năng khiếu' },
  bai_doc_va_dot_giao: { label: 'Từng bài đọc & đợt giao', desc: 'Phân tích kết quả theo bài đọc và vòng đời giao bài cụ thể' },
  tung_ky_nang: { label: 'Từng kỹ năng đọc hiểu', desc: 'Đào sâu 5 năng lực đọc hiểu cốt lõi theo chuẩn GDPT 2018' },
  tung_cau_hoi: { label: 'Từng câu hỏi & dạng bài', desc: 'Thống kê tỷ lệ sai sót theo dạng trắc nghiệm, đúng/sai, sắp xếp' },
  tien_bo: { label: 'Tiến bộ qua các lần luyện', desc: 'Theo dõi chỉ số tăng trưởng (+% điểm pp) từ lần 1 sang lần sau gợi ý' }
};

export function getAnalysisScopeLabel(scope?: AnalysisScope | string | null): string {
  if (!scope) return 'Toàn lớp';
  const val = (ANALYSIS_SCOPE_LABELS as any)[scope];
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object' && val.label) return val.label;
  return String(scope);
}

export type RemediationActivityType =
  | 'truy_tim_nghia_tu'       // 1. Truy tìm nghĩa của từ
  | 'xep_tranh_trinh_tu'      // 2. Xếp tranh theo trình tự
  | 'san_kho_bau_doc_hieu'    // 3. Săn kho báu đọc hiểu
  | 'ghep_cau_voi_tranh'      // 4. Ghép câu với tranh
  | 'dung_hay_sai'            // 5. Đúng hay sai
  | 'phong_vien_nhi'          // 6. Phóng viên nhí
  | 'ke_tiep_cau_chuyen'      // 7. Kể tiếp câu chuyện
  | 'phieu_hoc_tap_so_do';    // 8. Phiếu học tập và sơ đồ tư duy

export const REMEDIATION_ACTIVITY_LABELS: Record<RemediationActivityType, { title: string; defaultSkill: SkillTag; desc: string }> = {
  truy_tim_nghia_tu: {
    title: 'Truy tìm nghĩa của từ',
    defaultSkill: 'tu_trong_ngu_canh',
    desc: 'Trò chơi thám tử ngữ cảnh: ghép từ mới với giải nghĩa và hình ảnh'
  },
  xep_tranh_trinh_tu: {
    title: 'Xếp tranh theo trình tự',
    defaultSkill: 'sap_xep_trinh_tu',
    desc: 'Sắp xếp 3–4 sự việc/tranh minh họa theo đúng diễn biến câu chuyện'
  },
  san_kho_bau_doc_hieu: {
    title: 'Săn kho báu đọc hiểu',
    defaultSkill: 'thong_tin_truc_tiep',
    desc: 'Tìm kiếm chi tiết, thời gian, địa điểm hoặc nhân vật trong bài đọc'
  },
  ghep_cau_voi_tranh: {
    title: 'Ghép câu với tranh',
    defaultSkill: 'thong_tin_truc_tiep',
    desc: 'Đọc câu văn và ghép tương ứng với tình huống hoặc hình ảnh minh họa'
  },
  dung_hay_sai: {
    title: 'Đúng hay sai',
    defaultSkill: 'noi_dung_chinh',
    desc: 'Trọng tài nhí xác thực các nhận định cốt lõi và phát hiện chi tiết gây nhiễu'
  },
  phong_vien_nhi: {
    title: 'Phóng viên nhí',
    defaultSkill: 'lien_he_van_dung',
    desc: 'Đóng vai phỏng vấn nhân vật và rút ra bài học liên hệ bản thân'
  },
  ke_tiep_cau_chuyen: {
    title: 'Kể tiếp câu chuyện',
    defaultSkill: 'lien_he_van_dung',
    desc: 'Tưởng tượng diễn biến mở rộng và sáng tạo lời thoại có ý nghĩa'
  },
  phieu_hoc_tap_so_do: {
    title: 'Phiếu học tập & sơ đồ tư duy',
    defaultSkill: 'noi_dung_chinh',
    desc: 'Sơ đồ mạng ý tưởng hệ thống hóa bài học và thông điệp toàn bài'
  }
};

export interface RemediationActivity {
  id: string;
  teacherId?: string;
  teacherUid?: string;
  teacherName?: string;
  academicYear?: string;
  grade?: number;
  classId?: string;
  className?: string;
  scope?: AnalysisScope;
  activityType: RemediationActivityType;
  title: string;
  targetAudience: string;
  targetSkill: SkillTag;
  skillObjective: string;
  sourceLessonId?: string;
  sourceLessonTitle?: string;
  sourceQuestionId?: string;
  durationMinutes: number;
  materialsNeeded: string[];
  teacherSteps: string[];
  contentPayload: {
    instructions: string;
    items?: Array<{
      id: string;
      prompt: string;
      answer: string;
      options?: string[];
      explanation?: string;
      hint?: string;
    }>;
    gameTemplate?: 'word_meaning_match' | 'sequence_order' | 'quiz_challenge' | 'worksheet_mindmap';
    gameData?: {
      pairs?: Array<{ word: string; meaning: string; example?: string }>;
      sequenceItems?: Array<{ order: number; text: string; hint?: string }>;
      mindmapNodes?: Array<{ label: string; details?: string }>;
    };
  };
  evaluationCriteria: string;
  description?: string; // Tương thích ngược với UI cũ
  suggestedFormat?: string; // Tương thích ngược với UI cũ
  status: 'draft' | 'approved' | 'assigned' | 'deployed';
  approvedAt?: number | null;
  approvedBy?: string | null;
  assignedAt?: number | null;
  createdAt: number;
  updatedAt?: number;
}

export interface RemediationSuggestionRequest {
  classId: string;
  academicYear?: string;
  semester?: 1 | 2 | 'all';
  scope?: AnalysisScope;
  targetStudentId?: string;
  targetSkill?: SkillTag;
  targetAssignmentId?: string;
  targetQuestionType?: QuestionType;
}

export interface RemediationSuggestionResponse {
  statistics?: RemediationClassStatistics;
  scope?: AnalysisScope;
  scopeSummary?: {
    scopeName: string;
    targetName?: string;
    targetDescription?: string;
    totalAttempts: number;
    totalStudents: number;
    avgScore: number;
    progressDelta: number;
    detailBadge?: string;
  };
  studentProfile?: {
    studentId: string;
    studentCode: string;
    displayAlias: string;
    totalAttempts: number;
    firstTryAvg: number;
    finalAvg: number;
    progressDelta: number;
    strongSkills: string[];
    weakSkills: string[];
    recentAttempts: Array<{
      attemptId: string;
      lessonTitle: string;
      firstScore: number;
      finalScore: number;
      progress: number;
      completedAt: number;
    }>;
  };
  studentGroups?: {
    supportGroup: Array<{ studentId: string; studentCode: string; displayAlias: string; avgAccuracy: number; reason: string }>;
    growthGroup: Array<{ studentId: string; studentCode: string; displayAlias: string; avgAccuracy: number; reason: string }>;
  };
  analysisSummary?: string;
  weakSkills: Array<{
    skillTag: SkillTag;
    label: string;
    accuracyFirstTry: number;
    studentsNeedingHelp: number;
  }>;
  goodSkills?: Array<{
    skillTag: SkillTag;
    label: string;
    accuracyFirstTry: number;
  }>;
  suggestedActivities: RemediationActivity[];
  highErrorQuestions?: RemediationQuestionInsight[];
  isAiGenerated: boolean;
  disclaimer: string;
}

export interface TeacherAnalyticsSummary {
  totalClasses?: number;
  totalStudents: number;
  totalAssignments: number;
  totalAttempts: number;
  avgFirstTryAccuracy: number;
  avgFinalAccuracy: number;
  avgFirstTryScore?: number;
  avgFinalScore?: number;
  avgProgressPoints?: number;
  totalQuestionsCount?: number;
  totalFirstTry?: number;
  totalFinal?: number;
  skillBreakdown: Record<
    SkillTag,
    {
      label: string;
      totalTested: number;
      firstTryCorrect: number;
      finalCorrect: number;
      firstTryPercentage?: number;
      finalPercentage?: number;
      progressPercentagePoints?: number;
      percentage: number;
    }
  >;
  pairedPrePostStats?: {
    pairedCount: number;
    preAvgPercentage: number;
    postAvgPercentage: number;
    percentagePointDiff: number;
  };
}

// ==========================================
// 8. AI SERVICE STATUS & DIAGNOSTICS (v4.0)
// ==========================================

export type AIConfigStatusType =
  | 'NOT_CONFIGURED'     // Chưa cấu hình khóa API phía backend
  | 'READY_UNVERIFIED'   // Đã có khóa, sẵn sàng nhưng chưa có kiểm thử hợp lệ
  | 'VERIFIED'           // Đã gọi API thực thành công và trả về kết quả hợp lệ
  | 'UNAVAILABLE';       // Khóa sai (401/403), model không hỗ trợ (404), hết quota (429) hoặc lỗi mạng

export interface AIServiceStatus {
  status: AIConfigStatusType;
  isConfigured: boolean;
  provider: 'gemini' | 'none';
  model: string;
  activeModel?: string;
  message?: string;
  lastVerifiedAt?: number | null;
  lastLatencyMs?: number | null;
  lastErrorCode?: string | null;
}

// ==========================================
// 9. USER ROLES & PROFILES
// ==========================================

export type UserRole = 'admin' | 'teacher' | 'student';
export const USER_ROLES: UserRole[] = ['admin', 'teacher', 'student'];

export interface UserProfile {
  uid: string;
  email?: string;
  displayName: string;
  role: UserRole;
  status: 'active' | 'suspended' | 'pending';
  createdAt: number;
  lastLoginAt?: number;
}

// ==========================================
// 10. CURRICULUM ARCHITECTURE (GRADES 1–5 GDPT)
// ==========================================

export type CurriculumGrade = 1 | 2 | 3 | 4 | 5;
export const CURRICULUM_GRADES: CurriculumGrade[] = [1, 2, 3, 4, 5];

export type BookSeries = 'ket_noi_tri_thuc';
export const BOOK_SERIES_LABELS: Record<BookSeries, string> = {
  ket_noi_tri_thuc: 'Kết nối tri thức với cuộc sống'
};

export type BookVolume = 1 | 2;

export type ActivityType =
  | 'doc'
  | 'viet'
  | 'noi_va_nghe'
  | 'kien_thuc_tieng_viet';

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  doc: 'Đọc hiểu',
  viet: 'Viết',
  noi_va_nghe: 'Nói và nghe',
  kien_thuc_tieng_viet: 'Kiến thức Tiếng Việt'
};

export type CurriculumVerificationStatus = 'verified' | 'drafted' | 'reference_only';

export interface CurriculumNode {
  id: string;
  bookSeries: BookSeries;
  grade: CurriculumGrade;
  volume: BookVolume;
  theme: string;
  week: number;
  lessonTitle: string;
  activityType: ActivityType;
  competencyGoals: string[];
  suggestedPassageTopic?: string;
  sampleVocabulary?: string[];
  referenceSource: string;
  verificationStatus: CurriculumVerificationStatus;
  dataVersion: string;
  createdAt: number;
}

export const CurriculumNodeSchema = z.object({
  id: z.string().min(1),
  bookSeries: z.literal('ket_noi_tri_thuc').default('ket_noi_tri_thuc'),
  grade: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  volume: z.union([z.literal(1), z.literal(2)]),
  theme: z.string().min(2),
  week: z.number().int().min(1).max(35),
  lessonTitle: z.string().min(2),
  activityType: z.enum(['doc', 'viet', 'noi_va_nghe', 'kien_thuc_tieng_viet']),
  competencyGoals: z.array(z.string()).min(1),
  suggestedPassageTopic: z.string().optional(),
  sampleVocabulary: z.array(z.string()).optional(),
  referenceSource: z.string().min(3),
  verificationStatus: z.enum(['verified', 'drafted', 'reference_only']),
  dataVersion: z.string().default('2018.v1')
});

export interface AcademicYearBreakdown {
  academicYear: string;
  totalClasses: number;
  activeClasses: number;
  totalStudents: number;
}

export interface AcademicYearItem {
  id: string;
  code: string;
  name: string;
  isCurrent: boolean;
  periodType: 'past' | 'current' | 'future';
  status: 'active' | 'archived';
  description?: string;
  startDate?: string;
  endDate?: string;
  totalClasses: number;
  activeClasses: number;
  totalStudents: number;
  canDelete: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AdminOverviewSummary {
  totalTeachers: number;
  activeTeachers: number;
  totalClasses: number;
  totalStudents: number;
  totalLessons: number;
  totalAttempts: number;
  aiServiceStatus: AIServiceStatus;
  curriculumCoverage: Record<CurriculumGrade, number>;
  academicYearsList?: string[];
  yearBreakdown?: AcademicYearBreakdown[];
}

// ==========================================
// 11. SYSTEM SETTINGS & CURRICULUM PROGRESS
// ==========================================

export interface CurriculumProgressConfig {
  currentAcademicYear: string;
  currentSemester: 1 | 2;
  currentWeek: number;
  maxWeeks: number;
  allowEarlyAccess: boolean;
  notes?: string;
  updatedAt: number;
  updatedBy?: string;
}

export const DEFAULT_CURRICULUM_PROGRESS: CurriculumProgressConfig = {
  currentAcademicYear: '2026-2027',
  currentSemester: 1,
  currentWeek: 7,
  maxWeeks: 35,
  allowEarlyAccess: true,
  notes: 'Tiến độ chuẩn hóa năm học 2026–2027: Tuần 7 (Học kỳ I)',
  updatedAt: 1792336000000,
  updatedBy: 'system_admin'
};


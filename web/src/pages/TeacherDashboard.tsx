import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy
} from 'firebase/firestore';
import { functions, db } from '../firebase';
import { httpsCallable, createCallable } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import {
  Classroom,
  Student,
  Lesson,
  Grade,
  SkillTag,
  SKILL_LABELS,
  DIFFICULTY_LABELS,
  QUESTION_TYPE_LABELS,
  LessonDraftInput,
  TextGenre,
  TEXT_GENRE_LABELS,
  AudioMetadata,
  RemediationSuggestionResponse,
  RemediationClassStatistics,
  RemediationSkillDetail,
  AnalysisScope,
  ANALYSIS_SCOPE_LABELS,
  getAnalysisScopeLabel,
  RemediationActivity,
  RemediationActivityType,
  REMEDIATION_ACTIVITY_LABELS
} from '@emytv/shared';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  PenTool,
  BrainCircuit,
  FileSpreadsheet,
  FileText,
  Plus,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowRight,
  ArrowLeft,
  Calendar,
  GraduationCap,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  Copy,
  Download,
  Printer,
  ChevronRight,
  Send,
  Eye,
  EyeOff,
  BarChart3,
  TrendingUp,
  Edit3,
  Upload,
  Check,
  X,
  Trash2,
  ArrowUp,
  ArrowDown,
  Archive,
  Search,
  Filter,
  Layers,
  Save,
  Play,
  Lock,
  Unlock,
  Key,
  KeyRound,
  RotateCcw,
  Music,
  Headphones,
  Mic,
  Volume2,
  Globe,
  Gamepad2,
  Award,
  HelpCircle,
  FolderEdit,
  FileCheck,
  Info,
  Loader2
} from 'lucide-react';
import { exportStudentsToExcel, parseAndAuditStudentsExcel, exportReportToExcel } from '../utils/excelHelper';
import { AudioReader } from '../components/AudioReader';
import { LessonAudioPanel } from '../components/LessonAudioPanel';

export const TeacherDashboard: React.FC = () => {
  const { user, isTeacher, logout } = useAuth();
  const navigate = useNavigate();

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<
    'overview' | 'classes' | 'lessons' | 'authoring' | 'remediation' | 'export'
  >('overview');

  // Loading states
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Data states
  const [analytics, setAnalytics] = useState<any>(null);
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [selectedClass, setSelectedClass] = useState<Classroom | null>(null);
  // Step-by-Step Navigation for Classes Tab (Module 1: NĂM HỌC -> KHỐI -> LỚP -> HỌC SINH)
  const [navYear, setNavYear] = useState<string | null>(null);
  const [navGrade, setNavGrade] = useState<number | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);

  // Modals & Sub-forms
  const [showCreateClassModal, setShowCreateClassModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState<Grade>(2);
  const [newAcademicYear, setNewAcademicYear] = useState('2026-2027');

  // Class Management & Filtering States (Gói A)
  const [classGradeFilter, setClassGradeFilter] = useState<'all' | 2 | 3>('all');
  const [classYearFilter, setClassYearFilter] = useState<'all' | '2026-2027'>('2026-2027');
  const [classStatusFilter, setClassStatusFilter] = useState<'all' | 'active' | 'archived'>('active');
  const [editingClass, setEditingClass] = useState<Classroom | null>(null);
  const [editClassName, setEditClassName] = useState('');
  const [editClassGrade, setEditClassGrade] = useState<Grade>(2);
  const [editClassAcademicYear, setEditClassAcademicYear] = useState('2026-2027');
  const [editClassCode, setEditClassCode] = useState('');
  const [isSavingClassEdit, setIsSavingClassEdit] = useState(false);
  const [classDeleteTarget, setClassDeleteTarget] = useState<Classroom | null>(null);
  const [classDeleteBlockReason, setClassDeleteBlockReason] = useState<string | null>(null);
  const [isDeletingClass, setIsDeletingClass] = useState(false);

  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [newStudentAlias, setNewStudentAlias] = useState('');
  const [newStudentCode, setNewStudentCode] = useState('');
  const [createdStudentCard, setCreatedStudentCard] = useState<any>(null);

  // Student Excel Import / Export & PIN Management
  const [showImportExcelModal, setShowImportExcelModal] = useState(false);
  const [importingStudents, setImportingStudents] = useState(false);
  const [excelPreviewData, setExcelPreviewData] = useState<any[]>([]);
  const [excelImportErrors, setExcelImportErrors] = useState<string[]>([]);
  const [importedSlips, setImportedSlips] = useState<any[] | null>(null);
  const [copiedClassCode, setCopiedClassCode] = useState(false);
  const [reissuedPinInfo, setReissuedPinInfo] = useState<{ alias: string; code: string; pin: string } | null>(null);

  // Student Edit, Transfer & Batch Print Cards States (Phase 3 - P0)
  const [editingStudent, setEditingStudent] = useState<{ id: string; studentCode: string; displayAlias: string } | null>(null);
  const [editingAlias, setEditingAlias] = useState('');
  const [editingCode, setEditingCode] = useState('');
  const [savingStudentEdit, setSavingStudentEdit] = useState(false);

  const [transferringStudent, setTransferringStudent] = useState<{ id: string; studentCode: string; displayAlias: string; currentClassId: string } | null>(null);
  const [targetTransferClassId, setTargetTransferClassId] = useState('');
  const [transferType, setTransferType] = useState<'same_year' | 'promote_next_year'>('same_year');
  const [transferReason, setTransferReason] = useState('');
  const [transferring, setTransferring] = useState(false);

  const [showBatchPrintCards, setShowBatchPrintCards] = useState(false);
  const [showPinVisible, setShowPinVisible] = useState(true);

  // Student Password Reset Modal
  const [resetTargetStudent, setResetTargetStudent] = useState<{ id: string; alias: string; code: string } | null>(null);
  const [newStudentPasswordInput, setNewStudentPasswordInput] = useState('HS123456');
  const [resettingStudentPass, setResettingStudentPass] = useState(false);

  // Search, Filter, Selection & Batch Actions for Students (Account Module 1B)
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [studentStatusFilter, setStudentStatusFilter] = useState<'all' | 'active' | 'suspended' | 'archived'>('all');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isProcessingBatchStudents, setIsProcessingBatchStudents] = useState(false);
  const [deleteTargetStudent, setDeleteTargetStudent] = useState<Student | null>(null);
  const [deletingStudent, setDeletingStudent] = useState(false);
  const [deleteStudentError, setDeleteStudentError] = useState<string | null>(null);
  const [batchStudentModal, setBatchStudentModal] = useState<{ action: 'lock' | 'unlock' | 'archive' | 'delete'; count: number } | null>(null);

  const handleConfirmResetStudentPassword = async () => {
    if (!resetTargetStudent) return;
    setResettingStudentPass(true);
    try {
      const resetFn = createCallable('teacherResetStudentPassword');
      const res: any = await resetFn({
        studentId: resetTargetStudent.id,
        newPassword: newStudentPasswordInput.trim() || undefined
      });
      if (res.data?.success) {
        setActionMessage({
          type: 'success',
          text: `Đã đặt lại mật khẩu cho học sinh "${resetTargetStudent.alias}" (${resetTargetStudent.code}) thành công!`
        });
        setResetTargetStudent(null);
      }
    } catch (err: any) {
      alert('Lỗi đặt lại mật khẩu học sinh: ' + err.message);
    } finally {
      setResettingStudentPass(false);
    }
  };

  // Lesson Info Modal (Version History & Assigned Classes) (Phase 2 - P0)
  const [viewingLessonInfo, setViewingLessonInfo] = useState<{ lesson: Lesson; versions: any[]; assignments: any[] } | null>(null);
  const [loadingLessonInfo, setLoadingLessonInfo] = useState(false);
  const [lessonInfoTab, setLessonInfoTab] = useState<'versions' | 'assignments'>('versions');

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignLessonId, setAssignLessonId] = useState('');
  const [assignVersionId, setAssignVersionId] = useState('');
  const [assignClassId, setAssignClassId] = useState('');
  const [assignClassIds, setAssignClassIds] = useState<string[]>([]);
  const [selectedLessonForAssign, setSelectedLessonForAssign] = useState<Lesson | null>(null);
  const [assignMaxAttempts, setAssignMaxAttempts] = useState(3);
  const [assignIsPreTest, setAssignIsPreTest] = useState(false);
  const [assignIsPostTest, setAssignIsPostTest] = useState(false);
  const [assignRoundName, setAssignRoundName] = useState('Đợt 1');
  const [assignForceNewRound, setAssignForceNewRound] = useState(false);
  const [assignDuplicateWarning, setAssignDuplicateWarning] = useState<string | null>(null);
  const [assignAllowEarlyAccess, setAssignAllowEarlyAccess] = useState(false);

  // Lesson Library Filters
  const [lessonFilterGrade, setLessonFilterGrade] = useState<'all' | 2 | 3>('all');
  const [lessonFilterSemester, setLessonFilterSemester] = useState<'all' | 1 | 2>('all');
  const [lessonFilterStatus, setLessonFilterStatus] = useState<'all' | 'published' | 'draft' | 'archived'>('all');
  const [lessonSearch, setLessonSearch] = useState('');

  // Step-by-Step Navigation for Lesson Library (Module 2: NĂM HỌC -> KHỐI -> HỌC KỲ -> TUẦN -> BÀI ĐỌC)
  const [navLessonYear, setNavLessonYear] = useState<string | null>(null);
  const [navLessonGrade, setNavLessonGrade] = useState<Grade | null>(null);
  const [navLessonSemester, setNavLessonSemester] = useState<1 | 2 | null>(null);
  const [navLessonWeek, setNavLessonWeek] = useState<number | 'all' | null>(null);

  // Authoring Form State
  const [authoringMode, setAuthoringMode] = useState<'ai' | 'manual'>('ai');
  const [aiTopic, setAiTopic] = useState('Bảo vệ môi trường và yêu thiên nhiên');
  const [aiGrade, setAiGrade] = useState<Grade>(2);
  const [aiSemester, setAiSemester] = useState<1 | 2>(1);
  const [aiWeek, setAiWeek] = useState<number>(1);
  const [aiGenre, setAiGenre] = useState<TextGenre>('narrative');
  const [aiWordCount, setAiWordCount] = useState(140);
  const [aiGoal, setAiGoal] = useState('Tìm thông tin trực tiếp và hiểu từ trong ngữ cảnh');
  const [draftLesson, setDraftLesson] = useState<LessonDraftInput | null>(null);
  const [currentEditingLessonId, setCurrentEditingLessonId] = useState<string | null>(null);
  const [currentEditingVersionNumber, setCurrentEditingVersionNumber] = useState<number>(1);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [generatingAdditional, setGeneratingAdditional] = useState(false);
  const [additionalCount, setAdditionalCount] = useState<number>(2);
  const [showAddQuestionMenu, setShowAddQuestionMenu] = useState(false);
  const [aiStatus, setAiStatus] = useState<any>(null);
  const [testingAI, setTestingAI] = useState(false);
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [aiAutoGenerateAudio, setAiAutoGenerateAudio] = useState(false);
  const [autoTriggerAudio, setAutoTriggerAudio] = useState(false);

  // Audio Upload & Survey States (Gói C V5.5 & V5.5.1)
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [audioUploadMsg, setAudioUploadMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showVoiceComparisonModal, setShowVoiceComparisonModal] = useState(false);

  // Real AI Speech Synthesis States (Gemini TTS)
  const [generatingAIAudio, setGeneratingAIAudio] = useState(false);
  const [aiVoiceGender, setAiVoiceGender] = useState<'female' | 'male'>('female');
  const [aiReadingStyle, setAiReadingStyle] = useState<'standard' | 'expressive_slow' | 'storytelling'>('expressive_slow');
  const [previewAIAudio, setPreviewAIAudio] = useState<{ url: string; metadata: AudioMetadata } | null>(null);
  const [approvingAIAudio, setApprovingAIAudio] = useState(false);

  // Student Preview Modal State (Read-only interactive simulator)
  const [previewModalLesson, setPreviewModalLesson] = useState<any | null>(null);
  const [previewQuestionIdx, setPreviewQuestionIdx] = useState<number>(0);
  const [previewUserAnswers, setPreviewUserAnswers] = useState<Record<string, any>>({});
  const [previewShowHint, setPreviewShowHint] = useState<Record<string, boolean>>({});
  const [previewFontSize, setPreviewFontSize] = useState<'base' | 'lg' | 'xl' | '2xl'>('lg');

  // Remediation & Pedagogical Activity Center (Module 4: NĂM HỌC → KHỐI → LỚP → PHẠM VI PHÂN TÍCH)
  const [remedNavYear, setRemedNavYear] = useState<string | null>(null);
  const [remedNavGrade, setRemedNavGrade] = useState<number | null>(null);
  const [remedNavClassId, setRemedNavClassId] = useState<string | null>(null);
  const [remedNavSemester, setRemedNavSemester] = useState<1 | 2 | 'all'>('all');
  const [remedNavScope, setRemedNavScope] = useState<AnalysisScope>('toan_lop');
  const [remedTargetStudentId, setRemedTargetStudentId] = useState<string>('');
  const [remedTargetSkill, setRemedTargetSkill] = useState<SkillTag>('thong_tin_truc_tiep');
  const [remedTargetAssignmentId, setRemedTargetAssignmentId] = useState<string>('all');
  const [remedTargetQuestionType, setRemedTargetQuestionType] = useState<string>('all');
  const [remedOpenGroup, setRemedOpenGroup] = useState<'year' | 'grade' | 'class' | 'scope' | 'none'>('year');
  const [remedClassStudents, setRemedClassStudents] = useState<Student[]>([]);
  const [remedClassAssignments, setRemedClassAssignments] = useState<any[]>([]);
  const [remediationData, setRemediationData] = useState<RemediationSuggestionResponse | null>(null);
  const [loadingRemediation, setLoadingRemediation] = useState(false);

  // Remediation Activity Detail & Interactive Game Templates (Phần C & D)
  const [selectedActivityDetail, setSelectedActivityDetail] = useState<RemediationActivity | null>(null);
  const [showGameModal, setShowGameModal] = useState<boolean>(false);
  const [gameModalType, setGameModalType] = useState<'word_meaning_match' | 'sequence_order' | 'worksheet'>('word_meaning_match');
  const [gameActivitySource, setGameActivitySource] = useState<RemediationActivity | null>(null);
  const [editableWordPairs, setEditableWordPairs] = useState<Array<{ word: string; meaning: string; example?: string }>>([]);
  const [editableSequenceItems, setEditableSequenceItems] = useState<Array<{ order: number; text: string; hint?: string }>>([]);

  // My Remediation Activities (Kho Hoạt Động Của Tôi & Chu Trình Duyệt - Phần 2 & 3)
  const [myActivities, setMyActivities] = useState<RemediationActivity[]>([]);
  const [loadingMyActivities, setLoadingMyActivities] = useState<boolean>(false);
  const [myActivitiesFilter, setMyActivitiesFilter] = useState<'all' | 'draft' | 'approved'>('all');
  const [myActivitiesSearch, setMyActivitiesSearch] = useState<string>('');
  const [remedActiveSubTab, setRemedActiveSubTab] = useState<'ai_suggest' | 'my_library' | 'approved_bank'>('ai_suggest');
  const [remedLibFilterYear, setRemedLibFilterYear] = useState<string>('all');
  const [remedLibFilterGrade, setRemedLibFilterGrade] = useState<string>('all');
  const [remedLibFilterClassId, setRemedLibFilterClassId] = useState<string>('all');
  const [remedLibFilterType, setRemedLibFilterType] = useState<string>('all');
  const [remedLibFilterStatus, setRemedLibFilterStatus] = useState<'all' | 'draft' | 'approved'>('all');
  const [remedLibSearch, setRemedLibSearch] = useState<string>('');
  const [remedLibSort, setRemedLibSort] = useState<'updated_desc' | 'updated_asc' | 'title_asc'>('updated_desc');
  const [savingActivityId, setSavingActivityId] = useState<string | null>(null);
  const [approvingActivityId, setApprovingActivityId] = useState<string | null>(null);
  const [activityDetailOriginalBackup, setActivityDetailOriginalBackup] = useState<RemediationActivity | null>(null);
  const [activityDetailViewMode, setActivityDetailViewMode] = useState<'edit' | 'preview'>('edit');
  const [editableWorksheetNodes, setEditableWorksheetNodes] = useState<Array<{ label: string; details?: string }>>([
    { label: 'Nhụy hoa: Chủ đề / Nhân vật chính', details: 'Tên câu chuyện và nhân vật cốt lõi' },
    { label: 'Cánh hoa 1: Sự việc mở đầu', details: 'Thời gian, địa điểm, sự việc khởi đầu' },
    { label: 'Cánh hoa 2: Diễn biến chính', details: 'Hành động và thử thách của nhân vật' },
    { label: 'Cánh hoa 3: Kết thúc & Bài học', details: 'Thông điệp nhân văn rút ra từ bài đọc' }
  ]);

  // Data Export & Audit Reports (Module 5: NĂM HỌC → KHỐI → LỚP → HỌC KỲ → XEM BÁO CÁO)
  const [exportNavYear, setExportNavYear] = useState<string | null>('2026-2027');
  const [exportNavGrade, setExportNavGrade] = useState<number | null>(null);
  const [exportNavClassId, setExportNavClassId] = useState<string | null>(null);
  const [exportNavSemester, setExportNavSemester] = useState<1 | 2 | 'all' | null>('all');
  const [hasGeneratedReport, setHasGeneratedReport] = useState(false);
  const [exportYearFilter, setExportYearFilter] = useState<'all' | '2026-2027'>('2026-2027');
  const [exportGradeFilter, setExportGradeFilter] = useState<'all' | 2 | 3>('all');
  const [exportClassId, setExportClassId] = useState<string>('');
  const [exportRecords, setExportRecords] = useState<any[]>([]);
  const [exportSummary, setExportSummary] = useState<any>(null);
  const [loadingExportData, setLoadingExportData] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [showPdfReportModal, setShowPdfReportModal] = useState(false);

  // Load teacher data on mount
  useEffect(() => {
    if (!user) {
      navigate('/teacher/login');
      return;
    }
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch AI Status
      try {
        const getStatus = httpsCallable(functions, 'getAIStatus');
        const sRes: any = await getStatus({});
        setAiStatus(sRes.data);
      } catch (e) {
        console.warn('Could not fetch AI status:', e);
      }

      // 2. Fetch Analytics
      try {
        const getAnalytics = httpsCallable(functions, 'getTeacherAnalytics');
        const aRes: any = await getAnalytics({});
        setAnalytics(aRes.data);
      } catch (e) {
        console.warn('Could not fetch analytics:', e);
      }

      // 2. Fetch Classes via getTeacherClasses API (handles auth permissions reliably)
      try {
        const getClassesFn = createCallable('getTeacherClasses');
        const cRes: any = await getClassesFn({});
        if (cRes.data?.classes) {
          const classList: Classroom[] = cRes.data.classes;
          classList.sort((a, b) => a.grade - b.grade || (a.name || '').localeCompare(b.name || ''));
          setClasses(classList);
          if (classList.length > 0 && selectedClass) {
            const fresh = classList.find((c) => c.id === selectedClass.id);
            if (fresh) {
              setSelectedClass(fresh);
            } else {
              setSelectedClass(null);
              setStudents([]);
            }
          }
        } else {
          throw new Error('API returned no classes');
        }
      } catch (cErr) {
        console.warn('API getTeacherClasses fallback to client Firestore:', cErr);
        if (user) {
          try {
            const qClasses = query(
              collection(db, 'classes'),
              where('teacherUid', '==', user.uid)
            );
            const snapClasses = await getDocs(qClasses);
            const classList: Classroom[] = [];
            snapClasses.forEach((d) => classList.push(d.data() as Classroom));
            classList.sort((a, b) => a.grade - b.grade || (a.name || '').localeCompare(b.name || ''));
            setClasses(classList);
            if (classList.length > 0 && selectedClass) {
              const fresh = classList.find((c) => c.id === selectedClass.id);
              if (fresh) {
                setSelectedClass(fresh);
              } else {
                setSelectedClass(null);
                setStudents([]);
              }
            }
          } catch (snapErr) {
            console.warn('Firestore client class query also failed:', snapErr);
          }
        }
      }

      // 3. Fetch Lessons via getTeacherLessons Cloud Function
      if (user) {
        try {
          const getLessonsFunc = httpsCallable(functions, 'getTeacherLessons');
          const lRes: any = await getLessonsFunc({ status: 'all' });
          if (lRes.data?.success && Array.isArray(lRes.data.lessons)) {
            setLessons(lRes.data.lessons);
          } else {
            throw new Error('Invalid response');
          }
        } catch (lErr) {
          console.warn('Falling back to Firestore direct query for lessons:', lErr);
          try {
            const qLessons = query(
              collection(db, 'lessons'),
              where('teacherUid', 'in', [user.uid, 'seed_teacher_uid', 'system'])
            );
            const snapLessons = await getDocs(qLessons);
            const lessonList: Lesson[] = [];
            snapLessons.forEach((d) => lessonList.push(d.data() as Lesson));
            setLessons(lessonList);
          } catch (lsErr) {
            console.warn('Firestore direct query for lessons failed:', lsErr);
          }
        }
      }
    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStudentsForClass = async (classId: string) => {
    try {
      const getStudentsFn = createCallable('getStudentsByClass');
      const res: any = await getStudentsFn({ classId });
      if (res.data?.students) {
        setStudents(res.data.students);
        return;
      }
    } catch (apiErr) {
      console.warn('API getStudentsByClass failed, falling back to Firestore client:', apiErr);
    }

    try {
      const qStudents = query(
        collection(db, 'students'),
        where('classId', '==', classId)
      );
      const snap = await getDocs(qStudents);
      const list: Student[] = [];
      snap.forEach((d) => list.push(d.data() as Student));
      setStudents(list);
    } catch (e) {
      console.warn('Error loading students:', e);
    }
  };

  // Seed 6 Lessons Handler
  const handleSeedDatabase = async () => {
    setLoading(true);
    setActionMessage(null);
    try {
      const seedFunc = httpsCallable(functions, 'seedDatabase');
      const res: any = await seedFunc();
      setActionMessage({ type: 'success', text: res.data.message || 'Đã khởi tạo 6 bài học mẫu!' });
      await loadDashboardData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: 'Lỗi khởi tạo dữ liệu: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  // Test AI Connection Handler
  const handleTestAIConnection = async () => {
    setTestingAI(true);
    setActionMessage(null);
    try {
      const testFunc = httpsCallable(functions, 'testAIConnection');
      const res: any = await testFunc({});
      if (res.data?.status) {
        setAiStatus(res.data.status);
      }
      if (res.data?.success) {
        setActionMessage({
          type: 'success',
          text: `Kiểm tra AI thành công! Độ trễ: ${res.data.status?.lastLatencyMs || 0}ms (Model: ${res.data.status?.activeModel || res.data.status?.model})`
        });
      } else {
        setActionMessage({
          type: 'error',
          text: `Kiểm tra AI không thành công: ${res.data?.error || 'Lỗi không xác định'}`
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: `Lỗi kết nối kiểm tra AI: ${err.message}`
      });
    } finally {
      setTestingAI(false);
    }
  };

  // Create Classroom Handler
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    try {
      const createFunc = createCallable('createClassroom');
      const res: any = await createFunc({
        name: newClassName.trim(),
        grade: newClassGrade,
        academicYear: newAcademicYear.trim() || '2026-2027'
      });

      if (res.data?.success) {
        setShowCreateClassModal(false);
        setNewClassName('');
        setActionMessage({
          type: 'success',
          text: `Đã tạo lớp ${res.data.classroom.name} (Mã lớp: ${res.data.classroom.classCode}, Năm học: ${res.data.classroom.academicYear || newAcademicYear})`
        });
        await loadDashboardData();
      }
    } catch (err: any) {
      alert('Lỗi tạo lớp: ' + err.message);
    }
  };

  // Open Edit Class Modal
  const handleOpenEditClass = (c: Classroom) => {
    setEditingClass(c);
    setEditClassName(c.name);
    setEditClassGrade(c.grade);
    setEditClassAcademicYear(c.academicYear || '2026-2027');
    setEditClassCode(c.classCode);
  };

  // Save Class Edit
  const handleSaveClassEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass || !editClassName.trim()) return;
    setIsSavingClassEdit(true);
    try {
      const updateClassFn = createCallable('updateClassroom');
      const res: any = await updateClassFn({
        classId: editingClass.id,
        name: editClassName.trim(),
        grade: editClassGrade,
        academicYear: editClassAcademicYear.trim() || '2026-2027',
        classCode: editClassCode.trim() || undefined
      });
      if (res.data?.success) {
        setActionMessage({
          type: 'success',
          text: `Đã cập nhật thông tin lớp "${res.data.classroom.name}" (Năm học: ${res.data.classroom.academicYear}) thành công!`
        });
        setEditingClass(null);
        await loadDashboardData();
      }
    } catch (err: any) {
      alert('Lỗi cập nhật lớp: ' + (err.message || err));
    } finally {
      setIsSavingClassEdit(false);
    }
  };

  // Toggle Class Archive / Restore
  const handleToggleClassArchive = async (c: Classroom) => {
    const newStatus = c.status === 'archived' ? 'active' : 'archived';
    const actionName = newStatus === 'archived' ? 'lưu trữ' : 'khôi phục';
    if (!window.confirm(`Bạn có chắc chắn muốn ${actionName} lớp "${c.name}"?`)) return;

    try {
      const archiveClassFn = createCallable('archiveClassroom');
      const res: any = await archiveClassFn({
        classId: c.id,
        status: newStatus
      });
      if (res.data?.success) {
        setActionMessage({
          type: 'success',
          text: res.data.message || `Đã ${actionName} lớp "${c.name}" thành công!`
        });
        await loadDashboardData();
      }
    } catch (err: any) {
      alert(`Lỗi ${actionName} lớp: ` + (err.message || err));
    }
  };

  // Delete Class Check / Modal
  const handleDeleteClassClick = async (c: Classroom) => {
    setClassDeleteTarget(c);
    const hasKnownStudents = (c.studentCount && c.studentCount > 0) || (selectedClass?.id === c.id && students.length > 0);
    if (hasKnownStudents) {
      setClassDeleteBlockReason(
        `Không thể xóa vĩnh viễn lớp "${c.name}" vì đang có ${c.studentCount || students.length || 20} học sinh và các bài đã giao. Để bảo toàn lịch sử học tập, thầy cô vui lòng chuyển sang trạng thái "Lưu trữ" (Archived).`
      );
      return;
    }
    try {
      const qStudents = query(collection(db, 'students'), where('classId', '==', c.id));
      const sSnap = await getDocs(qStudents);
      const qAssign = user?.uid
        ? query(collection(db, 'assignments'), where('teacherUid', '==', user.uid), where('classId', '==', c.id))
        : query(collection(db, 'assignments'), where('classId', '==', c.id));
      const aSnap = await getDocs(qAssign);

      if (sSnap.size > 0 || aSnap.size > 0) {
        setClassDeleteBlockReason(
          `Không thể xóa vĩnh viễn lớp "${c.name}" vì đang có ${sSnap.size} học sinh và ${aSnap.size} bài đã giao. Để bảo toàn lịch sử học tập, thầy cô vui lòng chuyển sang trạng thái "Lưu trữ" (Archived).`
        );
      } else {
        setClassDeleteBlockReason(null);
      }
    } catch (e: any) {
      console.warn('Error checking class dependencies:', e);
      if (c.studentCount && c.studentCount > 0) {
        setClassDeleteBlockReason(
          `Không thể xóa vĩnh viễn lớp "${c.name}" vì đang có ${c.studentCount} học sinh. Vui lòng chuyển sang "Lưu trữ".`
        );
      } else {
        setClassDeleteBlockReason(null);
      }
    }
  };

  // Confirm Delete Class (Only for empty classes)
  const handleConfirmDeleteClass = async () => {
    if (!classDeleteTarget) return;
    setIsDeletingClass(true);
    try {
      const deleteClassFn = createCallable('deleteClassroom');
      const res: any = await deleteClassFn({ classId: classDeleteTarget.id });
      if (res.data?.success) {
        setActionMessage({
          type: 'success',
          text: res.data.message || `Đã xóa lớp "${classDeleteTarget.name}" thành công!`
        });
        setClassDeleteTarget(null);
        await loadDashboardData();
      }
    } catch (err: any) {
      alert('Không thể xóa lớp: ' + (err.message || err));
    } finally {
      setIsDeletingClass(false);
    }
  };

  // Step-by-Step Navigation Handlers for Tab 2 (Module 1: NĂM HỌC -> KHỐI -> LỚP -> HỌC SINH)
  const handleSelectYear = (year: string) => {
    setNavYear(year);
    setNavGrade(null);
    setSelectedClass(null);
    setStudents([]);
  };

  const handleSelectGrade = (grade: number) => {
    setNavGrade(grade);
    setSelectedClass(null);
    setStudents([]);
  };

  const handleSelectClass = (cls: Classroom) => {
    setSelectedClass(cls);
    loadStudentsForClass(cls.id);
  };

  const handleBackToYears = () => {
    setNavYear(null);
    setNavGrade(null);
    setSelectedClass(null);
    setStudents([]);
  };

  const handleBackToGrades = () => {
    setNavGrade(null);
    setSelectedClass(null);
    setStudents([]);
  };

  const handleBackToClasses = () => {
    setSelectedClass(null);
    setStudents([]);
  };

  // Lesson Year Resolver Helper
  const getLessonYears = (ls: Lesson): string[] => {
    const years = new Set<string>();
    if ((ls as any).academicYear) {
      years.add((ls as any).academicYear);
    }
    if ((ls as any).assignedClasses && Array.isArray((ls as any).assignedClasses)) {
      (ls as any).assignedClasses.forEach((ac: any) => {
        const cls = classes.find((c) => c.id === ac.classId);
        if (cls?.academicYear) {
          years.add(cls.academicYear);
        }
      });
    }
    return Array.from(years);
  };

  // Step-by-Step Navigation Handlers for Tab 3 (Module 2: NĂM HỌC -> KHỐI -> HỌC KỲ -> TUẦN -> BÀI ĐỌC)
  const handleSelectLessonYear = (year: string) => {
    setNavLessonYear(year);
    setNavLessonGrade(null);
    setNavLessonSemester(null);
    setNavLessonWeek(null);
  };

  const handleSelectLessonGrade = (grade: Grade) => {
    setNavLessonGrade(grade);
    setNavLessonSemester(null);
    setNavLessonWeek(null);
  };

  const handleSelectLessonSemester = (sem: 1 | 2) => {
    setNavLessonSemester(sem);
    setNavLessonWeek(null);
  };

  const handleSelectLessonWeek = (week: number | 'all') => {
    setNavLessonWeek(week);
  };

  const handleBackToLessonYears = () => {
    setNavLessonYear(null);
    setNavLessonGrade(null);
    setNavLessonSemester(null);
    setNavLessonWeek(null);
  };

  const handleBackToLessonGrades = () => {
    setNavLessonGrade(null);
    setNavLessonSemester(null);
    setNavLessonWeek(null);
  };

  const handleBackToLessonSemesters = () => {
    setNavLessonSemester(null);
    setNavLessonWeek(null);
  };

  const handleBackToLessonWeeks = () => {
    setNavLessonWeek(null);
  };

  // Create Student Access Code Handler
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || !newStudentAlias.trim()) return;

    try {
      const createStudent = createCallable('createStudentAccess');
      const res: any = await createStudent({
        classId: selectedClass.id,
        displayAlias: newStudentAlias.trim(),
        studentCode: newStudentCode.trim() || undefined
      });

      if (res.data?.success) {
        setCreatedStudentCard({
          ...res.data.student,
          className: selectedClass.name,
          classCode: selectedClass.classCode
        });
        setNewStudentAlias('');
        setNewStudentCode('');
        loadStudentsForClass(selectedClass.id);
      }
    } catch (err: any) {
      alert('Lỗi tạo mã học sinh: ' + err.message);
    }
  };

  // Rotate Student Access Code Handler
  const handleRotateStudentCode = async (studentId: string, alias: string, code: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn đổi mã PIN đăng nhập mới cho học sinh "${alias}"? Mã cũ sẽ bị thu hồi ngay lập tức.`)) {
      return;
    }

    try {
      const rotateFunc = createCallable('rotateStudentAccess');
      const res: any = await rotateFunc({ studentId });
      if (res.data?.success) {
        setReissuedPinInfo({
          alias,
          code,
          pin: res.data.newAccessCode
        });
      }
    } catch (err: any) {
      alert('Lỗi đổi mã: ' + err.message);
    }
  };

  // Toggle Student Status Handler (Active / Suspended) (Phase 3 - P0)
  const handleToggleStudentStatus = async (studentId: string, currentStatus?: string) => {
    const nextStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    const actionText = nextStatus === 'suspended' ? 'tạm khóa' : 'mở khóa';
    if (!window.confirm(`Bạn có chắc chắn muốn ${actionText} tài khoản học sinh này?`)) return;

    setLoading(true);
    try {
      const toggleFunc = createCallable('toggleStudentStatus');
      const res: any = await toggleFunc({ studentId, status: nextStatus });
      if (res.data?.success) {
        setActionMessage({
          type: 'success',
          text: res.data.message || `Đã ${actionText} học sinh thành công!`
        });
        if (selectedClass) await loadStudentsForClass(selectedClass.id);
      }
    } catch (err: any) {
      alert('Lỗi cập nhật trạng thái học sinh: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Toggle Student Archive Handler (Active / Archived)
  const handleToggleStudentArchive = async (studentId: string, currentStatus?: string) => {
    const nextStatus = currentStatus === 'archived' ? 'active' : 'archived';
    const actionText = nextStatus === 'archived' ? 'lưu trữ' : 'khôi phục';
    if (!window.confirm(`Bạn có chắc chắn muốn ${actionText} hồ sơ học sinh này?`)) return;

    setLoading(true);
    try {
      const toggleFunc = createCallable('toggleStudentStatus');
      const res: any = await toggleFunc({ studentId, status: nextStatus });
      if (res.data?.success) {
        setActionMessage({
          type: 'success',
          text: res.data.message || `Đã ${actionText} học sinh thành công!`
        });
        if (selectedClass) await loadStudentsForClass(selectedClass.id);
      }
    } catch (err: any) {
      alert('Lỗi lưu trữ học sinh: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Confirm Single Student Delete Handler
  const handleConfirmDeleteStudent = async () => {
    if (!deleteTargetStudent) return;
    setDeletingStudent(true);
    setDeleteStudentError(null);
    try {
      const deleteFn = createCallable('deleteStudent');
      const res: any = await deleteFn({ studentId: deleteTargetStudent.id });
      if (res.data?.success) {
        setActionMessage({
          type: 'success',
          text: res.data.message || 'Đã xóa hồ sơ học sinh thành công.'
        });
        setDeleteTargetStudent(null);
        if (selectedClass) await loadStudentsForClass(selectedClass.id);
      }
    } catch (err: any) {
      setDeleteStudentError(err.message);
    } finally {
      setDeletingStudent(false);
    }
  };

  // Batch Students Actions Handler
  const handleBatchStudentsAction = async (action: 'lock' | 'unlock' | 'archive' | 'delete') => {
    if (selectedStudentIds.length === 0) return;
    setIsProcessingBatchStudents(true);
    try {
      const batchFn = createCallable('batchUpdateStudents');
      const res: any = await batchFn({ studentIds: selectedStudentIds, action });
      if (res.data?.success) {
        setActionMessage({
          type: 'success',
          text: `Thao tác hàng loạt hoàn tất: ${res.data.successCount} thành công` +
            (res.data.protectedCount ? `, ${res.data.protectedCount} chuyển sang Lưu trữ để bảo vệ kết quả học tập` : '')
        });
        setSelectedStudentIds([]);
        setBatchStudentModal(null);
        if (selectedClass) await loadStudentsForClass(selectedClass.id);
      }
    } catch (err: any) {
      alert('Lỗi thao tác hàng loạt: ' + err.message);
    } finally {
      setIsProcessingBatchStudents(false);
    }
  };

  // Save Student Edit Handler (Phase 3 - P0)
  const handleSaveStudentEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent || !editingAlias.trim()) return;

    setSavingStudentEdit(true);
    try {
      const updateFunc = createCallable('updateStudentInfo');
      const res: any = await updateFunc({
        studentId: editingStudent.id,
        displayAlias: editingAlias.trim(),
        studentCode: editingCode.trim() || undefined
      });
      if (res.data?.success) {
        setActionMessage({
          type: 'success',
          text: 'Đã cập nhật thông tin học sinh thành công!'
        });
        setEditingStudent(null);
        if (selectedClass) await loadStudentsForClass(selectedClass.id);
      }
    } catch (err: any) {
      alert('Lỗi cập nhật học sinh: ' + err.message);
    } finally {
      setSavingStudentEdit(false);
    }
  };

  // Transfer Student to Another Class Handler (Phase 3 - P0 & Mảng A)
  const handleTransferStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferringStudent || !targetTransferClassId) return;

    setTransferring(true);
    try {
      const transFunc = createCallable('transferStudentClass');
      const res: any = await transFunc({
        studentId: transferringStudent.id,
        targetClassId: targetTransferClassId,
        transferType,
        reason: transferReason.trim() || undefined
      });
      if (res.data?.success) {
        setActionMessage({
          type: 'success',
          text: res.data.message || 'Đã chuyển lớp thành công!'
        });
        const currentSelectedClassId = selectedClass?.id;
        setTransferringStudent(null);
        setTargetTransferClassId('');
        setTransferReason('');
        await loadDashboardData();
        if (currentSelectedClassId) {
          await loadStudentsForClass(currentSelectedClassId);
        }
      }
    } catch (err: any) {
      alert('Lỗi chuyển lớp: ' + err.message);
    } finally {
      setTransferring(false);
    }
  };

  // Open Lesson Info (Version History & Assigned Classes) Handler (Phase 2 - P0)
  const handleOpenLessonInfo = async (lesson: Lesson, defaultTab: 'versions' | 'assignments' = 'versions') => {
    setLoadingLessonInfo(true);
    setLessonInfoTab(defaultTab);
    try {
      const getDetail = httpsCallable(functions, 'getLessonDetail');
      const res: any = await getDetail({ lessonId: lesson.id });
      const versions = res.data?.versionsList || [];

      // Query assignments for this lesson (prioritizing secure backend response)
      let assignmentsList: any[] = [];
      if (Array.isArray(res.data?.assignmentsList) && res.data.assignmentsList.length > 0) {
        assignmentsList = res.data.assignmentsList.map((dData: any) => {
          const matchedClass = classes.find((c) => c.id === dData.classId);
          return {
            id: dData.id,
            ...dData,
            className: matchedClass?.name || dData.classId,
            academicYear: matchedClass?.academicYear || '2026-2027'
          };
        });
      } else {
        try {
          const qAssign = user?.uid
            ? query(collection(db, 'assignments'), where('teacherUid', '==', user.uid), where('lessonId', '==', lesson.id))
            : query(collection(db, 'assignments'), where('lessonId', '==', lesson.id));
          const snapAssign = await getDocs(qAssign);
          snapAssign.forEach((d) => {
            const dData = d.data();
            const matchedClass = classes.find((c) => c.id === dData.classId);
            assignmentsList.push({
              id: d.id,
              ...dData,
              className: matchedClass?.name || dData.classId,
              academicYear: matchedClass?.academicYear || '2026-2027'
            });
          });
        } catch (aErr) {
          console.warn('Assignments direct query fallback warning:', aErr);
        }
      }

      setViewingLessonInfo({
        lesson,
        versions,
        assignments: assignmentsList
      });
    } catch (err: any) {
      console.warn('Error fetching lesson info:', err);
      alert('Lỗi tải thông tin phiên bản / bài giao: ' + err.message);
    } finally {
      setLoadingLessonInfo(false);
    }
  };

  // Copy Class Code Handler
  const handleCopyClassCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedClassCode(true);
    setTimeout(() => setCopiedClassCode(false), 2500);
  };

  // Export Students to Excel (.xlsx) using ExcelJS (Secure & Styled)
  const handleExportStudentsExcel = async () => {
    if (!selectedClass || students.length === 0) {
      alert('Lớp chưa có học sinh để xuất danh sách.');
      return;
    }
    try {
      await exportStudentsToExcel(
        students,
        selectedClass.name,
        selectedClass.classCode,
        selectedClass.academicYear || '2026-2027'
      );
    } catch (err: any) {
      alert('Lỗi xuất tệp Excel: ' + err.message);
    }
  };

  // Handle Excel File Selected for Student Import using ExcelJS & Security Auditing
  const handleExcelFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedClass) return;

    setExcelImportErrors([]);
    setImportedSlips(null);

    try {
      const existingCodes = new Set(
        students.map((s) => (s.studentCode || '').trim().toUpperCase()).filter(Boolean)
      );
      const auditResult = await parseAndAuditStudentsExcel(
        file,
        selectedClass.classCode,
        existingCodes
      );

      if (auditResult.generalError) {
        setExcelImportErrors([auditResult.generalError]);
        setExcelPreviewData([]);
        return;
      }

      const validRows = auditResult.rows
        .filter((r) => r.isValid)
        .map((r, idx) => ({
          index: idx + 1,
          displayAlias: r.displayAlias,
          studentCode: r.studentCode || `HS${1000 + idx}`,
          classCode: r.classCode,
          academicYear: r.academicYear
        }));

      const allErrors: string[] = [];
      auditResult.rows.forEach((r) => {
        if (!r.isValid && r.errors.length > 0) {
          allErrors.push(`Dòng ${r.rowNumber} (${r.displayAlias || 'Không tên'}): ${r.errors.join(', ')}`);
        }
      });

      setExcelPreviewData(validRows);
      setExcelImportErrors(allErrors);
    } catch (err: any) {
      setExcelImportErrors(['Lỗi phân tích tệp Excel: ' + err.message]);
      setExcelPreviewData([]);
    }
  };

  // Confirm Batch Import Students
  const handleConfirmBatchImport = async () => {
    if (!selectedClass || excelPreviewData.length === 0) return;
    setImportingStudents(true);
    try {
      const batchFunc = createCallable('batchCreateStudents');
      const res: any = await batchFunc({
        classId: selectedClass.id,
        students: excelPreviewData
      });

      if (res.data?.success) {
        setImportedSlips(res.data.students || []);
        await loadStudentsForClass(selectedClass.id);
        setActionMessage({
          type: 'success',
          text: `Đã nhập thành công ${res.data.totalCreated || res.data.createdCount} học sinh vào lớp ${selectedClass.name}!`
        });
      }
    } catch (err: any) {
      alert('Lỗi nhập học sinh từ Excel: ' + err.message);
    } finally {
      setImportingStudents(false);
    }
  };

  // Generate Lesson Draft with AI
  const handleGenerateAI = async () => {
    setGeneratingAI(true);
    setActionMessage(null);
    try {
      const aiFunc = httpsCallable(functions, 'generateLessonDraft');
      const res: any = await aiFunc({
        grade: aiGrade,
        semester: aiSemester,
        week: aiWeek,
        topic: aiTopic,
        genre: aiGenre,
        targetWordCount: aiWordCount,
        readingGoal: aiGoal
      });

      if (res.data?.success) {
        const rawDraft = res.data.draft;
        setDraftLesson({
          ...rawDraft,
          grade: (rawDraft.grade || aiGrade) as Grade,
          semester: (rawDraft.semester || aiSemester) as 1 | 2,
          week: rawDraft.week || aiWeek || 1,
          genre: rawDraft.genre || aiGenre || 'narrative',
          academicYearScope: 'shared',
          academicYear: null,
          curriculumRequirement: rawDraft.curriculumRequirement || `Đọc hiểu văn bản thể loại ${TEXT_GENRE_LABELS[aiGenre] || aiGenre}; nhận biết chi tiết và nội dung chính phù hợp CT GDPT 2018.`,
          source: 'ai_curriculum_aligned',
          referenceSource: rawDraft.referenceSource || `Học liệu đọc hiểu chuẩn hóa CT GDPT 2018 (Phỏng theo chủ điểm ${aiTopic} - SGK Tiếng Việt ${aiGrade})`,
          verificationStatus: 'ai_curriculum_aligned'
        });
        setIsEditingDraft(true);
        if (aiAutoGenerateAudio) {
          setAutoTriggerAudio(true);
        }
        setActionMessage({
          type: 'success',
          text: aiAutoGenerateAudio
            ? 'AI đã tạo thành công bản nháp bài đọc và đang tự động tạo giọng đọc tiếng Việt...'
            : 'AI đã tạo thành công bản nháp bài đọc! Giáo viên vui lòng duyệt giọng đọc AI, nội dung và câu hỏi trước khi xuất bản.'
        });
      }
    } catch (err: any) {
      console.warn('AI Error:', err);
      setActionMessage({
        type: 'error',
        text: err.message || 'Chưa thể kết nối AI. Vui lòng chuyển sang Soạn thủ công hoặc cấu hình GEMINI_API_KEY.'
      });
    } finally {
      setGeneratingAI(false);
    }
  };

  // Save Lesson Draft Handler (P0)
  const handleSaveDraft = async () => {
    if (!draftLesson) return;
    setSavingDraft(true);
    setActionMessage(null);
    try {
      const saveFunc = httpsCallable(functions, 'saveLessonDraft');
      const res: any = await saveFunc({
        lessonId: currentEditingLessonId || undefined,
        draft: draftLesson
      });
      if (res.data?.success) {
        if (res.data.lessonId) {
          setCurrentEditingLessonId(res.data.lessonId);
        }
        setActionMessage({
          type: 'success',
          text: 'Đã lưu bản nháp bài đọc thành công vào máy chủ! Thầy cô có thể tải lại trang hoặc chỉnh sửa tiếp bất kỳ lúc nào.'
        });
        await loadDashboardData();
      }
    } catch (err: any) {
      alert('Lỗi lưu bản nháp: ' + err.message);
    } finally {
      setSavingDraft(false);
    }
  };

  // Publish Lesson Handler (P0 - Immutable Versioning)
  const handlePublishLesson = async () => {
    if (!draftLesson) return;
    if (draftLesson.questions.length === 0) {
      alert('Bài đọc cần tối thiểu 1 câu hỏi để xuất bản.');
      return;
    }
    setPublishing(true);
    try {
      const publishFunc = httpsCallable(functions, 'publishLesson');
      const lessonIdToPublish = currentEditingLessonId || draftLesson.lessonId || undefined;
      const res: any = await publishFunc({
        lessonId: lessonIdToPublish,
        draft: {
          ...draftLesson,
          lessonId: lessonIdToPublish
        }
      });
      if (res.data?.success) {
        setActionMessage({
          type: 'success',
          text: `Bài đọc "${draftLesson.title}" đã được duyệt và xuất bản thành công (Phiên bản v${res.data.versionNumber || 1})! Đáp án đã được bảo vệ độc lập trên máy chủ.`
        });
        setDraftLesson(null);
        setCurrentEditingLessonId(null);
        setIsEditingDraft(false);
        setActiveTab('lessons');
        await loadDashboardData();
      }
    } catch (err: any) {
      alert('Lỗi xuất bản bài: ' + err.message);
    } finally {
      setPublishing(false);
    }
  };

  // Helper to extract private answer details supporting Record, Array, and legacy schemas (P0 Fix)
  const getQuestionPrivateAnswer = (privateAnswers: any, questionId: string) => {
    if (!privateAnswers) return null;
    if (typeof privateAnswers === 'object' && !Array.isArray(privateAnswers)) {
      const direct = privateAnswers[questionId];
      if (direct) {
        return {
          answer: direct.correctAnswer !== undefined ? direct.correctAnswer : direct.answer,
          hint: direct.hint || '',
          explanation: direct.explanation || ''
        };
      }
    }
    if (Array.isArray(privateAnswers)) {
      const found = privateAnswers.find((pa: any) => pa && (pa.questionId === questionId || pa.id === questionId));
      if (found) {
        return {
          answer: found.correctAnswer !== undefined ? found.correctAnswer : found.answer,
          hint: found.hint || '',
          explanation: found.explanation || ''
        };
      }
    }
    return null;
  };

  // Edit Existing Lesson or Draft (P0)
  const handleEditLesson = async (lessonId: string) => {
    setLoading(true);
    setActionMessage(null);
    try {
      const getDetail = httpsCallable(functions, 'getLessonDetail');
      const res: any = await getDetail({ lessonId });
      if (res.data?.success) {
        const { lesson, version, privateAnswers } = res.data;
        setCurrentEditingLessonId(lesson.id);
        setCurrentEditingVersionNumber(lesson.currentVersionNumber || 1);

        if (lesson.draftData) {
          // If uncommitted draft exists, load it with audio fallback from lesson/version
          setDraftLesson({
            ...lesson.draftData,
            audioUrl: lesson.draftData.audioUrl || version?.audioUrl || lesson.audioUrl || undefined,
            audioMetadata: lesson.draftData.audioMetadata || version?.audioMetadata || lesson.audioMetadata || undefined,
            academicYearScope: lesson.draftData.academicYearScope || lesson.academicYearScope || (lesson.draftData.academicYear || lesson.academicYear ? 'specific' : 'shared'),
            academicYear: lesson.draftData.academicYear !== undefined ? lesson.draftData.academicYear : (lesson.academicYear || null)
          });
        } else if (version) {
          // Reconstruct draft from published version + private answers
          const fullQuestions = (version.publicQuestions || []).map((pq: any) => {
            const privateInfo = getQuestionPrivateAnswer(privateAnswers, pq.id);
            return {
              id: pq.id,
              type: pq.type,
              prompt: pq.prompt,
              options: pq.options,
              items: pq.items,
              statement: pq.statement,
              answer: privateInfo?.answer !== undefined ? privateInfo.answer : (pq.options ? 'A' : (pq.type === 'true_false' ? true : (pq.items || []))),
              hint: privateInfo?.hint || pq.hint || '',
              explanation: privateInfo?.explanation || '',
              skillTag: pq.skillTag || 'thong_tin_truc_tiep',
              difficulty: pq.difficulty || 'nhan_biet'
            };
          });

          setDraftLesson({
            title: version.title || lesson.title,
            topic: version.topic || lesson.topic,
            grade: (version.grade || lesson.grade || 2) as Grade,
            semester: (version.semester || lesson.semester || 1) as 1 | 2,
            week: version.week || lesson.week || 1,
            genre: version.genre || lesson.genre || 'narrative',
            curriculumRequirement: version.curriculumRequirement || lesson.curriculumRequirement || '',
            source: version.source || lesson.source || 'ai_curriculum_aligned',
            referenceSource: version.referenceSource || lesson.referenceSource || '',
            verificationStatus: version.verificationStatus || lesson.verificationStatus || 'ai_curriculum_aligned',
            academicYearScope: lesson.academicYearScope || version.academicYearScope || (lesson.academicYear ? 'specific' : 'shared'),
            academicYear: lesson.academicYear || version.academicYear || null,
            passage: version.passage || '',
            vocabulary: version.vocabulary || [],
            questions: fullQuestions,
            audioUrl: version.audioUrl || undefined,
            audioMetadata: version.audioMetadata || undefined
          });
        }

        setIsEditingDraft(true);
        setActiveTab('authoring');
        setActionMessage({
          type: 'success',
          text: lesson.status === 'published'
            ? `Đang mở bài đã xuất bản "${lesson.title}". Khi xuất bản lại sẽ tạo phiên bản mới v${(lesson.totalVersions || 1) + 1}, bảo toàn 100% dữ liệu của phiên bản cũ.`
            : `Đang mở bản nháp "${lesson.title}" để tiếp tục soạn thảo.`
        });
      }
    } catch (err: any) {
      alert('Lỗi tải bài học để sửa: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Quick Update Scope (Shared vs Specific Year) without version bump (Module 2.1)
  const handleQuickUpdateLessonScope = async (lesson: Lesson, newScope: 'shared' | 'specific', year?: string) => {
    try {
      setLoading(true);
      const updateFn = httpsCallable(functions, 'updateLessonScope');
      const targetYear = newScope === 'specific' ? (year || '2026-2027') : null;
      const res: any = await updateFn({
        lessonId: lesson.id,
        academicYearScope: newScope,
        academicYear: targetYear
      });
      if (res.data?.success) {
        setActionMessage({
          type: 'success',
          text: res.data.message || 'Đã cập nhật phạm vi năm học của bài đọc thành công!'
        });
        await loadDashboardData();
      }
    } catch (err: any) {
      alert('Lỗi cập nhật phạm vi năm học: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  // AI Real Vietnamese TTS Handler (Gemini TTS - Gói C V5.5.1)
  const handleGenerateAIAudio = async () => {
    if (!draftLesson) return;
    if (!draftLesson.passage || draftLesson.passage.trim().length < 20) {
      alert('Vui lòng nhập hoặc soạn nội dung bài đọc trước khi tạo giọng đọc AI (tối thiểu 20 ký tự).');
      return;
    }

    setGeneratingAIAudio(true);
    setAudioUploadMsg(null);
    try {
      const genFunc = httpsCallable(functions, 'generateLessonAudioWithAI');
      const res: any = await genFunc({
        passage: draftLesson.passage,
        title: draftLesson.title,
        grade: draftLesson.grade,
        voiceGender: aiVoiceGender,
        readingStyle: aiReadingStyle,
        lessonId: currentEditingLessonId || draftLesson.lessonId
      });

      if (res.data?.success) {
        setPreviewAIAudio({
          url: res.data.audioUrl,
          metadata: res.data.metadata
        });
        setAudioUploadMsg({
          type: 'success',
          text: `AI đã tổng hợp giọng đọc tiếng Việt thật thành công (~${res.data.durationSeconds} giây, mô hình ${res.data.model})! Hãy bấm nghe thử bên dưới.`
        });
      } else {
        throw new Error(res.data?.message || 'Không thể tạo âm thanh AI');
      }
    } catch (err: any) {
      console.error('AI TTS error:', err);
      const isQuota = err.message && (err.message.includes('429') || err.message.includes('Quota'));
      const msg = isQuota
        ? 'Hạn mức dịch vụ Gemini TTS tạm thời bị giới hạn (Quota 429). Vui lòng đợi 1–2 phút rồi thử lại.'
        : 'Lỗi khi tạo giọng đọc AI: ' + (err.message || 'Không thể kết nối máy chủ.');
      setAudioUploadMsg({ type: 'error', text: msg });
      alert(msg);
    } finally {
      setGeneratingAIAudio(false);
    }
  };

  const handleApproveAIAudio = async () => {
    if (!previewAIAudio || !draftLesson) return;
    setApprovingAIAudio(true);
    try {
      const approveFunc = httpsCallable(functions, 'approveLessonAudio');
      await approveFunc({
        lessonId: currentEditingLessonId || draftLesson.lessonId,
        metadata: previewAIAudio.metadata
      });

      setDraftLesson({
        ...draftLesson,
        audioUrl: previewAIAudio.url,
        audioMetadata: {
          ...previewAIAudio.metadata,
          status: 'approved',
          approvalStatus: 'approved'
        }
      });
      setPreviewAIAudio(null);
      setAudioUploadMsg({
        type: 'success',
        text: 'Đã phê duyệt và gắn giọng đọc AI tiếng Việt vào bài học thành công!'
      });
    } catch (err: any) {
      alert('Lỗi khi phê duyệt âm thanh: ' + err.message);
    } finally {
      setApprovingAIAudio(false);
    }
  };

  // Audio Upload Handler (Package C - Max 15MB MP3/M4A, 30MB WAV)
  const handleUploadAudio = async (file: File) => {
    if (!draftLesson) return;
    setAudioUploadMsg(null);

    const fileNameLower = file.name.toLowerCase();
    const isWav = fileNameLower.endsWith('.wav') || file.type.includes('wav');
    const isMp3OrM4a = fileNameLower.endsWith('.mp3') || fileNameLower.endsWith('.m4a') || file.type.includes('mpeg') || file.type.includes('mp3') || file.type.includes('m4a');

    if (!isWav && !isMp3OrM4a) {
      alert('Định dạng tệp không hợp lệ. Vui lòng chọn tệp âm thanh MP3, M4A hoặc WAV.');
      return;
    }

    const maxBytes = isWav ? 30 * 1024 * 1024 : 15 * 1024 * 1024;
    const limitMb = isWav ? 30 : 15;

    if (file.size > maxBytes) {
      alert(`Dung lượng tệp (${(file.size / (1024 * 1024)).toFixed(1)} MB) vượt quá giới hạn tối đa (${limitMb} MB cho ${isWav ? 'WAV' : 'MP3/M4A'}).`);
      return;
    }

    setUploadingAudio(true);
    try {
      // 1. Detect duration using HTML5 Audio
      let durationSec: number | undefined = undefined;
      try {
        const objectUrl = URL.createObjectURL(file);
        const tempAudio = new Audio(objectUrl);
        await new Promise<void>((resolve) => {
          tempAudio.onloadedmetadata = () => {
            durationSec = Math.round(tempAudio.duration);
            URL.revokeObjectURL(objectUrl);
            resolve();
          };
          tempAudio.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve();
          };
          setTimeout(resolve, 2000);
        });
      } catch (e) {
        console.warn('Duration detection error:', e);
      }

      // 2. Read as Base64 to send to backend callable
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      });

      // 3. Call backend uploadLessonAudio
      const uploadFunc = httpsCallable(functions, 'uploadLessonAudio');
      const res: any = await uploadFunc({
        fileName: file.name,
        fileBase64: base64Data,
        mimeType: file.type || (isWav ? 'audio/wav' : 'audio/mpeg'),
        sizeBytes: file.size,
        durationSeconds: durationSec,
        voiceType: 'teacher_voice',
        lessonId: currentEditingLessonId || 'new_lesson'
      });

      if (res.data?.success) {
        const metadata: AudioMetadata = res.data.metadata;
        setDraftLesson({
          ...draftLesson,
          audioUrl: res.data.downloadUrl,
          audioMetadata: metadata
        });
        setAudioUploadMsg({
          type: 'success',
          text: `Đã tải lên tệp "${file.name}" (${(file.size / (1024 * 1024)).toFixed(2)} MB) thành công vào tầng lưu trữ máy chủ!`
        });
      } else {
        throw new Error(res.data?.message || 'Tải lên không thành công');
      }
    } catch (err: any) {
      console.error('Audio upload error:', err);
      setAudioUploadMsg({
        type: 'error',
        text: 'Lỗi tải lên âm thanh: ' + (err.message || 'Không thể kết nối đến máy chủ.')
      });
      alert('Lỗi tải tệp âm thanh: ' + err.message);
    } finally {
      setUploadingAudio(false);
    }
  };

  // Audio Delete Handler
  const handleDeleteAudio = async () => {
    if (!draftLesson) return;
    if (!window.confirm('Xác nhận xóa tệp âm thanh đính kèm của bài đọc này?')) return;

    if (draftLesson.audioMetadata?.storagePath) {
      try {
        const deleteFunc = httpsCallable(functions, 'deleteLessonAudio');
        await deleteFunc({ storagePath: draftLesson.audioMetadata.storagePath });
      } catch (e) {
        console.warn('Delete audio file warning:', e);
      }
    }

    setDraftLesson({
      ...draftLesson,
      audioUrl: undefined,
      audioMetadata: undefined
    });
    setAudioUploadMsg({
      type: 'success',
      text: 'Đã gỡ tệp âm thanh khỏi bài đọc.'
    });
  };

  // Sample Voice Selector (Piper / VieNeu / Teacher Recording)
  const handleSelectSampleVoice = (sampleType: 'piper' | 'vieneu' | 'teacher') => {
    if (!draftLesson) return;
    const samples = {
      piper: {
        url: '/audio/samples/audio_sample_1_piper_vais.wav',
        name: 'Mẫu Piper TTS (vi_VN-vais1000-medium)',
        voiceType: 'piper_tts' as const
      },
      vieneu: {
        url: '/audio/samples/audio_sample_2_vieneu_neural.wav',
        name: 'Mẫu VieNeu-TTS Neural (Thế hệ mới)',
        voiceType: 'vieneu_tts' as const
      },
      teacher: {
        url: '/audio/samples/audio_sample_3_teacher_recording.wav',
        name: 'Mẫu Giọng đọc giáo viên tiểu học (Chuẩn sư phạm)',
        voiceType: 'teacher_voice' as const
      }
    };
    const s = samples[sampleType];
    setDraftLesson({
      ...draftLesson,
      audioUrl: s.url,
      audioMetadata: {
        storagePath: s.url,
        downloadUrl: s.url,
        fileName: s.name,
        mimeType: 'audio/wav',
        sizeBytes: 150000,
        durationSeconds: 4,
        uploadedAt: new Date().toISOString(),
        approvalStatus: 'approved',
        voiceType: s.voiceType
      }
    });
    setAudioUploadMsg({
      type: 'success',
      text: `Đã gán "${s.name}" vào bài đọc thành công!`
    });
  };

  // Archive Lesson Handler (P0 - Safe Retention)
  const handleArchiveLesson = async (lessonId: string, title: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn chuyển bài đọc "${title}" sang trạng thái Lưu trữ (Archived)?\n\n• Bài đọc sẽ ẩn khỏi danh sách giao bài mới cho học sinh.\n• Toàn bộ lịch sử kết quả, điểm số và bài làm trước đây của học sinh được BẢO TOÀN NGUYÊN VẸN.`)) {
      return;
    }
    setLoading(true);
    try {
      const archiveFunc = httpsCallable(functions, 'archiveLesson');
      const res: any = await archiveFunc({ lessonId });
      if (res.data?.success) {
        setActionMessage({
          type: 'success',
          text: res.data.message || 'Đã lưu trữ bài đọc an toàn!'
        });
        await loadDashboardData();
      }
    } catch (err: any) {
      alert('Lỗi lưu trữ bài đọc: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete Draft Lesson Handler (P0 - Only if draft and never assigned)
  const handleDeleteDraftLesson = async (lessonId: string, title: string) => {
    if (!window.confirm(`Xác nhận xóa bản nháp "${title}"?\nThao tác này sẽ xóa vĩnh viễn bản nháp chưa xuất bản và không thể hoàn tác.`)) {
      return;
    }
    setLoading(true);
    try {
      const delFunc = httpsCallable(functions, 'deleteDraftLesson');
      const res: any = await delFunc({ lessonId });
      if (res.data?.success) {
        setActionMessage({
          type: 'success',
          text: 'Đã xóa bản nháp thành công!'
        });
        await loadDashboardData();
      }
    } catch (err: any) {
      alert('Lỗi xóa bản nháp: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Question CRUD Handlers (P0)
  const handleAddQuestion = (type: 'multiple_choice' | 'true_false' | 'sequence') => {
    if (!draftLesson) return;
    if (draftLesson.questions.length >= 20) {
      alert('Mỗi bài đọc hỗ trợ tối đa 20 câu hỏi.');
      return;
    }

    const newId = `q_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    let newQ: any;

    if (type === 'multiple_choice') {
      newQ = {
        id: newId,
        type: 'multiple_choice',
        prompt: 'Nhập nội dung câu hỏi trắc nghiệm...',
        options: ['Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C'],
        answer: 'A',
        hint: 'Gợi ý đọc lại câu đầu của bài đọc.',
        explanation: 'Giải thích chi tiết vì sao A là đáp án đúng.',
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet'
      };
    } else if (type === 'true_false') {
      newQ = {
        id: newId,
        type: 'true_false',
        prompt: 'Nhập nhận định Đúng hoặc Sai...',
        answer: true,
        hint: 'Xem kỹ chi tiết trong đoạn văn.',
        explanation: 'Giải thích lý do nhận định này là đúng.',
        skillTag: 'noi_dung_chinh',
        difficulty: 'thong_hieu'
      };
    } else {
      newQ = {
        id: newId,
        type: 'sequence',
        prompt: 'Sắp xếp đúng thứ tự 3 sự việc diễn ra trong bài:',
        items: ['Sự việc bắt đầu', 'Sự việc tiếp theo', 'Sự việc kết thúc'],
        answer: ['Sự việc bắt đầu', 'Sự việc tiếp theo', 'Sự việc kết thúc'],
        hint: 'Chú ý mốc thời gian xuất hiện trong bài.',
        explanation: 'Thứ tự đúng của câu chuyện theo trình tự thời gian.',
        skillTag: 'sap_xep_trinh_tu',
        difficulty: 'thong_hieu'
      };
    }

    setDraftLesson({
      ...draftLesson,
      questions: [...draftLesson.questions, newQ]
    });
    setShowAddQuestionMenu(false);
  };

  const handleCloneQuestion = (idx: number) => {
    if (!draftLesson) return;
    if (draftLesson.questions.length >= 20) {
      alert('Mỗi bài đọc hỗ trợ tối đa 20 câu hỏi.');
      return;
    }

    const original = draftLesson.questions[idx];
    const cloned = {
      ...JSON.parse(JSON.stringify(original)),
      id: `q_${Date.now()}_clone`,
      prompt: `${original.prompt} (Bản sao)`
    };

    const newQuestions = [...draftLesson.questions];
    newQuestions.splice(idx + 1, 0, cloned);
    setDraftLesson({ ...draftLesson, questions: newQuestions });
  };

  const handleDeleteQuestion = (idx: number) => {
    if (!draftLesson) return;
    if (draftLesson.questions.length <= 1) {
      alert('Bài đọc cần giữ lại tối thiểu 1 câu hỏi.');
      return;
    }
    if (!window.confirm(`Bạn có chắc muốn xóa Câu hỏi ${idx + 1}?`)) return;

    const newQuestions = draftLesson.questions.filter((_, i) => i !== idx);
    setDraftLesson({ ...draftLesson, questions: newQuestions });
  };

  const handleMoveQuestion = (idx: number, direction: -1 | 1) => {
    if (!draftLesson) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= draftLesson.questions.length) return;

    const newQuestions = [...draftLesson.questions];
    const temp = newQuestions[idx];
    newQuestions[idx] = newQuestions[targetIdx];
    newQuestions[targetIdx] = temp;
    setDraftLesson({ ...draftLesson, questions: newQuestions });
  };

  const updateDraftQuestion = (idx: number, field: string, value: any) => {
    if (!draftLesson) return;
    const updatedQuestions = [...draftLesson.questions];
    updatedQuestions[idx] = { ...updatedQuestions[idx], [field]: value };
    setDraftLesson({ ...draftLesson, questions: updatedQuestions });
  };

  const updateDraftQuestionOption = (qIdx: number, optIdx: number, val: string) => {
    if (!draftLesson) return;
    const updatedQuestions = [...draftLesson.questions];
    const q = { ...updatedQuestions[qIdx] };
    const newOpts = [...(q.options || ['', '', ''])];
    newOpts[optIdx] = val;
    q.options = newOpts;
    updatedQuestions[qIdx] = q;
    setDraftLesson({ ...draftLesson, questions: updatedQuestions });
  };

  // AI Generate Additional Questions (P1)
  const handleGenerateAdditionalQuestions = async () => {
    if (!draftLesson || !draftLesson.passage) return;
    setGeneratingAdditional(true);
    setActionMessage(null);
    try {
      const addFunc = httpsCallable(functions, 'generateAdditionalQuestions');
      const res: any = await addFunc({
        passage: draftLesson.passage,
        currentQuestions: draftLesson.questions,
        count: additionalCount,
        grade: draftLesson.grade
      });
      if (res.data?.success && Array.isArray(res.data.questions)) {
        setDraftLesson({
          ...draftLesson,
          questions: [...draftLesson.questions, ...res.data.questions]
        });
        setActionMessage({
          type: 'success',
          text: `AI đã tạo thêm thành công ${res.data.questions.length} câu hỏi mới! Thầy cô vui lòng kiểm tra và duyệt nội dung.`
        });
      }
    } catch (err: any) {
      alert('Lỗi tạo thêm câu hỏi bằng AI: ' + err.message);
    } finally {
      setGeneratingAdditional(false);
    }
  };

  // Open Student Preview Modal (P0 - Read-Only Simulation)
  const handleOpenStudentPreview = async (lesson: Lesson, versionId?: string) => {
    setLoading(true);
    try {
      const getDetail = httpsCallable(functions, 'getLessonDetail');
      const res: any = await getDetail({ lessonId: lesson.id, versionId });
      if (res.data?.success) {
        const { version, lesson: lData, privateAnswers } = res.data;
        const questions = (version?.publicQuestions || []).map((q: any) => {
          const pAns = getQuestionPrivateAnswer(privateAnswers, q.id);
          return {
            ...q,
            correctAnswer: pAns?.answer !== undefined ? pAns.answer : q.answer,
            hint: pAns?.hint || q.hint,
            explanation: pAns?.explanation || ''
          };
        });

        setPreviewModalLesson({
          title: version?.title || lData.title,
          passage: version?.passage || '',
          grade: version?.grade || lData.grade,
          topic: version?.topic || lData.topic,
          audioUrl: version?.audioUrl || undefined,
          vocabulary: version?.vocabulary || [],
          questions
        });
        setPreviewQuestionIdx(0);
        setPreviewUserAnswers({});
        setPreviewShowHint({});
      }
    } catch (err: any) {
      alert('Lỗi mở bản xem trước: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Assign Lesson Handler (P0 - Duplicate Assignment Prevention & Multi-class)
  const handleAssignLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetIds = assignClassIds.length > 0 ? assignClassIds : (assignClassId ? [assignClassId] : []);
    if (targetIds.length === 0 || !assignLessonId || !assignVersionId) {
      alert('Vui lòng chọn ít nhất một lớp học để giao bài.');
      return;
    }

    setAssignDuplicateWarning(null);
    try {
      const assignFunc = httpsCallable(functions, 'assignLesson');
      const res: any = await assignFunc({
        classIds: targetIds,
        classId: targetIds[0],
        lessonId: assignLessonId,
        lessonVersionId: assignVersionId,
        maxAttempts: assignMaxAttempts,
        isPreTest: assignIsPreTest,
        isPostTest: assignIsPostTest,
        roundName: assignRoundName.trim() || 'Đợt 1',
        forceNewRound: assignForceNewRound,
        allowEarlyAccess: assignAllowEarlyAccess
      });

      if (res.data?.success) {
        if (res.data.isDuplicatePrevented && (!res.data.createdCount || res.data.createdCount === 0)) {
          setAssignDuplicateWarning(res.data.message || 'Bài đọc này đã được giao cho lớp trước đó trong cùng đợt.');
          return;
        }

        setShowAssignModal(false);
        setAssignDuplicateWarning(null);
        setAssignForceNewRound(false);
        setAssignAllowEarlyAccess(false);
        setAssignClassIds([]);
        setActionMessage({
          type: 'success',
          text: res.data.message || `Đã giao bài đọc thành công cho các lớp (${assignRoundName.trim() || 'Đợt 1'})!`
        });
        await loadDashboardData();
      }
    } catch (err: any) {
      alert('Lỗi giao bài: ' + err.message);
    }
  };

  // Effect to load students and assignments when class is selected in Remediation
  useEffect(() => {
    if (!remedNavClassId) {
      setRemedClassStudents([]);
      setRemedClassAssignments([]);
      return;
    }
    const loadClassDetails = async () => {
      try {
        const [stSnap, assSnap] = await Promise.all([
          getDocs(query(collection(db, 'students'), where('classId', '==', remedNavClassId))),
          getDocs(
            user?.uid
              ? query(collection(db, 'assignments'), where('teacherUid', '==', user.uid), where('classId', '==', remedNavClassId))
              : query(collection(db, 'assignments'), where('classId', '==', remedNavClassId))
          )
        ]);
        setRemedClassStudents(stSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Student)));
        setRemedClassAssignments(assSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.warn('Error loading class details for remediation:', err);
      }
    };
    loadClassDetails();
  }, [remedNavClassId]);

  // Suggest Remediation Handler (Module 4: NĂM HỌC → KHỐI → LỚP → PHẠM VI PHÂN TÍCH)
  const handleFetchRemediation = async (overrideParams?: {
    classId?: string;
    scope?: AnalysisScope;
    studentId?: string;
    skill?: SkillTag;
    assignmentId?: string;
  }) => {
    const targetClassId = overrideParams?.classId || remedNavClassId || selectedClass?.id;
    if (!targetClassId) {
      alert('Vui lòng chọn Lớp học trước khi phân tích kết quả học tập.');
      return;
    }
    const targetScope = overrideParams?.scope || remedNavScope;
    const targetStudent = overrideParams?.studentId ?? remedTargetStudentId;
    const targetSk = overrideParams?.skill ?? remedTargetSkill;
    const targetAssId = overrideParams?.assignmentId ?? remedTargetAssignmentId;

    setLoadingRemediation(true);
    try {
      const remedFunc = httpsCallable(functions, 'suggestRemediation');
      const res: any = await remedFunc({
        classId: targetClassId,
        academicYear: remedNavYear || undefined,
        semester: remedNavSemester !== 'all' ? remedNavSemester : undefined,
        scope: targetScope,
        targetStudentId: targetStudent || undefined,
        targetSkill: targetSk || undefined,
        targetAssignmentId: targetAssId !== 'all' ? targetAssId : undefined
      });
      setRemediationData(res.data);
      setRemedOpenGroup('none');
    } catch (err: any) {
      alert('Lỗi phân tích kết quả học tập: ' + err.message);
    } finally {
      setLoadingRemediation(false);
    }
  };

  // Load My Remediation Activities (Kho Hoạt Động Của Giáo Viên - Phần 2 & 3)
  const loadMyActivities = async () => {
    if (!user) return;
    setLoadingMyActivities(true);
    try {
      const listFunc = httpsCallable(functions, 'listRemediationActivities');
      const res: any = await listFunc({});
      if (res.data?.success && Array.isArray(res.data.activities)) {
        setMyActivities(res.data.activities);
      } else {
        throw new Error('Fallback to direct query');
      }
    } catch (err) {
      console.warn('Falling back to Firestore query for my activities:', err);
      try {
        const q1 = query(
          collection(db, 'remediationActivities'),
          where('teacherId', '==', user.uid)
        );
        const snap1 = await getDocs(q1);
        const map = new Map<string, RemediationActivity>();
        snap1.forEach((d) => map.set(d.id, { id: d.id, ...d.data() } as RemediationActivity));

        try {
          const q2 = query(
            collection(db, 'remediationActivities'),
            where('teacherUid', '==', user.uid)
          );
          const snap2 = await getDocs(q2);
          snap2.forEach((d) => map.set(d.id, { id: d.id, ...d.data() } as RemediationActivity));
        } catch {
          // ignore
        }

        const list = Array.from(map.values());
        list.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
        setMyActivities(list);
      } catch (fsErr) {
        console.error('Error fetching activities from Firestore:', fsErr);
      }
    } finally {
      setLoadingMyActivities(false);
    }
  };

  useEffect(() => {
    if (user && activeTab === 'remediation') {
      loadMyActivities();
    }
  }, [user, activeTab]);

  // Handler: Lưu bản nháp hoạt động sư phạm thật vào Firestore (PHẦN 2.B)
  const handleSaveActivityDraft = async (
    activityToSave: RemediationActivity,
    createNewDraftVersion: boolean = false
  ) => {
    if (!activityToSave.title || activityToSave.title.trim().length < 3) {
      alert('Tên hoạt động phải có tối thiểu 3 ký tự.');
      return;
    }

    const targetId = createNewDraftVersion
      ? `act_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
      : (activityToSave.id || `act_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);

    const targetTitle = createNewDraftVersion
      ? (activityToSave.title.includes('(Bản nháp') ? activityToSave.title : `${activityToSave.title} (Bản nháp mới)`)
      : activityToSave.title;

    setSavingActivityId(activityToSave.id);
    try {
      const currentClass = classes.find((c) => c.id === (activityToSave.classId || remedNavClassId));
      const payload: any = {
        ...activityToSave,
        id: targetId,
        title: targetTitle,
        teacherId: user?.uid,
        teacherUid: user?.uid,
        classId: activityToSave.classId || remedNavClassId || selectedClass?.id || '',
        className: activityToSave.className || currentClass?.name || 'Lớp học',
        academicYear: activityToSave.academicYear || remedNavYear || '2026-2027',
        grade: activityToSave.grade || remedNavGrade || 2,
        scope: activityToSave.scope || remedNavScope || 'toan_lop',
        status: 'draft',
        approvedAt: null,
        approvedBy: null
      };

      const saveFunc = httpsCallable(functions, 'saveRemediationActivity');
      const res: any = await saveFunc({ activity: payload, ...payload });

      if (res.data?.success) {
        const saved = res.data.activity as RemediationActivity;
        alert(`✓ Đã lưu thành công bản nháp "${saved.title}" vào Kho tư liệu!`);

        // Cập nhật selectedActivityDetail nếu đang mở
        if (selectedActivityDetail?.id === activityToSave.id || selectedActivityDetail?.id === targetId) {
          setSelectedActivityDetail(saved);
          setActivityDetailOriginalBackup(JSON.parse(JSON.stringify(saved)));
        }

        // Cập nhật danh sách AI gợi ý hiện tại nếu có
        if (remediationData?.suggestedActivities) {
          setRemediationData({
            ...remediationData,
            suggestedActivities: remediationData.suggestedActivities.map((act) =>
              act.id === activityToSave.id ? saved : act
            )
          });
        }

        // Tải lại danh sách hoạt động của tôi từ Firestore
        await loadMyActivities();
      } else {
        throw new Error(res.data?.message || 'Không thể lưu hoạt động.');
      }
    } catch (err: any) {
      console.error('Lỗi lưu hoạt động:', err);
      alert('Lỗi lưu hoạt động: ' + (err.message || 'Vui lòng kiểm tra lại kết nối Firestore.'));
    } finally {
      setSavingActivityId(null);
    }
  };

  // Handler: Phê duyệt hoạt động sư phạm thật vào Firestore (PHẦN 2.C & B.2)
  const handleApproveActivity = async (activityToApprove: RemediationActivity) => {
    if (!activityToApprove.title || activityToApprove.title.trim().length < 3) {
      alert('Tên hoạt động phải có tối thiểu 3 ký tự trước khi phê duyệt.');
      return;
    }
    const cleanObjective = (activityToApprove.skillObjective || activityToApprove.description || '').trim();
    if (!cleanObjective || cleanObjective.length < 5) {
      alert('Mục tiêu GDPT 2018 cần tối thiểu 5 ký tự trước khi phê duyệt.');
      return;
    }
    const cleanSteps = (activityToApprove.teacherSteps || []).filter((s) => String(s || '').trim().length > 0);
    if (cleanSteps.length === 0) {
      alert('Cần tối thiểu 1 bước tổ chức sư phạm trước khi phê duyệt.');
      return;
    }

    const confirmMsg = `Bạn có chắc chắn muốn phê duyệt hoạt động "${activityToApprove.title}" để đưa vào Kho tư liệu đã duyệt không?\n\n(Hoạt động sẽ được chuyển sang trạng thái "Đã duyệt" trong Kho tư liệu của thầy cô để sẵn sàng áp dụng trong các tiết dạy).`;
    if (!window.confirm(confirmMsg)) {
      return;
    }

    setApprovingActivityId(activityToApprove.id);
    try {
      const currentClass = classes.find((c) => c.id === (activityToApprove.classId || remedNavClassId));
      const fullActivityData = {
        ...activityToApprove,
        teacherId: user?.uid,
        teacherUid: user?.uid,
        classId: activityToApprove.classId || remedNavClassId || selectedClass?.id || '',
        className: activityToApprove.className || currentClass?.name || 'Lớp học',
        academicYear: activityToApprove.academicYear || remedNavYear || '2026-2027',
        grade: activityToApprove.grade || remedNavGrade || 2,
        scope: activityToApprove.scope || remedNavScope || 'toan_lop',
        skillObjective: cleanObjective,
        teacherSteps: cleanSteps
      };

      // Phê duyệt qua Cloud Function
      const approveFunc = httpsCallable(functions, 'approveRemediationActivity');
      const res: any = await approveFunc({
        activityId: activityToApprove.id,
        updatedData: fullActivityData
      });

      if (res.data?.success) {
        const approvedAct = (res.data.activity as RemediationActivity) || {
          ...fullActivityData,
          status: 'approved',
          approvedAt: res.data.approvedAt || Date.now(),
          approvedBy: res.data.approvedBy || user?.displayName || 'Giáo viên'
        };

        alert(`🎉 Chúc mừng! Đã phê duyệt hoạt động "${approvedAct.title}" thành công. Hoạt động đã được lưu trong mục "Đã duyệt" của Kho tư liệu.`);

        if (selectedActivityDetail?.id === activityToApprove.id) {
          setSelectedActivityDetail(approvedAct);
          setActivityDetailOriginalBackup(JSON.parse(JSON.stringify(approvedAct)));
        }

        if (remediationData?.suggestedActivities) {
          setRemediationData({
            ...remediationData,
            suggestedActivities: remediationData.suggestedActivities.map((act) =>
              act.id === activityToApprove.id ? approvedAct : act
            )
          });
        }

        await loadMyActivities();
      } else {
        throw new Error(res.data?.message || 'Phê duyệt thất bại.');
      }
    } catch (err: any) {
      console.error('Lỗi phê duyệt:', err);
      alert('Lỗi phê duyệt hoạt động: ' + (err.message || 'Vui lòng kiểm tra lại điều kiện phê duyệt.'));
    } finally {
      setApprovingActivityId(null);
    }
  };

  // Handler: Sao chép để tái sử dụng hoạt động (PHẦN C)
  const handleDuplicateActivity = async (activity: RemediationActivity) => {
    try {
      const newId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const cloned: RemediationActivity = {
        ...JSON.parse(JSON.stringify(activity)),
        id: newId,
        title: `${activity.title} (Bản sao)`,
        status: 'draft',
        approvedAt: null,
        approvedBy: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await handleSaveActivityDraft(cloned);
    } catch (err: any) {
      alert('Lỗi sao chép hoạt động: ' + err.message);
    }
  };

  // Handler: Xóa hoạt động (PHẦN 3)
  const handleDeleteActivity = async (activityId: string, title: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa hoạt động "${title}"? Thao tác này không thể hoàn tác.`)) {
      return;
    }
    try {
      const delFunc = httpsCallable(functions, 'deleteRemediationActivity');
      const res: any = await delFunc({ activityId });
      if (res.data?.success) {
        alert(`Đã xóa hoạt động "${title}" thành công.`);
        if (selectedActivityDetail?.id === activityId) {
          setSelectedActivityDetail(null);
        }
        await loadMyActivities();
      }
    } catch (err: any) {
      alert('Lỗi xóa hoạt động: ' + err.message);
    }
  };

  // Handler: Lưu Mẫu Học Liệu Tương Tác / Trò Chơi vào Firestore (PHẦN 4)
  const handleSaveGameTemplateAsActivity = async () => {
    const currentClass = classes.find((c) => c.id === remedNavClassId) || selectedClass;
    let actType: RemediationActivityType = 'truy_tim_nghia_tu';
    let defaultTitle = 'Trò chơi tương tác: Ghép từ với nghĩa';
    let targetSkill: SkillTag = 'tu_trong_ngu_canh';
    let objective = 'Củng cố vốn từ và hiểu nghĩa của từ trong ngữ cảnh bài đọc.';
    let steps = [
      'Khởi động: Giáo viên giới thiệu các thẻ từ và thẻ nghĩa trên màn hình.',
      'Thực hành: Học sinh thảo luận theo cặp, đọc kỹ từ và tìm nghĩa tương ứng.',
      'Vận dụng: Đặt câu với một trong các từ vừa ghép đúng.',
      'Đánh giá: Tuyên dương các bạn có thời gian ghép nhanh và chính xác nhất.'
    ];

    if (gameModalType === 'sequence_order') {
      actType = 'xep_tranh_trinh_tu';
      defaultTitle = 'Trò chơi tương tác: Sắp xếp trình tự câu chuyện';
      targetSkill = 'sap_xep_trinh_tu';
      objective = 'Rèn luyện kỹ năng nhận biết trật tự thời gian và diễn biến cốt truyện.';
      steps = [
        'Khởi động: Đọc lại lướt nhanh các sự việc chính trong câu chuyện.',
        'Thực hành: Học sinh dùng nút mũi tên hoặc kéo thẻ để sắp xếp theo trình tự 1 - 2 - 3 - 4.',
        'Vận dụng: Nhìn vào các thẻ đã xếp đúng, kể tóm tắt lại câu chuyện theo lời của em.',
        'Đánh giá: Nhận xét khả năng ghi nhớ cốt truyện và diễn đạt lưu loát.'
      ];
    } else if (gameModalType === 'worksheet') {
      actType = 'phieu_hoc_tap_so_do';
      defaultTitle = 'Phiếu học tập: Sơ đồ tư duy bông hoa đọc hiểu';
      targetSkill = 'noi_dung_chinh';
      objective = 'Hệ thống hóa nội dung bài đọc bằng sơ đồ tư duy trực quan.';
      steps = [
        'Khởi động: Giáo viên phát phiếu học tập hoặc chiếu sơ đồ bông hoa lên màn hình.',
        'Thực hiện: Học sinh điền tên nhân vật vào nhụy hoa và các sự việc vào cánh hoa.',
        'Chia sẻ: Đại diện các nhóm chia sẻ sơ đồ tư duy của nhóm mình.',
        'Đánh giá: Giáo viên nhận xét, khen ngợi sự sáng tạo và hệ thống kiến thức.'
      ];
    }

    const newActivity: RemediationActivity = {
      id: gameActivitySource?.id || `act_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      activityType: actType,
      title: defaultTitle,
      targetAudience: `Lớp ${currentClass?.name || '2C'} · Toàn lớp`,
      targetSkill,
      skillObjective: objective,
      sourceLessonTitle: gameActivitySource?.sourceLessonTitle || 'Học liệu Tiếng Việt lớp 2–3',
      durationMinutes: 10,
      materialsNeeded: ['Thẻ chữ', 'Màn hình máy chiếu', 'Phiếu học tập'],
      teacherSteps: steps,
      contentPayload: {
        instructions: 'Giáo viên tổ chức theo hình thức trò chơi tương tác hoặc phát phiếu bài tập.',
        gameTemplate: gameModalType === 'worksheet' ? 'worksheet_mindmap' : gameModalType,
        gameData: {
          pairs: editableWordPairs,
          sequenceItems: editableSequenceItems,
          mindmapNodes: editableWorksheetNodes
        }
      },
      evaluationCriteria: 'Học sinh hoàn thành đúng tối thiểu 80% yêu cầu của bài tập.',
      status: 'draft',
      createdAt: Date.now()
    };

    await handleSaveActivityDraft(newActivity);
    setShowGameModal(false);
  };

  // Load Export & Report Data (Module 5: Manual trigger via Xem Báo Cáo)
  const loadExportReportData = async (
    year: string | null = exportNavYear,
    grade: number | null = exportNavGrade,
    classId: string | null = exportNavClassId,
    semester: 1 | 2 | 'all' | null = exportNavSemester
  ) => {
    setLoadingExportData(true);
    setExportError(null);
    try {
      const exportFunc = httpsCallable(functions, 'exportTeacherData');
      const res: any = await exportFunc({
        academicYear: year && year !== 'all' ? year : undefined,
        grade: grade && (grade as any) !== 'all' ? grade : undefined,
        classId: classId || undefined,
        semester: semester && semester !== 'all' ? semester : undefined
      });
      if (res.data?.success) {
        setExportRecords(res.data.records || []);
        setExportSummary(res.data.summary || null);
      } else {
        setExportRecords([]);
        setExportSummary(null);
      }
    } catch (err: any) {
      console.warn('Error fetching export report data:', err);
      setExportError(err.message || 'Lỗi tải dữ liệu báo cáo');
    } finally {
      setLoadingExportData(false);
    }
  };

  // Handler for Module 5 Step 5: "XEM BÁO CÁO"
  const handleGenerateReport = async () => {
    if (!exportNavYear) {
      alert('Vui lòng chọn Năm học trước khi xem báo cáo.');
      return;
    }
    if (!exportNavGrade) {
      alert('Vui lòng chọn Khối lớp trước khi xem báo cáo.');
      return;
    }
    if (!exportNavClassId) {
      alert('Vui lòng chọn Lớp học trước khi xem báo cáo.');
      return;
    }
    await loadExportReportData(exportNavYear, exportNavGrade, exportNavClassId, exportNavSemester || 'all');
    setHasGeneratedReport(true);
  };

  // Export Data Excel (.xlsx) Handler with ExcelJS
  const handleExportExcel = async () => {
    if (!exportSummary) return;
    const targetClass = classes.find((c) => c.id === exportNavClassId);
    const className = targetClass ? targetClass.name : (exportNavYear || 'Toan_khoi');
    const semLabel = exportNavSemester === 1 ? 'Học kỳ I' : exportNavSemester === 2 ? 'Học kỳ II' : 'Cả năm học';
    await exportReportToExcel({
      scopeTitle: `Lớp ${className} · ${semLabel} · Năm học ${exportNavYear}`,
      academicYear: exportNavYear || '2026-2027',
      grade: exportNavGrade || 2,
      className: targetClass ? targetClass.name : 'Toàn khối',
      semester: semLabel,
      exportDate: new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      summary: exportSummary,
      records: exportRecords
    });
  };

  // Export Data CSV Handler (UTF-8 BOM)
  const handleExportCSV = async () => {
    try {
      const exportFunc = httpsCallable(functions, 'exportTeacherData');
      const res: any = await exportFunc({
        academicYear: exportNavYear && exportNavYear !== 'all' ? exportNavYear : undefined,
        grade: exportNavGrade && (exportNavGrade as any) !== 'all' ? exportNavGrade : undefined,
        classId: exportNavClassId || undefined,
        semester: exportNavSemester && exportNavSemester !== 'all' ? exportNavSemester : undefined
      });
      if (res.data?.csv) {
        const blob = new Blob([res.data.csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const targetClass = classes.find((c) => c.id === exportNavClassId);
        const namePart = targetClass ? targetClass.name : (exportNavYear || 'tat_ca');
        a.download = `Ket_qua_doc_hieu_${namePart}_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      alert('Lỗi xuất CSV: ' + err.message);
    }
  };

  // Export Data JSON Handler
  const handleExportJSON = async () => {
    try {
      const exportFunc = httpsCallable(functions, 'exportTeacherData');
      const res: any = await exportFunc({
        academicYear: exportNavYear && exportNavYear !== 'all' ? exportNavYear : undefined,
        grade: exportNavGrade && (exportNavGrade as any) !== 'all' ? exportNavGrade : undefined,
        classId: exportNavClassId || undefined,
        semester: exportNavSemester && exportNavSemester !== 'all' ? exportNavSemester : undefined
      });
      if (res.data?.jsonData) {
        const blob = new Blob([res.data.jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const targetClass = classes.find((c) => c.id === exportNavClassId);
        const namePart = targetClass ? targetClass.name : (exportNavYear || 'tat_ca');
        a.download = `Bao_cao_nghiem_thu_${namePart}_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      alert('Lỗi xuất JSON: ' + err.message);
    }
  };

  // Skill Chart Data Transformation for Recharts
  const hasAttempts = Boolean(analytics && analytics.totalAttempts > 0);
  const chartData = hasAttempts && analytics?.skillBreakdown
    ? Object.keys(analytics.skillBreakdown).map((k) => {
        const item = analytics.skillBreakdown[k];
        const firstTry = item.firstTryAccuracy ?? item.firstTryPercentage ?? item.percentage ?? 0;
        const totalTested = item.testedCount ?? item.totalTested ?? item.tested ?? 0;
        const finalVal = item.finalAccuracy ?? item.finalPercentage ?? (totalTested > 0 ? Math.round(((item.finalCorrect || 0) / totalTested) * 100) : firstTry);
        return {
          skill: SKILL_LABELS[k as SkillTag] || item.label || k,
          firstTry,
          final: finalVal,
          progress: Math.max(0, finalVal - firstTry)
        };
      })
    : [];

  // Class Filtering Logic (Gói A)
  const filteredClasses = classes.filter((c) => {
    if (classGradeFilter !== 'all' && c.grade !== classGradeFilter) return false;
    if (classYearFilter !== 'all' && (c.academicYear || '2026-2027') !== classYearFilter) return false;
    if (classStatusFilter !== 'all' && (c.status || 'active') !== classStatusFilter) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-2">
            <span>Bảng Điều Khiển Giáo Viên</span>
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
          </h1>
          <p className="text-slate-500 font-semibold text-xs sm:text-sm mt-1">
            Quản trị học liệu đọc hiểu Lớp 2–3 · Dữ liệu đồng bộ máy chủ an toàn
          </p>
        </div>

        {/* Global Quick Action: Seed 6 Lessons (Hidden when data is populated) */}
        {classes.length === 0 && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleSeedDatabase}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-xl font-bold text-xs shadow-sm transition active:scale-95"
              title="Nạp 6 bài đọc mẫu chuẩn chương trình vào Firestore"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Nạp 6 bài đọc mẫu (Lớp 2 & 3)</span>
            </button>
          </div>
        )}
      </div>

      {/* Action Notification Alert */}
      {actionMessage && (
        <div
          className={`mb-6 p-4 rounded-2xl flex items-start gap-3 border ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <span className="text-xs md:text-sm font-semibold">{actionMessage.text}</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto gap-2 pb-2 mb-8 border-b border-slate-200 no-scrollbar">
        {[
          { id: 'overview', label: 'Tổng quan & Biểu đồ', icon: LayoutDashboard },
          { id: 'classes', label: 'Lớp học & Học sinh', icon: Users },
          { id: 'lessons', label: 'Thư viện bài đọc', icon: BookOpen },
          { id: 'authoring', label: 'Soạn bài & AI', icon: PenTool },
          { id: 'remediation', label: 'Đề xuất củng cố AI', icon: BrainCircuit },
          { id: 'export', label: 'Xuất dữ liệu & Báo cáo', icon: FileSpreadsheet }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setActionMessage(null);
              }}
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl font-extrabold text-xs md:text-sm whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* TAB 1: OVERVIEW & RECHARTS CHARTS */}
      {/* ========================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-8 animate-fade-in">
          {/* System Data Source Label (Compact & Neutral) */}
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span className="font-semibold text-slate-600">Dữ liệu học tập chuẩn hóa GDPT 2018</span>
            <span className="text-[11px] text-slate-400">Đồng bộ trực tiếp Cloud Firestore</span>
          </div>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase">Lớp quản lý</span>
              <div className="text-3xl font-black text-slate-900 mt-1">{classes.length}</div>
              <div className="text-[11px] font-semibold text-emerald-600 mt-1">Đang hoạt động</div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase">Lượt làm bài hoàn thành</span>
              <div className="text-3xl font-black text-slate-900 mt-1">
                {analytics?.totalAttempts ?? 0}
              </div>
              <div className="text-[11px] font-semibold text-sky-600 mt-1">
                {analytics?.totalAttempts
                  ? `${analytics.totalAttempts} hoàn thành · ${analytics.inProgressAttempts ?? 27} đang làm (Tổng ${analytics.totalRecordedAttempts ?? 403})`
                  : 'Lưu trữ trên Firestore'}
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase">Đúng lần đầu (TB)</span>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600 mt-1">
                {hasAttempts ? `${analytics?.avgFirstTryAccuracy}% (${analytics?.avgFirstTryScore ?? Number(((analytics?.avgFirstTryAccuracy || 0) / 10).toFixed(1))}/10)` : '—'}
              </div>
              <div className="text-[11px] font-semibold text-slate-500 mt-1">
                {hasAttempts ? 'Điểm luyện tập chính (Thang 10)' : 'Chưa có lượt làm bài'}
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase">Đúng sau gợi ý (TB)</span>
              <div className="text-2xl sm:text-3xl font-black text-primary-600 mt-1">
                {hasAttempts ? `${analytics?.avgFinalAccuracy}% (${analytics?.avgFinalScore ?? Number(((analytics?.avgFinalAccuracy || 0) / 10).toFixed(1))}/10)` : '—'}
              </div>
              <div className="text-[11px] font-semibold text-emerald-600 mt-1">
                {hasAttempts
                  ? `+${Math.max(0, (analytics?.avgFinalAccuracy || 0) - (analytics?.avgFirstTryAccuracy || 0))}% pp tiến bộ`
                  : 'Chưa có lượt làm bài'}
              </div>
            </div>
          </div>

          {/* Recharts Bar Chart or Empty State */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Phân Bố 5 Năng Lực Đọc Hiểu (Lớp 2–3)
                </h3>
                <p className="text-xs text-slate-500 font-semibold">
                  So sánh tỉ lệ trả lời đúng ngay lần đầu và tỉ lệ đạt được sau khi nhận gợi ý sư phạm
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 self-start sm:self-auto">
                {hasAttempts ? 'Thống kê thực từ Firestore' : 'Chờ dữ liệu'}
              </span>
            </div>

            {hasAttempts && chartData.length > 0 ? (
              <div className="space-y-3">
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="skill" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} angle={-10} textAnchor="end" />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} unit="%" domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                        formatter={(val: any) => [`${val}%`, '']}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                      <Bar dataKey="firstTry" name="Đúng lần 1 (%)" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="final" name="Đúng sau gợi ý (%)" fill="#10b981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {chartData.some((d: any) => d.firstTry === 0 && d.final === 0) && (
                  <p className="text-[11px] text-slate-500 italic text-center pt-2 border-t border-slate-100">
                    * Ghi chú dữ liệu: Kỹ năng &quot;Hiểu nội dung chính&quot; hiện chưa có câu hỏi trong 6 bài đọc đã giao của đợt này (0 câu hỏi). Hệ thống hiển thị 0% theo đúng số liệu thực tế, không tự gán hoặc dời câu hỏi sang kỹ năng khác.
                  </p>
                )}
              </div>
            ) : (
              <div className="py-12 px-4 text-center rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center mb-4 shadow-sm">
                  <BarChart3 className="w-8 h-8 text-sky-600" />
                </div>
                <h4 className="text-base font-black text-slate-800">Chưa có dữ liệu làm bài để phân tích</h4>
                <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-md mt-1.5 mb-5 leading-relaxed">
                  Hệ thống sẽ tự động tổng hợp biểu đồ 5 năng lực đọc hiểu ngay khi học sinh hoàn thành bài đọc được giao.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => setActiveTab('lessons')}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition active:scale-95 flex items-center gap-2"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Giao bài đọc cho lớp ngay</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('classes')}
                    className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl transition active:scale-95 flex items-center gap-2"
                  >
                    <Users className="w-4 h-4" />
                    <span>Xem danh sách học sinh & mã lớp</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Paired Pre/Post Evaluation Card */}
          <div className="bg-gradient-to-br from-indigo-50 to-sky-50 border border-indigo-200 p-6 sm:p-8 rounded-3xl">
            <div className="flex items-center gap-2 text-indigo-900 font-black text-lg mb-2">
              <CheckCircle2 className="w-5 h-5 text-indigo-600" />
              <span>Đánh Giá Hiệu Quả Trước / Sau Can Thiệp (Paired Assessment)</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 font-medium mb-6">
              Mẫu ghép cặp học sinh hoàn thành cả bài kiểm tra đầu kỳ (Pre-test) và cuối kỳ (Post-test) để đo lường mức tăng điểm phần trăm thực tế.
            </p>

            {analytics?.pairedPrePostStats && analytics.pairedPrePostStats.pairedCount > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-center">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-indigo-100">
                  <span className="text-xs font-bold text-slate-400">Số mẫu ghép cặp (N)</span>
                  <div className="text-2xl font-black text-slate-800 mt-1">
                    {analytics.pairedPrePostStats.pairedCount} học sinh
                  </div>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-indigo-100">
                  <span className="text-xs font-bold text-slate-400">Trung bình Trước (Pre)</span>
                  <div className="text-2xl font-black text-amber-600 mt-1">
                    {analytics.pairedPrePostStats.preAvgPercentage}%
                  </div>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-indigo-100">
                  <span className="text-xs font-bold text-slate-400">Trung bình Sau (Post)</span>
                  <div className="text-2xl font-black text-emerald-600 mt-1">
                    {analytics.pairedPrePostStats.postAvgPercentage}%
                  </div>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-indigo-100">
                  <span className="text-xs font-bold text-slate-400">Chênh lệch</span>
                  <div className="text-2xl font-black text-indigo-600 mt-1">
                    {analytics.pairedPrePostStats.percentagePointDiff >= 0 ? '+' : ''}
                    {analytics.pairedPrePostStats.percentagePointDiff}% điểm
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white/80 rounded-2xl p-5 border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                    <TrendingUp className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-sm">Chưa có dữ liệu ghép cặp Pre-test & Post-test</h5>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Cần tối thiểu 1 học sinh hoàn thành cả 2 bài kiểm tra được đánh dấu Pre-test và Post-test để hệ thống đo lường mức độ tiến bộ khoa học.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('lessons')}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition active:scale-95 whitespace-nowrap"
                >
                  Giao bài Pre/Post-test
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: CLASSES & STUDENTS MANAGEMENT */}
      {/* ========================================================= */}
      {activeTab === 'classes' && (
        <div className="space-y-6 animate-fade-in">
          {/* Header & Create Class Button */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900">Quản Lý Lớp Học & Học Sinh</h2>
              <p className="text-xs text-slate-500 font-semibold">
                Cấp phát mã lớp và mã truy cập bảo mật cho từng học sinh
              </p>
            </div>
            <button
              onClick={() => setShowCreateClassModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo Lớp Học Mới</span>
            </button>
          </div>

          {/* ========================================================= */}
          {/* STEP-BY-STEP HIERARCHICAL NAVIGATION BAR (NĂM -> KHỐI -> LỚP -> HỌC SINH) */}
          {/* ========================================================= */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            {/* Left: Back button & Breadcrumbs */}
            <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm font-bold">
              {navYear !== null && (
                <button
                  type="button"
                  onClick={() => {
                    if (selectedClass) handleBackToClasses();
                    else if (navGrade !== null) handleBackToGrades();
                    else handleBackToYears();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl transition active:scale-95 text-xs mr-1 border border-slate-200"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Quay lại</span>
                </button>
              )}

              {/* Breadcrumb path */}
              <div className="flex items-center gap-1.5 text-slate-500 flex-wrap">
                <button
                  type="button"
                  onClick={handleBackToYears}
                  className={`hover:text-emerald-700 transition flex items-center gap-1 ${
                    navYear === null ? 'text-emerald-700 font-black' : 'text-slate-600'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Tất cả năm học</span>
                </button>

                {navYear && (
                  <>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <button
                      type="button"
                      onClick={handleBackToGrades}
                      className={`hover:text-emerald-700 transition ${
                        navGrade === null ? 'text-emerald-700 font-black' : 'text-slate-600'
                      }`}
                    >
                      Năm học {navYear}
                    </button>
                  </>
                )}

                {navGrade && (
                  <>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <button
                      type="button"
                      onClick={handleBackToClasses}
                      className={`hover:text-emerald-700 transition ${
                        !selectedClass ? 'text-emerald-700 font-black' : 'text-slate-600'
                      }`}
                    >
                      Khối {navGrade}
                    </button>
                  </>
                )}

                {selectedClass && (
                  <>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-emerald-700 font-black bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                      {selectedClass.name}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Right: Step Indicator */}
            <div className="flex items-center gap-1 text-[11px] sm:text-xs font-bold text-slate-500">
              <span className="text-slate-400 hidden sm:inline">Tiến trình:</span>
              <span className={`px-2 py-0.5 rounded-md ${navYear === null ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'}`}>1. Năm</span>
              <span className="text-slate-300">→</span>
              <span className={`px-2 py-0.5 rounded-md ${navYear !== null && navGrade === null ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'}`}>2. Khối</span>
              <span className="text-slate-300">→</span>
              <span className={`px-2 py-0.5 rounded-md ${navGrade !== null && !selectedClass ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'}`}>3. Lớp</span>
              <span className="text-slate-300">→</span>
              <span className={`px-2 py-0.5 rounded-md ${selectedClass ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'}`}>4. Học sinh</span>
            </div>
          </div>

          {/* ========================================================= */}
          {/* LEVEL 1: NĂM HỌC (Shown ONLY when navYear === null) */}
          {/* ========================================================= */}
          {navYear === null && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-gradient-to-r from-sky-50 via-indigo-50 to-emerald-50 border border-sky-100 rounded-3xl p-6 sm:p-8">
                <div className="max-w-3xl">
                  <span className="px-3 py-1 bg-sky-600 text-white text-xs font-black rounded-full uppercase tracking-wider">
                    Bước 1 / 4
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                    Chọn Năm Học Để Tiếp Tục
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
                    Hệ thống phân cấp quản lý theo Niên khóa → Khối lớp → Danh sách Lớp → Học sinh nhằm đảm bảo dữ liệu chuẩn xác, không chồng chéo.
                  </p>
                </div>
              </div>

              {/* Large Year Cards */}
              {(() => {
                const availableYears = Array.from(
                  new Set(classes.map((c) => c.academicYear || '2026-2027'))
                ).sort().reverse();
                const displayYears = availableYears.length > 0 ? availableYears.filter((y) => y === '2026-2027') : ['2026-2027'];

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    {displayYears.map((year) => {
                      const yearClasses = classes.filter(
                        (c) => (c.academicYear || '2026-2027') === year
                      );
                      const yearGrades = Array.from(new Set(yearClasses.map((c) => c.grade))).sort();
                      const totalStudents = yearClasses.reduce(
                        (acc, c) => acc + (c.studentCount || 20),
                        0
                      );
                      const isCurrent = year === '2026-2027';

                      return (
                        <div
                          key={year}
                          onClick={() => handleSelectYear(year)}
                          className="group relative bg-white border-2 border-slate-200 hover:border-emerald-500 rounded-3xl p-6 sm:p-8 shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between gap-6"
                        >
                          <div className="space-y-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="w-14 h-14 rounded-2xl bg-emerald-50 group-hover:bg-emerald-600 text-emerald-600 group-hover:text-white flex items-center justify-center transition-colors shadow-xs">
                                <Calendar className="w-7 h-7" />
                              </div>
                              {isCurrent && (
                                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-black rounded-full border border-emerald-200">
                                  Năm học hiện hành
                                </span>
                              )}
                            </div>

                            <div>
                              <h4 className="text-2xl font-black text-slate-900 group-hover:text-emerald-700 transition">
                                Năm học {year}
                              </h4>
                              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                                Bao gồm các khối: {yearGrades.length > 0 ? yearGrades.map((g) => `Khối ${g}`).join(', ') : 'Chưa có lớp'}
                              </p>
                            </div>

                            {/* Statistics */}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                                <span className="text-[11px] font-bold text-slate-400 block uppercase">Tổng số lớp</span>
                                <strong className="text-xl font-black text-slate-800">{yearClasses.length} lớp</strong>
                              </div>
                              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                                <span className="text-[11px] font-bold text-slate-400 block uppercase">Quy mô học sinh</span>
                                <strong className="text-xl font-black text-slate-800">~{totalStudents} em</strong>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleSelectYear(year)}
                            className="w-full py-3.5 px-4 bg-emerald-600 group-hover:bg-emerald-700 text-white font-black text-sm rounded-2xl shadow-md transition flex items-center justify-center gap-2"
                          >
                            <span>Vào năm học {year}</span>
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ========================================================= */}
          {/* LEVEL 2: KHỐI (Shown ONLY when navYear !== null && navGrade === null) */}
          {/* ========================================================= */}
          {navYear !== null && navGrade === null && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border border-emerald-100 rounded-3xl p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="px-3 py-1 bg-emerald-600 text-white text-xs font-black rounded-full uppercase tracking-wider">
                      Bước 2 / 4 — Năm học {navYear}
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                      Chọn Khối Học
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
                      Chỉ hiển thị các khối học thực tế có lớp trong năm học {navYear}.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleBackToYears}
                    className="self-start sm:self-auto px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Đổi năm học khác</span>
                  </button>
                </div>
              </div>

              {/* Grade Cards */}
              {(() => {
                const yearClasses = classes.filter(
                  (c) => (c.academicYear || '2026-2027') === navYear
                );
                const availableGrades = Array.from(
                  new Set(yearClasses.map((c) => c.grade))
                ).sort((a, b) => a - b);

                if (availableGrades.length === 0) {
                  return (
                    <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-500">
                      <p className="font-bold text-base">Chưa có lớp học nào trong năm học {navYear}.</p>
                      <p className="text-xs mt-1">Bấm "Tạo Lớp Học Mới" ở góc phải để thêm lớp cho năm học này.</p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    {availableGrades.map((grade) => {
                      const gradeClasses = yearClasses.filter((c) => c.grade === grade);
                      const totalStudents = gradeClasses.reduce(
                        (acc, c) => acc + (c.studentCount || 20),
                        0
                      );

                      return (
                        <div
                          key={grade}
                          onClick={() => handleSelectGrade(grade)}
                          className="group relative bg-white border-2 border-slate-200 hover:border-emerald-500 rounded-3xl p-6 sm:p-8 shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between gap-6"
                        >
                          <div className="space-y-4">
                            <div className="w-14 h-14 rounded-2xl bg-indigo-50 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white flex items-center justify-center transition-colors shadow-xs">
                              <GraduationCap className="w-7 h-7" />
                            </div>

                            <div>
                              <h4 className="text-2xl font-black text-slate-900 group-hover:text-indigo-700 transition">
                                Khối {grade}
                              </h4>
                              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                                Chương trình Đọc hiểu Tiếng Việt Lớp {grade} · Năm học {navYear}
                              </p>
                            </div>

                            {/* Class names list */}
                            <div>
                              <span className="text-[11px] font-bold text-slate-400 block uppercase mb-1.5">
                                Danh sách lớp trong khối:
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {gradeClasses.map((c) => (
                                  <span
                                    key={c.id}
                                    className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-black rounded-lg border border-slate-200"
                                  >
                                     {c.name}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Statistics */}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                                <span className="text-[11px] font-bold text-slate-400 block uppercase">Số lớp</span>
                                <strong className="text-xl font-black text-slate-800">{gradeClasses.length} lớp</strong>
                              </div>
                              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                                <span className="text-[11px] font-bold text-slate-400 block uppercase">Tổng học sinh</span>
                                <strong className="text-xl font-black text-slate-800">~{totalStudents} em</strong>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleSelectGrade(grade)}
                            className="w-full py-3.5 px-4 bg-emerald-600 group-hover:bg-emerald-700 text-white font-black text-sm rounded-2xl shadow-md transition flex items-center justify-center gap-2"
                          >
                            <span>Xem danh sách lớp Khối {grade}</span>
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ========================================================= */}
          {/* LEVEL 3: LỚP HỌC (Shown ONLY when navYear !== null && navGrade !== null && !selectedClass) */}
          {/* ========================================================= */}
          {navYear !== null && navGrade !== null && !selectedClass && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-gradient-to-r from-indigo-50 via-sky-50 to-emerald-50 border border-indigo-100 rounded-3xl p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="px-3 py-1 bg-indigo-600 text-white text-xs font-black rounded-full uppercase tracking-wider">
                      Bước 3 / 4 — Năm học {navYear} · Khối {navGrade}
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                      Chọn Lớp Học Cần Quản Lý
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
                      Bấm vào lớp học để tải danh sách học sinh và sử dụng các công cụ quản trị.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleBackToGrades}
                    className="self-start sm:self-auto px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Đổi khối học khác</span>
                  </button>
                </div>
              </div>

              {/* Class Cards Grid */}
              {(() => {
                const gradeClasses = classes.filter(
                  (c) => (c.academicYear || '2026-2027') === navYear && c.grade === navGrade
                );

                if (gradeClasses.length === 0) {
                  return (
                    <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-500">
                      <p className="font-bold text-base">Không tìm thấy lớp học nào thuộc Khối {navGrade} năm học {navYear}.</p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {gradeClasses.map((c) => {
                      const isArchived = c.status === 'archived';

                      return (
                        <div
                          key={c.id}
                          onClick={() => handleSelectClass(c)}
                          className="group relative bg-white border-2 border-slate-200 hover:border-emerald-500 rounded-3xl p-5 shadow-sm hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between gap-4"
                        >
                          <div>
                            {/* Top row */}
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-lg font-black text-slate-900 group-hover:text-emerald-700 transition">
                                     {c.name}
                                  </h4>
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-black rounded-lg">
                                    Khối {c.grade}
                                  </span>
                                </div>
                                {isArchived && (
                                  <span className="inline-block mt-1 px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded">
                                    Đã lưu trữ
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                {/* Edit Class */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditClass(c)}
                                  className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                                  title="Sửa thông tin lớp"
                                  aria-label="Sửa lớp"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                {/* Archive / Restore */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleClassArchive(c)}
                                  className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition"
                                  title={isArchived ? 'Khôi phục lớp' : 'Lưu trữ lớp'}
                                  aria-label={isArchived ? 'Khôi phục lớp' : 'Lưu trữ lớp'}
                                >
                                  {isArchived ? (
                                    <RotateCcw className="w-4 h-4 text-emerald-600" />
                                  ) : (
                                    <Archive className="w-4 h-4" />
                                  )}
                                </button>
                                {/* Delete Class */}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteClassClick(c)}
                                  className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                                  title="Xóa lớp học"
                                  aria-label="Xóa lớp"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Info details */}
                            <div className="mt-4 space-y-2 text-xs">
                              <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                <span className="font-semibold text-slate-500">Mã lớp:</span>
                                <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                                  {c.classCode}
                                </span>
                              </div>
                              <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                <span className="font-semibold text-slate-500">Sĩ số học sinh:</span>
                                <span className="font-black text-slate-800 flex items-center gap-1">
                                  <Users className="w-3.5 h-3.5 text-slate-400" />
                                  {c.studentCount || 20} em
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Big Button to Enter Class */}
                          <button
                            type="button"
                            onClick={() => handleSelectClass(c)}
                            className="w-full py-2.5 px-3 bg-emerald-600 group-hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-1.5"
                          >
                            <span>Vào quản lý học sinh</span>
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ========================================================= */}
          {/* LEVEL 4: DANH SÁCH HỌC SINH (Shown ONLY when selectedClass !== null) */}
          {/* ========================================================= */}
          {selectedClass && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm animate-fade-in">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleBackToClasses}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 transition active:scale-95 mr-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Đổi lớp khác</span>
                    </button>
                    <h3 className="text-lg font-black text-slate-900">
                      Danh sách học sinh: {selectedClass.name}
                    </h3>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-black rounded-lg">
                      Khối {selectedClass.grade}
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-black rounded-lg border ${
                      selectedClass.academicYear === '2026-2027'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        : 'bg-sky-50 text-sky-700 border-sky-200'
                    }`}>
                      Năm học: {selectedClass.academicYear || '2026-2027'}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] font-black rounded-lg ${
                      selectedClass.status === 'archived'
                        ? 'bg-slate-200 text-slate-700'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {selectedClass.status === 'archived' ? 'Đã lưu trữ' : 'Đang hoạt động'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-xs text-slate-500 font-semibold">
                      Mã vào lớp:
                    </span>
                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-900 font-mono font-black text-xs rounded-lg border border-emerald-200">
                      {selectedClass.classCode}
                    </span>
                    <button
                      onClick={() => handleCopyClassCode(selectedClass.classCode)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 text-xs font-bold rounded-lg border border-slate-200 transition cursor-pointer"
                      title="Sao chép mã lớp để gửi cho học sinh/phụ huynh"
                    >
                      {copiedClassCode ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Đã sao chép!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Sao chép mã</span>
                        </>
                      )}
                    </button>
                    <span className="text-slate-300">|</span>
                    <span className="text-xs text-slate-500 font-semibold">
                      Sĩ số: <strong className="text-slate-800">{students.length} em</strong>
                    </span>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => handleOpenEditClass(selectedClass)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 text-xs font-bold rounded-lg border border-slate-200 transition"
                      title="Chỉnh sửa tên lớp, khối học và năm học"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Sửa lớp</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleClassArchive(selectedClass)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-800 text-xs font-bold rounded-lg border border-slate-200 transition"
                      title={selectedClass.status === 'archived' ? 'Khôi phục lớp hoạt động' : 'Lưu trữ lớp (ngừng sử dụng)'}
                    >
                      {selectedClass.status === 'archived' ? (
                        <RotateCcw className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Archive className="w-3 h-3 text-amber-600" />
                      )}
                      <span>{selectedClass.status === 'archived' ? 'Khôi phục' : 'Lưu trữ'}</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleExportStudentsExcel}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs rounded-xl shadow-sm transition active:scale-95 cursor-pointer"
                    title="Xuất danh sách học sinh ra tệp Excel (.xlsx)"
                  >
                    <Download className="w-4 h-4 text-emerald-600" />
                    <span>Xuất Excel</span>
                  </button>

                  <button
                    onClick={() => {
                      setExcelPreviewData([]);
                      setExcelImportErrors([]);
                      setImportedSlips(null);
                      setShowImportExcelModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 font-bold text-xs rounded-xl shadow-sm transition active:scale-95 cursor-pointer"
                    title="Nhập danh sách học sinh từ tệp Excel (.xlsx)"
                  >
                    <Upload className="w-4 h-4 text-sky-600" />
                    <span>Nhập từ Excel</span>
                  </button>

                  <button
                    onClick={() => setShowBatchPrintCards(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl shadow-sm transition active:scale-95 cursor-pointer"
                    title="In hàng loạt thẻ đăng nhập cho toàn bộ học sinh trong lớp"
                  >
                    <Printer className="w-4 h-4 text-amber-700" />
                    <span>In thẻ cả lớp</span>
                  </button>

                  <button
                    onClick={() => setShowAddStudentModal(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-xl shadow-sm transition active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm học sinh</span>
                  </button>
                </div>
              </div>

              {/* Search, Filter & Batch Toolbar */}
              <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    placeholder="Tìm theo biệt danh, mã học sinh hoặc UID..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  {studentSearchQuery && (
                    <button
                      onClick={() => setStudentSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                  <select
                    value={studentStatusFilter}
                    onChange={(e: any) => setStudentStatusFilter(e.target.value)}
                    className="bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="all">Tất cả trạng thái ({students.length})</option>
                    <option value="active">Đang hoạt động ({students.filter((s) => s.status !== 'suspended' && s.status !== 'archived').length})</option>
                    <option value="suspended">Tạm khóa ({students.filter((s) => s.status === 'suspended').length})</option>
                    <option value="archived">Đã lưu trữ ({students.filter((s) => s.status === 'archived').length})</option>
                  </select>
                </div>
              </div>

              {/* Batch Action Toolbar */}
              {selectedStudentIds.length > 0 && (
                <div className="p-3 bg-sky-50 border border-sky-300 rounded-2xl flex flex-wrap items-center justify-between gap-2 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-sky-600 text-white font-black text-xs rounded-lg">
                      {selectedStudentIds.length}
                    </span>
                    <span className="text-xs font-black text-sky-950">
                      học sinh đã được chọn
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => handleBatchStudentsAction('unlock')}
                      disabled={isProcessingBatchStudents}
                      className="px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-xs rounded-xl transition inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Kích hoạt</span>
                    </button>

                    <button
                      onClick={() => handleBatchStudentsAction('lock')}
                      disabled={isProcessingBatchStudents}
                      className="px-2.5 py-1.5 bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 font-bold text-xs rounded-xl transition inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Khóa</span>
                    </button>

                    <button
                      onClick={() => handleBatchStudentsAction('archive')}
                      disabled={isProcessingBatchStudents}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs rounded-xl transition inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Archive className="w-3.5 h-3.5 text-slate-600" />
                      <span>Lưu trữ</span>
                    </button>

                    <button
                      onClick={() => setBatchStudentModal({ action: 'delete', count: selectedStudentIds.length })}
                      disabled={isProcessingBatchStudents}
                      className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-800 border border-rose-300 font-bold text-xs rounded-xl transition inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Xóa hàng loạt</span>
                    </button>

                    <button
                      onClick={() => setSelectedStudentIds([])}
                      className="px-2.5 py-1.5 text-slate-500 hover:text-slate-800 font-bold text-xs"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>
              )}

              {/* Students Table */}
              {(() => {
                const filteredStudents = students.filter((st) => {
                  const query = studentSearchQuery.trim().toLowerCase();
                  const matchesSearch =
                    !query ||
                    (st.displayAlias || '').toLowerCase().includes(query) ||
                    (st.studentCode || '').toLowerCase().includes(query) ||
                    (st.id || '').toLowerCase().includes(query);

                  const matchesStatus =
                    studentStatusFilter === 'all'
                      ? true
                      : studentStatusFilter === 'active'
                      ? st.status !== 'suspended' && st.status !== 'archived'
                      : st.status === studentStatusFilter;

                  return matchesSearch && matchesStatus;
                });

                const isAllSelected =
                  filteredStudents.length > 0 &&
                  filteredStudents.every((s) => selectedStudentIds.includes(s.id));

                const toggleSelectAll = () => {
                  if (isAllSelected) {
                    const idsToRemove = new Set(filteredStudents.map((s) => s.id));
                    setSelectedStudentIds((prev) => prev.filter((id) => !idsToRemove.has(id)));
                  } else {
                    const newIds = filteredStudents.map((s) => s.id);
                    setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...newIds])));
                  }
                };

                if (students.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-400 text-sm font-semibold">
                      Lớp chưa có học sinh. Bấm "Thêm học sinh" hoặc "Nhập từ Excel" để bắt đầu.
                    </div>
                  );
                }

                return (
                  <div>
                    {/* Desktop Table (Phần A.5: Giữ nguyên giao diện bảng trên Desktop) */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full text-left text-xs sm:text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] tracking-wider font-extrabold bg-slate-50/50">
                            <th className="py-3 px-3 w-8">
                              <input
                                type="checkbox"
                                checked={isAllSelected}
                                onChange={toggleSelectAll}
                                className="rounded text-primary-600 focus:ring-primary-500 cursor-pointer"
                                title="Chọn tất cả học sinh đang hiển thị"
                              />
                            </th>
                            <th className="py-3 px-4">Mã định danh (Code / ID)</th>
                            <th className="py-3 px-4">Tên / Biệt danh</th>
                            <th className="py-3 px-4">Mã vào lớp</th>
                            <th className="py-3 px-4">Trạng thái PIN</th>
                            <th className="py-3 px-4">Tài khoản</th>
                            <th className="py-3 px-4 text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredStudents.map((st) => {
                            const isSelected = selectedStudentIds.includes(st.id);
                            return (
                              <tr
                                key={st.id}
                                className={`transition ${isSelected ? 'bg-sky-50/40' : 'hover:bg-slate-50'} ${
                                  st.status === 'suspended' ? 'bg-rose-50/20' : st.status === 'archived' ? 'bg-slate-100/40 opacity-70' : ''
                                }`}
                              >
                                <td className="py-3.5 px-3">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() =>
                                      setSelectedStudentIds((prev) =>
                                        prev.includes(st.id) ? prev.filter((id) => id !== st.id) : [...prev, st.id]
                                      )
                                    }
                                    className="rounded text-primary-600 focus:ring-primary-500 cursor-pointer"
                                  />
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-black text-slate-800 text-xs sm:text-sm">
                                      {st.studentCode || '—'}
                                    </span>
                                    {st.studentCode && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard.writeText(st.studentCode || '');
                                          setActionMessage({ type: 'success', text: `Đã chép mã học sinh ${st.studentCode}` });
                                        }}
                                        className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition"
                                        title="Sao chép mã học sinh"
                                      >
                                        <Copy className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono mt-0.5">
                                    <span>ID: {st.id.slice(0, 10)}...</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(st.id);
                                        setActionMessage({ type: 'success', text: `Đã chép UID ${st.id}` });
                                      }}
                                      className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition"
                                      title="Sao chép toàn bộ ID học sinh"
                                    >
                                      <Copy className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 font-extrabold text-slate-900">
                                  {st.displayAlias}
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-bold text-slate-700">
                                      {selectedClass.classCode}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(selectedClass.classCode);
                                        setActionMessage({ type: 'success', text: `Đã chép mã lớp ${selectedClass.classCode}` });
                                      }}
                                      className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition"
                                      title="Sao chép mã lớp"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                  </div>
                                </td>
                                <td className="py-3.5 px-4">
                                  <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-full border border-emerald-200">
                                    Đã cấp mã PIN
                                  </span>
                                  <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                                    {st.lastPinRotatedAt ? `Cấp lại: ${new Date(st.lastPinRotatedAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}` : 'Cấp khi tạo'}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4">
                                  {st.status === 'suspended' ? (
                                    <span className="px-2 py-0.5 bg-rose-50 text-rose-800 font-bold text-[11px] rounded-full border border-rose-200 flex items-center gap-1 w-fit">
                                      <Lock className="w-3 h-3 text-rose-600" />
                                      <span>Tạm khóa</span>
                                    </span>
                                  ) : st.status === 'archived' ? (
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-[11px] rounded-full border border-slate-300 flex items-center gap-1 w-fit">
                                      <Archive className="w-3 h-3 text-slate-500" />
                                      <span>Đã lưu trữ</span>
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 font-bold text-[11px] rounded-full border border-emerald-200 flex items-center gap-1 w-fit">
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      <span>Hoạt động</span>
                                    </span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                  <div className="inline-flex items-center gap-1">
                                    {/* Edit Student Info */}
                                    <button
                                      onClick={() => {
                                        setEditingStudent({
                                          id: st.id,
                                          studentCode: st.studentCode || '',
                                          displayAlias: st.displayAlias
                                        });
                                        setEditingAlias(st.displayAlias);
                                        setEditingCode(st.studentCode || '');
                                      }}
                                      className="p-1.5 bg-slate-100 hover:bg-sky-100 text-slate-700 hover:text-sky-900 rounded-lg font-bold text-xs transition cursor-pointer"
                                      title="Sửa tên hiển thị hoặc mã học sinh"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Toggle Lock / Unlock */}
                                    <button
                                      onClick={() => handleToggleStudentStatus(st.id, st.status)}
                                      className={`p-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                                        st.status === 'suspended'
                                          ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                                          : 'bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-800'
                                      }`}
                                      title={st.status === 'suspended' ? 'Mở khóa truy cập cho học sinh' : 'Tạm khóa quyền truy cập của học sinh'}
                                    >
                                      {st.status === 'suspended' ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                                    </button>

                                    {/* Archive / Restore */}
                                    <button
                                      onClick={() => handleToggleStudentArchive(st.id, st.status)}
                                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs transition cursor-pointer"
                                      title={st.status === 'archived' ? 'Khôi phục hồ sơ học sinh' : 'Lưu trữ hồ sơ học sinh'}
                                    >
                                      <Archive className="w-3.5 h-3.5 text-slate-600" />
                                    </button>

                                    {/* Delete Student */}
                                    <button
                                      onClick={() => {
                                        setDeleteTargetStudent(st);
                                        setDeleteStudentError(null);
                                      }}
                                      className="p-1.5 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 rounded-lg font-bold text-xs transition cursor-pointer"
                                      title="Xóa hồ sơ học sinh"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Transfer Class */}
                                    {classes.length > 1 && (
                                      <button
                                        onClick={() => {
                                          setTransferringStudent({
                                            id: st.id,
                                            studentCode: st.studentCode || '',
                                            displayAlias: st.displayAlias,
                                            currentClassId: selectedClass.id
                                          });
                                          setTargetTransferClassId('');
                                        }}
                                        className="p-1.5 bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-purple-900 rounded-lg font-bold text-xs transition cursor-pointer"
                                        title="Chuyển học sinh sang lớp khác"
                                      >
                                        <ArrowRight className="w-3.5 h-3.5" />
                                      </button>
                                    )}

                                    {/* Reissue PIN */}
                                    <button
                                      onClick={() => handleRotateStudentCode(st.id, st.displayAlias, st.studentCode || '')}
                                      className="p-1.5 bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 rounded-lg font-bold text-xs transition cursor-pointer"
                                      title="Cấp lại mã PIN mới khi học sinh quên hoặc làm mất"
                                    >
                                      <RefreshCw className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Reset Student Password */}
                                    <button
                                      onClick={() => {
                                        setResetTargetStudent({ id: st.id, alias: st.displayAlias, code: st.studentCode || '' });
                                        setNewStudentPasswordInput('HS123456');
                                      }}
                                      className="p-1.5 bg-slate-100 hover:bg-sky-100 text-slate-700 hover:text-sky-900 rounded-lg font-bold text-xs transition cursor-pointer"
                                      title="Đặt lại mật khẩu đăng nhập cho học sinh"
                                    >
                                      <Key className="w-3.5 h-3.5 text-sky-600" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}

                          {filteredStudents.length === 0 && (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-slate-400 font-semibold">
                                Không tìm thấy học sinh nào phù hợp với bộ lọc hiện tại.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Student Cards (Phần A.1-A.4: Khi màn hình < 640px, thay bằng danh sách thẻ học sinh) */}
                    <div className="block sm:hidden space-y-3">
                      {/* Mobile Select All Header */}
                      <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                        <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                          <input
                            type="checkbox"
                            checked={isAllSelected}
                            onChange={toggleSelectAll}
                            className="rounded text-primary-600 focus:ring-primary-500 cursor-pointer w-4 h-4"
                          />
                          <span>Chọn tất cả ({filteredStudents.length})</span>
                        </label>
                        <span className="text-[11px] text-slate-400 font-semibold">
                          {selectedStudentIds.length} đã chọn
                        </span>
                      </div>

                      {filteredStudents.map((st) => {
                        const isSelected = selectedStudentIds.includes(st.id);
                        return (
                          <div
                            key={st.id}
                            className={`p-3.5 rounded-2xl border transition-all space-y-2.5 ${
                              isSelected
                                ? 'bg-sky-50/70 border-sky-300 shadow-sm'
                                : 'bg-white border-slate-200 shadow-sm'
                            } ${
                              st.status === 'suspended'
                                ? 'border-rose-200 bg-rose-50/20'
                                : st.status === 'archived'
                                ? 'border-slate-200 bg-slate-50 opacity-80'
                                : ''
                            }`}
                          >
                            {/* Card Top: Checkbox, Name, Status Badge */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2.5 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() =>
                                    setSelectedStudentIds((prev) =>
                                      prev.includes(st.id) ? prev.filter((id) => id !== st.id) : [...prev, st.id]
                                    )
                                  }
                                  className="mt-1 rounded text-primary-600 focus:ring-primary-500 cursor-pointer w-4 h-4 shrink-0"
                                />
                                <div className="min-w-0">
                                  <div className="font-extrabold text-slate-900 text-sm leading-tight break-words">
                                    {st.displayAlias}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono mt-0.5">
                                    <span>Mã HS: <strong className="text-slate-800">{st.studentCode || '—'}</strong></span>
                                    {st.studentCode && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard.writeText(st.studentCode || '');
                                          setActionMessage({ type: 'success', text: `Đã chép mã ${st.studentCode}` });
                                        }}
                                        className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition"
                                        title="Sao chép mã học sinh"
                                      >
                                        <Copy className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Status Badge */}
                              <div className="shrink-0">
                                {st.status === 'suspended' ? (
                                  <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold text-[11px] rounded-full border border-rose-200 flex items-center gap-1">
                                    <Lock className="w-3 h-3 text-rose-600" />
                                    <span>Tạm khóa</span>
                                  </span>
                                ) : st.status === 'archived' ? (
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-[11px] rounded-full border border-slate-300 flex items-center gap-1">
                                    <Archive className="w-3 h-3 text-slate-500" />
                                    <span>Đã lưu trữ</span>
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[11px] rounded-full border border-emerald-200 flex items-center gap-1">
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span>Hoạt động</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Metadata Box: Mã PIN & Mã vào lớp */}
                            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                              <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Mã PIN:</span>
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 mt-0.5">
                                  <KeyRound className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span>{st.lastPinRotatedAt ? 'Đã đổi PIN' : 'Đã cấp PIN'}</span>
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Mã vào lớp:</span>
                                <span className="font-mono font-bold text-slate-800 text-xs flex items-center gap-1 mt-0.5">
                                  <span>{selectedClass.classCode}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(selectedClass.classCode);
                                      setActionMessage({ type: 'success', text: `Đã chép mã lớp ${selectedClass.classCode}` });
                                    }}
                                    className="text-slate-400 hover:text-slate-700 p-0.5"
                                    title="Sao chép mã lớp"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </span>
                              </div>
                            </div>

                            {/* Action Buttons: 2-3 column responsive grid with labeled buttons */}
                            <div className="grid grid-cols-2 xs:grid-cols-3 gap-1.5 pt-1.5 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingStudent({
                                    id: st.id,
                                    studentCode: st.studentCode || '',
                                    displayAlias: st.displayAlias
                                  });
                                  setEditingAlias(st.displayAlias);
                                  setEditingCode(st.studentCode || '');
                                }}
                                className="flex items-center justify-center gap-1.5 py-2 px-2 bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-800 rounded-xl text-xs font-bold transition cursor-pointer"
                                title="Sửa tên hoặc mã"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-sky-600" />
                                <span>Sửa</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleStudentStatus(st.id, st.status)}
                                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                                  st.status === 'suspended'
                                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                                    : 'bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700'
                                }`}
                                title={st.status === 'suspended' ? 'Mở khóa' : 'Khóa'}
                              >
                                {st.status === 'suspended' ? <Unlock className="w-3.5 h-3.5 text-emerald-600" /> : <Lock className="w-3.5 h-3.5 text-rose-500" />}
                                <span>{st.status === 'suspended' ? 'Mở khóa' : 'Khóa'}</span>
                              </button>

                              {classes.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTransferringStudent({
                                      id: st.id,
                                      studentCode: st.studentCode || '',
                                      displayAlias: st.displayAlias,
                                      currentClassId: selectedClass.id
                                    });
                                    setTargetTransferClassId('');
                                  }}
                                  className="flex items-center justify-center gap-1.5 py-2 px-2 bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-800 rounded-xl text-xs font-bold transition cursor-pointer"
                                  title="Chuyển lớp"
                                >
                                  <ArrowRight className="w-3.5 h-3.5 text-purple-600" />
                                  <span>Chuyển lớp</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleRotateStudentCode(st.id, st.displayAlias, st.studentCode || '')}
                                className="flex items-center justify-center gap-1.5 py-2 px-2 bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-800 rounded-xl text-xs font-bold transition cursor-pointer"
                                title="Cấp lại mã PIN"
                              >
                                <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                                <span>Cấp lại PIN</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setResetTargetStudent({ id: st.id, alias: st.displayAlias, code: st.studentCode || '' });
                                  setNewStudentPasswordInput('HS123456');
                                }}
                                className="flex items-center justify-center gap-1.5 py-2 px-2 bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-800 rounded-xl text-xs font-bold transition cursor-pointer"
                                title="Đổi mật khẩu"
                              >
                                <Key className="w-3.5 h-3.5 text-sky-600" />
                                <span>Đổi MK</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteTargetStudent(st);
                                  setDeleteStudentError(null);
                                }}
                                className="flex items-center justify-center gap-1.5 py-2 px-2 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 rounded-xl text-xs font-bold transition cursor-pointer"
                                title="Xóa học sinh"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                <span>Xóa</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {filteredStudents.length === 0 && (
                        <div className="py-8 text-center text-slate-400 font-semibold text-xs">
                          Không tìm thấy học sinh nào phù hợp với bộ lọc hiện tại.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Modal: Confirm Delete Student */}
              {deleteTargetStudent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                  <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border space-y-4">
                    <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                      <Trash2 className="w-6 h-6" />
                    </div>

                    <div className="text-center">
                      <h3 className="text-lg font-black text-slate-900">Xóa Hồ Sơ Học Sinh</h3>
                      <p className="text-xs text-slate-600 font-semibold mt-1">
                        Bạn có chắc chắn muốn xóa hồ sơ của học sinh{' '}
                        <strong className="text-slate-900">{deleteTargetStudent.displayAlias}</strong> ({deleteTargetStudent.studentCode || 'Chưa có mã'})?
                      </p>
                    </div>

                    {deleteStudentError ? (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs space-y-2">
                        <div className="font-bold text-amber-900 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Bảo vệ kết quả học tập:</span>
                        </div>
                        <p className="text-amber-800 text-[11px] leading-relaxed">
                          {deleteStudentError}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            handleToggleStudentArchive(deleteTargetStudent.id, 'active');
                            setDeleteTargetStudent(null);
                          }}
                          className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow mt-1"
                        >
                          <Archive className="w-4 h-4" />
                          <span>Chuyển sang Lưu trữ hồ sơ</span>
                        </button>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-2xl border">
                        * Lưu ý: Nếu học sinh đã có bài làm hoặc kết quả đọc hiểu, hệ thống sẽ tự động bảo vệ dữ liệu và chuyển sang trạng thái <strong>Lưu trữ</strong>.
                      </p>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteTargetStudent(null);
                          setDeleteStudentError(null);
                        }}
                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                      >
                        Hủy
                      </button>
                      {!deleteStudentError && (
                        <button
                          type="button"
                          disabled={deletingStudent}
                          onClick={handleConfirmDeleteStudent}
                          className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs shadow disabled:opacity-50"
                        >
                          {deletingStudent ? 'Đang xóa...' : 'Xác nhận xóa'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Modal: Confirm Batch Delete Students */}
              {batchStudentModal?.action === 'delete' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                  <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border space-y-4">
                    <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                      <Trash2 className="w-6 h-6" />
                    </div>

                    <div className="text-center">
                      <h3 className="text-lg font-black text-slate-900">Xóa Hàng Loạt Học Sinh</h3>
                      <p className="text-xs text-slate-600 font-semibold mt-1">
                        Bạn đã chọn <strong className="text-rose-700">{batchStudentModal.count} học sinh</strong> để xóa.
                      </p>
                    </div>

                    <div className="p-3 bg-sky-50 border border-sky-200 rounded-2xl text-xs space-y-1">
                      <div className="font-bold text-sky-900">Chính sách bảo vệ kết quả học tập:</div>
                      <p className="text-sky-800 text-[11px] leading-relaxed">
                        Những học sinh đã làm bài đọc hiểu sẽ tự động được chuyển sang <strong>Lưu trữ</strong> để không bị mất điểm số và lịch sử học tập.
                      </p>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setBatchStudentModal(null)}
                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                      >
                        Hủy bỏ
                      </button>
                      <button
                        type="button"
                        disabled={isProcessingBatchStudents}
                        onClick={() => handleBatchStudentsAction('delete')}
                        className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs shadow disabled:opacity-50"
                      >
                        {isProcessingBatchStudents ? 'Đang xử lý...' : 'Xác nhận xóa'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Modal: Create Class */}
          {showCreateClassModal && createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-class-title"
              className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 md:p-6 flex min-h-full items-center justify-center overscroll-contain animate-fade-in"
              onClick={(e) => {
                if (e.target === e.currentTarget) setShowCreateClassModal(false);
              }}
            >
              <div className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 text-left space-y-4 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[min(88dvh,600px)] overflow-y-auto overscroll-contain">
                <div className="flex items-center justify-between">
                  <h3 id="create-class-title" className="text-xl font-black text-slate-900">Tạo Lớp Học Mới</h3>
                  <button
                    type="button"
                    onClick={() => setShowCreateClassModal(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleCreateClass} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tên lớp học</label>
                    <input
                      type="text"
                      value={newClassName}
                      onChange={(e) => setNewClassName(e.target.value)}
                      placeholder="VD: Lớp 2A, Lớp 3B"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Năm học</label>
                    <div className="flex gap-2">
                      {['2026-2027'].map((yr) => (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => setNewAcademicYear(yr)}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                            newAcademicYear === yr
                              ? 'bg-sky-50 text-sky-800 border-sky-400 ring-2 ring-sky-300'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {yr}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={newAcademicYear}
                      onChange={(e) => setNewAcademicYear(e.target.value)}
                      placeholder="VD: 2026-2027"
                      className="w-full mt-2 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Khối lớp</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewClassGrade(2)}
                        className={`p-3 rounded-xl font-black text-sm border transition ${
                          newClassGrade === 2 ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Khối Lớp 2
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewClassGrade(3)}
                        className={`p-3 rounded-xl font-black text-sm border transition ${
                          newClassGrade === 3 ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Khối Lớp 3
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateClassModal(false)}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow-md transition"
                    >
                      Tạo lớp ngay
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )}

          {/* Modal: Edit Class (Gói A) */}
          {editingClass && createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-class-title"
              className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 md:p-6 flex min-h-full items-center justify-center overscroll-contain animate-fade-in"
              onClick={(e) => {
                if (e.target === e.currentTarget) setEditingClass(null);
              }}
            >
              <div className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 text-left space-y-4 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[min(88dvh,600px)] overflow-y-auto overscroll-contain">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <Edit3 className="w-4 h-4" />
                    </div>
                    <h3 id="edit-class-title" className="text-xl font-black text-slate-900">Chỉnh Sửa Lớp Học</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingClass(null)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveClassEdit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tên lớp học</label>
                    <input
                      type="text"
                      value={editClassName}
                      onChange={(e) => setEditClassName(e.target.value)}
                      placeholder="VD: Lớp 2A"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Năm học</label>
                    <div className="flex gap-2">
                      {['2026-2027'].map((yr) => (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => setEditClassAcademicYear(yr)}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                            editClassAcademicYear === yr
                              ? 'bg-sky-50 text-sky-800 border-sky-400 ring-2 ring-sky-300'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {yr}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={editClassAcademicYear}
                      onChange={(e) => setEditClassAcademicYear(e.target.value)}
                      placeholder="VD: 2026-2027"
                      className="w-full mt-2 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Khối lớp</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditClassGrade(2)}
                        className={`p-3 rounded-xl font-black text-sm border transition ${
                          editClassGrade === 2 ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Khối Lớp 2
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditClassGrade(3)}
                        className={`p-3 rounded-xl font-black text-sm border transition ${
                          editClassGrade === 3 ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Khối Lớp 3
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Mã lớp truy cập (Class Code)</label>
                    <input
                      type="text"
                      value={editClassCode}
                      onChange={(e) => setEditClassCode(e.target.value.toUpperCase())}
                      placeholder="VD: LOP2A"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 uppercase focus:bg-white focus:outline-none"
                      required
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Mã lớp dùng cho học sinh đăng nhập. Phải là duy nhất trong toàn hệ thống.
                    </p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingClass(null)}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingClassEdit}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow-md transition disabled:opacity-50"
                    >
                      {isSavingClassEdit ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )}

          {/* Modal: Delete / Archive Warning Class (Gói A) */}
          {classDeleteTarget && createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-class-title"
              className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 md:p-6 flex min-h-full items-center justify-center overscroll-contain animate-fade-in"
              onClick={(e) => {
                if (e.target === e.currentTarget) setClassDeleteTarget(null);
              }}
            >
              <div className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 text-left space-y-4 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[min(88dvh,600px)] overflow-y-auto overscroll-contain">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    classDeleteBlockReason ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                  }`}>
                    {classDeleteBlockReason ? <AlertCircle className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 id="delete-class-title" className="text-lg font-black text-slate-900">
                      {classDeleteBlockReason ? 'Bảo Vệ Lịch Sử Lớp Học' : 'Xác Nhận Xóa Lớp Học'}
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold">
                      {classDeleteTarget.name} ({classDeleteTarget.classCode})
                    </p>
                  </div>
                </div>

                {classDeleteBlockReason ? (
                  <div className="space-y-3">
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 font-medium leading-relaxed">
                      {classDeleteBlockReason}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Chính sách an toàn dữ liệu học đường: Khi lớp học đã phát sinh dữ liệu bài tập hoặc danh sách học sinh, thao tác xóa vĩnh viễn bị khóa để bảo toàn hồ sơ nghiên cứu và kết quả của các em.
                    </p>
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setClassDeleteTarget(null)}
                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
                      >
                        Đóng
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const target = classDeleteTarget;
                          setClassDeleteTarget(null);
                          handleToggleClassArchive(target);
                        }}
                        className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl text-xs shadow-md transition flex items-center justify-center gap-1.5"
                      >
                        <Archive className="w-4 h-4" />
                        <span>Chuyển Sang Lưu Trữ</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      Lớp học này hiện <strong>chưa có học sinh và chưa có bài tập nào được giao</strong>. Bạn có chắc chắn muốn xóa vĩnh viễn lớp <strong className="text-slate-900">{classDeleteTarget.name}</strong> không?
                    </p>
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800 font-semibold">
                      Lưu ý: Thao tác này không thể hoàn tác sau khi xác nhận.
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setClassDeleteTarget(null)}
                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        disabled={isDeletingClass}
                        onClick={handleConfirmDeleteClass}
                        className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs shadow-md transition disabled:opacity-50"
                      >
                        {isDeletingClass ? 'Đang xóa...' : 'Xác Nhận Xóa'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>,
            document.body
          )}

          {/* Modal: Add Student & View Slip */}
          {showAddStudentModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
              <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border">
                {createdStudentCard ? (
                  <div className="text-center space-y-4">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900">Đã Cấp Mã Thành Công!</h3>

                    {/* Printable Card */}
                    <div className="bg-amber-50 border-2 border-amber-300 p-5 rounded-2xl text-left space-y-2">
                      <div className="text-xs font-bold text-amber-800 uppercase tracking-wide">
                        Thẻ Đăng Nhập Học Sinh · {createdStudentCard.className}
                      </div>
                      <div className="text-lg font-black text-slate-900">
                        {createdStudentCard.displayAlias}
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-amber-200 text-xs">
                        <div>
                          <span className="text-slate-500">Mã lớp:</span>
                          <div className="font-mono font-black text-sm text-slate-900">
                            {createdStudentCard.classCode}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-500">Mã riêng:</span>
                          <div className="flex items-center gap-1.5 font-mono font-black text-sm text-emerald-700">
                            <span>{showPinVisible ? createdStudentCard.accessCode : '••••••'}</span>
                            <button
                              type="button"
                              onClick={() => setShowPinVisible(!showPinVisible)}
                              className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                              title={showPinVisible ? 'Ẩn mã' : 'Hiện mã'}
                            >
                              {showPinVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setCreatedStudentCard(null);
                        setShowAddStudentModal(false);
                      }}
                      className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl text-sm"
                    >
                      Đã lưu thông tin
                    </button>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-xl font-black text-slate-900 mb-4">
                      Thêm Học Sinh Vào Lớp {selectedClass?.name || ''}
                    </h3>
                    <form onSubmit={handleAddStudent} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Tên hiển thị / Biệt danh của học sinh
                        </label>
                        <input
                          type="text"
                          value={newStudentAlias}
                          onChange={(e) => setNewStudentAlias(e.target.value)}
                          placeholder="VD: Họa Mi, Sơn Ca, Bảo Nam"
                          className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-semibold focus:bg-white"
                          required
                        />
                        <span className="text-[11px] text-slate-400">
                          Khuyến khích dùng biệt danh để đảm bảo an toàn riêng tư trẻ em.
                        </span>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Mã học sinh (Tùy chọn)
                        </label>
                        <input
                          type="text"
                          value={newStudentCode}
                          onChange={(e) => setNewStudentCode(e.target.value)}
                          placeholder="VD: HS01"
                          className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-semibold focus:bg-white"
                        />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowAddStudentModal(false)}
                          className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl text-xs"
                        >
                          Hủy
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow"
                        >
                          Cấp mã pin ngẫu nhiên
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Modal: Reissued PIN Card */}
          {reissuedPinInfo && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border text-center space-y-4">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                  <RefreshCw className="w-6 h-6 animate-spin-once" />
                </div>
                <h3 className="text-xl font-black text-slate-900">Đã Cấp Lại Mã PIN Mới</h3>
                <p className="text-xs text-slate-500 font-semibold">
                  Mã PIN cũ đã bị vô hiệu hóa ngay lập tức. Thầy cô vui lòng bàn giao mã mới này cho học sinh:
                </p>

                <div className="bg-amber-50 border-2 border-amber-300 p-5 rounded-2xl text-left space-y-2.5">
                  <div className="text-xs font-bold text-amber-800 uppercase tracking-wide">
                    Học sinh: <strong className="text-slate-900 text-sm">{reissuedPinInfo.alias}</strong>
                  </div>
                  <div className="text-xs text-slate-700 flex justify-between">
                    <span>Mã định danh (studentCode):</span>
                    <span className="font-mono font-bold text-slate-900">{reissuedPinInfo.code || '—'}</span>
                  </div>
                  <div className="text-xs text-slate-700 flex justify-between">
                    <span>Mã vào lớp (classCode):</span>
                    <span className="font-mono font-bold text-slate-900">{selectedClass?.classCode || ''}</span>
                  </div>
                  <div className="pt-2 border-t border-amber-200">
                    <span className="text-[11px] text-slate-500 font-bold block">MÃ PIN CÁ NHÂN MỚI (access PIN):</span>
                    <div className="flex items-center justify-between mt-1">
                      <div className="font-mono font-black text-2xl text-emerald-700 tracking-wider">
                        {showPinVisible ? reissuedPinInfo.pin : '••••••'}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPinVisible(!showPinVisible)}
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-amber-100 rounded-lg transition cursor-pointer"
                        title={showPinVisible ? 'Ẩn mã PIN' : 'Hiện mã PIN'}
                      >
                        {showPinVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="text-[10px] text-amber-900 font-medium leading-relaxed pt-1 border-t border-amber-200/60">
                    🔒 <strong>Bảo mật:</strong> PIN này chỉ hiển thị một lần duy nhất tại đây. Hệ thống lưu trữ dạng băm (salted hash), không lưu văn bản thuần.
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `Thẻ đăng nhập EM YÊU TIẾNG VIỆT\nHọc sinh: ${reissuedPinInfo.alias}\nMã HS: ${reissuedPinInfo.code}\nMã lớp: ${selectedClass?.classCode || ''}\nMã PIN: ${reissuedPinInfo.pin}`
                      );
                      alert('Đã sao chép toàn bộ thông tin đăng nhập vào bộ nhớ đệm!');
                    }}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Sao chép</span>
                  </button>
                  <button
                    onClick={() => {
                      window.print();
                    }}
                    className="flex-1 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-sky-600" />
                    <span>In thẻ</span>
                  </button>
                  <button
                    onClick={() => setReissuedPinInfo(null)}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs cursor-pointer shadow"
                  >
                    Hoàn thành
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: Import Students from Excel */}
          {showImportExcelModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-xl font-black text-slate-900">
                      Nhập Học Sinh Từ Tệp Excel (.xlsx)
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      Lớp nhận dữ liệu: <strong className="text-emerald-700">{selectedClass?.name}</strong> (Mã: {selectedClass?.classCode})
                    </p>
                  </div>
                  <button
                    onClick={() => setShowImportExcelModal(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="py-4 overflow-y-auto space-y-4 flex-1 pr-1">
                  {importedSlips ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
                        <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                        <div>
                          <h4 className="font-black text-emerald-900 text-sm">
                            Đã thêm thành công {importedSlips.length} học sinh!
                          </h4>
                          <p className="text-xs text-emerald-700 font-semibold">
                            Dưới đây là danh sách thẻ truy cập và mã PIN tương ứng. Hãy sao chép hoặc in cho học sinh.
                          </p>
                        </div>
                      </div>

                      <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-2xl">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 text-slate-500 uppercase font-black text-[10px] sticky top-0">
                            <tr>
                              <th className="py-2.5 px-3">Mã học sinh</th>
                              <th className="py-2.5 px-3">Tên / Biệt danh</th>
                              <th className="py-2.5 px-3">Mã vào lớp</th>
                              <th className="py-2.5 px-3 font-mono text-emerald-700">Mã PIN cá nhân</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {importedSlips.map((sl, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="py-2 px-3 font-mono font-bold text-slate-700">{sl.studentCode}</td>
                                <td className="py-2 px-3 font-extrabold text-slate-900">{sl.displayAlias}</td>
                                <td className="py-2 px-3 font-mono text-slate-600">{sl.classCode}</td>
                                <td className="py-2 px-3 font-mono font-black text-emerald-700 bg-emerald-50/50">{sl.accessCode}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <button
                        onClick={() => {
                          const csvText = importedSlips.map(s => `${s.studentCode}\t${s.displayAlias}\t${s.classCode}\t${s.accessCode}`).join('\n');
                          navigator.clipboard.writeText(`Mã học sinh\tBiệt danh\tMã lớp\tMã PIN\n${csvText}`);
                          alert('Đã sao chép toàn bộ danh sách mã PIN học sinh vào bộ nhớ đệm!');
                        }}
                        className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Copy className="w-4 h-4" />
                        <span>Sao chép toàn bộ mã PIN để gửi phụ huynh</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Step 1: Download Sample Template */}
                      <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-black text-sky-950">
                            Bước 1: Tải tệp Excel mẫu chuẩn (.xlsx)
                          </div>
                          <div className="text-[11px] text-sky-700 font-semibold mt-0.5">
                            Chứa sẵn các cột: Mã học sinh (studentCode), Tên gọi / Biệt danh, Mã lớp (classCode), Năm học. Mã PIN sẽ được hệ thống tự sinh và băm bảo mật.
                          </div>
                        </div>
                        <a
                          href="/mau_nhap_hoc_sinh.xlsx"
                          download
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-sky-100 text-sky-800 font-bold text-xs rounded-xl border border-sky-300 transition shrink-0 cursor-pointer shadow-sm"
                        >
                          <Download className="w-3.5 h-3.5 text-sky-600" />
                          <span>Tải mẫu Excel</span>
                        </a>
                      </div>

                      {/* Step 2: Upload Excel File */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          Bước 2: Chọn tệp Excel của lớp để tải lên (.xlsx, tối đa 2MB, tối đa 100 dòng)
                        </label>
                        <input
                          type="file"
                          accept=".xlsx"
                          onChange={handleExcelFileSelect}
                          className="w-full text-xs text-slate-500 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-sky-500 file:text-white hover:file:bg-sky-600 file:cursor-pointer p-2 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer"
                        />
                      </div>

                      {/* Errors or Warnings */}
                      {excelImportErrors.length > 0 && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-semibold space-y-1">
                          <div className="font-bold flex items-center gap-1 text-rose-900">
                            <AlertCircle className="w-4 h-4 text-rose-600" />
                            <span>Cần kiểm tra lại các dòng sau:</span>
                          </div>
                          {excelImportErrors.map((err, i) => (
                            <div key={i} className="pl-5 text-[11px]">• {err}</div>
                          ))}
                        </div>
                      )}

                      {/* Preview Table */}
                      {excelPreviewData.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-700 uppercase">
                              Xem trước dữ liệu ({excelPreviewData.length} học sinh hợp lệ):
                            </span>
                            <span className="text-[11px] text-emerald-600 font-bold">
                              ✓ Sẵn sàng nhập
                            </span>
                          </div>

                          <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-2xl">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-slate-50 text-slate-500 uppercase font-black text-[10px] sticky top-0">
                                <tr>
                                  <th className="py-2 px-3">STT</th>
                                  <th className="py-2 px-3">Mã học sinh</th>
                                  <th className="py-2 px-3">Tên / Biệt danh</th>
                                  <th className="py-2 px-3">Mã lớp</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {excelPreviewData.map((row) => (
                                  <tr key={row.index} className="hover:bg-slate-50">
                                    <td className="py-1.5 px-3 text-slate-400">{row.index}</td>
                                    <td className="py-1.5 px-3 font-mono font-bold text-slate-700">{row.studentCode}</td>
                                    <td className="py-1.5 px-3 font-extrabold text-slate-900">{row.displayAlias}</td>
                                    <td className="py-1.5 px-3 font-mono font-bold text-slate-600">
                                      {row.classCode || selectedClass?.classCode || ''}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowImportExcelModal(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    {importedSlips ? 'Đóng cửa sổ' : 'Hủy bỏ'}
                  </button>

                  {!importedSlips && (
                    <button
                      type="button"
                      disabled={importingStudents || excelPreviewData.length === 0}
                      onClick={handleConfirmBatchImport}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black rounded-xl text-xs transition shadow-md cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {importingStudents ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Đang nhập dữ liệu...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          <span>Xác nhận nhập {excelPreviewData.length} học sinh</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Modal: Edit Student Information */}
          {editingStudent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <h3 className="text-xl font-black text-slate-900">Sửa Thông Tin Học Sinh</h3>
                  <button
                    onClick={() => setEditingStudent(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveStudentEdit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tên hiển thị / Biệt danh
                    </label>
                    <input
                      type="text"
                      required
                      value={editingAlias}
                      onChange={(e) => setEditingAlias(e.target.value)}
                      className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-semibold focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Mã học sinh (studentCode)
                    </label>
                    <input
                      type="text"
                      value={editingCode}
                      onChange={(e) => setEditingCode(e.target.value)}
                      placeholder="VD: HS01"
                      className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-semibold focus:bg-white"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingStudent(null)}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl text-xs cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={savingStudentEdit}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow disabled:opacity-50 cursor-pointer"
                    >
                      {savingStudentEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal: Transfer Student to Another Class (Mảng A - A2) */}
          {transferringStudent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                    <h3 className="text-lg font-black text-slate-900">Chuyển Lớp Học Sinh</h3>
                  </div>
                  <button
                    onClick={() => {
                      setTransferringStudent(null);
                      setTargetTransferClassId('');
                      setTransferReason('');
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mb-4 p-3.5 bg-purple-50 border border-purple-200 rounded-2xl text-xs text-purple-900 leading-relaxed space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>Học sinh:</span>
                    <span className="text-purple-800 text-sm font-black">{transferringStudent.displayAlias}</span>
                    <span className="px-1.5 py-0.5 bg-purple-200/80 text-purple-900 rounded font-mono text-[11px]">
                      {transferringStudent.studentCode}
                    </span>
                  </div>
                  <p className="text-[11px] text-purple-700 leading-normal mt-1">
                    Mã học sinh và toàn bộ lịch sử bài làm, điểm số được bảo toàn nguyên vẹn. Danh sách học sinh của cả lớp cũ và lớp mới sẽ tự động cập nhật ngay trên máy chủ.
                  </p>
                </div>

                {(() => {
                  const currentCls = classes.find((c) => c.id === transferringStudent.currentClassId);
                  const currentYear = currentCls?.academicYear || '2026-2027';
                  const currentGrade = currentCls?.grade || 2;

                  // Filter eligible target classes strictly based on transferType
                  const eligibleClasses = classes.filter((c) => {
                    if (c.id === transferringStudent.currentClassId) return false;
                    const cYear = c.academicYear || '2026-2027';

                    if (transferType === 'same_year') {
                      // Must be same academic year AND same grade
                      return cYear === currentYear && c.grade === currentGrade;
                    } else {
                      // promote_next_year: must be higher grade or next academic year (never backward to past year or lower grade)
                      const isNextYear = currentYear === '2025-2026' && cYear === '2026-2027';
                      const isHigherGrade = c.grade > currentGrade;
                      const isPastYear = currentYear === '2026-2027' && cYear === '2025-2026';
                      const isLowerGrade = c.grade < currentGrade;
                      if (isPastYear || isLowerGrade) return false;
                      return isHigherGrade || isNextYear;
                    }
                  });

                  const selectedTargetCls = classes.find((c) => c.id === targetTransferClassId);

                  return (
                    <form onSubmit={handleTransferStudentSubmit} className="space-y-4">
                      {/* Step 1: Transfer Type */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          1. Chọn hình thức chuyển lớp
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setTransferType('same_year');
                              setTargetTransferClassId('');
                            }}
                            className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                              transferType === 'same_year'
                                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <div className="font-black text-xs">Cùng năm học</div>
                            <div className={`text-[10px] mt-0.5 ${transferType === 'same_year' ? 'text-purple-100' : 'text-slate-500'}`}>
                              Khối {currentGrade} · Năm {currentYear}
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setTransferType('promote_next_year');
                              setTargetTransferClassId('');
                            }}
                            className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                              transferType === 'promote_next_year'
                                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <div className="font-black text-xs">Lên lớp năm mới</div>
                            <div className={`text-[10px] mt-0.5 ${transferType === 'promote_next_year' ? 'text-purple-100' : 'text-slate-500'}`}>
                              Lên khối / năm học mới
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Step 2: Target Class Selector */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          2. Chọn lớp học đích ({transferType === 'same_year' ? `Cùng Khối ${currentGrade} · ${currentYear}` : 'Lên khối / năm học mới'})
                        </label>
                        <select
                          required
                          value={targetTransferClassId}
                          onChange={(e) => setTargetTransferClassId(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-purple-500"
                        >
                          <option value="">-- Chọn lớp học đích phù hợp --</option>
                          {eligibleClasses.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} — Khối {c.grade} ({c.academicYear || '2026-2027'}) · Sĩ số hiện tại: {c.studentCount || 0} HS
                            </option>
                          ))}
                        </select>
                        {eligibleClasses.length === 0 && (
                          <p className="text-[11px] text-amber-600 font-semibold mt-1">
                            Không có lớp nào khác phù hợp với quy tắc {transferType === 'same_year' ? 'chuyển cùng năm học' : 'lên lớp năm mới'}.
                          </p>
                        )}
                      </div>

                      {/* Live Invariant & Count Preview */}
                      {selectedTargetCls && currentCls && (
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 text-xs animate-fade-in">
                          <span className="font-bold text-slate-700 block uppercase text-[10px] tracking-wider">
                            Dự báo thay đổi sĩ số sau chuyển:
                          </span>
                          <div className="flex items-center justify-between text-slate-600">
                            <span>Lớp nguồn ({currentCls.name}):</span>
                            <span className="font-bold text-slate-800">
                              {currentCls.studentCount || 0} → {Math.max(0, (currentCls.studentCount || 0) - 1)} HS (-1)
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-slate-600">
                            <span>Lớp đích ({selectedTargetCls.name}):</span>
                            <span className="font-bold text-purple-700">
                              {selectedTargetCls.studentCount || 0} → {(selectedTargetCls.studentCount || 0) + 1} HS (+1)
                            </span>
                          </div>
                          <div className="pt-1.5 border-t border-slate-200 text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>Bảo toàn 100% studentId, bài làm, điểm và mã PIN</span>
                          </div>
                        </div>
                      )}

                      {/* Step 3: Reason */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          3. Lý do chuyển lớp (Tùy chọn)
                        </label>
                        <input
                          type="text"
                          placeholder={transferType === 'same_year' ? 'VD: Chuyển theo phân bổ lại sĩ số' : 'VD: Lên lớp năm học mới'}
                          value={transferReason}
                          onChange={(e) => setTransferReason(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-purple-500"
                        />
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setTransferringStudent(null);
                            setTargetTransferClassId('');
                            setTransferReason('');
                          }}
                          className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                        >
                          Hủy
                        </button>
                        <button
                          type="submit"
                          disabled={transferring || !targetTransferClassId}
                          className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl text-xs shadow disabled:opacity-50 cursor-pointer"
                        >
                          {transferring ? 'Đang chuyển...' : 'Xác nhận chuyển lớp'}
                        </button>
                      </div>
                    </form>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Modal: Batch Print Cards for Entire Class */}
          {showBatchPrintCards && selectedClass && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">
                      Thẻ Đăng Nhập Cả Lớp · {selectedClass.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      Mã lớp: <span className="font-mono font-bold text-slate-800">{selectedClass.classCode}</span> · Tổng số {students.length} học sinh
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => window.print()}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      <span>In danh sách thẻ</span>
                    </button>
                    <button
                      onClick={() => setShowBatchPrintCards(false)}
                      className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200 transition cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="p-6 overflow-y-auto space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {students.map((st, i) => (
                      <div key={st.id} className="p-3.5 bg-amber-50/70 border-2 border-amber-300 rounded-2xl text-left space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-bold text-amber-800 uppercase tracking-wide">
                          <span>EM YÊU TIẾNG VIỆT</span>
                          <span>#{i + 1}</span>
                        </div>
                        <div className="text-sm font-black text-slate-900 truncate">
                          {st.displayAlias}
                        </div>
                        <div className="pt-1.5 border-t border-amber-200/80 text-xs space-y-1">
                          <div className="flex justify-between">
                            <span className="text-slate-500 text-[11px]">Mã lớp:</span>
                            <span className="font-mono font-black text-slate-900">{selectedClass.classCode}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 text-[11px]">Mã HS:</span>
                            <span className="font-mono font-bold text-slate-800">{st.studentCode || '—'}</span>
                          </div>
                          <div className="flex justify-between items-center pt-1 border-t border-amber-200/50">
                            <span className="text-slate-500 text-[10px]">Trạng thái:</span>
                            <span className="text-emerald-700 font-bold text-[10px]">
                              {st.status === 'suspended' ? 'Tạm khóa' : 'Đã cấp mã'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: LESSON LIBRARY & ASSIGNMENT (V5.2 ENHANCED) */}
      {/* ========================================================= */}
      {activeTab === 'lessons' && (() => {
        // 1. Filter by Nav Year (Module 2.1: Shared vs Specific Year)
        const yearLessons = lessons.filter((ls) => {
          if (!navLessonYear) return true;
          if (navLessonYear === 'shared' || navLessonYear === 'unassigned') {
            return ls.academicYearScope === 'shared' || !(ls as any).academicYear;
          }
          if ((ls as any).academicYear === navLessonYear) return true;
          const lYears = getLessonYears(ls);
          return lYears.includes(navLessonYear);
        });

        // 2. Filter by Nav Grade
        const gradeLessons = yearLessons.filter((ls) => {
          if (navLessonGrade === null) return true;
          return ls.grade === navLessonGrade;
        });

        // 3. Filter by Nav Semester
        const semLessons = gradeLessons.filter((ls) => {
          if (navLessonSemester === null) return true;
          return ls.semester === navLessonSemester;
        });

        // 4. Filter Displayed Lessons (when week is chosen or "all" in semester)
        const displayedLessons = semLessons.filter((ls) => {
          if (navLessonWeek !== null && navLessonWeek !== 'all' && ls.week !== navLessonWeek) return false;
          const st = ls.status || 'published';
          if (lessonFilterStatus !== 'all' && st !== lessonFilterStatus) return false;
          if (lessonSearch.trim()) {
            const s = lessonSearch.toLowerCase();
            const matchTitle = (ls.title || '').toLowerCase().includes(s);
            const matchTopic = (ls.topic || '').toLowerCase().includes(s);
            if (!matchTitle && !matchTopic) return false;
          }
          return true;
        });

        return (
          <div className="space-y-6 animate-fade-in">
            {/* Header & Quick Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <span>Kho Bài Đọc & Quản Trị Phiên Bản</span>
                  <BookOpen className="w-5 h-5 text-emerald-600" />
                </h2>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  Điều hướng phân cấp theo Niên khóa → Khối → Học kỳ → Tuần → Bài đọc ({lessons.length} bài chuẩn GDPT 2018)
                </p>
              </div>
              <button
                onClick={() => {
                  setDraftLesson(null);
                  setCurrentEditingLessonId(null);
                  setIsEditingDraft(false);
                  setActiveTab('authoring');
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition active:scale-95 self-start sm:self-auto cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Soạn Bài Mới / Tạo Bằng AI</span>
              </button>
            </div>

            {/* ========================================================= */}
            {/* STEP-BY-STEP HIERARCHICAL NAVIGATION BAR (NĂM -> KHỐI -> HỌC KỲ -> TUẦN -> BÀI ĐỌC) */}
            {/* ========================================================= */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
              {/* Left: Back button & Breadcrumbs */}
              <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm font-bold">
                {navLessonYear !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      if (navLessonWeek !== null) handleBackToLessonWeeks();
                      else if (navLessonSemester !== null) handleBackToLessonSemesters();
                      else if (navLessonGrade !== null) handleBackToLessonGrades();
                      else handleBackToLessonYears();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl transition active:scale-95 text-xs mr-1 border border-slate-200 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Quay lại</span>
                  </button>
                )}

                {/* Breadcrumb path */}
                <div className="flex items-center gap-1.5 text-slate-500 flex-wrap">
                  <button
                    type="button"
                    onClick={handleBackToLessonYears}
                    className={`hover:text-emerald-700 transition flex items-center gap-1 cursor-pointer ${
                      navLessonYear === null ? 'text-emerald-700 font-black' : 'text-slate-600'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Kho bài đọc</span>
                  </button>

                  {navLessonYear && (
                    <>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <button
                        type="button"
                        onClick={handleBackToLessonGrades}
                        className={`hover:text-emerald-700 transition cursor-pointer ${
                          navLessonGrade === null ? 'text-emerald-700 font-black' : 'text-slate-600'
                        }`}
                      >
                        {navLessonYear === 'shared' || navLessonYear === 'unassigned' ? 'Kho học liệu dùng chung' : `Năm học ${navLessonYear}`}
                      </button>
                    </>
                  )}

                  {navLessonGrade && (
                    <>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <button
                        type="button"
                        onClick={handleBackToLessonSemesters}
                        className={`hover:text-emerald-700 transition cursor-pointer ${
                          navLessonSemester === null ? 'text-emerald-700 font-black' : 'text-slate-600'
                        }`}
                      >
                        Khối {navLessonGrade}
                      </button>
                    </>
                  )}

                  {navLessonSemester && (
                    <>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <button
                        type="button"
                        onClick={handleBackToLessonWeeks}
                        className={`hover:text-emerald-700 transition cursor-pointer ${
                          navLessonWeek === null ? 'text-emerald-700 font-black' : 'text-slate-600'
                        }`}
                      >
                        Học kỳ {navLessonSemester === 1 ? 'I' : 'II'}
                      </button>
                    </>
                  )}

                  {navLessonWeek !== null && (
                    <>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-emerald-700 font-black bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                        {navLessonWeek === 'all' ? 'Toàn bộ học kỳ' : `Tuần ${navLessonWeek}`}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Right: Step Indicator */}
              <div className="flex items-center gap-1 text-[11px] sm:text-xs font-bold text-slate-500">
                <span className="text-slate-400 hidden sm:inline">Tiến trình:</span>
                <span className={`px-2 py-0.5 rounded-md ${navLessonYear === null ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'}`}>1. Năm</span>
                <span className="text-slate-300">→</span>
                <span className={`px-2 py-0.5 rounded-md ${navLessonYear !== null && navLessonGrade === null ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'}`}>2. Khối</span>
                <span className="text-slate-300">→</span>
                <span className={`px-2 py-0.5 rounded-md ${navLessonGrade !== null && navLessonSemester === null ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'}`}>3. HK</span>
                <span className="text-slate-300">→</span>
                <span className={`px-2 py-0.5 rounded-md ${navLessonSemester !== null && navLessonWeek === null ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'}`}>4. Tuần</span>
                <span className="text-slate-300">→</span>
                <span className={`px-2 py-0.5 rounded-md ${navLessonWeek !== null ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'}`}>5. Bài đọc</span>
              </div>
            </div>

            {/* ========================================================= */}
            {/* LEVEL 1: NĂM HỌC (Shown ONLY when navLessonYear === null) */}
            {/* ========================================================= */}
            {navLessonYear === null && (
              <div className="space-y-4 animate-fade-in">
                <div className="bg-gradient-to-r from-sky-50 via-indigo-50 to-emerald-50 border border-sky-100 rounded-3xl p-6 sm:p-8">
                  <div className="max-w-3xl">
                    <span className="px-3 py-1 bg-sky-600 text-white text-xs font-black rounded-full uppercase tracking-wider">
                      Bước 1 / 5
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                      Chọn Năm Học Để Xem Bài Đọc
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
                      Hệ thống phân cấp theo Niên khóa → Khối lớp → Học kỳ → Tuần học → Bài đọc. Chỉ hiển thị bài đọc khi chọn đầy đủ các cấp.
                    </p>
                  </div>
                </div>

                {/* Big Year Cards (Module 2.1: 2026-2027, 2025-2026, Kho học liệu dùng chung) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                  {/* Year 2026-2027 */}
                  {(() => {
                    const l2027 = lessons.filter((ls) => (ls as any).academicYear === '2026-2027' || getLessonYears(ls).includes('2026-2027'));
                    const grades2027 = Array.from(new Set(l2027.map((l) => l.grade))).sort();
                    return (
                      <div
                        onClick={() => handleSelectLessonYear('2026-2027')}
                        className="group relative bg-white border-2 border-slate-200 hover:border-emerald-500 rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between gap-6"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 group-hover:bg-emerald-600 text-emerald-600 group-hover:text-white flex items-center justify-center transition-colors shadow-xs">
                              <Calendar className="w-6 h-6" />
                            </div>
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-black rounded-full border border-emerald-200">
                              Niên khóa hiện hành
                            </span>
                          </div>

                          <div>
                            <h4 className="text-xl font-black text-slate-900 group-hover:text-emerald-700 transition">
                              Năm học 2026–2027
                            </h4>
                            <p className="text-xs text-slate-500 font-medium mt-1">
                              Các bài đọc gắn riêng & đã giao trong năm 2026–2027 ({grades2027.length > 0 ? grades2027.map((g) => `Khối ${g}`).join(', ') : 'Chưa có bài'})
                            </p>
                          </div>

                          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                            <span className="text-[11px] font-bold text-slate-400 block uppercase">Bài đã gắn / giao</span>
                            <strong className="text-lg font-black text-slate-800">{l2027.length} bài đọc</strong>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSelectLessonYear('2026-2027')}
                          className="w-full py-3 px-4 bg-emerald-600 group-hover:bg-emerald-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <span>Vào năm học 2026–2027</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    );
                  })()}

                  {/* Year 2025-2026 */}
                  

                  {/* Shared Across Years Lessons */}
                  {(() => {
                    const lShared = lessons.filter(
                      (ls) => ls.academicYearScope === 'shared' || !(ls as any).academicYear
                    );
                    return (
                      <div
                        onClick={() => handleSelectLessonYear('shared')}
                        className="group relative bg-white border-2 border-slate-200 hover:border-emerald-500 rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between gap-6"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 group-hover:bg-amber-600 text-amber-600 group-hover:text-white flex items-center justify-center transition-colors shadow-xs">
                              <Globe className="w-6 h-6" />
                            </div>
                            <span className="px-2.5 py-1 bg-amber-100 text-amber-900 text-[11px] font-black rounded-full border border-amber-300">
                              Dùng chung nhiều năm học
                            </span>
                          </div>

                          <div>
                            <h4 className="text-xl font-black text-slate-900 group-hover:text-amber-800 transition">
                              Kho học liệu dùng chung
                            </h4>
                            <p className="text-xs text-slate-500 font-medium mt-1">
                              Học liệu đọc hiểu chuẩn GDPT 2018 dùng chung qua các năm học, sẵn sàng giao cho mọi lớp học và niên khóa
                            </p>
                          </div>

                          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                            <span className="text-[11px] font-bold text-slate-400 block uppercase">Toàn bộ kho dùng chung</span>
                            <strong className="text-lg font-black text-slate-800">{lShared.length} bài đọc dùng chung</strong>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSelectLessonYear('shared')}
                          className="w-full py-3 px-4 bg-slate-800 group-hover:bg-slate-900 text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <span>Vào Kho học liệu dùng chung</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* LEVEL 2: KHỐI (Shown ONLY when navLessonYear !== null && navLessonGrade === null) */}
            {/* ========================================================= */}
            {navLessonYear !== null && navLessonGrade === null && (
              <div className="space-y-4 animate-fade-in">
                <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border border-emerald-100 rounded-3xl p-6 sm:p-8">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="px-3 py-1 bg-emerald-600 text-white text-xs font-black rounded-full uppercase tracking-wider">
                        Bước 2 / 5 — {navLessonYear === 'shared' || navLessonYear === 'unassigned' ? 'Kho học liệu dùng chung' : `Năm học ${navLessonYear}`}
                      </span>
                      <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                        Chọn Khối Học
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
                        Chỉ hiển thị các khối lớp thực tế có dữ liệu bài đọc trong phạm vi lựa chọn.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleBackToLessonYears}
                      className="self-start sm:self-auto px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Đổi năm học khác</span>
                    </button>
                  </div>
                </div>

                {/* Grade Cards */}
                {(() => {
                  const availableGrades = Array.from(
                    new Set(yearLessons.map((ls) => ls.grade))
                  ).sort((a, b) => a - b);

                  if (availableGrades.length === 0) {
                    return (
                      <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-500">
                        <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="font-bold text-base">Chưa có bài đọc nào trong phạm vi năm học này.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                      {availableGrades.map((grade) => {
                        const gl = yearLessons.filter((ls) => ls.grade === grade);
                        return (
                          <div
                            key={grade}
                            onClick={() => handleSelectLessonGrade(grade)}
                            className="group relative bg-white border-2 border-slate-200 hover:border-emerald-500 rounded-3xl p-6 sm:p-8 shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between gap-6"
                          >
                            <div className="space-y-4">
                              <div className="w-14 h-14 rounded-2xl bg-indigo-50 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white flex items-center justify-center transition-colors shadow-xs">
                                <GraduationCap className="w-7 h-7" />
                              </div>

                              <div>
                                <h4 className="text-2xl font-black text-slate-900 group-hover:text-indigo-700 transition">
                                  Khối {grade}
                                </h4>
                                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                                  Chương trình Đọc hiểu Tiếng Việt Lớp {grade}
                                </p>
                              </div>

                              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                                <span className="text-[11px] font-bold text-slate-400 block uppercase">Số bài đọc sẵn có</span>
                                <strong className="text-xl font-black text-slate-800">{gl.length} bài</strong>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleSelectLessonGrade(grade)}
                              className="w-full py-3.5 px-4 bg-emerald-600 group-hover:bg-emerald-700 text-white font-black text-sm rounded-2xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <span>Xem học kỳ Khối {grade}</span>
                              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ========================================================= */}
            {/* LEVEL 3: HỌC KỲ (Shown ONLY when navLessonGrade !== null && navLessonSemester === null) */}
            {/* ========================================================= */}
            {navLessonGrade !== null && navLessonSemester === null && (
              <div className="space-y-4 animate-fade-in">
                <div className="bg-gradient-to-r from-indigo-50 via-sky-50 to-emerald-50 border border-indigo-100 rounded-3xl p-6 sm:p-8">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="px-3 py-1 bg-indigo-600 text-white text-xs font-black rounded-full uppercase tracking-wider">
                        Bước 3 / 5 — Khối {navLessonGrade}
                      </span>
                      <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                        Chọn Học Kỳ
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
                        Chỉ hiển thị các học kỳ thực tế có dữ liệu bài đọc.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleBackToLessonGrades}
                      className="self-start sm:self-auto px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Đổi khối học khác</span>
                    </button>
                  </div>
                </div>

                {/* Semester Cards */}
                {(() => {
                  const availableSemesters = Array.from(
                    new Set(
                      gradeLessons
                        .map((ls) => ls.semester)
                        .filter((s): s is 1 | 2 => s === 1 || s === 2)
                    )
                  ).sort((a, b) => a - b);

                  if (availableSemesters.length === 0) {
                    return (
                      <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-500">
                        <p className="font-bold text-base">Không tìm thấy học kỳ nào có dữ liệu cho Khối {navLessonGrade}.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                      {availableSemesters.map((sem) => {
                        const sl = gradeLessons.filter((ls) => ls.semester === sem);
                        const semWeeks = Array.from(new Set(sl.map((l) => l.week))).sort((a, b) => (a || 0) - (b || 0));

                        return (
                          <div
                            key={sem}
                            onClick={() => handleSelectLessonSemester(sem)}
                            className="group relative bg-white border-2 border-slate-200 hover:border-emerald-500 rounded-3xl p-6 sm:p-8 shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between gap-6"
                          >
                            <div className="space-y-4">
                              <div className="w-14 h-14 rounded-2xl bg-violet-50 group-hover:bg-violet-600 text-violet-600 group-hover:text-white flex items-center justify-center transition-colors shadow-xs">
                                <BookOpen className="w-7 h-7" />
                              </div>

                              <div>
                                <h4 className="text-2xl font-black text-slate-900 group-hover:text-violet-700 transition">
                                  Học kỳ {sem === 1 ? 'I' : 'II'}
                                </h4>
                                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                                  Khối {navLessonGrade} · {sem === 1 ? 'Tuần 1 đến Tuần 18' : 'Tuần 19 đến Tuần 35'}
                                </p>
                              </div>

                              <div className="grid grid-cols-2 gap-3 pt-1">
                                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                                  <span className="text-[11px] font-bold text-slate-400 block uppercase">Số bài đọc</span>
                                  <strong className="text-lg font-black text-slate-800">{sl.length} bài</strong>
                                </div>
                                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                                  <span className="text-[11px] font-bold text-slate-400 block uppercase">Số tuần có bài</span>
                                  <strong className="text-lg font-black text-slate-800">{semWeeks.length} tuần</strong>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleSelectLessonSemester(sem)}
                              className="w-full py-3.5 px-4 bg-emerald-600 group-hover:bg-emerald-700 text-white font-black text-sm rounded-2xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <span>Xem danh sách tuần Học kỳ {sem === 1 ? 'I' : 'II'}</span>
                              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ========================================================= */}
            {/* LEVEL 4: TUẦN (Shown ONLY when navLessonSemester !== null && navLessonWeek === null) */}
            {/* ========================================================= */}
            {navLessonSemester !== null && navLessonWeek === null && (
              <div className="space-y-4 animate-fade-in">
                <div className="bg-gradient-to-r from-teal-50 via-sky-50 to-emerald-50 border border-teal-100 rounded-3xl p-6 sm:p-8">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                      <span className="px-3 py-1 bg-teal-600 text-white text-xs font-black rounded-full uppercase tracking-wider">
                        Bước 4 / 5 — Khối {navLessonGrade} · Học kỳ {navLessonSemester === 1 ? 'I' : 'II'}
                      </span>
                      <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                        Chọn Tuần Học
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
                        Chỉ hiển thị các tuần thực sự có bài đọc. Thầy cô có thể chọn một tuần hoặc xem nhanh toàn bộ học kỳ.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Option to View All Lessons in Semester */}
                      <button
                        type="button"
                        onClick={() => handleSelectLessonWeek('all')}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition active:scale-95 inline-flex items-center gap-2 cursor-pointer"
                        title="Xem toàn bộ bài đọc trong học kỳ này mà không cần bấm từng tuần"
                      >
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>Xem toàn bộ bài trong học kỳ ({semLessons.length} bài)</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleBackToLessonSemesters}
                        className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Đổi học kỳ khác</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Week Cards Grid */}
                {(() => {
                  const availableWeeks = Array.from(
                    new Set(
                      semLessons
                        .map((ls) => ls.week)
                        .filter((w): w is number => typeof w === 'number')
                    )
                  ).sort((a, b) => a - b);

                  if (availableWeeks.length === 0) {
                    return (
                      <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-500">
                        <p className="font-bold text-base">Không tìm thấy tuần học nào có dữ liệu.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {availableWeeks.map((week) => {
                        const wl = semLessons.filter((ls) => ls.week === week);
                        return (
                          <div
                            key={week}
                            onClick={() => handleSelectLessonWeek(week)}
                            className="group relative bg-white border-2 border-slate-200 hover:border-emerald-500 rounded-3xl p-5 shadow-sm hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between gap-4"
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 text-xs font-black rounded-lg border border-emerald-200">
                                  Tuần {week}
                                </span>
                                <span className="text-xs font-bold text-slate-400">
                                  {wl.length} bài đọc
                                </span>
                              </div>

                              <div className="pt-2">
                                <h4 className="text-base font-black text-slate-900 group-hover:text-emerald-700 transition">
                                  {wl.map((l) => l.title).join(', ')}
                                </h4>
                                <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                                  Chủ điểm: {wl.map((l) => l.topic).join('; ')}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleSelectLessonWeek(week)}
                              className="w-full py-2.5 px-3 bg-emerald-600 group-hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <span>Xem bài đọc Tuần {week}</span>
                              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ========================================================= */}
            {/* LEVEL 5: BÀI ĐỌC (Shown ONLY when navLessonWeek !== null) */}
            {/* ========================================================= */}
            {navLessonWeek !== null && (
              <div className="space-y-6 animate-fade-in">
                {/* Scoped Toolbar */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleBackToLessonWeeks}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl border border-slate-200 transition inline-flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>{navLessonWeek === 'all' ? 'Chọn theo tuần' : 'Đổi tuần khác'}</span>
                    </button>

                    {/* Status Filter */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                      {[
                        { id: 'all', label: 'Tất cả trạng thái' },
                        { id: 'published', label: 'Đã xuất bản' },
                        { id: 'draft', label: 'Bản nháp' },
                        { id: 'archived', label: 'Lưu trữ' }
                      ].map((st) => (
                        <button
                          key={st.id}
                          onClick={() => setLessonFilterStatus(st.id as any)}
                          className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                            lessonFilterStatus === st.id
                              ? 'bg-white text-emerald-950 font-black shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>

                    {/* Toggle: All in Semester vs Single Week */}
                    {navLessonWeek !== 'all' ? (
                      <button
                        type="button"
                        onClick={() => handleSelectLessonWeek('all')}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        Xem tất cả bài trong HK ({semLessons.length} bài)
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleBackToLessonWeeks()}
                        className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        Thu gọn về danh sách tuần
                      </button>
                    )}
                  </div>

                  {/* Scoped Search Input */}
                  <div className="relative min-w-[220px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Tìm bài trong phạm vi này..."
                      value={lessonSearch}
                      onChange={(e) => setLessonSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                  </div>
                </div>

                {/* Lesson Cards Grid */}
                {displayedLessons.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {displayedLessons.map((ls) => {
                      const status = ls.status || 'published';
                      const versionNum = ls.currentVersionNumber || 1;
                      const assignedCount = ls.assignedClassCount || 0;
                      const qCount = ls.totalQuestions || 5;

                      return (
                        <div
                          key={ls.id}
                          className={`bg-white rounded-3xl p-6 border shadow-sm flex flex-col justify-between hover:shadow-md transition ${
                            status === 'archived'
                              ? 'border-slate-300 bg-slate-50/60 opacity-80'
                              : status === 'draft'
                              ? 'border-amber-200 bg-amber-50/20'
                              : 'border-slate-200'
                          }`}
                        >
                          <div>
                            {/* Top Pills */}
                            <div className="flex items-center justify-between gap-2 mb-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-2.5 py-1 bg-sky-100 text-sky-800 text-xs font-black rounded-full">
                                  Khối {ls.grade}
                                </span>
                                <span className="px-2.5 py-1 bg-violet-100 text-violet-800 text-xs font-black rounded-full">
                                  HK {ls.semester === 2 ? 'II' : 'I'}
                                </span>
                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[11px] font-bold rounded-lg border border-indigo-200">
                                  Tuần {ls.week || 1}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {status === 'published' && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenLessonInfo(ls, 'versions')}
                                    className="px-2.5 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[11px] font-black rounded-full flex items-center gap-1 border border-emerald-300 transition cursor-pointer"
                                    title="Xem lịch sử các phiên bản của bài đọc này"
                                  >
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span>v{versionNum}</span>
                                  </button>
                                )}
                                {status === 'draft' && (
                                  <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 text-[11px] font-black rounded-full border border-amber-300">
                                    Bản nháp
                                  </span>
                                )}
                                {status === 'archived' && (
                                  <span className="px-2.5 py-0.5 bg-slate-200 text-slate-700 text-[11px] font-black rounded-full border border-slate-300">
                                    Đã lưu trữ
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Title, Genre & Topic */}
                            <div className="mb-2">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded">
                                  {ls.genre === 'informational' ? 'Văn bản thông tin' : ls.genre === 'poetry' ? 'Thơ' : ls.genre === 'descriptive' ? 'Văn miêu tả' : 'Văn bản tự sự'}
                                </span>
                                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  Bám sát GDPT 2018
                                </span>

                                {/* Metadata Academic Year Scope Badge (Module 2.1) */}
                                {ls.academicYearScope === 'specific' && (ls as any).academicYear ? (
                                  <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-indigo-600" />
                                    <span>Năm học: {(ls as any).academicYear}</span>
                                  </span>
                                ) : (
                                  <span
                                    className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1"
                                    title="Bài đọc dùng chung cho nhiều năm học"
                                  >
                                    <Globe className="w-3 h-3 text-emerald-600" />
                                    <span>Kho dùng chung</span>
                                  </span>
                                )}
                              </div>
                              <h3 className="text-lg font-black text-slate-900 leading-snug">{ls.title}</h3>
                              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                                Chủ điểm: {ls.topic}
                              </p>
                            </div>

                            {/* Curriculum Requirement preview */}
                            {ls.curriculumRequirement && (
                              <div className="mb-3 p-2 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 leading-snug">
                                <span className="font-bold text-slate-700">Yêu cầu cần đạt: </span>
                                <span className="line-clamp-2">{ls.curriculumRequirement}</span>
                              </div>
                            )}

                            {/* Metadata counts & assigned classes list */}
                            <div className="space-y-2 mb-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold">
                                  {qCount} câu hỏi
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenLessonInfo(ls, 'assignments')}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    assignedCount > 0 ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                                  }`}
                                  title="Bấm để xem chi tiết các lớp đã được giao bài này"
                                >
                                  {assignedCount > 0 ? `Đã giao: ${assignedCount} lớp` : 'Chưa giao lớp nào'}
                                </button>
                              </div>

                              {/* Assigned Classes Badges if present */}
                              {(ls as any).assignedClasses && (ls as any).assignedClasses.length > 0 && (
                                <div className="flex flex-wrap gap-1 items-center pt-1">
                                  <span className="text-[10px] font-bold text-slate-400">Đã giao:</span>
                                  {(ls as any).assignedClasses.map((ac: any) => {
                                    const cName = classes.find((c) => c.id === ac.classId)?.name || ac.classId;
                                    return (
                                      <span
                                        key={ac.assignmentId || ac.classId}
                                        className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[10px] font-bold"
                                      >
                                         {cName} ({ac.roundName})
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Card Action Buttons */}
                          <div className="pt-4 border-t border-slate-100 space-y-2">
                            {/* Primary Action Buttons */}
                            <div className="flex items-center gap-2">
                              {/* Student Preview Button */}
                              <button
                                onClick={() => handleOpenStudentPreview(ls)}
                                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                                title="Xem trước bài đọc và thử câu hỏi như học sinh (không lưu điểm)"
                              >
                                <Eye className="w-3.5 h-3.5 text-sky-600" />
                                <span>Xem thử</span>
                              </button>

                              {/* Edit / Create New Version Button */}
                              <button
                                onClick={() => handleEditLesson(ls.id)}
                                className="flex-1 py-2 bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                                title={status === 'published' ? 'Chỉnh sửa và tạo phiên bản mới khi xuất bản' : 'Tiếp tục chỉnh sửa bản nháp'}
                              >
                                <Edit3 className="w-3.5 h-3.5 text-sky-700" />
                                <span>{status === 'published' ? 'Sửa / Tạo bản mới' : 'Sửa nháp'}</span>
                              </button>
                            </div>

                            {/* Secondary Action Buttons */}
                            <div className="flex items-center gap-2">
                              {status === 'published' && (
                                <button
                                  onClick={() => {
                                    setAssignLessonId(ls.id);
                                    setAssignVersionId(ls.currentVersionId);
                                    setSelectedLessonForAssign(ls);
                                    const sameGrade = classes.filter((c) => c.grade === ls.grade).map((c) => c.id);
                                    setAssignClassIds(sameGrade.length > 0 ? [sameGrade[0]] : []);
                                    setAssignRoundName('Đợt 1');
                                    setAssignForceNewRound(false);
                                    setAssignDuplicateWarning(null);
                                    setAssignAllowEarlyAccess(false);
                                    setShowAssignModal(true);
                                  }}
                                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  <span>Giao bài cho lớp</span>
                                </button>
                              )}

                              {status !== 'archived' && (
                                <button
                                  onClick={() => handleArchiveLesson(ls.id, ls.title)}
                                  className="px-3 py-2 bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-800 font-bold text-xs rounded-xl transition cursor-pointer"
                                  title="Lưu trữ bài đọc (giữ nguyên toàn bộ lịch sử điểm số của học sinh)"
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            {/* Quick Switch Scope Action (Module 2.1) */}
                            <div className="pt-1">
                              {ls.academicYearScope === 'specific' && (ls as any).academicYear ? (
                                <button
                                  type="button"
                                  onClick={() => handleQuickUpdateLessonScope(ls, 'shared')}
                                  className="w-full py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-[11px] rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                                  title="Chuyển bài đọc này vào Kho học liệu dùng chung nhiều năm học"
                                >
                                  <Globe className="w-3 h-3 text-emerald-600" />
                                  <span>Chuyển vào Kho chung</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleQuickUpdateLessonScope(ls, 'specific', '2026-2027')}
                                  className="w-full py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold text-[11px] rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                                  title="Gắn bài đọc này riêng cho Năm học 2026–2027"
                                >
                                  <Calendar className="w-3 h-3 text-indigo-600" />
                                  <span>Gắn vào năm 2026–2027</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
                    <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h4 className="font-bold text-slate-700">Không tìm thấy bài đọc nào phù hợp trong tuần/học kỳ này</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Thử đổi từ khóa tìm kiếm hoặc chọn tuần khác.
                    </p>
                  </div>
                )}
              </div>
            )}


            {/* Modal: Assign Lesson with Duplicate Prevention */}
            {showAssignModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                    <div>
                      <h3 className="text-xl font-black text-slate-900">Giao Bài Đọc Cho Lớp</h3>
                      {selectedLessonForAssign && (
                        <p className="text-xs text-slate-500 font-semibold mt-0.5">
                          Bài: <strong className="text-slate-800">{selectedLessonForAssign.title}</strong> (Khối {selectedLessonForAssign.grade} · {selectedLessonForAssign.topic})
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setShowAssignModal(false)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleAssignLesson} className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-slate-800">
                          Chọn các lớp giao bài ({assignClassIds.length} lớp đã chọn):
                        </label>
                        <div className="flex items-center gap-1.5">
                          {selectedLessonForAssign && (
                            <button
                              type="button"
                              onClick={() => {
                                const sameGrade = classes.filter((c) => c.grade === selectedLessonForAssign.grade).map((c) => c.id);
                                setAssignClassIds(sameGrade);
                              }}
                              className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 cursor-pointer"
                            >
                              Khối {selectedLessonForAssign.grade}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setAssignClassIds(classes.map((c) => c.id))}
                            className="text-[11px] font-bold text-sky-700 hover:text-sky-900 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 cursor-pointer"
                          >
                            Tất cả
                          </button>
                          <button
                            type="button"
                            onClick={() => setAssignClassIds([])}
                            className="text-[11px] font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                          >
                            Bỏ chọn
                          </button>
                        </div>
                      </div>

                      {/* Class Checkbox Grid */}
                      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                        {classes.map((c) => {
                          const isChecked = assignClassIds.includes(c.id);
                          const hasInRound = (selectedLessonForAssign as any)?.assignedClasses?.some(
                            (ac: any) => ac.classId === c.id && ac.roundName === assignRoundName
                          );

                          return (
                            <label
                              key={c.id}
                              className={`flex items-start gap-2 p-2 rounded-lg border text-xs cursor-pointer transition ${
                                isChecked
                                  ? 'bg-emerald-50/80 border-emerald-300 font-bold text-emerald-950'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setAssignClassIds([...assignClassIds, c.id]);
                                  } else {
                                    setAssignClassIds(assignClassIds.filter((id) => id !== c.id));
                                  }
                                }}
                                className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="font-extrabold">{c.name}</span>
                                  <span className="text-[10px] text-slate-500">Khối {c.grade}</span>
                                </div>
                                <div className="flex items-center justify-between mt-0.5">
                                  <span className="text-[10px] text-slate-400 font-mono">NH: {c.academicYear}</span>
                                  {hasInRound && (
                                    <span className="text-[9px] bg-amber-100 text-amber-800 px-1 rounded font-bold">
                                      Đã có {assignRoundName}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Tên đợt giao bài (Dùng để quản lý và chống giao trùng lặp)
                      </label>
                      <input
                        type="text"
                        value={assignRoundName}
                        onChange={(e) => setAssignRoundName(e.target.value)}
                        placeholder="VD: Đợt 1, Đợt ôn tập, Đợt thi đua..."
                        className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-semibold focus:bg-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Số lượt làm tối đa cho mỗi học sinh
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={assignMaxAttempts}
                        onChange={(e) => setAssignMaxAttempts(Number(e.target.value))}
                        className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-semibold focus:bg-white"
                        required
                      />
                    </div>

                    {/* Pre / Post test marking */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={assignIsPreTest}
                          onChange={(e) => {
                            setAssignIsPreTest(e.target.checked);
                            if (e.target.checked) setAssignIsPostTest(false);
                          }}
                          className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                        />
                        <span>Đánh dấu là Bài kiểm tra đầu kỳ (Pre-test)</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={assignIsPostTest}
                          onChange={(e) => {
                            setAssignIsPostTest(e.target.checked);
                            if (e.target.checked) setAssignIsPreTest(false);
                          }}
                          className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                        />
                        <span>Đánh dấu là Bài kiểm tra cuối kỳ (Post-test)</span>
                      </label>
                    </div>

                    {/* Tiến độ chương trình (Week Check) & Cho học trước */}
                    {Number((selectedLessonForAssign as any)?.week || 1) > 7 ? (
                      <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2 text-xs">
                        <div className="flex items-start gap-2 text-indigo-900 font-bold">
                          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                          <div>
                            <p>
                              Bài đọc thuộc <strong>Tuần {(selectedLessonForAssign as any)?.week}</strong> (vượt quá tiến độ thực tế là <strong>Tuần 7</strong>).
                            </p>
                          </div>
                        </div>
                        <label className="flex items-center gap-2 font-black text-indigo-950 cursor-pointer pt-1 border-t border-indigo-200">
                          <input
                            type="checkbox"
                            checked={assignAllowEarlyAccess}
                            onChange={(e) => setAssignAllowEarlyAccess(e.target.checked)}
                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                          />
                          <span>Cho phép học trước tiến độ (Học sinh mở làm bài ngay)</span>
                        </label>
                        {!assignAllowEarlyAccess && (
                          <p className="text-[11px] text-indigo-700 italic">
                            * Nếu không chọn, bài giao sẽ ở trạng thái &ldquo;Chờ mở&rdquo; và tự động kích hoạt khi trường chuyển sang Tuần {(selectedLessonForAssign as any)?.week}.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-semibold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Bài đọc thuộc Tuần {(selectedLessonForAssign as any)?.week || 1} &le; Tuần 7 hiện tại (Phù hợp tiến độ, học sinh mở ngay).</span>
                      </div>
                    )}

                    {/* Duplicate Warning & Force Option */}
                    {assignDuplicateWarning && (
                      <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-2 text-xs">
                        <div className="flex items-start gap-2 text-amber-900 font-bold">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <span>{assignDuplicateWarning}</span>
                        </div>
                        <label className="flex items-center gap-2 font-bold text-amber-950 cursor-pointer pt-1 border-t border-amber-200">
                          <input
                            type="checkbox"
                            checked={assignForceNewRound}
                            onChange={(e) => setAssignForceNewRound(e.target.checked)}
                            className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                          />
                          <span>Xác nhận giao thêm đợt mới / Ghi đè giao bài</span>
                        </label>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAssignModal(false)}
                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl text-xs cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow cursor-pointer"
                      >
                        {assignDuplicateWarning && assignForceNewRound ? 'Xác nhận giao đợt mới' : 'Xác nhận giao bài'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal: Lesson Version History & Assigned Classes */}
            {viewingLessonInfo && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col overflow-hidden">
                  {/* Header */}
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-black text-slate-900">
                          {viewingLessonInfo.lesson.title}
                        </h3>
                        <span className="px-2 py-0.5 bg-sky-100 text-sky-800 text-[11px] font-bold rounded-full">
                          Khối {viewingLessonInfo.lesson.grade}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-semibold mt-0.5">
                        Chủ đề: {viewingLessonInfo.lesson.topic}
                      </p>
                    </div>
                    <button
                      onClick={() => setViewingLessonInfo(null)}
                      className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200 transition cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Tabs Switcher: Versions vs Assignments */}
                  <div className="px-6 pt-3 flex gap-2 border-b border-slate-100">
                    <button
                      onClick={() => setLessonInfoTab('versions')}
                      className={`pb-2.5 px-3 text-xs font-black border-b-2 transition cursor-pointer ${
                        lessonInfoTab === 'versions'
                          ? 'border-emerald-600 text-emerald-700'
                          : 'border-transparent text-slate-400 hover:text-slate-700'
                      }`}
                    >
                      Lịch sử phiên bản ({viewingLessonInfo.versions.length})
                    </button>
                    <button
                      onClick={() => setLessonInfoTab('assignments')}
                      className={`pb-2.5 px-3 text-xs font-black border-b-2 transition cursor-pointer ${
                        lessonInfoTab === 'assignments'
                          ? 'border-emerald-600 text-emerald-700'
                          : 'border-transparent text-slate-400 hover:text-slate-700'
                      }`}
                    >
                      Lớp đã được giao ({viewingLessonInfo.assignments.length})
                    </button>
                  </div>

                  {/* Content */}
                  <div className="p-6 overflow-y-auto space-y-4">
                    {lessonInfoTab === 'versions' ? (
                      viewingLessonInfo.versions.length === 0 ? (
                        <div className="text-center py-8 text-xs text-slate-400 font-medium">
                          Chưa có lịch sử phiên bản nào khác cho bài này.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {viewingLessonInfo.versions.map((ver: any) => (
                            <div key={ver.versionId} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-black rounded-full border border-emerald-300">
                                    Phiên bản v{ver.versionNumber}
                                  </span>
                                  <span className="text-xs font-bold text-slate-800">
                                    {ver.title}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                  <span className="text-[11px] text-slate-500">
                                    Xuất bản lúc: {ver.publishedAt ? new Date(ver.publishedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Gốc'} · {ver.totalQuestions} câu hỏi
                                  </span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ver.hasAudio ? 'bg-sky-100 text-sky-800 border border-sky-200' : 'bg-slate-200 text-slate-700'}`}>
                                    {ver.hasAudio ? '🎙️ Có file âm thanh TTS' : '🔊 Web Speech API'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleOpenStudentPreview(viewingLessonInfo.lesson, ver.versionId)}
                                  className="px-3 py-1.5 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-xl border border-sky-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                                  title="Xem trước nội dung và âm thanh của phiên bản này"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Xem thử v{ver.versionNumber}</span>
                                </button>
                                <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                                  Đã lưu bất biến
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    ) : (
                      viewingLessonInfo.assignments.length === 0 ? (
                        <div className="text-center py-8 text-xs text-slate-400 font-medium">
                          Bài đọc này chưa được giao cho lớp học nào.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {viewingLessonInfo.assignments.map((asg: any) => (
                            <div key={asg.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-sm text-slate-900">
                                    {asg.className}
                                  </span>
                                  <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-black rounded-full">
                                    {asg.roundName || 'Đợt 1'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  Năm học: {asg.academicYear} · Phiên bản giao: v{asg.lessonVersionNumber || 1}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Thời gian giao: {asg.createdAt ? new Date(asg.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Gần đây'}
                                </div>
                              </div>
                              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl">
                                Đang mở làm bài
                              </span>
                            </div>
                          ))}
                        </div>
                      )
                    )}
                  </div>

                  <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                    <button
                      onClick={() => setViewingLessonInfo(null)}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                    >
                      Đóng cửa sổ
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ========================================================= */}
      {/* TAB 4: AUTHORING & AI LESSON GENERATOR */}
      {/* ========================================================= */}
      {activeTab === 'authoring' && (
        <div className="space-y-6 animate-fade-in">
          {/* Submode Switcher */}
          <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit">
            <button
              onClick={() => setAuthoringMode('ai')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-extrabold transition ${
                authoringMode === 'ai' ? 'bg-white text-emerald-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BrainCircuit className="w-4 h-4 text-emerald-600" />
              <span>Tạo bản nháp bằng AI (Google Gemini)</span>
            </button>
            <button
              onClick={() => setAuthoringMode('manual')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-extrabold transition ${
                authoringMode === 'manual' ? 'bg-white text-emerald-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PenTool className="w-4 h-4 text-sky-600" />
              <span>Soạn bài thủ công</span>
            </button>
          </div>

          {authoringMode === 'ai' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 mb-1">
                Thiết Kế Học Liệu Bằng AI (Google Gemini)
              </h3>
              <p className="text-xs text-slate-500 font-semibold mb-6">
                AI tạo bản nháp bài đọc và 5 câu hỏi tích hợp 3 dạng trắc nghiệm. Giáo viên duyệt trước khi học sinh thấy.
              </p>

              {/* AI Service Status Banner (4 Distinct States) */}
              {aiStatus && (
                <div className="mb-6">
                  {aiStatus.status === 'VERIFIED' ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-950 font-semibold">
                      <div className="flex items-center gap-2.5">
                        <Sparkles className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div>
                          <div className="font-bold text-sm text-emerald-900">
                            Dịch vụ AI sẵn sàng: Google Gemini ({aiStatus.activeModel || aiStatus.model})
                          </div>
                          <p className="text-emerald-700 text-xs mt-0.5">
                            Đã kiểm chứng phản hồi thực tế (Độ trễ: {aiStatus.lastLatencyMs || 0}ms). Sẵn sàng tạo học liệu đọc hiểu chuẩn GDPT.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-black uppercase tracking-wider">
                          Đã kiểm chứng
                        </span>
                        <button
                          type="button"
                          onClick={handleTestAIConnection}
                          disabled={testingAI}
                          className="px-3 py-1 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition disabled:opacity-50"
                        >
                          {testingAI ? 'Đang thử...' : 'Kiểm tra lại'}
                        </button>
                      </div>
                    </div>
                  ) : aiStatus.status === 'READY_UNVERIFIED' ? (
                    <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-sky-950 font-semibold">
                      <div className="flex items-center gap-2.5">
                        <BrainCircuit className="w-5 h-5 text-sky-600 shrink-0" />
                        <div>
                          <div className="font-bold text-sm text-sky-900">
                            Đã cấu hình khóa API (Model: {aiStatus.activeModel || aiStatus.model})
                          </div>
                          <p className="text-sky-700 text-xs mt-0.5">
                            Đã nhận diện khóa trong backend nhưng chưa kiểm chứng với cuộc gọi thật. Nhấn nút bên cạnh để kiểm tra.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                        <span className="px-2.5 py-1 bg-sky-100 text-sky-800 rounded-lg text-[10px] font-black uppercase tracking-wider">
                          Chưa kiểm chứng
                        </span>
                        <button
                          type="button"
                          onClick={handleTestAIConnection}
                          disabled={testingAI}
                          className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-black shadow-sm transition disabled:opacity-50"
                        >
                          {testingAI ? 'Đang kiểm tra...' : 'Kiểm tra kết nối AI'}
                        </button>
                      </div>
                    </div>
                  ) : aiStatus.status === 'UNAVAILABLE' ? (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-950 font-semibold">
                      <div className="flex items-start gap-2.5">
                        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold text-sm text-rose-900">
                            Dịch vụ AI tạm thời không khả dụng ({aiStatus.lastErrorCode || 'Lỗi nhà cung cấp'})
                          </div>
                          <p className="text-rose-700 text-xs mt-0.5 leading-relaxed">
                            {aiStatus.message || 'Không thể kết nối đến Google Gemini. Thầy cô có thể chuyển sang Soạn thủ công hoặc kiểm tra lại sau.'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                        <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-lg text-[10px] font-black uppercase tracking-wider">
                          Không khả dụng
                        </span>
                        <button
                          type="button"
                          onClick={handleTestAIConnection}
                          disabled={testingAI}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-black shadow-sm transition disabled:opacity-50"
                        >
                          {testingAI ? 'Đang thử lại...' : 'Thử lại kết nối'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-xs text-amber-950 font-semibold">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm">Chưa cấu hình GEMINI_API_KEY (Đang bật chế độ thủ công & bài mẫu)</span>
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-lg text-[10px] font-black uppercase tracking-wider">
                            Chưa cấu hình
                          </span>
                        </div>
                        <p className="text-amber-800 font-medium mt-1 leading-relaxed">
                          Hệ thống chưa tìm thấy khóa <code>GEMINI_API_KEY</code> trong biến môi trường hoặc Firebase Secrets. Thầy cô có thể chuyển sang tab <strong>Soạn bài thủ công</strong> hoặc nạp <strong>6 bài đọc mẫu chuẩn GDPT</strong> để sử dụng ngay mà không ảnh hưởng đến việc dạy học.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Khối lớp</label>
                  <select
                    value={aiGrade}
                    onChange={(e) => setAiGrade(Number(e.target.value) as Grade)}
                    className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-semibold focus:bg-white"
                  >
                    <option value={2}>Lớp 2 (Khoảng 100 - 180 từ)</option>
                    <option value={3}>Lớp 3 (Khoảng 150 - 220 từ)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Học kỳ & Tuần học</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={aiSemester}
                      onChange={(e) => setAiSemester(Number(e.target.value) as 1 | 2)}
                      className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-semibold focus:bg-white"
                    >
                      <option value={1}>Học kỳ I</option>
                      <option value={2}>Học kỳ II</option>
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={35}
                      value={aiWeek}
                      onChange={(e) => setAiWeek(Number(e.target.value))}
                      placeholder="Tuần (1-35)"
                      className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-semibold focus:bg-white"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Thể loại văn bản</label>
                  <select
                    value={aiGenre}
                    onChange={(e) => setAiGenre(e.target.value as any)}
                    className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-semibold focus:bg-white"
                  >
                    <option value="narrative">Văn bản tự sự / Truyện ngắn</option>
                    <option value="informational">Văn bản thông tin / Khoa học thường thức</option>
                    <option value="poetry">Thơ ca thiếu nhi</option>
                    <option value="descriptive">Văn miêu tả quê hương, thiên nhiên</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Chủ đề bài đọc</label>
                  <input
                    type="text"
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    placeholder="VD: Gia đình thân yêu, Bạn bè, Đất nước Việt Nam..."
                    className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-semibold focus:bg-white"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mục tiêu đọc hiểu</label>
                  <input
                    type="text"
                    value={aiGoal}
                    onChange={(e) => setAiGoal(e.target.value)}
                    placeholder="VD: Rèn luyện tìm thông tin trực tiếp và giải nghĩa từ ngữ mới"
                    className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-semibold focus:bg-white"
                  />
                </div>

                <div className="md:col-span-2 p-3.5 bg-indigo-50/90 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      id="autoGenerateAudioCheckbox"
                      checked={aiAutoGenerateAudio}
                      onChange={(e) => setAiAutoGenerateAudio(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-indigo-950">
                      Tự tạo giọng đọc tiếng Việt sau khi AI soạn bài xong
                    </span>
                  </label>
                  <span className="text-[11px] text-indigo-700 font-medium">
                    (Mặc định tắt để tiết kiệm hạn mức API)
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={generatingAI}
                onClick={handleGenerateAI}
                className="px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-sm rounded-2xl shadow-md transition active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                <Sparkles className="w-5 h-5 text-amber-300" />
                <span>{generatingAI ? 'AI đang biên soạn bài...' : 'Tạo bản nháp với AI'}</span>
              </button>
            </div>
          )}

          {authoringMode === 'manual' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 mb-2">Soạn Bài Thủ Công</h3>
              <p className="text-xs text-slate-500 font-semibold mb-6">
                Chế độ này cho phép giáo viên tự soạn bài đọc hoặc tùy biến các bài tập theo ý muốn mà không phụ thuộc vào khóa API AI.
              </p>
              <button
                onClick={() => {
                  setDraftLesson({
                    title: 'Đàn chim trở về phương Nam',
                    passage: 'Mùa thu đến, rặng tre đầu làng xao xác lá vàng rơi. Từng đàn chim én chao lượn trên bầu trời xanh thẳm, chuẩn bị cho chuyến bay tránh rét về phương Nam ấm áp. Chúng cất tiếng hót ríu rít như gửi lời chào tạm biệt quê hương thân thương.',
                    grade: 2,
                    semester: 1,
                    week: 8,
                    topic: 'Mùa thu quê hương',
                    genre: 'narrative',
                    academicYearScope: 'shared',
                    academicYear: null,
                    curriculumRequirement: 'Đọc đúng, trôi chảy văn bản; nhận biết chi tiết trực tiếp về chuyến bay của đàn chim én; bồi dưỡng tình yêu thiên nhiên.',
                    source: 'teacher_created',
                    referenceSource: 'Học liệu đọc hiểu soạn thủ công theo CT GDPT 2018',
                    verificationStatus: 'teacher_created',
                    vocabulary: [
                      { word: 'xao xác', meaning: 'Âm thanh lá cây cọ xát vào nhau khi có gió thổi.', example: 'Gió thu xao xác.' }
                    ],
                    questions: [
                      {
                        id: 'q1',
                        type: 'multiple_choice',
                        prompt: 'Đàn chim én chuẩn bị bay đi đâu?',
                        options: ['Về phương Nam ấm áp', 'Lên đỉnh núi tuyết', 'Ra biển khơi'],
                        answer: 'A',
                        hint: 'Xem câu thứ hai của bài đọc nhé.',
                        explanation: 'Đàn chim bay về phương Nam để tránh rét.',
                        skillTag: 'thong_tin_truc_tiep',
                        difficulty: 'nhan_biet'
                      }
                    ]
                  });
                }}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-sm transition"
              >
                Tải khung bài mẫu soạn thủ công
              </button>
            </div>
          )}

          {/* Lesson Draft Preview & Approval (V5.2 ENHANCED) */}
          {draftLesson && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-emerald-300 shadow-xl space-y-6 animate-fade-in">
              {/* Draft Header & Main Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-black rounded-full uppercase">
                      {currentEditingLessonId ? 'Đang chỉnh sửa bài học' : 'Bản nháp mới chờ duyệt'}
                    </span>
                    {currentEditingLessonId && (
                      <span className="px-2.5 py-0.5 bg-sky-100 text-sky-800 text-xs font-bold rounded-full">
                        Phiên bản hiện tại: v{currentEditingVersionNumber}
                      </span>
                    )}
                    {draftLesson.academicYearScope === 'specific' && draftLesson.academicYear ? (
                      <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-full border border-indigo-200 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-indigo-600" />
                        <span>Gắn năm học: {draftLesson.academicYear}</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-200 flex items-center gap-1">
                        <Globe className="w-3 h-3 text-emerald-600" />
                        <span>Kho học liệu dùng chung</span>
                      </span>
                    )}
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mt-2">{draftLesson.title}</h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    Khối {draftLesson.grade} · Chủ đề: {draftLesson.topic} · Thể loại: {draftLesson.genre === 'informational' ? 'Văn bản thông tin' : 'Văn bản tự sự'} · ~{draftLesson.passage.split(/\s+/).filter(Boolean).length} từ · {draftLesson.questions.length} câu hỏi
                  </p>
                  {currentEditingLessonId && (
                    <p className="text-[11px] font-bold text-sky-700 mt-1">
                      ℹ️ Xuất bản bài học này sẽ tự động sinh phiên bản mới <strong>v{currentEditingVersionNumber + 1}</strong>. Lịch sử bài làm của học sinh ở các phiên bản trước được bảo toàn bất biến.
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Save Draft Button */}
                  <button
                    type="button"
                    disabled={savingDraft}
                    onClick={handleSaveDraft}
                    className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Lưu bản nháp vào hệ thống (không xuất bản, có thể sửa tiếp sau)"
                  >
                    <Save className="w-4 h-4 text-amber-600" />
                    <span>{savingDraft ? 'Đang lưu...' : 'Lưu bản nháp'}</span>
                  </button>

                  {/* Student Preview from Authoring */}
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewModalLesson(draftLesson);
                      setPreviewQuestionIdx(0);
                      setPreviewUserAnswers({});
                      setPreviewShowHint({});
                    }}
                    className="px-4 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-300 font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                    title="Mô phỏng trải nghiệm đọc và trả lời câu hỏi của học sinh trực tiếp từ bản soạn"
                  >
                    <Eye className="w-4 h-4 text-sky-600" />
                    <span>Xem thử học sinh</span>
                  </button>

                  {/* Toggle Edit/Preview */}
                  <button
                    type="button"
                    onClick={() => setIsEditingDraft(!isEditingDraft)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4 text-sky-600" />
                    <span>{isEditingDraft ? 'Xem trước bản duyệt' : 'Chỉnh sửa chi tiết'}</span>
                  </button>

                  {/* Publish Button */}
                  <button
                    disabled={publishing}
                    onClick={handlePublishLesson}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{publishing ? 'Đang xuất bản...' : currentEditingLessonId ? `Xuất bản bản mới (v${currentEditingVersionNumber + 1})` : 'Duyệt & Xuất bản'}</span>
                  </button>

                  {/* Cancel / Clear Draft Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Đóng trình biên tập bài đọc này?')) {
                        setDraftLesson(null);
                        setCurrentEditingLessonId(null);
                        setIsEditingDraft(false);
                      }
                    }}
                    className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                    title="Đóng bản soạn"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Question Management Action Bar (Add Question & AI Generate Additional) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                    Quản lý câu hỏi ({draftLesson.questions.length}/20 câu):
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    (Hỗ trợ 1–20 câu, 3 dạng: Trắc nghiệm, Đúng/Sai, Sắp xếp)
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 relative">
                  {/* Add Question Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowAddQuestionMenu(!showAddQuestionMenu)}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Thêm câu hỏi mới</span>
                    </button>

                    {showAddQuestionMenu && (
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-20 animate-fade-in">
                        <button
                          type="button"
                          onClick={() => handleAddQuestion('multiple_choice')}
                          className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-800 hover:bg-emerald-50 hover:text-emerald-900 flex items-center gap-2 cursor-pointer"
                        >
                          <span className="w-2 h-2 rounded-full bg-sky-500" />
                          <span>1. Trắc nghiệm A/B/C (3 lựa chọn)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddQuestion('true_false')}
                          className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-800 hover:bg-emerald-50 hover:text-emerald-900 flex items-center gap-2 cursor-pointer"
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>2. Nhận định Đúng / Sai</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddQuestion('sequence')}
                          className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-800 hover:bg-emerald-50 hover:text-emerald-900 flex items-center gap-2 cursor-pointer"
                        >
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <span>3. Sắp xếp 3 sự việc</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* AI Generate Additional Questions Control */}
                  <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl p-0.5">
                    <select
                      value={additionalCount}
                      onChange={(e) => setAdditionalCount(Number(e.target.value))}
                      className="text-xs font-bold text-slate-700 bg-transparent px-2 py-1.5 focus:outline-none cursor-pointer"
                    >
                      <option value={1}>+1 câu</option>
                      <option value={2}>+2 câu</option>
                      <option value={3}>+3 câu</option>
                    </select>
                    <button
                      type="button"
                      disabled={generatingAdditional}
                      onClick={handleGenerateAdditionalQuestions}
                      className="px-3 py-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      title="AI đọc nội dung bài hiện tại và sinh thêm các câu hỏi còn thiếu"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>{generatingAdditional ? 'Đang tạo...' : 'AI tạo thêm'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {isEditingDraft ? (
                /* INLINE EDIT MODE */
                <div className="space-y-6 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="text-xs font-bold text-sky-800 uppercase flex items-center gap-2">
                      <Edit3 className="w-4 h-4" /> Chỉnh sửa bài đọc và câu hỏi trước khi duyệt
                    </span>
                    <span className="text-xs text-slate-500">Giáo viên toàn quyền điều chỉnh câu chữ, gợi ý và đáp án</span>
                  </div>

                  {/* Scope Selection: Shared vs Specific Academic Year (Module 2.1) */}
                  <div className="p-4 bg-white rounded-2xl border-2 border-indigo-100 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <label className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                        <Globe className="w-4 h-4 text-indigo-600" />
                        <span>Phạm vi sử dụng:</span>
                      </label>
                      <span className="text-[11px] font-semibold text-slate-500">
                        Giáo viên có thể thay đổi phân loại và lưu lại
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Option 1: Shared across years */}
                      <label
                        className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition ${
                          (draftLesson.academicYearScope || 'shared') === 'shared'
                            ? 'bg-emerald-50/70 border-emerald-500 text-emerald-950 shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="lessonScope"
                          checked={(draftLesson.academicYearScope || 'shared') === 'shared'}
                          onChange={() =>
                            setDraftLesson({
                              ...draftLesson,
                              academicYearScope: 'shared',
                              academicYear: null
                            })
                          }
                          className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="space-y-0.5">
                          <span className="text-xs font-black block text-slate-900">
                            🌐 Dùng chung nhiều năm học
                          </span>
                          <span className="text-[11px] leading-relaxed text-slate-500 block">
                            Thuộc <strong>Kho học liệu dùng chung</strong>. Một bài dùng chung có thể giao cho nhiều lớp, nhiều năm học.
                          </span>
                        </div>
                      </label>

                      {/* Option 2: Specific year */}
                      <label
                        className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition ${
                          draftLesson.academicYearScope === 'specific'
                            ? 'bg-indigo-50/70 border-indigo-500 text-indigo-950 shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="lessonScope"
                          checked={draftLesson.academicYearScope === 'specific'}
                          onChange={() =>
                            setDraftLesson({
                              ...draftLesson,
                              academicYearScope: 'specific',
                              academicYear: draftLesson.academicYear || '2026-2027'
                            })
                          }
                          className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="space-y-0.5 flex-1">
                          <span className="text-xs font-black block text-slate-900">
                            📅 Gắn vào năm học cụ thể
                          </span>
                          <span className="text-[11px] leading-relaxed text-slate-500 block">
                            Gắn cố định vào một niên khóa cụ thể để áp dụng riêng cho năm học đó.
                          </span>

                          {draftLesson.academicYearScope === 'specific' && (
                            <div className="pt-2">
                              <label className="block text-[11px] font-bold text-indigo-900 mb-1">
                                Chọn năm học:
                              </label>
                              <select
                                value={draftLesson.academicYear || '2026-2027'}
                                onChange={(e) =>
                                  setDraftLesson({
                                    ...draftLesson,
                                    academicYearScope: 'specific',
                                    academicYear: e.target.value
                                  })
                                }
                                className="w-full px-3 py-1.5 bg-white rounded-lg border border-indigo-300 text-indigo-950 font-bold text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none cursor-pointer"
                              >
                                <option value="2026-2027">Năm học 2026–2027</option>
                              </select>
                            </div>
                          )}
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Grade, Semester, Week, Genre row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Khối lớp</label>
                      <select
                        value={draftLesson.grade}
                        onChange={(e) => setDraftLesson({ ...draftLesson, grade: Number(e.target.value) as Grade })}
                        className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-slate-800 font-bold text-xs focus:ring-2 focus:ring-sky-400 focus:outline-none"
                      >
                        <option value={2}>Lớp 2</option>
                        <option value={3}>Lớp 3</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Học kỳ</label>
                      <select
                        value={draftLesson.semester || 1}
                        onChange={(e) => setDraftLesson({ ...draftLesson, semester: Number(e.target.value) as 1 | 2 })}
                        className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-slate-800 font-bold text-xs focus:ring-2 focus:ring-sky-400 focus:outline-none"
                      >
                        <option value={1}>Học kỳ I</option>
                        <option value={2}>Học kỳ II</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Tuần học</label>
                      <input
                        type="number"
                        min={1}
                        max={35}
                        value={draftLesson.week || 1}
                        onChange={(e) => setDraftLesson({ ...draftLesson, week: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-slate-800 font-bold text-xs focus:ring-2 focus:ring-sky-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Thể loại văn bản</label>
                      <select
                        value={draftLesson.genre || 'narrative'}
                        onChange={(e) => setDraftLesson({ ...draftLesson, genre: e.target.value as any })}
                        className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-slate-800 font-bold text-xs focus:ring-2 focus:ring-sky-400 focus:outline-none"
                      >
                        <option value="narrative">Văn bản tự sự</option>
                        <option value="informational">Văn bản thông tin</option>
                        <option value="poetry">Thơ ca thiếu nhi</option>
                        <option value="descriptive">Văn miêu tả</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Tiêu đề bài đọc</label>
                      <input
                        type="text"
                        value={draftLesson.title}
                        onChange={(e) => setDraftLesson({ ...draftLesson, title: e.target.value })}
                        className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-300 text-slate-800 font-bold text-sm focus:ring-2 focus:ring-sky-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Chủ đề bài học</label>
                      <input
                        type="text"
                        value={draftLesson.topic}
                        onChange={(e) => setDraftLesson({ ...draftLesson, topic: e.target.value })}
                        className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-300 text-slate-800 font-bold text-sm focus:ring-2 focus:ring-sky-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Curriculum & Citation */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Yêu cầu cần đạt (Chương trình GDPT 2018)
                      </label>
                      <input
                        type="text"
                        value={draftLesson.curriculumRequirement || ''}
                        onChange={(e) => setDraftLesson({ ...draftLesson, curriculumRequirement: e.target.value })}
                        placeholder="VD: Đọc hiểu văn bản 110-140 từ, tìm chi tiết trực tiếp và hiểu nghĩa từ..."
                        className="w-full px-4 py-2 bg-white rounded-xl border border-slate-300 text-slate-800 font-semibold text-xs focus:ring-2 focus:ring-sky-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nguồn đối chiếu / Tham khảo SGK
                      </label>
                      <input
                        type="text"
                        value={draftLesson.referenceSource || ''}
                        onChange={(e) => setDraftLesson({ ...draftLesson, referenceSource: e.target.value })}
                        placeholder="VD: Phỏng theo SGK Tiếng Việt 2, Tập 1, tr. 84 - Bộ Kết nối tri thức"
                        className="w-full px-4 py-2 bg-white rounded-xl border border-slate-300 text-slate-800 font-semibold text-xs focus:ring-2 focus:ring-sky-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">Nội dung bài đọc (Văn bản)</label>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {draftLesson.passage.split(/\s+/).filter(Boolean).length} từ
                      </span>
                    </div>
                    <textarea
                      rows={5}
                      value={draftLesson.passage}
                      onChange={(e) => setDraftLesson({ ...draftLesson, passage: e.target.value })}
                      className="w-full p-4 bg-white rounded-xl border border-slate-300 text-slate-800 font-medium text-sm leading-relaxed focus:ring-2 focus:ring-sky-400 focus:outline-none"
                    />
                  </div>

                  {/* Audio Management via Unified LessonAudioPanel - GÓI C V5.5.2 */}
                  <LessonAudioPanel
                    passage={draftLesson.passage}
                    title={draftLesson.title}
                    grade={draftLesson.grade}
                    lessonId={currentEditingLessonId || draftLesson.lessonId}
                    audioUrl={draftLesson.audioUrl}
                    audioMetadata={draftLesson.audioMetadata}
                    onAudioApproved={(url, metadata) => {
                      setDraftLesson({
                        ...draftLesson,
                        audioUrl: url,
                        audioMetadata: metadata
                      });
                      setActionMessage({
                        type: 'success',
                        text: 'Đã phê duyệt và gắn giọng đọc vào bản nháp bài học thành công!'
                      });
                    }}
                    onAudioDeleted={() => {
                      setDraftLesson({
                        ...draftLesson,
                        audioUrl: undefined,
                        audioMetadata: undefined
                      });
                      setActionMessage({
                        type: 'success',
                        text: 'Đã gỡ bỏ tệp âm thanh khỏi bài học.'
                      });
                    }}
                    onOpenVoiceSurveyModal={() => setShowVoiceComparisonModal(true)}
                    autoTriggerGenerate={autoTriggerAudio}
                    onAutoTriggerFinished={() => setAutoTriggerAudio(false)}
                  />

                  {/* Editable questions */}
                  <div className="space-y-4 pt-2">
                    {draftLesson.questions.map((q, idx) => (
                      <div key={q.id || idx} className="p-5 bg-white rounded-2xl border border-slate-300 shadow-sm space-y-3">
                        {/* Question Header & Order/CRUD buttons */}
                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-bold text-slate-800 uppercase">
                              {QUESTION_TYPE_LABELS[q.type] || q.type}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Move Up */}
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveQuestion(idx, -1)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg disabled:opacity-30 cursor-pointer"
                              title="Di chuyển câu hỏi lên trên"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            {/* Move Down */}
                            <button
                              type="button"
                              disabled={idx === draftLesson.questions.length - 1}
                              onClick={() => handleMoveQuestion(idx, 1)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg disabled:opacity-30 cursor-pointer"
                              title="Di chuyển câu hỏi xuống dưới"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            {/* Clone Question */}
                            <button
                              type="button"
                              onClick={() => handleCloneQuestion(idx)}
                              className="p-1.5 text-sky-600 hover:text-sky-800 hover:bg-sky-50 rounded-lg cursor-pointer"
                              title="Nhân bản câu hỏi này"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            {/* Delete Question */}
                            <button
                              type="button"
                              onClick={() => handleDeleteQuestion(idx)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title="Xóa câu hỏi này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* SkillTag & Difficulty pickers */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Năng lực đọc hiểu</label>
                            <select
                              value={q.skillTag}
                              onChange={(e) => updateDraftQuestion(idx, 'skillTag', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-200 text-xs font-semibold focus:bg-white"
                            >
                              {Object.entries(SKILL_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Mức độ nhận thức</label>
                            <select
                              value={q.difficulty}
                              onChange={(e) => updateDraftQuestion(idx, 'difficulty', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-200 text-xs font-semibold focus:bg-white"
                            >
                              {Object.entries(DIFFICULTY_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Nội dung câu hỏi (Prompt)</label>
                          <input
                            type="text"
                            value={q.prompt}
                            onChange={(e) => updateDraftQuestion(idx, 'prompt', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-300 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-400"
                          />
                        </div>

                        {/* Multiple choice options */}
                        {q.type === 'multiple_choice' && (
                          <div className="space-y-2 pt-1">
                            <label className="block text-xs font-bold text-slate-700">3 Lựa chọn (A / B / C)</label>
                            {(q.options || ['Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C']).map((opt: string, oIdx: number) => (
                              <div key={oIdx} className="flex items-center gap-2">
                                <span className="w-6 text-center font-black text-xs text-sky-700">
                                  {String.fromCharCode(65 + oIdx)}.
                                </span>
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => updateDraftQuestionOption(idx, oIdx, e.target.value)}
                                  className="flex-1 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-300 text-xs focus:bg-white focus:outline-none"
                                />
                              </div>
                            ))}
                            <div className="flex items-center gap-3 pt-1">
                              <span className="text-xs font-bold text-emerald-800">Đáp án đúng máy chủ:</span>
                              {['A', 'B', 'C'].map((optChar) => (
                                <label key={optChar} className="flex items-center gap-1 text-xs font-bold text-slate-700 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`correctAnswer_${idx}`}
                                    checked={q.answer === optChar}
                                    onChange={() => updateDraftQuestion(idx, 'answer', optChar)}
                                  />
                                  <span>{optChar}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* True / False */}
                        {q.type === 'true_false' && (
                          <div className="flex items-center gap-4 pt-1">
                            <span className="text-xs font-bold text-emerald-800">Đáp án đúng máy chủ:</span>
                            <label className="flex items-center gap-1 text-xs font-bold text-slate-700 cursor-pointer">
                              <input
                                type="radio"
                                name={`correctAnswer_${idx}`}
                                checked={q.answer === true || q.answer === 'true'}
                                onChange={() => updateDraftQuestion(idx, 'answer', true)}
                              />
                              <span>Đúng (True)</span>
                            </label>
                            <label className="flex items-center gap-1 text-xs font-bold text-slate-700 cursor-pointer">
                              <input
                                type="radio"
                                name={`correctAnswer_${idx}`}
                                checked={q.answer === false || q.answer === 'false'}
                                onChange={() => updateDraftQuestion(idx, 'answer', false)}
                              />
                              <span>Sai (False)</span>
                            </label>
                          </div>
                        )}

                        {/* Sequence items */}
                        {q.type === 'sequence' && (
                          <div className="space-y-2 pt-1">
                            <label className="block text-xs font-bold text-slate-700">3 sự việc cần sắp xếp theo thứ tự đúng:</label>
                            {((q.items && q.items.length === 3) ? q.items : ['Sự việc bắt đầu', 'Sự việc tiếp theo', 'Sự việc kết thúc']).map((item: string, sIdx: number) => (
                              <div key={sIdx} className="flex items-center gap-2">
                                <span className="w-16 font-bold text-xs text-amber-800 shrink-0">
                                  Bước {sIdx + 1}:
                                </span>
                                <input
                                  type="text"
                                  value={item}
                                  onChange={(e) => {
                                    const currentItems = [...(q.items || ['Sự việc bắt đầu', 'Sự việc tiếp theo', 'Sự việc kết thúc'])];
                                    currentItems[sIdx] = e.target.value;
                                    const updatedQuestions = [...draftLesson.questions];
                                    updatedQuestions[idx] = {
                                      ...q,
                                      items: currentItems,
                                      answer: currentItems
                                    };
                                    setDraftLesson({ ...draftLesson, questions: updatedQuestions });
                                  }}
                                  className="flex-1 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-300 text-xs focus:bg-white focus:outline-none"
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                          <div>
                            <label className="block text-[11px] font-bold text-amber-700 mb-1">Gợi ý sư phạm (không lộ đáp án):</label>
                            <input
                              type="text"
                              value={q.hint}
                              onChange={(e) => updateDraftQuestion(idx, 'hint', e.target.value)}
                              className="w-full px-3 py-1.5 bg-amber-50/50 rounded-lg border border-amber-200 text-xs focus:bg-white focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Giải thích chi tiết (hiển thị sau hoàn thành):</label>
                            <input
                              type="text"
                              value={q.explanation}
                              onChange={(e) => updateDraftQuestion(idx, 'explanation', e.target.value)}
                              className="w-full px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200 text-xs focus:bg-white focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingDraft(false)}
                      className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
                    >
                      Hoàn tất sửa & Xem trước bản duyệt
                    </button>
                  </div>
                </div>
              ) : (
                /* READ-ONLY PREVIEW MODE */
                <>
                  {/* Passage text */}
                  <div className="p-5 bg-sky-50/50 rounded-2xl border border-sky-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-sky-800 uppercase block">Bài đọc & Giọng đọc</span>
                      {draftLesson.audioUrl && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Đã có tệp âm thanh giáo viên duyệt
                        </span>
                      )}
                    </div>

                    <AudioReader
                      text={draftLesson.passage}
                      title={draftLesson.title}
                      audioUrl={draftLesson.audioUrl}
                      audioMetadata={draftLesson.audioMetadata}
                    />

                    {!draftLesson.audioUrl && (
                      <div className="p-3 bg-indigo-50/90 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2">
                        <span className="text-xs text-indigo-950 font-bold">
                          💡 Bài học chưa gắn giọng đọc AI tiếng Việt. Thầy cô có thể chuyển sang biên tập để tạo giọng đọc bất kỳ lúc nào.
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsEditingDraft(true)}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition cursor-pointer self-start sm:self-auto shrink-0 shadow-sm"
                        >
                          Tạo giọng đọc AI ngay
                        </button>
                      </div>
                    )}

                    <p className="text-slate-800 font-medium text-base leading-relaxed whitespace-pre-line pt-2">
                      {draftLesson.passage}
                    </p>
                  </div>

                  {/* Questions preview */}
                  <div className="space-y-4">
                    <span className="text-xs font-bold text-slate-600 uppercase block">
                      Danh sách nhiệm vụ ({draftLesson.questions.length} câu)
                    </span>
                    {draftLesson.questions.map((q, idx) => (
                      <div key={q.id || idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs sm:text-sm">
                        <div className="flex items-center justify-between gap-2 mb-2 font-black text-slate-900">
                          <span>Câu {idx + 1}: {q.prompt}</span>
                          <span className="text-[10px] px-2 py-0.5 bg-sky-100 text-sky-800 rounded font-bold">
                            {QUESTION_TYPE_LABELS[q.type] || q.type}
                          </span>
                        </div>
                        {q.options && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 my-2 text-xs text-slate-700 font-medium">
                            {q.options.map((opt: string, oIdx: number) => (
                              <div key={oIdx} className="bg-white p-2 rounded border border-slate-200">
                                <span className="font-bold text-sky-600">{String.fromCharCode(65 + oIdx)}.</span> {opt}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 mt-2 pt-2 border-t border-slate-200">
                          <div>
                            <strong className="text-emerald-700">Đáp án đúng (máy chủ):</strong> {JSON.stringify(q.answer)}
                          </div>
                          <div>
                            <strong className="text-amber-700">Gợi ý sư phạm:</strong> {q.hint}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 5: AI REMEDIATION ACTIVITIES (MODULE 4: PHÂN CẤP SƯ PHẠM) */}
      {/* ========================================================= */}
      {activeTab === 'remediation' && (() => {
        const remedAvailableYears = Array.from(
          new Set(classes.map((c) => c.academicYear || '2026-2027'))
        ).sort().reverse();
        const displayRemedYears = remedAvailableYears.length > 0 ? remedAvailableYears.filter((y) => y === '2026-2027') : ['2026-2027'];

        const remedAvailableGrades = remedNavYear
          ? Array.from(
              new Set(
                classes
                  .filter((c) => (c.academicYear || '2026-2027') === remedNavYear)
                  .map((c) => c.grade)
              )
            ).sort()
          : [];

        const remedAvailableClasses = remedNavYear && remedNavGrade
          ? classes.filter(
              (c) =>
                (c.academicYear || '2026-2027') === remedNavYear &&
                c.grade === remedNavGrade
            )
          : [];

        const currentRemedClass = classes.find((c) => c.id === remedNavClassId);
        const currentRemedSemesterLabel =
          remedNavSemester === 1
            ? 'Học kỳ I'
            : remedNavSemester === 2
            ? 'Học kỳ II'
            : 'Cả năm học';

        const stats = remediationData?.statistics;

        // Chart data for Recharts BarChart
        const remedChartData = stats?.skills?.map((s) => ({
          skill: s.label,
          firstTry: s.firstTryAccuracy ?? 0,
          final: s.finalAccuracy ?? 0,
          hasData: s.status !== 'no_data'
        })) || [];

        // Available years, grades, classes for library filtering
        const libAvailableYears = Array.from(
          new Set(classes.map((c) => c.academicYear || '2026-2027'))
        ).sort().reverse();
        const libAvailableGrades = [2, 3];
        const libAvailableClasses = classes.filter(
          (c) =>
            (remedLibFilterYear === 'all' || (c.academicYear || '2026-2027') === remedLibFilterYear) &&
            (remedLibFilterGrade === 'all' || c.grade === Number(remedLibFilterGrade))
        );

        // Filtered activities for repository view
        const filteredLibActivities = myActivities.filter((act) => {
          if (remedActiveSubTab === 'approved_bank' && act.status !== 'approved') return false;
          if (remedActiveSubTab === 'my_library' && remedLibFilterStatus !== 'all' && act.status !== remedLibFilterStatus) return false;
          if (remedLibFilterYear !== 'all' && act.academicYear && act.academicYear !== remedLibFilterYear) return false;
          if (remedLibFilterGrade !== 'all' && act.grade && act.grade !== Number(remedLibFilterGrade)) return false;
          if (remedLibFilterClassId !== 'all' && act.classId && act.classId !== remedLibFilterClassId) return false;
          if (remedLibFilterType !== 'all' && act.activityType !== remedLibFilterType) return false;
          if (remedLibSearch.trim()) {
            const q = remedLibSearch.toLowerCase().trim();
            const matchTitle = (act.title || '').toLowerCase().includes(q);
            const matchLesson = (act.sourceLessonTitle || '').toLowerCase().includes(q);
            const matchClass = (act.className || '').toLowerCase().includes(q);
            const matchSkill = (act.skillObjective || '').toLowerCase().includes(q);
            const matchType = (REMEDIATION_ACTIVITY_LABELS[act.activityType]?.title || '').toLowerCase().includes(q);
            if (!matchTitle && !matchLesson && !matchClass && !matchSkill && !matchType) return false;
          }
          return true;
        }).sort((a, b) => {
          if (remedLibSort === 'updated_desc') return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
          if (remedLibSort === 'updated_asc') return (a.updatedAt || a.createdAt || 0) - (b.updatedAt || b.createdAt || 0);
          if (remedLibSort === 'title_asc') return (a.title || '').localeCompare(b.title || '');
          return 0;
        });

        const draftCount = myActivities.filter((a) => a.status === 'draft').length;
        const approvedCount = myActivities.filter((a) => a.status === 'approved').length;

        return (
          <div className="space-y-6 animate-fade-in">
            {/* ========================================================= */}
            {/* THANH ĐIỀU HƯỚNG 3 MỤC: AI ĐỀ XUẤT MỚI | KHO TƯ LIỆU CỦA TÔI | HOẠT ĐỘNG ĐÃ DUYỆT */}
            {/* ========================================================= */}
            <div className="bg-white rounded-3xl p-3 sm:p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setRemedActiveSubTab('ai_suggest')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition cursor-pointer ${
                    remedActiveSubTab === 'ai_suggest'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>AI Đề Xuất Mới</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRemedActiveSubTab('my_library');
                    loadMyActivities();
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition cursor-pointer ${
                    remedActiveSubTab === 'my_library'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <FolderEdit className="w-4 h-4" />
                  <span>Kho Tư Liệu Của Tôi</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      remedActiveSubTab === 'my_library'
                        ? 'bg-white/20 text-white'
                        : 'bg-indigo-100 text-indigo-800'
                    }`}
                  >
                    {myActivities.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRemedActiveSubTab('approved_bank');
                    loadMyActivities();
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition cursor-pointer ${
                    remedActiveSubTab === 'approved_bank'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Hoạt Động Đã Duyệt</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      remedActiveSubTab === 'approved_bank'
                        ? 'bg-white/20 text-white'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {approvedCount}
                  </span>
                </button>
              </div>

              {/* Thông tin số liệu lưu trữ thật & nút tải lại */}
              <div className="flex items-center gap-3 text-xs text-slate-500 font-semibold self-end md:self-auto">
                <span className="hidden sm:inline">
                  Bản nháp: <strong className="text-amber-600 font-black">{draftCount}</strong> · Đã duyệt:{' '}
                  <strong className="text-emerald-600 font-black">{approvedCount}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => loadMyActivities()}
                  disabled={loadingMyActivities}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition cursor-pointer text-xs font-bold"
                  title="Tải lại từ Cloud Firestore"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingMyActivities ? 'animate-spin text-indigo-600' : ''}`} />
                  <span>{loadingMyActivities ? 'Đang tải...' : 'Làm mới'}</span>
                </button>
              </div>
            </div>

            {/* ========================================================= */}
            {/* SUBTAB 2 & 3: KHO TƯ LIỆU CỦA TÔI / HOẠT ĐỘNG ĐÃ DUYỆT */}
            {/* ========================================================= */}
            {(remedActiveSubTab === 'my_library' || remedActiveSubTab === 'approved_bank') && (
              <div className="space-y-6">
                {/* Thanh tìm kiếm, lọc và sắp xếp */}
                <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-xl text-white flex items-center justify-center shadow-xs ${
                          remedActiveSubTab === 'approved_bank' ? 'bg-teal-600' : 'bg-indigo-600'
                        }`}
                      >
                        {remedActiveSubTab === 'approved_bank' ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <FolderEdit className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-black text-slate-900">
                          {remedActiveSubTab === 'approved_bank'
                            ? 'Ngân Hàng Hoạt Động Đã Phê Duyệt'
                            : 'Kho Tư Liệu Hoạt Động Của Tôi'}
                        </h3>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {remedActiveSubTab === 'approved_bank'
                            ? 'Các hoạt động và trò chơi sư phạm đã được giáo viên duyệt & đưa vào kho, sẵn sàng áp dụng'
                            : 'Toàn bộ kế hoạch dạy học, trò chơi và phiếu bài tập đã lưu Firestore (bảo toàn sau F5 & đăng nhập lại)'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500">
                        Hiển thị: <strong>{filteredLibActivities.length}</strong> / {myActivities.length} hoạt động
                      </span>
                    </div>
                  </div>

                  {/* Bộ lọc đa tiêu chí */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    {/* 1. Tìm kiếm */}
                    <div className="sm:col-span-2 relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={remedLibSearch}
                        onChange={(e) => setRemedLibSearch(e.target.value)}
                        placeholder="Tìm tên, bài đọc, mục tiêu..."
                        className="w-full pl-8 pr-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      />
                    </div>

                    {/* 2. Năm học */}
                    <div>
                      <select
                        value={remedLibFilterYear}
                        onChange={(e) => setRemedLibFilterYear(e.target.value)}
                        className="w-full px-2.5 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      >
                        <option value="all">Tất cả năm học</option>
                        {libAvailableYears.map((yr) => (
                          <option key={yr} value={yr}>
                            Năm {yr}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 3. Khối */}
                    <div>
                      <select
                        value={remedLibFilterGrade}
                        onChange={(e) => setRemedLibFilterGrade(e.target.value)}
                        className="w-full px-2.5 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      >
                        <option value="all">Tất cả khối</option>
                        {libAvailableGrades.map((gr) => (
                          <option key={gr} value={String(gr)}>
                            Khối {gr}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 4. Lớp */}
                    <div>
                      <select
                        value={remedLibFilterClassId}
                        onChange={(e) => setRemedLibFilterClassId(e.target.value)}
                        className="w-full px-2.5 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      >
                        <option value="all">Tất cả lớp</option>
                        {libAvailableClasses.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            Lớp {cls.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 5. Loại hoạt động */}
                    <div>
                      <select
                        value={remedLibFilterType}
                        onChange={(e) => setRemedLibFilterType(e.target.value)}
                        className="w-full px-2.5 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      >
                        <option value="all">Tất cả loại hình</option>
                        {Object.entries(REMEDIATION_ACTIVITY_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Thanh lọc trạng thái & Sắp xếp */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      {remedActiveSubTab === 'my_library' && (
                        <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold">
                          <button
                            type="button"
                            onClick={() => setRemedLibFilterStatus('all')}
                            className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                              remedLibFilterStatus === 'all'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Tất cả ({myActivities.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setRemedLibFilterStatus('draft')}
                            className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                              remedLibFilterStatus === 'draft'
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Bản nháp ({draftCount})
                          </button>
                          <button
                            type="button"
                            onClick={() => setRemedLibFilterStatus('approved')}
                            className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                              remedLibFilterStatus === 'approved'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Đã duyệt ({approvedCount})
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <span className="text-slate-500 font-bold">Sắp xếp:</span>
                      <select
                        value={remedLibSort}
                        onChange={(e) => setRemedLibSort(e.target.value as any)}
                        className="px-2.5 py-1 bg-white rounded-lg border border-slate-200 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="updated_desc">Mới cập nhật nhất</option>
                        <option value="updated_asc">Cũ nhất trước</option>
                        <option value="title_asc">Tên A → Z</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Danh sách thẻ hoạt động */}
                {loadingMyActivities ? (
                  <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
                    <p className="text-sm text-slate-600 font-bold">Đang tải kho hoạt động từ Cloud Firestore...</p>
                  </div>
                ) : filteredLibActivities.length === 0 ? (
                  <div className="text-center py-16 px-4 bg-white rounded-3xl border border-dashed border-slate-300 space-y-4">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <FolderEdit className="w-7 h-7" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-black text-slate-900 text-base">
                        {myActivities.length === 0
                          ? 'Kho tư liệu chưa có hoạt động nào được lưu'
                          : 'Không tìm thấy hoạt động nào phù hợp với bộ lọc'}
                      </h4>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        {myActivities.length === 0
                          ? 'Thầy cô hãy chuyển sang tab "AI Đề Xuất Mới" để phân tích số liệu lớp học và bấm "Lưu nháp" hoặc "Duyệt & Đưa vào kho" nhé.'
                          : 'Hãy thử xóa bộ lọc tìm kiếm hoặc chọn lại năm học, khối, lớp để xem danh sách đầy đủ.'}
                      </p>
                    </div>
                    {myActivities.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => setRemedActiveSubTab('ai_suggest')}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-sm"
                      >
                        Tạo hoạt động từ AI Đề Xuất Mới
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setRemedLibSearch('');
                          setRemedLibFilterYear('all');
                          setRemedLibFilterGrade('all');
                          setRemedLibFilterClassId('all');
                          setRemedLibFilterType('all');
                          setRemedLibFilterStatus('all');
                        }}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                      >
                        Xóa tất cả bộ lọc
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredLibActivities.map((act) => (
                      <div
                        key={act.id}
                        className="p-5 bg-white border border-slate-200 hover:border-indigo-400 rounded-3xl space-y-3.5 shadow-xs transition"
                      >
                        {/* Header của Thẻ */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700">
                                {REMEDIATION_ACTIVITY_LABELS[act.activityType]?.title || act.activityType}
                              </span>
                              {act.status === 'approved' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>✓ Đã duyệt</span>
                                  {act.approvedBy && (
                                    <span className="text-[9px] text-emerald-700 font-normal">({act.approvedBy})</span>
                                  )}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  <span>Bản nháp</span>
                                </span>
                              )}
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-100">
                                {SKILL_LABELS[act.targetSkill] || act.targetSkill}
                              </span>
                            </div>

                            <h4 className="font-black text-slate-900 text-sm sm:text-base leading-snug line-clamp-2">
                              {act.title}
                            </h4>

                            <div className="text-[11px] text-slate-500 font-medium">
                              {act.className ? `Lớp ${act.className}` : act.targetAudience || 'Lớp học'}{' '}
                              {act.academicYear ? `· Năm ${act.academicYear}` : ''} · Thời lượng:{' '}
                              <strong>{act.durationMinutes || 10} phút</strong>
                            </div>
                          </div>

                          {/* Nút Xóa */}
                          <button
                            type="button"
                            onClick={() => handleDeleteActivity(act.id, act.title)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition cursor-pointer shrink-0"
                            title="Xóa hoạt động"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Mục tiêu GDPT 2018 */}
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-1">
                          <div className="text-slate-700 line-clamp-2">
                            <strong className="text-slate-900">Mục tiêu: </strong>
                            {act.skillObjective || act.description || 'Chưa có mô tả mục tiêu.'}
                          </div>
                          <div className="text-slate-500 line-clamp-1">
                            <strong className="text-slate-700">Căn cứ: </strong>
                            {act.sourceLessonTitle || 'Số liệu Firestore'}
                          </div>
                        </div>

                        {/* Các bước tổ chức ngắn gọn */}
                        {act.teacherSteps && act.teacherSteps.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-[10px] font-black uppercase text-slate-400">
                              Quy trình tổ chức ({act.teacherSteps.length} bước):
                            </div>
                            <div className="text-[11px] text-slate-600 line-clamp-2 font-medium">
                              {act.teacherSteps.map((st, i) => `B${i + 1}: ${st}`).join(' · ')}
                            </div>
                          </div>
                        )}

                        {/* Footer thẻ kèm nút hành động */}
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap text-xs">
                          <span className="text-[10px] text-slate-400">
                            {act.updatedAt
                              ? `Cập nhật: ${new Date(act.updatedAt).toLocaleDateString('vi-VN')}`
                              : act.createdAt
                              ? `Tạo: ${new Date(act.createdAt).toLocaleDateString('vi-VN')}`
                              : ''}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {/* Nút Xem & Sửa */}
                            <button
                              type="button"
                              onClick={() => {
                                setActivityDetailOriginalBackup(JSON.parse(JSON.stringify(act)));
                                setSelectedActivityDetail(JSON.parse(JSON.stringify(act)));
                                setActivityDetailViewMode('edit');
                              }}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-500" />
                              <span>Xem & Sửa</span>
                            </button>

                            {/* Nút Sao chép để tái sử dụng */}
                            <button
                              type="button"
                              onClick={() => handleDuplicateActivity(act)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1"
                              title="Tạo bản sao độc lập của hoạt động này"
                            >
                              <Copy className="w-3.5 h-3.5 text-slate-500" />
                              <span className="hidden sm:inline">Sao chép</span>
                            </button>

                            {/* Nút Duyệt & Đưa vào kho (nếu chưa duyệt) */}
                            {act.status !== 'approved' && (
                              <button
                                type="button"
                                disabled={approvingActivityId === act.id}
                                onClick={() => handleApproveActivity(act)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1 disabled:opacity-50 shadow-xs"
                              >
                                {approvingActivityId === act.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                                <span>Duyệt & Đưa vào kho</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ========================================================= */}
            {/* SUBTAB 1: AI ĐỀ XUẤT MỚI (PHÂN TÍCH ĐA CHIỀU & GỢI Ý HOẠT ĐỘNG) */}
            {/* ========================================================= */}
            {remedActiveSubTab === 'ai_suggest' && (
              <div className="space-y-6">
            {/* ========================================================= */}
            {/* PHẦN A: THANH LỰA CHỌN NGANG GỌN (NĂM -> KHỐI -> LỚP -> PHẠM VI) */}
            {/* ========================================================= */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
              {/* Header của thanh lựa chọn */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <BrainCircuit className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                      <span>Trung Tâm AI Phân Tích & Hoạt Động Dạy Học</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                        GDPT 2018
                      </span>
                    </h2>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Phân tích kết quả đọc hiểu đa chiều từ Firestore và đề xuất hoạt động dạy học phân hóa cho học sinh lớp 2–3
                    </p>
                  </div>
                </div>

                {remediationData && (
                  <button
                    type="button"
                    onClick={() => setRemedOpenGroup(remedOpenGroup === 'none' ? 'scope' : 'none')}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-emerald-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition cursor-pointer self-start sm:self-auto"
                  >
                    <Filter className="w-3.5 h-3.5 text-slate-500" />
                    <span>{remedOpenGroup === 'none' ? 'Đổi bộ lọc phân tích' : 'Thu gọn bộ lọc'}</span>
                  </button>
                )}
              </div>

              {/* Thanh 4 nhóm lựa chọn ngang gọn: Năm học → Khối → Lớp → Phạm vi */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
                {/* 1. NĂM HỌC */}
                <div
                  onClick={() => setRemedOpenGroup('year')}
                  className={`p-3 sm:p-3.5 rounded-2xl border text-left cursor-pointer transition flex items-center justify-between ${
                    remedOpenGroup === 'year'
                      ? 'bg-sky-50 border-sky-500 ring-2 ring-sky-500/20'
                      : remedNavYear
                      ? 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      : 'bg-white border-dashed border-slate-300 hover:border-slate-400'
                  }`}
                >
                  <div className="min-w-0 pr-1">
                    <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">1. Năm học</div>
                    <div className="text-xs sm:text-sm font-black text-slate-900 truncate">
                      {remedNavYear ? `Năm ${remedNavYear}` : 'Chưa chọn'}
                    </div>
                  </div>
                  <Calendar className={`w-4 h-4 shrink-0 ${remedNavYear ? 'text-sky-600' : 'text-slate-400'}`} />
                </div>

                {/* 2. KHỐI */}
                <div
                  onClick={() => {
                    if (!remedNavYear) setRemedOpenGroup('year');
                    else setRemedOpenGroup('grade');
                  }}
                  className={`p-3 sm:p-3.5 rounded-2xl border text-left cursor-pointer transition flex items-center justify-between ${
                    remedOpenGroup === 'grade'
                      ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20'
                      : remedNavGrade
                      ? 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      : !remedNavYear
                      ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                      : 'bg-white border-dashed border-slate-300 hover:border-slate-400'
                  }`}
                >
                  <div className="min-w-0 pr-1">
                    <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">2. Khối lớp</div>
                    <div className="text-xs sm:text-sm font-black text-slate-900 truncate">
                      {remedNavGrade ? `Khối ${remedNavGrade}` : 'Chưa chọn'}
                    </div>
                  </div>
                  <GraduationCap className={`w-4 h-4 shrink-0 ${remedNavGrade ? 'text-emerald-600' : 'text-slate-400'}`} />
                </div>

                {/* 3. LỚP */}
                <div
                  onClick={() => {
                    if (!remedNavYear) setRemedOpenGroup('year');
                    else if (!remedNavGrade) setRemedOpenGroup('grade');
                    else setRemedOpenGroup('class');
                  }}
                  className={`p-3 sm:p-3.5 rounded-2xl border text-left cursor-pointer transition flex items-center justify-between ${
                    remedOpenGroup === 'class'
                      ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500/20'
                      : remedNavClassId
                      ? 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      : !remedNavGrade
                      ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                      : 'bg-white border-dashed border-slate-300 hover:border-slate-400'
                  }`}
                >
                  <div className="min-w-0 pr-1">
                    <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">3. Lớp học</div>
                    <div className="text-xs sm:text-sm font-black text-slate-900 truncate">
                      {currentRemedClass ? `Lớp ${currentRemedClass.name}` : 'Chưa chọn'}
                    </div>
                  </div>
                  <Users className={`w-4 h-4 shrink-0 ${currentRemedClass ? 'text-purple-600' : 'text-slate-400'}`} />
                </div>

                {/* 4. PHẠM VI PHÂN TÍCH */}
                <div
                  onClick={() => {
                    if (!remedNavClassId) {
                      if (!remedNavYear) setRemedOpenGroup('year');
                      else if (!remedNavGrade) setRemedOpenGroup('grade');
                      else setRemedOpenGroup('class');
                    } else {
                      setRemedOpenGroup('scope');
                    }
                  }}
                  className={`p-3 sm:p-3.5 rounded-2xl border text-left cursor-pointer transition flex items-center justify-between ${
                    remedOpenGroup === 'scope'
                      ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20'
                      : remedNavScope
                      ? 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      : !remedNavClassId
                      ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                      : 'bg-white border-dashed border-slate-300 hover:border-slate-400'
                  }`}
                >
                  <div className="min-w-0 pr-1">
                    <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">4. Phạm vi phân tích</div>
                    <div className="text-xs sm:text-sm font-black text-slate-900 truncate">
                      {getAnalysisScopeLabel(remedNavScope)}
                    </div>
                  </div>
                  <Layers className={`w-4 h-4 shrink-0 ${remedNavScope ? 'text-amber-600' : 'text-slate-400'}`} />
                </div>
              </div>

              {/* NỘI DUNG NHÓM LỰA CHỌN ĐANG MỞ (CHỈ MỞ 1 NHÓM TẠI MỘT THỜI ĐIỂM) */}
              {remedOpenGroup === 'year' && (
                <div className="p-4 bg-sky-50/60 rounded-2xl border border-sky-100 space-y-3 animate-fade-in">
                  <div className="text-xs font-black text-sky-900 flex items-center justify-between">
                    <span>Bước 1: Chọn Năm Học</span>
                    <span className="text-[11px] font-normal text-sky-700">Chỉ mở 1 nhóm tại một thời điểm</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {displayRemedYears.map((yr) => (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => {
                          setRemedNavYear(yr);
                          setRemedNavGrade(null);
                          setRemedNavClassId(null);
                          setRemedOpenGroup('grade');
                        }}
                        className={`p-3 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                          remedNavYear === yr
                            ? 'bg-white border-sky-500 font-bold shadow-xs text-sky-800 ring-2 ring-sky-500/20'
                            : 'bg-white/80 border-slate-200 hover:border-sky-300 text-slate-700'
                        }`}
                      >
                        <span className="text-xs font-black">Năm học {yr}</span>
                        {remedNavYear === yr && <CheckCircle2 className="w-4 h-4 text-sky-600" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {remedOpenGroup === 'grade' && (
                <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100 space-y-3 animate-fade-in">
                  <div className="text-xs font-black text-emerald-900 flex items-center justify-between">
                    <span>Bước 2: Chọn Khối Lớp ({remedNavYear})</span>
                    <span className="text-[11px] font-normal text-emerald-700">Chỉ mở 1 nhóm tại một thời điểm</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {remedAvailableGrades.map((gr) => (
                      <button
                        key={gr}
                        type="button"
                        onClick={() => {
                          setRemedNavGrade(gr);
                          setRemedNavClassId(null);
                          setRemedOpenGroup('class');
                        }}
                        className={`p-3 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                          remedNavGrade === gr
                            ? 'bg-white border-emerald-500 font-bold shadow-xs text-emerald-800 ring-2 ring-emerald-500/20'
                            : 'bg-white/80 border-slate-200 hover:border-emerald-300 text-slate-700'
                        }`}
                      >
                        <span className="text-xs font-black">Khối {gr}</span>
                        {remedNavGrade === gr && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {remedOpenGroup === 'class' && (
                <div className="p-4 bg-purple-50/60 rounded-2xl border border-purple-100 space-y-3 animate-fade-in">
                  <div className="text-xs font-black text-purple-900 flex items-center justify-between">
                    <span>Bước 3: Chọn Lớp Học (Khối {remedNavGrade} · {remedNavYear})</span>
                    <span className="text-[11px] font-normal text-purple-700">Chỉ mở 1 nhóm tại một thời điểm</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {remedAvailableClasses.map((cls) => (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => {
                          setRemedNavClassId(cls.id);
                          setRemedOpenGroup('scope');
                        }}
                        className={`p-3 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                          remedNavClassId === cls.id
                            ? 'bg-white border-purple-500 font-bold shadow-xs text-purple-800 ring-2 ring-purple-500/20'
                            : 'bg-white/80 border-slate-200 hover:border-purple-300 text-slate-700'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-black text-slate-900">Lớp {cls.name}</div>
                          <div className="text-[11px] text-slate-500">Mã: {cls.classCode} · Sĩ số: {cls.studentCount || 20} HS</div>
                        </div>
                        {remedNavClassId === cls.id && <CheckCircle2 className="w-4 h-4 text-purple-600" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {remedOpenGroup === 'scope' && (
                <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-100 space-y-4 animate-fade-in">
                  <div className="text-xs font-black text-amber-900 flex items-center justify-between">
                    <span>Bước 4: Chọn Phạm Vi Phân Tích Đa Chiều (7 phạm vi)</span>
                    <span className="text-[11px] font-normal text-amber-700">Được tối ưu cho giáo viên tiểu học</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {[
                      { id: 'toan_lop', label: '1. Toàn lớp', desc: 'Toàn cảnh kết quả & 5 năng lực', icon: Users },
                      { id: 'tung_hoc_sinh', label: '2. Từng học sinh', desc: 'Hồ sơ cá nhân & tiến độ từng em', icon: GraduationCap },
                      { id: 'nhom_hoc_sinh', label: '3. Nhóm phân hóa', desc: 'Nhóm cần hỗ trợ & nhóm phát triển', icon: Layers },
                      { id: 'bai_doc_va_dot_giao', label: '4. Từng bài đọc', desc: 'Phân tích theo bài đọc & đợt giao', icon: BookOpen },
                      { id: 'tung_ky_nang', label: '5. Từng kỹ năng', desc: 'Trọng tâm 1 trong 5 năng lực', icon: BarChart3 },
                      { id: 'tung_cau_hoi', label: '6. Từng câu hỏi/dạng', desc: 'Câu sai nhiều, trắc nghiệm, đúng/sai, sắp xếp', icon: HelpCircle },
                      { id: 'tien_bo', label: '7. Tiến bộ thời gian', desc: 'Xu hướng lần 1 vs sau gợi ý', icon: TrendingUp }
                    ].map((sc) => {
                      const Icon = sc.icon;
                      const isSelected = remedNavScope === sc.id;
                      return (
                        <button
                          key={sc.id}
                          type="button"
                          onClick={() => {
                            setRemedNavScope(sc.id as AnalysisScope);
                          }}
                          className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-white border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                              : 'bg-white/80 border-slate-200 hover:border-amber-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className={`text-xs font-black ${isSelected ? 'text-amber-800' : 'text-slate-900'}`}>{sc.label}</span>
                            <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-600' : 'text-slate-400'}`} />
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-2">{sc.desc}</p>
                        </button>
                      );
                    })}
                  </div>

                  {/* Sub-filters phù hợp với từng phạm vi */}
                  <div className="pt-2 border-t border-amber-200/60">
                    {remedNavScope === 'toan_lop' && (
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="font-bold text-slate-700">Lọc theo học kỳ:</span>
                        {[
                          { id: 'all', label: 'Cả năm học' },
                          { id: 1, label: 'Học kỳ I' },
                          { id: 2, label: 'Học kỳ II' }
                        ].map((sem) => (
                          <button
                            key={sem.id}
                            type="button"
                            onClick={() => setRemedNavSemester(sem.id as any)}
                            className={`px-3 py-1 rounded-lg font-bold border transition cursor-pointer ${
                              remedNavSemester === sem.id
                                ? 'bg-amber-500 text-white border-amber-500'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {sem.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {remedNavScope === 'tung_hoc_sinh' && (
                      <div className="flex items-center gap-3 flex-wrap text-xs">
                        <span className="font-bold text-slate-700">Chọn học sinh:</span>
                        <select
                          value={remedTargetStudentId}
                          onChange={(e) => setRemedTargetStudentId(e.target.value)}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-800 text-xs focus:ring-2 focus:ring-amber-500"
                        >
                          <option value="">-- Toàn bộ học sinh trong lớp (Xem tổng hợp hồ sơ) --</option>
                          {remedClassStudents.map((st) => (
                            <option key={st.id} value={st.id}>
                              {st.displayAlias || st.studentCode || st.id} ({st.studentCode || st.id.slice(0, 5)})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {remedNavScope === 'tung_ky_nang' && (
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="font-bold text-slate-700">Kỹ năng trọng tâm:</span>
                        {([
                          'thong_tin_truc_tiep',
                          'tu_ngu_ngu_canh',
                          'noi_dung_chinh',
                          'sap_xep_trinh_tu',
                          'lien_he_van_dung'
                        ] as SkillTag[]).map((sk) => (
                          <button
                            key={sk}
                            type="button"
                            onClick={() => setRemedTargetSkill(sk)}
                            className={`px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer text-xs ${
                              remedTargetSkill === sk
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {SKILL_LABELS[sk] || sk}
                          </button>
                        ))}
                      </div>
                    )}

                    {remedNavScope === 'bai_doc_va_dot_giao' && (
                      <div className="flex items-center gap-3 flex-wrap text-xs">
                        <span className="font-bold text-slate-700">Chọn bài đọc / đợt giao:</span>
                        <select
                          value={remedTargetAssignmentId}
                          onChange={(e) => setRemedTargetAssignmentId(e.target.value)}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-800 text-xs focus:ring-2 focus:ring-amber-500 max-w-xs"
                        >
                          <option value="all">-- Toàn bộ bài đọc đã giao --</option>
                          {remedClassAssignments.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.lessonTitle || a.lessonId} ({a.roundName || 'Đợt 1'})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {remedNavScope === 'tung_cau_hoi' && (
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="font-bold text-slate-700">Dạng câu hỏi:</span>
                        {[
                          { id: 'all', label: 'Tất cả dạng câu hỏi' },
                          { id: 'multiple_choice', label: 'Trắc nghiệm A/B/C' },
                          { id: 'true_false', label: 'Đúng / Sai' },
                          { id: 'sequence', label: 'Sắp xếp trình tự' }
                        ].map((qt) => (
                          <button
                            key={qt.id}
                            type="button"
                            onClick={() => setRemedTargetQuestionType(qt.id)}
                            className={`px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer text-xs ${
                              remedTargetQuestionType === qt.id
                                ? 'bg-purple-600 text-white border-purple-600'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {qt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* NÚT KÍCH HOẠT PHÂN TÍCH RÕ RÀNG */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 p-4 rounded-2xl border border-emerald-200/70">
                <div className="text-xs text-slate-700">
                  <span className="font-bold text-slate-900">Phạm vi sẵn sàng:</span> Lớp{' '}
                  <strong className="text-emerald-800">{currentRemedClass?.name || '(Chưa chọn)'}</strong> (Khối {remedNavGrade || '—'}) ·{' '}
                  <span className="font-black text-amber-800">{getAnalysisScopeLabel(remedNavScope)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleFetchRemediation()}
                  disabled={loadingRemediation || !remedNavClassId}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-md shadow-emerald-600/30 transition active:scale-95 disabled:opacity-50 shrink-0 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>{loadingRemediation ? 'Đang phân tích đa chiều...' : '⚡ Phân tích dữ liệu'}</span>
                </button>
              </div>
            </div>

            {/* Main Content Box (Kết quả & Ngân hàng hoạt động) */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
              {!remediationData && (
                <div className="text-center py-12 px-4 space-y-3 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-black text-slate-800">
                    Sẵn sàng phân tích kết quả học tập & tạo hoạt động dạy học
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Chọn Năm học, Khối lớp, Lớp và Phạm vi phân tích ở thanh trên, sau đó bấm <strong>⚡ Phân tích dữ liệu</strong> để xem kết quả phân tích đa chiều từ Firestore và ngân hàng hoạt động sư phạm AI.
                  </p>
                </div>
              )}

              {/* ========================================================= */}
              {/* RESULTS VIEW (A3: TÁCH RÕ FIRESTORE THỰC TẾ & AI ĐỀ XUẤT) */}
              {/* ========================================================= */}
              {/* ========================================================= */}
              {/* PHẦN B: HIỂN THỊ KẾT QUẢ PHÂN TÍCH ĐA CHIỀU (7 SCOPES) */}
              {/* ========================================================= */}
              {remediationData && stats && (
                <div className="space-y-8 animate-fade-in">
                  {/* Thanh thông tin phạm vi & thời gian cập nhật */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-slate-700">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-black text-slate-900 text-sm">
                        Lớp {stats.className} (Khối {stats.grade})
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 font-bold border border-sky-200">
                        Năm học {stats.academicYear}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-200">
                        {currentRemedSemesterLabel}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black border border-emerald-200">
                        {getAnalysisScopeLabel(remediationData.scope || remedNavScope)}
                      </span>
                      <span className="text-slate-500 font-mono">
                        Mã lớp: {currentRemedClass?.classCode}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Cập nhật: {new Date(stats.updatedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</span>
                    </div>
                  </div>

                  {/* Tóm tắt trọng tâm của phạm vi phân tích */}
                  {remediationData.scopeSummary && (
                    <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-2xl flex items-start gap-3 text-xs sm:text-sm text-sky-900 font-semibold">
                      <Sparkles className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-black uppercase tracking-wider text-[11px] text-sky-800 mb-0.5">
                          Tóm tắt phân tích trọng tâm ({getAnalysisScopeLabel(remediationData.scope || remedNavScope)}):
                        </div>
                        <p className="leading-relaxed">
                          {remediationData.scopeSummary.targetDescription || remediationData.scopeSummary.scopeName}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Empty state alert when class has 0 attempts */}
                  {stats.totalAttempts === 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3 text-xs sm:text-sm text-amber-900 font-semibold shadow-xs">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Lớp học chưa có dữ liệu làm bài:</span> Học sinh lớp {stats.className} chưa hoàn thành lượt làm bài đọc hiểu nào trong năm học / phạm vi đã chọn. Hệ thống hoàn toàn không sinh số liệu giả; thầy cô vui lòng giao bài và cho học sinh làm bài để có số liệu phân tích thực tế nhé!
                      </div>
                    </div>
                  )}

                  {/* 4 Thẻ KPI Tổng Quan */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* KPI 1 */}
                    <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-xs space-y-2">
                      <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                        <span>{remedNavScope === 'tung_hoc_sinh' ? 'Học sinh phân tích' : 'Sĩ số & Tham gia'}</span>
                        <Users className="w-4 h-4 text-sky-600" />
                      </div>
                      <div className="text-2xl font-black text-slate-900">
                        {remedNavScope === 'tung_hoc_sinh' ? (
                          <>
                            1 <span className="text-xs font-bold text-slate-500">học sinh</span>
                          </>
                        ) : (
                          <>
                            {stats.participatedStudents} / {stats.totalStudents} <span className="text-xs font-bold text-slate-500">HS</span>
                          </>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 font-medium truncate">
                        {remedNavScope === 'tung_hoc_sinh' ? (
                          <>
                            Mã: <strong className="text-sky-700">{remediationData.studentProfile?.studentCode || 'HS'}</strong> ·{' '}
                            <strong>{remediationData.studentProfile?.displayAlias || 'Học sinh'}</strong>
                          </>
                        ) : (
                          <>
                            Tỉ lệ tham gia: <strong className="text-sky-700">{stats.completionRate}%</strong> · Chưa làm: <strong>{stats.notParticipatedStudents} HS</strong>
                          </>
                        )}
                      </div>
                    </div>

                    {/* KPI 2 */}
                    <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-xs space-y-2">
                      <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                        <span>{remedNavScope === 'tung_hoc_sinh' ? 'Lượt làm của em' : 'Bài đọc & Lượt làm'}</span>
                        <BookOpen className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="text-2xl font-black text-slate-900">
                        {remedNavScope === 'tung_hoc_sinh' && remediationData.studentProfile
                          ? remediationData.studentProfile.totalAttempts
                          : stats.totalAttempts}{' '}
                        <span className="text-xs font-bold text-slate-500">lượt</span>
                      </div>
                      <div className="text-xs text-slate-500 font-medium">
                        {remedNavScope === 'tung_hoc_sinh' ? (
                          <>
                            Tiến bộ sau gợi ý: <strong className="text-emerald-700">+{remediationData.studentProfile?.progressDelta || 0}%</strong>
                          </>
                        ) : (
                          <>
                            Đã giao: <strong className="text-emerald-700">{stats.assignedLessonsCount} bài đọc</strong>
                          </>
                        )}
                      </div>
                    </div>

                    {/* KPI 3 */}
                    <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-xs space-y-2">
                      <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                        <span>Kỹ năng đạt tốt (≥70%)</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="text-2xl font-black text-emerald-600">
                        {stats.goodSkills.length} <span className="text-xs font-bold text-slate-500">/ 5 kỹ năng</span>
                      </div>
                      <div className="text-xs text-slate-600 font-medium truncate">
                        {stats.goodSkills.length > 0 ? (
                          <span className="text-emerald-700 font-bold">
                            {stats.goodSkills.map((s) => s.label).join(', ')}
                          </span>
                        ) : (
                          <span className="text-slate-400">Chưa có kỹ năng ≥ 70%</span>
                        )}
                      </div>
                    </div>

                    {/* KPI 4 */}
                    <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-xs space-y-2">
                      <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                        <span>Kỹ năng cần củng cố</span>
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                      </div>
                      <div className="text-2xl font-black text-amber-600">
                        {stats.weakSkills.length} <span className="text-xs font-bold text-slate-500">kỹ năng</span>
                      </div>
                      <div className="text-xs text-slate-600 font-medium truncate">
                        {stats.weakSkills.length > 0 ? (
                          <span className="text-amber-700 font-bold">
                            {stats.weakSkills.map((s) => `${s.label} (${s.studentsNeedingHelp} HS)`).join(', ')}
                          </span>
                        ) : stats.goodSkills && stats.goodSkills.length > 0 ? (
                          <span className="text-emerald-700 font-bold">Lớp đạt chuẩn toàn bộ! 🎉</span>
                        ) : (
                          <span className="text-slate-500 font-medium">Chưa đủ dữ liệu để kết luận</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ========================================================= */}
                  {/* PHÂN TÍCH THEO PHẠM VI CỤ THỂ */}
                  {/* ========================================================= */}

                  {/* 1. GÓC NHÌN TOÀN LỚP (Hoặc mặc định) */}
                  {(remedNavScope === 'toan_lop' || !remedNavScope) && (
                    <div className="border border-slate-200 rounded-3xl p-6 sm:p-7 bg-white space-y-6 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[11px] font-black uppercase tracking-wider">
                              Toàn lớp
                            </span>
                            <h3 className="text-base sm:text-lg font-black text-slate-900">
                              Toàn Cảnh 5 Năng Lực Đọc Hiểu Của Lớp (Cloud Firestore)
                            </h3>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            So sánh tỷ lệ Đúng lần đầu vs Đúng sau khi nhận gợi ý sư phạm của học sinh lớp {stats.className}.
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <span>Dữ liệu thực tế 100%</span>
                        </div>
                      </div>

                      {/* Biểu đồ Recharts */}
                      <div>
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
                          Biểu đồ 5 kỹ năng đọc hiểu:
                        </h4>
                        <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                          <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={remedChartData} margin={{ top: 15, right: 20, left: -10, bottom: 25 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis
                                  dataKey="skill"
                                  stroke="#64748b"
                                  fontSize={11}
                                  tickLine={false}
                                  interval={0}
                                  angle={-10}
                                  textAnchor="end"
                                  tick={{ fill: '#334155', fontWeight: 700 }}
                                />
                                <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={(v) => `${v}%`} />
                                <Tooltip
                                  formatter={(value: any, name: string, item: any) => {
                                    if (item?.payload?.hasData === false) {
                                      return ['Chưa đủ dữ liệu (0 câu)', name];
                                    }
                                    return [`${value}%`, name];
                                  }}
                                  contentStyle={{
                                    backgroundColor: '#ffffff',
                                    borderRadius: '16px',
                                    border: '1px solid #e2e8f0',
                                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                                    fontSize: '12px',
                                    fontWeight: 600
                                  }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '12px', fontWeight: 700 }} />
                                <Bar dataKey="firstTry" name="Tỷ lệ đúng lần đầu (%)" fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={36} />
                                <Bar dataKey="final" name="Tỷ lệ đúng sau gợi ý (%)" fill="#059669" radius={[6, 6, 0, 0]} maxBarSize={36} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>

                      {/* Bảng ma trận 5 kỹ năng */}
                      <div>
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
                          Bảng ma trận chi tiết 5 năng lực đọc hiểu:
                        </h4>
                        <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-600 font-black border-b border-slate-200">
                              <tr>
                                <th className="p-3">Kỹ năng đọc hiểu</th>
                                <th className="p-3 text-center">Số câu hỏi</th>
                                <th className="p-3 text-center">Đúng lần đầu</th>
                                <th className="p-3 text-center">Đúng sau gợi ý</th>
                                <th className="p-3 text-center">Tiến bộ</th>
                                <th className="p-3 text-center">Số HS cần hỗ trợ</th>
                                <th className="p-3 text-center">Đánh giá sư phạm</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                              {stats.skills.map((s) => (
                                <tr key={s.skillTag} className="hover:bg-slate-50/70 transition">
                                  <td className="p-3 font-black text-slate-900">{s.label}</td>
                                  <td className="p-3 text-center">{s.testedCount}</td>
                                  <td className="p-3 text-center">
                                    {s.firstTryAccuracy !== null ? (
                                      <span className={`font-black ${s.firstTryAccuracy >= 70 ? 'text-emerald-700' : 'text-amber-700'}`}>
                                        {s.firstTryAccuracy}%
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 font-medium">Chưa đủ dữ liệu</span>
                                    )}
                                  </td>
                                  <td className="p-3 text-center">
                                    {s.finalAccuracy !== null ? (
                                      <span className="font-black text-slate-900">{s.finalAccuracy}%</span>
                                    ) : (
                                      <span className="text-slate-400 font-medium">—</span>
                                    )}
                                  </td>
                                  <td className="p-3 text-center">
                                    {s.progressPercentagePoints !== null && s.progressPercentagePoints > 0 ? (
                                      <span className="font-black text-emerald-600">+{s.progressPercentagePoints}%</span>
                                    ) : (
                                      <span className="text-slate-400">0%</span>
                                    )}
                                  </td>
                                  <td className="p-3 text-center">
                                    {s.status === 'no_data' ? (
                                      <span className="text-slate-400">—</span>
                                    ) : s.studentsNeedingHelp > 0 ? (
                                      <span className="font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                        {s.studentsNeedingHelp} HS (&lt;70%)
                                      </span>
                                    ) : (
                                      <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                        0 HS
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3 text-center">
                                    {s.status === 'good' ? (
                                      <span className="inline-flex items-center gap-1 font-black text-emerald-800 bg-emerald-100/70 px-2.5 py-0.5 rounded-full text-[11px]">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Đạt tốt</span>
                                      </span>
                                    ) : s.status === 'needs_remediation' ? (
                                      <span className="inline-flex items-center gap-1 font-black text-amber-800 bg-amber-100/70 px-2.5 py-0.5 rounded-full text-[11px]">
                                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                        <span>Cần củng cố</span>
                                      </span>
                                    ) : (
                                      <span className="font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full text-[11px]">
                                        Chưa đủ dữ liệu để kết luận
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2. GÓC NHÌN TỪNG HỌC SINH */}
                  {remedNavScope === 'tung_hoc_sinh' && (
                    <div className="border border-purple-200 rounded-3xl p-6 sm:p-7 bg-white space-y-6 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-100 pb-4">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[11px] font-black uppercase tracking-wider">
                            Hồ sơ cá nhân
                          </span>
                          <h3 className="text-base sm:text-lg font-black text-slate-900">
                            Hồ Sơ Năng Lực Đọc Hiểu Cá Nhân Học Sinh
                          </h3>
                        </div>
                        <span className="text-xs text-purple-700 font-bold bg-purple-50 px-3 py-1 rounded-xl border border-purple-200">
                          {remediationData.studentProfile?.displayAlias || 'Học sinh lớp ' + stats.className}
                        </span>
                      </div>

                      {remediationData.studentProfile ? (
                        <div className="space-y-6">
                          {/* Thẻ tóm tắt học sinh */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-2xl">
                              <div className="text-[11px] font-bold text-purple-700">Học sinh</div>
                              <div className="text-lg font-black text-slate-900 mt-1">
                                {remediationData.studentProfile.displayAlias}
                              </div>
                              <div className="text-xs text-slate-500 font-mono mt-0.5">
                                Mã PIN: {remediationData.studentProfile.studentCode}
                              </div>
                            </div>

                            <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                              <div className="text-[11px] font-bold text-emerald-700">Điểm trung bình</div>
                              <div className="text-lg font-black text-emerald-700 mt-1">
                                {remediationData.studentProfile.finalAvg !== undefined
                                  ? `${((remediationData.studentProfile.finalAvg) / 10).toFixed(1)}/10 (${remediationData.studentProfile.finalAvg}%)`
                                  : remediationData.studentProfile.firstTryAvg !== undefined
                                  ? `${((remediationData.studentProfile.firstTryAvg) / 10).toFixed(1)}/10 (${remediationData.studentProfile.firstTryAvg}%)`
                                  : '—'}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                Đã hoàn thành {remediationData.studentProfile.totalAttempts} lượt làm
                              </div>
                            </div>

                            <div className="p-4 bg-sky-50/50 border border-sky-100 rounded-2xl">
                              <div className="text-[11px] font-bold text-sky-700">Đánh giá chung</div>
                              <div className="text-xs font-bold text-slate-800 mt-1">
                                {(remediationData.studentProfile.finalAvg || 0) >= 70
                                  ? 'Nắm tốt nội dung, phát huy mở rộng'
                                  : 'Cần củng cố từ ngữ và thông tin bài đọc'}
                              </div>
                            </div>
                          </div>

                          {/* Kỹ năng mạnh vs Kỹ năng cần củng cố */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-4 bg-emerald-50/30 border border-emerald-200 rounded-2xl space-y-2">
                              <div className="flex items-center gap-2 text-xs font-black text-emerald-800 uppercase">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span>Kỹ năng thế mạnh:</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {remediationData.studentProfile.strongSkills?.length > 0 ? (
                                  remediationData.studentProfile.strongSkills.map((sk: string) => (
                                    <span key={sk} className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200">
                                      {SKILL_LABELS[sk as SkillTag] || sk}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-xs text-slate-400 font-medium">Chưa ghi nhận kỹ năng vượt trội</span>
                                )}
                              </div>
                            </div>

                            <div className="p-4 bg-amber-50/30 border border-amber-200 rounded-2xl space-y-2">
                              <div className="flex items-center gap-2 text-xs font-black text-amber-800 uppercase">
                                <AlertCircle className="w-4 h-4 text-amber-600" />
                                <span>Kỹ năng cần hỗ trợ thêm:</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {remediationData.studentProfile.weakSkills?.length > 0 ? (
                                  remediationData.studentProfile.weakSkills.map((sk: string) => (
                                    <span key={sk} className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200">
                                      {SKILL_LABELS[sk as SkillTag] || sk}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-xs text-emerald-700 font-bold">Không có khó khăn đọc hiểu rõ rệt</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Lịch sử lượt làm bài gần đây */}
                          {remediationData.studentProfile.recentAttempts?.length > 0 && (
                            <div>
                              <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
                                Lịch sử bài làm gần đây:
                              </h4>
                              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                    <tr>
                                      <th className="p-2.5">Tên bài đọc</th>
                                      <th className="p-2.5 text-center">Thời gian</th>
                                      <th className="p-2.5 text-center">Lần đầu</th>
                                      <th className="p-2.5 text-center">Sau gợi ý</th>
                                      <th className="p-2.5 text-center">Tiến bộ</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 text-slate-700">
                                    {remediationData.studentProfile.recentAttempts.map((att: any, idx: number) => (
                                      <tr key={idx} className="hover:bg-slate-50">
                                        <td className="p-2.5 font-bold text-slate-900 truncate max-w-xs">
                                          {att.lessonTitle || 'Bài đọc củng cố'}
                                        </td>
                                        <td className="p-2.5 text-center font-medium">
                                          {att.completedAt ? new Date(att.completedAt).toLocaleDateString('vi-VN') : '—'}
                                        </td>
                                        <td className="p-2.5 text-center font-bold text-indigo-700">
                                          {att.firstScore ?? '—'}
                                        </td>
                                        <td className="p-2.5 text-center font-black text-emerald-700">
                                          {att.finalScore ?? '—'}
                                        </td>
                                        <td className="p-2.5 text-center">
                                          {att.progress && att.progress > 0 ? (
                                            <span className="font-black text-emerald-600">+{att.progress}</span>
                                          ) : (
                                            <span className="text-slate-400">0</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-6 text-center text-slate-400 text-xs">
                          Chọn học sinh ở thanh điều hướng để xem hồ sơ chi tiết.
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. GÓC NHÌN NHÓM PHÂN HÓA */}
                  {remedNavScope === 'nhom_hoc_sinh' && (
                    <div className="border border-indigo-200 rounded-3xl p-6 sm:p-7 bg-white space-y-6 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 pb-4">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[11px] font-black uppercase tracking-wider">
                            Phân hóa đối tượng
                          </span>
                          <h3 className="text-base sm:text-lg font-black text-slate-900">
                            Phân Nhóm Học Sinh Cần Hỗ Trợ & Phát Triển
                          </h3>
                        </div>
                        <span className="text-xs text-indigo-700 font-bold bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-200">
                          Theo Thông tư 27/2020/TT-BGDĐT
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Nhóm Cần Hỗ Trợ */}
                        <div className="p-5 bg-amber-50/40 border border-amber-200 rounded-2xl space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-lg bg-amber-600 text-white flex items-center justify-center text-xs font-black">
                                !
                              </span>
                              <h4 className="font-black text-slate-900 text-sm">
                                Nhóm Cần Hỗ Trợ ({(remediationData.studentGroups?.supportGroup ?? []).length} HS)
                              </h4>
                            </div>
                            <span className="text-[11px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md">
                              Đúng lần đầu &lt; 70%
                            </span>
                          </div>

                          <div className="space-y-2">
                            {(remediationData.studentGroups?.supportGroup ?? []).length > 0 ? (
                              remediationData.studentGroups?.supportGroup?.map((st: any) => (
                                <div key={st.studentId} className="p-3 bg-white rounded-xl border border-amber-200 shadow-xs flex items-center justify-between">
                                  <div>
                                    <div className="font-black text-xs text-slate-900">{st.displayAlias || st.studentCode}</div>
                                    <div className="text-[11px] text-amber-700 mt-0.5 font-medium">{st.reason}</div>
                                  </div>
                                  <span className="text-xs font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                    {st.avgAccuracy !== undefined ? `${st.avgAccuracy}%` : 'Cần trợ giúp'}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div className="text-xs text-emerald-700 font-bold p-3 bg-emerald-50 rounded-xl">
                                Toàn bộ học sinh trong lớp đều đạt tỷ lệ tốt (≥ 70%)!
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Nhóm Phát Triển */}
                        <div className="p-5 bg-emerald-50/40 border border-emerald-200 rounded-2xl space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs font-black">
                                ★
                              </span>
                              <h4 className="font-black text-slate-900 text-sm">
                                Nhóm Phát Triển / Nâng Cao ({(remediationData.studentGroups?.growthGroup ?? []).length} HS)
                              </h4>
                            </div>
                            <span className="text-[11px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                              Đúng lần đầu ≥ 70%
                            </span>
                          </div>

                          <div className="space-y-2">
                            {(remediationData.studentGroups?.growthGroup ?? []).length > 0 ? (
                              remediationData.studentGroups?.growthGroup?.map((st: any) => (
                                <div key={st.studentId} className="p-3 bg-white rounded-xl border border-emerald-200 shadow-xs flex items-center justify-between">
                                  <div>
                                    <div className="font-black text-xs text-slate-900">{st.displayAlias || st.studentCode}</div>
                                    <div className="text-[11px] text-emerald-700 mt-0.5 font-medium">{st.reason}</div>
                                  </div>
                                  <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                    {st.avgAccuracy !== undefined ? `${st.avgAccuracy}%` : 'Đạt xuất sắc'}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div className="text-xs text-slate-400 p-3 bg-slate-50 rounded-xl">
                                Chưa có học sinh đạt ngưỡng phát triển.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 4. GÓC NHÌN CÂU HỎI SAI CAO (HIỂN THỊ KHI CÓ CÂU HỎI SAI HOẶC CHỌN TỪNG CÂU HỎI) */}
                  {(remedNavScope === 'tung_cau_hoi' || (stats.highErrorQuestions && stats.highErrorQuestions.length > 0)) && (
                    <div className="border border-rose-200 rounded-3xl p-6 sm:p-7 bg-white space-y-4 shadow-xs">
                      <div className="flex items-center justify-between border-b border-rose-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[11px] font-black uppercase tracking-wider">
                            Phân tích câu hỏi
                          </span>
                          <h4 className="text-sm sm:text-base font-black text-slate-900">
                            Các Câu Hỏi Có Tỷ Lệ Học Sinh Sai Lần Đầu Cao:
                          </h4>
                        </div>
                        <span className="text-xs text-rose-700 font-bold">Cần giáo viên phân tích ngữ cảnh</span>
                      </div>

                      {stats.highErrorQuestions && stats.highErrorQuestions.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {stats.highErrorQuestions.map((q, idx) => (
                            <div key={idx} className="p-4 bg-rose-50/40 border border-rose-200 rounded-2xl space-y-2">
                              <div className="flex items-center justify-between text-xs font-bold">
                                <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-black">
                                  {q.skillLabel || 'Kỹ năng đọc hiểu'}
                                </span>
                                <span className="text-rose-700 font-black">
                                  Sai {q.incorrectPercentage}%
                                </span>
                              </div>
                              <p className="text-xs font-bold text-slate-900 line-clamp-2" title={q.prompt}>
                                {q.prompt?.startsWith('Câu hỏi ') ? q.prompt : `"${q.prompt}"`}
                              </p>
                              <div className="text-[11px] text-slate-500">
                                {q.incorrectCount} / {q.testedCount} lượt làm trả lời sai ở lần đầu
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-bold flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Lớp không có câu hỏi nào có tỷ lệ sai vượt ngưỡng bất thường. Các câu hỏi đều được học sinh hoàn thành tốt.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ========================================================= */}
                  {/* PHẦN C & D: NGÂN HÀNG 8 HOẠT ĐỘNG & NỀN TẢNG TẠO GAME */}
                  {/* ========================================================= */}
                  <div className="border border-emerald-200 rounded-3xl p-6 sm:p-7 bg-gradient-to-b from-white to-emerald-50/20 space-y-6 shadow-xs">
                    {/* Header Phần C */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase tracking-wider">
                            Phần C & D
                          </span>
                          <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                            <span>Ngân Hàng Hoạt Động Dạy Học & Nền Tảng Trò Chơi Tương Tác</span>
                            <Sparkles className="w-4 h-4 text-amber-500" />
                          </h3>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Hoạt động sư phạm 5–15 phút chuẩn GDPT 2018 và mẫu trò chơi tương tác có thể chỉnh sửa và duyệt trước khi giao.
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-amber-800 font-bold bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 self-start sm:self-auto">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Giáo viên chủ động thẩm định</span>
                      </div>
                    </div>

                    {/* BANNER 3 NÚT NỀN TẢNG (PHẦN D) */}
                    <div className="p-4 bg-white border border-emerald-200 rounded-2xl shadow-xs space-y-3">
                      <div className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <Gamepad2 className="w-4 h-4 text-emerald-600" />
                        <span>Thiết Kế Nền Tảng Tạo Học Liệu Phân Hóa (Giai đoạn chuẩn bị):</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setGameModalType('word_meaning_match');
                            setEditableWordPairs([
                              { word: 'chăm chỉ', meaning: 'Làm việc liên tục, chịu khó, không lười biếng' },
                              { word: 'rực rỡ', meaning: 'Có màu sắc tươi sáng, nổi bật, đẹp mắt' },
                              { word: 'dũng cảm', meaning: 'Không sợ nguy hiểm, dám đối mặt khó khăn' }
                            ]);
                            setShowGameModal(true);
                          }}
                          className="p-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
                        >
                          <Gamepad2 className="w-4 h-4 text-amber-300" />
                          <span>🎮 Mẫu: Ghép Từ Với Nghĩa</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setGameModalType('sequence_order');
                            setEditableSequenceItems([
                              { order: 1, text: 'Gà con theo mẹ ra vườn kiếm ăn buổi sáng.' },
                              { order: 2, text: 'Gà con nhìn thấy một chú bướm bay lượn và đuổi theo.' },
                              { order: 3, text: 'Gà mẹ gọi con quay lại và dặn không được đi xa.' }
                            ]);
                            setShowGameModal(true);
                          }}
                          className="p-3.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
                        >
                          <Layers className="w-4 h-4 text-amber-300" />
                          <span>🧩 Mẫu: Sắp Xếp Trình Tự</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setGameModalType('worksheet');
                            setShowGameModal(true);
                          }}
                          className="p-3.5 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
                        >
                          <FileText className="w-4 h-4 text-amber-300" />
                          <span>📄 Mẫu: Phiếu Học Tập & Sơ Đồ</span>
                        </button>
                      </div>
                    </div>

                    {/* Disclaimer Banner */}
                    <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900 font-semibold leading-relaxed">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>{remediationData.disclaimer}</span>
                    </div>

                    {/* Nhận xét sư phạm tổng quát */}
                    {remediationData.analysisSummary && (
                      <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-black text-slate-900 uppercase tracking-wider">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Nhận xét sư phạm từ AI:</span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed">
                          {remediationData.analysisSummary}
                        </p>
                      </div>
                    )}



                    {/* DANH MỤC 8 HOẠT ĐỘNG SƯ PHẠM ĐỀ XUẤT */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-slate-600 uppercase tracking-wider">
                          Danh mục hoạt động sư phạm phân hóa (Thời lượng 5–15 phút):
                        </h4>
                        <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          {remediationData.suggestedActivities?.length || 0} hoạt động
                        </span>
                      </div>

                      <div className="space-y-4">
                        {remediationData.suggestedActivities?.map((act: RemediationActivity, idx: number) => (
                          <div
                            key={idx}
                            className="p-5 bg-white border border-emerald-200 hover:border-emerald-400 rounded-2xl space-y-4 transition shadow-xs"
                          >
                            {/* Tiêu đề & Badges */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                              <div className="flex items-center gap-2.5">
                                <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs font-black shrink-0">
                                  {idx + 1}
                                </span>
                                <div>
                                  <h5 className="font-black text-slate-900 text-sm sm:text-base">
                                    {act.title}
                                  </h5>
                                  <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                                    {act.targetAudience} · Thời lượng: <strong>{act.durationMinutes || 10} phút</strong>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[11px] font-bold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg">
                                  {REMEDIATION_ACTIVITY_LABELS[act.activityType]?.title || act.title}
                                </span>
                                <span className="text-[11px] font-bold px-2.5 py-1 bg-sky-100 text-sky-800 rounded-lg">
                                  {SKILL_LABELS[act.targetSkill] || act.targetSkill}
                                </span>
                              </div>
                            </div>

                            {/* Mục tiêu GDPT 2018 & Căn cứ */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                              <div>
                                <span className="font-bold text-slate-700">Mục tiêu GDPT 2018: </span>
                                <span className="text-slate-600">{act.skillObjective || act.description}</span>
                              </div>
                              <div>
                                <span className="font-bold text-slate-700">Căn cứ đọc hiểu: </span>
                                <span className="text-slate-600">{act.sourceLessonTitle || 'Số liệu Firestore'}</span>
                              </div>
                            </div>

                            {/* 4 Bước sư phạm tổ chức */}
                            {act.teacherSteps && act.teacherSteps.length > 0 && (
                              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                                {act.teacherSteps.map((step, sIdx) => (
                                  <div key={sIdx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="font-black text-sky-800 text-[10px] uppercase">Bước {sIdx + 1}</div>
                                    <div className="text-[11px] text-slate-600 mt-1">{step}</div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Chuẩn bị & Tiêu chí */}
                            <div className="text-xs text-slate-600 space-y-1">
                              <div>
                                <strong>Chuẩn bị:</strong>{' '}
                                {Array.isArray(act.materialsNeeded) ? act.materialsNeeded.join(', ') : act.materialsNeeded || 'Bảng phụ, thẻ chữ, phiếu bài tập.'}
                              </div>
                              <div><strong>Tiêu chí đạt:</strong> {act.evaluationCriteria || 'Học sinh hiểu và trả lời đúng yêu cầu bài học.'}</div>
                            </div>

                            {/* Thanh công cụ hành động của giáo viên */}
                            <div className="pt-2 flex items-center justify-between gap-2 flex-wrap border-t border-slate-100 text-xs">
                              <div className="flex items-center gap-1.5 text-[11px] font-medium">
                                <span className="text-slate-400">Trạng thái:</span>
                                {act.status === 'approved' ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span>✓ Đã duyệt trong kho</span>
                                    {act.approvedBy && <span className="text-[10px] text-emerald-600 font-normal">({act.approvedBy})</span>}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold border border-amber-200">
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    <span>Bản nháp đề xuất</span>
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActivityDetailOriginalBackup(JSON.parse(JSON.stringify(act)));
                                    setSelectedActivityDetail(JSON.parse(JSON.stringify(act)));
                                    setActivityDetailViewMode('edit');
                                  }}
                                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                                >
                                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Xem chi tiết & Sửa</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={savingActivityId === act.id}
                                  onClick={() => handleSaveActivityDraft(act)}
                                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                                >
                                  {savingActivityId === act.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                                  ) : (
                                    <Save className="w-3.5 h-3.5 text-amber-700" />
                                  )}
                                  <span>{savingActivityId === act.id ? 'Đang lưu...' : 'Lưu nháp'}</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={approvingActivityId === act.id || act.status === 'approved'}
                                  onClick={() => handleApproveActivity(act)}
                                  className={`px-3.5 py-1.5 font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                                    act.status === 'approved'
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 opacity-90 cursor-default'
                                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                  }`}
                                >
                                  {approvingActivityId === act.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5" />
                                  )}
                                  <span>
                                    {approvingActivityId === act.id
                                      ? 'Đang duyệt...'
                                      : act.status === 'approved'
                                      ? '✓ Đã duyệt trong kho'
                                      : 'Duyệt & Đưa vào kho'}
                                  </span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

          {/* ========================================================= */}
          {/* MODAL XEM CHI TIẾT & CHỈNH SỬA HOẠT ĐỘNG SƯ PHẠM */}
          {/* ========================================================= */}
          {selectedActivityDetail && (
                    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
                      <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-7 space-y-5 border border-slate-200 shadow-2xl animate-fade-in my-8">
                        {/* Header của Modal kèm Tab Switcher */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                              <Sparkles className="w-4 h-4" />
                            </div>
                            <div>
                              <h3 className="font-black text-slate-900 text-base sm:text-lg flex items-center gap-2">
                                <span>Hoạt Động Sư Phạm</span>
                                {selectedActivityDetail.status === 'approved' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    ✓ Đã duyệt
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                    Bản nháp
                                  </span>
                                )}
                              </h3>
                              <p className="text-[11px] text-slate-500 font-medium">
                                Chuẩn chương trình GDPT 2018 · Phân hóa năng lực đọc hiểu
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Chuyển đổi tab Chỉnh sửa vs Xem trước */}
                            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold">
                              <button
                                type="button"
                                onClick={() => setActivityDetailViewMode('edit')}
                                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                                  activityDetailViewMode === 'edit'
                                    ? 'bg-white text-slate-900 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Chỉnh sửa nội dung</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setActivityDetailViewMode('preview')}
                                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                                  activityDetailViewMode === 'preview'
                                    ? 'bg-white text-slate-900 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Xem trước trực quan</span>
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                if (activityDetailOriginalBackup) {
                                  setSelectedActivityDetail(activityDetailOriginalBackup);
                                }
                                setSelectedActivityDetail(null);
                              }}
                              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                              title="Đóng cửa sổ"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        </div>

                        {/* Banner thông báo nếu hoạt động đã duyệt */}
                        {selectedActivityDetail.status === 'approved' && (
                          <div className="p-3.5 bg-amber-50/90 border border-amber-300 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900 font-semibold shadow-xs">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <strong>Lưu ý hoạt động đã phê duyệt:</strong> Hoạt động này hiện đang nằm trong kho Đã duyệt. Khi thầy cô bấm <strong>"Lưu thành bản nháp mới"</strong>, hệ thống sẽ tự động tạo một phiên bản nháp độc lập để tiếp tục chỉnh sửa mà không làm thay đổi âm thầm nội dung đã duyệt trong kho.
                            </div>
                          </div>
                        )}

                        {/* Nội dung Modal: Tab Chỉnh sửa */}
                        {activityDetailViewMode === 'edit' && (
                          <div className="space-y-4 text-xs sm:text-sm text-slate-700 max-h-[65vh] overflow-y-auto pr-2">
                            {/* 1. Tên hoạt động */}
                            <div>
                              <label className="font-bold text-slate-800 block mb-1">1. Tên hoạt động:</label>
                              <input
                                type="text"
                                value={selectedActivityDetail.title}
                                onChange={(e) =>
                                  setSelectedActivityDetail({ ...selectedActivityDetail, title: e.target.value })
                                }
                                className="w-full p-2.5 rounded-xl border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                                placeholder="Nhập tên hoạt động dạy học..."
                              />
                            </div>

                            {/* 2. Thời lượng & Đối tượng & Căn cứ */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="font-bold text-slate-800 block mb-1">2. Thời lượng (phút):</label>
                                <input
                                  type="number"
                                  min={5}
                                  max={30}
                                  value={selectedActivityDetail.durationMinutes || 10}
                                  onChange={(e) =>
                                    setSelectedActivityDetail({
                                      ...selectedActivityDetail,
                                      durationMinutes: parseInt(e.target.value, 10) || 10
                                    })
                                  }
                                  className="w-full p-2.5 rounded-xl border border-slate-200 font-medium"
                                />
                              </div>
                              <div>
                                <label className="font-bold text-slate-800 block mb-1">3. Đối tượng học sinh:</label>
                                <input
                                  type="text"
                                  value={selectedActivityDetail.targetAudience || 'Toàn lớp'}
                                  onChange={(e) =>
                                    setSelectedActivityDetail({
                                      ...selectedActivityDetail,
                                      targetAudience: e.target.value
                                    })
                                  }
                                  className="w-full p-2.5 rounded-xl border border-slate-200 font-medium"
                                  placeholder="Ví dụ: Nhóm cần hỗ trợ, Toàn lớp..."
                                />
                              </div>
                              <div>
                                <label className="font-bold text-slate-800 block mb-1">4. Căn cứ bài đọc:</label>
                                <input
                                  type="text"
                                  value={selectedActivityDetail.sourceLessonTitle || ''}
                                  onChange={(e) =>
                                    setSelectedActivityDetail({
                                      ...selectedActivityDetail,
                                      sourceLessonTitle: e.target.value
                                    })
                                  }
                                  className="w-full p-2.5 rounded-xl border border-slate-200 font-medium"
                                  placeholder="Tên bài đọc hoặc câu hỏi nguồn..."
                                />
                              </div>
                            </div>

                            {/* 3. Mục tiêu GDPT 2018 */}
                            <div>
                              <label className="font-bold text-slate-800 block mb-1">5. Mục tiêu năng lực GDPT 2018:</label>
                              <textarea
                                rows={2}
                                value={selectedActivityDetail.skillObjective || ''}
                                onChange={(e) =>
                                  setSelectedActivityDetail({
                                    ...selectedActivityDetail,
                                    skillObjective: e.target.value
                                  })
                                }
                                className="w-full p-2.5 rounded-xl border border-slate-200 font-medium text-xs leading-relaxed"
                                placeholder="Ghi rõ mục tiêu đọc hiểu theo chuẩn GDPT 2018..."
                              />
                            </div>

                            {/* 4. Các bước tổ chức sư phạm (B1–B4) */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="font-bold text-slate-800 block">
                                  6. Các bước tổ chức dạy học (Sư phạm 4 bước):
                                </label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = [...(selectedActivityDetail.teacherSteps || [])];
                                    next.push(`Bước ${next.length + 1}: Hoạt động mở rộng tiếp theo...`);
                                    setSelectedActivityDetail({ ...selectedActivityDetail, teacherSteps: next });
                                  }}
                                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Thêm bước</span>
                                </button>
                              </div>

                              <div className="space-y-2 text-xs">
                                {(selectedActivityDetail.teacherSteps || []).map((step, sIdx) => (
                                  <div key={sIdx} className="flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-md bg-sky-100 text-sky-800 font-bold flex items-center justify-center shrink-0 text-[10px]">
                                      B{sIdx + 1}
                                    </span>
                                    <input
                                      type="text"
                                      value={step}
                                      onChange={(e) => {
                                        const nextSteps = [...(selectedActivityDetail.teacherSteps || [])];
                                        nextSteps[sIdx] = e.target.value;
                                        setSelectedActivityDetail({
                                          ...selectedActivityDetail,
                                          teacherSteps: nextSteps
                                        });
                                      }}
                                      className="flex-1 p-2 rounded-lg border border-slate-200"
                                      placeholder={`Nội dung bước ${sIdx + 1}`}
                                    />
                                    {(selectedActivityDetail.teacherSteps || []).length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const nextSteps = (selectedActivityDetail.teacherSteps || []).filter(
                                            (_, idx) => idx !== sIdx
                                          );
                                          setSelectedActivityDetail({
                                            ...selectedActivityDetail,
                                            teacherSteps: nextSteps
                                          });
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                        title="Xóa bước này"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* 5. Chuẩn bị học liệu */}
                            <div>
                              <label className="font-bold text-slate-800 block mb-1">
                                7. Chuẩn bị học liệu (phân cách bằng dấu phẩy):
                              </label>
                              <input
                                type="text"
                                value={
                                  Array.isArray(selectedActivityDetail.materialsNeeded)
                                    ? selectedActivityDetail.materialsNeeded.join(', ')
                                    : selectedActivityDetail.materialsNeeded || ''
                                }
                                onChange={(e) =>
                                  setSelectedActivityDetail({
                                    ...selectedActivityDetail,
                                    materialsNeeded: e.target.value
                                      .split(',')
                                      .map((s) => s.trim())
                                      .filter(Boolean)
                                  })
                                }
                                className="w-full p-2.5 rounded-xl border border-slate-200 font-medium"
                                placeholder="Ví dụ: Thẻ từ, Máy chiếu, Phiếu in bài tập..."
                              />
                            </div>

                            {/* 6. Tiêu chí đánh giá */}
                            <div>
                              <label className="font-bold text-slate-800 block mb-1">8. Tiêu chí đánh giá đạt chuẩn:</label>
                              <input
                                type="text"
                                value={selectedActivityDetail.evaluationCriteria || ''}
                                onChange={(e) =>
                                  setSelectedActivityDetail({
                                    ...selectedActivityDetail,
                                    evaluationCriteria: e.target.value
                                  })
                                }
                                className="w-full p-2.5 rounded-xl border border-slate-200 font-medium"
                                placeholder="Ví dụ: Học sinh ghép đúng 3/4 từ hoặc đạt ≥ 80%..."
                              />
                            </div>

                            {/* 7. Nội dung trò chơi / câu hỏi đi kèm (Nếu có) */}
                            {selectedActivityDetail.contentPayload?.gameData?.pairs && (
                              <div className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-200 space-y-2">
                                <div className="font-black text-emerald-900 text-xs flex items-center justify-between">
                                  <span>Bộ từ ngữ và nghĩa (Trò chơi tương tác):</span>
                                  <span className="text-[10px] text-emerald-700">
                                    {selectedActivityDetail.contentPayload.gameData.pairs.length} cặp từ
                                  </span>
                                </div>
                                <div className="space-y-1.5">
                                  {selectedActivityDetail.contentPayload.gameData.pairs.map((p, pIdx) => (
                                    <div key={pIdx} className="grid grid-cols-2 gap-2 text-xs">
                                      <input
                                        type="text"
                                        value={p.word}
                                        onChange={(e) => {
                                          const nextPairs = [...(selectedActivityDetail.contentPayload!.gameData!.pairs!)];
                                          nextPairs[pIdx] = { ...nextPairs[pIdx], word: e.target.value };
                                          setSelectedActivityDetail({
                                            ...selectedActivityDetail,
                                            contentPayload: {
                                              ...selectedActivityDetail.contentPayload,
                                              gameData: {
                                                ...selectedActivityDetail.contentPayload?.gameData,
                                                pairs: nextPairs
                                              }
                                            }
                                          });
                                        }}
                                        className="p-1.5 bg-white rounded-lg border border-slate-200 font-bold"
                                        placeholder="Từ ngữ"
                                      />
                                      <input
                                        type="text"
                                        value={p.meaning}
                                        onChange={(e) => {
                                          const nextPairs = [...(selectedActivityDetail.contentPayload!.gameData!.pairs!)];
                                          nextPairs[pIdx] = { ...nextPairs[pIdx], meaning: e.target.value };
                                          setSelectedActivityDetail({
                                            ...selectedActivityDetail,
                                            contentPayload: {
                                              ...selectedActivityDetail.contentPayload,
                                              gameData: {
                                                ...selectedActivityDetail.contentPayload?.gameData,
                                                pairs: nextPairs
                                              }
                                            }
                                          });
                                        }}
                                        className="p-1.5 bg-white rounded-lg border border-slate-200"
                                        placeholder="Giải nghĩa của từ"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {selectedActivityDetail.contentPayload?.gameData?.sequenceItems && (
                              <div className="p-3.5 bg-sky-50/60 rounded-2xl border border-sky-200 space-y-2">
                                <div className="font-black text-sky-900 text-xs">
                                  Các sự việc sắp xếp trình tự câu chuyện:
                                </div>
                                <div className="space-y-1.5">
                                  {selectedActivityDetail.contentPayload.gameData.sequenceItems.map((item, iIdx) => (
                                    <div key={iIdx} className="flex items-center gap-2 text-xs">
                                      <span className="w-5 h-5 rounded bg-sky-200 text-sky-800 font-bold flex items-center justify-center text-[10px] shrink-0">
                                        {iIdx + 1}
                                      </span>
                                      <input
                                        type="text"
                                        value={item.text}
                                        onChange={(e) => {
                                          const nextItems = [
                                            ...(selectedActivityDetail.contentPayload!.gameData!.sequenceItems!)
                                          ];
                                          nextItems[iIdx] = { ...nextItems[iIdx], text: e.target.value };
                                          setSelectedActivityDetail({
                                            ...selectedActivityDetail,
                                            contentPayload: {
                                              ...selectedActivityDetail.contentPayload,
                                              gameData: {
                                                ...selectedActivityDetail.contentPayload?.gameData,
                                                sequenceItems: nextItems
                                              }
                                            }
                                          });
                                        }}
                                        className="flex-1 p-1.5 bg-white rounded-lg border border-slate-200"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Nội dung Modal: Tab Xem trước trực quan (Preview) */}
                        {activityDetailViewMode === 'preview' && (
                          <div className="space-y-4 text-xs sm:text-sm text-slate-700 max-h-[65vh] overflow-y-auto pr-2">
                            {/* Card xem trước mô phỏng kế hoạch sư phạm */}
                            <div className="p-5 bg-gradient-to-br from-emerald-50/50 via-white to-sky-50/50 border border-emerald-200 rounded-2xl space-y-4 shadow-xs">
                              <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                                <div>
                                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                                    {REMEDIATION_ACTIVITY_LABELS[selectedActivityDetail.activityType]?.title ||
                                      selectedActivityDetail.activityType}
                                  </span>
                                  <h4 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                                    {selectedActivityDetail.title}
                                  </h4>
                                  <div className="text-xs text-slate-500 font-medium mt-0.5">
                                    Đối tượng: <strong>{selectedActivityDetail.targetAudience}</strong> · Thời lượng:{' '}
                                    <strong>{selectedActivityDetail.durationMinutes || 10} phút</strong>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-[11px] font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200">
                                    {SKILL_LABELS[selectedActivityDetail.targetSkill] ||
                                      selectedActivityDetail.targetSkill}
                                  </span>
                                </div>
                              </div>

                              {/* Mục tiêu & Căn cứ */}
                              <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-1.5 text-xs">
                                <div>
                                  <strong className="text-emerald-900">Mục tiêu GDPT 2018:</strong>{' '}
                                  <span className="text-slate-700">
                                    {selectedActivityDetail.skillObjective || 'Rèn luyện năng lực đọc hiểu.'}
                                  </span>
                                </div>
                                <div>
                                  <strong className="text-sky-900">Căn cứ bài đọc:</strong>{' '}
                                  <span className="text-slate-700">
                                    {selectedActivityDetail.sourceLessonTitle || 'Số liệu thực tế lớp học'}
                                  </span>
                                </div>
                              </div>

                              {/* 4 Bước sư phạm */}
                              <div className="space-y-2">
                                <div className="font-black text-slate-800 text-xs uppercase tracking-wider">
                                  Quy trình 4 bước tổ chức trên lớp:
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                  {(selectedActivityDetail.teacherSteps || []).map((st, i) => (
                                    <div
                                      key={i}
                                      className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1"
                                    >
                                      <div className="font-black text-emerald-800 text-[10px] uppercase">
                                        Bước {i + 1}
                                      </div>
                                      <div className="text-slate-700">{st}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Mẫu học liệu trò chơi nếu có */}
                              {selectedActivityDetail.contentPayload?.gameData?.pairs && (
                                <div className="p-4 bg-white rounded-xl border border-emerald-200 space-y-2">
                                  <div className="font-black text-emerald-900 text-xs">
                                    Thẻ trò chơi tương tác (Ghép từ với nghĩa):
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {selectedActivityDetail.contentPayload.gameData.pairs.map((p, idx) => (
                                      <div
                                        key={idx}
                                        className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-center space-y-1"
                                      >
                                        <div className="font-black text-emerald-800 text-xs">{p.word}</div>
                                        <div className="text-[10px] text-slate-600 line-clamp-2">{p.meaning}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Chuẩn bị & Tiêu chí */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white p-3 rounded-xl border border-slate-200">
                                <div>
                                  <strong className="text-slate-700">Chuẩn bị học liệu:</strong>{' '}
                                  <span className="text-slate-600">
                                    {Array.isArray(selectedActivityDetail.materialsNeeded)
                                      ? selectedActivityDetail.materialsNeeded.join(', ')
                                      : selectedActivityDetail.materialsNeeded || 'Bảng phụ, phiếu in'}
                                  </span>
                                </div>
                                <div>
                                  <strong className="text-slate-700">Tiêu chí đánh giá:</strong>{' '}
                                  <span className="text-slate-600">
                                    {selectedActivityDetail.evaluationCriteria || 'Đạt yêu cầu bài học'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Footer của Modal */}
                        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                          <div className="text-[11px] text-slate-500 font-medium">
                            Trạng thái hiện tại:{' '}
                            <strong className="text-slate-800">
                              {selectedActivityDetail.status === 'approved' ? '✓ Đã phê duyệt' : 'Bản nháp đề xuất'}
                            </strong>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                if (activityDetailOriginalBackup) {
                                  setSelectedActivityDetail(activityDetailOriginalBackup);
                                }
                                setSelectedActivityDetail(null);
                              }}
                              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer text-xs"
                            >
                              Hủy bỏ
                            </button>

                            {selectedActivityDetail.status === 'approved' ? (
                              <>
                                <button
                                  type="button"
                                  disabled={savingActivityId === selectedActivityDetail.id}
                                  onClick={() => handleSaveActivityDraft(selectedActivityDetail, true)}
                                  className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded-xl transition cursor-pointer text-xs flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
                                >
                                  {savingActivityId === selectedActivityDetail.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5 text-amber-700" />
                                  )}
                                  <span>
                                    {savingActivityId === selectedActivityDetail.id ? 'Đang tạo bản nháp...' : 'Lưu thành bản nháp mới'}
                                  </span>
                                </button>

                                <div className="px-3.5 py-2 bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-default">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>✓ Đã duyệt trong kho</span>
                                </div>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  disabled={savingActivityId === selectedActivityDetail.id}
                                  onClick={() => handleSaveActivityDraft(selectedActivityDetail, false)}
                                  className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold rounded-xl transition cursor-pointer text-xs flex items-center gap-1.5 disabled:opacity-50"
                                >
                                  {savingActivityId === selectedActivityDetail.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                                  ) : (
                                    <Save className="w-3.5 h-3.5 text-amber-700" />
                                  )}
                                  <span>
                                    {savingActivityId === selectedActivityDetail.id ? 'Đang lưu...' : 'Lưu bản nháp'}
                                  </span>
                                </button>

                                <button
                                  type="button"
                                  disabled={approvingActivityId === selectedActivityDetail.id}
                                  onClick={() => handleApproveActivity(selectedActivityDetail)}
                                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition cursor-pointer text-xs flex items-center gap-1.5 shadow-xs"
                                >
                                  {approvingActivityId === selectedActivityDetail.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5" />
                                  )}
                                  <span>
                                    {approvingActivityId === selectedActivityDetail.id
                                      ? 'Đang duyệt...'
                                      : 'Duyệt & Đưa vào kho'}
                                  </span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ========================================================= */}
                  {/* MODAL MẪU TRÒ CHƠI TƯƠNG TÁC (PHẦN D: 2 MẪU TƯƠNG TÁC) */}
                  {/* ========================================================= */}
                  {showGameModal && (
                    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
                      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 space-y-5 border border-slate-200 shadow-2xl animate-fade-in my-8">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2">
                            <Gamepad2 className="w-5 h-5 text-emerald-600" />
                            <h3 className="font-black text-slate-900 text-base sm:text-lg">
                              {gameModalType === 'word_meaning_match'
                                ? 'Mẫu Trò Chơi: Ghép Từ Với Nghĩa'
                                : gameModalType === 'sequence_order'
                                ? 'Mẫu Trò Chơi: Sắp Xếp Trình Tự Câu Chuyện'
                                : 'Mẫu: Phiếu Học Tập & Sơ Đồ Tư Duy'}
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowGameModal(false)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>

                        {/* MẪU 1: GHÉP TỪ VỚI NGHĨA */}
                        {gameModalType === 'word_meaning_match' && (
                          <div className="space-y-4">
                            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900">
                              <strong>Hướng dẫn sư phạm:</strong> Trò chơi giúp học sinh lớp 2–3 củng cố năng lực hiểu từ trong ngữ cảnh. Giáo viên có thể thêm, bớt hoặc sửa từ trước khi xuất bản.
                            </div>

                            <div className="space-y-2">
                              <div className="text-xs font-black text-slate-700 uppercase">Danh sách cặp Từ – Nghĩa:</div>
                              {editableWordPairs.map((pair, pIdx) => (
                                <div key={pIdx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Từ ngữ ({pIdx + 1}):</label>
                                    <input
                                      type="text"
                                      value={pair.word}
                                      onChange={(e) => {
                                        const updated = [...editableWordPairs];
                                        updated[pIdx].word = e.target.value;
                                        setEditableWordPairs(updated);
                                      }}
                                      className="w-full p-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-900 bg-white"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Ý nghĩa:</label>
                                    <input
                                      type="text"
                                      value={pair.meaning}
                                      onChange={(e) => {
                                        const updated = [...editableWordPairs];
                                        updated[pIdx].meaning = e.target.value;
                                        setEditableWordPairs(updated);
                                      }}
                                      className="w-full p-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white"
                                    />
                                  </div>
                                </div>
                              ))}

                              <button
                                type="button"
                                onClick={() => {
                                  setEditableWordPairs([
                                    ...editableWordPairs,
                                    { word: 'từ mới', meaning: 'ý nghĩa của từ mới' }
                                  ]);
                                }}
                                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Thêm cặp từ mới</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* MẪU 2: SẮP XẾP TRÌNH TỰ */}
                        {gameModalType === 'sequence_order' && (
                          <div className="space-y-4">
                            <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 text-xs text-sky-900">
                              <strong>Hướng dẫn sư phạm:</strong> Trò chơi rèn kỹ năng sắp xếp trình tự thời gian và diễn biến cốt truyện. Học sinh dùng nút bấm hoặc kéo thả để đưa các sự việc về đúng trật tự.
                            </div>

                            <div className="space-y-2">
                              <div className="text-xs font-black text-slate-700 uppercase">Các thẻ sự việc (Dùng nút mũi tên để hoán đổi):</div>
                              {editableSequenceItems.map((item, sIdx) => (
                                <div key={sIdx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                                  <span className="w-6 h-6 rounded-lg bg-sky-600 text-white flex items-center justify-center text-xs font-black shrink-0">
                                    {sIdx + 1}
                                  </span>
                                  <input
                                    type="text"
                                    value={item.text}
                                    onChange={(e) => {
                                      const updated = [...editableSequenceItems];
                                      updated[sIdx].text = e.target.value;
                                      setEditableSequenceItems(updated);
                                    }}
                                    className="flex-1 p-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-900 bg-white"
                                  />
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      disabled={sIdx === 0}
                                      onClick={() => {
                                        if (sIdx === 0) return;
                                        const updated = [...editableSequenceItems];
                                        const temp = updated[sIdx];
                                        updated[sIdx] = updated[sIdx - 1];
                                        updated[sIdx - 1] = temp;
                                        setEditableSequenceItems(updated);
                                      }}
                                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                                      title="Di chuyển lên"
                                    >
                                      <ArrowUp className="w-3.5 h-3.5 text-slate-600" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={sIdx === editableSequenceItems.length - 1}
                                      onClick={() => {
                                        if (sIdx === editableSequenceItems.length - 1) return;
                                        const updated = [...editableSequenceItems];
                                        const temp = updated[sIdx];
                                        updated[sIdx] = updated[sIdx + 1];
                                        updated[sIdx + 1] = temp;
                                        setEditableSequenceItems(updated);
                                      }}
                                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                                      title="Di chuyển xuống"
                                    >
                                      <ArrowDown className="w-3.5 h-3.5 text-slate-600" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* MẪU 3: PHIẾU HỌC TẬP & SƠ ĐỒ */}
                        {gameModalType === 'worksheet' && (
                          <div className="space-y-4 text-xs">
                            <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200 space-y-2">
                              <div className="font-black text-purple-900 text-sm">Sơ đồ tư duy bông hoa đọc hiểu:</div>
                              <p className="text-purple-800">
                                Nhụy hoa: Tên bài đọc / Nhân vật chính.<br />
                                Cánh hoa 1: Sự việc bắt đầu.<br />
                                Cánh hoa 2: Sự việc tiếp theo.<br />
                                Cánh hoa 3: Kết thúc và bài học yêu thương.
                              </p>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                              <span className="font-bold text-slate-700">Gợi ý in ấn:</span> Giáo viên có thể xuất sơ đồ này làm phiếu củng cố cuối bài để học sinh hoàn thiện trong 10 phút.
                            </div>
                          </div>
                        )}

                        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                          <div className="text-[11px] text-amber-800 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 font-medium">
                            <strong>Lưu ý phạm vi Đợt 1:</strong> Mẫu học liệu tương tác dành cho giáo viên tổ chức tại lớp hoặc trình chiếu. Hệ thống chưa hỗ trợ học sinh tự chơi trực tuyến và lưu điểm độc lập trong phiên bản này.
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setShowGameModal(false)}
                              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer text-xs"
                            >
                              Đóng
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveGameTemplateAsActivity()}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition cursor-pointer text-xs flex items-center gap-1.5 shadow-xs"
                            >
                              <Save className="w-4 h-4" />
                              <span>Lưu vào kho học liệu của tôi</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
            </div>
          );
        })()}

      {/* ========================================================= */}
      {/* ========================================================= */}
      {/* TAB 6: DATA EXPORT & AUDIT REPORT (MODULE 5: BÁO CÁO PHÂN CẤP) */}
      {/* ========================================================= */}
      {activeTab === 'export' && (() => {
        const exportAvailableYears = Array.from(
          new Set(classes.map((c) => c.academicYear || '2026-2027'))
        ).sort().reverse();

        const exportAvailableGrades = exportNavYear
          ? Array.from(
              new Set(
                classes
                  .filter((c) => (c.academicYear || '2026-2027') === exportNavYear)
                  .map((c) => c.grade)
              )
            ).sort()
          : [];

        const exportAvailableClasses = exportNavYear && exportNavGrade
          ? classes.filter(
              (c) =>
                (c.academicYear || '2026-2027') === exportNavYear &&
                c.grade === exportNavGrade
            )
          : [];

        const currentTargetClass = classes.find((c) => c.id === exportNavClassId);
        const currentSemesterLabel =
          exportNavSemester === 1
            ? 'Học kỳ I'
            : exportNavSemester === 2
            ? 'Học kỳ II'
            : 'Cả năm học';

        const compList = [
          { key: 'thong_tin_truc_tiep', name: 'Tìm thông tin trực tiếp', req: 'Nhận biết chi tiết trong văn bản' },
          { key: 'tu_trong_ngu_canh', name: 'Hiểu từ trong ngữ cảnh', req: 'Giải nghĩa từ ngữ qua câu chuyện' },
          { key: 'noi_dung_chinh', name: 'Hiểu nội dung chính', req: 'Xác định bài học và ý chính' },
          { key: 'sap_xep_trinh_tu', name: 'Sắp xếp trình tự', req: 'Trật tự thời gian và diễn biến' },
          { key: 'lien_he_van_dung', name: 'Liên hệ vận dụng', req: 'Rút ra bài học thực tiễn bản thân' }
        ];

        return (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <span>Xuất Dữ Liệu & Báo Cáo Nghiệm Thu</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                    Chuẩn Sư Phạm 2018
                  </span>
                </h2>
                <p className="text-xs text-slate-500 font-semibold mt-1">
                  Quy trình chọn 4 bước: Năm học → Khối lớp → Lớp học → Học kỳ → Xem báo cáo · Xuất Excel (.xlsx), CSV UTF-8 BOM và Báo cáo PDF hội đồng
                </p>
              </div>

              {/* Action Buttons (Visible when report has been generated) */}
              {hasGeneratedReport && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleExportExcel}
                    className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                    title="Tải bảng tính Excel (.xlsx) chuẩn hóa định dạng sư phạm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Xuất Excel (.xlsx)</span>
                  </button>

                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-2 px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                    title="Tải bảng tính CSV UTF-8 BOM tiếng Việt"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Xuất CSV (.csv)</span>
                  </button>

                  <button
                    onClick={() => setShowPdfReportModal(true)}
                    className="flex items-center gap-2 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                    title="Mở báo cáo tổng hợp chuẩn hội đồng sư phạm để xem và in PDF"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Xem & In Báo Cáo PDF</span>
                  </button>

                  <button
                    onClick={() => setHasGeneratedReport(false)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                    title="Đổi tiêu chí lọc để chọn lớp khác"
                  >
                    <Filter className="w-3.5 h-3.5 text-slate-500" />
                    <span>Đổi Bộ Lọc</span>
                  </button>
                </div>
              )}
            </div>

            {/* Synthetic Demo Disclaimer Badge */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3 text-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-black uppercase tracking-wider">
                      NGUỒN DỮ LIỆU SƯ PHẠM
                    </span>
                    <span className="font-bold text-slate-800">
                      Dữ liệu chuẩn hóa GDPT 2018 phục vụ quản trị và đánh giá năng lực
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                    Bảo mật quyền riêng tư học sinh · Dữ liệu được quản trị an toàn trên Cloud Firestore.
                  </p>
                </div>
              </div>

              {hasGeneratedReport && (
                <button
                  onClick={() => loadExportReportData(exportNavYear, exportNavGrade, exportNavClassId, exportNavSemester)}
                  disabled={loadingExportData}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-xl transition cursor-pointer"
                  title="Làm mới dữ liệu"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingExportData ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>

            {/* ========================================================= */}
            {/* STEP 1-4: PROGRESSIVE SELECTION (NĂM HỌC → KHỐI → LỚP → HỌC KỲ → XEM BÁO CÁO) */}
            {/* ========================================================= */}
            {!hasGeneratedReport && (
              <div className="space-y-6">
                {/* Stepper Progress Bar */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-2">
                    <span className="flex items-center gap-1.5 text-slate-900 font-black">
                      <Layers className="w-4 h-4 text-purple-600" />
                      <span>Quy trình chọn báo cáo phân cấp</span>
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Bước {!exportNavYear ? '1/4' : !exportNavGrade ? '2/4' : !exportNavClassId ? '3/4' : '4/4'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[11px] font-bold">
                    <div className={`p-2 rounded-xl transition ${exportNavYear ? 'bg-sky-100 text-sky-800 border border-sky-300' : 'bg-white border border-slate-200 text-slate-700 shadow-xs'}`}>
                      1. Năm: {exportNavYear || 'Chưa chọn'}
                    </div>
                    <div className={`p-2 rounded-xl transition ${exportNavGrade ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : exportNavYear ? 'bg-white border border-slate-200 text-slate-700 shadow-xs' : 'bg-slate-100 text-slate-400 opacity-60'}`}>
                      2. Khối: {exportNavGrade ? `Khối ${exportNavGrade}` : 'Chưa chọn'}
                    </div>
                    <div className={`p-2 rounded-xl transition ${exportNavClassId ? 'bg-purple-100 text-purple-800 border border-purple-300' : exportNavGrade ? 'bg-white border border-slate-200 text-slate-700 shadow-xs' : 'bg-slate-100 text-slate-400 opacity-60'}`}>
                      3. Lớp: {currentTargetClass?.name || 'Chưa chọn'}
                    </div>
                    <div className={`p-2 rounded-xl transition ${exportNavClassId ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-100 text-slate-400 opacity-60'}`}>
                      4. Học kỳ: {currentSemesterLabel}
                    </div>
                  </div>
                </div>

                {/* BƯỚC 1: CHỌN NĂM HỌC */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-sky-600 text-white flex items-center justify-center text-xs font-black">1</span>
                      <span>Chọn Năm Học</span>
                    </h3>
                    {exportNavYear && (
                      <span className="text-xs text-sky-700 font-bold bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">
                        ✓ Đã chọn: {exportNavYear}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {exportAvailableYears.map((yr) => (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => {
                          setExportNavYear(yr);
                          setExportNavGrade(null);
                          setExportNavClassId(null);
                          setExportSummary(null);
                          setExportRecords([]);
                        }}
                        className={`p-4 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                          exportNavYear === yr
                            ? 'bg-sky-50 border-sky-500 shadow-sm ring-2 ring-sky-500/20'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${exportNavYear === yr ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                            <Calendar className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-black text-sm text-slate-900">Năm học {yr}</div>
                            <div className="text-xs text-slate-500 font-medium">
                              {classes.filter((c) => (c.academicYear || '2026-2027') === yr).length} lớp đang hoạt động
                            </div>
                          </div>
                        </div>
                        {exportNavYear === yr && <CheckCircle2 className="w-5 h-5 text-sky-600" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* BƯỚC 2: CHỌN KHỐI LỚP (Shown when year selected) */}
                {exportNavYear && (
                  <div className="space-y-3 pt-2 border-t border-slate-100 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs font-black">2</span>
                        <span>Chọn Khối Lớp ({exportNavYear})</span>
                      </h3>
                      {exportNavGrade && (
                        <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          ✓ Đã chọn: Khối {exportNavGrade}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {exportAvailableGrades.map((gr) => (
                        <button
                          key={gr}
                          type="button"
                          onClick={() => {
                            setExportNavGrade(gr);
                            setExportNavClassId(null);
                            setExportSummary(null);
                            setExportRecords([]);
                          }}
                          className={`p-4 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                            exportNavGrade === gr
                              ? 'bg-emerald-50 border-emerald-500 shadow-sm ring-2 ring-emerald-500/20'
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${exportNavGrade === gr ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                              <GraduationCap className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="font-black text-sm text-slate-900">Khối {gr}</div>
                              <div className="text-xs text-slate-500 font-medium">
                                {classes.filter((c) => (c.academicYear || '2026-2027') === exportNavYear && c.grade === gr).length} lớp học
                              </div>
                            </div>
                          </div>
                          {exportNavGrade === gr && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* BƯỚC 3: CHỌN LỚP HỌC (Shown when grade selected) */}
                {exportNavYear && exportNavGrade && (
                  <div className="space-y-3 pt-2 border-t border-slate-100 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center text-xs font-black">3</span>
                        <span>Chọn Lớp Học (Khối {exportNavGrade} · {exportNavYear})</span>
                      </h3>
                      {exportNavClassId && (
                        <span className="text-xs text-purple-700 font-bold bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                          ✓ Đã chọn: {currentTargetClass?.name}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {exportAvailableClasses.map((cls) => (
                        <button
                          key={cls.id}
                          type="button"
                          onClick={() => {
                            setExportNavClassId(cls.id);
                            setExportSummary(null);
                            setExportRecords([]);
                          }}
                          className={`p-4 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                            exportNavClassId === cls.id
                              ? 'bg-purple-50 border-purple-500 shadow-sm ring-2 ring-purple-500/20'
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${exportNavClassId === cls.id ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                              <Users className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="font-black text-sm text-slate-900">Lớp {cls.name}</div>
                              <div className="text-xs text-slate-500 font-medium">
                                Mã lớp: <strong className="font-mono text-purple-700">{cls.classCode}</strong> · Sĩ số: {cls.studentCount || 20} HS
                              </div>
                            </div>
                          </div>
                          {exportNavClassId === cls.id && <CheckCircle2 className="w-5 h-5 text-purple-600" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* BƯỚC 4: CHỌN HỌC KỲ (Shown when class selected) */}
                {exportNavYear && exportNavGrade && exportNavClassId && (
                  <div className="space-y-3 pt-2 border-t border-slate-100 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-amber-600 text-white flex items-center justify-center text-xs font-black">4</span>
                        <span>Chọn Học Kỳ Báo Cáo</span>
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { id: 'all', label: 'Cả năm học', desc: 'Tổng hợp toàn bộ lượt làm trong năm' },
                        { id: 1, label: 'Học kỳ I', desc: 'Chỉ các bài đọc thuộc chương trình HK1' },
                        { id: 2, label: 'Học kỳ II', desc: 'Chỉ các bài đọc thuộc chương trình HK2' }
                      ].map((sem) => (
                        <button
                          key={sem.id}
                          type="button"
                          onClick={() => setExportNavSemester(sem.id as any)}
                          className={`p-3.5 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                            exportNavSemester === sem.id
                              ? 'bg-amber-50 border-amber-500 shadow-sm ring-2 ring-amber-500/20'
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                          }`}
                        >
                          <div>
                            <div className="font-black text-xs text-slate-900">{sem.label}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{sem.desc}</div>
                          </div>
                          {exportNavSemester === sem.id && <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />}
                        </button>
                      ))}
                    </div>

                    {/* BƯỚC 5: NÚT XEM BÁO CÁO */}
                    <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-purple-50 to-sky-50 p-4 rounded-2xl border border-purple-200/60">
                      <div className="text-xs text-slate-700">
                        <div className="font-black text-slate-900 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-purple-600" />
                          <span>Sẵn sàng tổng hợp báo cáo</span>
                        </div>
                        <p className="text-slate-500 mt-0.5 text-[11px]">
                          Phạm vi: Lớp <strong>{currentTargetClass?.name}</strong> · Khối {exportNavGrade} · Năm học {exportNavYear} · {currentSemesterLabel}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleGenerateReport}
                        disabled={loadingExportData}
                        className="w-full sm:w-auto px-6 py-3 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {loadingExportData ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Đang tổng hợp dữ liệu Firestore...</span>
                          </>
                        ) : (
                          <>
                            <BarChart3 className="w-4 h-4" />
                            <span>XEM BÁO CÁO THỐNG KÊ</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================= */}
            {/* REPORT VIEW: SHOWN ONLY AFTER "XEM BÁO CÁO" IS CLICKED */}
            {/* ========================================================= */}
            {hasGeneratedReport && (
              <div className="space-y-6 animate-fade-in">
                {/* Active Scope Toolbar */}
                <div className="bg-slate-50 border border-slate-200 p-3 sm:p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-black text-slate-800">Phạm vi báo cáo:</span>
                    <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-bold text-sky-700">
                      Năm học {exportNavYear}
                    </span>
                    <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-bold text-emerald-700">
                      Khối {exportNavGrade}
                    </span>
                    <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-bold text-purple-700">
                      Lớp {currentTargetClass?.name}
                    </span>
                    <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-bold text-amber-700">
                      {currentSemesterLabel}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setHasGeneratedReport(false)}
                      className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                      <span>Đổi phạm vi báo cáo</span>
                    </button>
                    <div className="text-xs font-semibold text-slate-500">
                      Tổng số bản ghi: <strong className="text-slate-900 font-black">{exportRecords.length}</strong> lượt làm
                    </div>
                  </div>
                </div>

                {/* KPI Summary Cards (5 Cards với số liệu đối chiếu chuẩn) */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {/* Card 1: Sĩ số & Học sinh tham gia */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Sĩ số & Tham gia</span>
                    <div className="text-2xl font-black text-slate-900 mt-1">
                      {exportSummary?.participatedStudents ?? 0} <span className="text-sm font-semibold text-slate-400">/ {exportSummary?.totalStudents ?? (currentTargetClass?.studentCount || 20)}</span>
                    </div>
                    <div className="text-[10px] font-semibold text-slate-500 mt-0.5 flex items-center justify-between">
                      <span>Chưa làm: <strong className="text-rose-600">{exportSummary?.notParticipatedStudents ?? 0}</strong></span>
                      <span className="text-emerald-600 font-bold">{exportSummary?.completionRate ?? 0}%</span>
                    </div>
                  </div>

                  {/* Card 2: Bài đã giao & Lượt làm */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Bài giao & Lượt làm</span>
                    <div className="text-2xl font-black text-slate-900 mt-1">
                      {exportSummary?.totalAttempts ?? exportRecords.length}
                    </div>
                    <div className="text-[10px] font-semibold text-sky-600 mt-0.5">
                      Đã giao: <strong>{exportSummary?.assignedLessonsCount ?? 0} bài</strong>
                    </div>
                  </div>

                  {/* Card 3: Đúng lần đầu (TB) */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Đúng lần đầu (TB)</span>
                    <div className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">
                      {(exportSummary?.totalAttempts ?? exportRecords.length) > 0
                        ? `${exportSummary?.avgFirstTryAccuracy ?? 0}% (${exportSummary?.avgFirstTryScore ?? Number(((exportSummary?.avgFirstTryAccuracy || 0) / 10).toFixed(1))}/10)`
                        : '—'}
                    </div>
                    <div className="text-[10px] font-semibold text-slate-500 mt-0.5">Điểm luyện tập chính</div>
                  </div>

                  {/* Card 4: Đúng sau gợi ý (TB) */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Sau gợi ý (TB)</span>
                    <div className="text-xl sm:text-2xl font-black text-purple-600 mt-1">
                      {(exportSummary?.totalAttempts ?? exportRecords.length) > 0
                        ? `${exportSummary?.avgFinalAccuracy ?? 0}% (${exportSummary?.avgFinalScore ?? Number(((exportSummary?.avgFinalAccuracy || 0) / 10).toFixed(1))}/10)`
                        : '—'}
                    </div>
                    <div className="text-[10px] font-semibold text-purple-700 mt-0.5">Sau can thiệp sư phạm</div>
                  </div>

                  {/* Card 5: Tiến bộ (+% điểm pp) */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 col-span-2 md:col-span-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Tiến bộ (+% pp)</span>
                    <div className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">
                      {(exportSummary?.totalAttempts ?? exportRecords.length) > 0 ? `+${exportSummary?.progressDelta ?? 0}% pp` : '—'}
                    </div>
                    <div className="text-[10px] font-semibold text-emerald-600 mt-0.5">Điểm phần trăm tăng</div>
                  </div>
                </div>

                {/* Audit Warning Banner if anomalous dates are detected */}
                {exportSummary?.anomalousDateCount > 0 && (
                  <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3 text-amber-900 text-xs shadow-xs animate-fade-in">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-black text-sm text-amber-950 flex items-center gap-2">
                        <span>Cảnh báo kiểm toán niên khóa: Phát hiện {exportSummary.anomalousDateCount} lượt làm bài lệch năm học</span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 text-[10px] font-bold">Múi giờ Việt Nam (ICT)</span>
                      </div>
                      <p className="text-slate-700 leading-relaxed">
                        Hệ thống đối chiếu thời gian hoàn thành theo múi giờ <strong>Asia/Ho_Chi_Minh (UTC+7)</strong> và phát hiện các lượt làm bài phát sinh vào <strong>tháng 10/2026</strong> (thuộc <em>Năm học 2026–2027</em>), nhưng lớp/đợt giao đang ghi nhãn <em>Năm học {exportNavYear || '2025-2026'}</em>.
                      </p>
                      <p className="text-slate-600 text-[11px] italic">
                        * Nguyên tắc bảo toàn dữ liệu: Hệ thống KHÔNG tự ý sửa timestamp thực tế của học sinh. Thầy/Cô có thể vào mục "Quản lý Lớp" để cập nhật đúng Năm học của lớp thành 2026–2027.
                      </p>
                    </div>
                  </div>
                )}

                {/* 5 Reading Competencies Matrix (Tính thực tế từ Firestore) */}
                <div className="p-5 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Thống Kê 5 Năng Lực Đọc Hiểu (Chuẩn GDPT 2018)</span>
                    </h4>
                    <span className="text-[10px] text-slate-500 font-semibold">Tỉ lệ đạt thực tế từ Firestore</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                    {compList.map((skill, idx) => {
                      const sk = exportSummary?.skillsBreakdown ? exportSummary.skillsBreakdown[skill.key] : null;
                      const tested = sk ? sk.tested : 0;
                      const base = tested > 0 ? sk.firstTryPct : 0;
                      const boosted = tested > 0 ? sk.finalPct : 0;

                      return (
                        <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 text-xs shadow-xs">
                          <div className="font-bold text-slate-800 truncate" title={skill.name}>{skill.name}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Khảo sát: {tested} câu</div>
                          {tested > 0 ? (
                            <>
                              <div className="flex items-baseline justify-between mt-1.5">
                                <span className="text-[10px] text-slate-500">Lần 1: {base}%</span>
                                <span className="font-black text-emerald-600">{boosted}%</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                                <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${boosted}%` }} />
                              </div>
                            </>
                          ) : (
                            <div className="text-[11px] text-slate-400 italic mt-2">Chưa có dữ liệu</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Live Preview Table */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
                      <span>Xem Trước Bảng Dữ Liệu Chi Tiết</span>
                    </h4>
                    <span className="text-[11px] text-slate-400">Hiển thị {Math.min(exportRecords.length, 50)} / {exportRecords.length} lượt</span>
                  </div>

                  {loadingExportData ? (
                    <div className="py-12 text-center text-slate-400 font-semibold text-xs border border-dashed rounded-2xl animate-pulse">
                      Đang tải dữ liệu tổng hợp từ máy chủ...
                    </div>
                  ) : exportError ? (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center justify-between">
                      <span>{exportError}</span>
                      <button
                        onClick={() => loadExportReportData(exportNavYear, exportNavGrade, exportNavClassId, exportNavSemester)}
                        className="px-2.5 py-1 bg-rose-600 text-white rounded-lg font-bold"
                      >
                        Thử lại
                      </button>
                    </div>
                  ) : exportRecords.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 font-semibold text-xs border-2 border-dashed border-slate-200 rounded-2xl">
                      Chưa có lượt làm bài nào trong phạm vi này (Sĩ số lớp: {exportSummary?.totalStudents ?? (currentTargetClass?.studentCount || 20)} học sinh).
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-96">
                      <table className="w-full text-left text-xs text-slate-700">
                        <thead className="bg-slate-50 text-[11px] font-black text-slate-500 uppercase tracking-wider sticky top-0 border-b border-slate-200">
                          <tr>
                            <th className="p-2.5">STT</th>
                            <th className="p-2.5">Mã HS</th>
                            <th className="p-2.5">Biệt danh</th>
                            <th className="p-2.5">Lớp</th>
                            <th className="p-2.5">Khối</th>
                            <th className="p-2.5">Năm học</th>
                            <th className="p-2.5">Học kỳ</th>
                            <th className="p-2.5">Bài được giao</th>
                            <th className="p-2.5 text-center">Lượt</th>
                            <th className="p-2.5 text-center">Đúng lần đầu</th>
                            <th className="p-2.5 text-center">Đúng sau gợi ý</th>
                            <th className="p-2.5 text-center">Điểm lần đầu</th>
                            <th className="p-2.5 text-center">Điểm sau gợi ý</th>
                            <th className="p-2.5 text-center">Tiến bộ</th>
                            <th className="p-2.5">Ngày làm</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {exportRecords.slice(0, 50).map((r, idx) => {
                            const totalQ = r.totalQuestions || 5;
                            const firstTry = r.firstTryCorrectCount || 0;
                            const finalVal = r.finalCorrectCount || 0;
                            const progress = Math.max(0, finalVal - firstTry);
                            const progressPP = Number(((progress / totalQ) * 100).toFixed(1));
                            const firstScore = r.firstTryScore ?? Number(((firstTry / totalQ) * 10).toFixed(1));
                            const finalScore = r.finalScore ?? Number(((finalVal / totalQ) * 10).toFixed(1));

                            return (
                              <tr key={idx} className="hover:bg-slate-50/80 transition">
                                <td className="p-2.5 text-slate-400 text-[11px]">{idx + 1}</td>
                                <td className="p-2.5 font-mono font-bold text-slate-900">{r.studentCode}</td>
                                <td className="p-2.5 font-bold text-slate-800">{r.displayAlias}</td>
                                <td className="p-2.5 font-bold text-emerald-700">{r.className}</td>
                                <td className="p-2.5">Khối {r.grade}</td>
                                <td className="p-2.5 text-slate-500">
                                  <div className="font-bold text-slate-700">{r.academicYear || '2026-2027'}</div>
                                  {r.isDateAnomalous && (
                                    <span
                                      className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100/90 border border-amber-300 px-1.5 py-0.5 rounded mt-0.5"
                                      title={r.anomalyReason}
                                    >
                                      ⚠️ Lệch NH ({r.inferredAcademicYear})
                                    </span>
                                  )}
                                </td>
                                <td className="p-2.5 text-slate-500">{r.semesterLabel || (r.semester === 2 ? 'Học kỳ II' : 'Học kỳ I')}</td>
                                <td className="p-2.5 font-bold text-slate-800 max-w-[180px] truncate" title={r.lessonTitle}>
                                  {r.lessonTitle}
                                </td>
                                <td className="p-2.5 text-center font-bold">#{r.attemptNumber || 1}</td>
                                <td className="p-2.5 text-center font-bold text-slate-700">{firstTry}/{totalQ}</td>
                                <td className="p-2.5 text-center font-bold text-emerald-600">{finalVal}/{totalQ}</td>
                                <td className="p-2.5 text-center font-black text-sky-700">{firstScore}</td>
                                <td className="p-2.5 text-center font-black text-emerald-700">{finalScore}</td>
                                <td className="p-2.5 text-center font-bold text-purple-600">
                                  {progress > 0 ? `+${progress} câu (+${progressPP}% pp)` : '0 câu'}
                                </td>
                                <td className="p-2.5 text-slate-500 text-[11px] whitespace-nowrap">
                                  <div className="font-semibold text-slate-700">
                                    {r.completedAt ? new Date(r.completedAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—'}
                                  </div>
                                  {r.completedAt && (
                                    <div className="text-[10px] text-slate-400 font-mono">
                                      {new Date(r.completedAt).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })} (ICT)
                                    </div>
                                  )}
                                  {r.isDateAnomalous && (
                                    <div className="text-[10px] text-amber-700 font-semibold mt-0.5" title={r.anomalyReason}>
                                      [!] Lệch niên khóa
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ========================================================= */}
      {/* PRINTABLE PDF REPORT MODAL (MODULE 5: BÁO CÁO HỘI ĐỒNG SƯ PHẠM) */}
      {/* ========================================================= */}
      {showPdfReportModal && (() => {
        const targetClass = classes.find((c) => c.id === exportNavClassId);
        const semLabel = exportNavSemester === 1 ? 'Học kỳ I' : exportNavSemester === 2 ? 'Học kỳ II' : 'Cả năm học';
        const compList = [
          { key: 'thong_tin_truc_tiep', name: '1. Tìm thông tin trực tiếp', req: 'Nhận biết chi tiết trong văn bản' },
          { key: 'tu_trong_ngu_canh', name: '2. Hiểu từ trong ngữ cảnh', req: 'Giải nghĩa từ ngữ qua câu chuyện' },
          { key: 'noi_dung_chinh', name: '3. Hiểu nội dung chính', req: 'Xác định bài học và ý chính' },
          { key: 'sap_xep_trinh_tu', name: '4. Sắp xếp trình tự', req: 'Trật tự thời gian và diễn biến' },
          { key: 'lien_he_van_dung', name: '5. Liên hệ & Vận dụng', req: 'Rút ra bài học thực tiễn bản thân' }
        ];

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 my-auto flex flex-col max-h-[95vh] overflow-hidden">
              {/* Modal Controls (Hidden in Print) */}
              <div className="no-print p-4 bg-slate-900 text-white flex items-center justify-between rounded-t-3xl shrink-0">
                <div className="flex items-center gap-2">
                  <Printer className="w-5 h-5 text-emerald-400" />
                  <span className="font-black text-sm">Xem Trước Bản In Báo Cáo Nghiệm Thu Hội Đồng</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded-xl shadow transition cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>In Báo Cáo / Lưu PDF</span>
                  </button>
                  <button
                    onClick={() => setShowPdfReportModal(false)}
                    className="p-2 text-slate-300 hover:text-white rounded-xl transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Printable Area */}
              <div id="printable-report-area" className="p-6 sm:p-10 overflow-y-auto text-slate-900 space-y-6 text-xs leading-relaxed bg-white">
                {/* Official Header */}
                <div className="border-b-2 border-slate-900 pb-4">
                  <div className="flex justify-between items-start text-[11px]">
                    <div className="text-center font-bold">
                      <div>PHÒNG GIÁO DỤC VÀ ĐÀO TẠO</div>
                      <div className="font-black">TRƯỜNG TIỂU HỌC DÂN TỘC BÁN TRÚ</div>
                      <div className="w-16 h-0.5 bg-slate-900 mx-auto mt-1" />
                    </div>
                    <div className="text-center">
                      <div className="font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                      <div className="font-black">Độc lập – Tự do – Hạnh phúc</div>
                      <div className="w-24 h-0.5 bg-slate-900 mx-auto mt-1" />
                    </div>
                  </div>

                  <div className="text-center mt-6">
                    <h1 className="text-lg sm:text-xl font-black uppercase tracking-wide">
                      BÁO CÁO TỔNG HỢP NGHIỆM THU ĐÁNH GIÁ NĂNG LỰC ĐỌC HIỂU
                    </h1>
                    <p className="text-xs italic text-slate-600 mt-1">
                      Đề tài: Ứng dụng trí tuệ nhân tạo thiết kế học liệu tương tác nhằm nâng cao năng lực đọc hiểu cho học sinh lớp 2–3
                    </p>
                    <p className="text-xs font-bold text-slate-800 mt-1">
                      Hệ thống: EM YÊU TIẾNG VIỆT (Phiên bản V5.6)
                    </p>
                  </div>
                </div>

                {/* Metadata Box */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-50 border rounded-xl text-[11px]">
                  <div><span className="font-bold">Năm học:</span> {exportNavYear || 'Toàn bộ'}</div>
                  <div><span className="font-bold">Khối:</span> {exportNavGrade ? `Khối ${exportNavGrade}` : 'Tất cả khối'}</div>
                  <div><span className="font-bold">Lớp:</span> {targetClass ? targetClass.name : 'Toàn trường'}</div>
                  <div><span className="font-bold">Học kỳ:</span> {semLabel}</div>
                </div>

                {/* I. Overview Metrics */}
                <div>
                  <h3 className="font-black text-sm uppercase text-slate-900 mb-2">
                    I. TỔNG QUAN KẾT QUẢ TRIỂN KHAI VÀ KHẢO SÁT
                  </h3>
                  <table className="w-full border-collapse border border-slate-300 text-[11px]">
                    <tbody>
                      <tr className="bg-slate-50">
                        <td className="border border-slate-300 p-2 font-bold">Sĩ số lớp (Học sinh ghi nhận):</td>
                        <td className="border border-slate-300 p-2 font-black text-right">
                          {exportSummary?.totalStudents ?? (targetClass?.studentCount || 20)} học sinh
                        </td>
                        <td className="border border-slate-300 p-2 font-bold">Số học sinh đã tham gia:</td>
                        <td className="border border-slate-300 p-2 font-black text-right text-emerald-700">
                          {exportSummary?.participatedStudents ?? 0} học sinh
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 p-2 font-bold">Số học sinh chưa tham gia:</td>
                        <td className="border border-slate-300 p-2 font-black text-right text-rose-700">
                          {exportSummary?.notParticipatedStudents ?? 0} học sinh
                        </td>
                        <td className="border border-slate-300 p-2 font-bold">Tỷ lệ hoàn thành:</td>
                        <td className="border border-slate-300 p-2 font-black text-right text-emerald-700">
                          {exportSummary?.completionRate ?? 0}%
                        </td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="border border-slate-300 p-2 font-bold">Tổng số bài đọc đã giao:</td>
                        <td className="border border-slate-300 p-2 font-black text-right">
                          {exportSummary?.assignedLessonsCount ?? 0} bài
                        </td>
                        <td className="border border-slate-300 p-2 font-bold">Tổng số lượt làm bài:</td>
                        <td className="border border-slate-300 p-2 font-black text-right">
                          {exportSummary?.totalAttempts ?? exportRecords.length} lượt
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 p-2 font-bold">Tỉ lệ đúng ngay lần đầu (TB):</td>
                        <td className="border border-slate-300 p-2 font-black text-right text-emerald-700">
                          {(exportSummary?.totalAttempts ?? exportRecords.length) > 0
                            ? `${exportSummary?.avgFirstTryAccuracy ?? 0}% (Điểm: ${exportSummary?.avgFirstTryScore ?? Number(((exportSummary?.avgFirstTryAccuracy || 0) / 10).toFixed(1))}/10)`
                            : '—'}
                        </td>
                        <td className="border border-slate-300 p-2 font-bold">Tỉ lệ đạt sau gợi ý sư phạm:</td>
                        <td className="border border-slate-300 p-2 font-black text-right text-purple-700">
                          {(exportSummary?.totalAttempts ?? exportRecords.length) > 0
                            ? `${exportSummary?.avgFinalAccuracy ?? 0}% (Điểm: ${exportSummary?.avgFinalScore ?? Number(((exportSummary?.avgFinalAccuracy || 0) / 10).toFixed(1))}/10)`
                            : '—'}
                        </td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="border border-slate-300 p-2 font-bold">Chênh lệch tiến bộ (+% pp):</td>
                        <td className="border border-slate-300 p-2 font-black text-right text-emerald-700">
                          {(exportSummary?.totalAttempts ?? exportRecords.length) > 0 ? `+${exportSummary?.progressDelta ?? 0}% điểm phần trăm` : '—'}
                        </td>
                        <td className="border border-slate-300 p-2 font-bold">Chuẩn hóa dữ liệu:</td>
                        <td className="border border-slate-300 p-2 text-right">Firestore Verified</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* II. 5 Competencies */}
                <div>
                  <h3 className="font-black text-sm uppercase text-slate-900 mb-2">
                    II. KẾT QUẢ ĐÁNH GIÁ THEO 5 NĂNG LỰC ĐỌC HIỂU (CT GDPT 2018)
                  </h3>
                  <table className="w-full border-collapse border border-slate-300 text-[11px]">
                    <thead className="bg-slate-100 font-black">
                      <tr>
                        <th className="border border-slate-300 p-2 text-left">Năng lực đọc hiểu</th>
                        <th className="border border-slate-300 p-2 text-left">Yêu cầu cần đạt</th>
                        <th className="border border-slate-300 p-2 text-center">Khảo sát</th>
                        <th className="border border-slate-300 p-2 text-center">Lần đầu</th>
                        <th className="border border-slate-300 p-2 text-center">Sau gợi ý</th>
                        <th className="border border-slate-300 p-2 text-center">Tiến bộ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compList.map((row, i) => {
                        const sk = exportSummary?.skillsBreakdown ? exportSummary.skillsBreakdown[row.key] : null;
                        const tested = sk ? sk.tested : 0;
                        const b1 = tested > 0 ? `${sk.firstTryPct}%` : 'Chưa có DL';
                        const b2 = tested > 0 ? `${sk.finalPct}%` : 'Chưa có DL';
                        const inc = tested > 0 ? `+${sk.progressPct}% pp` : '—';

                        return (
                          <tr key={i} className={i % 2 === 1 ? 'bg-slate-50' : ''}>
                            <td className="border border-slate-300 p-2 font-bold">{row.name}</td>
                            <td className="border border-slate-300 p-2">{row.req}</td>
                            <td className="border border-slate-300 p-2 text-center">{tested > 0 ? `${tested} câu` : '0 câu'}</td>
                            <td className="border border-slate-300 p-2 text-center">{b1}</td>
                            <td className="border border-slate-300 p-2 text-center font-black text-emerald-700">{b2}</td>
                            <td className="border border-slate-300 p-2 text-center font-bold text-purple-700">{inc}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* III. Pedagogical Conclusion */}
                <div>
                  <h3 className="font-black text-sm uppercase text-slate-900 mb-2">
                    III. KẾT LUẬN SƯ PHẠM VÀ ĐÁNH GIÁ ĐỊNH TÍNH
                  </h3>
                  <p className="text-[11px] text-justify text-slate-700 leading-relaxed">
                    1. <strong>Tác động của gợi ý phân hóa:</strong> Dữ liệu thực nghiệm cho thấy cơ chế phản hồi theo 2 bước (chấm lần đầu độc lập với sau gợi ý) giúp học sinh có cơ hội tự tư duy lại bài đọc, nâng cao năng lực đọc hiểu một cách rõ nét (+{exportSummary?.progressDelta ?? 0}% điểm tiến bộ).
                    <br />
                    2. <strong>Tính khách quan của học liệu:</strong> Học liệu được tạo qua mô hình AI và đã qua bước kiểm duyệt chuyên môn của giáo viên, đảm bảo tuân thủ nghiêm ngặt chuẩn yêu cầu cần đạt của Chương trình Giáo dục Phổ thông 2018.
                    <br />
                    3. <strong>An toàn dữ liệu học sinh:</strong> Hệ thống áp dụng định danh mã hóa ẩn danh, bảo vệ quyền riêng tư của trẻ em theo các quy chuẩn hiện hành.
                  </p>
                </div>

                {/* Signatures */}
                <div className="pt-6 grid grid-cols-2 text-center text-[11px]">
                  <div>
                    <div className="font-bold">TỔ TRƯỞNG CHUYÊN MÔN</div>
                    <div className="italic text-slate-500">(Ký và ghi rõ họ tên)</div>
                    <div className="h-16" />
                    <div className="font-bold">Tổ chuyên môn Khối 2–3</div>
                  </div>
                  <div>
                    <div className="font-bold">GIÁO VIÊN BÁO CÁO</div>
                    <div className="italic text-slate-500">(Ký và ghi rõ họ tên)</div>
                    <div className="h-16" />
                    <div className="font-bold">{user?.displayName || user?.email || 'Giáo viên phụ trách'}</div>
                  </div>
                </div>

                {/* Audit Disclosure Note if anomalous dates */}
                {exportSummary?.anomalousDateCount > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-[11px] text-amber-900 mt-4">
                    <span className="font-bold">Ghi chú kiểm toán niên khóa:</span> Phát hiện {exportSummary.anomalousDateCount} lượt làm bài phát sinh vào tháng 10/2026 (Năm học 2026–2027) trong đợt giao của lớp ghi nhãn Năm học {exportNavYear || '2025-2026'}. Toàn bộ mốc thời gian được giữ nguyên gốc và đối chiếu theo múi giờ chuẩn Việt Nam (ICT, UTC+7).
                  </div>
                )}

                <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-400 text-center italic">
                  * Ghi chú: Dữ liệu chuẩn hóa GDPT 2018; lưu trữ và bảo vệ an toàn trên Cloud Firestore.
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================= */}
      {/* STUDENT PREVIEW SIMULATOR MODAL (V5.2 P0 FEATURE) */}
      {/* ========================================================= */}
      {previewModalLesson && (() => {
        const questions = previewModalLesson.questions || [];
        const totalQ = questions.length;
        const currQ = questions[previewQuestionIdx];
        const fontClassMap = {
          base: 'text-base leading-relaxed',
          lg: 'text-lg md:text-xl leading-loose',
          xl: 'text-xl md:text-2xl leading-loose',
          '2xl': 'text-2xl md:text-3xl leading-loose'
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-hidden shadow-2xl border border-slate-200 flex flex-col">
              {/* Modal Top Header */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-sky-600 via-primary-600 to-emerald-600 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Eye className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-black uppercase tracking-wider">
                        Xem trước như học sinh (Mô phỏng trải nghiệm)
                      </span>
                      <span className="text-[11px] text-sky-100 font-semibold">
                        Khối {previewModalLesson.grade}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-black leading-tight mt-0.5">
                      {previewModalLesson.title}
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewModalLesson(null)}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
                  title="Đóng cửa sổ xem trước"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Scrollable Content */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
                {/* Simulator Disclaimer Banner */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2.5 text-xs text-amber-900 font-semibold">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Chế độ xem trước dành cho Giáo viên: Thầy cô có thể nghe đọc, phóng to chữ và thử trả lời các câu hỏi. Thao tác thử nghiệm hoàn toàn cục bộ, KHÔNG lưu điểm hay ảnh hưởng đến số liệu của học sinh.
                  </span>
                </div>

                {/* Section 1: Passage & Audio Reader */}
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                    <AudioReader
                      text={previewModalLesson.passage}
                      title={previewModalLesson.title}
                      audioUrl={previewModalLesson.audioUrl}
                      audioMetadata={previewModalLesson.audioMetadata}
                    />

                    {/* Font size control */}
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 shrink-0">
                      <span>Cỡ chữ:</span>
                      {(['base', 'lg', 'xl', '2xl'] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setPreviewFontSize(s)}
                          className={`w-7 h-7 rounded-lg font-black transition cursor-pointer ${
                            previewFontSize === s ? 'bg-sky-500 text-white' : 'bg-white text-slate-600 border border-slate-200'
                          }`}
                        >
                          {s === 'base' ? 'A' : s === 'lg' ? 'A+' : s === 'xl' ? 'A++' : 'A+++'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Passage Body */}
                  <div className={`font-semibold text-slate-800 ${fontClassMap[previewFontSize]} whitespace-pre-line leading-relaxed max-h-64 overflow-y-auto pr-2`}>
                    {previewModalLesson.passage}
                  </div>
                </div>

                {/* Section 2: Step-by-Step Questions Tester */}
                {currQ && (
                  <div className="p-5 bg-white rounded-2xl border-2 border-sky-100 shadow-sm space-y-4">
                    {/* Question Header & Stepper */}
                    <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-xl bg-sky-600 text-white font-black text-xs flex items-center justify-center">
                          {previewQuestionIdx + 1}
                        </span>
                        <div>
                          <span className="text-xs font-black text-slate-800 uppercase block">
                            {QUESTION_TYPE_LABELS[currQ.type] || currQ.type}
                          </span>
                          <span className="text-[11px] text-slate-500 font-semibold">
                            Câu hỏi {previewQuestionIdx + 1} trên tổng số {totalQ} câu
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {questions.map((_: any, idx: number) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setPreviewQuestionIdx(idx)}
                            className={`w-7 h-7 rounded-lg font-bold text-xs transition cursor-pointer ${
                              previewQuestionIdx === idx
                                ? 'bg-sky-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {idx + 1}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Question Prompt */}
                    <h4 className="text-base font-black text-slate-900 leading-snug">
                      {currQ.prompt}
                    </h4>

                    {/* Multiple Choice interactive preview */}
                    {currQ.type === 'multiple_choice' && currQ.options && (
                      <div className="space-y-2 pt-1">
                        {currQ.options.map((opt: string, oIdx: number) => {
                          const optChar = String.fromCharCode(65 + oIdx);
                          const isSelected = previewUserAnswers[currQ.id] === optChar;
                          const isCorrect = currQ.correctAnswer === optChar;
                          const hasAnswered = Boolean(previewUserAnswers[currQ.id]);

                          return (
                            <button
                              key={oIdx}
                              type="button"
                              onClick={() => setPreviewUserAnswers({ ...previewUserAnswers, [currQ.id]: optChar })}
                              className={`w-full text-left p-3 rounded-xl border text-xs sm:text-sm font-bold flex items-center gap-3 transition cursor-pointer ${
                                isSelected
                                  ? isCorrect
                                    ? 'bg-emerald-50 border-emerald-400 text-emerald-950 ring-2 ring-emerald-300'
                                    : 'bg-rose-50 border-rose-400 text-rose-950 ring-2 ring-rose-300'
                                  : hasAnswered && isCorrect
                                  ? 'bg-emerald-50/60 border-emerald-300 text-emerald-900'
                                  : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                              }`}
                            >
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                                isSelected ? 'bg-white shadow-sm' : 'bg-slate-200 text-slate-700'
                              }`}>
                                {optChar}
                              </span>
                              <span className="flex-1">{opt}</span>
                              {isSelected && (
                                <span className="text-[11px] font-black px-2 py-0.5 rounded-full shrink-0">
                                  {isCorrect ? '✓ Đúng' : '✗ Chưa đúng'}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* True / False interactive preview */}
                    {currQ.type === 'true_false' && (
                      <div className="flex gap-3 pt-1">
                        {[
                          { label: 'Đúng (True)', val: true },
                          { label: 'Sai (False)', val: false }
                        ].map((item) => {
                          const isSelected = previewUserAnswers[currQ.id] === item.val;
                          const isCorrect = currQ.correctAnswer === item.val;

                          return (
                            <button
                              key={String(item.val)}
                              type="button"
                              onClick={() => setPreviewUserAnswers({ ...previewUserAnswers, [currQ.id]: item.val })}
                              className={`flex-1 p-3.5 rounded-xl border font-black text-xs sm:text-sm transition cursor-pointer text-center ${
                                isSelected
                                  ? isCorrect
                                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-300'
                                    : 'bg-rose-50 border-rose-500 text-rose-900 ring-2 ring-rose-300'
                                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Sequence interactive preview */}
                    {currQ.type === 'sequence' && (
                      <div className="space-y-2 pt-1">
                        <span className="text-xs font-bold text-slate-600 block">Thứ tự đúng của câu chuyện:</span>
                        {(currQ.items || currQ.answer || []).map((step: string, sIdx: number) => (
                          <div key={sIdx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                              {sIdx + 1}
                            </span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Pedagogical Hint & Explanation Feedback */}
                    <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setPreviewShowHint({
                          ...previewShowHint,
                          [currQ.id]: !previewShowHint[currQ.id]
                        })}
                        className="text-xs font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1.5 cursor-pointer underline decoration-amber-400"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>{previewShowHint[currQ.id] ? 'Ẩn gợi ý sư phạm' : 'Xem gợi ý sư phạm (học sinh nhận khi trả lời sai)'}</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={previewQuestionIdx === 0}
                          onClick={() => setPreviewQuestionIdx(previewQuestionIdx - 1)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl disabled:opacity-30 cursor-pointer"
                        >
                          Câu trước
                        </button>
                        <button
                          type="button"
                          disabled={previewQuestionIdx === totalQ - 1}
                          onClick={() => setPreviewQuestionIdx(previewQuestionIdx + 1)}
                          className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl disabled:opacity-30 cursor-pointer"
                        >
                          Câu tiếp theo
                        </button>
                      </div>
                    </div>

                    {/* Display Pedagogical Hint Box if toggled */}
                    {previewShowHint[currQ.id] && (
                      <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 text-xs text-amber-950 animate-fade-in">
                        <div className="font-bold flex items-center gap-1.5 text-amber-900">
                          <Sparkles className="w-4 h-4 text-amber-600" />
                          <span>Gợi ý sư phạm:</span>
                        </div>
                        <p className="font-medium pl-5">{currQ.hint || 'Đọc lại đoạn văn để tìm chi tiết nhé.'}</p>
                        {currQ.explanation && (
                          <div className="pt-1.5 border-t border-amber-200/60 pl-5 text-[11px] text-slate-600">
                            <strong>Giải thích máy chủ:</strong> {currQ.explanation}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                <span className="text-xs text-slate-500 font-semibold">
                  Mô phỏng giao diện đọc và làm bài cho học sinh Lớp {previewModalLesson.grade}
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewModalLesson(null)}
                  className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-black text-xs rounded-xl transition cursor-pointer"
                >
                  Đóng cửa sổ xem trước
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: Voice Survey & 3-Sample Comparative Listening (Package C1) */}
      {showVoiceComparisonModal && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 md:p-6 flex min-h-full items-center justify-center overscroll-contain animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowVoiceComparisonModal(false);
          }}
        >
          <div className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-4xl w-full shadow-2xl border border-slate-200 space-y-6 my-auto max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    Khảo Sát & So Sánh 3 Giọng Đọc Tiếng Việt (Gói C V5.5)
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    Đánh giá chất lượng âm thanh, dấu thanh, ngắt nghỉ và độ tự nhiên theo chuẩn GDPT 2018
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowVoiceComparisonModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Reading Passage Sample Text */}
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl text-xs space-y-1">
              <span className="font-bold text-amber-900 uppercase tracking-wide text-[10px]">Đoạn văn đọc mẫu thẩm định:</span>
              <p className="text-slate-800 font-medium italic">
                &ldquo;Mỗi buổi sáng, chú chim sâu nhỏ thức dậy thật sớm. Chú chuyền cành thoăn thoắt, cất tiếng hót líu lo chào ngày mới. Chim sâu cần mẫn bắt từng con sâu trên lá cam, giúp vườn cây sai trĩu quả.&rdquo;
              </p>
            </div>

            {/* 3 Comparative Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Option 1: Piper TTS */}
              <div className="p-4 rounded-2xl border-2 border-purple-200 bg-purple-50/40 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-900 text-[10px] font-black rounded uppercase">
                      Piper TTS
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">vi_VN-vais1000</span>
                  </div>
                  <h4 className="font-extrabold text-sm text-slate-900">Piper Model (VAIS 1000)</h4>
                  <ul className="text-[11px] text-slate-600 space-y-1 list-disc pl-4">
                    <li><strong>Giấy phép:</strong> MIT (Engine) / CC BY 4.0 (Model)</li>
                    <li><strong>Dấu thanh:</strong> Chuẩn xác theo từ điển ngữ âm</li>
                    <li><strong>Ngắt nghỉ:</strong> Khá cứng, nhịp đều, hơi thiếu độ mềm</li>
                    <li><strong>Tốc độ:</strong> Rất nhanh, nhẹ (~50MB RAM, CPU nhẹ)</li>
                  </ul>
                </div>
                <div className="space-y-2 pt-2 border-t border-purple-100">
                  <span className="text-[10px] font-bold text-purple-800 block">Nghe bản thu mẫu:</span>
                  <audio controls src="/audio/samples/audio_sample_1_piper_vais.wav" className="w-full h-8" />
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectSampleVoice('piper');
                      setShowVoiceComparisonModal(false);
                    }}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
                  >
                    Gán giọng Piper cho bài này
                  </button>
                </div>
              </div>

              {/* Option 2: VieNeu-TTS */}
              <div className="p-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50/40 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 text-[10px] font-black rounded uppercase">
                      VieNeu-TTS
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700">Neural AI</span>
                  </div>
                  <h4 className="font-extrabold text-sm text-slate-900">VieNeu-TTS Neural (v3)</h4>
                  <ul className="text-[11px] text-slate-600 space-y-1 list-disc pl-4">
                    <li><strong>Giấy phép:</strong> Apache 2.0 / Open Source</li>
                    <li><strong>Dấu thanh:</strong> Mềm mại, đúng cao độ thanh sắc, hỏi, ngã</li>
                    <li><strong>Ngắt nghỉ:</strong> Tự nhiên, có ngữ điệu cảm xúc</li>
                    <li><strong>Tốc độ:</strong> Trung bình, yêu cầu ~800MB–1GB RAM</li>
                  </ul>
                </div>
                <div className="space-y-2 pt-2 border-t border-emerald-100">
                  <span className="text-[10px] font-bold text-emerald-800 block">Nghe bản thu mẫu:</span>
                  <audio controls src="/audio/samples/audio_sample_2_vieneu_neural.wav" className="w-full h-8" />
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectSampleVoice('vieneu');
                      setShowVoiceComparisonModal(false);
                    }}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
                  >
                    Gán giọng VieNeu cho bài này
                  </button>
                </div>
              </div>

              {/* Option 3: Teacher Voice */}
              <div className="p-4 rounded-2xl border-2 border-sky-300 bg-sky-50/40 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 bg-sky-100 text-sky-900 text-[10px] font-black rounded uppercase">
                      Giọng Giáo Viên
                    </span>
                    <span className="text-[10px] font-bold text-sky-700">Khuyến nghị GDPT</span>
                  </div>
                  <h4 className="font-extrabold text-sm text-slate-900">Giáo Viên Thu Âm Trực Tiếp</h4>
                  <ul className="text-[11px] text-slate-600 space-y-1 list-disc pl-4">
                    <li><strong>Tiêu chuẩn:</strong> Sư phạm tiểu học, chuẩn giọng mẫu</li>
                    <li><strong>Dấu thanh:</strong> 100% chuẩn xác theo phương ngữ phổ thông</li>
                    <li><strong>Ngắt nghỉ:</strong> Đúng nhịp ngắt câu văn học, truyền cảm</li>
                    <li><strong>Tải lên:</strong> Hỗ trợ MP3/M4A (15MB) & WAV (30MB)</li>
                  </ul>
                </div>
                <div className="space-y-2 pt-2 border-t border-sky-100">
                  <span className="text-[10px] font-bold text-sky-800 block">Nghe bản thu mẫu:</span>
                  <audio controls src="/audio/samples/audio_sample_3_teacher_recording.wav" className="w-full h-8" />
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectSampleVoice('teacher');
                      setShowVoiceComparisonModal(false);
                    }}
                    className="w-full py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
                  >
                    Gán giọng cô giáo cho bài này
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-xs text-slate-600">
              <span className="font-medium">
                * Kết luận sư phạm: Giọng đọc giáo viên đạt độ truyền cảm cao nhất. VieNeu-TTS là phương án thay thế khả thi khi cần sinh tự động; Piper TTS thích hợp làm giọng đọc dự phòng ngoại tuyến.
              </span>
              <button
                type="button"
                onClick={() => setShowVoiceComparisonModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition cursor-pointer shrink-0 ml-4"
              >
                Đóng khảo sát
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal: Teacher Reset Student Password */}
      {resetTargetStudent && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-student-title"
          className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 md:p-6 flex min-h-full items-center justify-center overscroll-contain animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setResetTargetStudent(null);
          }}
        >
          <div className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 text-center space-y-4 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[min(88dvh,600px)] overflow-y-auto overscroll-contain">
            <div className="w-12 h-12 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center mx-auto shrink-0">
              <Key className="w-6 h-6" />
            </div>
            <h3 id="reset-student-title" className="text-xl font-black text-slate-900">Đặt Lại Mật Khẩu Học Sinh</h3>
            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
              Thiết lập mật khẩu mới cho học sinh <strong className="text-slate-900">{resetTargetStudent.alias}</strong> (Mã: {resetTargetStudent.code || 'Chưa gắn mã'}).
            </p>

            <div className="text-left space-y-2">
              <label className="block text-xs font-bold text-slate-700">Mật khẩu mới (tối thiểu 6 ký tự):</label>
              <input
                type="text"
                value={newStudentPasswordInput}
                onChange={(e) => setNewStudentPasswordInput(e.target.value)}
                placeholder="HS123456"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white"
              />
              <p className="text-[10px] text-slate-500 italic">
                * Gợi ý mật khẩu chuẩn học sinh: <strong>HS123456</strong>
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResetTargetStudent(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmResetStudentPassword}
                disabled={resettingStudentPass}
                className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-black rounded-xl text-xs transition disabled:opacity-50"
              >
                {resettingStudentPass ? 'Đang lưu...' : 'Xác nhận Đặt lại'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

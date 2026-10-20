import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { functions } from '../firebase';
import { httpsCallable, createCallable } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import {
  AdminOverviewSummary,
  AcademicYearItem,
  AcademicYearBreakdown,
  CurriculumNode,
  CURRICULUM_GRADES,
  CurriculumGrade,
  BOOK_SERIES_LABELS,
  ACTIVITY_TYPE_LABELS
} from '@emytv/shared';
import {
  ShieldCheck,
  Users,
  GraduationCap,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  School,
  Lock,
  Unlock,
  Layers,
  LogOut,
  Calendar,
  Search,
  Filter,
  Check,
  Award,
  Download,
  Upload,
  Key,
  X,
  Plus,
  User,
  Edit3,
  Trash2,
  Archive,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Copy
} from 'lucide-react';
import { exportTeachersToExcel, parseAndAuditTeachersExcel } from '../utils/excelHelper';
import { ProfileModal } from '../components/ProfileModal';

export const AdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'overview' | 'teachers' | 'classes' | 'curriculum'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Data states
  const [overview, setOverview] = useState<AdminOverviewSummary | null>(null);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [curriculumNodes, setCurriculumNodes] = useState<CurriculumNode[]>([]);
  const [selectedCurriculumGrade, setSelectedCurriculumGrade] = useState<CurriculumGrade>(2);

  // Academic Years Management States
  const [academicYears, setAcademicYears] = useState<AcademicYearItem[]>([]);
  const [loadingAcademicYears, setLoadingAcademicYears] = useState(false);
  const [showCreateYearModal, setShowCreateYearModal] = useState(false);
  const [newYearCode, setNewYearCode] = useState('');
  const [newYearName, setNewYearName] = useState('');
  const [newYearDescription, setNewYearDescription] = useState('');
  const [newYearIsCurrent, setNewYearIsCurrent] = useState(false);
  const [creatingYear, setCreatingYear] = useState(false);

  const [editingYear, setEditingYear] = useState<AcademicYearItem | null>(null);
  const [editYearName, setEditYearName] = useState('');
  const [editYearDescription, setEditYearDescription] = useState('');
  const [editYearStatus, setEditYearStatus] = useState<'active' | 'archived'>('active');
  const [savingYearEdit, setSavingYearEdit] = useState(false);

  const [deleteYearTarget, setDeleteYearTarget] = useState<AcademicYearItem | null>(null);
  const [deletingYear, setDeletingYear] = useState(false);

  const [archiveYearTarget, setArchiveYearTarget] = useState<{ year: AcademicYearItem; newStatus: 'active' | 'archived' } | null>(null);
  const [archivingYear, setArchivingYear] = useState(false);

  const [settingCurrentYear, setSettingCurrentYear] = useState<string | null>(null);

  const fetchOverview = async () => {
    try {
      const getOverview = httpsCallable(functions, 'getAdminOverview');
      const res: any = await getOverview();
      setOverview(res.data);
    } catch (err: any) {
      console.error('Error fetching admin overview:', err);
      setError('Lỗi tải số liệu tổng quan: ' + err.message);
    }
  };

  const fetchTeachers = async () => {
    try {
      const listTeachersFn = httpsCallable(functions, 'listTeachers');
      const res: any = await listTeachersFn();
      setTeachers(res.data.teachers || []);
    } catch (err: any) {
      console.error('Error fetching teachers:', err);
    }
  };

  const fetchClasses = async () => {
    try {
      const listClassesFn = httpsCallable(functions, 'listAllClassesAdmin');
      const res: any = await listClassesFn();
      setClasses(res.data.classes || []);
    } catch (err: any) {
      console.error('Error fetching classes:', err);
    }
  };

  const fetchCurriculum = async (grade: CurriculumGrade) => {
    try {
      const getFrameworkFn = httpsCallable(functions, 'getCurriculumFramework');
      const res: any = await getFrameworkFn({ grade });
      setCurriculumNodes(res.data.nodes || []);
    } catch (err: any) {
      console.error('Error fetching curriculum:', err);
    }
  };

  const fetchAcademicYears = async () => {
    try {
      setLoadingAcademicYears(true);
      const listAyFn = httpsCallable(functions, 'listAcademicYears');
      const res: any = await listAyFn();
      const rawList = res.data?.academicYears || [];
      const normalized: AcademicYearItem[] = rawList.map((ay: any) => {
        if (typeof ay === 'string') {
          return {
            id: ay,
            code: ay,
            name: `Năm học ${ay}`,
            isCurrent: ay === (res.data?.currentAcademicYear || '2025-2026'),
            periodType: ay === '2026-2027' ? 'current' : ay > '2026-2027' ? 'future' : 'past',
            status: 'active',
            totalClasses: 0,
            activeClasses: 0,
            totalStudents: 0,
            canDelete: false,
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
        }
        const code = ay.code || ay.id || '2025-2026';
        return {
          id: ay.id || code,
          code,
          name: ay.name || `Năm học ${code}`,
          isCurrent: Boolean(ay.isCurrent),
          periodType: ay.periodType || 'past',
          status: ay.status || 'active',
          description: ay.description || '',
          startDate: ay.startDate || '',
          endDate: ay.endDate || '',
          totalClasses: typeof ay.totalClasses === 'number' ? ay.totalClasses : 0,
          activeClasses: typeof ay.activeClasses === 'number' ? ay.activeClasses : 0,
          totalStudents: typeof ay.totalStudents === 'number' ? ay.totalStudents : 0,
          canDelete: Boolean(ay.canDelete),
          createdAt: ay.createdAt || Date.now(),
          updatedAt: ay.updatedAt || Date.now()
        };
      });
      setAcademicYears(normalized);
    } catch (err: any) {
      console.error('Error fetching academic years:', err);
    } finally {
      setLoadingAcademicYears(false);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        fetchOverview(),
        fetchTeachers(),
        fetchClasses(),
        fetchCurriculum(selectedCurriculumGrade),
        fetchAcademicYears()
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    fetchCurriculum(selectedCurriculumGrade);
  }, [selectedCurriculumGrade]);

  const [showImportTeachersModal, setShowImportTeachersModal] = useState(false);
  const [importingTeachers, setImportingTeachers] = useState(false);
  const [teachersPreviewData, setTeachersPreviewData] = useState<any[]>([]);
  const [teachersImportErrors, setTeachersImportErrors] = useState<string[]>([]);
  const [importTeacherResults, setImportTeacherResults] = useState<any | null>(null);
  const [resetPasswordResult, setResetPasswordResult] = useState<{ displayName: string; email: string; resetLink?: string } | null>(null);

  // Profile & Teacher Password Reset Modals
  const [showAdminProfileModal, setShowAdminProfileModal] = useState(false);
  const [resetTargetTeacher, setResetTargetTeacher] = useState<any | null>(null);
  const [newTeacherPasswordInput, setNewTeacherPasswordInput] = useState('GV123456');
  const [isResettingPass, setIsResettingPass] = useState(false);

  // Search, Filter & Pagination States (Phase 3)
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');
  const [teacherStatusFilter, setTeacherStatusFilter] = useState<'all' | 'active' | 'pending_approval' | 'suspended' | 'archived' | 'test_isolated' | 'all_with_isolated'>('all');
  const [teacherPage, setTeacherPage] = useState(1);
  const [teacherPageSize, setTeacherPageSize] = useState(10);
  const [selectedTeacherUids, setSelectedTeacherUids] = useState<string[]>([]);

  // Teacher Edit Modal States
  const [editingTeacher, setEditingTeacher] = useState<any | null>(null);
  const [editingTeacherName, setEditingTeacherName] = useState('');
  const [editingTeacherPhone, setEditingTeacherPhone] = useState('');
  const [editingTeacherStatus, setEditingTeacherStatus] = useState<string>('active');
  const [savingTeacherEdit, setSavingTeacherEdit] = useState(false);

  // Teacher Deletion & Batch Action States
  const [deleteTeacherTarget, setDeleteTeacherTarget] = useState<any | null>(null);
  const [deleteTeacherHasDeps, setDeleteTeacherHasDeps] = useState(false);
  const [deleteTeacherDepInfo, setDeleteTeacherDepInfo] = useState<{ classCount: number; lessonCount: number } | null>(null);
  const [deletingTeacher, setDeletingTeacher] = useState(false);
  const [batchActionModal, setBatchActionModal] = useState<{ action: 'lock' | 'unlock' | 'archive' | 'delete'; count: number } | null>(null);
  const [isProcessingBatchTeachers, setIsProcessingBatchTeachers] = useState(false);

  const [classGradeFilter, setClassGradeFilter] = useState<'all' | 2 | 3>('all');
  const [classYearFilter, setClassYearFilter] = useState<string>('all');
  const [classStatusFilter, setClassStatusFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [classSearchQuery, setClassSearchQuery] = useState('');

  // Step-by-Step Hierarchical Navigation for Admin Classes (Module 3: NĂM HỌC -> KHỐI -> LỚP -> THÔNG TIN LỚP)
  const [adminNavYear, setAdminNavYear] = useState<string | null>(null);
  const [adminNavGrade, setAdminNavGrade] = useState<number | null>(null);
  const [selectedAdminClass, setSelectedAdminClass] = useState<any | null>(null);
  const [copiedClassCode, setCopiedClassCode] = useState(false);

  // Sync selected class with latest classes list
  useEffect(() => {
    if (selectedAdminClass) {
      const updated = classes.find((c) => c.id === selectedAdminClass.id);
      if (updated) {
        setSelectedAdminClass(updated);
      }
    }
  }, [classes]);

  const handleSelectAdminYear = (year: string) => {
    setAdminNavYear(year);
    setAdminNavGrade(null);
    setSelectedAdminClass(null);
  };

  const handleSelectAdminGrade = (grade: number) => {
    setAdminNavGrade(grade);
    setSelectedAdminClass(null);
  };

  const handleSelectAdminClass = (cls: any) => {
    setSelectedAdminClass(cls);
  };

  const handleBackToAdminYears = () => {
    setAdminNavYear(null);
    setAdminNavGrade(null);
    setSelectedAdminClass(null);
  };

  const handleBackToAdminGrades = () => {
    setAdminNavGrade(null);
    setSelectedAdminClass(null);
  };

  const handleBackToAdminClasses = () => {
    setSelectedAdminClass(null);
  };

  const handleCopyClassCode = (code: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedClassCode(true);
    setTimeout(() => setCopiedClassCode(false), 2000);
  };

  const [editingAdminClass, setEditingAdminClass] = useState<any | null>(null);
  const [adminEditClassName, setAdminEditClassName] = useState('');
  const [adminEditClassGrade, setAdminEditClassGrade] = useState<number>(2);
  const [adminEditClassAcademicYear, setAdminEditClassAcademicYear] = useState('2026-2027');
  const [adminEditClassCode, setAdminEditClassCode] = useState('');
  const [isSavingAdminClassEdit, setIsSavingAdminClassEdit] = useState(false);
  const [adminDeleteClassTarget, setAdminDeleteClassTarget] = useState<any | null>(null);
  const [adminDeleteClassBlockReason, setAdminDeleteClassBlockReason] = useState<string | null>(null);
  const [isDeletingAdminClass, setIsDeletingAdminClass] = useState(false);
  const [showAdminCreateClassModal, setShowAdminCreateClassModal] = useState(false);
  const [newAdminClassName, setNewAdminClassName] = useState('');
  const [newAdminClassGrade, setNewAdminClassGrade] = useState<number>(2);
  const [newAdminClassAcademicYear, setNewAdminClassAcademicYear] = useState('2026-2027');
  const [newAdminClassTeacherUid, setNewAdminClassTeacherUid] = useState('');
  const [isCreatingAdminClass, setIsCreatingAdminClass] = useState(false);

  const handleOpenAdminEditClass = (cls: any) => {
    setEditingAdminClass(cls);
    setAdminEditClassName(cls.name);
    setAdminEditClassGrade(cls.grade);
    setAdminEditClassAcademicYear(cls.academicYear || '2026-2027');
    setAdminEditClassCode(cls.classCode);
  };

  const handleSaveAdminClassEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdminClass || !adminEditClassName.trim()) return;
    setIsSavingAdminClassEdit(true);
    try {
      const updateFn = httpsCallable(functions, 'updateClassroom');
      const res: any = await updateFn({
        classId: editingAdminClass.id,
        name: adminEditClassName.trim(),
        grade: adminEditClassGrade,
        academicYear: adminEditClassAcademicYear.trim() || '2026-2027',
        classCode: adminEditClassCode.trim() || undefined
      });
      if (res.data?.success) {
        setActionSuccess(`Đã cập nhật thông tin lớp "${res.data.classroom.name}" (Năm học: ${res.data.classroom.academicYear}) thành công!`);
        if (selectedAdminClass?.id === editingAdminClass.id) {
          setSelectedAdminClass(res.data.classroom);
          if (adminNavYear && res.data.classroom.academicYear !== adminNavYear) {
            setAdminNavYear(res.data.classroom.academicYear);
          }
          if (adminNavGrade && res.data.classroom.grade !== adminNavGrade) {
            setAdminNavGrade(res.data.classroom.grade);
          }
        }
        setEditingAdminClass(null);
        await fetchClasses();
        await fetchOverview();
      }
    } catch (err: any) {
      setError('Lỗi cập nhật lớp: ' + (err.message || err));
    } finally {
      setIsSavingAdminClassEdit(false);
    }
  };

  const handleToggleAdminClassArchive = async (cls: any) => {
    const nextStatus = cls.status === 'archived' ? 'active' : 'archived';
    const actionText = nextStatus === 'archived' ? 'lưu trữ' : 'khôi phục';
    if (!window.confirm(`Bạn có chắc chắn muốn ${actionText} lớp "${cls.name}"?`)) return;
    try {
      const archiveFn = httpsCallable(functions, 'archiveClassroom');
      const res: any = await archiveFn({
        classId: cls.id,
        status: nextStatus
      });
      if (res.data?.success) {
        setActionSuccess(res.data.message || `Đã ${actionText} lớp "${cls.name}" thành công.`);
        if (selectedAdminClass?.id === cls.id) {
          setSelectedAdminClass({ ...selectedAdminClass, status: nextStatus });
        }
        await fetchClasses();
        await fetchOverview();
      }
    } catch (err: any) {
      setError(`Lỗi ${actionText} lớp: ` + (err.message || err));
    }
  };

  const handleAdminDeleteClassClick = async (cls: any) => {
    setAdminDeleteClassTarget(cls);
    if ((cls.studentCount && cls.studentCount > 0) || cls.hasAssignments) {
      setAdminDeleteClassBlockReason(
        `Không thể xóa vĩnh viễn lớp "${cls.name}" vì đang có ${cls.studentCount || 'nhiều'} học sinh hoặc bài đã giao. Để bảo vệ kết quả học tập của các em, vui lòng chuyển sang trạng thái "Lưu trữ".`
      );
    } else {
      setAdminDeleteClassBlockReason(null);
    }
  };

  const handleConfirmAdminDeleteClass = async () => {
    if (!adminDeleteClassTarget) return;
    setIsDeletingAdminClass(true);
    try {
      const deleteFn = httpsCallable(functions, 'deleteClassroom');
      const res: any = await deleteFn({ classId: adminDeleteClassTarget.id });
      if (res.data?.success) {
        setActionSuccess(res.data.message || `Đã xóa lớp "${adminDeleteClassTarget.name}" thành công!`);
        if (selectedAdminClass?.id === adminDeleteClassTarget.id) {
          setSelectedAdminClass(null);
        }
        setAdminDeleteClassTarget(null);
        await fetchClasses();
        await fetchOverview();
      }
    } catch (err: any) {
      setError('Không thể xóa lớp: ' + (err.message || err));
    } finally {
      setIsDeletingAdminClass(false);
    }
  };

  const handleAdminCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminClassName.trim()) return;
    setIsCreatingAdminClass(true);
    try {
      const createFn = httpsCallable(functions, 'createClassroom');
      const res: any = await createFn({
        name: newAdminClassName.trim(),
        grade: newAdminClassGrade,
        academicYear: newAdminClassAcademicYear.trim() || '2026-2027',
        teacherUid: newAdminClassTeacherUid.trim() || undefined
      });
      if (res.data?.success) {
        setActionSuccess(`Đã tạo lớp ${res.data.classroom.name} (Mã: ${res.data.classroom.classCode}) thành công!`);
        setShowAdminCreateClassModal(false);
        setNewAdminClassName('');
        await fetchClasses();
        await fetchOverview();
        await fetchAcademicYears();
      }
    } catch (err: any) {
      setError('Lỗi tạo lớp: ' + (err.message || err));
    } finally {
      setIsCreatingAdminClass(false);
    }
  };

  // Academic Year Action Handlers
  const handleCreateYear = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = newYearCode.trim();
    if (!/^\d{4}-\d{4}$/.test(code)) {
      alert('Mã năm học không hợp lệ. Vui lòng nhập theo định dạng YYYY-YYYY (ví dụ: 2028-2029).');
      return;
    }
    setCreatingYear(true);
    try {
      const createFn = httpsCallable(functions, 'createAcademicYear');
      await createFn({
        code,
        name: newYearName.trim() || `Năm học ${code}`,
        description: newYearDescription.trim(),
        isCurrent: newYearIsCurrent
      });
      setActionSuccess(`Đã tạo thành công năm học "${code}"!`);
      setShowCreateYearModal(false);
      setNewYearCode('');
      setNewYearName('');
      setNewYearDescription('');
      setNewYearIsCurrent(false);
      await Promise.all([fetchAcademicYears(), fetchOverview(), fetchClasses()]);
    } catch (err: any) {
      alert('Lỗi tạo năm học: ' + (err.message || 'Không xác định'));
    } finally {
      setCreatingYear(false);
    }
  };

  const handleUpdateYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingYear) return;
    setSavingYearEdit(true);
    try {
      const updateFn = httpsCallable(functions, 'updateAcademicYear');
      await updateFn({
        code: editingYear.code,
        name: editYearName.trim() || `Năm học ${editingYear.code}`,
        description: editYearDescription.trim(),
        status: editYearStatus
      });
      setActionSuccess(`Đã cập nhật thông tin năm học "${editingYear.code}"!`);
      setEditingYear(null);
      await Promise.all([fetchAcademicYears(), fetchOverview()]);
    } catch (err: any) {
      alert('Lỗi cập nhật năm học: ' + (err.message || 'Không xác định'));
    } finally {
      setSavingYearEdit(false);
    }
  };

  const handleSetCurrentYear = async (year: AcademicYearItem) => {
    if (year.isCurrent) return;
    const confirmChange = window.confirm(`Bạn có chắc chắn muốn đặt "${year.code}" làm năm học hiện tại của hệ thống?`);
    if (!confirmChange) return;

    setSettingCurrentYear(year.code);
    try {
      const setCurrentFn = httpsCallable(functions, 'setCurrentAcademicYear');
      await setCurrentFn({ code: year.code });
      setActionSuccess(`Đã đặt "${year.code}" làm năm học hiện tại!`);
      await Promise.all([fetchAcademicYears(), fetchOverview()]);
    } catch (err: any) {
      alert('Lỗi đặt năm học hiện tại: ' + (err.message || 'Không xác định'));
    } finally {
      setSettingCurrentYear(null);
    }
  };

  const handleToggleArchiveYear = async () => {
    if (!archiveYearTarget) return;
    setArchivingYear(true);
    try {
      const toggleFn = httpsCallable(functions, 'toggleArchiveAcademicYear');
      await toggleFn({ code: archiveYearTarget.year.code, status: archiveYearTarget.newStatus });
      setActionSuccess(
        archiveYearTarget.newStatus === 'archived'
          ? `Đã lưu trữ niên khóa "${archiveYearTarget.year.code}"!`
          : `Đã khôi phục niên khóa "${archiveYearTarget.year.code}"!`
      );
      setArchiveYearTarget(null);
      await Promise.all([fetchAcademicYears(), fetchOverview()]);
    } catch (err: any) {
      alert('Lỗi cập nhật trạng thái lưu trữ: ' + (err.message || 'Không xác định'));
    } finally {
      setArchivingYear(false);
    }
  };

  const handleDeleteYear = async () => {
    if (!deleteYearTarget) return;
    if (deleteYearTarget.totalClasses > 0) {
      alert(`Không thể xóa năm học ${deleteYearTarget.code} vì đang có ${deleteYearTarget.totalClasses} lớp học trực thuộc!`);
      setDeleteYearTarget(null);
      return;
    }
    setDeletingYear(true);
    try {
      const deleteFn = httpsCallable(functions, 'deleteAcademicYear');
      await deleteFn({ code: deleteYearTarget.code });
      setActionSuccess(`Đã xóa thành công năm học "${deleteYearTarget.code}"!`);
      setDeleteYearTarget(null);
      await Promise.all([fetchAcademicYears(), fetchOverview(), fetchClasses()]);
    } catch (err: any) {
      alert('Lỗi xóa năm học: ' + (err.message || 'Không xác định'));
    } finally {
      setDeletingYear(false);
    }
  };

  const handleApproveTeacher = async (uid: string) => {
    try {
      const approveFn = httpsCallable(functions, 'adminApproveTeacher');
      const res: any = await approveFn({ teacherUid: uid });
      setActionSuccess(res.data?.message || 'Đã duyệt và kích hoạt tài khoản giáo viên thành công!');
      await fetchTeachers();
      await fetchOverview();
    } catch (err: any) {
      setError('Lỗi duyệt giáo viên: ' + err.message);
    }
  };

  const handleOpenResetModal = (teacher: any) => {
    setResetTargetTeacher(teacher);
    setNewTeacherPasswordInput('GV123456');
  };

  const handleConfirmResetPassword = async () => {
    if (!resetTargetTeacher) return;
    setIsResettingPass(true);
    try {
      const resetFn = createCallable('adminResetTeacherPassword');
      const res: any = await resetFn({
        targetUid: resetTargetTeacher.uid,
        newPassword: newTeacherPasswordInput.trim() || undefined
      });
      if (res.data?.success) {
        setActionSuccess(`Đã đặt lại mật khẩu mới thành công cho giáo viên "${resetTargetTeacher.displayName}"!`);
        setResetTargetTeacher(null);
      }
    } catch (err: any) {
      setError('Lỗi đặt lại mật khẩu: ' + err.message);
    } finally {
      setIsResettingPass(false);
    }
  };

  const handleToggleTeacherStatus = async (uid: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    try {
      const updateFn = httpsCallable(functions, 'updateUserStatus');
      await updateFn({ targetUid: uid, status: nextStatus });
      setActionSuccess(`Đã ${nextStatus === 'suspended' ? 'tạm khóa' : 'kích hoạt'} tài khoản thành công.`);
      await fetchTeachers();
      await fetchOverview();
    } catch (err: any) {
      setError('Lỗi cập nhật trạng thái: ' + err.message);
    }
  };

  const handleToggleTeacherArchive = async (uid: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'archived' ? 'active' : 'archived';
    try {
      const updateFn = httpsCallable(functions, 'updateUserStatus');
      await updateFn({ targetUid: uid, status: nextStatus });
      setActionSuccess(`Đã ${nextStatus === 'archived' ? 'lưu trữ' : 'khôi phục'} tài khoản thành công.`);
      await fetchTeachers();
      await fetchOverview();
    } catch (err: any) {
      setError('Lỗi cập nhật trạng thái lưu trữ: ' + err.message);
    }
  };

  // Open Edit Teacher Modal
  const handleOpenEditTeacher = (teacher: any) => {
    setEditingTeacher(teacher);
    setEditingTeacherName(teacher.displayName || '');
    setEditingTeacherPhone(teacher.phoneNumber || '');
    setEditingTeacherStatus(teacher.status || 'active');
  };

  // Save Teacher Edit
  const handleSaveTeacherEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;
    setSavingTeacherEdit(true);
    try {
      const updateFn = httpsCallable(functions, 'updateUserStatus');
      await updateFn({
        targetUid: editingTeacher.uid,
        displayName: editingTeacherName.trim(),
        phoneNumber: editingTeacherPhone.trim(),
        status: editingTeacherStatus
      });
      setActionSuccess(`Đã cập nhật thông tin giáo viên "${editingTeacherName}" thành công.`);
      setEditingTeacher(null);
      await fetchTeachers();
      await fetchOverview();
    } catch (err: any) {
      setError('Lỗi cập nhật giáo viên: ' + err.message);
    } finally {
      setSavingTeacherEdit(false);
    }
  };

  // Single Teacher Delete Initiator
  const handleDeleteTeacherClick = (teacher: any) => {
    if (teacher.uid === user?.uid) {
      alert('Bạn không thể tự xóa tài khoản Quản trị đang đăng nhập.');
      return;
    }
    setDeleteTeacherTarget(teacher);
    setDeleteTeacherHasDeps(teacher.classCount > 0);
    setDeleteTeacherDepInfo(teacher.classCount > 0 ? { classCount: teacher.classCount, lessonCount: 0 } : null);
  };

  // Confirm Single Teacher Delete
  const handleConfirmDeleteTeacher = async (force: boolean = false) => {
    if (!deleteTeacherTarget) return;
    setDeletingTeacher(true);
    try {
      const deleteFn = httpsCallable(functions, 'adminDeleteTeacher');
      const res: any = await deleteFn({ teacherUid: deleteTeacherTarget.uid, force });
      if (res.data?.success) {
        setActionSuccess(res.data.message || 'Đã xóa tài khoản giáo viên thành công.');
        setDeleteTeacherTarget(null);
        await fetchTeachers();
        await fetchOverview();
      } else if (res.data?.hasDependencies) {
        setDeleteTeacherHasDeps(true);
        setDeleteTeacherDepInfo({ classCount: res.data.classCount, lessonCount: res.data.lessonCount });
      }
    } catch (err: any) {
      setError('Lỗi xóa giáo viên: ' + err.message);
    } finally {
      setDeletingTeacher(false);
    }
  };

  // Selection handlers
  const handleToggleSelectTeacher = (uid: string) => {
    if (uid === user?.uid) return; // Prevent selecting self for batch actions
    setSelectedTeacherUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleSelectAllTeachersOnPage = (pageTeachers: any[]) => {
    const selectableUids = pageTeachers
      .map((t) => t.uid)
      .filter((uid) => uid !== user?.uid);
    const allSelected = selectableUids.every((uid) => selectedTeacherUids.includes(uid));
    if (allSelected) {
      setSelectedTeacherUids((prev) => prev.filter((uid) => !selectableUids.includes(uid)));
    } else {
      setSelectedTeacherUids((prev) => Array.from(new Set([...prev, ...selectableUids])));
    }
  };

  // Batch action executor
  const handleBatchTeachersAction = async (action: 'lock' | 'unlock' | 'archive' | 'delete', force: boolean = false) => {
    if (selectedTeacherUids.length === 0) return;
    setIsProcessingBatchTeachers(true);
    try {
      const batchFn = httpsCallable(functions, 'adminBatchUpdateTeachers');
      const res: any = await batchFn({ teacherUids: selectedTeacherUids, action, force });
      if (res.data?.success) {
        setActionSuccess(
          `Thao tác hàng loạt hoàn tất: ${res.data.successCount} thành công` +
            (res.data.dependencyProtectedCount ? `, ${res.data.dependencyProtectedCount} chuyển lưu trữ bảo vệ dữ liệu` : '') +
            (res.data.skippedSelfCount ? `, ${res.data.skippedSelfCount} bỏ qua tài khoản hiện tại` : '')
        );
        setSelectedTeacherUids([]);
        setBatchActionModal(null);
        await fetchTeachers();
        await fetchOverview();
      }
    } catch (err: any) {
      setError('Lỗi thao tác hàng loạt: ' + err.message);
    } finally {
      setIsProcessingBatchTeachers(false);
    }
  };

  // Export Teachers to Excel (.xlsx) using ExcelJS
  const handleExportTeachersExcel = async () => {
    if (teachers.length === 0) {
      alert('Không có dữ liệu giáo viên để xuất.');
      return;
    }
    try {
      await exportTeachersToExcel(teachers);
    } catch (err: any) {
      alert('Lỗi xuất tệp Excel: ' + err.message);
    }
  };

  // Select Excel file for teacher import using ExcelJS & Security Auditing
  const handleTeacherExcelFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setTeachersImportErrors([]);
    setImportTeacherResults(null);

    try {
      const existingEmails = new Set(
        teachers.map((t) => (t.email || '').trim().toLowerCase()).filter(Boolean)
      );
      const audit = await parseAndAuditTeachersExcel(file, existingEmails);

      if (audit.generalError) {
        setTeachersImportErrors([audit.generalError]);
        setTeachersPreviewData([]);
        return;
      }

      const valid = audit.rows
        .filter((r) => r.isValid)
        .map((r, idx) => ({
          index: idx + 1,
          email: r.email,
          displayName: r.displayName,
          phoneNumber: r.phone,
          status: r.status
        }));

      const allErrs: string[] = [];
      audit.rows.forEach((r) => {
        if (!r.isValid && r.errors.length > 0) {
          allErrs.push(`Dòng ${r.rowNumber} (${r.email || r.displayName || 'Trống'}): ${r.errors.join(', ')}`);
        }
      });

      setTeachersPreviewData(valid);
      setTeachersImportErrors(allErrs);
    } catch (err: any) {
      setTeachersImportErrors(['Lỗi phân tích tệp Excel: ' + err.message]);
      setTeachersPreviewData([]);
    }
  };

  // Confirm import teachers batch
  const handleConfirmBatchTeachers = async () => {
    if (teachersPreviewData.length === 0) return;
    setImportingTeachers(true);
    try {
      const batchFn = httpsCallable(functions, 'batchCreateTeachers');
      const res: any = await batchFn({ teachers: teachersPreviewData });
      if (res.data?.success) {
        setImportTeacherResults(res.data);
        await fetchTeachers();
        await fetchOverview();
        setActionSuccess(`Đã tạo thành công ${res.data.totalCreated || res.data.teachers?.length} tài khoản giáo viên.`);
      }
    } catch (err: any) {
      setError('Lỗi nhập giáo viên: ' + err.message);
    } finally {
      setImportingTeachers(false);
    }
  };

  // Reset teacher password (Generates Firebase Auth secure reset link)
  const handleResetTeacherPassword = async (teacher: any) => {
    if (!window.confirm(`Bạn có chắc muốn tạo liên kết đặt lại mật khẩu cho giáo viên "${teacher.displayName}" (${teacher.email})?`)) {
      return;
    }
    try {
      const resetFn = createCallable('adminResetTeacherPassword');
      const res: any = await resetFn({ targetUid: teacher.uid });
      if (res.data?.success) {
        setResetPasswordResult({
          displayName: teacher.displayName,
          email: teacher.email,
          resetLink: res.data.resetLink
        });
      }
    } catch (err: any) {
      setError('Lỗi tạo liên kết đặt lại mật khẩu: ' + err.message);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      {/* Admin Top Navigation */}
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="font-black text-sm tracking-wide text-white uppercase block">
                BẢNG ĐIỀU HÀNH QUẢN TRỊ VIÊN
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                EM YÊU TIẾNG VIỆT — Cấp trường & Khung GDPT 1–5
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-block text-xs font-semibold text-slate-300 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
              {user?.email?.endsWith('@emytv.local') ? user.email.replace('@emytv.local', '') : user?.email || 'Quản trị viên'}
            </span>
            <button
              onClick={() => setShowAdminProfileModal(true)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl border border-slate-700 transition flex items-center gap-1.5"
              title="Thông tin cá nhân & Đổi mật khẩu Admin"
            >
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span>Hồ sơ Admin</span>
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 bg-slate-800 hover:bg-rose-900/40 text-slate-300 hover:text-rose-300 text-xs font-bold rounded-xl border border-slate-700 transition flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Alerts */}
        {actionSuccess && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-between">
            <span>{actionSuccess}</span>
            <button onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:underline">
              Đóng
            </button>
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-600 hover:underline">
              Đóng
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-slate-200 pb-2 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === 'overview'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Tổng quan hệ thống</span>
          </button>

          <button
            onClick={() => setActiveTab('teachers')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === 'teachers'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Quản lý Giáo viên ({teachers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('classes')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === 'classes'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <School className="w-4 h-4" />
            <span>Toàn bộ Lớp học ({classes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('curriculum')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === 'curriculum'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Ngân hàng GDPT Lớp 1–5</span>
          </button>
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* System Data Source Label (Compact & Neutral) */}
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span className="font-semibold text-slate-600">Dữ liệu quản trị chuẩn hóa GDPT 2018</span>
              <span className="text-[11px] text-slate-400">Đồng bộ trực tiếp Cloud Firestore</span>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Giáo viên</span>
                <span className="text-2xl font-black text-slate-900 mt-1 block">
                  {overview?.totalTeachers || 0}
                </span>
                <span className="text-[10px] text-emerald-600 font-bold">
                  {overview?.activeTeachers || 0} đang hoạt động
                </span>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Lớp học</span>
                <span className="text-2xl font-black text-slate-900 mt-1 block">
                  {overview?.totalClasses || 0}
                </span>
                <span className="text-[10px] text-slate-500 font-bold truncate block" title={overview?.academicYearsList?.join(', ')}>
                  {overview?.academicYearsList && overview.academicYearsList.length > 0
                    ? `Niên khóa: ${overview.academicYearsList.join(', ')}`
                    : 'Toàn hệ thống'}
                </span>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Học sinh</span>
                <span className="text-2xl font-black text-slate-900 mt-1 block">
                  {overview?.totalStudents || 0}
                </span>
                <span className="text-[10px] text-sky-600 font-bold">Mã định danh duy nhất</span>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Bài đọc</span>
                <span className="text-2xl font-black text-slate-900 mt-1 block">
                  {overview?.totalLessons || 0}
                </span>
                <span className="text-[10px] text-emerald-600 font-bold">GDPT & Gemini</span>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Lượt làm bài</span>
                <span className="text-2xl font-black text-slate-900 mt-1 block">
                  {overview?.totalAttempts || 0}
                </span>
                <span className="text-[10px] text-purple-600 font-bold">Firestore verified</span>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Trạng thái AI</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-black text-emerald-800">
                    {overview?.aiServiceStatus?.activeModel || 'gemini-3.5-flash-lite'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-bold block mt-1">
                  {overview?.aiServiceStatus?.status === 'VERIFIED' ? 'Đã kiểm chứng' : 'Sẵn sàng'}
                </span>
              </div>
            </div>

            {/* Year Breakdown Section */}
            {overview?.yearBreakdown && overview.yearBreakdown.length > 0 && (
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                      <School className="w-4 h-4 text-emerald-600" />
                      <span>Cơ Cấu Lớp Học & Học Sinh Theo Niên Khóa</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Thống kê động từ Cloud Firestore · Đối soát theo mã học sinh duy nhất
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('classes')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 transition"
                  >
                    <span>Quản lý niên khóa</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {overview.yearBreakdown.map((item) => {
                    const isCur = item.academicYear === '2026-2027';
                    const isFut = item.academicYear > '2026-2027';
                    return (
                      <div
                        key={item.academicYear}
                        onClick={() => {
                          handleSelectAdminYear(item.academicYear);
                          setActiveTab('classes');
                        }}
                        className="p-4 bg-slate-50 hover:bg-emerald-50/50 rounded-2xl border border-slate-200 hover:border-emerald-300 transition cursor-pointer flex flex-col justify-between gap-3 group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-black text-slate-800 group-hover:text-emerald-700 transition">
                            Năm học {item.academicYear}
                          </span>
                          {isCur ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full border border-emerald-300">
                              Hiện tại
                            </span>
                          ) : isFut ? (
                            <span className="px-2 py-0.5 bg-sky-100 text-sky-800 text-[10px] font-black rounded-full border border-sky-300">
                              Kế tiếp
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded-full">
                              Trước
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-white p-2 rounded-xl border border-slate-100">
                            <span className="text-[10px] text-slate-400 block font-bold uppercase">Tổng lớp</span>
                            <strong className="text-base font-black text-slate-800">{item.totalClasses} lớp</strong>
                          </div>
                          <div className="bg-white p-2 rounded-xl border border-slate-100">
                            <span className="text-[10px] text-slate-400 block font-bold uppercase">Học sinh</span>
                            <strong className="text-base font-black text-slate-800">{item.totalStudents} em</strong>
                          </div>
                        </div>

                        <div className="text-[11px] font-bold text-emerald-600 group-hover:text-emerald-700 flex items-center justify-between">
                          <span>Xem chi tiết danh sách</span>
                          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}


            {/* Curriculum coverage across Grades 1-5 */}
            <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                <span>Bao phủ Khung Chương trình GDPT (Bộ sách Kết nối tri thức với cuộc sống)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {[1, 2, 3, 4, 5].map((g) => {
                  const count = overview?.curriculumCoverage?.[g as CurriculumGrade] || 0;
                  return (
                    <div
                      key={g}
                      onClick={() => {
                        setSelectedCurriculumGrade(g as CurriculumGrade);
                        setActiveTab('curriculum');
                      }}
                      className="p-4 bg-slate-50 hover:bg-emerald-50/50 rounded-2xl border border-slate-200 cursor-pointer transition text-center"
                    >
                      <span className="text-xs font-bold text-slate-500 block">Khối Lớp {g}</span>
                      <span className="text-2xl font-black text-slate-800 my-1 block">{count}</span>
                      <span className="text-[11px] text-emerald-700 font-bold">Mục đã kiểm định</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Teachers Management */}
        {activeTab === 'teachers' && (() => {
          // Filter teachers based on search query and status filter
          const filteredTeachers = teachers.filter((t) => {
            const query = teacherSearchQuery.trim().toLowerCase();
            const matchesSearch =
              !query ||
              (t.displayName || '').toLowerCase().includes(query) ||
              (t.email || '').toLowerCase().includes(query) ||
              (t.phoneNumber || '').toLowerCase().includes(query);

            const matchesStatus =
              teacherStatusFilter === 'all'
                ? t.status !== 'test_isolated'
                : teacherStatusFilter === 'all_with_isolated'
                ? true
                : t.status === teacherStatusFilter;

            return matchesSearch && matchesStatus;
          });

          const totalTeacherPages = Math.ceil(filteredTeachers.length / teacherPageSize) || 1;
          const safeTeacherPage = Math.min(teacherPage, totalTeacherPages);
          const paginatedTeachers = filteredTeachers.slice(
            (safeTeacherPage - 1) * teacherPageSize,
            safeTeacherPage * teacherPageSize
          );

          const selectablePageUids = paginatedTeachers
            .map((t) => t.uid)
            .filter((uid) => uid !== user?.uid);
          const isAllPageSelected =
            selectablePageUids.length > 0 &&
            selectablePageUids.every((uid) => selectedTeacherUids.includes(uid));

          return (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 overflow-hidden space-y-4">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase">
                    Danh sách tài khoản Giáo viên & Phân quyền ({teachers.length})
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    Tìm kiếm, lọc trạng thái, phân trang, chỉnh sửa hồ sơ và xử lý hàng loạt
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportTeachersExcel}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl font-bold text-xs transition cursor-pointer"
                    title="Xuất danh sách giáo viên ra Excel (.xlsx)"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Xuất Excel</span>
                  </button>

                  <button
                    onClick={() => {
                      setTeachersPreviewData([]);
                      setTeachersImportErrors([]);
                      setImportTeacherResults(null);
                      setShowImportTeachersModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 rounded-xl font-bold text-xs transition cursor-pointer"
                    title="Nhập danh sách giáo viên từ Excel (.xlsx)"
                  >
                    <Upload className="w-3.5 h-3.5 text-sky-600" />
                    <span>Nhập từ Excel</span>
                  </button>
                </div>
              </div>

              {/* Search & Filter Toolbar */}
              <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="flex-1 flex flex-col sm:flex-row gap-2">
                  {/* Search Input */}
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={teacherSearchQuery}
                      onChange={(e) => {
                        setTeacherSearchQuery(e.target.value);
                        setTeacherPage(1);
                      }}
                      placeholder="Tìm theo họ tên, email hoặc SĐT..."
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    {teacherSearchQuery && (
                      <button
                        onClick={() => {
                          setTeacherSearchQuery('');
                          setTeacherPage(1);
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Status Filter */}
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                    <select
                      value={teacherStatusFilter}
                      onChange={(e: any) => {
                        setTeacherStatusFilter(e.target.value);
                        setTeacherPage(1);
                      }}
                      className="bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="all">Giáo viên nghiệp vụ ({teachers.filter((t) => t.status !== 'test_isolated').length})</option>
                      <option value="active">Đang hoạt động ({teachers.filter((t) => t.status === 'active').length})</option>
                      <option value="pending_approval">Chờ duyệt ({teachers.filter((t) => t.status === 'pending_approval').length})</option>
                      <option value="suspended">Tạm khóa ({teachers.filter((t) => t.status === 'suspended').length})</option>
                      <option value="test_isolated">Kiểm thử đã cách ly ({teachers.filter((t) => t.status === 'test_isolated').length})</option>
                      <option value="all_with_isolated">Toàn bộ ({teachers.length})</option>
                    </select>
                  </div>
                </div>

                {/* Page Size Selector */}
                <div className="flex items-center gap-2 text-xs font-bold text-slate-600 shrink-0 self-end md:self-center">
                  <span>Hiển thị:</span>
                  <select
                    value={teacherPageSize}
                    onChange={(e) => {
                      setTeacherPageSize(Number(e.target.value));
                      setTeacherPage(1);
                    }}
                    className="bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-xl px-2 py-1.5"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                  <span>giáo viên</span>
                </div>
              </div>

              {/* Batch Action Toolbar (renders when items selected) */}
              {selectedTeacherUids.length > 0 && (
                <div className="p-3 bg-emerald-50/80 border border-emerald-300 rounded-2xl flex flex-wrap items-center justify-between gap-2 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-emerald-600 text-white font-black text-xs rounded-lg">
                      {selectedTeacherUids.length}
                    </span>
                    <span className="text-xs font-black text-emerald-950">
                      tài khoản giáo viên đã được chọn
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => handleBatchTeachersAction('unlock')}
                      disabled={isProcessingBatchTeachers}
                      className="px-2.5 py-1.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs rounded-xl transition inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Kích hoạt</span>
                    </button>

                    <button
                      onClick={() => handleBatchTeachersAction('lock')}
                      disabled={isProcessingBatchTeachers}
                      className="px-2.5 py-1.5 bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs rounded-xl transition inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Khóa</span>
                    </button>

                    <button
                      onClick={() => handleBatchTeachersAction('archive')}
                      disabled={isProcessingBatchTeachers}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold text-xs rounded-xl transition inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Archive className="w-3.5 h-3.5 text-slate-600" />
                      <span>Lưu trữ</span>
                    </button>

                    <button
                      onClick={() => setBatchActionModal({ action: 'delete', count: selectedTeacherUids.length })}
                      disabled={isProcessingBatchTeachers}
                      className="px-2.5 py-1.5 bg-white hover:bg-rose-100 text-rose-800 border border-rose-300 font-bold text-xs rounded-xl transition inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Xóa hàng loạt</span>
                    </button>

                    <button
                      onClick={() => setSelectedTeacherUids([])}
                      className="px-2.5 py-1.5 text-slate-500 hover:text-slate-800 font-bold text-xs"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>
              )}

              {/* Teachers Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase text-[11px] bg-slate-50/50">
                      <th className="py-3 px-3 w-8">
                        <input
                          type="checkbox"
                          checked={isAllPageSelected}
                          onChange={() => handleSelectAllTeachersOnPage(paginatedTeachers)}
                          className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          title="Chọn tất cả trên trang này"
                        />
                      </th>
                      <th className="py-3 px-3">Họ và tên</th>
                      <th className="py-3 px-3">Email / Đăng nhập</th>
                      <th className="py-3 px-3">Số điện thoại</th>
                      <th className="py-3 px-3">Số lớp phụ trách</th>
                      <th className="py-3 px-3">Trạng thái</th>
                      <th className="py-3 px-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedTeachers.map((t) => {
                      const isSelf = t.uid === user?.uid;
                      const isSelected = selectedTeacherUids.includes(t.uid);

                      return (
                        <tr
                          key={t.uid}
                          className={`transition ${isSelected ? 'bg-emerald-50/40' : 'hover:bg-slate-50'}`}
                        >
                          <td className="py-3 px-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isSelf}
                              onChange={() => handleToggleSelectTeacher(t.uid)}
                              className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-40"
                              title={isSelf ? 'Không thể chọn tài khoản quản trị hiện tại' : 'Chọn giáo viên'}
                            />
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <span>{t.displayName}</span>
                              {isSelf && (
                                <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-black rounded">
                                  Bạn
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-600 font-semibold font-mono">
                            {t.email?.endsWith('@emytv.local') ? t.email.replace('@emytv.local', '') : t.email}
                          </td>
                          <td className="py-3 px-3 text-slate-500 font-medium">
                            {t.phoneNumber || '—'}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 bg-sky-100 text-sky-800 rounded font-bold">
                              {t.classCount || 0} lớp
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            {t.status === 'pending_approval' ? (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold">
                                Chờ duyệt
                              </span>
                            ) : t.status === 'suspended' ? (
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold">
                                Tạm khóa
                              </span>
                            ) : t.status === 'archived' ? (
                              <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded font-bold">
                                Đã lưu trữ
                              </span>
                            ) : t.status === 'test_isolated' ? (
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded font-bold">
                                Kiểm thử cách ly
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold">
                                Đang hoạt động
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              {/* Duyệt (pending) */}
                              {t.status === 'pending_approval' && (
                                <button
                                  onClick={() => handleApproveTeacher(t.uid)}
                                  className="p-1.5 rounded-lg font-bold text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer shadow-sm"
                                  title="Duyệt tài khoản giáo viên"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Sửa thông tin */}
                              <button
                                onClick={() => handleOpenEditTeacher(t)}
                                className="p-1.5 rounded-lg font-bold text-[11px] bg-slate-100 hover:bg-sky-100 text-slate-700 hover:text-sky-900 transition cursor-pointer"
                                title="Chỉnh sửa thông tin hồ sơ giáo viên"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {/* Đặt lại mật khẩu */}
                              <button
                                onClick={() => handleOpenResetModal(t)}
                                className="p-1.5 rounded-lg font-bold text-[11px] bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition cursor-pointer"
                                title="Đặt lại mật khẩu cho giáo viên"
                              >
                                <Key className="w-3.5 h-3.5 text-amber-600" />
                              </button>

                              {/* Khóa / Mở khóa */}
                              {!isSelf && (
                                <button
                                  onClick={() => handleToggleTeacherStatus(t.uid, t.status)}
                                  className={`p-1.5 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                                    t.status === 'suspended'
                                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300'
                                      : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                                  }`}
                                  title={t.status === 'suspended' ? 'Kích hoạt lại tài khoản' : 'Tạm khóa tài khoản'}
                                >
                                  {t.status === 'suspended' ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                                </button>
                              )}

                              {/* Lưu trữ / Khôi phục */}
                              {!isSelf && (
                                <button
                                  onClick={() => handleToggleTeacherArchive(t.uid, t.status)}
                                  className="p-1.5 rounded-lg font-bold text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                                  title={t.status === 'archived' ? 'Khôi phục từ lưu trữ' : 'Lưu trữ hồ sơ'}
                                >
                                  <Archive className="w-3.5 h-3.5 text-slate-600" />
                                </button>
                              )}

                              {/* Xóa hồ sơ */}
                              {!isSelf && (
                                <button
                                  onClick={() => handleDeleteTeacherClick(t)}
                                  className="p-1.5 rounded-lg font-bold text-[11px] bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 transition cursor-pointer"
                                  title="Xóa tài khoản giáo viên"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {paginatedTeachers.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 font-semibold">
                          {teachers.length === 0
                            ? 'Chưa có tài khoản giáo viên nào được đăng ký.'
                            : 'Không tìm thấy giáo viên nào phù hợp với bộ lọc hiện tại.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-500 font-semibold">
                <div>
                  Hiển thị{' '}
                  <strong className="text-slate-800">
                    {filteredTeachers.length === 0 ? 0 : (safeTeacherPage - 1) * teacherPageSize + 1}
                  </strong>{' '}
                  -{' '}
                  <strong className="text-slate-800">
                    {Math.min(safeTeacherPage * teacherPageSize, filteredTeachers.length)}
                  </strong>{' '}
                  trên tổng số <strong className="text-slate-800">{filteredTeachers.length}</strong> giáo viên
                  {filteredTeachers.length !== teachers.length && ` (lọc từ ${teachers.length} tổng cộng)`}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTeacherPage((p) => Math.max(1, p - 1))}
                    disabled={safeTeacherPage <= 1}
                    className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition flex items-center gap-1 font-bold"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Trước</span>
                  </button>

                  <span className="px-2 font-bold text-slate-700">
                    Trang {safeTeacherPage} / {totalTeacherPages}
                  </span>

                  <button
                    onClick={() => setTeacherPage((p) => Math.min(totalTeacherPages, p + 1))}
                    disabled={safeTeacherPage >= totalTeacherPages}
                    className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition flex items-center gap-1 font-bold"
                  >
                    <span>Sau</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Modal: Edit Teacher */}
              {editingTeacher && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                  <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                          <Edit3 className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-black text-slate-900">Sửa Thông Tin Giáo Viên</h3>
                          <span className="text-xs text-slate-500 font-mono">{editingTeacher.email}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setEditingTeacher(null)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleSaveTeacherEdit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Họ và tên (*)</label>
                        <input
                          type="text"
                          required
                          value={editingTeacherName}
                          onChange={(e) => setEditingTeacherName(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Số điện thoại</label>
                        <input
                          type="tel"
                          value={editingTeacherPhone}
                          onChange={(e) => setEditingTeacherPhone(e.target.value)}
                          placeholder="VD: 0912345678"
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Trạng thái tài khoản</label>
                        <select
                          value={editingTeacherStatus}
                          onChange={(e) => setEditingTeacherStatus(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="active">Đang hoạt động</option>
                          <option value="suspended">Tạm khóa</option>
                          <option value="archived">Lưu trữ</option>
                          <option value="pending_approval">Chờ duyệt</option>
                        </select>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setEditingTeacher(null)}
                          className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                        >
                          Hủy
                        </button>
                        <button
                          type="submit"
                          disabled={savingTeacherEdit}
                          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow disabled:opacity-50"
                        >
                          {savingTeacherEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Modal: Confirm Delete Teacher */}
              {deleteTeacherTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                  <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border space-y-4">
                    <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-lg font-black text-slate-900">Xác Nhận Xóa Giáo Viên</h3>
                      <p className="text-xs text-slate-600 font-semibold mt-1">
                        Bạn có chắc chắn muốn xóa tài khoản của giáo viên{' '}
                        <strong className="text-slate-900">{deleteTeacherTarget.displayName}</strong> ({deleteTeacherTarget.email})?
                      </p>
                    </div>

                    {deleteTeacherHasDeps && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs space-y-1.5">
                        <div className="font-bold text-amber-900 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Cảnh báo dữ liệu phụ thuộc:</span>
                        </div>
                        <p className="text-amber-800 text-[11px] leading-relaxed">
                          Giáo viên này đang phụ trách{' '}
                          <strong className="text-amber-950">
                            {deleteTeacherDepInfo?.classCount || deleteTeacherTarget.classCount || 0} lớp học
                          </strong>. Để bảo vệ kết quả của học sinh, hệ thống khuyến nghị chuyển sang <strong>Lưu trữ</strong> thay vì xóa vĩnh viễn.
                        </p>
                      </div>
                    )}

                    <div className="flex flex-col gap-2 pt-2">
                      {deleteTeacherHasDeps ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              handleToggleTeacherArchive(deleteTeacherTarget.uid, 'active');
                              setDeleteTeacherTarget(null);
                            }}
                            className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow"
                          >
                            <Archive className="w-4 h-4" />
                            <span>Chuyển sang Lưu trữ hồ sơ (Khuyến nghị)</span>
                          </button>
                          <button
                            type="button"
                            disabled={deletingTeacher}
                            onClick={() => handleConfirmDeleteTeacher(true)}
                            className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold rounded-xl text-xs"
                          >
                            {deletingTeacher ? 'Đang xóa...' : 'Vẫn muốn xóa vĩnh viễn'}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={deletingTeacher}
                          onClick={() => handleConfirmDeleteTeacher(false)}
                          className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs shadow disabled:opacity-50"
                        >
                          {deletingTeacher ? 'Đang xóa...' : 'Xác nhận xóa vĩnh viễn'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeleteTeacherTarget(null)}
                        className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                      >
                        Hủy bỏ
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal: Confirm Batch Delete Teachers */}
              {batchActionModal?.action === 'delete' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                  <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border space-y-4">
                    <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-lg font-black text-slate-900">Xóa Hàng Loạt Giáo Viên</h3>
                      <p className="text-xs text-slate-600 font-semibold mt-1">
                        Bạn đã chọn <strong className="text-rose-700">{batchActionModal.count} tài khoản</strong> để xóa.
                      </p>
                    </div>

                    <div className="p-3 bg-sky-50 border border-sky-200 rounded-2xl text-xs space-y-1">
                      <div className="font-bold text-sky-900">Chính sách bảo vệ an toàn:</div>
                      <p className="text-sky-800 text-[11px] leading-relaxed">
                        - Tài khoản quản trị đang đăng nhập sẽ tự động được bỏ qua.<br />
                        - Các giáo viên đang phụ trách lớp học hoặc bài học sẽ tự động được chuyển sang <strong>Lưu trữ</strong> để bảo vệ kết quả học tập.
                      </p>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setBatchActionModal(null)}
                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                      >
                        Hủy bỏ
                      </button>
                      <button
                        type="button"
                        disabled={isProcessingBatchTeachers}
                        onClick={() => handleBatchTeachersAction('delete', false)}
                        className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs shadow disabled:opacity-50"
                      >
                        {isProcessingBatchTeachers ? 'Đang xử lý...' : 'Xác nhận xóa'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

            {/* Modal: Reset Password Result */}
            {resetPasswordResult && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border text-center space-y-4">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <Key className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900">Liên Kết Đặt Lại Mật Khẩu (Firebase Auth)</h3>
                  <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                    Đã tạo liên kết đặt lại mật khẩu của Firebase cho giáo viên <strong className="text-slate-900">{resetPasswordResult.displayName}</strong> ({resetPasswordResult.email}).
                  </p>

                  <div className="bg-emerald-50 border-2 border-emerald-200 p-4 rounded-2xl text-left space-y-2">
                    <div className="text-[11px] text-emerald-800 font-bold uppercase">LIÊN KẾT THIẾT LẬP MẬT KHẨU AN TOÀN:</div>
                    <div className="font-mono text-xs text-emerald-950 break-all p-2 bg-white rounded-xl border border-emerald-300 select-all max-h-24 overflow-y-auto">
                      {resetPasswordResult.resetLink || 'Liên kết đã được kích hoạt trên hệ thống xác thực Firebase Authentication của giáo viên.'}
                    </div>
                    <p className="text-[10px] text-slate-500 italic">
                      * Tuân thủ bảo mật: Hệ thống không lưu hoặc hiển thị mật khẩu thuần văn bản. Giáo viên truy cập liên kết trên để tự đặt mật khẩu mới.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {resetPasswordResult.resetLink && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(resetPasswordResult.resetLink!);
                          alert('Đã sao chép liên kết đặt lại mật khẩu vào bộ nhớ đệm!');
                        }}
                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Sao chép liên kết</span>
                      </button>
                    )}
                    <button
                      onClick={() => setResetPasswordResult(null)}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs cursor-pointer shadow"
                    >
                      Đã hoàn tất
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal: Import Teachers from Excel */}
            {showImportTeachersModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border max-h-[90vh] flex flex-col">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div>
                      <h3 className="text-xl font-black text-slate-900">
                        Nhập Danh Sách Giáo Viên Từ Excel (.xlsx)
                      </h3>
                      <p className="text-xs text-slate-500 font-semibold mt-0.5">
                        Tự động cấp quyền Teacher và khởi tạo tài khoản trong hệ thống
                      </p>
                    </div>
                    <button
                      onClick={() => setShowImportTeachersModal(false)}
                      className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="py-4 overflow-y-auto space-y-4 flex-1 pr-1">
                    {/* Step 1: Template download */}
                    <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-black text-sky-950">
                          Bước 1: Tải tệp Excel mẫu danh sách giáo viên (.xlsx)
                        </div>
                        <div className="text-[11px] text-sky-700 font-semibold mt-0.5">
                          Bao gồm các cột: Email công vụ (*), Họ và tên (*), Số điện thoại, Trạng thái (active/suspended).
                        </div>
                      </div>
                      <a
                        href="/mau_nhap_giao_vien.xlsx"
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
                        Bước 2: Chọn tệp Excel giáo viên để tải lên (.xlsx, tối đa 2MB, tối đa 50 dòng)
                      </label>
                      <input
                        type="file"
                        accept=".xlsx"
                        onChange={handleTeacherExcelFileSelect}
                        className="w-full text-xs text-slate-500 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-sky-500 file:text-white hover:file:bg-sky-600 file:cursor-pointer p-2 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer"
                      />
                    </div>

                    {/* Errors */}
                    {teachersImportErrors.length > 0 && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-semibold space-y-1">
                        <div className="font-bold flex items-center gap-1 text-rose-900">
                          <span>Cần kiểm tra lại các dòng sau:</span>
                        </div>
                        {teachersImportErrors.map((err, i) => (
                          <div key={i} className="pl-5 text-[11px]">• {err}</div>
                        ))}
                      </div>
                    )}

                    {/* Preview Table */}
                    {teachersPreviewData.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-700 uppercase">
                            Xem trước ({teachersPreviewData.length} giáo viên hợp lệ):
                          </span>
                          <span className="text-[11px] text-emerald-600 font-bold">
                            ✓ Sẵn sàng tạo tài khoản
                          </span>
                        </div>

                        <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-2xl">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 text-slate-500 uppercase font-black text-[10px] sticky top-0">
                              <tr>
                                <th className="py-2 px-3">STT</th>
                                <th className="py-2 px-3">Họ và tên</th>
                                <th className="py-2 px-3">Email</th>
                                <th className="py-2 px-3">Trạng thái</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {teachersPreviewData.map((row) => (
                                <tr key={row.index} className="hover:bg-slate-50">
                                  <td className="py-1.5 px-3 text-slate-400">{row.index}</td>
                                  <td className="py-1.5 px-3 font-bold text-slate-900">{row.displayName}</td>
                                  <td className="py-1.5 px-3 text-slate-600 font-semibold">{row.email}</td>
                                  <td className="py-1.5 px-3">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                      {row.status === 'suspended' ? 'Tạm khóa' : 'Hoạt động'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowImportTeachersModal(false)}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                    >
                      Hủy bỏ
                    </button>

                    <button
                      type="button"
                      disabled={importingTeachers || teachersPreviewData.length === 0}
                      onClick={async () => {
                        await handleConfirmBatchTeachers();
                        setShowImportTeachersModal(false);
                      }}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black rounded-xl text-xs transition shadow-md cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {importingTeachers ? (
                        <span>Đang tạo tài khoản...</span>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          <span>Tạo {teachersPreviewData.length} tài khoản giáo viên</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

        {/* Tab 3: Classes Management (Hierarchical: NĂM HỌC -> KHỐI -> LỚP -> THÔNG TIN LỚP) */}
        {activeTab === 'classes' && (
          <div className="space-y-4">
            {/* Top Breadcrumb & Navigation Bar (Shown when a year is selected) */}
            {adminNavYear !== null && (
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
                <nav aria-label="Điều hướng phân cấp lớp học" className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs font-bold text-slate-600 min-w-0">
                  <button
                    type="button"
                    onClick={handleBackToAdminYears}
                    className="text-slate-500 hover:text-emerald-700 transition flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <School className="w-3.5 h-3.5" />
                    <span>Tất cả năm học</span>
                  </button>

                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />

                  {adminNavGrade === null ? (
                    <span className="text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 truncate">
                      Năm học {adminNavYear}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleBackToAdminGrades}
                      className="text-slate-600 hover:text-emerald-700 transition truncate cursor-pointer"
                    >
                      Năm học {adminNavYear}
                    </button>
                  )}

                  {adminNavGrade !== null && (
                    <>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {!selectedAdminClass ? (
                        <span className="text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 truncate">
                          Khối {adminNavGrade}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleBackToAdminClasses}
                          className="text-slate-600 hover:text-emerald-700 transition truncate cursor-pointer"
                        >
                          Khối {adminNavGrade}
                        </button>
                      )}
                    </>
                  )}

                  {selectedAdminClass && (
                    <>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-emerald-900 bg-emerald-100/80 px-2.5 py-1 rounded-lg border border-emerald-300 font-black truncate">
                        Lớp {selectedAdminClass.name}
                      </span>
                    </>
                  )}
                </nav>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Back button */}
                  {selectedAdminClass ? (
                    <button
                      type="button"
                      onClick={handleBackToAdminClasses}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Quay lại</span>
                    </button>
                  ) : adminNavGrade !== null ? (
                    <button
                      type="button"
                      onClick={handleBackToAdminGrades}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Quay lại</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleBackToAdminYears}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Quay lại</span>
                    </button>
                  )}

                  {/* Create Class Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setNewAdminClassName('');
                      setNewAdminClassGrade(adminNavGrade || 2);
                      setNewAdminClassAcademicYear(adminNavYear || '2026-2027');
                      setNewAdminClassTeacherUid(teachers[0]?.uid || '');
                      setShowAdminCreateClassModal(true);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Tạo Lớp Mới</span>
                    <span className="sm:hidden">Tạo Lớp</span>
                  </button>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* LEVEL 1: NĂM HỌC (Shown ONLY when adminNavYear === null) */}
            {/* ========================================================= */}
            {adminNavYear === null && (
              <div className="space-y-4 animate-fade-in">
                {/* Level 1 Header Banner */}
                <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border border-emerald-200/80 rounded-3xl p-5 sm:p-7 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="px-3 py-1 bg-emerald-600 text-white text-xs font-black rounded-full uppercase tracking-wider">
                        Bước 1 / 4 — Toàn trường
                      </span>
                      <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                        Quản Lý Lớp Học Toàn Trường — Chọn Năm Học
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
                        Bấm chọn năm học để xem cơ cấu khối lớp và danh sách lớp học của nhà trường.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          setNewYearCode('');
                          setNewYearName('');
                          setNewYearDescription('');
                          setNewYearIsCurrent(false);
                          setShowCreateYearModal(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-300 hover:border-emerald-500 text-slate-700 hover:text-emerald-700 rounded-xl font-bold text-xs transition shadow-xs cursor-pointer"
                      >
                        <Calendar className="w-4 h-4 text-emerald-600" />
                        <span>Thêm Năm Học</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setNewAdminClassName('');
                          setNewAdminClassGrade(2);
                          setNewAdminClassAcademicYear('2026-2027');
                          setNewAdminClassTeacherUid(teachers[0]?.uid || '');
                          setShowAdminCreateClassModal(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs transition shadow-md cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Tạo Lớp Học Mới</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Year Cards Grid */}
                {(() => {
                  const yearsMap = new Map<string, {
                    code: string;
                    name: string;
                    isCurrent: boolean;
                    periodType: 'past' | 'current' | 'future';
                    status: 'active' | 'archived';
                    description?: string;
                    totalClasses: number;
                    totalStudents: number;
                    canDelete: boolean;
                  }>();

                  academicYears.forEach((ay) => {
                    const code = (typeof ay === 'string' ? ay : ay?.code) || (ay as any)?.id;
                    if (!code) return;
                    yearsMap.set(code, {
                      code,
                      name: ay.name || `Năm học ${code}`,
                      isCurrent: Boolean(ay.isCurrent),
                      periodType: ay.periodType || 'past',
                      status: ay.status || 'active',
                      description: ay.description,
                      totalClasses: typeof ay.totalClasses === 'number' ? ay.totalClasses : 0,
                      totalStudents: typeof ay.totalStudents === 'number' ? ay.totalStudents : 0,
                      canDelete: Boolean(ay.canDelete)
                    });
                  });

                  classes.forEach((c) => {
                    const yr = c.academicYear || '2025-2026';
                    if (!yearsMap.has(yr)) {
                      const isCur = yr === '2025-2026';
                      const isFut = yr > '2026-2027';
                      yearsMap.set(yr, {
                        code: yr,
                        name: `Năm học ${yr}`,
                        isCurrent: isCur,
                        periodType: isCur ? 'current' : isFut ? 'future' : 'past',
                        status: 'active',
                        totalClasses: 0,
                        totalStudents: 0,
                        canDelete: false
                      });
                    }
                  });

                  const displayYears = Array.from(yearsMap.values()).sort((a, b) => (b.code || '').localeCompare(a.code || ''));

                  if (displayYears.length === 0) {
                    return (
                      <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-500">
                        <School className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="font-bold text-base text-slate-700">Chưa có năm học nào trong hệ thống.</p>
                        <p className="text-xs mt-1 text-slate-500">Bấm "Thêm Năm Học" hoặc "Tạo Lớp Học Mới" để bắt đầu.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                      {displayYears.map((item) => {
                        const yearClasses = classes.filter(
                          (c) => (c.academicYear || '2025-2026') === item.code
                        );
                        const totalStudents = item.totalStudents > 0
                          ? item.totalStudents
                          : yearClasses.reduce((acc, c) => acc + (c.studentCount || 0), 0);
                        const yearGrades = Array.from(
                          new Set(yearClasses.map((c) => c.grade))
                        ).sort((a, b) => a - b);

                        return (
                          <div
                            key={item.code}
                            onClick={() => handleSelectAdminYear(item.code)}
                            className="group relative bg-white border border-slate-200 hover:border-emerald-500 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-4"
                          >
                            <div className="space-y-3">
                              {/* Header: Icon + Badges + Admin Action Buttons */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-10 h-10 rounded-xl bg-emerald-50 group-hover:bg-emerald-600 text-emerald-600 group-hover:text-white flex items-center justify-center transition-colors shrink-0 shadow-xs">
                                    <Calendar className="w-5 h-5" />
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {item.isCurrent ? (
                                        <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-black rounded-full border border-emerald-300">
                                          Năm học hiện tại
                                        </span>
                                      ) : item.periodType === 'future' ? (
                                        <span className="px-2.5 py-0.5 bg-sky-100 text-sky-800 text-[11px] font-black rounded-full border border-sky-300">
                                          Niên khóa kế tiếp
                                        </span>
                                      ) : (
                                        <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-[11px] font-bold rounded-full border border-slate-200">
                                          Niên khóa trước
                                        </span>
                                      )}
                                      {item.status === 'archived' && (
                                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full border border-amber-300">
                                          Đã lưu trữ
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Compact Admin Actions */}
                                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                  {!item.isCurrent && (
                                    <button
                                      type="button"
                                      title="Đặt làm năm học hiện tại"
                                      onClick={() => handleSetCurrentYear(item as any)}
                                      disabled={settingCurrentYear === item.code}
                                      className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    title="Sửa thông tin năm học"
                                    onClick={() => {
                                      setEditingYear(item as any);
                                      setEditYearName(item.name || `Năm học ${item.code}`);
                                      setEditYearDescription(item.description || '');
                                      setEditYearStatus(item.status || 'active');
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition cursor-pointer"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>

                                  <button
                                    type="button"
                                    title={item.status === 'archived' ? 'Khôi phục niên khóa' : 'Lưu trữ niên khóa'}
                                    onClick={() => {
                                      if (item.isCurrent && item.status !== 'archived') {
                                        alert('Không thể lưu trữ năm học đang là hiện tại!');
                                        return;
                                      }
                                      setArchiveYearTarget({
                                        year: item as any,
                                        newStatus: item.status === 'archived' ? 'active' : 'archived'
                                      });
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                                  >
                                    {item.status === 'archived' ? (
                                      <RotateCcw className="w-4 h-4" />
                                    ) : (
                                      <Archive className="w-4 h-4" />
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    title={yearClasses.length > 0 ? `Không thể xóa (Đang có ${yearClasses.length} lớp)` : 'Xóa năm học'}
                                    onClick={() => {
                                      setDeleteYearTarget({
                                        ...item,
                                        totalClasses: yearClasses.length
                                      } as any);
                                    }}
                                    className={`p-1.5 rounded-lg transition cursor-pointer ${
                                      yearClasses.length > 0
                                        ? 'text-slate-300 hover:text-amber-700 hover:bg-amber-50'
                                        : 'text-slate-400 hover:text-rose-700 hover:bg-rose-50'
                                    }`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              {/* Card Title & Desc */}
                              <div>
                                <h4 className="text-lg font-black text-slate-900 group-hover:text-emerald-700 transition">
                                  {item.name || `Năm học ${item.code}`}
                                </h4>
                                <p className="text-xs text-slate-500 font-medium mt-0.5 line-clamp-1">
                                  {item.description || 'Kế hoạch GDPT Đọc hiểu Tiếng Việt Tiểu học'}
                                </p>
                              </div>

                              {/* Grades chips */}
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 block uppercase mb-1">
                                  Khối lớp:
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {yearGrades.length > 0 ? (
                                    yearGrades.map((g) => (
                                      <span
                                        key={g}
                                        className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[11px] font-bold rounded-md border border-slate-200"
                                      >
                                        Khối {g}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-[11px] text-slate-400 italic">Chưa tạo lớp nào</span>
                                  )}
                                </div>
                              </div>

                              {/* Stats Row */}
                              <div className="grid grid-cols-2 gap-2 pt-1">
                                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Lớp học</span>
                                  <strong className="text-base font-black text-slate-800">{yearClasses.length} lớp</strong>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Học sinh</span>
                                  <strong className="text-base font-black text-slate-800">~{totalStudents} em</strong>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleSelectAdminYear(item.code)}
                              className="w-full py-2.5 px-3 bg-emerald-600 group-hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <span>Vào năm học {item.code}</span>
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
            {/* LEVEL 2: KHỐI (Shown ONLY when adminNavYear !== null && adminNavGrade === null) */}
            {/* ========================================================= */}
            {adminNavYear !== null && adminNavGrade === null && (
              <div className="space-y-4 animate-fade-in">
                {/* Level 2 Header Banner */}
                <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border border-emerald-100 rounded-3xl p-5 sm:p-7 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="px-3 py-1 bg-emerald-600 text-white text-xs font-black rounded-full uppercase tracking-wider">
                        Bước 2 / 4 — Năm học {adminNavYear}
                      </span>
                      <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                        Chọn Khối Học
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
                        Chỉ hiển thị các khối học thực tế có lớp trong năm học {adminNavYear}.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleBackToAdminYears}
                      className="self-start sm:self-auto px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Đổi năm học khác</span>
                    </button>
                  </div>
                </div>

                {/* Grade Cards Grid */}
                {(() => {
                  const yearClasses = classes.filter(
                    (c) => (c.academicYear || '2025-2026') === adminNavYear
                  );
                  const availableGrades = Array.from(
                    new Set(yearClasses.map((c) => c.grade))
                  ).sort((a, b) => a - b);

                  if (availableGrades.length === 0) {
                    return (
                      <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-500">
                        <p className="font-bold text-base text-slate-700">Chưa có lớp học nào trong năm học {adminNavYear}.</p>
                        <p className="text-xs mt-1 text-slate-500">Bấm "Tạo Lớp Mới" ở góc phải để thêm lớp cho năm học này.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                      {availableGrades.map((grade) => {
                        const gradeClasses = yearClasses.filter((c) => c.grade === grade);
                        const totalStudents = gradeClasses.reduce(
                          (acc, c) => acc + (c.studentCount || 0),
                          0
                        );

                        return (
                          <div
                            key={grade}
                            onClick={() => handleSelectAdminGrade(grade)}
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
                                  Chương trình Đọc hiểu Tiếng Việt Lớp {grade} · Năm học {adminNavYear}
                                </p>
                              </div>

                              {/* Class chips */}
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
                              onClick={() => handleSelectAdminGrade(grade)}
                              className="w-full py-3.5 px-4 bg-emerald-600 group-hover:bg-emerald-700 text-white font-black text-sm rounded-2xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
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
            {/* LEVEL 3: LỚP (Shown ONLY when adminNavYear !== null && adminNavGrade !== null && !selectedAdminClass) */}
            {/* ========================================================= */}
            {adminNavYear !== null && adminNavGrade !== null && !selectedAdminClass && (
              <div className="space-y-4 animate-fade-in">
                {/* Level 3 Header Banner */}
                <div className="bg-gradient-to-r from-indigo-50 via-sky-50 to-emerald-50 border border-indigo-100 rounded-3xl p-5 sm:p-7 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="px-3 py-1 bg-indigo-600 text-white text-xs font-black rounded-full uppercase tracking-wider">
                        Bước 3 / 4 — Năm học {adminNavYear} · Khối {adminNavGrade}
                      </span>
                      <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                        Danh Sách Lớp Học Khối {adminNavGrade}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
                        Bấm vào lớp học để xem hồ sơ thông tin và thực hiện các thao tác quản trị.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleBackToAdminGrades}
                      className="self-start sm:self-auto px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Đổi khối học khác</span>
                    </button>
                  </div>
                </div>

                {/* Search & Filter Toolbar within this Grade */}
                {(() => {
                  const gradeClasses = classes.filter(
                    (c) => (c.academicYear || '2025-2026') === adminNavYear && c.grade === adminNavGrade
                  );

                  const filteredGradeClasses = gradeClasses.filter((cls) => {
                    if (classStatusFilter !== 'all' && (cls.status || 'active') !== classStatusFilter) return false;
                    if (classSearchQuery.trim()) {
                      const q = classSearchQuery.trim().toLowerCase();
                      const matchName = (cls.name || '').toLowerCase().includes(q);
                      const matchCode = (cls.classCode || '').toLowerCase().includes(q);
                      const matchTeacher = (cls.teacherName || '').toLowerCase().includes(q);
                      if (!matchName && !matchCode && !matchTeacher) return false;
                    }
                    return true;
                  });

                  return (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
                        {/* Search Input */}
                        <div className="relative flex-1">
                          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={classSearchQuery}
                            onChange={(e) => setClassSearchQuery(e.target.value)}
                            placeholder="Tìm theo tên lớp, mã lớp hoặc giáo viên..."
                            className="w-full pl-9 pr-8 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          {classSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setClassSearchQuery('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Status Filter */}
                        <div className="inline-flex rounded-xl bg-slate-50 p-1 border border-slate-200 shrink-0 self-start sm:self-auto">
                          {[
                            { id: 'all', label: 'Tất cả' },
                            { id: 'active', label: 'Hoạt động' },
                            { id: 'archived', label: 'Lưu trữ' }
                          ].map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setClassStatusFilter(opt.id as any)}
                              className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                                classStatusFilter === opt.id
                                  ? 'bg-slate-800 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        <div className="text-xs font-semibold text-slate-500 shrink-0 px-1">
                          Hiển thị <strong className="text-slate-800">{filteredGradeClasses.length}</strong> / {gradeClasses.length} lớp
                        </div>
                      </div>

                      {/* Cards Grid */}
                      {filteredGradeClasses.length === 0 ? (
                        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-500">
                          <p className="font-bold text-base text-slate-700">
                            Không tìm thấy lớp học nào thuộc Khối {adminNavGrade} phù hợp với bộ lọc.
                          </p>
                          {classSearchQuery && (
                            <button
                              type="button"
                              onClick={() => {
                                setClassSearchQuery('');
                                setClassStatusFilter('all');
                              }}
                              className="mt-2 text-xs text-emerald-600 hover:underline font-bold cursor-pointer"
                            >
                              Xóa bộ lọc tìm kiếm
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {filteredGradeClasses.map((cls) => {
                            const isArchived = cls.status === 'archived';

                            return (
                              <div
                                key={cls.id}
                                onClick={() => handleSelectAdminClass(cls)}
                                className="group relative bg-white border-2 border-slate-200 hover:border-emerald-500 rounded-3xl p-5 shadow-sm hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between gap-4"
                              >
                                <div>
                                  {/* Top row */}
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <h4 className="text-lg font-black text-slate-900 group-hover:text-emerald-700 transition">
                                         {cls.name}
                                        </h4>
                                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-black rounded-lg">
                                          Khối {cls.grade}
                                        </span>
                                      </div>
                                      {isArchived ? (
                                        <span className="inline-block mt-1 px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded">
                                          Đã lưu trữ
                                        </span>
                                      ) : (
                                        <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded">
                                          Hoạt động
                                        </span>
                                      )}
                                    </div>

                                    {/* Quick Action Icons */}
                                    <div
                                      className="flex items-center gap-1"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => handleOpenAdminEditClass(cls)}
                                        className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                                        title="Sửa thông tin lớp"
                                        aria-label="Sửa thông tin lớp"
                                      >
                                        <Edit3 className="w-4 h-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleAdminClassArchive(cls)}
                                        className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                                        title={isArchived ? 'Khôi phục lớp' : 'Lưu trữ lớp'}
                                        aria-label={isArchived ? 'Khôi phục lớp' : 'Lưu trữ lớp'}
                                      >
                                        {isArchived ? (
                                          <RotateCcw className="w-4 h-4 text-emerald-600" />
                                        ) : (
                                          <Archive className="w-4 h-4" />
                                        )}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleAdminDeleteClassClick(cls)}
                                        className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                        title="Xóa lớp học"
                                        aria-label="Xóa lớp học"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Class Details summary */}
                                  <div className="space-y-2 mt-3 pt-3 border-t border-slate-100 text-xs">
                                    <div className="flex items-center justify-between text-slate-600">
                                      <span className="text-slate-400 font-semibold">Mã lớp:</span>
                                      <span className="font-mono font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                                        {cls.classCode}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between text-slate-600">
                                      <span className="text-slate-400 font-semibold">Giáo viên:</span>
                                      <span className="font-bold text-slate-800 truncate max-w-[150px]">
                                        {cls.teacherName || 'Chưa gán'}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between text-slate-600">
                                      <span className="text-slate-400 font-semibold">Sĩ số:</span>
                                      <span className="font-black text-slate-800">
                                        {cls.studentCount || 0} học sinh
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleSelectAdminClass(cls)}
                                  className="w-full py-2.5 px-3 bg-slate-900 group-hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                                >
                                  <span>Xem chi tiết lớp này</span>
                                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ========================================================= */}
            {/* LEVEL 4: THÔNG TIN LỚP (Shown ONLY when selectedAdminClass !== null) */}
            {/* ========================================================= */}
            {selectedAdminClass !== null && (
              <div className="space-y-5 animate-fade-in">
                {/* Level 4 Hero Banner */}
                <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-700 text-white rounded-3xl p-6 sm:p-8 shadow-md">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-3 py-1 bg-white/20 backdrop-blur-xs text-white text-xs font-black rounded-full uppercase tracking-wider">
                          Bước 4 / 4 — Hồ sơ lớp học
                        </span>
                        <span className="px-3 py-1 bg-white/10 text-white text-xs font-bold rounded-full">
                          Khối {selectedAdminClass.grade}
                        </span>
                        <span className="px-3 py-1 bg-white/10 text-white text-xs font-bold rounded-full">
                          Năm học {selectedAdminClass.academicYear || '2025-2026'}
                        </span>
                        {selectedAdminClass.status === 'archived' ? (
                          <span className="px-3 py-1 bg-amber-400 text-amber-950 text-xs font-black rounded-full">
                            Đã lưu trữ
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-emerald-400 text-emerald-950 text-xs font-black rounded-full">
                            Đang hoạt động
                          </span>
                        )}
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-black mt-2">
                         {selectedAdminClass.name}
                      </h3>
                      <p className="text-xs sm:text-sm text-emerald-100 font-medium mt-1">
                        Hồ sơ thông tin chi tiết và quyền quản trị cấp trường
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleBackToAdminClasses}
                      className="self-start sm:self-auto px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs rounded-xl backdrop-blur-xs transition inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Quay lại danh sách lớp</span>
                    </button>
                  </div>
                </div>

                {/* 4 Key Details Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {/* 1. Mã lớp */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase block">Mã lớp truy cập</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-xl font-black text-sky-700 tracking-wide">
                          {selectedAdminClass.classCode}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyClassCode(selectedAdminClass.classCode)}
                          className="p-1 text-slate-400 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition cursor-pointer"
                          title="Sao chép mã lớp"
                        >
                          {copiedClassCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium mt-2">
                      {copiedClassCode ? 'Đã sao chép vào bộ nhớ tạm!' : 'Mã tham gia lớp học'}
                    </span>
                  </div>

                  {/* 2. Giáo viên phụ trách */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase block">Giáo viên phụ trách</span>
                      <strong className="text-base font-black text-slate-800 block mt-1 truncate" title={selectedAdminClass.teacherName}>
                        {selectedAdminClass.teacherName || 'Chưa phân công'}
                      </strong>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium mt-2 truncate">
                      {selectedAdminClass.teacherUid ? `UID: ${selectedAdminClass.teacherUid.slice(0, 8)}...` : 'Chưa có tài khoản'}
                    </span>
                  </div>

                  {/* 3. Sĩ số học sinh */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase block">Sĩ số học sinh</span>
                      <strong className="text-xl font-black text-slate-800 block mt-1">
                        {selectedAdminClass.studentCount || 0} học sinh
                      </strong>
                    </div>
                    <span className="text-[11px] text-emerald-600 font-bold mt-2">
                      Đã cấp mã định danh
                    </span>
                  </div>

                  {/* 4. Bài đọc đã giao */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase block">Tình trạng học tập</span>
                      <strong className="text-base font-black text-slate-800 block mt-1">
                        {selectedAdminClass.hasAssignments ? 'Đã giao bài đọc' : 'Chưa có bài giao'}
                      </strong>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium mt-2">
                      Hệ thống Firestore an toàn
                    </span>
                  </div>
                </div>

                {/* Admin Actions Panel */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
                  <div className="border-b border-slate-100 pb-3">
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                      Thao tác Quản trị Lớp Học
                    </h4>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Chỉnh sửa thông tin, đổi trạng thái lưu trữ hoặc xóa lớp học khi thỏa điều kiện an toàn.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenAdminEditClass(selectedAdminClass)}
                      className="p-4 bg-slate-50 hover:bg-emerald-50 text-slate-800 hover:text-emerald-900 rounded-2xl border border-slate-200 hover:border-emerald-300 font-bold text-xs transition flex items-center gap-3 cursor-pointer group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white flex items-center justify-center transition shadow-xs">
                        <Edit3 className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <strong className="block text-sm font-black text-slate-900 group-hover:text-emerald-900">
                          Chỉnh Sửa Lớp
                        </strong>
                        <span className="text-[11px] text-slate-500 font-medium">
                          Đổi tên lớp, mã lớp hoặc năm học
                        </span>
                      </div>
                    </button>

                    {/* Archive/Restore Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleAdminClassArchive(selectedAdminClass)}
                      className="p-4 bg-slate-50 hover:bg-amber-50 text-slate-800 hover:text-amber-900 rounded-2xl border border-slate-200 hover:border-amber-300 font-bold text-xs transition flex items-center gap-3 cursor-pointer group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white text-amber-600 group-hover:bg-amber-600 group-hover:text-white flex items-center justify-center transition shadow-xs">
                        {selectedAdminClass.status === 'archived' ? (
                          <RotateCcw className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <Archive className="w-5 h-5" />
                        )}
                      </div>
                      <div className="text-left">
                        <strong className="block text-sm font-black text-slate-900 group-hover:text-amber-900">
                          {selectedAdminClass.status === 'archived' ? 'Khôi Phục Lớp' : 'Lưu Trữ Lớp'}
                        </strong>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {selectedAdminClass.status === 'archived'
                            ? 'Đưa lớp trở lại trạng thái hoạt động'
                            : 'Ngừng sử dụng khi hết năm học'}
                        </span>
                      </div>
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => handleAdminDeleteClassClick(selectedAdminClass)}
                      className="p-4 bg-slate-50 hover:bg-rose-50 text-slate-800 hover:text-rose-900 rounded-2xl border border-slate-200 hover:border-rose-300 font-bold text-xs transition flex items-center gap-3 cursor-pointer group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white text-rose-600 group-hover:bg-rose-600 group-hover:text-white flex items-center justify-center transition shadow-xs">
                        <Trash2 className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <strong className="block text-sm font-black text-slate-900 group-hover:text-rose-900">
                          Xóa Lớp Học
                        </strong>
                        <span className="text-[11px] text-slate-500 font-medium">
                          Chỉ xóa khi lớp chưa có học sinh/bài giao
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* Safety Notice Box */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start gap-3 text-slate-600 text-xs">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <strong className="font-bold text-slate-800 block">Quy tắc bảo vệ kết quả học tập của học sinh:</strong>
                      <p className="text-slate-500 leading-relaxed text-[11px]">
                        Hệ thống áp dụng cơ chế khóa an toàn nghiêm ngặt. Nếu lớp học đã có học sinh hoặc dữ liệu bài làm trên Firestore, hệ thống sẽ ngăn chặn việc xóa vĩnh viễn nhằm đảm bảo tính toàn vẹn minh chứng đọc hiểu. Để đóng lớp sau khi bế giảng năm học, vui lòng sử dụng chức năng <strong>Lưu trữ lớp</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Curriculum Bank (Grades 1-5) */}
        {activeTab === 'curriculum' && (
          <div className="space-y-6">
            <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Ngân hàng Khung Chương trình GDPT 2018 (Tiếng Việt 1–5)
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  Bộ sách: <strong>Kết nối tri thức với cuộc sống</strong> — Chuẩn hóa Yêu cầu cần đạt (YCCĐ)
                </p>
              </div>

              {/* Grade selector */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                {CURRICULUM_GRADES.map((g) => (
                  <button
                    key={g}
                    onClick={() => setSelectedCurriculumGrade(g)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      selectedCurriculumGrade === g
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Lớp {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Curriculum Nodes List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {curriculumNodes.map((node) => (
                <div
                  key={node.id}
                  className="p-5 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-3 relative hover:border-emerald-300 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full uppercase">
                        Khối {node.grade} · Tập {node.volume} · Tuần {node.week}
                      </span>
                      <h4 className="text-base font-black text-slate-900 mt-1.5">{node.lessonTitle}</h4>
                      <span className="text-xs text-slate-500 font-semibold block">
                        Chủ điểm: <strong>{node.theme}</strong>
                      </span>
                    </div>

                    <span className="px-2 py-0.5 bg-sky-100 text-sky-800 text-[10px] font-bold rounded">
                      {ACTIVITY_TYPE_LABELS[node.activityType] || node.activityType}
                    </span>
                  </div>

                  {/* Competency Goals */}
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[11px] font-bold text-slate-700 uppercase block mb-1.5">
                      Yêu cầu cần đạt (Chuẩn GDPT 2018):
                    </span>
                    <ul className="space-y-1">
                      {node.competencyGoals.map((goal, idx) => (
                        <li key={idx} className="text-xs text-slate-600 font-medium flex items-start gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{goal}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Reference Source */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                    <span className="truncate max-w-[280px]">Nguồn: {node.referenceSource}</span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px]">
                      Đã kiểm chứng
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Admin Profile & Password Change Modal */}
      <ProfileModal
        isOpen={showAdminProfileModal}
        onClose={() => setShowAdminProfileModal(false)}
      />

      {/* Modal: Admin Reset Teacher Password */}
      {resetTargetTeacher && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-teacher-title"
          className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 md:p-6 flex min-h-full items-center justify-center overscroll-contain animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setResetTargetTeacher(null);
          }}
        >
          <div className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 text-center space-y-4 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[min(88dvh,600px)] overflow-y-auto overscroll-contain">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto shrink-0">
              <Key className="w-6 h-6" />
            </div>
            <h3 id="reset-teacher-title" className="text-xl font-black text-slate-900">Đặt Lại Mật Khẩu Giáo Viên</h3>
            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
              Thiết lập mật khẩu mới cho giáo viên <strong className="text-slate-900">{resetTargetTeacher.displayName}</strong> ({resetTargetTeacher.email?.endsWith('@emytv.local') ? resetTargetTeacher.email.replace('@emytv.local', '') : resetTargetTeacher.email}).
            </p>

            <div className="text-left space-y-2">
              <label className="block text-xs font-bold text-slate-700">Mật khẩu mới (tối thiểu 6 ký tự):</label>
              <input
                type="text"
                value={newTeacherPasswordInput}
                onChange={(e) => setNewTeacherPasswordInput(e.target.value)}
                placeholder="GV123456"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white"
              />
              <p className="text-[10px] text-slate-500 italic">
                * Gợi ý mật khẩu mặc định: <strong>GV123456</strong>
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResetTargetTeacher(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmResetPassword}
                disabled={isResettingPass}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs transition disabled:opacity-50"
              >
                {isResettingPass ? 'Đang lưu...' : 'Xác nhận Đặt lại'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal: Admin Create Class (Gói A) */}
      {showAdminCreateClassModal && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-create-class-title"
          className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 md:p-6 flex min-h-full items-center justify-center overscroll-contain animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAdminCreateClassModal(false);
          }}
        >
          <div className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 text-left space-y-4 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[min(88dvh,600px)] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between">
              <h3 id="admin-create-class-title" className="text-xl font-black text-slate-900">Tạo Lớp Học Mới</h3>
              <button
                type="button"
                onClick={() => setShowAdminCreateClassModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdminCreateClass} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên lớp học</label>
                <input
                  type="text"
                  value={newAdminClassName}
                  onChange={(e) => setNewAdminClassName(e.target.value)}
                  placeholder="VD: Lớp 2A, Lớp 3B"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Năm học</label>
                <div className="flex gap-1.5 flex-wrap">
                  {Array.from(new Set([
                    ...academicYears.map((ay) => (typeof ay === 'string' ? ay : ay?.code || '')).filter(Boolean),
                    ...classes.map((c) => c.academicYear || '2025-2026').filter(Boolean),
                    ...(overview?.academicYearsList || []).filter(Boolean),
                    '2027-2028',
                    '2026-2027',
                    '2025-2026'
                  ])).filter((yr): yr is string => typeof yr === 'string' && yr.length > 0)
                    .sort((a, b) => (b || '').localeCompare(a || ''))
                    .map((yr) => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setNewAdminClassAcademicYear(yr)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                        newAdminClassAcademicYear === yr
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
                  value={newAdminClassAcademicYear}
                  onChange={(e) => setNewAdminClassAcademicYear(e.target.value)}
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
                    onClick={() => setNewAdminClassGrade(2)}
                    className={`p-3 rounded-xl font-black text-sm border transition ${
                      newAdminClassGrade === 2 ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Khối Lớp 2
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewAdminClassGrade(3)}
                    className={`p-3 rounded-xl font-black text-sm border transition ${
                      newAdminClassGrade === 3 ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Khối Lớp 3
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Giáo viên phụ trách</label>
                <select
                  value={newAdminClassTeacherUid}
                  onChange={(e) => setNewAdminClassTeacherUid(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white"
                >
                  <option value="">-- Mặc định (Giáo viên chính) --</option>
                  {teachers.map((t) => (
                    <option key={t.uid} value={t.uid}>
                      {t.displayName} ({t.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdminCreateClassModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isCreatingAdminClass}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow-md transition disabled:opacity-50"
                >
                  {isCreatingAdminClass ? 'Đang tạo...' : 'Tạo Lớp Ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal: Admin Edit Class (Gói A) */}
      {editingAdminClass && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-edit-class-title"
          className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 md:p-6 flex min-h-full items-center justify-center overscroll-contain animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingAdminClass(null);
          }}
        >
          <div className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 text-left space-y-4 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[min(88dvh,600px)] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <h3 id="admin-edit-class-title" className="text-xl font-black text-slate-900">Chỉnh Sửa Lớp Học</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingAdminClass(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdminClassEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên lớp học</label>
                <input
                  type="text"
                  value={adminEditClassName}
                  onChange={(e) => setAdminEditClassName(e.target.value)}
                  placeholder="VD: Lớp 2A"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Năm học</label>
                <div className="flex gap-1.5 flex-wrap">
                  {Array.from(new Set([
                    ...academicYears.map((ay) => (typeof ay === 'string' ? ay : ay?.code || '')).filter(Boolean),
                    ...classes.map((c) => c.academicYear || '2025-2026').filter(Boolean),
                    ...(overview?.academicYearsList || []).filter(Boolean),
                    '2027-2028',
                    '2026-2027',
                    '2025-2026'
                  ])).filter((yr): yr is string => typeof yr === 'string' && yr.length > 0)
                    .sort((a, b) => (b || '').localeCompare(a || ''))
                    .map((yr) => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setAdminEditClassAcademicYear(yr)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                        adminEditClassAcademicYear === yr
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
                  value={adminEditClassAcademicYear}
                  onChange={(e) => setAdminEditClassAcademicYear(e.target.value)}
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
                    onClick={() => setAdminEditClassGrade(2)}
                    className={`p-3 rounded-xl font-black text-sm border transition ${
                      adminEditClassGrade === 2 ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Khối Lớp 2
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminEditClassGrade(3)}
                    className={`p-3 rounded-xl font-black text-sm border transition ${
                      adminEditClassGrade === 3 ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
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
                  value={adminEditClassCode}
                  onChange={(e) => setAdminEditClassCode(e.target.value.toUpperCase())}
                  placeholder="VD: LOP2A"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 uppercase focus:bg-white focus:outline-none"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Mã lớp duy nhất trong toàn trường dùng để học sinh đăng nhập.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingAdminClass(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSavingAdminClassEdit}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow-md transition disabled:opacity-50"
                >
                  {isSavingAdminClassEdit ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal: Admin Delete / Archive Warning Class (Gói A) */}
      {adminDeleteClassTarget && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-delete-class-title"
          className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 md:p-6 flex min-h-full items-center justify-center overscroll-contain animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAdminDeleteClassTarget(null);
          }}
        >
          <div className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 text-left space-y-4 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[min(88dvh,600px)] overflow-y-auto overscroll-contain">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                adminDeleteClassBlockReason ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
              }`}>
                {adminDeleteClassBlockReason ? <AlertCircle className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
              </div>
              <div>
                <h3 id="admin-delete-class-title" className="text-lg font-black text-slate-900">
                  {adminDeleteClassBlockReason ? 'Bảo Vệ Lịch Sử Lớp Toàn Trường' : 'Xác Nhận Xóa Lớp'}
                </h3>
                <p className="text-xs text-slate-500 font-semibold">
                  {adminDeleteClassTarget.name} ({adminDeleteClassTarget.classCode})
                </p>
              </div>
            </div>

            {adminDeleteClassBlockReason ? (
              <div className="space-y-3">
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 font-medium leading-relaxed">
                  {adminDeleteClassBlockReason}
                </div>
                <p className="text-[11px] text-slate-500">
                  Chính sách an toàn cấp quản trị: Tuyệt đối không xóa lớp đã phát sinh bài làm để giữ vững tính toàn vẹn của số liệu nghiên cứu và nghiệm thu.
                </p>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAdminDeleteClassTarget(null)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const target = adminDeleteClassTarget;
                      setAdminDeleteClassTarget(null);
                      handleToggleAdminClassArchive(target);
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
                  Lớp học này hiện <strong>chưa có học sinh và chưa có bài tập nào</strong>. Bạn có chắc chắn muốn xóa vĩnh viễn lớp <strong className="text-slate-900">{adminDeleteClassTarget.name}</strong> không?
                </p>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800 font-semibold">
                  Lưu ý: Thao tác này không thể hoàn tác sau khi xác nhận.
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAdminDeleteClassTarget(null)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={isDeletingAdminClass}
                    onClick={handleConfirmAdminDeleteClass}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs shadow-md transition disabled:opacity-50"
                  >
                    {isDeletingAdminClass ? 'Đang xóa...' : 'Xác Nhận Xóa'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL: TẠO NĂM HỌC MỚI (ADMIN ONLY) */}
      {/* ========================================================= */}
      {showCreateYearModal && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Thiết Lập Năm Học Mới</h3>
                  <p className="text-xs text-slate-500 font-medium">Cấu hình niên khóa quản trị cho toàn trường</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateYearModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateYear} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mã năm học <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: 2028-2029"
                  pattern="\d{4}-\d{4}"
                  value={newYearCode}
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    setNewYearCode(val);
                    if (!newYearName || newYearName.startsWith('Năm học ')) {
                      setNewYearName(val ? `Năm học ${val}` : '');
                    }
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-emerald-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Định dạng 4 số - 4 số (ví dụ: 2028-2029)</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên hiển thị
                </label>
                <input
                  type="text"
                  placeholder="VD: Năm học 2028-2029"
                  value={newYearName}
                  onChange={(e) => setNewYearName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mô tả / Ghi chú kế hoạch
                </label>
                <textarea
                  rows={2}
                  placeholder="VD: Kế hoạch mở rộng thực nghiệm đọc hiểu tiếng Việt..."
                  value={newYearDescription}
                  onChange={(e) => setNewYearDescription(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-emerald-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="newYearIsCurrent"
                  checked={newYearIsCurrent}
                  onChange={(e) => setNewYearIsCurrent(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <label htmlFor="newYearIsCurrent" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Đặt làm năm học hiện tại của hệ thống
                </label>
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateYearModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creatingYear}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow-md transition disabled:opacity-50"
                >
                  {creatingYear ? 'Đang tạo...' : 'Tạo Năm Học'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL: SỬA THÔNG TIN NĂM HỌC (ADMIN ONLY) */}
      {/* ========================================================= */}
      {editingYear && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Sửa Năm Học {editingYear.code}</h3>
                  <p className="text-xs text-slate-500 font-medium">Cập nhật thông tin niên khóa</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingYear(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateYear} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mã năm học (Cố định)
                </label>
                <input
                  type="text"
                  disabled
                  value={editingYear.code}
                  className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên hiển thị <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editYearName}
                  onChange={(e) => setEditYearName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mô tả / Ghi chú
                </label>
                <textarea
                  rows={2}
                  value={editYearDescription}
                  onChange={(e) => setEditYearDescription(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-sky-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Trạng thái niên khóa
                </label>
                <select
                  value={editYearStatus}
                  onChange={(e) => setEditYearStatus(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-sky-500"
                >
                  <option value="active">Đang hoạt động</option>
                  <option value="archived" disabled={editingYear.isCurrent}>
                    Lưu trữ {editingYear.isCurrent ? '(Không thể lưu trữ năm hiện tại)' : ''}
                  </option>
                </select>
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingYear(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingYearEdit}
                  className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-black rounded-xl text-xs shadow-md transition disabled:opacity-50"
                >
                  {savingYearEdit ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL: XÓA NĂM HỌC (DEPENDENCY GUARD CHECK) */}
      {/* ========================================================= */}
      {deleteYearTarget && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            {deleteYearTarget.totalClasses > 0 ? (
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <h4 className="text-lg font-black text-slate-900">Không Thể Xóa Năm Học</h4>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    Năm học <strong className="text-slate-900">{deleteYearTarget.code}</strong> đang có{' '}
                    <strong className="text-amber-700 font-bold">{deleteYearTarget.totalClasses} lớp học</strong> trực thuộc với dữ liệu học sinh, bài giao và kết quả đánh giá liên quan.
                  </p>
                  <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 text-left">
                    💡 <strong>Hướng dẫn bảo toàn:</strong> Để bảo toàn tính toàn vẹn dữ liệu, hãy chuyển các lớp sang năm học khác (sử dụng chức năng sửa lớp học) hoặc xóa các lớp trước khi xóa niên khóa này.
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setDeleteYearTarget(null)}
                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
                  >
                    Đã hiểu & Đóng
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <h4 className="text-lg font-black text-slate-900">Xác Nhận Xóa Năm Học</h4>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    Bạn có chắc chắn muốn xóa năm học trống <strong className="text-slate-900">{deleteYearTarget.code}</strong>?
                  </p>
                  <p className="text-[11px] text-rose-600 mt-1 font-semibold">
                    Thao tác này sẽ xóa cấu hình niên khóa khỏi hệ thống và không thể hoàn tác.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    disabled={deletingYear}
                    onClick={() => setDeleteYearTarget(null)}
                    className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={deletingYear}
                    onClick={handleDeleteYear}
                    className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {deletingYear ? 'Đang xóa...' : 'Xác nhận xóa'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL: LƯU TRỮ / KHÔI PHỤC NIÊN KHÓA (CONFIRM) */}
      {/* ========================================================= */}
      {archiveYearTarget && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <Archive className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h4 className="text-lg font-black text-slate-900">
                {archiveYearTarget.newStatus === 'archived' ? 'Lưu Trữ Niên Khóa' : 'Khôi Phục Niên Khóa'}
              </h4>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {archiveYearTarget.newStatus === 'archived'
                  ? `Bạn có chắc chắn muốn lưu trữ năm học ${archiveYearTarget.year.code}? Niên khóa sẽ được đánh dấu lưu trữ trong toàn hệ thống.`
                  : `Khôi phục năm học ${archiveYearTarget.year.code} về trạng thái hoạt động bình thường?`}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={archivingYear}
                onClick={() => setArchiveYearTarget(null)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={archivingYear}
                onClick={handleToggleArchiveYear}
                className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black text-xs transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                {archivingYear ? 'Đang xử lý...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};


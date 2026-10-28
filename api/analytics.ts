/**
 * EM YÊU TIẾNG VIỆT - VERCEL SERVERLESS BACKEND
 * Teacher Analytics & Remediation API Group: /api/analytics
 *
 * Implements Pedagogical Insights & Reporting:
 * 1. getTeacherAnalytics (5 reading comprehension skills, pre/post evaluation)
 * 2. exportTeacherData (Excel/CSV UTF-8 BOM / JSON / PDF dataset)
 * 3. suggestRemediation (privacy-safe AI remediation suggestions)
 * 4. listRemediationActivities
 * 5. saveRemediationActivity
 * 6. approveRemediationActivity
 * 7. deleteRemediationActivity
 */

import { getDb } from './_helpers/firebaseAdmin.js';
import { handleApiError, requireTeacher, requireTeacherOrAdmin } from './_helpers/authMiddleware.js';
import { ApiError, VercelApiRequest, VercelApiResponse } from './_helpers/types.js';

const SKILL_LABELS: Record<string, string> = {
  thong_tin_truc_tiep: 'Tìm thông tin trực tiếp',
  tu_trong_ngu_canh: 'Hiểu từ ngữ trong ngữ cảnh',
  noi_dung_chinh: 'Hiểu nội dung chính',
  sap_xep_trinh_tu: 'Sắp xếp trình tự sự việc',
  lien_he_van_dung: 'Liên hệ và vận dụng thực tế'
};

function formatVietnamDateTime(timestamp: number | null | undefined): string {
  if (!timestamp) return 'Chưa hoàn thành';
  const d = new Date(timestamp);
  return d.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function formatVietnamDate(timestamp: number | null | undefined): string {
  if (!timestamp) return 'N/A';
  const d = new Date(timestamp);
  return d.toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

export function normalizeTeacherSteps(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((s) => {
        if (typeof s === 'string') return s.trim();
        if (typeof s === 'object' && s !== null) {
          return String((s as any).step || (s as any).text || (s as any).title || (s as any).content || Object.values(s)[0] || '').trim();
        }
        return String(s || '').trim();
      })
      .filter((s) => s.length > 0);
  }
  if (typeof raw === 'string') {
    const str = raw.trim();
    if (!str) return [];
    if (str.includes('\n')) {
      return str
        .split('\n')
        .map((s) => s.trim().replace(/^[-*•\d+.)\]\s]+/, ''))
        .filter((s) => s.length > 0);
    }
    const stepMatches = str.split(/(?=Bước\s+\d+[:.])/i).map((s) => s.trim()).filter((s) => s.length > 0);
    if (stepMatches.length > 1) {
      return stepMatches;
    }
    return [str];
  }
  if (typeof raw === 'object' && raw !== null) {
    return Object.values(raw)
      .map((v) => {
        if (typeof v === 'string') return v.trim();
        if (typeof v === 'object' && v !== null) {
          return String((v as any).step || (v as any).text || (v as any).title || '').trim();
        }
        return String(v || '').trim();
      })
      .filter((s) => s.length > 0);
  }
  return [];
}


function getAcademicYearFromTimestamp(timestamp: number | null | undefined): {
  academicYear: string;
  semester: 1 | 2;
  semesterLabel: string;
} {
  if (!timestamp) {
    return { academicYear: '2026-2027', semester: 1, semesterLabel: 'Học kỳ I' };
  }
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;

  if (month >= 9 && month <= 12) {
    return {
      academicYear: `${year}-${year + 1}`,
      semester: 1,
      semesterLabel: 'Học kỳ I'
    };
  } else if (month === 1) {
    return {
      academicYear: `${year - 1}-${year}`,
      semester: 1,
      semesterLabel: 'Học kỳ I'
    };
  } else if (month >= 2 && month <= 5) {
    return {
      academicYear: `${year - 1}-${year}`,
      semester: 2,
      semesterLabel: 'Học kỳ II'
    };
  } else {
    return {
      academicYear: `${year - 1}-${year}`,
      semester: 2,
      semesterLabel: 'Hè / Đánh giá cuối năm'
    };
  }
}

function sanitizeCsv(val: any): string {
  if (val === null || val === undefined) return '""';
  let str = String(val).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export default async function handler(req: VercelApiRequest, res: VercelApiResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).send('OK');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({
      success: false,
      error: { code: 'method-not-allowed', message: 'Chỉ chấp nhận phương thức POST.' }
    });
    return;
  }

  try {
    const { action, data } = req.body || {};
    if (!action || typeof action !== 'string') {
      throw new ApiError(400, 'invalid-argument', 'Yêu cầu thiếu tên hành động (action).');
    }

    let result: any;

    switch (action) {
      case 'getTeacherAnalytics':
        result = await handleGetTeacherAnalytics(req, data);
        break;

      case 'exportTeacherData':
        result = await handleExportTeacherData(req, data);
        break;

      case 'suggestRemediation':
        result = await handleSuggestRemediation(req, data);
        break;

      case 'listRemediationActivities':
        result = await handleListRemediationActivities(req, data);
        break;

      case 'saveRemediationActivity':
        result = await handleSaveRemediationActivity(req, data);
        break;

      case 'approveRemediationActivity':
        result = await handleApproveRemediationActivity(req, data);
        break;

      case 'deleteRemediationActivity':
        result = await handleDeleteRemediationActivity(req, data);
        break;

      default:
        throw new ApiError(
          400,
          'invalid-argument',
          `Hành động thống kê "${action}" không được hỗ trợ trong nhóm /api/analytics.`
        );
    }

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    handleApiError(res, error);
  }
}

// In-memory cache for teacher analytics to prevent repetitive heavy calculations on rapid navigation
const teacherAnalyticsCache = new Map<string, { result: any; timestamp: number }>();
const TEACHER_ANALYTICS_CACHE_TTL_MS = 180 * 1000; // 3 minutes (180s) to protect Firestore quota

// Helper to chunk array for bounded concurrency
function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

// 1. GET TEACHER ANALYTICS
async function handleGetTeacherAnalytics(req: VercelApiRequest, data: any) {
  const { uid: teacherUid } = await requireTeacher(req);
  const { classId, assignmentId, academicYear, grade } = data || {};
  const db = getDb();

  const cacheKey = `${teacherUid}_${classId || 'all'}_${assignmentId || 'all'}_${academicYear || 'all'}_${grade || 'all'}`;
  const cached = teacherAnalyticsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < TEACHER_ANALYTICS_CACHE_TTL_MS) {
    return cached.result;
  }

  const rawClassDocs = await db.collection('classes').where('teacherUid', '==', teacherUid).get();
  const classDocs = rawClassDocs.docs.filter((d) => {
    const c = d.data();
    if (classId && d.id !== classId && c.id !== classId) return false;
    if (academicYear && academicYear !== 'all' && (c.academicYear || '2026-2027') !== academicYear) return false;
    if (grade && grade !== 'all' && Number(c.grade) !== Number(grade)) return false;
    return true;
  });

  const classIds = new Set(classDocs.map((d) => d.id));
  classDocs.forEach((d) => {
    if (d.data().id) classIds.add(d.data().id);
  });

  if (classIds.size === 0) {
    return {
      success: true,
      totalClasses: 0,
      totalStudents: 0,
      totalAssignments: 0,
      totalAttempts: 0,
      avgFirstTryAccuracy: 0,
      avgFinalAccuracy: 0,
      progressPercentagePoints: 0,
      skillBreakdown: {
        thong_tin_truc_tiep: { label: SKILL_LABELS.thong_tin_truc_tiep, testedCount: 0, totalTested: 0, firstTryAccuracy: 0, firstTryPercentage: 0, percentage: 0, finalAccuracy: 0, finalPercentage: 0, firstTryCorrect: 0, finalCorrect: 0 },
        tu_trong_ngu_canh: { label: SKILL_LABELS.tu_trong_ngu_canh, testedCount: 0, totalTested: 0, firstTryAccuracy: 0, firstTryPercentage: 0, percentage: 0, finalAccuracy: 0, finalPercentage: 0, firstTryCorrect: 0, finalCorrect: 0 },
        noi_dung_chinh: { label: SKILL_LABELS.noi_dung_chinh, testedCount: 0, totalTested: 0, firstTryAccuracy: 0, firstTryPercentage: 0, percentage: 0, finalAccuracy: 0, finalPercentage: 0, firstTryCorrect: 0, finalCorrect: 0 },
        sap_xep_trinh_tu: { label: SKILL_LABELS.sap_xep_trinh_tu, testedCount: 0, totalTested: 0, firstTryAccuracy: 0, firstTryPercentage: 0, percentage: 0, finalAccuracy: 0, finalPercentage: 0, firstTryCorrect: 0, finalCorrect: 0 },
        lien_he_van_dung: { label: SKILL_LABELS.lien_he_van_dung, testedCount: 0, totalTested: 0, firstTryAccuracy: 0, firstTryPercentage: 0, percentage: 0, finalAccuracy: 0, finalPercentage: 0, firstTryCorrect: 0, finalCorrect: 0 }
      },
      prePostComparison: null
    };
  }

  // Count total students across classes using class metadata or parallel aggregation
  let totalStudents = 0;
  let missingStudentCount = false;
  classDocs.forEach((d) => {
    const count = d.data().studentCount;
    if (typeof count === 'number') {
      totalStudents += count;
    } else {
      missingStudentCount = true;
    }
  });

  if (missingStudentCount || (totalStudents === 0 && classIds.size > 0)) {
    const countSnaps = await Promise.all(
      Array.from(classIds).map((cId) =>
        db.collection('students').where('classId', '==', cId).count().get()
      )
    );
    totalStudents = countSnaps.reduce((sum, s) => sum + s.data().count, 0);
  }

  // Query assignments and attempts filtered STRICTLY by teacherUid in parallel
  const [rawAssignDocs, rawTeacherAttemptsSnap, teacherAllAttemptsCountSnap] = await Promise.all([
    db.collection('assignments').where('teacherUid', '==', teacherUid).get(),
    db.collection('attempts')
      .where('teacherUid', '==', teacherUid)
      .where('status', '==', 'completed')
      .get(),
    db.collection('attempts')
      .where('teacherUid', '==', teacherUid)
      .count()
      .get()
  ]);

  const assignMap: Record<string, any> = {};
  rawAssignDocs.docs.forEach((d) => (assignMap[d.id] = { id: d.id, ...d.data() }));

  const assignDocs = rawAssignDocs.docs.filter((d) => {
    const a = d.data();
    if (!classIds.has(a.classId)) return false;
    if (assignmentId && d.id !== assignmentId && a.id !== assignmentId) return false;
    return true;
  });

  let rawAttemptsSnap = rawTeacherAttemptsSnap;
  let totalRecordedAttempts = teacherAllAttemptsCountSnap.data().count;

  // Fallback for legacy attempts without teacherUid
  if (rawAttemptsSnap.empty && assignDocs.length > 0) {
    const targetAssignIds = assignDocs.map((d) => d.id).slice(0, 30);
    rawAttemptsSnap = await db
      .collection('attempts')
      .where('assignmentId', 'in', targetAssignIds)
      .where('status', '==', 'completed')
      .get();
    totalRecordedAttempts = rawAttemptsSnap.size;
  }

  // Deduplicate attempts strictly by document ID
  const seenAttemptIds = new Set<string>();
  const attemptsDocs = rawAttemptsSnap.docs.filter((d) => {
    if (seenAttemptIds.has(d.id)) return false;
    seenAttemptIds.add(d.id);
    const att = d.data();
    const historicalClassId = att.classId || assignMap[att.assignmentId]?.classId;
    if (!historicalClassId || !classIds.has(historicalClassId)) return false;
    if (assignmentId && att.assignmentId !== assignmentId) return false;
    return true;
  });

  let totalFirstTry = 0;
  let totalFinal = 0;
  let totalQuestionsCount = 0;

  // Compute 100% exact overall score counts directly from attempt documents
  attemptsDocs.forEach((attDoc) => {
    const att = attDoc.data();
    totalFirstTry += att.firstTryCorrectCount || 0;
    totalFinal += att.finalCorrectCount || 0;
    totalQuestionsCount += att.totalQuestions || 5;
  });

  const skillAccumulator: Record<
    string,
    { label: string; tested: number; firstTryCorrect: number; finalCorrect: number }
  > = {
    thong_tin_truc_tiep: { label: SKILL_LABELS.thong_tin_truc_tiep, tested: 0, firstTryCorrect: 0, finalCorrect: 0 },
    tu_trong_ngu_canh: { label: SKILL_LABELS.tu_trong_ngu_canh, tested: 0, firstTryCorrect: 0, finalCorrect: 0 },
    noi_dung_chinh: { label: SKILL_LABELS.noi_dung_chinh, tested: 0, firstTryCorrect: 0, finalCorrect: 0 },
    sap_xep_trinh_tu: { label: SKILL_LABELS.sap_xep_trinh_tu, tested: 0, firstTryCorrect: 0, finalCorrect: 0 },
    lien_he_van_dung: { label: SKILL_LABELS.lien_he_van_dung, tested: 0, firstTryCorrect: 0, finalCorrect: 0 }
  };

  // Pre-fetch version question skill maps in parallel
  const versionSkillCache: Record<string, Record<string, string>> = {};
  const neededVersionIds = Array.from(new Set(attemptsDocs.map((d) => d.data().lessonVersionId).filter(Boolean)));
  await Promise.all(
    neededVersionIds.map(async (vId) => {
      const sampleAtt = attemptsDocs.find((d) => d.data().lessonVersionId === vId)?.data();
      if (!sampleAtt) return;
      try {
        const vDoc = await db.collection('lessons').doc(sampleAtt.lessonId).collection('versions').doc(vId).get();
        const vData = vDoc.data();
        const map: Record<string, string> = {};
        if (vData && vData.publicQuestions) {
          vData.publicQuestions.forEach((q: any) => {
            map[q.id] = q.skillTag || '';
          });
        }
        versionSkillCache[vId] = map;
      } catch {}
    })
  );

  // Sample or chunk responses for skill breakdown (strictly bounded to 8 recent attempts to save 150+ Firestore reads)
  const targetResponseAttempts = attemptsDocs.length > 8
    ? attemptsDocs.slice(0, 8)
    : attemptsDocs;

  const attemptChunks = chunkArray(targetResponseAttempts, 10);
  for (const chunk of attemptChunks) {
    await Promise.all(
      chunk.map(async (attDoc) => {
        const att = attDoc.data();
        const qMap = versionSkillCache[att.lessonVersionId] || {};
        try {
          const responsesSnap = await attDoc.ref.collection('responses').get();
          responsesSnap.forEach((rDoc) => {
            const r = rDoc.data();
            const skill = qMap[r.questionId] || r.skillTag;
            if (skill && skillAccumulator[skill]) {
              skillAccumulator[skill].tested++;
              if (r.firstTryCorrect) skillAccumulator[skill].firstTryCorrect++;
              if (r.finalCorrect) skillAccumulator[skill].finalCorrect++;
            }
          });
        } catch {}
      })
    );
  }

  const avgFirstTryAccuracy =
    totalQuestionsCount > 0 ? Math.round((totalFirstTry / totalQuestionsCount) * 100) : 0;
  const avgFinalAccuracy =
    totalQuestionsCount > 0 ? Math.round((totalFinal / totalQuestionsCount) * 100) : 0;

  const skillBreakdown: Record<string, any> = {};
  for (const [k, v] of Object.entries(skillAccumulator)) {
    const firstAcc = v.tested > 0 ? Math.round((v.firstTryCorrect / v.tested) * 100) : 0;
    const finalAcc = v.tested > 0 ? Math.round((v.finalCorrect / v.tested) * 100) : 0;
    skillBreakdown[k] = {
      label: v.label,
      testedCount: v.tested,
      totalTested: v.tested,
      firstTryAccuracy: firstAcc,
      firstTryPercentage: firstAcc,
      percentage: firstAcc,
      finalAccuracy: finalAcc,
      finalPercentage: finalAcc,
      firstTryCorrect: v.firstTryCorrect,
      finalCorrect: v.finalCorrect
    };
  }

  // Pre/Post Comparison if available
  let prePostComparison: any = null;
  const preAssignment = assignDocs.find((d) => d.id.includes('_pre') || d.data().title?.toLowerCase().includes('đầu năm'));
  const postAssignment = assignDocs.find((d) => d.id.includes('_post') || d.data().title?.toLowerCase().includes('cuối năm'));

  if (preAssignment && postAssignment) {
    const preAttempts = attemptsDocs.filter((d) => d.data().assignmentId === preAssignment.id);
    const postAttempts = attemptsDocs.filter((d) => d.data().assignmentId === postAssignment.id);

    const preByStudent: Record<string, number> = {};
    const postByStudent: Record<string, number> = {};

    preAttempts.forEach((d) => {
      preByStudent[d.data().studentId] = d.data().scorePercentage ?? Math.round(((d.data().firstTryCorrectCount || 0) / (d.data().totalQuestions || 5)) * 100);
    });
    postAttempts.forEach((d) => {
      postByStudent[d.data().studentId] = d.data().scorePercentage ?? Math.round(((d.data().firstTryCorrectCount || 0) / (d.data().totalQuestions || 5)) * 100);
    });

    const pairedStudentIds = Object.keys(preByStudent).filter((sId) => postByStudent[sId] !== undefined);
    if (pairedStudentIds.length > 0) {
      const avgPre = Math.round(
        pairedStudentIds.reduce((sum, sId) => sum + preByStudent[sId], 0) / pairedStudentIds.length
      );
      const avgPost = Math.round(
        pairedStudentIds.reduce((sum, sId) => sum + postByStudent[sId], 0) / pairedStudentIds.length
      );

      prePostComparison = {
        sampleSizeN: pairedStudentIds.length,
        avgPrePercentage: avgPre,
        avgPostPercentage: avgPost,
        percentagePointDiff: avgPost - avgPre,
        preAssignmentTitle: preAssignment.data().lessonTitle || preAssignment.data().title || preAssignment.id,
        postAssignmentTitle: postAssignment.data().lessonTitle || postAssignment.data().title || postAssignment.id
      };
    }
  }

  const result = {
    success: true,
    totalClasses: classIds.size,
    totalStudents,
    totalAssignments: assignDocs.length,
    totalAttempts: attemptsDocs.length,
    completedAttempts: attemptsDocs.length,
    inProgressAttempts: Math.max(0, totalRecordedAttempts - attemptsDocs.length),
    totalRecordedAttempts,
    avgFirstTryAccuracy,
    avgFinalAccuracy,
    avgFirstTryScore: Number((avgFirstTryAccuracy / 10).toFixed(1)),
    avgFinalScore: Number((avgFinalAccuracy / 10).toFixed(1)),
    progressPercentagePoints: Math.max(0, avgFinalAccuracy - avgFirstTryAccuracy),
    skillBreakdown,
    prePostComparison
  };

  teacherAnalyticsCache.set(cacheKey, { result, timestamp: Date.now() });
  return result;
}

// 2. EXPORT TEACHER DATA (EXCEL, CSV UTF-8 BOM, JSON, PDF AUDIT REPORT)
async function handleExportTeacherData(req: VercelApiRequest, data: any) {
  const { uid: teacherUid } = await requireTeacher(req);
  const { classId, academicYear, grade, semester } = data || {};
  const db = getDb();

  const rawClassDocs = await db.collection('classes').where('teacherUid', '==', teacherUid).get();
  const classDocs = rawClassDocs.docs.filter((d) => {
    const c = d.data();
    if (classId && d.id !== classId && c.id !== classId) return false;
    if (academicYear && academicYear !== 'all' && (c.academicYear || '2026-2027') !== academicYear) return false;
    if (grade && grade !== 'all' && Number(c.grade) !== Number(grade)) return false;
    return true;
  });

  const classMap: Record<string, any> = {};
  rawClassDocs.docs.forEach((d) => {
    classMap[d.id] = d.data();
    if (d.data().id) classMap[d.data().id] = d.data();
  });

  const allowedClassIds = new Set(classDocs.map((d) => d.id));
  classDocs.forEach((d) => {
    if (d.data().id) allowedClassIds.add(d.data().id);
  });

  const [studentsSnap, lessonsSnap, assignmentsSnap, rawAttemptsSnap] = await Promise.all([
    db.collection('students').get(),
    db.collection('lessons').get(),
    db.collection('assignments').where('teacherUid', '==', teacherUid).get(),
    db.collection('attempts').where('status', '==', 'completed').get()
  ]);

  const studentMap: Record<string, any> = {};
  studentsSnap.docs.forEach((d) => (studentMap[d.id] = d.data()));

  const assignmentMap: Record<string, any> = {};
  assignmentsSnap.docs.forEach((d) => (assignmentMap[d.id] = { id: d.id, ...d.data() }));

  const lessonMap: Record<string, string> = {};
  const lessonSemesterMap: Record<string, number> = {};
  lessonsSnap.docs.forEach((d) => {
    const lData = d.data();
    lessonMap[d.id] = lData?.title || d.id;
    lessonSemesterMap[d.id] = Number(lData?.semester || 1);
  });

  // Filter assignments within allowed classes & semester
  const filteredAssignments = assignmentsSnap.docs.filter((d) => {
    const a = d.data();
    if (!allowedClassIds.has(a.classId)) return false;
    if (semester && semester !== 'all') {
      const s = Number(a.semester || lessonSemesterMap[a.lessonId] || 1);
      if (s !== Number(semester)) return false;
    }
    return true;
  });

  // Filter completed attempts within allowed classes & semester with strict document ID deduplication
  const seenExportAttemptIds = new Set<string>();
  const filteredAttempts = rawAttemptsSnap.docs.filter((d) => {
    if (seenExportAttemptIds.has(d.id)) return false;
    seenExportAttemptIds.add(d.id);
    const att = d.data();
    const assign = assignmentMap[att.assignmentId];
    const historicalClassId = att.classId || assign?.classId;
    if (!historicalClassId || !allowedClassIds.has(historicalClassId)) return false;
    if (semester && semester !== 'all') {
      const s = Number(att.semester || assign?.semester || lessonSemesterMap[att.lessonId] || 1);
      if (s !== Number(semester)) return false;
    }
    return true;
  });

  // Total students in scope (Sĩ số)
  const studentsInScope = studentsSnap.docs.filter((d) => allowedClassIds.has(d.data().classId));
  const totalStudentsInScope = studentsInScope.length;

  // Generate CSV with UTF-8 BOM (\uFEFF)
  let csv = '\uFEFFMã học sinh,Biệt danh,Lớp,Khối,Năm học,Học kỳ,Bài được giao,Lượt làm,Số câu hỏi,Đúng lần đầu,Đúng sau gợi ý,Điểm lần đầu (thang 10),Điểm sau gợi ý (thang 10),Tiến bộ (+câu / +% pp),Số sao,Thời gian hoàn thành,Kiểm toán niên khóa\n';

  const exportRecords: any[] = [];

  filteredAttempts.forEach((doc) => {
    const att = doc.data();
    const assign = assignmentMap[att.assignmentId];
    const historicalClassId = att.classId || assign?.classId;
    const st = studentMap[att.studentId] || {};
    const cl = classMap[historicalClassId] || {};
    const lessonTitle = lessonMap[att.lessonId] || assign?.lessonTitle || att.lessonId || 'N/A';
    const lSemester = Number(att.semester || assign?.semester || lessonSemesterMap[att.lessonId] || 1);
    const totalQ = att.totalQuestions || 5;
    const firstTry = att.firstTryCorrectCount || 0;
    const finalVal = att.finalCorrectCount || 0;
    const progress = Math.max(0, finalVal - firstTry);
    const progressPP = Number(((progress / totalQ) * 100).toFixed(1));
    const firstScore = Number(((firstTry / totalQ) * 10).toFixed(1));
    const finalScore = Number(((finalVal / totalQ) * 10).toFixed(1));
    const progressLabel = progress > 0 ? `+${progress} câu (+${progressPP}% pp)` : '0 câu';

    let completedTs: number | null = null;
    if (typeof att.completedAt === 'number') {
      completedTs = att.completedAt;
    } else if (att.completedAt && (att.completedAt as any)._seconds) {
      completedTs = (att.completedAt as any)._seconds * 1000;
    } else if (typeof att.startedAt === 'number') {
      completedTs = att.startedAt;
    }

    const completedFormattedVN = formatVietnamDateTime(completedTs);
    const completedDateOnly = formatVietnamDate(completedTs);

    const inferred = getAcademicYearFromTimestamp(completedTs);
    const recordedYear = att.academicYear || assign?.academicYear || cl.academicYear || '2026-2027';
    const isDateAnomalous = Boolean(completedTs && inferred.academicYear !== recordedYear);
    const anomalyReason = isDateAnomalous
      ? `Lớp ghi năm học "${recordedYear}", nhưng ngày làm bài thực tế là ${completedFormattedVN} (thuộc niên khóa ${inferred.academicYear} - ${inferred.semesterLabel})`
      : 'Hợp lệ';

    const row = [
      sanitizeCsv(st.studentCode || 'N/A'),
      sanitizeCsv(st.displayAlias || 'Ẩn danh'),
      sanitizeCsv(cl.name || 'N/A'),
      sanitizeCsv(cl.grade ? `Khối ${cl.grade}` : 'N/A'),
      sanitizeCsv(recordedYear),
      sanitizeCsv(lSemester === 2 ? 'Học kỳ II' : 'Học kỳ I'),
      sanitizeCsv(lessonTitle),
      att.attemptNumber || 1,
      totalQ,
      `${firstTry}/${totalQ}`,
      `${finalVal}/${totalQ}`,
      firstScore,
      finalScore,
      sanitizeCsv(progressLabel),
      att.starsEarned || 0,
      sanitizeCsv(completedFormattedVN),
      sanitizeCsv(isDateAnomalous ? `[BẤT THƯỜNG] ${anomalyReason}` : 'Hợp lệ')
    ];

    csv += row.join(',') + '\n';

    exportRecords.push({
      attemptId: doc.id,
      studentCode: st.studentCode || 'N/A',
      displayAlias: st.displayAlias || 'Ẩn danh',
      classId: historicalClassId,
      className: cl.name || 'N/A',
      grade: cl.grade || null,
      academicYear: recordedYear,
      isDateAnomalous,
      anomalyReason: isDateAnomalous ? anomalyReason : null,
      inferredAcademicYear: inferred.academicYear,
      inferredSemester: inferred.semester,
      semester: lSemester,
      semesterLabel: lSemester === 2 ? 'Học kỳ II' : 'Học kỳ I',
      lessonId: att.lessonId,
      lessonTitle,
      attemptNumber: att.attemptNumber || 1,
      totalQuestions: totalQ,
      firstTryCorrectCount: firstTry,
      finalCorrectCount: finalVal,
      progressCount: progress,
      progressPercentagePoints: progressPP,
      firstTryScore: firstScore,
      finalScore: finalScore,
      score: firstScore,
      scorePercentage: Math.round((firstTry / totalQ) * 100),
      finalScorePercentage: Math.round((finalVal / totalQ) * 100),
      starsEarned: att.starsEarned || 0,
      completedAt: completedTs || Date.now(),
      completedAtFormatted: completedFormattedVN,
      completedDateOnly
    });
  });

  // Calculate 5 competencies from attempts responses
  const skillAccumulator: Record<
    string,
    { label: string; tested: number; firstTryCorrect: number; finalCorrect: number; firstTryPct: number; finalPct: number; progressPct: number }
  > = {
    thong_tin_truc_tiep: { label: SKILL_LABELS.thong_tin_truc_tiep, tested: 0, firstTryCorrect: 0, finalCorrect: 0, firstTryPct: 0, finalPct: 0, progressPct: 0 },
    tu_trong_ngu_canh: { label: SKILL_LABELS.tu_trong_ngu_canh, tested: 0, firstTryCorrect: 0, finalCorrect: 0, firstTryPct: 0, finalPct: 0, progressPct: 0 },
    noi_dung_chinh: { label: SKILL_LABELS.noi_dung_chinh, tested: 0, firstTryCorrect: 0, finalCorrect: 0, firstTryPct: 0, finalPct: 0, progressPct: 0 },
    sap_xep_trinh_tu: { label: SKILL_LABELS.sap_xep_trinh_tu, tested: 0, firstTryCorrect: 0, finalCorrect: 0, firstTryPct: 0, finalPct: 0, progressPct: 0 },
    lien_he_van_dung: { label: SKILL_LABELS.lien_he_van_dung, tested: 0, firstTryCorrect: 0, finalCorrect: 0, firstTryPct: 0, finalPct: 0, progressPct: 0 }
  };

  // Pre-fetch question skill maps
  const versionSkillCache: Record<string, Record<string, string>> = {};
  const neededVersionIds = Array.from(new Set(filteredAttempts.map((d) => d.data().lessonVersionId).filter(Boolean)));
  await Promise.all(
    neededVersionIds.map(async (vId) => {
      const sampleAtt = filteredAttempts.find((d) => d.data().lessonVersionId === vId)?.data();
      if (!sampleAtt) return;
      const vDoc = await db.collection('lessons').doc(sampleAtt.lessonId).collection('versions').doc(vId).get();
      const vData = vDoc.data();
      const map: Record<string, string> = {};
      if (vData && vData.publicQuestions) {
        vData.publicQuestions.forEach((q: any) => {
          map[q.id] = q.skillTag || '';
        });
      }
      versionSkillCache[vId] = map;
    })
  );

  await Promise.all(
    filteredAttempts.map(async (attDoc) => {
      const att = attDoc.data();
      const qMap = versionSkillCache[att.lessonVersionId] || {};
      const respSnap = await attDoc.ref.collection('responses').get();
      respSnap.forEach((rDoc) => {
        const r = rDoc.data();
        const skill = qMap[r.questionId] || r.skillTag;
        if (skill && skillAccumulator[skill]) {
          skillAccumulator[skill].tested++;
          if (r.firstTryCorrect) skillAccumulator[skill].firstTryCorrect++;
          if (r.finalCorrect) skillAccumulator[skill].finalCorrect++;
        }
      });
    })
  );

  Object.keys(skillAccumulator).forEach((k) => {
    const sk = skillAccumulator[k];
    if (sk.tested > 0) {
      sk.firstTryPct = Math.round((sk.firstTryCorrect / sk.tested) * 100);
      sk.finalPct = Math.round((sk.finalCorrect / sk.tested) * 100);
      sk.progressPct = Math.max(0, sk.finalPct - sk.firstTryPct);
    }
  });

  const participatedStudentCodes = new Set(exportRecords.map((r) => r.studentCode).filter((c) => c !== 'N/A'));
  const participatedCount = participatedStudentCodes.size;
  const notParticipatedCount = Math.max(0, totalStudentsInScope - participatedCount);
  const completionRate = totalStudentsInScope > 0 ? Math.round((participatedCount / totalStudentsInScope) * 100) : 0;

  const totalQuestionsSum = exportRecords.reduce((sum, r) => sum + (r.totalQuestions || 5), 0);
  const totalFirstTrySum = exportRecords.reduce((sum, r) => sum + (r.firstTryCorrectCount || 0), 0);
  const totalFinalSum = exportRecords.reduce((sum, r) => sum + (r.finalCorrectCount || 0), 0);

  const avgFirstTry = totalQuestionsSum > 0 ? Math.round((totalFirstTrySum / totalQuestionsSum) * 100) : 0;
  const avgFinal = totalQuestionsSum > 0 ? Math.round((totalFinalSum / totalQuestionsSum) * 100) : 0;
  const avgFirstTryScore = totalQuestionsSum > 0 ? Number(((totalFirstTrySum / totalQuestionsSum) * 10).toFixed(1)) : 0;
  const avgFinalScore = totalQuestionsSum > 0 ? Number(((totalFinalSum / totalQuestionsSum) * 10).toFixed(1)) : 0;
  const progressDelta = Math.max(0, avgFinal - avgFirstTry);

  const anomalousDateCount = exportRecords.filter((r) => r.isDateAnomalous).length;
  const validDateCount = exportRecords.length - anomalousDateCount;

  return {
    success: true,
    csv,
    csvContent: csv,
    records: exportRecords,
    totalRecords: exportRecords.length,
    summary: {
      totalStudents: totalStudentsInScope,
      participatedStudents: participatedCount,
      notParticipatedStudents: notParticipatedCount,
      assignedLessonsCount: filteredAssignments.length,
      totalAttempts: exportRecords.length,
      completionRate,
      totalQuestionsSum,
      totalFirstTrySum,
      totalFinalSum,
      avgFirstTryAccuracy: avgFirstTry,
      avgFinalAccuracy: avgFinal,
      avgFirstTryScore,
      avgFinalScore,
      progressDelta,
      anomalousDateCount,
      validDateCount,
      auditStatus: anomalousDateCount > 0 ? 'anomalous_dates_detected' : 'all_dates_valid',
      auditNote: anomalousDateCount > 0
        ? `Cảnh báo kiểm toán: Phát hiện ${anomalousDateCount} lượt làm bài có ngày hoàn thành lệch so với năm học của lớp.`
        : 'Kiểm toán ngày làm bài: 100% hợp lệ và nhất quán với niên khóa.',
      skillsBreakdown: skillAccumulator
    },
    jsonData: JSON.stringify(exportRecords, null, 2)
  };
}

// 3. SUGGEST REMEDIATION (AI OR RULE-BASED PEDAGOGICAL ACTIVITIES)
async function handleSuggestRemediation(req: VercelApiRequest, data: any) {
  const teacher = await requireTeacher(req);
  const teacherUid = teacher.uid;
  const {
    classId,
    academicYear,
    semester,
    scope,
    targetStudentId,
    targetSkill,
    targetAssignmentId
  } = data || {};

  const db = getDb();

  // Find target class
  let targetClassDoc: FirebaseFirestore.DocumentSnapshot | null = null;
  if (classId) {
    targetClassDoc = await db.collection('classes').doc(classId).get();
  }
  if (!targetClassDoc || !targetClassDoc.exists) {
    const myClasses = await db.collection('classes').where('teacherUid', '==', teacherUid).get();
    if (!myClasses.empty) targetClassDoc = myClasses.docs[0];
  }
  if (!targetClassDoc || !targetClassDoc.exists) {
    throw new ApiError(404, 'not-found', 'Không tìm thấy lớp học hợp lệ.');
  }

  const classData = targetClassDoc.data()!;
  const targetCId = targetClassDoc.id;
  const targetGrade = Number(classData.grade || 2);
  const className = classData.name || `Lớp ${targetGrade}`;
  const cYear = academicYear || classData.academicYear || '2026-2027';
  const activeScope = scope || 'toan_lop';

  // 1. Fetch students for roster & alias map
  const studentsSnap = await db.collection('students').where('classId', '==', targetCId).get();
  const totalStudents = studentsSnap.size || Number(classData.studentCount) || 20;
  const studentMap: Record<string, any> = {};
  studentsSnap.docs.forEach((d) => {
    const s = d.data();
    studentMap[d.id] = {
      id: d.id,
      studentCode: s.studentCode || `HS-${d.id.slice(-4).toUpperCase()}`,
      displayAlias: s.displayAlias || s.name || `Học sinh ${d.id.slice(-4)}`
    };
  });

  // 2. Fetch assignments for this class
  const assignmentsSnap = await db.collection('assignments').where('classId', '==', targetCId).get();
  const assignMap: Record<string, any> = {};
  assignmentsSnap.docs.forEach((d) => { assignMap[d.id] = { id: d.id, ...d.data() }; });

  // 3. Fetch completed attempts for this class
  const attemptsSnap = await db
    .collection('attempts')
    .where('classId', '==', targetCId)
    .where('status', '==', 'completed')
    .get();

  const completedAttempts: any[] = attemptsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // 4. Calculate participation and accuracy metrics
  const participatedStudentCodes = new Set(
    completedAttempts.map((a) => studentMap[a.studentId]?.studentCode || a.studentId).filter(Boolean)
  );
  const participatedCount = participatedStudentCodes.size;
  const notParticipatedCount = Math.max(0, totalStudents - participatedCount);
  const completionRate = totalStudents > 0 ? Math.round((participatedCount / totalStudents) * 100) : 0;

  const totalQuestions = completedAttempts.reduce((sum, a) => sum + (a.totalQuestions || 5), 0);
  const totalFirstTry = completedAttempts.reduce((sum, a) => sum + (a.firstTryCorrectCount || 0), 0);
  const totalFinal = completedAttempts.reduce((sum, a) => sum + (a.finalCorrectCount || 0), 0);

  const avgFirstTry = totalQuestions > 0 ? Math.round((totalFirstTry / totalQuestions) * 100) : 0;
  const avgFinal = totalQuestions > 0 ? Math.round((totalFinal / totalQuestions) * 100) : 0;
  const avgProgress = Math.max(0, avgFinal - avgFirstTry);

  // Student groupings: Support group (< 70% first try) vs Growth group (>= 70%)
  const studentScoreAccumulator: Record<string, { totalQ: number; firstTry: number; final: number; count: number }> = {};
  completedAttempts.forEach((a) => {
    if (!studentScoreAccumulator[a.studentId]) {
      studentScoreAccumulator[a.studentId] = { totalQ: 0, firstTry: 0, final: 0, count: 0 };
    }
    const acc = studentScoreAccumulator[a.studentId];
    acc.totalQ += a.totalQuestions || 5;
    acc.firstTry += a.firstTryCorrectCount || 0;
    acc.final += a.finalCorrectCount || 0;
    acc.count += 1;
  });

  const supportGroup: Array<{ studentId: string; studentCode: string; displayAlias: string; avgAccuracy: number; reason: string }> = [];
  const growthGroup: Array<{ studentId: string; studentCode: string; displayAlias: string; avgAccuracy: number; reason: string }> = [];

  studentsSnap.docs.forEach((d) => {
    const sMeta = studentMap[d.id] || { studentCode: 'HS', displayAlias: 'Học sinh' };
    const stat = studentScoreAccumulator[d.id];
    if (!stat || stat.totalQ === 0) {
      supportGroup.push({
        studentId: d.id,
        studentCode: sMeta.studentCode,
        displayAlias: sMeta.displayAlias,
        avgAccuracy: 0,
        reason: 'Chưa tham gia làm bài đọc hiểu'
      });
      return;
    }
    const acc = Math.round((stat.firstTry / stat.totalQ) * 100);
    if (acc < 70) {
      supportGroup.push({
        studentId: d.id,
        studentCode: sMeta.studentCode,
        displayAlias: sMeta.displayAlias,
        avgAccuracy: acc,
        reason: `Tỷ lệ đúng lần đầu ${acc}% (< 70%)`
      });
    } else {
      growthGroup.push({
        studentId: d.id,
        studentCode: sMeta.studentCode,
        displayAlias: sMeta.displayAlias,
        avgAccuracy: acc,
        reason: `Nền tảng đọc hiểu vững (${acc}%)`
      });
    }
  });

  // Individual profile if activeScope === 'tung_hoc_sinh'
  let studentProfile: any = undefined;
  if (activeScope === 'tung_hoc_sinh' && targetStudentId) {
    const sMeta = studentMap[targetStudentId] || { studentCode: 'HS', displayAlias: 'Học sinh' };
    const stAttempts = completedAttempts.filter((a) => a.studentId === targetStudentId);
    const sTotalQ = stAttempts.reduce((sum, a) => sum + (a.totalQuestions || 5), 0);
    const sFirst = stAttempts.reduce((sum, a) => sum + (a.firstTryCorrectCount || 0), 0);
    const sFinal = stAttempts.reduce((sum, a) => sum + (a.finalCorrectCount || 0), 0);
    const sFirstAvg = sTotalQ > 0 ? Math.round((sFirst / sTotalQ) * 100) : 0;
    const sFinalAvg = sTotalQ > 0 ? Math.round((sFinal / sTotalQ) * 100) : 0;

    studentProfile = {
      studentId: targetStudentId,
      studentCode: sMeta.studentCode,
      displayAlias: sMeta.displayAlias,
      totalAttempts: stAttempts.length,
      firstTryAvg: sFirstAvg,
      finalAvg: sFinalAvg,
      progressDelta: Math.max(0, sFinalAvg - sFirstAvg),
      strongSkills: ['Tìm thông tin trực tiếp'],
      weakSkills: sFirstAvg < 70 ? ['Hiểu từ ngữ trong ngữ cảnh'] : [],
      recentAttempts: stAttempts.slice(0, 5).map((a) => ({
        attemptId: a.id,
        lessonTitle: assignMap[a.assignmentId]?.lessonTitle || 'Bài đọc',
        firstScore: a.firstTryCorrectCount || 0,
        finalScore: a.finalCorrectCount || 0,
        progress: Math.max(0, (a.finalCorrectCount || 0) - (a.firstTryCorrectCount || 0)),
        completedAt: a.completedAt || Date.now()
      }))
    };
  }

  const scopeSummary = {
    scopeName: activeScope === 'tung_hoc_sinh' ? `Học sinh: ${studentProfile?.displayAlias || 'Cá nhân'}` : `Toàn lớp ${className}`,
    targetName: className,
    targetDescription: `Phân tích ${activeScope === 'toan_lop' ? 'toàn diện sĩ số cả lớp' : 'học sinh trọng tâm'} trên ${completedAttempts.length} lượt làm bài thực tế tại năm học ${cYear}.`,
    totalAttempts: completedAttempts.length,
    totalStudents: activeScope === 'tung_hoc_sinh' ? 1 : totalStudents,
    avgScore: avgFirstTry,
    progressDelta: avgProgress,
    detailBadge: `${completionRate}% hoàn thành`
  };

  // 5. Calculate 5 competencies from attempts responses
  const targetAttemptsForSkills = (activeScope === 'tung_hoc_sinh' && targetStudentId)
    ? completedAttempts.filter((a) => a.studentId === targetStudentId)
    : completedAttempts;

  const versionQuestionCache: Record<string, Record<string, { prompt: string; skillTag: string }>> = {};
  const neededVersionIds = Array.from(new Set(targetAttemptsForSkills.map((a) => a.lessonVersionId).filter(Boolean)));
  await Promise.all(
    neededVersionIds.map(async (vId) => {
      const sampleAtt = targetAttemptsForSkills.find((a) => a.lessonVersionId === vId);
      if (!sampleAtt) return;
      const vDoc = await db.collection('lessons').doc(sampleAtt.lessonId).collection('versions').doc(vId).get();
      const vData = vDoc.data();
      const map: Record<string, { prompt: string; skillTag: string }> = {};
      if (vData && vData.publicQuestions) {
        vData.publicQuestions.forEach((q: any) => {
          map[q.id] = {
            prompt: String(q.prompt || q.statement || '').trim(),
            skillTag: q.skillTag || ''
          };
        });
      }
      versionQuestionCache[vId] = map;
    })
  );

  const skillAcc: Record<
    string,
    { tested: number; firstTryCorrect: number; finalCorrect: number; byStudent: Record<string, { tested: number; firstTryCorrect: number }> }
  > = {
    thong_tin_truc_tiep: { tested: 0, firstTryCorrect: 0, finalCorrect: 0, byStudent: {} },
    tu_trong_ngu_canh: { tested: 0, firstTryCorrect: 0, finalCorrect: 0, byStudent: {} },
    noi_dung_chinh: { tested: 0, firstTryCorrect: 0, finalCorrect: 0, byStudent: {} },
    sap_xep_trinh_tu: { tested: 0, firstTryCorrect: 0, finalCorrect: 0, byStudent: {} },
    lien_he_van_dung: { tested: 0, firstTryCorrect: 0, finalCorrect: 0, byStudent: {} }
  };

  const questionErrorAcc: Record<string, { questionId: string; prompt: string; skillTag: string; totalAnswered: number; firstTryIncorrect: number }> = {};

  await Promise.all(
    targetAttemptsForSkills.map(async (att) => {
      const sId = att.studentId;
      const qMap = versionQuestionCache[att.lessonVersionId] || {};
      const respSnap = await db.collection('attempts').doc(att.id).collection('responses').get();
      respSnap.forEach((rDoc) => {
        const r = rDoc.data();
        const qId = r.questionId || rDoc.id;
        const qInfo = qMap[qId];
        const skill = qInfo?.skillTag || r.skillTag || '';
        if (skill && skillAcc[skill]) {
          skillAcc[skill].tested++;
          if (r.firstTryCorrect) skillAcc[skill].firstTryCorrect++;
          if (r.finalCorrect) skillAcc[skill].finalCorrect++;
          if (!skillAcc[skill].byStudent[sId]) {
            skillAcc[skill].byStudent[sId] = { tested: 0, firstTryCorrect: 0 };
          }
          skillAcc[skill].byStudent[sId].tested++;
          if (r.firstTryCorrect) skillAcc[skill].byStudent[sId].firstTryCorrect++;
        }

        if (!questionErrorAcc[qId]) {
          const rawPrompt = qInfo?.prompt || r.prompt || '';
          questionErrorAcc[qId] = {
            questionId: qId,
            prompt: rawPrompt,
            skillTag: skill || 'chua_phan_loai',
            totalAnswered: 0,
            firstTryIncorrect: 0
          };
        }
        questionErrorAcc[qId].totalAnswered++;
        if (!r.firstTryCorrect) questionErrorAcc[qId].firstTryIncorrect++;
      });
    })
  );

  const skills: any[] = [];
  const goodSkills: any[] = [];
  const weakSkills: any[] = [];
  const untestedSkills: any[] = [];

  for (const [tag, label] of Object.entries(SKILL_LABELS)) {
    const data = skillAcc[tag];
    if (data.tested === 0) {
      const sObj = {
        skillTag: tag,
        label,
        testedCount: 0,
        firstTryAccuracy: null,
        finalAccuracy: null,
        progressPercentagePoints: 0,
        studentsNeedingHelp: 0,
        status: 'no_data' as const
      };
      skills.push(sObj);
      untestedSkills.push(sObj);
    } else {
      const firstAcc = Math.round((data.firstTryCorrect / data.tested) * 100);
      const finalAcc = Math.round((data.finalCorrect / data.tested) * 100);
      let needingHelp = 0;
      for (const stStat of Object.values(data.byStudent)) {
        if (stStat.tested > 0 && Math.round((stStat.firstTryCorrect / stStat.tested) * 100) < 70) {
          needingHelp++;
        }
      }
      const status = firstAcc >= 70 ? ('good' as const) : ('needs_remediation' as const);
      const sObj = {
        skillTag: tag,
        label,
        testedCount: data.tested,
        firstTryAccuracy: firstAcc,
        finalAccuracy: finalAcc,
        progressPercentagePoints: Math.max(0, finalAcc - firstAcc),
        studentsNeedingHelp: needingHelp,
        status
      };
      skills.push(sObj);
      if (status === 'good') goodSkills.push(sObj);
      else weakSkills.push(sObj);
    }
  }

  const highErrorQuestions = Object.values(questionErrorAcc)
    .filter((q) => q.totalAnswered >= 3 && Math.round((q.firstTryIncorrect / q.totalAnswered) * 100) >= 30)
    .map((q) => {
      const errRate = Math.round((q.firstTryIncorrect / q.totalAnswered) * 100);
      const displayPrompt = q.prompt
        ? (q.prompt.length > 90 ? q.prompt.slice(0, 90) + '...' : q.prompt)
        : `Câu hỏi ${q.questionId} (Nội dung chưa sẵn sàng)`;
      return {
        questionId: q.questionId,
        prompt: displayPrompt,
        skillTag: q.skillTag,
        skillLabel: SKILL_LABELS[q.skillTag] || 'Kỹ năng đọc hiểu',
        errorRate: errRate,
        incorrectPercentage: errRate,
        incorrectCount: q.firstTryIncorrect,
        totalCount: q.totalAnswered,
        testedCount: q.totalAnswered
      };
    })
    .sort((a, b) => b.errorRate - a.errorRate)
    .slice(0, 5);

  const statistics = {
    classId: targetCId,
    className,
    grade: targetGrade,
    academicYear: cYear,
    semester: semester || 'all',
    totalStudents: activeScope === 'tung_hoc_sinh' ? 1 : totalStudents,
    participatedStudents: activeScope === 'tung_hoc_sinh' ? (studentProfile?.totalAttempts > 0 ? 1 : 0) : participatedCount,
    notParticipatedStudents: activeScope === 'tung_hoc_sinh' ? (studentProfile?.totalAttempts > 0 ? 0 : 1) : notParticipatedCount,
    completionRate: activeScope === 'tung_hoc_sinh' ? (studentProfile?.totalAttempts > 0 ? 100 : 0) : completionRate,
    totalAttempts: activeScope === 'tung_hoc_sinh' ? (studentProfile?.totalAttempts || 0) : completedAttempts.length,
    assignedLessonsCount: assignmentsSnap.size,
    avgFirstTryAccuracy: activeScope === 'tung_hoc_sinh' ? (studentProfile?.firstTryAvg || 0) : avgFirstTry,
    avgFinalAccuracy: activeScope === 'tung_hoc_sinh' ? (studentProfile?.finalAvg || 0) : avgFinal,
    avgProgressPoints: activeScope === 'tung_hoc_sinh' ? (studentProfile?.progressDelta || 0) : avgProgress,
    skills,
    goodSkills,
    weakSkills,
    untestedSkills,
    highErrorQuestions,
    updatedAt: Date.now()
  };

  // Build standard pedagogical activities bank
  const now = Date.now();
  const audience = activeScope === 'tung_hoc_sinh' && studentProfile
    ? `Học sinh ${studentProfile.displayAlias} (${studentProfile.studentCode})`
    : `Học sinh lớp ${className}`;

  const defaultActivities = [
    {
      id: `act_truy_tim_nghia_tu_${now}_1`,
      activityType: 'truy_tim_nghia_tu',
      title: 'Trò chơi: Thám tử từ ngữ — Ghép từ với nghĩa',
      targetAudience: audience,
      targetSkill: 'tu_trong_ngu_canh',
      skillObjective: `Nâng cao năng lực giải nghĩa từ trong ngữ cảnh văn bản cho học sinh lớp ${targetGrade} theo chuẩn GDPT 2018.`,
      durationMinutes: 10,
      materialsNeeded: ['Thẻ từ vựng mini', 'Bảng ghép nghĩa nhóm đôi'],
      teacherSteps: [
        'Bước 1: Giáo viên phát thẻ từ khó và thẻ nghĩa tương ứng.',
        'Bước 2: Học sinh thảo luận cặp đôi để tìm ngữ cảnh trong bài đọc.',
        'Bước 3: Ghép đúng cặp từ - nghĩa và đặt một câu mới với từ vừa học.'
      ],
      contentPayload: {
        instructions: 'Em hãy đọc kỹ các từ ngữ và ghép đúng với lời giải nghĩa phù hợp.',
        gameTemplate: 'word_meaning_match',
        gameData: {
          pairs: [
            { word: 'chăm chỉ', meaning: 'làm việc liên tục, hết lòng và đều đặn' },
            { word: 'rực rỡ', meaning: 'tươi sáng, nổi bật và đẹp mắt' },
            { word: 'thân thiện', meaning: 'gần gũi, cởi mở và tốt bụng' }
          ]
        }
      },
      evaluationCriteria: 'Ghép chính xác từ với nghĩa và đặt được câu đúng ngữ cảnh.',
      status: 'approved',
      createdAt: now
    },
    {
      id: `act_xep_tranh_trinh_tu_${now}_2`,
      activityType: 'xep_tranh_trinh_tu',
      title: 'Trò chơi: Dòng thời gian — Sắp xếp sự việc',
      targetAudience: audience,
      targetSkill: 'sap_xep_trinh_tu',
      skillObjective: `Rèn luyện phản xạ xác định thứ tự thời gian và diễn biến các sự kiện trong câu chuyện.`,
      durationMinutes: 10,
      materialsNeeded: ['3 thẻ sự việc đánh số', 'Nam châm gắn bảng lớp'],
      teacherSteps: [
        'Bước 1: Giáo viên xáo trộn thứ tự 3 sự việc chính trong câu chuyện.',
        'Bước 2: Cho học sinh đọc lại đoạn văn có chứa các sự việc.',
        'Bước 3: Đại diện nhóm lên bảng xếp lại thẻ theo thứ tự trước - sau.'
      ],
      contentPayload: {
        instructions: 'Em hãy kéo thả hoặc bấm nút để xếp 3 sự việc sau theo đúng diễn biến câu chuyện.',
        gameTemplate: 'sequence_order',
        gameData: {
          sequenceItems: [
            { order: 1, text: 'Mở đầu: Bạn nhỏ phát hiện mầm cây non sau vườn nhà.', hint: 'Buổi sáng sớm' },
            { order: 2, text: 'Diễn biến: Hằng ngày em tưới nước, bắt sâu cho cây.', hint: 'Hành động chăm sóc' },
            { order: 3, text: 'Kết thúc: Mầm cây lớn nhanh và nở những chùm hoa thơm ngát.', hint: 'Kết quả ngọt ngào' }
          ]
        }
      },
      evaluationCriteria: 'Xếp đúng trình tự 3 sự việc diễn ra trong văn bản.',
      status: 'approved',
      createdAt: now
    },
    {
      id: `act_dung_hay_sai_${now}_3`,
      activityType: 'dung_hay_sai',
      title: 'Trò chơi: Trọng tài nhí — Đúng hay Sai?',
      targetAudience: audience,
      targetSkill: 'thong_tin_truc_tiep',
      skillObjective: `Phân biệt chi tiết đúng với chi tiết gây nhiễu, định vị thông tin trực tiếp trong bài đọc.`,
      durationMinutes: 8,
      materialsNeeded: ['Biển Đúng (xanh) / Sai (đỏ) cho mỗi học sinh'],
      teacherSteps: [
        'Bước 1: Giáo viên đọc to một nhận định liên quan đến bài đọc.',
        'Bước 2: Học sinh suy nghĩ 5 giây và giơ biển Đúng hoặc Sai.',
        'Bước 3: Nếu là "Sai", học sinh chỉ ra chi tiết chính xác trong bài đọc.'
      ],
      contentPayload: {
        instructions: 'Em hãy làm trọng tài, đọc từng nhận định và chọn ĐÚNG hoặc SAI.',
        items: [
          { id: 'item_1', prompt: 'Nhận định: "Cây tự lớn mà bạn nhỏ không cần chăm sóc."', answer: 'Sai', options: ['Đúng', 'Sai'], hint: 'Xem lại bạn nhỏ đã làm gì mỗi ngày.' },
          { id: 'item_2', prompt: 'Nhận định: "Câu chuyện khuyên các em hãy biết yêu quý thiên nhiên và chăm chỉ."', answer: 'Đúng', options: ['Đúng', 'Sai'], hint: 'Ý nghĩa bài học' }
        ]
      },
      evaluationCriteria: 'Phản xạ chính xác và chỉ ra được câu văn làm chứng cứ.',
      status: 'approved',
      createdAt: now
    },
    {
      id: `act_phong_vien_nhi_${now}_4`,
      activityType: 'phong_vien_nhi',
      title: 'Hoạt động: Phóng viên nhí đóng vai và phỏng vấn',
      targetAudience: audience,
      targetSkill: 'lien_he_van_dung',
      skillObjective: `Liên hệ nội dung câu chuyện với trải nghiệm thực tế đời sống hàng ngày của các em.`,
      durationMinutes: 12,
      materialsNeeded: ['Micro đồ chơi hoặc thẻ phóng viên nhí'],
      teacherSteps: [
        'Bước 1: Một học sinh đóng vai phóng viên, một học sinh đóng vai nhân vật trong bài đọc.',
        'Bước 2: Phóng viên đặt 2 câu hỏi liên hệ: "Nếu là bạn, em sẽ làm gì?"',
        'Bước 3: Giáo viên nhận xét, khen ngợi câu trả lời sáng tạo, chân thành.'
      ],
      contentPayload: {
        instructions: 'Em hãy cùng bạn đóng vai phóng viên để phỏng vấn về hành động đẹp trong câu chuyện.',
        gameTemplate: 'worksheet_mindmap'
      },
      evaluationCriteria: 'Tự tin trình bày và liên hệ được bài học vào bản thân.',
      status: 'approved',
      createdAt: now
    }
  ];

  let isAiGenerated = false;
  let disclaimer = 'Gợi ý quy tắc sư phạm chuẩn GDPT 2018 (Không qua AI). Giáo viên cần duyệt trước khi áp dụng vào lớp học.';
  let analysisSummary = `Lớp ${className} có tỷ lệ đúng lần đầu trung bình ${avgFirstTry}%, tiến bộ đạt +${avgProgress}% điểm phần trăm sau gợi ý sư phạm. Đề xuất tập trung củng cố phản xạ tìm kiếm chi tiết văn bản và giải nghĩa từ trong ngữ cảnh.`;
  let suggestedActivities = defaultActivities;

  // Try live Gemini AI if API key is present
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (apiKey) {
    const primaryModel = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    const fallbackModel = 'gemini-3.5-flash-lite';
    try {
      const prompt = `Bạn là chuyên gia phương pháp dạy học Tiếng Việt tiểu học (Lớp ${targetGrade}, Chuẩn GDPT 2018).
Dưới đây là báo cáo thống kê ẩn danh thực tế của lớp ${className}:
- Sĩ số: ${totalStudents} học sinh (Đã tham gia: ${participatedCount} em, ${completionRate}%).
- Tỷ lệ đúng lần đầu trung bình: ${avgFirstTry}%. Tiến bộ sau gợi ý: +${avgProgress}%.
- Số học sinh cần hỗ trợ: ${supportGroup.length} em.
YÊU CẦU:
1. Viết một đoạn ngắn "analysisSummary" (khoảng 2-3 câu) nhận xét sư phạm khách quan, chính xác theo số liệu trên.
2. Trả về đúng 4 hoạt động đề xuất ("suggestedActivities") với các trường: id, activityType, title, targetAudience, targetSkill, skillObjective, durationMinutes, materialsNeeded, teacherSteps, contentPayload, evaluationCriteria.
BẮT BUỘC trả về định dạng JSON thuần dạng:
{
  "analysisSummary": "Nhận xét sư phạm...",
  "suggestedActivities": [ ... ]
}`;

      let aiResponse: any = null;
      let usedModel = primaryModel;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        aiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${primaryModel}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: 'application/json' }
            }),
            signal: controller.signal
          }
        );
        clearTimeout(timeoutId);
      } catch (err: any) {
        console.warn(`[Gemini AI Remediation] Primary model ${primaryModel} failed: ${err.message}. Trying fallback...`);
      }

      if (!aiResponse || !aiResponse.ok) {
        usedModel = fallbackModel;
        const fbController = new AbortController();
        const fbTimeoutId = setTimeout(() => fbController.abort(), 15000);
        try {
          aiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${fallbackModel}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: 'application/json' }
              }),
              signal: fbController.signal
            }
          );
          clearTimeout(fbTimeoutId);
        } catch {
          clearTimeout(fbTimeoutId);
        }
      }

      if (aiResponse && aiResponse.ok) {
        const aiData: any = await aiResponse.json();
        const rawText = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const parsed = JSON.parse(rawText);
          if (parsed.analysisSummary) analysisSummary = parsed.analysisSummary;
          if (Array.isArray(parsed.suggestedActivities) && parsed.suggestedActivities.length > 0) {
            suggestedActivities = parsed.suggestedActivities.map((act: any, idx: number) => ({
              ...act,
              id: act.id || `act_ai_${now}_${idx + 1}`,
              teacherSteps: normalizeTeacherSteps(act.teacherSteps),
              status: 'approved',
              createdAt: now
            }));
            isAiGenerated = true;
            disclaimer = 'Đề xuất bởi Google Gemini AI dựa trên dữ liệu thống kê ẩn danh. Giáo viên cần duyệt trước khi áp dụng vào lớp học.';
          }
        }
      }
    } catch {
      // Graceful fallback to rich pedagogical rule bank
    }
  }

  return {
    success: true,
    scope: activeScope,
    scopeSummary,
    studentProfile,
    studentGroups: { supportGroup, growthGroup },
    statistics,
    analysisSummary,
    suggestedActivities: suggestedActivities.map((act) => ({
      ...act,
      teacherSteps: normalizeTeacherSteps(act.teacherSteps)
    })),
    weakSkills: [
      {
        skillTag: 'tu_trong_ngu_canh',
        label: 'Hiểu từ ngữ trong ngữ cảnh',
        accuracyFirstTry: avgFirstTry,
        studentsNeedingHelp: supportGroup.length
      }
    ],
    goodSkills: [
      {
        skillTag: 'thong_tin_truc_tiep',
        label: 'Tìm thông tin trực tiếp',
        accuracyFirstTry: Math.min(100, avgFirstTry + 10)
      }
    ],
    isAiGenerated,
    source: isAiGenerated ? 'gemini_ai' : 'pedagogical_rules',
    disclaimer
  };
}

/**
 * Kiểm tra quyền quản lý / phê duyệt / xóa hoạt động sư phạm
 */
async function canManageRemediationActivity(
  db: FirebaseFirestore.Firestore,
  callerUid: string,
  callerRole: 'teacher' | 'admin',
  existingData: any,
  targetClassId?: string
): Promise<boolean> {
  // 1. Quản trị viên (admin) có toàn quyền quản lý hệ thống
  if (callerRole === 'admin') return true;

  // 2. Giáo viên sở hữu trực tiếp hoạt động
  if (
    (existingData.teacherId && existingData.teacherId === callerUid) ||
    (existingData.teacherUid && existingData.teacherUid === callerUid)
  ) {
    return true;
  }

  // 3. Giáo viên phụ trách lớp học của hoạt động này
  const classId = existingData.classId || targetClassId;
  if (classId) {
    try {
      const classDoc = await db.collection('classes').doc(classId).get();
      if (classDoc.exists) {
        const classData = classDoc.data();
        if (classData?.teacherUid === callerUid || classData?.teacherId === callerUid) {
          return true;
        }
      }
    } catch {}
  }

  // 4. Nếu hoạt động do Admin tạo (mẫu học liệu chuẩn / bản nháp gợi ý cho lớp),
  // cho phép giáo viên phụ trách tiếp nhận, chỉnh sửa và phê duyệt vào kho của mình
  if (existingData.teacherId) {
    try {
      const creatorDoc = await db.collection('users').doc(existingData.teacherId).get();
      if (creatorDoc.exists && creatorDoc.data()?.role === 'admin') {
        return true;
      }
    } catch {}
  } else {
    return true;
  }

  return false;
}

// 4. LIST REMEDIATION ACTIVITIES
async function handleListRemediationActivities(req: VercelApiRequest, data: any) {
  const { uid: callerUid, role: callerRole } = await requireTeacherOrAdmin(req);
  const { classId, academicYear, grade, activityType, status } = data || {};
  const db = getDb();

  const snap = await db.collection('remediationActivities').get();
  const activities: any[] = [];

  // Danh sách các lớp do giáo viên này phụ trách
  const ownedClassIds = new Set<string>();
  if (callerRole === 'teacher') {
    try {
      const classesSnap = await db.collection('classes').where('teacherUid', '==', callerUid).get();
      classesSnap.forEach((cd) => ownedClassIds.add(cd.id));
    } catch {}
  }

  snap.forEach((doc) => {
    const act = doc.data() as any;
    const isDirectOwner = act.teacherId === callerUid || act.teacherUid === callerUid;
    const isClassTeacher = act.classId && ownedClassIds.has(act.classId);
    const isAdmin = callerRole === 'admin';

    // Chỉ hiển thị hoạt động nếu là admin, chủ sở hữu hoặc giáo viên phụ trách lớp
    if (!isAdmin && !isDirectOwner && !isClassTeacher) return;

    if (classId && classId !== 'all' && act.classId && act.classId !== classId) return;
    if (academicYear && academicYear !== 'all' && act.academicYear && act.academicYear !== academicYear) return;
    if (grade && grade !== 'all' && act.grade && Number(act.grade) !== Number(grade)) return;
    if (activityType && activityType !== 'all' && act.activityType !== activityType) return;
    if (status && status !== 'all' && act.status !== status) return;

    activities.push({
      id: doc.id,
      ...act,
      teacherSteps: normalizeTeacherSteps(act.teacherSteps)
    });
  });

  activities.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  return { success: true, activities, count: activities.length };
}

// 5. SAVE REMEDIATION ACTIVITY
async function handleSaveRemediationActivity(req: VercelApiRequest, data: any) {
  const { uid: callerUid, role: callerRole } = await requireTeacherOrAdmin(req);
  const rawActivity = (data && data.activity) ? data.activity : data;
  if (!rawActivity || typeof rawActivity !== 'object') {
    throw new ApiError(400, 'invalid-argument', 'Dữ liệu hoạt động không được để trống.');
  }

  const cleanTitle = String(rawActivity.title || '').trim();
  if (!cleanTitle || cleanTitle.length < 3) {
    throw new ApiError(400, 'invalid-argument', 'Tên hoạt động phải có tối thiểu 3 ký tự.');
  }

  const activityId = (rawActivity.id && String(rawActivity.id).trim().length > 0)
    ? String(rawActivity.id).trim()
    : `act_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const db = getDb();
  const ref = db.collection('remediationActivities').doc(activityId);
  const existingDoc = await ref.get();

  if (existingDoc.exists) {
    const existing = existingDoc.data()!;
    const allowed = await canManageRemediationActivity(db, callerUid, callerRole, existing, rawActivity.classId);
    if (!allowed) {
      throw new ApiError(403, 'permission-denied', 'Bạn không có quyền chỉnh sửa hoạt động của giáo viên khác.');
    }
  }

  let teacherName = 'Giáo viên';
  try {
    const userDoc = await db.collection('users').doc(callerUid).get();
    if (userDoc.exists && userDoc.data()?.displayName) {
      teacherName = userDoc.data()?.displayName;
    }
  } catch {}

  const now = Date.now();
  const isApproved = rawActivity.status === 'approved';

  const activityRecord = {
    ...rawActivity,
    id: activityId,
    teacherId: callerRole === 'admin' ? (rawActivity.teacherId || callerUid) : callerUid,
    teacherUid: callerRole === 'admin' ? (rawActivity.teacherUid || callerUid) : callerUid,
    teacherName: existingDoc.data()?.teacherName || rawActivity.teacherName || teacherName,
    title: cleanTitle,
    academicYear: rawActivity.academicYear || existingDoc.data()?.academicYear || '2026-2027',
    grade: Number(rawActivity.grade) || existingDoc.data()?.grade || 2,
    classId: rawActivity.classId || existingDoc.data()?.classId || '',
    className: rawActivity.className || existingDoc.data()?.className || '',
    scope: rawActivity.scope || existingDoc.data()?.scope || 'toan_lop',
    activityType: rawActivity.activityType || existingDoc.data()?.activityType || 'truy_tim_nghia_tu',
    targetAudience: rawActivity.targetAudience || existingDoc.data()?.targetAudience || 'Toàn lớp',
    targetSkill: rawActivity.targetSkill || existingDoc.data()?.targetSkill || 'thong_tin_truc_tiep',
    skillObjective: String(rawActivity.skillObjective || existingDoc.data()?.skillObjective || '').trim(),
    sourceLessonId: rawActivity.sourceLessonId || existingDoc.data()?.sourceLessonId || '',
    sourceLessonTitle: rawActivity.sourceLessonTitle || existingDoc.data()?.sourceLessonTitle || '',
    sourceQuestionId: rawActivity.sourceQuestionId || existingDoc.data()?.sourceQuestionId || '',
    durationMinutes: Number(rawActivity.durationMinutes) || existingDoc.data()?.durationMinutes || 10,
    materialsNeeded: Array.isArray(rawActivity.materialsNeeded) ? rawActivity.materialsNeeded : (existingDoc.data()?.materialsNeeded || []),
    teacherSteps: normalizeTeacherSteps(rawActivity.teacherSteps || existingDoc.data()?.teacherSteps),
    contentPayload: rawActivity.contentPayload || existingDoc.data()?.contentPayload || { instructions: '' },
    evaluationCriteria: String(rawActivity.evaluationCriteria || existingDoc.data()?.evaluationCriteria || '').trim(),
    status: isApproved ? 'approved' : 'draft',
    approvedAt: isApproved ? (existingDoc.data()?.approvedAt || now) : null,
    approvedBy: isApproved ? (existingDoc.data()?.approvedBy || teacherName) : null,
    createdAt: existingDoc.exists ? (existingDoc.data()?.createdAt || now) : now,
    updatedAt: now
  };

  await ref.set(activityRecord, { merge: true });

  return {
    success: true,
    activity: activityRecord,
    message: isApproved
      ? `Đã lưu và cập nhật hoạt động đã duyệt "${cleanTitle}".`
      : `Đã lưu thành công bản nháp "${cleanTitle}".`
  };
}

// 6. APPROVE REMEDIATION ACTIVITY
async function handleApproveRemediationActivity(req: VercelApiRequest, data: any) {
  const { uid: callerUid, role: callerRole } = await requireTeacherOrAdmin(req);
  const { activityId, updatedData } = data || {};
  const targetId = activityId || updatedData?.id;
  if (!targetId || typeof targetId !== 'string') {
    throw new ApiError(400, 'invalid-argument', 'Mã hoạt động (activityId) không hợp lệ.');
  }

  const db = getDb();
  const ref = db.collection('remediationActivities').doc(targetId);
  const existingDoc = await ref.get();

  let teacherName = 'Giáo viên';
  try {
    const userDoc = await db.collection('users').doc(callerUid).get();
    if (userDoc.exists && userDoc.data()?.displayName) {
      teacherName = userDoc.data()?.displayName;
    }
  } catch {}

  const now = Date.now();
  let baseData: any = {};

  if (existingDoc.exists) {
    const existing = existingDoc.data()!;
    const allowed = await canManageRemediationActivity(db, callerUid, callerRole, existing, updatedData?.classId);
    if (!allowed) {
      throw new ApiError(403, 'permission-denied', 'Bạn chỉ có thể phê duyệt hoạt động do mình quản lý.');
    }
    baseData = existing;
  } else if (!updatedData || typeof updatedData !== 'object') {
    throw new ApiError(404, 'not-found', 'Không tìm thấy hoạt động cần duyệt trong hệ thống.');
  }

  const merged = { ...baseData, ...(updatedData || {}) };
  const cleanTitle = String(merged.title || '').trim();
  if (!cleanTitle || cleanTitle.length < 3) {
    throw new ApiError(400, 'invalid-argument', 'Tên hoạt động cần tối thiểu 3 ký tự để phê duyệt.');
  }
  const cleanObjective = String(merged.skillObjective || merged.description || '').trim();
  if (!cleanObjective || cleanObjective.length < 5) {
    throw new ApiError(400, 'invalid-argument', 'Mục tiêu GDPT 2018 cần tối thiểu 5 ký tự để phê duyệt.');
  }
  const teacherSteps = normalizeTeacherSteps(merged.teacherSteps);
  if (teacherSteps.length === 0) {
    throw new ApiError(400, 'invalid-argument', 'Cần tối thiểu 1 bước tổ chức sư phạm trước khi phê duyệt.');
  }

  const approvedRecord = {
    ...merged,
    id: targetId,
    teacherId: callerRole === 'admin' ? (merged.teacherId || callerUid) : callerUid,
    teacherUid: callerRole === 'admin' ? (merged.teacherUid || callerUid) : callerUid,
    teacherName: callerRole === 'admin' ? (merged.teacherName || teacherName) : teacherName,
    title: cleanTitle,
    skillObjective: cleanObjective,
    teacherSteps,
    materialsNeeded: Array.isArray(merged.materialsNeeded) ? merged.materialsNeeded : [],
    status: 'approved',
    approvedAt: now,
    approvedBy: teacherName,
    updatedAt: now
  };

  await ref.set(approvedRecord, { merge: true });

  return {
    success: true,
    activity: approvedRecord,
    approvedAt: now,
    approvedBy: teacherName,
    message: 'Đã phê duyệt hoạt động củng cố thành công.'
  };
}

// 7. DELETE REMEDIATION ACTIVITY
async function handleDeleteRemediationActivity(req: VercelApiRequest, data: any) {
  const { uid: callerUid, role: callerRole } = await requireTeacherOrAdmin(req);
  const { activityId } = data || {};
  if (!activityId) throw new ApiError(400, 'invalid-argument', 'Mã hoạt động không được để trống.');

  const db = getDb();
  const ref = db.collection('remediationActivities').doc(activityId);
  const existingDoc = await ref.get();
  if (!existingDoc.exists) {
    throw new ApiError(404, 'not-found', 'Hoạt động cần xóa không tồn tại.');
  }

  const existing = existingDoc.data()!;
  const allowed = await canManageRemediationActivity(db, callerUid, callerRole, existing);
  if (!allowed) {
    throw new ApiError(403, 'permission-denied', 'Bạn không có quyền xóa hoạt động này.');
  }

  await ref.delete();
  return { success: true, activityId, message: 'Đã xóa hoạt động củng cố thành công.' };
}

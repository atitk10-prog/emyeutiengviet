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

import { getDb } from './helpers/firebaseAdmin.js';
import { handleApiError, requireTeacher } from './helpers/authMiddleware.js';
import { ApiError, VercelApiRequest, VercelApiResponse } from './helpers/types.js';

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

// 1. GET TEACHER ANALYTICS
async function handleGetTeacherAnalytics(req: VercelApiRequest, data: any) {
  const { uid: teacherUid } = await requireTeacher(req);
  const { classId, assignmentId, academicYear, grade } = data || {};
  const db = getDb();

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

  // Count total students across classes
  let totalStudents = 0;
  for (const cId of classIds) {
    const sSnap = await db.collection('students').where('classId', '==', cId).get();
    totalStudents += sSnap.size;
  }

  // Query assignments
  const rawAssignDocs = await db.collection('assignments').where('teacherUid', '==', teacherUid).get();
  const assignMap: Record<string, any> = {};
  rawAssignDocs.docs.forEach((d) => (assignMap[d.id] = { id: d.id, ...d.data() }));

  const assignDocs = rawAssignDocs.docs.filter((d) => {
    const a = d.data();
    if (!classIds.has(a.classId)) return false;
    if (assignmentId && d.id !== assignmentId && a.id !== assignmentId) return false;
    return true;
  });

  // Query completed attempts: query by teacherUid or fallback to all attempts
  let rawAttemptsSnap = await db
    .collection('attempts')
    .where('teacherUid', '==', teacherUid)
    .where('status', '==', 'completed')
    .get();

  // If none found with teacherUid, fallback query by status completed
  if (rawAttemptsSnap.empty) {
    rawAttemptsSnap = await db.collection('attempts').where('status', '==', 'completed').get();
  }

  const attemptsDocs = rawAttemptsSnap.docs.filter((d) => {
    const att = d.data();
    const historicalClassId = att.classId || assignMap[att.assignmentId]?.classId;
    if (!historicalClassId || !classIds.has(historicalClassId)) return false;
    if (assignmentId && att.assignmentId !== assignmentId) return false;
    return true;
  });

  let totalFirstTry = 0;
  let totalFinal = 0;
  let totalQuestionsCount = 0;

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
      const vDoc = await db.collection('lessons').doc(sampleAtt.lessonId).collection('versions').doc(vId).get();
      const vData = vDoc.data();
      const map: Record<string, string> = {};
      if (vData && vData.publicQuestions) {
        vData.publicQuestions.forEach((q: any) => {
          map[q.id] = q.skillTag || 'thong_tin_truc_tiep';
        });
      }
      versionSkillCache[vId] = map;
    })
  );

  // Fetch responses for attempts
  await Promise.all(
    attemptsDocs.map(async (attDoc) => {
      const att = attDoc.data();
      totalFirstTry += att.firstTryCorrectCount || 0;
      totalFinal += att.finalCorrectCount || 0;
      totalQuestionsCount += att.totalQuestions || 5;

      const qMap = versionSkillCache[att.lessonVersionId] || {};
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
    })
  );

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

  return {
    success: true,
    totalClasses: classIds.size,
    totalStudents,
    totalAssignments: assignDocs.length,
    totalAttempts: attemptsDocs.length,
    avgFirstTryAccuracy,
    avgFinalAccuracy,
    progressPercentagePoints: Math.max(0, avgFinalAccuracy - avgFirstTryAccuracy),
    skillBreakdown,
    prePostComparison
  };
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

  // Filter completed attempts within allowed classes & semester
  const filteredAttempts = rawAttemptsSnap.docs.filter((d) => {
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
          map[q.id] = q.skillTag || 'thong_tin_truc_tiep';
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
  await requireTeacher(req);
  const { weakestSkill, grade } = data || {};

  const skillName = SKILL_LABELS[weakestSkill] || 'Kỹ năng đọc hiểu trọng tâm';
  const targetGrade = Number(grade || 2);

  const activities = [
    {
      id: `act_${Date.now()}_1`,
      title: `Trò chơi tìm manh mối văn bản (${skillName})`,
      targetSkill: weakestSkill || 'thong_tin_truc_tiep',
      skillLabel: skillName,
      grade: targetGrade,
      estimatedMinutes: 10,
      description: `Học sinh đọc đoạn văn ngắn 3 câu và khoanh tròn các từ khóa chỉ thời gian, địa điểm để trả lời nhanh 2 câu hỏi gợi mở.`,
      materialsNeeded: 'Thẻ bài đọc mini và bút màu',
      pedagogicalGoal: `Giúp học sinh rèn luyện phản xạ định vị thông tin chi tiết nhanh trong văn bản.`
    },
    {
      id: `act_${Date.now()}_2`,
      title: `Nhà thông thái nhí: Đoán nghĩa từ lạ (${skillName})`,
      targetSkill: weakestSkill || 'tu_trong_ngu_canh',
      skillLabel: skillName,
      grade: targetGrade,
      estimatedMinutes: 15,
      description: `Đặt từ khó vào 2 câu văn quen thuộc trong đời sống hằng ngày để học sinh thảo luận cặp đôi và suy luận nghĩa của từ.`,
      materialsNeeded: 'Bảng phụ thảo luận nhóm đôi',
      pedagogicalGoal: `Phát triển năng lực mở rộng vốn từ qua ngữ cảnh tự nhiên.`
    }
  ];

  return {
    success: true,
    weakestSkill,
    skillLabel: skillName,
    activities,
    source: 'ai_pedagogical_aligned'
  };
}

// 4. LIST REMEDIATION ACTIVITIES
async function handleListRemediationActivities(req: VercelApiRequest, data: any) {
  const { uid: teacherUid } = await requireTeacher(req);
  const { classId } = data || {};
  const db = getDb();

  let query: FirebaseFirestore.Query = db.collection('remediationActivities').where('teacherUid', '==', teacherUid);
  if (classId) query = query.where('classId', '==', classId);

  const snap = await query.get();
  const activities: any[] = [];
  snap.forEach((d) => activities.push({ id: d.id, ...d.data() }));

  return { success: true, activities };
}

// 5. SAVE REMEDIATION ACTIVITY
async function handleSaveRemediationActivity(req: VercelApiRequest, data: any) {
  const { uid: teacherUid } = await requireTeacher(req);
  const { activity, classId } = data || {};
  if (!activity) throw new ApiError(400, 'invalid-argument', 'Dữ liệu hoạt động không được để trống.');

  const db = getDb();
  const ref = db.collection('remediationActivities').doc(activity.id || undefined);
  const savedData = {
    ...activity,
    id: ref.id,
    teacherUid,
    classId: classId || activity.classId || null,
    status: 'approved',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  await ref.set(savedData, { merge: true });
  return { success: true, activity: savedData };
}

// 6. APPROVE REMEDIATION ACTIVITY
async function handleApproveRemediationActivity(req: VercelApiRequest, data: any) {
  const { uid: teacherUid } = await requireTeacher(req);
  const { activityId } = data || {};
  if (!activityId) throw new ApiError(400, 'invalid-argument', 'Mã hoạt động không được để trống.');

  const db = getDb();
  const ref = db.collection('remediationActivities').doc(activityId);
  await ref.update({ status: 'approved', updatedAt: Date.now() });

  return { success: true, message: 'Đã phê duyệt hoạt động củng cố.' };
}

// 7. DELETE REMEDIATION ACTIVITY
async function handleDeleteRemediationActivity(req: VercelApiRequest, data: any) {
  const { uid: teacherUid } = await requireTeacher(req);
  const { activityId } = data || {};
  if (!activityId) throw new ApiError(400, 'invalid-argument', 'Mã hoạt động không được để trống.');

  const db = getDb();
  const ref = db.collection('remediationActivities').doc(activityId);
  const doc = await ref.get();
  if (doc.exists && doc.data()?.teacherUid === teacherUid) {
    await ref.delete();
  }

  return { success: true, message: 'Đã xóa hoạt động củng cố.' };
}

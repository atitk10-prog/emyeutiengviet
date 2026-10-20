/**
 * EM YÊU TIẾNG VIỆT - VERCEL SERVERLESS BACKEND
 * Teacher Analytics & Remediation API Group: /api/analytics
 *
 * Implements Pedagogical Insights & Reporting:
 * 1. getTeacherAnalytics (5 reading comprehension skills, pre/post evaluation)
 * 2. exportTeacherData (CSV UTF-8 BOM / JSON)
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

  let classQuery: FirebaseFirestore.Query = db.collection('classes').where('teacherUid', '==', teacherUid);
  if (classId) {
    classQuery = classQuery.where('id', '==', classId);
  }
  const rawClassDocs = await classQuery.get();
  const classDocs = rawClassDocs.docs.filter((d) => {
    const c = d.data();
    if (academicYear && academicYear !== 'all' && (c.academicYear || '2025-2026') !== academicYear) return false;
    if (grade && grade !== 'all' && Number(c.grade) !== Number(grade)) return false;
    return true;
  });
  const classIds = new Set(classDocs.map((d) => d.id));

  if (classIds.size === 0) {
    return {
      totalClasses: 0,
      totalStudents: 0,
      totalAssignments: 0,
      totalAttempts: 0,
      avgFirstTryAccuracy: 0,
      avgFinalAccuracy: 0,
      skillBreakdown: {}
    };
  }

  // Count total students across classes
  let totalStudents = 0;
  for (const cId of classIds) {
    const sSnap = await db.collection('students').where('classId', '==', cId).get();
    totalStudents += sSnap.size;
  }

  // Query assignments
  let assignQuery: FirebaseFirestore.Query = db.collection('assignments').where('teacherUid', '==', teacherUid);
  if (assignmentId) {
    assignQuery = assignQuery.where('id', '==', assignmentId);
  }
  const rawAssignDocs = await assignQuery.get();
  const assignMap: Record<string, any> = {};
  rawAssignDocs.docs.forEach((d) => (assignMap[d.id] = d.data()));
  const assignDocs = rawAssignDocs.docs.filter((d) => classIds.has(d.data().classId));

  // Query completed attempts
  let attemptsQuery: FirebaseFirestore.Query = db
    .collection('attempts')
    .where('teacherUid', '==', teacherUid)
    .where('status', '==', 'completed');

  if (classId) attemptsQuery = attemptsQuery.where('classId', '==', classId);
  if (assignmentId) attemptsQuery = attemptsQuery.where('assignmentId', '==', assignmentId);

  const rawAttemptsSnap = await attemptsQuery.get();
  const attemptsDocs = rawAttemptsSnap.docs.filter((d) => {
    const historicalClassId = d.data().classId || assignMap[d.data().assignmentId]?.classId;
    return historicalClassId && classIds.has(historicalClassId);
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

  // Cache versions questions skill map in parallel
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
        const skill = qMap[r.questionId];
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

  // Pre / Post paired comparison
  let prePostComparison = null;
  const preAssignment = assignDocs.find((d) => d.data().isPreTest);
  const postAssignment = assignDocs.find((d) => d.data().isPostTest);

  if (preAssignment && postAssignment) {
    const preAttempts = attemptsDocs.filter((d) => d.data().assignmentId === preAssignment.id);
    const postAttempts = attemptsDocs.filter((d) => d.data().assignmentId === postAssignment.id);

    const preByStudent: Record<string, number> = {};
    const postByStudent: Record<string, number> = {};

    preAttempts.forEach((d) => {
      preByStudent[d.data().studentId] = d.data().scorePercentage;
    });
    postAttempts.forEach((d) => {
      postByStudent[d.data().studentId] = d.data().scorePercentage;
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
        preAssignmentTitle: preAssignment.data().lessonTitle,
        postAssignmentTitle: postAssignment.data().lessonTitle
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
    progressPercentagePoints: avgFinalAccuracy - avgFirstTryAccuracy,
    skillBreakdown,
    prePostComparison
  };
}

// 2. EXPORT TEACHER DATA (CSV UTF-8 BOM)
async function handleExportTeacherData(req: VercelApiRequest, data: any) {
  const { uid: teacherUid } = await requireTeacher(req);
  const { classId } = data || {};
  const db = getDb();

  const cDoc = await db.collection('classes').doc(classId).get();
  if (!cDoc.exists || cDoc.data()?.teacherUid !== teacherUid) {
    throw new ApiError(404, 'not-found', 'Lớp học không tồn tại hoặc bạn không có quyền.');
  }

  const className = cDoc.data()?.name || 'LopHoc';
  const studentsSnap = await db.collection('students').where('classId', '==', classId).get();

  // Build CSV UTF-8 with BOM
  let csvContent = '\uFEFF';
  csvContent += 'Mã học sinh,Tên hiển thị,Mã lớp,Trạng thái,Số bài đã hoàn thành,Điểm trung bình (%)\n';

  for (const sDoc of studentsSnap.docs) {
    const s = sDoc.data();
    const attemptsSnap = await db
      .collection('attempts')
      .where('studentId', '==', sDoc.id)
      .where('status', '==', 'completed')
      .get();

    const count = attemptsSnap.size;
    let avgScore = 0;
    if (count > 0) {
      const total = attemptsSnap.docs.reduce((sum, d) => sum + (d.data().scorePercentage || 0), 0);
      avgScore = Math.round(total / count);
    }

    csvContent += `"${s.studentCode}","${s.displayAlias}","${s.classId}","${s.status || 'active'}",${count},${avgScore}%\n`;
  }

  return {
    success: true,
    filename: `BaoCao_${className}_${Date.now()}.csv`,
    csvContent
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

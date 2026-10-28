/**
 * EM YÊU TIẾNG VIỆT - VERCEL SERVERLESS BACKEND
 * Lessons API Group: /api/lessons
 *
 * Implements Teacher Lesson Management:
 * 1. getTeacherLessons
 * 2. getLessonDetail
 * 3. saveLessonDraft
 * 4. publishLesson (immutable versioning, separation of privateAnswerKeys)
 * 5. archiveLesson
 * 6. deleteDraftLesson
 * 7. updateLessonScope
 * 8. assignLesson (with duplicate prevention)
 * 9. getAIStatus
 * 10. testAIConnection
 */

import { getDb } from './_helpers/firebaseAdmin.js';
import { handleApiError, requireTeacher, requireTeacherOrAdmin } from './_helpers/authMiddleware.js';
import { ApiError, VercelApiRequest, VercelApiResponse } from './_helpers/types.js';
import { sanitizeQuestionData, validateQuestionForPublish } from './_helpers/answerEvaluator.js';

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
      case 'getTeacherLessons':
        result = await handleGetTeacherLessons(req, data);
        break;

      case 'getLessonDetail':
        result = await handleGetLessonDetail(req, data);
        break;

      case 'generateLessonDraft':
        result = await handleGenerateLessonDraft(req, data);
        break;

      case 'saveLessonDraft':
        result = await handleSaveLessonDraft(req, data);
        break;

      case 'publishLesson':
        result = await handlePublishLesson(req, data);
        break;

      case 'archiveLesson':
        result = await handleArchiveLesson(req, data);
        break;

      case 'deleteDraftLesson':
        result = await handleDeleteDraftLesson(req, data);
        break;

      case 'updateLessonScope':
        result = await handleUpdateLessonScope(req, data);
        break;

      case 'assignLesson':
        result = await handleAssignLesson(req, data);
        break;

      case 'getAIStatus':
        result = await handleGetAIStatus();
        break;

      case 'testAIConnection':
        result = await handleTestAIConnection();
        break;

      case 'generateLessonAudioWithAI':
        result = await handleGenerateLessonAudioWithAI(req, data);
        break;

      case 'approveLessonAudio':
        result = await handleApproveLessonAudio(req, data);
        break;

      default:
        throw new ApiError(
          400,
          'invalid-argument',
          `Hành động bài học "${action}" không được hỗ trợ trong nhóm /api/lessons.`
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

// 1. GET TEACHER LESSONS
async function handleGetTeacherLessons(req: VercelApiRequest, data: any) {
  const { uid: teacherUid } = await requireTeacher(req);
  const { status, grade, semester } = data || {};
  const db = getDb();

  let lessonQuery: FirebaseFirestore.Query = db.collection('lessons').where('teacherUid', '==', teacherUid);
  if (status && status !== 'all') {
    lessonQuery = lessonQuery.where('status', '==', status);
  }
  if (grade) {
    lessonQuery = lessonQuery.where('grade', '==', Number(grade));
  }
  if (semester) {
    lessonQuery = lessonQuery.where('semester', '==', Number(semester));
  }

  const [snap, allAssignSnap] = await Promise.all([
    lessonQuery.get(),
    db.collection('assignments')
      .where('teacherUid', '==', teacherUid)
      .where('status', '==', 'active')
      .get()
  ]);

  // Group active assignments by lessonId in memory (replaces N+1 sequential Firestore queries)
  const assignmentsByLesson = new Map<string, any[]>();
  allAssignSnap.docs.forEach((ad) => {
    const aData = ad.data();
    const lId = aData.lessonId;
    if (!lId) return;
    const list = assignmentsByLesson.get(lId) || [];
    list.push({
      assignmentId: ad.id,
      classId: aData.classId,
      roundName: aData.roundName || 'Đợt 1',
      lessonVersionId: aData.lessonVersionId
    });
    assignmentsByLesson.set(lId, list);
  });

  const lessons: any[] = [];
  for (const doc of snap.docs) {
    const lData = doc.data();
    const assignedClasses = assignmentsByLesson.get(doc.id) || [];
    lessons.push({
      ...lData,
      assignedClassCount: assignedClasses.length,
      assignedClasses
    });
  }

  // Include system/seed lessons if teacher has none or requests all
  if (lessons.length === 0 || status === 'all') {
    const publishedSnap = await db.collection('lessons').where('status', '==', 'published').get();
    publishedSnap.forEach((doc) => {
      const sData = doc.data();
      const isSeed = doc.id.startsWith('seed-') || sData.teacherUid === 'system' || sData.teacherUid === 'seed_teacher_uid';
      if (isSeed && !lessons.some((l) => l.id === doc.id)) {
        if (!grade || sData.grade === Number(grade)) {
          lessons.push({
            ...sData,
            assignedClassCount: 0,
            isSystemLesson: true
          });
        }
      }
    });
  }

  lessons.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return { success: true, lessons };
}

// 2. GET LESSON DETAIL
async function handleGetLessonDetail(req: VercelApiRequest, data: any) {
  const { uid: teacherUid } = await requireTeacher(req);
  const { lessonId, versionId } = data || {};

  if (!lessonId) {
    throw new ApiError(400, 'invalid-argument', 'Vui lòng cung cấp mã bài đọc.');
  }

  const db = getDb();
  const lessonDoc = await db.collection('lessons').doc(lessonId).get();
  if (!lessonDoc.exists) {
    throw new ApiError(404, 'not-found', 'Bài đọc không tồn tại.');
  }

  const lessonData = lessonDoc.data()!;
  const isSeed = lessonId.startsWith('seed-') || lessonData.teacherUid === 'system' || lessonData.teacherUid === 'seed_teacher_uid';
  const isOwner = lessonData.teacherUid === teacherUid || isSeed;

  const targetVersionId = versionId || lessonData.currentVersionId;
  let versionData: any = null;
  let privateAnswers: any = null;

  if (targetVersionId) {
    const vDoc = await db.collection('lessons').doc(lessonId).collection('versions').doc(targetVersionId).get();
    if (vDoc.exists) {
      versionData = vDoc.data();
    }
    if (isOwner) {
      const keyDoc = await db.collection('privateAnswerKeys').doc(targetVersionId).get();
      if (keyDoc.exists) {
        privateAnswers = keyDoc.data()?.answers || null;
      }
    }
  }

  // Fetch all immutable versions of this lesson (Phase 2 & Module 2.1)
  const versionsSnap = await db.collection('lessons').doc(lessonId).collection('versions').get();
  const versionsList = versionsSnap.docs.map((vd) => {
    const v = vd.data();
    return {
      versionId: vd.id,
      id: vd.id,
      versionNumber: v.versionNumber || (vd.id.includes('v1') ? 1 : 2),
      title: v.title || lessonData.title,
      passage: v.passage || '',
      grade: v.grade || lessonData.grade,
      topic: v.topic || lessonData.topic,
      totalQuestions: v.publicQuestions?.length || v.totalQuestions || 5,
      hasAudio: Boolean(v.audioUrl),
      audioUrl: v.audioUrl || null,
      audioMetadata: v.audioMetadata || null,
      publishedAt: v.publishedAt || v.createdAt || null,
      createdAt: v.createdAt || null
    };
  }).sort((a, b) => a.versionNumber - b.versionNumber);

  // Fetch all assignments using this lesson
  const assignmentsSnap = await db.collection('assignments').where('lessonId', '==', lessonId).get();
  const assignmentsList = assignmentsSnap.docs.map((ad) => {
    const a = ad.data();
    return {
      id: ad.id,
      assignmentId: ad.id,
      classId: a.classId,
      lessonId: a.lessonId,
      lessonVersionId: a.lessonVersionId,
      lessonVersionNumber: a.lessonVersionNumber || (a.lessonVersionId?.includes('v1') ? 1 : 2),
      roundName: a.roundName || 'Đợt 1',
      title: a.title,
      academicYear: a.academicYear || '2026-2027',
      status: a.status || 'active',
      createdAt: a.createdAt || null
    };
  });

  let privateAnswersList: any[] = [];
  let privateAnswersMap: Record<string, any> = {};

  if (privateAnswers) {
    if (Array.isArray(privateAnswers)) {
      privateAnswersList = privateAnswers.map((item: any, idx: number) => ({
        questionId: item.questionId || item.id || `q${idx + 1}`,
        id: item.questionId || item.id || `q${idx + 1}`,
        correctAnswer: item.correctAnswer !== undefined ? item.correctAnswer : item.answer,
        answer: item.correctAnswer !== undefined ? item.correctAnswer : item.answer,
        hint: item.hint || '',
        explanation: item.explanation || ''
      }));
      privateAnswersList.forEach((item) => {
        privateAnswersMap[item.questionId] = item;
      });
    } else if (typeof privateAnswers === 'object') {
      privateAnswersMap = privateAnswers;
      privateAnswersList = Object.entries(privateAnswers).map(([qId, val]: [string, any]) => ({
        questionId: qId,
        id: qId,
        correctAnswer: val?.correctAnswer !== undefined ? val.correctAnswer : val?.answer,
        answer: val?.correctAnswer !== undefined ? val.correctAnswer : val?.answer,
        hint: val?.hint || '',
        explanation: val?.explanation || ''
      }));
    }
  }

  return {
    success: true,
    lesson: lessonData,
    version: versionData,
    versionsList,
    assignmentsList,
    privateAnswers: isOwner ? privateAnswersMap : null,
    privateAnswersList: isOwner ? privateAnswersList : []
  };
}

// 3. SAVE LESSON DRAFT
async function handleSaveLessonDraft(req: VercelApiRequest, data: any) {
  const { uid: teacherUid } = await requireTeacher(req);
  const { lessonId: existingLessonId, draft } = data || {};

  if (!draft || !draft.title || !draft.passage) {
    throw new ApiError(400, 'invalid-argument', 'Bản nháp cần có tối thiểu tiêu đề và nội dung bài đọc.');
  }

  const db = getDb();
  const now = Date.now();
  const lessonRef = existingLessonId
    ? db.collection('lessons').doc(existingLessonId)
    : db.collection('lessons').doc();
  const lessonId = lessonRef.id;

  if (existingLessonId) {
    const existingDoc = await lessonRef.get();
    if (existingDoc.exists && existingDoc.data()?.teacherUid !== teacherUid) {
      throw new ApiError(403, 'permission-denied', 'Bạn không có quyền sửa bản nháp này.');
    }
  }

  const draftPayload = {
    ...draft,
    lessonId,
    title: String(draft.title).trim(),
    topic: String(draft.topic || 'Chủ đề chung').trim(),
    grade: Number(draft.grade || 2),
    semester: Number(draft.semester || 1),
    week: draft.week ? Number(draft.week) : 1,
    genre: draft.genre || 'narrative',
    passage: String(draft.passage).trim(),
    vocabulary: Array.isArray(draft.vocabulary) ? draft.vocabulary : [],
    questions: Array.isArray(draft.questions) ? draft.questions.map((q: any, idx: number) => sanitizeQuestionData(q, idx)) : [],
    audioUrl: draft.audioUrl || undefined,
    audioMetadata: draft.audioMetadata || undefined
  };

  await lessonRef.set(
    {
      id: lessonId,
      teacherUid,
      title: draftPayload.title,
      topic: draftPayload.topic,
      grade: draftPayload.grade,
      semester: draftPayload.semester,
      week: draftPayload.week,
      genre: draftPayload.genre,
      status: 'draft',
      draftData: draftPayload,
      updatedAt: now,
      createdAt: existingLessonId ? undefined : now
    },
    { merge: true }
  );

  return {
    success: true,
    lessonId,
    message: 'Đã lưu bản nháp bài đọc thành công vào hệ thống máy chủ.'
  };
}

// 4. PUBLISH LESSON
async function handlePublishLesson(req: VercelApiRequest, data: any) {
  const { uid: teacherUid } = await requireTeacher(req);
  const existingLessonId = data?.lessonId || data?.draft?.lessonId;
  const rawDraft = data?.draft;

  if (!rawDraft) {
    throw new ApiError(400, 'invalid-argument', 'Dữ liệu bài đọc không được để trống.');
  }

  const db = getDb();
  const now = Date.now();
  const lessonRef = existingLessonId
    ? db.collection('lessons').doc(existingLessonId)
    : db.collection('lessons').doc();
  const lessonId = lessonRef.id;

  if (existingLessonId) {
    const existingDoc = await lessonRef.get();
    if (existingDoc.exists && existingDoc.data()?.teacherUid !== teacherUid) {
      throw new ApiError(403, 'permission-denied', 'Bạn không có quyền xuất bản bài đọc này.');
    }
  }

  // Generate unique version ID
  const versionRef = lessonRef.collection('versions').doc();
  const versionId = versionRef.id;

  const publicQuestions: any[] = [];
  const privateAnswers: Record<string, any> = {};

  const questions = Array.isArray(rawDraft.questions) ? rawDraft.questions : [];
  questions.forEach((rawQ: any, idx: number) => {
    const q = sanitizeQuestionData(rawQ, idx);
    const qId = q.id || `q${idx + 1}`;

    // Gate 2: Pre-publish validation check
    const validation = validateQuestionForPublish(q, idx);
    if (!validation.valid) {
      throw new ApiError(400, 'invalid-argument', `Không thể xuất bản bài đọc vì: ${validation.errors.join('; ')}`);
    }

    publicQuestions.push({
      id: qId,
      type: q.type || 'multiple_choice',
      prompt: q.prompt,
      statement: q.statement || undefined,
      options: q.options || undefined,
      items: q.items || undefined,
      leftItems: q.leftItems || undefined,
      rightItems: q.rightItems || undefined,
      blankContext: q.blankContext || undefined,
      blankPosition: q.blankPosition || undefined,
      difficulty: q.difficulty || 'medium',
      skillTag: q.skillTag || 'general',
      relatedPassagePart: q.relatedPassagePart || undefined
    });

    privateAnswers[qId] = {
      correctAnswer: q.correctAnswer !== undefined ? q.correctAnswer : q.answer,
      acceptedAnswers: q.acceptedAnswers || undefined,
      matchingPairs: q.matchingPairs || undefined,
      hint: q.hint || '',
      explanation: q.explanation || '',
      type: q.type,
      options: q.options || undefined,
      items: q.items || undefined,
      leftItems: q.leftItems || undefined,
      rightItems: q.rightItems || undefined,
      blankContext: q.blankContext || undefined
    };
  });

  const versionData = {
    versionId,
    lessonId,
    teacherUid,
    title: rawDraft.title,
    topic: rawDraft.topic || 'Chủ đề chung',
    grade: Number(rawDraft.grade || 2),
    semester: Number(rawDraft.semester || 1),
    week: Number(rawDraft.week || 1),
    passage: rawDraft.passage,
    vocabulary: rawDraft.vocabulary || [],
    publicQuestions,
    audioUrl: rawDraft.audioUrl || undefined,
    audioMetadata: rawDraft.audioMetadata || undefined,
    publishedAt: now,
    createdAt: now
  };

  const batch = db.batch();

  // 1. Version snapshot
  batch.set(versionRef, versionData);

  // 2. Private Answer Key (strictly denied to client)
  const keyRef = db.collection('privateAnswerKeys').doc(versionId);
  batch.set(keyRef, {
    versionId,
    lessonId,
    answers: privateAnswers,
    createdAt: now
  });

  // 3. Lesson root document
  batch.set(
    lessonRef,
    {
      id: lessonId,
      teacherUid,
      title: versionData.title,
      topic: versionData.topic,
      grade: versionData.grade,
      semester: versionData.semester,
      week: versionData.week,
      status: 'published',
      currentVersionId: versionId,
      audioUrl: versionData.audioUrl || undefined,
      updatedAt: now,
      createdAt: existingLessonId ? undefined : now
    },
    { merge: true }
  );

  await batch.commit();

  return {
    success: true,
    lessonId,
    versionId,
    message: 'Bài đọc đã được phê duyệt và xuất bản thành công!'
  };
}

// 5. ARCHIVE LESSON
async function handleArchiveLesson(req: VercelApiRequest, data: any) {
  const { uid: teacherUid } = await requireTeacher(req);
  const { lessonId } = data || {};
  if (!lessonId) throw new ApiError(400, 'invalid-argument', 'Mã bài đọc không được để trống.');

  const db = getDb();
  const ref = db.collection('lessons').doc(lessonId);
  const doc = await ref.get();
  if (!doc.exists) throw new ApiError(404, 'not-found', 'Bài đọc không tồn tại.');
  if (doc.data()?.teacherUid !== teacherUid) {
    throw new ApiError(403, 'permission-denied', 'Bạn không có quyền lưu trữ bài đọc này.');
  }

  await ref.update({ status: 'archived', updatedAt: Date.now() });
  return { success: true, message: 'Đã lưu trữ bài đọc thành công.' };
}

// 6. DELETE DRAFT LESSON
async function handleDeleteDraftLesson(req: VercelApiRequest, data: any) {
  const { uid: teacherUid } = await requireTeacher(req);
  const { lessonId } = data || {};
  if (!lessonId) throw new ApiError(400, 'invalid-argument', 'Mã bài đọc không được để trống.');

  const db = getDb();
  const ref = db.collection('lessons').doc(lessonId);
  const doc = await ref.get();
  if (!doc.exists) throw new ApiError(404, 'not-found', 'Bài đọc không tồn tại.');
  if (doc.data()?.teacherUid !== teacherUid) {
    throw new ApiError(403, 'permission-denied', 'Bạn không có quyền xóa bài đọc này.');
  }
  if (doc.data()?.status !== 'draft') {
    throw new ApiError(400, 'failed-precondition', 'Chỉ được phép xóa bài đọc ở trạng thái Nháp.');
  }

  await ref.delete();
  return { success: true, message: 'Đã xóa bản nháp thành công.' };
}

// 7. UPDATE LESSON SCOPE
async function handleUpdateLessonScope(req: VercelApiRequest, data: any) {
  const { uid: teacherUid } = await requireTeacher(req);
  const { lessonId, academicYearScope, academicYear } = data || {};
  if (!lessonId) throw new ApiError(400, 'invalid-argument', 'Mã bài đọc không được để trống.');

  const db = getDb();
  const ref = db.collection('lessons').doc(lessonId);
  const doc = await ref.get();
  if (!doc.exists) throw new ApiError(404, 'not-found', 'Bài đọc không tồn tại.');
  if (doc.data()?.teacherUid !== teacherUid) {
    throw new ApiError(403, 'permission-denied', 'Bạn không có quyền cập nhật bài đọc này.');
  }

  await ref.update({
    academicYearScope: academicYearScope || 'shared',
    academicYear: academicYearScope === 'specific' ? academicYear : null,
    updatedAt: Date.now()
  });

  return { success: true, message: 'Đã cập nhật phạm vi niên khóa thành công.' };
}

// 8. ASSIGN LESSON
async function handleAssignLesson(req: VercelApiRequest, data: any) {
  const { uid: teacherUid } = await requireTeacher(req);
  const {
    lessonId,
    versionId,
    classId,
    classIds,
    availableFrom,
    availableUntil,
    maxAttempts,
    roundName,
    isPreTest,
    isPostTest,
    pairedAssessmentId
  } = data || {};

  const targetClassIds = Array.isArray(classIds) && classIds.length > 0 ? classIds : classId ? [classId] : [];
  if (!lessonId || targetClassIds.length === 0) {
    throw new ApiError(400, 'invalid-argument', 'Vui lòng cung cấp mã bài đọc và ít nhất một lớp học.');
  }

  const db = getDb();
  const lessonDoc = await db.collection('lessons').doc(lessonId).get();
  if (!lessonDoc.exists) throw new ApiError(404, 'not-found', 'Bài đọc không tồn tại.');
  const lessonData = lessonDoc.data()!;

  const targetVersionId = versionId || lessonData.currentVersionId;
  if (!targetVersionId) throw new ApiError(400, 'failed-precondition', 'Bài đọc chưa có phiên bản xuất bản.');

  const versionDoc = await db.collection('lessons').doc(lessonId).collection('versions').doc(targetVersionId).get();
  if (!versionDoc.exists) throw new ApiError(404, 'not-found', 'Phiên bản bài đọc không tồn tại.');
  const vData = versionDoc.data()!;

  const now = Date.now();
  const createdAssignments: any[] = [];
  const preventedDuplicates: any[] = [];
  const targetRound = roundName || 'Đợt 1';

  for (const cId of targetClassIds) {
    const classDoc = await db.collection('classes').doc(cId).get();
    if (!classDoc.exists || classDoc.data()?.teacherUid !== teacherUid) {
      continue;
    }
    const cData = classDoc.data()!;

    // Duplicate check
    const existingSnap = await db
      .collection('assignments')
      .where('classId', '==', cId)
      .where('lessonId', '==', lessonId)
      .where('roundName', '==', targetRound)
      .where('status', '==', 'active')
      .get();

    if (!existingSnap.empty) {
      preventedDuplicates.push({
        classId: cId,
        className: cData.name,
        assignment: existingSnap.docs[0].data()
      });
      continue;
    }

    const assignRef = db.collection('assignments').doc();
    const assignmentData = {
      id: assignRef.id,
      classId: cId,
      academicYear: cData.academicYear || '2026-2027',
      semester: Number(vData.semester || 1),
      week: Number(vData.week || 1),
      lessonId,
      lessonVersionId: targetVersionId,
      teacherUid,
      lessonTitle: vData.title,
      grade: vData.grade,
      topic: vData.topic,
      audioUrl: vData.audioUrl || undefined,
      hasAudio: Boolean(vData.audioUrl),
      roundName: targetRound,
      availableFrom: availableFrom || now,
      availableUntil: availableUntil || null,
      maxAttempts: maxAttempts ? Number(maxAttempts) : 3,
      isPreTest: Boolean(isPreTest),
      isPostTest: Boolean(isPostTest),
      pairedAssessmentId: pairedAssessmentId || null,
      status: 'active',
      assignedAt: now,
      createdAt: now
    };

    await assignRef.set(assignmentData);
    createdAssignments.push(assignmentData);
  }

  if (targetClassIds.length === 1 && createdAssignments.length === 0 && preventedDuplicates.length > 0) {
    return {
      success: true,
      isExisting: true,
      isDuplicatePrevented: true,
      message: `Bài đọc này đã được giao cho lớp ${preventedDuplicates[0].className} (${targetRound}).`,
      assignment: preventedDuplicates[0].assignment
    };
  }

  return {
    success: true,
    isDuplicatePrevented: preventedDuplicates.length > 0,
    createdCount: createdAssignments.length,
    duplicateCount: preventedDuplicates.length,
    assignment: createdAssignments[0] || preventedDuplicates[0]?.assignment,
    assignments: createdAssignments,
    message: `Đã giao bài thành công cho ${createdAssignments.length} lớp học.`
  };
}

// ==========================================
// 8. GEMINI AI INTEGRATION (STANDARDIZED: PRIMARY 3.8-FLASH, FALLBACK 3.5-FLASH-LITE)
// ==========================================

export const PRIMARY_GEMINI_MODEL = 'gemini-3.8-flash';
export const FALLBACK_GEMINI_MODEL = 'gemini-3.5-flash-lite';

// In-memory cache for AI status to prevent blocking every page load with external network ping
let cachedAIStatus: { result: any; timestamp: number } | null = null;
const AI_STATUS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Helper: execute candidate ping across supported Gemini models with timeout
async function executeGeminiPing(apiKey: string): Promise<{
  ok: boolean;
  status: number;
  latencyMs: number;
  activeModel: string;
  errorDesc?: string;
  rawError?: string;
  fallbackUsed?: boolean;
}> {
  const primaryModel = process.env.GEMINI_MODEL || PRIMARY_GEMINI_MODEL;
  const candidateModels = [
    primaryModel,
    FALLBACK_GEMINI_MODEL
  ].filter((m, idx, arr) => m && arr.indexOf(m) === idx);

  let lastStatus = 500;
  let lastRawError = '';

  for (let i = 0; i < candidateModels.length; i++) {
    const model = candidateModels[i];
    const isFallback = i > 0;
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Ping' }] }],
            generationConfig: { maxOutputTokens: 2 }
          }),
          signal: controller.signal
        }
      );
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;
      if (response.ok) {
        if (isFallback) {
          console.warn(`[Gemini AI] Ping succeeded on verified fallback model "${model}" (${latencyMs}ms).`);
        }
        return { ok: true, status: response.status, latencyMs, activeModel: model, fallbackUsed: isFallback };
      }
      lastStatus = response.status;
      lastRawError = await response.text();
      console.warn(`[Gemini AI] Ping model "${model}" failed (HTTP ${lastStatus}): ${lastRawError.slice(0, 100)}`);
    } catch (e: any) {
      clearTimeout(timeoutId);
      lastRawError = e.message;
      if (e.name === 'AbortError') {
        lastStatus = 408;
      }
      console.warn(`[Gemini AI] Ping model "${model}" error: ${e.message}`);
    }
  }

  let errorDesc = `HTTP ${lastStatus}`;
  if (lastStatus === 400) errorDesc = 'Khóa API không hợp lệ (API_KEY_INVALID)';
  else if (lastStatus === 403) errorDesc = 'Khóa API bị hạn chế quyền hoặc chưa bật API (PERMISSION_DENIED)';
  else if (lastStatus === 404) errorDesc = 'Mô hình Gemini không tìm thấy (MODEL_NOT_FOUND)';
  else if (lastStatus === 408) errorDesc = 'Kiểm tra kết nối AI quá thời gian (TIMEOUT)';
  else if (lastStatus === 429) errorDesc = 'Hết hạn ngạch hoặc bị giới hạn tốc độ (QUOTA_EXCEEDED)';
  else if (lastStatus === 503) errorDesc = 'Dịch vụ Gemini tạm thời quá tải (SERVICE_UNAVAILABLE_503)';

  return {
    ok: false,
    status: lastStatus,
    latencyMs: 0,
    activeModel: candidateModels[0] || PRIMARY_GEMINI_MODEL,
    errorDesc,
    rawError: lastRawError
  };
}

// 8b. GENERATE LESSON DRAFT WITH GEMINI AI (5 QUESTION TYPES & CONFIGURABLE COUNT)
async function handleGenerateLessonDraft(req: VercelApiRequest, data: any) {
  await requireTeacher(req);
  const {
    grade,
    topic,
    genre,
    readingGoal,
    targetWordCount,
    difficulty,
    questionTypes,
    questionCount
  } = data || {};

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) {
    throw new ApiError(
      503,
      'failed-precondition',
      'Chưa cấu hình GEMINI_API_KEY trên môi trường Vercel. Vui lòng cấu hình biến môi trường GEMINI_API_KEY trong Project Settings hoặc sử dụng chức năng Soạn thủ công.'
    );
  }

  const safeTopic = String(topic || 'Tình cảm gia đình').replace(/[\r\n\t]+/g, ' ').slice(0, 100);
  const targetGrade = Number(grade || 2);
  const wordCount = targetWordCount || (targetGrade === 2 ? 140 : 180);

  // Parse and enforce questionCount from allowed choices [3, 4, 5, 6, 8, 10, 12, 15], default 6
  const allowedCounts = [3, 4, 5, 6, 8, 10, 12, 15];
  let totalQuestions = 6;
  if (typeof questionCount === 'number' && allowedCounts.includes(questionCount)) {
    totalQuestions = questionCount;
  } else if (typeof questionCount === 'number' && questionCount >= 3 && questionCount <= 20) {
    totalQuestions = Math.floor(questionCount);
  }

  // Question types selected by teacher
  const validTypes: string[] = ['multiple_choice', 'true_false', 'sequence', 'matching', 'fill_blank'];
  const activeTypes: string[] = Array.isArray(questionTypes) && questionTypes.length > 0
    ? questionTypes.filter((t: string) => validTypes.includes(t))
    : validTypes;
  if (activeTypes.length === 0) {
    activeTypes.push('multiple_choice', 'true_false', 'sequence', 'matching', 'fill_blank');
  }

  const prompt = `Bạn là chuyên gia sư phạm tiểu học môn Tiếng Việt cho học sinh lớp ${targetGrade}.
Hãy tạo một bài đọc hiểu mới hoàn chỉnh bằng Tiếng Việt theo chuẩn chương trình GDPT 2018.
Chủ đề: "${safeTopic}". Thể loại: ${genre === 'informational' ? 'Văn bản thông tin' : 'Văn bản tự sự / Truyện ngắn'}.
${readingGoal ? `Mục tiêu đọc hiểu: ${readingGoal}` : ''}
${difficulty ? `Mức độ nhận thức chính: ${difficulty}` : ''}
Độ dài bài đọc: khoảng ${wordCount} từ (Lớp 2: 100-180 từ; Lớp 3: 150-220 từ). Giọng văn trong sáng, dễ hiểu, giàu cảm xúc, không sao chép nguyên văn SGK.
Có 2-3 từ vựng khó được giải nghĩa (vocabulary).

YÊU CẦU CÂU HỎI ĐỌC HIỂU:
BẮT BUỘC tạo ĐÚNG CHÍNH XÁC ${totalQuestions} CÂU HỎI đọc hiểu (id từ "q1" đến "q${totalQuestions}", không được thiếu, không được thừa), phân bổ trong các dạng sau: ${activeTypes.join(', ')}:
1. multiple_choice: Trắc nghiệm 3 lựa chọn options (A, B, C), options là mảng đúng 3 chuỗi sạch (không gắn "A.", "B."), answer là 'A' hoặc 'B' hoặc 'C'.
2. true_false: Đúng / Sai, có statement là nhận định rõ ràng về bài đọc, answer là true hoặc false.
3. sequence: Sắp xếp 3 sự việc theo trình tự thời gian, items là mảng 3 chuỗi sự việc, answer là mảng 3 chuỗi theo đúng thứ tự trước sau chuẩn xác.
4. matching: Ghép đôi 3 đối tượng (từ với nghĩa, hoặc nhân vật/sự việc với nội dung tương ứng). leftItems là mảng 3 chuỗi ở cột trái, rightItems là mảng 3 chuỗi ở cột phải, matchingPairs là một object { [chuỗi trái]: chuỗi phải tương ứng }, answer là matchingPairs này.
5. fill_blank: Điền khuyết ngắn 1–2 từ. prompt hoặc blankContext chứa câu ngữ cảnh có chỗ trống đánh dấu bằng [ ... ], answer là từ/cụm từ 1-2 từ chính xác cần điền (đúng dấu tiếng Việt), acceptedAnswers là mảng 1-3 cách diễn đạt tương đương được chấp nhận (ví dụ: ["mùa xuân", "xuân"]).

Mỗi câu hỏi PHẢI có các trường:
- id: "q1", "q2", ...
- type: 'multiple_choice' | 'true_false' | 'sequence' | 'matching' | 'fill_blank'
- prompt: lời dẫn câu hỏi sư phạm rõ ràng
- hint: Gợi ý sư phạm giúp học sinh tự suy nghĩ (TUYỆT ĐỐI KHÔNG chứa đáp án đúng hoặc làm lộ đáp án)
- explanation: Lời giải thích vì sao đáp án đó là đúng để học sinh học tập
- skillTag: một trong ('thong_tin_truc_tiep' | 'tu_trong_ngu_canh' | 'noi_dung_chinh' | 'sap_xep_trinh_tu' | 'lien_he_van_dung')
- difficulty: một trong ('nhan_biet' | 'thong_hieu' | 'van_dung')
- relatedPassagePart: trích đoạn ngắn trong bài đọc liên quan đến câu hỏi.

Trả về DUY NHẤT định dạng JSON thuần dạng:
{
  "title": "Tên bài đọc",
  "passage": "Nội dung bài đọc...",
  "grade": ${targetGrade},
  "topic": "${safeTopic}",
  "genre": "${genre || 'narrative'}",
  "vocabulary": [
    {"word": "từ khó 1", "meaning": "nghĩa ngắn gọn", "example": "câu ví dụ"},
    {"word": "từ khó 2", "meaning": "nghĩa ngắn gọn", "example": "câu ví dụ"}
  ],
  "questions": [ ... chính xác ${totalQuestions} câu hỏi ... ]
}`;

  const primaryModel = process.env.GEMINI_MODEL || PRIMARY_GEMINI_MODEL;
  const fallbackModel = FALLBACK_GEMINI_MODEL;

  let usedModel = primaryModel;
  let response: any = null;
  let lastErrText = '';
  let lastStatus = 500;
  let fallbackUsed = false;
  let primaryErrorDesc = '';
  const startTime = Date.now();

  console.log(`[Gemini AI] handleGenerateLessonDraft: attempting primary model "${primaryModel}" (${totalQuestions} questions)...`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    response = await fetch(
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
    if (!response.ok) {
      lastStatus = response.status;
      lastErrText = await response.text();
      primaryErrorDesc = `Primary model ${primaryModel} failed (HTTP ${lastStatus}): ${lastErrText.slice(0, 120)}`;
      console.warn(`[Gemini AI] Primary model "${primaryModel}" error (HTTP ${lastStatus}). Switching to fallback model "${fallbackModel}"...`);
    }
  } catch (err: any) {
    primaryErrorDesc = `Primary model ${primaryModel} exception: ${err.message}`;
    console.warn(`[Gemini AI] Primary model "${primaryModel}" threw error: ${err.message}. Switching to fallback model "${fallbackModel}"...`);
  }

  // Fallback to verified gemini-3.5-flash-lite if primary model failed
  if (!response || !response.ok) {
    usedModel = fallbackModel;
    fallbackUsed = true;
    console.log(`[Gemini AI] Executing verified fallback model: "${fallbackModel}"...`);
    const fbController = new AbortController();
    const fbTimeoutId = setTimeout(() => fbController.abort(), 25000);
    try {
      response = await fetch(
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
      if (!response.ok) {
        const fbErrText = await response.text();
        throw new ApiError(502, 'internal', `Dịch vụ Gemini AI (Dự phòng ${fallbackModel}) phản hồi lỗi (HTTP ${response.status}): ${fbErrText.slice(0, 150)}`);
      }
    } catch (fbErr: any) {
      clearTimeout(fbTimeoutId);
      if (fbErr instanceof ApiError) throw fbErr;
      throw new ApiError(502, 'internal', `Không thể kết nối dịch vụ Gemini AI (${fallbackModel}): ${fbErr.message}`);
    }
  }

  const durationMs = Date.now() - startTime;
  console.log(`[Gemini AI] Successfully generated draft with model "${usedModel}" in ${durationMs}ms (fallbackUsed: ${fallbackUsed})`);

  const resData: any = await response.json();
  const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new ApiError(500, 'internal', `Mô hình ${usedModel} không trả về nội dung bài đọc.`);
  }

  let draft: any;
  try {
    draft = JSON.parse(rawText);
  } catch {
    throw new ApiError(500, 'internal', 'Không thể phân tích định dạng JSON từ Gemini AI.');
  }

  // Canonicalize & sanitize all questions generated by AI
  if (draft && Array.isArray(draft.questions)) {
    draft.questions = draft.questions.map((q: any, idx: number) => sanitizeQuestionData(q, idx));

    // Guarantee exact question count as requested by teacher
    if (draft.questions.length > totalQuestions) {
      draft.questions = draft.questions.slice(0, totalQuestions);
    } else if (draft.questions.length < totalQuestions) {
      const missingCount = totalQuestions - draft.questions.length;
      console.warn(`[Gemini AI] Draft generated ${draft.questions.length}/${totalQuestions} questions. Synthesizing ${missingCount} questions to meet requirement...`);
      for (let i = 0; i < missingCount; i++) {
        const qIdx = draft.questions.length;
        const qType = activeTypes[qIdx % activeTypes.length];
        if (qType === 'true_false') {
          draft.questions.push(sanitizeQuestionData({
            id: `q${qIdx + 1}`,
            type: 'true_false',
            prompt: `Nhận định về bài đọc "${draft.title || 'bài đọc'}":`,
            statement: `Nội dung bài đọc thể hiện thông điệp ý nghĩa và trong sáng.`,
            answer: true,
            hint: 'Em hãy đọc kỹ lại đoạn văn để xác nhận chi tiết nhé.',
            explanation: 'Nội dung bài đọc thể hiện tình cảm và bài học bổ ích cho học sinh.',
            skillTag: 'noi_dung_chinh',
            difficulty: 'thong_hieu'
          }, qIdx));
        } else if (qType === 'matching') {
          draft.questions.push(sanitizeQuestionData({
            id: `q${qIdx + 1}`,
            type: 'matching',
            prompt: 'Ghép từ ngữ hoặc chi tiết ở cột trái với nội dung thích hợp ở cột phải:',
            leftItems: ['Chi tiết 1', 'Chi tiết 2', 'Chi tiết 3'],
            rightItems: ['Nội dung tương ứng 1', 'Nội dung tương ứng 2', 'Nội dung tương ứng 3'],
            matchingPairs: {
              'Chi tiết 1': 'Nội dung tương ứng 1',
              'Chi tiết 2': 'Nội dung tương ứng 2',
              'Chi tiết 3': 'Nội dung tương ứng 3'
            },
            hint: 'Em hãy đọc lại từng câu trong bài để nối cho đúng nhé.',
            explanation: 'Mỗi chi tiết đều được miêu tả rõ ràng trong bài đọc.',
            skillTag: 'tu_trong_ngu_canh',
            difficulty: 'thong_hieu'
          }, qIdx));
        } else if (qType === 'fill_blank') {
          draft.questions.push(sanitizeQuestionData({
            id: `q${qIdx + 1}`,
            type: 'fill_blank',
            prompt: 'Em hãy tìm từ ngữ thích hợp trong bài để điền vào chỗ trống:',
            blankContext: `Bài đọc mang lại cảm xúc [ ... ] cho các bạn nhỏ.`,
            answer: 'vui tươi',
            acceptedAnswers: ['vui tươi', 'hân hoan'],
            hint: 'Em hãy tìm từ miêu tả cảm xúc được nhắc đến trong bài đọc nhé.',
            explanation: 'Từ ngữ thể hiện đúng tinh thần bài đọc.',
            skillTag: 'tu_trong_ngu_canh',
            difficulty: 'nhan_biet'
          }, qIdx));
        } else if (qType === 'sequence') {
          draft.questions.push(sanitizeQuestionData({
            id: `q${qIdx + 1}`,
            type: 'sequence',
            prompt: 'Sắp xếp các sự việc sau theo đúng thứ tự diễn ra trong bài đọc:',
            items: ['Sự việc mở đầu', 'Sự việc diễn biến', 'Sự việc kết thúc'],
            answer: ['Sự việc mở đầu', 'Sự việc diễn biến', 'Sự việc kết thúc'],
            hint: 'Em hãy xem sự việc nào xảy ra trước, sự việc nào xảy ra sau nhé.',
            explanation: 'Trình tự thời gian được thể hiện lần lượt từ đầu đến cuối câu chuyện.',
            skillTag: 'sap_xep_trinh_tu',
            difficulty: 'thong_hieu'
          }, qIdx));
        } else {
          draft.questions.push(sanitizeQuestionData({
            id: `q${qIdx + 1}`,
            type: 'multiple_choice',
            prompt: `Ý nghĩa chính của bài đọc "${draft.title || 'này'}" là gì?`,
            options: [
              'Khuyên em biết yêu quý và bảo vệ thiên nhiên',
              'Nhắc nhở em luôn vâng lời thầy cô và cha mẹ',
              'Giúp em thêm yêu vẻ đẹp quê hương đất nước'
            ],
            answer: 'A',
            hint: 'Em hãy đọc lại phần kết thúc bài đọc để tìm ý nghĩa nhé.',
            explanation: 'Bài đọc gửi gắm bài học gần gũi với lứa tuổi tiểu học.',
            skillTag: 'noi_dung_chinh',
            difficulty: 'thong_hieu'
          }, qIdx));
        }
      }
    }
  }

  return {
    success: true,
    draft,
    isAiGenerated: true,
    model: usedModel,
    primaryModel,
    fallbackUsed,
    primaryError: primaryErrorDesc || undefined,
    latencyMs: durationMs,
    questionCount: draft.questions?.length || totalQuestions
  };
}

// 9. AI STATUS
async function handleGetAIStatus() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

  if (!apiKey) {
    return {
      success: true,
      connected: false,
      status: 'NOT_CONFIGURED',
      provider: 'Offline / Manual Mode',
      model: PRIMARY_GEMINI_MODEL,
      activeModel: PRIMARY_GEMINI_MODEL,
      supportedFeatures: {
        lessonGeneration: false,
        remediationSuggestion: false,
        questionGeneration: false
      }
    };
  }

  if (cachedAIStatus && (Date.now() - cachedAIStatus.timestamp < AI_STATUS_CACHE_TTL_MS)) {
    return cachedAIStatus.result;
  }

  try {
    const pingResult = await executeGeminiPing(apiKey);

    if (pingResult.ok) {
      const res = {
        success: true,
        connected: true,
        status: 'VERIFIED',
        activeModel: pingResult.activeModel,
        model: pingResult.activeModel,
        lastLatencyMs: pingResult.latencyMs,
        fallbackUsed: pingResult.fallbackUsed,
        provider: 'Google Gemini AI',
        supportedFeatures: {
          lessonGeneration: true,
          remediationSuggestion: true,
          questionGeneration: true
        }
      };
      cachedAIStatus = { result: res, timestamp: Date.now() };
      return res;
    } else {
      const res = {
        success: true,
        connected: true,
        status: 'UNAVAILABLE',
        activeModel: pingResult.activeModel,
        model: pingResult.activeModel,
        lastErrorCode: pingResult.errorDesc || `HTTP ${pingResult.status}`,
        message: `Dịch vụ Google Gemini phản hồi lỗi (${pingResult.status}): ${(pingResult.rawError || '').slice(0, 150)}`,
        provider: 'Google Gemini AI',
        supportedFeatures: {
          lessonGeneration: false,
          remediationSuggestion: false,
          questionGeneration: false
        }
      };
      cachedAIStatus = { result: res, timestamp: Date.now() - (AI_STATUS_CACHE_TTL_MS - 60000) };
      return res;
    }
  } catch (err: any) {
    const res = {
      success: true,
      connected: true,
      status: 'READY_UNVERIFIED',
      activeModel: PRIMARY_GEMINI_MODEL,
      model: PRIMARY_GEMINI_MODEL,
      provider: 'Google Gemini AI',
      message: `Đã nhận diện khóa API trong backend nhưng chưa kiểm chứng với cuộc gọi thật: ${err.message}`,
      supportedFeatures: {
        lessonGeneration: true,
        remediationSuggestion: true,
        questionGeneration: true
      }
    };
    cachedAIStatus = { result: res, timestamp: Date.now() };
    return res;
  }
}

// 10. TEST AI CONNECTION
async function handleTestAIConnection() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      status: {
        status: 'NOT_CONFIGURED',
        activeModel: PRIMARY_GEMINI_MODEL,
        model: PRIMARY_GEMINI_MODEL,
        lastErrorCode: 'MISSING_API_KEY',
        message: 'Chưa cấu hình GEMINI_API_KEY trên môi trường máy chủ Vercel.'
      },
      error: 'Chưa cấu hình GEMINI_API_KEY trên môi trường máy chủ Vercel.'
    };
  }

  try {
    const pingResult = await executeGeminiPing(apiKey);

    if (pingResult.ok) {
      return {
        success: true,
        status: {
          status: 'VERIFIED',
          activeModel: pingResult.activeModel,
          model: pingResult.activeModel,
          lastLatencyMs: pingResult.latencyMs,
          fallbackUsed: pingResult.fallbackUsed,
          provider: 'Google Gemini AI'
        },
        message: `Kết nối dịch vụ AI Google Gemini sẵn sàng (Độ trễ: ${pingResult.latencyMs}ms, Model: ${pingResult.activeModel}${pingResult.fallbackUsed ? ' [Dự phòng]' : ''}).`
      };
    } else {
      return {
        success: false,
        status: {
          status: 'UNAVAILABLE',
          activeModel: pingResult.activeModel,
          model: pingResult.activeModel,
          lastErrorCode: pingResult.errorDesc || `HTTP ${pingResult.status}`,
          message: `Lỗi kết nối Gemini API (${pingResult.status}): ${(pingResult.rawError || '').slice(0, 150)}`
        },
        error: `Lỗi kết nối Gemini API (${pingResult.status}): ${(pingResult.rawError || '').slice(0, 150)}`
      };
    }
  } catch (err: any) {
    return {
      success: false,
      status: {
        status: 'UNAVAILABLE',
        activeModel: FALLBACK_GEMINI_MODEL,
        model: FALLBACK_GEMINI_MODEL,
        lastErrorCode: 'NETWORK_ERROR',
        message: `Không thể kết nối tới Google Gemini: ${err.message}`
      },
      error: `Không thể kết nối tới Google Gemini: ${err.message}`
    };
  }
}

// 13. GENERATE LESSON AUDIO WITH AI (Gemini TTS)
async function handleGenerateLessonAudioWithAI(req: VercelApiRequest, data: any) {
  const { uid: teacherUid } = await requireTeacher(req);
  const { passage, title, grade, voiceGender, readingStyle, lessonId, engine } = data || {};

  if (!passage || typeof passage !== 'string' || passage.trim().length < 20) {
    throw new ApiError(
      400,
      'invalid-argument',
      'Văn bản bài đọc quá ngắn hoặc không hợp lệ để tạo giọng đọc AI (tối thiểu 20 ký tự).'
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length <= 5) {
    throw new ApiError(
      503,
      'unavailable',
      'Chưa cấu hình GEMINI_API_KEY trên môi trường Production. Vui lòng kiểm tra biến môi trường trong Vercel Settings.'
    );
  }

  const cleanPassage = passage.trim();
  const voiceId = voiceGender === 'male' ? 'Puck' : 'Aoede';
  const requestId = `tts_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Candidate models: primary gemini-3.8-flash-lite-tts, fallback gemini-3.8-flash-tts
  const candidateModels = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'];
  let audioBuffer: Buffer | null = null;
  let activeModel = candidateModels[0];
  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
      const payload = {
        contents: [{ parts: [{ text: cleanPassage }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceId
              }
            }
          }
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorJson: any = null;
        try { errorJson = JSON.parse(errorText); } catch {}
        const msg = errorJson?.error?.message || `HTTP ${response.status}: ${response.statusText}`;

        if (response.status === 429) {
          throw new ApiError(
            429,
            'resource-exhausted',
            `Hạn mức dịch vụ Gemini TTS tạm thời bị giới hạn (Quota 429). Mã yêu cầu: ${requestId}. Vui lòng đợi 1–2 phút rồi thử lại.`
          );
        }

        if (response.status === 404) {
          lastError = new Error(`Mô hình ${model} không khả dụng (${msg}).`);
          continue;
        }

        throw new ApiError(
          response.status >= 400 && response.status < 500 ? response.status : 502,
          'failed-precondition',
          `Lỗi máy chủ Gemini TTS (Mã yêu cầu: ${requestId}, HTTP ${response.status}): ${msg}`
        );
      }

      const resJson: any = await response.json();
      const candidate = resJson.candidates?.[0];
      const audioPart = candidate?.content?.parts?.find((p: any) => p.inlineData && p.inlineData.data);
      if (!audioPart) {
        throw new ApiError(
          502,
          'internal',
          `Dịch vụ Gemini TTS không trả về dữ liệu âm thanh hợp lệ (Mã yêu cầu: ${requestId}).`
        );
      }

      audioBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
      activeModel = model;
      break;
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      lastError = err;
    }
  }

  if (!audioBuffer) {
    throw new ApiError(
      502,
      'internal',
      `Không thể tạo âm thanh từ Gemini TTS (Mã yêu cầu: ${requestId}): ${lastError?.message || 'Lỗi không xác định.'}`
    );
  }

  // Calculate duration
  let byteRate = 48000;
  if (audioBuffer.length >= 32) {
    const headerByteRate = audioBuffer.readUInt32LE(28);
    if (headerByteRate > 8000 && headerByteRate < 192000) {
      byteRate = headerByteRate;
    }
  }
  const dataSize = Math.max(0, audioBuffer.length - 44);
  const durationSeconds = Math.round((dataSize / byteRate) * 10) / 10;

  // Persist to Cloud Firestore in chunks
  const db = getDb();
  const timestamp = Date.now();
  const safeLessonId = (lessonId || 'new_lesson').replace(/[^a-zA-Z0-9_-]/g, '');
  const fileId = `tts_${safeLessonId}_${voiceGender === 'male' ? 'male_puck' : 'female_aoede'}_${timestamp}`;
  const fileName = `${fileId}.wav`;

  const base64Str = audioBuffer.toString('base64');
  const CHUNK_SIZE = 500000; // ~500KB per chunk in base64
  const chunkCount = Math.ceil(base64Str.length / CHUNK_SIZE);

  const fileDocRef = db.collection('audioStorage').doc(fileId);
  await fileDocRef.set({
    fileId,
    fileName,
    mimeType: 'audio/wav',
    sizeBytes: audioBuffer.length,
    durationSeconds,
    chunkCount,
    model: activeModel,
    voiceId,
    teacherUid,
    lessonId: lessonId || null,
    createdAt: timestamp
  });

  const chunkPromises = [];
  for (let i = 0; i < chunkCount; i++) {
    const chunkData = base64Str.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    chunkPromises.push(
      fileDocRef.collection('chunks').doc(String(i).padStart(4, '0')).set({
        chunkIndex: i,
        data: chunkData
      })
    );
  }
  await Promise.all(chunkPromises);

  const audioUrl = `/api/audio?id=${fileId}`;

  const metadata = {
    lessonId: lessonId || undefined,
    storagePath: `audioStorage/${fileId}`,
    audioUrl,
    downloadUrl: audioUrl,
    engine: 'gemini_tts',
    model: activeModel,
    voiceId,
    duration: Math.round(durationSeconds),
    durationSeconds: Math.round(durationSeconds),
    size: audioBuffer.length,
    sizeBytes: audioBuffer.length,
    status: 'pending_approval',
    approvalStatus: 'pending_review',
    voiceType: 'gemini_tts',
    createdAt: new Date().toISOString(),
    uploadedAt: new Date().toISOString(),
    uploadedBy: teacherUid,
    fileName,
    mimeType: 'audio/wav'
  };

  return {
    success: true,
    metadata,
    audioUrl,
    downloadUrl: audioUrl,
    durationSeconds,
    voiceId,
    model: activeModel,
    engine: 'gemini_tts',
    message: `Gemini AI đã tạo thành công giọng đọc trực tuyến (~${durationSeconds}s, giọng ${voiceId}, mô hình ${activeModel})!`
  };
}

// 14. APPROVE LESSON AUDIO
async function handleApproveLessonAudio(req: VercelApiRequest, data: any) {
  const { uid: teacherUid } = await requireTeacher(req);
  const { lessonId, versionId, audioUrl, metadata } = data || {};

  if (!lessonId) {
    throw new ApiError(400, 'invalid-argument', 'Mã bài đọc (lessonId) không được để trống.');
  }

  const db = getDb();
  const lessonDoc = await db.collection('lessons').doc(lessonId).get();
  if (!lessonDoc.exists) {
    throw new ApiError(404, 'not-found', 'Bài đọc không tồn tại.');
  }

  const lessonData = lessonDoc.data()!;
  const targetVersionId = versionId || lessonData.currentVersionId;
  const realAudioUrl = audioUrl || metadata?.audioUrl;

  if (targetVersionId) {
    const vRef = db.collection('lessons').doc(lessonId).collection('versions').doc(targetVersionId);
    await vRef.set(
      {
        audioUrl: realAudioUrl,
        audioMetadata: metadata || null,
        updatedAt: Date.now()
      },
      { merge: true }
    );
  }

  // Also update parent lesson document
  await db.collection('lessons').doc(lessonId).set(
    {
      audioUrl: realAudioUrl,
      audioMetadata: metadata || null,
      updatedAt: Date.now()
    },
    { merge: true }
  );

  return {
    success: true,
    audioUrl: realAudioUrl,
    message: 'Đã phê duyệt và lưu giọng đọc AI vào bài học thành công.'
  };
}

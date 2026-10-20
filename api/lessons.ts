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

import { getDb } from './helpers/firebaseAdmin.js';
import { handleApiError, requireTeacher, requireTeacherOrAdmin } from './helpers/authMiddleware.js';
import { ApiError, VercelApiRequest, VercelApiResponse } from './helpers/types.js';

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

  const snap = await lessonQuery.get();
  const lessons: any[] = [];

  for (const doc of snap.docs) {
    const lData = doc.data();

    const assignSnap = await db
      .collection('assignments')
      .where('lessonId', '==', doc.id)
      .where('status', '==', 'active')
      .get();

    const assignedClasses = assignSnap.docs.map((ad) => ({
      assignmentId: ad.id,
      classId: ad.data().classId,
      roundName: ad.data().roundName || 'Đợt 1',
      lessonVersionId: ad.data().lessonVersionId
    }));

    lessons.push({
      ...lData,
      assignedClassCount: assignSnap.size,
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
      if (versionData && !versionData.audioUrl && lessonData.audioUrl) {
        versionData.audioUrl = lessonData.audioUrl;
        versionData.audioMetadata = versionData.audioMetadata || lessonData.audioMetadata;
      }
    }
    if (isOwner) {
      const keyDoc = await db.collection('privateAnswerKeys').doc(targetVersionId).get();
      if (keyDoc.exists) {
        privateAnswers = keyDoc.data()?.answers || null;
      }
    }
  }

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
    questions: Array.isArray(draft.questions) ? draft.questions : [],
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
  questions.forEach((q: any, idx: number) => {
    const qId = q.id || `q${idx + 1}`;
    publicQuestions.push({
      id: qId,
      type: q.type || 'multiple_choice',
      prompt: q.prompt,
      options: q.options || [],
      difficulty: q.difficulty || 'medium',
      skillTag: q.skillTag || 'general'
    });

    privateAnswers[qId] = {
      correctAnswer: q.correctAnswer !== undefined ? q.correctAnswer : q.answer,
      hint: q.hint || '',
      explanation: q.explanation || ''
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

// 8b. GENERATE LESSON DRAFT WITH GEMINI AI
async function handleGenerateLessonDraft(req: VercelApiRequest, data: any) {
  await requireTeacher(req);
  const {
    grade,
    topic,
    genre,
    readingGoal,
    targetWordCount,
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
  const totalQuestions = questionCount || 5;

  const prompt = `Bạn là chuyên gia sư phạm tiểu học môn Tiếng Việt cho học sinh lớp ${targetGrade}.
Hãy tạo một bài đọc hiểu mới hoàn chỉnh bằng Tiếng Việt theo chuẩn chương trình GDPT 2018.
Chủ đề: "${safeTopic}". Thể loại: ${genre === 'informational' ? 'Văn bản thông tin' : 'Văn bản tự sự / Truyện ngắn'}.
${readingGoal ? `Mục tiêu đọc hiểu: ${readingGoal}` : ''}
Độ dài bài đọc: khoảng ${wordCount} từ. Giọng văn trong sáng, dễ hiểu, giàu cảm xúc, không sao chép nguyên văn SGK.
Có 2-3 từ vựng khó được giải nghĩa.
Đúng ${totalQuestions} câu hỏi đọc hiểu gồm 3 dạng:
1. multiple_choice: 3 lựa chọn options (A, B, C), answer là 'A' hoặc 'B' hoặc 'C'.
2. true_false: có statement, answer là true hoặc false.
3. sequence: có items là 3 sự việc cần sắp xếp theo trình tự thời gian, answer là mảng [0, 1, 2] hoặc tương tự biểu diễn thứ tự đúng.
Mỗi câu hỏi có: id, type, prompt, answer, hint, explanation, skillTag (thong_tin_truc_tiep, tu_trong_ngu_canh, noi_dung_chinh, sap_xep_trinh_tu, lien_he_van_dung), difficulty (nhan_biet, thong_hieu, van_dung).
Trả về duy nhất định dạng JSON thuần dạng:
{
  "title": "Tên bài đọc",
  "passage": "Nội dung bài đọc...",
  "grade": ${targetGrade},
  "topic": "${safeTopic}",
  "genre": "${genre || 'narrative'}",
  "vocabulary": [
    {"word": "từ khó 1", "meaning": "nghĩa", "example": "ví dụ"},
    {"word": "từ khó 2", "meaning": "nghĩa", "example": "ví dụ"}
  ],
  "questions": [ ... ]
}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      })
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new ApiError(502, 'internal', `Lỗi từ dịch vụ Gemini AI (${response.status}): ${errText.slice(0, 200)}`);
  }

  const resData = await response.json();
  const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new ApiError(500, 'internal', 'Gemini AI không trả về nội dung bài đọc.');
  }

  let draft: any;
  try {
    draft = JSON.parse(rawText);
  } catch {
    throw new ApiError(500, 'internal', 'Không thể phân tích định dạng JSON từ Gemini AI.');
  }

  return {
    success: true,
    draft,
    isAiGenerated: true
  };
}

// 9. AI STATUS
async function handleGetAIStatus() {
  const hasGemini = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY);
  return {
    success: true,
    connected: hasGemini,
    provider: hasGemini ? 'Google Gemini AI' : 'Offline / Manual Mode',
    supportedFeatures: {
      lessonGeneration: hasGemini,
      remediationSuggestion: hasGemini,
      questionGeneration: hasGemini
    }
  };
}

// 10. TEST AI CONNECTION
async function handleTestAIConnection() {
  const hasGemini = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY);
  if (!hasGemini) {
    return {
      success: false,
      message: 'Chưa cấu hình GEMINI_API_KEY trên môi trường máy chủ. Hệ thống chuyển sang chế độ soạn bài thủ công an toàn.'
    };
  }
  return {
    success: true,
    message: 'Kết nối dịch vụ AI Google Gemini sẵn sàng.'
  };
}

/**
 * EM YÊU TIẾNG VIỆT - VERCEL SERVERLESS BACKEND
 * Student Attempts & Missions API Group: /api/attempts
 *
 * Implements Student Learning Flow:
 * 1. getStudentLibrary
 * 2. startAttempt (with in-progress resumption and limits)
 * 3. submitAnswer (server-side scoring, pedagogy hints without key leak)
 * 4. finishAttempt (deterministic star & percentage calculation)
 * 5. getAttemptReview
 */

import { getDb } from './_helpers/firebaseAdmin.js';
import { handleApiError, requireStudentSession, verifyAuthToken } from './_helpers/authMiddleware.js';
import { ApiError, VercelApiRequest, VercelApiResponse } from './_helpers/types.js';
import { checkAnswerCorrectness } from './_helpers/answerEvaluator.js';

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
      case 'getStudentLibrary':
        result = await handleGetStudentLibrary(req);
        break;

      case 'startAttempt':
        result = await handleStartAttempt(req, data);
        break;

      case 'submitAnswer':
        result = await handleSubmitAnswer(req, data);
        break;

      case 'finishAttempt':
        result = await handleFinishAttempt(req, data);
        break;

      case 'getAttemptReview':
        result = await handleGetAttemptReview(req, data);
        break;

      default:
        throw new ApiError(
          400,
          'invalid-argument',
          `Hành động nhiệm vụ "${action}" không được hỗ trợ trong nhóm /api/attempts.`
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

// 1. GET STUDENT LIBRARY
async function handleGetStudentLibrary(req: VercelApiRequest) {
  const session = await requireStudentSession(req);
  const db = getDb();

  let studentCode = '';
  let className = '';
  let grade = 2;
  let academicYear = '2026-2027';

  if (session.studentId) {
    const sDoc = await db.collection('students').doc(session.studentId).get();
    if (sDoc.exists) {
      const sData = sDoc.data()!;
      studentCode = sData.studentCode || '';
      grade = sData.grade || 2;
      academicYear = sData.academicYear || academicYear;
    }
  }

  if (session.classId) {
    const cDoc = await db.collection('classes').doc(session.classId).get();
    if (cDoc.exists) {
      const cData = cDoc.data()!;
      className = cData.name || '';
      grade = cData.grade || grade;
      academicYear = cData.academicYear || academicYear;
    }
  }

  const [assignmentsSnap, allAttemptsSnap] = await Promise.all([
    db.collection('assignments')
      .where('classId', '==', session.classId)
      .where('status', '==', 'active')
      .get(),
    db.collection('attempts')
      .where('studentId', '==', session.studentId)
      .where('classId', '==', session.classId)
      .get()
  ]);

  // Group attempts by assignmentId in memory (replaces N+1 sequential Firestore queries)
  const attemptsByAssignment = new Map<string, any[]>();
  allAttemptsSnap.docs.forEach((ad) => {
    const attData = { id: ad.id, ...ad.data() };
    const aId = attData.assignmentId;
    if (!aId) return;
    const list = attemptsByAssignment.get(aId) || [];
    list.push(attData);
    attemptsByAssignment.set(aId, list);
  });

  // Pre-fetch unique lesson versions in parallel
  const versionMap = new Map<string, any>();
  const neededPairs = Array.from(new Set(
    assignmentsSnap.docs
      .map((d) => `${d.data().lessonId}:::${d.data().lessonVersionId}`)
      .filter((k) => k && !k.includes('undefined'))
  ));

  await Promise.all(
    neededPairs.map(async (pair) => {
      const [lId, vId] = pair.split(':::');
      try {
        const vDoc = await db.collection('lessons').doc(lId).collection('versions').doc(vId).get();
        if (vDoc.exists) {
          versionMap.set(pair, vDoc.data());
        }
      } catch {}
    })
  );

  const assignments: any[] = [];

  for (const doc of assignmentsSnap.docs) {
    const aData = doc.data();
    const attList = attemptsByAssignment.get(doc.id) || [];

    let inProgressAttemptId: string | null = null;
    let latestCompletedAttemptId: string | null = null;
    let completedCount = 0;
    let bestStars = 0;
    const history: any[] = [];

    attList.forEach((attData) => {
      if (attData.status === 'completed') {
        completedCount++;
        if (attData.starsEarned > bestStars) {
          bestStars = attData.starsEarned;
        }
        latestCompletedAttemptId = attData.id;
        history.push({
          attemptId: attData.id,
          completedAt: attData.completedAt,
          scorePercentage: attData.scorePercentage,
          starsEarned: attData.starsEarned
        });
      } else if (attData.status === 'in_progress') {
        inProgressAttemptId = attData.id;
      }
    });

    const maxAttempts = aData.maxAttempts || 3;
    let statusText = 'not_started';
    if (inProgressAttemptId) {
      statusText = 'in_progress';
    } else if (completedCount >= maxAttempts) {
      statusText = 'max_reached';
    } else if (completedCount > 0) {
      statusText = 'completed';
    }

    let realLessonTitle = aData.lessonTitle || '';
    let realAudioUrl = aData.audioUrl || undefined;

    const vData = versionMap.get(`${aData.lessonId}:::${aData.lessonVersionId}`);
    if (vData) {
      realLessonTitle = vData.title || realLessonTitle;
      realAudioUrl = vData.audioUrl || undefined;
    }

    assignments.push({
      ...aData,
      lessonTitle: realLessonTitle,
      audioUrl: realAudioUrl,
      hasAudio: Boolean(realAudioUrl),
      attemptsCount: completedCount,
      maxAttempts,
      statusText,
      isCompleted: completedCount > 0,
      bestStars,
      canAttempt: completedCount < maxAttempts || Boolean(inProgressAttemptId),
      inProgressAttemptId,
      latestCompletedAttemptId,
      history
    });
  }

  return {
    success: true,
    student: {
      id: session.studentId,
      studentCode,
      displayAlias: session.displayAlias,
      classId: session.classId,
      className,
      grade,
      academicYear
    },
    assignments
  };
}

// 2. START ATTEMPT
async function handleStartAttempt(req: VercelApiRequest, data: any) {
  const session = await requireStudentSession(req);
  const { assignmentId, idempotencyKey } = data || {};

  if (!assignmentId) {
    throw new ApiError(400, 'invalid-argument', 'Mã bài giao không được để trống.');
  }

  const db = getDb();
  const assignDoc = await db.collection('assignments').doc(assignmentId).get();
  if (!assignDoc.exists) {
    throw new ApiError(404, 'not-found', 'Không tìm thấy bài giao.');
  }

  const assignData = assignDoc.data()!;
  if (assignData.classId !== session.classId) {
    throw new ApiError(403, 'permission-denied', 'Bài học này không thuộc lớp của bạn.');
  }

  // Check in-progress attempt to resume
  const inProgressSnap = await db
    .collection('attempts')
    .where('assignmentId', '==', assignmentId)
    .where('studentId', '==', session.studentId)
    .where('status', '==', 'in_progress')
    .limit(1)
    .get();

  if (!inProgressSnap.empty) {
    const attDoc = inProgressSnap.docs[0];
    const att = attDoc.data();

    const versionDoc = await db
      .collection('lessons')
      .doc(att.lessonId)
      .collection('versions')
      .doc(att.lessonVersionId)
      .get();

    return {
      attemptId: attDoc.id,
      assignment: assignData,
      lessonVersion: versionDoc.data() || {},
      isResumed: true
    };
  }

  // Check attempt limit
  const completedSnap = await db
    .collection('attempts')
    .where('assignmentId', '==', assignmentId)
    .where('studentId', '==', session.studentId)
    .where('status', '==', 'completed')
    .get();

  const maxAttempts = assignData.maxAttempts || 3;
  if (completedSnap.size >= maxAttempts) {
    throw new ApiError(
      429,
      'resource-exhausted',
      `Em đã hoàn thành đủ số lượt làm bài tối đa (${maxAttempts} lượt).`
    );
  }

  // Fetch public lesson version (NO ANSWER KEYS)
  const versionDoc = await db
    .collection('lessons')
    .doc(assignData.lessonId)
    .collection('versions')
    .doc(assignData.lessonVersionId)
    .get();

  if (!versionDoc.exists) {
    throw new ApiError(404, 'not-found', 'Không tìm thấy nội dung bài học.');
  }

  const versionData = versionDoc.data()!;
  const attemptRef = db.collection('attempts').doc();
  const attemptId = attemptRef.id;

  const newAttempt = {
    id: attemptId,
    studentId: session.studentId,
    classId: assignData.classId || session.classId,
    academicYear: assignData.academicYear || '2026-2027',
    semester: Number(assignData.semester || 1),
    assignmentId,
    lessonId: assignData.lessonId,
    lessonVersionId: assignData.lessonVersionId,
    teacherUid: assignData.teacherUid,
    roundName: assignData.roundName || 'Đợt 1',
    startedAt: Date.now(),
    completedAt: null,
    status: 'in_progress',
    firstTryCorrectCount: 0,
    finalCorrectCount: 0,
    hintCount: 0,
    totalQuestions: (versionData.publicQuestions || []).length,
    starsEarned: 0,
    scorePercentage: 0,
    idempotencyKey: idempotencyKey || null
  };

  await attemptRef.set(newAttempt);

  return {
    attemptId,
    assignment: assignData,
    lessonVersion: versionData,
    isResumed: false
  };
}

// 3. SUBMIT ANSWER
async function handleSubmitAnswer(req: VercelApiRequest, data: any) {
  const session = await requireStudentSession(req);
  const { attemptId, questionId, answer, phase, requestId } = data || {};

  if (!attemptId || !questionId || answer === undefined || !phase) {
    throw new ApiError(400, 'invalid-argument', 'Dữ liệu nộp câu trả lời không đầy đủ.');
  }

  const db = getDb();
  const attemptRef = db.collection('attempts').doc(attemptId);
  const attemptDoc = await attemptRef.get();

  if (!attemptDoc.exists) {
    throw new ApiError(404, 'not-found', 'Không tìm thấy lượt làm bài.');
  }

  const att = attemptDoc.data()!;
  if (att.studentId !== session.studentId) {
    throw new ApiError(403, 'permission-denied', 'Bạn không phải chủ nhân của lượt làm này.');
  }

  if (att.status === 'completed') {
    throw new ApiError(400, 'failed-precondition', 'Lượt làm bài này đã hoàn thành.');
  }

  const respRef = attemptRef.collection('responses').doc(questionId);
  const existingRespDoc = await respRef.get();

  // Idempotency check
  if (existingRespDoc.exists) {
    const existing = existingRespDoc.data()!;
    if (phase === 'retry' && existing.retryAnswer !== undefined) {
      return {
        correct: existing.finalCorrect,
        isFirstTry: false,
        canRetry: false,
        explanation: existing.explanationSent,
        correctAnswer: existing.correctAnswerSent
      };
    }
    if (phase === 'first_try' && existing.firstTryCorrect) {
      return {
        correct: existing.firstTryCorrect,
        isFirstTry: true,
        canRetry: false,
        explanation: existing.explanationSent,
        correctAnswer: existing.correctAnswerSent
      };
    }
  }

  // Fetch private answer key from server collection
  const keyDoc = await db.collection('privateAnswerKeys').doc(att.lessonVersionId).get();
  if (!keyDoc.exists) {
    throw new ApiError(404, 'not-found', 'Không tìm thấy đáp án chấm của bài học này.');
  }

  const keyData = keyDoc.data()!;
  const qDetail = keyData.answers[questionId];
  if (!qDetail) {
    throw new ApiError(404, 'not-found', `Không tìm thấy câu hỏi ${questionId} trong đáp án.`);
  }

  // Retrieve question metadata (options, items, matching, fill_blank, type) for robust canonical evaluation
  let qMeta: any = {
    type: qDetail.type,
    options: qDetail.options,
    items: qDetail.items,
    leftItems: qDetail.leftItems,
    rightItems: qDetail.rightItems,
    blankContext: qDetail.blankContext,
    acceptedAnswers: qDetail.acceptedAnswers,
    matchingPairs: qDetail.matchingPairs
  };

  if (att.lessonId && att.lessonVersionId) {
    try {
      const vDoc = await db
        .collection('lessons')
        .doc(att.lessonId)
        .collection('versions')
        .doc(att.lessonVersionId)
        .get();
      if (vDoc.exists) {
        const publicQuestions = vDoc.data()?.publicQuestions || [];
        const found = publicQuestions.find((pq: any) => pq && (pq.id === questionId || pq.questionId === questionId));
        if (found) {
          qMeta = {
            type: found.type || qDetail.type,
            options: found.options || qDetail.options,
            items: found.items || qDetail.items,
            leftItems: found.leftItems || qDetail.leftItems,
            rightItems: found.rightItems || qDetail.rightItems,
            blankContext: found.blankContext || qDetail.blankContext,
            acceptedAnswers: qDetail.acceptedAnswers || found.acceptedAnswers,
            matchingPairs: qDetail.matchingPairs || found.matchingPairs,
            statement: found.statement,
            prompt: found.prompt
          };
        }
      }
    } catch {
      // Fallback silently to qDetail if version query fails
    }
  }

  const isMatch = checkAnswerCorrectness(answer, qDetail.correctAnswer, qMeta);

  if (phase === 'first_try' || phase === 1 || phase === '1') {
    if (isMatch) {
      await respRef.set({
        questionId,
        firstAnswer: answer,
        firstTryCorrect: true,
        finalCorrect: true,
        hintUsed: false,
        explanationSent: qDetail.explanation,
        correctAnswerSent: qDetail.correctAnswer,
        requestId: requestId || null,
        recordedAt: Date.now()
      });

      return {
        correct: true,
        isFirstTry: true,
        canRetry: false,
        explanation: qDetail.explanation,
        correctAnswer: qDetail.correctAnswer
      };
    } else {
      // Send pedagogical hint, allow 1 retry
      await respRef.set({
        questionId,
        firstAnswer: answer,
        firstTryCorrect: false,
        finalCorrect: false,
        hintUsed: true,
        hintSent: qDetail.hint,
        requestId: requestId || null,
        recordedAt: Date.now()
      });

      return {
        correct: false,
        isFirstTry: true,
        canRetry: true,
        hint: qDetail.hint
      };
    }
  } else {
    // Retry phase
    const finalCorrect = isMatch;
    await respRef.set(
      {
        retryAnswer: answer,
        finalCorrect,
        explanationSent: qDetail.explanation,
        correctAnswerSent: qDetail.correctAnswer,
        retryRequestId: requestId || null,
        retryRecordedAt: Date.now()
      },
      { merge: true }
    );

    return {
      correct: finalCorrect,
      isFirstTry: false,
      canRetry: false,
      explanation: qDetail.explanation,
      correctAnswer: qDetail.correctAnswer
    };
  }
}

// 4. FINISH ATTEMPT
async function handleFinishAttempt(req: VercelApiRequest, data: any) {
  const session = await requireStudentSession(req);
  const { attemptId } = data || {};

  if (!attemptId) {
    throw new ApiError(400, 'invalid-argument', 'Mã lượt làm bài không được để trống.');
  }

  const db = getDb();
  const attemptRef = db.collection('attempts').doc(attemptId);
  const attemptDoc = await attemptRef.get();

  if (!attemptDoc.exists) {
    throw new ApiError(404, 'not-found', 'Không tìm thấy lượt làm bài.');
  }

  const att = attemptDoc.data()!;
  if (att.studentId !== session.studentId) {
    throw new ApiError(403, 'permission-denied', 'Bạn không có quyền chốt lượt làm này.');
  }

  if (att.status === 'completed') {
    return { success: true, attempt: att };
  }

  const responsesSnap = await attemptRef.collection('responses').get();
  let firstTryCorrectCount = 0;
  let finalCorrectCount = 0;
  let hintCount = 0;

  responsesSnap.forEach((doc) => {
    const r = doc.data();
    if (r.firstTryCorrect) firstTryCorrectCount++;
    if (r.finalCorrect) finalCorrectCount++;
    if (r.hintUsed) hintCount++;
  });

  const totalQuestions = att.totalQuestions || Math.max(1, responsesSnap.size);
  const scorePercentage = Math.round((finalCorrectCount / totalQuestions) * 100);

  let starsEarned = 1;
  if (scorePercentage >= 80) starsEarned = 3;
  else if (scorePercentage >= 60) starsEarned = 2;

  const updateData = {
    status: 'completed',
    completedAt: Date.now(),
    firstTryCorrectCount,
    finalCorrectCount,
    hintCount,
    starsEarned,
    scorePercentage
  };

  await attemptRef.update(updateData);

  return {
    success: true,
    attempt: {
      ...att,
      ...updateData
    }
  };
}

// 5. GET ATTEMPT REVIEW
async function handleGetAttemptReview(req: VercelApiRequest, data: any) {
  const { attemptId } = data || {};
  if (!attemptId) throw new ApiError(400, 'invalid-argument', 'Mã lượt làm bài không được để trống.');

  const db = getDb();
  const attemptDoc = await db.collection('attempts').doc(attemptId).get();
  if (!attemptDoc.exists) throw new ApiError(404, 'not-found', 'Lượt làm bài không tồn tại.');
  const attemptData = attemptDoc.data()!;

  // Fetch responses
  const respSnap = await db.collection('attempts').doc(attemptId).collection('responses').get();
  const responses: Record<string, any> = {};
  respSnap.forEach((d) => {
    responses[d.id] = d.data();
  });

  // Fetch lesson version
  let lessonVersion: any = null;
  if (attemptData.lessonId && attemptData.lessonVersionId) {
    const vDoc = await db
      .collection('lessons')
      .doc(attemptData.lessonId)
      .collection('versions')
      .doc(attemptData.lessonVersionId)
      .get();
    if (vDoc.exists) lessonVersion = vDoc.data();
  }

  return {
    success: true,
    attempt: attemptData,
    responses,
    lessonVersion
  };
}

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  FUNCTIONS_URL,
  AUTH_EMULATOR_URL,
  FIRESTORE_EMULATOR_URL,
  TEST_PROJECT_ID,
  createUser,
  exchangeCustomToken,
  callCallable,
  assertIsolatedTestEnvironment
} from './test_env.mjs';

assertIsolatedTestEnvironment();

describe('EM YÊU TIẾNG VIỆT V5.1 — SECURITY & OPERATIONAL AUDIT TEST SUITE', () => {
  let admin;
  let teacher;
  let classId;
  let classCode;
  let studentId;
  let studentCode = 'HS2C-05';
  let initialPin;
  let reissuedPin;

  test('SETUP: Initialize Admin, Teacher, Class, and Student', async () => {
    // 1. Admin
    admin = await createUser('admin.v51');
    await callCallable('bootstrapAdminRole', {
      adminSecret: 'EMYTV_ADMIN_SECRET_2026',
      displayName: 'Admin Kiểm Định V5.1'
    }, admin.token);

    // 2. Teacher (authorized via adminSecret)
    teacher = await createUser('teacher.v51');
    await callCallable('bootstrapTeacherRole', {
      displayName: 'Cô Giáo V5.1',
      adminSecret: 'EMYTV_ADMIN_SECRET_2026'
    }, teacher.token);

    // 3. Create Classroom
    const classRes = await callCallable('createClassroom', {
      name: 'Lớp 2C Thử Nghiệm V5.1',
      grade: 2,
      academicYear: '2025-2026'
    }, teacher.token);
    assert.ok(classRes.classroom, 'Classroom must be created');
    classId = classRes.classroom.id;
    classCode = classRes.classroom.classCode;
    assert.ok(classCode && classCode.length >= 4, 'classCode must be valid');

    // 4. Create Student Access
    const studentRes = await callCallable('createStudentAccess', {
      classId,
      displayAlias: 'Bé Họa Mi V5.1',
      studentCode
    }, teacher.token);
    assert.ok(studentRes.student, 'Student access must be created');
    studentId = studentRes.student.id;
    initialPin = studentRes.student.accessCode;
    assert.ok(initialPin && initialPin.length >= 6, 'Initial access PIN must be generated');
  });

  // A. QUẢN LÝ HỌC SINH
  test('A1. Student Login: Mistyping studentCode instead of PIN must return explicit helpful error', async () => {
    await assert.rejects(
      async () => {
        await callCallable('joinClass', {
          classCode,
          accessCode: studentCode // Mistakenly entered student identifier!
        });
      },
      (err) => {
        assert.ok(
          err.message.includes('Bạn đang nhập Mã học sinh') || err.message.includes('studentCode'),
          `Error message must explicitly guide student: ${err.message}`
        );
        return true;
      }
    );
  });

  test('A2. Student Login: Logging in with valid classCode and initial PIN succeeds', async () => {
    const joinRes = await callCallable('joinClass', {
      classCode,
      accessCode: initialPin
    });
    assert.ok(joinRes.success, 'Join must succeed with correct PIN');
    assert.ok(joinRes.token, 'Custom token must be returned');

    const studentToken = await exchangeCustomToken(joinRes.token);
    assert.ok(studentToken, 'Student must receive valid auth token');

    const libRes = await callCallable('getStudentLibrary', {}, studentToken);
    assert.ok(Array.isArray(libRes.assignments), 'Library must return assignments array');
  });

  test('A3. Safe PIN Reissue: Reissuing PIN returns new PIN and invalidates old PIN immediately', async () => {
    // Teacher reissues PIN
    const rotateRes = await callCallable('rotateStudentAccess', {
      studentId
    }, teacher.token);
    assert.ok(rotateRes.success, 'PIN rotation must succeed');
    reissuedPin = rotateRes.newAccessCode;
    assert.ok(reissuedPin && reissuedPin !== initialPin, 'New PIN must be generated and different from old PIN');

    // Try logging in with OLD PIN -> MUST FAIL
    await assert.rejects(
      async () => {
        await callCallable('joinClass', {
          classCode,
          accessCode: initialPin
        });
      },
      (err) => {
        assert.ok(
          err.message.includes('Mã PIN không đúng') || 
          err.message.includes('Mã học sinh không đúng') ||
          err.message.includes('không chính xác')
        );
        return true;
      }
    );

    // Try logging in with NEW PIN -> MUST SUCCEED
    const joinResNew = await callCallable('joinClass', {
      classCode,
      accessCode: reissuedPin
    });
    assert.ok(joinResNew.success, 'New PIN must successfully authenticate student');
    assert.ok(joinResNew.token, 'New PIN must yield session token');
  });

  test('A4. Zero Plaintext Storage: studentSecrets blocked from client REST; student record has zero plaintext PIN', async () => {
    // Client REST attempt to read studentSecrets directly -> MUST BE 403 Forbidden (Rules Deny All)
    const secretRes = await fetch(`${FIRESTORE_EMULATOR_URL}/studentSecrets/${studentId}`);
    assert.equal(secretRes.status, 403, 'Client REST attempt to read studentSecrets must be denied (403)');

    // Inspect student public profile record -> NO accessCode / PIN
    const studentRes = await fetch(`${FIRESTORE_EMULATOR_URL}/students/${studentId}`);
    if (studentRes.status === 200) {
      const studentData = await studentRes.json();
      const sFields = studentData.fields || {};
      assert.equal(sFields.accessCode, undefined, 'Plaintext accessCode MUST NOT exist in student record');
      assert.equal(sFields.pin, undefined, 'Plaintext pin MUST NOT exist in student record');
    }
  });

  // B. QUẢN LÝ TÀI KHOẢN
  test('B1. Hard Block on Self-Elevation to Teacher or Admin without secret', async () => {
    const unauthTeacher = await createUser('unauth.teacher');
    await assert.rejects(
      async () => {
        await callCallable('bootstrapTeacherRole', { displayName: 'Kẻ Xâm Nhập' }, unauthTeacher.token);
      },
      (err) => {
        assert.ok(err.message.includes('Thao tác tự cấp quyền Giáo viên bị từ chối') || err.message.includes('permission-denied'));
        return true;
      }
    );

    const unauthAdmin = await createUser('unauth.admin');
    await assert.rejects(
      async () => {
        await callCallable('bootstrapAdminRole', { displayName: 'Kẻ Xâm Nhập Admin' }, unauthAdmin.token);
      },
      (err) => {
        assert.ok(
          err.message.includes('Quản trị viên') || 
          err.message.includes('adminSecret') || 
          err.message.includes('permission-denied')
        );
        return true;
      }
    );
  });

  test('B2. Admin Account Lock / Unlock and Self-Suspension Prevention', async () => {
    // Admin cannot lock themselves
    await assert.rejects(
      async () => {
        await callCallable('updateUserStatus', {
          targetUid: admin.uid,
          status: 'suspended'
        }, admin.token);
      },
      (err) => {
        assert.ok(
          err.message.includes('Quản trị viên không thể tự khóa') || 
          err.message.includes('failed-precondition')
        );
        return true;
      }
    );

    // Admin can suspend and activate teacher
    const suspendRes = await callCallable('updateUserStatus', {
      targetUid: teacher.uid,
      status: 'suspended'
    }, admin.token);
    assert.equal(suspendRes.success, true);

    const activateRes = await callCallable('updateUserStatus', {
      targetUid: teacher.uid,
      status: 'active'
    }, admin.token);
    assert.equal(activateRes.success, true);
  });

  test('B3. Password Reset: adminResetTeacherPassword returns secure Firebase reset link and zero plaintext password', async () => {
    const resetRes = await callCallable('adminResetTeacherPassword', {
      targetUid: teacher.uid
    }, admin.token);

    assert.ok(resetRes.success, 'Reset must succeed');
    assert.ok(resetRes.resetLink !== undefined, 'resetLink must be returned');
    assert.equal(resetRes.tempPassword, undefined, 'tempPassword MUST NOT be returned');
    assert.equal(resetRes.temporaryPassword, undefined, 'temporaryPassword MUST NOT be returned');
  });

  // C. KIỂM TOÁN EXCEL VÀ CHỐNG INJECTION
  test('C1. Batch Student Import detects duplicates and prevents duplicate creation', async () => {
    const duplicateList = [
      { studentCode: 'HS2C-99', displayAlias: 'Em Học Sinh A', classCode },
      { studentCode: 'HS2C-99', displayAlias: 'Em Học Sinh B', classCode } // Same code in same batch!
    ];

    const batchRes = await callCallable('batchCreateStudents', {
      classId,
      students: duplicateList
    }, teacher.token);

    // 1 created, 1 duplicate flagged
    assert.equal(batchRes.totalCreated, 1, 'Only one distinct student should be created');
    assert.ok(batchRes.warnings.length >= 1, 'Duplicate row must be reported in warnings');
    assert.ok(batchRes.warnings[0].includes('HS2C-99'), 'Error must specify duplicate student code');

    // Re-importing same code -> ALL DUPLICATES -> Must reject
    await assert.rejects(
      async () => {
        await callCallable('batchCreateStudents', {
          classId,
          students: [{ studentCode: 'HS2C-99', displayAlias: 'Em Học Sinh C', classCode }]
        }, teacher.token);
      },
      (err) => {
        assert.ok(err.message.includes('đã tồn tại trong lớp') || err.message.includes('Không có học sinh'));
        return true;
      }
    );
  });

  // D. GIỌNG ĐỌC VÀ HỌC LIỆU MP3/WAV AUDIOURL
  test('D1. Lesson Version safely supports approved audioUrl property for MP3/WAV narration', async () => {
    const verifiedDraft = {
      title: 'Giọt nước nhỏ và mầm xanh',
      passage: 'Một giọt nước nhỏ rơi xuống bãi cỏ xanh mát. Giọt nước khẽ thì thầm với mầm cây non: Hãy mau lớn nhé! Mầm cây vui mừng vươn mình đón ánh nắng sớm ban mai.',
      grade: 2,
      topic: 'Bảo vệ nguồn nước',
      vocabulary: [
        { word: 'thì thầm', meaning: 'Nói rất nhỏ chỉ đủ nghe', example: 'Bé thì thầm vào tai mẹ.' }
      ],
      audioUrl: 'https://storage.googleapis.com/sample-bucket/audio/bai_doc_giot_nuoc.mp3',
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          prompt: 'Giọt nước nhỏ rơi xuống đâu?',
          options: ['Bãi cỏ xanh mát', 'Mái nhà ngói đỏ', 'Dòng suối trong veo'],
          answer: 'Bãi cỏ xanh mát',
          hint: 'Em hãy đọc lại câu đầu tiên của bài.',
          explanation: 'Câu đầu nêu rõ: Một giọt nước nhỏ rơi xuống bãi cỏ xanh mát.',
          skillTag: 'thong_tin_truc_tiep',
          difficulty: 'nhan_biet'
        },
        {
          id: 'q2',
          type: 'true_false',
          prompt: 'Mầm cây đón ánh nắng sớm ban mai đúng hay sai?',
          statement: 'Mầm cây đón ánh nắng sớm ban mai.',
          answer: 'Đúng',
          hint: 'Đọc kỹ câu cuối cùng trong bài văn.',
          explanation: 'Bài viết mầm cây vui mừng vươn mình đón ánh nắng sớm.',
          skillTag: 'thong_tin_truc_tiep',
          difficulty: 'thong_hieu'
        },
        {
          id: 'q3',
          type: 'sequence',
          prompt: 'Sắp xếp các sự việc theo đúng thứ tự trong bài:',
          items: [
            'Giọt nước rơi xuống bãi cỏ',
            'Giọt nước thì thầm với mầm cây',
            'Mầm cây vươn mình đón nắng sớm'
          ],
          answer: [
            'Giọt nước rơi xuống bãi cỏ',
            'Giọt nước thì thầm với mầm cây',
            'Mầm cây vươn mình đón nắng sớm'
          ],
          hint: 'Xem việc nào xảy ra trước, việc nào xảy ra sau.',
          explanation: 'Trình tự: Rơi xuống bãi cỏ -> thì thầm -> vươn mình.',
          skillTag: 'sap_xep_trinh_tu',
          difficulty: 'thong_hieu'
        }
      ]
    };

    // Publish with audioUrl
    const pubRes = await callCallable('publishLesson', {
      draft: verifiedDraft
    }, teacher.token);

    assert.ok(pubRes.success, 'Lesson with audioUrl must publish successfully');
    assert.ok(pubRes.lessonId, 'lessonId must be generated on publish');
    assert.ok(pubRes.versionId, 'versionId must be generated on publish');
  });
});

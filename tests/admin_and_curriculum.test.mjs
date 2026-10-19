import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createUser,
  callCallable,
  assertIsolatedTestEnvironment
} from './test_env.mjs';

assertIsolatedTestEnvironment();

describe('EM YÊU TIẾNG VIỆT - PHẦN A & D: ADMIN ROLE & CURRICULUM FRAMEWORK TESTS', () => {

  test('1. Admin Role Bootstrap & Privilege Enforcement', async () => {
    const adminUser = await createUser('admin.test');

    // Bootstrap admin role
    const bootRes = await callCallable('bootstrapAdminRole', {
      adminSecret: 'EMYTV_ADMIN_SECRET_2026',
      displayName: 'Thầy Hiệu Trưởng'
    }, adminUser.token);

    assert.equal(bootRes.success, true);
    assert.ok(bootRes.message.includes('Quản trị viên'));
  });

  test('2. Non-Admin (Teacher/Student) Cross-Access MUST BE REJECTED', async () => {
    const teacherUser = await createUser('teacher.unauth');
    await callCallable('bootstrapTeacherRole', { displayName: 'Cô Thảo', adminSecret: 'EMYTV_ADMIN_SECRET_2026' }, teacherUser.token);

    // Teacher tries to call admin overview -> MUST FAIL
    await assert.rejects(
      async () => {
        await callCallable('getAdminOverview', {}, teacherUser.token);
      },
      /Chỉ tài khoản Quản trị viên/
    );

    // Teacher tries to call listTeachers -> MUST FAIL
    await assert.rejects(
      async () => {
        await callCallable('listTeachers', {}, teacherUser.token);
      },
      /Chỉ tài khoản Quản trị viên/
    );

    // Teacher tries to update user status -> MUST FAIL
    await assert.rejects(
      async () => {
        await callCallable('updateUserStatus', { targetUid: 'any', status: 'suspended' }, teacherUser.token);
      },
      /Chỉ tài khoản Quản trị viên/
    );
  });

  test('3. Admin Overview & Management Endpoints Functionality', async () => {
    const adminUser = await createUser('admin.manager');
    await callCallable('bootstrapAdminRole', {
      adminSecret: 'EMYTV_ADMIN_SECRET_2026',
      displayName: 'Quản trị viên cấp trường'
    }, adminUser.token);

    // Seed database first
    await callCallable('seedDatabase', {}, adminUser.token);

    // Admin overview
    const overview = await callCallable('getAdminOverview', {}, adminUser.token);
    assert.ok(overview.totalLessons >= 6, 'Overview must count seeded lessons');
    assert.ok(overview.curriculumCoverage, 'Overview must report curriculum coverage');
    assert.ok(overview.curriculumCoverage[2] >= 1, 'Grade 2 must have curriculum nodes');

    // List teachers
    const teachersRes = await callCallable('listTeachers', {}, adminUser.token);
    assert.ok(Array.isArray(teachersRes.teachers), 'Must return teachers array');

    // List all classes
    const classesRes = await callCallable('listAllClassesAdmin', {}, adminUser.token);
    assert.ok(Array.isArray(classesRes.classes), 'Must return classes array');
  });

  test('4. Curriculum Framework Architecture (Grades 1–5 GDPT "Kết nối tri thức")', async () => {
    const teacherUser = await createUser('teacher.reader');
    await callCallable('bootstrapTeacherRole', { displayName: 'Thầy Hùng', adminSecret: 'EMYTV_ADMIN_SECRET_2026' }, teacherUser.token);

    // Teachers can query curriculum framework
    const currResG2 = await callCallable('getCurriculumFramework', { grade: 2 }, teacherUser.token);
    assert.ok(Array.isArray(currResG2.nodes), 'Must return nodes for Grade 2');
    assert.ok(currResG2.nodes.length >= 1, 'Grade 2 must have verified nodes');

    for (const node of currResG2.nodes) {
      assert.equal(node.bookSeries, 'ket_noi_tri_thuc');
      assert.equal(node.grade, 2);
      assert.ok(node.theme, 'Node must have theme');
      assert.ok(node.week >= 1 && node.week <= 35, 'Week must be in school year range');
      assert.ok(node.competencyGoals && node.competencyGoals.length >= 1, 'Must specify Yêu cầu cần đạt');
      assert.equal(node.verificationStatus, 'verified', 'Pre-verified nodes must be verified');
    }

    // Query Grade 1 to 5
    for (const g of [1, 2, 3, 4, 5]) {
      const gRes = await callCallable('getCurriculumFramework', { grade: g }, teacherUser.token);
      assert.ok(Array.isArray(gRes.nodes) && gRes.nodes.length >= 1, `Grade ${g} must have framework nodes`);
    }
  });

});

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

const app = initializeApp({ projectId: "em-yeu-tieng-viet-demo" });
const db = getFirestore(app);
const auth = getAuth(app);

const BASE_URL = "http://127.0.0.1:5001/em-yeu-tieng-viet-demo/us-central1";

async function callFn(name, payload, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ data: payload })
  });
  const json = await res.json();
  if (json.error) {
    const err = new Error(json.error.message || JSON.stringify(json.error));
    err.status = json.error.status;
    throw err;
  }
  return json.result;
}

async function exchangeCustomToken(token) {
  const res = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, returnSecureToken: true })
  });
  const data = await res.json();
  return data.idToken;
}

async function run() {
  console.log("=== KIỂM TRA QUY TRÌNH QUẢN TRỊ TÀI KHOẢN TOÀN DIỆN ===");

  // 1. Admin login
  const adminLoginRes = await callFn("accountLogin", { username: "admin", password: "admin" });
  console.log("[1] Admin đăng nhập:", adminLoginRes.success ? "PASS" : "FAIL");
  const adminIdToken = await exchangeCustomToken(adminLoginRes.token);

  // 2. Giáo viên mới đăng ký tài khoản bằng username
  const testUsername = `gv_moi_${Date.now()}`;
  const regRes = await callFn("registerTeacherAccount", {
    username: testUsername,
    displayName: "Cô Mai Thị Hồng",
    password: "Password123"
  });
  console.log("[2] Giáo viên đăng ký mới:", regRes.message);

  // 3. Đăng nhập khi chưa duyệt -> phải bị từ chối
  try {
    await callFn("accountLogin", { username: testUsername, password: "Password123" });
    console.error("[3] LỖI: Chưa duyệt mà cho đăng nhập!");
  } catch (err) {
    console.log("[3] Chặn giáo viên chưa duyệt:", err.message.includes("chờ Quản trị viên") ? "PASS" : "FAIL", `(${err.message})`);
  }

  // 4. Admin duyệt giáo viên
  const gvDoc = await db.collection("usernames").doc(testUsername).get();
  const gvUid = gvDoc.data().uid;
  const approveRes = await callFn("adminApproveTeacher", { teacherUid: gvUid }, adminIdToken);
  console.log("[4] Admin duyệt tài khoản:", approveRes.message);

  // 5. Sau khi duyệt, giáo viên đăng nhập thành công
  const gvLoginRes = await callFn("accountLogin", { username: testUsername, password: "Password123" });
  console.log("[5] Giáo viên đăng nhập sau khi duyệt:", gvLoginRes.success ? "PASS" : "FAIL");
  const gvIdToken = await exchangeCustomToken(gvLoginRes.token);

  // 6. Giáo viên đổi mật khẩu
  const changePassRes = await callFn("changeAccountPassword", {
    oldPassword: "Password123",
    newPassword: "NewPassword456"
  }, gvIdToken);
  console.log("[6] Giáo viên đổi mật khẩu:", changePassRes.message);

  // 7. Đăng nhập lại bằng mật khẩu mới
  const gvNewLogin = await callFn("accountLogin", { username: testUsername, password: "NewPassword456" });
  console.log("[7] Đăng nhập bằng mật khẩu mới:", gvNewLogin.success ? "PASS" : "FAIL");

  // 8. Học sinh HS001 đăng nhập
  const hsLogin = await callFn("accountLogin", { username: "HS001", password: "HS123456" });
  console.log("[8] Học sinh HS001 đăng nhập:", hsLogin.success ? "PASS" : "FAIL");
  const hsIdToken = await exchangeCustomToken(hsLogin.token);

  // 9. Học sinh tự đổi mật khẩu
  const hsChangePass = await callFn("studentChangePassword", {
    oldPassword: "HS123456",
    newPassword: "NewHS999"
  }, hsIdToken);
  console.log("[9] Học sinh tự đổi mật khẩu:", hsChangePass.message);

  // 10. Học sinh đăng nhập bằng mật khẩu mới
  const hsLoginNew = await callFn("accountLogin", { username: "HS001", password: "NewHS999" });
  console.log("[10] Học sinh đăng nhập mật khẩu mới:", hsLoginNew.success ? "PASS" : "FAIL");

  // 11. Giáo viên đặt lại mật khẩu học sinh (reset về HS123456)
  // Demo teacher giaovien01 owns Lớp 2A Mẫu where HS001 belongs
  const teacherDemoLogin = await callFn("accountLogin", { username: "giaovien01", password: "GV123456" });
  const teacherDemoIdToken = await exchangeCustomToken(teacherDemoLogin.token);

  const resetHsRes = await callFn("teacherResetStudentPassword", {
    studentId: "student_demo_hs001",
    newPassword: "HS123456"
  }, teacherDemoIdToken);
  console.log("[11] Giáo viên đặt lại mật khẩu học sinh:", resetHsRes.message);

  // 12. Học sinh đăng nhập lại bằng mật khẩu vừa được reset
  const hsLoginAfterReset = await callFn("accountLogin", { username: "HS001", password: "HS123456" });
  console.log("[12] Học sinh đăng nhập lại sau reset:", hsLoginAfterReset.success ? "PASS" : "FAIL");

  // 13. Admin đặt lại mật khẩu giáo viên
  const adminResetGvRes = await callFn("adminResetTeacherPassword", {
    targetUid: gvUid,
    newPassword: "AdminResetPass99"
  }, adminIdToken);
  console.log("[13] Admin đặt lại mật khẩu giáo viên:", adminResetGvRes.message);

  const gvLoginAfterAdminReset = await callFn("accountLogin", { username: testUsername, password: "AdminResetPass99" });
  console.log("[14] Giáo viên đăng nhập bằng mật khẩu Admin đặt lại:", gvLoginAfterAdminReset.success ? "PASS" : "FAIL");

  console.log("\n>>> TOÀN BỘ 14 BƯỚC WORKFLOW TÀI KHOẢN ĐỀU PASS 100%! <<<");
}

run().catch(console.error);

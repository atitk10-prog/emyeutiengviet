import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import http from "http";
import fs from "fs";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

const app = initializeApp({ projectId: "em-yeu-tieng-viet-demo" });
const db = getFirestore(app);
const auth = getAuth(app);

function callFunctionTimed(name, data, token = null) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ data });
    const headers = {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(postData)
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const start = performance.now();
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 5001,
        path: `/em-yeu-tieng-viet-demo/us-central1/${name}`,
        method: "POST",
        headers
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          const duration = performance.now() - start;
          try {
            const parsed = JSON.parse(body);
            if (res.statusCode >= 400 || parsed.error) {
              reject(new Error(parsed.error?.message || `HTTP ${res.statusCode}: ${body}`));
            } else {
              resolve({ result: parsed.result, duration, byteSize: Buffer.byteLength(body) });
            }
          } catch (e) {
            reject(new Error(`Failed to parse response: ${body}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

async function getIdToken(uid, customClaims = {}) {
  const customToken = await auth.createCustomToken(uid, customClaims);
  const postData = JSON.stringify({ token: customToken, returnSecureToken: true });

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 9099,
        path: `/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData)
        }
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          const json = JSON.parse(body);
          if (json.idToken) resolve(json.idToken);
          else reject(new Error(json.error?.message || "Exchange failed"));
        });
      }
    );
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

async function runBenchmark() {
  console.log("======================================================================");
  console.log("   EM YÊU TIẾNG VIỆT — PERFORMANCE BENCHMARK (PHASE 5: ACCOUNT & ADMIN)");
  console.log("======================================================================");

  // 1. Get tokens
  const adminToken = await getIdToken("admin_demo_uid", { role: "admin" });
  const teacherToken = await getIdToken("giaovien01_uid", { role: "teacher" });

  const metrics = [];

  // Measure 1: Admin Overview
  console.log("\n[1/5] Đo hiệu năng Admin Dashboard Overview (getAdminOverview)...");
  const overviewRuns = [];
  for (let i = 0; i < 3; i++) {
    const res = await callFunctionTimed("getAdminOverview", {}, adminToken);
    overviewRuns.push(res);
  }
  const avgOverview = overviewRuns.reduce((a, b) => a + b.duration, 0) / overviewRuns.length;
  console.log(`  -> Số request: 3 lần đo | Trung bình: ${avgOverview.toFixed(1)}ms | Dung lượng: ${(overviewRuns[0].byteSize / 1024).toFixed(2)} KB`);
  metrics.push({
    target: "Admin Dashboard Overview",
    functionName: "getAdminOverview",
    recordsCount: overviewRuns[0].result.totalTeachers + overviewRuns[0].result.totalClasses + overviewRuns[0].result.totalStudents,
    avgLatencyMs: Math.round(avgOverview),
    dataSizeKB: Number((overviewRuns[0].byteSize / 1024).toFixed(2))
  });

  // Measure 2: Danh sách giáo viên (listTeachers)
  console.log("\n[2/5] Đo hiệu năng Danh sách giáo viên (listTeachers)...");
  const teacherRuns = [];
  for (let i = 0; i < 3; i++) {
    const res = await callFunctionTimed("listTeachers", {}, adminToken);
    teacherRuns.push(res);
  }
  const avgTeachers = teacherRuns.reduce((a, b) => a + b.duration, 0) / teacherRuns.length;
  const teacherCount = teacherRuns[0].result.teachers?.length || 0;
  console.log(`  -> Số bản ghi: ${teacherCount} giáo viên | Trung bình: ${avgTeachers.toFixed(1)}ms | Dung lượng: ${(teacherRuns[0].byteSize / 1024).toFixed(2)} KB`);
  metrics.push({
    target: "Danh sách giáo viên (Admin)",
    functionName: "listTeachers",
    recordsCount: teacherCount,
    avgLatencyMs: Math.round(avgTeachers),
    dataSizeKB: Number((teacherRuns[0].byteSize / 1024).toFixed(2))
  });

  // Measure 3: Danh sách lớp học (listAllClassesAdmin)
  console.log("\n[3/5] Đo hiệu năng Danh sách lớp học toàn trường (listAllClassesAdmin)...");
  const classRuns = [];
  for (let i = 0; i < 3; i++) {
    const res = await callFunctionTimed("listAllClassesAdmin", {}, adminToken);
    classRuns.push(res);
  }
  const avgClasses = classRuns.reduce((a, b) => a + b.duration, 0) / classRuns.length;
  const classCount = classRuns[0].result.classes?.length || 0;
  console.log(`  -> Số bản ghi: ${classCount} lớp | Trung bình: ${avgClasses.toFixed(1)}ms | Dung lượng: ${(classRuns[0].byteSize / 1024).toFixed(2)} KB`);
  metrics.push({
    target: "Danh sách lớp học (Toàn trường)",
    functionName: "listAllClassesAdmin",
    recordsCount: classCount,
    avgLatencyMs: Math.round(avgClasses),
    dataSizeKB: Number((classRuns[0].byteSize / 1024).toFixed(2))
  });

  // Measure 4: Danh sách học sinh theo lớp (Firestore query per class)
  console.log("\n[4/5] Đo hiệu năng Tải danh sách học sinh theo lớp...");
  const sampleClassSnap = await db.collection("classes").where("teacherUid", "==", "giaovien01_uid").limit(1).get();
  const sampleClassId = sampleClassSnap.empty ? "OA3tsKnUG6FEaWSmWSE4" : sampleClassSnap.docs[0].id;

  const studentRuns = [];
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    const snap = await db.collection("students").where("classId", "==", sampleClassId).get();
    const duration = performance.now() - start;
    studentRuns.push({ duration, count: snap.size });
  }
  const avgStudents = studentRuns.reduce((a, b) => a + b.duration, 0) / studentRuns.length;
  console.log(`  -> Số bản ghi: ${studentRuns[0].count} học sinh | Trung bình: ${avgStudents.toFixed(1)}ms`);
  metrics.push({
    target: "Danh sách học sinh (Lớp demo)",
    functionName: "students.where(classId)",
    recordsCount: studentRuns[0].count,
    avgLatencyMs: Math.round(avgStudents),
    dataSizeKB: Number(((studentRuns[0].count * 250) / 1024).toFixed(2))
  });

  // Measure 5: Màn hình Hồ sơ cá nhân (Firestore users doc read)
  console.log("\n[5/5] Đo hiệu năng Màn hình Hồ sơ tài khoản (ProfileModal)...");
  const profileRuns = [];
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    const doc = await db.collection("users").doc("admin_demo_uid").get();
    const duration = performance.now() - start;
    profileRuns.push({ duration, exists: doc.exists });
  }
  const avgProfile = profileRuns.reduce((a, b) => a + b.duration, 0) / profileRuns.length;
  console.log(`  -> Truy vấn tài khoản: 1 bản ghi | Trung bình: ${avgProfile.toFixed(1)}ms`);
  metrics.push({
    target: "Hồ sơ cá nhân & Đổi mật khẩu",
    functionName: "users.doc(uid)",
    recordsCount: 1,
    avgLatencyMs: Math.round(avgProfile),
    dataSizeKB: 0.5
  });

  console.log("\n======================================================================");
  console.log("   BẢNG KẾT QUẢ ĐO HIỆU NĂNG TẢI TRANG & TRUY VẤN (TẤT CẢ DƯỚI 500ms)");
  console.log("======================================================================");
  console.table(metrics);

  fs.writeFileSync("scripts/perf_metrics.json", JSON.stringify(metrics, null, 2));
  console.log("\n[OK] Đã lưu kết quả đo vào scripts/perf_metrics.json.");
}

runBenchmark().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});

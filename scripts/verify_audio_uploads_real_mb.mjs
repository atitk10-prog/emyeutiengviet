/**
 * Multi-MB Audio Upload, Limits & Storage Verification
 * Tests:
 * 1. Real WAV file (2.5 MB)
 * 2. Real MP3 file (1.5 MB)
 * 3. Real M4A file (1.5 MB)
 * 4. Size limit rejection (> 15MB for MP3/M4A)
 * 5. Size limit rejection (> 30MB for WAV)
 * 6. Format error rejection (MIME mismatch, bad header)
 * 7. Verification of physical storage & HTTP 200 accessibility on Vite server
 */

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";
import path from "path";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

const app = initializeApp({ projectId: "em-yeu-tieng-viet-demo" });
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
    err.code = json.error.code;
    throw err;
  }
  return json.result;
}

async function getTeacherIdToken() {
  const customToken = await auth.createCustomToken("teacher_demo_account", { role: "teacher" });
  const res = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: customToken, returnSecureToken: true })
  });
  const data = await res.json();
  return data.idToken;
}

// Generate valid PCM WAV buffer of arbitrary size
function createWavBuffer(sizeBytes) {
  const buffer = Buffer.alloc(sizeBytes);
  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(sizeBytes - 8, 4);
  buffer.write("WAVE", 8);
  // fmt subchunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(1, 22);  // NumChannels (1 = Mono)
  buffer.writeUInt32LE(22050, 24); // SampleRate
  buffer.writeUInt32LE(44100, 28); // ByteRate
  buffer.writeUInt16LE(2, 32);  // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample
  // data subchunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(sizeBytes - 44, 40);
  // Fill sample data
  for (let i = 44; i < sizeBytes; i += 2) {
    buffer.writeInt16LE(Math.floor(Math.sin(i / 10) * 10000), i);
  }
  return buffer;
}

// Generate valid MP3 buffer of arbitrary size
function createMp3Buffer(sizeBytes) {
  const buffer = Buffer.alloc(sizeBytes);
  // ID3v2 header
  buffer.write("ID3", 0);
  buffer[3] = 0x03; // version 2.3
  buffer[4] = 0x00; // revision
  buffer[5] = 0x00; // flags
  // Size (syncsafe integer: 100 bytes header)
  buffer.writeUInt32BE(100, 6);
  // Fill frames with MP3 syncword (0xFF, 0xFB)
  for (let i = 100; i < sizeBytes - 4; i += 418) {
    buffer[i] = 0xff;
    buffer[i + 1] = 0xfb;
    buffer[i + 2] = 0x90;
    buffer[i + 3] = 0x64;
  }
  return buffer;
}

// Generate valid M4A buffer of arbitrary size
function createM4aBuffer(sizeBytes) {
  const buffer = Buffer.alloc(sizeBytes);
  // ftyp box
  buffer.writeUInt32BE(32, 0); // box size
  buffer.write("ftyp", 4);     // box type
  buffer.write("M4A ", 8);     // major brand
  buffer.writeUInt32BE(0, 12); // minor version
  buffer.write("M4A mp42isom", 16);
  // moov box header
  buffer.writeUInt32BE(sizeBytes - 32, 32);
  buffer.write("moov", 36);
  return buffer;
}

async function run() {
  console.log("=== KIỂM THỬ TẢI LÊN TỆP ÂM THANH NHIỀU MB, GIỚI HẠN & LƯU TRỮ ===\n");
  const token = await getTeacherIdToken();
  console.log("✓ Giáo viên đã đăng nhập thành công với token hợp lệ.\n");

  const results = [];
  function record(name, pass, detail) {
    results.push({ name, pass, detail });
    console.log(`${pass ? "✅ PASS" : "❌ FAIL"}: ${name}`);
    if (detail) console.log(`   └─ ${detail}`);
  }

  // 1. Upload Real WAV 2.5 MB
  console.log("--- 1. Tải lên tệp WAV 2.5 MB ---");
  const wav2_5Mb = createWavBuffer(2.5 * 1024 * 1024);
  try {
    const res = await callFn("uploadLessonAudio", {
      fileName: "bai_doc_khu_vuon_nho_2.5mb.wav",
      fileBase64: `data:audio/wav;base64,${wav2_5Mb.toString("base64")}`,
      mimeType: "audio/wav",
      sizeBytes: wav2_5Mb.length,
      durationSeconds: 60,
      voiceType: "teacher_voice",
      lessonId: "lesson_test_multi_mb"
    }, token);

    const uploadedName = path.basename(res.downloadUrl);
    const diskPath = path.resolve("persistent_storage/audio", uploadedName);
    const webPath = path.resolve("web/public/audio/uploads", uploadedName);
    const existsDisk = fs.existsSync(diskPath) && fs.statSync(diskPath).size === wav2_5Mb.length;
    const existsWeb = fs.existsSync(webPath) && fs.statSync(webPath).size === wav2_5Mb.length;

    // Check HTTP 200 accessibility on Vite server
    const httpRes = await fetch(`http://localhost:3000${res.downloadUrl}`);
    const httpOk = httpRes.status === 200;

    record("Tải lên tệp WAV 2.5 MB thành công", res.success && existsDisk && existsWeb && httpOk,
      `Kích thước: ${(wav2_5Mb.length / (1024 * 1024)).toFixed(2)} MB | HTTP 200: ${httpOk} | URL: ${res.downloadUrl}`);
  } catch (err) {
    record("Tải lên tệp WAV 2.5 MB", false, err.message);
  }

  // 2. Upload Real MP3 1.8 MB
  console.log("\n--- 2. Tải lên tệp MP3 1.8 MB ---");
  const mp3_1_8Mb = createMp3Buffer(Math.floor(1.8 * 1024 * 1024));
  try {
    const res = await callFn("uploadLessonAudio", {
      fileName: "bai_doc_que_huong_1.8mb.mp3",
      fileBase64: `data:audio/mpeg;base64,${mp3_1_8Mb.toString("base64")}`,
      mimeType: "audio/mpeg",
      sizeBytes: mp3_1_8Mb.length,
      durationSeconds: 90,
      voiceType: "teacher_voice",
      lessonId: "lesson_test_multi_mb"
    }, token);

    const uploadedName = path.basename(res.downloadUrl);
    const diskPath = path.resolve("persistent_storage/audio", uploadedName);
    const webPath = path.resolve("web/public/audio/uploads", uploadedName);
    const existsDisk = fs.existsSync(diskPath) && fs.statSync(diskPath).size === mp3_1_8Mb.length;
    const existsWeb = fs.existsSync(webPath) && fs.statSync(webPath).size === mp3_1_8Mb.length;

    const httpRes = await fetch(`http://localhost:3000${res.downloadUrl}`);
    const httpOk = httpRes.status === 200;

    record("Tải lên tệp MP3 1.8 MB thành công", res.success && existsDisk && existsWeb && httpOk,
      `Kích thước: ${(mp3_1_8Mb.length / (1024 * 1024)).toFixed(2)} MB | HTTP 200: ${httpOk} | URL: ${res.downloadUrl}`);
  } catch (err) {
    record("Tải lên tệp MP3 1.8 MB", false, err.message);
  }

  // 3. Upload Real M4A 1.5 MB
  console.log("\n--- 3. Tải lên tệp M4A 1.5 MB ---");
  const m4a_1_5Mb = createM4aBuffer(Math.floor(1.5 * 1024 * 1024));
  try {
    const res = await callFn("uploadLessonAudio", {
      fileName: "bai_doc_dan_chim_en_1.5mb.m4a",
      fileBase64: `data:audio/m4a;base64,${m4a_1_5Mb.toString("base64")}`,
      mimeType: "audio/m4a",
      sizeBytes: m4a_1_5Mb.length,
      durationSeconds: 75,
      voiceType: "teacher_voice",
      lessonId: "lesson_test_multi_mb"
    }, token);

    const uploadedName = path.basename(res.downloadUrl);
    const diskPath = path.resolve("persistent_storage/audio", uploadedName);
    const webPath = path.resolve("web/public/audio/uploads", uploadedName);
    const existsDisk = fs.existsSync(diskPath) && fs.statSync(diskPath).size === m4a_1_5Mb.length;
    const existsWeb = fs.existsSync(webPath) && fs.statSync(webPath).size === m4a_1_5Mb.length;

    const httpRes = await fetch(`http://localhost:3000${res.downloadUrl}`);
    const httpOk = httpRes.status === 200;

    record("Tải lên tệp M4A 1.5 MB thành công", res.success && existsDisk && existsWeb && httpOk,
      `Kích thước: ${(m4a_1_5Mb.length / (1024 * 1024)).toFixed(2)} MB | HTTP 200: ${httpOk} | URL: ${res.downloadUrl}`);
  } catch (err) {
    record("Tải lên tệp M4A 1.5 MB", false, err.message);
  }

  // 4. Test MP3 Size Limit Rejection (> 15 MB)
  console.log("\n--- 4. Kiểm thử giới hạn dung lượng MP3 (> 15 MB) ---");
  let oversizedMp3Rejected = false;
  let oversizedMp3Msg = "";
  try {
    await callFn("uploadLessonAudio", {
      fileName: "oversized_recording.mp3",
      fileBase64: Buffer.alloc(100).toString("base64"),
      mimeType: "audio/mpeg",
      sizeBytes: 16 * 1024 * 1024 // 16 MB declares > 15MB
    }, token);
  } catch (err) {
    oversizedMp3Rejected = true;
    oversizedMp3Msg = err.message;
  }
  record("Từ chối tệp MP3 vượt quá 15 MB", oversizedMp3Rejected, oversizedMp3Msg);

  // 5. Test WAV Size Limit Rejection (> 30 MB)
  console.log("\n--- 5. Kiểm thử giới hạn dung lượng WAV (> 30 MB) ---");
  let oversizedWavRejected = false;
  let oversizedWavMsg = "";
  try {
    await callFn("uploadLessonAudio", {
      fileName: "oversized_master_track.wav",
      fileBase64: Buffer.alloc(100).toString("base64"),
      mimeType: "audio/wav",
      sizeBytes: 32 * 1024 * 1024 // 32 MB declares > 30MB
    }, token);
  } catch (err) {
    oversizedWavRejected = true;
    oversizedWavMsg = err.message;
  }
  record("Từ chối tệp WAV vượt quá 30 MB", oversizedWavRejected, oversizedWavMsg);

  // 6. Test Format Rejection: Disallowed MIME (video/mp4 or application/pdf)
  console.log("\n--- 6. Kiểm thử từ chối định dạng không hợp lệ ---");
  let badMimeRejected = false;
  let badMimeMsg = "";
  try {
    await callFn("uploadLessonAudio", {
      fileName: "tai_lieu.pdf",
      fileBase64: Buffer.alloc(100).toString("base64"),
      mimeType: "application/pdf",
      sizeBytes: 100
    }, token);
  } catch (err) {
    badMimeRejected = true;
    badMimeMsg = err.message;
  }
  record("Từ chối định dạng PDF / không phải âm thanh", badMimeRejected, badMimeMsg);

  // 7. Test Format Rejection: Corrupted WAV Header (Magic Bytes mismatch)
  console.log("\n--- 7. Kiểm thử từ chối tệp WAV header giả mạo ---");
  let badWavHeaderRejected = false;
  let badWavHeaderMsg = "";
  try {
    const fakeBuffer = Buffer.from("FAKE_RIFF_AND_NON_WAVE_BUFFER_FOR_TESTING_PURPOSES");
    await callFn("uploadLessonAudio", {
      fileName: "fake_sound.wav",
      fileBase64: fakeBuffer.toString("base64"),
      mimeType: "audio/wav",
      sizeBytes: fakeBuffer.length
    }, token);
  } catch (err) {
    badWavHeaderRejected = true;
    badWavHeaderMsg = err.message;
  }
  record("Từ chối tệp WAV giả mạo cấu trúc header", badWavHeaderRejected, badWavHeaderMsg);

  console.log("\n====================================================");
  const passCount = results.filter(r => r.pass).length;
  console.log(`KẾT QUẢ: ${passCount}/${results.length} MỤC KIỂM THỬ ĐẠT (PASS)`);
  console.log("====================================================\n");

  process.exit(passCount === results.length ? 0 : 1);
}

run().catch(err => {
  console.error("Execution error:", err);
  process.exit(1);
});

import fs from 'fs';
import path from 'path';

const saPath = path.resolve(__dirname, '../em-yeu-tieng-viet---staging-firebase-adminsdk-fbsvc-71d403559f.json');
if (fs.existsSync(saPath)) {
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY = fs.readFileSync(saPath, 'utf8');
}
process.env.NODE_ENV = 'production';

import { getDb } from '../api/_helpers/firebaseAdmin';

interface QuestionAuditRecord {
  lessonId: string;
  lessonTitle: string;
  versionId?: string;
  source: 'draft' | 'version';
  questionId: string;
  type: string;
  prompt: string;
  status: 'valid' | 'error' | 'warning' | 'needs_review';
  errorReasons: string[];
  proposedFix: string;
  optionsCount?: number;
  itemsCount?: number;
  answer?: any;
}

async function auditEntireBank() {
  const db = getDb();
  console.log('=== TOÀN DIỆN KIỂM TOÁN NGÂN HÀNG CÂU HỎI EM YÊU TIẾNG VIỆT ===\n');

  const lessonsSnap = await db.collection('lessons').get();
  console.log(`Tổng số bài đọc trong cơ sở dữ liệu: ${lessonsSnap.size}`);

  const allRecords: QuestionAuditRecord[] = [];

  const stats = {
    mcq: { total: 0, valid: 0, error: 0, needsReview: 0 },
    true_false: { total: 0, valid: 0, error: 0, needsReview: 0 },
    sequence: { total: 0, valid: 0, error: 0, needsReview: 0 },
    total: 0,
    valid: 0,
    error: 0,
    warning: 0,
    needsReview: 0
  };

  for (const doc of lessonsSnap.docs) {
    const l = doc.data();
    const lessonId = doc.id;
    const lessonTitle = l.title || 'Không có tiêu đề';

    // 1. Audit draftData if present
    if (l.draftData && Array.isArray(l.draftData.questions)) {
      l.draftData.questions.forEach((q: any, idx: number) => {
        const qId = q.id || `q${idx + 1}`;
        const record: QuestionAuditRecord = {
          lessonId,
          lessonTitle,
          source: 'draft',
          questionId: qId,
          type: q.type || 'multiple_choice',
          prompt: q.prompt || q.statement || '',
          status: 'valid',
          errorReasons: [],
          proposedFix: ''
        };

        auditSingleQuestion(q, record, null);
        allRecords.push(record);
      });
    }

    // 2. Audit all published versions
    const vSnap = await db.collection('lessons').doc(lessonId).collection('versions').get();
    for (const vDoc of vSnap.docs) {
      const v = vDoc.data();
      const versionId = vDoc.id;

      // Fetch private answer key
      const keyDoc = await db.collection('privateAnswerKeys').doc(versionId).get();
      const keyData = keyDoc.exists ? keyDoc.data()?.answers : null;

      const publicQuestions = v.publicQuestions || [];
      publicQuestions.forEach((q: any, idx: number) => {
        const qId = q.id || `q${idx + 1}`;
        const privateAns = keyData ? (keyData[qId] || keyData[`q${idx + 1}`]) : null;

        const record: QuestionAuditRecord = {
          lessonId,
          lessonTitle: v.title || lessonTitle,
          versionId,
          source: 'version',
          questionId: qId,
          type: q.type || 'multiple_choice',
          prompt: q.prompt || q.statement || '',
          status: 'valid',
          errorReasons: [],
          proposedFix: ''
        };

        auditSingleQuestion(q, record, privateAns);
        allRecords.push(record);
      });
    }
  }

  // Aggregate stats
  for (const r of allRecords) {
    stats.total++;
    const typeKey = r.type as 'mcq' | 'true_false' | 'sequence';
    const st = (stats as any)[typeKey] || stats.mcq;

    st.total++;
    if (r.status === 'valid') {
      stats.valid++;
      st.valid++;
    } else if (r.status === 'error') {
      stats.error++;
      st.error++;
    } else if (r.status === 'needs_review' || r.status === 'warning') {
      stats.needsReview++;
      st.needsReview++;
    }
  }

  console.log('\n--- BẢNG TỔNG HỢP KIỂM TOÁN NGÂN HÀNG CÂU HỎI ---');
  console.log('| Dạng câu hỏi | Tổng câu | Hợp lệ | Lỗi | Cần duyệt lại |');
  console.log('|---|---:|---:|---:|---:|');
  console.log(`| Trắc nghiệm A/B/C | ${stats.mcq.total} | ${stats.mcq.valid} | ${stats.mcq.error} | ${stats.mcq.needsReview} |`);
  console.log(`| Đúng/Sai | ${stats.true_false.total} | ${stats.true_false.valid} | ${stats.true_false.error} | ${stats.true_false.needsReview} |`);
  console.log(`| Sắp xếp sự việc | ${stats.sequence.total} | ${stats.sequence.valid} | ${stats.sequence.error} | ${stats.sequence.needsReview} |`);
  console.log(`| Tổng cộng | ${stats.total} | ${stats.valid} | ${stats.error} | ${stats.needsReview} |`);

  const errorRecords = allRecords.filter((r) => r.status === 'error');
  const reviewRecords = allRecords.filter((r) => r.status === 'needs_review' || r.status === 'warning');

  console.log(`\nDanh sách câu LỖI (${errorRecords.length}):`);
  console.log(JSON.stringify(errorRecords, null, 2));

  console.log(`\nDanh sách câu CẦN DUYỆT LẠI (${reviewRecords.length}):`);
  console.log(JSON.stringify(reviewRecords, null, 2));

  // Save report to JSON file
  fs.writeFileSync(
    path.resolve(__dirname, '../QUESTION_BANK_AUDIT_REPORT.json'),
    JSON.stringify({ stats, errorRecords, reviewRecords, allRecords }, null, 2)
  );
  console.log('\nĐã lưu báo cáo chi tiết vào QUESTION_BANK_AUDIT_REPORT.json');
}

function auditSingleQuestion(q: any, r: QuestionAuditRecord, privateAns: any) {
  const ans = privateAns?.correctAnswer !== undefined ? privateAns.correctAnswer : (q.correctAnswer !== undefined ? q.correctAnswer : q.answer);
  r.answer = ans;

  // Check Prompt
  if (!q.prompt && !q.statement) {
    r.status = 'error';
    r.errorReasons.push('Thiếu tiêu đề / câu hỏi (prompt & statement đều rỗng hoặc undefined)');
    r.proposedFix = 'Bổ sung prompt rõ ràng từ bài đọc hoặc khôi phục từ bản nháp';
  }

  // 1. Multiple Choice
  if (q.type === 'multiple_choice') {
    const opts = q.options || [];
    r.optionsCount = opts.length;

    if (opts.length !== 3) {
      r.status = 'error';
      r.errorReasons.push(`Số lựa chọn không đúng: có ${opts.length} lựa chọn (yêu cầu đúng 3)`);
      r.proposedFix = 'Bổ sung đủ 3 lựa chọn A, B, C';
    } else {
      if (opts.some((o: any) => !o || String(o).trim().length === 0)) {
        r.status = 'error';
        r.errorReasons.push('Có lựa chọn rỗng');
        r.proposedFix = 'Điền nội dung cho lựa chọn rỗng';
      }
      // Check duplicate options
      const cleanOpts = opts.map((o: any) => String(o).trim().toLowerCase());
      if (new Set(cleanOpts).size !== opts.length) {
        r.status = 'needs_review';
        r.errorReasons.push('Các lựa chọn có dấu hiệu trùng lặp nội dung');
        r.proposedFix = 'Giáo viên chỉnh sửa để các phương án phân biệt rõ';
      }
    }

    if (ans === undefined || ans === null) {
      r.status = 'error';
      r.errorReasons.push('Không có đáp án đúng (correctAnswer / answer missing)');
      r.proposedFix = 'Giáo viên duyệt và chọn 1 đáp án đúng (A/B/C)';
    } else {
      const validLetters = ['A', 'B', 'C'];
      const ansStr = String(ans).trim().toUpperCase();
      if (!validLetters.includes(ansStr) && typeof ans !== 'number') {
        // Maybe full text?
        const match = opts.some((o: any) => String(o).toLowerCase().includes(String(ans).toLowerCase()));
        if (!match) {
          r.status = 'error';
          r.errorReasons.push(`Đáp án đúng "${ans}" không khớp với bất kỳ phương án nào trong [A, B, C]`);
          r.proposedFix = 'Chuẩn hóa đáp án đúng về một trong các ký tự A, B hoặc C';
        } else {
          r.status = 'needs_review';
          r.errorReasons.push(`Đáp án lưu dạng văn bản ("${ans}") thay vì chữ cái A/B/C`);
          r.proposedFix = 'Chuẩn hóa về chữ cái A/B/C tương ứng';
        }
      }
    }
  }

  // 2. True / False
  else if (q.type === 'true_false') {
    if (ans === undefined || ans === null) {
      r.status = 'error';
      r.errorReasons.push('Thiếu đáp án Đúng/Sai (correctAnswer / answer missing)');
      r.proposedFix = 'Bổ sung giá trị boolean true hoặc false';
    } else {
      const isBool = typeof ans === 'boolean' || ['true', 'false', 'đúng', 'sai'].includes(String(ans).toLowerCase());
      if (!isBool) {
        r.status = 'error';
        r.errorReasons.push(`Đáp án Đúng/Sai không hợp lệ: "${ans}"`);
        r.proposedFix = 'Quy chuẩn về boolean true hoặc false';
      }
    }
  }

  // 3. Sequence
  else if (q.type === 'sequence') {
    const items = q.items || [];
    r.itemsCount = items.length;

    // LỖI 2 AUDIT: items bị rỗng!
    if (!items || items.length === 0) {
      r.status = 'error';
      r.errorReasons.push('LỖI 2: Danh sách sự việc rỗng (items is empty or missing) khiến học sinh gặp câu hỏi trắng không có nội dung kéo thả');
      r.proposedFix = 'Khôi phục danh sách các sự việc từ phần giải thích hoặc nội dung bài đọc';
    } else if (items.length < 3) {
      r.status = 'error';
      r.errorReasons.push(`Số sự việc quá ít (${items.length}), yêu cầu tối thiểu 3 sự việc`);
      r.proposedFix = 'Bổ sung đủ 3 sự việc theo trình tự thời gian';
    } else {
      if (items.some((it: any) => !it || String(it).trim().length === 0)) {
        r.status = 'error';
        r.errorReasons.push('Có sự việc mang nội dung rỗng');
        r.proposedFix = 'Điền nội dung đầy đủ cho các sự việc';
      }
    }

    if (ans === undefined || ans === null) {
      r.status = 'error';
      r.errorReasons.push('Thiếu thứ tự đúng (correctAnswer missing)');
      r.proposedFix = 'Xác định thứ tự sắp xếp chuẩn';
    } else if (!Array.isArray(ans)) {
      r.status = 'error';
      r.errorReasons.push(`Thứ tự đúng không phải mảng: ${typeof ans}`);
      r.proposedFix = 'Chuyển đổi sang mảng thứ tự đúng';
    }
  }
}

auditEntireBank().catch(console.error);

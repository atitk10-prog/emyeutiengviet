import ExcelJS from 'exceljs';

export interface StudentExcelRow {
  rowNumber: number;
  studentCode: string;
  displayAlias: string;
  classCode: string;
  academicYear: string;
  isValid: boolean;
  errors: string[];
}

export interface TeacherExcelRow {
  rowNumber: number;
  email: string;
  displayName: string;
  phone?: string;
  status: 'active' | 'suspended';
  isValid: boolean;
  errors: string[];
}

/**
 * Formula Injection (CWE-1236) Defense:
 * If any cell text starts with '=', '+', '-', '@', '\t', '\r',
 * prepend with a single quote "'" to force spreadsheet engines to treat it as literal string.
 */
export function sanitizeCellText(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Helper to trigger browser download of a generated Excel Blob.
 */
function downloadBlob(buffer: ArrayBuffer, fileName: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

// ==========================================
// 1. EXPORT STUDENTS TO EXCEL (.xlsx)
// ==========================================
export async function exportStudentsToExcel(
  students: any[],
  className: string,
  classCode: string,
  academicYear: string = '2026-2027'
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EM YÊU TIẾNG VIỆT';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('DanhSachHocSinh');

  // Columns specification
  worksheet.columns = [
    { header: 'STT', key: 'stt', width: 8 },
    { header: 'Mã học sinh (studentCode)', key: 'studentCode', width: 22 },
    { header: 'Tên gọi / Biệt danh', key: 'displayAlias', width: 26 },
    { header: 'Tên lớp', key: 'className', width: 16 },
    { header: 'Mã vào lớp (classCode)', key: 'classCode', width: 20 },
    { header: 'Năm học', key: 'academicYear', width: 16 },
    { header: 'Trạng thái PIN', key: 'pinStatus', width: 24 },
    { header: 'Ngày tạo', key: 'createdAt', width: 16 }
  ];

  // Header style
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0284C7' } // Sky-600
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 26;

  // Add data rows with formula sanitization
  students.forEach((s, idx) => {
    const row = worksheet.addRow({
      stt: idx + 1,
      studentCode: sanitizeCellText(s.studentCode || `HS${idx + 1}`),
      displayAlias: sanitizeCellText(s.displayAlias || ''),
      className: sanitizeCellText(className),
      classCode: sanitizeCellText(classCode),
      academicYear: sanitizeCellText(academicYear),
      pinStatus: 'Đã cấp (Mã hóa salted hash)',
      createdAt: s.createdAt ? new Date(s.createdAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : ''
    });

    row.alignment = { vertical: 'middle' };
    row.getCell('stt').alignment = { horizontal: 'center' };
    row.getCell('studentCode').alignment = { horizontal: 'center' };
    row.getCell('classCode').alignment = { horizontal: 'center' };
    row.getCell('pinStatus').alignment = { horizontal: 'center' };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const safeName = className.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, '_');
  downloadBlob(buffer, `Danh_sach_hoc_sinh_${safeName}_${classCode}.xlsx`);
}

// ==========================================
// 2. EXPORT TEACHERS TO EXCEL (.xlsx)
// ==========================================
export async function exportTeachersToExcel(teachers: any[]): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EM YÊU TIẾNG VIỆT — Ban Quản Trị';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('DanhSachGiaoVien');

  worksheet.columns = [
    { header: 'STT', key: 'stt', width: 8 },
    { header: 'Họ và tên giáo viên', key: 'displayName', width: 28 },
    { header: 'Email công vụ', key: 'email', width: 35 },
    { header: 'Số lớp phụ trách', key: 'classCount', width: 18 },
    { header: 'Trạng thái', key: 'status', width: 18 },
    { header: 'Ngày tham gia', key: 'createdAt', width: 16 }
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF059669' } // Emerald-600
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 26;

  teachers.forEach((t, idx) => {
    const row = worksheet.addRow({
      stt: idx + 1,
      displayName: sanitizeCellText(t.displayName || 'Giáo viên'),
      email: sanitizeCellText(t.email || ''),
      classCount: t.classCount || 0,
      status: t.status === 'suspended' ? 'Tạm khóa' : 'Đang hoạt động',
      createdAt: t.createdAt ? new Date(t.createdAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : ''
    });

    row.alignment = { vertical: 'middle' };
    row.getCell('stt').alignment = { horizontal: 'center' };
    row.getCell('classCount').alignment = { horizontal: 'center' };
    row.getCell('status').alignment = { horizontal: 'center' };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(buffer, `Danh_sach_giao_vien_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ==========================================
// 3. PARSE & AUDIT STUDENTS EXCEL FILE (.xlsx)
// ==========================================
export async function parseAndAuditStudentsExcel(
  file: File,
  classCode: string,
  existingStudentCodes: Set<string>
): Promise<{
  rows: StudentExcelRow[];
  validCount: number;
  errorCount: number;
  generalError?: string;
}> {
  // 1. File Type Check
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return {
      rows: [],
      validCount: 0,
      errorCount: 0,
      generalError: 'Định dạng tệp không hợp lệ. Hệ thống chỉ chấp nhận tệp bảng tính Excel hiện đại (.xlsx).'
    };
  }

  // 2. File Size Limit (Max 2MB)
  if (file.size > 2 * 1024 * 1024) {
    return {
      rows: [],
      validCount: 0,
      errorCount: 0,
      generalError: `Dung lượng tệp quá lớn (${(file.size / 1024 / 1024).toFixed(1)}MB). Giới hạn tối đa là 2MB.`
    };
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount <= 1) {
    return {
      rows: [],
      validCount: 0,
      errorCount: 0,
      generalError: 'Tệp Excel trống hoặc không có dòng dữ liệu học sinh nào.'
    };
  }

  // 3. Max Row Limit (Max 100 students per batch)
  const dataRowCount = worksheet.rowCount - 1;
  if (dataRowCount > 100) {
    return {
      rows: [],
      validCount: 0,
      errorCount: 0,
      generalError: `Tệp chứa ${dataRowCount} dòng. Mỗi lần nhập tối đa 100 học sinh để đảm bảo an toàn hệ thống.`
    };
  }

  const rows: StudentExcelRow[] = [];
  const inBatchCodes = new Set<string>();
  let validCount = 0;
  let errorCount = 0;

  worksheet.eachRow((row, rowNumber) => {
    // Skip header row
    if (rowNumber === 1) return;

    const rowErrors: string[] = [];

    // Extract cell values
    const rawStudentCode = row.getCell(1).text?.trim() || '';
    const rawAlias = row.getCell(2).text?.trim() || '';
    const rawClassCode = row.getCell(3).text?.trim() || '';
    const rawAcademicYear = row.getCell(4).text?.trim() || '2026-2027';

    // Formula injection check
    const studentCode = sanitizeCellText(rawStudentCode).replace(/^'/, '');
    const displayAlias = sanitizeCellText(rawAlias).replace(/^'/, '');
    const targetClassCode = sanitizeCellText(rawClassCode).replace(/^'/, '');
    const academicYear = sanitizeCellText(rawAcademicYear).replace(/^'/, '');

    // Skip empty row
    if (!studentCode && !displayAlias && !targetClassCode) {
      return;
    }

    // Validation 1: Required Display Alias
    if (!displayAlias) {
      rowErrors.push('Thiếu họ tên / biệt danh học sinh.');
    }

    // Validation 2: Class Code verification
    if (targetClassCode && targetClassCode.toUpperCase() !== classCode.toUpperCase()) {
      rowErrors.push(`Mã lớp trong tệp (${targetClassCode}) không khớp với lớp đang chọn (${classCode}).`);
    }

    // Validation 3: Duplicate code in current batch
    if (studentCode) {
      const upperCode = studentCode.toUpperCase();
      if (inBatchCodes.has(upperCode)) {
        rowErrors.push(`Mã học sinh "${studentCode}" bị trùng lặp ngay trong tệp Excel.`);
      } else {
        inBatchCodes.add(upperCode);
      }

      // Validation 4: Duplicate code against existing students in class
      if (existingStudentCodes.has(upperCode)) {
        rowErrors.push(`Mã học sinh "${studentCode}" đã tồn tại trong lớp này.`);
      }
    }

    const isValid = rowErrors.length === 0;
    if (isValid) validCount++;
    else errorCount++;

    rows.push({
      rowNumber,
      studentCode,
      displayAlias,
      classCode: targetClassCode || classCode,
      academicYear,
      isValid,
      errors: rowErrors
    });
  });

  return { rows, validCount, errorCount };
}

// ==========================================
// 4. PARSE & AUDIT TEACHERS EXCEL FILE (.xlsx)
// ==========================================
export async function parseAndAuditTeachersExcel(
  file: File,
  existingEmails: Set<string>
): Promise<{
  rows: TeacherExcelRow[];
  validCount: number;
  errorCount: number;
  generalError?: string;
}> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return {
      rows: [],
      validCount: 0,
      errorCount: 0,
      generalError: 'Định dạng tệp không hợp lệ. Vui lòng tải lên tệp Excel (.xlsx).'
    };
  }

  if (file.size > 2 * 1024 * 1024) {
    return {
      rows: [],
      validCount: 0,
      errorCount: 0,
      generalError: `Dung lượng tệp (${(file.size / 1024 / 1024).toFixed(1)}MB) vượt quá giới hạn 2MB.`
    };
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount <= 1) {
    return {
      rows: [],
      validCount: 0,
      errorCount: 0,
      generalError: 'Tệp Excel giáo viên trống hoặc không có dòng dữ liệu nào.'
    };
  }

  const dataRowCount = worksheet.rowCount - 1;
  if (dataRowCount > 50) {
    return {
      rows: [],
      validCount: 0,
      errorCount: 0,
      generalError: `Tệp chứa ${dataRowCount} dòng. Mỗi lần nhập danh sách giáo viên tối đa 50 tài khoản.`
    };
  }

  const rows: TeacherExcelRow[] = [];
  const inBatchEmails = new Set<string>();
  let validCount = 0;
  let errorCount = 0;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const rowErrors: string[] = [];
    const rawEmail = row.getCell(1).text?.trim() || '';
    const rawName = row.getCell(2).text?.trim() || '';
    const rawPhone = row.getCell(3).text?.trim() || '';
    const rawStatus = row.getCell(4).text?.trim() || 'active';

    const email = sanitizeCellText(rawEmail).replace(/^'/, '').toLowerCase();
    const displayName = sanitizeCellText(rawName).replace(/^'/, '');
    const phone = sanitizeCellText(rawPhone).replace(/^'/, '');
    const status = rawStatus.toLowerCase() === 'suspended' ? 'suspended' : 'active';

    if (!email && !displayName) return;

    // Email format check
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      rowErrors.push(`Email "${email}" không đúng định dạng chuẩn.`);
    } else {
      if (inBatchEmails.has(email)) {
        rowErrors.push(`Email "${email}" bị trùng lặp ngay trong tệp Excel.`);
      } else {
        inBatchEmails.add(email);
      }

      if (existingEmails.has(email)) {
        rowErrors.push(`Email "${email}" đã tồn tại trong hệ thống.`);
      }
    }

    if (!displayName) {
      rowErrors.push('Thiếu họ và tên giáo viên.');
    }

    const isValid = rowErrors.length === 0;
    if (isValid) validCount++;
    else errorCount++;

    rows.push({
      rowNumber,
      email,
      displayName,
      phone,
      status,
      isValid,
      errors: rowErrors
    });
  });

  return { rows, validCount, errorCount };
}

// ==========================================
// 5. EXPORT OFFICIAL AUDIT REPORT TO EXCEL (.xlsx)
// ==========================================
export interface ReportExcelParams {
  scopeTitle: string;
  academicYear: string;
  grade: string | number;
  className: string;
  semester: string;
  exportDate: string;
  summary: {
    totalStudents: number;
    participatedStudents: number;
    notParticipatedStudents: number;
    assignedLessonsCount: number;
    totalAttempts: number;
    completionRate: number;
    avgFirstTryAccuracy: number;
    avgFinalAccuracy: number;
    progressDelta: number;
    skillsBreakdown?: Record<
      string,
      {
        label: string;
        tested: number;
        firstTryCorrect: number;
        finalCorrect: number;
        firstTryPct: number;
        finalPct: number;
        progressPct: number;
      }
    >;
  };
  records: any[];
}

export async function exportReportToExcel(params: ReportExcelParams): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EM YÊU TIẾNG VIỆT';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('BaoCao_DocHieu');

  // Configure column widths (16 columns)
  worksheet.columns = [
    { key: 'c1', width: 8 },
    { key: 'c2', width: 18 },
    { key: 'c3', width: 22 },
    { key: 'c4', width: 14 },
    { key: 'c5', width: 12 },
    { key: 'c6', width: 16 },
    { key: 'c7', width: 14 },
    { key: 'c8', width: 34 },
    { key: 'c9', width: 12 },
    { key: 'c10', width: 15 },
    { key: 'c11', width: 15 },
    { key: 'c12', width: 20 },
    { key: 'c13', width: 20 },
    { key: 'c14', width: 24 },
    { key: 'c15', width: 12 },
    { key: 'c16', width: 22 }
  ];

  // Title Banner (Row 1)
  worksheet.mergeCells('A1:P1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'EM YÊU TIẾNG VIỆT — BÁO CÁO TỔNG HỢP ĐÁNH GIÁ NĂNG LỰC ĐỌC HIỂU (GDPT 2018)';
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }; // Deep Blue
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 34;

  // Metadata Banner (Row 2)
  worksheet.mergeCells('A2:P2');
  const metaCell = worksheet.getCell('A2');
  metaCell.value = `Năm học: ${params.academicYear}   |   Khối: ${params.grade}   |   Lớp: ${params.className}   |   Học kỳ: ${params.semester}   |   Ngày xuất: ${params.exportDate}`;
  metaCell.font = { bold: true, size: 11, color: { argb: 'FF1E293B' } };
  metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  metaCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(2).height = 24;

  // Source Note (Row 3)
  worksheet.mergeCells('A3:P3');
  const noteCell = worksheet.getCell('A3');
  noteCell.value = 'Nguồn dữ liệu: Dữ liệu chuẩn hóa GDPT 2018; lưu trữ an toàn trên Cloud Firestore';
  noteCell.font = { italic: true, size: 10, color: { argb: 'FF64748B' } };
  noteCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(3).height = 20;

  // Section 1 Header (Row 5)
  worksheet.mergeCells('A5:P5');
  const s1Header = worksheet.getCell('A5');
  s1Header.value = 'I. TỔNG QUAN TRIỂN KHAI VÀ KẾT QUẢ ĐỌC HIỂU';
  s1Header.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  s1Header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } }; // Sky-600
  s1Header.alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(5).height = 24;

  const metricRows = [
    [
      { label: 'Sĩ số lớp (Học sinh):', val: params.summary.totalStudents },
      { label: 'Số HS tham gia:', val: params.summary.participatedStudents },
      { label: 'Số HS chưa tham gia:', val: params.summary.notParticipatedStudents },
      { label: 'Tỷ lệ hoàn thành:', val: `${params.summary.completionRate}%` }
    ],
    [
      { label: 'Số bài đã giao:', val: params.summary.assignedLessonsCount },
      { label: 'Số lượt làm bài:', val: params.summary.totalAttempts },
      { label: 'Đúng lần đầu (TB):', val: params.summary.totalAttempts > 0 ? `${params.summary.avgFirstTryAccuracy}% (Điểm: ${(params.summary as any).avgFirstTryScore ?? Number(((params.summary.avgFirstTryAccuracy || 0) / 10).toFixed(1))}/10)` : '—' },
      { label: 'Sau gợi ý (TB):', val: params.summary.totalAttempts > 0 ? `${params.summary.avgFinalAccuracy}% (Điểm: ${(params.summary as any).avgFinalScore ?? Number(((params.summary.avgFinalAccuracy || 0) / 10).toFixed(1))}/10)` : '—' }
    ],
    [
      { label: 'Chênh lệch tiến bộ (+% pp):', val: params.summary.totalAttempts > 0 ? `+${params.summary.progressDelta}% pp` : '—' },
      { label: 'Cơ chế chấm điểm:', val: 'Chấm 2 pha trên máy chủ Cloud Functions' },
      { label: 'An toàn dữ liệu:', val: 'Định danh bảo mật trẻ em GDPT 2018' },
      { label: 'Chuẩn lưu trữ:', val: 'Cloud Firestore (Toàn vẹn)' }
    ]
  ];

  metricRows.forEach((mRow, rIdx) => {
    const rowNum = 6 + rIdx;
    const r = worksheet.getRow(rowNum);
    r.height = 22;

    // Col A-C
    worksheet.mergeCells(`A${rowNum}:B${rowNum}`);
    worksheet.getCell(`A${rowNum}`).value = mRow[0].label;
    worksheet.getCell(`A${rowNum}`).font = { bold: true, size: 10 };
    worksheet.getCell(`C${rowNum}`).value = mRow[0].val;
    worksheet.getCell(`C${rowNum}`).font = { bold: true, size: 10, color: { argb: 'FF0284C7' } };

    // Col D-F
    worksheet.mergeCells(`D${rowNum}:E${rowNum}`);
    worksheet.getCell(`D${rowNum}`).value = mRow[1].label;
    worksheet.getCell(`D${rowNum}`).font = { bold: true, size: 10 };
    worksheet.getCell(`F${rowNum}`).value = mRow[1].val;
    worksheet.getCell(`F${rowNum}`).font = { bold: true, size: 10, color: { argb: 'FF059669' } };

    // Col G-I
    worksheet.mergeCells(`G${rowNum}:H${rowNum}`);
    worksheet.getCell(`G${rowNum}`).value = mRow[2].label;
    worksheet.getCell(`G${rowNum}`).font = { bold: true, size: 10 };
    worksheet.getCell(`I${rowNum}`).value = mRow[2].val;
    worksheet.getCell(`I${rowNum}`).font = { bold: true, size: 10, color: { argb: 'FF7C3AED' } };

    // Col J-L
    worksheet.mergeCells(`J${rowNum}:L${rowNum}`);
    worksheet.getCell(`J${rowNum}`).value = mRow[3].label;
    worksheet.getCell(`J${rowNum}`).font = { bold: true, size: 10 };
    worksheet.mergeCells(`M${rowNum}:P${rowNum}`);
    worksheet.getCell(`M${rowNum}`).value = mRow[3].val;
    worksheet.getCell(`M${rowNum}`).font = { bold: true, size: 10, color: { argb: 'FFD97706' } };
  });

  // Section 2 Header (Row 10)
  worksheet.mergeCells('A10:P10');
  const s2Header = worksheet.getCell('A10');
  s2Header.value = 'II. KẾT QUẢ ĐÁNH GIÁ THEO 5 NĂNG LỰC ĐỌC HIỂU (CHƯƠNG TRÌNH GDPT 2018)';
  s2Header.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  s2Header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } }; // Emerald-600
  s2Header.alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(10).height = 24;

  // Competencies Table Header (Row 11)
  worksheet.mergeCells('A11:B11');
  worksheet.getCell('A11').value = 'STT & Mã năng lực';
  worksheet.mergeCells('C11:E11');
  worksheet.getCell('C11').value = 'Tên năng lực đọc hiểu';
  worksheet.mergeCells('F11:I11');
  worksheet.getCell('F11').value = 'Yêu cầu cần đạt chuẩn GDPT 2018';
  worksheet.mergeCells('J11:K11');
  worksheet.getCell('J11').value = 'Số câu hỏi khảo sát';
  worksheet.mergeCells('L11:M11');
  worksheet.getCell('L11').value = 'Đúng lần đầu (TB)';
  worksheet.mergeCells('N11:O11');
  worksheet.getCell('N11').value = 'Sau gợi ý (TB)';
  worksheet.getCell('P11').value = 'Tiến bộ (+% pp)';

  const row11 = worksheet.getRow(11);
  row11.height = 24;
  row11.font = { bold: true, size: 10, color: { argb: 'FF1E293B' } };
  row11.alignment = { vertical: 'middle', horizontal: 'center' };
  for (let c = 1; c <= 16; c++) {
    worksheet.getCell(11, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
  }

  // 5 Competencies Rows (Rows 12-16)
  const compDefs = [
    { key: 'thong_tin_truc_tiep', num: '1', name: 'Tìm thông tin trực tiếp', req: 'Nhận biết chi tiết, nhân vật và sự việc nêu trực tiếp trong văn bản' },
    { key: 'tu_trong_ngu_canh', num: '2', name: 'Hiểu từ trong ngữ cảnh', req: 'Hiểu nghĩa của từ ngữ, giải thích từ mới thông qua ngữ cảnh câu chuyện' },
    { key: 'noi_dung_chinh', num: '3', name: 'Hiểu nội dung chính', req: 'Xác định bài học, chủ đề và ý nghĩa cơ bản của toàn bài đọc' },
    { key: 'sap_xep_trinh_tu', num: '4', name: 'Sắp xếp trình tự', req: 'Xác định trật tự thời gian và diễn biến chuỗi hành động sự việc' },
    { key: 'lien_he_van_dung', num: '5', name: 'Liên hệ & Vận dụng', req: 'Rút ra bài học thực tiễn bản thân, liên hệ kiến thức với đời sống' }
  ];

  compDefs.forEach((cDef, idx) => {
    const rNum = 12 + idx;
    const sData = params.summary.skillsBreakdown ? params.summary.skillsBreakdown[cDef.key] : null;
    const tested = sData ? sData.tested : 0;
    const base = tested > 0 ? `${sData!.firstTryPct}%` : 'Chưa có DL';
    const boost = tested > 0 ? `${sData!.finalPct}%` : 'Chưa có DL';
    const inc = tested > 0 ? `+${sData!.progressPct}% pp` : '—';

    worksheet.mergeCells(`A${rNum}:B${rNum}`);
    worksheet.getCell(`A${rNum}`).value = `${cDef.num}. ${cDef.key}`;
    worksheet.getCell(`A${rNum}`).alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.mergeCells(`C${rNum}:E${rNum}`);
    worksheet.getCell(`C${rNum}`).value = cDef.name;
    worksheet.getCell(`C${rNum}`).font = { bold: true };
    worksheet.getCell(`C${rNum}`).alignment = { vertical: 'middle', horizontal: 'left' };

    worksheet.mergeCells(`F${rNum}:I${rNum}`);
    worksheet.getCell(`F${rNum}`).value = cDef.req;
    worksheet.getCell(`F${rNum}`).alignment = { vertical: 'middle', horizontal: 'left' };

    worksheet.mergeCells(`J${rNum}:K${rNum}`);
    worksheet.getCell(`J${rNum}`).value = tested > 0 ? `${tested} câu` : '0 câu';
    worksheet.getCell(`J${rNum}`).alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.mergeCells(`L${rNum}:M${rNum}`);
    worksheet.getCell(`L${rNum}`).value = base;
    worksheet.getCell(`L${rNum}`).alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.mergeCells(`N${rNum}:O${rNum}`);
    worksheet.getCell(`N${rNum}`).value = boost;
    worksheet.getCell(`N${rNum}`).font = { bold: true, color: { argb: 'FF059669' } };
    worksheet.getCell(`N${rNum}`).alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.getCell(`P${rNum}`).value = inc;
    worksheet.getCell(`P${rNum}`).font = { bold: true, color: { argb: 'FF7C3AED' } };
    worksheet.getCell(`P${rNum}`).alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.getRow(rNum).height = 22;
  });

  // Section 3 Header (Row 18)
  worksheet.mergeCells('A18:Q18');
  const s3Header = worksheet.getCell('A18');
  s3Header.value = 'III. DANH SÁCH CHI TIẾT TỪNG LƯỢT LÀM BÀI CỦA HỌC SINH';
  s3Header.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  s3Header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } }; // Purple-600
  s3Header.alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(18).height = 24;

  // Table Column Headers (Row 19)
  const detailHeaders = [
    'STT',
    'Mã học sinh',
    'Biệt danh',
    'Lớp',
    'Khối',
    'Năm học',
    'Học kỳ',
    'Bài được giao',
    'Lượt',
    'Đúng lần đầu',
    'Đúng sau gợi ý',
    'Điểm lần đầu (thang 10)',
    'Điểm sau gợi ý (thang 10)',
    'Tiến bộ (+câu / +% pp)',
    'Số sao',
    'Thời gian hoàn thành (Giờ VN)',
    'Kiểm toán niên khóa'
  ];

  const row19 = worksheet.getRow(19);
  row19.values = detailHeaders;
  row19.height = 26;
  row19.font = { bold: true, size: 10, color: { argb: 'FF1E293B' } };
  row19.alignment = { vertical: 'middle', horizontal: 'center' };
  for (let c = 1; c <= 17; c++) {
    worksheet.getCell(19, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE9FE' } }; // Purple-100
  }

  // Populate data rows with formula injection protection
  params.records.forEach((r, idx) => {
    const totalQ = r.totalQuestions || 5;
    const firstTry = r.firstTryCorrectCount || 0;
    const finalVal = r.finalCorrectCount || 0;
    const progress = Math.max(0, finalVal - firstTry);
    const progressPP = Number(((progress / totalQ) * 100).toFixed(1));
    const firstScore = r.firstTryScore ?? Number(((firstTry / totalQ) * 10).toFixed(1));
    const finalScore = r.finalScore ?? Number(((finalVal / totalQ) * 10).toFixed(1));
    const progressLabel = progress > 0 ? `+${progress} câu (+${progressPP}% pp)` : '0 câu';

    const vnCompletedStr = r.completedAt
      ? new Date(r.completedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
      : '—';
    const auditStatus = r.isDateAnomalous
      ? `⚠️ Lệch niên khóa (Làm ngày ${new Date(r.completedAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} thuộc NH ${r.inferredAcademicYear || '2026-2027'})`
      : '✅ Hợp lệ';

    const row = worksheet.addRow({
      c1: idx + 1,
      c2: sanitizeCellText(r.studentCode || 'N/A'),
      c3: sanitizeCellText(r.displayAlias || 'Ẩn danh'),
      c4: sanitizeCellText(r.className || 'N/A'),
      c5: r.grade ? `Khối ${r.grade}` : 'N/A',
      c6: sanitizeCellText(r.academicYear || '2026-2027'),
      c7: sanitizeCellText(r.semesterLabel || (r.semester === 2 ? 'Học kỳ II' : 'Học kỳ I')),
      c8: sanitizeCellText(r.lessonTitle || 'N/A'),
      c9: `#${r.attemptNumber || 1}`,
      c10: `${firstTry}/${totalQ}`,
      c11: `${finalVal}/${totalQ}`,
      c12: firstScore,
      c13: finalScore,
      c14: progressLabel,
      c15: `${r.starsEarned || 0} ⭐`,
      c16: vnCompletedStr,
      c17: auditStatus
    });

    row.height = 22;
    row.alignment = { vertical: 'middle' };
    row.getCell('c1').alignment = { horizontal: 'center' };
    row.getCell('c2').alignment = { horizontal: 'center' };
    row.getCell('c5').alignment = { horizontal: 'center' };
    row.getCell('c6').alignment = { horizontal: 'center' };
    row.getCell('c7').alignment = { horizontal: 'center' };
    row.getCell('c9').alignment = { horizontal: 'center' };
    row.getCell('c10').alignment = { horizontal: 'center' };
    row.getCell('c11').alignment = { horizontal: 'center' };
    row.getCell('c12').alignment = { horizontal: 'center' };
    row.getCell('c13').alignment = { horizontal: 'center' };
    row.getCell('c14').alignment = { horizontal: 'center' };
    row.getCell('c15').alignment = { horizontal: 'center' };
    row.getCell('c16').alignment = { horizontal: 'center' };
    row.getCell('c17').alignment = { horizontal: 'center' };

    row.getCell('c11').font = { bold: true, color: { argb: 'FF059669' } };
    row.getCell('c12').font = { bold: true, color: { argb: 'FF0284C7' } };
    row.getCell('c14').font = { bold: true, color: { argb: 'FF7C3AED' } };

    if (r.isDateAnomalous) {
      row.getCell('c17').font = { bold: true, color: { argb: 'FFD97706' } }; // Amber-600
    } else {
      row.getCell('c17').font = { color: { argb: 'FF059669' } }; // Emerald-600
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const safeName = String(params.className).replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, '_');
  downloadBlob(buffer, `Bao_cao_doc_hieu_${safeName}_${params.academicYear}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}


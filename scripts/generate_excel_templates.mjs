import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateTemplates() {
  // 1. Template for Students (mau_nhap_hoc_sinh.xlsx)
  const studentWb = new ExcelJS.Workbook();
  studentWb.creator = 'EM YÊU TIẾNG VIỆT';
  const wsStudents = studentWb.addWorksheet('DanhSachHocSinh');

  wsStudents.columns = [
    { header: 'Mã học sinh (*)', key: 'studentCode', width: 20 },
    { header: 'Tên gọi / Biệt danh (*)', key: 'displayAlias', width: 28 },
    { header: 'Mã lớp (*)', key: 'classCode', width: 18 },
    { header: 'Năm học', key: 'academicYear', width: 18 }
  ];

  // Header style
  const headerRow1 = wsStudents.getRow(1);
  headerRow1.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow1.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0284C7' } // Sky-600
  };
  headerRow1.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow1.height = 24;

  const sampleStudents = [
    { studentCode: 'HS2A-01', displayAlias: 'Bảo Nam', classCode: 'L2A-2026', academicYear: '2025-2026' },
    { studentCode: 'HS2A-02', displayAlias: 'Linh Chi', classCode: 'L2A-2026', academicYear: '2025-2026' },
    { studentCode: 'HS2A-03', displayAlias: 'Minh Khôi', classCode: 'L2A-2026', academicYear: '2025-2026' },
    { studentCode: 'HS2A-04', displayAlias: 'Phương Thảo', classCode: 'L2A-2026', academicYear: '2025-2026' },
    { studentCode: 'HS2A-05', displayAlias: 'Đức Huy', classCode: 'L2A-2026', academicYear: '2025-2026' }
  ];

  sampleStudents.forEach((s) => wsStudents.addRow(s));

  const studentOutPath = path.resolve(__dirname, '../web/public/mau_nhap_hoc_sinh.xlsx');
  await studentWb.xlsx.writeFile(studentOutPath);
  console.log('Successfully generated student Excel template (ExcelJS) at:', studentOutPath);

  // 2. Template for Teachers (mau_nhap_giao_vien.xlsx)
  // SECURITY REQUIREMENT: No plaintext password column!
  const teacherWb = new ExcelJS.Workbook();
  teacherWb.creator = 'EM YÊU TIẾNG VIỆT';
  const wsTeachers = teacherWb.addWorksheet('DanhSachGiaoVien');

  wsTeachers.columns = [
    { header: 'Email công vụ (*)', key: 'email', width: 40 },
    { header: 'Họ và tên giáo viên (*)', key: 'displayName', width: 30 },
    { header: 'Số điện thoại liên hệ', key: 'phone', width: 22 },
    { header: 'Trạng thái (active/suspended)', key: 'status', width: 28 }
  ];

  const headerRow2 = wsTeachers.getRow(1);
  headerRow2.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow2.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF059669' } // Emerald-600
  };
  headerRow2.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow2.height = 24;

  const sampleTeachers = [
    { email: 'co.maiphuong@truongtieuhochanoi.edu.vn', displayName: 'Cô Nguyễn Mai Phương', phone: '0912345678', status: 'active' },
    { email: 'thay.hoanghai@truongtieuhochanoi.edu.vn', displayName: 'Thầy Lê Hoàng Hải', phone: '0987654321', status: 'active' },
    { email: 'co.thuhuong@truongtieuhochanoi.edu.vn', displayName: 'Cô Vũ Thu Hương', phone: '', status: 'active' }
  ];

  sampleTeachers.forEach((t) => wsTeachers.addRow(t));

  const teacherOutPath = path.resolve(__dirname, '../web/public/mau_nhap_giao_vien.xlsx');
  await teacherWb.xlsx.writeFile(teacherOutPath);
  console.log('Successfully generated teacher Excel template (ExcelJS) at:', teacherOutPath);
}

generateTemplates().catch(console.error);

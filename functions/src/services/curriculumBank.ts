import {
  CurriculumNode,
  CurriculumNodeSchema,
  CurriculumGrade,
  BookVolume,
  ActivityType
} from '@emytv/shared';

// Pre-verified GDPT 2018 Curriculum Framework for "Kết nối tri thức với cuộc sống"
export const VERIFIED_CURRICULUM_NODES: CurriculumNode[] = [
  // LỚP 1
  {
    id: 'kntt-g1-w01-d1',
    bookSeries: 'ket_noi_tri_thuc',
    grade: 1,
    volume: 1,
    theme: 'Tôi là học sinh',
    week: 1,
    lessonTitle: 'Bài 1: A, a - B, b (Làm quen với chữ cái)',
    activityType: 'doc',
    competencyGoals: [
      'Nhận biết và phát âm đúng âm a, b',
      'Đọc đúng các tiếng, từ ngữ đơn giản chứa a, b',
      'Bước đầu nhận biết tư thế ngồi đọc, cầm sách đúng cách'
    ],
    suggestedPassageTopic: 'Ngày đầu tiên đến trường',
    sampleVocabulary: ['ba', 'bà', 'ba ba'],
    referenceSource: 'SGK Tiếng Việt 1, Tập 1, tr. 12 - NXB Giáo dục Việt Nam (CT GDPT 2018)',
    verificationStatus: 'verified',
    dataVersion: '2018.v1',
    createdAt: 1700000000000
  },
  {
    id: 'kntt-g1-w10-d2',
    bookSeries: 'ket_noi_tri_thuc',
    grade: 1,
    volume: 1,
    theme: 'Mái ấm gia đình',
    week: 10,
    lessonTitle: 'Bài 45: Ôn tập và kể chuyện gia đình',
    activityType: 'noi_va_nghe',
    competencyGoals: [
      'Nói rõ ràng 1-2 câu về người thân trong gia đình',
      'Biết lắng nghe thầy cô và bạn bè kể chuyện'
    ],
    suggestedPassageTopic: 'Bữa cơm sum họp gia đình',
    sampleVocabulary: ['ông bà', 'cha mẹ', 'yêu thương'],
    referenceSource: 'SGK Tiếng Việt 1, Tập 1, tr. 98 - NXB Giáo dục Việt Nam (CT GDPT 2018)',
    verificationStatus: 'verified',
    dataVersion: '2018.v1',
    createdAt: 1700000000000
  },

  // LỚP 2
  {
    id: 'kntt-g2-w01-d1',
    bookSeries: 'ket_noi_tri_thuc',
    grade: 2,
    volume: 1,
    theme: 'Em lớn lên từng ngày',
    week: 1,
    lessonTitle: 'Bài 1: Tôi là học sinh lớp 2',
    activityType: 'doc',
    competencyGoals: [
      'Đọc đúng và rõ ràng bài đọc văn bản tự sự 100-130 từ',
      'Tìm được chi tiết trực tiếp về cảm xúc của bạn nhỏ ngày khai giảng',
      'Nhận biết từ ngữ chỉ sự vật, hoạt động của học sinh'
    ],
    suggestedPassageTopic: 'Cảm xúc ngày tựu trường lớp 2',
    sampleVocabulary: ['náo nức', 'chững chạc', 'khai trường'],
    referenceSource: 'SGK Tiếng Việt 2, Tập 1, tr. 10 - NXB Giáo dục Việt Nam (CT GDPT 2018)',
    verificationStatus: 'verified',
    dataVersion: '2018.v1',
    createdAt: 1700000000000
  },
  {
    id: 'kntt-g2-w04-d2',
    bookSeries: 'ket_noi_tri_thuc',
    grade: 2,
    volume: 1,
    theme: 'Đi học vui sao',
    week: 4,
    lessonTitle: 'Bài 8: Cầu thủ dự bị',
    activityType: 'doc',
    competencyGoals: [
      'Hiểu trình tự diễn biến câu chuyện (sắp xếp 3 sự việc chính)',
      'Hiểu ý nghĩa của sự kiên trì, tinh thần đồng đội',
      'Phát triển năng lực đọc hiểu văn bản tự sự lứa tuổi 7-8 tuổi'
    ],
    suggestedPassageTopic: 'Hoạt động thể thao và tình bạn',
    sampleVocabulary: ['dự bị', 'hăng hái', 'tiến bộ'],
    referenceSource: 'SGK Tiếng Việt 2, Tập 1, tr. 36 - NXB Giáo dục Việt Nam (CT GDPT 2018)',
    verificationStatus: 'verified',
    dataVersion: '2018.v1',
    createdAt: 1700000000000
  },
  {
    id: 'kntt-g2-w12-d3',
    bookSeries: 'ket_noi_tri_thuc',
    grade: 2,
    volume: 1,
    theme: 'Mái ấm gia đình',
    week: 12,
    lessonTitle: 'Bài 23: Chăm sóc cây xanh quanh nhà',
    activityType: 'doc',
    competencyGoals: [
      'Tìm thông tin chi tiết về các bước chăm sóc cây (tưới nước, bắt sâu, nhặt lá úa)',
      'Nhận biết từ chỉ hoạt động chăm sóc',
      'Liên hệ bản thân về việc bảo vệ môi trường sống'
    ],
    suggestedPassageTopic: 'Chăm sóc cây xanh',
    sampleVocabulary: ['chu đáo', 'tươi tốt', 'xanh mướt'],
    referenceSource: 'SGK Tiếng Việt 2, Tập 1, tr. 102 - NXB Giáo dục Việt Nam (CT GDPT 2018)',
    verificationStatus: 'verified',
    dataVersion: '2018.v1',
    createdAt: 1700000000000
  },

  // LỚP 3
  {
    id: 'kntt-g3-w01-d1',
    bookSeries: 'ket_noi_tri_thuc',
    grade: 3,
    volume: 1,
    theme: 'Những trải nghiệm thú vị',
    week: 1,
    lessonTitle: 'Bài 1: Ngày gặp lại',
    activityType: 'doc',
    competencyGoals: [
      'Đọc hiểu bài văn tự sự khoảng 150-180 từ',
      'Tìm ý chính của từng đoạn và toàn bài',
      'Nhận biết biện pháp so sánh đơn giản'
    ],
    suggestedPassageTopic: 'Kỷ niệm mùa hè và ngày gặp lại bạn bè',
    sampleVocabulary: ['rộn rã', 'lưu luyến', 'trải nghiệm'],
    referenceSource: 'SGK Tiếng Việt 3, Tập 1, tr. 10 - NXB Giáo dục Việt Nam (CT GDPT 2018)',
    verificationStatus: 'verified',
    dataVersion: '2018.v1',
    createdAt: 1700000000000
  },
  {
    id: 'kntt-g3-w15-d2',
    bookSeries: 'ket_noi_tri_thuc',
    grade: 3,
    volume: 1,
    theme: 'Bầu trời tuổi thơ',
    week: 15,
    lessonTitle: 'Bài 29: Giọt nước nhỏ và nguồn nước sạch',
    activityType: 'doc',
    competencyGoals: [
      'Nắm nội dung văn bản thông tin 160-200 từ',
      'Xác định vai trò của nước sạch và các biện pháp tiết kiệm nước',
      'Không nhân hóa phi khoa học, ghi nhận số liệu và hiện tượng thực tế'
    ],
    suggestedPassageTopic: 'Bảo vệ nguồn nước sạch',
    sampleVocabulary: ['tài nguyên', 'khan hiếm', 'bảo tồn'],
    referenceSource: 'SGK Tiếng Việt 3, Tập 1, tr. 128 - NXB Giáo dục Việt Nam (CT GDPT 2018)',
    verificationStatus: 'verified',
    dataVersion: '2018.v1',
    createdAt: 1700000000000
  },

  // LỚP 4
  {
    id: 'kntt-g4-w01-d1',
    bookSeries: 'ket_noi_tri_thuc',
    grade: 4,
    volume: 1,
    theme: 'Mỗi người một vẻ',
    week: 1,
    lessonTitle: 'Bài 1: Điều kì diệu',
    activityType: 'doc',
    competencyGoals: [
      'Đọc diễn cảm bài thơ/văn xuôi 220-250 từ',
      'Hiểu đặc điểm riêng của mỗi cá nhân và tôn trọng sự khác biệt',
      'Nhận diện danh từ, động từ, tính từ trong câu'
    ],
    suggestedPassageTopic: 'Sự đa dạng và nét riêng của mỗi người',
    sampleVocabulary: ['kì diệu', 'nét riêng', 'hòa đồng'],
    referenceSource: 'SGK Tiếng Việt 4, Tập 1, tr. 8 - NXB Giáo dục Việt Nam (CT GDPT 2018)',
    verificationStatus: 'verified',
    dataVersion: '2018.v1',
    createdAt: 1700000000000
  },
  {
    id: 'kntt-g4-w18-d2',
    bookSeries: 'ket_noi_tri_thuc',
    grade: 4,
    volume: 2,
    theme: 'Chắp cánh ước mơ',
    week: 18,
    lessonTitle: 'Bài 15: Người thợ gốm nhỏ tuổi',
    activityType: 'doc',
    competencyGoals: [
      'Đọc hiểu văn bản miêu tả quy trình sản xuất thủ công truyền thống',
      'Xác định bố cục và trình tự thao tác nghệ thuật',
      'Viết đoạn văn ngắn nêu cảm nghĩ về bàn tay khéo léo của người thợ'
    ],
    suggestedPassageTopic: 'Làng nghề truyền thống Việt Nam',
    sampleVocabulary: ['tinh xảo', 'bàn xoay', 'nung men'],
    referenceSource: 'SGK Tiếng Việt 4, Tập 2, tr. 14 - NXB Giáo dục Việt Nam (CT GDPT 2018)',
    verificationStatus: 'verified',
    dataVersion: '2018.v1',
    createdAt: 1700000000000
  },

  // LỚP 5
  {
    id: 'kntt-g5-w01-d1',
    bookSeries: 'ket_noi_tri_thuc',
    grade: 5,
    volume: 1,
    theme: 'Thế giới tuổi thơ',
    week: 1,
    lessonTitle: 'Bài 1: Thanh âm của gió',
    activityType: 'doc',
    competencyGoals: [
      'Đọc hiểu văn bản văn học giàu hình ảnh (khoảng 280-320 từ)',
      'Cảm nhận vẻ đẹp thiên nhiên và tình cảm gắn bó với quê hương',
      'Phân tích tác dụng của từ đồng nghĩa và điệp từ trong ngữ cảnh'
    ],
    suggestedPassageTopic: 'Âm thanh đồng quê và tình yêu đất nước',
    sampleVocabulary: ['thanh âm', 'vi vu', 'man mác'],
    referenceSource: 'SGK Tiếng Việt 5, Tập 1, tr. 10 - NXB Giáo dục Việt Nam (CT GDPT 2018)',
    verificationStatus: 'verified',
    dataVersion: '2018.v1',
    createdAt: 1700000000000
  },
  {
    id: 'kntt-g5-w20-d2',
    bookSeries: 'ket_noi_tri_thuc',
    grade: 5,
    volume: 2,
    theme: 'Tiếng chuông hòa bình',
    week: 20,
    lessonTitle: 'Bài 17: Những cánh chim hòa bình',
    activityType: 'doc',
    competencyGoals: [
      'Đọc hiểu văn bản nghị luận xã hội đơn giản (khoảng 300-350 từ)',
      'Nêu được luận điểm chính và các dẫn chứng thực tế',
      'Liên hệ trách nhiệm của học sinh trong việc xây dựng tình hữu nghị quốc tế'
    ],
    suggestedPassageTopic: 'Tình hữu nghị và khát vọng hòa bình',
    sampleVocabulary: ['hữu nghị', 'khát vọng', 'chung tay'],
    referenceSource: 'SGK Tiếng Việt 5, Tập 2, tr. 32 - NXB Giáo dục Việt Nam (CT GDPT 2018)',
    verificationStatus: 'verified',
    dataVersion: '2018.v1',
    createdAt: 1700000000000
  }
];

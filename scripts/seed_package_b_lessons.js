const admin = require('firebase-admin');

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'em-yeu-tieng-viet-demo' });
}

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

// 10 EXISTING LESSONS METADATA ENRICHMENT (GRADE 2 HK1 & GRADE 3 HK1)
const EXISTING_LESSONS_UPDATE = {
  lesson_g2_01: {
    semester: 1,
    week: 14,
    genre: 'narrative',
    curriculumRequirement: 'Nhận biết chi tiết trực tiếp trong câu chuyện về ích lợi của loài chim; hiểu ý nghĩa của sự chăm chỉ và bảo vệ cây trồng.',
    source: 'ai_curriculum_aligned',
    referenceSource: 'Học liệu đọc hiểu mô phỏng CT GDPT 2018 (Phỏng theo SGK Tiếng Việt 2, Tập 1, tr. 84 - NXB Giáo dục Việt Nam)',
    verificationStatus: 'ai_curriculum_aligned',
    approvedBy: 'Cô giáo Mai Phương (Giáo viên chính)',
    approvedAt: 1700000000000
  },
  lesson_g2_02: {
    semester: 1,
    week: 5,
    genre: 'narrative',
    curriculumRequirement: 'Tìm thông tin trực tiếp về tình bạn giữa Cún Con và Mèo Vàng; nhận biết từ ngữ chỉ hành động giúp đỡ nhau.',
    source: 'ai_curriculum_aligned',
    referenceSource: 'Học liệu đọc hiểu mô phỏng CT GDPT 2018 (Phỏng theo chủ điểm Bạn bè của em - SGK Tiếng Việt 2, Tập 1, tr. 32)',
    verificationStatus: 'ai_curriculum_aligned',
    approvedBy: 'Cô giáo Mai Phương (Giáo viên chính)',
    approvedAt: 1700000000000
  },
  lesson_g2_03: {
    semester: 1,
    week: 16,
    genre: 'descriptive',
    curriculumRequirement: 'Nhận diện vẻ đẹp trong mát của dòng suối quê hương; hiểu từ ngữ gợi tả âm thanh, màu sắc; bồi dưỡng tình yêu thiên nhiên.',
    source: 'ai_curriculum_aligned',
    referenceSource: 'Học liệu đọc hiểu mô phỏng CT GDPT 2018 (Phỏng theo chủ điểm Quê hương em - SGK Tiếng Việt 2, Tập 1, tr. 110)',
    verificationStatus: 'ai_curriculum_aligned',
    approvedBy: 'Cô giáo Mai Phương (Giáo viên chính)',
    approvedAt: 1700000000000
  },
  lesson_g2_04: {
    semester: 1,
    week: 2,
    genre: 'descriptive',
    curriculumRequirement: 'Đọc hiểu các chi tiết miêu tả sự thay đổi của cây bàng qua bốn mùa; hiểu tình cảm gắn bó của học sinh với mái trường.',
    source: 'ai_curriculum_aligned',
    referenceSource: 'Học liệu đọc hiểu mô phỏng CT GDPT 2018 (Phỏng theo chủ điểm Mái trường em yêu - SGK Tiếng Việt 2, Tập 1, tr. 18)',
    verificationStatus: 'ai_curriculum_aligned',
    approvedBy: 'Cô giáo Mai Phương (Giáo viên chính)',
    approvedAt: 1700000000000
  },
  lesson_g2_05: {
    semester: 1,
    week: 9,
    genre: 'narrative',
    curriculumRequirement: 'Hiểu ý nghĩa của tình bạn chân thành; nhận biết bài học về sự sẻ chia và biết quý trọng món quà tự tay bạn làm.',
    source: 'ai_curriculum_aligned',
    referenceSource: 'Học liệu đọc hiểu mô phỏng CT GDPT 2018 (Phỏng theo chủ điểm Bài học sẻ chia - SGK Tiếng Việt 2, Tập 1, tr. 56)',
    verificationStatus: 'ai_curriculum_aligned',
    approvedBy: 'Cô giáo Mai Phương (Giáo viên chính)',
    approvedAt: 1700000000000
  },
  lesson_g3_01: {
    semester: 1,
    week: 7,
    genre: 'informational',
    curriculumRequirement: 'Hiểu nét đẹp văn hóa làm cốm của làng Vòng; giải nghĩa từ ngữ về mùa thu Hà Nội; bồi dưỡng lòng tự hào văn hóa truyền thống.',
    source: 'ai_curriculum_aligned',
    referenceSource: 'Học liệu đọc hiểu mô phỏng CT GDPT 2018 (Phỏng theo chủ điểm Mùa thu quê em - SGK Tiếng Việt 3, Tập 1, tr. 48)',
    verificationStatus: 'ai_curriculum_aligned',
    approvedBy: 'Cô giáo Mai Phương (Giáo viên chính)',
    approvedAt: 1700000000000
  },
  lesson_g3_02: {
    semester: 1,
    week: 11,
    genre: 'narrative',
    curriculumRequirement: 'Sắp xếp các sự việc trong hành trình khám phá thế giới của Kiến Đen; nhận biết bài học về lòng dũng cảm và sức mạnh đoàn kết.',
    source: 'ai_curriculum_aligned',
    referenceSource: 'Học liệu đọc hiểu mô phỏng CT GDPT 2018 (Phỏng theo chủ điểm Thế giới loài vật - SGK Tiếng Việt 3, Tập 1, tr. 78)',
    verificationStatus: 'ai_curriculum_aligned',
    approvedBy: 'Cô giáo Mai Phương (Giáo viên chính)',
    approvedAt: 1700000000000
  },
  lesson_g3_03: {
    semester: 1,
    week: 3,
    genre: 'narrative',
    curriculumRequirement: 'Tìm thông tin trực tiếp về bài học lao động ông dạy cho cháu; hiểu nghĩa ẩn dụ của từ "kho báu" (giá trị của sức lao động).',
    source: 'ai_curriculum_aligned',
    referenceSource: 'Học liệu đọc hiểu mô phỏng CT GDPT 2018 (Phỏng theo chủ điểm Mái ấm gia đình - SGK Tiếng Việt 3, Tập 1, tr. 24)',
    verificationStatus: 'ai_curriculum_aligned',
    approvedBy: 'Cô giáo Mai Phương (Giáo viên chính)',
    approvedAt: 1700000000000
  },
  lesson_g3_04: {
    semester: 1,
    week: 15,
    genre: 'informational',
    curriculumRequirement: 'Nắm được nhiệm vụ của ngọn hải đăng và những người lính đảo; hiểu từ ngữ chỉ sự kiên trung, bền bỉ giữa sóng gió.',
    source: 'ai_curriculum_aligned',
    referenceSource: 'Học liệu đọc hiểu mô phỏng CT GDPT 2018 (Phỏng theo chủ điểm Biển đảo quê hương - SGK Tiếng Việt 3, Tập 1, tr. 116)',
    verificationStatus: 'ai_curriculum_aligned',
    approvedBy: 'Cô giáo Mai Phương (Giáo viên chính)',
    approvedAt: 1700000000000
  },
  lesson_g3_05: {
    semester: 1,
    week: 9,
    genre: 'narrative',
    curriculumRequirement: 'Hiểu nội dung chính về sự nỗ lực vượt qua mùa đông giá rét của hạt dẻ non để trở thành cây thông xanh tươi; học bài học kiên trì.',
    source: 'ai_curriculum_aligned',
    referenceSource: 'Học liệu đọc hiểu mô phỏng CT GDPT 2018 (Phỏng theo chủ điểm Ý chí & Kiên trì - SGK Tiếng Việt 3, Tập 1, tr. 62)',
    verificationStatus: 'ai_curriculum_aligned',
    approvedBy: 'Cô giáo Mai Phương (Giáo viên chính)',
    approvedAt: 1700000000000
  }
};

// 10 NEW LESSONS: 5 FOR GRADE 2 SEMESTER 2 & 5 FOR GRADE 3 SEMESTER 2
const NEW_LESSONS = [
  // ----------------------------------------------------
  // LỚP 2 - HỌC KỲ II: BÀI 6 ĐẾN BÀI 10
  // ----------------------------------------------------
  {
    id: 'lesson_g2_06',
    title: 'Mùa xuân trong vườn bà',
    grade: 2,
    semester: 2,
    week: 19,
    topic: 'Sắc màu quê hương',
    genre: 'descriptive',
    curriculumRequirement: 'Đọc đúng, rõ ràng văn bản 110-140 từ; tìm được chi tiết trực tiếp về hoa trái mùa xuân; hiểu tình cảm của bạn nhỏ dành cho bà.',
    source: 'ai_curriculum_aligned',
    referenceSource: 'Học liệu đọc hiểu mô phỏng CT GDPT 2018 (Bám sát chủ điểm Sắc màu quê hương - SGK Tiếng Việt 2, Tập 2, tr. 10 - NXB Giáo dục Việt Nam)',
    verificationStatus: 'ai_curriculum_aligned',
    passage: `Mùa xuân đã về trên khắp khu vườn của bà. Những giọt sương sớm long lanh đọng trên từng búp lá non xanh biếc.
Cây đào trước ngõ nở rộ những cánh hoa phớt hồng đón chào năm mới. Dưới gốc bưởi, đàn gà con lông vàng óng như những cục tơ tròn đang lon ton tìm giun bên mẹ.
Bé Mai cầm chiếc bình nhỏ xinh xắn tưới nước cho mấy luống hoa cúc vàng. Bà nhìn Mai mỉm cười hiền từ: "Cháu gái của bà giỏi quá, cây cối có bàn tay chăm sóc sẽ lớn nhanh lắm đấy!".
Mai cảm thấy lòng vui sướng ngập tràn vì đã làm được việc tốt giúp bà đón mùa xuân.`,
    vocabulary: [
      { word: 'long lanh', meaning: 'Có ánh sáng lấp lánh phản chiếu, trong suốt và đẹp mắt.', example: 'Giọt sương long lanh trên cành lá.' },
      { word: 'lon ton', meaning: 'Dáng đi hoặc chạy nhanh với những bước chân ngắn của trẻ nhỏ hoặc con non.', example: 'Đàn gà con chạy lon ton sau mẹ.' },
      { word: 'xinh xắn', meaning: 'Nhỏ nhắn và ưa nhìn, gây cảm giác dễ thương.', example: 'Chiếc bình tưới cây trông thật xinh xắn.' }
    ],
    questions: [
      {
        id: 'g2_06_q1',
        type: 'multiple_choice',
        prompt: 'Cây đào trước ngõ nở những cánh hoa màu gì để đón năm mới?',
        options: ['Màu đỏ thắm', 'Màu phớt hồng', 'Màu vàng rực'],
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        relatedPassagePart: 'Cây đào trước ngõ nở rộ những cánh hoa phớt hồng đón chào năm mới.',
        answer: 'B',
        hint: 'Em hãy đọc lại đoạn 2 để xem màu sắc của cánh hoa đào nhé.',
        explanation: 'Trong bài có câu: "Cây đào trước ngõ nở rộ những cánh hoa phớt hồng đón chào năm mới." Do đó B là đáp án đúng.'
      },
      {
        id: 'g2_06_q2',
        type: 'true_false',
        prompt: 'Nhận định sau đây Đúng hay Sai: "Bé Mai cầm bình tưới nước cho những luống hoa cúc vàng giúp bà."',
        statement: 'Bé Mai cầm bình tưới nước cho những luống hoa cúc vàng giúp bà.',
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        relatedPassagePart: 'Bé Mai cầm chiếc bình nhỏ xinh xắn tưới nước cho mấy luống hoa cúc vàng.',
        answer: true,
        hint: 'Em hãy xem bé Mai làm việc gì trong vườn giúp bà.',
        explanation: 'Bài đọc viết: "Bé Mai cầm chiếc bình nhỏ xinh xắn tưới nước cho mấy luống hoa cúc vàng." Nhận định này là Đúng.'
      },
      {
        id: 'g2_06_q3',
        type: 'multiple_choice',
        prompt: 'Từ "lon ton" trong bài đọc gợi tả điều gì về đàn gà con?',
        options: ['Tiếng kêu to đòi ăn', 'Những bước chạy ngắn, nhanh nhẹn và đáng yêu', 'Dáng đứng yên bất động một chỗ'],
        skillTag: 'tu_trong_ngu_canh',
        difficulty: 'thong_hieu',
        relatedPassagePart: 'đàn gà con lông vàng óng như những cục tơ tròn đang lon ton tìm giun bên mẹ.',
        answer: 'B',
        hint: '"Lon ton" là từ gợi tả bước đi, bước chạy của các con vật nhỏ hoặc em bé.',
        explanation: '"Lon ton" diễn tả những bước chân ngắn, bước nhanh thoăn thoắt rất dễ thương của đàn gà con.'
      },
      {
        id: 'g2_06_q4',
        type: 'sequence',
        prompt: 'Em hãy sắp xếp 3 sự việc sau theo đúng thứ tự trong bài đọc:',
        items: [
          'Khu vườn của bà bừng sáng với hoa đào và đàn gà con tìm mồi.',
          'Bé Mai lấy bình nhỏ chăm sóc và tưới nước cho luống hoa cúc.',
          'Bà khen ngợi khiến Mai cảm thấy vui sướng đón mùa xuân.'
        ],
        skillTag: 'sap_xep_trinh_tu',
        difficulty: 'thong_hieu',
        answer: [
          'Khu vườn của bà bừng sáng với hoa đào và đàn gà con tìm mồi.',
          'Bé Mai lấy bình nhỏ chăm sóc và tưới nước cho luống hoa cúc.',
          'Bà khen ngợi khiến Mai cảm thấy vui sướng đón mùa xuân.'
        ],
        hint: 'Em xem cảnh vật trong vườn xuất hiện đầu tiên, sau đó đến việc làm của Mai và lời khen của bà.',
        explanation: 'Thứ tự diễn biến: (1) Cảnh khu vườn ngày xuân -> (2) Mai tưới hoa cúc vàng -> (3) Bà khen và Mai thấy vui sướng.'
      },
      {
        id: 'g2_06_q5',
        type: 'multiple_choice',
        prompt: 'Bài đọc muốn nhắn nhủ điều gì đến các em học sinh?',
        options: ['Nên ngủ thật nhiều trong những ngày nghỉ tết', 'Biết yêu thiên nhiên và giúp đỡ ông bà bằng những việc làm vừa sức', 'Chỉ cần ngắm hoa chứ không nên chăm sóc cây cối'],
        skillTag: 'noi_dung_chinh',
        difficulty: 'van_dung',
        relatedPassagePart: 'Mai cảm thấy lòng vui sướng ngập tràn vì đã làm được việc tốt giúp bà...',
        answer: 'B',
        hint: 'Việc bé Mai tưới cây giúp bà thể hiện điều tốt đẹp gì?',
        explanation: 'Bài đọc khuyến khích học sinh biết yêu quý thiên nhiên và làm những việc nhỏ vừa sức để giúp đỡ người thân trong gia đình.'
      }
    ]
  },

  {
    id: 'lesson_g2_07',
    title: 'Chú ong chăm chỉ đón hoa xuân',
    grade: 2,
    semester: 2,
    week: 23,
    topic: 'Hành tinh xanh của em',
    genre: 'narrative',
    curriculumRequirement: 'Nắm trình tự công việc hút mật của chú ong; hiểu từ ngữ chỉ phẩm chất chăm chỉ, đoàn kết; liên hệ bản thân chăm ngoan học tập.',
    source: 'ai_curriculum_aligned',
    referenceSource: 'Học liệu đọc hiểu mô phỏng CT GDPT 2018 (Bám sát chủ điểm Hành tinh xanh của em - SGK Tiếng Việt 2, Tập 2, tr. 42)',
    verificationStatus: 'ai_curriculum_aligned',
    passage: `Khi mặt trời vừa hé rạng, chú Ong Vàng đã thức giấc, sửa soạn đôi cánh mỏng trong suốt để bắt đầu một ngày mới.
Hôm nay, Ong Vàng cùng các bạn bay đến vườn hoa táo trắng muốt ven đồi. Chú lượn quanh từng nụ hoa e ấp, khẽ nghiêng mình hút từng giọt mật thơm lành. Đôi chân chú bám đầy những hạt phấn hoa vàng rực.
Dù đôi cánh đã mỏi sau nhiều giờ bay lượn, Ong Vàng vẫn kiên trì thu nhặt mật ngọt mang về tổ. Chú hiểu rằng mỗi giọt mật hôm nay đều góp phần làm cho mùa xuân của cả bầy ong thêm ấm no, ngọt ngào.`,
    vocabulary: [
      { word: 'hé rạng', meaning: 'Vừa mới bắt đầu toả sáng mờ mờ ở phía chân trời buổi sớm.', example: 'Bình minh vừa hé rạng nơi phương đông.' },
      { word: 'e ấp', meaning: 'Có vẻ ngượng ngùng, rụt rè hoặc chưa nở bung hoàn toàn.', example: 'Những nụ hoa hồng e ấp trong sương.' },
      { word: 'kiên trì', meaning: 'Giữ vững ý chí, quyết tâm làm đến cùng dù gặp khó khăn.', example: 'Ong Vàng kiên trì làm việc suốt buổi sáng.' }
    ],
    questions: [
      {
        id: 'g2_07_q1',
        type: 'multiple_choice',
        prompt: 'Ong Vàng và các bạn bay đến đâu để tìm mật ngọt?',
        options: ['Vườn hoa táo trắng muốt ven đồi', 'Cánh đồng lúa chín vàng ươm', 'Bên bờ ao nước sâu'],
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        relatedPassagePart: 'Hôm nay, Ong Vàng cùng các bạn bay đến vườn hoa táo trắng muốt ven đồi.',
        answer: 'A',
        hint: 'Em hãy đọc câu mở đầu đoạn 2 để tìm địa điểm bầy ong bay đến nhé.',
        explanation: 'Trong bài có viết: "Hôm nay, Ong Vàng cùng các bạn bay đến vườn hoa táo trắng muốt ven đồi." Đáp án đúng là A.'
      },
      {
        id: 'g2_07_q2',
        type: 'true_false',
        prompt: 'Nhận định sau Đúng hay Sai: "Đôi chân của Ong Vàng bám đầy những hạt phấn hoa vàng rực."',
        statement: 'Đôi chân của Ong Vàng bám đầy những hạt phấn hoa vàng rực.',
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        relatedPassagePart: 'Đôi chân chú bám đầy những hạt phấn hoa vàng rực.',
        answer: true,
        hint: 'Em đọc lại chi tiết miêu tả đôi chân của chú ong sau khi đậu trên hoa.',
        explanation: 'Bài đọc nêu rõ: "Đôi chân chú bám đầy những hạt phấn hoa vàng rực." Câu này Đúng.'
      },
      {
        id: 'g2_07_q3',
        type: 'multiple_choice',
        prompt: 'Từ "kiên trì" trong câu "Ong Vàng vẫn kiên trì thu nhặt mật ngọt" có nghĩa là gì?',
        options: ['Làm việc qua loa rồi nghỉ', 'Quyết tâm làm việc đến cùng, không nản lòng', 'Nhanh chóng bỏ dở khi mệt mỏi'],
        skillTag: 'tu_trong_ngu_canh',
        difficulty: 'thong_hieu',
        relatedPassagePart: 'Dù đôi cánh đã mỏi sau nhiều giờ bay lượn, Ong Vàng vẫn kiên trì thu nhặt mật ngọt mang về tổ.',
        answer: 'B',
        hint: 'Ong mệt cánh nhưng vẫn tiếp tục cố gắng làm việc.',
        explanation: '"Kiên trì" có nghĩa là nhẫn nại, bền bỉ theo đuổi công việc đến khi hoàn thành.'
      },
      {
        id: 'g2_07_q4',
        type: 'sequence',
        prompt: 'Sắp xếp 3 sự việc diễn ra trong ngày làm việc của Ong Vàng:',
        items: [
          'Ong Vàng thức dậy sớm và chuẩn bị đôi cánh mỏng.',
          'Chú bay đến vườn hoa táo trắng để hút mật và lấy phấn hoa.',
          'Mang mật ngọt về tổ ấm để đóng góp cho cả bầy ong.'
        ],
        skillTag: 'sap_xep_trinh_tu',
        difficulty: 'thong_hieu',
        answer: [
          'Ong Vàng thức dậy sớm và chuẩn bị đôi cánh mỏng.',
          'Chú bay đến vườn hoa táo trắng để hút mật và lấy phấn hoa.',
          'Mang mật ngọt về tổ ấm để đóng góp cho cả bầy ong.'
        ],
        hint: 'Trình tự: Thức dậy -> Bay đi lấy mật -> Mang mật về tổ.',
        explanation: 'Thứ tự đúng: (1) Thức dậy sửa soạn cánh -> (2) Bay đến vườn hoa hút mật -> (3) Mang mật về tổ.'
      },
      {
        id: 'g2_07_q5',
        type: 'multiple_choice',
        prompt: 'Hình ảnh chú ong chăm chỉ gợi cho em bài học gì trong học tập?',
        options: ['Cần chăm chỉ, kiên nhẫn làm bài tập mỗi ngày để đạt kết quả tốt', 'Chỉ học khi nào thầy cô nhắc nhở', 'Làm việc nhanh nhưng không cần cẩn thận'],
        skillTag: 'lien_he_van_dung',
        difficulty: 'van_dung',
        relatedPassagePart: 'mỗi giọt mật hôm nay đều góp phần làm cho mùa xuân của cả bầy ong thêm ấm no...',
        answer: 'A',
        hint: 'Đức tính cần cù của ong giống như sự siêng năng của học sinh.',
        explanation: 'Học tập chú ong, học sinh cần rèn luyện tính kiên trì, chăm chỉ mỗi ngày để gặt hái kiến thức quý báu.'
      }
    ]
  },

  {
    id: 'lesson_g2_08',
    title: 'Đèn giao thông trên phố nhỏ',
    grade: 2,
    semester: 2,
    week: 27,
    topic: 'Giao thông an toàn',
    genre: 'informational',
    curriculumRequirement: 'Nhận biết ý nghĩa của 3 màu đèn giao thông (Đỏ, Vàng, Xanh); hiểu quy tắc qua đường an toàn cho học sinh lớp 2; vận dụng vào thực tế.',
    source: 'ai_curriculum_aligned',
    referenceSource: 'Học liệu đọc hiểu mô phỏng CT GDPT 2018 (Bám sát chủ điểm Giao thông an toàn - SGK Tiếng Việt 2, Tập 2, tr. 76)',
    verificationStatus: 'ai_curriculum_aligned',
    passage: `Ở ngã tư đầu phố có một chiếc cột đèn giao thông ba màu rất đẹp: Đỏ, Vàng và Xanh. Cột đèn đứng sừng sững suốt ngày đêm để điều tiết xe cộ đi lại trật tự.
Mỗi khi đèn Đỏ bật sáng, các phương tiện đều dừng lại trước vạch kẻ trắng. Đèn Vàng nhắc nhở người lái xe giảm tốc độ để chuẩn bị dừng. Khi đèn Xanh bừng nở, dòng người và xe cộ lại vui vẻ tiếp tục hành trình.
Mẹ dắt tay bé An đi trên vỉa hè. Mẹ bảo: "Khi đi bộ qua đường, con hãy nhớ chờ đèn Xanh dành cho người đi bộ và đi đúng trên vạch sơn trắng nhé!". Bé An gật đầu ghi nhớ lời mẹ dặn để luôn giữ an toàn cho bản thân.`,
    vocabulary: [
      { word: 'sừng sững', meaning: 'Có dáng đứng thẳng, to lớn và vững chãi.', example: 'Cột đèn đứng sừng sững giữa ngã tư.' },
      { word: 'điều tiết', meaning: 'Phân phối, sắp xếp cho hoạt động diễn ra nhịp nhàng và trật tự.', example: 'Đèn tín hiệu điều tiết dòng xe trên phố.' },
      { word: 'trật tự', meaning: 'Tình trạng ngăn nắp, theo đúng quy định và không bị lộn xộn.', example: 'Mọi người xếp hàng trật tự chờ đèn xanh.' }
    ],
    questions: [
      {
        id: 'g2_08_q1',
        type: 'multiple_choice',
        prompt: 'Khi đèn màu gì bật sáng thì các xe phải dừng lại trước vạch kẻ trắng?',
        options: ['Đèn Xanh', 'Đèn Vàng', 'Đèn Đỏ'],
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        relatedPassagePart: 'Mỗi khi đèn Đỏ bật sáng, các phương tiện đều dừng lại trước vạch kẻ trắng.',
        answer: 'C',
        hint: 'Màu đèn nào báo hiệu hiệu lệnh dừng lại?',
        explanation: 'Theo quy định giao thông và bài đọc, khi đèn Đỏ bật sáng thì mọi phương tiện phải dừng lại trước vạch sơn kẻ trắng.'
      },
      {
        id: 'g2_08_q2',
        type: 'true_false',
        prompt: 'Nhận định sau Đúng hay Sai: "Đèn Vàng nhắc nhở người lái xe nhấn ga tăng tốc thật nhanh để vượt qua ngã tư."',
        statement: 'Đèn Vàng nhắc nhở người lái xe nhấn ga tăng tốc thật nhanh để vượt qua ngã tư.',
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        relatedPassagePart: 'Đèn Vàng nhắc nhở người lái xe giảm tốc độ để chuẩn bị dừng.',
        answer: false,
        hint: 'Em đọc kỹ xem đèn Vàng yêu cầu giảm tốc độ hay tăng tốc độ.',
        explanation: 'Bài viết nêu rõ: "Đèn Vàng nhắc nhở người lái xe giảm tốc độ để chuẩn bị dừng." Do đó nhận định tăng tốc để vượt là Sai và rất nguy hiểm.'
      },
      {
        id: 'g2_08_q3',
        type: 'multiple_choice',
        prompt: 'Mẹ dặn bé An điều gì quan trọng khi đi bộ qua đường?',
        options: ['Chờ đèn Xanh cho người đi bộ và đi đúng vạch sơn trắng', 'Cứ chạy thật nhanh khi thấy đường vắng', 'Nhắm mắt đi theo người lớn'],
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'thong_hieu',
        relatedPassagePart: 'Khi đi bộ qua đường, con hãy nhớ chờ đèn Xanh dành cho người đi bộ và đi đúng trên vạch sơn trắng nhé!',
        answer: 'A',
        hint: 'Mẹ dặn An quan sát tín hiệu đèn nào và đi ở đâu?',
        explanation: 'Mẹ dặn An: "chờ đèn Xanh dành cho người đi bộ và đi đúng trên vạch sơn trắng".'
      },
      {
        id: 'g2_08_q4',
        type: 'sequence',
        prompt: 'Sắp xếp quy trình qua đường an toàn của người đi bộ:',
        items: [
          'Dừng lại trên vỉa hè quan sát cột đèn tín hiệu giao thông.',
          'Chờ đèn Xanh dành cho người đi bộ bật sáng.',
          'Đi đúng trên vạch kẻ trắng sang đường, chú ý quan sát hai bên.'
        ],
        skillTag: 'sap_xep_trinh_tu',
        difficulty: 'thong_hieu',
        answer: [
          'Dừng lại trên vỉa hè quan sát cột đèn tín hiệu giao thông.',
          'Chờ đèn Xanh dành cho người đi bộ bật sáng.',
          'Đi đúng trên vạch kẻ trắng sang đường, chú ý quan sát hai bên.'
        ],
        hint: 'Trình tự: Quan sát đèn trên vỉa hè -> Chờ đèn xanh -> Bước đi trên vạch sơn.',
        explanation: 'Trình tự an toàn: (1) Dừng quan sát đèn -> (2) Chờ đèn xanh người đi bộ -> (3) Bước trên vạch kẻ trắng sang đường an toàn.'
      },
      {
        id: 'g2_08_q5',
        type: 'multiple_choice',
        prompt: 'Mục đích chính của bài đọc trên là gì?',
        options: ['Kể câu chuyện cổ tích về các vị thần màu sắc', 'Cung cấp kiến thức và rèn luyện ý thức chấp hành luật giao thông an toàn', 'Giới thiệu cách sản xuất bóng đèn điện'],
        skillTag: 'noi_dung_chinh',
        difficulty: 'van_dung',
        relatedPassagePart: 'Bé An gật đầu ghi nhớ lời mẹ dặn để luôn giữ an toàn cho bản thân.',
        answer: 'B',
        hint: 'Bài đọc hướng dẫn các em điều gì khi tham gia giao thông?',
        explanation: 'Bài đọc nhằm cung cấp thông tin về ý nghĩa đèn tín hiệu và giáo dục ý thức chấp hành an toàn giao thông cho học sinh.'
      }
    ]
  },

  {
    id: 'lesson_g2_09',
    title: 'Hạt mầm hạt nắng bên cửa sổ',
    grade: 2,
    semester: 2,
    week: 31,
    topic: 'Ươm mầm tương lai',
    genre: 'narrative',
    curriculumRequirement: 'Sắp xếp các bước nảy mầm của hạt đậu xanh (ngâm nước, nứt nanh, nhú mầm xanh); nhận biết tác dụng của ánh nắng và sự chăm sóc.',
    source: 'ai_curriculum_aligned',
    referenceSource: 'Học liệu đọc hiểu mô phỏng CT GDPT 2018 (Bám sát chủ điểm Ươm mầm tương lai - SGK Tiếng Việt 2, Tập 2, tr. 102)',
    verificationStatus: 'ai_curriculum_aligned',
    passage: `Nam gieo một hạt đậu xanh tròn mẩy vào chiếc chậu sứ nhỏ đặt bên bậu cửa sổ. Ngày nào Nam cũng dùng chiếc thìa nhỏ tưới nước ấm cho hạt đậu.
Sau hai ngày nằm im dưới lòng đất xốp, hạt đậu cựa mình nứt lớp vỏ nâu bên ngoài. Một mầm non trắng muốt rụt rè nhô lên đón ánh sáng mặt trời.
Tia nắng ban mai rọi xuống, khẽ vuốt ve mầm cây bé bỏng. Được tắm nắng và uống đủ nước, mầm đậu vươn cao thành hai chiếc lá xanh nõn nà xòe ra như hai bàn tay vẫy chào. Nam reo lên thích thú: "Mầm cây của mình đã lớn rồi!".`,
    vocabulary: [
      { word: 'tròn mẩy', meaning: 'Hạt to, căng tròn và chắc thịt, hứa hẹn sức nảy mầm tốt.', example: 'Hạt đậu tròn mẩy nằm ngoan trong lòng đất.' },
      { word: 'rụt rè', meaning: 'Có vẻ ngập ngừng, chưa bạo dạn vì bỡ ngỡ.', example: 'Chồi non rụt rè nhô lên khỏi mặt đất.' },
      { word: 'nõn nà', meaning: 'Mịn màng, mượt mà và tươi non mơn mởn.', example: 'Hai chiếc lá non nõn nà đón sương sớm.' }
    ],
    questions: [
      {
        id: 'g2_09_q1',
        type: 'multiple_choice',
        prompt: 'Bạn Nam đã đặt chiếc chậu sứ gieo hạt đậu ở đâu?',
        options: ['Dưới gầm giường tối', 'Bên bậu cửa sổ đón nắng', 'Trên nóc tủ cao'],
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        relatedPassagePart: 'Nam gieo một hạt đậu xanh tròn mẩy vào chiếc chậu sứ nhỏ đặt bên bậu cửa sổ.',
        answer: 'B',
        hint: 'Em đọc câu đầu tiên để tìm vị trí Nam đặt chậu cây.',
        explanation: 'Bài đọc viết: "vào chiếc chậu sứ nhỏ đặt bên bậu cửa sổ". Đáp án đúng là B.'
      },
      {
        id: 'g2_09_q2',
        type: 'true_false',
        prompt: 'Nhận định sau Đúng hay Sai: "Hạt đậu không cần nước và ánh sáng vẫn tự vươn lên thành cây to."',
        statement: 'Hạt đậu không cần nước và ánh sáng vẫn tự vươn lên thành cây to.',
        skillTag: 'noi_dung_chinh',
        difficulty: 'thong_hieu',
        relatedPassagePart: 'Được tắm nắng và uống đủ nước, mầm đậu vươn cao...',
        answer: false,
        hint: 'Cây cối cần những yếu tố gì để nảy mầm và phát triển?',
        explanation: 'Cây cối rất cần nước, đất xốp và ánh sáng mặt trời để sinh trưởng. Câu khẳng định không cần nước và ánh sáng là Sai.'
      },
      {
        id: 'g2_09_q3',
        type: 'multiple_choice',
        prompt: 'Hai chiếc lá đậu mới mọc được so sánh với hình ảnh nào?',
        options: ['Như hai cánh bướm nhỏ', 'Như hai bàn tay xòe ra vẫy chào', 'Như hai giọt nước sương'],
        skillTag: 'tu_trong_ngu_canh',
        difficulty: 'thong_hieu',
        relatedPassagePart: 'hai chiếc lá xanh nõn nà xòe ra như hai bàn tay vẫy chào.',
        answer: 'B',
        hint: 'Em tìm hình ảnh so sánh ở đoạn cuối bài.',
        explanation: 'Tác giả miêu tả: "hai chiếc lá xanh nõn nà xòe ra như hai bàn tay vẫy chào".'
      },
      {
        id: 'g2_09_q4',
        type: 'sequence',
        prompt: 'Sắp xếp quá trình lớn lên của hạt đậu theo đúng diễn biến:',
        items: [
          'Hạt đậu được gieo vào đất và tưới nước hàng ngày.',
          'Hạt đậu nứt lớp vỏ nâu, nhú mầm trắng muốt đón ánh nắng.',
          'Mầm đậu vươn cao và xòe ra hai chiếc lá xanh nõn nà.'
        ],
        skillTag: 'sap_xep_trinh_tu',
        difficulty: 'thong_hieu',
        answer: [
          'Hạt đậu được gieo vào đất và tưới nước hàng ngày.',
          'Hạt đậu nứt lớp vỏ nâu, nhú mầm trắng muốt đón ánh nắng.',
          'Mầm đậu vươn cao và xòe ra hai chiếc lá xanh nõn nà.'
        ],
        hint: 'Trình tự: Gieo hạt -> Nứt vỏ nhú mầm -> Xòe lá non.',
        explanation: 'Thứ tự sinh trưởng: (1) Gieo hạt tưới nước -> (2) Nứt vỏ nhú mầm -> (3) Phát triển lá xanh nõn nà.'
      },
      {
        id: 'g2_09_q5',
        type: 'multiple_choice',
        prompt: 'Qua việc làm của Nam, em học được thái độ nào đối với cây cối?',
        options: ['Kiên nhẫn chăm sóc và yêu thương mầm sống của thiên nhiên', 'Mau chán và bỏ bê chậu cây sau một ngày gieo', 'Nhổ mầm cây lên xem mỗi buổi sáng'],
        skillTag: 'lien_he_van_dung',
        difficulty: 'van_dung',
        relatedPassagePart: 'Ngày nào Nam cũng dùng chiếc thìa nhỏ tưới nước ấm cho hạt đậu.',
        answer: 'A',
        hint: 'Nam chăm chỉ tưới nước mỗi ngày thể hiện tình cảm gì?',
        explanation: 'Học sinh học được bài học về tình yêu thiên nhiên, sự kiên nhẫn chăm sóc và trân trọng sự sống quanh mình.'
      }
    ]
  },

  {
    id: 'lesson_g2_10',
    title: 'Bức tranh biển quê em',
    grade: 2,
    semester: 2,
    week: 34,
    topic: 'Đất nước mến yêu',
    genre: 'descriptive',
    curriculumRequirement: 'Tìm chi tiết miêu tả thuyền buồm và biển sớm; hiểu nghĩa từ ngữ chỉ màu sắc sóng nước; bồi dưỡng lòng tự hào biển đảo quê hương.',
    source: 'ai_curriculum_aligned',
    referenceSource: 'Học liệu đọc hiểu mô phỏng CT GDPT 2018 (Bám sát chủ điểm Đất nước mến yêu - SGK Tiếng Việt 2, Tập 2, tr. 132)',
    verificationStatus: 'ai_curriculum_aligned',
    passage: `Quê hương của bé Thảo nằm sát bên bờ biển xanh ngắt. Buổi sớm mai, khi ông mặt trời đỏ ối nhô lên từ phía đường chân trời, bãi biển lung linh muôn ngàn ánh bạc.
Từng đoàn thuyền đánh cá no gió nối đuôi nhau quay về bến cảng, mang theo đầy những khoang cá tôm tươi rói. Tiếng cười nói rộn rã của các bác ngư dân vang vọng cả một góc trời.
Thảo cùng các bạn đứng trên bờ cát mịn ngắm nhìn lá cờ đỏ sao vàng tung bay phần phật trên mũi thuyền. Thảo thầm nghĩ biển quê mình thật giàu đẹp và em yêu từng tấc đất, ngọn sóng quê hương.`,
    vocabulary: [
      { word: 'đỏ ối', meaning: 'Màu đỏ sẫm và rực rỡ, thường tả mặt trời lúc bình minh hoặc hoàng hôn.', example: 'Mặt trời đỏ ối từ từ nhô lên mặt biển.' },
      { word: 'tươi rói', meaning: 'Còn rất tươi tắn, giữ nguyên vẻ đẹp hoặc độ tươi sống tự nhiên.', example: 'Những mẻ cá tươi rói lấp lánh dưới nắng.' },
      { word: 'rộn rã', meaning: 'Âm thanh rộn ràng, vui tươi, vang lên liên tiếp và đông vui.', example: 'Tiếng cười nói rộn rã trên bến cá sớm.' }
    ],
    questions: [
      {
        id: 'g2_10_q1',
        type: 'multiple_choice',
        prompt: 'Vào buổi sớm mai, ông mặt trời nhô lên có màu sắc như thế nào?',
        options: ['Vàng nhạt mờ mờ', 'Đỏ ối rực rỡ', 'Xanh trong dịu mát'],
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        relatedPassagePart: 'khi ông mặt trời đỏ ối nhô lên từ phía đường chân trời...',
        answer: 'B',
        hint: 'Em đọc câu thứ hai ở đoạn đầu bài.',
        explanation: 'Bài đọc viết: "khi ông mặt trời đỏ ối nhô lên từ phía đường chân trời". Do đó B là đáp án chính xác.'
      },
      {
        id: 'g2_10_q2',
        type: 'true_false',
        prompt: 'Nhận định sau Đúng hay Sai: "Đoàn thuyền đánh cá trở về bến mang theo những khoang cá tôm đầy ắp tươi rói."',
        statement: 'Đoàn thuyền đánh cá trở về bến mang theo những khoang cá tôm đầy ắp tươi rói.',
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        relatedPassagePart: 'mang theo đầy những khoang cá tôm tươi rói.',
        answer: true,
        hint: 'Đoàn thuyền đánh cá của ngư dân thu hoạch được gì?',
        explanation: 'Đoạn 2 nêu rõ thuyền mang về đầy khoang cá tôm tươi rói cùng tiếng cười rộn rã của bà con ngư dân.'
      },
      {
        id: 'g2_10_q3',
        type: 'multiple_choice',
        prompt: 'Hình ảnh nào trên mũi thuyền khiến bé Thảo cảm thấy tự hào nhất?',
        options: ['Lưới đánh cá màu xanh', 'Lá cờ đỏ sao vàng tung bay phần phật', 'Những ngọn đèn pha rực sáng'],
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'thong_hieu',
        relatedPassagePart: 'ngắm nhìn lá cờ đỏ sao vàng tung bay phần phật trên mũi thuyền.',
        answer: 'B',
        hint: 'Biểu tượng thiêng liêng nào của Tổ quốc bay trên mũi thuyền?',
        explanation: 'Hình ảnh "lá cờ đỏ sao vàng tung bay phần phật trên mũi thuyền" khẳng định chủ quyền và tình yêu biển đảo của Tổ quốc.'
      },
      {
        id: 'g2_10_q4',
        type: 'sequence',
        prompt: 'Sắp xếp các bức tranh phong cảnh biển sớm theo bài đọc:',
        items: [
          'Mặt trời đỏ ối nhô lên tỏa ánh bạc rực rỡ mặt biển sớm.',
          'Đoàn thuyền cá cập bến với khoang tôm cá tươi và tiếng cười rộn rã.',
          'Bé Thảo ngắm cờ Tổ quốc trên mũi thuyền và thêm yêu biển quê hương.'
        ],
        skillTag: 'sap_xep_trinh_tu',
        difficulty: 'thong_hieu',
        answer: [
          'Mặt trời đỏ ối nhô lên tỏa ánh bạc rực rỡ mặt biển sớm.',
          'Đoàn thuyền cá cập bến với khoang tôm cá tươi và tiếng cười rộn rã.',
          'Bé Thảo ngắm cờ Tổ quốc trên mũi thuyền và thêm yêu biển quê hương.'
        ],
        hint: 'Cảnh bình minh -> Thuyền cập bến -> Cảm xúc tự hào của Thảo.',
        explanation: 'Trình tự cảm xúc: (1) Cảnh mặt trời mọc -> (2) Cảnh thuyền cá về bến -> (3) Niềm tự hào về biển đảo quê hương.'
      },
      {
        id: 'g2_10_q5',
        type: 'multiple_choice',
        prompt: 'Nội dung chính của bài đọc "Bức tranh biển quê em" là gì?',
        options: ['Giới thiệu kỹ thuật đan lưới của ngư dân', 'Ca ngợi vẻ đẹp trù phú của biển và tình yêu biển đảo quê hương', 'Kể lại một cơn bão lớn ngoài khơi xa'],
        skillTag: 'noi_dung_chinh',
        difficulty: 'van_dung',
        relatedPassagePart: 'Thảo thầm nghĩ biển quê mình thật giàu đẹp và em yêu từng tấc đất, ngọn sóng quê hương.',
        answer: 'B',
        hint: 'Bài đọc ca ngợi vẻ đẹp của cảnh vật và con người nơi làng chài.',
        explanation: 'Bài đọc ca ngợi vẻ đẹp trù phú, rộn ràng của vùng biển quê hương và khơi dậy niềm tự hào, tình yêu quê hương đất nước.'
      }
    ]
  },

  // ----------------------------------------------------
  // LỚP 3 - HỌC KỲ II: BÀI 16 ĐẾN BÀI 20
  // ----------------------------------------------------
  {
    id: 'lesson_g3_06',
    title: 'Tiếng đàn bầu trên phố cổ',
    grade: 3,
    semester: 2,
    week: 20,
    topic: 'Đất nước ngàn năm',
    genre: 'narrative',
    curriculumRequirement: 'Hiểu nét độc đáo của cây đàn bầu chỉ có một dây mà phát ra muôn cung bậc âm thanh; cảm nhận tình yêu nghệ thuật truyền thống của bạn nhỏ.',
    source: 'ai_curriculum_aligned',
    referenceSource: 'Học liệu đọc hiểu mô phỏng CT GDPT 2018 (Bám sát chủ điểm Đất nước ngàn năm - SGK Tiếng Việt 3, Tập 2, tr. 12 - NXB Giáo dục Việt Nam)',
    verificationStatus: 'ai_curriculum_aligned',
    passage: `Chiều cuối tuần, con phố cổ Hà Nội tĩnh lặng bỗng vang lên những âm thanh ngân nga, tha thiết. Đó là tiếng đàn bầu của nghệ nhân già mù đang ngồi gảy dưới mái hiên đình cổ.
Cây đàn chỉ có độc một sợi dây thép căng dài trên thân gỗ thon nhỏ, vậy mà qua bàn tay rung cần khéo léo của người nghệ sĩ, tiếng đàn khi thì thánh thót như giọt sương mai, khi lại trầm ấm như lời ru của mẹ.
Bé Tuấn đứng lặng ngắm nhìn, đôi tai chăm chú lắng nghe từng cung bậc. Tuấn nhận ra âm nhạc dân tộc có sức truyền cảm thật kỳ diệu, như mang cả hồn quê hương và lịch sử ngàn năm đọng lại trong từng nốt đàn.`,
    vocabulary: [
      { word: 'thánh thót', meaning: 'Âm thanh trong trẻo, cao và rơi từng giọt tách bạch êm tai.', example: 'Tiếng đàn thánh thót vang giữa không gian tĩnh mịch.' },
      { word: 'nghệ nhân', meaning: 'Người làm nghề nghệ thuật hoặc thủ công truyền thống đạt trình độ điêu luyện.', example: 'Nghệ nhân đàn bầu rung cần đàn điêu luyện.' },
      { word: 'kỳ diệu', meaning: 'Lạ lùng, huyền ảo và đẹp đẽ vượt trên mức bình thường.', example: 'Sức sống kỳ diệu của âm nhạc dân tộc.' }
    ],
    questions: [
      {
        id: 'g3_06_q1',
        type: 'multiple_choice',
        prompt: 'Đặc điểm độc đáo nhất về cấu tạo của cây đàn bầu được miêu tả trong bài là gì?',
        options: ['Có bốn dây tơ óng ả', 'Chỉ có độc một sợi dây mà ngân muôn âm điệu', 'Được đúc bằng đồng nguyên khối'],
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        relatedPassagePart: 'Cây đàn chỉ có độc một sợi dây thép căng dài trên thân gỗ thon nhỏ...',
        answer: 'B',
        hint: 'Cây đàn bầu có bao nhiêu sợi dây?',
        explanation: 'Đàn bầu là nhạc cụ dân tộc độc đáo của Việt Nam, chỉ có đúng một sợi dây nhưng nhờ kỹ thuật rung cần có thể tạo nên âm bồi phong phú.'
      },
      {
        id: 'g3_06_q2',
        type: 'true_false',
        prompt: 'Nhận định sau Đúng hay Sai: "Tiếng đàn bầu chỉ tạo ra những âm thanh khô khốc, không có cảm xúc."',
        statement: 'Tiếng đàn bầu chỉ tạo ra những âm thanh khô khốc, không có cảm xúc.',
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        relatedPassagePart: 'tiếng đàn khi thì thánh thót như giọt sương mai, khi lại trầm ấm như lời ru của mẹ.',
        answer: false,
        hint: 'Tác giả ví tiếng đàn như giọt sương mai và lời ru của mẹ.',
        explanation: 'Bài miêu tả tiếng đàn thánh thót và trầm ấm, dạt dào cảm xúc ru lòng người. Nhận định khô khốc là hoàn toàn Sai.'
      },
      {
        id: 'g3_06_q3',
        type: 'multiple_choice',
        prompt: 'Biện pháp nghệ thuật nào được sử dụng trong câu: "tiếng đàn khi thì thánh thót như giọt sương mai"?',
        options: ['Biện pháp so sánh', 'Biện pháp nhân hóa', 'Biện pháp lặp từ ngữ'],
        skillTag: 'tu_trong_ngu_canh',
        difficulty: 'thong_hieu',
        relatedPassagePart: 'tiếng đàn khi thì thánh thót như giọt sương mai...',
        answer: 'A',
        hint: 'Trong câu có từ "như" để đối chiếu tiếng đàn với giọt sương.',
        explanation: 'Câu văn sử dụng từ so sánh "như" để đối chiếu âm thanh trong trẻo của tiếng đàn với sự tinh khôi của giọt sương mai.'
      },
      {
        id: 'g3_06_q4',
        type: 'sequence',
        prompt: 'Sắp xếp mạch cảm xúc của bé Tuấn trong bài đọc:',
        items: [
          'Nghe thấy tiếng đàn ngân nga phá vỡ sự tĩnh lặng của phố cổ.',
          'Đứng lặng quan sát bàn tay khéo léo rung cần đàn của nghệ nhân.',
          'Cảm nhận sâu sắc vẻ đẹp kỳ diệu và hồn cốt dân tộc trong từng nốt nhạc.'
        ],
        skillTag: 'sap_xep_trinh_tu',
        difficulty: 'thong_hieu',
        answer: [
          'Nghe thấy tiếng đàn ngân nga phá vỡ sự tĩnh lặng của phố cổ.',
          'Đứng lặng quan sát bàn tay khéo léo rung cần đàn của nghệ nhân.',
          'Cảm nhận sâu sắc vẻ đẹp kỳ diệu và hồn cốt dân tộc trong từng nốt nhạc.'
        ],
        hint: 'Thính giác nghe thấy -> Thị giác ngắm nhìn nghệ nhân -> Nhận thức vẻ đẹp tâm hồn.',
        explanation: 'Mạch cảm xúc đi từ nghe tiếng đàn -> chú ý quan sát cách đàn -> thấu hiểu giá trị thiêng liêng của di sản âm nhạc dân tộc.'
      },
      {
        id: 'g3_06_q5',
        type: 'multiple_choice',
        prompt: 'Bài đọc khơi gợi cho học sinh tình cảm nào đối với di sản văn hóa dân tộc?',
        options: ['Tự hào, trân trọng và có ý thức giữ gìn âm nhạc truyền thống', 'Chỉ nghe nhạc hiện đại và lãng quên nhạc cổ truyền', 'Không quan tâm đến các nhạc cụ dân tộc'],
        skillTag: 'noi_dung_chinh',
        difficulty: 'van_dung',
        relatedPassagePart: 'như mang cả hồn quê hương và lịch sử ngàn năm đọng lại trong từng nốt đàn.',
        answer: 'A',
        hint: 'Cảm xúc của Tuấn giúp học sinh nhận thức được điều gì?',
        explanation: 'Bài đọc giáo dục tình yêu quê hương, bồi dưỡng lòng tự hào và trách nhiệm trân trọng, gìn giữ di sản âm nhạc truyền thống của dân tộc.'
      }
    ]
  },

  {
    id: 'lesson_g3_07',
    title: 'Ngày hội trồng cây trên đồi xanh',
    grade: 3,
    semester: 2,
    week: 24,
    topic: 'Trái đất của chúng mình',
    genre: 'narrative',
    curriculumRequirement: 'Nắm các bước trồng cây đúng kỹ thuật (đào hố, đặt bầu cây, lấp đất, tưới nước); hiểu ý nghĩa của việc phủ xanh đồi trọc chống sạt lở.',
    source: 'ai_curriculum_aligned',
    referenceSource: 'Học liệu đọc hiểu mô phỏng CT GDPT 2018 (Bám sát chủ điểm Trái đất của chúng mình - SGK Tiếng Việt 3, Tập 2, tr. 46)',
    verificationStatus: 'ai_curriculum_aligned',
    passage: `Hưởng ứng phong trào "Tết trồng cây đời đời nhớ ơn Bác Hồ", thầy và trò trường Tiểu học Kim Đồng cùng nhau lên đồi cao để trồng rừng.
Buổi sáng trên đồi gió lộng, cờ đỏ bay rực rỡ. Thầy tổng phụ trách hướng dẫn các bạn từng thao tác chuẩn xác: đầu tiên đào hố sâu vừa tầm, bóc nhẹ lớp ni-lông bọc bầu rễ, đặt cây keo non đứng thẳng rồi vun đất tơi xốp xung quanh gốc.
Nhóm của bạn Hùng và Lan nhận nhiệm vụ gánh nước từ khe suối tưới đẫm cho từng gốc cây mới trồng. Nhìn hàng cây non thẳng tắp vươn mình trong nắng ấm, các bạn tin rằng không xa nữa, ngọn đồi trọc này sẽ biến thành một rừng cây xanh mát chở che bản làng.`,
    vocabulary: [
      { word: 'thao tác', meaning: 'Cách thức thực hiện từng động tác trong công việc kỹ thuật cụ thể.', example: 'Học sinh thực hiện đúng thao tác trồng cây.' },
      { word: 'tơi xốp', meaning: 'Đất vụn, thoáng khí và giữ ẩm tốt cho rễ cây phát triển.', example: 'Đất tơi xốp giúp rễ non bám chắc.' },
      { word: 'chở che', meaning: 'Bảo vệ, che chắn khỏi những hiểm họa hay tác động khắc nghiệt.', example: 'Rừng cây chở che bản làng khỏi sạt lở lũ quét.' }
    ],
    questions: [
      {
        id: 'g3_07_q1',
        type: 'multiple_choice',
        prompt: 'Phong trào trồng cây của trường Tiểu học Kim Đồng được tổ chức nhân dịp nào?',
        options: ['Tết Trung thu thiếu nhi', 'Tết trồng cây đời đời nhớ ơn Bác Hồ', 'Ngày lễ hội hóa trang'],
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        relatedPassagePart: 'Hưởng ứng phong trào "Tết trồng cây đời đời nhớ ơn Bác Hồ"...',
        answer: 'B',
        hint: 'Em đọc câu mở đầu bài đọc.',
        explanation: 'Bài đọc viết rõ: "Hưởng ứng phong trào "Tết trồng cây đời đời nhớ ơn Bác Hồ", thầy và trò trường Tiểu học Kim Đồng cùng nhau lên đồi cao để trồng rừng."'
      },
      {
        id: 'g3_07_q2',
        type: 'true_false',
        prompt: 'Nhận định sau Đúng hay Sai: "Trước khi đặt cây vào hố, cần bóc nhẹ lớp ni-lông bọc bầu rễ."',
        statement: 'Trước khi đặt cây vào hố, cần bóc nhẹ lớp ni-lông bọc bầu rễ.',
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        relatedPassagePart: 'đầu tiên đào hố sâu vừa tầm, bóc nhẹ lớp ni-lông bọc bầu rễ, đặt cây keo non đứng thẳng...',
        answer: true,
        hint: 'Thầy tổng phụ trách hướng dẫn bóc bỏ lớp vỏ gì trước khi đặt cây?',
        explanation: 'Lớp ni-lông ngăn rễ cây ăn vào đất nên cần bóc nhẹ nhàng trước khi trồng để rễ phát triển thuận lợi.'
      },
      {
        id: 'g3_07_q3',
        type: 'sequence',
        prompt: 'Sắp xếp quy trình trồng cây theo hướng dẫn của thầy tổng phụ trách:',
        items: [
          'Đào hố có độ sâu vừa tầm bầu cây.',
          'Bóc nhẹ lớp ni-lông, đặt cây non đứng thẳng và vun đất tơi xốp quanh gốc.',
          'Gánh nước suối tưới đẫm vào gốc cây để đất bám rễ.'
        ],
        skillTag: 'sap_xep_trinh_tu',
        difficulty: 'thong_hieu',
        answer: [
          'Đào hố có độ sâu vừa tầm bầu cây.',
          'Bóc nhẹ lớp ni-lông, đặt cây non đứng thẳng và vun đất tơi xốp quanh gốc.',
          'Gánh nước suối tưới đẫm vào gốc cây để đất bám rễ.'
        ],
        hint: 'Trình tự: Đào hố -> Đặt cây vun đất -> Tưới nước đẫm gốc.',
        explanation: 'Quy trình kỹ thuật gồm: (1) Đào hố -> (2) Bóc ni-lông đặt cây vun đất -> (3) Tưới đẫm nước.'
      },
      {
        id: 'g3_07_q4',
        type: 'multiple_choice',
        prompt: 'Việc trồng rừng phủ xanh đồi trọc mang lại lợi ích to lớn nào cho thiên nhiên và con người?',
        options: ['Giữ đất, giữ nước và phòng chống thiên tai lũ quét, sạt lở', 'Để lấy đất làm bãi đỗ xe', 'Để đồi không còn chỗ cho muông thú sinh sống'],
        skillTag: 'noi_dung_chinh',
        difficulty: 'thong_hieu',
        relatedPassagePart: 'biến thành một rừng cây xanh mát chở che bản làng.',
        answer: 'A',
        hint: 'Rừng cây có tác dụng gì đối với việc bảo vệ xóm làng?',
        explanation: 'Trồng rừng giúp giữ đất màu mỡ, chắn gió bão, điều hòa nguồn nước ngầm và ngăn ngừa lũ lụt, sạt lở đất.'
      },
      {
        id: 'g3_07_q5',
        type: 'multiple_choice',
        prompt: 'Em có thể làm việc gì cụ thể để góp phần giữ gìn môi trường sống xanh sạch đẹp?',
        options: ['Trồng và chăm sóc cây hoa quanh lớp, không bẻ cành hái lá', 'Vứt rác bừa bãi xuống sân trường', 'Ngắt hoa trong công viên để chơi'],
        skillTag: 'lien_he_van_dung',
        difficulty: 'van_dung',
        relatedPassagePart: 'Hưởng ứng phong trào...',
        answer: 'A',
        hint: 'Hành động nhỏ nào của học sinh giúp bảo vệ cây xanh trường lớp?',
        explanation: 'Học sinh tiểu học có thể tham gia chăm sóc bồn hoa lớp học, tưới cây và bảo vệ cây xanh không bị bẻ cành bẻ ngọn.'
      }
    ]
  },

  {
    id: 'lesson_g3_08',
    title: 'Người thợ lặn dũng cảm và rạn san hô',
    grade: 3,
    semester: 2,
    week: 28,
    topic: 'Những người quả cảm',
    genre: 'informational',
    curriculumRequirement: 'Hiểu công việc phục hồi san hô dưới lòng biển; giải nghĩa từ ngữ khoa học biển; bồi dưỡng ý thức bảo vệ đại dương.',
    source: 'ai_curriculum_aligned',
    referenceSource: 'Học liệu đọc hiểu mô phỏng CT GDPT 2018 (Bám sát chủ điểm Những người quả cảm - SGK Tiếng Việt 3, Tập 2, tr. 82)',
    verificationStatus: 'ai_curriculum_aligned',
    passage: `Vùng biển đảo Nam Du có những rạn san hô rực rỡ sắc màu được ví như những khu rừng nhiệt đới bí ẩn dưới đáy đại dương. Nhưng do biến đổi khí hậu và rác thải nhựa, nhiều rạn san hô đang bị tẩy trắng và chết dần.
Anh Nam là một kỹ sư bảo tồn biển quả cảm. Mỗi ngày, anh khoác lên mình bộ đồ lặn nặng trịch, đeo bình dưỡng khí và lặn sâu xuống đáy biển hơn hai mươi mét. Dưới làn nước sâu thẳm đầy áp lực, anh tỉ mỉ ươm từng mầm san hô non vào các giá thể nhân tạo.
Công việc của anh đầy hiểm nguy trước những dòng chảy xiết ngầm và sinh vật biển có độc. Nhưng nhìn những cụm san hô non bắt đầu đâm chồi, đàn cá nhỏ rủ nhau về tung tăng bơi lội, anh mỉm cười vì biết mình đang góp phần hồi sinh trái tim của biển.`,
    vocabulary: [
      { word: 'giá thể', meaning: 'Cấu trúc nhân tạo làm từ đá, xi măng đặc biệt làm chỗ dựa vững chắc cho sinh vật bám vào sinh trưởng.', example: 'San hô non bám vào giá thể nhân tạo.' },
      { word: 'hồi sinh', meaning: 'Sống lại, phát triển mạnh mẽ trở lại sau một thời gian bị tàn lụi.', example: 'Rạn san hô đang dần hồi sinh sức sống.' },
      { word: 'hiểm nguy', meaning: 'Rất nguy hiểm, có nguy cơ gây hại đến tính mạng.', example: 'Người thợ lặn vượt qua hiểm nguy nơi đáy biển.' }
    ],
    questions: [
      {
        id: 'g3_08_q1',
        type: 'multiple_choice',
        prompt: 'Các rạn san hô dưới đáy biển Nam Du được so sánh với hình ảnh nào?',
        options: ['Những tòa lâu đài trên cát', 'Những khu rừng nhiệt đới bí ẩn dưới đáy đại dương', 'Những con đường rải sỏi trắng'],
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        relatedPassagePart: 'được ví như những khu rừng nhiệt đới bí ẩn dưới đáy đại dương.',
        answer: 'B',
        hint: 'Em đọc câu đầu tiên của bài đọc.',
        explanation: 'Tác giả ví san hô biển Nam Du như những khu rừng nhiệt đới rực rỡ và kỳ bí dưới lòng biển sâu.'
      },
      {
        id: 'g3_08_q2',
        type: 'true_false',
        prompt: 'Nhận định sau Đúng hay Sai: "Công việc cấy san hô dưới đáy biển rất nhàn nhã và không có bất kỳ rủi ro nào."',
        statement: 'Công việc cấy san hô dưới đáy biển rất nhàn nhã và không có bất kỳ rủi ro nào.',
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        relatedPassagePart: 'Công việc của anh đầy hiểm nguy trước những dòng chảy xiết ngầm và sinh vật biển có độc.',
        answer: false,
        hint: 'Người thợ lặn phải đối mặt với áp lực nước sâu và dòng chảy ngầm.',
        explanation: 'Công việc lặn biển rất gian khổ, nguy hiểm trước áp lực nước sâu, dòng chảy ngầm và các loài sinh vật có nọc độc.'
      },
      {
        id: 'g3_08_q3',
        type: 'multiple_choice',
        prompt: 'Anh Nam gắn các mầm san hô non vào đâu để giúp chúng bám chắc và phát triển?',
        options: ['Vào các giá thể nhân tạo vững chãi', 'Thả trôi tự do trong dòng nước', 'Buộc vào đuôi các chú cá lớn'],
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'thong_hieu',
        relatedPassagePart: 'anh tỉ mỉ ươm từng mầm san hô non vào các giá thể nhân tạo.',
        answer: 'A',
        hint: 'Vật dụng gì được đặt dưới đáy biển làm nơi san hô bám rễ?',
        explanation: 'Các kỹ sư dùng giá thể nhân tạo bằng vật liệu thân thiện để mầm san hô bám rễ không bị sóng cuốn trôi.'
      },
      {
        id: 'g3_08_q4',
        type: 'sequence',
        prompt: 'Sắp xếp trình tự công việc của người kỹ sư lặn biển:',
        items: [
          'Mặc bộ đồ lặn nặng, kiểm tra bình dưỡng khí và lặn sâu xuống biển.',
          'Tỉ mỉ ươm gắn từng mầm san hô non vào giá thể nhân tạo cố định.',
          'Quan sát mầm san hô đâm chồi và đàn cá tôm kéo về sinh sống.'
        ],
        skillTag: 'sap_xep_trinh_tu',
        difficulty: 'thong_hieu',
        answer: [
          'Mặc bộ đồ lặn nặng, kiểm tra bình dưỡng khí và lặn sâu xuống biển.',
          'Tỉ mỉ ươm gắn từng mầm san hô non vào giá thể nhân tạo cố định.',
          'Quan sát mầm san hô đâm chồi và đàn cá tôm kéo về sinh sống.'
        ],
        hint: 'Chuẩn bị lặn -> Thực hiện ươm mầm -> Niềm vui khi rạn san hô hồi sinh.',
        explanation: 'Trình tự: (1) Chuẩn bị trang bị lặn -> (2) Cấy ươm san hô dưới đáy biển -> (3) Đón nhận kết quả phục hồi sinh thái.'
      },
      {
        id: 'g3_08_q5',
        type: 'multiple_choice',
        prompt: 'Hành động dũng cảm của anh Nam truyền cảm hứng gì cho cộng đồng?',
        options: ['Ý thức bảo vệ môi trường biển và không xả rác thải nhựa xuống đại dương', 'Khuyên mọi người nên bẻ san hô về làm quà lưu niệm', 'Không cần quan tâm đến các loài sinh vật biển'],
        skillTag: 'lien_he_van_dung',
        difficulty: 'van_dung',
        relatedPassagePart: 'mình đang góp phần hồi sinh trái tim của biển.',
        answer: 'A',
        hint: 'Chúng ta cần làm gì để bảo vệ các rạn san hô và đại dương?',
        explanation: 'Bài đọc kêu gọi chung tay bảo vệ đại dương, giảm thiểu rác thải nhựa để giữ gìn sự sống cho các rạn san hô quý giá.'
      }
    ]
  },

  {
    id: 'lesson_g3_09',
    title: 'Chiếc kính viễn vọng của bé An',
    grade: 3,
    semester: 2,
    week: 31,
    topic: 'Chinh phục bầu trời',
    genre: 'narrative',
    curriculumRequirement: 'Nhận biết ước mơ tìm hiểu khoa học vũ trụ; hiểu trình tự quan sát các vì sao qua kính thiên văn; bồi đắp lòng say mê khám phá.',
    source: 'ai_curriculum_aligned',
    referenceSource: 'Học liệu đọc hiểu mô phỏng CT GDPT 2018 (Bám sát chủ điểm Chinh phục bầu trời - SGK Tiếng Việt 3, Tập 2, tr. 110)',
    verificationStatus: 'ai_curriculum_aligned',
    passage: `Nhân dịp sinh nhật tròn tám tuổi, bố tặng bé An một chiếc kính viễn vọng quang học màu xanh lam tuyệt đẹp. An mừng rỡ ôm chầm lấy bố vì ước mơ ngắm trăng sao từ lâu nay đã thành hiện thực.
Tối hôm đó, bầu trời quang đãng, muôn triệu vì sao lấp lánh như dát kim cương trên dải lụa nhung đen. Bố hướng dẫn An chỉnh tiêu cự ống kính, ngắm nhìn Mặt Trăng tròn vằng vặc.
Qua lăng kính phóng đại, An kinh ngạc nhận ra bề mặt Mặt Trăng không hề bằng phẳng như chiếc đĩa ngọc mà có những miệng hố gồ ghề và dãy núi cao sừng sững. An reo lên: "Bố ơi, vũ trụ kỳ vĩ quá! Lớn lên con ước mơ trở thành nhà thiên văn học để bay vào không gian!".`,
    vocabulary: [
      { word: 'tiêu cự', meaning: 'Khoảng cách quang học từ thấu kính đến điểm hội tụ ánh sáng rõ nét nhất.', example: 'An điều chỉnh tiêu cự ống kính viễn vọng.' },
      { word: 'gồ ghề', meaning: 'Bề mặt có nhiều chỗ lồi lõm không bằng phẳng.', example: 'Miệng hố gồ ghề trên bề mặt Mặt Trăng.' },
      { word: 'kỳ vĩ', meaning: 'To lớn, hùng vĩ và đẹp đẽ đến mức làm người ta ngạc nhiên khâm phục.', example: 'Bầu trời đêm và vũ trụ kỳ vĩ khôn cùng.' }
    ],
    questions: [
      {
        id: 'g3_09_q1',
        type: 'multiple_choice',
        prompt: 'Món quà sinh nhật ý nghĩa bố tặng cho bé An là gì?',
        options: ['Một chiếc máy bay điều khiển từ xa', 'Một chiếc kính viễn vọng quang học màu xanh lam', 'Một quả bóng đá da thật'],
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        relatedPassagePart: 'bố tặng bé An một chiếc kính viễn vọng quang học màu xanh lam tuyệt đẹp.',
        answer: 'B',
        hint: 'Em đọc câu đầu tiên để xem bố tặng An món quà gì.',
        explanation: 'Bố tặng An chiếc kính viễn vọng quang học để thỏa mãn ước mơ ngắm nhìn các thiên thể vũ trụ của em.'
      },
      {
        id: 'g3_09_q2',
        type: 'true_false',
        prompt: 'Nhận định sau Đúng hay Sai: "Qua kính viễn vọng, An thấy bề mặt Mặt Trăng phẳng lì như một tấm gương soi."',
        statement: 'Qua kính viễn vọng, An thấy bề mặt Mặt Trăng phẳng lì như một tấm gương soi.',
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        relatedPassagePart: 'An kinh ngạc nhận ra bề mặt Mặt Trăng không hề bằng phẳng như chiếc đĩa ngọc mà có những miệng hố gồ ghề...',
        answer: false,
        hint: 'Bề mặt Mặt Trăng có phẳng nhẵn hay có miệng hố lồi lõm?',
        explanation: 'Nhìn qua kính viễn vọng, An thấy Mặt Trăng gồ ghề với nhiều miệng hố thiên thạch và các rặng núi đá, không hề phẳng lì.'
      },
      {
        id: 'g3_09_q3',
        type: 'multiple_choice',
        prompt: 'Từ "kỳ vĩ" trong câu "Bố ơi, vũ trụ kỳ vĩ quá!" diễn tả cảm xúc gì của An?',
        options: ['Sự trầm trồ, thán phục trước vẻ đẹp to lớn và kỳ ảo của vũ trụ', 'Sự sợ hãi trước bóng tối ban đêm', 'Sự thất vọng vì không nhìn thấy gì'],
        skillTag: 'tu_trong_ngu_canh',
        difficulty: 'thong_hieu',
        relatedPassagePart: 'An reo lên: "Bố ơi, vũ trụ kỳ vĩ quá!..."',
        answer: 'A',
        hint: 'Từ "kỳ vĩ" diễn tả vẻ đẹp bao la, hoành tráng của thiên nhiên vũ trụ.',
        explanation: '"Kỳ vĩ" vừa thể hiện quy mô khổng lồ, vừa bộc lộ niềm say mê, thán phục của con người trước vũ trụ vô tận.'
      },
      {
        id: 'g3_09_q4',
        type: 'sequence',
        prompt: 'Sắp xếp các bước khám phá bầu trời đêm của bạn An:',
        items: [
          'Được bố tặng chiếc kính viễn vọng nhân dịp sinh nhật.',
          'Chỉnh tiêu cự ống kính hướng về phía Mặt Trăng sáng tỏ.',
          'Kinh ngạc phát hiện các miệng hố và ước mơ làm nhà thiên văn học.'
        ],
        skillTag: 'sap_xep_trinh_tu',
        difficulty: 'thong_hieu',
        answer: [
          'Được bố tặng chiếc kính viễn vọng nhân dịp sinh nhật.',
          'Chỉnh tiêu cự ống kính hướng về phía Mặt Trăng sáng tỏ.',
          'Kinh ngạc phát hiện các miệng hố và ước mơ làm nhà thiên văn học.'
        ],
        hint: 'Nhận quà -> Quan sát bầu trời -> Nuôi dưỡng ước mơ tương lai.',
        explanation: 'Trình tự: (1) Nhận quà tặng -> (2) Căn chỉnh kính quan sát thiên thể -> (3) Khám phá khoa học và nhen nhóm ước mơ.'
      },
      {
        id: 'g3_09_q5',
        type: 'multiple_choice',
        prompt: 'Ước mơ của bạn An gợi mở cho học sinh thái độ học tập như thế nào?',
        options: ['Nuôi dưỡng lòng tò mò, say mê khám phá khoa học và thế giới tự nhiên', 'Không cần đọc sách tìm hiểu thiên nhiên', 'Chỉ xem điện thoại chơi trò chơi điện tử'],
        skillTag: 'lien_he_van_dung',
        difficulty: 'van_dung',
        relatedPassagePart: 'Lớn lên con ước mơ trở thành nhà thiên văn học để bay vào không gian!',
        answer: 'A',
        hint: 'Tình yêu khoa học giúp các em hình thành ước mơ đẹp đẽ gì?',
        explanation: 'Bài đọc khuyến khích học sinh nuôi dưỡng lòng say mê khoa học, ham học hỏi và tự tin theo đuổi ước mơ khám phá tri thức.'
      }
    ]
  },

  {
    id: 'lesson_g3_10',
    title: 'Cầu vồng sau cơn mưa rào',
    grade: 3,
    semester: 2,
    week: 34,
    topic: 'Bầu trời và Trái đất',
    genre: 'informational',
    curriculumRequirement: 'Đọc hiểu hiện tượng khúc xạ ánh sáng mặt trời qua hạt mưa tạo thành 7 sắc cầu vồng; hiểu từ ngữ chỉ hiện tượng khí hậu; liên hệ thực tế.',
    source: 'ai_curriculum_aligned',
    referenceSource: 'Học liệu đọc hiểu mô phỏng CT GDPT 2018 (Bám sát chủ điểm Bầu trời và Trái đất - SGK Tiếng Việt 3, Tập 2, tr. 136)',
    verificationStatus: 'ai_curriculum_aligned',
    passage: `Cơn mưa rào mùa hạ bất chợt ào xuống rồi vội vã tạnh hẳn. Những đám mây đen tan biến, nhường chỗ cho bầu trời trong xanh cao vút.
Đúng lúc ánh mặt trời bừng sáng trở lại, ở phía đông xuất hiện một dải lụa nhiều màu cong vút vắt ngang bầu trời. Đó chính là cầu vồng rực rỡ với bảy sắc màu huyền diệu: đỏ, da cam, vàng, lục, lam, chàm, tím.
Thực ra, cầu vồng sinh ra là do ánh sáng mặt trời bị những giọt nước li ti còn đọng lại trong không khí phản chiếu và tán sắc thành dải màu. Nhìn chiếc cầu vồng lung linh trên ngọn cây, em thêm yêu thiên nhiên kỳ thú và những điều kỳ diệu quanh ta.`,
    vocabulary: [
      { word: 'tán sắc', meaning: 'Hiện tượng chùm ánh sáng trắng bị tách thành nhiều màu sắc khác nhau khi đi qua môi trường trong suốt.', example: 'Ánh nắng tán sắc qua giọt mưa tạo nên cầu vồng.' },
      { word: 'huyền diệu', meaning: 'Kỳ lạ, huyền ảo và mang vẻ đẹp sâu xa khó tả hết.', example: 'Bảy sắc màu huyền diệu của cầu vồng mùa hạ.' },
      { word: 'li ti', meaning: 'Rất nhỏ, khó nhận thấy rõ từng hạt riêng biệt bằng mắt thường.', example: 'Hàng triệu hạt nước li ti lơ lửng trong không khí.' }
    ],
    questions: [
      {
        id: 'g3_10_q1',
        type: 'multiple_choice',
        prompt: 'Cầu vồng thường xuất hiện trên bầu trời vào thời điểm nào?',
        options: ['Vào đêm đông rét buốt không mưa', 'Ngay sau cơn mưa rào khi ánh mặt trời bừng sáng trở lại', 'Vào buổi trưa nắng hạn kéo dài'],
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        relatedPassagePart: 'Đúng lúc ánh mặt trời bừng sáng trở lại, ở phía đông xuất hiện một dải lụa nhiều màu...',
        answer: 'B',
        hint: 'Cầu vồng cần có ánh nắng và những hạt mưa vừa tạnh.',
        explanation: 'Cầu vồng xuất hiện khi vừa tạnh mưa rào và ánh sáng mặt trời chiếu xuyên qua các giọt nước li ti còn đọng trong không khí.'
      },
      {
        id: 'g3_10_q2',
        type: 'true_false',
        prompt: 'Nhận định sau Đúng hay Sai: "Cầu vồng chỉ có duy nhất hai màu đen và trắng."',
        statement: 'Cầu vồng chỉ có duy nhất hai màu đen và trắng.',
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        relatedPassagePart: 'bảy sắc màu huyền diệu: đỏ, da cam, vàng, lục, lam, chàm, tím.',
        answer: false,
        hint: 'Cầu vồng có bao nhiêu sắc màu?',
        explanation: 'Cầu vồng có bảy sắc màu cơ bản: đỏ, da cam, vàng, lục, lam, chàm, tím. Câu nhận định đen trắng là hoàn toàn Sai.'
      },
      {
        id: 'g3_10_q3',
        type: 'multiple_choice',
        prompt: 'Theo giải thích khoa học trong bài, nguyên nhân tạo ra cầu vồng là gì?',
        options: ['Do một chiếc máy phun sơn khổng lồ vẽ lên trời', 'Do ánh sáng mặt trời bị những giọt nước li ti tán sắc thành dải màu', 'Do mây đen rơi xuống sông hồ'],
        skillTag: 'noi_dung_chinh',
        difficulty: 'thong_hieu',
        relatedPassagePart: 'cầu vồng sinh ra là do ánh sáng mặt trời bị những giọt nước li ti còn đọng lại trong không khí phản chiếu và tán sắc...',
        answer: 'B',
        hint: 'Ánh nắng mặt trời đi qua các hạt nước mưa li ti.',
        explanation: 'Hiện tượng vật lý tán sắc ánh sáng mặt trời qua các giọt nước mưa lơ lửng trong không khí tạo thành dải quang phổ 7 màu cầu vồng.'
      },
      {
        id: 'g3_10_q4',
        type: 'sequence',
        prompt: 'Sắp xếp trình tự hiện tượng tự nhiên diễn ra trong bài đọc:',
        items: [
          'Cơn mưa rào mùa hạ ào xuống rồi vội vã tạnh hẳn.',
          'Mặt trời bừng sáng chiếu qua những hạt nước li ti trong không khí.',
          'Dải cầu vồng bảy sắc lung linh hiện ra vắt ngang bầu trời trong xanh.'
        ],
        skillTag: 'sap_xep_trinh_tu',
        difficulty: 'thong_hieu',
        answer: [
          'Cơn mưa rào mùa hạ ào xuống rồi vội vã tạnh hẳn.',
          'Mặt trời bừng sáng chiếu qua những hạt nước li ti trong không khí.',
          'Dải cầu vồng bảy sắc lung linh hiện ra vắt ngang bầu trời trong xanh.'
        ],
        hint: 'Mưa tạnh -> Nắng lên chiếu hạt nước -> Cầu vồng xuất hiện.',
        explanation: 'Trình tự diễn biến tự nhiên: (1) Mưa rào tạnh -> (2) Nắng bừng sáng tán sắc hạt nước -> (3) Cầu vồng 7 màu hiện ra.'
      },
      {
        id: 'g3_10_q5',
        type: 'multiple_choice',
        prompt: 'Bài đọc giúp các em có thêm tình cảm gì với thế giới tự nhiên?',
        options: ['Thêm yêu quý, tò mò khám phá những hiện tượng kỳ thú của thiên nhiên quanh ta', 'Sợ hãi mỗi khi nhìn thấy cầu vồng', 'Không quan tâm đến thời tiết'],
        skillTag: 'lien_he_van_dung',
        difficulty: 'van_dung',
        relatedPassagePart: 'Nhìn chiếc cầu vồng lung linh trên ngọn cây, em thêm yêu thiên nhiên kỳ thú...',
        answer: 'A',
        hint: 'Cảm xúc của người quan sát khi thấy cầu vồng đẹp lung linh.',
        explanation: 'Bài đọc khơi dậy tình yêu thiên nhiên, bồi đắp tư duy khoa học và lòng say mê quan sát thế giới xung quanh.'
      }
    ]
  }
];

async function seedPackageBLessons() {
  console.log('--- STARTING PACKAGE B LESSONS ENRICHMENT & SEEDING ---');

  // STEP 1: Update metadata for 10 existing lessons
  for (const [lessonId, meta] of Object.entries(EXISTING_LESSONS_UPDATE)) {
    const lRef = db.collection('lessons').doc(lessonId);
    const doc = await lRef.get();
    if (doc.exists) {
      await lRef.update({
        ...meta,
        updatedAt: Date.now()
      });

      // Also update its current version doc with curriculum metadata
      const currVId = doc.data().currentVersionId;
      if (currVId) {
        const vRef = lRef.collection('versions').doc(currVId);
        const vDoc = await vRef.get();
        if (vDoc.exists) {
          await vRef.update({
            semester: meta.semester,
            week: meta.week,
            genre: meta.genre,
            curriculumRequirement: meta.curriculumRequirement,
            source: meta.source,
            referenceSource: meta.referenceSource,
            verificationStatus: meta.verificationStatus,
            approvedBy: meta.approvedBy,
            approvedAt: meta.approvedAt
          });
        }
      }
      console.log(`✓ Updated metadata for existing lesson: ${lessonId} (${doc.data().title})`);
    } else {
      console.warn(`! Existing lesson not found: ${lessonId}`);
    }
  }

  // STEP 2: Insert 10 NEW lessons with version 1 and private answer keys
  const teacherUid = 'teacher_demo_account'; // Teacher Cô giáo Mai Phương

  for (const nl of NEW_LESSONS) {
    const lRef = db.collection('lessons').doc(nl.id);
    const existing = await lRef.get();

    const versionId = `v1_${nl.id}`;
    const now = Date.now();

    // Prepare public questions (no answer, no hint leaking)
    const publicQuestions = nl.questions.map(q => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      options: q.options || undefined,
      statement: q.statement || undefined,
      items: q.items || undefined,
      skillTag: q.skillTag,
      difficulty: q.difficulty,
      relatedPassagePart: q.relatedPassagePart || undefined
    }));

    // Prepare private answers map
    const privateAnswersMap = {};
    nl.questions.forEach(q => {
      privateAnswersMap[q.id] = {
        correctAnswer: q.answer,
        hint: q.hint,
        explanation: q.explanation
      };
    });

    const skillTags = Array.from(new Set(nl.questions.map(q => q.skillTag)));

    // 1. Create/Update lesson doc
    await lRef.set({
      id: nl.id,
      teacherUid,
      title: nl.title,
      topic: nl.topic,
      grade: nl.grade,
      semester: nl.semester,
      week: nl.week,
      genre: nl.genre,
      curriculumRequirement: nl.curriculumRequirement,
      source: nl.source,
      referenceSource: nl.referenceSource,
      verificationStatus: nl.verificationStatus,
      status: 'published',
      currentVersionId: versionId,
      currentVersionNumber: 1,
      totalVersions: 1,
      totalQuestions: nl.questions.length,
      assignedClassCount: 0,
      approvedAt: now,
      approvedBy: 'Cô giáo Mai Phương',
      createdAt: now,
      updatedAt: now
    }, { merge: true });

    // 2. Create version 1 doc
    await lRef.collection('versions').doc(versionId).set({
      versionId,
      lessonId: nl.id,
      versionNumber: 1,
      passage: nl.passage,
      vocabulary: nl.vocabulary,
      publicQuestions,
      grade: nl.grade,
      semester: nl.semester,
      week: nl.week,
      genre: nl.genre,
      curriculumRequirement: nl.curriculumRequirement,
      source: nl.source,
      referenceSource: nl.referenceSource,
      verificationStatus: nl.verificationStatus,
      topic: nl.topic,
      title: nl.title,
      skillTags,
      totalQuestions: nl.questions.length,
      publishedAt: now,
      approvedAt: now,
      approvedBy: 'Cô giáo Mai Phương',
      createdAt: now
    });

    // 3. Create private answer keys doc in privateAnswerKeys/{versionId}
    await db.collection('privateAnswerKeys').doc(versionId).set({
      versionId,
      answers: privateAnswersMap,
      createdAt: now
    });

    console.log(`✓ Seeded new lesson: ${nl.id} — "${nl.title}" (Grade ${nl.grade}, Semester ${nl.semester}, Week ${nl.week})`);
  }

  console.log('--- PACKAGE B SEEDING COMPLETE! ---');
}

seedPackageBLessons()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Seeding error:', err);
    process.exit(1);
  });

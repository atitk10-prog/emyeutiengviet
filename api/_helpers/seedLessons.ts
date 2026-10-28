/**
 * EM YÊU TIẾNG VIỆT - SEED LESSONS IN-MEMORY REPOSITORY
 * 6 Chuẩn học liệu mẫu GDPT 2018 (3 bài Lớp 2, 3 bài Lớp 3)
 * Phục vụ Zero-Read Fallback cho getLessonDetail & getTeacherLessons khi Firestore Quota bị chạm ngưỡng
 */

export interface SeedVocabulary {
  word: string;
  meaning: string;
  example?: string;
}

export interface SeedQuestion {
  id: string;
  type: 'multiple_choice' | 'true_false' | 'sequence' | 'matching' | 'fill_blank';
  prompt: string;
  options?: string[];
  statement?: string;
  items?: string[];
  pairs?: Array<{ left: string; right: string }>;
  passageWithBlanks?: string;
  blanks?: Array<{ id: string; acceptedAnswers: string[] }>;
  skillTag: string;
  difficulty: string;
  relatedPassagePart?: string;
  answer: any;
  hint: string;
  explanation: string;
}

export interface SeedLesson {
  id: string;
  title: string;
  topic: string;
  grade: number;
  passage: string;
  vocabulary: SeedVocabulary[];
  questions: SeedQuestion[];
}

export const SEED_LESSONS: SeedLesson[] = [
  // LỚP 2 - BÀI 1
  {
    id: 'seed-lop2-bai1',
    title: 'Chim sâu nhỏ và vườn cam',
    topic: 'Thiên nhiên tươi đẹp',
    grade: 2,
    passage: `Sáng sớm, mặt trời vừa nhô lên sau rặng tre, chim sâu nhỏ đã thức dậy. Chú chuyền cành thoăn thoắt trong vườn cam trĩu quả. 
Đôi mắt chú tròn xoe, chăm chú nhìn từng kẽ lá xanh mướt. Bỗng chú phát hiện một con sâu béo mập đang gặm nhấm chiếc lá non. Chim sâu nhanh nhẹn mổ trúng chú sâu, giúp cây cam không còn bị sâu cắn phá. 
Bác làm vườn đi ngang qua mỉm cười: "Cảm ơn chú chim nhỏ chăm chỉ nhé!". Chim sâu cất tiếng hót líu lo chào ngày mới.`,
    vocabulary: [
      { word: 'thoăn thoắt', meaning: 'Cử động rất nhanh và liên tiếp.', example: 'Chú chim chuyền cành thoăn thoắt.' },
      { word: 'gặm nhấm', meaning: 'Cắn từng miếng nhỏ một cách từ từ.', example: 'Con sâu đang gặm nhấm chiếc lá.' },
      { word: 'líu lo', meaning: 'Âm thanh tiếng chim hót liên tiếp, trong trẻo và vui tai.', example: 'Đàn chim hót líu lo đón bình minh.' }
    ],
    questions: [
      {
        id: 'q1',
        type: 'multiple_choice',
        prompt: 'Chim sâu nhỏ thức dậy vào lúc nào trong ngày?',
        options: ['Sáng sớm', 'Buổi trưa nắng gắt', 'Chiều muộn'],
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        relatedPassagePart: 'Sáng sớm, mặt trời vừa nhô lên sau rặng tre...',
        answer: 'A',
        hint: 'Em hãy đọc lại câu đầu tiên của bài đọc để tìm thời gian chim sâu thức dậy.',
        explanation: 'Bài đọc viết: "Sáng sớm, mặt trời vừa nhô lên sau rặng tre, chim sâu nhỏ đã thức dậy." Đáp án đúng là Sáng sớm (A).'
      },
      {
        id: 'q2',
        type: 'true_false',
        prompt: 'Nhận định sau đây Đúng hay Sai: "Con sâu béo mập đang nằm ngủ trên cành cây khô."',
        statement: 'Con sâu béo mập đang nằm ngủ trên cành cây khô.',
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        relatedPassagePart: 'Bỗng chú phát hiện một con sâu béo mập đang gặm nhấm chiếc lá non.',
        answer: false,
        hint: 'Em hãy xem chú chim phát hiện con sâu đang làm gì trên chiếc lá non nhé.',
        explanation: 'Trong bài, con sâu đang gặm nhấm chiếc lá non chứ không phải nằm ngủ trên cành cây khô. Vì vậy câu nhận định này là Sai.'
      },
      {
        id: 'q3',
        type: 'multiple_choice',
        prompt: 'Từ "thoăn thoắt" trong câu "Chú chuyền cành thoăn thoắt" nói lên điều gì về động tác của chú chim?',
        options: ['Động tác chậm chạp, vụng về', 'Động tác rất nhanh nhẹn, liên tục', 'Động tác mệt mỏi, uể oải'],
        skillTag: 'tu_trong_ngu_canh',
        difficulty: 'thong_hieu',
        relatedPassagePart: 'Chú chuyền cành thoăn thoắt trong vườn cam trĩu quả.',
        answer: 'B',
        hint: 'Từ "thoăn thoắt" thường dùng để tả những cử động nhẹ nhàng và rất nhanh.',
        explanation: '"Thoăn thoắt" là từ gợi tả động tác nhanh nhẹn, khéo léo và liên tục của chú chim nhỏ.'
      },
      {
        id: 'q4',
        type: 'sequence',
        prompt: 'Em hãy sắp xếp 3 sự việc sau theo đúng thứ tự diễn ra trong bài đọc:',
        items: [
          'Chim sâu nhỏ thức dậy và chuyền cành trong vườn cam.',
          'Chim sâu nhanh nhẹn bắt con sâu béo mập hại lá.',
          'Bác làm vườn khen ngợi và cảm ơn chú chim sâu chăm chỉ.'
        ],
        skillTag: 'sap_xep_trinh_tu',
        difficulty: 'thong_hieu',
        answer: [
          'Chim sâu nhỏ thức dậy và chuyền cành trong vườn cam.',
          'Chim sâu nhanh nhẹn bắt con sâu béo mập hại lá.',
          'Bác làm vườn khen ngợi và cảm ơn chú chim sâu chăm chỉ.'
        ],
        hint: 'Em hãy chú ý: Chim thức dậy trước, sau đó phát hiện và bắt sâu, cuối cùng là bác làm vườn cảm ơn.',
        explanation: 'Thứ tự đúng là: (1) Chim thức dậy và chuyền cành -> (2) Bắt con sâu béo mập -> (3) Bác làm vườn khen ngợi.'
      },
      {
        id: 'q5',
        type: 'multiple_choice',
        prompt: 'Qua câu chuyện, em học được bài học gì về ích lợi của loài chim sâu?',
        options: [
          'Chim sâu biết bắt sâu để bảo vệ cây trồng giúp bác nông dân.',
          'Chim sâu chỉ biết hót cho vui chứ không có ích gì.',
          'Chim sâu làm hại lá cam trong vườn.'
        ],
        skillTag: 'lien_he_van_dung',
        difficulty: 'van_dung',
        answer: 'A',
        hint: 'Chim sâu đã giúp cây cam điều gì khi bắt con sâu béo mập?',
        explanation: 'Chim sâu là người bạn tốt của nhà nông vì chú bắt sâu bảo vệ cây trái xanh tươi.'
      }
    ]
  },
  // LỚP 2 - BÀI 2
  {
    id: 'seed-lop2-bai2',
    title: 'Đôi bạn ở xóm Hoa',
    topic: 'Bạn bè và tình thương',
    grade: 2,
    passage: `Ở xóm Hoa, Thỏ Trắng và Nhím Nâu là đôi bạn thân thiết. Hôm nay, trời đổ một cơn mưa rào bất chợt. Nhím Nâu không kịp mang ô nên co ro nép dưới tán lá chuối ướt sũng. 
Thấy bạn bị ướt, Thỏ Trắng liền cầm chiếc ô lá sen to chạy đến, che cho Nhím Nâu: "Nhím ơi, vào đây che chung với mình kẻo ốm!". 
Hai bạn cùng đi dưới một chiếc ô, vừa đi vừa cười vui vẻ. Nhím Nâu xúc động nói: "Có bạn thật là tuyệt!". Mưa tạnh, một chiếc cầu vồng bảy sắc lung linh rực sáng trên bầu trời xanh.`,
    vocabulary: [
      { word: 'co ro', meaning: 'Thu mình lại vì rét hoặc vì sợ.', example: 'Chú cún con nằm co ro góc sân.' },
      { word: 'ướt sũng', meaning: 'Ướt đẫm nước khắp cả người.', example: 'Chiếc áo bị ướt sũng sau cơn mưa.' },
      { word: 'lung linh', meaning: 'Ánh sáng lấp lánh rung rinh đẹp mắt.', example: 'Ánh nắng lung linh trên mặt hồ.' }
    ],
    questions: [
      {
        id: 'q1',
        type: 'multiple_choice',
        prompt: 'Vì sao Nhím Nâu phải nép dưới tán lá chuối khi trời mưa?',
        options: ['Vì Nhím Nâu thích chơi dưới mưa', 'Vì Nhím Nâu không kịp mang ô', 'Vì Nhím Nâu đang trốn tìm với Thỏ Trắng'],
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        relatedPassagePart: 'Nhím Nâu không kịp mang ô nên co ro nép dưới tán lá chuối...',
        answer: 'B',
        hint: 'Đọc lại đoạn nói về lý do Nhím Nâu đứng dưới tán lá chuối khi trời đổ mưa rào.',
        explanation: 'Nhím Nâu bị ướt và phải nép dưới tán lá chuối vì chú không kịp mang ô (Đáp án B).'
      },
      {
        id: 'q2',
        type: 'multiple_choice',
        prompt: 'Thỏ Trắng đã làm gì để giúp đỡ bạn Nhím Nâu?',
        options: [
          'Chạy vội về nhà một mình để khỏi bị ướt',
          'Cầm ô lá sen to đến che chung cho Nhím Nâu',
          'Đứng nhìn và gọi bạn chạy nhanh lên'
        ],
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        answer: 'B',
        hint: 'Thỏ Trắng đã dùng chiếc ô lá sen làm gì cho bạn?',
        explanation: 'Thỏ Trắng cầm ô lá sen to chạy tới và mời bạn che chung kẻo bị ốm.'
      },
      {
        id: 'q3',
        type: 'true_false',
        prompt: 'Nhận định sau đây Đúng hay Sai: "Khi mưa tạnh, bầu trời xám xịt và có sấm sét lớn."',
        statement: 'Khi mưa tạnh, bầu trời xám xịt và có sấm sét lớn.',
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        relatedPassagePart: 'Mưa tạnh, một chiếc cầu vồng bảy sắc lung linh rực sáng trên bầu trời xanh.',
        answer: false,
        hint: 'Xem câu cuối cùng nói về điều gì xuất hiện sau cơn mưa.',
        explanation: 'Sau cơn mưa, có cầu vồng bảy sắc lung linh xuất hiện trên nền trời xanh, không hề xám xịt hay có sấm sét.'
      },
      {
        id: 'q4',
        type: 'sequence',
        prompt: 'Hãy sắp xếp lại thứ tự các sự việc trong câu chuyện:',
        items: [
          'Trời đổ mưa rào, Nhím Nâu không mang ô nên bị ướt.',
          'Thỏ Trắng mang ô lá sen che mưa cho bạn.',
          'Mưa tạnh, cầu vồng bảy sắc xuất hiện rực rỡ.'
        ],
        skillTag: 'sap_xep_trinh_tu',
        difficulty: 'thong_hieu',
        answer: [
          'Trời đổ mưa rào, Nhím Nâu không mang ô nên bị ướt.',
          'Thỏ Trắng mang ô lá sen che mưa cho bạn.',
          'Mưa tạnh, cầu vồng bảy sắc xuất hiện rực rỡ.'
        ],
        hint: 'Thứ tự: Mưa xuống làm Nhím ướt -> Thỏ giúp bạn che ô -> Mưa tạnh cầu vồng hiện ra.',
        explanation: 'Thứ tự diễn biến tự nhiên theo thời gian của câu chuyện.'
      },
      {
        id: 'q5',
        type: 'multiple_choice',
        prompt: 'Câu chuyện gửi gắm đến chúng ta bài học gì?',
        options: [
          'Bạn bè cần biết quan tâm, chia sẻ và giúp đỡ nhau khi gặp khó khăn.',
          'Khi trời mưa thì không nên ra khỏi nhà.',
          'Chỉ nên kết bạn với người có ô to.'
        ],
        skillTag: 'noi_dung_chinh',
        difficulty: 'van_dung',
        answer: 'A',
        hint: 'Hành động của Thỏ Trắng đối với Nhím Nâu thể hiện tình bạn đẹp như thế nào?',
        explanation: 'Câu chuyện ca ngợi tình bạn đẹp: bạn bè luôn biết yêu thương, sẻ chia và giúp đỡ nhau lúc hoạn nạn.'
      }
    ]
  },
  // LỚP 2 - BÀI 3
  {
    id: 'seed-lop2-bai3',
    title: 'Dòng suối quê em',
    topic: 'Quê hương yêu dấu',
    grade: 2,
    passage: `Phía sau ngôi làng nhỏ của em có một dòng suối trong veo bắt nguồn từ đỉnh núi cao. Nước suối len lỏi qua từng khe đá, chảy róc rách suốt ngày đêm như khúc ca êm dịu. 
Dưới làn nước mát lạnh, từng đàn cá nhỏ tung tăng bơi lội, vây óng ánh ánh mặt trời. Hai bên bờ suối, cỏ xanh mọc mượt mà cùng những bông hoa dại khoe sắc tím, vàng rực rỡ. 
Mỗi buổi chiều hè mát mẻ, trẻ con trong làng thường rủ nhau ra bờ suối thả thuyền giấy. Dòng suối nhỏ êm đềm đã gắn liền với tuổi thơ êm đẹp của bao thế hệ người dân quê em.`,
    vocabulary: [
      { word: 'len lỏi', meaning: 'Đi luồn lách qua những chỗ chật hẹp, quanh co.', example: 'Nước suối len lỏi qua khe đá.' },
      { word: 'róc rách', meaning: 'Từ gợi tả tiếng nước chảy nhẹ qua khe đá một cách đều đặn.', example: 'Tiếng suối chảy róc rách trong rừng.' },
      { word: 'êm đềm', meaning: 'Yên tĩnh, dịu dàng, mang lại cảm giác dễ chịu, thanh bình.', example: 'Cuộc sống làng quê trôi qua êm đềm.' }
    ],
    questions: [
      {
        id: 'q1',
        type: 'multiple_choice',
        prompt: 'Dòng suối trong bài đọc bắt nguồn từ đâu?',
        options: ['Từ đỉnh núi cao', 'Từ một cái hồ lớn', 'Từ cánh đồng lúa'],
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        relatedPassagePart: '...có một dòng suối trong veo bắt nguồn từ đỉnh núi cao.',
        answer: 'A',
        hint: 'Em hãy đọc câu đầu tiên để tìm nơi bắt nguồn của dòng suối.',
        explanation: 'Bài viết nêu rõ dòng suối bắt nguồn từ "đỉnh núi cao".'
      },
      {
        id: 'q2',
        type: 'true_false',
        prompt: 'Nhận định sau đây Đúng hay Sai: "Dưới lòng suối, nước đục ngầu và không có loài cá nào sinh sống."',
        statement: 'Dưới lòng suối, nước đục ngầu và không có loài cá nào sinh sống.',
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        relatedPassagePart: 'Dưới làn nước mát lạnh, từng đàn cá nhỏ tung tăng bơi lội...',
        answer: false,
        hint: 'Đọc đoạn miêu tả về nước suối và những chú cá nhỏ.',
        explanation: 'Bài đọc viết: "Dưới làn nước mát lạnh, từng đàn cá nhỏ tung tăng bơi lội, vây óng ánh". Vì vậy nhận định trên là Sai.'
      },
      {
        id: 'q3',
        type: 'multiple_choice',
        prompt: 'Buổi chiều hè, các bạn nhỏ trong làng thường làm gì bên bờ suối?',
        options: ['Thả thuyền giấy', 'Câu cá lớn mang bán', 'Bẻ cành hái hoa'],
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        answer: 'A',
        hint: 'Đọc câu: "Mỗi buổi chiều hè mát mẻ, trẻ con trong làng thường..."',
        explanation: 'Trẻ em trong làng thường rủ nhau ra bờ suối thả thuyền giấy vui chơi.'
      },
      {
        id: 'q4',
        type: 'sequence',
        prompt: 'Hãy sắp xếp trình tự các hình ảnh được miêu tả từ đầu đến cuối bài:',
        items: [
          'Dòng suối chảy len lỏi từ đỉnh núi qua khe đá.',
          'Đàn cá tung tăng bơi lội dưới làn nước và hoa cỏ hai bên bờ.',
          'Các bạn nhỏ rủ nhau thả thuyền giấy vào chiều hè.'
        ],
        skillTag: 'sap_xep_trinh_tu',
        difficulty: 'thong_hieu',
        answer: [
          'Dòng suối chảy len lỏi từ đỉnh núi qua khe đá.',
          'Đàn cá tung tăng bơi lội dưới làn nước và hoa cỏ hai bên bờ.',
          'Các bạn nhỏ rủ nhau thả thuyền giấy vào chiều hè.'
        ],
        hint: 'Tác giả tả nguồn gốc con suối trước, rồi đến cảnh cá và hoa cỏ, cuối cùng là hoạt động vui chơi của trẻ thơ.',
        explanation: 'Bài văn miêu tả từ dòng nước suối -> sinh vật bờ suối -> con người gắn bó bên suối.'
      },
      {
        id: 'q5',
        type: 'multiple_choice',
        prompt: 'Để dòng suối quê hương luôn trong xanh và tươi đẹp, chúng ta nên làm gì?',
        options: [
          'Không vứt rác, túi nilon hay chất bẩn xuống bờ suối.',
          'Xả nước thải bẩn vào dòng suối cho trôi đi nhanh.',
          'Chặt hết cây cối hai bên bờ suối.'
        ],
        skillTag: 'lien_he_van_dung',
        difficulty: 'van_dung',
        answer: 'A',
        hint: 'Hành động nào giúp bảo vệ môi trường nước suối sạch đẹp?',
        explanation: 'Chúng ta cần giữ gìn vệ sinh chung, không xả rác bừa bãi để giữ cho nguồn nước trong lành.'
      }
    ]
  },
  // LỚP 3 - BÀI 1
  {
    id: 'seed-lop3-bai1',
    title: 'Hương cốm mùa thu',
    topic: 'Văn hóa truyền thống',
    grade: 3,
    passage: `Khi những cơn gió heo may đầu mùa se se lạnh thổi về, đó cũng là lúc làng Vòng vào mùa làm cốm. Cốm được làm từ những bông lúa nếp non còn đọng giọt sữa ngọt ngào của đất trời. 
Các nghệ nhân trong làng khéo léo gặt lúa từ tinh mơ, đem rang trên chảo gang với lửa củi liu riu. Sau đó, họ đưa từng mẻ thóc vào cối đá giã đều tay, sàng sảy kỹ lưỡng để loại bỏ vỏ trấu mỏng. 
Từng hạt cốm dẹt dẻo thơm, xanh mướt như ngọc bích được gói cẩn thận trong tấm lá sen già thơm ngát, buộc bằng sợi rơm vàng óng. Vị ngọt thanh của cốm quyện cùng hương sen thanh khiết tạo nên phong vị mùa thu Hà Nội nồng nàn, khiến ai đi xa cũng bồi hồi nhớ về quê hương.`,
    vocabulary: [
      { word: 'heo may', meaning: 'Gió nhẹ, hơi khô và lạnh thường thổi vào mùa thu ở miền Bắc.', example: 'Gió heo may thổi mang theo cái se lạnh của mùa thu.' },
      { word: 'liu riu', meaning: 'Ngọn lửa nhỏ cháy đều, nhẹ nhàng không bùng to.', example: 'Nồi chè sôi liu riu trên bếp than.' },
      { word: 'thanh khiết', meaning: 'Trong sạch, thanh tao và tươi mát.', example: 'Mùi hương hoa sen thanh khiết khắp căn phòng.' }
    ],
    questions: [
      {
        id: 'q1',
        type: 'multiple_choice',
        prompt: 'Hạt cốm non được làm từ nguyên liệu gì?',
        options: ['Lúa nếp non còn ngậm sữa', 'Hạt gạo tẻ giã nhuyễn', 'Đậu xanh nấu chín'],
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        relatedPassagePart: 'Cốm được làm từ những bông lúa nếp non còn đọng giọt sữa ngọt ngào...',
        answer: 'A',
        hint: 'Đọc câu miêu tả nguyên liệu làm nên hạt cốm dẻo thơm.',
        explanation: 'Cốm được làm từ những bông lúa nếp non đọng giọt sữa ngọt ngào.'
      },
      {
        id: 'q2',
        type: 'multiple_choice',
        prompt: 'Vì sao người làm cốm lại gói hạt cốm trong tấm lá sen già?',
        options: [
          'Để cốm giữ được độ mềm dẻo và quyện thêm mùi hương sen thanh khiết',
          'Vì người làng Vòng không có hộp đựng',
          'Để làm hạt cốm đổi sang màu đỏ'
        ],
        skillTag: 'tu_trong_ngu_canh',
        difficulty: 'thong_hieu',
        relatedPassagePart: '...được gói cẩn thận trong tấm lá sen già thơm ngát... Vị ngọt thanh của cốm quyện cùng hương sen thanh khiết...',
        answer: 'A',
        hint: 'Lá sen già có mùi hương như thế nào và có tác dụng gì đối với hương vị của cốm?',
        explanation: 'Lá sen vừa giữ cho hạt cốm dẻo mềm, vừa làm tăng thêm hương thơm thanh khiết đặc trưng.'
      },
      {
        id: 'q3',
        type: 'true_false',
        prompt: 'Nhận định sau đây Đúng hay Sai: "Thóc nếp làm cốm được rang bằng lửa to ngùn ngụt để hạt chín cháy giòn."',
        statement: 'Thóc nếp làm cốm được rang bằng lửa to ngùn ngụt để hạt chín cháy giòn.',
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        relatedPassagePart: '...đem rang trên chảo gang với lửa củi liu riu.',
        answer: false,
        hint: 'Kiểm tra xem tác giả miêu tả ngọn lửa khi rang cốm là lửa to hay lửa liu riu.',
        explanation: 'Bài viết nêu rõ: rang trên chảo gang với lửa củi "liu riu", không phải lửa to cháy giòn. Do đó nhận định là Sai.'
      },
      {
        id: 'q4',
        type: 'sequence',
        prompt: 'Hãy sắp xếp các công đoạn làm cốm theo đúng quy trình được miêu tả:',
        items: [
          'Gặt lúa nếp non từ sáng sớm và rang trên chảo gang với lửa liu riu.',
          'Cho vào cối đá giã đều tay, sàng sảy kỹ lưỡng vỏ trấu.',
          'Gói từng hạt cốm xanh dẻo vào lá sen già và buộc bằng sợi rơm vàng.'
        ],
        skillTag: 'sap_xep_trinh_tu',
        difficulty: 'thong_hieu',
        answer: [
          'Gặt lúa nếp non từ sáng sớm và rang trên chảo gang với lửa liu riu.',
          'Cho vào cối đá giã đều tay, sàng sảy kỹ lưỡng vỏ trấu.',
          'Gói từng hạt cốm xanh dẻo vào lá sen già và buộc bằng sợi rơm vàng.'
        ],
        hint: 'Quy trình: Gặt lúa & rang -> Giã & sàng sảy -> Gói lá sen buộc rơm.',
        explanation: 'Đây là quy trình làm cốm truyền thống cầu kỳ của các nghệ nhân làng Vòng.'
      },
      {
        id: 'q5',
        type: 'multiple_choice',
        prompt: 'Hình ảnh hạt cốm trong bài gợi cho em cảm xúc gì về nét đẹp ẩm thực dân tộc?',
        options: [
          'Lòng tự hào và trân trọng sự cần cù, khéo léo của người lao động Việt Nam.',
          'Cảm thấy đây chỉ là món ăn bình thường không có gì đáng nhớ.',
          'Nghĩ rằng không cần bảo tồn nghề làm cốm cổ truyền.'
        ],
        skillTag: 'lien_he_van_dung',
        difficulty: 'van_dung',
        answer: 'A',
        hint: 'Hạt cốm thể hiện sự khéo léo của người dân và tình yêu với quê hương như thế nào?',
        explanation: 'Mỗi hạt cốm là kết tinh của giọt mồ hôi, sự tỉ mỉ của người nông dân và là nét đẹp văn hóa dân tộc đáng tự hào.'
      }
    ]
  },
  // LỚP 3 - BÀI 2
  {
    id: 'seed-lop3-bai2',
    title: 'Chuyến thám hiểm của Kiến Đen',
    topic: 'Kỹ năng sống và lòng dũng cảm',
    grade: 3,
    passage: `Kiến Đen là một chú kiến nhỏ nhưng mang trong mình ước mơ to lớn: muốn nhìn ngắm thế giới bên ngoài tổ đất. Một buổi sáng đẹp trời, chú quyết định trèo lên ngọn cây bàng cổ thụ giữa sân trường. 
Đường đi gồ ghề đầy những vết nứt sâu hoắm trên thân cây sần sùi. Có lúc, một cơn gió mạnh thổi qua làm chú suýt rơi xuống đất. Nhưng Kiến Đen bám chặt những chiếc chân gai vào vỏ cây, kiên nhẫn từng bước nhích lên phía trước. 
Khi lên đến chiếc lá bàng cao nhất, Kiến Đen vỡ òa sung sướng. Từ trên cao nhìn xuống, chú thấy cả mái trường ngói đỏ tươi, vườn hoa rực rỡ và những bạn học sinh đang nô đùa rộn rã. Chú hiểu rằng, chỉ cần không nản chí, ta sẽ mở rộng được tầm nhìn của chính mình.`,
    vocabulary: [
      { word: 'gồ ghề', meaning: 'Không bằng phẳng, có nhiều chỗ lồi lõm mấp mô.', example: 'Con đường đá sỏi gồ ghề khó đi.' },
      { word: 'sần sùi', meaning: 'Bề mặt có nhiều nốt nhỏ nhô lên, không nhẵn nhụi.', example: 'Vỏ cây bàng xù xì, sần sùi theo năm tháng.' },
      { word: 'vỡ òa', meaning: 'Cảm xúc mạnh mẽ bất ngờ trào dâng không kìm nén được.', example: 'Cả lớp vỡ òa trong niềm vui chiến thắng.' }
    ],
    questions: [
      {
        id: 'q1',
        type: 'multiple_choice',
        prompt: 'Ước mơ của Kiến Đen trong câu chuyện là gì?',
        options: [
          'Muốn nhìn ngắm thế giới bao la bên ngoài tổ đất',
          'Muốn tìm thật nhiều thức ăn ngọt cất vào tổ',
          'Muốn ngủ suốt mùa đông dài'
        ],
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        relatedPassagePart: '...mang trong mình ước mơ to lớn: muốn nhìn ngắm thế giới bên ngoài tổ đất.',
        answer: 'A',
        hint: 'Đọc câu thứ nhất miêu tả ước mơ của chú kiến nhỏ.',
        explanation: 'Ước mơ của Kiến Đen là được ngắm nhìn thế giới bên ngoài tổ đất.'
      },
      {
        id: 'q2',
        type: 'true_false',
        prompt: 'Nhận định sau Đúng hay Sai: "Gặp cơn gió mạnh, Kiến Đen sợ hãi bỏ cuộc và trèo ngay xuống đất."',
        statement: 'Gặp cơn gió mạnh, Kiến Đen sợ hãi bỏ cuộc và trèo ngay xuống đất.',
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        relatedPassagePart: 'Nhưng Kiến Đen bám chặt những chiếc chân gai vào vỏ cây, kiên nhẫn từng bước nhích lên phía trước.',
        answer: false,
        hint: 'Xem cách Kiến Đen phản ứng khi gió thổi qua thân cây bàng.',
        explanation: 'Kiến Đen bám chặt chân vào vỏ cây và kiên nhẫn bước tiếp, không hề bỏ cuộc.'
      },
      {
        id: 'q3',
        type: 'multiple_choice',
        prompt: 'Từ "kiên nhẫn" trong bài đọc có nghĩa là gì?',
        options: [
          'Chờ đợi và tiếp tục cố gắng, không nản lòng trước khó khăn',
          'Làm việc vội vàng, hấp tấp',
          'Bỏ mặc mọi chuyện không quan tâm'
        ],
        skillTag: 'tu_trong_ngu_canh',
        difficulty: 'thong_hieu',
        answer: 'A',
        hint: 'Hành động nhích từng bước một của Kiến Đen thể hiện đức tính gì?',
        explanation: '"Kiên nhẫn" là đức tính bền bỉ, nhẫn nại vượt qua thử thách để đạt được mục tiêu.'
      },
      {
        id: 'q4',
        type: 'sequence',
        prompt: 'Sắp xếp hành trình vượt khó của Kiến Đen:',
        items: [
          'Kiến Đen bắt đầu leo lên thân cây bàng gồ ghề, sần sùi.',
          'Gặp cơn gió lớn, chú bám chặt chân gai và kiên trì nhích từng bước.',
          'Lên đến đỉnh lá bàng cao nhất, chú ngắm nhìn toàn cảnh mái trường tươi đẹp.'
        ],
        skillTag: 'sap_xep_trinh_tu',
        difficulty: 'thong_hieu',
        answer: [
          'Kiến Đen bắt đầu leo lên thân cây bàng gồ ghề, sần sùi.',
          'Gặp cơn gió lớn, chú bám chặt chân gai và kiên trì nhích từng bước.',
          'Lên đến đỉnh lá bàng cao nhất, chú ngắm nhìn toàn cảnh mái trường tươi đẹp.'
        ],
        hint: 'Hành trình từ lúc bắt đầu leo -> đối mặt gió bão -> chạm tới đỉnh cao.',
        explanation: 'Trình tự hợp lý của câu chuyện khám phá thế giới.'
      },
      {
        id: 'q5',
        type: 'multiple_choice',
        prompt: 'Bài học ý nghĩa nhất em rút ra từ tấm gương của chú Kiến Đen là gì?',
        options: [
          'Lòng dũng cảm và đức tính kiên trì sẽ giúp ta vượt qua thử thách để đạt tới thành công.',
          'Không nên trèo cao vì rất nguy hiểm.',
          'Chỉ những con vật to lớn mới làm được việc phi thường.'
        ],
        skillTag: 'lien_he_van_dung',
        difficulty: 'van_dung',
        answer: 'A',
        hint: 'Suy nghĩ của Kiến Đen ở câu cuối bài: "chỉ cần không nản chí, ta sẽ mở rộng được tầm nhìn..."',
        explanation: 'Dù nhỏ bé, chỉ cần có ý chí kiên định và lòng dũng cảm, chúng ta có thể làm nên những điều tuyệt vời.'
      }
    ]
  },
  // LỚP 3 - BÀI 3
  {
    id: 'seed-lop3-bai3',
    title: 'Kho báu trong khu vườn của ông',
    topic: 'Gia đình và lao động',
    grade: 3,
    passage: `Kỳ nghỉ hè năm nay, Nam được bố mẹ cho về quê chơi với ông nội. Sau nhà ông có một mảnh vườn xanh mướt quanh năm đủ loại cây ăn trái: bưởi da xanh, xoài cát, ổi găng. 
Một hôm, Nam tò mò hỏi ông: "Ông ơi, trong vườn nhà mình có kho báu bí mật nào chôn dưới đất không ạ?". Ông nội cười hiền từ, xoa đầu Nam rồi đưa cho cậu một chiếc xẻng nhỏ: "Có chứ cháu yêu, sáng mai ông cháu mình cùng đi tìm nhé!". 
Sáng hôm sau, ông hướng dẫn Nam xới tơi từng luống đất, nhổ cỏ dại và tưới từng gáo nước mát cho cây. Trưa đến, ông hái một quả dưa hấu mát ngọt bổ cho Nam thưởng thức. 
Ông ân cần bảo: "Kho báu chính là đất đai màu mỡ và bàn tay chăm chỉ lao động đấy cháu ạ!". Nam mỉm cười gật đầu, cảm nhận được vị ngọt ngào từ mồ hôi của hai ông cháu.`,
    vocabulary: [
      { word: 'tò mò', meaning: 'Muốn biết, muốn tìm hiểu về những điều mới lạ hay bí mật.', example: 'Cậu bé tò mò mở chiếc hộp quà.' },
      { word: 'màu mỡ', meaning: 'Đất có nhiều chất dinh dưỡng tốt cho cây cối phát triển tốt tươi.', example: 'Đất phù sa ven sông rất màu mỡ.' },
      { word: 'ân cần', meaning: 'Chu đáo, nhẹ nhàng và đầy lòng yêu thương đối với người khác.', example: 'Mẹ ân cần chăm sóc em khi ốm.' }
    ],
    questions: [
      {
        id: 'q1',
        type: 'multiple_choice',
        prompt: 'Nam đã hỏi ông nội điều gì khi ở trong vườn?',
        options: [
          'Trong vườn có kho báu bí mật nào chôn dưới đất không',
          'Vườn nhà ông có bao nhiêu cây bưởi',
          'Khi nào bố mẹ sẽ về quê đón Nam'
        ],
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        relatedPassagePart: 'Nam tò mò hỏi ông: "Ông ơi, trong vườn nhà mình có kho báu bí mật nào chôn dưới đất không ạ?"',
        answer: 'A',
        hint: 'Đọc lại đoạn Nam tò mò hỏi ông về điều bí mật trong khu vườn.',
        explanation: 'Nam đã hỏi ông liệu có kho báu bí mật nào chôn dưới mảnh vườn không.'
      },
      {
        id: 'q2',
        type: 'true_false',
        prompt: 'Nhận định sau đây Đúng hay Sai: "Ông nội đã đào được một rương vàng bạc chôn dưới gốc cây xoài cho Nam."',
        statement: 'Ông nội đã đào được một rương vàng bạc chôn dưới gốc cây xoài cho Nam.',
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet',
        relatedPassagePart: 'Ông ân cần bảo: "Kho báu chính là đất đai màu mỡ và bàn tay chăm chỉ lao động đấy cháu ạ!"',
        answer: false,
        hint: 'Xem "kho báu" thực sự theo lời ông giải thích là gì.',
        explanation: 'Kho báu không phải rương vàng chôn dưới đất, mà chính là đất đai màu mỡ và sự chăm chỉ lao động. Nhận định trên là Sai.'
      },
      {
        id: 'q3',
        type: 'multiple_choice',
        prompt: 'Theo lời dặn dò của ông nội, "kho báu" thực sự là gì?',
        options: [
          'Đất đai màu mỡ và bàn tay siêng năng, chăm chỉ lao động',
          'Một chiếc rương đầy tiền vàng chôn bí mật',
          'Những quả ngọt tự nhiên mọc không cần chăm sóc'
        ],
        skillTag: 'noi_dung_chinh',
        difficulty: 'thong_hieu',
        answer: 'A',
        hint: 'Đọc lời giải thích của ông ở cuối bài.',
        explanation: 'Ông dạy Nam rằng kho báu quý giá nhất chính là sức lao động và sự chăm chỉ tạo nên quả ngọt.'
      },
      {
        id: 'q4',
        type: 'sequence',
        prompt: 'Hãy sắp xếp các công việc mà hai ông cháu Nam đã làm vào buổi sáng:',
        items: [
          'Nam hỏi ông nội về kho báu bí mật trong vườn.',
          'Hai ông cháu cùng xới đất, nhổ cỏ dại và tưới nước cho cây.',
          'Ông cháu cùng ăn dưa ngọt và ông giảng giải về ý nghĩa của lao động.'
        ],
        skillTag: 'sap_xep_trinh_tu',
        difficulty: 'thong_hieu',
        answer: [
          'Nam hỏi ông nội về kho báu bí mật trong vườn.',
          'Hai ông cháu cùng xới đất, nhổ cỏ dại và tưới nước cho cây.',
          'Ông cháu cùng ăn dưa ngọt và ông giảng giải về ý nghĩa của lao động.'
        ],
        hint: 'Thứ tự: Câu hỏi tò mò -> Thực hành lao động chăm sóc cây -> Thưởng thức thành quả và nghe lời răn dạy.',
        explanation: 'Trình tự diễn biến câu chuyện đầy tính giáo dục của hai ông cháu.'
      },
      {
        id: 'q5',
        type: 'multiple_choice',
        prompt: 'Em có thể làm những việc gì vừa sức để giúp đỡ ông bà, cha mẹ chăm sóc nhà cửa, cây cối?',
        options: [
          'Tưới cây, nhổ cỏ nhỏ, quét sân gọn gàng sau giờ học',
          'Ngồi xem ti vi cả ngày không phụ giúp việc nhà',
          'Bẻ hoa và hái quả xanh nghịch ngợm'
        ],
        skillTag: 'lien_he_van_dung',
        difficulty: 'van_dung',
        answer: 'A',
        hint: 'Những việc làm nhỏ nào thể hiện em yêu lao động và yêu thương gia đình?',
        explanation: 'Học sinh tiểu học có thể làm những việc vừa sức như tưới cây, quét dọn để rèn luyện thói quen lao động tốt.'
      }
    ]
  }
];

export function findSeedLesson(lessonId: string): SeedLesson | undefined {
  return SEED_LESSONS.find((l) => l.id === lessonId);
}

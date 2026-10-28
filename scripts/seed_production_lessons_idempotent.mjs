/**
 * EM YÊU TIẾNG VIỆT — SEED 6 BÀI ĐỌC MẪU CHUẨN GDPT 2018 LÊN PRODUCTION
 * Tự động tạo idempotent: lessons, versions, và privateAnswerKeys
 * Bảo đảm: KHÔNG ghi đè, KHÔNG xóa dữ liệu cũ, KHÔNG tạo bản sao
 */

import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const saPath = path.resolve(__dirname, 'backups/emyeutiengviet-prod-adminsdk.json');
if (!fs.existsSync(saPath)) {
  console.error('Không tìm thấy service account tại:', saPath);
  process.exit(1);
}

const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    projectId: sa.project_id
  });
}

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

// 6 Chuẩn học liệu mẫu
const SEED_LESSONS = [
  {
    id: 'seed-lop2-bai1',
    title: 'Chim sâu nhỏ và vườn cam',
    topic: 'Thiên nhiên tươi đẹp',
    grade: 2,
    semester: 1,
    week: 3,
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
        prompt: 'Chim sâu nhỏ thức dậy vào thời điểm nào trong ngày?',
        options: ['A. Khi mặt trời vừa nhô lên sau rặng tre', 'B. Khi trời đã chuyển sang buổi trưa', 'C. Khi hoàng hôn buông xuống'],
        answer: 'A',
        hint: 'Em hãy đọc kỹ câu văn đầu tiên của bài đọc.',
        explanation: 'Bài đọc viết: "Sáng sớm, mặt trời vừa nhô lên sau rặng tre, chim sâu nhỏ đã thức dậy."',
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet'
      },
      {
        id: 'q2',
        type: 'true_false',
        prompt: 'Nhận định sau Đúng hay Sai: "Bác làm vườn khen ngợi chim sâu nhỏ vì chú đã bắt sâu giúp cây cam."',
        statement: 'Bác làm vườn khen ngợi chim sâu nhỏ vì chú đã bắt sâu giúp cây cam.',
        answer: true,
        hint: 'Em hãy xem bác làm vườn đã nói gì khi đi ngang qua nhé.',
        explanation: 'Bác làm vườn mỉm cười: "Cảm ơn chú chim nhỏ chăm chỉ nhé!" vì chim sâu đã mổ sâu cứu lá non.',
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet'
      },
      {
        id: 'q3',
        type: 'sequence',
        prompt: 'Em hãy sắp xếp 3 sự việc sau theo đúng trình tự câu chuyện:',
        items: [
          'Chim sâu thức dậy và chuyền cành thoăn thoắt trong vườn cam',
          'Chim sâu phát hiện và mổ trúng chú sâu béo mập đang cắn lá',
          'Bác làm vườn đi ngang qua nói lời cảm ơn chú chim chăm chỉ'
        ],
        answer: [
          'Chim sâu thức dậy và chuyền cành thoăn thoắt trong vườn cam',
          'Chim sâu phát hiện và mổ trúng chú sâu béo mập đang cắn lá',
          'Bác làm vườn đi ngang qua nói lời cảm ơn chú chim chăm chỉ'
        ],
        hint: 'Chú ý diễn biến từ lúc sáng sớm đến khi kết thúc câu chuyện.',
        explanation: 'Trình tự diễn biến: Thức dậy chuyền cành -> Bắt sâu non -> Được bác làm vườn cảm ơn.',
        skillTag: 'sap_xep_trinh_tu',
        difficulty: 'thong_hieu'
      },
      {
        id: 'q4',
        type: 'matching',
        prompt: 'Em hãy nối từ ngữ ở cột trái với ý nghĩa phù hợp ở cột phải:',
        pairs: [
          { left: 'Thoăn thoắt', right: 'Cử động rất nhanh và liên tiếp' },
          { left: 'Gặm nhấm', right: 'Cắn từng miếng nhỏ một cách từ từ' },
          { left: 'Líu lo', right: 'Tiếng chim hót trong trẻo, vui tai' }
        ],
        answer: {
          'Thoăn thoắt': 'Cử động rất nhanh và liên tiếp',
          'Gặm nhấm': 'Cắn từng miếng nhỏ một cách từ từ',
          'Líu lo': 'Tiếng chim hót trong trẻo, vui tai'
        },
        hint: 'Dựa vào bảng từ khó được giải nghĩa trong bài đọc.',
        explanation: 'Thoăn thoắt là cử động nhanh; Gặm nhấm là cắn từng miếng nhỏ; Líu lo là tiếng hót trong trẻo.',
        skillTag: 'tu_trong_ngu_canh',
        difficulty: 'thong_hieu'
      },
      {
        id: 'q5',
        type: 'fill_blank',
        prompt: 'Điền 1 từ thích hợp trong bài đọc vào chỗ trống: "Chim sâu nhỏ chăm chú nhìn từng kẽ lá [...] mướt."',
        passageWithBlanks: 'Chim sâu nhỏ chăm chú nhìn từng kẽ lá [blank_1] mướt.',
        blanks: [{ id: 'blank_1', acceptedAnswers: ['xanh'] }],
        answer: { blank_1: 'xanh' },
        hint: 'Từ này chỉ màu sắc tươi tắn của những chiếc lá cam non.',
        explanation: 'Bài đọc viết: "chăm chú nhìn từng kẽ lá xanh mướt."',
        skillTag: 'noi_dung_chinh',
        difficulty: 'thong_hieu'
      }
    ]
  },
  {
    id: 'seed-lop2-bai2',
    title: 'Đôi bạn ở xóm Hoa',
    topic: 'Tình bạn bè thân thiết',
    grade: 2,
    semester: 1,
    week: 5,
    passage: `Ở xóm Hoa có Cún Con và Mèo Vàng là đôi bạn rất thân. Hằng ngày, hai bạn cùng nhau tung tăng đến trường tiểu học. 
Một buổi chiều nọ, khi đang trên đường đi học về, trời bỗng đổ một cơn mưa rào mùa hạ thật lớn. Mèo Vàng chẳng may quên mang theo chiếc ô che mưa nên co ro vì sợ ướt lông. 
Thấy vậy, Cún Con liền nhanh chân chạy lại gần, xòe rộng chiếc ô vàng xinh xắn của mình ra và nói: "Bạn vào đây che chung với mình nhé, chúng mình cùng về nhà!". 
Mèo Vàng cảm động nép sát vào người bạn tốt. Hai chú bạn nhỏ cùng nhau bước đi dưới màn mưa ấm áp, vừa đi vừa hát ca vui vẻ.`,
    vocabulary: [
      { word: 'co ro', meaning: 'Thu mình lại vì lạnh hoặc vì sợ hãi.', example: 'Mèo con co ro dưới mái hiên.' },
      { word: 'tung tăng', meaning: 'Đi lại một cách vui vẻ, thoải mái và hồn nhiên.', example: 'Các bạn nhỏ tung tăng đến trường.' }
    ],
    questions: [
      {
        id: 'q1',
        type: 'multiple_choice',
        prompt: 'Khi gặp cơn mưa rào, chuyện gì đã xảy ra với Mèo Vàng?',
        options: ['A. Mèo Vàng quên mang theo ô nên co ro vì sợ ướt', 'B. Mèo Vàng đã chạy thật nhanh về nhà trước', 'C. Mèo Vàng tìm được chiếc ô to dưới gốc cây'],
        answer: 'A',
        hint: 'Em hãy đọc đoạn văn miêu tả lúc trời đổ mưa rào nhé.',
        explanation: 'Bài đọc nêu rõ: "Mèo Vàng chẳng may quên mang theo chiếc ô che mưa nên co ro vì sợ ướt lông."',
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet'
      },
      {
        id: 'q2',
        type: 'true_false',
        prompt: 'Nhận định sau Đúng hay Sai: "Cún Con đã từ chối chia sẻ ô vì sợ ô quá nhỏ không che đủ cho cả hai bạn."',
        statement: 'Cún Con đã từ chối chia sẻ ô vì sợ ô quá nhỏ không che đủ cho cả hai bạn.',
        answer: false,
        hint: 'Xem hành động của Cún Con khi thấy bạn Mèo Vàng bị ướt.',
        explanation: 'Cún Con không hề từ chối mà liền chạy lại gần, xòe rộng chiếc ô che chung cho Mèo Vàng.',
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet'
      },
      {
        id: 'q3',
        type: 'sequence',
        prompt: 'Sắp xếp đúng diễn biến câu chuyện tình bạn:',
        items: [
          'Trời đổ cơn mưa rào mùa hạ, Mèo Vàng quên mang ô',
          'Cún Con xòe rộng chiếc ô vàng rủ bạn che chung',
          'Hai bạn nép sát vào nhau, vừa đi vừa hát ca vui vẻ'
        ],
        answer: [
          'Trời đổ cơn mưa rào mùa hạ, Mèo Vàng quên mang ô',
          'Cún Con xòe rộng chiếc ô vàng rủ bạn che chung',
          'Hai bạn nép sát vào nhau, vừa đi vừa hát ca vui vẻ'
        ],
        hint: 'Thứ tự từ lúc bắt đầu mưa đến khi hai bạn cùng về nhà.',
        explanation: 'Diễn biến: Mưa rào đến -> Cún Con che ô chung -> Hai bạn ấm áp cùng về nhà.',
        skillTag: 'sap_xep_trinh_tu',
        difficulty: 'thong_hieu'
      },
      {
        id: 'q4',
        type: 'matching',
        prompt: 'Nối nhân vật với hành động tương ứng trong câu chuyện:',
        pairs: [
          { left: 'Mèo Vàng', right: 'Quên mang ô và co ro vì sợ ướt lông' },
          { left: 'Cún Con', right: 'Xòe rộng ô vàng và mời bạn che chung' }
        ],
        answer: {
          'Mèo Vàng': 'Quên mang ô và co ro vì sợ ướt lông',
          'Cún Con': 'Xòe rộng ô vàng và mời bạn che chung'
        },
        hint: 'Xem mỗi nhân vật đã làm gì trong cơn mưa.',
        explanation: 'Mèo Vàng quên ô co ro; Cún Con chia sẻ chiếc ô vàng.',
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet'
      },
      {
        id: 'q5',
        type: 'multiple_choice',
        prompt: 'Qua câu chuyện trên, em học được bài học gì về tình bạn?',
        options: ['A. Bạn bè cần biết quan tâm, sẻ chia và giúp đỡ nhau khi gặp khó khăn', 'B. Chỉ nên chơi với bạn khi trời nắng ráo', 'C. Luôn đi học về một mình để không phải chia sẻ đồ dùng'],
        answer: 'A',
        hint: 'Hành động đẹp của Cún Con mang lại ý nghĩa gì?',
        explanation: 'Câu chuyện ca ngợi tình bạn đẹp, biết chia sẻ, đùm bọc lẫn nhau.',
        skillTag: 'lien_he_van_dung',
        difficulty: 'van_dung'
      }
    ]
  },
  {
    id: 'seed-lop2-bai3',
    title: 'Dòng suối quê em',
    topic: 'Quê hương đất nước',
    grade: 2,
    semester: 1,
    week: 16,
    passage: `Sau lưng ngôi trường tiểu học của em có một con suối nhỏ chảy quanh năm. Nước suối trong vắt nhìn thấy rõ từng đàn cá tung tăng bơi lội dưới đáy sỏi. 
Vào những buổi trưa hè oi ả, tiếng suối róc rách như một khúc nhạc vui tai ru êm giấc ngủ trưa của bản làng. 
Người dân trong xóm thường bảo nhau cùng giữ gìn con suối luôn sạch trong. Các bạn học sinh tuyệt đối không vứt rác xuống lòng suối để nguồn nước mát lành mãi phục vụ đời sống bà con quê hương.`,
    vocabulary: [
      { word: 'trong vắt', meaning: 'Rất trong, có thể nhìn xuyên thấu qua một cách rõ ràng.', example: 'Nước suối trong vắt nhìn thấy đáy sỏi.' },
      { word: 'oi ả', meaning: 'Nóng nực và lặng gió, gây cảm giác khó chịu.', example: 'Buổi trưa hè trời oi ả.' }
    ],
    questions: [
      {
        id: 'q1',
        type: 'multiple_choice',
        prompt: 'Nước con suối nhỏ được miêu tả như thế nào?',
        options: ['A. Nước suối trong vắt, thấy rõ đàn cá bơi lội', 'B. Nước suối đục ngầu sau cơn lũ lớn', 'C. Nước suối cạn khô không có bóng cá'],
        answer: 'A',
        hint: 'Đọc câu văn thứ hai trong bài đọc.',
        explanation: 'Bài đọc viết: "Nước suối trong vắt nhìn thấy rõ từng đàn cá tung tăng bơi lội dưới đáy sỏi."',
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet'
      },
      {
        id: 'q2',
        type: 'true_false',
        prompt: 'Nhận định sau Đúng hay Sai: "Các bạn học sinh được nhắc nhở tuyệt đối không vứt rác xuống lòng suối."',
        statement: 'Các bạn học sinh được nhắc nhở tuyệt đối không vứt rác xuống lòng suối.',
        answer: true,
        hint: 'Đọc câu văn cuối cùng của bài đọc.',
        explanation: 'Bài đọc nêu rõ: "Các bạn học sinh tuyệt đối không vứt rác xuống lòng suối để nguồn nước mát lành..."',
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet'
      },
      {
        id: 'q3',
        type: 'fill_blank',
        prompt: 'Điền từ còn thiếu vào câu sau: "Tiếng suối [...] rách như một khúc nhạc vui tai ru êm giấc ngủ."',
        passageWithBlanks: 'Tiếng suối [blank_1] rách như một khúc nhạc vui tai ru êm giấc ngủ.',
        blanks: [{ id: 'blank_1', acceptedAnswers: ['róc'] }],
        answer: { blank_1: 'róc' },
        hint: 'Từ mô phỏng tiếng nước chảy luồn qua các khe đá sỏi.',
        explanation: 'Từ cần điền là "róc" (róc rách).',
        skillTag: 'tu_trong_ngu_canh',
        difficulty: 'thong_hieu'
      },
      {
        id: 'q4',
        type: 'multiple_choice',
        prompt: 'Tiếng suối róc rách vào buổi trưa hè được so sánh với điều gì?',
        options: ['A. Như một khúc nhạc vui tai ru êm giấc ngủ', 'B. Như tiếng sấm rền vang giữa trời', 'C. Như tiếng còi tàu hỏa từ xa'],
        answer: 'A',
        hint: 'Tìm từ "như" trong câu miêu tả tiếng suối.',
        explanation: 'Bài đọc viết: "tiếng suối róc rách như một khúc nhạc vui tai ru êm giấc ngủ trưa..."',
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet'
      },
      {
        id: 'q5',
        type: 'multiple_choice',
        prompt: 'Em cần làm gì để bảo vệ nguồn nước sạch ở trường học và địa phương?',
        options: ['A. Bỏ rác đúng nơi quy định và nhắc nhở mọi người không xả rác bừa bãi', 'B. Tiện tay ném túi ni lông xuống mương rãnh', 'C. Rửa đồ bẩn trực tiếp vào nguồn nước sạch sinh hoạt'],
        answer: 'A',
        hint: 'Hành động nào thể hiện ý thức giữ gìn vệ sinh môi trường?',
        explanation: 'Bỏ rác đúng nơi quy định giúp bảo vệ môi trường và giữ nguồn nước sạch.',
        skillTag: 'lien_he_van_dung',
        difficulty: 'van_dung'
      }
    ]
  },
  {
    id: 'seed-lop3-bai1',
    title: 'Hương cốm mùa thu',
    topic: 'Nét đẹp văn hóa truyền thống',
    grade: 3,
    semester: 1,
    week: 3,
    passage: `Khi cơn gió heo may đầu mùa se se lạnh thổi về mang theo hương cốm nồng nàn, ấy là lúc mùa thu đã sang. 
Từng hạt cốm xanh ngọc nõn nà, dẻo thơm được bọc cẩn thận trong hai lớp lá: lớp lá ráy tươi mát giữ cho cốm không bị khô, và lớp lá sen thơm ngát ủ trọn phong vị đồng quê thanh tao. 
Cốm không phải là thức quà ăn vội. Người Hà Nội xưa thường nhâm nhi từng nhúm cốm nhỏ bên chén trà sen ngát hương, chậm rãi cảm nhận trọn vẹn vị ngọt thanh mát, béo bùi của bông lúa non hòa quyện cùng đất trời.`,
    vocabulary: [
      { word: 'heo may', meaning: 'Gió nhẹ, hơi lạnh và khô thường thổi vào mùa thu miền Bắc.', example: 'Gió heo may mang hơi lạnh đầu mùa.' },
      { word: 'nõn nà', meaning: 'Mịn màng, mỡ màng và trông rất tươi sạch, đẹp mắt.', example: 'Những hạt cốm nõn nà màu ngọc biếc.' },
      { word: 'thanh tao', meaning: 'Thanh lịch, trang nhã, không thô tục.', example: 'Hương vị trà sen thanh tao.' }
    ],
    questions: [
      {
        id: 'q1',
        type: 'multiple_choice',
        prompt: 'Từng hạt cốm xanh ngọc được bọc cẩn thận bằng những loại lá nào?',
        options: ['A. Lớp lá ráy tươi mát và lớp lá sen thơm ngát', 'B. Lớp lá chuối khô và lớp lá sen', 'C. Lớp lá dong xanh và lá ổi non'],
        answer: 'A',
        hint: 'Đọc kỹ đoạn văn miêu tả hai lớp lá gói cốm.',
        explanation: 'Bài đọc viết: "bọc cẩn thận trong hai lớp lá: lớp lá ráy tươi mát... và lớp lá sen thơm ngát..."',
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet'
      },
      {
        id: 'q2',
        type: 'true_false',
        prompt: 'Nhận định sau Đúng hay Sai: "Cốm là món ăn vặt ăn vội vã trên đường phố để nhanh no."',
        statement: 'Cốm là món ăn vặt ăn vội vã trên đường phố để nhanh no.',
        answer: false,
        hint: 'Đọc câu mở đầu đoạn 3: "Cốm không phải là..."',
        explanation: 'Bài đọc khẳng định: "Cốm không phải là thức quà ăn vội. Người Hà Nội xưa thường nhâm nhi từng nhúm cốm nhỏ..."',
        skillTag: 'noi_dung_chinh',
        difficulty: 'thong_hieu'
      },
      {
        id: 'q3',
        type: 'sequence',
        prompt: 'Sắp xếp các ý theo đúng trình tự nội dung bài viết:',
        items: [
          'Gió heo may báo hiệu mùa thu và mùa cốm về',
          'Miêu tả vẻ đẹp của hạt cốm và hai lớp lá gói cẩn thận',
          'Cách thưởng thức cốm chậm rãi bên chén trà sen thanh tao'
        ],
        answer: [
          'Gió heo may báo hiệu mùa thu và mùa cốm về',
          'Miêu tả vẻ đẹp của hạt cốm và hai lớp lá gói cẩn thận',
          'Cách thưởng thức cốm chậm rãi bên chén trà sen thanh tao'
        ],
        hint: 'Dõi theo cấu trúc 3 đoạn văn của bài đọc.',
        explanation: 'Bài văn đi từ giới thiệu mùa thu -> miêu tả hạt cốm -> cách thưởng thức.',
        skillTag: 'sap_xep_trinh_tu',
        difficulty: 'thong_hieu'
      },
      {
        id: 'q4',
        type: 'matching',
        prompt: 'Nối loại lá với công dụng gói cốm được nhắc tới trong bài:',
        pairs: [
          { left: 'Lá ráy', right: 'Giữ cho hạt cốm không bị khô' },
          { left: 'Lá sen', right: 'Ủ trọn phong vị đồng quê thơm ngát' }
        ],
        answer: {
          'Lá ráy': 'Giữ cho hạt cốm không bị khô',
          'Lá sen': 'Ủ trọn phong vị đồng quê thơm ngát'
        },
        hint: 'Đọc kỹ đoạn miêu tả tác dụng của từng lớp lá.',
        explanation: 'Lá ráy giữ ẩm; lá sen đem lại hương thơm ngát.',
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet'
      },
      {
        id: 'q5',
        type: 'multiple_choice',
        prompt: 'Từ "heo may" trong câu đầu chỉ hiện tượng thời tiết nào?',
        options: ['A. Gió nhẹ, se lạnh và khô báo hiệu mùa thu', 'B. Cơn bão giông kèm mưa đá lớn', 'C. Gió lốc xoáy giữa trưa hè nắng gắt'],
        answer: 'A',
        hint: 'Xem phần giải nghĩa từ vựng "heo may".',
        explanation: 'Gió heo may là ngọn gió se lạnh đặc trưng của mùa thu phương Bắc.',
        skillTag: 'tu_trong_ngu_canh',
        difficulty: 'thong_hieu'
      }
    ]
  },
  {
    id: 'seed-lop3-bai2',
    title: 'Chuyến thám hiểm của Kiến Đen',
    topic: 'Bài học tinh thần đồng đội',
    grade: 3,
    semester: 1,
    week: 6,
    passage: `Kiến Đen là một chú kiến vô cùng tò mò và ham thích khám phá thế giới xung quanh. Một hôm, chú quyết định bò lên ngọn cây ổi cao chót vót ở góc vườn để ngắm nhìn toàn cảnh xóm nhỏ. 
Trên đường leo lên, chú gặp phải một khe nứt sâu hoắm trên thân cây sần sùi. Cố gắng mãi một mình, chú vẫn không tài nào vượt qua được chướng ngại vật khổng lồ ấy. 
Đúng lúc sắp nản lòng, một đàn kiến thợ đi ngang qua thấy vậy liền cùng nhau bắc thành một chiếc cầu sống vững chãi nối hai bờ khe nứt. 
Nhờ sự đoàn kết và tương trợ tuyệt vời của cả bầy đàn, Kiến Đen đã đặt chân lên ngọn cây cao vút, thỏa thích ngắm nhìn bầu trời xanh bao la. Chú thầm cảm ơn những người bạn đồng đội dũng cảm của mình.`,
    vocabulary: [
      { word: 'chót vót', meaning: 'Rất cao, ở vị trí cao hẳn lên so với xung quanh.', example: 'Cây ổi cao chót vót đầu ngõ.' },
      { word: 'chướng ngại vật', meaning: 'Vật gây trở ngại, ngăn cản sự di chuyển hoặc tiến lên.', example: 'Khe nứt là chướng ngại vật lớn.' },
      { word: 'tương trợ', meaning: 'Giúp đỡ lẫn nhau cùng vượt qua thử thách.', example: 'Bầy kiến tương trợ nhau làm cầu sống.' }
    ],
    questions: [
      {
        id: 'q1',
        type: 'multiple_choice',
        prompt: 'Kiến Đen gặp phải khó khăn gì khi cố gắng leo lên ngọn cây ổi?',
        options: ['A. Gặp một khe nứt sâu hoắm trên thân cây không tự qua được', 'B. Bị một chú chim sâu đuổi bắt ráo riết', 'C. Trời bất ngờ đổ mưa làm ướt cánh kiến'],
        answer: 'A',
        hint: 'Đọc đoạn văn thứ hai miêu tả chướng ngại vật.',
        explanation: 'Bài đọc viết: "chú gặp phải một khe nứt sâu hoắm trên thân cây... không tài nào vượt qua được."',
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet'
      },
      {
        id: 'q2',
        type: 'true_false',
        prompt: 'Nhận định sau Đúng hay Sai: "Đàn kiến thợ đã cùng nhau nối đuôi bắc thành chiếc cầu sống để giúp Kiến Đen vượt qua khe nứt."',
        statement: 'Đàn kiến thợ đã cùng nhau nối đuôi bắc thành chiếc cầu sống để giúp Kiến Đen vượt qua khe nứt.',
        answer: true,
        hint: 'Đọc cách đàn kiến thợ giải quyết khó khăn.',
        explanation: 'Bài đọc nêu: "liền cùng nhau bắc thành một chiếc cầu sống vững chãi nối hai bờ khe nứt."',
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet'
      },
      {
        id: 'q3',
        type: 'sequence',
        prompt: 'Sắp xếp đúng trình tự chuyến phiêu lưu của Kiến Đen:',
        items: [
          'Kiến Đen quyết định leo lên ngọn ổi cao chót vót',
          'Gặp khe nứt sâu và đàn kiến thợ bắc cầu sống giúp đỡ',
          'Lên tới ngọn cây ngắm nhìn bầu trời xanh bao la'
        ],
        answer: [
          'Kiến Đen quyết định leo lên ngọn ổi cao chót vót',
          'Gặp khe nứt sâu và đàn kiến thợ bắc cầu sống giúp đỡ',
          'Lên tới ngọn cây ngắm nhìn bầu trời xanh bao la'
        ],
        hint: 'Thứ tự từ lúc bắt đầu leo cây tới khi lên đến đích.',
        explanation: 'Diễn biến: Khởi hành -> Gặp trở ngại được giúp đỡ -> Đạt được mục tiêu.',
        skillTag: 'sap_xep_trinh_tu',
        difficulty: 'thong_hieu'
      },
      {
        id: 'q4',
        type: 'matching',
        prompt: 'Nối từ khóa với ý nghĩa tương ứng trong bài học:',
        pairs: [
          { left: 'Cầu sống', right: 'Sự đoàn kết nối kết nhau của cả đàn kiến' },
          { left: 'Chướng ngại vật', right: 'Khe nứt sâu hoắm trên thân cây ổi' }
        ],
        answer: {
          'Cầu sống': 'Sự đoàn kết nối kết nhau của cả đàn kiến',
          'Chướng ngại vật': 'Khe nứt sâu hoắm trên thân cây ổi'
        },
        hint: 'Xem hình ảnh ẩn dụ và sự việc trong bài.',
        explanation: 'Cầu sống tượng trưng cho đoàn kết; chướng ngại vật là khe nứt.',
        skillTag: 'noi_dung_chinh',
        difficulty: 'thong_hieu'
      },
      {
        id: 'q5',
        type: 'multiple_choice',
        prompt: 'Câu chuyện gửi gắm bài học sâu sắc nào cho các em học sinh?',
        options: ['A. Sức mạnh của tinh thần đoàn kết và tương trợ lẫn nhau', 'B. Nên hành động đơn độc không cần ai giúp đỡ', 'C. Không bao giờ nên ước mơ hay khám phá thế giới'],
        answer: 'A',
        hint: 'Nhờ đâu mà Kiến Đen vượt qua được khe nứt?',
        explanation: 'Nhờ có sự đoàn kết của đàn kiến thợ, khó khăn lớn cũng được giải quyết.',
        skillTag: 'lien_he_van_dung',
        difficulty: 'van_dung'
      }
    ]
  },
  {
    id: 'seed-lop3-bai3',
    title: 'Kho báu trong khu vườn của ông',
    topic: 'Tình cảm gia đình và lao động',
    grade: 3,
    semester: 1,
    week: 15,
    passage: `Khu vườn của ông nội xanh ngát một màu với đủ các loài cây trái xum xuê. Mỗi dịp hè về, bé An lại theo chân ông ra vườn, cặm cụi học cách vun xới từng gốc cây, nhổ cỏ dại và tưới từng gáo nước mát lành. 
Một hôm, An tò mò ngước mắt hỏi: "Ông ơi, trong vườn nhà mình có kho báu bí mật nào như trong truyện cổ tích không hả ông?". 
Ông nội mỉm cười đôn hậu, xoa đầu An rồi chỉ tay vào luống cà chua sai trĩu quả chín mọng: "Kho báu chính là những quả ngọt lành được tạo nên từ đôi bàn tay cần cù lao động đấy cháu yêu ạ!". 
An ngắm nhìn những giọt mồ hôi lấp lánh trên vầng trán nhăn nheo của ông, khẽ gật đầu hiểu ra bài học quý giá.`,
    vocabulary: [
      { word: 'cặm cụi', meaning: 'Chăm chú, miệt mài làm việc không ngừng nghỉ.', example: 'Hai ông cháu cặm cụi vun gốc cây.' },
      { word: 'đôn hậu', meaning: 'Hiền lành, thật thà và giàu lòng nhân ái.', example: 'Nụ cười đôn hậu của ông nội.' }
    ],
    questions: [
      {
        id: 'q1',
        type: 'multiple_choice',
        prompt: 'Theo lời ông nội, "kho báu" thực sự trong khu vườn là gì?',
        options: ['A. Những quả ngọt lành được tạo nên từ đôi bàn tay cần cù lao động', 'B. Một hòm vàng bạc châu báu chôn sâu dưới lòng đất', 'C. Chiếc xẻng thần kỳ biết tự động xới đất'],
        answer: 'A',
        hint: 'Đọc câu trả lời đôn hậu của ông nội ở đoạn 3.',
        explanation: 'Ông nội mỉm cười bảo: "Kho báu chính là những quả ngọt lành được tạo nên từ đôi bàn tay cần cù lao động..."',
        skillTag: 'noi_dung_chinh',
        difficulty: 'thong_hieu'
      },
      {
        id: 'q2',
        type: 'true_false',
        prompt: 'Nhận định sau Đúng hay Sai: "Bé An không thích ra vườn mà chỉ muốn ở trong nhà xem ti vi."',
        statement: 'Bé An không thích ra vườn mà chỉ muốn ở trong nhà xem ti vi.',
        answer: false,
        hint: 'Đọc câu thứ hai trong bài đọc: "Mỗi dịp hè về..."',
        explanation: 'Bài đọc viết: "Mỗi dịp hè về, bé An lại theo chân ông ra vườn, cặm cụi học cách vun xới..."',
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet'
      },
      {
        id: 'q3',
        type: 'fill_blank',
        prompt: 'Điền từ còn thiếu vào câu sau: "Ông nội mỉm cười [...], xoa đầu An rồi chỉ tay vào luống cà chua trĩu quả."',
        passageWithBlanks: 'Ông nội mỉm cười [blank_1], xoa đầu An rồi chỉ tay vào luống cà chua trĩu quả.',
        blanks: [{ id: 'blank_1', acceptedAnswers: ['đôn hậu'] }],
        answer: { blank_1: 'đôn hậu' },
        hint: 'Từ ghép chỉ nét mặt hiền từ, nhân ái của người già.',
        explanation: 'Từ cần điền là "đôn hậu".',
        skillTag: 'tu_trong_ngu_canh',
        difficulty: 'thong_hieu'
      },
      {
        id: 'q4',
        type: 'matching',
        prompt: 'Nối hoạt động của bé An và ông nội trong khu vườn:',
        pairs: [
          { left: 'Vun xới, tưới nước', right: 'Chăm sóc từng gốc cây để ra hoa kết trái' },
          { left: 'Nụ cười đôn hậu', right: 'Tình yêu thương và bài học cuộc sống của ông' }
        ],
        answer: {
          'Vun xới, tưới nước': 'Chăm sóc từng gốc cây để ra hoa kết trái',
          'Nụ cười đôn hậu': 'Tình yêu thương và bài học cuộc sống của ông'
        },
        hint: 'Xem ý nghĩa của việc lao động và tình cảm ông cháu.',
        explanation: 'Lao động vun xới đem lại quả ngọt; nụ cười đôn hậu trao gửi bài học quý.',
        skillTag: 'noi_dung_chinh',
        difficulty: 'thong_hieu'
      },
      {
        id: 'q5',
        type: 'multiple_choice',
        prompt: 'Chi tiết "những giọt mồ hôi lấp lánh trên vầng trán của ông" gợi cho em cảm xúc gì?',
        options: ['A. Lòng kính trọng, biết ơn sự vất vả và tình yêu thương của ông', 'B. Sự thờ ơ, không quan tâm đến người lớn', 'C. Cảm giác sợ hãi khi phải ra vườn làm việc'],
        answer: 'A',
        hint: 'Cảm nhận tấm lòng của người ông qua những giọt mồ hôi cần cù.',
        explanation: 'Hình ảnh giọt mồ hôi trên trán ông thể hiện sự hy sinh thầm lặng, nhắc nhở lòng biết ơn sâu sắc.',
        skillTag: 'lien_he_van_dung',
        difficulty: 'van_dung'
      }
    ]
  }
];

async function seedProduction() {
  console.log('========================================================================');
  console.log('TIẾN HÀNH SEED 6 BÀI HỌC MẪU CHUẨN LÊN FIRESTORE (PROJECT: emyeutiengviet-prod)');
  console.log('========================================================================\n');

  for (const lesson of SEED_LESSONS) {
    const lessonId = lesson.id;
    const versionId = `${lessonId}-v1`;

    console.log(`Kiểm tra bài: [${lessonId}] "${lesson.title}"...`);

    const lessonRef = db.collection('lessons').doc(lessonId);
    const versionRef = lessonRef.collection('versions').doc(versionId);
    const answerKeyRef = db.collection('privateAnswerKeys').doc(versionId);

    const [lessonDoc, versionDoc, answerKeyDoc] = await Promise.all([
      lessonRef.get(),
      versionRef.get(),
      answerKeyRef.get()
    ]);

    const batch = db.batch();
    let updated = false;

    // 1. Lesson Doc
    if (!lessonDoc.exists) {
      console.log(`  -> Tạo mới document: lessons/${lessonId}`);
      batch.set(lessonRef, {
        id: lessonId,
        teacherUid: 'system',
        title: lesson.title,
        topic: lesson.topic,
        grade: lesson.grade,
        semester: lesson.semester,
        week: lesson.week,
        academicYearScope: 'shared',
        academicYear: '2026-2027',
        passage: lesson.passage,
        vocabulary: lesson.vocabulary,
        status: 'published',
        currentVersionId: versionId,
        currentVersionNumber: 1,
        totalQuestions: lesson.questions.length,
        questionCount: lesson.questions.length,
        isSystemLesson: true,
        createdAt: 1700000000000,
        updatedAt: 1700000000000
      });
      updated = true;
    } else {
      console.log(`  -> Document lessons/${lessonId} đã tồn tại (Giữ nguyên).`);
    }

    // 2. Version Doc (publicQuestions: Không có đáp án / hint)
    if (!versionDoc.exists) {
      console.log(`  -> Tạo mới document: lessons/${lessonId}/versions/${versionId}`);
      const publicQuestions = lesson.questions.map(q => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        options: q.options || undefined,
        statement: q.statement || undefined,
        items: q.items || undefined,
        pairs: q.pairs || undefined,
        passageWithBlanks: q.passageWithBlanks || undefined,
        blanks: q.blanks || undefined,
        skillTag: q.skillTag,
        difficulty: q.difficulty
      }));

      batch.set(versionRef, {
        versionId,
        lessonId,
        versionNumber: 1,
        title: lesson.title,
        passage: lesson.passage,
        grade: lesson.grade,
        topic: lesson.topic,
        semester: lesson.semester,
        week: lesson.week,
        vocabulary: lesson.vocabulary,
        publicQuestions,
        totalQuestions: lesson.questions.length,
        status: 'published',
        createdAt: 1700000000000,
        publishedAt: 1700000000000
      });
      updated = true;
    } else {
      console.log(`  -> Document lessons/${lessonId}/versions/${versionId} đã tồn tại (Giữ nguyên).`);
    }

    // 3. Private Answer Key Doc
    if (!answerKeyDoc.exists) {
      console.log(`  -> Tạo mới document: privateAnswerKeys/${versionId}`);
      const answers = {};
      lesson.questions.forEach(q => {
        answers[q.id] = {
          questionId: q.id,
          id: q.id,
          correctAnswer: q.answer,
          answer: q.answer,
          matchingPairs: q.type === 'matching' && typeof q.answer === 'object' ? q.answer : undefined,
          hint: q.hint || '',
          explanation: q.explanation || ''
        };
      });

      batch.set(answerKeyRef, {
        versionId,
        lessonId,
        answers,
        scoringRules: {},
        createdAt: 1700000000000,
        updatedAt: 1700000000000
      });
      updated = true;
    } else {
      console.log(`  -> Document privateAnswerKeys/${versionId} đã tồn tại (Giữ nguyên).`);
    }

    if (updated) {
      await batch.commit();
      console.log(`  ✓ Đã lưu thành công dữ liệu cho bài: ${lesson.title}`);
    }
  }

  console.log('\n========================================================================');
  console.log('HOÀN TẤT SEED PRODUCTION 6 BÀI HỌC — 100% IDEMPOTENT');
  console.log('========================================================================\n');
}

seedProduction().then(() => process.exit(0)).catch(err => {
  console.error('Lỗi khi seed:', err);
  process.exit(1);
});

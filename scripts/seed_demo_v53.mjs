import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import crypto from "crypto";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

const app = initializeApp({ projectId: "em-yeu-tieng-viet-demo" });
const db = getFirestore(app);
const auth = getAuth(app);

// Crypto helpers
function generateSalt(bytes = 16) {
  return crypto.randomBytes(bytes).toString("hex");
}
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password.trim(), salt, 10000, 32, "sha256").toString("hex");
}
function hashAccessCode(code, salt) {
  return crypto.pbkdf2Sync(code.trim().toUpperCase(), salt, 10000, 32, "sha256").toString("hex");
}

// 200 Natural Vietnamese Names for 200 students
const FIRST_NAMES_BOYS = [
  "An Nhiên", "Minh Quân", "Bảo Nam", "Gia Bảo", "Hoàng Bách", "Đức Phúc", "Quang Dũng",
  "Tiến Dũng", "Nhật Nam", "Đình Trọng", "Minh Trí", "Hải Đăng", "Khánh Nam", "Tùng Dương",
  "Thái Dương", "Bảo Khang", "Trí Dũng", "Tuấn Kiệt", "Quang Vinh", "Hùng Dũng", "Thiện Nhân",
  "Huy Hoàng", "Việt Anh", "Thành Đạt", "Minh Khôi", "Đăng Khoa", "Thanh Tùng", "Gia Khiêm",
  "Trung Kiên", "Bách Tùng", "Hữu Phước", "Trọng Hiếu", "Bảo Long", "Hoàng Long", "Phúc Lâm"
];

const FIRST_NAMES_GIRLS = [
  "Phương Linh", "Bảo Châu", "Thu Thảo", "Tuệ Mẫn", "Thùy Chi", "Thanh Trúc", "Ánh Dương",
  "Thùy Linh", "Ngọc Hân", "Khánh Vy", "Hà My", "Quỳnh Anh", "Mai Chi", "Thảo Nhi",
  "Yến Nhi", "Trúc Mai", "Hoàng Yến", "Hải Yến", "Bảo Trâm", "Minh Thư", "Diệp Anh",
  "Thảo Chi", "Tú Anh", "Bích Ngọc", "Ngọc Diệp", "Khánh Linh", "Hồng Anh", "Hương Giang",
  "Thanh Thảo", "Phương Vy", "Như Ý", "Cát Tường", "Diễm My", "Lan Anh", "Mỹ Duyên"
];

const SURNAMES = [
  "Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Vũ", "Võ", "Phan", "Trương",
  "Bùi", "Đặng", "Đỗ", "Ngô", "Hồ", "Dương", "Đinh", "Đoàn", "Lâm", "Mai", "Trịnh"
];

const MIDDLE_BOYS = ["Văn", "Minh", "Gia", "Đức", "Hoàng", "Bảo", "Hải", "Tuấn", "Thanh", "Quang"];
const MIDDLE_GIRLS = ["Thị", "Phương", "Thu", "Ngọc", "Mai", "Thùy", "Khánh", "Hồng", "Kim", "Ánh"];

function generate200Names() {
  const names = [];
  let boyIdx = 0;
  let girlIdx = 0;
  let surIdx = 0;

  for (let i = 1; i <= 200; i++) {
    const isBoy = (i % 2 === 1);
    const surname = SURNAMES[surIdx % SURNAMES.length];
    surIdx++;

    let fullName = "";
    let alias = "";
    if (isBoy) {
      const mid = MIDDLE_BOYS[i % MIDDLE_BOYS.length];
      const fn = FIRST_NAMES_BOYS[boyIdx % FIRST_NAMES_BOYS.length];
      boyIdx++;
      fullName = `${surname} ${mid} ${fn}`;
      alias = `Bé ${fn}`;
    } else {
      const mid = MIDDLE_GIRLS[i % MIDDLE_GIRLS.length];
      const fn = FIRST_NAMES_GIRLS[girlIdx % FIRST_NAMES_GIRLS.length];
      girlIdx++;
      fullName = `${surname} ${mid} ${fn}`;
      alias = `Bé ${fn}`;
    }

    names.push({
      index: i,
      code: `HS${String(i).padStart(3, "0")}`,
      fullName,
      displayAlias: fullName
    });
  }
  return names;
}

// 10 Approved Original Lessons (Grade 2 & 3)
const DEMO_LESSONS = [
  // Grade 2 - Lesson 1
  {
    id: "lesson_g2_01",
    title: "Chim sâu nhỏ và vườn cam",
    grade: 2,
    topic: "Thiên nhiên tươi đẹp",
    passage: `Sáng sớm, mặt trời vừa nhô lên sau rặng tre, chim sâu nhỏ đã thức dậy. Chú chuyền cành thoăn thoắt trong vườn cam trĩu quả. Đôi mắt chú tròn xoe, chăm chú nhìn từng kẽ lá xanh mướt. Bỗng chú phát hiện một con sâu béo mập đang gặm nhấm chiếc lá non. Chim sâu nhanh nhẹn mổ trúng chú sâu, giúp cây cam không còn bị sâu cắn phá. Bác làm vườn đi ngang qua mỉm cười: "Cảm ơn chú chim nhỏ chăm chỉ nhé!". Chim sâu cất tiếng hót líu lo chào ngày mới.`,
    vocabulary: [
      { word: "thoăn thoắt", meaning: "Cử động rất nhanh và liên tiếp.", example: "Chú chim chuyền cành thoăn thoắt." },
      { word: "gặm nhấm", meaning: "Cắn từng miếng nhỏ một cách từ từ.", example: "Con sâu đang gặm nhấm chiếc lá non." },
      { word: "líu lo", meaning: "Âm thanh tiếng hót trong trẻo, vui tai.", example: "Đàn chim hót líu lo đón bình minh." }
    ],
    questions: [
      { id: "q1", type: "multiple_choice", prompt: "Chim sâu nhỏ thức dậy vào lúc nào trong ngày?", options: ["Sáng sớm", "Buổi trưa nắng gắt", "Chiều muộn"], answer: "A", skillTag: "thong_tin_truc_tiep", difficulty: "nhan_biet", hint: "Đọc lại câu đầu tiên của bài đọc.", explanation: "Bài đọc nêu rõ chim sâu nhỏ thức dậy vào sáng sớm khi mặt trời vừa nhô lên." },
      { id: "q2", type: "true_false", prompt: "Nhận định sau Đúng hay Sai: 'Con sâu béo mập đang nằm ngủ trên cành cây khô.'", statement: "Con sâu béo mập đang nằm ngủ trên cành cây khô.", answer: false, skillTag: "thong_tin_truc_tiep", difficulty: "nhan_biet", hint: "Chú ý con sâu đang làm gì trên lá non.", explanation: "Con sâu đang gặm nhấm lá non chứ không nằm ngủ trên cành khô." },
      { id: "q3", type: "multiple_choice", prompt: "Từ 'thoăn thoắt' mô tả điều gì về động tác của chú chim?", options: ["Chậm chạp, vụng về", "Nhanh nhẹn, liên tục", "Mệt mỏi, uể oải"], answer: "B", skillTag: "tu_trong_ngu_canh", difficulty: "thong_hieu", hint: "Thoăn thoắt gợi tả cử động rất nhanh nhẹn.", explanation: "'Thoăn thoắt' diễn tả động tác chuyền cành rất nhanh nhẹn và liên tiếp." },
      { id: "q4", type: "sequence", prompt: "Sắp xếp 3 sự việc sau theo đúng thứ tự bài đọc:", items: ["Chim sâu thức dậy chuyền cành trong vườn cam", "Chim sâu bắt con sâu béo mập hại lá non", "Bác làm vườn khen ngợi và cảm ơn chú chim"], answer: ["Chim sâu thức dậy chuyền cành trong vườn cam", "Chim sâu bắt con sâu béo mập hại lá non", "Bác làm vườn khen ngợi và cảm ơn chú chim"], skillTag: "sap_xep_trinh_tu", difficulty: "thong_hieu", hint: "Chim thức dậy trước, bắt sâu, rồi bác nông dân cảm ơn.", explanation: "Trình tự: Thức dậy -> Bắt sâu -> Bác làm vườn cảm ơn." },
      { id: "q5", type: "multiple_choice", prompt: "Bài đọc trên muốn gửi gắm đến chúng ta bài học gì?", options: ["Cần biết yêu quý và bảo vệ loài chim có ích", "Cây cối tự lớn lên không cần chăm sóc", "Loài sâu bọ rất đáng yêu"], answer: "A", skillTag: "lien_he_van_dung", difficulty: "van_dung", hint: "Chim sâu giúp bắt sâu bảo vệ cây cam trĩu quả.", explanation: "Chim sâu là loài chim có ích bảo vệ mùa màng, em cần yêu quý và bảo vệ chúng." }
    ]
  },
  // Grade 2 - Lesson 2
  {
    id: "lesson_g2_02",
    title: "Đôi bạn ở xóm Hoa",
    grade: 2,
    topic: "Tình bạn thân thiết",
    passage: `Ở xóm Hoa có Thỏ Trắng và Nhím Nâu là đôi bạn rất thân. Mỗi buổi sáng, hai bạn cùng nhau tung tăng cắp sách đến trường làng. Một hôm, trên đường đi học về, trời bỗng đổ mưa rào sấm chớp. Nhím Nâu không mang ô nên nép vào gốc cây sồi run rẩy. Thỏ Trắng thấy vậy liền chạy đến, xòe chiếc ô lá cọ to tròn che cho bạn. Thỏ mỉm cười: "Chúng mình cùng đi chung ô nhé!". Nhím Nâu cảm động cảm ơn bạn. Dưới chiếc ô nhỏ, đôi bạn bước đi ấm áp giữa trời mưa.`,
    vocabulary: [
      { word: "tung tăng", meaning: "Đi lại một cách vui vẻ, thoải mái.", example: "Hai bạn nhỏ tung tăng đến trường." },
      { word: "run rẩy", meaning: "Cơ thể run lên vì lạnh hoặc sợ hãi.", example: "Nhím Nâu run rẩy dưới gốc cây." },
      { word: "ấm áp", meaning: "Cảm giác dễ chịu, gần gũi và yêu thương.", example: "Tình bạn ấm áp giữa ngày mưa." }
    ],
    questions: [
      { id: "q1", type: "multiple_choice", prompt: "Thỏ Trắng và Nhím Nâu sống ở đâu?", options: ["Xóm Hoa", "Rừng Xanh", "Thung lũng Mây"], answer: "A", skillTag: "thong_tin_truc_tiep", difficulty: "nhan_biet", hint: "Xem câu mở đầu của bài đọc.", explanation: "Bài đọc bắt đầu bằng: 'Ở xóm Hoa có Thỏ Trắng và Nhím Nâu là đôi bạn rất thân.'" },
      { id: "q2", type: "true_false", prompt: "Nhận định sau Đúng hay Sai: 'Khi trời mưa to, Thỏ Trắng đã bỏ chạy về nhà một mình.'", statement: "Khi trời mưa to, Thỏ Trắng đã bỏ chạy về nhà một mình.", answer: false, skillTag: "thong_tin_truc_tiep", difficulty: "nhan_biet", hint: "Thỏ Trắng đã làm gì khi thấy bạn bị ướt?", explanation: "Thỏ Trắng đã xòe chiếc ô lá cọ che cho bạn cùng đi về." },
      { id: "q3", type: "multiple_choice", prompt: "Từ 'ấm áp' ở câu cuối bài đọc biểu thị điều gì?", options: ["Trời nắng gắt", "Tình bạn chân thành, sẻ chia", "Cơ thể bị sốt"], answer: "B", skillTag: "tu_trong_ngu_canh", difficulty: "thong_hieu", hint: "Ấm áp nói về cảm xúc giữa đôi bạn thân.", explanation: "'Ấm áp' ở đây thể hiện tình bạn chân thành, sự sẻ chia và quan tâm lẫn nhau." },
      { id: "q4", type: "sequence", prompt: "Sắp xếp 3 sự việc sau theo trình tự câu chuyện:", items: ["Trời đổ mưa to, Nhím Nâu nép dưới gốc cây sồi", "Thỏ Trắng xòe ô che cho Nhím Nâu đi chung", "Đôi bạn ấm áp cùng nhau về nhà"], answer: ["Trời đổ mưa to, Nhím Nâu nép dưới gốc cây sồi", "Thỏ Trắng xòe ô che cho Nhím Nâu đi chung", "Đôi bạn ấm áp cùng nhau về nhà"], skillTag: "sap_xep_trinh_tu", difficulty: "thong_hieu", hint: "Mưa rơi -> Thỏ che ô -> Đôi bạn cùng đi về.", explanation: "Trình tự: Gặp mưa -> Che ô chung -> Cùng về nhà bình yên." },
      { id: "q5", type: "multiple_choice", prompt: "Khi thấy bạn gặp khó khăn, em nên làm gì?", options: ["Làm ngơ bỏ đi", "Chế giễu bạn", "Sẵn sàng sẻ chia, giúp đỡ bạn"], answer: "C", skillTag: "lien_he_van_dung", difficulty: "van_dung", hint: "Học tập hành động đẹp của Thỏ Trắng.", explanation: "Khi bạn gặp khó khăn, chúng ta cần biết quan tâm, sẻ chia và giúp đỡ bạn bè." }
    ]
  },
  // Grade 2 - Lesson 3
  {
    id: "lesson_g2_03",
    title: "Dòng suối quê em",
    grade: 2,
    topic: "Quê hương tươi đẹp",
    passage: `Dòng suối quê em bắt nguồn từ khe núi cao róc rách chảy quanh năm. Nước suối trong vắt, nhìn rõ từng viên sỏi ngũ sắc lấp lánh dưới đáy. Hai bên bờ suối, những khóm hoa dại đua nhau khoe sắc vàng, tím rực rỡ. Đàn cá cờ bơi lội tung tăng như đang múa lượn. Những trưa hè oi ả, lũ trẻ chúng em thường rủ nhau ra bờ suối thả thuyền giấy. Dòng suối hiền hòa tắm mát tuổi thơ em với bao kỉ niệm êm đềm.`,
    vocabulary: [
      { word: "róc rách", meaning: "Tiếng nước chảy nhỏ, đều và vui tai.", example: "Suối chảy róc rách ngày đêm." },
      { word: "ngũ sắc", meaning: "Có năm màu sắc rực rỡ hòa trộn.", example: "Những viên sỏi ngũ sắc lấp lánh." },
      { word: "hiền hòa", meaning: "Hiền lành, êm dịu, không dữ dội.", example: "Dòng suối hiền hòa uốn lượn quanh bản làng." }
    ],
    questions: [
      { id: "q1", type: "multiple_choice", prompt: "Nước dòng suối trong bài đọc có đặc điểm gì?", options: ["Trong vắt, nhìn rõ từng viên sỏi", "Đục ngầu bùn đất", "Có màu đỏ quạch"], answer: "A", skillTag: "thong_tin_truc_tiep", difficulty: "nhan_biet", hint: "Tìm câu văn miêu tả làn nước suối.", explanation: "Bài viết: 'Nước suối trong vắt, nhìn rõ từng viên sỏi ngũ sắc lấp lánh dưới đáy.'" },
      { id: "q2", type: "true_false", prompt: "Nhận định sau Đúng hay Sai: 'Vào trưa hè oi ả, lũ trẻ ra suối thả thuyền giấy.'", statement: "Vào trưa hè oi ả, lũ trẻ ra suối thả thuyền giấy.", answer: true, skillTag: "thong_tin_truc_tiep", difficulty: "nhan_biet", hint: "Đọc câu văn gần cuối bài.", explanation: "Bài viết: 'Những trưa hè oi ả, lũ trẻ chúng em thường rủ nhau ra bờ suối thả thuyền giấy.'" },
      { id: "q3", type: "multiple_choice", prompt: "Từ 'róc rách' là từ tượng thanh diễn tả điều gì?", options: ["Tiếng gió thổi ào ào", "Tiếng nước chảy êm dịu", "Tiếng sấm sét vang trời"], answer: "B", skillTag: "tu_trong_ngu_canh", difficulty: "thong_hieu", hint: "Róc rách là âm thanh của dòng nước nhỏ.", explanation: "'Róc rách' mô tả tiếng nước suối chảy nhỏ giọt, đều đặn và êm tai." },
      { id: "q4", type: "sequence", prompt: "Sắp xếp các hình ảnh miêu tả dòng suối từ nguồn đến bờ suối:", items: ["Dòng suối bắt nguồn từ khe núi cao", "Làn nước trong vắt và sỏi ngũ sắc dưới đáy", "Khóm hoa dại khoe sắc hai bên bờ"], answer: ["Dòng suối bắt nguồn từ khe núi cao", "Làn nước trong vắt và sỏi ngũ sắc dưới đáy", "Khóm hoa dại khoe sắc hai bên bờ"], skillTag: "sap_xep_trinh_tu", difficulty: "thong_hieu", hint: "Khe núi -> Đáy suối -> Hai bên bờ.", explanation: "Thứ tự miêu tả: Nguồn gốc suối -> Làn nước đáy suối -> Cảnh sắc hai bên bờ." },
      { id: "q5", type: "multiple_choice", prompt: "Để giữ cho dòng suối luôn sạch đẹp, chúng ta phải làm gì?", options: ["Vứt rác bừa bãi xuống suối", "Không vứt rác, cùng bảo vệ nguồn nước trong sạch", "Chặt phá cây cối đầu nguồn"], answer: "B", skillTag: "lien_he_van_dung", difficulty: "van_dung", hint: "Bảo vệ môi trường tự nhiên xung quanh ta.", explanation: "Để bảo vệ dòng suối trong sạch, em cần giữ gìn vệ sinh và không xả rác bừa bãi." }
    ]
  },
  // Grade 2 - Lesson 4
  {
    id: "lesson_g2_04",
    title: "Cây bàng trước sân trường",
    grade: 2,
    topic: "Mái trường em yêu",
    passage: `Giữa sân trường em có một cây bàng sừng sững đã nhiều năm tuổi. Thân cây to bằng hai vòng tay chúng em ôm không xuể, lớp vỏ xù xì màu nâu sẫm. Mùa xuân, cây bàng đâm chồi nảy lộc, những búp non xanh biếc như những ngọn nến lung linh. Sang mùa hè, tán bàng xòe rộng như một chiếc ô khổng lồ che râm mát cả một góc sân. Dưới bóng mát của bàng, chúng em chơi nhảy dây, đọc sách và hát ca vui vẻ. Cây bàng như một người bạn lớn chứng kiến từng ngày chúng em khôn lớn.`,
    vocabulary: [
      { word: "sừng sững", meaning: "Đứng sừng lên uy nghiêm, to lớn và vững chãi.", example: "Cây bàng đứng sừng sững giữa sân trường." },
      { word: "chồi nảy lộc", meaning: "Mầm non mới nhú lên tươi tốt vào mùa xuân.", example: "Mùa xuân đến cây cối đâm chồi nảy lộc." },
      { word: "khổng lồ", meaning: "Có kích thước to lớn vượt bậc.", example: "Tán lá bàng như chiếc ô khổng lồ." }
    ],
    questions: [
      { id: "q1", type: "multiple_choice", prompt: "Vào mùa xuân, búp non của cây bàng được so sánh với hình ảnh gì?", options: ["Những ngọn nến lung linh", "Những chiếc quạt nan", "Những quả chuông nhỏ"], answer: "A", skillTag: "thong_tin_truc_tiep", difficulty: "nhan_biet", hint: "Tìm câu văn tả búp non mùa xuân.", explanation: "Bài đọc viết: 'những búp non xanh biếc như những ngọn nến lung linh.'" },
      { id: "q2", type: "true_false", prompt: "Nhận định sau Đúng hay Sai: 'Vào mùa hè, tán lá bàng che bóng mát cho học sinh vui chơi dưới sân.'", statement: "Vào mùa hè, tán lá bàng che bóng mát cho học sinh vui chơi dưới sân.", answer: true, skillTag: "thong_tin_truc_tiep", difficulty: "nhan_biet", hint: "Đọc lại đoạn miêu tả mùa hè.", explanation: "Mùa hè tán bàng xòe rộng như chiếc ô che mát góc sân cho các em vui chơi." },
      { id: "q3", type: "multiple_choice", prompt: "Từ 'xù xì' tả đặc điểm gì của cây bàng?", options: ["Lá cây mượt mà", "Vỏ thân cây gồ ghề, không phẳng nhẵn", "Hoa bàng trắng muốt"], answer: "B", skillTag: "tu_trong_ngu_canh", difficulty: "thong_hieu", hint: "Xù xì miêu tả bề mặt thân cây lâu năm.", explanation: "'Xù xì' miêu tả lớp vỏ gồ ghề, sần sùi của thân cây bàng già dặn." },
      { id: "q4", type: "sequence", prompt: "Sắp xếp sự thay đổi của cây bàng qua hai mùa xuân và hè:", items: ["Cây bàng sừng sững với thân cây to lớp vỏ xù xì", "Mùa xuân đâm chồi nảy lộc như ngọn nến", "Mùa hè xòe tán như ô khổng lồ che mát sân trường"], answer: ["Cây bàng sừng sững với thân cây to lớp vỏ xù xì", "Mùa xuân đâm chồi nảy lộc như ngọn nến", "Mùa hè xòe tán như ô khổng lồ che mát sân trường"], skillTag: "sap_xep_trinh_tu", difficulty: "thong_hieu", hint: "Tả bao quát -> Mùa xuân -> Mùa hè.", explanation: "Trình tự: Thân cây to lớn -> Mùa xuân ra lộc -> Mùa hè tỏa bóng râm." },
      { id: "q5", type: "multiple_choice", prompt: "Để bảo vệ cây bóng mát ở trường, em nên làm gì?", options: ["Khắc chữ, bẻ cành bàng", "Tưới nước, không bẻ cành ngắt lá", "Đu bám lên cành non"], answer: "B", skillTag: "lien_he_van_dung", difficulty: "van_dung", hint: "Em cần yêu thương và chăm sóc cây xanh.", explanation: "Học sinh cần chăm sóc, tưới cây và tuyệt đối không bẻ cành, khắc tên làm hại cây." }
    ]
  },
  // Grade 2 - Lesson 5
  {
    id: "lesson_g2_05",
    title: "Món quà sinh nhật của Mèo Mun",
    grade: 2,
    topic: "Bài học sẻ chia",
    passage: `Hôm nay là sinh nhật tròn hai tuổi của Mèo Mun. Mẹ tặng Mun một giỏ cá cơm rán vàng ươm, thơm nức mũi. Mun sung sướng nhảy cẫng lên. Đúng lúc đó, chú Cún Con hàng xóm đi ngang qua, bụng đói cồn cào kêu rột roẹt. Cún nhìn giỏ cá với ánh mắt thèm thuồng nhưng ngập ngừng không dám xin. Mun thoáng nghĩ: "Cá ngon thế này, mình ăn một mình mới thích!". Nhưng nhìn bạn buồn bã, Mun liền kéo tay Cún: "Cậu vào đây cùng liên hoan với tớ nhé!". Hai bạn ăn cá ngon lành và cười đùa tíu tít. Mun nhận ra, niềm vui sẻ chia còn ngọt ngào hơn vị ngon của cá rán.`,
    vocabulary: [
      { word: "thơm nức", meaning: "Mùi thơm bốc lên rất mạnh và lan tỏa rộng.", example: "Đĩa cá rán thơm nức mũi." },
      { word: "ngập ngừng", meaning: "Chần chừ, chưa dám quyết định làm điều gì.", example: "Bạn Cún ngập ngừng đứng ngoài cổng." },
      { word: "tíu tít", meaning: "Cử chỉ nói cười ríu rít, vui vẻ liên hồi.", example: "Hai bạn cười đùa tíu tít." }
    ],
    questions: [
      { id: "q1", type: "multiple_choice", prompt: "Mẹ đã tặng Mèo Mun món quà gì nhân ngày sinh nhật?", options: ["Một giỏ cá cơm rán vàng ươm", "Một quả bóng len sắc màu", "Một chiếc chuông bạc cổ"], answer: "A", skillTag: "thong_tin_truc_tiep", difficulty: "nhan_biet", hint: "Xem câu thứ hai của bài đọc.", explanation: "Bài viết rõ: 'Mẹ tặng Mun một giỏ cá cơm rán vàng ươm, thơm nức mũi.'" },
      { id: "q2", type: "true_false", prompt: "Nhận định sau Đúng hay Sai: 'Mèo Mun đã đuổi Cún Con đi để ăn cá một mình.'", statement: "Mèo Mun đã đuổi Cún Con đi để ăn cá một mình.", answer: false, skillTag: "thong_tin_truc_tiep", difficulty: "nhan_biet", hint: "Mèo Mun đã mời bạn Cún làm gì?", explanation: "Mun đã kéo tay bạn Cún vào ăn liên hoan chung cùng mình." },
      { id: "q3", type: "multiple_choice", prompt: "Từ 'tíu tít' diễn tả điều gì về cuộc trò chuyện của hai bạn?", options: ["Buồn bã, lặng lẽ", "Vui vẻ, rộn ràng, ríu rít", "Căng thẳng, cãi cọ"], answer: "B", skillTag: "tu_trong_ngu_canh", difficulty: "thong_hieu", hint: "Tíu tít thể hiện không khí vui mừng.", explanation: "'Tíu tít' diễn tả sự vui vẻ, rộn ràng và thân mật giữa đôi bạn nhỏ." },
      { id: "q4", type: "sequence", prompt: "Sắp xếp diễn biến suy nghĩ và hành động của Mèo Mun:", items: ["Mun nhận giỏ cá và muốn ăn một mình", "Mun nhìn thấy bạn Cún đói và ngập ngừng", "Mun mời Cún vào cùng liên hoan vui vẻ"], answer: ["Mun nhận giỏ cá và muốn ăn một mình", "Mun nhìn thấy bạn Cún đói và ngập ngừng", "Mun mời Cún vào cùng liên hoan vui vẻ"], skillTag: "sap_xep_trinh_tu", difficulty: "thong_hieu", hint: "Nhận quà -> Thấy bạn đói -> Quyết định sẻ chia.", explanation: "Trình tự: Nhận quà hào hứng -> Thấy bạn đói -> Thay đổi ý nghĩ và mời bạn cùng ăn." },
      { id: "q5", type: "multiple_choice", prompt: "Câu chuyện dạy cho chúng ta bài học gì quý giá?", options: ["Giữ mọi đồ ngon cho riêng mình", "Biết yêu thương, chia sẻ niềm vui với bạn bè", "Không nên mời ai đến nhà"], answer: "B", skillTag: "lien_he_van_dung", difficulty: "van_dung", hint: "Đọc câu kết của bài đọc.", explanation: "Niềm vui sẻ chia mang lại hạnh phúc ấm áp và làm cho tình bạn thêm gắn kết." }
    ]
  },

  // Grade 3 - Lesson 1
  {
    id: "lesson_g3_01",
    title: "Hương cốm mùa thu",
    grade: 3,
    topic: "Văn hóa truyền thống",
    passage: `Khi những cơn gió heo may đầu mùa bắt đầu thổi nhẹ qua các ngõ nhỏ, ấy là lúc mùa thu mang theo hương cốm nồng nàn về phố. Cốm được làm từ những bông lúa nếp non còn đượm giọt sương mai. Hạt cốm mỏng mảnh, dẻo thơm và mang màu xanh ngọc dịu mát của mầm lá. Người làm cốm gói từng nhúm cốm thơm trong chiếc lá sen già xanh thẫm, buộc lại bằng một sợi rơm vàng óng. Khi mở gói cốm ra, hương thơm thanh khiết của lúa non quyện với mùi thơm ngan ngát của lá sen tạo nên một nét quà mùa thu Hà Nội vừa thanh tao vừa mộc mạc. Ăn từng hạt cốm nhỏ, ta cảm nhận được vị ngọt bùi và tấm lòng nâng niu của người nông dân một nắng hai sương.`,
    vocabulary: [
      { word: "heo may", meaning: "Gió nhẹ, hơi khô và lành lạnh vào mùa thu.", example: "Gió heo may xao xác thổi qua phố vắng." },
      { word: "thanh khiết", meaning: "Trong sạch, tươi mát và tinh khôi.", example: "Hương thơm thanh khiết của bông lúa non." },
      { word: "thanh tao", meaning: "Trang nhã, mộc mạc và mang nét đẹp tinh tế.", example: "Cốm là món quà thanh tao của mùa thu." }
    ],
    questions: [
      { id: "q1", type: "multiple_choice", prompt: "Cốm mùa thu được làm từ nguyên liệu chính nào?", options: ["Những bông lúa nếp non đượm sương mai", "Hạt gạo tẻ đã xay xát kỹ", "Hạt ngô nếp già phơi khô"], answer: "A", skillTag: "thong_tin_truc_tiep", difficulty: "nhan_biet", hint: "Đọc câu thứ hai của bài văn.", explanation: "Bài viết: 'Cốm được làm từ những bông lúa nếp non còn đượm giọt sương mai.'" },
      { id: "q2", type: "true_false", prompt: "Nhận định sau Đúng hay Sai: 'Người làm cốm gói cốm trong chiếc lá chuối khô buộc dây cước.'", statement: "Người làm cốm gói cốm trong chiếc lá chuối khô buộc dây cước.", answer: false, skillTag: "thong_tin_truc_tiep", difficulty: "nhan_biet", hint: "Người làm cốm dùng lá gì và dây gì để gói?", explanation: "Cốm được gói trong lá sen già xanh thẫm và buộc bằng sợi rơm vàng óng." },
      { id: "q3", type: "multiple_choice", prompt: "Từ 'ngan ngát' mô tả mùi hương như thế nào?", options: ["Mùi thơm nồng gắt khó chịu", "Mùi thơm dịu nhẹ, thanh mát và lan tỏa", "Mùi khét của thức ăn"], answer: "B", skillTag: "tu_trong_ngu_canh", difficulty: "thong_hieu", hint: "Mùi hương thoang thoảng của lá sen già.", explanation: "'Ngan ngát' chỉ mùi thơm dịu nhẹ, dễ chịu, thanh khiết lan tỏa thoang thoảng." },
      { id: "q4", type: "sequence", prompt: "Sắp xếp các công đoạn thưởng thức và cảm nhận gói cốm thu:", items: ["Mở gói lá sen cảm nhận hương lúa non quyện hương sen", "Gói cốm trong lá sen già xanh buộc sợi rơm vàng", "Thưởng thức từng hạt cốm ngọt bùi nhớ ơn người nông dân"], answer: ["Gói cốm trong lá sen già xanh buộc sợi rơm vàng", "Mở gói lá sen cảm nhận hương lúa non quyện hương sen", "Thưởng thức từng hạt cốm ngọt bùi nhớ ơn người nông dân"], skillTag: "sap_xep_trinh_tu", difficulty: "thong_hieu", hint: "Gói cốm -> Mở ra ngửi hương -> Thưởng thức vị ngọt.", explanation: "Trình tự: Khâu gói cốm -> Mở thưởng thức hương thơm -> Cảm nhận vị ngọt và tấm lòng người làm ra hạt cốm." },
      { id: "q5", type: "multiple_choice", prompt: "Qua bài đọc, tác giả thể hiện tình cảm gì đối với hạt cốm mùa thu?", options: ["Sự trân trọng nét đẹp văn hóa và lòng biết ơn người lao động", "Chê bai vì hạt cốm quá nhỏ bé", "Thờ ơ không quan tâm"], answer: "A", skillTag: "lien_he_van_dung", difficulty: "van_dung", hint: "Tác giả cảm nhận sâu sắc công sức 'một nắng hai sương'.", explanation: "Tác phẩm gửi gắm sự trân trọng văn hóa truyền thống và lòng biết ơn sâu sắc người nông dân nhọc nhằn." }
    ]
  },
  // Grade 3 - Lesson 2
  {
    id: "lesson_g3_02",
    title: "Chuyến thám hiểm của Kiến Đen",
    grade: 3,
    topic: "Thế giới loài vật & Tinh thần đồng đội",
    passage: `Kiến Đen là một chú kiến thợ dũng cảm và luôn tò mò về thế giới bên ngoài tổ đất. Một buổi sáng, Kiến Đen quyết định thực hiện chuyến thám hiểm tới bờ suối để tìm nguồn thức ăn mới cho đàn. Trên đường đi, chú phải băng qua một bãi sỏi lởm chởm và vượt qua một con mương nhỏ nước chảy xiết. Thay vì bỏ cuộc, Kiến Đen nhanh trí leo lên một chiếc lá khô trôi dạt để làm thuyền vượt mương. Khi tới bờ bên kia, chú vui sướng phát hiện một mảnh bánh mì ngọt khổng lồ thơm phức. Kiến Đen biết mình không thể mang chiếc bánh một mình, liền nhanh chóng trở về tổ đánh dấu đường đi. Chỉ một lát sau, cả đàn kiến đã cùng nhau hợp sức, nhịp nhàng khiêng thức ăn về tổ trước khi trời đổ cơn mưa giông.`,
    vocabulary: [
      { word: "thám hiểm", meaning: "Đi tới vùng đất mới lạ để tìm hiểu, khám phá.", example: "Chú kiến bắt đầu chuyến thám hiểm bờ suối." },
      { word: "lởm chởm", meaning: "Có nhiều mũi nhọn nhô lên không đều nhau.", example: "Bãi sỏi lởm chởm đá sắc." },
      { word: "hợp sức", meaning: "Cùng nhau góp công sức lại để làm một việc lớn.", example: "Đàn kiến hợp sức khiêng mẩu bánh mì." }
    ],
    questions: [
      { id: "q1", type: "multiple_choice", prompt: "Kiến Đen đã dùng vật gì để vượt qua con mương nhỏ nước chảy xiết?", options: ["Một chiếc lá khô trôi dạt", "Một chiếc que củi mục", "Cánh bướm rơi"], answer: "A", skillTag: "thong_tin_truc_tiep", difficulty: "nhan_biet", hint: "Chú ý chi tiết Kiến Đen làm thuyền vượt mương.", explanation: "Kiến Đen nhanh trí leo lên một chiếc lá khô trôi dạt để làm thuyền vượt mương." },
      { id: "q2", type: "true_false", prompt: "Nhận định sau Đúng hay Sai: 'Khi phát hiện mẩu bánh ngọt, Kiến Đen đã ăn no một mình rồi ngủ quên ở bờ suối.'", statement: "Khi phát hiện mẩu bánh ngọt, Kiến Đen đã ăn no một mình rồi ngủ quên ở bờ suối.", answer: false, skillTag: "thong_tin_truc_tiep", difficulty: "nhan_biet", hint: "Kiến Đen đã làm gì sau khi tìm thấy thức ăn?", explanation: "Kiến Đen nhanh chóng trở về tổ gọi đàn kiến cùng nhau hợp sức mang bánh về." },
      { id: "q3", type: "multiple_choice", prompt: "Từ 'hợp sức' trong câu chuyện thể hiện tinh thần gì?", options: ["Sự chia rẽ, đố kị", "Tinh thần đoàn kết, giúp đỡ lẫn nhau", "Sự lười biếng ỷ lại"], answer: "B", skillTag: "tu_trong_ngu_canh", difficulty: "thong_hieu", hint: "'Hợp sức' là gom sức lực của nhiều người lại.", explanation: "'Hợp sức' thể hiện sức mạnh của sự đoàn kết, đồng lòng vượt qua khó khăn." },
      { id: "q4", type: "sequence", prompt: "Sắp xếp 3 hành động của Kiến Đen theo đúng thứ tự câu chuyện:", items: ["Vượt con mương nhỏ bằng chiếc lá khô", "Phát hiện mẩu bánh mì thơm phức bên bờ suối", "Dẫn đàn kiến hợp sức khiêng thức ăn về tổ"], answer: ["Vượt con mương nhỏ bằng chiếc lá khô", "Phát hiện mẩu bánh mì thơm phức bên bờ suối", "Dẫn đàn kiến hợp sức khiêng thức ăn về tổ"], skillTag: "sap_xep_trinh_tu", difficulty: "thong_hieu", hint: "Vượt mương -> Tìm thấy bánh -> Đưa cả đàn tới khiêng.", explanation: "Trình tự: Vượt chướng ngại vật mương nước -> Tìm thấy thức ăn -> Đưa đàn kiến cùng hợp lực vận chuyển." },
      { id: "q5", type: "multiple_choice", prompt: "Bài học lớn nhất mà em học được từ câu chuyện là gì?", options: ["Đoàn kết và tương trợ lẫn nhau sẽ tạo nên sức mạnh lớn", "Nên đi phiêu lưu một mình không cần bạn bè", "Thức ăn ngon chỉ nên cất giấu riêng"], answer: "A", skillTag: "lien_he_van_dung", difficulty: "van_dung", hint: "Sức mạnh của cả đàn kiến khi hợp sức.", explanation: "Tinh thần đoàn kết, đồng lòng và sẻ chia giúp tập thể vượt qua mọi thử thách lớn lao." }
    ]
  },
  // Grade 3 - Lesson 3
  {
    id: "lesson_g3_03",
    title: "Kho báu trong khu vườn của ông",
    grade: 3,
    topic: "Gia đình yêu thương",
    passage: `Nghỉ hè, Tuấn được bố mẹ cho về quê thăm ông nội. Khu vườn của ông rực rỡ với đủ loại cây trái: cam sành mọng nước, ổi giòn ngọt lịm và những chùm nhãn chín vàng ươm. Mỗi buổi sáng sớm, ông dắt Tuấn ra vườn tưới nước, xới đất và bắt sâu cho từng gốc cây. Tuấn tò mò hỏi: "Ông ơi, bố bảo trong vườn của ông có kho báu bí mật, kho báu ở đâu hả ông?". Ông cười hiền hậu, xoa đầu Tuấn rồi chỉ vào những chùm quả lúc lỉu: "Kho báu của ông chính là sự cần cù lao động và tình yêu thương gia đình cháu à. Khi ta gieo tình yêu vào đất, đất sẽ trả lại cho ta những mùa quả ngọt lành". Tuấn ôm lấy cánh tay rám nắng của ông, thầm hứa sẽ luôn chăm chỉ và biết quý trọng thành quả lao động.`,
    vocabulary: [
      { word: "lúc lỉu", meaning: "Trái cây sai quả trĩu nặng sát nhau trên cành.", example: "Những chùm quả chín mọng lúc lỉu trên cành." },
      { word: "cần cù", meaning: "Chăm chỉ, chịu khó làm việc đều đặn không ngại vất vả.", example: "Đức tính cần cù chịu khó của người nông dân." },
      { word: "rám nắng", meaning: "Làn da sẫm màu vì dãi nắng dầm mưa lao động.", example: "Cánh tay rám nắng khỏe khoắn của ông nội." }
    ],
    questions: [
      { id: "q1", type: "multiple_choice", prompt: "Tuấn về quê thăm ai trong dịp nghỉ hè?", options: ["Ông nội", "Bác họ", "Thầy giáo cũ"], answer: "A", skillTag: "thong_tin_truc_tiep", difficulty: "nhan_biet", hint: "Xem câu mở đầu của bài đọc.", explanation: "Bài viết: 'Nghỉ hè, Tuấn được bố mẹ cho về quê thăm ông nội.'" },
      { id: "q2", type: "true_false", prompt: "Nhận định sau Đúng hay Sai: 'Kho báu của ông là một chiếc hòm chứa đầy vàng bạc chôn dưới lòng đất.'", statement: "Kho báu của ông là một chiếc hòm chứa đầy vàng bạc chôn dưới lòng đất.", answer: false, skillTag: "thong_tin_truc_tiep", difficulty: "nhan_biet", hint: "Ông đã giải thích kho báu thực sự là gì?", explanation: "Kho báu của ông chính là sự cần cù lao động và tình yêu thương gia đình." },
      { id: "q3", type: "multiple_choice", prompt: "Từ 'lúc lỉu' miêu tả đặc điểm gì của cành cây trong vườn?", options: ["Cành cây trơ trụi không có lá", "Cành cây trĩu nặng nhiều chùm quả mọng", "Cành cây bị gãy đổ"], answer: "B", skillTag: "tu_trong_ngu_canh", difficulty: "thong_hieu", hint: "'Lúc lỉu' gợi tả quả chín rất nhiều và trĩu cành.", explanation: "'Lúc lỉu' miêu tả cành cây sai trĩu quả chín lúc lỉu, trĩu nặng xuống vì mùa màng bội thu." },
      { id: "q4", type: "sequence", prompt: "Sắp xếp 3 sự việc chính diễn ra trong câu chuyện:", items: ["Tuấn cùng ông nội ra vườn tưới nước và xới đất", "Tuấn tò mò hỏi ông về kho báu bí mật trong vườn", "Ông giải thích ý nghĩa kho báu từ sự cần cù lao động"], answer: ["Tuấn cùng ông nội ra vườn tưới nước và xới đất", "Tuấn tò mò hỏi ông về kho báu bí mật trong vườn", "Ông giải thích ý nghĩa kho báu từ sự cần cù lao động"], skillTag: "sap_xep_trinh_tu", difficulty: "thong_hieu", hint: "Cùng làm vườn -> Hỏi kho báu -> Nghe ông giải thích.", explanation: "Trình tự: Hai ông cháu chăm sóc vườn cây -> Tuấn hỏi kho báu -> Lời dặn dò ý nghĩa của ông nội." },
      { id: "q5", type: "multiple_choice", prompt: "Câu chuyện giúp em hiểu được bài học sâu sắc nào về cuộc sống?", options: ["Cần cù lao động và yêu thương gia đình mới là kho báu quý giá nhất", "Chỉ cần ước mơ là có quả ngọt ăn ngay", "Làm vườn rất vất vả nên không nên tham gia"], answer: "A", skillTag: "lien_he_van_dung", difficulty: "van_dung", hint: "Lời dặn dịu dàng của ông nội dành cho Tuấn.", explanation: "Giá trị chân chính của cuộc sống đến từ lòng cần cù, say mê lao động và tình yêu thương gia đình gắn kết." }
    ]
  },
  // Grade 3 - Lesson 4
  {
    id: "lesson_g3_04",
    title: "Ngọn hải đăng trên đảo nhỏ",
    grade: 3,
    topic: "Biển đảo quê hương",
    passage: `Nằm sừng sững trên đỉnh ngọn đồi đá của hòn đảo tiền tiêu, ngọn hải đăng sọc trắng đỏ vươn cao sừng sững giữa bầu trời xanh biếc. Ban ngày, hải đăng đứng uy nghiêm như một người lính canh biển khơi không biết mệt mỏi. Khi màn đêm buông xuống và sương mù giăng kín mặt biển, ngọn đèn trên đỉnh tháp lại bừng sáng, quét những luồng ánh sáng rực rỡ ra xa hàng chục hải lý. Nhờ luồng sáng dẫn lối ấy, những con tàu đánh cá của các chú ngư dân dù gặp sóng to gió lớn vẫn định hướng an toàn trở về bến đỗ bình yên. Các chú kiểm soát viên hải đăng ngày đêm thay phiên túc trực, thầm lặng cống hiến giữ vững ngọn lửa soi đường cho quê hương Tổ quốc.`,
    vocabulary: [
      { word: "tiền tiêu", meaning: "Vị trí nằm ở phía trước cùng, có vai trò canh phòng bảo vệ.", example: "Đảo tiền tiêu nơi đầu sóng ngọn gió." },
      { word: "uy nghiêm", meaning: "Đĩnh đạc, trang trọng và gợi sự kính trọng.", example: "Hải đăng đứng uy nghiêm giữa biển trời." },
      { word: "túc trực", meaning: "Có mặt liên tục tại vị trí làm nhiệm vụ để sẵn sàng ứng phó.", example: "Các chú túc trực suốt đêm canh đèn biển." }
    ],
    questions: [
      { id: "q1", type: "multiple_choice", prompt: "Ngọn hải đăng trên đảo nhỏ có màu sắc nổi bật nào?", options: ["Sọc trắng đỏ", "Sọc vàng đen", "Xanh lá cây toàn bộ"], answer: "A", skillTag: "thong_tin_truc_tiep", difficulty: "nhan_biet", hint: "Xem câu đầu tiên miêu tả hải đăng.", explanation: "Bài đọc nêu: 'ngọn hải đăng sọc trắng đỏ vươn cao sừng sững giữa bầu trời xanh biếc.'" },
      { id: "q2", type: "true_false", prompt: "Nhận định sau Đúng hay Sai: 'Vào ban đêm, ngọn đèn trên đỉnh tháp hải đăng bị tắt để tiết kiệm điện.'", statement: "Vào ban đêm, ngọn đèn trên đỉnh tháp hải đăng bị tắt để tiết kiệm điện.", answer: false, skillTag: "thong_tin_truc_tiep", difficulty: "nhan_biet", hint: "Ngọn đèn làm nhiệm vụ gì vào ban đêm?", explanation: "Khi đêm xuống, đèn bừng sáng quét luồng sáng xa hàng chục hải lý để dẫn đường tàu cá." },
      { id: "q3", type: "multiple_choice", prompt: "Từ 'túc trực' thể hiện tinh thần làm việc như thế nào của các chú giữ đèn?", options: ["Rời bỏ vị trí đi chơi", "Có mặt thường xuyên, kiên trì và tận tụy với công việc", "Làm việc qua loa đối phó"], answer: "B", skillTag: "tu_trong_ngu_canh", difficulty: "thong_hieu", hint: "'Túc trực' là luôn sẵn sàng làm nhiệm vụ.", explanation: "'Túc trực' thể hiện sự tận tụy, tinh thần trách nhiệm cao độ và bền bỉ của người lính giữ đèn biển." },
      { id: "q4", type: "sequence", prompt: "Sắp xếp hoạt động của ngọn hải đăng theo ngày và đêm:", items: ["Ban ngày sừng sững như người lính canh biển khơi", "Ban đêm quét luồng sáng dẫn lối tàu thuyền vượt sóng gió", "Các chú kiểm soát viên ngày đêm túc trực giữ sáng ngọn đèn"], answer: ["Ban ngày sừng sững như người lính canh biển khơi", "Ban đêm quét luồng sáng dẫn lối tàu thuyền vượt sóng gió", "Các chú kiểm soát viên ngày đêm túc trực giữ sáng ngọn đèn"], skillTag: "sap_xep_trinh_tu", difficulty: "thong_hieu", hint: "Ban ngày -> Ban đêm -> Tinh thần cống hiến bền bỉ.", explanation: "Trình tự: Hình ảnh ban ngày -> Hoạt động ban đêm -> Sự hy sinh cống hiến của người giữ đèn." },
      { id: "q5", type: "multiple_choice", prompt: "Em có suy nghĩ và tình cảm gì đối với những người giữ ngọn hải đăng nơi đảo xa?", options: ["Biết ơn và khâm phục sự cống hiến thầm lặng vì bình yên biển đảo", "Không cảm xúc gì vì ở quá xa", "Thấy công việc rất nhàn hạ"], answer: "A", skillTag: "lien_he_van_dung", difficulty: "van_dung", hint: "Sự cống hiến thầm lặng của các chú kiểm soát viên hải đăng.", explanation: "Chúng ta cần bày tỏ lòng kính trọng, biết ơn sâu sắc đối với những con người ngày đêm thầm lặng cống hiến nơi đầu sóng ngọn gió." }
    ]
  },
  // Grade 3 - Lesson 5
  {
    id: "lesson_g3_05",
    title: "Hạt dẻ dũng cảm của rừng thông",
    grade: 3,
    topic: "Ý chí & Lòng kiên trì",
    passage: `Trên cành cao của cây thông già giữa cánh rừng đại ngàn, có một hạt dẻ nhỏ xíu tên là Dẻ Nâu. Khi mùa thu chín rộ, các anh chị hạt dẻ khác đều rụng xuống lớp cỏ êm ái dưới chân gốc cây. Riêng Dẻ Nâu bị một cơn gió lốc cuốn bay xa tít tắp, rơi trúng vào một khe đá cằn cỗi trên sườn núi cheo leo. Mùa đông lạnh buốt tràn về phủ đầy băng tuyết. Những mỏm đá nhọn buốt giá dường như muốn bóp nghẹt hạt mầm nhỏ. Nhưng Dẻ Nâu không hề nản chí. Chú kiên trì cắm rễ sâu vào từng kẽ nứt li ti của phiến đá, chắt chiu từng giọt sương mai để nuôi dưỡng mầm sống. Mùa xuân ấm áp gõ cửa, từ khe đá khô cằn, một mầm cây non xanh biếc kiêu hãnh vươn lên, tràn đầy sức sống.`,
    vocabulary: [
      { word: "cằn cỗi", meaning: "Khô cằn, nghèo nàn chất dinh dưỡng, khó sống.", example: "Vùng đất đá cằn cỗi trên triền đồi." },
      { word: "chắt chiu", meaning: "Dành dụm, giữ gìn từng chút nhỏ một cách nâng niu.", example: "Hạt mầm chắt chiu từng giọt nước mát." },
      { word: "kiêu hãnh", meaning: "Tự hào và vững vàng trước mọi sóng gió thử thách.", example: "Mầm cây non kiêu hãnh vươn mình đón nắng." }
    ],
    questions: [
      { id: "q1", type: "multiple_choice", prompt: "Hạt dẻ Dẻ Nâu bị gió cuốn rơi vào nơi nào?", options: ["Một khe đá cằn cỗi trên sườn núi cheo leo", "Lớp cỏ êm ái dưới chân gốc cây thông già", "Lòng dòng suối mát lành"], answer: "A", skillTag: "thong_tin_truc_tiep", difficulty: "nhan_biet", hint: "Tìm câu văn miêu tả nơi Dẻ Nâu rơi xuống.", explanation: "Bài viết rõ: 'rơi trúng vào một khe đá cằn cỗi trên sườn núi cheo leo.'" },
      { id: "q2", type: "true_false", prompt: "Nhận định sau Đúng hay Sai: 'Trước mùa đông lạnh giá buốt xương, Dẻ Nâu đã bỏ cuộc và khô héo.'", statement: "Trước mùa đông lạnh giá buốt xương, Dẻ Nâu đã bỏ cuộc và khô héo.", answer: false, skillTag: "thong_tin_truc_tiep", difficulty: "nhan_biet", hint: "Dẻ Nâu đã làm gì để vượt qua mùa đông?", explanation: "Dẻ Nâu kiên trì cắm rễ sâu vào kẽ nứt li ti để chắt chiu giọt sương nuôi dưỡng sự sống." },
      { id: "q3", type: "multiple_choice", prompt: "Từ 'chắt chiu' thể hiện sự nỗ lực như thế nào của hạt dẻ?", options: ["Lãng phí bừa bãi", "Dành dụm, gom góp kiên trì từng nguồn sống nhỏ nhất", "Bất cần, vô tư lự"], answer: "B", skillTag: "tu_trong_ngu_canh", difficulty: "thong_hieu", hint: "'Chắt chiu' từng giọt sương để sống sót.", explanation: "'Chắt chiu' thể hiện ý chí kiên cường, gom góp chắt lọc từng giọt nước quý giá giữa khe đá khô cằn." },
      { id: "q4", type: "sequence", prompt: "Sắp xếp hành trình vượt khó của Hạt Dẻ Nâu:", items: ["Bị gió cuốn rơi vào khe đá cằn cỗi trên sườn núi", "Kiên trì bám rễ chắt chiu sương mai vượt qua mùa đông", "Mùa xuân vươn mầm xanh kiêu hãnh tràn đầy sức sống"], answer: ["Bị gió cuốn rơi vào khe đá cằn cỗi trên sườn núi", "Kiên trì bám rễ chắt chiu sương mai vượt qua mùa đông", "Mùa xuân vươn mầm xanh kiêu hãnh tràn đầy sức sống"], skillTag: "sap_xep_trinh_tu", difficulty: "thong_hieu", hint: "Rơi vào khe đá -> Vượt qua mùa đông -> Vươn mầm đón xuân.", explanation: "Trình tự: Thử thách rơi vào đá sỏi -> Kiên trì bám trụ mùa đông -> Đơm chồi nở hoa vào mùa xuân." },
      { id: "q5", type: "multiple_choice", prompt: "Hình ảnh mầm cây vươn lên từ khe đá khô cằn truyền cho em cảm hứng gì?", options: ["Luôn kiên trì, mạnh mẽ và không bao giờ chịu đầu hàng nghịch cảnh", "Nên tìm nơi dễ dàng nhất để sống", "Khó khăn thì nên bỏ cuộc ngay"], answer: "A", skillTag: "lien_he_van_dung", difficulty: "van_dung", hint: "Nghị lực phi thường của hạt mầm nhỏ bé.", explanation: "Nghị lực và sự kiên trì bền bỉ sẽ giúp mỗi con người vượt qua mọi nghịch cảnh gian nan để tỏa sáng." }
    ]
  }
];

// Classes definition: 10 classes
const DEMO_CLASSES = [
  { id: "class_2a", name: "Lớp 2A", grade: 2, classCode: "LOP2A0", academicYear: "2025-2026", studentCount: 20 },
  { id: "class_2b", name: "Lớp 2B", grade: 2, classCode: "LOP2B0", academicYear: "2025-2026", studentCount: 20 },
  { id: "class_2c", name: "Lớp 2C", grade: 2, classCode: "LOP2C0", academicYear: "2025-2026", studentCount: 20 },
  { id: "class_2d", name: "Lớp 2D", grade: 2, classCode: "LOP2D0", academicYear: "2025-2026", studentCount: 20 },
  { id: "class_2e", name: "Lớp 2E", grade: 2, classCode: "LOP2E0", academicYear: "2025-2026", studentCount: 20 },
  { id: "class_3a", name: "Lớp 3A", grade: 3, classCode: "LOP3A0", academicYear: "2025-2026", studentCount: 20 },
  { id: "class_3b", name: "Lớp 3B", grade: 3, classCode: "LOP3B0", academicYear: "2025-2026", studentCount: 20 },
  { id: "class_3c", name: "Lớp 3C", grade: 3, classCode: "LOP3C0", academicYear: "2025-2026", studentCount: 20 },
  { id: "class_3d", name: "Lớp 3D", grade: 3, classCode: "LOP3D0", academicYear: "2025-2026", studentCount: 20 },
  { id: "class_3e", name: "Lớp 3E", grade: 3, classCode: "LOP3E0", academicYear: "2025-2026", studentCount: 20 }
];

async function seedPrisinteDemoEnvironment() {
  console.log("======================================================================");
  console.log("   EM YÊU TIẾNG VIỆT — SEED MÔI TRƯỜNG DEMO CHUẨN HÓA V5.3 (MẢNG 1C)");
  console.log("======================================================================");

  const teacherUid = "teacher_demo_account";
  const adminUid = "admin_demo_account";
  const now = Date.now();

  // 1. CLEAN JUNK TEST COLLECTIONS WHILE PRESERVING CORE DEMO
  console.log("\n[1/7] Dọn dẹp các bản ghi test rác cũ trong Emulator (Đã có bản sao lưu v1b an toàn)...");
  
  // Clear old test users (keep admin_demo_account, teacher_demo_account)
  const usersSnap = await db.collection("users").get();
  for (const doc of usersSnap.docs) {
    if (doc.id !== adminUid && doc.id !== teacherUid) {
      await doc.ref.delete();
    }
  }

  // Clear old classes
  const classesSnap = await db.collection("classes").get();
  for (const doc of classesSnap.docs) {
    await doc.ref.delete();
  }

  // Clear old students & studentSecrets
  const studentsSnap = await db.collection("students").get();
  for (const doc of studentsSnap.docs) {
    await doc.ref.delete();
  }
  const secretsSnap = await db.collection("studentSecrets").get();
  for (const doc of secretsSnap.docs) {
    await doc.ref.delete();
  }

  // Clear old assignments & attempts
  const assignSnap = await db.collection("assignments").get();
  for (const doc of assignSnap.docs) {
    await doc.ref.delete();
  }
  const attemptsSnap = await db.collection("attempts").get();
  for (const doc of attemptsSnap.docs) {
    // Delete responses subcollection
    const respSnap = await doc.ref.collection("responses").get();
    for (const rDoc of respSnap.docs) await rDoc.ref.delete();
    await doc.ref.delete();
  }

  // Clear old usernames (keep admin, giaovien01)
  const usernamesSnap = await db.collection("usernames").get();
  for (const doc of usernamesSnap.docs) {
    if (doc.id !== "admin" && doc.id !== "giaovien01") {
      await doc.ref.delete();
    }
  }

  // Clear old lessons
  const lessonsSnap = await db.collection("lessons").get();
  for (const doc of lessonsSnap.docs) {
    const vSnap = await doc.ref.collection("versions").get();
    for (const vDoc of vSnap.docs) {
      await db.collection("privateAnswerKeys").doc(vDoc.id).delete();
      await vDoc.ref.delete();
    }
    await doc.ref.delete();
  }

  console.log("  ✓ Đã dọn sạch test junk. Sẵn sàng gieo dữ liệu demo chuẩn hóa.");

  // 2. CREATE ADMIN & TEACHER DEMO ACCOUNTS
  console.log("\n[2/7] Khởi tạo tài khoản Quản trị viên (admin) và Giáo viên (giaovien01)...");
  
  // Admin account
  await db.collection("users").doc(adminUid).set({
    uid: adminUid,
    username: "admin",
    displayName: "Quản trị viên Hệ thống",
    email: "admin@emytv.local",
    role: "admin",
    status: "active",
    createdAt: now,
    updatedAt: now
  });
  const adminSalt = generateSalt();
  const adminHash = hashPassword("admin", adminSalt);
  await db.collection("accountSecrets").doc(adminUid).set({
    salt: adminSalt,
    passwordHash: adminHash,
    updatedAt: now
  });
  await db.collection("usernames").doc("admin").set({
    username: "admin",
    uid: adminUid,
    role: "admin",
    updatedAt: now
  });

  // Teacher account
  await db.collection("users").doc(teacherUid).set({
    uid: teacherUid,
    username: "giaovien01",
    displayName: "Cô giáo Mai Phương",
    email: "giaovien01@emytv.local",
    phoneNumber: "0912345678",
    role: "teacher",
    status: "active",
    createdAt: now,
    updatedAt: now
  });
  const teacherSalt = generateSalt();
  const teacherHash = hashPassword("GV123456", teacherSalt);
  await db.collection("accountSecrets").doc(teacherUid).set({
    salt: teacherSalt,
    passwordHash: teacherHash,
    updatedAt: now
  });
  await db.collection("usernames").doc("giaovien01").set({
    username: "giaovien01",
    uid: teacherUid,
    role: "teacher",
    updatedAt: now
  });

  console.log("  ✓ Admin (admin / admin) và Giáo viên (giaovien01 / GV123456) sẵn sàng.");

  // 3. CREATE 10 CLASSES
  console.log("\n[3/7] Khởi tạo 10 lớp học chuẩn (2A, 2B, 2C, 2D, 2E, 3A, 3B, 3C, 3D, 3E)...");
  for (const c of DEMO_CLASSES) {
    await db.collection("classes").doc(c.id).set({
      id: c.id,
      name: c.name,
      grade: c.grade,
      classCode: c.classCode,
      academicYear: c.academicYear,
      teacherUid: teacherUid,
      studentCount: c.studentCount,
      status: "active",
      createdAt: now
    });
  }
  console.log(`  ✓ Đã tạo 10/10 lớp học thành công, mỗi lớp gắn liền với Cô giáo Mai Phương.`);

  // 4. CREATE 200 STUDENTS WITH NATURAL VIETNAMESE NAMES
  console.log("\n[4/7] Khởi tạo 200 học sinh (HS001 đến HS200) với họ tên tiếng Việt tự nhiên...");
  const studentNames = generate200Names();
  
  // Distribute 20 students per class
  // Index 0..19 -> 2A, 20..39 -> 2B, 40..59 -> 2C, 60..79 -> 2D, 80..99 -> 2E
  // 100..119 -> 3A, 120..139 -> 3B, 140..159 -> 3C, 160..179 -> 3D, 180..199 -> 3E
  const studentSecretSalt = generateSalt();
  const studentPasswordHash = hashPassword("HS123456", studentSecretSalt);
  const studentPinHash = hashAccessCode("HS123456", studentSecretSalt);

  let batch = db.batch();
  let count = 0;

  for (let idx = 0; idx < 200; idx++) {
    const s = studentNames[idx];
    const classIdx = Math.floor(idx / 20);
    const assignedClass = DEMO_CLASSES[classIdx];
    const studentDocId = `student_demo_${s.code.toLowerCase()}`;

    // Student document
    const sRef = db.collection("students").doc(studentDocId);
    batch.set(sRef, {
      id: studentDocId,
      studentCode: s.code,
      username: s.code,
      fullName: s.fullName,
      displayAlias: s.displayAlias,
      classId: assignedClass.id,
      classCode: assignedClass.classCode,
      academicYear: assignedClass.academicYear,
      status: "active",
      createdAt: now
    });

    // Student secret (PIN & Password compatible)
    const secretRef = db.collection("studentSecrets").doc(studentDocId);
    batch.set(secretRef, {
      studentId: studentDocId,
      salt: studentSecretSalt,
      accessCodeHash: studentPinHash,
      passwordHash: studentPasswordHash,
      rotatedAt: now
    });

    // Username lookup for accountLogin (lowercase username)
    const uRef = db.collection("usernames").doc(s.code.toLowerCase());
    batch.set(uRef, {
      username: s.code.toLowerCase(),
      uid: studentDocId,
      studentId: studentDocId,
      role: "student",
      classId: assignedClass.id,
      updatedAt: now
    });

    count++;
    if (count % 100 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  if (count % 100 !== 0) {
    await batch.commit();
  }
  console.log(`  ✓ Đã tạo thành công 200/200 học sinh (20 em/lớp) có đầy đủ bí mật xác thực.`);

  // 5. CREATE 10 APPROVED ORIGINAL LESSONS (5 FOR GRADE 2, 5 FOR GRADE 3)
  console.log("\n[5/7] Khởi tạo 10 bài đọc gốc đã duyệt (5 bài Lớp 2, 5 bài Lớp 3) kèm khóa đáp án...");
  for (const l of DEMO_LESSONS) {
    const lessonRef = db.collection("lessons").doc(l.id);
    const versionId = `v1_${l.id}`;
    
    await lessonRef.set({
      id: l.id,
      title: l.title,
      grade: l.grade,
      topic: l.topic,
      teacherUid: teacherUid,
      currentVersionId: versionId,
      status: "published",
      approvedByTeacher: true,
      createdAt: now,
      updatedAt: now
    });

    // Public version (no answers, no spoiler hints)
    const publicQuestions = l.questions.map(q => {
      const { answer, hint, explanation, ...publicQ } = q;
      return publicQ;
    });

    await lessonRef.collection("versions").doc(versionId).set({
      versionId,
      lessonId: l.id,
      title: l.title,
      grade: l.grade,
      topic: l.topic,
      passage: l.passage,
      vocabulary: l.vocabulary,
      publicQuestions,
      versionNumber: 1,
      publishedAt: now,
      createdAt: now
    });

    // Private answer key
    const answerKeyMap = {};
    l.questions.forEach(q => {
      answerKeyMap[q.id] = {
        correctAnswer: q.answer,
        hint: q.hint,
        explanation: q.explanation,
        skillTag: q.skillTag,
        difficulty: q.difficulty
      };
    });

    await db.collection("privateAnswerKeys").doc(versionId).set({
      versionId,
      lessonId: l.id,
      answers: answerKeyMap,
      createdAt: now
    });
  }
  console.log(`  ✓ Đã xuất bản và bảo vệ đáp án cho 10/10 bài đọc gốc.`);

  // 6. CREATE 25 ASSIGNMENTS (2-3 ASSIGNMENTS PER CLASS)
  console.log("\n[6/7] Khởi tạo bài giao (Assignments) cho 10 lớp học (Pre-test, Post-test & Khảo sát)...");
  const createdAssignments = [];
  
  // Grade 2 lessons: lesson_g2_01, lesson_g2_02, lesson_g2_03
  // Grade 3 lessons: lesson_g3_01, lesson_g3_02, lesson_g3_03
  for (const c of DEMO_CLASSES) {
    const isG2 = c.grade === 2;
    const l1 = isG2 ? DEMO_LESSONS[0] : DEMO_LESSONS[5]; // Pre-test
    const l2 = isG2 ? DEMO_LESSONS[1] : DEMO_LESSONS[6]; // Main
    const l3 = isG2 ? DEMO_LESSONS[2] : DEMO_LESSONS[7]; // Post-test

    // Assign 1 (Pre-test)
    const a1Id = `assign_${c.id}_pre`;
    const a1 = {
      id: a1Id,
      classId: c.id,
      lessonId: l1.id,
      lessonVersionId: `v1_${l1.id}`,
      title: `[Khảo sát đầu kỳ] ${l1.title} - ${c.name}`,
      teacherUid: teacherUid,
      grade: c.grade,
      isPreTest: true,
      isPostTest: false,
      status: "active",
      availableFrom: now - 7 * 24 * 3600 * 1000,
      availableUntil: now + 30 * 24 * 3600 * 1000,
      createdAt: now - 7 * 24 * 3600 * 1000
    };
    await db.collection("assignments").doc(a1Id).set(a1);
    createdAssignments.push(a1);

    // Assign 2 (Main)
    const a2Id = `assign_${c.id}_main`;
    const a2 = {
      id: a2Id,
      classId: c.id,
      lessonId: l2.id,
      lessonVersionId: `v1_${l2.id}`,
      title: `[Chính khóa] ${l2.title} - ${c.name}`,
      teacherUid: teacherUid,
      grade: c.grade,
      isPreTest: false,
      isPostTest: false,
      status: "active",
      availableFrom: now - 5 * 24 * 3600 * 1000,
      availableUntil: now + 30 * 24 * 3600 * 1000,
      createdAt: now - 5 * 24 * 3600 * 1000
    };
    await db.collection("assignments").doc(a2Id).set(a2);
    createdAssignments.push(a2);

    // Assign 3 (Post-test for classes 2A, 2B, 3A, 3B, 3C)
    if (["class_2a", "class_2b", "class_3a", "class_3b", "class_3c"].includes(c.id)) {
      const a3Id = `assign_${c.id}_post`;
      const a3 = {
        id: a3Id,
        classId: c.id,
        lessonId: l3.id,
        lessonVersionId: `v1_${l3.id}`,
        title: `[Đánh giá cuối kỳ] ${l3.title} - ${c.name}`,
        teacherUid: teacherUid,
        grade: c.grade,
        isPreTest: false,
        isPostTest: true,
        status: "active",
        availableFrom: now - 2 * 24 * 3600 * 1000,
        availableUntil: now + 30 * 24 * 3600 * 1000,
        createdAt: now - 2 * 24 * 3600 * 1000
      };
      await db.collection("assignments").doc(a3Id).set(a3);
      createdAssignments.push(a3);
    }
  }
  console.log(`  ✓ Đã tạo ${createdAssignments.length} bài giao thực tế trên 10 lớp học.`);

  // 7. CREATE 320 REALISTIC SIMULATED ATTEMPTS (SYNTHETIC-DEMO)
  console.log("\n[7/7] Tạo 320 lượt làm mô phỏng (Synthetic-Demo) đa dạng kỹ năng, đúng lần đầu & gợi ý...");
  let attemptCount = 0;
  let inProgressCount = 0;

  // We assign realistic attempts:
  // For each class, 20 students.
  // Pre-test: 18-20 students completed.
  // Main test: 12-16 students completed, 2 in-progress.
  // Post-test: 10-15 students completed.
  for (const assign of createdAssignments) {
    const classIdx = DEMO_CLASSES.findIndex(c => c.id === assign.classId);
    const startStudentIdx = classIdx * 20;
    const endStudentIdx = startStudentIdx + 20;
    const targetLesson = DEMO_LESSONS.find(l => l.id === assign.lessonId);

    // Number of completions based on assignment type
    let numToComplete = assign.isPreTest ? 18 : (assign.isPostTest ? 14 : 12);

    for (let sIdx = startStudentIdx; sIdx < endStudentIdx; sIdx++) {
      const s = studentNames[sIdx];
      const studentDocId = `student_demo_${s.code.toLowerCase()}`;
      const relIdx = sIdx - startStudentIdx;

      if (relIdx < numToComplete) {
        // COMPLETED ATTEMPT
        attemptCount++;
        const attemptId = `att_demo_${assign.id}_${s.code.toLowerCase()}`;
        const startedAt = assign.createdAt + (relIdx + 1) * 3600 * 1000;
        const completedAt = startedAt + (10 + (sIdx % 10)) * 60 * 1000;

        // Determine realistic scores (first try vs final)
        // Post-test has higher accuracy to simulate genuine learning growth!
        const baseFirstCorrect = assign.isPostTest ? (sIdx % 2 === 0 ? 4 : 5) : (sIdx % 3 === 0 ? 3 : 4);
        const firstTryCorrectCount = Math.min(5, Math.max(2, baseFirstCorrect));
        const finalCorrectCount = Math.min(5, firstTryCorrectCount + (firstTryCorrectCount < 5 ? 1 : 0));
        const hintCount = finalCorrectCount - firstTryCorrectCount + (firstTryCorrectCount < 4 ? 1 : 0);
        const scorePercentage = Math.round((finalCorrectCount / 5) * 100);
        const starsEarned = scorePercentage >= 80 ? 3 : (scorePercentage >= 60 ? 2 : 1);

        const attDocRef = db.collection("attempts").doc(attemptId);
        await attDocRef.set({
          id: attemptId,
          assignmentId: assign.id,
          classId: assign.classId,
          lessonId: assign.lessonId,
          lessonVersionId: assign.lessonVersionId,
          studentId: studentDocId,
          studentCode: s.code,
          studentName: s.fullName,
          teacherUid: teacherUid,
          status: "completed",
          totalQuestions: 5,
          firstTryCorrectCount,
          finalCorrectCount,
          hintCount,
          scorePercentage,
          starsEarned,
          startedAt,
          completedAt,
          isSynthetic: true,
          dataSource: "synthetic-demo"
        });

        // Seed 5 responses into subcollection
        for (let qIdx = 0; qIdx < 5; qIdx++) {
          const q = targetLesson.questions[qIdx];
          const isFirstCorrect = qIdx < firstTryCorrectCount;
          const isFinalCorrect = qIdx < finalCorrectCount;
          const hintUsed = !isFirstCorrect && isFinalCorrect;

          await attDocRef.collection("responses").doc(q.id).set({
            questionId: q.id,
            skillTag: q.skillTag,
            difficulty: q.difficulty,
            firstTryCorrect: isFirstCorrect,
            finalCorrect: isFinalCorrect,
            hintUsed: hintUsed,
            firstAnswer: isFirstCorrect ? q.answer : (q.type === "multiple_choice" ? "C" : false),
            retryAnswer: isFinalCorrect ? q.answer : null,
            recordedAt: startedAt + (qIdx + 1) * 120 * 1000
          });
        }
      } else if (relIdx === numToComplete) {
        // IN-PROGRESS ATTEMPT (to show realistic classroom state)
        inProgressCount++;
        const attemptId = `att_demo_${assign.id}_${s.code.toLowerCase()}`;
        const startedAt = now - 15 * 60 * 1000;

        const attDocRef = db.collection("attempts").doc(attemptId);
        await attDocRef.set({
          id: attemptId,
          assignmentId: assign.id,
          classId: assign.classId,
          lessonId: assign.lessonId,
          lessonVersionId: assign.lessonVersionId,
          studentId: studentDocId,
          studentCode: s.code,
          studentName: s.fullName,
          teacherUid: teacherUid,
          status: "in_progress",
          totalQuestions: 5,
          firstTryCorrectCount: 2,
          finalCorrectCount: 2,
          hintCount: 1,
          startedAt,
          isSynthetic: true,
          dataSource: "synthetic-demo"
        });

        // 2 responses answered so far
        for (let qIdx = 0; qIdx < 2; qIdx++) {
          const q = targetLesson.questions[qIdx];
          await attDocRef.collection("responses").doc(q.id).set({
            questionId: q.id,
            skillTag: q.skillTag,
            firstTryCorrect: true,
            finalCorrect: true,
            hintUsed: false,
            firstAnswer: q.answer,
            recordedAt: startedAt + (qIdx + 1) * 120 * 1000
          });
        }
      }
    }
  }

  console.log(`  ✓ Đã tạo thành công ${attemptCount} lượt làm hoàn thành và ${inProgressCount} lượt đang làm (gắn nhãn synthetic-demo).`);

  console.log("\n======================================================================");
  console.log("   TỔNG KẾT MÔI TRƯỜNG DEMO CHUẨN HÓA V5.3:");
  console.log("======================================================================");
  console.log(`- Tài khoản Quản trị: 1 (admin / admin)`);
  console.log(`- Tài khoản Giáo viên: 1 (giaovien01 / GV123456)`);
  console.log(`- Lớp học: 10 lớp (2A..2E, 3A..3E)`);
  console.log(`- Học sinh: 200 em (HS001..HS200, mật khẩu: HS123456)`);
  console.log(`- Kho bài đọc: 10 bài gốc đã duyệt (5 bài Khối 2, 5 bài Khối 3)`);
  console.log(`- Bài giao: ${createdAssignments.length} bài giao`);
  console.log(`- Lượt làm mô phỏng: ${attemptCount} hoàn thành, ${inProgressCount} đang làm`);
  console.log("======================================================================\n");
}

seedPrisinteDemoEnvironment().catch(console.error);

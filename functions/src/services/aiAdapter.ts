import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  GenerateLessonAIRequest,
  LessonDraftInput,
  LessonDraftSchema,
  RemediationSuggestionResponse,
  RemediationActivity,
  RemediationActivityType,
  AnalysisScope,
  REMEDIATION_ACTIVITY_LABELS,
  SkillTag,
  SKILL_LABELS,
  AIServiceStatus,
  AIConfigStatusType,
  Grade,
  QuestionType,
  normalizeTeacherSteps
} from '@emytv/shared';

// ==========================================
// 1. MODEL DEFINITIONS & LOCAL SECRETS LOADER
// ==========================================

export const PRIMARY_GEMINI_MODEL = 'gemini-3.8-flash';
export const FALLBACK_GEMINI_MODEL = 'gemini-3.5-flash-lite';
export const DEFAULT_GEMINI_MODEL = PRIMARY_GEMINI_MODEL;
export const HIGH_QUALITY_GEMINI_MODEL = PRIMARY_GEMINI_MODEL;

// Attempt to load GEMINI_API_KEY and GEMINI_MODEL from local config files if in development / emulator
function loadLocalSecrets(): void {
  const candidatePaths = [
    path.resolve(process.cwd(), 'functions/.secret.local'),
    path.resolve(process.cwd(), 'functions/.env.local'),
    path.resolve(process.cwd(), '.secret.local'),
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(__dirname, '../../.secret.local'),
    path.resolve(__dirname, '../../.env.local')
  ];

  for (const filePath of candidatePaths) {
    if (fs.existsSync(filePath)) {
      try {
        const lines = fs.readFileSync(filePath, 'utf8').split('\n');
        for (const line of lines) {
          const keyMatch = line.match(/^\s*GEMINI_API_KEY\s*=\s*([^\s#\r\n]+)/);
          if (keyMatch && keyMatch[1] && (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.trim().length <= 5)) {
            process.env.GEMINI_API_KEY = keyMatch[1].replace(/["']/g, '').trim();
          }
          const modelMatch = line.match(/^\s*GEMINI_MODEL\s*=\s*([^\s#\r\n]+)/);
          if (modelMatch && modelMatch[1] && !process.env.GEMINI_MODEL) {
            process.env.GEMINI_MODEL = modelMatch[1].replace(/["']/g, '').trim();
          }
        }
      } catch {
        // Ignore read errors
      }
    }
  }
}

loadLocalSecrets();

export function getActiveGeminiModel(): string {
  return process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
}

// In-memory verification state (lifecycle-bound on Cloud Functions instance)
let verificationState: {
  verified: boolean;
  verifiedAt: number | null;
  latencyMs: number | null;
  modelUsed: string | null;
  lastError: {
    code: string;
    message: string;
    timestamp: number;
  } | null;
} = {
  verified: false,
  verifiedAt: null,
  latencyMs: null,
  modelUsed: null,
  lastError: null
};

// ==========================================
// 2. ERROR CLASSIFICATION
// ==========================================

export interface ClassifiedAIError {
  code: 'AUTH_ERROR' | 'UNAUTHORIZED_KEY' | 'MODEL_NOT_FOUND' | 'QUOTA_EXCEEDED' | 'RATE_LIMITED' | 'TIMEOUT' | 'PROVIDER_ERROR' | 'SCHEMA_ERROR';
  cleanMessage: string;
}

export function classifyAIError(err: any): ClassifiedAIError {
  const raw = String(err?.message || err || '');
  const status = Number(err?.status || err?.statusCode || 0);

  if (status === 401 || status === 403 || raw.includes('401') || raw.includes('403') || /API key|unauthorized|permission|invalid api key/i.test(raw)) {
    return {
      code: 'UNAUTHORIZED_KEY',
      cleanMessage: 'Khóa API không hợp lệ hoặc thiếu quyền truy cập Google Generative AI.'
    };
  }

  if (status === 404 || raw.includes('404') || /not found|model/i.test(raw)) {
    return {
      code: 'MODEL_NOT_FOUND',
      cleanMessage: `Mô hình AI "${getActiveGeminiModel()}" không tồn tại, không tìm thấy hoặc tài khoản chưa được hỗ trợ.`
    };
  }

  if (status === 429 || raw.includes('429') || /ResourceExhausted|quota|rate limit|too many requests/i.test(raw)) {
    return {
      code: 'RATE_LIMITED',
      cleanMessage: 'Đã chạm giới hạn hạn ngạch hoặc vượt hạn mức (Rate limit/Quota). Vui lòng thử lại sau ít phút.'
    };
  }

  if (/timeout|aborted|ETIMEDOUT|deadline/i.test(raw)) {
    return {
      code: 'TIMEOUT',
      cleanMessage: 'Kết nối tới máy chủ Google AI bị quá thời gian (timeout). Vui lòng thử lại.'
    };
  }

  return {
    code: 'PROVIDER_ERROR',
    cleanMessage: `Dịch vụ AI phản hồi lỗi: ${raw.slice(0, 150)}`
  };
}

// ==========================================
// 3. CHECK AI CONFIG STATUS (4 DISTINCT STATES)
// ==========================================

export function checkAIConfig(): AIServiceStatus {
  loadLocalSecrets();
  const apiKey = process.env.GEMINI_API_KEY;
  const model = getActiveGeminiModel();

  // State 1: NOT_CONFIGURED
  if (!apiKey || apiKey.trim().length <= 10) {
    return {
      status: 'NOT_CONFIGURED',
      isConfigured: false,
      provider: 'none',
      model,
      activeModel: model,
      message: 'Chưa cấu hình GEMINI_API_KEY trong biến môi trường hoặc Firebase Secrets. Đang bật chế độ soạn bài thủ công và 6 bài đọc mẫu GDPT.',
      lastVerifiedAt: null,
      lastLatencyMs: null,
      lastErrorCode: null
    };
  }

  // State 2: UNAVAILABLE (recent persistent error within last 5 minutes)
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  if (verificationState.lastError && verificationState.lastError.timestamp > fiveMinAgo) {
    return {
      status: 'UNAVAILABLE',
      isConfigured: true,
      provider: 'gemini',
      model,
      activeModel: model,
      message: `Dịch vụ AI tạm thời không khả dụng: ${verificationState.lastError.message}`,
      lastVerifiedAt: verificationState.verifiedAt,
      lastLatencyMs: verificationState.latencyMs,
      lastErrorCode: verificationState.lastError.code
    };
  }

  // State 3: VERIFIED (actual live synthetic call succeeded)
  if (verificationState.verified && verificationState.verifiedAt) {
    return {
      status: 'VERIFIED',
      isConfigured: true,
      provider: 'gemini',
      model,
      activeModel: model,
      message: `Dịch vụ AI đang hoạt động bình thường (Model: ${verificationState.modelUsed || model}, độ trễ: ${verificationState.latencyMs}ms).`,
      lastVerifiedAt: verificationState.verifiedAt,
      lastLatencyMs: verificationState.latencyMs,
      lastErrorCode: null
    };
  }

  // State 4: READY_UNVERIFIED (key present, but not yet verified with live call)
  return {
    status: 'READY_UNVERIFIED',
    isConfigured: true,
    provider: 'gemini',
    model,
    activeModel: model,
    message: `Đã cấu hình khóa API cho model ${model} (chưa thực hiện kiểm thử kết nối trực tiếp).`,
    lastVerifiedAt: null,
    lastLatencyMs: null,
    lastErrorCode: null
  };
}

// ==========================================
// 4. LIVE SYNTHETIC AI CONNECTION TEST (v4.0)
// ==========================================

let lastTestTimestamp = 0;

export async function runAILiveTest(): Promise<{
  success: boolean;
  status: AIServiceStatus;
  sampleOutput?: string;
  error?: string;
}> {
  loadLocalSecrets();
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = getActiveGeminiModel();

  if (!apiKey || apiKey.trim().length <= 10) {
    return {
      success: false,
      status: checkAIConfig(),
      error: 'Chưa cấu hình GEMINI_API_KEY. Vui lòng thiết lập khóa trước khi kiểm thử.'
    };
  }

  // Rate limit test calls (minimum 5 seconds between consecutive tests)
  const now = Date.now();
  if (now - lastTestTimestamp < 5000) {
    return {
      success: verificationState.verified,
      status: checkAIConfig(),
      error: 'Vui lòng chờ ít nhất 5 giây giữa các lần kiểm tra kết nối AI.'
    };
  }
  lastTestTimestamp = now;

  const genAI = new GoogleGenerativeAI(apiKey);
  const startTime = Date.now();

  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    // Minimal synthetic pedagogical prompt with zero PII
    const result = await model.generateContent(
      'Em hãy viết đúng 1 câu văn miêu tả bông hoa sen cho học sinh lớp 2 theo định dạng JSON: {"cau_van": "..."}'
    );
    const latency = Date.now() - startTime;
    const responseText = result.response.text();

    verificationState = {
      verified: true,
      verifiedAt: Date.now(),
      latencyMs: latency,
      modelUsed: modelName,
      lastError: null
    };

    return {
      success: true,
      status: checkAIConfig(),
      sampleOutput: responseText.slice(0, 150)
    };
  } catch (err: any) {
    const classified = classifyAIError(err);
    verificationState = {
      verified: false,
      verifiedAt: null,
      latencyMs: null,
      modelUsed: modelName,
      lastError: {
        code: classified.code,
        message: classified.cleanMessage,
        timestamp: Date.now()
      }
    };

    return {
      success: false,
      status: checkAIConfig(),
      error: classified.cleanMessage
    };
  }
}

// ==========================================
// 5. ROBUST JSON PARSER & CLEANER
// ==========================================

export function cleanJsonString(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let s = raw.trim();
  s = s.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const firstBrace = s.indexOf('{');
  const lastBrace = s.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    s = s.substring(firstBrace, lastBrace + 1);
  }
  s = s.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"');
  s = s.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
  s = s.replace(/,\s*([}\]])/g, '$1');
  return s.trim();
}

export function robustParseJSON(raw: string): any {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Dữ liệu phản hồi rỗng từ mô hình AI.');
  }

  const cleaned = cleanJsonString(raw);

  try {
    return JSON.parse(cleaned);
  } catch (initialErr) {
    let repaired = cleaned.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
    repaired = repaired.replace(/\/\/[^\r\n]*$/gm, '');

    try {
      return JSON.parse(repaired);
    } catch (secondErr: any) {
      throw new Error('AI trả về bài chưa đúng định dạng chuẩn. Vui lòng bấm "Tạo bản nháp với AI" để thử lại hoặc chuyển sang chế độ soạn thủ công.');
    }
  }
}

// ==========================================
// 5B. DEFENSIVE NORMALIZATION OF DRAFT QUESTIONS (P0 FIX)
// ==========================================
export function normalizeDraftQuestions(questions: any[]): any[] {
  if (!Array.isArray(questions)) return [];

  return questions.map((q: any, idx: number) => {
    const normalized: any = { ...q };
    if (!normalized.id) normalized.id = `q${idx + 1}`;

    if (!normalized.prompt || typeof normalized.prompt !== 'string' || normalized.prompt.trim().length === 0) {
      if (normalized.type === 'sequence') {
        normalized.prompt = 'Sắp xếp 3 sự việc sau theo đúng thứ tự diễn ra trong bài đọc:';
      } else if (normalized.statement) {
        normalized.prompt = normalized.statement;
      } else {
        normalized.prompt = `Câu hỏi đọc hiểu số ${idx + 1}:`;
      }
    }

    if (!normalized.hint || typeof normalized.hint !== 'string' || normalized.hint.trim().length < 3) {
      normalized.hint = 'Em hãy đọc lại đoạn văn trong bài đọc để tìm chi tiết trả lời nhé.';
    }
    if (!normalized.explanation || typeof normalized.explanation !== 'string' || normalized.explanation.trim().length < 3) {
      normalized.explanation = 'Chi tiết này được nêu rõ trong nội dung bài đọc.';
    }

    // Normalize skillTag if invalid
    const VALID_SKILL_TAGS = ['thong_tin_truc_tiep', 'tu_trong_ngu_canh', 'noi_dung_chinh', 'sap_xep_trinh_tu', 'lien_he_van_dung'];
    if (!VALID_SKILL_TAGS.includes(normalized.skillTag)) {
      if (normalized.type === 'sequence') {
        normalized.skillTag = 'sap_xep_trinh_tu';
      } else if (/từ|nghĩa|cụm từ/i.test(normalized.prompt || '')) {
        normalized.skillTag = 'tu_trong_ngu_canh';
      } else if (/chính|chủ yếu|bài học|ý nghĩa/i.test(normalized.prompt || '')) {
        normalized.skillTag = 'noi_dung_chinh';
      } else if (/em nên|liên hệ|bài học cho em|vận dụng/i.test(normalized.prompt || '')) {
        normalized.skillTag = 'lien_he_van_dung';
      } else {
        normalized.skillTag = 'thong_tin_truc_tiep';
      }
    }

    // Clean & Normalize true_false
    if (normalized.type === 'true_false') {
      delete normalized.options;
      delete normalized.items;
      if (!normalized.statement || typeof normalized.statement !== 'string') {
        normalized.statement = normalized.prompt;
      }
      if (typeof normalized.answer === 'string') {
        const lower = normalized.answer.trim().toLowerCase();
        if (lower === 'true' || lower === 'đúng' || lower === 'dung' || lower === '1') {
          normalized.answer = true;
        } else if (lower === 'false' || lower === 'sai' || lower === '0') {
          normalized.answer = false;
        } else {
          normalized.answer = true;
        }
      } else if (typeof normalized.answer !== 'boolean') {
        normalized.answer = true;
      }
    }

    // Clean & Normalize multiple_choice
    if (normalized.type === 'multiple_choice') {
      delete normalized.items;
      delete normalized.statement;
      if (Array.isArray(normalized.options)) {
        if (normalized.options.length > 3) {
          normalized.options = normalized.options.slice(0, 3);
        }
        while (normalized.options.length < 3) {
          normalized.options.push(`Lựa chọn ${String.fromCharCode(65 + normalized.options.length)}`);
        }
      } else {
        normalized.options = ['Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C'];
      }

      if (typeof normalized.answer === 'string') {
        const trimmed = normalized.answer.trim().toUpperCase();
        if (['A', 'B', 'C'].includes(trimmed)) {
          normalized.answer = trimmed;
        } else {
          normalized.answer = 'A';
        }
      } else {
        normalized.answer = 'A';
      }
    }

    // Clean & Normalize sequence
    if (normalized.type === 'sequence') {
      delete normalized.options;
      delete normalized.statement;
      if (!Array.isArray(normalized.items) || normalized.items.length !== 3) {
        if (Array.isArray(normalized.answer) && normalized.answer.length === 3) {
          normalized.items = [...normalized.answer];
        } else {
          normalized.items = ['Sự việc bắt đầu', 'Sự việc tiếp theo', 'Sự việc kết thúc'];
        }
      }
      if (!Array.isArray(normalized.answer) || normalized.answer.length !== 3) {
        normalized.answer = [...normalized.items];
      }
    }

    // Normalize difficulty
    const VALID_DIFFICULTIES = ['nhan_biet', 'thong_hieu', 'van_dung'];
    if (!VALID_DIFFICULTIES.includes(normalized.difficulty)) {
      if (idx < 2) normalized.difficulty = 'nhan_biet';
      else if (idx < 4) normalized.difficulty = 'thong_hieu';
      else normalized.difficulty = 'van_dung';
    }

    return normalized;
  });
}

// ==========================================
// 6. GENERATE LESSON DRAFT WITH GEMINI
// ==========================================

export async function generateLessonWithAI(req: GenerateLessonAIRequest): Promise<LessonDraftInput> {
  const config = checkAIConfig();
  if (!config.isConfigured) {
    throw new Error('Chưa kết nối dịch vụ AI (Chưa cấu hình GEMINI_API_KEY). Vui lòng sử dụng tính năng Soạn thủ công hoặc cấu hình khóa API.');
  }

  const apiKey = process.env.GEMINI_API_KEY!;
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = getActiveGeminiModel();

  const wordCount = req.targetWordCount || (req.grade === 2 ? 140 : 180);
  const questionCount = req.questionCount || 5;

  // Sanitize inputs to prevent prompt injection (treat user strings strictly as topic data)
  const safeTopic = String(req.topic || '').replace(/[\r\n\t]+/g, ' ').slice(0, 100);
  const safeGoal = req.readingGoal ? String(req.readingGoal).replace(/[\r\n\t]+/g, ' ').slice(0, 150) : '';
  const safeContext = req.localContext ? String(req.localContext).replace(/[\r\n\t]+/g, ' ').slice(0, 150) : '';

  const prompt = `
Bạn là chuyên gia sư phạm tiểu học môn Tiếng Việt cho học sinh lớp ${req.grade}.
Hãy tạo một bài đọc hiểu mới hoàn chỉnh bằng Tiếng Việt theo chuẩn chương trình GDPT môn Tiếng Việt tiểu học.

YÊU CẦU BẮT BUỘC:
1. Chủ đề: "${safeTopic}". Thể loại: ${req.genre === 'informational' ? 'Văn bản thông tin' : 'Văn bản tự sự / Truyện ngắn'}.
${safeGoal ? `Mục tiêu đọc hiểu: ${safeGoal}` : ''}
${safeContext ? `Bối cảnh địa phương: ${safeContext}` : ''}
${req.customVocabulary && req.customVocabulary.length > 0 ? `Từ vựng cần lồng ghép: ${req.customVocabulary.join(', ')}` : ''}
2. Độ dài bài đọc: Khoảng ${wordCount} từ (Lớp 2: 100-180 từ; Lớp 3: 150-220 từ). Giọng văn trong sáng, dễ hiểu, giàu cảm xúc, phù hợp lứa tuổi 7-9 tuổi. KHÔNG sao chép nguyên văn SGK.
   - Đối với văn bản thông tin: Giữ tính khoa học, khách quan, chính xác. TUYỆT ĐỐI KHÔNG nhân hóa phi khoa học hay gán cảm xúc vô lý (ví dụ: KHÔNG viết 'cây cối biết buồn đau', 'dòng sông biết giận dỗi' trong văn bản thông tin; hãy dùng 'cây cối bị héo úa', 'nguồn nước bị suy kiệt').
   - Đối với hành động miêu tả chăm sóc cây: Sử dụng từ ngữ chính xác, tự nhiên theo chuẩn tiếng Việt (ví dụ: 'ngắt bỏ lá sâu trên cành', 'nhặt những chiếc lá úa rơi rụng dưới đất'; TUYỆT ĐỐI KHÔNG dùng câu mâu thuẫn hay ngô nghê như 'vặt bỏ lá úa rơi rụng dưới đất').
   - Ngữ pháp: Câu ngắn gọn (mỗi câu không quá 18-20 từ), ngắt nghỉ rõ ràng, đúng chính tả tiếng Việt.
3. Từ vựng (vocabulary): 2 đến 3 từ khó hoặc từ ngữ đặc sắc trong bài, kèm nghĩa ngắn gọn và ví dụ minh họa gần gũi với học sinh.
4. Câu hỏi đọc hiểu: Đúng ${questionCount} câu hỏi được phân bổ trong 5 dạng câu hỏi:
   - Dạng 'multiple_choice': Đúng 3 phương án A, B, C (options là mảng 3 chuỗi sạch). 'answer' là 'A' hoặc 'B' hoặc 'C'.
   - Dạng 'true_false': Có 'statement' nhận định. 'answer' là true hoặc false.
   - Dạng 'sequence': Sắp xếp 3 sự việc chính trong bài. 'items' là mảng 3 chuỗi. 'answer' là mảng 3 chuỗi theo đúng thứ tự thời gian chuẩn.
   - Dạng 'matching': Ghép đôi 3 đối tượng (từ với nghĩa, hoặc sự việc với nội dung). 'leftItems' là mảng 3 chuỗi, 'rightItems' là mảng 3 chuỗi, 'matchingPairs' là object { [chuỗi trái]: chuỗi phải tương ứng }, 'answer' là matchingPairs này.
   - Dạng 'fill_blank': Điền khuyết 1-2 từ. 'prompt' hoặc 'blankContext' có [ ... ], 'answer' là từ/cụm từ đúng, 'acceptedAnswers' là mảng 1-3 cách diễn đạt tương đương được chấp nhận.
5. Mỗi câu hỏi PHẢI có:
   - id: chuỗi 'q1', 'q2', ...
   - prompt: lời dẫn câu hỏi
   - skillTag: một trong ('thong_tin_truc_tiep' | 'tu_trong_ngu_canh' | 'noi_dung_chinh' | 'sap_xep_trinh_tu' | 'lien_he_van_dung')
   - difficulty: một trong ('nhan_biet' | 'thong_hieu' | 'van_dung')
   - hint: Gợi ý sư phạm giúp học sinh tự tìm câu trả lời (KHÔNG được lộ đáp án!)
   - explanation: Lời giải thích rõ ràng vì sao đáp án đó là đúng để học sinh học tập.
   - relatedPassagePart: Trích dẫn đoạn văn liên quan trong bài đọc.

ĐỊNH DẠNG ĐẦU RA:
Bắt buộc CHỈ trả về DUY NHẤT một chuỗi JSON hợp lệ tuân thủ cấu trúc sau (không kèm markdown ngoài JSON):
{
  "title": "Tên bài đọc",
  "passage": "Nội dung bài đọc...",
  "grade": ${req.grade},
  "topic": "${safeTopic}",
  "genre": "${req.genre || 'narrative'}",
  "vocabulary": [
    { "word": "từ", "meaning": "nghĩa ngắn gọn", "example": "ví dụ câu" }
  ],
  "questions": [
    {
      "id": "q1",
      "type": "multiple_choice",
      "prompt": "Câu hỏi...",
      "options": ["Lựa chọn A", "Lựa chọn B", "Lựa chọn C"],
      "answer": "A",
      "hint": "Gợi ý...",
      "explanation": "Giải thích...",
      "skillTag": "thong_tin_truc_tiep",
      "difficulty": "nhan_biet",
      "relatedPassagePart": "Trích đoạn..."
    }
  ]
}
`;

  let responseText: string;
  const startTime = Date.now();

  let usedModelName = modelName;
  let fallbackUsed = false;

  try {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: 'application/json' }
    });
    const result = await model.generateContent(prompt);
    responseText = result.response.text();
  } catch (err: any) {
    const primaryErrorMsg = err.message || String(err);
    console.warn(`[Gemini AI Functions] Primary model "${modelName}" failed: ${primaryErrorMsg}. Switching to verified fallback model "${FALLBACK_GEMINI_MODEL}"...`);
    usedModelName = FALLBACK_GEMINI_MODEL;
    fallbackUsed = true;
    try {
      const fbModel = genAI.getGenerativeModel({
        model: FALLBACK_GEMINI_MODEL,
        generationConfig: { responseMimeType: 'application/json' }
      });
      const fbResult = await fbModel.generateContent(prompt);
      responseText = fbResult.response.text();
    } catch (fbErr: any) {
      const classified = classifyAIError(fbErr);
      verificationState = {
        verified: false,
        verifiedAt: null,
        latencyMs: null,
        modelUsed: FALLBACK_GEMINI_MODEL,
        lastError: {
          code: classified.code,
          message: classified.cleanMessage,
          timestamp: Date.now()
        }
      };
      throw new Error(`Cả mô hình chính (${modelName}) và dự phòng (${FALLBACK_GEMINI_MODEL}) đều lỗi: ${classified.cleanMessage}`);
    }
  }

  // Mark as verified on successful lesson generation
  verificationState = {
    verified: true,
    verifiedAt: Date.now(),
    latencyMs: Date.now() - startTime,
    modelUsed: usedModelName,
    lastError: null
  };

  let parsed: any;
  try {
    parsed = robustParseJSON(responseText);
  } catch (err: any) {
    throw err;
  }

  const isInfo = (parsed.genre || req.genre) === 'informational';
  const polishText = (text: string): string => {
    if (!text || typeof text !== 'string') return text;
    let s = text;
    // Fix awkward leaf actions
    s = s.replace(/vặt\s+bỏ\s+những\s+chiếc\s+lá\s+úa\s+rơi\s+rụng\s+dưới\s+đất/gi, 'nhặt những chiếc lá úa rơi rụng dưới đất');
    s = s.replace(/vặt\s+bỏ\s+lá\s+úa\s+rơi\s+rụng\s+dưới\s+đất/gi, 'nhặt lá úa rơi rụng dưới đất');
    s = s.replace(/vặt\s+bỏ\s+những\s+chiếc\s+lá\s+úa\s+dưới\s+đất/gi, 'nhặt những chiếc lá úa dưới đất');
    s = s.replace(/vặt\s+lá\s+úa\s+dưới\s+đất/gi, 'nhặt lá úa dưới đất');
    s = s.replace(/vặt\s+bỏ\s+những\s+chiếc\s+lá\s+úa\s+rơi\s+rụng/gi, 'nhặt những chiếc lá úa rơi rụng');
    s = s.replace(/vặt\s+bỏ\s+lá\s+úa\s+rơi\s+rụng/gi, 'nhặt lá úa rơi rụng dưới đất');
    s = s.replace(/vặt\s+bỏ\s+những\s+chiếc\s+lá\s+úa/gi, 'ngắt bỏ những chiếc lá sâu úa trên cành');
    // Fix unscientific personifications in informational genre
    if (isInfo) {
      s = s.replace(/cây\s+cối\s+biết\s+buồn\s+đau/gi, 'cây cối sẽ khô héo và kiệt sức');
      s = s.replace(/cây\s+biết\s+buồn\s+đau/gi, 'cây sẽ héo úa');
      s = s.replace(/biết\s+buồn\s+đau/gi, 'bị tổn hại nặng nề');
      s = s.replace(/dòng\s+sông\s+biết\s+giận\s+dỗi/gi, 'dòng sông bị ô nhiễm trầm trọng');
    }
    return s;
  };

  if (parsed.passage) {
    parsed.passage = polishText(parsed.passage);
  }
  if (parsed.title) {
    parsed.title = polishText(parsed.title);
  }



  // Defensive normalization of questions
  if (parsed && Array.isArray(parsed.questions)) {
    parsed.questions = normalizeDraftQuestions(parsed.questions);
  }

  if (!parsed.genre || (parsed.genre !== 'narrative' && parsed.genre !== 'informational')) {
    parsed.genre = req.genre || 'narrative';
  }
  if (parsed.grade !== 2 && parsed.grade !== 3) {
    parsed.grade = req.grade;
  }

  // Validate with Zod
  const validation = LessonDraftSchema.safeParse(parsed);
  if (!validation.success) {
    const errorDetails = validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Dữ liệu bài học AI tạo chưa thỏa mãn kiểm định sư phạm: ${errorDetails}`);
  }

  return validation.data;
}

// ==========================================
// 7. GENERATE REMEDIATION SUGGESTIONS (V5.6 MULTI-DIMENSIONAL & 8 ACTIVITY TYPES)
// ==========================================

export interface RemediationGenerationContext {
  className: string;
  grade: number;
  academicYear?: string;
  semester?: 1 | 2 | 'all';
  scope?: AnalysisScope;
  scopeSummary?: {
    scopeName: string;
    targetName?: string;
    targetDescription?: string;
    totalAttempts: number;
    totalStudents: number;
    avgScore: number;
    progressDelta: number;
    detailBadge?: string;
  };
  studentProfile?: {
    studentId: string;
    studentCode: string;
    displayAlias: string;
    totalAttempts: number;
    firstTryAvg: number;
    finalAvg: number;
    progressDelta: number;
    strongSkills: string[];
    weakSkills: string[];
    recentAttempts: Array<{
      attemptId: string;
      lessonTitle: string;
      firstScore: number;
      finalScore: number;
      progress: number;
      completedAt: number;
    }>;
  };
  studentGroups?: {
    supportGroup: Array<{ studentId: string; studentCode: string; displayAlias: string; avgAccuracy: number; reason: string }>;
    growthGroup: Array<{ studentId: string; studentCode: string; displayAlias: string; avgAccuracy: number; reason: string }>;
  };
  totalStudents: number;
  participatedStudents?: number;
  avgAccuracyFirstTry: number;
  weakSkills: Array<{
    skillTag: SkillTag;
    label: string;
    accuracyFirstTry: number;
    studentsNeedingHelp: number;
  }>;
  goodSkills?: Array<{
    skillTag: SkillTag;
    label: string;
    accuracyFirstTry: number;
  }>;
  highErrorQuestions?: Array<{
    questionId: string;
    prompt: string;
    skillTag: SkillTag;
    skillLabel: string;
    testedCount: number;
    incorrectCount: number;
    incorrectPercentage: number;
  }>;
  sourceLesson?: {
    id: string;
    title: string;
    topic?: string;
    passage?: string;
    vocabulary?: Array<{ word: string; meaning: string; example?: string }>;
    questions?: Array<{ id: string; prompt: string; type: string; answer?: any; options?: string[]; hint?: string; explanation?: string; skillTag?: SkillTag }>;
  };
}

export async function generateRemediationWithAI(
  ctx: RemediationGenerationContext
): Promise<RemediationSuggestionResponse> {
  const config = checkAIConfig();
  const weakSkills = ctx.weakSkills || [];
  const goodSkills = ctx.goodSkills || [];
  const highErrorQuestions = ctx.highErrorQuestions || [];
  const scope = ctx.scope || 'toan_lop';

  // Helper to construct structured pedagogical activities from real data
  const buildPedagogicalActivities = (): RemediationActivity[] => {
    const list: RemediationActivity[] = [];
    const lessonTitle = ctx.sourceLesson?.title || 'Bài đọc tuần học';
    const lessonId = ctx.sourceLesson?.id;
    const grade = ctx.grade || 2;
    const now = Date.now();

    // Default sample vocabulary from source or rich pedagogical bank
    const sourceVocab = ctx.sourceLesson?.vocabulary && ctx.sourceLesson.vocabulary.length > 0
      ? ctx.sourceLesson.vocabulary
      : [
          { word: 'chăm chỉ', meaning: 'làm việc liên tục, hết lòng và đều đặn', example: 'Bạn nhỏ chăm chỉ tưới hoa mỗi sáng.' },
          { word: 'rực rỡ', meaning: 'tươi sáng, nổi bật và đẹp mắt', example: 'Những bông hoa nở rực rỡ dưới nắng vàng.' },
          { word: 'ngỡ ngàng', meaning: 'ngạc nhiên đến mức sững sờ', example: 'Em ngỡ ngàng trước cảnh đẹp của đồi chè.' },
          { word: 'thân thiện', meaning: 'gần gũi, cởi mở và tốt bụng', example: 'Mọi người trong xóm sống rất thân thiện.' }
        ];

    // Default sequence items from source or pedagogical narrative
    const defaultSeq = [
      { order: 1, text: 'Mở đầu: Bạn nhỏ phát hiện một mầm cây non sau vườn nhà.', hint: 'Sự việc bắt đầu vào buổi sáng sớm.' },
      { order: 2, text: 'Diễn biến: Hằng ngày em tưới nước, bắt sâu và che mát cho cây.', hint: 'Hành động chăm sóc kiên trì của bạn nhỏ.' },
      { order: 3, text: 'Kết thúc: Mầm cây lớn nhanh, nở chùm hoa thơm ngát cả góc vườn.', hint: 'Kết quả ngọt ngào nhờ sự chăm chỉ.' }
    ];

    // Determine target audience text based on scope
    let audience = `Học sinh lớp ${ctx.className}`;
    if (scope === 'tung_hoc_sinh' && ctx.studentProfile) {
      audience = `Học sinh ${ctx.studentProfile.displayAlias} (${ctx.studentProfile.studentCode})`;
    } else if (scope === 'nhom_hoc_sinh') {
      audience = `Nhóm học sinh cần củng cố (${ctx.studentGroups?.supportGroup.length || weakSkills[0]?.studentsNeedingHelp || 1} em)`;
    } else if (weakSkills.length > 0) {
      audience = `Học sinh cần củng cố kỹ năng ${weakSkills[0].label}`;
    }

    // 1. HOẠT ĐỘNG 1: TRUY TÌM NGHĨA CỦA TỪ (ghép từ với nghĩa)
    list.push({
      id: `act_truy_tim_nghia_tu_${now}_1`,
      activityType: 'truy_tim_nghia_tu',
      title: 'Trò chơi: Thám tử từ ngữ — Ghép từ với nghĩa',
      targetAudience: audience,
      targetSkill: 'tu_trong_ngu_canh',
      skillObjective: `Hiểu nghĩa của các từ ngữ trong ngữ cảnh bài đọc "${lessonTitle}" theo yêu cầu cần đạt GDPT 2018 Tiếng Việt lớp ${grade}.`,
      sourceLessonId: lessonId,
      sourceLessonTitle: lessonTitle,
      durationMinutes: 10,
      materialsNeeded: [
        'Bộ thẻ từ và thẻ nghĩa in sẵn hoặc trình chiếu trên bảng tương tác',
        'Phiếu thám tử nhí cho từng đôi bạn',
        'Bút màu dạ quang để gạch chân từ khóa'
      ],
      teacherSteps: [
        'Bước 1: Giáo viên nêu tình huống "Bí mật trong câu chuyện" và chiếu 4 từ mới cần giải mã.',
        'Bước 2: Học sinh thảo luận đôi bạn trong 3 phút, tìm câu văn chứa từ trong bài đọc để suy đoán nghĩa.',
        'Bước 3: Đại diện các nhóm lên bảng ghép thẻ từ với thẻ giải nghĩa tương ứng.',
        'Bước 4: Giáo viên chuẩn hóa, cùng học sinh đặt 1 câu mới với từ vừa học.'
      ],
      contentPayload: {
        instructions: 'Em hãy đọc kỹ các từ ngữ mới và chọn thẻ giải nghĩa đúng nhất trong ngữ cảnh bài đọc.',
        gameTemplate: 'word_meaning_match',
        gameData: {
          pairs: sourceVocab.slice(0, 4)
        },
        items: sourceVocab.slice(0, 4).map((v, i) => ({
          id: `item_vocab_${i + 1}`,
          prompt: `Từ "${v.word}" trong bài có nghĩa là gì?`,
          answer: v.meaning,
          options: [
            v.meaning,
            `nghĩa trái ngược với ${v.word}`,
            'không liên quan đến ngữ cảnh bài đọc'
          ],
          explanation: `Trong câu ví dụ: "${v.example || v.meaning}", từ "${v.word}" mang nghĩa: ${v.meaning}.`,
          hint: 'Đọc lại đoạn văn có chứa từ này để tìm gợi ý xung quanh.'
        }))
      },
      evaluationCriteria: 'Học sinh ghép đúng từ 3/4 cặp từ ngữ trở lên và giải thích được lý do chọn dựa vào ngữ cảnh câu văn.',
      description: 'Trò chơi tương tác ghép thẻ từ ngữ với nghĩa tương ứng, giúp học sinh mở rộng vốn từ và hiểu sâu văn bản.',
      suggestedFormat: 'Trò chơi ghép thẻ tương tác nhóm đôi (10 phút)',
      status: 'draft',
      createdAt: now
    });

    // 2. HOẠT ĐỘNG 2: XẾP TRANH THEO TRÌNH TỰ (đổi vị trí thẻ sự việc)
    list.push({
      id: `act_xep_tranh_trinh_tu_${now}_2`,
      activityType: 'xep_tranh_trinh_tu',
      title: 'Trò chơi: Đạo diễn nhí — Sắp xếp trình tự câu chuyện',
      targetAudience: audience,
      targetSkill: 'sap_xep_trinh_tu',
      skillObjective: `Nhận biết và khôi phục trật tự diễn biến các sự việc trước - sau trong bài đọc theo chuẩn GDPT 2018 Tiếng Việt lớp ${grade}.`,
      sourceLessonId: lessonId,
      sourceLessonTitle: lessonTitle,
      durationMinutes: 12,
      materialsNeeded: [
        'Bộ 3–4 thẻ sự việc hoặc tranh minh họa cốt truyện',
        'Bảng gài nhóm hoặc máy chiếu',
        'Nam châm dán bảng'
      ],
      teacherSteps: [
        'Bước 1: Giáo viên xáo trộn thứ tự 3 sự việc chính của câu chuyện trên bảng.',
        'Bước 2: Hướng dẫn học sinh chú ý các từ chỉ thời gian và trình tự: "Trước tiên", "Sau đó", "Cuối cùng".',
        'Bước 3: Học sinh thực hành kéo đổi vị trí thẻ sự việc theo đúng mạch diễn biến.',
        'Bước 4: Gọi 1 học sinh dựa vào các thẻ đã xếp đúng để tóm tắt lại câu chuyện.'
      ],
      contentPayload: {
        instructions: 'Em hãy kéo các thẻ sự việc vào đúng thứ tự diễn ra trong câu chuyện từ đầu đến cuối.',
        gameTemplate: 'sequence_order',
        gameData: {
          sequenceItems: defaultSeq
        },
        items: [
          {
            id: 'item_seq_1',
            prompt: 'Sắp xếp 3 sự việc chính sau theo đúng trật tự thời gian diễn ra trong câu chuyện.',
            answer: '1 -> 2 -> 3',
            explanation: 'Sự việc mở đầu dẫn tới các hành động chăm sóc, và cuối cùng mang lại kết quả trọn vẹn.',
            hint: 'Hãy nhớ lại sự việc nào xảy ra trước tiên vào buổi sáng.'
          }
        ]
      },
      evaluationCriteria: 'Học sinh sắp xếp đúng 100% trật tự 3 sự việc và kể lại được tóm tắt mạch truyện bằng lời của mình.',
      description: 'Thực hành tương tác sắp xếp thẻ sự việc giúp củng cố tư duy logic và nắm bắt cấu trúc cốt truyện.',
      suggestedFormat: 'Thao tác thẻ trực quan trên bảng hoặc thiết bị (12 phút)',
      status: 'draft',
      createdAt: now
    });

    // 3. HOẠT ĐỘNG 3: SĂN KHO BÁU ĐỌC HIỂU (tìm thông tin trực tiếp)
    list.push({
      id: `act_san_kho_bau_doc_hieu_${now}_3`,
      activityType: 'san_kho_bau_doc_hieu',
      title: 'Hoạt động: Săn kho báu đọc hiểu — Kính lúp tìm chi tiết',
      targetAudience: audience,
      targetSkill: 'thong_tin_truc_tiep',
      skillObjective: `Rèn luyện kỹ năng định vị thông tin tường minh (ai, ở đâu, khi nào, làm gì) trong văn bản theo chuẩn GDPT 2018.`,
      sourceLessonId: lessonId,
      sourceLessonTitle: lessonTitle,
      durationMinutes: 10,
      materialsNeeded: [
        'Phiếu truy tìm kho báu có in sẵn các câu hỏi tìm chi tiết',
        'Bút chì màu để khoanh vùng đoạn văn chứa câu trả lời'
      ],
      teacherSteps: [
        'Bước 1: Giáo viên phát Phiếu truy tìm kho báu gồm 3 manh mối chi tiết.',
        'Bước 2: Hướng dẫn học sinh dùng "kính lúp" (bút màu) gạch chân từ khóa trong câu hỏi rồi soi vào bài đọc.',
        'Bước 3: Học sinh ghi nhanh đáp án vào hộp kho báu.',
        'Bước 4: Tổ chức đối chiếu kết quả chéo giữa các bàn và trao huy hiệu Nhà thám hiểm.'
      ],
      contentPayload: {
        instructions: 'Đọc kỹ câu hỏi, tìm câu văn trong bài đọc chứa thông tin rồi chọn câu trả lời chính xác nhất.',
        items: [
          {
            id: 'item_kho_bau_1',
            prompt: 'Chi tiết nào trong bài thể hiện rõ nhất tình cảm của bạn nhỏ đối với cây non?',
            answer: 'Hằng ngày bạn nhỏ đều ra vườn tưới nước và trò chuyện cùng cây.',
            options: [
              'Hằng ngày bạn nhỏ đều ra vườn tưới nước và trò chuyện cùng cây.',
              'Bạn nhỏ chỉ ngắm cây một lần vào ngày đầu tiên.',
              'Bạn nhỏ nhờ người khác chăm sóc giúp.'
            ],
            explanation: 'Chi tiết này được nêu trực tiếp ở đoạn 2 của bài đọc.',
            hint: 'Tìm câu văn kể về việc làm mỗi ngày của bạn nhỏ.'
          }
        ]
      },
      evaluationCriteria: 'Học sinh chỉ ra chính xác dòng hoặc đoạn văn chứa thông tin và trả lời đúng chi tiết.',
      description: 'Hoạt động rèn luyện kỹ năng đọc lướt tìm từ khóa và xác định dữ kiện trực tiếp từ văn bản.',
      suggestedFormat: 'Phiếu thám tử đọc hiểu cá nhân có hướng dẫn (10 phút)',
      status: 'draft',
      createdAt: now
    });

    // 4. HOẠT ĐỘNG 4: ĐÚNG HAY SAI (nội dung chính & chi tiết)
    list.push({
      id: `act_dung_hay_sai_${now}_4`,
      activityType: 'dung_hay_sai',
      title: 'Trò chơi: Trọng tài nhí — Đúng hay Sai?',
      targetAudience: audience,
      targetSkill: 'noi_dung_chinh',
      skillObjective: `Phân biệt nhận định đúng với chi tiết gây nhiễu, nắm vững ý chính toàn bài theo chuẩn GDPT 2018 Tiếng Việt lớp ${grade}.`,
      sourceLessonId: lessonId,
      sourceLessonTitle: lessonTitle,
      durationMinutes: 8,
      materialsNeeded: [
        'Biển Đúng (xanh) / Sai (đỏ) cho mỗi học sinh hoặc thao tác nút bấm tương tác'
      ],
      teacherSteps: [
        'Bước 1: Giáo viên đọc to một nhận định liên quan đến bài đọc.',
        'Bước 2: Học sinh suy nghĩ 5 giây và giơ biển Đúng hoặc Sai.',
        'Bước 3: Nếu là "Sai", học sinh phải giải thích câu văn chính xác trong bài đọc là gì.',
        'Bước 4: Tổng kết số điểm của Trọng tài nhí xuất sắc.'
      ],
      contentPayload: {
        instructions: 'Em hãy làm trọng tài, đọc từng nhận định và chọn ĐÚNG nếu đúng với bài đọc, chọn SAI nếu có chi tiết nhầm lẫn.',
        items: [
          {
            id: 'item_tf_1',
            prompt: 'Nhận định: "Bạn nhỏ bỏ quên mầm cây và cây tự nở hoa."',
            answer: 'Sai',
            options: ['Đúng', 'Sai'],
            explanation: 'Sai vì bạn nhỏ đã kiên trì chăm sóc mỗi ngày thì cây mới nở hoa đẹp.',
            hint: 'Nhớ lại xem ai là người chăm sóc cây hằng ngày.'
          },
          {
            id: 'item_tf_2',
            prompt: 'Nhận định: "Câu chuyện khuyên chúng ta hãy chăm chỉ và biết yêu quý thiên nhiên."',
            answer: 'Đúng',
            options: ['Đúng', 'Sai'],
            explanation: 'Đúng, đây là bài học và thông điệp ý nghĩa chính của bài đọc.',
            hint: 'Suy nghĩ về cảm xúc và ý nghĩa của câu chuyện.'
          }
        ]
      },
      evaluationCriteria: 'Phản xạ chính xác nhận định Đ/S và chỉ ra được chi tiết chứng minh trong văn bản.',
      description: 'Hình thức trắc nghiệm Đúng/Sai vui nhộn, tạo không khí hào hứng và rèn luyện tư duy phản biện.',
      suggestedFormat: 'Trò chơi giơ biển trọng tài hoặc tương tác nhanh (8 phút)',
      status: 'draft',
      createdAt: now
    });

    // 5. HOẠT ĐỘNG 5: PHÓNG VIÊN NHÍ (liên hệ & vận dụng)
    list.push({
      id: `act_phong_vien_nhi_${now}_5`,
      activityType: 'phong_vien_nhi',
      title: 'Hoạt động: Phóng viên nhí — Phỏng vấn và liên hệ',
      targetAudience: audience,
      targetSkill: 'lien_he_van_dung',
      skillObjective: `Vận dụng bài học trong văn bản vào đời sống thực tế bản thân theo định hướng phát triển năng lực GDPT 2018.`,
      sourceLessonId: lessonId,
      sourceLessonTitle: lessonTitle,
      durationMinutes: 15,
      materialsNeeded: [
        'Micro đồ chơi hoặc ống cuốn giấy làm micro',
        'Thẻ câu hỏi gợi ý phỏng vấn'
      ],
      teacherSteps: [
        'Bước 1: Giáo viên làm mẫu vai phóng viên phỏng vấn nhân vật chính về cảm xúc trong bài.',
        'Bước 2: Cho học sinh đóng cặp: 1 bạn làm Phóng viên, 1 bạn đóng vai Nhân vật hoặc Người bạn chia sẻ.',
        'Bước 3: Phóng viên đặt câu hỏi: "Nếu ở trong hoàn cảnh đó, bạn sẽ làm gì?".',
        'Bước 4: Đại diện 2 cặp lên thể hiện trước lớp, cả lớp bình chọn câu trả lời ý nghĩa nhất.'
      ],
      contentPayload: {
        instructions: 'Đóng vai phóng viên và người được phỏng vấn, liên hệ việc làm thực tế của em ở trường và nhà.',
        items: [
          {
            id: 'item_interview_1',
            prompt: 'Câu hỏi phỏng vấn: "Em đã từng làm một việc tốt nào để giúp đỡ người thân hoặc bảo vệ cây xanh chưa? Cảm xúc của em lúc đó thế nào?"',
            answer: 'Câu trả lời mở: Học sinh nêu được việc làm cụ thể và cảm xúc tự hào, vui vẻ của bản thân.',
            explanation: 'Khuyến khích học sinh bộc lộ suy nghĩ chân thật và rèn kỹ năng diễn đạt thành câu hoàn chỉnh.'
          }
        ]
      },
      evaluationCriteria: 'Học sinh tự tin nói thành câu, diễn đạt rõ ràng cảm nghĩ và liên hệ việc làm phù hợp lứa tuổi.',
      description: 'Hoạt động sân khấu hóa kết hợp liên hệ thực tế, bồi dưỡng tình cảm và kỹ năng giao tiếp tiếng Việt.',
      suggestedFormat: 'Thực hành đóng vai nhóm đôi trước lớp (15 phút)',
      status: 'draft',
      createdAt: now
    });

    // 6. HOẠT ĐỘNG 6: PHIẾU HỌC TẬP VÀ SƠ ĐỒ TƯ DUY (tổng hợp nội dung chính)
    list.push({
      id: `act_phieu_hoc_tap_so_do_${now}_6`,
      activityType: 'phieu_hoc_tap_so_do',
      title: 'Học liệu: Phiếu học tập & Sơ đồ tư duy bông hoa',
      targetAudience: audience,
      targetSkill: 'noi_dung_chinh',
      skillObjective: `Hệ thống hóa thông tin câu chuyện qua sơ đồ hình ảnh trực quan, hỗ trợ học sinh ghi nhớ nội dung cốt lõi.`,
      sourceLessonId: lessonId,
      sourceLessonTitle: lessonTitle,
      durationMinutes: 12,
      materialsNeeded: [
        'Phiếu học tập in sẵn mẫu bông hoa 4 cánh (Nhân vật, Nơi diễn ra, Việc làm, Bài học)',
        'Bút màu vẽ'
      ],
      teacherSteps: [
        'Bước 1: Giáo viên phát phiếu học tập hình bông hoa tóm tắt.',
        'Bước 2: Hướng dẫn học sinh điền từ khóa chính vào từng cánh hoa tương ứng.',
        'Bước 3: Học sinh trang trí màu sắc và hoàn thiện sơ đồ.',
        'Bước 4: Giáo viên chọn 3 phiếu xuất sắc treo góc học tập của lớp.'
      ],
      contentPayload: {
        instructions: 'Điền từ ngữ thích hợp vào từng cánh hoa để hoàn thành sơ đồ tóm tắt câu chuyện.',
        items: [
          {
            id: 'item_map_1',
            prompt: 'Cánh hoa 1 (Nhân vật chính): Ai là người xuất hiện trong câu chuyện?',
            answer: 'Bạn nhỏ và mầm cây non',
            hint: 'Nhìn vào tựa đề và đoạn mở đầu'
          },
          {
            id: 'item_map_2',
            prompt: 'Cánh hoa 2 (Hành động nổi bật): Bạn nhỏ đã làm gì cho cây?',
            answer: 'Tưới nước, bắt sâu, chăm sóc cây hằng ngày',
            hint: 'Đọc đoạn 2'
          },
          {
            id: 'item_map_3',
            prompt: 'Cánh hoa 3 (Bài học rút ra): Câu chuyện mang lại bài học gì?',
            answer: 'Chăm chỉ, kiên nhẫn và yêu quý thiên nhiên',
            hint: 'Đoạn kết câu chuyện'
          }
        ]
      },
      evaluationCriteria: 'Học sinh hoàn thành đủ 3-4 nhánh của sơ đồ, nêu đúng từ khóa cốt lõi của bài đọc.',
      description: 'Phiếu học tập dạng sơ đồ tư duy hình ảnh giúp học sinh lớp 2–3 dễ dàng ghi nhớ và khái quát ý chính.',
      suggestedFormat: 'Phiếu học tập in sẵn hoặc hoàn thành trực tiếp (12 phút)',
      status: 'draft',
      createdAt: now
    });

    // 7. HOẠT ĐỘNG 7: GHÉP CÂU VỚI TRANH (nếu cần bổ sung)
    list.push({
      id: `act_ghep_cau_voi_tranh_${now}_7`,
      activityType: 'ghep_cau_voi_tranh',
      title: 'Hoạt động: Ghép câu văn với tranh minh họa tình huống',
      targetAudience: audience,
      targetSkill: 'thong_tin_truc_tiep',
      skillObjective: `Kết nối văn bản đọc hiểu với hình ảnh thị giác, củng cố năng lực đọc câu trọn vẹn và hiểu nghĩa.`,
      sourceLessonId: lessonId,
      sourceLessonTitle: lessonTitle,
      durationMinutes: 10,
      materialsNeeded: ['Thẻ câu văn và tranh minh họa tình huống'],
      teacherSteps: [
        'Bước 1: Quan sát tranh minh họa.',
        'Bước 2: Đọc 3 câu văn trên bảng.',
        'Bước 3: Nối câu văn miêu tả đúng nhất hành động của nhân vật trong tranh.'
      ],
      contentPayload: {
        instructions: 'Đọc kỹ câu văn và nối với bức tranh phù hợp nhất.',
        items: [
          {
            id: 'item_gct_1',
            prompt: 'Câu văn nào miêu tả đúng cảnh bạn nhỏ tưới cây dưới ánh nắng?',
            answer: 'Bạn nhỏ khẽ nghiêng bình tưới, những giọt nước long lanh đọng trên lá non.',
            options: [
              'Bạn nhỏ khẽ nghiêng bình tưới, những giọt nước long lanh đọng trên lá non.',
              'Trời mưa to làm ướt sũng cả khu vườn.',
              'Mọi người đang cùng nhau thu hoạch quả ngọt.'
            ]
          }
        ]
      },
      evaluationCriteria: 'Nối đúng câu văn với tranh tình huống tương ứng.',
      description: 'Rèn luyện khả năng gắn kết ngôn ngữ chữ viết với hình ảnh cụ thể.',
      suggestedFormat: 'Ghép nối trực quan trên bảng hoặc phiếu (10 phút)',
      status: 'draft',
      createdAt: now
    });

    // 8. HOẠT ĐỘNG 8: KỂ TIẾP CÂU CHUYỆN (mở rộng sáng tạo)
    list.push({
      id: `act_ke_tiep_cau_chuyen_${now}_8`,
      activityType: 'ke_tiep_cau_chuyen',
      title: 'Hoạt động: Góc sáng tạo — Kể tiếp câu chuyện',
      targetAudience: audience,
      targetSkill: 'lien_he_van_dung',
      skillObjective: `Phát triển trí tưởng tượng và năng lực tạo lập lời nói/văn bản ngắn từ văn bản đã học.`,
      sourceLessonId: lessonId,
      sourceLessonTitle: lessonTitle,
      durationMinutes: 12,
      materialsNeeded: ['Góc sáng tạo với giấy màu và bút vẽ'],
      teacherSteps: [
        'Bước 1: Đặt câu hỏi kích thích tưởng tượng: "Sau khi cây nở hoa thơm, điều gì sẽ xảy ra tiếp theo?".',
        'Bước 2: Học sinh thảo luận nhóm 4 bạn, nêu ý tưởng.',
        'Bước 3: Mỗi nhóm kể tiếp 2-3 câu ngắn và vẽ hình minh họa cho đoạn kết mới.'
      ],
      contentPayload: {
        instructions: 'Em hãy tưởng tượng và kể tiếp 2–3 câu diễn biến tiếp theo của câu chuyện.',
        items: [
          {
            id: 'item_ktc_1',
            prompt: 'Gợi ý: "Những chú ong bướm bay đến rủ bạn nhỏ điều gì?"',
            answer: 'Học sinh tự do sáng tạo lời thoại và tình huống hợp lý, giàu cảm xúc.'
          }
        ]
      },
      evaluationCriteria: 'Kể tiếp được đoạn kết mạch lạc, thể hiện thái độ nhân ái và yêu thiên nhiên.',
      description: 'Hoạt động mở rộng dành cho nhóm học sinh năng khiếu hoặc phần tổng kết sáng tạo cuối tiết dạy.',
      suggestedFormat: 'Thảo luận nhóm sáng tạo đoạn kết mới (12 phút)',
      status: 'draft',
      createdAt: now
    });

    return list;
  };

  // Construct Pedagogical Analysis Summary
  const defaultAnalysisSummary = (() => {
    if (scope === 'tung_hoc_sinh' && ctx.studentProfile) {
      const p = ctx.studentProfile;
      return `Học sinh ${p.displayAlias} (${p.studentCode}) đã hoàn thành ${p.totalAttempts} lượt làm bài với điểm đúng lần đầu trung bình ${p.firstTryAvg}%. Kỹ năng nổi trội: ${p.strongSkills.join(', ') || 'Đang tiếp tục rèn luyện'}. Kỹ năng cần trợ giúp thêm: ${p.weakSkills.join(', ') || 'Chưa phát hiện điểm yếu rõ rệt'}. Tiến bộ sau gợi ý đạt +${p.progressDelta} điểm phần trăm.`;
    }
    if (scope === 'nhom_hoc_sinh' && ctx.studentGroups) {
      const sCount = ctx.studentGroups.supportGroup.length;
      const gCount = ctx.studentGroups.growthGroup.length;
      return `Phân hóa lớp học: Đã xác định ${sCount} học sinh thuộc nhóm cần hỗ trợ đọc hiểu (< 70% hoặc gặp khó khăn ở kỹ năng trọng tâm) và ${gCount} học sinh thuộc nhóm phát triển (≥ 70%). Khuyến nghị tổ chức hoạt động phân cấp: nhóm hỗ trợ dùng đồ dùng trực quan, nhóm phát triển tham gia đóng vai và sáng tạo lời thoại.`;
    }
    if (scope === 'tung_ky_nang' && ctx.weakSkills.length > 0) {
      const k = ctx.weakSkills[0];
      return `Phân tích chuyên sâu kỹ năng "${k.label}": Tỷ lệ đúng lần đầu đạt ${k.accuracyFirstTry}%, hiện có ${k.studentsNeedingHelp} học sinh cần củng cố thêm. Nguyên nhân chủ yếu do chưa chú ý từ khóa trong ngữ cảnh và khó phân biệt chi tiết gây nhiễu.`;
    }
    if (scope === 'tung_cau_hoi' && highErrorQuestions.length > 0) {
      const topQ = highErrorQuestions[0];
      return `Phân tích câu hỏi sai nhiều nhất: Câu hỏi "${topQ.prompt.slice(0, 60)}..." thuộc kỹ năng ${topQ.skillLabel} có tỷ lệ sai lần đầu lên đến ${topQ.incorrectPercentage}%. Cần dùng phiếu hướng dẫn học sinh đọc kỹ lại câu văn tương ứng trong bài đọc.`;
    }
    if (scope === 'tien_bo') {
      const delta = (ctx.scopeSummary?.progressDelta ?? 0);
      return `Theo dõi tiến bộ đọc hiểu: Tỷ lệ đúng từ lần đầu (${ctx.avgAccuracyFirstTry}%) tăng lên sau gợi ý có sự bứt phá trung bình +${delta} điểm phần trăm. Học sinh tiếp thu gợi ý rất tốt, cho thấy hiệu quả tích cực của phương pháp gợi mở từng bước.`;
    }
    return weakSkills.length > 0
      ? `Dữ liệu đọc hiểu cho thấy lớp ${ctx.className} đạt tỷ lệ phản xạ lần đầu trung bình ${ctx.avgAccuracyFirstTry}%. Trọng tâm cần củng cố là kỹ năng ${weakSkills.map(w => `"${w.label}" (${w.accuracyFirstTry}%)`).join(', ')} với khoảng ${weakSkills.reduce((max, w) => Math.max(max, w.studentsNeedingHelp), 0)} học sinh cần giáo viên hỗ trợ thêm qua đồ dùng trực quan.`
      : `Lớp ${ctx.className} có nền tảng đọc hiểu rất tốt với tỷ lệ đúng lần đầu trung bình ${ctx.avgAccuracyFirstTry}%. Tất cả các kỹ năng khảo sát đều đạt chuẩn (≥ 70%). Nên tổ chức các hoạt động mở rộng, làm giàu ngôn ngữ và đối thoại nhân vật.`;
  })();

  // Fallback if AI not configured
  if (!config.isConfigured || config.status === 'NOT_CONFIGURED') {
    return {
      weakSkills,
      goodSkills,
      highErrorQuestions,
      scope,
      scopeSummary: ctx.scopeSummary,
      studentProfile: ctx.studentProfile,
      studentGroups: ctx.studentGroups,
      analysisSummary: defaultAnalysisSummary,
      suggestedActivities: buildPedagogicalActivities(),
      isAiGenerated: false,
      disclaimer: 'Gợi ý quy tắc sư phạm chuẩn GDPT 2018 (Chưa kích hoạt API AI). Giáo viên cần duyệt trước khi áp dụng vào lớp học.'
    };
  }

  // Live Gemini Call with Structured Output
  try {
    const apiKey = process.env.GEMINI_API_KEY!;
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = getActiveGeminiModel();

    const prompt = `
Bạn là chuyên gia phương pháp dạy học Tiếng Việt tiểu học (Lớp ${ctx.grade}, Chương trình GDPT 2018, định hướng bộ sách Kết nối tri thức).
Dưới đây là BÁO CÁO THỐNG KÊ ẨN DANH THỰC TẾ từ dữ liệu làm bài của lớp ${ctx.className}:
- Phạm vi phân tích: ${scope} (${ctx.scopeSummary?.scopeName || 'Toàn lớp'}).
- Sĩ số lớp: ${ctx.totalStudents} học sinh (Đã tham gia: ${ctx.participatedStudents ?? ctx.totalStudents}).
- Tỷ lệ đúng lần đầu trung bình: ${ctx.avgAccuracyFirstTry}%.
- Kỹ năng đạt tốt: ${goodSkills.length > 0 ? goodSkills.map(g => `${g.label} (${g.accuracyFirstTry}%)`).join(', ') : 'Đang tiếp tục rèn luyện'}
- Kỹ năng cần củng cố: ${weakSkills.length > 0 ? weakSkills.map(w => `${w.label} (${w.accuracyFirstTry}%, ${w.studentsNeedingHelp} HS cần hỗ trợ)`).join(', ') : 'Không có kỹ năng dưới 70%'}
${highErrorQuestions.length > 0 ? `- Câu hỏi học sinh hay nhầm lẫn nhất: ${highErrorQuestions.map(q => `"${q.prompt.slice(0, 80)}..." (Sai ${q.incorrectPercentage}%)`).join('; ')}` : ''}
${ctx.sourceLesson ? `- Bài đọc nguồn: "${ctx.sourceLesson.title}" (Chủ đề: ${ctx.sourceLesson.topic || 'Mở rộng'})` : ''}

YÊU CẦU:
1. Viết 1 đoạn "analysisSummary" (khoảng 2-3 câu) nhận xét sư phạm khách quan, TUYỆT ĐỐI KHÔNG tự bịa số liệu khác với thống kê đã cho.
2. Đề xuất từ 4 đến 6 hoạt động dạy học đa dạng ("suggestedActivities"), lựa chọn từ ngân hàng 8 hoạt động:
   - 'truy_tim_nghia_tu' (Thám tử từ ngữ / ghép từ với nghĩa)
   - 'xep_tranh_trinh_tu' (Xếp tranh / sự việc theo trình tự)
   - 'san_kho_bau_doc_hieu' (Tìm chi tiết trực tiếp)
   - 'ghep_cau_voi_tranh' (Ghép câu với tình huống)
   - 'dung_hay_sai' (Trọng tài nhí Đúng/Sai)
   - 'phong_vien_nhi' (Phóng viên nhí đóng vai và phỏng vấn)
   - 'ke_tiep_cau_chuyen' (Kể tiếp câu chuyện)
   - 'phieu_hoc_tap_so_do' (Phiếu học tập & sơ đồ tư duy)
Mỗi hoạt động phải có thời lượng 5–15 phút, các bước giáo viên tổ chức cụ thể, chuẩn bị học liệu, và tiêu chí đánh giá rõ ràng.

BẮT BUỘC chỉ trả về định dạng JSON thuần túy theo cấu trúc:
{
  "analysisSummary": "Nhận xét sư phạm...",
  "suggestedActivities": [
    {
      "id": "act_1",
      "activityType": "truy_tim_nghia_tu",
      "title": "Tên hoạt động",
      "targetAudience": "Đối tượng học sinh",
      "targetSkill": "tu_trong_ngu_canh",
      "skillObjective": "Mục tiêu cần đạt GDPT 2018...",
      "durationMinutes": 10,
      "materialsNeeded": ["Thẻ từ ngữ", "Bảng tương tác"],
      "teacherSteps": ["Bước 1...", "Bước 2...", "Bước 3..."],
      "contentPayload": {
        "instructions": "Hướng dẫn thực hiện...",
        "gameTemplate": "word_meaning_match",
        "gameData": {
          "pairs": [
            { "word": "từ mới", "meaning": "nghĩa của từ", "example": "ví dụ trong câu" }
          ]
        }
      },
      "evaluationCriteria": "Tiêu chí hoàn thành...",
      "description": "Mô tả ngắn gọn hoạt động...",
      "suggestedFormat": "Hình thức tổ chức (10 phút)",
      "status": "draft",
      "createdAt": ${Date.now()}
    }
  ]
}
`;

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: 'application/json' }
    });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = JSON.parse(cleanJsonString(responseText));

    const finalActivities: RemediationActivity[] = (parsed.suggestedActivities && Array.isArray(parsed.suggestedActivities) && parsed.suggestedActivities.length > 0)
      ? parsed.suggestedActivities.map((a: any, idx: number) => ({
          ...a,
          id: a.id || `act_ai_${Date.now()}_${idx}`,
          teacherSteps: normalizeTeacherSteps(a.teacherSteps),
          status: 'draft',
          createdAt: Date.now()
        }))
      : buildPedagogicalActivities();

    return {
      weakSkills,
      goodSkills,
      highErrorQuestions,
      scope,
      scopeSummary: ctx.scopeSummary,
      studentProfile: ctx.studentProfile,
      studentGroups: ctx.studentGroups,
      analysisSummary: parsed.analysisSummary || defaultAnalysisSummary,
      suggestedActivities: finalActivities,
      isAiGenerated: true,
      disclaimer: 'Gợi ý từ mô hình AI dựa trên số liệu thống kê thực tế từ Firestore. Giáo viên cần duyệt trước khi triển khai.'
    };
  } catch (err: any) {
    console.warn('Gemini remediation call failed, using rule fallback:', err?.message);
    return {
      weakSkills,
      goodSkills,
      highErrorQuestions,
      scope,
      scopeSummary: ctx.scopeSummary,
      studentProfile: ctx.studentProfile,
      studentGroups: ctx.studentGroups,
      analysisSummary: defaultAnalysisSummary,
      suggestedActivities: buildPedagogicalActivities(),
      isAiGenerated: false,
      disclaimer: 'Gợi ý tự động theo quy tắc sư phạm chuẩn GDPT 2018 (Chưa thể kết nối AI). Giáo viên cần duyệt trước khi áp dụng.'
    };
  }
}

// ==========================================
// 7. GENERATE ADDITIONAL QUESTIONS WITH AI (V5.2)
// ==========================================
export async function generateAdditionalQuestionsWithAI(params: {
  passage: string;
  grade: Grade;
  currentQuestions: { prompt: string }[];
  count: number;
  questionType?: QuestionType;
  skillTag?: SkillTag;
}): Promise<{ questions: any[]; isAiGenerated: boolean; message?: string }> {
  const { passage, grade, currentQuestions, count, questionType, skillTag } = params;
  const config = checkAIConfig();

  const neededCount = Math.min(Math.max(Number(count) || 2, 1), 5);
  const existingPrompts = (currentQuestions || []).map((q) => q.prompt);

  if (!config.isConfigured) {
    // Pedagogical rule-based fallback when AI key is unconfigured
    const fallbackId = `q_add_${Date.now()}`;
    const fallbackQ = {
      id: fallbackId,
      type: questionType || 'multiple_choice',
      prompt: 'Theo bài đọc trên, chi tiết nào dưới đây được nhắc đến?',
      options: ['Chi tiết chính xác trong bài', 'Chi tiết không có trong bài', 'Chi tiết sai lệch'],
      answer: 'A',
      hint: 'Em hãy đọc thầm lại văn bản bài đọc để tìm chi tiết này.',
      explanation: 'Chi tiết đúng được nêu rõ trong bài đọc.',
      skillTag: skillTag || 'thong_tin_truc_tiep',
      difficulty: 'nhan_biet'
    };
    return {
      questions: [fallbackQ],
      isAiGenerated: false,
      message: 'Chưa kết nối AI, đã tạo câu hỏi khung mẫu sư phạm để giáo viên chỉnh sửa thủ công.'
    };
  }

  const apiKey = process.env.GEMINI_API_KEY!;
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = getActiveGeminiModel();

  const prompt = `Bạn là chuyên gia sư phạm tiểu học môn Tiếng Việt cho học sinh lớp ${grade}.
Dựa vào bài đọc dưới đây, hãy tạo ĐÚNG ${neededCount} câu hỏi đọc hiểu MỚI để bổ sung cho bài đọc.
TUYỆT ĐỐI KHÔNG trùng lặp với các câu hỏi đã có.

BÀI ĐỌC:
"""
${passage}
"""

CÁC CÂU HỎI ĐÃ CÓ (KHÔNG ĐƯỢC TRÙNG):
${existingPrompts.map((p, i) => `${i + 1}. ${p}`).join('\n')}

YÊU CẦU:
1. ${questionType ? `Dạng câu hỏi: bắt buộc dạng '${questionType}'` : 'Phối hợp các dạng multiple_choice (3 lựa chọn A, B, C), true_false, sequence (3 sự việc)'}.
2. ${skillTag ? `Kỹ năng: '${skillTag}'` : 'Tập trung rèn năng lực đọc hiểu tiểu học'}.
3. Định dạng đầu ra: CHỈ TRẢ VỀ DUY NHẤT một chuỗi JSON hợp lệ theo cấu trúc:
{
  "questions": [
    {
      "id": "q_new_1",
      "type": "multiple_choice",
      "prompt": "Lời dẫn câu hỏi...",
      "options": ["Lựa chọn A", "Lựa chọn B", "Lựa chọn C"],
      "answer": "A",
      "hint": "Gợi ý sư phạm...",
      "explanation": "Giải thích chi tiết...",
      "skillTag": "thong_tin_truc_tiep",
      "difficulty": "nhan_biet"
    }
  ]
}`;

  try {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.3,
        topP: 0.85,
        responseMimeType: 'application/json'
      }
    });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = robustParseJSON(responseText);
    const rawList = parsed.questions || (Array.isArray(parsed) ? parsed : []);

    const validated: any[] = [];
    for (let i = 0; i < rawList.length && validated.length < neededCount; i++) {
      const item = rawList[i];
      if (!item.id) item.id = `q_ai_${Date.now()}_${i + 1}`;
      validated.push(item);
    }

    return {
      questions: validated,
      isAiGenerated: true
    };
  } catch (err: any) {
    const classified = classifyAIError(err);
    // Graceful fallback
    const fallbackId = `q_fallback_${Date.now()}`;
    return {
      questions: [
        {
          id: fallbackId,
          type: questionType || 'multiple_choice',
          prompt: 'Ý nào dưới đây thể hiện đúng nội dung của bài đọc?',
          options: ['Ý chính xác theo bài đọc', 'Ý chưa đúng', 'Ý không được nhắc đến'],
          answer: 'A',
          hint: 'Em hãy đọc lại đoạn văn để tìm câu trả lời.',
          explanation: 'Ý chính xác phản ánh đúng nội dung bài.',
          skillTag: skillTag || 'noi_dung_chinh',
          difficulty: 'thong_hieu'
        }
      ],
      isAiGenerated: false,
      message: `Chuyển sang khung câu hỏi mẫu (${classified.cleanMessage}).`
    };
  }
}

// ==========================================
// 6. REAL AI SPEECH GENERATION (GEMINI TTS)
// ==========================================

export interface GenerateSpeechOptions {
  text: string;
  title?: string;
  grade?: number;
  voiceGender?: 'female' | 'male';
  readingStyle?: 'standard' | 'expressive_slow' | 'storytelling';
  model?: string;
}

export interface GeneratedSpeechResult {
  audioBuffer: Buffer;
  mimeType: string;
  durationSeconds: number;
  model: string;
  voiceId: string;
}

export async function generateSpeechWithGeminiTTS(
  options: GenerateSpeechOptions
): Promise<GeneratedSpeechResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length <= 5) {
    throw new Error('Chưa cấu hình GEMINI_API_KEY. Vui lòng kiểm tra khóa API trong hệ thống.');
  }

  const model = options.model || 'gemini-3.8-flash-lite-tts';
  const voiceId = options.voiceGender === 'male' ? 'Puck' : 'Aoede';
  const grade = options.grade || 2;

  // Text to synthesize: STRICTLY ONLY the clean passage text.
  // Never add greetings, instructions, style prompts, or titles to avoid the AI speaking them.
  const cleanPassage = (options.text || '').trim();
  if (cleanPassage.length < 20) {
    throw new Error('Văn bản bài đọc quá ngắn để tạo giọng đọc AI (tối thiểu 20 ký tự).');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;

  const payload = {
    contents: [
      {
        parts: [{ text: cleanPassage }]
      }
    ],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voiceId
          }
        }
      }
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let errorJson: any = null;
    try {
      errorJson = JSON.parse(errorBody);
    } catch {
      // ignore
    }

    if (response.status === 429) {
      throw new Error(
        'Hạn mức dịch vụ Gemini TTS tạm thời bị giới hạn (Quota/Rate Limit 429). Vui lòng đợi 1–2 phút trước khi tạo lại.'
      );
    }

    const message = errorJson?.error?.message || `Lỗi máy chủ TTS HTTP ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }

  const data: any = await response.json();
  const candidate = data.candidates?.[0];
  if (!candidate) {
    throw new Error('Dịch vụ Gemini TTS không trả về phản hồi hợp lệ.');
  }

  const audioPart = candidate.content?.parts?.find((p: any) => p.inlineData && p.inlineData.data);
  if (!audioPart) {
    throw new Error('Mô hình không trả về dữ liệu âm thanh hợp lệ (thiếu inlineData).');
  }

  const base64Data = audioPart.inlineData.data;
  const audioBuffer = Buffer.from(base64Data, 'base64');
  const mimeType = audioPart.inlineData.mimeType || 'audio/wav';

  // Calculate duration from WAV byte rate (default 24000 Hz * 1 channel * 2 bytes = 48000 B/s)
  let byteRate = 48000;
  if (audioBuffer.length >= 32) {
    const headerByteRate = audioBuffer.readUInt32LE(28);
    if (headerByteRate > 8000 && headerByteRate < 192000) {
      byteRate = headerByteRate;
    }
  }
  const dataSize = Math.max(0, audioBuffer.length - 44);
  const durationSeconds = Math.round((dataSize / byteRate) * 10) / 10;

  return {
    audioBuffer,
    mimeType,
    durationSeconds,
    model,
    voiceId
  };
}



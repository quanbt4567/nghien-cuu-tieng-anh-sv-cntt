import { ScoreResponse, GrammarCorrection } from "./types";

interface LocalScorerOptions {
  transcript: string;
  expectedKeywords: string[];
  sampleAnswerEN?: string;
  hintVI?: string;
}

export type InvalidEnglishReason =
  | "empty_or_too_short"
  | "vietnamese_diacritics"
  | "vietnamese_teencode"
  | "gibberish";

export interface InvalidEnglishInputResult {
  invalid: boolean;
  reason: InvalidEnglishReason | null;
  reasonVI: string | null;
  matchedTokens: string[];
}

const VIETNAMESE_DIACRITIC_REGEX =
  /[àáạảãâấầậẩẫăắằặẳẵèéẹẻẽêếềệểễìíịỉĩòóọỏõôốồộổỗơớờợởỡùúụủũưứừựửữỳýỵỷỹđ]/i;

const VIETNAMESE_CHAT_TOKENS = new Set([
  "cx", "dc", "ko", "k0", "khong", "kh", "hok",
  "vay", "zay", "dzay", "sao", "ghi", "duoc",
  "nhung", "nhieu", "nhiu", "chua", "chx", "roi",
  "nhe", "nha", "nhen", "vl", "vcl", "vkl", "vler", "clgt", "dmm", "troll",
  "tui", "mik", "mk", "mng", "hqua", "hnay", "ngta",
  "nguoi", "tieng", "chao", "giup", "cua", "voi", "neu",
  "phai", "muon", "thay", "nua", "luon", "lun", "xin",
  "xong", "chac", "kiem", "sua", "troi", "biet", "hieu",
  "thoi", "thui", "truoc", "xuong", "lenh", "khac",
  "cho", "het", "dau", "nghe", "cai", "toi", "vui", "zui",
  "buon", "xai", "chuc", "cung", "chung", "hom", "bik", "bthg", "trl",
]);

const IT_NO_VOWEL_ACRONYMS = new Set([
  "html", "http", "https", "css", "scss", "sql", "jwt", "csrf", "xsrf",
  "xss", "grpc", "sdk", "cli", "ssh", "ssl", "tls", "dns", "cdn", "vpn",
  "tcp", "udp", "rpc", "orm", "mvc", "mvvm", "ssr", "csr", "csv", "npm",
  "pnpm", "xml", "php", "tdd", "bdd", "mvp", "sla", "ttl", "cpu", "gpu",
  "ram", "ssd", "hdd", "usb", "aws", "gcp", "dbms", "rdbms", "smtp",
  "wsdl", "xhtml", "ctrl", "json", "sync", "async", "k8s", "ts", "js",
  "jsx", "tsx", "mjs", "cjs", "src", "btn", "cfg", "pkg", "msg", "err",
  "req", "res", "env", "dev", "prod", "stg", "cmd", "pwd", "tmp", "usr",
  "var", "bin", "lib", "nth", "rhythms", "rhythm",
]);

const VALID_2_LETTER_ENGLISH_OR_IT = new Set([
  "am", "an", "as", "at", "be", "by", "do", "go", "he", "hi", "if", "in",
  "is", "it", "me", "my", "no", "of", "ok", "on", "or", "so", "to", "up",
  "us", "we", "ai", "ci", "cd", "db", "di", "id", "io", "ip", "js", "ml",
  "os", "pr", "qa", "ts", "ui", "ux", "vm", "vr", "ar", "hr",
]);

const KEYBOARD_MASH_PATTERN =
  /(asdf|sdfg|dfgh|fghj|ghjk|hjkl|qwer|zxcv|xcvb|cvbn|vbnm|fdsa|gfds|hgfd|jhgf|lkjh|rewq|trew|ytre|vcxz|bvcx|nbvc|mnbv|uiop|poiu)/i;
const REPEATED_CHAR_PATTERN = /(.)\1{3,}/i;
const REPEATED_SYLLABLE_PATTERN = /^([a-z]{2,3})\1+$/i;
const SIX_CONSONANTS_PATTERN = /[bcdfghjklmnpqrstvwxz]{6,}/i;
const FOUR_LEADING_CONSONANTS_PATTERN = /^[bcdfghjklmnpqrstvwxz]{4,}/i;
const Q_WITHOUT_U_ALLOWED = /(sql|graphql|mysql|postgres|nosql|sqlite|jquery|qemu|mqtt|qps|qwen)/i;

function isGibberishToken(rawToken: string): boolean {
  const letters = rawToken.replace(/[^a-zA-Z]/g, "").toLowerCase();
  if (letters.length < 2 || IT_NO_VOWEL_ACRONYMS.has(letters)) return false;
  if (REPEATED_CHAR_PATTERN.test(letters)) return true;
  if (REPEATED_SYLLABLE_PATTERN.test(letters)) return true;
  if (KEYBOARD_MASH_PATTERN.test(letters)) return true;
  if (letters.length >= 4 && !/[aeiouy]/.test(letters)) return true;
  if (SIX_CONSONANTS_PATTERN.test(letters)) return true;
  if (letters.length >= 5 && FOUR_LEADING_CONSONANTS_PATTERN.test(letters)) return true;
  if (letters.length >= 4 && /q(?!u)/.test(letters) && !Q_WITHOUT_U_ALLOWED.test(letters)) {
    return true;
  }
  return false;
}

const LETTER_CHAR_REGEX = /[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]/;
const LETTER_CHAR_GLOBAL_REGEX = /[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]/g;

/**
 * Guards practice scoring against empty/too-short inputs, Vietnamese (with or without diacritics),
 * Vietnamese chat teencode/trolling, and keyboard-mash gibberish.
 */
export function detectInvalidEnglishInput(transcript: string): InvalidEnglishInputResult {
  const raw = typeof transcript === "string" ? transcript.trim().normalize("NFC") : "";
  if (!raw) {
    return {
      invalid: true,
      reason: "empty_or_too_short",
      reasonVI: "Vui lòng nói hoặc nhập câu trả lời bằng tiếng Anh (tối thiểu 2 từ).",
      matchedTokens: [],
    };
  }

  const wordTokens = raw
    .split(/[\s,.;:!?()[\]{}"`~@#$%^&*+=|\\/<>_-]+/)
    .map((t) => t.replace(/^'+|'+$/g, ""))
    .filter((t) => LETTER_CHAR_REGEX.test(t));
  const letterCount = (raw.match(LETTER_CHAR_GLOBAL_REGEX) ?? []).length;

  if (wordTokens.length < 2 || letterCount < 5) {
    return {
      invalid: true,
      reason: "empty_or_too_short",
      reasonVI:
        "Câu trả lời quá ngắn (cần tối thiểu 2 từ và 5 chữ cái tiếng Anh). Vui lòng diễn đạt đầy đủ hơn.",
      matchedTokens: wordTokens,
    };
  }

  if (VIETNAMESE_DIACRITIC_REGEX.test(raw)) {
    const diacriticTokens = wordTokens.filter((t) => VIETNAMESE_DIACRITIC_REGEX.test(t));
    return {
      invalid: true,
      reason: "vietnamese_diacritics",
      reasonVI:
        "Phát hiện tiếng Việt trong câu trả lời. Vui lòng trả lời hoàn toàn bằng tiếng Anh để được chấm điểm.",
      matchedTokens: diacriticTokens,
    };
  }

  const teencodeMatches = wordTokens.filter((t) =>
    VIETNAMESE_CHAT_TOKENS.has(t.toLowerCase())
  );
  if (teencodeMatches.length > 0) {
    return {
      invalid: true,
      reason: "vietnamese_teencode",
      reasonVI:
        "Phát hiện từ tiếng Việt không dấu / teencode. Vui lòng trả lời nghiêm túc bằng tiếng Anh chuyên ngành.",
      matchedTokens: teencodeMatches,
    };
  }

  const alphaTokens = wordTokens.filter((t) => /[a-zA-Z]/.test(t));
  const singleLetterTokens = alphaTokens.filter(
    (t) => t.replace(/[^a-zA-Z]/g, "").length === 1
  );
  const multiLetterTokens = alphaTokens.filter(
    (t) => t.replace(/[^a-zA-Z]/g, "").length >= 2
  );

  if (
    multiLetterTokens.length === 0 ||
    (alphaTokens.length >= 3 && singleLetterTokens.length / alphaTokens.length > 0.6)
  ) {
    return {
      invalid: true,
      reason: "gibberish",
      reasonVI:
        "Câu trả lời chỉ gồm ký tự đơn lẻ hoặc không có cấu trúc tiếng Anh hợp lệ. Vui lòng nhập câu tiếng Anh hoàn chỉnh.",
      matchedTokens: singleLetterTokens,
    };
  }

  if (alphaTokens.every((t) => t.replace(/[^a-zA-Z]/g, "").length <= 2)) {
    const valid2LetterCount = multiLetterTokens.filter((t) =>
      VALID_2_LETTER_ENGLISH_OR_IT.has(t.replace(/[^a-zA-Z]/g, "").toLowerCase())
    ).length;
    if (valid2LetterCount < 2) {
      return {
        invalid: true,
        reason: "gibberish",
        reasonVI:
          "Không nhận diện được câu tiếng Anh hợp lệ. Vui lòng trả lời bằng câu tiếng Anh hoàn chỉnh.",
        matchedTokens: alphaTokens,
      };
    }
  }

  const gibberishTokens = multiLetterTokens.filter(isGibberishToken);
  if (
    gibberishTokens.length > 0 &&
    (gibberishTokens.some(
      (t) => KEYBOARD_MASH_PATTERN.test(t) || REPEATED_CHAR_PATTERN.test(t)
    ) ||
      gibberishTokens.length === multiLetterTokens.length ||
      gibberishTokens.length / alphaTokens.length >= 0.5)
  ) {
    return {
      invalid: true,
      reason: "gibberish",
      reasonVI:
        "Phát hiện chuỗi ký tự vô nghĩa hoặc gõ phím ngẫu nhiên. Vui lòng trả lời bằng tiếng Anh hợp lệ.",
      matchedTokens: gibberishTokens,
    };
  }

  return {
    invalid: false,
    reason: null,
    reasonVI: null,
    matchedTokens: [],
  };
}

/**
 * Phonetic pitfall patterns common to Vietnamese learners:
 * - Missing ending consonants: /t/, /s/, /d/, /k/, /z/
 * - Consonant clusters: /pr/, /st/, /bl/, /pl/, /kr/, /tr/
 */
const VIETNAMESE_PHONETIC_PITFALLS: Array<{
  pattern: RegExp;
  phoneme: string;
  adviceVI: string;
}> = [
  {
    pattern: /(ed|t|te)$/i,
    phoneme: "/t/ hoặc /d/",
    adviceVI: "chú ý bật rõ âm đuôi /t/ hoặc /d/ (đặc biệt ở các động từ quá khứ)",
  },
  {
    pattern: /(s|ce|se|ts)$/i,
    phoneme: "/s/ hoặc /z/",
    adviceVI: "nhớ phát âm rõ âm gió xì /s/ ở đuôi từ",
  },
  {
    pattern: /^pr/i,
    phoneme: "cụm /pr/",
    adviceVI: "phát âm liền mạch cụm phụ âm đôi /pr/ không chèn nguyên âm ở giữa",
  },
  {
    pattern: /^st/i,
    phoneme: "cụm /st/",
    adviceVI: "bật nhẹ âm /s/ trước khi sang /t/ trong cụm /st/",
  },
  {
    pattern: /^bl/i,
    phoneme: "cụm /bl/",
    adviceVI: "phát âm dứt khoát cụm phụ âm /bl/",
  },
  {
    pattern: /(ck|k|ke)$/i,
    phoneme: "/k/",
    adviceVI: "bật âm chặn họng /k/ dứt khoát ở cuối từ",
  },
];

/**
 * Normalizes text for keyword matching: lowercase, removes punctuation.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Checks if a keyword matches a target word or its common inflections.
 */
export function stemWord(raw: string): string {
  const word = raw.toLowerCase().trim();
  if (word.length <= 3) return word;
  const suffixes: Array<[string, number]> = [
    ["ments", 4],
    ["ment", 4],
    ["ations", 4],
    ["ation", 4],
    ["ities", 4],
    ["ity", 4],
    ["encies", 4],
    ["ency", 4],
    ["ences", 4],
    ["ence", 4],
    ["ents", 4],
    ["ent", 4],
    ["ings", 3],
    ["ing", 3],
    ["ied", 3],
    ["ies", 3],
    ["ers", 4],
    ["er", 4],
    ["ors", 4],
    ["or", 4],
    ["es", 3],
    ["ed", 3],
    ["ly", 3],
    ["s", 3],
  ];
  for (const [suffix, minStem] of suffixes) {
    if (word.endsWith(suffix) && word.length - suffix.length >= minStem) {
      let stem = word.slice(0, word.length - suffix.length);
      if (suffix === "ied" || suffix === "ies") {
        stem += "y";
      } else if (stem.length >= 4 && stem[stem.length - 1] === stem[stem.length - 2]) {
        stem = stem.slice(0, -1);
      }
      return stem;
    }
  }
  return word.endsWith("e") && word.length > 4 ? word.slice(0, -1) : word;
}

export function normalizeTextForMatching(text: string): string {
  return normalizeText(text);
}

function wordsMatchStem(transcriptWord: string, keywordWord: string): boolean {
  const w = transcriptWord.toLowerCase().trim();
  const k = keywordWord.toLowerCase().trim();
  if (!w || !k) return false;
  if (w === k) return true;
  if (w.length < 3 || k.length < 3) return false;
  return stemWord(w) === stemWord(k);
}

export function matchesKeyword(transcriptWords: string[], keyword: string): boolean {
  const normKey = normalizeText(keyword);
  if (!normKey) return false;

  const keyTokens = normKey.split(" ").filter(Boolean);
  if (keyTokens.length > 1) {
    const normTranscript = transcriptWords.join(" ");
    if (` ${normTranscript} `.includes(` ${normKey} `)) return true;
    return keyTokens.every((kt) =>
      transcriptWords.some((tw) => wordsMatchStem(tw, kt))
    );
  }

  return transcriptWords.some((word) => wordsMatchStem(word, normKey));
}

export function computeSampleCopySimilarity(
  transcript: string,
  sampleAnswerEN?: string
): number {
  if (!sampleAnswerEN) return 0;
  const tWords = normalizeText(transcript).split(" ").filter(Boolean);
  const sWords = normalizeText(sampleAnswerEN).split(" ").filter(Boolean);
  if (tWords.length < 5 || sWords.length < 5) return 0;
  if (tWords.join(" ") === sWords.join(" ")) return 1;

  const sBigrams = new Set<string>();
  for (let i = 0; i < sWords.length - 1; i += 1) {
    sBigrams.add(`${sWords[i]} ${sWords[i + 1]}`);
  }
  let bigramHits = 0;
  for (let i = 0; i < tWords.length - 1; i += 1) {
    if (sBigrams.has(`${tWords[i]} ${tWords[i + 1]}`)) {
      bigramHits += 1;
    }
  }
  const denom = Math.max(tWords.length - 1, sWords.length - 1);
  return denom > 0 ? bigramHits / denom : 0;
}

/**
 * Evaluates speech or typed response using deterministic local rules.
 * STRICT CONSTITUTION REQUIREMENT (Principles III, V, VIII):
 * 1. Works 100% offline with zero external network dependencies.
 * 2. Formula: 40% keywords + 30% completeness + 30% grammar heuristics.
 * 3. Honest pronunciation disclaimer: 'ước lượng từ văn bản'.
 */
export function scoreLocally({
  transcript,
  expectedKeywords,
  sampleAnswerEN,
}: LocalScorerOptions): ScoreResponse {
  const safeExpectedKeywords = Array.isArray(expectedKeywords) ? expectedKeywords : [];
  const cleanText = typeof transcript === "string" ? transcript.trim() : "";

  const guard = detectInvalidEnglishInput(cleanText);
  if (guard.invalid) {
    const promptVI =
      guard.reasonVI ||
      "Vui lòng trả lời bằng câu tiếng Anh hoàn chỉnh (tối thiểu 2 từ, không dùng tiếng Việt, teencode hoặc ký tự vô nghĩa).";
    const fallbackSample =
      sampleAnswerEN ||
      "Yesterday I fixed the authentication bug and opened a pull request.";

    return {
      score: 0,
      keywordsUsed: [],
      keywordsMissed: [...safeExpectedKeywords],
      grammarCorrections: [
        {
          original: cleanText.slice(0, 80) || "(trống)",
          corrected: fallbackSample,
          explanationVI: promptVI,
        },
      ],
      betterSentence: fallbackSample,
      pronunciationNote: `Đánh giá phát âm ước lượng từ văn bản: ${promptVI}`,
      evaluationMode: "local_rules",
      provider: "local",
    };
  }

  const words = normalizeText(cleanText).split(" ").filter(Boolean);

  // 1. Keyword Scoring (40%)
  const keywordsUsed: string[] = [];
  const keywordsMissed: string[] = [];

  for (const kw of safeExpectedKeywords) {
    if (matchesKeyword(words, kw)) {
      keywordsUsed.push(kw);
    } else {
      keywordsMissed.push(kw);
    }
  }

  const keywordRatio =
    safeExpectedKeywords.length > 0 ? keywordsUsed.length / safeExpectedKeywords.length : 1;
  const keywordScore = Math.min(100, Math.round(keywordRatio * 100));

  // 2. Completeness Scoring (30%)
  // Workplace speaking standard: answers under 4 words are too terse; 8-25 words are optimal for a turn
  let completenessScore = 100;
  if (words.length === 0) {
    completenessScore = 0;
  } else if (words.length < 3) {
    completenessScore = 25;
  } else if (words.length < 6) {
    completenessScore = 55;
  } else if (words.length < 9) {
    completenessScore = 80;
  } else {
    completenessScore = 100;
  }

  // 3. Grammar Rules Heuristics (30%)
  const grammarCorrections: GrammarCorrection[] = [];
  let grammarScore = 100;

  if (words.length > 0) {
    // Check first person lowercase "i"
    if (/\bi\b/.test(cleanText)) {
      grammarCorrections.push({
        original: "i",
        corrected: "I",
        explanationVI: "Đại từ nhân xưng 'I' luôn phải viết hoa trong văn viết tiếng Anh.",
      });
      grammarScore -= 10;
    }

    // Check sentence capitalization
    if (cleanText.length > 0 && cleanText[0] !== cleanText[0].toUpperCase()) {
      grammarCorrections.push({
        original: cleanText.slice(0, 10),
        corrected: cleanText[0].toUpperCase() + cleanText.slice(1, 10),
        explanationVI: "Đầu câu nên viết hoa để định dạng câu chuẩn chỉnh chuyên nghiệp.",
      });
      grammarScore -= 10;
    }

    // Check for common IT Vietnamese-English errors
    if (/very\s+(good|nice)/i.test(cleanText)) {
      grammarCorrections.push({
        original: "very good",
        corrected: "effective / optimal / robust",
        explanationVI: "Trong bối cảnh kỹ thuật, dùng các tính từ chuyên môn như 'effective' hoặc 'optimal' sẽ chuyên nghiệp hơn.",
      });
      grammarScore -= 10;
    }
  } else {
    grammarScore = 0;
  }
  grammarScore =
    keywordsUsed.length > 0 && words.length >= 4
      ? Math.max(20, grammarScore)
      : Math.max(0, grammarScore);

  // Calculate Weighted Final Score (40% Keywords, 30% Completeness, 30% Grammar)
  const finalScore = Math.min(
    100,
    Math.max(
      0,
      Math.round(0.4 * keywordScore + 0.3 * completenessScore + 0.3 * grammarScore)
    )
  );

  // 4. Pronunciation Note via Phonetic Heuristics (Strictly labeled)
  const phoneticTips: string[] = [];
  const candidateKeywords = keywordsMissed.length > 0 ? keywordsMissed : keywordsUsed;

  for (const kw of candidateKeywords) {
    for (const pitfall of VIETNAMESE_PHONETIC_PITFALLS) {
      if (pitfall.pattern.test(kw)) {
        phoneticTips.push(`từ "${kw}" (${pitfall.adviceVI})`);
        break;
      }
    }
    if (phoneticTips.length >= 2) break;
  }

  const pronunciationNote =
    phoneticTips.length > 0
      ? `Đánh giá phát âm ước lượng từ văn bản: Để nói tự nhiên hơn, bạn ${phoneticTips.join(", ")}.`
      : "Đánh giá phát âm ước lượng từ văn bản: Phát âm rõ ràng, ngữ điệu dứt khoát giúp tăng độ mạch lạc trong giao tiếp kỹ thuật.";

  // 5. Better sentence recommendation
  const betterSentence =
    sampleAnswerEN ||
    (words.length > 0
      ? `In professional discussions, you can expand: "${cleanText}, which helps optimize our team workflow."`
      : "In daily standups, state clearly what was done and what blockers remain.");

  return {
    score: finalScore,
    keywordsUsed,
    keywordsMissed,
    grammarCorrections,
    betterSentence,
    pronunciationNote,
    evaluationMode: "local_rules",
    provider: "local",
  };
}

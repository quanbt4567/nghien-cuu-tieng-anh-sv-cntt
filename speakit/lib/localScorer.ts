import { ScoreResponse, GrammarCorrection } from "./types";

interface LocalScorerOptions {
  transcript: string;
  expectedKeywords: string[];
  sampleAnswerEN?: string;
  hintVI?: string;
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
function matchesKeyword(transcriptWords: string[], keyword: string): boolean {
  const normKey = keyword.toLowerCase().trim();

  // Multi-word keyword (e.g. "pull request", "under the hood")
  if (normKey.includes(" ")) {
    const normTranscript = transcriptWords.join(" ");
    return normTranscript.includes(normKey);
  }

  // Single word keyword: test exact or stem inflection
  return transcriptWords.some((word) => {
    if (word === normKey) return true;
    // Simple inflection check (e.g., fix -> fixed, fixes, fixing; deploy -> deployed, deploys)
    if (word.startsWith(normKey) && word.length - normKey.length <= 4) return true;
    if (normKey.startsWith(word) && normKey.length - word.length <= 3) return true;
    return false;
  });
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
  const cleanText = transcript.trim();
  const words = normalizeText(cleanText).split(" ").filter(Boolean);

  // 1. Keyword Scoring (40%)
  const keywordsUsed: string[] = [];
  const keywordsMissed: string[] = [];

  for (const kw of expectedKeywords) {
    if (matchesKeyword(words, kw)) {
      keywordsUsed.push(kw);
    } else {
      keywordsMissed.push(kw);
    }
  }

  const keywordRatio = expectedKeywords.length > 0 ? keywordsUsed.length / expectedKeywords.length : 1;
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
  grammarScore = Math.max(20, grammarScore);

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

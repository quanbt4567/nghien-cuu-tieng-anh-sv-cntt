const EMPTY_KEYWORDS: string[] = [];

function normalizeKeywordText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stemKeywordToken(word: string): string {
  return word
    .replace(/ies$/, "y")
    .replace(/ied$/, "y")
    .replace(/(ing|ed|es|s)$/, "");
}

function wordsMatchInflection(a: string, b: string): boolean {
  if (a === b) return true;
  const sa = stemKeywordToken(a);
  const sb = stemKeywordToken(b);
  if (sa.length >= 3 && sb.length >= 3 && (sa === sb || sa.startsWith(sb) || sb.startsWith(sa))) {
    return true;
  }
  return false;
}

function isKeywordUsed(
  keyword: string,
  usedKeywords: string[],
  transcripts: string[]
): boolean {
  const normKey = normalizeKeywordText(keyword);
  if (!normKey) return false;
  const keyTokens = normKey.split(" ").filter(Boolean);

  for (const used of usedKeywords) {
    const normUsed = normalizeKeywordText(used);
    if (!normUsed) continue;
    if (normUsed === normKey || normUsed.includes(normKey) || normKey.includes(normUsed)) {
      return true;
    }
    const usedTokens = normUsed.split(" ").filter(Boolean);
    if (
      usedTokens.length === keyTokens.length &&
      keyTokens.every((kt, idx) => wordsMatchInflection(usedTokens[idx], kt))
    ) {
      return true;
    }
  }

  for (const transcript of transcripts) {
    const normTranscript = normalizeKeywordText(transcript);
    if (!normTranscript) continue;
    if (normTranscript.includes(normKey)) {
      return true;
    }
    const transcriptWords = normTranscript.split(" ").filter(Boolean);
    if (
      keyTokens.every((kt) =>
        transcriptWords.some((tw) => wordsMatchInflection(tw, kt))
      )
    ) {
      return true;
    }
  }

  return false;
}

export function filterUnusedKeywords(
  missedKeywords: string[],
  usedKeywords: string[] = EMPTY_KEYWORDS,
  transcripts: string[] = EMPTY_KEYWORDS
): string[] {
  const seen = new Set<string>();
  const unused: string[] = [];

  for (const raw of missedKeywords) {
    const trimmed = raw.trim();
    const norm = normalizeKeywordText(trimmed);
    if (!trimmed || !norm || seen.has(norm)) continue;
    seen.add(norm);
    if (!isKeywordUsed(trimmed, usedKeywords, transcripts)) {
      unused.push(trimmed);
    }
  }

  return unused;
}

import { VocabularyItem } from "./types";

export interface VocabQuizQuestion {
  id: string;
  item: VocabularyItem;
  prompt: string;
  meaningHint: string;
  targetTerm: string;
  choices: string[];
}

function shuffleArray<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function maskTermInSentence(sentence: string, term: string): string {
  const trimmedTerm = term.trim();
  if (!trimmedTerm) return sentence;
  const escaped = escapeRegExp(trimmedTerm);
  const pattern = new RegExp(`(?<![a-zA-Z0-9])${escaped}(?![a-zA-Z0-9])`, "gi");
  const masked = sentence.replace(pattern, "____");
  if (masked !== sentence) {
    return masked;
  }
  return `${sentence} (____)`;
}

function normalizeSpokenText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildVocabQuizQuestions(
  items: readonly VocabularyItem[],
  count = 5,
  rng: () => number = Math.random
): VocabQuizQuestion[] {
  if (!items.length || count <= 0) return [];

  const selected = shuffleArray(items, rng).slice(0, Math.min(count, items.length));

  return selected.map((item) => {
    const targetLower = item.term.trim().toLowerCase();
    const distractorPool = shuffleArray(
      items.filter((candidate) => candidate.term.trim().toLowerCase() !== targetLower),
      rng
    );

    const uniqueDistractors: string[] = [];
    const seen = new Set<string>([targetLower]);
    for (const candidate of distractorPool) {
      const candidateLower = candidate.term.trim().toLowerCase();
      if (!seen.has(candidateLower)) {
        seen.add(candidateLower);
        uniqueDistractors.push(candidate.term);
        if (uniqueDistractors.length === 3) break;
      }
    }

    return {
      id: item.id,
      item,
      prompt: maskTermInSentence(item.exampleSentenceEN, item.term),
      meaningHint: item.meaningVI,
      targetTerm: item.term,
      choices: shuffleArray([item.term, ...uniqueDistractors], rng),
    };
  });
}

export function isVoiceQuizMatch(spoken: string, targetTerm: string): boolean {
  const normSpoken = normalizeSpokenText(spoken);
  const normTarget = normalizeSpokenText(targetTerm);
  if (!normSpoken || !normTarget) return false;

  if (normSpoken === normTarget) return true;
  if (` ${normSpoken} `.includes(` ${normTarget} `)) return true;

  const spacelessSpoken = normSpoken.replace(/\s+/g, "");
  const spacelessTarget = normTarget.replace(/\s+/g, "");
  if (spacelessSpoken === spacelessTarget) return true;
  if (spacelessTarget.length >= 4 && spacelessSpoken.includes(spacelessTarget)) {
    return true;
  }

  return false;
}

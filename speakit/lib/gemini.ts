import { GrammarCorrection, ScenarioId, ScoreResponse } from "./types";

export interface AiEvaluationInput {
  transcript: string;
  scenario: ScenarioId;
  turnIndex: number;
  expectedKeywords: string[];
  history?: Array<{ role: "assistant" | "user"; content: string }>;
}

interface GeminiEvaluationOptions extends AiEvaluationInput {
  apiKey: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

const DEFAULT_TIMEOUT_MS = 4000;
const DEFAULT_PRONUNCIATION_NOTE =
  "Đánh giá phát âm ước lượng từ văn bản: Chú ý phát âm rõ âm đuôi của các thuật ngữ chuyên ngành.";

export function buildEvaluationPrompts({
  transcript,
  scenario,
  turnIndex,
  expectedKeywords,
  history = [],
}: AiEvaluationInput): { systemInstruction: string; prompt: string } {
  const systemInstruction = `You are an expert IT workplace English coach for Vietnamese software engineering students.
Role-play authentically according to the workplace scenario:
- daily-standup: Scrum Master / Tech Lead
- bug-report: QA Lead / Senior Developer
- code-review: Senior Peer Reviewer
- fresher-interview: Technical Hiring Manager
- client-meeting: Client Representative / Product Owner
- tech-demo: Senior Engineering Audience

STRICT RULES:
1. Always evaluate constructively and factually.
2. Calculate score: 40% keywords used + 30% completeness + 30% grammar (0 to 100).
3. Provide grammar corrections with clear explanations in Vietnamese (explanationVI).
4. Provide ONE natural, idiomatic "betterSentence" used by senior IT engineers.
5. In "pronunciationNote", you MUST include the exact Vietnamese phrase: "Đánh giá phát âm ước lượng từ văn bản" and give 1-2 practical tips for Vietnamese speakers (e.g. final sounds /t/, /d/, /s/ or consonant clusters).
6. Formulate a short, relevant follow-up question ("nextQuestion") that builds directly on what the student just answered in this IT context. Never hallucinate impossible scenario facts.
7. Return STRICT JSON with this schema and NO markdown code fences outside JSON:
{
  "score": number,
  "keywordsUsed": string[],
  "keywordsMissed": string[],
  "grammarCorrections": [
    {
      "original": string,
      "corrected": string,
      "explanationVI": string
    }
  ],
  "betterSentence": string,
  "pronunciationNote": string,
  "nextQuestion": string
}`;

  const prompt = `Student transcript: "${transcript}"
Scenario: ${scenario}
Turn index: ${turnIndex}
Expected technical keywords: ${JSON.stringify(expectedKeywords)}
Previous context: ${JSON.stringify(history)}`;

  return { systemInstruction, prompt };
}

function stripJsonCodeFence(rawText: string): string {
  const trimmed = rawText.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function toGrammarCorrections(value: unknown): GrammarCorrection[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is GrammarCorrection =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as GrammarCorrection).original === "string" &&
      typeof (item as GrammarCorrection).corrected === "string" &&
      typeof (item as GrammarCorrection).explanationVI === "string"
  );
}

export function parseEvaluationJson(
  rawText: string,
  fallbackTranscript: string
): ScoreResponse | null {
  if (!rawText || typeof rawText !== "string") return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonCodeFence(rawText));
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  const hasEvaluationShape =
    typeof record.score === "number" ||
    typeof record.betterSentence === "string" ||
    Array.isArray(record.keywordsUsed);
  if (!hasEvaluationShape) {
    return null;
  }

  const rawScore =
    typeof record.score === "number" && Number.isFinite(record.score)
      ? Math.round(Math.min(100, Math.max(0, record.score)))
      : 70;

  return {
    score: rawScore,
    keywordsUsed: toStringArray(record.keywordsUsed),
    keywordsMissed: toStringArray(record.keywordsMissed),
    grammarCorrections: toGrammarCorrections(record.grammarCorrections),
    betterSentence:
      typeof record.betterSentence === "string" && record.betterSentence.trim()
        ? record.betterSentence.trim()
        : fallbackTranscript,
    pronunciationNote:
      typeof record.pronunciationNote === "string" &&
      record.pronunciationNote.trim()
        ? record.pronunciationNote.trim()
        : DEFAULT_PRONUNCIATION_NOTE,
    nextQuestion:
      typeof record.nextQuestion === "string" && record.nextQuestion.trim()
        ? record.nextQuestion.trim()
        : undefined,
    evaluationMode: "ai",
  };
}

export async function evaluateWithGemini({
  transcript,
  scenario,
  turnIndex,
  expectedKeywords,
  history = [],
  apiKey,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchFn = fetch,
}: GeminiEvaluationOptions): Promise<ScoreResponse | null> {
  if (!apiKey || apiKey.trim() === "") return null;

  const { systemInstruction, prompt } = buildEvaluationPrompts({
    transcript,
    scenario,
    turnIndex,
    expectedKeywords,
    history,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey.trim()}`;
    const response = await fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) return null;

    const normalized = parseEvaluationJson(candidateText, transcript);
    if (!normalized) return null;

    return {
      ...normalized,
      provider: "gemini",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}


import {
  DEFAULT_GEMINI_MODEL,
  getAiProviderSettings,
  OPENAI_WATERFALL_PROVIDERS,
  OpenAiProviderEndpoint,
  recordAiProviderTelemetry,
} from "./ai-telemetry";
import {
  AiEvaluationInput,
  buildEvaluationPrompts,
  parseEvaluationJson,
} from "./gemini";
import { detectSensitiveLanguage } from "./content-moderation";
import { detectInvalidEnglishInput, scoreLocally } from "./localScorer";
import { AI_PROVIDER_SPECS, AiProviderId, ScoreResponse, ScoringProvider } from "./types";

export { OPENAI_WATERFALL_PROVIDERS };

const PROVIDER_TIMEOUT_MS = 4000;
const SCORING_PROVIDER_TIMEOUT_MS = 2500;
const SCORING_TOTAL_BUDGET_MS = 5500;

export interface AiProviderStatusItem {
  id: AiProviderId;
  label: string;
  envVar: string;
  priority: number;
  configured: boolean;
}

export function getAiProviderStatusList(
  env: Record<string, string | undefined> = process.env
): AiProviderStatusItem[] {
  return AI_PROVIDER_SPECS.map((spec) => ({
    id: spec.id,
    label: spec.label,
    envVar: spec.envVar,
    priority: spec.priority,
    configured: Boolean(env[spec.envVar]?.trim()),
  }));
}

export interface AiWaterfallTextOptions {
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  timeoutMs?: number;
  totalBudgetMs?: number;
  env?: Record<string, string | undefined>;
  fetchFn?: typeof fetch;
  validate?: (text: string) => boolean;
}

export interface AiWaterfallTextResult {
  text: string;
  provider: Exclude<AiProviderId, "local">;
}

function tryParseJsonObject(candidate: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(candidate);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Ignore parse errors while probing candidate JSON slices
  }
  return null;
}

/**
 * Extracts and parses the first balanced JSON object from raw LLM output
 * (handling markdown code fences and surrounding prose).
 */
export function extractFirstJsonObject(raw: string): Record<string, unknown> | null {
  if (!raw || typeof raw !== "string") return null;

  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    const fromFence = tryParseJsonObject(fenced[1].trim());
    if (fromFence) return fromFence;
  }
  if (trimmed.startsWith("{")) {
    const direct = tryParseJsonObject(trimmed);
    if (direct) return direct;
  }

  for (let start = 0; start < raw.length; start += 1) {
    if (raw[start] !== "{") continue;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < raw.length; i += 1) {
      const ch = raw[i];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === "\\") {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
      } else if (ch === "{") {
        depth += 1;
      } else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          const parsed = tryParseJsonObject(raw.slice(start, i + 1));
          if (parsed) return parsed;
          break;
        }
      }
    }
  }

  return null;
}

function extractOpenAiContent(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = (choices[0] as { message?: { content?: unknown } })?.message;
  if (!message) return null;
  if (typeof message.content === "string") {
    return message.content;
  }
  if (Array.isArray(message.content)) {
    const joined = message.content
      .map((part) =>
        part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string"
          ? (part as { text: string }).text
          : ""
      )
      .join("")
      .trim();
    return joined || null;
  }
  return null;
}

async function callOpenAiCompatibleText(
  provider: OpenAiProviderEndpoint,
  {
    systemInstruction,
    userPrompt,
    temperature = 0.2,
    maxTokens,
  }: AiWaterfallTextOptions,
  apiKey: string,
  model: string,
  timeoutMs: number,
  fetchFn: typeof fetch
): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetchFn(provider.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature,
        ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    const latencyMs = Date.now() - startedAt;
    void recordAiProviderTelemetry({
      provider: provider.id,
      status: response.status,
      latencyMs,
      remainingRequests: response.headers?.get("x-ratelimit-remaining-requests") ?? null,
      remainingTokens: response.headers?.get("x-ratelimit-remaining-tokens") ?? null,
    });

    if (!response.ok) {
      return null;
    }

    const data: unknown = await response.json();
    const contentText = extractOpenAiContent(data);
    return contentText && contentText.trim() ? contentText.trim() : null;
  } catch {
    void recordAiProviderTelemetry({
      provider: provider.id,
      status: null,
      latencyMs: Date.now() - startedAt,
    });
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callGeminiText(
  {
    systemInstruction,
    userPrompt,
    temperature = 0.2,
    maxTokens,
    jsonMode = false,
  }: AiWaterfallTextOptions,
  apiKey: string,
  model: string,
  timeoutMs: number,
  fetchFn: typeof fetch
): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
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
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature,
          ...(maxTokens !== undefined ? { maxOutputTokens: maxTokens } : {}),
          ...(jsonMode ? { responseMimeType: "application/json" } : {}),
        },
      }),
    });

    const latencyMs = Date.now() - startedAt;
    void recordAiProviderTelemetry({
      provider: "gemini",
      status: response.status,
      latencyMs,
      remainingRequests: response.headers?.get("x-ratelimit-remaining-requests") ?? null,
      remainingTokens: response.headers?.get("x-ratelimit-remaining-tokens") ?? null,
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
    return typeof candidateText === "string" && candidateText.trim()
      ? candidateText.trim()
      : null;
  } catch {
    void recordAiProviderTelemetry({
      provider: "gemini",
      status: null,
      latencyMs: Date.now() - startedAt,
    });
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function runAiWaterfall<T>(
  options: AiWaterfallTextOptions,
  parse: (rawText: string) => T | null
): Promise<{ data: T; provider: Exclude<AiProviderId, "local"> } | null> {
  const {
    env = process.env,
    fetchFn = fetch,
    timeoutMs = PROVIDER_TIMEOUT_MS,
    totalBudgetMs,
  } = options;

  const settings = await getAiProviderSettings();
  const waterfallStartedAt = Date.now();

  for (const provider of OPENAI_WATERFALL_PROVIDERS) {
    if (settings[provider.id]?.isEnabled === false) continue;

    const apiKey = env[provider.envVar]?.trim();
    if (!apiKey) continue;

    const elapsedMs = Date.now() - waterfallStartedAt;
    if (totalBudgetMs !== undefined && elapsedMs >= totalBudgetMs) {
      return null;
    }
    const effectiveTimeoutMs =
      totalBudgetMs !== undefined
        ? Math.min(timeoutMs, Math.max(100, totalBudgetMs - elapsedMs))
        : timeoutMs;

    const model = env[provider.modelEnvVar]?.trim() || provider.defaultModel;
    const rawText = await callOpenAiCompatibleText(
      provider,
      options,
      apiKey,
      model,
      effectiveTimeoutMs,
      fetchFn
    );
    if (!rawText) continue;

    const parsed = parse(rawText);
    if (parsed !== null) {
      return { data: parsed, provider: provider.id };
    }
  }

  const geminiKey = env.GEMINI_API_KEY?.trim();
  if (geminiKey && settings.gemini?.isEnabled !== false) {
    const elapsedMs = Date.now() - waterfallStartedAt;
    if (totalBudgetMs !== undefined && elapsedMs >= totalBudgetMs) {
      return null;
    }
    const effectiveTimeoutMs =
      totalBudgetMs !== undefined
        ? Math.min(timeoutMs, Math.max(100, totalBudgetMs - elapsedMs))
        : timeoutMs;
    const geminiModel = env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
    const rawText = await callGeminiText(options, geminiKey, geminiModel, effectiveTimeoutMs, fetchFn);
    if (rawText) {
      const parsed = parse(rawText);
      if (parsed !== null) {
        return { data: parsed, provider: "gemini" };
      }
    }
  }

  return null;
}

/**
 * Shared 6-provider AI failover transport (Cerebras -> Inception -> Groq -> xKiro -> OpenRouter -> Gemini).
 */
export async function requestAiWaterfallText(
  options: AiWaterfallTextOptions
): Promise<AiWaterfallTextResult | null> {
  const result = await runAiWaterfall(options, (text) => {
    if (!text.trim()) return null;
    if (options.validate && !options.validate(text)) return null;
    return text;
  });
  return result ? { text: result.data, provider: result.provider } : null;
}

export interface WaterfallEvaluationOptions extends AiEvaluationInput {
  sampleAnswerEN?: string;
  hintVI?: string;
  defaultNextQuestion?: string;
  env?: Record<string, string | undefined>;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

export async function evaluateWithWaterfall({
  transcript,
  scenario,
  turnIndex,
  expectedKeywords,
  history = [],
  sampleAnswerEN,
  hintVI,
  defaultNextQuestion,
  env = process.env,
  fetchFn = fetch,
  timeoutMs = SCORING_PROVIDER_TIMEOUT_MS,
}: WaterfallEvaluationOptions): Promise<ScoreResponse & { provider: ScoringProvider }> {
  const sensitive = detectSensitiveLanguage(transcript);
  if (sensitive.flagged) {
    const blockedResult = scoreLocally({
      transcript,
      expectedKeywords,
      sampleAnswerEN,
      hintVI,
    });
    return {
      ...blockedResult,
      score: 0,
      keywordsUsed: [],
      pronunciationNote: `⚠️ Cảnh báo nội dung nhạy cảm: ${sensitive.reason} Hệ thống đã từ chối chấm điểm và báo cáo Admin.`,
      grammarCorrections: [
        {
          original: transcript.slice(0, 120),
          corrected: "Use professional workplace English.",
          explanationVI:
            "Vui lòng sử dụng ngôn từ lịch sự, đúng chuẩn mực nghề nghiệp IT.",
        },
      ],
      nextQuestion: defaultNextQuestion,
      evaluationMode: "local_rules",
      provider: "local",
    };
  }

  const inputGuard = detectInvalidEnglishInput(transcript);
  if (inputGuard.invalid) {
    const blockedResult = scoreLocally({
      transcript,
      expectedKeywords,
      sampleAnswerEN,
      hintVI,
    });
    return {
      ...blockedResult,
      score: 0,
      keywordsUsed: [],
      nextQuestion: defaultNextQuestion,
      evaluationMode: "local_rules",
      provider: "local",
    };
  }

  const { systemInstruction, prompt } = buildEvaluationPrompts({
    transcript,
    scenario,
    turnIndex,
    expectedKeywords,
    history,
  });

  const guardedSystemInstruction = `${systemInstruction}

LANGUAGE, SAFETY & ON-TOPIC GUARD (STRICT):
- The student MUST answer in genuine English and stay relevant to the scenario question.
- If the transcript contains profanity, racial/sexual slurs, NSFW words, hate speech, or offensive insults: you MUST return "score": 0, "keywordsUsed": [], and start "pronunciationNote" with "[SENSITIVE] Cảnh báo: Phát hiện ngôn từ nhạy cảm / thiếu chuẩn mực.".
- If the transcript is completely off-topic from the workplace scenario/question: cap "score" <= 25 and include "[OFF_TOPIC] Nội dung trả lời chưa đúng trọng tâm câu hỏi." in "grammarCorrections".
- If the transcript contains Vietnamese (with or without diacritics), Vietnamese chat/teencode (e.g. cx, dc, ko, khong, kh, vay, sao, ghi, duoc, nhung, nhieu, chua, roi, nhe, nha, zay, vl, vcl, troll), trolling, or gibberish/keyboard mash — even if 1 or 2 English words appear inside Vietnamese text (e.g. "sao ghi hell cx dc") — you MUST return "score": 0, "keywordsUsed": [], and explain in Vietnamese in "pronunciationNote" / "grammarCorrections" that the user must answer in English.`;

  const aiResult = await runAiWaterfall(
    {
      systemInstruction: guardedSystemInstruction,
      userPrompt: prompt,
      temperature: 0.2,
      jsonMode: true,
      timeoutMs,
      totalBudgetMs: SCORING_TOTAL_BUDGET_MS,
      env,
      fetchFn,
    },
    (rawText) => parseEvaluationJson(rawText, transcript)
  );

  if (aiResult) {
    if (detectInvalidEnglishInput(transcript).invalid || aiResult.data.score <= 0) {
      const safeKeywords = Array.isArray(expectedKeywords) ? expectedKeywords : [];
      return {
        ...aiResult.data,
        score: 0,
        keywordsUsed: [],
        keywordsMissed:
          aiResult.data.keywordsMissed.length > 0
            ? aiResult.data.keywordsMissed
            : safeKeywords,
        nextQuestion: aiResult.data.nextQuestion || defaultNextQuestion,
        provider: aiResult.provider,
      };
    }

    return {
      ...aiResult.data,
      nextQuestion: aiResult.data.nextQuestion || defaultNextQuestion,
      provider: aiResult.provider,
    };
  }

  const localResult = scoreLocally({
    transcript,
    expectedKeywords,
    sampleAnswerEN,
    hintVI,
  });

  return {
    ...localResult,
    nextQuestion: defaultNextQuestion,
    evaluationMode: "local_rules",
    provider: "local",
  };
}


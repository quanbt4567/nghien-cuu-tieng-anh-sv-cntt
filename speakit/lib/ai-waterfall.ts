import {
  AiEvaluationInput,
  buildEvaluationPrompts,
  evaluateWithGemini,
  parseEvaluationJson,
} from "./gemini";
import { scoreLocally } from "./localScorer";
import { AI_PROVIDER_SPECS, AiProviderId, ScoreResponse, ScoringProvider } from "./types";

const PROVIDER_TIMEOUT_MS = 4000;

interface OpenAiProviderEndpoint {
  id: Exclude<AiProviderId, "gemini">;
  envVar: string;
  url: string;
  modelEnvVar: string;
  defaultModel: string;
}

export const OPENAI_WATERFALL_PROVIDERS: readonly OpenAiProviderEndpoint[] = [
  {
    id: "cerebras",
    envVar: "CEREBRAS_API_KEY",
    url: "https://api.cerebras.ai/v1/chat/completions",
    modelEnvVar: "CEREBRAS_MODEL",
    defaultModel: "llama-3.3-70b",
  },
  {
    id: "inception",
    envVar: "INCEPTION_API_KEY",
    url: "https://api.inceptionlabs.ai/v1/chat/completions",
    modelEnvVar: "INCEPTION_MODEL",
    defaultModel: "mercury-2.5",
  },
  {
    id: "groq",
    envVar: "GROQ_API_KEY",
    url: "https://api.groq.com/openai/v1/chat/completions",
    modelEnvVar: "GROQ_MODEL",
    defaultModel: "llama-3.3-70b-versatile",
  },
  {
    id: "xkiro",
    envVar: "XKIRO_API_KEY",
    url: "https://api.xkiro.com/v1/chat/completions",
    modelEnvVar: "XKIRO_MODEL",
    defaultModel: "openai/gpt-4o-mini",
  },
  {
    id: "openrouter",
    envVar: "OPENROUTER_API_KEY",
    url: "https://openrouter.ai/api/v1/chat/completions",
    modelEnvVar: "OPENROUTER_MODEL",
    defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
  },
];

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

async function callOpenAiCompatibleProvider(
  provider: OpenAiProviderEndpoint,
  input: AiEvaluationInput,
  apiKey: string,
  model: string,
  timeoutMs: number,
  fetchFn: typeof fetch
): Promise<(ScoreResponse & { provider: ScoringProvider }) | null> {
  const { systemInstruction, prompt } = buildEvaluationPrompts(input);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
        temperature: 0.2,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data: unknown = await response.json();
    const contentText = extractOpenAiContent(data);
    if (!contentText) return null;

    const normalized = parseEvaluationJson(contentText, input.transcript);
    if (!normalized) return null;

    return {
      ...normalized,
      provider: provider.id,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
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
  timeoutMs = PROVIDER_TIMEOUT_MS,
}: WaterfallEvaluationOptions): Promise<ScoreResponse & { provider: ScoringProvider }> {
  const promptInput: AiEvaluationInput = {
    transcript,
    scenario,
    turnIndex,
    expectedKeywords,
    history,
  };

  for (const provider of OPENAI_WATERFALL_PROVIDERS) {
    const apiKey = env[provider.envVar]?.trim();
    if (!apiKey) continue;

    const model = env[provider.modelEnvVar]?.trim() || provider.defaultModel;
    const result = await callOpenAiCompatibleProvider(
      provider,
      promptInput,
      apiKey,
      model,
      timeoutMs,
      fetchFn
    );
    if (result) {
      return {
        ...result,
        nextQuestion: result.nextQuestion || defaultNextQuestion,
        provider: provider.id,
      };
    }
  }

  const geminiKey = env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    const geminiResult = await evaluateWithGemini({
      ...promptInput,
      apiKey: geminiKey,
      timeoutMs,
      fetchFn,
    });
    if (geminiResult) {
      return {
        ...geminiResult,
        nextQuestion: geminiResult.nextQuestion || defaultNextQuestion,
        provider: "gemini",
      };
    }
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


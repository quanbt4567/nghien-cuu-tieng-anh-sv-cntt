import { getNeonSql } from "./db/neon";
import { initializeAiProviderUsageSchema } from "./db/schema";
import { AI_PROVIDER_SPECS, AiProviderId } from "./types";

export interface OpenAiProviderEndpoint {
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
    defaultModel: "qwen-3.8-27b",
  },
  {
    id: "inception",
    envVar: "INCEPTION_API_KEY",
    url: "https://api.inceptionlabs.ai/v1/chat/completions",
    modelEnvVar: "INCEPTION_MODEL",
    defaultModel: "mercury-3",
  },
  {
    id: "groq",
    envVar: "GROQ_API_KEY",
    url: "https://api.groq.com/openai/v1/chat/completions",
    modelEnvVar: "GROQ_MODEL",
    defaultModel: "qwen/qwen3.8-27b",
  },
  {
    id: "xkiro",
    envVar: "XKIRO_API_KEY",
    url: "https://api.xkiro.com/v1/chat/completions",
    modelEnvVar: "XKIRO_MODEL",
    defaultModel: "mistralai/ministral-14b",
  },
  {
    id: "openrouter",
    envVar: "OPENROUTER_API_KEY",
    url: "https://openrouter.ai/api/v1/chat/completions",
    modelEnvVar: "OPENROUTER_MODEL",
    defaultModel: "openrouter/free",
  },
];

export const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite-preview";
const DEFAULT_DAILY_LIMIT_CAP = 1000;
const PING_TIMEOUT_MS = 5000;
const OPENROUTER_BALANCE_TIMEOUT_MS = 3500;

export type AiProviderHealthStatus =
  | "healthy"
  | "warning"
  | "rate_limited"
  | "disabled"
  | "unmeasured";

export interface AiProviderConfig {
  dailyLimitCap: number;
  isEnabled: boolean;
}

export interface AiTelemetryRecordInput {
  provider: AiProviderId;
  status?: number | null;
  latencyMs?: number | null;
  remainingRequests?: string | null;
  remainingTokens?: string | null;
  dateKey?: string;
}

export interface OpenRouterCreditBalance {
  limit: number | null;
  usage: number | null;
  remaining: number | null;
  isFreeTier: boolean;
}

export interface AiProviderHealthItem {
  id: AiProviderId;
  label: string;
  priority: number;
  envVar: string;
  keyStatus: "Configured" | "Missing";
  status: AiProviderHealthStatus;
  isEnabled: boolean;
  dailyLimitCap: number;
  todayRequests: number;
  today429Count: number;
  usagePercent: number;
  lastStatus: number | null;
  lastLatencyMs: number | null;
  remainingRequestsHeader: string | null;
  remainingTokensHeader: string | null;
  openRouterBalance?: OpenRouterCreditBalance | null;
}

export interface AiDailyDistributionItem {
  dateKey: string;
  totalRequests: number;
  byProvider: Record<AiProviderId, number>;
}

export interface AiHealthSummary {
  providers: AiProviderHealthItem[];
  dailyDistribution: AiDailyDistributionItem[];
  openRouterBalance: OpenRouterCreditBalance | null;
  dbConnected: boolean;
  generatedAt: string;
}

export interface AiProviderPingResult {
  provider: AiProviderId;
  configured: boolean;
  ok: boolean;
  status: number | null;
  latencyMs: number | null;
  remainingRequests: string | null;
  remainingTokens: string | null;
}

export function getSql() {
  return getNeonSql();
}

export function isValidAiProviderId(value: unknown): value is AiProviderId {
  return typeof value === "string" && AI_PROVIDER_SPECS.some((spec) => spec.id === value);
}

function getDateKey(offsetDays = 0): string {
  const date = new Date(Date.now() + offsetDays * 86400000);
  return date.toISOString().slice(0, 10);
}

function getLast7DateKeys(): string[] {
  const keys: string[] = [];
  for (let i = -6; i <= 0; i += 1) {
    keys.push(getDateKey(i));
  }
  return keys;
}

function createDefaultSettings(): Record<AiProviderId, AiProviderConfig> {
  return {
    cerebras: { dailyLimitCap: DEFAULT_DAILY_LIMIT_CAP, isEnabled: true },
    inception: { dailyLimitCap: DEFAULT_DAILY_LIMIT_CAP, isEnabled: true },
    groq: { dailyLimitCap: DEFAULT_DAILY_LIMIT_CAP, isEnabled: true },
    xkiro: { dailyLimitCap: DEFAULT_DAILY_LIMIT_CAP, isEnabled: true },
    openrouter: { dailyLimitCap: DEFAULT_DAILY_LIMIT_CAP, isEnabled: true },
    gemini: { dailyLimitCap: DEFAULT_DAILY_LIMIT_CAP, isEnabled: true },
  };
}

function createEmptyProviderCounts(): Record<AiProviderId, number> {
  return {
    cerebras: 0,
    inception: 0,
    groq: 0,
    xkiro: 0,
    openrouter: 0,
    gemini: 0,
  };
}

export async function recordAiProviderTelemetry(
  input: AiTelemetryRecordInput
): Promise<void> {
  const sql = getSql();
  if (!sql) return;

  try {
    const ready = await initializeAiProviderUsageSchema(sql);
    if (!ready) return;

    const dateKey = input.dateKey ?? getDateKey(0);
    const status =
      typeof input.status === "number" && Number.isFinite(input.status)
        ? Math.trunc(input.status)
        : null;
    const latencyMs =
      typeof input.latencyMs === "number" && Number.isFinite(input.latencyMs)
        ? Math.max(0, Math.round(input.latencyMs))
        : null;
    const remainingRequests = input.remainingRequests?.trim() || null;
    const remainingTokens = input.remainingTokens?.trim() || null;
    const error429Delta = status === 429 ? 1 : 0;

    await sql`
      INSERT INTO ai_provider_usage (
        provider,
        date_key,
        request_count,
        error_429_count,
        last_status,
        last_latency_ms,
        remaining_requests_header,
        remaining_tokens_header,
        daily_limit_cap,
        is_enabled,
        updated_at
      )
      VALUES (
        ${input.provider},
        ${dateKey},
        1,
        ${error429Delta},
        ${status},
        ${latencyMs},
        ${remainingRequests},
        ${remainingTokens},
        COALESCE(
          (SELECT daily_limit_cap FROM ai_provider_settings WHERE provider = ${input.provider}),
          ${DEFAULT_DAILY_LIMIT_CAP}
        ),
        COALESCE(
          (SELECT is_enabled FROM ai_provider_settings WHERE provider = ${input.provider}),
          TRUE
        ),
        NOW()
      )
      ON CONFLICT (provider, date_key) DO UPDATE SET
        request_count = ai_provider_usage.request_count + 1,
        error_429_count = ai_provider_usage.error_429_count + ${error429Delta},
        last_status = COALESCE(${status}, ai_provider_usage.last_status),
        last_latency_ms = COALESCE(${latencyMs}, ai_provider_usage.last_latency_ms),
        remaining_requests_header = COALESCE(
          ${remainingRequests},
          ai_provider_usage.remaining_requests_header
        ),
        remaining_tokens_header = COALESCE(
          ${remainingTokens},
          ai_provider_usage.remaining_tokens_header
        ),
        updated_at = NOW()
    `;
  } catch {
    return;
  }
}

export async function getAiProviderSettings(): Promise<
  Record<AiProviderId, AiProviderConfig>
> {
  const defaults = createDefaultSettings();
  const sql = getSql();
  if (!sql) return defaults;

  try {
    const ready = await initializeAiProviderUsageSchema(sql);
    if (!ready) return defaults;

    const rows = (await sql`
      SELECT provider, daily_limit_cap, is_enabled
      FROM ai_provider_settings
    `) as Array<{
      provider: string;
      daily_limit_cap: number | null;
      is_enabled: boolean | null;
    }>;

    for (const row of rows) {
      if (!isValidAiProviderId(row.provider)) continue;
      defaults[row.provider] = {
        dailyLimitCap:
          typeof row.daily_limit_cap === "number" && row.daily_limit_cap > 0
            ? row.daily_limit_cap
            : DEFAULT_DAILY_LIMIT_CAP,
        isEnabled: typeof row.is_enabled === "boolean" ? row.is_enabled : true,
      };
    }

    return defaults;
  } catch {
    return defaults;
  }
}

async function fetchOpenRouterBalance(
  env: Record<string, string | undefined> = process.env
): Promise<OpenRouterCreditBalance | null> {
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENROUTER_BALANCE_TIMEOUT_MS);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/auth/key", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      data?: {
        limit?: unknown;
        usage?: unknown;
        limit_remaining?: unknown;
        is_free_tier?: unknown;
      };
    };
    const data = payload?.data;
    if (!data || typeof data !== "object") return null;

    const limit = typeof data.limit === "number" ? data.limit : null;
    const usage = typeof data.usage === "number" ? data.usage : null;
    const remaining =
      typeof data.limit_remaining === "number"
        ? data.limit_remaining
        : limit !== null && usage !== null
          ? Math.max(0, limit - usage)
          : null;

    return {
      limit,
      usage,
      remaining,
      isFreeTier: Boolean(data.is_free_tier),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function computeHealthStatus(
  isEnabled: boolean,
  todayRequests: number,
  dailyLimitCap: number,
  today429Count: number,
  lastStatus: number | null,
  lastLatencyMs: number | null
): AiProviderHealthStatus {
  if (!isEnabled) return "disabled";
  if (today429Count > 0 || lastStatus === 429) return "rate_limited";
  if (
    lastStatus === null ||
    lastLatencyMs === null ||
    lastStatus < 200 ||
    lastStatus >= 300
  ) {
    return "unmeasured";
  }
  if (dailyLimitCap > 0 && todayRequests / dailyLimitCap >= 0.8) return "warning";
  return "healthy";
}

export async function getAiHealthSummary(
  env: Record<string, string | undefined> = process.env
): Promise<AiHealthSummary> {
  const dateKeys = getLast7DateKeys();
  const todayKey = dateKeys[dateKeys.length - 1];
  const oldestKey = dateKeys[0];

  const [settings, openRouterBalance] = await Promise.all([
    getAiProviderSettings(),
    fetchOpenRouterBalance(env),
  ]);

  const sql = getSql();
  let dbConnected = false;
  const usageRows: Array<{
    provider: string;
    date_key: string;
    request_count: number | null;
    error_429_count: number | null;
    last_status: number | null;
    last_latency_ms: number | null;
    remaining_requests_header: string | null;
    remaining_tokens_header: string | null;
  }> = [];

  if (sql) {
    try {
      const ready = await initializeAiProviderUsageSchema(sql);
      if (ready) {
        dbConnected = true;
        const rows = (await sql`
          SELECT
            provider,
            date_key,
            request_count,
            error_429_count,
            last_status,
            last_latency_ms,
            remaining_requests_header,
            remaining_tokens_header
          FROM ai_provider_usage
          WHERE date_key >= ${oldestKey}
        `) as typeof usageRows;
        usageRows.push(...rows);
      }
    } catch {
      dbConnected = false;
    }
  }

  const todayRowByProvider = new Map<AiProviderId, (typeof usageRows)[number]>();
  const dayMap = new Map<string, AiDailyDistributionItem>();
  for (const key of dateKeys) {
    dayMap.set(key, {
      dateKey: key,
      totalRequests: 0,
      byProvider: createEmptyProviderCounts(),
    });
  }

  for (const row of usageRows) {
    if (!isValidAiProviderId(row.provider)) continue;
    const reqCount = typeof row.request_count === "number" ? row.request_count : 0;

    if (row.date_key === todayKey) {
      todayRowByProvider.set(row.provider, row);
    }

    const dayEntry = dayMap.get(row.date_key);
    if (dayEntry) {
      dayEntry.byProvider[row.provider] += reqCount;
      dayEntry.totalRequests += reqCount;
    }
  }

  const providers: AiProviderHealthItem[] = AI_PROVIDER_SPECS.map((spec) => {
    const config = settings[spec.id];
    const todayRow = todayRowByProvider.get(spec.id);
    const todayRequests =
      typeof todayRow?.request_count === "number" ? todayRow.request_count : 0;
    const today429Count =
      typeof todayRow?.error_429_count === "number" ? todayRow.error_429_count : 0;
    const lastStatus =
      typeof todayRow?.last_status === "number" ? todayRow.last_status : null;
    const lastLatencyMs =
      typeof todayRow?.last_latency_ms === "number" ? todayRow.last_latency_ms : null;
    const usagePercent =
      config.dailyLimitCap > 0
        ? Math.min(100, Math.round((todayRequests / config.dailyLimitCap) * 100))
        : 0;
    const configured = Boolean(env[spec.envVar]?.trim());

    return {
      id: spec.id,
      label: spec.label,
      priority: spec.priority,
      envVar: spec.envVar,
      keyStatus: configured ? "Configured" : "Missing",
      status: computeHealthStatus(
        config.isEnabled,
        todayRequests,
        config.dailyLimitCap,
        today429Count,
        lastStatus,
        lastLatencyMs
      ),
      isEnabled: config.isEnabled,
      dailyLimitCap: config.dailyLimitCap,
      todayRequests,
      today429Count,
      usagePercent,
      lastStatus,
      lastLatencyMs,
      remainingRequestsHeader: todayRow?.remaining_requests_header ?? null,
      remainingTokensHeader: todayRow?.remaining_tokens_header ?? null,
      ...(spec.id === "openrouter" ? { openRouterBalance } : {}),
    };
  });

  return {
    providers,
    dailyDistribution: dateKeys.map((key) => dayMap.get(key)!),
    openRouterBalance,
    dbConnected,
    generatedAt: new Date().toISOString(),
  };
}

async function pingOpenAiEndpoint(
  endpoint: OpenAiProviderEndpoint,
  env: Record<string, string | undefined>
): Promise<AiProviderPingResult> {
  const apiKey = env[endpoint.envVar]?.trim();
  if (!apiKey) {
    return {
      provider: endpoint.id,
      configured: false,
      ok: false,
      status: null,
      latencyMs: null,
      remainingRequests: null,
      remainingTokens: null,
    };
  }

  const model = env[endpoint.modelEnvVar]?.trim() || endpoint.defaultModel;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    });

    const latencyMs = Date.now() - startedAt;
    const remainingRequests =
      response.headers?.get("x-ratelimit-remaining-requests") ?? null;
    const remainingTokens =
      response.headers?.get("x-ratelimit-remaining-tokens") ?? null;

    await recordAiProviderTelemetry({
      provider: endpoint.id,
      status: response.status,
      latencyMs,
      remainingRequests,
      remainingTokens,
    });

    return {
      provider: endpoint.id,
      configured: true,
      ok: response.ok,
      status: response.status,
      latencyMs,
      remainingRequests,
      remainingTokens,
    };
  } catch {
    const latencyMs = Date.now() - startedAt;
    await recordAiProviderTelemetry({
      provider: endpoint.id,
      status: null,
      latencyMs,
    });

    return {
      provider: endpoint.id,
      configured: true,
      ok: false,
      status: null,
      latencyMs,
      remainingRequests: null,
      remainingTokens: null,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function pingGeminiEndpoint(
  env: Record<string, string | undefined>
): Promise<AiProviderPingResult> {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return {
      provider: "gemini",
      configured: false,
      ok: false,
      status: null,
      latencyMs: null,
      remainingRequests: null,
      remainingTokens: null,
    };
  }

  const model = env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 1,
        },
      }),
    });

    const latencyMs = Date.now() - startedAt;
    const remainingRequests =
      response.headers?.get("x-ratelimit-remaining-requests") ?? null;
    const remainingTokens =
      response.headers?.get("x-ratelimit-remaining-tokens") ?? null;

    await recordAiProviderTelemetry({
      provider: "gemini",
      status: response.status,
      latencyMs,
      remainingRequests,
      remainingTokens,
    });

    return {
      provider: "gemini",
      configured: true,
      ok: response.ok,
      status: response.status,
      latencyMs,
      remainingRequests,
      remainingTokens,
    };
  } catch {
    const latencyMs = Date.now() - startedAt;
    await recordAiProviderTelemetry({
      provider: "gemini",
      status: null,
      latencyMs,
    });

    return {
      provider: "gemini",
      configured: true,
      ok: false,
      status: null,
      latencyMs,
      remainingRequests: null,
      remainingTokens: null,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function pingAllAiProviders(
  env: Record<string, string | undefined> = process.env
): Promise<AiProviderPingResult[]> {
  return Promise.all([
    ...OPENAI_WATERFALL_PROVIDERS.map((endpoint) => pingOpenAiEndpoint(endpoint, env)),
    pingGeminiEndpoint(env),
  ]);
}

export async function updateAiProviderConfig(
  provider: AiProviderId,
  config: { dailyLimitCap?: number; isEnabled?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  const sql = getSql();
  if (!sql) {
    return { ok: false, error: "Database unavailable" };
  }

  const ready = await initializeAiProviderUsageSchema(sql);
  if (!ready) {
    return { ok: false, error: "Database schema initialization failed" };
  }

  const normalizedCap =
    typeof config.dailyLimitCap === "number" && Number.isFinite(config.dailyLimitCap)
      ? Math.max(1, Math.min(1000000, Math.round(config.dailyLimitCap)))
      : null;
  const normalizedEnabled =
    typeof config.isEnabled === "boolean" ? config.isEnabled : null;

  if (normalizedCap === null && normalizedEnabled === null) {
    return { ok: false, error: "No valid fields to update" };
  }

  try {
    const insertCap = normalizedCap ?? DEFAULT_DAILY_LIMIT_CAP;
    const insertEnabled = normalizedEnabled ?? true;
    const todayKey = getDateKey(0);

    await sql`
      INSERT INTO ai_provider_settings (provider, daily_limit_cap, is_enabled, updated_at)
      VALUES (${provider}, ${insertCap}, ${insertEnabled}, NOW())
      ON CONFLICT (provider) DO UPDATE SET
        daily_limit_cap = COALESCE(${normalizedCap}, ai_provider_settings.daily_limit_cap),
        is_enabled = COALESCE(${normalizedEnabled}, ai_provider_settings.is_enabled),
        updated_at = NOW()
    `;

    await sql`
      UPDATE ai_provider_usage
      SET
        daily_limit_cap = COALESCE(${normalizedCap}, daily_limit_cap),
        is_enabled = COALESCE(${normalizedEnabled}, is_enabled),
        updated_at = NOW()
      WHERE provider = ${provider} AND date_key = ${todayKey}
    `;

    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to update provider configuration" };
  }
}

import { SCENARIOS } from "../../data/scenarios";
import {
  buildResearchCsv,
  createEmptyContentOverrides,
  getLocalContentOverrides,
  mergeScenarios,
  normalizeContentOverrides,
  saveLocalContentOverrides,
} from "../../lib/contentStore";
import { getGamificationState } from "../../lib/gamification";
import { storageAdapter } from "../../lib/storage";
import {
  AI_PROVIDER_SPECS,
  type AdminContentOverrides,
  type AiProviderId,
  type ArenaRunRecord,
  type GameScoreEntry,
  type PracticeAttempt,
  type WeakPoint,
} from "../../lib/types";

export interface AiProviderHealthItem {
  id: AiProviderId;
  label: string;
  envVar: string;
  priority: number;
  configured: boolean;
}

export interface AdminHealth {
  neonConnected: boolean;
  geminiConfigured: boolean;
  aiProviders?: AiProviderHealthItem[];
  isDefaultPasscode: boolean;
}

export function resolveAiProviders(health: AdminHealth): AiProviderHealthItem[] {
  if (Array.isArray(health.aiProviders) && health.aiProviders.length > 0) {
    return health.aiProviders;
  }
  return AI_PROVIDER_SPECS.map((spec) => ({
    id: spec.id,
    label: spec.label,
    envVar: spec.envVar,
    priority: spec.priority,
    configured: spec.id === "gemini" ? health.geminiConfigured : false,
  }));
}

export interface ScenarioBreakdownItem {
  scenario: string;
  count: number;
  avgScore: number;
}

export interface AdminStats {
  totalAttempts: number;
  avgScore: number;
  totalArenaRuns: number;
  activeScenariosCount: number;
  totalWeakPoints: number;
  roleBreakdown: Record<string, number>;
  scenarioBreakdown: ScenarioBreakdownItem[];
}

export interface AdminDashboardResponse {
  stats: AdminStats;
  attempts: PracticeAttempt[];
  weakPoints: WeakPoint[];
  arenaRuns: ArenaRunRecord[];
  overrides: AdminContentOverrides;
  health: AdminHealth;
}

export interface MergedAdminData {
  stats: AdminStats;
  attempts: PracticeAttempt[];
  weakPoints: WeakPoint[];
  arenaRuns: ArenaRunRecord[];
  overrides: AdminContentOverrides;
  health: AdminHealth;
  localExtrasCount: number;
}

export interface PersistResult {
  ok: boolean;
  synced: boolean;
  unauthorized?: boolean;
  message: string;
  overrides: AdminContentOverrides;
}

export const ROLE_LABELS: Record<string, string> = {
  frontend: "Frontend",
  backend: "Backend",
  qa: "QA",
  devops: "DevOps",
  unknown: "Chưa chọn vai trò",
};

function toArenaRunRecord(entry: GameScoreEntry): ArenaRunRecord {
  return {
    id: entry.id,
    game_id: entry.gameId,
    score: entry.score,
    accuracy_or_words: entry.accuracyOrWords,
    duration_sec: entry.durationSec,
    role: entry.role ?? null,
    created_at: entry.createdAt,
  };
}

function sortByTimestampDesc<T extends { created_at: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const tA = Date.parse(a.created_at) || 0;
    const tB = Date.parse(b.created_at) || 0;
    return tB - tA;
  });
}

function dedupeById<T extends { id: string }>(primary: T[], secondary: T[]): { merged: T[]; addedCount: number } {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const item of primary) {
    if (!item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  let addedCount = 0;
  for (const item of secondary) {
    if (!item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
    addedCount += 1;
  }
  return { merged, addedCount };
}

function dedupeWeakPoints(primary: WeakPoint[], secondary: WeakPoint[]): { merged: WeakPoint[]; addedCount: number } {
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  const merged: WeakPoint[] = [];

  const pushUnique = (wp: WeakPoint): boolean => {
    const semanticKey = `${wp.kind}:${wp.value.trim().toLowerCase()}`;
    if ((wp.id && seenIds.has(wp.id)) || seenKeys.has(semanticKey)) {
      return false;
    }
    if (wp.id) seenIds.add(wp.id);
    seenKeys.add(semanticKey);
    merged.push(wp);
    return true;
  };

  for (const wp of primary) pushUnique(wp);
  let addedCount = 0;
  for (const wp of secondary) {
    if (pushUnique(wp)) addedCount += 1;
  }

  merged.sort((a, b) => b.miss_count - a.miss_count);
  return { merged, addedCount };
}

function computeScenarioBreakdown(attempts: PracticeAttempt[]): ScenarioBreakdownItem[] {
  const grouped = new Map<string, { count: number; totalScore: number }>();
  for (const attempt of attempts) {
    const prev = grouped.get(attempt.scenario) ?? { count: 0, totalScore: 0 };
    grouped.set(attempt.scenario, {
      count: prev.count + 1,
      totalScore: prev.totalScore + (Number.isFinite(attempt.score) ? attempt.score : 0),
    });
  }
  return Array.from(grouped.entries())
    .map(([scenario, agg]) => ({
      scenario,
      count: agg.count,
      avgScore: agg.count > 0 ? Math.round(agg.totalScore / agg.count) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Merges Neon DB dashboard data with localStorage fallback records, deduplicating cleanly by id.
 */
export async function loadMergedAdminData(
  remote: AdminDashboardResponse | null
): Promise<MergedAdminData> {
  const [localAttempts, localWeakPoints] = await Promise.all([
    storageAdapter.getAttempts(),
    storageAdapter.getWeakPoints(100),
  ]);
  const gamification = getGamificationState();
  const localArenaRuns = gamification.history.map(toArenaRunRecord);

  const neonConnected = Boolean(remote?.health?.neonConnected);
  const baseHealth: AdminHealth = remote?.health ?? {
    neonConnected: false,
    geminiConfigured: false,
    isDefaultPasscode: false,
  };

  const remoteAttempts = neonConnected && remote ? remote.attempts : [];
  const remoteArenaRuns = neonConnected && remote ? remote.arenaRuns : [];
  const remoteWeakPoints = neonConnected && remote ? remote.weakPoints : [];

  const attemptMerge = dedupeById(remoteAttempts, localAttempts);
  const arenaMerge = dedupeById(remoteArenaRuns, localArenaRuns);
  const weakMerge = dedupeWeakPoints(remoteWeakPoints, localWeakPoints);

  const attempts = sortByTimestampDesc(attemptMerge.merged);
  const arenaRuns = sortByTimestampDesc(arenaMerge.merged);
  const weakPoints = weakMerge.merged;

  const overrides = neonConnected && remote
    ? saveLocalContentOverrides(normalizeContentOverrides(remote.overrides))
    : getLocalContentOverrides();

  const activeScenariosCount = mergeScenarios(SCENARIOS, overrides, false).length;

  // Use exact list aggregates when all DB rows are present (<= 200), otherwise add unsynced local extras.
  const canComputeExactAttempts = !neonConnected || (remote?.stats.totalAttempts ?? 0) <= remoteAttempts.length;
  const totalAttempts = canComputeExactAttempts
    ? attempts.length
    : (remote?.stats.totalAttempts ?? 0) + attemptMerge.addedCount;

  const avgScore = canComputeExactAttempts
    ? attempts.length > 0
      ? Math.round(attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length)
      : 0
    : remote?.stats.avgScore ?? 0;

  const totalArenaRuns =
    !neonConnected || (remote?.stats.totalArenaRuns ?? 0) <= remoteArenaRuns.length
      ? arenaRuns.length
      : (remote?.stats.totalArenaRuns ?? 0) + arenaMerge.addedCount;

  const totalWeakPoints =
    !neonConnected || (remote?.stats.totalWeakPoints ?? 0) <= remoteWeakPoints.length
      ? weakPoints.length
      : (remote?.stats.totalWeakPoints ?? 0) + weakMerge.addedCount;

  const roleBreakdown: Record<string, number> = neonConnected && remote ? { ...remote.stats.roleBreakdown } : {};
  if (!neonConnected) {
    for (const item of [...attempts, ...arenaRuns]) {
      const roleKey = item.role?.trim() || "unknown";
      roleBreakdown[roleKey] = (roleBreakdown[roleKey] ?? 0) + 1;
    }
  } else {
    const remoteAttemptIds = new Set(remoteAttempts.map((a) => a.id));
    const remoteArenaIds = new Set(remoteArenaRuns.map((r) => r.id));
    for (const a of localAttempts) {
      if (!remoteAttemptIds.has(a.id)) {
        const key = a.role?.trim() || "unknown";
        roleBreakdown[key] = (roleBreakdown[key] ?? 0) + 1;
      }
    }
    for (const r of localArenaRuns) {
      if (!remoteArenaIds.has(r.id)) {
        const key = r.role?.trim() || "unknown";
        roleBreakdown[key] = (roleBreakdown[key] ?? 0) + 1;
      }
    }
  }

  const scenarioBreakdown = canComputeExactAttempts
    ? computeScenarioBreakdown(attempts)
    : remote?.stats.scenarioBreakdown ?? [];

  return {
    stats: {
      totalAttempts,
      avgScore,
      totalArenaRuns,
      activeScenariosCount,
      totalWeakPoints,
      roleBreakdown,
      scenarioBreakdown,
    },
    attempts,
    weakPoints,
    arenaRuns,
    overrides,
    health: baseHealth,
    localExtrasCount: attemptMerge.addedCount + arenaMerge.addedCount + weakMerge.addedCount,
  };
}

/**
 * Always saves overrides to localStorage first, then syncs to PUT /api/admin/content.
 */
export async function persistAdminOverrides(
  nextOverrides: AdminContentOverrides
): Promise<PersistResult> {
  const savedLocal = saveLocalContentOverrides(nextOverrides);
  try {
    const res = await fetch("/api/admin/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ overrides: savedLocal }),
    });
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      overrides?: unknown;
    } | null;

    if (res.status === 401) {
      return {
        ok: false,
        synced: false,
        unauthorized: true,
        message: "Phiên quản trị đã hết hạn. Vui lòng đăng nhập lại.",
        overrides: savedLocal,
      };
    }

    if (!res.ok) {
      return {
        ok: true,
        synced: false,
        message:
          data?.error ||
          "Đã lưu vào bộ nhớ cục bộ (Local Cache), nhưng chưa đồng bộ lên Neon Cloud DB.",
        overrides: savedLocal,
      };
    }

    const syncedOverrides = data?.overrides
      ? saveLocalContentOverrides(normalizeContentOverrides(data.overrides))
      : savedLocal;

    return {
      ok: true,
      synced: true,
      message: "Đã lưu thay đổi và đồng bộ lên Neon Cloud DB.",
      overrides: syncedOverrides,
    };
  } catch {
    return {
      ok: true,
      synced: false,
      message:
        "Mất kết nối máy chủ: đã lưu tạm vào Local Cache trên trình duyệt này.",
      overrides: savedLocal,
    };
  }
}

export function triggerDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadResearchCsv(
  attempts: PracticeAttempt[],
  arenaRuns: ArenaRunRecord[],
  weakPoints: WeakPoint[]
): void {
  const csv = buildResearchCsv(attempts, arenaRuns, weakPoints);
  const dateTag = new Date().toISOString().slice(0, 10);
  triggerDownload(`speakit_research_${dateTag}.csv`, csv, "text/csv;charset=utf-8;");
}

export function downloadResearchJson(
  payload: Record<string, unknown>,
  prefix = "speakit_research"
): void {
  const dateTag = new Date().toISOString().slice(0, 10);
  triggerDownload(
    `${prefix}_${dateTag}.json`,
    JSON.stringify(payload, null, 2),
    "application/json;charset=utf-8;"
  );
}

export function formatDateTimeVI(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function createCleanEmptyOverrides(): AdminContentOverrides {
  return createEmptyContentOverrides();
}

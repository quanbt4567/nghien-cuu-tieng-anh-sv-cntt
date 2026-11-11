import { BUG_BUSTER_CHALLENGES } from "../data/minigames";
import { SCENARIOS, VOCABULARY_LIST } from "../data/scenarios";
import type {
  AdminContentOverrides,
  ArenaRunRecord,
  BugBusterChallenge,
  GameScoreEntry,
  ITRole,
  PracticeAttempt,
  Scenario,
  ScenarioTurn,
  VocabularyItem,
  WeakPoint,
} from "./types";

export const CONTENT_STORAGE_KEY = "speakit_admin_content_v1";
export const CONTENT_UPDATED_EVENT = "speakit:content-updated";

const VALID_ROLES = new Set<ITRole>(["frontend", "backend", "qa", "devops"]);
const VALID_BUG_CATEGORIES = new Set<BugBusterChallenge["category"]>([
  "error-log",
  "code-review",
  "incident",
]);

export function createEmptyContentOverrides(): AdminContentOverrides {
  return {
    customScenarios: [],
    hiddenScenarioIds: [],
    customVocabulary: [],
    deletedVocabIds: [],
    customBugChallenges: [],
    deletedChallengeIds: [],
  };
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      out.push(trimmed);
    }
  }
  return out;
}

function sanitizeTurn(raw: unknown, fallbackIndex: number): ScenarioTurn | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const questionEN = typeof r.questionEN === "string" ? r.questionEN.trim() : "";
  if (!questionEN) return null;
  return {
    turnIndex:
      typeof r.turnIndex === "number" && Number.isFinite(r.turnIndex)
        ? Math.max(0, Math.floor(r.turnIndex))
        : fallbackIndex,
    questionEN,
    keywords: toStringList(r.keywords),
    sampleAnswerEN:
      typeof r.sampleAnswerEN === "string" ? r.sampleAnswerEN.trim() : "",
    hintVI: typeof r.hintVI === "string" ? r.hintVI.trim() : "",
  };
}

function sanitizeScenario(raw: unknown): Scenario | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : "";
  const titleEN = typeof r.titleEN === "string" ? r.titleEN.trim() : "";
  if (!id || !titleEN) return null;

  const turns = Array.isArray(r.turns)
    ? r.turns
        .map((t, idx) => sanitizeTurn(t, idx))
        .filter((t): t is ScenarioTurn => t !== null)
    : [];
  if (turns.length === 0) return null;

  const targetRoles = Array.isArray(r.targetRoles)
    ? r.targetRoles.filter((role): role is ITRole =>
        VALID_ROLES.has(role as ITRole)
      )
    : undefined;

  return {
    id,
    titleEN,
    titleVI: typeof r.titleVI === "string" && r.titleVI.trim() ? r.titleVI.trim() : titleEN,
    roleVI: typeof r.roleVI === "string" && r.roleVI.trim() ? r.roleVI.trim() : "Tech Lead",
    descriptionVI:
      typeof r.descriptionVI === "string" ? r.descriptionVI.trim() : "",
    turns,
    ...(typeof r.isHidden === "boolean" ? { isHidden: r.isHidden } : {}),
    ...(typeof r.isCustom === "boolean" ? { isCustom: r.isCustom } : {}),
    ...(targetRoles && targetRoles.length > 0 ? { targetRoles } : {}),
  };
}

function sanitizeVocab(raw: unknown): VocabularyItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : "";
  const term = typeof r.term === "string" ? r.term.trim() : "";
  if (!id || !term) return null;

  return {
    id,
    term,
    phonetic: typeof r.phonetic === "string" ? r.phonetic.trim() : "",
    partOfSpeech:
      typeof r.partOfSpeech === "string" && r.partOfSpeech.trim()
        ? r.partOfSpeech.trim()
        : "noun",
    meaningVI: typeof r.meaningVI === "string" ? r.meaningVI.trim() : "",
    exampleSentenceEN:
      typeof r.exampleSentenceEN === "string" ? r.exampleSentenceEN.trim() : "",
    exampleTranslationVI:
      typeof r.exampleTranslationVI === "string"
        ? r.exampleTranslationVI.trim()
        : "",
  };
}

function sanitizeBugChallenge(raw: unknown): BugBusterChallenge | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : "";
  const promptEN = typeof r.promptEN === "string" ? r.promptEN.trim() : "";
  const targetWord = typeof r.targetWord === "string" ? r.targetWord.trim() : "";
  if (!id || !promptEN || !targetWord) return null;

  const category = VALID_BUG_CATEGORIES.has(
    r.category as BugBusterChallenge["category"]
  )
    ? (r.category as BugBusterChallenge["category"])
    : "incident";

  return {
    id,
    category,
    promptEN,
    targetWord,
    acceptedVariants: toStringList(r.acceptedVariants),
    contextVI: typeof r.contextVI === "string" ? r.contextVI.trim() : "",
    phonetic: typeof r.phonetic === "string" ? r.phonetic.trim() : "",
  };
}

/**
 * Validates and normalizes untrusted JSON overrides into a safe AdminContentOverrides shape.
 */
export function normalizeContentOverrides(raw: unknown): AdminContentOverrides {
  if (!raw || typeof raw !== "object") return createEmptyContentOverrides();
  const r = raw as Record<string, unknown>;

  const sanitizeList = <T>(
    arr: unknown,
    mapper: (item: unknown) => T | null
  ): T[] =>
    Array.isArray(arr)
      ? arr.map(mapper).filter((item): item is T => item !== null)
      : [];

  return {
    customScenarios: sanitizeList(r.customScenarios, sanitizeScenario),
    hiddenScenarioIds: toStringList(r.hiddenScenarioIds),
    customVocabulary: sanitizeList(r.customVocabulary, sanitizeVocab),
    deletedVocabIds: toStringList(r.deletedVocabIds),
    customBugChallenges: sanitizeList(r.customBugChallenges, sanitizeBugChallenge),
    deletedChallengeIds: toStringList(r.deletedChallengeIds),
  };
}

function mergeById<T extends { id: string }>(
  base: T[],
  custom: T[],
  deletedIds: string[]
): T[] {
  const deletedSet = new Set(deletedIds);
  const customMap = new Map<string, T>();
  for (const item of custom) {
    if (!deletedSet.has(item.id)) {
      customMap.set(item.id, item);
    }
  }

  const baseIds = new Set<string>();
  const result: T[] = [];
  for (const item of base) {
    baseIds.add(item.id);
    if (deletedSet.has(item.id)) continue;
    result.push(customMap.get(item.id) ?? item);
  }

  for (const item of Array.from(customMap.values())) {
    if (!baseIds.has(item.id)) {
      result.push(item);
    }
  }
  return result;
}

export function mergeScenarios(
  base: Scenario[],
  overrides: AdminContentOverrides,
  includeHidden = false
): Scenario[] {
  const baseIds = new Set(base.map((s) => s.id));
  const hiddenSet = new Set(overrides.hiddenScenarioIds);
  const merged = mergeById(base, overrides.customScenarios, []).map((s) => {
    const isHidden = Boolean(s.isHidden || hiddenSet.has(s.id));
    const isCustom = s.isCustom ?? (!baseIds.has(s.id) ? true : undefined);
    if (!isHidden && isCustom === undefined) return s;
    return {
      ...s,
      ...(isHidden ? { isHidden: true } : {}),
      ...(isCustom !== undefined ? { isCustom } : {}),
    };
  });
  return includeHidden ? merged : merged.filter((s) => !s.isHidden);
}

export function mergeVocabulary(
  base: VocabularyItem[],
  overrides: AdminContentOverrides
): VocabularyItem[] {
  return mergeById(base, overrides.customVocabulary, overrides.deletedVocabIds);
}

export function mergeBugChallenges(
  base: BugBusterChallenge[],
  overrides: AdminContentOverrides
): BugBusterChallenge[] {
  return mergeById(
    base,
    overrides.customBugChallenges,
    overrides.deletedChallengeIds
  );
}

function csvCell(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/**
 * Exports research telemetry as UTF-8 BOM RFC 4180 CSV so Excel renders Vietnamese cleanly.
 */
export function buildResearchCsv(
  attempts: PracticeAttempt[],
  arenaRuns: Array<ArenaRunRecord | GameScoreEntry>,
  weakPoints: WeakPoint[]
): string {
  const header = [
    "record_type",
    "id",
    "timestamp",
    "role",
    "scenario_or_game",
    "turn_or_kind",
    "score_or_miss_count",
    "accuracy_or_words",
    "duration_sec",
    "keywords_or_value",
    "transcript",
  ];

  const rows: unknown[][] = [header];

  for (const a of attempts) {
    const keywords = Array.isArray(a.keywords_used) ? a.keywords_used : [];
    rows.push([
      "practice_attempt",
      a.id,
      a.created_at,
      a.role ?? "",
      a.scenario,
      a.turn_index,
      a.score,
      keywords.length,
      "",
      keywords.join("; "),
      a.transcript,
    ]);
  }

  for (const run of arenaRuns) {
    const snake = run as ArenaRunRecord;
    const camel = run as GameScoreEntry;
    rows.push([
      "arena_run",
      run.id,
      snake.created_at ?? camel.createdAt ?? "",
      run.role ?? "",
      snake.game_id ?? camel.gameId ?? "",
      "minigame",
      run.score,
      snake.accuracy_or_words ?? camel.accuracyOrWords ?? 0,
      snake.duration_sec ?? camel.durationSec ?? 0,
      "",
      "",
    ]);
  }

  for (const wp of weakPoints) {
    rows.push([
      "weak_point",
      wp.id,
      wp.updated_at,
      "",
      "",
      wp.kind,
      wp.miss_count,
      "",
      "",
      wp.value,
      "",
    ]);
  }

  return "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

function dispatchContentUpdate(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(CONTENT_UPDATED_EVENT));
  } catch {
    // ignore in restricted environments
  }
}

export function getLocalContentOverrides(): AdminContentOverrides {
  if (typeof window === "undefined") return createEmptyContentOverrides();
  try {
    const raw = window.localStorage.getItem(CONTENT_STORAGE_KEY);
    if (!raw) return createEmptyContentOverrides();
    return normalizeContentOverrides(JSON.parse(raw));
  } catch {
    return createEmptyContentOverrides();
  }
}

export function saveLocalContentOverrides(
  overrides: AdminContentOverrides
): AdminContentOverrides {
  const normalized = normalizeContentOverrides(overrides);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        CONTENT_STORAGE_KEY,
        JSON.stringify(normalized)
      );
    } catch {
      // ignore quota errors
    }
    dispatchContentUpdate();
  }
  return normalized;
}

export function getEffectiveScenarios(includeHidden = false): Scenario[] {
  return mergeScenarios(SCENARIOS, getLocalContentOverrides(), includeHidden);
}

export function getEffectiveVocabulary(): VocabularyItem[] {
  return mergeVocabulary(VOCABULARY_LIST, getLocalContentOverrides());
}

export function getEffectiveBugChallenges(): BugBusterChallenge[] {
  return mergeBugChallenges(BUG_BUSTER_CHALLENGES, getLocalContentOverrides());
}

export async function fetchAndCachePublicContent(): Promise<{
  overrides: AdminContentOverrides;
  source: "neon" | "default";
}> {
  if (typeof window === "undefined" || typeof window.fetch !== "function") {
    return { overrides: createEmptyContentOverrides(), source: "default" };
  }

  try {
    const res = await window.fetch("/api/content", { cache: "no-store" });
    if (!res.ok) {
      return { overrides: getLocalContentOverrides(), source: "default" };
    }
    const data = (await res.json()) as {
      overrides?: unknown;
      source?: "neon" | "default";
    };
    const normalized = normalizeContentOverrides(data?.overrides);
    const source = data?.source === "neon" ? "neon" : "default";
    let hasLocal = false;
    try {
      hasLocal = window.localStorage.getItem(CONTENT_STORAGE_KEY) !== null;
    } catch {
      hasLocal = false;
    }
    if (source === "neon" || !hasLocal) {
      saveLocalContentOverrides(normalized);
      return { overrides: normalized, source };
    }
    dispatchContentUpdate();
    return { overrides: getLocalContentOverrides(), source };
  } catch {
    return { overrides: getLocalContentOverrides(), source: "default" };
  }
}

import {
  DevTitle,
  GameScoreEntry,
  GamificationState,
  ITRole,
  VocabularyItem,
} from "./types";
import { VOCABULARY_LIST } from "../data/scenarios";

export const GAMIFICATION_STORAGE_KEY = "speakit_gamification_v1";
export const GAMIFICATION_UPDATED_EVENT = "speakit:gamification-updated";
export const POINTS_PER_COIN = 1000;

const MS_PER_DAY = 86_400_000;
const VALID_ROLES = new Set<ITRole>(["frontend", "backend", "qa", "devops"]);

function createDefaultState(): GamificationState {
  return {
    totalPoints: 0,
    streakDays: 0,
    lastPracticeDate: null,
    selectedRole: "frontend",
    personalBests: {
      "bug-buster": 0,
      "standup-speed-run": 0,
    },
    history: [],
  };
}

function nonNegativeInt(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

function parseIsoDateUtc(dateStr: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const d = new Date(ms);
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return ms;
}

function getLocalTodayDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dispatchGamificationUpdate(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(GAMIFICATION_UPDATED_EVENT));
  } catch {
    // ignore event errors in restricted environments
  }
}

function saveAndNotify(state: GamificationState): GamificationState {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        GAMIFICATION_STORAGE_KEY,
        JSON.stringify(state)
      );
    } catch {
      // ignore quota errors
    }
    dispatchGamificationUpdate();
  }
  return state;
}

export function calculateCoins(totalPoints: number): number {
  const safe = Number.isFinite(totalPoints) ? Math.max(0, totalPoints) : 0;
  return Math.floor(safe / POINTS_PER_COIN);
}

export function pointsToNextCoin(totalPoints: number): number {
  const safe = Number.isFinite(totalPoints)
    ? Math.max(0, Math.floor(totalPoints))
    : 0;
  return POINTS_PER_COIN - (safe % POINTS_PER_COIN);
}

export function getDevTitle(totalPoints: number): {
  title: DevTitle;
  nextTitle: DevTitle | null;
  nextThreshold: number | null;
  progressPct: number;
} {
  const pts = Number.isFinite(totalPoints) ? Math.max(0, totalPoints) : 0;
  if (pts < 2000) {
    return {
      title: "Junior Speaker",
      nextTitle: "Mid-level Communicator",
      nextThreshold: 2000,
      progressPct: Math.min(100, Math.round((pts / 2000) * 100)),
    };
  }
  if (pts < 5000) {
    return {
      title: "Mid-level Communicator",
      nextTitle: "Lead Tech Speaker",
      nextThreshold: 5000,
      progressPct: Math.min(100, Math.round(((pts - 2000) / 3000) * 100)),
    };
  }
  return {
    title: "Lead Tech Speaker",
    nextTitle: null,
    nextThreshold: null,
    progressPct: 100,
  };
}

export function computeNextStreak(
  prevStreak: number,
  lastDate: string | null,
  todayDate: string
): { streakDays: number; lastPracticeDate: string } {
  const safePrev = nonNegativeInt(prevStreak);
  const todayMs = parseIsoDateUtc(todayDate);
  const lastMs = lastDate ? parseIsoDateUtc(lastDate) : null;

  if (todayMs === null || lastMs === null || !lastDate) {
    return { streakDays: 1, lastPracticeDate: todayDate };
  }

  const diffDays = Math.round((todayMs - lastMs) / MS_PER_DAY);
  if (diffDays === 0) {
    return { streakDays: Math.max(1, safePrev), lastPracticeDate: todayDate };
  }
  if (diffDays === 1) {
    return { streakDays: safePrev + 1, lastPracticeDate: todayDate };
  }
  if (diffDays < 0) {
    // Preserve streak on backward local clock skew instead of resetting.
    return { streakDays: Math.max(1, safePrev), lastPracticeDate: lastDate };
  }
  return { streakDays: 1, lastPracticeDate: todayDate };
}

export function getGamificationState(): GamificationState {
  const defaults = createDefaultState();
  if (typeof window === "undefined") return defaults;

  try {
    const raw = window.localStorage.getItem(GAMIFICATION_STORAGE_KEY);
    if (!raw) return defaults;

    const parsed = JSON.parse(raw) as Partial<GamificationState>;
    const lastPracticeDate =
      typeof parsed.lastPracticeDate === "string" &&
      parseIsoDateUtc(parsed.lastPracticeDate) !== null
        ? parsed.lastPracticeDate
        : null;

    return {
      totalPoints: nonNegativeInt(parsed.totalPoints),
      streakDays: nonNegativeInt(parsed.streakDays),
      lastPracticeDate,
      selectedRole:
        parsed.selectedRole && VALID_ROLES.has(parsed.selectedRole)
          ? parsed.selectedRole
          : defaults.selectedRole,
      personalBests: {
        "bug-buster": nonNegativeInt(parsed.personalBests?.["bug-buster"]),
        "standup-speed-run": nonNegativeInt(
          parsed.personalBests?.["standup-speed-run"]
        ),
      },
      history: Array.isArray(parsed.history) ? parsed.history.slice(0, 20) : [],
    };
  } catch {
    return defaults;
  }
}

export function setSelectedRole(role: ITRole): GamificationState {
  const state = getGamificationState();
  return saveAndNotify({
    ...state,
    selectedRole: role,
  });
}

export function awardPracticePoints(points: number): GamificationState {
  const state = getGamificationState();
  const delta = Number.isFinite(points) ? Math.max(0, Math.round(points)) : 0;
  const streak = computeNextStreak(
    state.streakDays,
    state.lastPracticeDate,
    getLocalTodayDate()
  );

  return saveAndNotify({
    ...state,
    totalPoints: state.totalPoints + delta,
    streakDays: streak.streakDays,
    lastPracticeDate: streak.lastPracticeDate,
  });
}

export function recordMinigameResult(
  entry: Omit<GameScoreEntry, "id" | "createdAt">
): GamificationState {
  const state = getGamificationState();
  const earned = Number.isFinite(entry.score)
    ? Math.max(0, Math.round(entry.score))
    : 0;
  const fullEntry: GameScoreEntry = {
    ...entry,
    score: earned,
    id:
      "game_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 6),
    createdAt: new Date().toISOString(),
  };

  const streak = computeNextStreak(
    state.streakDays,
    state.lastPracticeDate,
    getLocalTodayDate()
  );

  return saveAndNotify({
    ...state,
    totalPoints: state.totalPoints + earned,
    streakDays: streak.streakDays,
    lastPracticeDate: streak.lastPracticeDate,
    personalBests: {
      ...state.personalBests,
      [entry.gameId]: Math.max(state.personalBests[entry.gameId] ?? 0, earned),
    },
    history: [fullEntry, ...state.history].slice(0, 20),
  });
}

export function resetGamificationState(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(GAMIFICATION_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
  dispatchGamificationUpdate();
}

export function suggestWeakVocab(
  missedKeywords: string[],
  scenarioKeywords: string[],
  limit: number = 3
): VocabularyItem[] {
  const max = Math.max(0, Math.min(limit, VOCABULARY_LIST.length));
  if (max === 0) return [];

  const picked: VocabularyItem[] = [];
  const seen = new Set<string>();

  const pickMatching = (keywords: string[]) => {
    for (const raw of keywords) {
      if (picked.length >= max) break;
      const kw = raw.trim().toLowerCase();
      if (!kw) continue;
      const stem = kw.replace(/(ed|ing|es|s)$/, "");

      for (const item of VOCABULARY_LIST) {
        if (seen.has(item.id)) continue;
        const term = item.term.toLowerCase();
        const isMatch =
          term === kw ||
          (kw.length >= 3 && (term.includes(kw) || kw.includes(term))) ||
          (stem.length >= 3 && (term === stem || term.includes(stem)));
        if (isMatch) {
          seen.add(item.id);
          picked.push(item);
          break;
        }
      }
    }
  };

  pickMatching(missedKeywords);
  pickMatching(scenarioKeywords);

  for (const item of VOCABULARY_LIST) {
    if (picked.length >= max) break;
    if (!seen.has(item.id)) {
      seen.add(item.id);
      picked.push(item);
    }
  }

  return picked;
}

import { findCosmeticById } from "./cosmetics";
import type { PublicGuestPlayer } from "./db";
import { calculateCoins, getDevTitle, pointsToNextCoin } from "./gamification";
import type {
  GameScoreEntry,
  GamificationState,
  PracticeAttempt,
  WeakPoint,
} from "./types";

export interface ResolvedProfileIdentity {
  displayName: string;
  avatarUrl: string | null;
  itCoins: number;
  totalPoints: number;
  streakDays: number;
  equippedTitle: string;
  equippedRing: string;
  ownedItems: string[];
  transferCode: string | null;
  mode: "online" | "offline";
}

export interface ProfileActivitySummary {
  totalAttempts: number;
  averageScore: number;
  bestScore: number;
  scenariosPracticed: number;
  topWeakPoints: WeakPoint[];
  recentAttempts: PracticeAttempt[];
  bugBusterBest: number;
  standupBest: number;
  recentArenaRuns: GameScoreEntry[];
  devTitle: ReturnType<typeof getDevTitle>;
  nextCoinPoints: number;
}

function compareIsoDesc(a: string, b: string): number {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  const aOk = Number.isFinite(ta);
  const bOk = Number.isFinite(tb);
  if (aOk && bOk) return tb - ta;
  if (aOk !== bOk) return bOk ? 1 : -1;
  return b.localeCompare(a);
}

export function normalizeBugBusterAccuracy(
  score: number,
  accuracyOrWords: number
): number {
  if (score < 150 || accuracyOrWords < 1 || accuracyOrWords > 14) {
    return accuracyOrWords;
  }
  // Legacy runs stored raw fixed bug count (1..14), where each fixed bug awards >= 150 pts.
  if (score < accuracyOrWords * 150) {
    return accuracyOrWords;
  }
  return Math.round((accuracyOrWords / 14) * 100);
}

export function normalizeArenaHistory(
  history: GameScoreEntry[]
): GameScoreEntry[] {
  const seenIds = new Set<string>();
  const normalized: GameScoreEntry[] = [];

  for (const run of history) {
    if (!run || typeof run.id !== "string" || !run.id || seenIds.has(run.id)) {
      continue;
    }
    seenIds.add(run.id);
    const safeScore = Number.isFinite(run.score)
      ? Math.max(0, Math.round(run.score))
      : 0;
    const rawMetric = Number.isFinite(run.accuracyOrWords)
      ? Math.max(0, Math.round(run.accuracyOrWords))
      : 0;
    const accuracyOrWords =
      run.gameId === "bug-buster"
        ? normalizeBugBusterAccuracy(safeScore, rawMetric)
        : rawMetric;
    const durationSec = Number.isFinite(run.durationSec)
      ? Math.max(0, Math.round(run.durationSec))
      : 0;

    normalized.push({
      ...run,
      score: safeScore,
      accuracyOrWords,
      durationSec,
    });
  }

  return normalized.sort((a, b) => {
    const cmp = compareIsoDesc(a.createdAt, b.createdAt);
    return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
  });
}

export function calculateSpentCosmeticCoins(
  ownedItems: readonly string[]
): number {
  const seen = new Set<string>();
  let spent = 0;
  for (const itemId of ownedItems) {
    if (typeof itemId !== "string" || seen.has(itemId)) continue;
    seen.add(itemId);
    const item = findCosmeticById(itemId);
    if (item && Number.isFinite(item.price) && item.price > 0) {
      spent += item.price;
    }
  }
  return spent;
}

export function resolveConsistentItCoins(
  rawCoins: number,
  totalPoints: number,
  ownedItems: readonly string[]
): number {
  const safeCoins = Number.isFinite(rawCoins)
    ? Math.max(0, Math.floor(rawCoins))
    : 0;
  const safePoints = Number.isFinite(totalPoints)
    ? Math.max(0, Math.floor(totalPoints))
    : 0;
  const earnedCoins = calculateCoins(safePoints);
  const spentCoins = calculateSpentCosmeticCoins(ownedItems);
  const reconciledCoins = Math.max(0, earnedCoins - spentCoins);
  return Math.max(safeCoins, reconciledCoins);
}

export function mergeProfileIdentity(
  guestPlayer: PublicGuestPlayer | null,
  gamification: GamificationState
): ResolvedProfileIdentity {
  if (guestPlayer) {
    const ownedItems = [...guestPlayer.ownedItems];
    const itCoins = resolveConsistentItCoins(
      guestPlayer.itCoins,
      guestPlayer.totalPoints,
      ownedItems
    );
    return {
      displayName: guestPlayer.displayName,
      avatarUrl: guestPlayer.avatarUrl ?? null,
      itCoins,
      totalPoints: guestPlayer.totalPoints,
      streakDays: guestPlayer.streakDays,
      equippedTitle: guestPlayer.equippedTitle,
      equippedRing: guestPlayer.equippedRing,
      ownedItems,
      transferCode: guestPlayer.transferCode,
      mode: "online",
    };
  }

  return {
    displayName: "Local Developer",
    avatarUrl: null,
    itCoins: calculateCoins(gamification.totalPoints),
    totalPoints: gamification.totalPoints,
    streakDays: gamification.streakDays,
    equippedTitle: getDevTitle(gamification.totalPoints).title,
    equippedRing: "default",
    ownedItems: [],
    transferCode: null,
    mode: "offline",
  };
}

/**
 * Computes speaking metrics, top weak points, recent attempts, arena personal bests, and progression from activity data.
 */
export function summarizeProfileActivity(
  attempts: PracticeAttempt[],
  weakPoints: WeakPoint[],
  gamification: GamificationState,
  totalPointsOverride?: number
): ProfileActivitySummary {
  const totalAttempts = attempts.length;
  let scoreSum = 0;
  let bestScore = 0;
  const scenarios = new Set<string>();

  for (const attempt of attempts) {
    const score = Number.isFinite(attempt.score) ? attempt.score : 0;
    scoreSum += score;
    if (score > bestScore) {
      bestScore = score;
    }
    scenarios.add(attempt.scenario);
  }

  const averageScore =
    totalAttempts > 0 ? Math.round(scoreSum / totalAttempts) : 0;

  const topWeakPoints = [...weakPoints]
    .sort((a, b) => b.miss_count - a.miss_count)
    .slice(0, 6);

  const recentAttempts = [...attempts]
    .sort((a, b) => compareIsoDesc(a.created_at, b.created_at))
    .slice(0, 5);

  const effectivePoints =
    typeof totalPointsOverride === "number" && Number.isFinite(totalPointsOverride)
      ? Math.max(0, totalPointsOverride)
      : gamification.totalPoints;

  return {
    totalAttempts,
    averageScore,
    bestScore,
    scenariosPracticed: scenarios.size,
    topWeakPoints,
    recentAttempts,
    bugBusterBest: gamification.personalBests["bug-buster"] ?? 0,
    standupBest: gamification.personalBests["standup-speed-run"] ?? 0,
    recentArenaRuns: gamification.history.slice(0, 5),
    devTitle: getDevTitle(effectivePoints),
    nextCoinPoints: pointsToNextCoin(effectivePoints),
  };
}

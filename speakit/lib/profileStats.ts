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

/**
 * Resolves profile identity fields from the online Neon guest session or falls back to local gamification state.
 */
export function mergeProfileIdentity(
  guestPlayer: PublicGuestPlayer | null,
  gamification: GamificationState
): ResolvedProfileIdentity {
  if (guestPlayer) {
    return {
      displayName: guestPlayer.displayName,
      itCoins: guestPlayer.itCoins,
      totalPoints: guestPlayer.totalPoints,
      streakDays: guestPlayer.streakDays,
      equippedTitle: guestPlayer.equippedTitle,
      equippedRing: guestPlayer.equippedRing,
      ownedItems: [...guestPlayer.ownedItems],
      transferCode: guestPlayer.transferCode,
      mode: "online",
    };
  }

  return {
    displayName: "Local Developer",
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

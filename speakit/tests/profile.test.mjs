import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const jiti = require("jiti")(__filename);

const { mergeProfileIdentity, summarizeProfileActivity } = jiti(
  resolve(__dirname, "../lib/profileStats.ts")
);

function makeGamificationState(overrides = {}) {
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
    ...overrides,
  };
}

test("mergeProfileIdentity prefers online PublicGuestPlayer fields and isolates ownedItems", () => {
  const guestPlayer = {
    id: "guest-123",
    transferCode: "DEV-AB12CD",
    displayName: "Backend Architect",
    itCoins: 9,
    totalPoints: 9420,
    streakDays: 14,
    lastPracticeDate: "2026-11-12",
    equippedTitle: "Bug Whisperer",
    equippedRing: "ring-crimson",
    ownedItems: ["title-bug-whisperer", "ring-crimson"],
  };

  const gamification = makeGamificationState({
    totalPoints: 500,
    streakDays: 1,
  });

  const resolved = mergeProfileIdentity(guestPlayer, gamification);

  assert.deepEqual(resolved, {
    displayName: "Backend Architect",
    itCoins: 9,
    totalPoints: 9420,
    streakDays: 14,
    equippedTitle: "Bug Whisperer",
    equippedRing: "ring-crimson",
    ownedItems: ["title-bug-whisperer", "ring-crimson"],
    transferCode: "DEV-AB12CD",
    mode: "online",
  });

  resolved.ownedItems.push("extra");
  assert.deepEqual(guestPlayer.ownedItems, [
    "title-bug-whisperer",
    "ring-crimson",
  ]);
});

test("mergeProfileIdentity falls back to offline local gamification state when guestPlayer is null", () => {
  const junior = mergeProfileIdentity(
    null,
    makeGamificationState({ totalPoints: 850, streakDays: 2 })
  );
  assert.deepEqual(junior, {
    displayName: "Local Developer",
    itCoins: 0,
    totalPoints: 850,
    streakDays: 2,
    equippedTitle: "Junior Speaker",
    equippedRing: "default",
    ownedItems: [],
    transferCode: null,
    mode: "offline",
  });

  const lead = mergeProfileIdentity(
    null,
    makeGamificationState({ totalPoints: 5400, streakDays: 7 })
  );
  assert.deepEqual(lead, {
    displayName: "Local Developer",
    itCoins: 5,
    totalPoints: 5400,
    streakDays: 7,
    equippedTitle: "Lead Tech Speaker",
    equippedRing: "default",
    ownedItems: [],
    transferCode: null,
    mode: "offline",
  });
});

test("summarizeProfileActivity returns zeroed metrics on empty inputs", () => {
  const summary = summarizeProfileActivity([], [], makeGamificationState());

  assert.equal(summary.totalAttempts, 0);
  assert.equal(summary.averageScore, 0);
  assert.equal(summary.bestScore, 0);
  assert.equal(summary.scenariosPracticed, 0);
  assert.deepEqual(summary.topWeakPoints, []);
  assert.deepEqual(summary.recentAttempts, []);
  assert.equal(summary.bugBusterBest, 0);
  assert.equal(summary.standupBest, 0);
  assert.deepEqual(summary.recentArenaRuns, []);
  assert.deepEqual(summary.devTitle, {
    title: "Junior Speaker",
    nextTitle: "Mid-level Communicator",
    nextThreshold: 2000,
    progressPct: 0,
  });
  assert.equal(summary.nextCoinPoints, 1000);
});

test("summarizeProfileActivity computes aggregates and sorts without mutating inputs", () => {
  const attempts = [
    {
      id: "a1",
      scenario: "daily-standup",
      turn_index: 0,
      transcript: "Working on API",
      score: 70,
      keywords_used: ["blocker"],
      created_at: "2026-11-10T08:00:00Z",
    },
    {
      id: "a2",
      scenario: "bug-report",
      turn_index: 1,
      transcript: "Reproduced timeout",
      score: 94,
      keywords_used: ["latency"],
      created_at: "2026-11-12T09:30:00Z",
    },
    {
      id: "a3",
      scenario: "code-review",
      turn_index: 0,
      transcript: "Suggest extracting helper",
      score: 81,
      keywords_used: ["refactor"],
      created_at: "2026-11-11T12:00:00Z",
    },
    {
      id: "a4",
      scenario: "daily-standup",
      turn_index: 1,
      transcript: "Deploy queued",
      score: 88,
      keywords_used: ["deploy"],
      created_at: "2026-11-12T10:00:00+02:00", // 08:00:00Z
    },
    {
      id: "a5",
      scenario: "bug-report",
      turn_index: 2,
      transcript: "Added regression test",
      score: 76,
      keywords_used: ["regression"],
      created_at: "2026-11-12T09:00:00Z",
    },
    {
      id: "a6",
      scenario: "code-review",
      turn_index: 1,
      transcript: "Edge case covered",
      score: 85,
      keywords_used: ["edge case"],
      created_at: "2026-11-09T15:00:00Z",
    },
    {
      id: "a7",
      scenario: "daily-standup",
      turn_index: 2,
      transcript: "No blockers today",
      score: 90,
      keywords_used: ["milestone"],
      created_at: "2026-11-12T10:15:00Z",
    },
  ];
  const attemptsSnapshot = structuredClone(attempts);

  const weakPoints = [
    { id: "w1", kind: "keyword", value: "idempotent", miss_count: 2, updated_at: "2026-11-10T00:00:00Z" },
    { id: "w2", kind: "keyword", value: "rollback", miss_count: 8, updated_at: "2026-11-12T00:00:00Z" },
    { id: "w3", kind: "grammar", value: "past tense", miss_count: 5, updated_at: "2026-11-11T00:00:00Z" },
    { id: "w4", kind: "keyword", value: "bottleneck", miss_count: 1, updated_at: "2026-11-08T00:00:00Z" },
    { id: "w5", kind: "keyword", value: "latency", miss_count: 6, updated_at: "2026-11-12T00:00:00Z" },
    { id: "w6", kind: "keyword", value: "throughput", miss_count: 4, updated_at: "2026-11-11T00:00:00Z" },
    { id: "w7", kind: "keyword", value: "mitigate", miss_count: 9, updated_at: "2026-11-12T00:00:00Z" },
    { id: "w8", kind: "grammar", value: "articles", miss_count: 3, updated_at: "2026-11-09T00:00:00Z" },
  ];
  const weakPointsSnapshot = structuredClone(weakPoints);

  const history = Array.from({ length: 7 }, (_, i) => ({
    id: `run-${i + 1}`,
    gameId: i % 2 === 0 ? "bug-buster" : "standup-speed-run",
    score: 500 + i * 50,
    accuracyOrWords: 8 + i,
    durationSec: 45,
    role: "backend",
    createdAt: `2026-11-12T0${i}:00:00Z`,
  }));

  const gamification = makeGamificationState({
    totalPoints: 1450,
    personalBests: {
      "bug-buster": 1120,
      "standup-speed-run": 860,
    },
    history,
  });

  const summary = summarizeProfileActivity(attempts, weakPoints, gamification);

  assert.equal(summary.totalAttempts, 7);
  // (70 + 94 + 81 + 88 + 76 + 85 + 90) / 7 = 584 / 7 = 83.428... -> 83
  assert.equal(summary.averageScore, 83);
  assert.equal(summary.bestScore, 94);
  assert.equal(summary.scenariosPracticed, 3);

  assert.deepEqual(
    summary.topWeakPoints.map((w) => w.id),
    ["w7", "w2", "w5", "w3", "w6", "w8"]
  );
  assert.deepEqual(
    summary.recentAttempts.map((a) => a.id),
    ["a7", "a2", "a5", "a4", "a3"]
  );

  assert.equal(summary.bugBusterBest, 1120);
  assert.equal(summary.standupBest, 860);
  assert.deepEqual(
    summary.recentArenaRuns.map((r) => r.id),
    ["run-1", "run-2", "run-3", "run-4", "run-5"]
  );

  // Inputs remain untouched
  assert.deepEqual(attempts, attemptsSnapshot);
  assert.deepEqual(weakPoints, weakPointsSnapshot);
  assert.equal(gamification.history.length, 7);
});

test("summarizeProfileActivity applies totalPointsOverride for devTitle and nextCoinPoints", () => {
  const gamification = makeGamificationState({ totalPoints: 400 });

  const overridden = summarizeProfileActivity([], [], gamification, 3450);
  assert.equal(overridden.devTitle.title, "Mid-level Communicator");
  assert.equal(overridden.devTitle.nextTitle, "Lead Tech Speaker");
  assert.equal(overridden.nextCoinPoints, 550);

  const clampedNegative = summarizeProfileActivity([], [], gamification, -250);
  assert.equal(clampedNegative.devTitle.title, "Junior Speaker");
  assert.equal(clampedNegative.nextCoinPoints, 1000);

  const ignoredNonFinite = summarizeProfileActivity(
    [],
    [],
    gamification,
    Number.NaN
  );
  assert.equal(ignoredNonFinite.devTitle.title, "Junior Speaker");
  assert.equal(ignoredNonFinite.nextCoinPoints, 600);
});

import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const jiti = require("jiti")(__filename);

const {
  GAMIFICATION_STORAGE_KEY,
  GAMIFICATION_UPDATED_EVENT,
  POINTS_PER_COIN,
  calculateCoins,
  pointsToNextCoin,
  getDevTitle,
  computeNextStreak,
  getGamificationState,
  setSelectedRole,
  awardPracticePoints,
  recordMinigameResult,
  resetGamificationState,
  suggestWeakVocab,
} = jiti(resolve(__dirname, "../lib/gamification.ts"));

const {
  IT_ROLES,
  BUG_BUSTER_CHALLENGES,
  STANDUP_SPEED_QUESTIONS,
  checkBugBusterAnswer,
} = jiti(resolve(__dirname, "../data/minigames.ts"));

const { EF_EPI_2025 } = jiti(resolve(__dirname, "../data/efEpiData.ts"));

function installWindowMock() {
  const prevWindow = globalThis.window;
  const prevCustomEvent = globalThis.CustomEvent;
  const store = new Map();
  const dispatchedEvents = [];

  class MockCustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  }

  globalThis.CustomEvent = MockCustomEvent;
  globalThis.window = {
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => {
        store.set(key, String(value));
      },
      removeItem: (key) => {
        store.delete(key);
      },
    },
    dispatchEvent: (event) => {
      dispatchedEvents.push(event.type);
      return true;
    },
  };

  return {
    store,
    dispatchedEvents,
    restore() {
      if (prevWindow === undefined) {
        delete globalThis.window;
      } else {
        globalThis.window = prevWindow;
      }
      if (prevCustomEvent === undefined) {
        delete globalThis.CustomEvent;
      } else {
        globalThis.CustomEvent = prevCustomEvent;
      }
    },
  };
}

test("calculateCoins converts 1000 points per coin and clamps negatives", () => {
  assert.equal(POINTS_PER_COIN, 1000);
  assert.equal(calculateCoins(0), 0);
  assert.equal(calculateCoins(999), 0);
  assert.equal(calculateCoins(1000), 1);
  assert.equal(calculateCoins(2500), 2);
  assert.equal(calculateCoins(-150), 0);
  assert.equal(calculateCoins(Number.NaN), 0);
});

test("pointsToNextCoin computes remaining points to next 1000-point coin threshold", () => {
  assert.equal(pointsToNextCoin(0), 1000);
  assert.equal(pointsToNextCoin(1), 999);
  assert.equal(pointsToNextCoin(999), 1);
  assert.equal(pointsToNextCoin(1000), 1000);
  assert.equal(pointsToNextCoin(2500), 500);
  assert.equal(pointsToNextCoin(-50), 1000);
});

test("getDevTitle enforces Junior Speaker, Mid-level Communicator, and Lead Tech Speaker thresholds", () => {
  const tier1Low = getDevTitle(0);
  assert.equal(tier1Low.title, "Junior Speaker");
  assert.equal(tier1Low.nextTitle, "Mid-level Communicator");
  assert.equal(tier1Low.nextThreshold, 2000);
  assert.equal(tier1Low.progressPct, 0);

  const tier1Edge = getDevTitle(1999);
  assert.equal(tier1Edge.title, "Junior Speaker");
  assert.equal(tier1Edge.nextTitle, "Mid-level Communicator");

  const tier2Start = getDevTitle(2000);
  assert.equal(tier2Start.title, "Mid-level Communicator");
  assert.equal(tier2Start.nextTitle, "Lead Tech Speaker");
  assert.equal(tier2Start.nextThreshold, 5000);
  assert.equal(tier2Start.progressPct, 0);

  const tier2Edge = getDevTitle(4999);
  assert.equal(tier2Edge.title, "Mid-level Communicator");
  assert.equal(tier2Edge.nextTitle, "Lead Tech Speaker");

  const tier3Start = getDevTitle(5000);
  assert.equal(tier3Start.title, "Lead Tech Speaker");
  assert.equal(tier3Start.nextTitle, null);
  assert.equal(tier3Start.nextThreshold, null);
  assert.equal(tier3Start.progressPct, 100);

  const tier3High = getDevTitle(9500);
  assert.equal(tier3High.title, "Lead Tech Speaker");
  assert.equal(tier3High.progressPct, 100);
});

test("computeNextStreak handles first day, same day, consecutive day, and skipped day", () => {
  assert.deepEqual(computeNextStreak(0, null, "2026-11-12"), {
    streakDays: 1,
    lastPracticeDate: "2026-11-12",
  });

  assert.deepEqual(computeNextStreak(4, "2026-11-12", "2026-11-12"), {
    streakDays: 4,
    lastPracticeDate: "2026-11-12",
  });

  assert.deepEqual(computeNextStreak(4, "2026-11-11", "2026-11-12"), {
    streakDays: 5,
    lastPracticeDate: "2026-11-12",
  });

  assert.deepEqual(computeNextStreak(4, "2026-11-10", "2026-11-12"), {
    streakDays: 1,
    lastPracticeDate: "2026-11-12",
  });
});

test("suggestWeakVocab prioritizes missed keywords and fills up to 3 distinct items safely", () => {
  const emptyResult = suggestWeakVocab([], []);
  assert.equal(emptyResult.length, 3);
  assert.equal(new Set(emptyResult.map((i) => i.id)).size, 3);

  const matched = suggestWeakVocab(["blockers", "deployed"], ["refactor"]);
  assert.equal(matched.length, 3);
  assert.deepEqual(
    matched.map((i) => i.term),
    ["blocker", "deploy", "refactor"]
  );
  assert.equal(new Set(matched.map((i) => i.id)).size, 3);
});

test("checkBugBusterAnswer validates exact matches, variants, case-insensitivity, and rejects empty/wrong answers", () => {
  const rollbackChallenge = BUG_BUSTER_CHALLENGES.find(
    (c) => c.targetWord === "rollback"
  );
  assert.ok(rollbackChallenge);
  assert.equal(BUG_BUSTER_CHALLENGES.length >= 12, true);
  assert.equal(IT_ROLES.length, 4);
  assert.equal(STANDUP_SPEED_QUESTIONS.length, 3);
  assert.equal(
    STANDUP_SPEED_QUESTIONS.every((q) => q.timeLimitSec === 25),
    true
  );

  assert.equal(checkBugBusterAnswer("rollback", rollbackChallenge), true);
  assert.equal(checkBugBusterAnswer("ROLLBACK", rollbackChallenge), true);
  assert.equal(
    checkBugBusterAnswer("Trigger a roll back now!", rollbackChallenge),
    true
  );
  assert.equal(checkBugBusterAnswer("rolled back", rollbackChallenge), true);
  assert.equal(checkBugBusterAnswer("", rollbackChallenge), false);
  assert.equal(checkBugBusterAnswer("   ...  ", rollbackChallenge), false);
  assert.equal(checkBugBusterAnswer("back", rollbackChallenge), false);
  assert.equal(checkBugBusterAnswer("schema", rollbackChallenge), false);
});

test("awardPracticePoints, recordMinigameResult, setSelectedRole, and resetGamificationState persist to localStorage and emit update events", () => {
  const mock = installWindowMock();
  try {
    const initial = getGamificationState();
    assert.equal(initial.totalPoints, 0);
    assert.equal(initial.streakDays, 0);
    assert.equal(initial.selectedRole, "frontend");

    const roleUpdated = setSelectedRole("devops");
    assert.equal(roleUpdated.selectedRole, "devops");

    const afterPractice = awardPracticePoints(85.4);
    assert.equal(afterPractice.totalPoints, 85);
    assert.equal(afterPractice.streakDays, 1);

    const afterGame1 = recordMinigameResult({
      gameId: "bug-buster",
      score: 950,
      accuracyOrWords: 5,
      durationSec: 60,
      role: "devops",
    });
    assert.equal(afterGame1.totalPoints, 1035);
    assert.equal(afterGame1.personalBests["bug-buster"], 950);
    assert.equal(afterGame1.history.length, 1);
    assert.equal(calculateCoins(afterGame1.totalPoints), 1);

    // Lower score does not overwrite higher personal best
    const afterGame2 = recordMinigameResult({
      gameId: "bug-buster",
      score: 400,
      accuracyOrWords: 2,
      durationSec: 60,
      role: "devops",
    });
    assert.equal(afterGame2.totalPoints, 1435);
    assert.equal(afterGame2.personalBests["bug-buster"], 950);
    assert.equal(afterGame2.history.length, 2);

    assert.ok(mock.store.get(GAMIFICATION_STORAGE_KEY));
    assert.equal(
      mock.dispatchedEvents.filter((e) => e === GAMIFICATION_UPDATED_EVENT).length,
      4
    );

    resetGamificationState();
    assert.equal(mock.store.has(GAMIFICATION_STORAGE_KEY), false);
    const afterReset = getGamificationState();
    assert.equal(afterReset.totalPoints, 0);
    assert.equal(afterReset.streakDays, 0);
    assert.equal(afterReset.history.length, 0);
    assert.equal(
      mock.dispatchedEvents.at(-1),
      GAMIFICATION_UPDATED_EVENT
    );
  } finally {
    mock.restore();
  }
});

test("EF_EPI_2025 benchmark invariants hold with zero IUH attribution", () => {
  assert.equal(EF_EPI_2025.year, 2025);
  assert.equal(EF_EPI_2025.score, 500);
  assert.equal(EF_EPI_2025.globalRank, 64);
  assert.equal(EF_EPI_2025.totalCountries, 123);
  assert.equal(EF_EPI_2025.asiaRank, 7);
  assert.equal(EF_EPI_2025.totalAsiaCountries, 25);
  assert.equal(EF_EPI_2025.skills.speaking, 461);
  assert.equal(EF_EPI_2025.skills.listening, 470);
  assert.equal(EF_EPI_2025.skills.writing, 508);
  assert.equal(EF_EPI_2025.skills.reading, 522);
  assert.equal(/iuh/i.test(EF_EPI_2025.summaryVI), false);
  assert.equal(/iuh/i.test(EF_EPI_2025.sourceCitation), false);
});

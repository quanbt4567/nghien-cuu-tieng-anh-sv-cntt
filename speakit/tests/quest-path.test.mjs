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
  STORY_CHAPTERS,
  DAILY_QUESTS,
  computeQuestStats,
} = jiti(resolve(__dirname, "../lib/questPath.ts"));

test("Duolingo quest path defines 3 chapters with 9 ordered storyline nodes and 3 daily quests", () => {
  assert.equal(STORY_CHAPTERS.length, 3);
  const allNodes = STORY_CHAPTERS.flatMap((c) => c.nodes);
  assert.equal(allNodes.length, 9);
  assert.deepEqual(
    allNodes.map((n) => n.order),
    [1, 2, 3, 4, 5, 6, 7, 8, 9]
  );
  assert.equal(DAILY_QUESTS.length, 3);
});

test("computeQuestStats tracks chapter completion and daily quest counts accurately", () => {
  const emptyStats = computeQuestStats({
    gamification: {
      totalPoints: 0,
      streakDays: 0,
      lastPracticeDate: null,
      selectedRole: "frontend",
      personalBests: { "bug-buster": 0, "standup-speed-run": 0 },
      history: [],
    },
    hasPlacement: false,
    masteredVocabCount: 0,
    todayIso: "2026-11-28",
  });

  assert.equal(STORY_CHAPTERS[0].nodes[0].isCompleted(emptyStats), false);
  assert.equal(DAILY_QUESTS[0].getCurrent(emptyStats), 0);

  const activeStats = computeQuestStats({
    gamification: {
      totalPoints: 1800,
      streakDays: 2,
      lastPracticeDate: "2026-11-28",
      selectedRole: "frontend",
      personalBests: { "bug-buster": 500, "standup-speed-run": 400 },
      history: [
        {
          id: "2",
          gameId: "bug-buster",
          score: 500,
          accuracyOrWords: 8,
          durationSec: 45,
          role: "frontend",
          createdAt: "2026-11-28T10:05:00.000Z",
        },
      ],
    },
    hasPlacement: true,
    masteredVocabCount: 4,
    attemptScenarios: ["daily-standup"],
    attemptDates: ["2026-11-28T10:00:00.000Z"],
    todayIso: "2026-11-28",
  });

  assert.equal(STORY_CHAPTERS[0].nodes[0].isCompleted(activeStats), true);
  assert.equal(STORY_CHAPTERS[0].nodes[1].isCompleted(activeStats), true);
  assert.equal(STORY_CHAPTERS[0].nodes[2].isCompleted(activeStats), true);
  assert.equal(STORY_CHAPTERS[1].nodes[2].isCompleted(activeStats), true);
  assert.equal(DAILY_QUESTS[0].getCurrent(activeStats), 1);
  assert.equal(DAILY_QUESTS[1].getCurrent(activeStats), 3);
  assert.equal(DAILY_QUESTS[2].getCurrent(activeStats), 1);
});

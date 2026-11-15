import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const jiti = require("jiti")(__filename);

const { scoreLocally, stemWord } = jiti(
  resolve(__dirname, "../lib/localScorer.ts")
);
const { generate7DayPlan, isValidKeywordTerm } = jiti(
  resolve(__dirname, "../lib/planGenerator.ts")
);
const { SCENARIOS } = jiti(resolve(__dirname, "../data/scenarios.ts"));
const { resolveConsistentItCoins } = jiti(
  resolve(__dirname, "../lib/neon-auth.ts")
);
const { filterUnusedKeywords } = jiti(
  resolve(__dirname, "../components/feedback/keywordFilter.ts")
);

test("scoreLocally matches inflections for deploy/cache/multi-word phrases", () => {
  assert.equal(stemWord("deployments"), "deploy");
  assert.equal(stemWord("deploying"), "deploy");
  assert.equal(stemWord("deployed"), "deploy");

  const result = scoreLocally({
    transcript:
      "Yesterday we deployed the new caching layer and reviewed two pull requests for the API.",
    expectedKeywords: ["deploy", "cache", "pull request"],
    sampleAnswerEN:
      "Yesterday we deployed the new cache layer and reviewed two pull requests.",
  });

  assert.deepEqual(result.keywordsUsed, ["deploy", "cache", "pull request"]);
  assert.deepEqual(result.keywordsMissed, []);
});

test("generate7DayPlan excludes full sentences from focusKeywords", () => {
  assert.equal(isValidKeywordTerm("deploy"), true);
  assert.equal(isValidKeywordTerm("pull request"), true);
  assert.equal(
    isValidKeywordTerm("Yesterday I fixed the API bug in production."),
    false
  );

  const plan = generate7DayPlan(
    [
      {
        id: "w1",
        kind: "keyword",
        value: "Yesterday I fixed the API bug in production.",
        miss_count: 5,
        updated_at: "2026-11-15T00:00:00Z",
      },
      {
        id: "w2",
        kind: "keyword",
        value: "rollback",
        miss_count: 3,
        updated_at: "2026-11-15T00:00:00Z",
      },
      {
        id: "w3",
        kind: "grammar",
        value: "Thiếu dấu chấm cuối câu.",
        miss_count: 4,
        updated_at: "2026-11-15T00:00:00Z",
      },
    ],
    []
  );

  assert.deepEqual(plan[0].focusKeywords, ["rollback"]);
});

test("SCENARIOS has at least 12 scenarios with >= 4 per level and 3 sequential turns each", () => {
  assert.ok(SCENARIOS.length >= 12, `Expected >= 12 scenarios, got ${SCENARIOS.length}`);

  for (const level of ["Fresher", "Junior", "Senior"]) {
    const levelScenarios = SCENARIOS.filter((s) => s.difficulty === level);
    assert.ok(
      levelScenarios.length >= 4,
      `Expected >= 4 scenarios for ${level}, got ${levelScenarios.length}`
    );
    for (const scenario of levelScenarios) {
      assert.equal(scenario.turns.length, 3, `${scenario.id} should have 3 turns`);
      assert.deepEqual(
        scenario.turns.map((t) => t.turnIndex),
        [0, 1, 2],
        `${scenario.id} turns should have turnIndex [0, 1, 2]`
      );
    }
  }
});

test("resolveConsistentItCoins reconciles earned minus spent cosmetic coins", () => {
  assert.equal(resolveConsistentItCoins(0, 10333, []), 10);
  assert.equal(resolveConsistentItCoins(15, 10333, []), 15);
  assert.equal(resolveConsistentItCoins(2, 10333, ["title-cloud-architect"]), 6);
  assert.equal(resolveConsistentItCoins(0, 10333, ["title-bug-whisperer"]), 9);
});

test("filterUnusedKeywords recognizes multi-word keywords like merge conflict when used across turns", () => {
  const unusedFromUsed = filterUnusedKeywords(
    ["merge conflict", "rollback", "pull request"],
    ["merge conflicts"],
    []
  );
  assert.deepEqual(unusedFromUsed, ["rollback", "pull request"]);

  const unusedFromTranscript = filterUnusedKeywords(
    ["merge conflict", "rollback"],
    [],
    ["In turn two I resolved the merge conflict before pushing."]
  );
  assert.deepEqual(unusedFromTranscript, ["rollback"]);
});

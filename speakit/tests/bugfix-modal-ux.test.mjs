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

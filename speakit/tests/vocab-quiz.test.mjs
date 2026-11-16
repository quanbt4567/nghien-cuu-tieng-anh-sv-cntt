import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const jiti = require("jiti")(__filename);

const { VOCABULARY_LIST } = jiti(resolve(__dirname, "../data/scenarios.ts"));
const { buildVocabQuizQuestions, isVoiceQuizMatch } = jiti(
  resolve(__dirname, "../lib/vocab-quiz.ts")
);

test("buildVocabQuizQuestions generates masked context questions with 4 unique choices", () => {
  const questions = buildVocabQuizQuestions(VOCABULARY_LIST, 5);
  assert.equal(questions.length, 5);

  const seenIds = new Set();
  for (const q of questions) {
    assert.ok(!seenIds.has(q.id));
    seenIds.add(q.id);
    assert.ok(q.prompt.includes("____"));
    assert.equal(q.meaningHint, q.item.meaningVI);
    assert.equal(q.targetTerm, q.item.term);
    assert.equal(q.choices.length, 4);
    assert.equal(new Set(q.choices).size, 4);
    assert.ok(q.choices.includes(q.targetTerm));
  }
});

test("buildVocabQuizQuestions handles empty, zero count, small lists, and missing term in sentence", () => {
  assert.deepEqual(buildVocabQuizQuestions([], 5), []);
  assert.deepEqual(buildVocabQuizQuestions(VOCABULARY_LIST, 0), []);

  const small = [
    {
      id: "c1",
      term: "CI/CD",
      phonetic: "/ˌsiː.aɪ.siːˈdiː/",
      partOfSpeech: "noun",
      meaningVI: "Tích hợp và triển khai liên tục",
      exampleSentenceEN: "Automated pipelines speed up releases.",
      exampleTranslationVI: "Pipeline tự động giúp tăng tốc phát hành.",
    },
    {
      id: "c2",
      term: "hotfix",
      phonetic: "/ˈhɒt.fɪks/",
      partOfSpeech: "noun",
      meaningVI: "Bản vá lỗi khẩn cấp",
      exampleSentenceEN: "We shipped a hotfix to production.",
      exampleTranslationVI: "Chúng tôi đã đẩy bản vá khẩn cấp lên production.",
    },
  ];

  const questions = buildVocabQuizQuestions(small, 5);
  assert.equal(questions.length, 2);
  for (const q of questions) {
    assert.ok(q.prompt.includes("____"));
    assert.equal(q.choices.length, 2);
    assert.ok(q.choices.includes(q.targetTerm));
  }
});

test("isVoiceQuizMatch matches exact, phrased, punctuation, and STT split-word variations", () => {
  assert.equal(isVoiceQuizMatch("deploy", "deploy"), true);
  assert.equal(isVoiceQuizMatch("  Pull Request! ", "pull request"), true);
  assert.equal(isVoiceQuizMatch("I think it is merge conflict", "merge conflict"), true);
  assert.equal(isVoiceQuizMatch("stand up", "standup"), true);
  assert.equal(isVoiceQuizMatch("hot fix", "hotfix"), true);
  assert.equal(isVoiceQuizMatch("CI CD", "CI/CD"), true);
});

test("isVoiceQuizMatch rejects empty inputs and non-matching terms", () => {
  assert.equal(isVoiceQuizMatch("", "deploy"), false);
  assert.equal(isVoiceQuizMatch("deploy", ""), false);
  assert.equal(isVoiceQuizMatch("debug", "bug"), false);
  assert.equal(isVoiceQuizMatch("rollback", "deploy"), false);
});

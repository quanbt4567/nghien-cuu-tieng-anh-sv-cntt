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
const { filterAndRankVocabulary } = jiti(
  resolve(__dirname, "../components/vocabulary/vocabSearch.ts")
);

test("filterAndRankVocabulary ranks exact and prefix term matches before description/example matches", () => {
  const items = [
    ...VOCABULARY_LIST,
    {
      id: "v_extra_deployment",
      term: "deployment",
      phonetic: "/dɪˈplɔɪ.mənt/",
      partOfSpeech: "noun",
      meaningVI: "Quá trình triển khai phần mềm",
      exampleSentenceEN: "Automated deployment reduces manual errors.",
      exampleTranslationVI: "Triển khai tự động giúp giảm lỗi thủ công.",
    },
  ];

  const results = filterAndRankVocabulary(items, "deploy");
  assert.equal(results[0].term, "deploy");
  assert.equal(results[1].term, "deployment");
  const blockerIndex = results.findIndex((item) => item.term === "blocker");
  assert.ok(blockerIndex > 1);
});

test("filterAndRankVocabulary returns original list for blank query", () => {
  const results = filterAndRankVocabulary(VOCABULARY_LIST, "   ");
  assert.equal(results.length, VOCABULARY_LIST.length);
  assert.equal(results[0].id, VOCABULARY_LIST[0].id);
});

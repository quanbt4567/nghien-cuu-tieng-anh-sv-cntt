import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const jiti = require("jiti")(__filename);

const {
  DELETE_CONFIRM_KEYWORD,
  isDeleteConfirmationMatch,
  extractDeleteIdsFromPayload,
  computeVocabularyBulkDeleteOverrides,
  computeScenarioBulkDeleteOverrides,
  computeArenaBulkDeleteOverrides,
} = jiti(resolve(__dirname, "../lib/adminBulkDelete.ts"));

const { createEmptyContentOverrides } = jiti(
  resolve(__dirname, "../lib/contentStore.ts")
);

test("isDeleteConfirmationMatch enforces typing 'delete' strictly at step 2", () => {
  assert.equal(DELETE_CONFIRM_KEYWORD, "delete");
  assert.equal(isDeleteConfirmationMatch("delete"), true);
  assert.equal(isDeleteConfirmationMatch("  Delete  "), true);
  assert.equal(isDeleteConfirmationMatch("DELETE"), true);

  assert.equal(isDeleteConfirmationMatch(""), false);
  assert.equal(isDeleteConfirmationMatch("del"), false);
  assert.equal(isDeleteConfirmationMatch("xoa"), false);
  assert.equal(isDeleteConfirmationMatch("delete now"), false);
  assert.equal(isDeleteConfirmationMatch("confirm"), false);
});

test("extractDeleteIdsFromPayload supports single query id, comma-separated ids, and JSON body ids array", () => {
  const fromQuery = extractDeleteIdsFromPayload(
    new URLSearchParams("id=item-1&ids=item-2,item-3,item-1"),
    null
  );
  assert.deepEqual(fromQuery, ["item-1", "item-2", "item-3"]);

  const fromBody = extractDeleteIdsFromPayload(new URLSearchParams(""), {
    ids: ["cos-a", " cos-b ", "", "cos-a"],
  });
  assert.deepEqual(fromBody, ["cos-a", "cos-b"]);

  const fromMixed = extractDeleteIdsFromPayload(new URLSearchParams("id=art-1"), {
    id: "art-2",
    ids: ["art-3"],
  });
  assert.deepEqual(fromMixed, ["art-1", "art-2", "art-3"]);
});

test("computeVocabularyBulkDeleteOverrides removes custom terms and hides base terms cleanly", () => {
  const baseIds = new Set(["base-api", "base-pr"]);
  const overrides = {
    ...createEmptyContentOverrides(),
    customVocabulary: [
      {
        id: "base-api",
        term: "API",
        phonetic: "/ˌeɪ.piːˈaɪ/",
        partOfSpeech: "noun",
        meaningVI: "Giao diện lập trình",
        exampleSentenceEN: "Use our API.",
        exampleTranslationVI: "Dùng API.",
      },
      {
        id: "custom-1",
        term: "Idempotency",
        phonetic: "/ˌaɪ.dɛmˈpoʊ.tən.si/",
        partOfSpeech: "noun",
        meaningVI: "Tính bất biến",
        exampleSentenceEN: "Add an idempotency key.",
        exampleTranslationVI: "Thêm khóa bất biến.",
      },
      {
        id: "custom-2",
        term: "Deadlock",
        phonetic: "/ˈded.lɒk/",
        partOfSpeech: "noun",
        meaningVI: "Khóa chết",
        exampleSentenceEN: "Resolve deadlock.",
        exampleTranslationVI: "Xử lý deadlock.",
      },
    ],
    deletedVocabIds: ["base-pr"],
  };

  const next = computeVocabularyBulkDeleteOverrides(
    overrides,
    [overrides.customVocabulary[0], overrides.customVocabulary[2]],
    baseIds
  );

  assert.deepEqual(
    next.customVocabulary.map((v) => v.id),
    ["custom-1"]
  );
  assert.deepEqual(next.deletedVocabIds.sort(), ["base-api", "base-pr"]);
});

test("computeScenarioBulkDeleteOverrides only deletes custom scenarios and preserves base scenarios", () => {
  const baseIds = new Set(["daily-standup"]);
  const overrides = {
    ...createEmptyContentOverrides(),
    customScenarios: [
      {
        id: "daily-standup",
        titleEN: "Base override",
        titleVI: "Base",
        roleVI: "Tech Lead",
        descriptionVI: "desc",
        turns: [],
      },
      {
        id: "custom-sec",
        titleEN: "Security Drill",
        titleVI: "Bảo mật",
        roleVI: "CISO",
        descriptionVI: "desc",
        turns: [],
      },
    ],
    hiddenScenarioIds: ["daily-standup", "custom-sec"],
  };

  const next = computeScenarioBulkDeleteOverrides(
    overrides,
    overrides.customScenarios,
    baseIds
  );

  assert.deepEqual(
    next.customScenarios.map((s) => s.id),
    ["daily-standup"]
  );
  assert.deepEqual(next.hiddenScenarioIds, ["daily-standup"]);
});

test("computeArenaBulkDeleteOverrides deletes custom challenges and hides base challenges", () => {
  const baseIds = new Set(["bb-base-1"]);
  const overrides = {
    ...createEmptyContentOverrides(),
    customBugChallenges: [
      {
        id: "bb-custom-1",
        category: "incident",
        promptEN: "We have ____.",
        targetWord: "latency",
        acceptedVariants: [],
        contextVI: "độ trễ",
        phonetic: "/ˈleɪ.tən.si/",
      },
      {
        id: "bb-custom-2",
        category: "error-log",
        promptEN: "Check ____.",
        targetWord: "timeout",
        acceptedVariants: [],
        contextVI: "hết giờ",
        phonetic: "/ˈtaɪm.aʊt/",
      },
    ],
    deletedChallengeIds: [],
  };

  const next = computeArenaBulkDeleteOverrides(
    overrides,
    [
      { ...overrides.customBugChallenges[0], id: "bb-base-1" },
      overrides.customBugChallenges[1],
    ],
    baseIds
  );

  assert.deepEqual(
    next.customBugChallenges.map((c) => c.id),
    ["bb-custom-1"]
  );
  assert.deepEqual(next.deletedChallengeIds, ["bb-base-1"]);
});

test("Admin modal enforces 2-step confirmation and all 6 admin tabs wire bulk/2-step delete safely", () => {
  const modalSrc = fs.readFileSync(
    resolve(__dirname, "../components/admin/AdminDeleteConfirmModal.tsx"),
    "utf8"
  );
  assert.match(modalSrc, /Bước \{step\} \/ 2/);
  assert.match(modalSrc, /isDeleteConfirmationMatch\(confirmInput\)/);
  assert.match(modalSrc, /disabled=\{!canConfirm \|\| isDeleting\}/);

  const tabFiles = [
    "../components/admin/AdminVocabTab.tsx",
    "../components/admin/AdminScenariosTab.tsx",
    "../components/admin/AdminArenaTab.tsx",
    "../components/admin/AdminCosmeticsTab.tsx",
    "../components/admin/AdminResearchTab.tsx",
  ];
  for (const file of tabFiles) {
    const src = fs.readFileSync(resolve(__dirname, file), "utf8");
    assert.match(src, /AdminDeleteConfirmModal/, `${file} missing AdminDeleteConfirmModal`);
    assert.match(src, /AdminBulkActionBar/, `${file} missing AdminBulkActionBar`);
  }

  const systemSrc = fs.readFileSync(
    resolve(__dirname, "../components/admin/AdminSystemTab.tsx"),
    "utf8"
  );
  assert.match(systemSrc, /AdminDeleteConfirmModal/);

  const contentRouteSrc = fs.readFileSync(
    resolve(__dirname, "../app/api/admin/content/route.ts"),
    "utf8"
  );
  assert.match(contentRouteSrc, /deleteDbVocabularyItems/);
  assert.match(contentRouteSrc, /clearDbVocabularyItems/);
});

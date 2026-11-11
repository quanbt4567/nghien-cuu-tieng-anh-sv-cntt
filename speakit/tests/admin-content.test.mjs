import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const jiti = require("jiti")(__filename);

const { sanitizeDatabaseUrl } = jiti(resolve(__dirname, "../lib/db/neon.ts"));
const {
  isUsingDefaultPasscode,
  verifyAdminPasscode,
  createAdminSessionToken,
  verifyAdminSessionToken,
} = jiti(resolve(__dirname, "../lib/adminAuth.ts"));
const {
  createEmptyContentOverrides,
  mergeScenarios,
  mergeVocabulary,
  mergeBugChallenges,
  buildResearchCsv,
  CONTENT_STORAGE_KEY,
} = jiti(resolve(__dirname, "../lib/contentStore.ts"));
const {
  GAMIFICATION_STORAGE_KEY,
  suggestWeakVocab,
} = jiti(resolve(__dirname, "../lib/gamification.ts"));
const { SCENARIOS, VOCABULARY_LIST } = jiti(
  resolve(__dirname, "../data/scenarios.ts")
);
const { BUG_BUSTER_CHALLENGES } = jiti(
  resolve(__dirname, "../data/minigames.ts")
);
const { loadMergedAdminData } = jiti(
  resolve(__dirname, "../components/admin/adminShared.ts")
);

function installWindowMock() {
  const prevWindow = globalThis.window;
  const prevCustomEvent = globalThis.CustomEvent;
  const store = new Map();

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
    dispatchEvent: () => true,
  };

  return {
    store,
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

test("sanitizeDatabaseUrl strips whitespace and nested quotes cleanly", () => {
  assert.equal(sanitizeDatabaseUrl(undefined), null);
  assert.equal(sanitizeDatabaseUrl(""), null);
  assert.equal(sanitizeDatabaseUrl("   "), null);
  assert.equal(sanitizeDatabaseUrl('""'), null);
  assert.equal(sanitizeDatabaseUrl("''"), null);
  assert.equal(
    sanitizeDatabaseUrl("'postgres://user:pass@ep-demo.neon.tech/neondb?sslmode=require'"),
    "postgres://user:pass@ep-demo.neon.tech/neondb?sslmode=require"
  );
  assert.equal(
    sanitizeDatabaseUrl('  "postgres://user:pass@host/db"  '),
    "postgres://user:pass@host/db"
  );
  assert.equal(
    sanitizeDatabaseUrl("postgres://user:pass@host/db?sslmode=require"),
    "postgres://user:pass@host/db?sslmode=require"
  );
});

test("createAdminSessionToken and verifyAdminSessionToken validate signatures, expiry, and malformed tokens", () => {
  const token = createAdminSessionToken();
  assert.equal(typeof token, "string");
  assert.equal(token.split(".").length, 2);
  assert.equal(verifyAdminSessionToken(token), true);

  // Tamper signature
  const [payload, sig] = token.split(".");
  const tamperedChar = sig[0] === "A" ? "B" : "A";
  assert.equal(
    verifyAdminSessionToken(`${payload}.${tamperedChar}${sig.slice(1)}`),
    false
  );

  // Tamper payload (valid JSON structure, mismatched HMAC)
  const fakePayload = Buffer.from(
    JSON.stringify({ exp: Date.now() + 60_000, n: "deadbeef" }),
    "utf8"
  ).toString("base64url");
  assert.equal(verifyAdminSessionToken(`${fakePayload}.${sig}`), false);

  // Malformed inputs
  assert.equal(verifyAdminSessionToken(undefined), false);
  assert.equal(verifyAdminSessionToken(""), false);
  assert.equal(verifyAdminSessionToken("not-a-jwt"), false);
  assert.equal(verifyAdminSessionToken(`${payload}.`), false);
  assert.equal(verifyAdminSessionToken(`.${sig}`), false);
  assert.equal(verifyAdminSessionToken(`${payload}.${sig}.extra`), false);

  // Passcode verification respects ADMIN_PASSCODE env override without mutating permanently
  const prevPasscode = process.env.ADMIN_PASSCODE;
  try {
    process.env.ADMIN_PASSCODE = "iuh-secret-2026";
    assert.equal(isUsingDefaultPasscode(), false);
    assert.equal(verifyAdminPasscode("iuh-secret-2026"), true);
    assert.equal(verifyAdminPasscode("admin2025"), false);
    assert.equal(verifyAdminPasscode(""), false);
  } finally {
    if (prevPasscode === undefined) {
      delete process.env.ADMIN_PASSCODE;
    } else {
      process.env.ADMIN_PASSCODE = prevPasscode;
    }
  }
});

test("mergeScenarios supports custom additions, existing overrides, hidden filtering, and leaves SCENARIOS unmutated", () => {
  const snapshot = structuredClone(SCENARIOS);
  const overrides = {
    ...createEmptyContentOverrides(),
    hiddenScenarioIds: ["client-meeting"],
    customScenarios: [
      {
        id: "daily-standup",
        titleEN: "Custom Daily Standup",
        titleVI: "Standup Tùy Chỉnh",
        roleVI: "Engineering Manager",
        descriptionVI: "Phiên bản cập nhật bởi admin.",
        targetRoles: ["devops"],
        turns: [
          {
            turnIndex: 0,
            questionEN: "What changed in production yesterday?",
            keywords: ["pipeline", "rollback"],
            sampleAnswerEN: "We deployed the pipeline fix.",
            hintVI: "Nêu thay đổi production.",
          },
        ],
      },
      {
        id: "incident-postmortem",
        titleEN: "Incident Postmortem",
        titleVI: "Phân Tích Sự Cố",
        roleVI: "SRE Lead",
        descriptionVI: "Kịch bản mới thêm từ Admin.",
        isCustom: true,
        turns: [
          {
            turnIndex: 0,
            questionEN: "What was the root cause of the outage?",
            keywords: ["root cause", "latency"],
            sampleAnswerEN: "Root cause was high database latency.",
            hintVI: "Nêu nguyên nhân gốc rễ.",
          },
        ],
      },
    ],
  };

  const visible = mergeScenarios(SCENARIOS, overrides, false);
  assert.equal(visible.length, SCENARIOS.length); // -1 hidden + 1 custom
  assert.equal(
    visible.some((s) => s.id === "client-meeting"),
    false
  );

  const overridden = visible.find((s) => s.id === "daily-standup");
  assert.ok(overridden);
  assert.equal(overridden.titleEN, "Custom Daily Standup");
  assert.equal(overridden.turns.length, 1);
  assert.equal(overridden.turns[0].questionEN, "What changed in production yesterday?");

  const customAdded = visible.find((s) => s.id === "incident-postmortem");
  assert.ok(customAdded);
  assert.equal(customAdded.isCustom, true);

  const allWithHidden = mergeScenarios(SCENARIOS, overrides, true);
  assert.equal(allWithHidden.length, SCENARIOS.length + 1);
  const hiddenEntry = allWithHidden.find((s) => s.id === "client-meeting");
  assert.ok(hiddenEntry);
  assert.equal(hiddenEntry.isHidden, true);

  // Static SCENARIOS must remain completely unmutated
  assert.deepEqual(SCENARIOS, snapshot);
});

test("mergeVocabulary and suggestWeakVocab integrate Admin-added vocabulary into recommendations", () => {
  const vocabSnapshot = structuredClone(VOCABULARY_LIST);
  const overrides = {
    ...createEmptyContentOverrides(),
    deletedVocabIds: [VOCABULARY_LIST[0].id],
    customVocabulary: [
      {
        id: "vc_k8s_custom",
        term: "kubernetes",
        phonetic: "/ˌkuː.bərˈnet.ɪs/",
        partOfSpeech: "noun",
        meaningVI: "Hệ thống điều phối container tự động.",
        exampleSentenceEN: "We scale our microservices on Kubernetes.",
        exampleTranslationVI: "Chúng tôi mở rộng microservice trên Kubernetes.",
      },
    ],
  };

  const merged = mergeVocabulary(VOCABULARY_LIST, overrides);
  assert.equal(merged.length, VOCABULARY_LIST.length); // -1 deleted + 1 added
  assert.equal(
    merged.some((v) => v.id === VOCABULARY_LIST[0].id),
    false
  );
  assert.equal(
    merged.some((v) => v.id === "vc_k8s_custom"),
    true
  );

  const suggested = suggestWeakVocab(["kubernetes"], ["latency"], 3, merged);
  assert.equal(suggested.length, 3);
  assert.equal(suggested[0].id, "vc_k8s_custom");
  assert.equal(suggested[0].term, "kubernetes");
  assert.deepEqual(VOCABULARY_LIST, vocabSnapshot);
});

test("mergeBugChallenges handles custom additions, overrides, and deleted base IDs", () => {
  const challengeSnapshot = structuredClone(BUG_BUSTER_CHALLENGES);
  const overrides = {
    ...createEmptyContentOverrides(),
    deletedChallengeIds: ["bb-02"],
    customBugChallenges: [
      {
        id: "bb_custom_deadlock",
        category: "incident",
        promptEN: "Two transactions caused a database ____.",
        targetWord: "deadlock",
        acceptedVariants: ["dead lock"],
        contextVI: "Khóa chéo tiến trình.",
        phonetic: "/ˈded.lɑːk/",
      },
    ],
  };

  const merged = mergeBugChallenges(BUG_BUSTER_CHALLENGES, overrides);
  assert.equal(merged.length, BUG_BUSTER_CHALLENGES.length); // -1 deleted + 1 custom
  assert.equal(
    merged.some((c) => c.id === "bb-02"),
    false
  );
  const custom = merged.find((c) => c.id === "bb_custom_deadlock");
  assert.ok(custom);
  assert.equal(custom.targetWord, "deadlock");
  assert.deepEqual(BUG_BUSTER_CHALLENGES, challengeSnapshot);
});

test("buildResearchCsv prepends UTF-8 BOM and escapes quotes, commas, and newlines per RFC 4180", () => {
  const csv = buildResearchCsv(
    [
      {
        id: "att_1",
        scenario: "daily-standup",
        turn_index: 0,
        transcript: 'Yesterday I fixed "API, v2"\nwith zero downtime',
        score: 88,
        keywords_used: ["yesterday", "api"],
        role: "backend",
        created_at: "2026-11-12T00:00:00.000Z",
      },
    ],
    [
      {
        id: "run_1",
        game_id: "bug-buster",
        score: 650,
        accuracy_or_words: 4,
        duration_sec: 60,
        role: "qa",
        created_at: "2026-11-12T00:05:00.000Z",
      },
    ],
    [
      {
        id: "wp_1",
        kind: "keyword",
        value: 'hotfix, "urgent"',
        miss_count: 3,
        updated_at: "2026-11-12T00:10:00.000Z",
      },
    ]
  );

  assert.equal(csv.startsWith("\uFEFF"), true);
  assert.equal(
    csv.includes('"Yesterday I fixed ""API, v2""\nwith zero downtime"'),
    true
  );
  assert.equal(csv.includes('"hotfix, ""urgent"""'), true);
  assert.equal(csv.includes("practice_attempt,att_1"), true);
  assert.equal(csv.includes("arena_run,run_1"), true);
  assert.equal(csv.includes("weak_point,wp_1"), true);
});

test("loadMergedAdminData deduplicates Neon and localStorage records and computes offline fallback", async () => {
  const mock = installWindowMock();
  const prevSupaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevSupaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  try {
    mock.store.set(
      "speakit_attempts_v1",
      JSON.stringify([
        {
          id: "att_shared",
          scenario: "daily-standup",
          turn_index: 0,
          transcript: "Local duplicate",
          score: 70,
          keywords_used: ["yesterday"],
          role: "frontend",
          created_at: "2026-11-12T01:00:00.000Z",
        },
        {
          id: "att_local_only",
          scenario: "bug-report",
          turn_index: 1,
          transcript: "Local unsynced attempt",
          score: 90,
          keywords_used: ["reproduce"],
          role: "qa",
          created_at: "2026-11-12T02:00:00.000Z",
        },
      ])
    );

    mock.store.set(
      "speakit_weakpoints_v1",
      JSON.stringify([
        {
          id: "wp_local_dup",
          kind: "keyword",
          value: "  Blocker ",
          miss_count: 2,
          updated_at: "2026-11-12T01:00:00.000Z",
        },
        {
          id: "wp_local_new",
          kind: "grammar",
          value: "subject-verb agreement",
          miss_count: 4,
          updated_at: "2026-11-12T02:00:00.000Z",
        },
      ])
    );

    mock.store.set(
      GAMIFICATION_STORAGE_KEY,
      JSON.stringify({
        totalPoints: 1200,
        streakDays: 2,
        lastPracticeDate: "2026-11-12",
        selectedRole: "qa",
        personalBests: { "bug-buster": 600, "standup-speed-run": 500 },
        history: [
          {
            id: "run_shared",
            gameId: "bug-buster",
            score: 600,
            accuracyOrWords: 4,
            durationSec: 60,
            role: "qa",
            createdAt: "2026-11-12T01:10:00.000Z",
          },
          {
            id: "run_local_only",
            gameId: "standup-speed-run",
            score: 500,
            accuracyOrWords: 7,
            durationSec: 45,
            role: "devops",
            createdAt: "2026-11-12T02:10:00.000Z",
          },
        ],
      })
    );

    const merged = await loadMergedAdminData({
      stats: {
        totalAttempts: 1,
        avgScore: 80,
        totalArenaRuns: 1,
        activeScenariosCount: SCENARIOS.length,
        totalWeakPoints: 1,
        roleBreakdown: { frontend: 1, qa: 1 },
        scenarioBreakdown: [{ scenario: "daily-standup", count: 1, avgScore: 80 }],
      },
      attempts: [
        {
          id: "att_shared",
          scenario: "daily-standup",
          turn_index: 0,
          transcript: "Remote primary",
          score: 80,
          keywords_used: ["yesterday"],
          role: "frontend",
          created_at: "2026-11-12T01:00:00.000Z",
        },
      ],
      weakPoints: [
        {
          id: "keyword:blocker",
          kind: "keyword",
          value: "blocker",
          miss_count: 5,
          updated_at: "2026-11-12T01:00:00.000Z",
        },
      ],
      arenaRuns: [
        {
          id: "run_shared",
          game_id: "bug-buster",
          score: 600,
          accuracy_or_words: 4,
          duration_sec: 60,
          role: "qa",
          created_at: "2026-11-12T01:10:00.000Z",
        },
      ],
      overrides: {
        ...createEmptyContentOverrides(),
        hiddenScenarioIds: ["tech-demo"],
      },
      health: {
        neonConnected: true,
        geminiConfigured: false,
        isDefaultPasscode: true,
      },
    });

    assert.equal(merged.attempts.length, 2);
    assert.equal(merged.attempts[0].id, "att_local_only");
    assert.equal(merged.attempts[1].transcript, "Remote primary");
    assert.equal(merged.arenaRuns.length, 2);
    assert.equal(merged.arenaRuns[0].id, "run_local_only");
    assert.equal(merged.weakPoints.length, 2);
    assert.equal(merged.weakPoints[0].value, "blocker");
    assert.equal(merged.stats.totalAttempts, 2);
    assert.equal(merged.stats.avgScore, 85); // (80 + 90) / 2
    assert.equal(merged.stats.totalArenaRuns, 2);
    assert.equal(merged.stats.totalWeakPoints, 2);
    assert.equal(merged.stats.activeScenariosCount, SCENARIOS.length - 1);
    assert.equal(merged.stats.roleBreakdown.qa, 2);
    assert.equal(merged.stats.roleBreakdown.devops, 1);
    assert.equal(merged.localExtrasCount, 3);
    assert.ok(mock.store.get(CONTENT_STORAGE_KEY));

    // Offline fallback mode (remote = null)
    const offline = await loadMergedAdminData(null);
    assert.equal(offline.health.neonConnected, false);
    assert.equal(offline.attempts.length, 2);
    assert.equal(offline.arenaRuns.length, 2);
    assert.equal(offline.weakPoints.length, 2);
    assert.equal(offline.stats.avgScore, 80); // (70 + 90) / 2
  } finally {
    if (prevSupaUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = prevSupaUrl;
    }
    if (prevSupaKey === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = prevSupaKey;
    }
    mock.restore();
  }
});

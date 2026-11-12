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
  OPENAI_WATERFALL_PROVIDERS,
  evaluateWithWaterfall,
  getAiProviderStatusList,
} = jiti(resolve(__dirname, "../lib/ai-waterfall.ts"));

const { resolveAiProviders } = jiti(
  resolve(__dirname, "../components/admin/adminShared.ts")
);

function buildValidAiPayloadJson(score = 88) {
  return JSON.stringify({
    score,
    keywordsUsed: ["endpoint", "rollback"],
    keywordsMissed: ["hotfix"],
    grammarCorrections: [
      {
        original: "Yesterday I fix bug",
        corrected: "Yesterday I fixed a bug",
        explanationVI: "Dung thi qua khu don cho su viec da xong.",
      },
    ],
    betterSentence: "Yesterday I deployed a hotfix to stabilize the auth endpoint.",
    pronunciationNote:
      "Đánh giá phát âm ước lượng từ văn bản: Phát âm rõ âm cuối /t/ trong endpoint.",
    nextQuestion: "Did you verify the rollback plan?",
  });
}

test("provider catalog defines exact 6-tier failover specs and status helper", () => {
  assert.deepEqual(
    OPENAI_WATERFALL_PROVIDERS.map((p) => [p.id, p.envVar, p.defaultModel, p.url]),
    [
      [
        "cerebras",
        "CEREBRAS_API_KEY",
        "qwen-3.8-27b",
        "https://api.cerebras.ai/v1/chat/completions",
      ],
      [
        "inception",
        "INCEPTION_API_KEY",
        "mercury-3",
        "https://api.inceptionlabs.ai/v1/chat/completions",
      ],
      [
        "groq",
        "GROQ_API_KEY",
        "qwen/qwen3.8-27b",
        "https://api.groq.com/openai/v1/chat/completions",
      ],
      [
        "xkiro",
        "XKIRO_API_KEY",
        "mistralai/ministral-14b",
        "https://api.xkiro.com/v1/chat/completions",
      ],
      [
        "openrouter",
        "OPENROUTER_API_KEY",
        "openrouter/free",
        "https://openrouter.ai/api/v1/chat/completions",
      ],
    ]
  );

  const statuses = getAiProviderStatusList({
    CEREBRAS_API_KEY: "cer-1",
    GROQ_API_KEY: "   ",
    GEMINI_API_KEY: "gem-1",
  });

  assert.deepEqual(
    statuses.map((s) => [s.priority, s.id, s.envVar, s.configured]),
    [
      [1, "cerebras", "CEREBRAS_API_KEY", true],
      [2, "inception", "INCEPTION_API_KEY", false],
      [3, "groq", "GROQ_API_KEY", false],
      [4, "xkiro", "XKIRO_API_KEY", false],
      [5, "openrouter", "OPENROUTER_API_KEY", false],
      [6, "gemini", "GEMINI_API_KEY", true],
    ]
  );
});

test("waterfall skips missing or blank keys and honors model overrides", async () => {
  const calls = [];
  const fetchMock = async (url, init) => {
    calls.push({
      url: String(url),
      auth: init?.headers?.Authorization,
      body: JSON.parse(String(init?.body || "{}")),
    });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: buildValidAiPayloadJson(91) } }],
      }),
    };
  };

  const result = await evaluateWithWaterfall({
    transcript: "Yesterday I fixed the auth endpoint and prepared a rollback.",
    scenario: "daily-standup",
    turnIndex: 0,
    expectedKeywords: ["endpoint", "rollback", "hotfix"],
    env: {
      CEREBRAS_API_KEY: "",
      INCEPTION_API_KEY: "   ",
      GROQ_API_KEY: "groq-secret-key",
      GROQ_MODEL: "custom-groq-model",
      GEMINI_API_KEY: "gem-secret",
    },
    fetchFn: fetchMock,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.groq.com/openai/v1/chat/completions");
  assert.equal(calls[0].auth, "Bearer groq-secret-key");
  assert.equal(calls[0].body.model, "custom-groq-model");
  assert.equal(result.evaluationMode, "ai");
  assert.equal(result.provider, "groq");
  assert.equal(result.score, 91);
});

test("waterfall cascades through 429, 401, 500, and invalid JSON onto OpenRouter fenced JSON", async () => {
  const calledUrls = [];
  const fetchMock = async (url) => {
    const target = String(url);
    calledUrls.push(target);

    if (target.includes("cerebras.ai")) {
      return { ok: false, status: 429, json: async () => ({}) };
    }
    if (target.includes("inceptionlabs.ai")) {
      return { ok: false, status: 401, json: async () => ({}) };
    }
    if (target.includes("groq.com")) {
      return { ok: false, status: 500, json: async () => ({}) };
    }
    if (target.includes("xkiro.com")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: "not valid json output" } }],
        }),
      };
    }
    if (target.includes("openrouter.ai")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: "```json\n" + buildValidAiPayloadJson(84) + "\n```",
              },
            },
          ],
        }),
      };
    }

    throw new Error(`Unexpected URL called: ${target}`);
  };

  const result = await evaluateWithWaterfall({
    transcript: "We verified the endpoint and rollback plan.",
    scenario: "daily-standup",
    turnIndex: 0,
    expectedKeywords: ["endpoint", "rollback", "hotfix"],
    env: {
      CEREBRAS_API_KEY: "k1",
      INCEPTION_API_KEY: "k2",
      GROQ_API_KEY: "k3",
      XKIRO_API_KEY: "k4",
      OPENROUTER_API_KEY: "k5",
      GEMINI_API_KEY: "k6",
    },
    fetchFn: fetchMock,
  });

  assert.deepEqual(calledUrls, [
    "https://api.cerebras.ai/v1/chat/completions",
    "https://api.inceptionlabs.ai/v1/chat/completions",
    "https://api.groq.com/openai/v1/chat/completions",
    "https://api.xkiro.com/v1/chat/completions",
    "https://openrouter.ai/api/v1/chat/completions",
  ]);
  assert.equal(result.evaluationMode, "ai");
  assert.equal(result.provider, "openrouter");
  assert.equal(result.score, 84);
});

test("waterfall aborts hung attempts on timeout and cascades to Gemini", async () => {
  const events = [];
  const fetchMock = async (url, init) => {
    const target = String(url);
    events.push(target);

    if (target.includes("cerebras.ai")) {
      return new Promise((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("Aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    }

    if (target.includes("inceptionlabs.ai")) {
      return { ok: false, status: 402, json: async () => ({}) };
    }

    if (target.includes("generativelanguage.googleapis.com")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: buildValidAiPayloadJson(89) }],
              },
            },
          ],
        }),
      };
    }

    return { ok: false, status: 503, json: async () => ({}) };
  };

  const result = await evaluateWithWaterfall({
    transcript: "I fixed the staging deployment.",
    scenario: "bug-report",
    turnIndex: 1,
    expectedKeywords: ["deployment", "staging"],
    defaultNextQuestion: "Default follow-up?",
    env: {
      CEREBRAS_API_KEY: "k1",
      INCEPTION_API_KEY: "k2",
      GEMINI_API_KEY: "k6",
    },
    timeoutMs: 25,
    fetchFn: fetchMock,
  });

  assert.equal(events.length, 3);
  assert.equal(events[0], "https://api.cerebras.ai/v1/chat/completions");
  assert.equal(events[1], "https://api.inceptionlabs.ai/v1/chat/completions");
  assert.match(events[2], /^https:\/\/generativelanguage\.googleapis\.com/);
  assert.equal(result.evaluationMode, "ai");
  assert.equal(result.provider, "gemini");
  assert.equal(result.score, 89);
});

test("waterfall falls back to scoreLocally with provider='local' when all providers fail", async () => {
  let callCount = 0;
  const fetchMock = async (url) => {
    callCount += 1;
    if (String(url).includes("cerebras.ai")) {
      return { ok: false, status: 429, json: async () => ({}) };
    }
    if (String(url).includes("inceptionlabs.ai")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ error: "quota exceeded" }) } }],
        }),
      };
    }
    if (String(url).includes("groq.com")) {
      throw new Error("ECONNRESET");
    }
    return { ok: false, status: 502, json: async () => ({}) };
  };

  const result = await evaluateWithWaterfall({
    transcript: "Yesterday I fixed the endpoint and tested the rollback.",
    scenario: "daily-standup",
    turnIndex: 0,
    expectedKeywords: ["endpoint", "rollback"],
    defaultNextQuestion: "What blockers do you have today?",
    env: {
      CEREBRAS_API_KEY: "k1",
      INCEPTION_API_KEY: "k2",
      GROQ_API_KEY: "k3",
      XKIRO_API_KEY: "k4",
      OPENROUTER_API_KEY: "k5",
      GEMINI_API_KEY: "k6",
    },
    fetchFn: fetchMock,
  });

  assert.equal(callCount, 6);
  assert.equal(result.evaluationMode, "local_rules");
  assert.equal(result.provider, "local");
  assert.equal(result.nextQuestion, "What blockers do you have today?");
  assert.ok(result.keywordsUsed.includes("endpoint"));
  assert.ok(result.keywordsUsed.includes("rollback"));
});

test("resolveAiProviders preserves explicit provider statuses and supports legacy health shape", () => {
  const legacyResolved = resolveAiProviders({
    neonConnected: false,
    geminiConfigured: true,
    isDefaultPasscode: false,
  });

  assert.equal(legacyResolved.length, 6);
  assert.equal(legacyResolved.find((p) => p.id === "gemini")?.configured, true);
  assert.equal(legacyResolved.find((p) => p.id === "cerebras")?.configured, false);
});


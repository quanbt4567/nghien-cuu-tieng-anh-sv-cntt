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
  extractFirstJsonObject,
  requestAiWaterfallText,
} = jiti(resolve(__dirname, "../lib/ai-waterfall.ts"));

const {
  AdminGenerateRejectedError,
  AdminGenerateValidationError,
  buildFallbackAdminDraft,
  ensurePromptBlank,
  generateAdminContentDraft,
  validateAdminGenerateInput,
} = jiti(resolve(__dirname, "../lib/adminAiGenerator.ts"));

const { ADMIN_COOKIE_NAME, createAdminSessionToken } = jiti(
  resolve(__dirname, "../lib/adminAuth.ts")
);

const { POST: generateRoutePost } = jiti(
  resolve(__dirname, "../app/api/admin/generate/route.ts")
);

test("extractFirstJsonObject extracts fenced or inline JSON and ignores arrays or trailing prose", () => {
  assert.deepEqual(
    extractFirstJsonObject('Sure!\n```json\n{"term":"idempotent","ok":true}\n```\nDone.'),
    { term: "idempotent", ok: true }
  );

  assert.deepEqual(
    extractFirstJsonObject('Draft: {"msg":"brace {inside} string","n":2} trailing {ignored}'),
    { msg: "brace {inside} string", n: 2 }
  );

  assert.equal(extractFirstJsonObject('["only", "array"]'), null);
  assert.equal(extractFirstJsonObject("not json at all"), null);
});

test("requestAiWaterfallText cascades through OpenAI providers to Gemini and returns null when exhausted", async () => {
  const urls = [];
  const fetchMock = async (url) => {
    const target = String(url);
    urls.push(target);
    if (target.includes("cerebras.ai")) {
      return { ok: false, status: 429, json: async () => ({}) };
    }
    if (target.includes("generativelanguage.googleapis.com")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
        }),
      };
    }
    return { ok: false, status: 500, json: async () => ({}) };
  };

  const hit = await requestAiWaterfallText({
    systemInstruction: "Return JSON",
    userPrompt: "Test",
    env: { CEREBRAS_API_KEY: "k1", GEMINI_API_KEY: "k6" },
    fetchFn: fetchMock,
  });

  assert.deepEqual(hit, { text: '{"ok":true}', provider: "gemini" });
  assert.equal(urls.length, 2);

  const missed = await requestAiWaterfallText({
    systemInstruction: "Return JSON",
    userPrompt: "Test",
    env: {},
    fetchFn: fetchMock,
  });
  assert.equal(missed, null);
});

test("generateAdminContentDraft normalizes AI scenario output into 3 sequential turns with valid roles and 3-5 keywords", async () => {
  const result = await generateAdminContentDraft(
    { kind: "scenario", topic: "Xử lý deadlock PostgreSQL", role: "backend" },
    {
      requestText: async () => ({
        provider: "groq",
        text: [
          "Here is the draft:",
          "```json",
          JSON.stringify({
            id: "  Xử Lý Deadlock DB! ",
            titleEN: "Resolving PostgreSQL Deadlocks",
            titleVI: "Xử lý deadlock trong PostgreSQL",
            roleVI: "Senior DBA",
            descriptionVI: "Mô tả cách phát hiện và xử lý deadlock khi nhiều transaction chạy đồng thời.",
            targetRoles: ["Backend", "INVALID_ROLE", "devops", "backend"],
            turns: [
              {
                turnIndex: 2,
                questionEN: "How will you prevent this deadlock from happening again?",
                keywords: ["lock order", "retry", "transaction", "monitoring", "index", "extra-ignored"],
                sampleAnswerEN: "We enforce consistent lock ordering and retry transient deadlock errors.",
                hintVI: "Nêu giải pháp phòng ngừa lâu dài.",
              },
              {
                turnIndex: 0,
                questionEN: "What triggered the deadlock in production?",
                keywords: ["deadlock", "transaction"],
                sampleAnswerEN: "Two concurrent transactions acquired row locks in opposite order.",
                hintVI: "Giải thích nguyên nhân gây ra deadlock.",
              },
            ],
          }),
          "```",
        ].join("\n"),
      }),
    }
  );

  assert.equal(result.kind, "scenario");
  assert.equal(result.mode, "ai");
  assert.equal(result.provider, "groq");

  const draft = result.draft;
  assert.equal(draft.id, "xu-ly-deadlock-db");
  assert.deepEqual(draft.targetRoles, ["backend", "devops"]);
  assert.equal(draft.turns.length, 3);
  assert.deepEqual(
    draft.turns.map((t) => t.turnIndex),
    [0, 1, 2]
  );
  // Turn 0 had 2 keywords -> padded to at least 3
  assert.ok(draft.turns[0].keywords.length >= 3 && draft.turns[0].keywords.length <= 5);
  assert.equal(draft.turns[0].questionEN, "What triggered the deadlock in production?");
  // Turn 1 had 6 keywords -> capped at 5
  assert.equal(draft.turns[1].keywords.length, 5);
  // Turn 2 was missing in AI output -> padded from deterministic fallback
  assert.ok(draft.turns[2].questionEN.length > 0);
  assert.ok(draft.turns[2].keywords.length >= 3 && draft.turns[2].keywords.length <= 5);
});

test("generateAdminContentDraft normalizes AI vocabulary output and partOfSpeech variants", async () => {
  const result = await generateAdminContentDraft(
    { kind: "vocabulary", topic: "rate limiting" },
    {
      requestText: async () => ({
        provider: "cerebras",
        text: JSON.stringify({
          term: "rate limiting",
          phonetic: "/reɪt ˈlɪm.ɪ.tɪŋ/",
          partOfSpeech: "noun phrase",
          meaningVI: "Giới hạn tần suất gọi API để bảo vệ hệ thống khỏi quá tải.",
          exampleSentenceEN: "We enabled rate limiting on the login endpoint to block brute-force attacks.",
          exampleTranslationVI: "Chúng tôi bật giới hạn tốc độ ở endpoint đăng nhập để chặn tấn công brute-force.",
        }),
      }),
    }
  );

  assert.equal(result.kind, "vocabulary");
  assert.equal(result.mode, "ai");
  assert.equal(result.provider, "cerebras");
  assert.deepEqual(result.draft, {
    term: "rate limiting",
    phonetic: "/reɪt ˈlɪm.ɪ.tɪŋ/",
    partOfSpeech: "phrase",
    meaningVI: "Giới hạn tần suất gọi API để bảo vệ hệ thống khỏi quá tải.",
    exampleSentenceEN: "We enabled rate limiting on the login endpoint to block brute-force attacks.",
    exampleTranslationVI: "Chúng tôi bật giới hạn tốc độ ở endpoint đăng nhập để chặn tấn công brute-force.",
  });
});

test("generateAdminContentDraft normalizes AI bug_challenge and auto-inserts ____ when omitted", async () => {
  // Case 1: AI included targetWord in promptEN without ____
  const replaced = await generateAdminContentDraft(
    { kind: "bug_challenge", topic: "API timeout", category: "error-log" },
    {
      requestText: async () => ({
        provider: "openrouter",
        text: JSON.stringify({
          category: "error_log",
          promptEN: "[ERROR] Upstream payment service threw a Timeout exception after 30s.",
          targetWord: "timeout",
          acceptedVariants: ["timeout", "time out", "timed out", "time out"],
          contextVI: "Lỗi hết thời gian chờ phản hồi từ dịch vụ thanh toán.",
          phonetic: "/ˈtaɪm.aʊt/",
        }),
      }),
    }
  );

  assert.equal(replaced.mode, "ai");
  assert.equal(replaced.provider, "openrouter");
  assert.equal(replaced.draft.category, "error-log");
  assert.equal(
    replaced.draft.promptEN,
    "[ERROR] Upstream payment service threw a ____ exception after 30s."
  );
  assert.deepEqual(replaced.draft.acceptedVariants, ["time out", "timed out"]);

  // Case 2: Neither ____ nor targetWord appears -> appends " (____)"
  const appended = await generateAdminContentDraft(
    { kind: "bug_challenge", topic: "DB migration", category: "code-review" },
    {
      requestText: async () => ({
        provider: "gemini",
        text: JSON.stringify({
          category: "code-review",
          promptEN: "Please update the catalog table definition before deploying.",
          targetWord: "log",
          acceptedVariants: ["logs"],
          contextVI: "Cập nhật thông tin ghi nhận sự kiện.",
          phonetic: "/lɔːɡ/",
        }),
      }),
    }
  );

  // "log" inside "catalog" must NOT be mangled; appends " (____)"
  assert.equal(
    appended.draft.promptEN,
    "Please update the catalog table definition before deploying. (____)"
  );

  // Direct helper normalizes short/long underscore runs to exact 4 underscores
  assert.equal(
    ensurePromptBlank("Trigger an immediate ___ to restore service.", "rollback"),
    "Trigger an immediate ____ to restore service."
  );
});

test("generateAdminContentDraft falls back to template/local when keys are missing or all 6 providers fail", async () => {
  // 1. Missing all API keys
  const noKeys = await generateAdminContentDraft(
    { kind: "vocabulary", topic: "idempotency" },
    { env: {} }
  );
  assert.equal(noKeys.mode, "template");
  assert.equal(noKeys.provider, "local");
  assert.equal(noKeys.draft.term, "idempotency");
  assert.equal(noKeys.draft.partOfSpeech, "noun");

  // 2. All 6 providers configured, but return 429 / 500 / invalid JSON
  let fetchCount = 0;
  const failingFetch = async (url) => {
    fetchCount += 1;
    const target = String(url);
    if (target.includes("cerebras.ai")) {
      return { ok: false, status: 429, json: async () => ({}) };
    }
    if (target.includes("inceptionlabs.ai")) {
      return { ok: false, status: 500, json: async () => ({}) };
    }
    if (target.includes("groq.com")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: "this is not json" } }],
        }),
      };
    }
    if (target.includes("xkiro.com")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ error: "quota" }) } }],
        }),
      };
    }
    if (target.includes("openrouter.ai")) {
      throw new Error("Network failure");
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "{invalid" }] } }],
      }),
    };
  };

  const scenarioFallback = await generateAdminContentDraft(
    { kind: "scenario", topic: "Redis cache invalidation", role: "devops" },
    {
      env: {
        CEREBRAS_API_KEY: "k1",
        INCEPTION_API_KEY: "k2",
        GROQ_API_KEY: "k3",
        XKIRO_API_KEY: "k4",
        OPENROUTER_API_KEY: "k5",
        GEMINI_API_KEY: "k6",
      },
      fetchFn: failingFetch,
    }
  );

  assert.equal(fetchCount, 6);
  assert.equal(scenarioFallback.mode, "template");
  assert.equal(scenarioFallback.provider, "local");
  assert.equal(scenarioFallback.draft.id, "redis-cache-invalidation");
  assert.deepEqual(scenarioFallback.draft.targetRoles, ["devops"]);
  assert.equal(scenarioFallback.draft.turns.length, 3);
  assert.deepEqual(
    scenarioFallback.draft.turns.map((t) => t.turnIndex),
    [0, 1, 2]
  );

  const bugFallback = buildFallbackAdminDraft({
    kind: "bug_challenge",
    topic: "webhook signature verification",
    category: "error-log",
  });
  assert.equal(bugFallback.category, "error-log");
  assert.ok(bugFallback.promptEN.includes("____"));
  assert.ok(bugFallback.targetWord.length > 0);
});

test("validation rejects empty topic, invalid kind, and unauthenticated route requests", async () => {
  assert.equal(validateAdminGenerateInput({ kind: "scenario", topic: "   " }).ok, false);
  assert.equal(validateAdminGenerateInput({ kind: "unknown", topic: "Redis" }).ok, false);
  assert.equal(
    validateAdminGenerateInput({ kind: "scenario", topic: "Redis", role: "ceo" }).ok,
    false
  );

  await assert.rejects(
    () => generateAdminContentDraft({ kind: "scenario", topic: "   " }),
    (err) => err instanceof AdminGenerateValidationError
  );

  await assert.rejects(
    () => generateAdminContentDraft({ kind: "invalid_kind", topic: "Docker" }),
    (err) => err instanceof AdminGenerateValidationError
  );

  // Route guard: 401 when unauthenticated
  const { NextRequest } = require("next/server");
  const unauthRes = await generateRoutePost(
    new NextRequest("http://localhost/api/admin/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "vocabulary", topic: "rollback" }),
    })
  );
  assert.equal(unauthRes.status, 401);
  const unauthJson = await unauthRes.json();
  assert.equal(unauthJson.ok, false);

  // Route validation: 400 on bad input with valid admin cookie
  const token = createAdminSessionToken();

  const badReq = new NextRequest("http://localhost/api/admin/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${ADMIN_COOKIE_NAME}=${token}`,
    },
    body: JSON.stringify({ kind: "invalid", topic: "" }),
  });
  const badRes = await generateRoutePost(badReq);
  assert.equal(badRes.status, 400);
  const badJson = await badRes.json();
  assert.equal(badJson.ok, false);

  // Route validation: 400 on malformed JSON body
  const malformedReq = new NextRequest("http://localhost/api/admin/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${ADMIN_COOKIE_NAME}=${token}`,
    },
    body: "{not-json",
  });
  const malformedRes = await generateRoutePost(malformedReq);
  assert.equal(malformedRes.status, 400);

  // Route success: 200 (clear AI keys to keep test deterministic/offline)
  const keyNames = [
    "CEREBRAS_API_KEY",
    "INCEPTION_API_KEY",
    "GROQ_API_KEY",
    "XKIRO_API_KEY",
    "OPENROUTER_API_KEY",
    "GEMINI_API_KEY",
  ];
  const savedEnv = Object.fromEntries(keyNames.map((k) => [k, process.env[k]]));
  for (const k of keyNames) delete process.env[k];
  try {
    const okReq = new NextRequest("http://localhost/api/admin/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${ADMIN_COOKIE_NAME}=${token}`,
      },
      body: JSON.stringify({
        kind: "bug_challenge",
        topic: "Kubernetes readiness probe",
        category: "incident",
      }),
    });
    const okRes = await generateRoutePost(okReq);
    assert.equal(okRes.status, 200);
    const okJson = await okRes.json();
    assert.equal(okJson.ok, true);
    assert.equal(okJson.kind, "bug_challenge");
    assert.equal(okJson.mode, "template");
    assert.equal(okJson.provider, "local");
    assert.ok(okJson.draft.promptEN.includes("____"));
  } finally {
    for (const k of keyNames) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  }
});

test("gibberish pre-validation and AI rejection block irrelevant or nonsensical prompts", async () => {
  // Obvious gibberish or pure digits rejected locally, while short valid IT terms stay allowed
  for (const junk of ["hihi", "hahaha", "asdf", "123456", "??!!", "aaaaaa"]) {
    const check = validateAdminGenerateInput({ kind: "vocabulary", topic: junk });
    assert.equal(check.ok, false, `Expected "${junk}" to be rejected`);
  }

  for (const validTerm of ["git", "sql", "pgsql", "unit test", "merge", "API gateway 502"]) {
    const check = validateAdminGenerateInput({ kind: "vocabulary", topic: validTerm });
    assert.equal(check.ok, true, `Expected "${validTerm}" to pass pre-validation`);
  }

  // AI semantic rejection must throw AdminGenerateRejectedError and NOT fall back to template
  let calledProviders = 0;
  await assert.rejects(
    () =>
      generateAdminContentDraft(
        { kind: "scenario", topic: "Hướng dẫn nấu phở bò gia truyền" },
        {
          env: { CEREBRAS_API_KEY: "k1", GROQ_API_KEY: "k3" },
          fetchFn: async () => {
            calledProviders += 1;
            return {
              ok: true,
              status: 200,
              json: async () => ({
                choices: [
                  {
                    message: {
                      content: JSON.stringify({
                        rejected: true,
                        reason: "Nội dung không phù hợp hoặc không liên quan đến CNTT.",
                      }),
                    },
                  },
                ],
              }),
            };
          },
        }
      ),
    (err) => err instanceof AdminGenerateRejectedError && err.message.includes("không phù hợp")
  );
  assert.equal(calledProviders, 1);

  // Route returns HTTP 400 when input is gibberish ("hihi") even when authenticated
  const { NextRequest } = require("next/server");
  const token = createAdminSessionToken();
  const junkRes = await generateRoutePost(
    new NextRequest("http://localhost/api/admin/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${ADMIN_COOKIE_NAME}=${token}`,
      },
      body: JSON.stringify({ kind: "vocabulary", topic: "hihi" }),
    })
  );
  assert.equal(junkRes.status, 400);
  const junkJson = await junkRes.json();
  assert.equal(junkJson.ok, false);
  assert.match(junkJson.error, /không phù hợp/i);
});

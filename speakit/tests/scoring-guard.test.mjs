import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const jiti = require("jiti")(__filename);

const { detectInvalidEnglishInput, scoreLocally } = jiti(
  resolve(__dirname, "../lib/localScorer.ts")
);
const { evaluateWithWaterfall } = jiti(
  resolve(__dirname, "../lib/ai-waterfall.ts")
);
const { POST: scorePostRoute } = jiti(
  resolve(__dirname, "../app/api/score/route.ts")
);

test("detectInvalidEnglishInput rejects reported review leak, Vietnamese, teencode, short, and gibberish inputs", () => {
  const invalidSamples = [
    "sao ghi hell cx đc 18đ v m",
    "sao ghi hell cx dc 18d v m",
    "khong biet noi gi het",
    "ko dc dau nha",
    "vay zay vl vcl troll",
    "Hôm nay tôi fixed cái bug rồi",
    "hell",
    "hello",
    "hi u",
    "",
    "   ",
    "123 456 789",
    "asdfgh jklzxc",
    "qwerty uiop",
    "a b c d e",
    "v m k j z",
    "aaaaaa bbbbbb",
    "blabla hahaha",
    "ab cd ef gh",
    "fjdksl rtyuio",
  ];

  for (const sample of invalidSamples) {
    const res = detectInvalidEnglishInput(sample);
    assert.equal(res.invalid, true, `Expected invalid=true for: "${sample}"`);
  }
});

test("detectInvalidEnglishInput accepts genuine ESL IT English and never flags short English function words", () => {
  const validSamples = [
    "I fixed bug in React app",
    "We restart API server today",
    "Yesterday I completed the authentication module and pushed a pull request.",
    "Hello, my name is Minh and I am a final-year IT student.",
    "I use HTML, CSS, SQL, and JWT for authentication.",
    "My team is in the office so I do not go to be on time or fix it at all for me, no blockers.",
    "Do it on my PR",
    "We deploy CI/CD pipeline on AWS",
  ];

  for (const sample of validSamples) {
    const res = detectInvalidEnglishInput(sample);
    assert.equal(res.invalid, false, `Expected invalid=false for: "${sample}" (got reason=${res.reason}, tokens=${res.matchedTokens.join(",")})`);
  }
});

test("scoreLocally returns 0/100 for invalid inputs and positive scores for genuine IT English", () => {
  const keywords = ["yesterday", "fixed", "completed", "pull request"];

  for (const badInput of [
    "sao ghi hell cx đc 18đ v m",
    "sao ghi hell cx dc",
    "khong lam duoc bai nay nhe",
    "asdfgh jklzxc",
    "a b c d e",
    "hell",
    "",
  ]) {
    const result = scoreLocally({
      transcript: badInput,
      expectedKeywords: keywords,
      sampleAnswerEN: "Yesterday I fixed the login bug and opened a pull request.",
    });
    assert.equal(result.score, 0, `Expected score=0 for "${badInput}", got ${result.score}`);
    assert.deepEqual(result.keywordsUsed, []);
    assert.deepEqual(result.keywordsMissed, keywords);
    assert.ok(result.pronunciationNote.includes("Đánh giá phát âm ước lượng từ văn bản"));
    assert.ok(result.grammarCorrections.length >= 1);
    assert.equal(result.evaluationMode, "local_rules");
    assert.equal(result.provider, "local");
  }

  const esl1 = scoreLocally({
    transcript: "I fixed bug in React app",
    expectedKeywords: keywords,
  });
  assert.ok(esl1.score > 0, `Expected score > 0 for ESL input, got ${esl1.score}`);
  assert.deepEqual(esl1.keywordsUsed, ["fixed"]);

  const esl2 = scoreLocally({
    transcript: "We restart API server today",
    expectedKeywords: ["today", "api", "database"],
  });
  assert.ok(esl2.score > 0, `Expected score > 0 for ESL input, got ${esl2.score}`);
  assert.deepEqual(esl2.keywordsUsed, ["today", "api"]);
});

test("evaluateWithWaterfall short-circuits invalid inputs without calling LLM and guards prompt", async () => {
  let fetchCalls = 0;
  let capturedSystemPrompt = "";

  const spyFetch = async (_url, init) => {
    fetchCalls += 1;
    const body = JSON.parse(String(init?.body || "{}"));
    capturedSystemPrompt = body?.messages?.[0]?.content || "";
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 72,
                keywordsUsed: ["fixed"],
                keywordsMissed: ["pull request"],
                grammarCorrections: [],
                betterSentence: "Yesterday I fixed the bug in our React app.",
                pronunciationNote:
                  "Đánh giá phát âm ước lượng từ văn bản: Phát âm rõ âm đuôi /t/ trong fixed.",
                nextQuestion: "Did you write tests for that fix?",
              }),
            },
          },
        ],
      }),
    };
  };

  const envWithKey = {
    CEREBRAS_API_KEY: "test-key",
  };

  const blocked = await evaluateWithWaterfall({
    transcript: "sao ghi hell cx đc 18đ v m",
    scenario: "daily-standup",
    turnIndex: 0,
    expectedKeywords: ["yesterday", "fixed", "pull request"],
    env: envWithKey,
    fetchFn: spyFetch,
  });

  assert.equal(fetchCalls, 0);
  assert.equal(blocked.score, 0);
  assert.deepEqual(blocked.keywordsUsed, []);
  assert.equal(blocked.provider, "local");

  const valid = await evaluateWithWaterfall({
    transcript: "I fixed bug in React app",
    scenario: "daily-standup",
    turnIndex: 0,
    expectedKeywords: ["fixed", "pull request"],
    env: envWithKey,
    fetchFn: spyFetch,
  });

  assert.equal(fetchCalls, 1);
  assert.ok(valid.score > 0);
  assert.match(capturedSystemPrompt, /teencode/i);
  assert.match(capturedSystemPrompt, /"score": 0/);
});

test("POST /api/score rejects Vietnamese/teencode/gibberish with score 0 and keeps valid IT English scoring", async () => {
  const { NextRequest } = require("next/server");
  const envKeys = [
    "CEREBRAS_API_KEY",
    "INCEPTION_API_KEY",
    "GROQ_API_KEY",
    "XKIRO_API_KEY",
    "OPENROUTER_API_KEY",
    "GEMINI_API_KEY",
  ];
  const savedEnv = Object.fromEntries(envKeys.map((k) => [k, process.env[k]]));
  for (const k of envKeys) {
    delete process.env[k];
  }

  try {
    for (const badTranscript of [
      "sao ghi hell cx đc 18đ v m",
      "khong biet noi gi het luon",
      "asdfgh jklzxc",
    ]) {
      const req = new NextRequest("http://localhost:3000/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: badTranscript,
          scenario: "daily-standup",
          turnIndex: 0,
          expectedKeywords: ["yesterday", "fixed", "pull request"],
          history: [],
        }),
      });

      const res = await scorePostRoute(req);
      assert.equal(res.status, 200);
      const payload = await res.json();
      assert.equal(payload.score, 0);
      assert.deepEqual(payload.keywordsUsed, []);
      assert.deepEqual(payload.keywordsMissed, ["yesterday", "fixed", "pull request"]);
      assert.equal(payload.evaluationMode, "local_rules");
      assert.equal(payload.provider, "local");
      assert.equal(typeof payload.betterSentence, "string");
      assert.equal(typeof payload.pronunciationNote, "string");
      assert.ok(Array.isArray(payload.grammarCorrections));
    }

    const validReq = new NextRequest("http://localhost:3000/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript: "Yesterday I fixed the login bug and opened a pull request.",
        scenario: "daily-standup",
        turnIndex: 0,
        expectedKeywords: ["yesterday", "fixed", "pull request"],
        history: [],
      }),
    });

    const validRes = await scorePostRoute(validReq);
    assert.equal(validRes.status, 200);
    const validPayload = await validRes.json();
    assert.ok(validPayload.score > 0);
    assert.deepEqual(validPayload.keywordsUsed, ["yesterday", "fixed", "pull request"]);
    assert.deepEqual(validPayload.keywordsMissed, []);
  } finally {
    for (const k of envKeys) {
      if (savedEnv[k] === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = savedEnv[k];
      }
    }
  }
});

test("PracticeClient prevents pill wrapping and skips XP/coins on 0-score answers", () => {
  const practiceClientPath = resolve(
    __dirname,
    "../app/practice/[scenario]/PracticeClient.tsx"
  );
  const src = readFileSync(practiceClientPath, "utf8");

  assert.match(src, /grid-cols-3 gap-1\.5 sm:gap-2/);
  assert.match(
    src,
    /whitespace-nowrap flex items-center justify-center leading-tight py-2\.5 px-1\.5 sm:px-2\.5 text-\[10px\] sm:text-\[11px\][\s\S]*30% Ngữ pháp/
  );
  assert.match(src, /if\s*\(\s*earned\s*>\s*0\s*\)\s*\{[\s\S]*awardPracticePoints\(earned\)/);
  assert.match(src, /if\s*\(\s*earned\s*>\s*0\s*\)\s*\{[\s\S]*reportGuestPracticePoints/);
});

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
  DEFAULT_VOICE_PERSONA,
  MAX_TTS_TEXT_LENGTH,
  normalizeVoicePersona,
  getNeuralVoiceForPersona,
  formatTtsRate,
  validateTtsInput,
} = jiti(resolve(__dirname, "../lib/speech.ts"));

const { playTtsAudio } = jiti(resolve(__dirname, "../lib/tts-player.ts"));

test("neural voice persona defaults and mappings", () => {
  assert.equal(DEFAULT_VOICE_PERSONA, "beginner_sg");
  assert.equal(normalizeVoicePersona(undefined), "beginner_sg");
  assert.equal(normalizeVoicePersona("auto"), "beginner_sg");
  assert.equal(normalizeVoicePersona("us-hr-female"), "hr_us_female");
  assert.equal(normalizeVoicePersona("us-tech-lead"), "lead_us_male");
  assert.equal(normalizeVoicePersona("uk-client"), "client_uk");

  assert.equal(getNeuralVoiceForPersona("beginner_sg"), "en-SG-LunaNeural");
  assert.equal(getNeuralVoiceForPersona("hr_us_female"), "en-US-JennyNeural");
  assert.equal(getNeuralVoiceForPersona("lead_us_male"), "en-US-AndrewNeural");
  assert.equal(getNeuralVoiceForPersona("client_uk"), "en-GB-SoniaNeural");
});

test("validateTtsInput enforces non-empty and 600 char limit", () => {
  assert.equal(MAX_TTS_TEXT_LENGTH, 600);
  assert.equal(validateTtsInput("").ok, false);
  assert.equal(validateTtsInput("   ").ok, false);
  assert.equal(validateTtsInput("a".repeat(601)).ok, false);
  assert.equal(validateTtsInput("a".repeat(600)).ok, true);
  assert.equal(validateTtsInput("  hello  ").text, "hello");
});

test("formatTtsRate converts numeric multipliers to SSML percentages", () => {
  assert.equal(formatTtsRate(0.8), "-20%");
  assert.equal(formatTtsRate(1.0), "+0%");
  assert.equal(formatTtsRate(1.2), "+20%");
  assert.equal(formatTtsRate("-15%"), "-15%");
});

test("playTtsAudio falls back to speechSynthesis when /api/tts fails", async () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    fetch: async () => ({ ok: false, status: 502 }),
    URL: { createObjectURL: () => "blob:mock", revokeObjectURL: () => {} },
    Audio: class {},
  };

  let fallbackCalled = false;
  let capturedPersona = "";
  let ended = false;

  try {
    playTtsAudio({
      text: "Hello team",
      rate: 1.0,
      persona: "beginner_sg",
      onEnd: () => {
        ended = true;
      },
      deps: {
        fetchFn: async () => ({ ok: false, status: 502 }),
        fallbackSpeak: (_text, _rate, onEnd, _onError, persona) => {
          fallbackCalled = true;
          capturedPersona = persona;
          onEnd?.();
          return () => {};
        },
      },
    });

    await new Promise((r) => setTimeout(r, 20));
    assert.equal(fallbackCalled, true);
    assert.equal(capturedPersona, "beginner_sg");
    assert.equal(ended, true);
  } finally {
    globalThis.window = originalWindow;
  }
});

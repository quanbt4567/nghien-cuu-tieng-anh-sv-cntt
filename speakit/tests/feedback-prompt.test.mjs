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
  FEEDBACK_STORAGE_KEY,
  FEEDBACK_SESSION_KEY,
  DISMISS_COOLDOWN_MS,
  SUBMIT_COOLDOWN_MS,
  shouldShowFeedbackPrompt,
  canShowFeedbackPrompt,
  recordFeedbackPromptShown,
  recordFeedbackDismissed,
  recordFeedbackSubmitted,
} = jiti(resolve(__dirname, "../lib/feedbackPrompt.ts"));

const BASE_NOW = 1_700_000_000_000;

test("fresh user sees feedback prompt", () => {
  assert.equal(shouldShowFeedbackPrompt({}, BASE_NOW), true);
  assert.equal(
    shouldShowFeedbackPrompt(
      { lastSubmittedAt: null, lastDismissedAt: null, shownInSession: false },
      BASE_NOW
    ),
    true
  );
});

test("session cap blocks prompt when already shown in session", () => {
  assert.equal(shouldShowFeedbackPrompt({ shownInSession: true }, BASE_NOW), false);
});

test("24h dismiss cooldown blocks prompt before expiry and allows after", () => {
  const dismissedAt = BASE_NOW;
  assert.equal(
    shouldShowFeedbackPrompt({ lastDismissedAt: dismissedAt }, dismissedAt + DISMISS_COOLDOWN_MS - 1),
    false
  );
  assert.equal(
    shouldShowFeedbackPrompt({ lastDismissedAt: dismissedAt }, dismissedAt + DISMISS_COOLDOWN_MS),
    true
  );
});

test("72h submit cooldown blocks prompt before expiry and allows after", () => {
  const submittedAt = BASE_NOW;
  assert.equal(
    shouldShowFeedbackPrompt({ lastSubmittedAt: submittedAt }, submittedAt + SUBMIT_COOLDOWN_MS - 1),
    false
  );
  assert.equal(
    shouldShowFeedbackPrompt({ lastSubmittedAt: submittedAt }, submittedAt + SUBMIT_COOLDOWN_MS),
    true
  );
});

test("browser storage wrappers respect session cap and cooldowns", () => {
  const prevWindow = globalThis.window;
  const local = new Map();
  const session = new Map();

  globalThis.window = {
    localStorage: {
      getItem: (k) => (local.has(k) ? local.get(k) : null),
      setItem: (k, v) => local.set(k, String(v)),
    },
    sessionStorage: {
      getItem: (k) => (session.has(k) ? session.get(k) : null),
      setItem: (k, v) => session.set(k, String(v)),
    },
  };

  try {
    assert.equal(canShowFeedbackPrompt(BASE_NOW), true);

    recordFeedbackPromptShown();
    assert.equal(session.get(FEEDBACK_SESSION_KEY), "1");
    assert.equal(canShowFeedbackPrompt(BASE_NOW), false);

    session.clear();
    recordFeedbackDismissed(BASE_NOW);
    assert.ok(local.has(FEEDBACK_STORAGE_KEY));
    session.clear();
    assert.equal(canShowFeedbackPrompt(BASE_NOW + DISMISS_COOLDOWN_MS - 1000), false);
    assert.equal(canShowFeedbackPrompt(BASE_NOW + DISMISS_COOLDOWN_MS), true);

    recordFeedbackSubmitted(BASE_NOW);
    session.clear();
    assert.equal(canShowFeedbackPrompt(BASE_NOW + SUBMIT_COOLDOWN_MS - 1000), false);
    assert.equal(canShowFeedbackPrompt(BASE_NOW + SUBMIT_COOLDOWN_MS), true);
  } finally {
    if (prevWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = prevWindow;
    }
  }
});

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
  FEATURE_GUIDES,
  GUIDE_DISABLED_STORAGE_KEY,
  GUIDE_DISMISSED_STORAGE_KEY,
  areAllGuidesDisabled,
  dismissGuide,
  isGuideDismissed,
  resetAllGuideDismissals,
  resolveGuideForPath,
  setAllGuidesDisabled,
  shouldAutoOpenGuide,
} = jiti(resolve(__dirname, "../lib/feature-guides.ts"));

function createMockStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

test("FEATURE_GUIDES defines 15 complete Vietnamese feature guides with unique ids and route prefixes", () => {
  assert.equal(FEATURE_GUIDES.length, 15);

  const ids = new Set();
  const prefixes = new Set();

  for (const guide of FEATURE_GUIDES) {
    assert.ok(guide.id && !ids.has(guide.id), `duplicate or empty id: ${guide.id}`);
    assert.ok(
      guide.routePrefix && !prefixes.has(guide.routePrefix),
      `duplicate or empty routePrefix: ${guide.routePrefix}`
    );
    ids.add(guide.id);
    prefixes.add(guide.routePrefix);

    assert.ok(guide.title.trim().length > 0);
    assert.ok(guide.subtitle.trim().length > 0);
    assert.ok(Array.isArray(guide.steps) && guide.steps.length >= 3);
    assert.ok(Array.isArray(guide.tips) && guide.tips.length >= 1);
  }
});

test("resolveGuideForPath resolves all feature routes and skips /, /admin, /guide, and unknown routes", () => {
  assert.equal(resolveGuideForPath("/"), null);
  assert.equal(resolveGuideForPath(""), null);
  assert.equal(resolveGuideForPath("/admin"), null);
  assert.equal(resolveGuideForPath("/admin/dashboard"), null);
  assert.equal(resolveGuideForPath("/admin/content/scenarios"), null);
  assert.equal(resolveGuideForPath("/guide"), null);
  assert.equal(resolveGuideForPath("/scenarios-legacy"), null);

  const expectedMatches = [
    ["/practice/daily-standup", "practice"],
    ["/practice/custom-id?turn=1", "practice"],
    ["/scenarios", "scenarios"],
    ["/scenarios/", "scenarios"],
    ["/vocabulary", "vocabulary"],
    ["/arena", "arena"],
    ["/arena/", "arena"],
    ["/arena/party", "arena-party"],
    ["/arena/party?room=ABC123", "arena-party"],
    ["/arena/duel", "arena-duel"],
    ["/arena/taboo", "arena-taboo"],
    ["/arena/word-chain", "arena-word-chain"],
    ["/placement", "placement"],
    ["/progress", "progress"],
    ["/shop", "shop"],
    ["/leaderboard", "leaderboard"],
    ["/profile", "profile"],
    ["/profile/player-1", "profile"],
    ["/research", "research"],
    ["/research/ef-epi-2025", "research"],
    ["/settings", "settings"],
  ];

  for (const [path, expectedId] of expectedMatches) {
    const match = resolveGuideForPath(path);
    assert.ok(match, `expected guide match for ${path}`);
    assert.equal(match.id, expectedId, `wrong guide id for ${path}`);
  }
});

test("storage helpers are SSR-safe when window and storage are unavailable", () => {
  assert.equal(isGuideDismissed("scenarios"), false);
  assert.equal(areAllGuidesDisabled(), false);
  assert.equal(shouldAutoOpenGuide("/scenarios"), false);

  assert.doesNotThrow(() => {
    dismissGuide("scenarios");
    setAllGuidesDisabled(true);
    resetAllGuideDismissals();
  });
});

test("dismissGuide, setAllGuidesDisabled, resetAllGuideDismissals, and shouldAutoOpenGuide persist properly", () => {
  const storage = createMockStorage();

  assert.equal(shouldAutoOpenGuide("/", storage), false);
  assert.equal(shouldAutoOpenGuide("/admin", storage), false);
  assert.equal(shouldAutoOpenGuide("/scenarios", storage), true);
  assert.equal(shouldAutoOpenGuide("/vocabulary", storage), true);
  assert.equal(shouldAutoOpenGuide("/arena/party", storage), true);

  dismissGuide("scenarios", storage);
  dismissGuide("scenarios", storage);
  assert.equal(isGuideDismissed("scenarios", storage), true);
  assert.equal(isGuideDismissed("vocabulary", storage), false);
  assert.equal(shouldAutoOpenGuide("/scenarios", storage), false);
  assert.equal(shouldAutoOpenGuide("/vocabulary", storage), true);

  const rawDismissed = JSON.parse(storage.getItem(GUIDE_DISMISSED_STORAGE_KEY));
  assert.deepEqual(rawDismissed, ["scenarios"]);

  setAllGuidesDisabled(true, storage);
  assert.equal(areAllGuidesDisabled(storage), true);
  assert.equal(storage.getItem(GUIDE_DISABLED_STORAGE_KEY), "1");
  assert.equal(shouldAutoOpenGuide("/vocabulary", storage), false);
  assert.equal(shouldAutoOpenGuide("/arena/party", storage), false);

  setAllGuidesDisabled(false, storage);
  assert.equal(areAllGuidesDisabled(storage), false);
  assert.equal(shouldAutoOpenGuide("/vocabulary", storage), true);
  assert.equal(shouldAutoOpenGuide("/scenarios", storage), false);

  resetAllGuideDismissals(storage);
  assert.equal(isGuideDismissed("scenarios", storage), false);
  assert.equal(shouldAutoOpenGuide("/scenarios", storage), true);
});

test("storage helpers tolerate malformed JSON and fallback storage without removeItem", () => {
  const brokenStorage = createMockStorage({
    [GUIDE_DISMISSED_STORAGE_KEY]: "{not-valid-json",
  });

  assert.equal(isGuideDismissed("practice", brokenStorage), false);
  dismissGuide("practice", brokenStorage);
  assert.equal(isGuideDismissed("practice", brokenStorage), true);

  const minimalStore = new Map();
  const minimalStorage = {
    getItem(key) {
      return minimalStore.has(key) ? minimalStore.get(key) : null;
    },
    setItem(key, value) {
      minimalStore.set(key, String(value));
    },
  };

  setAllGuidesDisabled(true, minimalStorage);
  assert.equal(areAllGuidesDisabled(minimalStorage), true);
  setAllGuidesDisabled(false, minimalStorage);
  assert.equal(areAllGuidesDisabled(minimalStorage), false);

  dismissGuide("arena-duel", minimalStorage);
  assert.equal(isGuideDismissed("arena-duel", minimalStorage), true);
  resetAllGuideDismissals(minimalStorage);
  assert.equal(isGuideDismissed("arena-duel", minimalStorage), false);
});

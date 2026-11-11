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
  GUEST_SESSION_COOKIE_NAME,
  GUEST_TRANSFER_STORAGE_KEY,
  GUEST_COOKIE_MAX_AGE_SECONDS,
  generateTransferCode,
  normalizeTransferCode,
  hashDeviceToken,
  parseOwnedItems,
  serializePublicGuestPlayer,
  restoreByTransferCode: restoreSessionFromAuth,
} = jiti(resolve(__dirname, "../lib/neon-auth.ts"));

const {
  COSMETIC_CATALOG,
  findCosmeticById,
  getRingBadgeClass,
} = jiti(resolve(__dirname, "../lib/cosmetics.ts"));

const {
  initOrHydrateGuestSession,
  getTopPlayers,
  rewardPracticePoints,
  purchaseAndEquipCosmetic,
  updateGuestDisplayName,
  restoreByTransferCode,
} = jiti(resolve(__dirname, "../app/actions/leaderboard.ts"));

const { LocalStorageAdapter } = jiti(
  resolve(__dirname, "../lib/storage/localStorageAdapter.ts")
);

function installWindowMock() {
  const prevWindow = globalThis.window;
  const store = new Map();
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
  };
  return {
    store,
    restore: () => {
      globalThis.window = prevWindow;
    },
  };
}

function withClearedDatabaseUrl(fn) {
  const prevDbUrl = process.env.DATABASE_URL;
  const prevUnpooled = process.env.DATABASE_URL_UNPOOLED;
  delete process.env.DATABASE_URL;
  delete process.env.DATABASE_URL_UNPOOLED;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (prevDbUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = prevDbUrl;
      }
      if (prevUnpooled === undefined) {
        delete process.env.DATABASE_URL_UNPOOLED;
      } else {
        process.env.DATABASE_URL_UNPOOLED = prevUnpooled;
      }
    });
}

test("transfer code generation and normalization follow DEV-XXXXXX contract", () => {
  assert.equal(GUEST_SESSION_COOKIE_NAME, "speakit_session_token");
  assert.equal(GUEST_TRANSFER_STORAGE_KEY, "speakit_transfer_code_v1");
  assert.equal(GUEST_COOKIE_MAX_AGE_SECONDS, 400 * 24 * 60 * 60);

  for (let i = 0; i < 15; i += 1) {
    const code = generateTransferCode();
    assert.match(code, /^DEV-[A-Z0-9]{6}$/);
    assert.equal(normalizeTransferCode(code), code);
  }

  assert.equal(normalizeTransferCode("  dev-ab12cd  "), "DEV-AB12CD");
  assert.equal(normalizeTransferCode("DEV-123"), null);
  assert.equal(normalizeTransferCode("USER-123456"), null);
  assert.equal(normalizeTransferCode("DEV-AB_12!"), null);
});

test("hashDeviceToken produces deterministic sha256 digest and differs across inputs", () => {
  const a1 = hashDeviceToken("token-alpha");
  const a2 = hashDeviceToken("token-alpha");
  const b1 = hashDeviceToken("token-beta");

  assert.equal(a1, a2);
  assert.notEqual(a1, b1);
  assert.match(a1, /^[a-f0-9]{64}$/);
});

test("parseOwnedItems and serializePublicGuestPlayer strip sensitive token hashes", () => {
  assert.deepEqual(parseOwnedItems(["title-bug-whisperer", 123]), [
    "title-bug-whisperer",
  ]);
  assert.deepEqual(parseOwnedItems('["ring-crimson"]'), ["ring-crimson"]);
  assert.deepEqual(parseOwnedItems("not-json"), []);

  const sanitized = serializePublicGuestPlayer({
    id: "guest-1",
    device_token_hash: "super-secret-sha256-hash",
    transfer_code: "DEV-7788AA",
    display_name: "Frontend Ninja",
    it_coins: 12,
    total_points: 12450,
    streak_days: 5,
    last_practice_date: "2026-11-12",
    equipped_title: "Bug Whisperer",
    equipped_ring: "ring-crimson",
    owned_items: ["title-bug-whisperer", "ring-crimson"],
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-12T00:00:00Z",
  });

  assert.equal("device_token_hash" in sanitized, false);
  assert.equal(sanitized.transferCode, "DEV-7788AA");
  assert.equal(sanitized.itCoins, 12);
  assert.equal(sanitized.totalPoints, 12450);
  assert.deepEqual(sanitized.ownedItems, [
    "title-bug-whisperer",
    "ring-crimson",
  ]);
});

test("cosmetic catalog prices, lookups, and ring styles remain valid", () => {
  assert.ok(COSMETIC_CATALOG.length >= 6);
  for (const item of COSMETIC_CATALOG) {
    assert.ok(item.price > 0);
    assert.equal(findCosmeticById(item.id)?.id, item.id);
    if (item.kind === "ring") {
      assert.notEqual(getRingBadgeClass(item.value), "border-ink/20");
    }
  }
  assert.equal(findCosmeticById("missing-item"), undefined);
  assert.equal(getRingBadgeClass("default"), "border-ink/20");
});

test("server actions clamp scores and fall back gracefully without DATABASE_URL", async () => {
  await withClearedDatabaseUrl(async () => {
    const hydrated = await initOrHydrateGuestSession("DEV-9988AA");
    assert.deepEqual(hydrated, { mode: "offline", player: null });

    const top = await getTopPlayers(50);
    assert.deepEqual(top, {
      mode: "offline",
      players: [],
      currentPlayer: null,
      currentUserRank: null,
    });

    const clampedHigh = await rewardPracticePoints("daily-standup", 99999);
    assert.equal(clampedHigh.ok, true);
    assert.equal(clampedHigh.mode, "offline");
    assert.equal(clampedHigh.awardedPoints, 1000);
    assert.equal(clampedHigh.player, null);

    const negativeScore = await rewardPracticePoints("daily-standup", -50);
    assert.equal(negativeScore.ok, false);
    assert.equal(negativeScore.awardedPoints, 0);

    const missingItem = await purchaseAndEquipCosmetic("non-existent", 1);
    assert.equal(missingItem.ok, false);

    const negativePrice = await purchaseAndEquipCosmetic("ring-crimson", -5);
    assert.equal(negativePrice.ok, false);

    const offlineShop = await purchaseAndEquipCosmetic("ring-crimson", 1);
    assert.equal(offlineShop.ok, false);
    assert.equal(offlineShop.mode, "offline");

    const invalidName = await updateGuestDisplayName("A");
    assert.equal(invalidName.ok, false);

    const offlineName = await updateGuestDisplayName("SeniorDev");
    assert.equal(offlineName.ok, false);
    assert.equal(offlineName.mode, "offline");

    const badRestore = await restoreSessionFromAuth("invalid-code");
    assert.equal(badRestore.ok, false);

    const offlineRestore = await restoreByTransferCode("DEV-AB12CD");
    assert.equal(offlineRestore.ok, false);
    assert.equal(offlineRestore.mode, "offline");
  });
});

test("user settings exclude client-side geminiApiKey while keeping speech preferences", () => {
  const win = installWindowMock();
  try {
    const adapter = new LocalStorageAdapter();
    const initial = adapter.getSettings();
    assert.equal("geminiApiKey" in initial, false);
    assert.equal(initial.speechRate, 1.0);
    assert.equal(initial.autoPlayAudio, true);

    adapter.saveSettings({ speechRate: 1.2, autoPlayAudio: false });
    const updated = adapter.getSettings();
    assert.equal(updated.speechRate, 1.2);
    assert.equal(updated.autoPlayAudio, false);
    assert.equal(win.store.has("speakit_gemini_key"), false);
  } finally {
    win.restore();
  }
});


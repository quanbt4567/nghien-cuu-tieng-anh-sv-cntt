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
  ZERO_COIN_RETENTION_DAYS,
  isExpiredZeroCoinGuest,
  cleanupExpiredZeroCoinGuests,
} = jiti(resolve(__dirname, "../lib/neon-auth.ts"));

const DAY_MS = 24 * 60 * 60 * 1000;

test("ZERO_COIN_RETENTION_DAYS is 7 days", () => {
  assert.equal(ZERO_COIN_RETENTION_DAYS, 7);
});

test("isExpiredZeroCoinGuest preserves it_coins = 0 within 7 days and expires after 7 days", () => {
  const now = new Date("2026-11-15T00:00:00.000Z");
  const nowMs = now.getTime();

  assert.equal(
    isExpiredZeroCoinGuest(
      { it_coins: 0, updated_at: new Date(nowMs - 6.9 * DAY_MS).toISOString() },
      now
    ),
    false
  );

  assert.equal(
    isExpiredZeroCoinGuest(
      { it_coins: 0, updated_at: new Date(nowMs - 7 * DAY_MS).toISOString() },
      now
    ),
    false
  );

  assert.equal(
    isExpiredZeroCoinGuest(
      { it_coins: 0, updated_at: new Date(nowMs - 7.1 * DAY_MS).toISOString() },
      now
    ),
    true
  );

  assert.equal(
    isExpiredZeroCoinGuest(
      { it_coins: -5, updated_at: new Date(nowMs - 7.1 * DAY_MS).toISOString() },
      nowMs
    ),
    true
  );
});

test("isExpiredZeroCoinGuest preserves accounts with it_coins > 0 even at 30 days", () => {
  const now = new Date("2026-11-15T00:00:00.000Z");
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS).toISOString();

  assert.equal(
    isExpiredZeroCoinGuest({ it_coins: 1, updated_at: thirtyDaysAgo }, now),
    false
  );
  assert.equal(
    isExpiredZeroCoinGuest({ it_coins: 100, updated_at: thirtyDaysAgo }, now),
    false
  );
});

test("isExpiredZeroCoinGuest returns false for invalid dates", () => {
  const now = Date.now();
  assert.equal(
    isExpiredZeroCoinGuest({ it_coins: 0, updated_at: "not-a-date" }, now),
    false
  );
  assert.equal(
    isExpiredZeroCoinGuest(
      { it_coins: 0, updated_at: new Date(now - 30 * DAY_MS).toISOString() },
      Number.NaN
    ),
    false
  );
});

test("cleanupExpiredZeroCoinGuests returns 0 safely when DATABASE_URL is unset", async () => {
  const prevUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const deleted = await cleanupExpiredZeroCoinGuests({ force: true });
    assert.equal(deleted, 0);
  } finally {
    if (prevUrl !== undefined) {
      process.env.DATABASE_URL = prevUrl;
    }
  }
});

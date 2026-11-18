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
  normalizeEmail,
  validatePassword,
  hashPassword,
  verifyPassword,
  serializePublicGuestPlayer,
  registerWithEmailPassword,
  loginWithEmailPassword,
} = jiti(resolve(__dirname, "../lib/neon-auth.ts"));

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

test("normalizeEmail and validatePassword enforce email & password rules", () => {
  assert.equal(normalizeEmail("  MinhQuan@Example.COM "), "minhquan@example.com");
  assert.equal(normalizeEmail("not-an-email"), null);
  assert.equal(normalizeEmail(""), null);

  assert.equal(validatePassword("12345").valid, false);
  assert.equal(validatePassword("secret123").valid, true);
  assert.equal(validatePassword("a".repeat(129)).valid, false);
});

test("hashPassword and verifyPassword use salted scrypt and resist tampering", () => {
  const hashA = hashPassword("SpeakIT@2026");
  const hashB = hashPassword("SpeakIT@2026");

  assert.ok(hashA.startsWith("scrypt$"));
  assert.notEqual(hashA, hashB);
  assert.equal(verifyPassword("SpeakIT@2026", hashA), true);
  assert.equal(verifyPassword("wrong-password", hashA), false);
  assert.equal(verifyPassword("SpeakIT@2026", "malformed-hash"), false);
  assert.equal(verifyPassword("SpeakIT@2026", null), false);
});

test("serializePublicGuestPlayer includes normalized email and strips secrets", () => {
  const sanitized = serializePublicGuestPlayer({
    id: "acc-1",
    device_token_hash: "secret-device-hash",
    password_hash: "scrypt$salt$secret-password-hash",
    transfer_code: "DEV-PUWSP7",
    display_name: "Minh Quân",
    email: "  Quan@IUH.EDU.VN ",
    it_coins: 113,
    total_points: 64711,
    streak_days: 3,
    last_practice_date: "2026-11-17",
    equipped_title: "Cloud Architect",
    equipped_ring: "default",
    owned_items: [],
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-17T00:00:00Z",
  });

  assert.equal(sanitized.email, "quan@iuh.edu.vn");
  assert.equal("password_hash" in sanitized, false);
  assert.equal("device_token_hash" in sanitized, false);
});

test("registerWithEmailPassword and loginWithEmailPassword validate inputs and degrade gracefully offline", async () => {
  const badEmail = await registerWithEmailPassword({
    email: "invalid",
    password: "password123",
    displayName: "Minh Quân",
  });
  assert.equal(badEmail.ok, false);

  const shortPw = await registerWithEmailPassword({
    email: "user@example.com",
    password: "123",
    displayName: "Minh Quân",
  });
  assert.equal(shortPw.ok, false);

  const shortName = await registerWithEmailPassword({
    email: "user@example.com",
    password: "password123",
    displayName: "A",
  });
  assert.equal(shortName.ok, false);

  await withClearedDatabaseUrl(async () => {
    const regOffline = await registerWithEmailPassword({
      email: "user@example.com",
      password: "password123",
      displayName: "Minh Quân",
    });
    assert.equal(regOffline.ok, false);
    assert.equal(regOffline.mode, "offline");

    const loginOffline = await loginWithEmailPassword({
      email: "user@example.com",
      password: "password123",
    });
    assert.equal(loginOffline.ok, false);
    assert.equal(loginOffline.mode, "offline");
  });
});

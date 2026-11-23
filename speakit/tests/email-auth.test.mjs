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
  GUEST_COOKIE_MAX_AGE_SECONDS,
  GUEST_SESSION_STORAGE_KEY,
  buildSessionCookieOptions,
  shouldUseSecureCookie,
  generateSessionToken,
  normalizeSessionToken,
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

test("buildSessionCookieOptions and shouldUseSecureCookie configure persistent 400-day HttpOnly cookies", () => {
  assert.equal(GUEST_SESSION_STORAGE_KEY, "speakit_session_token_v1");
  assert.ok(GUEST_COOKIE_MAX_AGE_SECONDS >= 90 * 24 * 60 * 60);

  const nowMs = 1700000000000;
  const opts = buildSessionCookieOptions(true, GUEST_COOKIE_MAX_AGE_SECONDS, nowMs);
  assert.equal(opts.httpOnly, true);
  assert.equal(opts.sameSite, "lax");
  assert.equal(opts.path, "/");
  assert.equal(opts.secure, true);
  assert.equal(opts.maxAge, GUEST_COOKIE_MAX_AGE_SECONDS);
  assert.equal(opts.expires.getTime(), nowMs + GUEST_COOKIE_MAX_AGE_SECONDS * 1000);

  const clearOpts = buildSessionCookieOptions(false, 0, nowMs);
  assert.equal(clearOpts.maxAge, 0);
  assert.equal(clearOpts.expires.getTime(), 0);
  assert.equal(clearOpts.secure, false);

  const httpsHeaders = new Headers({ "x-forwarded-proto": "https" });
  assert.equal(shouldUseSecureCookie(httpsHeaders), true);

  const httpHeaders = new Headers({ "x-forwarded-proto": "http" });
  assert.equal(shouldUseSecureCookie(httpHeaders), false);

  const originHttp = new Headers({ origin: "http://localhost:3000" });
  assert.equal(shouldUseSecureCookie(originHttp), false);

  const originHttps = new Headers({ origin: "https://speakit-bcn.vercel.app" });
  assert.equal(shouldUseSecureCookie(originHttps), true);
});

test("normalizeSessionToken accepts 256-bit session tokens and rejects DEV-XXXXXX transfer codes", () => {
  const token = generateSessionToken();
  assert.equal(normalizeSessionToken(token), token);
  assert.equal(normalizeSessionToken(`  ${token}  `), token);
  assert.equal(normalizeSessionToken("DEV-AB12CD"), null);
  assert.equal(normalizeSessionToken("short-token"), null);
  assert.equal(normalizeSessionToken("invalid token with spaces and !@#"), null);
  assert.equal(normalizeSessionToken(null), null);
});

test("multi-device session persistence and cosmetic equip keep email intact", async () => {
  const { readFileSync } = await import("node:fs");
  const authSource = readFileSync(
    resolve(__dirname, "../lib/neon-auth.ts"),
    "utf8"
  );
  const schemaSource = readFileSync(
    resolve(__dirname, "../lib/db/schema.ts"),
    "utf8"
  );
  const leaderboardSource = readFileSync(
    resolve(__dirname, "../app/actions/leaderboard.ts"),
    "utf8"
  );

  assert.match(schemaSource, /CREATE TABLE IF NOT EXISTS guest_sessions/);
  assert.match(authSource, /INSERT INTO guest_sessions/);

  const loginSection = authSource.slice(
    authSource.indexOf("export async function loginWithEmailPassword")
  );
  assert.equal(
    /UPDATE guest_players[\s\S]*?SET[\s\S]*?device_token_hash\s*=/.test(loginSection.split("export async function logoutGuestSession")[0]),
    false
  );

  const alreadyOwnedEquipBlock = leaderboardSource.slice(
    leaderboardSource.indexOf("if (alreadyOwned)"),
    leaderboardSource.indexOf("WITH target AS")
  );
  assert.match(alreadyOwnedEquipBlock, /RETURNING[\s\S]*?\bemail\b/);
});

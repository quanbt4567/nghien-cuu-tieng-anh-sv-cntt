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
  normalizePublicPlayerId,
  sanitizePublicProfileData,
  getPublicPlayerProfile,
} = jiti(resolve(__dirname, "../lib/public-profile.ts"));

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

test("normalizePublicPlayerId rejects invalid IDs and accepts valid UUIDs or guest IDs", () => {
  assert.equal(normalizePublicPlayerId(""), null);
  assert.equal(normalizePublicPlayerId("   "), null);
  assert.equal(normalizePublicPlayerId(null), null);
  assert.equal(normalizePublicPlayerId(undefined), null);
  assert.equal(normalizePublicPlayerId(12345), null);
  assert.equal(normalizePublicPlayerId("bad/id"), null);
  assert.equal(normalizePublicPlayerId("id; DROP TABLE guest_players"), null);
  assert.equal(normalizePublicPlayerId("a".repeat(129)), null);

  assert.equal(
    normalizePublicPlayerId("  550e8400-e29b-41d4-a716-446655440000  "),
    "550e8400-e29b-41d4-a716-446655440000"
  );
  assert.equal(normalizePublicPlayerId("guest_player-42"), "guest_player-42");
});

test("getPublicPlayerProfile returns null for invalid IDs without querying SQL", async () => {
  let called = false;
  const mockSql = async () => {
    called = true;
    return [];
  };

  assert.equal(await getPublicPlayerProfile("", mockSql), null);
  assert.equal(await getPublicPlayerProfile("  ", mockSql), null);
  assert.equal(await getPublicPlayerProfile("bad id!", mockSql), null);
  assert.equal(called, false);
});

test("getPublicPlayerProfile returns null when DB client is null or DATABASE_URL is missing", async () => {
  assert.equal(
    await getPublicPlayerProfile("550e8400-e29b-41d4-a716-446655440000", null),
    null
  );

  await withClearedDatabaseUrl(async () => {
    const result = await getPublicPlayerProfile(
      "550e8400-e29b-41d4-a716-446655440000"
    );
    assert.equal(result, null);
  });
});

test("sanitizePublicProfileData strips sensitive fields and computes itCoins, ownedCount, and devTitle", () => {
  const dirtyRow = {
    id: "player-uuid-1",
    display_name: "Async Architect",
    avatar_url: "https://example.com/avatar.png",
    total_points: 5200,
    it_coins: 1,
    streak_days: 7,
    equipped_title: "Bug Whisperer",
    equipped_ring: "ring-crimson",
    equipped_cosmetics: JSON.stringify({
      profile_theme: "theme-neon-meteor-shower",
      cursor_effect: "cursor-binary-spark",
    }),
    owned_items: ["title-bug-whisperer", "ring-crimson", "ring-crimson"],
    created_at: "2026-11-01T00:00:00.000Z",
    transfer_code: "DEV-SECRET",
    session_token: "secret-session-token",
    device_token_hash: "secret-device-hash",
    ip_hash: "secret-ip-hash",
  };

  const dirtyRuns = Array.from({ length: 7 }, (_, index) => ({
    id: `run-${index + 1}`,
    game_id: index % 2 === 0 ? "bug-buster" : "standup-speed-run",
    score: 1200 + index * 100,
    accuracy_or_words: index % 2 === 0 ? 12 : 45,
    duration_sec: 60,
    role: "frontend",
    created_at: `2026-11-10T0${index}:00:00.000Z`,
    transfer_code: "DEV-SECRET",
  }));

  const profile = sanitizePublicProfileData(dirtyRow, dirtyRuns);

  assert.equal("transfer_code" in profile, false);
  assert.equal("transferCode" in profile, false);
  assert.equal("session_token" in profile, false);
  assert.equal("device_token_hash" in profile, false);
  assert.equal("ip_hash" in profile, false);

  assert.equal(profile.id, "player-uuid-1");
  assert.equal(profile.displayName, "Async Architect");
  assert.equal(profile.avatarUrl, "https://example.com/avatar.png");
  assert.equal(profile.totalPoints, 5200);
  assert.equal(profile.itCoins, 3);
  assert.equal(profile.streakDays, 7);
  assert.equal(profile.devTitle, "Lead Tech Speaker");
  assert.equal(profile.equippedTitle, "Bug Whisperer");
  assert.equal(profile.equippedRing, "ring-crimson");
  assert.equal(
    profile.equippedCosmetics.profile_theme,
    "theme-neon-meteor-shower"
  );
  assert.equal(
    profile.equippedCosmetics.cursor_effect,
    "cursor-binary-spark"
  );
  assert.equal(profile.ownedCount, 2);
  assert.equal(profile.createdAt, "2026-11-01T00:00:00.000Z");

  assert.equal(profile.recentArenaRuns.length, 5);
  for (const run of profile.recentArenaRuns) {
    assert.equal("transfer_code" in run, false);
    assert.equal("transferCode" in run, false);
  }
});

test("getPublicPlayerProfile queries only public columns and returns sanitized profile with recent runs", async () => {
  const queries = [];
  const mockSql = async (strings) => {
    const queryText = strings.join("?");
    queries.push(queryText);
    if (queryText.includes("FROM speakit_arena_runs")) {
      return [
        {
          id: "run-a",
          game_id: "standup-speed-run",
          score: 850,
          accuracy_or_words: 34,
          duration_sec: 45,
          role: "backend",
          created_at: "2026-11-15T10:00:00.000Z",
        },
      ];
    }
    if (queryText.includes("FROM guest_players")) {
      return [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          display_name: "Clean Coder",
          avatar_url: null,
          total_points: 2500,
          it_coins: 2,
          streak_days: 3,
          equipped_title: "Junior Speaker",
          equipped_ring: "default",
          equipped_cosmetics: {},
          owned_items: [],
          created_at: new Date("2026-11-05T12:00:00.000Z"),
        },
      ];
    }
    return [];
  };

  const profile = await getPublicPlayerProfile(
    "550e8400-e29b-41d4-a716-446655440000",
    mockSql
  );

  assert.ok(profile);
  assert.equal(queries.length, 2);
  assert.equal(queries[0].includes("transfer_code"), false);
  assert.equal(queries[0].includes("session_token"), false);
  assert.equal(queries[0].includes("device_token_hash"), false);
  assert.equal(queries[1].includes("WHERE transfer_code = ("), true);
  assert.equal(profile.devTitle, "Mid-level Communicator");
  assert.equal(profile.itCoins, 2);
  assert.equal(profile.recentArenaRuns.length, 1);
  assert.equal(profile.recentArenaRuns[0].id, "run-a");
});

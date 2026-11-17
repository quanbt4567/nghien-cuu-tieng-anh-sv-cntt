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
  clampModerationCoins,
  detectSensitiveLanguage,
} = jiti(resolve(__dirname, "../lib/content-moderation.ts"));

const {
  createWordChainRoom,
  evaluateWordChainTurnLocal,
  moderateWordChainTurn,
  startWordChainRoom,
} = jiti(resolve(__dirname, "../lib/arena-moderator.ts"));

test("detectSensitiveLanguage flags profanity/slurs without false positives on IT terms", () => {
  for (const bad of [
    "nigga",
    "dick",
    "fuck",
    "bitch",
    "xvideos",
    "pornhub",
    "duma",
    "địt",
    "cặc",
    "lồn",
  ]) {
    const res = detectSensitiveLanguage(bad);
    assert.equal(res.flagged, true, `expected sensitive flag for '${bad}'`);
    assert.equal(res.category, "sensitive");
  }

  for (const safe of [
    "document",
    "cocktail",
    "classic",
    "class",
    "pass",
    "bypass",
    "analysis",
    "daemon",
    "shell",
    "react",
    "tailwind",
    "kill",
  ]) {
    const res = detectSensitiveLanguage(safe);
    assert.equal(res.flagged, false, `unexpected sensitive flag for '${safe}'`);
  }
});

test("Word Chain blocks sensitive words like 'nigga' and 'dick' and excludes them from history", async () => {
  const localNigga = evaluateWordChainTurnLocal({
    rawInput: "nigga",
    requiredChar: "N",
    usedWords: ["daemon"],
    currentStreak: 1,
    turnCount: 3,
  });
  assert.equal(localNigga.valid, false);
  assert.equal(localNigga.foulDetected, true);
  assert.equal(localNigga.sensitiveDetected, true);

  let room = createWordChainRoom({
    seedWord: "daemon",
    targetTurns: 12,
    hostPlayer: { id: "p1", displayName: "Minh" },
  });
  room = {
    ...room,
    players: [
      ...room.players,
      {
        id: "bot-chain",
        displayName: "Syntax Bot",
        isBot: true,
        score: 0,
        streak: 0,
        fouls: 0,
        itTermsCount: 0,
        alive: true,
      },
    ],
  };
  room = startWordChainRoom(room);

  const res = await moderateWordChainTurn({
    room: { ...room, requiredChar: "N" },
    playerId: "p1",
    wordInput: "nigga",
  });
  assert.equal(res.turnResult.valid, false);
  assert.equal(res.turnResult.foulDetected, true);
  assert.equal(res.room.usedWords.includes("nigga"), false);
  assert.equal(
    res.room.history.some((m) => m.word.toLowerCase() === "nigga"),
    false
  );

  for (const [char, junk] of [
    ["X", "xvideos"],
    ["D", "duma"],
    ["T", "tao"],
    ["I", "interger"],
  ]) {
    const junkRes = await moderateWordChainTurn({
      room: { ...room, requiredChar: char },
      playerId: "p1",
      wordInput: junk,
    });
    assert.equal(junkRes.turnResult.valid, false, `expected '${junk}' to be rejected`);
    assert.equal(junkRes.room.usedWords.includes(junk), false);
  }
});

test("clampModerationCoins bounds coin penalty to [0, 100]", () => {
  assert.equal(clampModerationCoins(undefined), 5);
  assert.equal(clampModerationCoins(-5), 0);
  assert.equal(clampModerationCoins(12.4), 12);
  assert.equal(clampModerationCoins(500), 100);
});

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
  DUEL_TOPICS,
  TABOO_CARDS,
  IT_WORD_CHAIN_TERMS,
  SEED_STARTING_WORDS,
  DYNAMIC_FUSE_RULES,
  isItChainTerm,
  pickBotChainWord,
} = jiti(resolve(__dirname, "../lib/arena-three-games-data.ts"));

const {
  playTick,
  playBuzzerFoul,
  playCriticalHit,
  playExplosion,
  playComboChime,
  playVictoryFanfare,
  isSfxMuted,
  setSfxMuted,
} = jiti(resolve(__dirname, "../lib/game-sfx.ts"));

const {
  detectVietnameseFoul,
  detectTabooViolation,
  evaluateDuelArgumentLocal,
  evaluateWordChainTurnLocal,
  computeWordChainFuseSeconds,
  createTabooRoom,
  fillTabooBot,
  startTabooRoom,
  moderateTabooTurn,
  createDuelRoom,
  fillDuelBot,
  startDuelRoom,
  moderateDuelTurn,
  executeArenaAction,
  getArenaRoomResponse,
} = jiti(resolve(__dirname, "../lib/arena-moderator.ts"));

test("dataset defines >=10 duel topics, >=50 taboo cards, and >=350 A-Z IT chain terms", () => {
  assert.ok(DUEL_TOPICS.length >= 10);
  const topicIds = new Set();
  for (const topic of DUEL_TOPICS) {
    assert.ok(topic.id && !topicIds.has(topic.id));
    topicIds.add(topic.id);
    assert.ok(topic.title.length > 5);
    assert.ok(topic.contextVI.length > 10);
    assert.ok(topic.authorStance.length > 10);
    assert.ok(topic.reviewerStance.length > 10);
    assert.ok(Array.isArray(topic.criticalKeywords) && topic.criticalKeywords.length >= 4);
    assert.ok(Array.isArray(topic.botArguments?.author) && topic.botArguments.author.length >= 3);
    assert.ok(Array.isArray(topic.botArguments?.reviewer) && topic.botArguments.reviewer.length >= 3);
  }

  assert.ok(TABOO_CARDS.length >= 50);
  const cardIds = new Set();
  const cardTerms = new Set();
  for (const card of TABOO_CARDS) {
    assert.ok(card.id && !cardIds.has(card.id));
    cardIds.add(card.id);
    assert.ok(card.term && !cardTerms.has(card.term.toLowerCase()));
    cardTerms.add(card.term.toLowerCase());
    assert.ok(card.category.length > 0);
    assert.ok(card.hintVI.length > 5);
    assert.equal(card.tabooWords.length, 3);
    assert.ok(Array.isArray(card.acceptableClues) && card.acceptableClues.length >= 3);
  }

  assert.ok(IT_WORD_CHAIN_TERMS.length >= 350);
  const firstLetters = new Set();
  const distinctTerms = new Set();
  for (const term of IT_WORD_CHAIN_TERMS) {
    assert.match(term, /^[a-z]{2,}$/);
    assert.ok(!distinctTerms.has(term));
    distinctTerms.add(term);
    firstLetters.add(term[0]);
  }
  assert.equal(firstLetters.size, 26);

  assert.ok(SEED_STARTING_WORDS.length >= 10);
  for (const seed of SEED_STARTING_WORDS) {
    assert.equal(isItChainTerm(seed), true);
  }
  assert.equal(DYNAMIC_FUSE_RULES.comboFuseSeconds, 5);
  assert.equal(DYNAMIC_FUSE_RULES.itTermMultiplier, 2);
  assert.equal(isItChainTerm("Kubernetes"), true);
  assert.equal(isItChainTerm("banana"), false);

  const botPick = pickBotChainWord("R", ["react", "redis"]);
  assert.ok(botPick && botPick.startsWith("r"));
  assert.notEqual(botPick, "react");
  assert.notEqual(botPick, "redis");
  assert.equal(isItChainTerm(botPick), true);
});

test("game-sfx gracefully no-ops in SSR/Node and persists mute state", () => {
  setSfxMuted(false);
  assert.equal(isSfxMuted(), false);
  setSfxMuted(true);
  assert.equal(isSfxMuted(), true);
  setSfxMuted(false);
  assert.equal(isSfxMuted(), false);

  assert.doesNotThrow(() => {
    playTick(0.8);
    playBuzzerFoul();
    playCriticalHit();
    playExplosion();
    playComboChime(3);
    playVictoryFanfare();
  });
});

test("detectVietnameseFoul flags diacritics and ASCII Vietnamese without false positives on IT English", () => {
  const cleanEnglish = detectVietnameseFoul(
    "We can add branch protection, canary deployment, and rollback monitoring so the pipeline stays safe."
  );
  assert.equal(cleanEnglish.detected, false);
  assert.deepEqual(cleanEnglish.matchedTokens, []);

  const englishAmbiguousWords = detectVietnameseFoul(
    "We may ban manual hotfixes because the team can test the container."
  );
  assert.equal(englishAmbiguousWords.detected, false);

  const diacriticVi = detectVietnameseFoul(
    "Chức năng này bị deadlock rồi, we need to rollback."
  );
  assert.equal(diacriticVi.detected, true);
  assert.ok(diacriticVi.matchedTokens.length >= 1);

  const asciiVi = detectVietnameseFoul("Khong duoc dau, check latency lai nhe.");
  assert.equal(asciiVi.detected, true);
  assert.ok(asciiVi.matchedTokens.includes("Khong"));
  assert.ok(asciiVi.matchedTokens.includes("duoc"));

  const duelFoul = evaluateDuelArgumentLocal({
    transcript: "Cai nay khong duoc merge dau",
    stance: "reviewer",
    topic: DUEL_TOPICS[0],
  });
  assert.equal(duelFoul.foulDetected, true);
  assert.equal(duelFoul.damageDealt, 0);
  assert.equal(duelFoul.criticalHit, false);

  const duelCrit = evaluateDuelArgumentLocal({
    transcript:
      "Rewriting shared history on main bypasses branch protection and breaks rollback audit trails.",
    stance: "reviewer",
    topic: DUEL_TOPICS[0],
  });
  assert.equal(duelCrit.foulDetected, false);
  assert.equal(duelCrit.criticalHit, true);
  assert.ok(duelCrit.damageDealt >= 26);
});

test("detectTabooViolation catches stemmed inflections of taboo words and target term", () => {
  const cacheCard = TABOO_CARDS.find((c) => c.id === "taboo-cache");
  assert.ok(cacheCard);

  const stemInflection = detectTabooViolation(
    "Engineers use this when caching responses and storing hot values.",
    cacheCard
  );
  assert.equal(stemInflection.violated, true);
  assert.ok(stemInflection.matchedWords.length >= 1);

  const memoryPlural = detectTabooViolation(
    "It keeps recent data across multiple memories for instant lookup.",
    cacheCard
  );
  assert.equal(memoryPlural.violated, true);
  assert.ok(memoryPlural.matchedWords.includes("memory"));

  const httpsCard = TABOO_CARDS.find((c) => c.id === "taboo-https");
  assert.ok(httpsCard);
  const encryptionStem = detectTabooViolation(
    "Browsers rely on strong encryption for web traffic safety.",
    httpsCard
  );
  assert.equal(encryptionStem.violated, true);
  assert.ok(encryptionStem.matchedWords.includes("encrypt"));

  const sqlCard = TABOO_CARDS.find((c) => c.id === "taboo-sql-injection");
  assert.ok(sqlCard);
  const queryingStem = detectTabooViolation(
    "Attackers abuse forms by querying sensitive records illegally.",
    sqlCard
  );
  assert.equal(queryingStem.violated, true);
  assert.ok(queryingStem.matchedWords.includes("query"));

  const cleanClue = detectTabooViolation(
    "This temporary Redis layer cuts latency on repeated reads using TTL.",
    cacheCard
  );
  assert.equal(cleanClue.violated, false);
  assert.deepEqual(cleanClue.matchedWords, []);
});

test("Word Chain IT-term x2 combo reduces next fuse to 5s and detects non-IT / fouls", () => {
  assert.equal(
    computeWordChainFuseSeconds({ turnCount: 1, comboTriggered: false }),
    12
  );
  assert.equal(
    computeWordChainFuseSeconds({ turnCount: 1, comboTriggered: true }),
    5
  );

  const nonIt = evaluateWordChainTurnLocal({
    rawInput: "elephant",
    requiredChar: "e",
    usedWords: ["edge"],
    currentStreak: 1,
    turnCount: 1,
  });
  assert.equal(nonIt.valid, true);
  assert.equal(nonIt.isItTerm, false);
  assert.equal(nonIt.nextStreak, 0);
  assert.equal(nonIt.multiplier, 1);
  assert.equal(nonIt.comboTriggered, false);
  assert.ok(nonIt.nextFuseSeconds > 5);

  const firstIt = evaluateWordChainTurnLocal({
    rawInput: "docker",
    requiredChar: "d",
    usedWords: ["cloud"],
    currentStreak: 0,
    turnCount: 1,
  });
  assert.equal(firstIt.valid, true);
  assert.equal(firstIt.isItTerm, true);
  assert.equal(firstIt.nextStreak, 1);
  assert.equal(firstIt.multiplier, 2);
  assert.equal(firstIt.comboTriggered, false);

  const secondIt = evaluateWordChainTurnLocal({
    rawInput: "redis",
    requiredChar: "r",
    usedWords: ["cloud", "docker"],
    currentStreak: firstIt.nextStreak,
    turnCount: 2,
  });
  assert.equal(secondIt.valid, true);
  assert.equal(secondIt.isItTerm, true);
  assert.equal(secondIt.nextStreak, 2);
  assert.equal(secondIt.multiplier, 2);
  assert.equal(secondIt.comboTriggered, true);
  assert.equal(secondIt.nextFuseSeconds, 5);

  const duplicate = evaluateWordChainTurnLocal({
    rawInput: "docker",
    requiredChar: "d",
    usedWords: ["docker"],
    currentStreak: 1,
    turnCount: 2,
  });
  assert.equal(duplicate.valid, false);
  assert.equal(duplicate.foulDetected, false);

  const wrongChar = evaluateWordChainTurnLocal({
    rawInput: "kafka",
    requiredChar: "r",
    usedWords: ["docker"],
    currentStreak: 1,
    turnCount: 2,
  });
  assert.equal(wrongChar.valid, false);
});

test("Taboo FEVER MODE activates 2x multiplier at streak >= 3 and resets on foul", async () => {
  const prevDb = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "";
  try {
    let room = createTabooRoom({
      roomCode: "TAB001",
      targetCards: 5,
      hostPlayer: { id: "host-1", displayName: "Minh" },
    });
    room = fillTabooBot(room);
    room = startTabooRoom(room);

    for (let i = 0; i < 3; i += 1) {
      const activeCard = TABOO_CARDS.find((c) => c.id === room.currentCardId);
      assert.ok(activeCard);
      const clue = activeCard.acceptableClues.slice(0, 2).join(" ") + " engineering concept";
      const turn = await moderateTabooTurn({
        room,
        playerId: "host-1",
        clue,
      });
      room = turn.room;
      assert.equal(turn.turnResult.guessedCorrectly, true);
      assert.equal(turn.turnResult.streak, i + 1);
      if (i < 2) {
        assert.equal(turn.turnResult.feverMode, false);
        assert.equal(turn.turnResult.multiplier, 1);
        assert.equal(turn.turnResult.pointsAwarded, 250);
      } else {
        assert.equal(turn.turnResult.feverMode, true);
        assert.equal(turn.turnResult.multiplier, 2);
        assert.equal(turn.turnResult.pointsAwarded, 500);
      }
    }

    const activeCardAfter = TABOO_CARDS.find((c) => c.id === room.currentCardId);
    assert.ok(activeCardAfter);
    const foulTurn = await moderateTabooTurn({
      room,
      playerId: "host-1",
      clue: `Using ${activeCardAfter.tabooWords[0]} directly`,
    });
    assert.equal(foulTurn.turnResult.tabooViolated, true);
    assert.equal(foulTurn.turnResult.streak, 0);
    assert.equal(foulTurn.turnResult.feverMode, false);
  } finally {
    process.env.DATABASE_URL = prevDb;
  }
});

test("executeArenaAction awards IT-Coins once without double-awarding across Duel and Word Chain", async () => {
  const prevDb = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "";
  let totalRewardedPoints = 0;

  const mockRewardFn = async (_scenarioId, rawScore) => {
    totalRewardedPoints += rawScore;
    return {
      ok: true,
      mode: "offline",
      awardedPoints: rawScore,
      player: {
        id: "player-test-1",
        transferCode: "DEV-TEST99",
        displayName: "Tester",
        itCoins: Math.floor(totalRewardedPoints / 1000),
        totalPoints: totalRewardedPoints,
        streakDays: 1,
        lastPracticeDate: "2026-11-17",
        equippedTitle: "Lead Tech Speaker",
        equippedRing: "default",
        ownedItems: [],
      },
    };
  };

  try {
    const basePlayer = {
      id: "player-test-1",
      transferCode: "DEV-TEST99",
      displayName: "Tester",
      itCoins: 0,
      totalPoints: 0,
      streakDays: 1,
      lastPracticeDate: "2026-11-17",
      equippedTitle: "Junior Speaker",
      equippedRing: "default",
      ownedItems: [],
    };

    const created = await executeArenaAction({
      gameType: "duel",
      body: { action: "create", topicId: "force-push-main", stance: "reviewer" },
      sessionPlayer: basePlayer,
      rewardPracticePointsFn: mockRewardFn,
    });
    assert.equal(created.status, 200);
    const roomCode = created.body.room.roomCode;
    assert.match(roomCode, /^[A-Z0-9]{6}$/);

    const fetched = await getArenaRoomResponse("duel", roomCode, basePlayer);
    assert.equal(fetched.status, 200);
    assert.equal(fetched.body.room.roomCode, roomCode);

    const botFilled = await executeArenaAction({
      gameType: "duel",
      body: { action: "fill_bot", code: roomCode },
      sessionPlayer: basePlayer,
      rewardPracticePointsFn: mockRewardFn,
    });
    assert.equal(botFilled.status, 200);
    assert.equal(botFilled.body.room.players.length, 2);

    const started = await executeArenaAction({
      gameType: "duel",
      body: { action: "start", code: roomCode },
      sessionPlayer: basePlayer,
      rewardPracticePointsFn: mockRewardFn,
    });
    assert.equal(started.status, 200);
    assert.equal(started.body.room.status, "active");

    let currentRoom = started.body.room;
    for (let i = 0; i < 4 && currentRoom.status === "active"; i += 1) {
      const turnRes = await executeArenaAction({
        gameType: "duel",
        body: {
          action: "turn",
          code: roomCode,
          transcript:
            "Rewriting shared history on main bypasses branch protection, breaks rollback safety, and causes merge conflict incidents.",
        },
        sessionPlayer: basePlayer,
        rewardPracticePointsFn: mockRewardFn,
      });
      assert.equal(turnRes.status, 200);
      currentRoom = turnRes.body.room;
    }

    assert.equal(currentRoom.status, "finished");
    assert.equal(currentRoom.rewardsAwarded, true);
    assert.ok(totalRewardedPoints >= 5000 && totalRewardedPoints <= 12000);
    const awardedAfterFinish = totalRewardedPoints;

    const leaveAfterFinish = await executeArenaAction({
      gameType: "duel",
      body: { action: "leave", code: roomCode },
      sessionPlayer: basePlayer,
      rewardPracticePointsFn: mockRewardFn,
    });
    assert.equal(leaveAfterFinish.status, 200);
    assert.equal(totalRewardedPoints, awardedAfterFinish);

    const resetRes = await executeArenaAction({
      gameType: "duel",
      body: { action: "reset", code: roomCode },
      sessionPlayer: basePlayer,
      rewardPracticePointsFn: mockRewardFn,
    });
    assert.equal(resetRes.status, 200);
    assert.equal(resetRes.body.room.status, "lobby");
    assert.equal(totalRewardedPoints, awardedAfterFinish);

    const duelObj = createDuelRoom({
      roomCode: "DUEL99",
      hostPlayer: { id: "h1", displayName: "Host", stance: "author" },
    });
    const duelBot = startDuelRoom(fillDuelBot(duelObj));
    const duelTurn = await moderateDuelTurn({
      room: duelBot,
      playerId: "h1",
      transcript: "Squashing commits keeps linear history and clean pipeline traceability.",
    });
    assert.ok(duelTurn.playerTurn);
    assert.ok(duelTurn.botTurn);

    const wcCreated = await executeArenaAction({
      gameType: "word-chain",
      body: { action: "create", seedWord: "docker" },
      sessionPlayer: basePlayer,
      rewardPracticePointsFn: mockRewardFn,
    });
    assert.equal(wcCreated.status, 200);
    const wcCode = wcCreated.body.room.roomCode;
    await executeArenaAction({
      gameType: "word-chain",
      body: { action: "fill_bot", code: wcCode },
      sessionPlayer: basePlayer,
      rewardPracticePointsFn: mockRewardFn,
    });
    const wcStart = await executeArenaAction({
      gameType: "word-chain",
      body: { action: "start", code: wcCode },
      sessionPlayer: basePlayer,
      rewardPracticePointsFn: mockRewardFn,
    });
    let wcRoom = wcStart.body.room;
    const firstWord = pickBotChainWord(wcRoom.requiredChar, wcRoom.usedWords);
    assert.ok(firstWord);
    const wcTurn1 = await executeArenaAction({
      gameType: "word-chain",
      body: { action: "turn", code: wcCode, word: firstWord },
      sessionPlayer: basePlayer,
      rewardPracticePointsFn: mockRewardFn,
    });
    assert.equal(wcTurn1.status, 200);
    assert.equal(wcTurn1.body.turnResult.isItTerm, true);
    assert.equal(wcTurn1.body.turnResult.streak, 1);
    wcRoom = wcTurn1.body.room;

    if (wcRoom.status === "active") {
      const secondWord = pickBotChainWord(wcRoom.requiredChar, wcRoom.usedWords);
      assert.ok(secondWord);
      const wcTurn2 = await executeArenaAction({
        gameType: "word-chain",
        body: { action: "turn", code: wcCode, word: secondWord },
        sessionPlayer: basePlayer,
        rewardPracticePointsFn: mockRewardFn,
      });
      assert.equal(wcTurn2.status, 200);
      assert.equal(wcTurn2.body.turnResult.comboTriggered, true);
      assert.equal(wcTurn2.body.turnResult.nextFuseSeconds, 5);
      wcRoom = wcTurn2.body.room;
    }

    if (wcRoom.status === "active") {
      const wcTimeout = await executeArenaAction({
        gameType: "word-chain",
        body: { action: "timeout", code: wcCode },
        sessionPlayer: basePlayer,
        rewardPracticePointsFn: mockRewardFn,
      });
      assert.equal(wcTimeout.status, 200);
      assert.equal(wcTimeout.body.room.status, "finished");
      assert.equal(wcTimeout.body.room.explodedPlayerId, basePlayer.id);
    }
  } finally {
    process.env.DATABASE_URL = prevDb;
  }
});

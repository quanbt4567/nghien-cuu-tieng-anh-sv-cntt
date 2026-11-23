import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const jiti = require("jiti")(__filename);

const { PARTY_SCENARIOS, findPartyScenarioById } = jiti(
  resolve(__dirname, "../lib/party-scenarios.ts")
);

const {
  PARTY_ROLES,
  VIETNAMESE_PENALTY_SECONDS,
  PARTY_WIN_COINS,
  PARTY_MVP_BONUS_COINS,
  normalizeRoomCode,
  createPartyRoom,
  joinPartyRoom,
  fillWithAiTeammates,
  startPartyRoom,
  timeoutPartyRoom,
  resetPartyRoom,
  savePartyRoom,
  loadPartyRoom,
  detectVietnamesePenalty,
  evaluateTurnLocal,
  computeTeamResolutionProgress,
  calculateVictoryRewards,
} = jiti(resolve(__dirname, "../lib/party-engine.ts"));

const { POST: partyRoomPost } = jiti(
  resolve(__dirname, "../app/api/party/room/route.ts")
);

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

test("PARTY_SCENARIOS defines 5 outage scenarios with asymmetrical frontend, backend, devops clues", () => {
  assert.equal(PARTY_SCENARIOS.length, 5);

  const ids = new Set();
  for (const scenario of PARTY_SCENARIOS) {
    assert.ok(scenario.id && !ids.has(scenario.id), `duplicate or empty id: ${scenario.id}`);
    ids.add(scenario.id);
    assert.ok(scenario.title.length > 0);
    assert.ok(scenario.severity === "SEV-1" || scenario.severity === "SEV-2");
    assert.ok(scenario.estimatedMinutes > 0);
    assert.ok(Array.isArray(scenario.resolutionChecklist) && scenario.resolutionChecklist.length >= 3);

    for (const role of PARTY_ROLES) {
      const clue = scenario.clues[role];
      assert.ok(clue, `missing ${role} clue for ${scenario.id}`);
      assert.equal(clue.role, role);
      assert.ok(clue.roleLabel.length > 0);
      assert.ok(clue.summary.length > 10);
      assert.ok(Array.isArray(clue.metrics) && clue.metrics.length >= 2);
      assert.ok(clue.suspectedCause.length > 10);
      assert.ok(Array.isArray(clue.targetKeywords) && clue.targetKeywords.length >= 3);
    }

    assert.notEqual(scenario.clues.frontend.summary, scenario.clues.backend.summary);
    assert.notEqual(scenario.clues.backend.summary, scenario.clues.devops.summary);
    assert.notEqual(scenario.clues.frontend.suspectedCause, scenario.clues.devops.suspectedCause);
  }
});

test("createPartyRoom and normalizeRoomCode handle 6-char room codes and initial state", () => {
  assert.equal(normalizeRoomCode("ab12cd"), "AB12CD");
  assert.equal(normalizeRoomCode("  xy98zk "), "XY98ZK");
  assert.equal(normalizeRoomCode("SHORT"), null);
  assert.equal(normalizeRoomCode("TOO-LONG-CODE"), null);
  assert.equal(normalizeRoomCode(123456), null);

  const room = createPartyRoom({
    scenarioId: "api-memory-leak-storm",
    roomCode: "dev777",
    hostPlayer: {
      id: "player-1",
      displayName: "Minh Host",
      role: "backend",
    },
  });

  const scenario = findPartyScenarioById("api-memory-leak-storm");
  assert.ok(scenario);
  assert.equal(room.roomCode, "DEV777");
  assert.equal(room.scenarioId, "api-memory-leak-storm");
  assert.equal(room.status, "lobby");
  assert.equal(room.resolutionProgress, 0);
  assert.equal(room.remainingSeconds, scenario.estimatedMinutes * 60);
  assert.equal(room.players.length, 1);
  assert.equal(room.players[0].role, "backend");

  const autoCodeRoom = createPartyRoom();
  assert.match(autoCodeRoom.roomCode, /^[A-Z0-9]{6}$/);
});

test("joinPartyRoom joins by 6-char code and fillWithAiTeammates populates remaining roles", () => {
  const room = createPartyRoom({
    roomCode: "OUTAGE",
    hostPlayer: {
      id: "human-1",
      displayName: "Lan Frontend",
      role: "frontend",
    },
  });

  assert.equal(normalizeRoomCode("outage"), room.roomCode);

  const joined = joinPartyRoom(room, {
    id: "human-2",
    displayName: "Tuan DevOps",
    role: "devops",
  });
  assert.equal(joined.players.length, 2);
  assert.deepEqual(
    joined.players.map((p) => p.role).sort(),
    ["devops", "frontend"]
  );

  const withAi = fillWithAiTeammates(joined);
  assert.equal(withAi.players.length, 3);
  const aiPlayer = withAi.players.find((p) => p.role === "backend");
  assert.ok(aiPlayer);
  assert.equal(aiPlayer.id, "ai-backend");

  const replacedAi = joinPartyRoom(withAi, {
    id: "human-3",
    displayName: "Hoa Backend",
    role: "backend",
  });
  assert.equal(replacedAi.players.length, 3);
  assert.equal(
    replacedAi.players.find((p) => p.role === "backend")?.id,
    "human-3"
  );
});

test("detectVietnamesePenalty detects Vietnamese words and applies -15s clock penalty", () => {
  assert.equal(VIETNAMESE_PENALTY_SECONDS, 15);

  const clean = detectVietnamesePenalty(
    "We observed a PostgreSQL deadlock on the orders table and should add an idempotency key."
  );
  assert.equal(clean.detected, false);
  assert.equal(clean.penaltySeconds, 0);
  assert.deepEqual(clean.matchedTokens, []);

  const diacritic = detectVietnamesePenalty(
    "Database bị deadlock rồi, we need to rollback the transaction."
  );
  assert.equal(diacritic.detected, true);
  assert.equal(diacritic.penaltySeconds, 15);
  assert.ok(diacritic.matchedTokens.length >= 1);

  const asciiVi = detectVietnamesePenalty(
    "Khong duoc roi, check the connection pool timeout."
  );
  assert.equal(asciiVi.detected, true);
  assert.equal(asciiVi.penaltySeconds, 15);
  assert.ok(asciiVi.matchedTokens.includes("Khong"));
  assert.ok(asciiVi.matchedTokens.includes("duoc"));

  const scenario = PARTY_SCENARIOS[0];
  const evalWithVi = evaluateTurnLocal({
    transcript: "Deadlock transaction rollback nhung ma timeout roi",
    role: "backend",
    scenario,
    playerId: "human-1",
  });
  assert.equal(evalWithVi.penalty.detected, true);
  assert.equal(evalWithVi.penalty.penaltySeconds, 15);
  assert.ok(evalWithVi.feedback.includes("-15s"));
});

test("calculateVictoryRewards awards +15 win and +10 MVP bonus IT-Coins and resolutionProgress hits 100%", () => {
  assert.equal(PARTY_WIN_COINS, 15);
  assert.equal(PARTY_MVP_BONUS_COINS, 10);

  const progress = computeTeamResolutionProgress({
    evaluations: [
      {
        playerId: "human-1",
        role: "frontend",
        transcript: "idempotency timeout retry checkout",
        score: 78,
        matchedKeywords: ["idempotency", "timeout"],
        missingKeywords: [],
        feedback: "ok",
        durationMs: 1000,
      },
      {
        playerId: "ai-backend",
        role: "backend",
        transcript: "deadlock transaction lock contention rollback",
        score: 85,
        matchedKeywords: ["deadlock", "transaction"],
        missingKeywords: [],
        feedback: "ok",
        durationMs: 1000,
      },
      {
        playerId: "human-2",
        role: "devops",
        transcript: "connection pool timeout index rollback",
        score: 92,
        matchedKeywords: ["connection pool", "timeout"],
        missingKeywords: [],
        feedback: "ok",
        durationMs: 1000,
      },
    ],
  });
  assert.equal(progress, 100);

  const rewards = calculateVictoryRewards({
    players: [
      { id: "human-1", displayName: "Lan Frontend", role: "frontend", isReady: true, score: 78 },
      { id: "ai-backend", displayName: "Sam (AI Backend)", role: "backend", isReady: true, score: 85 },
      { id: "human-2", displayName: "Tuan DevOps", role: "devops", isReady: true, score: 92 },
    ],
    evaluations: [],
  });

  assert.equal(rewards.winCoins, 15);
  assert.equal(rewards.mvpBonusCoins, 10);
  assert.equal(rewards.totalMvpCoins, 25);
  assert.equal(rewards.mvpPlayerId, "human-2");
  assert.equal(rewards.mvpDisplayName, "Tuan DevOps");
});

test("timeoutPartyRoom transitions active room to timed_out idempotently while preserving partial turn points", () => {
  const lobby = fillWithAiTeammates(
    createPartyRoom({
      roomCode: "TIME01",
      hostPlayer: {
        id: "human-1",
        displayName: "Lan Frontend",
        role: "frontend",
      },
    })
  );

  // Lobby rooms must not transition to timed_out
  assert.equal(timeoutPartyRoom(lobby).status, "lobby");

  const active = startPartyRoom(lobby);
  assert.equal(active.status, "speaking");

  const withPartialProgress = {
    ...active,
    resolutionProgress: 35,
    teamScore: 82,
    players: active.players.map((p) =>
      p.id === "human-1" ? { ...p, score: 82, transcript: "We see retry bursts." } : p
    ),
    evaluations: [
      {
        playerId: "human-1",
        role: "frontend",
        transcript: "We see retry bursts and 504 timeouts on checkout.",
        score: 82,
        matchedKeywords: ["retry", "timeout", "checkout"],
        missingKeywords: ["idempotency"],
        feedback: "Good update.",
        durationMs: 3200,
      },
    ],
  };

  const timedOut = timeoutPartyRoom(withPartialProgress);
  assert.equal(timedOut.status, "timed_out");
  assert.equal(timedOut.remainingSeconds, 0);
  assert.equal(timedOut.currentTurnRole, null);
  assert.equal(timedOut.resolutionProgress, 35);
  assert.equal(timedOut.teamScore, 82);
  assert.equal(timedOut.evaluations.length, 1);
  assert.equal(
    timedOut.players.find((p) => p.id === "human-1")?.score,
    82
  );

  // Idempotent repeat call keeps exact state
  const timedOutAgain = timeoutPartyRoom(timedOut);
  assert.equal(timedOutAgain, timedOut);

  // Resolved rooms must stay resolved
  const resolved = { ...withPartialProgress, status: "resolved", resolutionProgress: 100 };
  assert.equal(timeoutPartyRoom(resolved).status, "resolved");

  // Resetting after timeout cleanly returns room to lobby
  const reset = resetPartyRoom(timedOut);
  assert.equal(reset.status, "lobby");
  assert.equal(reset.resolutionProgress, 0);
  assert.equal(reset.evaluations.length, 0);
  assert.ok(reset.remainingSeconds > 0);
});

test("POST /api/party/room action=timeout transitions room idempotently and preserves partial progress", async () => {
  await withClearedDatabaseUrl(async () => {
    const makeReq = (body) => ({
      json: async () => body,
    });

    const createRes = await partyRoomPost(
      makeReq({
        action: "create",
        scenarioId: "production-database-deadlock",
        role: "frontend",
        playerId: "human-timeout-1",
        displayName: "Minh Tester",
      })
    );
    assert.equal(createRes.status, 200);
    const created = await createRes.json();
    const roomCode = created.room.roomCode;

    const fillRes = await partyRoomPost(
      makeReq({ action: "fill_ai", roomCode })
    );
    assert.equal(fillRes.status, 200);

    const startRes = await partyRoomPost(
      makeReq({ action: "start", roomCode })
    );
    assert.equal(startRes.status, 200);
    const started = await startRes.json();

    // Seed partial evaluation score before timeout occurs
    await savePartyRoom({
      ...started.room,
      resolutionProgress: 35,
      teamScore: 76,
      players: started.room.players.map((p) =>
        p.role === "frontend" ? { ...p, score: 76 } : p
      ),
      evaluations: [
        {
          playerId: started.room.players.find((p) => p.role === "frontend").id,
          role: "frontend",
          transcript: "Checkout timeout retry burst detected.",
          score: 76,
          matchedKeywords: ["checkout", "timeout", "retry"],
          missingKeywords: ["idempotency"],
          feedback: "Good diagnosis.",
          durationMs: 2500,
        },
      ],
    });

    const timeoutRes1 = await partyRoomPost(
      makeReq({ action: "timeout", roomCode, role: "frontend" })
    );
    assert.equal(timeoutRes1.status, 200);
    const body1 = await timeoutRes1.json();
    assert.equal(body1.room.status, "timed_out");
    assert.equal(body1.room.remainingSeconds, 0);
    assert.equal(body1.room.currentTurnRole, null);
    assert.equal(body1.room.resolutionProgress, 35);
    assert.equal(body1.room.teamScore, 76);
    assert.equal(body1.room.evaluations.length, 1);

    // Idempotent second timeout call
    const timeoutRes2 = await partyRoomPost(
      makeReq({ action: "timeout", roomCode, role: "frontend" })
    );
    assert.equal(timeoutRes2.status, 200);
    const body2 = await timeoutRes2.json();
    assert.equal(body2.room.status, "timed_out");
    assert.equal(body2.room.remainingSeconds, 0);
    assert.equal(body2.room.teamScore, 76);

    const persisted = await loadPartyRoom(roomCode);
    assert.equal(persisted?.status, "timed_out");
    assert.equal(persisted?.teamScore, 76);

    // Reset after timeout returns cleanly to lobby
    const resetRes = await partyRoomPost(
      makeReq({ action: "reset", roomCode, role: "frontend" })
    );
    assert.equal(resetRes.status, 200);
    const resetBody = await resetRes.json();
    assert.equal(resetBody.room.status, "lobby");
    assert.equal(resetBody.room.resolutionProgress, 0);
  });
});

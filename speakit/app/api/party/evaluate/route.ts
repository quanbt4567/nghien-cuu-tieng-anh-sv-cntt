import { NextRequest, NextResponse } from "next/server";
import { rewardPracticePoints } from "../../../../app/actions/leaderboard";
import {
  extractFirstJsonObject,
  requestAiWaterfallText,
} from "../../../../lib/ai-waterfall";
import { getDbClient, GuestPlayerRow, PublicGuestPlayer } from "../../../../lib/db";
import {
  readExistingGuestPlayer,
  resolveOrCreateGuestSession,
  serializePublicGuestPlayer,
} from "../../../../lib/neon-auth";
import {
  buildAiTeammateTranscript,
  calculateVictoryRewards,
  computeTeamResolutionProgress,
  computeTeamScore,
  detectVietnamesePenalty,
  evaluateTurnLocal,
  getNextTurnRole,
  isValidPartyRole,
  loadPartyRoom,
  normalizeRoomCode,
  PARTY_ROLES,
  PartyRoomSnapshot,
  savePartyRoom,
  VictoryRewardSummary,
} from "../../../../lib/party-engine";
import {
  findPartyScenarioById,
  PARTY_SCENARIOS,
  PartyScenario,
  PlayerRole,
  TurnEvaluation,
} from "../../../../lib/party-scenarios";
import { ScoringProvider } from "../../../../lib/types";

interface EvaluateRequestBody {
  roomCode?: string;
  code?: string;
  transcript?: string;
  role?: PlayerRole;
  playerId?: string;
  durationMs?: number;
  remainingSeconds?: number;
  backupTransferCode?: string;
  runAiTurns?: boolean;
}

async function evaluateWithCtoWaterfall(
  transcript: string,
  role: PlayerRole,
  scenario: PartyScenario,
  playerId: string,
  durationMs: number
): Promise<{
  evaluation: TurnEvaluation;
  penalty: ReturnType<typeof detectVietnamesePenalty>;
  provider: ScoringProvider;
}> {
  const clue = scenario.clues[role];
  const penalty = detectVietnamesePenalty(transcript);
  const expectedKeywords = Array.from(
    new Set([...clue.targetKeywords, ...scenario.targetKeywords])
  );

  const systemInstruction =
    "You are a CTO Incident Commander leading a live SEV outage war room. Evaluate the engineer's spoken English status update strictly in JSON with keys: score (integer 0-100), matchedKeywords (string[]), missingKeywords (string[]), feedback (concise 1-2 sentence English CTO feedback).";

  const userPrompt = JSON.stringify({
    incident: scenario.title,
    severity: scenario.severity,
    incidentContext: scenario.incidentContext,
    engineerRole: clue.roleLabel,
    roleSuspectedCause: clue.suspectedCause,
    roleTargetKeywords: clue.targetKeywords,
    scenarioTargetKeywords: scenario.targetKeywords,
    transcript,
    vietnameseDetected: penalty.detected,
  });

  const aiResult = await requestAiWaterfallText({
    systemInstruction,
    userPrompt,
    temperature: 0.2,
    maxTokens: 350,
    jsonMode: true,
  });

  if (aiResult) {
    const parsed = extractFirstJsonObject(aiResult.text);
    if (parsed && typeof parsed.score === "number" && Number.isFinite(parsed.score)) {
      const baseScore = Math.max(0, Math.min(100, Math.round(parsed.score)));
      const adjustedScore = penalty.detected
        ? Math.max(0, baseScore - 10)
        : baseScore;
      const matchedKeywords = Array.isArray(parsed.matchedKeywords)
        ? parsed.matchedKeywords.filter((k): k is string => typeof k === "string")
        : [];
      const missingKeywords = Array.isArray(parsed.missingKeywords)
        ? parsed.missingKeywords.filter((k): k is string => typeof k === "string")
        : expectedKeywords.filter((k) => !matchedKeywords.includes(k));
      const baseFeedback =
        typeof parsed.feedback === "string" && parsed.feedback.trim()
          ? parsed.feedback.trim()
          : "Status received. Continue coordinating root-cause mitigation.";
      const feedback = penalty.detected
        ? `${baseFeedback} Vietnamese detected: -15s incident clock penalty.`
        : baseFeedback;

      return {
        evaluation: {
          playerId,
          role,
          transcript,
          score: adjustedScore,
          matchedKeywords,
          missingKeywords,
          feedback,
          durationMs,
        },
        penalty,
        provider: aiResult.provider,
      };
    }
  }

  const localEval = evaluateTurnLocal({
    transcript,
    role,
    scenario,
    playerId,
    durationMs,
  });

  return {
    evaluation: {
      playerId: localEval.playerId,
      role: localEval.role,
      transcript: localEval.transcript,
      score: localEval.score,
      matchedKeywords: localEval.matchedKeywords,
      missingKeywords: localEval.missingKeywords,
      feedback: localEval.feedback,
      durationMs: localEval.durationMs,
    },
    penalty: localEval.penalty,
    provider: "local",
  };
}

function applyEvaluationToRoom(
  room: PartyRoomSnapshot,
  evaluation: TurnEvaluation,
  penaltySeconds: number,
  overrideRemainingSeconds?: number
): PartyRoomSnapshot {
  const now = new Date().toISOString();
  const nextEvaluations = [...room.evaluations, evaluation];
  const nextPlayers = room.players.map((p) =>
    p.id === evaluation.playerId || p.role === evaluation.role
      ? {
          ...p,
          transcript: evaluation.transcript,
          score: evaluation.score,
        }
      : p
  );

  const baseRemaining =
    typeof overrideRemainingSeconds === "number" &&
    Number.isFinite(overrideRemainingSeconds)
      ? Math.max(0, Math.round(overrideRemainingSeconds))
      : room.remainingSeconds;

  const nextRemaining = Math.max(0, baseRemaining - penaltySeconds);
  const resolutionProgress = computeTeamResolutionProgress({
    evaluations: nextEvaluations,
  });
  const teamScore = computeTeamScore(nextEvaluations);
  const isResolved = resolutionProgress >= 100;

  const draftRoom: PartyRoomSnapshot = {
    ...room,
    players: nextPlayers,
    evaluations: nextEvaluations,
    teamScore,
    resolutionProgress,
    remainingSeconds: nextRemaining,
    totalPenaltySeconds: room.totalPenaltySeconds + penaltySeconds,
    status: isResolved ? "resolved" : "speaking",
    updatedAt: now,
  };

  return {
    ...draftRoom,
    currentTurnRole: isResolved ? null : getNextTurnRole(draftRoom),
  };
}

async function awardVictoryCoins(
  room: PartyRoomSnapshot,
  scenario: PartyScenario,
  rewards: VictoryRewardSummary,
  backupTransferCode?: string
): Promise<PublicGuestPlayer | null> {
  const sessionPlayer =
    (await readExistingGuestPlayer()) ??
    (await resolveOrCreateGuestSession(backupTransferCode));

  const pointsToAward = Math.max(50, room.teamScore);
  const rewardResult = await rewardPracticePoints(
    scenario.id,
    pointsToAward,
    backupTransferCode
  );

  const targetPlayer = rewardResult.player ?? sessionPlayer;
  if (!targetPlayer) return null;

  const isMvp =
    !rewards.mvpPlayerId ||
    rewards.mvpPlayerId === targetPlayer.id ||
    rewards.mvpPlayerId.startsWith("ai-");
  const coinsToAdd =
    rewards.winCoins + (isMvp ? rewards.mvpBonusCoins : 0);

  const sql = getDbClient();
  if (!sql) return targetPlayer;

  try {
    const updatedRows = (await sql`
      UPDATE guest_players
      SET
        it_coins = it_coins + ${coinsToAdd},
        updated_at = NOW()
      WHERE id = ${targetPlayer.id}
      RETURNING
        id,
        device_token_hash,
        transfer_code,
        display_name,
        it_coins,
        total_points,
        streak_days,
        last_practice_date,
        equipped_title,
        equipped_ring,
        owned_items,
        created_at,
        updated_at
    `) as GuestPlayerRow[];

    if (updatedRows.length > 0) {
      return serializePublicGuestPlayer(updatedRows[0]);
    }
  } catch {
    return targetPlayer;
  }

  return targetPlayer;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as EvaluateRequestBody;
    const code = normalizeRoomCode(body.roomCode ?? body.code);
    if (!code) {
      return NextResponse.json(
        { error: "Invalid 6-character room code." },
        { status: 400 }
      );
    }

    const transcript =
      typeof body.transcript === "string" ? body.transcript.trim() : "";
    if (!transcript) {
      return NextResponse.json(
        { error: "Please speak or enter an English incident update." },
        { status: 400 }
      );
    }

    const room = await loadPartyRoom(code);
    if (!room) {
      return NextResponse.json(
        { error: "Party room not found." },
        { status: 404 }
      );
    }

    const scenario =
      findPartyScenarioById(room.scenarioId) ?? PARTY_SCENARIOS[0];

    const sessionPlayer = await readExistingGuestPlayer();
    const targetRole: PlayerRole = isValidPartyRole(body.role)
      ? body.role
      : room.currentTurnRole ?? "frontend";

    const slotPlayer = room.players.find((p) => p.role === targetRole);
    const playerId =
      (typeof body.playerId === "string" && body.playerId.trim()
        ? body.playerId.trim()
        : undefined) ??
      slotPlayer?.id ??
      sessionPlayer?.id ??
      "guest-local";

    const durationMs =
      typeof body.durationMs === "number" && Number.isFinite(body.durationMs)
        ? Math.max(0, Math.round(body.durationMs))
        : 0;

    const { evaluation, penalty, provider } = await evaluateWithCtoWaterfall(
      transcript,
      targetRole,
      scenario,
      playerId,
      durationMs
    );

    let updatedRoom = applyEvaluationToRoom(
      room,
      evaluation,
      penalty.penaltySeconds,
      body.remainingSeconds
    );

    const aiEvaluations: TurnEvaluation[] = [];
    if (body.runAiTurns && updatedRoom.status !== "resolved") {
      for (const role of PARTY_ROLES) {
        const aiPlayer = updatedRoom.players.find(
          (p) => p.role === role && p.id.startsWith("ai-")
        );
        const alreadyEvaluated = updatedRoom.evaluations.some(
          (e) => e.role === role && e.score >= 55
        );
        if (!aiPlayer || alreadyEvaluated) continue;

        const aiTranscript = buildAiTeammateTranscript(scenario, role);
        const aiEval = evaluateTurnLocal({
          transcript: aiTranscript,
          role,
          scenario,
          playerId: aiPlayer.id,
          durationMs: 1800,
        });
        const cleanAiEval: TurnEvaluation = {
          playerId: aiEval.playerId,
          role: aiEval.role,
          transcript: aiEval.transcript,
          score: aiEval.score,
          matchedKeywords: aiEval.matchedKeywords,
          missingKeywords: aiEval.missingKeywords,
          feedback: aiEval.feedback,
          durationMs: aiEval.durationMs,
        };
        aiEvaluations.push(cleanAiEval);
        updatedRoom = applyEvaluationToRoom(updatedRoom, cleanAiEval, 0);
      }
    }

    let rewards: VictoryRewardSummary | null = null;
    let updatedPlayer: PublicGuestPlayer | null = null;

    if (updatedRoom.status === "resolved") {
      rewards = calculateVictoryRewards(updatedRoom);
      updatedRoom = {
        ...updatedRoom,
        mvpPlayerId: rewards.mvpPlayerId,
        mvpDisplayName: rewards.mvpDisplayName,
      };
      if (!updatedRoom.rewardsAwarded) {
        updatedPlayer = await awardVictoryCoins(
          updatedRoom,
          scenario,
          rewards,
          body.backupTransferCode
        );
        updatedRoom = {
          ...updatedRoom,
          rewardsAwarded: true,
        };
      }
    }

    await savePartyRoom(updatedRoom);

    return NextResponse.json({
      ok: true,
      evaluation,
      aiEvaluations,
      penalty,
      provider,
      room: updatedRoom,
      scenario,
      rewards,
      updatedPlayer,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to evaluate party turn." },
      { status: 500 }
    );
  }
}

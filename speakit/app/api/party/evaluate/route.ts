import { NextRequest, NextResponse } from "next/server";
import { rewardPracticePoints } from "../../../../app/actions/leaderboard";
import {
  extractFirstJsonObject,
  requestAiWaterfallText,
} from "../../../../lib/ai-waterfall";
import {
  detectSensitiveLanguage,
  recordModerationIncident,
} from "../../../../lib/content-moderation";
import { getDbClient, GuestPlayerRow, PublicGuestPlayer } from "../../../../lib/db";
import {
  readExistingGuestPlayer,
  resolveOrCreateGuestSession,
  serializePublicGuestPlayer,
} from "../../../../lib/neon-auth";
import {
  calculateVictoryRewards,
  computeRoundCappedProgress,
  computeTeamScore,
  detectVietnamesePenalty,
  evaluateAiTeammateTurn,
  evaluateTurnLocal,
  getNextTurnRole,
  isValidPartyRole,
  loadPartyRoom,
  normalizeRoomCode,
  PARTY_ROLES,
  PartyRoomSnapshot,
  PartyTranscriptEntry,
  recordPartyArenaRun,
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
  durationMs: number,
  moderationMeta?: {
    playerId?: string | null;
    playerName?: string | null;
    transferCode?: string | null;
    roomCode?: string | null;
  }
): Promise<{
  evaluation: TurnEvaluation;
  penalty: ReturnType<typeof detectVietnamesePenalty>;
  provider: ScoringProvider;
}> {
  const clue = scenario.clues[role];
  const sensitive = detectSensitiveLanguage(transcript);
  const penalty = detectVietnamesePenalty(transcript);
  const expectedKeywords = Array.from(
    new Set([...clue.targetKeywords, ...scenario.targetKeywords])
  );

  if (sensitive.flagged) {
    void recordModerationIncident({
      playerId: moderationMeta?.playerId ?? playerId,
      playerName: moderationMeta?.playerName ?? "Player",
      transferCode: moderationMeta?.transferCode ?? null,
      source: "party",
      roomOrTopic: `${moderationMeta?.roomCode ?? ""} (${scenario.title})`.trim(),
      content: transcript,
      category: "sensitive",
      severity: "high",
      reason: sensitive.reason,
      aiProvider: "local-filter",
    });
    return {
      evaluation: {
        playerId,
        role,
        transcript,
        score: 0,
        matchedKeywords: [],
        missingKeywords: expectedKeywords,
        feedback: `⚠️ Cảnh báo: ${sensitive.reason} Hệ thống đã từ chối chấm điểm và báo cáo Admin.`,
        durationMs,
      },
      penalty: { detected: false, matchedTokens: [], penaltySeconds: 0 },
      provider: "local",
    };
  }

  const systemInstruction =
    "You are a STRICT CTO Incident Commander & zero-tolerance safety moderator leading a live SEV outage war room. Be strict: (1) sensitiveContent: true for ANY profanity, slurs, sexual/NSFW words, hate speech, or insults; (2) offTopic: true for ANY greeting-only, casual chatter, filler, trolling, gibberish, or text that does not genuinely address the outage/engineering role; (3) grade technical accuracy strictly. Evaluate in JSON: score (integer 0-100), sensitiveContent (boolean), offTopic (boolean), moderationReason (string), matchedKeywords (string[]), missingKeywords (string[]), feedback (concise 1-2 sentence CTO feedback).";

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
    maxTokens: 360,
    jsonMode: true,
  });

  if (aiResult) {
    const parsed = extractFirstJsonObject(aiResult.text);
    if (parsed && parsed.sensitiveContent === true) {
      const modReason =
        typeof parsed.moderationReason === "string" && parsed.moderationReason.trim()
          ? parsed.moderationReason.trim()
          : "AI phát hiện ngôn từ nhạy cảm / thiếu chuẩn mực.";
      void recordModerationIncident({
        playerId: moderationMeta?.playerId ?? playerId,
        playerName: moderationMeta?.playerName ?? "Player",
        transferCode: moderationMeta?.transferCode ?? null,
        source: "party",
        roomOrTopic: `${moderationMeta?.roomCode ?? ""} (${scenario.title})`.trim(),
        content: transcript,
        category: "sensitive",
        severity: "high",
        reason: modReason,
        aiProvider: aiResult.provider,
      });
      return {
        evaluation: {
          playerId,
          role,
          transcript,
          score: 0,
          matchedKeywords: [],
          missingKeywords: expectedKeywords,
          feedback:
            "⚠️ Cảnh báo: AI phát hiện từ ngữ nhạy cảm / thiếu chuẩn mực (0 điểm, đã báo cáo Admin).",
          durationMs,
        },
        penalty,
        provider: aiResult.provider,
      };
    }

    if (parsed && typeof parsed.score === "number" && Number.isFinite(parsed.score)) {
      const aiOffTopic = parsed.offTopic === true;
      if (aiOffTopic) {
        const modReason =
          typeof parsed.moderationReason === "string" && parsed.moderationReason.trim()
            ? parsed.moderationReason.trim()
            : "AI đánh giá báo cáo lạc đề, chưa đúng trọng tâm sự cố.";
        void recordModerationIncident({
          playerId: moderationMeta?.playerId ?? playerId,
          playerName: moderationMeta?.playerName ?? "Player",
          transferCode: moderationMeta?.transferCode ?? null,
          source: "party",
          roomOrTopic: `${moderationMeta?.roomCode ?? ""} (${scenario.title})`.trim(),
          content: transcript,
          category: "off_topic",
          severity: "medium",
          reason: modReason,
          aiProvider: aiResult.provider,
        });
      }
      const rawScore = Math.max(0, Math.min(100, Math.round(parsed.score)));
      const baseScore = aiOffTopic ? 0 : rawScore;
      const adjustedScore = penalty.detected
        ? Math.max(0, baseScore - 10)
        : baseScore;
      const matchedKeywords = aiOffTopic
        ? []
        : Array.isArray(parsed.matchedKeywords)
          ? parsed.matchedKeywords.filter((k): k is string => typeof k === "string")
          : [];
      const missingKeywords = Array.isArray(parsed.missingKeywords)
        ? parsed.missingKeywords.filter((k): k is string => typeof k === "string")
        : expectedKeywords.filter((k) => !matchedKeywords.includes(k));
      const baseFeedback = aiOffTopic
        ? "⚠️ Lạc đề: Báo cáo chưa bám sát sự cố hiện tại. Hãy dùng đúng từ khóa vai trò của bạn!"
        : typeof parsed.feedback === "string" && parsed.feedback.trim()
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
  overrideRemainingSeconds?: number,
  overrideProgress?: number
): PartyRoomSnapshot {
  const now = new Date().toISOString();
  const nextEvaluations = [...room.evaluations, evaluation];
  const targetPlayer = room.players.find(
    (p) => p.id === evaluation.playerId || p.role === evaluation.role
  );
  const transcriptEntry: PartyTranscriptEntry = {
    playerId: evaluation.playerId,
    playerName: targetPlayer?.displayName ?? evaluation.role.toUpperCase(),
    role: evaluation.role,
    transcript: evaluation.transcript,
    score: evaluation.score,
    feedback: evaluation.feedback,
    timestamp: now,
  };
  const nextTranscript = [...(room.transcript ?? []), transcriptEntry];
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
  const resolutionProgress = Math.max(
    room.resolutionProgress ?? 0,
    overrideProgress ?? room.resolutionProgress ?? 0
  );
  const teamScore = computeTeamScore(nextEvaluations);
  const isResolved = resolutionProgress >= 100;

  const draftRoom: PartyRoomSnapshot = {
    ...room,
    players: nextPlayers,
    evaluations: nextEvaluations,
    transcript: nextTranscript,
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
        email,
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
  let body: EvaluateRequestBody;
  try {
    body = (await req.json()) as EvaluateRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  try {
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
      durationMs,
      {
        playerId: sessionPlayer?.id ?? playerId,
        playerName: slotPlayer?.displayName ?? sessionPlayer?.displayName ?? "Player",
        transferCode: sessionPlayer?.transferCode ?? null,
        roomCode: room.roomCode,
      }
    );

    const previousProgress = room.resolutionProgress ?? 0;
    const humanRoundCount =
      room.evaluations.filter((e) => !e.playerId.startsWith("ai-")).length + 1;

    let updatedRoom = applyEvaluationToRoom(
      room,
      evaluation,
      penalty.penaltySeconds,
      body.remainingSeconds,
      previousProgress
    );

    const aiEvaluations: TurnEvaluation[] = [];
    if (body.runAiTurns !== false && previousProgress < 100) {
      const usedScores: number[] = [];
      for (const role of PARTY_ROLES) {
        const aiPlayer = updatedRoom.players.find(
          (p) => p.role === role && p.id.startsWith("ai-")
        );
        if (!aiPlayer) continue;

        const aiTurnNumber =
          updatedRoom.evaluations.filter((e) => e.playerId === aiPlayer.id)
            .length + 1;
        const cleanAiEval = evaluateAiTeammateTurn({
          scenario,
          role,
          playerId: aiPlayer.id,
          roomCode: updatedRoom.roomCode,
          turnNumber: aiTurnNumber,
          usedScores,
        });
        usedScores.push(cleanAiEval.score);
        aiEvaluations.push(cleanAiEval);
        updatedRoom = applyEvaluationToRoom(
          updatedRoom,
          cleanAiEval,
          0,
          undefined,
          previousProgress
        );
      }
    }

    const coveredRoles = new Set(
      updatedRoom.evaluations
        .filter((e) => e.score >= 55)
        .map((e) => e.role)
    );
    const allRolesCovered = PARTY_ROLES.every((r) => coveredRoles.has(r));
    const cappedProgress = computeRoundCappedProgress({
      previousProgress,
      roundNumber: humanRoundCount,
      humanScore: evaluation.score,
      allRolesCovered,
    });
    const finalProgress = Math.max(previousProgress, cappedProgress);
    const isResolved = finalProgress >= 100;

    updatedRoom = {
      ...updatedRoom,
      resolutionProgress: finalProgress,
      status: isResolved ? "resolved" : "speaking",
      currentTurnRole: isResolved ? null : getNextTurnRole(updatedRoom),
    };

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
        await recordPartyArenaRun({
          roomCode: updatedRoom.roomCode,
          scenarioId: updatedRoom.scenarioId,
          score: Math.max(50, updatedRoom.teamScore),
          progressPercent: updatedRoom.resolutionProgress,
          durationSec: (() => {
            const byTimer = scenario.estimatedMinutes * 60 - updatedRoom.remainingSeconds;
            if (byTimer > 0) return Math.round(byTimer);
            const createdMs = Date.parse(updatedRoom.createdAt);
            return Number.isFinite(createdMs)
              ? Math.max(1, Math.min(3600, Math.round((Date.now() - createdMs) / 1000)))
              : 1;
          })(),
          role: targetRole,
          playerId: updatedPlayer?.id ?? playerId,
          playerName: updatedPlayer?.displayName ?? sessionPlayer?.displayName ?? null,
          transferCode:
            updatedPlayer?.transferCode ?? body.backupTransferCode ?? null,
        });
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
      penaltySeconds: penalty.penaltySeconds,
      provider,
      room: updatedRoom,
      resolutionProgress: updatedRoom.resolutionProgress,
      feedback: evaluation.feedback,
      ctoFeedback: evaluation.feedback,
      mvpPlayerId: updatedRoom.mvpPlayerId,
      scenario,
      rewards,
      player: updatedPlayer,
      updatedPlayer,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to evaluate party turn." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { rewardPracticePoints } from "../../../../app/actions/leaderboard";
import {
  readExistingGuestPlayer,
  resolveOrCreateGuestSession,
} from "../../../../lib/neon-auth";
import {
  createPartyRoom,
  fillWithAiTeammates,
  isValidPartyRole,
  joinPartyRoom,
  loadPartyRoom,
  normalizeRoomCode,
  PartyRoomSnapshot,
  recordPartyArenaRun,
  resetPartyRoom,
  savePartyRoom,
  startPartyRoom,
} from "../../../../lib/party-engine";
import {
  findPartyScenarioById,
  PARTY_SCENARIOS,
  PlayerRole,
} from "../../../../lib/party-scenarios";

type RoomAction = "create" | "join" | "fill_ai" | "start" | "reset" | "leave";

async function flushUnresolvedRoomRewards(input: {
  room: PartyRoomSnapshot;
  playerId: string;
  displayName: string;
  role?: PlayerRole;
  backupTransferCode?: string;
}) {
  const { room } = input;
  if (room.status === "resolved" || room.rewardsAwarded || room.teamScore <= 0) {
    return { flushed: false, player: null };
  }

  const scenario = findPartyScenarioById(room.scenarioId) ?? PARTY_SCENARIOS[0];
  const rewardResult = await rewardPracticePoints(
    room.scenarioId,
    room.teamScore,
    input.backupTransferCode
  );
  const slot = room.players.find((p) => p.id === input.playerId);
  const durationSec = Math.max(
    0,
    scenario.estimatedMinutes * 60 - room.remainingSeconds
  );

  await recordPartyArenaRun({
    roomCode: room.roomCode,
    scenarioId: room.scenarioId,
    score: room.teamScore,
    progressPercent: room.resolutionProgress,
    durationSec,
    role: slot?.role ?? input.role ?? null,
    playerId: rewardResult.player?.id ?? input.playerId,
    playerName: rewardResult.player?.displayName ?? input.displayName,
    transferCode:
      rewardResult.player?.transferCode ?? input.backupTransferCode ?? null,
  });

  return { flushed: true, player: rewardResult.player };
}

interface RoomRequestBody {
  action?: RoomAction;
  code?: string;
  roomCode?: string;
  scenarioId?: string;
  role?: PlayerRole;
  displayName?: string;
  playerId?: string;
  backupTransferCode?: string;
}

export async function GET(req: NextRequest) {
  try {
    const rawCode = req.nextUrl.searchParams.get("code");
    const code = normalizeRoomCode(rawCode);
    if (!code) {
      return NextResponse.json(
        { error: "Invalid 6-character room code." },
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

    return NextResponse.json({ ok: true, room, scenario });
  } catch {
    return NextResponse.json(
      { error: "Failed to load party room." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RoomRequestBody;
    const action = body.action;
    if (!action) {
      return NextResponse.json(
        { error: "Missing room action." },
        { status: 400 }
      );
    }

    const sessionPlayer =
      (await readExistingGuestPlayer()) ??
      (await resolveOrCreateGuestSession(body.backupTransferCode));

    const playerId =
      sessionPlayer?.id ??
      (typeof body.playerId === "string" && body.playerId.trim()
        ? body.playerId.trim().slice(0, 64)
        : "guest-local");

    const displayName =
      sessionPlayer?.displayName ??
      (typeof body.displayName === "string" && body.displayName.trim()
        ? body.displayName.trim().slice(0, 48)
        : "Guest Engineer");

    const requestedRole = isValidPartyRole(body.role) ? body.role : undefined;

    if (action === "create") {
      const room = createPartyRoom({
        scenarioId: body.scenarioId,
        hostPlayer: {
          id: playerId,
          displayName,
          role: requestedRole ?? "frontend",
        },
      });
      await savePartyRoom(room);
      const scenario =
        findPartyScenarioById(room.scenarioId) ?? PARTY_SCENARIOS[0];
      return NextResponse.json({
        ok: true,
        room,
        scenario,
        player: sessionPlayer,
      });
    }

    const code = normalizeRoomCode(body.code ?? body.roomCode);
    if (!code) {
      return NextResponse.json(
        { error: "Invalid 6-character room code." },
        { status: 400 }
      );
    }

    const existingRoom = await loadPartyRoom(code);
    if (!existingRoom) {
      return NextResponse.json(
        { error: "Party room not found." },
        { status: 404 }
      );
    }

    let updatedRoom = existingRoom;
    let activePlayer = sessionPlayer;

    if (action === "join") {
      updatedRoom = joinPartyRoom(existingRoom, {
        id: playerId,
        displayName,
        role: requestedRole,
      });
    } else if (action === "fill_ai") {
      updatedRoom = fillWithAiTeammates(existingRoom);
    } else if (action === "start") {
      if (existingRoom.players.length < 3) {
        return NextResponse.json(
          {
            error:
              "Need 3 participants (humans or AI teammates) to start the incident call.",
          },
          { status: 400 }
        );
      }
      updatedRoom = startPartyRoom(existingRoom);
    } else if (action === "reset") {
      const flushed = await flushUnresolvedRoomRewards({
        room: existingRoom,
        playerId,
        displayName,
        role: requestedRole,
        backupTransferCode: body.backupTransferCode,
      });
      if (flushed.player) {
        activePlayer = flushed.player;
      }
      updatedRoom = resetPartyRoom(existingRoom);
    } else if (action === "leave") {
      const flushed = await flushUnresolvedRoomRewards({
        room: existingRoom,
        playerId,
        displayName,
        role: requestedRole,
        backupTransferCode: body.backupTransferCode,
      });
      if (flushed.player) {
        activePlayer = flushed.player;
      }
      updatedRoom = flushed.flushed
        ? {
            ...existingRoom,
            rewardsAwarded: true,
            updatedAt: new Date().toISOString(),
          }
        : existingRoom;
    } else {
      return NextResponse.json(
        { error: "Unsupported room action." },
        { status: 400 }
      );
    }

    await savePartyRoom(updatedRoom);
    const scenario =
      findPartyScenarioById(updatedRoom.scenarioId) ?? PARTY_SCENARIOS[0];

    return NextResponse.json({
      ok: true,
      room: updatedRoom,
      scenario,
      player: activePlayer,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to process party room action." },
      { status: 500 }
    );
  }
}

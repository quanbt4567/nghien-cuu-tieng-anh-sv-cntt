import { NextRequest, NextResponse } from "next/server";
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
  resetPartyRoom,
  savePartyRoom,
  startPartyRoom,
} from "../../../../lib/party-engine";
import {
  findPartyScenarioById,
  PARTY_SCENARIOS,
  PlayerRole,
} from "../../../../lib/party-scenarios";

type RoomAction = "create" | "join" | "fill_ai" | "start" | "reset";

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

    if (action === "join") {
      updatedRoom = joinPartyRoom(existingRoom, {
        id: playerId,
        displayName,
        role: requestedRole,
      });
    } else if (action === "fill_ai") {
      updatedRoom = fillWithAiTeammates(existingRoom);
    } else if (action === "start") {
      updatedRoom = startPartyRoom(existingRoom);
    } else if (action === "reset") {
      updatedRoom = resetPartyRoom(existingRoom);
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
      player: sessionPlayer,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to process party room action." },
      { status: 500 }
    );
  }
}

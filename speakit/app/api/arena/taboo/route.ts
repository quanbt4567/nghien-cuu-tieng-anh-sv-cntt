import { NextRequest, NextResponse } from "next/server";
import { rewardPracticePoints } from "../../../../app/actions/leaderboard";
import {
  ArenaActionPayload,
  executeArenaAction,
  getArenaRoomResponse,
} from "../../../../lib/arena-moderator";
import {
  readExistingGuestPlayer,
  resolveOrCreateGuestSession,
} from "../../../../lib/neon-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sessionPlayer = await readExistingGuestPlayer();
    const result = await getArenaRoomResponse(
      "taboo",
      req.nextUrl.searchParams.get("code"),
      sessionPlayer
    );
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json(
      { error: "Failed to load Tech Taboo room." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  let body: ArenaActionPayload;
  try {
    body = (await req.json()) as ArenaActionPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  try {
    const sessionPlayer =
      (await readExistingGuestPlayer()) ??
      (await resolveOrCreateGuestSession(body.backupTransferCode));
    const result = await executeArenaAction({
      gameType: "taboo",
      body,
      sessionPlayer,
      rewardPracticePointsFn: rewardPracticePoints,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json(
      { error: "Failed to process Tech Taboo action." },
      { status: 500 }
    );
  }
}

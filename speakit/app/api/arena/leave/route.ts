import { NextRequest, NextResponse } from "next/server";
import {
  getLeaveStatus,
  isValidArenaLeaveGameId,
  recordForfeit,
  submitReasonRequest,
} from "../../../../lib/arena-leave-policy";
import {
  readExistingGuestPlayer,
  resolveOrCreateGuestSession,
} from "../../../../lib/neon-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const player = await readExistingGuestPlayer();
    const status = await getLeaveStatus(player?.id ?? null);
    return NextResponse.json({
      ok: true,
      ...status,
      player,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Không thể tải trạng thái thoát game." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      gameId?: unknown;
      roomCode?: unknown;
      mode?: unknown;
      reason?: unknown;
      backupTransferCode?: unknown;
    } | null;

    if (!body || !isValidArenaLeaveGameId(body.gameId)) {
      return NextResponse.json(
        { ok: false, error: "Mã trò chơi không hợp lệ." },
        { status: 400 }
      );
    }

    const mode = body.mode === "reason" ? "reason" : body.mode === "forfeit" ? "forfeit" : null;
    if (!mode) {
      return NextResponse.json(
        { ok: false, error: "Hình thức thoát không hợp lệ." },
        { status: 400 }
      );
    }

    const backupCode =
      typeof body.backupTransferCode === "string" ? body.backupTransferCode : undefined;
    const roomCode =
      typeof body.roomCode === "string" ? body.roomCode.trim().slice(0, 12) : null;

    const sessionPlayer =
      (await readExistingGuestPlayer()) ??
      (await resolveOrCreateGuestSession(backupCode));

    if (mode === "reason") {
      const outcome = await submitReasonRequest(
        sessionPlayer
          ? { id: sessionPlayer.id, displayName: sessionPlayer.displayName }
          : null,
        body.gameId,
        roomCode,
        body.reason
      );

      if (!outcome.ok) {
        return NextResponse.json(
          { ok: false, error: outcome.error },
          { status: outcome.status }
        );
      }

      const refreshedPlayer = await readExistingGuestPlayer();
      return NextResponse.json({
        ok: true,
        enforced: outcome.enforced,
        mode: "reason",
        penaltyCoins: 0,
        leaveCount: outcome.statusInfo.leaveCount,
        limit: outcome.statusInfo.limit,
        remaining: outcome.statusInfo.remaining,
        freezeStrikes: outcome.statusInfo.freezeStrikes,
        frozenUntil: outcome.statusInfo.frozenUntil,
        permanent: outcome.statusInfo.permanent,
        freezeMinutes: 0,
        requestId: outcome.requestId,
        player: refreshedPlayer ?? sessionPlayer,
      });
    }

    const result = await recordForfeit(
      sessionPlayer
        ? { id: sessionPlayer.id, displayName: sessionPlayer.displayName }
        : null,
      body.gameId,
      roomCode
    );
    const refreshedPlayer = await readExistingGuestPlayer();

    return NextResponse.json({
      ok: true,
      mode: "forfeit",
      ...result,
      player: refreshedPlayer ?? sessionPlayer,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Không thể xử lý yêu cầu thoát phòng lúc này." },
      { status: 500 }
    );
  }
}

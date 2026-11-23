import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../../../lib/adminAuth";
import {
  adminFreezePlayer,
  adminUnfreezePlayer,
  listAdminLeaves,
  resolveLeaveRequest,
} from "../../../../lib/arena-leave-policy";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const data = await listAdminLeaves();
  return NextResponse.json({ ok: true, ...data });
}

interface AdminLeavePostBody {
  action?: unknown;
  id?: unknown;
  playerId?: unknown;
  penaltyCoins?: unknown;
  minutes?: unknown;
  permanent?: unknown;
  note?: unknown;
  resetStrikes?: unknown;
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: AdminLeavePostBody | null = null;

  try {
    const parsed = (await req.json()) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      body = parsed as AdminLeavePostBody;
    }
  } catch {
    return NextResponse.json({ ok: false, error: "JSON không hợp lệ." }, { status: 400 });
  }

  if (!body) {
    return NextResponse.json({ ok: false, error: "Thiếu dữ liệu yêu cầu." }, { status: 400 });
  }

  const action = body?.action;
  if (action === "approve" || action === "reject") {
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json({ ok: false, error: "Thiếu mã đơn cần duyệt." }, { status: 400 });
    }
    const result = await resolveLeaveRequest({
      id,
      decision: action,
      penaltyCoins: typeof body?.penaltyCoins === "number" ? body.penaltyCoins : Number(body?.penaltyCoins),
      note: typeof body?.note === "string" ? body.note : undefined,
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error || "Không thể xử lý đơn." },
        { status: 400 }
      );
    }
    const data = await listAdminLeaves();
    return NextResponse.json({ ok: true, ...data });
  }

  if (action === "freeze") {
    const playerId = typeof body?.playerId === "string" ? body.playerId.trim() : "";
    if (!playerId) {
      return NextResponse.json({ ok: false, error: "Thiếu mã người chơi." }, { status: 400 });
    }
    const updated = await adminFreezePlayer(
      playerId,
      Number(body?.minutes) || 30,
      body?.permanent === true
    );
    if (!updated) {
      return NextResponse.json({ ok: false, error: "Không thể khóa người chơi." }, { status: 400 });
    }
    const data = await listAdminLeaves();
    return NextResponse.json({ ok: true, ...data });
  }

  if (action === "unfreeze") {
    const playerId = typeof body?.playerId === "string" ? body.playerId.trim() : "";
    if (!playerId) {
      return NextResponse.json({ ok: false, error: "Thiếu mã người chơi." }, { status: 400 });
    }
    const updated = await adminUnfreezePlayer(playerId, body?.resetStrikes === true);
    if (!updated) {
      return NextResponse.json({ ok: false, error: "Không thể mở khóa người chơi." }, { status: 400 });
    }
    const data = await listAdminLeaves();
    return NextResponse.json({ ok: true, ...data });
  }

  return NextResponse.json({ ok: false, error: "Hành động không hợp lệ." }, { status: 400 });
}

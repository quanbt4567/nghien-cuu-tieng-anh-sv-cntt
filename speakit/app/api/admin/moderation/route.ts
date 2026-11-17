import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../../../lib/adminAuth";
import {
  clampModerationCoins,
  listModerationIncidents,
  resolveModerationIncident,
} from "../../../../lib/content-moderation";

export const dynamic = "force-dynamic";

interface AdminModerationPostBody {
  action?: unknown;
  id?: unknown;
  coins?: unknown;
  note?: unknown;
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const data = await listModerationIncidents();
  return NextResponse.json({ ok: true, ...data });
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: AdminModerationPostBody | null = null;
  try {
    const parsed = (await req.json()) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      body = parsed as AdminModerationPostBody;
    }
  } catch {
    return NextResponse.json({ ok: false, error: "JSON không hợp lệ." }, { status: 400 });
  }

  const action = body?.action;
  const id = typeof body?.id === "string" ? body.id.trim() : "";

  if (!id || (action !== "penalize" && action !== "dismiss")) {
    return NextResponse.json(
      { ok: false, error: "Thiếu mã cảnh báo hoặc hành động không hợp lệ." },
      { status: 400 }
    );
  }

  const result = await resolveModerationIncident({
    id,
    action,
    coins: clampModerationCoins(body?.coins, 5),
    note: typeof body?.note === "string" ? body.note : undefined,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error || "Không thể xử lý cảnh báo." },
      { status: 400 }
    );
  }

  const data = await listModerationIncidents();
  return NextResponse.json({ ok: true, ...data });
}

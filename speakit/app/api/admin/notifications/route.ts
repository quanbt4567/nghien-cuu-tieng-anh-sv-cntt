import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../../../lib/adminAuth";
import { ensureSchema, getNeonSql } from "../../../../lib/db/neon";
import { isFcmConfigured, sendFcmBroadcast } from "../../../../lib/fcm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Chưa đăng nhập phiên quản trị." }, { status: 401 });
  }

  const configured = isFcmConfigured();
  const ready = await ensureSchema();
  const sql = getNeonSql();
  if (!ready || !sql) {
    return NextResponse.json({ configured, deviceCount: 0 });
  }

  const rows = (await sql`
    SELECT COUNT(*)::int AS count FROM speakit_push_devices
  `) as Array<{ count: number }>;

  return NextResponse.json({
    configured,
    deviceCount: rows[0]?.count ?? 0,
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Chưa đăng nhập phiên quản trị." }, { status: 401 });
  }

  let body: { title?: unknown; body?: unknown };
  try {
    body = (await req.json()) as { title?: unknown; body?: unknown };
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const messageBody = typeof body.body === "string" ? body.body.trim() : "";

  if (!title || !messageBody) {
    return NextResponse.json(
      { error: "Vui lòng nhập đầy đủ tiêu đề và nội dung thông báo." },
      { status: 400 }
    );
  }

  const ready = await ensureSchema();
  const sql = getNeonSql();
  if (!ready || !sql) {
    return NextResponse.json({ error: "Chưa kết nối Neon DB." }, { status: 503 });
  }

  const rows = (await sql`
    SELECT token FROM speakit_push_devices ORDER BY updated_at DESC LIMIT 1000
  `) as Array<{ token: string }>;

  const tokens = rows.map((r) => r.token);
  const result = await sendFcmBroadcast(tokens, title.slice(0, 120), messageBody.slice(0, 500));

  for (const badToken of result.invalidTokens) {
    await sql`DELETE FROM speakit_push_devices WHERE token = ${badToken}`.catch(() => null);
  }

  return NextResponse.json({
    ok: result.configured && !result.error,
    total: tokens.length,
    ...result,
  });
}

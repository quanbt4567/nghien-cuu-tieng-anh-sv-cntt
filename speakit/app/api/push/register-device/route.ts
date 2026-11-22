import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getNeonSql } from "../../../../lib/db/neon";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { token?: unknown; platform?: unknown; guestCode?: unknown };
  try {
    body = (await req.json()) as {
      token?: unknown;
      platform?: unknown;
      guestCode?: unknown;
    };
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token || token.length > 512) {
    return NextResponse.json({ error: "FCM token không hợp lệ." }, { status: 400 });
  }

  const platform =
    typeof body.platform === "string" && body.platform.trim()
      ? body.platform.trim().slice(0, 32)
      : "android";
  const guestCode =
    typeof body.guestCode === "string" && body.guestCode.trim()
      ? body.guestCode.trim().slice(0, 64)
      : null;

  const ready = await ensureSchema();
  const sql = getNeonSql();
  if (!ready || !sql) {
    return NextResponse.json(
      { ok: false, persisted: false, error: "Database chưa sẵn sàng." },
      { status: 503 }
    );
  }

  await sql`
    INSERT INTO speakit_push_devices (token, guest_code, platform, updated_at)
    VALUES (${token}, ${guestCode}, ${platform}, NOW())
    ON CONFLICT (token)
    DO UPDATE SET
      guest_code = COALESCE(EXCLUDED.guest_code, speakit_push_devices.guest_code),
      platform = EXCLUDED.platform,
      updated_at = NOW()
  `;

  return NextResponse.json({ ok: true, persisted: true });
}

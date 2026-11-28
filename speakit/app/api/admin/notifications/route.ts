import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../../../lib/adminAuth";
import { sanitizeMediaUrl } from "../../../../lib/contentStore";
import { ensureSchema, getNeonSql } from "../../../../lib/db/neon";
import type { InAppNotification } from "../../../../lib/types";

export const dynamic = "force-dynamic";

let bannerColumnReady = false;

async function ensureAnnouncementBannerColumn(
  sql: NonNullable<ReturnType<typeof getNeonSql>>
): Promise<void> {
  if (bannerColumnReady) return;
  await sql`ALTER TABLE speakit_announcements ADD COLUMN IF NOT EXISTS banner_url TEXT NULL`;
  bannerColumnReady = true;
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Chưa đăng nhập phiên quản trị." }, { status: 401 });
  }

  try {
    const ready = await ensureSchema();
    const sql = getNeonSql();
    if (!ready || !sql) {
      return NextResponse.json({ announcements: [] });
    }

    await ensureAnnouncementBannerColumn(sql);
    const rows = (await sql`
      SELECT id, title, body, banner_url AS "bannerUrl", created_at
      FROM speakit_announcements
      ORDER BY created_at DESC
      LIMIT 50
    `) as InAppNotification[];

    return NextResponse.json({ announcements: rows });
  } catch {
    return NextResponse.json({ announcements: [] });
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Chưa đăng nhập phiên quản trị." }, { status: 401 });
  }

  let body: { title?: unknown; body?: unknown; bannerUrl?: unknown };
  try {
    body = (await req.json()) as { title?: unknown; body?: unknown; bannerUrl?: unknown };
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
  const messageBody = typeof body.body === "string" ? body.body.trim().slice(0, 500) : "";
  const bannerUrl = sanitizeMediaUrl(body.bannerUrl) ?? null;

  if (!title || !messageBody) {
    return NextResponse.json(
      { error: "Vui lòng nhập đầy đủ tiêu đề và nội dung thông báo." },
      { status: 400 }
    );
  }

  try {
    const ready = await ensureSchema();
    const sql = getNeonSql();
    if (!ready || !sql) {
      return NextResponse.json({ error: "Chưa kết nối Neon DB." }, { status: 503 });
    }

    await ensureAnnouncementBannerColumn(sql);
    const id = randomUUID();
    const rows = (await sql`
      INSERT INTO speakit_announcements (id, title, body, banner_url)
      VALUES (${id}, ${title}, ${messageBody}, ${bannerUrl})
      RETURNING id, title, body, banner_url AS "bannerUrl", created_at
    `) as InAppNotification[];

    return NextResponse.json({ ok: true, announcement: rows[0] });
  } catch {
    return NextResponse.json({ error: "Không thể lưu thông báo lúc này." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Chưa đăng nhập phiên quản trị." }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!id) {
    return NextResponse.json({ error: "Thiếu mã thông báo cần xóa." }, { status: 400 });
  }

  try {
    const ready = await ensureSchema();
    const sql = getNeonSql();
    if (!ready || !sql) {
      return NextResponse.json({ error: "Chưa kết nối Neon DB." }, { status: 503 });
    }

    await sql`DELETE FROM speakit_announcements WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Không thể xóa thông báo lúc này." }, { status: 500 });
  }
}

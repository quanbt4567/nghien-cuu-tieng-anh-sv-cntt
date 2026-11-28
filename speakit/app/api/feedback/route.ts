import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../../lib/adminAuth";
import { getNeonSql } from "../../../lib/db/neon";
import { readExistingGuestPlayer } from "../../../lib/neon-auth";

export const dynamic = "force-dynamic";

async function ensureFeedbackTable(sql: NonNullable<ReturnType<typeof getNeonSql>>) {
  await sql`
    CREATE TABLE IF NOT EXISTS user_feedback (
      id TEXT PRIMARY KEY,
      rating INT NOT NULL,
      category TEXT,
      comment TEXT,
      context TEXT,
      player_name TEXT,
      avatar_url TEXT,
      resolved BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE user_feedback ADD COLUMN IF NOT EXISTS player_name TEXT`;
  await sql`ALTER TABLE user_feedback ADD COLUMN IF NOT EXISTS avatar_url TEXT`;
  await sql`ALTER TABLE user_feedback ADD COLUMN IF NOT EXISTS resolved BOOLEAN NOT NULL DEFAULT FALSE`;
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const sql = getNeonSql();
  if (!sql) {
    return NextResponse.json({ ok: true, connected: false, items: [] });
  }

  try {
    await ensureFeedbackTable(sql);
    const rows = await sql`
      SELECT id, rating, category, comment, context, player_name, avatar_url, resolved, created_at
      FROM user_feedback
      ORDER BY created_at DESC
      LIMIT 200
    `;
    const items = rows.map((row) => ({
      id: String(row.id),
      rating: Number(row.rating),
      category: row.category ? String(row.category) : null,
      comment: row.comment ? String(row.comment) : null,
      context: row.context ? String(row.context) : null,
      playerName: row.player_name ? String(row.player_name) : null,
      avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
      resolved: Boolean(row.resolved),
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at ?? new Date().toISOString()),
    }));
    return NextResponse.json({ ok: true, connected: true, items });
  } catch {
    return NextResponse.json({ ok: true, connected: false, items: [] });
  }
}

function trimOptional(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : null;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> | null = null;
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    return NextResponse.json(
      { ok: false, synced: false, error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  const rating = body?.rating;
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json(
      { ok: false, synced: false, error: "Rating must be an integer between 1 and 5." },
      { status: 400 }
    );
  }

  const category = trimOptional(body?.category, 40);
  const context = trimOptional(body?.context, 64);
  const comment = trimOptional(body?.comment, 500);

  const sql = getNeonSql();
  if (!sql) {
    return NextResponse.json({ ok: true, synced: false });
  }

  try {
    await ensureFeedbackTable(sql);

    const guest = await readExistingGuestPlayer().catch(() => null);
    const playerName = guest?.displayName?.trim().slice(0, 64) || null;
    const avatarUrl = guest?.avatarUrl?.trim().slice(0, 500) || null;

    const id = `fb_${randomUUID()}`;
    await sql`
      INSERT INTO user_feedback (id, rating, category, comment, context, player_name, avatar_url)
      VALUES (${id}, ${rating}, ${category}, ${comment}, ${context}, ${playerName}, ${avatarUrl})
    `;

    return NextResponse.json({ ok: true, synced: true });
  } catch {
    return NextResponse.json({ ok: true, synced: false });
  }
}

export async function PATCH(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  let body: { id?: unknown; resolved?: unknown } | null = null;
  try {
    body = (await req.json()) as { id?: unknown; resolved?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const resolved = typeof body?.resolved === "boolean" ? body.resolved : null;
  if (!id || resolved === null) {
    return NextResponse.json(
      { ok: false, error: "id and resolved are required" },
      { status: 400 }
    );
  }

  const sql = getNeonSql();
  if (!sql) {
    return NextResponse.json({ ok: true, synced: false, id, resolved });
  }

  try {
    await ensureFeedbackTable(sql);
    await sql`
      UPDATE user_feedback
      SET resolved = ${resolved}
      WHERE id = ${id}
    `;
    return NextResponse.json({ ok: true, synced: true, id, resolved });
  } catch {
    return NextResponse.json({ ok: false, error: "Update failed" }, { status: 500 });
  }
}

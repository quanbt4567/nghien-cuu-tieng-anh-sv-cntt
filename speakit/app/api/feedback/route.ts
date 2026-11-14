import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getNeonSql } from "../../../lib/db/neon";

export const dynamic = "force-dynamic";

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
    await sql`
      CREATE TABLE IF NOT EXISTS user_feedback (
        id TEXT PRIMARY KEY,
        rating INT NOT NULL,
        category TEXT,
        comment TEXT,
        context TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    const id = `fb_${randomUUID()}`;
    await sql`
      INSERT INTO user_feedback (id, rating, category, comment, context)
      VALUES (${id}, ${rating}, ${category}, ${comment}, ${context})
    `;

    return NextResponse.json({ ok: true, synced: true });
  } catch {
    return NextResponse.json({ ok: true, synced: false });
  }
}

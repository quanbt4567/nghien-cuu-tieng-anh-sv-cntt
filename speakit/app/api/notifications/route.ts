import { NextResponse } from "next/server";
import { ensureSchema, getNeonSql } from "../../../lib/db/neon";

export const dynamic = "force-dynamic";

export interface PublicAnnouncement {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

export async function GET() {
  const ready = await ensureSchema();
  const sql = getNeonSql();
  if (!ready || !sql) {
    return NextResponse.json({ announcements: [] });
  }

  const rows = (await sql`
    SELECT id, title, body, created_at
    FROM speakit_announcements
    ORDER BY created_at DESC
    LIMIT 10
  `) as PublicAnnouncement[];

  return NextResponse.json({ announcements: rows });
}

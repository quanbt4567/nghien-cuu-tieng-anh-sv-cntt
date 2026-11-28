import { NextResponse } from "next/server";
import { ensureSchema, getNeonSql } from "../../../lib/db/neon";
import type { InAppNotification } from "../../../lib/types";

export const dynamic = "force-dynamic";

export type PublicAnnouncement = InAppNotification;

let bannerColumnReady = false;

export async function GET() {
  try {
    const ready = await ensureSchema();
    const sql = getNeonSql();
    if (!ready || !sql) {
      return NextResponse.json({ announcements: [] });
    }

    if (!bannerColumnReady) {
      await sql`ALTER TABLE speakit_announcements ADD COLUMN IF NOT EXISTS banner_url TEXT NULL`;
      bannerColumnReady = true;
    }

    const rows = (await sql`
      SELECT id, title, body, banner_url AS "bannerUrl", created_at
      FROM speakit_announcements
      ORDER BY created_at DESC
      LIMIT 10
    `) as PublicAnnouncement[];

    return NextResponse.json({ announcements: rows });
  } catch {
    return NextResponse.json({ announcements: [] });
  }
}

import { NextResponse } from "next/server";
import {
  createEmptyContentOverrides,
  normalizeContentOverrides,
} from "../../../lib/contentStore";
import { ensureSchema, getNeonSql } from "../../../lib/db/neon";

export const dynamic = "force-dynamic";

export async function GET() {
  const sql = getNeonSql();
  if (!sql) {
    return NextResponse.json({
      overrides: createEmptyContentOverrides(),
      source: "default",
    });
  }

  try {
    const ready = await ensureSchema();
    if (!ready) {
      return NextResponse.json({
        overrides: createEmptyContentOverrides(),
        source: "default",
      });
    }

    const rows = await sql`
      SELECT payload
      FROM speakit_custom_content
      WHERE key = 'main'
      LIMIT 1
    `;
    const rawPayload = rows[0]?.payload;
    return NextResponse.json({
      overrides: normalizeContentOverrides(rawPayload),
      source: "neon",
    });
  } catch {
    return NextResponse.json({
      overrides: createEmptyContentOverrides(),
      source: "default",
    });
  }
}

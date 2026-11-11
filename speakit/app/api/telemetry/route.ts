import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getNeonSql } from "../../../lib/db/neon";
import type { WeakPointKind } from "../../../lib/types";

export const dynamic = "force-dynamic";

type TelemetryType = "attempt" | "weak_points" | "arena_run";

function validIsoOrNow(raw: unknown): string {
  if (typeof raw === "string" && raw.trim()) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return new Date().toISOString();
}

function clampInt(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function cleanOptionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 64) : null;
}

export async function POST(req: NextRequest) {
  let body: { type?: unknown; payload?: unknown } | null = null;
  try {
    body = (await req.json()) as { type?: unknown; payload?: unknown };
  } catch {
    return NextResponse.json(
      { ok: false, synced: false, error: "Dữ liệu telemetry không hợp lệ." },
      { status: 400 }
    );
  }

  const type = body?.type as TelemetryType | undefined;
  const payload = body?.payload;

  if (
    (type !== "attempt" && type !== "weak_points" && type !== "arena_run") ||
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return NextResponse.json(
      { ok: false, synced: false, error: "Loại hoặc cấu trúc telemetry không hợp lệ." },
      { status: 400 }
    );
  }

  const p = payload as Record<string, unknown>;

  if (type === "attempt") {
    if (typeof p.scenario !== "string" || !p.scenario.trim() || typeof p.transcript !== "string") {
      return NextResponse.json(
        { ok: false, synced: false, error: "Thiếu thông tin scenario hoặc transcript." },
        { status: 400 }
      );
    }
  } else if (type === "arena_run") {
    const gameId =
      typeof p.gameId === "string"
        ? p.gameId.trim()
        : typeof p.game_id === "string"
        ? p.game_id.trim()
        : "";
    if (!gameId) {
      return NextResponse.json(
        { ok: false, synced: false, error: "Thiếu mã minigame (gameId)." },
        { status: 400 }
      );
    }
  }

  const sql = getNeonSql();
  if (!sql) {
    return NextResponse.json({ ok: true, synced: false });
  }

  try {
    const ready = await ensureSchema();
    if (!ready) {
      return NextResponse.json({ ok: true, synced: false });
    }

    if (type === "attempt") {
      const id =
        typeof p.id === "string" && p.id.trim() ? p.id.trim() : `att_${randomUUID()}`;
      const scenario = String(p.scenario).trim();
      const turnIndex = clampInt(p.turn_index ?? p.turnIndex, 0, 100);
      const transcript = String(p.transcript);
      const score = clampInt(p.score, 0, 100);
      const keywordsUsed = Array.isArray(p.keywords_used)
        ? p.keywords_used.filter((k): k is string => typeof k === "string")
        : Array.isArray(p.keywordsUsed)
        ? p.keywordsUsed.filter((k): k is string => typeof k === "string")
        : [];
      const role = cleanOptionalText(p.role);
      const createdAt = validIsoOrNow(p.created_at ?? p.createdAt);

      await sql`
        INSERT INTO speakit_attempts (
          id, scenario, turn_index, transcript, score, keywords_used, role, created_at
        )
        VALUES (
          ${id},
          ${scenario},
          ${turnIndex},
          ${transcript},
          ${score},
          ${JSON.stringify(keywordsUsed)}::jsonb,
          ${role},
          ${createdAt}::timestamptz
        )
        ON CONFLICT (id) DO NOTHING
      `;
    } else if (type === "weak_points") {
      const counts = new Map<
        string,
        { key: string; kind: WeakPointKind; value: string; count: number }
      >();

      const addItems = (list: unknown, kind: WeakPointKind) => {
        if (!Array.isArray(list)) return;
        for (const raw of list) {
          if (typeof raw !== "string") continue;
          const clean = raw.trim().toLowerCase();
          if (!clean) continue;
          const key = `${kind}:${clean}`;
          const existing = counts.get(key);
          if (existing) {
            existing.count += 1;
          } else {
            counts.set(key, { key, kind, value: clean, count: 1 });
          }
        }
      };

      addItems(p.missedKeywords, "keyword");
      addItems(p.grammarIssues, "grammar");

      if (counts.size > 0) {
        await sql.transaction(
          Array.from(counts.values()).map(
            (entry) => sql`
              INSERT INTO speakit_weak_points (key, kind, value, miss_count, updated_at)
              VALUES (${entry.key}, ${entry.kind}, ${entry.value}, ${entry.count}, NOW())
              ON CONFLICT (key) DO UPDATE SET
                miss_count = speakit_weak_points.miss_count + EXCLUDED.miss_count,
                updated_at = NOW()
            `
          )
        );
      }
    } else if (type === "arena_run") {
      const id =
        typeof p.id === "string" && p.id.trim() ? p.id.trim() : `run_${randomUUID()}`;
      const gameId = String(p.gameId ?? p.game_id).trim();
      const score = clampInt(p.score, 0, 1_000_000);
      const accuracyOrWords = clampInt(
        p.accuracyOrWords ?? p.accuracy_or_words,
        0,
        100_000
      );
      const durationSec = clampInt(p.durationSec ?? p.duration_sec, 0, 86_400);
      const role = cleanOptionalText(p.role);
      const createdAt = validIsoOrNow(p.createdAt ?? p.created_at);

      await sql`
        INSERT INTO speakit_arena_runs (
          id, game_id, score, accuracy_or_words, duration_sec, role, created_at
        )
        VALUES (
          ${id},
          ${gameId},
          ${score},
          ${accuracyOrWords},
          ${durationSec},
          ${role},
          ${createdAt}::timestamptz
        )
        ON CONFLICT (id) DO NOTHING
      `;
    }

    return NextResponse.json({ ok: true, synced: true });
  } catch {
    return NextResponse.json({ ok: true, synced: false });
  }
}

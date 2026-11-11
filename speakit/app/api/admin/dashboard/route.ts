import { NextRequest, NextResponse } from "next/server";
import { SCENARIOS } from "../../../../data/scenarios";
import { isAdminRequest, isUsingDefaultPasscode } from "../../../../lib/adminAuth";
import {
  createEmptyContentOverrides,
  mergeScenarios,
  normalizeContentOverrides,
} from "../../../../lib/contentStore";
import { ensureSchema, getNeonSql } from "../../../../lib/db/neon";
import type { ArenaRunRecord, PracticeAttempt, WeakPoint } from "../../../../lib/types";

export const dynamic = "force-dynamic";

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.trim()) return value;
  return new Date().toISOString();
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json(
      { error: "Chưa đăng nhập phiên quản trị." },
      { status: 401 }
    );
  }

  const baseHealth = {
    neonConnected: false,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    isDefaultPasscode: isUsingDefaultPasscode(),
  };

  const emptyOverrides = createEmptyContentOverrides();
  const fallbackPayload = {
    stats: {
      totalAttempts: 0,
      avgScore: 0,
      totalArenaRuns: 0,
      activeScenariosCount: SCENARIOS.length,
      totalWeakPoints: 0,
      roleBreakdown: {} as Record<string, number>,
      scenarioBreakdown: [] as Array<{
        scenario: string;
        count: number;
        avgScore: number;
      }>,
    },
    attempts: [] as PracticeAttempt[],
    weakPoints: [] as WeakPoint[],
    arenaRuns: [] as ArenaRunRecord[],
    overrides: emptyOverrides,
    health: baseHealth,
  };

  const sql = getNeonSql();
  if (!sql) {
    return NextResponse.json(fallbackPayload);
  }

  try {
    const ready = await ensureSchema();
    if (!ready) {
      return NextResponse.json(fallbackPayload);
    }

    const [
      attemptRows,
      weakPointRows,
      arenaRows,
      contentRows,
      attemptSummaryRows,
      arenaSummaryRows,
      weakSummaryRows,
      roleRows,
      scenarioRows,
    ] = await sql.transaction([
      sql`
        SELECT id, scenario, turn_index, transcript, score, keywords_used, role, created_at
        FROM speakit_attempts
        ORDER BY created_at DESC
        LIMIT 200
      `,
      sql`
        SELECT key, kind, value, miss_count, updated_at
        FROM speakit_weak_points
        ORDER BY miss_count DESC, updated_at DESC
        LIMIT 100
      `,
      sql`
        SELECT id, game_id, score, accuracy_or_words, duration_sec, role, created_at
        FROM speakit_arena_runs
        ORDER BY created_at DESC
        LIMIT 200
      `,
      sql`
        SELECT payload
        FROM speakit_custom_content
        WHERE key = 'main'
        LIMIT 1
      `,
      sql`
        SELECT COUNT(*)::int AS total, COALESCE(ROUND(AVG(score)), 0)::int AS avg_score
        FROM speakit_attempts
      `,
      sql`
        SELECT COUNT(*)::int AS total
        FROM speakit_arena_runs
      `,
      sql`
        SELECT COUNT(*)::int AS total
        FROM speakit_weak_points
      `,
      sql`
        SELECT COALESCE(NULLIF(TRIM(role), ''), 'unknown') AS role, COUNT(*)::int AS total
        FROM (
          SELECT role FROM speakit_attempts
          UNION ALL
          SELECT role FROM speakit_arena_runs
        ) combined
        GROUP BY 1
      `,
      sql`
        SELECT scenario, COUNT(*)::int AS count, COALESCE(ROUND(AVG(score)), 0)::int AS avg_score
        FROM speakit_attempts
        GROUP BY scenario
        ORDER BY count DESC
      `,
    ]);

    const overrides = normalizeContentOverrides(contentRows[0]?.payload);

    const attempts: PracticeAttempt[] = attemptRows.map((r) => ({
      id: String(r.id),
      scenario: String(r.scenario),
      turn_index: Number(r.turn_index) || 0,
      transcript: String(r.transcript ?? ""),
      score: Number(r.score) || 0,
      keywords_used: Array.isArray(r.keywords_used)
        ? r.keywords_used.map(String)
        : [],
      role: typeof r.role === "string" ? r.role : null,
      created_at: toIsoString(r.created_at),
    }));

    const weakPoints: WeakPoint[] = weakPointRows.map((r) => ({
      id: String(r.key),
      kind: r.kind === "grammar" ? "grammar" : "keyword",
      value: String(r.value ?? ""),
      miss_count: Number(r.miss_count) || 1,
      updated_at: toIsoString(r.updated_at),
    }));

    const arenaRuns: ArenaRunRecord[] = arenaRows.map((r) => ({
      id: String(r.id),
      game_id: String(r.game_id),
      score: Number(r.score) || 0,
      accuracy_or_words: Number(r.accuracy_or_words) || 0,
      duration_sec: Number(r.duration_sec) || 0,
      role: typeof r.role === "string" ? r.role : null,
      created_at: toIsoString(r.created_at),
    }));

    const roleBreakdown: Record<string, number> = {};
    for (const row of roleRows) {
      roleBreakdown[String(row.role)] = Number(row.total) || 0;
    }

    const scenarioBreakdown = scenarioRows.map((row) => ({
      scenario: String(row.scenario),
      count: Number(row.count) || 0,
      avgScore: Number(row.avg_score) || 0,
    }));

    return NextResponse.json({
      stats: {
        totalAttempts: Number(attemptSummaryRows[0]?.total) || 0,
        avgScore: Number(attemptSummaryRows[0]?.avg_score) || 0,
        totalArenaRuns: Number(arenaSummaryRows[0]?.total) || 0,
        activeScenariosCount: mergeScenarios(SCENARIOS, overrides, false).length,
        totalWeakPoints: Number(weakSummaryRows[0]?.total) || 0,
        roleBreakdown,
        scenarioBreakdown,
      },
      attempts,
      weakPoints,
      arenaRuns,
      overrides,
      health: {
        ...baseHealth,
        neonConnected: true,
      },
    });
  } catch {
    return NextResponse.json(fallbackPayload);
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json(
      { error: "Chưa đăng nhập phiên quản trị." },
      { status: 401 }
    );
  }

  let body: { action?: unknown } | null = null;
  try {
    body = (await req.json()) as { action?: unknown };
  } catch {
    return NextResponse.json(
      { ok: false, error: "Dữ liệu yêu cầu không hợp lệ." },
      { status: 400 }
    );
  }

  if (body?.action !== "reset_analytics") {
    return NextResponse.json(
      { ok: false, error: "Hành động quản trị không được hỗ trợ." },
      { status: 400 }
    );
  }

  const sql = getNeonSql();
  if (!sql || !(await ensureSchema())) {
    return NextResponse.json(
      {
        ok: false,
        error: "Không thể đặt lại thống kê vì chưa kết nối Neon Postgres (DATABASE_URL).",
      },
      { status: 503 }
    );
  }

  try {
    await sql.transaction([
      sql`DELETE FROM speakit_attempts`,
      sql`DELETE FROM speakit_weak_points`,
      sql`DELETE FROM speakit_arena_runs`,
    ]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Lỗi khi xóa dữ liệu thống kê trên Neon Postgres." },
      { status: 500 }
    );
  }
}

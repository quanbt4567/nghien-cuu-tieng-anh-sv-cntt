import { randomUUID } from "crypto";
import { ensureGuestDatabaseReady, getDbClient } from "./db";

export const MODERATION_PENALTY_MAX_COINS = 100;

export type ModerationSource =
  | "word-chain"
  | "duel"
  | "taboo"
  | "party"
  | "practice";

export type ModerationCategory = "sensitive" | "off_topic";
export type ModerationSeverity = "high" | "medium";
export type ModerationStatus = "open" | "penalized" | "dismissed";

export interface ModerationIncident {
  id: string;
  playerId: string | null;
  playerName: string;
  transferCode: string | null;
  source: ModerationSource | string;
  roomOrTopic: string | null;
  content: string;
  category: ModerationCategory | string;
  severity: ModerationSeverity | string;
  reason: string;
  aiProvider: string | null;
  status: ModerationStatus | string;
  coinsDeducted: number;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

const SENSITIVE_ENGLISH_TOKENS = new Set([
  "nigga",
  "niggas",
  "nigger",
  "niggers",
  "fag",
  "faggot",
  "faggots",
  "retard",
  "retarded",
  "dick",
  "dicks",
  "dickhead",
  "cock",
  "cocks",
  "pussy",
  "pussies",
  "cunt",
  "cunts",
  "fuck",
  "fucked",
  "fucker",
  "fuckers",
  "fucking",
  "motherfucker",
  "shit",
  "shitty",
  "bullshit",
  "bitch",
  "bitches",
  "slut",
  "sluts",
  "whore",
  "whores",
  "asshole",
  "assholes",
  "bastard",
  "porn",
  "porno",
  "pornography",
  "hentai",
  "dildo",
  "blowjob",
  "handjob",
  "boobs",
  "tits",
  "penis",
  "vagina",
  "cum",
  "jizz",
  "rape",
  "rapist",
  "nazi",
  "hitler",
  "kys",
  "chink",
  "spic",
  "kike",
  "tranny",
]);

const SENSITIVE_VIETNAMESE_TOKENS = new Set([
  "dit",
  "du",
  "cac",
  "lon",
  "buoi",
  "dai",
  "cave",
  "di",
  "dm",
  "dcm",
  "dkm",
  "vcl",
  "vkl",
  "vl",
  "deo",
  "clgt",
  "ml",
  "occho",
  "ngu",
  "súc vật",
  "cho de",
]);

const SENSITIVE_UNICODE_PATTERNS: RegExp[] = [
  /(?:^|[\s,.;:!?'"()[\]{}])địt(?:$|[\s,.;:!?'"()[\]{}])/i,
  /(?:^|[\s,.;:!?'"()[\]{}])đụ(?:$|[\s,.;:!?'"()[\]{}])/i,
  /(?:^|[\s,.;:!?'"()[\]{}])cặc(?:$|[\s,.;:!?'"()[\]{}])/i,
  /(?:^|[\s,.;:!?'"()[\]{}])lồn(?:$|[\s,.;:!?'"()[\]{}])/i,
  /(?:^|[\s,.;:!?'"()[\]{}])buồi(?:$|[\s,.;:!?'"()[\]{}])/i,
  /(?:^|[\s,.;:!?'"()[\]{}])đĩ(?:$|[\s,.;:!?'"()[\]{}])/i,
  /(?:^|[\s,.;:!?'"()[\]{}])đéo(?:$|[\s,.;:!?'"()[\]{}])/i,
  /(?:^|[\s,.;:!?'"()[\]{}])đm(?:$|[\s,.;:!?'"()[\]{}])/i,
  /(?:^|[\s,.;:!?'"()[\]{}])chó\s+đẻ(?:$|[\s,.;:!?'"()[\]{}])/i,
  /(?:^|[\s,.;:!?'"()[\]{}])súc\s+vật(?:$|[\s,.;:!?'"()[\]{}])/i,
  /\bkill\s+yourself\b/i,
  /\bsuck\s+my\s+dick\b/i,
];

function stripSimpleLeetspeak(token: string): string {
  return token
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/\$/g, "s")
    .replace(/@/g, "a");
}

function stripVietnameseTones(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

export function clampModerationCoins(coins: unknown, fallback = 5): number {
  const num = Number(coins);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(MODERATION_PENALTY_MAX_COINS, Math.round(num)));
}

export function detectSensitiveLanguage(text: string): {
  flagged: boolean;
  category: "sensitive" | null;
  matched: string[];
  reason: string;
} {
  const raw = typeof text === "string" ? text.trim() : "";
  if (!raw) {
    return { flagged: false, category: null, matched: [], reason: "" };
  }

  const matched = new Set<string>();

  for (const rx of SENSITIVE_UNICODE_PATTERNS) {
    const m = raw.match(rx);
    if (m?.[0]) {
      matched.add(m[0].trim());
    }
  }

  const asciiLower = stripVietnameseTones(raw).toLowerCase();
  const tokens = asciiLower
    .split(/[^a-z0-9@$]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  for (const token of tokens) {
    const normalized = stripSimpleLeetspeak(token);
    if (
      SENSITIVE_ENGLISH_TOKENS.has(token) ||
      SENSITIVE_ENGLISH_TOKENS.has(normalized) ||
      SENSITIVE_VIETNAMESE_TOKENS.has(token)
    ) {
      matched.add(token);
    }
  }

  if (matched.size > 0) {
    const list = Array.from(matched).slice(0, 4);
    return {
      flagged: true,
      category: "sensitive",
      matched: list,
      reason: `Phát hiện từ ngữ nhạy cảm / thiếu chuẩn mực (${list.join(", ")}).`,
    };
  }

  return { flagged: false, category: null, matched: [], reason: "" };
}

let moderationSchemaUrl: string | null = null;
let moderationSchemaInFlight: Promise<boolean> | null = null;

export async function ensureModerationSchema(): Promise<boolean> {
  const sql = getDbClient();
  const url = process.env.DATABASE_URL?.trim() ?? "";
  if (!sql || !url) return false;
  if (moderationSchemaUrl === url) return true;
  if (moderationSchemaInFlight) return moderationSchemaInFlight;

  moderationSchemaInFlight = (async () => {
    try {
      await ensureGuestDatabaseReady();
      await sql`
        CREATE TABLE IF NOT EXISTS moderation_incidents (
          id TEXT PRIMARY KEY,
          player_id TEXT,
          player_name TEXT NOT NULL,
          transfer_code TEXT,
          source TEXT NOT NULL,
          room_or_topic TEXT,
          content TEXT NOT NULL,
          category TEXT NOT NULL,
          severity TEXT NOT NULL DEFAULT 'high',
          reason TEXT NOT NULL,
          ai_provider TEXT,
          status TEXT NOT NULL DEFAULT 'open',
          coins_deducted INTEGER NOT NULL DEFAULT 0,
          admin_note TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          resolved_at TIMESTAMPTZ
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_moderation_incidents_status_created
        ON moderation_incidents (status, created_at DESC)
      `;
      moderationSchemaUrl = url;
      return true;
    } catch {
      return false;
    } finally {
      moderationSchemaInFlight = null;
    }
  })();

  return moderationSchemaInFlight;
}

export async function recordModerationIncident(input: {
  playerId?: string | null;
  playerName?: string | null;
  transferCode?: string | null;
  source: ModerationSource;
  roomOrTopic?: string | null;
  content: string;
  category: ModerationCategory;
  severity?: ModerationSeverity;
  reason: string;
  aiProvider?: string | null;
}): Promise<boolean> {
  try {
    const ready = await ensureModerationSchema();
    const sql = getDbClient();
    if (!ready || !sql) return false;

    const id = `mod_${randomUUID().slice(0, 12)}`;
    const playerName =
      typeof input.playerName === "string" && input.playerName.trim()
        ? input.playerName.trim().slice(0, 80)
        : "Khách ẩn danh";
    const content = input.content.trim().slice(0, 800);
    const reason = input.reason.trim().slice(0, 400);
    const severity = input.severity ?? (input.category === "sensitive" ? "high" : "medium");

    await sql`
      INSERT INTO moderation_incidents (
        id, player_id, player_name, transfer_code, source, room_or_topic,
        content, category, severity, reason, ai_provider, status
      )
      VALUES (
        ${id},
        ${input.playerId ?? null},
        ${playerName},
        ${input.transferCode ?? null},
        ${input.source},
        ${input.roomOrTopic ?? null},
        ${content},
        ${input.category},
        ${severity},
        ${reason},
        ${input.aiProvider ?? null},
        'open'
      )
    `;
    return true;
  } catch {
    return false;
  }
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.trim()) return value;
  return new Date().toISOString();
}

export async function listModerationIncidents(): Promise<{
  incidents: ModerationIncident[];
  openCount: number;
  sensitiveCount: number;
}> {
  const ready = await ensureModerationSchema();
  const sql = getDbClient();
  if (!ready || !sql) {
    return { incidents: [], openCount: 0, sensitiveCount: 0 };
  }

  try {
    const rows = (await sql`
      SELECT id, player_id, player_name, transfer_code, source, room_or_topic,
             content, category, severity, reason, ai_provider, status,
             coins_deducted, admin_note, created_at, resolved_at
      FROM moderation_incidents
      ORDER BY
        CASE WHEN status = 'open' THEN 0 ELSE 1 END,
        created_at DESC
      LIMIT 120
    `) as Array<Record<string, unknown>>;

    const incidents: ModerationIncident[] = rows.map((r) => ({
      id: String(r.id),
      playerId: r.player_id ? String(r.player_id) : null,
      playerName: String(r.player_name ?? "Khách"),
      transferCode: r.transfer_code ? String(r.transfer_code) : null,
      source: String(r.source ?? "unknown"),
      roomOrTopic: r.room_or_topic ? String(r.room_or_topic) : null,
      content: String(r.content ?? ""),
      category: String(r.category ?? "sensitive"),
      severity: String(r.severity ?? "high"),
      reason: String(r.reason ?? ""),
      aiProvider: r.ai_provider ? String(r.ai_provider) : null,
      status: String(r.status ?? "open"),
      coinsDeducted: Math.max(0, Number(r.coins_deducted) || 0),
      adminNote: r.admin_note ? String(r.admin_note) : null,
      createdAt: toIso(r.created_at),
      resolvedAt: r.resolved_at ? toIso(r.resolved_at) : null,
    }));

    const openCount = incidents.filter((i) => i.status === "open").length;
    const sensitiveCount = incidents.filter(
      (i) => i.status === "open" && i.category === "sensitive"
    ).length;

    return { incidents, openCount, sensitiveCount };
  } catch {
    return { incidents: [], openCount: 0, sensitiveCount: 0 };
  }
}

export async function resolveModerationIncident(input: {
  id: string;
  action: "penalize" | "dismiss";
  coins?: number;
  note?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const ready = await ensureModerationSchema();
  const sql = getDbClient();
  if (!ready || !sql) {
    return { ok: false, error: "Chưa kết nối Neon DB." };
  }

  try {
    const existing = (await sql`
      SELECT id, player_id, status
      FROM moderation_incidents
      WHERE id = ${input.id}
      LIMIT 1
    `) as Array<{ id: string; player_id: string | null; status: string }>;

    if (existing.length === 0) {
      return { ok: false, error: "Không tìm thấy cảnh báo vi phạm." };
    }

    const row = existing[0];
    if (row.status !== "open") {
      return { ok: false, error: "Cảnh báo này đã được xử lý trước đó." };
    }

    const note =
      typeof input.note === "string" && input.note.trim()
        ? input.note.trim().slice(0, 300)
        : null;

    if (input.action === "dismiss") {
      await sql`
        UPDATE moderation_incidents
        SET status = 'dismissed', admin_note = ${note}, resolved_at = NOW()
        WHERE id = ${input.id}
      `;
      return { ok: true };
    }

    const coins = clampModerationCoins(input.coins, 5);
    const pointsToDeduct = coins * 1000;

    if (row.player_id && coins > 0) {
      await sql`
        UPDATE guest_players
        SET it_coins = GREATEST(0, it_coins - ${coins}),
            total_points = GREATEST(0, total_points - ${pointsToDeduct}),
            updated_at = NOW()
        WHERE id = ${row.player_id}
      `;
    }

    await sql`
      UPDATE moderation_incidents
      SET status = 'penalized',
          coins_deducted = ${coins},
          admin_note = ${note},
          resolved_at = NOW()
      WHERE id = ${input.id}
    `;

    return { ok: true };
  } catch {
    return { ok: false, error: "Lỗi xử lý cảnh báo kiểm duyệt." };
  }
}

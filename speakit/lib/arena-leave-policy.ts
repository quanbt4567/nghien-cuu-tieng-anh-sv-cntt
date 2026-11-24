import { randomUUID } from "crypto";
import { ensureGuestDatabaseReady, getDbClient } from "./db";

export const FORFEIT_PENALTY_COINS = 3;
export const MAX_FORFEITS_BEFORE_FREEZE = 10;
export const MAX_FORFEITS_AFTER_FIRST_FREEZE = 5;
export const PERMANENT_FREEZE_ISO = "2099-12-31T23:59:59.000Z";
export const REASON_MIN_LENGTH = 15;
export const REASON_MAX_LENGTH = 300;
export const MAX_PENDING_REASON_REQUESTS = 3;
export const ADMIN_PENALTY_MAX_COINS = 50;

export type ArenaLeaveGameId = "duel" | "taboo" | "word-chain" | "party";

export interface ForfeitEvalInput {
  leaveCount: number;
  freezeStrikes: number;
}

export interface ForfeitEvalResult {
  leaveCount: number;
  freezeStrikes: number;
  frozenUntilMs: number | null;
  frozenUntilIso: string | null;
  permanent: boolean;
  freezeMinutes: number;
  limitUsed: number;
}

export interface LeaveRequestItem {
  id: string;
  playerId: string;
  playerName: string;
  gameId: string;
  roomCode: string | null;
  kind: "forfeit" | "reason";
  reason: string | null;
  status: "penalized" | "pending" | "approved" | "rejected";
  penaltyCoins: number;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface FlaggedPlayerItem {
  id: string;
  displayName: string;
  transferCode: string;
  itCoins: number;
  totalPoints: number;
  leaveCount: number;
  freezeStrikes: number;
  forfeitsTotal: number;
  frozenUntil: string | null;
  permanent: boolean;
  frozenNow: boolean;
}

export function isValidArenaLeaveGameId(value: unknown): value is ArenaLeaveGameId {
  return (
    value === "duel" ||
    value === "taboo" ||
    value === "word-chain" ||
    value === "party"
  );
}

export function forfeitsRemaining(state: ForfeitEvalInput): {
  remaining: number;
  limit: number;
} {
  const strikes = Math.max(0, Math.floor(Number(state.freezeStrikes) || 0));
  const count = Math.max(0, Math.floor(Number(state.leaveCount) || 0));
  const limit =
    strikes >= 1 ? MAX_FORFEITS_AFTER_FIRST_FREEZE : MAX_FORFEITS_BEFORE_FREEZE;
  return {
    limit,
    remaining: Math.max(0, limit - count),
  };
}

export function freezeMinutesForStrike(strike: number): {
  minutes: number;
  permanent: boolean;
} {
  if (strike <= 1) return { minutes: 30, permanent: false };
  if (strike === 2) return { minutes: 360, permanent: false };
  if (strike === 3) return { minutes: 1440, permanent: false };
  return { minutes: 0, permanent: true };
}

export function evaluateForfeit(
  state: ForfeitEvalInput,
  nowMs = Date.now()
): ForfeitEvalResult {
  const strikes = Math.max(0, Math.floor(Number(state.freezeStrikes) || 0));
  const prevCount = Math.max(0, Math.floor(Number(state.leaveCount) || 0));
  const limitUsed =
    strikes >= 1 ? MAX_FORFEITS_AFTER_FIRST_FREEZE : MAX_FORFEITS_BEFORE_FREEZE;
  const nextCount = prevCount + 1;

  if (nextCount > limitUsed) {
    const nextStrikes = strikes + 1;
    const spec = freezeMinutesForStrike(nextStrikes);
    if (spec.permanent) {
      const permanentMs = Date.parse(PERMANENT_FREEZE_ISO);
      return {
        leaveCount: 0,
        freezeStrikes: nextStrikes,
        frozenUntilMs: permanentMs,
        frozenUntilIso: PERMANENT_FREEZE_ISO,
        permanent: true,
        freezeMinutes: 0,
        limitUsed,
      };
    }
    const frozenUntilMs = nowMs + spec.minutes * 60 * 1000;
    return {
      leaveCount: 0,
      freezeStrikes: nextStrikes,
      frozenUntilMs,
      frozenUntilIso: new Date(frozenUntilMs).toISOString(),
      permanent: false,
      freezeMinutes: spec.minutes,
      limitUsed,
    };
  }

  return {
    leaveCount: nextCount,
    freezeStrikes: strikes,
    frozenUntilMs: null,
    frozenUntilIso: null,
    permanent: false,
    freezeMinutes: 0,
    limitUsed,
  };
}

export function isFrozen(
  frozenUntil: string | Date | null | undefined,
  nowMs = Date.now()
): {
  frozen: boolean;
  permanent: boolean;
  remainingMinutes: number;
  frozenUntilIso: string | null;
} {
  if (!frozenUntil) {
    return {
      frozen: false,
      permanent: false,
      remainingMinutes: 0,
      frozenUntilIso: null,
    };
  }

  const parsedMs =
    frozenUntil instanceof Date
      ? frozenUntil.getTime()
      : Date.parse(String(frozenUntil));

  if (!Number.isFinite(parsedMs) || parsedMs <= nowMs) {
    return {
      frozen: false,
      permanent: false,
      remainingMinutes: 0,
      frozenUntilIso: null,
    };
  }

  const permanentThresholdMs = Date.parse("2090-01-01T00:00:00.000Z");
  const permanent = parsedMs >= permanentThresholdMs;
  const remainingMinutes = permanent
    ? 0
    : Math.max(1, Math.ceil((parsedMs - nowMs) / 60000));

  return {
    frozen: true,
    permanent,
    remainingMinutes,
    frozenUntilIso: new Date(parsedMs).toISOString(),
  };
}

export function validateReason(reason: unknown): {
  valid: boolean;
  cleaned: string;
  error?: string;
} {
  if (typeof reason !== "string") {
    return {
      valid: false,
      cleaned: "",
      error: "Vui lòng nhập lý do muốn thoát giữa chừng.",
    };
  }
  const cleaned = reason.trim().replace(/\s+/g, " ");
  if (cleaned.length < REASON_MIN_LENGTH) {
    return {
      valid: false,
      cleaned,
      error: `Lý do quá ngắn. Hãy viết rõ ít nhất ${REASON_MIN_LENGTH} ký tự để Admin xem xét.`,
    };
  }
  if (cleaned.length > REASON_MAX_LENGTH) {
    return {
      valid: false,
      cleaned: cleaned.slice(0, REASON_MAX_LENGTH),
      error: `Lý do tối đa ${REASON_MAX_LENGTH} ký tự.`,
    };
  }
  return { valid: true, cleaned };
}

export function clampPenalty(
  coins: unknown,
  fallback = FORFEIT_PENALTY_COINS
): number {
  const num = Number(coins);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(ADMIN_PENALTY_MAX_COINS, Math.round(num)));
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.trim()) return value;
  return new Date().toISOString();
}

function formatFreezeDurationVI(minutes: number, permanent: boolean): string {
  if (permanent) return "vĩnh viễn cho tới khi Admin mở khóa";
  if (minutes >= 1440) return `${Math.round(minutes / 1440)} ngày`;
  if (minutes >= 60) return `${Math.round(minutes / 60)} giờ`;
  return `${Math.max(1, minutes)} phút`;
}

let leaveSchemaReadyUrl: string | null = null;
let leaveSchemaInFlight: Promise<boolean> | null = null;

export async function ensureLeaveSchema(): Promise<boolean> {
  const sql = getDbClient();
  const url = process.env.DATABASE_URL?.trim() ?? "";
  if (!sql || !url) return false;
  if (leaveSchemaReadyUrl === url) return true;
  if (leaveSchemaInFlight) return leaveSchemaInFlight;

  leaveSchemaInFlight = (async () => {
    try {
      const baseReady = await ensureGuestDatabaseReady();
      if (!baseReady) return false;

      await sql`
        ALTER TABLE guest_players
        ADD COLUMN IF NOT EXISTS leave_count INT NOT NULL DEFAULT 0
      `;
      await sql`
        ALTER TABLE guest_players
        ADD COLUMN IF NOT EXISTS freeze_strikes INT NOT NULL DEFAULT 0
      `;
      await sql`
        ALTER TABLE guest_players
        ADD COLUMN IF NOT EXISTS forfeits_total INT NOT NULL DEFAULT 0
      `;
      await sql`
        ALTER TABLE guest_players
        ADD COLUMN IF NOT EXISTS frozen_until TIMESTAMPTZ
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS arena_leave_requests (
          id UUID PRIMARY KEY,
          player_id TEXT NOT NULL,
          player_name TEXT NOT NULL DEFAULT '',
          game_id TEXT NOT NULL,
          room_code TEXT,
          kind TEXT NOT NULL,
          reason TEXT,
          status TEXT NOT NULL,
          penalty_coins INT NOT NULL DEFAULT 0,
          admin_note TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          resolved_at TIMESTAMPTZ
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_arena_leave_requests_status_created
        ON arena_leave_requests (status, created_at DESC)
      `;
      leaveSchemaReadyUrl = url;
      return true;
    } catch (err) {
      console.error("[arena-leave-policy] ensureLeaveSchema failed:", err);
      return false;
    } finally {
      leaveSchemaInFlight = null;
    }
  })();

  return leaveSchemaInFlight;
}

export async function getLeaveStatus(playerId: string | null | undefined): Promise<{
  enforced: boolean;
  leaveCount: number;
  limit: number;
  remaining: number;
  freezeStrikes: number;
  forfeitsTotal: number;
  frozenUntil: string | null;
  frozen: boolean;
  permanent: boolean;
  pendingCount: number;
}> {
  const fallback = {
    enforced: false,
    leaveCount: 0,
    limit: MAX_FORFEITS_BEFORE_FREEZE,
    remaining: MAX_FORFEITS_BEFORE_FREEZE,
    freezeStrikes: 0,
    forfeitsTotal: 0,
    frozenUntil: null,
    frozen: false,
    permanent: false,
    pendingCount: 0,
  };

  if (!playerId) return fallback;
  const sql = getDbClient();
  if (!sql || !(await ensureLeaveSchema())) return fallback;

  try {
    const [playerRows, pendingRows] = await Promise.all([
      sql`
        SELECT leave_count, freeze_strikes, forfeits_total, frozen_until
        FROM guest_players
        WHERE id = ${playerId}
        LIMIT 1
      `,
      sql`
        SELECT COUNT(*)::int AS total
        FROM arena_leave_requests
        WHERE player_id = ${playerId}
          AND status = 'pending'
      `,
    ]);

    if (playerRows.length === 0) return fallback;
    const row = playerRows[0];
    const leaveCount = Number(row.leave_count) || 0;
    const freezeStrikes = Number(row.freeze_strikes) || 0;
    const forfeitsTotal = Number(row.forfeits_total) || 0;
    const rem = forfeitsRemaining({ leaveCount, freezeStrikes });
    const frozenState = isFrozen(
      row.frozen_until instanceof Date || typeof row.frozen_until === "string"
        ? row.frozen_until
        : null
    );

    return {
      enforced: true,
      leaveCount,
      limit: rem.limit,
      remaining: rem.remaining,
      freezeStrikes,
      forfeitsTotal,
      frozenUntil: frozenState.frozenUntilIso,
      frozen: frozenState.frozen,
      permanent: frozenState.permanent,
      pendingCount: Number(pendingRows[0]?.total) || 0,
    };
  } catch {
    return fallback;
  }
}

export async function assertArenaAccess(
  playerId: string | null | undefined
): Promise<{
  allowed: boolean;
  frozenUntil: string | null;
  permanent: boolean;
  message?: string;
}> {
  if (!playerId) {
    return { allowed: true, frozenUntil: null, permanent: false };
  }
  const sql = getDbClient();
  if (!sql || !(await ensureLeaveSchema())) {
    return { allowed: true, frozenUntil: null, permanent: false };
  }

  try {
    const rows = await sql`
      SELECT frozen_until, freeze_strikes
      FROM guest_players
      WHERE id = ${playerId}
      LIMIT 1
    `;
    if (rows.length === 0) {
      return { allowed: true, frozenUntil: null, permanent: false };
    }
    const frozenState = isFrozen(
      rows[0].frozen_until instanceof Date || typeof rows[0].frozen_until === "string"
        ? rows[0].frozen_until
        : null
    );
    if (!frozenState.frozen) {
      return { allowed: true, frozenUntil: null, permanent: false };
    }

    const message = frozenState.permanent
      ? "Tài khoản của bạn đang bị khóa vào Arena do thoát ngang quá nhiều lần. Vui lòng liên hệ Admin để được mở khóa."
      : `Tài khoản của bạn đang bị tạm khóa vào Arena thêm ${formatFreezeDurationVI(
          frozenState.remainingMinutes,
          false
        )} (đến ${new Date(frozenState.frozenUntilIso!).toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        })}) do thoát giữa chừng nhiều lần.`;

    return {
      allowed: false,
      frozenUntil: frozenState.frozenUntilIso,
      permanent: frozenState.permanent,
      message,
    };
  } catch {
    return { allowed: true, frozenUntil: null, permanent: false };
  }
}

export async function recordForfeit(
  player: { id: string; displayName: string } | null | undefined,
  gameId: ArenaLeaveGameId,
  roomCode?: string | null
): Promise<{
  enforced: boolean;
  penaltyCoins: number;
  leaveCount: number;
  limit: number;
  remaining: number;
  freezeStrikes: number;
  frozenUntil: string | null;
  permanent: boolean;
  freezeMinutes: number;
  requestId: string | null;
}> {
  const noDb = {
    enforced: false,
    penaltyCoins: 0,
    leaveCount: 0,
    limit: MAX_FORFEITS_BEFORE_FREEZE,
    remaining: MAX_FORFEITS_BEFORE_FREEZE,
    freezeStrikes: 0,
    frozenUntil: null,
    permanent: false,
    freezeMinutes: 0,
    requestId: null,
  };
  if (!player?.id) return noDb;
  const sql = getDbClient();
  if (!sql || !(await ensureLeaveSchema())) return noDb;

  const rows = await sql`
    SELECT leave_count, freeze_strikes
    FROM guest_players
    WHERE id = ${player.id}
    LIMIT 1
  `;
  if (rows.length === 0) return noDb;

  const evalOut = evaluateForfeit({
    leaveCount: Number(rows[0].leave_count) || 0,
    freezeStrikes: Number(rows[0].freeze_strikes) || 0,
  });
  const rem = forfeitsRemaining({
    leaveCount: evalOut.leaveCount,
    freezeStrikes: evalOut.freezeStrikes,
  });
  const penaltyCoins = FORFEIT_PENALTY_COINS;
  const pointPenalty = penaltyCoins * 1000;
  const requestId = randomUUID();

  await sql`
    UPDATE guest_players
    SET
      it_coins = GREATEST(0, it_coins - ${penaltyCoins}),
      penalty_coins = COALESCE(penalty_coins, 0) + ${penaltyCoins},
      total_points = GREATEST(0, total_points - ${pointPenalty}),
      leave_count = ${evalOut.leaveCount},
      freeze_strikes = ${evalOut.freezeStrikes},
      forfeits_total = forfeits_total + 1,
      frozen_until = CASE
        WHEN ${evalOut.frozenUntilIso}::text IS NOT NULL
        THEN GREATEST(COALESCE(frozen_until, NOW()), ${evalOut.frozenUntilIso}::timestamptz)
        ELSE frozen_until
      END,
      updated_at = NOW()
    WHERE id = ${player.id}
  `;

  await sql`
    INSERT INTO arena_leave_requests (
      id, player_id, player_name, game_id, room_code, kind, reason, status, penalty_coins, resolved_at
    )
    VALUES (
      ${requestId}::uuid,
      ${player.id},
      ${player.displayName},
      ${gameId},
      ${roomCode?.trim().toUpperCase() || null},
      'forfeit',
      NULL,
      'penalized',
      ${penaltyCoins},
      NOW()
    )
  `;

  return {
    enforced: true,
    penaltyCoins,
    leaveCount: evalOut.leaveCount,
    limit: rem.limit,
    remaining: rem.remaining,
    freezeStrikes: evalOut.freezeStrikes,
    frozenUntil: evalOut.frozenUntilIso,
    permanent: evalOut.permanent,
    freezeMinutes: evalOut.freezeMinutes,
    requestId,
  };
}

export async function submitReasonRequest(
  player: { id: string; displayName: string } | null | undefined,
  gameId: ArenaLeaveGameId,
  roomCode: string | null | undefined,
  rawReason: unknown
): Promise<
  | { ok: false; status: number; error: string }
  | {
      ok: true;
      enforced: boolean;
      requestId: string | null;
      statusInfo: Awaited<ReturnType<typeof getLeaveStatus>>;
    }
> {
  const checked = validateReason(rawReason);
  if (!checked.valid) {
    return {
      ok: false,
      status: 400,
      error: checked.error || "Lý do không hợp lệ.",
    };
  }

  if (!player?.id) {
    return {
      ok: true,
      enforced: false,
      requestId: null,
      statusInfo: await getLeaveStatus(null),
    };
  }

  const sql = getDbClient();
  if (!sql || !(await ensureLeaveSchema())) {
    return {
      ok: true,
      enforced: false,
      requestId: null,
      statusInfo: await getLeaveStatus(null),
    };
  }

  const pendingRows = await sql`
    SELECT COUNT(*)::int AS total
    FROM arena_leave_requests
    WHERE player_id = ${player.id}
      AND status = 'pending'
  `;
  const pendingCount = Number(pendingRows[0]?.total) || 0;
  if (pendingCount >= MAX_PENDING_REASON_REQUESTS) {
    return {
      ok: false,
      status: 429,
      error: `Bạn đang có ${pendingCount} đơn xin thoát chờ Admin duyệt. Vui lòng đợi Admin xử lý trước khi gửi thêm.`,
    };
  }

  const requestId = randomUUID();
  await sql`
    INSERT INTO arena_leave_requests (
      id, player_id, player_name, game_id, room_code, kind, reason, status, penalty_coins
    )
    VALUES (
      ${requestId}::uuid,
      ${player.id},
      ${player.displayName},
      ${gameId},
      ${roomCode?.trim().toUpperCase() || null},
      'reason',
      ${checked.cleaned},
      'pending',
      0
    )
  `;

  return {
    ok: true,
    enforced: true,
    requestId,
    statusInfo: await getLeaveStatus(player.id),
  };
}

export async function resolveLeaveRequest(input: {
  id: string;
  decision: "approve" | "reject";
  penaltyCoins?: number;
  note?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const sql = getDbClient();
  if (!sql || !(await ensureLeaveSchema())) {
    return { ok: false, error: "Chưa kết nối Neon Postgres." };
  }

  const reqRows = await sql`
    SELECT id, player_id, status
    FROM arena_leave_requests
    WHERE id::text = ${input.id.trim()}
    LIMIT 1
  `;
  if (reqRows.length === 0) {
    return { ok: false, error: "Không tìm thấy yêu cầu xin thoát." };
  }
  if (reqRows[0].status !== "pending") {
    return { ok: false, error: "Yêu cầu này đã được xử lý trước đó." };
  }

  const playerId = String(reqRows[0].player_id);
  const adminNote = typeof input.note === "string" ? input.note.trim().slice(0, 240) : null;

  if (input.decision === "approve") {
    await sql`
      UPDATE arena_leave_requests
      SET
        status = 'approved',
        penalty_coins = 0,
        admin_note = ${adminNote},
        resolved_at = NOW()
      WHERE id::text = ${input.id.trim()}
        AND status = 'pending'
    `;
    return { ok: true };
  }

  const penalty = clampPenalty(input.penaltyCoins, FORFEIT_PENALTY_COINS);
  const pointPenalty = penalty * 1000;
  const playerRows = await sql`
    SELECT leave_count, freeze_strikes
    FROM guest_players
    WHERE id = ${playerId}
    LIMIT 1
  `;

  if (playerRows.length > 0) {
    const evalOut = evaluateForfeit({
      leaveCount: Number(playerRows[0].leave_count) || 0,
      freezeStrikes: Number(playerRows[0].freeze_strikes) || 0,
    });
    await sql`
      UPDATE guest_players
      SET
        it_coins = GREATEST(0, it_coins - ${penalty}),
        penalty_coins = COALESCE(penalty_coins, 0) + ${penalty},
        total_points = GREATEST(0, total_points - ${pointPenalty}),
        leave_count = ${evalOut.leaveCount},
        freeze_strikes = ${evalOut.freezeStrikes},
        forfeits_total = forfeits_total + 1,
        frozen_until = CASE
          WHEN ${evalOut.frozenUntilIso}::text IS NOT NULL
          THEN GREATEST(COALESCE(frozen_until, NOW()), ${evalOut.frozenUntilIso}::timestamptz)
          ELSE frozen_until
        END,
        updated_at = NOW()
      WHERE id = ${playerId}
    `;
  }

  await sql`
    UPDATE arena_leave_requests
    SET
      status = 'rejected',
      penalty_coins = ${penalty},
      admin_note = ${adminNote},
      resolved_at = NOW()
    WHERE id::text = ${input.id.trim()}
      AND status = 'pending'
  `;

  return { ok: true };
}

export async function adminFreezePlayer(
  playerId: string,
  minutes: number,
  permanent = false
): Promise<boolean> {
  const sql = getDbClient();
  if (!sql || !(await ensureLeaveSchema()) || !playerId.trim()) return false;

  const targetIso = permanent
    ? PERMANENT_FREEZE_ISO
    : new Date(
        Date.now() + Math.max(5, Math.min(43200, Math.round(minutes || 30))) * 60000
      ).toISOString();

  const rows = await sql`
    UPDATE guest_players
    SET
      frozen_until = ${targetIso}::timestamptz,
      freeze_strikes = GREATEST(freeze_strikes, 1),
      updated_at = NOW()
    WHERE id = ${playerId.trim()}
    RETURNING id
  `;
  return rows.length > 0;
}

export async function adminUnfreezePlayer(
  playerId: string,
  resetStrikes = false
): Promise<boolean> {
  const sql = getDbClient();
  if (!sql || !(await ensureLeaveSchema()) || !playerId.trim()) return false;

  const rows = await sql`
    UPDATE guest_players
    SET
      frozen_until = NULL,
      leave_count = 0,
      freeze_strikes = CASE WHEN ${resetStrikes} THEN 0 ELSE freeze_strikes END,
      updated_at = NOW()
    WHERE id = ${playerId.trim()}
    RETURNING id
  `;
  return rows.length > 0;
}

export async function listAdminLeaves(): Promise<{
  requests: LeaveRequestItem[];
  flaggedPlayers: FlaggedPlayerItem[];
}> {
  const sql = getDbClient();
  if (!sql || !(await ensureLeaveSchema())) {
    return { requests: [], flaggedPlayers: [] };
  }

  try {
    const [requestRows, playerRows] = await Promise.all([
      sql`
        SELECT
          id::text AS id,
          player_id,
          player_name,
          game_id,
          room_code,
          kind,
          reason,
          status,
          penalty_coins,
          admin_note,
          created_at,
          resolved_at
        FROM arena_leave_requests
        ORDER BY
          CASE WHEN status = 'pending' THEN 0 ELSE 1 END,
          created_at DESC
        LIMIT 120
      `,
      sql`
        SELECT
          id,
          display_name,
          transfer_code,
          it_coins,
          total_points,
          leave_count,
          freeze_strikes,
          forfeits_total,
          frozen_until
        FROM guest_players
        WHERE frozen_until > NOW()
           OR leave_count > 0
           OR forfeits_total > 0
           OR freeze_strikes > 0
        ORDER BY
          CASE WHEN frozen_until > NOW() THEN 0 ELSE 1 END,
          forfeits_total DESC,
          leave_count DESC
        LIMIT 80
      `,
    ]);

    const requests: LeaveRequestItem[] = requestRows.map((row) => ({
      id: String(row.id),
      playerId: String(row.player_id),
      playerName: String(row.player_name || "Người chơi"),
      gameId: String(row.game_id),
      roomCode: typeof row.room_code === "string" ? row.room_code : null,
      kind: row.kind === "reason" ? "reason" : "forfeit",
      reason: typeof row.reason === "string" ? row.reason : null,
      status:
        row.status === "pending" ||
        row.status === "approved" ||
        row.status === "rejected"
          ? row.status
          : "penalized",
      penaltyCoins: Number(row.penalty_coins) || 0,
      adminNote: typeof row.admin_note === "string" ? row.admin_note : null,
      createdAt: toIsoString(row.created_at),
      resolvedAt: row.resolved_at ? toIsoString(row.resolved_at) : null,
    }));

    const flaggedPlayers: FlaggedPlayerItem[] = playerRows.map((row) => {
      const frozen = isFrozen(
        row.frozen_until instanceof Date || typeof row.frozen_until === "string"
          ? row.frozen_until
          : null
      );
      return {
        id: String(row.id),
        displayName: String(row.display_name || "Guest"),
        transferCode: String(row.transfer_code || ""),
        itCoins: Number(row.it_coins) || 0,
        totalPoints: Number(row.total_points) || 0,
        leaveCount: Number(row.leave_count) || 0,
        freezeStrikes: Number(row.freeze_strikes) || 0,
        forfeitsTotal: Number(row.forfeits_total) || 0,
        frozenUntil: frozen.frozenUntilIso,
        permanent: frozen.permanent,
        frozenNow: frozen.frozen,
      };
    });

    return { requests, flaggedPlayers };
  } catch (err) {
    console.error("[arena-leave-policy] listAdminLeaves failed:", err);
    return { requests: [], flaggedPlayers: [] };
  }
}

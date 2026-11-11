import { createHash, randomBytes, randomUUID } from "crypto";
import { cookies } from "next/headers";
import {
  ensureGuestDatabaseReady,
  getDbClient,
  GuestPlayerRow,
  PublicGuestPlayer,
} from "./db";

export const GUEST_SESSION_COOKIE_NAME = "speakit_session_token";
export const GUEST_TRANSFER_STORAGE_KEY = "speakit_transfer_code_v1";
export const GUEST_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

const TRANSFER_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function hashDeviceToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function generateTransferCode(): string {
  const bytes = randomBytes(6);
  let suffix = "";
  for (let i = 0; i < 6; i += 1) {
    suffix += TRANSFER_ALPHABET[bytes[i] % TRANSFER_ALPHABET.length];
  }
  return `DEV-${suffix}`;
}

export function normalizeTransferCode(code: string): string | null {
  if (typeof code !== "string") return null;
  const cleaned = code.trim().toUpperCase();
  if (!/^DEV-[A-Z0-9]{6}$/.test(cleaned)) {
    return null;
  }
  return cleaned;
}

export function parseOwnedItems(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === "string");
  }
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string");
      }
    } catch {
      return [];
    }
  }
  return [];
}

export function serializePublicGuestPlayer(
  row: GuestPlayerRow
): PublicGuestPlayer {
  return {
    id: row.id,
    transferCode: row.transfer_code,
    displayName: row.display_name,
    itCoins: Number(row.it_coins) || 0,
    totalPoints: Number(row.total_points) || 0,
    streakDays: Number(row.streak_days) || 0,
    lastPracticeDate: row.last_practice_date ?? null,
    equippedTitle: row.equipped_title || "Junior Speaker",
    equippedRing: row.equipped_ring || "default",
    ownedItems: parseOwnedItems(row.owned_items),
  };
}

function setGuestSessionCookie(rawToken: string): void {
  cookies().set(GUEST_SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: GUEST_COOKIE_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function readExistingGuestPlayer(): Promise<PublicGuestPlayer | null> {
  const sql = getDbClient();
  if (!sql) return null;

  const ready = await ensureGuestDatabaseReady();
  if (!ready) return null;

  const rawToken = cookies().get(GUEST_SESSION_COOKIE_NAME)?.value;
  if (!rawToken) return null;

  try {
    const tokenHash = hashDeviceToken(rawToken);
    const rows = (await sql`
      SELECT
        id,
        device_token_hash,
        transfer_code,
        display_name,
        it_coins,
        total_points,
        streak_days,
        last_practice_date,
        equipped_title,
        equipped_ring,
        owned_items,
        created_at,
        updated_at
      FROM guest_players
      WHERE device_token_hash = ${tokenHash}
      LIMIT 1
    `) as GuestPlayerRow[];

    if (rows.length === 0) return null;
    return serializePublicGuestPlayer(rows[0]);
  } catch {
    return null;
  }
}

export async function resolveOrCreateGuestSession(
  backupTransferCode?: string
): Promise<PublicGuestPlayer | null> {
  const sql = getDbClient();
  if (!sql) return null;

  const ready = await ensureGuestDatabaseReady();
  if (!ready) return null;

  const existing = await readExistingGuestPlayer();
  if (existing) {
    return existing;
  }

  const normalizedBackup = backupTransferCode
    ? normalizeTransferCode(backupTransferCode)
    : null;

  if (normalizedBackup) {
    const restored = await restoreByTransferCode(normalizedBackup);
    if (restored.ok && restored.player) {
      return restored.player;
    }
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const id = randomUUID();
    const rawToken = generateSessionToken();
    const tokenHash = hashDeviceToken(rawToken);
    const transferCode = generateTransferCode();
    const displayName = `Dev-${transferCode.slice(-4)}`;

    try {
      const inserted = (await sql`
        INSERT INTO guest_players (
          id,
          device_token_hash,
          transfer_code,
          display_name
        )
        VALUES (
          ${id},
          ${tokenHash},
          ${transferCode},
          ${displayName}
        )
        RETURNING
          id,
          device_token_hash,
          transfer_code,
          display_name,
          it_coins,
          total_points,
          streak_days,
          last_practice_date,
          equipped_title,
          equipped_ring,
          owned_items,
          created_at,
          updated_at
      `) as GuestPlayerRow[];

      if (inserted.length > 0) {
        setGuestSessionCookie(rawToken);
        return serializePublicGuestPlayer(inserted[0]);
      }
    } catch {
      continue;
    }
  }

  return null;
}

export async function restoreByTransferCode(code: string): Promise<{
  ok: boolean;
  mode: "online" | "offline";
  player: PublicGuestPlayer | null;
  error?: string;
}> {
  const normalized = normalizeTransferCode(code);
  if (!normalized) {
    return {
      ok: false,
      mode: "online",
      player: null,
      error: "Invalid transfer code format (expected DEV-XXXXXX).",
    };
  }

  const sql = getDbClient();
  if (!sql) {
    return {
      ok: false,
      mode: "offline",
      player: null,
      error: "Database is unavailable in offline mode.",
    };
  }

  const ready = await ensureGuestDatabaseReady();
  if (!ready) {
    return {
      ok: false,
      mode: "offline",
      player: null,
      error: "Database is unavailable in offline mode.",
    };
  }

  try {
    const rawToken = generateSessionToken();
    const tokenHash = hashDeviceToken(rawToken);

    const updated = (await sql`
      UPDATE guest_players
      SET
        device_token_hash = ${tokenHash},
        updated_at = NOW()
      WHERE transfer_code = ${normalized}
      RETURNING
        id,
        device_token_hash,
        transfer_code,
        display_name,
        it_coins,
        total_points,
        streak_days,
        last_practice_date,
        equipped_title,
        equipped_ring,
        owned_items,
        created_at,
        updated_at
    `) as GuestPlayerRow[];

    if (updated.length === 0) {
      return {
        ok: false,
        mode: "online",
        player: null,
        error: "Transfer code not found.",
      };
    }

    setGuestSessionCookie(rawToken);
    return {
      ok: true,
      mode: "online",
      player: serializePublicGuestPlayer(updated[0]),
    };
  } catch {
    return {
      ok: false,
      mode: "offline",
      player: null,
      error: "Unable to restore guest session from Neon DB.",
    };
  }
}


import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { normalizeEquippedCosmetics } from "./cosmetics";
import {
  ensureGuestDatabaseReady,
  getDbClient,
  GuestPlayerRow,
  PublicGuestPlayer,
} from "./db";
import {
  calculateSpentCosmeticCoins,
  resolveConsistentItCoins,
} from "./profileStats";

export const GUEST_SESSION_COOKIE_NAME = "speakit_session_token";
export const GUEST_TRANSFER_STORAGE_KEY = "speakit_transfer_code_v1";
export const GUEST_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;
export const MAX_GUEST_ACCOUNTS_PER_IP_24H = 3;
export const ZERO_COIN_RETENTION_DAYS = 7;

const CLEANUP_COOLDOWN_MS = 15 * 60 * 1000;
let LAST_CLEANUP_AT_MS = 0;

const TRANSFER_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function isExpiredZeroCoinGuest(
  row: Pick<GuestPlayerRow, "it_coins" | "updated_at">,
  now: Date | number = Date.now()
): boolean {
  if (Number(row.it_coins) > 0) return false;
  const nowMs = now instanceof Date ? now.getTime() : now;
  const updatedMs = new Date(row.updated_at).getTime();
  if (!Number.isFinite(nowMs) || !Number.isFinite(updatedMs)) return false;
  const retentionMs = ZERO_COIN_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return updatedMs < nowMs - retentionMs;
}

export async function cleanupExpiredZeroCoinGuests(options?: {
  force?: boolean;
}): Promise<number> {
  const force = options?.force === true;
  const nowMs = Date.now();
  if (!force && nowMs - LAST_CLEANUP_AT_MS < CLEANUP_COOLDOWN_MS) {
    return 0;
  }

  const sql = getDbClient();
  if (!sql) return 0;

  try {
    const ready = await ensureGuestDatabaseReady();
    if (!ready) return 0;

    LAST_CLEANUP_AT_MS = nowMs;
    const deleted = (await sql`
      DELETE FROM guest_players
      WHERE it_coins <= 0
        AND email IS NULL
        AND updated_at < NOW() - INTERVAL '7 days'
      RETURNING id
    `) as Array<{ id: string }>;
    return deleted.length;
  } catch {
    return 0;
  }
}

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().toLowerCase();
  if (cleaned.length < 3 || cleaned.length > 120) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) return null;
  return cleaned;
}

export function validatePassword(raw: unknown): { valid: boolean; error?: string } {
  if (typeof raw !== "string") {
    return { valid: false, error: "Vui lòng nhập mật khẩu." };
  }
  if (raw.length < 6) {
    return { valid: false, error: "Mật khẩu cần tối thiểu 6 ký tự." };
  }
  if (raw.length > 128) {
    return { valid: false, error: "Mật khẩu tối đa 128 ký tự." };
  }
  return { valid: true };
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(
  password: string,
  storedHash: string | null | undefined
): boolean {
  if (typeof password !== "string" || !password || typeof storedHash !== "string") {
    return false;
  }
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }
  const [, salt, hexHash] = parts;
  if (!salt || !/^[a-f0-9]{128}$/i.test(hexHash)) {
    return false;
  }
  try {
    const derived = scryptSync(password, salt, 64);
    const expected = Buffer.from(hexHash, "hex");
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function hashDeviceToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function extractClientIpFromHeaders(
  headersList: { get(name: string): string | null | undefined } | null | undefined
): string | null {
  if (!headersList) return null;
  const forwarded = headersList.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0]?.trim();
    if (firstIp && firstIp.toLowerCase() !== "unknown") {
      return firstIp;
    }
  }
  const candidates = [
    headersList.get("x-real-ip"),
    headersList.get("cf-connecting-ip"),
    headersList.get("x-vercel-forwarded-for"),
  ];
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed && trimmed.toLowerCase() !== "unknown") {
      return trimmed;
    }
  }
  return null;
}

export function hashIpAddress(ip: string): string;
export function hashIpAddress(ip: string | null | undefined): string | null;
export function hashIpAddress(ip: string | null | undefined): string | null {
  const trimmed = typeof ip === "string" ? ip.trim() : "";
  if (!trimmed) return null;
  return createHash("sha256").update(trimmed).digest("hex");
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

export { calculateSpentCosmeticCoins, resolveConsistentItCoins };

export function serializePublicGuestPlayer(
  row: GuestPlayerRow
): PublicGuestPlayer {
  const ownedItems = parseOwnedItems(row.owned_items);
  const totalPoints = Number(row.total_points) || 0;
  const email =
    typeof row.email === "string" && row.email.trim()
      ? row.email.trim().toLowerCase()
      : null;
  return {
    id: row.id,
    transferCode: row.transfer_code,
    displayName: row.display_name,
    avatarUrl: typeof row.avatar_url === "string" && row.avatar_url.length > 0 ? row.avatar_url : null,
    email,
    itCoins: resolveConsistentItCoins(Number(row.it_coins) || 0, totalPoints, ownedItems),
    totalPoints,
    streakDays: Number(row.streak_days) || 0,
    lastPracticeDate: row.last_practice_date ?? null,
    equippedTitle: row.equipped_title || "Junior Speaker",
    equippedRing: row.equipped_ring || "default",
    equippedCosmetics: normalizeEquippedCosmetics(row.equipped_cosmetics),
    ownedItems,
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

  void cleanupExpiredZeroCoinGuests();

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
        avatar_url,
        email,
        it_coins,
        total_points,
        streak_days,
        last_practice_date,
        equipped_title,
        equipped_ring,
        equipped_cosmetics,
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
  _backupTransferCode?: string
): Promise<PublicGuestPlayer | null> {
  return readExistingGuestPlayer();
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
    const existingRows = (await sql`
      SELECT id, email, password_hash
      FROM guest_players
      WHERE transfer_code = ${normalized}
      LIMIT 1
    `) as Array<{ id: string; email?: string | null; password_hash?: string | null }>;

    if (existingRows.length === 0) {
      return {
        ok: false,
        mode: "online",
        player: null,
        error: "Transfer code not found.",
      };
    }

    if (existingRows[0].email || existingRows[0].password_hash) {
      return {
        ok: false,
        mode: "online",
        player: null,
        error:
          "Tài khoản này đã được bảo vệ bằng Email & Mật khẩu. Vui lòng đăng nhập bằng Email.",
      };
    }

    const rawToken = generateSessionToken();
    const tokenHash = hashDeviceToken(rawToken);

    const updated = (await sql`
      UPDATE guest_players
      SET
        device_token_hash = ${tokenHash},
        updated_at = NOW()
      WHERE transfer_code = ${normalized}
        AND email IS NULL
      RETURNING
        id,
        device_token_hash,
        transfer_code,
        display_name,
        avatar_url,
        email,
        it_coins,
        total_points,
        streak_days,
        last_practice_date,
        equipped_title,
        equipped_ring,
        equipped_cosmetics,
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

export async function registerWithEmailPassword(input: {
  email: string;
  password: string;
  displayName: string;
  transferCode?: string;
}): Promise<{
  ok: boolean;
  mode: "online" | "offline";
  player: PublicGuestPlayer | null;
  error?: string;
}> {
  const email = normalizeEmail(input.email);
  if (!email) {
    return {
      ok: false,
      mode: "online",
      player: null,
      error: "Email không hợp lệ. Vui lòng kiểm tra lại.",
    };
  }

  const pw = validatePassword(input.password);
  if (!pw.valid) {
    return {
      ok: false,
      mode: "online",
      player: null,
      error: pw.error,
    };
  }

  const cleanedName =
    typeof input.displayName === "string"
      ? input.displayName.trim().replace(/\s+/g, " ")
      : "";
  if (cleanedName.length < 2 || cleanedName.length > 24) {
    return {
      ok: false,
      mode: "online",
      player: null,
      error: "Tên hiển thị cần từ 2 đến 24 ký tự.",
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
    const emailTaken = (await sql`
      SELECT id
      FROM guest_players
      WHERE LOWER(email) = ${email}
      LIMIT 1
    `) as Array<{ id: string }>;

    if (emailTaken.length > 0) {
      return {
        ok: false,
        mode: "online",
        player: null,
        error: "Email này đã được đăng ký. Vui lòng chuyển sang Đăng nhập.",
      };
    }

    const passwordHash = hashPassword(input.password);
    const rawToken = generateSessionToken();
    const tokenHash = hashDeviceToken(rawToken);

    let linkRowId: string | null = null;
    const rawCode = typeof input.transferCode === "string" ? input.transferCode.trim() : "";

    if (rawCode) {
      const normalizedCode = normalizeTransferCode(rawCode);
      if (!normalizedCode) {
        return {
          ok: false,
          mode: "online",
          player: null,
          error: "Mã hồ sơ cũ phải đúng định dạng DEV-XXXXXX.",
        };
      }
      const codeRows = (await sql`
        SELECT id, email, password_hash
        FROM guest_players
        WHERE transfer_code = ${normalizedCode}
        LIMIT 1
      `) as Array<{ id: string; email?: string | null; password_hash?: string | null }>;

      if (codeRows.length === 0 || codeRows[0].email || codeRows[0].password_hash) {
        return {
          ok: false,
          mode: "online",
          player: null,
          error:
            "Mã DEV-XXXXXX không tồn tại hoặc đã được liên kết với email khác.",
        };
      }
      linkRowId = codeRows[0].id;
    } else {
      const existing = await readExistingGuestPlayer();
      if (existing && !existing.email) {
        linkRowId = existing.id;
      }
    }

    if (linkRowId) {
      const updated = (await sql`
        UPDATE guest_players
        SET
          email = ${email},
          password_hash = ${passwordHash},
          display_name = ${cleanedName},
          device_token_hash = ${tokenHash},
          updated_at = NOW()
        WHERE id = ${linkRowId}
          AND email IS NULL
        RETURNING
          id,
          device_token_hash,
          transfer_code,
          display_name,
          avatar_url,
          email,
          it_coins,
          total_points,
          streak_days,
          last_practice_date,
          equipped_title,
          equipped_ring,
          equipped_cosmetics,
          owned_items,
          created_at,
          updated_at
      `) as GuestPlayerRow[];

      if (updated.length > 0) {
        setGuestSessionCookie(rawToken);
        return {
          ok: true,
          mode: "online",
          player: serializePublicGuestPlayer(updated[0]),
        };
      }

      if (rawCode) {
        return {
          ok: false,
          mode: "online",
          player: null,
          error:
            "Mã DEV-XXXXXX không tồn tại hoặc đã được liên kết với email khác.",
        };
      }
    }

    let ipHash: string | null = null;
    try {
      const clientIp = extractClientIpFromHeaders(headers());
      if (clientIp) {
        ipHash = hashIpAddress(clientIp);
      }
    } catch {
      ipHash = null;
    }

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const id = randomUUID();
      const transferCode = generateTransferCode();

      try {
        const inserted = (await sql`
          INSERT INTO guest_players (
            id,
            device_token_hash,
            transfer_code,
            display_name,
            email,
            password_hash,
            ip_hash
          )
          VALUES (
            ${id},
            ${tokenHash},
            ${transferCode},
            ${cleanedName},
            ${email},
            ${passwordHash},
            ${ipHash}
          )
          RETURNING
            id,
            device_token_hash,
            transfer_code,
            display_name,
            avatar_url,
            email,
            it_coins,
            total_points,
            streak_days,
            last_practice_date,
            equipped_title,
            equipped_ring,
            equipped_cosmetics,
            owned_items,
            created_at,
            updated_at
        `) as GuestPlayerRow[];

        if (inserted.length > 0) {
          setGuestSessionCookie(rawToken);
          return {
            ok: true,
            mode: "online",
            player: serializePublicGuestPlayer(inserted[0]),
          };
        }
      } catch {
        continue;
      }
    }

    return {
      ok: false,
      mode: "online",
      player: null,
      error: "Không thể tạo tài khoản lúc này. Vui lòng thử lại.",
    };
  } catch {
    return {
      ok: false,
      mode: "offline",
      player: null,
      error: "Không thể kết nối cơ sở dữ liệu khi đăng ký.",
    };
  }
}

export async function loginWithEmailPassword(input: {
  email: string;
  password: string;
}): Promise<{
  ok: boolean;
  mode: "online" | "offline";
  player: PublicGuestPlayer | null;
  error?: string;
}> {
  const email = normalizeEmail(input.email);
  if (!email) {
    return {
      ok: false,
      mode: "online",
      player: null,
      error: "Email không hợp lệ.",
    };
  }

  if (typeof input.password !== "string" || input.password.length === 0) {
    return {
      ok: false,
      mode: "online",
      player: null,
      error: "Vui lòng nhập mật khẩu.",
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
    const rows = (await sql`
      SELECT
        id,
        password_hash
      FROM guest_players
      WHERE LOWER(email) = ${email}
      LIMIT 1
    `) as Array<{ id: string; password_hash?: string | null }>;

    if (rows.length === 0 || !verifyPassword(input.password, rows[0].password_hash)) {
      return {
        ok: false,
        mode: "online",
        player: null,
        error: "Email hoặc mật khẩu không chính xác.",
      };
    }

    const rawToken = generateSessionToken();
    const tokenHash = hashDeviceToken(rawToken);
    const updated = (await sql`
      UPDATE guest_players
      SET
        device_token_hash = ${tokenHash},
        updated_at = NOW()
      WHERE id = ${rows[0].id}
      RETURNING
        id,
        device_token_hash,
        transfer_code,
        display_name,
        avatar_url,
        email,
        it_coins,
        total_points,
        streak_days,
        last_practice_date,
        equipped_title,
        equipped_ring,
        equipped_cosmetics,
        owned_items,
        created_at,
        updated_at
    `) as GuestPlayerRow[];

    if (updated.length === 0) {
      return {
        ok: false,
        mode: "online",
        player: null,
        error: "Email hoặc mật khẩu không chính xác.",
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
      error: "Không thể đăng nhập lúc này. Vui lòng thử lại.",
    };
  }
}

export async function logoutGuestSession(): Promise<{ ok: boolean }> {
  try {
    const rawToken = cookies().get(GUEST_SESSION_COOKIE_NAME)?.value;
    if (rawToken) {
      const sql = getDbClient();
      if (sql && (await ensureGuestDatabaseReady())) {
        const oldHash = hashDeviceToken(rawToken);
        const rotatedHash = hashDeviceToken(generateSessionToken());
        await sql`
          UPDATE guest_players
          SET device_token_hash = ${rotatedHash},
              updated_at = NOW()
          WHERE device_token_hash = ${oldHash}
        `;
      }
    }
  } catch {
  }

  try {
    cookies().delete(GUEST_SESSION_COOKIE_NAME);
  } catch {
  }
  return { ok: true };
}


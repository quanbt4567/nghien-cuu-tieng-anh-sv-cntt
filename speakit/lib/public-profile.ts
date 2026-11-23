import { NeonQueryFunction } from "@neondatabase/serverless";
import { EquippedCosmetics, normalizeEquippedCosmetics } from "./cosmetics";
import { ensureGuestDatabaseReady, getDbClient } from "./db";
import { ensureSchema } from "./db/neon";
import { getDevTitle } from "./gamification";
import { parseOwnedItems } from "./neon-auth";
import {
  normalizeBugBusterAccuracy,
  resolveConsistentItCoins,
} from "./profileStats";
import type { DevTitle } from "./types";

export interface PublicArenaRun {
  id: string;
  gameId: string;
  score: number;
  accuracyOrWords: number;
  durationSec: number;
  role: string | null;
  createdAt: string;
}

export interface PublicProfileData {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  itCoins: number;
  totalPoints: number;
  streakDays: number;
  devTitle: DevTitle;
  equippedTitle: string;
  equippedRing: string;
  equippedCosmetics: EquippedCosmetics;
  ownedCount: number;
  createdAt: string;
  recentArenaRuns: PublicArenaRun[];
}

export interface PublicGuestProfileRow {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  total_points: number | string;
  it_coins: number | string;
  streak_days: number | string;
  equipped_title?: string | null;
  equipped_ring?: string | null;
  equipped_cosmetics?: EquippedCosmetics | string | null;
  owned_items?: unknown;
  created_at: string | Date;
}

export interface PublicArenaRunRow {
  id: string;
  game_id: string;
  score: number | string;
  accuracy_or_words: number | string;
  duration_sec: number | string;
  role?: string | null;
  created_at: string | Date;
}

type SqlExecutor = NeonQueryFunction<false, false>;

const PLAYER_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

function normalizeNonNegativeInt(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.floor(num));
}

function normalizeIsoTimestamp(value: unknown): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  }
  if (typeof value === "string") {
    return value;
  }
  return "";
}

export function normalizePublicPlayerId(playerId: unknown): string | null {
  if (typeof playerId !== "string") return null;
  const trimmed = playerId.trim();
  if (!trimmed || !PLAYER_ID_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function sanitizePublicArenaRun(row: PublicArenaRunRow): PublicArenaRun {
  const score = normalizeNonNegativeInt(row.score);
  const rawMetric = normalizeNonNegativeInt(row.accuracy_or_words);
  const gameId = typeof row.game_id === "string" ? row.game_id : "bug-buster";
  const accuracyOrWords =
    gameId === "bug-buster"
      ? normalizeBugBusterAccuracy(score, rawMetric)
      : rawMetric;

  return {
    id: String(row.id),
    gameId,
    score,
    accuracyOrWords,
    durationSec: normalizeNonNegativeInt(row.duration_sec),
    role: typeof row.role === "string" && row.role.length > 0 ? row.role : null,
    createdAt: normalizeIsoTimestamp(row.created_at),
  };
}

export function sanitizePublicProfileData(
  row: PublicGuestProfileRow,
  arenaRows: readonly PublicArenaRunRow[] = []
): PublicProfileData {
  const ownedItems = parseOwnedItems(row.owned_items);
  const ownedCount = new Set(ownedItems).size;
  const totalPoints = normalizeNonNegativeInt(row.total_points);
  const rawCoins = normalizeNonNegativeInt(row.it_coins);
  const itCoins = resolveConsistentItCoins(rawCoins, totalPoints, ownedItems);
  const streakDays = normalizeNonNegativeInt(row.streak_days);
  const devTitle = getDevTitle(totalPoints).title;

  return {
    id: String(row.id),
    displayName:
      typeof row.display_name === "string" && row.display_name.trim().length > 0
        ? row.display_name
        : "Developer",
    avatarUrl:
      typeof row.avatar_url === "string" && row.avatar_url.length > 0
        ? row.avatar_url
        : null,
    itCoins,
    totalPoints,
    streakDays,
    devTitle,
    equippedTitle:
      typeof row.equipped_title === "string" && row.equipped_title.length > 0
        ? row.equipped_title
        : devTitle,
    equippedRing:
      typeof row.equipped_ring === "string" && row.equipped_ring.length > 0
        ? row.equipped_ring
        : "default",
    equippedCosmetics: normalizeEquippedCosmetics(row.equipped_cosmetics),
    ownedCount,
    createdAt: normalizeIsoTimestamp(row.created_at),
    recentArenaRuns: arenaRows.slice(0, 5).map(sanitizePublicArenaRun),
  };
}

export async function getPublicPlayerProfile(
  playerId: string,
  sqlClient?: SqlExecutor | null
): Promise<PublicProfileData | null> {
  const normalizedId = normalizePublicPlayerId(playerId);
  if (!normalizedId) return null;

  const sql = sqlClient !== undefined ? sqlClient : getDbClient();
  if (!sql) return null;

  if (sqlClient === undefined) {
    const ready = await ensureGuestDatabaseReady();
    if (!ready) return null;
    await ensureSchema();
  }

  try {
    const playerRows = (await sql`
      SELECT
        id,
        display_name,
        avatar_url,
        total_points,
        it_coins,
        streak_days,
        equipped_title,
        equipped_ring,
        equipped_cosmetics,
        owned_items,
        created_at
      FROM guest_players
      WHERE id = ${normalizedId}
      LIMIT 1
    `) as PublicGuestProfileRow[];

    if (!Array.isArray(playerRows) || playerRows.length === 0) {
      return null;
    }

    let arenaRows: PublicArenaRunRow[] = [];
    try {
      const fetchedRuns = (await sql`
        SELECT
          id,
          game_id,
          score,
          accuracy_or_words,
          duration_sec,
          role,
          created_at
        FROM speakit_arena_runs
        WHERE transfer_code = (
          SELECT transfer_code
          FROM guest_players
          WHERE id = ${normalizedId}
          LIMIT 1
        )
        ORDER BY created_at DESC
        LIMIT 5
      `) as PublicArenaRunRow[];
      if (Array.isArray(fetchedRuns)) {
        arenaRows = fetchedRuns;
      }
    } catch {
      arenaRows = [];
    }

    return sanitizePublicProfileData(playerRows[0], arenaRows);
  } catch {
    return null;
  }
}

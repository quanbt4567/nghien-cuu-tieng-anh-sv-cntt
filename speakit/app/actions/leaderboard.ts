"use server";

import { findCosmeticById } from "../../lib/cosmetics";
import {
  ensureGuestDatabaseReady,
  getDbClient,
  GuestPlayerRow,
  LeaderboardEntry,
  PublicGuestPlayer,
} from "../../lib/db";
import { computeNextStreak } from "../../lib/gamification";
import {
  readExistingGuestPlayer,
  resolveOrCreateGuestSession,
  restoreByTransferCode as restoreGuestByTransferCode,
  serializePublicGuestPlayer,
} from "../../lib/neon-auth";

function getUtcTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function initOrHydrateGuestSession(
  backupTransferCode?: string
): Promise<{
  mode: "online" | "offline";
  player: PublicGuestPlayer | null;
}> {
  const player = await resolveOrCreateGuestSession(backupTransferCode);
  if (!player) {
    return { mode: "offline", player: null };
  }
  return { mode: "online", player };
}

export async function restoreByTransferCode(code: string): Promise<{
  ok: boolean;
  mode: "online" | "offline";
  player: PublicGuestPlayer | null;
  error?: string;
}> {
  return restoreGuestByTransferCode(code);
}

export async function getTopPlayers(limit = 50): Promise<{
  mode: "online" | "offline";
  players: LeaderboardEntry[];
  currentPlayer: PublicGuestPlayer | null;
  currentUserRank: LeaderboardEntry | null;
}> {
  const sql = getDbClient();
  if (!sql) {
    return {
      mode: "offline",
      players: [],
      currentPlayer: null,
      currentUserRank: null,
    };
  }

  const ready = await ensureGuestDatabaseReady();
  if (!ready) {
    return {
      mode: "offline",
      players: [],
      currentPlayer: null,
      currentUserRank: null,
    };
  }

  const safeLimit =
    typeof limit === "number" && Number.isFinite(limit)
      ? Math.max(1, Math.min(50, Math.floor(limit)))
      : 50;

  try {
    const currentPlayer = await readExistingGuestPlayer();

    const rows = (await sql`
      SELECT
        id,
        display_name AS "displayName",
        it_coins AS "itCoins",
        total_points AS "totalPoints",
        streak_days AS "streakDays",
        equipped_title AS "equippedTitle",
        equipped_ring AS "equippedRing",
        DENSE_RANK() OVER (ORDER BY it_coins DESC, total_points DESC)::int AS rank
      FROM guest_players
      ORDER BY it_coins DESC, total_points DESC, created_at ASC
      LIMIT ${safeLimit}
    `) as Array<Omit<LeaderboardEntry, "isCurrentUser">>;

    const players: LeaderboardEntry[] = rows.map((row) => ({
      id: row.id,
      displayName: row.displayName,
      itCoins: Number(row.itCoins) || 0,
      totalPoints: Number(row.totalPoints) || 0,
      streakDays: Number(row.streakDays) || 0,
      equippedTitle: row.equippedTitle || "Junior Speaker",
      equippedRing: row.equippedRing || "default",
      rank: Number(row.rank) || 1,
      isCurrentUser: currentPlayer ? row.id === currentPlayer.id : false,
    }));

    let currentUserRank: LeaderboardEntry | null = null;
    if (currentPlayer) {
      const rankRows = (await sql`
        WITH ranked AS (
          SELECT
            id,
            display_name AS "displayName",
            it_coins AS "itCoins",
            total_points AS "totalPoints",
            streak_days AS "streakDays",
            equipped_title AS "equippedTitle",
            equipped_ring AS "equippedRing",
            DENSE_RANK() OVER (ORDER BY it_coins DESC, total_points DESC)::int AS rank
          FROM guest_players
        )
        SELECT *
        FROM ranked
        WHERE id = ${currentPlayer.id}
        LIMIT 1
      `) as Array<Omit<LeaderboardEntry, "isCurrentUser">>;

      if (rankRows.length > 0) {
        const selfRow = rankRows[0];
        currentUserRank = {
          id: selfRow.id,
          displayName: selfRow.displayName,
          itCoins: Number(selfRow.itCoins) || 0,
          totalPoints: Number(selfRow.totalPoints) || 0,
          streakDays: Number(selfRow.streakDays) || 0,
          equippedTitle: selfRow.equippedTitle || "Junior Speaker",
          equippedRing: selfRow.equippedRing || "default",
          rank: Number(selfRow.rank) || 1,
          isCurrentUser: true,
        };
      }
    }

    return {
      mode: "online",
      players,
      currentPlayer,
      currentUserRank,
    };
  } catch {
    return {
      mode: "offline",
      players: [],
      currentPlayer: null,
      currentUserRank: null,
    };
  }
}

export async function rewardPracticePoints(
  scenarioId: string,
  rawScore: number,
  backupTransferCode?: string
): Promise<{
  ok: boolean;
  mode: "online" | "offline";
  awardedPoints: number;
  player: PublicGuestPlayer | null;
}> {
  const safeScenario =
    typeof scenarioId === "string" && scenarioId.trim().length > 0
      ? scenarioId.trim().slice(0, 64)
      : "";
  const clampedPoints =
    typeof rawScore === "number" && Number.isFinite(rawScore)
      ? Math.max(0, Math.min(1000, Math.round(rawScore)))
      : 0;

  if (!safeScenario || clampedPoints <= 0) {
    return {
      ok: false,
      mode: "online",
      awardedPoints: 0,
      player: null,
    };
  }

  const sql = getDbClient();
  if (!sql) {
    return {
      ok: true,
      mode: "offline",
      awardedPoints: clampedPoints,
      player: null,
    };
  }

  const player = await resolveOrCreateGuestSession(backupTransferCode);
  if (!player) {
    return {
      ok: true,
      mode: "offline",
      awardedPoints: clampedPoints,
      player: null,
    };
  }

  const streak = computeNextStreak(
    player.streakDays,
    player.lastPracticeDate,
    getUtcTodayDate()
  );

  try {
    const updated = (await sql`
      UPDATE guest_players
      SET
        it_coins = it_coins + (
          FLOOR((total_points + ${clampedPoints})::numeric / 1000)::int -
          FLOOR(total_points::numeric / 1000)::int
        ),
        total_points = total_points + ${clampedPoints},
        streak_days = ${streak.streakDays},
        last_practice_date = ${streak.lastPracticeDate},
        equipped_title = CASE
          WHEN equipped_title IN ('Junior Speaker', 'Mid-level Communicator', 'Lead Tech Speaker')
          THEN CASE
            WHEN total_points + ${clampedPoints} >= 5000 THEN 'Lead Tech Speaker'
            WHEN total_points + ${clampedPoints} >= 2000 THEN 'Mid-level Communicator'
            ELSE 'Junior Speaker'
          END
          ELSE equipped_title
        END,
        updated_at = NOW()
      WHERE id = ${player.id}
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
        mode: "offline",
        awardedPoints: clampedPoints,
        player: null,
      };
    }

    return {
      ok: true,
      mode: "online",
      awardedPoints: clampedPoints,
      player: serializePublicGuestPlayer(updated[0]),
    };
  } catch {
    return {
      ok: true,
      mode: "offline",
      awardedPoints: clampedPoints,
      player: null,
    };
  }
}

export async function purchaseAndEquipCosmetic(
  itemId: string,
  price: number,
  backupTransferCode?: string
): Promise<{
  ok: boolean;
  mode: "online" | "offline";
  player: PublicGuestPlayer | null;
  error?: string;
}> {
  const item = findCosmeticById(itemId);
  if (!item) {
    return {
      ok: false,
      mode: "online",
      player: null,
      error: "Cosmetic item not found.",
    };
  }

  if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
    return {
      ok: false,
      mode: "online",
      player: null,
      error: "Invalid cosmetic price.",
    };
  }

  const sql = getDbClient();
  if (!sql) {
    return {
      ok: false,
      mode: "offline",
      player: null,
      error: "Cosmetic shop requires Neon DB connection.",
    };
  }

  const player = await resolveOrCreateGuestSession(backupTransferCode);
  if (!player) {
    return {
      ok: false,
      mode: "offline",
      player: null,
      error: "Unable to connect to guest profile.",
    };
  }

  const alreadyOwned = player.ownedItems.includes(item.id);
  if (!alreadyOwned && price !== item.price) {
    return {
      ok: false,
      mode: "online",
      player,
      error: "Price mismatch for cosmetic item.",
    };
  }

  try {
    if (alreadyOwned) {
      const equipped = (await sql`
        UPDATE guest_players
        SET
          equipped_title = CASE WHEN ${item.kind === "title"} THEN ${item.value} ELSE equipped_title END,
          equipped_ring = CASE WHEN ${item.kind === "ring"} THEN ${item.value} ELSE equipped_ring END,
          updated_at = NOW()
        WHERE id = ${player.id}
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

      return {
        ok: equipped.length > 0,
        mode: "online",
        player: equipped[0] ? serializePublicGuestPlayer(equipped[0]) : player,
      };
    }

    const updated = (await sql`
      UPDATE guest_players
      SET
        it_coins = it_coins - ${item.price},
        owned_items = owned_items || ${JSON.stringify([item.id])}::jsonb,
        equipped_title = CASE WHEN ${item.kind === "title"} THEN ${item.value} ELSE equipped_title END,
        equipped_ring = CASE WHEN ${item.kind === "ring"} THEN ${item.value} ELSE equipped_ring END,
        updated_at = NOW()
      WHERE id = ${player.id}
        AND it_coins >= ${item.price}
        AND NOT (owned_items ? ${item.id})
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
        player,
        error: "Not enough IT-Coins to purchase this item.",
      };
    }

    return {
      ok: true,
      mode: "online",
      player: serializePublicGuestPlayer(updated[0]),
    };
  } catch {
    return {
      ok: false,
      mode: "offline",
      player,
      error: "Purchase transaction failed.",
    };
  }
}

export async function updateGuestDisplayName(
  rawName: string,
  backupTransferCode?: string
): Promise<{
  ok: boolean;
  mode: "online" | "offline";
  player: PublicGuestPlayer | null;
  error?: string;
}> {
  const cleaned =
    typeof rawName === "string"
      ? rawName.replace(/[\u0000-\u001F\u007F]/g, "").trim()
      : "";

  if (cleaned.length < 2 || cleaned.length > 24) {
    return {
      ok: false,
      mode: "online",
      player: null,
      error: "Display name must be between 2 and 24 characters.",
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

  const player = await resolveOrCreateGuestSession(backupTransferCode);
  if (!player) {
    return {
      ok: false,
      mode: "offline",
      player: null,
      error: "Unable to resolve guest profile.",
    };
  }

  try {
    const updated = (await sql`
      UPDATE guest_players
      SET
        display_name = ${cleaned},
        updated_at = NOW()
      WHERE id = ${player.id}
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

    return {
      ok: updated.length > 0,
      mode: "online",
      player: updated[0] ? serializePublicGuestPlayer(updated[0]) : player,
    };
  } catch {
    return {
      ok: false,
      mode: "offline",
      player,
      error: "Unable to update display name.",
    };
  }
}


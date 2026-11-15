"use server";

import {
  ALL_COSMETIC_ITEMS,
  COSMETIC_CATEGORIES,
  CosmeticCategory,
  findCosmeticById,
  normalizeEquippedCosmetics,
} from "../../lib/cosmetics";
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

const COSMETIC_PRICES_JSON = JSON.stringify(
  ALL_COSMETIC_ITEMS.map((item) => ({ id: item.id, price: item.price }))
);

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
      WITH active_players AS (
        SELECT
          id,
          display_name,
          GREATEST(
            it_coins,
            GREATEST(
              0,
              FLOOR(total_points::numeric / 1000)::int - COALESCE((
                SELECT SUM((c->>'price')::int)
                FROM (
                  SELECT DISTINCT item_id
                  FROM jsonb_array_elements_text(COALESCE(owned_items, '[]'::jsonb)) AS owned(item_id)
                ) AS distinct_owned
                JOIN jsonb_array_elements(${COSMETIC_PRICES_JSON}::jsonb) AS c
                  ON c->>'id' = distinct_owned.item_id
              ), 0)::int
            )
          ) AS effective_coins,
          total_points,
          streak_days,
          equipped_title,
          equipped_ring,
          equipped_cosmetics,
          created_at
        FROM guest_players
        WHERE total_points > 0
      )
      SELECT
        id,
        display_name AS "displayName",
        effective_coins AS "itCoins",
        total_points AS "totalPoints",
        streak_days AS "streakDays",
        equipped_title AS "equippedTitle",
        equipped_ring AS "equippedRing",
        equipped_cosmetics AS "equippedCosmetics",
        DENSE_RANK() OVER (ORDER BY total_points DESC, effective_coins DESC)::int AS rank
      FROM active_players
      ORDER BY total_points DESC, effective_coins DESC, created_at ASC
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
      equippedCosmetics: normalizeEquippedCosmetics(row.equippedCosmetics),
      rank: Number(row.rank) || 1,
      isCurrentUser: currentPlayer ? row.id === currentPlayer.id : false,
    }));

    let currentUserRank: LeaderboardEntry | null = null;
    if (currentPlayer) {
      const rankRows = (await sql`
        WITH active_players AS (
          SELECT
            id,
            display_name,
            GREATEST(
              it_coins,
              GREATEST(
                0,
                FLOOR(total_points::numeric / 1000)::int - COALESCE((
                  SELECT SUM((c->>'price')::int)
                  FROM (
                    SELECT DISTINCT item_id
                    FROM jsonb_array_elements_text(COALESCE(owned_items, '[]'::jsonb)) AS owned(item_id)
                  ) AS distinct_owned
                  JOIN jsonb_array_elements(${COSMETIC_PRICES_JSON}::jsonb) AS c
                    ON c->>'id' = distinct_owned.item_id
                ), 0)::int
              )
            ) AS effective_coins,
            total_points,
            streak_days,
            equipped_title,
            equipped_ring
          FROM guest_players
          WHERE total_points > 0
        ),
        ranked AS (
          SELECT
            id,
            display_name AS "displayName",
            effective_coins AS "itCoins",
            total_points AS "totalPoints",
            streak_days AS "streakDays",
            equipped_title AS "equippedTitle",
            equipped_ring AS "equippedRing",
            DENSE_RANK() OVER (ORDER BY total_points DESC, effective_coins DESC)::int AS rank
          FROM active_players
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
      } else {
        const tailRows = (await sql`
          WITH active_players AS (
            SELECT
              GREATEST(
                it_coins,
                GREATEST(
                  0,
                  FLOOR(total_points::numeric / 1000)::int - COALESCE((
                    SELECT SUM((c->>'price')::int)
                    FROM (
                      SELECT DISTINCT item_id
                      FROM jsonb_array_elements_text(COALESCE(owned_items, '[]'::jsonb)) AS owned(item_id)
                    ) AS distinct_owned
                    JOIN jsonb_array_elements(${COSMETIC_PRICES_JSON}::jsonb) AS c
                      ON c->>'id' = distinct_owned.item_id
                  ), 0)::int
                )
              ) AS effective_coins,
              total_points
            FROM guest_players
            WHERE total_points > 0
          ),
          ranked AS (
            SELECT DENSE_RANK() OVER (ORDER BY total_points DESC, effective_coins DESC)::int AS rank
            FROM active_players
          )
          SELECT (COALESCE(MAX(rank), 0) + 1)::int AS next_rank
          FROM ranked
        `) as Array<{ next_rank: number }>;

        currentUserRank = {
          id: currentPlayer.id,
          displayName: currentPlayer.displayName,
          itCoins: currentPlayer.itCoins,
          totalPoints: currentPlayer.totalPoints,
          streakDays: currentPlayer.streakDays,
          equippedTitle: currentPlayer.equippedTitle,
          equippedRing: currentPlayer.equippedRing,
          rank: Number(tailRows[0]?.next_rank) || 1,
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
        it_coins = GREATEST(
          it_coins + (
            FLOOR((total_points + ${clampedPoints})::numeric / 1000)::int -
            FLOOR(total_points::numeric / 1000)::int
          ),
          GREATEST(
            0,
            FLOOR((total_points + ${clampedPoints})::numeric / 1000)::int - COALESCE((
              SELECT SUM((c->>'price')::int)
              FROM (
                SELECT DISTINCT item_id
                FROM jsonb_array_elements_text(COALESCE(owned_items, '[]'::jsonb)) AS owned(item_id)
              ) AS distinct_owned
              JOIN jsonb_array_elements(${COSMETIC_PRICES_JSON}::jsonb) AS c
                ON c->>'id' = distinct_owned.item_id
            ), 0)::int
          )
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
          equipped_ring = CASE WHEN ${item.kind === "ring" || item.category === "avatar_decoration"} THEN ${item.value} ELSE equipped_ring END,
          equipped_cosmetics = COALESCE(equipped_cosmetics, '{}'::jsonb) || jsonb_build_object(${item.category}::text, ${item.id}::text),
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
          equipped_cosmetics,
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
      WITH target AS (
        SELECT
          id,
          GREATEST(
            it_coins,
            GREATEST(
              0,
              FLOOR(total_points::numeric / 1000)::int - COALESCE((
                SELECT SUM((c->>'price')::int)
                FROM (
                  SELECT DISTINCT item_id
                  FROM jsonb_array_elements_text(COALESCE(owned_items, '[]'::jsonb)) AS owned(item_id)
                ) AS distinct_owned
                JOIN jsonb_array_elements(${COSMETIC_PRICES_JSON}::jsonb) AS c
                  ON c->>'id' = distinct_owned.item_id
              ), 0)::int
            )
          ) AS effective_coins
        FROM guest_players
        WHERE id = ${player.id}
          AND NOT (owned_items ? ${item.id})
      )
      UPDATE guest_players
      SET
        it_coins = target.effective_coins - ${item.price},
        owned_items = guest_players.owned_items || ${JSON.stringify([item.id])}::jsonb,
        equipped_title = CASE WHEN ${item.kind === "title"} THEN ${item.value} ELSE guest_players.equipped_title END,
        equipped_ring = CASE WHEN ${item.kind === "ring" || item.category === "avatar_decoration"} THEN ${item.value} ELSE guest_players.equipped_ring END,
        equipped_cosmetics = COALESCE(guest_players.equipped_cosmetics, '{}'::jsonb) || jsonb_build_object(${item.category}::text, ${item.id}::text),
        updated_at = NOW()
      FROM target
      WHERE guest_players.id = target.id
        AND target.effective_coins >= ${item.price}
      RETURNING
        guest_players.id,
        guest_players.device_token_hash,
        guest_players.transfer_code,
        guest_players.display_name,
        guest_players.it_coins,
        guest_players.total_points,
        guest_players.streak_days,
        guest_players.last_practice_date,
        guest_players.equipped_title,
        guest_players.equipped_ring,
        guest_players.equipped_cosmetics,
        guest_players.owned_items,
        guest_players.created_at,
        guest_players.updated_at
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

export async function equipOwnedCosmetic(
  category: CosmeticCategory,
  itemId: string,
  backupTransferCode?: string
): Promise<{
  ok: boolean;
  mode: "online" | "offline";
  player: PublicGuestPlayer | null;
  error?: string;
}> {
  if (!COSMETIC_CATEGORIES.includes(category)) {
    return {
      ok: false,
      mode: "online",
      player: null,
      error: "Invalid cosmetic category.",
    };
  }

  const item = findCosmeticById(itemId);
  if (!item || item.category !== category) {
    return {
      ok: false,
      mode: "online",
      player: null,
      error: "Cosmetic item does not match category.",
    };
  }

  const sql = getDbClient();
  if (!sql) {
    return {
      ok: false,
      mode: "offline",
      player: null,
      error: "Cosmetic equip requires Neon DB connection.",
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

  if (!player.ownedItems.includes(item.id)) {
    return {
      ok: false,
      mode: "online",
      player,
      error: "You do not own this cosmetic item yet.",
    };
  }

  try {
    const updated = (await sql`
      UPDATE guest_players
      SET
        equipped_ring = CASE WHEN ${category === "avatar_decoration"} THEN ${item.value} ELSE equipped_ring END,
        equipped_cosmetics = COALESCE(equipped_cosmetics, '{}'::jsonb) || jsonb_build_object(${category}::text, ${item.id}::text),
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
        equipped_cosmetics,
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
      error: "Unable to equip cosmetic item.",
    };
  }
}

export async function unequipCosmeticSlot(
  category: CosmeticCategory,
  backupTransferCode?: string
): Promise<{
  ok: boolean;
  mode: "online" | "offline";
  player: PublicGuestPlayer | null;
  error?: string;
}> {
  if (!COSMETIC_CATEGORIES.includes(category)) {
    return {
      ok: false,
      mode: "online",
      player: null,
      error: "Invalid cosmetic category.",
    };
  }

  const sql = getDbClient();
  if (!sql) {
    return {
      ok: false,
      mode: "offline",
      player: null,
      error: "Cosmetic unequip requires Neon DB connection.",
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

  try {
    const updated = (await sql`
      UPDATE guest_players
      SET
        equipped_ring = CASE WHEN ${category === "avatar_decoration"} THEN 'default' ELSE equipped_ring END,
        equipped_cosmetics = COALESCE(equipped_cosmetics, '{}'::jsonb) - ${category},
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
        equipped_cosmetics,
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
      error: "Unable to unequip cosmetic item.",
    };
  }
}


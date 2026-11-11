import { NeonQueryFunction } from "@neondatabase/serverless";
import { getNeonSql, sanitizeDatabaseUrl } from "./neon";

export interface GuestPlayerRow {
  id: string;
  device_token_hash: string;
  transfer_code: string;
  display_name: string;
  it_coins: number;
  total_points: number;
  streak_days: number;
  last_practice_date: string | null;
  equipped_title: string;
  equipped_ring: string;
  owned_items: string[];
  created_at: string;
  updated_at: string;
}

export interface LeaderboardEntry {
  id: string;
  displayName: string;
  itCoins: number;
  totalPoints: number;
  streakDays: number;
  equippedTitle: string;
  equippedRing: string;
  rank: number;
  isCurrentUser?: boolean;
}

export interface PublicGuestPlayer {
  id: string;
  transferCode: string;
  displayName: string;
  itCoins: number;
  totalPoints: number;
  streakDays: number;
  lastPracticeDate: string | null;
  equippedTitle: string;
  equippedRing: string;
  ownedItems: string[];
}

let guestSchemaReadyUrl: string | null = null;
let guestSchemaInFlight: Promise<boolean> | null = null;

export async function initializeGuestPlayersSchema(
  sqlClient?: NeonQueryFunction<false, false> | null
): Promise<boolean> {
  const url = sanitizeDatabaseUrl(process.env.DATABASE_URL);
  const sql = sqlClient ?? getNeonSql();
  if (!url || !sql) return false;
  if (guestSchemaReadyUrl === url) return true;
  if (guestSchemaInFlight) return guestSchemaInFlight;

  guestSchemaInFlight = (async () => {
    try {
      await sql.transaction([
        sql`
          CREATE TABLE IF NOT EXISTS guest_players (
            id TEXT PRIMARY KEY,
            device_token_hash TEXT UNIQUE NOT NULL,
            transfer_code TEXT UNIQUE NOT NULL,
            display_name TEXT NOT NULL,
            it_coins INT NOT NULL DEFAULT 0,
            total_points INT NOT NULL DEFAULT 0,
            streak_days INT NOT NULL DEFAULT 0,
            last_practice_date TEXT,
            equipped_title TEXT NOT NULL DEFAULT 'Junior Speaker',
            equipped_ring TEXT NOT NULL DEFAULT 'default',
            owned_items JSONB NOT NULL DEFAULT '[]'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `,
        sql`
          CREATE INDEX IF NOT EXISTS idx_guest_players_leaderboard
          ON guest_players (it_coins DESC, total_points DESC)
        `,
      ]);
      guestSchemaReadyUrl = url;
      return true;
    } catch {
      guestSchemaReadyUrl = null;
      return false;
    } finally {
      guestSchemaInFlight = null;
    }
  })();

  return guestSchemaInFlight;
}


import { neon, NeonQueryFunction } from "@neondatabase/serverless";

// Server-only helper: never import from client components.
let cachedUrl: string | null = null;
let cachedSql: NeonQueryFunction<false, false> | null = null;
let schemaReadyUrl: string | null = null;
let schemaInFlight: Promise<boolean> | null = null;

/**
 * Strips leading/trailing whitespace and accidental surrounding quotes from DATABASE_URL.
 */
export function sanitizeDatabaseUrl(raw?: string): string | null {
  if (typeof raw !== "string") return null;
  let cleaned = raw.trim();
  while (
    cleaned.length >= 2 &&
    ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'")))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Returns a Neon HTTP SQL client or null when DATABASE_URL is absent/invalid.
 */
export function getNeonSql(): NeonQueryFunction<false, false> | null {
  const url = sanitizeDatabaseUrl(process.env.DATABASE_URL);
  if (!url) return null;
  if (cachedUrl === url && cachedSql) return cachedSql;

  try {
    cachedSql = neon(url);
    cachedUrl = url;
    return cachedSql;
  } catch {
    cachedUrl = null;
    cachedSql = null;
    return null;
  }
}

/**
 * Ensures SpeakIT telemetry and custom content tables exist idempotently.
 */
export async function ensureSchema(): Promise<boolean> {
  const url = sanitizeDatabaseUrl(process.env.DATABASE_URL);
  const sql = getNeonSql();
  if (!url || !sql) return false;
  if (schemaReadyUrl === url) return true;
  if (schemaInFlight) return schemaInFlight;

  schemaInFlight = (async () => {
    try {
      await sql.transaction([
        sql`
          CREATE TABLE IF NOT EXISTS speakit_attempts (
            id TEXT PRIMARY KEY,
            scenario TEXT NOT NULL,
            turn_index INT NOT NULL,
            transcript TEXT NOT NULL,
            score INT NOT NULL,
            keywords_used JSONB NOT NULL DEFAULT '[]',
            role TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `,
        sql`
          CREATE TABLE IF NOT EXISTS speakit_weak_points (
            key TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            value TEXT NOT NULL,
            miss_count INT NOT NULL DEFAULT 1,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `,
        sql`
          CREATE TABLE IF NOT EXISTS speakit_arena_runs (
            id TEXT PRIMARY KEY,
            game_id TEXT NOT NULL,
            score INT NOT NULL,
            accuracy_or_words INT NOT NULL,
            duration_sec INT NOT NULL,
            role TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `,
        sql`
          CREATE TABLE IF NOT EXISTS speakit_custom_content (
            key TEXT PRIMARY KEY,
            payload JSONB NOT NULL DEFAULT '{}',
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `,
      ]);
      schemaReadyUrl = url;
      return true;
    } catch {
      schemaReadyUrl = null;
      return false;
    } finally {
      schemaInFlight = null;
    }
  })();

  return schemaInFlight;
}

import type { CosmeticItem } from "./cosmetics";
import { getNeonSql } from "./db/neon";

let schemaReady = false;
let schemaInFlight: Promise<boolean> | null = null;

async function ensureCustomCosmeticsTable(): Promise<boolean> {
  const sql = getNeonSql();
  if (!sql) return false;
  if (schemaReady) return true;
  if (schemaInFlight) return schemaInFlight;

  schemaInFlight = (async () => {
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS custom_cosmetics (
          id TEXT PRIMARY KEY,
          payload JSONB NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      schemaReady = true;
      return true;
    } catch {
      schemaReady = false;
      return false;
    } finally {
      schemaInFlight = null;
    }
  })();

  return schemaInFlight;
}

export async function listCustomCosmetics(): Promise<CosmeticItem[]> {
  const ready = await ensureCustomCosmeticsTable();
  const sql = getNeonSql();
  if (!ready || !sql) return [];

  try {
    const rows = (await sql`
      SELECT id, payload
      FROM custom_cosmetics
      ORDER BY created_at DESC
    `) as Array<{ id: string; payload: unknown }>;

    const items: CosmeticItem[] = [];
    for (const row of rows) {
      if (row.payload && typeof row.payload === "object") {
        const parsed = row.payload as CosmeticItem;
        if (typeof parsed.id === "string" && typeof parsed.name === "string") {
          items.push(parsed);
        }
      }
    }
    return items;
  } catch {
    return [];
  }
}

export async function saveCustomCosmetic(item: CosmeticItem): Promise<CosmeticItem | null> {
  const ready = await ensureCustomCosmeticsTable();
  const sql = getNeonSql();
  if (!ready || !sql) return null;

  try {
    const payloadJson = JSON.stringify(item);
    await sql`
      INSERT INTO custom_cosmetics (id, payload, created_at)
      VALUES (${item.id}, ${payloadJson}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE
      SET payload = EXCLUDED.payload
    `;
    return item;
  } catch {
    return null;
  }
}

export async function deleteCustomCosmetics(ids: string[]): Promise<string[]> {
  const cleanIds = Array.from(new Set(ids.map((x) => x.trim()).filter(Boolean)));
  if (cleanIds.length === 0) return [];

  const ready = await ensureCustomCosmeticsTable();
  const sql = getNeonSql();
  if (!ready || !sql) return [];

  try {
    const rows = (await sql`
      DELETE FROM custom_cosmetics
      WHERE id = ANY(${cleanIds})
      RETURNING id
    `) as Array<{ id: string }>;
    return rows.map((r) => String(r.id));
  } catch {
    return [];
  }
}

export async function deleteCustomCosmetic(id: string): Promise<boolean> {
  const deleted = await deleteCustomCosmetics([id]);
  return deleted.length > 0;
}

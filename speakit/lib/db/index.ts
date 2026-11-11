import { NeonQueryFunction } from "@neondatabase/serverless";
import { getNeonSql, sanitizeDatabaseUrl } from "./neon";
import { initializeGuestPlayersSchema } from "./schema";

export { getNeonSql, sanitizeDatabaseUrl } from "./neon";
export * from "./schema";

export function getDbClient(): NeonQueryFunction<false, false> | null {
  return getNeonSql();
}

export async function ensureGuestDatabaseReady(): Promise<boolean> {
  const sql = getNeonSql();
  if (!sql) return false;
  return initializeGuestPlayersSchema(sql);
}

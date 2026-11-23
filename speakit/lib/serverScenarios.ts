import { SCENARIOS } from "../data/scenarios";
import { mergeScenarios, normalizeContentOverrides } from "./contentStore";
import { ensureSchema, getNeonSql } from "./db/neon";
import type { Scenario } from "./types";

export async function getMergedScenarios(): Promise<Scenario[]> {
  const sql = getNeonSql();
  if (!sql) {
    return SCENARIOS.filter((s) => !s.isHidden);
  }

  try {
    const ready = await ensureSchema();
    if (!ready) {
      return SCENARIOS.filter((s) => !s.isHidden);
    }

    const rows = await sql`
      SELECT payload
      FROM speakit_custom_content
      WHERE key = 'main'
      LIMIT 1
    `;
    const overrides = normalizeContentOverrides(rows[0]?.payload);
    return mergeScenarios(SCENARIOS, overrides);
  } catch {
    return SCENARIOS.filter((s) => !s.isHidden);
  }
}

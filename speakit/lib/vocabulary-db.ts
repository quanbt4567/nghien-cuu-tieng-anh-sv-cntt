import { VOCABULARY_LIST } from "../data/scenarios";
import {
  normalizeContentOverrides,
  normalizeIncomingVocabularyItem,
} from "./contentStore";
import { getNeonSql as getSql } from "./db";
import { ensureSchema } from "./db/neon";
import type { VocabularyItem } from "./types";

export function canonicalVocabularyTermKey(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

function isBrokenPlaceholderVocabulary(item: VocabularyItem): boolean {
  const ipa = (item.phonetic || "").trim();
  const hasIpa = Boolean(ipa && ipa !== "/.../");
  const hasMeaning = Boolean((item.meaningVI || "").trim());
  const hasExample = Boolean((item.exampleSentenceEN || "").trim());
  return !hasIpa && !hasMeaning && !hasExample;
}

function normalizeVocabularyItem(raw: unknown): VocabularyItem | null {
  return normalizeIncomingVocabularyItem(raw);
}

async function ensureVocabularyTable(): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;
  await sql`
    CREATE TABLE IF NOT EXISTS vocabulary_items (
      id TEXT PRIMARY KEY,
      term TEXT UNIQUE NOT NULL,
      payload JSONB NOT NULL,
      cluster_slug TEXT,
      cluster_title TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  return true;
}

export async function purgeBrokenPlaceholderVocabulary(): Promise<void> {
  const sql = getSql();
  if (!sql) return;

  await ensureVocabularyTable();
  await sql`
    DELETE FROM vocabulary_items
    WHERE COALESCE(BTRIM(payload->>'meaningVI'), '') = ''
      AND (COALESCE(BTRIM(payload->>'phonetic'), '') = '' OR BTRIM(payload->>'phonetic') = '/.../')
      AND COALESCE(BTRIM(payload->>'exampleSentenceEN'), '') = ''
  `;

  const schemaReady = await ensureSchema();
  if (!schemaReady) return;

  const rows = await sql`
    SELECT payload
    FROM speakit_custom_content
    WHERE key = 'main'
    LIMIT 1
  `;
  const overrides = normalizeContentOverrides(rows[0]?.payload);
  const cleanedCustom = overrides.customVocabulary.filter(
    (entry) => !isBrokenPlaceholderVocabulary(entry)
  );
  if (cleanedCustom.length !== overrides.customVocabulary.length) {
    const nextOverrides = {
      ...overrides,
      customVocabulary: cleanedCustom,
    };
    await sql`
      INSERT INTO speakit_custom_content (key, payload, updated_at)
      VALUES ('main', ${JSON.stringify(nextOverrides)}::jsonb, NOW())
      ON CONFLICT (key) DO UPDATE SET
        payload = EXCLUDED.payload,
        updated_at = NOW()
    `;
  }
}

export async function importVocabularyItemsSkipDuplicates(
  rawRows: unknown[],
  defaultClusterFallback = "Tùy chỉnh"
): Promise<{
  importedCount: number;
  skippedDuplicatesCount: number;
  skippedTerms: string[];
}> {
  const sql = getSql();
  if (!sql) {
    return { importedCount: 0, skippedDuplicatesCount: 0, skippedTerms: [] };
  }

  await purgeBrokenPlaceholderVocabulary();

  const existingKeys = new Set<string>();
  for (const baseItem of VOCABULARY_LIST) {
    const key = canonicalVocabularyTermKey(baseItem.term);
    if (key) existingKeys.add(key);
  }

  const dbRows = await sql`
    SELECT LOWER(REGEXP_REPLACE(BTRIM(term), '\s+', ' ', 'g')) AS canonical_term
    FROM vocabulary_items
  `;
  for (const row of dbRows) {
    if (typeof row.canonical_term === "string" && row.canonical_term) {
      existingKeys.add(row.canonical_term);
    }
  }

  const schemaReady = await ensureSchema();
  let overrides = normalizeContentOverrides(null);
  if (schemaReady) {
    const rows = await sql`
      SELECT payload
      FROM speakit_custom_content
      WHERE key = 'main'
      LIMIT 1
    `;
    overrides = normalizeContentOverrides(rows[0]?.payload);
    for (const customItem of overrides.customVocabulary) {
      const key = canonicalVocabularyTermKey(customItem.term);
      if (key) existingKeys.add(key);
    }
  }

  const batchSeen = new Set<string>();
  const skippedTerms: string[] = [];
  const toInsert: VocabularyItem[] = [];

  for (const rawRow of rawRows) {
    const item = normalizeIncomingVocabularyItem(rawRow, defaultClusterFallback);
    if (!item) continue;
    const key = canonicalVocabularyTermKey(item.term);
    if (!key) continue;

    if (batchSeen.has(key) || existingKeys.has(key)) {
      skippedTerms.push(item.term);
      continue;
    }

    batchSeen.add(key);
    existingKeys.add(key);
    toInsert.push(item);
  }

  for (const item of toInsert) {
    const key = canonicalVocabularyTermKey(item.term);
    await sql`
      INSERT INTO vocabulary_items (id, term, payload, cluster_slug, cluster_title, updated_at)
      VALUES (
        ${item.id},
        ${key},
        ${JSON.stringify(item)}::jsonb,
        ${item.clusterSlug ?? null},
        ${item.clusterTitle ?? null},
        NOW()
      )
      ON CONFLICT (term) DO NOTHING
    `;
  }

  if (schemaReady && toInsert.length > 0) {
    const nextOverrides = {
      ...overrides,
      customVocabulary: [...overrides.customVocabulary, ...toInsert],
      deletedVocabIds: overrides.deletedVocabIds.filter(
        (id) => !toInsert.some((ins) => ins.id === id)
      ),
    };
    await sql`
      INSERT INTO speakit_custom_content (key, payload, updated_at)
      VALUES ('main', ${JSON.stringify(nextOverrides)}::jsonb, NOW())
      ON CONFLICT (key) DO UPDATE SET
        payload = EXCLUDED.payload,
        updated_at = NOW()
    `;
  }

  return {
    importedCount: toInsert.length,
    skippedDuplicatesCount: skippedTerms.length,
    skippedTerms,
  };
}

export async function upsertVocabularyItems(
  items: VocabularyItem[]
): Promise<VocabularyItem[]> {
  const deduped = new Map<string, VocabularyItem>();
  for (const item of items) {
    const normalized = normalizeVocabularyItem(item);
    if (!normalized) continue;
    deduped.set(canonicalVocabularyTermKey(normalized.term), normalized);
  }
  const normalizedItems = Array.from(deduped.values());
  if (normalizedItems.length === 0) return [];

  const sql = getSql();
  if (!sql) return [];

  await ensureVocabularyTable();

  for (const item of normalizedItems) {
    await sql`
      INSERT INTO vocabulary_items (id, term, payload, cluster_slug, cluster_title, updated_at)
      VALUES (
        ${item.id},
        ${canonicalVocabularyTermKey(item.term)},
        ${JSON.stringify(item)}::jsonb,
        ${item.clusterSlug ?? null},
        ${item.clusterTitle ?? null},
        NOW()
      )
      ON CONFLICT (term) DO UPDATE SET
        payload = EXCLUDED.payload,
        cluster_slug = EXCLUDED.cluster_slug,
        cluster_title = EXCLUDED.cluster_title,
        updated_at = NOW()
    `;
  }

  const schemaReady = await ensureSchema();
  if (schemaReady) {
    const rows = await sql`
      SELECT payload
      FROM speakit_custom_content
      WHERE key = 'main'
      LIMIT 1
    `;
    const overrides = normalizeContentOverrides(rows[0]?.payload);
    const merged = [...overrides.customVocabulary];
    const indexByTerm = new Map<string, number>();
    const indexById = new Map<string, number>();
    merged.forEach((entry, idx) => {
      indexByTerm.set(canonicalVocabularyTermKey(entry.term), idx);
      indexById.set(entry.id, idx);
    });

    const removedIds = new Set<string>();
    for (const item of normalizedItems) {
      removedIds.add(item.id);
      const existingIdx =
        indexByTerm.get(canonicalVocabularyTermKey(item.term)) ??
        indexById.get(item.id);
      if (existingIdx !== undefined) {
        merged[existingIdx] = {
          ...item,
          id: merged[existingIdx].id,
        };
        removedIds.add(merged[existingIdx].id);
      } else {
        const nextIdx = merged.length;
        merged.push(item);
        indexByTerm.set(canonicalVocabularyTermKey(item.term), nextIdx);
        indexById.set(item.id, nextIdx);
      }
    }

    const nextOverrides = {
      ...overrides,
      customVocabulary: merged,
      deletedVocabIds: overrides.deletedVocabIds.filter(
        (id) => !removedIds.has(id)
      ),
    };

    await sql`
      INSERT INTO speakit_custom_content (key, payload, updated_at)
      VALUES ('main', ${JSON.stringify(nextOverrides)}::jsonb, NOW())
      ON CONFLICT (key) DO UPDATE SET
        payload = EXCLUDED.payload,
        updated_at = NOW()
    `;
  }

  return normalizedItems;
}

export async function listDbVocabularyItems(): Promise<VocabularyItem[]> {
  const sql = getSql();
  if (!sql) return [];

  try {
    await ensureVocabularyTable();
    const rows = await sql`
      SELECT id, term, payload, cluster_slug, cluster_title
      FROM vocabulary_items
      ORDER BY updated_at DESC
    `;

    const result: VocabularyItem[] = [];
    for (const row of rows) {
      const rawPayload =
        row.payload && typeof row.payload === "object"
          ? (row.payload as Record<string, unknown>)
          : {};
      const item = normalizeVocabularyItem({
        ...rawPayload,
        id: typeof rawPayload.id === "string" ? rawPayload.id : String(row.id),
        term:
          typeof rawPayload.term === "string"
            ? rawPayload.term
            : String(row.term),
        clusterSlug:
          typeof row.cluster_slug === "string" && row.cluster_slug
            ? row.cluster_slug
            : rawPayload.clusterSlug,
        clusterTitle:
          typeof row.cluster_title === "string" && row.cluster_title
            ? row.cluster_title
            : rawPayload.clusterTitle,
      });
      if (item && !isBrokenPlaceholderVocabulary(item)) {
        result.push(item);
      }
    }
    return result;
  } catch {
    return [];
  }
}

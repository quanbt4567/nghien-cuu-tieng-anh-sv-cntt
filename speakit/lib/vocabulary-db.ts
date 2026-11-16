import { normalizeContentOverrides } from "./contentStore";
import { getNeonSql as getSql } from "./db";
import { ensureSchema } from "./db/neon";
import type { VocabularyItem } from "./types";

function slugifyTerm(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || `term-${Date.now().toString(36)}`;
}

function normalizeCareerLevel(
  value: unknown
): "Fresher" | "Junior" | "Senior" | undefined {
  if (value === "Fresher" || value === "Junior" || value === "Senior") {
    return value;
  }
  return undefined;
}

function normalizeRelatedTerms(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    const key = trimmed.toLowerCase();
    if (trimmed && !seen.has(key)) {
      seen.add(key);
      out.push(trimmed);
    }
  }
  return out.length > 0 ? out : undefined;
}

function normalizeVocabularyItem(raw: VocabularyItem): VocabularyItem | null {
  const term = typeof raw.term === "string" ? raw.term.trim() : "";
  if (!term) return null;
  const id =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id.trim()
      : `vocab-${slugifyTerm(term)}`;
  const careerLevel = normalizeCareerLevel(raw.careerLevel);
  const relatedTerms = normalizeRelatedTerms(raw.relatedTerms);
  const clusterTitle =
    typeof raw.clusterTitle === "string" && raw.clusterTitle.trim()
      ? raw.clusterTitle.trim()
      : undefined;
  const clusterSlug =
    typeof raw.clusterSlug === "string" && raw.clusterSlug.trim()
      ? raw.clusterSlug.trim()
      : clusterTitle
      ? slugifyTerm(clusterTitle)
      : undefined;

  return {
    id,
    term,
    phonetic: typeof raw.phonetic === "string" ? raw.phonetic.trim() : "",
    partOfSpeech:
      typeof raw.partOfSpeech === "string" && raw.partOfSpeech.trim()
        ? raw.partOfSpeech.trim()
        : "noun",
    meaningVI: typeof raw.meaningVI === "string" ? raw.meaningVI.trim() : "",
    exampleSentenceEN:
      typeof raw.exampleSentenceEN === "string"
        ? raw.exampleSentenceEN.trim()
        : "",
    exampleTranslationVI:
      typeof raw.exampleTranslationVI === "string"
        ? raw.exampleTranslationVI.trim()
        : "",
    ...(clusterTitle ? { clusterTitle } : {}),
    ...(clusterSlug ? { clusterSlug } : {}),
    ...(careerLevel ? { careerLevel } : {}),
    ...(relatedTerms ? { relatedTerms } : {}),
  };
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

export async function upsertVocabularyItems(
  items: VocabularyItem[]
): Promise<VocabularyItem[]> {
  const deduped = new Map<string, VocabularyItem>();
  for (const item of items) {
    const normalized = normalizeVocabularyItem(item);
    if (!normalized) continue;
    deduped.set(normalized.term.toLowerCase(), normalized);
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
        ${item.term.toLowerCase()},
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
      indexByTerm.set(entry.term.toLowerCase(), idx);
      indexById.set(entry.id, idx);
    });

    const removedIds = new Set<string>();
    for (const item of normalizedItems) {
      removedIds.add(item.id);
      const existingIdx =
        indexByTerm.get(item.term.toLowerCase()) ?? indexById.get(item.id);
      if (existingIdx !== undefined) {
        merged[existingIdx] = {
          ...item,
          id: merged[existingIdx].id,
        };
        removedIds.add(merged[existingIdx].id);
      } else {
        const nextIdx = merged.length;
        merged.push(item);
        indexByTerm.set(item.term.toLowerCase(), nextIdx);
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
          ? (row.payload as Partial<VocabularyItem>)
          : {};
      const item = normalizeVocabularyItem({
        id: typeof rawPayload.id === "string" ? rawPayload.id : String(row.id),
        term:
          typeof rawPayload.term === "string"
            ? rawPayload.term
            : String(row.term),
        phonetic:
          typeof rawPayload.phonetic === "string" ? rawPayload.phonetic : "",
        partOfSpeech:
          typeof rawPayload.partOfSpeech === "string"
            ? rawPayload.partOfSpeech
            : "noun",
        meaningVI:
          typeof rawPayload.meaningVI === "string" ? rawPayload.meaningVI : "",
        exampleSentenceEN:
          typeof rawPayload.exampleSentenceEN === "string"
            ? rawPayload.exampleSentenceEN
            : "",
        exampleTranslationVI:
          typeof rawPayload.exampleTranslationVI === "string"
            ? rawPayload.exampleTranslationVI
            : "",
        clusterSlug:
          typeof row.cluster_slug === "string"
            ? row.cluster_slug
            : rawPayload.clusterSlug,
        clusterTitle:
          typeof row.cluster_title === "string"
            ? row.cluster_title
            : rawPayload.clusterTitle,
        careerLevel: rawPayload.careerLevel,
        relatedTerms: rawPayload.relatedTerms,
      });
      if (item) result.push(item);
    }
    return result;
  } catch {
    return [];
  }
}

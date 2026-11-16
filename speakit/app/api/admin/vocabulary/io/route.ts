import { NextRequest, NextResponse } from "next/server";
import { VOCABULARY_LIST } from "../../../../../data/scenarios";
import { isAdminRequest } from "../../../../../lib/adminAuth";
import {
  createEmptyContentOverrides,
  mergeVocabulary,
  normalizeContentOverrides,
} from "../../../../../lib/contentStore";
import { ensureSchema, getNeonSql } from "../../../../../lib/db/neon";
import type { AdminContentOverrides, VocabularyItem } from "../../../../../lib/types";
import {
  canonicalVocabularyTermKey,
  importVocabularyItemsSkipDuplicates,
  listDbVocabularyItems,
} from "../../../../../lib/vocabulary-db";

export const dynamic = "force-dynamic";

const CSV_HEADERS = [
  "id",
  "term",
  "phonetic",
  "partOfSpeech",
  "meaningVI",
  "exampleSentenceEN",
  "exampleTranslationVI",
  "clusterTitle",
  "clusterSlug",
  "careerLevel",
  "relatedTerms",
] as const;

const KNOWN_CSV_HEADER_KEYS = new Set([
  "id",
  "term",
  "word",
  "vocabulary",
  "title",
  "phonetic",
  "ipa",
  "pronunciation",
  "partofspeech",
  "part_of_speech",
  "pos",
  "type",
  "meaningvi",
  "meaning_vi",
  "vietnamesemeaning",
  "vietnamese_meaning",
  "meaning",
  "definition_vi",
  "definition",
  "examplesentenceen",
  "example_sentence_en",
  "example_en",
  "examplesentence",
  "example",
  "samplesentence",
  "exampletranslationvi",
  "example_translation_vi",
  "example_vi",
  "exampletranslation",
  "translation_vi",
  "translation",
  "clustertitle",
  "cluster_title",
  "category",
  "topic",
  "cluster",
  "group",
  "clusterslug",
  "cluster_slug",
  "careerlevel",
  "career_level",
  "level",
  "relatedterms",
  "related_terms",
  "related",
]);

function csvCell(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function buildVocabularyCsv(items: VocabularyItem[]): string {
  const rows: unknown[][] = [[...CSV_HEADERS]];
  for (const item of items) {
    rows.push([
      item.id,
      item.term,
      item.phonetic,
      item.partOfSpeech,
      item.meaningVI,
      item.exampleSentenceEN,
      item.exampleTranslationVI,
      item.clusterTitle ?? "",
      item.clusterSlug ?? "",
      item.careerLevel ?? "",
      Array.isArray(item.relatedTerms) ? item.relatedTerms.join("; ") : "",
    ]);
  }
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function parseCsvRows(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\r") {
      if (text[i + 1] === "\n") {
        i += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

function parseCsvObjects(input: string): unknown[] {
  const matrix = parseCsvRows(input);
  if (matrix.length === 0) return [];

  const firstRowNormalized = matrix[0].map((h) =>
    h.trim().toLowerCase().replace(/[\s-]+/g, "_")
  );
  const hasHeaderRow = firstRowNormalized.some(
    (h) => KNOWN_CSV_HEADER_KEYS.has(h) || KNOWN_CSV_HEADER_KEYS.has(h.replace(/_/g, ""))
  );

  if (!hasHeaderRow) {
    if (matrix.every((r) => r.length === 1)) {
      return matrix.map((r) => r[0].trim()).filter(Boolean);
    }
    if (matrix.length === 1) {
      return matrix[0].map((c) => c.trim()).filter(Boolean);
    }
    return matrix
      .map((r) => ({
        term: r[0] ?? "",
        phonetic: r[1] ?? "",
        partOfSpeech: r[2] ?? "",
        meaningVI: r[3] ?? "",
        exampleSentenceEN: r[4] ?? "",
        exampleTranslationVI: r[5] ?? "",
        clusterTitle: r[6] ?? "",
      }))
      .filter((obj) => String(obj.term).trim().length > 0);
  }

  if (matrix.length < 2) return [];

  const headers = matrix[0].map((h) => h.trim());
  const records: Record<string, unknown>[] = [];

  for (let i = 1; i < matrix.length; i += 1) {
    const values = matrix[i];
    const obj: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j += 1) {
      const key = headers[j];
      if (!key) continue;
      obj[key] = values[j] ?? "";
    }
    records.push(obj);
  }

  return records;
}

function extractJsonRows(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items;
    if (Array.isArray(obj.vocabulary)) return obj.vocabulary;
    if (Array.isArray(obj.customVocabulary)) return obj.customVocabulary;
    if (Array.isArray(obj.data)) return obj.data;
  }
  return null;
}

async function readStoredOverrides(): Promise<AdminContentOverrides> {
  const sql = getNeonSql();
  if (!sql || !(await ensureSchema())) {
    return createEmptyContentOverrides();
  }
  try {
    const rows = await sql`
      SELECT payload
      FROM speakit_custom_content
      WHERE key = 'main'
      LIMIT 1
    `;
    return normalizeContentOverrides(rows[0]?.payload);
  } catch {
    return createEmptyContentOverrides();
  }
}

async function getEffectiveVocabulary(): Promise<VocabularyItem[]> {
  const [overrides, dbItems] = await Promise.all([
    readStoredOverrides(),
    listDbVocabularyItems(),
  ]);
  const mergedBase = mergeVocabulary(VOCABULARY_LIST, overrides);
  const byTerm = new Map<string, VocabularyItem>();

  for (const item of mergedBase) {
    const key = canonicalVocabularyTermKey(item.term);
    if (key) {
      byTerm.set(key, item);
    }
  }
  for (const item of dbItems) {
    const key = canonicalVocabularyTermKey(item.term);
    if (key) {
      byTerm.set(key, item);
    }
  }

  return Array.from(byTerm.values());
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized admin session." },
      { status: 401 }
    );
  }

  const formatParam = req.nextUrl.searchParams.get("format")?.toLowerCase();
  const format = formatParam === "csv" ? "csv" : "json";
  const items = await getEffectiveVocabulary();

  if (format === "csv") {
    const csv = buildVocabularyCsv(items);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="speakit-vocabulary.csv"',
        "Cache-Control": "no-store",
      },
    });
  }

  return new NextResponse(JSON.stringify(items, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="speakit-vocabulary.json"',
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized admin session." },
      { status: 401 }
    );
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { ok: false, error: "Request body must be an object or array." },
      { status: 400 }
    );
  }

  let rawRows: unknown[] = [];

  if (Array.isArray(body)) {
    rawRows = body;
  } else {
    const payload = body as {
      format?: unknown;
      data?: unknown;
      items?: unknown;
      vocabulary?: unknown;
      customVocabulary?: unknown;
    };

    const directWrapped =
      payload.format === undefined ? extractJsonRows(payload) : null;

    if (directWrapped) {
      rawRows = directWrapped;
    } else {
      const format =
        payload.format === "csv"
          ? "csv"
          : payload.format === "json"
            ? "json"
            : null;
      if (!format) {
        return NextResponse.json(
          { ok: false, error: "Invalid format. Expected 'json' or 'csv'." },
          { status: 400 }
        );
      }

      if (format === "json") {
        let parsed: unknown = payload.data;
        if (typeof parsed === "string") {
          try {
            parsed = JSON.parse(parsed);
          } catch {
            return NextResponse.json(
              { ok: false, error: "Invalid JSON data string." },
              { status: 400 }
            );
          }
        }
        const extracted = extractJsonRows(parsed);
        if (!extracted) {
          return NextResponse.json(
            { ok: false, error: "JSON data must be an array of vocabulary items." },
            { status: 400 }
          );
        }
        rawRows = extracted;
      } else {
        if (typeof payload.data !== "string") {
          return NextResponse.json(
            { ok: false, error: "CSV data must be a string." },
            { status: 400 }
          );
        }
        rawRows = parseCsvObjects(payload.data);
      }
    }
  }

  const sql = getNeonSql();
  if (!sql || !(await ensureSchema())) {
    return NextResponse.json(
      { ok: false, error: "Neon Postgres database is not configured." },
      { status: 503 }
    );
  }

  const total = rawRows.length;
  const {
    importedCount,
    aiRepairedCount,
    skippedDuplicatesCount,
    skippedTerms,
  } = await importVocabularyItemsSkipDuplicates(rawRows, "Tùy chỉnh");
  const overrides = await readStoredOverrides();

  return NextResponse.json({
    ok: true,
    importedCount,
    aiRepairedCount,
    skippedDuplicatesCount,
    skippedTerms,
    inserted: importedCount,
    updated: 0,
    skipped: skippedDuplicatesCount,
    total,
    overrides,
  });
}

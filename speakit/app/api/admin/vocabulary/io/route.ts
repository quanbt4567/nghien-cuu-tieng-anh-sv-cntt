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
  listDbVocabularyItems,
  upsertVocabularyItems,
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

function parseCsvObjects(input: string): Record<string, unknown>[] {
  const matrix = parseCsvRows(input);
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

function parseRelatedTerms(raw: unknown): string[] | undefined {
  if (Array.isArray(raw)) {
    const list = raw
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim())
      .filter(Boolean);
    return list.length > 0 ? list : undefined;
  }
  if (typeof raw === "string" && raw.trim()) {
    const list = raw
      .split(/[;|]/)
      .map((x) => x.trim())
      .filter(Boolean);
    return list.length > 0 ? list : undefined;
  }
  return undefined;
}

function normalizeCareerLevel(
  value: unknown
): "Fresher" | "Junior" | "Senior" | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed === "Fresher" || trimmed === "Junior" || trimmed === "Senior") {
    return trimmed;
  }
  return undefined;
}

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

function toVocabularyItem(raw: unknown): VocabularyItem | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const term = typeof r.term === "string" ? r.term.trim() : "";
  if (!term) return null;

  const id =
    typeof r.id === "string" && r.id.trim()
      ? r.id.trim()
      : `vocab-${slugifyTerm(term)}`;
  const clusterTitle =
    typeof r.clusterTitle === "string" && r.clusterTitle.trim()
      ? r.clusterTitle.trim()
      : undefined;
  const clusterSlug =
    typeof r.clusterSlug === "string" && r.clusterSlug.trim()
      ? r.clusterSlug.trim()
      : clusterTitle
      ? slugifyTerm(clusterTitle)
      : undefined;
  const careerLevel = normalizeCareerLevel(r.careerLevel);
  const relatedTerms = parseRelatedTerms(r.relatedTerms);

  return {
    id,
    term,
    phonetic: typeof r.phonetic === "string" ? r.phonetic.trim() : "",
    partOfSpeech:
      typeof r.partOfSpeech === "string" && r.partOfSpeech.trim()
        ? r.partOfSpeech.trim()
        : "noun",
    meaningVI: typeof r.meaningVI === "string" ? r.meaningVI.trim() : "",
    exampleSentenceEN:
      typeof r.exampleSentenceEN === "string" ? r.exampleSentenceEN.trim() : "",
    exampleTranslationVI:
      typeof r.exampleTranslationVI === "string"
        ? r.exampleTranslationVI.trim()
        : "",
    ...(clusterTitle ? { clusterTitle } : {}),
    ...(clusterSlug ? { clusterSlug } : {}),
    ...(careerLevel ? { careerLevel } : {}),
    ...(relatedTerms ? { relatedTerms } : {}),
  };
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
    const key = item.term.trim().toLowerCase();
    if (key) {
      byTerm.set(key, item);
    }
  }
  for (const item of dbItems) {
    const key = item.term.trim().toLowerCase();
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

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { ok: false, error: "Request body must be an object." },
      { status: 400 }
    );
  }

  const payload = body as { format?: unknown; data?: unknown };
  const format = payload.format === "csv" ? "csv" : payload.format === "json" ? "json" : null;
  if (!format) {
    return NextResponse.json(
      { ok: false, error: "Invalid format. Expected 'json' or 'csv'." },
      { status: 400 }
    );
  }

  let rawRows: unknown[] = [];
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
    if (Array.isArray(parsed)) {
      rawRows = parsed;
    } else if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj.items)) {
        rawRows = obj.items;
      } else if (Array.isArray(obj.vocabulary)) {
        rawRows = obj.vocabulary;
      } else if (Array.isArray(obj.customVocabulary)) {
        rawRows = obj.customVocabulary;
      } else {
        return NextResponse.json(
          { ok: false, error: "JSON data must be an array of vocabulary items." },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { ok: false, error: "JSON data must be an array of vocabulary items." },
        { status: 400 }
      );
    }
  } else {
    if (typeof payload.data !== "string") {
      return NextResponse.json(
        { ok: false, error: "CSV data must be a string." },
        { status: 400 }
      );
    }
    rawRows = parseCsvObjects(payload.data);
  }

  const sql = getNeonSql();
  if (!sql || !(await ensureSchema())) {
    return NextResponse.json(
      { ok: false, error: "Neon Postgres database is not configured." },
      { status: 503 }
    );
  }

  const total = rawRows.length;
  const deduped = new Map<string, VocabularyItem>();
  let skipped = 0;

  for (const row of rawRows) {
    const item = toVocabularyItem(row);
    if (!item) {
      skipped += 1;
      continue;
    }
    const key = item.term.toLowerCase();
    if (deduped.has(key)) {
      skipped += 1;
      continue;
    }
    deduped.set(key, item);
  }

  const validItems = Array.from(deduped.values());
  const existingItems = await getEffectiveVocabulary();
  const existingTerms = new Set(
    existingItems.map((item) => item.term.trim().toLowerCase())
  );

  let inserted = 0;
  let updated = 0;
  for (const item of validItems) {
    if (existingTerms.has(item.term.toLowerCase())) {
      updated += 1;
    } else {
      inserted += 1;
    }
  }

  if (validItems.length > 0) {
    await upsertVocabularyItems(validItems);
  }

  const overrides = await readStoredOverrides();

  return NextResponse.json({
    ok: true,
    inserted,
    updated,
    skipped,
    total,
    overrides,
  });
}

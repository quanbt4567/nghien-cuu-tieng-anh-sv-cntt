import { randomUUID } from "crypto";
import { ensureGuestDatabaseReady, getDbClient } from "./db";
import {
  EF_EPI_2025_SEED_ARTICLE,
  type ResearchArticle,
  type ResearchCategory,
  type ResearchMetricItem,
  type ResearchSourceType,
  type ResearchSourceUrl,
  type ResearchStatus,
} from "./db/schema";

export type {
  ResearchArticle,
  ResearchCategory,
  ResearchMetricItem,
  ResearchSourceType,
  ResearchSourceUrl,
  ResearchStatus,
};

export interface UpsertResearchArticleInput {
  id?: string;
  slug?: string;
  title: string;
  summary: string;
  contentMarkdown: string;
  category: ResearchCategory;
  metricsJson?: ResearchMetricItem[];
  sourceType?: ResearchSourceType;
  sourceUrls?: ResearchSourceUrl[];
  status?: ResearchStatus;
}

export const DEFAULT_RESEARCH_ARTICLES: ResearchArticle[] = [
  {
    ...EF_EPI_2025_SEED_ARTICLE,
    createdAt: "2025-11-01T00:00:00.000Z",
    publishedAt: "2025-11-01T00:00:00.000Z",
  },
];

export function slugifyResearchTitle(title: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return base || `research-${Date.now().toString(36)}`;
}

export function normalizeResearchCategory(raw: unknown): ResearchCategory {
  if (
    raw === "benchmark" ||
    raw === "hr_interview" ||
    raw === "tech_news" ||
    raw === "case_study"
  ) {
    return raw;
  }
  return "tech_news";
}

export function normalizeResearchStatus(raw: unknown): ResearchStatus {
  if (raw === "pending_review" || raw === "published" || raw === "archived") {
    return raw;
  }
  return "pending_review";
}

export function normalizeResearchMetrics(raw: unknown): ResearchMetricItem[] {
  if (!Array.isArray(raw)) return [];
  const result: ResearchMetricItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const label = typeof obj.label === "string" ? obj.label.trim().slice(0, 100) : "";
    const value = typeof obj.value === "string" ? obj.value.trim().slice(0, 60) : "";
    const highlight =
      typeof obj.highlight === "string" && obj.highlight.trim()
        ? obj.highlight.trim().slice(0, 100)
        : undefined;
    if (label && value) {
      result.push(highlight ? { label, value, highlight } : { label, value });
    }
    if (result.length >= 8) break;
  }
  return result;
}

export function normalizeResearchSources(raw: unknown): ResearchSourceUrl[] {
  if (!Array.isArray(raw)) return [];
  const result: ResearchSourceUrl[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const title = typeof obj.title === "string" ? obj.title.trim().slice(0, 160) : "";
    const url = typeof obj.url === "string" ? obj.url.trim().slice(0, 500) : "";
    if (title && /^https?:\/\//i.test(url)) {
      result.push({ title, url });
    }
    if (result.length >= 10) break;
  }
  return result;
}

function parseJsonArray<T>(value: unknown, parser: (raw: unknown) => T[]): T[] {
  if (Array.isArray(value)) return parser(value);
  if (typeof value === "string") {
    try {
      return parser(JSON.parse(value));
    } catch {
      return [];
    }
  }
  return [];
}

function toIsoOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.trim()) return value;
  return null;
}

const EF_EPI_2025_REPORT_PDF_URL =
  "https://www.ef.com/__/~/media/centralefcom/epi/v12/downloads/full-reports/ef-epi-2025-english.pdf";

function normalizeSeedArticleSources(
  slug: string,
  sourceUrls: ResearchSourceUrl[]
): ResearchSourceUrl[] {
  if (slug !== EF_EPI_2025_SEED_ARTICLE.slug) return sourceUrls;
  return sourceUrls.map((src) =>
    src.url === "https://www.ef.com/wwen/epi/" ||
    src.url === "https://www.ef.com/wwen/epi/regions/asia/vietnam/"
      ? { ...src, url: EF_EPI_2025_REPORT_PDF_URL }
      : src
  );
}

function mapArticleRow(row: Record<string, unknown>): ResearchArticle {
  const slug = String(row.slug);
  return {
    id: String(row.id),
    slug,
    title: String(row.title),
    summary: String(row.summary),
    contentMarkdown: String(row.content_markdown),
    category: normalizeResearchCategory(row.category),
    metricsJson: parseJsonArray(row.metrics_json, normalizeResearchMetrics),
    sourceType:
      row.source_type === "ai_curated" ? "ai_curated" : "admin_authored",
    sourceUrls: normalizeSeedArticleSources(
      slug,
      parseJsonArray(row.source_urls, normalizeResearchSources)
    ),
    status: normalizeResearchStatus(row.status),
    createdAt: toIsoOrNull(row.created_at) ?? new Date().toISOString(),
    publishedAt: toIsoOrNull(row.published_at),
  };
}

export async function getPublishedArticles(
  category?: ResearchCategory
): Promise<ResearchArticle[]> {
  const ready = await ensureGuestDatabaseReady();
  const sql = getDbClient();
  if (!ready || !sql) {
    return category
      ? DEFAULT_RESEARCH_ARTICLES.filter((a) => a.category === category)
      : DEFAULT_RESEARCH_ARTICLES;
  }

  try {
    const rows = category
      ? await sql`
          SELECT id, slug, title, summary, content_markdown, category, metrics_json, source_type, source_urls, status, created_at, published_at
          FROM research_articles
          WHERE status = 'published' AND category = ${category}
          ORDER BY COALESCE(published_at, created_at) DESC
          LIMIT 50
        `
      : await sql`
          SELECT id, slug, title, summary, content_markdown, category, metrics_json, source_type, source_urls, status, created_at, published_at
          FROM research_articles
          WHERE status = 'published'
          ORDER BY COALESCE(published_at, created_at) DESC
          LIMIT 50
        `;
    return rows.map((row) => mapArticleRow(row as Record<string, unknown>));
  } catch (err) {
    console.error("[research] getPublishedArticles failed:", err);
    return category
      ? DEFAULT_RESEARCH_ARTICLES.filter((a) => a.category === category)
      : DEFAULT_RESEARCH_ARTICLES;
  }
}

export async function getArticleBySlug(
  slug: string
): Promise<ResearchArticle | null> {
  const cleanSlug = slug.trim();
  if (!cleanSlug) return null;

  const ready = await ensureGuestDatabaseReady();
  const sql = getDbClient();
  if (!ready || !sql) {
    return (
      DEFAULT_RESEARCH_ARTICLES.find((a) => a.slug === cleanSlug) ?? null
    );
  }

  try {
    const rows = await sql`
      SELECT id, slug, title, summary, content_markdown, category, metrics_json, source_type, source_urls, status, created_at, published_at
      FROM research_articles
      WHERE slug = ${cleanSlug} AND status = 'published'
      LIMIT 1
    `;
    if (rows.length === 0) {
      return null;
    }
    return mapArticleRow(rows[0] as Record<string, unknown>);
  } catch (err) {
    console.error("[research] getArticleBySlug failed:", err);
    return (
      DEFAULT_RESEARCH_ARTICLES.find((a) => a.slug === cleanSlug) ?? null
    );
  }
}

export async function getAllAdminArticles(): Promise<ResearchArticle[]> {
  const ready = await ensureGuestDatabaseReady();
  const sql = getDbClient();
  if (!ready || !sql) {
    return DEFAULT_RESEARCH_ARTICLES;
  }

  try {
    const rows = await sql`
      SELECT id, slug, title, summary, content_markdown, category, metrics_json, source_type, source_urls, status, created_at, published_at
      FROM research_articles
      ORDER BY
        CASE status
          WHEN 'pending_review' THEN 0
          WHEN 'published' THEN 1
          ELSE 2
        END ASC,
        created_at DESC
      LIMIT 100
    `;
    return rows.map((row) => mapArticleRow(row as Record<string, unknown>));
  } catch (err) {
    console.error("[research] getAllAdminArticles failed:", err);
    return DEFAULT_RESEARCH_ARTICLES;
  }
}

export async function upsertArticle(
  data: UpsertResearchArticleInput
): Promise<ResearchArticle | null> {
  const ready = await ensureGuestDatabaseReady();
  const sql = getDbClient();
  if (!ready || !sql) return null;

  const id =
    typeof data.id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.id.trim())
      ? data.id.trim()
      : randomUUID();
  const title = data.title.trim().slice(0, 300);
  const summary = data.summary.trim().slice(0, 1000);
  const contentMarkdown = data.contentMarkdown.trim().slice(0, 20000);
  const category = normalizeResearchCategory(data.category);
  const metricsJson = normalizeResearchMetrics(data.metricsJson ?? []);
  const sourceType: ResearchSourceType =
    data.sourceType === "ai_curated" ? "ai_curated" : "admin_authored";
  const sourceUrls = normalizeResearchSources(data.sourceUrls ?? []);
  const status = normalizeResearchStatus(data.status ?? "pending_review");
  const baseSlug = slugifyResearchTitle(data.slug?.trim() || title);
  const slug = data.id
    ? baseSlug.slice(0, 160)
    : `${baseSlug.slice(0, 148)}-${id.slice(0, 8)}`;

  if (!title || !summary || !contentMarkdown) {
    return null;
  }

  try {
    const rows = await sql`
      INSERT INTO research_articles (
        id,
        slug,
        title,
        summary,
        content_markdown,
        category,
        metrics_json,
        source_type,
        source_urls,
        status,
        published_at
      )
      VALUES (
        ${id}::uuid,
        ${slug},
        ${title},
        ${summary},
        ${contentMarkdown},
        ${category},
        ${JSON.stringify(metricsJson)}::jsonb,
        ${sourceType},
        ${JSON.stringify(sourceUrls)}::jsonb,
        ${status},
        ${status === "published" ? new Date().toISOString() : null}
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        summary = EXCLUDED.summary,
        content_markdown = EXCLUDED.content_markdown,
        category = EXCLUDED.category,
        metrics_json = EXCLUDED.metrics_json,
        source_urls = EXCLUDED.source_urls,
        status = EXCLUDED.status,
        published_at = CASE
          WHEN EXCLUDED.status = 'published' AND research_articles.published_at IS NULL THEN NOW()
          ELSE research_articles.published_at
        END
      RETURNING id, slug, title, summary, content_markdown, category, metrics_json, source_type, source_urls, status, created_at, published_at
    `;
    if (rows.length === 0) return null;
    return mapArticleRow(rows[0] as Record<string, unknown>);
  } catch (err) {
    console.error("[research] upsertArticle failed:", err);
    return null;
  }
}

export async function updateArticleStatus(
  id: string,
  status: ResearchStatus
): Promise<boolean> {
  const ready = await ensureGuestDatabaseReady();
  const sql = getDbClient();
  if (!ready || !sql) return false;

  const normalized = normalizeResearchStatus(status);
  try {
    const rows = await sql`
      UPDATE research_articles
      SET
        status = ${normalized},
        published_at = CASE
          WHEN ${normalized} = 'published' AND published_at IS NULL THEN NOW()
          ELSE published_at
        END
      WHERE id = ${id}::uuid
      RETURNING id
    `;
    return rows.length > 0;
  } catch (err) {
    console.error("[research] updateArticleStatus failed:", err);
    return false;
  }
}

export async function deleteArticle(id: string): Promise<boolean> {
  const ready = await ensureGuestDatabaseReady();
  const sql = getDbClient();
  if (!ready || !sql) return false;

  try {
    const rows = await sql`
      DELETE FROM research_articles
      WHERE id = ${id}::uuid
      RETURNING id
    `;
    return rows.length > 0;
  } catch (err) {
    console.error("[research] deleteArticle failed:", err);
    return false;
  }
}

import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../../../lib/adminAuth";
import { extractDeleteIdsFromPayload } from "../../../../lib/adminBulkDelete";
import {
  deleteArticles,
  getAllAdminArticles,
  normalizeResearchCategory,
  normalizeResearchCoverImageUrl,
  normalizeResearchMetrics,
  normalizeResearchSources,
  normalizeResearchStatus,
  updateArticleStatus,
  upsertArticle,
} from "../../../../lib/research";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const articles = await getAllAdminArticles();
  return NextResponse.json({ ok: true, articles });
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const summary = typeof body.summary === "string" ? body.summary.trim() : "";
  const contentMarkdown =
    typeof body.contentMarkdown === "string" ? body.contentMarkdown.trim() : "";

  if (!title || !summary || !contentMarkdown) {
    return NextResponse.json(
      { ok: false, error: "Title, summary, and contentMarkdown are required." },
      { status: 400 }
    );
  }

  const saved = await upsertArticle({
    id: typeof body.id === "string" ? body.id : undefined,
    slug: typeof body.slug === "string" ? body.slug : undefined,
    title,
    summary,
    contentMarkdown,
    coverImageUrl: normalizeResearchCoverImageUrl(body.coverImageUrl),
    category: normalizeResearchCategory(body.category),
    metricsJson: normalizeResearchMetrics(body.metricsJson),
    sourceType: body.sourceType === "ai_curated" ? "ai_curated" : "admin_authored",
    sourceUrls: normalizeResearchSources(body.sourceUrls),
    status: normalizeResearchStatus(body.status ?? "published"),
  });

  if (!saved) {
    return NextResponse.json(
      { ok: false, error: "Database unavailable or failed to save article." },
      { status: 500 }
    );
  }

  revalidatePath("/research");
  revalidatePath("/research/[slug]", "page");
  revalidatePath(`/research/${saved.slug}`);

  return NextResponse.json({ ok: true, article: saved });
}

export async function PATCH(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ ok: false, error: "Article ID is required." }, { status: 400 });
  }

  const updated = await updateArticleStatus(id, normalizeResearchStatus(body.status));
  if (!updated) {
    return NextResponse.json(
      { ok: false, error: "Failed to update article status." },
      { status: 500 }
    );
  }

  revalidatePath("/research");
  revalidatePath("/research/[slug]", "page");

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const ids = extractDeleteIdsFromPayload(req.nextUrl.searchParams, body);
  if (ids.length === 0) {
    return NextResponse.json({ ok: false, error: "Article ID is required." }, { status: 400 });
  }

  const deletedIds = await deleteArticles(ids);
  if (deletedIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Failed to delete article." },
      { status: 500 }
    );
  }

  revalidatePath("/research");
  revalidatePath("/research/[slug]", "page");

  return NextResponse.json({
    ok: true,
    deletedIds,
    deletedCount: deletedIds.length,
  });
}

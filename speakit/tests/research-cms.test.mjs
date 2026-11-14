import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const jiti = require("jiti")(__filename);

const {
  DEFAULT_RESEARCH_ARTICLES,
  slugifyResearchTitle,
  normalizeResearchCategory,
  normalizeResearchMetrics,
  normalizeResearchSources,
  getPublishedArticles,
  getArticleBySlug,
} = jiti(resolve(__dirname, "../lib/research.ts"));

const { GET: adminResearchGet } = jiti(resolve(__dirname, "../app/api/admin/research/route.ts"));
const { POST: adminResearchGeneratePost } = jiti(
  resolve(__dirname, "../app/api/admin/research/generate/route.ts")
);

test("DEFAULT_RESEARCH_ARTICLES seeds EF EPI 2025 benchmark without IUH attribution", () => {
  assert.equal(DEFAULT_RESEARCH_ARTICLES.length >= 1, true);
  const seed = DEFAULT_RESEARCH_ARTICLES[0];
  assert.equal(seed.slug, "ef-epi-2025-vietnam-it-speaking-benchmark");
  assert.equal(seed.category, "benchmark");
  assert.equal(seed.status, "published");
  assert.equal(seed.metricsJson.some((m) => m.value === "500"), true);
  assert.equal(seed.metricsJson.some((m) => m.value === "461"), true);
  assert.equal(seed.contentMarkdown.includes("IUH"), false);
});

test("slugifyResearchTitle and normalizers sanitize Vietnamese titles, metrics, and URLs", () => {
  assert.equal(
    slugifyResearchTitle("Phỏng vấn IT Tiếng Anh 2026!"),
    "phong-van-it-tieng-anh-2026"
  );
  assert.equal(normalizeResearchCategory("invalid"), "tech_news");
  assert.equal(normalizeResearchCategory("hr_interview"), "hr_interview");

  const metrics = normalizeResearchMetrics([
    { label: "Speaking", value: "461", highlight: "Weakest" },
    { label: "", value: "100" },
  ]);
  assert.equal(metrics.length, 1);
  assert.equal(metrics[0].label, "Speaking");

  const sources = normalizeResearchSources([
    { title: "Valid", url: "https://news.ycombinator.com" },
    { title: "Invalid", url: "javascript:alert(1)" },
  ]);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].title, "Valid");
});

test("getPublishedArticles and getArticleBySlug fall back gracefully without DATABASE_URL", async () => {
  const prevUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const all = await getPublishedArticles();
    assert.equal(all.length >= 1, true);
    const found = await getArticleBySlug("ef-epi-2025-vietnam-it-speaking-benchmark");
    assert.ok(found);
    assert.equal(found.category, "benchmark");
    const missing = await getArticleBySlug("non-existent-slug");
    assert.equal(missing, null);
  } finally {
    if (prevUrl !== undefined) process.env.DATABASE_URL = prevUrl;
  }
});

test("admin research endpoints reject unauthenticated requests with 401", async () => {
  const { NextRequest } = require("next/server");
  const getRes = await adminResearchGet(new NextRequest("http://localhost:3000/api/admin/research"));
  assert.equal(getRes.status, 401);

  const postRes = await adminResearchGeneratePost(
    new NextRequest("http://localhost:3000/api/admin/research/generate", {
      method: "POST",
      body: JSON.stringify({ topic: "tech_news" }),
    })
  );
  assert.equal(postRes.status, 401);
});

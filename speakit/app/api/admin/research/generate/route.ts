import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../../../../lib/adminAuth";
import {
  extractFirstJsonObject,
  requestAiWaterfallText,
} from "../../../../../lib/ai-waterfall";
import {
  getAllAdminArticles,
  normalizeResearchCategory,
  normalizeResearchMetrics,
  normalizeResearchSources,
  upsertArticle,
  type ResearchCategory,
} from "../../../../../lib/research";
import {
  buildDiverseFallbackSynthesis,
  CATEGORY_FEED_SPECS,
  ensureUniqueHeadline,
  parseFeedXml,
  selectFreshDiverseSources,
  type FetchedSourceItem,
} from "../../../../../lib/research-sources";

export const dynamic = "force-dynamic";

async function fetchJsonWithTimeout<T>(
  url: string,
  init?: RequestInit,
  timeoutMs = 4000
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "User-Agent": "SpeakIT-Research-Curator/1.0",
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTextWithTimeout(
  url: string,
  timeoutMs = 4500
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "SpeakIT-Research-Curator/1.0",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRssFeedSources(
  provider: string,
  feedUrl: string,
  limit = 5
): Promise<FetchedSourceItem[]> {
  const xml = await fetchTextWithTimeout(feedUrl);
  if (!xml) return [];
  return parseFeedXml(xml, provider, limit);
}

async function fetchLobstersSources(limit = 5): Promise<FetchedSourceItem[]> {
  const stories = await fetchJsonWithTimeout<
    Array<{
      title?: string;
      url?: string;
      score?: number;
      tags?: string[];
      comments_url?: string;
    }>
  >("https://lobste.rs/hottest.json");

  if (!Array.isArray(stories)) return [];

  const results: FetchedSourceItem[] = [];
  for (const s of stories) {
    const targetUrl = s.url?.trim() || s.comments_url?.trim() || "";
    if (!s.title || !/^https?:\/\//i.test(targetUrl)) continue;
    const tagStr = Array.isArray(s.tags) && s.tags.length > 0 ? s.tags.join(", ") : "engineering";
    results.push({
      title: s.title.trim(),
      url: targetUrl,
      excerpt: `Lobsters [${tagStr}] (score: ${s.score ?? 0})`,
      provider: "Lobsters",
    });
    if (results.length >= limit) break;
  }
  return results;
}

async function fetchHackerNewsSources(
  offset = 0,
  limit = 5
): Promise<FetchedSourceItem[]> {
  const topIds = await fetchJsonWithTimeout<number[]>(
    "https://hacker-news.firebaseio.com/v0/topstories.json"
  );
  if (!Array.isArray(topIds) || topIds.length === 0) return [];

  const start = offset % Math.max(1, Math.min(30, topIds.length));
  const sliceIds = topIds.slice(start, start + 12);
  const items = await Promise.all(
    sliceIds.map((id) =>
      fetchJsonWithTimeout<{ title?: string; url?: string; score?: number }>(
        `https://hacker-news.firebaseio.com/v0/item/${id}.json`
      )
    )
  );

  const results: FetchedSourceItem[] = [];
  for (const item of items) {
    if (!item || typeof item.title !== "string" || typeof item.url !== "string") {
      continue;
    }
    if (!/^https?:\/\//i.test(item.url)) continue;
    results.push({
      title: item.title.trim(),
      url: item.url.trim(),
      excerpt: `HackerNews story (score: ${item.score ?? 0})`,
      provider: "HackerNews",
    });
    if (results.length >= limit) break;
  }
  return results;
}

async function fetchDevToSources(tag: string, limit = 5): Promise<FetchedSourceItem[]> {
  const articles = await fetchJsonWithTimeout<
    Array<{
      title?: string;
      url?: string;
      description?: string;
      public_reactions_count?: number;
    }>
  >(`https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&top=30&per_page=${limit}`);

  if (!Array.isArray(articles)) return [];

  return articles
    .filter((a) => typeof a.title === "string" && typeof a.url === "string")
    .slice(0, limit)
    .map((a) => ({
      title: a.title!.trim(),
      url: a.url!.trim(),
      excerpt: `${a.description?.trim() ?? ""} (reactions: ${a.public_reactions_count ?? 0})`.trim(),
      provider: "Dev.to",
    }));
}

async function fetchTavilySources(query: string): Promise<FetchedSourceItem[]> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) return [];

  const data = await fetchJsonWithTimeout<{
    results?: Array<{ title?: string; url?: string; content?: string }>;
  }>("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: 4,
      search_depth: "basic",
    }),
  });

  if (!Array.isArray(data?.results)) return [];

  return data.results
    .filter((r) => typeof r.title === "string" && typeof r.url === "string")
    .map((r) => ({
      title: r.title!.trim(),
      url: r.url!.trim(),
      excerpt: (r.content ?? "").trim().slice(0, 220),
      provider: "Tavily",
    }));
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
  }

  const category: ResearchCategory = normalizeResearchCategory(body.topic ?? body.category);
  const config = CATEGORY_FEED_SPECS[category];
  const existingArticles = await getAllAdminArticles();
  const existingTitles = existingArticles.map((a) => a.title);

  const rotatedTag =
    config.devToTags[existingArticles.length % config.devToTags.length];
  const hnOffset = (existingArticles.length * 6) % 24;

  const [rssBatches, lobstersSources, hnSources, devToSources, tavilySources] =
    await Promise.all([
      Promise.all(
        config.rssFeeds.map((feed) => fetchRssFeedSources(feed.provider, feed.url, 5))
      ),
      config.includeLobsters ? fetchLobstersSources(5) : Promise.resolve([]),
      fetchHackerNewsSources(hnOffset, 5),
      fetchDevToSources(rotatedTag, 5),
      fetchTavilySources(config.tavilyQuery),
    ]);

  const rawCandidates: FetchedSourceItem[] = [
    ...rssBatches.flat(),
    ...lobstersSources,
    ...tavilySources,
    ...hnSources,
    ...devToSources,
  ];

  const allSources = selectFreshDiverseSources(rawCandidates, existingArticles, 8);
  const verifiedSourceUrls = normalizeResearchSources(
    allSources.map((s) => ({ title: `${s.provider}: ${s.title}`, url: s.url }))
  );

  let synthesized = buildDiverseFallbackSynthesis(
    category,
    allSources,
    existingTitles
  );

  if (allSources.length > 0) {
    const sourcesContext = allSources
      .map((s, idx) => `${idx + 1}. [${s.provider}] ${s.title} (${s.url}) - ${s.excerpt}`)
      .join("\n");

    const avoidTitlesBlock =
      existingTitles.length > 0
        ? `\nExisting article titles you MUST NOT repeat or closely paraphrase:\n${existingTitles
            .slice(0, 15)
            .map((t) => `- ${t}`)
            .join("\n")}\n`
        : "";

    const prompt = `You are a bilingual Vietnamese-English IT career & engineering communication researcher for SpeakIT.
Synthesize the following real fetched tech/career sources into ONE fresh, distinctive Vietnamese research article with English technical terms for Vietnamese IT students & developers.

Topic Category: ${category} (${config.label})
${avoidTitlesBlock}
Fetched Sources:
${sourcesContext}

Requirements:
- Write a SPECIFIC, angle-driven Vietnamese headline mentioning the key technology/trend/finding from the fetched sources (NEVER use a generic headline like "Tổng hợp xu hướng ... cho kỹ sư CNTT").
- Reference insights across multiple providers above.
- Include practical IT English speaking takeaways (vocabulary, interview phrasing, standup/review sentences).

Return ONLY valid JSON with this exact shape:
{
  "title": "Specific Vietnamese editorial headline (max 140 chars)",
  "summary": "2-sentence Vietnamese executive summary for readers mentioning the concrete insights (max 320 chars, no internal CMS/drafting labels)",
  "contentMarkdown": "Well-structured Markdown in Vietnamese using ## headings and bullet points, incorporating real insights from the sources and practical IT English speaking takeaways",
  "metricsJson": []
}

For "metricsJson": ONLY include metric objects ({ "label": "Short metric label in Vietnamese", "value": "Concise number/stat", "highlight": "Short note" }) if the fetched sources contain real concrete numbers or benchmarks; otherwise return "metricsJson": [].`;

    const aiResult = await requestAiWaterfallText({
      systemInstruction: "Return strictly valid JSON only without markdown fences.",
      userPrompt: prompt,
      temperature: 0.65,
      maxTokens: 1300,
      jsonMode: true,
    });

    if (aiResult?.text) {
      const parsed = extractFirstJsonObject(aiResult.text);
      if (
        parsed &&
        typeof parsed.title === "string" &&
        typeof parsed.summary === "string" &&
        typeof parsed.contentMarkdown === "string"
      ) {
        const metrics = normalizeResearchMetrics(parsed.metricsJson);
        synthesized = {
          title: ensureUniqueHeadline(parsed.title, existingTitles, allSources[0]),
          summary: parsed.summary.trim(),
          contentMarkdown: parsed.contentMarkdown.trim(),
          metricsJson:
            metrics.length > 0 ? metrics : synthesized.metricsJson,
          sourceUrls: verifiedSourceUrls,
        };
      }
    }
  }

  const saved = await upsertArticle({
    title: synthesized.title,
    summary: synthesized.summary,
    contentMarkdown: synthesized.contentMarkdown,
    category,
    metricsJson: synthesized.metricsJson,
    sourceType: "ai_curated",
    sourceUrls: synthesized.sourceUrls,
    status: "pending_review",
  });

  if (!saved) {
    return NextResponse.json(
      { ok: false, error: "Could not save AI draft to database." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    article: saved,
    fetchedSourceCount: allSources.length,
  });
}

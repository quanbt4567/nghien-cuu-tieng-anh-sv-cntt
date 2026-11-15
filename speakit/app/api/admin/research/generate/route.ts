import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../../../../lib/adminAuth";
import {
  extractFirstJsonObject,
  requestAiWaterfallText,
} from "../../../../../lib/ai-waterfall";
import {
  normalizeResearchCategory,
  normalizeResearchMetrics,
  normalizeResearchSources,
  upsertArticle,
  type ResearchCategory,
  type ResearchMetricItem,
  type ResearchSourceUrl,
} from "../../../../../lib/research";

export const dynamic = "force-dynamic";

interface FetchedSourceItem {
  title: string;
  url: string;
  excerpt: string;
  provider: string;
}

const TOPIC_CONFIG: Record<
  ResearchCategory,
  { label: string; devToTag: string; tavilyQuery: string }
> = {
  hr_interview: {
    label: "HR Interview Trends",
    devToTag: "career",
    tavilyQuery: "software engineer technical interview english communication trends 2025 2026",
  },
  tech_news: {
    label: "Tech & AI News",
    devToTag: "ai",
    tavilyQuery: "software engineering AI developer workflow trends 2025 2026",
  },
  benchmark: {
    label: "IT English Benchmarks",
    devToTag: "productivity",
    tavilyQuery: "english proficiency IT outsourcing software developer communication report",
  },
  case_study: {
    label: "Case Study",
    devToTag: "webdev",
    tavilyQuery: "remote software team communication standup code review case study",
  },
};

async function fetchJsonWithTimeout<T>(
  url: string,
  init?: RequestInit,
  timeoutMs = 3500
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHackerNewsSources(limit = 4): Promise<FetchedSourceItem[]> {
  const topIds = await fetchJsonWithTimeout<number[]>(
    "https://hacker-news.firebaseio.com/v0/topstories.json"
  );
  if (!Array.isArray(topIds) || topIds.length === 0) return [];

  const items = await Promise.all(
    topIds.slice(0, 8).map((id) =>
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
      excerpt: `HackerNews top story (score: ${item.score ?? 0})`,
      provider: "HackerNews",
    });
    if (results.length >= limit) break;
  }
  return results;
}

async function fetchDevToSources(tag: string, limit = 4): Promise<FetchedSourceItem[]> {
  const articles = await fetchJsonWithTimeout<
    Array<{
      title?: string;
      url?: string;
      description?: string;
      public_reactions_count?: number;
    }>
  >(`https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&top=7&per_page=${limit}`);

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

function buildFallbackSynthesis(
  category: ResearchCategory,
  sources: FetchedSourceItem[]
): {
  title: string;
  summary: string;
  contentMarkdown: string;
  metricsJson: ResearchMetricItem[];
  sourceUrls: ResearchSourceUrl[];
} {
  const topicLabel = TOPIC_CONFIG[category].label;
  const sourceUrls = normalizeResearchSources(
    sources.map((s) => ({ title: `${s.provider}: ${s.title}`, url: s.url }))
  );

  const bulletLines =
    sources.length > 0
      ? sources
          .slice(0, 5)
          .map((s) => `- **${s.title}** (${s.provider}): ${s.excerpt}`)
          .join("\n")
      : "- Chưa lấy được bài viết trực tuyến mới; quản trị viên có thể bổ sung nội dung trực tiếp.";

  return {
    title: `Tổng hợp xu hướng ${topicLabel} cho kỹ sư CNTT`,
    summary: `Tổng hợp xu hướng ${topicLabel} mới nhất từ HackerNews & Dev.to dành cho sinh viên và kỹ sư CNTT.`,
    contentMarkdown: `## Điểm tin nổi bật (${topicLabel})\n\n${bulletLines}\n\n## Gợi ý áp dụng vào luyện nói tiếng Anh CNTT\n\n- Tóm tắt lại các chủ đề trên bằng tiếng Anh trong 3 câu (Context, Action, Result).\n- Luyện sử dụng thuật ngữ kỹ thuật chuẩn xác trong Daily Standup và Code Review.`,
    metricsJson: [],
    sourceUrls,
  };
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

  const category = normalizeResearchCategory(body.topic ?? body.category);
  const config = TOPIC_CONFIG[category];

  const [hnSources, devToSources, tavilySources] = await Promise.all([
    fetchHackerNewsSources(4),
    fetchDevToSources(config.devToTag, 4),
    fetchTavilySources(config.tavilyQuery),
  ]);

  const allSources = [...tavilySources, ...devToSources, ...hnSources].slice(0, 8);
  const verifiedSourceUrls = normalizeResearchSources(
    allSources.map((s) => ({ title: `${s.provider}: ${s.title}`, url: s.url }))
  );

  let synthesized = buildFallbackSynthesis(category, allSources);

  if (allSources.length > 0) {
    const sourcesContext = allSources
      .map((s, idx) => `${idx + 1}. [${s.provider}] ${s.title} (${s.url}) - ${s.excerpt}`)
      .join("\n");

    const prompt = `You are a bilingual Vietnamese-English IT career & engineering communication researcher for SpeakIT.
Synthesize the following real fetched tech/career sources into one structured Vietnamese research article with English technical terms for Vietnamese IT students & developers.

Topic Category: ${category} (${config.label})
Fetched Sources:
${sourcesContext}

Return ONLY valid JSON with this exact shape:
{
  "title": "Vietnamese editorial headline (max 140 chars)",
  "summary": "2-sentence Vietnamese executive summary for readers (max 320 chars, no internal CMS/drafting labels)",
  "contentMarkdown": "Well-structured Markdown in Vietnamese using ## headings and bullet points, incorporating real insights from the sources and practical IT English speaking takeaways",
  "metricsJson": []
}

For "metricsJson": ONLY include metric objects ({ "label": "Short metric label in Vietnamese", "value": "Concise number/stat", "highlight": "Short note" }) if the fetched sources contain real concrete numbers or benchmarks; otherwise return "metricsJson": [].`;

    const aiResult = await requestAiWaterfallText({
      systemInstruction: "Return strictly valid JSON only without markdown fences.",
      userPrompt: prompt,
      temperature: 0.4,
      maxTokens: 1200,
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
          title: parsed.title.trim(),
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

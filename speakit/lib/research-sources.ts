import type {
  ResearchArticle,
  ResearchCategory,
  ResearchMetricItem,
  ResearchSourceUrl,
} from "./research";
import { normalizeResearchSources } from "./research";

export interface FetchedSourceItem {
  title: string;
  url: string;
  excerpt: string;
  provider: string;
}

interface RssFeedSpec {
  provider: string;
  url: string;
}

export const CATEGORY_FEED_SPECS: Record<
  ResearchCategory,
  {
    label: string;
    devToTags: string[];
    tavilyQuery: string;
    rssFeeds: RssFeedSpec[];
    includeLobsters?: boolean;
  }
> = {
  tech_news: {
    label: "Tech & AI News",
    devToTags: ["ai", "programming", "opensource", "llm"],
    tavilyQuery: "software engineering AI developer workflow trends 2025 2026",
    includeLobsters: true,
    rssFeeds: [
      { provider: "GitHub Blog", url: "https://github.blog/feed/" },
      { provider: "OpenAI News", url: "https://openai.com/news/rss.xml" },
      { provider: "InfoQ", url: "https://feed.infoq.com/" },
      { provider: "Microsoft DevBlogs", url: "https://devblogs.microsoft.com/landing/" },
    ],
  },
  hr_interview: {
    label: "HR Interview Trends",
    devToTags: ["career", "interview", "beginners", "productivity"],
    tavilyQuery: "software engineer technical interview english communication trends 2025 2026",
    rssFeeds: [
      { provider: "Stack Overflow Blog", url: "https://stackoverflow.blog/feed/" },
      { provider: "freeCodeCamp", url: "https://www.freecodecamp.org/news/rss/" },
      { provider: "Pragmatic Engineer", url: "https://newsletter.pragmaticengineer.com/feed" },
    ],
  },
  benchmark: {
    label: "IT English Benchmarks",
    devToTags: ["productivity", "machinelearning", "testing", "performance"],
    tavilyQuery: "english proficiency IT outsourcing software developer communication benchmark",
    includeLobsters: true,
    rssFeeds: [
      { provider: "Hugging Face", url: "https://huggingface.co/blog/feed.xml" },
      {
        provider: "arXiv CS",
        url: "https://export.arxiv.org/api/query?search_query=cat:cs.SE+OR+cat:cs.AI&sortBy=submittedDate&sortOrder=descending&max_results=8",
      },
      { provider: "Stack Overflow Blog", url: "https://stackoverflow.blog/feed/" },
    ],
  },
  case_study: {
    label: "Case Study",
    devToTags: ["architecture", "devops", "webdev", "systemdesign"],
    tavilyQuery: "remote software team communication standup incident postmortem case study",
    includeLobsters: true,
    rssFeeds: [
      { provider: "Cloudflare Blog", url: "https://blog.cloudflare.com/rss/" },
      { provider: "GitHub Engineering", url: "https://github.blog/engineering/feed/" },
      { provider: "Netflix TechBlog", url: "https://netflixtechblog.com/feed" },
      { provider: "Martin Fowler", url: "https://martinfowler.com/feed.atom" },
    ],
  },
};

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, num) => {
      const code = Number(num);
      return Number.isFinite(code) ? String.fromCharCode(code) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCharCode(code) : "";
    });
}

function stripTagsAndCollapse(input: string): string {
  return decodeHtmlEntities(input)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTagInner(block: string, tagName: string): string {
  const re = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = block.match(re);
  return match ? match[1] : "";
}

function extractLinkUrl(block: string): string {
  const atomAlt =
    block.match(/<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*\/?>/i) ??
    block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']alternate["'][^>]*\/?>/i) ??
    block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  if (atomAlt?.[1]) {
    return decodeHtmlEntities(atomAlt[1]).trim();
  }
  const rssLink = extractTagInner(block, "link");
  return stripTagsAndCollapse(rssLink);
}

/**
 * Parses RSS 2.0 (<item>) or Atom 1.0 (<entry>) XML without external dependencies.
 */
export function parseFeedXml(
  xml: string,
  provider: string,
  limit = 6
): FetchedSourceItem[] {
  if (!xml || typeof xml !== "string") return [];

  const blocks = [
    ...(xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? []),
    ...(xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? []),
  ];

  const results: FetchedSourceItem[] = [];
  for (const block of blocks) {
    const title = stripTagsAndCollapse(extractTagInner(block, "title"));
    const url = extractLinkUrl(block);
    if (!title || !/^https?:\/\//i.test(url)) continue;

    const rawDesc =
      extractTagInner(block, "description") ||
      extractTagInner(block, "summary") ||
      extractTagInner(block, "content") ||
      extractTagInner(block, "content:encoded");
    const excerpt = stripTagsAndCollapse(rawDesc).slice(0, 220);

    results.push({
      title,
      url,
      excerpt: excerpt || `${provider} engineering article`,
      provider,
    });
    if (results.length >= limit) break;
  }

  return results;
}

export function canonicalSourceUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim());
    const params = new URLSearchParams(parsed.search);
    Array.from(params.keys()).forEach((key) => {
      if (/^(utm_|ref$|source$)/i.test(key)) {
        params.delete(key);
      }
    });
    const cleanSearch = params.toString();
    const cleanPath = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.protocol.toLowerCase()}//${parsed.hostname.toLowerCase()}${cleanPath}${
      cleanSearch ? `?${cleanSearch}` : ""
    }`;
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

export function canonicalTitleKey(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Excludes URLs already present in existing articles and selects a balanced,
 * rotated mix across distinct providers so consecutive AI drafts stay fresh.
 */
export function selectFreshDiverseSources(
  candidates: FetchedSourceItem[],
  existingArticles: Pick<ResearchArticle, "title" | "sourceUrls">[],
  maxItems = 8
): FetchedSourceItem[] {
  const usedUrls = new Set<string>();
  const usedSourceTitles = new Set<string>();

  for (const article of existingArticles) {
    usedSourceTitles.add(canonicalTitleKey(article.title));
    for (const src of article.sourceUrls ?? []) {
      if (src.url) usedUrls.add(canonicalSourceUrl(src.url));
      if (src.title) {
        const cleanSrcTitle = src.title.replace(/^[^:]+:\s*/, "");
        usedSourceTitles.add(canonicalTitleKey(cleanSrcTitle));
      }
    }
  }

  const seenBatchUrls = new Set<string>();
  const seenBatchTitles = new Set<string>();
  const fresh: FetchedSourceItem[] = [];

  for (const item of candidates) {
    const normUrl = canonicalSourceUrl(item.url);
    const normTitle = canonicalTitleKey(item.title);
    if (!normUrl || !normTitle) continue;
    if (usedUrls.has(normUrl) || usedSourceTitles.has(normTitle)) continue;
    if (seenBatchUrls.has(normUrl) || seenBatchTitles.has(normTitle)) continue;
    seenBatchUrls.add(normUrl);
    seenBatchTitles.add(normTitle);
    fresh.push(item);
  }

  const pool =
    fresh.length >= 2
      ? fresh
      : candidates.filter((item) => {
          const normUrl = canonicalSourceUrl(item.url);
          if (seenBatchUrls.has(normUrl)) return false;
          seenBatchUrls.add(normUrl);
          return true;
        });

  // Group by provider and round-robin pick with rotation offset based on article count
  const byProvider = new Map<string, FetchedSourceItem[]>();
  for (const item of pool) {
    const list = byProvider.get(item.provider) ?? [];
    list.push(item);
    byProvider.set(item.provider, list);
  }

  const providerQueues = Array.from(byProvider.values());
  if (providerQueues.length > 1) {
    const offset = existingArticles.length % providerQueues.length;
    const rotated = [
      ...providerQueues.slice(offset),
      ...providerQueues.slice(0, offset),
    ];
    providerQueues.splice(0, providerQueues.length, ...rotated);
  }

  const picked: FetchedSourceItem[] = [];
  let round = 0;
  while (picked.length < maxItems) {
    let addedInRound = false;
    for (const queue of providerQueues) {
      if (round < queue.length) {
        picked.push(queue[round]);
        addedInRound = true;
        if (picked.length >= maxItems) break;
      }
    }
    if (!addedInRound) break;
    round += 1;
  }

  return picked;
}

export function ensureUniqueHeadline(
  candidateTitle: string,
  existingTitles: string[],
  leadSource?: FetchedSourceItem
): string {
  const clean = candidateTitle.trim().slice(0, 140);
  const existingSet = new Set(existingTitles.map(canonicalTitleKey));
  if (!existingSet.has(canonicalTitleKey(clean))) {
    return clean;
  }
  const suffix = leadSource
    ? `${leadSource.provider}: ${leadSource.title.slice(0, 48)}`
    : new Date().toISOString().slice(0, 10);
  return `${clean.slice(0, 82)} — ${suffix}`.slice(0, 140);
}

export function buildDiverseFallbackSynthesis(
  category: ResearchCategory,
  sources: FetchedSourceItem[],
  existingTitles: string[] = []
): {
  title: string;
  summary: string;
  contentMarkdown: string;
  metricsJson: ResearchMetricItem[];
  sourceUrls: ResearchSourceUrl[];
} {
  const topicLabel = CATEGORY_FEED_SPECS[category].label;
  const sourceUrls = normalizeResearchSources(
    sources.map((s) => ({ title: `${s.provider}: ${s.title}`, url: s.url }))
  );

  const lead = sources[0];
  const distinctProviders = Array.from(new Set(sources.map((s) => s.provider)));
  const providersText =
    distinctProviders.length > 0 ? distinctProviders.slice(0, 4).join(", ") : "nguồn kỹ thuật";

  const rawTitle = lead
    ? `${topicLabel}: ${lead.title.slice(0, 86)}`
    : `Điểm tin ${topicLabel} mới nhất (${new Date().toISOString().slice(0, 10)})`;

  const title = ensureUniqueHeadline(rawTitle, existingTitles, lead);
  const summary = lead
    ? `Tổng hợp góc nhìn từ ${providersText}, nổi bật với chủ đề "${lead.title.slice(0, 110)}" và các bài học tiếng Anh chuyên ngành cho kỹ sư CNTT.`
    : `Tổng hợp xu hướng ${topicLabel} từ các nguồn kỹ thuật uy tín dành cho sinh viên và kỹ sư CNTT.`;

  const bulletLines =
    sources.length > 0
      ? sources
          .slice(0, 6)
          .map((s) => `- **${s.title}** (${s.provider}): ${s.excerpt}`)
          .join("\n")
      : "- Chưa lấy được bài viết trực tuyến mới; quản trị viên có thể bổ sung nội dung trực tiếp.";

  return {
    title,
    summary: summary.slice(0, 320),
    contentMarkdown: `## Điểm tin nổi bật (${topicLabel})\n\n${bulletLines}\n\n## Gợi ý áp dụng vào luyện nói tiếng Anh CNTT\n\n- Tóm tắt lại chủ đề **${lead?.title ?? topicLabel}** bằng tiếng Anh trong 3 câu (Context, Action, Result).\n- Luyện sử dụng thuật ngữ kỹ thuật chuẩn xác trong Daily Standup, Technical Interview và Code Review.`,
    metricsJson: [],
    sourceUrls,
  };
}

import { NextRequest, NextResponse } from "next/server";
import {
  extractFirstJsonObject,
  requestAiWaterfallText,
} from "../../../../lib/ai-waterfall";
import type { VocabularyItem } from "../../../../lib/types";
import { upsertVocabularyItems } from "../../../../lib/vocabulary-db";

export const dynamic = "force-dynamic";

interface ExtractRequestBody {
  title?: unknown;
  content?: unknown;
  summary?: unknown;
}

function slugify(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || "it-communication";
}

function normalizeCareerLevel(value: unknown): "Fresher" | "Junior" | "Senior" {
  if (value === "Fresher" || value === "Junior" || value === "Senior") {
    return value;
  }
  return "Junior";
}

function normalizeRelatedTerms(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    const key = trimmed.toLowerCase();
    if (trimmed && !seen.has(key)) {
      seen.add(key);
      out.push(trimmed);
    }
  }
  return out.slice(0, 4);
}

const LOCAL_IT_VOCAB_POOL: Array<Omit<VocabularyItem, "id">> = [
  {
    term: "latency",
    phonetic: "/ˈleɪtənsi/",
    partOfSpeech: "noun",
    meaningVI: "Độ trễ trong truyền tải hoặc xử lý dữ liệu",
    exampleSentenceEN: "We reduced API latency by caching frequent database queries.",
    exampleTranslationVI: "Chúng tôi đã giảm độ trễ API bằng cách lưu đệm các truy vấn cơ sở dữ liệu thường xuyên.",
    careerLevel: "Junior",
    clusterTitle: "System Performance & Reliability",
    clusterSlug: "system-performance-reliability",
    relatedTerms: ["throughput", "bottleneck", "caching"],
  },
  {
    term: "bottleneck",
    phonetic: "/ˈbɒtlnek/",
    partOfSpeech: "noun",
    meaningVI: "Điểm nghẽn hiệu năng trong hệ thống hoặc quy trình",
    exampleSentenceEN: "The single-threaded worker became a bottleneck during peak traffic.",
    exampleTranslationVI: "Tiến trình đơn luồng đã trở thành điểm nghẽn khi lưu lượng truy cập tăng cao.",
    careerLevel: "Junior",
    clusterTitle: "System Performance & Reliability",
    clusterSlug: "system-performance-reliability",
    relatedTerms: ["latency", "scalability", "throughput"],
  },
  {
    term: "scalability",
    phonetic: "/ˌskeɪləˈbɪləti/",
    partOfSpeech: "noun",
    meaningVI: "Khả năng mở rộng của hệ thống khi tải tăng",
    exampleSentenceEN: "Microservices improved the scalability of our checkout pipeline.",
    exampleTranslationVI: "Kiến trúc microservices đã cải thiện khả năng mở rộng của luồng thanh toán.",
    careerLevel: "Senior",
    clusterTitle: "Architecture & Cloud Systems",
    clusterSlug: "architecture-cloud-systems",
    relatedTerms: ["throughput", "load balancing", "microservices"],
  },
  {
    term: "code review",
    phonetic: "/kəʊd rɪˈvjuː/",
    partOfSpeech: "noun",
    meaningVI: "Quá trình đồng nghiệp kiểm tra và góp ý mã nguồn",
    exampleSentenceEN: "During code review, we caught a race condition before merging.",
    exampleTranslationVI: "Trong buổi code review, chúng tôi đã phát hiện lỗi race condition trước khi gộp nhánh.",
    careerLevel: "Fresher",
    clusterTitle: "Engineering Collaboration",
    clusterSlug: "engineering-collaboration",
    relatedTerms: ["pull request", "refactoring", "technical debt"],
  },
  {
    term: "refactoring",
    phonetic: "/ˌriːˈfæktərɪŋ/",
    partOfSpeech: "noun",
    meaningVI: "Tái cấu trúc mã nguồn để sạch và dễ bảo trì hơn",
    exampleSentenceEN: "Refactoring the legacy module made unit testing much easier.",
    exampleTranslationVI: "Việc tái cấu trúc mô-đun cũ giúp viết unit test dễ dàng hơn nhiều.",
    careerLevel: "Junior",
    clusterTitle: "Engineering Collaboration",
    clusterSlug: "engineering-collaboration",
    relatedTerms: ["technical debt", "code review", "maintainability"],
  },
  {
    term: "technical debt",
    phonetic: "/ˈteknɪkəl det/",
    partOfSpeech: "noun",
    meaningVI: "Nợ kỹ thuật phát sinh khi ưu tiên tốc độ hơn chất lượng code",
    exampleSentenceEN: "We allocated one sprint to pay down technical debt in the auth service.",
    exampleTranslationVI: "Chúng tôi dành một sprint để xử lý nợ kỹ thuật trong dịch vụ xác thực.",
    careerLevel: "Senior",
    clusterTitle: "Engineering Collaboration",
    clusterSlug: "engineering-collaboration",
    relatedTerms: ["refactoring", "sprint", "backlog"],
  },
  {
    term: "deployment",
    phonetic: "/dɪˈplɔɪmənt/",
    partOfSpeech: "noun",
    meaningVI: "Triển khai ứng dụng lên môi trường chạy thực tế",
    exampleSentenceEN: "Automated deployment cut our release time from two hours to ten minutes.",
    exampleTranslationVI: "Triển khai tự động đã rút ngắn thời gian phát hành từ hai giờ xuống mười phút.",
    careerLevel: "Fresher",
    clusterTitle: "DevOps & Release Engineering",
    clusterSlug: "devops-release-engineering",
    relatedTerms: ["CI/CD", "rollback", "staging"],
  },
  {
    term: "root cause",
    phonetic: "/ruːt kɔːz/",
    partOfSpeech: "noun",
    meaningVI: "Nguyên nhân gốc rễ gây ra sự cố hoặc lỗi",
    exampleSentenceEN: "We wrote a postmortem once we identified the root cause of the outage.",
    exampleTranslationVI: "Chúng tôi đã viết báo cáo sự cố sau khi xác định được nguyên nhân gốc rễ.",
    careerLevel: "Junior",
    clusterTitle: "Incident & Debugging",
    clusterSlug: "incident-debugging",
    relatedTerms: ["postmortem", "observability", "regression"],
  },
  {
    term: "benchmark",
    phonetic: "/ˈbentʃmɑːrk/",
    partOfSpeech: "noun",
    meaningVI: "Chuẩn đo lường và so sánh hiệu năng hoặc năng lực",
    exampleSentenceEN: "We ran a benchmark to compare query speed across both databases.",
    exampleTranslationVI: "Chúng tôi chạy benchmark để so sánh tốc độ truy vấn giữa hai cơ sở dữ liệu.",
    careerLevel: "Fresher",
    clusterTitle: "System Performance & Reliability",
    clusterSlug: "system-performance-reliability",
    relatedTerms: ["latency", "throughput", "profiling"],
  },
  {
    term: "stakeholder",
    phonetic: "/ˈsteɪkhəʊldər/",
    partOfSpeech: "noun",
    meaningVI: "Các bên liên quan trong dự án hoặc sản phẩm",
    exampleSentenceEN: "We demoed the new dashboard to key stakeholders on Friday.",
    exampleTranslationVI: "Chúng tôi đã trình diễn bảng điều khiển mới cho các bên liên quan vào thứ Sáu.",
    careerLevel: "Senior",
    clusterTitle: "Engineering Collaboration",
    clusterSlug: "engineering-collaboration",
    relatedTerms: ["sprint", "trade-off", "roadmap"],
  },
];

function extractLocalFallback(
  title: string,
  summary: string,
  content: string
): VocabularyItem[] {
  const haystack = `${title}\n${summary}\n${content}`.toLowerCase();
  const fallbackClusterTitle = title.trim() || "IT Communication Essentials";
  const fallbackClusterSlug = slugify(fallbackClusterTitle);

  const scored = LOCAL_IT_VOCAB_POOL.map((item, idx) => {
    const termHit = haystack.includes(item.term.toLowerCase()) ? 3 : 0;
    const relatedHits = (item.relatedTerms ?? []).filter((rel) =>
      haystack.includes(rel.toLowerCase())
    ).length;
    return { item, score: termHit + relatedHits, idx };
  });

  scored.sort((a, b) => b.score - a.score || a.idx - b.idx);
  return scored.slice(0, 6).map(({ item }) => ({
    id: `vocab-${slugify(item.term)}`,
    ...item,
    clusterTitle: item.clusterTitle || fallbackClusterTitle,
    clusterSlug: item.clusterSlug || fallbackClusterSlug,
  }));
}

function parseAiTerms(
  rawText: string,
  fallbackTitle: string
): VocabularyItem[] {
  const parsed = extractFirstJsonObject(rawText);
  if (!parsed) return [];

  const rootClusterTitle =
    typeof parsed.clusterTitle === "string" && parsed.clusterTitle.trim()
      ? parsed.clusterTitle.trim()
      : fallbackTitle.trim() || "IT Communication";
  const rootClusterSlug =
    typeof parsed.clusterSlug === "string" && parsed.clusterSlug.trim()
      ? slugify(parsed.clusterSlug)
      : slugify(rootClusterTitle);

  const rawList = Array.isArray(parsed.terms)
    ? parsed.terms
    : Array.isArray(parsed.vocabulary)
    ? parsed.vocabulary
    : Array.isArray(parsed.items)
    ? parsed.items
    : [];

  const items: VocabularyItem[] = [];
  const seen = new Set<string>();

  for (const entry of rawList) {
    if (!entry || typeof entry !== "object") continue;
    const r = entry as Record<string, unknown>;
    const term = typeof r.term === "string" ? r.term.trim() : "";
    if (!term || seen.has(term.toLowerCase())) continue;
    seen.add(term.toLowerCase());

    const clusterTitle =
      typeof r.clusterTitle === "string" && r.clusterTitle.trim()
        ? r.clusterTitle.trim()
        : rootClusterTitle;
    const clusterSlug =
      typeof r.clusterSlug === "string" && r.clusterSlug.trim()
        ? slugify(r.clusterSlug)
        : rootClusterSlug;

    items.push({
      id: `vocab-${slugify(term)}`,
      term,
      phonetic: typeof r.phonetic === "string" ? r.phonetic.trim() : "",
      partOfSpeech:
        typeof r.partOfSpeech === "string" && r.partOfSpeech.trim()
          ? r.partOfSpeech.trim()
          : "noun",
      meaningVI: typeof r.meaningVI === "string" ? r.meaningVI.trim() : "",
      exampleSentenceEN:
        typeof r.exampleSentenceEN === "string"
          ? r.exampleSentenceEN.trim()
          : "",
      exampleTranslationVI:
        typeof r.exampleTranslationVI === "string"
          ? r.exampleTranslationVI.trim()
          : "",
      careerLevel: normalizeCareerLevel(r.careerLevel),
      clusterTitle,
      clusterSlug,
      relatedTerms: normalizeRelatedTerms(r.relatedTerms),
    });
  }

  return items.slice(0, 8);
}

export async function POST(req: NextRequest) {
  let body: ExtractRequestBody;
  try {
    body = (await req.json()) as ExtractRequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const summary = typeof body.summary === "string" ? body.summary.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (!title && !summary && !content) {
    return NextResponse.json(
      { ok: false, error: "Article title, summary, or content is required." },
      { status: 400 }
    );
  }

  const systemInstruction = [
    "You are an IT English curriculum designer for Vietnamese software engineering students.",
    "Extract 5 to 8 high-value IT English terms or short technical phrases from the provided article.",
    "Return ONLY a single valid JSON object matching this exact schema:",
    '{ "clusterTitle": string, "clusterSlug": string, "terms": [{ "term": string, "phonetic": string, "partOfSpeech": string, "meaningVI": string, "exampleSentenceEN": string, "exampleTranslationVI": string, "careerLevel": "Fresher" | "Junior" | "Senior", "clusterTitle": string, "clusterSlug": string, "relatedTerms": string[] }] }',
    "Ensure phonetic uses IPA slashes, meaningVI and exampleTranslationVI are natural Vietnamese, and relatedTerms has 2-3 related IT terms.",
  ].join(" ");

  const userPrompt = [
    `Title: ${title}`,
    `Summary: ${summary}`,
    `Content:\n${content.slice(0, 4500)}`,
  ].join("\n\n");

  const aiResult = await requestAiWaterfallText({
    systemInstruction,
    userPrompt,
    temperature: 0.2,
    maxTokens: 1600,
    jsonMode: true,
    timeoutMs: 12000,
    validate: (text) => parseAiTerms(text, title).length > 0,
  });

  const extractedItems = aiResult
    ? parseAiTerms(aiResult.text, title)
    : extractLocalFallback(title, summary, content);

  const items =
    extractedItems.length > 0
      ? extractedItems
      : extractLocalFallback(title, summary, content);

  let persistedCount = 0;
  try {
    const persisted = await upsertVocabularyItems(items);
    persistedCount = persisted.length;
  } catch {
    persistedCount = 0;
  }

  return NextResponse.json({
    ok: true,
    provider: aiResult ? aiResult.provider : "local",
    persistedCount,
    items,
  });
}

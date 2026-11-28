import Image from "next/image";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  ExternalLink,
  Newspaper,
  Sparkles,
} from "lucide-react";
import {
  getPublishedArticles,
  type ResearchCategory,
  type ResearchMetricItem,
} from "../../lib/research";
import { VocabExtractorButton } from "../../components/research/VocabExtractorButton";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const CATEGORY_TABS: Array<{ id: "all" | ResearchCategory; label: string }> = [
  { id: "all", label: "Tất cả" },
  { id: "benchmark", label: "Benchmark" },
  { id: "hr_interview", label: "Phỏng vấn HR" },
  { id: "tech_news", label: "Tin Tech & AI" },
  { id: "case_study", label: "Case Study" },
];

function getCategoryLabel(category: ResearchCategory): string {
  return CATEGORY_TABS.find((t) => t.id === category)?.label ?? category;
}

function isInternalDraftMetric(metric: ResearchMetricItem): boolean {
  return (
    metric.highlight === "AI Curated Draft" ||
    metric.label === "Nguồn tin đã tổng hợp"
  );
}

export default async function ResearchPortalPage({
  searchParams,
}: {
  searchParams?: { category?: string };
}) {
  noStore();
  const rawCategory = searchParams?.category;
  const activeCategory: "all" | ResearchCategory =
    rawCategory === "benchmark" ||
    rawCategory === "hr_interview" ||
    rawCategory === "tech_news" ||
    rawCategory === "case_study"
      ? rawCategory
      : "all";

  const articles = await getPublishedArticles(
    activeCategory === "all" ? undefined : activeCategory
  );
  const featuredArticle =
    articles.find(
      (a) => a.category === "benchmark" && a.metricsJson.length > 0
    ) ?? null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-blue-600 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Trang chủ</span>
          </Link>
          <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-blue-700 dark:text-blue-400 pt-1">
            <Newspaper className="w-4 h-4 text-blue-700 dark:text-blue-400" aria-hidden="true" />
            <span>SpeakIT Editorial &amp; Research</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 text-balance">
            Nghiên Cứu &amp; Xu Hướng Tiếng Anh CNTT
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
            Tổng hợp số liệu EF EPI 2025, xu hướng phỏng vấn kỹ thuật từ HR và tin tức công nghệ giúp sinh viên CNTT luyện giao tiếp sát thực tế.
          </p>
        </div>

        <Link
          href="/scenarios"
          className="bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 text-white shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-colors"
        >
          <span>Thực hành nói ngay</span>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="navigation" aria-label="Lọc chuyên mục nghiên cứu">
        {CATEGORY_TABS.map((tab) => {
          const isActive = activeCategory === tab.id;
          return (
            <Link
              key={tab.id}
              href={tab.id === "all" ? "/research" : `/research?category=${tab.id}`}
              className={`px-4 py-1.5 rounded-full border text-xs sm:text-sm font-mono font-semibold focus-visible:ring-2 focus-visible:ring-blue-600 transition-colors ${
                isActive
                  ? "bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300"
                  : "bg-white dark:bg-[#1E293B] border-slate-200 dark:border-[#334155] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:border-blue-300 dark:hover:border-blue-700"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {featuredArticle && featuredArticle.metricsJson.length > 0 && (
        <section className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-blue-700 dark:text-blue-400">
              <BarChart3 className="w-4 h-4 text-blue-700 dark:text-blue-400" aria-hidden="true" />
              <span>Số liệu nổi bật: {featuredArticle.title}</span>
            </div>
            <Link
              href={`/research/${encodeURIComponent(featuredArticle.slug)}`}
              className="relative z-10 shrink-0 text-sm font-semibold text-blue-800 dark:text-blue-300 hover:text-blue-950 dark:hover:text-blue-200 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 focus-visible:ring-2 focus-visible:ring-blue-600 transition-colors"
            >
              <span>Đọc phân tích đầy đủ</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-[#334155] border-t border-slate-200 dark:border-[#334155] pt-4">
            {featuredArticle.metricsJson.map((metric, idx) => (
              <div
                key={idx}
                className="py-3 sm:py-1 sm:px-4 first:sm:pl-0 last:sm:pr-0 flex flex-col justify-center gap-1"
              >
                <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
                  {metric.label}
                </div>
                <div className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-slate-50">
                  {metric.value}
                </div>
                {metric.highlight && (
                  <div className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                    {metric.highlight}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {articles.length === 0 ? (
        <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-xl p-8 text-center space-y-3">
          <BookOpen className="w-7 h-7 text-slate-500 dark:text-slate-400 mx-auto" aria-hidden="true" />
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-50 text-balance">
            Chưa có bài viết nào trong chuyên mục này
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Hãy chuyển sang &ldquo;Tất cả&rdquo; hoặc quay lại trang chủ để luyện nói theo tình huống.
          </p>
        </div>
      ) : (
        <div className="bg-slate-200 dark:bg-[#334155] border border-slate-200 dark:border-[#334155] rounded-xl overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-px">
          {articles.map((article) => {
            const realMetricsCount = article.metricsJson.filter(
              (m) => !isInternalDraftMetric(m)
            ).length;
            const coverImageUrl = (
              (article as { coverImageUrl?: string | null }).coverImageUrl ?? ""
            ).trim();
            return (
              <article
                key={article.id}
                className="bg-white dark:bg-[#1E293B] p-5 sm:p-6 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <Link
                    href={`/research/${article.slug}`}
                    tabIndex={-1}
                    aria-hidden="true"
                    className="block relative aspect-video w-full overflow-hidden rounded-lg border border-slate-200 dark:border-[#334155] bg-slate-100 dark:bg-slate-800"
                  >
                    {coverImageUrl ? (
                      <Image
                        src={coverImageUrl}
                        alt={article.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        loading="lazy"
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-100/80 dark:from-slate-800 dark:via-slate-800/90 dark:to-blue-950/60 flex items-center justify-center">
                        <Newspaper
                          className="w-8 h-8 text-blue-700/35 dark:text-blue-400/35"
                          aria-hidden="true"
                        />
                      </div>
                    )}
                  </Link>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-xs font-mono font-semibold">
                      {getCategoryLabel(article.category)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {article.sourceType === "ai_curated" && (
                        <Sparkles className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" aria-hidden="true" />
                      )}
                      <span>
                        {new Intl.DateTimeFormat("vi-VN").format(
                          new Date(article.publishedAt ?? article.createdAt)
                        )}
                      </span>
                    </span>
                  </div>

                  <Link href={`/research/${article.slug}`} className="block group focus-visible:ring-2 focus-visible:ring-blue-600 rounded">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-50 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors leading-snug text-balance">
                      {article.title}
                    </h2>
                  </Link>

                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {article.summary}
                  </p>

                  {article.sourceUrls.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {article.sourceUrls.slice(0, 2).map((src, idx) => (
                        <a
                          key={idx}
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={src.title}
                          className="inline-flex items-center gap-1 max-w-full text-xs font-mono text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-400 focus-visible:ring-2 focus-visible:ring-blue-600 rounded underline underline-offset-2"
                        >
                          <span className="truncate">{src.title}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-[#334155]">
                  <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
                    {realMetricsCount > 0
                      ? `${realMetricsCount} thẻ số liệu`
                      : getCategoryLabel(article.category)}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <VocabExtractorButton
                      title={article.title}
                      summary={article.summary}
                      content={article.contentMarkdown}
                      variant="card"
                    />
                    <Link
                      href={`/research/${article.slug}`}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-blue-600 text-sm font-semibold transition-colors"
                    >
                      <span>Đọc chi tiết</span>
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

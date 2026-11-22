import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import {
  ArrowLeft,
  ArrowRight,
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
            className="liquid-glass-btn inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Trang chủ</span>
          </Link>
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-cyan-300 pt-1">
            <Newspaper className="w-4 h-4 text-cyan-400" />
            <span>SpeakIT Editorial &amp; Research</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Nghiên Cứu &amp; Xu Hướng Tiếng Anh CNTT
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
            Tổng hợp số liệu EF EPI 2025, xu hướng phỏng vấn kỹ thuật từ HR và tin tức công nghệ giúp sinh viên CNTT luyện giao tiếp sát thực tế.
          </p>
        </div>

        <Link
          href="/scenarios"
          className="liquid-btn-primary shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all"
        >
          <span>Thực hành nói ngay</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="navigation" aria-label="Lọc chuyên mục nghiên cứu">
        {CATEGORY_TABS.map((tab) => {
          const isActive = activeCategory === tab.id;
          return (
            <Link
              key={tab.id}
              href={tab.id === "all" ? "/research" : `/research?category=${tab.id}`}
              className={`liquid-glass-pill px-4 py-1.5 text-xs font-mono font-semibold transition-all ${
                isActive
                  ? "!bg-cyan-500/25 !border-cyan-400/50 text-cyan-200 shadow-[0_0_16px_rgba(6,182,212,0.28)]"
                  : "text-slate-300 hover:text-white hover:!border-white/35"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {featuredArticle && featuredArticle.metricsJson.length > 0 && (
        <section className="liquid-glass-card p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase text-cyan-300">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              <span>Số liệu nổi bật · {featuredArticle.title}</span>
            </div>
            <Link
              href={`/research/${encodeURIComponent(featuredArticle.slug)}`}
              className="relative z-10 shrink-0 text-xs font-semibold text-cyan-200 hover:text-white inline-flex items-center gap-1 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/35 hover:bg-cyan-500/25 transition-colors"
            >
              <span>Đọc phân tích đầy đủ</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
            {featuredArticle.metricsJson.map((metric, idx) => (
              <div
                key={idx}
                className="h-full p-4 rounded-2xl bg-slate-950/60 border border-white/12 flex flex-col justify-center gap-1.5"
              >
                <div className="text-[11px] font-mono text-slate-400">
                  {metric.label}
                </div>
                <div className="text-2xl font-extrabold font-mono text-white">
                  {metric.value}
                </div>
                {metric.highlight && (
                  <div className="text-[11px] font-semibold text-cyan-300">
                    {metric.highlight}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {articles.length === 0 ? (
        <div className="liquid-glass-card p-8 text-center space-y-3">
          <BookOpen className="w-7 h-7 text-slate-400 mx-auto" />
          <h2 className="text-base font-bold text-white">
            Chưa có bài viết nào trong chuyên mục này
          </h2>
          <p className="text-xs text-slate-300">
            Hãy chuyển sang &ldquo;Tất cả&rdquo; hoặc quay lại trang chủ để luyện nói theo tình huống.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {articles.map((article) => {
            const realMetricsCount = article.metricsJson.filter(
              (m) => !isInternalDraftMetric(m)
            ).length;
            return (
              <article
                key={article.id}
                className="liquid-glass-card-lite rounded-3xl p-5 sm:p-6 hover:!border-white/30 transition-all flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-cyan-200 text-[11px] font-mono font-semibold">
                      {getCategoryLabel(article.category)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400">
                      {article.sourceType === "ai_curated" && (
                        <Sparkles className="w-3 h-3 text-violet-400" />
                      )}
                      <span>
                        {new Date(
                          article.publishedAt ?? article.createdAt
                        ).toLocaleDateString("vi-VN")}
                      </span>
                    </span>
                  </div>

                  <Link href={`/research/${article.slug}`} className="block group">
                    <h2 className="text-base sm:text-lg font-bold text-white group-hover:text-cyan-300 transition-colors leading-snug">
                      {article.title}
                    </h2>
                  </Link>

                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
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
                          className="inline-flex items-center gap-1 max-w-full text-[11px] font-mono text-slate-400 hover:text-cyan-300 underline underline-offset-2"
                        >
                          <span className="truncate">{src.title}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/10">
                  <span className="text-[11px] font-mono text-slate-400">
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
                      className="liquid-glass-btn inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors"
                    >
                      <span>Đọc chi tiết</span>
                      <ArrowRight className="w-3.5 h-3.5" />
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

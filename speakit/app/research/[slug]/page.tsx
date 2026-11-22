import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  ExternalLink,
  Mic,
  Sparkles,
} from "lucide-react";
import { SCENARIOS } from "../../../data/scenarios";
import { getArticleBySlug, type ResearchCategory } from "../../../lib/research";
import { VocabExtractorButton } from "../../../components/research/VocabExtractorButton";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function renderMarkdownBlocks(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const blocks: Array<{ type: "h2" | "h3" | "li" | "p"; text: string }> = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("### ")) {
      blocks.push({ type: "h3", text: line.slice(4) });
    } else if (line.startsWith("## ") || line.startsWith("# ")) {
      blocks.push({ type: "h2", text: line.replace(/^#+\s*/, "") });
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      blocks.push({ type: "li", text: line.slice(2) });
    } else {
      blocks.push({ type: "p", text: line });
    }
  }

  return blocks.map((block, idx) => {
    const formatted = block.text.replace(/\*\*(.*?)\*\*/g, "$1");
    if (block.type === "h2") {
      return (
        <h2 key={idx} className="text-lg sm:text-xl font-bold text-white pt-3">
          {formatted}
        </h2>
      );
    }
    if (block.type === "h3") {
      return (
        <h3 key={idx} className="text-base font-bold text-slate-100 pt-2">
          {formatted}
        </h3>
      );
    }
    if (block.type === "li") {
      return (
        <div key={idx} className="flex items-start gap-2 text-sm text-slate-200 leading-relaxed pl-1">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 shrink-0" />
          <span>{formatted}</span>
        </div>
      );
    }
    return (
      <p key={idx} className="text-sm sm:text-base text-slate-200 leading-relaxed">
        {formatted}
      </p>
    );
  });
}

function getRelatedScenarioIds(category: ResearchCategory): string[] {
  if (category === "hr_interview") return ["fresher-interview", "daily-standup"];
  if (category === "benchmark") return ["daily-standup", "code-review"];
  if (category === "case_study") return ["bug-report", "client-meeting"];
  return ["tech-demo", "code-review"];
}

export default async function ResearchArticlePage({
  params,
}: {
  params: { slug: string };
}) {
  let decodedSlug = params.slug;
  try {
    decodedSlug = decodeURIComponent(params.slug);
  } catch {
    decodedSlug = params.slug;
  }
  const article = await getArticleBySlug(decodedSlug);
  if (!article) {
    notFound();
  }

  const relatedIds = getRelatedScenarioIds(article.category);
  const relatedScenarios = SCENARIOS.filter((s) => relatedIds.includes(s.id));

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="space-y-3">
        <Link
          href="/research"
          className="liquid-glass-btn inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Tất cả bài nghiên cứu</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/45 text-cyan-200 text-xs font-mono font-semibold">
            {article.category}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-mono text-slate-400">
            {article.sourceType === "ai_curated" && (
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            )}
            <span>
              Xuất bản:{" "}
              {new Date(
                article.publishedAt ?? article.createdAt
              ).toLocaleDateString("vi-VN")}
            </span>
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-snug">
          {article.title}
        </h1>
        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          {article.summary}
        </p>
        <div className="pt-1">
          <VocabExtractorButton
            title={article.title}
            summary={article.summary}
            content={article.contentMarkdown}
            variant="detail"
          />
        </div>
      </div>

      {article.metricsJson.length > 0 && (
        <section className="liquid-glass-card p-5 space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase text-cyan-300">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            <span>Dữ liệu thống kê chính</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
            {article.metricsJson.map((metric, idx) => (
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

      <article className="liquid-glass-card p-6 sm:p-8 space-y-3">
        {renderMarkdownBlocks(article.contentMarkdown)}
      </article>

      {article.sourceUrls.length > 0 && (
        <section className="liquid-glass-card p-5 space-y-3">
          <h2 className="text-xs font-mono font-bold uppercase text-slate-400">
            Nguồn tham khảo
          </h2>
          <ul className="space-y-2">
            {article.sourceUrls.map((src, idx) => (
              <li key={idx}>
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-cyan-300 hover:text-cyan-200 hover:underline"
                >
                  <span>{src.title}</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="liquid-glass-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 text-sm font-bold text-white">
            <Mic className="w-4 h-4 text-emerald-400" />
            <span>Tình huống luyện nói gợi ý từ bài viết</span>
          </div>
          <Link
            href="/"
            className="text-xs font-semibold text-cyan-300 hover:text-cyan-200 hover:underline inline-flex items-center gap-1"
          >
            <span>Xem tất cả kịch bản</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {relatedScenarios.map((scenario) => (
            <Link
              key={scenario.id}
              href={`/practice/${scenario.id}`}
              className="liquid-glass-card-lite p-4 rounded-2xl hover:!border-cyan-400/50 transition-all flex items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="font-bold text-sm text-white">
                  {scenario.titleEN}
                </div>
                <div className="text-xs text-slate-300">{scenario.titleVI}</div>
              </div>
              <span className="liquid-btn-primary shrink-0 inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-bold">
                <span>Luyện</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

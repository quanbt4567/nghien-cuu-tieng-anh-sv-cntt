"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Check,
  Edit3,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type {
  ResearchArticle,
  ResearchCategory,
  ResearchMetricItem,
  ResearchSourceUrl,
} from "../../lib/research";

interface AdminResearchTabProps {
  onUnauthorized: () => void;
}

const CATEGORY_OPTIONS: Array<{ value: ResearchCategory; label: string }> = [
  { value: "hr_interview", label: "HR Interview Trends" },
  { value: "tech_news", label: "Tech & AI News" },
  { value: "benchmark", label: "IT English Benchmarks" },
  { value: "case_study", label: "Case Study" },
];

export function AdminResearchTab({ onUnauthorized }: AdminResearchTabProps) {
  const [articles, setArticles] = useState<ResearchArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<ResearchCategory>("hr_interview");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState<ResearchCategory>("benchmark");
  const [contentMarkdown, setContentMarkdown] = useState("");
  const [metricsJson, setMetricsJson] = useState<ResearchMetricItem[]>([
    { label: "", value: "", highlight: "" },
  ]);
  const [sourceUrls, setSourceUrls] = useState<ResearchSourceUrl[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const loadArticles = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/research", { cache: "no-store" });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      if (res.ok) {
        const data = (await res.json()) as { articles?: ResearchArticle[] };
        setArticles(Array.isArray(data.articles) ? data.articles : []);
      }
    } catch {
      setErrorMessage("Không thể tải danh sách bài nghiên cứu.");
    } finally {
      setIsLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    void loadArticles();
  }, [loadArticles]);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setSummary("");
    setCategory("benchmark");
    setContentMarkdown("");
    setMetricsJson([{ label: "", value: "", highlight: "" }]);
    setSourceUrls([]);
  };

  const handleLoadIntoEditor = (article: ResearchArticle) => {
    setEditingId(article.id);
    setTitle(article.title);
    setSummary(article.summary);
    setCategory(article.category);
    setContentMarkdown(article.contentMarkdown);
    setMetricsJson(
      article.metricsJson.length > 0
        ? article.metricsJson
        : [{ label: "", value: "", highlight: "" }]
    );
    setSourceUrls(article.sourceUrls);
    setStatusMessage(`Đang chỉnh sửa: ${article.title}`);
    setErrorMessage(null);
  };

  const handleAiGenerate = async () => {
    setIsGenerating(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/admin/research/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: selectedTopic }),
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        fetchedSourceCount?: number;
      };
      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "Không thể tạo bản nháp AI.");
        return;
      }
      setStatusMessage(
        `Đã săn ${data.fetchedSourceCount ?? 0} nguồn tin và tạo bản nháp mới trong hàng chờ duyệt.`
      );
      await loadArticles();
    } catch {
      setErrorMessage("Lỗi kết nối khi gọi AI Săn tin.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStatusChange = async (
    id: string,
    nextStatus: "published" | "archived" | "pending_review"
  ) => {
    setErrorMessage(null);
    const res = await fetch("/api/admin/research", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: nextStatus }),
    });
    if (res.status === 401) {
      onUnauthorized();
      return;
    }
    if (res.ok) {
      setStatusMessage(
        nextStatus === "published"
          ? "Đã duyệt và xuất bản bài viết lên /research."
          : "Đã cập nhật trạng thái bài viết."
      );
      await loadArticles();
    } else {
      setErrorMessage("Không thể cập nhật trạng thái bài viết.");
    }
  };

  const handleDelete = async (id: string) => {
    setErrorMessage(null);
    const res = await fetch(`/api/admin/research?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.status === 401) {
      onUnauthorized();
      return;
    }
    if (res.ok) {
      if (editingId === id) {
        resetForm();
      }
      setStatusMessage("Đã xóa bài viết.");
      await loadArticles();
    } else {
      setErrorMessage("Không thể xóa bài viết.");
    }
  };

  const handleSaveArticle = async (
    e: FormEvent,
    targetStatus: "published" | "pending_review"
  ) => {
    e.preventDefault();
    if (!title.trim() || !summary.trim() || !contentMarkdown.trim()) {
      setErrorMessage("Vui lòng nhập đầy đủ Tiêu đề, Tóm tắt và Nội dung Markdown.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/admin/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId ?? undefined,
          title: title.trim(),
          summary: summary.trim(),
          category,
          contentMarkdown: contentMarkdown.trim(),
          metricsJson: metricsJson.filter((m) => m.label.trim() && m.value.trim()),
          sourceUrls: sourceUrls.filter((s) => s.title.trim() && s.url.trim()),
          sourceType: "admin_authored",
          status: targetStatus,
        }),
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "Không thể lưu bài viết.");
        return;
      }
      setStatusMessage(
        targetStatus === "published"
          ? "Đã xuất bản bài viết mới lên /research."
          : "Đã lưu bản nháp vào hàng chờ duyệt."
      );
      resetForm();
      await loadArticles();
    } catch {
      setErrorMessage("Lỗi kết nối khi lưu bài viết.");
    } finally {
      setIsSaving(false);
    }
  };

  const pendingArticles = articles.filter((a) => a.status === "pending_review");
  const publishedArticles = articles.filter((a) => a.status === "published");

  return (
    <div className="space-y-6">
      <div className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase text-sky-700">
            <Sparkles className="w-4 h-4 text-sky-500" />
            <span>AI Research Curator (HackerNews + Dev.to + Tavily)</span>
          </div>
          <h2 className="text-base font-bold text-ink">
            Tự động săn tin công nghệ & tạo bản nháp nghiên cứu
          </h2>
          <p className="text-xs text-ink-muted">
            Bản nháp AI tạo sẽ vào hàng chờ kiểm duyệt (`pending_review`) trước khi hiển thị công khai trên `/research`.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <select
            aria-label="Chọn chủ đề AI săn tin"
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value as ResearchCategory)}
            className="px-3 py-2 rounded-xl bg-paper border border-ink/15 text-xs font-medium text-ink focus:outline-none"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => void handleAiGenerate()}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-pill bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-soft disabled:opacity-50 transition-all"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{isGenerating ? "Đang săn tin..." : "AI Săn tin & Tạo bản nháp"}</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs font-semibold text-emerald-700">
          {statusMessage}
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-semibold text-rose-700">
          {errorMessage}
        </div>
      )}

      <section className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold uppercase font-mono text-ink">
            Hàng chờ duyệt ({pendingArticles.length})
          </h3>
          <button
            type="button"
            onClick={() => void loadArticles()}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-paper border border-ink/15 text-xs font-semibold text-ink hover:bg-paper-muted"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Làm mới</span>
          </button>
        </div>

        {pendingArticles.length === 0 ? (
          <p className="text-xs text-ink-muted py-4">
            Chưa có bản nháp nào đang chờ duyệt. Bấm &ldquo;AI Săn tin &amp; Tạo bản nháp&rdquo; ở trên để tạo bài mới.
          </p>
        ) : (
          <div className="space-y-3">
            {pendingArticles.map((article) => (
              <div
                key={article.id}
                className="p-4 rounded-xl bg-paper border border-ink/15 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2.5 py-0.5 rounded-pill bg-sky-500/10 border border-sky-500/30 text-sky-700 text-[11px] font-mono font-semibold">
                        {article.category}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-pill bg-white border border-ink/15 text-ink-muted text-[11px] font-mono">
                        {article.sourceType === "ai_curated" ? "AI Curated" : "Admin"}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-ink">{article.title}</h4>
                    <p className="text-xs text-ink-muted">{article.summary}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleLoadIntoEditor(article)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-pill bg-white border border-ink/15 text-xs font-semibold text-ink hover:bg-paper-muted"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Chỉnh sửa</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleStatusChange(article.id, "published")}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-pill bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Duyệt xuất bản</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(article.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-pill bg-rose-500/10 border border-rose-500/30 text-rose-700 text-xs font-semibold hover:bg-rose-500/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Từ chối/Xóa</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold uppercase font-mono text-ink">
            {editingId ? "Chỉnh sửa bài báo / số liệu" : "Tạo bài báo / Số liệu mới"}
          </h3>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
            >
              <X className="w-3.5 h-3.5" />
              <span>Hủy chỉnh sửa</span>
            </button>
          )}
        </div>

        <form onSubmit={(e) => void handleSaveArticle(e, "published")} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-semibold text-ink">Tiêu đề bài viết</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Thống kê kỹ năng giao tiếp phỏng vấn IT 2026"
                className="w-full px-3 py-2 text-sm bg-paper border border-ink/15 rounded-xl text-ink focus:outline-none focus:border-ink"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink">Chuyên mục</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ResearchCategory)}
                className="w-full px-3 py-2 text-sm bg-paper border border-ink/15 rounded-xl text-ink focus:outline-none focus:border-ink"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink">Tóm tắt ngắn</label>
            <textarea
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Tóm tắt điểm chính của bài nghiên cứu trong 1-2 câu..."
              className="w-full px-3 py-2 text-sm bg-paper border border-ink/15 rounded-xl text-ink focus:outline-none focus:border-ink resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink">Nội dung Markdown</label>
            <textarea
              rows={6}
              value={contentMarkdown}
              onChange={(e) => setContentMarkdown(e.target.value)}
              placeholder="## Tiêu đề mục&#10;- Ý chính 1&#10;- Ý chính 2"
              className="w-full px-3 py-2 text-sm font-mono bg-paper border border-ink/15 rounded-xl text-ink focus:outline-none focus:border-ink"
            />
          </div>

          <div className="space-y-2 pt-2 border-t border-paper-muted">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink">
                Thẻ số liệu thống kê (Metric Cards)
              </span>
              <button
                type="button"
                onClick={() =>
                  setMetricsJson((prev) => [...prev, { label: "", value: "", highlight: "" }])
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill bg-paper border border-ink/15 text-xs font-semibold text-ink hover:bg-paper-muted"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm số liệu</span>
              </button>
            </div>

            <div className="space-y-2">
              {metricsJson.map((metric, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Nhãn (VD: Điểm Nói)"
                    value={metric.label}
                    onChange={(e) =>
                      setMetricsJson((prev) =>
                        prev.map((m, i) => (i === idx ? { ...m, label: e.target.value } : m))
                      )
                    }
                    className="sm:col-span-4 px-3 py-1.5 text-xs bg-paper border border-ink/15 rounded-lg text-ink"
                  />
                  <input
                    type="text"
                    placeholder="Giá trị (VD: 461)"
                    value={metric.value}
                    onChange={(e) =>
                      setMetricsJson((prev) =>
                        prev.map((m, i) => (i === idx ? { ...m, value: e.target.value } : m))
                      )
                    }
                    className="sm:col-span-3 px-3 py-1.5 text-xs font-mono bg-paper border border-ink/15 rounded-lg text-ink"
                  />
                  <input
                    type="text"
                    placeholder="Ghi chú nổi bật (tùy chọn)"
                    value={metric.highlight ?? ""}
                    onChange={(e) =>
                      setMetricsJson((prev) =>
                        prev.map((m, i) => (i === idx ? { ...m, highlight: e.target.value } : m))
                      )
                    }
                    className="sm:col-span-4 px-3 py-1.5 text-xs bg-paper border border-ink/15 rounded-lg text-ink"
                  />
                  <button
                    type="button"
                    aria-label="Xóa thẻ số liệu"
                    onClick={() =>
                      setMetricsJson((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="sm:col-span-1 p-1.5 rounded-lg text-rose-600 hover:bg-rose-500/10 justify-self-end"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={(e) => void handleSaveArticle(e, "pending_review")}
              className="px-4 py-2 rounded-pill bg-paper border border-ink/15 text-xs font-semibold text-ink hover:bg-paper-muted disabled:opacity-50"
            >
              Lưu vào hàng chờ
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-pill bg-ink text-white text-xs font-bold hover:bg-ink-muted disabled:opacity-50"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{editingId ? "Cập nhật & Xuất bản" : "Xuất bản ngay"}</span>
            </button>
          </div>
        </form>
      </section>

      <section className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft space-y-3">
        <h3 className="text-sm font-bold uppercase font-mono text-ink">
          Đã xuất bản trên /research ({publishedArticles.length})
        </h3>
        <div className="space-y-2.5">
          {publishedArticles.map((article) => (
            <div
              key={article.id}
              className="p-3.5 rounded-xl bg-paper border border-ink/15 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="font-bold text-sm text-ink">{article.title}</div>
                <div className="text-[11px] font-mono text-ink-muted">
                  /{article.slug} · {article.category} · {article.metricsJson.length} số liệu
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/research/${article.slug}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-pill bg-white border border-ink/15 text-xs font-semibold text-ink hover:bg-paper-muted"
                >
                  <span>Xem</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
                <button
                  type="button"
                  onClick={() => handleLoadIntoEditor(article)}
                  className="px-3 py-1 rounded-pill bg-white border border-ink/15 text-xs font-semibold text-ink hover:bg-paper-muted"
                >
                  Sửa
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(article.id)}
                  className="p-1.5 rounded-pill text-rose-600 hover:bg-rose-500/10"
                  title="Xóa bài viết"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Edit3,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
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
import {
  AdminBulkActionBar,
  AdminDeleteConfirmModal,
  type DeleteConfirmRequest,
} from "./AdminDeleteConfirmModal";

interface AdminResearchTabProps {
  onUnauthorized: () => void;
}

const PAGE_SIZE = 6;

const CATEGORY_OPTIONS: Array<{ value: ResearchCategory; label: string }> = [
  { value: "hr_interview", label: "HR Interview Trends" },
  { value: "tech_news", label: "Tech & AI News" },
  { value: "benchmark", label: "IT English Benchmarks" },
  { value: "case_study", label: "Case Study" },
];

const CATEGORY_FILTER_TABS: Array<{
  value: "all" | ResearchCategory;
  label: string;
}> = [
  { value: "all", label: "Tất cả" },
  { value: "hr_interview", label: "HR Interview" },
  { value: "tech_news", label: "Tech & AI" },
  { value: "benchmark", label: "Benchmarks" },
  { value: "case_study", label: "Case Study" },
];

export function AdminResearchTab({ onUnauthorized }: AdminResearchTabProps) {
  const [articles, setArticles] = useState<ResearchArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<ResearchCategory>("hr_interview");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [activeSubTab, setActiveSubTab] = useState<"list" | "compose">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | ResearchCategory>("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending_review" | "published"
  >("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedPreviewId, setExpandedPreviewId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteRequest, setDeleteRequest] = useState<DeleteConfirmRequest | null>(null);

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
      } else {
        setErrorMessage("Không thể tải danh sách bài nghiên cứu.");
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
    setActiveSubTab("compose");
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
      setActiveSubTab("list");
      setStatusFilter("pending_review");
      setCurrentPage(1);
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
    setStatusMessage(null);
    try {
      const res = await fetch("/api/admin/research", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus }),
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok !== false) {
        setStatusMessage(
          nextStatus === "published"
            ? "Đã duyệt và xuất bản bài viết lên /research."
            : "Đã cập nhật trạng thái bài viết."
        );
        await loadArticles();
      } else {
        setErrorMessage(data.error ?? "Không thể cập nhật trạng thái bài viết.");
      }
    } catch {
      setErrorMessage("Lỗi kết nối khi cập nhật trạng thái bài viết.");
    }
  };

  const executeDeleteArticles = async (idsToDelete: string[], okText: string) => {
    if (idsToDelete.length === 0) return false;
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/admin/research", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: idsToDelete }),
      });
      if (res.status === 401) {
        onUnauthorized();
        return false;
      }
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (res.ok && data.ok !== false) {
        if (editingId && idsToDelete.includes(editingId)) {
          resetForm();
        }
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (const id of idsToDelete) next.delete(id);
          return next;
        });
        setStatusMessage(okText);
        await loadArticles();
        return true;
      }
      setErrorMessage(data.error ?? "Không thể xóa bài viết.");
      return false;
    } catch {
      setErrorMessage("Lỗi kết nối khi xóa bài viết.");
      return false;
    }
  };

  const handleDelete = (article: ResearchArticle) => {
    setDeleteRequest({
      title: `Bạn có chắc chắn muốn xóa bài nghiên cứu "${article.title}"?`,
      description:
        "Bài viết và toàn bộ số liệu đính kèm sẽ bị xóa vĩnh viễn khỏi cơ sở dữ liệu.",
      itemCount: 1,
      itemPreviewLabels: [article.title],
      confirmButtonLabel: "Xóa bài viết",
      onConfirm: () => executeDeleteArticles([article.id], "Đã xóa bài viết."),
    });
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
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        article?: ResearchArticle;
      };
      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "Không thể lưu bài viết.");
        return;
      }
      const savedStatus = data.article?.status ?? targetStatus;
      const savedTitle = data.article?.title ?? title.trim();
      setStatusMessage(
        savedStatus === "published"
          ? `Đã xuất bản bài viết "${savedTitle}" lên /research.`
          : `Đã lưu bản nháp "${savedTitle}" vào hàng chờ duyệt.`
      );
      resetForm();
      await loadArticles();
      setActiveSubTab("list");
    } catch {
      setErrorMessage("Lỗi kết nối khi lưu bài viết.");
    } finally {
      setIsSaving(false);
    }
  };

  const pendingCount = useMemo(
    () => articles.filter((a) => a.status === "pending_review").length,
    [articles]
  );
  const publishedCount = useMemo(
    () => articles.filter((a) => a.status === "published").length,
    [articles]
  );

  const filteredArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return articles.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) {
        return false;
      }
      if (categoryFilter !== "all" && a.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.slug.toLowerCase().includes(q)
      );
    });
  }, [articles, categoryFilter, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredArticles.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedArticles = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredArticles.slice(start, start + PAGE_SIZE);
  }, [filteredArticles, safePage]);

  const selectedArticles = useMemo(
    () => articles.filter((a) => selectedIds.has(a.id)),
    [articles, selectedIds]
  );

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pageArticleIds = paginatedArticles.map((a) => a.id);
  const allPageSelected =
    pageArticleIds.length > 0 && pageArticleIds.every((id) => selectedIds.has(id));

  const toggleSelectPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const id of pageArticleIds) next.delete(id);
      } else {
        for (const id of pageArticleIds) next.add(id);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const a of filteredArticles) next.add(a.id);
      return next;
    });
  };

  const handleBulkDelete = () => {
    if (selectedArticles.length === 0) return;
    const count = selectedArticles.length;
    setDeleteRequest({
      title: `Bạn có chắc chắn muốn xóa ${count} bài nghiên cứu đã chọn?`,
      description:
        "Tất cả bài viết đã chọn sẽ bị xóa vĩnh viễn khỏi cơ sở dữ liệu và trang /research.",
      itemCount: count,
      itemPreviewLabels: selectedArticles.map((a) => a.title),
      confirmButtonLabel: `Xóa ${count} bài viết`,
      onConfirm: () =>
        executeDeleteArticles(
          selectedArticles.map((a) => a.id),
          `Đã xóa hàng loạt ${count} bài nghiên cứu.`
        ),
    });
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-ink/15 rounded-2xl p-4 shadow-soft flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <FileText className="w-5 h-5 text-accent shrink-0" aria-hidden="true" />
          <div>
            <h2 className="text-base font-bold text-ink">
              Trung Tâm Nghiên Cứu & Số Liệu ({articles.length})
            </h2>
            <p className="text-xs text-ink-muted">
              Quản lý bài nghiên cứu, thống kê chuẩn hóa và bản nháp AI săn tin công nghệ.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-pill bg-paper p-1 border border-ink/15">
            <button
              type="button"
              onClick={() => setActiveSubTab("list")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-pill text-xs font-semibold transition-colors ${
                activeSubTab === "list"
                  ? "bg-ink text-white shadow-soft"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <span>Danh sách bài nghiên cứu ({articles.length})</span>
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-pill bg-amber-500 text-white text-[10px] font-mono">
                  {pendingCount} chờ
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("compose")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-pill text-xs font-semibold transition-colors ${
                activeSubTab === "compose"
                  ? "bg-accent text-white shadow-soft"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>+ Soạn bài / AI Tổng hợp</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => void loadArticles()}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white border border-ink/15 text-xs font-semibold text-ink hover:bg-paper-muted"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs font-semibold text-emerald-700">
          {statusMessage}
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-semibold text-rose-700">
          {errorMessage}
        </div>
      )}

      {activeSubTab === "compose" ? (
        <div className="space-y-4">
          <div className="bg-white border border-ink/15 rounded-2xl p-4 shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase text-sky-700">
                <Sparkles className="w-4 h-4 text-sky-500" />
                <span>AI Research Curator (GitHub, StackOverflow, InfoQ, Lobsters, Cloudflare, arXiv &amp; Dev.to)</span>
              </div>
              <p className="text-xs text-ink-muted">
                Tự động săn tin công nghệ & tạo bản nháp vào hàng chờ kiểm duyệt (`pending_review`).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <select
                aria-label="Chọn chủ đề AI săn tin"
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value as ResearchCategory)}
                className="px-3 py-1.5 rounded-xl bg-paper border border-ink/15 text-xs font-medium text-ink focus:outline-none"
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
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-pill bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-soft disabled:opacity-50 transition-all"
              >
                {isGenerating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>{isGenerating ? "Đang săn tin..." : "AI Săn tin & Tạo bản nháp"}</span>
              </button>
            </div>
          </div>

          <section className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-ink/10 pb-3">
              <h3 className="text-sm font-bold uppercase font-mono text-ink">
                {editingId ? "Chỉnh sửa bài báo / số liệu" : "Tạo bài báo / Số liệu mới"}
              </h3>
              <div className="flex items-center gap-2">
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
                <button
                  type="button"
                  onClick={() => setActiveSubTab("list")}
                  className="text-xs font-mono text-ink-muted hover:text-ink"
                >
                  Quay lại danh sách
                </button>
              </div>
            </div>

            <form onSubmit={(e) => void handleSaveArticle(e, "published")} className="space-y-3.5">
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
                  rows={5}
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
                            prev.map((m, i) =>
                              i === idx ? { ...m, highlight: e.target.value } : m
                            )
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
                  <span>{editingId ? "Cập nhật & Xuất bản" : "Tạo & xuất bản ngay"}</span>
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-white border border-ink/15 rounded-2xl p-3.5 shadow-soft flex flex-col gap-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
              <div className="relative flex-1 max-w-md">
                <Search
                  className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Tìm kiếm tiêu đề, tóm tắt hoặc slug..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-paper border border-ink/15 rounded-pill text-ink focus:outline-none focus:border-ink"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("all");
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-pill text-xs font-semibold transition-colors ${
                    statusFilter === "all"
                      ? "bg-ink text-white"
                      : "bg-paper border border-ink/15 text-ink-muted hover:text-ink"
                  }`}
                >
                  Tất cả ({articles.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("pending_review");
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-pill text-xs font-semibold transition-colors ${
                    statusFilter === "pending_review"
                      ? "bg-amber-600 text-white"
                      : "bg-paper border border-ink/15 text-ink-muted hover:text-ink"
                  }`}
                >
                  Chờ duyệt ({pendingCount})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("published");
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-pill text-xs font-semibold transition-colors ${
                    statusFilter === "published"
                      ? "bg-emerald-600 text-white"
                      : "bg-paper border border-ink/15 text-ink-muted hover:text-ink"
                  }`}
                >
                  Đã xuất bản ({publishedCount})
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {CATEGORY_FILTER_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(tab.value);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1 rounded-pill text-[11px] font-mono font-semibold transition-colors ${
                    categoryFilter === tab.value
                      ? "bg-ink text-white"
                      : "bg-paper border border-ink/15 text-ink-muted hover:text-ink"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <AdminBulkActionBar
            selectedCount={selectedArticles.length}
            totalFilteredCount={filteredArticles.length}
            allPageSelected={allPageSelected}
            pageCount={paginatedArticles.length}
            itemUnitLabel="bài viết"
            onToggleSelectPage={toggleSelectPage}
            onSelectAllFiltered={selectAllFiltered}
            onClearSelection={() => setSelectedIds(new Set())}
            onBulkDelete={handleBulkDelete}
          />

          {paginatedArticles.length === 0 ? (
            <div className="bg-white border border-ink/15 rounded-2xl p-8 text-center text-xs text-ink-muted">
              Không có bài nghiên cứu nào khớp bộ lọc. Bấm &ldquo;+ Soạn bài / AI Tổng hợp&rdquo; để tạo bài mới.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {paginatedArticles.map((article) => {
                const isPending = article.status === "pending_review";
                const isExpanded = expandedPreviewId === article.id;
                const isSelected = selectedIds.has(article.id);

                return (
                  <div
                    key={article.id}
                    className={`bg-white border rounded-xl p-4 shadow-soft flex flex-col justify-between gap-3 transition-colors ${
                      isSelected ? "border-accent ring-1 ring-accent/30" : "border-ink/15"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectId(article.id)}
                            aria-label={`Chọn bài viết ${article.title}`}
                            className="w-4 h-4 rounded accent-[#E5484D] cursor-pointer shrink-0"
                          />
                          <span
                            className={`px-2 py-0.5 rounded-pill text-[10px] font-mono font-bold ${
                              isPending
                                ? "bg-amber-500/15 border border-amber-500/40 text-amber-800"
                                : "bg-emerald-500/15 border border-emerald-500/30 text-emerald-800"
                            }`}
                          >
                            {isPending ? "Chờ duyệt" : "Đã xuất bản"}
                          </span>
                          <span className="px-2 py-0.5 rounded-pill bg-sky-500/10 border border-sky-500/30 text-sky-700 text-[10px] font-mono font-semibold">
                            {article.category}
                          </span>
                          <span className="px-2 py-0.5 rounded-pill bg-paper border border-ink/15 text-ink-muted text-[10px] font-mono">
                            {article.sourceType === "ai_curated" ? "AI Curated" : "Admin"}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-ink-muted">
                          {article.metricsJson.length} số liệu
                        </span>
                      </div>

                      <h4 className="font-bold text-sm text-ink line-clamp-1">
                        {article.title}
                      </h4>
                      <p className="text-xs text-ink-muted line-clamp-2">
                        {article.summary}
                      </p>

                      {isExpanded && (
                        <div className="mt-2 p-2.5 rounded-lg bg-paper border border-ink/10 max-h-36 overflow-y-auto text-[11px] font-mono text-ink whitespace-pre-wrap">
                          {article.contentMarkdown}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-ink/10">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedPreviewId(isExpanded ? null : article.id)
                        }
                        className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-ink-muted hover:text-ink"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5" />
                            <span>Thu gọn Markdown</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" />
                            <span>Xem nhanh Markdown</span>
                          </>
                        )}
                      </button>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {!isPending && (
                          <Link
                            href={`/research/${article.slug}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill bg-paper border border-ink/15 text-[11px] font-semibold text-ink hover:bg-paper-muted"
                          >
                            <span>Xem</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={() => handleLoadIntoEditor(article)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill bg-white border border-ink/15 text-[11px] font-semibold text-ink hover:bg-paper-muted"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Sửa</span>
                        </button>
                        {isPending && (
                          <button
                            type="button"
                            onClick={() => void handleStatusChange(article.id, "published")}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700"
                          >
                            <Check className="w-3 h-3" />
                            <span>Duyệt</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(article)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill bg-rose-500/10 border border-rose-500/30 text-rose-700 text-[11px] font-semibold hover:bg-rose-500/20"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Xóa</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="bg-white border border-ink/15 rounded-2xl px-4 py-2.5 shadow-soft flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-ink-muted font-mono">
              Hiển thị {paginatedArticles.length} / {filteredArticles.length} bài viết · Trang{" "}
              {safePage} / {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-pill bg-paper border border-ink/15 font-semibold text-ink hover:bg-paper-muted disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Trước</span>
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-pill bg-paper border border-ink/15 font-semibold text-ink hover:bg-paper-muted disabled:opacity-40"
              >
                <span>Sau</span>
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminDeleteConfirmModal
        request={deleteRequest}
        onClose={() => setDeleteRequest(null)}
      />
    </div>
  );
}

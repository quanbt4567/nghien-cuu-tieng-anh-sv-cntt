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
import { AdminImageField } from "./AdminImageField";

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
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [author, setAuthor] = useState("SpeakIT Research Team");
  const [publishDate, setPublishDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [tagsText, setTagsText] = useState("");
  const [markdownMode, setMarkdownMode] = useState<"edit" | "preview">("edit");
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [contentMarkdown, setContentMarkdown] = useState("");
  const [metricsJson, setMetricsJson] = useState<ResearchMetricItem[]>([
    { label: "", value: "", highlight: "" },
  ]);
  const [sourceUrls, setSourceUrls] = useState<ResearchSourceUrl[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const loadArticles = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
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
    setCoverImageUrl("");
    setAuthor("SpeakIT Research Team");
    setPublishDate(new Date().toISOString().slice(0, 10));
    setTagsText("");
    setMarkdownMode("edit");
    setPublishConfirmOpen(false);
    setContentMarkdown("");
    setMetricsJson([{ label: "", value: "", highlight: "" }]);
    setSourceUrls([]);
  };

  const handleLoadIntoEditor = (article: ResearchArticle) => {
    setEditingId(article.id);
    setTitle(article.title);
    setSummary(article.summary);
    setCategory(article.category);
    setCoverImageUrl(article.coverImageUrl ?? "");
    setAuthor("SpeakIT Research Team");
    setPublishDate((article.publishedAt ?? article.createdAt).slice(0, 10));
    setTagsText("");
    setMarkdownMode("edit");
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

  const executeSaveArticle = async (targetStatus: "published" | "pending_review") => {
    if (!title.trim() || !summary.trim() || !contentMarkdown.trim()) {
      setErrorMessage("Vui lòng nhập đầy đủ Tiêu đề, Tóm tắt và Nội dung Markdown.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const parsedTags = tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await fetch("/api/admin/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId ?? undefined,
          title: title.trim(),
          summary: summary.trim(),
          category,
          coverImageUrl: coverImageUrl.trim() || null,
          author: author.trim() || undefined,
          publishDate: publishDate || undefined,
          tags: parsedTags.length > 0 ? parsedTags : undefined,
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

  const handleSaveArticle = (
    e: FormEvent,
    targetStatus: "published" | "pending_review"
  ) => {
    e.preventDefault();
    if (!title.trim() || !summary.trim() || !contentMarkdown.trim()) {
      setErrorMessage("Vui lòng nhập đầy đủ Tiêu đề, Tóm tắt và Nội dung Markdown.");
      return;
    }
    if (targetStatus === "published") {
      setErrorMessage(null);
      setPublishConfirmOpen(true);
      return;
    }
    void executeSaveArticle(targetStatus);
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
      <div className="liquid-glass-card p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <FileText className="w-5 h-5 text-blue-700 dark:text-blue-400 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Trung Tâm Nghiên Cứu & Số Liệu ({articles.length})
            </h2>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Quản lý bài nghiên cứu, thống kê chuẩn hóa và bản nháp AI săn tin công nghệ.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveSubTab("list")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                activeSubTab === "list"
                  ? "bg-blue-50 dark:bg-blue-950/50 border border-blue-700 dark:border-blue-500 text-blue-700 dark:text-blue-300"
                  : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              <span>Danh sách bài nghiên cứu ({articles.length})</span>
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-[11px] font-mono">
                  {pendingCount} chờ
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("compose")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                activeSubTab === "compose"
                  ? "bg-blue-50 dark:bg-blue-950/50 border border-blue-700 dark:border-blue-500 text-blue-700 dark:text-blue-300"
                  : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Soạn bài / AI Tổng hợp</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => void loadArticles()}
            aria-busy={isLoading}
            className="liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>{isLoading ? "Đang tải…" : "Làm mới"}</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/40 border border-green-300 dark:border-green-800 text-sm font-semibold text-green-700 dark:text-green-300">
          {statusMessage}
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-sm font-semibold text-red-700 dark:text-red-300">
          {errorMessage}
        </div>
      )}

      {activeSubTab === "compose" ? (
        <div className="space-y-4">
          <div className="liquid-glass-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase text-blue-700 dark:text-blue-400">
                <Sparkles className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                <span>AI Research Curator (GitHub, StackOverflow, InfoQ, Lobsters, Cloudflare, arXiv &amp; Dev.to)</span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Tự động săn tin công nghệ & tạo bản nháp vào hàng chờ kiểm duyệt (`pending_review`).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <select
                aria-label="Chọn chủ đề AI săn tin"
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value as ResearchCategory)}
                className="liquid-glass-input px-3 py-1.5 rounded-lg text-xs font-medium [&>option]:bg-white dark:[&>option]:bg-slate-900 [&>option]:text-slate-900 dark:[&>option]:text-slate-100"
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
                className="liquid-btn-primary inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 transition-colors"
              >
                {isGenerating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>{isGenerating ? "Đang săn tin…" : "AI Săn tin & Tạo bản nháp"}</span>
              </button>
            </div>
          </div>

          <section className="liquid-glass-card p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">
                {editingId ? "Chỉnh sửa bài báo / số liệu" : "Tạo bài báo / Số liệu mới"}
              </h3>
            </div>

            <form onSubmit={(e) => handleSaveArticle(e, "published")} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label htmlFor="research-title" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tiêu đề bài viết</label>
                  <input
                    id="research-title"
                    name="title"
                    type="text"
                    autoComplete="off"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="VD: Thống kê kỹ năng giao tiếp phỏng vấn IT 2026"
                    className="liquid-glass-input w-full px-3 py-2 text-sm rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="research-category" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Chuyên mục</label>
                  <select
                    id="research-category"
                    name="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ResearchCategory)}
                    className="liquid-glass-input w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 [&>option]:bg-white dark:[&>option]:bg-slate-900 [&>option]:text-slate-900 dark:[&>option]:text-slate-100"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label htmlFor="research-author" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tác giả</label>
                  <input
                    id="research-author"
                    name="author"
                    type="text"
                    autoComplete="off"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="VD: SpeakIT Research Team"
                    className="liquid-glass-input w-full px-3 py-2 text-sm rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="research-date" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Ngày bài viết</label>
                  <input
                    id="research-date"
                    name="publishDate"
                    type="date"
                    value={publishDate}
                    onChange={(e) => setPublishDate(e.target.value)}
                    className="liquid-glass-input w-full px-3 py-2 text-sm font-mono rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="research-tags" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tags (phân tách dấu phẩy)</label>
                  <input
                    id="research-tags"
                    name="tags"
                    type="text"
                    autoComplete="off"
                    value={tagsText}
                    onChange={(e) => setTagsText(e.target.value)}
                    placeholder="EF EPI, IT English, Interview"
                    className="liquid-glass-input w-full px-3 py-2 text-sm rounded-lg"
                  />
                </div>
              </div>

              <AdminImageField
                label="Ảnh bìa"
                value={coverImageUrl}
                onChange={setCoverImageUrl}
                allowGenerate={true}
                placeholder="https://... hoặc /research-covers/..."
              />

              <div className="space-y-1">
                <label htmlFor="research-summary" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tóm tắt ngắn</label>
                <textarea
                  id="research-summary"
                  name="summary"
                  rows={2}
                  autoComplete="off"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Tóm tắt điểm chính của bài nghiên cứu trong 1-2 câu…"
                  className="liquid-glass-input w-full px-3 py-2 text-sm rounded-lg resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="research-markdown" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nội dung Markdown</label>
                  <div className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setMarkdownMode("edit")}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold transition-colors ${
                        markdownMode === "edit"
                          ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300"
                          : "text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      Soạn thảo
                    </button>
                    <button
                      type="button"
                      onClick={() => setMarkdownMode("preview")}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold transition-colors ${
                        markdownMode === "preview"
                          ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300"
                          : "text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      Xem trước Markdown
                    </button>
                  </div>
                </div>
                {markdownMode === "edit" ? (
                  <textarea
                    id="research-markdown"
                    name="contentMarkdown"
                    rows={6}
                    autoComplete="off"
                    value={contentMarkdown}
                    onChange={(e) => setContentMarkdown(e.target.value)}
                    placeholder="## Tiêu đề mục&#10;- Ý chính 1&#10;- Ý chính 2"
                    className="liquid-glass-input w-full px-3 py-2 text-sm font-mono rounded-lg"
                  />
                ) : (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-4 space-y-2 min-h-[160px] text-sm text-slate-800 dark:text-slate-200">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-2">
                      <span>{author.trim() || "SpeakIT Research Team"}</span>
                      <span>·</span>
                      <span>{publishDate}</span>
                      {tagsText.trim() && (
                        <>
                          <span>·</span>
                          <span>{tagsText}</span>
                        </>
                      )}
                    </div>
                    {contentMarkdown.trim() ? (
                      contentMarkdown.split(/\r?\n/).map((line, i) => {
                        const trimmed = line.trim();
                        if (!trimmed) return <div key={i} className="h-1" />;
                        if (trimmed.startsWith("### ")) {
                          return <h4 key={i} className="text-sm font-bold text-slate-900 dark:text-slate-100 pt-1">{trimmed.slice(4)}</h4>;
                        }
                        if (trimmed.startsWith("## ")) {
                          return <h3 key={i} className="text-base font-bold text-slate-900 dark:text-slate-100 pt-1.5">{trimmed.slice(3)}</h3>;
                        }
                        if (trimmed.startsWith("# ")) {
                          return <h2 key={i} className="text-lg font-bold text-slate-900 dark:text-slate-100 pt-2">{trimmed.slice(2)}</h2>;
                        }
                        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                          return <li key={i} className="ml-4 list-disc">{trimmed.slice(2)}</li>;
                        }
                        return <p key={i} className="leading-relaxed">{trimmed}</p>;
                      })
                    ) : (
                      <p className="text-xs italic text-slate-500 dark:text-slate-400">Chưa có nội dung Markdown để xem trước.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Thẻ số liệu thống kê (Metric Cards)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setMetricsJson((prev) => [...prev, { label: "", value: "", highlight: "" }])
                    }
                    className="liquid-glass-btn inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Thêm số liệu</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {metricsJson.map((metric, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <input
                        name={`metricLabel-${idx}`}
                        type="text"
                        autoComplete="off"
                        aria-label={`Nhãn số liệu ${idx + 1}`}
                        placeholder="Nhãn (VD: Điểm Nói)"
                        value={metric.label}
                        onChange={(e) =>
                          setMetricsJson((prev) =>
                            prev.map((m, i) => (i === idx ? { ...m, label: e.target.value } : m))
                          )
                        }
                        className="liquid-glass-input sm:col-span-4 px-3 py-1.5 text-xs rounded-lg"
                      />
                      <input
                        name={`metricValue-${idx}`}
                        type="text"
                        autoComplete="off"
                        aria-label={`Giá trị số liệu ${idx + 1}`}
                        placeholder="Giá trị (VD: 461)"
                        value={metric.value}
                        onChange={(e) =>
                          setMetricsJson((prev) =>
                            prev.map((m, i) => (i === idx ? { ...m, value: e.target.value } : m))
                          )
                        }
                        className="liquid-glass-input sm:col-span-3 px-3 py-1.5 text-xs font-mono rounded-lg"
                      />
                      <input
                        name={`metricHighlight-${idx}`}
                        type="text"
                        autoComplete="off"
                        aria-label={`Ghi chú nổi bật ${idx + 1}`}
                        placeholder="Ghi chú nổi bật (tùy chọn)"
                        value={metric.highlight ?? ""}
                        onChange={(e) =>
                          setMetricsJson((prev) =>
                            prev.map((m, i) =>
                              i === idx ? { ...m, highlight: e.target.value } : m
                            )
                          )
                        }
                        className="liquid-glass-input sm:col-span-4 px-3 py-1.5 text-xs rounded-lg"
                      />
                      <button
                        type="button"
                        aria-label="Xóa thẻ số liệu"
                        onClick={() =>
                          setMetricsJson((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="sm:col-span-1 p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 justify-self-end"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    resetForm();
                    setActiveSubTab("list");
                  }}
                  className="liquid-glass-btn px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={(e) => handleSaveArticle(e, "pending_review")}
                  className="liquid-glass-btn px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  Lưu vào hàng chờ
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="liquid-btn-primary inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                  <span>{editingId ? "Cập nhật & Xuất bản" : "Tạo & xuất bản ngay"}</span>
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="liquid-glass-card p-3.5 flex flex-col gap-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
              <div className="relative flex-1 max-w-md">
                <Search
                  className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  name="researchSearch"
                  type="search"
                  autoComplete="off"
                  aria-label="Tìm kiếm bài nghiên cứu"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Tìm kiếm tiêu đề, tóm tắt hoặc slug…"
                  className="liquid-glass-input w-full pl-9 pr-3 py-1.5 text-sm rounded-lg"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("all");
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    statusFilter === "all"
                      ? "bg-blue-50 dark:bg-blue-950/50 border-blue-700 dark:border-blue-500 text-blue-700 dark:text-blue-300"
                      : "liquid-glass-btn text-slate-700 dark:text-slate-300"
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
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    statusFilter === "pending_review"
                      ? "bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-700 text-amber-800 dark:text-amber-300"
                      : "liquid-glass-btn text-slate-700 dark:text-slate-300"
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
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    statusFilter === "published"
                      ? "bg-green-50 dark:bg-green-950/40 border-green-500 dark:border-green-700 text-green-700 dark:text-green-300"
                      : "liquid-glass-btn text-slate-700 dark:text-slate-300"
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
                  className={`px-3 py-1 rounded-full text-xs font-mono font-semibold border transition-colors ${
                    categoryFilter === tab.value
                      ? "bg-blue-50 dark:bg-blue-950/50 border-blue-700 dark:border-blue-500 text-blue-700 dark:text-blue-300"
                      : "liquid-glass-btn text-slate-700 dark:text-slate-300"
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

          {isLoading && articles.length === 0 ? (
            <div className="liquid-glass-card p-8 text-center text-sm text-slate-700 dark:text-slate-300">
              Đang tải danh sách bài nghiên cứu…
            </div>
          ) : paginatedArticles.length === 0 ? (
            <div className="liquid-glass-card p-8 text-center space-y-2 text-sm text-slate-700 dark:text-slate-300">
              <p>
                {articles.length === 0
                  ? 'Chưa có bài nghiên cứu nào. Bấm "Soạn bài / AI Tổng hợp" để tạo bài mới.'
                  : "Không có bài nghiên cứu nào khớp bộ lọc hiện tại."}
              </p>
              {articles.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setCategoryFilter("all");
                    setStatusFilter("all");
                    setCurrentPage(1);
                  }}
                  className="liquid-glass-btn px-3 py-1.5 rounded-lg text-xs font-semibold"
                >
                  Đặt lại bộ lọc
                </button>
              )}
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
                    className={`liquid-glass-card-lite p-4 flex flex-col justify-between gap-3 transition-colors ${
                      isSelected ? "!border-blue-700 dark:!border-blue-500 ring-1 ring-blue-700/35" : ""
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
                            className="w-4 h-4 rounded accent-blue-700 cursor-pointer shrink-0"
                          />
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold border ${
                              isPending
                                ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300"
                                : "bg-green-50 dark:bg-green-950/40 border-green-300 dark:border-green-800 text-green-700 dark:text-green-300"
                            }`}
                          >
                            {isPending ? "Chờ duyệt" : "Đã xuất bản"}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-[11px] font-mono font-semibold">
                            {article.category}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-mono">
                            {article.sourceType === "ai_curated" ? "AI Curated" : "Admin"}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                          {article.metricsJson.length} số liệu
                        </span>
                      </div>

                      {article.coverImageUrl && (
                        <img
                          src={article.coverImageUrl}
                          alt={article.title}
                          className="w-full h-32 object-cover rounded-lg border border-slate-200 dark:border-slate-800"
                        />
                      )}

                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 line-clamp-1">
                        {article.title}
                      </h4>
                      <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">
                        {article.summary}
                      </p>

                      {isExpanded && (
                        <div className="mt-2 border-t border-slate-200 dark:border-slate-800 pt-2.5 max-h-36 overflow-y-auto text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                          {article.contentMarkdown}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedPreviewId(isExpanded ? null : article.id)
                        }
                        className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
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
                            className="liquid-glass-btn inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold"
                          >
                            <span>Xem</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={() => handleLoadIntoEditor(article)}
                          className="liquid-glass-btn inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Sửa</span>
                        </button>
                        {isPending && (
                          <button
                            type="button"
                            onClick={() => void handleStatusChange(article.id, "published")}
                            className="liquid-btn-success inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold"
                          >
                            <Check className="w-3 h-3" />
                            <span>Duyệt</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(article)}
                          className="liquid-btn-danger inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold"
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

          <div className="liquid-glass-card px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-slate-700 dark:text-slate-300 font-mono">
              Hiển thị {paginatedArticles.length}/{filteredArticles.length} bài viết · Trang{" "}
              {safePage}/{totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="liquid-glass-btn inline-flex items-center gap-1 px-3 py-1 rounded-lg font-semibold disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Trước</span>
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="liquid-glass-btn inline-flex items-center gap-1 px-3 py-1 rounded-lg font-semibold disabled:opacity-40"
              >
                <span>Sau</span>
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}

      {publishConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overscroll-contain"
          role="dialog"
          aria-modal="true"
          aria-labelledby="research-publish-confirm-title"
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label="Đóng hộp thoại xác nhận xuất bản"
            onClick={() => {
              if (!isSaving) setPublishConfirmOpen(false);
            }}
            className="fixed inset-0 bg-slate-900/50 cursor-default"
          />
          <div className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-5 space-y-4 text-slate-900 dark:text-slate-100">
            <h3 id="research-publish-confirm-title" className="text-base font-bold">
              Xác nhận xuất bản công khai ngay?
            </h3>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              Bài viết <strong className="font-semibold">&ldquo;{title.trim()}&rdquo;</strong> sẽ được xuất bản công khai ngay lập tức trên trang <code className="font-mono text-xs">/research</code> và hiển thị với tất cả người dùng.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setPublishConfirmOpen(false)}
                className="liquid-glass-btn px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  setPublishConfirmOpen(false);
                  void executeSaveArticle("published");
                }}
                className="liquid-btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                <span>Xác nhận xuất bản ngay</span>
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

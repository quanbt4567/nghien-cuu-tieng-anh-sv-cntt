"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, Loader2, MessageSquare, RefreshCw, Search, Star } from "lucide-react";
import { AdminUserAvatar } from "./AdminUserAvatar";

interface FeedbackItem {
  id: string;
  rating: number;
  category: string | null;
  comment: string | null;
  context: string | null;
  playerName?: string | null;
  avatarUrl?: string | null;
  resolved?: boolean;
  createdAt: string;
}

interface AdminFeedbackTabProps {
  onUnauthorized: () => void;
}

export function AdminFeedbackTab({ onUnauthorized }: AdminFeedbackTabProps) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [ratingFilter, setRatingFilter] = useState<number | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadFeedback = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/feedback", { cache: "no-store" });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      if (res.ok) {
        const data = (await res.json()) as {
          items?: FeedbackItem[];
        };
        setItems(Array.isArray(data.items) ? data.items : []);
      }
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    void loadFeedback();
  }, [loadFeedback]);

  const handleToggleResolved = async (item: FeedbackItem) => {
    const nextResolved = !item.resolved;
    setTogglingId(item.id);
    setItems((prev) =>
      prev.map((row) => (row.id === item.id ? { ...row, resolved: nextResolved } : row))
    );
    try {
      const res = await fetch("/api/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, resolved: nextResolved }),
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      if (!res.ok) {
        setItems((prev) =>
          prev.map((row) => (row.id === item.id ? { ...row, resolved: !nextResolved } : row))
        );
      }
    } catch {
      // Keep local state if offline; Neon DB is optional
    } finally {
      setTogglingId(null);
    }
  };

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (ratingFilter !== "ALL" && item.rating !== ratingFilter) {
        return false;
      }
      if (!q) return true;
      return (
        (item.playerName ?? "").toLowerCase().includes(q) ||
        (item.comment ?? "").toLowerCase().includes(q) ||
        (item.category ?? "").toLowerCase().includes(q) ||
        (item.context ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, ratingFilter, searchQuery]);

  const averageRating = useMemo(() => {
    if (items.length === 0) return "0.0";
    const total = items.reduce((sum, item) => sum + item.rating, 0);
    return (total / items.length).toFixed(1);
  }, [items]);

  const positivePct = useMemo(() => {
    if (items.length === 0) return 0;
    const positive = items.filter((item) => item.rating >= 4).length;
    return Math.round((positive / items.length) * 100);
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="liquid-glass-card p-5">
          <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
            Tổng số góp ý
          </div>
          <div className="text-2xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100 mt-1 font-mono">
            {items.length}
          </div>
        </div>

        <div className="liquid-glass-card p-5">
          <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
            Điểm hài lòng trung bình
          </div>
          <div className="text-2xl font-extrabold tabular-nums text-blue-700 dark:text-blue-400 mt-1 font-mono flex items-center gap-1.5">
            <span>{averageRating}</span>
            <Star className="w-5 h-5 fill-amber-500 text-amber-500" aria-hidden="true" />
          </div>
        </div>

        <div className="liquid-glass-card p-5">
          <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
            Tỷ lệ 4–5 sao
          </div>
          <div className="text-2xl font-extrabold tabular-nums text-green-700 dark:text-green-400 mt-1 font-mono">
            {positivePct}%
          </div>
        </div>
      </div>

      <div className="liquid-glass-card p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(["ALL", 5, 4, 3, 2, 1] as const).map((val) => {
              const active = ratingFilter === val;
              return (
                <button
                  key={String(val)}
                  type="button"
                  onClick={() => setRatingFilter(val)}
                  className={`px-3 py-1 rounded-full text-xs font-mono font-semibold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:focus-visible:ring-blue-400 ${
                    active
                      ? "bg-blue-50 dark:bg-blue-950/50 border-blue-700 dark:border-blue-500 text-blue-700 dark:text-blue-300"
                      : "liquid-glass-btn text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {val === "ALL" ? "Tất cả" : `${val}★`}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search
                className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                name="feedbackSearch"
                type="search"
                autoComplete="off"
                aria-label="Tìm kiếm góp ý theo tên hoặc nội dung"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên người dùng hoặc nội dung…"
                className="liquid-glass-input w-full pl-8 pr-3 py-1.5 text-xs rounded-lg"
              />
            </div>

            <button
              type="button"
              onClick={() => void loadFeedback()}
              disabled={isLoading}
              className="liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:focus-visible:ring-blue-400"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-10 flex items-center justify-center gap-2 text-sm text-slate-700 dark:text-slate-300" role="status" aria-live="polite">
            <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none text-blue-700 dark:text-blue-400" aria-hidden="true" />
            <span>Đang tải danh sách góp ý…</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-10 text-center space-y-2 text-sm text-slate-700 dark:text-slate-300">
            <MessageSquare className="w-6 h-6 mx-auto text-slate-500 dark:text-slate-400" aria-hidden="true" />
            <p>Chưa có góp ý nào phù hợp bộ lọc hiện tại.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
            {filteredItems.map((item) => {
              const displayName = item.playerName?.trim() || "Ẩn danh";
              return (
                <div
                  key={item.id}
                  className={`py-4 space-y-2.5 ${item.resolved ? "opacity-75" : ""}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <AdminUserAvatar
                        name={displayName}
                        avatarUrl={item.avatarUrl}
                        size="sm"
                      />
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {displayName}
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-amber-500">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              s <= item.rating
                                ? "fill-amber-500 text-amber-500"
                                : "text-slate-300 dark:text-slate-600"
                            }`}
                          />
                        ))}
                      </span>
                      {item.category && (
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-mono font-semibold">
                          {item.category}
                        </span>
                      )}
                      {item.context && (
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-mono">
                          {item.context}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                        {new Date(item.createdAt).toLocaleString("vi-VN")}
                      </span>
                      <button
                        type="button"
                        disabled={togglingId === item.id}
                        onClick={() => void handleToggleResolved(item)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold border transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:focus-visible:ring-blue-400 ${
                          item.resolved
                            ? "bg-green-50 dark:bg-green-950/40 border-green-300 dark:border-green-800 text-green-700 dark:text-green-300"
                            : "liquid-glass-btn text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {item.resolved ? (
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        ) : (
                          <Circle className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                        <span>{item.resolved ? "Đã xử lý" : "Đánh dấu đã xử lý"}</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-slate-900 dark:text-slate-100 leading-relaxed pl-9">
                    {item.comment ? (
                      item.comment
                    ) : (
                      <span className="text-slate-600 dark:text-slate-400 italic">
                        (Người dùng chỉ đánh giá sao, không nhập nhận xét)
                      </span>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

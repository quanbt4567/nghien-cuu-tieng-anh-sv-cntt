"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, MessageSquare, RefreshCw, Star } from "lucide-react";

interface FeedbackItem {
  id: string;
  rating: number;
  category: string | null;
  comment: string | null;
  context: string | null;
  createdAt: string;
}

interface AdminFeedbackTabProps {
  onUnauthorized: () => void;
}

export function AdminFeedbackTab({ onUnauthorized }: AdminFeedbackTabProps) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [ratingFilter, setRatingFilter] = useState<number | "ALL">("ALL");

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

  const filteredItems = useMemo(() => {
    if (ratingFilter === "ALL") return items;
    return items.filter((item) => item.rating === ratingFilter);
  }, [items, ratingFilter]);

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
          <div className="text-xs font-mono text-slate-600 dark:text-slate-400 uppercase">
            Tổng số góp ý
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 font-mono">
            {items.length}
          </div>
        </div>

        <div className="liquid-glass-card p-5">
          <div className="text-xs font-mono text-slate-600 dark:text-slate-400 uppercase">
            Điểm hài lòng trung bình
          </div>
          <div className="text-2xl font-extrabold text-blue-700 dark:text-blue-400 mt-1 font-mono flex items-center gap-1.5">
            <span>{averageRating}</span>
            <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
          </div>
        </div>

        <div className="liquid-glass-card p-5">
          <div className="text-xs font-mono text-slate-600 dark:text-slate-400 uppercase">
            Tỷ lệ 4-5 sao
          </div>
          <div className="text-2xl font-extrabold text-green-700 dark:text-green-400 mt-1 font-mono">
            {positivePct}%
          </div>
        </div>
      </div>

      <div className="liquid-glass-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(["ALL", 5, 4, 3, 2, 1] as const).map((val) => {
              const active = ratingFilter === val;
              return (
                <button
                  key={String(val)}
                  type="button"
                  onClick={() => setRatingFilter(val)}
                  className={`px-3 py-1 rounded-full text-xs font-mono font-semibold border transition-colors ${
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

          <button
            type="button"
            onClick={() => void loadFeedback()}
            disabled={isLoading}
            className="liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Làm mới</span>
          </button>
        </div>

        {isLoading ? (
          <div className="py-10 flex items-center justify-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <Loader2 className="w-4 h-4 animate-spin text-blue-700 dark:text-blue-400" />
            <span>Đang tải danh sách góp ý...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-10 text-center space-y-2 text-sm text-slate-700 dark:text-slate-300">
            <MessageSquare className="w-6 h-6 mx-auto text-slate-500 dark:text-slate-400" />
            <p>Chưa có góp ý nào phù hợp bộ lọc hiện tại.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="py-4 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
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
                  <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                    {new Date(item.createdAt).toLocaleString("vi-VN")}
                  </span>
                </div>

                <p className="text-sm text-slate-900 dark:text-slate-100 leading-relaxed">
                  {item.comment ? (
                    item.comment
                  ) : (
                    <span className="text-slate-600 dark:text-slate-400 italic">
                      (Người dùng chỉ đánh giá sao, không nhập nhận xét)
                    </span>
                  )}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

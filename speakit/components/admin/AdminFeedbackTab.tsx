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
  const [connected, setConnected] = useState(true);
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
          connected?: boolean;
          items?: FeedbackItem[];
        };
        setConnected(Boolean(data.connected));
        setItems(Array.isArray(data.items) ? data.items : []);
      }
    } catch {
      setConnected(false);
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
        <div className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft">
          <div className="text-xs font-mono text-ink-muted uppercase">
            Tổng số góp ý
          </div>
          <div className="text-2xl font-extrabold text-ink mt-1 font-mono">
            {items.length}
          </div>
        </div>

        <div className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft">
          <div className="text-xs font-mono text-ink-muted uppercase">
            Điểm hài lòng trung bình
          </div>
          <div className="text-2xl font-extrabold text-sky-700 mt-1 font-mono flex items-center gap-1.5">
            <span>{averageRating}</span>
            <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
          </div>
        </div>

        <div className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft">
          <div className="text-xs font-mono text-ink-muted uppercase">
            Tỷ lệ 4–5 sao
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-1 font-mono">
            {positivePct}%
          </div>
        </div>
      </div>

      <div className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(["ALL", 5, 4, 3, 2, 1] as const).map((val) => {
              const active = ratingFilter === val;
              return (
                <button
                  key={String(val)}
                  type="button"
                  onClick={() => setRatingFilter(val)}
                  className={`px-3 py-1 rounded-pill text-xs font-mono font-semibold border transition-all ${
                    active
                      ? "bg-ink text-white border-ink"
                      : "bg-paper text-ink border-ink/15 hover:bg-paper-muted"
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-paper border border-ink/15 text-xs font-semibold text-ink hover:bg-paper-muted disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Làm mới</span>
          </button>
        </div>

        {!connected && (
          <div className="p-3 rounded-xl bg-paper-muted border border-ink/15 text-xs text-ink-muted">
            Chưa kết nối Neon Postgres hoặc chưa có dữ liệu phản hồi từ máy chủ.
          </div>
        )}

        {isLoading ? (
          <div className="py-10 flex items-center justify-center gap-2 text-xs text-ink-muted">
            <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
            <span>Đang tải danh sách góp ý...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-10 text-center space-y-2 text-xs text-ink-muted">
            <MessageSquare className="w-6 h-6 mx-auto text-ink-faint" />
            <p>Chưa có góp ý nào phù hợp bộ lọc hiện tại.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-paper border border-ink/15 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-0.5 text-amber-500">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3.5 h-3.5 ${
                            s <= item.rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-ink/20"
                          }`}
                        />
                      ))}
                    </span>
                    {item.category && (
                      <span className="px-2.5 py-0.5 rounded-pill bg-sky-500/10 border border-sky-500/30 text-sky-700 text-[11px] font-mono font-semibold">
                        {item.category}
                      </span>
                    )}
                    {item.context && (
                      <span className="px-2.5 py-0.5 rounded-pill bg-white border border-ink/15 text-ink-muted text-[11px] font-mono">
                        {item.context}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-ink-muted">
                    {new Date(item.createdAt).toLocaleString("vi-VN")}
                  </span>
                </div>

                <p className="text-sm text-ink leading-relaxed">
                  {item.comment ? (
                    item.comment
                  ) : (
                    <span className="text-ink-faint italic">
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

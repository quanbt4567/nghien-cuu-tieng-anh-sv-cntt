"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import type { VocabularyItem } from "../../lib/types";

interface VocabExtractorButtonProps {
  title: string;
  summary: string;
  content: string;
  variant?: "card" | "detail";
}

interface ExtractResponse {
  ok: boolean;
  provider?: string;
  persistedCount?: number;
  items?: VocabularyItem[];
  error?: string;
}

const LEVEL_BADGE_CLASSES: Record<"Fresher" | "Junior" | "Senior", string> = {
  Fresher: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  Junior: "bg-sky-500/10 text-sky-700 border-sky-500/30",
  Senior: "bg-amber-500/10 text-amber-700 border-amber-500/30",
};

export function VocabExtractorButton({
  title,
  summary,
  content,
  variant = "card",
}: VocabExtractorButtonProps) {
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<VocabularyItem[]>([]);
  const [provider, setProvider] = useState<string>("local");
  const [persistedCount, setPersistedCount] = useState<number>(0);

  async function handleExtract() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/research/extract-vocab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, summary, content }),
      });
      const data = (await res.json()) as ExtractResponse;
      if (!res.ok || !data.ok || !Array.isArray(data.items)) {
        setError(data.error || "Không thể trích xuất từ vựng lúc này.");
        return;
      }
      setItems(data.items);
      setProvider(data.provider || "local");
      setPersistedCount(data.persistedCount ?? 0);
      setDrawerOpen(true);
    } catch {
      setError("Lỗi kết nối khi trích xuất từ vựng.");
    } finally {
      setLoading(false);
    }
  }

  const clusterTitle = items[0]?.clusterTitle || title;

  return (
    <>
      <button
        type="button"
        onClick={handleExtract}
        disabled={loading}
        className={
          variant === "detail"
            ? "inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-sky-500/10 border border-sky-500/30 text-sky-700 hover:bg-sky-500/20 disabled:opacity-60 text-xs font-bold transition-colors"
            : "inline-flex items-center gap-1 px-3 py-1 rounded-pill bg-sky-500/10 border border-sky-500/30 text-sky-700 hover:bg-sky-500/20 disabled:opacity-60 text-xs font-semibold transition-colors"
        }
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Sparkles className="w-3.5 h-3.5" />
        )}
        <span>{loading ? "Đang trích xuất..." : "AI Trích Xuất Từ Vựng"}</span>
      </button>

      {error && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl bg-white border border-rose-300 shadow-card px-4 py-3 flex items-start gap-2.5 text-xs text-rose-700">
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Đóng thông báo"
            className="text-rose-500 hover:text-rose-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-label="Từ vựng CNTT vừa trích xuất"
        >
          <div className="w-full max-w-lg h-full bg-paper border-l border-ink/15 shadow-card flex flex-col">
            <div className="p-4 sm:p-5 bg-white border-b border-ink/15 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase text-sky-700">
                  <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                  <span>Cụm từ vựng: {clusterTitle}</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-ink">
                  {items.length} thuật ngữ CNTT đã trích xuất
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Đóng bảng từ vựng"
                className="p-1.5 rounded-pill border border-ink/15 bg-paper hover:bg-paper-muted text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 sm:px-5 pt-3">
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs text-emerald-800">
                <div className="inline-flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {persistedCount > 0
                      ? `Đã đồng bộ ${persistedCount} từ vào kho từ vựng`
                      : "Đã trích xuất từ vựng (chế độ xem trước)"}
                  </span>
                </div>
                <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded-pill bg-white/80 border border-emerald-500/20">
                  {provider}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
              {items.map((item) => {
                const level = item.careerLevel ?? "Junior";
                return (
                  <div
                    key={item.id}
                    className="rounded-xl bg-white border border-ink/15 p-4 space-y-2 shadow-soft"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-base font-bold text-ink">
                          {item.term}
                        </span>
                        {item.phonetic && (
                          <span className="text-xs font-mono text-ink-muted">
                            {item.phonetic}
                          </span>
                        )}
                        <span className="text-[11px] font-mono text-ink-muted">
                          ({item.partOfSpeech})
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-pill border text-[11px] font-mono font-semibold ${LEVEL_BADGE_CLASSES[level]}`}
                      >
                        {level}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm font-medium text-ink">
                      {item.meaningVI}
                    </p>

                    {item.exampleSentenceEN && (
                      <div className="rounded-lg bg-paper border border-ink/10 p-2.5 space-y-1">
                        <p className="text-xs font-medium text-ink">
                          {item.exampleSentenceEN}
                        </p>
                        {item.exampleTranslationVI && (
                          <p className="text-[11px] text-ink-muted">
                            {item.exampleTranslationVI}
                          </p>
                        )}
                      </div>
                    )}

                    {item.relatedTerms && item.relatedTerms.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] font-mono uppercase text-ink-muted">
                          Liên quan:
                        </span>
                        {item.relatedTerms.map((rel) => (
                          <span
                            key={rel}
                            className="px-2 py-0.5 rounded-pill bg-paper border border-ink/10 text-[11px] font-mono text-ink"
                          >
                            {rel}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-white border-t border-ink/15 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="px-4 py-2 rounded-pill border border-ink/15 bg-paper text-xs font-semibold text-ink hover:bg-paper-muted"
              >
                Đóng
              </button>
              <Link
                href="/vocabulary"
                onClick={() => setDrawerOpen(false)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-soft transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Mở kho từ vựng</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

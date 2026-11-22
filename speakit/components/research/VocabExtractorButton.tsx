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
  Fresher: "bg-emerald-500/20 text-emerald-200 border-emerald-400/45",
  Junior: "bg-cyan-500/20 text-cyan-200 border-cyan-400/45",
  Senior: "bg-amber-500/20 text-amber-200 border-amber-400/45",
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
            ? "inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-violet-500/25 border border-violet-400/50 text-violet-100 hover:bg-violet-500/35 disabled:opacity-60 text-xs font-bold transition-colors shadow-[0_0_18px_rgba(139,92,246,0.28)]"
            : "inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-violet-500/20 border border-violet-400/45 text-violet-200 hover:bg-violet-500/30 hover:text-white disabled:opacity-60 text-xs font-semibold transition-colors"
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
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-2xl bg-slate-950/90 backdrop-blur-2xl border border-rose-400/50 shadow-2xl px-4 py-3 flex items-start gap-2.5 text-xs text-rose-200">
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Đóng thông báo"
            className="text-rose-300 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/75 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Từ vựng CNTT vừa trích xuất"
        >
          <div className="w-full max-w-lg h-full bg-slate-950/90 backdrop-blur-2xl border-l border-white/20 shadow-2xl flex flex-col">
            <div className="p-4 sm:p-5 bg-white/[0.04] border-b border-white/15 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase text-violet-300">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                  <span>Cụm từ vựng: {clusterTitle}</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  {items.length} thuật ngữ CNTT đã trích xuất
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Đóng bảng từ vựng"
                className="liquid-glass-btn p-1.5 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 sm:px-5 pt-3">
              <div className="rounded-xl bg-emerald-500/15 border border-emerald-400/40 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs text-emerald-200">
                <div className="inline-flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span>
                    {persistedCount > 0
                      ? `Đã đồng bộ ${persistedCount} từ vào kho từ vựng`
                      : "Đã trích xuất từ vựng (chế độ xem trước)"}
                  </span>
                </div>
                <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded-full bg-slate-950/60 border border-emerald-400/35 text-emerald-200">
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
                    className="liquid-glass-card-lite rounded-2xl p-4 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-base font-bold text-white">
                          {item.term}
                        </span>
                        {item.phonetic && (
                          <span className="text-xs font-ipa text-cyan-300">
                            {item.phonetic}
                          </span>
                        )}
                        <span className="text-[11px] font-mono text-slate-400">
                          ({item.partOfSpeech})
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full border text-[11px] font-mono font-semibold ${LEVEL_BADGE_CLASSES[level]}`}
                      >
                        {level}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm font-medium text-slate-100">
                      {item.meaningVI}
                    </p>

                    {item.exampleSentenceEN && (
                      <div className="rounded-xl bg-slate-950/60 border border-white/12 p-2.5 space-y-1">
                        <p className="text-xs font-medium text-white">
                          {item.exampleSentenceEN}
                        </p>
                        {item.exampleTranslationVI && (
                          <p className="text-[11px] text-slate-300">
                            {item.exampleTranslationVI}
                          </p>
                        )}
                      </div>
                    )}

                    {item.relatedTerms && item.relatedTerms.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] font-mono uppercase text-slate-400">
                          Liên quan:
                        </span>
                        {item.relatedTerms.map((rel) => (
                          <span
                            key={rel}
                            className="px-2 py-0.5 rounded-full bg-white/[0.08] border border-white/15 text-[11px] font-mono text-slate-200"
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

            <div className="p-4 bg-white/[0.04] border-t border-white/15 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="liquid-glass-btn px-4 py-2 rounded-full text-xs font-semibold"
              >
                Đóng
              </button>
              <Link
                href="/vocabulary"
                onClick={() => setDrawerOpen(false)}
                className="liquid-btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all"
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

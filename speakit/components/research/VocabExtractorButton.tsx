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
  Fresher:
    "bg-green-50 dark:bg-green-950/50 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800",
  Junior:
    "bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  Senior:
    "bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800",
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
            ? "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 disabled:opacity-60 text-sm font-bold transition-colors"
            : "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 disabled:opacity-60 text-sm font-semibold transition-colors"
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
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl bg-white dark:bg-[#0A0A0A] border border-red-300 dark:border-red-800 shadow-sm px-4 py-3 flex items-start gap-2.5 text-sm text-red-800 dark:text-red-300">
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Đóng thông báo"
            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/50"
          role="dialog"
          aria-modal="true"
          aria-label="Từ vựng CNTT vừa trích xuất"
        >
          <div className="w-full max-w-lg h-full bg-white dark:bg-[#0A0A0A] border-l border-slate-200 dark:border-[#262626] shadow-sm flex flex-col">
            <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-[#262626] flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase text-blue-700 dark:text-blue-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Cụm từ vựng: {clusterTitle}</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-50">
                  {items.length} thuật ngữ CNTT đã trích xuất
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Đóng bảng từ vựng"
                className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 sm:px-5 pt-3">
              <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/50 px-3.5 py-2.5 flex items-center justify-between gap-2 text-sm text-green-900 dark:text-green-200">
                <div className="inline-flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-green-700 dark:text-green-400 shrink-0" />
                  <span>
                    {persistedCount > 0
                      ? `Đã đồng bộ ${persistedCount} từ vào kho từ vựng`
                      : "Đã trích xuất từ vựng (chế độ xem trước)"}
                  </span>
                </div>
                <span className="font-mono text-xs uppercase px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 font-semibold">
                  {provider}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 sm:px-5 divide-y divide-slate-200 dark:divide-[#262626]">
              {items.map((item) => {
                const level = item.careerLevel ?? "Junior";
                return (
                  <div key={item.id} className="py-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-base font-bold text-slate-900 dark:text-slate-50">
                          {item.term}
                        </span>
                        {item.phonetic && (
                          <span className="text-sm font-ipa text-blue-700 dark:text-blue-400">
                            {item.phonetic}
                          </span>
                        )}
                        <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                          ({item.partOfSpeech})
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full border text-xs font-mono font-semibold ${LEVEL_BADGE_CLASSES[level]}`}
                      >
                        {level}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {item.meaningVI}
                    </p>

                    {item.exampleSentenceEN && (
                      <div className="bg-slate-50 dark:bg-[#141414] rounded-lg px-3 py-2 space-y-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {item.exampleSentenceEN}
                        </p>
                        {item.exampleTranslationVI && (
                          <p className="text-sm text-slate-600 dark:text-slate-300">
                            {item.exampleTranslationVI}
                          </p>
                        )}
                      </div>
                    )}

                    {item.relatedTerms && item.relatedTerms.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-xs font-mono uppercase text-slate-600 dark:text-slate-400">
                          Liên quan:
                        </span>
                        {item.relatedTerms.map((rel) => (
                          <span
                            key={rel}
                            className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-200"
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

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-[#262626] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="px-4 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm font-semibold transition-colors"
              >
                Đóng
              </button>
              <Link
                href="/vocabulary"
                onClick={() => setDrawerOpen(false)}
                className="bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                <span>Mở kho từ vựng</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

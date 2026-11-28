"use client";

import { useState, type ReactNode } from "react";
import { Languages } from "lucide-react";

interface ResearchArticleBilingualBodyProps {
  titleVi: string;
  summaryVi: string;
  titleEn?: string | null;
  summaryEn?: string | null;
  viBlocks: ReactNode;
  enBlocks?: ReactNode | null;
}

export function ResearchArticleBilingualBody({
  titleVi,
  summaryVi,
  titleEn,
  summaryEn,
  viBlocks,
  enBlocks,
}: ResearchArticleBilingualBodyProps) {
  const hasEnglish = Boolean(titleEn?.trim() || summaryEn?.trim() || enBlocks);
  const [lang, setLang] = useState<"vi" | "en">("vi");

  const activeTitle = lang === "en" && titleEn?.trim() ? titleEn : titleVi;
  const activeSummary = lang === "en" && summaryEn?.trim() ? summaryEn : summaryVi;
  const activeBlocks = lang === "en" && enBlocks ? enBlocks : viBlocks;

  return (
    <div className="space-y-5">
      {hasEnglish && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-[#334155] bg-slate-50 dark:bg-[#142038] px-4 py-2.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
            <Languages className="w-4 h-4 text-blue-700 dark:text-blue-400" aria-hidden="true" />
            <span>Ngôn ngữ bài viết</span>
          </span>
          <div role="group" aria-label="Chọn ngôn ngữ bài viết" className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5">
            <button
              type="button"
              onClick={() => setLang("vi")}
              aria-pressed={lang === "vi"}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                lang === "vi"
                  ? "bg-blue-700 text-white"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              Tiếng Việt
            </button>
            <button
              type="button"
              onClick={() => setLang("en")}
              aria-pressed={lang === "en"}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                lang === "en"
                  ? "bg-blue-700 text-white"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              English
            </button>
          </div>
        </div>
      )}

      {lang === "en" && (
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 leading-snug">
            {activeTitle}
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            {activeSummary}
          </p>
        </div>
      )}

      <article className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-xl p-6 sm:p-8 space-y-3">
        {activeBlocks}
      </article>
    </div>
  );
}

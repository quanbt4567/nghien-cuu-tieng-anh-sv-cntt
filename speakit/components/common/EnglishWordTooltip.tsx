"use client";

import { useState } from "react";
import { getVietnameseGloss } from "../../lib/beginner-glossary";

export { getVietnameseGloss };

interface InteractiveEnglishTextProps {
  text: string;
  className?: string;
  activeHighlightIndex?: number;
  spokenUntilIndex?: number;
  highlightMode?: "tts" | "plain";
}

export function InteractiveEnglishText({
  text,
  className = "",
  activeHighlightIndex = -1,
  spokenUntilIndex = -1,
  highlightMode = "plain",
}: InteractiveEnglishTextProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const words = text.trim().split(/\s+/).filter(Boolean);

  return (
    <span className={className}>
      {words.map((word, idx) => {
        const gloss = getVietnameseGloss(word);
        const isOpen = selectedIdx === idx && gloss !== null;
        const isActive =
          highlightMode === "tts" && idx === activeHighlightIndex;
        const isSpoken =
          highlightMode === "tts" &&
          spokenUntilIndex > -1 &&
          idx < spokenUntilIndex;

        const baseColorClass = isActive
          ? "bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 ring-1 ring-blue-400 dark:ring-blue-500 px-1 py-0.5 rounded-md transition-colors duration-100"
          : isSpoken
          ? "text-blue-700 dark:text-blue-400 transition-colors duration-100"
          : "transition-colors duration-100";

        if (!gloss) {
          return (
            <span key={`${idx}-${word}`}>
              <span className={baseColorClass}>{word}</span>
              {idx < words.length - 1 ? " " : ""}
            </span>
          );
        }

        return (
          <span key={`${idx}-${word}`} className="relative inline">
            <button
              type="button"
              onClick={() => setSelectedIdx((cur) => (cur === idx ? null : idx))}
              onMouseEnter={() => setSelectedIdx(idx)}
              onMouseLeave={() =>
                setSelectedIdx((cur) => (cur === idx ? null : cur))
              }
              title={gloss}
              aria-label={`${word}: ${gloss}`}
              className={`inline p-0 m-0 border-0 bg-transparent font-inherit text-inherit underline decoration-dotted decoration-blue-600/80 dark:decoration-blue-400/80 underline-offset-4 hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:text-blue-800 dark:hover:text-blue-200 rounded-sm cursor-help ${baseColorClass}`}
            >
              {word}
            </button>
            {isOpen && (
              <span
                role="tooltip"
                className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 z-30 whitespace-nowrap max-w-[230px] truncate px-2.5 py-1 rounded-lg bg-white dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-xs font-sans font-medium shadow-sm pointer-events-none"
              >
                <span className="font-mono font-semibold text-blue-700 dark:text-blue-400">{word.replace(/[^a-zA-Z0-9-]/g, "")}:</span>{" "}
                {gloss}
              </span>
            )}
            {idx < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </span>
  );
}

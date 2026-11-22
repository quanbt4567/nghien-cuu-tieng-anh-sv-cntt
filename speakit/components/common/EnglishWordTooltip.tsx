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
          ? "bg-sky-500/20 text-sky-800 ring-1 ring-sky-400/60 px-1 py-0.5 rounded-md transition-colors duration-100"
          : isSpoken
          ? "text-sky-700 transition-colors duration-100"
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
              className={`inline p-0 m-0 border-0 bg-transparent font-inherit text-inherit underline decoration-dotted decoration-sky-500/80 underline-offset-4 hover:bg-sky-500/15 hover:text-sky-800 rounded-sm cursor-help ${baseColorClass}`}
            >
              {word}
            </button>
            {isOpen && (
              <span
                role="tooltip"
                className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 z-30 whitespace-nowrap max-w-[230px] truncate px-2.5 py-1 rounded-lg bg-white/95 backdrop-blur-xl text-slate-800 border border-slate-200/90 text-[11px] font-sans font-medium shadow-[0_8px_24px_rgba(15,23,42,0.14),inset_0_1px_1px_rgba(255,255,255,0.95)] pointer-events-none"
              >
                <span className="font-mono font-semibold text-sky-700">{word.replace(/[^a-zA-Z0-9-]/g, "")}:</span>{" "}
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

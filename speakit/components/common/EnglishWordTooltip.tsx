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
          ? "bg-amber-200/90 text-ink px-1 py-0.5 rounded-md transition-colors duration-100"
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
              className={`inline p-0 m-0 border-0 bg-transparent font-inherit text-inherit underline decoration-dotted decoration-accent/70 underline-offset-4 hover:bg-amber-100/80 rounded-sm cursor-help ${baseColorClass}`}
            >
              {word}
            </button>
            {isOpen && (
              <span
                role="tooltip"
                className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 z-30 whitespace-nowrap max-w-[230px] truncate px-2.5 py-1 rounded-lg bg-ink text-white text-[11px] font-sans font-medium shadow-md pointer-events-none"
              >
                <span className="font-mono text-amber-300">{word.replace(/[^a-zA-Z0-9-]/g, "")}:</span>{" "}
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

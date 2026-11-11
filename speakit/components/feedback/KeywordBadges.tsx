"use client";

import { Check, X } from "lucide-react";

interface KeywordBadgesProps {
  used: string[];
  missed: string[];
}

export function KeywordBadges({ used, missed }: KeywordBadgesProps) {
  return (
    <div className="bg-white border-2 border-ink rounded-2xl p-4 shadow-hard space-y-3">
      <div className="flex items-center justify-between text-xs font-bold text-ink">
        <span>Từ khóa kỹ thuật CNTT</span>
        <span className="font-mono text-ink-muted">
          {used.length}/{used.length + missed.length} từ đã dùng
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {/* Keywords used */}
        {used.map((kw) => (
          <span
            key={kw}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-medium rounded-pill bg-paper border border-ink text-ink"
          >
            <Check className="w-3.5 h-3.5 text-accent stroke-[3]" />
            <span>{kw}</span>
          </span>
        ))}

        {/* Keywords missed */}
        {missed.map((kw) => (
          <span
            key={kw}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-medium rounded-pill bg-paper-muted border border-ink text-ink-muted line-through decoration-accent decoration-2"
          >
            <X className="w-3.5 h-3.5 text-accent stroke-[2]" />
            <span>{kw}</span>
          </span>
        ))}
      </div>
    </div>
  );
}


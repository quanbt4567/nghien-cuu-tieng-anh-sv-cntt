"use client";

interface ScoreMeterProps {
  score: number; // 0 - 100
}

export function ScoreMeter({ score }: ScoreMeterProps) {
  // Score tier color and label
  const isHigh = score >= 80;
  const isMedium = score >= 60 && score < 80;

  return (
    <div className="bg-white border-2 border-ink rounded-2xl p-4 shadow-hard space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-ink uppercase tracking-wider font-mono">
          Điểm đánh giá câu trả lời
        </span>
        <div className="flex items-baseline gap-1 font-mono">
          <span className="text-3xl font-extrabold text-ink">{score}</span>
          <span className="text-xs text-ink-muted">/100</span>
        </div>
      </div>

      {/* Hard Brutalist Progress Bar */}
      <div className="w-full h-4 bg-paper rounded-pill border-2 border-ink overflow-hidden p-0.5">
        <div
          className={`h-full rounded-pill border border-ink transition-all duration-500 ${
            isHigh
              ? "bg-accent"
              : isMedium
              ? "bg-ink"
              : "bg-paper-muted"
          }`}
          style={{ width: `${Math.max(5, score)}%` }}
        />
      </div>

      {/* Formula Disclosure per Constitution Principle V */}
      <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-ink-muted pt-1 border-t border-paper-muted">
        <span>Công thức chấm:</span>
        <span>40% Từ khóa • 30% Đầy đủ • 30% Ngữ pháp</span>
      </div>
    </div>
  );
}


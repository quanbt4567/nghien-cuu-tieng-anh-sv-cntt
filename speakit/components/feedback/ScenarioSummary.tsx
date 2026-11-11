"use client";

import Link from "next/link";
import { CheckCircle2, RotateCcw, ArrowRight, Award } from "lucide-react";

interface ScenarioSummaryProps {
  scenarioTitle: string;
  totalScore: number;
  averageScore: number;
  totalKeywordsUsed: number;
  onRetry: () => void;
}

export function ScenarioSummary({
  scenarioTitle,
  totalScore,
  averageScore,
  totalKeywordsUsed,
  onRetry,
}: ScenarioSummaryProps) {
  return (
    <div className="bg-white border-2 border-ink rounded-2xl p-6 sm:p-8 shadow-hard space-y-6 text-center">
      {/* Plain CSS Completion Badge */}
      <div className="w-16 h-16 rounded-full bg-accent text-white flex items-center justify-center mx-auto border-2 border-ink shadow-hard">
        <Award className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-accent">
          Hoàn thành 3/3 lượt luyện tập
        </span>
        <h2 className="text-2xl font-bold text-ink tracking-tight">
          {scenarioTitle}
        </h2>
        <p className="text-xs sm:text-sm text-ink-muted max-w-md mx-auto">
          Bạn đã hoàn thành trọn vẹn cả 3 lượt hội thoại tình huống. Dữ liệu luyện tập đã được lưu tự động để tối ưu kế hoạch 7 ngày.
        </p>
      </div>

      {/* Aggregate Stats */}
      <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
        <div className="p-3 bg-paper rounded-xl border border-ink text-center">
          <div className="text-2xl font-mono font-bold text-ink">{averageScore}</div>
          <div className="text-[11px] text-ink-muted">Điểm trung bình</div>
        </div>
        <div className="p-3 bg-paper rounded-xl border border-ink text-center">
          <div className="text-2xl font-mono font-bold text-ink">{totalKeywordsUsed}</div>
          <div className="text-[11px] text-ink-muted">Từ khóa kỹ thuật đã dùng</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={onRetry}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-pill bg-paper-card text-ink font-semibold text-xs border-2 border-ink shadow-hard hover:bg-paper-muted shadow-hard-press transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Luyện lại kịch bản này</span>
        </button>

        <Link
          href="/"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-pill bg-ink text-white font-semibold text-xs border-2 border-ink shadow-hard hover:bg-ink-muted shadow-hard-press transition-all"
        >
          <span>Chọn kịch bản khác</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}


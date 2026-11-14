"use client";

import { useState } from "react";
import {
  Check,
  X,
  MessageSquare,
  Sparkles,
  ArrowRight,
  Volume2,
} from "lucide-react";
import { ScoreResponse } from "../../lib/types";
import { speakText } from "../../lib/speech";

interface FeedbackCardProps {
  result: ScoreResponse;
  transcript: string;
  onNextTurn?: () => void;
  isLastTurn?: boolean;
}

export function FeedbackCard({
  result,
  transcript,
  onNextTurn,
  isLastTurn = false,
}: FeedbackCardProps) {
  const [isPlayingBetter, setIsPlayingBetter] = useState(false);
  const isHigh = result.score >= 80;
  const isMedium = result.score >= 60 && result.score < 80;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-ink uppercase tracking-wider font-mono">
            Điểm đánh giá câu trả lời
          </span>
          <div className="flex items-baseline gap-1 font-mono">
            <span
              className={`text-3xl font-extrabold ${
                isHigh
                  ? "text-emerald-600"
                  : isMedium
                  ? "text-sky-600"
                  : "text-rose-600"
              }`}
            >
              {result.score}
            </span>
            <span className="text-xs text-ink-muted">/100</span>
          </div>
        </div>

        <div className="w-full h-3.5 bg-paper rounded-pill border border-ink/15 overflow-hidden p-0.5">
          <div
            className={`h-full rounded-pill transition-all duration-500 ${
              isHigh
                ? "bg-emerald-500"
                : isMedium
                ? "bg-sky-500"
                : "bg-rose-500"
            }`}
            style={{ width: `${Math.max(5, result.score)}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-ink-muted pt-1 border-t border-paper-muted">
          <span>Công thức chấm:</span>
          <span>40% Từ khóa • 30% Đầy đủ • 30% Ngữ pháp</span>
        </div>
      </div>

      <div className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft space-y-3.5">
        <div className="flex items-center justify-between text-xs font-bold text-ink">
          <span>Từ khóa kỹ thuật CNTT</span>
          <span className="font-mono text-ink-muted">
            {result.keywordsUsed.length}/
            {result.keywordsUsed.length + result.keywordsMissed.length} từ đã dùng
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {result.keywordsUsed.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-semibold rounded-pill bg-emerald-500/15 border border-emerald-500/30 text-emerald-700"
            >
              <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[3]" />
              <span>{kw}</span>
            </span>
          ))}

          {result.keywordsMissed.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-medium rounded-pill bg-rose-500/10 border border-rose-500/30 text-rose-700 line-through decoration-rose-400 decoration-2"
            >
              <X className="w-3.5 h-3.5 text-rose-400 stroke-[2.5]" />
              <span>{kw}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft space-y-4">
        <div className="space-y-1.5">
          <span className="text-xs font-mono font-bold uppercase text-ink-muted flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-ink" />
            Văn bản bạn đã nói:
          </span>
          <div className="p-3 bg-paper rounded-xl border border-ink/15 text-sm text-ink font-medium leading-relaxed">
            "{transcript}"
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-mono font-bold uppercase text-sky-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-500" />
              Gợi ý câu nói tự nhiên hơn:
            </span>
            <button
              type="button"
              onClick={() => {
                setIsPlayingBetter(true);
                speakText(
                  result.betterSentence,
                  0.8,
                  () => setIsPlayingBetter(false),
                  () => setIsPlayingBetter(false)
                );
              }}
              disabled={isPlayingBetter}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-sky-500/10 border border-sky-500/30 text-xs font-mono font-semibold text-sky-700 hover:bg-sky-500/20 shadow-soft transition-colors disabled:opacity-50"
              title="Nghe câu mẫu phát âm chuẩn"
            >
              <Volume2 className={`w-3.5 h-3.5 ${isPlayingBetter ? "text-sky-500 animate-pulse" : ""}`} />
              <span>{isPlayingBetter ? "Đang phát..." : "Nghe mẫu (Shadowing)"}</span>
            </button>
          </div>
          <div className="p-3.5 bg-sky-500/10 rounded-xl border border-sky-500/30 text-sm text-ink leading-relaxed">
            <span className="font-semibold text-sky-700 block text-xs font-mono mb-1">
              More Natural / Pro Phrasing:
            </span>
            "{result.betterSentence}"
          </div>
        </div>

        {result.grammarCorrections.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-mono font-bold uppercase text-rose-600">
              Lưu ý ngữ pháp ({result.grammarCorrections.length}):
            </span>
            <div className="space-y-2">
              {result.grammarCorrections.map((g, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-paper rounded-xl border border-rose-500/25 space-y-1 text-xs"
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="line-through text-rose-500 font-mono">
                      "{g.original}"
                    </span>
                    <span className="font-mono text-ink-muted">→</span>
                    <span className="font-mono font-bold text-emerald-700">
                      "{g.corrected}"
                    </span>
                  </div>
                  <div className="text-ink-muted font-sans pt-0.5">
                    {g.explanationVI}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.pronunciationNote && (
          <div className="p-3 bg-paper-muted rounded-xl border border-ink/15 text-xs text-ink-muted">
            <span className="font-semibold text-ink block font-mono mb-0.5">
              Ước lượng phát âm (từ transcript):
            </span>
            {result.pronunciationNote}
          </div>
        )}

        {onNextTurn && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onNextTurn}
              className="w-full py-3 px-4 rounded-pill bg-ink text-white font-bold text-sm border border-ink shadow-soft hover:bg-ink-muted flex items-center justify-center gap-2 transition-all"
            >
              <span>{isLastTurn ? "Xem tổng kết lượt luyện tập" : "Tiếp tục lượt sau"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

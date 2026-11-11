"use client";

import { useState } from "react";
import { Check, X, MessageSquare, BookOpen, ArrowRight, CheckCircle2, Volume2 } from "lucide-react";
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
      {/* 1. Score Meter (Inlined from ScoreMeter.tsx) */}
      <div className="bg-white border-2 border-ink rounded-2xl p-4 shadow-hard space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-ink uppercase tracking-wider font-mono">
            Điểm đánh giá câu trả lời
          </span>
          <div className="flex items-baseline gap-1 font-mono">
            <span className="text-3xl font-extrabold text-ink">{result.score}</span>
            <span className="text-xs text-ink-muted">/100</span>
          </div>
        </div>

        {/* Hard Brutalist Progress Bar */}
        <div className="w-full h-4 bg-paper rounded-pill border-2 border-ink overflow-hidden p-0.5">
          <div
            className={`h-full rounded-pill border border-ink transition-all duration-500 ${
              isHigh ? "bg-accent" : isMedium ? "bg-ink" : "bg-paper-muted"
            }`}
            style={{ width: `${Math.max(5, result.score)}%` }}
          />
        </div>

        {/* Formula Disclosure per Constitution Principle V */}
        <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-ink-muted pt-1 border-t border-paper-muted">
          <span>Công thức chấm:</span>
          <span>40% Từ khóa • 30% Đầy đủ • 30% Ngữ pháp</span>
        </div>
      </div>

      {/* 2. IT Keyword Badges (Inlined from KeywordBadges.tsx) */}
      <div className="bg-white border-2 border-ink rounded-2xl p-4 shadow-hard space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-ink">
          <span>Từ khóa kỹ thuật CNTT</span>
          <span className="font-mono text-ink-muted">
            {result.keywordsUsed.length}/
            {result.keywordsUsed.length + result.keywordsMissed.length} từ đã dùng
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Keywords used */}
          {result.keywordsUsed.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-medium rounded-pill bg-paper border border-ink text-ink"
            >
              <Check className="w-3.5 h-3.5 text-accent stroke-[3]" />
              <span>{kw}</span>
            </span>
          ))}

          {/* Keywords missed */}
          {result.keywordsMissed.map((kw) => (
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

      {/* 3. Detailed Feedback & Corrections */}
      <div className="bg-white border-2 border-ink rounded-2xl p-5 sm:p-6 shadow-hard space-y-5">
        {/* Student Transcript */}
        <div className="space-y-1.5">
          <span className="text-xs font-mono font-bold uppercase text-ink-muted flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-accent" />
            Văn bản bạn đã nói:
          </span>
          <div className="p-3 bg-paper rounded-xl border border-ink text-sm text-ink font-medium leading-relaxed">
            "{transcript}"
          </div>
        </div>

        {/* Better Sentence with Shadowing Audio */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-mono font-bold uppercase text-ink-muted flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-accent" />
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
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-paper border border-ink text-xs font-mono font-semibold text-ink hover:bg-accent hover:text-white shadow-hard shadow-hard-press transition-colors disabled:opacity-50"
              title="Nghe câu mẫu phát âm chuẩn"
            >
              <Volume2 className={`w-3.5 h-3.5 ${isPlayingBetter ? "text-accent animate-pulse" : ""}`} />
              <span>{isPlayingBetter ? "Đang phát..." : "Nghe mẫu (Shadowing)"}</span>
            </button>
          </div>
          <div className="p-3 bg-accent-light rounded-xl border-2 border-accent text-sm text-ink leading-relaxed">
            <span className="font-semibold text-accent block text-xs font-mono mb-1">
              Better Sentence:
            </span>
            "{result.betterSentence}"
          </div>
        </div>

        {/* Grammar Corrections with Vietnamese Explanation */}
        {result.grammarCorrections.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-mono font-bold uppercase text-ink-muted">
              Lưu ý ngữ pháp ({result.grammarCorrections.length}):
            </span>
            <div className="space-y-2">
              {result.grammarCorrections.map((g, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-paper rounded-xl border border-ink space-y-1 text-xs"
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="line-through text-accent font-mono">
                      "{g.original}"
                    </span>
                    <span className="font-mono text-ink">→</span>
                    <span className="font-mono font-bold text-ink">
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

        {/* Pronunciation Estimation Note */}
        {result.pronunciationNote && (
          <div className="p-3 bg-paper-muted rounded-xl border border-ink text-xs text-ink-muted">
            <span className="font-semibold text-ink block font-mono mb-0.5">
              Ước lượng phát âm (từ transcript):
            </span>
            {result.pronunciationNote}
          </div>
        )}

        {/* Action: Next Turn or Finish */}
        {onNextTurn && (
          <div className="pt-2">
            <button
              onClick={onNextTurn}
              className="w-full py-3 px-4 rounded-pill bg-ink text-white font-bold text-sm border-2 border-ink shadow-hard hover:bg-ink-muted shadow-hard-press flex items-center justify-center gap-2 transition-all"
            >
              <span>{isLastTurn ? "Xem tổng kết lượt luyện tập" : "Lượt đối thoại tiếp theo"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { CheckCircle2, MessageSquare, Mic, ArrowRight, BookOpen } from "lucide-react";
import { ScoreResponse } from "../../lib/types";

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
  return (
    <div className="bg-white border-2 border-ink rounded-2xl p-5 sm:p-6 shadow-hard space-y-5">
      {/* 1. Student Transcript */}
      <div className="space-y-1.5">
        <span className="text-xs font-mono font-bold uppercase text-ink-muted flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-accent" />
          Văn bản bạn đã nói:
        </span>
        <div className="p-3 bg-paper rounded-xl border border-ink text-sm text-ink font-medium leading-relaxed">
          "{transcript}"
        </div>
      </div>

      {/* 2. Better Sentence */}
      <div className="space-y-1.5">
        <span className="text-xs font-mono font-bold uppercase text-ink-muted flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-accent" />
          Gợi ý câu nói tự nhiên hơn trong công việc:
        </span>
        <div className="p-3 bg-accent-light rounded-xl border-2 border-accent text-sm text-ink leading-relaxed">
          <span className="font-semibold text-accent block text-xs font-mono mb-1">
            Better Sentence:
          </span>
          "{result.betterSentence}"
        </div>
      </div>

      {/* 3. Grammar Corrections with Vietnamese Explanation */}
      {result.grammarCorrections.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-mono font-bold uppercase text-ink-muted">
            Lưu ý ngữ pháp ({result.grammarCorrections.length}):
          </span>
          <div className="space-y-2">
            {result.grammarCorrections.map((corr, idx) => (
              <div
                key={idx}
                className="p-3 bg-paper rounded-xl border border-ink text-xs space-y-1"
              >
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-ink-muted line-through">{corr.original}</span>
                  <span className="text-accent font-bold">→ {corr.corrected}</span>
                </div>
                <p className="text-ink text-[11px] leading-relaxed">
                  {corr.explanationVI}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Honest Pronunciation Note (Principle V) */}
      <div className="p-3 bg-paper-muted rounded-xl border border-ink flex items-start gap-2.5 text-xs text-ink leading-relaxed">
        <Mic className="w-4 h-4 text-accent shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-accent">Ghi chú phát âm: </span>
          <span>{result.pronunciationNote}</span>
        </div>
      </div>

      {/* 5. Next Turn Action Button */}
      {onNextTurn && (
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onNextTurn}
            className="flex items-center gap-2 px-6 py-2.5 rounded-pill bg-accent text-white font-semibold text-xs sm:text-sm border-2 border-ink shadow-hard shadow-hard-press hover:bg-accent-hover transition-all"
          >
            <span>{isLastTurn ? "Xem tổng kết kịch bản" : "Tiếp tục lượt kế tiếp"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}


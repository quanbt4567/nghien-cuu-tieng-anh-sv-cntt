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
import { ScoreResponse, VoicePersonaId } from "../../lib/types";
import { normalizeVoicePersona } from "../../lib/speech";
import { storageAdapter } from "../../lib/storage";
import { playTtsAudio } from "../../lib/tts-player";
import { InteractiveEnglishText } from "../common/EnglishWordTooltip";

interface FeedbackCardProps {
  result: ScoreResponse;
  transcript: string;
  voicePersona?: VoicePersonaId;
  onNextTurn?: () => void;
  isLastTurn?: boolean;
}

export function FeedbackCard({
  result,
  transcript,
  voicePersona,
  onNextTurn,
  isLastTurn = false,
}: FeedbackCardProps) {
  const [isPlayingBetter, setIsPlayingBetter] = useState(false);
  const isHigh = result.score >= 80;
  const isMedium = result.score >= 60 && result.score < 80;

  return (
    <div className="space-y-4">
      <div className="liquid-glass-card p-5 space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
            Điểm đánh giá câu trả lời
          </span>
          <div className="flex items-baseline gap-1 font-mono">
            <span
              className={`text-3xl font-extrabold ${
                isHigh
                  ? "text-emerald-300"
                  : isMedium
                  ? "text-cyan-300"
                  : "text-rose-300"
              }`}
            >
              {result.score}
            </span>
            <span className="text-xs text-slate-300">/100</span>
          </div>
        </div>

        <div className="w-full h-3.5 bg-slate-950/70 rounded-full border border-white/15 overflow-hidden p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isHigh
                ? "bg-gradient-to-r from-emerald-400 to-teal-400"
                : isMedium
                ? "bg-gradient-to-r from-cyan-400 to-blue-400"
                : "bg-gradient-to-r from-rose-500 to-amber-400"
            }`}
            style={{ width: `${Math.max(5, result.score)}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-300 pt-1 border-t border-white/10">
          <span>Công thức chấm:</span>
          <span>40% Từ khóa • 30% Đầy đủ • 30% Ngữ pháp</span>
        </div>
      </div>

      <div className="liquid-glass-card p-5 space-y-3.5">
        <div className="flex items-center justify-between text-xs font-bold text-white">
          <span>Từ khóa kỹ thuật CNTT</span>
          <span className="font-mono text-slate-300">
            {result.keywordsUsed.length}/
            {result.keywordsUsed.length + result.keywordsMissed.length} từ đã dùng
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {result.keywordsUsed.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-semibold rounded-full bg-emerald-500/20 border border-emerald-400/45 text-emerald-200"
            >
              <Check className="w-3.5 h-3.5 text-emerald-300 stroke-[3]" />
              <span>{kw}</span>
            </span>
          ))}

          {result.keywordsMissed.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-medium rounded-full bg-rose-500/15 border border-rose-400/40 text-rose-200 line-through decoration-rose-400 decoration-2"
            >
              <X className="w-3.5 h-3.5 text-rose-300 stroke-[2.5]" />
              <span>{kw}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="liquid-glass-card p-5 space-y-4">
        <div className="space-y-1.5">
          <span className="text-xs font-mono font-bold uppercase text-slate-300 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-cyan-300" />
            Văn bản bạn đã nói:
          </span>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-white/15 text-sm text-white font-medium leading-relaxed">
            "{transcript}"
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-mono font-bold uppercase text-cyan-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Gợi ý câu nói tự nhiên hơn:
            </span>
            <button
              type="button"
              onClick={() => {
                const savedPersona = storageAdapter.getSettings().voicePersona;
                const activePersona =
                  voicePersona ??
                  (savedPersona
                    ? normalizeVoicePersona(savedPersona)
                    : "lead_us_male");
                setIsPlayingBetter(true);
                playTtsAudio({
                  text: result.betterSentence,
                  rate: 0.8,
                  persona: activePersona,
                  onEnd: () => setIsPlayingBetter(false),
                  onError: () => setIsPlayingBetter(false),
                });
              }}
              disabled={isPlayingBetter}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-cyan-500/20 border border-cyan-400/50 text-xs font-mono font-bold text-cyan-200 hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
              title="Nghe câu mẫu phát âm chuẩn"
            >
              <Volume2 className={`w-3.5 h-3.5 ${isPlayingBetter ? "text-cyan-300 animate-pulse" : ""}`} />
              <span>{isPlayingBetter ? "Đang phát..." : "Nghe mẫu (Shadowing)"}</span>
            </button>
          </div>
          <div className="p-3.5 bg-cyan-500/15 rounded-xl border border-cyan-400/35 text-sm text-white leading-relaxed">
            <span className="font-semibold text-cyan-200 block text-xs font-mono mb-1">
              Câu mẫu tự nhiên hơn (chạm từ gạch chân để xem nghĩa):
            </span>
            &ldquo;<InteractiveEnglishText text={result.betterSentence} />&rdquo;
          </div>
        </div>

        {result.grammarCorrections.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-mono font-bold uppercase text-rose-300">
              Gợi ý diễn đạt ({result.grammarCorrections.length}):
            </span>
            <div className="space-y-2">
              {result.grammarCorrections.map((g, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-950/60 rounded-xl border border-rose-400/30 space-y-1 text-xs"
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="line-through text-rose-300 font-mono">
                      "{g.original}"
                    </span>
                    <span className="font-mono text-slate-400">→</span>
                    <span className="font-mono font-bold text-emerald-300">
                      "{g.corrected}"
                    </span>
                  </div>
                  <div className="text-slate-300 font-sans pt-0.5">
                    {g.explanationVI}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.pronunciationNote && (
          <div className="p-3 bg-white/[0.06] rounded-xl border border-white/15 text-xs text-slate-300 space-y-1">
            <span className="font-semibold text-white block font-mono">
              Ước lượng phát âm (dựa trên chữ vừa nói):
            </span>
            <p>{result.pronunciationNote}</p>
            <p className="text-[11px] text-slate-400">
              Đánh giá dựa trên văn bản bạn vừa nói hoặc gõ vào.
            </p>
          </div>
        )}

        {onNextTurn && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onNextTurn}
              className={`${
                isLastTurn ? "liquid-btn-success" : "liquid-btn-primary"
              } w-full py-3.5 px-5 rounded-full text-sm active:scale-[0.99] flex items-center justify-center gap-2 transition-all`}
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

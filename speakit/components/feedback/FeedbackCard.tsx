"use client";

import { useState } from "react";
import {
  Check,
  CheckCircle2,
  X,
  MessageSquare,
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
  const scoreRatio = Math.max(0.05, Math.min(1, result.score / 100));

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider font-mono">
            Äiá»ƒm Ä‘Ã¡nh giÃ¡ cÃ¢u tráº£ lá»i
          </span>
          <div className="flex items-baseline gap-1 font-mono">
            <span
              className={`text-3xl font-extrabold ${
                isHigh
                  ? "text-green-700 dark:text-green-400"
                  : isMedium
                  ? "text-blue-700 dark:text-blue-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {result.score}
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-400">/100</span>
          </div>
        </div>

        <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full w-full origin-left rounded-full transition-transform duration-500 ${
              isHigh
                ? "bg-green-700 dark:bg-green-500"
                : isMedium
                ? "bg-blue-700 dark:bg-blue-500"
                : "bg-red-600 dark:bg-red-500"
            }`}
            style={{ transform: `scaleX(${scoreRatio})` }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between text-xs font-mono text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800">
          <span>CÃ´ng thá»©c cháº¥m:</span>
          <span>40% Tá»« khÃ³a â€¢ 30% Äáº§y Ä‘á»§ â€¢ 30% Ngá»¯ phÃ¡p</span>
        </div>
      </div>

      <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3.5">
        <div className="flex items-center justify-between text-sm font-bold text-slate-900 dark:text-slate-100">
          <span>Tá»« khÃ³a ká»¹ thuáº­t CNTT</span>
          <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
            {result.keywordsUsed.length}/
            {result.keywordsUsed.length + result.keywordsMissed.length} tá»« Ä‘Ã£ dÃ¹ng
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {result.keywordsUsed.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-semibold rounded-full bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300"
            >
              <Check className="w-3.5 h-3.5 text-green-700 dark:text-green-400 stroke-[3]" />
              <span>{kw}</span>
            </span>
          ))}

          {result.keywordsMissed.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-medium rounded-full bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 line-through decoration-red-500 decoration-2"
            >
              <X className="w-3.5 h-3.5 text-red-600 dark:text-red-400 stroke-[2.5]" />
              <span>{kw}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="space-y-1.5">
          <span className="text-xs font-mono font-bold uppercase text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
            VÄƒn báº£n báº¡n Ä‘Ã£ nÃ³i:
          </span>
          <div className="bg-slate-50 dark:bg-[#141414] rounded-lg px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 font-medium leading-relaxed">
            &ldquo;{transcript}&rdquo;
          </div>
        </div>

        <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-mono font-bold uppercase text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
              Gá»£i Ã½ cÃ¢u nÃ³i tá»± nhiÃªn hÆ¡n:
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
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs font-mono font-bold transition-colors disabled:opacity-60"
              title="Nghe cÃ¢u máº«u phÃ¡t Ã¢m chuáº©n"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>{isPlayingBetter ? "Äang phÃ¡t..." : "Nghe máº«u (Shadowing)"}</span>
            </button>
          </div>
          <div className="bg-blue-50/70 dark:bg-blue-950/30 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 leading-relaxed">
            <span className="font-semibold text-blue-800 dark:text-blue-300 block text-xs font-mono mb-1">
              CÃ¢u máº«u tá»± nhiÃªn hÆ¡n (cháº¡m tá»« gáº¡ch chÃ¢n Ä‘á»ƒ xem nghÄ©a):
            </span>
            &ldquo;<InteractiveEnglishText text={result.betterSentence} />&rdquo;
          </div>
        </div>

        {result.grammarCorrections.length > 0 && (
          <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-4">
            <span className="text-xs font-mono font-bold uppercase text-red-600 dark:text-red-400">
              Gá»£i Ã½ diá»…n Ä‘áº¡t ({result.grammarCorrections.length}):
            </span>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {result.grammarCorrections.map((g, idx) => (
                <div
                  key={idx}
                  className="py-2.5 first:pt-1 last:pb-0 space-y-1 text-sm"
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="line-through text-red-600 dark:text-red-400 font-mono">
                      &ldquo;{g.original}&rdquo;
                    </span>
                    <span className="font-mono text-slate-500 dark:text-slate-400">-&gt;</span>
                    <span className="font-mono font-bold text-green-700 dark:text-green-400">
                      &ldquo;{g.corrected}&rdquo;
                    </span>
                  </div>
                  <div className="text-slate-700 dark:text-slate-300 font-sans">
                    {g.explanationVI}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.pronunciationNote && (
          <div className="border-t border-slate-200 dark:border-slate-800 pt-3 text-sm text-slate-700 dark:text-slate-300 space-y-1">
            <span className="font-semibold text-slate-900 dark:text-slate-100 block text-xs font-mono uppercase">
              Æ¯á»›c lÆ°á»£ng phÃ¡t Ã¢m (dá»±a trÃªn chá»¯ vá»«a nÃ³i):
            </span>
            <p>{result.pronunciationNote}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              ÄÃ¡nh giÃ¡ dá»±a trÃªn vÄƒn báº£n báº¡n vá»«a nÃ³i hoáº·c gÃµ vÃ o.
            </p>
          </div>
        )}

        {onNextTurn && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onNextTurn}
              className={`${
                isLastTurn
                  ? "bg-green-700 hover:bg-green-800"
                  : "bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700"
              } w-full py-3.5 px-5 rounded-lg text-white font-semibold text-sm active:scale-[0.99] flex items-center justify-center gap-2 transition-colors`}
            >
              <span>{isLastTurn ? "Xem tá»•ng káº¿t lÆ°á»£t luyá»‡n táº­p" : "Tiáº¿p tá»¥c lÆ°á»£t sau"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

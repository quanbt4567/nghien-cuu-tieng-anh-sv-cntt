"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Award,
  BookOpen,
  Check,
  Coins,
  Copy,
  Flame,
  RotateCcw,
  Swords,
  TrendingUp,
  Volume2,
  VolumeX,
} from "lucide-react";
import { IT_ROLES } from "../../data/minigames";
import {
  calculateCoins,
  GAMIFICATION_UPDATED_EVENT,
  getDevTitle,
  getGamificationState,
  pointsToNextCoin,
  suggestWeakVocab,
} from "../../lib/gamification";
import { speakText } from "../../lib/speech";
import { GamificationState, VocabularyItem } from "../../lib/types";
import { FeedbackPromptModal } from "./FeedbackPromptModal";
import { filterUnusedKeywords } from "./keywordFilter";

export { filterUnusedKeywords };

interface ScenarioSummaryProps {
  scenarioTitle: string;
  totalScore: number;
  averageScore: number;
  totalKeywordsUsed: number;
  onRetry: () => void;
  missedKeywords?: string[];
  usedKeywords?: string[];
  transcripts?: string[];
  scenarioKeywords?: string[];
  pointsEarned?: number;
  vocabPool?: VocabularyItem[];
  totalTurns?: number;
}

const EMPTY_KEYWORDS: string[] = [];

const DEFAULT_GAMIFICATION: GamificationState = {
  totalPoints: 0,
  streakDays: 0,
  lastPracticeDate: null,
  selectedRole: "frontend",
  personalBests: { "bug-buster": 0, "standup-speed-run": 0 },
  history: [],
};

export function ScenarioSummary({
  scenarioTitle,
  totalScore,
  averageScore,
  totalKeywordsUsed,
  onRetry,
  missedKeywords = EMPTY_KEYWORDS,
  usedKeywords = EMPTY_KEYWORDS,
  transcripts = EMPTY_KEYWORDS,
  scenarioKeywords = EMPTY_KEYWORDS,
  pointsEarned,
  vocabPool,
  totalTurns = 3,
}: ScenarioSummaryProps) {
  const [gamification, setGamification] =
    useState<GamificationState>(DEFAULT_GAMIFICATION);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [playingTermId, setPlayingTermId] = useState<string | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);

  const copyTimerRef = useRef<number | null>(null);
  const cancelSpeechRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const sync = () => setGamification(getGamificationState());
    sync();
    window.addEventListener(GAMIFICATION_UPDATED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(GAMIFICATION_UPDATED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      if (cancelSpeechRef.current) {
        cancelSpeechRef.current();
      }
    };
  }, []);

  const roleConfig =
    IT_ROLES.find((r) => r.id === gamification.selectedRole) ?? IT_ROLES[0];
  const devTitle = getDevTitle(gamification.totalPoints);
  const coins = calculateCoins(gamification.totalPoints);
  const remainingForCoin = pointsToNextCoin(gamification.totalPoints);
  const rawEarned = pointsEarned ?? totalScore;
  const earnedPoints = Number.isFinite(rawEarned)
    ? Math.max(0, Math.round(rawEarned))
    : 0;

  const effectiveMissedKeywords = useMemo(
    () => filterUnusedKeywords(missedKeywords, usedKeywords, transcripts),
    [missedKeywords, usedKeywords, transcripts]
  );

  const weakVocab = useMemo(
    () => suggestWeakVocab(effectiveMissedKeywords, scenarioKeywords, 3, vocabPool),
    [effectiveMissedKeywords, scenarioKeywords, vocabPool]
  );

  const handleCopyResult = async () => {
    setCopyError(null);
    const summaryText = [
      "SpeakIT — Kết quả luyện nói tiếng Anh CNTT",
      `Kịch bản: ${scenarioTitle}`,
      `Vai trò: ${roleConfig.label} | Danh hiệu: ${devTitle.title}`,
      `Điểm trung bình: ${averageScore}/100 | Từ khóa đã dùng: ${totalKeywordsUsed}`,
      `Thưởng phiên này: +${earnedPoints} điểm -> ${coins} IT-Coin (còn ${remainingForCoin} điểm -> +1 IT-Coin)`,
    ].join("\n");

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summaryText);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = summaryText;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (!ok) {
          throw new Error("Copy command rejected");
        }
      }

      setCopied(true);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopyError(
        "Không thể tự động sao chép. Vui lòng chụp màn hình thẻ kết quả bên trên."
      );
    }
  };

  const handleSpeakTerm = (item: VocabularyItem) => {
    setTtsError(null);
    if (cancelSpeechRef.current) {
      cancelSpeechRef.current();
      cancelSpeechRef.current = null;
    }

    if (playingTermId === item.id) {
      setPlayingTermId(null);
      return;
    }

    setPlayingTermId(item.id);
    cancelSpeechRef.current = speakText(
      item.term,
      1.0,
      () => {
        setPlayingTermId(null);
        cancelSpeechRef.current = null;
      },
      (errMsg) => {
        setPlayingTermId(null);
        cancelSpeechRef.current = null;
        setTtsError(errMsg);
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="liquid-glass-card p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            <span className="font-mono text-xs font-bold tracking-wider uppercase text-white">
              SpeakIT
            </span>
            <span className="text-[11px] font-mono text-slate-300">
              • Phiếu kết quả luyện nói
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-white/[0.08] border border-white/15 text-slate-200">
              {roleConfig.label}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-violet-500/25 text-violet-100 border border-violet-400/50">
              {devTitle.title}
            </span>
          </div>
        </div>

        <div className="text-center space-y-2.5">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500/35 to-blue-600/35 text-cyan-200 flex items-center justify-center mx-auto border border-cyan-300/50 shadow-[0_0_24px_rgba(6,182,212,0.35)]">
            <Award className="w-7 h-7" />
          </div>
          <span className="block text-xs font-mono font-bold uppercase tracking-wider text-cyan-300">
            Hoàn thành {totalTurns}/{totalTurns} lượt luyện tập
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {scenarioTitle}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Phiên đối thoại đã được lưu cục bộ để cập nhật điểm rèn luyện và kế hoạch 7 ngày.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
          <div className="liquid-glass-card-lite p-3.5 text-center">
            <div className="text-2xl font-mono font-bold text-white">
              {averageScore}
              <span className="text-xs font-normal text-slate-300">/100</span>
            </div>
            <div className="text-[11px] text-slate-300 mt-0.5">
              Điểm trung bình
            </div>
          </div>
          <div className="liquid-glass-card-lite p-3.5 text-center">
            <div className="text-2xl font-mono font-bold text-cyan-200">
              {totalKeywordsUsed}
            </div>
            <div className="text-[11px] text-slate-300 mt-0.5">
              Từ khóa kỹ thuật đã dùng
            </div>
          </div>
        </div>

        <div className="max-w-md mx-auto liquid-glass-card-lite p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shrink-0">
              <Coins className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className="text-xs sm:text-sm font-mono font-bold text-white">
                +{earnedPoints} điểm → {coins} IT-Coin
              </div>
              <div className="text-[11px] text-slate-300">
                Còn {remainingForCoin} điểm để nhận +1 IT-Coin
              </div>
            </div>
          </div>

          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-400/35 text-[11px] font-mono font-semibold text-amber-200">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>{gamification.streakDays} ngày</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleCopyResult}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs transition-all ${
              copied ? "liquid-btn-success" : "liquid-glass-btn font-medium"
            }`}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copied ? "Đã sao chép!" : "Sao chép kết quả"}</span>
          </button>

          <button
            type="button"
            onClick={onRetry}
            className="liquid-glass-btn w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-bold text-xs sm:text-sm transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-300" />
            <span>Luyện lại kịch bản này</span>
          </button>

          <Link
            href="/scenarios"
            className="liquid-btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm active:scale-[0.98] transition-all"
          >
            <span>Chọn kịch bản khác</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {copyError && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-rose-200 font-medium bg-rose-500/15 px-3 py-2 rounded-xl border border-rose-400/40">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
            <span>{copyError}</span>
          </div>
        )}
      </div>

      <div className="liquid-glass-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-violet-400" />
              <span>3 Từ vựng trọng tâm cần ôn ngay</span>
            </h3>
            <p className="text-xs text-slate-300">
              {effectiveMissedKeywords.length > 0
                ? "Gợi ý ưu tiên từ các từ khóa bạn chưa dùng trong phiên vừa rồi."
                : "Các thuật ngữ cốt lõi gắn với kịch bản bạn vừa luyện."}
            </p>
          </div>
        </div>

        {weakVocab.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {weakVocab.map((item) => {
              const isSpeaking = playingTermId === item.id;
              return (
                <div
                  key={item.id}
                  className="liquid-glass-card-lite p-3.5 flex flex-col justify-between gap-2.5"
                >
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-mono font-bold text-white">
                          {item.term}
                        </div>
                        <div className="text-xs font-ipa text-cyan-300 font-medium">
                          {item.phonetic}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSpeakTerm(item)}
                        aria-label={`Phát âm từ ${item.term}`}
                        title={`Nghe phát âm "${item.term}"`}
                        className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                          isSpeaking
                            ? "liquid-btn-danger"
                            : "bg-cyan-500/20 text-cyan-200 border-cyan-400/50 hover:bg-cyan-500/30"
                        }`}
                      >
                        {isSpeaking ? (
                          <VolumeX className="w-3.5 h-3.5" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed pt-1">
                      {item.meaningVI}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="liquid-glass-card-lite p-4 text-xs text-slate-300">
            Chưa có từ vựng gợi ý trong thư viện hiện tại.
          </div>
        )}

        {ttsError && (
          <div className="flex items-center gap-1.5 text-xs text-rose-200 font-medium bg-rose-500/15 px-3 py-2 rounded-xl border border-rose-400/40">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
            <span>{ttsError}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center sm:justify-between gap-2.5 pt-3 border-t border-white/10">
          <Link
            href="/vocabulary"
            className="liquid-glass-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium transition-all"
          >
            <BookOpen className="w-3.5 h-3.5 text-violet-300" />
            <span>Ôn tập từ vựng</span>
          </Link>

          <Link
            href="/arena"
            className="liquid-btn-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm active:scale-[0.98] transition-all"
          >
            <Swords className="w-4 h-4" />
            <span>Thử thách IT Arena</span>
          </Link>

          <Link
            href="/progress"
            className="liquid-glass-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium transition-all"
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-300" />
            <span>Tiến độ & 7 ngày</span>
          </Link>
        </div>
      </div>
      <FeedbackPromptModal trigger={true} context="scenario-summary" />
    </div>
  );
}

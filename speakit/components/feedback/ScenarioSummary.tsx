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

interface ScenarioSummaryProps {
  scenarioTitle: string;
  totalScore: number;
  averageScore: number;
  totalKeywordsUsed: number;
  onRetry: () => void;
  missedKeywords?: string[];
  scenarioKeywords?: string[];
  pointsEarned?: number;
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
  scenarioKeywords = EMPTY_KEYWORDS,
  pointsEarned,
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

  const weakVocab = useMemo(
    () => suggestWeakVocab(missedKeywords, scenarioKeywords, 3),
    [missedKeywords, scenarioKeywords]
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
      {/* 1. Shareable Snapshot Result Card */}
      <div className="bg-white border border-ink/15 rounded-2xl p-6 sm:p-8 shadow-soft space-y-6">
        {/* SpeakIT Snapshot Header Stamp */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-ink/10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-accent" />
            <span className="font-mono text-xs font-bold tracking-wider uppercase text-ink">
              SpeakIT
            </span>
            <span className="text-[11px] font-mono text-ink-muted">
              • Phiếu kết quả luyện nói
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-2.5 py-0.5 rounded-pill text-[11px] font-mono font-semibold bg-paper border border-ink/15 text-ink">
              {roleConfig.label}
            </span>
            <span className="px-2.5 py-0.5 rounded-pill text-[11px] font-mono font-semibold bg-ink text-white border border-ink">
              {devTitle.title}
            </span>
          </div>
        </div>

        {/* Completion Heading */}
        <div className="text-center space-y-2.5">
          <div className="w-14 h-14 rounded-full bg-accent text-white flex items-center justify-center mx-auto border border-accent/20 shadow-soft">
            <Award className="w-7 h-7" />
          </div>
          <span className="block text-xs font-mono font-bold uppercase tracking-wider text-accent">
            Hoàn thành 3/3 lượt luyện tập
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
            {scenarioTitle}
          </h2>
          <p className="text-xs sm:text-sm text-ink-muted max-w-md mx-auto">
            Phiên đối thoại đã được lưu cục bộ để cập nhật điểm rèn luyện và kế hoạch 7 ngày.
          </p>
        </div>

        {/* Aggregate Stats */}
        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
          <div className="p-3.5 bg-paper rounded-xl border border-ink/15 text-center">
            <div className="text-2xl font-mono font-bold text-ink">
              {averageScore}
              <span className="text-xs font-normal text-ink-muted">/100</span>
            </div>
            <div className="text-[11px] text-ink-muted mt-0.5">
              Điểm trung bình
            </div>
          </div>
          <div className="p-3.5 bg-paper rounded-xl border border-ink/15 text-center">
            <div className="text-2xl font-mono font-bold text-ink">
              {totalKeywordsUsed}
            </div>
            <div className="text-[11px] text-ink-muted mt-0.5">
              Từ khóa kỹ thuật đã dùng
            </div>
          </div>
        </div>

        {/* Reward Badge (+XXX điểm -> IT-Coin) */}
        <div className="max-w-md mx-auto bg-paper border border-ink/15 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-accent-light border border-accent/30 text-accent flex items-center justify-center shrink-0">
              <Coins className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className="text-xs sm:text-sm font-mono font-bold text-ink">
                +{earnedPoints} điểm → {coins} IT-Coin
              </div>
              <div className="text-[11px] text-ink-muted">
                Còn {remainingForCoin} điểm để nhận +1 IT-Coin
              </div>
            </div>
          </div>

          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill bg-white border border-ink/15 text-[11px] font-mono font-semibold text-ink">
            <Flame className="w-3.5 h-3.5 text-accent" />
            <span>{gamification.streakDays} ngày</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleCopyResult}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-pill font-semibold text-xs border shadow-soft transition-all ${
              copied
                ? "bg-accent text-white border-accent"
                : "bg-white text-ink border-ink/15 hover:bg-paper-muted"
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
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-pill bg-paper-card text-ink font-semibold text-xs border border-ink/15 shadow-soft hover:bg-paper-muted transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Luyện lại kịch bản này</span>
          </button>

          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-pill bg-ink text-white font-semibold text-xs border border-ink shadow-soft hover:bg-ink-muted transition-all"
          >
            <span>Chọn kịch bản khác</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {copyError && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-accent font-medium bg-accent-light px-3 py-2 rounded-xl border border-accent/40">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{copyError}</span>
          </div>
        )}
      </div>

      {/* 2. Auto-suggested 3 Weak Vocabulary Terms */}
      <div className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <h3 className="text-sm sm:text-base font-bold text-ink flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-accent" />
              <span>3 Từ vựng trọng tâm cần ôn ngay</span>
            </h3>
            <p className="text-xs text-ink-muted">
              {missedKeywords.length > 0
                ? "Gợi ý ưu tiên từ các từ khóa bạn chưa dùng trong phiên vừa rồi."
                : "Các thuật ngữ cốt lõi gắn với kịch bản bạn vừa luyện."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {weakVocab.map((item) => {
            const isSpeaking = playingTermId === item.id;
            return (
              <div
                key={item.id}
                className="bg-paper border border-ink/15 rounded-xl p-3.5 flex flex-col justify-between gap-2.5"
              >
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-mono font-bold text-ink">
                        {item.term}
                      </div>
                      <div className="text-xs font-ipa text-accent font-medium">
                        {item.phonetic}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSpeakTerm(item)}
                      aria-label={`Phát âm từ ${item.term}`}
                      title={`Nghe phát âm "${item.term}"`}
                      className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                        isSpeaking
                          ? "bg-accent text-white border-accent"
                          : "bg-white text-ink border-ink/15 hover:bg-accent hover:text-white"
                      }`}
                    >
                      {isSpeaking ? (
                        <VolumeX className="w-3.5 h-3.5" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-ink-muted leading-relaxed pt-1">
                    {item.meaningVI}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {ttsError && (
          <div className="flex items-center gap-1.5 text-xs text-accent font-medium bg-accent-light px-3 py-2 rounded-xl border border-accent/40">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{ttsError}</span>
          </div>
        )}

        {/* Next Step CTAs */}
        <div className="flex flex-wrap items-center justify-center sm:justify-between gap-2.5 pt-3 border-t border-paper-muted">
          <Link
            href="/vocabulary"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-pill bg-paper text-ink text-xs font-semibold border border-ink/15 hover:bg-paper-muted transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-accent" />
            <span>Ôn tập từ vựng</span>
          </Link>

          <Link
            href="/arena"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-accent text-white text-xs font-semibold border border-accent shadow-soft hover:bg-accent-hover transition-colors"
          >
            <Swords className="w-3.5 h-3.5" />
            <span>Thử thách IT Arena</span>
          </Link>

          <Link
            href="/progress"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-pill bg-paper text-ink text-xs font-semibold border border-ink/15 hover:bg-paper-muted transition-colors"
          >
            <TrendingUp className="w-3.5 h-3.5 text-accent" />
            <span>Tiến độ & 7 ngày</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

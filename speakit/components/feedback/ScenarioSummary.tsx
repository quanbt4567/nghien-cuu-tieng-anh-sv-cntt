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
      "SpeakIT: Káº¿t quáº£ luyá»‡n nÃ³i tiáº¿ng Anh CNTT",
      `Ká»‹ch báº£n: ${scenarioTitle}`,
      `Vai trÃ²: ${roleConfig.label} | Danh hiá»‡u: ${devTitle.title}`,
      `Äiá»ƒm trung bÃ¬nh: ${averageScore}/100 | Tá»« khÃ³a Ä‘Ã£ dÃ¹ng: ${totalKeywordsUsed}`,
      `ThÆ°á»Ÿng phiÃªn nÃ y: +${earnedPoints} Ä‘iá»ƒm -> ${coins} IT-Coin (cÃ²n ${remainingForCoin} Ä‘iá»ƒm -> +1 IT-Coin)`,
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
        "KhÃ´ng thá»ƒ tá»± Ä‘á»™ng sao chÃ©p. Vui lÃ²ng chá»¥p mÃ n hÃ¬nh tháº» káº¿t quáº£ bÃªn trÃªn."
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
      <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-700 dark:bg-blue-400" />
            <span className="font-mono text-xs font-bold tracking-wider uppercase text-slate-900 dark:text-slate-50">
              SpeakIT
            </span>
            <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
              â€¢ Phiáº¿u káº¿t quáº£ luyá»‡n nÃ³i
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
              {roleConfig.label}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {devTitle.title}
            </span>
          </div>
        </div>

        <div className="text-center space-y-2.5">
          <div className="w-14 h-14 rounded-full bg-blue-700 dark:bg-blue-600 text-white flex items-center justify-center mx-auto">
            <Award className="w-7 h-7" />
          </div>
          <span className="block text-xs font-mono font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
            HoÃ n thÃ nh {totalTurns}/{totalTurns} lÆ°á»£t luyá»‡n táº­p
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
            {scenarioTitle}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
            PhiÃªn Ä‘á»‘i thoáº¡i Ä‘Ã£ Ä‘Æ°á»£c lÆ°u cá»¥c bá»™ Ä‘á»ƒ cáº­p nháº­t Ä‘iá»ƒm rÃ¨n luyá»‡n vÃ  káº¿ hoáº¡ch 7 ngÃ y.
          </p>
        </div>

        <div className="grid grid-cols-2 max-w-md mx-auto border-y border-slate-200 dark:border-slate-800 divide-x divide-slate-200 dark:divide-slate-800">
          <div className="py-4 px-3 text-center">
            <div className="text-2xl font-mono font-bold text-slate-900 dark:text-slate-50">
              {averageScore}
              <span className="text-xs font-normal text-slate-600 dark:text-slate-400">/100</span>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
              Äiá»ƒm trung bÃ¬nh
            </div>
          </div>
          <div className="py-4 px-3 text-center">
            <div className="text-2xl font-mono font-bold text-blue-700 dark:text-blue-400">
              {totalKeywordsUsed}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
              Tá»« khÃ³a ká»¹ thuáº­t Ä‘Ã£ dÃ¹ng
            </div>
          </div>
        </div>

        <div className="max-w-md mx-auto pb-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 flex items-center justify-center shrink-0">
              <Coins className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className="text-sm font-mono font-bold text-slate-900 dark:text-slate-50">
                +{earnedPoints} Ä‘iá»ƒm -&gt; {coins} IT-Coin
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-300">
                CÃ²n {remainingForCoin} Ä‘iá»ƒm Ä‘á»ƒ nháº­n +1 IT-Coin
              </div>
            </div>
          </div>

          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs font-mono font-semibold text-amber-800 dark:text-amber-300">
            <Flame className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>{gamification.streakDays} ngÃ y</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleCopyResult}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              copied
                ? "bg-green-700 hover:bg-green-800 text-white"
                : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:border-blue-700"
            }`}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copied ? "ÄÃ£ sao chÃ©p!" : "Sao chÃ©p káº¿t quáº£"}</span>
          </button>

          <button
            type="button"
            onClick={onRetry}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:border-blue-700 font-bold text-sm transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
            <span>Luyá»‡n láº¡i ká»‹ch báº£n nÃ y</span>
          </button>

          <Link
            href="/scenarios"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold text-sm active:scale-[0.98] transition-colors"
          >
            <span>Chá»n ká»‹ch báº£n khÃ¡c</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {copyError && (
          <div className="flex items-center justify-center gap-1.5 text-sm text-red-700 dark:text-red-300 font-medium bg-red-50 dark:bg-red-950/50 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
            <span>{copyError}</span>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-700 dark:text-blue-400" />
              <span>3 Tá»« vá»±ng trá»ng tÃ¢m cáº§n Ã´n ngay</span>
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {effectiveMissedKeywords.length > 0
                ? "Gá»£i Ã½ Æ°u tiÃªn tá»« cÃ¡c tá»« khÃ³a báº¡n chÆ°a dÃ¹ng trong phiÃªn vá»«a rá»“i."
                : "CÃ¡c thuáº­t ngá»¯ cá»‘t lÃµi gáº¯n vá»›i ká»‹ch báº£n báº¡n vá»«a luyá»‡n."}
            </p>
          </div>
        </div>

        {weakVocab.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
            {weakVocab.map((item) => {
              const isSpeaking = playingTermId === item.id;
              return (
                <div
                  key={item.id}
                  className="pt-4 pb-3 sm:py-4 sm:px-4 first:sm:pl-0 last:sm:pr-0 flex flex-col justify-between gap-2.5"
                >
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-mono font-bold text-slate-900 dark:text-slate-50">
                          {item.term}
                        </div>
                        <div className="text-xs font-ipa text-blue-700 dark:text-blue-400 font-medium">
                          {item.phonetic}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSpeakTerm(item)}
                        aria-label={`PhÃ¡t Ã¢m tá»« ${item.term}`}
                        title={`Nghe phÃ¡t Ã¢m "${item.term}"`}
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                          isSpeaking
                            ? "bg-red-600 hover:bg-red-700 border-red-600 text-white"
                            : "bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white border-blue-700 dark:border-blue-600"
                        }`}
                      >
                        {isSpeaking ? (
                          <VolumeX className="w-3.5 h-3.5" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
                      {item.meaningVI}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 text-sm text-slate-600 dark:text-slate-300">
            ChÆ°a cÃ³ tá»« vá»±ng gá»£i Ã½ trong thÆ° viá»‡n hiá»‡n táº¡i.
          </div>
        )}

        {ttsError && (
          <div className="flex items-center gap-1.5 text-sm text-red-700 dark:text-red-300 font-medium bg-red-50 dark:bg-red-950/50 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
            <span>{ttsError}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center sm:justify-between gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
          <Link
            href="/vocabulary"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:border-blue-700 text-xs font-semibold transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
            <span>Ã”n táº­p tá»« vá»±ng</span>
          </Link>

          <Link
            href="/arena"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold text-sm active:scale-[0.98] transition-colors"
          >
            <Swords className="w-4 h-4" />
            <span>Thá»­ thÃ¡ch IT Arena</span>
          </Link>

          <Link
            href="/progress"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:border-blue-700 text-xs font-semibold transition-colors"
          >
            <TrendingUp className="w-3.5 h-3.5 text-green-700 dark:text-green-400" />
            <span>Tiáº¿n Ä‘á»™ &amp; 7 ngÃ y</span>
          </Link>
        </div>
      </div>
      <FeedbackPromptModal trigger={true} context="scenario-summary" />
    </div>
  );
}

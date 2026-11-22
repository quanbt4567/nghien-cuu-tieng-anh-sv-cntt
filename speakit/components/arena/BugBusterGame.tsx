"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bug,
  CheckCircle2,
  Clock,
  Coins,
  Eye,
  EyeOff,
  Keyboard,
  Mic,
  Play,
  RotateCcw,
  Send,
  Square,
  XCircle,
  Zap,
} from "lucide-react";
import {
  BUG_BUSTER_CHALLENGES,
  BugBusterChallenge,
  checkBugBusterAnswer,
} from "../../data/minigames";
import {
  getGamificationState,
  pointsToNextCoin,
  recordMinigameResult,
} from "../../lib/gamification";
import {
  readCachedGuestProfile,
  reportGuestPracticePoints,
} from "../../lib/guestClient";
import { mergeProfileIdentity } from "../../lib/profileStats";
import {
  CONTENT_STORAGE_KEY,
  CONTENT_UPDATED_EVENT,
  fetchAndCachePublicContent,
  getEffectiveBugChallenges,
} from "../../lib/contentStore";
import { SpeechController, startSpeechRecognition } from "../../lib/speech";
import { ITRole } from "../../lib/types";
import { FeedbackPromptModal } from "../feedback/FeedbackPromptModal";

const ROUND_DURATION_SEC = 360;
const BUG_DURATION_SEC = 35;
const BASE_FIX_POINTS = 150;

interface BugBusterGameProps {
  role: ITRole;
}

interface FeedbackState {
  kind: "fixed" | "missed";
  targetWord: string;
  pointsEarned: number;
}

interface RoundSummary {
  score: number;
  fixedCount: number;
  attemptedCount: number;
  totalCount: number;
  durationSec: number;
  coinsEarnedNow: number;
  totalCoins: number;
  remainingToNextCoin: number;
  endedEarly?: boolean;
}

function shuffleChallenges(items: BugBusterChallenge[]): BugBusterChallenge[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const CATEGORY_LABELS: Record<BugBusterChallenge["category"], string> = {
  "error-log": "ERROR LOG",
  "code-review": "CODE REVIEW",
  incident: "INCIDENT",
};

function formatHangmanBlank(targetWord: string): string {
  const trimmed = targetWord.trim();
  if (!trimmed) return "_ _ _ _";
  return trimmed
    .split(/\s+/)
    .map((word) => Array.from(word).map(() => "_").join(" "))
    .join("   ");
}

export function BugBusterGame({ role }: BugBusterGameProps) {
  const [phase, setPhase] = useState<"ready" | "playing" | "finished">("ready");
  const [availableChallenges, setAvailableChallenges] = useState<BugBusterChallenge[]>(
    BUG_BUSTER_CHALLENGES
  );
  const [deck, setDeck] = useState<BugBusterChallenge[]>(BUG_BUSTER_CHALLENGES);
  const [challengeIndex, setChallengeIndex] = useState(0);

  const [totalTimeLeft, setTotalTimeLeft] = useState(ROUND_DURATION_SEC);
  const [bugTimeLeft, setBugTimeLeft] = useState(BUG_DURATION_SEC);

  const [score, setScore] = useState(0);
  const [fixedCount, setFixedCount] = useState(0);
  const [attemptedCount, setAttemptedCount] = useState(0);
  const [showPhonetic, setShowPhonetic] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const [typedAnswer, setTypedAnswer] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [summary, setSummary] = useState<RoundSummary | null>(null);

  const speechControllerRef = useRef<SpeechController | null>(null);
  const micSessionRef = useRef(0);
  const speechOffsetRef = useRef(0);
  const rawTranscriptRef = useRef("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishedRef = useRef(false);

  const scoreRef = useRef(0);
  const fixedRef = useRef(0);
  const attemptedRef = useRef(0);
  const totalTimeRef = useRef(ROUND_DURATION_SEC);
  const bugTimeRef = useRef(BUG_DURATION_SEC);
  const challengeIndexRef = useRef(0);
  const availableChallengesRef = useRef<BugBusterChallenge[]>(BUG_BUSTER_CHALLENGES);
  const deckRef = useRef<BugBusterChallenge[]>(BUG_BUSTER_CHALLENGES);
  const feedbackRef = useRef<FeedbackState | null>(null);

  useEffect(() => {
    const syncChallenges = () => {
      const effective = getEffectiveBugChallenges();
      availableChallengesRef.current = effective;
      setAvailableChallenges(effective);
    };

    syncChallenges();
    void fetchAndCachePublicContent();

    window.addEventListener(CONTENT_UPDATED_EVENT, syncChallenges);
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === CONTENT_STORAGE_KEY) {
        syncChallenges();
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(CONTENT_UPDATED_EVENT, syncChallenges);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const stopMic = useCallback(() => {
    micSessionRef.current += 1;
    if (speechControllerRef.current) {
      speechControllerRef.current.abort();
      speechControllerRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  const finishRound = useCallback((endedEarly = false) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearAdvanceTimer();
    stopMic();

    const finalScore = scoreRef.current;
    const finalFixed = fixedRef.current;
    const finalAttempted = attemptedRef.current;
    const totalCount = deckRef.current.length;
    const accuracy =
      finalAttempted > 0 ? Math.round((finalFixed / finalAttempted) * 100) : 0;
    const elapsed = Math.max(
      1,
      ROUND_DURATION_SEC - Math.max(0, totalTimeRef.current)
    );

    const prevState = getGamificationState();
    const prevIdentity = mergeProfileIdentity(readCachedGuestProfile(), prevState);
    const updatedState = recordMinigameResult({
      gameId: "bug-buster",
      score: finalScore,
      accuracyOrWords: accuracy,
      durationSec: elapsed,
      role,
    });
    const pointsPromise = reportGuestPracticePoints("arena-bug-buster", finalScore);
    const optimisticIdentity = mergeProfileIdentity(
      readCachedGuestProfile(),
      updatedState
    );

    setSummary({
      score: finalScore,
      fixedCount: finalFixed,
      attemptedCount: finalAttempted,
      totalCount,
      durationSec: elapsed,
      coinsEarnedNow: Math.max(
        0,
        optimisticIdentity.itCoins - prevIdentity.itCoins
      ),
      totalCoins: optimisticIdentity.itCoins,
      remainingToNextCoin: pointsToNextCoin(optimisticIdentity.totalPoints),
      endedEarly,
    });
    setPhase("finished");

    void pointsPromise.then((player) => {
      const syncedIdentity = mergeProfileIdentity(
        player ?? readCachedGuestProfile(),
        updatedState
      );
      setSummary((prev) =>
        prev
          ? {
              ...prev,
              coinsEarnedNow: Math.max(
                0,
                syncedIdentity.itCoins - prevIdentity.itCoins
              ),
              totalCoins: syncedIdentity.itCoins,
              remainingToNextCoin: pointsToNextCoin(syncedIdentity.totalPoints),
            }
          : prev
      );
    });
  }, [clearAdvanceTimer, role, stopMic]);

  const resolveBug = useCallback(
    (isFixed: boolean) => {
      if (finishedRef.current || feedbackRef.current) return;

      const currentChallenge = deckRef.current[challengeIndexRef.current];
      if (!currentChallenge) {
        finishRound();
        return;
      }

      const nextAttempted = attemptedRef.current + 1;
      attemptedRef.current = nextAttempted;
      setAttemptedCount(nextAttempted);

      let earned = 0;
      if (isFixed) {
        earned = BASE_FIX_POINTS + bugTimeRef.current * 5;
        scoreRef.current += earned;
        fixedRef.current += 1;
        setScore(scoreRef.current);
        setFixedCount(fixedRef.current);
      }

      const nextFeedback: FeedbackState = {
        kind: isFixed ? "fixed" : "missed",
        targetWord: currentChallenge.targetWord,
        pointsEarned: earned,
      };
      feedbackRef.current = nextFeedback;
      setFeedback(nextFeedback);

      clearAdvanceTimer();
      advanceTimerRef.current = setTimeout(() => {
        if (finishedRef.current) return;
        const nextIdx = challengeIndexRef.current + 1;
        if (nextIdx >= deckRef.current.length) {
          finishRound();
          return;
        }
        challengeIndexRef.current = nextIdx;
        setChallengeIndex(nextIdx);
        bugTimeRef.current = BUG_DURATION_SEC;
        setBugTimeLeft(BUG_DURATION_SEC);
        feedbackRef.current = null;
        setFeedback(null);
        setShowPhonetic(false);
        setTypedAnswer("");
        speechOffsetRef.current = rawTranscriptRef.current.length;
        inputRef.current?.focus();
      }, 850);
    },
    [clearAdvanceTimer, finishRound]
  );

  useEffect(() => {
    if (phase !== "playing") return;

    const timer = setInterval(() => {
      if (finishedRef.current || feedbackRef.current) return;

      const nextTotal = totalTimeRef.current - 1;
      totalTimeRef.current = nextTotal;
      setTotalTimeLeft(Math.max(0, nextTotal));

      if (nextTotal <= 0) {
        finishRound();
        return;
      }

      const nextBug = bugTimeRef.current - 1;
      bugTimeRef.current = nextBug;
      setBugTimeLeft(Math.max(0, nextBug));
      if (nextBug <= 0) {
        resolveBug(false);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [phase, finishRound, resolveBug]);

  useEffect(() => {
    return () => {
      clearAdvanceTimer();
      stopMic();
    };
  }, [clearAdvanceTimer, stopMic]);

  const startRound = () => {
    const sourcePool = availableChallengesRef.current;
    if (sourcePool.length === 0) return;

    clearAdvanceTimer();
    stopMic();

    const shuffled = shuffleChallenges(sourcePool);
    deckRef.current = shuffled;
    setDeck(shuffled);

    finishedRef.current = false;
    challengeIndexRef.current = 0;
    scoreRef.current = 0;
    fixedRef.current = 0;
    attemptedRef.current = 0;
    totalTimeRef.current = ROUND_DURATION_SEC;
    bugTimeRef.current = BUG_DURATION_SEC;
    feedbackRef.current = null;
    rawTranscriptRef.current = "";
    speechOffsetRef.current = 0;

    setChallengeIndex(0);
    setScore(0);
    setFixedCount(0);
    setAttemptedCount(0);
    setTotalTimeLeft(ROUND_DURATION_SEC);
    setBugTimeLeft(BUG_DURATION_SEC);
    setFeedback(null);
    setShowPhonetic(false);
    setTypedAnswer("");
    setSpeechError(null);
    setSummary(null);
    setPhase("playing");

    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleToggleMic = () => {
    if (isRecording) {
      stopMic();
      return;
    }

    setSpeechError(null);
    rawTranscriptRef.current = "";
    speechOffsetRef.current = 0;
    const sessionId = ++micSessionRef.current;

    const controller = startSpeechRecognition({
      onStart: () => {
        if (sessionId !== micSessionRef.current) return;
        setIsRecording(true);
      },
      onTranscript: (liveTranscript) => {
        if (sessionId !== micSessionRef.current) return;
        rawTranscriptRef.current = liveTranscript;
        if (liveTranscript.length < speechOffsetRef.current) {
          speechOffsetRef.current = liveTranscript.length;
        }
        const delta = liveTranscript.slice(speechOffsetRef.current).trim();
        if (!delta || feedbackRef.current) return;

        setTypedAnswer(delta);
        const current = deckRef.current[challengeIndexRef.current];
        if (current && checkBugBusterAnswer(delta, current)) {
          resolveBug(true);
        }
      },
      onEnd: () => {
        if (sessionId !== micSessionRef.current) return;
        setIsRecording(false);
      },
      onError: (msgVI) => {
        if (sessionId !== micSessionRef.current) return;
        setIsRecording(false);
        setSpeechError(msgVI);
        inputRef.current?.focus();
      },
    });

    if (controller) {
      speechControllerRef.current = controller;
    } else {
      inputRef.current?.focus();
    }
  };

  const handleSubmitTyped = (e: React.FormEvent) => {
    e.preventDefault();
    if (feedbackRef.current || !typedAnswer.trim()) return;
    const current = deckRef.current[challengeIndexRef.current];
    if (!current) return;
    const matched = checkBugBusterAnswer(typedAnswer, current);
    resolveBug(matched);
  };

  if (phase === "ready") {
    return (
      <section className="liquid-glass-card p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 max-w-xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-emerald-100 text-emerald-800 text-xs font-mono font-bold border border-emerald-300/80">
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
              <span>Thử thách phản xạ từ vựng 280 giây</span>
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              Bug Buster 280s
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Đọc nhanh log lỗi, code review hoặc thông báo sự cố production và
              nói (hoặc gõ) đúng thuật ngữ tiếng Anh còn thiếu trong ô{" "}
              <code className="font-mono font-bold text-sky-700">____</code>.
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 border border-emerald-300/80 flex items-center justify-center shrink-0">
            <Bug className="w-6 h-6 text-emerald-700" />
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-white/80 border border-slate-200/85 rounded-xl p-3.5 space-y-1">
            <div className="font-mono font-bold text-slate-900">280s Tổng vòng</div>
            <p className="text-slate-600">
              Giải quyết {availableChallenges.length} câu (14 câu × 20s) trước khi hết giờ.
            </p>
          </div>
          <div className="bg-white/80 border border-slate-200/85 rounded-xl p-3.5 space-y-1">
            <div className="font-mono font-bold text-slate-900">20s / Mỗi bug</div>
            <p className="text-slate-600">
              Đúng thưởng <strong className="text-emerald-700">+150 điểm</strong> +{" "}
              <strong className="text-sky-700">5 điểm/giây dư</strong>.
            </p>
          </div>
          <div className="bg-white/80 border border-slate-200/85 rounded-xl p-3.5 space-y-1">
            <div className="font-mono font-bold text-slate-900">Mic hoặc Gõ phím</div>
            <p className="text-slate-600">
              Ô gõ văn bản luôn sẵn sàng nếu trình duyệt không bật micro.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={startRound}
          disabled={availableChallenges.length === 0}
          className="liquid-btn-success inline-flex items-center justify-center gap-2 px-6 py-3 rounded-pill text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <Play className="w-4 h-4 fill-white" />
          <span>Bắt đầu Bug Buster 280s ({availableChallenges.length} câu)</span>
        </button>

        {availableChallenges.length === 0 && (
          <p className="text-xs text-rose-600 font-medium">
            Hiện chưa có thử thách Bug Buster nào khả dụng. Vui lòng kiểm tra lại trong Cổng Quản trị.
          </p>
        )}
      </section>
    );
  }

  if (phase === "finished" && summary) {
    return (
      <section className="liquid-glass-card p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/85 pb-4">
          <div className="space-y-1">
            <span className="text-xs font-mono font-bold uppercase text-emerald-700">
              Kết quả Bug Buster 280s
            </span>
            <h2 className="text-2xl font-bold text-slate-900">
              {summary.endedEarly
                ? "Đã kết thúc sớm phiên xử lý sự cố"
                : "Hoàn thành phiên xử lý sự cố!"}
            </h2>
          </div>
          <div className="liquid-glass-pill px-4 py-2 font-mono text-sm font-bold text-emerald-800 border-emerald-300/80">
            +{summary.score} điểm
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white/80 border border-slate-200/85 rounded-xl p-3.5 text-center">
            <div className="text-2xl font-mono font-bold text-slate-900">
              {summary.score}
            </div>
            <div className="text-[11px] text-slate-600 mt-1">Điểm vòng chơi</div>
          </div>
          <div className="bg-white/80 border border-slate-200/85 rounded-xl p-3.5 text-center">
            <div className="text-2xl font-mono font-bold text-emerald-700">
              {summary.fixedCount}
              <span className="text-xs text-slate-500">
                /{summary.attemptedCount}
              </span>
            </div>
            <div className="text-[11px] text-slate-600 mt-1">
              Bug đã sửa (
              {summary.attemptedCount > 0
                ? Math.round((summary.fixedCount / summary.attemptedCount) * 100)
                : 0}
              %)
            </div>
          </div>
          <div className="bg-white/80 border border-slate-200/85 rounded-xl p-3.5 text-center">
            <div className="text-2xl font-mono font-bold text-sky-700">
              {summary.durationSec}s
            </div>
            <div className="text-[11px] text-slate-600 mt-1">Thời gian</div>
          </div>
          <div className="bg-amber-50/90 border border-amber-300/80 rounded-xl p-3.5 text-center">
            <div className="text-2xl font-mono font-bold text-amber-800 flex items-center justify-center gap-1">
              <Coins className="w-5 h-5 text-amber-600" />
              <span>{summary.totalCoins}</span>
            </div>
            <div className="text-[11px] text-amber-800 font-medium mt-1">
              Số dư IT-Coin •{" "}
              {summary.coinsEarnedNow > 0
                ? `+${summary.coinsEarnedNow} IT-Coin`
                : `Còn ${summary.remainingToNextCoin}đ -> +1 Coin`}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={startRound}
            className="liquid-btn-success inline-flex items-center gap-2 px-6 py-3 rounded-pill text-sm font-bold transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Chơi lại</span>
          </button>
        </div>
        <FeedbackPromptModal trigger={true} context="bug-buster" />
      </section>
    );
  }

  const currentChallenge = deck[challengeIndex];
  if (!currentChallenge) return null;

  const promptParts = currentChallenge.promptEN.split("____");
  const bugBarPct = Math.max(0, Math.round((bugTimeLeft / BUG_DURATION_SEC) * 100));

  return (
    <section className="liquid-glass-card p-5 sm:p-7 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-pill font-mono text-xs font-bold ${
              totalTimeLeft <= 10
                ? "liquid-btn-danger animate-pulse"
                : "liquid-glass-pill text-sky-700"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{totalTimeLeft}s</span>
          </span>
          <span className="liquid-glass-pill px-3 py-1 font-mono text-xs font-bold text-emerald-700">
            Điểm: {score}
          </span>
          <span className="liquid-glass-pill px-3 py-1 font-mono text-xs text-slate-700">
            Fixed: {fixedCount} • #{challengeIndex + 1}/{deck.length}
          </span>
        </div>

        <button
          type="button"
          onClick={() => finishRound(true)}
          className="liquid-glass-btn px-3.5 py-1.5 rounded-pill text-xs font-semibold transition-all"
        >
          Kết thúc sớm
        </button>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-600">
          <span>Thời gian cho bug hiện tại</span>
          <span className={bugTimeLeft <= 3 ? "text-rose-600 font-bold" : "text-sky-700"}>
            {bugTimeLeft}s / {BUG_DURATION_SEC}s
          </span>
        </div>
        <div className="w-full h-2.5 bg-slate-200/80 rounded-pill border border-slate-300/70 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              bugTimeLeft <= 3
                ? "bg-gradient-to-r from-rose-500 to-red-500"
                : "bg-gradient-to-r from-emerald-500 to-sky-500"
            }`}
            style={{ width: `${bugBarPct}%` }}
          />
        </div>
      </div>

      <div className="bg-white/85 border border-slate-200/85 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="px-2.5 py-0.5 rounded-pill bg-sky-100 border border-sky-300/80 font-mono text-[10px] font-bold text-sky-800">
            {CATEGORY_LABELS[currentChallenge.category]}
          </span>
          <button
            type="button"
            onClick={() => setShowPhonetic((prev) => !prev)}
            className="liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-1 rounded-pill text-[11px] font-mono font-medium transition-all"
          >
            {showPhonetic ? (
              <EyeOff className="w-3 h-3 text-sky-600" />
            ) : (
              <Eye className="w-3 h-3 text-sky-600" />
            )}
            <span>{showPhonetic ? "Ẩn phiên âm" : "Gợi ý phiên âm IPA"}</span>
          </button>
        </div>

        <p
          aria-label={currentChallenge.promptEN.replace(
            "____",
            feedback ? feedback.targetWord : "____"
          )}
          className="text-base sm:text-lg font-medium text-slate-900 leading-relaxed whitespace-pre-wrap"
        >
          {`${promptParts[0].trimEnd()} `}
          <span
            className={`inline-block min-w-[96px] px-2.5 py-0.5 rounded-lg font-mono font-bold text-center whitespace-pre border transition-colors ${
              feedback?.kind === "fixed"
                ? "bg-emerald-100 text-emerald-800 border-emerald-400"
                : feedback?.kind === "missed"
                ? "bg-rose-100 text-rose-800 border-rose-400"
                : "bg-sky-50 text-sky-700 border-dashed border-sky-400"
            }`}
          >
            {feedback ? feedback.targetWord : formatHangmanBlank(currentChallenge.targetWord)}
          </span>
          {` ${promptParts.slice(1).join("____").trimStart()}`}
        </p>

        <div className="text-xs text-slate-600 bg-slate-100/80 border border-slate-200/85 rounded-xl p-3 space-y-1">
          <div>
            <strong className="text-slate-900">Ngữ cảnh:</strong>{" "}
            {currentChallenge.contextVI}
          </div>
          {showPhonetic && (
            <div className="pt-1 flex items-center gap-2">
              <span className="font-mono text-[11px] text-slate-600">IPA:</span>
              <span className="font-ipa text-sm font-semibold text-sky-700">
                {currentChallenge.phonetic}
              </span>
            </div>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-xl p-3.5 border flex items-center justify-between gap-3 text-sm font-bold ${
            feedback.kind === "fixed"
              ? "bg-emerald-50 text-emerald-900 border-emerald-300"
              : "bg-rose-50 text-rose-900 border-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.kind === "fixed" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>
              {feedback.kind === "fixed"
                ? `BUG FIXED! "${feedback.targetWord}"`
                : `Đáp án đúng: "${feedback.targetWord}"`}
            </span>
          </div>
          {feedback.kind === "fixed" && (
            <span className="font-mono text-xs px-2.5 py-1 rounded-pill bg-emerald-100 border border-emerald-300 text-emerald-800">
              +{feedback.pointsEarned} pts
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <button
          type="button"
          onClick={handleToggleMic}
          className={`inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-pill font-semibold text-xs transition-all shrink-0 ${
            isRecording
              ? "liquid-btn-danger animate-mic-listening"
              : "liquid-btn-primary"
          }`}
        >
          {isRecording ? (
            <>
              <Square className="w-4 h-4 fill-white" />
              <span>Đang nghe...</span>
              <span
                className="flex items-end gap-0.5 h-3.5"
                aria-hidden="true"
              >
                <span className="w-0.5 h-2 bg-white/90 rounded-full animate-pulse" />
                <span className="w-0.5 h-3.5 bg-white/90 rounded-full animate-pulse [animation-delay:120ms]" />
                <span className="w-0.5 h-1.5 bg-white/90 rounded-full animate-pulse [animation-delay:240ms]" />
                <span className="w-0.5 h-3 bg-white/90 rounded-full animate-pulse [animation-delay:360ms]" />
              </span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              <span>Nói đáp án (Mic)</span>
            </>
          )}
        </button>

        <form onSubmit={handleSubmitTyped} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Keyboard className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={typedAnswer}
              onChange={(e) => setTypedAnswer(e.target.value)}
              disabled={feedback !== null}
              placeholder="Hoặc gõ thuật ngữ tiếng Anh rồi nhấn Enter..."
              aria-label="Nhập thuật ngữ tiếng Anh cho ô trống"
              className="liquid-glass-input w-full pl-9 pr-3 py-2.5 rounded-pill text-sm font-mono focus:outline-none disabled:opacity-60"
            />
          </div>
          <button
            type="submit"
            disabled={feedback !== null || !typedAnswer.trim()}
            className="liquid-btn-success inline-flex items-center gap-1.5 px-4 py-2.5 rounded-pill text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Gửi</span>
          </button>
        </form>
      </div>

      {speechError && (
        <p className="text-xs text-rose-800 bg-rose-50 border border-rose-300/80 rounded-xl px-3.5 py-2">
          {speechError}
        </p>
      )}
    </section>
  );
}

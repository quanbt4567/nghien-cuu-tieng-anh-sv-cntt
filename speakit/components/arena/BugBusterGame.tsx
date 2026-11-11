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
  calculateCoins,
  getGamificationState,
  pointsToNextCoin,
  recordMinigameResult,
} from "../../lib/gamification";
import {
  CONTENT_STORAGE_KEY,
  CONTENT_UPDATED_EVENT,
  fetchAndCachePublicContent,
  getEffectiveBugChallenges,
} from "../../lib/contentStore";
import { SpeechController, startSpeechRecognition } from "../../lib/speech";
import { ITRole } from "../../lib/types";

const ROUND_DURATION_SEC = 60;
const BUG_DURATION_SEC = 10;
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
  durationSec: number;
  coinsEarnedNow: number;
  totalCoins: number;
  remainingToNextCoin: number;
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

  // Refs prevent stale closures inside countdown intervals and duplicate result writes
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

  const finishRound = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearAdvanceTimer();
    stopMic();

    const finalScore = scoreRef.current;
    const finalFixed = fixedRef.current;
    const finalAttempted = attemptedRef.current;
    const elapsed = Math.max(1, ROUND_DURATION_SEC - totalTimeRef.current);

    const prevTotalPoints = getGamificationState().totalPoints;
    const updatedState = recordMinigameResult({
      gameId: "bug-buster",
      score: finalScore,
      accuracyOrWords: finalFixed,
      durationSec: elapsed,
      role,
    });

    setSummary({
      score: finalScore,
      fixedCount: finalFixed,
      attemptedCount: finalAttempted,
      durationSec: elapsed,
      coinsEarnedNow:
        calculateCoins(updatedState.totalPoints) - calculateCoins(prevTotalPoints),
      totalCoins: calculateCoins(updatedState.totalPoints),
      remainingToNextCoin: pointsToNextCoin(updatedState.totalPoints),
    });
    setPhase("finished");
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
        // Shift offset so continuous Web Speech transcript from prior bugs doesn't leak forward
        speechOffsetRef.current = rawTranscriptRef.current.length;
        inputRef.current?.focus();
      }, 850);
    },
    [clearAdvanceTimer, finishRound]
  );

  // Main 1-second round & per-bug ticker
  useEffect(() => {
    if (phase !== "playing") return;

    const timer = setInterval(() => {
      if (finishedRef.current) return;

      const nextTotal = totalTimeRef.current - 1;
      totalTimeRef.current = nextTotal;
      setTotalTimeLeft(Math.max(0, nextTotal));

      if (nextTotal <= 0) {
        finishRound();
        return;
      }

      if (!feedbackRef.current) {
        const nextBug = bugTimeRef.current - 1;
        bugTimeRef.current = nextBug;
        setBugTimeLeft(Math.max(0, nextBug));
        if (nextBug <= 0) {
          resolveBug(false);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [phase, finishRound, resolveBug]);

  // Clean up mic and timers on unmount
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
      <section className="bg-white border border-ink/15 rounded-2xl p-6 sm:p-8 shadow-soft space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 max-w-xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-accent-light text-accent text-xs font-mono font-bold border border-accent/25">
              <Zap className="w-3.5 h-3.5" />
              <span>Thử thách phản xạ từ vựng 60 giây</span>
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-ink">
              Bug Buster 60s
            </h2>
            <p className="text-sm text-ink-muted leading-relaxed">
              Đọc nhanh log lỗi, code review hoặc thông báo sự cố production và
              nói (hoặc gõ) đúng thuật ngữ tiếng Anh còn thiếu trong ô{" "}
              <code className="font-mono font-bold text-accent">____</code>.
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-paper border border-ink/15 flex items-center justify-center shrink-0">
            <Bug className="w-6 h-6 text-accent" />
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-paper border border-ink/15 rounded-xl p-3.5 space-y-1">
            <div className="font-mono font-bold text-ink">60s Tổng vòng</div>
            <p className="text-ink-muted">
              Giải quyết càng nhiều bug càng tốt trước khi hết giờ.
            </p>
          </div>
          <div className="bg-paper border border-ink/15 rounded-xl p-3.5 space-y-1">
            <div className="font-mono font-bold text-ink">10s / Mỗi bug</div>
            <p className="text-ink-muted">
              Đúng thưởng <strong className="text-ink">+150 điểm</strong> +{" "}
              <strong className="text-ink">5 điểm/giây dư</strong>.
            </p>
          </div>
          <div className="bg-paper border border-ink/15 rounded-xl p-3.5 space-y-1">
            <div className="font-mono font-bold text-ink">Mic hoặc Gõ phím</div>
            <p className="text-ink-muted">
              Ô gõ văn bản luôn sẵn sàng nếu trình duyệt không bật micro.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={startRound}
          disabled={availableChallenges.length === 0}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-pill bg-accent text-white text-sm font-bold border border-accent shadow-soft hover:bg-accent-hover shadow-hard-press disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <Play className="w-4 h-4 fill-white" />
          <span>Bắt đầu Bug Buster 60s ({availableChallenges.length} câu)</span>
        </button>

        {availableChallenges.length === 0 && (
          <p className="text-xs text-accent font-medium">
            Hiện chưa có thử thách Bug Buster nào khả dụng. Vui lòng kiểm tra lại trong Cổng Quản trị.
          </p>
        )}
      </section>
    );
  }

  if (phase === "finished" && summary) {
    return (
      <section className="bg-white border border-ink/15 rounded-2xl p-6 sm:p-8 shadow-soft space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-paper-muted pb-4">
          <div className="space-y-1">
            <span className="text-xs font-mono font-bold uppercase text-accent">
              Kết quả Bug Buster 60s
            </span>
            <h2 className="text-2xl font-bold text-ink">
              Hoàn thành phiên xử lý sự cố!
            </h2>
          </div>
          <div className="px-4 py-2 rounded-pill bg-ink text-white font-mono text-sm font-bold">
            +{summary.score} điểm
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-paper border border-ink/15 rounded-xl p-3.5 text-center">
            <div className="text-2xl font-mono font-bold text-ink">
              {summary.score}
            </div>
            <div className="text-[11px] text-ink-muted mt-1">Điểm vòng chơi</div>
          </div>
          <div className="bg-paper border border-ink/15 rounded-xl p-3.5 text-center">
            <div className="text-2xl font-mono font-bold text-accent">
              {summary.fixedCount}
              <span className="text-xs text-ink-muted">
                /{summary.attemptedCount}
              </span>
            </div>
            <div className="text-[11px] text-ink-muted mt-1">Bug đã sửa</div>
          </div>
          <div className="bg-paper border border-ink/15 rounded-xl p-3.5 text-center">
            <div className="text-2xl font-mono font-bold text-ink">
              {summary.durationSec}s
            </div>
            <div className="text-[11px] text-ink-muted mt-1">Thời gian</div>
          </div>
          <div className="bg-accent-light border border-accent/30 rounded-xl p-3.5 text-center">
            <div className="text-2xl font-mono font-bold text-accent flex items-center justify-center gap-1">
              <Coins className="w-5 h-5" />
              <span>{summary.totalCoins}</span>
            </div>
            <div className="text-[11px] text-ink font-medium mt-1">
              {summary.coinsEarnedNow > 0
                ? `Nhận thêm +${summary.coinsEarnedNow} IT-Coin!`
                : `Còn ${summary.remainingToNextCoin}đ -> +1 Coin`}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={startRound}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-pill bg-accent text-white text-sm font-bold border border-accent shadow-soft hover:bg-accent-hover shadow-hard-press transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Chơi lại</span>
          </button>
        </div>
      </section>
    );
  }

  const currentChallenge = deck[challengeIndex];
  if (!currentChallenge) return null;

  const promptParts = currentChallenge.promptEN.split("____");
  const bugBarPct = Math.max(0, Math.round((bugTimeLeft / BUG_DURATION_SEC) * 100));

  return (
    <section className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-7 shadow-soft space-y-5">
      {/* Top Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-pill font-mono text-xs font-bold border ${
              totalTimeLeft <= 10
                ? "bg-accent text-white border-accent animate-pulse"
                : "bg-paper text-ink border-ink/20"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{totalTimeLeft}s</span>
          </span>
          <span className="px-3 py-1 rounded-pill bg-paper border border-ink/15 font-mono text-xs font-bold text-ink">
            Điểm: {score}
          </span>
          <span className="px-3 py-1 rounded-pill bg-paper border border-ink/15 font-mono text-xs text-ink-muted">
            Fixed: {fixedCount} • #{challengeIndex + 1}/{deck.length}
          </span>
        </div>

        <button
          type="button"
          onClick={finishRound}
          className="px-3.5 py-1.5 rounded-pill bg-paper-muted text-ink text-xs font-semibold border border-ink/15 hover:bg-paper-subtle transition-colors"
        >
          Kết thúc sớm
        </button>
      </div>

      {/* Per-Bug 10s Countdown Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-mono text-ink-muted">
          <span>Thời gian cho bug hiện tại</span>
          <span className={bugTimeLeft <= 3 ? "text-accent font-bold" : ""}>
            {bugTimeLeft}s / {BUG_DURATION_SEC}s
          </span>
        </div>
        <div className="w-full h-2.5 bg-paper rounded-pill border border-ink/15 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              bugTimeLeft <= 3 ? "bg-accent" : "bg-ink"
            }`}
            style={{ width: `${bugBarPct}%` }}
          />
        </div>
      </div>

      {/* Log / Code Review Prompt Card */}
      <div className="bg-paper border border-ink/15 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="px-2.5 py-0.5 rounded-pill bg-white border border-ink/15 font-mono text-[10px] font-bold text-ink">
            {CATEGORY_LABELS[currentChallenge.category]}
          </span>
          <button
            type="button"
            onClick={() => setShowPhonetic((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-white border border-ink/15 text-[11px] font-mono font-medium text-ink hover:bg-paper-muted transition-colors"
          >
            {showPhonetic ? (
              <EyeOff className="w-3 h-3" />
            ) : (
              <Eye className="w-3 h-3" />
            )}
            <span>{showPhonetic ? "Ẩn phiên âm" : "Gợi ý phiên âm IPA"}</span>
          </button>
        </div>

        <p className="text-base sm:text-lg font-medium text-ink leading-relaxed">
          {promptParts[0]}
          <span
            className={`inline-block min-w-[96px] mx-1 px-2.5 py-0.5 rounded-lg font-mono font-bold text-center border transition-colors ${
              feedback?.kind === "fixed"
                ? "bg-ink text-white border-ink"
                : feedback?.kind === "missed"
                ? "bg-accent-light text-accent border-accent"
                : "bg-white text-accent border-dashed border-accent"
            }`}
          >
            {feedback ? feedback.targetWord : "____"}
          </span>
          {promptParts.slice(1).join("____")}
        </p>

        <div className="text-xs text-ink-muted bg-white border border-ink/10 rounded-xl p-3 space-y-1">
          <div>
            <strong className="text-ink">Ngữ cảnh:</strong>{" "}
            {currentChallenge.contextVI}
          </div>
          {showPhonetic && (
            <div className="pt-1 flex items-center gap-2">
              <span className="font-mono text-[11px] text-ink-muted">IPA:</span>
              <span className="font-ipa text-sm font-semibold text-accent">
                {currentChallenge.phonetic}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Instant Feedback Strip */}
      {feedback && (
        <div
          className={`rounded-xl p-3.5 border flex items-center justify-between gap-3 text-sm font-bold ${
            feedback.kind === "fixed"
              ? "bg-ink text-white border-ink"
              : "bg-accent-light text-accent border-accent"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.kind === "fixed" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 shrink-0" />
            )}
            <span>
              {feedback.kind === "fixed"
                ? `BUG FIXED! "${feedback.targetWord}"`
                : `Đáp án đúng: "${feedback.targetWord}"`}
            </span>
          </div>
          {feedback.kind === "fixed" && (
            <span className="font-mono text-xs px-2.5 py-1 rounded-pill bg-white text-ink">
              +{feedback.pointsEarned} pts
            </span>
          )}
        </div>
      )}

      {/* Voice Input + Always-Accessible Typed Fallback */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <button
          type="button"
          onClick={handleToggleMic}
          className={`inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-pill font-semibold text-xs border transition-all shrink-0 ${
            isRecording
              ? "bg-accent text-white border-accent animate-mic-listening shadow-card"
              : "bg-ink text-white border-ink shadow-soft hover:bg-ink-muted"
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
                <span className="w-0.5 h-2 bg-white rounded-full animate-pulse" />
                <span className="w-0.5 h-3.5 bg-white rounded-full animate-pulse [animation-delay:120ms]" />
                <span className="w-0.5 h-1.5 bg-white rounded-full animate-pulse [animation-delay:240ms]" />
                <span className="w-0.5 h-3 bg-white rounded-full animate-pulse [animation-delay:360ms]" />
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
            <Keyboard className="w-4 h-4 text-ink-faint absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={typedAnswer}
              onChange={(e) => setTypedAnswer(e.target.value)}
              disabled={feedback !== null}
              placeholder="Hoặc gõ thuật ngữ tiếng Anh rồi nhấn Enter..."
              aria-label="Nhập thuật ngữ tiếng Anh cho ô trống"
              className="w-full pl-9 pr-3 py-2.5 rounded-pill bg-paper border border-ink/20 text-sm font-mono text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent disabled:opacity-60"
            />
          </div>
          <button
            type="submit"
            disabled={feedback !== null || !typedAnswer.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-pill bg-accent text-white text-xs font-bold border border-accent shadow-soft hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Gửi</span>
          </button>
        </form>
      </div>

      {speechError && (
        <p className="text-xs text-accent bg-accent-light border border-accent/40 rounded-xl px-3.5 py-2">
          {speechError}
        </p>
      )}
    </section>
  );
}

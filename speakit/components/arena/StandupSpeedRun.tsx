"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Clock,
  Coins,
  Keyboard,
  Loader2,
  Mic,
  Play,
  RotateCcw,
  SkipForward,
  Square,
  Timer,
  Volume2,
} from "lucide-react";
import {
  STANDUP_SPEED_QUESTIONS,
  StandupSpeedQuestion,
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
import { scoreLocally } from "../../lib/localScorer";
import {
  SpeechController,
  speakText,
  startSpeechRecognition,
} from "../../lib/speech";
import { storageAdapter } from "../../lib/storage";
import { ITRole, ScoreResponse } from "../../lib/types";
import { FeedbackPromptModal } from "../feedback/FeedbackPromptModal";

interface StandupSpeedRunProps {
  role: ITRole;
}

interface TurnBreakdown {
  question: StandupSpeedQuestion;
  transcript: string;
  skipped: boolean;
  turnScore: number;
  speedPoints: number;
  timeBonus: number;
  keywordsUsed: string[];
  evaluationMode: "ai" | "local_rules";
  betterSentence: string;
  pronunciationNote: string;
}

interface RunSummary {
  totalScore: number;
  totalKeywordsUsed: number;
  durationSec: number;
  coinsEarnedNow: number;
  totalCoins: number;
  remainingToNextCoin: number;
  usedAi: boolean;
  turns: TurnBreakdown[];
}

export function StandupSpeedRun({ role }: StandupSpeedRunProps) {
  const [phase, setPhase] = useState<"ready" | "playing" | "finished">("ready");
  const [questionIdx, setQuestionIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(
    STANDUP_SPEED_QUESTIONS[0].timeLimitSec
  );

  const [answerText, setAnswerText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingTts, setIsPlayingTts] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [speechRate, setSpeechRate] = useState<0.8 | 1.0 | 1.2>(1.0);
  const [turnFeedback, setTurnFeedback] = useState<TurnBreakdown | null>(null);
  const [summary, setSummary] = useState<RunSummary | null>(null);

  const speechControllerRef = useRef<SpeechController | null>(null);
  const micSessionRef = useRef(0);
  const ttsCancelRef = useRef<(() => void) | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const answerRef = useRef("");
  const timeLeftRef = useRef(STANDUP_SPEED_QUESTIONS[0].timeLimitSec);
  const questionIdxRef = useRef(0);
  const submittingRef = useRef(false);
  const resultsRef = useRef<TurnBreakdown[]>([]);
  const runStartMsRef = useRef(0);

  useEffect(() => {
    const settings = storageAdapter.getSettings();
    setSpeechRate(settings.speechRate ?? 1.0);
  }, []);

  const stopAudio = useCallback(() => {
    micSessionRef.current += 1;
    if (speechControllerRef.current) {
      speechControllerRef.current.abort();
      speechControllerRef.current = null;
    }
    if (ttsCancelRef.current) {
      ttsCancelRef.current();
      ttsCancelRef.current = null;
    }
    setIsRecording(false);
    setIsPlayingTts(false);
  }, []);

  useEffect(() => {
    return () => stopAudio();
  }, [stopAudio]);

  const updateAnswer = (value: string) => {
    answerRef.current = value;
    setAnswerText(value);
  };

  const finalizeRun = useCallback(
    (allTurns: TurnBreakdown[]) => {
      stopAudio();
      const totalScore = allTurns.reduce((sum, t) => sum + t.speedPoints, 0);
      const totalKeywordsUsed = allTurns.reduce(
        (sum, t) => sum + t.keywordsUsed.length,
        0
      );
      const durationSec = Math.max(
        1,
        Math.round((Date.now() - runStartMsRef.current) / 1000)
      );

      const prevState = getGamificationState();
      const prevIdentity = mergeProfileIdentity(
        readCachedGuestProfile(),
        prevState
      );
      const updated = recordMinigameResult({
        gameId: "standup-speed-run",
        score: totalScore,
        accuracyOrWords: totalKeywordsUsed,
        durationSec,
        role,
      });
      const pointsPromise = reportGuestPracticePoints(
        "arena-standup-speed-run",
        totalScore
      );
      const optimisticIdentity = mergeProfileIdentity(
        readCachedGuestProfile(),
        updated
      );

      setSummary({
        totalScore,
        totalKeywordsUsed,
        durationSec,
        coinsEarnedNow: Math.max(
          0,
          optimisticIdentity.itCoins - prevIdentity.itCoins
        ),
        totalCoins: optimisticIdentity.itCoins,
        remainingToNextCoin: pointsToNextCoin(optimisticIdentity.totalPoints),
        usedAi: allTurns.some((t) => t.evaluationMode === "ai"),
        turns: allTurns,
      });
      setPhase("finished");

      void pointsPromise.then((player) => {
        const syncedIdentity = mergeProfileIdentity(
          player ?? readCachedGuestProfile(),
          updated
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
                  remainingToNextCoin: pointsToNextCoin(
                    syncedIdentity.totalPoints
                  ),
                }
              : prev
          );
        }
      );
    },
    [role, stopAudio]
  );

  const submitCurrentTurn = useCallback(
    async (forceSkipIfEmpty: boolean) => {
      if (submittingRef.current) return;
      const idx = questionIdxRef.current;
      const question = STANDUP_SPEED_QUESTIONS[idx];
      if (!question) return;

      const text = answerRef.current.trim();
      if (!text && !forceSkipIfEmpty) return;

      submittingRef.current = true;
      stopAudio();

      const remaining = Math.max(0, timeLeftRef.current);
      let breakdown: TurnBreakdown;

      if (!text) {
        breakdown = {
          question,
          transcript: "",
          skipped: true,
          turnScore: 0,
          speedPoints: 0,
          timeBonus: 0,
          keywordsUsed: [],
          evaluationMode: "local_rules",
          betterSentence: "",
          pronunciationNote: "",
        };
      } else {
        setIsEvaluating(true);
        let evalResult: ScoreResponse;
        try {
          const response = await fetch("/api/score", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              transcript: text,
              scenario: "daily-standup",
              turnIndex: idx,
              expectedKeywords: question.expectedKeywords,
            }),
          });
          if (!response.ok) {
            throw new Error("score_request_failed");
          }
          evalResult = (await response.json()) as ScoreResponse;
        } catch {
          evalResult = scoreLocally({
            transcript: text,
            expectedKeywords: question.expectedKeywords,
          });
        } finally {
          setIsEvaluating(false);
        }

        const timeBonus = evalResult.score > 0 ? remaining * 4 : 0;
        const speedPoints = evalResult.score * 3 + timeBonus;

        breakdown = {
          question,
          transcript: text,
          skipped: false,
          turnScore: evalResult.score,
          speedPoints,
          timeBonus,
          keywordsUsed: evalResult.keywordsUsed,
          evaluationMode: evalResult.evaluationMode,
          betterSentence: evalResult.betterSentence,
          pronunciationNote: evalResult.pronunciationNote,
        };
      }

      const nextResults = [...resultsRef.current, breakdown];
      resultsRef.current = nextResults;
      setTurnFeedback(breakdown);
      setSpeechError(null);
      submittingRef.current = false;
    },
    [stopAudio]
  );

  const handleNextTurn = () => {
    const nextIdx = questionIdxRef.current + 1;
    setTurnFeedback(null);
    if (nextIdx >= STANDUP_SPEED_QUESTIONS.length) {
      finalizeRun(resultsRef.current);
      return;
    }

    questionIdxRef.current = nextIdx;
    setQuestionIdx(nextIdx);
    const nextLimit = STANDUP_SPEED_QUESTIONS[nextIdx].timeLimitSec;
    timeLeftRef.current = nextLimit;
    setTimeLeft(nextLimit);
    updateAnswer("");
    setSpeechError(null);
  };

  useEffect(() => {
    if (phase !== "playing" || isEvaluating || turnFeedback !== null) return;

    const timer = setInterval(() => {
      if (submittingRef.current) return;
      const next = timeLeftRef.current - 1;
      timeLeftRef.current = next;
      setTimeLeft(Math.max(0, next));

      if (next <= 0) {
        void submitCurrentTurn(true);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [phase, isEvaluating, turnFeedback, submitCurrentTurn]);

  const startRun = () => {
    stopAudio();
    const settings = storageAdapter.getSettings();
    setSpeechRate(settings.speechRate ?? 1.0);

    resultsRef.current = [];
    questionIdxRef.current = 0;
    timeLeftRef.current = STANDUP_SPEED_QUESTIONS[0].timeLimitSec;
    submittingRef.current = false;
    runStartMsRef.current = Date.now();

    setQuestionIdx(0);
    setTimeLeft(STANDUP_SPEED_QUESTIONS[0].timeLimitSec);
    updateAnswer("");
    setSpeechError(null);
    setTurnFeedback(null);
    setSummary(null);
    setPhase("playing");
  };

  const handleToggleMic = () => {
    if (isRecording) {
      micSessionRef.current += 1;
      if (speechControllerRef.current) {
        speechControllerRef.current.stop();
        speechControllerRef.current = null;
      }
      setIsRecording(false);
      return;
    }

    setSpeechError(null);
    const sessionId = ++micSessionRef.current;
    const controller = startSpeechRecognition({
      onStart: () => {
        if (sessionId !== micSessionRef.current) return;
        setIsRecording(true);
      },
      onTranscript: (liveTranscript) => {
        if (sessionId !== micSessionRef.current) return;
        updateAnswer(liveTranscript);
      },
      onEnd: () => {
        if (sessionId !== micSessionRef.current) return;
        setIsRecording(false);
      },
      onError: (msgVI) => {
        if (sessionId !== micSessionRef.current) return;
        setIsRecording(false);
        setSpeechError(msgVI);
        textareaRef.current?.focus();
      },
    });

    if (controller) {
      speechControllerRef.current = controller;
    } else {
      textareaRef.current?.focus();
    }
  };

  const handleSpeakQuestion = () => {
    const q = STANDUP_SPEED_QUESTIONS[questionIdx];
    if (!q) return;
    setIsPlayingTts(true);
    ttsCancelRef.current = speakText(
      q.questionEN,
      speechRate,
      () => setIsPlayingTts(false),
      (err) => {
        setIsPlayingTts(false);
        setSpeechError(err);
      }
    );
  };

  if (phase === "ready") {
    return (
      <section className="liquid-glass-card p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 max-w-xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-indigo-500/20 text-indigo-200 text-xs font-mono font-bold border border-indigo-400/45">
              <Timer className="w-3.5 h-3.5 text-indigo-300" />
              <span>3 câu hỏi Daily Standup • 25 giây / câu</span>
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              Standup Speed Run
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Trả lời nhanh 3 câu hỏi kinh điển (Yesterday, Today, Blockers)
              trong tối đa 25 giây mỗi câu. Điểm tốc độ ={" "}
              <code className="font-mono font-bold text-cyan-300">
                điểm lượt × 3 + giây dư × 4
              </code>
              .
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/45 flex items-center justify-center shrink-0">
            <Timer className="w-6 h-6 text-indigo-300" />
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 text-xs">
          {STANDUP_SPEED_QUESTIONS.map((q, idx) => (
            <div
              key={q.id}
              className="bg-slate-950/50 border border-white/15 rounded-xl p-3.5 space-y-1"
            >
              <div className="font-mono font-bold text-indigo-300">
                Câu 0{idx + 1} • {q.timeLimitSec}s
              </div>
              <div className="font-semibold text-white">{q.labelVI}</div>
              <p className="text-slate-300">"{q.questionEN}"</p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={startRun}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-pill bg-gradient-to-r from-indigo-500/85 to-blue-600/85 hover:from-indigo-500/95 hover:to-blue-600/95 text-white text-sm font-bold border border-indigo-300/60 shadow-[0_0_22px_rgba(99,102,241,0.42),inset_0_1px_1px_rgba(255,255,255,0.45)] transition-all"
        >
          <Play className="w-4 h-4 fill-white" />
          <span>Bắt đầu Standup Speed Run</span>
        </button>
      </section>
    );
  }

  if (phase === "finished" && summary) {
    return (
      <section className="liquid-glass-card p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-4">
          <div className="space-y-1">
            <span className="text-xs font-mono font-bold uppercase text-indigo-300">
              Kết quả Standup Speed Run
            </span>
            <h2 className="text-2xl font-bold text-white">
              Hoàn tất 3 lượt Daily Standup!
            </h2>
          </div>
          <div className="liquid-glass-pill px-4 py-2 font-mono text-sm font-bold text-cyan-200 border-cyan-400/45">
            +{summary.totalScore} điểm
          </div>
        </div>

        <div className="bg-slate-950/50 border border-white/15 rounded-xl p-3 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong className="text-white">Phương thức chấm điểm:</strong>{" "}
            {summary.usedAi
              ? "AI Gemini (đánh giá phát âm ước lượng từ văn bản transcript)"
              : "Bộ quy tắc từ khóa cục bộ (rule-based matching, ước lượng từ văn bản)"}
          </span>
          <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-pill bg-indigo-500/20 border border-indigo-400/40 text-indigo-200">
            {summary.usedAi ? "AI + Speed Bonus" : "Local Rules + Speed Bonus"}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-950/50 border border-white/15 rounded-xl p-3.5 text-center">
            <div className="text-2xl font-mono font-bold text-white">
              {summary.totalScore}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Tổng điểm Run</div>
          </div>
          <div className="bg-slate-950/50 border border-white/15 rounded-xl p-3.5 text-center">
            <div className="text-2xl font-mono font-bold text-emerald-300">
              {summary.totalKeywordsUsed}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Từ khóa đạt</div>
          </div>
          <div className="bg-slate-950/50 border border-white/15 rounded-xl p-3.5 text-center">
            <div className="text-2xl font-mono font-bold text-cyan-300">
              {summary.durationSec}s
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Tổng thời gian</div>
          </div>
          <div className="bg-amber-500/15 border border-amber-400/35 rounded-xl p-3.5 text-center">
            <div className="text-2xl font-mono font-bold text-amber-200 flex items-center justify-center gap-1">
              <Coins className="w-5 h-5 text-amber-300" />
              <span>{summary.totalCoins}</span>
            </div>
            <div className="text-[11px] text-amber-100/90 font-medium mt-1">
              Số dư IT-Coin •{" "}
              {summary.coinsEarnedNow > 0
                ? `+${summary.coinsEarnedNow} IT-Coin`
                : `Còn ${summary.remainingToNextCoin}đ -> +1 Coin`}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white">
            Chi tiết từng lượt Standup
          </h3>
          {summary.turns.map((turn, idx) => (
            <div
              key={turn.question.id}
              className="bg-slate-950/55 border border-white/15 rounded-2xl p-4 space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-white">
                  <span className="font-mono text-indigo-300 mr-1.5">
                    0{idx + 1}.
                  </span>
                  {turn.question.questionEN}
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="px-2.5 py-0.5 rounded-pill bg-white/[0.08] border border-white/15 text-slate-200">
                    {turn.turnScore}/100
                  </span>
                  <span className="px-2.5 py-0.5 rounded-pill bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 font-bold">
                    +{turn.speedPoints} pts
                  </span>
                </div>
              </div>

              {turn.skipped ? (
                <p className="text-xs text-slate-400 italic">
                  Đã bỏ qua hoặc hết giờ khi chưa nhập câu trả lời.
                </p>
              ) : (
                <>
                  <p className="text-xs text-slate-100 bg-white/[0.05] border border-white/12 rounded-xl p-2.5">
                    "{turn.transcript}"
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="flex flex-wrap gap-1.5">
                      {turn.keywordsUsed.length > 0 ? (
                        turn.keywordsUsed.map((kw) => (
                          <span
                            key={kw}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-emerald-500/15 border border-emerald-400/35 font-mono text-emerald-200"
                          >
                            <Check className="w-3 h-3 text-emerald-300" />
                            <span>{kw}</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400">
                          Chưa khớp từ khóa gợi ý
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-slate-400">
                      {turn.evaluationMode === "ai"
                        ? "AI (Gemini)"
                        : "Local Rules"}
                      {turn.timeBonus > 0
                        ? ` • Bonus tốc độ +${turn.timeBonus}`
                        : ""}
                    </span>
                  </div>
                  {turn.betterSentence && (
                    <div className="text-[11px] text-slate-300 pt-1.5 border-t border-white/10">
                      <strong className="text-cyan-200">Gợi ý mượt hơn:</strong>{" "}
                      "{turn.betterSentence}"
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={startRun}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-pill bg-gradient-to-r from-indigo-500/85 to-blue-600/85 hover:from-indigo-500/95 hover:to-blue-600/95 text-white text-sm font-bold border border-indigo-300/60 shadow-[0_0_22px_rgba(99,102,241,0.42),inset_0_1px_1px_rgba(255,255,255,0.45)] transition-all"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Chạy lại</span>
        </button>
        <FeedbackPromptModal trigger={true} context="standup-speed-run" />
      </section>
    );
  }

  const currentQuestion = STANDUP_SPEED_QUESTIONS[questionIdx];
  if (!currentQuestion) return null;

  const progressPct = Math.max(
    0,
    Math.round((timeLeft / currentQuestion.timeLimitSec) * 100)
  );

  return (
    <section className="liquid-glass-card p-5 sm:p-7 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {STANDUP_SPEED_QUESTIONS.map((q, idx) => (
            <span
              key={q.id}
              className={`px-3 py-1 rounded-pill text-xs font-mono font-bold border ${
                idx === questionIdx
                  ? "bg-indigo-500/30 text-indigo-100 border-indigo-400/60 shadow-[0_0_14px_rgba(99,102,241,0.35)]"
                  : idx < questionIdx
                  ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/45"
                  : "liquid-glass-pill text-slate-400"
              }`}
            >
              Câu {idx + 1}/3
            </span>
          ))}
        </div>

        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-pill font-mono text-xs font-bold ${
            timeLeft <= 5
              ? "liquid-btn-danger animate-pulse"
              : "liquid-glass-pill text-cyan-200"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{timeLeft}s</span>
        </span>
      </div>

      <div className="w-full h-2.5 bg-slate-950/65 rounded-pill border border-white/15 overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${
            timeLeft <= 5
              ? "bg-gradient-to-r from-rose-500 to-red-500"
              : "bg-gradient-to-r from-indigo-400 to-cyan-400"
          }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="bg-slate-950/55 border border-white/15 rounded-2xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-mono font-bold uppercase text-indigo-300">
            {currentQuestion.labelVI}
          </span>
          <button
            type="button"
            onClick={handleSpeakQuestion}
            className="liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-1 rounded-pill text-xs font-mono font-semibold transition-all"
          >
            <Volume2
              className={`w-3.5 h-3.5 ${
                isPlayingTts ? "text-cyan-300 animate-pulse" : "text-indigo-300"
              }`}
            />
            <span>{isPlayingTts ? "Đang đọc..." : "Nghe câu hỏi"}</span>
          </button>
        </div>

        <h3 className="text-lg sm:text-xl font-bold text-white">
          "{currentQuestion.questionEN}"
        </h3>

        <p className="text-xs text-slate-300">{currentQuestion.hintVI}</p>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {currentQuestion.expectedKeywords.slice(0, 6).map((kw) => (
            <span
              key={kw}
              className="px-2.5 py-0.5 rounded-pill bg-white/[0.08] border border-white/15 text-[11px] font-mono text-cyan-200"
            >
              {kw}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleToggleMic}
            disabled={isEvaluating || turnFeedback !== null}
            className={`inline-flex items-center gap-2.5 px-5 py-2.5 rounded-pill font-semibold text-xs transition-all disabled:opacity-50 ${
              isRecording
                ? "liquid-btn-danger animate-mic-listening"
                : "liquid-btn-primary"
            }`}
          >
            {isRecording ? (
              <>
                <Square className="w-4 h-4 fill-white" />
                <span>Dừng ghi âm</span>
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
                <span>Trả lời bằng Micro</span>
              </>
            )}
          </button>

          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400">
            <Keyboard className="w-3.5 h-3.5" />
            <span>Hoặc gõ trực tiếp bên dưới</span>
          </span>
        </div>

        <textarea
          ref={textareaRef}
          rows={3}
          value={answerText}
          onChange={(e) => updateAnswer(e.target.value)}
          disabled={isEvaluating || turnFeedback !== null}
          placeholder="Ví dụ: Yesterday I fixed the login API timeout and merged my pull request..."
          aria-label="Câu trả lời Daily Standup bằng tiếng Anh"
          className="liquid-glass-input w-full p-3.5 rounded-2xl text-sm focus:outline-none resize-none disabled:opacity-60"
        />

        {speechError && (
          <p className="text-xs text-rose-200 bg-rose-500/15 border border-rose-400/40 rounded-xl px-3.5 py-2">
            {speechError}
          </p>
        )}
      </div>

      {turnFeedback && (
        <div className="bg-slate-950/60 border border-white/15 rounded-2xl p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-mono font-bold uppercase text-cyan-300">
              {turnFeedback.skipped ? "Đã bỏ qua lượt" : "Kết quả lượt vừa rồi"}
            </span>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="px-2.5 py-0.5 rounded-pill bg-white/[0.08] border border-white/15 text-slate-200">
                {turnFeedback.turnScore}/100
              </span>
              <span className="px-2.5 py-0.5 rounded-pill bg-emerald-500/20 border border-emerald-400/45 text-emerald-200 font-bold">
                +{turnFeedback.speedPoints} pts
              </span>
            </div>
          </div>

          {!turnFeedback.skipped && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex flex-wrap gap-1.5">
                  {turnFeedback.keywordsUsed.length > 0 ? (
                    turnFeedback.keywordsUsed.map((kw) => (
                      <span
                        key={kw}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-emerald-500/15 border border-emerald-400/35 font-mono text-emerald-200"
                      >
                        <Check className="w-3 h-3 text-emerald-300" />
                        <span>{kw}</span>
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400">
                      Chưa khớp từ khóa gợi ý
                    </span>
                  )}
                </div>
                {turnFeedback.timeBonus > 0 && (
                  <span className="font-mono text-amber-300">
                    Bonus tốc độ +{turnFeedback.timeBonus}
                  </span>
                )}
              </div>

              {turnFeedback.betterSentence && (
                <p className="text-xs text-slate-300 pt-1.5 border-t border-white/10">
                  <strong className="text-cyan-200">Gợi ý mượt hơn:</strong> "
                  {turnFeedback.betterSentence}"
                </p>
              )}

              {turnFeedback.pronunciationNote && (
                <p className="text-xs text-slate-300">
                  <strong className="text-amber-200">Gợi ý phát âm:</strong>{" "}
                  {turnFeedback.pronunciationNote}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {turnFeedback ? (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={handleNextTurn}
            className="liquid-btn-primary inline-flex items-center gap-2 px-6 py-2.5 rounded-pill text-xs sm:text-sm font-bold transition-all"
          >
            <span>
              {questionIdx === STANDUP_SPEED_QUESTIONS.length - 1
                ? "Xem kết quả"
                : "Câu tiếp theo"}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={() => void submitCurrentTurn(true)}
            disabled={isEvaluating}
            className="liquid-glass-btn inline-flex items-center gap-1.5 px-4 py-2.5 rounded-pill text-xs font-semibold disabled:opacity-50 transition-all"
          >
            <SkipForward className="w-3.5 h-3.5" />
            <span>Bỏ qua câu này</span>
          </button>

          <button
            type="button"
            onClick={() => void submitCurrentTurn(false)}
            disabled={isEvaluating || !answerText.trim()}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-pill bg-gradient-to-r from-indigo-500/85 to-blue-600/85 hover:from-indigo-500/95 hover:to-blue-600/95 text-white text-xs sm:text-sm font-bold border border-indigo-300/60 shadow-[0_0_20px_rgba(99,102,241,0.4),inset_0_1px_1px_rgba(255,255,255,0.45)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {isEvaluating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang chấm điểm...</span>
              </>
            ) : (
              <>
                <span>Nộp câu trả lời</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
}

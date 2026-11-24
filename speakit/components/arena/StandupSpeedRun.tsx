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
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 text-xs font-mono font-bold">
              <Timer className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
              <span>3 câu hỏi Daily Standup • 25 giây / câu</span>
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              Standup Speed Run
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Trả lời nhanh 3 câu hỏi kinh điển (Yesterday, Today, Blockers)
              trong tối đa 25 giây mỗi câu. Điểm tốc độ ={" "}
              <code className="font-mono font-bold text-blue-700 dark:text-blue-400">
                điểm lượt × 3 + giây dư × 4
              </code>
              .
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 flex items-center justify-center shrink-0">
            <Timer className="w-6 h-6 text-blue-700 dark:text-blue-400" />
          </div>
        </div>

        <div className="grid sm:grid-cols-3 border-t border-b border-slate-200 dark:border-slate-800 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
          {STANDUP_SPEED_QUESTIONS.map((q, idx) => (
            <div
              key={q.id}
              className="py-3.5 sm:px-4 first:sm:pl-0 last:sm:pr-0 space-y-1"
            >
              <div className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400">
                Câu 0{idx + 1} • {q.timeLimitSec}s
              </div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{q.labelVI}</div>
              <p className="text-sm text-slate-600 dark:text-slate-300">"{q.questionEN}"</p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={startRun}
          className="liquid-btn-primary inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-bold transition-colors"
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="space-y-1">
            <span className="text-xs font-mono font-bold uppercase text-blue-700 dark:text-blue-400">
              Kết quả Standup Speed Run
            </span>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Hoàn tất 3 lượt Daily Standup!
            </h2>
          </div>
          <div className="px-4 py-2 rounded-full bg-blue-50 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 font-mono text-sm font-bold text-blue-800 dark:text-blue-300">
            +{summary.totalScore} điểm
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-[#263349] rounded-lg px-3.5 py-2.5 text-sm text-slate-600 dark:text-slate-300 flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong className="text-slate-900 dark:text-slate-100">Phương thức chấm điểm:</strong>{" "}
            {summary.usedAi
              ? "AI Gemini (đánh giá phát âm ước lượng từ văn bản transcript)"
              : "Bộ quy tắc từ khóa cục bộ (rule-based matching, ước lượng từ văn bản)"}
          </span>
          <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 text-blue-800 dark:text-blue-300">
            {summary.usedAi ? "AI + Speed Bonus" : "Local Rules + Speed Bonus"}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-b border-slate-200 dark:border-slate-800 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
          <div className="p-3.5 text-center">
            <div className="text-2xl font-mono font-bold text-slate-900 dark:text-slate-100">
              {summary.totalScore}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">Tổng điểm Run</div>
          </div>
          <div className="p-3.5 text-center">
            <div className="text-2xl font-mono font-bold text-green-700 dark:text-green-400">
              {summary.totalKeywordsUsed}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">Từ khóa đạt</div>
          </div>
          <div className="p-3.5 text-center">
            <div className="text-2xl font-mono font-bold text-blue-700 dark:text-blue-400">
              {summary.durationSec}s
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">Tổng thời gian</div>
          </div>
          <div className="p-3.5 text-center bg-amber-50/70 dark:bg-amber-950/30">
            <div className="text-2xl font-mono font-bold text-amber-800 dark:text-amber-300 flex items-center justify-center gap-1">
              <Coins className="w-5 h-5 text-amber-700 dark:text-amber-400" />
              <span>{summary.totalCoins}</span>
            </div>
            <div className="text-sm text-amber-800 dark:text-amber-300 font-medium mt-1">
              IT-Coin:{" "}
              {summary.coinsEarnedNow > 0
                ? `+${summary.coinsEarnedNow} IT-Coin`
                : `Còn ${summary.remainingToNextCoin}đ`}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Chi tiết từng lượt Standup
          </h3>
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-b border-slate-200 dark:border-slate-800">
            {summary.turns.map((turn, idx) => (
              <div
                key={turn.question.id}
                className="py-4 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    <span className="font-mono text-blue-700 dark:text-blue-400 mr-1.5">
                      0{idx + 1}.
                    </span>
                    {turn.question.questionEN}
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                      {turn.turnScore}/100
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 text-blue-800 dark:text-blue-300 font-bold">
                      +{turn.speedPoints} pts
                    </span>
                  </div>
                </div>

                {turn.skipped ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                    Đã bỏ qua hoặc hết giờ khi chưa nhập câu trả lời.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-[#263349] rounded-lg px-3 py-2">
                      "{turn.transcript}"
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap gap-1.5">
                        {turn.keywordsUsed.length > 0 ? (
                          turn.keywordsUsed.map((kw) => (
                            <span
                              key={kw}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 border border-green-200 dark:bg-green-950/40 dark:border-green-800 font-mono text-green-800 dark:text-green-300"
                            >
                              <Check className="w-3 h-3 text-green-700 dark:text-green-400" />
                              <span>{kw}</span>
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-slate-500 dark:text-slate-400">
                            Chưa khớp từ khóa gợi ý
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-slate-600 dark:text-slate-400">
                        {turn.evaluationMode === "ai"
                          ? "AI (Gemini)"
                          : "Local Rules"}
                        {turn.timeBonus > 0
                          ? ` • Bonus tốc độ +${turn.timeBonus}`
                          : ""}
                      </span>
                    </div>
                    {turn.betterSentence && (
                      <div className="text-sm text-slate-600 dark:text-slate-300 pt-1">
                        <strong className="text-blue-700 dark:text-blue-400">Gợi ý mượt hơn:</strong>{" "}
                        "{turn.betterSentence}"
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={startRun}
          className="liquid-btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-bold transition-colors"
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

  const progressRatio = Math.max(
    0,
    Math.min(1, timeLeft / currentQuestion.timeLimitSec)
  );

  return (
    <section className="liquid-glass-card p-5 sm:p-7 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {STANDUP_SPEED_QUESTIONS.map((q, idx) => (
            <span
              key={q.id}
              className={`px-3 py-1 rounded-full text-xs font-mono font-bold border ${
                idx === questionIdx
                  ? "bg-blue-700 text-white border-blue-700 dark:bg-blue-600 dark:border-blue-600"
                  : idx < questionIdx
                  ? "bg-green-50 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800"
                  : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
              }`}
            >
              Câu {idx + 1}/3
            </span>
          ))}
        </div>

        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-mono text-xs font-bold ${
            timeLeft <= 5
              ? "bg-red-600 text-white"
              : "bg-blue-50 border border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{timeLeft}s</span>
        </span>
      </div>

      <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full border border-slate-300 dark:border-slate-700 overflow-hidden">
        <div
          className={`w-full h-full origin-left transition-transform duration-500 ${
            timeLeft <= 5 ? "bg-red-600" : "bg-blue-700 dark:bg-blue-600"
          }`}
          style={{ transform: `scaleX(${progressRatio})` }}
        />
      </div>

      <div className="border-t border-b border-slate-200 dark:border-slate-800 py-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-mono font-bold uppercase text-blue-700 dark:text-blue-400">
            {currentQuestion.labelVI}
          </span>
          <button
            type="button"
            onClick={handleSpeakQuestion}
            className="liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-colors"
          >
            <Volume2
              className={`w-3.5 h-3.5 ${
                isPlayingTts ? "text-blue-700 dark:text-blue-400 animate-pulse" : "text-blue-700 dark:text-blue-400"
              }`}
            />
            <span>{isPlayingTts ? "Đang đọc..." : "Nghe câu hỏi"}</span>
          </button>
        </div>

        <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
          "{currentQuestion.questionEN}"
        </h3>

        <p className="text-sm text-slate-600 dark:text-slate-300">{currentQuestion.hintVI}</p>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {currentQuestion.expectedKeywords.slice(0, 6).map((kw) => (
            <span
              key={kw}
              className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 text-xs font-mono text-blue-800 dark:text-blue-300"
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
            className={`inline-flex items-center gap-2.5 px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 ${
              isRecording
                ? "liquid-btn-danger"
                : "liquid-btn-primary"
            }`}
          >
            {isRecording ? (
              <>
                <Square className="w-4 h-4 fill-white" />
                <span>Dừng ghi âm</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span>Trả lời bằng Micro</span>
              </>
            )}
          </button>

          <span className="inline-flex items-center gap-1.5 text-sm font-mono text-slate-600 dark:text-slate-400">
            <Keyboard className="w-4 h-4" />
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
          className="liquid-glass-input w-full p-3.5 rounded-lg text-sm focus:outline-none resize-none disabled:opacity-60"
        />

        {speechError && (
          <p className="text-sm text-red-800 dark:text-red-200 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-lg px-3.5 py-2">
            {speechError}
          </p>
        )}
      </div>

      {turnFeedback && (
        <div className="border-t border-b border-slate-200 dark:border-slate-800 py-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-mono font-bold uppercase text-blue-700 dark:text-blue-400">
              {turnFeedback.skipped ? "Đã bỏ qua lượt" : "Kết quả lượt vừa rồi"}
            </span>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                {turnFeedback.turnScore}/100
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-green-50 border border-green-200 dark:bg-green-950/40 dark:border-green-800 text-green-800 dark:text-green-300 font-bold">
                +{turnFeedback.speedPoints} pts
              </span>
            </div>
          </div>

          {!turnFeedback.skipped && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap gap-1.5">
                  {turnFeedback.keywordsUsed.length > 0 ? (
                    turnFeedback.keywordsUsed.map((kw) => (
                      <span
                        key={kw}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 border border-green-200 dark:bg-green-950/40 dark:border-green-800 font-mono text-green-800 dark:text-green-300"
                      >
                        <Check className="w-3 h-3 text-green-700 dark:text-green-400" />
                        <span>{kw}</span>
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      Chưa khớp từ khóa gợi ý
                    </span>
                  )}
                </div>
                {turnFeedback.timeBonus > 0 && (
                  <span className="font-mono text-amber-700 dark:text-amber-400 font-semibold">
                    Bonus tốc độ +{turnFeedback.timeBonus}
                  </span>
                )}
              </div>

              {turnFeedback.betterSentence && (
                <p className="text-sm text-slate-600 dark:text-slate-300 pt-1.5 border-t border-slate-200 dark:border-slate-800">
                  <strong className="text-blue-700 dark:text-blue-400">Gợi ý mượt hơn:</strong> "
                  {turnFeedback.betterSentence}"
                </p>
              )}

              {turnFeedback.pronunciationNote && (
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  <strong className="text-amber-700 dark:text-amber-400">Gợi ý phát âm:</strong>{" "}
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
            className="liquid-btn-primary inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-colors"
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
            className="liquid-glass-btn inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            <SkipForward className="w-4 h-4" />
            <span>Bỏ qua câu này</span>
          </button>

          <button
            type="button"
            onClick={() => void submitCurrentTurn(false)}
            disabled={isEvaluating || !answerText.trim()}
            className="liquid-btn-primary inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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

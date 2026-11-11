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
  calculateCoins,
  getGamificationState,
  pointsToNextCoin,
  recordMinigameResult,
} from "../../lib/gamification";
import { reportGuestPracticePoints } from "../../lib/guestClient";
import { scoreLocally } from "../../lib/localScorer";
import {
  SpeechController,
  speakText,
  startSpeechRecognition,
} from "../../lib/speech";
import { storageAdapter } from "../../lib/storage";
import { ITRole, ScoreResponse } from "../../lib/types";

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

      const prevTotal = getGamificationState().totalPoints;
      const updated = recordMinigameResult({
        gameId: "standup-speed-run",
        score: totalScore,
        accuracyOrWords: totalKeywordsUsed,
        durationSec,
        role,
      });
      void reportGuestPracticePoints("arena-standup-speed-run", totalScore);

      setSummary({
        totalScore,
        totalKeywordsUsed,
        durationSec,
        coinsEarnedNow:
          calculateCoins(updated.totalPoints) - calculateCoins(prevTotal),
        totalCoins: calculateCoins(updated.totalPoints),
        remainingToNextCoin: pointsToNextCoin(updated.totalPoints),
        usedAi: allTurns.some((t) => t.evaluationMode === "ai"),
        turns: allTurns,
      });
      setPhase("finished");
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

      const nextIdx = idx + 1;
      if (nextIdx >= STANDUP_SPEED_QUESTIONS.length) {
        submittingRef.current = false;
        finalizeRun(nextResults);
        return;
      }

      questionIdxRef.current = nextIdx;
      setQuestionIdx(nextIdx);
      const nextLimit = STANDUP_SPEED_QUESTIONS[nextIdx].timeLimitSec;
      timeLeftRef.current = nextLimit;
      setTimeLeft(nextLimit);
      updateAnswer("");
      setSpeechError(null);
      submittingRef.current = false;
    },
    [finalizeRun, stopAudio]
  );

  // Per-question 25s countdown timer (pauses while awaiting /api/score)
  useEffect(() => {
    if (phase !== "playing" || isEvaluating) return;

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
  }, [phase, isEvaluating, submitCurrentTurn]);

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
      <section className="bg-white border border-ink/15 rounded-2xl p-6 sm:p-8 shadow-soft space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 max-w-xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-accent-light text-accent text-xs font-mono font-bold border border-accent/25">
              <Timer className="w-3.5 h-3.5" />
              <span>3 câu hỏi Daily Standup • 25 giây / câu</span>
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-ink">
              Standup Speed Run
            </h2>
            <p className="text-sm text-ink-muted leading-relaxed">
              Trả lời nhanh 3 câu hỏi kinh điển (Yesterday, Today, Blockers)
              trong tối đa 25 giây mỗi câu. Điểm tốc độ ={" "}
              <code className="font-mono font-bold text-ink">
                điểm lượt × 3 + giây dư × 4
              </code>
              .
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-paper border border-ink/15 flex items-center justify-center shrink-0">
            <Timer className="w-6 h-6 text-accent" />
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 text-xs">
          {STANDUP_SPEED_QUESTIONS.map((q, idx) => (
            <div
              key={q.id}
              className="bg-paper border border-ink/15 rounded-xl p-3.5 space-y-1"
            >
              <div className="font-mono font-bold text-accent">
                Câu 0{idx + 1} • {q.timeLimitSec}s
              </div>
              <div className="font-semibold text-ink">{q.labelVI}</div>
              <p className="text-ink-muted">"{q.questionEN}"</p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={startRun}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-pill bg-accent text-white text-sm font-bold border border-accent shadow-soft hover:bg-accent-hover shadow-hard-press transition-all"
        >
          <Play className="w-4 h-4 fill-white" />
          <span>Bắt đầu Standup Speed Run</span>
        </button>
      </section>
    );
  }

  if (phase === "finished" && summary) {
    return (
      <section className="bg-white border border-ink/15 rounded-2xl p-6 sm:p-8 shadow-soft space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-paper-muted pb-4">
          <div className="space-y-1">
            <span className="text-xs font-mono font-bold uppercase text-accent">
              Kết quả Standup Speed Run
            </span>
            <h2 className="text-2xl font-bold text-ink">
              Hoàn tất 3 lượt Daily Standup!
            </h2>
          </div>
          <div className="px-4 py-2 rounded-pill bg-ink text-white font-mono text-sm font-bold">
            +{summary.totalScore} điểm
          </div>
        </div>

        {/* Honest AI vs Local Scoring Disclosure (Principle V) */}
        <div className="bg-paper border border-ink/15 rounded-xl p-3 text-xs text-ink-muted flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong className="text-ink">Phương thức chấm điểm:</strong>{" "}
            {summary.usedAi
              ? "AI Gemini (đánh giá phát âm ước lượng từ văn bản transcript)"
              : "Bộ quy tắc từ khóa cục bộ (rule-based matching, ước lượng từ văn bản)"}
          </span>
          <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-pill bg-white border border-ink/15 text-ink">
            {summary.usedAi ? "AI + Speed Bonus" : "Local Rules + Speed Bonus"}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-paper border border-ink/15 rounded-xl p-3.5 text-center">
            <div className="text-2xl font-mono font-bold text-ink">
              {summary.totalScore}
            </div>
            <div className="text-[11px] text-ink-muted mt-1">Tổng điểm Run</div>
          </div>
          <div className="bg-paper border border-ink/15 rounded-xl p-3.5 text-center">
            <div className="text-2xl font-mono font-bold text-accent">
              {summary.totalKeywordsUsed}
            </div>
            <div className="text-[11px] text-ink-muted mt-1">Từ khóa đạt</div>
          </div>
          <div className="bg-paper border border-ink/15 rounded-xl p-3.5 text-center">
            <div className="text-2xl font-mono font-bold text-ink">
              {summary.durationSec}s
            </div>
            <div className="text-[11px] text-ink-muted mt-1">Tổng thời gian</div>
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

        {/* Per-Question Breakdown */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-ink">
            Chi tiết từng lượt Standup
          </h3>
          {summary.turns.map((turn, idx) => (
            <div
              key={turn.question.id}
              className="bg-paper border border-ink/15 rounded-2xl p-4 space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-ink">
                  <span className="font-mono text-accent mr-1.5">
                    0{idx + 1}.
                  </span>
                  {turn.question.questionEN}
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="px-2.5 py-0.5 rounded-pill bg-white border border-ink/15 text-ink">
                    {turn.turnScore}/100
                  </span>
                  <span className="px-2.5 py-0.5 rounded-pill bg-ink text-white font-bold">
                    +{turn.speedPoints} pts
                  </span>
                </div>
              </div>

              {turn.skipped ? (
                <p className="text-xs text-ink-muted italic">
                  Đã bỏ qua hoặc hết giờ khi chưa nhập câu trả lời.
                </p>
              ) : (
                <>
                  <p className="text-xs text-ink bg-white border border-ink/10 rounded-xl p-2.5">
                    "{turn.transcript}"
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="flex flex-wrap gap-1.5">
                      {turn.keywordsUsed.length > 0 ? (
                        turn.keywordsUsed.map((kw) => (
                          <span
                            key={kw}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-white border border-ink/15 font-mono text-ink"
                          >
                            <Check className="w-3 h-3 text-accent" />
                            <span>{kw}</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-ink-muted">
                          Chưa khớp từ khóa gợi ý
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-ink-muted">
                      {turn.evaluationMode === "ai"
                        ? "AI (Gemini)"
                        : "Local Rules"}
                      {turn.timeBonus > 0
                        ? ` • Bonus tốc độ +${turn.timeBonus}`
                        : ""}
                    </span>
                  </div>
                  {turn.betterSentence && (
                    <div className="text-[11px] text-ink-muted pt-1 border-t border-ink/10">
                      <strong className="text-ink">Gợi ý mượt hơn:</strong>{" "}
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
          className="inline-flex items-center gap-2 px-6 py-3 rounded-pill bg-accent text-white text-sm font-bold border border-accent shadow-soft hover:bg-accent-hover shadow-hard-press transition-all"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Chạy lại</span>
        </button>
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
    <section className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-7 shadow-soft space-y-5">
      {/* Turn & Countdown Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {STANDUP_SPEED_QUESTIONS.map((q, idx) => (
            <span
              key={q.id}
              className={`px-3 py-1 rounded-pill text-xs font-mono font-bold border ${
                idx === questionIdx
                  ? "bg-accent text-white border-accent"
                  : idx < questionIdx
                  ? "bg-ink text-white border-ink"
                  : "bg-paper text-ink-faint border-ink/15"
              }`}
            >
              Câu {idx + 1}/3
            </span>
          ))}
        </div>

        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-pill font-mono text-xs font-bold border ${
            timeLeft <= 5
              ? "bg-accent text-white border-accent animate-pulse"
              : "bg-paper text-ink border-ink/20"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{timeLeft}s</span>
        </span>
      </div>

      <div className="w-full h-2.5 bg-paper rounded-pill border border-ink/15 overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${
            timeLeft <= 5 ? "bg-accent" : "bg-ink"
          }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Question Card */}
      <div className="bg-paper border border-ink/15 rounded-2xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-mono font-bold uppercase text-accent">
            {currentQuestion.labelVI}
          </span>
          <button
            type="button"
            onClick={handleSpeakQuestion}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-white border border-ink/15 text-xs font-mono font-semibold text-ink hover:bg-paper-muted transition-colors"
          >
            <Volume2
              className={`w-3.5 h-3.5 ${
                isPlayingTts ? "text-accent animate-pulse" : ""
              }`}
            />
            <span>{isPlayingTts ? "Đang đọc..." : "Nghe câu hỏi"}</span>
          </button>
        </div>

        <h3 className="text-lg sm:text-xl font-bold text-ink">
          "{currentQuestion.questionEN}"
        </h3>

        <p className="text-xs text-ink-muted">{currentQuestion.hintVI}</p>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {currentQuestion.expectedKeywords.slice(0, 6).map((kw) => (
            <span
              key={kw}
              className="px-2 py-0.5 rounded-pill bg-white border border-ink/15 text-[11px] font-mono text-ink-muted"
            >
              {kw}
            </span>
          ))}
        </div>
      </div>

      {/* Voice + Inline Typed Fallback Textarea (Principle III) */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleToggleMic}
            disabled={isEvaluating}
            className={`inline-flex items-center gap-2.5 px-5 py-2.5 rounded-pill font-semibold text-xs border transition-all disabled:opacity-50 ${
              isRecording
                ? "bg-accent text-white border-accent animate-mic-listening shadow-card"
                : "bg-ink text-white border-ink shadow-soft hover:bg-ink-muted"
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
                  <span className="w-0.5 h-2 bg-white rounded-full animate-pulse" />
                  <span className="w-0.5 h-3.5 bg-white rounded-full animate-pulse [animation-delay:120ms]" />
                  <span className="w-0.5 h-1.5 bg-white rounded-full animate-pulse [animation-delay:240ms]" />
                  <span className="w-0.5 h-3 bg-white rounded-full animate-pulse [animation-delay:360ms]" />
                </span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span>Trả lời bằng Micro</span>
              </>
            )}
          </button>

          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-ink-muted">
            <Keyboard className="w-3.5 h-3.5" />
            <span>Hoặc gõ trực tiếp bên dưới</span>
          </span>
        </div>

        <textarea
          ref={textareaRef}
          rows={3}
          value={answerText}
          onChange={(e) => updateAnswer(e.target.value)}
          disabled={isEvaluating}
          placeholder="Ví dụ: Yesterday I fixed the login API timeout and merged my pull request..."
          aria-label="Câu trả lời Daily Standup bằng tiếng Anh"
          className="w-full p-3.5 rounded-2xl bg-paper border border-ink/20 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent resize-none disabled:opacity-60"
        />

        {speechError && (
          <p className="text-xs text-accent bg-accent-light border border-accent/40 rounded-xl px-3.5 py-2">
            {speechError}
          </p>
        )}
      </div>

      {/* Submit / Skip Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={() => void submitCurrentTurn(true)}
          disabled={isEvaluating}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-pill bg-paper-muted text-ink text-xs font-semibold border border-ink/15 hover:bg-paper-subtle disabled:opacity-50 transition-colors"
        >
          <SkipForward className="w-3.5 h-3.5" />
          <span>Bỏ qua câu này</span>
        </button>

        <button
          type="button"
          onClick={() => void submitCurrentTurn(false)}
          disabled={isEvaluating || !answerText.trim()}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-pill bg-accent text-white text-xs sm:text-sm font-bold border border-accent shadow-soft hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {isEvaluating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Đang chấm điểm...</span>
            </>
          ) : (
            <>
              <span>
                {questionIdx === STANDUP_SPEED_QUESTIONS.length - 1
                  ? "Nộp & Xem kết quả"
                  : "Nộp & Câu tiếp theo"}
              </span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </section>
  );
}

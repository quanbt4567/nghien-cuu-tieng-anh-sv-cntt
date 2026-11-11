"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Tag, Lightbulb, AlertCircle, Loader2, Keyboard, Send, RotateCcw } from "lucide-react";
import { SCENARIOS } from "../../../data/scenarios";
import { AudioPromptPlayer } from "../../../components/audio/AudioPromptPlayer";
import { MicButton } from "../../../components/audio/MicButton";
import { FeedbackCard } from "../../../components/feedback/FeedbackCard";
import { AiModeBanner } from "../../../components/feedback/AiModeBanner";
import { ScenarioSummary } from "../../../components/feedback/ScenarioSummary";
import { startSpeechRecognition, SpeechController } from "../../../lib/speech";
import { storageAdapter } from "../../../lib/storage";
import { awardPracticePoints } from "../../../lib/gamification";
import { ScenarioTurn, ScoreResponse } from "../../../lib/types";

export default function PracticePage() {
  const params = useParams();
  const scenarioId = params.scenario as string;
  const scenario = SCENARIOS.find((s) => s.id === scenarioId);

  // Turn state (0, 1, 2)
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Input state
  const [transcript, setTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isMicDenied, setIsMicDenied] = useState(false);
  const speechControllerRef = useRef<SpeechController | null>(null);

  // Evaluation state
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<ScoreResponse | null>(null);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);

  // Turn aggregate records
  const [turnScores, setTurnScores] = useState<number[]>([]);
  const [totalKeywordsUsedCount, setTotalKeywordsUsedCount] = useState(0);
  const [missedKeywords, setMissedKeywords] = useState<string[]>([]);
  const [totalPointsEarned, setTotalPointsEarned] = useState(0);
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ role: "assistant" | "user"; content: string }>
  >([]);

  // Load client settings (including Gemini key if any)
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    const settings = storageAdapter.getSettings();
    if (settings.geminiApiKey) {
      setApiKey(settings.geminiApiKey);
    }
  }, []);

  if (!scenario) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-pill bg-accent-light text-accent flex items-center justify-center mx-auto border border-accent/20 shadow-soft">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-ink">
          Không tìm thấy tình huống làm việc này
        </h1>
        <p className="text-sm text-ink-muted">
          Kịch bản bạn đang tìm kiếm không tồn tại hoặc đường dẫn không đúng.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-pill bg-ink text-white font-medium text-xs border border-ink shadow-soft hover:bg-ink-muted"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại danh sách kịch bản</span>
        </Link>
      </div>
    );
  }

  const currentTurn: ScenarioTurn = scenario.turns[currentTurnIndex];
  const scenarioKeywords = scenario.turns.flatMap((t) => t.keywords);

  // Speech Recognition Control
  const handleStartRecording = () => {
    setSpeechError(null);
    setEvalResult(null);

    const controller = startSpeechRecognition({
      onStart: () => {
        setIsRecording(true);
      },
      onTranscript: (liveTranscript) => {
        setTranscript(liveTranscript);
      },
      onEnd: () => {
        setIsRecording(false);
      },
      onError: (errMessageVI, code) => {
        setIsRecording(false);
        setSpeechError(errMessageVI);
        if (code === "PERMISSION_DENIED" || code === "NOT_SUPPORTED") {
          setIsMicDenied(true);
        }
      },
    });

    if (controller) {
      speechControllerRef.current = controller;
    } else {
      setIsMicDenied(true);
    }
  };

  const handleStopRecording = () => {
    if (speechControllerRef.current) {
      speechControllerRef.current.stop();
      speechControllerRef.current = null;
    }
    setIsRecording(false);
  };

  // Submit Answer to Evaluation Pipeline
  const handleSubmitAnswer = async () => {
    if (!transcript.trim() || isEvaluating) return;

    if (isRecording) {
      handleStopRecording();
    }

    setIsEvaluating(true);
    setEvaluationError(null);

    try {
      const response = await fetch("/api/score", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "x-gemini-key": apiKey } : {}),
        },
        body: JSON.stringify({
          transcript: transcript.trim(),
          scenario: scenario.id,
          turnIndex: currentTurnIndex,
          expectedKeywords: currentTurn.keywords,
          history: conversationHistory,
          apiKey: apiKey || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Lỗi khi kết nối dịch vụ chấm điểm.");
      }

      const scoreData: ScoreResponse = await response.json();
      setEvalResult(scoreData);

      // Save attempt & weak points to resilient storage
      await storageAdapter.saveAttempt({
        scenario: scenario.id,
        turn_index: currentTurnIndex,
        transcript: transcript.trim(),
        score: scoreData.score,
        keywords_used: scoreData.keywordsUsed,
      });

      await storageAdapter.recordWeakPoints(
        scoreData.keywordsMissed,
        scoreData.grammarCorrections.map((c) => c.original)
      );

      // Track multi-turn progress & gamification points
      const earned = Number.isFinite(scoreData.score)
        ? Math.max(0, Math.round(scoreData.score))
        : 0;
      awardPracticePoints(earned);
      setTotalPointsEarned((prev) => prev + earned);
      if (scoreData.keywordsMissed.length > 0) {
        setMissedKeywords((prev) => {
          const seen = new Set(prev.map((k) => k.toLowerCase()));
          const additions = scoreData.keywordsMissed.filter(
            (k) => !seen.has(k.toLowerCase())
          );
          return additions.length > 0 ? [...prev, ...additions] : prev;
        });
      }
      setTurnScores((prev) => [...prev, scoreData.score]);
      setTotalKeywordsUsedCount((prev) => prev + scoreData.keywordsUsed.length);
      setConversationHistory((prev) => [
        ...prev,
        { role: "assistant", content: currentTurn.questionEN },
        { role: "user", content: transcript.trim() },
      ]);
    } catch (err) {
      setEvaluationError(
        "Không thể hoàn thành chấm điểm. Vui lòng kiểm tra kết nối mạng và thử lại."
      );
    } finally {
      setIsEvaluating(false);
    }
  };

  // Next Turn or Summary
  const handleNextTurn = () => {
    if (currentTurnIndex < scenario.turns.length - 1) {
      setCurrentTurnIndex((prev) => prev + 1);
      setTranscript("");
      setEvalResult(null);
      setSpeechError(null);
      setEvaluationError(null);
      setShowHint(false);
    } else {
      setIsCompleted(true);
    }
  };

  const handleRetryScenario = () => {
    setCurrentTurnIndex(0);
    setIsCompleted(false);
    setTranscript("");
    setEvalResult(null);
    setTurnScores([]);
    setTotalKeywordsUsedCount(0);
    setMissedKeywords([]);
    setTotalPointsEarned(0);
    setConversationHistory([]);
    setSpeechError(null);
    setEvaluationError(null);
    setShowHint(false);
  };

  const averageScore =
    turnScores.length > 0
      ? Math.round(turnScores.reduce((a, b) => a + b, 0) / turnScores.length)
      : 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-10 space-y-8">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white text-ink text-xs font-medium border border-ink/15 shadow-soft hover:bg-paper-muted shadow-hard-press transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Danh sách kịch bản</span>
        </Link>

        {/* Turn Step Indicators (Refined Borders) */}
        <div className="flex items-center gap-2">
          {scenario.turns.map((turn, idx) => (
            <span
              key={turn.turnIndex}
              className={`px-3 py-1 rounded-pill text-xs font-mono font-bold border transition-all ${
                idx === currentTurnIndex && !isCompleted
                  ? "bg-accent text-white border-accent shadow-soft"
                  : idx < currentTurnIndex || isCompleted
                  ? "bg-paper-muted text-ink border-ink/15"
                  : "bg-paper text-ink-faint border-ink/10 opacity-60"
              }`}
            >
              Lượt {idx + 1}/3
            </span>
          ))}
        </div>
      </div>

      {/* When completed: Show Summary */}
      {isCompleted ? (
        <ScenarioSummary
          scenarioTitle={`${scenario.titleVI} (${scenario.titleEN})`}
          totalScore={turnScores.reduce((a, b) => a + b, 0)}
          averageScore={averageScore}
          totalKeywordsUsed={totalKeywordsUsedCount}
          missedKeywords={missedKeywords}
          scenarioKeywords={scenarioKeywords}
          pointsEarned={totalPointsEarned}
          onRetry={handleRetryScenario}
        />
      ) : (
        <>
          {/* AI Mode Off Banner if no key */}
          {!apiKey && <AiModeBanner />}

          {/* Turn Question Card (Refined & Breathable) */}
          <div className="bg-white border border-ink/15 rounded-2xl p-6 sm:p-7 shadow-soft space-y-6">
            <div className="flex items-center justify-between border-b border-paper-muted pb-3.5">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-accent" />
                Câu hỏi Lượt {currentTurnIndex + 1}/3
              </span>
              <AudioPromptPlayer
                key={`${scenario.id}-${currentTurnIndex}`}
                text={currentTurn.questionEN}
                autoPlay={true}
              />
            </div>

            {/* Question Display */}
            <div className="space-y-1">
              <div className="text-xs font-mono text-ink-muted">
                Vai: {scenario.roleVI}
              </div>
              <div className="text-lg sm:text-xl font-bold text-ink leading-snug">
                "{currentTurn.questionEN}"
              </div>
            </div>

            {/* Collapsible Hint & Keywords (Stimulates Speaking Reflex) */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowHint(!showHint)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-paper border border-ink/15 text-xs font-mono font-medium text-ink hover:bg-paper-muted shadow-soft transition-all"
              >
                <Lightbulb className={`w-3.5 h-3.5 ${showHint ? "text-accent fill-accent" : "text-ink-muted"}`} />
                <span>{showHint ? "Ẩn gợi ý & từ khóa" : "Xem gợi ý & từ khóa (Hint)"}</span>
              </button>

              {showHint && (
                <div className="mt-3 space-y-3 pt-3 border-t border-paper-muted animate-fadeIn">
                  {/* Target Keywords Preview */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                      <Tag className="w-3.5 h-3.5 text-accent" />
                      <span>Từ khóa gợi ý nên dùng ({currentTurn.keywords.length}):</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {currentTurn.keywords.map((kw) => (
                        <span
                          key={kw}
                          className="px-2.5 py-1 text-xs font-mono bg-paper border border-ink/15 rounded-pill text-ink"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Vietnamese Context Hint */}
                  <div className="bg-paper-muted border border-ink/15 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-ink leading-relaxed">
                    <Lightbulb className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold">Gợi ý cách trả lời: </strong>
                      <span>{currentTurn.hintVI}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Input Area (Dual Mode: Mic + Typed Fallback) */}
          {!evalResult && (
            <div className="space-y-5">
              {/* Signature Microphone Button */}
              <div className="bg-white border border-ink/15 rounded-2xl p-6 shadow-soft">
                <MicButton
                  isRecording={isRecording}
                  onStart={handleStartRecording}
                  onStop={handleStopRecording}
                  disabled={isEvaluating}
                  error={speechError}
                />
              </div>

              {/* Automatic Typed Fallback / Editor (Inlined & Refined) */}
              <div className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
                    <Keyboard className="w-4 h-4 text-accent" />
                    <span>
                      {isMicDenied
                        ? "Chế độ gõ văn bản (Microphone bị từ chối)"
                        : "Hoặc gõ / chỉnh sửa câu trả lời bằng tiếng Anh:"}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-ink-muted">
                    {transcript.trim() ? transcript.trim().split(/\s+/).length : 0} từ
                  </span>
                </div>

                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (transcript.trim().length > 0 && !isEvaluating && !isRecording) {
                        handleSubmitAnswer();
                      }
                    }
                  }}
                  disabled={isEvaluating || isRecording}
                  rows={3}
                  placeholder="Gõ câu trả lời của bạn bằng tiếng Anh tại đây (hoặc nói bằng micro để văn bản tự điền vào)..."
                  className="w-full p-3.5 text-sm bg-paper border border-ink/15 rounded-xl text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent resize-none transition-colors"
                />

                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setTranscript("")}
                    disabled={!transcript || isEvaluating || isRecording}
                    className="text-xs text-ink-muted hover:text-ink disabled:opacity-40 flex items-center gap-1 py-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Xóa chữ</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSubmitAnswer}
                    disabled={!transcript.trim() || isEvaluating || isRecording}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-ink text-white font-medium text-xs border border-ink shadow-soft hover:bg-ink-muted shadow-hard-press disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <span>Gửi câu trả lời</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Evaluation Loading Indicator */}
              {isEvaluating && (
                <div className="bg-white border border-ink/15 rounded-2xl p-6 shadow-soft flex items-center justify-center gap-3 text-sm font-semibold text-ink">
                  <Loader2 className="w-5 h-5 animate-spin text-accent" />
                  <span>Đang phân tích từ khóa và ngữ pháp câu trả lời...</span>
                </div>
              )}

              {/* Evaluation Network Error Alert */}
              {evaluationError && (
                <div className="bg-accent-light border border-accent/40 rounded-xl p-4 text-xs text-accent font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{evaluationError}</span>
                </div>
              )}
            </div>
          )}

          {/* Evaluation Results (Phase 5) */}
          {evalResult && (
            <FeedbackCard
              result={evalResult}
              transcript={transcript}
              onNextTurn={handleNextTurn}
              isLastTurn={currentTurnIndex === scenario.turns.length - 1}
            />
          )}
        </>
      )}
    </div>
  );
}

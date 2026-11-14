"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Tag,
  Lightbulb,
  AlertCircle,
  Loader2,
  Keyboard,
  Send,
  RotateCcw,
  Volume2,
  Check,
  Sparkles,
} from "lucide-react";
import { SCENARIOS, VOCABULARY_LIST } from "../../../data/scenarios";
import { AudioPromptPlayer } from "../../../components/audio/AudioPromptPlayer";
import { MicButton } from "../../../components/audio/MicButton";
import { FeedbackCard } from "../../../components/feedback/FeedbackCard";
import { ScenarioSummary } from "../../../components/feedback/ScenarioSummary";
import {
  DEFAULT_VOICE_PERSONA,
  normalizeVoicePersona,
  startSpeechRecognition,
  SpeechController,
  VOICE_PERSONAS,
} from "../../../lib/speech";
import { playTtsAudio } from "../../../lib/tts-player";
import { storageAdapter } from "../../../lib/storage";
import { awardPracticePoints, getGamificationState } from "../../../lib/gamification";
import { reportGuestPracticePoints } from "../../../lib/guestClient";
import {
  CONTENT_STORAGE_KEY,
  CONTENT_UPDATED_EVENT,
  fetchAndCachePublicContent,
  getEffectiveScenarios,
  getEffectiveVocabulary,
} from "../../../lib/contentStore";
import {
  Scenario,
  ScenarioTurn,
  ScoreResponse,
  VocabularyItem,
  VoicePersonaId,
} from "../../../lib/types";

export default function PracticePage() {
  const params = useParams();
  const scenarioId = params.scenario as string;
  const [scenarios, setScenarios] = useState<Scenario[]>(SCENARIOS);
  const [vocabPool, setVocabPool] = useState<VocabularyItem[]>(VOCABULARY_LIST);
  const [isContentSyncing, setIsContentSyncing] = useState(true);
  const scenario = scenarios.find((s) => s.id === scenarioId);

  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [voicePersona, setVoicePersona] =
    useState<VoicePersonaId>(DEFAULT_VOICE_PERSONA);
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);

  const [transcript, setTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isMicDenied, setIsMicDenied] = useState(false);
  const speechControllerRef = useRef<SpeechController | null>(null);

  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<ScoreResponse | null>(null);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);

  const [turnScores, setTurnScores] = useState<number[]>([]);
  const [totalKeywordsUsedCount, setTotalKeywordsUsedCount] = useState(0);
  const [missedKeywords, setMissedKeywords] = useState<string[]>([]);
  const [totalPointsEarned, setTotalPointsEarned] = useState(0);
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ role: "assistant" | "user"; content: string }>
  >([]);

  useEffect(() => {
    const settings = storageAdapter.getSettings();
    setVoicePersona(normalizeVoicePersona(settings.voicePersona));
  }, []);

  useEffect(() => {
    let active = true;
    const syncContent = () => {
      if (!active) return;
      setScenarios(getEffectiveScenarios());
      setVocabPool(getEffectiveVocabulary());
    };

    syncContent();
    window.addEventListener(CONTENT_UPDATED_EVENT, syncContent);

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === CONTENT_STORAGE_KEY) {
        syncContent();
      }
    };
    window.addEventListener("storage", handleStorage);

    fetchAndCachePublicContent().finally(() => {
      if (!active) return;
      syncContent();
      setIsContentSyncing(false);
    });

    return () => {
      active = false;
      window.removeEventListener(CONTENT_UPDATED_EVENT, syncContent);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  if (!scenario && isContentSyncing) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="bg-white border border-ink/15 rounded-2xl p-8 shadow-soft inline-flex items-center gap-3 text-sm font-semibold text-ink">
          <Loader2 className="w-5 h-5 animate-spin text-sky-600" />
          <span>Đang tải kịch bản luyện tập...</span>
        </div>
      </div>
    );
  }

  if (!scenario || scenario.turns.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-pill bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto border border-rose-500/30 shadow-soft">
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

  const safeTurnIndex = Math.min(currentTurnIndex, scenario.turns.length - 1);
  const currentTurn: ScenarioTurn = scenario.turns[safeTurnIndex];
  const scenarioKeywords = scenario.turns.flatMap((t) => t.keywords);

  const handleVoiceChange = (nextPersona: VoicePersonaId) => {
    setVoicePersona(nextPersona);
    storageAdapter.saveSettings({ voicePersona: nextPersona });
  };

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
        },
        body: JSON.stringify({
          transcript: transcript.trim(),
          scenario: scenario.id,
          turnIndex: safeTurnIndex,
          expectedKeywords: currentTurn.keywords,
          history: conversationHistory,
        }),
      });

      if (!response.ok) {
        throw new Error("Lỗi khi kết nối dịch vụ chấm điểm.");
      }

      const scoreData: ScoreResponse = await response.json();
      setEvalResult(scoreData);

      await storageAdapter.saveAttempt({
        scenario: scenario.id,
        turn_index: safeTurnIndex,
        transcript: transcript.trim(),
        score: scoreData.score,
        keywords_used: scoreData.keywordsUsed,
        role: getGamificationState().selectedRole,
      });

      await storageAdapter.recordWeakPoints(
        scoreData.keywordsMissed,
        scoreData.grammarCorrections.map((c) => c.original)
      );

      const earned = Number.isFinite(scoreData.score)
        ? Math.max(0, Math.round(scoreData.score))
        : 0;
      awardPracticePoints(earned);
      void reportGuestPracticePoints(scenario.id, earned);
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
    } catch {
      setEvaluationError(
        "Không thể hoàn thành chấm điểm. Vui lòng kiểm tra kết nối mạng và thử lại."
      );
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleNextTurn = () => {
    if (safeTurnIndex < scenario.turns.length - 1) {
      setCurrentTurnIndex(safeTurnIndex + 1);
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
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-ink/15 rounded-2xl px-4 py-3 shadow-soft">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-paper text-ink text-xs font-medium border border-ink/15 hover:bg-paper-muted transition-all shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kịch bản</span>
          </Link>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-ink leading-tight">
              {scenario.titleVI}
            </h1>
            <p className="text-[11px] font-mono text-ink-muted">
              {scenario.titleEN}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5">
            {scenario.turns.map((turn, idx) => {
              const isDone = idx < safeTurnIndex || isCompleted;
              const isCurrent = idx === safeTurnIndex && !isCompleted;
              return (
                <span
                  key={turn.turnIndex}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-pill text-xs font-mono font-bold border transition-all ${
                    isCurrent
                      ? "bg-ink text-white border-ink shadow-soft"
                      : isDone
                      ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
                      : "bg-paper text-ink-faint border-ink/10"
                  }`}
                >
                  {isDone && <Check className="w-3 h-3 text-emerald-500 stroke-[3]" />}
                  <span>
                    Turn {idx + 1}/{scenario.turns.length}
                  </span>
                </span>
              );
            })}
          </div>

          <div className="inline-flex items-center gap-1.5">
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-paper border border-ink/15 text-xs text-ink">
              <Volume2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <select
                aria-label="AI Voice Persona"
                value={voicePersona}
                onChange={(e) => handleVoiceChange(normalizeVoicePersona(e.target.value))}
                className="bg-transparent text-xs font-medium text-ink focus:outline-none cursor-pointer pr-1"
              >
                {VOICE_PERSONAS.map((persona) => (
                  <option key={persona.id} value={persona.id}>
                    {persona.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={isPreviewingVoice}
              onClick={() => {
                setIsPreviewingVoice(true);
                const savedRate = storageAdapter.getSettings().speechRate || 1.0;
                playTtsAudio({
                  text: "Hi, let's practice your IT English speaking skills together.",
                  rate: savedRate,
                  persona: voicePersona,
                  onEnd: () => setIsPreviewingVoice(false),
                  onError: () => setIsPreviewingVoice(false),
                });
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill bg-sky-500/10 border border-sky-500/30 text-sky-700 text-xs font-semibold hover:bg-sky-500/20 disabled:opacity-50 transition-colors"
            >
              <span>{isPreviewingVoice ? "Đang đọc..." : "Nghe thử giọng"}</span>
            </button>
          </div>
        </div>
      </div>

      {isCompleted ? (
        <div className="max-w-3xl mx-auto">
          <ScenarioSummary
            scenarioTitle={`${scenario.titleVI} (${scenario.titleEN})`}
            totalScore={turnScores.reduce((a, b) => a + b, 0)}
            averageScore={averageScore}
            totalKeywordsUsed={totalKeywordsUsedCount}
            missedKeywords={missedKeywords}
            scenarioKeywords={scenarioKeywords}
            pointsEarned={totalPointsEarned}
            vocabPool={vocabPool}
            totalTurns={scenario.turns.length}
            onRetry={handleRetryScenario}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6 space-y-5">
            <div className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-paper-muted pb-3.5">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-sky-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-500" />
                  AI Interviewer • Lượt {safeTurnIndex + 1}/{scenario.turns.length}
                </span>
                <AudioPromptPlayer
                  key={`${scenario.id}-${safeTurnIndex}`}
                  text={currentTurn.questionEN}
                  autoPlay={true}
                  voicePersona={voicePersona}
                />
              </div>

              <div className="space-y-1.5">
                <div className="text-xs font-mono text-ink-muted">
                  Vai của bạn: {scenario.roleVI}
                </div>
                <div className="text-lg sm:text-xl font-bold text-ink leading-snug">
                  "{currentTurn.questionEN}"
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowHint(!showHint)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-paper border border-ink/15 text-xs font-mono font-medium text-ink hover:bg-paper-muted shadow-soft transition-all"
                >
                  <Lightbulb
                    className={`w-3.5 h-3.5 ${
                      showHint ? "text-sky-600" : "text-ink-muted"
                    }`}
                  />
                  <span>
                    {showHint ? "Ẩn gợi ý & từ khóa" : "Xem gợi ý & từ khóa (Hint)"}
                  </span>
                </button>

                {showHint && (
                  <div className="mt-3 space-y-3 pt-3 border-t border-paper-muted">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                        <Tag className="w-3.5 h-3.5 text-sky-600" />
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

                    <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-ink leading-relaxed">
                      <Lightbulb className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-semibold text-sky-700">
                          Gợi ý cách trả lời:{" "}
                        </strong>
                        <span>{currentTurn.hintVI}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-5">
              <div className="py-2">
                <MicButton
                  isRecording={isRecording}
                  onStart={handleStartRecording}
                  onStop={handleStopRecording}
                  disabled={isEvaluating || Boolean(evalResult)}
                  error={speechError}
                />
              </div>

              <div className="space-y-3 pt-4 border-t border-paper-muted">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
                    <Keyboard className="w-4 h-4 text-ink-muted" />
                    <span>
                      {isMicDenied
                        ? "Chế độ gõ văn bản (Microphone bị từ chối)"
                        : "Hoặc gõ / chỉnh sửa câu trả lời tiếng Anh:"}
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
                      if (
                        transcript.trim().length > 0 &&
                        !isEvaluating &&
                        !isRecording &&
                        !evalResult
                      ) {
                        handleSubmitAnswer();
                      }
                    }
                  }}
                  disabled={isEvaluating || isRecording || Boolean(evalResult)}
                  rows={3}
                  placeholder="Gõ câu trả lời tiếng Anh tại đây (hoặc nhấn Ghi âm câu trả lời ở trên)..."
                  className="w-full p-3.5 text-sm bg-paper border border-ink/15 rounded-xl text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink resize-none transition-colors disabled:opacity-60"
                />

                {!evalResult && (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setTranscript("")}
                      disabled={!transcript || isEvaluating || isRecording}
                      className="text-xs font-medium text-ink-muted hover:text-ink hover:bg-paper-muted px-2.5 py-1.5 rounded-pill disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Xóa chữ</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSubmitAnswer}
                      disabled={!transcript.trim() || isEvaluating || isRecording}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-pill text-sm border transition-all ${
                        transcript.trim() && !isEvaluating && !isRecording
                          ? "bg-accent text-white font-bold border-accent shadow-card ring-2 ring-accent/20 hover:bg-accent-hover hover:ring-accent/35 active:scale-[0.98]"
                          : "bg-paper-muted text-ink-faint font-semibold border-ink/15 cursor-not-allowed shadow-none"
                      }`}
                    >
                      <span>Gửi câu trả lời</span>
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-4">
            {turnScores.length > 0 && (
              <div className="bg-white border border-ink/15 rounded-2xl px-4 py-3 shadow-soft flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-mono font-bold text-ink-muted uppercase">
                  Điểm từng lượt:
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {turnScores.map((score, idx) => (
                    <span
                      key={idx}
                      className={`px-2.5 py-0.5 rounded-pill text-xs font-mono font-bold border ${
                        score >= 80
                          ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-700"
                          : score >= 60
                          ? "bg-sky-500/10 border-sky-500/30 text-sky-700"
                          : "bg-rose-500/10 border-rose-500/30 text-rose-700"
                      }`}
                    >
                      Turn {idx + 1}: {score}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {isEvaluating && (
              <div className="bg-white border border-ink/15 rounded-2xl p-8 shadow-soft flex flex-col items-center justify-center gap-3 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
                <div className="text-sm font-semibold text-ink">
                  Đang phân tích từ khóa và ngữ pháp câu trả lời...
                </div>
                <p className="text-xs text-ink-muted">
                  Hệ thống chấm theo tỷ lệ 40% Từ khóa • 30% Đầy đủ • 30% Ngữ pháp
                </p>
              </div>
            )}

            {evaluationError && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-xs text-rose-700 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{evaluationError}</span>
              </div>
            )}

            {evalResult ? (
              <FeedbackCard
                result={evalResult}
                transcript={transcript}
                onNextTurn={handleNextTurn}
                isLastTurn={safeTurnIndex === scenario.turns.length - 1}
              />
            ) : (
              !isEvaluating && (
                <div className="bg-white border border-ink/15 rounded-2xl p-6 shadow-soft space-y-4">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-sky-700">
                    <Sparkles className="w-4 h-4 text-sky-500" />
                    <span>Bảng đánh giá & Gợi ý tự nhiên</span>
                  </div>
                  <p className="text-sm text-ink-muted leading-relaxed">
                    Nhấn <strong className="text-ink">Ghi âm câu trả lời</strong> ở cột bên trái (hoặc gõ câu tiếng Anh) rồi gửi để xem điểm chi tiết, từ khóa đạt chuẩn và cách diễn đạt tự nhiên hơn.
                  </p>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono text-[11px]">
                    <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 font-semibold">
                      40% Từ khóa
                    </div>
                    <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-700 font-semibold">
                      30% Đầy đủ
                    </div>
                    <div className="p-2.5 rounded-xl bg-paper border border-ink/15 text-ink font-semibold">
                      30% Ngữ pháp
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
  VolumeX,
  Check,
  CheckCircle2,
} from "lucide-react";
import { SCENARIOS, VOCABULARY_LIST } from "../../../data/scenarios";
import { MicButton } from "../../../components/audio/MicButton";
import {
  getVietnameseGloss,
  InteractiveEnglishText,
} from "../../../components/common/EnglishWordTooltip";
import { FeedbackCard } from "../../../components/feedback/FeedbackCard";
import { ScenarioSummary } from "../../../components/feedback/ScenarioSummary";
import {
  startSpeechRecognition,
  SpeechController,
} from "../../../lib/speech";
import {
  DEFAULT_VOICE_PERSONA,
  TTS_VOICE_PERSONAS,
  VoicePersona,
  normalizeTtsPersona,
  playTtsAudio,
  stopActiveTts,
} from "../../../lib/tts-player";
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

const SCENARIO_DEFAULT_VOICE_PERSONA: VoicePersona = DEFAULT_VOICE_PERSONA;

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
    useState<VoicePersona>(SCENARIO_DEFAULT_VOICE_PERSONA);
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);
  const [promptRate, setPromptRate] = useState<0.8 | 1.0 | 1.2>(1.0);
  const [isPlayingPrompt, setIsPlayingPrompt] = useState(false);
  const [isSlowPlaying, setIsSlowPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(-1);
  const promptCancelRef = useRef<(() => void) | null>(null);

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
  const [usedKeywords, setUsedKeywords] = useState<string[]>([]);
  const [missedKeywords, setMissedKeywords] = useState<string[]>([]);
  const [totalPointsEarned, setTotalPointsEarned] = useState(0);
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ role: "assistant" | "user"; content: string }>
  >([]);

  useEffect(() => {
    const settings = storageAdapter.getSettings();
    setVoicePersona(
      settings.voicePersona
        ? normalizeTtsPersona(settings.voicePersona)
        : SCENARIO_DEFAULT_VOICE_PERSONA
    );
    setPromptRate(settings.speechRate || 1.0);
  }, []);

  const stopPromptAudio = () => {
    if (promptCancelRef.current) {
      promptCancelRef.current();
      promptCancelRef.current = null;
    }
    setIsPlayingPrompt(false);
    setIsSlowPlaying(false);
    setPlaybackProgress(-1);
  };

  const playPromptAudio = (opts?: {
    rate?: 0.8 | 1.0 | 1.2;
    slowMode?: boolean;
    persona?: VoicePersona;
  }) => {
    const turns = scenario?.turns ?? [];
    const questionText =
      turns[Math.min(currentTurnIndex, Math.max(0, turns.length - 1))]
        ?.questionEN ?? "";
    if (!questionText.trim()) return;
    if (promptCancelRef.current) {
      promptCancelRef.current();
    }
    const slowMode = Boolean(opts?.slowMode);
    setIsPreviewingVoice(false);
    setIsPlayingPrompt(true);
    setIsSlowPlaying(slowMode);
    setPlaybackProgress(0);
    const cancelFn = playTtsAudio({
      text: questionText,
      rate: opts?.rate ?? promptRate,
      persona: opts?.persona ?? voicePersona,
      slowMode,
      onProgress: (ratio) => {
        setPlaybackProgress(ratio);
      },
      onEnd: () => {
        promptCancelRef.current = null;
        setIsPlayingPrompt(false);
        setIsSlowPlaying(false);
        setPlaybackProgress(-1);
      },
      onError: () => {
        promptCancelRef.current = null;
        setIsPlayingPrompt(false);
        setIsSlowPlaying(false);
        setPlaybackProgress(-1);
      },
    });
    promptCancelRef.current = cancelFn;
  };

  const activeQuestionEN =
    !isCompleted && scenario && scenario.turns.length > 0
      ? scenario.turns[Math.min(currentTurnIndex, scenario.turns.length - 1)]
          ?.questionEN ?? ""
      : "";

  useEffect(() => {
    if (!activeQuestionEN || (isContentSyncing && !scenario)) return;
    playPromptAudio();
    return () => {
      if (promptCancelRef.current) {
        promptCancelRef.current();
        promptCancelRef.current = null;
      }
    };
  }, [activeQuestionEN]);

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
        <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-slate-800 rounded-xl p-8 inline-flex items-center gap-3 text-sm font-semibold text-slate-900 dark:text-slate-50">
          <Loader2 className="w-5 h-5 animate-spin text-blue-700 dark:text-blue-400" />
          <span>Đang tải kịch bản luyện tập...</span>
        </div>
      </div>
    );
  }

  if (!scenario || scenario.turns.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto border border-red-200 dark:border-red-800">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">
          Không tìm thấy tình huống làm việc này
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Kịch bản bạn đang tìm kiếm không tồn tại hoặc đường dẫn không đúng.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
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

  const handleVoiceChange = (nextPersona: VoicePersona) => {
    setVoicePersona(nextPersona);
    storageAdapter.saveSettings({
      voicePersona: nextPersona as VoicePersonaId,
    });
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

      const earned = Number.isFinite(scoreData.score)
        ? Math.max(0, Math.round(scoreData.score))
        : 0;
      if (earned > 0) {
        await storageAdapter.recordWeakPoints(
          scoreData.keywordsMissed,
          scoreData.grammarCorrections.map((c) => c.original)
        );
        awardPracticePoints(earned);
        void reportGuestPracticePoints(scenario.id, earned);
      }
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
      if (scoreData.keywordsUsed.length > 0) {
        setUsedKeywords((prev) => {
          const seen = new Set(prev.map((k) => k.toLowerCase()));
          const additions = scoreData.keywordsUsed.filter(
            (k) => !seen.has(k.toLowerCase())
          );
          return additions.length > 0 ? [...prev, ...additions] : prev;
        });
      }
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
    setUsedKeywords([]);
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
      <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:border-blue-700 dark:hover:border-blue-500 text-xs font-semibold transition-colors shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
            <span>Kịch bản</span>
          </Link>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-50 leading-tight">
              {scenario.titleVI}
            </h1>
            <p className="text-xs font-mono text-slate-600 dark:text-slate-400">
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
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold border transition-colors ${
                    isCurrent
                      ? "bg-blue-700 text-white border-blue-700 dark:bg-blue-600 dark:border-blue-600"
                      : isDone
                      ? "bg-green-50 text-green-800 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800"
                      : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                  }`}
                >
                  {isDone && <Check className="w-3 h-3 text-green-700 dark:text-green-400 stroke-[3]" />}
                  <span>
                    Turn {idx + 1}/{scenario.turns.length}
                  </span>
                </span>
              );
            })}
          </div>

          <div className="inline-flex items-center gap-1.5">
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100">
              <Volume2 className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" />
              <select
                aria-label="AI Voice Persona"
                value={voicePersona}
                onChange={(e) => handleVoiceChange(normalizeTtsPersona(e.target.value))}
                className="bg-transparent text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer pr-1"
              >
                {TTS_VOICE_PERSONAS.map((persona) => (
                  <option key={persona.id} value={persona.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                    {persona.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                if (isPreviewingVoice) {
                  stopActiveTts();
                  setIsPreviewingVoice(false);
                  return;
                }
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
              title="Nghe thử giọng"
              aria-label="Nghe thử giọng"
              className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors ${
                isPreviewingVoice
                  ? "bg-red-600 hover:bg-red-700 border-red-600 text-white"
                  : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-blue-700 dark:text-blue-400 hover:border-blue-700"
              }`}
            >
              {isPreviewingVoice ? (
                <VolumeX className="w-3.5 h-3.5" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
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
            usedKeywords={usedKeywords}
            transcripts={conversationHistory
              .filter((m) => m.role === "user")
              .map((m) => m.content)}
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
            <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3.5">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-700 dark:bg-blue-400" />
                  AI Interviewer • Lượt {safeTurnIndex + 1}/{scenario.turns.length}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {isPlayingPrompt && !isSlowPlaying ? (
                    <button
                      onClick={stopPromptAudio}
                      type="button"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors"
                      title="Dừng phát âm"
                    >
                      <VolumeX className="w-3.5 h-3.5" />
                      <span>Dừng nghe</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => playPromptAudio({ slowMode: false })}
                      type="button"
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
                      title="Nghe lại câu hỏi"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Nghe lại</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      if (isPlayingPrompt && isSlowPlaying) {
                        stopPromptAudio();
                      } else {
                        playPromptAudio({ slowMode: true });
                      }
                    }}
                    type="button"
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                      isPlayingPrompt && isSlowPlaying
                        ? "bg-red-600 hover:bg-red-700 border-red-600 text-white"
                        : "bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-950/80 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300"
                    }`}
                    title="Nghe chậm từng từ"
                  >
                    {isPlayingPrompt && isSlowPlaying ? (
                      <VolumeX className="w-3.5 h-3.5" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                    <span>Nghe chậm từng từ (Slow)</span>
                  </button>

                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    {([0.8, 1.0, 1.2] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setPromptRate(r);
                          if (isPlayingPrompt) {
                            playPromptAudio({ rate: r, slowMode: isSlowPlaying });
                          }
                        }}
                        className={`px-2 py-0.5 text-xs font-mono font-semibold rounded-md border transition-colors ${
                          promptRate === r
                            ? "bg-blue-700 text-white border-blue-700 dark:bg-blue-600 dark:border-blue-600"
                            : "text-slate-600 dark:text-slate-300 border-transparent hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        {r}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
                  Vai của bạn: {scenario.roleVI}
                </div>
                <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-50 leading-snug">
                  &ldquo;
                  {(() => {
                    const promptWords = currentTurn.questionEN
                      .trim()
                      .split(/\s+/)
                      .filter(Boolean);
                    const activeWordIndex =
                      playbackProgress >= 0 && promptWords.length > 0
                        ? Math.min(
                            promptWords.length - 1,
                            Math.floor(playbackProgress * promptWords.length)
                          )
                        : -1;
                    return (
                      <InteractiveEnglishText
                        text={currentTurn.questionEN}
                        highlightMode="tts"
                        activeHighlightIndex={activeWordIndex}
                        spokenUntilIndex={activeWordIndex}
                      />
                    );
                  })()}
                  &rdquo;
                </div>
                <p className="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                  <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
                  <span>Mẹo cho người mới: Chạm vào từ tiếng Anh gạch chân để xem nghĩa tiếng Việt ngay.</span>
                </p>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowHint(!showHint)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs font-mono font-medium transition-colors"
                >
                  <Lightbulb
                    className={`w-3.5 h-3.5 ${
                      showHint ? "text-amber-600 dark:text-amber-400" : "text-blue-700 dark:text-blue-400"
                    }`}
                  />
                  <span>
                    {showHint ? "Ẩn gợi ý & từ khóa" : "Xem gợi ý & từ khóa (chạm để mở)"}
                  </span>
                </button>

                {showHint && (
                  <div className="mt-3 space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        <Tag className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                        <span>Từ khóa gợi ý nên dùng ({currentTurn.keywords.length}):</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {currentTurn.keywords.map((kw) => {
                          const gloss = getVietnameseGloss(kw);
                          return (
                            <span
                              key={kw}
                              title={gloss ?? undefined}
                              className="px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-slate-900 dark:text-slate-100 inline-flex items-center gap-1.5"
                            >
                              <span className="font-mono font-semibold">{kw}</span>
                              {gloss && (
                                <span className="text-xs text-slate-600 dark:text-slate-300">
                                  ({gloss})
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="border-l-2 border-blue-700 dark:border-blue-500 pl-3.5 py-1 flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-semibold text-blue-800 dark:text-blue-300">
                          Gợi ý cách trả lời:{" "}
                        </strong>
                        <span>{currentTurn.hintVI}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-5">
              <div className="py-2">
                <MicButton
                  isRecording={isRecording}
                  onStart={handleStartRecording}
                  onStop={handleStopRecording}
                  disabled={isEvaluating || Boolean(evalResult)}
                  error={speechError}
                />
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-slate-50">
                    <Keyboard className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                    <span>
                      {isMicDenied
                        ? "Chế độ gõ văn bản (Microphone bị từ chối)"
                        : "Hoặc gõ / chỉnh sửa câu trả lời tiếng Anh:"}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
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
                  className="w-full p-3.5 text-sm rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-50 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:border-blue-700 dark:focus:border-blue-500 resize-none transition-colors disabled:opacity-60"
                />

                {!evalResult && (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setTranscript("")}
                      disabled={!transcript || isEvaluating || isRecording}
                      className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 px-2.5 py-1.5 rounded-lg disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Xóa chữ</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSubmitAnswer}
                      disabled={!transcript.trim() || isEvaluating || isRecording}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                        transcript.trim() && !isEvaluating && !isRecording
                          ? "bg-green-700 hover:bg-green-800 text-white active:scale-[0.98]"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed"
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
              <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 uppercase">
                  Điểm từng lượt:
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {turnScores.map((score, idx) => (
                    <span
                      key={idx}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${
                        score >= 80
                          ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/50 dark:border-green-800 dark:text-green-300"
                          : score >= 60
                          ? "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/50 dark:border-blue-800 dark:text-blue-300"
                          : "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/50 dark:border-red-800 dark:text-red-300"
                      }`}
                    >
                      Turn {idx + 1}: {score}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {isEvaluating && (
              <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-slate-800 rounded-xl p-8 flex flex-col items-center justify-center gap-3 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-blue-700 dark:text-blue-400" />
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  Đang phân tích từ khóa và ngữ pháp câu trả lời...
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Hệ thống chấm theo tỷ lệ 40% Từ khóa • 30% Đầy đủ • 30% Ngữ pháp
                </p>
              </div>
            )}

            {evaluationError && (
              <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                <span>{evaluationError}</span>
              </div>
            )}

            {evalResult ? (
              <FeedbackCard
                result={evalResult}
                transcript={transcript}
                voicePersona={voicePersona as VoicePersonaId}
                onNextTurn={handleNextTurn}
                isLastTurn={safeTurnIndex === scenario.turns.length - 1}
              />
            ) : (
              !isEvaluating && (
                <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-blue-700 dark:text-blue-400">
                    <CheckCircle2 className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                    <span>Bảng đánh giá &amp; Gợi ý tự nhiên</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    Nhấn <strong className="text-slate-900 dark:text-slate-50">Ghi âm câu trả lời</strong> ở cột bên trái (hoặc gõ câu tiếng Anh) rồi gửi để xem điểm chi tiết, từ khóa đạt chuẩn và cách diễn đạt tự nhiên hơn.
                  </p>
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pt-1 text-center font-mono">
                    <div className="whitespace-nowrap flex items-center justify-center leading-tight py-2.5 px-1.5 sm:px-2.5 text-[10px] sm:text-[11px] rounded-lg bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 font-semibold">
                      40% Từ khóa
                    </div>
                    <div className="whitespace-nowrap flex items-center justify-center leading-tight py-2.5 px-1.5 sm:px-2.5 text-[10px] sm:text-[11px] rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 font-semibold">
                      30% Đầy đủ
                    </div>
                    <div className="whitespace-nowrap flex items-center justify-center leading-tight py-2.5 px-1.5 sm:px-2.5 text-[10px] sm:text-[11px] rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
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

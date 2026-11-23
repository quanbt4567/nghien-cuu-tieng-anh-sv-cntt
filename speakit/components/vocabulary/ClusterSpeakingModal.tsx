"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Coins,
  Loader2,
  Mic,
  MicOff,
  RefreshCw,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { playTtsAudio, stopActiveTts } from "../../lib/tts-player";
import { storageAdapter } from "../../lib/storage";
import {
  isSpeechRecognitionSupported,
  SpeechController,
  startSpeechRecognition,
} from "../../lib/speech";
import {
  readBackupTransferCode,
  syncGuestProfileFromServer,
} from "../../lib/guestClient";
import { awardPracticePoints, getGamificationState } from "../../lib/gamification";
import type { PublicGuestPlayer } from "../../lib/db";

interface ClusterSpeakingModalProps {
  isOpen: boolean;
  clusterTitle: string;
  terms: string[];
  onClose: () => void;
}

interface GeneratedPrompt {
  scenarioType: "Standup" | "Code Review" | "Incident call";
  promptEN: string;
  promptVI: string;
  targetTerms: string[];
}

interface EvaluationResult {
  score: number;
  matchedTerms: string[];
  missedTerms: string[];
  feedbackVI: string;
  naturalnessFeedback: string;
  awardedCoins: number;
  player?: PublicGuestPlayer | null;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isTermMatched(transcript: string, term: string): boolean {
  const normalizedTranscript = normalizeText(transcript);
  const normalizedTerm = normalizeText(term);
  if (!normalizedTranscript || !normalizedTerm) return false;
  if (normalizedTranscript.includes(normalizedTerm)) return true;
  const termWords = normalizedTerm.split(" ").filter(Boolean);
  const transcriptWords = new Set(normalizedTranscript.split(" ").filter(Boolean));
  return termWords.length > 0 && termWords.every((word) => transcriptWords.has(word));
}

export function ClusterSpeakingModal({
  isOpen,
  clusterTitle,
  terms,
  onClose,
}: ClusterSpeakingModalProps) {
  const [promptData, setPromptData] = useState<GeneratedPrompt | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [isPlayingPrompt, setIsPlayingPrompt] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [showTypedFallback, setShowTypedFallback] = useState(true);

  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);

  const ttsCancelRef = useRef<(() => void) | null>(null);
  const speechRef = useRef<SpeechController | null>(null);

  const stopAudioAndMic = useCallback(() => {
    if (ttsCancelRef.current) {
      ttsCancelRef.current();
      ttsCancelRef.current = null;
    }
    stopActiveTts();
    setIsPlayingPrompt(false);

    if (speechRef.current) {
      speechRef.current.abort();
      speechRef.current = null;
    }
    setIsListening(false);
  }, []);

  const generatePrompt = useCallback(async () => {
    stopAudioAndMic();
    setIsGenerating(true);
    setGenerateError(null);
    setEvaluation(null);
    setEvalError(null);
    setTranscript("");
    setMicError(null);

    try {
      const response = await fetch("/api/vocabulary/cluster-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          clusterTitle,
          terms,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Không thể tạo tình huống luyện nói.");
      }
      setPromptData({
        scenarioType: data.scenarioType,
        promptEN: data.promptEN,
        promptVI: data.promptVI,
        targetTerms: Array.isArray(data.targetTerms) ? data.targetTerms : terms,
      });
    } catch (error) {
      setGenerateError(
        error instanceof Error
          ? error.message
          : "Không thể tạo tình huống luyện nói."
      );
    } finally {
      setIsGenerating(false);
    }
  }, [clusterTitle, terms, stopAudioAndMic]);

  useEffect(() => {
    if (isOpen && terms.length > 0) {
      void generatePrompt();
    } else {
      stopAudioAndMic();
    }
    return () => {
      stopAudioAndMic();
    };
  }, [isOpen, clusterTitle, terms, generatePrompt, stopAudioAndMic]);

  const activeTargetTerms = useMemo(
    () => (promptData?.targetTerms?.length ? promptData.targetTerms : terms),
    [promptData, terms]
  );

  const liveMatchedSet = useMemo(() => {
    const matched = new Set<string>();
    for (const term of activeTargetTerms) {
      if (isTermMatched(transcript, term)) {
        matched.add(term);
      }
    }
    return matched;
  }, [activeTargetTerms, transcript]);

  const handlePlayPrompt = () => {
    if (!promptData?.promptEN) return;
    if (isPlayingPrompt) {
      stopActiveTts();
      ttsCancelRef.current = null;
      setIsPlayingPrompt(false);
      return;
    }

    setIsPlayingPrompt(true);
    const persona = storageAdapter.getSettings().voicePersona;
    ttsCancelRef.current = playTtsAudio({
      text: promptData.promptEN,
      rate: 1.0,
      persona,
      onEnd: () => {
        setIsPlayingPrompt(false);
        ttsCancelRef.current = null;
      },
      onError: () => {
        setIsPlayingPrompt(false);
        ttsCancelRef.current = null;
      },
    });
  };

  const handleToggleMic = () => {
    setMicError(null);
    if (isListening) {
      speechRef.current?.stop();
      speechRef.current = null;
      setIsListening(false);
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      setMicError(
        "Trình duyệt không hỗ trợ ghi âm Web Speech. Vui lòng nhập câu trả lời vào ô văn bản bên dưới."
      );
      setShowTypedFallback(true);
      return;
    }

    const controller = startSpeechRecognition({
      onStart: () => {
        setIsListening(true);
      },
      onTranscript: (text) => {
        setTranscript(text);
      },
      onError: (message) => {
        setMicError(message);
        setShowTypedFallback(true);
        setIsListening(false);
      },
      onEnd: () => {
        setIsListening(false);
        speechRef.current = null;
      },
    });

    if (controller) {
      speechRef.current = controller;
    }
  };

  const handleEvaluate = async () => {
    if (!promptData || !transcript.trim()) return;
    stopAudioAndMic();
    setIsEvaluating(true);
    setEvalError(null);

    try {
      const response = await fetch("/api/vocabulary/cluster-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "evaluate",
          clusterTitle,
          promptEN: promptData.promptEN,
          targetTerms: activeTargetTerms,
          transcript: transcript.trim(),
          backupTransferCode: readBackupTransferCode(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Không thể chấm điểm câu trả lời.");
      }

      const awardedCoins = typeof data.awardedCoins === "number" ? data.awardedCoins : 0;
      const score = typeof data.score === "number" ? data.score : 0;
      const matchedTerms = Array.isArray(data.matchedTerms) ? data.matchedTerms : [];

      void storageAdapter.saveAttempt({
        scenario: "vocab-cluster-speaking",
        turn_index: 0,
        transcript: `${clusterTitle}: ${transcript.trim()}`.slice(0, 240),
        score,
        keywords_used: matchedTerms,
        role: getGamificationState().selectedRole,
      });

      if (awardedCoins > 0) {
        awardPracticePoints(awardedCoins * 1000);
      }
      if (data.player) {
        syncGuestProfileFromServer(data.player as PublicGuestPlayer);
      }

      setEvaluation({
        score,
        matchedTerms,
        missedTerms: Array.isArray(data.missedTerms) ? data.missedTerms : [],
        feedbackVI: data.feedbackVI,
        naturalnessFeedback: data.naturalnessFeedback,
        awardedCoins,
        player: data.player ?? null,
      });
    } catch (error) {
      setEvalError(
        error instanceof Error
          ? error.message
          : "Không thể chấm điểm câu trả lời."
      );
    } finally {
      setIsEvaluating(false);
    }
  };

  if (!isOpen) return null;

  const coveragePercent =
    activeTargetTerms.length > 0
      ? Math.round((liveMatchedSet.size / activeTargetTerms.length) * 100)
      : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Luyện nói cụm từ ${clusterTitle}`}
    >
      <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#262626] rounded-xl shadow-sm w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-xs font-semibold mb-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Cluster Speaking Drill</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-50 leading-snug">
              {clusterTitle}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
              Dùng ít nhất 75% từ mục tiêu trong 1 lượt phản hồi tự nhiên để nhận +3 IT-Coins.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              stopAudioAndMic();
              onClose();
            }}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            aria-label="Đóng cửa sổ"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isGenerating ? (
          <div className="py-10 flex flex-col items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <Loader2 className="w-5 h-5 animate-spin text-blue-700 dark:text-blue-400" />
            <span>Đang tạo tình huống kỹ thuật phù hợp...</span>
          </div>
        ) : generateError ? (
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-sm text-red-800 dark:text-red-300 flex items-center justify-between gap-3">
            <span>{generateError}</span>
            <button
              type="button"
              onClick={() => void generatePrompt()}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-sm transition-colors"
            >
              Thử lại
            </button>
          </div>
        ) : promptData ? (
          <>
            <div className="py-4 border-y border-slate-200 dark:border-[#262626] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-xs font-mono font-semibold">
                  {promptData.scenarioType}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePlayPrompt}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      isPlayingPrompt
                        ? "bg-blue-700 dark:bg-blue-600 border-blue-700 dark:border-blue-600 text-white"
                        : "bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60"
                    }`}
                  >
                    {isPlayingPrompt ? (
                      <>
                        <VolumeX className="w-3.5 h-3.5" />
                        <span>Dừng</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Nghe câu hỏi</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void generatePrompt()}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium transition-colors"
                    title="Đổi tình huống khác"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                {promptData.promptEN}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {promptData.promptVI}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  Từ mục tiêu ({liveMatchedSet.size}/{activeTargetTerms.length})
                </span>
                <span
                  className={`font-mono font-semibold ${
                    coveragePercent >= 75
                      ? "text-green-700 dark:text-green-400"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {coveragePercent}%
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeTargetTerms.map((term) => {
                  const matched = liveMatchedSet.has(term);
                  return (
                    <span
                      key={term}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono border transition-colors ${
                        matched
                          ? "bg-green-50 dark:bg-green-950/50 border-green-300 dark:border-green-700 text-green-800 dark:text-green-300 font-semibold"
                          : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {matched && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-700 dark:text-green-400" />
                      )}
                      <span>{term}</span>
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleToggleMic}
                  className={`text-white inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    isListening
                      ? "bg-red-600 hover:bg-red-700 animate-pulse"
                      : "bg-green-700 hover:bg-green-800"
                  }`}
                >
                  {isListening ? (
                    <>
                      <MicOff className="w-4 h-4" />
                      <span>Dừng ghi âm</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" />
                      <span>Bấm để nói (English)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowTypedFallback((prev) => !prev)}
                  className="text-sm text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 font-semibold underline"
                >
                  {showTypedFallback ? "Ẩn ô gõ chữ" : "Gõ câu trả lời"}
                </button>
              </div>

              {micError && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300">
                  {micError}
                </div>
              )}

              {showTypedFallback && (
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  rows={3}
                  placeholder="Nội dung bạn nói sẽ hiện trực tiếp ở đây (hoặc bạn có thể tự gõ/chỉnh sửa câu trả lời bằng tiếng Anh)..."
                  className="w-full p-3 text-sm rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/40"
                />
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={isEvaluating || !transcript.trim()}
                  onClick={() => void handleEvaluate()}
                  className="bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 transition-colors"
                >
                  {isEvaluating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang chấm điểm...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Chấm điểm &amp; Nhận phản hồi</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {evalError && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-sm text-red-800 dark:text-red-300">
                {evalError}
              </div>
            )}

            {evaluation && (
              <div className="pt-4 border-t border-slate-200 dark:border-[#262626] space-y-3">
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Điểm phản xạ:
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-xs font-mono font-bold">
                        {evaluation.score}/100
                      </span>
                    </div>
                    {evaluation.awardedCoins > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                        <Coins className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                        +{evaluation.awardedCoins} IT-Coins
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed">
                    <strong className="font-semibold text-slate-900 dark:text-slate-50">
                      Độ chính xác ngữ cảnh:
                    </strong>{" "}
                    {evaluation.feedbackVI}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    <strong className="font-semibold text-slate-900 dark:text-slate-100">
                      Độ tự nhiên:
                    </strong>{" "}
                    {evaluation.naturalnessFeedback}
                  </p>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

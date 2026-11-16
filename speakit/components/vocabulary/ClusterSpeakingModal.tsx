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
  saveCachedGuestProfile,
} from "../../lib/guestClient";
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

      if (data.player) {
        saveCachedGuestProfile(data.player as PublicGuestPlayer);
      }

      setEvaluation({
        score: data.score,
        matchedTerms: Array.isArray(data.matchedTerms) ? data.matchedTerms : [],
        missedTerms: Array.isArray(data.missedTerms) ? data.missedTerms : [],
        feedbackVI: data.feedbackVI,
        naturalnessFeedback: data.naturalnessFeedback,
        awardedCoins: typeof data.awardedCoins === "number" ? data.awardedCoins : 0,
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Luyện nói cụm từ ${clusterTitle}`}
    >
      <div className="bg-white border border-ink/15 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill bg-accent/10 text-accent text-[11px] font-semibold mb-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Cluster Speaking Drill</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-ink leading-snug">
              {clusterTitle}
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Dùng ít nhất 75% từ mục tiêu trong 1 lượt phản hồi tự nhiên để nhận +3 IT-Coins.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              stopAudioAndMic();
              onClose();
            }}
            className="p-2 rounded-pill border border-ink/15 text-ink-muted hover:text-ink hover:bg-paper-muted transition-colors"
            aria-label="Đóng cửa sổ"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isGenerating ? (
          <div className="py-10 flex flex-col items-center justify-center gap-2 text-xs text-ink-muted">
            <Loader2 className="w-5 h-5 animate-spin text-accent" />
            <span>Đang tạo tình huống kỹ thuật phù hợp...</span>
          </div>
        ) : generateError ? (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between gap-3">
            <span>{generateError}</span>
            <button
              type="button"
              onClick={() => void generatePrompt()}
              className="px-3 py-1.5 rounded-pill bg-white border border-rose-200 font-semibold hover:bg-rose-100"
            >
              Thử lại
            </button>
          </div>
        ) : promptData ? (
          <>
            <div className="p-4 rounded-xl bg-paper-muted border border-ink/10 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-pill bg-ink text-white text-[11px] font-mono">
                  {promptData.scenarioType}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePlayPrompt}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-medium border transition-colors ${
                      isPlayingPrompt
                        ? "bg-accent text-white border-accent"
                        : "bg-white text-ink border-ink/15 hover:bg-paper-muted"
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
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-pill text-xs font-medium bg-white text-ink-muted border border-ink/15 hover:text-ink"
                    title="Đổi tình huống khác"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-sm font-medium text-ink leading-relaxed">
                {promptData.promptEN}
              </p>
              <p className="text-xs text-ink-muted leading-relaxed">
                {promptData.promptVI}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink">
                  Từ mục tiêu ({liveMatchedSet.size}/{activeTargetTerms.length})
                </span>
                <span
                  className={`font-mono font-semibold ${
                    coveragePercent >= 75 ? "text-emerald-600" : "text-ink-muted"
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
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-pill text-xs font-mono border transition-all ${
                        matched
                          ? "bg-emerald-50 border-emerald-300 text-emerald-800 shadow-xs"
                          : "bg-paper-muted border-ink/15 text-ink-muted"
                      }`}
                    >
                      {matched && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
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
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-pill text-xs font-semibold border transition-all ${
                    isListening
                      ? "bg-rose-600 text-white border-rose-600 animate-pulse"
                      : "bg-accent text-white border-accent hover:opacity-95"
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
                  className="text-xs text-ink-muted hover:text-ink underline"
                >
                  {showTypedFallback ? "Ẩn ô gõ chữ" : "Gõ câu trả lời"}
                </button>
              </div>

              {micError && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  {micError}
                </div>
              )}

              {showTypedFallback && (
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  rows={3}
                  placeholder="Nội dung bạn nói sẽ hiện trực tiếp ở đây (hoặc bạn có thể tự gõ/chỉnh sửa câu trả lời bằng tiếng Anh)..."
                  className="w-full p-3 text-xs sm:text-sm bg-white border border-ink/20 rounded-xl text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent"
                />
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={isEvaluating || !transcript.trim()}
                  onClick={() => void handleEvaluate()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-pill text-xs font-semibold bg-ink text-white hover:opacity-95 disabled:opacity-40 transition-all"
                >
                  {isEvaluating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang chấm điểm...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Chấm điểm & Nhận phản hồi</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {evalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {evalError}
              </div>
            )}

            {evaluation && (
              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-ink">
                      Điểm phản xạ:
                    </span>
                    <span className="px-2.5 py-0.5 rounded-pill bg-ink text-white text-xs font-mono font-bold">
                      {evaluation.score}/100
                    </span>
                  </div>
                  {evaluation.awardedCoins > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill bg-amber-100 border border-amber-300 text-amber-900 text-xs font-semibold">
                      <Coins className="w-3.5 h-3.5 text-amber-600" />
                      +{evaluation.awardedCoins} IT-Coins
                    </span>
                  )}
                </div>

                <p className="text-xs text-ink leading-relaxed">
                  <strong className="font-semibold">Độ chính xác ngữ cảnh:</strong>{" "}
                  {evaluation.feedbackVI}
                </p>
                <p className="text-xs text-ink-muted leading-relaxed">
                  <strong className="font-semibold text-ink">Độ tự nhiên:</strong>{" "}
                  {evaluation.naturalnessFeedback}
                </p>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

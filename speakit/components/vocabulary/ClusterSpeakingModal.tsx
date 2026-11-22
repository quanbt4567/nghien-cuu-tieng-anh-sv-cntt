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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-md p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Luyện nói cụm từ ${clusterTitle}`}
    >
      <div className="bg-white/95 backdrop-blur-2xl border border-slate-200/85 rounded-3xl shadow-[0_24px_64px_rgba(15,23,42,0.18)] w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-violet-100/90 border border-violet-300 text-violet-800 text-[11px] font-semibold mb-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Cluster Speaking Drill</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
              {clusterTitle}
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Dùng ít nhất 75% từ mục tiêu trong 1 lượt phản hồi tự nhiên để nhận +3 IT-Coins.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              stopAudioAndMic();
              onClose();
            }}
            className="liquid-glass-btn p-2 rounded-full text-slate-700 hover:text-slate-900 transition-colors"
            aria-label="Đóng cửa sổ"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isGenerating ? (
          <div className="py-10 flex flex-col items-center justify-center gap-2 text-xs text-slate-600">
            <Loader2 className="w-5 h-5 animate-spin text-sky-600" />
            <span>Đang tạo tình huống kỹ thuật phù hợp...</span>
          </div>
        ) : generateError ? (
          <div className="p-4 rounded-xl bg-rose-50/90 border border-rose-300 text-xs text-rose-800 flex items-center justify-between gap-3">
            <span>{generateError}</span>
            <button
              type="button"
              onClick={() => void generatePrompt()}
              className="liquid-glass-btn px-3 py-1.5 rounded-full font-semibold"
            >
              Thử lại
            </button>
          </div>
        ) : promptData ? (
          <>
            <div className="p-4 rounded-2xl bg-sky-50/80 border border-slate-200/85 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-sky-100 border border-sky-300 text-sky-900 text-[11px] font-mono font-semibold">
                  {promptData.scenarioType}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePlayPrompt}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      isPlayingPrompt
                        ? "liquid-btn-primary text-white"
                        : "bg-sky-100/90 border border-sky-300 text-sky-800 hover:bg-sky-200/85"
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
                    className="liquid-glass-btn inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium"
                    title="Đổi tình huống khác"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-sm font-medium text-slate-900 leading-relaxed">
                {promptData.promptEN}
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                {promptData.promptVI}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-900">
                  Từ mục tiêu ({liveMatchedSet.size}/{activeTargetTerms.length})
                </span>
                <span
                  className={`font-mono font-semibold ${
                    coveragePercent >= 75 ? "text-emerald-700" : "text-slate-600"
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
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono border transition-all ${
                        matched
                          ? "bg-emerald-100/90 border-emerald-400 text-emerald-900 font-semibold"
                          : "bg-white/85 border-slate-200/85 text-slate-700"
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
                  className={`text-white inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                    isListening
                      ? "liquid-btn-danger animate-pulse"
                      : "liquid-btn-success"
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
                  className="text-xs text-sky-700 hover:text-sky-900 font-semibold underline"
                >
                  {showTypedFallback ? "Ẩn ô gõ chữ" : "Gõ câu trả lời"}
                </button>
              </div>

              {micError && (
                <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-300 text-xs text-amber-800">
                  {micError}
                </div>
              )}

              {showTypedFallback && (
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  rows={3}
                  placeholder="Nội dung bạn nói sẽ hiện trực tiếp ở đây (hoặc bạn có thể tự gõ/chỉnh sửa câu trả lời bằng tiếng Anh)..."
                  className="liquid-glass-input w-full p-3 text-xs sm:text-sm rounded-xl"
                />
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={isEvaluating || !transcript.trim()}
                  onClick={() => void handleEvaluate()}
                  className="liquid-btn-primary text-white inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold disabled:opacity-40 transition-all"
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
              <div className="p-3 rounded-xl bg-rose-50/90 border border-rose-300 text-xs text-rose-800">
                {evalError}
              </div>
            )}

            {evaluation && (
              <div className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-300 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-900">
                      Điểm phản xạ:
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-sky-100 border border-sky-300 text-sky-900 text-xs font-mono font-bold">
                      {evaluation.score}/100
                    </span>
                  </div>
                  {evaluation.awardedCoins > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100/90 border border-amber-300 text-amber-900 text-xs font-semibold">
                      <Coins className="w-3.5 h-3.5 text-amber-600" />
                      +{evaluation.awardedCoins} IT-Coins
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-800 leading-relaxed">
                  <strong className="font-semibold text-slate-900">Độ chính xác ngữ cảnh:</strong>{" "}
                  {evaluation.feedbackVI}
                </p>
                <p className="text-xs text-slate-700 leading-relaxed">
                  <strong className="font-semibold text-slate-900">Độ tự nhiên:</strong>{" "}
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

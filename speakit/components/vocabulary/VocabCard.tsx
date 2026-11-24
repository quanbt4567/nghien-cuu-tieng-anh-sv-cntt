"use client";

import { useEffect, useRef, useState } from "react";
import {
  BookmarkPlus,
  CheckCircle2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import { VocabularyItem } from "../../lib/types";
import { playTtsAudio, stopActiveTts } from "../../lib/tts-player";
import { storageAdapter } from "../../lib/storage";
import {
  isSpeechRecognitionSupported,
  SpeechController,
  startSpeechRecognition,
} from "../../lib/speech";

interface VocabCardProps {
  item: VocabularyItem;
  isMastered?: boolean;
  isMarkedForReview?: boolean;
  onToggleMastered?: (item: VocabularyItem) => void;
  onToggleReview?: (item: VocabularyItem) => void;
}

type PlaybackTarget = "word" | "sentence";

function normalizeSpeechText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function checkPronunciationMatch(spoken: string, targetTerm: string): boolean {
  const normalizedSpoken = normalizeSpeechText(spoken);
  const normalizedTarget = normalizeSpeechText(targetTerm);
  if (!normalizedSpoken || !normalizedTarget) return false;
  if (normalizedSpoken.includes(normalizedTarget)) return true;

  const targetWords = normalizedTarget.split(" ").filter(Boolean);
  const spokenWords = new Set(normalizedSpoken.split(" ").filter(Boolean));
  return targetWords.every((word) => spokenWords.has(word));
}

function getPartOfSpeechBadgeClass(pos: string): string {
  const norm = pos.trim().toLowerCase();
  if (norm.includes("verb")) {
    return "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-400/35 text-emerald-700 dark:text-emerald-300";
  }
  if (norm.includes("adj")) {
    return "bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-400/35 text-amber-800 dark:text-amber-300";
  }
  if (norm.includes("phrase") || norm.includes("idiom") || norm.includes("collocation")) {
    return "bg-violet-50 dark:bg-violet-500/15 border-violet-200 dark:border-violet-400/35 text-violet-700 dark:text-violet-300";
  }
  return "bg-sky-50 dark:bg-sky-500/15 border-sky-200 dark:border-sky-400/35 text-sky-700 dark:text-sky-300";
}

export function VocabCard({
  item,
  isMastered = false,
  isMarkedForReview = false,
  onToggleMastered,
  onToggleReview,
}: VocabCardProps) {
  const [playingTarget, setPlayingTarget] = useState<PlaybackTarget | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [micTranscript, setMicTranscript] = useState("");
  const [micFeedback, setMicFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const speechRef = useRef<SpeechController | null>(null);
  const latestTranscriptRef = useRef("");

  useEffect(() => {
    return () => {
      if (cancelRef.current) {
        cancelRef.current();
        cancelRef.current = null;
      }
      if (speechRef.current) {
        speechRef.current.abort();
        speechRef.current = null;
      }
    };
  }, []);

  const playSegment = (
    target: PlaybackTarget,
    text: string,
    rate: 0.8 | 1.0 | 1.2
  ) => {
    if (playingTarget === target) {
      stopActiveTts();
      cancelRef.current = null;
      setPlayingTarget(null);
      return;
    }

    setTtsError(null);
    setPlayingTarget(target);
    const persona = storageAdapter.getSettings().voicePersona;

    cancelRef.current = playTtsAudio({
      text,
      rate,
      persona,
      onEnd: () => {
        cancelRef.current = null;
        setPlayingTarget((curr) => (curr === target ? null : curr));
      },
      onError: (message) => {
        cancelRef.current = null;
        setPlayingTarget((curr) => (curr === target ? null : curr));
        setTtsError(message || "Không thể phát âm thanh lúc này.");
      },
    });
  };

  const evaluateTranscript = (spoken: string) => {
    const trimmed = spoken.trim();
    if (!trimmed) return;
    const matched = checkPronunciationMatch(trimmed, item.term);
    setMicFeedback(
      matched
        ? {
            ok: true,
            message: `Phát âm chuẩn! Nhận diện: "${trimmed}"`,
          }
        : {
            ok: false,
            message: `Nghe được "${trimmed}", thử đọc rõ "${item.term}" hơn.`,
          }
    );
  };

  const handleMicToggle = () => {
    if (isListening) {
      speechRef.current?.stop();
      speechRef.current = null;
      setIsListening(false);
      evaluateTranscript(latestTranscriptRef.current);
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      setMicFeedback({
        ok: false,
        message: "Trình duyệt chưa hỗ trợ Web Speech API cho micro.",
      });
      return;
    }

    setMicFeedback(null);
    setMicTranscript("");
    latestTranscriptRef.current = "";

    const controller = startSpeechRecognition({
      onStart: () => {
        setIsListening(true);
      },
      onTranscript: (transcript, isFinal) => {
        latestTranscriptRef.current = transcript;
        setMicTranscript(transcript);
        if (isFinal && checkPronunciationMatch(transcript, item.term)) {
          speechRef.current?.stop();
          speechRef.current = null;
          setIsListening(false);
          evaluateTranscript(transcript);
        }
      },
      onError: (message) => {
        setIsListening(false);
        speechRef.current = null;
        setMicFeedback({ ok: false, message });
      },
      onEnd: () => {
        setIsListening(false);
        speechRef.current = null;
        if (latestTranscriptRef.current) {
          evaluateTranscript(latestTranscriptRef.current);
        }
      },
    });

    speechRef.current = controller;
  };

  return (
    <div
      className={`liquid-glass-card p-5 sm:p-6 space-y-4 transition-colors ${
        isMastered
          ? "!border-green-400/80 dark:!border-green-500/50"
          : isMarkedForReview
            ? "!border-amber-400/80 dark:!border-amber-500/50"
            : "hover:!border-blue-400 dark:hover:!border-blue-400/60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-bold font-mono text-slate-900 dark:text-slate-50 tracking-normal leading-snug">
              {item.term}
            </h3>
            <span
              className={`text-xs font-mono uppercase px-2 py-0.5 rounded-full border font-semibold tracking-normal ${getPartOfSpeechBadgeClass(
                item.partOfSpeech
              )}`}
            >
              {item.partOfSpeech}
            </span>
          </div>
          <div className="text-sm font-ipa text-blue-700 dark:text-blue-400 font-medium tracking-wide mt-1">
            {item.phonetic}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleMicToggle}
            aria-label={
              isListening
                ? `Dừng kiểm tra phát âm "${item.term}"`
                : `Kiểm tra phát âm "${item.term}"`
            }
            title={
              isListening
                ? "Đang nghe... bấm để dừng"
                : `Đọc thử từ "${item.term}"`
            }
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors border ${
              isListening
                ? "bg-red-600 hover:bg-red-700 border-red-600 text-white animate-pulse"
                : "bg-slate-100 dark:bg-[#263349] border-slate-300 dark:border-white/20 text-slate-700 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-[#334155]"
            }`}
          >
            {isListening ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => playSegment("word", item.term, 1.0)}
            aria-label={
              playingTarget === "word"
                ? `Dừng phát âm "${item.term}"`
                : `Phát âm từ "${item.term}"`
            }
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors border ${
              playingTarget === "word"
                ? "bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 border-blue-700 dark:border-blue-600 text-white"
                : "bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60"
            }`}
            title={
              playingTarget === "word"
                ? `Dừng phát âm "${item.term}"`
                : `Phát âm từ "${item.term}"`
            }
          >
            {playingTarget === "word" ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {(isListening || micFeedback) && (
        <div
          className={`text-sm font-mono px-3 py-2 rounded-lg border ${
            isListening
              ? "bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200"
              : micFeedback?.ok
                ? "bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300"
                : "bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300"
          }`}
        >
          {isListening
            ? micTranscript
              ? `Đang nghe: "${micTranscript}"`
              : `Hãy đọc to từ "${item.term}" hoặc câu ví dụ...`
            : micFeedback?.message}
        </div>
      )}

      <p className="text-sm text-slate-800 dark:text-slate-100 font-medium leading-relaxed">
        {item.meaningVI}
      </p>

      <div className="pt-3 border-t border-slate-200 dark:border-[#334155] space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs uppercase font-bold text-slate-600 dark:text-slate-400">
            Ví dụ trong công việc:
          </span>
          <button
            type="button"
            onClick={() => playSegment("sentence", item.exampleSentenceEN, 0.8)}
            className={`text-xs font-mono px-2.5 py-1 rounded-lg border flex items-center gap-1 font-semibold transition-colors ${
              playingTarget === "sentence"
                ? "bg-blue-700 dark:bg-blue-600 border-blue-700 dark:border-blue-600 text-white"
                : "bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60"
            }`}
          >
            {playingTarget === "sentence" ? (
              <VolumeX className="w-3.5 h-3.5" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
            <span>{playingTarget === "sentence" ? "Dừng phát" : "Nghe câu mẫu"}</span>
          </button>
        </div>
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
          &quot;{item.exampleSentenceEN}&quot;
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-300 pt-0.5">
          {item.exampleTranslationVI}
        </div>
      </div>

      {(onToggleReview || onToggleMastered) && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-[#334155]">
          {onToggleReview && (
            <button
              type="button"
              onClick={() => onToggleReview(item)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                isMarkedForReview
                  ? "bg-amber-50 dark:bg-amber-500/20 border-amber-300 dark:border-amber-400/50 text-amber-800 dark:text-amber-300"
                  : "bg-slate-100 dark:bg-[#263349] border-slate-300 dark:border-white/20 text-slate-700 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-[#334155]"
              }`}
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
              <span>{isMarkedForReview ? "Đang trong Cần ôn lại" : "Cần ôn lại"}</span>
            </button>
          )}

          {onToggleMastered && (
            <button
              type="button"
              onClick={() => onToggleMastered(item)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                isMastered
                  ? "bg-green-50 dark:bg-green-500/20 border-green-300 dark:border-green-400/50 text-green-800 dark:text-green-300"
                  : "bg-slate-100 dark:bg-[#263349] border-slate-300 dark:border-white/20 text-slate-700 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-[#334155]"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isMastered ? "Đã thuộc" : "Đánh dấu đã thuộc"}</span>
            </button>
          )}
        </div>
      )}

      {ttsError && (
        <p className="text-sm font-mono text-red-700 dark:text-red-400" role="alert">
          {ttsError}
        </p>
      )}
    </div>
  );
}

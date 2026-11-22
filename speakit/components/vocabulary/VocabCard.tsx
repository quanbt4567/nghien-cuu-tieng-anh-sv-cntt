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
            message: `Nghe được "${trimmed}" — thử đọc rõ "${item.term}" hơn.`,
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
      className={`liquid-glass-card-lite rounded-3xl p-5 sm:p-6 space-y-4 transition-all ${
        isMastered
          ? "!border-emerald-400/50 shadow-[0_0_24px_rgba(16,185,129,0.14)]"
          : isMarkedForReview
            ? "!border-amber-400/50 shadow-[0_0_24px_rgba(245,158,11,0.14)]"
            : "hover:!border-white/30"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-bold font-mono text-white tracking-normal leading-snug">
              {item.term}
            </h3>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-400/40 text-violet-200 tracking-normal">
              {item.partOfSpeech}
            </span>
          </div>
          <div className="text-sm font-ipa text-cyan-300 font-medium tracking-wide mt-1">
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
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
              isListening
                ? "liquid-btn-danger animate-pulse"
                : "bg-emerald-500/20 border border-emerald-400/45 text-emerald-200 hover:bg-emerald-500/35 hover:text-white"
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
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
              playingTarget === "word"
                ? "liquid-btn-primary"
                : "bg-cyan-500/20 border border-cyan-400/45 text-cyan-200 hover:bg-cyan-500/35 hover:text-white"
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
          className={`text-[11px] font-mono px-3 py-2 rounded-xl border ${
            isListening
              ? "bg-cyan-500/15 border-cyan-400/40 text-cyan-100"
              : micFeedback?.ok
                ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-200"
                : "bg-amber-500/15 border-amber-400/40 text-amber-200"
          }`}
        >
          {isListening
            ? micTranscript
              ? `Đang nghe: "${micTranscript}"`
              : `Hãy đọc to từ "${item.term}" hoặc câu ví dụ...`
            : micFeedback?.message}
        </div>
      )}

      <p className="text-xs text-slate-100 font-medium leading-relaxed bg-slate-950/50 border border-white/12 p-3 rounded-xl">
        {item.meaningVI}
      </p>

      <div className="bg-slate-950/60 p-3.5 rounded-xl border border-white/12 space-y-1.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase font-bold text-slate-400">
            Ví dụ trong công việc:
          </span>
          <button
            type="button"
            onClick={() => playSegment("sentence", item.exampleSentenceEN, 0.8)}
            className={`text-[11px] font-mono px-2.5 py-1 rounded-full border flex items-center gap-1 font-semibold transition-colors ${
              playingTarget === "sentence"
                ? "bg-violet-500/30 border-violet-400/55 text-violet-100"
                : "bg-violet-500/15 border-violet-400/35 text-violet-200 hover:bg-violet-500/25 hover:text-white"
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
        <div className="font-medium text-white leading-relaxed">
          "{item.exampleSentenceEN}"
        </div>
        <div className="text-slate-300 text-[11px] pt-0.5">
          {item.exampleTranslationVI}
        </div>
      </div>

      {(onToggleReview || onToggleMastered) && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
          {onToggleReview && (
            <button
              type="button"
              onClick={() => onToggleReview(item)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border transition-colors ${
                isMarkedForReview
                  ? "bg-amber-500/25 border-amber-400/50 text-amber-200"
                  : "bg-white/[0.06] border-white/15 text-slate-300 hover:text-white hover:bg-white/[0.14]"
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
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border transition-colors ${
                isMastered
                  ? "bg-emerald-500/25 border-emerald-400/50 text-emerald-200"
                  : "bg-white/[0.06] border-white/15 text-slate-300 hover:text-white hover:bg-white/[0.14]"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isMastered ? "Đã thuộc" : "Đánh dấu đã thuộc"}</span>
            </button>
          )}
        </div>
      )}

      {ttsError && (
        <p className="text-[11px] font-mono text-rose-300" role="alert">
          {ttsError}
        </p>
      )}
    </div>
  );
}

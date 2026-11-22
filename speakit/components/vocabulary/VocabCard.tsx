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
          ? "!border-emerald-400/80 shadow-[0_8px_24px_rgba(16,185,129,0.12)]"
          : isMarkedForReview
            ? "!border-amber-400/80 shadow-[0_8px_24px_rgba(245,158,11,0.12)]"
            : "hover:!border-sky-300"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-bold font-mono text-slate-900 tracking-normal leading-snug">
              {item.term}
            </h3>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-violet-100/90 border border-violet-300 text-violet-800 font-semibold tracking-normal">
              {item.partOfSpeech}
            </span>
          </div>
          <div className="text-sm font-ipa text-sky-700 font-medium tracking-wide mt-1">
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
                ? "liquid-btn-danger text-white animate-pulse"
                : "bg-emerald-100/90 border border-emerald-300 text-emerald-800 hover:bg-emerald-200/80"
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
                ? "liquid-btn-primary text-white"
                : "bg-sky-100/90 border border-sky-300 text-sky-800 hover:bg-sky-200/80"
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
              ? "bg-sky-100/85 border-sky-300 text-sky-900"
              : micFeedback?.ok
                ? "bg-emerald-100/85 border-emerald-300 text-emerald-900"
                : "bg-amber-100/85 border-amber-300 text-amber-900"
          }`}
        >
          {isListening
            ? micTranscript
              ? `Đang nghe: "${micTranscript}"`
              : `Hãy đọc to từ "${item.term}" hoặc câu ví dụ...`
            : micFeedback?.message}
        </div>
      )}

      <p className="text-xs text-slate-800 font-medium leading-relaxed bg-sky-50/80 border border-slate-200/85 p-3 rounded-xl">
        {item.meaningVI}
      </p>

      <div className="bg-white/85 p-3.5 rounded-xl border border-slate-200/85 space-y-1.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase font-bold text-slate-600">
            Ví dụ trong công việc:
          </span>
          <button
            type="button"
            onClick={() => playSegment("sentence", item.exampleSentenceEN, 0.8)}
            className={`text-[11px] font-mono px-2.5 py-1 rounded-full border flex items-center gap-1 font-semibold transition-colors ${
              playingTarget === "sentence"
                ? "bg-violet-200/90 border-violet-400 text-violet-900"
                : "bg-violet-100/85 border-violet-300 text-violet-800 hover:bg-violet-200/80"
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
        <div className="font-medium text-slate-900 leading-relaxed">
          "{item.exampleSentenceEN}"
        </div>
        <div className="text-slate-600 text-[11px] pt-0.5">
          {item.exampleTranslationVI}
        </div>
      </div>

      {(onToggleReview || onToggleMastered) && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/85">
          {onToggleReview && (
            <button
              type="button"
              onClick={() => onToggleReview(item)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${
                isMarkedForReview
                  ? "bg-amber-100/90 border-amber-400 text-amber-900"
                  : "bg-white/85 border-slate-200/85 text-slate-700 hover:text-slate-900 hover:bg-sky-50/80"
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
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${
                isMastered
                  ? "bg-emerald-100/90 border-emerald-400 text-emerald-900"
                  : "bg-white/85 border-slate-200/85 text-slate-700 hover:text-slate-900 hover:bg-sky-50/80"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isMastered ? "Đã thuộc" : "Đánh dấu đã thuộc"}</span>
            </button>
          )}
        </div>
      )}

      {ttsError && (
        <p className="text-[11px] font-mono text-rose-700" role="alert">
          {ttsError}
        </p>
      )}
    </div>
  );
}

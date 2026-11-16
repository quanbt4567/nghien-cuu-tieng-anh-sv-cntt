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
      className={`bg-white border rounded-2xl p-5 sm:p-6 shadow-soft space-y-4 hover:shadow-card transition-all ${
        isMastered
          ? "border-emerald-300/80"
          : isMarkedForReview
            ? "border-amber-300/90"
            : "border-ink/15"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-bold font-mono text-ink tracking-normal leading-snug">
              {item.term}
            </h3>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-pill bg-paper border border-ink/15 text-ink-muted tracking-normal">
              {item.partOfSpeech}
            </span>
          </div>
          <div className="text-sm font-ipa text-accent font-medium tracking-wide mt-1">
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
            className={`w-9 h-9 rounded-full border flex items-center justify-center shadow-soft shadow-hard-press transition-colors ${
              isListening
                ? "bg-red-500 border-red-600 text-white animate-pulse"
                : "bg-paper border-ink/20 text-ink hover:bg-accent hover:text-white"
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
            className="w-9 h-9 rounded-full bg-paper border border-ink/20 flex items-center justify-center text-ink hover:bg-accent hover:text-white shadow-soft shadow-hard-press transition-colors"
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
              ? "bg-paper border-accent/40 text-ink"
              : micFeedback?.ok
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-amber-50 border-amber-200 text-amber-800"
          }`}
        >
          {isListening
            ? micTranscript
              ? `Đang nghe: "${micTranscript}"`
              : `Hãy đọc to từ "${item.term}" hoặc câu ví dụ...`
            : micFeedback?.message}
        </div>
      )}

      <p className="text-xs text-ink font-medium leading-relaxed bg-paper/60 border border-ink/10 p-3 rounded-xl">
        {item.meaningVI}
      </p>

      <div className="bg-paper p-3.5 rounded-xl border border-ink/15 space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase font-bold text-ink-muted">
            Ví dụ trong công việc:
          </span>
          <button
            type="button"
            onClick={() => playSegment("sentence", item.exampleSentenceEN, 0.8)}
            className="text-[11px] font-mono text-accent hover:underline flex items-center gap-1 font-semibold"
          >
            {playingTarget === "sentence" ? (
              <VolumeX className="w-3.5 h-3.5" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
            <span>{playingTarget === "sentence" ? "Dừng phát" : "Nghe câu mẫu"}</span>
          </button>
        </div>
        <div className="font-medium text-ink leading-relaxed">
          "{item.exampleSentenceEN}"
        </div>
        <div className="text-ink-muted text-[11px] pt-0.5">
          {item.exampleTranslationVI}
        </div>
      </div>

      {(onToggleReview || onToggleMastered) && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-ink/10">
          {onToggleReview && (
            <button
              type="button"
              onClick={() => onToggleReview(item)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-[11px] font-medium border transition-colors ${
                isMarkedForReview
                  ? "bg-amber-100 border-amber-400 text-amber-900"
                  : "bg-paper border-ink/15 text-ink-muted hover:text-ink hover:bg-paper-muted"
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
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-[11px] font-medium border transition-colors ${
                isMastered
                  ? "bg-emerald-100 border-emerald-400 text-emerald-900"
                  : "bg-paper border-ink/15 text-ink-muted hover:text-ink hover:bg-paper-muted"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isMastered ? "Đã thuộc" : "Đánh dấu đã thuộc"}</span>
            </button>
          )}
        </div>
      )}

      {ttsError && (
        <p className="text-[11px] font-mono text-red-600" role="alert">
          {ttsError}
        </p>
      )}
    </div>
  );
}

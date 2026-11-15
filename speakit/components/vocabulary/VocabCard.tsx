"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { VocabularyItem } from "../../lib/types";
import { playTtsAudio, stopActiveTts } from "../../lib/tts-player";
import { storageAdapter } from "../../lib/storage";

interface VocabCardProps {
  item: VocabularyItem;
}

type PlaybackTarget = "word" | "sentence";

export function VocabCard({ item }: VocabCardProps) {
  const [playingTarget, setPlayingTarget] = useState<PlaybackTarget | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (cancelRef.current) {
        cancelRef.current();
        cancelRef.current = null;
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

  return (
    <div className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-4 hover:shadow-card transition-all">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold font-mono text-ink tracking-tight">
              {item.term}
            </h3>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-pill bg-paper border border-ink/15 text-ink-muted">
              {item.partOfSpeech}
            </span>
          </div>
          <div className="text-sm font-ipa text-accent font-medium tracking-wide mt-1">
            {item.phonetic}
          </div>
        </div>

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

      {ttsError && (
        <p className="text-[11px] font-mono text-red-600" role="alert">
          {ttsError}
        </p>
      )}
    </div>
  );
}

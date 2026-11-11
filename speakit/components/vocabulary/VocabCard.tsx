"use client";

import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { VocabularyItem } from "../../lib/types";
import { speakText } from "../../lib/speech";

interface VocabCardProps {
  item: VocabularyItem;
}

export function VocabCard({ item }: VocabCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlayWord = () => {
    setIsPlaying(true);
    speakText(
      item.term,
      1.0,
      () => setIsPlaying(false),
      () => setIsPlaying(false)
    );
  };

  const handlePlaySentence = () => {
    setIsPlaying(true);
    speakText(
      item.exampleSentenceEN,
      0.8,
      () => setIsPlaying(false),
      () => setIsPlaying(false)
    );
  };

  return (
    <div className="bg-white border-2 border-ink rounded-2xl p-5 shadow-hard space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold font-mono text-ink tracking-tight">
              {item.term}
            </h3>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-pill bg-paper border border-ink text-ink-muted">
              {item.partOfSpeech}
            </span>
          </div>
          <div className="text-xs font-mono text-accent font-semibold mt-0.5">
            {item.phonetic}
          </div>
        </div>

        <button
          type="button"
          onClick={handlePlayWord}
          className="w-9 h-9 rounded-full bg-paper border-2 border-ink flex items-center justify-center text-ink hover:bg-accent hover:text-white shadow-hard-sm shadow-hard-press transition-colors"
          title={`Phát âm từ "${item.term}"`}
        >
          {isPlaying ? (
            <VolumeX className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Vietnamese Meaning */}
      <p className="text-xs text-ink font-medium leading-relaxed bg-paper-card border border-ink/30 p-2.5 rounded-xl">
        {item.meaningVI}
      </p>

      {/* Example Sentence */}
      <div className="bg-paper p-3 rounded-xl border border-ink space-y-1 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase font-bold text-ink-muted">
            Ví dụ trong công việc:
          </span>
          <button
            type="button"
            onClick={handlePlaySentence}
            className="text-[11px] font-mono text-accent hover:underline flex items-center gap-1"
          >
            <Volume2 className="w-3 h-3" />
            <span>Nghe câu</span>
          </button>
        </div>
        <div className="font-medium text-ink leading-relaxed">
          "{item.exampleSentenceEN}"
        </div>
        <div className="text-ink-muted text-[11px] pt-0.5">
          {item.exampleTranslationVI}
        </div>
      </div>
    </div>
  );
}

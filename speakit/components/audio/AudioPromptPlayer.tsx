"use client";

import { useEffect, useState, useRef } from "react";
import { Volume2, VolumeX, RotateCcw } from "lucide-react";
import { speakText, isSpeechSynthesisSupported } from "../../lib/speech";

interface AudioPromptPlayerProps {
  text: string;
  autoPlay?: boolean;
  onPlaybackEnd?: () => void;
}

export function AudioPromptPlayer({
  text,
  autoPlay = true,
  onPlaybackEnd,
}: AudioPromptPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [rate, setRate] = useState<0.8 | 1.0 | 1.2>(1.0);
  const [supported, setSupported] = useState(true);
  const cancelSpeechRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setSupported(isSpeechSynthesisSupported());
  }, []);

  const handlePlay = (customRate = rate) => {
    if (!text.trim()) return;

    if (cancelSpeechRef.current) {
      cancelSpeechRef.current();
    }

    setIsPlaying(true);
    const cancelFn = speakText(
      text,
      customRate,
      () => {
        setIsPlaying(false);
        onPlaybackEnd?.();
      },
      () => {
        setIsPlaying(false);
      }
    );
    cancelSpeechRef.current = cancelFn;
  };

  const handleStop = () => {
    if (cancelSpeechRef.current) {
      cancelSpeechRef.current();
      cancelSpeechRef.current = null;
    }
    setIsPlaying(false);
  };

  const handleRateChange = (newRate: 0.8 | 1.0 | 1.2) => {
    setRate(newRate);
    if (isPlaying) {
      handlePlay(newRate);
    }
  };

  useEffect(() => {
    if (autoPlay && text) {
      handlePlay();
    }
    return () => {
      if (cancelSpeechRef.current) {
        cancelSpeechRef.current();
      }
    };
  }, [text]);

  if (!supported) {
    return (
      <div className="text-xs font-mono text-ink-muted bg-paper-muted p-2 rounded-lg border border-ink">
        Thiết bị không hỗ trợ SpeechSynthesis. Câu hỏi hiển thị dạng văn bản.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Play / Stop Button */}
      {isPlaying ? (
        <button
          onClick={handleStop}
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-pill bg-accent text-white border border-accent shadow-soft"
          title="Dừng phát âm"
        >
          <VolumeX className="w-3.5 h-3.5" />
          <span>Dừng nghe</span>
        </button>
      ) : (
        <button
          onClick={() => handlePlay()}
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-pill bg-paper-card text-ink border border-ink/15 shadow-soft hover:bg-paper-muted"
          title="Nghe lại câu hỏi"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Nghe lại</span>
        </button>
      )}

      {/* Speed Rate Selectors */}
      <div className="flex items-center gap-1 bg-paper-card p-0.5 rounded-pill border border-ink/15 shadow-soft">
        {([0.8, 1.0, 1.2] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => handleRateChange(r)}
            className={`px-2 py-0.5 text-[11px] font-mono font-semibold rounded-pill transition-all ${
              rate === r
                ? "bg-ink text-white"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {r}x
          </button>
        ))}
      </div>
    </div>
  );
}


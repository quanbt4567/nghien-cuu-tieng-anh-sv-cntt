"use client";

import { useEffect, useState, useRef } from "react";
import { Volume2, VolumeX, RotateCcw } from "lucide-react";
import { playTtsAudio } from "../../lib/tts-player";
import { storageAdapter } from "../../lib/storage";
import { VoicePersonaId } from "../../lib/types";

interface AudioPromptPlayerProps {
  text: string;
  autoPlay?: boolean;
  voicePersona?: VoicePersonaId;
  onPlaybackEnd?: () => void;
}

export function AudioPromptPlayer({
  text,
  autoPlay = true,
  voicePersona,
  onPlaybackEnd,
}: AudioPromptPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSlowPlaying, setIsSlowPlaying] = useState(false);
  const [rate, setRate] = useState<0.8 | 1.0 | 1.2>(1.0);
  const [supported] = useState(true);
  const cancelSpeechRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const saved = storageAdapter.getSettings();
    if (saved.speechRate) {
      setRate(saved.speechRate);
    }
  }, []);

  const handlePlay = (
    customRate = rate,
    customPersona = voicePersona,
    slowMode = false
  ) => {
    if (!text.trim()) return;

    if (cancelSpeechRef.current) {
      cancelSpeechRef.current();
    }

    setIsPlaying(true);
    setIsSlowPlaying(slowMode);
    const cancelFn = playTtsAudio({
      text,
      rate: customRate,
      persona: customPersona,
      slowMode,
      onEnd: () => {
        setIsPlaying(false);
        setIsSlowPlaying(false);
        onPlaybackEnd?.();
      },
      onError: () => {
        setIsPlaying(false);
        setIsSlowPlaying(false);
      },
    });
    cancelSpeechRef.current = cancelFn;
  };

  const handleStop = () => {
    if (cancelSpeechRef.current) {
      cancelSpeechRef.current();
      cancelSpeechRef.current = null;
    }
    setIsPlaying(false);
    setIsSlowPlaying(false);
  };

  const handleRateChange = (newRate: 0.8 | 1.0 | 1.2) => {
    setRate(newRate);
    if (isPlaying) {
      handlePlay(newRate, voicePersona, isSlowPlaying);
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
      <div className="text-sm font-mono text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
        Thiết bị không hỗ trợ SpeechSynthesis. Câu hỏi hiển thị dạng văn bản.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isPlaying && !isSlowPlaying ? (
        <button
          onClick={handleStop}
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors"
          title="Dừng phát âm"
        >
          <VolumeX className="w-3.5 h-3.5" />
          <span>Dừng nghe</span>
        </button>
      ) : (
        <button
          onClick={() => handlePlay(rate, voicePersona, false)}
          type="button"
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
          title="Nghe lại câu hỏi"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Nghe lại</span>
        </button>
      )}

      <button
        onClick={() => {
          if (isPlaying && isSlowPlaying) {
            handleStop();
          } else {
            handlePlay(rate, voicePersona, true);
          }
        }}
        type="button"
        className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
          isPlaying && isSlowPlaying
            ? "bg-red-600 hover:bg-red-700 border-red-600 text-white"
            : "bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-950/80 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300"
        }`}
        title="Nghe chậm từng từ"
      >
        {isPlaying && isSlowPlaying ? (
          <VolumeX className="w-3.5 h-3.5" />
        ) : (
          <Volume2 className="w-3.5 h-3.5" />
        )}
        <span>Nghe chậm</span>
      </button>

      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
        {([0.8, 1.0, 1.2] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => handleRateChange(r)}
            className={`px-2 py-0.5 text-xs font-mono font-semibold rounded-md border transition-colors ${
              rate === r
                ? "bg-blue-700 text-white border-blue-700 dark:bg-blue-600 dark:border-blue-600"
                : "text-slate-600 dark:text-slate-300 border-transparent hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {r}x
          </button>
        ))}
      </div>
    </div>
  );
}

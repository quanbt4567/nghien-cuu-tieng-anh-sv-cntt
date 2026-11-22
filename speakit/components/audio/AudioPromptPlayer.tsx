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
      <div className="text-xs font-mono text-slate-300 bg-white/[0.06] p-2 rounded-lg border border-white/15">
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
          className="liquid-btn-danger flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-all"
          title="Dừng phát âm"
        >
          <VolumeX className="w-3.5 h-3.5" />
          <span>Dừng nghe</span>
        </button>
      ) : (
        <button
          onClick={() => handlePlay(rate, voicePersona, false)}
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 hover:bg-cyan-500/30 transition-all"
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
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${
          isPlaying && isSlowPlaying
            ? "bg-violet-500/40 border-violet-300/70 text-white shadow-[0_0_16px_rgba(139,92,246,0.4)]"
            : "bg-violet-500/20 border-violet-400/50 text-violet-200 hover:bg-violet-500/30"
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

      <div className="flex items-center gap-1 bg-slate-950/60 p-0.5 rounded-full border border-white/15">
        {([0.8, 1.0, 1.2] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => handleRateChange(r)}
            className={`px-2 py-0.5 text-[11px] font-mono font-semibold rounded-full border transition-all ${
              rate === r
                ? "bg-cyan-500/30 text-cyan-100 border-cyan-400/50"
                : "text-slate-300 border-transparent hover:text-white"
            }`}
          >
            {r}x
          </button>
        ))}
      </div>
    </div>
  );
}

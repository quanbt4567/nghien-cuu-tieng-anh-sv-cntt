"use client";

import { useEffect, useState } from "react";
import { Mic, Square, AlertCircle } from "lucide-react";

interface MicButtonProps {
  isRecording: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
  error?: string | null;
  maxSeconds?: number;
}

const EQUALIZER_BARS = [10, 18, 24, 14, 26, 16, 23, 13, 10];

function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = String(Math.floor(safe / 60)).padStart(2, "0");
  const secs = String(safe % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

export function MicButton({
  isRecording,
  onStart,
  onStop,
  disabled = false,
  error,
  maxSeconds,
}: MicButtonProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isRecording) {
      setElapsedSeconds(0);
      return;
    }

    const startedAt = Date.now();
    setElapsedSeconds(0);
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRecording]);

  const hasCountdown =
    typeof maxSeconds === "number" && Number.isFinite(maxSeconds) && maxSeconds > 0;
  const displaySeconds = hasCountdown
    ? Math.max(0, Math.ceil(maxSeconds) - elapsedSeconds)
    : elapsedSeconds;
  const isLowTime = hasCountdown && displaySeconds <= 5;

  const handleClick = () => {
    if (disabled) return;
    if (isRecording) {
      onStop();
    } else {
      onStart();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-label={isRecording ? "Dừng ghi âm" : "Bắt đầu nói"}
        className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-all ${
          disabled
            ? "bg-white/[0.06] text-slate-500 cursor-not-allowed opacity-50 border border-white/10 shadow-none"
            : isRecording
            ? "liquid-btn-danger animate-mic-listening ring-4 ring-rose-500/35 shadow-[0_0_32px_rgba(244,63,94,0.6)] scale-105"
            : "liquid-btn-primary ring-4 ring-cyan-400/25 hover:ring-cyan-300/45 hover:scale-105 active:scale-95"
        }`}
      >
        {isRecording ? (
          <Square className="w-8 h-8 fill-white" />
        ) : (
          <Mic className="w-9 h-9" />
        )}
      </button>

      {isRecording && (
        <div className="flex flex-col items-center gap-2 pt-0.5">
          <style>{`
            @keyframes speakitWave {
              0%, 100% { transform: scaleY(0.45); }
              50% { transform: scaleY(1); }
            }
          `}</style>
          <div
            aria-hidden="true"
            className="h-8 flex items-center justify-center gap-1 px-3 py-1 rounded-full bg-slate-950/70 border border-rose-400/35"
          >
            {EQUALIZER_BARS.map((baseHeight, idx) => {
              const jitter = ((elapsedSeconds * 5 + idx * 7) % 9) - 4;
              const barHeight = Math.min(24, Math.max(6, baseHeight + jitter));
              return (
                <span
                  key={idx}
                  className="w-1 rounded-full bg-gradient-to-t from-rose-500 to-cyan-300 origin-center transition-[height] duration-300"
                  style={{
                    height: `${barHeight}px`,
                    animation: `speakitWave ${540 + (idx % 3) * 140}ms ease-in-out ${idx * 75}ms infinite`,
                  }}
                />
              );
            })}
          </div>

          <div
            className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border text-xs font-mono font-bold ${
              isLowTime
                ? "bg-rose-500/30 text-rose-100 border-rose-400/60 shadow-[0_0_16px_rgba(244,63,94,0.4)]"
                : "bg-rose-500/20 text-rose-200 border-rose-400/40"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            <span>{formatDuration(displaySeconds)}</span>
            {hasCountdown && (
              <span className="opacity-75 font-normal">
                / {formatDuration(maxSeconds)}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="text-center space-y-2">
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:ring-0 ${
            isRecording
              ? "liquid-btn-danger ring-2 ring-rose-400/35 shadow-[0_0_24px_rgba(244,63,94,0.45)]"
              : "liquid-btn-primary ring-2 ring-cyan-400/25 active:scale-[0.98]"
          }`}
        >
          {isRecording ? (
            <>
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              <span>Dừng ghi âm</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              <span>Ghi âm câu trả lời</span>
            </>
          )}
        </button>
        <div className="text-[11px] font-mono text-slate-300">
          Nhận diện giọng nói tiếng Anh trên trình duyệt
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-rose-200 font-medium bg-rose-500/15 px-3 py-1.5 rounded-full border border-rose-400/40">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

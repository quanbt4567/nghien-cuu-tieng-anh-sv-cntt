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
        className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-accent/20 flex items-center justify-center transition-all ${
          disabled
            ? "bg-paper-muted cursor-not-allowed opacity-50 border-ink/10"
            : isRecording
            ? "bg-accent text-white animate-mic-listening shadow-card scale-105"
            : "bg-accent text-white shadow-soft hover:shadow-card hover:bg-accent-hover hover:scale-102"
        }`}
      >
        {isRecording ? (
          <Square className="w-8 h-8 fill-white" />
        ) : (
          <Mic className="w-9 h-9" />
        )}
      </button>

      {/* Pure CSS + timer-tick equalizer & timer (never opens a duplicate mic stream) */}
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
            className="h-8 flex items-center justify-center gap-1 px-3 py-1 rounded-pill bg-paper border border-ink/15"
          >
            {EQUALIZER_BARS.map((baseHeight, idx) => {
              const jitter = ((elapsedSeconds * 5 + idx * 7) % 9) - 4;
              const barHeight = Math.min(24, Math.max(6, baseHeight + jitter));
              return (
                <span
                  key={idx}
                  className="w-1 rounded-full bg-accent origin-center transition-[height] duration-300"
                  style={{
                    height: `${barHeight}px`,
                    animation: `speakitWave ${540 + (idx % 3) * 140}ms ease-in-out ${idx * 75}ms infinite`,
                  }}
                />
              );
            })}
          </div>

          <div
            className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-pill border text-xs font-mono font-bold ${
              isLowTime
                ? "bg-accent text-white border-accent"
                : "bg-accent-light text-accent border-accent/30"
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

      {/* Status Label */}
      <div className="text-center space-y-1">
        <div className="text-xs sm:text-sm font-bold text-ink">
          {isRecording ? (
            <span className="text-accent flex items-center gap-1.5 justify-center">
              <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
              Đang nghe bạn nói... (Nhấn để kết thúc)
            </span>
          ) : (
            <span>Nhấn vào micro để trả lời</span>
          )}
        </div>
        <div className="text-[11px] font-mono text-ink-muted">
          Chrome SpeechRecognition (en-US)
        </div>
      </div>

      {/* Inline Warning/Error if any */}
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-accent font-medium bg-accent-light px-3 py-1.5 rounded-pill border border-accent">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

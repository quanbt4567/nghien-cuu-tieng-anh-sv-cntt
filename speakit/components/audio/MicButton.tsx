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
        className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center border-2 transition-colors transition-transform ${
          disabled
            ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-60 border-slate-200 dark:border-slate-700"
            : isRecording
            ? "bg-red-600 hover:bg-red-700 text-white border-red-700 dark:border-red-500 scale-105"
            : "bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white border-blue-700 dark:border-blue-500 hover:scale-105 active:scale-95"
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
            className="h-8 flex items-center justify-center gap-1 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800"
          >
            {EQUALIZER_BARS.map((baseHeight, idx) => {
              const jitter = ((elapsedSeconds * 5 + idx * 7) % 9) - 4;
              const barHeight = Math.min(24, Math.max(6, baseHeight + jitter));
              return (
                <span
                  key={idx}
                  className="w-1 rounded-full bg-red-600 dark:bg-red-400 origin-center"
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
                ? "bg-red-600 text-white border-red-600"
                : "bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
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
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            isRecording
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white active:scale-[0.98]"
          }`}
        >
          {isRecording ? (
            <>
              <span className="w-2 h-2 rounded-full bg-white" />
              <span>Dừng ghi âm</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              <span>Ghi âm câu trả lời</span>
            </>
          )}
        </button>
        <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
          Nhận diện giọng nói tiếng Anh trên trình duyệt
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-sm text-red-700 dark:text-red-300 font-medium bg-red-50 dark:bg-red-950/50 px-3.5 py-2 rounded-lg border border-red-200 dark:border-red-800">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

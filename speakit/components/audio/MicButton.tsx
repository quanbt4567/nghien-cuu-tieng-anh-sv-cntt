"use client";

import { Mic, Square, AlertCircle } from "lucide-react";

interface MicButtonProps {
  isRecording: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
  error?: string | null;
}

export function MicButton({
  isRecording,
  onStart,
  onStop,
  disabled = false,
  error,
}: MicButtonProps) {
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


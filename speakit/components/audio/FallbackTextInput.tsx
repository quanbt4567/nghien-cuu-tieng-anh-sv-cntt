"use client";

import { useEffect, useRef } from "react";
import { Keyboard, Send, RotateCcw } from "lucide-react";

interface FallbackTextInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  isMicDenied?: boolean;
}

export function FallbackTextInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  autoFocus = false,
  isMicDenied = false,
}: FallbackTextInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim().length > 0 && !disabled) {
        onSubmit();
      }
    }
  };

  return (
    <div className="bg-white border-2 border-ink rounded-2xl p-4 sm:p-5 shadow-hard space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
          <Keyboard className="w-4 h-4 text-accent" />
          <span>
            {isMicDenied
              ? "Chế độ gõ văn bản (Microphone bị từ chối)"
              : "Hoặc gõ / chỉnh sửa câu trả lời bằng tiếng Anh:"}
          </span>
        </div>
        <span className="text-[11px] font-mono text-ink-muted">
          {wordCount} từ
        </span>
      </div>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={3}
        placeholder="Gõ câu trả lời của bạn bằng tiếng Anh tại đây (hoặc nói bằng micro để văn bản tự điền vào)..."
        className="w-full p-3 text-sm bg-paper border-2 border-ink rounded-xl text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent resize-none transition-colors"
      />

      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={() => onChange("")}
          disabled={!value || disabled}
          className="text-xs text-ink-muted hover:text-ink disabled:opacity-40 flex items-center gap-1 py-1"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Xóa chữ</span>
        </button>

        <button
          type="button"
          onClick={onSubmit}
          disabled={!value.trim() || disabled}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-ink text-white font-medium text-xs border-2 border-ink shadow-hard-sm hover:bg-ink-muted shadow-hard-press disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <span>Gửi câu trả lời</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}


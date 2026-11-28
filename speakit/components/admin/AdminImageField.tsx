"use client";

import { useId, useRef, useState, type ChangeEvent } from "react";
import {
  AlertCircle,
  Image as ImageIcon,
  Link2,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";

type ImageFieldMode = "url" | "upload" | "generate";

export interface AdminImageFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  allowGenerate?: boolean;
  placeholder?: string;
  contextHint?: string;
}

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function isValidImagePath(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  return /^https:\/\//i.test(trimmed) || trimmed.startsWith("/");
}

export function AdminImageField({
  label,
  value,
  onChange,
  allowGenerate = true,
  placeholder = "https://... hoặc /research-covers/...",
  contextHint,
}: AdminImageFieldProps) {
  const fieldId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<ImageFieldMode>("url");
  const [prompt, setPrompt] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewBroken, setPreviewBroken] = useState(false);

  const handleModeChange = (nextMode: ImageFieldMode) => {
    setMode(nextMode);
    setError(null);
  };

  const handleUrlChange = (nextValue: string) => {
    setError(null);
    setPreviewBroken(false);
    onChange(nextValue);
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || isBusy) return;

    if (!ALLOWED_TYPES.has(file.type)) {
      setError("Chỉ hỗ trợ ảnh định dạng PNG, JPEG hoặc WebP.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("Ảnh vượt quá dung lượng tối đa 8MB.");
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/research-cover-upload", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        url?: string;
        error?: string;
      } | null;

      if (!res.ok || !data?.ok || !data.url) {
        setError(data?.error || "Không thể tải ảnh lên. Vui lòng thử lại.");
        return;
      }

      setPreviewBroken(false);
      onChange(data.url);
    } catch {
      setError("Mất kết nối máy chủ khi tải ảnh lên.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || isBusy) return;
    if (trimmed.length > 500) {
      setError("Prompt tối đa 500 ký tự.");
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/research-cover-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        url?: string;
        error?: string;
      } | null;

      if (!res.ok || !data?.ok || !data.url) {
        setError(data?.error || "Không thể tạo ảnh bằng AI. Vui lòng thử lại.");
        return;
      }

      setPreviewBroken(false);
      onChange(data.url);
    } catch {
      setError("Mất kết nối máy chủ khi tạo ảnh AI.");
    } finally {
      setIsBusy(false);
    }
  };

  const showPreview = isValidImagePath(value);

  return (
    <div className="liquid-glass-card-lite p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label
          htmlFor={`${fieldId}-url`}
          className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5"
        >
          <ImageIcon className="w-4 h-4 text-[var(--accent-primary)]" aria-hidden="true" />
          <span>{label}</span>
        </label>

        <div
          role="tablist"
          aria-label="Chế độ chọn ảnh bìa"
          className="inline-flex rounded-lg p-0.5 bg-[var(--surface-input)] border border-[var(--border-input)]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "url"}
            onClick={() => handleModeChange("url")}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors flex items-center gap-1 ${
              mode === "url"
                ? "bg-[var(--accent-primary)] text-white shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Dán URL</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={mode === "upload"}
            onClick={() => handleModeChange("upload")}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors flex items-center gap-1 ${
              mode === "upload"
                ? "bg-[var(--accent-primary)] text-white shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Tải ảnh</span>
          </button>

          {allowGenerate && (
            <button
              type="button"
              role="tab"
              aria-selected={mode === "generate"}
              onClick={() => handleModeChange("generate")}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors flex items-center gap-1 ${
                mode === "generate"
                  ? "bg-[var(--accent-primary)] text-white shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Tạo AI</span>
            </button>
          )}
        </div>
      </div>

      {mode === "url" && (
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <input
              id={`${fieldId}-url`}
              type="text"
              value={value}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder={placeholder}
              className="flex-1 rounded-lg px-3 py-2 text-sm bg-[var(--surface-input)] border border-[var(--border-input)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
            {value.trim() && (
              <button
                type="button"
                onClick={() => handleUrlChange("")}
                aria-label="Xóa đường dẫn ảnh"
                className="px-2.5 py-2 rounded-lg border border-[var(--border-input)] text-[var(--text-secondary)] hover:text-[var(--color-danger)] transition-colors"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
          {value.trim() && !isValidImagePath(value) && (
            <p className="text-xs text-[var(--color-warning)]">
              Đường dẫn nên bắt đầu bằng https:// hoặc /research-covers/...
            </p>
          )}
        </div>
      )}

      {mode === "upload" && (
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            id={`${fieldId}-file`}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            disabled={isBusy}
            className="sr-only"
          />
          <button
            type="button"
            disabled={isBusy}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white disabled:opacity-60 transition-colors"
          >
            {isBusy ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="w-4 h-4" aria-hidden="true" />
            )}
            <span>{isBusy ? "Đang tải lên..." : "Chọn ảnh PNG, JPEG, WebP"}</span>
          </button>
          <span className="text-xs text-[var(--text-muted)]">Tối đa 8MB</span>
        </div>
      )}

      {mode === "generate" && allowGenerate && (
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id={`${fieldId}-prompt`}
              type="text"
              maxLength={500}
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleGenerate();
                }
              }}
              placeholder="Mô tả ảnh bìa (VD: kỹ sư phần mềm thuyết trình trong studio hiện đại)"
              disabled={isBusy}
              className="flex-1 rounded-lg px-3 py-2 text-sm bg-[var(--surface-input)] border border-[var(--border-input)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
            <button
              type="button"
              disabled={isBusy || !prompt.trim()}
              onClick={() => void handleGenerate()}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white disabled:opacity-60 transition-colors shrink-0"
            >
              {isBusy ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="w-4 h-4" aria-hidden="true" />
              )}
              <span>{isBusy ? "Đang tạo ảnh..." : "Tạo ảnh bằng prompt"}</span>
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => {
                const topic = contextHint?.trim() || "kỹ sư phần mềm giao tiếp tiếng Anh CNTT trong văn phòng công nghệ";
                setPrompt(`Minh họa biên tập phẳng hiện đại về chủ đề: ${topic}`);
                setError(null);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[var(--border-input)] bg-[var(--surface-input)] text-[var(--text-primary)] hover:border-[var(--accent-primary)] font-semibold transition-colors"
            >
              <Sparkles className="w-3 h-3" aria-hidden="true" />
              <span>Gợi ý prompt theo ngữ cảnh</span>
            </button>
            <span className="tabular-nums">{prompt.length}/500</span>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg px-3 py-2 text-sm bg-red-500/10 border border-red-500/30 text-[var(--color-danger)]"
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {showPreview && (
        <div className="relative overflow-hidden rounded-lg border border-[var(--border-glass)] bg-[var(--surface-input)]">
          {!previewBroken ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value.trim()}
              alt={label}
              onError={() => setPreviewBroken(true)}
              className="w-full max-h-72 object-contain bg-slate-900/5 dark:bg-slate-950/40"
            />
          ) : (
            <div className="h-28 flex items-center justify-center text-xs text-[var(--text-muted)] px-3 text-center">
              Không thể tải xem trước ảnh từ đường dẫn này.
            </div>
          )}
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs bg-[var(--surface-glass)] border-t border-[var(--border-glass)]">
            <span className="truncate text-[var(--text-secondary)]">{value.trim()}</span>
            <button
              type="button"
              onClick={() => handleUrlChange("")}
              className="text-[var(--color-danger)] hover:underline shrink-0 font-semibold"
            >
              Gỡ ảnh
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

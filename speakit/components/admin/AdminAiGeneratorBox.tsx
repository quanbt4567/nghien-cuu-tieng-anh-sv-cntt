"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AlertCircle, CheckCircle2, Info, Loader2, Sparkles } from "lucide-react";
import type { BugBusterChallenge, ITRole } from "../../lib/types";

export type AdminGenerateKind = "scenario" | "vocabulary" | "bug_challenge";

export interface AdminAiGenerateMeta {
  mode: "ai" | "template";
  provider: string;
}

export interface AdminAiGeneratorBoxProps {
  kind: AdminGenerateKind;
  role?: ITRole | "";
  category?: BugBusterChallenge["category"];
  placeholder: string;
  quickTopics: string[];
  onGenerated: (draft: unknown, meta: AdminAiGenerateMeta) => void;
  onUnauthorized: () => void;
  autoFocus?: boolean;
  focusKey?: number;
}

interface GenerateApiResponse {
  ok?: boolean;
  error?: string;
  mode?: "ai" | "template";
  provider?: string;
  draft?: unknown;
}

export function AdminAiGeneratorBox({
  kind,
  role,
  category,
  placeholder,
  quickTopics,
  onGenerated,
  onUnauthorized,
  autoFocus = false,
  focusKey = 0,
}: AdminAiGeneratorBoxProps) {
  const [topic, setTopic] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMeta, setLastMeta] = useState<AdminAiGenerateMeta | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (autoFocus || focusKey > 0) {
      inputRef.current?.focus();
    }
  }, [autoFocus, focusKey]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleGenerate = async () => {
    const trimmedTopic = topic.trim();
    if (!trimmedTopic || isGenerating) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsGenerating(true);
    setError(null);

    const payload: {
      kind: AdminGenerateKind;
      topic: string;
      role?: ITRole | "";
      category?: BugBusterChallenge["category"];
    } = {
      kind,
      topic: trimmedTopic,
    };
    if (role !== undefined) payload.role = role;
    if (category !== undefined) payload.category = category;

    try {
      const res = await fetch("/api/admin/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (res.status === 401) {
        onUnauthorized();
        return;
      }

      const data = (await res.json().catch(() => null)) as GenerateApiResponse | null;
      if (!res.ok || !data?.ok || !data.draft) {
        setLastMeta(null);
        setError(data?.error || "Không thể tạo bản nháp AI. Vui lòng thử lại.");
        return;
      }

      const meta: AdminAiGenerateMeta = {
        mode: data.mode === "ai" ? "ai" : "template",
        provider: typeof data.provider === "string" && data.provider ? data.provider : "local",
      };
      setLastMeta(meta);
      onGenerated(data.draft, meta);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      setLastMeta(null);
      setError("Mất kết nối máy chủ khi tạo nội dung AI. Vui lòng thử lại.");
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      if (!event.nativeEvent.isComposing) {
        void handleGenerate();
      }
    }
  };

  const handleChipClick = (chip: string) => {
    setTopic(chip);
    setError(null);
    inputRef.current?.focus();
  };

  return (
    <div className="p-4 rounded-2xl bg-white/85 border border-slate-200/85 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-sky-600 shrink-0" aria-hidden="true" />
          <span className="text-xs font-bold text-slate-900">
            Trợ lý AI soạn thảo nhanh
          </span>
        </div>
        <span className="text-[11px] font-mono text-slate-600">
          Tạo nháp tự động rồi chỉnh sửa trước khi lưu
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5">
        <input
          ref={inputRef}
          type="text"
          value={topic}
          disabled={isGenerating}
          onChange={(e) => {
            setTopic(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="Chủ đề tạo nội dung bằng AI"
          className="liquid-glass-input flex-1 min-w-0 px-3.5 py-2 text-xs sm:text-sm rounded-xl disabled:opacity-60"
        />

        <button
          type="button"
          disabled={!topic.trim() || isGenerating}
          onClick={() => void handleGenerate()}
          className="liquid-btn-primary inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all disabled:opacity-50 shrink-0"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              <span>Đang tạo...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Tạo bằng AI</span>
            </>
          )}
        </button>
      </div>

      {quickTopics.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-mono text-slate-600 mr-1">
            Gợi ý nhanh:
          </span>
          {quickTopics.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={isGenerating}
              onClick={() => handleChipClick(chip)}
              className="liquid-glass-btn px-2.5 py-1 rounded-full text-[11px] disabled:opacity-50"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 px-3 py-2 rounded-xl bg-rose-50/90 border border-rose-300/80 text-xs text-rose-800"
        >
          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {lastMeta && !error && (
        <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] text-slate-700">
          {lastMeta.mode === "ai" ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100/90 border border-emerald-300/80 font-mono font-semibold text-emerald-800">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" aria-hidden="true" />
              <span>AI: {lastMeta.provider}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100/90 border border-amber-300/80 font-mono font-semibold text-amber-800">
              <Info className="w-3 h-3 text-amber-600" aria-hidden="true" />
              <span>Mẫu gợi ý cục bộ (chưa có AI key / fallback)</span>
            </span>
          )}
          <span>Hãy kiểm tra và chỉnh sửa lại các trường bên dưới trước khi bấm lưu.</span>
        </div>
      )}
    </div>
  );
}

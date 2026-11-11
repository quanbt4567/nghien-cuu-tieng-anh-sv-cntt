"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Gamepad2,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { BUG_BUSTER_CHALLENGES } from "../../data/minigames";
import { mergeBugChallenges } from "../../lib/contentStore";
import type { AdminContentOverrides, BugBusterChallenge } from "../../lib/types";
import { AdminAiGeneratorBox, type AdminAiGenerateMeta } from "./AdminAiGeneratorBox";
import { persistAdminOverrides } from "./adminShared";

interface AdminArenaTabProps {
  overrides: AdminContentOverrides;
  onOverridesChange: (next: AdminContentOverrides) => void;
  onUnauthorized: () => void;
}

const BASE_CHALLENGE_IDS = new Set(BUG_BUSTER_CHALLENGES.map((c) => c.id));
const VALID_CATEGORIES = new Set<BugBusterChallenge["category"]>([
  "error-log",
  "code-review",
  "incident",
]);
const ARENA_QUICK_TOPICS = [
  "database deadlock in transaction",
  "memory leak in Node.js worker",
  "CORS preflight failure",
];

const CATEGORY_OPTIONS: Array<{
  value: BugBusterChallenge["category"];
  label: string;
}> = [
  { value: "incident", label: "Incident (Sự cố)" },
  { value: "error-log", label: "Error Log (Nhật ký lỗi)" },
  { value: "code-review", label: "Code Review" },
];

function splitCommaList(value: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of value.split(",")) {
    const trimmed = part.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      out.push(trimmed);
    }
  }
  return out;
}

function PromptBlankPreview({
  promptWithBlank,
  targetWord,
}: {
  promptWithBlank: string;
  targetWord: string;
}) {
  if (!promptWithBlank.includes("____")) {
    return (
      <span className="text-ink-muted italic">
        Chưa có chỗ trống <code className="font-mono text-accent">____</code> trong câu hỏi.
      </span>
    );
  }
  const parts = promptWithBlank.split("____");
  return (
    <span>
      {parts.map((part, idx) => (
        <span key={idx}>
          {part}
          {idx < parts.length - 1 && (
            <span className="inline-flex items-center px-2 py-0.5 mx-1 rounded-md bg-accent-light border border-accent/50 font-mono font-bold text-ink text-xs">
              {targetWord.trim() || "____"}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

export function AdminArenaTab({
  overrides,
  onOverridesChange,
  onUnauthorized,
}: AdminArenaTabProps) {
  const challenges = useMemo(
    () => mergeBugChallenges(BUG_BUSTER_CHALLENGES, overrides),
    [overrides]
  );

  const customIds = useMemo(
    () => new Set(overrides.customBugChallenges.map((c) => c.id)),
    [overrides.customBugChallenges]
  );

  const hasChallengeOverrides =
    overrides.customBugChallenges.length > 0 ||
    overrides.deletedChallengeIds.length > 0;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [aiFocusKey, setAiFocusKey] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [category, setCategory] =
    useState<BugBusterChallenge["category"]>("incident");
  const [promptWithBlank, setPromptWithBlank] = useState("");
  const [targetWord, setTargetWord] = useState("");
  const [acceptedVariantsText, setAcceptedVariantsText] = useState("");
  const [contextVI, setContextVI] = useState("");
  const [phonetic, setPhonetic] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [statusNotice, setStatusNotice] = useState<{
    tone: "ok" | "warn" | "error";
    text: string;
  } | null>(null);

  const resetForm = () => {
    setIsFormOpen(false);
    setAiFocusKey(0);
    setEditingId(null);
    setCategory("incident");
    setPromptWithBlank("");
    setTargetWord("");
    setAcceptedVariantsText("");
    setContextVI("");
    setPhonetic("");
  };

  const openCreate = () => {
    setAiFocusKey(0);
    setEditingId(null);
    setCategory("incident");
    setPromptWithBlank("");
    setTargetWord("");
    setAcceptedVariantsText("");
    setContextVI("");
    setPhonetic("");
    setStatusNotice(null);
    setIsFormOpen(true);
  };

  const openCreateWithAi = () => {
    openCreate();
    setAiFocusKey((k) => k + 1);
  };

  const openEdit = (challenge: BugBusterChallenge) => {
    setAiFocusKey(0);
    setEditingId(challenge.id);
    setCategory(challenge.category);
    setPromptWithBlank(challenge.promptEN);
    setTargetWord(challenge.targetWord);
    setAcceptedVariantsText(challenge.acceptedVariants.join(", "));
    setContextVI(challenge.contextVI);
    setPhonetic(challenge.phonetic);
    setStatusNotice(null);
    setIsFormOpen(true);
  };

  const handleAiGenerated = (rawDraft: unknown, meta: AdminAiGenerateMeta) => {
    const draft = (rawDraft && typeof rawDraft === "object" ? rawDraft : {}) as {
      category?: unknown;
      promptEN?: unknown;
      targetWord?: unknown;
      acceptedVariants?: unknown;
      contextVI?: unknown;
      phonetic?: unknown;
    };

    if (
      typeof draft.category === "string" &&
      VALID_CATEGORIES.has(draft.category as BugBusterChallenge["category"])
    ) {
      setCategory(draft.category as BugBusterChallenge["category"]);
    }
    setPromptWithBlank(typeof draft.promptEN === "string" ? draft.promptEN.trim() : "");
    setTargetWord(typeof draft.targetWord === "string" ? draft.targetWord.trim() : "");
    setAcceptedVariantsText(
      Array.isArray(draft.acceptedVariants)
        ? draft.acceptedVariants
            .filter((v): v is string => typeof v === "string" && Boolean(v.trim()))
            .map((v) => v.trim())
            .join(", ")
        : ""
    );
    setContextVI(typeof draft.contextVI === "string" ? draft.contextVI.trim() : "");
    setPhonetic(typeof draft.phonetic === "string" ? draft.phonetic.trim() : "");

    setStatusNotice({
      tone: meta.mode === "ai" ? "ok" : "warn",
      text:
        meta.mode === "ai"
          ? `Đã tạo nháp thử thách từ AI (${meta.provider}). Vui lòng kiểm tra chỗ trống ____ và đáp án trước khi lưu.`
          : "Đã điền mẫu gợi ý cục bộ (chưa có AI key). Hãy kiểm tra chỗ trống ____ và chỉnh sửa trước khi lưu.",
    });
  };

  const saveOverrides = async (next: AdminContentOverrides, okText?: string) => {
    setIsSaving(true);
    const res = await persistAdminOverrides(next);
    setIsSaving(false);

    if (res.unauthorized) {
      onUnauthorized();
      return false;
    }

    onOverridesChange(res.overrides);
    setStatusNotice({
      tone: res.synced ? "ok" : "warn",
      text: res.synced && okText ? okText : res.message,
    });
    return true;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!promptWithBlank.includes("____")) {
      setStatusNotice({
        tone: "error",
        text: "Câu hỏi tiếng Anh bắt buộc phải chứa đúng ký hiệu chỗ trống 4 dấu gạch dưới: ____",
      });
      return;
    }
    if (!targetWord.trim()) {
      setStatusNotice({
        tone: "error",
        text: "Vui lòng nhập Từ khóa đáp án (targetWord).",
      });
      return;
    }

    const nextId =
      editingId ??
      `bb_custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;

    const nextChallenge: BugBusterChallenge = {
      id: nextId,
      category,
      promptEN: promptWithBlank.trim(),
      targetWord: targetWord.trim(),
      acceptedVariants: splitCommaList(acceptedVariantsText),
      contextVI: contextVI.trim(),
      phonetic: phonetic.trim(),
    };

    const nextOverrides: AdminContentOverrides = {
      ...overrides,
      customBugChallenges: [
        ...overrides.customBugChallenges.filter((c) => c.id !== nextId),
        nextChallenge,
      ],
      deletedChallengeIds: overrides.deletedChallengeIds.filter((x) => x !== nextId),
    };

    const done = await saveOverrides(
      nextOverrides,
      editingId
        ? `Đã cập nhật thử thách "${nextChallenge.targetWord}".`
        : `Đã thêm thử thách Bug Buster mới "${nextChallenge.targetWord}".`
    );
    if (done) {
      resetForm();
    }
  };

  const handleDelete = async (challenge: BugBusterChallenge) => {
    const isBase = BASE_CHALLENGE_IDS.has(challenge.id);
    const nextOverrides: AdminContentOverrides = {
      ...overrides,
      customBugChallenges: overrides.customBugChallenges.filter(
        (c) => c.id !== challenge.id
      ),
      deletedChallengeIds: isBase
        ? Array.from(new Set([...overrides.deletedChallengeIds, challenge.id]))
        : overrides.deletedChallengeIds,
    };
    if (editingId === challenge.id) {
      resetForm();
    }
    await saveOverrides(
      nextOverrides,
      `Đã xóa thử thách "${challenge.targetWord}".`
    );
  };

  const handleRestoreDefaults = async () => {
    resetForm();
    await saveOverrides(
      {
        ...overrides,
        customBugChallenges: [],
        deletedChallengeIds: [],
      },
      "Đã khôi phục toàn bộ thử thách Bug Buster về mặc định."
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-ink flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-accent" aria-hidden="true" />
            <span>Quản Lý Arena Bug Buster ({challenges.length})</span>
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Tạo và chỉnh sửa thử thách điền khuyết từ vựng lỗi kỹ thuật với chỗ trống{" "}
            <code className="font-mono text-accent">____</code> và phiên âm IPA.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {hasChallengeOverrides && (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleRestoreDefaults}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-pill bg-white border border-ink/20 text-xs font-medium text-ink hover:bg-paper-muted transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Khôi phục mặc định</span>
            </button>
          )}
          {!isFormOpen && (
            <button
              type="button"
              onClick={openCreateWithAi}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-pill bg-white border border-ink/20 text-xs font-semibold text-ink hover:bg-paper-muted transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
              <span>Tạo bằng AI</span>
            </button>
          )}
          <button
            type="button"
            onClick={isFormOpen ? resetForm : openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-ink text-white text-xs font-semibold hover:bg-ink/90 shadow-soft shadow-hard-press transition-all"
          >
            {isFormOpen ? (
              <>
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Đóng biểu mẫu</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Thêm thử thách</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Feedback Notice */}
      {statusNotice && (
        <div
          role={statusNotice.tone === "error" ? "alert" : "status"}
          className={`flex items-start gap-2.5 p-3.5 rounded-2xl border text-xs ${
            statusNotice.tone === "error"
              ? "bg-accent-light border-accent/40 text-ink"
              : statusNotice.tone === "warn"
              ? "bg-paper-muted border-ink/25 text-ink"
              : "bg-white border-ink/20 text-ink shadow-soft"
          }`}
        >
          {statusNotice.tone === "ok" ? (
            <CheckCircle2 className="w-4 h-4 text-ink shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <AlertCircle className="w-4 h-4 text-accent shrink-0 mt-0.5" aria-hidden="true" />
          )}
          <span>{statusNotice.text}</span>
        </div>
      )}

      {/* Create / Edit Form */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-ink/20 rounded-2xl p-5 sm:p-6 shadow-soft space-y-4"
        >
          <div className="flex items-center justify-between border-b border-ink/10 pb-3">
            <h3 className="text-base font-bold text-ink">
              {editingId ? `Chỉnh sửa thử thách (${editingId})` : "Thêm thử thách Bug Buster mới"}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="text-xs font-mono text-ink-muted hover:text-ink"
            >
              Hủy
            </button>
          </div>

          <AdminAiGeneratorBox
            key={editingId ?? "create"}
            kind="bug_challenge"
            category={category}
            placeholder="VD: database deadlock, N+1 query bottleneck, memory leak..."
            quickTopics={ARENA_QUICK_TOPICS}
            onGenerated={handleAiGenerated}
            onUnauthorized={onUnauthorized}
            autoFocus={aiFocusKey > 0}
            focusKey={aiFocusKey}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-semibold text-ink-muted">
                Nhóm tình huống (category)
              </label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as BugBusterChallenge["category"])
                }
                className="w-full px-3.5 py-2 text-sm font-mono bg-paper border border-ink/20 rounded-xl text-ink focus:outline-none focus:border-accent"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-semibold text-ink-muted">
                Đáp án chính (targetWord) *
              </label>
              <input
                type="text"
                value={targetWord}
                onChange={(e) => setTargetWord(e.target.value)}
                placeholder="VD: deadlock"
                className="w-full px-3.5 py-2 text-sm font-mono bg-paper border border-ink/20 rounded-xl text-ink focus:outline-none focus:border-accent"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-semibold text-ink-muted">
                Phiên âm IPA (phonetic)
              </label>
              <input
                type="text"
                value={phonetic}
                onChange={(e) => setPhonetic(e.target.value)}
                placeholder="VD: /ˈded.lɑːk/"
                className="w-full px-3.5 py-2 text-sm font-ipa bg-paper border border-ink/20 rounded-xl text-ink focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-mono font-semibold text-ink-muted">
              Câu tình huống chứa chỗ trống ____ (promptWithBlank) *
            </label>
            <textarea
              rows={2}
              value={promptWithBlank}
              onChange={(e) => setPromptWithBlank(e.target.value)}
              placeholder="[ERROR] Two transactions waited on each other indefinitely, causing a database ____."
              className="w-full px-3.5 py-2 text-sm bg-paper border border-ink/20 rounded-xl text-ink focus:outline-none focus:border-accent"
            />
          </div>

          {/* Live visual preview */}
          <div className="p-3.5 rounded-xl bg-paper border border-ink/15 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-ink-muted">
              <span>Xem trước hiển thị chỗ trống:</span>
              {phonetic && <span className="font-ipa text-accent">{phonetic}</span>}
            </div>
            <div className="text-xs text-ink leading-relaxed">
              <PromptBlankPreview
                promptWithBlank={promptWithBlank}
                targetWord={targetWord}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-semibold text-ink-muted">
                Biến thể chấp nhận (phân tách dấu phẩy)
              </label>
              <input
                type="text"
                value={acceptedVariantsText}
                onChange={(e) => setAcceptedVariantsText(e.target.value)}
                placeholder="dead lock, deadlocks, deadlocked"
                className="w-full px-3.5 py-2 text-xs font-mono bg-paper border border-ink/20 rounded-xl text-ink focus:outline-none focus:border-accent"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-semibold text-ink-muted">
                Giải thích ngữ cảnh tiếng Việt (contextVI)
              </label>
              <input
                type="text"
                value={contextVI}
                onChange={(e) => setContextVI(e.target.value)}
                placeholder="Tình trạng hai tiến trình khóa chéo tài nguyên của nhau."
                className="w-full px-3.5 py-2 text-xs bg-paper border border-ink/20 rounded-xl text-ink focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 rounded-pill bg-white border border-ink/20 text-xs font-medium text-ink hover:bg-paper-muted"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-pill bg-accent text-white text-xs font-semibold hover:bg-accent-hover shadow-soft shadow-hard-press transition-all disabled:opacity-60"
            >
              {isSaving ? "Đang lưu..." : editingId ? "Lưu thử thách" : "Thêm & đồng bộ"}
            </button>
          </div>
        </form>
      )}

      {/* Challenges List */}
      <div className="grid grid-cols-1 gap-4">
        {challenges.map((challenge) => {
          const isBase = BASE_CHALLENGE_IDS.has(challenge.id);
          const isOverridden = customIds.has(challenge.id);

          return (
            <div
              key={challenge.id}
              className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              <div className="space-y-2 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-pill bg-paper border border-ink/15 text-[10px] font-mono uppercase text-ink-muted">
                    {challenge.category}
                  </span>
                  <span className="font-mono font-bold text-sm text-ink">
                    {challenge.targetWord}
                  </span>
                  <span className="text-sm font-ipa text-accent font-medium">
                    {challenge.phonetic || "/.../"}
                  </span>
                  {!isBase ? (
                    <span className="px-2 py-0.5 rounded-pill bg-accent-light border border-accent/30 text-[10px] font-mono font-semibold text-ink">
                      Tùy chỉnh
                    </span>
                  ) : isOverridden ? (
                    <span className="px-2 py-0.5 rounded-pill bg-paper-muted border border-ink/20 text-[10px] font-mono font-semibold text-ink">
                      Đã sửa
                    </span>
                  ) : null}
                </div>

                <div className="text-sm text-ink leading-relaxed bg-paper/70 border border-ink/10 rounded-xl p-3">
                  <PromptBlankPreview
                    promptWithBlank={challenge.promptEN}
                    targetWord={challenge.targetWord}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                  {challenge.contextVI && <span>{challenge.contextVI}</span>}
                  {challenge.acceptedVariants.length > 0 && (
                    <span className="font-mono text-[11px] text-ink-faint">
                      Biến thể: {challenge.acceptedVariants.join(", ")}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => openEdit(challenge)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white border border-ink/20 text-xs font-medium text-ink hover:bg-paper-muted transition-colors disabled:opacity-50"
                >
                  <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Sửa</span>
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleDelete(challenge)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-accent-light border border-accent/40 text-xs font-medium text-ink hover:bg-accent hover:text-white transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Xóa</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

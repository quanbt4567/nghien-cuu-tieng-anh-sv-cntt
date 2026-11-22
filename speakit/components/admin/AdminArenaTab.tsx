"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { BUG_BUSTER_CHALLENGES } from "../../data/minigames";
import { computeArenaBulkDeleteOverrides } from "../../lib/adminBulkDelete";
import { mergeBugChallenges } from "../../lib/contentStore";
import type { AdminContentOverrides, BugBusterChallenge } from "../../lib/types";
import { AdminAiGeneratorBox, type AdminAiGenerateMeta } from "./AdminAiGeneratorBox";
import {
  AdminBulkActionBar,
  AdminDeleteConfirmModal,
  type DeleteConfirmRequest,
} from "./AdminDeleteConfirmModal";
import { persistAdminOverrides } from "./adminShared";

interface AdminArenaTabProps {
  overrides: AdminContentOverrides;
  onOverridesChange: (next: AdminContentOverrides) => void;
  onUnauthorized: () => void;
}

const PAGE_SIZE = 10;
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

const CATEGORY_FILTER_TABS: Array<{
  value: "all" | BugBusterChallenge["category"];
  label: string;
}> = [
  { value: "all", label: "Tất cả" },
  { value: "error-log", label: "error-log" },
  { value: "code-review", label: "code-review" },
  { value: "incident", label: "incident" },
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
      <span className="text-slate-400 italic">
        Chưa có chỗ trống <code className="font-mono text-cyan-300">____</code> trong câu hỏi.
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
            <span className="inline-flex items-center px-1.5 py-0.5 mx-1 rounded bg-cyan-500/20 border border-cyan-400/50 font-mono font-bold text-cyan-200 text-xs">
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

  const [activeSubTab, setActiveSubTab] = useState<"list" | "create">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<
    "all" | BugBusterChallenge["category"]
  >("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteRequest, setDeleteRequest] = useState<DeleteConfirmRequest | null>(null);

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

  const filteredChallenges = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return challenges.filter((c) => {
      if (categoryFilter !== "all" && c.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        c.targetWord.toLowerCase().includes(q) ||
        c.promptEN.toLowerCase().includes(q) ||
        c.contextVI.toLowerCase().includes(q) ||
        c.acceptedVariants.some((v) => v.toLowerCase().includes(q))
      );
    });
  }, [challenges, categoryFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredChallenges.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedChallenges = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredChallenges.slice(start, start + PAGE_SIZE);
  }, [filteredChallenges, safePage]);

  const resetForm = () => {
    setActiveSubTab("list");
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
    setActiveSubTab("create");
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
    setActiveSubTab("create");
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

  const selectedChallenges = useMemo(
    () => challenges.filter((c) => selectedIds.has(c.id)),
    [challenges, selectedIds]
  );

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pageIds = paginatedChallenges.map((c) => c.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));

  const toggleSelectPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const id of pageIds) next.delete(id);
      } else {
        for (const id of pageIds) next.add(id);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const c of filteredChallenges) next.add(c.id);
      return next;
    });
  };

  const executeDeleteChallenges = async (
    targets: BugBusterChallenge[],
    label: string
  ) => {
    if (targets.length === 0) return false;
    const nextOverrides = computeArenaBulkDeleteOverrides(
      overrides,
      targets,
      BASE_CHALLENGE_IDS
    );
    const removedSet = new Set(targets.map((c) => c.id));
    if (editingId && removedSet.has(editingId)) {
      resetForm();
    }
    const ok = await saveOverrides(nextOverrides, label);
    if (ok) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        targets.forEach((c) => next.delete(c.id));
        return next;
      });
    }
    return ok;
  };

  const handleDelete = (challenge: BugBusterChallenge) => {
    setDeleteRequest({
      title: `Bạn có chắc chắn muốn xóa thử thách "${challenge.targetWord}"?`,
      description: BASE_CHALLENGE_IDS.has(challenge.id)
        ? "Thử thách mặc định này sẽ bị ẩn khỏi chế độ Arena Bug Buster."
        : "Thử thách tùy chỉnh này sẽ bị xóa vĩnh viễn khỏi Arena.",
      itemCount: 1,
      itemPreviewLabels: [challenge.targetWord],
      confirmButtonLabel: "Xóa thử thách",
      onConfirm: () =>
        executeDeleteChallenges(
          [challenge],
          `Đã xóa thử thách "${challenge.targetWord}".`
        ),
    });
  };

  const handleBulkDelete = () => {
    if (selectedChallenges.length === 0) return;
    const count = selectedChallenges.length;
    setDeleteRequest({
      title: `Bạn có chắc chắn muốn xóa ${count} thử thách đã chọn?`,
      description:
        "Các thử thách tùy chỉnh sẽ bị xóa vĩnh viễn; các thử thách mặc định sẽ bị ẩn khỏi Arena.",
      itemCount: count,
      itemPreviewLabels: selectedChallenges.map((c) => c.targetWord),
      confirmButtonLabel: `Xóa ${count} thử thách`,
      onConfirm: () =>
        executeDeleteChallenges(
          selectedChallenges,
          `Đã xóa hàng loạt ${count} thử thách Arena.`
        ),
    });
  };

  const handleRestoreDefaults = () => {
    setDeleteRequest({
      title: "Khôi phục toàn bộ thử thách Bug Buster về mặc định?",
      description:
        "Mọi thử thách tùy chỉnh bạn đã thêm sẽ bị xóa và các thử thách gốc sẽ được hiện lại.",
      itemCount: Math.max(
        1,
        overrides.customBugChallenges.length + overrides.deletedChallengeIds.length
      ),
      confirmButtonLabel: "Khôi phục mặc định",
      onConfirm: async () => {
        resetForm();
        const ok = await saveOverrides(
          {
            ...overrides,
            customBugChallenges: [],
            deletedChallengeIds: [],
          },
          "Đã khôi phục toàn bộ thử thách Bug Buster về mặc định."
        );
        if (ok) setSelectedIds(new Set());
        return ok;
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="liquid-glass-card p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Gamepad2 className="w-5 h-5 text-cyan-300 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="text-base font-bold text-white">
              Quản Lý Arena Bug Buster ({challenges.length})
            </h2>
            <p className="text-xs text-slate-300">
              Điền khuyết từ vựng lỗi kỹ thuật với chỗ trống{" "}
              <code className="font-mono text-cyan-300">____</code> và phiên âm IPA.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full bg-slate-950/60 p-1 border border-white/15">
            <button
              type="button"
              onClick={() => setActiveSubTab("list")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                activeSubTab === "list"
                  ? "bg-cyan-500/25 border border-cyan-400/55 text-cyan-100"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Danh sách thử thách Bug Buster ({challenges.length})
            </button>
            <button
              type="button"
              onClick={() => {
                if (activeSubTab !== "create") {
                  openCreate();
                }
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                activeSubTab === "create"
                  ? "bg-cyan-500/25 border border-cyan-400/55 text-cyan-100"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>+ Thêm mới / AI Tạo nhanh</span>
            </button>
          </div>

          {activeSubTab === "list" && (
            <button
              type="button"
              onClick={openCreateWithAi}
              className="liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-300" aria-hidden="true" />
              <span>AI Tạo nhanh</span>
            </button>
          )}

          {hasChallengeOverrides && (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleRestoreDefaults}
              className="liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Khôi phục mặc định</span>
            </button>
          )}
        </div>
      </div>

      {statusNotice && (
        <div
          role={statusNotice.tone === "error" ? "alert" : "status"}
          className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs ${
            statusNotice.tone === "error"
              ? "bg-rose-500/20 border-rose-400/45 text-rose-100"
              : statusNotice.tone === "warn"
              ? "bg-amber-500/20 border-amber-400/45 text-amber-100"
              : "bg-emerald-500/20 border-emerald-400/45 text-emerald-100"
          }`}
        >
          {statusNotice.tone === "ok" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" aria-hidden="true" />
          )}
          <span>{statusNotice.text}</span>
        </div>
      )}

      {activeSubTab === "create" ? (
        <form
          onSubmit={handleSubmit}
          className="liquid-glass-card p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-white/15 pb-3">
            <h3 className="text-sm font-bold text-white">
              {editingId ? `Chỉnh sửa thử thách (${editingId})` : "Thêm thử thách Bug Buster mới"}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="text-xs font-mono text-slate-300 hover:text-white"
            >
              Quay lại danh sách
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="space-y-1">
              <label className="block text-xs font-mono font-semibold text-slate-300">
                Nhóm tình huống (category)
              </label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as BugBusterChallenge["category"])
                }
                className="liquid-glass-input w-full px-3 py-2 text-sm font-mono rounded-xl [&>option]:bg-slate-950 [&>option]:text-white"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-mono font-semibold text-slate-300">
                Đáp án chính (targetWord) *
              </label>
              <input
                type="text"
                value={targetWord}
                onChange={(e) => setTargetWord(e.target.value)}
                placeholder="VD: deadlock"
                className="liquid-glass-input w-full px-3 py-2 text-sm font-mono rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-mono font-semibold text-slate-300">
                Phiên âm IPA (phonetic)
              </label>
              <input
                type="text"
                value={phonetic}
                onChange={(e) => setPhonetic(e.target.value)}
                placeholder="VD: /ˈded.lɑːk/"
                className="liquid-glass-input w-full px-3 py-2 text-sm font-ipa rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-mono font-semibold text-slate-300">
              Câu tình huống chứa chỗ trống ____ (promptWithBlank) *
            </label>
            <textarea
              rows={2}
              value={promptWithBlank}
              onChange={(e) => setPromptWithBlank(e.target.value)}
              placeholder="[ERROR] Two transactions waited on each other indefinitely, causing a database ____."
              className="liquid-glass-input w-full px-3 py-2 text-sm rounded-xl"
            />
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-white/15 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Xem trước hiển thị chỗ trống:</span>
              {phonetic && <span className="font-ipa text-cyan-300">{phonetic}</span>}
            </div>
            <div className="text-xs text-slate-100 leading-relaxed">
              <PromptBlankPreview
                promptWithBlank={promptWithBlank}
                targetWord={targetWord}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="block text-xs font-mono font-semibold text-slate-300">
                Biến thể chấp nhận (phân tách dấu phẩy)
              </label>
              <input
                type="text"
                value={acceptedVariantsText}
                onChange={(e) => setAcceptedVariantsText(e.target.value)}
                placeholder="dead lock, deadlocks, deadlocked"
                className="liquid-glass-input w-full px-3 py-2 text-xs font-mono rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-mono font-semibold text-slate-300">
                Giải thích ngữ cảnh tiếng Việt (contextVI)
              </label>
              <input
                type="text"
                value={contextVI}
                onChange={(e) => setContextVI(e.target.value)}
                placeholder="Tình trạng hai tiến trình khóa chéo tài nguyên của nhau."
                className="liquid-glass-input w-full px-3 py-2 text-xs rounded-xl"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={resetForm}
              className="liquid-glass-btn px-4 py-2 rounded-full text-xs font-medium"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="liquid-btn-primary px-5 py-2 rounded-full text-xs font-semibold disabled:opacity-60"
            >
              {isSaving ? "Đang lưu..." : editingId ? "Lưu thử thách" : "Thêm & đồng bộ"}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="liquid-glass-card p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Tìm theo từ khóa, câu lỗi hoặc nghĩa tiếng Việt..."
                className="liquid-glass-input w-full pl-9 pr-3 py-1.5 text-xs rounded-full"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {CATEGORY_FILTER_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(tab.value);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-mono font-semibold border transition-colors ${
                    categoryFilter === tab.value
                      ? "bg-cyan-500/25 border-cyan-400/55 text-cyan-100"
                      : "liquid-glass-btn text-slate-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <AdminBulkActionBar
            selectedCount={selectedChallenges.length}
            totalFilteredCount={filteredChallenges.length}
            allPageSelected={allPageSelected}
            pageCount={paginatedChallenges.length}
            itemUnitLabel="thử thách"
            disabled={isSaving}
            onToggleSelectPage={toggleSelectPage}
            onSelectAllFiltered={selectAllFiltered}
            onClearSelection={() => setSelectedIds(new Set())}
            onBulkDelete={handleBulkDelete}
          />

          {paginatedChallenges.length === 0 ? (
            <div className="liquid-glass-card p-8 text-center text-xs text-slate-300">
              Không tìm thấy thử thách Bug Buster nào khớp bộ lọc.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {paginatedChallenges.map((challenge) => {
                const isBase = BASE_CHALLENGE_IDS.has(challenge.id);
                const isOverridden = customIds.has(challenge.id);
                const isSelected = selectedIds.has(challenge.id);

                return (
                  <div
                    key={challenge.id}
                    className={`liquid-glass-card-lite p-3.5 flex flex-col justify-between gap-2.5 transition-colors ${
                      isSelected ? "!border-cyan-400/60 ring-1 ring-cyan-400/30" : ""
                    }`}
                  >
                    <div className="space-y-2 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectId(challenge.id)}
                            aria-label={`Chọn thử thách ${challenge.targetWord}`}
                            className="w-4 h-4 rounded accent-cyan-400 cursor-pointer shrink-0"
                          />
                          <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-mono uppercase text-slate-300">
                            {challenge.category}
                          </span>
                          <span className="font-mono font-bold text-xs text-white">
                            {challenge.targetWord}
                          </span>
                          <span className="text-xs font-ipa text-cyan-300 font-medium">
                            {challenge.phonetic || "/.../"}
                          </span>
                          {!isBase ? (
                            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/45 text-[10px] font-mono font-semibold text-cyan-100">
                              Tùy chỉnh
                            </span>
                          ) : isOverridden ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/45 text-[10px] font-mono font-semibold text-amber-100">
                              Đã sửa
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => openEdit(challenge)}
                            className="liquid-glass-btn inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium disabled:opacity-50"
                          >
                            <Pencil className="w-3 h-3" aria-hidden="true" />
                            <span>Sửa</span>
                          </button>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleDelete(challenge)}
                            className="liquid-btn-danger inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium disabled:opacity-50"
                          >
                            <Trash2 className="w-3 h-3" aria-hidden="true" />
                            <span>Xóa</span>
                          </button>
                        </div>
                      </div>

                      <div className="text-xs text-slate-100 leading-relaxed bg-slate-950/60 border border-white/10 rounded-lg p-2.5">
                        <PromptBlankPreview
                          promptWithBlank={challenge.promptEN}
                          targetWord={challenge.targetWord}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-slate-300 pt-1 border-t border-white/10">
                      <span className="truncate">{challenge.contextVI}</span>
                      {challenge.acceptedVariants.length > 0 && (
                        <span className="font-mono text-[10px] text-slate-400 shrink-0">
                          Biến thể: {challenge.acceptedVariants.join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="liquid-glass-card px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-slate-300 font-mono">
              Hiển thị {paginatedChallenges.length} / {filteredChallenges.length} thử thách · Trang{" "}
              {safePage} / {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="liquid-glass-btn inline-flex items-center gap-1 px-3 py-1 rounded-full font-semibold disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Trước</span>
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="liquid-glass-btn inline-flex items-center gap-1 px-3 py-1 rounded-full font-semibold disabled:opacity-40"
              >
                <span>Sau</span>
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminDeleteConfirmModal
        request={deleteRequest}
        onClose={() => setDeleteRequest(null)}
      />
    </div>
  );
}

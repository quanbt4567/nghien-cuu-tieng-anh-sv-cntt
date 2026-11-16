"use client";

import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { VOCABULARY_LIST } from "../../data/scenarios";
import { mergeVocabulary, saveLocalContentOverrides } from "../../lib/contentStore";
import { speakText } from "../../lib/speech";
import type { AdminContentOverrides, VocabularyItem } from "../../lib/types";
import { AdminAiGeneratorBox, type AdminAiGenerateMeta } from "./AdminAiGeneratorBox";
import { persistAdminOverrides } from "./adminShared";

interface AdminVocabTabProps {
  overrides: AdminContentOverrides;
  onOverridesChange: (next: AdminContentOverrides) => void;
  onUnauthorized: () => void;
}

type VocabSubTab = "list" | "form" | "io";
type VocabSourceFilter = "all" | "default" | "custom";

const BASE_VOCAB_IDS = new Set(VOCABULARY_LIST.map((v) => v.id));
const POS_OPTIONS = ["noun", "verb", "adjective", "phrase", "adverb"];
const VOCAB_QUICK_TOPICS = [
  "idempotency",
  "rate limiting",
  "zero-downtime deployment",
];
const VOCAB_PAGE_SIZE = 10;

export function AdminVocabTab({
  overrides,
  onOverridesChange,
  onUnauthorized,
}: AdminVocabTabProps) {
  const vocabList = useMemo(
    () => mergeVocabulary(VOCABULARY_LIST, overrides),
    [overrides]
  );

  const customIds = useMemo(
    () => new Set(overrides.customVocabulary.map((v) => v.id)),
    [overrides.customVocabulary]
  );

  const hasVocabOverrides =
    overrides.customVocabulary.length > 0 || overrides.deletedVocabIds.length > 0;

  const [subTab, setSubTab] = useState<VocabSubTab>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<VocabSourceFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedExampleIds, setExpandedExampleIds] = useState<Set<string>>(new Set());

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [aiFocusKey, setAiFocusKey] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [term, setTerm] = useState("");
  const [phonetic, setPhonetic] = useState("");
  const [partOfSpeech, setPartOfSpeech] = useState("noun");
  const [meaningVI, setMeaningVI] = useState("");
  const [exampleSentenceEN, setExampleSentenceEN] = useState("");
  const [exampleTranslationVI, setExampleTranslationVI] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState<"json" | "csv" | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(true);
  const [importFormat, setImportFormat] = useState<"json" | "csv">("json");
  const [importData, setImportData] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusNotice, setStatusNotice] = useState<{
    tone: "ok" | "warn" | "error";
    text: string;
  } | null>(null);

  const filteredVocab = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return vocabList.filter((item) => {
      const isBase = BASE_VOCAB_IDS.has(item.id);
      const isCustom = !isBase || customIds.has(item.id);
      if (sourceFilter === "default" && !isBase) return false;
      if (sourceFilter === "custom" && !isCustom) return false;
      if (!q) return true;
      return (
        item.term.toLowerCase().includes(q) ||
        item.meaningVI.toLowerCase().includes(q) ||
        item.partOfSpeech.toLowerCase().includes(q) ||
        item.exampleSentenceEN.toLowerCase().includes(q) ||
        (item.clusterTitle ?? "").toLowerCase().includes(q) ||
        (item.relatedTerms ?? []).some((rel) => rel.toLowerCase().includes(q))
      );
    });
  }, [vocabList, customIds, searchQuery, sourceFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredVocab.length / VOCAB_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedVocab = useMemo(() => {
    const start = (safePage - 1) * VOCAB_PAGE_SIZE;
    return filteredVocab.slice(start, start + VOCAB_PAGE_SIZE);
  }, [filteredVocab, safePage]);

  const toggleExpandExample = (id: string) => {
    setExpandedExampleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const resetForm = () => {
    setIsFormOpen(false);
    setSubTab("list");
    setAiFocusKey(0);
    setEditingId(null);
    setTerm("");
    setPhonetic("");
    setPartOfSpeech("noun");
    setMeaningVI("");
    setExampleSentenceEN("");
    setExampleTranslationVI("");
  };

  const openCreate = () => {
    setAiFocusKey(0);
    setEditingId(null);
    setTerm("");
    setPhonetic("");
    setPartOfSpeech("noun");
    setMeaningVI("");
    setExampleSentenceEN("");
    setExampleTranslationVI("");
    setStatusNotice(null);
    setIsFormOpen(true);
    setSubTab("form");
  };

  const openCreateWithAi = () => {
    openCreate();
    setAiFocusKey((k) => k + 1);
  };

  const openEdit = (item: VocabularyItem) => {
    setAiFocusKey(0);
    setEditingId(item.id);
    setTerm(item.term);
    setPhonetic(item.phonetic);
    setPartOfSpeech(item.partOfSpeech || "noun");
    setMeaningVI(item.meaningVI);
    setExampleSentenceEN(item.exampleSentenceEN);
    setExampleTranslationVI(item.exampleTranslationVI);
    setStatusNotice(null);
    setIsFormOpen(true);
    setSubTab("form");
  };

  const handleAiGenerated = (rawDraft: unknown, meta: AdminAiGenerateMeta) => {
    const draft = (rawDraft && typeof rawDraft === "object" ? rawDraft : {}) as {
      term?: unknown;
      phonetic?: unknown;
      partOfSpeech?: unknown;
      meaningVI?: unknown;
      exampleSentenceEN?: unknown;
      exampleTranslationVI?: unknown;
    };
    const nextPosRaw =
      typeof draft.partOfSpeech === "string" ? draft.partOfSpeech.trim().toLowerCase() : "";
    const nextPos = POS_OPTIONS.includes(nextPosRaw) ? nextPosRaw : "noun";

    setTerm(typeof draft.term === "string" ? draft.term.trim() : "");
    setPhonetic(typeof draft.phonetic === "string" ? draft.phonetic.trim() : "");
    setPartOfSpeech(nextPos);
    setMeaningVI(typeof draft.meaningVI === "string" ? draft.meaningVI.trim() : "");
    setExampleSentenceEN(
      typeof draft.exampleSentenceEN === "string" ? draft.exampleSentenceEN.trim() : ""
    );
    setExampleTranslationVI(
      typeof draft.exampleTranslationVI === "string"
        ? draft.exampleTranslationVI.trim()
        : ""
    );

    setStatusNotice({
      tone: meta.mode === "ai" ? "ok" : "warn",
      text:
        meta.mode === "ai"
          ? `Đã tạo nháp thuật ngữ từ AI (${meta.provider}). Vui lòng kiểm tra phiên âm và ví dụ trước khi lưu.`
          : "Đã điền mẫu gợi ý cục bộ (chưa có AI key). Hãy chỉnh sửa thuật ngữ trước khi lưu.",
    });
  };

  const handlePlayAudio = (item: VocabularyItem) => {
    setPlayingId(item.id);
    speakText(
      item.term,
      1.0,
      () => setPlayingId((cur) => (cur === item.id ? null : cur)),
      (err) => {
        setPlayingId(null);
        setStatusNotice({ tone: "warn", text: err });
      }
    );
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
    if (!term.trim() || !meaningVI.trim()) {
      setStatusNotice({
        tone: "error",
        text: "Vui lòng nhập Thuật ngữ (term) và Nghĩa tiếng Việt (meaningVI).",
      });
      return;
    }

    const nextId =
      editingId ??
      `vc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;

    const nextItem: VocabularyItem = {
      id: nextId,
      term: term.trim(),
      phonetic: phonetic.trim(),
      partOfSpeech: partOfSpeech.trim() || "noun",
      meaningVI: meaningVI.trim(),
      exampleSentenceEN: exampleSentenceEN.trim(),
      exampleTranslationVI: exampleTranslationVI.trim(),
    };

    const nextOverrides: AdminContentOverrides = {
      ...overrides,
      customVocabulary: [
        ...overrides.customVocabulary.filter((v) => v.id !== nextId),
        nextItem,
      ],
      deletedVocabIds: overrides.deletedVocabIds.filter((x) => x !== nextId),
    };

    const done = await saveOverrides(
      nextOverrides,
      editingId
        ? `Đã cập nhật thuật ngữ "${nextItem.term}".`
        : `Đã thêm thuật ngữ mới "${nextItem.term}".`
    );
    if (done) {
      resetForm();
    }
  };

  const handleDelete = async (item: VocabularyItem) => {
    const isBase = BASE_VOCAB_IDS.has(item.id);
    const nextOverrides: AdminContentOverrides = {
      ...overrides,
      customVocabulary: overrides.customVocabulary.filter((v) => v.id !== item.id),
      deletedVocabIds: isBase
        ? Array.from(new Set([...overrides.deletedVocabIds, item.id]))
        : overrides.deletedVocabIds,
    };
    if (editingId === item.id) {
      resetForm();
    }
    await saveOverrides(
      nextOverrides,
      `Đã xóa thuật ngữ "${item.term}" khỏi danh sách hiển thị.`
    );
  };

  const handleRestoreDefaults = async () => {
    resetForm();
    await saveOverrides(
      {
        ...overrides,
        customVocabulary: [],
        deletedVocabIds: [],
      },
      "Đã khôi phục toàn bộ từ vựng về bộ 12 thuật ngữ mặc định."
    );
  };

  const handleExport = async (format: "json" | "csv") => {
    setIsExporting(format);
    setStatusNotice(null);
    try {
      const res = await fetch(`/api/admin/vocabulary/io?format=${format}`, {
        cache: "no-store",
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      if (!res.ok) {
        const errData = (await res.json().catch(() => null)) as { error?: string } | null;
        setStatusNotice({
          tone: "error",
          text: errData?.error || `Export ${format.toUpperCase()} failed.`,
        });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `speakit-vocabulary.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatusNotice({
        tone: "ok",
        text: `Exported vocabulary as ${format.toUpperCase()}.`,
      });
    } catch {
      setStatusNotice({
        tone: "error",
        text: `Failed to export vocabulary as ${format.toUpperCase()}.`,
      });
    } finally {
      setIsExporting(null);
    }
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith(".csv")) {
      setImportFormat("csv");
    } else if (lowerName.endsWith(".json")) {
      setImportFormat("json");
    }
    const text = await file.text();
    setImportData(text);
  };

  const handleImportSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = importData.trim();
    if (!trimmed) {
      setStatusNotice({
        tone: "error",
        text: "Please upload a file or paste JSON/CSV data before importing.",
      });
      return;
    }

    setIsImporting(true);
    setStatusNotice(null);
    try {
      const res = await fetch("/api/admin/vocabulary/io", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: importFormat,
          data: trimmed,
        }),
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      const result = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        importedCount?: number;
        skippedDuplicatesCount?: number;
        skippedTerms?: string[];
        inserted?: number;
        updated?: number;
        skipped?: number;
        total?: number;
        overrides?: AdminContentOverrides;
      } | null;

      if (!res.ok || !result?.ok) {
        setStatusNotice({
          tone: "error",
          text: result?.error || "Import failed.",
        });
        return;
      }

      if (result.overrides) {
        const saved = saveLocalContentOverrides(result.overrides);
        onOverridesChange(saved);
      }

      const importedCount = result.importedCount ?? result.inserted ?? 0;
      const skippedDuplicatesCount =
        result.skippedDuplicatesCount ?? result.skipped ?? 0;
      const skippedTerms = Array.isArray(result.skippedTerms)
        ? result.skippedTerms
        : [];
      const skippedSample =
        skippedTerms.length > 0
          ? ` (${skippedTerms.slice(0, 8).join(", ")}${
              skippedTerms.length > 8 ? ", ..." : ""
            })`
          : "";

      setStatusNotice({
        tone: "ok",
        text: `Đã thêm mới ${importedCount} từ • Bỏ qua ${skippedDuplicatesCount} từ bị trùng${skippedSample}.`,
      });
      setImportData("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setSubTab("list");
    } catch {
      setStatusNotice({
        tone: "error",
        text: "Network error while importing vocabulary.",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-ink/15 rounded-2xl p-4 shadow-soft space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink">
              Quản Lý Thuật Ngữ CNTT ({vocabList.length})
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Thêm, chỉnh sửa phiên âm IPA, câu ví dụ và kiểm tra phát âm trực tiếp bằng Web Speech API.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasVocabOverrides && (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleRestoreDefaults}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white border border-ink/20 text-xs font-medium text-ink hover:bg-paper-muted transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Khôi phục mặc định</span>
              </button>
            )}
            <button
              type="button"
              onClick={openCreateWithAi}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white border border-ink/20 text-xs font-semibold text-ink hover:bg-paper-muted transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
              <span>Tạo bằng AI</span>
            </button>
            <button
              type="button"
              onClick={subTab === "form" && isFormOpen ? resetForm : openCreate}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-pill bg-ink text-white text-xs font-semibold hover:bg-ink/90 shadow-soft shadow-hard-press transition-all"
            >
              {subTab === "form" && isFormOpen ? (
                <>
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Đóng biểu mẫu</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Thêm thuật ngữ</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-ink/10">
          <button
            type="button"
            onClick={() => setSubTab("list")}
            className={`px-3.5 py-1.5 rounded-pill text-xs font-semibold transition-all ${
              subTab === "list"
                ? "bg-ink text-white shadow-soft"
                : "bg-paper text-ink-muted hover:text-ink border border-ink/15"
            }`}
          >
            Danh sách từ vựng ({vocabList.length})
          </button>
          <button
            type="button"
            onClick={() => {
              if (!isFormOpen) openCreate();
              else setSubTab("form");
            }}
            className={`px-3.5 py-1.5 rounded-pill text-xs font-semibold transition-all ${
              subTab === "form"
                ? "bg-ink text-white shadow-soft"
                : "bg-paper text-ink-muted hover:text-ink border border-ink/15"
            }`}
          >
            + Thêm từ / AI Tạo nhanh
          </button>
          <button
            type="button"
            onClick={() => {
              setIsImportOpen(true);
              setSubTab("io");
            }}
            className={`px-3.5 py-1.5 rounded-pill text-xs font-semibold transition-all ${
              subTab === "io"
                ? "bg-ink text-white shadow-soft"
                : "bg-paper text-ink-muted hover:text-ink border border-ink/15"
            }`}
          >
            Nhập / Xuất JSON · CSV
          </button>
        </div>
      </div>

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

      {subTab === "io" && isImportOpen && (
        <div className="bg-white border border-ink/20 rounded-2xl p-5 shadow-soft space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-3">
            <div>
              <h3 className="text-base font-bold text-ink">
                Nhập / Xuất Từ Vựng (JSON · CSV)
              </h3>
              <p className="text-xs text-ink-muted">
                Xuất toàn bộ danh sách hiện tại hoặc tải lên tệp JSON/CSV để đồng bộ hàng loạt.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isExporting !== null}
                onClick={() => handleExport("json")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-paper border border-ink/20 text-xs font-medium text-ink hover:bg-paper-muted transition-colors disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isExporting === "json" ? "Exporting..." : "Export JSON"}</span>
              </button>
              <button
                type="button"
                disabled={isExporting !== null}
                onClick={() => handleExport("csv")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-paper border border-ink/20 text-xs font-medium text-ink hover:bg-paper-muted transition-colors disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isExporting === "csv" ? "Exporting..." : "Export CSV"}</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleImportSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-mono font-semibold text-ink-muted">
                  Format
                </label>
                <select
                  value={importFormat}
                  onChange={(e) =>
                    setImportFormat(e.target.value === "csv" ? "csv" : "json")
                  }
                  className="w-full px-3.5 py-2 text-sm font-mono bg-paper border border-ink/20 rounded-xl text-ink focus:outline-none focus:border-accent"
                >
                  <option value="json">JSON</option>
                  <option value="csv">CSV (RFC-4180)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-mono font-semibold text-ink-muted">
                  Upload File (.json or .csv)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.csv,application/json,text/csv"
                  onChange={handleImportFile}
                  className="w-full px-3 py-1.5 text-xs bg-paper border border-ink/20 rounded-xl text-ink file:mr-3 file:px-3 file:py-1 file:rounded-pill file:border-0 file:bg-ink file:text-white file:text-xs file:font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-semibold text-ink-muted">
                Or Paste {importFormat.toUpperCase()} Content
              </label>
              <textarea
                rows={5}
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder={
                  importFormat === "json"
                    ? '[{"term":"idempotency","phonetic":"/ˌaɪ.demˈpoʊ.tən.si/","partOfSpeech":"noun","meaningVI":"Tính bất biến"}]'
                    : "term,phonetic,partOfSpeech,meaningVI,exampleSentenceEN,exampleTranslationVI"
                }
                className="w-full px-3.5 py-2 text-xs font-mono bg-paper border border-ink/20 rounded-xl text-ink focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setImportData("");
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                  setSubTab("list");
                }}
                className="px-4 py-2 rounded-pill bg-white border border-ink/20 text-xs font-medium text-ink hover:bg-paper-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isImporting}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-pill bg-accent text-white text-xs font-semibold hover:bg-accent-hover shadow-soft shadow-hard-press transition-all disabled:opacity-60"
              >
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isImporting ? "Importing..." : "Import & Sync"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {subTab === "form" && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-ink/20 rounded-2xl p-5 shadow-soft space-y-4"
        >
          <div className="flex items-center justify-between border-b border-ink/10 pb-3">
            <h3 className="text-base font-bold text-ink">
              {editingId ? `Chỉnh sửa thuật ngữ (${editingId})` : "Thêm thuật ngữ mới"}
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
            kind="vocabulary"
            placeholder="VD: idempotency, circuit breaker, race condition..."
            quickTopics={VOCAB_QUICK_TOPICS}
            onGenerated={handleAiGenerated}
            onUnauthorized={onUnauthorized}
            autoFocus={aiFocusKey > 0}
            focusKey={aiFocusKey}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-semibold text-ink-muted">
                Thuật ngữ tiếng Anh (term) *
              </label>
              <input
                type="text"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="VD: idempotency"
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
                placeholder="VD: /ˌaɪ.demˈpoʊ.tən.si/"
                className="w-full px-3.5 py-2 text-sm font-ipa bg-paper border border-ink/20 rounded-xl text-ink focus:outline-none focus:border-accent"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-semibold text-ink-muted">
                Từ loại (partOfSpeech)
              </label>
              <select
                value={partOfSpeech}
                onChange={(e) => setPartOfSpeech(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-mono bg-paper border border-ink/20 rounded-xl text-ink focus:outline-none focus:border-accent"
              >
                {POS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-mono font-semibold text-ink-muted">
              Nghĩa tiếng Việt (meaningVI) *
            </label>
            <input
              type="text"
              value={meaningVI}
              onChange={(e) => setMeaningVI(e.target.value)}
              placeholder="Tính bất biến khi thực thi lặp lại cùng một yêu cầu API..."
              className="w-full px-3.5 py-2 text-sm bg-paper border border-ink/20 rounded-xl text-ink focus:outline-none focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-semibold text-ink-muted">
                Câu ví dụ tiếng Anh (exampleSentenceEN)
              </label>
              <textarea
                rows={2}
                value={exampleSentenceEN}
                onChange={(e) => setExampleSentenceEN(e.target.value)}
                placeholder="We added an idempotency key to prevent duplicate charges."
                className="w-full px-3.5 py-2 text-xs bg-paper border border-ink/20 rounded-xl text-ink focus:outline-none focus:border-accent"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-semibold text-ink-muted">
                Dịch nghĩa ví dụ (exampleTranslationVI)
              </label>
              <textarea
                rows={2}
                value={exampleTranslationVI}
                onChange={(e) => setExampleTranslationVI(e.target.value)}
                placeholder="Chúng tôi thêm khóa idempotency để tránh trừ tiền trùng lặp."
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
              {isSaving ? "Đang lưu..." : editingId ? "Lưu thuật ngữ" : "Thêm & đồng bộ"}
            </button>
          </div>
        </form>
      )}

      {subTab === "list" && (
        <div className="space-y-4">
          <div className="bg-white border border-ink/15 rounded-2xl p-3.5 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search
                className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Tìm theo thuật ngữ, nghĩa tiếng Việt, từ loại..."
                className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-paper border border-ink/20 rounded-xl text-ink focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: "all", label: "Tất cả" },
                  { id: "default", label: "Mặc định" },
                  { id: "custom", label: "Tùy chỉnh" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setSourceFilter(tab.id);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1 rounded-pill text-xs font-mono transition-colors ${
                    sourceFilter === tab.id
                      ? "bg-ink text-white font-semibold"
                      : "bg-paper text-ink-muted hover:text-ink border border-ink/15"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {paginatedVocab.length === 0 ? (
            <div className="bg-white border border-ink/15 rounded-2xl p-6 text-center text-xs text-ink-muted">
              Không tìm thấy thuật ngữ phù hợp với bộ lọc hiện tại.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {paginatedVocab.map((item) => {
                const isBase = BASE_VOCAB_IDS.has(item.id);
                const isOverridden = customIds.has(item.id);
                const isPlaying = playingId === item.id;
                const isExpanded = expandedExampleIds.has(item.id);
                const hasLongExample =
                  (item.exampleSentenceEN?.length ?? 0) > 65 ||
                  Boolean(item.exampleTranslationVI);

                return (
                  <div
                    key={item.id}
                    className="bg-white border border-ink/15 rounded-2xl p-3.5 shadow-soft space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="text-sm font-bold font-mono text-ink">
                            {item.term}
                          </h3>
                          <span className="px-2 py-0.5 rounded-pill bg-paper border border-ink/15 text-[10px] font-mono uppercase text-ink-muted">
                            {item.partOfSpeech}
                          </span>
                          {item.phonetic && item.phonetic !== "/.../" ? (
                            <span className="text-xs font-ipa text-accent font-medium">
                              {item.phonetic}
                            </span>
                          ) : null}
                          {item.careerLevel ? (
                            <span className="px-2 py-0.5 rounded-pill bg-paper border border-ink/15 text-[10px] font-mono font-semibold text-ink">
                              {item.careerLevel}
                            </span>
                          ) : null}
                          {item.clusterTitle ? (
                            <span className="px-2 py-0.5 rounded-pill bg-accent-light border border-accent/30 text-[10px] font-mono font-semibold text-ink">
                              {item.clusterTitle}
                            </span>
                          ) : !isBase ? (
                            <span className="px-2 py-0.5 rounded-pill bg-accent-light border border-accent/30 text-[10px] font-mono font-semibold text-ink">
                              Tùy chỉnh
                            </span>
                          ) : isOverridden ? (
                            <span className="px-2 py-0.5 rounded-pill bg-paper-muted border border-ink/20 text-[10px] font-mono font-semibold text-ink">
                              Đã sửa
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handlePlayAudio(item)}
                          title={`Nghe thử "${item.term}"`}
                          aria-label={`Nghe thử phát âm ${item.term}`}
                          className={`w-7 h-7 rounded-full border flex items-center justify-center transition-colors ${
                            isPlaying
                              ? "bg-accent text-white border-accent"
                              : "bg-paper text-ink border-ink/20 hover:bg-ink hover:text-white"
                          }`}
                        >
                          {isPlaying ? (
                            <VolumeX className="w-3.5 h-3.5" aria-hidden="true" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => openEdit(item)}
                          aria-label={`Chỉnh sửa ${item.term}`}
                          className="w-7 h-7 rounded-full bg-white border border-ink/20 flex items-center justify-center text-ink hover:bg-paper-muted transition-colors disabled:opacity-50"
                        >
                          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleDelete(item)}
                          aria-label={`Xóa ${item.term}`}
                          className="w-7 h-7 rounded-full bg-accent-light border border-accent/40 flex items-center justify-center text-ink hover:bg-accent hover:text-white transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-ink bg-paper/70 border border-ink/10 rounded-xl px-2.5 py-1.5 leading-snug">
                      {item.meaningVI}
                    </p>

                    {item.exampleSentenceEN && (
                      <div className="text-xs text-ink-muted px-1">
                        <button
                          type="button"
                          onClick={() => toggleExpandExample(item.id)}
                          className="w-full text-left flex items-start justify-between gap-2 group"
                        >
                          <span
                            className={`font-medium text-ink ${
                              !isExpanded && hasLongExample ? "line-clamp-1" : ""
                            }`}
                          >
                            &ldquo;{item.exampleSentenceEN}&rdquo;
                          </span>
                          {hasLongExample && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-ink-muted group-hover:text-ink shrink-0 mt-0.5">
                              {isExpanded ? (
                                <>
                                  <span>Thu gọn</span>
                                  <ChevronUp className="w-3 h-3" aria-hidden="true" />
                                </>
                              ) : (
                                <>
                                  <span>Chi tiết</span>
                                  <ChevronDown className="w-3 h-3" aria-hidden="true" />
                                </>
                              )}
                            </span>
                          )}
                        </button>
                        {(isExpanded || !hasLongExample) && item.exampleTranslationVI && (
                          <div className="text-[11px] mt-0.5">{item.exampleTranslationVI}</div>
                        )}
                      </div>
                    )}

                    {Array.isArray(item.relatedTerms) && item.relatedTerms.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        {item.relatedTerms.map((rel) => (
                          <span
                            key={rel}
                            className="px-2 py-0.5 rounded-pill bg-paper border border-ink/15 text-[10px] font-mono text-ink-muted"
                          >
                            #{rel}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="bg-white border border-ink/15 rounded-2xl px-4 py-2.5 shadow-soft flex items-center justify-between gap-3">
            <span className="text-xs font-mono text-ink-muted">
              Trang {safePage} / {totalPages} ({filteredVocab.length} thuật ngữ)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-pill bg-paper border border-ink/20 text-xs font-semibold text-ink hover:bg-paper-muted disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Trước</span>
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-pill bg-paper border border-ink/20 text-xs font-semibold text-ink hover:bg-paper-muted disabled:opacity-40 transition-colors"
              >
                <span>Sau</span>
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

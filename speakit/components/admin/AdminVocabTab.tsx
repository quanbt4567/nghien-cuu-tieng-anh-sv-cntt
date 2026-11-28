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
  Trash2,
  Upload,
  Volume2,
  VolumeX,
} from "lucide-react";
import { VOCABULARY_LIST } from "../../data/scenarios";
import { computeVocabularyBulkDeleteOverrides } from "../../lib/adminBulkDelete";
import { mergeVocabulary, saveLocalContentOverrides } from "../../lib/contentStore";
import { speakText } from "../../lib/speech";
import type { AdminContentOverrides, VocabularyItem } from "../../lib/types";
import { AdminAiGeneratorBox, type AdminAiGenerateMeta } from "./AdminAiGeneratorBox";
import {
  AdminBulkActionBar,
  AdminDeleteConfirmModal,
  type DeleteConfirmRequest,
} from "./AdminDeleteConfirmModal";
import { AdminImageField } from "./AdminImageField";
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteRequest, setDeleteRequest] = useState<DeleteConfirmRequest | null>(null);

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
  const [imageUrl, setImageUrl] = useState("");
  const [careerLevel, setCareerLevel] = useState<"" | "Fresher" | "Junior" | "Senior">("");
  const [clusterTitle, setClusterTitle] = useState("");
  const [relatedTermsText, setRelatedTermsText] = useState("");

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
        (item.exampleTranslationVI ?? "").toLowerCase().includes(q) ||
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
    setImageUrl("");
    setCareerLevel("");
    setClusterTitle("");
    setRelatedTermsText("");
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
    setImageUrl("");
    setCareerLevel("");
    setClusterTitle("");
    setRelatedTermsText("");
    setStatusNotice(null);
    setIsFormOpen(true);
    setSubTab("form");
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
    setImageUrl(item.imageUrl ?? "");
    setCareerLevel(item.careerLevel ?? "");
    setClusterTitle(item.clusterTitle ?? "");
    setRelatedTermsText((item.relatedTerms ?? []).join(", "));
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

    const parsedTags = relatedTermsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const nextItem: VocabularyItem = {
      id: nextId,
      term: term.trim(),
      phonetic: phonetic.trim(),
      partOfSpeech: partOfSpeech.trim() || "noun",
      meaningVI: meaningVI.trim(),
      exampleSentenceEN: exampleSentenceEN.trim(),
      exampleTranslationVI: exampleTranslationVI.trim(),
      imageUrl: imageUrl.trim() || null,
      ...(careerLevel ? { careerLevel } : {}),
      ...(clusterTitle.trim() ? { clusterTitle: clusterTitle.trim() } : {}),
      ...(parsedTags.length > 0 ? { relatedTerms: parsedTags } : {}),
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

  const executeDeleteItems = async (itemsToDelete: VocabularyItem[], label: string) => {
    if (itemsToDelete.length === 0) return false;
    const nextOverrides = computeVocabularyBulkDeleteOverrides(
      overrides,
      itemsToDelete,
      BASE_VOCAB_IDS
    );
    const removedSet = new Set(itemsToDelete.map((i) => i.id));
    if (editingId && removedSet.has(editingId)) {
      resetForm();
    }
    const ok = await saveOverrides(nextOverrides, label);
    if (ok) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        itemsToDelete.forEach((i) => next.delete(i.id));
        return next;
      });
    }
    return ok;
  };

  const handleDelete = (item: VocabularyItem) => {
    setDeleteRequest({
      title: `Bạn có chắc chắn muốn xóa thuật ngữ "${item.term}"?`,
      description: BASE_VOCAB_IDS.has(item.id)
        ? "Thuật ngữ mặc định này sẽ bị ẩn khỏi danh sách luyện tập và dữ liệu đồng bộ."
        : "Thuật ngữ tùy chỉnh này sẽ bị xóa khỏi danh sách và Neon DB.",
      itemCount: 1,
      itemPreviewLabels: [item.term],
      confirmButtonLabel: "Xóa thuật ngữ",
      onConfirm: () =>
        executeDeleteItems(
          [item],
          `Đã xóa thuật ngữ "${item.term}" khỏi danh sách hiển thị.`
        ),
    });
  };

  const selectedVocabItems = useMemo(
    () => vocabList.filter((item) => selectedIds.has(item.id)),
    [vocabList, selectedIds]
  );

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pageVocabIds = paginatedVocab.map((v) => v.id);
  const allPageSelected =
    pageVocabIds.length > 0 && pageVocabIds.every((id) => selectedIds.has(id));

  const toggleSelectPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const id of pageVocabIds) next.delete(id);
      } else {
        for (const id of pageVocabIds) next.add(id);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const item of filteredVocab) next.add(item.id);
      return next;
    });
  };

  const handleBulkDelete = () => {
    if (selectedVocabItems.length === 0) return;
    const count = selectedVocabItems.length;
    setDeleteRequest({
      title: `Bạn có chắc chắn muốn xóa ${count} thuật ngữ đã chọn?`,
      description:
        "Các từ vựng tùy chỉnh sẽ bị xóa khỏi hệ thống và bảng Neon DB; từ vựng mặc định sẽ bị ẩn khỏi người dùng.",
      itemCount: count,
      itemPreviewLabels: selectedVocabItems.map((v) => v.term),
      confirmButtonLabel: `Xóa ${count} thuật ngữ`,
      onConfirm: () =>
        executeDeleteItems(selectedVocabItems, `Đã xóa hàng loạt ${count} thuật ngữ.`),
    });
  };

  const handleRestoreDefaults = () => {
    setDeleteRequest({
      title: "Khôi phục từ vựng về 12 thuật ngữ mặc định?",
      description:
        "Thao tác này sẽ xóa toàn bộ các thuật ngữ tùy chỉnh bạn đã thêm hoặc import, đồng thời hiện lại bộ 12 từ mặc định.",
      itemCount: Math.max(1, overrides.customVocabulary.length + overrides.deletedVocabIds.length),
      confirmButtonLabel: "Khôi phục mặc định",
      onConfirm: async () => {
        resetForm();
        const ok = await saveOverrides(
          {
            ...overrides,
            customVocabulary: [],
            deletedVocabIds: [],
          },
          "Đã khôi phục toàn bộ từ vựng về bộ 12 thuật ngữ mặc định."
        );
        if (ok) {
          setSelectedIds(new Set());
        }
        return ok;
      },
    });
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
        aiRepairedCount?: number;
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
      const aiRepairedCount = result.aiRepairedCount ?? 0;
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
        text: `Đã thêm mới ${importedCount} từ (AI chuẩn hóa ${aiRepairedCount} từ) • Bỏ qua ${skippedDuplicatesCount} từ bị trùng${skippedSample}.`,
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
      <div className="liquid-glass-card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Quản Lý Thuật Ngữ CNTT ({vocabList.length})
            </h2>
            <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">
              Thêm, chỉnh sửa phiên âm IPA, câu ví dụ và kiểm tra phát âm trực tiếp bằng Web Speech API.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setSubTab("list")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              subTab === "list"
                ? "bg-blue-50 dark:bg-blue-950/50 border-blue-700 dark:border-blue-500 text-blue-700 dark:text-blue-300"
                : "liquid-glass-btn text-slate-700 dark:text-slate-300"
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
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              subTab === "form"
                ? "bg-blue-50 dark:bg-blue-950/50 border-blue-700 dark:border-blue-500 text-blue-700 dark:text-blue-300"
                : "liquid-glass-btn text-slate-700 dark:text-slate-300"
            }`}
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Thêm từ / AI Tạo nhanh</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsImportOpen(true);
              setSubTab("io");
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              subTab === "io"
                ? "bg-blue-50 dark:bg-blue-950/50 border-blue-700 dark:border-blue-500 text-blue-700 dark:text-blue-300"
                : "liquid-glass-btn text-slate-700 dark:text-slate-300"
            }`}
          >
            Nhập / Xuất JSON · CSV
          </button>
        </div>
      </div>

      {statusNotice && (
        <div
          role={statusNotice.tone === "error" ? "alert" : "status"}
          className={`flex items-start gap-2.5 p-3.5 rounded-xl border text-sm ${
            statusNotice.tone === "error"
              ? "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300"
              : statusNotice.tone === "warn"
              ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300"
              : "bg-green-50 dark:bg-green-950/40 border-green-300 dark:border-green-800 text-green-700 dark:text-green-300"
          }`}
        >
          {statusNotice.tone === "ok" ? (
            <CheckCircle2 className="w-4 h-4 text-green-700 dark:text-green-400 shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
          )}
          <span>{statusNotice.text}</span>
        </div>
      )}

      {subTab === "io" && isImportOpen && (
        <div className="liquid-glass-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Nhập / Xuất Từ Vựng (JSON : CSV)
              </h3>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Xuất toàn bộ danh sách hiện tại hoặc tải lên tệp JSON/CSV để đồng bộ hàng loạt.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isExporting !== null}
                onClick={() => handleExport("json")}
                className="liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isExporting === "json" ? "Đang xuất…" : "Xuất JSON"}</span>
              </button>
              <button
                type="button"
                disabled={isExporting !== null}
                onClick={() => handleExport("csv")}
                className="liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isExporting === "csv" ? "Đang xuất…" : "Xuất CSV"}</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleImportSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="vocab-import-format" className="block text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                  Định dạng
                </label>
                <select
                  id="vocab-import-format"
                  name="importFormat"
                  value={importFormat}
                  onChange={(e) =>
                    setImportFormat(e.target.value === "csv" ? "csv" : "json")
                  }
                  className="liquid-glass-input w-full px-3.5 py-2 text-sm font-mono rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 [&>option]:bg-white dark:[&>option]:bg-slate-900 [&>option]:text-slate-900 dark:[&>option]:text-slate-100"
                >
                  <option value="json">JSON</option>
                  <option value="csv">CSV (RFC-4180)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="vocab-import-file" className="block text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                  Tải tệp (.json hoặc .csv)
                </label>
                <input
                  id="vocab-import-file"
                  name="importFile"
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.csv,application/json,text/csv"
                  onChange={handleImportFile}
                  className="liquid-glass-input w-full px-3 py-1.5 text-xs rounded-lg file:mr-3 file:px-3 file:py-1 file:rounded-full file:border file:border-blue-200 dark:file:border-blue-800 file:bg-blue-50 dark:file:bg-blue-950/40 file:text-blue-700 dark:file:text-blue-300 file:text-xs file:font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="vocab-import-data" className="block text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                Hoặc dán nội dung {importFormat.toUpperCase()}
              </label>
              <textarea
                id="vocab-import-data"
                name="importData"
                rows={5}
                autoComplete="off"
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder={
                  importFormat === "json"
                    ? '[{"term":"idempotency","phonetic":"/ˌaɪ.demˈpoʊ.tən.si/","partOfSpeech":"noun","meaningVI":"Tính bất biến"}]'
                    : "term,phonetic,partOfSpeech,meaningVI,exampleSentenceEN,exampleTranslationVI"
                }
                className="liquid-glass-input w-full px-3.5 py-2 text-xs font-mono rounded-lg"
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
                className="liquid-glass-btn px-4 py-2 rounded-lg text-xs font-medium"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isImporting}
                className="liquid-btn-primary inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold disabled:opacity-60"
              >
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {isImporting
                    ? "AI đang kiểm tra & chuẩn hóa cấu trúc…"
                    : "Nhập & đồng bộ"}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      {subTab === "form" && (
        <form
          onSubmit={handleSubmit}
          className="liquid-glass-card p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {editingId ? `Chỉnh sửa thuật ngữ (${editingId})` : "Thêm thuật ngữ mới"}
            </h3>
          </div>

          <AdminAiGeneratorBox
            key={editingId ?? "create"}
            kind="vocabulary"
            placeholder="VD: idempotency, circuit breaker, race condition…"
            quickTopics={VOCAB_QUICK_TOPICS}
            onGenerated={handleAiGenerated}
            onUnauthorized={onUnauthorized}
            focusKey={aiFocusKey}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="vocab-term" className="block text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                Thuật ngữ tiếng Anh (term) *
              </label>
              <input
                id="vocab-term"
                name="term"
                type="text"
                autoComplete="off"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="VD: idempotency"
                className="liquid-glass-input w-full px-3.5 py-2 text-sm font-mono rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="vocab-phonetic" className="block text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                Phiên âm IPA (phonetic)
              </label>
              <input
                id="vocab-phonetic"
                name="phonetic"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={phonetic}
                onChange={(e) => setPhonetic(e.target.value)}
                placeholder="VD: /ˌaɪ.demˈpoʊ.tən.si/"
                className="liquid-glass-input w-full px-3.5 py-2 text-sm font-ipa rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="vocab-pos" className="block text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                Từ loại (partOfSpeech)
              </label>
              <select
                id="vocab-pos"
                name="partOfSpeech"
                value={partOfSpeech}
                onChange={(e) => setPartOfSpeech(e.target.value)}
                className="liquid-glass-input w-full px-3.5 py-2 text-sm font-mono rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 [&>option]:bg-white dark:[&>option]:bg-slate-900 [&>option]:text-slate-900 dark:[&>option]:text-slate-100"
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
            <label htmlFor="vocab-meaning-vi" className="block text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
              Nghĩa tiếng Việt (meaningVI) *
            </label>
            <input
              id="vocab-meaning-vi"
              name="meaningVI"
              type="text"
              autoComplete="off"
              value={meaningVI}
              onChange={(e) => setMeaningVI(e.target.value)}
              placeholder="Tính bất biến khi thực thi lặp lại cùng một yêu cầu API…"
              className="liquid-glass-input w-full px-3.5 py-2 text-sm rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="vocab-example-en" className="block text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                Câu ví dụ tiếng Anh (exampleSentenceEN)
              </label>
              <textarea
                id="vocab-example-en"
                name="exampleSentenceEN"
                rows={2}
                autoComplete="off"
                value={exampleSentenceEN}
                onChange={(e) => setExampleSentenceEN(e.target.value)}
                placeholder="We added an idempotency key to prevent duplicate charges."
                className="liquid-glass-input w-full px-3.5 py-2 text-sm rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="vocab-example-vi" className="block text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                Dịch nghĩa ví dụ (exampleTranslationVI)
              </label>
              <textarea
                id="vocab-example-vi"
                name="exampleTranslationVI"
                rows={2}
                autoComplete="off"
                value={exampleTranslationVI}
                onChange={(e) => setExampleTranslationVI(e.target.value)}
                placeholder="Chúng tôi thêm khóa idempotency để tránh trừ tiền trùng lặp."
                className="liquid-glass-input w-full px-3.5 py-2 text-sm rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="vocab-level" className="block text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                Cấp độ (careerLevel)
              </label>
              <select
                id="vocab-level"
                name="careerLevel"
                value={careerLevel}
                onChange={(e) =>
                  setCareerLevel(e.target.value as "" | "Fresher" | "Junior" | "Senior")
                }
                className="liquid-glass-input w-full px-3.5 py-2 text-sm font-mono rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 [&>option]:bg-white dark:[&>option]:bg-slate-900 [&>option]:text-slate-900 dark:[&>option]:text-slate-100"
              >
                <option value="">Tất cả / Chưa phân loại</option>
                <option value="Fresher">Fresher</option>
                <option value="Junior">Junior</option>
                <option value="Senior">Senior</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="vocab-category" className="block text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                Nhóm chủ đề / Category
              </label>
              <input
                id="vocab-category"
                name="clusterTitle"
                type="text"
                autoComplete="off"
                value={clusterTitle}
                onChange={(e) => setClusterTitle(e.target.value)}
                placeholder="VD: Backend & API, System Design"
                className="liquid-glass-input w-full px-3.5 py-2 text-sm rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="vocab-tags" className="block text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                Tags / Từ liên quan (phân tách dấu phẩy)
              </label>
              <input
                id="vocab-tags"
                name="relatedTerms"
                type="text"
                autoComplete="off"
                value={relatedTermsText}
                onChange={(e) => setRelatedTermsText(e.target.value)}
                placeholder="retry, api, webhook"
                className="liquid-glass-input w-full px-3.5 py-2 text-sm font-mono rounded-lg"
              />
            </div>
          </div>

          <AdminImageField
            label="Ảnh minh họa từ vựng"
            value={imageUrl}
            onChange={setImageUrl}
            allowGenerate={true}
            placeholder="https://... hoặc /research-covers/..."
          />

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="liquid-glass-btn px-4 py-2 rounded-lg text-xs font-medium"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="liquid-btn-primary px-5 py-2 rounded-lg text-xs font-semibold disabled:opacity-60"
            >
              {isSaving ? "Đang lưu…" : editingId ? "Lưu thuật ngữ" : "Thêm & đồng bộ"}
            </button>
          </div>
        </form>
      )}

      {subTab === "list" && (
        <div className="space-y-4">
          <div className="liquid-glass-card p-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="flex-1 space-y-1">
              <div className="relative">
                <Search
                  className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  name="vocabSearch"
                  type="search"
                  autoComplete="off"
                  aria-label="Tìm kiếm từ vựng"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Tìm kiếm từ vựng…"
                  className="liquid-glass-input w-full pl-9 pr-3.5 py-1.5 text-sm rounded-lg"
                />
              </div>
              <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400 pl-1">
                Tìm trong từ, nghĩa, ví dụ &amp; tag
              </p>
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
                  className={`px-3 py-1 rounded-full text-xs font-mono border transition-colors ${
                    sourceFilter === tab.id
                      ? "bg-blue-50 dark:bg-blue-950/50 border-blue-700 dark:border-blue-500 text-blue-700 dark:text-blue-300 font-semibold"
                      : "liquid-glass-btn text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <AdminBulkActionBar
            selectedCount={selectedVocabItems.length}
            totalFilteredCount={filteredVocab.length}
            allPageSelected={allPageSelected}
            pageCount={paginatedVocab.length}
            itemUnitLabel="từ vựng"
            disabled={isSaving}
            onToggleSelectPage={toggleSelectPage}
            onSelectAllFiltered={selectAllFiltered}
            onClearSelection={() => setSelectedIds(new Set())}
            onBulkDelete={handleBulkDelete}
          />

          {paginatedVocab.length === 0 ? (
            <div className="liquid-glass-card p-6 text-center text-sm text-slate-700 dark:text-slate-300">
              Không tìm thấy thuật ngữ phù hợp với bộ lọc hiện tại.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {paginatedVocab.map((item) => {
                const isBase = BASE_VOCAB_IDS.has(item.id);
                const isOverridden = customIds.has(item.id);
                const isPlaying = playingId === item.id;
                const isExpanded = expandedExampleIds.has(item.id);
                const isSelected = selectedIds.has(item.id);
                const hasLongExample =
                  (item.exampleSentenceEN?.length ?? 0) > 65 ||
                  Boolean(item.exampleTranslationVI);

                return (
                  <div
                    key={item.id}
                    className={`liquid-glass-card-lite p-3.5 space-y-2 transition-colors ${
                      isSelected ? "!border-blue-700 dark:!border-blue-500 ring-1 ring-blue-700/35" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectId(item.id)}
                          aria-label={`Chọn thuật ngữ ${item.term}`}
                          className="mt-0.5 w-4 h-4 rounded accent-blue-700 cursor-pointer shrink-0"
                        />
                        {item.imageUrl && (
                          <img
                            src={item.imageUrl}
                            alt={item.term}
                            className="w-12 h-12 object-cover rounded-lg border border-slate-200 dark:border-slate-800 shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h3 className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">
                              {item.term}
                            </h3>
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono uppercase text-slate-700 dark:text-slate-300">
                              {item.partOfSpeech}
                            </span>
                            {item.phonetic && item.phonetic !== "/.../" ? (
                              <span className="text-xs font-ipa text-blue-700 dark:text-blue-400 font-medium">
                                {item.phonetic}
                              </span>
                            ) : null}
                            {item.careerLevel ? (
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300">
                                {item.careerLevel}
                              </span>
                            ) : null}
                            {item.clusterTitle ? (
                              <span className="px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-[11px] font-mono font-semibold text-red-600 dark:text-red-300">
                                {item.clusterTitle}
                              </span>
                            ) : !isBase ? (
                              <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-[11px] font-mono font-semibold text-blue-700 dark:text-blue-300">
                                Tùy chỉnh
                              </span>
                            ) : isOverridden ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-[11px] font-mono font-semibold text-amber-700 dark:text-amber-300">
                                Đã sửa
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handlePlayAudio(item)}
                          title={`Nghe thử "${item.term}"`}
                          aria-label={`Nghe thử phát âm ${item.term}`}
                          className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-colors ${
                            isPlaying
                              ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-700 dark:border-blue-500"
                              : "liquid-glass-btn text-slate-700 dark:text-slate-300"
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
                          className="liquid-glass-btn w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-50"
                        >
                          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleDelete(item)}
                          aria-label={`Xóa ${item.term}`}
                          className="liquid-btn-danger w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <p className="text-sm text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-[#263349] rounded-lg px-3 py-2 leading-snug">
                      {item.meaningVI}
                    </p>

                    {item.exampleSentenceEN && (
                      <div className="text-xs text-slate-700 dark:text-slate-300 px-1">
                        <button
                          type="button"
                          onClick={() => toggleExpandExample(item.id)}
                          className="w-full text-left flex items-start justify-between gap-2 group"
                        >
                          <span
                            className={`font-medium text-slate-900 dark:text-slate-100 ${
                              !isExpanded && hasLongExample ? "line-clamp-1" : ""
                            }`}
                          >
                            &ldquo;{item.exampleSentenceEN}&rdquo;
                          </span>
                          {hasLongExample && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] font-mono text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-100 shrink-0 mt-0.5">
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
                          <div className="text-xs mt-0.5 text-slate-700 dark:text-slate-300">{item.exampleTranslationVI}</div>
                        )}
                      </div>
                    )}

                    {Array.isArray(item.relatedTerms) && item.relatedTerms.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        {item.relatedTerms.map((rel) => (
                          <span
                            key={rel}
                            className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono text-slate-700 dark:text-slate-300"
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

          <div className="liquid-glass-card px-4 py-2.5 flex items-center justify-between gap-3">
            <span className="text-xs font-mono text-slate-700 dark:text-slate-300">
              Trang {safePage}/{totalPages} ({filteredVocab.length} thuật ngữ)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="liquid-glass-btn inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Trước</span>
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="liquid-glass-btn inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold disabled:opacity-40"
              >
                <span>Sau</span>
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {hasVocabOverrides && (
            <div className="rounded-xl border border-amber-300 dark:border-amber-800/80 bg-amber-50/70 dark:bg-amber-950/20 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs font-mono font-bold uppercase text-amber-800 dark:text-amber-300">
                  Vùng khôi phục dữ liệu gốc
                </p>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  Khôi phục mặc định sẽ xóa toàn bộ thuật ngữ tùy chỉnh đã thêm/import và đưa danh sách về 12 từ gốc.
                </p>
              </div>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleRestoreDefaults}
                className="liquid-btn-danger inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Khôi phục mặc định</span>
              </button>
            </div>
          )}
        </div>
      )}

      <AdminDeleteConfirmModal
        request={deleteRequest}
        onClose={() => setDeleteRequest(null)}
      />
    </div>
  );
}

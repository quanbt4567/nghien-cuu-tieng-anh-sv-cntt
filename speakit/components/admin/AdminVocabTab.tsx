"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { VOCABULARY_LIST } from "../../data/scenarios";
import { mergeVocabulary } from "../../lib/contentStore";
import { speakText } from "../../lib/speech";
import type { AdminContentOverrides, VocabularyItem } from "../../lib/types";
import { persistAdminOverrides } from "./adminShared";

interface AdminVocabTabProps {
  overrides: AdminContentOverrides;
  onOverridesChange: (next: AdminContentOverrides) => void;
  onUnauthorized: () => void;
}

const BASE_VOCAB_IDS = new Set(VOCABULARY_LIST.map((v) => v.id));
const POS_OPTIONS = ["noun", "verb", "adjective", "phrase", "adverb"];

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

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [term, setTerm] = useState("");
  const [phonetic, setPhonetic] = useState("");
  const [partOfSpeech, setPartOfSpeech] = useState("noun");
  const [meaningVI, setMeaningVI] = useState("");
  const [exampleSentenceEN, setExampleSentenceEN] = useState("");
  const [exampleTranslationVI, setExampleTranslationVI] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [statusNotice, setStatusNotice] = useState<{
    tone: "ok" | "warn" | "error";
    text: string;
  } | null>(null);

  const resetForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setTerm("");
    setPhonetic("");
    setPartOfSpeech("noun");
    setMeaningVI("");
    setExampleSentenceEN("");
    setExampleTranslationVI("");
  };

  const openCreate = () => {
    setEditingId(null);
    setTerm("");
    setPhonetic("");
    setPartOfSpeech("noun");
    setMeaningVI("");
    setExampleSentenceEN("");
    setExampleTranslationVI("");
    setStatusNotice(null);
    setIsFormOpen(true);
  };

  const openEdit = (item: VocabularyItem) => {
    setEditingId(item.id);
    setTerm(item.term);
    setPhonetic(item.phonetic);
    setPartOfSpeech(item.partOfSpeech || "noun");
    setMeaningVI(item.meaningVI);
    setExampleSentenceEN(item.exampleSentenceEN);
    setExampleTranslationVI(item.exampleTranslationVI);
    setStatusNotice(null);
    setIsFormOpen(true);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-ink">
            Quản Lý Thuật Ngữ CNTT ({vocabList.length})
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Thêm, chỉnh sửa phiên âm IPA, câu ví dụ và kiểm tra phát âm trực tiếp bằng Web Speech API.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {hasVocabOverrides && (
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
                <span>Thêm thuật ngữ</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Status Notice */}
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

      {/* Vocabulary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {vocabList.map((item) => {
          const isBase = BASE_VOCAB_IDS.has(item.id);
          const isOverridden = customIds.has(item.id);
          const isPlaying = playingId === item.id;

          return (
            <div
              key={item.id}
              className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold font-mono text-ink">
                      {item.term}
                    </h3>
                    <span className="px-2 py-0.5 rounded-pill bg-paper border border-ink/15 text-[10px] font-mono uppercase text-ink-muted">
                      {item.partOfSpeech}
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
                  <div className="text-sm font-ipa text-accent font-medium mt-1">
                    {item.phonetic || "/.../"}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handlePlayAudio(item)}
                    title={`Nghe thử "${item.term}"`}
                    aria-label={`Nghe thử phát âm ${item.term}`}
                    className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${
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
                    className="w-8 h-8 rounded-full bg-white border border-ink/20 flex items-center justify-center text-ink hover:bg-paper-muted transition-colors disabled:opacity-50"
                  >
                    <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleDelete(item)}
                    aria-label={`Xóa ${item.term}`}
                    className="w-8 h-8 rounded-full bg-accent-light border border-accent/40 flex items-center justify-center text-ink hover:bg-accent hover:text-white transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-ink bg-paper/70 border border-ink/10 rounded-xl p-3 leading-relaxed">
                {item.meaningVI}
              </p>

              {item.exampleSentenceEN && (
                <div className="text-xs space-y-0.5 text-ink-muted px-1">
                  <div className="font-medium text-ink">
                    &ldquo;{item.exampleSentenceEN}&rdquo;
                  </div>
                  {item.exampleTranslationVI && (
                    <div className="text-[11px]">{item.exampleTranslationVI}</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

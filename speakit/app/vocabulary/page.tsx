"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Layers,
  LayoutGrid,
  Mic,
  Search,
  Zap,
} from "lucide-react";
import { VOCABULARY_LIST } from "../../data/scenarios";
import { VocabCard } from "../../components/vocabulary/VocabCard";
import {
  FlashcardRating,
  VocabFlashcardDeck,
} from "../../components/vocabulary/VocabFlashcardDeck";
import { VocabContextQuiz } from "../../components/vocabulary/VocabContextQuiz";
import { ClusterSpeakingModal } from "../../components/vocabulary/ClusterSpeakingModal";
import {
  filterAndRankVocabulary,
  groupVocabularyByCluster,
  VOCAB_CONTEXT_PILLS,
  VocabWorkContext,
} from "../../components/vocabulary/vocabSearch";
import {
  CONTENT_STORAGE_KEY,
  CONTENT_UPDATED_EVENT,
  fetchAndCachePublicContent,
  getEffectiveVocabulary,
} from "../../lib/contentStore";
import { storageAdapter } from "../../lib/storage";
import { VocabularyItem, WeakPoint } from "../../lib/types";

const MASTERED_STORAGE_KEY = "speakit_vocab_mastered_v1";
const WEAK_POINTS_STORAGE_KEY = "speakit_weakpoints_v1";
const CARDS_PER_PAGE = 9;

type WorkspaceMode = "dictionary" | "flashcard" | "quiz" | "cluster";

const WORKSPACE_MODES: Array<{
  id: WorkspaceMode;
  label: string;
  icon: typeof BookOpen;
}> = [
  { id: "dictionary", label: "Từ điển & Phát âm", icon: BookOpen },
  { id: "flashcard", label: "Flashcard Lật Thẻ", icon: Layers },
  { id: "quiz", label: "Quiz 60 Giây (+2 Coin)", icon: Zap },
  { id: "cluster", label: "Nói Theo Cụm (+3 Coin)", icon: Mic },
];

function readMasteredIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(MASTERED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === "string"));
  } catch {
    return new Set();
  }
}

function writeMasteredIds(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      MASTERED_STORAGE_KEY,
      JSON.stringify(Array.from(ids))
    );
  } catch {}
}

function removeKeywordWeakPointLocally(term: string): void {
  if (typeof window === "undefined") return;
  const target = term.trim().toLowerCase();
  if (!target) return;
  try {
    const raw = window.localStorage.getItem(WEAK_POINTS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as WeakPoint[];
    if (!Array.isArray(parsed)) return;
    const next = parsed.filter(
      (wp) =>
        !(wp.kind === "keyword" && wp.value.trim().toLowerCase() === target)
    );
    window.localStorage.setItem(WEAK_POINTS_STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

export default function VocabularyPage() {
  const [vocabList, setVocabList] = useState<VocabularyItem[]>(VOCABULARY_LIST);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContext, setSelectedContext] =
    useState<VocabWorkContext>("all");
  const [workspaceMode, setWorkspaceMode] =
    useState<WorkspaceMode>("dictionary");
  const [currentPage, setCurrentPage] = useState(1);
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());
  const [reviewTerms, setReviewTerms] = useState<Set<string>>(new Set());
  const [activeCluster, setActiveCluster] = useState<{
    clusterTitle: string;
    terms: string[];
  } | null>(null);
  const quizContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const syncContent = () => {
      setVocabList(getEffectiveVocabulary());
    };

    const syncReviewTerms = async () => {
      const weakPoints = await storageAdapter.getWeakPoints(100);
      const next = new Set(
        weakPoints
          .filter((wp) => wp.kind === "keyword")
          .map((wp) => wp.value.trim().toLowerCase())
      );
      setReviewTerms(next);
    };

    syncContent();
    setMasteredIds(readMasteredIds());
    void syncReviewTerms();
    void fetchAndCachePublicContent();

    window.addEventListener(CONTENT_UPDATED_EVENT, syncContent);
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === CONTENT_STORAGE_KEY) {
        syncContent();
      }
      if (!event.key || event.key === MASTERED_STORAGE_KEY) {
        setMasteredIds(readMasteredIds());
      }
      if (!event.key || event.key === WEAK_POINTS_STORAGE_KEY) {
        void syncReviewTerms();
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(CONTENT_UPDATED_EVENT, syncContent);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedContext]);

  useEffect(() => {
    if (workspaceMode !== "quiz") return;
    const expandBtn = quizContainerRef.current?.querySelector<HTMLButtonElement>(
      'button[aria-label="Mở rộng quiz"]'
    );
    if (expandBtn) {
      expandBtn.click();
    }
  }, [workspaceMode]);

  const filtered = useMemo(
    () => filterAndRankVocabulary(vocabList, searchQuery, selectedContext),
    [vocabList, searchQuery, selectedContext]
  );

  const clusteredGroups = useMemo(
    () =>
      groupVocabularyByCluster(filtered.length > 0 ? filtered : vocabList),
    [filtered, vocabList]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / CARDS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * CARDS_PER_PAGE;
    return filtered.slice(start, start + CARDS_PER_PAGE);
  }, [filtered, safePage]);

  const validMasteredCount = useMemo(() => {
    const validIds = new Set(vocabList.map((item) => item.id));
    let count = 0;
    masteredIds.forEach((id) => {
      if (validIds.has(id)) count += 1;
    });
    return count;
  }, [vocabList, masteredIds]);

  const masteryPercent =
    vocabList.length > 0
      ? Math.round((validMasteredCount / vocabList.length) * 100)
      : 0;

  const setMastered = (item: VocabularyItem, nextMastered: boolean) => {
    setMasteredIds((prev) => {
      const next = new Set(prev);
      if (nextMastered) {
        next.add(item.id);
      } else {
        next.delete(item.id);
      }
      writeMasteredIds(next);
      return next;
    });
  };

  const setReviewStatus = async (
    item: VocabularyItem,
    shouldReview: boolean
  ) => {
    const normalized = item.term.trim().toLowerCase();
    setReviewTerms((prev) => {
      const next = new Set(prev);
      if (shouldReview) {
        next.add(normalized);
      } else {
        next.delete(normalized);
      }
      return next;
    });

    if (shouldReview) {
      await storageAdapter.recordWeakPoints([item.term], []);
    } else {
      removeKeywordWeakPointLocally(item.term);
    }
  };

  const handleToggleMastered = (item: VocabularyItem) => {
    const currentlyMastered = masteredIds.has(item.id);
    setMastered(item, !currentlyMastered);
  };

  const handleToggleReview = (item: VocabularyItem) => {
    const normalized = item.term.trim().toLowerCase();
    const currentlyInReview = reviewTerms.has(normalized);
    void setReviewStatus(item, !currentlyInReview);
  };

  const handleFlashcardRate = (
    item: VocabularyItem,
    rating: FlashcardRating
  ) => {
    if (rating === "again") {
      setMastered(item, false);
      void setReviewStatus(item, true);
      return;
    }
    if (rating === "mastered") {
      setMastered(item, true);
      void setReviewStatus(item, false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-5 space-y-4">
      <div className="liquid-glass-card p-4 sm:px-5 sm:py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <Link
            href="/"
            className="liquid-glass-btn inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Trang chủ</span>
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2 leading-tight">
              <BookOpen className="w-5 h-5 text-sky-600 shrink-0" />
              <span className="truncate">
                {vocabList.length} Thuật Ngữ IT Thiết Yếu
              </span>
            </h1>
            <p className="text-xs text-slate-600 mt-0.5 line-clamp-1">
              Luyện phát âm chuẩn, ôn thẻ Active Recall và phản xạ ngữ cảnh kỹ thuật.
            </p>
          </div>
        </div>

        <div className="w-full lg:w-72 shrink-0 bg-sky-50/80 border border-slate-200/85 rounded-2xl px-3.5 py-2.5 space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-700">
              Đã thuộc{" "}
              <span className="font-mono text-sky-700 font-bold">
                {validMasteredCount}/{vocabList.length}
              </span>
            </span>
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              {reviewTerms.size > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100/90 border border-amber-300 text-amber-800 font-semibold">
                  {reviewTerms.size} cần ôn
                </span>
              )}
              <span className="font-bold text-slate-900">{masteryPercent}%</span>
            </div>
          </div>
          <div className="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden border border-slate-300/70">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-300"
              style={{ width: `${masteryPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Chế độ học từ vựng"
        className="grid grid-cols-2 lg:grid-cols-4 gap-2 p-1.5 liquid-glass-card-lite rounded-3xl"
      >
        {WORKSPACE_MODES.map((mode) => {
          const active = workspaceMode === mode.id;
          const ModeIcon = mode.icon;
          const activeClasses =
            mode.id === "dictionary"
              ? "!bg-sky-100/90 !border-sky-400/80 text-sky-900 shadow-sm"
              : mode.id === "flashcard"
                ? "!bg-violet-100/90 !border-violet-400/80 text-violet-900 shadow-sm"
                : mode.id === "quiz"
                  ? "!bg-amber-100/90 !border-amber-400/80 text-amber-900 shadow-sm"
                  : "!bg-emerald-100/90 !border-emerald-400/80 text-emerald-900 shadow-sm";
          return (
            <button
              key={mode.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setWorkspaceMode(mode.id)}
              className={`liquid-glass-pill inline-flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs sm:text-sm font-semibold leading-tight whitespace-normal sm:whitespace-nowrap transition-all text-center ${
                active
                  ? activeClasses
                  : "text-slate-700 hover:text-slate-900 hover:!border-sky-300"
              }`}
            >
              <ModeIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{mode.label}</span>
            </button>
          );
        })}
      </div>

      {workspaceMode === "dictionary" && (
        <div className="space-y-4">
          <div className="liquid-glass-card-lite rounded-3xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {VOCAB_CONTEXT_PILLS.map((pill) => {
                const active = selectedContext === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => {
                      setSelectedContext(pill.id);
                      setCurrentPage(1);
                    }}
                    className={`liquid-glass-pill px-3.5 py-1.5 text-xs font-semibold transition-all ${
                      active
                        ? "!bg-sky-100/90 !border-sky-400/80 text-sky-900 shadow-sm"
                        : "text-slate-700 hover:text-slate-900 hover:!border-sky-300"
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>

            <div className="relative w-full md:w-64 shrink-0">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Tìm kiếm thuật ngữ..."
                className="liquid-glass-input w-full pl-9 pr-3.5 py-2 text-xs font-mono rounded-full"
              />
            </div>
          </div>

          {paginatedItems.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedItems.map((item) => (
                  <VocabCard
                    key={item.id}
                    item={item}
                    isMastered={masteredIds.has(item.id)}
                    isMarkedForReview={reviewTerms.has(
                      item.term.trim().toLowerCase()
                    )}
                    onToggleMastered={handleToggleMastered}
                    onToggleReview={handleToggleReview}
                  />
                ))}
              </div>

              <div className="liquid-glass-card-lite rounded-3xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-slate-600 font-mono">
                  Hiển thị{" "}
                  <span className="font-semibold text-slate-900">
                    {(safePage - 1) * CARDS_PER_PAGE + 1}–
                    {Math.min(safePage * CARDS_PER_PAGE, filtered.length)}
                  </span>{" "}
                  trong tổng số{" "}
                  <span className="font-semibold text-slate-900">
                    {filtered.length}
                  </span>{" "}
                  thuật ngữ
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    className="liquid-glass-btn inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Trước</span>
                  </button>

                  {Array.from({ length: totalPages }, (_, idx) => idx + 1).map(
                    (pageNum) => {
                      const active = pageNum === safePage;
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-8 h-8 rounded-full text-xs font-mono font-semibold transition-all ${
                            active
                              ? "liquid-btn-primary text-white"
                              : "bg-white/85 text-slate-700 border border-slate-200/85 hover:text-slate-900 hover:bg-sky-50/80"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    }
                  )}

                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    className="liquid-glass-btn inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  >
                    <span>Sau</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="liquid-glass-card p-8 text-center text-xs text-slate-600">
              {vocabList.length === 0
                ? "Chưa có thuật ngữ nào trong thư viện."
                : `Không tìm thấy thuật ngữ nào phù hợp với bộ lọc hiện tại${
                    searchQuery.trim() ? ` ("${searchQuery}")` : ""
                  }.`}
            </div>
          )}
        </div>
      )}

      {workspaceMode === "flashcard" && (
        <div className="space-y-3">
          <div className="liquid-glass-card-lite rounded-3xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
              <Layers className="w-4 h-4 text-violet-600" />
              <span>Chế độ Lật Thẻ Active Recall ({filtered.length} thuật ngữ)</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {VOCAB_CONTEXT_PILLS.map((pill) => {
                const active = selectedContext === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setSelectedContext(pill.id)}
                    className={`liquid-glass-pill px-3 py-1 text-[11px] font-semibold transition-all ${
                      active
                        ? "!bg-violet-100/90 !border-violet-400/80 text-violet-900"
                        : "text-slate-700 hover:text-slate-900 hover:!border-violet-300"
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>
          </div>

          <VocabFlashcardDeck
            items={filtered}
            masteredIds={masteredIds}
            onRate={handleFlashcardRate}
          />
        </div>
      )}

      {workspaceMode === "quiz" && (
        <div ref={quizContainerRef}>
          <VocabContextQuiz items={vocabList} />
        </div>
      )}

      {workspaceMode === "cluster" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clusteredGroups.map((cluster) => (
            <div
              key={cluster.clusterTitle}
              className="liquid-glass-card-lite rounded-3xl p-4 sm:p-5 flex flex-col justify-between gap-4 hover:!border-sky-300 transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-sky-600 shrink-0" />
                    <h2 className="text-sm sm:text-base font-bold text-slate-900">
                      {cluster.clusterTitle}
                    </h2>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100/90 border border-amber-300 text-[10px] font-mono font-semibold text-amber-800">
                      +3 Coin
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-white/85 border border-slate-200/85 text-[11px] font-mono text-slate-700">
                      {cluster.items.length} từ
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {cluster.items.map((item) => (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50/80 border border-slate-200/85 text-xs font-mono text-slate-800"
                    >
                      <Zap className="w-3 h-3 text-sky-600 shrink-0" />
                      <span>{item.term}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200/85 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-600">
                  Tối đa 8 thuật ngữ mỗi lượt luyện nói AI
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setActiveCluster({
                      clusterTitle: cluster.clusterTitle,
                      terms: cluster.items
                        .slice(0, 8)
                        .map((item) => item.term),
                    })
                  }
                  className="liquid-btn-success text-white inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-all shrink-0"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Luyện nói với cụm từ này</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ClusterSpeakingModal
        isOpen={Boolean(activeCluster)}
        clusterTitle={activeCluster?.clusterTitle ?? ""}
        terms={activeCluster?.terms ?? []}
        onClose={() => setActiveCluster(null)}
      />
    </div>
  );
}

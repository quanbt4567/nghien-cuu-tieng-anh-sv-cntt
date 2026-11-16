"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Layers,
  LayoutGrid,
  Mic,
  Search,
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

type ViewMode = "grid" | "flashcard";

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
  } catch {
  }
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
  } catch {
  }
}

export default function VocabularyPage() {
  const [vocabList, setVocabList] = useState<VocabularyItem[]>(VOCABULARY_LIST);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContext, setSelectedContext] =
    useState<VocabWorkContext>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());
  const [reviewTerms, setReviewTerms] = useState<Set<string>>(new Set());
  const [activeCluster, setActiveCluster] = useState<{
    clusterTitle: string;
    terms: string[];
  } | null>(null);

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

  const filtered = useMemo(
    () => filterAndRankVocabulary(vocabList, searchQuery, selectedContext),
    [vocabList, searchQuery, selectedContext]
  );

  const clusteredGroups = useMemo(
    () => groupVocabularyByCluster(filtered),
    [filtered]
  );

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
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white text-ink text-xs font-medium border border-ink/15 shadow-soft hover:bg-paper-muted shadow-hard-press transition-all mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Trang chủ</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-normal text-ink flex items-center gap-2.5 leading-snug">
            <BookOpen className="w-6 h-6 text-accent shrink-0" />
            <span>{vocabList.length} Thuật Ngữ IT Thiết Yếu</span>
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted mt-2 leading-relaxed tracking-normal">
            Luyện phát âm chuẩn, ôn thẻ Active Recall và kiểm tra phản xạ ngữ cảnh kỹ thuật hàng ngày.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm thuật ngữ..."
            className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-white border border-ink/20 rounded-pill text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent shadow-soft"
          />
        </div>
      </div>

      <div className="bg-white border border-ink/15 rounded-2xl p-4 sm:p-5 shadow-soft space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="font-semibold text-ink">
            Đã thuộc{" "}
            <span className="font-mono text-accent">
              {validMasteredCount}/{vocabList.length}
            </span>{" "}
            từ
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-ink-muted">
            {reviewTerms.size > 0 && (
              <span className="px-2 py-0.5 rounded-pill bg-amber-50 border border-amber-200 text-amber-800">
                {reviewTerms.size} từ cần ôn lại
              </span>
            )}
            <span className="font-bold text-ink">{masteryPercent}%</span>
          </div>
        </div>
        <div className="w-full h-2.5 bg-paper-muted rounded-full overflow-hidden border border-ink/10">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${masteryPercent}%` }}
          />
        </div>
      </div>

      <VocabContextQuiz items={vocabList} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {VOCAB_CONTEXT_PILLS.map((pill) => {
            const active = selectedContext === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setSelectedContext(pill.id)}
                className={`px-3 py-1.5 rounded-pill text-xs font-medium border transition-all ${
                  active
                    ? "bg-ink text-white border-ink shadow-soft"
                    : "bg-white text-ink-muted border-ink/15 hover:text-ink hover:bg-paper-muted"
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        <div className="inline-flex items-center p-1 rounded-pill bg-white border border-ink/15 shadow-soft self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-medium transition-colors ${
              viewMode === "grid"
                ? "bg-accent text-white"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Danh sách</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("flashcard")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-medium transition-colors ${
              viewMode === "flashcard"
                ? "bg-accent text-white"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Flashcard</span>
          </button>
        </div>
      </div>

      {viewMode === "grid" ? (
        <>
          <div className="space-y-8 pt-1">
            {clusteredGroups.map((cluster) => (
              <section key={cluster.clusterTitle} className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-ink/15 rounded-2xl px-4 py-3 shadow-soft">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-sm sm:text-base font-bold text-ink">
                      {cluster.clusterTitle}
                    </h2>
                    <span className="px-2 py-0.5 rounded-pill bg-paper-muted border border-ink/10 text-[11px] font-mono text-ink-muted">
                      {cluster.items.length} từ
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveCluster({
                        clusterTitle: cluster.clusterTitle,
                        terms: cluster.items.slice(0, 8).map((item) => item.term),
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-pill bg-accent text-white text-xs font-semibold shadow-soft hover:opacity-95 transition-opacity"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Luyện nói với cụm từ này</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                  {cluster.items.map((item) => (
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
              </section>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="bg-white border border-ink/15 rounded-2xl p-8 text-center text-xs text-ink-muted shadow-soft">
              {vocabList.length === 0
                ? "Chưa có thuật ngữ nào trong thư viện."
                : `Không tìm thấy thuật ngữ nào phù hợp với bộ lọc hiện tại${
                    searchQuery.trim() ? ` ("${searchQuery}")` : ""
                  }.`}
            </div>
          )}
        </>
      ) : (
        <VocabFlashcardDeck
          items={filtered}
          masteredIds={masteredIds}
          onRate={handleFlashcardRate}
        />
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

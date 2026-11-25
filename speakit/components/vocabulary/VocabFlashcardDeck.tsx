"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  RotateCcw,
  Shuffle,
  Volume2,
  VolumeX,
  AlertCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { VocabularyItem } from "../../lib/types";
import { playTtsAudio, stopActiveTts } from "../../lib/tts-player";
import { storageAdapter } from "../../lib/storage";

export type FlashcardRating = "again" | "good" | "mastered";

interface VocabFlashcardDeckProps {
  items: VocabularyItem[];
  masteredIds: Set<string>;
  onRate: (item: VocabularyItem, rating: FlashcardRating) => void;
}

export function VocabFlashcardDeck({
  items,
  masteredIds,
  onRate,
}: VocabFlashcardDeckProps) {
  const [deck, setDeck] = useState<VocabularyItem[]>(items);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [playingTarget, setPlayingTarget] = useState<"word" | "sentence" | null>(
    null
  );
  const [sessionStats, setSessionStats] = useState({
    again: 0,
    good: 0,
    mastered: 0,
  });
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setDeck(items);
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsCompleted(false);
    setSessionStats({ again: 0, good: 0, mastered: 0 });
  }, [items]);

  useEffect(() => {
    return () => {
      if (cancelRef.current) {
        cancelRef.current();
        cancelRef.current = null;
      }
    };
  }, []);

  if (deck.length === 0) {
    return (
      <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-xl p-8 text-center text-sm text-slate-600 dark:text-slate-300">
        Không có thuật ngữ nào trong bộ lọc hiện tại để luyện Flashcard.
      </div>
    );
  }

  const currentItem = deck[Math.min(currentIndex, deck.length - 1)];

  const stopAudio = () => {
    if (cancelRef.current) {
      cancelRef.current();
      cancelRef.current = null;
    }
    stopActiveTts();
    setPlayingTarget(null);
  };

  const playSegment = (
    target: "word" | "sentence",
    text: string,
    rate: 0.8 | 1.0 | 1.2
  ) => {
    if (playingTarget === target) {
      stopAudio();
      return;
    }

    stopAudio();
    setPlayingTarget(target);
    const persona = storageAdapter.getSettings().voicePersona;

    cancelRef.current = playTtsAudio({
      text,
      rate,
      persona,
      onEnd: () => {
        cancelRef.current = null;
        setPlayingTarget((curr) => (curr === target ? null : curr));
      },
      onError: () => {
        cancelRef.current = null;
        setPlayingTarget((curr) => (curr === target ? null : curr));
      },
    });
  };

  const handleRate = (rating: FlashcardRating) => {
    stopAudio();
    onRate(currentItem, rating);
    setSessionStats((prev) => ({
      ...prev,
      [rating]: prev[rating] + 1,
    }));

    if (currentIndex + 1 >= deck.length) {
      setIsCompleted(true);
      setIsFlipped(false);
    } else {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
    }
  };

  const handleRestart = (shuffled: boolean) => {
    stopAudio();
    const nextDeck = shuffled
      ? [...items].sort(() => Math.random() - 0.5)
      : [...items];
    setDeck(nextDeck);
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsCompleted(false);
    setSessionStats({ again: 0, good: 0, mastered: 0 });
  };

  if (isCompleted) {
    return (
      <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-xl p-6 sm:p-8 text-center space-y-5">
        <div className="w-12 h-12 rounded-full bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50 text-balance">
            Hoàn thành lượt ôn tập Flashcard!
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Các từ đánh dấu &ldquo;Chưa thuộc&rdquo; đã được tự động thêm vào Kế hoạch 7 ngày.
          </p>
        </div>

        <div className="grid grid-cols-3 divide-x divide-slate-200 dark:divide-[#334155] border-y border-slate-200 dark:border-[#334155] max-w-md mx-auto py-3 tabular-nums">
          <div className="px-3">
            <div className="font-mono font-bold text-lg text-red-600 dark:text-red-400">
              {sessionStats.again}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
              Chưa thuộc
            </div>
          </div>
          <div className="px-3">
            <div className="font-mono font-bold text-lg text-amber-700 dark:text-amber-400">
              {sessionStats.good}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
              Tạm nhớ
            </div>
          </div>
          <div className="px-3">
            <div className="font-mono font-bold text-lg text-green-700 dark:text-green-400">
              {sessionStats.mastered}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
              Đã thuộc
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => handleRestart(false)}
            className="bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 text-white inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            <span>Ôn lại từ đầu</span>
          </button>
          <button
            type="button"
            onClick={() => handleRestart(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-blue-600 text-sm font-semibold transition-colors"
          >
            <Shuffle className="w-4 h-4" aria-hidden="true" />
            <span>Xáo trộn &amp; ôn lại</span>
          </button>
        </div>
      </div>
    );
  }

  const isCurrentMastered = masteredIds.has(currentItem.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2 font-mono text-slate-600 dark:text-slate-300 tabular-nums">
          <span className="px-3 py-1 rounded-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] text-slate-900 dark:text-slate-100 font-semibold text-xs">
            Thẻ {currentIndex + 1} / {deck.length}
          </span>
          {isCurrentMastered && (
            <span className="px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 text-xs font-semibold">
              Đã thuộc
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              stopAudio();
              setCurrentIndex((prev) => Math.max(0, prev - 1));
              setIsFlipped(false);
            }}
            disabled={currentIndex === 0}
            className="p-2 rounded-lg bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-40 transition-colors"
            aria-label="Thẻ trước"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              stopAudio();
              setCurrentIndex((prev) => Math.min(deck.length - 1, prev + 1));
              setIsFlipped(false);
            }}
            disabled={currentIndex >= deck.length - 1}
            className="p-2 rounded-lg bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-40 transition-colors"
            aria-label="Thẻ tiếp theo"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => handleRestart(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 focus-visible:ring-2 focus-visible:ring-blue-600 text-sm font-semibold transition-colors"
          >
            <Shuffle className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Xáo trộn</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-xl w-full min-h-[280px] p-6 sm:p-8 flex flex-col justify-between gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 font-semibold">
            {isFlipped ? "Mặt sau: Nghĩa & Ví dụ" : "Mặt trước: Active Recall"}
          </span>

          <button
            type="button"
            onClick={() => playSegment("word", currentItem.term, 1.0)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border focus-visible:ring-2 focus-visible:ring-blue-600 transition-colors ${
              playingTarget === "word"
                ? "bg-blue-700 dark:bg-blue-600 border-blue-700 dark:border-blue-600 text-white"
                : "bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60"
            }`}
          >
            {playingTarget === "word" ? (
              <VolumeX className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>Nghe từ</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsFlipped((prev) => !prev)}
          aria-pressed={isFlipped}
          className="w-full text-left rounded-lg p-2 -mx-2 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 focus-visible:ring-2 focus-visible:ring-blue-600 transition-colors"
        >
          {!isFlipped ? (
            <div className="py-6 text-center space-y-3">
              <div className="text-3xl sm:text-4xl font-bold font-mono text-slate-900 dark:text-slate-50 tracking-normal">
                {currentItem.term}
              </div>
              <div className="inline-block text-xs font-mono px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                {currentItem.partOfSpeech}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 pt-3">
                Bấm vào thẻ để lật xem phiên âm IPA, nghĩa tiếng Việt và ví dụ thực tế
              </p>
            </div>
          ) : (
            <div className="py-2 space-y-4">
              <div className="text-center space-y-1">
                <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-50">
                  {currentItem.term}
                </div>
                <div className="text-base font-ipa text-blue-700 dark:text-blue-400 font-medium">
                  {currentItem.phonetic}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-[#263349] rounded-lg px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-100 font-medium">
                {currentItem.meaningVI}
              </div>
            </div>
          )}
        </button>

        {isFlipped && (
          <div className="pt-3 border-t border-slate-200 dark:border-[#334155] space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-400">
                Ví dụ trong công việc:
              </span>
              <button
                type="button"
                onClick={() =>
                  playSegment("sentence", currentItem.exampleSentenceEN, 0.8)
                }
                className={`text-xs font-mono px-2.5 py-1 rounded-lg border flex items-center gap-1 font-semibold focus-visible:ring-2 focus-visible:ring-blue-600 transition-colors ${
                  playingTarget === "sentence"
                    ? "bg-blue-700 dark:bg-blue-600 border-blue-700 dark:border-blue-600 text-white"
                    : "bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60"
                }`}
              >
                {playingTarget === "sentence" ? (
                  <VolumeX className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>
                  {playingTarget === "sentence" ? "Dừng phát" : "Nghe câu mẫu"}
                </span>
              </button>
            </div>
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
              &ldquo;{currentItem.exampleSentenceEN}&rdquo;
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              {currentItem.exampleTranslationVI}
            </div>
          </div>
        )}

        <div className="text-center text-xs font-mono text-slate-600 dark:text-slate-400">
          {isFlipped ? "Chọn mức độ ghi nhớ bên dưới" : "Nhấn vào phần nội dung để lật thẻ"}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={() => handleRate("again")}
          className="bg-red-600 hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-600 text-white flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
        >
          <AlertCircle className="w-4 h-4" aria-hidden="true" />
          <span>Chưa thuộc (Thêm vào 7-Day Plan)</span>
        </button>

        <button
          type="button"
          onClick={() => handleRate("good")}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-sm font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
        >
          <Clock className="w-4 h-4" />
          <span>Tạm nhớ</span>
        </button>

        <button
          type="button"
          onClick={() => handleRate("mastered")}
          className="bg-green-700 hover:bg-green-800 text-white flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Đã thuộc</span>
        </button>
      </div>
    </div>
  );
}

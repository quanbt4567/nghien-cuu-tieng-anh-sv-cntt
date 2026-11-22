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
      <div className="liquid-glass-card p-8 text-center text-xs text-slate-300">
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
      <div className="liquid-glass-card p-6 sm:p-8 text-center space-y-5">
        <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-400/45 text-emerald-300 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white">
            Hoàn thành lượt ôn tập Flashcard!
          </h3>
          <p className="text-xs text-slate-300">
            Các từ đánh dấu &quot;Chưa thuộc&quot; đã được tự động thêm vào Kế hoạch 7 ngày (/progress).
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 max-w-md mx-auto text-xs">
          <div className="bg-rose-500/15 border border-rose-400/35 rounded-xl p-3">
            <div className="font-mono font-bold text-base text-rose-200">
              {sessionStats.again}
            </div>
            <div className="text-rose-300 mt-0.5">Chưa thuộc</div>
          </div>
          <div className="bg-amber-500/15 border border-amber-400/35 rounded-xl p-3">
            <div className="font-mono font-bold text-base text-amber-200">
              {sessionStats.good}
            </div>
            <div className="text-amber-300 mt-0.5">Tạm nhớ</div>
          </div>
          <div className="bg-emerald-500/15 border border-emerald-400/35 rounded-xl p-3">
            <div className="font-mono font-bold text-base text-emerald-200">
              {sessionStats.mastered}
            </div>
            <div className="text-emerald-300 mt-0.5">Đã thuộc</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => handleRestart(false)}
            className="liquid-btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Ôn lại từ đầu</span>
          </button>
          <button
            type="button"
            onClick={() => handleRestart(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-violet-500/25 border border-violet-400/50 text-violet-100 hover:bg-violet-500/35 text-xs font-semibold transition-all"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>Xáo trộn &amp; ôn lại</span>
          </button>
        </div>
      </div>
    );
  }

  const isCurrentMastered = masteredIds.has(currentItem.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 font-mono text-slate-300">
          <span className="liquid-glass-pill px-3 py-1 text-white font-semibold">
            Thẻ {currentIndex + 1} / {deck.length}
          </span>
          {isCurrentMastered && (
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/45 text-emerald-200 font-medium">
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
            className="liquid-glass-btn p-1.5 rounded-full disabled:opacity-40"
            aria-label="Thẻ trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              stopAudio();
              setCurrentIndex((prev) => Math.min(deck.length - 1, prev + 1));
              setIsFlipped(false);
            }}
            disabled={currentIndex >= deck.length - 1}
            className="liquid-glass-btn p-1.5 rounded-full disabled:opacity-40"
            aria-label="Thẻ tiếp theo"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleRestart(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-500/20 border border-violet-400/45 text-violet-100 hover:bg-violet-500/35 font-medium transition-colors"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>Xáo trộn</span>
          </button>
        </div>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsFlipped((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsFlipped((prev) => !prev);
          }
        }}
        className="liquid-glass-card w-full min-h-[280px] p-6 sm:p-8 cursor-pointer flex flex-col justify-between transition-all hover:!border-cyan-400/55 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-violet-500/20 border border-violet-400/40 text-violet-200">
            {isFlipped ? "Mặt sau • Nghĩa & Ví dụ" : "Mặt trước • Active Recall"}
          </span>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              playSegment("word", currentItem.term, 1.0);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-semibold transition-colors ${
              playingTarget === "word"
                ? "liquid-btn-primary"
                : "bg-cyan-500/20 border border-cyan-400/45 text-cyan-200 hover:bg-cyan-500/35 hover:text-white"
            }`}
          >
            {playingTarget === "word" ? (
              <VolumeX className="w-3.5 h-3.5" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
            <span>Nghe từ</span>
          </button>
        </div>

        {!isFlipped ? (
          <div className="py-8 text-center space-y-3">
            <div className="text-3xl sm:text-4xl font-bold font-mono text-white tracking-normal">
              {currentItem.term}
            </div>
            <div className="inline-block text-xs font-mono uppercase px-2.5 py-0.5 rounded-full bg-white/[0.08] border border-white/15 text-slate-300">
              {currentItem.partOfSpeech}
            </div>
            <p className="text-xs text-slate-300 pt-3">
              Bấm vào thẻ để lật xem phiên âm IPA, nghĩa tiếng Việt và ví dụ thực tế
            </p>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            <div className="text-center space-y-1">
              <div className="text-2xl font-bold font-mono text-white">
                {currentItem.term}
              </div>
              <div className="text-base font-ipa text-cyan-300 font-medium">
                {currentItem.phonetic}
              </div>
            </div>

            <div className="bg-slate-950/55 border border-white/12 rounded-xl p-3.5 text-xs sm:text-sm text-slate-100 font-medium text-center">
              {currentItem.meaningVI}
            </div>

            <div
              className="bg-slate-950/60 border border-white/15 rounded-xl p-3.5 space-y-1.5 text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] uppercase font-bold text-slate-400">
                  Ví dụ trong công việc:
                </span>
                <button
                  type="button"
                  onClick={() =>
                    playSegment("sentence", currentItem.exampleSentenceEN, 0.8)
                  }
                  className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-violet-500/20 border border-violet-400/40 text-violet-200 hover:bg-violet-500/35 hover:text-white flex items-center gap-1 font-semibold transition-colors"
                >
                  {playingTarget === "sentence" ? (
                    <VolumeX className="w-3.5 h-3.5" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {playingTarget === "sentence" ? "Dừng phát" : "Nghe câu mẫu"}
                  </span>
                </button>
              </div>
              <div className="font-medium text-white leading-relaxed">
                &quot;{currentItem.exampleSentenceEN}&quot;
              </div>
              <div className="text-slate-300 text-[11px]">
                {currentItem.exampleTranslationVI}
              </div>
            </div>
          </div>
        )}

        <div className="text-center text-[11px] font-mono text-slate-400">
          {isFlipped ? "Chọn mức độ ghi nhớ bên dưới" : "Nhấn để lật thẻ"}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={() => handleRate("again")}
          className="liquid-btn-danger flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all"
        >
          <AlertCircle className="w-4 h-4" />
          <span>Chưa thuộc (Thêm vào 7-Day Plan)</span>
        </button>

        <button
          type="button"
          onClick={() => handleRate("good")}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500/25 border border-amber-400/50 text-amber-100 text-xs font-semibold hover:bg-amber-500/35 transition-all shadow-[0_0_16px_rgba(245,158,11,0.2)]"
        >
          <Clock className="w-4 h-4" />
          <span>Tạm nhớ</span>
        </button>

        <button
          type="button"
          onClick={() => handleRate("mastered")}
          className="liquid-btn-success flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Đã thuộc</span>
        </button>
      </div>
    </div>
  );
}

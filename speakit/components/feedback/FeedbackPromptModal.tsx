"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { CheckCircle2, Star } from "lucide-react";
import {
  canShowFeedbackPrompt,
  recordFeedbackDismissed,
  recordFeedbackPromptShown,
  recordFeedbackSubmitted,
} from "../../lib/feedbackPrompt";

interface FeedbackPromptModalProps {
  trigger: boolean;
  context: string;
}

const CATEGORIES = ["Giao diá»‡n", "Ã‚m thanh/Mic", "Ná»™i dung", "KhÃ¡c"] as const;

export function FeedbackPromptModal({
  trigger,
  context,
}: FeedbackPromptModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [category, setCategory] = useState("");
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!trigger) {
      return;
    }

    openTimerRef.current = window.setTimeout(() => {
      if (canShowFeedbackPrompt()) {
        recordFeedbackPromptShown();
        setIsOpen(true);
      }
    }, 1200);

    return () => {
      if (openTimerRef.current !== null) {
        window.clearTimeout(openTimerRef.current);
        openTimerRef.current = null;
      }
    };
  }, [trigger]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  if (!isOpen) {
    return null;
  }

  const handleDismiss = () => {
    recordFeedbackDismissed();
    setIsOpen(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (rating < 1 || rating > 5 || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          category: category || undefined,
          comment: comment.trim() || undefined,
          context,
        }),
      });
    } catch {
    } finally {
      recordFeedbackSubmitted();
      setIsSubmitting(false);
      setIsSubmitted(true);
      closeTimerRef.current = window.setTimeout(() => {
        setIsOpen(false);
      }, 1500);
    }
  };

  const activeRating = hoveredRating || rating;

  return (
    <div
      role="dialog"
      aria-label="Pháº£n há»“i tráº£i nghiá»‡m"
      className="fixed bottom-4 right-4 z-50 max-w-sm w-[calc(100%-2rem)] bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4"
    >
      {isSubmitted ? (
        <div className="flex items-center gap-2.5 py-2 text-slate-900 dark:text-slate-50">
          <CheckCircle2 className="w-5 h-5 text-green-700 dark:text-green-400 shrink-0" />
          <p className="text-sm font-semibold">
            Cáº£m Æ¡n báº¡n Ä‘Ã£ gá»­i gÃ³p Ã½ cho SpeakIT!
          </p>
        </div>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50">
              Tráº£i nghiá»‡m cá»§a báº¡n tháº¿ nÃ o?
            </h3>
            <div className="flex items-center gap-1.5 pt-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  aria-label={`ÄÃ¡nh giÃ¡ ${star} sao`}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Star
                    className={`w-5 h-5 transition-colors ${
                      star <= activeRating
                        ? "fill-amber-400 text-amber-400"
                        : "text-slate-300 dark:text-slate-600"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((item) => {
              const selected = category === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(selected ? "" : item)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    selected
                      ? "bg-blue-700 text-white border-blue-700 dark:bg-blue-600 dark:border-blue-600"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>

          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            placeholder="GÃ³p Ã½ ngáº¯n (khÃ´ng báº¯t buá»™c)..."
            aria-label="GÃ³p Ã½ ngáº¯n"
            className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-50 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:border-blue-700 dark:focus:border-blue-500"
          />

          <div className="flex items-center justify-end gap-2 pt-0.5">
            <button
              type="button"
              onClick={handleDismiss}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:border-blue-700 text-xs font-medium transition-colors"
            >
              Äá»ƒ sau
            </button>
            <button
              type="submit"
              disabled={rating === 0 || isSubmitting}
              className="px-4 py-1.5 rounded-lg bg-green-700 hover:bg-green-800 text-white font-semibold text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? "Äang gá»­i..." : "Gá»­i gÃ³p Ã½"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

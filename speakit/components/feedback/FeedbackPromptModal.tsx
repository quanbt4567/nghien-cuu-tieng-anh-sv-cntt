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

const CATEGORIES = ["Giao diện", "Âm thanh/Mic", "Nội dung", "Khác"] as const;

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
      aria-label="Phản hồi trải nghiệm"
      className="fixed bottom-4 right-4 z-50 max-w-sm w-[calc(100%-2rem)] liquid-glass-card !bg-slate-950/90 p-4"
    >
      {isSubmitted ? (
        <div className="flex items-center gap-2.5 py-2 text-white">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="text-sm font-semibold">
            Cảm ơn bạn đã gửi góp ý cho SpeakIT!
          </p>
        </div>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">
              Trải nghiệm của bạn thế nào?
            </h3>
            <div className="flex items-center gap-1.5 pt-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  aria-label={`Đánh giá ${star} sao`}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <Star
                    className={`w-5 h-5 transition-colors ${
                      star <= activeRating
                        ? "fill-amber-400 text-amber-400"
                        : "text-slate-500"
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
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                    selected
                      ? "bg-cyan-500/25 text-cyan-100 border-cyan-400/55"
                      : "bg-white/[0.06] text-slate-300 border-white/15 hover:text-white hover:bg-white/[0.12]"
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
            placeholder="Góp ý ngắn (không bắt buộc)..."
            aria-label="Góp ý ngắn"
            className="liquid-glass-input w-full px-3 py-2 text-xs rounded-xl"
          />

          <div className="flex items-center justify-end gap-2 pt-0.5">
            <button
              type="button"
              onClick={handleDismiss}
              className="liquid-glass-btn px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
            >
              Để sau
            </button>
            <button
              type="submit"
              disabled={rating === 0 || isSubmitting}
              className="liquid-btn-success px-4 py-1.5 rounded-full text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? "Đang gửi..." : "Gửi góp ý"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

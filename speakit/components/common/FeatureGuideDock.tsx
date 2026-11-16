"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  BellOff,
  Check,
  Coins,
  Compass,
  HelpCircle,
  Lightbulb,
  RotateCcw,
  X,
} from "lucide-react";
import {
  areAllGuidesDisabled,
  dismissGuide,
  resolveGuideForPath,
  setAllGuidesDisabled,
  shouldAutoOpenGuide,
} from "../../lib/feature-guides";

export function FeatureGuideDock() {
  const pathname = usePathname() ?? "";
  const guide = resolveGuideForPath(pathname);
  const [isOpen, setIsOpen] = useState(false);
  const [autoDisabled, setAutoDisabled] = useState(false);
  const [reenabledNotice, setReenabledNotice] = useState(false);

  useEffect(() => {
    setReenabledNotice(false);
    if (!guide) {
      setIsOpen(false);
      return;
    }
    setAutoDisabled(areAllGuidesDisabled());
    setIsOpen(shouldAutoOpenGuide(pathname));
  }, [guide, pathname]);

  const handleAcknowledge = useCallback(() => {
    if (guide) {
      dismissGuide(guide.id);
    }
    setIsOpen(false);
  }, [guide]);

  const handleDisableAutoGuides = useCallback(() => {
    setAllGuidesDisabled(true);
    if (guide) {
      dismissGuide(guide.id);
    }
    setAutoDisabled(true);
    setReenabledNotice(false);
    setIsOpen(false);
  }, [guide]);

  const handleEnableAutoGuides = useCallback(() => {
    setAllGuidesDisabled(false);
    setAutoDisabled(false);
    setReenabledNotice(true);
  }, []);

  const handleOpenManual = useCallback(() => {
    setAutoDisabled(areAllGuidesDisabled());
    setReenabledNotice(false);
    setIsOpen(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleAcknowledge();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleAcknowledge, isOpen]);

  if (!guide) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpenManual}
        aria-label={`Mở hướng dẫn: ${guide.title}`}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-pill bg-white hover:bg-paper-muted text-ink border border-ink/20 text-xs font-semibold shadow-card shadow-hard-press transition-all"
      >
        <HelpCircle className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
        <span>Hướng dẫn</span>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="feature-guide-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleAcknowledge();
            }
          }}
          className="fixed inset-0 z-[45] bg-ink/40 backdrop-blur-[2px] flex items-center justify-center p-4"
        >
          <div className="w-full max-w-lg max-h-[88vh] overflow-y-auto bg-white border border-ink/20 rounded-2xl p-5 sm:p-6 shadow-card space-y-4 relative">
            <button
              type="button"
              onClick={handleAcknowledge}
              aria-label="Đóng hướng dẫn"
              className="absolute top-4 right-4 w-8 h-8 rounded-pill bg-paper border border-ink/15 text-ink-muted hover:text-ink hover:bg-paper-muted flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>

            <div className="flex items-start gap-3 pr-9">
              <div className="w-10 h-10 rounded-pill bg-accent-light border border-accent/30 flex items-center justify-center shrink-0">
                <Compass className="w-5 h-5 text-accent" aria-hidden="true" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-ink-muted">
                    Hướng dẫn nhanh
                  </span>
                  {guide.rewardBadge && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-amber-100 border border-amber-300 text-amber-900 text-[11px] font-mono font-bold">
                      <Coins className="w-3 h-3 shrink-0" aria-hidden="true" />
                      <span>{guide.rewardBadge}</span>
                    </span>
                  )}
                  {autoDisabled && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-pill bg-paper border border-ink/15 text-ink-muted text-[11px] font-mono">
                      Tự động đang tắt
                    </span>
                  )}
                </div>
                <h2 id="feature-guide-title" className="text-base sm:text-lg font-bold text-ink leading-snug">
                  {guide.title}
                </h2>
                <p className="text-xs text-ink-muted leading-relaxed">
                  {guide.subtitle}
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-ink-muted">
                Các bước thực hiện
              </div>
              <ol className="space-y-2.5">
                {guide.steps.map((step, index) => (
                  <li key={index} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-ink text-white text-[11px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {index + 1}
                    </span>
                    <span className="text-xs sm:text-sm text-ink leading-relaxed">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            {guide.tips.length > 0 && (
              <div className="bg-paper border border-ink/15 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
                  <Lightbulb className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
                  <span>Mẹo hữu ích</span>
                </div>
                <ul className="space-y-1 text-xs text-ink-muted leading-relaxed list-disc pl-4">
                  {guide.tips.map((tip, index) => (
                    <li key={index}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}

            {reenabledNotice && (
              <div
                role="status"
                className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-medium text-emerald-700"
              >
                Đã bật lại hướng dẫn tự động cho các tính năng bạn chưa xem.
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleAcknowledge}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-pill bg-accent hover:bg-accent-hover text-white text-xs sm:text-sm font-semibold shadow-soft shadow-hard-press transition-all"
              >
                <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Tôi đã hiểu</span>
              </button>

              {autoDisabled ? (
                <button
                  type="button"
                  onClick={handleEnableAutoGuides}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-pill bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-semibold border border-sky-200 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Bật lại hướng dẫn tự động</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDisableAutoGuides}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-pill bg-paper hover:bg-paper-muted text-ink-muted hover:text-ink text-xs font-semibold border border-ink/15 transition-colors"
                >
                  <BellOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Tắt hướng dẫn tự động</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

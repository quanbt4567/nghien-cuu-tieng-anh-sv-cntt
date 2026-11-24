"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
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
  computePopoverLayout,
  DEFAULT_TOUR_POPOVER_HEIGHT,
  DEFAULT_TOUR_POPOVER_WIDTH,
  dismissGuide,
  resolveGuideForPath,
  setAllGuidesDisabled,
  shouldAutoOpenGuide,
  TOUR_SPOTLIGHT_PADDING,
  type FeatureTourStop,
  type TourPopoverArrow,
  type TourRectBox,
  type TourViewportSize,
} from "../../lib/feature-guides";

const CANDIDATE_TIERS = [
  'button, a, [role="tab"], input, textarea, select, label',
  "h1, h2, h3",
  "section",
] as const;

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function isElementVisible(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el.closest('[data-feature-guide-dock="true"]')) return false;
  if (el.offsetWidth <= 0 || el.offsetHeight <= 0) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  return true;
}

function getElementSearchLabels(el: HTMLElement): string[] {
  const labels: string[] = [];
  const text = normalizeText(el.innerText || el.textContent);
  if (text) labels.push(text);
  const ariaLabel = normalizeText(el.getAttribute("aria-label"));
  if (ariaLabel) labels.push(ariaLabel);
  const title = normalizeText(el.getAttribute("title"));
  if (title) labels.push(title);
  const placeholder = normalizeText(el.getAttribute("placeholder"));
  if (placeholder) labels.push(placeholder);
  return labels;
}

function findTargetElement(stop: FeatureTourStop): HTMLElement | null {
  if (typeof document === "undefined") return null;

  for (const selector of stop.selectors ?? []) {
    const trimmed = selector.trim();
    if (!trimmed) continue;
    try {
      const matched = Array.from(document.querySelectorAll(trimmed));
      for (const node of matched) {
        if (isElementVisible(node)) {
          return node;
        }
      }
    } catch {
      continue;
    }
  }

  const needles = (stop.matchTexts ?? [])
    .map((text) => normalizeText(text))
    .filter(Boolean);
  if (needles.length === 0) return null;

  for (const tierSelector of CANDIDATE_TIERS) {
    const visibleCandidates = Array.from(
      document.querySelectorAll(tierSelector)
    ).filter(isElementVisible);

    if (visibleCandidates.length === 0) continue;

    for (const needle of needles) {
      for (const el of visibleCandidates) {
        const labels = getElementSearchLabels(el);
        if (labels.some((label) => label === needle)) {
          return el;
        }
      }

      let bestPartial: HTMLElement | null = null;
      let bestTextLength = Number.POSITIVE_INFINITY;
      for (const el of visibleCandidates) {
        const labels = getElementSearchLabels(el);
        if (labels.some((label) => label.includes(needle))) {
          const textLen = (el.textContent ?? "").trim().length;
          if (textLen < bestTextLength) {
            bestPartial = el;
            bestTextLength = textLen;
          }
        }
      }
      if (bestPartial) {
        return bestPartial;
      }
    }
  }

  return null;
}

function rectsClose(a: TourRectBox | null, b: TourRectBox | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

function buildSpotlightRect(
  targetRect: TourRectBox | null,
  viewport: TourViewportSize
): TourRectBox | null {
  if (!targetRect || viewport.width <= 0 || viewport.height <= 0) return null;
  const targetRight = targetRect.left + targetRect.width;
  const targetBottom = targetRect.top + targetRect.height;
  if (
    targetRight <= 0 ||
    targetBottom <= 0 ||
    targetRect.left >= viewport.width ||
    targetRect.top >= viewport.height
  ) {
    return null;
  }

  const top = Math.max(2, targetRect.top - TOUR_SPOTLIGHT_PADDING);
  const left = Math.max(2, targetRect.left - TOUR_SPOTLIGHT_PADDING);
  const right = Math.min(
    viewport.width - 2,
    targetRight + TOUR_SPOTLIGHT_PADDING
  );
  const bottom = Math.min(
    viewport.height - 2,
    targetBottom + TOUR_SPOTLIGHT_PADDING
  );
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return null;

  return { top, left, width, height };
}

function PopoverArrowPointer({ arrow }: { arrow: TourPopoverArrow }) {
  if (arrow.side === "top") {
    return (
      <svg
        width="22"
        height="13"
        viewBox="0 0 22 13"
        aria-hidden="true"
        className="absolute pointer-events-none"
        style={{ top: -12, left: arrow.offset - 11 }}
      >
        <path d="M2 13 L11 1 L20 13 Z" className="fill-white dark:fill-[#1E293B]" />
        <path
          d="M2 11 L11 1 L20 11"
          fill="none"
          className="stroke-slate-200 dark:stroke-slate-800"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (arrow.side === "bottom") {
    return (
      <svg
        width="22"
        height="13"
        viewBox="0 0 22 13"
        aria-hidden="true"
        className="absolute pointer-events-none"
        style={{ bottom: -12, left: arrow.offset - 11 }}
      >
        <path d="M2 0 L11 12 L20 0 Z" className="fill-white dark:fill-[#1E293B]" />
        <path
          d="M2 2 L11 12 L20 2"
          fill="none"
          className="stroke-slate-200 dark:stroke-slate-800"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (arrow.side === "left") {
    return (
      <svg
        width="13"
        height="22"
        viewBox="0 0 13 22"
        aria-hidden="true"
        className="absolute pointer-events-none"
        style={{ left: -12, top: arrow.offset - 11 }}
      >
        <path d="M13 2 L1 11 L13 20 Z" className="fill-white dark:fill-[#1E293B]" />
        <path
          d="M11 2 L1 11 L11 20"
          fill="none"
          className="stroke-slate-200 dark:stroke-slate-800"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      width="13"
      height="22"
      viewBox="0 0 13 22"
      aria-hidden="true"
      className="absolute pointer-events-none"
      style={{ right: -12, top: arrow.offset - 11 }}
    >
      <path d="M0 2 L12 11 L0 20 Z" className="fill-white dark:fill-[#1E293B]" />
      <path
        d="M2 2 L12 11 L2 20"
        fill="none"
        className="stroke-slate-200 dark:stroke-slate-800"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FeatureGuideDock() {
  const rawId = useId();
  const maskId = `feature-guide-mask-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const pathname = usePathname() ?? "";
  const guide = resolveGuideForPath(pathname);

  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [autoDisabled, setAutoDisabled] = useState(false);
  const [reenabledNotice, setReenabledNotice] = useState(false);
  const [targetRect, setTargetRect] = useState<TourRectBox | null>(null);
  const [viewport, setViewport] = useState<TourViewportSize>({
    width: 1280,
    height: 720,
  });
  const [popoverSize, setPopoverSize] = useState<{
    width: number;
    height: number;
  }>({
    width: DEFAULT_TOUR_POPOVER_WIDTH,
    height: DEFAULT_TOUR_POPOVER_HEIGHT,
  });

  const popoverRef = useRef<HTMLDivElement | null>(null);
  const scrolledStepKeyRef = useRef<string | null>(null);
  const rafMeasureRef = useRef<number | null>(null);
  const smoothTrackRafRef = useRef<number | null>(null);

  const tourStops = guide?.tourStops ?? [];
  const totalStops = tourStops.length;
  const safeStepIndex =
    totalStops > 0 ? Math.min(Math.max(0, stepIndex), totalStops - 1) : 0;
  const activeStop = tourStops[safeStepIndex] ?? null;

  useEffect(() => {
    setReenabledNotice(false);
    setStepIndex(0);
    setTargetRect(null);
    scrolledStepKeyRef.current = null;
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
    setStepIndex(0);
    setTargetRect(null);
    scrolledStepKeyRef.current = null;
    setIsOpen(true);
  }, []);

  const handlePrevStep = useCallback(() => {
    setStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNextStep = useCallback(() => {
    if (totalStops <= 0 || safeStepIndex >= totalStops - 1) {
      handleAcknowledge();
      return;
    }
    setStepIndex((prev) => Math.min(totalStops - 1, prev + 1));
  }, [handleAcknowledge, safeStepIndex, totalStops]);

  useEffect(() => {
    if (!isOpen) return;
    popoverRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleAcknowledge();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setStepIndex((prev) =>
          totalStops > 0 ? Math.min(totalStops - 1, prev + 1) : 0
        );
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setStepIndex((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleAcknowledge, isOpen, totalStops]);

  useEffect(() => {
    if (!isOpen || !guide || !activeStop) {
      setTargetRect(null);
      scrolledStepKeyRef.current = null;
      return;
    }

    const stepKey = `${guide.id}:${safeStepIndex}`;

    const measureNow = () => {
      const nextVw = window.innerWidth;
      const nextVh = window.innerHeight;
      setViewport((prev) =>
        prev.width === nextVw && prev.height === nextVh
          ? prev
          : { width: nextVw, height: nextVh }
      );

      const el = findTargetElement(activeStop);
      if (!el) {
        setTargetRect((prev) => (prev === null ? prev : null));
        return;
      }

      if (scrolledStepKeyRef.current !== stepKey) {
        scrolledStepKeyRef.current = stepKey;
        const rectBeforeScroll = el.getBoundingClientRect();
        if (nextVw < 640 && typeof window.scrollTo === "function") {
          if (
            rectBeforeScroll.top < 70 ||
            rectBeforeScroll.bottom > nextVh * 0.48
          ) {
            const targetScrollY = Math.max(
              0,
              window.scrollY + rectBeforeScroll.top - 74
            );
            window.scrollTo({ top: targetScrollY, behavior: "smooth" });
          }
        } else if (typeof el.scrollIntoView === "function") {
          el.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest",
          });
        }

        if (smoothTrackRafRef.current !== null) {
          window.cancelAnimationFrame(smoothTrackRafRef.current);
          smoothTrackRafRef.current = null;
        }
        const startedAt = performance.now();
        const followScroll = () => {
          const rect = el.getBoundingClientRect();
          if (el.isConnected && rect.width > 0 && rect.height > 0) {
            const box: TourRectBox = {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            };
            setTargetRect((prev) => (rectsClose(prev, box) ? prev : box));
          }
          if (performance.now() - startedAt < 720) {
            smoothTrackRafRef.current =
              window.requestAnimationFrame(followScroll);
          } else {
            smoothTrackRafRef.current = null;
          }
        };
        smoothTrackRafRef.current = window.requestAnimationFrame(followScroll);
      }

      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const nextBox: TourRectBox = {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        };
        setTargetRect((prev) => (rectsClose(prev, nextBox) ? prev : nextBox));
      } else {
        setTargetRect((prev) => (prev === null ? prev : null));
      }
    };

    const scheduleMeasure = () => {
      if (rafMeasureRef.current !== null) return;
      rafMeasureRef.current = window.requestAnimationFrame(() => {
        rafMeasureRef.current = null;
        measureNow();
      });
    };

    measureNow();

    window.addEventListener("scroll", scheduleMeasure, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", scheduleMeasure, { passive: true });

    const observer =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver((mutations) => {
            const hasExternalMutation = mutations.some((mutation) => {
              const target = mutation.target;
              return !(
                target instanceof Element &&
                target.closest('[data-feature-guide-dock="true"]')
              );
            });
            if (hasExternalMutation) {
              scheduleMeasure();
            }
          })
        : null;

    if (observer && document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
      });
    }

    return () => {
      window.removeEventListener("scroll", scheduleMeasure, {
        capture: true,
      });
      window.removeEventListener("resize", scheduleMeasure);
      observer?.disconnect();
      if (rafMeasureRef.current !== null) {
        window.cancelAnimationFrame(rafMeasureRef.current);
        rafMeasureRef.current = null;
      }
      if (smoothTrackRafRef.current !== null) {
        window.cancelAnimationFrame(smoothTrackRafRef.current);
        smoothTrackRafRef.current = null;
      }
    };
  }, [activeStop, guide, isOpen, safeStepIndex]);

  useLayoutEffect(() => {
    if (!isOpen || !popoverRef.current) return;
    const node = popoverRef.current;

    const updateSize = () => {
      const nextWidth = node.offsetWidth;
      const nextHeight = node.offsetHeight;
      if (nextWidth > 0 && nextHeight > 0) {
        setPopoverSize((prev) =>
          prev.width === nextWidth && prev.height === nextHeight
            ? prev
            : { width: nextWidth, height: nextHeight }
        );
      }
    };

    updateSize();

    if (typeof ResizeObserver === "undefined") return;
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(node);
    return () => resizeObserver.disconnect();
  }, [autoDisabled, isOpen, reenabledNotice, safeStepIndex]);

  const spotlightRect = useMemo(
    () => buildSpotlightRect(targetRect, viewport),
    [targetRect, viewport]
  );

  const popoverLayout = useMemo(
    () =>
      computePopoverLayout(
        spotlightRect,
        popoverSize,
        viewport,
        activeStop?.placement ?? "bottom",
        targetRect?.height
      ),
    [activeStop?.placement, popoverSize, spotlightRect, targetRect?.height, viewport]
  );

  if (!guide) {
    return null;
  }

  const isLastStep = totalStops > 0 && safeStepIndex === totalStops - 1;

  return (
    <>
      <button
        type="button"
        data-feature-guide-dock="true"
        onClick={handleOpenManual}
        aria-label="Hướng dẫn"
        title={`Mở hướng dẫn: ${guide.title}`}
        className="fixed bottom-20 right-3 md:bottom-5 md:right-5 z-40 inline-flex items-center justify-center gap-1.5 p-2.5 sm:px-3.5 sm:py-2 rounded-pill bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 shadow-sm text-slate-800 dark:text-slate-100 hover:text-blue-700 dark:hover:text-blue-400 hover:border-blue-500 text-xs font-semibold transition-colors"
      >
        <HelpCircle className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline">Hướng dẫn</span>
      </button>

      {isOpen && activeStop && (
        <div
          data-feature-guide-dock="true"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feature-guide-title"
          className="fixed inset-0 z-[70]"
        >
          <div
            onClick={handleAcknowledge}
            className="fixed inset-0"
            aria-hidden="true"
          >
            <svg
              className="fixed inset-0 w-full h-full pointer-events-none"
              width={viewport.width}
              height={viewport.height}
              viewBox={`0 0 ${viewport.width} ${viewport.height}`}
              aria-hidden="true"
            >
              <defs>
                <mask id={maskId}>
                  <rect
                    x="0"
                    y="0"
                    width={viewport.width}
                    height={viewport.height}
                    fill="white"
                  />
                  {spotlightRect && (
                    <rect
                      x={spotlightRect.left}
                      y={spotlightRect.top}
                      width={spotlightRect.width}
                      height={spotlightRect.height}
                      rx={12}
                      ry={12}
                      fill="black"
                    />
                  )}
                </mask>
              </defs>
              <rect
                x="0"
                y="0"
                width={viewport.width}
                height={viewport.height}
                fill="rgba(15, 23, 42, 0.52)"
                mask={`url(#${maskId})`}
              />
            </svg>
          </div>

          {spotlightRect && (
            <div
              aria-hidden="true"
              className="fixed pointer-events-none rounded-xl border-2 border-blue-600 dark:border-blue-400"
              style={{
                top: spotlightRect.top,
                left: spotlightRect.left,
                width: spotlightRect.width,
                height: spotlightRect.height,
              }}
            />
          )}

          <div
            ref={popoverRef}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="fixed z-[75] bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm focus:outline-none"
            style={{
              top: popoverLayout.top,
              left: popoverLayout.left,
              width: popoverLayout.width,
            }}
          >
            {popoverLayout.arrow && (
              <PopoverArrowPointer arrow={popoverLayout.arrow} />
            )}

            <div
              className="p-3.5 sm:p-5 space-y-3 overflow-y-auto max-h-[44vh] sm:max-h-none"
              style={{
                maxHeight:
                  viewport.width < 640
                    ? Math.max(116, popoverLayout.maxHeight - 4)
                    : popoverLayout.maxHeight,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-mono font-bold">
                    <Compass className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      Bước {safeStepIndex + 1} / {totalStops}
                    </span>
                  </span>
                  {guide.rewardBadge && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-mono font-bold">
                      <Coins className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{guide.rewardBadge}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleAcknowledge}
                    className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Bỏ qua
                  </button>
                  <button
                    type="button"
                    onClick={handleAcknowledge}
                    aria-label="Đóng hướng dẫn"
                    className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-xs font-mono font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider truncate">
                  {guide.title}
                </div>
                <h2
                  id="feature-guide-title"
                  className="font-display text-base font-bold text-slate-900 dark:text-white leading-snug"
                >
                  {activeStop.title}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {activeStop.description}
                </p>
              </div>

              {isLastStep && guide.tips.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                  <Lightbulb
                    className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>{guide.tips[0]}</span>
                </div>
              )}

              <div className="flex items-center justify-center gap-1.5 pt-0.5">
                {tourStops.map((stop, idx) => {
                  const isCurrent = idx === safeStepIndex;
                  return (
                    <button
                      key={`${stop.title}-${idx}`}
                      type="button"
                      onClick={() => setStepIndex(idx)}
                      aria-label={`Đi tới bước ${idx + 1}: ${stop.title}`}
                      aria-current={isCurrent ? "step" : undefined}
                      className={`h-2 rounded-pill transition-colors ${
                        isCurrent
                          ? "w-6 bg-blue-700 dark:bg-blue-400"
                          : "w-2 bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500"
                      }`}
                    />
                  );
                })}
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  disabled={safeStepIndex === 0}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg liquid-glass-btn text-xs font-semibold disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ArrowLeft className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Trước</span>
                </button>

                <button
                  type="button"
                  onClick={handleNextStep}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg liquid-btn-primary text-xs"
                >
                  {isLastStep ? (
                    <>
                      <span>Hoàn tất</span>
                      <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    </>
                  ) : (
                    <>
                      <span>Tiếp theo</span>
                      <ArrowRight
                        className="w-3.5 h-3.5 shrink-0"
                        aria-hidden="true"
                      />
                    </>
                  )}
                </button>
              </div>

              {reenabledNotice && (
                <div
                  role="status"
                  className="px-3 py-2 rounded-lg bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-xs font-medium text-green-700 dark:text-green-300"
                >
                  Đã bật lại hướng dẫn tự động cho các tính năng bạn chưa xem.
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                {autoDisabled ? (
                  <button
                    type="button"
                    onClick={handleEnableAutoGuides}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-semibold border border-blue-200 dark:border-blue-800 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Bật lại hướng dẫn tự động</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleDisableAutoGuides}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-medium border border-slate-200 dark:border-slate-700 transition-colors"
                  >
                    <BellOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Tắt hướng dẫn tự động</span>
                  </button>
                )}

                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 hidden sm:inline">
                  ← / → • Esc
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

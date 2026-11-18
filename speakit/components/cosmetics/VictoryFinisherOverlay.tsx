"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import confetti from "canvas-confetti";
import { Lottie } from "lottie-react";
import { Sparkles, Terminal, Zap, CheckCircle2 } from "lucide-react";
import "./cosmetics.css";

export interface VictoryFinisherOverlayProps {
  finisherId?: string | null;
  active: boolean;
  title?: string;
  subtitle?: string;
  onComplete?: () => void;
}

const VICTORY_LOTTIE_URL = "/lottie/victory-burst.json";
const victoryLottieCache = new Map<string, object>();
let victoryLottiePending: Promise<object | null> | null = null;

function loadVictoryLottie(): Promise<object | null> {
  const cached = victoryLottieCache.get(VICTORY_LOTTIE_URL);
  if (cached) return Promise.resolve(cached);
  if (victoryLottiePending) return victoryLottiePending;

  victoryLottiePending = fetch(VICTORY_LOTTIE_URL)
    .then((res) => {
      if (!res.ok) throw new Error("Failed to fetch victory-burst.json");
      return res.json() as Promise<object>;
    })
    .then((json) => {
      victoryLottieCache.set(VICTORY_LOTTIE_URL, json);
      return json;
    })
    .catch(() => null)
    .finally(() => {
      victoryLottiePending = null;
    });

  return victoryLottiePending;
}

function getFinisherBloomStyle(finisherId: string): CSSProperties {
  switch (finisherId) {
    case "finisher-system-restored-shockwave":
      return {
        filter:
          "hue-rotate(110deg) drop-shadow(0 0 24px rgba(16, 185, 129, 0.5)) drop-shadow(0 0 44px rgba(13, 148, 136, 0.3))",
      };
    case "finisher-cyber-lightning-strike":
      return {
        filter:
          "saturate(1.2) drop-shadow(0 0 24px rgba(245, 158, 11, 0.55)) drop-shadow(0 0 44px rgba(202, 138, 4, 0.3))",
      };
    case "finisher-matrix-override":
      return {
        filter:
          "hue-rotate(95deg) saturate(1.15) drop-shadow(0 0 24px rgba(22, 163, 74, 0.55)) drop-shadow(0 0 44px rgba(21, 128, 61, 0.32))",
      };
    case "finisher-rb-prismatic-burst":
      return {
        filter:
          "hue-rotate(270deg) saturate(1.6) drop-shadow(0 0 26px rgba(236, 72, 153, 0.65)) drop-shadow(0 0 46px rgba(56, 189, 248, 0.45))",
      };
    case "finisher-rb-hyperspeed-warp":
    case "finisher-magic-aurora-crown":
      return {
        filter:
          "hue-rotate(155deg) saturate(1.5) drop-shadow(0 0 26px rgba(56, 189, 248, 0.65)) drop-shadow(0 0 46px rgba(16, 185, 129, 0.45))",
      };
    case "finisher-rb-pixel-blast":
    case "finisher-magic-meteor-storm":
      return {
        filter:
          "hue-rotate(210deg) saturate(1.5) drop-shadow(0 0 26px rgba(168, 85, 247, 0.65)) drop-shadow(0 0 46px rgba(99, 102, 241, 0.45))",
      };
    default:
      return {
        filter:
          "drop-shadow(0 0 22px rgba(229, 72, 77, 0.48)) drop-shadow(0 0 44px rgba(245, 158, 11, 0.3))",
      };
  }
}

function getConfettiPalette(finisherId: string): string[] {
  switch (finisherId) {
    case "finisher-system-restored-shockwave":
    case "finisher-magic-quantum-ripple":
      return ["#10b981", "#0d9488", "#34d399", "#a7f3d0"];
    case "finisher-cyber-lightning-strike":
    case "finisher-magic-confetti-cannon":
      return ["#f59e0b", "#fbbf24", "#0284c7", "#fef3c7"];
    case "finisher-matrix-override":
      return ["#22c55e", "#16a34a", "#4ade80", "#bbf7d0"];
    case "finisher-rb-prismatic-burst":
      return ["#ec4899", "#38bdf8", "#a855f7", "#fbbf24", "#10b981"];
    case "finisher-rb-hyperspeed-warp":
    case "finisher-magic-aurora-crown":
      return ["#38bdf8", "#06b6d4", "#10b981", "#a855f7"];
    case "finisher-rb-balatro-jackpot":
      return ["#e5484d", "#fbbf24", "#3b82f6", "#f97316"];
    case "finisher-rb-pixel-blast":
    case "finisher-magic-meteor-storm":
      return ["#a855f7", "#6366f1", "#38bdf8", "#f472b6"];
    default:
      return ["#e5484d", "#f59e0b", "#0d9488", "#fde68a"];
  }
}

function getShockwaveColor(finisherId: string): string {
  switch (finisherId) {
    case "finisher-system-restored-shockwave":
    case "finisher-magic-quantum-ripple":
      return "rgba(16, 185, 129, 0.38)";
    case "finisher-cyber-lightning-strike":
    case "finisher-magic-confetti-cannon":
      return "rgba(245, 158, 11, 0.36)";
    case "finisher-matrix-override":
      return "rgba(34, 197, 94, 0.34)";
    case "finisher-rb-prismatic-burst":
      return "rgba(236, 72, 153, 0.42)";
    case "finisher-rb-hyperspeed-warp":
    case "finisher-magic-aurora-crown":
      return "rgba(56, 189, 248, 0.42)";
    case "finisher-rb-pixel-blast":
    case "finisher-magic-meteor-storm":
      return "rgba(168, 85, 247, 0.40)";
    default:
      return "rgba(229, 72, 77, 0.32)";
  }
}

function getFinisherCallout(finisherId: string): string {
  switch (finisherId) {
    case "finisher-matrix-override":
      return "> OVERRIDE COMPLETE";
    case "finisher-system-restored-shockwave":
      return "SYSTEM RESTORED";
    case "finisher-cyber-lightning-strike":
      return "HIGH-VOLTAGE SURGE";
    case "finisher-rb-prismatic-burst":
      return "PRISMATIC RAY BURST";
    case "finisher-rb-hyperspeed-warp":
      return "HYPERSPEED WARP JUMP";
    case "finisher-rb-balatro-jackpot":
      return "ROYAL VORTEX JACKPOT";
    case "finisher-rb-pixel-blast":
      return "8-BIT PIXEL BLAST";
    case "finisher-magic-meteor-storm":
      return "CELESTIAL METEOR STORM";
    case "finisher-magic-confetti-cannon":
      return "5-WAY FESTIVAL CANNON";
    case "finisher-magic-quantum-ripple":
      return "QUANTUM RIPPLE PULSE";
    case "finisher-magic-aurora-crown":
      return "AURORA BOREALIS CROWN";
    default:
      return "LGTM! APPROVED";
  }
}

export function VictoryFinisherOverlay({
  finisherId,
  active,
  title = "MISSION ACCOMPLISHED",
  subtitle = "Incident Resolved & Verified",
  onComplete,
}: VictoryFinisherOverlayProps) {
  const resolvedId = finisherId || "finisher-lgtm-neon-confetti";
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fading, setFading] = useState(false);
  const [animationData, setAnimationData] = useState<object | null>(
    () => victoryLottieCache.get(VICTORY_LOTTIE_URL) ?? null
  );

  useEffect(() => {
    if (!active) return;

    const cached = victoryLottieCache.get(VICTORY_LOTTIE_URL);
    if (cached) {
      setAnimationData(cached);
    } else {
      let cancelled = false;
      loadVictoryLottie().then((data) => {
        if (!cancelled && data) setAnimationData(data);
      });
      return () => {
        cancelled = true;
      };
    }
  }, [active]);

  useEffect(() => {
    if (!active) {
      setFading(false);
      return;
    }

    setFading(false);
    const fadeTimer = window.setTimeout(() => {
      setFading(true);
    }, 1850);
    const doneTimer = window.setTimeout(() => {
      onComplete?.();
    }, 2600);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, [active, onComplete]);

  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const canvas = confettiCanvasRef.current;
    if (!canvas) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    const fire = confetti.create(canvas, { resize: true, useWorker: false });
    const colors = getConfettiPalette(resolvedId);

    fire({
      particleCount: 28,
      angle: 60,
      spread: 52,
      startVelocity: 42,
      scalar: 0.85,
      ticks: 135,
      gravity: 1.05,
      origin: { x: 0.22, y: 0.62 },
      colors,
      disableForReducedMotion: true,
    });

    const burstTimer = window.setTimeout(() => {
      fire({
        particleCount: 28,
        angle: 120,
        spread: 52,
        startVelocity: 42,
        scalar: 0.85,
        ticks: 135,
        gravity: 1.05,
        origin: { x: 0.78, y: 0.62 },
        colors,
        disableForReducedMotion: true,
      });
    }, 120);

    return () => {
      window.clearTimeout(burstTimer);
      fire.reset();
    };
  }, [active, resolvedId]);

  if (!active) return null;

  const isMatrix = resolvedId === "finisher-matrix-override";
  const isShockwave = resolvedId === "finisher-system-restored-shockwave";
  const isLightning = resolvedId === "finisher-cyber-lightning-strike";
  const shockwaveColor = getShockwaveColor(resolvedId);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center overflow-hidden"
    >
      <div
        aria-hidden="true"
        className={`absolute inset-0 transition-opacity duration-700 ${
          fading ? "opacity-0" : "opacity-100"
        }`}
      >
        <canvas
          ref={confettiCanvasRef}
          className="absolute inset-0 z-10 w-full h-full pointer-events-none"
        />

        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div
            className="w-72 h-72 rounded-full border-2 animate-ping"
            style={{
              borderColor: shockwaveColor,
              animationDuration: "1.4s",
              animationIterationCount: 1,
            }}
          />
        </div>

        {animationData && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none opacity-80"
            style={getFinisherBloomStyle(resolvedId)}
          >
            <Lottie
              src={animationData}
              loop={false}
              autoplay
              className="w-[30rem] h-[30rem] max-w-[90vw] max-h-[90vh] pointer-events-none"
            />
          </div>
        )}
      </div>

      <div
        className={`cosmetic-finisher-banner relative z-30 mx-4 max-w-md w-full rounded-2xl border-2 px-6 py-5 shadow-hard text-center space-y-2 transition-opacity duration-500 ${
          fading ? "opacity-0" : "opacity-100"
        } ${
          isMatrix
            ? "border-emerald-500 bg-ink text-emerald-400"
            : "border-ink bg-paper text-ink"
        }`}
      >
        <div
          className={`inline-flex items-center justify-center gap-2 text-xs font-mono font-bold uppercase tracking-wider ${
            isMatrix
              ? "text-emerald-400"
              : isShockwave
                ? "text-emerald-600"
                : isLightning
                  ? "text-amber-600"
                  : "text-accent"
          }`}
        >
          {isLightning ? (
            <Zap className="w-4 h-4" aria-hidden="true" />
          ) : isMatrix ? (
            <Terminal className="w-4 h-4" aria-hidden="true" />
          ) : isShockwave ? (
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Sparkles className="w-4 h-4" aria-hidden="true" />
          )}
          <span>{getFinisherCallout(resolvedId)}</span>
        </div>

        {isShockwave && (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/35 bg-emerald-50 px-3 py-0.5 text-[11px] font-mono font-bold text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>ALL SERVICES HEALTHY · 200 OK</span>
          </div>
        )}

        <h3 className={`text-xl font-bold ${isMatrix ? "text-emerald-300 font-mono" : "text-ink"}`}>
          {title}
        </h3>
        <p className={`text-xs font-mono ${isMatrix ? "text-emerald-400/80" : "text-ink-muted"}`}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}

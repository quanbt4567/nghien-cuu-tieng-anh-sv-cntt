"use client";

import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { Sparkles, Terminal, Zap, CheckCircle2 } from "lucide-react";
import {
  DynamicGlitchText,
  DynamicGradientText,
  DynamicShinyText,
  DynamicTrueFocus,
} from "./reactbits";
import "./cosmetics.css";

export interface VictoryFinisherOverlayProps {
  finisherId?: string | null;
  active: boolean;
  title?: string;
  subtitle?: string;
  onComplete?: () => void;
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
    case "finisher-rb-true-focus-lock":
      return "TACTICAL TRUE FOCUS LOCK";
    case "finisher-rb-glitch-overdrive":
      return "RGB GLITCH OVERDRIVE";
    case "finisher-rb-shiny-champion":
      return "PLATINUM SHINY CHAMPION";
    case "finisher-rb-lightning-storm":
      return "THUNDERSTRIKE SURGE";
    case "finisher-pavel-fluid-supernova":
      return "NAVIER-STOKES SUPERNOVA";
    case "finisher-tsparticles-fireworks":
      return "2-STAGE FIREWORKS GRAND FINALE";
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

        {resolvedId === "finisher-rb-prismatic-burst" && (
          <div
            className="absolute inset-[-30%] z-10 pointer-events-none opacity-75 cosmetic-svg-spin-slow"
            style={{
              background:
                "conic-gradient(from 0deg, #EC4899 0deg 30deg, transparent 30deg 60deg, #38BDF8 60deg 90deg, transparent 90deg 120deg, #FBBF24 120deg 150deg, transparent 150deg 180deg, #10B981 180deg 210deg, transparent 210deg 240deg, #A855F7 240deg 270deg, transparent 270deg 300deg, #E5484D 300deg 330deg, transparent 330deg 360deg)",
              maskImage: "radial-gradient(circle at center, rgba(0,0,0,0.95) 0%, transparent 72%)",
              WebkitMaskImage: "radial-gradient(circle at center, rgba(0,0,0,0.95) 0%, transparent 72%)",
            }}
          />
        )}

        {(resolvedId === "finisher-rb-hyperspeed-warp" ||
          resolvedId === "finisher-rb-balatro-jackpot" ||
          resolvedId === "finisher-pavel-fluid-supernova") && (
          <div
            className="absolute inset-0 z-10 pointer-events-none opacity-75"
            style={{
              background:
                resolvedId === "finisher-rb-hyperspeed-warp"
                  ? "radial-gradient(circle at center, rgba(56,189,248,0.6) 0%, rgba(236,72,153,0.4) 45%, transparent 75%)"
                  : resolvedId === "finisher-rb-balatro-jackpot"
                    ? "radial-gradient(circle at center, rgba(229,72,77,0.6) 0%, rgba(245,158,11,0.4) 45%, transparent 75%)"
                    : "radial-gradient(circle at center, rgba(244,63,94,0.6) 0%, rgba(56,189,248,0.4) 45%, transparent 75%)",
            }}
          />
        )}

        {(resolvedId === "finisher-rb-pixel-blast" ||
          resolvedId === "finisher-rb-lightning-storm") && (
          <div
            className="absolute inset-0 z-10 pointer-events-none opacity-40"
            style={{
              backgroundImage:
                resolvedId === "finisher-rb-pixel-blast"
                  ? "radial-gradient(rgba(168,85,247,0.7) 2px, transparent 2px)"
                  : "linear-gradient(135deg, rgba(2,132,199,0.35) 0%, transparent 50%, rgba(56,189,248,0.35) 100%)",
              backgroundSize: resolvedId === "finisher-rb-pixel-blast" ? "16px 16px" : "100% 100%",
            }}
          />
        )}

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
      </div>

      <div
        className={`cosmetic-finisher-banner relative z-30 mx-4 max-w-md w-full rounded-xl border px-6 py-5 shadow-lg text-center space-y-2 transition-opacity duration-500 ${
          fading ? "opacity-0" : "opacity-100"
        } ${
          isMatrix
            ? "bg-white dark:bg-slate-900 border-green-500 dark:border-green-700 text-green-800 dark:text-green-200"
            : "bg-white dark:bg-slate-900 border-blue-300 dark:border-blue-800 text-slate-900 dark:text-slate-100"
        }`}
      >
        <div
          className={`inline-flex items-center justify-center gap-2 text-xs font-mono font-bold uppercase tracking-wider ${
            isMatrix
              ? "text-green-700 dark:text-green-400"
              : isShockwave
                ? "text-green-700 dark:text-green-400"
                : isLightning
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-blue-700 dark:text-blue-400"
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
          <div className="inline-flex items-center gap-1.5 rounded-full border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/40 px-3 py-0.5 text-[11px] font-mono font-bold text-green-700 dark:text-green-300">
            <span className="w-2 h-2 rounded-full bg-green-600 animate-pulse" />
            <span>ALL SERVICES HEALTHY : 200 OK</span>
          </div>
        )}

        <h3 className={`text-xl font-bold ${isMatrix ? "text-green-700 dark:text-green-300 font-mono" : "text-slate-900 dark:text-slate-100"}`}>
          {resolvedId === "finisher-rb-true-focus-lock" ? (
            <DynamicTrueFocus
              sentence={title}
              blurAmount={3}
              borderColor="#15803D"
              glowColor="rgba(21,128,61,0.25)"
              animationDuration={0.35}
              pauseBetweenAnimations={0.45}
              cornerSize={10}
              borderWidth={2}
              wordClassName="text-xl font-bold text-slate-900 dark:text-slate-100"
              containerClassName="gap-2 justify-center flex-wrap"
            />
          ) : resolvedId === "finisher-rb-glitch-overdrive" ||
            resolvedId === "finisher-rb-pixel-blast" ? (
            <DynamicGlitchText
              speed={0.7}
              enableShadows
              mode="rgb"
              fontSize="1.25rem"
              fontWeight={700}
              className="!mx-0 inline-block text-slate-900 dark:text-slate-100"
            >
              {title}
            </DynamicGlitchText>
          ) : resolvedId === "finisher-rb-shiny-champion" ||
            resolvedId === "finisher-rb-hyperspeed-warp" ? (
            <DynamicShinyText text={title} speed={1.8} color="#0F172A" shineColor="#1D4ED8" />
          ) : resolvedId === "finisher-rb-prismatic-burst" ||
            resolvedId === "finisher-rb-balatro-jackpot" ? (
            <DynamicGradientText
              colors={["#DC2626", "#1D4ED8", "#B45309", "#15803D"]}
              animationSpeed={2.5}
            >
              {title}
            </DynamicGradientText>
          ) : (
            title
          )}
        </h3>
        <p className={`text-sm font-mono ${isMatrix ? "text-green-700 dark:text-green-400" : "text-slate-600 dark:text-slate-300"}`}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}

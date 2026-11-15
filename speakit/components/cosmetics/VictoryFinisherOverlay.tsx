"use client";

import { useEffect, type CSSProperties } from "react";
import { Sparkles, Terminal, Zap, CheckCircle2 } from "lucide-react";
import "./cosmetics.css";

export interface VictoryFinisherOverlayProps {
  finisherId?: string | null;
  active: boolean;
  title?: string;
  subtitle?: string;
  onComplete?: () => void;
}

const CONFETTI_ITEMS = [
  { left: "10%", tx: "-30px", delay: "0s", duration: "2.1s", label: "LGTM!" },
  { left: "22%", tx: "45px", delay: "0.15s", duration: "2.4s", label: "" },
  { left: "35%", tx: "-25px", delay: "0.08s", duration: "2.0s", label: "200 OK" },
  { left: "48%", tx: "30px", delay: "0.22s", duration: "2.3s", label: "" },
  { left: "62%", tx: "-40px", delay: "0.05s", duration: "2.2s", label: "LGTM!" },
  { left: "75%", tx: "35px", delay: "0.18s", duration: "2.5s", label: "" },
  { left: "88%", tx: "-20px", delay: "0.1s", duration: "2.1s", label: "SHIPPED" },
];

const MATRIX_COLS = ["08%", "24%", "40%", "56%", "72%", "88%"];

export function VictoryFinisherOverlay({
  finisherId,
  active,
  title = "MISSION ACCOMPLISHED",
  subtitle = "Incident Resolved & Verified",
  onComplete,
}: VictoryFinisherOverlayProps) {
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => {
      onComplete?.();
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [active, onComplete]);

  if (!active) return null;

  const resolvedId = finisherId || "finisher-lgtm-neon-confetti";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center overflow-hidden"
    >
      {resolvedId === "finisher-lgtm-neon-confetti" && (
        <div className="cosmetic-finisher-lgtm-confetti absolute inset-0">
          {CONFETTI_ITEMS.map((piece, idx) => (
            <span
              key={idx}
              className="cosmetic-confetti-piece absolute top-0 px-2 py-1 rounded-md font-mono text-[11px] font-bold shadow-sm border border-emerald-500/40 bg-emerald-50 text-emerald-700"
              style={
                {
                  left: piece.left,
                  "--tx": piece.tx,
                  "--drop-delay": piece.delay,
                  "--drop-duration": piece.duration,
                } as CSSProperties
              }
            >
              {piece.label || "◆"}
            </span>
          ))}
        </div>
      )}

      {resolvedId === "finisher-system-restored-shockwave" && (
        <div className="cosmetic-finisher-shockwave absolute inset-0 flex items-center justify-center">
          <span className="cosmetic-shockwave-ring absolute w-48 h-48 rounded-full border-4 border-teal-500/80" />
          <span
            className="cosmetic-shockwave-ring absolute w-48 h-48 rounded-full border-4 border-emerald-400/60"
            style={{ animationDelay: "0.25s" }}
          />
        </div>
      )}

      {resolvedId === "finisher-cyber-lightning-strike" && (
        <div className="cosmetic-finisher-lightning absolute inset-0">
          <div className="cosmetic-lightning-bolt absolute inset-0 bg-amber-300/20" />
          <svg
            viewBox="0 0 800 600"
            className="cosmetic-lightning-bolt absolute inset-0 w-full h-full"
          >
            <polyline
              points="180,0 230,180 175,210 270,420 220,440 310,600"
              fill="none"
              stroke="#CA8A04"
              strokeWidth="5"
            />
            <polyline
              points="620,0 565,170 615,205 520,410 565,435 480,600"
              fill="none"
              stroke="#F59E0B"
              strokeWidth="5"
            />
          </svg>
        </div>
      )}

      {resolvedId === "finisher-matrix-override" && (
        <div className="cosmetic-finisher-matrix-override absolute inset-0 bg-emerald-950/20">
          {MATRIX_COLS.map((left, idx) => (
            <div
              key={idx}
              className="cosmetic-matrix-override-col absolute top-0 font-mono text-xs font-bold text-emerald-500/60 whitespace-pre"
              style={{ left, animationDelay: `${idx * 0.14}s` }}
            >
              {"1\n0\n1\n1\n0\n0\n1\n0\n1"}
            </div>
          ))}
        </div>
      )}

      <div className="cosmetic-finisher-banner relative z-10 mx-4 max-w-md w-full rounded-2xl border-2 border-ink bg-paper px-6 py-5 shadow-hard text-center space-y-1.5">
        <div className="inline-flex items-center justify-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-accent">
          {resolvedId === "finisher-cyber-lightning-strike" ? (
            <Zap className="w-4 h-4" aria-hidden="true" />
          ) : resolvedId === "finisher-matrix-override" ? (
            <Terminal className="w-4 h-4 text-emerald-600" aria-hidden="true" />
          ) : resolvedId === "finisher-system-restored-shockwave" ? (
            <CheckCircle2 className="w-4 h-4 text-teal-600" aria-hidden="true" />
          ) : (
            <Sparkles className="w-4 h-4" aria-hidden="true" />
          )}
          <span>Victory Finisher</span>
        </div>
        <h3 className="text-xl font-bold text-ink">{title}</h3>
        <p className="text-xs font-mono text-ink-muted">{subtitle}</p>
      </div>
    </div>
  );
}

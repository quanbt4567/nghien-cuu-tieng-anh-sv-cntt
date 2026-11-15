"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import confetti from "canvas-confetti";
import { Sparkles, Terminal, Zap, CheckCircle2 } from "lucide-react";
import "./cosmetics.css";

export interface VictoryFinisherOverlayProps {
  finisherId?: string | null;
  active: boolean;
  title?: string;
  subtitle?: string;
  onComplete?: () => void;
}

const FINISHER_PALETTE = ["#E5484D", "#16A34A", "#F59E0B", "#0284C7", "#1A1714"];

const CONFETTI_STAMPS = [
  { left: "8%", tx: "-32px", delay: "0s", duration: "2.1s", label: "LGTM!" },
  { left: "21%", tx: "40px", delay: "0.14s", duration: "2.3s", label: "200 OK" },
  { left: "35%", tx: "-24px", delay: "0.06s", duration: "2.0s", label: "LGTM!" },
  { left: "50%", tx: "28px", delay: "0.2s", duration: "2.4s", label: "APPROVED" },
  { left: "65%", tx: "-38px", delay: "0.08s", duration: "2.2s", label: "LGTM!" },
  { left: "79%", tx: "32px", delay: "0.16s", duration: "2.4s", label: "SHIPPED" },
  { left: "90%", tx: "-22px", delay: "0.1s", duration: "2.1s", label: "LGTM!" },
];

const MATRIX_GLYPHS =
  "01011001ABCDEF0123456789アイウエオカキクケコサシスセソタチツテト";

interface BoltSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
}

function buildStrikeBolt(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  displacement: number,
  depth: number,
  width: number,
  out: BoltSegment[]
) {
  if (depth <= 0) {
    out.push({ x1, y1, x2, y2, width });
    return;
  }
  const midX = (x1 + x2) * 0.5 + (Math.random() - 0.5) * displacement;
  const midY = (y1 + y2) * 0.5 + (Math.random() - 0.5) * displacement;
  buildStrikeBolt(x1, y1, midX, midY, displacement * 0.55, depth - 1, width, out);
  buildStrikeBolt(midX, midY, x2, y2, displacement * 0.55, depth - 1, width, out);

  if (depth >= 2 && Math.random() < 0.5) {
    const bx = midX + (Math.random() - 0.5) * displacement * 1.4;
    const by = midY + Math.abs(y2 - y1) * 0.35 + Math.random() * 45;
    buildStrikeBolt(midX, midY, bx, by, displacement * 0.45, depth - 2, width * 0.55, out);
  }
}

function CyberLightningCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const createBolts = (): BoltSegment[][] => {
      const leftBolt: BoltSegment[] = [];
      const rightBolt: BoltSegment[] = [];
      const centerBolt: BoltSegment[] = [];
      buildStrikeBolt(width * 0.16, 0, width * 0.44, height * 0.58, 95, 5, 3.6, leftBolt);
      buildStrikeBolt(width * 0.84, 0, width * 0.56, height * 0.58, 95, 5, 3.6, rightBolt);
      buildStrikeBolt(width * 0.5, 0, width * 0.5, height * 0.48, 70, 4, 2.8, centerBolt);
      return [leftBolt, rightBolt, centerBolt];
    };

    let bolts = createBolts();
    let frame = 0;
    let rafId = 0;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      frame += 1;

      if (!reducedMotion && (frame === 14 || frame === 30)) {
        bolts = createBolts();
      }

      const envelope = reducedMotion
        ? 0.7
        : frame < 10
          ? 1
          : frame < 24
            ? 0.78
            : Math.max(0, 1 - (frame - 24) / 42);

      if (envelope > 0.01) {
        const flashRadius = Math.max(width, height) * 0.48;
        const flashGrad = ctx.createRadialGradient(
          width * 0.5,
          height * 0.48,
          10,
          width * 0.5,
          height * 0.48,
          flashRadius
        );
        flashGrad.addColorStop(0, `rgba(245, 158, 11, ${(0.34 * envelope).toFixed(3)})`);
        flashGrad.addColorStop(0.55, `rgba(202, 138, 4, ${(0.14 * envelope).toFixed(3)})`);
        flashGrad.addColorStop(1, "rgba(245, 158, 11, 0)");
        ctx.fillStyle = flashGrad;
        ctx.fillRect(0, 0, width, height);

        const colors = ["#F59E0B", "#CA8A04", "#E5484D"];
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        bolts.forEach((group, idx) => {
          const stroke = colors[idx % colors.length] ?? "#F59E0B";
          ctx.shadowColor = stroke;
          ctx.shadowBlur = 18;
          for (const seg of group) {
            ctx.beginPath();
            ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);
            ctx.strokeStyle = stroke;
            ctx.globalAlpha = 0.9 * envelope;
            ctx.lineWidth = seg.width;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);
            ctx.strokeStyle = "#FFFFFF";
            ctx.globalAlpha = 0.95 * envelope;
            ctx.lineWidth = Math.max(1, seg.width * 0.42);
            ctx.stroke();
          }
        });
        ctx.restore();
      }

      if (!reducedMotion && frame < 72) {
        rafId = window.requestAnimationFrame(draw);
      }
    };

    draw();
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />;
}

function MatrixOverrideCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const fontSize = 15;
    const colWidth = 20;
    const count = Math.max(1, Math.ceil(width / colWidth));
    const maxRows = Math.ceil(height / fontSize) + 14;
    const columns = Array.from({ length: count }, () => {
      const trail = 10 + Math.floor(Math.random() * 8);
      return {
        y: Math.random() * (maxRows * 0.45),
        speed: 0.42 + Math.random() * 0.36,
        trail,
        chars: Array.from(
          { length: trail },
          () => MATRIX_GLYPHS[Math.floor(Math.random() * MATRIX_GLYPHS.length)] ?? "1"
        ),
      };
    });

    let rafId = 0;
    let tick = 0;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "rgba(5, 46, 22, 0.22)";
      ctx.fillRect(0, 0, width, height);
      ctx.font = `700 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
      ctx.textBaseline = "top";
      tick += 1;

      for (let i = 0; i < columns.length; i += 1) {
        const col = columns[i];
        if (!col) continue;
        const x = i * colWidth + 3;
        const head = Math.floor(col.y);

        for (let t = 0; t < col.trail; t += 1) {
          const rowY = (head - t) * fontSize;
          if (rowY < -fontSize || rowY > height) continue;
          if (tick % 4 === 0 && Math.random() < 0.2) {
            col.chars[t] =
              MATRIX_GLYPHS[Math.floor(Math.random() * MATRIX_GLYPHS.length)] ?? "0";
          }
          const ch = col.chars[t] ?? "1";
          if (t === 0) {
            ctx.fillStyle = "rgba(187, 247, 208, 0.96)";
          } else if (t === 1) {
            ctx.fillStyle = "rgba(22, 163, 74, 0.88)";
          } else {
            const alpha = Math.max(0.08, 0.72 * (1 - t / col.trail));
            ctx.fillStyle = `rgba(21, 128, 61, ${alpha.toFixed(3)})`;
          }
          ctx.fillText(ch, x, rowY);
        }

        if (!reducedMotion) {
          col.y += col.speed;
          if (col.y - col.trail > maxRows) {
            col.y = -Math.random() * 8;
          }
        }
      }

      if (!reducedMotion) {
        rafId = window.requestAnimationFrame(draw);
      }
    };

    draw();
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />;
}

export function VictoryFinisherOverlay({
  finisherId,
  active,
  title = "MISSION ACCOMPLISHED",
  subtitle = "Incident Resolved & Verified",
  onComplete,
}: VictoryFinisherOverlayProps) {
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const resolvedId = finisherId || "finisher-lgtm-neon-confetti";

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => {
      onComplete?.();
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [active, onComplete]);

  useEffect(() => {
    if (!active) return;
    const canvas = confettiCanvasRef.current;
    if (!canvas) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    const fire = confetti.create(canvas, { resize: true, useWorker: false });
    const shapes: confetti.Shape[] = ["star", "square"];
    const baseColors = FINISHER_PALETTE;

    const launchCannons = () => {
      fire({
        particleCount: resolvedId === "finisher-lgtm-neon-confetti" ? 42 : 26,
        angle: 60,
        spread: 58,
        startVelocity: 54,
        origin: { x: 0.04, y: 0.68 },
        colors: baseColors,
        shapes,
        scalar: 1.05,
        disableForReducedMotion: true,
      });
      fire({
        particleCount: resolvedId === "finisher-lgtm-neon-confetti" ? 42 : 26,
        angle: 120,
        spread: 58,
        startVelocity: 54,
        origin: { x: 0.96, y: 0.68 },
        colors: baseColors,
        shapes,
        scalar: 1.05,
        disableForReducedMotion: true,
      });
    };

    launchCannons();

    const burstTimer = window.setTimeout(() => {
      fire({
        particleCount: resolvedId === "finisher-lgtm-neon-confetti" ? 65 : 36,
        spread: 110,
        startVelocity: 38,
        origin: { x: 0.5, y: 0.45 },
        colors: baseColors,
        shapes,
        ticks: 180,
        disableForReducedMotion: true,
      });
    }, 240);

    return () => {
      window.clearTimeout(burstTimer);
      fire.reset();
    };
  }, [active, resolvedId]);

  if (!active) return null;

  const isMatrix = resolvedId === "finisher-matrix-override";
  const isShockwave = resolvedId === "finisher-system-restored-shockwave";
  const isLightning = resolvedId === "finisher-cyber-lightning-strike";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center overflow-hidden"
    >
      <canvas
        ref={confettiCanvasRef}
        className="absolute inset-0 z-20 block w-full h-full pointer-events-none"
      />

      {resolvedId === "finisher-lgtm-neon-confetti" && (
        <div className="cosmetic-finisher-lgtm-confetti absolute inset-0 z-10">
          {CONFETTI_STAMPS.map((piece, idx) => (
            <span
              key={idx}
              className="cosmetic-confetti-piece absolute top-0 px-2.5 py-1 rounded-md font-mono text-[11px] font-bold shadow-sm border-2 border-ink bg-paper text-emerald-700"
              style={
                {
                  left: piece.left,
                  "--tx": piece.tx,
                  "--drop-delay": piece.delay,
                  "--drop-duration": piece.duration,
                } as CSSProperties
              }
            >
              {piece.label}
            </span>
          ))}
        </div>
      )}

      {isShockwave && (
        <div className="cosmetic-finisher-shockwave absolute inset-0 z-10 flex items-center justify-center">
          <svg
            viewBox="0 0 400 400"
            className="absolute w-[34rem] h-[34rem] opacity-75"
            aria-hidden="true"
          >
            <circle
              cx="200"
              cy="200"
              r="140"
              fill="none"
              stroke="#16A34A"
              strokeWidth="2"
              strokeDasharray="10 8"
            />
            <circle
              cx="200"
              cy="200"
              r="180"
              fill="none"
              stroke="#0D9488"
              strokeWidth="1.5"
              strokeDasharray="6 10"
            />
          </svg>
          <span className="cosmetic-shockwave-ring absolute w-48 h-48 rounded-full border-4 border-emerald-500/85" />
          <span
            className="cosmetic-shockwave-ring absolute w-48 h-48 rounded-full border-4 border-teal-400/70"
            style={{ animationDelay: "0.22s" }}
          />
          <span
            className="cosmetic-shockwave-ring absolute w-48 h-48 rounded-full border-4 border-sky-500/55"
            style={{ animationDelay: "0.44s" }}
          />
        </div>
      )}

      {isLightning && (
        <div className="cosmetic-finisher-lightning absolute inset-0 z-10">
          <div className="cosmetic-lightning-bolt absolute inset-0 bg-amber-400/15" />
          <CyberLightningCanvas />
        </div>
      )}

      {isMatrix && (
        <div className="cosmetic-finisher-matrix-override absolute inset-0 z-10">
          <MatrixOverrideCanvas />
        </div>
      )}

      <div
        className={`cosmetic-finisher-banner relative z-30 mx-4 max-w-md w-full rounded-2xl border-2 px-6 py-5 shadow-hard text-center space-y-2 ${
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
          <span>
            {isMatrix
              ? "> OVERRIDE COMPLETE"
              : isShockwave
                ? "SYSTEM RESTORED"
                : isLightning
                  ? "HIGH-VOLTAGE SURGE"
                  : "LGTM! APPROVED"}
          </span>
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

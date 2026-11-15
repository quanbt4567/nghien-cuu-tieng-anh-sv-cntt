"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import "./cosmetics.css";

export interface FullPageProfileEffectProps {
  themeId?: string | null;
}

const METEOR_STREAKS = [
  { left: "12%", top: "-8%", duration: "3.4s", delay: "0s", height: "h-32" },
  { left: "24%", top: "-12%", duration: "4.5s", delay: "0.9s", height: "h-24" },
  { left: "36%", top: "-6%", duration: "3.1s", delay: "0.3s", height: "h-36" },
  { left: "48%", top: "-10%", duration: "4.8s", delay: "1.6s", height: "h-28" },
  { left: "58%", top: "-5%", duration: "3.6s", delay: "0.7s", height: "h-32" },
  { left: "68%", top: "-14%", duration: "4.2s", delay: "2.1s", height: "h-24" },
  { left: "78%", top: "-7%", duration: "3.3s", delay: "1.2s", height: "h-36" },
  { left: "88%", top: "-11%", duration: "4.7s", delay: "0.4s", height: "h-28" },
  { left: "96%", top: "-9%", duration: "3.9s", delay: "1.9s", height: "h-32" },
  { left: "105%", top: "-15%", duration: "4.1s", delay: "2.6s", height: "h-28" },
  { left: "20%", top: "-14%", duration: "5.1s", delay: "2.9s", height: "h-24" },
  { left: "62%", top: "-12%", duration: "3.8s", delay: "3.2s", height: "h-32" },
  { left: "82%", top: "-16%", duration: "4.4s", delay: "2.4s", height: "h-28" },
  { left: "42%", top: "-15%", duration: "4.0s", delay: "1.4s", height: "h-32" },
];

const MATRIX_GLYPHS =
  "01011001ABCDEF0123456789アイウエオカキクケコサシスセソタチツテトナニヌネノ";

interface MatrixColumnState {
  y: number;
  speed: number;
  trailLength: number;
  chars: string[];
}

interface LightningSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
}

interface StormBolt {
  segments: LightningSegment[];
  color: string;
  originX: number;
  originY: number;
  life: number;
  maxLife: number;
}

function randomMatrixGlyph(): string {
  return MATRIX_GLYPHS[Math.floor(Math.random() * MATRIX_GLYPHS.length)] ?? "1";
}

function buildLightningBranch(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  displacement: number,
  depth: number,
  width: number,
  out: LightningSegment[]
) {
  if (depth <= 0) {
    out.push({ x1, y1, x2, y2, width });
    return;
  }
  const midX = (x1 + x2) * 0.5 + (Math.random() - 0.5) * displacement;
  const midY = (y1 + y2) * 0.5 + (Math.random() - 0.5) * displacement;
  buildLightningBranch(x1, y1, midX, midY, displacement * 0.55, depth - 1, width, out);
  buildLightningBranch(midX, midY, x2, y2, displacement * 0.55, depth - 1, width, out);

  if (depth >= 2 && Math.random() < 0.42) {
    const branchX = midX + (Math.random() - 0.5) * displacement * 1.4;
    const branchY = midY + Math.abs(y2 - y1) * 0.35 + Math.random() * 40;
    buildLightningBranch(
      midX,
      midY,
      branchX,
      branchY,
      displacement * 0.45,
      depth - 2,
      Math.max(1, width * 0.55),
      out
    );
  }
}

function spawnEdgeBolt(width: number, height: number): StormBolt {
  const side = Math.random();
  let startX = 0;
  let startY = 0;
  let endX = 0;
  let endY = 0;

  if (side < 0.45) {
    startX = Math.random() * (width * 0.14);
    startY = Math.random() * (height * 0.45);
    endX = startX + 80 + Math.random() * 160;
    endY = startY + 140 + Math.random() * 220;
  } else if (side < 0.9) {
    startX = width - Math.random() * (width * 0.14);
    startY = Math.random() * (height * 0.45);
    endX = startX - (80 + Math.random() * 160);
    endY = startY + 140 + Math.random() * 220;
  } else {
    startX = width * (0.15 + Math.random() * 0.7);
    startY = 0;
    endX = startX + (Math.random() - 0.5) * 180;
    endY = 120 + Math.random() * 180;
  }

  const segments: LightningSegment[] = [];
  buildLightningBranch(startX, startY, endX, endY, 64, 4, 2.2, segments);

  const palette = ["#CA8A04", "#F59E0B", "#0284C7"];
  const color = palette[Math.floor(Math.random() * palette.length)] ?? "#CA8A04";

  return {
    segments,
    color,
    originX: startX,
    originY: startY,
    life: 1,
    maxLife: 18 + Math.floor(Math.random() * 14),
  };
}

function MatrixRainCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fontSize = 14;
    const columnWidth = 22;
    let width = 0;
    let height = 0;
    let columns: MatrixColumnState[] = [];
    let rafId = 0;
    let frameTick = 0;

    const initColumns = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.max(1, Math.ceil(width / columnWidth));
      const maxRows = Math.ceil(height / fontSize) + 18;
      columns = Array.from({ length: count }, () => {
        const trailLength = 10 + Math.floor(Math.random() * 9);
        return {
          y: Math.random() * maxRows - trailLength,
          speed: 0.18 + Math.random() * 0.24,
          trailLength,
          chars: Array.from({ length: trailLength }, randomMatrixGlyph),
        };
      });
    };

    const drawFrame = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.font = `700 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
      ctx.textBaseline = "top";
      frameTick += 1;

      const maxRows = Math.ceil(height / fontSize) + 2;

      for (let i = 0; i < columns.length; i += 1) {
        const col = columns[i];
        if (!col) continue;
        const x = i * columnWidth + 4;
        const headRow = Math.floor(col.y);

        for (let t = 0; t < col.trailLength; t += 1) {
          const rowY = (headRow - t) * fontSize;
          if (rowY < -fontSize || rowY > height) continue;

          if (frameTick % 6 === 0 && Math.random() < 0.12) {
            col.chars[t] = randomMatrixGlyph();
          }

          const glyph = col.chars[t] ?? "0";
          if (t === 0) {
            ctx.fillStyle = "rgba(22, 163, 74, 0.72)";
          } else if (t === 1) {
            ctx.fillStyle = "rgba(21, 128, 61, 0.52)";
          } else {
            const fade = Math.max(0.04, 0.36 * (1 - t / col.trailLength));
            ctx.fillStyle = `rgba(21, 128, 61, ${fade.toFixed(3)})`;
          }
          ctx.fillText(glyph, x, rowY);
        }

        if (!reducedMotion) {
          col.y += col.speed;
          if (col.y - col.trailLength > maxRows) {
            col.y = -Math.random() * 12;
            col.speed = 0.18 + Math.random() * 0.24;
          }
        }
      }

      if (!reducedMotion) {
        rafId = window.requestAnimationFrame(drawFrame);
      }
    };

    initColumns();
    drawFrame();

    window.addEventListener("resize", initColumns);
    return () => {
      window.removeEventListener("resize", initColumns);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />;
}

function ElectricStormCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let bolts: StormBolt[] = [];
    let rafId = 0;
    let cooldown = 12;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawFrame = () => {
      ctx.clearRect(0, 0, width, height);

      if (!reducedMotion) {
        cooldown -= 1;
        if (cooldown <= 0 && bolts.length < 3) {
          bolts.push(spawnEdgeBolt(width, height));
          cooldown = 36 + Math.floor(Math.random() * 54);
        }
      }

      const nextBolts: StormBolt[] = [];
      for (const bolt of bolts) {
        const progress = bolt.life / bolt.maxLife;
        const alpha = Math.max(0, 1 - progress);
        const flicker = Math.random() > 0.2 ? 1 : 0.45;
        const finalAlpha = alpha * flicker;

        const arcGradient = ctx.createRadialGradient(
          bolt.originX,
          bolt.originY,
          0,
          bolt.originX,
          bolt.originY,
          180
        );
        arcGradient.addColorStop(0, `rgba(245, 158, 11, ${(0.18 * finalAlpha).toFixed(3)})`);
        arcGradient.addColorStop(0.5, `rgba(2, 132, 199, ${(0.08 * finalAlpha).toFixed(3)})`);
        arcGradient.addColorStop(1, "rgba(2, 132, 199, 0)");
        ctx.fillStyle = arcGradient;
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.shadowColor = bolt.color;
        ctx.shadowBlur = 12;

        for (const seg of bolt.segments) {
          ctx.beginPath();
          ctx.moveTo(seg.x1, seg.y1);
          ctx.lineTo(seg.x2, seg.y2);
          ctx.strokeStyle = bolt.color;
          ctx.globalAlpha = 0.58 * finalAlpha;
          ctx.lineWidth = seg.width;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(seg.x1, seg.y1);
          ctx.lineTo(seg.x2, seg.y2);
          ctx.strokeStyle = "#FFFFFF";
          ctx.globalAlpha = 0.72 * finalAlpha;
          ctx.lineWidth = Math.max(0.7, seg.width * 0.4);
          ctx.stroke();
        }
        ctx.restore();

        if (!reducedMotion) {
          bolt.life += 1;
          if (bolt.life < bolt.maxLife) {
            nextBolts.push(bolt);
          }
        } else {
          nextBolts.push(bolt);
        }
      }
      bolts = nextBolts;

      if (!reducedMotion) {
        rafId = window.requestAnimationFrame(drawFrame);
      }
    };

    resize();
    if (reducedMotion) {
      bolts = [spawnEdgeBolt(width, height)];
    }
    drawFrame();

    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />;
}

export function FullPageProfileEffect({ themeId }: FullPageProfileEffectProps) {
  if (!themeId) return null;

  if (themeId === "theme-neon-meteor-shower") {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden cosmetic-theme-meteor-shower"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/[0.04] via-transparent to-amber-500/[0.05]" />
        {METEOR_STREAKS.map((streak, index) => (
          <span
            key={index}
            className={`cosmetic-meteor-streak absolute w-[2px] ${streak.height} rounded-full bg-gradient-to-t from-rose-500/85 via-amber-400/55 to-transparent`}
            style={
              {
                left: streak.left,
                top: streak.top,
                "--meteor-duration": streak.duration,
                "--meteor-delay": streak.delay,
              } as CSSProperties
            }
          >
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white shadow-[0_0_8px_2px_rgba(229,72,77,0.85),0_0_16px_4px_rgba(245,158,11,0.5)]" />
          </span>
        ))}
      </div>
    );
  }

  if (themeId === "theme-digital-matrix-rain") {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden cosmetic-theme-matrix-rain"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.04] via-transparent to-emerald-700/[0.05]" />
        <MatrixRainCanvas />
      </div>
    );
  }

  if (themeId === "theme-aurora-cyber-grid") {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden cosmetic-theme-aurora-grid"
      >
        <div
          className="cosmetic-aurora-layer absolute -inset-12 opacity-70"
          style={{
            background:
              "radial-gradient(ellipse 55% 40% at 18% 18%, rgba(13, 148, 136, 0.16), transparent 62%), radial-gradient(ellipse 50% 38% at 82% 22%, rgba(245, 158, 11, 0.15), transparent 60%), radial-gradient(ellipse 45% 32% at 50% 14%, rgba(229, 72, 77, 0.10), transparent 58%)",
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-[72vh]"
          style={{
            perspective: "500px",
            maskImage:
              "linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.85) 28%, rgba(0, 0, 0, 1) 88%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.85) 28%, rgba(0, 0, 0, 1) 88%, transparent 100%)",
          }}
        >
          <div
            className="cosmetic-grid-plane absolute -inset-x-[35%] -top-[20%] bottom-[-10%] opacity-85"
            style={{
              transform: "rotateX(60deg)",
              transformOrigin: "50% 60%",
            }}
          />
        </div>
      </div>
    );
  }

  if (themeId === "theme-electric-storm-surge") {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden cosmetic-theme-electric-storm"
      >
        <div
          className="cosmetic-storm-arc absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 14% 16%, rgba(202, 138, 4, 0.12), transparent 42%), radial-gradient(circle at 86% 78%, rgba(2, 132, 199, 0.11), transparent 45%)",
          }}
        />
        <ElectricStormCanvas />
      </div>
    );
  }

  return null;
}

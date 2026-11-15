"use client";

import { useEffect, useRef } from "react";
import "./cosmetics.css";

export interface CustomCursorTrailProps {
  effectId?: string | null;
}

interface TrailParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  glyph: string;
  color: string;
}

interface RibbonPoint {
  x: number;
  y: number;
  life: number;
}

const VALID_CURSOR_EFFECTS = new Set([
  "cursor-pixel-sparkle-trail",
  "cursor-binary-01-stream",
  "cursor-neon-laser-ribbon",
  "cursor-tactical-cyber-crosshair",
]);

export function CustomCursorTrail({ effectId }: CustomCursorTrailProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!effectId || !VALID_CURSOR_EFFECTS.has(effectId)) return;
    if (typeof window === "undefined") return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const particles: TrailParticle[] = [];
    const ribbon: RibbonPoint[] = [];
    let pointerX = -200;
    let pointerY = -200;
    let hasMoved = false;
    let angle = 0;
    let lastEmit = 0;
    let rafId = 0;

    const onPointerMove = (e: PointerEvent) => {
      pointerX = e.clientX;
      pointerY = e.clientY;
      hasMoved = true;

      const now = performance.now();
      if (effectId === "cursor-neon-laser-ribbon") {
        ribbon.push({ x: pointerX, y: pointerY, life: 1 });
        if (ribbon.length > 22) ribbon.shift();
        return;
      }

      if (now - lastEmit < 16) return;
      lastEmit = now;

      if (effectId === "cursor-pixel-sparkle-trail") {
        const colors = ["#D97706", "#F59E0B", "#E5484D", "#1A1714"];
        particles.push({
          x: pointerX + (Math.random() - 0.5) * 10,
          y: pointerY + (Math.random() - 0.5) * 10,
          vx: (Math.random() - 0.5) * 1.4,
          vy: -0.6 - Math.random() * 1.1,
          life: 1,
          maxLife: 28,
          size: 4 + Math.floor(Math.random() * 4),
          glyph: "",
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      } else if (effectId === "cursor-binary-01-stream") {
        particles.push({
          x: pointerX + (Math.random() - 0.5) * 12,
          y: pointerY + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 0.6,
          vy: -0.9 - Math.random() * 0.8,
          life: 1,
          maxLife: 36,
          size: 12,
          glyph: Math.random() > 0.5 ? "1" : "0",
          color: Math.random() > 0.35 ? "#16A34A" : "#15803D",
        });
      }

      if (particles.length > 60) {
        particles.splice(0, particles.length - 60);
      }
    };

    const render = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      if (effectId === "cursor-pixel-sparkle-trail") {
        for (let i = particles.length - 1; i >= 0; i -= 1) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 1 / p.maxLife;
          if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
          }
          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
        }
        ctx.globalAlpha = 1;
      } else if (effectId === "cursor-binary-01-stream") {
        ctx.font = "700 12px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.textAlign = "center";
        for (let i = particles.length - 1; i >= 0; i -= 1) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 1 / p.maxLife;
          if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
          }
          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          ctx.fillText(p.glyph, p.x, p.y);
        }
        ctx.globalAlpha = 1;
      } else if (effectId === "cursor-neon-laser-ribbon") {
        if (ribbon.length > 1) {
          for (let i = 1; i < ribbon.length; i += 1) {
            const prev = ribbon[i - 1];
            const curr = ribbon[i];
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(curr.x, curr.y);
            ctx.strokeStyle = `rgba(229, 72, 77, ${Math.max(0.08, curr.life * 0.85)})`;
            ctx.lineWidth = Math.max(1.5, (i / ribbon.length) * 4.5);
            ctx.lineCap = "round";
            ctx.stroke();
          }
        }
        for (let i = ribbon.length - 1; i >= 0; i -= 1) {
          ribbon[i].life -= 0.055;
          if (ribbon[i].life <= 0) ribbon.splice(i, 1);
        }
      } else if (effectId === "cursor-tactical-cyber-crosshair" && hasMoved) {
        angle += 0.03;
        ctx.save();
        ctx.translate(pointerX, pointerY);
        ctx.strokeStyle = "rgba(2, 132, 199, 0.85)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.stroke();

        ctx.rotate(angle);
        for (let i = 0; i < 4; i += 1) {
          ctx.rotate(Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(10, 0);
          ctx.lineTo(18, 0);
          ctx.stroke();
        }
        ctx.restore();

        ctx.fillStyle = "#E5484D";
        ctx.beginPath();
        ctx.arc(pointerX, pointerY, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      rafId = window.requestAnimationFrame(render);
    };

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    rafId = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [effectId]);

  if (!effectId || !VALID_CURSOR_EFFECTS.has(effectId)) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-50"
    />
  );
}

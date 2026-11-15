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
  rotation: number;
  vr: number;
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

const PIXEL_COLORS = ["#E5484D", "#F59E0B", "#16A34A", "#1A1714"];

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

    let width = window.innerWidth;
    let height = window.innerHeight;
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
    resize();

    const particles: TrailParticle[] = [];
    const ribbon: RibbonPoint[] = [];
    let pointerX = -200;
    let pointerY = -200;
    let reticleX = -200;
    let reticleY = -200;
    let reticleVx = 0;
    let reticleVy = 0;
    let hasMoved = false;
    let isHoveringInteractive = false;
    let lockProgress = 0;
    let angle = 0;
    let lastEmit = 0;
    let lastFrame = performance.now();
    let rafId = 0;

    const onPointerMove = (e: PointerEvent) => {
      pointerX = e.clientX;
      pointerY = e.clientY;
      if (!hasMoved) {
        reticleX = pointerX;
        reticleY = pointerY;
        hasMoved = true;
      }

      if (effectId === "cursor-tactical-cyber-crosshair") {
        const target = e.target instanceof Element ? e.target : null;
        isHoveringInteractive = Boolean(target?.closest("a, button"));
        return;
      }

      if (effectId === "cursor-neon-laser-ribbon") {
        const last = ribbon[ribbon.length - 1];
        if (last) {
          const dx = pointerX - last.x;
          const dy = pointerY - last.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 14) {
            const steps = Math.min(4, Math.floor(dist / 10));
            for (let s = 1; s < steps; s += 1) {
              const t = s / steps;
              ribbon.push({
                x: last.x + dx * t,
                y: last.y + dy * t,
                life: 0.92 + t * 0.08,
              });
            }
          }
        }
        ribbon.push({ x: pointerX, y: pointerY, life: 1 });
        if (ribbon.length > 28) {
          ribbon.splice(0, ribbon.length - 28);
        }
        return;
      }

      const now = performance.now();
      if (now - lastEmit < 16) return;
      lastEmit = now;

      if (effectId === "cursor-pixel-sparkle-trail") {
        const count = 2;
        for (let i = 0; i < count; i += 1) {
          particles.push({
            x: pointerX + (Math.random() - 0.5) * 10,
            y: pointerY + (Math.random() - 0.5) * 10,
            vx: (Math.random() - 0.5) * 2.2,
            vy: -1.1 - Math.random() * 1.4,
            life: 1,
            maxLife: 28 + Math.random() * 10,
            size: 5 + Math.floor(Math.random() * 4),
            rotation: Math.random() * Math.PI * 2,
            vr: (Math.random() - 0.5) * 0.16,
            glyph: "",
            color: PIXEL_COLORS[Math.floor(Math.random() * PIXEL_COLORS.length)],
          });
        }
      } else if (effectId === "cursor-binary-01-stream") {
        particles.push({
          x: pointerX + (Math.random() - 0.5) * 14,
          y: pointerY + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -0.95 - Math.random() * 0.85,
          life: 1,
          maxLife: 38 + Math.random() * 10,
          size: 12,
          rotation: 0,
          vr: 0,
          glyph: Math.random() > 0.5 ? "1" : "0",
          color: "#16A34A",
        });
      }

      if (particles.length > 80) {
        particles.splice(0, particles.length - 80);
      }
    };

    const onPointerLeave = () => {
      isHoveringInteractive = false;
    };

    const render = (now: number) => {
      const dt = Math.min(Math.max((now - lastFrame) / 16.6667, 0.25), 2.5);
      lastFrame = now;

      ctx.clearRect(0, 0, width, height);

      if (effectId === "cursor-pixel-sparkle-trail") {
        for (let i = particles.length - 1; i >= 0; i -= 1) {
          const p = particles[i];
          p.vy += 0.08 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rotation += p.vr * dt;
          p.life -= dt / p.maxLife;
          if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
          }
          const scale = Math.max(0.15, p.life);
          const side = p.size * scale;
          ctx.save();
          ctx.globalAlpha = Math.min(1, p.life * 1.15);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.fillRect(-side / 2, -side / 2, side, side);
          ctx.restore();
        }
      } else if (effectId === "cursor-binary-01-stream") {
        ctx.font = "700 12px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (let i = particles.length - 1; i >= 0; i -= 1) {
          const p = particles[i];
          p.x += (p.vx + Math.sin(p.life * 8) * 0.22) * dt;
          p.y += p.vy * dt;
          p.life -= dt / p.maxLife;
          if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
          }
          ctx.globalAlpha = Math.pow(p.life, 1.15);
          ctx.fillStyle = p.color;
          ctx.fillText(p.glyph, p.x, p.y);
        }
        ctx.globalAlpha = 1;
      } else if (effectId === "cursor-neon-laser-ribbon") {
        if (ribbon.length > 2) {
          ctx.save();
          ctx.lineCap = "round";
          ctx.lineJoin = "round";

          for (let i = 1; i < ribbon.length; i += 1) {
            const prev = ribbon[i - 1];
            const curr = ribbon[i];
            const next = ribbon[i + 1];
            const progress = i / (ribbon.length - 1);
            const alpha = Math.max(0, curr.life);
            const endX = next ? (curr.x + next.x) * 0.5 : curr.x;
            const endY = next ? (curr.y + next.y) * 0.5 : curr.y;
            const startX = i === 1 ? prev.x : (prev.x + curr.x) * 0.5;
            const startY = i === 1 ? prev.y : (prev.y + curr.y) * 0.5;

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.quadraticCurveTo(curr.x, curr.y, endX, endY);
            ctx.shadowColor = "#E5484D";
            ctx.shadowBlur = 10;
            ctx.strokeStyle = `rgba(229, 72, 77, ${alpha * 0.75})`;
            ctx.lineWidth = Math.max(1.2, progress * 7.5);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.quadraticCurveTo(curr.x, curr.y, endX, endY);
            ctx.shadowBlur = 0;
            ctx.strokeStyle = `rgba(245, 158, 11, ${alpha * 0.95})`;
            ctx.lineWidth = Math.max(0.6, progress * 2.8);
            ctx.stroke();
          }

          ctx.restore();
        }
        for (let i = ribbon.length - 1; i >= 0; i -= 1) {
          ribbon[i].life -= 0.055 * dt;
          if (ribbon[i].life <= 0) ribbon.splice(i, 1);
        }
      } else if (effectId === "cursor-tactical-cyber-crosshair" && hasMoved) {
        const ax = (pointerX - reticleX) * 0.22;
        const ay = (pointerY - reticleY) * 0.22;
        reticleVx = (reticleVx + ax) * Math.pow(0.72, dt);
        reticleVy = (reticleVy + ay) * Math.pow(0.72, dt);
        reticleX += reticleVx * dt;
        reticleY += reticleVy * dt;

        const targetLock = isHoveringInteractive ? 1 : 0;
        lockProgress += (targetLock - lockProgress) * Math.min(1, 0.18 * dt);
        angle += (0.018 + lockProgress * 0.045) * dt;

        const radius = 17 - lockProgress * 4;
        const primaryStroke = isHoveringInteractive ? "#E5484D" : "#1A1714";
        const accentStroke = isHoveringInteractive ? "#F59E0B" : "#0284C7";

        ctx.save();
        ctx.translate(reticleX, reticleY);

        ctx.strokeStyle = primaryStroke;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.save();
        ctx.rotate(angle + lockProgress * (Math.PI / 4));
        ctx.strokeStyle = accentStroke;
        ctx.lineWidth = 1.8;
        for (let i = 0; i < 4; i += 1) {
          ctx.rotate(Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(radius - 5, 0);
          ctx.lineTo(radius + 5, 0);
          ctx.stroke();
        }
        ctx.restore();

        if (lockProgress > 0.08) {
          const b = radius + 4;
          const len = 5;
          ctx.globalAlpha = lockProgress;
          ctx.strokeStyle = "#E5484D";
          ctx.lineWidth = 1.8;
          for (let i = 0; i < 4; i += 1) {
            ctx.save();
            ctx.rotate((Math.PI / 2) * i);
            ctx.beginPath();
            ctx.moveTo(-b, -b + len);
            ctx.lineTo(-b, -b);
            ctx.lineTo(-b + len, -b);
            ctx.stroke();
            ctx.restore();
          }
          ctx.globalAlpha = 1;
        }

        ctx.restore();

        ctx.fillStyle = "#E5484D";
        ctx.beginPath();
        ctx.arc(pointerX, pointerY, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      rafId = window.requestAnimationFrame(render);
    };

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave);
    rafId = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [effectId]);

  if (!effectId || !VALID_CURSOR_EFFECTS.has(effectId)) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50"
    />
  );
}

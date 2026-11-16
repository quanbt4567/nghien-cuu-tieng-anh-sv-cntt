"use client";

import { useEffect, useRef } from "react";
import { Mesh, Program, Renderer, Triangle } from "ogl";
import "./cosmetics.css";

export interface CustomCursorTrailProps {
  effectId?: string | null;
}

type CursorMode =
  | "cursor-pixel-sparkle-trail"
  | "cursor-binary-01-stream"
  | "cursor-neon-laser-ribbon"
  | "cursor-tactical-cyber-crosshair";

const VALID_MODES = new Set<CursorMode>([
  "cursor-pixel-sparkle-trail",
  "cursor-binary-01-stream",
  "cursor-neon-laser-ribbon",
  "cursor-tactical-cyber-crosshair",
]);

const TRAIL_COUNT = 24;
const SPLASH_COUNT = 4;

const VERTEX_SHADER = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uVelocity;
uniform vec4 uTrail[${TRAIL_COUNT}];
uniform vec4 uSplash[${SPLASH_COUNT}];

varying vec2 vUv;

float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.00001), 0.0, 1.0);
  return length(pa - ba * h);
}

vec2 curlOffset(vec2 p, float t) {
  float a = sin(p.y * 18.0 + t * 2.4) * cos(p.x * 16.0 - t * 1.9);
  float b = cos(p.x * 19.0 + t * 2.1) * sin(p.y * 15.0 + t * 1.7);
  return vec2(a, b);
}

void main() {
  vec2 aspect = vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
  vec2 p = vUv * aspect;
  float speed = clamp(length(uVelocity) * 22.0, 0.0, 1.8);

  vec3 col = vec3(0.0);
  float alpha = 0.0;

  vec3 crimson = vec3(0.90, 0.28, 0.30);
  vec3 cyan = vec3(0.14, 0.78, 0.92);

  for (int i = 0; i < ${TRAIL_COUNT - 1}; i++) {
    vec4 a = uTrail[i];
    vec4 b = uTrail[i + 1];
    float life = min(a.z, b.z);
    if (life <= 0.01) continue;

    vec2 pa = a.xy * aspect;
    vec2 pb = b.xy * aspect;
    float age = 1.0 - life;
    vec2 advect = curlOffset(p, uTime) * (0.006 * age);
    float d = sdSegment(p + advect, pa, pb);

    float w = (0.0022 + 0.0045 * max(a.w, speed)) * life;
    float core = exp(-d / max(w * 0.65, 0.0012)) * life;
    float bloom = exp(-d * (42.0 - 14.0 * age)) * life * 0.42;

    float mixT = clamp(0.25 + 0.55 * sin(float(i) * 0.35 - uTime * 2.2) * 0.5 + 0.25, 0.0, 1.0);
    vec3 ribbonCol = mix(crimson, cyan, mixT);
    col += ribbonCol * (core * 0.7 + bloom);
    alpha += core * 0.48 + bloom * 0.42;
  }

  for (int i = 0; i < ${SPLASH_COUNT}; i++) {
    vec4 sp = uSplash[i];
    float life = sp.z;
    if (life <= 0.01) continue;
    vec2 center = sp.xy * aspect;
    float age = 1.0 - life;
    vec2 rel = p - center;
    vec2 curl = curlOffset(p * 1.4, uTime * 1.5) * 0.008 * age;
    float r = length(rel + curl);
    float ringRadius = 0.012 + age * 0.085 * sp.w;
    float ring = exp(-abs(r - ringRadius) * 85.0) * life;
    float glow = exp(-r * 28.0) * life * 0.35;
    vec3 splashCol = mix(cyan, crimson, age);
    col += splashCol * (ring * 0.8 + glow);
    alpha += (ring * 0.55 + glow * 0.35);
  }

  gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.68));
}
`;

interface SparkleParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
}

interface BinaryParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  char: "0" | "1";
  life: number;
  maxLife: number;
}

interface FallbackRibbonNode {
  x: number;
  y: number;
  life: number;
}

interface FallbackSplash {
  x: number;
  y: number;
  life: number;
}

const SPARKLE_COLORS = ["#FBBF24", "#F59E0B", "#FB7185", "#E5484D"];

function run2DFallbackRibbon(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const nodes: FallbackRibbonNode[] = [];
  const splashes: FallbackSplash[] = [];
  let rafId = 0;
  let lastFrame = performance.now();
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
  };
  resize();

  const onPointerMove = (e: PointerEvent) => {
    nodes.unshift({ x: e.clientX, y: e.clientY, life: 1 });
    if (nodes.length > 22) nodes.pop();
  };

  const onPointerDown = (e: PointerEvent) => {
    splashes.push({ x: e.clientX, y: e.clientY, life: 1 });
  };

  const frame = (now: number) => {
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (let i = nodes.length - 1; i >= 0; i -= 1) {
      nodes[i].life -= dt * 2.4;
      if (nodes[i].life <= 0) nodes.splice(i, 1);
    }

    if (nodes.length > 1) {
      for (let i = 0; i < nodes.length - 1; i += 1) {
        const a = nodes[i];
        const b = nodes[i + 1];
        const life = Math.min(a.life, b.life);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineCap = "round";
        ctx.lineWidth = Math.max(1.5, 6 * life);
        ctx.strokeStyle = i % 2 === 0
          ? `rgba(229, 72, 77, ${0.42 * life})`
          : `rgba(36, 199, 235, ${0.38 * life})`;
        ctx.stroke();
      }
    }

    for (let i = splashes.length - 1; i >= 0; i -= 1) {
      const sp = splashes[i];
      sp.life -= dt * 1.9;
      if (sp.life <= 0) {
        splashes.splice(i, 1);
        continue;
      }
      const radius = 8 + (1 - sp.life) * 44;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, radius, 0, Math.PI * 2);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = `rgba(36, 199, 235, ${0.45 * sp.life})`;
      ctx.stroke();
    }

    rafId = window.requestAnimationFrame(frame);
  };

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  rafId = window.requestAnimationFrame(frame);

  return () => {
    if (rafId) window.cancelAnimationFrame(rafId);
    window.removeEventListener("resize", resize);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerdown", onPointerDown);
  };
}

function runWebGLRibbon(canvas: HTMLCanvasElement): () => void {
  let renderer: Renderer | null = null;
  try {
    renderer = new Renderer({
      canvas,
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    });
  } catch {
    return run2DFallbackRibbon(canvas);
  }

  const gl = renderer.gl;
  if (!gl) return run2DFallbackRibbon(canvas);
  gl.clearColor(0, 0, 0, 0);

  const trailData = new Float32Array(TRAIL_COUNT * 4);
  for (let i = 0; i < TRAIL_COUNT; i += 1) {
    trailData[i * 4] = -1;
    trailData[i * 4 + 1] = -1;
    trailData[i * 4 + 2] = 0;
    trailData[i * 4 + 3] = 0;
  }

  const splashData = new Float32Array(SPLASH_COUNT * 4);
  for (let i = 0; i < SPLASH_COUNT; i += 1) {
    splashData[i * 4] = -1;
    splashData[i * 4 + 1] = -1;
    splashData[i * 4 + 2] = 0;
    splashData[i * 4 + 3] = 1;
  }

  const geometry = new Triangle(gl);
  const program = new Program(gl, {
    vertex: VERTEX_SHADER,
    fragment: FRAGMENT_SHADER,
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: [window.innerWidth, window.innerHeight] },
      uVelocity: { value: [0, 0] },
      uTrail: { value: trailData },
      uSplash: { value: splashData },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new Mesh(gl, { geometry, program });

  let prevX = -1;
  let prevY = -1;
  let velX = 0;
  let velY = 0;
  let lastEmit = 0;
  let splashIndex = 0;
  let rafId = 0;
  let lastFrame = performance.now();
  const startTime = lastFrame;

  const resize = () => {
    if (!renderer) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    program.uniforms.uResolution.value = [w, h];
  };
  resize();

  const onPointerMove = (e: PointerEvent) => {
    const w = Math.max(window.innerWidth, 1);
    const h = Math.max(window.innerHeight, 1);
    const nx = e.clientX / w;
    const ny = 1 - e.clientY / h;

    if (prevX >= 0) {
      velX = nx - prevX;
      velY = ny - prevY;
    }
    prevX = nx;
    prevY = ny;

    const now = performance.now();
    if (now - lastEmit >= 14) {
      lastEmit = now;
      for (let i = TRAIL_COUNT - 1; i > 0; i -= 1) {
        trailData[i * 4] = trailData[(i - 1) * 4];
        trailData[i * 4 + 1] = trailData[(i - 1) * 4 + 1];
        trailData[i * 4 + 2] = trailData[(i - 1) * 4 + 2];
        trailData[i * 4 + 3] = trailData[(i - 1) * 4 + 3];
      }
      trailData[0] = nx;
      trailData[1] = ny;
      trailData[2] = 1;
      trailData[3] = Math.min(1.6, Math.hypot(velX, velY) * 28);
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    const w = Math.max(window.innerWidth, 1);
    const h = Math.max(window.innerHeight, 1);
    const offset = splashIndex * 4;
    splashData[offset] = e.clientX / w;
    splashData[offset + 1] = 1 - e.clientY / h;
    splashData[offset + 2] = 1;
    splashData[offset + 3] = 1;
    splashIndex = (splashIndex + 1) % SPLASH_COUNT;
  };

  const renderFrame = (now: number) => {
    if (!renderer) return;
    const dt = Math.min(Math.max((now - lastFrame) / 16.6667, 0.25), 2.5);
    lastFrame = now;

    velX *= Math.pow(0.84, dt);
    velY *= Math.pow(0.84, dt);

    for (let i = 0; i < TRAIL_COUNT; i += 1) {
      const idx = i * 4 + 2;
      if (trailData[idx] > 0) {
        trailData[idx] = Math.max(0, trailData[idx] - 0.044 * dt);
      }
    }

    for (let i = 0; i < SPLASH_COUNT; i += 1) {
      const idx = i * 4 + 2;
      if (splashData[idx] > 0) {
        splashData[idx] = Math.max(0, splashData[idx] - 0.03 * dt);
      }
    }

    program.uniforms.uTime.value = (now - startTime) * 0.001;
    program.uniforms.uVelocity.value = [velX, velY];

    renderer.render({ scene: mesh });
    rafId = window.requestAnimationFrame(renderFrame);
  };

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  rafId = window.requestAnimationFrame(renderFrame);

  return () => {
    if (rafId) window.cancelAnimationFrame(rafId);
    window.removeEventListener("resize", resize);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerdown", onPointerDown);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    renderer = null;
  };
}

function run2DCursorEffect(canvas: HTMLCanvasElement, mode: Exclude<CursorMode, "cursor-neon-laser-ribbon">): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const sparkles: SparkleParticle[] = [];
  const binaries: BinaryParticle[] = [];

  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let lastSpawnX = -999;
  let lastSpawnY = -999;
  let hasPointer = false;
  let targetX = -100;
  let targetY = -100;
  let dotX = -100;
  let dotY = -100;
  let dotVx = 0;
  let dotVy = 0;
  let reticleX = -100;
  let reticleY = -100;
  let pointerSpeed = 0;
  let lastMoveX = -1;
  let lastMoveY = -1;
  let hoverTarget = 0;
  let hoverSmooth = 0;
  let rafId = 0;
  let lastFrame = performance.now();

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
  };
  resize();

  const onPointerMove = (e: PointerEvent) => {
    const x = e.clientX;
    const y = e.clientY;

    if (!hasPointer) {
      hasPointer = true;
      dotX = x;
      dotY = y;
      reticleX = x;
      reticleY = y;
    }

    if (lastMoveX >= 0) {
      const dist = Math.hypot(x - lastMoveX, y - lastMoveY);
      pointerSpeed = Math.min(1, pointerSpeed * 0.5 + dist / 45);
    }
    lastMoveX = x;
    lastMoveY = y;
    targetX = x;
    targetY = y;

    if (mode === "cursor-tactical-cyber-crosshair") {
      const target = e.target instanceof Element ? e.target : null;
      hoverTarget = target?.closest("a, button") ? 1 : 0;
      return;
    }

    const distSinceSpawn = Math.hypot(x - lastSpawnX, y - lastSpawnY);

    if (mode === "cursor-pixel-sparkle-trail" && distSinceSpawn >= 7) {
      lastSpawnX = x;
      lastSpawnY = y;
      const count = distSinceSpawn > 24 ? 2 : 1;
      for (let i = 0; i < count; i += 1) {
        sparkles.push({
          x: x + (Math.random() - 0.5) * 8,
          y: y + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 26,
          vy: -8 + (Math.random() - 0.5) * 16,
          size: 3 + Math.floor(Math.random() * 3),
          life: 0.5,
          maxLife: 0.5,
          color: SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)],
        });
      }
      if (sparkles.length > 48) sparkles.splice(0, sparkles.length - 48);
    }

    if (mode === "cursor-binary-01-stream" && distSinceSpawn >= 14) {
      lastSpawnX = x;
      lastSpawnY = y;
      binaries.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 12,
        vy: -14 - Math.random() * 12,
        char: Math.random() < 0.5 ? "0" : "1",
        life: 0.65,
        maxLife: 0.65,
      });
      if (binaries.length > 36) binaries.splice(0, binaries.length - 36);
    }
  };

  const onPointerLeave = () => {
    hasPointer = false;
    hoverTarget = 0;
  };

  const frame = (now: number) => {
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    if (mode === "cursor-pixel-sparkle-trail") {
      for (let i = sparkles.length - 1; i >= 0; i -= 1) {
        const p = sparkles[i];
        p.life -= dt;
        if (p.life <= 0) {
          sparkles.splice(i, 1);
          continue;
        }
        p.vy += 58 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = alpha * 0.88;
        ctx.fillStyle = p.color;
        const px = Math.round(p.x - p.size / 2);
        const py = Math.round(p.y - p.size / 2);
        ctx.fillRect(px, py, p.size, p.size);
      }
      ctx.globalAlpha = 1;
    } else if (mode === "cursor-binary-01-stream") {
      ctx.font = "600 11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let i = binaries.length - 1; i >= 0; i -= 1) {
        const b = binaries[i];
        b.life -= dt;
        if (b.life <= 0) {
          binaries.splice(i, 1);
          continue;
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        const alpha = Math.max(0, b.life / b.maxLife);
        ctx.fillStyle = `rgba(34, 197, 94, ${0.42 * alpha})`;
        ctx.fillText(b.char, Math.round(b.x), Math.round(b.y));
      }
    } else if (mode === "cursor-tactical-cyber-crosshair" && hasPointer) {
      const stiffness = 260;
      const damping = 24;
      const ax = (targetX - dotX) * stiffness - dotVx * damping;
      const ay = (targetY - dotY) * stiffness - dotVy * damping;
      dotVx += ax * dt;
      dotVy += ay * dt;
      dotX += dotVx * dt;
      dotY += dotVy * dt;

      const followRate = 1 - Math.exp(-18 * dt);
      reticleX += (targetX - reticleX) * followRate;
      reticleY += (targetY - reticleY) * followRate;

      pointerSpeed *= Math.exp(-8 * dt);
      hoverSmooth += (hoverTarget - hoverSmooth) * Math.min(1, dt * 14);

      const radius = 11 + pointerSpeed * 6 - hoverSmooth * 2.5;
      const tick = 4;
      const stroke = hoverSmooth > 0.5
        ? `rgba(229, 72, 77, ${0.65 + hoverSmooth * 0.2})`
        : "rgba(56, 189, 248, 0.72)";

      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;

      const cx = Math.round(reticleX) + 0.5;
      const cy = Math.round(reticleY) + 0.5;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx - radius - tick, cy);
      ctx.lineTo(cx - radius + 1.5, cy);
      ctx.moveTo(cx + radius - 1.5, cy);
      ctx.lineTo(cx + radius + tick, cy);
      ctx.moveTo(cx, cy - radius - tick);
      ctx.lineTo(cx, cy - radius + 1.5);
      ctx.moveTo(cx, cy + radius - 1.5);
      ctx.lineTo(cx, cy + radius + tick);
      ctx.stroke();

      ctx.fillStyle = hoverSmooth > 0.5 ? "rgba(229, 72, 77, 0.9)" : "rgba(244, 63, 94, 0.85)";
      ctx.beginPath();
      ctx.arc(dotX, dotY, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    rafId = window.requestAnimationFrame(frame);
  };

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("pointerleave", onPointerLeave);
  rafId = window.requestAnimationFrame(frame);

  return () => {
    if (rafId) window.cancelAnimationFrame(rafId);
    window.removeEventListener("resize", resize);
    window.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerleave", onPointerLeave);
  };
}

export function CustomCursorTrail({ effectId }: CustomCursorTrailProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mode = effectId && VALID_MODES.has(effectId as CursorMode) ? (effectId as CursorMode) : null;

  useEffect(() => {
    if (!mode) return;
    if (typeof window === "undefined") return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    if (mode === "cursor-neon-laser-ribbon") {
      return runWebGLRibbon(canvas);
    }

    return run2DCursorEffect(canvas, mode);
  }, [mode]);

  if (!mode) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 block w-full h-full"
    />
  );
}

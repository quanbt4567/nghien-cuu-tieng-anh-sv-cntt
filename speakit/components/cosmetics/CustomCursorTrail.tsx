"use client";

import { useEffect, useRef } from "react";
import { Mesh, Program, Renderer, Triangle } from "ogl";
import {
  DynamicBlobCursor,
  DynamicClickSpark,
  DynamicCrosshair,
  DynamicGhostCursor,
  DynamicPixelTrail,
  DynamicRibbons,
  DynamicSplashCursor,
  DynamicSwarmCursor,
  DynamicTargetCursor,
} from "./reactbits";
import "./cosmetics.css";

export interface CustomCursorTrailProps {
  effectId?: string | null;
}

type CursorMode =
  | "cursor-pixel-sparkle-trail"
  | "cursor-binary-01-stream"
  | "cursor-neon-laser-ribbon"
  | "cursor-tactical-cyber-crosshair"
  | "cursor-rb-splash-fluid"
  | "cursor-rb-pixel-trail"
  | "cursor-rb-ribbons"
  | "cursor-rb-blob-mercury"
  | "cursor-rb-crosshair"
  | "cursor-rb-ghost-smoke"
  | "cursor-rb-antigravity-swarm"
  | "cursor-rb-click-spark"
  | "cursor-rb-target-reticle"
  | "cursor-magic-cool-confetti"
  | "cursor-magic-meteor-tail"
  | "cursor-tholman-fairy-dust"
  | "cursor-tholman-rainbow-chain"
  | "cursor-tholman-springy-emoji";

const VALID_MODES = new Set<CursorMode>([
  "cursor-pixel-sparkle-trail",
  "cursor-binary-01-stream",
  "cursor-neon-laser-ribbon",
  "cursor-tactical-cyber-crosshair",
  "cursor-rb-splash-fluid",
  "cursor-rb-pixel-trail",
  "cursor-rb-ribbons",
  "cursor-rb-blob-mercury",
  "cursor-rb-crosshair",
  "cursor-rb-ghost-smoke",
  "cursor-rb-antigravity-swarm",
  "cursor-rb-click-spark",
  "cursor-rb-target-reticle",
  "cursor-magic-cool-confetti",
  "cursor-magic-meteor-tail",
  "cursor-tholman-fairy-dust",
  "cursor-tholman-rainbow-chain",
  "cursor-tholman-springy-emoji",
]);

const REACT_BITS_CURSOR_MODES = new Set<CursorMode>([
  "cursor-rb-ribbons",
  "cursor-rb-crosshair",
  "cursor-rb-ghost-smoke",
  "cursor-rb-antigravity-swarm",
  "cursor-rb-target-reticle",
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

interface CrosshairRing {
  x: number;
  y: number;
  life: number;
  maxLife: number;
}

export const SPEAKIT_CURSOR_BURST_EVENT = "speakit-cursor-burst";

export interface CursorBurstDetail {
  x?: number;
  y?: number;
  effectId?: string | null;
}

const SPARKLE_COLORS = ["#FBBF24", "#F59E0B", "#FB7185", "#E5484D"];

function getTouchCoords(e: TouchEvent): { x: number; y: number } | null {
  const touch = e.touches[0] ?? e.changedTouches[0];
  if (!touch) return null;
  return { x: touch.clientX, y: touch.clientY };
}

function resolveBurstCoords(
  e: Event,
  mode: CursorMode
): { x: number; y: number } | null {
  const detail = (e as CustomEvent<CursorBurstDetail>).detail;
  if (detail?.effectId && detail.effectId !== mode) return null;
  const fallbackX = typeof window !== "undefined" ? window.innerWidth / 2 : 0;
  const fallbackY = typeof window !== "undefined" ? window.innerHeight / 2 : 0;
  return {
    x:
      typeof detail?.x === "number" && Number.isFinite(detail.x)
        ? detail.x
        : fallbackX,
    y:
      typeof detail?.y === "number" && Number.isFinite(detail.y)
        ? detail.y
        : fallbackY,
  };
}

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

  const pushNode = (x: number, y: number) => {
    nodes.unshift({ x, y, life: 1 });
    if (nodes.length > 22) nodes.pop();
  };

  const triggerBurst = (x: number, y: number, count = 8, radius = 32) => {
    splashes.push({ x, y, life: 1 });
    for (let i = 0; i < count; i += 1) {
      const t = i / Math.max(1, count - 1);
      const angle = t * Math.PI * 1.75;
      const r = radius * (0.25 + 0.75 * t);
      pushNode(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    pushNode(e.clientX, e.clientY);
  };

  const onPointerDown = (e: PointerEvent) => {
    triggerBurst(e.clientX, e.clientY, 5, 18);
  };

  const onTouchStart = (e: TouchEvent) => {
    const coords = getTouchCoords(e);
    if (coords) triggerBurst(coords.x, coords.y, 5, 18);
  };

  const onTouchMove = (e: TouchEvent) => {
    const coords = getTouchCoords(e);
    if (coords) pushNode(coords.x, coords.y);
  };

  const onBurst = (e: Event) => {
    const coords = resolveBurstCoords(e, "cursor-neon-laser-ribbon");
    if (coords) triggerBurst(coords.x, coords.y);
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
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: true });
  window.addEventListener(SPEAKIT_CURSOR_BURST_EVENT, onBurst);
  rafId = window.requestAnimationFrame(frame);

  return () => {
    if (rafId) window.cancelAnimationFrame(rafId);
    window.removeEventListener("resize", resize);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener(SPEAKIT_CURSOR_BURST_EVENT, onBurst);
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

  const pushTrailPoint = (x: number, y: number, force = false, boostSpeed?: number) => {
    const w = Math.max(window.innerWidth, 1);
    const h = Math.max(window.innerHeight, 1);
    const nx = x / w;
    const ny = 1 - y / h;

    if (prevX >= 0) {
      velX = nx - prevX;
      velY = ny - prevY;
    }
    prevX = nx;
    prevY = ny;

    const now = performance.now();
    if (force || now - lastEmit >= 14) {
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
      trailData[3] =
        boostSpeed ?? Math.min(1.6, Math.hypot(velX, velY) * 28);
    }
  };

  const pushSplash = (x: number, y: number) => {
    const w = Math.max(window.innerWidth, 1);
    const h = Math.max(window.innerHeight, 1);
    const offset = splashIndex * 4;
    splashData[offset] = x / w;
    splashData[offset + 1] = 1 - y / h;
    splashData[offset + 2] = 1;
    splashData[offset + 3] = 1;
    splashIndex = (splashIndex + 1) % SPLASH_COUNT;
  };

  const triggerBurst = (x: number, y: number, count = 10, radius = 36) => {
    pushSplash(x, y);
    for (let i = 0; i < count; i += 1) {
      const t = i / Math.max(1, count - 1);
      const angle = t * Math.PI * 1.8;
      const r = radius * (0.2 + 0.8 * t);
      pushTrailPoint(
        x + Math.cos(angle) * r,
        y + Math.sin(angle) * r,
        true,
        1.35
      );
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    pushTrailPoint(e.clientX, e.clientY);
  };

  const onPointerDown = (e: PointerEvent) => {
    triggerBurst(e.clientX, e.clientY, 5, 18);
  };

  const onTouchStart = (e: TouchEvent) => {
    const coords = getTouchCoords(e);
    if (coords) triggerBurst(coords.x, coords.y, 5, 18);
  };

  const onTouchMove = (e: TouchEvent) => {
    const coords = getTouchCoords(e);
    if (coords) pushTrailPoint(coords.x, coords.y);
  };

  const onBurst = (e: Event) => {
    const coords = resolveBurstCoords(e, "cursor-neon-laser-ribbon");
    if (coords) triggerBurst(coords.x, coords.y);
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
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: true });
  window.addEventListener(SPEAKIT_CURSOR_BURST_EVENT, onBurst);
  rafId = window.requestAnimationFrame(renderFrame);

  return () => {
    if (rafId) window.cancelAnimationFrame(rafId);
    window.removeEventListener("resize", resize);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener(SPEAKIT_CURSOR_BURST_EVENT, onBurst);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    renderer = null;
  };
}

function run2DCursorEffect(canvas: HTMLCanvasElement, mode: Exclude<CursorMode, "cursor-neon-laser-ribbon">): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const sparkles: SparkleParticle[] = [];
  const binaries: BinaryParticle[] = [];
  const crosshairRings: CrosshairRing[] = [];
  const fluidBlobs: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    life: number;
    maxLife: number;
    color: string;
  }> = [];
  const sparkRays: Array<{
    x: number;
    y: number;
    angle: number;
    speed: number;
    length: number;
    life: number;
    maxLife: number;
    color: string;
  }> = [];
  const blobNodes = Array.from({ length: 7 }, () => ({ x: -100, y: -100, vx: 0, vy: 0 }));
  const meteorNodes = Array.from({ length: 16 }, () => ({ x: -100, y: -100 }));
  const FLUID_COLORS = ["#EC4899", "#38BDF8", "#A855F7", "#F59E0B", "#10B981"];
  const GHOST_COLORS = ["#A855F7", "#6366F1", "#38BDF8", "#C084FC"];
  const COOL_COLORS = ["#F43F5E", "#F59E0B", "#10B981", "#3B82F6", "#A855F7", "#EC4899"];

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

  const syncPointer = (x: number, y: number, targetEl: EventTarget | null) => {
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

    if (
      mode === "cursor-tactical-cyber-crosshair" ||
      mode === "cursor-rb-target-reticle"
    ) {
      const target = targetEl instanceof Element ? targetEl : null;
      hoverTarget = target?.closest("a, button") ? 1 : 0;
    }
  };

  const spawnBurst = (x: number, y: number, scale = 1) => {
    hasPointer = true;
    targetX = x;
    targetY = y;
    dotX = x;
    dotY = y;
    reticleX = x;
    reticleY = y;
    lastMoveX = x;
    lastMoveY = y;
    lastSpawnX = x;
    lastSpawnY = y;
    for (const node of blobNodes) {
      if (node.x < 0) {
        node.x = x;
        node.y = y;
      }
    }
    for (const m of meteorNodes) {
      if (m.x < 0) {
        m.x = x;
        m.y = y;
      }
    }

    if (
      mode === "cursor-pixel-sparkle-trail" ||
      mode === "cursor-magic-cool-confetti"
    ) {
      const palette = mode === "cursor-magic-cool-confetti" ? COOL_COLORS : SPARKLE_COLORS;
      const count = Math.max(6, Math.round(14 * scale));
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
        const speed = 55 + Math.random() * 110;
        sparkles.push({
          x: x + (Math.random() - 0.5) * 8,
          y: y + (Math.random() - 0.5) * 8,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (mode === "cursor-magic-cool-confetti" ? 65 : 24),
          size: mode === "cursor-magic-cool-confetti" ? 5 + Math.floor(Math.random() * 5) : 4 + Math.floor(Math.random() * 4),
          life: 0.82,
          maxLife: 0.82,
          color: palette[Math.floor(Math.random() * palette.length)],
        });
      }
      if (sparkles.length > 72) sparkles.splice(0, sparkles.length - 72);
      return;
    }

    if (
      mode === "cursor-rb-splash-fluid" ||
      mode === "cursor-rb-ghost-smoke"
    ) {
      const palette = mode === "cursor-rb-ghost-smoke" ? GHOST_COLORS : FLUID_COLORS;
      const count = Math.max(6, Math.round(12 * scale));
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
        const speed = 35 + Math.random() * 75;
        fluidBlobs.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (mode === "cursor-rb-ghost-smoke" ? 30 : 0),
          radius: 16 + Math.random() * 18,
          life: 0.78,
          maxLife: 0.78,
          color: palette[i % palette.length],
        });
      }
      if (fluidBlobs.length > 56) fluidBlobs.splice(0, fluidBlobs.length - 56);
      return;
    }

    if (
      mode === "cursor-rb-click-spark" ||
      mode === "cursor-magic-meteor-tail"
    ) {
      const count = 12;
      for (let i = 0; i < count; i += 1) {
        sparkRays.push({
          x,
          y,
          angle: (Math.PI * 2 * i) / count,
          speed: 95 + (i % 2) * 35,
          length: 12 + (i % 2) * 6,
          life: 0.48,
          maxLife: 0.48,
          color: mode === "cursor-magic-meteor-tail" ? "#818CF8" : i % 2 === 0 ? "#FBBF24" : "#F59E0B",
        });
      }
      if (sparkRays.length > 48) sparkRays.splice(0, sparkRays.length - 48);
      return;
    }

    if (mode === "cursor-binary-01-stream") {
      const count = Math.max(5, Math.round(12 * scale));
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.35;
        const speed = 28 + Math.random() * 58;
        binaries.push({
          x: x + (Math.random() - 0.5) * 10,
          y: y + (Math.random() - 0.5) * 10,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 28,
          char: i % 2 === 0 ? "0" : "1",
          life: 0.85,
          maxLife: 0.85,
        });
      }
      if (binaries.length > 52) binaries.splice(0, binaries.length - 52);
      return;
    }

    pointerSpeed = 1;
    crosshairRings.push({ x, y, life: 0.65, maxLife: 0.65 });
    if (scale >= 1) {
      crosshairRings.push({ x, y, life: 0.45, maxLife: 0.45 });
    }
    if (crosshairRings.length > 8) crosshairRings.splice(0, crosshairRings.length - 8);
  };

  const handleMove = (x: number, y: number, targetEl: EventTarget | null) => {
    syncPointer(x, y, targetEl);
    if (
      mode === "cursor-tactical-cyber-crosshair" ||
      mode === "cursor-rb-target-reticle"
    ) {
      return;
    }

    const distSinceSpawn = Math.hypot(x - lastSpawnX, y - lastSpawnY);

    if (
      (mode === "cursor-pixel-sparkle-trail" ||
        mode === "cursor-rb-pixel-trail" ||
        mode === "cursor-magic-cool-confetti" ||
        mode === "cursor-rb-click-spark" ||
        mode === "cursor-tholman-fairy-dust") &&
      distSinceSpawn >= 7
    ) {
      lastSpawnX = x;
      lastSpawnY = y;
      const palette =
        mode === "cursor-rb-pixel-trail"
          ? ["#EC4899", "#F472B6", "#38BDF8", "#A855F7"]
          : mode === "cursor-magic-cool-confetti"
          ? COOL_COLORS
          : mode === "cursor-tholman-fairy-dust"
          ? ["#D61C59", "#E7D84B", "#1B8798"]
          : mode === "cursor-rb-click-spark"
          ? ["#FBBF24", "#FDE047", "#F59E0B"]
          : SPARKLE_COLORS;
      const count = distSinceSpawn > 24 ? 2 : 1;
      for (let i = 0; i < count; i += 1) {
        sparkles.push({
          x: x + (Math.random() - 0.5) * 8,
          y: y + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * (mode === "cursor-magic-cool-confetti" ? 55 : 26),
          vy: (mode === "cursor-magic-cool-confetti" ? -38 : -8) + (Math.random() - 0.5) * 18,
          size:
            mode === "cursor-rb-pixel-trail"
              ? 10 + Math.floor(Math.random() * 5)
              : mode === "cursor-magic-cool-confetti"
              ? 4 + Math.floor(Math.random() * 4)
              : 3 + Math.floor(Math.random() * 3),
          life: mode === "cursor-magic-cool-confetti" ? 0.68 : 0.5,
          maxLife: mode === "cursor-magic-cool-confetti" ? 0.68 : 0.5,
          color: palette[Math.floor(Math.random() * palette.length)],
        });
      }
      if (sparkles.length > 72) sparkles.splice(0, sparkles.length - 72);
    }

    if (
      (mode === "cursor-rb-splash-fluid" || mode === "cursor-rb-ghost-smoke") &&
      distSinceSpawn >= 8
    ) {
      lastSpawnX = x;
      lastSpawnY = y;
      const palette = mode === "cursor-rb-ghost-smoke" ? GHOST_COLORS : FLUID_COLORS;
      fluidBlobs.push({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 22,
        vy: mode === "cursor-rb-ghost-smoke" ? -28 - Math.random() * 18 : (Math.random() - 0.5) * 22,
        radius: mode === "cursor-rb-ghost-smoke" ? 14 + Math.random() * 12 : 18 + Math.random() * 14,
        life: 0.65,
        maxLife: 0.65,
        color: palette[Math.floor(Math.random() * palette.length)],
      });
      if (fluidBlobs.length > 56) fluidBlobs.splice(0, fluidBlobs.length - 56);
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
      if (binaries.length > 52) binaries.splice(0, binaries.length - 52);
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    handleMove(e.clientX, e.clientY, e.target);
  };

  const onPointerDown = (e: PointerEvent) => {
    syncPointer(e.clientX, e.clientY, e.target);
    spawnBurst(e.clientX, e.clientY, 0.55);
  };

  const onTouchStart = (e: TouchEvent) => {
    const coords = getTouchCoords(e);
    if (!coords) return;
    syncPointer(coords.x, coords.y, e.target);
    spawnBurst(coords.x, coords.y, 0.55);
  };

  const onTouchMove = (e: TouchEvent) => {
    const coords = getTouchCoords(e);
    if (!coords) return;
    handleMove(coords.x, coords.y, e.target);
  };

  const onBurst = (e: Event) => {
    const coords = resolveBurstCoords(e, mode);
    if (coords) spawnBurst(coords.x, coords.y, 1);
  };

  const onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    hasPointer = false;
    hoverTarget = 0;
  };

  const frame = (now: number) => {
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    if (mode === "cursor-pixel-sparkle-trail" || mode === "cursor-rb-pixel-trail") {
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
        ctx.fillStyle = `rgba(22, 163, 74, ${0.72 * alpha})`;
        ctx.fillText(b.char, Math.round(b.x), Math.round(b.y));
      }
    } else if (mode === "cursor-tactical-cyber-crosshair") {
      for (let i = crosshairRings.length - 1; i >= 0; i -= 1) {
        const ring = crosshairRings[i];
        ring.life -= dt;
        if (ring.life <= 0) {
          crosshairRings.splice(i, 1);
          continue;
        }
        const progress = 1 - ring.life / ring.maxLife;
        const r = 12 + progress * 28;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, r, 0, Math.PI * 2);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = `rgba(229, 72, 77, ${0.75 * (1 - progress)})`;
        ctx.stroke();
      }

      if (hasPointer) {
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
    } else if (
      mode === "cursor-rb-splash-fluid" ||
      mode === "cursor-rb-ghost-smoke"
    ) {
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      for (let i = fluidBlobs.length - 1; i >= 0; i -= 1) {
        const b = fluidBlobs[i];
        b.life -= dt;
        if (b.life <= 0) {
          fluidBlobs.splice(i, 1);
          continue;
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.radius += (mode === "cursor-rb-ghost-smoke" ? 26 : 18) * dt;
        const alpha = Math.max(0, b.life / b.maxLife) * (mode === "cursor-rb-ghost-smoke" ? 0.45 : 0.65);
        const grad = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, b.radius);
        grad.addColorStop(0, b.color);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = alpha;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (mode === "cursor-rb-blob-mercury") {
      if (hasPointer) {
        for (let i = 0; i < blobNodes.length; i += 1) {
          const node = blobNodes[i];
          const tx = i === 0 ? targetX : blobNodes[i - 1].x;
          const ty = i === 0 ? targetY : blobNodes[i - 1].y;
          const rate = 1 - Math.exp(-(24 - i * 2.6) * dt);
          node.x += (tx - node.x) * rate;
          node.y += (ty - node.y) * rate;
          const r = Math.max(4, 15 - i * 1.7);
          ctx.fillStyle = i === 0 ? "rgba(56, 189, 248, 0.78)" : `rgba(14, 165, 233, ${0.62 - i * 0.07})`;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
          ctx.beginPath();
          ctx.arc(node.x - r * 0.28, node.y - r * 0.28, r * 0.28, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (mode === "cursor-rb-antigravity-swarm") {
      if (hasPointer) {
        const followRate = 1 - Math.exp(-16 * dt);
        reticleX += (targetX - reticleX) * followRate;
        reticleY += (targetY - reticleY) * followRate;
        const t = now * 0.003;
        const count = 14;
        for (let i = 0; i < count; i += 1) {
          const angle = (Math.PI * 2 * i) / count + t;
          const wave = Math.sin(t * 2.4 + i * 0.9) * 5;
          const r = 20 + wave + pointerSpeed * 10;
          const px = reticleX + Math.cos(angle) * r;
          const py = reticleY + Math.sin(angle) * r;
          ctx.fillStyle = i % 2 === 0 ? "#F59E0B" : "#EC4899";
          ctx.beginPath();
          ctx.arc(px, py, 2.8, 0, Math.PI * 2);
          ctx.fill();
        }
        pointerSpeed *= Math.exp(-6 * dt);
      }
      for (let i = crosshairRings.length - 1; i >= 0; i -= 1) {
        const ring = crosshairRings[i];
        ring.life -= dt;
        if (ring.life <= 0) {
          crosshairRings.splice(i, 1);
          continue;
        }
        const progress = 1 - ring.life / ring.maxLife;
        ctx.strokeStyle = `rgba(245, 158, 11, ${0.7 * (1 - progress)})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, 14 + progress * 32, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (
      mode === "cursor-rb-click-spark" ||
      mode === "cursor-magic-cool-confetti"
    ) {
      for (let i = sparkles.length - 1; i >= 0; i -= 1) {
        const p = sparkles[i];
        p.life -= dt;
        if (p.life <= 0) {
          sparkles.splice(i, 1);
          continue;
        }
        p.vy += (mode === "cursor-magic-cool-confetti" ? 140 : 42) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = alpha * 0.92;
        ctx.fillStyle = p.color;
        if (mode === "cursor-magic-cool-confetti") {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.life * 8);
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      for (let i = sparkRays.length - 1; i >= 0; i -= 1) {
        const ray = sparkRays[i];
        ray.life -= dt;
        if (ray.life <= 0) {
          sparkRays.splice(i, 1);
          continue;
        }
        const progress = 1 - ray.life / ray.maxLife;
        const dist = progress * ray.speed * 0.42;
        const x1 = ray.x + Math.cos(ray.angle) * dist;
        const y1 = ray.y + Math.sin(ray.angle) * dist;
        const x2 = ray.x + Math.cos(ray.angle) * (dist + ray.length * (1 - progress * 0.5));
        const y2 = ray.y + Math.sin(ray.angle) * (dist + ray.length * (1 - progress * 0.5));
        ctx.strokeStyle = ray.color;
        ctx.globalAlpha = 1 - progress;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (mode === "cursor-rb-target-reticle") {
      if (hasPointer) {
        const followRate = 1 - Math.exp(-20 * dt);
        reticleX += (targetX - reticleX) * followRate;
        reticleY += (targetY - reticleY) * followRate;
        hoverSmooth += (hoverTarget - hoverSmooth) * Math.min(1, dt * 14);
        const s = 14 - hoverSmooth * 3;
        const corner = 5;
        ctx.save();
        ctx.translate(reticleX, reticleY);
        ctx.rotate(hoverSmooth > 0.4 ? 0 : now * 0.0015);
        ctx.strokeStyle = hoverSmooth > 0.4 ? "#10B981" : "#38BDF8";
        ctx.lineWidth = 2;
        const corners = [
          [-s, -s, 1, 1],
          [s, -s, -1, 1],
          [s, s, -1, -1],
          [-s, s, 1, -1],
        ];
        for (const [cx, cy, dx, dy] of corners) {
          ctx.beginPath();
          ctx.moveTo(cx, cy + dy * corner);
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx + dx * corner, cy);
          ctx.stroke();
        }
        ctx.fillStyle = "#10B981";
        ctx.beginPath();
        ctx.arc(0, 0, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else if (mode === "cursor-magic-meteor-tail") {
      if (hasPointer) {
        for (let i = 0; i < meteorNodes.length; i += 1) {
          const m = meteorNodes[i];
          const tx = i === 0 ? targetX : meteorNodes[i - 1].x;
          const ty = i === 0 ? targetY : meteorNodes[i - 1].y;
          m.x += (tx - m.x) * 0.48;
          m.y += (ty - m.y) * 0.48;
        }
        for (let i = meteorNodes.length - 1; i >= 1; i -= 1) {
          const cur = meteorNodes[i];
          const prev = meteorNodes[i - 1];
          const t = 1 - i / meteorNodes.length;
          ctx.strokeStyle = i < 5 ? `rgba(56, 189, 248, ${t * 0.85})` : `rgba(99, 102, 241, ${t * 0.7})`;
          ctx.lineWidth = Math.max(1.2, t * 8);
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(cur.x, cur.y);
          ctx.stroke();
        }
        const head = meteorNodes[0];
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(head.x, head.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = sparkRays.length - 1; i >= 0; i -= 1) {
        const ray = sparkRays[i];
        ray.life -= dt;
        if (ray.life <= 0) {
          sparkRays.splice(i, 1);
          continue;
        }
        const progress = 1 - ray.life / ray.maxLife;
        const dist = progress * ray.speed * 0.35;
        ctx.strokeStyle = ray.color;
        ctx.globalAlpha = 1 - progress;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(ray.x + Math.cos(ray.angle) * dist, ray.y + Math.sin(ray.angle) * dist);
        ctx.lineTo(
          ray.x + Math.cos(ray.angle) * (dist + ray.length),
          ray.y + Math.sin(ray.angle) * (dist + ray.length)
        );
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (mode === "cursor-tholman-fairy-dust") {
      ctx.font = "700 18px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let i = sparkles.length - 1; i >= 0; i -= 1) {
        const p = sparkles[i];
        p.life -= dt;
        if (p.life <= 0) {
          sparkles.splice(i, 1);
          continue;
        }
        p.vy += 48 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const scale = Math.max(0, p.life / p.maxLife);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(scale, scale);
        ctx.fillStyle = p.color;
        ctx.fillText("*", 0, 0);
        ctx.restore();
      }
    } else if (mode === "cursor-tholman-rainbow-chain") {
      if (hasPointer) {
        for (let i = 0; i < meteorNodes.length; i += 1) {
          const m = meteorNodes[i];
          const tx = i === 0 ? targetX : meteorNodes[i - 1].x;
          const ty = i === 0 ? targetY : meteorNodes[i - 1].y;
          m.x += (tx - m.x) * 0.4;
          m.y += (ty - m.y) * 0.4;
        }
        const bands = ["#FE0000", "#FD8C00", "#FFE500", "#119F0B", "#0644B3", "#C22EDC"];
        for (let b = 0; b < bands.length; b += 1) {
          ctx.beginPath();
          ctx.strokeStyle = bands[b];
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          for (let i = 0; i < meteorNodes.length; i += 1) {
            const pt = meteorNodes[i];
            const py = pt.y + (b - 2.5) * 3;
            if (i === 0) ctx.moveTo(pt.x, py);
            else ctx.lineTo(pt.x, py);
          }
          ctx.stroke();
        }
      }
    } else if (mode === "cursor-tholman-springy-emoji") {
      if (hasPointer) {
        blobNodes[0].x = targetX;
        blobNodes[0].y = targetY;
        const SEGLEN = 10;
        const SPRINGK = 10;
        const RESISTANCE = 10;
        const GRAVITY = 50;
        for (let i = 1; i < blobNodes.length; i += 1) {
          const node = blobNodes[i];
          const prev = blobNodes[i - 1];
          const dx = prev.x - node.x;
          const dy = prev.y - node.y;
          const len = Math.hypot(dx, dy);
          let fx = 0;
          let fy = 0;
          if (len > SEGLEN) {
            const sf = SPRINGK * (len - SEGLEN);
            fx += (dx / len) * sf;
            fy += (dy / len) * sf;
          }
          if (i < blobNodes.length - 1) {
            const next = blobNodes[i + 1];
            const ndx = next.x - node.x;
            const ndy = next.y - node.y;
            const nlen = Math.hypot(ndx, ndy);
            if (nlen > SEGLEN) {
              const sf = SPRINGK * (nlen - SEGLEN);
              fx += (ndx / nlen) * sf;
              fy += (ndy / nlen) * sf;
            }
          }
          fx += -node.vx * RESISTANCE;
          fy += -node.vy * RESISTANCE + GRAVITY;
          node.vx += fx * dt;
          node.vy += fy * dt;
          node.x += node.vx * dt * 10;
          node.y += node.vy * dt * 10;
          ctx.fillStyle = i % 2 === 0 ? "#F59E0B" : "#E5484D";
          ctx.beginPath();
          ctx.arc(node.x, node.y, Math.max(4, 10 - i), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    rafId = window.requestAnimationFrame(frame);
  };

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: true });
  window.addEventListener(SPEAKIT_CURSOR_BURST_EVENT, onBurst);
  document.addEventListener("pointerleave", onPointerLeave);
  rafId = window.requestAnimationFrame(frame);

  return () => {
    if (rafId) window.cancelAnimationFrame(rafId);
    window.removeEventListener("resize", resize);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener(SPEAKIT_CURSOR_BURST_EVENT, onBurst);
    document.removeEventListener("pointerleave", onPointerLeave);
  };
}

export function CustomCursorTrail({ effectId }: CustomCursorTrailProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mode = effectId && VALID_MODES.has(effectId as CursorMode) ? (effectId as CursorMode) : null;
  const isReactBitsCursor = Boolean(mode && REACT_BITS_CURSOR_MODES.has(mode));

  useEffect(() => {
    if (!mode || isReactBitsCursor) return;
    if (typeof window === "undefined") return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    if (mode === "cursor-neon-laser-ribbon") {
      return runWebGLRibbon(canvas);
    }

    return run2DCursorEffect(canvas, mode);
  }, [mode, isReactBitsCursor]);

  if (!mode) return null;

  if (isReactBitsCursor) {
    return (
      <div
        key={mode}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
        style={{ width: "100vw", height: "100vh" }}
      >
        {mode === "cursor-rb-splash-fluid" && (
          <DynamicSplashCursor
            size={0.35}
            intensity={1.6}
            force={8}
            glow={0.75}
            theme="light"
          />
        )}
        {mode === "cursor-rb-pixel-trail" && (
          <DynamicPixelTrail
            gridSize={28}
            trailSize={0.18}
            maxAge={450}
            color="#E5484D"
            trailColor="#F59E0B"
            glow={0.8}
          />
        )}
        {mode === "cursor-rb-ribbons" && (
          <DynamicRibbons colors={["#E5484D", "#F59E0B", "#0284C7"]} thickness={24} />
        )}
        {mode === "cursor-rb-crosshair" && (
          <DynamicCrosshair color="#0284C7" thickness={1.5} opacity={0.85} hideCursor={false} />
        )}
        {mode === "cursor-rb-ghost-smoke" && (
          <DynamicGhostCursor color="#9333EA" brightness={1.4} size={0.12} theme="light" />
        )}
        {mode === "cursor-rb-antigravity-swarm" && (
          <DynamicSwarmCursor color="#F59E0B" accentColor="#EC4899" lightMode hideCursor={false} />
        )}
        {mode === "cursor-rb-target-reticle" && (
          <DynamicTargetCursor
            cursorColor="#10B981"
            cursorColorOnTarget="#E5484D"
            hideDefaultCursor={false}
          />
        )}
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 block w-full h-full"
    />
  );
}

"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Lottie } from "lottie-react";
import { Mesh, Program, Renderer, Triangle } from "ogl";
import { findCosmeticById, type CosmeticItem } from "../../lib/cosmetics";
import "./cosmetics.css";

export interface FullPageProfileEffectProps {
  themeId?: string | null;
  item?: CosmeticItem | null;
  contained?: boolean;
}

const THEME_MODES: Record<string, number> = {
  "theme-neon-meteor-shower": 0,
  "theme-digital-matrix-rain": 1,
  "theme-aurora-cyber-grid": 2,
  "theme-electric-storm-surge": 3,
};

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
uniform float uMode;

varying vec2 vUv;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise2d(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amp = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    value += amp * noise2d(p);
    p = rot * p * 2.04;
    amp *= 0.5;
  }
  return value;
}

float radialEdgeMask(vec2 uv) {
  vec2 d = (uv - 0.5) * vec2(1.15, 1.05);
  return 1.0 - smoothstep(0.28, 0.78, length(d));
}

vec4 renderMeteors(vec2 uv, float aspect, float t) {
  vec2 p = vec2(uv.x * aspect, uv.y);

  vec3 starCol = vec3(0.0);
  float starAlpha = 0.0;
  for (int s = 0; s < 2; s++) {
    float scale = s == 0 ? 34.0 : 58.0;
    vec2 grid = p * scale + float(s) * 19.3;
    vec2 cell = floor(grid);
    vec2 f = fract(grid) - 0.5;
    float seed = hash21(cell + float(s) * 7.1);
    if (seed > 0.88) {
      vec2 offset = vec2(hash21(cell + 1.3), hash21(cell + 4.7)) - 0.5;
      float dist = length(f - offset * 0.55);
      float twinkle = 0.45 + 0.55 * sin(t * (1.6 + seed * 2.4) + seed * 18.0);
      float star = smoothstep(0.09, 0.0, dist) * twinkle;
      vec3 tint = mix(vec3(0.85, 0.92, 1.0), vec3(1.0, 0.88, 0.72), fract(seed * 13.0));
      starCol += tint * star * 0.45;
      starAlpha += star * 0.16;
    }
  }

  float angle = -0.64;
  mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
  vec2 rp = rot * p;

  vec3 meteorCol = vec3(0.0);
  float meteorAlpha = 0.0;

  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float lane = floor(rp.x * 4.5 + fi * 1.9);
    float localX = fract(rp.x * 4.5 + fi * 1.9) - 0.5;
    float seed = hash21(vec2(lane, fi + 3.0));
    float speed = 0.42 + seed * 0.48;
    float headY = fract(-t * speed + seed * 4.3) * 2.4 - 0.6;
    float dy = rp.y - headY;

    float trail = smoothstep(0.0, 0.52, dy) * (1.0 - smoothstep(0.0, 0.015, -dy));
    float taper = mix(0.014, 0.004, clamp(dy * 2.0, 0.0, 1.0));
    float core = exp(-abs(localX) / taper) * trail;
    float head = exp(-length(vec2(localX * 0.75, dy) * 34.0));

    vec3 streakCol = mix(vec3(0.98, 0.72, 0.24), vec3(0.90, 0.30, 0.34), clamp(dy * 2.1, 0.0, 1.0));
    meteorCol += streakCol * core * 0.52 + vec3(1.0, 0.96, 0.88) * head * 0.68;
    meteorAlpha += core * 0.22 + head * 0.28;
  }

  float mask = radialEdgeMask(uv);
  vec3 totalCol = (starCol + meteorCol) * mask;
  float totalAlpha = clamp((starAlpha + meteorAlpha) * mask, 0.0, 0.27);
  return vec4(totalCol, totalAlpha);
}

vec4 renderMatrix(vec2 uv, float aspect, float t) {
  vec2 grid = vec2(uv.x * aspect * 38.0, uv.y * 44.0);
  vec2 cell = floor(grid);
  vec2 f = fract(grid);

  float colSeed = hash21(vec2(cell.x, 1.0));
  float speed = 2.2 + colSeed * 3.4;
  float dropPos = mod(t * speed + colSeed * 35.0, 58.0);
  float dist = dropPos - (44.0 - cell.y);

  float trail = smoothstep(13.0, 0.0, dist) * step(0.0, dist);
  float head = step(0.0, dist) * step(dist, 1.0);

  float glyphTick = floor(t * 6.0 + cell.x * 3.0 + cell.y * 5.0);
  float glyphMask = step(0.38, hash21(vec2(cell.x * 13.0 + glyphTick, cell.y * 7.0)));
  float box = smoothstep(0.14, 0.28, f.x) * smoothstep(0.86, 0.72, f.x) *
              smoothstep(0.16, 0.30, f.y) * smoothstep(0.84, 0.70, f.y);

  float intensity = (trail * 0.45 + head * 0.85) * box * glyphMask;
  float mask = radialEdgeMask(uv);
  vec3 col = mix(vec3(0.06, 0.54, 0.32), vec3(0.42, 0.94, 0.64), head);
  return vec4(col * intensity * mask, clamp(intensity * mask * 0.15, 0.0, 0.16));
}

vec4 renderAurora(vec2 uv, float aspect, float t) {
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 warp = vec2(
    fbm(vec2(p.x * 1.15 + t * 0.06, p.y * 1.4 - t * 0.04)),
    fbm(vec2(p.x * 1.35 - t * 0.05, p.y * 1.2 + t * 0.05))
  );
  float silk = fbm(p * 1.55 + warp * 1.65 + vec2(t * 0.03, -t * 0.02));
  float ribbon = smoothstep(0.32, 0.78, silk);
  float verticalFade = smoothstep(0.06, 0.45, uv.y) * smoothstep(0.98, 0.42, uv.y);

  vec3 teal = vec3(0.05, 0.58, 0.53);
  vec3 emerald = vec3(0.06, 0.72, 0.50);
  vec3 amber = vec3(0.94, 0.62, 0.10);
  vec3 col = mix(teal, emerald, smoothstep(0.28, 0.72, warp.x));
  col = mix(col, amber, smoothstep(0.58, 0.92, warp.y) * 0.38);

  float mask = radialEdgeMask(uv);
  float alpha = clamp(ribbon * verticalFade * mask * 0.32, 0.0, 0.26);
  return vec4(col * alpha * 1.45, alpha);
}

vec4 renderStorm(vec2 uv, float aspect, float t) {
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec3 col = vec3(0.0);
  float alpha = 0.0;

  for (int i = 0; i < 14; i++) {
    float fi = float(i);
    float sx = hash21(vec2(fi, 2.1));
    float sy = hash21(vec2(fi, 5.7));
    vec2 center = vec2(
      (0.12 + 0.76 * sx) * aspect + sin(t * (0.35 + sx * 0.35) + fi * 1.7) * 0.08,
      0.14 + 0.72 * sy + cos(t * (0.28 + sy * 0.32) + fi * 2.3) * 0.07
    );
    float d = length(p - center);
    float pulse = 0.45 + 0.55 * sin(t * (1.2 + sx * 1.4) + fi * 3.1);
    float glow = exp(-d * 18.0) * pulse;
    float core = smoothstep(0.018, 0.0, d) * pulse;
    vec3 moteCol = mix(vec3(0.05, 0.62, 0.56), vec3(0.96, 0.65, 0.12), fract(fi * 0.37));
    col += moteCol * (glow * 0.38 + core * 0.75);
    alpha += glow * 0.16 + core * 0.22;
  }

  float mask = radialEdgeMask(uv);
  return vec4(col * mask, clamp(alpha * mask, 0.0, 0.24));
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec4 result = vec4(0.0);

  if (uMode < 0.5) {
    result = renderMeteors(vUv, aspect, uTime);
  } else if (uMode < 1.5) {
    result = renderMatrix(vUv, aspect, uTime);
  } else if (uMode < 2.5) {
    result = renderAurora(vUv, aspect, uTime);
  } else {
    result = renderStorm(vUv, aspect, uTime);
  }

  gl_FragColor = result;
}
`;

const lottieCache = new Map<string, object>();

function getAssetKind(url?: string): "video" | "lottie" | "image" | null {
  if (!url) return null;
  const clean = url.split(/[?#]/)[0].toLowerCase();
  if (clean.endsWith(".webm")) return "video";
  if (clean.endsWith(".json")) return "lottie";
  return "image";
}

function OverlayLayer({
  url,
  loop,
  blendMode,
  zClass,
  onError,
  onEnded,
}: {
  url: string;
  loop: boolean;
  blendMode: "normal" | "screen";
  zClass: string;
  onError: () => void;
  onEnded?: () => void;
}) {
  const kind = getAssetKind(url);
  const [lottieData, setLottieData] = useState<object | null>(() =>
    kind === "lottie" ? lottieCache.get(url) ?? null : null
  );

  useEffect(() => {
    if (kind !== "lottie") return;
    const cached = lottieCache.get(url);
    if (cached) {
      setLottieData(cached);
      return;
    }
    let cancelled = false;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch ${url}`);
        return res.json() as Promise<object>;
      })
      .then((json) => {
        lottieCache.set(url, json);
        if (!cancelled) setLottieData(json);
      })
      .catch(() => {
        if (!cancelled) onError();
      });
    return () => {
      cancelled = true;
    };
  }, [kind, url, onError]);

  const layerStyle: CSSProperties = {
    mixBlendMode: blendMode,
  };

  if (kind === "video") {
    return (
      <video
        src={url}
        autoPlay
        loop={loop}
        muted
        playsInline
        onError={onError}
        onEnded={onEnded}
        className={`pointer-events-none select-none absolute inset-0 w-full h-full object-cover ${zClass}`}
        style={layerStyle}
      />
    );
  }

  if (kind === "lottie") {
    if (!lottieData) return null;
    return (
      <div
        className={`pointer-events-none select-none absolute inset-0 w-full h-full ${zClass}`}
        style={layerStyle}
      >
        <Lottie
          src={lottieData}
          loop={loop}
          autoplay
          className="w-full h-full pointer-events-none"
        />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt=""
      onError={onError}
      className={`pointer-events-none select-none absolute inset-0 w-full h-full object-cover ${zClass}`}
      style={layerStyle}
    />
  );
}

interface ConstellationNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

function ConstellationCanvas({ contained }: { contained: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let rafId = 0;
    const pointer = { x: -9999, y: -9999, active: false };
    const nodes: ConstellationNode[] = [];

    const seedNodes = (w: number, h: number) => {
      nodes.length = 0;
      const count = contained ? 24 : Math.min(44, Math.max(24, Math.floor((w * h) / 38000)));
      for (let i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.28,
          vy: (Math.random() - 0.5) * 0.28,
          radius: 1.1 + Math.random() * 1.2,
        });
      }
    };

    const updateSize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect?.width || window.innerWidth));
      height = Math.max(1, Math.floor(rect?.height || window.innerHeight));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (nodes.length === 0) seedNodes(width, height);
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active =
        pointer.x >= 0 && pointer.x <= rect.width && pointer.y >= 0 && pointer.y <= rect.height;
    };

    const handlePointerLeave = () => {
      pointer.active = false;
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave);

    const maxDist = 128;
    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (!reducedMotion) {
          if (pointer.active) {
            const dx = pointer.x - n.x;
            const dy = pointer.y - n.y;
            const distSq = dx * dx + dy * dy;
            if (distSq > 4 && distSq < 19600) {
              const force = (1 - Math.sqrt(distSq) / 140) * 0.018;
              n.vx += (dx / Math.sqrt(distSq)) * force;
              n.vy += (dy / Math.sqrt(distSq)) * force;
            }
          }
          n.vx *= 0.992;
          n.vy *= 0.992;
          n.x += n.vx;
          n.y += n.vy;

          if (n.x < 0 || n.x > width) n.vx *= -1;
          if (n.y < 0 || n.y > height) n.vy *= -1;
          n.x = Math.max(0, Math.min(width, n.x));
          n.y = Math.max(0, Math.min(height, n.y));
        }

        for (let j = i + 1; j < nodes.length; j++) {
          const m = nodes[j];
          const dx = n.x - m.x;
          const dy = n.y - m.y;
          const dist = Math.hypot(dx, dy);
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.22;
            ctx.strokeStyle = `rgba(16, 185, 129, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 0.75;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(m.x, m.y);
            ctx.stroke();
          }
        }

        if (pointer.active) {
          const pd = Math.hypot(pointer.x - n.x, pointer.y - n.y);
          if (pd < 145) {
            const alpha = (1 - pd / 145) * 0.26;
            ctx.strokeStyle = `rgba(52, 211, 153, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 0.85;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(pointer.x, pointer.y);
            ctx.stroke();
          }
        }

        ctx.fillStyle = "rgba(52, 211, 153, 0.28)";
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reducedMotion) {
        rafId = window.requestAnimationFrame(draw);
      }
    };

    rafId = window.requestAnimationFrame(draw);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updateSize);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [contained]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 w-full h-full z-[1]"
      style={{
        maskImage: "radial-gradient(ellipse 82% 74% at 50% 45%, black 30%, transparent 90%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 82% 74% at 50% 45%, black 30%, transparent 90%)",
      }}
    />
  );
}

function AuroraGridOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] opacity-[0.18]"
      style={{
        backgroundImage:
          "radial-gradient(rgba(13, 148, 136, 0.55) 1px, transparent 1px), linear-gradient(to right, rgba(13, 148, 136, 0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(13, 148, 136, 0.14) 1px, transparent 1px)",
        backgroundSize: "24px 24px, 72px 72px, 72px 72px",
        maskImage: "radial-gradient(ellipse 76% 68% at 50% 42%, black 22%, transparent 84%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 76% 68% at 50% 42%, black 22%, transparent 84%)",
      }}
    />
  );
}

const STORM_BEAMS = [
  "M -80 620 Q 280 340 720 120",
  "M 180 760 Q 440 420 720 120",
  "M 520 820 Q 620 460 720 120",
  "M 960 820 Q 820 460 720 120",
  "M 1280 740 Q 980 410 720 120",
  "M 1520 580 Q 1120 330 720 120",
];

function StormBeamsOverlay() {
  return (
    <svg
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 w-full h-full z-[1] opacity-[0.24]"
      style={{
        maskImage: "radial-gradient(ellipse 80% 72% at 50% 40%, black 24%, transparent 88%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 80% 72% at 50% 40%, black 24%, transparent 88%)",
      }}
    >
      <defs>
        <linearGradient id="storm-beam-amber" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0" />
          <stop offset="45%" stopColor="#f59e0b" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#0d9488" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="storm-beam-teal" x1="100%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#0284c7" stopOpacity="0" />
          <stop offset="50%" stopColor="#0d9488" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      {STORM_BEAMS.map((d, idx) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={idx % 2 === 0 ? "url(#storm-beam-amber)" : "url(#storm-beam-teal)"}
          strokeWidth={idx % 2 === 0 ? "1.35" : "1.1"}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

export function FullPageProfileEffect({
  themeId,
  item,
  contained = false,
}: FullPageProfileEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const resolvedItem = item ?? (themeId ? findCosmeticById(themeId) : undefined);
  const activeKey = resolvedItem?.id ?? themeId ?? null;
  const resolvedThemeId = resolvedItem?.id ?? themeId ?? null;
  const mode =
    resolvedThemeId && resolvedThemeId in THEME_MODES
      ? THEME_MODES[resolvedThemeId]
      : resolvedItem
        ? 2
        : undefined;

  const [ambientFailed, setAmbientFailed] = useState(false);
  const [introFailed, setIntroFailed] = useState(false);
  const [introDone, setIntroDone] = useState(false);

  useEffect(() => {
    setAmbientFailed(false);
    setIntroFailed(false);
    setIntroDone(false);
  }, [activeKey, resolvedItem?.assetUrl, resolvedItem?.introAssetUrl]);

  useEffect(() => {
    if (mode === undefined) return;
    if (typeof window === "undefined") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let renderer: Renderer | null = null;
    let rafId = 0;

    try {
      renderer = new Renderer({
        canvas,
        alpha: true,
        premultipliedAlpha: false,
        antialias: true,
        dpr: Math.min(window.devicePixelRatio || 1, 2),
      });
    } catch {
      return;
    }

    const gl = renderer.gl;
    if (!gl) return;
    gl.clearColor(0, 0, 0, 0);

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex: VERTEX_SHADER,
      fragment: FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: [window.innerWidth, window.innerHeight] },
        uMode: { value: mode },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new Mesh(gl, { geometry, program });

    const handleResize = () => {
      if (!renderer) return;
      const rect = canvas.parentElement?.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect?.width || window.innerWidth));
      const h = Math.max(1, Math.floor(rect?.height || window.innerHeight));
      renderer.setSize(w, h);
      program.uniforms.uResolution.value = [w, h];
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    const startTime = performance.now();
    const renderFrame = (now: number) => {
      if (!renderer) return;
      program.uniforms.uTime.value = reducedMotion ? 1.2 : (now - startTime) * 0.001;
      renderer.render({ scene: mesh });
      if (!reducedMotion) {
        rafId = window.requestAnimationFrame(renderFrame);
      }
    };

    rafId = window.requestAnimationFrame(renderFrame);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleResize);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      renderer = null;
    };
  }, [mode]);

  if (mode === undefined) return null;

  const blendMode = resolvedItem?.blendMode ?? "screen";
  const glowColor = resolvedItem?.fallbackGlowColor ?? resolvedItem?.previewAccent;
  const containerClass = contained
    ? "pointer-events-none absolute inset-0 z-0 overflow-hidden"
    : "pointer-events-none fixed inset-0 z-0 overflow-hidden";

  return (
    <div aria-hidden="true" className={containerClass}>
      <canvas ref={canvasRef} className="block w-full h-full pointer-events-none relative z-0" />

      {mode === 1 && <ConstellationCanvas contained={contained} />}
      {mode === 2 && <AuroraGridOverlay />}
      {mode === 3 && <StormBeamsOverlay />}

      {resolvedItem?.assetUrl && !ambientFailed && (
        <OverlayLayer
          url={resolvedItem.assetUrl}
          loop
          blendMode={blendMode}
          zClass="z-[2] opacity-[0.26]"
          onError={() => setAmbientFailed(true)}
        />
      )}

      {ambientFailed && glowColor && (
        <div
          className="pointer-events-none absolute inset-0 z-[2]"
          style={{
            background: `radial-gradient(circle at 50% 25%, ${glowColor}24 0%, transparent 65%)`,
          }}
        />
      )}

      {resolvedItem?.introAssetUrl && !introFailed && !introDone && (
        <OverlayLayer
          url={resolvedItem.introAssetUrl}
          loop={false}
          blendMode={blendMode}
          zClass="z-[3] opacity-55"
          onError={() => setIntroFailed(true)}
          onEnded={() => setIntroDone(true)}
        />
      )}
    </div>
  );
}

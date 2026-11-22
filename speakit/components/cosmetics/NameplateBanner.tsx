"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { findCosmeticById, type CosmeticItem } from "../../lib/cosmetics";
import {
  DynamicDecryptedText,
  DynamicGlitchText,
  DynamicGradientText,
  DynamicShinyText,
  DynamicTrueFocus,
} from "./reactbits";
import "./cosmetics.css";

export interface NameplateBannerProps {
  nameplateId?: string | null;
  item?: CosmeticItem | null;
  lite?: boolean;
  className?: string;
  children: ReactNode;
}

function getMediaKind(url?: string): "video" | "image" | null {
  if (!url) return null;
  const clean = url.split(/[?#]/)[0].toLowerCase();
  if (clean.endsWith(".webm")) return "video";
  if (
    clean.endsWith(".png") ||
    clean.endsWith(".webp") ||
    clean.endsWith(".gif") ||
    clean.endsWith(".apng") ||
    clean.startsWith("data:image/")
  ) {
    return "image";
  }
  return "image";
}

function getPalette(id?: string | null, accent?: string): { from: string; to: string; spot: string; shiny: string } {
  switch (id) {
    case "nameplate-supernova-gold":
      return {
        from: "rgba(251, 191, 36, 0.88)",
        to: "rgba(245, 158, 11, 0.9)",
        spot: "rgba(251, 191, 36, 0.16)",
        shiny: "rgba(251, 191, 36, 0.28)",
      };
    case "nameplate-terminal-pulse":
      return {
        from: "rgba(74, 222, 128, 0.86)",
        to: "rgba(16, 185, 129, 0.86)",
        spot: "rgba(74, 222, 128, 0.16)",
        shiny: "rgba(74, 222, 128, 0.24)",
      };
    case "nameplate-cyber-glitch":
      return {
        from: "rgba(56, 189, 248, 0.88)",
        to: "rgba(229, 72, 77, 0.86)",
        spot: "rgba(56, 189, 248, 0.16)",
        shiny: "rgba(56, 189, 248, 0.26)",
      };
    case "nameplate-mesh-nebula":
      return {
        from: "rgba(244, 114, 182, 0.86)",
        to: "rgba(245, 158, 11, 0.86)",
        spot: "rgba(244, 114, 182, 0.16)",
        shiny: "rgba(244, 114, 182, 0.25)",
      };
    case "nameplate-rb-holo-mosaic":
      return {
        from: "rgba(236, 72, 153, 0.92)",
        to: "rgba(56, 189, 248, 0.92)",
        spot: "rgba(168, 85, 247, 0.22)",
        shiny: "rgba(236, 72, 153, 0.34)",
      };
    case "nameplate-rb-liquid-chrome":
      return {
        from: "rgba(241, 245, 249, 0.95)",
        to: "rgba(148, 163, 184, 0.92)",
        spot: "rgba(255, 255, 255, 0.24)",
        shiny: "rgba(255, 255, 255, 0.38)",
      };
    case "nameplate-rb-decrypted-matrix":
      return {
        from: "rgba(34, 197, 94, 0.92)",
        to: "rgba(16, 185, 129, 0.90)",
        spot: "rgba(34, 197, 94, 0.18)",
        shiny: "rgba(74, 222, 128, 0.28)",
      };
    case "nameplate-rb-molten-metal":
      return {
        from: "rgba(249, 115, 22, 0.94)",
        to: "rgba(239, 68, 68, 0.92)",
        spot: "rgba(251, 146, 60, 0.22)",
        shiny: "rgba(251, 191, 36, 0.30)",
      };
    case "nameplate-rb-silk-satin":
      return {
        from: "rgba(168, 85, 247, 0.90)",
        to: "rgba(217, 70, 239, 0.88)",
        spot: "rgba(192, 132, 252, 0.20)",
        shiny: "rgba(216, 180, 254, 0.30)",
      };
    case "nameplate-magic-aurora-text":
      return {
        from: "rgba(6, 182, 212, 0.92)",
        to: "rgba(16, 185, 129, 0.90)",
        spot: "rgba(56, 189, 248, 0.20)",
        shiny: "rgba(34, 211, 238, 0.32)",
      };
    case "nameplate-magic-sparkles":
      return {
        from: "rgba(251, 191, 36, 0.95)",
        to: "rgba(168, 85, 247, 0.90)",
        spot: "rgba(253, 224, 71, 0.22)",
        shiny: "rgba(253, 224, 71, 0.34)",
      };
    case "nameplate-magic-neon-card":
      return {
        from: "rgba(244, 63, 94, 0.94)",
        to: "rgba(56, 189, 248, 0.92)",
        spot: "rgba(244, 63, 94, 0.22)",
        shiny: "rgba(251, 113, 133, 0.30)",
      };
    default: {
      const c = accent || "#38BDF8";
      return {
        from: c,
        to: "rgba(255, 255, 255, 0.7)",
        spot: "rgba(255, 255, 255, 0.14)",
        shiny: "rgba(255, 255, 255, 0.24)",
      };
    }
  }
}

const SHUFFLE_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*";

function ShuffleTextInline({ name, className = "" }: { name: string; className?: string }) {
  const [display, setDisplay] = useState(name);
  const [hoverTick, setHoverTick] = useState(0);

  useEffect(() => {
    let frame = 0;
    const total = Math.max(10, name.length);
    const id = window.setInterval(() => {
      frame += 1;
      const locked = Math.floor((frame / total) * name.length);
      const next = name
        .split("")
        .map((ch, idx) => {
          if (ch === " " || idx < locked) return ch;
          return SHUFFLE_GLYPHS[(idx + frame * 3) % SHUFFLE_GLYPHS.length];
        })
        .join("");
      setDisplay(next);
      if (frame >= total) {
        setDisplay(name);
        window.clearInterval(id);
      }
    }, 45);
    return () => window.clearInterval(id);
  }, [name, hoverTick]);

  useEffect(() => {
    const loop = window.setInterval(() => {
      setHoverTick((t) => t + 1);
    }, 4200);
    return () => window.clearInterval(loop);
  }, []);

  return (
    <span
      onMouseEnter={() => setHoverTick((t) => t + 1)}
      className={`inline-block whitespace-nowrap ${className}`.trim()}
    >
      {display}
    </span>
  );
}

const SPARKLE_POSITIONS = [
  { left: "-4%", top: "-18%", delay: "0s", color: "#FBBF24" },
  { left: "26%", top: "-22%", delay: "0.4s", color: "#38BDF8" },
  { left: "58%", top: "-18%", delay: "0.8s", color: "#EC4899" },
  { left: "92%", top: "-16%", delay: "1.1s", color: "#FBBF24" },
  { left: "14%", top: "78%", delay: "0.6s", color: "#A855F7" },
  { left: "78%", top: "76%", delay: "1.3s", color: "#38BDF8" },
];

export function NameplateDisplayText({
  name,
  nameplateId,
  lite = false,
  className = "",
}: {
  name: string;
  nameplateId?: string | null;
  lite?: boolean;
  className?: string;
}) {
  if (nameplateId === "nameplate-magic-aurora-text") {
    return (
      <span
        className={`cosmetic-text-aurora inline-block whitespace-nowrap ${className}`.trim()}
        style={{
          backgroundImage:
            "linear-gradient(135deg, #38BDF8, #A855F7, #EC4899, #22D3EE, #38BDF8)",
        }}
      >
        {name}
      </span>
    );
  }
  if (nameplateId === "nameplate-magic-line-shadow") {
    return (
      <span
        data-text={name}
        className={`cosmetic-text-line-shadow text-white ${className}`.trim()}
        style={{ "--line-shadow-color": "#22D3EE" } as CSSProperties}
      >
        {name}
      </span>
    );
  }
  if (nameplateId === "nameplate-magic-sparkles") {
    return (
      <span className={`relative inline-block whitespace-nowrap ${className}`.trim()}>
        <span className="relative z-10 text-amber-100 drop-shadow-[0_0_8px_rgba(251,191,36,0.45)]">
          {name}
        </span>
        {SPARKLE_POSITIONS.map((pos, idx) => (
          <svg
            key={idx}
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="cosmetic-text-sparkle-star pointer-events-none absolute z-20 w-3 h-3"
            style={{ left: pos.left, top: pos.top, animationDelay: pos.delay }}
          >
            <path
              d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4Z"
              fill={pos.color}
            />
          </svg>
        ))}
      </span>
    );
  }
  if (nameplateId === "nameplate-rb-blur-text") {
    return (
      <span className={`cosmetic-text-blur-pulse whitespace-nowrap text-sky-100 ${className}`.trim()}>
        {name}
      </span>
    );
  }
  if (nameplateId === "nameplate-rb-echo-text") {
    return (
      <span className={`relative inline-block whitespace-nowrap ${className}`.trim()}>
        <span
          aria-hidden="true"
          className="cosmetic-text-echo-layer pointer-events-none absolute inset-0 text-cyan-400/55 select-none"
        >
          {name}
        </span>
        <span
          aria-hidden="true"
          className="cosmetic-text-echo-layer pointer-events-none absolute inset-0 text-fuchsia-400/45 select-none"
          style={{ animationDelay: "-1.3s" }}
        >
          {name}
        </span>
        <span className="relative z-10 text-white">{name}</span>
      </span>
    );
  }
  if (nameplateId === "nameplate-magic-neon-card") {
    return (
      <span
        className={`cosmetic-text-aurora inline-block whitespace-nowrap ${className}`.trim()}
        style={{
          backgroundImage: "linear-gradient(90deg, #FB7185, #F472B6, #38BDF8, #FB7185)",
        }}
      >
        {name}
      </span>
    );
  }
  if (nameplateId === "nameplate-aceternity-squiggly") {
    return (
      <span
        className={`cosmetic-text-aurora inline-block whitespace-nowrap ${className}`.trim()}
        style={{
          backgroundImage: "linear-gradient(90deg, #38BDF8, #E0F2FE, #06B6D4, #38BDF8)",
        }}
      >
        {name}
      </span>
    );
  }
  if (nameplateId === "nameplate-aceternity-canvas-ribbon") {
    return (
      <span
        className={`cosmetic-text-aurora inline-block whitespace-nowrap ${className}`.trim()}
        style={{
          backgroundImage: "linear-gradient(90deg, #C084FC, #F472B6, #FBBF24, #C084FC)",
        }}
      >
        {name}
      </span>
    );
  }
  if (!lite && nameplateId === "nameplate-rb-shuffle-text") {
    return <ShuffleTextInline name={name} className={`text-amber-200 ${className}`.trim()} />;
  }
  if (!lite && nameplateId === "nameplate-rb-glitch-text") {
    return (
      <DynamicGlitchText
        speed={0.8}
        enableShadows
        mode="rgb"
        fontSize="0.875rem"
        fontWeight={800}
        className={`!mx-0 inline-block align-baseline ${className}`.trim()}
      >
        {name}
      </DynamicGlitchText>
    );
  }
  if (!lite && nameplateId === "nameplate-rb-shiny-text") {
    return (
      <DynamicShinyText
        text={name}
        speed={2}
        color="#E2E8F0"
        shineColor="#FFFFFF"
        className={className}
      />
    );
  }
  if (!lite && nameplateId === "nameplate-rb-gradient-text") {
    return (
      <DynamicGradientText
        colors={["#EC4899", "#38BDF8", "#FBBF24"]}
        animationSpeed={3}
        className={className}
      >
        {name}
      </DynamicGradientText>
    );
  }
  if (!lite && nameplateId === "nameplate-rb-true-focus") {
    return (
      <DynamicTrueFocus
        sentence={name}
        blurAmount={1.5}
        borderColor="#10B981"
        glowColor="rgba(16,185,129,0.6)"
        animationDuration={0.35}
        pauseBetweenAnimations={0.8}
        cornerSize={7}
        borderWidth={2}
        wordClassName="text-sm font-extrabold"
        containerClassName={`gap-1.5 justify-start flex-nowrap ${className}`.trim()}
      />
    );
  }
  if (!lite && nameplateId === "nameplate-rb-decrypted-matrix") {
    return (
      <DynamicDecryptedText
        text={name}
        animateOn="view"
        loop
        loopDelay={2600}
        className={`text-emerald-300 ${className}`.trim()}
      />
    );
  }
  return <span className={className}>{name}</span>;
}

export function NameplateBanner({
  nameplateId,
  item,
  lite = false,
  className = "",
  children,
}: NameplateBannerProps) {
  const resolvedItem = item ?? (nameplateId ? findCosmeticById(nameplateId) : undefined);
  const activeId = resolvedItem?.id ?? nameplateId ?? null;
  const assetUrl = resolvedItem?.assetUrl;
  const [mediaFailed, setMediaFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMediaFailed(false);
  }, [assetUrl]);

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
  };

  if (!activeId && !resolvedItem) {
    return <div className={`relative rounded-xl ${className}`.trim()}>{children}</div>;
  }

  const mediaKind = !mediaFailed ? getMediaKind(assetUrl) : null;
  const glowColor = resolvedItem?.fallbackGlowColor ?? resolvedItem?.previewAccent ?? "#38BDF8";
  const palette = getPalette(activeId, resolvedItem?.previewAccent);

  const rootVars = {
    "--beam-from": palette.from,
    "--beam-to": palette.to,
    "--spot-color": palette.spot,
    "--shiny-color": palette.shiny,
  } as CSSProperties;

  const ambientStyle: CSSProperties = {
    background: `radial-gradient(circle at 18% 50%, ${glowColor}29 0%, transparent 62%)`,
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      style={rootVars}
      className={`cosmetic-dark-glass group relative rounded-xl overflow-hidden bg-slate-950/82 ${lite ? "" : "backdrop-blur-md"} border border-white/15 text-slate-50 shadow-[0_8px_24px_rgba(0,0,0,0.42),inset_0_1px_1px_rgba(255,255,255,0.2)] ${className}`.trim()}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={ambientStyle}
      />

      {mediaKind === "video" && assetUrl && (
        <video
          src={assetUrl}
          autoPlay
          loop
          muted
          playsInline
          aria-hidden="true"
          onError={() => setMediaFailed(true)}
          className="pointer-events-none select-none absolute inset-0 w-full h-full object-cover opacity-50 z-[1]"
          style={{
            mixBlendMode: resolvedItem?.blendMode === "screen" ? "screen" : "normal",
          }}
        />
      )}

      {mediaKind === "image" && assetUrl && (
        <img
          src={assetUrl}
          alt=""
          aria-hidden="true"
          onError={() => setMediaFailed(true)}
          className="pointer-events-none select-none absolute inset-0 w-full h-full object-cover opacity-50 z-[1]"
          style={{
            mixBlendMode: resolvedItem?.blendMode === "screen" ? "screen" : "normal",
          }}
        />
      )}

      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-slate-950/40 z-[2]"
      />

      <span
        aria-hidden="true"
        className="cosmetic-shiny-sweep absolute inset-0 rounded-[inherit] opacity-65 z-[3]"
      />

      <span aria-hidden="true" className="cosmetic-spotlight z-[4]" />

      <span aria-hidden="true" className="cosmetic-border-beam z-[5]" />

      {activeId === "nameplate-rb-holo-mosaic" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[5] opacity-35"
          style={{
            backgroundImage:
              "linear-gradient(135deg, rgba(236,72,153,0.45) 0%, rgba(56,189,248,0.45) 50%, rgba(251,191,36,0.45) 100%)",
            backgroundSize: "16px 16px",
          }}
        />
      )}

      {activeId === "nameplate-magic-sparkles" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[6] flex items-center justify-around opacity-80 text-amber-300 text-[10px]"
        >
          <span className="animate-pulse">✦</span>
          <span className="animate-bounce">✧</span>
          <span className="animate-pulse">✦</span>
        </span>
      )}

      <div className="relative z-10">{children}</div>
    </div>
  );
}

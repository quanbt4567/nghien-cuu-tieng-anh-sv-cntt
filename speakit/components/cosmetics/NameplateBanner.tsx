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
      const c = accent || "#E5484D";
      return {
        from: c,
        to: "rgba(255, 255, 255, 0.7)",
        spot: "rgba(255, 255, 255, 0.14)",
        shiny: "rgba(255, 255, 255, 0.24)",
      };
    }
  }
}

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
  if (!lite && nameplateId === "nameplate-rb-glitch-text") {
    return (
      <DynamicGlitchText speed={0.8} enableShadows mode="rgb" className={className}>
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
  const glowColor = resolvedItem?.fallbackGlowColor ?? resolvedItem?.previewAccent ?? "#E5484D";
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
      className={`cosmetic-dark-glass group relative rounded-xl overflow-hidden bg-zinc-950/85 ${lite ? "" : "backdrop-blur-md"} border border-white/15 text-zinc-50 shadow-sm ${className}`.trim()}
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
        className="pointer-events-none absolute inset-0 bg-zinc-950/35 z-[2]"
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

"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { findCosmeticById } from "../../lib/cosmetics";
import "./cosmetics.css";

export interface LeaderboardRowWrapperProps {
  fxId?: string | null;
  nameplateId?: string | null;
  className?: string;
  children: ReactNode;
}

function getFxAccentGlow(fxId?: string | null): string | undefined {
  switch (fxId) {
    case "lb-border-beam-sweep":
      return "linear-gradient(115deg, rgba(229, 72, 77, 0.14), rgba(245, 158, 11, 0.08), transparent 62%)";
    case "lb-royal-gold-shimmer":
      return "linear-gradient(115deg, rgba(245, 158, 11, 0.16), rgba(251, 191, 36, 0.08), transparent 62%)";
    case "lb-hologram-glitch":
      return "linear-gradient(115deg, rgba(56, 189, 248, 0.14), rgba(168, 85, 247, 0.09), transparent 62%)";
    case "lb-inferno-rank-aura":
      return "linear-gradient(115deg, rgba(234, 88, 12, 0.16), rgba(229, 72, 77, 0.1), transparent 62%)";
    case "lb-rb-electric-border":
      return "linear-gradient(115deg, rgba(56, 189, 248, 0.24), rgba(14, 165, 233, 0.14), transparent 65%)";
    case "lb-rb-star-comet-border":
      return "linear-gradient(115deg, rgba(251, 191, 36, 0.22), rgba(245, 158, 11, 0.12), transparent 65%)";
    case "lb-rb-laser-flow":
      return "linear-gradient(115deg, rgba(236, 72, 153, 0.25), rgba(56, 189, 248, 0.16), transparent 68%)";
    case "lb-rb-ripple-grid":
      return "linear-gradient(115deg, rgba(20, 184, 166, 0.22), rgba(6, 182, 212, 0.12), transparent 65%)";
    case "lb-rb-pixel-card":
      return "linear-gradient(115deg, rgba(168, 85, 247, 0.24), rgba(236, 72, 153, 0.12), transparent 65%)";
    case "lb-magic-border-beam-pro":
      return "linear-gradient(115deg, rgba(244, 63, 94, 0.24), rgba(168, 85, 247, 0.16), transparent 68%)";
    case "lb-magic-meteors-row":
      return "linear-gradient(115deg, rgba(99, 102, 241, 0.24), rgba(56, 189, 248, 0.14), transparent 65%)";
    case "lb-magic-retro-synth":
      return "linear-gradient(115deg, rgba(249, 115, 22, 0.24), rgba(236, 72, 153, 0.14), transparent 65%)";
    default:
      return undefined;
  }
}

function getNameplateTint(nameplateId?: string | null): string | undefined {
  switch (nameplateId) {
    case "nameplate-mesh-nebula":
      return "linear-gradient(125deg, rgba(229, 72, 77, 0.14) 0%, rgba(24, 24, 27, 0.15) 52%, rgba(245, 158, 11, 0.12) 100%)";
    case "nameplate-terminal-pulse":
    case "nameplate-rb-decrypted-matrix":
      return "linear-gradient(125deg, rgba(22, 163, 74, 0.16) 0%, rgba(9, 9, 11, 0.15) 58%, rgba(22, 163, 74, 0.12) 100%)";
    case "nameplate-supernova-gold":
    case "nameplate-magic-sparkles":
    case "nameplate-rb-molten-metal":
      return "linear-gradient(125deg, rgba(245, 158, 11, 0.18) 0%, rgba(24, 24, 27, 0.15) 50%, rgba(217, 119, 6, 0.14) 100%)";
    case "nameplate-cyber-glitch":
    case "nameplate-rb-holo-mosaic":
    case "nameplate-magic-aurora-text":
      return "linear-gradient(125deg, rgba(2, 132, 199, 0.18) 0%, rgba(9, 9, 11, 0.15) 54%, rgba(236, 72, 153, 0.16) 100%)";
    case "nameplate-rb-liquid-chrome":
      return "linear-gradient(125deg, rgba(226, 232, 240, 0.22) 0%, rgba(15, 23, 42, 0.2) 54%, rgba(148, 163, 184, 0.18) 100%)";
    case "nameplate-rb-silk-satin":
    case "nameplate-magic-neon-card":
      return "linear-gradient(125deg, rgba(168, 85, 247, 0.18) 0%, rgba(9, 9, 11, 0.15) 54%, rgba(244, 63, 94, 0.16) 100%)";
    default:
      return undefined;
  }
}

function getBeamPalette(fxId?: string | null, nameplateId?: string | null): { from: string; to: string; spot: string; shiny: string } {
  if (
    fxId === "lb-royal-gold-shimmer" ||
    fxId === "lb-rb-star-comet-border" ||
    nameplateId === "nameplate-supernova-gold" ||
    nameplateId === "nameplate-magic-sparkles"
  ) {
    return {
      from: "rgba(251, 191, 36, 0.92)",
      to: "rgba(245, 158, 11, 0.95)",
      spot: "rgba(251, 191, 36, 0.16)",
      shiny: "rgba(251, 191, 36, 0.26)",
    };
  }
  if (
    fxId === "lb-hologram-glitch" ||
    fxId === "lb-rb-electric-border" ||
    fxId === "lb-magic-meteors-row" ||
    nameplateId === "nameplate-cyber-glitch" ||
    nameplateId === "nameplate-magic-aurora-text"
  ) {
    return {
      from: "rgba(56, 189, 248, 0.92)",
      to: "rgba(168, 85, 247, 0.90)",
      spot: "rgba(56, 189, 248, 0.16)",
      shiny: "rgba(56, 189, 248, 0.26)",
    };
  }
  if (
    fxId === "lb-rb-laser-flow" ||
    fxId === "lb-magic-border-beam-pro" ||
    fxId === "lb-rb-pixel-card" ||
    nameplateId === "nameplate-rb-holo-mosaic" ||
    nameplateId === "nameplate-rb-silk-satin" ||
    nameplateId === "nameplate-magic-neon-card"
  ) {
    return {
      from: "rgba(236, 72, 153, 0.94)",
      to: "rgba(168, 85, 247, 0.92)",
      spot: "rgba(236, 72, 153, 0.18)",
      shiny: "rgba(244, 114, 182, 0.28)",
    };
  }
  if (
    fxId === "lb-inferno-rank-aura" ||
    fxId === "lb-magic-retro-synth" ||
    nameplateId === "nameplate-rb-molten-metal"
  ) {
    return {
      from: "rgba(234, 88, 12, 0.92)",
      to: "rgba(229, 72, 77, 0.92)",
      spot: "rgba(251, 146, 60, 0.16)",
      shiny: "rgba(251, 146, 60, 0.25)",
    };
  }
  if (
    fxId === "lb-rb-ripple-grid" ||
    nameplateId === "nameplate-terminal-pulse" ||
    nameplateId === "nameplate-rb-decrypted-matrix"
  ) {
    return {
      from: "rgba(74, 222, 128, 0.90)",
      to: "rgba(20, 184, 166, 0.90)",
      spot: "rgba(74, 222, 128, 0.16)",
      shiny: "rgba(74, 222, 128, 0.25)",
    };
  }
  return {
    from: "rgba(229, 72, 77, 0.85)",
    to: "rgba(245, 158, 11, 0.85)",
    spot: "rgba(255, 255, 255, 0.12)",
    shiny: "rgba(255, 255, 255, 0.22)",
  };
}

export function LeaderboardRowWrapper({
  fxId,
  nameplateId,
  className = "",
  children,
}: LeaderboardRowWrapperProps) {
  const hasCosmetic = Boolean(fxId || nameplateId);
  const fxItem = fxId ? findCosmeticById(fxId) : undefined;
  const nameplateItem = nameplateId ? findCosmeticById(nameplateId) : undefined;
  const bannerAssetUrl = fxItem?.assetUrl ?? nameplateItem?.assetUrl;
  const [bannerFailed, setBannerFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setBannerFailed(false);
  }, [bannerAssetUrl]);

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
  };

  if (!hasCosmetic) {
    return <div className={`relative rounded-xl ${className}`.trim()}>{children}</div>;
  }

  const fxGlow = getFxAccentGlow(fxId);
  const nameplateTint = getNameplateTint(nameplateId);
  const palette = getBeamPalette(fxId, nameplateId);

  const rootVars = {
    "--beam-from": palette.from,
    "--beam-to": palette.to,
    "--spot-color": palette.spot,
    "--shiny-color": palette.shiny,
  } as CSSProperties;

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      style={rootVars}
      className={`cosmetic-dark-glass group relative rounded-xl overflow-hidden !bg-zinc-950/75 backdrop-blur-md border border-white/15 text-zinc-50 shadow-sm ${className}`.trim()}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] bg-zinc-950/75 backdrop-blur-md z-0"
      />

      {bannerAssetUrl && !bannerFailed && (
        <img
          src={bannerAssetUrl}
          alt=""
          aria-hidden="true"
          onError={() => setBannerFailed(true)}
          className="pointer-events-none select-none absolute inset-0 w-full h-full object-cover opacity-20 z-[1]"
        />
      )}

      {nameplateTint && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] z-[2]"
          style={{ background: nameplateTint }}
        />
      )}

      {fxGlow && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] z-[3]"
          style={{ background: fxGlow }}
        />
      )}

      {nameplateId && (
        <span
          aria-hidden="true"
          className="cosmetic-shiny-sweep absolute inset-0 rounded-[inherit] opacity-60 z-[4]"
        />
      )}

      <span aria-hidden="true" className="cosmetic-spotlight z-[5]" />

      <span aria-hidden="true" className="cosmetic-border-beam z-[6]" />

      {(nameplateId === "nameplate-terminal-pulse" ||
        nameplateId === "nameplate-rb-decrypted-matrix") && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1.5 right-2.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/85 text-[10px] font-mono font-bold text-emerald-300 border border-emerald-500/30 z-[7]"
        >
          <span>&gt;_</span>
          <span className="cosmetic-nameplate-terminal-cursor inline-block w-1.5 h-2.5 bg-emerald-400" />
        </span>
      )}

      {(fxId === "lb-rb-ripple-grid" || fxId === "lb-magic-retro-synth") && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[3] opacity-25"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.22) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        />
      )}

      <div className="relative z-10">{children}</div>
    </div>
  );
}

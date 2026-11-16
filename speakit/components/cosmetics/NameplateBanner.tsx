"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { findCosmeticById, type CosmeticItem } from "../../lib/cosmetics";
import "./cosmetics.css";

export interface NameplateBannerProps {
  nameplateId?: string | null;
  item?: CosmeticItem | null;
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

export function NameplateBanner({
  nameplateId,
  item,
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
      className={`cosmetic-dark-glass group relative rounded-xl overflow-hidden bg-zinc-950/75 backdrop-blur-md border border-white/15 text-zinc-50 shadow-sm ${className}`.trim()}
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

      <div className="relative z-10">{children}</div>
    </div>
  );
}

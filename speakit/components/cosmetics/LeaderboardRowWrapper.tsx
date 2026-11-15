"use client";

import type { ReactNode } from "react";
import "./cosmetics.css";

export interface LeaderboardRowWrapperProps {
  fxId?: string | null;
  nameplateId?: string | null;
  className?: string;
  children: ReactNode;
}

function getFxContainerClass(fxId?: string | null): string {
  switch (fxId) {
    case "lb-border-beam-sweep":
      return "cosmetic-lb-border-beam border-[#1A1714]";
    case "lb-royal-gold-shimmer":
      return "cosmetic-lb-gold-shimmer border-[#1A1714] shadow-[2px_2px_0px_#D97706]";
    case "lb-hologram-glitch":
      return "cosmetic-lb-hologram-glitch border-[#1A1714] shadow-[2px_2px_0px_#0284C7]";
    case "lb-inferno-rank-aura":
      return "cosmetic-lb-inferno-aura border-[#1A1714] shadow-[2px_2px_0px_#EA580C]";
    default:
      return "";
  }
}

function getNameplateClass(nameplateId?: string | null): string {
  switch (nameplateId) {
    case "nameplate-mesh-nebula":
      return "cosmetic-nameplate-mesh-nebula border-[#1A1714]";
    case "nameplate-terminal-pulse":
      return "cosmetic-nameplate-terminal-pulse border-[#1A1714]";
    case "nameplate-supernova-gold":
      return "cosmetic-nameplate-supernova-gold border-[#1A1714]";
    case "nameplate-cyber-glitch":
      return "cosmetic-nameplate-cyber-glitch border-[#1A1714]";
    default:
      return "";
  }
}

function getNameplateSurfaceStyle(nameplateId?: string | null): string | undefined {
  switch (nameplateId) {
    case "nameplate-mesh-nebula":
      return "linear-gradient(125deg, rgba(229, 72, 77, 0.16) 0%, rgba(250, 246, 239, 0.96) 52%, rgba(245, 158, 11, 0.15) 100%)";
    case "nameplate-terminal-pulse":
      return "linear-gradient(125deg, rgba(22, 163, 74, 0.14) 0%, rgba(250, 246, 239, 0.96) 58%, rgba(22, 163, 74, 0.12) 100%)";
    case "nameplate-supernova-gold":
      return "linear-gradient(125deg, rgba(245, 158, 11, 0.22) 0%, rgba(254, 243, 199, 0.94) 50%, rgba(217, 119, 6, 0.18) 100%)";
    case "nameplate-cyber-glitch":
      return "linear-gradient(125deg, rgba(2, 132, 199, 0.16) 0%, rgba(250, 246, 239, 0.96) 54%, rgba(229, 72, 77, 0.12) 100%)";
    default:
      return undefined;
  }
}

export function LeaderboardRowWrapper({
  fxId,
  nameplateId,
  className = "",
  children,
}: LeaderboardRowWrapperProps) {
  const fxClass = getFxContainerClass(fxId);
  const nameplateClass = getNameplateClass(nameplateId);
  const nameplateBackground = getNameplateSurfaceStyle(nameplateId);

  return (
    <div className={`relative rounded-xl ${fxClass} ${nameplateClass} ${className}`.trim()}>
      {nameplateBackground && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[11px] z-[1]"
          style={{ background: nameplateBackground }}
        />
      )}

      {fxId === "lb-border-beam-sweep" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-[1px] rounded-xl overflow-hidden z-0"
        >
          <span
            className="cosmetic-lb-border-beam-rotator absolute -inset-[120%]"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0deg, #E5484D 32deg, #F59E0B 56deg, transparent 84deg, transparent 360deg)",
            }}
          />
          <span
            className="absolute inset-[2px] rounded-[10px]"
            style={{
              background: nameplateBackground ?? "rgba(255, 255, 255, 0.96)",
            }}
          />
        </span>
      )}

      {fxId === "lb-royal-gold-shimmer" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[11px] z-[2]"
        >
          <span className="cosmetic-lb-gold-shimmer-sweep absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-amber-300/45 to-transparent" />
          <span className="absolute top-1.5 right-2 h-2 w-2 rotate-45 bg-amber-400 border border-[#1A1714]" />
          <span className="absolute bottom-1.5 left-2 h-1.5 w-1.5 rotate-45 bg-amber-500 border border-[#1A1714]" />
        </span>
      )}

      {fxId === "lb-hologram-glitch" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[11px] z-[2]"
        >
          <span
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(26, 23, 20, 0.04) 3px, rgba(26, 23, 20, 0.04) 4px)",
            }}
          />
          <span className="cosmetic-lb-hologram-scan absolute inset-x-0 h-5 bg-gradient-to-b from-transparent via-sky-500/25 to-transparent border-y border-sky-600/20" />
          <span className="absolute top-0 left-3 h-0.5 w-8 bg-sky-600" />
          <span className="absolute bottom-0 right-3 h-0.5 w-8 bg-[#E5484D]" />
        </span>
      )}

      {fxId === "lb-inferno-rank-aura" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[11px] z-[2]"
        >
          <span
            className="absolute inset-x-0 bottom-0 h-1/2"
            style={{
              background:
                "linear-gradient(to top, rgba(234, 88, 12, 0.14), rgba(245, 158, 11, 0.05), transparent)",
            }}
          />
          <span className="absolute inset-0 rounded-[11px] ring-1 ring-inset ring-orange-600/35" />
          <span className="absolute top-1.5 left-1.5 h-1.5 w-1.5 rounded-full bg-[#E5484D]" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
        </span>
      )}

      {nameplateId === "nameplate-mesh-nebula" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-1.5 bg-[#E5484D] rounded-r-[10px] z-[2]"
        />
      )}

      {nameplateId === "nameplate-terminal-pulse" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1.5 right-2.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/90 text-[10px] font-mono font-bold text-emerald-300 border border-[#1A1714] z-[3]"
        >
          <span>&gt;_</span>
          <span className="cosmetic-nameplate-terminal-cursor inline-block w-1.5 h-2.5 bg-emerald-400" />
        </span>
      )}

      {nameplateId === "nameplate-supernova-gold" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[11px] z-[2]"
        >
          <span className="absolute top-0 left-0 h-2.5 w-2.5 border-t-2 border-l-2 border-[#1A1714] rounded-tl-[10px]" />
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 border-b-2 border-r-2 border-[#1A1714] rounded-br-[10px]" />
        </span>
      )}

      {nameplateId === "nameplate-cyber-glitch" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[11px] z-[2]"
        >
          <span className="absolute top-1 left-1 h-2 w-2 border-t-2 border-l-2 border-sky-600" />
          <span className="absolute bottom-1 right-1 h-2 w-2 border-b-2 border-r-2 border-[#E5484D]" />
        </span>
      )}

      <div className="relative z-10">{children}</div>
    </div>
  );
}

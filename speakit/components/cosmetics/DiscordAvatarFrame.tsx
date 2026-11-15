"use client";

import type { ReactNode } from "react";
import "./cosmetics.css";

export interface DiscordAvatarFrameProps {
  equippedId?: string | null;
  fallbackRing?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
  micActive?: boolean;
  children: ReactNode;
}

const SIZE_MAP: Record<"xs" | "sm" | "md" | "lg" | "xl", number> = {
  xs: 32,
  sm: 40,
  md: 48,
  lg: 64,
  xl: 88,
};

function resolveAvatarEffect(
  equippedId?: string | null,
  fallbackRing?: string | null
): string | null {
  const raw = equippedId || fallbackRing || "";
  switch (raw) {
    case "avatar-cyberpunk-overclock-ring":
    case "ring-crimson":
      return "avatar-cyberpunk-overclock-ring";
    case "avatar-matrix-code-halo":
    case "ring-emerald":
      return "avatar-matrix-code-halo";
    case "avatar-inferno-hotfix-horns":
    case "ring-amber":
      return "avatar-inferno-hotfix-horns";
    case "avatar-quantum-holo-visor":
      return "avatar-quantum-holo-visor";
    default:
      return null;
  }
}

function getSpinClass(effectId: string | null): string {
  switch (effectId) {
    case "avatar-cyberpunk-overclock-ring":
      return "cosmetic-avatar-overclock";
    case "avatar-matrix-code-halo":
      return "cosmetic-avatar-matrix-halo";
    case "avatar-inferno-hotfix-horns":
      return "cosmetic-avatar-inferno-horns";
    case "avatar-quantum-holo-visor":
      return "cosmetic-avatar-quantum-visor";
    default:
      return "";
  }
}

function getMicColor(effectId: string | null): string {
  switch (effectId) {
    case "avatar-matrix-code-halo":
      return "border-emerald-500";
    case "avatar-inferno-hotfix-horns":
      return "border-orange-500";
    case "avatar-quantum-holo-visor":
      return "border-sky-500";
    default:
      return "border-accent";
  }
}

export function DiscordAvatarFrame({
  equippedId,
  fallbackRing,
  size = "md",
  micActive = false,
  children,
}: DiscordAvatarFrameProps) {
  const px = typeof size === "number" ? Math.max(24, size) : SIZE_MAP[size];
  const effectId = resolveAvatarEffect(equippedId, fallbackRing);
  const spinClass = getSpinClass(effectId);
  const micColor = getMicColor(effectId);
  const pad = effectId ? (px >= 64 ? 4 : 3) : 0;

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0 select-none"
      style={{ width: px, height: px }}
    >
      {micActive && (
        <span
          aria-hidden="true"
          className={`absolute inset-0 rounded-full border-2 ${micColor} cosmetic-avatar-mic-ring pointer-events-none`}
        />
      )}

      {effectId ? (
        <div
          className="relative w-full h-full rounded-full flex items-center justify-center"
          style={{ padding: pad }}
        >
          <span
            aria-hidden="true"
            className={`absolute inset-0 rounded-full ${spinClass} pointer-events-none`}
          />
          <div className="relative w-full h-full rounded-full bg-paper overflow-hidden flex items-center justify-center z-10">
            {children}
            {effectId === "avatar-quantum-holo-visor" && (
              <span
                aria-hidden="true"
                className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-sky-300/45 to-transparent cosmetic-avatar-visor-beam pointer-events-none"
              />
            )}
          </div>
        </div>
      ) : (
        <div className="relative w-full h-full rounded-full overflow-hidden flex items-center justify-center">
          {children}
        </div>
      )}

      {effectId === "avatar-inferno-hotfix-horns" && (
        <svg
          aria-hidden="true"
          viewBox="0 0 100 40"
          className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-[112%] h-auto pointer-events-none z-20 drop-shadow-sm"
        >
          <path
            d="M18 36 C10 22, 12 10, 26 4 C22 14, 24 22, 34 30 Z"
            fill="#EA580C"
          />
          <path
            d="M82 36 C90 22, 88 10, 74 4 C78 14, 76 22, 66 30 Z"
            fill="#EA580C"
          />
          <path
            d="M21 31 C16 21, 18 13, 25 8 C23 16, 25 22, 31 28 Z"
            fill="#FACC15"
          />
          <path
            d="M79 31 C84 21, 82 13, 75 8 C77 16, 75 22, 69 28 Z"
            fill="#FACC15"
          />
        </svg>
      )}

      {effectId === "avatar-matrix-code-halo" && (
        <svg
          aria-hidden="true"
          viewBox="0 0 100 28"
          className="absolute -top-2 left-1/2 -translate-x-1/2 w-[92%] h-auto pointer-events-none z-20"
        >
          <ellipse
            cx="50"
            cy="14"
            rx="42"
            ry="7"
            fill="none"
            stroke="#16A34A"
            strokeWidth="3"
            strokeDasharray="8 4"
          />
        </svg>
      )}

      {effectId === "avatar-quantum-holo-visor" && (
        <svg
          aria-hidden="true"
          viewBox="0 0 100 32"
          className="absolute top-[22%] left-1/2 -translate-x-1/2 w-[108%] h-auto pointer-events-none z-20"
        >
          <rect
            x="10"
            y="8"
            width="80"
            height="14"
            rx="7"
            fill="rgba(2, 132, 199, 0.22)"
            stroke="#38BDF8"
            strokeWidth="2.5"
          />
          <line x1="22" y1="15" x2="38" y2="15" stroke="#BAE6FD" strokeWidth="2" />
        </svg>
      )}
    </div>
  );
}

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

type AvatarEffectId =
  | "avatar-cyberpunk-overclock-ring"
  | "avatar-matrix-code-halo"
  | "avatar-inferno-hotfix-horns"
  | "avatar-quantum-holo-visor";

const SIZE_MAP: Record<"xs" | "sm" | "md" | "lg" | "xl", number> = {
  xs: 32,
  sm: 40,
  md: 48,
  lg: 64,
  xl: 88,
};

const BINARY_ORBIT_NODES = [
  { x: 50, y: 7, bit: "1", color: "#16A34A" },
  { x: 80, y: 20, bit: "0", color: "#1A1714" },
  { x: 93, y: 50, bit: "1", color: "#16A34A" },
  { x: 80, y: 80, bit: "0", color: "#15803D" },
  { x: 50, y: 93, bit: "1", color: "#16A34A" },
  { x: 20, y: 80, bit: "0", color: "#1A1714" },
  { x: 7, y: 50, bit: "1", color: "#16A34A" },
  { x: 20, y: 20, bit: "0", color: "#15803D" },
];

const EMBER_SPARKS = [
  { left: "10%", top: "24%", color: "#F59E0B", delay: "0s", size: 5 },
  { left: "86%", top: "20%", color: "#E5484D", delay: "0.45s", size: 4 },
  { left: "6%", top: "68%", color: "#E5484D", delay: "0.9s", size: 4 },
  { left: "90%", top: "64%", color: "#F59E0B", delay: "1.35s", size: 5 },
];

function resolveAvatarEffect(
  equippedId?: string | null,
  fallbackRing?: string | null
): AvatarEffectId | null {
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

function getSpinClass(effectId: AvatarEffectId | null): string {
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

function getMicColor(effectId: AvatarEffectId | null): string {
  switch (effectId) {
    case "avatar-matrix-code-halo":
      return "border-[#16A34A]";
    case "avatar-inferno-hotfix-horns":
      return "border-[#F59E0B]";
    case "avatar-quantum-holo-visor":
      return "border-[#0284C7]";
    default:
      return "border-[#E5484D]";
  }
}

function OverclockFrameOverlay() {
  return (
    <>
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        className="absolute -inset-[10%] w-[120%] h-[120%] pointer-events-none z-20 cosmetic-svg-spin-slow"
      >
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="none"
          stroke="#E5484D"
          strokeWidth="2.4"
          strokeDasharray="16 8 6 8"
          strokeLinecap="butt"
        />
        <line x1="50" y1="1" x2="50" y2="8" stroke="#F59E0B" strokeWidth="2.8" />
        <line x1="50" y1="92" x2="50" y2="99" stroke="#F59E0B" strokeWidth="2.8" />
        <line x1="1" y1="50" x2="8" y2="50" stroke="#E5484D" strokeWidth="2.8" />
        <line x1="92" y1="50" x2="99" y2="50" stroke="#E5484D" strokeWidth="2.8" />
      </svg>
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        className="absolute -inset-[5%] w-[110%] h-[110%] pointer-events-none z-20 cosmetic-svg-spin-reverse"
      >
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="#1A1714"
          strokeWidth="2"
          strokeDasharray="10 14"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="#F59E0B"
          strokeWidth="2"
          strokeDasharray="4 20"
          strokeDashoffset="6"
        />
      </svg>
    </>
  );
}

function MatrixHaloOverlay() {
  return (
    <>
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        className="absolute -inset-[12%] w-[124%] h-[124%] pointer-events-none z-20 cosmetic-svg-spin-slow"
      >
        <circle
          cx="50"
          cy="50"
          r="43"
          fill="none"
          stroke="#16A34A"
          strokeOpacity="0.45"
          strokeWidth="1.2"
          strokeDasharray="4 4"
        />
        {BINARY_ORBIT_NODES.map((node, index) => (
          <text
            key={index}
            x={node.x}
            y={node.y}
            textAnchor="middle"
            dominantBaseline="central"
            fill={node.color}
            fontSize="8.5"
            fontWeight="800"
            fontFamily="monospace"
          >
            {node.bit}
          </text>
        ))}
      </svg>
      <svg
        aria-hidden="true"
        viewBox="0 0 100 28"
        className="absolute -top-[18%] left-1/2 w-[96%] h-auto pointer-events-none z-30 cosmetic-halo-float"
      >
        <ellipse
          cx="50"
          cy="14"
          rx="41"
          ry="7.5"
          fill="none"
          stroke="#1A1714"
          strokeWidth="4.4"
        />
        <ellipse
          cx="50"
          cy="14"
          rx="41"
          ry="7.5"
          fill="none"
          stroke="#16A34A"
          strokeWidth="2.6"
          strokeDasharray="10 4"
        />
        <ellipse
          cx="50"
          cy="14"
          rx="34"
          ry="4.5"
          fill="none"
          stroke="#4ADE80"
          strokeWidth="1.4"
          strokeDasharray="5 6"
        />
      </svg>
    </>
  );
}

function InfernoHornsOverlay() {
  return (
    <>
      <svg
        aria-hidden="true"
        viewBox="0 0 100 44"
        className="absolute -top-[26%] left-1/2 w-[118%] h-auto pointer-events-none z-30 cosmetic-horn-flicker"
      >
        <polygon
          points="14,38 8,19 22,4 24,18 35,31"
          fill="#E5484D"
          stroke="#1A1714"
          strokeWidth="2.4"
          strokeLinejoin="miter"
        />
        <polygon
          points="86,38 92,19 78,4 76,18 65,31"
          fill="#E5484D"
          stroke="#1A1714"
          strokeWidth="2.4"
          strokeLinejoin="miter"
        />
        <polygon points="18,33 14,21 22,11 23,21 30,29" fill="#F59E0B" />
        <polygon points="82,33 86,21 78,11 77,21 70,29" fill="#F59E0B" />
      </svg>
      {EMBER_SPARKS.map((spark, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="absolute pointer-events-none z-30 cosmetic-ember-rise border border-[#1A1714]"
          style={{
            left: spark.left,
            top: spark.top,
            width: spark.size,
            height: spark.size,
            backgroundColor: spark.color,
            animationDelay: spark.delay,
          }}
        />
      ))}
    </>
  );
}

function QuantumVisorOverlay() {
  return (
    <>
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        className="absolute -inset-[9%] w-[118%] h-[118%] pointer-events-none z-20 cosmetic-reticle-pulse"
      >
        <path
          d="M8 24 L8 8 L24 8"
          fill="none"
          stroke="#1A1714"
          strokeWidth="3.5"
          strokeLinecap="square"
        />
        <path
          d="M8 24 L8 8 L24 8"
          fill="none"
          stroke="#0284C7"
          strokeWidth="2"
          strokeLinecap="square"
        />
        <path
          d="M76 8 L92 8 L92 24"
          fill="none"
          stroke="#1A1714"
          strokeWidth="3.5"
          strokeLinecap="square"
        />
        <path
          d="M76 8 L92 8 L92 24"
          fill="none"
          stroke="#0284C7"
          strokeWidth="2"
          strokeLinecap="square"
        />
        <path
          d="M8 76 L8 92 L24 92"
          fill="none"
          stroke="#1A1714"
          strokeWidth="3.5"
          strokeLinecap="square"
        />
        <path
          d="M8 76 L8 92 L24 92"
          fill="none"
          stroke="#0284C7"
          strokeWidth="2"
          strokeLinecap="square"
        />
        <path
          d="M76 92 L92 92 L92 76"
          fill="none"
          stroke="#1A1714"
          strokeWidth="3.5"
          strokeLinecap="square"
        />
        <path
          d="M76 92 L92 92 L92 76"
          fill="none"
          stroke="#0284C7"
          strokeWidth="2"
          strokeLinecap="square"
        />
      </svg>
      <svg
        aria-hidden="true"
        viewBox="0 0 100 30"
        className="absolute top-[18%] left-1/2 -translate-x-1/2 w-[108%] h-auto pointer-events-none z-30"
      >
        <rect
          x="10"
          y="7"
          width="80"
          height="14"
          rx="3"
          fill="rgba(2, 132, 199, 0.2)"
          stroke="#1A1714"
          strokeWidth="3"
        />
        <rect
          x="10"
          y="7"
          width="80"
          height="14"
          rx="3"
          fill="none"
          stroke="#38BDF8"
          strokeWidth="1.8"
        />
        <line x1="18" y1="14" x2="34" y2="14" stroke="#E0F2FE" strokeWidth="2" />
        <line x1="68" y1="14" x2="82" y2="14" stroke="#38BDF8" strokeWidth="1.6" />
      </svg>
    </>
  );
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
        <>
          <span
            aria-hidden="true"
            className={`absolute -inset-0.5 rounded-full border-2 ${micColor} cosmetic-avatar-mic-ring pointer-events-none`}
          />
          <span
            aria-hidden="true"
            className={`absolute -inset-0.5 rounded-full border-2 ${micColor} cosmetic-avatar-mic-ring pointer-events-none`}
            style={{ animationDelay: "0.45s" }}
          />
        </>
      )}

      {effectId ? (
        <div
          className="relative w-full h-full rounded-full flex items-center justify-center border border-[#1A1714]"
          style={{ padding: pad }}
        >
          <span
            aria-hidden="true"
            className={`absolute inset-0 rounded-full ${spinClass} pointer-events-none`}
          />
          <div className="relative w-full h-full rounded-full bg-paper border border-[#1A1714] overflow-hidden flex items-center justify-center z-10">
            {children}
            {effectId === "avatar-quantum-holo-visor" && (
              <>
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 h-[3px] bg-[#38BDF8]/80 shadow-[0_0_8px_#0284C7] cosmetic-holo-scan-y pointer-events-none z-20"
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-sky-300/45 to-transparent cosmetic-avatar-visor-beam pointer-events-none z-20"
                />
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="relative w-full h-full rounded-full overflow-hidden flex items-center justify-center">
          {children}
        </div>
      )}

      {effectId === "avatar-cyberpunk-overclock-ring" && <OverclockFrameOverlay />}
      {effectId === "avatar-matrix-code-halo" && <MatrixHaloOverlay />}
      {effectId === "avatar-inferno-hotfix-horns" && <InfernoHornsOverlay />}
      {effectId === "avatar-quantum-holo-visor" && <QuantumVisorOverlay />}
    </div>
  );
}

"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Lottie } from "lottie-react";
import { findCosmeticById, type CosmeticItem } from "../../lib/cosmetics";
import {
  DynamicElectricBorder,
  DynamicStarBorder,
} from "./reactbits";
import "./cosmetics.css";

export interface DiscordAvatarFrameProps {
  equippedId?: string | null;
  fallbackRing?: string | null;
  item?: CosmeticItem | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
  micActive?: boolean;
  children: ReactNode;
}

type AvatarEffectId =
  | "avatar-cyberpunk-overclock-ring"
  | "avatar-matrix-code-halo"
  | "avatar-inferno-hotfix-horns"
  | "avatar-quantum-holo-visor"
  | "avatar-rb-electric-border"
  | "avatar-rb-star-border"
  | "avatar-rb-magic-rings"
  | "avatar-rb-plasma-strands"
  | "avatar-rb-crystal-ball"
  | "avatar-rb-orb-halo"
  | "avatar-rb-metaballs-ring"
  | "avatar-magic-orbiting-circles"
  | "avatar-magic-shine-border"
  | "avatar-magic-neon-gradient"
  | "avatar-magic-avatar-circles"
  | "avatar-aceternity-moving-border"
  | "avatar-tsparticles-sea-anemone"
  | "avatar-tsparticles-black-hole";

interface AvatarLottieConfig {
  src: string;
  filter: string;
  micColor: string;
}

const SIZE_MAP: Record<"xs" | "sm" | "md" | "lg" | "xl", number> = {
  xs: 32,
  sm: 40,
  md: 48,
  lg: 64,
  xl: 88,
};

const AVATAR_LOTTIE_MAP: Record<AvatarEffectId, AvatarLottieConfig> = {
  "avatar-cyberpunk-overclock-ring": {
    src: "/lottie/cyber-ring.json",
    filter: "drop-shadow(0 0 10px rgba(229, 72, 77, 0.55)) drop-shadow(0 0 18px rgba(56, 189, 248, 0.35))",
    micColor: "border-[#E5484D]",
  },
  "avatar-matrix-code-halo": {
    src: "/lottie/matrix-pulse.json",
    filter: "drop-shadow(0 0 10px rgba(22, 163, 74, 0.6)) drop-shadow(0 0 18px rgba(74, 222, 128, 0.35))",
    micColor: "border-[#16A34A]",
  },
  "avatar-inferno-hotfix-horns": {
    src: "/lottie/inferno-aura.json",
    filter: "drop-shadow(0 0 10px rgba(245, 158, 11, 0.6)) drop-shadow(0 0 18px rgba(229, 72, 77, 0.4))",
    micColor: "border-[#F59E0B]",
  },
  "avatar-quantum-holo-visor": {
    src: "/lottie/cyber-ring.json",
    filter:
      "hue-rotate(115deg) saturate(1.25) drop-shadow(0 0 10px rgba(56, 189, 248, 0.65)) drop-shadow(0 0 20px rgba(168, 85, 247, 0.5))",
    micColor: "border-[#0284C7]",
  },
  "avatar-rb-electric-border": {
    src: "/lottie/cyber-ring.json",
    filter: "hue-rotate(150deg) saturate(1.6) drop-shadow(0 0 12px rgba(56, 189, 248, 0.85))",
    micColor: "border-[#38BDF8]",
  },
  "avatar-rb-star-border": {
    src: "/lottie/inferno-aura.json",
    filter: "hue-rotate(25deg) saturate(1.5) drop-shadow(0 0 12px rgba(251, 191, 36, 0.8))",
    micColor: "border-[#FBBF24]",
  },
  "avatar-rb-magic-rings": {
    src: "/lottie/cyber-ring.json",
    filter: "hue-rotate(260deg) saturate(1.7) drop-shadow(0 0 14px rgba(236, 72, 153, 0.8))",
    micColor: "border-[#EC4899]",
  },
  "avatar-rb-plasma-strands": {
    src: "/lottie/matrix-pulse.json",
    filter: "hue-rotate(165deg) saturate(1.8) drop-shadow(0 0 14px rgba(168, 85, 247, 0.85))",
    micColor: "border-[#A855F7]",
  },
  "avatar-rb-crystal-ball": {
    src: "/lottie/cyber-ring.json",
    filter: "hue-rotate(135deg) saturate(1.5) drop-shadow(0 0 12px rgba(6, 182, 212, 0.8))",
    micColor: "border-[#06B6D4]",
  },
  "avatar-magic-orbiting-circles": {
    src: "/lottie/matrix-pulse.json",
    filter: "drop-shadow(0 0 12px rgba(16, 185, 129, 0.75))",
    micColor: "border-[#10B981]",
  },
  "avatar-magic-shine-border": {
    src: "/lottie/inferno-aura.json",
    filter: "saturate(1.4) drop-shadow(0 0 12px rgba(245, 158, 11, 0.75))",
    micColor: "border-[#F59E0B]",
  },
  "avatar-magic-neon-gradient": {
    src: "/lottie/cyber-ring.json",
    filter: "hue-rotate(310deg) saturate(1.8) drop-shadow(0 0 14px rgba(244, 63, 94, 0.85))",
    micColor: "border-[#F43F5E]",
  },
  "avatar-rb-orb-halo": {
    src: "/lottie/cyber-ring.json",
    filter: "hue-rotate(190deg) saturate(1.7) drop-shadow(0 0 14px rgba(139, 92, 246, 0.85))",
    micColor: "border-[#8B5CF6]",
  },
  "avatar-rb-metaballs-ring": {
    src: "/lottie/matrix-pulse.json",
    filter: "hue-rotate(45deg) saturate(1.5) drop-shadow(0 0 12px rgba(20, 184, 166, 0.8))",
    micColor: "border-[#14B8A6]",
  },
  "avatar-magic-avatar-circles": {
    src: "/lottie/cyber-ring.json",
    filter: "hue-rotate(135deg) saturate(1.4) drop-shadow(0 0 10px rgba(59, 130, 246, 0.75))",
    micColor: "border-[#3B82F6]",
  },
  "avatar-aceternity-moving-border": {
    src: "/lottie/cyber-ring.json",
    filter: "hue-rotate(145deg) saturate(1.6) drop-shadow(0 0 12px rgba(14, 165, 233, 0.85))",
    micColor: "border-[#0EA5E9]",
  },
  "avatar-tsparticles-sea-anemone": {
    src: "/lottie/inferno-aura.json",
    filter: "hue-rotate(285deg) saturate(1.8) drop-shadow(0 0 14px rgba(236, 72, 153, 0.85))",
    micColor: "border-[#EC4899]",
  },
  "avatar-tsparticles-black-hole": {
    src: "/lottie/cyber-ring.json",
    filter: "hue-rotate(210deg) saturate(1.8) drop-shadow(0 0 16px rgba(99, 102, 241, 0.9))",
    micColor: "border-[#6366F1]",
  },
};

const lottieDataCache = new Map<string, object>();
const lottiePromiseCache = new Map<string, Promise<object | null>>();

function loadLottieJson(url: string): Promise<object | null> {
  const cached = lottieDataCache.get(url);
  if (cached) return Promise.resolve(cached);

  const pending = lottiePromiseCache.get(url);
  if (pending) return pending;

  const request = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to fetch ${url}`);
      return res.json() as Promise<object>;
    })
    .then((json) => {
      lottieDataCache.set(url, json);
      return json;
    })
    .catch(() => null)
    .finally(() => {
      lottiePromiseCache.delete(url);
    });

  lottiePromiseCache.set(url, request);
  return request;
}

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
    case "avatar-rb-electric-border":
    case "avatar-rb-star-border":
    case "avatar-rb-magic-rings":
    case "avatar-rb-plasma-strands":
    case "avatar-rb-crystal-ball":
    case "avatar-rb-orb-halo":
    case "avatar-rb-metaballs-ring":
    case "avatar-magic-orbiting-circles":
    case "avatar-magic-shine-border":
    case "avatar-magic-neon-gradient":
    case "avatar-magic-avatar-circles":
    case "avatar-aceternity-moving-border":
    case "avatar-tsparticles-sea-anemone":
    case "avatar-tsparticles-black-hole":
      return raw;
    default:
      return null;
  }
}

function getAssetKind(url?: string): "video" | "lottie" | "image" | null {
  if (!url) return null;
  const clean = url.split(/[?#]/)[0].toLowerCase();
  if (clean.endsWith(".webm")) return "video";
  if (clean.endsWith(".json")) return "lottie";
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

export function DiscordAvatarFrame({
  equippedId,
  fallbackRing,
  item,
  size = "md",
  micActive = false,
  children,
}: DiscordAvatarFrameProps) {
  const px = typeof size === "number" ? Math.max(24, size) : SIZE_MAP[size];
  const rawId = equippedId || fallbackRing || "";
  const resolvedItem = item ?? (rawId ? findCosmeticById(rawId) : undefined);
  const effectId = resolveAvatarEffect(resolvedItem?.id ?? equippedId, fallbackRing);
  const lottieConfig = effectId ? AVATAR_LOTTIE_MAP[effectId] : null;
  const assetUrl = resolvedItem?.assetUrl;
  const assetKind = getAssetKind(assetUrl);

  const [mediaFailed, setMediaFailed] = useState(false);

  useEffect(() => {
    setMediaFailed(false);
  }, [assetUrl]);

  const shouldUseLottieFallback =
    !assetUrl || mediaFailed || assetKind === "lottie";
  const lottieUrl =
    assetKind === "lottie" && assetUrl && !mediaFailed
      ? assetUrl
      : lottieConfig?.src ?? (resolvedItem ? "/lottie/cyber-ring.json" : null);

  const [animationData, setAnimationData] = useState<object | null>(() =>
    lottieUrl ? lottieDataCache.get(lottieUrl) ?? null : null
  );

  useEffect(() => {
    if (!shouldUseLottieFallback || !lottieUrl) {
      setAnimationData(null);
      return;
    }

    const cached = lottieDataCache.get(lottieUrl);
    if (cached) {
      setAnimationData(cached);
      return;
    }

    let cancelled = false;
    loadLottieJson(lottieUrl).then((data) => {
      if (!cancelled && data) {
        setAnimationData(data);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [shouldUseLottieFallback, lottieUrl]);

  const hasEffect = Boolean(resolvedItem || lottieConfig);
  const glowColor =
    resolvedItem?.fallbackGlowColor ?? resolvedItem?.previewAccent ?? undefined;
  const micColor = lottieConfig?.micColor ?? "border-[#E5484D]";
  const scale = resolvedItem?.scale ?? 1.22;
  const isDefaultScale = Math.abs(scale - 1.22) < 0.001;

  const boxStyle: CSSProperties = isDefaultScale
    ? {}
    : {
        width: `${scale * 100}%`,
        height: `${scale * 100}%`,
        left: `${-((scale - 1) * 50)}%`,
        top: `${-((scale - 1) * 50)}%`,
      };

  const glowFilter =
    lottieConfig?.filter ??
    (glowColor ? `drop-shadow(0 0 10px ${glowColor}99)` : undefined);

  const overlayStyle: CSSProperties = {
    ...boxStyle,
    filter: glowFilter,
    mixBlendMode: resolvedItem?.blendMode === "screen" ? "screen" : "normal",
  };

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

      <div className="relative w-full h-full rounded-full overflow-hidden flex items-center justify-center z-10">
        {children}
      </div>

      {hasEffect && (
        <div
          aria-hidden="true"
          className={`pointer-events-none select-none absolute z-20 flex items-center justify-center ${
            isDefaultScale ? "w-[122%] h-[122%] -inset-[11%]" : ""
          }`}
          style={overlayStyle}
        >
          {!mediaFailed && assetUrl && assetKind === "video" ? (
            <video
              src={assetUrl}
              autoPlay
              loop
              muted
              playsInline
              onError={() => setMediaFailed(true)}
              className="w-full h-full object-contain pointer-events-none select-none"
            />
          ) : !mediaFailed && assetUrl && assetKind === "image" ? (
            <img
              src={assetUrl}
              alt=""
              onError={() => setMediaFailed(true)}
              className="w-full h-full object-contain pointer-events-none select-none"
            />
          ) : animationData ? (
            <Lottie
              src={animationData}
              loop
              autoplay
              className="w-full h-full pointer-events-none select-none"
            />
          ) : glowColor ? (
            <span
              className="w-full h-full rounded-full border-2 opacity-80"
              style={{
                borderColor: glowColor,
                boxShadow: `0 0 14px ${glowColor}88`,
              }}
            />
          ) : null}
          {effectId === "avatar-rb-electric-border" && (
            <div className="absolute inset-0 rounded-full pointer-events-none">
              <DynamicElectricBorder
                color="#38BDF8"
                glowColor="#0284C7"
                borderRadius={999}
                strands={3}
                thickness={1.5}
                interactive={false}
                className="w-full h-full rounded-full"
              />
            </div>
          )}
          {effectId === "avatar-rb-star-border" && (
            <div className="absolute inset-0 rounded-full pointer-events-none">
              <DynamicStarBorder
                as="div"
                color="#FBBF24"
                trailColor="#F59E0B"
                radius={999}
                stars={2}
                sparkle
                backgroundColor="transparent"
                borderColor="rgba(251,191,36,0.35)"
                className="w-full h-full rounded-full"
              />
            </div>
          )}
          {effectId === "avatar-rb-magic-rings" && (
            <>
              <span className="absolute inset-0 rounded-full border-2 border-pink-400/90 cosmetic-svg-spin-slow shadow-[0_0_12px_#EC4899]" />
              <span className="absolute -inset-1 rounded-full border-2 border-cyan-300/85 cosmetic-svg-spin-reverse shadow-[0_0_12px_#38BDF8]" />
            </>
          )}
          {effectId === "avatar-rb-plasma-strands" && (
            <span
              className="absolute -inset-0.5 rounded-full border-2 border-purple-400/90 cosmetic-reticle-pulse"
              style={{ boxShadow: "0 0 18px rgba(168,85,247,0.9), inset 0 0 12px rgba(236,72,153,0.7)" }}
            />
          )}
          {effectId === "avatar-rb-crystal-ball" && (
            <span
              className="absolute inset-0.5 rounded-full border-2 border-cyan-300/95 cosmetic-reticle-pulse"
              style={{ boxShadow: "0 0 16px rgba(6,182,212,0.9), inset 0 0 10px rgba(255,255,255,0.6)" }}
            />
          )}
          {effectId === "avatar-rb-orb-halo" && (
            <span
              className="absolute -inset-0.5 rounded-full border-2 border-violet-400/90 cosmetic-svg-spin-slow"
              style={{ boxShadow: "0 0 16px rgba(139,92,246,0.9), 0 0 24px rgba(56,189,248,0.6)" }}
            />
          )}
          {effectId === "avatar-rb-metaballs-ring" && (
            <span className="absolute inset-0 rounded-full cosmetic-svg-spin-reverse">
              <span className="absolute -top-1 left-1/3 w-3 h-3 rounded-full bg-teal-400 shadow-[0_0_10px_#14B8A6]" />
              <span className="absolute -bottom-1 right-1/3 w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#10B981]" />
            </span>
          )}
          {effectId === "avatar-magic-orbiting-circles" && (
            <>
              <span className="absolute -inset-0.5 rounded-full border border-dashed border-emerald-400/80 cosmetic-svg-spin-slow">
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#10B981]" />
              </span>
              <span className="absolute inset-1 rounded-full border border-dashed border-teal-300/75 cosmetic-svg-spin-reverse">
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-cyan-300 shadow-[0_0_8px_#06B6D4]" />
              </span>
            </>
          )}
          {effectId === "avatar-magic-shine-border" && (
            <span
              className="absolute inset-0.5 rounded-full cosmetic-border-beam"
              style={{
                "--beam-from": "rgba(251, 191, 36, 0.98)",
                "--beam-to": "rgba(255, 255, 255, 1)",
              } as CSSProperties}
            />
          )}
          {effectId === "avatar-magic-neon-gradient" && (
            <span
              className="absolute inset-0 rounded-full border-2 border-rose-400/95 cosmetic-reticle-pulse"
              style={{ boxShadow: "0 0 18px rgba(244,63,94,0.9), 0 0 26px rgba(56,189,248,0.65)" }}
            />
          )}
          {effectId === "avatar-magic-avatar-circles" && (
            <span className="absolute -bottom-1 -right-1 flex -space-x-1.5">
              <span className="w-3.5 h-3.5 rounded-full bg-sky-500 border border-white shadow-sm" />
              <span className="w-3.5 h-3.5 rounded-full bg-amber-400 border border-white shadow-sm" />
              <span className="w-4 h-3.5 rounded-full bg-[#1A1714] text-white text-[7px] font-mono font-bold flex items-center justify-center border border-white">
                +9
              </span>
            </span>
          )}
          {effectId === "avatar-aceternity-moving-border" && (
            <span className="absolute inset-0 rounded-full cosmetic-svg-spin-slow">
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-sky-400 shadow-[0_0_14px_#0EA5E9]" />
            </span>
          )}
          {effectId === "avatar-tsparticles-sea-anemone" && (
            <span
              className="absolute -inset-1 rounded-full border-2 border-dotted border-pink-400/90 cosmetic-svg-spin-slow"
              style={{ boxShadow: "0 0 16px rgba(236,72,153,0.85), inset 0 0 10px rgba(244,114,182,0.7)" }}
            />
          )}
          {effectId === "avatar-tsparticles-black-hole" && (
            <span
              className="absolute -inset-0.5 rounded-full border-2 border-indigo-400/95 cosmetic-svg-spin-reverse"
              style={{
                background: "radial-gradient(circle, transparent 52%, rgba(99,102,241,0.45) 75%, transparent 100%)",
                boxShadow: "0 0 18px rgba(99,102,241,0.95), inset 0 0 14px rgba(15,23,42,0.9)",
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

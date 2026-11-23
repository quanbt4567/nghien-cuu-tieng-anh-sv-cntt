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
  lite?: boolean;
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
  filter?: string;
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
    micColor: "border-[#DC2626]",
  },
  "avatar-matrix-code-halo": {
    src: "/lottie/matrix-pulse.json",
    micColor: "border-[#15803D]",
  },
  "avatar-inferno-hotfix-horns": {
    src: "/lottie/inferno-aura.json",
    micColor: "border-[#B45309]",
  },
  "avatar-quantum-holo-visor": {
    src: "/lottie/cyber-ring.json",
    filter: "hue-rotate(115deg) saturate(1.25)",
    micColor: "border-[#1D4ED8]",
  },
  "avatar-rb-electric-border": {
    src: "/lottie/cyber-ring.json",
    filter: "hue-rotate(150deg) saturate(1.4)",
    micColor: "border-[#2563EB]",
  },
  "avatar-rb-star-border": {
    src: "/lottie/inferno-aura.json",
    filter: "hue-rotate(25deg) saturate(1.4)",
    micColor: "border-[#B45309]",
  },
  "avatar-rb-magic-rings": {
    src: "/lottie/cyber-ring.json",
    filter: "hue-rotate(260deg) saturate(1.4)",
    micColor: "border-[#DC2626]",
  },
  "avatar-rb-plasma-strands": {
    src: "/lottie/matrix-pulse.json",
    filter: "hue-rotate(165deg) saturate(1.4)",
    micColor: "border-[#1D4ED8]",
  },
  "avatar-rb-crystal-ball": {
    src: "/lottie/cyber-ring.json",
    filter: "hue-rotate(135deg) saturate(1.4)",
    micColor: "border-[#2563EB]",
  },
  "avatar-magic-orbiting-circles": {
    src: "/lottie/matrix-pulse.json",
    micColor: "border-[#15803D]",
  },
  "avatar-magic-shine-border": {
    src: "/lottie/inferno-aura.json",
    filter: "saturate(1.3)",
    micColor: "border-[#B45309]",
  },
  "avatar-magic-neon-gradient": {
    src: "/lottie/cyber-ring.json",
    filter: "hue-rotate(310deg) saturate(1.4)",
    micColor: "border-[#DC2626]",
  },
  "avatar-rb-orb-halo": {
    src: "/lottie/cyber-ring.json",
    filter: "hue-rotate(190deg) saturate(1.4)",
    micColor: "border-[#1D4ED8]",
  },
  "avatar-rb-metaballs-ring": {
    src: "/lottie/matrix-pulse.json",
    filter: "hue-rotate(45deg) saturate(1.4)",
    micColor: "border-[#15803D]",
  },
  "avatar-magic-avatar-circles": {
    src: "/lottie/cyber-ring.json",
    filter: "hue-rotate(135deg) saturate(1.3)",
    micColor: "border-[#2563EB]",
  },
  "avatar-aceternity-moving-border": {
    src: "/lottie/cyber-ring.json",
    filter: "hue-rotate(145deg) saturate(1.4)",
    micColor: "border-[#1D4ED8]",
  },
  "avatar-tsparticles-sea-anemone": {
    src: "/lottie/inferno-aura.json",
    filter: "hue-rotate(285deg) saturate(1.4)",
    micColor: "border-[#DC2626]",
  },
  "avatar-tsparticles-black-hole": {
    src: "/lottie/cyber-ring.json",
    filter: "hue-rotate(210deg) saturate(1.4)",
    micColor: "border-[#1D4ED8]",
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
  lite = false,
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
  const [isMobileTouch, setIsMobileTouch] = useState(false);
  const effectiveLite = lite || isMobileTouch;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const coarse = window.matchMedia?.("(hover: none) and (pointer: coarse)")?.matches ?? false;
    setIsMobileTouch(coarse || window.innerWidth < 768);
  }, []);

  useEffect(() => {
    setMediaFailed(false);
  }, [assetUrl]);

  const shouldUseLottieFallback =
    !effectiveLite && (!assetUrl || mediaFailed || assetKind === "lottie");
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
  const micColor = lottieConfig?.micColor ?? "border-blue-600";
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

  const glowFilter = lottieConfig?.filter;

  const isLightSafeEffect = Boolean(
    effectId &&
      (effectId.includes("-rb-") ||
        effectId.includes("-magic-") ||
        effectId.includes("-aceternity-") ||
        effectId.includes("-tsparticles-"))
  );

  const overlayStyle: CSSProperties = {
    ...boxStyle,
    filter: glowFilter,
    mixBlendMode:
      isLightSafeEffect || resolvedItem?.blendMode !== "screen"
        ? "normal"
        : "screen",
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
          {!effectiveLite && !mediaFailed && assetUrl && assetKind === "video" ? (
            <video
              src={assetUrl}
              autoPlay
              loop
              muted
              playsInline
              onError={() => setMediaFailed(true)}
              className="w-full h-full object-contain pointer-events-none select-none"
            />
          ) : !effectiveLite && !mediaFailed && assetUrl && assetKind === "image" ? (
            <img
              src={assetUrl}
              alt=""
              onError={() => setMediaFailed(true)}
              className="w-full h-full object-contain pointer-events-none select-none"
            />
          ) : !effectiveLite && animationData ? (
            <Lottie
              src={animationData}
              loop
              autoplay
              className="w-full h-full pointer-events-none select-none"
            />
          ) : !isLightSafeEffect && glowColor ? (
            <span
              className="w-full h-full rounded-full border-2 opacity-85"
              style={{
                borderColor: glowColor,
              }}
            />
          ) : null}
          {effectId === "avatar-rb-electric-border" &&
            (effectiveLite ? (
              <span className="absolute inset-0.5 rounded-full border-2 border-dashed border-blue-600" />
            ) : (
              <>
                <span className="absolute inset-0.5 rounded-full border-2 border-dashed border-blue-600/85 cosmetic-svg-spin-slow" />
                <div className="absolute inset-0 rounded-full pointer-events-none">
                  <DynamicElectricBorder
                    color="#1D4ED8"
                    glowColor="#2563EB"
                    borderRadius={999}
                    strands={3}
                    thickness={2}
                    intensity={1.6}
                    interactive={false}
                    className="w-full h-full rounded-full"
                  />
                </div>
              </>
            ))}
          {effectId === "avatar-rb-star-border" &&
            (effectiveLite ? (
              <span className="absolute inset-0 rounded-full border-2 border-amber-500">
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-amber-500" />
              </span>
            ) : (
              <div className="absolute inset-0 rounded-full pointer-events-none">
                <DynamicStarBorder
                  as="div"
                  color="#B45309"
                  trailColor="#F59E0B"
                  radius={999}
                  stars={2}
                  sparkle
                  thickness={2}
                  backgroundColor="transparent"
                  borderColor="rgba(180,83,9,0.55)"
                  className="w-full h-full rounded-full"
                />
              </div>
            ))}
          {effectId === "avatar-rb-magic-rings" && (
            <>
              <span className="absolute inset-0 rounded-full border-2 border-red-500/90 cosmetic-svg-spin-slow" />
              <span className="absolute -inset-1 rounded-full border-2 border-blue-600/85 cosmetic-svg-spin-reverse" />
            </>
          )}
          {effectId === "avatar-rb-plasma-strands" && (
            <span className="absolute -inset-0.5 rounded-full border-2 border-blue-700/90 cosmetic-reticle-pulse" />
          )}
          {effectId === "avatar-rb-crystal-ball" && (
            <span className="absolute inset-0.5 rounded-full border-2 border-blue-500/95 cosmetic-reticle-pulse" />
          )}
          {effectId === "avatar-rb-orb-halo" && (
            <span className="absolute -inset-0.5 rounded-full border-2 border-blue-700/90 cosmetic-svg-spin-slow" />
          )}
          {effectId === "avatar-rb-metaballs-ring" && (
            <span className="absolute inset-0 rounded-full cosmetic-svg-spin-reverse">
              <span className="absolute -top-1 left-1/3 w-3 h-3 rounded-full bg-green-700" />
              <span className="absolute -bottom-1 right-1/3 w-2.5 h-2.5 rounded-full bg-green-600" />
            </span>
          )}
          {effectId === "avatar-magic-orbiting-circles" && (
            <>
              <span className="absolute -inset-0.5 rounded-full border border-dashed border-green-600/80 cosmetic-svg-spin-slow">
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-green-600" />
              </span>
              <span className="absolute inset-1 rounded-full border border-dashed border-blue-600/75 cosmetic-svg-spin-reverse">
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-blue-600" />
              </span>
            </>
          )}
          {effectId === "avatar-magic-shine-border" && (
            <span
              className="absolute inset-0.5 rounded-full cosmetic-border-beam"
              style={{
                "--beam-from": "rgba(180, 83, 9, 0.98)",
                "--beam-to": "rgba(255, 255, 255, 1)",
              } as CSSProperties}
            />
          )}
          {effectId === "avatar-magic-neon-gradient" && (
            <span className="absolute inset-0 rounded-full border-2 border-red-600/95 cosmetic-reticle-pulse" />
          )}
          {effectId === "avatar-magic-avatar-circles" && (
            <span className="absolute -bottom-1 -right-1 flex -space-x-1.5">
              <span className="w-3.5 h-3.5 rounded-full bg-blue-600 border border-white" />
              <span className="w-3.5 h-3.5 rounded-full bg-amber-500 border border-white" />
              <span className="w-4 h-3.5 rounded-full bg-white text-blue-700 text-[7px] font-mono font-bold flex items-center justify-center border border-blue-300">
                +9
              </span>
            </span>
          )}
          {effectId === "avatar-aceternity-moving-border" && (
            <span className="absolute inset-0 rounded-full cosmetic-svg-spin-slow">
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-blue-600" />
            </span>
          )}
          {effectId === "avatar-tsparticles-sea-anemone" && (
            <span className="absolute -inset-1 rounded-full border-2 border-dotted border-red-600/90 cosmetic-svg-spin-slow" />
          )}
          {effectId === "avatar-tsparticles-black-hole" && (
            <span
              className="absolute -inset-0.5 rounded-full border-2 border-slate-800 dark:border-slate-200 cosmetic-svg-spin-reverse"
              style={{
                background: "radial-gradient(circle, transparent 52%, rgba(29,78,216,0.3) 75%, transparent 100%)",
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

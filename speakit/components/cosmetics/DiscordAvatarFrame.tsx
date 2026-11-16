"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Lottie } from "lottie-react";
import { findCosmeticById, type CosmeticItem } from "../../lib/cosmetics";
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
  | "avatar-quantum-holo-visor";

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
        </div>
      )}
    </div>
  );
}

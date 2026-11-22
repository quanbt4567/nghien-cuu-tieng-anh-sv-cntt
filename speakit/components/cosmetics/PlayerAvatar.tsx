"use client";

import {
  Bot,
  Bug,
  Cloud,
  Coffee,
  Cpu,
  Rocket,
  Shield,
  Terminal,
  type LucideIcon,
} from "lucide-react";

export interface AvatarPreset {
  id: string;
  label: string;
  bgClass: string;
  textClass: string;
  icon: LucideIcon;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: "preset:terminal-dev",
    label: "Terminal Dev",
    bgClass: "bg-slate-950",
    textClass: "text-emerald-400",
    icon: Terminal,
  },
  {
    id: "preset:cyber-fox",
    label: "Cyber Core",
    bgClass: "bg-rose-600",
    textClass: "text-white",
    icon: Cpu,
  },
  {
    id: "preset:cloud-ninja",
    label: "Cloud Ninja",
    bgClass: "bg-sky-600",
    textClass: "text-white",
    icon: Cloud,
  },
  {
    id: "preset:bug-hunter",
    label: "Bug Hunter",
    bgClass: "bg-amber-500",
    textClass: "text-slate-950",
    icon: Bug,
  },
  {
    id: "preset:pixel-bot",
    label: "Pixel Bot",
    bgClass: "bg-emerald-600",
    textClass: "text-white",
    icon: Bot,
  },
  {
    id: "preset:rocket-sre",
    label: "Rocket SRE",
    bgClass: "bg-slate-950",
    textClass: "text-amber-400",
    icon: Rocket,
  },
  {
    id: "preset:coffee-coder",
    label: "Coffee Coder",
    bgClass: "bg-amber-950",
    textClass: "text-amber-200",
    icon: Coffee,
  },
  {
    id: "preset:shield-sec",
    label: "Shield Sec",
    bgClass: "bg-slate-900",
    textClass: "text-sky-400",
    icon: Shield,
  },
];

const PRESET_MAP = new Map<string, AvatarPreset>(
  AVATAR_PRESETS.map((preset) => [preset.id, preset])
);

const SAFE_RASTER_DATA_URL_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

export function getPlayerInitials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return "DV";
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const first = Array.from(words[0])[0] ?? "";
    const second = Array.from(words[1])[0] ?? "";
    return `${first}${second}`.toUpperCase() || "DV";
  }
  const letters = Array.from(cleaned.replace(/[^a-zA-Z0-9\u00C0-\u1EFF]/g, ""));
  return (
    (letters.slice(0, 2).join("") || Array.from(cleaned).slice(0, 2).join("")).toUpperCase() ||
    "DV"
  );
}

export interface PlayerAvatarProps {
  avatarUrl?: string | null;
  displayName: string;
  className?: string;
}

export function PlayerAvatar({
  avatarUrl,
  displayName,
  className = "",
}: PlayerAvatarProps) {
  const normalizedUrl = typeof avatarUrl === "string" ? avatarUrl.trim() : "";

  if (normalizedUrl && SAFE_RASTER_DATA_URL_RE.test(normalizedUrl)) {
    return (
      <img
        src={normalizedUrl}
        alt={`Avatar của ${displayName}`}
        className={`w-full h-full rounded-full object-cover select-none ${className}`}
      />
    );
  }

  const preset = normalizedUrl ? PRESET_MAP.get(normalizedUrl) : undefined;
  if (preset) {
    const Icon = preset.icon;
    return (
      <div
        aria-label={`Avatar ${preset.label} của ${displayName}`}
        className={`w-full h-full rounded-full flex items-center justify-center ${preset.bgClass} ${preset.textClass} ${className}`}
      >
        <Icon className="w-[54%] h-[54%]" strokeWidth={2.2} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div
      aria-label={`Avatar của ${displayName}`}
      className={`w-full h-full rounded-full bg-slate-900/90 border border-white/15 flex items-center justify-center font-mono font-bold text-cyan-100 select-none ${className}`}
    >
      {getPlayerInitials(displayName)}
    </div>
  );
}

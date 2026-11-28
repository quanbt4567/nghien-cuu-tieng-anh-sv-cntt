"use client";

import { useState } from "react";

interface AdminUserAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  size?: "sm" | "md";
}

function getInitials(name?: string | null): string {
  const cleaned = name?.trim();
  if (!cleaned) return "?";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

/**
 * Renders a user's avatar image with an initial-circle fallback on missing or broken URLs.
 */
export function AdminUserAvatar({
  name,
  avatarUrl,
  size = "md",
}: AdminUserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const sizeClass = size === "sm" ? "w-7 h-7 text-[11px]" : "w-8 h-8 text-xs";
  const trimmedUrl = avatarUrl?.trim() ?? "";

  if (trimmedUrl && !imgError) {
    return (
      <img
        src={trimmedUrl}
        alt={name?.trim() || "Avatar người dùng"}
        onError={() => setImgError(true)}
        className={`${sizeClass} rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-800`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${sizeClass} rounded-full inline-flex items-center justify-center font-mono font-bold shrink-0 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800`}
    >
      {getInitials(name)}
    </span>
  );
}

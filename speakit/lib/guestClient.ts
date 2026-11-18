"use client";

import { rewardPracticePoints } from "../app/actions/leaderboard";
import type { PublicGuestPlayer } from "./db";

export const GUEST_TRANSFER_CODE_KEY = "speakit_transfer_code_v1";
export const GUEST_PROFILE_CACHE_KEY = "speakit_guest_profile_cache_v1";
export const GUEST_PROFILE_UPDATED_EVENT = "speakit:guest-profile-updated";
export const OPEN_AUTH_MODAL_EVENT = "speakit:open-auth-modal";

export function requestOpenAuthModal(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(OPEN_AUTH_MODAL_EVENT));
  } catch {
    return;
  }
}

export function readBackupTransferCode(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage.getItem(GUEST_TRANSFER_CODE_KEY) || undefined;
  } catch {
    return undefined;
  }
}

export function saveBackupTransferCode(code: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GUEST_TRANSFER_CODE_KEY, code);
  } catch {
    return;
  }
}

export function readCachedGuestProfile(): PublicGuestPlayer | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GUEST_PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PublicGuestPlayer> | null;
    if (
      !parsed ||
      typeof parsed.id !== "string" ||
      typeof parsed.transferCode !== "string" ||
      typeof parsed.displayName !== "string"
    ) {
      return null;
    }
    return {
      id: parsed.id,
      transferCode: parsed.transferCode,
      displayName: parsed.displayName,
      email:
        typeof parsed.email === "string" && parsed.email.trim()
          ? parsed.email.trim().toLowerCase()
          : null,
      itCoins: typeof parsed.itCoins === "number" && Number.isFinite(parsed.itCoins) ? parsed.itCoins : 0,
      totalPoints:
        typeof parsed.totalPoints === "number" && Number.isFinite(parsed.totalPoints)
          ? parsed.totalPoints
          : 0,
      streakDays:
        typeof parsed.streakDays === "number" && Number.isFinite(parsed.streakDays)
          ? parsed.streakDays
          : 0,
      lastPracticeDate: typeof parsed.lastPracticeDate === "string" ? parsed.lastPracticeDate : null,
      equippedTitle:
        typeof parsed.equippedTitle === "string" && parsed.equippedTitle
          ? parsed.equippedTitle
          : "Junior Speaker",
      equippedRing:
        typeof parsed.equippedRing === "string" && parsed.equippedRing
          ? parsed.equippedRing
          : "default",
      ownedItems: Array.isArray(parsed.ownedItems)
        ? parsed.ownedItems.filter((item): item is string => typeof item === "string")
        : [],
    };
  } catch {
    return null;
  }
}

export function notifyGuestProfileUpdated(
  player: PublicGuestPlayer | null
): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent<PublicGuestPlayer | null>(GUEST_PROFILE_UPDATED_EVENT, {
        detail: player,
      })
    );
  } catch {
    return;
  }
}

export function saveCachedGuestProfile(player: PublicGuestPlayer | null): void {
  if (typeof window === "undefined") return;
  let normalizedPlayer = player;
  try {
    if (player) {
      if (player.email === undefined) {
        const previous = readCachedGuestProfile();
        if (previous && previous.id === player.id && previous.email !== undefined) {
          normalizedPlayer = { ...player, email: previous.email };
        }
      }
      window.localStorage.setItem(
        GUEST_PROFILE_CACHE_KEY,
        JSON.stringify(normalizedPlayer)
      );
      if (normalizedPlayer?.transferCode) {
        window.localStorage.setItem(
          GUEST_TRANSFER_CODE_KEY,
          normalizedPlayer.transferCode
        );
      }
    } else {
      window.localStorage.removeItem(GUEST_PROFILE_CACHE_KEY);
      window.localStorage.removeItem(GUEST_TRANSFER_CODE_KEY);
    }
  } catch {
  }
  notifyGuestProfileUpdated(normalizedPlayer);
}

export function syncGuestProfileFromServer(
  player: PublicGuestPlayer | null
): void {
  saveCachedGuestProfile(player);
}

export async function reportGuestPracticePoints(
  scenarioId: string,
  rawScore: number
): Promise<PublicGuestPlayer | null> {
  const awardedPoints = Number.isFinite(rawScore)
    ? Math.max(0, Math.min(10000, Math.round(rawScore)))
    : 0;
  if (awardedPoints <= 0) return null;

  const previousCached = readCachedGuestProfile();
  if (previousCached) {
    const nextTotalPoints = previousCached.totalPoints + awardedPoints;
    const coinDelta =
      Math.floor(nextTotalPoints / 1000) -
      Math.floor(previousCached.totalPoints / 1000);
    saveCachedGuestProfile({
      ...previousCached,
      totalPoints: nextTotalPoints,
      itCoins: previousCached.itCoins + Math.max(0, coinDelta),
    });
  }

  try {
    const res = await rewardPracticePoints(
      scenarioId,
      awardedPoints,
      readBackupTransferCode()
    );
    if (res.player) {
      saveCachedGuestProfile(res.player);
      return res.player;
    }
    if (previousCached) {
      saveCachedGuestProfile(previousCached);
    }
    return null;
  } catch {
    if (previousCached) {
      saveCachedGuestProfile(previousCached);
    }
    return null;
  }
}


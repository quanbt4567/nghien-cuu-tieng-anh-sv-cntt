"use client";

import { rewardPracticePoints } from "../app/actions/leaderboard";

export const GUEST_TRANSFER_CODE_KEY = "speakit_transfer_code_v1";

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

export async function reportGuestPracticePoints(
  scenarioId: string,
  rawScore: number
): Promise<void> {
  if (!Number.isFinite(rawScore) || rawScore <= 0) return;
  try {
    const res = await rewardPracticePoints(
      scenarioId,
      Math.round(rawScore),
      readBackupTransferCode()
    );
    if (res.player?.transferCode) {
      saveBackupTransferCode(res.player.transferCode);
    }
  } catch {
    return;
  }
}


"use client";

import type { ArenaLeaveGameId } from "./arena-leave-policy";

export interface ArenaLeaveRequest {
  gameId: ArenaLeaveGameId;
  roomCode?: string | null;
  isActive: boolean;
  performLeave: (skipReward?: boolean) => void;
}

type LeaveHostHandler = (request: ArenaLeaveRequest) => void;

let activeHost: LeaveHostHandler | null = null;

export function registerArenaLeaveHost(handler: LeaveHostHandler): () => void {
  activeHost = handler;
  return () => {
    if (activeHost === handler) {
      activeHost = null;
    }
  };
}

export function requestArenaLeave(request: ArenaLeaveRequest): void {
  if (!request.isActive || !activeHost) {
    request.performLeave(false);
    return;
  }
  activeHost(request);
}

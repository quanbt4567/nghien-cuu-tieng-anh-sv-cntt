"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bomb,
  Bot,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  Cpu,
  Flame,
  Mic,
  Play,
  RotateCcw,
  Send,
  ShoppingBag,
  Skull,
  Square,
  Terminal,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import { initOrHydrateGuestSession } from "@/app/actions/leaderboard";
import { DiscordAvatarFrame } from "@/components/cosmetics/DiscordAvatarFrame";
import { VictoryFinisherOverlay } from "@/components/cosmetics/VictoryFinisherOverlay";
import { requestArenaLeave } from "@/lib/arena-leave-client";
import { getVietnameseGloss } from "@/components/common/EnglishWordTooltip";
import type {
  ArenaRewardSummary,
  WordChainMove,
  WordChainRoomState,
} from "@/lib/arena-moderator";
import { DYNAMIC_FUSE_RULES } from "@/lib/arena-three-games-data";
import {
  DEFAULT_EQUIPPED_COSMETICS,
  normalizeEquippedCosmetics,
} from "@/lib/cosmetics";
import type { PublicGuestPlayer } from "@/lib/db";
import {
  isSfxMuted,
  playBuzzerFoul,
  playComboChime,
  playExplosion,
  playTick,
  playVictoryFanfare,
  setSfxMuted,
} from "@/lib/game-sfx";
import {
  GUEST_PROFILE_CACHE_KEY,
  GUEST_PROFILE_UPDATED_EVENT,
  readBackupTransferCode,
  readCachedGuestProfile,
  saveCachedGuestProfile,
} from "@/lib/guestClient";
import { type SpeechController, startSpeechRecognition } from "@/lib/speech";

interface WordChainTurnResult {
  valid: boolean;
  word: string;
  isItTerm: boolean;
  foulDetected: boolean;
  reason: string;
  streak: number;
  multiplier: 1 | 2;
  pointsEarned: number;
  comboTriggered: boolean;
  nextFuseSeconds: number;
  botMove: WordChainMove | null;
  explodedPlayerId: string | null;
  winnerId: string | null;
}

interface WordChainApiResponse {
  ok?: boolean;
  room?: WordChainRoomState;
  turnResult?: WordChainTurnResult;
  reward?: ArenaRewardSummary | null;
  player?: PublicGuestPlayer | null;
  error?: string;
}

export function SyntaxBombArena() {
  const [guestPlayer, setGuestPlayer] = useState<PublicGuestPlayer | null>(null);
  const [sfxMuted, setSfxMutedState] = useState(false);

  const [room, setRoom] = useState<WordChainRoomState | null>(null);
  const [lastReward, setLastReward] = useState<ArenaRewardSummary | null>(null);

  const [targetTurns, setTargetTurns] = useState<number>(12);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [wordInput, setWordInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const [fuseTotalSec, setFuseTotalSec] = useState<number>(
    DYNAMIC_FUSE_RULES.baseFuseSeconds
  );
  const [fuseRemainingSec, setFuseRemainingSec] = useState<number>(
    DYNAMIC_FUSE_RULES.baseFuseSeconds
  );

  const [turnBanner, setTurnBanner] = useState<{
    text: string;
    tone: "info" | "it" | "combo" | "foul" | "error";
  } | null>(null);
  const [foulFlash, setFoulFlash] = useState(false);
  const [segfaultShake, setSegfaultShake] = useState(false);
  const [showFinisher, setShowFinisher] = useState(false);

  const speechControllerRef = useRef<SpeechController | null>(null);
  const deadlineMsRef = useRef<number>(Date.now() + DYNAMIC_FUSE_RULES.baseFuseSeconds * 1000);
  const fuseTotalRef = useRef<number>(DYNAMIC_FUSE_RULES.baseFuseSeconds);
  const prevFuseSecRef = useRef<number>(DYNAMIC_FUSE_RULES.baseFuseSeconds);
  const nextTickAtRef = useRef<number>(0);
  const prevTurnKeyRef = useRef<string | null>(null);
  const timeoutFiredKeyRef = useRef<string | null>(null);
  const pausedAtMsRef = useRef<number | null>(null);
  const explosionPlayedRef = useRef<string | null>(null);
  const finisherPlayedRef = useRef<string | null>(null);
  const flushedRoomRef = useRef<string | null>(null);
  const foulTimerRef = useRef<number | null>(null);
  const shakeTimerRef = useRef<number | null>(null);
  const victoryTimerRef = useRef<number | null>(null);

  const syncGuestProfile = useCallback(async () => {
    const cached = readCachedGuestProfile();
    if (cached) {
      setGuestPlayer(cached);
    }
    try {
      const session = await initOrHydrateGuestSession(readBackupTransferCode());
      if (session.mode === "online" && session.player) {
        setGuestPlayer(session.player);
        saveCachedGuestProfile(session.player);
      }
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    setSfxMutedState(isSfxMuted());
    void syncGuestProfile();

    const handleProfileEvent = () => {
      const cached = readCachedGuestProfile();
      if (cached) setGuestPlayer(cached);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === GUEST_PROFILE_CACHE_KEY || event.key === null) {
        handleProfileEvent();
      }
    };

    window.addEventListener(GUEST_PROFILE_UPDATED_EVENT, handleProfileEvent);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(GUEST_PROFILE_UPDATED_EVENT, handleProfileEvent);
      window.removeEventListener("storage", handleStorage);
      speechControllerRef.current?.abort();
      if (foulTimerRef.current) window.clearTimeout(foulTimerRef.current);
      if (shakeTimerRef.current) window.clearTimeout(shakeTimerRef.current);
      if (victoryTimerRef.current) window.clearTimeout(victoryTimerRef.current);
    };
  }, [syncGuestProfile]);

  const equippedCosmetics = useMemo(
    () =>
      guestPlayer?.equippedCosmetics
        ? normalizeEquippedCosmetics(guestPlayer.equippedCosmetics)
        : DEFAULT_EQUIPPED_COSMETICS,
    [guestPlayer]
  );

  const myPlayerId = useMemo(() => {
    if (guestPlayer?.id) {
      if (!room || room.players.some((p) => p.id === guestPlayer.id)) {
        return guestPlayer.id;
      }
    }
    const firstHuman = room?.players.find((p) => !p.isBot);
    return firstHuman?.id ?? guestPlayer?.id ?? "guest-local";
  }, [guestPlayer?.id, room]);

  const myPlayer = useMemo(
    () => room?.players.find((p) => p.id === myPlayerId) ?? null,
    [myPlayerId, room]
  );

  const isMultiHuman = useMemo(() => {
    if (!room) return false;
    const humans = room.players.filter((p) => !p.isBot);
    const hasBot = room.players.some((p) => p.isBot);
    return humans.length > 1 && !hasBot;
  }, [room]);

  const isMyTurn = useMemo(() => {
    if (!room || room.status !== "active") return false;
    if (!isMultiHuman) return true;
    return room.currentTurnPlayerId === myPlayerId;
  }, [isMultiHuman, myPlayerId, room]);

  const toggleMuteSfx = () => {
    const next = !sfxMuted;
    setSfxMuted(next);
    setSfxMutedState(next);
  };

  const triggerSegfaultEffects = useCallback(() => {
    playExplosion();
    setSegfaultShake(true);
    if (shakeTimerRef.current) window.clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = window.setTimeout(() => {
      setSegfaultShake(false);
    }, 900);
  }, []);

  const triggerFoulEffects = useCallback((message: string) => {
    playBuzzerFoul();
    setFoulFlash(true);
    setTurnBanner({ text: message, tone: "foul" });
    if (foulTimerRef.current) window.clearTimeout(foulTimerRef.current);
    foulTimerRef.current = window.setTimeout(() => {
      setFoulFlash(false);
    }, 800);
  }, []);

  const applyServerResponse = useCallback((data: WordChainApiResponse) => {
    if (data.player) {
      setGuestPlayer(data.player);
      saveCachedGuestProfile(data.player);
    }
    if (data.reward) {
      setLastReward(data.reward);
    }
    if (data.room) {
      setRoom(data.room);
    }
  }, []);

  const callWordChainAction = useCallback(
    async (payload: Record<string, unknown>, actionKey: string) => {
      setErrorMsg(null);
      setLoadingAction(actionKey);
      try {
        const res = await fetch("/api/arena/word-chain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            backupTransferCode: readBackupTransferCode(),
            displayName: guestPlayer?.displayName,
            playerId: payload.playerId ?? guestPlayer?.id,
          }),
        });
        const data = (await res.json()) as WordChainApiResponse;
        if (!res.ok) {
          setErrorMsg(data.error ?? "Unable to process Syntax Bomb action.");
          return null;
        }
        applyServerResponse(data);
        return data;
      } catch {
        setErrorMsg("Network error connecting to Syntax Bomb server.");
        return null;
      } finally {
        setLoadingAction(null);
      }
    },
    [applyServerResponse, guestPlayer?.displayName, guestPlayer?.id]
  );

  useEffect(() => {
    if (!room) {
      prevTurnKeyRef.current = null;
      timeoutFiredKeyRef.current = null;
      explosionPlayedRef.current = null;
      finisherPlayedRef.current = null;
      return;
    }

    if (room.status === "lobby") {
      prevTurnKeyRef.current = null;
      timeoutFiredKeyRef.current = null;
      explosionPlayedRef.current = null;
      finisherPlayedRef.current = null;
      flushedRoomRef.current = null;
      setTurnBanner(null);
      setFuseTotalSec(DYNAMIC_FUSE_RULES.baseFuseSeconds);
      setFuseRemainingSec(DYNAMIC_FUSE_RULES.baseFuseSeconds);
      return;
    }

    if (room.status === "active") {
      if (loadingAction === "start" || loadingAction === "quick_bot") {
        return;
      }
      const turnKey = `${room.roomCode}:${room.turnCount}:${room.currentTurnPlayerId ?? ""}`;
      if (prevTurnKeyRef.current !== turnKey) {
        const nextFuse = Math.max(
          3,
          room.fuseSeconds || DYNAMIC_FUSE_RULES.baseFuseSeconds
        );
        setFuseTotalSec(nextFuse);
        setFuseRemainingSec(nextFuse);

        const armTurnFuse = () => {
          prevTurnKeyRef.current = turnKey;
          fuseTotalRef.current = nextFuse;
          prevFuseSecRef.current = nextFuse;
          deadlineMsRef.current = Date.now() + nextFuse * 1000;
          nextTickAtRef.current = Date.now() + 260;
          timeoutFiredKeyRef.current = null;
        };

        if (
          typeof window !== "undefined" &&
          typeof window.requestAnimationFrame === "function"
        ) {
          const rafId = window.requestAnimationFrame(armTurnFuse);
          return () => window.cancelAnimationFrame(rafId);
        }
        armTurnFuse();
      } else if (room.fuseSeconds < prevFuseSecRef.current) {
        prevFuseSecRef.current = room.fuseSeconds;
        const capped = Date.now() + room.fuseSeconds * 1000;
        if (capped < deadlineMsRef.current) {
          deadlineMsRef.current = capped;
        }
      }
    }

    if (room.status === "finished") {
      setFuseRemainingSec(0);
      if (room.explodedPlayerId && explosionPlayedRef.current !== room.roomCode) {
        explosionPlayedRef.current = room.roomCode;
        triggerSegfaultEffects();
      }

      if (
        room.winnerId === myPlayerId &&
        finisherPlayedRef.current !== room.roomCode
      ) {
        finisherPlayedRef.current = room.roomCode;
        if (victoryTimerRef.current) window.clearTimeout(victoryTimerRef.current);
        victoryTimerRef.current = window.setTimeout(() => {
          playVictoryFanfare();
          setShowFinisher(true);
          void syncGuestProfile();
        }, 650);
      } else {
        void syncGuestProfile();
      }
    }
  }, [loadingAction, myPlayerId, room, syncGuestProfile, triggerSegfaultEffects]);

  useEffect(() => {
    if (
      !room ||
      room.status !== "active" ||
      loadingAction === "start" ||
      loadingAction === "quick_bot"
    ) {
      pausedAtMsRef.current = null;
      return;
    }

    if (loadingAction !== null) {
      if (pausedAtMsRef.current === null) {
        pausedAtMsRef.current = Date.now();
      }
      return;
    }

    if (pausedAtMsRef.current !== null) {
      const pausedDelta = Math.max(0, Date.now() - pausedAtMsRef.current);
      deadlineMsRef.current += pausedDelta;
      pausedAtMsRef.current = null;
    }

    const turnKey = `${room.roomCode}:${room.turnCount}:${room.currentTurnPlayerId ?? ""}`;

    const interval = window.setInterval(() => {
      if (prevTurnKeyRef.current !== turnKey) return;
      const remaining = Math.max(0, (deadlineMsRef.current - Date.now()) / 1000);
      setFuseRemainingSec(remaining);
      const urgency = Math.max(
        0,
        Math.min(1, 1 - remaining / Math.max(1, fuseTotalRef.current))
      );

      if (remaining > 0.05 && Date.now() >= nextTickAtRef.current) {
        playTick(urgency);
        const tickGapMs = Math.max(170, Math.round(880 - urgency * 700));
        nextTickAtRef.current = Date.now() + tickGapMs;
      }

      if (remaining <= 0 && timeoutFiredKeyRef.current !== turnKey) {
        timeoutFiredKeyRef.current = turnKey;
        if (explosionPlayedRef.current !== room.roomCode) {
          explosionPlayedRef.current = room.roomCode;
          triggerSegfaultEffects();
        }
        void callWordChainAction(
          {
            action: "timeout",
            code: room.roomCode,
            playerId: room.currentTurnPlayerId ?? myPlayerId,
          },
          "timeout"
        );
      }
    }, 50);

    return () => window.clearInterval(interval);
  }, [
    callWordChainAction,
    loadingAction,
    myPlayerId,
    room,
    triggerSegfaultEffects,
  ]);

  useEffect(() => {
    if (!room || room.status === "finished") return;
    const poll = window.setInterval(async () => {
      try {
        const res = await fetch(
          `/api/arena/word-chain?code=${encodeURIComponent(room.roomCode)}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as WordChainApiResponse;
        if (data.room) {
          setRoom(data.room);
          if (data.player) {
            setGuestPlayer(data.player);
            saveCachedGuestProfile(data.player);
          }
        }
      } catch {
        return;
      }
    }, 3000);
    return () => window.clearInterval(poll);
  }, [room]);

  const flushLeavePoints = useCallback(
    async (targetRoom: WordChainRoomState | null, keepalive = false) => {
      if (
        !targetRoom ||
        targetRoom.status === "finished" ||
        targetRoom.rewardsAwarded ||
        flushedRoomRef.current === targetRoom.roomCode
      ) {
        return;
      }
      const humanMoves = targetRoom.history.filter(
        (m) => m.playerId === myPlayerId
      ).length;
      if (humanMoves < 2) return;
      flushedRoomRef.current = targetRoom.roomCode;
      try {
        const res = await fetch("/api/arena/word-chain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive,
          body: JSON.stringify({
            action: "leave",
            code: targetRoom.roomCode,
            playerId: myPlayerId,
            backupTransferCode: readBackupTransferCode(),
          }),
        });
        if (!keepalive && res.ok) {
          const data = (await res.json()) as WordChainApiResponse;
          if (data.player) {
            setGuestPlayer(data.player);
            saveCachedGuestProfile(data.player);
          }
        }
      } catch {
        return;
      }
    },
    [myPlayerId]
  );

  useEffect(() => {
    const onPageHide = () => {
      void flushLeavePoints(room, true);
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [flushLeavePoints, room]);

  const handleCreateRoom = () => {
    setLastReward(null);
    void callWordChainAction({ action: "create", targetTurns }, "create");
  };

  const handleQuickPlayBot = async () => {
    setLastReward(null);
    const created = await callWordChainAction(
      { action: "create", targetTurns },
      "quick_bot"
    );
    const code = created?.room?.roomCode;
    if (!code) return;
    await callWordChainAction({ action: "fill_bot", code }, "quick_bot");
    await callWordChainAction(
      { action: "start", code, autoFillBot: true },
      "quick_bot"
    );
  };

  const handleJoinRoom = () => {
    const cleaned = joinCodeInput.trim().toUpperCase();
    if (cleaned.length !== 6) {
      setErrorMsg("Please enter a valid 6-character room code.");
      return;
    }
    setLastReward(null);
    void callWordChainAction({ action: "join", code: cleaned }, "join");
  };

  const handleFillBotInLobby = () => {
    if (!room) return;
    void callWordChainAction({ action: "fill_bot", code: room.roomCode }, "fill_bot");
  };

  const handleStartMatch = () => {
    if (!room) return;
    setLastReward(null);
    void callWordChainAction({ action: "start", code: room.roomCode }, "start");
  };

  const handleCopyCode = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.roomCode);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      return;
    }
  };

  const handleToggleMic = () => {
    if (isRecording) {
      speechControllerRef.current?.stop();
      setIsRecording(false);
      return;
    }
    setSpeechError(null);
    const controller = startSpeechRecognition({
      onStart: () => {
        setIsRecording(true);
      },
      onTranscript: (text) => {
        const cleaned = text.replace(/[.,!?]+$/g, "").trim();
        setWordInput(cleaned);
      },
      onEnd: () => {
        setIsRecording(false);
      },
      onError: (msg) => {
        setSpeechError(msg);
        setIsRecording(false);
      },
    });
    if (controller) {
      speechControllerRef.current = controller;
    }
  };

  const handleSubmitWord = async () => {
    if (!room || room.status !== "active") return;
    if (!isMyTurn) return;
    const trimmed = wordInput.trim();
    if (!trimmed) {
      setErrorMsg(`Speak or enter a word starting with '${room.requiredChar}'.`);
      return;
    }
    if (isRecording) {
      speechControllerRef.current?.stop();
      setIsRecording(false);
    }

    const data = await callWordChainAction(
      {
        action: "turn",
        code: room.roomCode,
        playerId: myPlayerId,
        word: trimmed,
      },
      "turn"
    );
    if (!data?.turnResult) return;

    const tr = data.turnResult;
    if (!tr.valid) {
      if (tr.foulDetected) {
        triggerFoulEffects(tr.reason);
      } else {
        setTurnBanner({ text: tr.reason, tone: "error" });
      }
      return;
    }

    setWordInput("");

    if (tr.comboTriggered) {
      playComboChime(tr.streak);
      setTurnBanner({
        text: tr.botMove
          ? `${tr.reason} Syntax Bot survived with "${tr.botMove.word.toUpperCase()}" -> next '${tr.botMove.word[tr.botMove.word.length - 1].toUpperCase()}'`
          : tr.reason,
        tone: "combo",
      });
      return;
    }

    if (tr.isItTerm) {
      playComboChime(tr.streak);
      setTurnBanner({
        text: tr.botMove
          ? `IT-TERM x2 (+${tr.pointsEarned} pts)! Syntax Bot countered with "${tr.botMove.word.toUpperCase()}"`
          : tr.reason,
        tone: "it",
      });
      return;
    }

    setTurnBanner({
      text: tr.botMove
        ? `Accepted "${tr.word.toUpperCase()}" (+${tr.pointsEarned} pts) • Bot played "${tr.botMove.word.toUpperCase()}"`
        : tr.reason,
      tone: "info",
    });
  };

  const handleResetRoom = async () => {
    if (!room) return;
    speechControllerRef.current?.abort();
    setIsRecording(false);
    setWordInput("");
    setShowFinisher(false);
    setLastReward(null);
    setTurnBanner(null);
    setSegfaultShake(false);
    flushedRoomRef.current = room.roomCode;
    await callWordChainAction(
      { action: "reset", code: room.roomCode, playerId: myPlayerId },
      "reset"
    );
    flushedRoomRef.current = null;
    void syncGuestProfile();
  };

  const performLeave = (skipReward = false) => {
    const leavingRoom = room;
    speechControllerRef.current?.abort();
    setIsRecording(false);
    setRoom(null);
    setWordInput("");
    setShowFinisher(false);
    setLastReward(null);
    setTurnBanner(null);
    setSegfaultShake(false);
    if (!skipReward) {
      void flushLeavePoints(leavingRoom, true);
    }
  };

  const handleLeaveRoom = () =>
    requestArenaLeave({
      gameId: "word-chain",
      roomCode: room?.roomCode ?? null,
      isActive: room?.status === "active",
      performLeave,
    });

  const urgency = useMemo(() => {
    if (!room || room.status !== "active") return 0;
    return Math.max(
      0,
      Math.min(1, 1 - fuseRemainingSec / Math.max(1, fuseTotalSec))
    );
  }, [fuseRemainingSec, fuseTotalSec, room]);

  const bombStage = useMemo(() => {
    if (room?.status === "finished" && room.explodedPlayerId) {
      return {
        label: "SEGFAULT",
        ringColor: "#F43F5E",
        borderClass: "border-rose-500",
        textClass: "text-rose-400",
        glowStyle: "0 0 48px rgba(244, 63, 94, 0.85)",
      };
    }
    if (urgency >= 0.75) {
      return {
        label: "CRITICAL",
        ringColor: "#F43F5E",
        borderClass: "border-rose-500",
        textClass: "text-rose-400",
        glowStyle: "0 0 44px rgba(244, 63, 94, 0.75)",
      };
    }
    if (urgency >= 0.45) {
      return {
        label: "OVERHEATING",
        ringColor: "#FBBF24",
        borderClass: "border-amber-400",
        textClass: "text-amber-300",
        glowStyle: "0 0 34px rgba(251, 191, 36, 0.55)",
      };
    }
    return {
      label: "ARMED",
      ringColor: "#22D3EE",
      borderClass: "border-cyan-400",
      textClass: "text-cyan-300",
      glowStyle: "0 0 28px rgba(34, 211, 238, 0.42)",
    };
  }, [room?.explodedPlayerId, room?.status, urgency]);

  const ringRadius = 62;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const fuseProgress = Math.max(0, Math.min(1, 1 - urgency));
  const strokeDashoffset = ringCircumference * (1 - fuseProgress);

  const orderedMoves = useMemo(
    () => (room ? [...room.history].reverse() : []),
    [room]
  );

  const explodedPlayer = useMemo(
    () => room?.players.find((p) => p.id === room.explodedPlayerId) ?? null,
    [room]
  );

  const didIWin = Boolean(room && room.winnerId === myPlayerId);

  const estimatedCoins = useMemo(() => {
    if (lastReward) return lastReward.awardedCoins;
    if (!room) return 0;
    const myMoves = room.history.filter((m) => m.playerId === myPlayerId).length;
    if (didIWin && myPlayer) {
      const itBonus = Math.min(5, myPlayer.itTermsCount ?? 0);
      const streakBonus = room.maxItStreak >= 2 ? 2 : 0;
      return Math.max(5, Math.min(12, 5 + itBonus + streakBonus));
    }
    if (myMoves >= 2) return Math.min(5, Math.floor(myMoves / 2));
    return 0;
  }, [didIWin, lastReward, myPlayer, myPlayerId, room]);

  return (
    <div className={`space-y-6 ${segfaultShake ? "bomb-segfault-shake" : ""}`}>
      <style>{`
        @keyframes bombSegfaultShake {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          15% { transform: translate(-10px, 6px) rotate(-1deg); }
          30% { transform: translate(10px, -6px) rotate(1deg); }
          45% { transform: translate(-8px, -4px) rotate(-0.8deg); }
          60% { transform: translate(8px, 4px) rotate(0.8deg); }
          75% { transform: translate(-4px, 2px) rotate(-0.4deg); }
        }
        .bomb-segfault-shake {
          animation: bombSegfaultShake 0.55s cubic-bezier(0.36, 0.07, 0.19, 0.97);
        }
      `}</style>

      {foulFlash && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 pointer-events-none bg-rose-600/30 animate-pulse"
        />
      )}

      <VictoryFinisherOverlay
        finisherId={equippedCosmetics.victory_finisher}
        active={showFinisher}
        title="BOMB DEFUSED • VICTORY!"
        subtitle={`Syntax Bomb survived ${room?.turnCount ?? 0} turns • ${myPlayer?.score ?? 0} pts`}
        onComplete={() => setShowFinisher(false)}
      />

      <section className="liquid-glass-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/45 text-cyan-200 text-[11px] font-mono font-bold">
              <Bomb className="w-3.5 h-3.5 text-cyan-300" />
              <span>SYNTAX BOMB • TECH WORD CHAIN</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Syntax Bomb: Tech Word Chain
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Chain English words starting with the previous word&apos;s final
              letter before the fuse hits{" "}
              <strong className="text-rose-300">0.0s SEGFAULT!</strong> Chain 2
              IT terms for an{" "}
              <strong className="text-amber-300">x2 Combo</strong> that cuts
              the opponent&apos;s fuse to{" "}
              <strong className="text-cyan-300">5s</strong>!
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start sm:self-center">
            <button
              type="button"
              onClick={toggleMuteSfx}
              aria-label={sfxMuted ? "Unmute SFX" : "Mute SFX"}
              className={`liquid-glass-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
                sfxMuted ? "text-slate-400" : "text-white"
              }`}
            >
              {sfxMuted ? (
                <>
                  <VolumeX className="w-4 h-4 text-rose-300" />
                  <span>SFX Muted</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-300" />
                  <span>SFX On</span>
                </>
              )}
            </button>

            <div className="liquid-glass-pill flex items-center gap-3 px-3.5 py-2">
              <DiscordAvatarFrame
                equippedId={equippedCosmetics.avatar_decoration}
                fallbackRing={guestPlayer?.equippedRing}
                size="sm"
                micActive={isRecording}
              >
                <div className="w-8 h-8 rounded-full bg-cyan-600/80 border border-cyan-300/40 text-white flex items-center justify-center text-xs font-mono font-bold">
                  {(guestPlayer?.displayName ?? "DV").slice(0, 2).toUpperCase()}
                </div>
              </DiscordAvatarFrame>
              <div className="text-xs">
                <div className="font-bold text-white">
                  {guestPlayer?.displayName ?? "Guest Engineer"}
                </div>
                <div className="font-mono text-amber-200 flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-amber-300" />
                  <span>{guestPlayer?.itCoins ?? 0} IT-Coins</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/15 border border-rose-400/40 text-rose-200 text-xs font-medium">
            <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </section>

      {!room && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 liquid-glass-card p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
                1. Battle Syntax Bot or Host a Bomb Room
              </h2>
              <span className="text-xs font-mono text-slate-400">
                960+ A-Z IT Terms
              </span>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-mono font-bold uppercase text-slate-300">
                Bot Overload Threshold (Turns)
              </div>
              <div className="flex flex-wrap gap-2.5">
                {[8, 12, 16, 20].map((turns) => {
                  const active = targetTurns === turns;
                  return (
                    <button
                      key={turns}
                      type="button"
                      onClick={() => setTargetTurns(turns)}
                      className={`px-4 py-2 rounded-xl border font-mono text-xs font-bold transition-all ${
                        active
                          ? "bg-cyan-500/25 border-cyan-400/60 shadow-[0_0_16px_rgba(6,182,212,0.3)] text-cyan-100"
                          : "bg-slate-950/50 border-white/15 text-slate-300 hover:border-cyan-400/45"
                      }`}
                    >
                      {turns} Turns
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/55 border border-white/15 space-y-2 text-xs text-slate-200">
              <div className="font-mono font-bold uppercase text-white">
                Fuse &amp; Combo Mechanics
              </div>
              <ul className="space-y-1">
                <li>
                  • Base fuse starts at{" "}
                  <strong className="text-cyan-300">12.0s</strong> and accelerates
                  with urgent ticking from Cyan -&gt; Amber -&gt; Crimson.
                </li>
                <li>
                  • Play any IT term (e.g. <code className="text-cyan-200">docker</code>,{" "}
                  <code className="text-cyan-200">redis</code>, <code className="text-cyan-200">kernel</code>) for{" "}
                  <strong className="text-amber-300">x2 Points</strong>. Chain{" "}
                  <strong className="text-white">2 IT terms in a row</strong> to trigger the{" "}
                  <strong className="text-cyan-300">5s Fuse Attack</strong>!
                </li>
                <li>
                  • Repeating words, non-English words, or running down to{" "}
                  <code className="text-rose-200">0.0s</code> triggers a{" "}
                  <strong className="text-rose-300">SEGFAULT!</strong> explosion.
                </li>
              </ul>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleQuickPlayBot}
                disabled={loadingAction !== null}
                className="liquid-btn-primary inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
              >
                <Bot className="w-4 h-4" />
                <span>
                  {loadingAction === "quick_bot"
                    ? "Arming Syntax Bomb..."
                    : "Đấu với Syntax Bot"}
                </span>
              </button>

              <button
                type="button"
                onClick={handleCreateRoom}
                disabled={loadingAction !== null}
                className="liquid-glass-btn inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm disabled:opacity-50"
              >
                <Users className="w-4 h-4 text-cyan-300" />
                <span>
                  {loadingAction === "create"
                    ? "Creating Room..."
                    : "Create 6-Char Room"}
                </span>
              </button>
            </div>
          </section>

          <section className="liquid-glass-card p-5 sm:p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
                2. Join Bomb Room
              </h2>
              <p className="text-xs text-slate-300">
                Enter a 6-character invite code to duel a teammate in Syntax
                Bomb.
              </p>
              <input
                type="text"
                maxLength={6}
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder="BOMB99"
                className="liquid-glass-input w-full px-4 py-3 rounded-xl font-mono text-lg font-bold tracking-[0.25em] text-center uppercase focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleJoinRoom}
              disabled={loadingAction !== null}
              className="liquid-btn-primary w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
            >
              <Users className="w-4 h-4" />
              <span>{loadingAction === "join" ? "Joining..." : "Join Room"}</span>
            </button>
          </section>
        </div>
      )}

      {room && room.status === "lobby" && (
        <section className="liquid-glass-card p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/15">
            <div>
              <div className="text-xs font-mono text-slate-400">BOMB ROOM CODE</div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-2xl font-mono font-bold tracking-[0.2em] text-cyan-200 bg-slate-950/65 px-3 py-1 rounded-lg border border-cyan-400/40">
                  {room.roomCode}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-cyan-500/25 border border-cyan-400/50 text-cyan-200">
                {DYNAMIC_FUSE_RULES.baseFuseSeconds}s BASE FUSE • {DYNAMIC_FUSE_RULES.comboFuseSeconds}s COMBO
              </span>
              <div className="mt-1 font-bold text-sm text-white">
                Seed Word: {room.currentWord.toUpperCase()}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {room.players.map((p) => (
              <div
                key={p.id}
                className="p-4 rounded-xl border border-white/20 bg-slate-950/55 flex items-center gap-3"
              >
                <DiscordAvatarFrame
                  equippedId={
                    p.id === myPlayerId
                      ? equippedCosmetics.avatar_decoration
                      : null
                  }
                  fallbackRing={p.equippedRing}
                  size="sm"
                >
                  <div className="w-9 h-9 rounded-full bg-cyan-600/80 border border-cyan-300/40 text-white flex items-center justify-center text-xs font-mono font-bold">
                    {p.isBot ? "AI" : p.displayName.slice(0, 2).toUpperCase()}
                  </div>
                </DiscordAvatarFrame>
                <div className="min-w-0">
                  <div className="text-[11px] font-mono text-slate-400">
                    {p.isBot ? "AI OPPONENT" : p.isHost ? "HOST" : "CHALLENGER"}
                  </div>
                  <div className="font-bold text-sm text-white truncate">
                    {p.displayName}
                  </div>
                </div>
              </div>
            ))}

            {room.players.length < 2 && (
              <div className="p-4 rounded-xl border border-dashed border-white/25 bg-slate-950/35 flex items-center">
                <div className="text-xs font-mono text-slate-400">
                  Waiting for challenger or Syntax Bot...
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleFillBotInLobby}
                disabled={
                  loadingAction !== null || room.players.some((p) => p.isBot)
                }
                className="liquid-glass-btn inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm disabled:opacity-50"
              >
                <Bot className="w-4 h-4 text-cyan-300" />
                <span>
                  {loadingAction === "fill_bot"
                    ? "Adding Syntax Bot..."
                    : "Đấu với Syntax Bot"}
                </span>
              </button>

              <button
                type="button"
                onClick={handleLeaveRoom}
                className="liquid-glass-btn px-3.5 py-2.5 rounded-xl text-xs font-mono text-slate-300 hover:text-white"
              >
                Rời phòng
              </button>
            </div>

            <button
              type="button"
              onClick={handleStartMatch}
              disabled={loadingAction !== null || room.players.length < 2}
              className="liquid-btn-primary inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              <span>
                {loadingAction === "start" ? "Đang chuẩn bị bom..." : "Châm ngòi nổ (Bắt đầu)"}
              </span>
            </button>
          </div>
        </section>
      )}

      {room && room.status === "active" && (
        <div className="space-y-6">
          <section className="liquid-glass-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="liquid-glass-pill px-3 py-1 text-xs font-mono font-bold text-white">
                  ROOM {room.roomCode}
                </span>
                <span className="liquid-glass-pill px-3 py-1 text-xs font-mono font-bold text-cyan-200">
                  TURN {room.turnCount}/{room.targetTurns}
                </span>
                <span className="px-3 py-1 rounded-pill bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-xs font-mono font-bold">
                  {myPlayer?.score ?? 0} PTS
                </span>

                {(myPlayer?.streak ?? room.itComboStreak) >= 2 ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-rose-600 text-white text-xs font-mono font-extrabold border border-amber-300/60 animate-pulse shadow-[0_0_20px_rgba(245,158,11,0.5)]">
                    <Flame className="w-4 h-4 fill-yellow-200" />
                    <span>
                      IT-TERM x2 COMBO ({myPlayer?.streak ?? room.itComboStreak}
                      x) • 5s FUSE ATTACK!
                    </span>
                  </span>
                ) : (
                  <span className="liquid-glass-pill inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-bold text-slate-200">
                    <Zap className="w-3.5 h-3.5 text-amber-300" />
                    <span>
                      IT Streak {myPlayer?.streak ?? 0}/2 for 5s Fuse
                    </span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {room.players.map((p) => (
                  <div
                    key={p.id}
                    className={`px-3 py-1 rounded-pill border text-xs font-mono font-bold ${
                      room.currentTurnPlayerId === p.id
                        ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-100"
                        : "liquid-glass-pill text-slate-300"
                    }`}
                  >
                    {p.isBot ? "Bot" : p.displayName.split(" ")[0]}: {p.score}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/20 bg-slate-950/90 backdrop-blur-xl text-white p-6 sm:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.55)] space-y-6">
            <div className="flex flex-col md:flex-row items-center justify-around gap-8">
              <div className="flex flex-col items-center space-y-3">
                <div
                  className={`relative w-44 h-44 flex items-center justify-center rounded-full border-4 ${bombStage.borderClass} bg-slate-900 transition-transform duration-150`}
                  style={{
                    transform: `scale(${1 + urgency * 0.22})`,
                    boxShadow: bombStage.glowStyle,
                  }}
                >
                  <svg
                    className="absolute inset-0 w-full h-full -rotate-90"
                    viewBox="0 0 144 144"
                    aria-hidden="true"
                  >
                    <circle
                      cx="72"
                      cy="72"
                      r={ringRadius}
                      fill="none"
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth="8"
                    />
                    <circle
                      cx="72"
                      cy="72"
                      r={ringRadius}
                      fill="none"
                      stroke={bombStage.ringColor}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={ringCircumference}
                      strokeDashoffset={strokeDashoffset}
                    />
                  </svg>

                  <div className="relative z-10 text-center space-y-1">
                    <Cpu
                      className={`w-7 h-7 mx-auto ${bombStage.textClass} ${
                        urgency >= 0.75 ? "animate-bounce" : ""
                      }`}
                    />
                    <div
                      className={`text-3xl font-mono font-extrabold tracking-tight ${bombStage.textClass}`}
                    >
                      {fuseRemainingSec.toFixed(1)}s
                    </div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-300">
                      {bombStage.label}
                    </div>
                  </div>
                </div>

                <div className="text-xs font-mono text-slate-300">
                  Fuse Limit: {fuseTotalSec}s{" "}
                  {room.lastAttackFuseSeconds === 5 ? "• 5s COMBO HIT!" : ""}
                </div>
              </div>

              <div className="flex flex-col items-center md:items-start space-y-4 text-center md:text-left">
                <div className="space-y-1">
                  <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-400">
                    TỪ VỪA NỐI TRONG CHUỖI
                  </div>
                  <div className="inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 font-mono text-2xl sm:text-3xl font-extrabold tracking-wider">
                    <span>
                      {room.currentWord.slice(0, -1).toUpperCase()}
                      <span className={bombStage.textClass}>
                        {room.currentWord.slice(-1).toUpperCase()}
                      </span>
                    </span>
                    <ArrowRight className="w-5 h-5 text-slate-400" />
                  </div>
                  {getVietnameseGloss(room.currentWord) && (
                    <div className="text-xs text-cyan-300 font-sans">
                      Nghĩa từ này: {getVietnameseGloss(room.currentWord)}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-400">
                    CHỮ CÁI BẮT BUỘC TIẾP THEO
                  </div>
                  <div className="inline-flex items-center gap-4">
                    <div
                      className={`w-20 h-20 rounded-2xl border-2 ${bombStage.borderClass} bg-slate-900 flex items-center justify-center text-5xl font-mono font-extrabold ${bombStage.textClass}`}
                      style={{ boxShadow: bombStage.glowStyle }}
                    >
                      {room.requiredChar}
                    </div>
                    <div className="text-xs text-slate-300 max-w-[210px]">
                      {isMyTurn
                        ? `Đến lượt bạn! Nói hoặc gõ 1 từ tiếng Anh mới bắt đầu bằng chữ "${room.requiredChar}".`
                        : "Đang chờ đối thủ nối từ để gỡ bom..."}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {turnBanner && (
              <div
                className={`px-4 py-3 rounded-xl border text-xs font-mono font-bold flex items-center gap-2 ${
                  turnBanner.tone === "combo"
                    ? "bg-amber-500/20 border-amber-400 text-amber-200"
                    : turnBanner.tone === "it"
                      ? "bg-cyan-500/20 border-cyan-400 text-cyan-200"
                      : turnBanner.tone === "foul" || turnBanner.tone === "error"
                        ? "bg-rose-500/25 border-rose-400 text-rose-200"
                        : "bg-slate-800 border-slate-600 text-slate-200"
                }`}
              >
                <Terminal className="w-4 h-4 shrink-0" />
                <span>{turnBanner.text}</span>
              </div>
            )}
          </section>

          <section className="liquid-glass-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-white">
                  Gỡ bom — Nói hoặc gõ 1 từ tiếng Anh
                </div>
                <div className="text-xs text-slate-300">
                  Phải bắt đầu bằng chữ{" "}
                  <strong className="text-cyan-300 font-mono">
                    {room.requiredChar}
                  </strong>{" "}
                  và chưa lặp lại. Dùng từ vựng CNTT được thưởng{" "}
                  <strong className="text-amber-300">x2 điểm</strong>!
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleMic}
                disabled={!isMyTurn}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all disabled:opacity-50 ${
                  isRecording
                    ? "liquid-btn-danger animate-mic-listening"
                    : "liquid-glass-btn"
                }`}
              >
                {isRecording ? (
                  <>
                    <Square className="w-3.5 h-3.5" />
                    <span>Dừng Mic</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5 text-cyan-300" />
                    <span>Nói từ (Mic)</span>
                  </>
                )}
              </button>
            </div>

            {speechError && (
              <div className="text-xs text-rose-300 font-medium">
                {speechError}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                autoFocus
                disabled={!isMyTurn || loadingAction === "turn"}
                value={wordInput}
                onChange={(e) => setWordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleSubmitWord();
                  }
                }}
                placeholder={
                  isMyTurn
                    ? `Gõ từ tiếng Anh bắt đầu bằng chữ ${room.requiredChar}...`
                    : "Đang chờ đối thủ..."
                }
                className="liquid-glass-input flex-1 px-4 py-3 rounded-xl font-mono text-base font-bold focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleSubmitWord}
                disabled={!isMyTurn || loadingAction !== null}
                className="liquid-btn-primary inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>
                  {loadingAction === "turn" ? "Đang kiểm tra..." : "Gửi từ"}
                </span>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/15">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-slate-300">
                <span className="font-bold text-white">Đã dùng:</span>
                {room.usedWords.slice(-8).map((w) => (
                  <span
                    key={w}
                    className="px-2 py-0.5 rounded bg-slate-950/60 border border-white/15 text-cyan-200"
                  >
                    {w}
                  </span>
                ))}
              </div>

              <button
                type="button"
                onClick={handleLeaveRoom}
                className="liquid-glass-btn px-3.5 py-1.5 rounded-xl text-xs font-mono text-slate-300 hover:text-white"
              >
                Rời phòng
              </button>
            </div>
          </section>

          {orderedMoves.length > 0 && (
            <section className="liquid-glass-card p-5 space-y-3">
              <div className="text-xs font-mono font-bold uppercase text-slate-300">
                Live Chain Reactor Feed ({orderedMoves.length} moves)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                {orderedMoves.map((move) => (
                  <div
                    key={move.id}
                    className={`px-3.5 py-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                      move.comboTriggered
                        ? "bg-amber-500/15 border-amber-400/55"
                        : move.isItTerm
                          ? "bg-cyan-500/15 border-cyan-400/55"
                          : "bg-slate-950/55 border-white/15"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-white truncate">
                        {move.word.toUpperCase()}{" "}
                        {move.isItTerm && (
                          <span className="ml-1 px-1.5 py-0.5 rounded bg-cyan-500/25 border border-cyan-400/50 text-cyan-200 text-[10px]">
                            x2 IT
                          </span>
                        )}
                        {move.comboTriggered && (
                          <span className="ml-1 px-1.5 py-0.5 rounded bg-rose-500/30 border border-rose-400/50 text-rose-200 text-[10px]">
                            5s FUSE
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-300 truncate">
                        {move.displayName}
                      </div>
                    </div>
                    <span className="font-mono font-bold text-emerald-300 shrink-0">
                      +{move.pointsEarned}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {room && room.status === "finished" && (
        <section className="liquid-glass-card p-6 space-y-6">
          {room.explodedPlayerId && (
            <div className="p-5 rounded-2xl bg-slate-950/90 border-2 border-rose-500 text-white shadow-[0_0_32px_rgba(244,63,94,0.45)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-rose-600 flex items-center justify-center shrink-0">
                  <Skull className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="text-xs font-mono font-bold uppercase tracking-widest text-rose-400">
                    SEGFAULT! CORE DUMPED AT 0.0s
                  </div>
                  <div className="text-lg sm:text-xl font-extrabold text-white">
                    {explodedPlayer?.displayName ?? "Node"} overloaded and
                    exploded!
                  </div>
                </div>
              </div>
              <span className="px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-400 font-mono text-xs font-bold text-rose-200 self-start sm:self-center">
                EXIT CODE 139 (SIGSEGV)
              </span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/15">
            <div className="space-y-1">
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono font-bold ${
                  didIWin
                    ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-200"
                    : "bg-rose-500/20 border-rose-400/50 text-rose-200"
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {didIWin ? "SURVIVOR • VICTORY!" : "DETONATED • ROUND OVER"}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-white">
                Syntax Bomb — Post-Explosion Report
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-slate-950/55 border border-white/15 rounded-xl px-4 py-2.5 text-center">
                <div className="text-[10px] font-mono font-bold text-slate-400">
                  YOUR SCORE
                </div>
                <div className="text-2xl font-mono font-bold text-white">
                  {myPlayer?.score ?? 0} pts
                </div>
              </div>
              <div className="bg-amber-500/15 border border-amber-400/40 rounded-xl px-4 py-2.5 text-center">
                <div className="text-[10px] font-mono font-bold text-amber-300">
                  IT-COINS EARNED
                </div>
                <div className="text-2xl font-mono font-bold text-amber-200">
                  +{estimatedCoins}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-slate-950/50 border border-white/15 text-center">
              <div className="text-[11px] font-mono text-slate-400">TURNS</div>
              <div className="text-xl font-mono font-bold text-white">
                {room.turnCount}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-950/50 border border-white/15 text-center">
              <div className="text-[11px] font-mono text-slate-400">IT TERMS</div>
              <div className="text-xl font-mono font-bold text-cyan-300">
                {myPlayer?.itTermsCount ?? 0}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-950/50 border border-white/15 text-center">
              <div className="text-[11px] font-mono text-slate-400">MAX COMBO</div>
              <div className="text-xl font-mono font-bold text-amber-300">
                {room.maxItStreak}x
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-950/50 border border-white/15 text-center">
              <div className="text-[11px] font-mono text-slate-400">CHAIN LEN</div>
              <div className="text-xl font-mono font-bold text-white">
                {room.usedWords.length} words
              </div>
            </div>
          </div>

          {orderedMoves.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-950/50 border border-white/15 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-white">
                <Trophy className="w-4 h-4 text-amber-300" />
                <span>Word Chain History</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {room.usedWords.map((w, idx) => (
                  <span
                    key={`${w}-${idx}`}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/15 text-xs font-mono font-bold text-cyan-200"
                  >
                    {idx + 1}. {w.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleResetRoom}
                className="liquid-btn-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Play Again</span>
              </button>
              <button
                type="button"
                onClick={handleLeaveRoom}
                className="liquid-glass-btn px-4 py-2.5 rounded-xl font-mono font-bold text-xs"
              >
                Back to Lobby
              </button>
            </div>

            <Link
              href="/shop"
              className="liquid-btn-success inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Spend IT-Coins in Shop</span>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

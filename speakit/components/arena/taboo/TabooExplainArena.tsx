"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Ban,
  Bot,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  Flame,
  Lightbulb,
  Mic,
  Play,
  RotateCcw,
  Send,
  ShoppingBag,
  SkipForward,
  Sparkles,
  Square,
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
import { InteractiveEnglishText } from "@/components/common/EnglishWordTooltip";
import type { ArenaRewardSummary, TabooRoomState } from "@/lib/arena-moderator";
import { findTabooCardById, type TabooCard } from "@/lib/arena-three-games-data";
import {
  DEFAULT_EQUIPPED_COSMETICS,
  normalizeEquippedCosmetics,
} from "@/lib/cosmetics";
import type { PublicGuestPlayer } from "@/lib/db";
import {
  isSfxMuted,
  playBuzzerFoul,
  playComboChime,
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

interface TabooTurnResult {
  guessedCorrectly: boolean;
  aiGuess: string;
  reaction: string;
  tabooViolated: boolean;
  violatedWords: string[];
  foulDetected: boolean;
  foulType: "none" | "vietnamese" | "taboo";
  streak: number;
  feverMode: boolean;
  multiplier: 1 | 2;
  pointsAwarded: number;
  cardAdvanced: boolean;
}

interface TabooApiResponse {
  ok?: boolean;
  room?: TabooRoomState;
  currentCard?: TabooCard;
  turnResult?: TabooTurnResult;
  reward?: ArenaRewardSummary | null;
  player?: PublicGuestPlayer | null;
  error?: string;
}

function formatClock(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function TabooExplainArena() {
  const [guestPlayer, setGuestPlayer] = useState<PublicGuestPlayer | null>(null);
  const [sfxMuted, setSfxMutedState] = useState(false);

  const [room, setRoom] = useState<TabooRoomState | null>(null);
  const [currentCard, setCurrentCard] = useState<TabooCard | null>(null);
  const [lastReward, setLastReward] = useState<ArenaRewardSummary | null>(null);

  const [targetCards, setTargetCards] = useState<number>(5);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [clueInput, setClueInput] = useState("");
  const [guessInput, setGuessInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const [timeLeftSec, setTimeLeftSec] = useState(150);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [flipBadgeText, setFlipBadgeText] = useState<string | null>(null);
  const [foulFlash, setFoulFlash] = useState(false);
  const [foulBanner, setFoulBanner] = useState<string | null>(null);
  const [showFinisher, setShowFinisher] = useState(false);

  const speechControllerRef = useRef<SpeechController | null>(null);
  const timerRoomRef = useRef<string | null>(null);
  const timeoutSentRef = useRef<string | null>(null);
  const finisherRoomRef = useRef<string | null>(null);
  const flushedRoomRef = useRef<string | null>(null);
  const flipTimeoutRef = useRef<number | null>(null);
  const foulTimeoutRef = useRef<number | null>(null);

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
      if (flipTimeoutRef.current) window.clearTimeout(flipTimeoutRef.current);
      if (foulTimeoutRef.current) window.clearTimeout(foulTimeoutRef.current);
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

  const activeCard = useMemo(() => {
    if (currentCard) return currentCard;
    if (room?.currentCardId) return findTabooCardById(room.currentCardId);
    return null;
  }, [currentCard, room?.currentCardId]);

  const isMultiHuman = useMemo(() => {
    if (!room) return false;
    const humans = room.players.filter((p) => !p.isBot);
    const hasBot = room.players.some((p) => p.isBot);
    return humans.length > 1 && !hasBot;
  }, [room]);

  const isExplainer = useMemo(() => {
    if (!room) return true;
    if (!isMultiHuman) return true;
    return room.currentTurnPlayerId === myPlayerId;
  }, [isMultiHuman, myPlayerId, room]);

  const toggleMuteSfx = () => {
    const next = !sfxMuted;
    setSfxMuted(next);
    setSfxMutedState(next);
  };

  const applyServerResponse = useCallback(
    (data: TabooApiResponse) => {
      if (data.player) {
        setGuestPlayer(data.player);
        saveCachedGuestProfile(data.player);
      }
      if (data.reward) {
        setLastReward(data.reward);
      }
      if (data.currentCard) {
        setCurrentCard(data.currentCard);
      }
      if (data.room) {
        setRoom(data.room);
      }
    },
    []
  );

  const callTabooAction = useCallback(
    async (payload: Record<string, unknown>, actionKey: string) => {
      setErrorMsg(null);
      setLoadingAction(actionKey);
      try {
        const res = await fetch("/api/arena/taboo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            backupTransferCode: readBackupTransferCode(),
            displayName: guestPlayer?.displayName,
            playerId: guestPlayer?.id ?? payload.playerId,
          }),
        });
        const data = (await res.json()) as TabooApiResponse;
        if (!res.ok) {
          setErrorMsg(data.error ?? "Unable to process Tech Taboo request.");
          return null;
        }
        applyServerResponse(data);
        return data;
      } catch {
        setErrorMsg("Network error connecting to Tech Taboo server.");
        return null;
      } finally {
        setLoadingAction(null);
      }
    },
    [applyServerResponse, guestPlayer?.displayName, guestPlayer?.id]
  );

  useEffect(() => {
    if (!room) return;
    if (room.status === "lobby") {
      timerRoomRef.current = null;
      timeoutSentRef.current = null;
      finisherRoomRef.current = null;
      setCardFlipped(false);
      setFlipBadgeText(null);
      setFoulBanner(null);
      return;
    }

    if (room.status === "active") {
      if (timerRoomRef.current !== room.roomCode) {
        timerRoomRef.current = room.roomCode;
        timeoutSentRef.current = null;
        flushedRoomRef.current = null;
        setTimeLeftSec(room.turnSeconds || 90);
      }
    }

    if (room.status === "finished") {
      if (finisherRoomRef.current !== room.roomCode) {
        finisherRoomRef.current = room.roomCode;
        if (room.solvedCount > 0) {
          playVictoryFanfare();
          setShowFinisher(true);
        }
        void syncGuestProfile();
      }
    }
  }, [room, syncGuestProfile]);

  useEffect(() => {
    if (!room || room.status !== "active" || loadingAction !== null) return;
    const interval = window.setInterval(() => {
      setTimeLeftSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [loadingAction, room]);

  useEffect(() => {
    if (!room || room.status !== "active") return;
    if (timeLeftSec > 0) return;
    if (timeoutSentRef.current === room.roomCode) return;
    timeoutSentRef.current = room.roomCode;
    void callTabooAction(
      {
        action: "timeout",
        code: room.roomCode,
        playerId: myPlayerId,
      },
      "timeout"
    );
  }, [callTabooAction, myPlayerId, room, timeLeftSec]);

  useEffect(() => {
    if (!room || room.status === "finished") return;
    const poll = window.setInterval(async () => {
      try {
        const res = await fetch(
          `/api/arena/taboo?code=${encodeURIComponent(room.roomCode)}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as TabooApiResponse;
        if (data.room) {
          if (data.currentCard) setCurrentCard(data.currentCard);
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
    async (targetRoom: TabooRoomState | null, keepalive = false) => {
      if (
        !targetRoom ||
        targetRoom.status === "finished" ||
        targetRoom.rewardsAwarded ||
        targetRoom.solvedCount <= 0 ||
        flushedRoomRef.current === targetRoom.roomCode
      ) {
        return;
      }
      flushedRoomRef.current = targetRoom.roomCode;
      try {
        const res = await fetch("/api/arena/taboo", {
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
          const data = (await res.json()) as TabooApiResponse;
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

  const triggerFoulEffect = useCallback((message: string) => {
    playBuzzerFoul();
    setFoulFlash(true);
    setFoulBanner(message);
    if (foulTimeoutRef.current) window.clearTimeout(foulTimeoutRef.current);
    foulTimeoutRef.current = window.setTimeout(() => {
      setFoulFlash(false);
    }, 850);
  }, []);

  const triggerCardFlipTransition = useCallback((label: string) => {
    setFlipBadgeText(label);
    setCardFlipped(true);
    if (flipTimeoutRef.current) window.clearTimeout(flipTimeoutRef.current);
    flipTimeoutRef.current = window.setTimeout(() => {
      setCardFlipped(false);
      setFlipBadgeText(null);
    }, 520);
  }, []);

  const handleCreateRoom = () => {
    setLastReward(null);
    void callTabooAction({ action: "create", targetCards }, "create");
  };

  const handleQuickPlayBot = async () => {
    setLastReward(null);
    const created = await callTabooAction(
      { action: "create", targetCards },
      "quick_bot"
    );
    const code = created?.room?.roomCode;
    if (!code) return;
    await callTabooAction({ action: "fill_bot", code }, "quick_bot");
    await callTabooAction(
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
    void callTabooAction({ action: "join", code: cleaned }, "join");
  };

  const handleFillBotInLobby = () => {
    if (!room) return;
    void callTabooAction({ action: "fill_bot", code: room.roomCode }, "fill_bot");
  };

  const handleStartMatch = () => {
    if (!room) return;
    setLastReward(null);
    setTimeLeftSec(room.turnSeconds || 90);
    timerRoomRef.current = room.roomCode;
    timeoutSentRef.current = null;
    void callTabooAction({ action: "start", code: room.roomCode }, "start");
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
        if (isExplainer) {
          setClueInput(text);
        } else {
          setGuessInput(text);
        }
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

  const handleSubmitClue = async () => {
    if (!room || room.status !== "active") return;
    const trimmed = clueInput.trim();
    if (!trimmed) {
      setErrorMsg("Speak or type an English clue without forbidden words.");
      return;
    }
    if (isRecording) {
      speechControllerRef.current?.stop();
      setIsRecording(false);
    }
    setFoulBanner(null);

    const data = await callTabooAction(
      {
        action: "turn",
        code: room.roomCode,
        playerId: myPlayerId,
        clue: trimmed,
      },
      "turn"
    );
    if (!data?.turnResult) return;

    setClueInput("");
    const tr = data.turnResult;
    if (tr.foulDetected || tr.tabooViolated) {
      const foulMessage = tr.tabooViolated
        ? `TABOO VIOLATION! Forbidden word: ${tr.violatedWords.join(", ")}`
        : "VIETNAMESE FOUL! Speak English only — streak reset!";
      triggerFoulEffect(foulMessage);
      if (tr.cardAdvanced) {
        triggerCardFlipTransition("CARD BURNED!");
      }
      return;
    }

    if (tr.guessedCorrectly) {
      playComboChime(tr.streak);
      if (tr.cardAdvanced) {
        triggerCardFlipTransition(
          tr.feverMode ? "FEVER x2 SOLVED!" : "CARD SOLVED!"
        );
      }
    }
  };

  const handleSubmitGuess = async () => {
    if (!room || room.status !== "active") return;
    const trimmedGuess = guessInput.trim();
    if (!trimmedGuess) {
      setErrorMsg("Enter your English guess for the concept.");
      return;
    }
    const latestClue =
      room.feed.length > 0 ? room.feed[room.feed.length - 1].clue : "clue";
    const data = await callTabooAction(
      {
        action: "turn",
        code: room.roomCode,
        playerId: myPlayerId,
        clue: latestClue,
        guess: trimmedGuess,
      },
      "turn"
    );
    if (!data?.turnResult) return;
    setGuessInput("");
    if (data.turnResult.guessedCorrectly) {
      playComboChime(data.turnResult.streak);
      if (data.turnResult.cardAdvanced) {
        triggerCardFlipTransition("CARD SOLVED!");
      }
    }
  };

  const handleSkipCard = async () => {
    if (!room || room.status !== "active") return;
    if (isRecording) {
      speechControllerRef.current?.stop();
      setIsRecording(false);
    }
    const data = await callTabooAction(
      {
        action: "turn",
        code: room.roomCode,
        playerId: myPlayerId,
        skip: true,
      },
      "skip"
    );
    if (data?.turnResult?.cardAdvanced) {
      triggerCardFlipTransition("SKIPPED");
    }
  };

  const handleResetRoom = async () => {
    if (!room) return;
    speechControllerRef.current?.abort();
    setIsRecording(false);
    setClueInput("");
    setGuessInput("");
    setShowFinisher(false);
    setLastReward(null);
    setFoulBanner(null);
    flushedRoomRef.current = room.roomCode;
    await callTabooAction(
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
    setCurrentCard(null);
    setClueInput("");
    setGuessInput("");
    setShowFinisher(false);
    setLastReward(null);
    setFoulBanner(null);
    if (!skipReward) {
      void flushLeavePoints(leavingRoom, true);
    }
  };

  const handleLeaveRoom = () =>
    requestArenaLeave({
      gameId: "taboo",
      roomCode: room?.roomCode ?? null,
      isActive: room?.status === "active",
      performLeave,
    });

  const orderedFeed = useMemo(
    () => (room ? [...room.feed].reverse() : []),
    [room]
  );

  const estimatedCoins = useMemo(() => {
    if (lastReward) return lastReward.awardedCoins;
    if (!room || room.solvedCount <= 0) return 0;
    if (room.solvedCount >= room.targetCards) {
      const feverBonus = room.maxStreak >= 3 ? 2 : 0;
      const cleanBonus = room.foulCount === 0 ? 1 : 0;
      const scoreBonus = Math.floor(room.score / 500);
      return Math.max(5, Math.min(12, 5 + feverBonus + cleanBonus + scoreBonus));
    }
    return Math.min(5, room.solvedCount);
  }, [lastReward, room]);

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes tabooShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px) rotate(-0.5deg); }
          40% { transform: translateX(8px) rotate(0.5deg); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        .taboo-foul-shake {
          animation: tabooShake 0.42s ease-in-out;
        }
      `}</style>

      {foulFlash && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 pointer-events-none bg-rose-600/35 animate-pulse"
        />
      )}

      <VictoryFinisherOverlay
        finisherId={equippedCosmetics.victory_finisher}
        active={showFinisher}
        title="EXPLAIN MASTERED!"
        subtitle={`${room?.solvedCount ?? 0}/${room?.targetCards ?? 5} concepts solved • ${room?.score ?? 0} pts`}
        onComplete={() => setShowFinisher(false)}
      />

      <section className="liquid-glass-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300/80 text-amber-800 text-[11px] font-mono font-bold">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>TECH TABOO • EXPLAIN IT LIKE I&apos;M 5</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Explain It Like I&apos;m 5
            </h1>
            <p className="text-xs sm:text-sm text-slate-600">
              Describe IT concepts in plain English without saying the 3 glowing
              red forbidden words. Hit a{" "}
              <strong className="text-sky-700">3-streak</strong> for{" "}
              <strong className="text-amber-700">FEVER MODE 2x</strong>!
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start sm:self-center">
            <button
              type="button"
              onClick={toggleMuteSfx}
              aria-label={sfxMuted ? "Unmute SFX" : "Mute SFX"}
              className={`liquid-glass-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
                sfxMuted ? "text-slate-500" : "text-slate-900"
              }`}
            >
              {sfxMuted ? (
                <>
                  <VolumeX className="w-4 h-4 text-rose-600" />
                  <span>SFX Muted</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-600" />
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
                <div className="w-8 h-8 rounded-full bg-amber-500 border border-amber-300/60 text-white flex items-center justify-center text-xs font-mono font-bold">
                  {(guestPlayer?.displayName ?? "DV").slice(0, 2).toUpperCase()}
                </div>
              </DiscordAvatarFrame>
              <div className="text-xs">
                <div className="font-bold text-slate-900">
                  {guestPlayer?.displayName ?? "Guest Engineer"}
                </div>
                <div className="font-mono text-amber-700 flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-amber-600" />
                  <span>{guestPlayer?.itCoins ?? 0} IT-Coins</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-300/80 text-rose-800 text-xs font-medium">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </section>

      {!room && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 liquid-glass-card p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-900">
                1. Start Solo vs AI Guesser or Host a Room
              </h2>
              <span className="text-xs font-mono text-slate-600">
                50 IT Concept Cards
              </span>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-mono font-bold uppercase text-slate-700">
                Target Cards per Match
              </div>
              <div className="flex flex-wrap gap-2.5">
                {[3, 5, 7, 10].map((count) => {
                  const active = targetCards === count;
                  return (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setTargetCards(count)}
                      className={`px-4 py-2 rounded-xl border font-mono text-xs font-bold transition-all ${
                        active
                          ? "bg-amber-100 border-amber-400/80 shadow-[0_4px_14px_rgba(245,158,11,0.2)] text-amber-900"
                          : "bg-white/80 border-slate-200/85 text-slate-700 hover:border-amber-400/60"
                      }`}
                    >
                      {count} Cards
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white/80 border border-slate-200/85 space-y-2 text-xs text-slate-700">
              <div className="font-mono font-bold uppercase text-slate-900">
                Rules &amp; Combo Multipliers
              </div>
              <ul className="space-y-1">
                <li>
                  • Speak or type plain English clues in 90 seconds without
                  using the 3 glowing red Taboo words (stems caught too!).
                </li>
                <li>
                  • Vietnamese words trigger an instant buzzer foul and reset
                  your streak.
                </li>
                <li>
                  • Solve 3 cards in a row to ignite{" "}
                  <strong className="text-amber-700">FEVER MODE 2x</strong>{" "}
                  points (+500 pts/card) and earn up to +12 IT-Coins!
                </li>
              </ul>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleQuickPlayBot}
                disabled={loadingAction !== null}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-sm border border-amber-300/60 shadow-[0_8px_22px_rgba(245,158,11,0.34),inset_0_1px_1px_rgba(255,255,255,0.45)] transition-all disabled:opacity-50"
              >
                <Bot className="w-4 h-4" />
                <span>
                  {loadingAction === "quick_bot"
                    ? "Summoning AI Guesser..."
                    : "Chơi với AI Guesser Bot"}
                </span>
              </button>

              <button
                type="button"
                onClick={handleCreateRoom}
                disabled={loadingAction !== null}
                className="liquid-glass-btn inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm disabled:opacity-50"
              >
                <Users className="w-4 h-4 text-amber-600" />
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
              <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-900">
                2. Join Room by Code
              </h2>
              <p className="text-xs text-slate-600">
                Enter a 6-character invite code from a friend to team up in
                Explain It Like I&apos;m 5.
              </p>
              <input
                type="text"
                maxLength={6}
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder="TAB123"
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/85">
            <div>
              <div className="text-xs font-mono text-slate-600">TABOO ROOM CODE</div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-2xl font-mono font-bold tracking-[0.2em] text-sky-700 bg-sky-50 px-3 py-1 rounded-lg border border-sky-300/80">
                  {room.roomCode}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
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
              <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-amber-100 border border-amber-300/80 text-amber-800">
                {room.targetCards} CARDS • {room.turnSeconds}s
              </span>
              <div className="mt-1 font-bold text-sm text-slate-900">
                Waiting for Guesser or AI Bot
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {room.players.map((p) => (
              <div
                key={p.id}
                className="p-4 rounded-xl border border-slate-200/85 bg-white/80 flex items-center gap-3"
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
                  <div className="w-9 h-9 rounded-full bg-amber-500 border border-amber-300/60 text-white flex items-center justify-center text-xs font-mono font-bold">
                    {p.isBot ? "AI" : p.displayName.slice(0, 2).toUpperCase()}
                  </div>
                </DiscordAvatarFrame>
                <div className="min-w-0">
                  <div className="text-[11px] font-mono text-slate-600">
                    {p.isBot
                      ? "AI GUESSER"
                      : p.isHost
                        ? "HOST • EXPLAINER"
                        : "TEAMMATE • GUESSER"}
                  </div>
                  <div className="font-bold text-sm text-slate-900 truncate">
                    {p.displayName}
                  </div>
                </div>
              </div>
            ))}

            {room.players.length < 2 && (
              <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-100/70 flex items-center justify-between gap-3">
                <div className="text-xs font-mono text-slate-600">
                  Waiting for 2nd player or AI Guesser Bot...
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
                <Bot className="w-4 h-4 text-amber-600" />
                <span>
                  {loadingAction === "fill_bot"
                    ? "Đang gọi AI đoán chữ..."
                    : "Chơi với AI Guesser Bot"}
                </span>
              </button>

              <button
                type="button"
                onClick={handleLeaveRoom}
                className="liquid-glass-btn px-3.5 py-2.5 rounded-xl text-xs font-mono text-slate-700 hover:text-slate-900"
              >
                Rời phòng
              </button>
            </div>

            <button
              type="button"
              onClick={handleStartMatch}
              disabled={loadingAction !== null || room.players.length < 2}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-sm border border-amber-300/60 shadow-[0_8px_22px_rgba(245,158,11,0.34),inset_0_1px_1px_rgba(255,255,255,0.45)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              <span>
                {loadingAction === "start" ? "Đang vào trận..." : "Bắt đầu đoán thẻ"}
              </span>
            </button>
          </div>
        </section>
      )}

      {room && room.status === "active" && activeCard && (
        <div
          className={`space-y-6 ${foulFlash ? "taboo-foul-shake" : ""}`}
        >
          <section
            className={`liquid-glass-card p-4 sm:p-5 transition-colors ${
              room.feverMode
                ? "!bg-gradient-to-r !from-amber-50/95 !via-orange-50/95 !to-rose-50/95 !border-amber-400/80"
                : ""
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="liquid-glass-pill px-3 py-1 text-xs font-mono font-bold text-slate-900">
                  ROOM {room.roomCode}
                </span>
                <span className="liquid-glass-pill px-3 py-1 text-xs font-mono font-bold text-sky-700">
                  SOLVED {room.solvedCount}/{room.targetCards}
                </span>
                <span className="px-3 py-1 rounded-pill bg-emerald-100 border border-emerald-300/80 text-emerald-800 text-xs font-mono font-bold">
                  {room.score} PTS
                </span>

                {room.feverMode ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-rose-600 text-white text-xs font-mono font-extrabold border border-amber-300/60 animate-pulse shadow-[0_8px_20px_rgba(245,158,11,0.38)]">
                    <Flame className="w-4 h-4 fill-yellow-300 text-yellow-200" />
                    <span>FEVER MODE • 2x STREAK ({room.streak})</span>
                  </span>
                ) : (
                  <span className="liquid-glass-pill inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-bold text-slate-700">
                    <Flame
                      className={`w-3.5 h-3.5 ${
                        room.streak > 0 ? "text-amber-500" : "text-slate-400"
                      }`}
                    />
                    <span>Streak {room.streak}/3 for FEVER 2x</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <div
                  className={`flex items-center gap-2 px-4 py-2 rounded-pill font-mono font-bold text-lg ${
                    timeLeftSec <= 15
                      ? "liquid-btn-danger animate-pulse"
                      : "liquid-glass-pill text-sky-700"
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>{formatClock(timeLeftSec)}</span>
                </div>
              </div>
            </div>

            {foulBanner && (
              <div className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-300 text-xs font-mono font-bold">
                <Ban className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{foulBanner}</span>
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 space-y-5">
              <div style={{ perspective: "1200px" }}>
                <div
                  className="grid"
                  style={{
                    transformStyle: "preserve-3d",
                    transition: "transform 650ms cubic-bezier(0.22, 1, 0.36, 1)",
                    transform: cardFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                  }}
                >
                  <div
                    className={`col-start-1 row-start-1 rounded-2xl p-6 border-2 bg-white/95 backdrop-blur-xl text-slate-900 space-y-6 ${
                      room.feverMode
                        ? "border-amber-400 shadow-[0_12px_36px_rgba(251,146,60,0.25)]"
                        : "border-sky-400/80 shadow-[0_12px_36px_rgba(14,165,233,0.16)]"
                    }`}
                    style={{
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="px-3 py-1 rounded-full bg-sky-100 border border-sky-300/80 text-sky-800 text-xs font-mono font-bold uppercase tracking-wider">
                        {activeCard.category}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-600">
                          Thẻ {Math.min(room.currentCardIndex + 1, room.deckCardIds.length)}
                        </span>
                        {isExplainer && (
                          <button
                            type="button"
                            onClick={() => setCardFlipped(true)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300/80 text-amber-800 text-[11px] font-mono font-semibold hover:bg-amber-100"
                          >
                            <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                            <span>Lật gợi ý tiếng Việt</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {isExplainer ? (
                      <>
                        <div className="text-center space-y-2 py-2">
                          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-sky-700">
                            TỪ CẦN GIẢI THÍCH
                          </div>
                          <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
                            {activeCard.term}
                          </div>
                          <div className="text-[11px] text-slate-600">
                            Chưa hiểu từ này? Bấm &ldquo;Lật gợi ý tiếng Việt&rdquo; ở góc trên.
                          </div>
                        </div>

                        <div className="space-y-2.5">
                          <div className="flex items-center justify-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-rose-600">
                            <Ban className="w-3.5 h-3.5" />
                            <span>TỪ CẤM — KHÔNG ĐƯỢC NÓI!</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {activeCard.tabooWords.map((taboo) => (
                              <div
                                key={taboo}
                                className="px-3 py-3 rounded-xl border-2 border-rose-400 bg-rose-50 text-rose-800 text-center font-mono font-extrabold text-sm uppercase tracking-wide shadow-[0_6px_16px_rgba(244,63,94,0.18)]"
                              >
                                {taboo}
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 space-y-3">
                        <div className="text-xs font-mono uppercase tracking-[0.25em] text-sky-700">
                          GUESSER MODE
                        </div>
                        <div className="text-4xl font-mono font-extrabold tracking-[0.3em] text-slate-600">
                          ?????
                        </div>
                        <p className="text-xs text-slate-600">
                          Read your teammate&apos;s clues in the feed and type
                          your guess below!
                        </p>
                      </div>
                    )}
                  </div>

                  <div
                    className="col-start-1 row-start-1 rounded-2xl p-6 border-2 border-amber-400 bg-white/95 backdrop-blur-xl text-slate-900 shadow-[0_12px_36px_rgba(251,191,36,0.22)] flex flex-col justify-between space-y-5"
                    style={{
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 rounded-full bg-amber-100 border border-amber-300/80 text-amber-800 text-xs font-mono font-bold uppercase">
                        {flipBadgeText ?? "GỢI Ý DỄ HIỂU CHO NGƯỜI MỚI"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCardFlipped(false)}
                        className="px-3 py-1 rounded-lg bg-slate-100 border border-slate-200/85 text-xs font-mono text-slate-700 hover:bg-slate-200"
                      >
                        Lật lại mặt trước
                      </button>
                    </div>

                    {flipBadgeText ? (
                      <div className="text-center py-8 space-y-2">
                        <Zap className="w-10 h-10 text-amber-500 mx-auto animate-bounce" />
                        <div className="text-2xl font-mono font-extrabold text-amber-700">
                          {flipBadgeText}
                        </div>
                        <div className="text-xs text-slate-600">
                          Đang mở thẻ khái niệm tiếp theo...
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-300/80 space-y-1.5">
                          <div className="text-[11px] font-mono uppercase text-amber-800">
                            Nghĩa tiếng Việt dễ hiểu
                          </div>
                          <p className="text-sm text-slate-900">
                            {activeCard.hintVI}
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-mono uppercase text-sky-700">
                            Gợi ý cách diễn đạt an toàn
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {activeCard.acceptableClues.slice(0, 4).map((spark) => (
                              <span
                                key={spark}
                                className="px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200/85 text-sky-800 text-xs font-mono"
                              >
                                {spark}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <section className="liquid-glass-card p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {isExplainer
                        ? "Giải thích khái niệm bằng tiếng Anh đơn giản"
                        : "Nhập từ khóa bạn đoán được"}
                    </div>
                    <div className="text-xs text-slate-600">
                      {isExplainer
                        ? "Dùng Mic nói hoặc gõ câu mô tả tiếng Anh (tránh 3 từ cấm màu đỏ)."
                        : "Đoán đúng thuật ngữ CNTT dựa theo gợi ý mới nhất."}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleMic}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all ${
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
                        <Mic className="w-3.5 h-3.5 text-amber-600" />
                        <span>Nói gợi ý (Mic)</span>
                      </>
                    )}
                  </button>
                </div>

                {speechError && (
                  <div className="text-xs text-rose-700 font-medium">
                    {speechError}
                  </div>
                )}

                {isExplainer ? (
                  <textarea
                    rows={2}
                    value={clueInput}
                    onChange={(e) => setClueInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSubmitClue();
                      }
                    }}
                    placeholder="Ví dụ dễ nói: Think of a super fast drawer next to your desk so you never walk to the slow archive..."
                    className="liquid-glass-input w-full p-3.5 rounded-xl text-sm focus:outline-none"
                  />
                ) : (
                  <input
                    type="text"
                    value={guessInput}
                    onChange={(e) => setGuessInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleSubmitGuess();
                      }
                    }}
                    placeholder="Gõ tên thuật ngữ CNTT..."
                    className="liquid-glass-input w-full p-3.5 rounded-xl text-sm focus:outline-none"
                  />
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {isExplainer && (
                      <button
                        type="button"
                        onClick={handleSkipCard}
                        disabled={loadingAction !== null}
                        className="liquid-glass-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-mono font-bold disabled:opacity-50"
                      >
                        <SkipForward className="w-3.5 h-3.5 text-amber-600" />
                        <span>Bỏ qua thẻ</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleLeaveRoom}
                      className="liquid-glass-btn px-3.5 py-2 rounded-xl text-xs font-mono text-slate-700 hover:text-slate-900"
                    >
                      Rời phòng
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={isExplainer ? handleSubmitClue : handleSubmitGuess}
                    disabled={loadingAction !== null}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-sm border border-amber-300/60 shadow-[0_8px_20px_rgba(245,158,11,0.34),inset_0_1px_1px_rgba(255,255,255,0.45)] transition-all disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      {loadingAction === "turn"
                        ? "AI đang đoán..."
                        : isExplainer
                           ? "Gửi gợi ý"
                          : "Gửi đáp án"}
                    </span>
                  </button>
                </div>
              </section>
            </div>

            <section className="lg:col-span-5 liquid-glass-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-900">
                  <Bot className="w-4 h-4 text-amber-600" />
                  <span>Live Guesser Feed</span>
                </div>
                <span className="text-[11px] font-mono text-slate-600">
                  {room.feed.length} clues
                </span>
              </div>

              {orderedFeed.length === 0 ? (
                <div className="p-6 rounded-xl bg-white/80 border border-dashed border-slate-300 text-center space-y-2">
                  <Bot className="w-7 h-7 text-amber-500 mx-auto" />
                  <div className="text-xs font-bold text-slate-900">
                    ByteBot is waiting for your first clue!
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Describe the concept simply without saying any red Taboo
                    words.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                  {orderedFeed.map((entry) => (
                    <div
                      key={entry.id}
                      className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                        entry.foulDetected || entry.tabooViolated
                          ? "bg-rose-50 border-rose-300/80"
                          : entry.guessedCorrectly
                            ? "bg-emerald-50 border-emerald-300/80"
                            : "bg-white/80 border-slate-200/85"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 font-mono font-bold">
                        <span className="text-slate-900 truncate">
                          {entry.displayName} • {entry.cardTerm}
                        </span>
                        {entry.guessedCorrectly ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 border border-emerald-300/80 text-emerald-800 text-[10px]">
                            +{entry.pointsAwarded} ({entry.multiplier}x)
                          </span>
                        ) : entry.tabooViolated ? (
                          <span className="px-2 py-0.5 rounded bg-rose-100 border border-rose-300/80 text-rose-800 text-[10px]">
                            TABOO FOUL
                          </span>
                        ) : entry.foulDetected ? (
                          <span className="px-2 py-0.5 rounded bg-rose-100 border border-rose-300/80 text-rose-800 text-[10px]">
                            VI FOUL
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px]">
                            MISS
                          </span>
                        )}
                      </div>
                      <p className="text-slate-800">
                        &ldquo;<InteractiveEnglishText text={entry.clue} />&rdquo;
                      </p>
                      <div className="p-2 rounded-lg bg-slate-100/80 border border-slate-200/85 text-slate-700">
                        <span className="font-mono font-bold text-amber-700">
                          Guesser:
                        </span>{" "}
                        {entry.aiGuess ? (
                          <span className="font-bold text-slate-900">
                            &ldquo;{entry.aiGuess}&rdquo; —{" "}
                          </span>
                        ) : null}
                        <span>{entry.reaction}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {room && room.status === "finished" && (
        <section className="liquid-glass-card p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/85">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300/80 text-emerald-800 text-xs font-mono font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {room.solvedCount >= room.targetCards
                    ? "DECK CLEARED • VICTORY"
                    : "ROUND FINISHED"}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900">
                Explain It Like I&apos;m 5 — Match Recap
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-white/80 border border-slate-200/85 rounded-xl px-4 py-2.5 text-center">
                <div className="text-[10px] font-mono font-bold text-slate-600">
                  FINAL SCORE
                </div>
                <div className="text-2xl font-mono font-bold text-slate-900">
                  {room.score} pts
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-300/80 rounded-xl px-4 py-2.5 text-center">
                <div className="text-[10px] font-mono font-bold text-amber-700">
                  IT-COINS EARNED
                </div>
                <div className="text-2xl font-mono font-bold text-amber-800">
                  +{estimatedCoins}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-white/80 border border-slate-200/85 text-center">
              <div className="text-[11px] font-mono text-slate-600">SOLVED</div>
              <div className="text-xl font-mono font-bold text-slate-900">
                {room.solvedCount}/{room.targetCards}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white/80 border border-slate-200/85 text-center">
              <div className="text-[11px] font-mono text-slate-600">MAX STREAK</div>
              <div className="text-xl font-mono font-bold text-amber-700">
                {room.maxStreak}x
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white/80 border border-slate-200/85 text-center">
              <div className="text-[11px] font-mono text-slate-600">FOULS</div>
              <div className="text-xl font-mono font-bold text-rose-600">
                {room.foulCount}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white/80 border border-slate-200/85 text-center">
              <div className="text-[11px] font-mono text-slate-600">FEVER 2x</div>
              <div className="text-xl font-mono font-bold text-emerald-700">
                {room.maxStreak >= 3 ? "UNLOCKED" : "NOT HIT"}
              </div>
            </div>
          </div>

          {orderedFeed.length > 0 && (
            <div className="p-4 rounded-xl bg-white/80 border border-slate-200/85 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-slate-900">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span>Clue &amp; Guess Log</span>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {orderedFeed.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-100/80 border border-slate-200/85 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-mono font-bold text-slate-900">
                        {entry.cardTerm}:
                      </span>{" "}
                      <span className="text-slate-700">&ldquo;{entry.clue}&rdquo;</span>
                    </div>
                    <span
                      className={`font-mono font-bold ${
                        entry.guessedCorrectly
                          ? "text-emerald-700"
                          : "text-rose-600"
                      }`}
                    >
                      {entry.guessedCorrectly
                        ? `+${entry.pointsAwarded} pts`
                        : entry.tabooViolated
                          ? "TABOO"
                          : "MISS"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleResetRoom}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-sm border border-amber-300/60 shadow-[0_8px_20px_rgba(245,158,11,0.34),inset_0_1px_1px_rgba(255,255,255,0.45)]"
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
              className="liquid-btn-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm"
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

"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bot,
  Check,
  Clock,
  Code2,
  Coins,
  Copy,
  Crown,
  Flame,
  GitPullRequest,
  Mic,
  Play,
  RotateCcw,
  Send,
  Shield,
  ShoppingBag,
  Sparkles,
  Square,
  Swords,
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
import type {
  ArenaRewardSummary,
  DuelRoomState,
  DuelTurnLog,
} from "@/lib/arena-moderator";
import {
  DUEL_TOPICS,
  type DuelStance,
  type DuelTopic,
  findDuelTopicById,
} from "@/lib/arena-three-games-data";
import {
  DEFAULT_EQUIPPED_COSMETICS,
  normalizeEquippedCosmetics,
} from "@/lib/cosmetics";
import type { PublicGuestPlayer } from "@/lib/db";
import {
  isSfxMuted,
  playBuzzerFoul,
  playCriticalHit,
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
import { playTtsAudio, stopActiveTts } from "@/lib/tts-player";

interface DuelTurnResult {
  playerTurn?: DuelTurnLog | null;
  botTurn?: DuelTurnLog | null;
  criticalHit?: boolean;
  foulDetected?: boolean;
  winnerId?: string | null;
}

interface DuelApiResponse {
  ok?: boolean;
  room?: DuelRoomState;
  topic?: DuelTopic;
  turnResult?: DuelTurnResult;
  reward?: ArenaRewardSummary | null;
  player?: PublicGuestPlayer | null;
  error?: string;
}

const SPARK_OFFSETS = [
  { x: "-52px", y: "-38px" },
  { x: "54px", y: "-42px" },
  { x: "-68px", y: "10px" },
  { x: "70px", y: "14px" },
  { x: "-34px", y: "44px" },
  { x: "38px", y: "46px" },
];

export function CodeReviewDuelArena() {
  const [guestPlayer, setGuestPlayer] = useState<PublicGuestPlayer | null>(null);
  const [sfxMuted, setSfxMutedState] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<string>(DUEL_TOPICS[0].id);
  const [selectedStance, setSelectedStance] = useState<DuelStance>("author");
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [room, setRoom] = useState<DuelRoomState | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const [turnTimeLeft, setTurnTimeLeft] = useState(45);
  const [transcriptInput, setTranscriptInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isTtsPlaying, setIsTtsPlaying] = useState(false);
  const [activeTtsText, setActiveTtsText] = useState<string | null>(null);

  const [critFx, setCritFx] = useState<{ label: string; damage: number } | null>(null);
  const [foulFx, setFoulFx] = useState<string | null>(null);
  const [lastReward, setLastReward] = useState<ArenaRewardSummary | null>(null);
  const [showFinisher, setShowFinisher] = useState(false);

  const speechControllerRef = useRef<SpeechController | null>(null);
  const turnTimerKeyRef = useRef<string | null>(null);
  const timeoutFiredKeyRef = useRef<string | null>(null);
  const finisherTriggeredRef = useRef<string | null>(null);
  const seenLogIdsRef = useRef<Set<string>>(new Set());
  const ttsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const critTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const foulTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leftRoomFlushedRef = useRef<string | null>(null);
  const guestPlayerRef = useRef<PublicGuestPlayer | null>(null);

  useEffect(() => {
    guestPlayerRef.current = guestPlayer;
  }, [guestPlayer]);

  const applyPlayerSync = useCallback((nextPlayer?: PublicGuestPlayer | null) => {
    if (!nextPlayer) return;
    setGuestPlayer(nextPlayer);
    saveCachedGuestProfile(nextPlayer);
  }, []);

  const syncGuestProfile = useCallback(async () => {
    const cached = readCachedGuestProfile();
    if (cached) {
      setGuestPlayer(cached);
    }
    try {
      const session = await initOrHydrateGuestSession(readBackupTransferCode());
      if (session.mode === "online" && session.player) {
        applyPlayerSync(session.player);
      }
    } catch {
    }
  }, [applyPlayerSync]);

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
      stopActiveTts();
      speechControllerRef.current?.abort();
      if (ttsTimerRef.current) clearTimeout(ttsTimerRef.current);
      if (critTimerRef.current) clearTimeout(critTimerRef.current);
      if (foulTimerRef.current) clearTimeout(foulTimerRef.current);
    };
  }, [syncGuestProfile]);

  const equippedCosmetics = useMemo(
    () =>
      guestPlayer?.equippedCosmetics
        ? normalizeEquippedCosmetics(guestPlayer.equippedCosmetics)
        : DEFAULT_EQUIPPED_COSMETICS,
    [guestPlayer]
  );

  const activeTopic: DuelTopic = useMemo(() => {
    if (room) {
      return findDuelTopicById(room.topicId);
    }
    return findDuelTopicById(selectedTopicId);
  }, [room, selectedTopicId]);

  const myPlayer = useMemo(() => {
    if (!room) return null;
    if (guestPlayer?.id) {
      const byId = room.players.find((p) => p.id === guestPlayer.id);
      if (byId) return byId;
    }
    const byStance = room.players.find(
      (p) => !p.isBot && p.stance === selectedStance
    );
    if (byStance) return byStance;
    return room.players.find((p) => !p.isBot) ?? null;
  }, [room, guestPlayer?.id, selectedStance]);

  const authorSlot = useMemo(
    () => room?.players.find((p) => p.stance === "author") ?? null,
    [room]
  );

  const reviewerSlot = useMemo(
    () => room?.players.find((p) => p.stance === "reviewer") ?? null,
    [room]
  );

  const isBotRoom = Boolean(room?.players.some((p) => p.isBot));
  const isMyTurn = Boolean(
    room &&
      room.status === "active" &&
      (isBotRoom || !myPlayer || room.currentTurnPlayerId === myPlayer.id)
  );

  const triggerCritFx = useCallback((label: string, damage: number) => {
    playCriticalHit();
    setCritFx({ label, damage });
    if (critTimerRef.current) clearTimeout(critTimerRef.current);
    critTimerRef.current = setTimeout(() => setCritFx(null), 1300);
  }, []);

  const triggerFoulFx = useCallback((message: string) => {
    playBuzzerFoul();
    setFoulFx(message);
    if (foulTimerRef.current) clearTimeout(foulTimerRef.current);
    foulTimerRef.current = setTimeout(() => setFoulFx(null), 1800);
  }, []);

  const speakRebuttal = useCallback(
    (text: string, stance: DuelStance, delayMs = 0) => {
      if (!text.trim()) return;
      if (ttsTimerRef.current) {
        clearTimeout(ttsTimerRef.current);
        ttsTimerRef.current = null;
      }
      const persona = stance === "reviewer" ? "lead_us_male" : "client_uk";
      const runSpeak = () => {
        setActiveTtsText(text);
        setIsTtsPlaying(true);
        playTtsAudio({
          text,
          persona,
          rate: 1.0,
          onEnd: () => setIsTtsPlaying(false),
          onError: () => setIsTtsPlaying(false),
        });
      };
      if (delayMs > 0) {
        ttsTimerRef.current = setTimeout(runSpeak, delayMs);
      } else {
        runSpeak();
      }
    },
    []
  );

  const stopRebuttalAudio = useCallback(() => {
    if (ttsTimerRef.current) {
      clearTimeout(ttsTimerRef.current);
      ttsTimerRef.current = null;
    }
    stopActiveTts();
    setIsTtsPlaying(false);
  }, []);

  const handleToggleSfxMute = () => {
    const next = !sfxMuted;
    setSfxMuted(next);
    setSfxMutedState(next);
  };

  const postDuelAction = useCallback(
    async (payload: Record<string, unknown>, actionKey: string): Promise<DuelApiResponse | null> => {
      setErrorMsg(null);
      setLoadingAction(actionKey);
      try {
        const currentGuest = guestPlayerRef.current;
        const res = await fetch("/api/arena/duel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            backupTransferCode: readBackupTransferCode(),
            displayName: currentGuest?.displayName,
            playerId: payload.playerId ?? currentGuest?.id,
          }),
        });
        const data = (await res.json()) as DuelApiResponse;
        if (!res.ok) {
          setErrorMsg(data.error ?? "Unable to process duel action.");
          return null;
        }
        if (data.player) {
          applyPlayerSync(data.player);
        }
        if (data.reward) {
          setLastReward(data.reward);
        }
        if (data.turnResult?.playerTurn?.id) {
          seenLogIdsRef.current.add(data.turnResult.playerTurn.id);
        }
        if (data.turnResult?.botTurn?.id) {
          seenLogIdsRef.current.add(data.turnResult.botTurn.id);
        }
        if (payload.action === "timeout" && data.room?.history) {
          data.room.history.forEach((entry) => seenLogIdsRef.current.add(entry.id));
        }
        if (data.room) {
          setRoom(data.room);
        }
        return data;
      } catch {
        setErrorMsg("Network error connecting to Code Review Duel server.");
        return null;
      } finally {
        setLoadingAction(null);
      }
    },
    [applyPlayerSync]
  );

  const handleCreateRoom = () => {
    seenLogIdsRef.current.clear();
    setLastReward(null);
    leftRoomFlushedRef.current = null;
    void postDuelAction(
      {
        action: "create",
        topicId: selectedTopicId,
        stance: selectedStance,
      },
      "create"
    );
  };

  const handleQuickBotMatch = async () => {
    seenLogIdsRef.current.clear();
    setLastReward(null);
    leftRoomFlushedRef.current = null;
    const created = await postDuelAction(
      {
        action: "create",
        topicId: selectedTopicId,
        stance: selectedStance,
      },
      "quick_bot"
    );
    const code = created?.room?.roomCode;
    if (!code) return;
    const filled = await postDuelAction(
      {
        action: "fill_bot",
        code,
        roomCode: code,
      },
      "quick_bot"
    );
    if (!filled?.room) return;
    await postDuelAction(
      {
        action: "start",
        code,
        roomCode: code,
        autoFillBot: true,
      },
      "quick_bot"
    );
  };

  const handleJoinRoom = () => {
    const cleaned = joinCodeInput.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(cleaned)) {
      setErrorMsg("Please enter a valid 6-character duel room code.");
      return;
    }
    seenLogIdsRef.current.clear();
    setLastReward(null);
    leftRoomFlushedRef.current = null;
    void postDuelAction(
      {
        action: "join",
        code: cleaned,
        roomCode: cleaned,
      },
      "join"
    );
  };

  const handleFillBot = () => {
    if (!room) return;
    void postDuelAction(
      {
        action: "fill_bot",
        code: room.roomCode,
        roomCode: room.roomCode,
      },
      "fill_bot"
    );
  };

  const handleStartDuel = () => {
    if (!room) return;
    seenLogIdsRef.current.clear();
    setLastReward(null);
    void postDuelAction(
      {
        action: "start",
        code: room.roomCode,
        roomCode: room.roomCode,
      },
      "start"
    );
  };

  const flushLeaveReward = useCallback(
    async (targetRoom: DuelRoomState | null, keepalive = false) => {
      if (
        !targetRoom ||
        targetRoom.status !== "active" ||
        targetRoom.rewardsAwarded ||
        leftRoomFlushedRef.current === targetRoom.roomCode
      ) {
        return;
      }
      leftRoomFlushedRef.current = targetRoom.roomCode;
      const actor =
        targetRoom.players.find((p) => p.id === guestPlayerRef.current?.id) ??
        targetRoom.players.find((p) => !p.isBot);
      try {
        const res = await fetch("/api/arena/duel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive,
          body: JSON.stringify({
            action: "leave",
            code: targetRoom.roomCode,
            roomCode: targetRoom.roomCode,
            playerId: actor?.id ?? guestPlayerRef.current?.id,
            backupTransferCode: readBackupTransferCode(),
          }),
        });
        if (!keepalive && res.ok) {
          const data = (await res.json()) as DuelApiResponse;
          if (data.player) {
            applyPlayerSync(data.player);
          }
        }
      } catch {
      }
    },
    [applyPlayerSync]
  );

  useEffect(() => {
    const handlePageHide = () => {
      void flushLeaveReward(room, true);
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [flushLeaveReward, room]);

  const performLeave = (skipReward = false) => {
    const leavingRoom = room;
    stopRebuttalAudio();
    speechControllerRef.current?.abort();
    setIsRecording(false);
    setTranscriptInput("");
    setShowFinisher(false);
    setCritFx(null);
    setFoulFx(null);
    setLastReward(null);
    setRoom(null);
    seenLogIdsRef.current.clear();
    turnTimerKeyRef.current = null;
    timeoutFiredKeyRef.current = null;
    finisherTriggeredRef.current = null;
    if (!skipReward) {
      void flushLeaveReward(leavingRoom, true);
    }
  };

  const handleLeaveRoom = () =>
    requestArenaLeave({
      gameId: "duel",
      roomCode: room?.roomCode ?? null,
      isActive: room?.status === "active",
      performLeave,
    });

  const handleResetDuel = () => {
    if (!room) return;
    stopRebuttalAudio();
    speechControllerRef.current?.abort();
    setIsRecording(false);
    setTranscriptInput("");
    setShowFinisher(false);
    setCritFx(null);
    setFoulFx(null);
    setLastReward(null);
    seenLogIdsRef.current.clear();
    turnTimerKeyRef.current = null;
    timeoutFiredKeyRef.current = null;
    finisherTriggeredRef.current = null;
    leftRoomFlushedRef.current = null;
    void postDuelAction(
      {
        action: "reset",
        code: room.roomCode,
        roomCode: room.roomCode,
        topicId: selectedTopicId,
      },
      "reset"
    );
  };

  const handleCopyCode = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {
    }
  };

  const handleToggleMic = () => {
    if (!isMyTurn) return;
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
        setTranscriptInput(text);
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

  const handleSubmitArgument = async () => {
    if (!room || room.status !== "active" || !isMyTurn) return;
    const trimmed = transcriptInput.trim();
    if (!trimmed) {
      setErrorMsg("Speak into your mic or enter your English rebuttal first.");
      return;
    }

    if (isRecording) {
      speechControllerRef.current?.stop();
      setIsRecording(false);
    }

    const data = await postDuelAction(
      {
        action: "turn",
        code: room.roomCode,
        roomCode: room.roomCode,
        playerId: myPlayer?.id ?? guestPlayer?.id,
        transcript: trimmed,
      },
      "turn"
    );

    if (!data) return;

    const pTurn = data.turnResult?.playerTurn;
    const bTurn = data.turnResult?.botTurn;
    if (pTurn?.id) seenLogIdsRef.current.add(pTurn.id);
    if (bTurn?.id) seenLogIdsRef.current.add(bTurn.id);

    const anyCrit = Boolean(
      data.turnResult?.criticalHit || pTurn?.criticalHit || bTurn?.criticalHit
    );
    const anyFoul = Boolean(data.turnResult?.foulDetected || pTurn?.foulDetected);

    if (anyFoul) {
      triggerFoulFx(pTurn?.feedback ?? "Vietnamese detected! -18 HP credibility.");
    } else if (anyCrit) {
      const critSource = pTurn?.criticalHit ? pTurn : bTurn;
      triggerCritFx(
        pTurn?.criticalHit ? "CRITICAL HIT!" : "BOT CRITICAL HIT!",
        critSource?.damageDealt ?? 26
      );
    }

    if (bTurn?.transcript) {
      speakRebuttal(bTurn.transcript, bTurn.stance, anyCrit || anyFoul ? 450 : 0);
    }

    setTranscriptInput("");
  };

  const handleTimeoutTurn = useCallback(async () => {
    if (!room || room.status !== "active") return;
    const targetPlayerId = myPlayer?.id ?? room.currentTurnPlayerId ?? guestPlayer?.id;
    const data = await postDuelAction(
      {
        action: "timeout",
        code: room.roomCode,
        roomCode: room.roomCode,
        playerId: targetPlayerId ?? undefined,
      },
      "timeout"
    );
    if (!data?.room) return;
    const latestLogs = data.room.history.slice(-2);
    latestLogs.forEach((entry) => seenLogIdsRef.current.add(entry.id));
    triggerFoulFx("Turn timer expired! -18 HP credibility.");
    const botEntry = latestLogs.find((entry) => entry.isBot);
    if (botEntry?.transcript) {
      speakRebuttal(botEntry.transcript, botEntry.stance, 450);
    }
  }, [
    guestPlayer?.id,
    myPlayer?.id,
    postDuelAction,
    room,
    speakRebuttal,
    triggerFoulFx,
  ]);

  useEffect(() => {
    if (!room) {
      turnTimerKeyRef.current = null;
      return;
    }

    if (room.status === "lobby") {
      turnTimerKeyRef.current = null;
      timeoutFiredKeyRef.current = null;
      finisherTriggeredRef.current = null;
      return;
    }

    if (room.status === "active") {
      const key = `${room.roomCode}:${room.round}:${room.currentTurnPlayerId ?? "none"}`;
      if (turnTimerKeyRef.current !== key) {
        turnTimerKeyRef.current = key;
        setTurnTimeLeft(room.turnSeconds || 45);
      }

      const unseen = room.history.filter((entry) => !seenLogIdsRef.current.has(entry.id));
      if (unseen.length > 0) {
        unseen.forEach((entry) => seenLogIdsRef.current.add(entry.id));
        const opponentEntry = [...unseen]
          .reverse()
          .find((entry) => entry.playerId !== myPlayer?.id);
        if (opponentEntry) {
          if (opponentEntry.foulDetected) {
            triggerFoulFx(opponentEntry.feedback);
          } else if (opponentEntry.criticalHit) {
            triggerCritFx("CRITICAL HIT!", opponentEntry.damageDealt);
          }
          if (opponentEntry.transcript && opponentEntry.transcript !== "[Turn timer expired]") {
            speakRebuttal(
              opponentEntry.transcript,
              opponentEntry.stance,
              opponentEntry.criticalHit || opponentEntry.foulDetected ? 450 : 0
            );
          }
        }
      }
    }

    if (room.status === "finished") {
      const finishKey = `${room.roomCode}:${room.history.length}`;
      if (finisherTriggeredRef.current !== finishKey) {
        finisherTriggeredRef.current = finishKey;
        playVictoryFanfare();
        setShowFinisher(true);
        void syncGuestProfile();
      }
    }
  }, [
    myPlayer?.id,
    room,
    speakRebuttal,
    syncGuestProfile,
    triggerCritFx,
    triggerFoulFx,
  ]);

  useEffect(() => {
    if (!room || room.status !== "active" || loadingAction !== null) return;
    const interval = setInterval(() => {
      setTurnTimeLeft((prev) => {
        if (prev <= 1) return 0;
        const next = prev - 1;
        if (isMyTurn && next <= 5 && next > 0) {
          playTick((6 - next) / 5);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isMyTurn, loadingAction, room]);

  useEffect(() => {
    if (!room || room.status !== "active" || !isMyTurn) return;
    if (turnTimeLeft > 0) return;
    const key = `${room.roomCode}:${room.round}:${room.currentTurnPlayerId ?? "none"}`;
    if (timeoutFiredKeyRef.current === key || loadingAction) return;
    timeoutFiredKeyRef.current = key;
    void handleTimeoutTurn();
  }, [handleTimeoutTurn, isMyTurn, loadingAction, room, turnTimeLeft]);

  useEffect(() => {
    if (!room || room.status === "finished") return;
    if (room.status === "active" && isBotRoom) return;
    const poll = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/arena/duel?code=${encodeURIComponent(room.roomCode)}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as DuelApiResponse;
        if (data.room && data.room.roomCode) {
          setRoom(data.room);
        }
        if (data.player) {
          applyPlayerSync(data.player);
        }
      } catch {
      }
    }, 2000);
    return () => clearInterval(poll);
  }, [applyPlayerSync, isBotRoom, room]);

  const latestAuthorLog = useMemo(
    () => [...(room?.history ?? [])].reverse().find((l) => l.stance === "author") ?? null,
    [room?.history]
  );

  const latestReviewerLog = useMemo(
    () =>
      [...(room?.history ?? [])].reverse().find((l) => l.stance === "reviewer") ?? null,
    [room?.history]
  );

  const matchedTopicKeywords = useMemo(() => {
    const matched = new Set<string>();
    if (!room) return matched;
    for (const log of room.history) {
      if (myPlayer && log.playerId !== myPlayer.id) continue;
      for (const kw of log.matchedKeywords) {
        matched.add(kw.toLowerCase());
      }
    }
    return matched;
  }, [myPlayer, room]);

  const winnerPlayer = useMemo(() => {
    if (!room || room.status !== "finished") return null;
    return (
      room.players.find((p) => p.id === room.winnerId) ??
      room.players.find((p) => p.stance === room.winnerStance) ??
      room.players[0] ??
      null
    );
  }, [room]);

  const didHumanWin = Boolean(
    room?.status === "finished" &&
      myPlayer &&
      (room.winnerId === myPlayer.id || room.winnerStance === myPlayer.stance)
  );

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes duelScreenShake {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); }
          15% { transform: translate3d(-7px, -4px, 0) rotate(-0.8deg); }
          30% { transform: translate3d(7px, 4px, 0) rotate(0.8deg); }
          45% { transform: translate3d(-6px, 3px, 0) rotate(-0.6deg); }
          60% { transform: translate3d(5px, -3px, 0) rotate(0.5deg); }
          75% { transform: translate3d(-3px, 2px, 0) rotate(-0.25deg); }
        }
        @keyframes duelSparkBurst {
          0% { opacity: 1; transform: translate(0, 0) scale(1.1); }
          100% { opacity: 0; transform: translate(var(--spark-x), var(--spark-y)) scale(0.25); }
        }
        @keyframes duelCritPop {
          0% { opacity: 0; transform: scale(0.55) rotate(-5deg); }
          25% { opacity: 1; transform: scale(1.12) rotate(2deg); }
          80% { opacity: 1; transform: scale(1) rotate(0deg); }
          100% { opacity: 0; transform: scale(0.92) translateY(-10px); }
        }
        .duel-shake-active {
          animation: duelScreenShake 0.48s cubic-bezier(0.36, 0.07, 0.19, 0.97);
        }
        .duel-spark-particle {
          animation: duelSparkBurst 0.68s ease-out forwards;
        }
        .duel-crit-banner {
          animation: duelCritPop 1.25s ease-out forwards;
        }
      `}</style>

      <VictoryFinisherOverlay
        finisherId={equippedCosmetics.victory_finisher}
        active={showFinisher}
        title={didHumanWin ? "PR DEBATE VICTORY!" : "CODE REVIEW COMPLETE!"}
        subtitle={`${activeTopic.title} • Author ${room?.authorHp ?? 0} HP vs Reviewer ${room?.reviewerHp ?? 0} HP`}
        onComplete={() => setShowFinisher(false)}
      />

      <section className="liquid-glass-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300 text-xs font-mono font-bold">
              <Swords className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
              <span>1V1 CODE REVIEW DUEL • PVP / AI BOT</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Code Review Duel: PR Battleground
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Debate real engineering tradeoffs in English in 30s alternating turns.
              Land sharp keywords for a <strong className="text-amber-700 dark:text-amber-400">CRITICAL HIT!</strong>{" "}
              and avoid Vietnamese (<strong className="text-red-600 dark:text-red-400">-18 HP</strong> foul).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-center">
            <button
              type="button"
              onClick={handleToggleSfxMute}
              aria-label={sfxMuted ? "Unmute arcade sound effects" : "Mute arcade sound effects"}
              className={`liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-bold transition-colors ${
                sfxMuted ? "text-slate-500 dark:text-slate-400" : "text-slate-900 dark:text-slate-100"
              }`}
            >
              {sfxMuted ? (
                <>
                  <VolumeX className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span>SFX Off</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-green-700 dark:text-green-400" />
                  <span>SFX On</span>
                </>
              )}
            </button>

            <div className="inline-flex items-center gap-3 px-3.5 py-2 rounded-full bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
              <DiscordAvatarFrame
                equippedId={equippedCosmetics.avatar_decoration}
                fallbackRing={guestPlayer?.equippedRing}
                size="sm"
                micActive={isRecording}
              >
                <div className="w-8 h-8 rounded-full bg-blue-700 text-white flex items-center justify-center text-xs font-mono font-bold">
                  {(guestPlayer?.displayName ?? "DV").slice(0, 2).toUpperCase()}
                </div>
              </DiscordAvatarFrame>
              <div className="text-xs">
                <div className="font-bold text-slate-900 dark:text-slate-100">
                  {guestPlayer?.displayName ?? "Guest Engineer"}
                </div>
                <div className="font-mono text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                  <span>{guestPlayer?.itCoins ?? 0} IT-Coins</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 px-4 py-2.5 border-l-4 border-l-red-600 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 text-sm font-medium">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </section>

      {(!room || room.status === "lobby") && (
        <div className="space-y-6">
          <section className="liquid-glass-card p-5 space-y-4">
            <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
              1. Pick Your Debate Stance
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 border-t border-b border-slate-200 dark:border-slate-800 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
              <button
                type="button"
                onClick={() => setSelectedStance("author")}
                disabled={Boolean(room)}
                className={`text-left p-4 border-l-4 transition-colors ${
                  selectedStance === "author"
                    ? "border-l-blue-700 bg-blue-50/70 dark:bg-blue-950/30 dark:border-l-blue-500"
                    : "border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40"
                } disabled:opacity-75`}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300">
                    <GitPullRequest className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                    <span>AUTHOR</span>
                  </span>
                  {selectedStance === "author" && (
                    <Check className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                  )}
                </div>
                <div className="mt-2 font-bold text-sm text-slate-900 dark:text-slate-100">PR Author</div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Defend shipping velocity, pragmatic engineering tradeoffs, and why
                  your pull request should merge now.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedStance("reviewer")}
                disabled={Boolean(room)}
                className={`text-left p-4 border-l-4 transition-colors ${
                  selectedStance === "reviewer"
                    ? "border-l-amber-600 bg-amber-50/70 dark:bg-amber-950/30 dark:border-l-amber-500"
                    : "border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40"
                } disabled:opacity-75`}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300">
                    <Shield className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                    <span>REVIEWER</span>
                  </span>
                  {selectedStance === "reviewer" && (
                    <Check className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                  )}
                </div>
                <div className="mt-2 font-bold text-sm text-slate-900 dark:text-slate-100">Staff Reviewer</div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Block risky patterns, challenge hidden production failure modes,
                  and protect long-term maintainability.
                </div>
              </button>
            </div>
          </section>

          {!room ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <section className="lg:col-span-2 liquid-glass-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                    2. Choose Engineering Debate Topic
                  </h2>
                  <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                    {DUEL_TOPICS.length} debates
                  </span>
                </div>

                <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-b border-slate-200 dark:border-slate-800 max-h-[420px] overflow-y-auto">
                  {DUEL_TOPICS.map((topic, index) => {
                    const active = selectedTopicId === topic.id;
                    return (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => setSelectedTopicId(topic.id)}
                        className={`w-full text-left p-3.5 border-l-4 transition-colors flex flex-col justify-between gap-2 ${
                          active
                            ? "border-l-blue-700 bg-blue-50/70 dark:bg-blue-950/30 dark:border-l-blue-500"
                            : "border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-800 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300">
                              #{String(index + 1).padStart(2, "0")}
                            </span>
                            <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                              6 Rounds • 30s/turn
                            </span>
                          </div>
                          <div className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-snug">
                            {topic.title}
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                            {topic.contextVI}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {topic.criticalKeywords.slice(0, 3).map((kw) => (
                            <span
                              key={kw}
                              className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCreateRoom}
                    disabled={Boolean(loadingAction)}
                    className="liquid-glass-btn inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm disabled:opacity-50 transition-colors"
                  >
                    <Users className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                    <span>
                      {loadingAction === "create"
                        ? "Creating Room..."
                        : "Create 6-Char Duel Room"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleQuickBotMatch()}
                    disabled={Boolean(loadingAction)}
                    className="liquid-btn-primary inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-colors disabled:opacity-50"
                  >
                    <Bot className="w-4 h-4" />
                    <span>
                      {loadingAction === "quick_bot"
                        ? "Starting AI Bot..."
                        : "Đấu với AI Bot"}
                    </span>
                  </button>
                </div>
              </section>

              <section className="liquid-glass-card p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                    Or Join by 6-Char Code
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Enter the 6-character duel room code shared by your opponent to
                    claim the open stance.
                  </p>
                  <input
                    type="text"
                    maxLength={6}
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    placeholder="ABC123"
                    className="liquid-glass-input w-full px-4 py-3 rounded-lg font-mono text-lg font-bold tracking-[0.25em] text-center uppercase focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleJoinRoom}
                  disabled={Boolean(loadingAction)}
                  className="liquid-btn-primary w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-colors disabled:opacity-50"
                >
                  <Swords className="w-4 h-4" />
                  <span>{loadingAction === "join" ? "Joining..." : "Join Duel Room"}</span>
                </button>
              </section>
            </div>
          ) : (
            <section className="liquid-glass-card p-5 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="text-xs font-mono text-slate-600 dark:text-slate-400">DUEL ROOM CODE</div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-2xl font-mono font-bold tracking-[0.2em] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-3 py-1 rounded-lg border border-blue-200 dark:border-blue-800">
                      {room.roomCode}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-green-700 dark:text-green-400" />
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

                <div className="text-left sm:text-right max-w-md">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-50 border border-blue-200 text-blue-800 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300">
                    {room.maxRounds} ROUNDS • {room.turnSeconds}S TURN
                  </span>
                  <div className="mt-1 font-bold text-base text-slate-900 dark:text-slate-100">
                    {activeTopic.title}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">{activeTopic.contextVI}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 border-t border-b border-slate-200 dark:border-slate-800 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
                {[
                  { stance: "author" as const, label: "PR Author", slot: authorSlot },
                  { stance: "reviewer" as const, label: "Staff Reviewer", slot: reviewerSlot },
                ].map(({ stance, label, slot }) => (
                  <div
                    key={stance}
                    className={`p-4 ${
                      slot ? "" : "opacity-75"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <DiscordAvatarFrame
                        equippedId={
                          slot && myPlayer?.id === slot.id
                            ? equippedCosmetics.avatar_decoration
                            : null
                        }
                        fallbackRing={slot?.equippedRing}
                        size="sm"
                      >
                        <div
                          className={`w-9 h-9 rounded-full text-white flex items-center justify-center text-xs font-mono font-bold ${
                            stance === "author" ? "bg-blue-700" : "bg-amber-700"
                          }`}
                        >
                          {stance === "author" ? "AU" : "RV"}
                        </div>
                      </DiscordAvatarFrame>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold uppercase text-slate-600 dark:text-slate-400">
                            {label}
                          </span>
                          {slot?.isBot && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-800 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300 text-xs font-mono font-bold">
                              AI BOT
                            </span>
                          )}
                        </div>
                        <div className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                          {slot ? slot.displayName : "Waiting for challenger..."}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleFillBot}
                    disabled={loadingAction === "fill_bot" || room.players.length >= 2}
                    className="liquid-glass-btn inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm disabled:opacity-50 transition-colors"
                  >
                    <Bot className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                    <span>
                      {loadingAction === "fill_bot"
                        ? "Đang gọi AI Bot..."
                        : "Đấu với AI Bot"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLeaveRoom}
                    className="liquid-glass-btn px-3.5 py-2.5 rounded-lg text-sm font-mono text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    Rời phòng
                  </button>
                </div>

                <div className="flex flex-col items-start sm:items-end gap-1.5">
                  <button
                    type="button"
                    onClick={handleStartDuel}
                    disabled={loadingAction === "start" || room.players.length < 2}
                    className="liquid-btn-primary inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play className="w-4 h-4" />
                    <span>
                      {loadingAction === "start" ? "Đang vào trận..." : "Bắt đầu đấu"}
                    </span>
                  </button>
                  {room.players.length < 2 && (
                    <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                      Share room code {room.roomCode} or click Đấu với AI Bot.
                    </span>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {room && room.status === "active" && (
        <div
          className={`relative space-y-6 rounded-xl ${
            critFx ? "duel-shake-active" : ""
          }`}
        >
          {foulFx && (
            <div className="fixed inset-0 pointer-events-none z-40 bg-red-600/20 border-8 border-red-600 animate-pulse" />
          )}

          {critFx && (
            <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
              <div className="relative flex items-center justify-center">
                {SPARK_OFFSETS.map((spark, idx) => (
                  <span
                    key={idx}
                    className="duel-spark-particle absolute w-3.5 h-3.5 rounded-full bg-amber-500 border border-amber-300"
                    style={
                      {
                        "--spark-x": spark.x,
                        "--spark-y": spark.y,
                      } as CSSProperties
                    }
                  />
                ))}
                <div className="duel-crit-banner px-6 py-3 rounded-xl bg-white dark:bg-slate-900 border-2 border-amber-500 shadow-sm flex items-center gap-2.5">
                  <Zap className="w-7 h-7 text-amber-600 fill-amber-500" />
                  <div className="text-center">
                    <div className="text-xl sm:text-2xl font-black tracking-tight text-amber-700 dark:text-amber-400">
                      {critFx.label}
                    </div>
                    <div className="text-xs font-mono font-bold text-red-600 dark:text-red-400">
                      -{critFx.damage} HP CREDIBILITY SHATTERED
                    </div>
                  </div>
                  <Sparkles className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </div>
          )}

          <section className="liquid-glass-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-0.5 rounded-full bg-blue-50 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 text-xs font-mono font-bold text-blue-700 dark:text-blue-300">
                    ROUND {room.round} / {room.maxRounds}
                  </span>
                  <span className="px-3 py-0.5 rounded-full bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300">
                    ROOM {room.roomCode}
                  </span>
                  <span
                    className={`px-3 py-0.5 rounded-full text-xs font-mono font-bold border ${
                      isMyTurn
                        ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/40 dark:border-green-800 dark:text-green-300"
                        : "bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {isMyTurn ? "YOUR TURN TO DEBATE" : "OPPONENT TURN..."}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{activeTopic.title}</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">{activeTopic.contextVI}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {foulFx && (
                  <span className="px-3 py-1 rounded-full bg-red-50 text-red-800 border border-red-300 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800 text-xs font-mono font-bold">
                    {foulFx}
                  </span>
                )}

                <div
                  className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono font-bold text-lg ${
                    foulFx || turnTimeLeft <= 5
                      ? "bg-red-600 text-white"
                      : "bg-blue-50 border border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300"
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>00:{String(turnTimeLeft).padStart(2, "0")}</span>
                </div>

                {(isTtsPlaying || activeTtsText) && (
                  <button
                    type="button"
                    onClick={
                      isTtsPlaying
                        ? stopRebuttalAudio
                        : () =>
                            speakRebuttal(
                              activeTtsText ?? "",
                              myPlayer?.stance === "author" ? "reviewer" : "author"
                            )
                    }
                    className="liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-bold transition-colors"
                  >
                    {isTtsPlaying ? (
                      <>
                        <VolumeX className="w-4 h-4 text-red-600 dark:text-red-400" />
                        <span>Stop Voice</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                        <span>Replay Rebuttal</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs font-mono font-bold">
                <span className="text-blue-700 dark:text-blue-400">
                  AUTHOR MOMENTUM • {room.momentum}%
                </span>
                <span className="text-slate-600 dark:text-slate-400 uppercase">Tug-of-War Credibility</span>
                <span className="text-amber-700 dark:text-amber-400">
                  {100 - room.momentum}% • REVIEWER
                </span>
              </div>
              <div className="relative w-full h-5 rounded-full bg-amber-100 dark:bg-amber-950/40 border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div
                  className="w-full h-full origin-left bg-blue-700 dark:bg-blue-600 transition-transform duration-500 ease-out"
                  style={{ transform: `scaleX(${Math.min(100, Math.max(0, room.momentum)) / 100})` }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 shadow-sm flex items-center justify-center transition-transform duration-500 ease-out"
                  style={{ left: `${Math.min(96, Math.max(4, room.momentum))}%` }}
                >
                  <Swords className="w-3.5 h-3.5 text-slate-900 dark:text-slate-100" />
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section
              className={`liquid-glass-card p-5 space-y-4 transition-colors ${
                room.currentTurnStance === "author" ||
                (isBotRoom && myPlayer?.stance === "author")
                  ? "!border-blue-600 ring-2 ring-blue-600/30"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <DiscordAvatarFrame
                    equippedId={
                      myPlayer?.id === authorSlot?.id
                        ? equippedCosmetics.avatar_decoration
                        : null
                    }
                    fallbackRing={authorSlot?.equippedRing}
                    size="sm"
                    micActive={
                      (isRecording && myPlayer?.stance === "author") ||
                      (isTtsPlaying && authorSlot?.isBot)
                    }
                  >
                    <div className="w-9 h-9 rounded-full bg-blue-700 text-white flex items-center justify-center text-xs font-mono font-bold">
                      AU
                    </div>
                  </DiscordAvatarFrame>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                        {authorSlot?.displayName ?? "PR Author"}
                      </span>
                      {myPlayer?.id === authorSlot?.id && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-800 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300 text-xs font-mono font-bold">
                          YOU
                        </span>
                      )}
                      {authorSlot?.isBot && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300 text-xs font-mono font-bold">
                          BOT
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
                      {authorSlot?.score ?? 0} pts • {authorSlot?.criticalHits ?? 0} Crits
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-lg font-mono font-black text-blue-700 dark:text-blue-400">
                    {room.authorHp} HP
                  </div>
                  <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
                    {authorSlot?.fouls ?? 0} fouls
                  </div>
                </div>
              </div>

              <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 overflow-hidden">
                <div
                  className="w-full h-full origin-left bg-blue-700 dark:bg-blue-600 transition-transform duration-500"
                  style={{ transform: `scaleX(${Math.min(100, Math.max(0, room.authorHp)) / 100})` }}
                />
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs font-mono font-bold uppercase text-blue-800 dark:text-blue-300">
                  <span>Lập trường Tác giả (bảo vệ code)</span>
                  <span className="normal-case font-sans text-blue-700 dark:text-blue-400">Chạm từ để dịch</span>
                </div>
                <p className="text-sm text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                  <InteractiveEnglishText text={activeTopic.authorStance} />
                </p>
              </div>

              {latestAuthorLog && (
                <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs font-mono font-bold">
                    <span className="text-blue-700 dark:text-blue-400">Lập luận mới nhất</span>
                    <div className="flex items-center gap-2">
                      {latestAuthorLog.criticalHit && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300">
                          CRIT -{latestAuthorLog.damageDealt} HP
                        </span>
                      )}
                      {latestAuthorLog.foulDetected && (
                        <span className="px-1.5 py-0.5 rounded bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300">
                          FOUL -18 HP
                        </span>
                      )}
                      {latestAuthorLog.playerId !== myPlayer?.id && (
                        <button
                          type="button"
                          onClick={() =>
                            speakRebuttal(latestAuthorLog.transcript, "author")
                          }
                          aria-label="Play author rebuttal audio"
                          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-slate-800 dark:text-slate-200">&ldquo;{latestAuthorLog.transcript}&rdquo;</p>
                </div>
              )}
            </section>

            <section
              className={`liquid-glass-card p-5 space-y-4 transition-colors ${
                room.currentTurnStance === "reviewer" ||
                (isBotRoom && myPlayer?.stance === "reviewer")
                  ? "!border-amber-600 ring-2 ring-amber-500/30"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <DiscordAvatarFrame
                    equippedId={
                      myPlayer?.id === reviewerSlot?.id
                        ? equippedCosmetics.avatar_decoration
                        : null
                    }
                    fallbackRing={reviewerSlot?.equippedRing}
                    size="sm"
                    micActive={
                      (isRecording && myPlayer?.stance === "reviewer") ||
                      (isTtsPlaying && reviewerSlot?.isBot)
                    }
                  >
                    <div className="w-9 h-9 rounded-full bg-amber-700 text-white flex items-center justify-center text-xs font-mono font-bold">
                      RV
                    </div>
                  </DiscordAvatarFrame>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                        {reviewerSlot?.displayName ?? "Staff Reviewer"}
                      </span>
                      {myPlayer?.id === reviewerSlot?.id && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-800 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300 text-xs font-mono font-bold">
                          YOU
                        </span>
                      )}
                      {reviewerSlot?.isBot && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300 text-xs font-mono font-bold">
                          BOT
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
                      {reviewerSlot?.score ?? 0} pts • {reviewerSlot?.criticalHits ?? 0}{" "}
                      Crits
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-lg font-mono font-black text-amber-700 dark:text-amber-400">
                    {room.reviewerHp} HP
                  </div>
                  <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
                    {reviewerSlot?.fouls ?? 0} fouls
                  </div>
                </div>
              </div>

              <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 overflow-hidden">
                <div
                  className="w-full h-full origin-left bg-amber-600 dark:bg-amber-500 transition-transform duration-500"
                  style={{ transform: `scaleX(${Math.min(100, Math.max(0, room.reviewerHp)) / 100})` }}
                />
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs font-mono font-bold uppercase text-amber-800 dark:text-amber-300">
                  <span>Lập trường Reviewer (phản biện)</span>
                  <span className="normal-case font-sans text-amber-700 dark:text-amber-400">Chạm từ để dịch</span>
                </div>
                <p className="text-sm text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                  <InteractiveEnglishText text={activeTopic.reviewerStance} />
                </p>
              </div>

              {latestReviewerLog && (
                <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs font-mono font-bold">
                    <span className="text-amber-700 dark:text-amber-400">Phản biện mới nhất</span>
                    <div className="flex items-center gap-2">
                      {latestReviewerLog.criticalHit && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300">
                          CRIT -{latestReviewerLog.damageDealt} HP
                        </span>
                      )}
                      {latestReviewerLog.foulDetected && (
                        <span className="px-1.5 py-0.5 rounded bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300">
                          FOUL -18 HP
                        </span>
                      )}
                      {latestReviewerLog.playerId !== myPlayer?.id && (
                        <button
                          type="button"
                          onClick={() =>
                            speakRebuttal(latestReviewerLog.transcript, "reviewer")
                          }
                          aria-label="Play reviewer rebuttal audio"
                          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-slate-800 dark:text-slate-200">
                    &ldquo;{latestReviewerLog.transcript}&rdquo;
                  </p>
                </div>
              )}
            </section>
          </div>

          <section className="liquid-glass-card p-5 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-slate-700 dark:text-slate-300">
                <Flame className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                <span>Từ khóa ăn điểm mạnh (Nói trúng 1-2 từ để đánh Chí mạng!)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeTopic.criticalKeywords.map((kw) => {
                  const hit = matchedTopicKeywords.has(kw.toLowerCase());
                  return (
                    <span
                      key={kw}
                      className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold border ${
                        hit
                          ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/40 dark:border-green-800 dark:text-green-300"
                          : "bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {hit ? `✓ ${kw}` : kw}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <Code2 className="w-5 h-5 text-blue-700 dark:text-blue-400 shrink-0" />
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {isMyTurn
                      ? `Nói ${
                          myPlayer?.stance === "reviewer"
                            ? "nhận xét góp ý code"
                            : "lý do bảo vệ PR của bạn"
                        } (bằng tiếng Anh)`
                      : "Đang chờ đối thủ phản biện..."}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    Bấm Mic để nói hoặc gõ câu tiếng Anh bên dưới trước khi hết 30 giây.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleMic}
                disabled={!isMyTurn || loadingAction === "turn"}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 ${
                  isRecording
                    ? "liquid-btn-danger"
                    : "liquid-glass-btn"
                }`}
              >
                {isRecording ? (
                  <>
                    <Square className="w-4 h-4" />
                    <span>Dừng Mic</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                    <span>Nói lập luận (Mic)</span>
                  </>
                )}
              </button>
            </div>

            {speechError && (
              <div className="text-sm text-red-700 dark:text-red-400 font-medium">{speechError}</div>
            )}

            <textarea
              rows={3}
              value={transcriptInput}
              onChange={(e) => setTranscriptInput(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  void handleSubmitArgument();
                }
              }}
              disabled={!isMyTurn || loadingAction === "turn"}
              placeholder={
                isMyTurn
                  ? "Gợi ý dễ nói: \"I think we should merge safely after adding unit tests...\" (Hoặc bấm Mic để nói)"
                  : "Đang chờ đối thủ trả lời lượt này..."
              }
              className="liquid-glass-input w-full p-3.5 rounded-lg text-sm focus:outline-none disabled:opacity-60"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleResetDuel}
                  className="liquid-glass-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-mono transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Đấu lại ván mới</span>
                </button>

                <button
                  type="button"
                  onClick={handleLeaveRoom}
                  className="liquid-glass-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-mono transition-colors"
                >
                  <span>Rời phòng</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => void handleSubmitArgument()}
                disabled={!isMyTurn || loadingAction === "turn"}
                className="liquid-btn-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>
                  {loadingAction === "turn" ? "Đang chấm..." : "Gửi phản biện"}
                </span>
              </button>
            </div>

            {room.history.length > 0 && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="text-xs font-mono font-bold uppercase text-slate-600 dark:text-slate-400">
                  Live Code Review Feed
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-b border-slate-200 dark:border-slate-800 max-h-64 overflow-y-auto">
                  {[...room.history].reverse().map((entry) => (
                    <div
                      key={entry.id}
                      className={`p-3 border-l-4 text-sm space-y-1 ${
                        entry.foulDetected
                          ? "border-l-red-600 bg-red-50/60 dark:bg-red-950/30"
                          : entry.criticalHit
                            ? "border-l-amber-500 bg-amber-50/60 dark:bg-amber-950/30"
                            : "border-l-slate-300 dark:border-l-slate-700"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs font-bold">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-slate-900 dark:text-slate-100 truncate">{entry.displayName}</span>
                          <span
                            className={`uppercase px-1.5 py-0.5 rounded text-xs text-white ${
                              entry.stance === "author" ? "bg-blue-700" : "bg-amber-700"
                            }`}
                          >
                            {entry.stance}
                          </span>
                          {entry.criticalHit && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300 text-xs">
                              CRITICAL HIT!
                            </span>
                          )}
                          {entry.foulDetected && (
                            <span className="px-1.5 py-0.5 rounded bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300 text-xs">
                              FOUL -18 HP
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-slate-700 dark:text-slate-300">
                            {entry.foulDetected
                              ? "-18 self HP"
                              : `-${entry.damageDealt} HP`}
                          </span>
                          {entry.playerId !== myPlayer?.id &&
                            entry.transcript !== "[Turn timer expired]" && (
                              <button
                                type="button"
                                onClick={() =>
                                  speakRebuttal(entry.transcript, entry.stance)
                                }
                                aria-label="Listen to rebuttal"
                                className="p-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                              >
                                <Volume2 className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                              </button>
                            )}
                        </div>
                      </div>
                      <p className="text-slate-800 dark:text-slate-200">&ldquo;{entry.transcript}&rdquo;</p>
                      <p className="text-slate-600 dark:text-slate-400 font-medium">Judge: {entry.feedback}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {room && room.status === "finished" && (
        <section className="liquid-glass-card p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="space-y-1">
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono font-bold ${
                  didHumanWin
                    ? "bg-green-50 dark:bg-green-950/40 border-green-300 dark:border-green-800 text-green-700 dark:text-green-300"
                    : "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300"
                }`}
              >
                <Crown className="w-4 h-4" />
                <span>
                  {didHumanWin
                    ? "VICTORY : ARGUMENT PREVAILED"
                    : "MATCH CONCLUDED : REVIEW COMPLETE"}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {activeTopic.title}
              </h2>
            </div>

            <div className="flex items-center divide-x divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/60">
              <div className="px-4 py-2 text-center">
                <div className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-400">
                  IT-COIN REWARD
                </div>
                <div className="text-xl font-mono font-bold text-green-700 dark:text-green-400">
                  {lastReward ? `+${lastReward.awardedCoins} IT-Coins` : "Synced"}
                </div>
              </div>
              <div className="px-4 py-2 text-center">
                <div className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-400">
                  YOUR BALANCE
                </div>
                <div className="text-xl font-mono font-bold text-amber-700 dark:text-amber-400">
                  {guestPlayer?.itCoins ?? 0}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border-t-2 border-blue-700 dark:border-blue-500 pt-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-slate-900 dark:text-slate-100">
                <Crown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Duel Winner & Scoreboard</span>
              </div>
              {winnerPlayer && (
                <div className="flex items-center gap-3 py-3 border-b border-slate-200 dark:border-slate-800">
                  <DiscordAvatarFrame
                    equippedId={
                      myPlayer?.id === winnerPlayer.id
                        ? equippedCosmetics.avatar_decoration
                        : null
                    }
                    fallbackRing={winnerPlayer.equippedRing}
                    size="md"
                  >
                    <div
                      className={`w-10 h-10 rounded-full text-white flex items-center justify-center text-xs font-mono font-bold ${
                        winnerPlayer.stance === "author" ? "bg-blue-700" : "bg-red-600"
                      }`}
                    >
                      {winnerPlayer.stance === "author" ? "AU" : "RV"}
                    </div>
                  </DiscordAvatarFrame>
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {winnerPlayer.displayName} (Winner)
                    </div>
                    <div className="text-xs font-mono text-slate-600 dark:text-slate-400 uppercase">
                      Stance: {winnerPlayer.stance} : {winnerPlayer.criticalHits ?? 0}{" "}
                      Critical Hits
                    </div>
                  </div>
                </div>
              )}

              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {room.players.map((p) => {
                  const hp = p.stance === "author" ? room.authorHp : room.reviewerHp;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between text-xs font-mono py-2.5"
                    >
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {p.displayName} ({p.stance})
                      </span>
                      <span className="text-slate-700 dark:text-slate-300">
                        {hp} HP : {p.score} pts : {p.fouls} fouls
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t-2 border-slate-300 dark:border-slate-700 pt-4 space-y-3">
              <div className="text-xs font-mono font-bold uppercase text-slate-900 dark:text-slate-100">
                Tóm tắt ý chính (Chạm từ tiếng Anh để xem nghĩa)
              </div>
              <div className="space-y-3 text-sm text-slate-800 dark:text-slate-200">
                <div className="border-l-2 border-blue-700 dark:border-blue-500 pl-3 py-1">
                  <span className="font-mono font-bold text-blue-700 dark:text-blue-400">TÁC GIẢ: </span>
                  <InteractiveEnglishText text={activeTopic.authorStance} />
                </div>
                <div className="border-l-2 border-red-600 dark:border-red-500 pl-3 py-1">
                  <span className="font-mono font-bold text-red-600 dark:text-red-400">REVIEWER: </span>
                  <InteractiveEnglishText text={activeTopic.reviewerStance} />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {activeTopic.criticalKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs font-mono text-blue-700 dark:text-blue-300"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleResetDuel}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-bold text-sm transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Đấu lại / Đề tài mới</span>
              </button>
              <button
                type="button"
                onClick={handleLeaveRoom}
                className="liquid-glass-btn px-4 py-2.5 rounded-lg text-xs font-mono font-bold transition-colors"
              >
                Về sảnh phòng
              </button>
            </div>

            <Link
              href="/shop"
              className="liquid-btn-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-colors"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Đổi thưởng Cửa hàng IT-Coin</span>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

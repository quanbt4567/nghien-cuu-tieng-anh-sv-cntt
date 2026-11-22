"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  Crown,
  Mic,
  Play,
  Radio,
  RotateCcw,
  Send,
  ShieldAlert,
  ShoppingBag,
  Square,
  Terminal,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";
import { initOrHydrateGuestSession } from "@/app/actions/leaderboard";
import { DiscordAvatarFrame } from "@/components/cosmetics/DiscordAvatarFrame";
import { VictoryFinisherOverlay } from "@/components/cosmetics/VictoryFinisherOverlay";
import { requestArenaLeave } from "@/lib/arena-leave-client";
import {
  InteractiveEnglishText,
  getVietnameseGloss,
} from "@/components/common/EnglishWordTooltip";
import {
  DEFAULT_EQUIPPED_COSMETICS,
  normalizeEquippedCosmetics,
} from "@/lib/cosmetics";
import type { PublicGuestPlayer } from "@/lib/db";
import {
  GUEST_PROFILE_CACHE_KEY,
  GUEST_PROFILE_UPDATED_EVENT,
  readBackupTransferCode,
  readCachedGuestProfile,
  saveCachedGuestProfile,
} from "@/lib/guestClient";
import type { PartyRoomLifecycleStatus } from "@/lib/party-engine";
import {
  PARTY_SCENARIOS,
  PartyRoomState,
  PartyScenario,
  PlayerRole,
  TurnEvaluation,
  findPartyScenarioById,
} from "@/lib/party-scenarios";
import { SpeechController, startSpeechRecognition } from "@/lib/speech";
import { playTtsAudio, stopActiveTts } from "@/lib/tts-player";

const ROLES: Array<{ id: PlayerRole; label: string; badge: string; focus: string }> = [
  {
    id: "frontend",
    label: "Frontend Engineer",
    badge: "FE",
    focus: "Client bundles, retries, headers, and UI state",
  },
  {
    id: "backend",
    label: "Backend Engineer",
    badge: "BE",
    focus: "Transactions, memory heap, API auth, and schemas",
  },
  {
    id: "devops",
    label: "DevOps / SRE",
    badge: "SRE",
    focus: "Connection pools, K8s pods, CDN keys, and rollouts",
  },
];

interface PartyTranscriptEntry {
  playerId: string;
  playerName: string;
  role: PlayerRole;
  transcript: string;
  score: number;
  feedback: string;
  timestamp: string;
}

interface PartyRoomViewState extends Omit<PartyRoomState, "status"> {
  status: PartyRoomLifecycleStatus;
  resolutionProgress?: number;
  remainingSeconds?: number;
  totalPenaltySeconds?: number;
  rewardsAwarded?: boolean;
  mvpDisplayName?: string | null;
  transcript?: PartyTranscriptEntry[];
}

interface EvaluateApiResponse {
  room?: PartyRoomViewState;
  evaluation?: TurnEvaluation;
  resolutionProgress?: number;
  penaltySeconds?: number;
  feedback?: string;
  ctoFeedback?: string;
  mvpPlayerId?: string;
  player?: PublicGuestPlayer | null;
  updatedPlayer?: PublicGuestPlayer | null;
  error?: string;
}

interface RoomApiResponse {
  room?: PartyRoomViewState;
  scenario?: PartyScenario;
  player?: PublicGuestPlayer | null;
  error?: string;
}

function formatClock(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function computeProgressFromRoom(room: PartyRoomViewState | null): number {
  if (!room) return 0;
  if (room.status === "resolved") return 100;
  if (room.evaluations.length === 0) return 0;
  const distinctRoles = new Set(room.evaluations.map((item) => item.role));
  const avgScore =
    room.evaluations.reduce((sum, item) => sum + item.score, 0) /
    room.evaluations.length;
  const roleWeight = Math.min(1, distinctRoles.size / 3) * 70;
  const qualityWeight = Math.min(30, Math.round((avgScore / 100) * 30));
  return Math.min(99, Math.round(roleWeight + qualityWeight));
}

export function PartyWarRoom() {
  const [guestPlayer, setGuestPlayer] = useState<PublicGuestPlayer | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(
    PARTY_SCENARIOS[0].id
  );
  const [selectedRole, setSelectedRole] = useState<PlayerRole>("frontend");
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [room, setRoom] = useState<PartyRoomViewState | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const [resolutionProgress, setResolutionProgress] = useState(0);
  const [timeLeftSec, setTimeLeftSec] = useState(360);
  const [penaltyFlash, setPenaltyFlash] = useState(false);
  const [ctoAlertText, setCtoAlertText] = useState<string | null>(null);
  const [isTtsPlaying, setIsTtsPlaying] = useState(false);

  const [transcriptInput, setTranscriptInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [mvpPlayerId, setMvpPlayerId] = useState<string | null>(null);
  const [showFinisher, setShowFinisher] = useState(false);
  const [lastTurnFeedback, setLastTurnFeedback] = useState<{
    score: number;
    progressPct: number;
    turnNumber: number;
    feedback: string;
    missingKeywords: string[];
    penaltySeconds: number;
  } | null>(null);
  const [ctoHighlight, setCtoHighlight] = useState(false);

  const speechControllerRef = useRef<SpeechController | null>(null);
  const turnStartRef = useRef<number>(Date.now());
  const timerInitializedForRoomRef = useRef<string | null>(null);
  const finisherTriggeredRef = useRef<string | null>(null);
  const briefingSpokenRef = useRef<string | null>(null);
  const flushedRoomRef = useRef<string | null>(null);
  const timeoutTriggeredForRoomRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const ctoBoxRef = useRef<HTMLDivElement | null>(null);
  const composerSectionRef = useRef<HTMLElement | null>(null);
  const ctoHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
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
      mountedRef.current = false;
      if (ctoHighlightTimerRef.current) {
        clearTimeout(ctoHighlightTimerRef.current);
      }
      window.removeEventListener(GUEST_PROFILE_UPDATED_EVENT, handleProfileEvent);
      window.removeEventListener("storage", handleStorage);
      stopActiveTts();
      speechControllerRef.current?.abort();
    };
  }, [syncGuestProfile]);

  const equippedCosmetics = useMemo(
    () =>
      guestPlayer?.equippedCosmetics
        ? normalizeEquippedCosmetics(guestPlayer.equippedCosmetics)
        : DEFAULT_EQUIPPED_COSMETICS,
    [guestPlayer]
  );

  const activeScenario: PartyScenario = useMemo(() => {
    if (room) {
      return findPartyScenarioById(room.scenarioId) ?? PARTY_SCENARIOS[0];
    }
    return findPartyScenarioById(selectedScenarioId) ?? PARTY_SCENARIOS[0];
  }, [room, selectedScenarioId]);

  const speakCtoAlert = useCallback((message: string) => {
    setCtoAlertText(message);
    setIsTtsPlaying(true);
    playTtsAudio({
      text: message,
      persona: "lead_us_male",
      rate: 1.0,
      onEnd: () => setIsTtsPlaying(false),
      onError: () => setIsTtsPlaying(false),
    });
  }, []);

  const stopCtoAudio = useCallback(() => {
    stopActiveTts();
    setIsTtsPlaying(false);
  }, []);

  useEffect(() => {
    if (!room) return;
    if (room.status === "lobby") {
      timerInitializedForRoomRef.current = null;
      finisherTriggeredRef.current = null;
      briefingSpokenRef.current = null;
      timeoutTriggeredForRoomRef.current = null;
      setLastTurnFeedback(null);
      setCtoHighlight(false);
      return;
    }

    if (timerInitializedForRoomRef.current !== room.roomCode) {
      timerInitializedForRoomRef.current = room.roomCode;
      flushedRoomRef.current = null;
      timeoutTriggeredForRoomRef.current = null;
      const initialSeconds =
        room.status === "timed_out"
          ? 0
          : typeof room.remainingSeconds === "number"
            ? Math.max(0, room.remainingSeconds)
            : activeScenario.estimatedMinutes * 60;
      setTimeLeftSec(initialSeconds);
      const initialProgress =
        room.resolutionProgress ?? computeProgressFromRoom(room);
      setResolutionProgress(initialProgress);
      turnStartRef.current = Date.now();
    }

    if (
      room.status !== "resolved" &&
      room.status !== "timed_out" &&
      briefingSpokenRef.current !== room.roomCode
    ) {
      briefingSpokenRef.current = room.roomCode;
      speakCtoAlert(
        `Incident Commander here. ${activeScenario.title}. ${activeScenario.incidentContext} Give me your status update in English.`
      );
    }

    if (room.status === "timed_out") {
      setTimeLeftSec(0);
      stopCtoAudio();
    }

    if (room.status === "resolved") {
      setResolutionProgress(100);
      setLastTurnFeedback(null);
      setCtoHighlight(false);
      if (finisherTriggeredRef.current !== room.roomCode) {
        finisherTriggeredRef.current = room.roomCode;
        setShowFinisher(true);
        void syncGuestProfile();
      }
    }
  }, [room, activeScenario, speakCtoAlert, stopCtoAudio, syncGuestProfile]);

  useEffect(() => {
    if (
      !room ||
      room.status === "lobby" ||
      room.status === "resolved" ||
      room.status === "timed_out" ||
      loadingAction === "evaluate"
    ) {
      return;
    }
    const interval = setInterval(() => {
      setTimeLeftSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [loadingAction, room?.roomCode, room?.status]);

  useEffect(() => {
    if (!room) return;
    const isActive =
      room.status === "briefing" ||
      room.status === "speaking" ||
      room.status === "evaluating";
    if (!isActive || timeLeftSec > 0) return;

    stopCtoAudio();
    speechControllerRef.current?.stop();
    setIsRecording(false);

    if (timeoutTriggeredForRoomRef.current === room.roomCode) return;
    timeoutTriggeredForRoomRef.current = room.roomCode;

    const targetRoomCode = room.roomCode;
    void (async () => {
      try {
        const res = await fetch("/api/party/room", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "timeout",
            code: targetRoomCode,
            roomCode: targetRoomCode,
            role: selectedRole,
            transferCode: readBackupTransferCode(),
            backupTransferCode: readBackupTransferCode(),
            displayName: guestPlayer?.displayName,
          }),
        });
        if (!res.ok || !mountedRef.current) return;
        const data = (await res.json()) as RoomApiResponse;
        const nextRoom = data.room ?? (data as unknown as PartyRoomViewState);
        if (nextRoom && nextRoom.roomCode && mountedRef.current) {
          setRoom(nextRoom);
          if (nextRoom.rewardsAwarded) {
            flushedRoomRef.current = nextRoom.roomCode;
          }
        }
        if (data.player && mountedRef.current) {
          setGuestPlayer(data.player);
          saveCachedGuestProfile(data.player);
        }
      } catch {
      }
    })();
  }, [
    room?.roomCode,
    room?.status,
    timeLeftSec,
    selectedRole,
    guestPlayer?.displayName,
    stopCtoAudio,
  ]);

  useEffect(() => {
    if (!room || room.status === "resolved" || room.status === "timed_out") return;
    const targetRoomCode = room.roomCode;
    const poll = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/party/room?code=${encodeURIComponent(targetRoomCode)}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as RoomApiResponse;
        const nextRoom = data.room ?? (data as unknown as PartyRoomViewState);
        if (nextRoom && nextRoom.roomCode) {
          setRoom(nextRoom);
          if (nextRoom.status === "lobby") {
            setResolutionProgress(0);
            setLastTurnFeedback(null);
            return;
          }
          if (nextRoom.status === "timed_out") {
            setTimeLeftSec(0);
          }
          const nextProgress =
            nextRoom.resolutionProgress ?? computeProgressFromRoom(nextRoom);
          setResolutionProgress((prev) => Math.max(prev, nextProgress));
        }
      } catch {
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [room?.roomCode, room?.status]);

  const callRoomAction = async (
    payload: Record<string, unknown>,
    actionKey: string
  ) => {
    setErrorMsg(null);
    setLoadingAction(actionKey);
    try {
      const res = await fetch("/api/party/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          transferCode: readBackupTransferCode(),
          backupTransferCode: readBackupTransferCode(),
          displayName: guestPlayer?.displayName,
        }),
      });
      const data = (await res.json()) as RoomApiResponse;
      if (!res.ok) {
        setErrorMsg(data.error ?? "Unable to update war room.");
        return;
      }
      const nextRoom = data.room ?? (data as unknown as PartyRoomViewState);
      if (nextRoom && nextRoom.roomCode) {
        setRoom(nextRoom);
      }
    } catch {
      setErrorMsg("Network error connecting to war room server.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCreateRoom = () => {
    void callRoomAction(
      {
        action: "create",
        scenarioId: selectedScenarioId,
        role: selectedRole,
      },
      "create"
    );
  };

  const handleJoinRoom = () => {
    const cleaned = joinCodeInput.trim().toUpperCase();
    if (cleaned.length !== 6) {
      setErrorMsg("Please enter a valid 6-character invite code.");
      return;
    }
    void callRoomAction(
      {
        action: "join",
        code: cleaned,
        roomCode: cleaned,
        role: selectedRole,
      },
      "join"
    );
  };

  const handleFillAi = () => {
    if (!room) return;
    void callRoomAction(
      {
        action: "fill_ai",
        code: room.roomCode,
        roomCode: room.roomCode,
      },
      "fill_ai"
    );
  };

  const handleStartMission = () => {
    if (!room) return;
    void callRoomAction(
      {
        action: "start",
        code: room.roomCode,
        roomCode: room.roomCode,
      },
      "start"
    );
  };

  const flushUnresolvedRoomPoints = useCallback(
    async (targetRoom: PartyRoomViewState | null, keepalive = false) => {
      if (
        !targetRoom ||
        targetRoom.status === "resolved" ||
        targetRoom.rewardsAwarded ||
        targetRoom.teamScore <= 0 ||
        flushedRoomRef.current === targetRoom.roomCode
      ) {
        return;
      }
      flushedRoomRef.current = targetRoom.roomCode;
      try {
        const res = await fetch("/api/party/room", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive,
          body: JSON.stringify({
            action: "leave",
            code: targetRoom.roomCode,
            roomCode: targetRoom.roomCode,
            role: selectedRole,
            transferCode: readBackupTransferCode(),
            backupTransferCode: readBackupTransferCode(),
            displayName: guestPlayer?.displayName,
          }),
        });
        if (!keepalive && res.ok) {
          const data = (await res.json()) as RoomApiResponse;
          if (data.player) {
            setGuestPlayer(data.player);
            saveCachedGuestProfile(data.player);
          }
        }
      } catch {
      }
    },
    [guestPlayer?.displayName, selectedRole]
  );

  useEffect(() => {
    const handlePageHide = () => {
      void flushUnresolvedRoomPoints(room, true);
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [flushUnresolvedRoomPoints, room]);

  const handleResetRoom = () => {
    stopCtoAudio();
    speechControllerRef.current?.abort();
    if (ctoHighlightTimerRef.current) {
      clearTimeout(ctoHighlightTimerRef.current);
    }
    setIsRecording(false);
    setTranscriptInput("");
    setCtoAlertText(null);
    setShowFinisher(false);
    setMvpPlayerId(null);
    setResolutionProgress(0);
    setLastTurnFeedback(null);
    setCtoHighlight(false);
    setTimeLeftSec(activeScenario.estimatedMinutes * 60);
    timeoutTriggeredForRoomRef.current = null;
    if (!room) return;
    flushedRoomRef.current = room.roomCode;
    void callRoomAction(
      {
        action: "reset",
        code: room.roomCode,
        roomCode: room.roomCode,
        role: selectedRole,
      },
      "reset"
    ).then(() => {
      flushedRoomRef.current = null;
      void syncGuestProfile();
    });
  };

  const performLeave = (skipReward = false) => {
    const leavingRoom = room;
    stopCtoAudio();
    speechControllerRef.current?.abort();
    if (ctoHighlightTimerRef.current) {
      clearTimeout(ctoHighlightTimerRef.current);
    }
    setIsRecording(false);
    setRoom(null);
    setTranscriptInput("");
    setCtoAlertText(null);
    setShowFinisher(false);
    setMvpPlayerId(null);
    setResolutionProgress(0);
    setLastTurnFeedback(null);
    setCtoHighlight(false);
    timeoutTriggeredForRoomRef.current = null;
    if (!skipReward) {
      void flushUnresolvedRoomPoints(leavingRoom, true);
    }
  };

  const handleLeaveRoom = () =>
    requestArenaLeave({
      gameId: "party",
      roomCode: room?.roomCode ?? null,
      isActive: Boolean(
        room &&
          (room.status === "briefing" ||
            room.status === "speaking" ||
            room.status === "evaluating")
      ),
      performLeave,
    });

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
    if (
      !room ||
      room.status === "resolved" ||
      room.status === "timed_out" ||
      timeLeftSec <= 0
    ) {
      return;
    }

    if (isRecording) {
      speechControllerRef.current?.stop();
      setIsRecording(false);
      return;
    }

    setSpeechError(null);
    const controller = startSpeechRecognition({
      onStart: () => {
        setIsRecording(true);
        turnStartRef.current = Date.now();
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

  const handleSubmitReport = async () => {
    if (
      !room ||
      room.status === "resolved" ||
      room.status === "timed_out" ||
      timeLeftSec <= 0
    ) {
      return;
    }
    const trimmed = transcriptInput.trim();
    if (!trimmed) {
      setErrorMsg("Speak into your mic or type your English status report first.");
      return;
    }

    if (isRecording) {
      speechControllerRef.current?.stop();
      setIsRecording(false);
    }

    setErrorMsg(null);
    setLoadingAction("evaluate");
    const activePlayer =
      room.players.find((p) => p.role === selectedRole) ?? room.players[0];

    try {
      const res = await fetch("/api/party/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: room.roomCode,
          roomCode: room.roomCode,
          role: selectedRole,
          playerId: activePlayer?.id ?? guestPlayer?.id ?? `guest-${selectedRole}`,
          transcript: trimmed,
          durationMs: Math.max(1000, Date.now() - turnStartRef.current),
          remainingSeconds: timeLeftSec,
          runAiTurns: true,
          transferCode: readBackupTransferCode(),
          backupTransferCode: readBackupTransferCode(),
        }),
      });
      const data = (await res.json()) as EvaluateApiResponse;
      if (!res.ok) {
        setErrorMsg(data.error ?? "Evaluation failed. Please try again.");
        return;
      }

      const penaltySec = data.penaltySeconds ?? 0;
      const effectiveTimeAfter = Math.max(0, timeLeftSec - penaltySec);
      if (penaltySec > 0) {
        setTimeLeftSec((prev) => Math.max(0, prev - penaltySec));
        setPenaltyFlash(true);
        setTimeout(() => setPenaltyFlash(false), 2600);
      }

      let resolvedProgress = resolutionProgress;
      if (data.room) {
        setRoom(data.room);
        const serverProgress =
          typeof data.resolutionProgress === "number"
            ? data.resolutionProgress
            : data.room.resolutionProgress ?? computeProgressFromRoom(data.room);
        resolvedProgress = Math.max(resolutionProgress, serverProgress);
        setResolutionProgress((prev) => Math.max(prev, serverProgress));
      } else if (typeof data.resolutionProgress === "number") {
        resolvedProgress = Math.max(resolutionProgress, data.resolutionProgress);
        setResolutionProgress((prev) =>
          Math.max(prev, data.resolutionProgress!)
        );
      }

      if (data.mvpPlayerId) {
        setMvpPlayerId(data.mvpPlayerId);
      }

      const nextPlayer = data.updatedPlayer ?? data.player;
      if (nextPlayer) {
        setGuestPlayer(nextPlayer);
        saveCachedGuestProfile(nextPlayer);
      }

      const spokenFeedback = data.ctoFeedback ?? data.feedback;
      if (
        spokenFeedback &&
        data.room?.status !== "timed_out" &&
        effectiveTimeAfter > 0
      ) {
        speakCtoAlert(spokenFeedback);
      }

      if (
        resolvedProgress < 100 &&
        data.room?.status !== "resolved" &&
        data.room?.status !== "timed_out" &&
        effectiveTimeAfter > 0
      ) {
        const evaluationsAfter = data.room?.evaluations ?? room.evaluations;
        const humanTurnsAfter = evaluationsAfter.filter(
          (e) => !e.playerId.startsWith("ai-")
        ).length;
        setLastTurnFeedback({
          score: data.evaluation?.score ?? 0,
          progressPct: resolvedProgress,
          turnNumber: humanTurnsAfter,
          feedback:
            spokenFeedback ??
            "Status logged. Continue coordinating root-cause mitigation.",
          missingKeywords: data.evaluation?.missingKeywords ?? [],
          penaltySeconds: penaltySec,
        });
        if (ctoHighlightTimerRef.current) {
          clearTimeout(ctoHighlightTimerRef.current);
        }
        setCtoHighlight(true);
        ctoHighlightTimerRef.current = setTimeout(() => {
          if (mountedRef.current) setCtoHighlight(false);
        }, 3500);
        requestAnimationFrame(() => {
          ctoBoxRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        });
      } else {
        setLastTurnFeedback(null);
        setCtoHighlight(false);
      }

      turnStartRef.current = Date.now();
      setTranscriptInput("");
    } catch {
      setErrorMsg("Network error submitting your incident report.");
    } finally {
      setLoadingAction(null);
    }
  };

  const myClue = activeScenario.clues[selectedRole];
  const teammateRoles = ROLES.filter((r) => r.id !== selectedRole);
  const myMatchedKeywords = useMemo(() => {
    if (!room) return new Set<string>();
    const matched = new Set<string>();
    for (const ev of room.evaluations) {
      if (ev.role === selectedRole) {
        for (const kw of ev.matchedKeywords) {
          matched.add(kw.toLowerCase());
        }
      }
    }
    return matched;
  }, [room, selectedRole]);

  const computedMvpPlayer = useMemo(() => {
    if (!room || room.players.length === 0) return null;
    if (mvpPlayerId) {
      const found = room.players.find((p) => p.id === mvpPlayerId);
      if (found) return found;
    }
    return [...room.players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  }, [room, mvpPlayerId]);

  const isRoomResolved = room?.status === "resolved";
  const isRoomActiveStatus =
    room?.status === "briefing" ||
    room?.status === "speaking" ||
    room?.status === "evaluating";
  const isRoomTimedOut =
    Boolean(room) &&
    !isRoomResolved &&
    (room?.status === "timed_out" || (isRoomActiveStatus && timeLeftSec <= 0));

  const humanEvaluations = useMemo(
    () => room?.evaluations.filter((e) => !e.playerId.startsWith("ai-")) ?? [],
    [room]
  );
  const humanTurnsCount = humanEvaluations.length;
  const nextTurnNumber = humanTurnsCount + 1;
  const remainingProgress = Math.max(0, 100 - resolutionProgress);

  const humanTurnPointsTotal = useMemo(
    () => humanEvaluations.reduce((sum, ev) => sum + ev.score, 0),
    [humanEvaluations]
  );
  const myBestTurnScore = useMemo(() => {
    const roleScores = humanEvaluations
      .filter((ev) => ev.role === selectedRole)
      .map((ev) => ev.score);
    const slotScore = room?.players.find((p) => p.role === selectedRole)?.score;
    return Math.max(0, slotScore ?? 0, ...roleScores);
  }, [humanEvaluations, room, selectedRole]);
  const missingRoleKeywords = useMemo(
    () =>
      myClue.targetKeywords.filter(
        (kw) => !myMatchedKeywords.has(kw.toLowerCase())
      ),
    [myClue.targetKeywords, myMatchedKeywords]
  );

  const renderPostSubmitBanner = (location: "cto" | "composer") => {
    if (resolutionProgress >= 100 || (!lastTurnFeedback && humanTurnsCount === 0)) {
      return null;
    }
    const headline = lastTurnFeedback
      ? `✓ Đã ghi nhận báo cáo (+${lastTurnFeedback.score} pts • Tiến độ ${resolutionProgress}%/100%) — Đọc chỉ dẫn tiếp theo của CTO bên dưới và gửi báo cáo lượt tiếp để đạt 100%!`
      : `✓ Đã ghi nhận ${humanTurnsCount} lượt báo cáo (Tiến độ ${resolutionProgress}%/100%) — Đọc chỉ dẫn tiếp theo của CTO bên dưới và gửi báo cáo lượt tiếp để đạt 100%!`;

    return (
      <div
        role="status"
        className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300/80 text-emerald-900 text-xs space-y-2"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-bold flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{headline}</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold shrink-0">
            <span className="px-2 py-0.5 rounded bg-white/85 border border-emerald-300/80 text-emerald-800">
              Đã nộp: {humanTurnsCount} lượt • Tiếp: Lượt {nextTurnNumber}
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300/80">
              Còn {remainingProgress}%
            </span>
          </div>
        </div>

        {location === "cto" ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-emerald-800">
            <span>
              {humanTurnsCount === 1
                ? "Gợi ý Lượt 2: Mô tả bước khắc phục (mitigation) bằng tiếng Anh cùng từ khóa mục tiêu."
                : "Gợi ý lượt tiếp: Xác nhận hệ thống đang hồi phục và đạt ≥ 55 pts để chạm 100%."}
            </span>
            <button
              type="button"
              onClick={() =>
                composerSectionRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                })
              }
              className="liquid-btn-success inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono font-bold"
            >
              <ArrowDown className="w-3 h-3" />
              <span>Gửi Lượt {nextTurnNumber}</span>
            </button>
          </div>
        ) : (
          <div className="p-2.5 rounded-lg bg-white/85 border border-emerald-300/70 text-slate-800 space-y-1">
            <div className="font-mono font-bold text-[11px] text-emerald-800">
              Chỉ dẫn tiếp theo của CTO:
            </div>
            <p className="text-xs text-slate-700">
              {lastTurnFeedback?.feedback ??
                ctoAlertText ??
                activeScenario.incidentContext}
            </p>
            {lastTurnFeedback && lastTurnFeedback.missingKeywords.length > 0 && (
              <p className="text-[11px] font-mono text-amber-700 font-semibold">
                Từ khóa nên bổ sung:{" "}
                {lastTurnFeedback.missingKeywords.slice(0, 3).join(", ")}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <VictoryFinisherOverlay
        finisherId={equippedCosmetics.victory_finisher}
        active={showFinisher}
        title="INCIDENT RESOLVED!"
        subtitle={`${activeScenario.title} — Team Score ${room?.teamScore ?? 0} pts`}
        onComplete={() => setShowFinisher(false)}
      />

      <section className="liquid-glass-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-rose-100 border border-rose-300/80 text-rose-800 text-[11px] font-mono font-bold">
              <Radio className="w-3.5 h-3.5 text-rose-600" />
              <span>CO-OP WAR ROOM • 3AM OUTAGE</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Outage At 3AM: Incident Command
            </h1>
            <p className="text-xs sm:text-sm text-slate-600">
              Coordinate across Frontend, Backend, and DevOps in English. Speaking
              Vietnamese triggers a <strong className="text-rose-600">-15s</strong> clock
              penalty!
            </p>
          </div>

          <div className="liquid-glass-pill flex items-center gap-3 self-start sm:self-center px-3.5 py-2">
            <DiscordAvatarFrame
              equippedId={equippedCosmetics.avatar_decoration}
              fallbackRing={guestPlayer?.equippedRing}
              size="sm"
              micActive={isRecording}
            >
              <div className="w-8 h-8 rounded-full bg-rose-600 border border-rose-300/60 text-white flex items-center justify-center text-xs font-mono font-bold">
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

        {errorMsg && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-300/80 text-rose-800 text-xs font-medium">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </section>

      {(!room || room.status === "lobby") && (
        <div className="space-y-6">
          <section className="liquid-glass-card p-5 space-y-4">
            <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-900">
              1. Choose Your Engineering Role
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {ROLES.map((role) => {
                const active = selectedRole === role.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRole(role.id)}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      active
                        ? "bg-rose-50/95 border-rose-400/80 shadow-[0_6px_20px_rgba(244,63,94,0.18)]"
                        : "bg-white/80 border-slate-200/85 hover:border-rose-400/60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-rose-100 border border-rose-300/80 text-rose-800">
                        {role.badge}
                      </span>
                      {active && <CheckCircle2 className="w-4 h-4 text-rose-600" />}
                    </div>
                    <div className="mt-2 font-bold text-sm text-slate-900">{role.label}</div>
                    <div className="mt-1 text-xs text-slate-600">{role.focus}</div>
                  </button>
                );
              })}
            </div>
          </section>

          {!room ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <section className="lg:col-span-2 liquid-glass-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-900">
                    2. Create Room — Select Outage Scenario
                  </h2>
                  <span className="text-xs font-mono text-slate-600">
                    {PARTY_SCENARIOS.length} scenarios
                  </span>
                </div>

                <div className="space-y-2.5">
                  {PARTY_SCENARIOS.map((scenario) => {
                    const active = selectedScenarioId === scenario.id;
                    return (
                      <button
                        key={scenario.id}
                        type="button"
                        onClick={() => setSelectedScenarioId(scenario.id)}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                          active
                            ? "bg-rose-50/95 border-rose-400/80 shadow-[0_6px_18px_rgba(244,63,94,0.16)]"
                            : "bg-white/80 border-slate-200/85 hover:border-rose-300/70"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-sm text-slate-900">
                            {scenario.title}
                          </span>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                                scenario.severity === "SEV-1"
                                  ? "bg-rose-100 border-rose-300/80 text-rose-800"
                                  : "bg-amber-100 border-amber-300/80 text-amber-800"
                              }`}
                            >
                              {scenario.severity}
                            </span>
                            <span className="text-[11px] font-mono text-slate-600">
                              ~{scenario.estimatedMinutes}m
                            </span>
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">{scenario.summary}</p>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={handleCreateRoom}
                  disabled={loadingAction === "create"}
                  className="liquid-btn-danger w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>
                    {loadingAction === "create"
                      ? "Creating War Room..."
                      : "Create War Room"}
                  </span>
                </button>
              </section>

              <section className="liquid-glass-card p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-900">
                    Or Join by Invite Code
                  </h2>
                  <p className="text-xs text-slate-600">
                    Enter the 6-character room code shared by your squad lead.
                  </p>
                  <input
                    type="text"
                    maxLength={6}
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    placeholder="ABC123"
                    className="liquid-glass-input w-full px-4 py-3 rounded-xl font-mono text-lg font-bold tracking-[0.25em] text-center uppercase focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleJoinRoom}
                  disabled={loadingAction === "join"}
                  className="liquid-btn-primary w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                >
                  <Users className="w-4 h-4" />
                  <span>{loadingAction === "join" ? "Joining..." : "Join Room"}</span>
                </button>
              </section>
            </div>
          ) : (
            <section className="liquid-glass-card p-5 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/85">
                <div>
                  <div className="text-xs font-mono text-slate-600">WAR ROOM CODE</div>
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
                  <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-rose-100 border border-rose-300/80 text-rose-800">
                    {activeScenario.severity}
                  </span>
                  <div className="mt-1 font-bold text-base text-slate-900">
                    {activeScenario.title}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {ROLES.map((role) => {
                  const slot = room.players.find((p) => p.role === role.id);
                  return (
                    <div
                      key={role.id}
                      className={`p-4 rounded-xl border ${
                        slot
                          ? "bg-white/80 border-slate-200/85"
                          : "bg-slate-100/70 border-dashed border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <DiscordAvatarFrame
                          equippedId={
                            slot && role.id === selectedRole
                              ? equippedCosmetics.avatar_decoration
                              : null
                          }
                          size="sm"
                        >
                          <div className="w-9 h-9 rounded-full bg-rose-600 border border-rose-300/60 text-white flex items-center justify-center text-xs font-mono font-bold">
                            {role.badge}
                          </div>
                        </DiscordAvatarFrame>
                        <div className="min-w-0">
                          <div className="text-xs font-mono text-slate-600">
                            {role.label}
                          </div>
                          <div className="font-bold text-sm text-slate-900 truncate">
                            {slot ? slot.displayName : "Waiting for engineer..."}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleFillAi}
                    disabled={
                      loadingAction === "fill_ai" || room.players.length >= 3
                    }
                    className="liquid-glass-btn inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm disabled:opacity-50"
                  >
                    <Bot className="w-4 h-4 text-sky-600" />
                    <span>
                      {loadingAction === "fill_ai"
                        ? "Đang gọi AI đồng đội..."
                        : "Thêm AI đồng đội"}
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

                <div className="flex flex-col items-start sm:items-end gap-1.5">
                  <button
                    type="button"
                    onClick={handleStartMission}
                    disabled={
                      loadingAction === "start" || room.players.length < 3
                    }
                    className="liquid-btn-danger inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play className="w-4 h-4" />
                    <span>
                      {loadingAction === "start"
                        ? "Đang vào ca trực..."
                        : "Bắt đầu xử lý sự cố"}
                    </span>
                  </button>
                  {room.players.length < 3 && (
                    <span className="text-xs font-mono text-slate-600">
                      Need {3 - room.players.length} more teammate
                      {3 - room.players.length > 1 ? "s" : ""} (invite or click
                      Fill with AI Teammates).
                    </span>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {room && isRoomActiveStatus && !isRoomTimedOut && (
          <div className="space-y-6">
            <section className="liquid-glass-card p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-pill bg-rose-100 border border-rose-300/80 text-rose-800 text-xs font-mono font-bold">
                      {activeScenario.severity}
                    </span>
                    <span className="liquid-glass-pill px-3 py-0.5 text-xs font-mono text-slate-700">
                      ROOM {room.roomCode}
                    </span>
                    <span className="liquid-glass-pill px-3 py-0.5 text-[11px] font-mono font-bold text-sky-700">
                      Lượt {nextTurnNumber} • Tiến độ {resolutionProgress}%/100%
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {activeScenario.title}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {penaltyFlash && (
                    <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-mono font-bold animate-pulse border border-rose-300">
                      -15s Vietnamese Penalty!
                    </span>
                  )}

                  <div
                    className={`flex items-center gap-2 px-4 py-2 rounded-pill font-mono font-bold text-lg ${
                      penaltyFlash || timeLeftSec <= 60
                        ? "liquid-btn-danger animate-pulse"
                        : "liquid-glass-pill text-sky-700"
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    <span>{formatClock(timeLeftSec)}</span>
                  </div>

                  <button
                    type="button"
                    onClick={
                      isTtsPlaying
                        ? stopCtoAudio
                        : () =>
                            speakCtoAlert(
                              ctoAlertText ?? activeScenario.incidentContext
                            )
                    }
                    className="liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-bold"
                  >
                    {isTtsPlaying ? (
                      <>
                        <VolumeX className="w-4 h-4 text-rose-600" />
                        <span>Mute CTO</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-4 h-4 text-sky-600" />
                        <span>CTO Briefing</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-700">
                  <span>INCIDENT RESOLUTION PROGRESS</span>
                  <span className="text-emerald-700">
                    {resolutionProgress}% / 100% (Còn {remainingProgress}%)
                  </span>
                </div>
                <div className="w-full h-4 rounded-full bg-slate-200/80 border border-slate-300/70 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, resolutionProgress))}%` }}
                  />
                </div>
              </div>

              {renderPostSubmitBanner("cto")}

              <div
                ref={ctoBoxRef}
                className={`scroll-mt-24 p-3.5 rounded-xl border text-xs flex items-start gap-2.5 transition-all duration-500 ${
                  ctoHighlight
                    ? "bg-amber-50 border-amber-400/80 text-amber-950 ring-2 ring-amber-400/40"
                    : "bg-white/80 border-slate-200/85 text-slate-700"
                }`}
              >
                <Terminal className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono font-bold text-slate-900">
                      CTO Incident Commander
                      {ctoHighlight ? " • Chỉ dẫn mới" : ""}:
                    </span>
                    <span className="text-[11px] font-mono text-slate-600">
                      Lượt {nextTurnNumber} • Tiến độ {resolutionProgress}%/100%
                    </span>
                  </div>
                  <p>{ctoAlertText ?? activeScenario.incidentContext}</p>
                  {lastTurnFeedback &&
                    lastTurnFeedback.missingKeywords.length > 0 && (
                      <p className="text-[11px] font-mono text-amber-700 font-semibold">
                        Từ khóa nên dùng ở lượt tiếp:{" "}
                        {lastTurnFeedback.missingKeywords.slice(0, 3).join(", ")}
                      </p>
                    )}
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <section className="lg:col-span-2 liquid-glass-card p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-rose-100 border border-rose-300/80 text-rose-800 text-xs font-mono font-bold">
                    MANH MỐI RIÊNG CỦA BẠN • {myClue.roleLabel}
                  </span>
                  {room.currentTurnRole === selectedRole && (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300/80 text-[11px] font-mono font-bold">
                      Đến lượt bạn báo cáo
                    </span>
                  )}
                </div>

                <p className="text-sm font-medium text-slate-900">
                  <InteractiveEnglishText text={myClue.summary} />
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-white/80 border border-slate-200/85 space-y-2">
                    <div className="text-[11px] font-mono font-bold uppercase text-slate-600">
                      Live Telemetry Metrics
                    </div>
                    <ul className="space-y-1.5 text-xs font-mono text-slate-700">
                      {myClue.metrics.map((metric) => (
                        <li key={metric} className="flex items-start gap-1.5">
                          <span className="text-rose-600 font-bold">•</span>
                          <span>{metric}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/80 border border-slate-200/85 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono font-bold uppercase text-slate-600">
                      <span>Nguyên nhân nghi vấn</span>
                      <span className="normal-case font-sans text-slate-500">Chạm từ để dịch</span>
                    </div>
                    <p className="text-xs text-slate-800 font-medium">
                      <InteractiveEnglishText text={myClue.suspectedCause} />
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[11px] font-mono font-bold uppercase text-slate-700">
                    Từ khóa tiếng Anh cần nói rõ
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {myClue.targetKeywords.map((kw) => {
                      const hit = myMatchedKeywords.has(kw.toLowerCase());
                      const gloss = getVietnameseGloss(kw);
                      return (
                        <span
                          key={kw}
                          title={gloss ?? undefined}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
                            hit
                              ? "bg-emerald-100 border-emerald-300/80 text-emerald-800"
                              : "bg-white/80 border-slate-200/85 text-slate-800"
                          }`}
                        >
                          {hit ? `✓ ${kw}` : kw}
                          {gloss ? (
                            <span className="font-sans font-normal text-slate-600">
                              {" "}
                              ({gloss})
                            </span>
                          ) : null}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </section>

              <section className="liquid-glass-card p-5 space-y-4">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900">
                  Teammates&apos; Intel (Role Summary)
                </h3>
                <div className="space-y-3">
                  {teammateRoles.map((role) => {
                    const clue = activeScenario.clues[role.id];
                    const slot = room.players.find((p) => p.role === role.id);
                    const isTurn = room.currentTurnRole === role.id;
                    return (
                      <div
                        key={role.id}
                        className={`p-3.5 rounded-xl border bg-white/80 space-y-2 ${
                          isTurn ? "border-rose-400/80" : "border-slate-200/85"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <DiscordAvatarFrame size="sm" micActive={isTurn}>
                              <div className="w-7 h-7 rounded-full bg-slate-700 text-white flex items-center justify-center text-[10px] font-mono font-bold">
                                {role.badge}
                              </div>
                            </DiscordAvatarFrame>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 truncate">
                                {slot?.displayName ?? "AI Engineer"}
                              </div>
                              <div className="text-[10px] font-mono text-slate-600">
                                {clue.roleLabel}
                              </div>
                            </div>
                          </div>
                          {slot?.score !== undefined && (
                            <span className="text-xs font-mono font-bold text-emerald-700">
                              {slot.score} pts
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600">{clue.summary}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            <section
              ref={composerSectionRef}
              className="scroll-mt-24 liquid-glass-card p-5 space-y-4"
            >
              {renderPostSubmitBanner("composer")}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <DiscordAvatarFrame
                    equippedId={equippedCosmetics.avatar_decoration}
                    fallbackRing={guestPlayer?.equippedRing}
                    size="sm"
                    micActive={isRecording}
                  >
                    <div className="w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs font-mono font-bold">
                      {(guestPlayer?.displayName ?? "DV").slice(0, 2).toUpperCase()}
                    </div>
                  </DiscordAvatarFrame>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        Nói hoặc gõ báo cáo sự cố (bằng tiếng Anh)
                      </span>
                      <span className="liquid-glass-pill px-2.5 py-0.5 text-[11px] font-mono font-bold text-sky-700">
                        Lượt {nextTurnNumber} • Tiến độ {resolutionProgress}%/100%
                      </span>
                    </div>
                    <div className="text-xs text-slate-600">
                      Giải thích nguyên nhân &amp; cách sửa theo vai trò của bạn, dùng các từ khóa ở trên.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleToggleMic}
                  disabled={isRoomTimedOut || timeLeftSec <= 0}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    isRecording
                      ? "liquid-btn-danger animate-pulse"
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
                      <Mic className="w-3.5 h-3.5 text-rose-600" />
                      <span>Bật Mic nói</span>
                    </>
                  )}
                </button>
              </div>

              {speechError && (
                <div className="text-xs text-rose-700 font-medium">{speechError}</div>
              )}

              <textarea
                rows={3}
                value={transcriptInput}
                onChange={(e) => setTranscriptInput(e.target.value)}
                disabled={isRoomTimedOut || timeLeftSec <= 0}
                placeholder={
                  humanTurnsCount === 0
                    ? "Example: We have a lock contention deadlock in the payment transaction. Let's add a rollback and client idempotency key..."
                    : `Lượt ${nextTurnNumber}: Describe your next mitigation or verification step in English...`
                }
                className="liquid-glass-input w-full p-3.5 rounded-xl text-sm focus:outline-none disabled:opacity-50"
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleResetRoom}
                    className="liquid-glass-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-mono"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Chơi lại phòng mới</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLeaveRoom}
                    className="liquid-glass-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-mono"
                  >
                    <span>Rời phòng</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSubmitReport}
                  disabled={
                    loadingAction === "evaluate" ||
                    isRoomTimedOut ||
                    timeLeftSec <= 0
                  }
                  className="liquid-btn-danger inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {loadingAction === "evaluate"
                      ? "CTO đang chấm..."
                      : humanTurnsCount > 0
                        ? `Gửi báo cáo lượt ${nextTurnNumber}`
                        : "Gửi báo cáo sự cố"}
                  </span>
                </button>
              </div>

              {(room.transcript && room.transcript.length > 0
                ? room.transcript
                : room.evaluations.map((ev) => ({
                    playerId: ev.playerId,
                    playerName:
                      room.players.find((p) => p.id === ev.playerId)?.displayName ??
                      ev.role.toUpperCase(),
                    role: ev.role,
                    transcript: ev.transcript,
                    score: ev.score,
                    feedback: ev.feedback,
                    timestamp: room.updatedAt,
                  }))
              ).length > 0 && (
                <div className="pt-4 border-t border-slate-200/85 space-y-2.5">
                  <div className="text-xs font-mono font-bold uppercase text-slate-600">
                    War-Room Live Transcript
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {(room.transcript && room.transcript.length > 0
                      ? room.transcript
                      : room.evaluations.map((ev) => ({
                          playerId: ev.playerId,
                          playerName:
                            room.players.find((p) => p.id === ev.playerId)
                              ?.displayName ?? ev.role.toUpperCase(),
                          role: ev.role,
                          transcript: ev.transcript,
                          score: ev.score,
                          feedback: ev.feedback,
                          timestamp: room.updatedAt,
                        }))
                    ).map((entry, idx) => (
                      <div
                        key={`${entry.playerId}-${entry.timestamp}-${idx}`}
                        className="p-3 rounded-xl bg-white/80 border border-slate-200/85 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2 font-mono font-bold">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-slate-900 truncate">
                              {entry.playerName}
                            </span>
                            <span className="uppercase px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px]">
                              {entry.role}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-slate-500 font-normal">
                              {new Date(entry.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </span>
                            <span className="text-emerald-700">
                              {entry.score} pts
                            </span>
                          </div>
                        </div>
                        <p className="text-slate-800">&ldquo;{entry.transcript}&rdquo;</p>
                        <p className="text-slate-600 font-medium">
                          CTO: {entry.feedback}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

      {room && isRoomTimedOut && (
        <section className="liquid-glass-card p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/85">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 border border-rose-300/80 text-rose-800 text-xs font-mono font-bold">
                <Clock className="w-4 h-4" />
                <span>TIME&apos;S UP • 00:00</span>
              </div>
              <h2 className="inline-flex items-center gap-2 text-xl sm:text-2xl font-bold text-slate-900">
                <Clock className="w-5 h-5 text-rose-600 shrink-0" aria-hidden="true" />
                <span>HẾT GIỜ! SỰ CỐ CHƯA KHẮC PHỤC KỊP (OUTAGE ESCALATED)</span>
              </h2>
              <p className="text-xs text-slate-600">
                {activeScenario.title} — Hết thời gian xử lý ({formatClock(0)}).
                {humanTurnsCount > 0
                  ? " Điểm các lượt bạn đã nộp vẫn được bảo lưu."
                  : " Chưa có báo cáo nào được hoàn tất trước khi hết giờ."}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-white/80 border border-slate-200/85 rounded-xl px-4 py-2.5 text-center">
                <div className="text-[10px] font-mono font-bold text-slate-600">
                  TIẾN ĐỘ ĐẠT ĐƯỢC
                </div>
                <div className="text-2xl font-mono font-bold text-rose-600">
                  {resolutionProgress}%
                </div>
              </div>
              <div className="bg-white/80 border border-slate-200/85 rounded-xl px-4 py-2.5 text-center">
                <div className="text-[10px] font-mono font-bold text-slate-600">
                  ĐIỂM TÍCH LŨY
                </div>
                <div className="text-2xl font-mono font-bold text-slate-900">
                  {humanTurnPointsTotal > 0 ? humanTurnPointsTotal : room.teamScore} pts
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-700">
              <span>FINAL INCIDENT PROGRESS</span>
              <span>{resolutionProgress}% / 100%</span>
            </div>
            <div className="w-full h-4 rounded-full bg-slate-200/80 border border-slate-300/70 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-rose-500 to-amber-500 transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, resolutionProgress))}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white/80 border border-slate-200/85 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-mono font-bold uppercase text-slate-900">
                  Accumulated Turn Points
                </div>
                <span className="text-[11px] font-mono font-bold text-emerald-700">
                  Team Avg: {room.teamScore} pts • Best Role: {myBestTurnScore} pts
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded-lg bg-slate-100/80 border border-slate-200/85">
                  <div className="text-[10px] text-slate-600">YOUR TURNS</div>
                  <div className="font-bold text-slate-900">
                    {humanTurnsCount} lượt ({humanTurnPointsTotal} pts)
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-100/80 border border-slate-200/85">
                  <div className="text-[10px] text-slate-600">TEAM SCORE</div>
                  <div className="font-bold text-slate-900">{room.teamScore} pts</div>
                </div>
              </div>

              <div className="space-y-1.5">
                {room.players.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between text-xs font-mono px-3 py-2 rounded-lg bg-slate-100/80 border border-slate-200/85"
                  >
                    <span className="font-bold text-slate-900">
                      {p.displayName} ({p.role})
                    </span>
                    <span className="text-slate-700">{p.score ?? 0} pts</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white/80 border border-slate-200/85 space-y-3">
              <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-slate-900">
                <Terminal className="w-4 h-4 text-rose-600" />
                <span>CTO Post-Incident Debrief</span>
              </div>
              <p className="text-xs text-slate-700 bg-slate-100/80 p-3 rounded-lg border border-slate-200/85">
                {ctoAlertText ??
                  (humanTurnsCount === 0
                    ? "CTO Debrief: Chưa ghi nhận báo cáo trạng thái bằng tiếng Anh trước khi hết giờ. Lần sau hãy đọc nhanh Exclusive Clue và gửi lượt 1 sớm hơn."
                    : "CTO Debrief: Đội đã phối hợp được một phần nhưng chưa đạt mốc 100% trước khi hết thời gian SLA.")}
              </p>
              {missingRoleKeywords.length > 0 && (
                <div className="text-[11px] font-mono text-amber-700 font-semibold">
                  Từ khóa vai trò {myClue.roleLabel} chưa nhắc tới:{" "}
                  {missingRoleKeywords.join(", ")}
                </div>
              )}
              <div className="space-y-1.5">
                <div className="text-[11px] font-mono font-bold uppercase text-slate-600">
                  Checklist khắc phục mục tiêu
                </div>
                <ul className="space-y-1.5 text-xs text-slate-700">
                  {activeScenario.resolutionChecklist.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleResetRoom}
              disabled={loadingAction === "reset"}
              className="liquid-btn-danger inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              <span>
                {loadingAction === "reset" ? "Đang tạo lại..." : "Chơi lại phòng mới"}
              </span>
            </button>

            <Link
              href="/arena"
              className="liquid-glass-btn inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm"
            >
              <ArrowLeft className="w-4 h-4 text-sky-600" />
              <span>Quay lại /arena</span>
            </Link>
          </div>
        </section>
      )}

      {room && room.status === "resolved" && (
        <section className="liquid-glass-card p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/85">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300/80 text-emerald-800 text-xs font-mono font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>SEV RESOLVED • 100% RESTORED</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900">
                {activeScenario.title} — Post-Mortem Victory
              </h2>
            </div>

            <div className="bg-white/80 border border-slate-200/85 rounded-xl px-4 py-2.5 text-center">
              <div className="text-[10px] font-mono font-bold text-slate-600">
                TEAM SCORE
              </div>
              <div className="text-2xl font-mono font-bold text-emerald-700">
                {room.teamScore} pts
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white/80 border border-slate-200/85 space-y-3">
              <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-slate-900">
                <Crown className="w-4 h-4 text-amber-500" />
                <span>MVP & IT-Coin Rewards</span>
              </div>
              {computedMvpPlayer && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-100/80 border border-slate-200/85">
                  <DiscordAvatarFrame
                    equippedId={
                      computedMvpPlayer.role === selectedRole
                        ? equippedCosmetics.avatar_decoration
                        : null
                    }
                    size="md"
                  >
                    <div className="w-10 h-10 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs font-mono font-bold">
                      {computedMvpPlayer.role.slice(0, 3).toUpperCase()}
                    </div>
                  </DiscordAvatarFrame>
                  <div>
                    <div className="font-bold text-sm text-slate-900">
                      {computedMvpPlayer.displayName} (MVP)
                    </div>
                    <div className="text-xs font-mono text-emerald-700 font-bold">
                      +15 IT-Coins Win • +10 IT-Coins MVP Bonus
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {room.players.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between text-xs font-mono px-3 py-2 rounded-lg bg-slate-100/80 border border-slate-200/85"
                  >
                    <span className="font-bold text-slate-900">
                      {p.displayName} ({p.role})
                    </span>
                    <span className="text-slate-700">{p.score ?? 0} pts</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white/80 border border-slate-200/85 space-y-3">
              <div className="text-xs font-mono font-bold uppercase text-slate-900">
                Incident Resolution Checklist
              </div>
              <ul className="space-y-2 text-xs text-slate-700">
                {activeScenario.resolutionChecklist.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleResetRoom}
              className="liquid-btn-danger inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Play Another Outage</span>
            </button>

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

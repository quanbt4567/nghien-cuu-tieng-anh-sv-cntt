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
      ? `✓ Đã ghi nhận báo cáo (+${lastTurnFeedback.score} pts, Tiến độ ${resolutionProgress}%/100%): Đọc chỉ dẫn tiếp theo của CTO bên dưới và gửi báo cáo lượt tiếp để đạt 100%!`
      : `✓ Đã ghi nhận ${humanTurnsCount} lượt báo cáo (Tiến độ ${resolutionProgress}%/100%): Đọc chỉ dẫn tiếp theo của CTO bên dưới và gửi báo cáo lượt tiếp để đạt 100%!`;

    return (
      <div
        role="status"
        className="p-3.5 border-l-4 border-l-green-700 bg-green-50 dark:bg-green-950/30 text-green-900 dark:text-green-200 text-sm space-y-2"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-bold flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-700 dark:text-green-400 shrink-0 mt-0.5" />
            <span>{headline}</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-xs font-bold shrink-0">
            <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-green-300 dark:border-green-700 text-green-800 dark:text-green-300">
              Đã nộp: {humanTurnsCount} lượt • Tiếp: Lượt {nextTurnNumber}
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300">
              Còn {remainingProgress}%
            </span>
          </div>
        </div>

        {location === "cto" ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-green-800 dark:text-green-300">
            <span>
              {humanTurnsCount === 1
                ? "Gợi ý Lượt 2: Mô tả bước khắc phục (mitigation) bằng tiếng Anh cùng từ khóa mục tiêu."
                : "Gợi ý lượt tiếp: Xác nhận hệ thống đang hồi phục và đạt >= 55 pts để chạm 100%."}
            </span>
            <button
              type="button"
              onClick={() =>
                composerSectionRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                })
              }
              className="liquid-btn-success inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-xs font-bold transition-colors"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span>Gửi Lượt {nextTurnNumber}</span>
            </button>
          </div>
        ) : (
          <div className="border-t border-green-200 dark:border-green-800 pt-2 text-slate-800 dark:text-slate-200 space-y-1">
            <div className="font-mono font-bold text-xs text-green-800 dark:text-green-300">
              Chỉ dẫn tiếp theo của CTO:
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {lastTurnFeedback?.feedback ??
                ctoAlertText ??
                activeScenario.incidentContext}
            </p>
            {lastTurnFeedback && lastTurnFeedback.missingKeywords.length > 0 && (
              <p className="text-sm font-mono text-amber-700 dark:text-amber-400 font-semibold">
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
        subtitle={`${activeScenario.title}, Team Score ${room?.teamScore ?? 0} pts`}
        onComplete={() => setShowFinisher(false)}
      />

      <section className="liquid-glass-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300 text-xs font-mono font-bold">
              <Radio className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
              <span>CO-OP WAR ROOM • 3AM OUTAGE</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Outage At 3AM: Incident Command
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Coordinate across Frontend, Backend, and DevOps in English. Speaking
              Vietnamese triggers a <strong className="text-red-600 dark:text-red-400">-15s</strong> clock
              penalty!
            </p>
          </div>

          <div className="inline-flex items-center gap-3 self-start sm:self-center px-3.5 py-2 rounded-full bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
            <DiscordAvatarFrame
              equippedId={equippedCosmetics.avatar_decoration}
              fallbackRing={guestPlayer?.equippedRing}
              size="sm"
              micActive={isRecording}
            >
              <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-mono font-bold">
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
              1. Choose Your Engineering Role
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 border-t border-b border-slate-200 dark:border-slate-800 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
              {ROLES.map((role) => {
                const active = selectedRole === role.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRole(role.id)}
                    className={`text-left p-4 border-l-4 transition-colors ${
                      active
                        ? "border-l-red-600 bg-red-50/70 dark:bg-red-950/30 dark:border-l-red-500"
                        : "border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300">
                        {role.badge}
                      </span>
                      {active && <CheckCircle2 className="w-4 h-4 text-red-600 dark:text-red-400" />}
                    </div>
                    <div className="mt-2 font-bold text-sm text-slate-900 dark:text-slate-100">{role.label}</div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{role.focus}</div>
                  </button>
                );
              })}
            </div>
          </section>

          {!room ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <section className="lg:col-span-2 liquid-glass-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                    2. Create Room: Select Outage Scenario
                  </h2>
                  <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                    {PARTY_SCENARIOS.length} scenarios
                  </span>
                </div>

                <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-b border-slate-200 dark:border-slate-800">
                  {PARTY_SCENARIOS.map((scenario) => {
                    const active = selectedScenarioId === scenario.id;
                    return (
                      <button
                        key={scenario.id}
                        type="button"
                        onClick={() => setSelectedScenarioId(scenario.id)}
                        className={`w-full text-left p-3.5 border-l-4 transition-colors ${
                          active
                            ? "border-l-red-600 bg-red-50/70 dark:bg-red-950/30 dark:border-l-red-500"
                            : "border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                            {scenario.title}
                          </span>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold border ${
                                scenario.severity === "SEV-1"
                                  ? "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300"
                                  : "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300"
                              }`}
                            >
                              {scenario.severity}
                            </span>
                            <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                              ~{scenario.estimatedMinutes}m
                            </span>
                          </div>
                        </div>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{scenario.summary}</p>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={handleCreateRoom}
                  disabled={loadingAction === "create"}
                  className="liquid-btn-danger w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-colors disabled:opacity-50"
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
                  <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                    Or Join by Invite Code
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Enter the 6-character room code shared by your squad lead.
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
                  disabled={loadingAction === "join"}
                  className="liquid-btn-primary w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-colors disabled:opacity-50"
                >
                  <Users className="w-4 h-4" />
                  <span>{loadingAction === "join" ? "Joining..." : "Join Room"}</span>
                </button>
              </section>
            </div>
          ) : (
            <section className="liquid-glass-card p-5 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="text-xs font-mono text-slate-600 dark:text-slate-400">WAR ROOM CODE</div>
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

                <div className="text-left sm:text-right">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300">
                    {activeScenario.severity}
                  </span>
                  <div className="mt-1 font-bold text-base text-slate-900 dark:text-slate-100">
                    {activeScenario.title}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 border-t border-b border-slate-200 dark:border-slate-800 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
                {ROLES.map((role) => {
                  const slot = room.players.find((p) => p.role === role.id);
                  return (
                    <div
                      key={role.id}
                      className={`p-4 ${slot ? "" : "opacity-75"}`}
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
                          <div className="w-9 h-9 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-mono font-bold">
                            {role.badge}
                          </div>
                        </DiscordAvatarFrame>
                        <div className="min-w-0">
                          <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
                            {role.label}
                          </div>
                          <div className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
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
                    className="liquid-glass-btn inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm disabled:opacity-50 transition-colors"
                  >
                    <Bot className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                    <span>
                      {loadingAction === "fill_ai"
                        ? "Đang gọi AI đồng đội..."
                        : "Thêm AI đồng đội"}
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
                    onClick={handleStartMission}
                    disabled={
                      loadingAction === "start" || room.players.length < 3
                    }
                    className="liquid-btn-danger inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play className="w-4 h-4" />
                    <span>
                      {loadingAction === "start"
                        ? "Đang vào ca trực..."
                        : "Bắt đầu xử lý sự cố"}
                    </span>
                  </button>
                  {room.players.length < 3 && (
                    <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
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
                    <span className="px-2.5 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300 text-xs font-mono font-bold">
                      {activeScenario.severity}
                    </span>
                    <span className="px-3 py-0.5 rounded-full bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300">
                      ROOM {room.roomCode}
                    </span>
                    <span className="px-3 py-0.5 rounded-full bg-blue-50 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 text-xs font-mono font-bold text-blue-700 dark:text-blue-300">
                      Lượt {nextTurnNumber} • Tiến độ {resolutionProgress}%/100%
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {activeScenario.title}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {penaltyFlash && (
                    <span className="px-3 py-1 rounded-full bg-red-50 text-red-800 text-xs font-mono font-bold border border-red-300 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800">
                      -15s Vietnamese Penalty!
                    </span>
                  )}

                  <div
                    className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono font-bold text-lg ${
                      penaltyFlash || timeLeftSec <= 60
                        ? "bg-red-600 text-white"
                        : "bg-blue-50 border border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300"
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
                    className="liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-bold transition-colors"
                  >
                    {isTtsPlaying ? (
                      <>
                        <VolumeX className="w-4 h-4 text-red-600 dark:text-red-400" />
                        <span>Mute CTO</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                        <span>CTO Briefing</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                  <span>INCIDENT RESOLUTION PROGRESS</span>
                  <span className="text-green-700 dark:text-green-400">
                    {resolutionProgress}% / 100% (Còn {remainingProgress}%)
                  </span>
                </div>
                <div className="w-full h-4 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 overflow-hidden">
                  <div
                    className="w-full h-full origin-left bg-green-700 dark:bg-green-600 transition-transform duration-500"
                    style={{ transform: `scaleX(${Math.min(100, Math.max(0, resolutionProgress)) / 100})` }}
                  />
                </div>
              </div>

              {renderPostSubmitBanner("cto")}

              <div
                ref={ctoBoxRef}
                className={`scroll-mt-24 p-3.5 border-l-4 text-sm flex items-start gap-2.5 transition-colors duration-500 ${
                  ctoHighlight
                    ? "border-l-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-950 dark:text-amber-100"
                    : "border-l-blue-700 dark:border-l-blue-500 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200"
                }`}
              >
                <Terminal className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                      CTO Incident Commander
                      {ctoHighlight ? " • Chỉ dẫn mới" : ""}:
                    </span>
                    <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                      Lượt {nextTurnNumber} • Tiến độ {resolutionProgress}%/100%
                    </span>
                  </div>
                  <p>{ctoAlertText ?? activeScenario.incidentContext}</p>
                  {lastTurnFeedback &&
                    lastTurnFeedback.missingKeywords.length > 0 && (
                      <p className="text-sm font-mono text-amber-700 dark:text-amber-400 font-semibold">
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
                  <span className="px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300 text-xs font-mono font-bold">
                    MANH MỐI RIÊNG CỦA BẠN • {myClue.roleLabel}
                  </span>
                  {room.currentTurnRole === selectedRole && (
                    <span className="px-2.5 py-1 rounded-full bg-green-50 text-green-800 border border-green-200 dark:bg-green-950/40 dark:border-green-800 dark:text-green-300 text-xs font-mono font-bold">
                      Đến lượt bạn báo cáo
                    </span>
                  )}
                </div>

                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  <InteractiveEnglishText text={myClue.summary} />
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 border-t border-b border-slate-200 dark:border-slate-800 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
                  <div className="py-3.5 sm:pr-4 space-y-2">
                    <div className="text-xs font-mono font-bold uppercase text-slate-600 dark:text-slate-400">
                      Live Telemetry Metrics
                    </div>
                    <ul className="space-y-1.5 text-sm font-mono text-slate-700 dark:text-slate-300">
                      {myClue.metrics.map((metric) => (
                        <li key={metric} className="flex items-start gap-1.5">
                          <span className="text-red-600 dark:text-red-400 font-bold">•</span>
                          <span>{metric}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="py-3.5 sm:pl-4 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs font-mono font-bold uppercase text-slate-600 dark:text-slate-400">
                      <span>Nguyên nhân nghi vấn</span>
                      <span className="normal-case font-sans text-slate-500 dark:text-slate-400">Chạm từ để dịch</span>
                    </div>
                    <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">
                      <InteractiveEnglishText text={myClue.suspectedCause} />
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-mono font-bold uppercase text-slate-700 dark:text-slate-300">
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
                          className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold border ${
                            hit
                              ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/40 dark:border-green-800 dark:text-green-300"
                              : "bg-slate-100 border-slate-200 text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                          }`}
                        >
                          {hit ? `✓ ${kw}` : kw}
                          {gloss ? (
                            <span className="font-sans font-normal text-slate-600 dark:text-slate-400">
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
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  Teammates&apos; Intel (Role Summary)
                </h3>
                <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-b border-slate-200 dark:border-slate-800">
                  {teammateRoles.map((role) => {
                    const clue = activeScenario.clues[role.id];
                    const slot = room.players.find((p) => p.role === role.id);
                    const isTurn = room.currentTurnRole === role.id;
                    return (
                      <div
                        key={role.id}
                        className={`py-3.5 border-l-4 pl-3 space-y-2 ${
                          isTurn ? "border-l-red-600" : "border-l-transparent"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <DiscordAvatarFrame size="sm" micActive={isTurn}>
                              <div className="w-7 h-7 rounded-full bg-slate-700 text-white flex items-center justify-center text-xs font-mono font-bold">
                                {role.badge}
                              </div>
                            </DiscordAvatarFrame>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                {slot?.displayName ?? "AI Engineer"}
                              </div>
                              <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
                                {clue.roleLabel}
                              </div>
                            </div>
                          </div>
                          {slot?.score !== undefined && (
                            <span className="text-xs font-mono font-bold text-green-700 dark:text-green-400">
                              {slot.score} pts
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{clue.summary}</p>
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
                    <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-mono font-bold">
                      {(guestPlayer?.displayName ?? "DV").slice(0, 2).toUpperCase()}
                    </div>
                  </DiscordAvatarFrame>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        Nói hoặc gõ báo cáo sự cố (bằng tiếng Anh)
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 text-xs font-mono font-bold text-blue-700 dark:text-blue-300">
                        Lượt {nextTurnNumber} • Tiến độ {resolutionProgress}%/100%
                      </span>
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      Giải thích nguyên nhân &amp; cách sửa theo vai trò của bạn, dùng các từ khóa ở trên.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleToggleMic}
                  disabled={isRoomTimedOut || timeLeftSec <= 0}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
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
                      <Mic className="w-4 h-4 text-red-600 dark:text-red-400" />
                      <span>Bật Mic nói</span>
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
                disabled={isRoomTimedOut || timeLeftSec <= 0}
                placeholder={
                  humanTurnsCount === 0
                    ? "Example: We have a lock contention deadlock in the payment transaction. Let's add a rollback and client idempotency key..."
                    : `Lượt ${nextTurnNumber}: Describe your next mitigation or verification step in English...`
                }
                className="liquid-glass-input w-full p-3.5 rounded-lg text-sm focus:outline-none disabled:opacity-50"
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleResetRoom}
                    className="liquid-glass-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-mono transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Chơi lại phòng mới</span>
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
                  onClick={handleSubmitReport}
                  disabled={
                    loadingAction === "evaluate" ||
                    isRoomTimedOut ||
                    timeLeftSec <= 0
                  }
                  className="liquid-btn-danger inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="text-xs font-mono font-bold uppercase text-slate-600 dark:text-slate-400">
                    War-Room Live Transcript
                  </div>
                  <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-b border-slate-200 dark:border-slate-800 max-h-72 overflow-y-auto">
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
                        className="py-3 text-sm space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2 font-mono text-xs font-bold">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-slate-900 dark:text-slate-100 truncate">
                              {entry.playerName}
                            </span>
                            <span className="uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300 text-xs">
                              {entry.role}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                              {new Date(entry.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </span>
                            <span className="text-green-700 dark:text-green-400">
                              {entry.score} pts
                            </span>
                          </div>
                        </div>
                        <p className="text-slate-800 dark:text-slate-200">&ldquo;{entry.transcript}&rdquo;</p>
                        <p className="text-slate-600 dark:text-slate-400 font-medium">
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300 text-xs font-mono font-bold">
                <Clock className="w-4 h-4" />
                <span>TIME&apos;S UP • 00:00</span>
              </div>
              <h2 className="inline-flex items-center gap-2 text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                <Clock className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" aria-hidden="true" />
                <span>HẾT GIỜ! SỰ CỐ CHƯA KHẮC PHỤC KỊP (OUTAGE ESCALATED)</span>
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {activeScenario.title}: Hết thời gian xử lý ({formatClock(0)}).
                {humanTurnsCount > 0
                  ? " Điểm các lượt bạn đã nộp vẫn được bảo lưu."
                  : " Chưa có báo cáo nào được hoàn tất trước khi hết giờ."}
              </p>
            </div>

            <div className="flex items-center divide-x divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg shrink-0">
              <div className="px-4 py-2.5 text-center">
                <div className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">
                  TIẾN ĐỘ ĐẠT ĐƯỢC
                </div>
                <div className="text-2xl font-mono font-bold text-red-600 dark:text-red-400">
                  {resolutionProgress}%
                </div>
              </div>
              <div className="px-4 py-2.5 text-center">
                <div className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">
                  ĐIỂM TÍCH LŨY
                </div>
                <div className="text-2xl font-mono font-bold text-slate-900 dark:text-slate-100">
                  {humanTurnPointsTotal > 0 ? humanTurnPointsTotal : room.teamScore} pts
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
              <span>FINAL INCIDENT PROGRESS</span>
              <span>{resolutionProgress}% / 100%</span>
            </div>
            <div className="w-full h-4 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 overflow-hidden">
              <div
                className="w-full h-full origin-left bg-red-600 transition-transform duration-300"
                style={{ transform: `scaleX(${Math.min(100, Math.max(0, resolutionProgress)) / 100})` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 border-t border-b border-slate-200 dark:border-slate-800 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
            <div className="py-4 md:pr-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-mono font-bold uppercase text-slate-900 dark:text-slate-100">
                  Accumulated Turn Points
                </div>
                <span className="text-xs font-mono font-bold text-green-700 dark:text-green-400">
                  Team Avg: {room.teamScore} pts • Best Role: {myBestTurnScore} pts
                </span>
              </div>

              <div className="grid grid-cols-2 border-t border-b border-slate-200 dark:border-slate-800 divide-x divide-slate-200 dark:divide-slate-800 text-xs font-mono">
                <div className="py-2.5 pr-3">
                  <div className="text-xs text-slate-600 dark:text-slate-400">YOUR TURNS</div>
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    {humanTurnsCount} lượt ({humanTurnPointsTotal} pts)
                  </div>
                </div>
                <div className="py-2.5 pl-3">
                  <div className="text-xs text-slate-600 dark:text-slate-400">TEAM SCORE</div>
                  <div className="font-bold text-slate-900 dark:text-slate-100">{room.teamScore} pts</div>
                </div>
              </div>

              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {room.players.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between text-xs font-mono py-2"
                  >
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {p.displayName} ({p.role})
                    </span>
                    <span className="text-slate-700 dark:text-slate-300">{p.score ?? 0} pts</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="py-4 md:pl-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-slate-900 dark:text-slate-100">
                <Terminal className="w-4 h-4 text-red-600 dark:text-red-400" />
                <span>CTO Post-Incident Debrief</span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 border-l-2 border-red-600 dark:border-red-500 pl-3 py-1">
                {ctoAlertText ??
                  (humanTurnsCount === 0
                    ? "CTO Debrief: Chưa ghi nhận báo cáo trạng thái bằng tiếng Anh trước khi hết giờ. Lần sau hãy đọc nhanh Exclusive Clue và gửi lượt 1 sớm hơn."
                    : "CTO Debrief: Đội đã phối hợp được một phần nhưng chưa đạt mốc 100% trước khi hết thời gian SLA.")}
              </p>
              {missingRoleKeywords.length > 0 && (
                <div className="text-xs font-mono text-amber-700 dark:text-amber-400 font-semibold">
                  Từ khóa vai trò {myClue.roleLabel} chưa nhắc tới:{" "}
                  {missingRoleKeywords.join(", ")}
                </div>
              )}
              <div className="space-y-1.5">
                <div className="text-xs font-mono font-bold uppercase text-slate-600 dark:text-slate-400">
                  Checklist khắc phục mục tiêu
                </div>
                <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                  {activeScenario.resolutionChecklist.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
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
              className="liquid-btn-danger inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm disabled:opacity-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>
                {loadingAction === "reset" ? "Đang tạo lại..." : "Chơi lại phòng mới"}
              </span>
            </button>

            <Link
              href="/arena"
              className="liquid-glass-btn inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-blue-700 dark:text-blue-400" />
              <span>Quay lại /arena</span>
            </Link>
          </div>
        </section>
      )}

      {room && room.status === "resolved" && (
        <section className="liquid-glass-card p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 border border-green-200 text-green-800 dark:bg-green-950/40 dark:border-green-800 dark:text-green-300 text-xs font-mono font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>SEV RESOLVED • 100% RESTORED</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {activeScenario.title}: Post-Mortem Victory
              </h2>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2.5 text-center">
              <div className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">
                TEAM SCORE
              </div>
              <div className="text-2xl font-mono font-bold text-green-700 dark:text-green-400">
                {room.teamScore} pts
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 border-t border-b border-slate-200 dark:border-slate-800 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
            <div className="py-4 md:pr-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-slate-900 dark:text-slate-100">
                <Crown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>MVP & IT-Coin Rewards</span>
              </div>
              {computedMvpPlayer && (
                <div className="flex items-center gap-3 py-3 border-b border-slate-200 dark:border-slate-800">
                  <DiscordAvatarFrame
                    equippedId={
                      computedMvpPlayer.role === selectedRole
                        ? equippedCosmetics.avatar_decoration
                        : null
                    }
                    size="md"
                  >
                    <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-mono font-bold">
                      {computedMvpPlayer.role.slice(0, 3).toUpperCase()}
                    </div>
                  </DiscordAvatarFrame>
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {computedMvpPlayer.displayName} (MVP)
                    </div>
                    <div className="text-xs font-mono text-green-700 dark:text-green-400 font-bold">
                      +15 IT-Coins Win • +10 IT-Coins MVP Bonus
                    </div>
                  </div>
                </div>
              )}

              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {room.players.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between text-xs font-mono py-2"
                  >
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {p.displayName} ({p.role})
                    </span>
                    <span className="text-slate-700 dark:text-slate-300">{p.score ?? 0} pts</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="py-4 md:pl-5 space-y-3">
              <div className="text-xs font-mono font-bold uppercase text-slate-900 dark:text-slate-100">
                Incident Resolution Checklist
              </div>
              <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                {activeScenario.resolutionChecklist.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-700 dark:text-green-400 shrink-0 mt-0.5" />
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
              className="liquid-btn-danger inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Play Another Outage</span>
            </button>

            <Link
              href="/shop"
              className="liquid-btn-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-colors"
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

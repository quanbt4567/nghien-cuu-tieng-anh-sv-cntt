"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Bug,
  Camera,
  Check,
  Code2,
  Coins,
  Copy,
  Flame,
  Gamepad2,
  History,
  KeyRound,
  LogOut,
  Mail,
  Mic,
  Pencil,
  RefreshCw,
  RotateCcw,
  Server,
  ShoppingBag,
  Terminal,
  Timer,
  Trophy,
  Upload,
  User,
  X,
} from "lucide-react";
import {
  getTopPlayers,
  initOrHydrateGuestSession,
  logoutAccountAction,
  purchaseAndEquipCosmetic,
  restoreByTransferCode,
  unequipCosmeticSlot,
  updateGuestAvatar,
  updateGuestDisplayName,
} from "../../app/actions/leaderboard";
import { IT_ROLES } from "../../data/minigames";
import { SCENARIOS } from "../../data/scenarios";
import {
  CONTENT_STORAGE_KEY,
  CONTENT_UPDATED_EVENT,
  fetchAndCachePublicContent,
  getEffectiveScenarios,
} from "../../lib/contentStore";
import {
  COSMETIC_CATALOG,
  normalizeEquippedCosmetics,
  type CosmeticCategory,
} from "../../lib/cosmetics";
import type { PublicGuestPlayer } from "../../lib/db";
import {
  GAMIFICATION_STORAGE_KEY,
  GAMIFICATION_UPDATED_EVENT,
  POINTS_PER_COIN,
  getGamificationState,
  setSelectedRole,
} from "../../lib/gamification";
import {
  GUEST_PROFILE_UPDATED_EVENT,
  readBackupTransferCode,
  requestOpenAuthModal,
  saveBackupTransferCode,
  saveCachedGuestProfile,
} from "../../lib/guestClient";
import { DiscordAvatarFrame } from "../cosmetics/DiscordAvatarFrame";
import { LeaderboardRowWrapper } from "../cosmetics/LeaderboardRowWrapper";
import { AVATAR_PRESETS, PlayerAvatar } from "../cosmetics/PlayerAvatar";
import {
  mergeProfileIdentity,
  normalizeArenaHistory,
  summarizeProfileActivity,
} from "../../lib/profileStats";
import { storageAdapter } from "../../lib/storage";
import type {
  GameScoreEntry,
  GamificationState,
  ITRole,
  PracticeAttempt,
  Scenario,
  WeakPoint,
} from "../../lib/types";

const INITIAL_GAMIFICATION: GamificationState = {
  totalPoints: 0,
  streakDays: 0,
  lastPracticeDate: null,
  selectedRole: "frontend",
  personalBests: {
    "bug-buster": 0,
    "standup-speed-run": 0,
  },
  history: [],
};

const ROLE_ICONS: Record<ITRole, typeof Code2> = {
  frontend: Code2,
  backend: Server,
  qa: Bug,
  devops: Terminal,
};

function resizeAvatarImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const size = Math.min(img.width, img.height);
        const sx = Math.max(0, (img.width - size) / 2);
        const sy = Math.max(0, (img.height - size) / 2);
        const canvas = document.createElement("canvas");
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas unavailable"));
          return;
        }
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 128, 128);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        resolve(dataUrl);
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Invalid image"));
    };
    img.src = objectUrl;
  });
}

function formatAttemptDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function toVietnameseError(rawError?: string, mode?: "online" | "offline"): string {
  if (mode === "offline") {
    return "Không thể kết nối máy chủ lúc này. Vui lòng thử lại sau.";
  }
  switch (rawError) {
    case "Display name must be between 2 and 24 characters.":
      return "Tên hiển thị phải dài từ 2 đến 24 ký tự.";
    case "Database is unavailable in offline mode.":
    case "Cosmetic shop requires Neon DB connection.":
      return "Không thể kết nối máy chủ. Vui lòng thử lại khi trực tuyến.";
    case "Unable to resolve guest profile.":
    case "Unable to connect to guest profile.":
      return "Không thể kết nối tới hồ sơ khách. Vui lòng tải lại trang.";
    case "Unable to update display name.":
      return "Không thể lưu tên hiển thị lúc này. Vui lòng thử lại.";
    case "Invalid transfer code format (expected DEV-XXXXXX).":
      return "Mã chuyển thiết bị không đúng định dạng (ví dụ: DEV-9K4M2P).";
    case "Transfer code not found.":
      return "Không tìm thấy hồ sơ nào khớp với mã chuyển thiết bị này.";
    case "Unable to restore guest session from Neon DB.":
      return "Không thể khôi phục hồ sơ lúc này. Vui lòng thử lại sau.";
    case "Not enough IT-Coins to purchase this item.":
      return "Bạn chưa đủ IT-Coin để mở khóa vật phẩm này.";
    case "Cosmetic item not found.":
    case "Invalid cosmetic price.":
    case "Price mismatch for cosmetic item.":
      return "Thông tin vật phẩm không hợp lệ. Vui lòng tải lại trang.";
    case "Purchase transaction failed.":
      return "Giao dịch mở khóa không thành công. Vui lòng thử lại.";
    default:
      return rawError || "Đã xảy ra lỗi ngoài ý muốn. Vui lòng thử lại.";
  }
}

function findScenarioForWeakPoint(
  value: string,
  scenarios: Scenario[],
  fallbackScenarioId: string
): string {
  const needle = value.trim().toLowerCase();
  if (!needle) return fallbackScenarioId;
  const matched = scenarios.find((scenario) =>
    scenario.turns.some((turn) =>
      turn.keywords.some((kw) => kw.toLowerCase().includes(needle) || needle.includes(kw.toLowerCase()))
    )
  );
  return matched?.id ?? fallbackScenarioId;
}

export function ProfileView() {
  const [loading, setLoading] = useState(true);
  const [gamification, setGamification] = useState<GamificationState>(INITIAL_GAMIFICATION);
  const [attempts, setAttempts] = useState<PracticeAttempt[]>([]);
  const [weakPoints, setWeakPoints] = useState<WeakPoint[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>(SCENARIOS);

  const [guestPlayer, setGuestPlayer] = useState<PublicGuestPlayer | null>(null);
  const [globalRank, setGlobalRank] = useState<number | null>(null);

  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameFeedback, setNameFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const [copiedCode, setCopiedCode] = useState(false);
  const [copyNote, setCopyNote] = useState<string | null>(null);

  const [restoreCode, setRestoreCode] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreFeedback, setRestoreFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [shopFeedback, setShopFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const [isAvatarPanelOpen, setIsAvatarPanelOpen] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [avatarFeedback, setAvatarFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const applyGuestPlayer = useCallback((player: PublicGuestPlayer | null) => {
    setGuestPlayer(player);
    saveCachedGuestProfile(player);
  }, []);

  const refreshOnlineRank = useCallback(async () => {
    try {
      const board = await getTopPlayers(50);
      if (board.mode === "online") {
        setGlobalRank(board.currentUserRank?.rank ?? null);
        if (board.currentPlayer) {
          applyGuestPlayer(board.currentPlayer);
        }
      } else {
        setGlobalRank(null);
      }
    } catch {
      setGlobalRank(null);
    }
  }, [applyGuestPlayer]);

  useEffect(() => {
    let active = true;

    const syncGamification = () => {
      if (!active) return;
      setGamification(getGamificationState());
    };
    const syncContent = () => {
      if (!active) return;
      setScenarios(getEffectiveScenarios());
    };

    syncGamification();
    syncContent();

    const loadProfileData = async () => {
      setLoading(true);
      const loadGuestChain = async () => {
        const backup = readBackupTransferCode();
        const session = await initOrHydrateGuestSession(backup);
        if (session.mode === "online" && session.player) {
          saveBackupTransferCode(session.player.transferCode);
        }
        const board = await getTopPlayers(50);
        return { session, board };
      };

      const [attemptsRes, weakPointsRes, guestRes] = await Promise.allSettled([
        storageAdapter.getAttempts(),
        storageAdapter.getWeakPoints(20),
        loadGuestChain(),
        fetchAndCachePublicContent(),
      ]);

      if (!active) return;

      if (attemptsRes.status === "fulfilled") {
        setAttempts(attemptsRes.value);
      }
      if (weakPointsRes.status === "fulfilled") {
        setWeakPoints(weakPointsRes.value);
      }
      if (guestRes.status === "fulfilled") {
        const { session, board } = guestRes.value;
        if (board.mode === "online") {
          applyGuestPlayer(board.currentPlayer ?? session.player);
          setGlobalRank(board.currentUserRank?.rank ?? null);
        } else if (session.mode === "online" && session.player) {
          applyGuestPlayer(session.player);
          setGlobalRank(null);
        } else {
          applyGuestPlayer(null);
          setGlobalRank(null);
        }
      } else {
        applyGuestPlayer(null);
        setGlobalRank(null);
      }

      setScenarios(getEffectiveScenarios());
      setLoading(false);
    };

    void loadProfileData();

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === GAMIFICATION_STORAGE_KEY) {
        syncGamification();
      }
      if (!event.key || event.key === CONTENT_STORAGE_KEY) {
        syncContent();
      }
    };

    const handleGuestEvent = (event: Event) => {
      if (!active) return;
      const custom = event as CustomEvent<PublicGuestPlayer | null>;
      if (custom.detail !== undefined) {
        setGuestPlayer(custom.detail);
      }
    };

    window.addEventListener(GAMIFICATION_UPDATED_EVENT, syncGamification);
    window.addEventListener(CONTENT_UPDATED_EVENT, syncContent);
    window.addEventListener(GUEST_PROFILE_UPDATED_EVENT, handleGuestEvent);
    window.addEventListener("storage", handleStorage);

    return () => {
      active = false;
      window.removeEventListener(GAMIFICATION_UPDATED_EVENT, syncGamification);
      window.removeEventListener(CONTENT_UPDATED_EVENT, syncContent);
      window.removeEventListener(GUEST_PROFILE_UPDATED_EVENT, handleGuestEvent);
      window.removeEventListener("storage", handleStorage);
    };
  }, [applyGuestPlayer]);

  const identity = useMemo(
    () => mergeProfileIdentity(guestPlayer, gamification),
    [guestPlayer, gamification]
  );

  const equippedCosmetics = useMemo(
    () => normalizeEquippedCosmetics(guestPlayer?.equippedCosmetics),
    [guestPlayer?.equippedCosmetics]
  );

  const armoryPreviewItems = useMemo(() => {
    const isItemEquipped = (item: (typeof COSMETIC_CATALOG)[number]) =>
      equippedCosmetics[item.category] === item.id ||
      (item.kind === "title" && identity.equippedTitle === item.value) ||
      (item.kind === "ring" && identity.equippedRing === item.value);

    const equipped = COSMETIC_CATALOG.filter(isItemEquipped);
    const owned = COSMETIC_CATALOG.filter(
      (item) => !isItemEquipped(item) && identity.ownedItems.includes(item.id)
    );
    const featured = COSMETIC_CATALOG.filter(
      (item) => !isItemEquipped(item) && !identity.ownedItems.includes(item.id)
    );
    return [...equipped, ...owned, ...featured].slice(0, 4);
  }, [
    equippedCosmetics,
    identity.equippedTitle,
    identity.equippedRing,
    identity.ownedItems,
  ]);

  const activity = useMemo(
    () =>
      summarizeProfileActivity(
        attempts,
        weakPoints,
        gamification,
        identity.mode === "online" ? identity.totalPoints : undefined
      ),
    [attempts, weakPoints, gamification, identity.mode, identity.totalPoints]
  );

  const scenarioTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of SCENARIOS) map.set(s.id, s.titleVI);
    for (const s of scenarios) map.set(s.id, s.titleVI);
    return map;
  }, [scenarios]);

  const activeRole =
    IT_ROLES.find((role) => role.id === gamification.selectedRole) ?? IT_ROLES[0];
  const recommendedScenarioTitle =
    scenarioTitleMap.get(activeRole.recommendedScenarioId) ??
    activeRole.recommendedScenarioId;

  const coinEarnedInTier = POINTS_PER_COIN - activity.nextCoinPoints;
  const coinProgressPct = Math.round((coinEarnedInTier / POINTS_PER_COIN) * 100);
  const localSpeakingCount = activity.totalAttempts;
  const normalizedArenaHistory = useMemo(
    () => normalizeArenaHistory(gamification.history),
    [gamification.history]
  );
  const recentArenaRuns = useMemo(
    () => normalizedArenaHistory.slice(0, 5),
    [normalizedArenaHistory]
  );
  const localArenaCount = normalizedArenaHistory.length;
  const hasCloudPoints = identity.mode === "online" && identity.totalPoints > 0;

  const summaryStats = useMemo(() => {
    const speakingScores = attempts.map((attempt) =>
      Number.isFinite(attempt.score) ? attempt.score : 0
    );
    const arenaScores = normalizedArenaHistory.map((run) => run.score);
    const allScores = [...speakingScores, ...arenaScores];
    const totalSessions = speakingScores.length + arenaScores.length;
    const averageScore =
      allScores.length > 0
        ? Math.round(
            allScores.reduce((sum, score) => sum + score, 0) / allScores.length
          )
        : activity.averageScore;
    const bestScore =
      allScores.length > 0
        ? Math.max(
            ...allScores,
            activity.bestScore,
            activity.bugBusterBest,
            activity.standupBest
          )
        : Math.max(
            activity.bestScore,
            activity.bugBusterBest,
            activity.standupBest
          );
    return { totalSessions, averageScore, bestScore };
  }, [
    attempts,
    normalizedArenaHistory,
    activity.averageScore,
    activity.bestScore,
    activity.bugBusterBest,
    activity.standupBest,
  ]);

  const handleSelectRole = (roleId: ITRole) => {
    const updated = setSelectedRole(roleId);
    setGamification(updated);
  };

  const handleStartRename = () => {
    if (identity.mode !== "online") return;
    setDraftName(identity.displayName);
    setNameFeedback(null);
    setIsEditingName(true);
  };

  const handleRenameSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSavingName) return;
    if (identity.mode !== "online") {
      setNameFeedback({
        ok: false,
        message: toVietnameseError(undefined, "offline"),
      });
      return;
    }

    const cleaned = draftName.replace(/[\u0000-\u001F\u007F]/g, "").trim();
    if (cleaned.length < 2 || cleaned.length > 24) {
      setNameFeedback({
        ok: false,
        message: "Tên hiển thị phải dài từ 2 đến 24 ký tự.",
      });
      return;
    }

    setIsSavingName(true);
    setNameFeedback(null);
    try {
      const res = await updateGuestDisplayName(cleaned, readBackupTransferCode());
      if (res.ok && res.player) {
        applyGuestPlayer(res.player);
        setIsEditingName(false);
        setNameFeedback({
          ok: true,
          message: `Đã cập nhật tên thành "${res.player.displayName}".`,
        });
        void refreshOnlineRank();
      } else {
        if (res.mode === "offline") {
          applyGuestPlayer(null);
          setGlobalRank(null);
        }
        setNameFeedback({
          ok: false,
          message: toVietnameseError(res.error, res.mode),
        });
      }
    } catch {
      setNameFeedback({
        ok: false,
        message: "Không thể kết nối máy chủ để đổi tên. Vui lòng thử lại.",
      });
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSaveAvatar = async (nextAvatarUrl: string | null) => {
    if (isSavingAvatar) return;
    if (identity.mode !== "online") {
      setAvatarFeedback({
        ok: false,
        message: toVietnameseError(undefined, "offline"),
      });
      return;
    }

    setIsSavingAvatar(true);
    setAvatarFeedback(null);
    try {
      const res = await updateGuestAvatar(nextAvatarUrl, readBackupTransferCode());
      if (res.ok && res.player) {
        applyGuestPlayer(res.player);
        setAvatarFeedback({
          ok: true,
          message: nextAvatarUrl
            ? "Đã cập nhật avatar mới."
            : "Đã đặt lại avatar chữ cái mặc định.",
        });
        void refreshOnlineRank();
      } else {
        if (res.mode === "offline") {
          applyGuestPlayer(null);
          setGlobalRank(null);
        }
        setAvatarFeedback({
          ok: false,
          message: toVietnameseError(res.error, res.mode),
        });
      }
    } catch {
      setAvatarFeedback({
        ok: false,
        message: "Không thể kết nối máy chủ để cập nhật avatar. Vui lòng thử lại.",
      });
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const handleAvatarFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setAvatarFeedback({
        ok: false,
        message: "Chỉ hỗ trợ ảnh PNG, JPEG hoặc WebP.",
      });
      return;
    }
    try {
      const dataUrl = await resizeAvatarImageToDataUrl(file);
      if (dataUrl.length > 120000) {
        setAvatarFeedback({
          ok: false,
          message: "Ảnh sau khi nén vẫn quá lớn. Vui lòng chọn ảnh khác.",
        });
        return;
      }
      await handleSaveAvatar(dataUrl);
    } catch {
      setAvatarFeedback({
        ok: false,
        message: "Không thể xử lý ảnh này. Vui lòng thử tệp khác.",
      });
    }
  };

  const handleCopyTransferCode = async () => {
    if (!identity.transferCode) return;
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setCopyNote("Trình duyệt không hỗ trợ sao chép tự động; hãy sao chép thủ công mã ở trên.");
      return;
    }
    try {
      await navigator.clipboard.writeText(identity.transferCode);
      setCopyNote(null);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      setCopiedCode(false);
      setCopyNote("Không thể sao chép vào clipboard. Hãy chọn mã và sao chép thủ công.");
    }
  };

  const handleRestoreSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isRestoring) return;

    const normalized = restoreCode.trim().toUpperCase();
    if (!/^DEV-[A-Z0-9]{6}$/.test(normalized)) {
      setRestoreFeedback({
        ok: false,
        message: "Vui lòng nhập mã đúng định dạng DEV-XXXXXX (gồm 6 ký tự chữ hoặc số).",
      });
      return;
    }

    setIsRestoring(true);
    setRestoreFeedback(null);
    try {
      const res = await restoreByTransferCode(normalized);
      if (res.ok && res.player) {
        saveBackupTransferCode(res.player.transferCode);
        applyGuestPlayer(res.player);
        setRestoreCode("");
        setRestoreFeedback({
          ok: true,
          message: `Đã khôi phục hồ sơ ${res.player.displayName} (${res.player.transferCode}).`,
        });
        await refreshOnlineRank();
      } else {
        setRestoreFeedback({
          ok: false,
          message: toVietnameseError(res.error, res.mode),
        });
      }
    } catch {
      setRestoreFeedback({
        ok: false,
        message: "Khôi phục thất bại do lỗi kết nối. Vui lòng kiểm tra mã và thử lại.",
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleCosmeticAction = async (itemId: string, price: number, itemName: string) => {
    if (busyItemId || identity.mode !== "online") return;
    setBusyItemId(itemId);
    setShopFeedback(null);
    try {
      const res = await purchaseAndEquipCosmetic(
        itemId,
        price,
        readBackupTransferCode()
      );
      if (res.ok && res.player) {
        applyGuestPlayer(res.player);
        setShopFeedback({
          ok: true,
          message: `Đã trang bị "${itemName}".`,
        });
        void refreshOnlineRank();
      } else {
        if (res.mode === "offline") {
          applyGuestPlayer(null);
          setGlobalRank(null);
        }
        setShopFeedback({
          ok: false,
          message: toVietnameseError(res.error, res.mode),
        });
      }
    } catch {
      setShopFeedback({
        ok: false,
        message: "Không thể cập nhật vật phẩm lúc này. Vui lòng thử lại.",
      });
    } finally {
      setBusyItemId(null);
    }
  };

  const handleUnequipCosmetic = async (
    itemId: string,
    category: CosmeticCategory,
    itemName: string
  ) => {
    if (busyItemId || identity.mode !== "online") return;
    setBusyItemId(itemId);
    setShopFeedback(null);
    try {
      const res = await unequipCosmeticSlot(category, readBackupTransferCode());
      if (res.ok && res.player) {
        applyGuestPlayer(res.player);
        setShopFeedback({
          ok: true,
          message: `Đã tháo "${itemName}".`,
        });
        void refreshOnlineRank();
      } else {
        if (res.mode === "offline") {
          applyGuestPlayer(null);
          setGlobalRank(null);
        }
        setShopFeedback({
          ok: false,
          message: toVietnameseError(res.error, res.mode),
        });
      }
    } catch {
      setShopFeedback({
        ok: false,
        message: "Không thể tháo vật phẩm lúc này. Vui lòng thử lại.",
      });
    } finally {
      setBusyItemId(null);
    }
  };

  if (loading) {
    return (
      <div
        className="max-w-5xl mx-auto px-4 py-8 space-y-6"
        role="status"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="h-8 w-28 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
          <div className="h-5 w-44 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
        </div>
        <div className="liquid-glass-card p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 animate-pulse" />
            <div className="space-y-2 flex-1">
              <div className="h-6 w-48 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
              <div className="h-4 w-72 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
            </div>
          </div>
          <p className="text-sm font-mono text-slate-600 dark:text-slate-400">
            Đang tải hồ sơ SpeakIT và đồng bộ phiên khách...
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="h-44 liquid-glass-card p-5 animate-pulse" />
          <div className="h-44 liquid-glass-card p-5 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8 space-y-6 pb-16">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Trang chủ</span>
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2 ml-1">
              <User className="w-5 h-5 sm:w-6 sm:h-6 text-blue-700 dark:text-blue-400 shrink-0" aria-hidden="true" />
              <span>Hồ sơ người dùng</span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/shop"
              className="liquid-btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            >
              <ShoppingBag className="w-3.5 h-3.5" aria-hidden="true" />
              <span>IT-Coin Shop</span>
            </Link>
            <Link
              href="/progress"
              className="liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            >
              <span>Tiến độ 7 ngày</span>
            </Link>
            <Link
              href="/arena"
              className="liquid-btn-success inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            >
              <Gamepad2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>IT Arena</span>
            </Link>
          </div>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300 border-l-4 border-l-blue-700 dark:border-l-blue-500 bg-white dark:bg-slate-900 border-y border-r border-slate-200 dark:border-slate-800 rounded-r-xl px-4 py-2.5">
          Đổi tên hiển thị, lưu mã khôi phục thiết bị DEV-XXXXXX và dùng IT-Coin mở khóa hiệu ứng Discord-style tại{" "}
          <Link href="/shop" className="font-semibold text-blue-700 dark:text-blue-400 hover:underline">
            IT-Coin Shop
          </Link>
          .
        </p>

        <LeaderboardRowWrapper
          fxId={equippedCosmetics.leaderboard_fx}
          nameplateId={equippedCosmetics.nameplate}
          className="liquid-glass-card-lite p-5 sm:p-6"
        >
          <section
            aria-label="Thông tin định danh người học"
            className="space-y-5"
          >
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
              <div className="flex items-start gap-4 min-w-0">
                <DiscordAvatarFrame
                  equippedId={equippedCosmetics.avatar_decoration}
                  fallbackRing={identity.equippedRing}
                  size="lg"
                >
                  <PlayerAvatar
                    avatarUrl={identity.avatarUrl}
                    displayName={identity.displayName}
                    className="text-lg"
                  />
                </DiscordAvatarFrame>

            <div className="min-w-0 space-y-2 flex-1">
              {!isEditingName ? (
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate">
                    {identity.displayName}
                  </h2>
                  {guestPlayer?.email && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs font-medium text-blue-700 dark:text-blue-300">
                      <Mail className="w-3 h-3 text-blue-700 dark:text-blue-400" aria-hidden="true" />
                      <span>{guestPlayer.email}</span>
                    </span>
                  )}
                  {identity.transferCode && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-blue-700 dark:text-blue-400">
                      <KeyRound className="w-3 h-3 text-blue-700 dark:text-blue-400" aria-hidden="true" />
                      <span>{identity.transferCode}</span>
                    </span>
                  )}
                  {guestPlayer?.email && (
                    <button
                      type="button"
                      onClick={async () => {
                        await logoutAccountAction();
                        if (typeof window !== "undefined") {
                          try {
                            window.localStorage.removeItem("speakit_session_token_v1");
                          } catch {}
                        }
                        setGuestPlayer(null);
                        saveCachedGuestProfile(null);
                        requestOpenAuthModal();
                      }}
                      className="liquid-btn-danger inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors"
                    >
                      <LogOut className="w-3 h-3" aria-hidden="true" />
                      <span>Đăng xuất</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleStartRename}
                    disabled={identity.mode !== "online"}
                    aria-label="Chỉnh sửa tên hiển thị"
                    title="Chỉnh sửa tên hiển thị"
                    className="liquid-glass-btn inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Pencil className="w-3 h-3" aria-hidden="true" />
                    <span>Đổi tên</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAvatarPanelOpen((prev) => !prev);
                      setAvatarFeedback(null);
                    }}
                    disabled={identity.mode !== "online"}
                    aria-expanded={isAvatarPanelOpen}
                    title="Đổi Avatar"
                    className="liquid-glass-btn inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Camera className="w-3 h-3" aria-hidden="true" />
                    <span>Đổi Avatar</span>
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={handleRenameSubmit}
                  className="flex flex-wrap items-center gap-2"
                >
                  <label htmlFor="profile-display-name" className="sr-only">
                    Tên hiển thị mới
                  </label>
                  <input
                    id="profile-display-name"
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    minLength={2}
                    maxLength={24}
                    placeholder="Nhập tên (2-24 ký tự)"
                    className="liquid-glass-input px-3 py-1.5 text-sm font-medium rounded-lg focus:outline-none w-52"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={isSavingName}
                    className="liquid-btn-primary inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{isSavingName ? "Đang lưu..." : "Lưu"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingName(false);
                      setNameFeedback(null);
                    }}
                    disabled={isSavingName}
                    aria-label="Hủy chỉnh sửa tên"
                    className="liquid-glass-btn inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Hủy</span>
                  </button>
                </form>
              )}

              {nameFeedback && (
                <p
                  role="status"
                  className={`text-sm font-medium ${
                    nameFeedback.ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {nameFeedback.message}
                </p>
              )}

              {isAvatarPanelOpen && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Chọn Avatar Preset hoặc tải ảnh lên
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAvatarPanelOpen(false)}
                      aria-label="Đóng bảng chọn avatar"
                      className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-800"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {AVATAR_PRESETS.map((preset) => {
                      const isSelected = identity.avatarUrl === preset.id;
                      const PresetIcon = preset.icon;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          disabled={isSavingAvatar}
                          onClick={() => void handleSaveAvatar(preset.id)}
                          title={preset.label}
                          aria-label={preset.label}
                          className={`group flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                            isSelected
                              ? "border-blue-700 dark:border-blue-500 bg-blue-50 dark:bg-blue-950/40"
                              : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 hover:border-blue-600 dark:hover:border-blue-500"
                          }`}
                        >
                          <span
                            className={`w-9 h-9 rounded-full flex items-center justify-center ${preset.bgClass} ${preset.textClass}`}
                          >
                            <PresetIcon className="w-4 h-4" strokeWidth={2.2} aria-hidden="true" />
                          </span>
                          <span className="text-[11px] font-mono text-slate-700 dark:text-slate-300 truncate w-full text-center">
                            {preset.label.split(" ")[0]}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleAvatarFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isSavingAvatar}
                      onClick={() => avatarInputRef.current?.click()}
                      className="liquid-btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{isSavingAvatar ? "Đang lưu..." : "Tải ảnh lên"}</span>
                    </button>
                    <button
                      type="button"
                      disabled={isSavingAvatar || !identity.avatarUrl}
                      onClick={() => void handleSaveAvatar(null)}
                      className="liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Đặt lại</span>
                    </button>
                  </div>

                  {avatarFeedback && (
                    <p
                      role="status"
                      className={`text-sm font-medium ${
                        avatarFeedback.ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {avatarFeedback.message}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-mono font-semibold">
                  <Award className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" aria-hidden="true" />
                  <span>{identity.equippedTitle}</span>
                </span>

                {identity.mode === "online" && (
                  <Link
                    href="/arena"
                    className="liquid-glass-pill inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 hover:border-blue-600 transition-colors"
                  >
                    <Trophy className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                    <span>
                      {globalRank !== null ? `#${globalRank} Toàn cầu` : "Hạng toàn cầu"}
                    </span>
                  </Link>
                )}

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 dark:bg-green-950/40 border border-green-300 dark:border-green-800 text-xs font-mono font-bold text-green-700 dark:text-green-300">
                  <Flame className="w-3.5 h-3.5 fill-green-600 text-green-700 dark:text-green-400" aria-hidden="true" />
                  <span>{identity.streakDays} ngày streak</span>
                </span>

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs font-mono font-bold text-amber-700 dark:text-amber-300">
                  <Coins className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                  <span>{identity.itCoins} IT-Coin</span>
                </span>
              </div>
            </div>
          </div>

          <div className="md:text-right shrink-0 border-l-2 border-blue-700 dark:border-blue-500 pl-4 py-1 font-mono">
            <div className="text-[11px] uppercase text-slate-600 dark:text-slate-400">Tổng điểm tích lũy</div>
            <div className="text-xl font-bold text-blue-700 dark:text-blue-400">
              {identity.totalPoints.toLocaleString("vi-VN")} pts
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {activity.devTitle.nextTitle && activity.devTitle.nextThreshold !== null ? (
                  <>
                    Lộ trình lên{" "}
                    <span className="font-mono text-blue-700 dark:text-blue-400">
                      {activity.devTitle.nextTitle}
                    </span>
                  </>
                ) : (
                  "Cấp bậc cao nhất: Lead Tech Speaker"
                )}
              </span>
              <span className="font-mono font-bold text-green-700 dark:text-green-400">
                {activity.devTitle.progressPct}%
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Tiến độ thăng hạng danh hiệu"
              aria-valuenow={activity.devTitle.progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden"
            >
              <div
                className="w-full h-full bg-blue-700 dark:bg-blue-500 origin-left transition-transform duration-500"
                style={{
                  transform: `scaleX(${Math.max(
                    activity.devTitle.progressPct > 0 ? 0.04 : 0,
                    Math.min(1, activity.devTitle.progressPct / 100)
                  )})`,
                }}
              />
            </div>
            <p className="text-sm font-mono text-slate-600 dark:text-slate-400">
              {activity.devTitle.nextTitle && activity.devTitle.nextThreshold !== null
                ? `Còn ${Math.max(
                    0,
                    activity.devTitle.nextThreshold - identity.totalPoints
                  ).toLocaleString("vi-VN")} điểm nữa (mốc ${activity.devTitle.nextThreshold.toLocaleString("vi-VN")})`
                : `Đã vượt mốc 5.000 điểm (${identity.totalPoints.toLocaleString("vi-VN")} pts)`}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                Tiến độ +1 IT-Coin tiếp theo
              </span>
              <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                {coinEarnedInTier} / {POINTS_PER_COIN} pts
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Tiến độ nhận IT-Coin tiếp theo"
              aria-valuenow={coinProgressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden"
            >
              <div
                className="w-full h-full bg-amber-600 dark:bg-amber-500 origin-left transition-transform duration-500"
                style={{
                  transform: `scaleX(${Math.max(
                    coinEarnedInTier > 0 ? 0.04 : 0,
                    Math.min(1, coinProgressPct / 100)
                  )})`,
                }}
              />
            </div>
            <p className="text-sm font-mono text-slate-600 dark:text-slate-400">
              Còn {activity.nextCoinPoints.toLocaleString("vi-VN")} điểm để nhận +1 IT-Coin (1.000 điểm = 1 Coin)
            </p>
          </div>
        </div>
      </section>
      </LeaderboardRowWrapper>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section
          aria-label="Chọn vai trò CNTT"
          className="liquid-glass-card-lite p-5 flex flex-col justify-between gap-4"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider font-mono">
                Vai trò CNTT của bạn
              </h2>
              <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                Đồng bộ toàn app
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5" role="group" aria-label="Danh sách vai trò CNTT">
              {IT_ROLES.map((role) => {
                const Icon = ROLE_ICONS[role.id];
                const isSelected = gamification.selectedRole === role.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleSelectRole(role.id)}
                    className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg border text-xs font-semibold transition-colors text-left ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-700 dark:border-blue-500"
                        : "bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isSelected ? "text-blue-700 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"
                      }`}
                      aria-hidden="true"
                    />
                    <span>{role.label}</span>
                  </button>
                );
              })}
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-l-2 border-slate-300 dark:border-slate-700 pl-3 py-1">
              <strong className="text-slate-900 dark:text-slate-100">{activeRole.label}:</strong>{" "}
              {activeRole.taglineVI}
            </p>
          </div>

          <Link
            href={`/practice/${activeRole.recommendedScenarioId}`}
            className="liquid-btn-primary inline-flex items-center justify-between gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors"
          >
            <span>Luyện tình huống gợi ý: {recommendedScenarioTitle}</span>
            <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
          </Link>
        </section>

        <section
          aria-label="Mã chuyển thiết bị và khôi phục hồ sơ"
          className="liquid-glass-card-lite p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-blue-700 dark:text-blue-400" aria-hidden="true" />
              <span>Mã chuyển thiết bị</span>
            </h2>
          </div>

          {identity.transferCode ? (
            <div className="py-3 border-y border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-mono uppercase text-slate-600 dark:text-slate-400">
                  Mã sao lưu cá nhân (Transfer Code)
                </div>
                <div className="text-base font-mono font-bold text-blue-700 dark:text-blue-400 tracking-wider mt-0.5">
                  {identity.transferCode}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyTransferCode}
                aria-label="Sao chép mã chuyển thiết bị"
                className="liquid-glass-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-mono font-semibold shrink-0 transition-colors"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-green-700 dark:text-green-400" aria-hidden="true" />
                    <span>Đã chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Sao chép</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <p className="py-3 border-y border-slate-200 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-300">
              Mã <code className="font-mono text-blue-700 dark:text-blue-400">DEV-XXXXXX</code> sẽ tự động được cấp cho hồ sơ của bạn để đồng bộ tiến độ giữa các thiết bị.
            </p>
          )}

          {copiedCode && (
            <div
              role="status"
              className="text-sm font-mono text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/40 border border-green-300 dark:border-green-800 rounded-lg px-3 py-2"
            >
              Đã sao chép mã chuyển thiết bị vào clipboard!
            </div>
          )}

          {copyNote && (
            <div className="text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-lg px-3 py-2">
              {copyNote}
            </div>
          )}

          <form onSubmit={handleRestoreSubmit} className="space-y-2">
            <label
              htmlFor="restore-transfer-code"
              className="block text-xs font-semibold text-slate-900 dark:text-slate-100"
            >
              Khôi phục hồ sơ từ thiết bị khác
            </label>
            <div className="flex items-center gap-2">
              <input
                id="restore-transfer-code"
                type="text"
                value={restoreCode}
                onChange={(e) => setRestoreCode(e.target.value.toUpperCase())}
                placeholder="DEV-XXXXXX"
                maxLength={16}
                className="liquid-glass-input flex-1 px-3 py-2 text-xs font-mono uppercase rounded-lg focus:outline-none"
              />
              <button
                type="submit"
                disabled={isRestoring || !restoreCode.trim()}
                className="liquid-btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed shrink-0 transition-colors"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isRestoring ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                <span>{isRestoring ? "Đang khôi phục..." : "Khôi phục"}</span>
              </button>
            </div>
          </form>

          {restoreFeedback && (
            <div
              role="status"
              className={`text-sm p-2.5 rounded-lg border ${
                restoreFeedback.ok
                  ? "bg-green-50 dark:bg-green-950/40 border-green-300 dark:border-green-800 text-green-700 dark:text-green-300"
                  : "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-600 dark:text-red-300"
              }`}
            >
              {restoreFeedback.message}
            </div>
          )}
        </section>
      </div>

      <section
        aria-label="Kệ Danh hiệu và Viền Avatar"
        className="liquid-glass-card-lite p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <span>IT-Coin Cosmetic Armory</span>
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
              Đã sở hữu {COSMETIC_CATALOG.filter((item) => identity.ownedItems.includes(item.id)).length}/{COSMETIC_CATALOG.length} hiệu ứng : Xem nhanh tối đa 4 vật phẩm nổi bật.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="liquid-glass-pill px-3 py-1.5 text-xs font-mono font-bold text-amber-700 dark:text-amber-300">
              {identity.itCoins} IT-Coin
            </span>
            <Link
              href="/shop"
              className="liquid-btn-primary inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors"
            >
              <span>Vào Cửa Hàng Hiệu Ứng →</span>
            </Link>
          </div>
        </div>

        {shopFeedback && (
          <div
            role="status"
            className={`p-3 rounded-lg border text-sm ${
              shopFeedback.ok
                ? "bg-green-50 dark:bg-green-950/40 border-green-300 dark:border-green-800 text-green-700 dark:text-green-300"
                : "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-600 dark:text-red-300"
            }`}
          >
            {shopFeedback.message}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 border-t border-slate-200 dark:border-slate-800 pt-4">
          {armoryPreviewItems.map((item) => {
            const isOnline = identity.mode === "online";
            const isOwned = identity.ownedItems.includes(item.id);
            const isEquipped =
              equippedCosmetics[item.category] === item.id ||
              (item.kind === "title" && identity.equippedTitle === item.value) ||
              (item.kind === "ring" && identity.equippedRing === item.value);

            return (
              <div
                key={item.id}
                className="border-l-2 border-slate-200 dark:border-slate-700 pl-3 py-1 flex flex-col justify-between gap-2.5"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        aria-hidden="true"
                        className="w-2.5 h-2.5 rounded-full shrink-0 border border-slate-300 dark:border-slate-600"
                        style={{ backgroundColor: item.previewAccent }}
                      />
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {item.name}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono uppercase px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 shrink-0">
                      {item.rarity}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-1">
                    {item.description}
                  </p>
                </div>

                {isEquipped ? (
                  <div className="flex items-center gap-1.5">
                    <span className="liquid-btn-success flex-1 inline-flex items-center justify-center gap-1 py-1 px-2.5 rounded-lg text-xs font-mono font-semibold">
                      <Check className="w-3 h-3" aria-hidden="true" />
                      <span>Đang dùng</span>
                    </span>
                    {isOnline && (
                      <button
                        type="button"
                        disabled={busyItemId === item.id}
                        onClick={() =>
                          handleUnequipCosmetic(item.id, item.category, item.name)
                        }
                        className="liquid-glass-btn py-1 px-2.5 rounded-lg text-xs font-mono font-semibold transition-colors disabled:opacity-50"
                      >
                        {busyItemId === item.id ? "..." : "Tháo"}
                      </button>
                    )}
                  </div>
                ) : isOwned && isOnline ? (
                  <button
                    type="button"
                    disabled={busyItemId === item.id}
                    onClick={() => handleCosmeticAction(item.id, item.price, item.name)}
                    className="liquid-glass-btn w-full py-1 px-3 rounded-lg text-xs font-mono font-semibold transition-colors disabled:opacity-50"
                  >
                    {busyItemId === item.id ? "Đang cập nhật..." : "Trang bị nhanh"}
                  </button>
                ) : (
                  <span className="w-full inline-flex items-center justify-center py-1 px-2.5 rounded-lg text-xs font-mono font-semibold border bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700">
                    Xem trước : {item.price} Coin
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-800 text-sm">
          <span className="text-slate-600 dark:text-slate-300">
            Khám phá toàn bộ {COSMETIC_CATALOG.length} hiệu ứng viền, bảng tên và chủ đề hồ sơ.
          </span>
          <Link
            href="/shop"
            className="inline-flex items-center gap-1 font-semibold text-blue-700 dark:text-blue-400 hover:underline"
          >
            <span>Mua thêm tại Cửa hàng</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section
        aria-label="Tổng quan hoạt động luyện nói và Arena"
        className="liquid-glass-card-lite p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
              <History className="w-4 h-4 text-green-700 dark:text-green-400" aria-hidden="true" />
              <span>Hoạt động Luyện nói &amp; Arena</span>
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
              {activity.scenariosPracticed > 0
                ? `Đã luyện ${activity.scenariosPracticed} tình huống khác nhau (${localSpeakingCount} lượt nói${localArenaCount > 0 ? `, ${localArenaCount} trận Arena` : ""}).`
                : localArenaCount > 0
                  ? `Đã hoàn thành ${localArenaCount} trận Arena.`
                  : hasCloudPoints
                    ? `Tài khoản ${identity.transferCode ?? ""} đã tích lũy ${identity.totalPoints.toLocaleString("vi-VN")} điểm.`
                    : "Chưa có tình huống nào được luyện."}
            </p>
          </div>
          <Link
            href="/progress"
            className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-blue-700 dark:text-blue-400 hover:underline transition-colors"
          >
            <span>Xem kế hoạch 7 ngày</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/60">
          <div className="p-3.5 text-center">
            <div className="text-2xl font-mono font-extrabold text-slate-900 dark:text-slate-100">
              {summaryStats.totalSessions > 0
                ? summaryStats.totalSessions
                : hasCloudPoints
                  ? identity.totalPoints.toLocaleString("vi-VN")
                  : 0}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center justify-center gap-1">
              {localSpeakingCount === 0 && localArenaCount > 0 ? (
                <Gamepad2 className="w-3 h-3 text-green-700 dark:text-green-400" aria-hidden="true" />
              ) : (localSpeakingCount > 0 && localArenaCount > 0) || (localSpeakingCount === 0 && hasCloudPoints) ? (
                <Trophy className="w-3 h-3 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              ) : (
                <Mic className="w-3 h-3 text-blue-700 dark:text-blue-400" aria-hidden="true" />
              )}
              <span>
                {localSpeakingCount > 0 && localArenaCount > 0
                  ? "Tổng phiên hoàn thành"
                  : localSpeakingCount > 0
                    ? "Số lượt luyện nói"
                    : localArenaCount > 0
                      ? "Trận Arena đã chơi"
                      : hasCloudPoints
                        ? "Tổng điểm tích lũy"
                        : "Số lượt luyện nói"}
              </span>
            </div>
          </div>

          <div className="p-3.5 text-center">
            <div className="text-2xl font-mono font-extrabold text-blue-700 dark:text-blue-400">
              {summaryStats.averageScore}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Điểm TB</div>
          </div>

          <div className="p-3.5 text-center">
            <div className="text-2xl font-mono font-extrabold text-amber-700 dark:text-amber-400">
              {summaryStats.bestScore}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Điểm cao nhất</div>
          </div>

          <div className="p-3.5 text-center">
            <div className="text-2xl font-mono font-extrabold text-green-700 dark:text-green-400">
              {activity.bugBusterBest}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center justify-center gap-1">
              <Bug className="w-3 h-3 text-green-700 dark:text-green-400" aria-hidden="true" />
              <span>Bug Buster Best</span>
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 p-3.5 text-center">
            <div className="text-2xl font-mono font-extrabold text-slate-900 dark:text-slate-100">
              {activity.standupBest}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center justify-center gap-1">
              <Timer className="w-3 h-3 text-blue-700 dark:text-blue-400" aria-hidden="true" />
              <span>Standup Best</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold font-mono uppercase text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                <span>Từ khóa &amp; điểm yếu hay gặp</span>
              </h3>
              <Link
                href="/vocabulary"
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline"
              >
                <BookOpen className="w-3 h-3" aria-hidden="true" />
                <span>Ôn từ vựng</span>
              </Link>
            </div>

            {activity.topWeakPoints.length === 0 ? (
              <div className="border-l-2 border-slate-300 dark:border-slate-700 pl-3 py-1 space-y-2.5">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Chưa ghi nhận từ khóa hay lỗi ngữ pháp nào. Hãy luyện nói ít nhất 1 lượt để SpeakIT tổng hợp điểm cần cải thiện.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/vocabulary"
                    className="liquid-glass-btn inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  >
                    <span>Mở kho từ vựng</span>
                  </Link>
                  <Link
                    href={`/practice/${activeRole.recommendedScenarioId}`}
                    className="liquid-btn-primary inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  >
                    <span>Luyện tình huống gợi ý</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {activity.topWeakPoints.map((wp) => {
                  const targetScenarioId = findScenarioForWeakPoint(
                    wp.value,
                    scenarios,
                    activeRole.recommendedScenarioId
                  );
                  return (
                    <div
                      key={wp.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 shrink-0">
                          {wp.kind === "keyword" ? "Từ khóa" : "Ngữ pháp"}
                        </span>
                        <span className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100 truncate">
                          {wp.value}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-mono font-bold text-red-600 dark:text-red-400">
                          {wp.miss_count} lần
                        </span>
                        <Link
                          href={`/practice/${targetScenarioId}`}
                          className="liquid-glass-btn text-xs font-semibold px-2.5 py-1 rounded-lg"
                        >
                          Luyện lại
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold font-mono uppercase text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-green-700 dark:text-green-400" aria-hidden="true" />
                <span>Lượt luyện nói &amp; Arena gần đây</span>
              </h3>
              <Link
                href="/scenarios"
                className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline transition-colors"
              >
                Chọn kịch bản mới →
              </Link>
            </div>

            {activity.recentAttempts.length === 0 && recentArenaRuns.length === 0 ? (
              <div className="border-l-2 border-slate-300 dark:border-slate-700 pl-3 py-1 space-y-2.5">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {hasCloudPoints
                    ? `Tài khoản ${identity.transferCode ?? ""} đã tích lũy ${identity.totalPoints.toLocaleString("vi-VN")} điểm. Hãy luyện thêm một tình huống hoặc trận Arena để xem chi tiết tại đây.`
                    : "Bạn chưa có lượt luyện nói nào được ghi nhận."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/scenarios"
                    className="liquid-btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <span>Bắt đầu luyện nói ngay</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                  {hasCloudPoints && (
                    <Link
                      href="/arena"
                      className="liquid-glass-btn inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    >
                      <Gamepad2 className="w-3.5 h-3.5 text-green-700 dark:text-green-400" aria-hidden="true" />
                      <span>Vào Arena</span>
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {activity.recentAttempts.map((attempt) => {
                  const titleVI =
                    scenarioTitleMap.get(attempt.scenario) ?? attempt.scenario;
                  return (
                    <Link
                      key={attempt.id}
                      href={`/practice/${attempt.scenario}`}
                      className="block py-2.5 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors space-y-1 px-2 -mx-2 rounded-lg"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                          {titleVI}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs font-mono font-bold text-blue-700 dark:text-blue-300 shrink-0">
                          {attempt.score}/100
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs font-mono text-slate-600 dark:text-slate-400">
                        <span>Lượt {attempt.turn_index + 1}</span>
                        <span>{formatAttemptDate(attempt.created_at)}</span>
                      </div>
                      {attempt.transcript && (
                        <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 pt-0.5">
                          “{attempt.transcript}”
                        </p>
                      )}
                    </Link>
                  );
                })}
                {recentArenaRuns.map((run) => (
                  <Link
                    key={run.id}
                    href="/arena"
                    className="block py-2.5 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors space-y-1 px-2 -mx-2 rounded-lg"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5">
                        <Gamepad2 className="w-3.5 h-3.5 text-green-700 dark:text-green-400 shrink-0" aria-hidden="true" />
                        <span>
                          {run.gameId === "bug-buster" ? "Bug Buster Arena" : "Standup Speed Run"}
                        </span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-950/40 border border-green-300 dark:border-green-800 text-xs font-mono font-bold text-green-700 dark:text-green-300 shrink-0">
                        {run.score.toLocaleString("vi-VN")} pts
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs font-mono text-slate-600 dark:text-slate-400">
                      <span>
                        {run.gameId === "bug-buster"
                          ? `${run.accuracyOrWords}% chính xác`
                          : `${run.accuracyOrWords} từ khóa`}
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        {run.durationSec > 0 && (
                          <span>Thời lượng: {run.durationSec}s</span>
                        )}
                        <span>{formatAttemptDate(run.createdAt)}</span>
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Bug,
  Check,
  Cloud,
  Code2,
  Coins,
  Copy,
  Flame,
  Gamepad2,
  History,
  KeyRound,
  Mic,
  Pencil,
  RefreshCw,
  Server,
  ShoppingBag,
  Terminal,
  Timer,
  Trophy,
  User,
  WifiOff,
  X,
} from "lucide-react";
import {
  getTopPlayers,
  initOrHydrateGuestSession,
  purchaseAndEquipCosmetic,
  restoreByTransferCode,
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
import { COSMETIC_CATALOG, getRingBadgeClass } from "../../lib/cosmetics";
import type { PublicGuestPlayer } from "../../lib/db";
import {
  GAMIFICATION_STORAGE_KEY,
  GAMIFICATION_UPDATED_EVENT,
  POINTS_PER_COIN,
  getGamificationState,
  setSelectedRole,
} from "../../lib/gamification";
import {
  readBackupTransferCode,
  saveBackupTransferCode,
} from "../../lib/guestClient";
import {
  mergeProfileIdentity,
  summarizeProfileActivity,
} from "../../lib/profileStats";
import { storageAdapter } from "../../lib/storage";
import type {
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

function getAvatarInitials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return "DV";
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const first = Array.from(words[0])[0] ?? "";
    const second = Array.from(words[1])[0] ?? "";
    return `${first}${second}`.toUpperCase() || "DV";
  }
  const letters = Array.from(cleaned.replace(/[^a-zA-Z0-9\u00C0-\u1EFF]/g, ""));
  return (letters.slice(0, 2).join("") || Array.from(cleaned).slice(0, 2).join("")).toUpperCase() || "DV";
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
    return "Chức năng này cần kết nối Neon DB. Hiện tại hồ sơ đang hoạt động ở chế độ Local.";
  }
  switch (rawError) {
    case "Display name must be between 2 and 24 characters.":
      return "Tên hiển thị phải dài từ 2 đến 24 ký tự.";
    case "Database is unavailable in offline mode.":
    case "Cosmetic shop requires Neon DB connection.":
      return "Chức năng này cần kết nối Neon DB. Vui lòng thử lại khi trực tuyến.";
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
      return "Không thể khôi phục phiên từ Neon DB. Vui lòng thử lại sau.";
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

  const refreshOnlineRank = useCallback(async () => {
    try {
      const board = await getTopPlayers(50);
      if (board.mode === "online") {
        setGlobalRank(board.currentUserRank?.rank ?? null);
        if (board.currentPlayer) {
          setGuestPlayer(board.currentPlayer);
        }
      } else {
        setGlobalRank(null);
      }
    } catch {
      setGlobalRank(null);
    }
  }, []);

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
          setGuestPlayer(board.currentPlayer ?? session.player);
          setGlobalRank(board.currentUserRank?.rank ?? null);
        } else if (session.mode === "online" && session.player) {
          setGuestPlayer(session.player);
          setGlobalRank(null);
        } else {
          setGuestPlayer(null);
          setGlobalRank(null);
        }
      } else {
        setGuestPlayer(null);
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

    window.addEventListener(GAMIFICATION_UPDATED_EVENT, syncGamification);
    window.addEventListener(CONTENT_UPDATED_EVENT, syncContent);
    window.addEventListener("storage", handleStorage);

    return () => {
      active = false;
      window.removeEventListener(GAMIFICATION_UPDATED_EVENT, syncGamification);
      window.removeEventListener(CONTENT_UPDATED_EVENT, syncContent);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const identity = useMemo(
    () => mergeProfileIdentity(guestPlayer, gamification),
    [guestPlayer, gamification]
  );

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
        setGuestPlayer(res.player);
        setIsEditingName(false);
        setNameFeedback({
          ok: true,
          message: `Đã cập nhật tên thành "${res.player.displayName}".`,
        });
        void refreshOnlineRank();
      } else {
        if (res.mode === "offline") {
          setGuestPlayer(null);
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
        setGuestPlayer(res.player);
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
        setGuestPlayer(res.player);
        setShopFeedback({
          ok: true,
          message: `Đã trang bị "${itemName}".`,
        });
        void refreshOnlineRank();
      } else {
        if (res.mode === "offline") {
          setGuestPlayer(null);
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

  if (loading) {
    return (
      <div
        className="max-w-5xl mx-auto px-4 py-8 space-y-6"
        role="status"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="h-8 w-28 rounded-pill bg-paper-muted border border-ink/10" />
          <div className="h-5 w-44 rounded-pill bg-paper-muted border border-ink/10" />
        </div>
        <div className="bg-white border border-ink/15 rounded-2xl p-6 shadow-soft space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-paper-muted border border-ink/10 shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-6 w-48 rounded-lg bg-paper-muted" />
              <div className="h-4 w-72 rounded-lg bg-paper-muted" />
            </div>
          </div>
          <p className="text-xs font-mono text-ink-muted">
            Đang tải hồ sơ SpeakIT và đồng bộ phiên khách...
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="h-44 bg-white border border-ink/15 rounded-2xl p-5 shadow-soft" />
          <div className="h-44 bg-white border border-ink/15 rounded-2xl p-5 shadow-soft" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6 pb-16">
      {/* Top Breadcrumb & Quick Links */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white text-ink text-xs font-medium border border-ink/15 shadow-soft hover:bg-paper-muted shadow-hard-press transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Trang chủ</span>
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2 ml-1">
            <User className="w-5 h-5 sm:w-6 sm:h-6 text-accent shrink-0" aria-hidden="true" />
            <span>Hồ sơ người dùng</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/progress"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white text-ink text-xs font-medium border border-ink/15 shadow-soft hover:bg-paper-muted transition-colors"
          >
            <span>Tiến độ 7 ngày</span>
          </Link>
          <Link
            href="/arena"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-ink text-white text-xs font-semibold border border-ink shadow-soft hover:bg-ink/90 transition-colors"
          >
            <Gamepad2 className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
            <span>IT Arena</span>
          </Link>
        </div>
      </div>

      {/* 1. Identity Header Card */}
      <section
        aria-label="Thông tin định danh người học"
        className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-5"
      >
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
          <div className="flex items-start gap-4 min-w-0">
            <div
              aria-label={`Avatar của ${identity.displayName}`}
              className={`w-16 h-16 rounded-full bg-paper border-2 flex items-center justify-center font-mono font-bold text-lg text-ink shrink-0 ${getRingBadgeClass(
                identity.equippedRing
              )}`}
            >
              {getAvatarInitials(identity.displayName)}
            </div>

            <div className="min-w-0 space-y-2 flex-1">
              {!isEditingName ? (
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-ink truncate">
                    {identity.displayName}
                  </h2>
                  <button
                    type="button"
                    onClick={handleStartRename}
                    disabled={identity.mode !== "online"}
                    aria-label="Chỉnh sửa tên hiển thị"
                    title={
                      identity.mode === "online"
                        ? "Chỉnh sửa tên hiển thị"
                        : "Đổi tên yêu cầu kết nối Neon DB"
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill bg-paper border border-ink/15 text-xs font-medium text-ink hover:bg-paper-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Pencil className="w-3 h-3" aria-hidden="true" />
                    <span>Đổi tên</span>
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
                    placeholder="Nhập tên (2–24 ký tự)"
                    className="px-3 py-1.5 text-sm font-medium bg-paper border border-ink/20 rounded-xl text-ink focus:outline-none focus:border-accent w-52"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={isSavingName}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-pill bg-ink text-white text-xs font-semibold border border-ink disabled:opacity-50"
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
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-pill bg-white text-ink text-xs font-medium border border-ink/15 hover:bg-paper-muted"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Hủy</span>
                  </button>
                </form>
              )}

              {identity.mode === "offline" && (
                <p className="text-[11px] text-ink-muted">
                  Chế độ cục bộ (Offline): đổi tên trực tuyến tạm khóa khi chưa kết nối Neon DB.
                </p>
              )}

              {nameFeedback && (
                <p
                  role="status"
                  className={`text-xs font-medium ${
                    nameFeedback.ok ? "text-ink" : "text-accent"
                  }`}
                >
                  {nameFeedback.message}
                </p>
              )}

              {/* Badges Row */}
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-ink text-white text-xs font-mono font-semibold">
                  <Award className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
                  <span>{identity.equippedTitle}</span>
                </span>

                {identity.mode === "online" ? (
                  <Link
                    href="/arena"
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-paper border border-ink/15 text-xs font-mono font-bold text-ink hover:bg-paper-muted transition-colors"
                  >
                    <Trophy className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
                    <span>
                      {globalRank !== null ? `#${globalRank} Toàn cầu` : "Hạng toàn cầu"}
                    </span>
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-paper-muted border border-ink/15 text-xs font-mono font-semibold text-ink-muted">
                    <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Local Mode</span>
                  </span>
                )}

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-accent-light border border-accent/30 text-xs font-mono font-bold text-accent">
                  <Flame className="w-3.5 h-3.5 fill-accent text-accent" aria-hidden="true" />
                  <span>{identity.streakDays} ngày streak</span>
                </span>

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-paper border border-ink/15 text-xs font-mono font-bold text-ink">
                  <Coins className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
                  <span>{identity.itCoins} IT-Coin</span>
                </span>
              </div>
            </div>
          </div>

          <div className="md:text-right shrink-0 bg-paper border border-ink/15 rounded-xl px-4 py-3 font-mono">
            <div className="text-[11px] uppercase text-ink-muted">Tổng điểm tích lũy</div>
            <div className="text-xl font-bold text-ink">
              {identity.totalPoints.toLocaleString("vi-VN")} pts
            </div>
          </div>
        </div>

        {/* Progress Bars: Next Title & Next 1000-pt Coin */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-paper border border-ink/15 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-ink">
                {activity.devTitle.nextTitle && activity.devTitle.nextThreshold !== null ? (
                  <>
                    Lộ trình lên{" "}
                    <span className="font-mono text-accent">
                      {activity.devTitle.nextTitle}
                    </span>
                  </>
                ) : (
                  "Cấp bậc cao nhất: Lead Tech Speaker"
                )}
              </span>
              <span className="font-mono font-bold text-ink">
                {activity.devTitle.progressPct}%
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Tiến độ thăng hạng danh hiệu"
              aria-valuenow={activity.devTitle.progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              className="w-full h-2.5 bg-white rounded-pill border border-ink/15 overflow-hidden"
            >
              <div
                className="h-full bg-ink transition-all duration-500"
                style={{
                  width: `${Math.max(
                    activity.devTitle.progressPct > 0 ? 4 : 0,
                    activity.devTitle.progressPct
                  )}%`,
                }}
              />
            </div>
            <p className="text-[11px] font-mono text-ink-muted">
              {activity.devTitle.nextTitle && activity.devTitle.nextThreshold !== null
                ? `Còn ${Math.max(
                    0,
                    activity.devTitle.nextThreshold - identity.totalPoints
                  ).toLocaleString("vi-VN")} điểm nữa (mốc ${activity.devTitle.nextThreshold.toLocaleString("vi-VN")})`
                : `Đã vượt mốc 5.000 điểm (${identity.totalPoints.toLocaleString("vi-VN")} pts)`}
            </p>
          </div>

          <div className="bg-paper border border-ink/15 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-ink">
                Tiến độ +1 IT-Coin tiếp theo
              </span>
              <span className="font-mono font-bold text-accent">
                {coinEarnedInTier} / {POINTS_PER_COIN} pts
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Tiến độ nhận IT-Coin tiếp theo"
              aria-valuenow={coinProgressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              className="w-full h-2.5 bg-white rounded-pill border border-ink/15 overflow-hidden"
            >
              <div
                className="h-full bg-accent transition-all duration-500"
                style={{
                  width: `${Math.max(coinEarnedInTier > 0 ? 4 : 0, coinProgressPct)}%`,
                }}
              />
            </div>
            <p className="text-[11px] font-mono text-ink-muted">
              Còn {activity.nextCoinPoints.toLocaleString("vi-VN")} điểm để nhận +1 IT-Coin (1.000 điểm = 1 Coin)
            </p>
          </div>
        </div>
      </section>

      {/* 2. IT Role Selector & 3. Zero-Login Transfer Code */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* IT Role Selector */}
        <section
          aria-label="Chọn vai trò CNTT"
          className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft flex flex-col justify-between gap-4"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-ink uppercase tracking-wider font-mono">
                Vai trò CNTT của bạn
              </h2>
              <span className="text-[11px] font-mono text-ink-muted">
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
                    className={`flex items-center gap-2 px-3.5 py-2.5 rounded-pill border text-xs font-semibold transition-all text-left ${
                      isSelected
                        ? "bg-ink text-white border-ink shadow-soft"
                        : "bg-paper text-ink border-ink/15 hover:bg-paper-muted"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isSelected ? "text-accent" : "text-ink-muted"
                      }`}
                      aria-hidden="true"
                    />
                    <span>{role.label}</span>
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-ink-muted leading-relaxed bg-paper border border-ink/10 rounded-xl p-3">
              <strong className="text-ink">{activeRole.label}:</strong>{" "}
              {activeRole.taglineVI}
            </p>
          </div>

          <Link
            href={`/practice/${activeRole.recommendedScenarioId}`}
            className="inline-flex items-center justify-between gap-2 px-4 py-2.5 rounded-pill bg-accent hover:bg-accent-hover text-white text-xs font-semibold border border-accent shadow-soft transition-colors"
          >
            <span>Luyện tình huống gợi ý: {recommendedScenarioTitle}</span>
            <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
          </Link>
        </section>

        {/* Zero-Login Identity & Transfer Code Card */}
        <section
          aria-label="Danh tính Zero-Login và khôi phục thiết bị"
          className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-ink uppercase tracking-wider font-mono flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-accent" aria-hidden="true" />
              <span>Zero-Login &amp; Mã chuyển thiết bị</span>
            </h2>

            {identity.mode === "online" ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill bg-paper border border-ink/15 text-[11px] font-mono font-semibold text-ink">
                <Cloud className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
                <span>Neon Cloud Online</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill bg-paper-muted border border-ink/15 text-[11px] font-mono font-semibold text-ink-muted">
                <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Offline (Local)</span>
              </span>
            )}
          </div>

          {identity.transferCode ? (
            <div className="p-3.5 bg-paper border border-ink/15 rounded-xl flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase text-ink-muted">
                  Mã sao lưu cá nhân (Transfer Code)
                </div>
                <div className="text-base font-mono font-bold text-ink tracking-wider mt-0.5">
                  {identity.transferCode}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyTransferCode}
                aria-label="Sao chép mã chuyển thiết bị"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-pill bg-white border border-ink/15 text-xs font-mono font-semibold text-ink hover:bg-paper-muted shadow-soft shrink-0"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
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
            <div className="p-3.5 bg-paper border border-ink/15 rounded-xl text-xs text-ink-muted">
              Mã <code className="font-mono text-ink">DEV-XXXXXX</code> sẽ tự động được cấp khi kết nối Neon DB. Điểm và lịch sử hiện tại vẫn lưu an toàn trong trình duyệt.
            </div>
          )}

          {copiedCode && (
            <div
              role="status"
              className="text-xs font-mono text-ink bg-paper-muted border border-ink/15 rounded-xl px-3 py-2"
            >
              Đã sao chép mã chuyển thiết bị vào clipboard!
            </div>
          )}

          {copyNote && (
            <div className="text-xs text-accent bg-accent-light border border-accent/30 rounded-xl px-3 py-2">
              {copyNote}
            </div>
          )}

          <form onSubmit={handleRestoreSubmit} className="space-y-2">
            <label
              htmlFor="restore-transfer-code"
              className="block text-xs font-semibold text-ink"
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
                className="flex-1 px-3 py-2 text-xs font-mono uppercase bg-paper border border-ink/15 rounded-xl text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={isRestoring || !restoreCode.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-ink text-white text-xs font-semibold border border-ink hover:bg-ink/90 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
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
              className={`text-xs p-2.5 rounded-xl border ${
                restoreFeedback.ok
                  ? "bg-paper border-ink/20 text-ink"
                  : "bg-accent-light border-accent/30 text-accent"
              }`}
            >
              {restoreFeedback.message}
            </div>
          )}
        </section>
      </div>

      {/* 4. Cosmetics & Titles Shelf */}
      <section
        aria-label="Kệ Danh hiệu và Viền Avatar"
        className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-ink uppercase tracking-wider font-mono flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-accent" aria-hidden="true" />
              <span>Danh hiệu &amp; Viền Avatar (Cosmetics)</span>
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Dùng IT-Coin tích lũy từ luyện nói và Arena để mở khóa hoặc trang bị vật phẩm.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-pill bg-paper border border-ink/15 text-xs font-mono font-bold text-ink">
              Số dư: {identity.itCoins} IT-Coin
            </span>
            <Link
              href="/arena"
              className="inline-flex items-center gap-1 px-3 py-1 rounded-pill bg-paper-muted border border-ink/15 text-xs font-semibold text-ink hover:bg-paper transition-colors"
            >
              <span>Kiếm thêm ở Arena</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {shopFeedback && (
          <div
            role="status"
            className={`p-3 rounded-xl border text-xs ${
              shopFeedback.ok
                ? "bg-paper border-ink/20 text-ink"
                : "bg-accent-light border-accent/30 text-accent"
            }`}
          >
            {shopFeedback.message}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {COSMETIC_CATALOG.map((item) => {
            const isOnline = identity.mode === "online";
            const isOwned = identity.ownedItems.includes(item.id);
            const isEquipped =
              (item.kind === "title" && identity.equippedTitle === item.value) ||
              (item.kind === "ring" && identity.equippedRing === item.value);
            const canAfford = identity.itCoins >= item.price;

            return (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-paper border border-ink/15 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {item.kind === "ring" && (
                        <span
                          aria-hidden="true"
                          className={`w-5 h-5 rounded-full bg-white border shrink-0 ${getRingBadgeClass(
                            item.value
                          )}`}
                        />
                      )}
                      <span className="text-xs font-bold text-ink truncate">
                        {item.name}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-pill bg-white border border-ink/15 text-ink-muted shrink-0">
                      {item.kind === "title" ? "Danh hiệu" : "Viền"}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-muted">{item.description}</p>
                </div>

                <div className="space-y-1.5">
                  {isEquipped ? (
                    <span className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-pill text-xs font-mono font-semibold bg-ink text-white border border-ink">
                      <Check className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
                      <span>Đang dùng</span>
                    </span>
                  ) : isOwned && isOnline ? (
                    <button
                      type="button"
                      disabled={busyItemId === item.id}
                      onClick={() => handleCosmeticAction(item.id, item.price, item.name)}
                      className="w-full py-1.5 px-3 rounded-pill text-xs font-mono font-semibold border bg-white text-ink border-ink/20 hover:bg-paper-muted transition-colors disabled:opacity-50"
                    >
                      {busyItemId === item.id ? "Đang cập nhật..." : "Trang bị"}
                    </button>
                  ) : isOnline && canAfford ? (
                    <button
                      type="button"
                      disabled={busyItemId === item.id}
                      onClick={() => handleCosmeticAction(item.id, item.price, item.name)}
                      className="w-full py-1.5 px-3 rounded-pill text-xs font-mono font-semibold border bg-accent text-white border-accent hover:bg-accent-hover transition-colors disabled:opacity-50"
                    >
                      {busyItemId === item.id
                        ? "Đang mở khóa..."
                        : `Mở khóa (${item.price} Coin)`}
                    </button>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex-1 text-center py-1.5 px-2.5 rounded-pill text-xs font-mono font-semibold border bg-paper-muted text-ink-faint border-ink/10">
                        Mở khóa ({item.price} Coin)
                      </span>
                      <Link
                        href="/arena"
                        className="px-2.5 py-1.5 rounded-pill text-[11px] font-semibold bg-white text-ink border border-ink/15 hover:bg-paper-muted shrink-0"
                      >
                        {isOnline ? "Kiếm Coin" : "Vào Arena"}
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Speaking & Arena Activity Overview */}
      <section
        aria-label="Tổng quan hoạt động luyện nói và Arena"
        className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-paper-muted pb-3">
          <div>
            <h2 className="text-sm font-bold text-ink uppercase tracking-wider font-mono flex items-center gap-2">
              <History className="w-4 h-4 text-accent" aria-hidden="true" />
              <span>Hoạt động Luyện nói &amp; Arena</span>
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Đã luyện {activity.scenariosPracticed} tình huống khác nhau trên trình duyệt này.
            </p>
          </div>
          <Link
            href="/progress"
            className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-ink hover:text-accent transition-colors"
          >
            <span>Xem kế hoạch 7 ngày</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-paper border border-ink/15 rounded-xl p-3.5 text-center">
            <div className="text-2xl font-mono font-extrabold text-ink">
              {activity.totalAttempts}
            </div>
            <div className="text-[11px] text-ink-muted mt-1 flex items-center justify-center gap-1">
              <Mic className="w-3 h-3 text-accent" aria-hidden="true" />
              <span>Số lượt luyện nói</span>
            </div>
          </div>

          <div className="bg-paper border border-ink/15 rounded-xl p-3.5 text-center">
            <div className="text-2xl font-mono font-extrabold text-ink">
              {activity.averageScore}
            </div>
            <div className="text-[11px] text-ink-muted mt-1">Điểm TB</div>
          </div>

          <div className="bg-paper border border-ink/15 rounded-xl p-3.5 text-center">
            <div className="text-2xl font-mono font-extrabold text-accent">
              {activity.bestScore}
            </div>
            <div className="text-[11px] text-ink-muted mt-1">Điểm cao nhất</div>
          </div>

          <div className="bg-paper border border-ink/15 rounded-xl p-3.5 text-center">
            <div className="text-2xl font-mono font-extrabold text-ink">
              {activity.bugBusterBest}
            </div>
            <div className="text-[11px] text-ink-muted mt-1 flex items-center justify-center gap-1">
              <Bug className="w-3 h-3 text-accent" aria-hidden="true" />
              <span>Bug Buster Best</span>
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-paper border border-ink/15 rounded-xl p-3.5 text-center">
            <div className="text-2xl font-mono font-extrabold text-ink">
              {activity.standupBest}
            </div>
            <div className="text-[11px] text-ink-muted mt-1 flex items-center justify-center gap-1">
              <Timer className="w-3 h-3 text-accent" aria-hidden="true" />
              <span>Standup Best</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Top Weak Keywords/Points */}
          <div className="bg-paper border border-ink/15 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold font-mono uppercase text-ink flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
                <span>Từ khóa &amp; điểm yếu hay gặp</span>
              </h3>
              <Link
                href="/vocabulary"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
              >
                <BookOpen className="w-3 h-3" aria-hidden="true" />
                <span>Ôn từ vựng</span>
              </Link>
            </div>

            {activity.topWeakPoints.length === 0 ? (
              <div className="bg-white border border-ink/10 rounded-xl p-4 space-y-2.5">
                <p className="text-xs text-ink-muted">
                  Chưa ghi nhận từ khóa hay lỗi ngữ pháp nào. Hãy luyện nói ít nhất 1 lượt để SpeakIT tổng hợp điểm cần cải thiện.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/vocabulary"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-pill bg-paper border border-ink/15 text-xs font-semibold text-ink hover:bg-paper-muted"
                  >
                    <span>Mở kho từ vựng</span>
                  </Link>
                  <Link
                    href={`/practice/${activeRole.recommendedScenarioId}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-pill bg-ink text-white text-xs font-semibold"
                  >
                    <span>Luyện tình huống gợi ý</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {activity.topWeakPoints.map((wp) => {
                  const targetScenarioId = findScenarioForWeakPoint(
                    wp.value,
                    scenarios,
                    activeRole.recommendedScenarioId
                  );
                  return (
                    <div
                      key={wp.id}
                      className="flex flex-wrap items-center justify-between gap-2 bg-white border border-ink/10 rounded-xl px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-pill bg-paper border border-ink/15 text-ink-muted shrink-0">
                          {wp.kind === "keyword" ? "Từ khóa" : "Ngữ pháp"}
                        </span>
                        <span className="text-xs font-mono font-bold text-ink truncate">
                          {wp.value}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-mono font-bold text-accent">
                          {wp.miss_count} lần
                        </span>
                        <Link
                          href={`/practice/${targetScenarioId}`}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-pill bg-paper border border-ink/15 text-ink hover:bg-paper-muted"
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

          {/* Recent Speaking Attempts */}
          <div className="bg-paper border border-ink/15 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold font-mono uppercase text-ink flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
                <span>Lượt luyện nói gần đây</span>
              </h3>
              <Link
                href="/"
                className="text-[11px] font-semibold text-ink hover:text-accent transition-colors"
              >
                Chọn kịch bản mới →
              </Link>
            </div>

            {activity.recentAttempts.length === 0 ? (
              <div className="bg-white border border-ink/10 rounded-xl p-4 space-y-2.5">
                <p className="text-xs text-ink-muted">
                  Bạn chưa có lượt luyện nói nào được ghi nhận trên thiết bị này.
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-pill bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition-colors"
                >
                  <span>Bắt đầu luyện nói ngay</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {activity.recentAttempts.map((attempt) => {
                  const titleVI =
                    scenarioTitleMap.get(attempt.scenario) ?? attempt.scenario;
                  return (
                    <Link
                      key={attempt.id}
                      href={`/practice/${attempt.scenario}`}
                      className="block bg-white border border-ink/10 hover:border-ink/30 rounded-xl p-3 transition-colors space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-ink truncate">
                          {titleVI}
                        </span>
                        <span className="px-2 py-0.5 rounded-pill bg-accent-light border border-accent/30 text-[11px] font-mono font-bold text-accent shrink-0">
                          {attempt.score}/100
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-ink-muted">
                        <span>Lượt {attempt.turn_index + 1}</span>
                        <span>{formatAttemptDate(attempt.created_at)}</span>
                      </div>
                      {attempt.transcript && (
                        <p className="text-xs text-ink-muted line-clamp-2 pt-0.5">
                          “{attempt.transcript}”
                        </p>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

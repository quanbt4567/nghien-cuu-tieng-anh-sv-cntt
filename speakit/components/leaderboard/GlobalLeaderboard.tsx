"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Award,
  Check,
  Coins,
  Copy,
  Flame,
  KeyRound,
  Loader2,
  Pencil,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Trophy,
} from "lucide-react";
import {
  getTopPlayers,
  initOrHydrateGuestSession,
  purchaseAndEquipCosmetic,
  restoreByTransferCode,
  updateGuestDisplayName,
} from "../../app/actions/leaderboard";
import { COSMETIC_CATALOG, getRingBadgeClass } from "../../lib/cosmetics";
import type { LeaderboardEntry, PublicGuestPlayer } from "../../lib/db";
import { DiscordAvatarFrame } from "../cosmetics/DiscordAvatarFrame";
import { LeaderboardRowWrapper } from "../cosmetics/LeaderboardRowWrapper";
import { PlayerAvatar } from "../cosmetics/PlayerAvatar";
import {
  calculateCoins,
  getDevTitle,
  getGamificationState,
} from "../../lib/gamification";
import {
  readBackupTransferCode,
  saveBackupTransferCode,
  syncGuestProfileFromServer,
} from "../../lib/guestClient";

export interface GlobalLeaderboardInitialBoard {
  mode: "online" | "offline";
  players: LeaderboardEntry[];
  currentPlayer: PublicGuestPlayer | null;
  currentUserRank: LeaderboardEntry | null;
}

export function GlobalLeaderboard({
  initialBoard,
}: {
  initialBoard?: GlobalLeaderboardInitialBoard;
} = {}) {
  const [mode, setMode] = useState<"online" | "offline">(
    initialBoard?.mode ?? "online"
  );
  const [loading, setLoading] = useState(!initialBoard);
  const [showAllRows, setShowAllRows] = useState(false);
  const [players, setPlayers] = useState<LeaderboardEntry[]>(
    initialBoard?.players ?? []
  );
  const [currentPlayer, setCurrentPlayer] = useState<PublicGuestPlayer | null>(
    initialBoard?.currentPlayer ?? null
  );
  const [currentUserRank, setCurrentUserRank] =
    useState<LeaderboardEntry | null>(initialBoard?.currentUserRank ?? null);

  const [restoreCode, setRestoreCode] = useState("");
  const [restoreStatus, setRestoreStatus] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);

  const [copiedCode, setCopiedCode] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [shopNotice, setShopNotice] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const backup = readBackupTransferCode();
      const session = await initOrHydrateGuestSession(backup);
      if (session.mode === "online" && session.player) {
        saveBackupTransferCode(session.player.transferCode);
      }

      const board = await getTopPlayers(50);
      setMode(board.mode);

      if (board.mode === "offline") {
        const local = getGamificationState();
        const localCoins = calculateCoins(local.totalPoints);
        const localTitle = getDevTitle(local.totalPoints).title;
        setPlayers([]);
        setCurrentPlayer(null);
        setCurrentUserRank({
          id: "local-guest",
          displayName: "Local Dev",
          itCoins: localCoins,
          totalPoints: local.totalPoints,
          streakDays: local.streakDays,
          equippedTitle: localTitle,
          equippedRing: "default",
          rank: 1,
          isCurrentUser: true,
        });
      } else {
        const resolvedPlayer = board.currentPlayer ?? session.player;
        setPlayers(board.players);
        setCurrentPlayer(resolvedPlayer);
        syncGuestProfileFromServer(resolvedPlayer);
        setCurrentUserRank(board.currentUserRank);
      }
    } catch {
      const local = getGamificationState();
      setMode("offline");
      setPlayers([]);
      setCurrentPlayer(null);
      setCurrentUserRank({
        id: "local-guest",
        displayName: "Local Dev",
        itCoins: calculateCoins(local.totalPoints),
        totalPoints: local.totalPoints,
        streakDays: local.streakDays,
        equippedTitle: getDevTitle(local.totalPoints).title,
        equippedRing: "default",
        rank: 1,
        isCurrentUser: true,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeaderboard(Boolean(initialBoard));
  }, [initialBoard, loadLeaderboard]);

  const handleCopyCode = async () => {
    if (!currentPlayer?.transferCode) return;
    try {
      await navigator.clipboard.writeText(currentPlayer.transferCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      setCopiedCode(false);
    }
  };

  const handleRestoreSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!restoreCode.trim() || isRestoring) return;
    setIsRestoring(true);
    setRestoreStatus(null);
    try {
      const result = await restoreByTransferCode(restoreCode);
      if (result.ok && result.player) {
        saveBackupTransferCode(result.player.transferCode);
        syncGuestProfileFromServer(result.player);
        setRestoreCode("");
        setRestoreStatus({
          ok: true,
          message: `Đã khôi phục hồ sơ ${result.player.displayName} (${result.player.transferCode}).`,
        });
        await loadLeaderboard();
      } else {
        setRestoreStatus({
          ok: false,
          message: result.error || "Không thể khôi phục mã chuyển thiết bị này.",
        });
      }
    } catch {
      setRestoreStatus({
        ok: false,
        message: "Khôi phục thất bại. Vui lòng kiểm tra mã DEV-XXXXXX và thử lại.",
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleRenameSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draftName.trim() || isSavingName) return;
    setIsSavingName(true);
    setShopNotice(null);
    try {
      const res = await updateGuestDisplayName(
        draftName,
        readBackupTransferCode()
      );
      if (res.ok && res.player) {
        setCurrentPlayer(res.player);
        syncGuestProfileFromServer(res.player);
        setIsEditingName(false);
        await loadLeaderboard();
      } else if (res.error) {
        setShopNotice(res.error);
      }
    } finally {
      setIsSavingName(false);
    }
  };

  const handleCosmeticAction = async (itemId: string, price: number) => {
    if (busyItemId) return;
    setBusyItemId(itemId);
    setShopNotice(null);
    try {
      const res = await purchaseAndEquipCosmetic(
        itemId,
        price,
        readBackupTransferCode()
      );
      if (res.ok && res.player) {
        setCurrentPlayer(res.player);
        syncGuestProfileFromServer(res.player);
        await loadLeaderboard();
      } else if (res.error) {
        setShopNotice(res.error);
      }
    } finally {
      setBusyItemId(null);
    }
  };

  const activeEntry: LeaderboardEntry | null =
    currentUserRank ??
    (currentPlayer
      ? {
          id: currentPlayer.id,
          displayName: currentPlayer.displayName,
          itCoins: currentPlayer.itCoins,
          totalPoints: currentPlayer.totalPoints,
          streakDays: currentPlayer.streakDays,
          equippedTitle: currentPlayer.equippedTitle,
          equippedRing: currentPlayer.equippedRing,
          equippedCosmetics: currentPlayer.equippedCosmetics,
          rank: 1,
          isCurrentUser: true,
        }
      : null);

  return (
    <div className="space-y-6 pb-20">
      {mode === "online" && currentPlayer && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="liquid-glass-card p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <DiscordAvatarFrame
                  equippedId={currentPlayer.equippedCosmetics?.avatar_decoration}
                  fallbackRing={currentPlayer.equippedRing}
                  size="md"
                >
                  <PlayerAvatar
                    avatarUrl={currentPlayer.avatarUrl}
                    displayName={currentPlayer.displayName}
                    className={`text-sm border ${getRingBadgeClass(currentPlayer.equippedRing)}`}
                  />
                </DiscordAvatarFrame>
                <div>
                  {!isEditingName ? (
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">
                        {currentPlayer.displayName}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setDraftName(currentPlayer.displayName);
                          setIsEditingName(true);
                        }}
                        aria-label="Edit display name"
                        className="p-1 rounded-pill hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleRenameSubmit} className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        maxLength={24}
                        placeholder="Display name"
                        className="liquid-glass-input px-2.5 py-1 text-xs rounded-lg focus:outline-none w-36"
                      />
                      <button
                        type="submit"
                        disabled={isSavingName}
                        className="liquid-btn-primary px-2.5 py-1 text-xs font-semibold rounded-pill"
                      >
                        {isSavingName ? "..." : "Save"}
                      </button>
                    </form>
                  )}
                  <div className="text-[11px] font-mono text-slate-300 flex items-center gap-1.5 mt-0.5">
                    <Award className="w-3 h-3 text-cyan-300" />
                    <span>{currentPlayer.equippedTitle}</span>
                  </div>
                </div>
              </div>

              <div className="text-right font-mono">
                <div className="text-sm font-bold text-amber-200 flex items-center justify-end gap-1">
                  <Coins className="w-3.5 h-3.5 text-amber-300" />
                  <span>{currentPlayer.itCoins}</span>
                </div>
                <div className="text-[11px] text-slate-300">
                  {currentPlayer.totalPoints.toLocaleString("en-US")} pts
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-950/55 rounded-xl border border-white/15 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1">
                  <KeyRound className="w-3 h-3 text-cyan-300" />
                  <span>Mã khôi phục tài khoản (Backup)</span>
                </div>
                <div className="text-sm font-mono font-bold text-cyan-200 tracking-wider">
                  {currentPlayer.transferCode}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-mono font-medium"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Đã chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Sao chép</span>
                  </>
                )}
              </button>
            </div>
          </section>

          <section className="liquid-glass-card p-5 space-y-3">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-cyan-300" />
                <span>Khôi phục tiến độ sang thiết bị khác</span>
              </h3>
              <p className="text-xs text-slate-300">
                Nhập mã <code className="font-mono text-cyan-200">DEV-XXXXXX</code> để mang điểm, chuỗi ngày và thứ hạng sang trình duyệt mới mà không cần đăng ký.
              </p>
            </div>

            <form onSubmit={handleRestoreSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={restoreCode}
                onChange={(e) => setRestoreCode(e.target.value)}
                placeholder="DEV-XXXXXX"
                maxLength={10}
                className="liquid-glass-input flex-1 px-3 py-2 text-xs font-mono uppercase rounded-xl focus:outline-none"
              />
              <button
                type="submit"
                disabled={isRestoring || !restoreCode.trim()}
                className="liquid-btn-primary px-4 py-2 rounded-pill text-xs font-semibold disabled:opacity-50"
              >
                {isRestoring ? "Đang khôi phục..." : "Khôi phục"}
              </button>
            </form>

            {restoreStatus && (
              <div
                className={`text-xs p-2.5 rounded-xl border ${
                  restoreStatus.ok
                    ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-200"
                    : "bg-rose-500/15 border-rose-400/40 text-rose-200"
                }`}
              >
                {restoreStatus.message}
              </div>
            )}
          </section>
        </div>
      )}

      {mode === "online" && currentPlayer && (
        <section className="liquid-glass-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-cyan-300" />
                <span>Kho hiệu ứng IT-Coin</span>
              </h3>
              <p className="text-xs text-slate-300">
                Mở khóa &amp; trang bị nhanh 3 hiệu ứng nổi bật trên bảng xếp hạng.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="liquid-glass-pill px-3 py-1 text-xs font-mono font-bold text-amber-200">
                Số dư: {currentPlayer.itCoins} Coin
              </span>
              <Link
                href="/shop"
                className="liquid-btn-primary inline-flex items-center gap-1 px-3.5 py-1 rounded-pill text-xs font-mono font-semibold transition-all"
              >
                <span>Xem thêm tại Cửa hàng →</span>
              </Link>
            </div>
          </div>

          {shopNotice && (
            <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-400/40 text-xs text-rose-200">
              {shopNotice}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {COSMETIC_CATALOG.slice(0, 3).map((item) => {
              const isOwned = currentPlayer.ownedItems.includes(item.id);
              const isEquipped =
                (item.kind === "title" &&
                  currentPlayer.equippedTitle === item.value) ||
                (item.kind === "ring" &&
                  currentPlayer.equippedRing === item.value);
              const canAfford = currentPlayer.itCoins >= item.price;

              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl bg-slate-950/55 border border-white/15 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white">
                        {item.name}
                      </span>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-pill bg-white/[0.08] border border-white/15 text-slate-300">
                        {item.kind}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      {item.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={
                      isEquipped ||
                      busyItemId === item.id ||
                      (!isOwned && !canAfford)
                    }
                    onClick={() => handleCosmeticAction(item.id, item.price)}
                    className={`w-full py-1.5 px-3 rounded-pill text-xs font-mono font-semibold transition-all ${
                      isEquipped
                        ? "liquid-btn-success opacity-95"
                        : isOwned
                        ? "liquid-glass-btn"
                        : canAfford
                        ? "liquid-btn-primary"
                        : "bg-white/[0.05] text-slate-500 border border-white/10 cursor-not-allowed"
                    }`}
                  >
                    {busyItemId === item.id
                      ? "Updating..."
                      : isEquipped
                      ? "Equipped"
                      : isOwned
                      ? "Equip"
                      : `Unlock (${item.price} Coin)`}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="liquid-glass-card p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-300" />
              <span>
                Bảng xếp hạng ({players.length} học viên · tối đa Top 50)
              </span>
            </h3>
            <p className="text-xs text-slate-300">
              Xếp hạng theo Tổng điểm từ cao xuống thấp (nếu bằng điểm sẽ xét IT-Coin).
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadLeaderboard()}
            disabled={loading}
            className="liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-mono font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Làm mới</span>
          </button>
        </div>

        {loading && players.length === 0 ? (
          <div className="py-10 flex items-center justify-center gap-2 text-xs text-slate-300">
            <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
            <span>Đang tải bảng xếp hạng...</span>
          </div>
        ) : players.length === 0 ? (
          <div className="p-8 rounded-xl bg-slate-950/50 border border-white/12 text-center text-xs text-slate-300">
            Chưa có người chơi nào trên bảng xếp hạng. Hãy luyện nói 1 lượt để giữ vị trí #1!
          </div>
        ) : (
          (() => {
            const nameCounts = new Map<string, number>();
            for (const p of players) {
              const key = p.displayName.trim().toLowerCase();
              nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
            }
            const getRankBadgeClass = (rank: number) => {
              if (rank === 1) {
                return "bg-amber-400/20 border-amber-300/40 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.28)]";
              }
              if (rank === 2) {
                return "bg-slate-300/20 border-slate-200/40 text-slate-100 shadow-[0_0_12px_rgba(203,213,225,0.22)]";
              }
              if (rank === 3) {
                return "bg-orange-400/20 border-orange-300/40 text-orange-200 shadow-[0_0_12px_rgba(251,146,60,0.24)]";
              }
              return "bg-white/[0.06] border-white/15 text-slate-300";
            };
            const visiblePlayers = showAllRows ? players : players.slice(0, 15);
            return (
              <div className="space-y-2.5">
                {visiblePlayers.map((entry) => {
                  const hasNameplate = Boolean(entry.equippedCosmetics?.nameplate);
                  const hasFx = Boolean(entry.equippedCosmetics?.leaderboard_fx);
                  const isDuplicateName =
                    (nameCounts.get(entry.displayName.trim().toLowerCase()) ?? 0) > 1;
                  const useLite = entry.rank > 3;
                  return (
                    <LeaderboardRowWrapper
                      key={entry.id}
                      fxId={entry.equippedCosmetics?.leaderboard_fx}
                      nameplateId={entry.equippedCosmetics?.nameplate}
                      lite={useLite}
                      className={`liquid-glass-card-lite transition-colors ${
                        hasNameplate || hasFx
                          ? entry.isCurrentUser
                            ? "border-cyan-400/50"
                            : "border-white/15"
                          : entry.isCurrentUser
                          ? "!bg-cyan-500/15 border-cyan-400/50"
                          : "border-white/12"
                      }`}
                    >
                      <div className="p-3.5 flex flex-wrap items-center justify-between gap-3">
                        <Link
                          href={`/profile/${entry.id}`}
                          className="group flex items-center gap-3 min-w-0"
                        >
                          <span
                            className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-pill border text-xs font-mono font-bold shrink-0 ${getRankBadgeClass(entry.rank)}`}
                            aria-label={`Rank #${entry.rank}`}
                          >
                            #{entry.rank}
                          </span>
                          <DiscordAvatarFrame
                            equippedId={entry.equippedCosmetics?.avatar_decoration}
                            fallbackRing={entry.equippedRing}
                            size="sm"
                            lite={useLite}
                          >
                            <PlayerAvatar
                              avatarUrl={entry.avatarUrl}
                              displayName={entry.displayName}
                              className={`text-xs border ${getRingBadgeClass(entry.equippedRing)}`}
                            />
                          </DiscordAvatarFrame>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-sm text-white truncate group-hover:underline">
                                {entry.displayName}
                              </span>
                              {isDuplicateName && (
                                <span
                                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 border border-white/15 text-slate-300"
                                  title={`Player ID: ${entry.id}`}
                                >
                                  #{entry.id.slice(0, 4)}
                                </span>
                              )}
                              {entry.isCurrentUser && (
                                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-pill bg-cyan-500/25 border border-cyan-400/50 text-cyan-100 font-bold">
                                  You
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-pill bg-white/[0.08] border border-white/15 text-slate-200">
                                <Sparkles className="w-2.5 h-2.5 text-cyan-300" />
                                {entry.equippedTitle}
                              </span>
                            </div>
                          </div>
                        </Link>

                        <div className="flex items-center gap-4 font-mono text-xs shrink-0">
                          <span className="inline-flex items-center gap-1 text-slate-300">
                            <Flame className="w-3.5 h-3.5 fill-amber-400 text-amber-300" />
                            {entry.streakDays}d
                          </span>
                          <span className="inline-flex items-center gap-1 font-bold text-amber-200">
                            <Coins className="w-3.5 h-3.5 text-amber-300" />
                            {entry.itCoins}
                          </span>
                          <span className="text-slate-200 w-20 text-right">
                            {entry.totalPoints.toLocaleString("en-US")} pts
                          </span>
                        </div>
                      </div>
                    </LeaderboardRowWrapper>
                  );
                })}
                {!showAllRows && players.length > 15 && (
                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAllRows(true)}
                      className="liquid-glass-btn px-4 py-2 rounded-pill text-xs font-bold transition-all"
                    >
                      Xem thêm {players.length - 15} học viên khác
                    </button>
                  </div>
                )}
              </div>
            );
          })()
        )}
      </section>

      {activeEntry && (
        <div className="sticky bottom-3 z-20 bg-slate-950/88 backdrop-blur-2xl text-white border border-cyan-400/35 rounded-2xl p-3.5 sm:px-5 shadow-[0_12px_36px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.25)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <DiscordAvatarFrame
              equippedId={activeEntry.equippedCosmetics?.avatar_decoration}
              fallbackRing={activeEntry.equippedRing}
              size="sm"
            >
              <PlayerAvatar
                avatarUrl={activeEntry.avatarUrl}
                displayName={activeEntry.displayName}
                className={`text-xs border ${getRingBadgeClass(activeEntry.equippedRing)}`}
              />
            </DiscordAvatarFrame>
            <div>
              <div className="text-xs font-bold flex items-center gap-2">
                <span>{activeEntry.displayName}</span>
                <span className="px-2 py-0.5 rounded-pill bg-cyan-500/20 border border-cyan-400/40 text-cyan-100 text-[10px] font-mono">
                  {activeEntry.equippedTitle}
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-300">
                Hạng #{activeEntry.rank}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 font-mono text-xs">
            <span className="inline-flex items-center gap-1 text-slate-200">
              <Flame className="w-3.5 h-3.5 fill-amber-400 text-amber-300" />
              {activeEntry.streakDays}d
            </span>
            <span className="inline-flex items-center gap-1 font-bold text-amber-200">
              <Coins className="w-3.5 h-3.5 text-amber-300" />
              {activeEntry.itCoins} Coins
            </span>
            <span className="text-cyan-200 font-bold">
              {activeEntry.totalPoints.toLocaleString("en-US")} pts
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

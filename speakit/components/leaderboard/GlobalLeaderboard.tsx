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
          <section className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft space-y-4">
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
                      <span className="font-bold text-ink text-sm">
                        {currentPlayer.displayName}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setDraftName(currentPlayer.displayName);
                          setIsEditingName(true);
                        }}
                        aria-label="Edit display name"
                        className="p-1 rounded-pill hover:bg-paper-muted text-ink-muted hover:text-ink"
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
                        className="px-2.5 py-1 text-xs border border-ink/20 rounded-lg bg-paper focus:outline-none focus:border-ink w-36"
                      />
                      <button
                        type="submit"
                        disabled={isSavingName}
                        className="px-2.5 py-1 text-xs font-semibold rounded-pill bg-ink text-white"
                      >
                        {isSavingName ? "..." : "Save"}
                      </button>
                    </form>
                  )}
                  <div className="text-[11px] font-mono text-ink-muted flex items-center gap-1.5 mt-0.5">
                    <Award className="w-3 h-3 text-accent" />
                    <span>{currentPlayer.equippedTitle}</span>
                  </div>
                </div>
              </div>

              <div className="text-right font-mono">
                <div className="text-sm font-bold text-ink flex items-center justify-end gap-1">
                  <Coins className="w-3.5 h-3.5 text-accent" />
                  <span>{currentPlayer.itCoins}</span>
                </div>
                <div className="text-[11px] text-ink-muted">
                  {currentPlayer.totalPoints.toLocaleString("en-US")} pts
                </div>
              </div>
            </div>

            <div className="p-3 bg-paper rounded-xl border border-ink/10 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase text-ink-muted flex items-center gap-1">
                  <KeyRound className="w-3 h-3" />
                  <span>Mã khôi phục tài khoản (Backup)</span>
                </div>
                <div className="text-sm font-mono font-bold text-ink tracking-wider">
                  {currentPlayer.transferCode}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white border border-ink/15 text-xs font-mono font-medium text-ink hover:bg-paper-muted"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-accent" />
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

          <section className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft space-y-3">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-accent" />
                <span>Khôi phục tiến độ sang thiết bị khác</span>
              </h3>
              <p className="text-xs text-ink-muted">
                Nhập mã <code className="font-mono text-ink">DEV-XXXXXX</code> để mang điểm, chuỗi ngày và thứ hạng sang trình duyệt mới mà không cần đăng ký.
              </p>
            </div>

            <form onSubmit={handleRestoreSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={restoreCode}
                onChange={(e) => setRestoreCode(e.target.value)}
                placeholder="DEV-XXXXXX"
                maxLength={10}
                className="flex-1 px-3 py-2 text-xs font-mono uppercase bg-paper border border-ink/15 rounded-xl text-ink focus:outline-none focus:border-ink"
              />
              <button
                type="submit"
                disabled={isRestoring || !restoreCode.trim()}
                className="px-4 py-2 rounded-pill bg-ink text-white text-xs font-semibold border border-ink disabled:opacity-50"
              >
                {isRestoring ? "Đang khôi phục..." : "Khôi phục"}
              </button>
            </form>

            {restoreStatus && (
              <div
                className={`text-xs p-2.5 rounded-xl border ${
                  restoreStatus.ok
                    ? "bg-paper border-ink/20 text-ink"
                    : "bg-accent-light border-accent/30 text-accent"
                }`}
              >
                {restoreStatus.message}
              </div>
            )}
          </section>
        </div>
      )}

      {mode === "online" && currentPlayer && (
        <section className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-accent" />
                <span>Kho hiệu ứng IT-Coin</span>
              </h3>
              <p className="text-xs text-ink-muted">
                Mở khóa &amp; trang bị nhanh 3 hiệu ứng nổi bật trên bảng xếp hạng.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-pill bg-paper border border-ink/15 text-xs font-mono font-bold text-ink">
                Số dư: {currentPlayer.itCoins} Coin
              </span>
              <Link
                href="/shop"
                className="inline-flex items-center gap-1 px-3 py-1 rounded-pill bg-accent text-white text-xs font-mono font-semibold hover:bg-accent-hover transition-colors"
              >
                <span>Xem thêm tại Cửa hàng →</span>
              </Link>
            </div>
          </div>

          {shopNotice && (
            <div className="p-2.5 rounded-xl bg-accent-light border border-accent/30 text-xs text-accent">
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
                  className="p-3.5 rounded-xl bg-paper border border-ink/15 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-ink">
                        {item.name}
                      </span>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-pill bg-white border border-ink/15 text-ink-muted">
                        {item.kind}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-muted">
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
                    className={`w-full py-1.5 px-3 rounded-pill text-xs font-mono font-semibold border transition-all ${
                      isEquipped
                        ? "bg-ink text-white border-ink opacity-90"
                        : isOwned
                        ? "bg-white text-ink border-ink/20 hover:bg-paper-muted"
                        : canAfford
                        ? "bg-accent text-white border-accent hover:bg-accent-hover"
                        : "bg-paper-muted text-ink-faint border-ink/10 cursor-not-allowed"
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

      <section className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-ink flex items-center gap-2">
              <Trophy className="w-5 h-5 text-accent" />
              <span>
                Bảng xếp hạng ({players.length} học viên · tối đa Top 50)
              </span>
            </h3>
            <p className="text-xs text-ink-muted">
              Xếp hạng theo Tổng điểm từ cao xuống thấp (nếu bằng điểm sẽ xét IT-Coin).
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadLeaderboard()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-paper border border-ink/15 text-xs font-mono font-medium text-ink hover:bg-paper-muted disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Làm mới</span>
          </button>
        </div>

        {loading && players.length === 0 ? (
          <div className="py-10 flex items-center justify-center gap-2 text-xs text-ink-muted">
            <Loader2 className="w-4 h-4 animate-spin text-accent" />
            <span>Đang tải bảng xếp hạng...</span>
          </div>
        ) : players.length === 0 ? (
          <div className="p-8 rounded-xl bg-paper border border-ink/10 text-center text-xs text-ink-muted">
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
                return "bg-amber-400/20 border-amber-500/50 text-amber-800";
              }
              if (rank === 2) {
                return "bg-slate-200/80 border-slate-400/60 text-slate-800";
              }
              if (rank === 3) {
                return "bg-orange-200/70 border-orange-400/60 text-orange-900";
              }
              return "bg-white border-ink/15 text-ink-muted";
            };
            return (
              <div className="space-y-2.5">
                {players.map((entry) => {
                  const hasNameplate = Boolean(entry.equippedCosmetics?.nameplate);
                  const hasFx = Boolean(entry.equippedCosmetics?.leaderboard_fx);
                  const isDuplicateName =
                    (nameCounts.get(entry.displayName.trim().toLowerCase()) ?? 0) > 1;
                  return (
                    <LeaderboardRowWrapper
                      key={entry.id}
                      fxId={entry.equippedCosmetics?.leaderboard_fx}
                      nameplateId={entry.equippedCosmetics?.nameplate}
                      className={`border transition-colors ${
                        hasNameplate || hasFx
                          ? entry.isCurrentUser
                            ? "border-accent/40"
                            : "border-ink/15"
                          : entry.isCurrentUser
                          ? "bg-accent-light/50 border-accent/40"
                          : "bg-paper border-ink/10"
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
                          >
                            <PlayerAvatar
                              avatarUrl={entry.avatarUrl}
                              displayName={entry.displayName}
                              className={`text-xs border ${getRingBadgeClass(entry.equippedRing)}`}
                            />
                          </DiscordAvatarFrame>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-sm text-ink truncate group-hover:underline">
                                {entry.displayName}
                              </span>
                              {isDuplicateName && (
                                <span
                                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-paper-muted border border-ink/10 text-ink-muted"
                                  title={`Player ID: ${entry.id}`}
                                >
                                  #{entry.id.slice(0, 4)}
                                </span>
                              )}
                              {entry.isCurrentUser && (
                                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-pill bg-ink text-white">
                                  You
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-pill bg-white border border-ink/15 text-ink-muted">
                                <Sparkles className="w-2.5 h-2.5 text-accent" />
                                {entry.equippedTitle}
                              </span>
                            </div>
                          </div>
                        </Link>

                        <div className="flex items-center gap-4 font-mono text-xs shrink-0">
                          <span className="inline-flex items-center gap-1 text-ink-muted">
                            <Flame className="w-3.5 h-3.5 fill-accent text-accent" />
                            {entry.streakDays}d
                          </span>
                          <span className="inline-flex items-center gap-1 font-bold text-ink">
                            <Coins className="w-3.5 h-3.5 text-accent" />
                            {entry.itCoins}
                          </span>
                          <span className="text-ink-muted w-20 text-right">
                            {entry.totalPoints.toLocaleString("en-US")} pts
                          </span>
                        </div>
                      </div>
                    </LeaderboardRowWrapper>
                  );
                })}
              </div>
            );
          })()
        )}
      </section>

      {activeEntry && (
        <div className="sticky bottom-3 z-20 bg-ink text-white border border-ink rounded-2xl p-3.5 sm:px-5 shadow-card flex flex-wrap items-center justify-between gap-3">
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
                <span className="px-2 py-0.5 rounded-pill bg-white/15 text-[10px] font-mono">
                  {activeEntry.equippedTitle}
                </span>
              </div>
              <div className="text-[11px] font-mono text-white/75">
                Hạng #{activeEntry.rank}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 font-mono text-xs">
            <span className="inline-flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 fill-accent text-accent" />
              {activeEntry.streakDays}d
            </span>
            <span className="inline-flex items-center gap-1 font-bold">
              <Coins className="w-3.5 h-3.5 text-accent" />
              {activeEntry.itCoins} Coins
            </span>
            <span>{activeEntry.totalPoints.toLocaleString("en-US")} pts</span>
          </div>
        </div>
      )}
    </div>
  );
}

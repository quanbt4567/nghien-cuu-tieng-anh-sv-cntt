"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Coins,
  Crown,
  Flame,
  Gamepad2,
  Layers,
  Mic,
  MousePointer2,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Tag,
  Trophy,
  User,
  WifiOff,
} from "lucide-react";
import {
  equipOwnedCosmetic,
  initOrHydrateGuestSession,
  purchaseAndEquipCosmetic,
  unequipCosmeticSlot,
} from "../../app/actions/leaderboard";
import {
  COSMETIC_CATEGORIES,
  COSMETIC_CATALOG,
  DEFAULT_EQUIPPED_COSMETICS,
  getCosmeticsByCategory,
  normalizeEquippedCosmetics,
  type CosmeticCategory,
  type CosmeticItem,
  type CosmeticRarity,
  type EquippedCosmetics,
} from "../../lib/cosmetics";
import type { PublicGuestPlayer } from "../../lib/db";
import { getGamificationState } from "../../lib/gamification";
import {
  GUEST_PROFILE_UPDATED_EVENT,
  readBackupTransferCode,
  readCachedGuestProfile,
  saveBackupTransferCode,
  saveCachedGuestProfile,
} from "../../lib/guestClient";
import { mergeProfileIdentity } from "../../lib/profileStats";
import { CustomCursorTrail } from "./CustomCursorTrail";
import { DiscordAvatarFrame } from "./DiscordAvatarFrame";
import { FullPageProfileEffect } from "./FullPageProfileEffect";
import { LeaderboardRowWrapper } from "./LeaderboardRowWrapper";
import { VictoryFinisherOverlay } from "./VictoryFinisherOverlay";

const CATEGORY_META: Record<
  CosmeticCategory,
  { label: string; shortLabel: string; icon: typeof Sparkles }
> = {
  avatar_decoration: {
    label: "Avatar Frames",
    shortLabel: "Avatar",
    icon: User,
  },
  profile_theme: {
    label: "Profile Themes",
    shortLabel: "Theme",
    icon: Layers,
  },
  cursor_effect: {
    label: "Cursor Trails",
    shortLabel: "Cursor",
    icon: MousePointer2,
  },
  leaderboard_fx: {
    label: "Leaderboard FX",
    shortLabel: "Rank FX",
    icon: Trophy,
  },
  nameplate: {
    label: "Nameplates",
    shortLabel: "Nameplate",
    icon: Tag,
  },
  victory_finisher: {
    label: "Victory Finishers",
    shortLabel: "Finisher",
    icon: Flame,
  },
};

const RARITY_BADGE_CLASS: Record<CosmeticRarity, string> = {
  Common: "bg-paper-muted text-ink-muted border-ink/15",
  Rare: "bg-sky-50 text-sky-700 border-sky-200",
  Epic: "bg-amber-50 text-amber-700 border-amber-200",
  Legendary: "bg-accent-light text-accent border-accent/30",
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase() || "DV";
  }
  return (name.trim().slice(0, 2) || "DV").toUpperCase();
}

export function CosmeticShopClient() {
  const [loading, setLoading] = useState(true);
  const [guestPlayer, setGuestPlayer] = useState<PublicGuestPlayer | null>(null);
  const [activeCategory, setActiveCategory] =
    useState<CosmeticCategory>("avatar_decoration");
  const [previewOverrides, setPreviewOverrides] = useState<
    Partial<EquippedCosmetics>
  >({});
  const [micTestActive, setMicTestActive] = useState(false);
  const [finisherActive, setFinisherActive] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const syncFromServer = useCallback(async () => {
    const cached = readCachedGuestProfile();
    if (cached) {
      setGuestPlayer(cached);
    }
    try {
      const backup = readBackupTransferCode();
      const session = await initOrHydrateGuestSession(backup);
      if (session.mode === "online" && session.player) {
        saveBackupTransferCode(session.player.transferCode);
        setGuestPlayer(session.player);
        saveCachedGuestProfile(session.player);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void syncFromServer();

    const handleProfileEvent = (event: Event) => {
      const custom = event as CustomEvent<PublicGuestPlayer | null>;
      if (custom.detail !== undefined) {
        setGuestPlayer(custom.detail);
      }
    };

    window.addEventListener(GUEST_PROFILE_UPDATED_EVENT, handleProfileEvent);
    return () => {
      window.removeEventListener(GUEST_PROFILE_UPDATED_EVENT, handleProfileEvent);
    };
  }, [syncFromServer]);

  const gamification = useMemo(() => getGamificationState(), []);
  const identity = useMemo(
    () => mergeProfileIdentity(guestPlayer, gamification),
    [guestPlayer, gamification]
  );

  const equipped = useMemo<EquippedCosmetics>(() => {
    const normalized = normalizeEquippedCosmetics(guestPlayer?.equippedCosmetics);
    if (!normalized.avatar_decoration && identity.equippedRing !== "default") {
      normalized.avatar_decoration = identity.equippedRing;
    }
    return normalized;
  }, [guestPlayer?.equippedCosmetics, identity.equippedRing]);

  const activeSandbox = useMemo<EquippedCosmetics>(
    () => ({
      ...DEFAULT_EQUIPPED_COSMETICS,
      ...equipped,
      ...previewOverrides,
    }),
    [equipped, previewOverrides]
  );

  const categoryItems = useMemo(
    () => getCosmeticsByCategory(activeCategory),
    [activeCategory]
  );

  const hasPreviewChanges = Object.keys(previewOverrides).length > 0;

  const handleSelectPreview = (item: CosmeticItem) => {
    setPreviewOverrides((prev) => ({
      ...prev,
      [item.category]: item.id,
    }));
    if (item.category === "victory_finisher") {
      setFinisherActive(false);
      window.setTimeout(() => setFinisherActive(true), 20);
    }
  };

  const handleResetPreview = () => {
    setPreviewOverrides({});
    setFinisherActive(false);
  };

  const handleBuyAndEquip = async (item: CosmeticItem) => {
    if (busyItemId) return;
    setBusyItemId(item.id);
    setFeedback(null);
    try {
      const res = await purchaseAndEquipCosmetic(
        item.id,
        item.price,
        readBackupTransferCode()
      );
      if (res.ok && res.player) {
        setGuestPlayer(res.player);
        saveCachedGuestProfile(res.player);
        setPreviewOverrides((prev) => {
          const next = { ...prev };
          delete next[item.category];
          return next;
        });
        setFeedback({
          ok: true,
          message: `Purchased & equipped "${item.name}"!`,
        });
      } else {
        setFeedback({
          ok: false,
          message: res.error || "Unable to complete purchase.",
        });
      }
    } catch {
      setFeedback({
        ok: false,
        message: "Network error while purchasing cosmetic.",
      });
    } finally {
      setBusyItemId(null);
    }
  };

  const handleEquipOwned = async (item: CosmeticItem) => {
    if (busyItemId) return;
    setBusyItemId(item.id);
    setFeedback(null);
    try {
      const res = await equipOwnedCosmetic(
        item.category,
        item.id,
        readBackupTransferCode()
      );
      if (res.ok && res.player) {
        setGuestPlayer(res.player);
        saveCachedGuestProfile(res.player);
        setPreviewOverrides((prev) => {
          const next = { ...prev };
          delete next[item.category];
          return next;
        });
        setFeedback({
          ok: true,
          message: `Equipped "${item.name}".`,
        });
      } else {
        setFeedback({
          ok: false,
          message: res.error || "Unable to equip item.",
        });
      }
    } catch {
      setFeedback({
        ok: false,
        message: "Network error while equipping cosmetic.",
      });
    } finally {
      setBusyItemId(null);
    }
  };

  const handleUnequip = async (category: CosmeticCategory, itemId: string) => {
    if (busyItemId) return;
    setBusyItemId(itemId);
    setFeedback(null);
    try {
      const res = await unequipCosmeticSlot(category, readBackupTransferCode());
      if (res.ok && res.player) {
        setGuestPlayer(res.player);
        saveCachedGuestProfile(res.player);
        setPreviewOverrides((prev) => {
          const next = { ...prev };
          delete next[category];
          return next;
        });
        setFeedback({
          ok: true,
          message: `Unequipped ${CATEGORY_META[category].shortLabel} slot.`,
        });
      } else {
        setFeedback({
          ok: false,
          message: res.error || "Unable to unequip slot.",
        });
      }
    } catch {
      setFeedback({
        ok: false,
        message: "Network error while unequipping slot.",
      });
    } finally {
      setBusyItemId(null);
    }
  };

  const activeThemeItem = COSMETIC_CATALOG.find(
    (item) => item.id === activeSandbox.profile_theme
  );
  const activeCursorItem = COSMETIC_CATALOG.find(
    (item) => item.id === activeSandbox.cursor_effect
  );
  const activeFinisherItem = COSMETIC_CATALOG.find(
    (item) => item.id === activeSandbox.victory_finisher
  );

  return (
    <div className="relative min-h-screen">
      <FullPageProfileEffect themeId={activeSandbox.profile_theme} />
      <CustomCursorTrail effectId={activeSandbox.cursor_effect} />
      <VictoryFinisherOverlay
        finisherId={activeSandbox.victory_finisher}
        active={finisherActive}
        title={activeFinisherItem?.name ?? "Victory Finisher Preview"}
        subtitle={`${identity.displayName} • Live Sandbox Preview`}
        onComplete={() => setFinisherActive(false)}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8 space-y-6 pb-20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Link
              href="/profile"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white text-ink text-xs font-medium border border-ink/15 shadow-soft hover:bg-paper-muted transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Hồ sơ</span>
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-accent" aria-hidden="true" />
              <span>IT-Coin Cosmetic Shop</span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-pill bg-white border border-ink/15 text-xs font-mono font-bold text-ink shadow-soft">
              <Coins className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
              <span>{identity.itCoins} IT-Coin</span>
            </span>
            <Link
              href="/arena"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-ink text-white text-xs font-semibold border border-ink shadow-soft hover:bg-ink/90 transition-colors"
            >
              <Gamepad2 className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
              <span>Kiếm thêm Coin</span>
            </Link>
          </div>
        </div>

        {identity.mode === "offline" && !loading && (
          <div className="flex items-center justify-between gap-3 bg-white border border-ink/15 rounded-2xl px-4 py-3 text-xs text-ink-muted shadow-soft">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
              <span>
                Đang ở chế độ Local (Offline). Bạn vẫn có thể dùng thử toàn bộ 24 hiệu ứng trong Live Sandbox bên dưới; kết nối Neon DB để mua và lưu trang bị.
              </span>
            </div>
          </div>
        )}

        <section
          aria-label="Live Try-On Sandbox"
          className="bg-white/95 backdrop-blur-sm border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-paper-muted pb-3">
            <div>
              <h2 className="text-sm font-bold text-ink uppercase tracking-wider font-mono flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" aria-hidden="true" />
                <span>Live Try-On Sandbox</span>
              </h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Click any locked or owned cosmetic below to preview its real-time animation before buying.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setMicTestActive((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill border text-xs font-mono font-semibold transition-colors ${
                  micTestActive
                    ? "bg-accent text-white border-accent"
                    : "bg-paper text-ink border-ink/15 hover:bg-paper-muted"
                }`}
              >
                <Mic className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{micTestActive ? "Mic Pulse: ON" : "Test Mic Pulse"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFinisherActive(false);
                  window.setTimeout(() => setFinisherActive(true), 20);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-ink text-white text-xs font-mono font-semibold border border-ink hover:bg-ink/90 transition-colors"
              >
                <Flame className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
                <span>Trigger Finisher</span>
              </button>

              {hasPreviewChanges && (
                <button
                  type="button"
                  onClick={handleResetPreview}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-paper text-ink text-xs font-mono font-semibold border border-ink/15 hover:bg-paper-muted transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-5 flex items-center gap-4 p-4 rounded-xl bg-paper border border-ink/15">
              <DiscordAvatarFrame
                equippedId={activeSandbox.avatar_decoration}
                fallbackRing={identity.equippedRing}
                size="xl"
                micActive={micTestActive}
              >
                <div className="w-full h-full flex items-center justify-center bg-white font-mono font-bold text-xl text-ink">
                  {getInitials(identity.displayName)}
                </div>
              </DiscordAvatarFrame>

              <div className="min-w-0 space-y-1">
                <div className="text-sm font-bold text-ink truncate">
                  {identity.displayName}
                </div>
                <div className="text-[11px] font-mono text-ink-muted">
                  {identity.transferCode ?? "DEV-SANDBOX"} • {identity.equippedTitle}
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="px-2 py-0.5 rounded-pill bg-white border border-ink/15 text-[10px] font-mono text-ink-muted">
                    Theme: {activeThemeItem?.name ?? "None"}
                  </span>
                  <span className="px-2 py-0.5 rounded-pill bg-white border border-ink/15 text-[10px] font-mono text-ink-muted">
                    Cursor: {activeCursorItem?.name ?? "Default"}
                  </span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <LeaderboardRowWrapper
                fxId={activeSandbox.leaderboard_fx}
                nameplateId={activeSandbox.nameplate}
                className="border border-ink/15 bg-white p-4 shadow-soft"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-ink text-white font-mono text-xs font-bold shrink-0">
                      #1
                    </span>
                    <DiscordAvatarFrame
                      equippedId={activeSandbox.avatar_decoration}
                      fallbackRing={identity.equippedRing}
                      size="sm"
                      micActive={micTestActive}
                    >
                      <div className="w-full h-full flex items-center justify-center bg-paper font-mono font-bold text-xs text-ink">
                        {getInitials(identity.displayName)}
                      </div>
                    </DiscordAvatarFrame>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-ink truncate flex items-center gap-1.5">
                        <span>{identity.displayName}</span>
                        <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-hidden="true" />
                      </div>
                      <div className="text-[11px] font-mono text-ink-muted truncate">
                        Leaderboard Row &amp; Nameplate Live Preview
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 font-mono">
                    <div className="text-sm font-bold text-ink">
                      {identity.totalPoints.toLocaleString("vi-VN")} pts
                    </div>
                    <div className="text-[11px] text-accent font-semibold">
                      {identity.itCoins} IT-Coin
                    </div>
                  </div>
                </div>
              </LeaderboardRowWrapper>
            </div>
          </div>
        </section>

        {feedback && (
          <div
            role="status"
            className={`px-4 py-3 rounded-xl border text-xs font-medium ${
              feedback.ok
                ? "bg-white border-ink/20 text-ink shadow-soft"
                : "bg-accent-light border-accent/30 text-accent"
            }`}
          >
            {feedback.message}
          </div>
        )}

        <div
          role="tablist"
          aria-label="Cosmetic Categories"
          className="flex flex-wrap gap-2"
        >
          {COSMETIC_CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat];
            const Icon = meta.icon;
            const selected = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveCategory(cat)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-pill border text-xs font-semibold transition-all ${
                  selected
                    ? "bg-ink text-white border-ink shadow-soft"
                    : "bg-white text-ink border-ink/15 hover:bg-paper-muted"
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${selected ? "text-accent" : "text-ink-muted"}`}
                  aria-hidden="true"
                />
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categoryItems.map((item) => {
            const isOwned = identity.ownedItems.includes(item.id);
            const isEquipped = equipped[item.category] === item.id;
            const isPreviewing = activeSandbox[item.category] === item.id;
            const canAfford = identity.itCoins >= item.price;
            const isOnline = identity.mode === "online";

            return (
              <div
                key={item.id}
                onClick={() => handleSelectPreview(item)}
                className={`cursor-pointer rounded-2xl bg-white/95 border p-4 shadow-soft flex flex-col justify-between gap-4 transition-all ${
                  isPreviewing
                    ? "border-accent ring-2 ring-accent/20"
                    : "border-ink/15 hover:border-ink/40"
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-pill border ${
                        RARITY_BADGE_CLASS[item.rarity]
                      }`}
                    >
                      {item.rarity}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-ink">
                      <span
                        aria-hidden="true"
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: item.previewAccent }}
                      />
                      <span>{item.price} Coin</span>
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-ink">{item.name}</h3>
                    <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div
                  className="space-y-2 pt-2 border-t border-paper-muted"
                  onClick={(e) => e.stopPropagation()}
                >
                  {isEquipped ? (
                    <div className="flex items-center gap-2">
                      <span className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-3 rounded-pill bg-ink text-white text-xs font-mono font-semibold">
                        <Check className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
                        <span>Equipped</span>
                      </span>
                      <button
                        type="button"
                        disabled={busyItemId === item.id || !isOnline}
                        onClick={() => handleUnequip(item.category, item.id)}
                        className="px-3 py-1.5 rounded-pill bg-paper border border-ink/15 text-xs font-mono font-semibold text-ink hover:bg-paper-muted disabled:opacity-50"
                      >
                        Unequip
                      </button>
                    </div>
                  ) : isOwned ? (
                    <button
                      type="button"
                      disabled={busyItemId === item.id || !isOnline}
                      onClick={() => handleEquipOwned(item)}
                      className="w-full py-1.5 px-3 rounded-pill bg-white border border-ink/20 text-xs font-mono font-semibold text-ink hover:bg-paper-muted disabled:opacity-50"
                    >
                      {busyItemId === item.id ? "Equipping..." : "Equip"}
                    </button>
                  ) : isOnline && canAfford ? (
                    <button
                      type="button"
                      disabled={busyItemId === item.id}
                      onClick={() => handleBuyAndEquip(item)}
                      className="w-full py-1.5 px-3 rounded-pill bg-accent hover:bg-accent-hover text-white border border-accent text-xs font-mono font-semibold disabled:opacity-50"
                    >
                      {busyItemId === item.id
                        ? "Unlocking..."
                        : `Buy & Equip (${item.price} Coin)`}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSelectPreview(item)}
                      className="w-full py-1.5 px-3 rounded-pill bg-paper-muted border border-ink/10 text-xs font-mono font-semibold text-ink-muted hover:text-ink"
                    >
                      {isOnline ? `Need ${item.price} Coin • Preview` : "Preview in Sandbox"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

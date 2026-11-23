"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Coins,
  Crown,
  Eraser,
  Eye,
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
  Zap,
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
import { CustomCursorTrail, SPEAKIT_CURSOR_BURST_EVENT } from "./CustomCursorTrail";
import { DiscordAvatarFrame } from "./DiscordAvatarFrame";
import { FullPageProfileEffect } from "./FullPageProfileEffect";
import { LeaderboardRowWrapper } from "./LeaderboardRowWrapper";
import { NameplateBanner, NameplateDisplayText } from "./NameplateBanner";
import { PlayerAvatar } from "./PlayerAvatar";
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
  Common: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700",
  Rare: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
  Epic: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800",
  Legendary:
    "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800",
};

const RARITY_ORDER: Record<CosmeticRarity, number> = {
  Common: 0,
  Rare: 1,
  Epic: 2,
  Legendary: 3,
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase() || "DV";
  }
  return (name.trim().slice(0, 2) || "DV").toUpperCase();
}

function CosmeticCardThumbnail({
  item,
  displayName,
  initials,
  micActive,
}: {
  item: CosmeticItem;
  displayName: string;
  initials: string;
  micActive: boolean;
}) {
  if (item.category === "avatar_decoration") {
    return (
      <div className="h-28 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-center relative overflow-hidden">
        <DiscordAvatarFrame equippedId={item.id} item={item} size="lg" micActive={micActive} lite>
          <div className="w-full h-full flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono font-bold text-base text-slate-900 dark:text-slate-100">
            {initials}
          </div>
        </DiscordAvatarFrame>
      </div>
    );
  }

  if (item.category === "nameplate") {
    return (
      <div className="h-28 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 px-3 flex items-center justify-center relative overflow-hidden">
        <NameplateBanner
          nameplateId={item.id}
          item={item}
          lite
          className="w-full px-3 py-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-6 h-6 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                {initials}
              </span>
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                <NameplateDisplayText name={displayName} nameplateId={item.id} lite />
              </span>
            </div>
            {item.id === "nameplate-terminal-pulse" ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-green-700 dark:text-green-400 shrink-0">
                <span>$</span>
                <span className="cosmetic-nameplate-terminal-cursor inline-block w-1.5 h-3 bg-green-700 dark:bg-green-400" />
              </span>
            ) : (
              <span className="text-[11px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 shrink-0">
                TAG
              </span>
            )}
          </div>
        </NameplateBanner>
      </div>
    );
  }

  if (item.category === "leaderboard_fx") {
    return (
      <div className="h-28 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 px-3 flex items-center justify-center relative overflow-hidden">
        <LeaderboardRowWrapper
          fxId={item.id}
          lite
          className="w-full px-3 py-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-6 h-6 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                #1
              </span>
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                {displayName}
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-blue-700 dark:text-blue-400 shrink-0">
              2,450 pts
            </span>
          </div>
        </LeaderboardRowWrapper>
      </div>
    );
  }

  if (item.category === "profile_theme") {
    return (
      <div
        className={`h-28 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 relative overflow-hidden flex items-end p-2.5 ${item.effectClass}`}
      >
        {item.id === "theme-neon-meteor-shower" && (
          <>
            <span
              className="cosmetic-meteor-streak absolute w-[2px] h-14 rounded-full bg-gradient-to-b from-red-500 via-amber-400 to-transparent"
              style={{ left: "26%", top: "-15%", "--meteor-duration": "2.4s", "--meteor-delay": "0s" } as CSSProperties}
            />
            <span
              className="cosmetic-meteor-streak absolute w-[2px] h-16 rounded-full bg-gradient-to-b from-red-500 via-amber-400 to-transparent"
              style={{ left: "68%", top: "-20%", "--meteor-duration": "2.8s", "--meteor-delay": "0.8s" } as CSSProperties}
            />
          </>
        )}
        {item.id === "theme-digital-matrix-rain" && (
          <>
            {["15%", "45%", "75%"].map((left, idx) => (
              <div
                key={left}
                className="cosmetic-matrix-col absolute top-0 text-[10px] font-mono font-bold leading-3 text-green-700/80 dark:text-green-400/80 select-none whitespace-pre text-center"
                style={{ left, "--col-duration": `${2.6 + idx * 0.5}s`, "--col-delay": `${idx * 0.4}s` } as CSSProperties}
              >
                {"0\n1\n0\n1\n1\n0"}
              </div>
            ))}
          </>
        )}
        {item.id === "theme-aurora-cyber-grid" && (
          <div className="cosmetic-grid-plane absolute inset-0 opacity-90" />
        )}
        {item.id === "theme-electric-storm-surge" && (
          <div
            className="cosmetic-storm-arc absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 25% 25%, rgba(234, 179, 8, 0.35), transparent 55%), radial-gradient(circle at 75% 75%, rgba(220, 38, 38, 0.25), transparent 55%)",
            }}
          />
        )}
        {![
          "theme-neon-meteor-shower",
          "theme-digital-matrix-rain",
          "theme-aurora-cyber-grid",
          "theme-electric-storm-surge",
        ].includes(item.id) && (
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 28% 30%, ${item.previewAccent}40, transparent 58%), radial-gradient(circle at 75% 70%, ${item.previewAccent}28, transparent 62%), repeating-linear-gradient(135deg, ${item.previewAccent}14 0px, ${item.previewAccent}14 8px, transparent 8px, transparent 16px)`,
            }}
          />
        )}
        <span className="relative z-10 px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-mono font-bold text-blue-700 dark:text-blue-300">
          BACKDROP FX
        </span>
      </div>
    );
  }

  if (item.category === "cursor_effect") {
    return (
      <div className="h-28 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 relative overflow-hidden flex items-center justify-center">
        {item.id === "cursor-pixel-sparkle-trail" && (
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-amber-500 border border-amber-600/40 animate-pulse" />
            <span className="w-3 h-3 bg-red-600 border border-red-700/40 rotate-45 animate-bounce" />
            <MousePointer2 className="w-5 h-5 text-slate-900 dark:text-slate-100" aria-hidden="true" />
          </div>
        )}
        {item.id === "cursor-binary-01-stream" && (
          <div className="flex items-center gap-2 font-mono font-bold text-xs text-green-700 dark:text-green-400">
            <span className="animate-pulse">0</span>
            <span>1</span>
            <span className="animate-bounce">0</span>
            <span>1</span>
            <MousePointer2 className="w-5 h-5 text-slate-900 dark:text-slate-100" aria-hidden="true" />
          </div>
        )}
        {item.id === "cursor-neon-laser-ribbon" && (
          <div className="flex items-center gap-1.5">
            <span className="w-16 h-1.5 rounded-full bg-red-600 cosmetic-cursor-laser-ribbon" />
            <MousePointer2 className="w-5 h-5 text-slate-900 dark:text-slate-100" aria-hidden="true" />
          </div>
        )}
        {item.id === "cursor-tactical-cyber-crosshair" && (
          <div className="relative flex items-center justify-center">
            <span className="w-12 h-12 rounded-full border-2 border-dashed border-blue-600 dark:border-blue-400 cosmetic-cursor-cyber-crosshair flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-red-600" />
            </span>
          </div>
        )}
        {![
          "cursor-pixel-sparkle-trail",
          "cursor-binary-01-stream",
          "cursor-neon-laser-ribbon",
          "cursor-tactical-cyber-crosshair",
        ].includes(item.id) && (
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full border border-white dark:border-slate-900 animate-ping"
              style={{ backgroundColor: item.previewAccent }}
            />
            <span
              className="w-10 h-2 rounded-full border border-white/80 dark:border-slate-700"
              style={{
                backgroundColor: item.previewAccent,
              }}
            />
            <MousePointer2 className="w-5 h-5 text-slate-900 dark:text-slate-100" aria-hidden="true" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-28 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 relative overflow-hidden flex items-center justify-center px-3">
      {item.id === "finisher-lgtm-neon-confetti" && (
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 rounded bg-green-700 text-white border border-green-500 font-mono text-[11px] font-bold rotate-[-4deg]">
            LGTM!
          </span>
          <span className="w-2.5 h-2.5 bg-red-600 border border-white/70 rotate-12" />
          <span className="w-2.5 h-2.5 bg-amber-500 border border-white/70 -rotate-12" />
        </div>
      )}
      {item.id === "finisher-system-restored-shockwave" && (
        <div className="relative flex items-center justify-center">
          <span className="absolute w-14 h-14 rounded-full border-2 border-green-600 animate-ping opacity-45" />
          <span className="px-2.5 py-1 rounded-full bg-green-700 text-white border border-green-500 font-mono text-[11px] font-bold">
            200 OK
          </span>
        </div>
      )}
      {item.id === "finisher-cyber-lightning-strike" && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800">
          <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400 fill-amber-500" aria-hidden="true" />
          <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-300">STRIKE</span>
        </div>
      )}
      {item.id === "finisher-matrix-override" && (
        <div className="px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-950/40 border-2 border-green-600 text-green-700 dark:text-green-300 font-mono text-xs font-bold">
          OVERRIDE_01
        </div>
      )}
      {![
        "finisher-lgtm-neon-confetti",
        "finisher-system-restored-shockwave",
        "finisher-cyber-lightning-strike",
        "finisher-matrix-override",
      ].includes(item.id) && (
        <div className="relative flex items-center justify-center">
          <span
            className="absolute w-16 h-16 rounded-full border-2 animate-ping opacity-40"
            style={{ borderColor: item.previewAccent }}
          />
          <span
            className="px-3 py-1.5 rounded-lg border border-white/50 text-white font-mono text-[11px] font-bold flex items-center gap-1.5"
            style={{ backgroundColor: item.previewAccent }}
          >
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{item.name.replace(/^(React Bits|Magic UI):\s*/i, "").slice(0, 14).toUpperCase()}</span>
          </span>
        </div>
      )}
    </div>
  );
}

function getEventCoords(e: ReactMouseEvent<HTMLElement>): { x: number; y: number } {
  if (e.clientX > 0 || e.clientY > 0) {
    return { x: e.clientX, y: e.clientY };
  }
  const rect = e.currentTarget.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

export interface CosmeticShopClientProps {
  extraItems?: CosmeticItem[];
}

export function CosmeticShopClient({ extraItems = [] }: CosmeticShopClientProps) {
  const [loading, setLoading] = useState(true);
  const [guestPlayer, setGuestPlayer] = useState<PublicGuestPlayer | null>(null);
  const [activeCategory, setActiveCategory] =
    useState<CosmeticCategory>("avatar_decoration");
  const [previewOverrides, setPreviewOverrides] = useState<
    Partial<EquippedCosmetics>
  >({});
  const [lastPreviewItemId, setLastPreviewItemId] = useState<string | null>(null);
  const [themePreviewEnabled, setThemePreviewEnabled] = useState(true);
  const [micTestActive, setMicTestActive] = useState(false);
  const [finisherActive, setFinisherActive] = useState(false);
  const [visibleCount, setVisibleCount] = useState(8);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const sandboxRef = useRef<HTMLElement | null>(null);
  const pendingCursorBurstRef = useRef<{
    x: number;
    y: number;
    effectId: string;
  } | null>(null);

  const syncFromServer = useCallback(async () => {
    const cached = readCachedGuestProfile();
    if (cached) {
      setGuestPlayer(cached);
      setLoading(false);
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

  const catalogItems = useMemo(() => {
    if (!extraItems.length) return COSMETIC_CATALOG;
    const seen = new Set(COSMETIC_CATALOG.map((item) => item.id));
    const uniqueExtra = extraItems.filter((item) => !seen.has(item.id));
    return [...COSMETIC_CATALOG, ...uniqueExtra];
  }, [extraItems]);

  const categoryItems = useMemo(
    () =>
      catalogItems
        .filter((item) => item.category === activeCategory)
        .sort(
          (a, b) =>
            RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] ||
            a.price - b.price ||
            a.name.localeCompare(b.name)
        ),
    [catalogItems, activeCategory]
  );

  const hasPreviewChanges = Object.keys(previewOverrides).length > 0;
  const hasAnyActiveSandbox = COSMETIC_CATEGORIES.some(
    (cat) => Boolean(activeSandbox[cat])
  );

  const activePreviewItem = useMemo(() => {
    if (lastPreviewItemId) {
      const last = catalogItems.find((item) => item.id === lastPreviewItemId);
      if (last && previewOverrides[last.category] === last.id) {
        return last;
      }
    }
    for (const cat of COSMETIC_CATEGORIES) {
      const overrideId = previewOverrides[cat];
      if (overrideId) {
        const found = catalogItems.find((item) => item.id === overrideId);
        if (found) return found;
      }
    }
    return null;
  }, [catalogItems, lastPreviewItemId, previewOverrides]);

  const dispatchCursorBurst = useCallback(
    (x: number, y: number, effectId: string) => {
      if (typeof window === "undefined") return;
      window.dispatchEvent(
        new CustomEvent(SPEAKIT_CURSOR_BURST_EVENT, {
          detail: { x, y, effectId },
        })
      );
    },
    []
  );

  useEffect(() => {
    const pending = pendingCursorBurstRef.current;
    if (!pending || activeSandbox.cursor_effect !== pending.effectId) return;
    pendingCursorBurstRef.current = null;
    dispatchCursorBurst(pending.x, pending.y, pending.effectId);
  }, [activeSandbox.cursor_effect, dispatchCursorBurst]);

  const handleSelectPreview = (
    item: CosmeticItem,
    coords?: { x: number; y: number }
  ) => {
    setLastPreviewItemId(item.id);
    setPreviewOverrides((prev) => ({
      ...prev,
      [item.category]: item.id,
    }));
    if (item.category === "profile_theme") {
      setThemePreviewEnabled(true);
    }
    if (item.category === "victory_finisher") {
      setFinisherActive(false);
      window.setTimeout(() => setFinisherActive(true), 20);
    }
    if (item.category === "cursor_effect") {
      const fallbackX = typeof window !== "undefined" ? window.innerWidth / 2 : 200;
      const fallbackY = typeof window !== "undefined" ? window.innerHeight / 2 : 300;
      const x = coords?.x ?? fallbackX;
      const y = coords?.y ?? fallbackY;
      if (activeSandbox.cursor_effect === item.id) {
        dispatchCursorBurst(x, y, item.id);
      } else {
        pendingCursorBurstRef.current = { x, y, effectId: item.id };
      }
    }
  };

  const handleScrollToSandbox = () => {
    if (sandboxRef.current && typeof sandboxRef.current.scrollIntoView === "function") {
      sandboxRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleResetToEquipped = () => {
    setLastPreviewItemId(null);
    setPreviewOverrides({});
    setThemePreviewEnabled(true);
    setFinisherActive(false);
  };

  const handleClearPreview = () => {
    setLastPreviewItemId(null);
    setPreviewOverrides({ ...DEFAULT_EQUIPPED_COSMETICS });
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

  const activeAvatarItem = catalogItems.find(
    (item) => item.id === activeSandbox.avatar_decoration
  );
  const activeThemeItem = catalogItems.find(
    (item) => item.id === activeSandbox.profile_theme
  );
  const activeNameplateItem = catalogItems.find(
    (item) => item.id === activeSandbox.nameplate
  );
  const activeFinisherItem = catalogItems.find(
    (item) => item.id === activeSandbox.victory_finisher
  );
  const isIdentityHydrating = loading && !guestPlayer;
  const initials = getInitials(identity.displayName);

  return (
    <div className="relative min-h-screen bg-transparent text-slate-900 dark:text-slate-100">
      <FullPageProfileEffect
        themeId={themePreviewEnabled ? activeSandbox.profile_theme : null}
        item={themePreviewEnabled ? activeThemeItem : null}
      />
      <CustomCursorTrail effectId={activeSandbox.cursor_effect} />
      <VictoryFinisherOverlay
        finisherId={activeSandbox.victory_finisher}
        active={finisherActive}
        title={activeFinisherItem?.name ?? "Victory Finisher Preview"}
        subtitle={`${isIdentityHydrating ? "--" : identity.displayName} : Live Try-On Studio`}
        onComplete={() => setFinisherActive(false)}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8 space-y-6 pb-28">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/profile"
              className="liquid-glass-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Hồ sơ</span>
            </Link>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-blue-700 dark:bg-blue-600 text-white">
                <ShoppingBag className="w-5 h-5" aria-hidden="true" />
              </span>
              <span>IT-Coin Live Try-On Studio</span>
            </h1>
          </div>

          <div
            data-tour="shop-coin-balance"
            className="flex flex-wrap items-center gap-2.5"
          >
            <span className="liquid-glass-pill inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-mono font-bold text-amber-700 dark:text-amber-300">
              <Coins className="w-4 h-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <span>{isIdentityHydrating ? "-- IT-Coins" : `${identity.itCoins} IT-Coins`}</span>
            </span>
            <Link
              href="/arena"
              className="liquid-btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors"
            >
              <Gamepad2 className="w-4 h-4 text-white" aria-hidden="true" />
              <span>Kiếm thêm Coin</span>
            </Link>
          </div>
        </div>

        <section
          ref={sandboxRef}
          aria-label="Live Try-On Sandbox"
          className="scroll-mt-20 liquid-glass-card p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] font-mono font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" aria-hidden="true" />
                <span>Live Try-On Sandbox</span>
              </div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-1.5">
                All 6 cosmetic slots render live below. Click any card in the catalog to mix &amp; match before unlocking.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setMicTestActive((v) => !v)}
                className={`liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors ${
                  micTestActive
                    ? "!bg-blue-50 dark:!bg-blue-950/50 !border-blue-700 dark:!border-blue-500 !text-blue-700 dark:!text-blue-300"
                    : ""
                }`}
              >
                <Mic className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{micTestActive ? "Mic Pulse: ON" : "Mic Pulse"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFinisherActive(false);
                  window.setTimeout(() => setFinisherActive(true), 20);
                }}
                className="liquid-btn-danger inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors"
              >
                <Flame className="w-3.5 h-3.5 text-white" aria-hidden="true" />
                <span>Trigger Finisher</span>
              </button>

              {hasAnyActiveSandbox && (
                <button
                  type="button"
                  onClick={handleClearPreview}
                  className="liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors"
                >
                  <Eraser className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Clear Preview</span>
                </button>
              )}

              {hasPreviewChanges && (
                <button
                  type="button"
                  onClick={handleResetToEquipped}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-mono font-bold border border-amber-300 dark:border-amber-800 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Reset to Equipped</span>
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              <div
                data-tour="shop-sandbox-preview"
                className="lg:col-span-5 flex items-center gap-4 border-l-2 border-blue-700 dark:border-blue-500 pl-4 py-2"
              >
                <DiscordAvatarFrame
                  equippedId={activeSandbox.avatar_decoration}
                  fallbackRing={identity.equippedRing}
                  item={activeAvatarItem}
                  size="xl"
                  micActive={micTestActive}
                >
                  <PlayerAvatar
                    avatarUrl={identity.avatarUrl}
                    displayName={isIdentityHydrating ? "--" : identity.displayName}
                    className="text-xl"
                  />
                </DiscordAvatarFrame>

                <div className="min-w-0 flex-1 space-y-2">
                  <NameplateBanner
                    nameplateId={activeSandbox.nameplate}
                    item={activeNameplateItem}
                    className={
                      activeSandbox.nameplate
                        ? "px-2.5 py-1.5"
                        : "rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900/60"
                    }
                  >
                    <div className="text-sm font-extrabold truncate text-slate-900 dark:text-slate-100">
                      {isIdentityHydrating ? (
                        <span
                          aria-label="Đang tải hồ sơ"
                          className="inline-block h-4 w-28 rounded animate-pulse align-middle bg-slate-200 dark:bg-slate-800"
                        />
                      ) : (
                        <NameplateDisplayText
                          name={identity.displayName}
                          nameplateId={activeSandbox.nameplate}
                        />
                      )}
                    </div>
                    <div className="text-xs font-mono truncate text-slate-600 dark:text-slate-400">
                      {isIdentityHydrating ? "--" : (identity.transferCode ?? "DEV-SANDBOX")} : {identity.equippedTitle}
                    </div>
                  </NameplateBanner>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setThemePreviewEnabled((v) => !v)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-colors ${
                        themePreviewEnabled && activeSandbox.profile_theme
                          ? "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                          : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200/75 dark:hover:bg-slate-700"
                      }`}
                    >
                      <Layers className="w-3 h-3" aria-hidden="true" />
                      <span>
                        Theme FX: {themePreviewEnabled ? "ON" : "OFF"}
                      </span>
                    </button>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
                      <MousePointer2 className="w-3 h-3 text-blue-700 dark:text-blue-400" aria-hidden="true" />
                      <span>{activeSandbox.cursor_effect ? "Cursor Live" : "Default Cursor"}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7">
                <LeaderboardRowWrapper
                  fxId={activeSandbox.leaderboard_fx}
                  nameplateId={activeSandbox.nameplate}
                  className="border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 font-mono text-xs font-bold shrink-0">
                        #1
                      </span>
                      <DiscordAvatarFrame
                        equippedId={activeSandbox.avatar_decoration}
                        fallbackRing={identity.equippedRing}
                        size="sm"
                        micActive={micTestActive}
                      >
                        <PlayerAvatar
                          avatarUrl={identity.avatarUrl}
                          displayName={isIdentityHydrating ? "--" : identity.displayName}
                          className="text-xs"
                        />
                      </DiscordAvatarFrame>
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5">
                          {isIdentityHydrating ? (
                            <span
                              aria-label="Đang tải hồ sơ"
                              className="inline-block h-4 w-28 rounded bg-slate-200 dark:bg-slate-800 animate-pulse"
                            />
                          ) : (
                            <NameplateDisplayText
                              name={identity.displayName}
                              nameplateId={activeSandbox.nameplate}
                            />
                          )}
                          <Crown className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
                        </div>
                        <div className="text-xs font-mono text-slate-600 dark:text-slate-400 truncate">
                          Live Identity Card : Leaderboard &amp; Nameplate FX
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 font-mono">
                      <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                        {isIdentityHydrating ? "-- pts" : `${identity.totalPoints.toLocaleString("vi-VN")} pts`}
                      </div>
                      <div className="text-xs text-amber-700 dark:text-amber-400 font-bold">
                        {isIdentityHydrating ? "-- IT-Coins" : `${identity.itCoins} IT-Coins`}
                      </div>
                    </div>
                  </div>
                </LeaderboardRowWrapper>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              {COSMETIC_CATEGORIES.map((cat) => {
                const meta = CATEGORY_META[cat];
                const Icon = meta.icon;
                const activeId = activeSandbox[cat];
                const activeItem = catalogItems.find((c) => c.id === activeId);
                const isOverridden = previewOverrides[cat] !== undefined;

                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() =>
                      startTransition(() => {
                        setActiveCategory(cat);
                        setVisibleCount(8);
                      })
                    }
                    className={`text-left rounded-lg border p-2.5 transition-colors ${
                      activeCategory === cat
                        ? "bg-blue-50 dark:bg-blue-950/50 border-blue-700 dark:border-blue-500"
                        : "bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold uppercase text-slate-600 dark:text-slate-400">
                        <Icon className="w-3 h-3 text-blue-700 dark:text-blue-400" aria-hidden="true" />
                        <span>{meta.shortLabel}</span>
                      </span>
                      {isOverridden && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-[10px] font-mono font-bold uppercase">
                          Try
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate mt-1">
                      {activeItem?.name ?? "None"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {feedback && (
          <div
            role="status"
            className={`px-4 py-3 rounded-xl border text-sm font-bold ${
              feedback.ok
                ? "bg-green-50 dark:bg-green-950/40 border-green-300 dark:border-green-800 text-green-700 dark:text-green-300"
                : "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-600 dark:text-red-300"
            }`}
          >
            {feedback.message}
          </div>
        )}

        <div
          role="tablist"
          aria-label="Cosmetic Categories"
          className="flex flex-wrap gap-2.5"
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
                onClick={() =>
                  startTransition(() => {
                    setActiveCategory(cat);
                    setVisibleCount(8);
                  })
                }
                className={`liquid-glass-pill inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold transition-colors ${
                  selected
                    ? "!bg-blue-50 dark:!bg-blue-950/50 !border-blue-700 dark:!border-blue-500 text-blue-700 dark:text-blue-300"
                    : "text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${selected ? "text-blue-700 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"}`}
                  aria-hidden="true"
                />
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {categoryItems.slice(0, visibleCount).map((item) => {
            const isOwned = identity.ownedItems.includes(item.id);
            const isEquipped = equipped[item.category] === item.id;
            const isPreviewing = activeSandbox[item.category] === item.id;
            const canAfford = identity.itCoins >= item.price;
            const isOnline = identity.mode === "online";

            const statusLabel = isPreviewing
              ? "Previewing"
              : isEquipped
                ? "Equipped"
                : isOwned
                  ? "Owned"
                  : null;

            return (
              <div
                key={item.id}
                onClick={(e) => handleSelectPreview(item, getEventCoords(e))}
                className={`cursor-pointer [content-visibility:auto] liquid-glass-card-lite p-4 flex flex-col justify-between gap-3.5 transition-colors ${
                  isPreviewing
                    ? "!border-blue-700 dark:!border-blue-500"
                    : "hover:border-blue-600 dark:hover:border-blue-500"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[11px] font-mono font-bold uppercase px-2 py-0.5 rounded-full ${
                        RARITY_BADGE_CLASS[item.rarity]
                      }`}
                    >
                      {item.rarity}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {statusLabel && (
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${
                            isPreviewing
                              ? "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                              : isEquipped
                                ? "bg-green-50 dark:bg-green-950/40 border-green-300 dark:border-green-800 text-green-700 dark:text-green-300"
                                : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {isPreviewing && <Eye className="w-2.5 h-2.5" aria-hidden="true" />}
                          <span>{statusLabel}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <CosmeticCardThumbnail
                    item={item}
                    displayName={isIdentityHydrating ? "--" : identity.displayName}
                    initials={isIdentityHydrating ? "--" : initials}
                    micActive={micTestActive}
                  />

                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                        {item.name}
                      </h3>
                      <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400 shrink-0">
                        {item.price} IT-Coins
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div
                  className="space-y-2 pt-2.5 border-t border-slate-200 dark:border-slate-800"
                  onClick={(e) => e.stopPropagation()}
                >
                  {isEquipped ? (
                    <div className="flex items-center gap-2">
                      <span className="flex-1 inline-flex items-center justify-center gap-1 py-2 px-3 rounded-lg liquid-btn-success text-xs font-mono font-bold">
                        <Check className="w-3.5 h-3.5 text-white" aria-hidden="true" />
                        <span>Equipped</span>
                      </span>
                      <button
                        type="button"
                        disabled={busyItemId === item.id || !isOnline}
                        onClick={() => handleUnequip(item.category, item.id)}
                        className="px-3 py-2 rounded-lg liquid-glass-btn text-xs font-mono font-bold disabled:opacity-50"
                      >
                        Unequip
                      </button>
                    </div>
                  ) : isOwned ? (
                    <button
                      type="button"
                      disabled={busyItemId === item.id || !isOnline}
                      onClick={() => handleEquipOwned(item)}
                      className="w-full py-2 px-3 rounded-lg liquid-btn-success text-xs font-mono font-bold disabled:opacity-50"
                    >
                      {busyItemId === item.id ? "Equipping..." : "Owned : Equip"}
                    </button>
                  ) : isOnline && canAfford ? (
                    <button
                      type="button"
                      disabled={busyItemId === item.id}
                      onClick={() => handleBuyAndEquip(item)}
                      className="w-full py-2 px-3 rounded-lg liquid-btn-primary text-xs font-mono font-bold disabled:opacity-50"
                    >
                      {busyItemId === item.id
                        ? "Unlocking..."
                        : `Unlock for ${item.price} IT-Coins`}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => handleSelectPreview(item, getEventCoords(e))}
                      className="w-full py-2 px-3 rounded-lg liquid-btn-primary opacity-85 hover:opacity-100 text-xs font-mono font-bold"
                    >
                      {`Unlock for ${item.price} IT-Coins`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {visibleCount < categoryItems.length && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => startTransition(() => setVisibleCount((prev) => prev + 8))}
              className="px-5 py-2.5 rounded-lg liquid-glass-btn text-xs font-bold transition-colors"
            >
              Xem thêm {Math.min(8, categoryItems.length - visibleCount)}/{categoryItems.length - visibleCount} mẫu khác
            </button>
          </div>
        )}
      </div>

      {activePreviewItem && (
        <div
          role="region"
          aria-label="Thanh xem thử hiệu ứng"
          className="fixed bottom-20 left-3 right-14 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:bottom-20 md:bottom-5 z-30 sm:w-max sm:max-w-[calc(100vw-11rem)]"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-blue-200 dark:border-blue-800 shadow-lg">
            <div className="flex items-start sm:items-center gap-2 min-w-0">
              <span className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">
                {activePreviewItem.category === "cursor_effect"
                  ? `Đang xem thử: ${activePreviewItem.name} : Chạm/vuốt màn hình để xem hiệu ứng`
                  : `Đang xem thử: ${activePreviewItem.name}`}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleScrollToSandbox}
                className="px-2.5 py-1.5 rounded-lg liquid-btn-primary text-xs font-mono font-bold whitespace-nowrap"
              >
                Xem Sandbox ↑
              </button>
              <button
                type="button"
                onClick={handleResetToEquipped}
                className="px-2.5 py-1.5 rounded-lg liquid-glass-btn text-xs font-mono font-bold whitespace-nowrap"
              >
                Đặt lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SpeakItLogo } from "./SpeakItLogo";
import {
  Home,
  Mic,
  Gamepad2,
  BookOpen,
  ClipboardCheck,
  TrendingUp,
  FileText,
  User,
  Settings,
  HelpCircle,
  Flame,
  Coins,
  ChevronDown,
  Menu,
  X,
  ShoppingBag,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  GAMIFICATION_STORAGE_KEY,
  GAMIFICATION_UPDATED_EVENT,
  getGamificationState,
  pointsToNextCoin,
} from "../../lib/gamification";
import {
  GUEST_PROFILE_CACHE_KEY,
  GUEST_PROFILE_UPDATED_EVENT,
  readBackupTransferCode,
  readCachedGuestProfile,
  syncGuestProfileFromServer,
} from "../../lib/guestClient";
import { initOrHydrateGuestSession } from "../../app/actions/leaderboard";
import type { PublicGuestPlayer } from "../../lib/db";
import { mergeProfileIdentity } from "../../lib/profileStats";
import type { GamificationState } from "../../lib/types";
import { CustomCursorTrail } from "../cosmetics/CustomCursorTrail";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type NavGroup = {
  id: string;
  label: string;
  activePrefixes: readonly string[];
  items: readonly NavItem[];
};

const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: "resources",
    label: "Học liệu",
    activePrefixes: ["/progress", "/research", "/guide"],
    items: [
      { href: "/progress", label: "Tiến độ & 7 ngày", icon: TrendingUp },
      { href: "/research", label: "Nghiên cứu IT", icon: FileText },
      { href: "/guide", label: "Hướng dẫn", icon: HelpCircle },
    ],
  },
  {
    id: "practice",
    label: "Luyện tập",
    activePrefixes: ["/scenarios", "/practice", "/arena", "/vocabulary", "/placement"],
    items: [
      { href: "/scenarios", label: "Kịch bản", icon: Mic },
      { href: "/arena", label: "Arena", icon: Gamepad2 },
      { href: "/arena/party", label: "Outage At 3AM", icon: Users },
      { href: "/vocabulary", label: "Từ vựng IT", icon: BookOpen },
      { href: "/placement", label: "Kiểm tra trình độ", icon: ClipboardCheck },
    ],
  },
  {
    id: "account",
    label: "Tài khoản",
    activePrefixes: ["/profile", "/settings"],
    items: [
      { href: "/profile", label: "Hồ sơ", icon: User },
      { href: "/shop", label: "Cửa hàng Hiệu ứng", icon: ShoppingBag },
      { href: "/settings", label: "Cài đặt", icon: Settings },
    ],
  },
];

function isItemActive(pathname: string, href: string): boolean {
  if (href === "/" || href === "/arena") {
    return pathname === href;
  }
  if (href === "/scenarios") {
    return (
      pathname === "/scenarios" ||
      pathname.startsWith("/scenarios/") ||
      pathname.startsWith("/practice")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isGroupActive(pathname: string, activePrefixes: readonly string[]): boolean {
  return activePrefixes.some((prefix) => pathname.startsWith(prefix));
}

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

export function Navbar() {
  const pathname = usePathname() ?? "";
  const [hydrated, setHydrated] = useState(false);
  const [gamification, setGamification] = useState<GamificationState>(INITIAL_GAMIFICATION);
  const [guestPlayer, setGuestPlayer] = useState<PublicGuestPlayer | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let active = true;

    const syncLocal = () => {
      if (!active) return;
      setGamification(getGamificationState());
    };

    const syncCachedGuest = (event?: Event) => {
      if (!active) return;
      if (event instanceof CustomEvent && event.detail !== undefined) {
        const detail = event.detail as PublicGuestPlayer | null;
        setGuestPlayer(
          detail ? { ...detail, ownedItems: [...detail.ownedItems] } : null
        );
        setHydrated(true);
        return;
      }
      const cached = readCachedGuestProfile();
      if (cached) {
        setGuestPlayer(cached);
        setHydrated(true);
      }
    };

    syncLocal();
    syncCachedGuest();

    const hydrateCloudGuest = async () => {
      try {
        const session = await initOrHydrateGuestSession(readBackupTransferCode());
        if (!active) return;
        if (session.mode === "online" && session.player) {
          const cached = readCachedGuestProfile();
          const isStaleHydration =
            cached !== null &&
            cached.id === session.player.id &&
            cached.totalPoints > session.player.totalPoints;
          if (!isStaleHydration) {
            setGuestPlayer(session.player);
            syncGuestProfileFromServer(session.player);
          }
        } else if (!readCachedGuestProfile()) {
          setGuestPlayer(null);
        }
      } catch {
      } finally {
        if (active) {
          setHydrated(true);
        }
      }
    };

    void hydrateCloudGuest();

    window.addEventListener(GAMIFICATION_UPDATED_EVENT, syncLocal);
    window.addEventListener(GUEST_PROFILE_UPDATED_EVENT, syncCachedGuest);

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === GAMIFICATION_STORAGE_KEY) {
        syncLocal();
      }
      if (!event.key || event.key === GUEST_PROFILE_CACHE_KEY) {
        syncCachedGuest();
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      active = false;
      window.removeEventListener(GAMIFICATION_UPDATED_EVENT, syncLocal);
      window.removeEventListener(GUEST_PROFILE_UPDATED_EVENT, syncCachedGuest);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    setOpenGroup(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenGroup(null);
        setMobileOpen(false);
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setOpenGroup(null);
        setMobileOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  if (pathname.startsWith("/admin")) {
    return null;
  }

  const identity = mergeProfileIdentity(guestPlayer, gamification);
  const nextCoinPoints = pointsToNextCoin(identity.totalPoints);
  const coinTooltip = `${identity.totalPoints.toLocaleString("en-US")} pts (${nextCoinPoints} pts nữa được +1 Coin)`;
  const homeActive = isItemActive(pathname, "/");
  const shopActive = pathname.startsWith("/shop");

  return (
    <>
      <CustomCursorTrail effectId={guestPlayer?.equippedCosmetics?.cursor_effect ?? null} />
      <header ref={headerRef} className="sticky top-0 z-40 bg-paper border-b border-ink/15">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-16 flex items-center justify-between gap-2 lg:gap-4">
        <Link
          href="/"
          aria-label="SpeakIT"
          className="flex items-center gap-2 focus:outline-none shrink-0"
        >
          <SpeakItLogo />
        </Link>

        <nav
          aria-label="Điều hướng chính"
          className="hidden md:flex items-center gap-1 lg:gap-2 min-w-0"
        >
          <Link
            href="/"
            aria-current={homeActive ? "page" : undefined}
            className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 text-xs lg:text-sm font-medium rounded-pill border transition-all shrink-0 whitespace-nowrap ${
              homeActive
                ? "bg-ink text-white border-ink shadow-soft"
                : "bg-white text-ink border-ink/15 hover:border-ink/30 hover:bg-paper-muted shadow-soft"
            }`}
          >
            <Home className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Trang chủ</span>
          </Link>

          <Link
            href="/shop"
            aria-current={shopActive ? "page" : undefined}
            className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 text-xs lg:text-sm font-medium rounded-pill border transition-all shrink-0 whitespace-nowrap ${
              shopActive
                ? "bg-ink text-white border-ink shadow-soft"
                : "bg-white text-ink border-ink/15 hover:border-ink/30 hover:bg-paper-muted shadow-soft"
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Cửa hàng</span>
          </Link>

          {NAV_GROUPS.map((group) => {
            const active = isGroupActive(pathname, group.activePrefixes);
            const isOpen = openGroup === group.id;

            return (
              <div key={group.id} className="relative shrink-0">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-haspopup="true"
                  onClick={() => setOpenGroup((prev) => (prev === group.id ? null : group.id))}
                  className={`flex items-center gap-1 lg:gap-1.5 px-2.5 lg:px-3 py-1.5 text-xs lg:text-sm font-medium rounded-pill border transition-all whitespace-nowrap ${
                    active || isOpen
                      ? "bg-ink text-white border-ink shadow-soft"
                      : "bg-white text-ink border-ink/15 hover:border-ink/30 hover:bg-paper-muted shadow-soft"
                  }`}
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {isOpen && (
                  <div
                    className={`absolute ${
                      group.id === "account" ? "right-0" : "left-0"
                    } top-full mt-2 w-60 p-1.5 bg-white border border-ink/15 rounded-2xl shadow-card z-50`}
                  >
                    {group.id === "account" && hydrated && (
                      <div className="px-3 py-2 mb-1 rounded-xl bg-paper border border-ink/10">
                        <div className="text-xs font-bold text-ink truncate">
                          {identity.displayName}
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5 text-[11px] font-mono text-ink-muted">
                          <span>{identity.transferCode ?? "Local Mode"}</span>
                          <span>{identity.totalPoints.toLocaleString("en-US")} pts</span>
                        </div>
                      </div>
                    )}
                    {group.items.map(({ href, label, icon: Icon }) => {
                      const itemActive = isItemActive(pathname, href);
                      return (
                        <Link
                          key={href}
                          href={href}
                          aria-current={itemActive ? "page" : undefined}
                          onClick={() => setOpenGroup(null)}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                            itemActive
                              ? "bg-ink text-white"
                              : "text-ink hover:bg-paper-muted"
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>{label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0">
          {!hydrated ? (
            <div
              aria-label="Đang đồng bộ tài khoản"
              className="shrink-0 h-8 w-36 sm:w-52 rounded-pill bg-paper-muted border border-ink/10 animate-pulse"
            />
          ) : (
            <div className="flex items-center gap-1.5 shrink-0 min-w-0">
              <Link
                href="/profile"
                title={
                  identity.transferCode
                    ? `${identity.displayName} (${identity.transferCode})`
                    : identity.displayName
                }
                className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-pill bg-white border border-ink/15 hover:border-ink/30 shadow-soft text-xs text-ink transition-colors max-w-[120px] lg:max-w-[165px] xl:max-w-[220px]"
              >
                <User className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden="true" />
                <span className="font-semibold truncate hidden sm:inline md:hidden lg:inline">{identity.displayName}</span>
                {identity.transferCode && (
                  <span className="hidden xl:inline font-mono text-[10px] px-1.5 py-0.5 rounded bg-paper border border-ink/10 text-ink-muted shrink-0">
                    {identity.transferCode}
                  </span>
                )}
              </Link>

              <Link
                href="/arena"
                title={coinTooltip}
                aria-label={`Chuỗi ${identity.streakDays} ngày, ${identity.itCoins} IT-Coin, ${identity.totalPoints} điểm. ${coinTooltip}`}
                className="shrink-0 flex items-center gap-1.5 lg:gap-2 px-2.5 lg:px-3 py-1.5 rounded-pill bg-white border border-ink/15 hover:border-ink/30 shadow-soft text-xs font-mono text-ink transition-colors"
              >
                <span className="inline-flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden="true" />
                  <span className="font-semibold">{identity.streakDays}</span>
                </span>
                <span className="text-ink/20" aria-hidden="true">
                  |
                </span>
                <span className="inline-flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-ink shrink-0" aria-hidden="true" />
                  <span className="font-semibold">{identity.itCoins}</span>
                  <span className="hidden lg:inline text-ink-muted">Coin</span>
                </span>
                <span className="hidden xl:inline text-ink/20" aria-hidden="true">
                  |
                </span>
                <span className="hidden xl:inline text-ink-muted">
                  {identity.totalPoints.toLocaleString("en-US")} pts
                </span>
              </Link>
            </div>
          )}

          <button
            type="button"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-menu"
            aria-label={mobileOpen ? "Đóng menu điều hướng" : "Mở menu điều hướng"}
            onClick={() => setMobileOpen((prev) => !prev)}
            className="md:hidden p-2 rounded-pill bg-white border border-ink/15 hover:border-ink/30 shadow-soft text-ink transition-colors"
          >
            {mobileOpen ? (
              <X className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Menu className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav
          id="mobile-nav-menu"
          aria-label="Điều hướng di động"
          className="md:hidden border-t border-ink/15 bg-paper px-4 py-3 space-y-3 max-h-[calc(100vh-4rem)] overflow-y-auto"
        >
          {hydrated && (
            <div className="px-3 py-2 rounded-xl bg-white border border-ink/15 flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <div className="font-bold text-ink truncate">{identity.displayName}</div>
                <div className="font-mono text-[11px] text-ink-muted">
                  {identity.transferCode ?? "Local Mode"}
                </div>
              </div>
              <div className="font-mono text-[11px] text-ink shrink-0">
                {identity.totalPoints.toLocaleString("en-US")} pts · {identity.itCoins} Coin
              </div>
            </div>
          )}

          <Link
            href="/"
            aria-current={homeActive ? "page" : undefined}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
              homeActive
                ? "bg-ink text-white border-ink shadow-soft"
                : "bg-white text-ink border-ink/15 hover:bg-paper-muted shadow-soft"
            }`}
          >
            <Home className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Trang chủ</span>
          </Link>

          <Link
            href="/shop"
            aria-current={shopActive ? "page" : undefined}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
              shopActive
                ? "bg-ink text-white border-ink shadow-soft"
                : "bg-white text-ink border-ink/15 hover:bg-paper-muted shadow-soft"
            }`}
          >
            <ShoppingBag className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Cửa hàng</span>
          </Link>

          {NAV_GROUPS.map((group) => (
            <div key={group.id} className="space-y-1">
              <div className="px-2 text-xs font-mono uppercase tracking-wider text-ink-muted">
                {group.label}
              </div>
              <div className="bg-white border border-ink/15 rounded-2xl p-1.5 shadow-soft space-y-0.5">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const itemActive = isItemActive(pathname, href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={itemActive ? "page" : undefined}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                        itemActive
                          ? "bg-ink text-white"
                          : "text-ink hover:bg-paper-muted"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      )}
      </header>
    </>
  );
}

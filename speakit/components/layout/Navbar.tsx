"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  LogIn,
  LogOut,
  ShoppingBag,
  ShieldCheck,
  Sun,
  Moon,
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
  requestOpenAuthModal,
  syncGuestProfileFromServer,
} from "../../lib/guestClient";
import {
  initOrHydrateGuestSession,
  logoutAccountAction,
} from "../../app/actions/leaderboard";
import type { PublicGuestPlayer } from "../../lib/db";
import { mergeProfileIdentity } from "../../lib/profileStats";
import type { GamificationState } from "../../lib/types";
import { CustomCursorTrail } from "../cosmetics/CustomCursorTrail";
import { InAppNotificationBell } from "./InAppNotificationBell";

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

const MOBILE_TABS: readonly NavItem[] = [
  { href: "/", label: "Trang chủ", icon: Home },
  { href: "/scenarios", label: "Kịch bản", icon: Mic },
  { href: "/arena", label: "Arena", icon: Gamepad2 },
  { href: "/vocabulary", label: "Từ vựng", icon: BookOpen },
  { href: "/profile", label: "Hồ sơ", icon: User },
];

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
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [gamification, setGamification] = useState<GamificationState>(INITIAL_GAMIFICATION);
  const [guestPlayer, setGuestPlayer] = useState<PublicGuestPlayer | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", next === "dark");
    }
    try {
      window.localStorage.setItem("speakit_theme_v1", next);
    } catch {}
  };

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

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
        let backupSessionToken = "";
        if (typeof window !== "undefined") {
          try {
            backupSessionToken =
              window.localStorage.getItem("speakit_session_token_v1")?.trim() || "";
          } catch {
          }
        }
        const session = await initOrHydrateGuestSession(
          backupSessionToken || readBackupTransferCode()
        );
        if (!active) return;
        if (
          "sessionToken" in session &&
          typeof (session as { sessionToken?: unknown }).sessionToken === "string"
        ) {
          const nextToken = (session as { sessionToken: string }).sessionToken.trim();
          if (nextToken && typeof window !== "undefined") {
            try {
              window.localStorage.setItem("speakit_session_token_v1", nextToken);
            } catch {
            }
          }
        }
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
        } else if (session.mode === "online" && !readCachedGuestProfile()) {
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
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenGroup(null);
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setOpenGroup(null);
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
  const hideBottomTabBar =
    pathname.startsWith("/practice/") ||
    pathname.startsWith("/arena/") ||
    pathname === "/placement";

  const handleLogout = async () => {
    await logoutAccountAction();
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem("speakit_session_token_v1");
      } catch {
      }
    }
    setGuestPlayer(null);
    syncGuestProfileFromServer(null);
    setOpenGroup(null);
    requestOpenAuthModal();
    router.refresh();
  };

  return (
    <>
      {!shopActive && (
        <CustomCursorTrail effectId={guestPlayer?.equippedCosmetics?.cursor_effect ?? null} />
      )}
      <header ref={headerRef} className="sticky top-3 z-40 w-full max-w-7xl mx-auto px-3">
        <div className="liquid-glass-pill px-3 sm:px-4 h-14 md:h-[60px] flex md:grid md:grid-cols-[1fr_auto_1fr] items-center justify-between gap-2 lg:gap-4">
          <Link
            href="/"
            aria-label="SpeakIT"
            className="flex items-center gap-2 focus:outline-none shrink-0 md:justify-self-start"
          >
            <SpeakItLogo />
          </Link>

          <nav
            aria-label="Điều hướng chính"
            className="hidden md:flex items-center justify-center gap-1 lg:gap-1.5 min-w-0 md:justify-self-center"
          >
            <Link
              href="/"
              aria-current={homeActive ? "page" : undefined}
              className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 text-sm font-medium rounded-pill border transition-colors shrink-0 whitespace-nowrap ${
                homeActive
                  ? "bg-blue-50 dark:bg-blue-950/70 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300"
                  : "bg-transparent text-slate-700 dark:text-slate-200 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Home className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Trang chủ</span>
            </Link>

            {NAV_GROUPS.flatMap((group) => {
              const active = isGroupActive(pathname, group.activePrefixes);
              const isOpen = openGroup === group.id;

              const groupNode = (
                <div key={group.id} className="relative shrink-0">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-haspopup="true"
                    onClick={() => setOpenGroup((prev) => (prev === group.id ? null : group.id))}
                    className={`flex items-center gap-1 lg:gap-1.5 px-2.5 lg:px-3 py-1.5 text-sm font-medium rounded-pill border transition-colors whitespace-nowrap ${
                      active || isOpen
                        ? "bg-blue-50 dark:bg-blue-950/70 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300"
                        : "bg-transparent text-slate-700 dark:text-slate-200 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
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
                      } top-full mt-2.5 w-64 p-1.5 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl shadow-sm z-50`}
                    >
                      {group.id === "account" && hydrated && (
                        <div className="px-3 py-2.5 mb-1 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                          <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {identity.displayName}
                          </div>
                          {guestPlayer?.email && (
                            <div className="text-xs text-blue-700 dark:text-blue-400 truncate mt-0.5">
                              {guestPlayer.email}
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-2 mt-1 text-xs font-mono text-slate-600 dark:text-slate-300">
                            {identity.transferCode && <span>{identity.transferCode}</span>}
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
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                              itemActive
                                ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                                : "text-slate-700 dark:text-slate-200 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                            }`}
                          >
                            <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                            <span>{label}</span>
                          </Link>
                        );
                      })}
                      {group.id === "account" && hydrated && (
                        <div className="mt-1 pt-1 border-t border-slate-200 dark:border-slate-800 space-y-0.5">
                          {guestPlayer?.email?.trim().toLowerCase() === "minhquanthcsbt@gmail.com" && (
                            <Link
                              href="/admin"
                              onClick={() => setOpenGroup(null)}
                              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/40 transition-colors"
                            >
                              <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                              <span>Quản trị Admin</span>
                            </Link>
                          )}
                          {guestPlayer?.email ? (
                            <button
                              type="button"
                              onClick={() => void handleLogout()}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                            >
                              <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
                              <span>Đăng xuất</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenGroup(null);
                                requestOpenAuthModal();
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                            >
                              <LogIn className="w-4 h-4 shrink-0" aria-hidden="true" />
                              <span>Đăng nhập / Đăng ký</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );

              if (group.id === "practice") {
                return [
                  groupNode,
                  <Link
                    key="shop"
                    href="/shop"
                    aria-current={shopActive ? "page" : undefined}
                    className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 text-sm font-medium rounded-pill border transition-colors shrink-0 whitespace-nowrap ${
                      shopActive
                        ? "bg-blue-50 dark:bg-blue-950/70 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300"
                        : "bg-transparent text-slate-700 dark:text-slate-200 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Cửa hàng</span>
                  </Link>,
                ];
              }

              return [groupNode];
            })}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0 md:justify-self-end">
            {!hydrated ? (
              <div
                aria-label="Đang đồng bộ tài khoản"
                className="shrink-0 h-8 w-28 md:w-52 rounded-pill bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 animate-pulse"
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
                  className="hidden shrink-0 items-center gap-1.5 px-2.5 py-1.5 rounded-pill bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-xs text-slate-800 dark:text-slate-100 transition-colors max-w-[120px] lg:max-w-[165px] xl:max-w-[220px]"
                >
                  <User className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" aria-hidden="true" />
                  <span className="font-semibold truncate hidden sm:inline md:hidden lg:inline">{identity.displayName}</span>
                  {identity.transferCode && (
                    <span className="hidden xl:inline font-mono text-[11px] px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shrink-0">
                      {identity.transferCode}
                    </span>
                  )}
                </Link>

                {!guestPlayer?.email && (
                  <button
                    type="button"
                    onClick={() => requestOpenAuthModal()}
                    className="hidden md:inline-flex shrink-0 items-center gap-1.5 px-3.5 py-1.5 rounded-pill liquid-btn-primary text-xs"
                  >
                    <LogIn className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Đăng nhập</span>
                  </button>
                )}

                <Link
                  href="/arena"
                  title={coinTooltip}
                  aria-label={`Chuỗi ${identity.streakDays} ngày, ${identity.itCoins} IT-Coin, ${identity.totalPoints} điểm. ${coinTooltip}`}
                  className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-pill bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 text-xs font-mono text-slate-900 dark:text-slate-100 transition-colors"
                >
                  <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                    <Flame className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
                    <span className="font-semibold">{identity.streakDays}</span>
                  </span>
                  <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">
                    |
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-green-700 dark:text-green-400 shrink-0" aria-hidden="true" />
                    <span className="font-semibold text-green-700 dark:text-green-400">{identity.itCoins}</span>
                  </span>
                </Link>

                <InAppNotificationBell lastPracticeDate={gamification.lastPracticeDate} />

                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
                  title={theme === "dark" ? "Chế độ sáng" : "Chế độ tối"}
                  className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full liquid-glass-btn"
                >
                  {theme === "dark" ? (
                    <Sun className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                  ) : (
                    <Moon className="w-4 h-4 text-blue-700 shrink-0" aria-hidden="true" />
                  )}
                </button>

                {guestPlayer?.email && (
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    aria-label="Đăng xuất"
                    title="Đăng xuất"
                    className="hidden md:inline-flex shrink-0 items-center justify-center w-8 h-8 rounded-full bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 transition-colors"
                  >
                    <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {!hideBottomTabBar && (
        <nav
          aria-label="Điều hướng nhanh di động"
          className="md:hidden fixed bottom-2.5 inset-x-3 z-40 mx-auto max-w-md rounded-full liquid-dock px-1.5 py-1 pb-safe"
        >
          <div className="grid grid-cols-5 items-center">
            {MOBILE_TABS.map(({ href, label, icon: Icon }) => {
              const active = pendingHref ? pendingHref === href : isItemActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  prefetch
                  onClick={() => {
                    if (pathname !== href) setPendingHref(href);
                  }}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center justify-center gap-0.5 min-h-[48px] px-1 py-1 rounded-full text-[11px] tracking-[0.02em] active:scale-95 transition-colors ${
                    active
                      ? "liquid-lens-active font-semibold"
                      : "text-slate-600 dark:text-slate-300 font-medium hover:text-slate-900 dark:hover:text-white border border-transparent"
                  }`}
                >
                  <span className="relative flex items-center justify-center">
                    <Icon
                      className={`w-[18px] h-[18px] shrink-0 ${active ? "stroke-[2.2]" : ""}`}
                      aria-hidden="true"
                    />
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute -top-0.5 -right-1 w-1.5 h-1.5 rounded-full bg-blue-700 dark:bg-blue-400"
                      />
                    )}
                  </span>
                  <span className="truncate max-w-full leading-tight">{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}

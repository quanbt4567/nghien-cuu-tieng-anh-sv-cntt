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
  type LucideIcon,
} from "lucide-react";
import {
  GAMIFICATION_STORAGE_KEY,
  GAMIFICATION_UPDATED_EVENT,
  calculateCoins,
  getGamificationState,
  pointsToNextCoin,
} from "../../lib/gamification";

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
  if (href === "/") {
    return pathname === "/";
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

export function Navbar() {
  const pathname = usePathname() ?? "";
  const [stats, setStats] = useState({ totalPoints: 0, streakDays: 0 });
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const syncStats = () => {
      const state = getGamificationState();
      setStats({ totalPoints: state.totalPoints, streakDays: state.streakDays });
    };

    syncStats();

    window.addEventListener(GAMIFICATION_UPDATED_EVENT, syncStats);

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === GAMIFICATION_STORAGE_KEY) {
        syncStats();
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(GAMIFICATION_UPDATED_EVENT, syncStats);
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

  const coins = calculateCoins(stats.totalPoints);
  const nextCoinPoints = pointsToNextCoin(stats.totalPoints);
  const coinTooltip = `${stats.totalPoints} pts (${nextCoinPoints} pts nữa được +1 Coin)`;
  const homeActive = isItemActive(pathname, "/");

  return (
    <header ref={headerRef} className="sticky top-0 z-40 bg-paper border-b border-ink/15">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <Link
          href="/"
          aria-label="SpeakIT"
          className="flex items-center gap-2 focus:outline-none shrink-0"
        >
          <SpeakItLogo />
        </Link>

        <nav
          aria-label="Điều hướng chính"
          className="hidden md:flex items-center gap-1.5 lg:gap-2"
        >
          <Link
            href="/"
            aria-current={homeActive ? "page" : undefined}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs lg:text-sm font-medium rounded-pill border transition-all whitespace-nowrap ${
              homeActive
                ? "bg-ink text-white border-ink shadow-soft"
                : "bg-white text-ink border-ink/15 hover:border-ink/30 hover:bg-paper-muted shadow-soft"
            }`}
          >
            <Home className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Trang chủ</span>
          </Link>

          {NAV_GROUPS.map((group) => {
            const active = isGroupActive(pathname, group.activePrefixes);
            const isOpen = openGroup === group.id;

            return (
              <div key={group.id} className="relative">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-haspopup="true"
                  onClick={() => setOpenGroup((prev) => (prev === group.id ? null : group.id))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs lg:text-sm font-medium rounded-pill border transition-all whitespace-nowrap ${
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
                  <div className="absolute left-0 top-full mt-2 w-56 p-1.5 bg-white border border-ink/15 rounded-2xl shadow-card z-50">
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

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/arena"
            title={coinTooltip}
            aria-label={`Chuỗi ${stats.streakDays} ngày và ${coins} IT-Coin. ${coinTooltip}`}
            className="shrink-0 flex items-center gap-1.5 lg:gap-2 px-2.5 lg:px-3 py-1.5 rounded-pill bg-white border border-ink/15 hover:border-ink/30 shadow-soft text-xs font-mono text-ink transition-colors"
          >
            <span className="inline-flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden="true" />
              <span className="font-semibold">{stats.streakDays}</span>
            </span>
            <span className="text-ink/20" aria-hidden="true">
              |
            </span>
            <span className="inline-flex items-center gap-1">
              <Coins className="w-3.5 h-3.5 text-ink shrink-0" aria-hidden="true" />
              <span className="font-semibold">{coins}</span>
              <span className="hidden lg:inline text-ink-muted">IT-Coin</span>
            </span>
          </Link>

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
  );
}

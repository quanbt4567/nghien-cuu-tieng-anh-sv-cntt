"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Mic,
  Gamepad2,
  BookOpen,
  TrendingUp,
  Settings,
  Flame,
  Coins,
} from "lucide-react";
import {
  GAMIFICATION_STORAGE_KEY,
  GAMIFICATION_UPDATED_EVENT,
  calculateCoins,
  getGamificationState,
  pointsToNextCoin,
} from "../../lib/gamification";

const NAV_LINKS = [
  { href: "/", label: "Kịch bản", shortLabel: "Kịch bản", icon: Mic },
  { href: "/arena", label: "Arena", shortLabel: "Arena", icon: Gamepad2 },
  { href: "/vocabulary", label: "Từ vựng (12)", shortLabel: "Từ vựng", icon: BookOpen },
  { href: "/progress", label: "Tiến độ & 7 ngày", shortLabel: "Tiến độ", icon: TrendingUp },
  { href: "/settings", label: "Cài đặt", shortLabel: "Cài đặt", icon: Settings },
] as const;

export function Navbar() {
  const pathname = usePathname() ?? "";
  // Initialize with zeroed SSR-safe values to avoid hydration mismatch before localStorage loads.
  const [stats, setStats] = useState({ totalPoints: 0, streakDays: 0 });

  useEffect(() => {
    const sync = () => {
      const state = getGamificationState();
      setStats({ totalPoints: state.totalPoints, streakDays: state.streakDays });
    };

    sync();
    window.addEventListener(GAMIFICATION_UPDATED_EVENT, sync);

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === GAMIFICATION_STORAGE_KEY) {
        sync();
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(GAMIFICATION_UPDATED_EVENT, sync);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const coins = calculateCoins(stats.totalPoints);
  const nextCoinPoints = pointsToNextCoin(stats.totalPoints);
  const coinTooltip = `${stats.totalPoints} pts (${nextCoinPoints} pts nữa được +1 Coin)`;

  return (
    <header className="sticky top-0 z-40 bg-paper border-b border-ink/15">
      <div className="max-w-5xl mx-auto px-4 py-2 md:py-0 md:h-16 flex flex-wrap md:flex-nowrap items-center justify-between gap-x-3 gap-y-2">
        <Link
          href="/"
          className="order-1 flex items-center gap-2 focus:outline-none shrink-0"
        >
          <Image
            src="/logo.png"
            alt="SpeakIT"
            width={120}
            height={42}
            className="h-8 sm:h-9 w-auto object-contain"
            priority
          />
        </Link>

        <Link
          href="/arena"
          title={coinTooltip}
          aria-label={`Chuỗi ${stats.streakDays} ngày và ${coins} IT-Coin. ${coinTooltip}`}
          className="order-2 md:order-3 shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-pill bg-white border border-ink/15 hover:border-ink/30 shadow-soft text-xs font-mono text-ink transition-colors"
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

        <nav
          aria-label="Điều hướng chính"
          className="order-3 md:order-2 w-full md:w-auto flex items-center gap-1.5 lg:gap-2 overflow-x-auto pb-0.5 md:pb-0"
        >
          {NAV_LINKS.map(({ href, label, shortLabel, icon: Icon }) => {
            const isActive =
              href === "/"
                ? pathname === "/" || pathname.startsWith("/practice")
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 text-xs lg:text-sm font-medium rounded-pill border transition-all shrink-0 ${
                  isActive
                    ? "bg-ink text-white border-ink shadow-soft"
                    : "bg-white text-ink border-ink/15 hover:border-ink/30 hover:bg-paper-muted shadow-soft"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="hidden lg:inline">{label}</span>
                <span className="lg:hidden">{shortLabel}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

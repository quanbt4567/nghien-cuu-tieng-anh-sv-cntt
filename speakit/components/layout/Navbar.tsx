"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mic, BookOpen, TrendingUp, Settings } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { href: "/", label: "Kịch bản", icon: Mic },
    { href: "/vocabulary", label: "Từ vựng (12)", icon: BookOpen },
    { href: "/progress", label: "Tiến độ & 7 ngày", icon: TrendingUp },
    { href: "/settings", label: "Cài đặt", icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-40 bg-paper border-b-2 border-ink">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 group focus:outline-none"
        >
          <div className="w-8 h-8 rounded-pill bg-accent flex items-center justify-center border-2 border-ink shadow-hard-sm">
            <Mic className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-display font-bold text-lg text-ink tracking-tight">
              Speak<span className="text-accent">IT</span>
            </span>
            <span className="text-[10px] font-mono text-ink-muted -mt-1">
              IT Workplace English
            </span>
          </div>
        </Link>

        {/* Navigation links */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-pill border-2 transition-all ${
                  isActive
                    ? "bg-ink text-white border-ink shadow-hard-sm"
                    : "bg-paper-card text-ink border-ink hover:bg-paper-muted"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}


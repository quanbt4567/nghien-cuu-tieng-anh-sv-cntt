"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Mic, BookOpen, TrendingUp, Settings } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { href: "/", label: "Kịch bản", shortLabel: "Kịch bản", icon: Mic },
    { href: "/vocabulary", label: "Từ vựng (12)", shortLabel: "Từ vựng", icon: BookOpen },
    { href: "/progress", label: "Tiến độ & 7 ngày", shortLabel: "Tiến độ", icon: TrendingUp },
    { href: "/settings", label: "Cài đặt", shortLabel: "Cài đặt", icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-40 bg-paper/95 backdrop-blur-sm border-b border-ink/10">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        {/* Brand / Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 group focus:outline-none shrink-0"
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

        {/* Navigation links with refined borders & centered soft shadows */}
        <nav className="flex items-center gap-1.5 sm:gap-2.5 overflow-x-auto py-1">
          {navLinks.map(({ href, label, shortLabel, icon: Icon }) => {
            const isActive =
              href === "/"
                ? pathname === "/" || pathname.startsWith("/practice")
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-pill border transition-all shrink-0 ${
                  isActive
                    ? "bg-ink text-white border-ink shadow-soft"
                    : "bg-white text-ink border-ink/15 hover:border-ink/30 hover:bg-paper-muted shadow-soft"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden text-xs">{shortLabel}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}


"use client";

import { usePathname } from "next/navigation";
import { SpeakItLogo } from "./SpeakItLogo";

export function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  return (
    <footer className="hidden md:block mt-auto border-t border-white/10 bg-slate-950/45 backdrop-blur-xl py-6 px-4">
      <div className="max-w-5xl mx-auto flex items-center justify-center sm:justify-start gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-2.5 text-center sm:text-left">
          <SpeakItLogo showWordmark={false} size="sm" />
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <span className="font-semibold text-white">SpeakIT</span>
            <span className="hidden sm:inline text-slate-600">•</span>
            <span>
              Nghiên cứu ứng dụng luyện nói tiếng Anh tình huống CNTT (IUH & BCN Club)
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

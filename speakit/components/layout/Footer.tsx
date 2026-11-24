"use client";

import { usePathname } from "next/navigation";
import { SpeakItLogo } from "./SpeakItLogo";

export function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  return (
    <footer className="hidden md:block mt-auto border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] py-6 px-4">
      <div className="max-w-5xl mx-auto flex items-center justify-center sm:justify-start gap-4 text-sm text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-2.5 text-center sm:text-left">
          <SpeakItLogo showWordmark={false} size="sm" />
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <span className="font-semibold text-slate-900 dark:text-white">SpeakIT</span>
            <span className="hidden sm:inline text-slate-400 dark:text-slate-500">•</span>
            <span>
              Nghiên cứu ứng dụng luyện nói tiếng Anh tình huống CNTT (IUH & BCN Club)
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

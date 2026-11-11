"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  return (
    <footer className="mt-auto border-t border-ink/10 bg-paper-muted py-6 px-4">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ink-muted">
        <div className="flex items-center gap-2.5 text-center sm:text-left">
          <Image
            src="/logo-icon.png"
            alt="SpeakIT"
            width={24}
            height={24}
            className="w-6 h-6 object-contain rounded-md"
          />
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <span className="font-semibold text-ink">SpeakIT</span>
            <span className="hidden sm:inline">•</span>
            <span>
              Nghiên cứu ứng dụng luyện nói tiếng Anh tình huống CNTT (IUH & BCN Club)
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-x-3 gap-y-1 font-mono text-[11px]">
          <span>EF EPI 2025: VN 500 (Speaking 461)</span>
          <span aria-hidden="true">•</span>
          <span className="text-accent font-semibold">Bản nghiên cứu mở</span>
          <span aria-hidden="true">•</span>
          <Link
            href="/admin"
            className="text-ink-muted hover:text-ink transition-colors underline-offset-4 hover:underline"
          >
            Cổng Quản trị (Admin) →
          </Link>
        </div>
      </div>
    </footer>
  );
}


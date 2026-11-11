"use client";

import Link from "next/link";
import { AlertTriangle, Settings } from "lucide-react";

interface AiModeBannerProps {
  visible?: boolean;
}

export function AiModeBanner({ visible = true }: AiModeBannerProps) {
  if (!visible) return null;

  return (
    <div className="bg-paper-muted border-2 border-ink rounded-xl p-3 shadow-hard-sm flex items-center justify-between gap-3 text-xs text-ink">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-accent shrink-0" />
        <div>
          <span className="font-bold">Chế độ AI đang tắt</span>
          <span className="text-ink-muted"> — Đang chấm điểm bằng bộ quy tắc từ khóa cục bộ.</span>
        </div>
      </div>
      <Link
        href="/settings"
        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono font-medium rounded-pill bg-paper-card text-ink border border-ink hover:bg-paper shadow-hard-press"
      >
        <Settings className="w-3 h-3" />
        <span>Thêm khóa AI</span>
      </Link>
    </div>
  );
}


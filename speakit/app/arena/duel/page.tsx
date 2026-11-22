import Link from "next/link";
import { ArrowLeft, ShoppingBag, Swords } from "lucide-react";
import { CodeReviewDuelArena } from "@/components/arena/duel/CodeReviewDuelArena";

export default function ArenaDuelPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/arena"
          className="liquid-glass-pill inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-slate-100 hover:text-cyan-200 hover:border-cyan-400/50 text-xs font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Về sảnh Arena</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="liquid-glass-pill inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono text-slate-200">
            <Swords className="w-3.5 h-3.5 text-violet-300" />
            <span>Tranh luận Code 1v1 • Đấu với AI</span>
          </span>
          <Link
            href="/shop"
            className="liquid-glass-pill inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border-amber-400/45 text-amber-200 hover:bg-amber-500/30 hover:text-white text-[11px] font-mono font-semibold transition-colors"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-amber-300" />
            <span>Cửa hàng IT-Coin</span>
          </Link>
        </div>
      </div>

      <CodeReviewDuelArena />
    </div>
  );
}

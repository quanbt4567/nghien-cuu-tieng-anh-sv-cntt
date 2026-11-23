import Link from "next/link";
import { ArrowLeft, ShoppingBag, Swords } from "lucide-react";
import { CodeReviewDuelArena } from "@/components/arena/duel/CodeReviewDuelArena";

export default function ArenaDuelPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/arena"
          className="liquid-glass-btn inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-slate-800 dark:text-slate-100 hover:text-blue-700 dark:hover:text-blue-400 hover:border-blue-400 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Về sảnh Arena</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 text-xs font-mono text-slate-800 dark:text-slate-200">
            <Swords className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
            <span>Tranh luận Code 1v1, Đấu với AI</span>
          </span>
          <Link
            href="/shop"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-900/50 text-xs font-mono font-semibold transition-colors"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
            <span>Cửa hàng IT-Coin</span>
          </Link>
        </div>
      </div>

      <CodeReviewDuelArena />
    </div>
  );
}

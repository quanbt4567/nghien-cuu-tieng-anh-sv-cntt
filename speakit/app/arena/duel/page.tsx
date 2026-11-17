import Link from "next/link";
import { ArrowLeft, ShoppingBag, Swords } from "lucide-react";
import { CodeReviewDuelArena } from "@/components/arena/duel/CodeReviewDuelArena";

export default function ArenaDuelPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/arena"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-ink text-xs font-medium border border-ink/15 shadow-hard-press"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Về sảnh Arena</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-paper border border-ink/20 text-[11px] font-mono text-ink">
            <Swords className="w-3.5 h-3.5 text-accent" />
            <span>Tranh luận Code 1v1 • Đấu với AI</span>
          </span>
          <Link
            href="/shop"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ink text-white text-[11px] font-mono font-semibold border border-ink shadow-hard-press hover:text-ink"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-accent" />
            <span>Cửa hàng IT-Coin</span>
          </Link>
        </div>
      </div>

      <CodeReviewDuelArena />
    </div>
  );
}

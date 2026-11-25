import Link from "next/link";
import { ArrowLeft, ShoppingBag, Users } from "lucide-react";
import { PartyWarRoom } from "@/components/arena/party/PartyWarRoom";

export default function ArenaPartyPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/arena"
          className="liquid-glass-btn inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-slate-800 dark:text-slate-100 hover:text-blue-700 dark:hover:text-blue-400 hover:border-blue-400 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-600/50"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Về sảnh Arena</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 dark:bg-red-950/40 dark:border-red-800 text-xs font-mono text-slate-800 dark:text-slate-200">
            <Users className="w-3.5 h-3.5 text-red-600 dark:text-red-400" aria-hidden="true" />
            <span>Xử lý sự cố 3h sáng, Phối hợp đồng đội</span>
          </span>
          <Link
            href="/shop"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-900/50 text-xs font-mono font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-blue-600/50"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" aria-hidden="true" />
            <span>Cửa hàng IT-Coin</span>
          </Link>
        </div>
      </div>

      <PartyWarRoom />
    </div>
  );
}

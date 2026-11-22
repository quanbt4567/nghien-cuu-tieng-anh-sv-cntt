import Link from "next/link";
import { ArrowLeft, ShoppingBag, Users } from "lucide-react";
import { PartyWarRoom } from "@/components/arena/party/PartyWarRoom";

export default function ArenaPartyPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/arena"
          className="liquid-glass-pill inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-slate-800 hover:text-sky-700 hover:border-sky-400/60 text-xs font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Về sảnh Arena</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="liquid-glass-pill inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono text-slate-700">
            <Users className="w-3.5 h-3.5 text-rose-600" />
            <span>Xử lý sự cố 3h sáng • Phối hợp đồng đội</span>
          </span>
          <Link
            href="/shop"
            className="liquid-glass-pill inline-flex items-center gap-1.5 px-3 py-1 rounded-full !bg-amber-100/90 !border-amber-300/80 text-amber-800 hover:!bg-amber-200/90 hover:text-amber-950 text-[11px] font-mono font-semibold transition-colors"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
            <span>Cửa hàng IT-Coin</span>
          </Link>
        </div>
      </div>

      <PartyWarRoom />
    </div>
  );
}

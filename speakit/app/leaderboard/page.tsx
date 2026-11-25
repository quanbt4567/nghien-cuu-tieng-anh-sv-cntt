import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";
import { getTopPlayers } from "../actions/leaderboard";
import { GlobalLeaderboard } from "../../components/leaderboard/GlobalLeaderboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bảng xếp hạng: SpeakIT",
  description:
    "Bảng xếp hạng điểm luyện nói và số dư IT-Coin của học viên CNTT trên SpeakIT.",
};

export default async function LeaderboardPage() {
  const initialBoard = await getTopPlayers(50);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2.5">
          <Link
            href="/"
            className="liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono text-slate-700 dark:text-slate-200 transition-colors focus-visible:ring-2 focus-visible:ring-blue-600/50"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Trang chủ</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5 text-balance">
            <Trophy className="w-6 h-6 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <span>Bảng xếp hạng</span>
          </h1>
        </div>
      </div>

      <GlobalLeaderboard initialBoard={initialBoard} />
    </div>
  );
}

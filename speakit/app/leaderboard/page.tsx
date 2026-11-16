import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";
import { getTopPlayers } from "../actions/leaderboard";
import { GlobalLeaderboard } from "../../components/leaderboard/GlobalLeaderboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bảng xếp hạng — SpeakIT",
  description:
    "Bảng xếp hạng điểm luyện nói và số dư IT-Coin của học viên CNTT trên SpeakIT.",
};

export default async function LeaderboardPage() {
  const initialBoard = await getTopPlayers(50);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-ink-muted hover:text-ink mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Trang chủ</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink flex items-center gap-2.5">
            <Trophy className="w-6 h-6 text-accent" />
            <span>Bảng xếp hạng</span>
          </h1>
        </div>
      </div>

      <GlobalLeaderboard initialBoard={initialBoard} />
    </div>
  );
}

import Link from "next/link";
import { ArrowRight, BookOpen, Clock, Coins, Flame, Gamepad2, Trophy } from "lucide-react";
import { HomeOnboardingClient } from "../components/home/HomeOnboardingClient";
import { EF_EPI_2025 } from "../data/efEpiData";
import { getRingBadgeClass } from "../lib/cosmetics";
import { getTopPlayers } from "./actions/leaderboard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const leaderboard = await getTopPlayers(3);
  const topLeaders = leaderboard.players.slice(0, 3);

  return (
    <div className="max-w-5xl mx-auto px-4 py-7 sm:py-9 space-y-8">
      <header className="space-y-1.5">
        <p className="text-xs font-mono font-semibold uppercase tracking-wider text-accent">
          SpeakIT · Luyện nói tiếng Anh CNTT
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
          Luyện phản xạ nói theo tình huống công việc
        </h1>
      </header>

      <HomeOnboardingClient />

      <section
        aria-label="Top 3 Arena Leaders"
        className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
            <h2 className="text-base font-bold text-ink">Top 3 Arena Leaders</h2>
          </div>
          <Link
            href="/arena"
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-hover transition-colors"
          >
            <span>Xem bảng xếp hạng</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>

        {topLeaders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {topLeaders.map((player) => (
              <Link
                key={player.id}
                href="/arena"
                className="bg-paper border border-ink/15 hover:border-ink/30 rounded-xl p-4 flex items-center justify-between gap-3 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-9 h-9 rounded-pill bg-white border font-mono text-xs font-bold text-ink flex items-center justify-center shrink-0 ${getRingBadgeClass(
                      player.equippedRing
                    )}`}
                  >
                    #{player.rank}
                  </span>
                  <div className="min-w-0 space-y-1">
                    <div className="text-sm font-bold text-ink break-words">
                      {player.displayName}
                    </div>
                    <span className="inline-block text-[11px] font-mono px-2 py-0.5 rounded-pill bg-white border border-ink/15 text-ink-muted">
                      {player.equippedTitle}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0 space-y-1">
                  <div className="inline-flex items-center gap-1 text-xs font-mono font-bold text-ink">
                    <Coins className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden="true" />
                    <span>{player.itCoins}</span>
                  </div>
                  <div className="flex items-center justify-end gap-1 text-[11px] font-mono text-ink-muted">
                    <Flame className="w-3 h-3 text-accent shrink-0" aria-hidden="true" />
                    <span>{player.streakDays}d</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-paper border border-ink/10 rounded-xl p-4 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
            <span>
              Chưa có dữ liệu bảng xếp hạng trực tuyến. Hoàn thành một vòng Arena để ghi danh #1.
            </span>
            <Link
              href="/arena"
              className="font-mono font-semibold text-accent hover:underline"
            >
              Mở /arena →
            </Link>
          </div>
        )}
      </section>

      <section aria-label="Công cụ ôn tập nhanh" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/vocabulary"
          className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft hover:shadow-card hover:-translate-y-0.5 transition-all flex items-start gap-3.5"
        >
          <div className="w-9 h-9 rounded-pill bg-paper flex items-center justify-center border border-ink/15 shrink-0">
            <BookOpen className="w-4 h-4 text-accent" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-ink">Từ vựng IT</h3>
            <p className="text-xs text-ink-muted">
              Phát âm IPA và câu ví dụ công việc thực tế.
            </p>
          </div>
        </Link>

        <Link
          href="/progress"
          className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft hover:shadow-card hover:-translate-y-0.5 transition-all flex items-start gap-3.5"
        >
          <div className="w-9 h-9 rounded-pill bg-paper flex items-center justify-center border border-ink/15 shrink-0">
            <Clock className="w-4 h-4 text-accent" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-ink">Kế hoạch 7 ngày</h3>
            <p className="text-xs text-ink-muted">
              Tổng hợp từ khóa và lỗi ngữ pháp cần ôn.
            </p>
          </div>
        </Link>

        <Link
          href="/arena"
          className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft hover:shadow-card hover:-translate-y-0.5 transition-all flex items-start gap-3.5"
        >
          <div className="w-9 h-9 rounded-pill bg-paper flex items-center justify-center border border-ink/15 shrink-0">
            <Gamepad2 className="w-4 h-4 text-accent" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-ink">IT Speaking Arena</h3>
            <p className="text-xs text-ink-muted">
              Thử thách tốc độ 60s để kiếm IT-Coin.
            </p>
          </div>
        </Link>
      </section>

      <p className="text-[11px] font-mono text-ink-muted text-center">
        Tham chiếu EF EPI {EF_EPI_2025.year} ({EF_EPI_2025.country}): Kỹ năng Speaking {EF_EPI_2025.skills.speaking} điểm — SpeakIT tập trung cải thiện phản xạ nói tiếng Anh chuyên ngành.
      </p>
    </div>
  );
}

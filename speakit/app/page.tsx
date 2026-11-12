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
    <div className="max-w-5xl mx-auto px-4 py-5 sm:py-6 space-y-6">
      <header className="space-y-1">
        <p className="text-[11px] font-mono font-semibold uppercase tracking-wider text-accent">
          SpeakIT • Luyện nói tiếng Anh CNTT • Không cần đăng nhập
        </p>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
          Luyện phản xạ nói tiếng Anh theo tình huống công việc
        </h1>
        <p className="text-xs text-ink-muted">
          Chọn vai trò chuyên môn để bắt đầu nhanh trong ~3 phút, nhận phản hồi từ khóa tức thì và tích lũy IT-Coin.
        </p>
      </header>

      <HomeOnboardingClient />

      <section
        aria-label="Top 3 Arena Leaders"
        className="bg-white border border-ink/15 rounded-2xl p-4 sm:p-5 shadow-soft space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
            <h2 className="text-sm font-bold text-ink">Top 3 Arena Leaders</h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-pill bg-paper border border-ink/15 text-ink-muted">
              {leaderboard.mode === "online" ? "Neon Live" : "Offline"}
            </span>
          </div>
          <Link
            href="/arena"
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-hover transition-colors"
          >
            <span>Vào Arena &amp; Bảng xếp hạng</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>

        {topLeaders.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {topLeaders.map((player) => (
              <Link
                key={player.id}
                href="/arena"
                className="bg-paper border border-ink/15 hover:border-ink/30 rounded-xl p-3.5 flex items-center justify-between gap-3 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-8 h-8 rounded-pill bg-white border font-mono text-xs font-bold text-ink flex items-center justify-center shrink-0 ${getRingBadgeClass(
                      player.equippedRing
                    )}`}
                  >
                    #{player.rank}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-ink truncate">
                      {player.displayName}
                    </div>
                    <span className="inline-block mt-0.5 text-[10px] font-mono px-2 py-0.5 rounded-pill bg-white border border-ink/15 text-ink-muted truncate max-w-full">
                      {player.equippedTitle}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0 space-y-0.5">
                  <div className="inline-flex items-center gap-1 text-xs font-mono font-bold text-ink">
                    <Coins className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden="true" />
                    <span>{player.itCoins}</span>
                  </div>
                  <div className="flex items-center justify-end gap-1 text-[10px] font-mono text-ink-muted">
                    <Flame className="w-3 h-3 text-accent shrink-0" aria-hidden="true" />
                    <span>{player.streakDays}d</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-paper border border-ink/10 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
            <span>
              Chưa có dữ liệu bảng xếp hạng trực tuyến. Hoàn thành một vòng luyện Arena để ghi danh vị trí #1.
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
              Phát âm IPA và câu ví dụ: standup, blocker, PR, deploy...
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
              Tự động gom từ khóa và lỗi ngữ pháp hay quên để ôn lại.
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
              Bug Buster 60s &amp; Standup Speed Run kiếm IT-Coin.
            </p>
          </div>
        </Link>
      </section>

      {/* Compact Verified EF EPI 2025 Benchmark */}
      <section
        aria-label="Số liệu tham chiếu EF EPI 2025"
        className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-paper-muted pb-3">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-ink">
            Số liệu tham chiếu • EF EPI {EF_EPI_2025.year} ({EF_EPI_2025.country})
          </span>
          <span className="text-[11px] font-mono text-ink-muted">
            {EF_EPI_2025.targetDemographic}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-paper p-3 rounded-xl border border-ink/10 text-center">
            <div className="text-xl sm:text-2xl font-mono font-bold text-ink">
              {EF_EPI_2025.score}
            </div>
            <div className="text-[11px] text-ink-muted mt-0.5">
              Điểm toàn quốc VN
            </div>
          </div>
          <div className="bg-paper p-3 rounded-xl border border-ink/10 text-center">
            <div className="text-xl sm:text-2xl font-mono font-bold text-ink">
              {EF_EPI_2025.globalRank}/{EF_EPI_2025.totalCountries}
            </div>
            <div className="text-[11px] text-ink-muted mt-0.5">
              Hạng toàn cầu
            </div>
          </div>
          <div className="bg-paper p-3 rounded-xl border border-ink/10 text-center">
            <div className="text-xl sm:text-2xl font-mono font-bold text-ink">
              {EF_EPI_2025.asiaRank}/{EF_EPI_2025.totalAsiaCountries}
            </div>
            <div className="text-[11px] text-ink-muted mt-0.5">
              Hạng châu Á
            </div>
          </div>
          <div className="bg-accent-light p-3 rounded-xl border border-accent/25 text-center">
            <div className="text-xl sm:text-2xl font-mono font-bold text-accent">
              Speaking {EF_EPI_2025.skills.speaking}
            </div>
            <div className="text-[11px] font-semibold text-accent mt-0.5">
              Yếu nhất (Reading {EF_EPI_2025.skills.reading})
            </div>
          </div>
        </div>

        <p className="text-[11px] font-mono text-ink-muted leading-relaxed">
          Nguồn: {EF_EPI_2025.sourceCitation}. Dữ liệu phản ánh mặt bằng toàn quốc ({EF_EPI_2025.targetDemographic}); SpeakIT mở miễn phí phục vụ luyện tập phản xạ nói tình huống CNTT.
        </p>
      </section>
    </div>
  );
}

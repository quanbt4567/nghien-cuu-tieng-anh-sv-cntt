import Link from "next/link";
import { ArrowRight, BookOpen, Clock, Coins, Flame, Gamepad2, MessageSquare, ShoppingBag, Siren, Trophy } from "lucide-react";
import { DiscordAvatarFrame } from "../components/cosmetics/DiscordAvatarFrame";
import { LeaderboardRowWrapper } from "../components/cosmetics/LeaderboardRowWrapper";
import { PlayerAvatar } from "../components/cosmetics/PlayerAvatar";
import { HomeIntroHero } from "../components/home/HomeIntroHero";
import { getMergedScenarios } from "../lib/serverScenarios";
import { getTopPlayers } from "./actions/leaderboard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [leaderboard, scenarios] = await Promise.all([
    getTopPlayers(3),
    getMergedScenarios(),
  ]);
  const topLeaders = leaderboard.players.slice(0, 3);
  const scenarioCount = scenarios.length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-7 sm:py-9 space-y-8">
      <HomeIntroHero scenarioCount={scenarioCount} />

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
            className="interactive-btn-accent inline-flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 bg-accent/10 hover:bg-accent text-accent hover:text-white border border-accent/40 text-xs font-semibold"
          >
            <span>Xem bảng xếp hạng</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>

        {topLeaders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {topLeaders.map((player) => (
              <LeaderboardRowWrapper
                key={player.id}
                fxId={player.equippedCosmetics?.leaderboard_fx}
                nameplateId={player.equippedCosmetics?.nameplate}
                className="interactive-card bg-paper border border-ink/20 rounded-xl"
              >
                <Link
                  href="/arena"
                  className="p-4 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <DiscordAvatarFrame
                      equippedId={player.equippedCosmetics?.avatar_decoration ?? player.equippedRing}
                      fallbackRing={player.equippedRing}
                      size={36}
                    >
                      <PlayerAvatar
                        avatarUrl={player.avatarUrl}
                        displayName={player.displayName}
                        className="text-xs"
                      />
                    </DiscordAvatarFrame>
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
              </LeaderboardRowWrapper>
            ))}
          </div>
        ) : (
          <div className="bg-paper border border-ink/10 rounded-xl p-4 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
            <span>
              Chưa có dữ liệu bảng xếp hạng trực tuyến. Hoàn thành một vòng Arena để ghi danh #1.
            </span>
            <Link
              href="/arena"
              className="interactive-btn-accent inline-flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 bg-accent hover:bg-accent-hover text-white border border-ink font-mono text-xs font-semibold shadow-soft"
            >
              <span>Mở /arena</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
        )}
      </section>

      <section aria-label="Công cụ ôn tập nhanh" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          href="/scenarios"
          className="group interactive-card bg-white border border-ink/20 rounded-2xl p-5 shadow-soft flex flex-col justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-pill bg-paper flex items-center justify-center border border-ink/15 shrink-0">
              <MessageSquare className="w-4 h-4 text-accent" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-ink group-hover:text-accent transition-colors">
                Kịch bản luyện nói
              </h3>
              <p className="text-xs text-ink-muted">
                {scenarioCount} tình huống công việc CNTT chia theo 3 cấp độ Fresher / Junior / Senior.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <span className="inline-flex items-center gap-1 rounded-pill px-3 py-1 bg-paper group-hover:bg-accent text-ink group-hover:text-white border border-ink/20 group-hover:border-ink text-xs font-semibold transition-all">
              <span>Luyện kịch bản</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </span>
          </div>
        </Link>

        <Link
          href="/vocabulary"
          className="group interactive-card bg-white border border-ink/20 rounded-2xl p-5 shadow-soft flex flex-col justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-pill bg-paper flex items-center justify-center border border-ink/15 shrink-0">
              <BookOpen className="w-4 h-4 text-accent" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-ink group-hover:text-accent transition-colors">
                Từ vựng IT
              </h3>
              <p className="text-xs text-ink-muted">
                Phát âm IPA và câu ví dụ công việc thực tế.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <span className="inline-flex items-center gap-1 rounded-pill px-3 py-1 bg-paper group-hover:bg-accent text-ink group-hover:text-white border border-ink/20 group-hover:border-ink text-xs font-semibold transition-all">
              <span>Ôn từ vựng</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </span>
          </div>
        </Link>

        <Link
          href="/progress"
          className="group interactive-card bg-white border border-ink/20 rounded-2xl p-5 shadow-soft flex flex-col justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-pill bg-paper flex items-center justify-center border border-ink/15 shrink-0">
              <Clock className="w-4 h-4 text-accent" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-ink group-hover:text-accent transition-colors">
                Kế hoạch 7 ngày
              </h3>
              <p className="text-xs text-ink-muted">
                Tổng hợp từ khóa và lỗi ngữ pháp cần ôn.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <span className="inline-flex items-center gap-1 rounded-pill px-3 py-1 bg-paper group-hover:bg-accent text-ink group-hover:text-white border border-ink/20 group-hover:border-ink text-xs font-semibold transition-all">
              <span>Xem lộ trình</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </span>
          </div>
        </Link>

        <Link
          href="/arena"
          className="group interactive-card bg-white border border-ink/20 rounded-2xl p-5 shadow-soft flex flex-col justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-pill bg-paper flex items-center justify-center border border-ink/15 shrink-0">
              <Gamepad2 className="w-4 h-4 text-accent" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-ink group-hover:text-accent transition-colors">
                IT Speaking Arena
              </h3>
              <p className="text-xs text-ink-muted">
                Thử thách tốc độ 60s để kiếm IT-Coin.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <span className="inline-flex items-center gap-1 rounded-pill px-3 py-1 bg-paper group-hover:bg-accent text-ink group-hover:text-white border border-ink/20 group-hover:border-ink text-xs font-semibold transition-all">
              <span>Vào đấu trường</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </span>
          </div>
        </Link>

        <Link
          href="/arena/party"
          className="group bg-[#FAF6EF] border-2 border-[#1A1714] rounded-2xl p-5 shadow-[4px_4px_0_#1A1714] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex flex-col justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-pill bg-[#E5484D] text-white flex items-center justify-center border-2 border-[#1A1714] shrink-0">
              <Siren className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-[#1A1714] group-hover:text-[#E5484D] transition-colors">
                Outage At 3AM (Party Mode)
              </h3>
              <p className="text-xs text-[#1A1714]/75">
                Phối hợp nhóm xử lý sự cố production khẩn cấp theo thời gian thực.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <span className="inline-flex items-center gap-1 rounded-pill px-3 py-1 bg-[#E5484D] text-white border-2 border-[#1A1714] text-xs font-semibold transition-all">
              <span>Mở Party Mode</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </span>
          </div>
        </Link>

        <Link
          href="/shop"
          className="group bg-white border-2 border-[#1A1714] rounded-2xl p-5 shadow-[4px_4px_0_#1A1714] hover:bg-[#FAF6EF] transition-all flex flex-col justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-pill bg-[#FAF6EF] text-[#E5484D] flex items-center justify-center border-2 border-[#1A1714] shrink-0">
              <ShoppingBag className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-[#1A1714] group-hover:text-[#E5484D] transition-colors">
                Cửa hàng Hiệu ứng
              </h3>
              <p className="text-xs text-[#1A1714]/75">
                Đổi IT-Coin lấy khung avatar, nameplate và hiệu ứng bảng xếp hạng.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <span className="inline-flex items-center gap-1 rounded-pill px-3 py-1 bg-[#FAF6EF] group-hover:bg-[#E5484D] text-[#1A1714] group-hover:text-white border-2 border-[#1A1714] text-xs font-semibold transition-all">
              <span>Vào cửa hàng</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </span>
          </div>
        </Link>
      </section>
    </div>
  );
}

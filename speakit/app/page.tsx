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
    <div className="max-w-5xl mx-auto px-4 py-4 md:py-7 lg:py-9 space-y-4 md:space-y-8">
      <HomeIntroHero scenarioCount={scenarioCount} />

      <section
        aria-label="Top 3 Arena Leaders"
        className="liquid-glass-card p-4 md:p-5 space-y-3 md:space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <div className="space-y-0.5">
              <p className="md:hidden text-[10px] uppercase tracking-[0.06em] text-cyan-300 font-mono">
                Arena Live Standings
              </p>
              <h2 className="text-base font-bold text-white">Top 3 Bảng Xếp Hạng Arena</h2>
            </div>
          </div>
          <Link
            href="/leaderboard"
            prefetch
            className="liquid-glass-btn inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all"
          >
            <span>Xem bảng xếp hạng</span>
            <ArrowRight className="w-3.5 h-3.5 text-cyan-300" aria-hidden="true" />
          </Link>
        </div>

        {topLeaders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 md:gap-3 border-t border-white/10 pt-3">
            {topLeaders.map((player) => (
              <LeaderboardRowWrapper
                key={player.id}
                fxId={player.equippedCosmetics?.leaderboard_fx}
                nameplateId={player.equippedCosmetics?.nameplate}
                className="liquid-glass-card-lite rounded-2xl transition-all hover:!border-cyan-400/45"
              >
                <Link
                  href={`/profile/${player.id}`}
                  className="group p-3.5 flex items-center justify-between gap-3"
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
                      <div className="text-sm font-bold text-white break-words group-hover:text-cyan-200 transition-colors">
                        {player.displayName}
                      </div>
                      <span className="inline-block text-[11px] font-mono px-2 py-0.5 rounded-full bg-white/[0.08] border border-white/15 text-slate-300">
                        {player.equippedTitle}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 space-y-1">
                    <div className="inline-flex items-center gap-1 text-xs font-mono font-bold text-white">
                      <Coins className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
                      <span>{player.itCoins}</span>
                    </div>
                    <div className="flex items-center justify-end gap-1 text-[11px] font-mono text-slate-300">
                      <Flame className="w-3 h-3 text-amber-400 shrink-0" aria-hidden="true" />
                      <span>{player.streakDays}d</span>
                    </div>
                  </div>
                </Link>
              </LeaderboardRowWrapper>
            ))}
          </div>
        ) : (
          <div className="border-t border-white/10 pt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
            <span>
              Chưa có dữ liệu bảng xếp hạng trực tuyến. Hoàn thành một vòng Arena để ghi danh #1.
            </span>
            <Link
              href="/arena"
              className="liquid-btn-primary inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-mono text-xs transition-all"
            >
              <span>Mở /arena</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
        )}
      </section>

      <section aria-label="Công cụ ôn tập nhanh" className="hidden md:grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          href="/scenarios"
          className="group liquid-glass-card-lite p-5 hover:!border-cyan-400/50 hover:-translate-y-0.5 transition-all flex flex-col justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-full bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center shrink-0">
              <MessageSquare className="w-4 h-4 text-cyan-300" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-white group-hover:text-cyan-200 transition-colors">
                Kịch bản luyện nói
              </h3>
              <p className="text-xs text-slate-300">
                {scenarioCount} tình huống công việc CNTT chia theo 3 cấp độ Fresher / Junior / Senior.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 bg-cyan-500/15 group-hover:bg-cyan-500/30 text-cyan-200 group-hover:text-white border border-cyan-400/40 text-xs font-semibold transition-colors">
              <span>Luyện kịch bản</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </span>
          </div>
        </Link>

        <Link
          href="/vocabulary"
          className="group liquid-glass-card-lite p-5 hover:!border-violet-400/50 hover:-translate-y-0.5 transition-all flex flex-col justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-full bg-violet-500/20 border border-violet-400/40 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-violet-300" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-white group-hover:text-violet-200 transition-colors">
                Từ vựng IT
              </h3>
              <p className="text-xs text-slate-300">
                Phát âm IPA và câu ví dụ công việc thực tế.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 bg-violet-500/15 group-hover:bg-violet-500/30 text-violet-200 group-hover:text-white border border-violet-400/40 text-xs font-semibold transition-colors">
              <span>Ôn từ vựng</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </span>
          </div>
        </Link>

        <Link
          href="/progress"
          className="group liquid-glass-card-lite p-5 hover:!border-emerald-400/50 hover:-translate-y-0.5 transition-all flex flex-col justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-emerald-300" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-white group-hover:text-emerald-200 transition-colors">
                Kế hoạch 7 ngày
              </h3>
              <p className="text-xs text-slate-300">
                Tổng hợp từ khóa và lỗi ngữ pháp cần ôn.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 bg-emerald-500/15 group-hover:bg-emerald-500/30 text-emerald-200 group-hover:text-white border border-emerald-400/40 text-xs font-semibold transition-colors">
              <span>Xem lộ trình</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </span>
          </div>
        </Link>

        <Link
          href="/arena"
          className="group liquid-glass-card-lite p-5 hover:!border-amber-400/50 hover:-translate-y-0.5 transition-all flex flex-col justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
              <Gamepad2 className="w-4 h-4 text-amber-300" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-white group-hover:text-amber-200 transition-colors">
                IT Speaking Arena
              </h3>
              <p className="text-xs text-slate-300">
                Thử thách tốc độ 60s để kiếm IT-Coin.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 bg-amber-500/15 group-hover:bg-amber-500/30 text-amber-200 group-hover:text-white border border-amber-400/40 text-xs font-semibold transition-colors">
              <span>Vào đấu trường</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </span>
          </div>
        </Link>

        <Link
          href="/arena/party"
          className="group liquid-glass-card-lite !border-rose-400/35 hover:!border-rose-400/65 p-5 hover:-translate-y-0.5 transition-all flex flex-col justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-full bg-rose-500/25 text-rose-300 flex items-center justify-center border border-rose-400/50 shrink-0">
              <Siren className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-white group-hover:text-rose-200 transition-colors">
                Outage At 3AM (Party Mode)
              </h3>
              <p className="text-xs text-slate-300">
                Phối hợp nhóm xử lý sự cố production khẩn cấp theo thời gian thực.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <span className="liquid-btn-danger inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs transition-all">
              <span>Mở Party Mode</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </span>
          </div>
        </Link>

        <Link
          href="/shop"
          className="group liquid-glass-card-lite p-5 hover:!border-fuchsia-400/50 hover:-translate-y-0.5 transition-all flex flex-col justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-full bg-fuchsia-500/20 text-fuchsia-300 flex items-center justify-center border border-fuchsia-400/40 shrink-0">
              <ShoppingBag className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-white group-hover:text-fuchsia-200 transition-colors">
                Cửa hàng Hiệu ứng
              </h3>
              <p className="text-xs text-slate-300">
                Đổi IT-Coin lấy khung avatar, nameplate và hiệu ứng bảng xếp hạng.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 bg-fuchsia-500/15 group-hover:bg-fuchsia-500/30 text-fuchsia-200 group-hover:text-white border border-fuchsia-400/40 text-xs font-semibold transition-colors">
              <span>Vào cửa hàng</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </span>
          </div>
        </Link>
      </section>
    </div>
  );
}

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
        className="space-y-3 md:space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />
            <div className="space-y-0.5">
              <p className="md:hidden text-[10px] uppercase tracking-[0.06em] text-sky-600 font-mono font-bold">
                Arena Live Standings
              </p>
              <h2 className="text-base font-bold text-slate-900">Top 3 Bảng Xếp Hạng Arena</h2>
            </div>
          </div>
          <Link
            href="/leaderboard"
            prefetch
            className="liquid-glass-btn inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors"
          >
            <span>Xem bảng xếp hạng</span>
            <ArrowRight className="w-3.5 h-3.5 text-sky-600" aria-hidden="true" />
          </Link>
        </div>

        {topLeaders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 md:gap-3">
            {topLeaders.map((player) => (
              <LeaderboardRowWrapper
                key={player.id}
                fxId={player.equippedCosmetics?.leaderboard_fx}
                nameplateId={player.equippedCosmetics?.nameplate}
                className="liquid-glass-card-lite rounded-2xl transition-colors hover:!border-sky-400/70"
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
                      <div className="text-sm font-bold text-slate-900 break-words group-hover:text-sky-600 transition-colors">
                        {player.displayName}
                      </div>
                      <span className="inline-block text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100/80 border border-slate-200/85 text-slate-600">
                        {player.equippedTitle}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 space-y-1">
                    <div className="inline-flex items-center gap-1 text-xs font-mono font-bold text-slate-900">
                      <Coins className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-hidden="true" />
                      <span>{player.itCoins}</span>
                    </div>
                    <div className="flex items-center justify-end gap-1 text-[11px] font-mono text-slate-600">
                      <Flame className="w-3 h-3 text-amber-500 shrink-0" aria-hidden="true" />
                      <span>{player.streakDays}d</span>
                    </div>
                  </div>
                </Link>
              </LeaderboardRowWrapper>
            ))}
          </div>
        ) : (
          <div className="border-t border-slate-200/85 pt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span>
              Chưa có dữ liệu bảng xếp hạng trực tuyến. Hoàn thành một vòng Arena để ghi danh #1.
            </span>
            <Link
              href="/arena"
              className="liquid-btn-primary inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-mono text-xs transition-colors"
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
          className="group liquid-glass-card-lite p-5 hover:!border-cyan-400/70 transition-colors flex flex-col justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-full bg-cyan-100/80 border border-cyan-300/70 flex items-center justify-center shrink-0">
              <MessageSquare className="w-4 h-4 text-cyan-600" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-slate-900 group-hover:text-cyan-700 transition-colors">
                Kịch bản luyện nói
              </h3>
              <p className="text-sm text-slate-600">
                {scenarioCount} tình huống công việc CNTT chia theo 3 cấp độ Fresher / Junior / Senior.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <span className="inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white border border-white/40 shadow-sm group-hover:brightness-110 text-xs font-bold transition-colors">
              <span>Luyện kịch bản</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </span>
          </div>
        </Link>

        <Link
          href="/vocabulary"
          className="group liquid-glass-card-lite p-5 hover:!border-teal-400/70 transition-colors flex flex-col justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-full bg-emerald-100/80 border border-emerald-300/70 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-emerald-600" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">
                Từ vựng IT
              </h3>
              <p className="text-sm text-slate-600">
                Phát âm IPA và câu ví dụ công việc thực tế.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <span className="inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white border border-white/40 shadow-sm group-hover:brightness-110 text-xs font-bold transition-colors">
              <span>Ôn từ vựng</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </span>
          </div>
        </Link>

        <Link
          href="/progress"
          className="group liquid-glass-card-lite p-5 hover:!border-emerald-400/70 transition-colors flex flex-col justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-full bg-emerald-100/80 border border-emerald-300/70 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-emerald-600" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">
                Kế hoạch 7 ngày
              </h3>
              <p className="text-sm text-slate-600">
                Tổng hợp từ khóa và lỗi ngữ pháp cần ôn.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <span className="inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white border border-white/40 shadow-sm group-hover:brightness-110 text-xs font-bold transition-colors">
              <span>Xem lộ trình</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </span>
          </div>
        </Link>

        <Link
          href="/arena"
          className="group liquid-glass-card-lite p-5 hover:!border-amber-400/70 transition-colors flex flex-col justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-full bg-amber-100/80 border border-amber-300/70 flex items-center justify-center shrink-0">
              <Gamepad2 className="w-4 h-4 text-amber-600" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-slate-900 group-hover:text-amber-700 transition-colors">
                IT Speaking Arena
              </h3>
              <p className="text-sm text-slate-600">
                Thử thách tốc độ 60s để kiếm IT-Coin.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <span className="inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white border border-white/40 shadow-sm group-hover:brightness-110 text-xs font-bold transition-colors">
              <span>Vào đấu trường</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </span>
          </div>
        </Link>

        <Link
          href="/arena/party"
          className="group liquid-glass-card-lite p-5 hover:!border-rose-400/70 transition-colors flex flex-col justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-full bg-rose-100/80 text-rose-600 flex items-center justify-center border border-rose-300/70 shrink-0">
              <Siren className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-slate-900 group-hover:text-rose-700 transition-colors">
                Outage At 3AM (Party Mode)
              </h3>
              <p className="text-sm text-slate-600">
                Phối hợp nhóm xử lý sự cố production khẩn cấp theo thời gian thực.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <span className="liquid-btn-danger inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs transition-colors">
              <span>Mở Party Mode</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </span>
          </div>
        </Link>

        <Link
          href="/shop"
          className="group liquid-glass-card-lite p-5 hover:!border-sky-400/70 transition-colors flex flex-col justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-full bg-sky-100/80 text-sky-600 flex items-center justify-center border border-sky-300/70 shrink-0">
              <ShoppingBag className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-slate-900 group-hover:text-sky-700 transition-colors">
                Cửa hàng Hiệu ứng
              </h3>
              <p className="text-sm text-slate-600">
                Đổi IT-Coin lấy khung avatar, nameplate và hiệu ứng bảng xếp hạng.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <span className="inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 bg-gradient-to-r from-sky-500 to-cyan-600 text-white border border-white/40 shadow-sm group-hover:brightness-110 text-xs font-bold transition-colors">
              <span>Vào cửa hàng</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </span>
          </div>
        </Link>
      </section>
    </div>
  );
}

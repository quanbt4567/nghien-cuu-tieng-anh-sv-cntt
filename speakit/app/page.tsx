import Link from "next/link";
import { BookOpen, Clock, Coins, Flame, Gamepad2, MessageSquare, ShoppingBag, Siren, Trophy } from "lucide-react";
import { DiscordAvatarFrame } from "../components/cosmetics/DiscordAvatarFrame";
import { LeaderboardRowWrapper } from "../components/cosmetics/LeaderboardRowWrapper";
import { PlayerAvatar } from "../components/cosmetics/PlayerAvatar";
import { DuolingoQuestPath } from "../components/home/DuolingoQuestPath";
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
    <div className="max-w-5xl mx-auto px-4 py-4 md:py-7 lg:py-9 space-y-5 md:space-y-8">
      <DuolingoQuestPath />
      <HomeIntroHero scenarioCount={scenarioCount} />

      <section
        aria-label="Top 3 Arena Leaders"
        className="space-y-3 md:space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-50 text-balance">
              Top 3 Bảng Xếp Hạng Arena
            </h2>
          </div>
          <Link
            href="/leaderboard"
            prefetch
            className="liquid-glass-btn inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 hover:!border-blue-700 hover:text-blue-700 dark:hover:!border-blue-500 dark:hover:text-blue-400 focus-visible:ring-2 focus-visible:ring-blue-600 text-sm font-semibold transition-colors"
          >
            <span>Xem bảng xếp hạng</span>
          </Link>
        </div>

        {topLeaders.length > 0 ? (
          <div className="liquid-glass-card overflow-hidden grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200/80 dark:divide-white/10">
            {topLeaders.map((player) => (
              <LeaderboardRowWrapper
                key={player.id}
                fxId={player.equippedCosmetics?.leaderboard_fx}
                nameplateId={player.equippedCosmetics?.nameplate}
                className="!rounded-none !border-0 !shadow-none !bg-transparent transition-colors hover:bg-slate-100/60 dark:hover:bg-white/5"
              >
                <Link
                  href={`/profile/${player.id}`}
                  className="group p-4 flex items-center justify-between gap-3 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
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
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-50 break-words group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                        {player.displayName}
                      </div>
                      <span className="inline-block text-xs font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                        {player.equippedTitle}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 space-y-1 tabular-nums">
                    <div className="inline-flex items-center gap-1 text-sm font-mono font-bold text-slate-900 dark:text-slate-50">
                      <Coins className="w-3.5 h-3.5 text-green-700 dark:text-green-400 shrink-0" aria-hidden="true" />
                      <span>{player.itCoins}</span>
                    </div>
                    <div className="flex items-center justify-end gap-1 text-xs font-mono text-slate-600 dark:text-slate-400">
                      <Flame className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
                      <span>{player.streakDays}d</span>
                    </div>
                  </div>
                </Link>
              </LeaderboardRowWrapper>
            ))}
          </div>
        ) : (
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600 dark:text-slate-300">
            <span>
              Chưa có dữ liệu bảng xếp hạng trực tuyến. Hoàn thành một vòng Arena để ghi danh #1.
            </span>
            <Link
              href="/arena"
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 text-white text-xs font-semibold transition-colors"
            >
              <span>Vào đấu trường Arena</span>
            </Link>
          </div>
        )}
      </section>

      <section aria-label="Công cụ ôn tập nhanh" className="hidden md:block space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-50 text-balance">
          Công cụ luyện nói &amp; ôn tập
        </h2>

        <div className="grid md:grid-cols-2 gap-4">
          <Link
            href="/scenarios"
            className="group liquid-glass-card p-5 hover:!border-blue-700 dark:hover:!border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-600 transition-colors flex flex-col justify-between gap-4"
          >
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-400/35 flex items-center justify-center shrink-0">
                <MessageSquare className="w-4 h-4 text-blue-700 dark:text-blue-300" aria-hidden="true" />
              </div>
              <div className="min-w-0 space-y-1">
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-50 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors text-balance">
                  Kịch bản luyện nói
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {scenarioCount} tình huống công việc CNTT chia theo 3 cấp độ Fresher, Junior và Senior.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <span className="inline-flex items-center rounded-lg px-3.5 py-1.5 bg-blue-700 group-hover:bg-blue-800 dark:bg-blue-600 dark:group-hover:bg-blue-700 text-white text-sm font-semibold transition-colors">
                Luyện kịch bản
              </span>
            </div>
          </Link>

          <Link
            href="/arena/party"
            className="group liquid-glass-card p-5 hover:!border-red-600 dark:hover:!border-red-400 focus-visible:ring-2 focus-visible:ring-red-600 transition-colors flex flex-col justify-between gap-4"
          >
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-300 flex items-center justify-center border border-red-200 dark:border-red-400/35 shrink-0">
                <Siren className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 space-y-1">
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-50 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors text-balance">
                  Outage At 3AM (Party Mode)
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Phối hợp nhóm xử lý sự cố production khẩn cấp theo thời gian thực.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <span className="inline-flex items-center rounded-lg px-3.5 py-1.5 bg-red-600 group-hover:bg-red-700 text-white text-sm font-semibold transition-colors">
                Mở Party Mode
              </span>
            </div>
          </Link>
        </div>

        <div className="liquid-glass-card-lite overflow-hidden grid sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80 dark:divide-white/10">
          <Link
            href="/vocabulary"
            className="group p-4 hover:bg-slate-100/60 dark:hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 transition-colors flex flex-col justify-between gap-3"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-400/35 flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
              </div>
              <div className="min-w-0 space-y-1">
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-50 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors text-balance">
                  Từ vựng IT
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Phát âm IPA và câu ví dụ công việc thực tế.
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
              Ôn từ vựng
            </span>
          </Link>

          <Link
            href="/progress"
            className="group p-4 hover:bg-slate-100/60 dark:hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 transition-colors flex flex-col justify-between gap-3"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-500/20 border border-sky-200 dark:border-sky-400/35 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-sky-700 dark:text-sky-300" aria-hidden="true" />
              </div>
              <div className="min-w-0 space-y-1">
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-50 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors text-balance">
                  Kế hoạch 7 ngày
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Tổng hợp từ khóa và lỗi ngữ pháp cần ôn.
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
              Xem lộ trình
            </span>
          </Link>

          <Link
            href="/arena"
            className="group p-4 hover:bg-slate-100/60 dark:hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 transition-colors flex flex-col justify-between gap-3"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-400/35 flex items-center justify-center shrink-0">
                <Gamepad2 className="w-4 h-4 text-amber-700 dark:text-amber-300" aria-hidden="true" />
              </div>
              <div className="min-w-0 space-y-1">
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-50 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors text-balance">
                  IT Speaking Arena
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Thử thách tốc độ 60s để kiếm IT-Coin.
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
              Vào đấu trường
            </span>
          </Link>

          <Link
            href="/shop"
            className="group p-4 hover:bg-slate-100/60 dark:hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 transition-colors flex flex-col justify-between gap-3"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-500/20 border border-violet-200 dark:border-violet-400/35 text-violet-700 dark:text-violet-300 flex items-center justify-center shrink-0">
                <ShoppingBag className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 space-y-1">
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-50 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors text-balance">
                  Cửa hàng Hiệu ứng
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Đổi IT-Coin lấy khung avatar và nameplate.
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
              Vào cửa hàng
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}

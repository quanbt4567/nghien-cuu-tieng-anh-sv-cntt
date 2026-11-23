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
            <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
            <div className="space-y-0.5">
              <p className="md:hidden text-xs uppercase tracking-wider text-blue-700 dark:text-blue-400 font-mono font-bold">
                Arena Live Standings
              </p>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
                Top 3 Báº£ng Xáº¿p Háº¡ng Arena
              </h2>
            </div>
          </div>
          <Link
            href="/leaderboard"
            prefetch
            className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 hover:border-blue-700 hover:text-blue-700 dark:hover:border-blue-500 dark:hover:text-blue-400 text-sm font-semibold transition-colors"
          >
            <span>Xem báº£ng xáº¿p háº¡ng</span>
            <ArrowRight className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" aria-hidden="true" />
          </Link>
        </div>

        {topLeaders.length > 0 ? (
          <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
            {topLeaders.map((player) => (
              <LeaderboardRowWrapper
                key={player.id}
                fxId={player.equippedCosmetics?.leaderboard_fx}
                nameplateId={player.equippedCosmetics?.nameplate}
                className="!rounded-none !border-0 !shadow-none !bg-transparent transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <Link
                  href={`/profile/${player.id}`}
                  className="group p-4 flex items-center justify-between gap-3"
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

                  <div className="text-right shrink-0 space-y-1">
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
              ChÆ°a cÃ³ dá»¯ liá»‡u báº£ng xáº¿p háº¡ng trá»±c tuyáº¿n. HoÃ n thÃ nh má»™t vÃ²ng Arena Ä‘á»ƒ ghi danh #1.
            </span>
            <Link
              href="/arena"
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-mono text-xs font-semibold transition-colors"
            >
              <span>Má»Ÿ /arena</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
        )}
      </section>

      <section aria-label="CÃ´ng cá»¥ Ã´n táº­p nhanh" className="hidden md:grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          href="/scenarios"
          className="group bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-blue-700 dark:hover:border-blue-500 transition-colors flex flex-col justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
              <MessageSquare className="w-4 h-4 text-blue-700 dark:text-blue-400" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-50 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                Ká»‹ch báº£n luyá»‡n nÃ³i
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {scenarioCount} tÃ¬nh huá»‘ng cÃ´ng viá»‡c CNTT chia theo 3 cáº¥p Ä‘á»™ Fresher / Junior / Senior.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <span className="inline-flex items-center rounded-lg px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 group-hover:bg-blue-700 group-hover:text-white group-hover:border-blue-700 dark:group-hover:bg-blue-600 dark:group-hover:border-blue-600 text-sm font-semibold transition-colors">
              Luyá»‡n ká»‹ch báº£n
            </span>
          </div>
        </Link>

        <Link
          href="/vocabulary"
          className="group bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-blue-700 dark:hover:border-blue-500 transition-colors flex flex-col justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-slate-700 dark:text-slate-200" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-50 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                Tá»« vá»±ng IT
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                PhÃ¡t Ã¢m IPA vÃ  cÃ¢u vÃ­ dá»¥ cÃ´ng viá»‡c thá»±c táº¿.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <span className="inline-flex items-center rounded-lg px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 group-hover:bg-blue-700 group-hover:text-white group-hover:border-blue-700 dark:group-hover:bg-blue-600 dark:group-hover:border-blue-600 text-sm font-semibold transition-colors">
              Ã”n tá»« vá»±ng
            </span>
          </div>
        </Link>

        <Link
          href="/progress"
          className="group bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-blue-700 dark:hover:border-blue-500 transition-colors flex flex-col justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-slate-700 dark:text-slate-200" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-50 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                Káº¿ hoáº¡ch 7 ngÃ y
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Tá»•ng há»£p tá»« khÃ³a vÃ  lá»—i ngá»¯ phÃ¡p cáº§n Ã´n.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <span className="inline-flex items-center rounded-lg px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 group-hover:bg-blue-700 group-hover:text-white group-hover:border-blue-700 dark:group-hover:bg-blue-600 dark:group-hover:border-blue-600 text-sm font-semibold transition-colors">
              Xem lá»™ trÃ¬nh
            </span>
          </div>
        </Link>

        <Link
          href="/arena"
          className="group bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-blue-700 dark:hover:border-blue-500 transition-colors flex flex-col justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
              <Gamepad2 className="w-4 h-4 text-slate-700 dark:text-slate-200" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-50 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                IT Speaking Arena
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Thá»­ thÃ¡ch tá»‘c Ä‘á»™ 60s Ä‘á»ƒ kiáº¿m IT-Coin.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <span className="inline-flex items-center rounded-lg px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 group-hover:bg-blue-700 group-hover:text-white group-hover:border-blue-700 dark:group-hover:bg-blue-600 dark:group-hover:border-blue-600 text-sm font-semibold transition-colors">
              VÃ o Ä‘áº¥u trÆ°á»ng
            </span>
          </div>
        </Link>

        <Link
          href="/arena/party"
          className="group bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-red-600 dark:hover:border-red-500 transition-colors flex flex-col justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center border border-red-200 dark:border-red-800 shrink-0">
              <Siren className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-50 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                Outage At 3AM (Party Mode)
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Phá»‘i há»£p nhÃ³m xá»­ lÃ½ sá»± cá»‘ production kháº©n cáº¥p theo thá»i gian thá»±c.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <span className="inline-flex items-center rounded-lg px-3.5 py-1.5 bg-red-600 group-hover:bg-red-700 text-white text-sm font-semibold transition-colors">
              Má»Ÿ Party Mode
            </span>
          </div>
        </Link>

        <Link
          href="/shop"
          className="group bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-blue-700 dark:hover:border-blue-500 transition-colors flex flex-col justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-50 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                Cá»­a hÃ ng Hiá»‡u á»©ng
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Äá»•i IT-Coin láº¥y khung avatar, nameplate vÃ  hiá»‡u á»©ng báº£ng xáº¿p háº¡ng.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <span className="inline-flex items-center rounded-lg px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 group-hover:bg-blue-700 group-hover:text-white group-hover:border-blue-700 dark:group-hover:bg-blue-600 dark:group-hover:border-blue-600 text-sm font-semibold transition-colors">
              VÃ o cá»­a hÃ ng
            </span>
          </div>
        </Link>
      </section>
    </div>
  );
}

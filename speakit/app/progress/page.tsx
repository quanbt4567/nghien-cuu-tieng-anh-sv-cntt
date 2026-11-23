"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Coins,
  Download,
  Flame,
  Gamepad2,
  History,
  TrendingUp,
} from "lucide-react";
import {
  getPlayerArenaRuns,
  initOrHydrateGuestSession,
} from "../actions/leaderboard";
import { SCENARIOS } from "../../data/scenarios";
import type { PublicGuestPlayer } from "../../lib/db";
import {
  GUEST_PROFILE_UPDATED_EVENT,
  readBackupTransferCode,
  readCachedGuestProfile,
  saveBackupTransferCode,
} from "../../lib/guestClient";
import {
  buildUnifiedActivityHistory,
  getArenaGameLabel,
  mergeArenaRuns,
  mergeProfileIdentity,
} from "../../lib/profileStats";
import { storageAdapter } from "../../lib/storage";
import {
  ArenaRunRecord,
  GamificationState,
  PracticeAttempt,
  Scenario,
  WeakPoint,
} from "../../lib/types";
import { generate7DayPlan, isValidKeywordTerm, PlanDay } from "../../lib/planGenerator";
import {
  GAMIFICATION_STORAGE_KEY,
  GAMIFICATION_UPDATED_EVENT,
  getDevTitle,
  getGamificationState,
} from "../../lib/gamification";
import {
  CONTENT_STORAGE_KEY,
  CONTENT_UPDATED_EVENT,
  fetchAndCachePublicContent,
  getEffectiveScenarios,
} from "../../lib/contentStore";
import { SevenDayPlan } from "../../components/progress/SevenDayPlan";

const INITIAL_GAMIFICATION: GamificationState = {
  totalPoints: 0,
  streakDays: 0,
  lastPracticeDate: null,
  selectedRole: "frontend",
  personalBests: { "bug-buster": 0, "standup-speed-run": 0 },
  history: [],
};

export default function ProgressPage() {
  const [attempts, setAttempts] = useState<PracticeAttempt[]>([]);
  const [weakPoints, setWeakPoints] = useState<WeakPoint[]>([]);
  const [planDays, setPlanDays] = useState<PlanDay[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>(SCENARIOS);
  const [gamification, setGamification] =
    useState<GamificationState>(INITIAL_GAMIFICATION);
  const [serverArenaRuns, setServerArenaRuns] = useState<ArenaRunRecord[]>([]);
  const [guestPlayer, setGuestPlayer] = useState<PublicGuestPlayer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const syncGamification = () => setGamification(getGamificationState());
    const syncContent = () => setScenarios(getEffectiveScenarios());
    const syncGuestProfile = (event?: Event) => {
      if (event instanceof CustomEvent && event.detail !== undefined) {
        setGuestPlayer(event.detail as PublicGuestPlayer | null);
        return;
      }
      const cached = readCachedGuestProfile();
      if (cached) setGuestPlayer(cached);
    };

    async function loadData() {
      setIsLoading(true);
      try {
        const transferCode = readBackupTransferCode();
        const [allAttempts, allWeakPoints, sessionRes, arenaRes] = await Promise.all([
          storageAdapter.getAttempts(),
          storageAdapter.getWeakPoints(),
          initOrHydrateGuestSession(transferCode).catch(() => ({
            mode: "offline" as const,
            player: null,
          })),
          getPlayerArenaRuns(transferCode).catch(() => ({
            mode: "offline" as const,
            runs: [] as ArenaRunRecord[],
          })),
        ]);

        setAttempts(allAttempts);
        setWeakPoints(allWeakPoints);
        setServerArenaRuns(arenaRes.runs);
        if (sessionRes.mode === "online" && sessionRes.player) {
          saveBackupTransferCode(sessionRes.player.transferCode);
          setGuestPlayer(sessionRes.player);
        }
        setPlanDays(generate7DayPlan(allWeakPoints, allAttempts));
        syncGamification();
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
    syncContent();
    syncGuestProfile();
    void fetchAndCachePublicContent();

    window.addEventListener(GAMIFICATION_UPDATED_EVENT, syncGamification);
    window.addEventListener(GUEST_PROFILE_UPDATED_EVENT, syncGuestProfile);
    window.addEventListener(CONTENT_UPDATED_EVENT, syncContent);
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === GAMIFICATION_STORAGE_KEY) {
        syncGamification();
      }
      if (!event.key || event.key === CONTENT_STORAGE_KEY) {
        syncContent();
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(GAMIFICATION_UPDATED_EVENT, syncGamification);
      window.removeEventListener(GUEST_PROFILE_UPDATED_EVENT, syncGuestProfile);
      window.removeEventListener(CONTENT_UPDATED_EVENT, syncContent);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const identity = mergeProfileIdentity(guestPlayer, gamification);
  const arenaRuns = mergeArenaRuns(gamification.history, serverArenaRuns);
  const bugBusterRuns = arenaRuns.filter((r) => r.gameId === "bug-buster");
  const standupRuns = arenaRuns.filter((r) => r.gameId === "standup-speed-run");
  const bugBusterBest = Math.max(
    gamification.personalBests["bug-buster"] ?? 0,
    ...bugBusterRuns.map((r) => r.score),
    0
  );
  const standupBest = Math.max(
    gamification.personalBests["standup-speed-run"] ?? 0,
    ...standupRuns.map((r) => r.score),
    0
  );
  const avgBugAccuracy =
    bugBusterRuns.length > 0
      ? Math.round(
          bugBusterRuns.reduce((sum, r) => sum + r.accuracyOrWords, 0) /
            bugBusterRuns.length
        )
      : 0;
  const totalStandupKeywords = standupRuns.reduce(
    (sum, r) => sum + r.accuracyOrWords,
    0
  );

  const totalTurns = attempts.length;
  const totalSessions = totalTurns + arenaRuns.length;
  const isArenaOnly = totalTurns === 0 && arenaRuns.length > 0;
  const bestScoreOverall =
    attempts.length > 0 ? Math.max(...attempts.map((a) => a.score)) : 0;
  const bestArenaScore = Math.max(bugBusterBest, standupBest);
  const averageScore =
    attempts.length > 0
      ? Math.round(attempts.reduce((acc, a) => acc + a.score, 0) / attempts.length)
      : 0;

  const uniqueDates = new Set([
    ...attempts.map((a) => a.created_at.slice(0, 10)),
    ...arenaRuns.map((r) => r.createdAt.slice(0, 10)),
  ]);
  const currentStreak = Math.max(uniqueDates.size, identity.streakDays);

  const devTitle = getDevTitle(identity.totalPoints);
  const coins = identity.itCoins;
  const keywordWeakPoints = weakPoints.filter(
    (wp) => wp.kind === "keyword" && isValidKeywordTerm(wp.value)
  );

  const scenarioTitleMap = new Map(scenarios.map((s) => [s.id, s.titleVI]));
  const unifiedHistory = buildUnifiedActivityHistory(
    attempts,
    arenaRuns,
    scenarioTitleMap
  );
  const scenarioStats = scenarios.map((scenario) => {
    const scenarioAttempts = attempts.filter((a) => a.scenario === scenario.id);
    const best =
      scenarioAttempts.length > 0
        ? Math.max(...scenarioAttempts.map((a) => a.score))
        : 0;
    return {
      id: scenario.id,
      titleVI: scenario.titleVI,
      turnCount: scenarioAttempts.length,
      bestScore: best,
    };
  });

  const handleExportData = () => {
    const data = {
      project: "SpeakIT - Nghien cuu Tieng Anh SV CNTT (IUH & BCN)",
      exportDate: new Date().toISOString(),
      studentSummary: {
        totalTurns,
        totalArenaRuns: arenaRuns.length,
        totalPoints: identity.totalPoints,
        averageScore,
        bestScoreOverall,
        bugBusterBest,
        standupBest,
        avgBugAccuracy,
        streakDays: currentStreak,
      },
      scenarioStats,
      arenaRuns,
      weakPoints,
      attempts,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `speakit_research_data_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-pulse">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-3">
            <div className="h-7 w-28 rounded-lg bg-slate-200 dark:bg-slate-800" />
            <div className="h-8 w-72 rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-96 max-w-full rounded-lg bg-slate-200 dark:bg-slate-800" />
          </div>
          <div className="h-9 w-36 rounded-lg bg-slate-200 dark:bg-slate-800" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-5">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#262626] rounded-xl p-4 sm:p-5 space-y-2"
            >
              <div className="h-8 w-16 mx-auto rounded-lg bg-slate-200 dark:bg-slate-800" />
              <div className="h-3 w-24 mx-auto rounded bg-slate-200 dark:bg-slate-800" />
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#262626] rounded-xl p-6 space-y-4">
          <div className="h-5 w-48 rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[0, 1, 2].map((idx) => (
              <div key={idx} className="h-24 rounded-lg bg-slate-200 dark:bg-slate-800" />
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#262626] rounded-xl p-6 space-y-4">
          <div className="h-5 w-56 rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="h-32 rounded-lg bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Trang chá»§</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-700 dark:text-blue-400" />
            <span>Tiáº¿n Ä‘á»™ há»c &amp; káº¿ hoáº¡ch 7 ngÃ y</span>
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1.5">
            Xem báº¡n Ä‘Ã£ luyá»‡n nÃ³i bao nhiÃªu láº§n, Ä‘iá»ƒm cao nháº¥t cá»§a tá»«ng tÃ¬nh huá»‘ng vÃ  nhá»¯ng tá»« cáº§n Ã´n thÃªm.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportData}
          disabled={attempts.length === 0 && arenaRuns.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-mono font-semibold transition-colors self-start sm:self-center disabled:opacity-50 disabled:cursor-not-allowed"
          title="Táº£i vá» file (.json) chá»©a toÃ n bá»™ lÆ°á»£t luyá»‡n táº­p cá»§a báº¡n"
        >
          <Download className="w-4 h-4 text-blue-700 dark:text-blue-400" />
          <span>Táº£i dá»¯ liá»‡u vá» (.json)</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-5">
        <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#262626] rounded-xl p-4 sm:p-5 text-center">
          <div className="text-2xl sm:text-3xl font-mono font-extrabold text-slate-900 dark:text-slate-50">
            {totalSessions}
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Tá»•ng lÆ°á»£t Ä‘Ã£ luyá»‡n
            {arenaRuns.length > 0 && (
              <span className="block text-xs font-mono text-slate-600 dark:text-slate-400 mt-0.5">
                ({totalTurns} há»™i thoáº¡i Â· {arenaRuns.length} Arena)
              </span>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#262626] rounded-xl p-4 sm:p-5 text-center">
          <div className="text-2xl sm:text-3xl font-mono font-extrabold text-blue-700 dark:text-blue-400">
            {isArenaOnly ? bestArenaScore : bestScoreOverall}
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            {isArenaOnly ? "Äiá»ƒm Arena cao nháº¥t" : "Äiá»ƒm cao nháº¥t"}
          </div>
        </div>

        <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#262626] rounded-xl p-4 sm:p-5 text-center">
          <div className="text-2xl sm:text-3xl font-mono font-extrabold text-slate-900 dark:text-slate-50">
            {isArenaOnly
              ? bugBusterRuns.length > 0
                ? `${avgBugAccuracy}%`
                : `${totalStandupKeywords}`
              : averageScore}
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            {isArenaOnly
              ? bugBusterRuns.length > 0
                ? "Bug Buster: Ä‘Ãºng trung bÃ¬nh"
                : "Tá»« khÃ³a Standup"
              : "Äiá»ƒm trung bÃ¬nh"}
          </div>
        </div>

        <div
          className={`rounded-xl border p-4 sm:p-5 text-center ${
            currentStreak > 0
              ? "bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800"
              : "bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800"
          }`}
        >
          <div
            className={`text-2xl sm:text-3xl font-mono font-extrabold flex items-center justify-center gap-1 ${
              currentStreak > 0
                ? "text-green-700 dark:text-green-400"
                : "text-amber-700 dark:text-amber-400"
            }`}
          >
            <Flame
              className={`w-6 h-6 ${
                currentStreak > 0
                  ? "fill-green-600 text-green-700 dark:fill-green-500 dark:text-green-400"
                  : "fill-amber-500 text-amber-700 dark:text-amber-400"
              }`}
            />
            <span>{currentStreak}</span>
          </div>
          <div
            className={`text-sm font-bold mt-1 ${
              currentStreak > 0
                ? "text-green-800 dark:text-green-300"
                : "text-amber-800 dark:text-amber-300"
            }`}
          >
            NgÃ y luyá»‡n táº­p
          </div>
        </div>
      </div>

      <section className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#262626] rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#262626] pb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-50 uppercase tracking-wider font-mono flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-blue-700 dark:text-blue-400" />
            <span>ChÆ¡i trong IT Speaking Arena (Ä‘áº¥u trÆ°á»ng luyá»‡n nÃ³i)</span>
          </h2>
          <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
            {arenaRuns.length} lÆ°á»£t chÆ¡i
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-[#262626] border-b border-slate-200 dark:border-[#262626] pb-4">
          <div className="py-2 sm:py-0 sm:pr-4">
            <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
              Bug Buster cao nháº¥t
            </div>
            <div className="text-xl font-mono font-extrabold text-slate-900 dark:text-slate-50 mt-0.5">
              {bugBusterBest.toLocaleString("vi-VN")} Ä‘iá»ƒm
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
              {bugBusterRuns.length > 0
                ? `${bugBusterRuns.length} lÆ°á»£t Â· ${avgBugAccuracy}% Ä‘Ãºng trung bÃ¬nh`
                : "ChÆ°a cÃ³ lÆ°á»£t chÆ¡i"}
            </div>
          </div>
          <div className="py-3 sm:py-0 sm:px-4">
            <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
              Standup Speed Run cao nháº¥t
            </div>
            <div className="text-xl font-mono font-extrabold text-slate-900 dark:text-slate-50 mt-0.5">
              {standupBest.toLocaleString("vi-VN")} Ä‘iá»ƒm
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
              {standupRuns.length > 0
                ? `${standupRuns.length} lÆ°á»£t Â· ${totalStandupKeywords} tá»« khÃ³a`
                : "ChÆ°a cÃ³ lÆ°á»£t chÆ¡i"}
            </div>
          </div>
          <div className="pt-3 sm:pt-0 sm:pl-4">
            <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
              Tá»•ng Ä‘iá»ƒm Ä‘Ã£ cÃ³
            </div>
            <div className="text-xl font-mono font-extrabold text-blue-700 dark:text-blue-400 mt-0.5">
              {identity.totalPoints.toLocaleString("vi-VN")} Ä‘iá»ƒm
            </div>
            <div className="text-sm text-amber-700 dark:text-amber-400 font-semibold mt-0.5">
              {coins} IT-Coin Â· {devTitle.title}
            </div>
          </div>
        </div>

        {arenaRuns.length > 0 ? (
          <div className="space-y-2 pt-1">
            <div className="text-xs font-mono font-bold uppercase text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
              <span>Lá»‹ch sá»­ Arena gáº§n Ä‘Ã¢y</span>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-[#262626]">
              {arenaRuns.slice(0, 8).map((run) => (
                <div
                  key={run.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                      {getArenaGameLabel(run.gameId)}
                    </div>
                    <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
                      {run.gameId === "bug-buster"
                        ? `${run.accuracyOrWords}% Ä‘Ãºng`
                        : run.gameId === "standup-speed-run"
                          ? `${run.accuracyOrWords} tá»« khÃ³a`
                          : `${run.accuracyOrWords} Ä‘iá»ƒm máº¡nh`}
                      {run.durationSec > 0 ? ` Â· ${run.durationSec}s` : ""}
                      {" Â· "}
                      {new Date(run.createdAt).toLocaleDateString("vi-VN")}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-xs font-mono font-bold text-blue-800 dark:text-blue-300 shrink-0">
                    {run.score.toLocaleString("vi-VN")} Ä‘iá»ƒm
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Báº¡n chÆ°a cÃ³ lÆ°á»£t chÆ¡i Arena nÃ o. Thá»­ sá»©c táº¡i{" "}
            <Link
              href="/arena"
              className="text-blue-700 dark:text-blue-400 font-semibold hover:underline"
            >
              IT Speaking Arena
            </Link>
            !
          </p>
        )}
      </section>

      <section className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#262626] rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#262626] pb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-50 uppercase tracking-wider font-mono flex items-center gap-2">
            <History className="w-4 h-4 text-blue-700 dark:text-blue-400" />
            <span>Lá»‹ch sá»­ luyá»‡n táº­p vÃ  Ä‘iá»ƒm thÆ°á»Ÿng</span>
          </h2>
          <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
            {unifiedHistory.length} hoáº¡t Ä‘á»™ng
          </span>
        </div>

        {unifiedHistory.length > 0 ? (
          <div className="divide-y divide-slate-200 dark:divide-[#262626]">
            {unifiedHistory.slice(0, 15).map((item) => (
              <div
                key={item.id}
                className="py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                    {item.title}
                  </div>
                  <div className="text-xs font-mono text-slate-600 dark:text-slate-400 truncate">
                    {item.detail} Â· {new Date(item.createdAt).toLocaleDateString("vi-VN")}
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-xs font-mono font-bold text-blue-800 dark:text-blue-300 shrink-0">
                  {item.badgeText}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            ChÆ°a cÃ³ hoáº¡t Ä‘á»™ng nÃ o Ä‘Æ°á»£c ghi nháº­n. HoÃ n thÃ nh má»™t lÆ°á»£t luyá»‡n nÃ³i, Äá»‘ tá»« vá»±ng 60 giÃ¢y, NÃ³i theo cá»¥m tá»« hoáº·c tráº­n Arena Ä‘á»ƒ xem lá»‹ch sá»­ táº¡i Ä‘Ã¢y.
          </p>
        )}
      </section>

      <section className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#262626] rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#262626] pb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-50 uppercase tracking-wider font-mono flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-700 dark:text-blue-400" />
            <span>Äiá»ƒm cao nháº¥t tá»«ng tÃ¬nh huá»‘ng</span>
          </h2>
          <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
            Tá»‘i Ä‘a 100 Ä‘iá»ƒm
          </span>
        </div>

        <div className="space-y-3.5">
          {scenarioStats.map((st) => {
            const scaleValue =
              st.bestScore > 0 ? Math.max(0.05, Math.min(1, st.bestScore / 100)) : 0;
            return (
              <div key={st.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {st.titleVI}
                  </span>
                  <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
                    {st.bestScore > 0
                      ? `${st.bestScore} Ä‘iá»ƒm (${st.turnCount} lÆ°á»£t)`
                      : "ChÆ°a luyá»‡n"}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full w-full rounded-full origin-left transition-transform duration-300 ${
                      st.bestScore >= 80
                        ? "bg-green-700 dark:bg-green-500"
                        : st.bestScore > 0
                          ? "bg-blue-700 dark:bg-blue-500"
                          : "bg-transparent"
                    }`}
                    style={{ transform: `scaleX(${scaleValue})` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section
        aria-label="TÃ³m táº¯t IT Speaking Arena"
        className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#262626] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-xs font-mono font-semibold">
              <Award className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" aria-hidden="true" />
              <span>{devTitle.title}</span>
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs font-mono font-bold text-amber-800 dark:text-amber-300">
              <Coins className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" aria-hidden="true" />
              <span>{coins} IT-Coin</span>
              <span className="text-xs font-normal text-amber-700 dark:text-amber-400">
                (1000 Ä‘iá»ƒm = 1 Coin)
              </span>
            </span>

            <span
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-mono font-bold ${
                gamification.streakDays > 0
                  ? "bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300"
                  : "bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300"
              }`}
            >
              <Flame
                className={`w-3.5 h-3.5 ${
                  gamification.streakDays > 0
                    ? "fill-green-600 text-green-700 dark:text-green-400"
                    : "fill-blue-600 text-blue-700 dark:text-blue-400"
                }`}
                aria-hidden="true"
              />
              <span>{gamification.streakDays} ngÃ y</span>
            </span>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-300 font-mono">
            Tá»•ng {identity.totalPoints} Ä‘iá»ƒm tÃ­ch lÅ©y tá»« há»™i thoáº¡i vÃ  game Arena.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            href="/vocabulary"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-semibold transition-colors"
          >
            <BookOpen className="w-4 h-4 text-blue-700 dark:text-blue-400" aria-hidden="true" />
            <span>Tá»« vá»±ng IT</span>
          </Link>

          <Link
            href="/arena"
            className="bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            <Gamepad2 className="w-4 h-4" aria-hidden="true" />
            <span>VÃ o IT Arena</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section>
        <SevenDayPlan days={planDays} />
      </section>

      {keywordWeakPoints.length > 0 && (
        <section className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#262626] rounded-xl p-6 space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#262626] pb-2">
            <h3 className="text-sm font-bold font-mono uppercase text-slate-900 dark:text-slate-50 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span>Tá»« khÃ³a báº¡n hay quÃªn nháº¥t ({keywordWeakPoints.length})</span>
            </h3>
            <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
              Xáº¿p theo sá»‘ láº§n bá» sÃ³t
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {keywordWeakPoints.slice(0, 15).map((wp) => (
              <span
                key={wp.id}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs font-mono"
              >
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {wp.value}
                </span>
                <span className="text-red-700 dark:text-red-400 font-bold">
                  ({wp.miss_count} láº§n)
                </span>
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

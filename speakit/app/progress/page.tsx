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
            <div className="h-7 w-28 rounded-full bg-slate-200/80" />
            <div className="h-8 w-72 rounded-xl bg-slate-200/80" />
            <div className="h-4 w-96 max-w-full rounded-lg bg-slate-200/80" />
          </div>
          <div className="h-9 w-36 rounded-full bg-slate-200/80" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-5">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="liquid-glass-card-lite rounded-3xl p-4 sm:p-5 space-y-2"
            >
              <div className="h-8 w-16 mx-auto rounded-lg bg-slate-200/80" />
              <div className="h-3 w-24 mx-auto rounded bg-slate-200/80" />
            </div>
          ))}
        </div>

        <div className="liquid-glass-card-lite rounded-3xl p-6 space-y-4">
          <div className="h-5 w-48 rounded-lg bg-slate-200/80" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[0, 1, 2].map((idx) => (
              <div key={idx} className="h-24 rounded-xl bg-slate-200/80" />
            ))}
          </div>
        </div>

        <div className="liquid-glass-card-lite rounded-3xl p-6 space-y-4">
          <div className="h-5 w-56 rounded-lg bg-slate-200/80" />
          <div className="h-32 rounded-xl bg-slate-200/80" />
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
            className="liquid-glass-btn inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Trang chủ</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-sky-600" />
            <span>Tiến độ học & kế hoạch 7 ngày</span>
          </h1>
          <p className="text-xs text-slate-600 mt-1.5">
            Xem bạn đã luyện nói bao nhiêu lần, điểm cao nhất của từng tình huống và những từ cần ôn thêm.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportData}
          disabled={attempts.length === 0 && arenaRuns.length === 0}
          className="liquid-glass-btn inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono font-semibold transition-all self-start sm:self-center disabled:opacity-50 disabled:cursor-not-allowed"
          title="Tải về file (.json) chứa toàn bộ lượt luyện tập của bạn"
        >
          <Download className="w-4 h-4 text-sky-600" />
          <span>Tải dữ liệu về (.json)</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-5">
        <div className="liquid-glass-card p-4 sm:p-5 text-center">
          <div className="text-2xl sm:text-3xl font-mono font-extrabold text-slate-900">
            {totalSessions}
          </div>
          <div className="text-[11px] text-slate-600 mt-1">
            Tổng lượt đã luyện
            {arenaRuns.length > 0 && (
              <span className="block text-[10px] font-mono text-slate-600">
                ({totalTurns} hội thoại • {arenaRuns.length} Arena)
              </span>
            )}
          </div>
        </div>

        <div className="liquid-glass-card p-4 sm:p-5 text-center">
          <div className="text-2xl sm:text-3xl font-mono font-extrabold text-sky-700">
            {isArenaOnly ? bestArenaScore : bestScoreOverall}
          </div>
          <div className="text-[11px] text-slate-600 mt-1">
            {isArenaOnly ? "Điểm Arena cao nhất" : "Điểm cao nhất"}
          </div>
        </div>

        <div className="liquid-glass-card p-4 sm:p-5 text-center">
          <div className="text-2xl sm:text-3xl font-mono font-extrabold text-violet-700">
            {isArenaOnly
              ? bugBusterRuns.length > 0
                ? `${avgBugAccuracy}%`
                : `${totalStandupKeywords}`
              : averageScore}
          </div>
          <div className="text-[11px] text-slate-600 mt-1">
            {isArenaOnly
              ? bugBusterRuns.length > 0
                ? "Bug Buster: đúng trung bình"
                : "Từ khóa Standup"
              : "Điểm trung bình"}
          </div>
        </div>

        <div
          className={`liquid-glass-card p-4 sm:p-5 text-center ${
            currentStreak > 0
              ? "!bg-emerald-50/90 !border-emerald-300"
              : "!bg-amber-50/90 !border-amber-300"
          }`}
        >
          <div
            className={`text-2xl sm:text-3xl font-mono font-extrabold flex items-center justify-center gap-1 ${
              currentStreak > 0 ? "text-emerald-800" : "text-amber-800"
            }`}
          >
            <Flame
              className={`w-6 h-6 ${
                currentStreak > 0
                  ? "fill-emerald-500 text-emerald-600"
                  : "fill-amber-500 text-amber-600"
              }`}
            />
            <span>{currentStreak}</span>
          </div>
          <div
            className={`text-[11px] font-bold mt-1 ${
              currentStreak > 0 ? "text-emerald-800" : "text-amber-800"
            }`}
          >
            Ngày luyện tập
          </div>
        </div>
      </div>

      <section className="liquid-glass-card p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200/85 pb-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-sky-600" />
            <span>Chơi trong IT Speaking Arena (đấu trường luyện nói)</span>
          </h2>
          <span className="text-[11px] font-mono text-slate-600">
            {arenaRuns.length} lượt chơi
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-sky-50/80 border border-slate-200/85 rounded-2xl p-3.5">
            <div className="text-[11px] font-mono text-slate-600">Bug Buster cao nhất</div>
            <div className="text-xl font-mono font-extrabold text-slate-900 mt-0.5">
              {bugBusterBest.toLocaleString("vi-VN")} điểm
            </div>
            <div className="text-[11px] text-slate-700 mt-0.5">
              {bugBusterRuns.length > 0
                ? `${bugBusterRuns.length} lượt • ${avgBugAccuracy}% đúng trung bình`
                : "Chưa có lượt chơi"}
            </div>
          </div>
          <div className="bg-sky-50/80 border border-slate-200/85 rounded-2xl p-3.5">
            <div className="text-[11px] font-mono text-slate-600">Standup Speed Run cao nhất</div>
            <div className="text-xl font-mono font-extrabold text-slate-900 mt-0.5">
              {standupBest.toLocaleString("vi-VN")} điểm
            </div>
            <div className="text-[11px] text-slate-700 mt-0.5">
              {standupRuns.length > 0
                ? `${standupRuns.length} lượt • ${totalStandupKeywords} từ khóa`
                : "Chưa có lượt chơi"}
            </div>
          </div>
          <div className="bg-sky-50/80 border border-slate-200/85 rounded-2xl p-3.5">
            <div className="text-[11px] font-mono text-slate-600">Tổng điểm đã có</div>
            <div className="text-xl font-mono font-extrabold text-sky-700 mt-0.5">
              {identity.totalPoints.toLocaleString("vi-VN")} điểm
            </div>
            <div className="text-[11px] text-amber-800 font-semibold mt-0.5">
              {coins} IT-Coin • {devTitle.title}
            </div>
          </div>
        </div>

        {arenaRuns.length > 0 ? (
          <div className="space-y-2 pt-1">
            <div className="text-xs font-mono font-bold text-slate-700 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-sky-600" />
              <span>Lịch sử Arena gần đây</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {arenaRuns.slice(0, 8).map((run) => (
                <div
                  key={run.id}
                  className="bg-white/85 border border-slate-200/85 rounded-xl p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {getArenaGameLabel(run.gameId)}
                    </div>
                    <div className="text-[11px] font-mono text-slate-600">
                      {run.gameId === "bug-buster"
                        ? `${run.accuracyOrWords}% đúng`
                        : run.gameId === "standup-speed-run"
                        ? `${run.accuracyOrWords} từ khóa`
                        : `${run.accuracyOrWords} điểm mạnh`}
                      {run.durationSec > 0 ? ` • ${run.durationSec}s` : ""}
                      {" • "}
                      {new Date(run.createdAt).toLocaleDateString("vi-VN")}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-sky-100/90 border border-sky-300 text-xs font-mono font-bold text-sky-800 shrink-0">
                    {run.score.toLocaleString("vi-VN")} điểm
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-600">
            Bạn chưa có lượt chơi Arena nào. Thử sức tại{" "}
            <Link href="/arena" className="text-sky-700 font-semibold hover:underline">
              IT Speaking Arena
            </Link>
            !
          </p>
        )}
      </section>

      <section className="liquid-glass-card p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200/85 pb-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-2">
            <History className="w-4 h-4 text-violet-600" />
            <span>Lịch sử luyện tập và điểm thưởng</span>
          </h2>
          <span className="text-[11px] font-mono text-slate-600">
            {unifiedHistory.length} hoạt động
          </span>
        </div>

        {unifiedHistory.length > 0 ? (
          <div className="space-y-2">
            {unifiedHistory.slice(0, 15).map((item) => (
              <div
                key={item.id}
                className="bg-white/85 border border-slate-200/85 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {item.title}
                  </div>
                  <div className="text-[11px] font-mono text-slate-600 truncate">
                    {item.detail} • {new Date(item.createdAt).toLocaleDateString("vi-VN")}
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-violet-100/90 border border-violet-300 text-[11px] font-mono font-bold text-violet-800 shrink-0">
                  {item.badgeText}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-600">
            Chưa có hoạt động nào được ghi nhận. Hoàn thành một lượt luyện nói, Đố từ vựng 60 giây, Nói theo cụm từ hoặc trận Arena để xem lịch sử tại đây.
          </p>
        )}
      </section>

      <section className="liquid-glass-card p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200/85 pb-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-sky-600" />
            <span>Điểm cao nhất từng tình huống</span>
          </h2>
          <span className="text-[11px] font-mono text-slate-600">
            Tối đa 100 điểm
          </span>
        </div>

        <div className="space-y-3.5">
          {scenarioStats.map((st) => (
            <div key={st.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800">{st.titleVI}</span>
                <span className="font-mono text-slate-600">
                  {st.bestScore > 0 ? `${st.bestScore} điểm (${st.turnCount} lượt)` : "Chưa luyện"}
                </span>
              </div>
              <div className="w-full h-3 bg-slate-200/80 rounded-full border border-slate-300/70 overflow-hidden p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    st.bestScore >= 80
                      ? "bg-gradient-to-r from-emerald-500 to-sky-500"
                      : st.bestScore > 0
                      ? "bg-gradient-to-r from-sky-500 to-violet-500"
                      : "bg-transparent"
                  }`}
                  style={{ width: `${Math.max(st.bestScore > 0 ? 5 : 0, st.bestScore)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        aria-label="Tóm tắt IT Speaking Arena"
        className="liquid-glass-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-100/90 border border-violet-300 text-violet-900 text-xs font-mono font-semibold">
              <Award className="w-3.5 h-3.5 text-violet-700" aria-hidden="true" />
              <span>{devTitle.title}</span>
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/90 border border-amber-300 text-xs font-mono font-bold text-amber-900">
              <Coins className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
              <span>{coins} IT-Coin</span>
              <span className="text-[11px] font-normal text-amber-800">
                (1000 điểm = 1 Coin)
              </span>
            </span>

            <span
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-mono font-bold ${
                gamification.streakDays > 0
                  ? "bg-emerald-100/90 border-emerald-300 text-emerald-800"
                  : "bg-sky-100/90 border-sky-300 text-sky-800"
              }`}
            >
              <Flame
                className={`w-3.5 h-3.5 ${
                  gamification.streakDays > 0
                    ? "fill-emerald-500 text-emerald-600"
                    : "fill-sky-500 text-sky-600"
                }`}
                aria-hidden="true"
              />
              <span>{gamification.streakDays} ngày</span>
            </span>
          </div>

          <p className="text-xs text-slate-600 font-mono">
            Tổng {identity.totalPoints} điểm tích lũy từ hội thoại và game Arena.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            href="/vocabulary"
            className="liquid-glass-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-sky-600" aria-hidden="true" />
            <span>Từ vựng IT</span>
          </Link>

          <Link
            href="/arena"
            className="liquid-btn-primary text-white inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all"
          >
            <Gamepad2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Vào IT Arena</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section>
        <SevenDayPlan days={planDays} />
      </section>

      {keywordWeakPoints.length > 0 && (
        <section className="liquid-glass-card p-6 space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-200/85 pb-2">
            <h3 className="text-xs font-bold font-mono uppercase text-slate-900 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>Từ khóa bạn hay quên nhất ({keywordWeakPoints.length})</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-600">
              Xếp theo số lần bỏ sót
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {keywordWeakPoints.slice(0, 15).map((wp) => (
              <span
                key={wp.id}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50/90 border border-rose-300 text-xs font-mono"
              >
                <span className="font-bold text-slate-900">{wp.value}</span>
                <span className="text-[10px] text-rose-700 font-bold">
                  ({wp.miss_count} lần)
                </span>
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}


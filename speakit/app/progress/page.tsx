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

  // Compute stats
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

  // Streak calculation (days with at least 1 scenario attempt or arena run)
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

  // Best score per scenario
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
            <div className="h-7 w-28 rounded-pill bg-ink/10" />
            <div className="h-8 w-72 rounded-xl bg-ink/10" />
            <div className="h-4 w-96 max-w-full rounded-lg bg-ink/10" />
          </div>
          <div className="h-9 w-36 rounded-pill bg-ink/10" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-5">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="bg-white border border-ink/15 rounded-2xl p-4 sm:p-5 shadow-soft space-y-2"
            >
              <div className="h-8 w-16 mx-auto rounded-lg bg-ink/10" />
              <div className="h-3 w-24 mx-auto rounded bg-ink/10" />
            </div>
          ))}
        </div>

        <div className="bg-white border border-ink/15 rounded-2xl p-6 shadow-soft space-y-4">
          <div className="h-5 w-48 rounded-lg bg-ink/10" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[0, 1, 2].map((idx) => (
              <div key={idx} className="h-24 rounded-xl bg-ink/10" />
            ))}
          </div>
        </div>

        <div className="bg-white border border-ink/15 rounded-2xl p-6 shadow-soft space-y-4">
          <div className="h-5 w-56 rounded-lg bg-ink/10" />
          <div className="h-32 rounded-xl bg-ink/10" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white text-ink text-xs font-medium border border-ink/15 shadow-soft hover:bg-paper-muted shadow-hard-press transition-all mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Trang chủ</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-accent" />
            <span>Tiến Độ Học Tập & Kế Hoạch 7 Ngày</span>
          </h1>
          <p className="text-xs text-ink-muted mt-1.5">
            Theo dõi số lượt luyện nói, điểm số cao nhất từng tình huống và các điểm ngữ pháp/từ khóa cần cải thiện.
          </p>
        </div>

        {/* NCKH Data Export Button */}
        <button
          type="button"
          onClick={handleExportData}
          disabled={attempts.length === 0 && arenaRuns.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-pill bg-white border border-ink/20 text-xs font-mono font-semibold text-ink hover:bg-paper-muted shadow-soft shadow-hard-press transition-all self-start sm:self-center disabled:opacity-50 disabled:cursor-not-allowed"
          title="Xuất file JSON chứa toàn bộ lượt luyện tập để phục vụ nghiên cứu khoa học"
        >
          <Download className="w-4 h-4 text-accent" />
          <span>Xuất dữ liệu (.json)</span>
        </button>
      </div>

      {/* Metric Cards (Stat Grid with refined borders & soft shadows) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-5">
        <div className="bg-white border border-ink/15 rounded-2xl p-4 sm:p-5 shadow-soft text-center">
          <div className="text-2xl sm:text-3xl font-mono font-extrabold text-ink">
            {totalSessions}
          </div>
          <div className="text-[11px] text-ink-muted mt-1">
            Tổng lượt đã luyện
            {arenaRuns.length > 0 && (
              <span className="block text-[10px] font-mono">
                ({totalTurns} hội thoại • {arenaRuns.length} Arena)
              </span>
            )}
          </div>
        </div>

        <div className="bg-white border border-ink/15 rounded-2xl p-4 sm:p-5 shadow-soft text-center">
          <div className="text-2xl sm:text-3xl font-mono font-extrabold text-accent">
            {isArenaOnly ? bestArenaScore : bestScoreOverall}
          </div>
          <div className="text-[11px] text-ink-muted mt-1">
            {isArenaOnly ? "Điểm Arena cao nhất" : "Điểm cao nhất"}
          </div>
        </div>

        <div className="bg-white border border-ink/15 rounded-2xl p-4 sm:p-5 shadow-soft text-center">
          <div className="text-2xl sm:text-3xl font-mono font-extrabold text-ink">
            {isArenaOnly
              ? bugBusterRuns.length > 0
                ? `${avgBugAccuracy}%`
                : `${totalStandupKeywords}`
              : averageScore}
          </div>
          <div className="text-[11px] text-ink-muted mt-1">
            {isArenaOnly
              ? bugBusterRuns.length > 0
                ? "Chính xác Bug Buster TB"
                : "Từ khóa Standup"
              : "Điểm trung bình"}
          </div>
        </div>

        <div
          className={`rounded-2xl p-4 sm:p-5 shadow-soft text-center border ${
            currentStreak > 0
              ? "bg-[#DCFCE7] border-[#15803D]"
              : "bg-accent-light border-accent/30"
          }`}
        >
          <div
            className={`text-2xl sm:text-3xl font-mono font-extrabold flex items-center justify-center gap-1 ${
              currentStreak > 0 ? "text-[#15803D]" : "text-accent"
            }`}
          >
            <Flame
              className={`w-6 h-6 ${
                currentStreak > 0
                  ? "fill-[#16A34A] text-[#16A34A]"
                  : "fill-accent text-accent"
              }`}
            />
            <span>{currentStreak}</span>
          </div>
          <div
            className={`text-[11px] font-bold mt-1 ${
              currentStreak > 0 ? "text-[#15803D]" : "text-accent"
            }`}
          >
            Ngày luyện tập
          </div>
        </div>
      </div>

      {/* Arena Activity & History */}
      <section className="bg-white border border-ink/15 rounded-2xl p-6 shadow-soft space-y-4">
        <div className="flex items-center justify-between border-b border-paper-muted pb-3">
          <h2 className="text-sm font-bold text-ink uppercase tracking-wider font-mono flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-accent" />
            <span>Hoạt Động IT Speaking Arena</span>
          </h2>
          <span className="text-[11px] font-mono text-ink-muted">
            {arenaRuns.length} lượt chơi
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-paper border border-ink/15 rounded-xl p-3.5">
            <div className="text-[11px] font-mono text-ink-muted">Bug Buster cao nhất</div>
            <div className="text-xl font-mono font-extrabold text-ink mt-0.5">
              {bugBusterBest.toLocaleString("vi-VN")} pts
            </div>
            <div className="text-[11px] text-ink-muted mt-0.5">
              {bugBusterRuns.length > 0
                ? `${bugBusterRuns.length} lượt • ${avgBugAccuracy}% chính xác TB`
                : "Chưa có lượt chơi"}
            </div>
          </div>
          <div className="bg-paper border border-ink/15 rounded-xl p-3.5">
            <div className="text-[11px] font-mono text-ink-muted">Standup Speed Run cao nhất</div>
            <div className="text-xl font-mono font-extrabold text-ink mt-0.5">
              {standupBest.toLocaleString("vi-VN")} pts
            </div>
            <div className="text-[11px] text-ink-muted mt-0.5">
              {standupRuns.length > 0
                ? `${standupRuns.length} lượt • ${totalStandupKeywords} từ khóa`
                : "Chưa có lượt chơi"}
            </div>
          </div>
          <div className="bg-paper border border-ink/15 rounded-xl p-3.5">
            <div className="text-[11px] font-mono text-ink-muted">Tổng điểm tích lũy</div>
            <div className="text-xl font-mono font-extrabold text-accent mt-0.5">
              {identity.totalPoints.toLocaleString("vi-VN")} pts
            </div>
            <div className="text-[11px] text-ink-muted mt-0.5">
              {coins} IT-Coin • {devTitle.title}
            </div>
          </div>
        </div>

        {arenaRuns.length > 0 ? (
          <div className="space-y-2 pt-1">
            <div className="text-xs font-mono font-bold text-ink-muted flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-accent" />
              <span>Lịch sử Arena gần đây</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {arenaRuns.slice(0, 8).map((run) => (
                <div
                  key={run.id}
                  className="bg-paper border border-ink/10 rounded-xl p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-ink truncate">
                      {getArenaGameLabel(run.gameId)}
                    </div>
                    <div className="text-[11px] font-mono text-ink-muted">
                      {run.gameId === "bug-buster"
                        ? `${run.accuracyOrWords}% chính xác`
                        : run.gameId === "standup-speed-run"
                        ? `${run.accuracyOrWords} từ khóa`
                        : `${run.accuracyOrWords} chỉ số`}
                      {run.durationSec > 0 ? ` • ${run.durationSec}s` : ""}
                      {" • "}
                      {new Date(run.createdAt).toLocaleDateString("vi-VN")}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-pill bg-accent-light border border-accent/30 text-xs font-mono font-bold text-accent shrink-0">
                    {run.score.toLocaleString("vi-VN")} pts
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-ink-muted">
            Bạn chưa có lượt chơi Arena nào. Thử sức tại{" "}
            <Link href="/arena" className="text-accent font-semibold hover:underline">
              IT Speaking Arena
            </Link>
            !
          </p>
        )}
      </section>

      {/* Unified Activity & Point History */}
      <section className="bg-white border border-ink/15 rounded-2xl p-6 shadow-soft space-y-4">
        <div className="flex items-center justify-between border-b border-paper-muted pb-3">
          <h2 className="text-sm font-bold text-ink uppercase tracking-wider font-mono flex items-center gap-2">
            <History className="w-4 h-4 text-accent" />
            <span>Lịch Sử Hoạt Động &amp; Điểm Thưởng</span>
          </h2>
          <span className="text-[11px] font-mono text-ink-muted">
            {unifiedHistory.length} hoạt động
          </span>
        </div>

        {unifiedHistory.length > 0 ? (
          <div className="space-y-2">
            {unifiedHistory.slice(0, 15).map((item) => (
              <div
                key={item.id}
                className="bg-paper border border-ink/10 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-ink truncate">
                    {item.title}
                  </div>
                  <div className="text-[11px] font-mono text-ink-muted truncate">
                    {item.detail} • {new Date(item.createdAt).toLocaleDateString("vi-VN")}
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-pill bg-accent-light border border-accent/30 text-[11px] font-mono font-bold text-accent shrink-0">
                  {item.badgeText}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink-muted">
            Chưa có hoạt động nào được ghi nhận. Hoàn thành một lượt luyện nói, Vocab Quiz 60s, Cluster Speaking hoặc trận Arena để xem lịch sử tại đây.
          </p>
        )}
      </section>

      {/* Bar Chart: Best Score per Scenario */}
      <section className="bg-white border border-ink/15 rounded-2xl p-6 shadow-soft space-y-4">
        <div className="flex items-center justify-between border-b border-paper-muted pb-3">
          <h2 className="text-sm font-bold text-ink uppercase tracking-wider font-mono flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-accent" />
            <span>Điểm Cao Nhất Từng Tình Huống</span>
          </h2>
          <span className="text-[11px] font-mono text-ink-muted">
            Thang điểm 0 - 100
          </span>
        </div>

        <div className="space-y-3.5">
          {scenarioStats.map((st) => (
            <div key={st.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink">{st.titleVI}</span>
                <span className="font-mono text-ink-muted">
                  {st.bestScore > 0 ? `${st.bestScore} điểm (${st.turnCount} lượt)` : "Chưa luyện"}
                </span>
              </div>
              <div className="w-full h-3 bg-paper rounded-pill border border-ink/15 overflow-hidden p-0.5">
                <div
                  className={`h-full rounded-pill transition-all duration-500 ${
                    st.bestScore >= 80
                      ? "bg-accent"
                      : st.bestScore > 0
                      ? "bg-ink"
                      : "bg-transparent"
                  }`}
                  style={{ width: `${Math.max(st.bestScore > 0 ? 5 : 0, st.bestScore)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Compact Arena Summary Strip */}
      <section
        aria-label="Tóm tắt IT Speaking Arena"
        className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-ink text-white text-xs font-mono font-semibold">
              <Award className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
              <span>{devTitle.title}</span>
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-paper border border-ink/15 text-xs font-mono font-bold text-ink">
              <Coins className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
              <span>{coins} IT-Coin</span>
              <span className="text-[11px] font-normal text-ink-muted">
                (1000 điểm = 1 Coin)
              </span>
            </span>

            <span
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-pill border text-xs font-mono font-bold ${
                gamification.streakDays > 0
                  ? "bg-[#DCFCE7] border-[#15803D] text-[#15803D]"
                  : "bg-accent-light border-accent/30 text-accent"
              }`}
            >
              <Flame
                className={`w-3.5 h-3.5 ${
                  gamification.streakDays > 0
                    ? "fill-[#16A34A] text-[#16A34A]"
                    : "fill-accent text-accent"
                }`}
                aria-hidden="true"
              />
              <span>{gamification.streakDays} ngày</span>
            </span>
          </div>

          <p className="text-xs text-ink-muted font-mono">
            Tổng {identity.totalPoints} điểm tích lũy từ hội thoại &amp; Arena minigame.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            href="/vocabulary"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-pill bg-paper hover:bg-paper-muted text-ink text-xs font-semibold border border-ink/15 shadow-soft transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
            <span>Từ vựng IT</span>
          </Link>

          <Link
            href="/arena"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-accent hover:bg-accent-hover text-white text-xs font-semibold border border-accent shadow-soft transition-colors"
          >
            <Gamepad2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Vào IT Arena</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* 7-Day Adaptive Schedule */}
      <section>
        <SevenDayPlan days={planDays} />
      </section>

      {/* Tracked Weak Points List */}
      {keywordWeakPoints.length > 0 && (
        <section className="bg-white border border-ink/15 rounded-2xl p-6 shadow-soft space-y-3.5">
          <div className="flex items-center justify-between border-b border-paper-muted pb-2">
            <h3 className="text-xs font-bold font-mono uppercase text-ink flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-accent" />
              <span>Từ khóa bạn hay quên nhất ({keywordWeakPoints.length})</span>
            </h3>
            <span className="text-[11px] font-mono text-ink-muted">
              Xếp theo số lần bỏ sót
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {keywordWeakPoints.slice(0, 15).map((wp) => (
              <span
                key={wp.id}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-paper border border-ink text-xs font-mono"
              >
                <span className="font-bold text-ink">{wp.value}</span>
                <span className="text-[10px] text-accent font-bold">
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


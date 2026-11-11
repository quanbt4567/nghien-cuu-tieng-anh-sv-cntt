"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Coins,
  Download,
  Flame,
  Gamepad2,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import { SCENARIOS } from "../../data/scenarios";
import { storageAdapter } from "../../lib/storage";
import { GamificationState, PracticeAttempt, Scenario, WeakPoint } from "../../lib/types";
import { generate7DayPlan, PlanDay } from "../../lib/planGenerator";
import {
  GAMIFICATION_STORAGE_KEY,
  GAMIFICATION_UPDATED_EVENT,
  calculateCoins,
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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const [allAttempts, allWeakPoints] = await Promise.all([
        storageAdapter.getAttempts(),
        storageAdapter.getWeakPoints(),
      ]);

      setAttempts(allAttempts);
      setWeakPoints(allWeakPoints);
      setPlanDays(generate7DayPlan(allWeakPoints, allAttempts));
      setIsLoading(false);
    }

    const syncGamification = () => setGamification(getGamificationState());
    const syncContent = () => setScenarios(getEffectiveScenarios());

    loadData();
    syncGamification();
    syncContent();
    void fetchAndCachePublicContent();

    window.addEventListener(GAMIFICATION_UPDATED_EVENT, syncGamification);
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
      window.removeEventListener(CONTENT_UPDATED_EVENT, syncContent);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // Compute stats
  const totalTurns = attempts.length;
  const bestScoreOverall =
    attempts.length > 0 ? Math.max(...attempts.map((a) => a.score)) : 0;
  const averageScore =
    attempts.length > 0
      ? Math.round(attempts.reduce((acc, a) => acc + a.score, 0) / attempts.length)
      : 0;

  // Streak calculation (days with at least 1 attempt)
  const uniqueDates = new Set(
    attempts.map((a) => a.created_at.slice(0, 10))
  );
  const currentStreak = uniqueDates.size;

  const devTitle = getDevTitle(gamification.totalPoints);
  const coins = calculateCoins(gamification.totalPoints);

  // Best score per scenario
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
        averageScore,
        bestScoreOverall,
        streakDays: currentStreak,
      },
      scenarioStats,
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
          disabled={attempts.length === 0}
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
            {totalTurns}
          </div>
          <div className="text-[11px] text-ink-muted mt-1">Tổng lượt đã luyện</div>
        </div>

        <div className="bg-white border border-ink/15 rounded-2xl p-4 sm:p-5 shadow-soft text-center">
          <div className="text-2xl sm:text-3xl font-mono font-extrabold text-accent">
            {bestScoreOverall}
          </div>
          <div className="text-[11px] text-ink-muted mt-1">Điểm cao nhất</div>
        </div>

        <div className="bg-white border border-ink/15 rounded-2xl p-4 sm:p-5 shadow-soft text-center">
          <div className="text-2xl sm:text-3xl font-mono font-extrabold text-ink">
            {averageScore}
          </div>
          <div className="text-[11px] text-ink-muted mt-1">Điểm trung bình</div>
        </div>

        <div className="bg-accent-light border border-accent/30 rounded-2xl p-4 sm:p-5 shadow-soft text-center">
          <div className="text-2xl sm:text-3xl font-mono font-extrabold text-accent flex items-center justify-center gap-1">
            <Flame className="w-6 h-6 fill-accent text-accent" />
            <span>{currentStreak}</span>
          </div>
          <div className="text-[11px] font-bold text-accent mt-1">Ngày luyện tập</div>
        </div>
      </div>

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

            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-pill bg-accent-light border border-accent/30 text-xs font-mono font-bold text-accent">
              <Flame className="w-3.5 h-3.5 fill-accent text-accent" aria-hidden="true" />
              <span>{gamification.streakDays} ngày</span>
            </span>
          </div>

          <p className="text-xs text-ink-muted font-mono">
            Tổng {gamification.totalPoints} điểm tích lũy từ hội thoại &amp; Arena minigame.
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
      {weakPoints.length > 0 && (
        <section className="bg-white border border-ink/15 rounded-2xl p-6 shadow-soft space-y-3.5">
          <div className="flex items-center justify-between border-b border-paper-muted pb-2">
            <h3 className="text-xs font-bold font-mono uppercase text-ink flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-accent" />
              <span>Từ khóa bạn hay quên nhất ({weakPoints.length})</span>
            </h3>
            <span className="text-[11px] font-mono text-ink-muted">
              Xếp theo số lần bỏ sót
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {weakPoints.slice(0, 15).map((wp) => (
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


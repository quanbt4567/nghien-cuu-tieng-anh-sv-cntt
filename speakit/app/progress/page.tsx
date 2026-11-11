"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, TrendingUp, Flame, CheckCircle, AlertCircle, BarChart3 } from "lucide-react";
import { SCENARIOS } from "../../data/scenarios";
import { storageAdapter } from "../../lib/storage";
import { PracticeAttempt, WeakPoint } from "../../lib/types";
import { generate7DayPlan, PlanDay } from "../../lib/planGenerator";
import { SevenDayPlan } from "../../components/progress/SevenDayPlan";

export default function ProgressPage() {
  const [attempts, setAttempts] = useState<PracticeAttempt[]>([]);
  const [weakPoints, setWeakPoints] = useState<WeakPoint[]>([]);
  const [planDays, setPlanDays] = useState<PlanDay[]>([]);
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

    loadData();
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

  // Best score per scenario
  const scenarioStats = SCENARIOS.map((scenario) => {
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Top Header */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-paper-card text-ink text-xs font-medium border-2 border-ink shadow-hard hover:bg-paper-muted shadow-hard-press transition-all mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Trang chủ</span>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-accent" />
          <span>Tiến Độ Học Tập & Kế Hoạch 7 Ngày</span>
        </h1>
        <p className="text-xs text-ink-muted mt-1">
          Theo dõi số lượt luyện nói, điểm số cao nhất từng tình huống và các điểm ngữ pháp/từ khóa cần cải thiện.
        </p>
      </div>

      {/* Metric Cards (Stat Grid) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border-2 border-ink rounded-2xl p-4 shadow-hard text-center">
          <div className="text-2xl sm:text-3xl font-mono font-extrabold text-ink">
            {totalTurns}
          </div>
          <div className="text-[11px] text-ink-muted mt-1">Tổng lượt đã luyện</div>
        </div>

        <div className="bg-white border-2 border-ink rounded-2xl p-4 shadow-hard text-center">
          <div className="text-2xl sm:text-3xl font-mono font-extrabold text-accent">
            {bestScoreOverall}
          </div>
          <div className="text-[11px] text-ink-muted mt-1">Điểm cao nhất</div>
        </div>

        <div className="bg-white border-2 border-ink rounded-2xl p-4 shadow-hard text-center">
          <div className="text-2xl sm:text-3xl font-mono font-extrabold text-ink">
            {averageScore}
          </div>
          <div className="text-[11px] text-ink-muted mt-1">Điểm trung bình</div>
        </div>

        <div className="bg-accent-light border-2 border-accent rounded-2xl p-4 shadow-hard text-center">
          <div className="text-2xl sm:text-3xl font-mono font-extrabold text-accent flex items-center justify-center gap-1">
            <Flame className="w-6 h-6 fill-accent text-accent" />
            <span>{currentStreak}</span>
          </div>
          <div className="text-[11px] font-bold text-accent mt-1">Ngày luyện tập</div>
        </div>
      </div>

      {/* Bar Chart: Best Score per Scenario */}
      <section className="bg-white border-2 border-ink rounded-2xl p-5 sm:p-6 shadow-hard space-y-4">
        <div className="flex items-center justify-between border-b border-paper-muted pb-3">
          <h2 className="text-sm font-bold text-ink uppercase tracking-wider font-mono flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-accent" />
            <span>Điểm Cao Nhất Từng Tình Huống</span>
          </h2>
          <span className="text-[11px] font-mono text-ink-muted">
            Thang điểm 0 - 100
          </span>
        </div>

        <div className="space-y-3">
          {scenarioStats.map((st) => (
            <div key={st.id} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink">{st.titleVI}</span>
                <span className="font-mono text-ink-muted">
                  {st.bestScore > 0 ? `${st.bestScore} điểm (${st.turnCount} lượt)` : "Chưa luyện"}
                </span>
              </div>
              <div className="w-full h-3 bg-paper rounded-pill border border-ink overflow-hidden p-0.5">
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

      {/* 7-Day Adaptive Schedule */}
      <section>
        <SevenDayPlan days={planDays} />
      </section>

      {/* Tracked Weak Points List */}
      {weakPoints.length > 0 && (
        <section className="bg-white border-2 border-ink rounded-2xl p-5 shadow-hard space-y-3">
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


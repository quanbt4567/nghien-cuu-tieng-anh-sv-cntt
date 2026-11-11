"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Award,
  Bug,
  Coins,
  Flame,
  Gamepad2,
  Timer,
  Trophy,
  UserCog,
} from "lucide-react";
import { Globe } from "lucide-react";
import { BugBusterGame } from "../../components/arena/BugBusterGame";
import { LocalLeaderboard } from "../../components/arena/LocalLeaderboard";
import { StandupSpeedRun } from "../../components/arena/StandupSpeedRun";
import { GlobalLeaderboard } from "../../components/leaderboard/GlobalLeaderboard";
import { IT_ROLES } from "../../data/minigames";
import {
  GAMIFICATION_STORAGE_KEY,
  GAMIFICATION_UPDATED_EVENT,
  POINTS_PER_COIN,
  calculateCoins,
  getDevTitle,
  getGamificationState,
  pointsToNextCoin,
  setSelectedRole,
} from "../../lib/gamification";
import { GamificationState, ITRole } from "../../lib/types";

type ArenaTab =
  | "bug-buster"
  | "standup-speed-run"
  | "leaderboard"
  | "global-leaderboard";

const INITIAL_SSR_STATE: GamificationState = {
  totalPoints: 0,
  streakDays: 0,
  lastPracticeDate: null,
  selectedRole: "frontend",
  personalBests: {
    "bug-buster": 0,
    "standup-speed-run": 0,
  },
  history: [],
};

export default function ArenaPage() {
  const [activeTab, setActiveTab] = useState<ArenaTab>("bug-buster");
  const [state, setState] = useState<GamificationState>(INITIAL_SSR_STATE);

  useEffect(() => {
    const syncState = () => {
      setState(getGamificationState());
    };

    syncState();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === GAMIFICATION_STORAGE_KEY || event.key === null) {
        syncState();
      }
    };

    window.addEventListener(GAMIFICATION_UPDATED_EVENT, syncState);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(GAMIFICATION_UPDATED_EVENT, syncState);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const coins = calculateCoins(state.totalPoints);
  const toNextCoin = pointsToNextCoin(state.totalPoints);
  const coinRemainder = POINTS_PER_COIN - toNextCoin;
  const coinProgressPct = Math.round((coinRemainder / POINTS_PER_COIN) * 100);
  const devTitle = getDevTitle(state.totalPoints);
  const roleLabel =
    IT_ROLES.find((r) => r.id === state.selectedRole)?.label ?? "Frontend";

  const handleRoleChange = (role: ITRole) => {
    setState(setSelectedRole(role));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white text-ink text-xs font-medium border border-ink/15 shadow-soft hover:bg-paper-muted shadow-hard-press transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Trang chủ</span>
        </Link>

        <span className="text-[11px] font-mono text-ink-muted">
          Zero-Auth • Lưu điểm cục bộ
        </span>
      </div>

      {/* Arena Header Card */}
      <section className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
              <Gamepad2 className="w-6 h-6 text-accent shrink-0" />
              <span>IT Speaking Arena</span>
            </h1>
            <p className="text-xs sm:text-sm text-ink-muted">
              Luyện phản xạ nói tiếng Anh CNTT theo thời gian thực để tích lũy
              IT-Coin và nâng hạng Dev Speaker.
            </p>
          </div>

          {/* Badges: Streak Flame, Dev Title, Role */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-paper border border-ink/15 text-xs font-mono font-bold text-ink">
              <Flame className="w-4 h-4 fill-accent text-accent" />
              <span>{state.streakDays} ngày</span>
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-ink text-white text-xs font-mono font-semibold">
              <Award className="w-3.5 h-3.5 text-accent" />
              <span>{devTitle.title}</span>
            </span>

            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-paper border border-ink/15 text-xs font-mono font-semibold text-ink">
              <UserCog className="w-3.5 h-3.5 text-accent shrink-0" />
              <span className="sr-only">Vai trò CNTT</span>
              <select
                value={state.selectedRole}
                onChange={(e) => handleRoleChange(e.target.value as ITRole)}
                aria-label="Chọn vai trò CNTT"
                className="bg-transparent focus:outline-none cursor-pointer font-mono text-xs text-ink"
              >
                {IT_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* IT-Coins & Progress toward next Coin (1000 pts = 1 IT-Coin) */}
        <div className="bg-paper border border-ink/15 rounded-2xl p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-accent-light border border-accent/30 flex items-center justify-center">
                <Coins className="w-4 h-4 text-accent" />
              </div>
              <div>
                <div className="text-sm font-bold text-ink font-mono">
                  {coins} IT-Coin{coins === 1 ? "" : "s"}
                </div>
                <div className="text-[11px] text-ink-muted">
                  1.000 điểm = 1 IT-Coin • Vai trò hiện tại:{" "}
                  <strong className="text-ink">{roleLabel}</strong>
                </div>
              </div>
            </div>

            <div className="text-right font-mono text-xs">
              <div className="font-bold text-ink">
                {coinRemainder} / {POINTS_PER_COIN} điểm
              </div>
              <div className="text-[11px] text-ink-muted">
                Còn {toNextCoin} điểm để nhận +1 IT-Coin
              </div>
            </div>
          </div>

          <div className="w-full h-2.5 bg-white rounded-pill border border-ink/15 overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-500"
              style={{ width: `${Math.max(2, coinProgressPct)}%` }}
            />
          </div>
        </div>
      </section>

      {/* 3-Tab Selector */}
      <div
        role="tablist"
        aria-label="Chế độ IT Speaking Arena"
        className="flex flex-wrap gap-2"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "bug-buster"}
          onClick={() => setActiveTab("bug-buster")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-pill text-xs sm:text-sm font-semibold border transition-all ${
            activeTab === "bug-buster"
              ? "bg-ink text-white border-ink shadow-soft"
              : "bg-white text-ink border-ink/15 hover:bg-paper-muted shadow-soft"
          }`}
        >
          <Bug className="w-4 h-4" />
          <span>Bug Buster 60s</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "standup-speed-run"}
          onClick={() => setActiveTab("standup-speed-run")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-pill text-xs sm:text-sm font-semibold border transition-all ${
            activeTab === "standup-speed-run"
              ? "bg-ink text-white border-ink shadow-soft"
              : "bg-white text-ink border-ink/15 hover:bg-paper-muted shadow-soft"
          }`}
        >
          <Timer className="w-4 h-4" />
          <span>Standup Speed Run</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "leaderboard"}
          onClick={() => setActiveTab("leaderboard")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-pill text-xs sm:text-sm font-semibold border transition-all ${
            activeTab === "leaderboard"
              ? "bg-ink text-white border-ink shadow-soft"
              : "bg-white text-ink border-ink/15 hover:bg-paper-muted shadow-soft"
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Xếp hạng & Danh hiệu</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "global-leaderboard"}
          onClick={() => setActiveTab("global-leaderboard")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-pill text-xs sm:text-sm font-semibold border transition-all ${
            activeTab === "global-leaderboard"
              ? "bg-accent text-white border-accent shadow-soft"
              : "bg-white text-ink border-ink/15 hover:bg-paper-muted shadow-soft"
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Bảng xếp hạng Toàn cầu</span>
        </button>
      </div>

      {/* Active Tab Panel */}
      {activeTab === "bug-buster" && <BugBusterGame role={state.selectedRole} />}
      {activeTab === "standup-speed-run" && (
        <StandupSpeedRun role={state.selectedRole} />
      )}
      {activeTab === "leaderboard" && <LocalLeaderboard state={state} />}
      {activeTab === "global-leaderboard" && <GlobalLeaderboard />}
    </div>
  );
}

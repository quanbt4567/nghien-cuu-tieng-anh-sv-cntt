"use client";

import { Award, Bug, Timer, Trophy } from "lucide-react";
import { IT_ROLES } from "../../data/minigames";
import { getDevTitle } from "../../lib/gamification";
import { GamificationState, ITRole, MinigameId } from "../../lib/types";

interface LocalLeaderboardProps {
  state: GamificationState;
}

const GAME_LABELS: Record<MinigameId, string> = {
  "bug-buster": "Bug Buster 280s",
  "standup-speed-run": "Standup Speed Run",
};

const TITLE_TIERS = [
  { name: "Junior Speaker", range: "< 2.000 điểm", min: 0 },
  { name: "Mid-level Communicator", range: "2.000 – 4.999 điểm", min: 2000 },
  { name: "Lead Tech Speaker", range: "5.000+ điểm", min: 5000 },
] as const;

function getRoleLabel(role: ITRole): string {
  return IT_ROLES.find((r) => r.id === role)?.label ?? role;
}

export function LocalLeaderboard({ state }: LocalLeaderboardProps) {
  const devTitle = getDevTitle(state.totalPoints);
  const rankedHistory = [...state.history].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.createdAt.localeCompare(a.createdAt);
  });

  return (
    <div className="space-y-6">
      <section className="liquid-glass-card p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-mono font-bold uppercase text-cyan-300 flex items-center gap-1.5">
              <Award className="w-4 h-4" />
              <span>Danh hiệu Dev Speaker hiện tại</span>
            </span>
            <h2 className="text-2xl font-bold text-white">{devTitle.title}</h2>
          </div>

          <div className="liquid-glass-pill px-4 py-2 font-mono text-sm font-bold text-white">
            {state.totalPoints.toLocaleString("vi-VN")} điểm tích lũy
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-300">
              {devTitle.nextTitle && devTitle.nextThreshold !== null ? (
                <>
                  Tiến độ lên{" "}
                  <strong className="text-white">{devTitle.nextTitle}</strong> (
                  {devTitle.nextThreshold.toLocaleString("vi-VN")} điểm)
                </>
              ) : (
                <strong className="text-emerald-300">
                  Bạn đã đạt cấp bậc cao nhất tại SpeakIT Arena
                </strong>
              )}
            </span>
            <span className="font-mono font-bold text-cyan-300">
              {devTitle.progressPct}%
            </span>
          </div>

          <div className="w-full h-3 bg-slate-950/65 rounded-pill border border-white/15 overflow-hidden p-0.5">
            <div
              className="h-full rounded-pill bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-500"
              style={{ width: `${Math.max(4, devTitle.progressPct)}%` }}
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 pt-1">
          {TITLE_TIERS.map((tier) => {
            const isCurrent = devTitle.title === tier.name;
            const isUnlocked = state.totalPoints >= tier.min;
            return (
              <div
                key={tier.name}
                className={`rounded-xl p-3 border text-xs transition-colors ${
                  isCurrent
                    ? "bg-cyan-500/20 text-white border-cyan-400/50 shadow-[0_0_18px_rgba(6,182,212,0.22)]"
                    : isUnlocked
                    ? "bg-emerald-500/15 border-emerald-400/35 text-emerald-100"
                    : "bg-slate-950/50 border-white/10 text-slate-400"
                }`}
              >
                <div className="font-bold">{tier.name}</div>
                <div
                  className={`font-mono text-[11px] mt-0.5 ${
                    isCurrent
                      ? "text-cyan-200"
                      : isUnlocked
                      ? "text-emerald-200/80"
                      : "text-slate-400"
                  }`}
                >
                  {tier.range}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid sm:grid-cols-2 gap-4">
        <div className="liquid-glass-card p-5 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-300">
              <Bug className="w-4 h-4" />
              <span>Kỷ lục cá nhân</span>
            </div>
            <h3 className="text-base font-bold text-white">Bug Buster 280s</h3>
            <p className="text-xs text-slate-300">
              Điểm cao nhất trong 1 vòng 280 giây
            </p>
          </div>
          <div className="text-right font-mono">
            <div className="text-2xl font-bold text-emerald-300">
              {state.personalBests["bug-buster"].toLocaleString("vi-VN")}
            </div>
            <div className="text-[11px] text-slate-400">điểm</div>
          </div>
        </div>

        <div className="liquid-glass-card p-5 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-indigo-300">
              <Timer className="w-4 h-4" />
              <span>Kỷ lục cá nhân</span>
            </div>
            <h3 className="text-base font-bold text-white">Standup Speed Run</h3>
            <p className="text-xs text-slate-300">
              Điểm cao nhất trong 3 câu Standup
            </p>
          </div>
          <div className="text-right font-mono">
            <div className="text-2xl font-bold text-indigo-300">
              {state.personalBests["standup-speed-run"].toLocaleString("vi-VN")}
            </div>
            <div className="text-[11px] text-slate-400">điểm</div>
          </div>
        </div>
      </section>

      <section className="liquid-glass-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-300" />
            <h3 className="text-base sm:text-lg font-bold text-white">
              Bảng thành tích cá nhân
            </h3>
          </div>
        </div>

        {rankedHistory.length === 0 ? (
          <div className="bg-slate-950/50 border border-white/12 rounded-xl p-6 text-center text-xs text-slate-300">
            Chưa có lượt chơi nào được lưu. Hãy hoàn thành một vòng{" "}
            <strong className="text-white">Bug Buster 280s</strong> hoặc{" "}
            <strong className="text-white">Standup Speed Run</strong> để ghi danh!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/15 text-slate-400 font-mono uppercase text-[11px]">
                  <th className="py-2.5 pr-3">#</th>
                  <th className="py-2.5 pr-3">Chế độ</th>
                  <th className="py-2.5 pr-3">Vai trò</th>
                  <th className="py-2.5 pr-3 text-right">Điểm</th>
                  <th className="py-2.5 pr-3 text-right">Bug / Từ khóa</th>
                  <th className="py-2.5 text-right">Ngày</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {rankedHistory.map((entry, idx) => (
                  <tr key={entry.id} className="hover:bg-white/[0.04] transition-colors">
                    <td className="py-2.5 pr-3 font-mono font-bold text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 pr-3 font-semibold text-white whitespace-nowrap">
                      {GAME_LABELS[entry.gameId]}
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-pill bg-white/[0.08] border border-white/15 font-mono text-[11px] text-slate-200">
                        {getRoleLabel(entry.role)}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono font-bold text-cyan-300 whitespace-nowrap">
                      {entry.score.toLocaleString("vi-VN")}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono text-slate-200 whitespace-nowrap">
                      {entry.accuracyOrWords}{" "}
                      {entry.gameId === "bug-buster" ? "bug" : "từ khóa"}
                    </td>
                    <td className="py-2.5 text-right font-mono text-slate-400 whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleDateString("vi-VN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

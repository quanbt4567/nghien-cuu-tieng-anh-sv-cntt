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
  { name: "Mid-level Communicator", range: "2.000 - 4.999 điểm", min: 2000 },
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
            <span className="text-xs font-mono font-bold uppercase text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
              <Award className="w-4 h-4" />
              <span>Danh hiệu Dev Speaker hiện tại</span>
            </span>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{devTitle.title}</h2>
          </div>

          <div className="px-4 py-2 rounded-full bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
            {state.totalPoints.toLocaleString("vi-VN")} điểm tích lũy
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-slate-600 dark:text-slate-300">
              {devTitle.nextTitle && devTitle.nextThreshold !== null ? (
                <>
                  Tiến độ lên{" "}
                  <strong className="text-slate-900 dark:text-slate-100">{devTitle.nextTitle}</strong> (
                  {devTitle.nextThreshold.toLocaleString("vi-VN")} điểm)
                </>
              ) : (
                <strong className="text-green-700 dark:text-green-400">
                  Bạn đã đạt cấp bậc cao nhất tại SpeakIT Arena
                </strong>
              )}
            </span>
            <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
              {devTitle.progressPct}%
            </span>
          </div>

          <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full border border-slate-300 dark:border-slate-700 overflow-hidden p-0.5">
            <div
              className="w-full h-full origin-left rounded-full bg-blue-700 dark:bg-blue-600 transition-transform duration-500"
              style={{ transform: `scaleX(${Math.max(0.04, devTitle.progressPct / 100)})` }}
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-3 border-t border-slate-200 dark:border-slate-800 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800 pt-2">
          {TITLE_TIERS.map((tier) => {
            const isCurrent = devTitle.title === tier.name;
            const isUnlocked = state.totalPoints >= tier.min;
            return (
              <div
                key={tier.name}
                className={`p-3 text-sm transition-colors ${
                  isCurrent
                    ? "bg-blue-50 text-slate-900 dark:bg-blue-950/40 dark:text-slate-100"
                    : isUnlocked
                    ? "bg-green-50/70 text-green-900 dark:bg-green-950/30 dark:text-green-200"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                <div className="font-bold">{tier.name}</div>
                <div
                  className={`font-mono text-xs mt-0.5 ${
                    isCurrent
                      ? "text-blue-700 dark:text-blue-300"
                      : isUnlocked
                      ? "text-green-700 dark:text-green-400"
                      : "text-slate-500 dark:text-slate-400"
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
            <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-green-700 dark:text-green-400">
              <Bug className="w-4 h-4" />
              <span>Kỷ lục cá nhân</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Bug Buster 280s</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Điểm cao nhất trong 1 vòng 280 giây
            </p>
          </div>
          <div className="text-right font-mono">
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">
              {state.personalBests["bug-buster"].toLocaleString("vi-VN")}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400">điểm</div>
          </div>
        </div>

        <div className="liquid-glass-card p-5 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-blue-700 dark:text-blue-400">
              <Timer className="w-4 h-4" />
              <span>Kỷ lục cá nhân</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Standup Speed Run</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Điểm cao nhất trong 3 câu Standup
            </p>
          </div>
          <div className="text-right font-mono">
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
              {state.personalBests["standup-speed-run"].toLocaleString("vi-VN")}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400">điểm</div>
          </div>
        </div>
      </section>

      <section className="liquid-glass-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              Bảng thành tích cá nhân
            </h3>
          </div>
        </div>

        {rankedHistory.length === 0 ? (
          <div className="border-t border-slate-200 dark:border-slate-800 pt-6 pb-2 text-center text-sm text-slate-600 dark:text-slate-300">
            Chưa có lượt chơi nào được lưu. Hãy hoàn thành một vòng{" "}
            <strong className="text-slate-900 dark:text-slate-100">Bug Buster 280s</strong> hoặc{" "}
            <strong className="text-slate-900 dark:text-slate-100">Standup Speed Run</strong> để ghi danh!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-mono uppercase text-xs">
                  <th className="py-2.5 pr-3">#</th>
                  <th className="py-2.5 pr-3">Chế độ</th>
                  <th className="py-2.5 pr-3">Vai trò</th>
                  <th className="py-2.5 pr-3 text-right">Điểm</th>
                  <th className="py-2.5 pr-3 text-right">Bug / Từ khóa</th>
                  <th className="py-2.5 text-right">Ngày</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {rankedHistory.map((entry, idx) => (
                  <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-2.5 pr-3 font-mono font-bold text-slate-600 dark:text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 pr-3 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {GAME_LABELS[entry.gameId]}
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 font-mono text-xs text-slate-700 dark:text-slate-300">
                        {getRoleLabel(entry.role)}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono font-bold text-blue-700 dark:text-blue-400 whitespace-nowrap">
                      {entry.score.toLocaleString("vi-VN")}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {entry.accuracyOrWords}{" "}
                      {entry.gameId === "bug-buster" ? "bug" : "từ khóa"}
                    </td>
                    <td className="py-2.5 text-right font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
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

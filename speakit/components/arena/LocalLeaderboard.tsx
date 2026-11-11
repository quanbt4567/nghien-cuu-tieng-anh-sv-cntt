"use client";

import { Award, Bug, ShieldCheck, Timer, Trophy } from "lucide-react";
import { IT_ROLES } from "../../data/minigames";
import { getDevTitle } from "../../lib/gamification";
import { GamificationState, ITRole, MinigameId } from "../../lib/types";

interface LocalLeaderboardProps {
  state: GamificationState;
}

const GAME_LABELS: Record<MinigameId, string> = {
  "bug-buster": "Bug Buster 60s",
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
      {/* 1. Current Dev Title Card */}
      <section className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-mono font-bold uppercase text-accent flex items-center gap-1.5">
              <Award className="w-4 h-4" />
              <span>Danh hiệu Dev Speaker hiện tại</span>
            </span>
            <h2 className="text-2xl font-bold text-ink">{devTitle.title}</h2>
          </div>

          <div className="px-4 py-2 rounded-pill bg-paper border border-ink/15 font-mono text-sm font-bold text-ink">
            {state.totalPoints.toLocaleString("vi-VN")} điểm tích lũy
          </div>
        </div>

        {/* Progress Bar to Next Title */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-ink-muted">
              {devTitle.nextTitle && devTitle.nextThreshold !== null ? (
                <>
                  Tiến độ lên{" "}
                  <strong className="text-ink">{devTitle.nextTitle}</strong> (
                  {devTitle.nextThreshold.toLocaleString("vi-VN")} điểm)
                </>
              ) : (
                <strong className="text-ink">
                  Bạn đã đạt cấp bậc cao nhất tại SpeakIT Arena
                </strong>
              )}
            </span>
            <span className="font-mono font-bold text-accent">
              {devTitle.progressPct}%
            </span>
          </div>

          <div className="w-full h-3 bg-paper rounded-pill border border-ink/15 overflow-hidden p-0.5">
            <div
              className="h-full rounded-pill bg-accent transition-all duration-500"
              style={{ width: `${Math.max(4, devTitle.progressPct)}%` }}
            />
          </div>
        </div>

        {/* Tier Ladder */}
        <div className="grid sm:grid-cols-3 gap-3 pt-1">
          {TITLE_TIERS.map((tier) => {
            const isCurrent = devTitle.title === tier.name;
            const isUnlocked = state.totalPoints >= tier.min;
            return (
              <div
                key={tier.name}
                className={`rounded-xl p-3 border text-xs transition-colors ${
                  isCurrent
                    ? "bg-ink text-white border-ink"
                    : isUnlocked
                    ? "bg-paper border-ink/20 text-ink"
                    : "bg-paper-muted/60 border-ink/10 text-ink-muted"
                }`}
              >
                <div className="font-bold">{tier.name}</div>
                <div
                  className={`font-mono text-[11px] mt-0.5 ${
                    isCurrent ? "text-paper-subtle" : "text-ink-muted"
                  }`}
                >
                  {tier.range}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. Personal Best Cards */}
      <section className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-accent">
              <Bug className="w-4 h-4" />
              <span>Kỷ lục cá nhân</span>
            </div>
            <h3 className="text-base font-bold text-ink">Bug Buster 60s</h3>
            <p className="text-xs text-ink-muted">
              Điểm cao nhất trong 1 vòng 60 giây
            </p>
          </div>
          <div className="text-right font-mono">
            <div className="text-2xl font-bold text-ink">
              {state.personalBests["bug-buster"].toLocaleString("vi-VN")}
            </div>
            <div className="text-[11px] text-ink-muted">điểm</div>
          </div>
        </div>

        <div className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-accent">
              <Timer className="w-4 h-4" />
              <span>Kỷ lục cá nhân</span>
            </div>
            <h3 className="text-base font-bold text-ink">Standup Speed Run</h3>
            <p className="text-xs text-ink-muted">
              Điểm cao nhất trong 3 câu Standup
            </p>
          </div>
          <div className="text-right font-mono">
            <div className="text-2xl font-bold text-ink">
              {state.personalBests["standup-speed-run"].toLocaleString("vi-VN")}
            </div>
            <div className="text-[11px] text-ink-muted">điểm</div>
          </div>
        </div>
      </section>

      {/* 3. Top Personal Runs Table */}
      <section className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-accent" />
            <h3 className="text-base sm:text-lg font-bold text-ink">
              Bảng thành tích cá nhân
            </h3>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-paper border border-ink/15 text-[11px] font-mono text-ink-muted">
            <ShieldCheck className="w-3.5 h-3.5 text-accent" />
            <span>Lưu cục bộ trên trình duyệt — Zero-auth</span>
          </span>
        </div>

        {rankedHistory.length === 0 ? (
          <div className="bg-paper border border-ink/15 rounded-xl p-6 text-center text-xs text-ink-muted">
            Chưa có lượt chơi nào được lưu. Hãy hoàn thành một vòng{" "}
            <strong className="text-ink">Bug Buster 60s</strong> hoặc{" "}
            <strong className="text-ink">Standup Speed Run</strong> để ghi danh!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-ink/15 text-ink-muted font-mono uppercase text-[11px]">
                  <th className="py-2.5 pr-3">#</th>
                  <th className="py-2.5 pr-3">Chế độ</th>
                  <th className="py-2.5 pr-3">Vai trò</th>
                  <th className="py-2.5 pr-3 text-right">Điểm</th>
                  <th className="py-2.5 pr-3 text-right">Bug / Từ khóa</th>
                  <th className="py-2.5 text-right">Ngày</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-muted">
                {rankedHistory.map((entry, idx) => (
                  <tr key={entry.id} className="hover:bg-paper/60">
                    <td className="py-2.5 pr-3 font-mono font-bold text-ink-muted">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 pr-3 font-semibold text-ink whitespace-nowrap">
                      {GAME_LABELS[entry.gameId]}
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-pill bg-paper border border-ink/15 font-mono text-[11px] text-ink">
                        {getRoleLabel(entry.role)}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono font-bold text-accent whitespace-nowrap">
                      {entry.score.toLocaleString("vi-VN")}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono text-ink whitespace-nowrap">
                      {entry.accuracyOrWords}{" "}
                      {entry.gameId === "bug-buster" ? "bug" : "từ khóa"}
                    </td>
                    <td className="py-2.5 text-right font-mono text-ink-muted whitespace-nowrap">
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

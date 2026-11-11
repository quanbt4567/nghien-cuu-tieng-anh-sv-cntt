"use client";

import { useMemo, useState } from "react";
import { Download, FileJson, Filter, Search } from "lucide-react";
import { SCENARIOS } from "../../data/scenarios";
import { mergeScenarios } from "../../lib/contentStore";
import {
  ROLE_LABELS,
  downloadResearchCsv,
  downloadResearchJson,
  formatDateTimeVI,
  type MergedAdminData,
} from "./adminShared";

interface AdminLogsTabProps {
  data: MergedAdminData;
}

type LogView = "all" | "practice" | "arena";

const GAME_LABELS: Record<string, string> = {
  "bug-buster": "Bug Buster",
  "standup-speed-run": "Standup Speed Run",
};

export function AdminLogsTab({ data }: AdminLogsTabProps) {
  const { attempts, arenaRuns, weakPoints, overrides } = data;

  const [view, setView] = useState<LogView>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [scenarioFilter, setScenarioFilter] = useState<string>("all");
  const [gameFilter, setGameFilter] = useState<string>("all");

  const scenarioTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of mergeScenarios(SCENARIOS, overrides, true)) {
      map.set(s.id, s.titleVI);
    }
    return map;
  }, [overrides]);

  const scenarioOptions = useMemo(() => {
    const ids = new Set<string>(Array.from(scenarioTitleMap.keys()));
    for (const a of attempts) {
      ids.add(a.scenario);
    }
    return Array.from(ids);
  }, [attempts, scenarioTitleMap]);

  const q = searchQuery.trim().toLowerCase();

  const filteredAttempts = useMemo(() => {
    return attempts.filter((a) => {
      if (scenarioFilter !== "all" && a.scenario !== scenarioFilter) {
        return false;
      }
      if (!q) return true;
      const scenarioTitle = (scenarioTitleMap.get(a.scenario) ?? "").toLowerCase();
      const keywordsJoined = (a.keywords_used ?? []).join(" ").toLowerCase();
      return (
        a.transcript.toLowerCase().includes(q) ||
        keywordsJoined.includes(q) ||
        a.scenario.toLowerCase().includes(q) ||
        scenarioTitle.includes(q) ||
        (a.role ?? "").toLowerCase().includes(q)
      );
    });
  }, [attempts, q, scenarioFilter, scenarioTitleMap]);

  const filteredArenaRuns = useMemo(() => {
    return arenaRuns.filter((run) => {
      if (gameFilter !== "all" && run.game_id !== gameFilter) {
        return false;
      }
      if (!q) return true;
      const gameLabel = (GAME_LABELS[run.game_id] ?? run.game_id).toLowerCase();
      return (
        run.game_id.toLowerCase().includes(q) ||
        gameLabel.includes(q) ||
        (run.role ?? "").toLowerCase().includes(q) ||
        String(run.score).includes(q)
      );
    });
  }, [arenaRuns, gameFilter, q]);

  const handleExportCsv = () => {
    const expAttempts = view === "arena" ? [] : filteredAttempts;
    const expArena = view === "practice" ? [] : filteredArenaRuns;
    downloadResearchCsv(expAttempts, expArena, weakPoints);
  };

  const handleExportJson = () => {
    const expAttempts = view === "arena" ? [] : filteredAttempts;
    const expArena = view === "practice" ? [] : filteredArenaRuns;
    downloadResearchJson(
      {
        exportedAt: new Date().toISOString(),
        filters: { view, searchQuery, scenarioFilter, gameFilter },
        attempts: expAttempts,
        arenaRuns: expArena,
        weakPoints,
      },
      "speakit_logs"
    );
  };

  const hasVisibleRows =
    (view !== "arena" && filteredAttempts.length > 0) ||
    (view !== "practice" && filteredArenaRuns.length > 0) ||
    weakPoints.length > 0;

  return (
    <div className="space-y-6">
      {/* Filter & Export Controls */}
      <div className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                {
                  id: "all",
                  label: `Tất cả (${filteredAttempts.length + filteredArenaRuns.length})`,
                },
                {
                  id: "practice",
                  label: `Luyện nói (${filteredAttempts.length})`,
                },
                {
                  id: "arena",
                  label: `Arena Games (${filteredArenaRuns.length})`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id)}
                className={`px-3.5 py-1.5 rounded-pill text-xs font-mono font-medium border transition-colors ${
                  view === tab.id
                    ? "bg-ink text-white border-ink"
                    : "bg-paper text-ink border-ink/15 hover:bg-paper-muted"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={!hasVisibleRows}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-pill bg-ink text-white text-xs font-mono font-semibold hover:bg-ink/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Xuất CSV</span>
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              disabled={!hasVisibleRows}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-pill bg-white border border-ink/20 text-xs font-mono font-semibold text-ink hover:bg-paper-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileJson className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
              <span>Xuất JSON</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search
              className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm transcript, từ khóa, vai trò..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-paper border border-ink/20 rounded-xl text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent"
            />
          </div>

          {view !== "arena" && (
            <div className="relative flex items-center">
              <Filter
                className="w-3.5 h-3.5 text-ink-muted absolute left-3.5 pointer-events-none"
                aria-hidden="true"
              />
              <select
                aria-label="Lọc theo kịch bản"
                value={scenarioFilter}
                onChange={(e) => setScenarioFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-paper border border-ink/20 rounded-xl text-ink focus:outline-none focus:border-accent"
              >
                <option value="all">Tất cả kịch bản</option>
                {scenarioOptions.map((sid) => (
                  <option key={sid} value={sid}>
                    {scenarioTitleMap.get(sid) ?? sid}
                  </option>
                ))}
              </select>
            </div>
          )}

          {view !== "practice" && (
            <div className="relative flex items-center">
              <Filter
                className="w-3.5 h-3.5 text-ink-muted absolute left-3.5 pointer-events-none"
                aria-hidden="true"
              />
              <select
                aria-label="Lọc theo Arena Game"
                value={gameFilter}
                onChange={(e) => setGameFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-paper border border-ink/20 rounded-xl text-ink focus:outline-none focus:border-accent"
              >
                <option value="all">Tất cả Arena Games</option>
                <option value="bug-buster">Bug Buster</option>
                <option value="standup-speed-run">Standup Speed Run</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Practice Attempts Table */}
      {view !== "arena" && (
        <section className="bg-white border border-ink/15 rounded-2xl shadow-soft overflow-hidden">
          <div className="px-5 py-4 border-b border-ink/10 flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink">
              Nhật ký Lượt Luyện Nói ({filteredAttempts.length})
            </h3>
            <span className="text-[11px] font-mono text-ink-muted">
              Mới nhất xếp trước
            </span>
          </div>

          {filteredAttempts.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-muted">
              Không có lượt luyện nói nào khớp bộ lọc hiện tại.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-paper border-b border-ink/10 font-mono text-[11px] text-ink-muted uppercase">
                    <th className="py-3 px-4">Thời gian</th>
                    <th className="py-3 px-4">Kịch bản / Lượt</th>
                    <th className="py-3 px-4">Vai trò</th>
                    <th className="py-3 px-4">Điểm</th>
                    <th className="py-3 px-4">Từ khóa đạt</th>
                    <th className="py-3 px-4 min-w-[260px]">Transcript</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10">
                  {filteredAttempts.map((attempt) => (
                    <tr key={attempt.id} className="hover:bg-paper/50 align-top">
                      <td className="py-3 px-4 font-mono text-[11px] text-ink-muted whitespace-nowrap">
                        {formatDateTimeVI(attempt.created_at)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-ink">
                          {scenarioTitleMap.get(attempt.scenario) ?? attempt.scenario}
                        </div>
                        <div className="font-mono text-[11px] text-ink-faint">
                          Lượt {attempt.turn_index + 1}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-ink-muted whitespace-nowrap">
                        {attempt.role ? (ROLE_LABELS[attempt.role] ?? attempt.role) : "—"}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-ink whitespace-nowrap">
                        <span
                          className={
                            attempt.score >= 70 ? "text-ink" : "text-accent"
                          }
                        >
                          {attempt.score}/100
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {attempt.keywords_used.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {attempt.keywords_used.map((kw, idx) => (
                              <span
                                key={`${kw}-${idx}`}
                                className="px-2 py-0.5 rounded-pill bg-paper border border-ink/15 font-mono text-[10px] text-ink"
                              >
                                {kw}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-ink-faint font-mono text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-ink leading-relaxed">
                        {attempt.transcript}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Arena Runs Table */}
      {view !== "practice" && (
        <section className="bg-white border border-ink/15 rounded-2xl shadow-soft overflow-hidden">
          <div className="px-5 py-4 border-b border-ink/10 flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink">
              Nhật ký Arena Minigames ({filteredArenaRuns.length})
            </h3>
            <span className="text-[11px] font-mono text-ink-muted">
              Bug Buster &amp; Standup Speed Run
            </span>
          </div>

          {filteredArenaRuns.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-muted">
              Không có lượt chơi Arena nào khớp bộ lọc hiện tại.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-paper border-b border-ink/10 font-mono text-[11px] text-ink-muted uppercase">
                    <th className="py-3 px-4">Thời gian</th>
                    <th className="py-3 px-4">Minigame</th>
                    <th className="py-3 px-4">Vai trò</th>
                    <th className="py-3 px-4">Điểm</th>
                    <th className="py-3 px-4">Bug / Từ khóa</th>
                    <th className="py-3 px-4">Thời lượng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10">
                  {filteredArenaRuns.map((run) => (
                    <tr key={run.id} className="hover:bg-paper/50">
                      <td className="py-3 px-4 font-mono text-[11px] text-ink-muted whitespace-nowrap">
                        {formatDateTimeVI(run.created_at)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-ink">
                        {GAME_LABELS[run.game_id] ?? run.game_id}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-ink-muted">
                        {run.role ? (ROLE_LABELS[run.role] ?? run.role) : "—"}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-accent">
                        {run.score} pts
                      </td>
                      <td className="py-3 px-4 font-mono text-ink">
                        {run.game_id === "bug-buster"
                          ? `${run.accuracy_or_words} bug`
                          : `${run.accuracy_or_words} từ`}
                      </td>
                      <td className="py-3 px-4 font-mono text-ink-muted">
                        {run.duration_sec}s
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

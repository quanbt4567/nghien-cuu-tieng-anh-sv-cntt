"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileJson, Filter, Search } from "lucide-react";
import { SCENARIOS } from "../../data/scenarios";
import { mergeScenarios } from "../../lib/contentStore";
import { AdminUserAvatar } from "./AdminUserAvatar";
import {
  EXTRA_SCENARIO_LABELS,
  ROLE_LABELS,
  downloadResearchCsv,
  downloadResearchJson,
  formatArenaGameLabel,
  formatDateTimeVI,
  type MergedAdminData,
} from "./adminShared";

interface AdminLogsTabProps {
  data: MergedAdminData;
}

type LogView = "all" | "practice" | "arena";

const LOGS_PAGE_SIZE = 15;
const TRANSCRIPT_PREVIEW_LEN = 140;

const KNOWN_ARENA_GAMES = [
  "bug-buster",
  "standup-speed-run",
  "arena:word-chain",
  "arena:duel",
  "arena:taboo",
  "arena:party",
];

function PlayerCell({
  playerName,
  transferCode,
  avatarUrl,
}: {
  playerName?: string | null;
  transferCode?: string | null;
  avatarUrl?: string | null;
}) {
  const name = playerName?.trim();
  const code = transferCode?.trim();
  if (!name && !code) {
    return (
      <div className="flex items-center gap-2">
        <AdminUserAvatar name="Ẩn danh" avatarUrl={avatarUrl} size="sm" />
        <span className="font-mono text-xs text-slate-600 dark:text-slate-400">Ẩn danh</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2.5">
      <AdminUserAvatar name={name || "Ẩn danh"} avatarUrl={avatarUrl} size="sm" />
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
          {name || "Ẩn danh"}
        </span>
        {code && (
          <span className="inline-flex w-fit px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 font-mono text-[11px] text-blue-700 dark:text-blue-300">
            {code}
          </span>
        )}
      </div>
    </div>
  );
}

function PaginationBar({
  page,
  totalPages,
  totalItems,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (next: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs font-mono">
      <span className="text-slate-600 dark:text-slate-400 tabular-nums">
        Trang {page} / {totalPages} ({totalItems} dòng)
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Trang trước"
          className="liquid-glass-btn inline-flex items-center gap-1 px-2.5 py-1 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Trước</span>
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Trang sau"
          className="liquid-glass-btn inline-flex items-center gap-1 px-2.5 py-1 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span>Sau</span>
          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function AdminLogsTab({ data }: AdminLogsTabProps) {
  const { attempts, arenaRuns, weakPoints, overrides } = data;

  const [view, setView] = useState<LogView>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [scenarioFilter, setScenarioFilter] = useState<string>("all");
  const [gameFilter, setGameFilter] = useState<string>("all");
  const [practicePage, setPracticePage] = useState(1);
  const [arenaPage, setArenaPage] = useState(1);
  const [expandedTranscriptIds, setExpandedTranscriptIds] = useState<Set<string>>(new Set());

  const scenarioTitleMap = useMemo(() => {
    const map = new Map<string, string>(Object.entries(EXTRA_SCENARIO_LABELS));
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

  const gameOptions = useMemo(() => {
    const ids = new Set<string>(KNOWN_ARENA_GAMES);
    for (const run of arenaRuns) {
      if (run.game_id) ids.add(run.game_id);
    }
    return Array.from(ids);
  }, [arenaRuns]);

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
        (a.role ?? "").toLowerCase().includes(q) ||
        (a.playerName ?? "").toLowerCase().includes(q) ||
        (a.transferCode ?? "").toLowerCase().includes(q)
      );
    });
  }, [attempts, q, scenarioFilter, scenarioTitleMap]);

  const filteredArenaRuns = useMemo(() => {
    return arenaRuns.filter((run) => {
      if (gameFilter !== "all") {
        if (gameFilter === "party:*") {
          if (!run.game_id.startsWith("party:")) return false;
        } else if (run.game_id !== gameFilter) {
          return false;
        }
      }
      if (!q) return true;
      const gameLabel = formatArenaGameLabel(run.game_id).toLowerCase();
      return (
        run.game_id.toLowerCase().includes(q) ||
        gameLabel.includes(q) ||
        (run.role ?? "").toLowerCase().includes(q) ||
        (run.playerName ?? "").toLowerCase().includes(q) ||
        (run.transferCode ?? "").toLowerCase().includes(q) ||
        String(run.score).includes(q)
      );
    });
  }, [arenaRuns, gameFilter, q]);

  const practiceTotalPages = Math.max(1, Math.ceil(filteredAttempts.length / LOGS_PAGE_SIZE));
  const safePracticePage = Math.min(practicePage, practiceTotalPages);
  const pagedAttempts = useMemo(
    () =>
      filteredAttempts.slice(
        (safePracticePage - 1) * LOGS_PAGE_SIZE,
        safePracticePage * LOGS_PAGE_SIZE
      ),
    [filteredAttempts, safePracticePage]
  );

  const arenaTotalPages = Math.max(1, Math.ceil(filteredArenaRuns.length / LOGS_PAGE_SIZE));
  const safeArenaPage = Math.min(arenaPage, arenaTotalPages);
  const pagedArenaRuns = useMemo(
    () =>
      filteredArenaRuns.slice(
        (safeArenaPage - 1) * LOGS_PAGE_SIZE,
        safeArenaPage * LOGS_PAGE_SIZE
      ),
    [filteredArenaRuns, safeArenaPage]
  );

  const toggleTranscript = (id: string) => {
    setExpandedTranscriptIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

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
      <div className="liquid-glass-card p-5 space-y-4">
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
                className={`px-3.5 py-1.5 rounded-full text-xs font-mono font-medium border transition-colors ${
                  view === tab.id
                    ? "bg-blue-50 dark:bg-blue-950/50 border-blue-700 dark:border-blue-500 text-blue-700 dark:text-blue-300"
                    : "liquid-glass-btn text-slate-700 dark:text-slate-300"
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
              className="liquid-btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Xuất CSV</span>
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              disabled={!hasVisibleRows}
              className="liquid-glass-btn inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileJson className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" aria-hidden="true" />
              <span>Xuất JSON</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search
              className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              name="logsSearch"
              type="search"
              autoComplete="off"
              aria-label="Tìm kiếm nhật ký luyện tập"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPracticePage(1);
                setArenaPage(1);
              }}
              placeholder="Tìm tên người dùng, mã, transcript, từ khóa, vai trò…"
              className="liquid-glass-input w-full pl-9 pr-3 py-2 text-xs rounded-lg"
            />
          </div>

          {view !== "arena" && (
            <div className="relative flex items-center">
              <Filter
                className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 absolute left-3.5 pointer-events-none"
                aria-hidden="true"
              />
              <select
                aria-label="Lọc theo kịch bản"
                value={scenarioFilter}
                onChange={(e) => {
                  setScenarioFilter(e.target.value);
                  setPracticePage(1);
                }}
                className="liquid-glass-input w-full pl-9 pr-3 py-2 text-xs font-mono rounded-lg [&>option]:bg-white dark:[&>option]:bg-slate-900 [&>option]:text-slate-900 dark:[&>option]:text-slate-100"
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
                className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 absolute left-3.5 pointer-events-none"
                aria-hidden="true"
              />
              <select
                aria-label="Lọc theo Arena Game"
                value={gameFilter}
                onChange={(e) => {
                  setGameFilter(e.target.value);
                  setArenaPage(1);
                }}
                className="liquid-glass-input w-full pl-9 pr-3 py-2 text-xs font-mono rounded-lg [&>option]:bg-white dark:[&>option]:bg-slate-900 [&>option]:text-slate-900 dark:[&>option]:text-slate-100"
              >
                <option value="all">Tất cả Arena Games</option>
                <option value="party:*">Tất cả phòng Outage At 3AM (party:*)</option>
                {gameOptions.map((gid) => (
                  <option key={gid} value={gid}>
                    {formatArenaGameLabel(gid)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {view !== "arena" && (
        <section className="liquid-glass-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Nhật ký Lượt Luyện Nói ({filteredAttempts.length})
            </h3>
            <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
              Mới nhất xếp trước
            </span>
          </div>

          {filteredAttempts.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-700 dark:text-slate-300">
              Không có lượt luyện nói nào khớp bộ lọc hiện tại.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-700 dark:text-slate-300 uppercase">
                      <th className="py-3 px-4">Thời gian</th>
                      <th className="py-3 px-4">Người dùng</th>
                      <th className="py-3 px-4">Kịch bản / Lượt</th>
                      <th className="py-3 px-4">Vai trò</th>
                      <th className="py-3 px-4">Điểm</th>
                      <th className="py-3 px-4">Từ khóa đạt</th>
                      <th className="py-3 px-4 min-w-[260px]">Transcript</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {pagedAttempts.map((attempt) => {
                      const isLong = attempt.transcript.length > TRANSCRIPT_PREVIEW_LEN;
                      const isExpanded = expandedTranscriptIds.has(attempt.id);
                      const displayTranscript =
                        isLong && !isExpanded
                          ? `${attempt.transcript.slice(0, TRANSCRIPT_PREVIEW_LEN)}…`
                          : attempt.transcript;
                      return (
                        <tr key={attempt.id} className="hover:bg-blue-50/50 dark:hover:bg-slate-800/60 align-top">
                          <td className="py-3 px-4 font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {formatDateTimeVI(attempt.created_at)}
                          </td>
                          <td className="py-3 px-4">
                            <PlayerCell
                              playerName={attempt.playerName}
                              transferCode={attempt.transferCode}
                              avatarUrl={attempt.avatarUrl}
                            />
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {scenarioTitleMap.get(attempt.scenario) ?? attempt.scenario}
                            </div>
                            <div className="font-mono text-xs text-slate-600 dark:text-slate-400">
                              Lượt {attempt.turn_index + 1}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {attempt.role ? (ROLE_LABELS[attempt.role] ?? attempt.role) : "--"}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold whitespace-nowrap">
                            <span
                              className={
                                attempt.score >= 70 ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"
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
                                    className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 font-mono text-[11px] text-blue-700 dark:text-blue-300"
                                  >
                                    {kw}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-500 dark:text-slate-400 font-mono text-xs">--</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-900 dark:text-slate-100 leading-relaxed">
                            <p className="whitespace-pre-wrap break-words">{displayTranscript}</p>
                            {isLong && (
                              <button
                                type="button"
                                onClick={() => toggleTranscript(attempt.id)}
                                className="mt-1 text-xs font-mono font-semibold text-blue-700 dark:text-blue-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:focus-visible:ring-blue-400 rounded"
                              >
                                {isExpanded ? "Thu gọn" : "Xem đầy đủ"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <PaginationBar
                page={safePracticePage}
                totalPages={practiceTotalPages}
                totalItems={filteredAttempts.length}
                onPageChange={setPracticePage}
              />
            </>
          )}
        </section>
      )}

      {view !== "practice" && (
        <section className="liquid-glass-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Nhật ký Arena Minigames ({filteredArenaRuns.length})
            </h3>
            <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
              Bug Buster, Standup, Duel, Taboo, Word Chain &amp; Party
            </span>
          </div>

          {filteredArenaRuns.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-700 dark:text-slate-300">
              Không có lượt chơi Arena nào khớp bộ lọc hiện tại.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-700 dark:text-slate-300 uppercase">
                      <th className="py-3 px-4">Thời gian</th>
                      <th className="py-3 px-4">Người dùng</th>
                      <th className="py-3 px-4">Minigame</th>
                      <th className="py-3 px-4">Vai trò</th>
                      <th className="py-3 px-4">Điểm</th>
                      <th className="py-3 px-4">Bug / Từ khóa / Tiến độ</th>
                      <th className="py-3 px-4">Thời lượng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {pagedArenaRuns.map((run) => (
                      <tr key={run.id} className="hover:bg-blue-50/50 dark:hover:bg-slate-800/60 align-top">
                        <td className="py-3 px-4 font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {formatDateTimeVI(run.created_at)}
                        </td>
                        <td className="py-3 px-4">
                          <PlayerCell
                            playerName={run.playerName}
                            transferCode={run.transferCode}
                            avatarUrl={run.avatarUrl}
                          />
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                          {formatArenaGameLabel(run.game_id)}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-700 dark:text-slate-300">
                          {run.role ? (ROLE_LABELS[run.role] ?? run.role) : "--"}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-blue-700 dark:text-blue-400 tabular-nums">
                          {run.score} pts
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-900 dark:text-slate-100 tabular-nums">
                          {run.game_id === "bug-buster"
                            ? `${run.accuracy_or_words} bug`
                            : run.game_id.startsWith("party:")
                              ? `${run.accuracy_or_words}%`
                              : `${run.accuracy_or_words} từ`}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                          {run.duration_sec}s
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationBar
                page={safeArenaPage}
                totalPages={arenaTotalPages}
                totalItems={filteredArenaRuns.length}
                onPageChange={setArenaPage}
              />
            </>
          )}
        </section>
      )}
    </div>
  );
}

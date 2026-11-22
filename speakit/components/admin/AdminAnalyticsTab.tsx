"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  Award,
  BarChart3,
  Download,
  FileJson,
  Gamepad2,
  MessageSquare,
} from "lucide-react";
import { SCENARIOS } from "../../data/scenarios";
import { mergeScenarios } from "../../lib/contentStore";
import {
  ROLE_LABELS,
  downloadResearchCsv,
  downloadResearchJson,
  type MergedAdminData,
} from "./adminShared";

interface AdminAnalyticsTabProps {
  data: MergedAdminData;
}

export function AdminAnalyticsTab({ data }: AdminAnalyticsTabProps) {
  const { stats, weakPoints, attempts, arenaRuns, overrides } = data;

  const scenarioMap = useMemo(() => {
    const allScenarios = mergeScenarios(SCENARIOS, overrides, true);
    const map = new Map<string, { titleVI: string; isHidden?: boolean }>();
    for (const s of allScenarios) {
      map.set(s.id, { titleVI: s.titleVI, isHidden: s.isHidden });
    }
    return map;
  }, [overrides]);

  const scenarioRows = useMemo(() => {
    const byId = new Map(stats.scenarioBreakdown.map((row) => [row.scenario, row]));
    const rows: Array<{
      id: string;
      label: string;
      count: number;
      avgScore: number;
      isHidden?: boolean;
    }> = [];

    for (const [id, meta] of Array.from(scenarioMap.entries())) {
      const hit = byId.get(id);
      rows.push({
        id,
        label: meta.titleVI,
        count: hit?.count ?? 0,
        avgScore: hit?.avgScore ?? 0,
        isHidden: meta.isHidden,
      });
    }

    for (const hit of stats.scenarioBreakdown) {
      if (!scenarioMap.has(hit.scenario)) {
        rows.push({
          id: hit.scenario,
          label: hit.scenario,
          count: hit.count,
          avgScore: hit.avgScore,
        });
      }
    }

    return rows.sort((a, b) => b.count - a.count);
  }, [scenarioMap, stats.scenarioBreakdown]);

  const maxScenarioAttempts = useMemo(
    () => Math.max(1, ...scenarioRows.map((r) => r.count)),
    [scenarioRows]
  );

  const topWeakPoints = useMemo(() => weakPoints.slice(0, 12), [weakPoints]);
  const maxMissCount = useMemo(
    () => Math.max(1, ...topWeakPoints.map((w) => w.miss_count)),
    [topWeakPoints]
  );

  const roleEntries = useMemo(
    () =>
      Object.entries(stats.roleBreakdown)
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1]),
    [stats.roleBreakdown]
  );

  const handleExportJson = () => {
    downloadResearchJson({
      project: "SpeakIT — IUH & BCN Research Telemetry",
      exportedAt: new Date().toISOString(),
      source: "SpeakIT Admin",
      stats,
      weakPoints,
      attempts,
      arenaRuns,
    });
  };

  const hasExportableData =
    attempts.length > 0 || arenaRuns.length > 0 || weakPoints.length > 0;

  return (
    <div className="space-y-6">
      <div className="liquid-glass-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-white">
            Tổng hợp dữ liệu luyện tập &amp; nghiên cứu
          </h2>
          <p className="text-xs text-slate-300">
            Toàn bộ chỉ số bên dưới tổng hợp trực tiếp từ nhật ký luyện tập thực tế (không dùng dữ liệu giả lập).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => downloadResearchCsv(attempts, arenaRuns, weakPoints)}
            disabled={!hasExportableData}
            className="liquid-btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-mono font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Xuất CSV (Excel UTF-8)</span>
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            disabled={!hasExportableData}
            className="liquid-glass-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-mono font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileJson className="w-3.5 h-3.5 text-cyan-300" aria-hidden="true" />
            <span>Xuất JSON</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="liquid-glass-card p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-xs font-medium">Tổng lượt luyện nói</span>
            <MessageSquare className="w-4 h-4 text-cyan-300" aria-hidden="true" />
          </div>
          <div className="text-3xl font-bold font-mono text-white">
            {stats.totalAttempts}
          </div>
          <div className="text-[11px] text-slate-400">
            Trên {stats.activeScenariosCount} kịch bản đang bật
          </div>
        </div>

        <div className="liquid-glass-card p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-xs font-medium">Điểm trung bình</span>
            <Award className="w-4 h-4 text-amber-300" aria-hidden="true" />
          </div>
          <div className="text-3xl font-bold font-mono text-white">
            {stats.totalAttempts > 0 ? `${stats.avgScore}` : "0"}
            <span className="text-base font-normal text-slate-400">/100</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Tính trên tổng lượt đã chấm điểm
          </div>
        </div>

        <div className="liquid-glass-card p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-xs font-medium">Tổng lượt Arena</span>
            <Gamepad2 className="w-4 h-4 text-emerald-300" aria-hidden="true" />
          </div>
          <div className="text-3xl font-bold font-mono text-white">
            {stats.totalArenaRuns}
          </div>
          <div className="text-[11px] text-slate-400">
            Bug Buster &amp; Standup Speed Run
          </div>
        </div>

        <div className="liquid-glass-card p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-xs font-medium">Điểm yếu đã ghi nhận</span>
            <AlertTriangle className="w-4 h-4 text-rose-300" aria-hidden="true" />
          </div>
          <div className="text-3xl font-bold font-mono text-white">
            {stats.totalWeakPoints}
          </div>
          <div className="text-[11px] text-slate-400">
            Từ khóa bỏ lỡ &amp; lỗi ngữ pháp
          </div>
        </div>
      </div>

      {roleEntries.length > 0 && (
        <div className="liquid-glass-card p-5 flex flex-wrap items-center gap-3">
          <span className="text-xs font-mono font-semibold uppercase text-slate-300 mr-1">
            Phân bố theo vai trò CNTT:
          </span>
          {roleEntries.map(([role, count]) => (
            <span
              key={role}
              className="liquid-glass-pill inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono text-slate-100"
            >
              <span>{ROLE_LABELS[role] ?? role}</span>
              <span className="font-bold text-cyan-300">{count}</span>
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="liquid-glass-card p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-300" aria-hidden="true" />
              <span>Thống kê theo Kịch bản</span>
            </h2>
            <span className="text-[11px] font-mono text-slate-400">
              Lượt &amp; Điểm TB
            </span>
          </div>

          {scenarioRows.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              Chưa có kịch bản nào được ghi nhận.
            </p>
          ) : (
            <div className="space-y-4">
              {scenarioRows.map((row) => {
                const countPct =
                  row.count > 0
                    ? Math.max(6, Math.round((row.count / maxScenarioAttempts) * 100))
                    : 0;
                return (
                  <div key={row.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-white truncate">
                          {row.label}
                        </span>
                        {row.isHidden && (
                          <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-mono text-slate-300 shrink-0">
                            Đang ẩn
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-slate-300 shrink-0">
                        <span className="font-semibold text-white">{row.count}</span> lượt
                        {" • "}
                        <span className="font-semibold text-cyan-300">
                          {row.count > 0 ? `${row.avgScore}/100` : "—"}
                        </span>
                      </div>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-slate-950/60 border border-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all"
                        style={{ width: `${countPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="liquid-glass-card p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-300" aria-hidden="true" />
              <span>Top Điểm Yếu Sinh Viên</span>
            </h2>
            <span className="text-[11px] font-mono text-slate-400">
              Xếp theo miss_count
            </span>
          </div>

          {topWeakPoints.length === 0 ? (
            <div className="bg-slate-950/55 border border-white/15 rounded-xl p-6 text-center text-xs text-slate-300">
              Chưa có dữ liệu điểm yếu nào được ghi nhận. Khi người dùng hoàn thành lượt luyện nói, các từ khóa bỏ lỡ và lỗi ngữ pháp sẽ tổng hợp tại đây.
            </div>
          ) : (
            <div className="space-y-3">
              {topWeakPoints.map((wp, index) => {
                const barWidth = Math.max(
                  8,
                  Math.round((wp.miss_count / maxMissCount) * 100)
                );
                return (
                  <div
                    key={wp.id || `${wp.kind}:${wp.value}`}
                    className="p-3 rounded-xl bg-slate-950/55 border border-white/15 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[11px] text-slate-400 w-5">
                          #{index + 1}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border shrink-0 ${
                            wp.kind === "grammar"
                              ? "bg-rose-500/20 border-rose-400/40 text-rose-200"
                              : "bg-cyan-500/20 border-cyan-400/40 text-cyan-200"
                          }`}
                        >
                          {wp.kind === "grammar" ? "Ngữ pháp" : "Từ khóa"}
                        </span>
                        <span className="font-mono font-semibold text-white truncate">
                          {wp.value}
                        </span>
                      </div>
                      <span className="font-mono text-xs font-bold text-rose-300 shrink-0">
                        {wp.miss_count} lần
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/10 border border-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-rose-400 to-amber-400"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

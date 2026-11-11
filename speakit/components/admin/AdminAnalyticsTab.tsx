"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  Award,
  BarChart3,
  Cloud,
  Download,
  FileJson,
  Gamepad2,
  HardDrive,
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
  const { stats, weakPoints, attempts, arenaRuns, overrides, health, localExtrasCount } = data;

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

    // Include archived/deleted custom scenario IDs that still have logged attempts
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
      source: health.neonConnected ? "Neon Cloud DB" : "Local Cache",
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
      {/* Source Status & Research Export Bar */}
      <div className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-pill text-xs font-mono font-semibold border ${
                health.neonConnected
                  ? "bg-paper text-ink border-ink/20"
                  : "bg-accent-light text-ink border-accent/40"
              }`}
            >
              {health.neonConnected ? (
                <Cloud className="w-3.5 h-3.5 text-ink" aria-hidden="true" />
              ) : (
                <HardDrive className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
              )}
              <span>
                Nguồn dữ liệu: {health.neonConnected ? "Neon Cloud DB" : "Local Cache"}
              </span>
            </span>
            {health.neonConnected && localExtrasCount > 0 && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-pill bg-paper-muted border border-ink/15 text-[11px] font-mono text-ink-muted">
                +{localExtrasCount} bản ghi trình duyệt chưa đồng bộ
              </span>
            )}
          </div>
          <p className="text-xs text-ink-muted">
            Toàn bộ chỉ số bên dưới tổng hợp trực tiếp từ nhật ký luyện tập thực tế (không dùng dữ liệu giả lập).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => downloadResearchCsv(attempts, arenaRuns, weakPoints)}
            disabled={!hasExportableData}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-ink text-white text-xs font-mono font-semibold hover:bg-ink/90 shadow-soft shadow-hard-press transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Xuất CSV (Excel UTF-8)</span>
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            disabled={!hasExportableData}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-white border border-ink/20 text-xs font-mono font-semibold text-ink hover:bg-paper-muted shadow-soft shadow-hard-press transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileJson className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
            <span>Xuất JSON</span>
          </button>
        </div>
      </div>

      {/* Overview KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft space-y-2">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-medium">Tổng lượt luyện nói</span>
            <MessageSquare className="w-4 h-4 text-ink-muted" aria-hidden="true" />
          </div>
          <div className="text-3xl font-bold font-mono text-ink">
            {stats.totalAttempts}
          </div>
          <div className="text-[11px] text-ink-faint">
            Trên {stats.activeScenariosCount} kịch bản đang bật
          </div>
        </div>

        <div className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft space-y-2">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-medium">Điểm trung bình</span>
            <Award className="w-4 h-4 text-accent" aria-hidden="true" />
          </div>
          <div className="text-3xl font-bold font-mono text-ink">
            {stats.totalAttempts > 0 ? `${stats.avgScore}` : "0"}
            <span className="text-base font-normal text-ink-muted">/100</span>
          </div>
          <div className="text-[11px] text-ink-faint">
            Tính trên tổng lượt đã chấm điểm
          </div>
        </div>

        <div className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft space-y-2">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-medium">Tổng lượt Arena</span>
            <Gamepad2 className="w-4 h-4 text-ink-muted" aria-hidden="true" />
          </div>
          <div className="text-3xl font-bold font-mono text-ink">
            {stats.totalArenaRuns}
          </div>
          <div className="text-[11px] text-ink-faint">
            Bug Buster &amp; Standup Speed Run
          </div>
        </div>

        <div className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft space-y-2">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-medium">Điểm yếu đã ghi nhận</span>
            <AlertTriangle className="w-4 h-4 text-accent" aria-hidden="true" />
          </div>
          <div className="text-3xl font-bold font-mono text-ink">
            {stats.totalWeakPoints}
          </div>
          <div className="text-[11px] text-ink-faint">
            Từ khóa bỏ lỡ &amp; lỗi ngữ pháp
          </div>
        </div>
      </div>

      {/* Role distribution if available */}
      {roleEntries.length > 0 && (
        <div className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft flex flex-wrap items-center gap-3">
          <span className="text-xs font-mono font-semibold uppercase text-ink-muted mr-1">
            Phân bố theo vai trò CNTT:
          </span>
          {roleEntries.map(([role, count]) => (
            <span
              key={role}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-paper border border-ink/15 text-xs font-mono text-ink"
            >
              <span>{ROLE_LABELS[role] ?? role}</span>
              <span className="font-bold text-accent">{count}</span>
            </span>
          ))}
        </div>
      )}

      {/* Main 2-column Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Scenario Breakdown */}
        <section className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-ink flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-accent" aria-hidden="true" />
              <span>Thống kê theo Kịch bản</span>
            </h2>
            <span className="text-[11px] font-mono text-ink-muted">
              Lượt &amp; Điểm TB
            </span>
          </div>

          {scenarioRows.length === 0 ? (
            <p className="text-xs text-ink-muted py-6 text-center">
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
                        <span className="font-semibold text-ink truncate">
                          {row.label}
                        </span>
                        {row.isHidden && (
                          <span className="px-2 py-0.5 rounded-pill bg-paper-muted border border-ink/15 text-[10px] font-mono text-ink-muted shrink-0">
                            Đang ẩn
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-ink-muted shrink-0">
                        <span className="font-semibold text-ink">{row.count}</span> lượt
                        {" • "}
                        <span className="font-semibold text-accent">
                          {row.count > 0 ? `${row.avgScore}/100` : "—"}
                        </span>
                      </div>
                    </div>
                    <div className="h-2.5 w-full rounded-pill bg-paper-muted border border-ink/10 overflow-hidden">
                      <div
                        className="h-full rounded-pill bg-ink transition-all"
                        style={{ width: `${countPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Top Weak Points */}
        <section className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-ink flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-accent" aria-hidden="true" />
              <span>Top Điểm Yếu Sinh Viên</span>
            </h2>
            <span className="text-[11px] font-mono text-ink-muted">
              Xếp theo miss_count
            </span>
          </div>

          {topWeakPoints.length === 0 ? (
            <div className="bg-paper border border-ink/10 rounded-xl p-6 text-center text-xs text-ink-muted">
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
                    className="p-3 rounded-xl bg-paper border border-ink/10 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[11px] text-ink-faint w-5">
                          #{index + 1}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-pill text-[10px] font-mono font-semibold border shrink-0 ${
                            wp.kind === "grammar"
                              ? "bg-accent-light border-accent/30 text-ink"
                              : "bg-white border-ink/15 text-ink-muted"
                          }`}
                        >
                          {wp.kind === "grammar" ? "Ngữ pháp" : "Từ khóa"}
                        </span>
                        <span className="font-mono font-semibold text-ink truncate">
                          {wp.value}
                        </span>
                      </div>
                      <span className="font-mono text-xs font-bold text-accent shrink-0">
                        {wp.miss_count} lần
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-pill bg-white border border-ink/10 overflow-hidden">
                      <div
                        className="h-full rounded-pill bg-accent"
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

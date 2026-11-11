"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Cloud,
  FileSpreadsheet,
  Gamepad2,
  HardDrive,
  Lock,
  MessageSquareText,
  RefreshCw,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { SCENARIOS } from "../../data/scenarios";
import { mergeScenarios } from "../../lib/contentStore";
import type { AdminContentOverrides } from "../../lib/types";
import { AdminAnalyticsTab } from "./AdminAnalyticsTab";
import { AdminArenaTab } from "./AdminArenaTab";
import { useAdminAuth } from "./AdminLoginGate";
import { AdminLogsTab } from "./AdminLogsTab";
import { AdminScenariosTab } from "./AdminScenariosTab";
import { AdminSystemTab } from "./AdminSystemTab";
import { AdminVocabTab } from "./AdminVocabTab";
import {
  loadMergedAdminData,
  type AdminDashboardResponse,
  type MergedAdminData,
} from "./adminShared";

type AdminTabId =
  | "analytics"
  | "scenarios"
  | "vocab"
  | "arena"
  | "logs"
  | "system";

const TABS: Array<{
  id: AdminTabId;
  label: string;
  icon: typeof BarChart3;
}> = [
  { id: "analytics", label: "Tổng quan", icon: BarChart3 },
  { id: "scenarios", label: "Kịch bản", icon: MessageSquareText },
  { id: "vocab", label: "Từ vựng", icon: BookOpen },
  { id: "arena", label: "Arena Games", icon: Gamepad2 },
  { id: "logs", label: "Nhật ký & Xuất CSV", icon: FileSpreadsheet },
  { id: "system", label: "Hệ thống", icon: Settings },
];

export function AdminShell() {
  const { isDefaultPasscode, lockSession, forceLock } = useAdminAuth();

  const [activeTab, setActiveTab] = useState<AdminTabId>("analytics");
  const [data, setData] = useState<MergedAdminData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);

  const refreshDashboard = useCallback(
    async (silent = false) => {
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setLoadWarning(null);

      let remote: AdminDashboardResponse | null = null;
      try {
        const res = await fetch("/api/admin/dashboard", { cache: "no-store" });
        if (res.status === 401) {
          forceLock("Phiên quản trị đã hết hạn. Vui lòng nhập lại passcode.");
          return;
        }
        if (res.ok) {
          remote = (await res.json()) as AdminDashboardResponse;
        } else {
          setLoadWarning(
            "Không thể tải dữ liệu từ máy chủ; đang hiển thị dữ liệu Local Cache trên trình duyệt."
          );
        }
      } catch {
        setLoadWarning(
          "Mất kết nối máy chủ; đang hiển thị dữ liệu tổng hợp từ Local Cache."
        );
      }

      if (!remote) {
        remote = {
          stats: {
            totalAttempts: 0,
            avgScore: 0,
            totalArenaRuns: 0,
            activeScenariosCount: SCENARIOS.length,
            totalWeakPoints: 0,
            roleBreakdown: {},
            scenarioBreakdown: [],
          },
          attempts: [],
          weakPoints: [],
          arenaRuns: [],
          overrides: {
            customScenarios: [],
            hiddenScenarioIds: [],
            customVocabulary: [],
            deletedVocabIds: [],
            customBugChallenges: [],
            deletedChallengeIds: [],
          },
          health: {
            neonConnected: false,
            geminiConfigured: false,
            isDefaultPasscode,
          },
        };
      }

      const merged = await loadMergedAdminData(remote);
      setData(merged);
      setIsLoading(false);
      setIsRefreshing(false);
    },
    [forceLock, isDefaultPasscode]
  );

  useEffect(() => {
    void refreshDashboard(false);
  }, [refreshDashboard]);

  const handleOverridesChange = useCallback((nextOverrides: AdminContentOverrides) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        overrides: nextOverrides,
        stats: {
          ...prev.stats,
          activeScenariosCount: mergeScenarios(SCENARIOS, nextOverrides, false).length,
        },
      };
    });
  }, []);

  const neonConnected = Boolean(data?.health.neonConnected);

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      {/* Dedicated Admin Top Header */}
      <header className="sticky top-0 z-40 bg-paper border-b border-ink/15">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-ink text-white text-[11px] font-mono font-semibold uppercase tracking-wide">
              <ShieldCheck className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
              <span>ADMIN PORTAL</span>
            </span>
            <span className="text-sm sm:text-base font-bold tracking-tight text-ink">
              SpeakIT Control Center
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-[11px] font-mono font-semibold border ${
                neonConnected
                  ? "bg-white border-ink/20 text-ink"
                  : "bg-accent-light border-accent/40 text-ink"
              }`}
            >
              {neonConnected ? (
                <Cloud className="w-3 h-3 text-ink" aria-hidden="true" />
              ) : (
                <HardDrive className="w-3 h-3 text-accent" aria-hidden="true" />
              )}
              <span>{neonConnected ? "Neon Cloud DB" : "Local Cache"}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isRefreshing || isLoading}
              onClick={() => void refreshDashboard(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white border border-ink/15 text-xs font-mono font-medium text-ink hover:bg-paper-muted shadow-soft transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              <span>Làm mới</span>
            </button>

            <Link
              href="/"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-pill bg-white border border-ink/15 text-xs font-medium text-ink hover:bg-paper-muted shadow-soft transition-colors"
            >
              <span>Xem User App</span>
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>

            <button
              type="button"
              onClick={() => void lockSession()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-accent-light border border-accent/40 text-xs font-semibold text-ink hover:bg-accent hover:text-white shadow-soft transition-colors"
            >
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Khóa phiên</span>
            </button>
          </div>
        </div>

        {/* 6-Tab Workspace Bar */}
        <div className="max-w-6xl mx-auto px-4 pb-3">
          <nav
            aria-label="Thanh điều hướng Admin"
            className="flex items-center gap-2 overflow-x-auto pb-0.5"
          >
            {TABS.map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-pill border text-xs font-medium transition-all shrink-0 ${
                    isActive
                      ? "bg-ink text-white border-ink shadow-soft"
                      : "bg-white text-ink border-ink/15 hover:bg-paper-muted shadow-soft"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl w-full mx-auto px-4 py-6 sm:py-8 space-y-6 flex-1">
        {loadWarning && (
          <div
            role="status"
            className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-paper-muted border border-ink/20 text-xs text-ink"
          >
            <AlertCircle className="w-4 h-4 text-accent shrink-0 mt-0.5" aria-hidden="true" />
            <span>{loadWarning}</span>
          </div>
        )}

        {isLoading || !data ? (
          <div className="space-y-6 animate-pulse" aria-busy="true">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="h-28 bg-white border border-ink/15 rounded-2xl p-5"
                />
              ))}
            </div>
            <div className="h-72 bg-white border border-ink/15 rounded-2xl p-6" />
          </div>
        ) : (
          <>
            {activeTab === "analytics" && <AdminAnalyticsTab data={data} />}
            {activeTab === "scenarios" && (
              <AdminScenariosTab
                overrides={data.overrides}
                onOverridesChange={handleOverridesChange}
                onUnauthorized={() => forceLock()}
              />
            )}
            {activeTab === "vocab" && (
              <AdminVocabTab
                overrides={data.overrides}
                onOverridesChange={handleOverridesChange}
                onUnauthorized={() => forceLock()}
              />
            )}
            {activeTab === "arena" && (
              <AdminArenaTab
                overrides={data.overrides}
                onOverridesChange={handleOverridesChange}
                onUnauthorized={() => forceLock()}
              />
            )}
            {activeTab === "logs" && <AdminLogsTab data={data} />}
            {activeTab === "system" && (
              <AdminSystemTab
                health={data.health}
                overrides={data.overrides}
                onOverridesChange={handleOverridesChange}
                onRefreshDashboard={() => refreshDashboard(true)}
                onUnauthorized={() => forceLock()}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

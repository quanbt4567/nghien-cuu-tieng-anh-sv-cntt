"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  FileSpreadsheet,
  Gamepad2,
  Lock,
  LogOut,
  Menu,
  MessageSquareText,
  Newspaper,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { SCENARIOS } from "../../data/scenarios";
import { mergeScenarios } from "../../lib/contentStore";
import type { AdminContentOverrides } from "../../lib/types";
import { AdminAiMonitorTab } from "./AdminAiMonitorTab";
import { AdminAnalyticsTab } from "./AdminAnalyticsTab";
import { AdminArenaTab } from "./AdminArenaTab";
import { AdminCosmeticsTab } from "./AdminCosmeticsTab";
import { AdminFeedbackTab } from "./AdminFeedbackTab";
import { AdminLeavesTab } from "./AdminLeavesTab";
import { useAdminAuth } from "./AdminLoginGate";
import { AdminLogsTab } from "./AdminLogsTab";
import { AdminModerationTab } from "./AdminModerationTab";
import { AdminResearchTab } from "./AdminResearchTab";
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
  | "ai-monitor"
  | "scenarios"
  | "vocab"
  | "arena"
  | "cosmetics"
  | "research"
  | "feedback"
  | "leaves"
  | "moderation"
  | "logs"
  | "system";

const TABS: Array<{
  id: AdminTabId;
  label: string;
  icon: typeof BarChart3;
}> = [
  { id: "analytics", label: "Tổng quan", icon: BarChart3 },
  { id: "ai-monitor", label: "Giám Sát 6 API AI", icon: Activity },
  { id: "scenarios", label: "Kịch bản", icon: MessageSquareText },
  { id: "vocab", label: "Từ vựng", icon: BookOpen },
  { id: "arena", label: "Arena Games", icon: Gamepad2 },
  { id: "cosmetics", label: "Kho Hiệu Ứng", icon: Sparkles },
  { id: "research", label: "Bài báo & Nghiên cứu", icon: Newspaper },
  { id: "feedback", label: "Góp ý", icon: Star },
  { id: "leaves", label: "Thoát game", icon: LogOut },
  { id: "moderation", label: "Kiểm duyệt AI", icon: ShieldCheck },
  { id: "logs", label: "Nhật ký & Xuất CSV", icon: FileSpreadsheet },
  { id: "system", label: "Hệ thống", icon: Settings },
];

export function AdminShell() {
  const { isDefaultPasscode, lockSession, forceLock } = useAdminAuth();

  const [activeTab, setActiveTab] = useState<AdminTabId>("analytics");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
            "Không thể tải dữ liệu từ máy chủ; đang hiển thị dữ liệu lưu trên trình duyệt."
          );
        }
      } catch {
        setLoadWarning(
          "Mất kết nối máy chủ; đang hiển thị dữ liệu lưu trên trình duyệt."
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

  const activeTabMeta = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  return (
    <div className="min-h-screen bg-transparent text-slate-100 flex flex-col lg:flex-row">
      <header className="lg:hidden sticky top-0 z-30 bg-slate-950/85 backdrop-blur-2xl border-b border-white/15 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Mở menu điều hướng"
            aria-expanded={mobileMenuOpen}
            className="liquid-glass-btn inline-flex items-center justify-center w-9 h-9 rounded-full shrink-0"
          >
            <Menu className="w-4 h-4" aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-300 shrink-0" aria-hidden="true" />
              <span className="text-xs font-mono font-semibold uppercase tracking-wide text-white">
                SpeakIT Admin
              </span>
            </div>
            <p className="text-xs text-slate-300 truncate">{activeTabMeta.label}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={isRefreshing || isLoading}
            onClick={() => void refreshDashboard(true)}
            aria-label="Làm mới dữ liệu"
            className="liquid-glass-btn inline-flex items-center justify-center w-9 h-9 rounded-full disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 shrink-0 bg-slate-950/85 backdrop-blur-2xl border-r border-white/15 flex flex-col transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0 shadow-[0_16px_48px_rgba(0,0,0,0.65)]" : "-translate-x-full"
        }`}
      >
        <div className="px-4 py-3 border-b border-white/15 space-y-1.5 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/45 text-cyan-100 text-[11px] font-mono font-semibold uppercase tracking-wide">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-300" aria-hidden="true" />
              <span>ADMIN PORTAL</span>
            </span>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Đóng menu điều hướng"
              className="lg:hidden liquid-glass-btn inline-flex items-center justify-center w-8 h-8 rounded-full"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div>
            <p className="text-sm font-bold tracking-tight text-white">
              SpeakIT Control Center
            </p>
          </div>
        </div>

        <nav
          aria-label="Thanh điều hướng Admin"
          className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-3 py-2 space-y-0.5"
        >
          {TABS.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setActiveTab(id);
                  setMobileMenuOpen(false);
                }}
                aria-current={isActive ? "page" : undefined}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-full text-xs font-medium text-left transition-all border ${
                  isActive
                    ? "bg-cyan-500/25 border-cyan-400/55 text-cyan-100 shadow-[0_0_16px_rgba(6,182,212,0.22)]"
                    : "border-transparent text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-cyan-300" : "text-slate-400"}`} aria-hidden="true" />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/15 space-y-1.5 shrink-0">
          <button
            type="button"
            disabled={isRefreshing || isLoading}
            onClick={() => void refreshDashboard(true)}
            className="liquid-glass-btn w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-medium disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            <span>Làm mới dữ liệu</span>
          </button>

          <div className="grid grid-cols-2 gap-1.5">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="liquid-glass-btn inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium"
            >
              <span>Trang chủ</span>
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            </Link>

            <button
              type="button"
              onClick={() => void lockSession()}
              className="liquid-btn-danger inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold"
            >
              <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {loadWarning && (
          <div
            role="status"
            className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-500/15 border border-amber-400/40 text-xs text-amber-100"
          >
            <AlertCircle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{loadWarning}</span>
          </div>
        )}

        {isLoading || !data ? (
          <div className="space-y-6 animate-pulse" aria-busy="true">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="h-28 liquid-glass-card-lite p-5"
                />
              ))}
            </div>
            <div className="h-72 liquid-glass-card-lite p-6" />
          </div>
        ) : (
          <>
            {activeTab === "analytics" && <AdminAnalyticsTab data={data} />}
            {activeTab === "ai-monitor" && (
              <AdminAiMonitorTab onUnauthorized={() => forceLock()} />
            )}
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
            {activeTab === "cosmetics" && (
              <AdminCosmeticsTab onUnauthorized={() => forceLock()} />
            )}
            {activeTab === "research" && (
              <AdminResearchTab onUnauthorized={() => forceLock()} />
            )}
            {activeTab === "feedback" && (
              <AdminFeedbackTab onUnauthorized={() => forceLock()} />
            )}
            {activeTab === "leaves" && (
              <AdminLeavesTab onUnauthorized={() => forceLock()} />
            )}
            {activeTab === "moderation" && (
              <AdminModerationTab onUnauthorized={() => forceLock()} />
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
      </main>
    </div>
  );
}

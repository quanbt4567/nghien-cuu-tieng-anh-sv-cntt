"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  DollarSign,
  KeyRound,
  RefreshCw,
  Save,
  ShieldAlert,
  Zap,
} from "lucide-react";
import type {
  AiHealthSummary,
  AiProviderHealthItem,
  AiProviderHealthStatus,
  AiProviderPingResult,
} from "../../lib/ai-telemetry";
import type { AiProviderId } from "../../lib/types";

interface AdminAiMonitorTabProps {
  onUnauthorized: () => void;
}

interface AiHealthApiResponse extends AiHealthSummary {
  ok: boolean;
  error?: string;
  pings?: AiProviderPingResult[];
}

const PROVIDER_COLORS: Record<AiProviderId, string> = {
  cerebras: "bg-green-700",
  inception: "bg-blue-700",
  groq: "bg-amber-600",
  xkiro: "bg-slate-700",
  openrouter: "bg-red-600",
  gemini: "bg-blue-600",
};

const PROVIDER_DOT_COLORS: Record<AiProviderId, string> = {
  cerebras: "bg-green-700",
  inception: "bg-blue-700",
  groq: "bg-amber-600",
  xkiro: "bg-slate-700",
  openrouter: "bg-red-600",
  gemini: "bg-blue-600",
};

const PROVIDER_ORDER: readonly AiProviderId[] = [
  "cerebras",
  "inception",
  "groq",
  "xkiro",
  "openrouter",
  "gemini",
];

function getStatusBadge(status: AiProviderHealthStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case "healthy":
      return {
        label: "Healthy",
        className: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800",
      };
    case "warning":
      return {
        label: "Warning >= 80%",
        className: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800",
      };
    case "rate_limited":
      return {
        label: "Rate Limited 429",
        className: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 border-red-200 dark:border-red-800",
      };
    case "disabled":
      return {
        label: "Disabled",
        className: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700",
      };
    case "unmeasured":
      return {
        label: "Chưa đo",
        className: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700",
      };
  }
}

function getProgressBarColor(provider: AiProviderHealthItem): string {
  if (!provider.isEnabled || provider.status === "disabled") {
    return "bg-slate-400";
  }
  if (provider.status === "rate_limited") {
    return "bg-red-600";
  }
  if (provider.status === "warning" || provider.usagePercent >= 80) {
    return "bg-amber-500";
  }
  if (provider.status === "unmeasured") {
    return provider.todayRequests > 0 ? "bg-blue-600" : "bg-slate-400";
  }
  return "bg-green-700";
}

function formatShortDate(dateKey: string): string {
  const parts = dateKey.split("-");
  if (parts.length !== 3) return dateKey;
  return `${parts[2]}/${parts[1]}`;
}

export function AdminAiMonitorTab({ onUnauthorized }: AdminAiMonitorTabProps) {
  const [summary, setSummary] = useState<AiHealthSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPinging, setIsPinging] = useState(false);
  const [savingProvider, setSavingProvider] = useState<AiProviderId | null>(null);
  const [capDrafts, setCapDrafts] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{
    tone: "ok" | "warn" | "error";
    text: string;
  } | null>(null);

  const syncDraftsFromSummary = useCallback((next: AiHealthSummary) => {
    const drafts: Record<string, string> = {};
    for (const p of next.providers) {
      drafts[p.id] = String(p.dailyLimitCap);
    }
    setCapDrafts(drafts);
  }, []);

  const loadHealth = useCallback(async () => {
    setIsLoading(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/ai-health", { cache: "no-store" });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      const data = (await res.json().catch(() => null)) as AiHealthApiResponse | null;
      if (!res.ok || !data?.ok) {
        setNotice({
          tone: "error",
          text: data?.error ?? "Không thể tải trạng thái 6 AI API.",
        });
        return;
      }
      setSummary(data);
      syncDraftsFromSummary(data);
    } catch {
      setNotice({
        tone: "error",
        text: "Mất kết nối máy chủ khi tải dữ liệu AI Monitor.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [onUnauthorized, syncDraftsFromSummary]);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  const handlePingAll = async () => {
    setIsPinging(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/ai-health", {
        method: "POST",
        cache: "no-store",
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      const data = (await res.json().catch(() => null)) as AiHealthApiResponse | null;
      if (!res.ok || !data?.ok) {
        setNotice({
          tone: "error",
          text: data?.error ?? "Ping kiểm tra 6 API thất bại.",
        });
        return;
      }
      setSummary(data);
      syncDraftsFromSummary(data);
      const configuredPings = (data.pings ?? []).filter((p) => p.configured);
      const okCount = configuredPings.filter((p) => p.ok).length;
      setNotice({
        tone: okCount === configuredPings.length ? "ok" : "warn",
        text: `Đã ping ${configuredPings.length} API đã cấu hình: ${okCount}/${configuredPings.length} phản hồi OK.`,
      });
    } catch {
      setNotice({
        tone: "error",
        text: "Không thể kết nối máy chủ để ping 6 API.",
      });
    } finally {
      setIsPinging(false);
    }
  };

  const handlePatchProvider = async (
    providerId: AiProviderId,
    payload: { dailyLimitCap?: number; isEnabled?: boolean }
  ) => {
    setSavingProvider(providerId);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/ai-health", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerId, ...payload }),
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      const data = (await res.json().catch(() => null)) as AiHealthApiResponse | null;
      if (!res.ok || !data?.ok) {
        setNotice({
          tone: "error",
          text: data?.error ?? `Không thể cập nhật cấu hình ${providerId}.`,
        });
        return;
      }
      setSummary(data);
      syncDraftsFromSummary(data);
      setNotice({
        tone: "ok",
        text: `Đã lưu cấu hình cho ${providerId}.`,
      });
    } catch {
      setNotice({
        tone: "error",
        text: "Lỗi mạng khi cập nhật cấu hình AI provider.",
      });
    } finally {
      setSavingProvider(null);
    }
  };

  const handleSaveCap = (provider: AiProviderHealthItem) => {
    const raw = capDrafts[provider.id] ?? "";
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setNotice({
        tone: "warn",
        text: "Daily Cap phải là số nguyên >= 1.",
      });
      setCapDrafts((prev) => ({
        ...prev,
        [provider.id]: String(provider.dailyLimitCap),
      }));
      return;
    }
    if (parsed === provider.dailyLimitCap) {
      return;
    }
    void handlePatchProvider(provider.id, { dailyLimitCap: parsed });
  };

  const maxDailyTotal = useMemo(() => {
    if (!summary?.dailyDistribution.length) return 1;
    return Math.max(
      1,
      ...summary.dailyDistribution.map((item) => item.totalRequests)
    );
  }, [summary]);

  const total7DayRequests = useMemo(() => {
    if (!summary?.dailyDistribution.length) return 0;
    return summary.dailyDistribution.reduce((acc, d) => acc + d.totalRequests, 0);
  }, [summary]);

  if (isLoading && !summary) {
    return (
      <div className="space-y-6 animate-pulse motion-reduce:animate-none" aria-busy="true">
        <div className="h-24 liquid-glass-card-lite p-5" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[0, 1, 2, 3, 4, 5].map((idx) => (
            <div
              key={idx}
              className="h-64 liquid-glass-card-lite p-5"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="liquid-glass-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Activity className="w-5 h-5 text-blue-700 dark:text-blue-400" aria-hidden="true" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Giám Sát 6 API AI (Waterfall Telemetry)
            </h2>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Theo dõi hạn mức ngày, mã lỗi 429, độ trễ trực tiếp và bật/tắt circuit-breaker cho từng provider.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void loadHealth()}
            disabled={isLoading || isPinging}
            className="liquid-glass-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-mono font-medium disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            <span>Tải lại</span>
          </button>

          <button
            type="button"
            onClick={() => void handlePingAll()}
            disabled={isPinging}
            className="liquid-btn-primary inline-flex items-center gap-2 px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold disabled:opacity-60"
          >
            <Zap
              className={`w-4 h-4 text-white ${isPinging ? "animate-pulse motion-reduce:animate-none" : ""}`}
              aria-hidden="true"
            />
            <span>
              {isPinging ? "Đang Ping 6 API…" : "Ping Kiểm Tra Tất Cả 6 API"}
            </span>
          </button>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className={`flex items-start gap-2.5 p-3.5 rounded-xl border text-sm ${
            notice.tone === "ok"
              ? "bg-green-50 dark:bg-green-950/40 border-green-300 dark:border-green-800 text-green-700 dark:text-green-300"
              : notice.tone === "warn"
                ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300"
                : "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300"
          }`}
        >
          {notice.tone === "ok" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-green-700 dark:text-green-400" aria-hidden="true" />
          ) : notice.tone === "warn" ? (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          ) : (
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" aria-hidden="true" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {summary.providers.map((provider) => {
            const badge = getStatusBadge(provider.status);
            const barColor = getProgressBarColor(provider);
            const clampedPercent = Math.min(100, Math.max(0, provider.usagePercent));
            const isSaving = savingProvider === provider.id;
            const draftVal = capDrafts[provider.id] ?? String(provider.dailyLimitCap);

            return (
              <article
                key={provider.id}
                className={`liquid-glass-card-lite p-5 flex flex-col justify-between gap-4 transition-opacity ${
                  provider.isEnabled ? "" : "opacity-75"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${PROVIDER_DOT_COLORS[provider.id]}`}
                          aria-hidden="true"
                        />
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                          {provider.label}
                        </h3>
                        <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                          #{provider.priority}
                        </span>
                      </div>
                      <p className="text-sm font-mono text-slate-600 dark:text-slate-400 mt-0.5">
                        {provider.envVar}
                      </p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={provider.isEnabled}
                      aria-label={`Bật hoặc tắt ${provider.label}`}
                      disabled={isSaving}
                      onClick={() =>
                        void handlePatchProvider(provider.id, {
                          isEnabled: !provider.isEnabled,
                        })
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors disabled:opacity-50 ${
                        provider.isEnabled
                          ? "bg-green-700 border-green-700"
                          : "bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          provider.isEnabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.className}`}
                    >
                      {badge.label}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold border ${
                        provider.keyStatus === "Configured"
                          ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                          : "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 border-red-200 dark:border-red-800"
                      }`}
                    >
                      <KeyRound className="w-3 h-3" aria-hidden="true" />
                      <span>{provider.keyStatus}</span>
                    </span>

                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      <Clock className="w-3 h-3 text-slate-600 dark:text-slate-400" aria-hidden="true" />
                      <span>
                        {provider.lastLatencyMs !== null
                          ? `${provider.lastLatencyMs} ms`
                          : "Chưa đo"}
                      </span>
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        Hôm nay: <strong className="text-slate-900 dark:text-slate-100 font-mono">{provider.todayRequests}</strong> /{" "}
                        <span className="font-mono">{provider.dailyLimitCap}</span>
                      </span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {provider.usagePercent}%
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`w-full h-full rounded-full origin-left transition-transform duration-300 ${barColor}`}
                        style={{ transform: `scaleX(${clampedPercent / 100})` }}
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-600 dark:text-slate-400">
                      <span>429 hôm nay: {provider.today429Count}</span>
                      <span>
                        Last HTTP: {provider.lastStatus !== null ? provider.lastStatus : "Chưa đo"}
                      </span>
                    </div>
                  </div>

                  {(provider.remainingRequestsHeader ||
                    provider.remainingTokensHeader ||
                    provider.openRouterBalance) && (
                    <div className="border-t border-slate-200 dark:border-slate-800 pt-2.5 space-y-1 text-xs font-mono text-slate-700 dark:text-slate-300">
                      {provider.remainingRequestsHeader && (
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-600 dark:text-slate-400">Header Req Left:</span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {provider.remainingRequestsHeader}
                          </span>
                        </div>
                      )}
                      {provider.remainingTokensHeader && (
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-600 dark:text-slate-400">Header Tok Left:</span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {provider.remainingTokensHeader}
                          </span>
                        </div>
                      )}
                      {provider.openRouterBalance && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400">
                            <DollarSign className="w-3 h-3" aria-hidden="true" />
                            <span>OpenRouter Balance:</span>
                          </span>
                          <span className="font-semibold text-green-700 dark:text-green-400">
                            {provider.openRouterBalance.remaining !== null
                              ? `$${provider.openRouterBalance.remaining.toFixed(4)}`
                              : provider.openRouterBalance.isFreeTier
                                ? "Free Tier"
                                : "Unlimited"}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                  <label
                    htmlFor={`cap-${provider.id}`}
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300 shrink-0"
                  >
                    Daily Cap
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      id={`cap-${provider.id}`}
                      type="number"
                      min={1}
                      max={1000000}
                      value={draftVal}
                      disabled={isSaving}
                      onChange={(e) =>
                        setCapDrafts((prev) => ({
                          ...prev,
                          [provider.id]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSaveCap(provider);
                        }
                      }}
                      className="liquid-glass-input w-24 px-2.5 py-1 rounded-lg text-xs font-mono"
                    />
                    <button
                      type="button"
                      disabled={
                        isSaving ||
                        draftVal === String(provider.dailyLimitCap)
                      }
                      onClick={() => handleSaveCap(provider)}
                      className="liquid-btn-success inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold disabled:opacity-40"
                    >
                      <Save className="w-3 h-3" aria-hidden="true" />
                      <span>Lưu</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {summary && (
        <section className="liquid-glass-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Phân Bổ Request 7 Ngày Qua (Waterfall Routing)
              </h3>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Tổng cộng {total7DayRequests} lượt gọi AI được ghi nhận trong 7 ngày gần nhất.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {PROVIDER_ORDER.map((id) => {
                const item = summary.providers.find((p) => p.id === id);
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-700 dark:text-slate-300"
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-sm ${PROVIDER_COLORS[id]}`}
                      aria-hidden="true"
                    />
                    <span>{item?.label ?? id}</span>
                  </span>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 sm:gap-4 pt-2 items-end h-52">
            {summary.dailyDistribution.map((day) => {
              const barHeightPercent = Math.round(
                (day.totalRequests / maxDailyTotal) * 100
              );

              return (
                <div
                  key={day.dateKey}
                  className="flex flex-col items-center justify-end h-full gap-1.5"
                >
                  <span className="text-xs font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {day.totalRequests}
                  </span>

                  <div
                    className="w-full max-w-[44px] flex-1 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-1 flex flex-col justify-end overflow-hidden"
                    title={`${day.dateKey}: ${day.totalRequests} requests`}
                  >
                    {day.totalRequests > 0 ? (
                      <div
                        className="w-full rounded overflow-hidden flex flex-col-reverse"
                        style={{ height: `${Math.max(8, barHeightPercent)}%` }}
                      >
                        {PROVIDER_ORDER.map((providerId) => {
                          const count = day.byProvider[providerId] ?? 0;
                          if (count <= 0) return null;
                          const segPercent = (count / day.totalRequests) * 100;
                          return (
                            <div
                              key={providerId}
                              className={`w-full ${PROVIDER_COLORS[providerId]}`}
                              style={{ height: `${segPercent}%` }}
                              title={`${providerId}: ${count}`}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <div className="w-full h-1 rounded bg-slate-200 dark:bg-slate-700" />
                    )}
                  </div>

                  <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                    {formatShortDate(day.dateKey)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

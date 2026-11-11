"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Database,
  KeyRound,
  Layers,
  RotateCcw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { saveLocalContentOverrides } from "../../lib/contentStore";
import type { AdminContentOverrides } from "../../lib/types";
import {
  createCleanEmptyOverrides,
  resolveAiProviders,
  type AdminHealth,
} from "./adminShared";

interface AdminSystemTabProps {
  health: AdminHealth;
  overrides: AdminContentOverrides;
  onOverridesChange: (next: AdminContentOverrides) => void;
  onRefreshDashboard: () => Promise<void>;
  onUnauthorized: () => void;
}

export function AdminSystemTab({
  health,
  overrides,
  onOverridesChange,
  onRefreshDashboard,
  onUnauthorized,
}: AdminSystemTabProps) {
  const [confirmAction, setConfirmAction] = useState<
    "reset_content" | "reset_analytics" | null
  >(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notice, setNotice] = useState<{
    tone: "ok" | "warn" | "error";
    text: string;
  } | null>(null);

  const handleResetContent = async () => {
    setIsProcessing(true);
    setNotice(null);
    const empty = saveLocalContentOverrides(createCleanEmptyOverrides());

    try {
      const res = await fetch("/api/admin/content", { method: "DELETE" });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }

      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      onOverridesChange(empty);
      setConfirmAction(null);

      if (!res.ok) {
        setNotice({
          tone: "warn",
          text: `Đã đặt lại Local Cache về mặc định. ${data?.error ?? "Chưa kết nối Neon Cloud DB."}`,
        });
      } else {
        await onRefreshDashboard();
        setNotice({
          tone: "ok",
          text: "Đã khôi phục toàn bộ kịch bản, từ vựng và thử thách Arena về trạng thái mặc định.",
        });
      }
    } catch {
      onOverridesChange(empty);
      setConfirmAction(null);
      setNotice({
        tone: "warn",
        text: "Đã đặt lại Local Cache về mặc định, nhưng không thể kết nối máy chủ để xóa trên Neon DB.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetAnalytics = async () => {
    setIsProcessing(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_analytics" }),
      });

      if (res.status === 401) {
        onUnauthorized();
        return;
      }

      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      setConfirmAction(null);
      if (!res.ok || !data?.ok) {
        setNotice({
          tone: "error",
          text:
            data?.error ||
            "Không thể xóa dữ liệu thống kê trên Neon Postgres. Vui lòng kiểm tra kết nối DB.",
        });
        return;
      }

      await onRefreshDashboard();
      setNotice({
        tone: "ok",
        text: "Đã xóa toàn bộ dữ liệu thống kê (lượt luyện nói, điểm yếu, lịch sử Arena) trên Neon Cloud DB.",
      });
    } catch {
      setConfirmAction(null);
      setNotice({
        tone: "error",
        text: "Lỗi kết nối máy chủ khi thực hiện xóa dữ liệu thống kê DB.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const totalOverridesCount =
    overrides.customScenarios.length +
    overrides.hiddenScenarioIds.length +
    overrides.customVocabulary.length +
    overrides.deletedVocabIds.length +
    overrides.customBugChallenges.length +
    overrides.deletedChallengeIds.length;

  const aiProviders = resolveAiProviders(health);
  const activeAiCount = aiProviders.filter((p) => p.configured).length;

  return (
    <div className="space-y-6">
      {notice && (
        <div
          role={notice.tone === "error" ? "alert" : "status"}
          className={`flex items-start gap-2.5 p-3.5 rounded-2xl border text-xs ${
            notice.tone === "error"
              ? "bg-accent-light border-accent/40 text-ink"
              : notice.tone === "warn"
              ? "bg-paper-muted border-ink/25 text-ink"
              : "bg-white border-ink/20 text-ink shadow-soft"
          }`}
        >
          {notice.tone === "ok" ? (
            <CheckCircle2 className="w-4 h-4 text-ink shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <AlertCircle className="w-4 h-4 text-accent shrink-0 mt-0.5" aria-hidden="true" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Diagnostics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase font-semibold text-ink-muted">
              Neon Postgres DB
            </span>
            <Database className="w-4 h-4 text-ink-muted" aria-hidden="true" />
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                health.neonConnected ? "bg-ink" : "bg-accent"
              }`}
            />
            <span className="text-sm font-bold text-ink">
              {health.neonConnected ? "Đã kết nối" : "Chưa kết nối"}
            </span>
          </div>
          <p className="text-xs text-ink-muted leading-relaxed">
            {health.neonConnected
              ? "Dữ liệu học liệu và telemetry đang đồng bộ trực tiếp qua Neon serverless Postgres."
              : "Hệ thống đang chạy ở chế độ Local Cache. Kiểm tra biến môi trường DATABASE_URL để bật lưu trữ đám mây."}
          </p>
        </div>

        <div className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase font-semibold text-ink-muted">
              AI Failover Chain
            </span>
            <Cpu className="w-4 h-4 text-ink-muted" aria-hidden="true" />
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                activeAiCount > 0 ? "bg-ink" : "bg-ink-faint"
              }`}
            />
            <span className="text-sm font-bold text-ink">
              {activeAiCount > 0
                ? `${activeAiCount}/6 provider đang bật`
                : "Chế độ Local Fallback"}
            </span>
          </div>
          <p className="text-xs text-ink-muted leading-relaxed">
            {activeAiCount > 0
              ? "Tự động failover qua các tier AI trong 4000ms trước khi dùng bộ chấm điểm cục bộ."
              : "Chưa cấu hình AI key trên server; ứng dụng tự fallback sang scoreLocally."}
          </p>
        </div>

        <div className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase font-semibold text-ink-muted">
              Bảo mật Admin Passcode
            </span>
            <KeyRound className="w-4 h-4 text-ink-muted" aria-hidden="true" />
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                !health.isDefaultPasscode ? "bg-ink" : "bg-accent"
              }`}
            />
            <span className="text-sm font-bold text-ink">
              {!health.isDefaultPasscode ? "Đã tùy chỉnh" : "Đang dùng mặc định"}
            </span>
          </div>
          <p className="text-xs text-ink-muted leading-relaxed">
            {!health.isDefaultPasscode
              ? "ADMIN_PASSCODE riêng đã được thiết lập trong biến môi trường."
              : "Chưa thiết lập ADMIN_PASSCODE riêng trong biến môi trường. Hãy cấu hình trước khi chia sẻ rộng rãi."}
          </p>
        </div>
      </div>

      <section className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-ink flex items-center gap-2">
              <Cpu className="w-4 h-4 text-accent" aria-hidden="true" />
              <span>AI Multi-Provider Failover Matrix</span>
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Thứ tự ưu tiên từ Tier 1 đến Tier 6 (timeout 4000ms mỗi tier) trước khi fallback về bộ quy tắc cục bộ.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-paper border border-ink/15 font-mono text-xs font-bold text-ink">
            {activeAiCount}/6 active
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {aiProviders.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border p-3.5 flex items-center justify-between gap-3 ${
                item.configured
                  ? "bg-paper border-ink/20"
                  : "bg-white border-ink/10"
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] font-bold text-accent">
                    #{item.priority}
                  </span>
                  <span className="text-xs font-bold text-ink truncate">
                    {item.label}
                  </span>
                </div>
                <code className="block font-mono text-[11px] text-ink-muted truncate mt-1">
                  {item.envVar}
                </code>
              </div>
              <span
                className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill font-mono text-[11px] font-semibold border ${
                  item.configured
                    ? "bg-ink text-white border-ink"
                    : "bg-paper-muted text-ink-faint border-ink/15"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    item.configured ? "bg-accent" : "bg-ink-faint"
                  }`}
                />
                {item.configured ? "Active" : "Missing"}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-ink/10 text-xs text-ink-muted">
          <span>
            <strong className="font-mono text-ink">#7 Offline Fallback:</strong>{" "}
            <code className="font-mono text-ink">scoreLocally</code>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill bg-paper border border-ink/15 font-mono text-[11px] font-semibold text-ink">
            Always Ready
          </span>
        </div>
      </section>

      {/* Overrides Summary */}
      <section className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-ink flex items-center gap-2">
            <Layers className="w-4 h-4 text-accent" aria-hidden="true" />
            <span>Tóm tắt nội dung tùy chỉnh (Overrides)</span>
          </h2>
          <span className="text-xs font-mono text-ink-muted">
            Tổng {totalOverridesCount} mục thay đổi
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-paper border border-ink/10 space-y-1">
            <div className="font-mono text-ink-muted uppercase text-[11px]">
              Kịch bản
            </div>
            <div className="font-semibold text-ink">
              {overrides.customScenarios.length} thêm/sửa •{" "}
              {overrides.hiddenScenarioIds.length} đang ẩn
            </div>
          </div>

          <div className="p-4 rounded-xl bg-paper border border-ink/10 space-y-1">
            <div className="font-mono text-ink-muted uppercase text-[11px]">
              Từ vựng CNTT
            </div>
            <div className="font-semibold text-ink">
              {overrides.customVocabulary.length} thêm/sửa •{" "}
              {overrides.deletedVocabIds.length} mặc định đã ẩn
            </div>
          </div>

          <div className="p-4 rounded-xl bg-paper border border-ink/10 space-y-1">
            <div className="font-mono text-ink-muted uppercase text-[11px]">
              Arena Bug Buster
            </div>
            <div className="font-semibold text-ink">
              {overrides.customBugChallenges.length} thêm/sửa •{" "}
              {overrides.deletedChallengeIds.length} mặc định đã ẩn
            </div>
          </div>
        </div>
      </section>

      {/* Maintenance Actions */}
      <section className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-5">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-ink flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-accent" aria-hidden="true" />
            <span>Bảo trì &amp; Đặt lại hệ thống</span>
          </h2>
          <p className="text-xs text-ink-muted">
            Các thao tác dưới đây yêu cầu xác nhận hai bước để tránh mất dữ liệu ngoài ý muốn.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Action 1: Restore Default Content */}
          <div className="p-4 rounded-2xl bg-paper border border-ink/15 space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-ink">
                Khôi phục toàn bộ nội dung mặc định
              </h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                Xóa toàn bộ kịch bản, từ vựng và thử thách Arena tùy chỉnh trên Cloud DB và Local Cache để quay về bộ học liệu gốc.
              </p>
            </div>

            {confirmAction === "reset_content" ? (
              <div className="p-3 rounded-xl bg-white border border-accent/40 space-y-2.5">
                <p className="text-xs font-semibold text-ink">
                  Xác nhận khôi phục toàn bộ học liệu về mặc định?
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleResetContent}
                    className="px-3.5 py-1.5 rounded-pill bg-accent text-white text-xs font-semibold hover:bg-accent-hover disabled:opacity-50"
                  >
                    {isProcessing ? "Đang xử lý..." : "Xác nhận khôi phục"}
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => setConfirmAction(null)}
                    className="px-3.5 py-1.5 rounded-pill bg-paper border border-ink/20 text-xs font-medium text-ink hover:bg-paper-muted"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setConfirmAction("reset_content")}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-pill bg-white border border-ink/20 text-xs font-semibold text-ink hover:bg-paper-muted transition-colors self-start"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Khôi phục toàn bộ nội dung mặc định</span>
              </button>
            )}
          </div>

          {/* Action 2: Reset DB Analytics */}
          <div className="p-4 rounded-2xl bg-paper border border-ink/15 space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-ink">
                Xóa dữ liệu thống kê DB
              </h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                Xóa toàn bộ lượt luyện nói, điểm yếu và lịch sử Arena lưu trên Neon Cloud DB (thường dùng trước khi bắt đầu đợt thu thập dữ liệu nghiên cứu mới).
              </p>
            </div>

            {confirmAction === "reset_analytics" ? (
              <div className="p-3 rounded-xl bg-accent-light border border-accent/50 space-y-2.5">
                <p className="text-xs font-semibold text-ink">
                  Cảnh báo: Thao tác này xóa vĩnh viễn telemetry trên Neon DB!
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleResetAnalytics}
                    className="px-3.5 py-1.5 rounded-pill bg-accent text-white text-xs font-semibold hover:bg-accent-hover disabled:opacity-50"
                  >
                    {isProcessing ? "Đang xóa..." : "Xác nhận xóa DB"}
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => setConfirmAction(null)}
                    className="px-3.5 py-1.5 rounded-pill bg-white border border-ink/20 text-xs font-medium text-ink hover:bg-paper-muted"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setConfirmAction("reset_analytics")}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-pill bg-accent-light border border-accent/40 text-xs font-semibold text-ink hover:bg-accent hover:text-white transition-colors self-start"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Xóa dữ liệu thống kê DB</span>
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

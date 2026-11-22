"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Cpu,
  Database,
  KeyRound,
  Layers,
  RotateCcw,
  Send,
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
import {
  AdminDeleteConfirmModal,
  type DeleteConfirmRequest,
} from "./AdminDeleteConfirmModal";

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
  const [deleteRequest, setDeleteRequest] = useState<DeleteConfirmRequest | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [pushSending, setPushSending] = useState(false);
  const [pushConfigured, setPushConfigured] = useState<boolean | null>(null);
  const [pushDeviceCount, setPushDeviceCount] = useState<number>(0);
  const [notice, setNotice] = useState<{
    tone: "ok" | "warn" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/notifications")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { configured?: boolean; deviceCount?: number } | null) => {
        if (!active || !data) return;
        setPushConfigured(Boolean(data.configured));
        setPushDeviceCount(data.deviceCount ?? 0);
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, []);

  const handleSendBroadcast = async () => {
    if (!pushTitle.trim() || !pushBody.trim()) {
      setNotice({ tone: "warn", text: "Vui lòng nhập đầy đủ tiêu đề và nội dung thông báo." });
      return;
    }
    setPushSending(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: pushTitle.trim(), body: pushBody.trim() }),
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        sent?: number;
        failed?: number;
        total?: number;
        error?: string;
      } | null;
      if (!res.ok || !data?.ok) {
        setNotice({
          tone: "error",
          text: data?.error || "Không thể gửi thông báo đẩy FCM.",
        });
        return;
      }
      setPushTitle("");
      setPushBody("");
      setNotice({
        tone: "ok",
        text: `Đã gửi thông báo tới ${data.sent ?? 0}/${data.total ?? 0} thiết bị Android.`,
      });
    } catch {
      setNotice({ tone: "error", text: "Lỗi kết nối khi gửi thông báo đẩy." });
    } finally {
      setPushSending(false);
    }
  };

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
      setDeleteRequest(null);

      if (!res.ok) {
        setNotice({
          tone: "warn",
          text: `Đã đặt lại nội dung về mặc định. ${data?.error ?? ""}`.trim(),
        });
      } else {
        await onRefreshDashboard();
        setNotice({
          tone: "ok",
          text: "Đã khôi phục toàn bộ kịch bản, từ vựng và thử thách Arena về trạng thái mặc định.",
        });
      }
      return true;
    } catch {
      onOverridesChange(empty);
      setDeleteRequest(null);
      setNotice({
        tone: "warn",
        text: "Đã đặt lại nội dung về mặc định trên trình duyệt.",
      });
      return true;
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
        return false;
      }

      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      setDeleteRequest(null);
      if (!res.ok || !data?.ok) {
        setNotice({
          tone: "error",
          text:
            data?.error ||
            "Không thể xóa dữ liệu thống kê từ máy chủ.",
        });
        return false;
      }
      await onRefreshDashboard();
      setNotice({
        tone: "ok",
        text: "Đã xóa toàn bộ dữ liệu thống kê luyện tập và Arena.",
      });
      return true;
    } catch {
      setNotice({
        tone: "error",
        text: "Lỗi kết nối khi xóa dữ liệu thống kê.",
      });
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const requestResetContent = () => {
    setDeleteRequest({
      title: "Bạn có chắc chắn muốn khôi phục toàn bộ học liệu về mặc định?",
      description:
        "Thao tác này sẽ xóa toàn bộ kịch bản, từ vựng (bao gồm cả từ đã import) và thử thách Arena tùy chỉnh để quay về bộ gốc.",
      itemCount: Math.max(1, totalOverridesCount),
      confirmButtonLabel: "Khôi phục mặc định",
      onConfirm: handleResetContent,
    });
  };

  const requestResetAnalytics = () => {
    setDeleteRequest({
      title: "Bạn có chắc chắn muốn xóa vĩnh viễn toàn bộ dữ liệu thống kê?",
      description:
        "Toàn bộ lượt luyện nói, điểm yếu và lịch sử Arena đã thu thập sẽ bị xóa vĩnh viễn khỏi cơ sở dữ liệu.",
      itemCount: 1,
      itemPreviewLabels: ["speakit_attempts", "speakit_weak_points", "speakit_arena_runs"],
      confirmButtonLabel: "Xóa dữ liệu thống kê",
      onConfirm: handleResetAnalytics,
    });
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase font-semibold text-ink-muted">
              Đồng bộ máy chủ
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
              {health.neonConnected ? "Đang hoạt động" : "Lưu trên trình duyệt"}
            </span>
          </div>
          <p className="text-xs text-ink-muted leading-relaxed">
            {health.neonConnected
              ? "Dữ liệu học liệu và kết quả luyện tập đang được đồng bộ trực tiếp với máy chủ."
              : "Dữ liệu học liệu và lịch sử luyện tập đang được lưu trữ trực tiếp trên trình duyệt."}
          </p>
        </div>

        <div className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase font-semibold text-ink-muted">
              Dịch vụ AI
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
                : "Chấm điểm tự động"}
            </span>
          </div>
          <p className="text-xs text-ink-muted leading-relaxed">
            {activeAiCount > 0
              ? "Tự động điều phối qua các dịch vụ AI để chấm điểm và phản hồi nhanh."
              : "Sử dụng bộ quy tắc đánh giá từ khóa và ngữ pháp tự động."}
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
              ? "Passcode quản trị riêng đã được thiết lập cho hệ thống."
              : "Đang sử dụng passcode mặc định. Hãy cập nhật passcode riêng khi triển khai chính thức."}
          </p>
        </div>
      </div>

      <section className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-ink flex items-center gap-2">
              <Cpu className="w-4 h-4 text-accent" aria-hidden="true" />
              <span>AI Multi-Provider Matrix</span>
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Thứ tự ưu tiên từ Tier 1 đến Tier 6 (timeout 4000ms mỗi tier) để đảm bảo phản hồi liên tục.
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
      </section>

      <section className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-ink flex items-center gap-2">
            <Layers className="w-4 h-4 text-accent" aria-hidden="true" />
            <span>Tóm tắt nội dung tùy chỉnh</span>
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

      <section className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-accent" aria-hidden="true" />
            <h2 className="text-base font-bold text-ink">
              Thông báo đẩy Android (Firebase FCM)
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded-pill border border-ink/15 bg-paper text-ink">
              {pushDeviceCount} thiết bị
            </span>
            <span
              className={`px-2.5 py-1 rounded-pill border ${
                pushConfigured
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : "border-amber-300 bg-amber-50 text-amber-800"
              }`}
            >
              {pushConfigured ? "FCM Sẵn sàng" : "Thiếu FIREBASE_SERVICE_ACCOUNT_JSON"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <input
            type="text"
            value={pushTitle}
            onChange={(e) => setPushTitle(e.target.value)}
            placeholder="Tiêu đề thông báo (VD: SpeakIT cập nhật kịch bản mới!)"
            maxLength={120}
            className="w-full px-3.5 py-2 rounded-xl border border-ink/20 bg-paper text-xs text-ink focus:outline-none focus:border-ink"
          />
          <textarea
            value={pushBody}
            onChange={(e) => setPushBody(e.target.value)}
            placeholder="Nội dung thông báo gửi ra màn hình khóa điện thoại Android..."
            maxLength={500}
            rows={2}
            className="w-full px-3.5 py-2 rounded-xl border border-ink/20 bg-paper text-xs text-ink focus:outline-none focus:border-ink resize-none"
          />
          <button
            type="button"
            disabled={pushSending}
            onClick={() => void handleSendBroadcast()}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-pill bg-ink text-white text-xs font-semibold hover:bg-ink/90 transition-colors self-start disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{pushSending ? "Đang gửi..." : "Gửi thông báo tới app Android"}</span>
          </button>
        </div>
      </section>

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
          <div className="p-4 rounded-2xl bg-paper border border-ink/15 space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-ink">
                Khôi phục toàn bộ nội dung mặc định
              </h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                Xóa toàn bộ kịch bản, từ vựng và thử thách Arena tùy chỉnh để quay về bộ học liệu gốc.
              </p>
            </div>

            <button
              type="button"
              disabled={isProcessing}
              onClick={requestResetContent}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-pill bg-white border border-ink/20 text-xs font-semibold text-ink hover:bg-paper-muted transition-colors self-start disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Khôi phục toàn bộ nội dung mặc định</span>
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-paper border border-ink/15 space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-ink">
                Xóa dữ liệu thống kê
              </h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                Xóa toàn bộ lượt luyện nói, điểm yếu và lịch sử Arena đã ghi nhận (thường dùng trước khi bắt đầu đợt thu thập dữ liệu nghiên cứu mới).
              </p>
            </div>

            <button
              type="button"
              disabled={isProcessing}
              onClick={requestResetAnalytics}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-pill bg-accent-light border border-accent/40 text-xs font-semibold text-ink hover:bg-accent hover:text-white transition-colors self-start disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Xóa dữ liệu thống kê</span>
            </button>
          </div>
        </div>
      </section>

      <AdminDeleteConfirmModal
        request={deleteRequest}
        onClose={() => setDeleteRequest(null)}
      />
    </div>
  );
}

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

interface AdminAnnouncement {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

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
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [announcementSending, setAnnouncementSending] = useState(false);
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [deletingAnnouncementId, setDeletingAnnouncementId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: "ok" | "warn" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/notifications")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { announcements?: AdminAnnouncement[] } | null) => {
        if (!active || !data?.announcements) return;
        setAnnouncements(data.announcements);
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, []);

  const handlePublishAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementBody.trim()) {
      setNotice({ tone: "warn", text: "Vui lòng nhập đầy đủ tiêu đề và nội dung thông báo." });
      return;
    }
    setAnnouncementSending(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: announcementTitle.trim(),
          body: announcementBody.trim(),
        }),
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        announcement?: AdminAnnouncement;
        error?: string;
      } | null;
      if (!res.ok || !data?.ok || !data.announcement) {
        setNotice({
          tone: "error",
          text: data?.error || "Không thể đăng thông báo trong app.",
        });
        return;
      }
      setAnnouncements((prev) => [data.announcement!, ...prev]);
      setAnnouncementTitle("");
      setAnnouncementBody("");
      setNotice({
        tone: "ok",
        text: "Đã đăng thông báo trong app tới người dùng.",
      });
    } catch {
      setNotice({ tone: "error", text: "Lỗi kết nối khi đăng thông báo." });
    } finally {
      setAnnouncementSending(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    setDeletingAnnouncementId(id);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/notifications?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setNotice({
          tone: "error",
          text: data?.error || "Không thể xóa thông báo.",
        });
        return;
      }
      setAnnouncements((prev) => prev.filter((item) => item.id !== id));
      setNotice({ tone: "ok", text: "Đã xóa thông báo." });
    } catch {
      setNotice({ tone: "error", text: "Lỗi kết nối khi xóa thông báo." });
    } finally {
      setDeletingAnnouncementId(null);
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
              ? "bg-rose-50/90 border-rose-300/80 text-rose-800"
              : notice.tone === "warn"
              ? "bg-amber-50/90 border-amber-300/80 text-amber-800"
              : "bg-emerald-50/90 border-emerald-300/80 text-emerald-800"
          }`}
        >
          {notice.tone === "ok" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="liquid-glass-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase font-semibold text-slate-600">
              Đồng bộ máy chủ
            </span>
            <Database className="w-4 h-4 text-sky-600" aria-hidden="true" />
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                health.neonConnected ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            <span className="text-sm font-bold text-slate-900">
              {health.neonConnected ? "Đang hoạt động" : "Lưu trên trình duyệt"}
            </span>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">
            {health.neonConnected
              ? "Dữ liệu học liệu và kết quả luyện tập đang được đồng bộ trực tiếp với máy chủ."
              : "Dữ liệu học liệu và lịch sử luyện tập đang được lưu trữ trực tiếp trên trình duyệt."}
          </p>
        </div>

        <div className="liquid-glass-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase font-semibold text-slate-600">
              Dịch vụ AI
            </span>
            <Cpu className="w-4 h-4 text-sky-600" aria-hidden="true" />
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                activeAiCount > 0 ? "bg-emerald-500" : "bg-slate-400"
              }`}
            />
            <span className="text-sm font-bold text-slate-900">
              {activeAiCount > 0
                ? `${activeAiCount}/6 provider đang bật`
                : "Chấm điểm tự động"}
            </span>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">
            {activeAiCount > 0
              ? "Tự động điều phối qua các dịch vụ AI để chấm điểm và phản hồi nhanh."
              : "Sử dụng bộ quy tắc đánh giá từ khóa và ngữ pháp tự động."}
          </p>
        </div>

        <div className="liquid-glass-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase font-semibold text-slate-600">
              Bảo mật Admin Passcode
            </span>
            <KeyRound className="w-4 h-4 text-sky-600" aria-hidden="true" />
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                !health.isDefaultPasscode ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            <span className="text-sm font-bold text-slate-900">
              {!health.isDefaultPasscode ? "Đã tùy chỉnh" : "Đang dùng mặc định"}
            </span>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">
            {!health.isDefaultPasscode
              ? "Passcode quản trị riêng đã được thiết lập cho hệ thống."
              : "Đang sử dụng passcode mặc định. Hãy cập nhật passcode riêng khi triển khai chính thức."}
          </p>
        </div>
      </div>

      <section className="liquid-glass-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-sky-600" aria-hidden="true" />
              <span>AI Multi-Provider Matrix</span>
            </h2>
            <p className="text-xs text-slate-700 mt-0.5">
              Thứ tự ưu tiên từ Tier 1 đến Tier 6 (timeout 4000ms mỗi tier) để đảm bảo phản hồi liên tục.
            </p>
          </div>
          <span className="liquid-glass-pill inline-flex items-center gap-1.5 px-3 py-1 font-mono text-xs font-bold text-sky-800">
            {activeAiCount}/6 active
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {aiProviders.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border p-3.5 flex items-center justify-between gap-3 ${
                item.configured
                  ? "bg-white/85 border-sky-300/85"
                  : "bg-slate-50/80 border-slate-200/85"
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] font-bold text-sky-700">
                    #{item.priority}
                  </span>
                  <span className="text-xs font-bold text-slate-900 truncate">
                    {item.label}
                  </span>
                </div>
                <code className="block font-mono text-[11px] text-slate-600 truncate mt-1">
                  {item.envVar}
                </code>
              </div>
              <span
                className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[11px] font-semibold border ${
                  item.configured
                    ? "bg-emerald-100/90 text-emerald-800 border-emerald-300/80"
                    : "bg-slate-100/90 text-slate-600 border-slate-200/85"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    item.configured ? "bg-emerald-500" : "bg-slate-400"
                  }`}
                />
                {item.configured ? "Active" : "Missing"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="liquid-glass-card p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-600" aria-hidden="true" />
            <span>Tóm tắt nội dung tùy chỉnh</span>
          </h2>
          <span className="text-xs font-mono text-slate-700">
            Tổng {totalOverridesCount} mục thay đổi
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-white/85 border border-slate-200/85 space-y-1">
            <div className="font-mono text-slate-600 uppercase text-[11px]">
              Kịch bản
            </div>
            <div className="font-semibold text-slate-900">
              {overrides.customScenarios.length} thêm/sửa •{" "}
              {overrides.hiddenScenarioIds.length} đang ẩn
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white/85 border border-slate-200/85 space-y-1">
            <div className="font-mono text-slate-600 uppercase text-[11px]">
              Từ vựng CNTT
            </div>
            <div className="font-semibold text-slate-900">
              {overrides.customVocabulary.length} thêm/sửa •{" "}
              {overrides.deletedVocabIds.length} mặc định đã ẩn
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white/85 border border-slate-200/85 space-y-1">
            <div className="font-mono text-slate-600 uppercase text-[11px]">
              Arena Bug Buster
            </div>
            <div className="font-semibold text-slate-900">
              {overrides.customBugChallenges.length} thêm/sửa •{" "}
              {overrides.deletedChallengeIds.length} mặc định đã ẩn
            </div>
          </div>
        </div>
      </section>

      <section className="liquid-glass-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-sky-600" aria-hidden="true" />
            <h2 className="text-base font-bold text-slate-900">
              Thông báo trong app (Admin Announcements)
            </h2>
          </div>
          <span className="liquid-glass-pill px-2.5 py-1 text-xs font-mono text-slate-700">
            {announcements.length} thông báo
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <input
            type="text"
            value={announcementTitle}
            onChange={(e) => setAnnouncementTitle(e.target.value)}
            placeholder="Tiêu đề thông báo (VD: SpeakIT cập nhật kịch bản mới!)"
            maxLength={120}
            className="liquid-glass-input w-full px-3.5 py-2 rounded-xl text-xs"
          />
          <textarea
            value={announcementBody}
            onChange={(e) => setAnnouncementBody(e.target.value)}
            placeholder="Nội dung thông báo hiển thị trong chuông thông báo trên app..."
            maxLength={500}
            rows={2}
            className="liquid-glass-input w-full px-3.5 py-2 rounded-xl text-xs resize-none"
          />
          <button
            type="button"
            disabled={announcementSending}
            onClick={() => void handlePublishAnnouncement()}
            className="liquid-btn-primary inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold self-start disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{announcementSending ? "Đang đăng..." : "Đăng thông báo"}</span>
          </button>
        </div>

        {announcements.length > 0 && (
          <div className="pt-2 border-t border-slate-200/85 space-y-2">
            {announcements.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 p-3 rounded-xl bg-white/85 border border-slate-200/85"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="text-xs font-bold text-slate-900">{item.title}</div>
                  <p className="text-xs text-slate-700 leading-relaxed">{item.body}</p>
                  <div className="text-[10px] font-mono text-slate-600">
                    {new Date(item.created_at).toLocaleString("vi-VN")}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={deletingAnnouncementId === item.id}
                  onClick={() => void handleDeleteAnnouncement(item.id)}
                  aria-label={`Xóa thông báo ${item.title}`}
                  className="liquid-btn-danger shrink-0 p-1.5 rounded-lg disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="liquid-glass-card p-5 sm:p-6 space-y-5">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600" aria-hidden="true" />
            <span>Bảo trì &amp; Đặt lại hệ thống</span>
          </h2>
          <p className="text-xs text-slate-700">
            Các thao tác dưới đây yêu cầu xác nhận hai bước để tránh mất dữ liệu ngoài ý muốn.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="p-4 rounded-2xl bg-white/85 border border-slate-200/85 space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                Khôi phục toàn bộ nội dung mặc định
              </h3>
              <p className="text-xs text-slate-700 leading-relaxed">
                Xóa toàn bộ kịch bản, từ vựng và thử thách Arena tùy chỉnh để quay về bộ học liệu gốc.
              </p>
            </div>

            <button
              type="button"
              disabled={isProcessing}
              onClick={requestResetContent}
              className="liquid-glass-btn inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold self-start disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Khôi phục toàn bộ nội dung mặc định</span>
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-white/85 border border-slate-200/85 space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                Xóa dữ liệu thống kê
              </h3>
              <p className="text-xs text-slate-700 leading-relaxed">
                Xóa toàn bộ lượt luyện nói, điểm yếu và lịch sử Arena đã ghi nhận (thường dùng trước khi bắt đầu đợt thu thập dữ liệu nghiên cứu mới).
              </p>
            </div>

            <button
              type="button"
              disabled={isProcessing}
              onClick={requestResetAnalytics}
              className="liquid-btn-danger inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold self-start disabled:opacity-50"
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

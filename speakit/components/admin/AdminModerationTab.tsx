"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Coins,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from "lucide-react";

interface ModerationIncidentItem {
  id: string;
  playerId: string | null;
  playerName: string;
  transferCode: string | null;
  source: string;
  roomOrTopic: string | null;
  content: string;
  category: string;
  severity: string;
  reason: string;
  aiProvider: string | null;
  status: "open" | "penalized" | "dismissed" | string;
  coinsDeducted: number;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

const SOURCE_LABELS: Record<string, string> = {
  "word-chain": "Syntax Bomb (Nối từ)",
  duel: "Code Review Duel",
  taboo: "Explain It Like I'm 5",
  party: "Outage At 3AM (Party)",
  practice: "Luyện nói kịch bản",
};

export function AdminModerationTab({
  onUnauthorized,
}: {
  onUnauthorized: () => void;
}) {
  const [incidents, setIncidents] = useState<ModerationIncidentItem[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [sensitiveCount, setSensitiveCount] = useState(0);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [coinInputs, setCoinInputs] = useState<Record<string, number>>({});
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/moderation", { cache: "no-store" });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Không thể tải danh sách kiểm duyệt.");
        return;
      }
      setIncidents(Array.isArray(data.incidents) ? data.incidents : []);
      setOpenCount(Number(data.openCount) || 0);
      setSensitiveCount(Number(data.sensitiveCount) || 0);
    } catch {
      setError("Lỗi kết nối máy chủ khi tải cảnh báo kiểm duyệt.");
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleResolve = async (
    item: ModerationIncidentItem,
    action: "penalize" | "dismiss"
  ) => {
    setBusyId(item.id);
    setError(null);
    const coins =
      coinInputs[item.id] ?? (item.category === "sensitive" ? 5 : 2);
    const note = noteInputs[item.id] ?? "";
    try {
      const res = await fetch("/api/admin/moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          id: item.id,
          coins,
          note,
        }),
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Không thể xử lý cảnh báo.");
        return;
      }
      setIncidents(Array.isArray(data.incidents) ? data.incidents : []);
      setOpenCount(Number(data.openCount) || 0);
      setSensitiveCount(Number(data.sensitiveCount) || 0);
    } catch {
      setError("Lỗi kết nối khi xử lý cảnh báo.");
    } finally {
      setBusyId(null);
    }
  };

  const visibleIncidents =
    filter === "open"
      ? incidents.filter((i) => i.status === "open")
      : incidents;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-bold text-ink">
              Kiểm duyệt AI &amp; Cảnh báo Từ ngữ Nhạy cảm
            </h2>
          </div>
          <p className="text-xs text-ink-muted">
            Tự động ghi nhận khi người chơi nhập từ ngữ nhạy cảm, xúc phạm hoặc trả lời lạc đề trong Arena &amp; Luyện nói.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1.5 rounded-pill bg-rose-50 border border-rose-300 text-rose-800 text-xs font-mono font-bold">
            Chờ xử lý: {openCount} ({sensitiveCount} nhạy cảm)
          </span>
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-paper border border-ink/20 text-xs font-mono font-semibold text-ink hover:bg-paper-muted disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setFilter("open")}
          className={`px-3.5 py-1.5 rounded-pill text-xs font-semibold border transition-colors ${
            filter === "open"
              ? "bg-ink text-white border-ink"
              : "bg-white text-ink border-ink/15 hover:bg-paper-muted"
          }`}
        >
          Chờ xử lý ({openCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`px-3.5 py-1.5 rounded-pill text-xs font-semibold border transition-colors ${
            filter === "all"
              ? "bg-ink text-white border-ink"
              : "bg-white text-ink border-ink/15 hover:bg-paper-muted"
          }`}
        >
          Tất cả ({incidents.length})
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-800 font-medium">
          {error}
        </div>
      )}

      {visibleIncidents.length === 0 ? (
        <div className="bg-white border border-ink/15 rounded-2xl p-8 text-center space-y-2 shadow-soft">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
          <div className="text-sm font-bold text-ink">
            {filter === "open"
              ? "Không có cảnh báo vi phạm nào đang chờ xử lý."
              : "Chưa có nhật ký kiểm duyệt nào."}
          </div>
          <p className="text-xs text-ink-muted">
            Mọi lượt dùng từ nhạy cảm hoặc lạc đề bị hệ thống/AI chặn sẽ hiện ngay tại đây.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleIncidents.map((item) => {
            const defaultCoins = item.category === "sensitive" ? 5 : 2;
            const currentCoins = coinInputs[item.id] ?? defaultCoins;
            const isOpen = item.status === "open";
            return (
              <div
                key={item.id}
                className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-soft space-y-3 ${
                  isOpen && item.category === "sensitive"
                    ? "border-rose-400"
                    : "border-ink/15"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-[11px] font-mono font-bold border ${
                        item.category === "sensitive"
                          ? "bg-rose-100 text-rose-800 border-rose-300"
                          : "bg-amber-100 text-amber-800 border-amber-300"
                      }`}
                    >
                      <AlertTriangle className="w-3 h-3" />
                      <span>
                        {item.category === "sensitive"
                          ? "Từ ngữ nhạy cảm"
                          : "Lạc đề / Không đúng trọng tâm"}
                      </span>
                    </span>
                    <span className="px-2.5 py-0.5 rounded-pill bg-paper border border-ink/15 text-[11px] font-mono text-ink">
                      {SOURCE_LABELS[item.source] ?? item.source}
                    </span>
                    {item.roomOrTopic && (
                      <span className="text-[11px] font-mono text-ink-muted">
                        • {item.roomOrTopic}
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] font-mono text-ink-muted">
                    {new Date(item.createdAt).toLocaleString("vi-VN")}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-ink">{item.playerName}</span>
                  {item.transferCode && (
                    <span className="px-2 py-0.5 rounded bg-paper border border-ink/15 font-mono text-[11px] text-ink">
                      {item.transferCode}
                    </span>
                  )}
                  {item.aiProvider && (
                    <span className="text-[11px] font-mono text-ink-muted">
                      ({item.aiProvider})
                    </span>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200 space-y-1">
                  <div className="text-[11px] font-mono uppercase text-rose-700 font-bold">
                    Nội dung người chơi gửi:
                  </div>
                  <p className="text-sm font-mono text-ink break-words">
                    &ldquo;{item.content}&rdquo;
                  </p>
                  <p className="text-xs text-rose-800">{item.reason}</p>
                </div>

                {isOpen ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-xs font-medium text-ink flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5 text-accent" />
                        <span>Trừ IT-Coin:</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={currentCoins}
                          onChange={(e) =>
                            setCoinInputs((prev) => ({
                              ...prev,
                              [item.id]: Math.max(
                                0,
                                Math.min(100, Number(e.target.value) || 0)
                              ),
                            }))
                          }
                          className="w-16 px-2 py-1 rounded-lg border border-ink/25 bg-paper font-mono text-xs text-ink"
                        />
                      </label>
                      <input
                        type="text"
                        placeholder="Ghi chú Admin (tuỳ chọn)..."
                        value={noteInputs[item.id] ?? ""}
                        onChange={(e) =>
                          setNoteInputs((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        className="px-2.5 py-1 rounded-lg border border-ink/20 bg-paper text-xs text-ink w-52"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void handleResolve(item, "dismiss")}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-pill bg-paper border border-ink/20 text-xs font-semibold text-ink hover:bg-paper-muted disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Bỏ qua</span>
                      </button>
                      <button
                        type="button"
                        disabled={busyId === item.id || !item.playerId}
                        title={
                          !item.playerId
                            ? "Khách chưa có hồ sơ DB để trừ Coin"
                            : "Trừ IT-Coin ngay"
                        }
                        onClick={() => void handleResolve(item, "penalize")}
                        className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-pill bg-accent hover:bg-accent-hover text-white border border-ink text-xs font-bold shadow-soft disabled:opacity-50"
                      >
                        <Coins className="w-3.5 h-3.5" />
                        <span>
                          {busyId === item.id
                            ? "Đang xử lý..."
                            : `Trừ ${currentCoins} Coin & Phạt`}
                        </span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-ink-muted pt-1 border-t border-ink/10">
                    <span>
                      Trạng thái:{" "}
                      <strong className="text-ink">
                        {item.status === "penalized"
                          ? `Đã phạt -${item.coinsDeducted} IT-Coin`
                          : "Đã bỏ qua"}
                      </strong>
                    </span>
                    {item.adminNote && <span>Ghi chú: {item.adminNote}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

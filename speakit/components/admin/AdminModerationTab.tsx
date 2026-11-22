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
      <div className="liquid-glass-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-cyan-300" />
            <h2 className="text-lg font-bold text-white">
              Kiểm duyệt AI &amp; Cảnh báo Từ ngữ Nhạy cảm
            </h2>
          </div>
          <p className="text-xs text-slate-300">
            Tự động ghi nhận khi người chơi nhập từ ngữ nhạy cảm, xúc phạm hoặc trả lời lạc đề trong Arena &amp; Luyện nói.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1.5 rounded-full bg-rose-500/20 border border-rose-400/45 text-rose-100 text-xs font-mono font-bold">
            Chờ xử lý: {openCount} ({sensitiveCount} nhạy cảm)
          </span>
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-semibold disabled:opacity-50"
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
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
            filter === "open"
              ? "bg-cyan-500/25 border-cyan-400/55 text-cyan-100"
              : "liquid-glass-btn text-slate-200"
          }`}
        >
          Chờ xử lý ({openCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
            filter === "all"
              ? "bg-cyan-500/25 border-cyan-400/55 text-cyan-100"
              : "liquid-glass-btn text-slate-200"
          }`}
        >
          Tất cả ({incidents.length})
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/20 border border-rose-400/45 text-xs text-rose-100 font-medium">
          {error}
        </div>
      )}

      {visibleIncidents.length === 0 ? (
        <div className="liquid-glass-card p-8 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
          <div className="text-sm font-bold text-white">
            {filter === "open"
              ? "Không có cảnh báo vi phạm nào đang chờ xử lý."
              : "Chưa có nhật ký kiểm duyệt nào."}
          </div>
          <p className="text-xs text-slate-300">
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
                className={`liquid-glass-card-lite p-4 sm:p-5 space-y-3 ${
                  isOpen && item.category === "sensitive"
                    ? "!border-rose-400/55"
                    : ""
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border ${
                        item.category === "sensitive"
                          ? "bg-rose-500/20 text-rose-200 border-rose-400/45"
                          : "bg-amber-500/20 text-amber-200 border-amber-400/45"
                      }`}
                    >
                      <AlertTriangle className="w-3 h-3" />
                      <span>
                        {item.category === "sensitive"
                          ? "Từ ngữ nhạy cảm"
                          : "Lạc đề / Không đúng trọng tâm"}
                      </span>
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[11px] font-mono text-slate-200">
                      {SOURCE_LABELS[item.source] ?? item.source}
                    </span>
                    {item.roomOrTopic && (
                      <span className="text-[11px] font-mono text-slate-400">
                        • {item.roomOrTopic}
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] font-mono text-slate-400">
                    {new Date(item.createdAt).toLocaleString("vi-VN")}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-white">{item.playerName}</span>
                  {item.transferCode && (
                    <span className="px-2 py-0.5 rounded bg-white/10 border border-white/15 font-mono text-[11px] text-cyan-200">
                      {item.transferCode}
                    </span>
                  )}
                  {item.aiProvider && (
                    <span className="text-[11px] font-mono text-slate-400">
                      ({item.aiProvider})
                    </span>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-400/35 space-y-1">
                  <div className="text-[11px] font-mono uppercase text-rose-200 font-bold">
                    Nội dung người chơi gửi:
                  </div>
                  <p className="text-sm font-mono text-white break-words">
                    &ldquo;{item.content}&rdquo;
                  </p>
                  <p className="text-xs text-rose-200/90">{item.reason}</p>
                </div>

                {isOpen ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5 text-amber-400" />
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
                          className="liquid-glass-input w-16 px-2 py-1 rounded-lg font-mono text-xs"
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
                        className="liquid-glass-input px-2.5 py-1 rounded-lg text-xs w-52"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void handleResolve(item, "dismiss")}
                        className="liquid-glass-btn inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold disabled:opacity-50"
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
                        className="liquid-btn-danger inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-bold disabled:opacity-50"
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
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-300 pt-1 border-t border-white/15">
                    <span>
                      Trạng thái:{" "}
                      <strong className="text-white">
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

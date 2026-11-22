"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Lock, RefreshCw, ShieldAlert, Unlock, X } from "lucide-react";
import type {
  FlaggedPlayerItem,
  LeaveRequestItem,
} from "../../lib/arena-leave-policy";
import { formatDateTimeVI } from "./adminShared";

interface AdminLeavesTabProps {
  onUnauthorized: () => void;
}

const GAME_LABELS: Record<string, string> = {
  duel: "Code Review Duel",
  taboo: "Explain It Like I'm 5",
  "word-chain": "Syntax Bomb",
  party: "Outage At 3AM",
};

export function AdminLeavesTab({ onUnauthorized }: AdminLeavesTabProps) {
  const [requests, setRequests] = useState<LeaveRequestItem[]>([]);
  const [flaggedPlayers, setFlaggedPlayers] = useState<FlaggedPlayerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [penaltyMap, setPenaltyMap] = useState<Record<string, number>>({});
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const loadLeaves = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/leaves", { cache: "no-store" });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      if (res.ok) {
        const data = (await res.json()) as {
          requests?: LeaveRequestItem[];
          flaggedPlayers?: FlaggedPlayerItem[];
        };
        setRequests(Array.isArray(data.requests) ? data.requests : []);
        setFlaggedPlayers(Array.isArray(data.flaggedPlayers) ? data.flaggedPlayers : []);
      }
    } catch {
      setNotice("Không thể tải danh sách đơn xin thoát lúc này.");
    } finally {
      setIsLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    void loadLeaves();
  }, [loadLeaves]);

  const callAdminAction = async (key: string, payload: Record<string, unknown>, okText: string) => {
    setBusyKey(key);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        requests?: LeaveRequestItem[];
        flaggedPlayers?: FlaggedPlayerItem[];
      } | null;
      if (!res.ok || !data?.ok) {
        setNotice(data?.error || "Thao tác thất bại.");
        return;
      }
      setRequests(Array.isArray(data.requests) ? data.requests : []);
      setFlaggedPlayers(Array.isArray(data.flaggedPlayers) ? data.flaggedPlayers : []);
      setNotice(okText);
    } finally {
      setBusyKey(null);
    }
  };

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const historyRequests = requests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <div className="liquid-glass-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-sky-600" />
            <span>Duyệt lý do thoát game &amp; Tài khoản vi phạm</span>
          </h2>
          <p className="text-xs text-slate-700 mt-0.5">
            Đơn hợp lý có thể bấm Duyệt (không trừ coin). Không hợp lý thì nhập số coin phạt và Từ chối.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadLeaves()}
          disabled={isLoading}
          className="liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Tải lại</span>
        </button>
      </div>

      {notice && (
        <div role="status" className="p-3 rounded-xl bg-sky-50/90 border border-sky-300/80 text-xs font-medium text-sky-900">
          {notice}
        </div>
      )}

      <section className="liquid-glass-card p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-900">
          Đơn xin thoát đang chờ duyệt ({pendingRequests.length})
        </h3>

        {isLoading ? (
          <div className="py-6 flex items-center gap-2 text-xs text-slate-700">
            <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
            <span>Đang tải...</span>
          </div>
        ) : pendingRequests.length === 0 ? (
          <p className="text-xs text-slate-600">Hiện chưa có đơn xin thoát nào đang chờ duyệt.</p>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map((req) => {
              const penalty = penaltyMap[req.id] ?? 3;
              const note = noteMap[req.id] ?? "";
              return (
                <div
                  key={req.id}
                  className="p-4 rounded-xl bg-white/85 border border-slate-200/85 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="font-bold text-slate-900">
                      {req.playerName} •{" "}
                      <span className="font-mono text-sky-700">
                        {GAME_LABELS[req.gameId] ?? req.gameId}
                      </span>
                      {req.roomCode ? ` (${req.roomCode})` : ""}
                    </div>
                    <span className="font-mono text-[11px] text-slate-600">
                      {formatDateTimeVI(req.createdAt)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-900 bg-slate-50/90 border border-slate-200/85 rounded-lg p-2.5 leading-relaxed">
                    Lý do: &ldquo;{req.reason || "(trống)"}&rdquo;
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-[11px] font-mono text-slate-700 flex items-center gap-1.5">
                      <span>Trừ nếu từ chối (Coin):</span>
                      <input
                        type="number"
                        min={0}
                        max={50}
                        value={penalty}
                        onChange={(e) =>
                          setPenaltyMap((prev) => ({
                            ...prev,
                            [req.id]: Math.max(0, Math.min(50, Number(e.target.value) || 0)),
                          }))
                        }
                        className="liquid-glass-input w-16 px-2 py-1 rounded-lg text-xs font-mono"
                      />
                    </label>

                    <input
                      type="text"
                      value={note}
                      onChange={(e) =>
                        setNoteMap((prev) => ({ ...prev, [req.id]: e.target.value }))
                      }
                      placeholder="Ghi chú của Admin (tuỳ chọn)..."
                      className="liquid-glass-input flex-1 min-w-[180px] px-2.5 py-1 rounded-lg text-xs"
                    />

                    <button
                      type="button"
                      disabled={busyKey !== null}
                      onClick={() =>
                        void callAdminAction(
                          `approve-${req.id}`,
                          { action: "approve", id: req.id, note },
                          `Đã duyệt đơn của ${req.playerName} (không trừ Coin).`
                        )
                      }
                      className="liquid-btn-success inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Duyệt (không trừ)</span>
                    </button>

                    <button
                      type="button"
                      disabled={busyKey !== null}
                      onClick={() =>
                        void callAdminAction(
                          `reject-${req.id}`,
                          { action: "reject", id: req.id, penaltyCoins: penalty, note },
                          `Đã từ chối đơn của ${req.playerName} và trừ ${penalty} IT-Coin.`
                        )
                      }
                      className="liquid-btn-danger inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Từ chối &amp; trừ coin</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="liquid-glass-card p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-900">
          Người chơi có lịch sử thoát ngang / đang bị khóa ({flaggedPlayers.length})
        </h3>

        {flaggedPlayers.length === 0 ? (
          <p className="text-xs text-slate-600">Chưa có tài khoản nào bị ghi nhận thoát ngang.</p>
        ) : (
          <div className="space-y-2.5">
            {flaggedPlayers.map((p) => (
              <div
                key={p.id}
                className="p-3.5 rounded-xl bg-white/85 border border-slate-200/85 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-900 flex flex-wrap items-center gap-2">
                    <span>{p.displayName}</span>
                    <span className="font-mono text-[11px] text-slate-600">
                      ({p.transferCode})
                    </span>
                    {p.frozenNow && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-100/90 border border-rose-300/80 text-rose-800 text-[10px] font-mono font-bold">
                        {p.permanent
                          ? "KHÓA VĨNH VIỄN"
                          : `KHÓA ĐẾN ${new Date(p.frozenUntil!).toLocaleString("vi-VN")}`}
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[11px] text-slate-700">
                    Thoát kỳ này: {p.leaveCount} • Tổng vi phạm: {p.forfeitsTotal} • Số lần bị khóa:{" "}
                    {p.freezeStrikes} • Coin: {p.itCoins}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {p.frozenNow ? (
                    <button
                      type="button"
                      disabled={busyKey !== null}
                      onClick={() =>
                        void callAdminAction(
                          `unfreeze-${p.id}`,
                          { action: "unfreeze", playerId: p.id, resetStrikes: false },
                          `Đã mở khóa cho ${p.displayName}.`
                        )
                      }
                      className="liquid-btn-success inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold disabled:opacity-50"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Mở khóa</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busyKey !== null}
                      onClick={() =>
                        void callAdminAction(
                          `freeze-${p.id}`,
                          { action: "freeze", playerId: p.id, minutes: 30 },
                          `Đã đóng băng ${p.displayName} trong 30 phút.`
                        )
                      }
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-100/90 hover:bg-amber-200/90 border border-amber-300/80 text-amber-900 text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Đóng băng 30 phút</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {historyRequests.length > 0 && (
        <section className="liquid-glass-card p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900">Lịch sử xử lý gần đây ({historyRequests.length})</h3>
          <div className="space-y-2">
            {historyRequests.slice(0, 20).map((item) => (
              <div
                key={item.id}
                className="px-3 py-2 rounded-xl bg-white/85 border border-slate-200/85 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div>
                  <span className="font-semibold text-slate-900">{item.playerName}</span>{" "}
                  <span className="text-slate-700">
                    ({GAME_LABELS[item.gameId] ?? item.gameId})
                  </span>
                  {item.reason && (
                    <span className="text-slate-600"> — &ldquo;{item.reason}&rdquo;</span>
                  )}
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span
                    className={`px-2 py-0.5 rounded-full border ${
                      item.status === "approved"
                        ? "bg-emerald-100/90 border-emerald-300/80 text-emerald-800"
                        : "bg-rose-100/90 border-rose-300/80 text-rose-800"
                    }`}
                  >
                    {item.status === "approved"
                      ? "Đã duyệt (0 coin)"
                      : item.status === "rejected"
                      ? `Từ chối (-${item.penaltyCoins} coin)`
                      : `Thoát ngang (-${item.penaltyCoins} coin)`}
                  </span>
                  <span className="text-slate-600">{formatDateTimeVI(item.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

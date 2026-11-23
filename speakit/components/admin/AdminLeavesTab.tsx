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
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-blue-700 dark:text-blue-400" />
            <span>Duyệt lý do thoát game &amp; Tài khoản vi phạm</span>
          </h2>
          <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">
            Đơn hợp lý có thể bấm Duyệt (không trừ coin). Không hợp lý thì nhập số coin phạt và Từ chối.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadLeaves()}
          disabled={isLoading}
          className="liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Tải lại</span>
        </button>
      </div>

      {notice && (
        <div role="status" className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-sm font-medium text-blue-700 dark:text-blue-300">
          {notice}
        </div>
      )}

      <section className="liquid-glass-card p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          Đơn xin thoát đang chờ duyệt ({pendingRequests.length})
        </h3>

        {isLoading ? (
          <div className="py-6 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <Loader2 className="w-4 h-4 animate-spin text-blue-700 dark:text-blue-400" />
            <span>Đang tải...</span>
          </div>
        ) : pendingRequests.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">Hiện chưa có đơn xin thoát nào đang chờ duyệt.</p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
            {pendingRequests.map((req) => {
              const penalty = penaltyMap[req.id] ?? 3;
              const note = noteMap[req.id] ?? "";
              return (
                <div
                  key={req.id}
                  className="py-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="font-bold text-slate-900 dark:text-slate-100">
                      {req.playerName} :{" "}
                      <span className="font-mono text-blue-700 dark:text-blue-400">
                        {GAME_LABELS[req.gameId] ?? req.gameId}
                      </span>
                      {req.roomCode ? ` (${req.roomCode})` : ""}
                    </div>
                    <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
                      {formatDateTimeVI(req.createdAt)}
                    </span>
                  </div>

                  <p className="text-sm text-slate-900 dark:text-slate-100 border-l-2 border-blue-700 dark:border-blue-500 pl-3 py-1 leading-relaxed">
                    Lý do: &ldquo;{req.reason || "(trống)"}&rdquo;
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs font-mono text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
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
                      className="liquid-btn-success inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
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
                      className="liquid-btn-danger inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
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
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          Người chơi có lịch sử thoát ngang / đang bị khóa ({flaggedPlayers.length})
        </h3>

        {flaggedPlayers.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">Chưa có tài khoản nào bị ghi nhận thoát ngang.</p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
            {flaggedPlayers.map((p) => (
              <div
                key={p.id}
                className="py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-900 dark:text-slate-100 flex flex-wrap items-center gap-2">
                    <span>{p.displayName}</span>
                    <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
                      ({p.transferCode})
                    </span>
                    {p.frozenNow && (
                      <span className="px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-[11px] font-mono font-bold">
                        {p.permanent
                          ? "KHÓA VĨNH VIỄN"
                          : `KHÓA ĐẾN ${new Date(p.frozenUntil!).toLocaleString("vi-VN")}`}
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-xs text-slate-700 dark:text-slate-300">
                    Thoát kỳ này: {p.leaveCount} : Tổng vi phạm: {p.forfeitsTotal} : Số lần bị khóa:{" "}
                    {p.freezeStrikes} : Coin: {p.itCoins}
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
                      className="liquid-btn-success inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
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
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-semibold transition-colors disabled:opacity-50"
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
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Lịch sử xử lý gần đây ({historyRequests.length})</h3>
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
            {historyRequests.slice(0, 20).map((item) => (
              <div
                key={item.id}
                className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{item.playerName}</span>{" "}
                  <span className="text-slate-700 dark:text-slate-300">
                    ({GAME_LABELS[item.gameId] ?? item.gameId})
                  </span>
                  {item.reason && (
                    <span className="text-slate-600 dark:text-slate-400"> : &ldquo;{item.reason}&rdquo;</span>
                  )}
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span
                    className={`px-2 py-0.5 rounded-full border ${
                      item.status === "approved"
                        ? "bg-green-50 dark:bg-green-950/40 border-green-300 dark:border-green-800 text-green-700 dark:text-green-300"
                        : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-600 dark:text-red-300"
                    }`}
                  >
                    {item.status === "approved"
                      ? "Đã duyệt (0 coin)"
                      : item.status === "rejected"
                      ? `Từ chối (-${item.penaltyCoins} coin)`
                      : `Thoát ngang (-${item.penaltyCoins} coin)`}
                  </span>
                  <span className="text-slate-600 dark:text-slate-400">{formatDateTimeVI(item.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

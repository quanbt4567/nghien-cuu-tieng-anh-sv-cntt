"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, Clock, Loader2, LogOut, Send, ShieldAlert, X } from "lucide-react";
import {
  registerArenaLeaveHost,
  type ArenaLeaveRequest,
} from "../../lib/arena-leave-client";
import {
  FORFEIT_PENALTY_COINS,
  MAX_FORFEITS_BEFORE_FREEZE,
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH,
} from "../../lib/arena-leave-policy";
import {
  readBackupTransferCode,
  syncGuestProfileFromServer,
} from "../../lib/guestClient";
import type { PublicGuestPlayer } from "../../lib/db";

interface LeaveStatusPayload {
  ok?: boolean;
  enforced?: boolean;
  leaveCount?: number;
  limit?: number;
  remaining?: number;
  freezeStrikes?: number;
  frozen?: boolean;
  permanent?: boolean;
  frozenUntil?: string | null;
  pendingCount?: number;
}

interface LeaveActionResponse {
  ok?: boolean;
  error?: string;
  enforced?: boolean;
  mode?: "forfeit" | "reason";
  penaltyCoins?: number;
  leaveCount?: number;
  limit?: number;
  remaining?: number;
  frozenUntil?: string | null;
  permanent?: boolean;
  freezeMinutes?: number;
  player?: PublicGuestPlayer | null;
}

const GAME_NAMES_VI: Record<string, string> = {
  duel: "Code Review Duel",
  taboo: "Explain It Like I'm 5",
  "word-chain": "Syntax Bomb",
  party: "Outage At 3AM",
};

export function ArenaLeaveGuardHost() {
  const [activeRequest, setActiveRequest] = useState<ArenaLeaveRequest | null>(null);
  const [showReasonForm, setShowReasonForm] = useState(false);
  const [reason, setReason] = useState("");
  const [statusInfo, setStatusInfo] = useState<LeaveStatusPayload | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [submittingMode, setSubmittingMode] = useState<"forfeit" | "reason" | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [toastNotice, setToastNotice] = useState<{
    tone: "warn" | "ok";
    text: string;
  } | null>(null);

  useEffect(() => {
    return registerArenaLeaveHost((request) => {
      setActiveRequest(request);
      setShowReasonForm(false);
      setReason("");
      setErrorText(null);
      setLoadingStatus(true);
      void fetch("/api/arena/leave", { cache: "no-store" })
        .then((res) => (res.ok ? (res.json() as Promise<LeaveStatusPayload>) : null))
        .then((data) => {
          if (data) setStatusInfo(data);
        })
        .catch(() => {})
        .finally(() => setLoadingStatus(false));
    });
  }, []);

  const closeDialog = useCallback(() => {
    if (submittingMode !== null) return;
    setActiveRequest(null);
    setErrorText(null);
  }, [submittingMode]);

  useEffect(() => {
    if (!activeRequest) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDialog();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeRequest, closeDialog]);

  useEffect(() => {
    if (!toastNotice) return;
    const timer = window.setTimeout(() => setToastNotice(null), 6500);
    return () => window.clearTimeout(timer);
  }, [toastNotice]);

  const handleForfeitLeave = async () => {
    if (!activeRequest || submittingMode) return;
    setSubmittingMode("forfeit");
    setErrorText(null);
    try {
      const res = await fetch("/api/arena/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: activeRequest.gameId,
          roomCode: activeRequest.roomCode ?? null,
          mode: "forfeit",
          backupTransferCode: readBackupTransferCode(),
        }),
      });
      const data = (await res.json().catch(() => null)) as LeaveActionResponse | null;
      if (!res.ok || !data?.ok) {
        setErrorText(data?.error || "Không thể xử lý yêu cầu rời phòng. Vui lòng thử lại.");
        return;
      }

      if (data.player) {
        syncGuestProfileFromServer(data.player);
      }

      const req = activeRequest;
      setActiveRequest(null);
      req.performLeave(true);

      if (data.frozenUntil) {
        if (data.permanent) {
          setToastNotice({
            tone: "warn",
            text: "Bạn đã thoát ngang quá giới hạn và tài khoản Arena bị khóa đến khi Admin mở lại.",
          });
        } else {
          const untilLabel = new Date(data.frozenUntil).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          });
          setToastNotice({
            tone: "warn",
            text: `Đã trừ ${data.penaltyCoins ?? FORFEIT_PENALTY_COINS} IT-Coin và tạm khóa vào Arena đến ${untilLabel} do thoát ngang quá nhiều lần.`,
          });
        }
      } else if (data.enforced) {
        setToastNotice({
          tone: "warn",
          text: `Đã trừ ${data.penaltyCoins ?? FORFEIT_PENALTY_COINS} IT-Coin do thoát giữa trận (còn ${data.remaining ?? 0} lần trước khi bị khóa tạm thời).`,
        });
      }
    } catch {
      setErrorText("Mất kết nối máy chủ, chưa thể rời phòng. Bạn vẫn đang ở trong trận.");
    } finally {
      setSubmittingMode(null);
    }
  };

  const handleSubmitReason = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeRequest || submittingMode) return;
    const cleaned = reason.trim().replace(/\s+/g, " ");
    if (cleaned.length < REASON_MIN_LENGTH) {
      setErrorText(`Hãy viết lý do rõ ràng ít nhất ${REASON_MIN_LENGTH} ký tự.`);
      return;
    }

    setSubmittingMode("reason");
    setErrorText(null);
    try {
      const res = await fetch("/api/arena/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: activeRequest.gameId,
          roomCode: activeRequest.roomCode ?? null,
          mode: "reason",
          reason: cleaned,
          backupTransferCode: readBackupTransferCode(),
        }),
      });
      const data = (await res.json().catch(() => null)) as LeaveActionResponse | null;
      if (!res.ok || !data?.ok) {
        setErrorText(data?.error || "Không gửi được đơn xin thoát. Vui lòng thử lại.");
        return;
      }

      if (data.player) {
        syncGuestProfileFromServer(data.player);
      }

      const req = activeRequest;
      setActiveRequest(null);
      req.performLeave(true);
      setToastNotice({
        tone: "ok",
        text: "Đã gửi lý do xin thoát cho Admin xem xét. Nếu hợp lý bạn sẽ không bị trừ Coin.",
      });
    } catch {
      setErrorText("Mất kết nối máy chủ khi gửi lý do. Vui lòng thử lại.");
    } finally {
      setSubmittingMode(null);
    }
  };

  const leaveCount = statusInfo?.leaveCount ?? 0;
  const limit = statusInfo?.limit ?? MAX_FORFEITS_BEFORE_FREEZE;
  const remaining = statusInfo?.remaining ?? limit;

  return (
    <>
      {toastNotice && (
        <div
          role="status"
          className={`fixed top-20 right-4 z-50 max-w-sm rounded-2xl border-2 border-ink px-4 py-3 text-xs font-medium shadow-hard flex items-start gap-2.5 ${
            toastNotice.tone === "warn"
              ? "bg-amber-50 text-ink"
              : "bg-emerald-50 text-ink"
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-accent shrink-0 mt-0.5" aria-hidden="true" />
          <span className="flex-1 leading-relaxed">{toastNotice.text}</span>
          <button
            type="button"
            onClick={() => setToastNotice(null)}
            aria-label="Đóng thông báo"
            className="text-ink-muted hover:text-ink"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {activeRequest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 backdrop-blur-[1px] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="arena-leave-title"
          onClick={closeDialog}
        >
          <div
            className="w-full max-w-md bg-white border-2 border-ink rounded-2xl shadow-hard overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-paper border-b border-ink/15">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white">
                  <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                </span>
                <span className="text-xs font-mono font-bold uppercase text-ink">
                  Trận đấu đang diễn ra
                </span>
              </div>
              <button
                type="button"
                disabled={submittingMode !== null}
                onClick={closeDialog}
                aria-label="Đóng hộp thoại"
                className="w-7 h-7 rounded-full border border-ink/15 bg-white flex items-center justify-center text-ink-muted hover:text-ink disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <h3 id="arena-leave-title" className="text-base font-bold text-ink">
                  Bạn muốn rời khỏi {GAME_NAMES_VI[activeRequest.gameId] ?? "trận đấu"} giữa chừng?
                </h3>
                <p className="text-xs text-ink-muted leading-relaxed">
                  Thoát ngang khi đang chơi sẽ không nhận được điểm thưởng của ván này và bị trừ{" "}
                  <strong className="text-rose-700">{FORFEIT_PENALTY_COINS} IT-Coin</strong>. Nếu
                  thoát quá {limit} lần, tài khoản Arena sẽ bị khóa tạm thời.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-paper border border-ink/15 text-xs space-y-1">
                {loadingStatus ? (
                  <div className="flex items-center gap-1.5 text-ink-muted">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang kiểm tra lịch sử thoát của bạn...</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between font-mono">
                      <span className="text-ink-muted">Số lần thoát ngang hiện tại:</span>
                      <span className="font-bold text-ink">
                        {leaveCount} / {limit} lần
                      </span>
                    </div>
                    {remaining <= 2 && (
                      <p className="text-[11px] font-semibold text-rose-700">
                        Cảnh báo: Bạn chỉ còn {remaining} lần nữa là sẽ bị tạm khóa tài khoản!
                      </p>
                    )}
                    {statusInfo?.frozen && (
                      <p className="text-[11px] font-semibold text-rose-700 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>
                          {statusInfo.permanent
                            ? "Tài khoản đang bị khóa vào Arena đến khi Admin mở lại."
                            : "Tài khoản đang trong thời gian tạm khóa."}
                        </span>
                      </p>
                    )}
                  </>
                )}
              </div>

              {errorText && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium"
                >
                  {errorText}
                </div>
              )}

              {showReasonForm ? (
                <form onSubmit={handleSubmitReason} className="space-y-3">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="arena-leave-reason"
                      className="block text-xs font-semibold text-ink"
                    >
                      Ghi rõ lý do thoát để Admin xét duyệt ({REASON_MIN_LENGTH}–{REASON_MAX_LENGTH} ký tự):
                    </label>
                    <textarea
                      id="arena-leave-reason"
                      rows={3}
                      maxLength={REASON_MAX_LENGTH}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Ví dụ: Micro bị lỗi không thu âm được, hoặc mạng bị rớt giữa ván..."
                      className="w-full px-3 py-2 text-xs bg-paper border border-ink/20 rounded-xl text-ink focus:outline-none focus:border-accent"
                    />
                    <div className="flex items-center justify-between text-[11px] font-mono text-ink-muted">
                      <span>Hợp lý sẽ được tha, không hợp lý Admin sẽ trừ Coin.</span>
                      <span>
                        {reason.trim().length}/{REASON_MAX_LENGTH}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={submittingMode !== null}
                      onClick={() => setShowReasonForm(false)}
                      className="px-3.5 py-2 rounded-pill bg-paper border border-ink/20 text-xs font-semibold text-ink hover:bg-paper-muted"
                    >
                      Quay lại
                    </button>
                    <button
                      type="submit"
                      disabled={submittingMode !== null}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-ink text-white text-xs font-bold hover:bg-ink/90 disabled:opacity-50"
                    >
                      {submittingMode === "reason" ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>Gửi lý do &amp; Rời phòng</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={submittingMode !== null}
                    onClick={closeDialog}
                    className="w-full py-2.5 px-4 rounded-pill bg-ink text-white text-xs font-bold hover:bg-ink/90 transition-colors"
                  >
                    Ở lại chơi tiếp
                  </button>

                  <button
                    type="button"
                    disabled={submittingMode !== null}
                    onClick={() => setShowReasonForm(true)}
                    className="w-full py-2.5 px-4 rounded-pill bg-paper border border-ink/25 text-ink text-xs font-semibold hover:bg-paper-muted transition-colors"
                  >
                    Xin thoát có lý do (chờ Admin duyệt)
                  </button>

                  <button
                    type="button"
                    disabled={submittingMode !== null}
                    onClick={() => void handleForfeitLeave()}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-4 rounded-pill bg-rose-50 border border-rose-300 text-rose-700 text-xs font-semibold hover:bg-rose-100 transition-colors disabled:opacity-50"
                  >
                    {submittingMode === "forfeit" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <LogOut className="w-3.5 h-3.5" />
                    )}
                    <span>
                      Thoát ngang ngay (mất {FORFEIT_PENALTY_COINS} IT-Coin, tính 1 lần thoát ngang)
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

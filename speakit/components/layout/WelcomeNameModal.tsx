"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import {
  initOrHydrateGuestSession,
  loginAccountAction,
  registerAccountAction,
} from "../../app/actions/leaderboard";
import {
  GUEST_PROFILE_UPDATED_EVENT,
  OPEN_AUTH_MODAL_EVENT,
  readBackupTransferCode,
  syncGuestProfileFromServer,
} from "../../lib/guestClient";
import type { PublicGuestPlayer } from "../../lib/db";

const NAME_PROMPTED_STORAGE_KEY = "speakit_name_prompted_v1";
const LOCAL_DISPLAY_NAME_KEY = "speakit_local_display_name_v1";

export function WelcomeNameModal() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [mustAuthenticate, setMustAuthenticate] = useState(true);
  const [tab, setTab] = useState<"login" | "register">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [transferCode, setTransferCode] = useState("");
  const [legacyNotice, setLegacyNotice] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hydrateSession = useCallback(async () => {
    const backupCode = readBackupTransferCode();
    try {
      const session = await initOrHydrateGuestSession(backupCode);
      if (session.mode === "online" && session.player?.email) {
        syncGuestProfileFromServer(session.player);
        try {
          window.localStorage.setItem(NAME_PROMPTED_STORAGE_KEY, "1");
          window.localStorage.setItem(
            LOCAL_DISPLAY_NAME_KEY,
            session.player.displayName
          );
        } catch {
        }
        setMustAuthenticate(false);
        setIsOpen(false);
        setLegacyNotice(null);
        return;
      }

      if (session.player && !session.player.email) {
        syncGuestProfileFromServer(session.player);
        setTab("register");
        setDisplayName((prev) => prev || session.player!.displayName);
        setTransferCode(session.player.transferCode);
        setLegacyNotice(
          `Hồ sơ hiện tại (${session.player.transferCode}) chưa liên kết Email & Mật khẩu. Hãy tạo mật khẩu để bảo vệ toàn bộ Coin, điểm và hiệu ứng của bạn.`
        );
      } else if (backupCode) {
        setTransferCode((prev) => prev || backupCode);
      }
    } catch {
    }

    setMustAuthenticate(true);
    setIsOpen(true);
  }, []);

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    void hydrateSession();
  }, [hydrateSession, pathname]);

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;

    const handleOpenRequest = () => {
      setError(null);
      setIsOpen(true);
    };

    const handleProfileUpdated = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const player = event.detail as PublicGuestPlayer | null;
      if (!player || !player.email) {
        setMustAuthenticate(true);
        setError(null);
        setPassword("");
        setIsOpen(true);
      }
    };

    window.addEventListener(OPEN_AUTH_MODAL_EVENT, handleOpenRequest);
    window.addEventListener(GUEST_PROFILE_UPDATED_EVENT, handleProfileUpdated);
    return () => {
      window.removeEventListener(OPEN_AUTH_MODAL_EVENT, handleOpenRequest);
      window.removeEventListener(GUEST_PROFILE_UPDATED_EVENT, handleProfileUpdated);
    };
  }, [pathname]);

  if (!isOpen || pathname.startsWith("/admin")) {
    return null;
  }

  const handleCompleteAuth = (player: PublicGuestPlayer) => {
    syncGuestProfileFromServer(player);
    try {
      window.localStorage.setItem(NAME_PROMPTED_STORAGE_KEY, "1");
      window.localStorage.setItem(LOCAL_DISPLAY_NAME_KEY, player.displayName);
    } catch {
    }
    setError(null);
    setPassword("");
    setLegacyNotice(null);
    setMustAuthenticate(false);
    setIsOpen(false);
    router.refresh();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    setError(null);

    if (tab === "login") {
      if (!email.trim() || !password) {
        setError("Vui lòng nhập đầy đủ Email và Mật khẩu.");
        return;
      }
      setIsSubmitting(true);
      try {
        const res = await loginAccountAction({
          email,
          password,
        });
        if (!res.ok || !res.player) {
          setError(res.error || "Đăng nhập thất bại. Vui lòng thử lại.");
          return;
        }
        handleCompleteAuth(res.player);
      } catch {
        setError("Không thể kết nối máy chủ để đăng nhập.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const cleanedName = displayName.trim().replace(/\s+/g, " ");
    if (cleanedName.length < 2 || cleanedName.length > 24) {
      setError("Tên hiển thị cần từ 2 đến 24 ký tự.");
      return;
    }
    if (!email.trim()) {
      setError("Vui lòng nhập địa chỉ Email.");
      return;
    }
    if (password.length < 6) {
      setError("Mật khẩu cần tối thiểu 6 ký tự.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await registerAccountAction({
        email,
        password,
        displayName: cleanedName,
        transferCode: transferCode.trim() || undefined,
      });
      if (!res.ok || !res.player) {
        setError(res.error || "Đăng ký thất bại. Vui lòng thử lại.");
        return;
      }
      handleCompleteAuth(res.player);
    } catch {
      setError("Không thể kết nối máy chủ để đăng ký.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-[3px] flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="w-full max-w-md bg-white border border-ink/15 rounded-2xl p-6 shadow-soft space-y-5 relative my-auto">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-pill bg-accent-light border border-accent/30 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-accent" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 id="auth-modal-title" className="text-lg font-bold text-ink">
              {tab === "login"
                ? "Đăng nhập tài khoản SpeakIT"
                : "Đăng ký tài khoản SpeakIT"}
            </h2>
            <p className="text-xs text-ink-muted leading-relaxed">
              Đăng nhập hoặc tạo tài khoản để lưu điểm, IT-Coin và thi đấu Arena.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 p-1 bg-paper rounded-xl border border-ink/15">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              setTab("login");
              setError(null);
            }}
            className={`inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
              tab === "login"
                ? "bg-ink text-white shadow-soft"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Đăng nhập</span>
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              setTab("register");
              setError(null);
            }}
            className={`inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
              tab === "register"
                ? "bg-ink text-white shadow-soft"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Đăng ký tài khoản</span>
          </button>
        </div>

        {legacyNotice && tab === "register" && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 leading-relaxed">
            {legacyNotice}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {tab === "register" && (
            <div className="space-y-1">
              <label
                htmlFor="auth-display-name"
                className="block text-xs font-semibold text-ink"
              >
                Tên hiển thị (2–24 ký tự)
              </label>
              <input
                id="auth-display-name"
                type="text"
                maxLength={24}
                required
                disabled={isSubmitting}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="VD: Minh Quân, Lan Anh..."
                className="w-full px-3.5 py-2.5 text-sm bg-paper border border-ink/20 rounded-xl text-ink focus:outline-none focus:border-accent disabled:opacity-60"
              />
            </div>
          )}

          <div className="space-y-1">
            <label
              htmlFor="auth-email"
              className="block text-xs font-semibold text-ink"
            >
              Email
            </label>
            <div className="relative">
              <Mail
                className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                disabled={isSubmitting}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tenban@gmail.com"
                className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-paper border border-ink/20 rounded-xl text-ink focus:outline-none focus:border-accent disabled:opacity-60"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="auth-password"
              className="block text-xs font-semibold text-ink"
            >
              Mật khẩu {tab === "register" ? "(tối thiểu 6 ký tự)" : ""}
            </label>
            <div className="relative">
              <Lock
                className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                autoComplete={
                  tab === "login" ? "current-password" : "new-password"
                }
                required
                minLength={tab === "register" ? 6 : 1}
                maxLength={128}
                disabled={isSubmitting}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-10 py-2.5 text-sm bg-paper border border-ink/20 rounded-xl text-ink focus:outline-none focus:border-accent disabled:opacity-60"
              />
              <button
                type="button"
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {tab === "register" && (
            <div className="space-y-1">
              <label
                htmlFor="auth-transfer-code"
                className="flex items-center gap-1.5 text-xs font-semibold text-ink"
              >
                <KeyRound className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
                <span>Mã hồ sơ cũ DEV-XXXXXX (tuỳ chọn)</span>
              </label>
              <input
                id="auth-transfer-code"
                type="text"
                maxLength={16}
                disabled={isSubmitting}
                value={transferCode}
                onChange={(e) => setTransferCode(e.target.value.toUpperCase())}
                placeholder="DEV-XXXXXX (nếu muốn giữ Coin & Hiệu ứng cũ)"
                className="w-full px-3.5 py-2 text-xs font-mono uppercase bg-paper border border-ink/15 rounded-xl text-ink placeholder:normal-case placeholder:font-sans placeholder:text-ink-muted focus:outline-none focus:border-accent disabled:opacity-60"
              />
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="p-2.5 rounded-xl bg-accent-light border border-accent/30 text-xs text-accent font-medium"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-pill bg-accent hover:bg-accent-hover text-white text-sm font-bold border border-ink shadow-soft transition-all disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>
                  {tab === "login" ? "Đang đăng nhập..." : "Đang tạo tài khoản..."}
                </span>
              </>
            ) : tab === "login" ? (
              <span>Đăng nhập ngay</span>
            ) : (
              <span>Tạo tài khoản &amp; Bắt đầu</span>
            )}
          </button>

          {!mustAuthenticate && (
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full py-2 text-xs font-semibold text-ink-muted hover:text-ink"
            >
              Đóng
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

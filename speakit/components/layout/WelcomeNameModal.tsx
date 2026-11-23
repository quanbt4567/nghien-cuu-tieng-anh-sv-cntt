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
  readCachedGuestProfile,
  syncGuestProfileFromServer,
} from "../../lib/guestClient";
import type { PublicGuestPlayer } from "../../lib/db";

const NAME_PROMPTED_STORAGE_KEY = "speakit_name_prompted_v1";
const LOCAL_DISPLAY_NAME_KEY = "speakit_local_display_name_v1";
const SESSION_TOKEN_STORAGE_KEY = "speakit_session_token_v1";

function readStoredSessionToken(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage.getItem(SESSION_TOKEN_STORAGE_KEY)?.trim() || undefined;
  } catch {
    return undefined;
  }
}

function saveStoredSessionToken(token: string | null | undefined): void {
  if (typeof window === "undefined") return;
  try {
    const cleaned = typeof token === "string" ? token.trim() : "";
    if (cleaned) {
      window.localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, cleaned);
    } else {
      window.localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
    }
  } catch {
  }
}

export function WelcomeNameModal() {
  const pathname = usePathname() ?? "";
  const isAdminRoute = pathname.startsWith("/admin");
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

  const hydrateSession = useCallback(async (isActive?: () => boolean) => {
    const cached = readCachedGuestProfile();
    if (cached?.email) {
      setMustAuthenticate(false);
      setIsOpen(false);
    }
    const backupCode = readBackupTransferCode();
    try {
      const session = await initOrHydrateGuestSession(
        readStoredSessionToken() || backupCode
      );
      if (isActive && !isActive()) return;
      const nextToken =
        "sessionToken" in session &&
        typeof (session as { sessionToken?: unknown }).sessionToken === "string"
          ? (session as { sessionToken: string }).sessionToken
          : undefined;
      if (session.mode === "online" && session.player?.email) {
        if (nextToken) {
          saveStoredSessionToken(nextToken);
        }
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

      if (session.mode === "offline") {
        if (cached?.email) {
          setMustAuthenticate(false);
          setIsOpen(false);
          return;
        }
      }

      if (session.mode === "online" && !session.player) {
        saveStoredSessionToken(null);
      }

      if (session.player && !session.player.email) {
        if (nextToken) {
          saveStoredSessionToken(nextToken);
        }
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
      if ((isActive && !isActive()) || cached?.email) {
        return;
      }
    }

    if (isActive && !isActive()) return;
    setMustAuthenticate(true);
    setIsOpen(true);
  }, []);

  useEffect(() => {
    if (isAdminRoute) return;
    let active = true;
    void hydrateSession(() => active);
    return () => {
      active = false;
    };
  }, [hydrateSession, isAdminRoute]);

  useEffect(() => {
    if (isAdminRoute) return;

    const handleOpenRequest = () => {
      setError(null);
      setIsOpen(true);
    };

    const handleProfileUpdated = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const player = event.detail as PublicGuestPlayer | null;
      if (player?.email) {
        setMustAuthenticate(false);
        setIsOpen(false);
        setLegacyNotice(null);
        return;
      }
      if (!player) {
        saveStoredSessionToken(null);
      }
      setMustAuthenticate(true);
      setError(null);
      setPassword("");
      setIsOpen(true);
    };

    window.addEventListener(OPEN_AUTH_MODAL_EVENT, handleOpenRequest);
    window.addEventListener(GUEST_PROFILE_UPDATED_EVENT, handleProfileUpdated);
    return () => {
      window.removeEventListener(OPEN_AUTH_MODAL_EVENT, handleOpenRequest);
      window.removeEventListener(GUEST_PROFILE_UPDATED_EVENT, handleProfileUpdated);
    };
  }, [isAdminRoute]);

  if (!isOpen || isAdminRoute) {
    return null;
  }

  const handleCompleteAuth = (player: PublicGuestPlayer, sessionToken?: string) => {
    if (sessionToken) {
      saveStoredSessionToken(sessionToken);
    }
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
        const nextToken =
          "sessionToken" in res &&
          typeof (res as { sessionToken?: unknown }).sessionToken === "string"
            ? (res as { sessionToken: string }).sessionToken
            : undefined;
        handleCompleteAuth(res.player, nextToken);
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
      const nextToken =
        "sessionToken" in res &&
        typeof (res as { sessionToken?: unknown }).sessionToken === "string"
          ? (res as { sessionToken: string }).sessionToken
          : undefined;
      handleCompleteAuth(res.player, nextToken);
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
      className="fixed inset-0 z-50 bg-slate-950/55 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="w-full max-w-md bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-5 relative my-auto">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-blue-700 dark:text-blue-400" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 id="auth-modal-title" className="font-display text-lg font-bold text-slate-900 dark:text-white">
              {tab === "login"
                ? "Đăng nhập tài khoản SpeakIT"
                : "Đăng ký tài khoản SpeakIT"}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Đăng nhập hoặc tạo tài khoản để lưu điểm, IT-Coin và thi đấu Arena.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              setTab("login");
              setError(null);
            }}
            className={`inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-semibold transition-colors border ${
              tab === "login"
                ? "bg-white dark:bg-[#111827] text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-700"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border-transparent"
            }`}
          >
            <LogIn className="w-4 h-4" aria-hidden="true" />
            <span>Đăng nhập</span>
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              setTab("register");
              setError(null);
            }}
            className={`inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-semibold transition-colors border ${
              tab === "register"
                ? "bg-white dark:bg-[#111827] text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-700"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border-transparent"
            }`}
          >
            <UserPlus className="w-4 h-4" aria-hidden="true" />
            <span>Đăng ký tài khoản</span>
          </button>
        </div>

        {legacyNotice && tab === "register" && (
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
            {legacyNotice}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {tab === "register" && (
            <div className="space-y-1">
              <label
                htmlFor="auth-display-name"
                className="block text-sm font-semibold text-slate-700 dark:text-slate-200"
              >
                Tên hiển thị (2-24 ký tự)
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
                className="w-full px-3.5 py-2.5 text-sm liquid-glass-input rounded-lg disabled:opacity-60"
              />
            </div>
          )}

          <div className="space-y-1">
            <label
              htmlFor="auth-email"
              className="block text-sm font-semibold text-slate-700 dark:text-slate-200"
            >
              Email
            </label>
            <div className="relative">
              <Mail
                className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
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
                className="w-full pl-9 pr-3.5 py-2.5 text-sm liquid-glass-input rounded-lg disabled:opacity-60"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="auth-password"
              className="block text-sm font-semibold text-slate-700 dark:text-slate-200"
            >
              Mật khẩu {tab === "register" ? "(tối thiểu 6 ký tự)" : ""}
            </label>
            <div className="relative">
              <Lock
                className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
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
                className="w-full pl-9 pr-10 py-2.5 text-sm liquid-glass-input rounded-lg disabled:opacity-60"
              />
              <button
                type="button"
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
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
                className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200"
              >
                <KeyRound className="w-4 h-4 text-blue-700 dark:text-blue-400" aria-hidden="true" />
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
                className="w-full px-3.5 py-2 text-sm font-mono uppercase liquid-glass-input rounded-lg placeholder:normal-case placeholder:font-sans disabled:opacity-60"
              />
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300 font-medium"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg liquid-btn-primary text-sm disabled:opacity-60"
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
              className="w-full py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Đóng
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

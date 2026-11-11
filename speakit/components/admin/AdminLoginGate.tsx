"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Eye, EyeOff, Info, Lock, ShieldCheck } from "lucide-react";

interface AdminAuthContextValue {
  isDefaultPasscode: boolean;
  lockSession: () => Promise<void>;
  forceLock: (reason?: string) => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue>({
  isDefaultPasscode: false,
  lockSession: async () => {},
  forceLock: () => {},
});

export function useAdminAuth(): AdminAuthContextValue {
  return useContext(AdminAuthContext);
}

interface AdminLoginGateProps {
  children: ReactNode;
}

export function AdminLoginGate({ children }: AdminLoginGateProps) {
  const [status, setStatus] = useState<"loading" | "locked" | "authenticated">("loading");
  const [isDefaultPasscode, setIsDefaultPasscode] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function checkAuth() {
      try {
        const res = await fetch("/api/admin/auth", { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as {
          authenticated?: boolean;
          isDefaultPasscode?: boolean;
        } | null;
        if (!active) return;
        setIsDefaultPasscode(Boolean(data?.isDefaultPasscode));
        setStatus(data?.authenticated ? "authenticated" : "locked");
      } catch {
        if (!active) return;
        setStatus("locked");
        setError("Không thể kiểm tra phiên quản trị. Vui lòng thử lại.");
      }
    }
    void checkAuth();
    return () => {
      active = false;
    };
  }, []);

  const lockSession = useCallback(async () => {
    try {
      await fetch("/api/admin/auth", { method: "DELETE" });
    } catch {
      // Lock client view even if network request fails
    }
    setPasscode("");
    setError(null);
    setStatus("locked");
  }, []);

  const forceLock = useCallback((reason?: string) => {
    setPasscode("");
    setError(reason ?? "Phiên đăng nhập quản trị đã hết hạn. Vui lòng xác thực lại.");
    setStatus("locked");
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!passcode.trim()) {
      setError("Vui lòng nhập mã truy cập quản trị.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const data = (await res.json().catch(() => null)) as {
        authenticated?: boolean;
        isDefaultPasscode?: boolean;
        error?: string;
      } | null;

      if (!res.ok || !data?.authenticated) {
        setError(data?.error || "Mã truy cập quản trị không chính xác.");
        return;
      }

      setIsDefaultPasscode(Boolean(data.isDefaultPasscode));
      setPasscode("");
      setStatus("authenticated");
    } catch {
      setError("Không thể kết nối tới máy chủ xác thực. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-4 py-12">
        <div
          aria-busy="true"
          aria-label="Đang kiểm tra phiên quản trị"
          className="w-full max-w-md bg-white border border-ink/15 rounded-2xl p-6 sm:p-8 shadow-soft space-y-5 animate-pulse"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-paper-muted" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-40 bg-paper-muted rounded" />
              <div className="h-3 w-56 bg-paper-muted rounded" />
            </div>
          </div>
          <div className="h-10 w-full bg-paper-muted rounded-xl" />
          <div className="h-10 w-full bg-paper-muted rounded-pill" />
        </div>
      </div>
    );
  }

  if (status === "locked") {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white border border-ink/15 rounded-2xl p-6 sm:p-8 shadow-soft space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-pill bg-paper border border-ink/15 text-[11px] font-mono font-semibold uppercase tracking-wide text-ink">
              <ShieldCheck className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
              <span>Admin Portal</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              Cổng Quản Trị SpeakIT
            </h1>
            <p className="text-xs text-ink-muted leading-relaxed">
              Khu vực dành cho giảng viên, nhóm nghiên cứu IUH &amp; BCN để xem thống kê thực tế, xuất dữ liệu CSV/JSON và quản lý học liệu.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3.5 rounded-xl bg-accent-light border border-accent/40 text-xs text-ink"
            >
              <AlertCircle className="w-4 h-4 text-accent shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {isDefaultPasscode && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-paper border border-ink/15 text-xs text-ink-muted">
              <Info className="w-4 h-4 text-ink shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                Chế độ Demo: passcode mặc định <code className="font-mono font-semibold text-ink">admin2025</code> (cấu hình <code className="font-mono">ADMIN_PASSCODE</code> trong env cho production)
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="admin-passcode-input"
                className="block text-xs font-mono font-semibold uppercase text-ink-muted"
              >
                Mã truy cập (Passcode)
              </label>
              <div className="relative">
                <Lock
                  className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  id="admin-passcode-input"
                  type={showPasscode ? "text" : "password"}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Nhập passcode quản trị..."
                  autoFocus
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-2.5 text-sm font-mono bg-paper border border-ink/20 rounded-xl text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode((prev) => !prev)}
                  aria-label={showPasscode ? "Ẩn mã truy cập" : "Hiện mã truy cập"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                >
                  {showPasscode ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-pill bg-ink text-white text-sm font-semibold hover:bg-ink/90 shadow-soft shadow-hard-press transition-all disabled:opacity-60"
            >
              {isSubmitting ? "Đang xác thực..." : "Mở khóa Cổng Quản Trị"}
            </button>
          </form>

          <div className="pt-2 border-t border-ink/10 flex justify-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Quay lại chế độ Người dùng</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AdminAuthContext.Provider value={{ isDefaultPasscode, lockSession, forceLock }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

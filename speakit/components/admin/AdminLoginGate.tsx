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
import { AlertCircle, ArrowLeft, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";

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
      void 0;
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
      <div className="min-h-screen bg-transparent flex items-center justify-center px-4 py-12">
        <div
          aria-busy="true"
          aria-label="Đang kiểm tra phiên quản trị"
          className="w-full max-w-md liquid-glass-card p-6 sm:p-8 space-y-5 animate-pulse"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-200/80" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-40 bg-slate-200/80 rounded" />
              <div className="h-3 w-56 bg-slate-200/80 rounded" />
            </div>
          </div>
          <div className="h-10 w-full bg-slate-200/80 rounded-xl" />
          <div className="h-10 w-full bg-slate-200/80 rounded-full" />
        </div>
      </div>
    );
  }

  if (status === "locked") {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md liquid-glass-card p-6 sm:p-8 space-y-6">
          <div className="space-y-2">
            <div className="liquid-glass-pill inline-flex items-center gap-2 px-3 py-1 text-[11px] font-mono font-semibold uppercase tracking-wide text-sky-800">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-600" aria-hidden="true" />
              <span>Admin Portal</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Cổng Quản Trị SpeakIT
            </h1>
            <p className="text-xs text-slate-700 leading-relaxed">
              Khu vực dành cho giảng viên, nhóm nghiên cứu IUH &amp; BCN để xem thống kê thực tế, xuất dữ liệu CSV/JSON và quản lý học liệu.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-50/90 border border-rose-300/80 text-xs text-rose-800"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="admin-passcode-input"
                className="block text-xs font-mono font-semibold uppercase text-slate-700"
              >
                Mã truy cập (Passcode)
              </label>
              <div className="relative">
                <Lock
                  className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2"
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
                  className="liquid-glass-input w-full pl-10 pr-10 py-2.5 text-sm font-mono rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode((prev) => !prev)}
                  aria-label={showPasscode ? "Ẩn mã truy cập" : "Hiện mã truy cập"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 transition-colors"
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
              className="liquid-btn-primary w-full py-2.5 px-4 rounded-full text-sm font-semibold transition-all disabled:opacity-60"
            >
              {isSubmitting ? "Đang xác thực..." : "Mở khóa Cổng Quản Trị"}
            </button>
          </form>

          <div className="pt-2 border-t border-slate-200/85 flex justify-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors"
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

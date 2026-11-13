"use client";

import { useEffect, useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Sparkles, UserCheck } from "lucide-react";
import {
  initOrHydrateGuestSession,
  updateGuestDisplayName,
} from "../../app/actions/leaderboard";
import {
  generateFriendlyDisplayName,
  isLegacyCodeDisplayName,
} from "../../lib/gamification";
import {
  readBackupTransferCode,
  saveBackupTransferCode,
} from "../../lib/guestClient";

const NAME_PROMPTED_STORAGE_KEY = "speakit_name_prompted_v1";
const LOCAL_DISPLAY_NAME_KEY = "speakit_local_display_name_v1";

export function WelcomeNameModal() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;

    let cancelled = false;

    const checkWelcomePrompt = async () => {
      try {
        if (window.localStorage.getItem(NAME_PROMPTED_STORAGE_KEY) === "1") {
          return;
        }
      } catch {
        return;
      }

      try {
        const session = await initOrHydrateGuestSession(readBackupTransferCode());
        if (cancelled) return;
        if (session.mode === "online" && session.player) {
          saveBackupTransferCode(session.player.transferCode);
          if (!isLegacyCodeDisplayName(session.player.displayName)) {
            setNameInput("");
          }
        }
      } catch {
        // Proceed with modal even in offline mode.
      }

      if (!cancelled) {
        setIsOpen(true);
      }
    };

    void checkWelcomePrompt();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (!isOpen || pathname.startsWith("/admin")) {
    return null;
  }

  const finishOnboarding = (savedName: string) => {
    try {
      window.localStorage.setItem(NAME_PROMPTED_STORAGE_KEY, "1");
      window.localStorage.setItem(LOCAL_DISPLAY_NAME_KEY, savedName);
    } catch {
      // Ignore storage quota errors.
    }
    setIsOpen(false);
    router.refresh();
  };

  const applyDisplayName = async (candidate: string) => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await updateGuestDisplayName(candidate, readBackupTransferCode());
      if (res.player?.transferCode) {
        saveBackupTransferCode(res.player.transferCode);
      }
      if (!res.ok && res.mode === "online") {
        setError(res.error || "Không thể lưu tên. Vui lòng thử lại.");
        setIsSaving(false);
        return;
      }
      finishOnboarding(res.player?.displayName ?? candidate);
    } catch {
      finishOnboarding(candidate);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const cleaned = nameInput.trim();
    if (!cleaned) {
      await applyDisplayName(generateFriendlyDisplayName());
      return;
    }
    if (cleaned.length < 2 || cleaned.length > 24) {
      setError("Tên hiển thị cần từ 2 đến 24 ký tự.");
      return;
    }
    await applyDisplayName(cleaned);
  };

  const handleSkipRandom = async () => {
    if (isSaving) return;
    await applyDisplayName(generateFriendlyDisplayName());
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-name-title"
      className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] flex items-center justify-center p-4"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white border border-ink/20 rounded-2xl p-6 shadow-card space-y-4"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-pill bg-accent-light border border-accent/30 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5 text-accent" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 id="welcome-name-title" className="text-base font-bold text-ink">
              Đặt tên hiển thị trên Bảng xếp hạng
            </h2>
            <p className="text-xs text-ink-muted leading-relaxed">
              Nhập tên bạn muốn hiển thị thay cho mã thiết bị. Nếu để trống hoặc bỏ qua, hệ thống sẽ tạo một tên ngẫu nhiên thân thiện.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="welcome-display-name"
            className="block text-xs font-mono font-semibold text-ink-muted"
          >
            Tên hiển thị (2 – 24 ký tự)
          </label>
          <input
            id="welcome-display-name"
            type="text"
            autoFocus
            maxLength={24}
            value={nameInput}
            disabled={isSaving}
            onChange={(e) => {
              setNameInput(e.target.value);
              if (error) setError(null);
            }}
            placeholder="VD: Minh Quân, Lan Anh..."
            className="w-full px-3.5 py-2.5 text-sm bg-paper border border-ink/20 rounded-xl text-ink focus:outline-none focus:border-accent disabled:opacity-60"
          />
          {error && (
            <p role="alert" className="text-xs text-accent font-medium">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-pill bg-accent hover:bg-accent-hover text-white text-xs sm:text-sm font-semibold shadow-soft shadow-hard-press transition-all disabled:opacity-60"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>Đang lưu...</span>
              </>
            ) : (
              <span>Lưu tên &amp; Bắt đầu</span>
            )}
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSkipRandom()}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-pill bg-paper hover:bg-paper-muted text-ink text-xs font-semibold border border-ink/20 transition-colors disabled:opacity-60"
          >
            <Sparkles className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
            <span>Tạo tên ngẫu nhiên</span>
          </button>
        </div>
      </form>
    </div>
  );
}


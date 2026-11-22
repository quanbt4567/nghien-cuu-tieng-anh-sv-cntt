"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Clock, Sparkles, X } from "lucide-react";
import {
  GAMIFICATION_STORAGE_KEY,
  GAMIFICATION_UPDATED_EVENT,
  getGamificationState,
} from "../../lib/gamification";
import {
  REMINDER_UPDATED_EVENT,
  markReminderDismissedToday,
  shouldShowInAppReminder,
} from "../../lib/mobile-notifications";

interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

interface InAppNotificationBellProps {
  lastPracticeDate?: string | null;
}

const READ_ANNOUNCEMENTS_KEY = "speakit_read_announcements_v1";

function loadReadIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(READ_ANNOUNCEMENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function saveReadIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(READ_ANNOUNCEMENTS_KEY, JSON.stringify(ids.slice(0, 100)));
  } catch {
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function InAppNotificationBell({ lastPracticeDate }: InAppNotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [showReminder, setShowReminder] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const syncReminder = (overrideDate?: string | null) => {
    const date =
      overrideDate !== undefined ? overrideDate : getGamificationState().lastPracticeDate;
    setShowReminder(shouldShowInAppReminder(date));
  };

  useEffect(() => {
    setReadIds(loadReadIds());
    syncReminder(lastPracticeDate);

    let active = true;
    fetch("/api/notifications")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { announcements?: AnnouncementItem[] } | null) => {
        if (!active || !data?.announcements) return;
        setAnnouncements(data.announcements);
      })
      .catch(() => null);

    const handleGamification = () => syncReminder(lastPracticeDate);
    const handleReminderUpdate = () => syncReminder(lastPracticeDate);
    const handleStorage = (e: StorageEvent) => {
      if (!e.key || e.key === READ_ANNOUNCEMENTS_KEY) {
        setReadIds(loadReadIds());
      }
      if (!e.key || e.key === GAMIFICATION_STORAGE_KEY) {
        syncReminder(lastPracticeDate);
      }
    };

    window.addEventListener(GAMIFICATION_UPDATED_EVENT, handleGamification);
    window.addEventListener(REMINDER_UPDATED_EVENT, handleReminderUpdate);
    window.addEventListener("storage", handleStorage);

    return () => {
      active = false;
      window.removeEventListener(GAMIFICATION_UPDATED_EVENT, handleGamification);
      window.removeEventListener(REMINDER_UPDATED_EVENT, handleReminderUpdate);
      window.removeEventListener("storage", handleStorage);
    };
  }, [lastPracticeDate]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  const readSet = new Set(readIds);
  const unreadAnnouncements = announcements.filter((item) => !readSet.has(item.id));
  const unreadCount = unreadAnnouncements.length + (showReminder ? 1 : 0);

  const handleMarkAllRead = () => {
    const merged = Array.from(new Set([...readIds, ...announcements.map((a) => a.id)]));
    setReadIds(merged);
    saveReadIds(merged);
    if (showReminder) {
      markReminderDismissedToday();
      setShowReminder(false);
    }
  };

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Thông báo"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((prev) => !prev)}
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-pill bg-white border border-ink/15 hover:border-ink/30 shadow-soft text-ink transition-colors"
      >
        <Bell className="w-4 h-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[10px] font-mono font-bold flex items-center justify-center border border-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 bg-white border border-ink/15 rounded-2xl shadow-card z-50 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-ink/10 bg-paper">
            <span className="text-xs font-bold text-ink uppercase font-mono">
              Thông báo
            </span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
                >
                  <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Đánh dấu đã đọc</span>
                </button>
              )}
              <button
                type="button"
                aria-label="Đóng thông báo"
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-muted"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-ink/10">
            {showReminder && (
              <div className="p-3.5 bg-accent-light/50 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
                    <Clock className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden="true" />
                    <span>Nhắc nhở học tập hôm nay</span>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-accent shrink-0 mt-1" />
                </div>
                <p className="text-xs text-ink-muted leading-relaxed">
                  Bạn chưa luyện nói hôm nay. Dành 5 phút luyện phản xạ để giữ streak nhé!
                </p>
                <div className="flex items-center gap-2 pt-0.5">
                  <Link
                    href="/scenarios"
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center px-3 py-1 rounded-pill bg-ink text-white text-[11px] font-semibold hover:bg-ink/90"
                  >
                    Luyện ngay
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      markReminderDismissedToday();
                      setShowReminder(false);
                    }}
                    className="text-[11px] font-medium text-ink-muted hover:text-ink"
                  >
                    Ẩn hôm nay
                  </button>
                </div>
              </div>
            )}

            {announcements.map((item) => {
              const isUnread = !readSet.has(item.id);
              return (
                <div
                  key={item.id}
                  className={`p-3.5 space-y-1 ${isUnread ? "bg-paper/70" : "bg-white"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
                      <Sparkles
                        className="w-3.5 h-3.5 text-accent shrink-0"
                        aria-hidden="true"
                      />
                      <span>{item.title}</span>
                    </div>
                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-accent shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="text-xs text-ink-muted leading-relaxed">{item.body}</p>
                  {item.created_at && (
                    <div className="text-[10px] font-mono text-ink-faint">
                      {formatDateTime(item.created_at)}
                    </div>
                  )}
                </div>
              );
            })}

            {!showReminder && announcements.length === 0 && (
              <div className="px-4 py-8 text-center text-xs text-ink-muted">
                Chưa có thông báo mới.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

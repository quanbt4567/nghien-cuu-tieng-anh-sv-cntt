"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Clock, Megaphone, X } from "lucide-react";
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

import type { InAppNotification } from "../../lib/types";

type AnnouncementItem = InAppNotification;

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
        className="relative inline-flex items-center justify-center w-8 h-8 rounded-full liquid-glass-btn text-slate-700 dark:text-slate-200"
      >
        <Bell className="w-4 h-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#DC2626] text-white text-[10px] font-mono tabular-nums font-bold flex items-center justify-center border border-white dark:border-[#1E293B]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-20 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2.5 sm:w-80 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm z-50 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80">
            <span className="text-xs font-bold text-slate-900 dark:text-white font-mono">
              Thông báo
            </span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline"
                >
                  <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Đánh dấu đã đọc</span>
                </button>
              )}
              <button
                type="button"
                aria-label="Đóng thông báo"
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
            {showReminder && (
              <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                    <Clock className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" aria-hidden="true" />
                    <span>Nhắc nhở học tập hôm nay</span>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-blue-700 dark:bg-blue-400 shrink-0 mt-1.5" />
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Bạn chưa luyện nói hôm nay. Dành 5 phút luyện phản xạ để giữ streak nhé!
                </p>
                <div className="flex items-center gap-2 pt-0.5">
                  <Link
                    href="/scenarios"
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg liquid-btn-primary text-xs"
                  >
                    Luyện ngay
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      markReminderDismissedToday();
                      setShowReminder(false);
                    }}
                    className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
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
                  className={`p-3.5 space-y-1 ${isUnread ? "bg-blue-50/70 dark:bg-blue-950/30" : "bg-transparent"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                      <Megaphone
                        className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0"
                        aria-hidden="true"
                      />
                      <span>{item.title}</span>
                    </div>
                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-blue-700 dark:bg-blue-400 shrink-0 mt-1.5" />
                    )}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{item.body}</p>
                  {item.bannerUrl?.trim() && (
                    <div className="relative aspect-[16/7] w-full overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 mt-1.5">
                      <img
                        src={item.bannerUrl.trim()}
                        alt={item.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  {item.created_at && (
                    <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      {formatDateTime(item.created_at)}
                    </div>
                  )}
                </div>
              );
            })}

            {!showReminder && announcements.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Chưa có thông báo mới.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

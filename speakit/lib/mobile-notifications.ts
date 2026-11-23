export interface ReminderPrefs {
  enabled: boolean;
  hour: number;
  minute: number;
}

export const REMINDER_UPDATED_EVENT = "speakit:reminder-updated";

const REMINDER_PREFS_KEY = "speakit_android_reminder_v1";
const REMINDER_DISMISSED_KEY = "speakit_inapp_reminder_dismissed_v1";

function getLocalTodayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getSavedReminderPrefs(): ReminderPrefs {
  if (typeof window === "undefined") {
    return { enabled: false, hour: 20, minute: 0 };
  }
  try {
    const raw = window.localStorage.getItem(REMINDER_PREFS_KEY);
    if (!raw) return { enabled: false, hour: 20, minute: 0 };
    const parsed = JSON.parse(raw) as Partial<ReminderPrefs>;
    return {
      enabled: Boolean(parsed.enabled),
      hour:
        typeof parsed.hour === "number" && parsed.hour >= 0 && parsed.hour <= 23
          ? parsed.hour
          : 20,
      minute:
        typeof parsed.minute === "number" && parsed.minute >= 0 && parsed.minute <= 59
          ? parsed.minute
          : 0,
    };
  } catch {
    return { enabled: false, hour: 20, minute: 0 };
  }
}

export function saveReminderPrefs(prefs: ReminderPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REMINDER_PREFS_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent(REMINDER_UPDATED_EVENT));
  } catch {
  }
}

export function markReminderDismissedToday(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REMINDER_DISMISSED_KEY, getLocalTodayKey());
    window.dispatchEvent(new CustomEvent(REMINDER_UPDATED_EVENT));
  } catch {
  }
}

export function shouldShowInAppReminder(lastPracticeDate: string | null): boolean {
  if (typeof window === "undefined") return false;
  const prefs = getSavedReminderPrefs();
  if (!prefs.enabled) return false;
  const today = getLocalTodayKey();
  if (lastPracticeDate === today) return false;
  try {
    if (window.localStorage.getItem(REMINDER_DISMISSED_KEY) === today) {
      return false;
    }
  } catch {
  }
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const targetMinutes = prefs.hour * 60 + prefs.minute;
  return nowMinutes >= targetMinutes;
}

export async function registerAndroidPushToken(_guestCode?: string | null): Promise<void> {}

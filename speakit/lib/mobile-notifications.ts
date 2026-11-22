export interface ReminderPrefs {
  enabled: boolean;
  hour: number;
  minute: number;
}

interface CapacitorPluginSet {
  LocalNotifications?: {
    requestPermissions: () => Promise<{ display?: string }>;
    schedule: (options: { notifications: Array<Record<string, unknown>> }) => Promise<unknown>;
    cancel: (options: { notifications: Array<{ id: number }> }) => Promise<unknown>;
  };
  PushNotifications?: {
    requestPermissions: () => Promise<{ receive?: string }>;
    register: () => Promise<void>;
    addListener: (
      eventName: string,
      callback: (data: { value?: string }) => void
    ) => Promise<{ remove: () => Promise<void> }>;
  };
}

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: CapacitorPluginSet;
}

const REMINDER_PREFS_KEY = "speakit_android_reminder_v1";
const REMINDER_NOTIFICATION_ID = 1001;
let pushBootstrapped = false;

function getCapacitor(): CapacitorGlobal | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  return cap ?? null;
}

export function isCapacitorAndroid(): boolean {
  const cap = getCapacitor();
  return Boolean(cap?.isNativePlatform?.() && cap?.getPlatform?.() === "android");
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
  } catch {
    // ignore storage errors
  }
}

export async function scheduleDailyReminder(
  hour: number,
  minute: number,
  enabled: boolean
): Promise<{ ok: boolean; message: string }> {
  saveReminderPrefs({ enabled, hour, minute });

  const localNotifications = getCapacitor()?.Plugins?.LocalNotifications;
  if (!isCapacitorAndroid() || !localNotifications) {
    return {
      ok: true,
      message: "Đã lưu cấu hình. Lịch nhắc sẽ tự kích hoạt khi mở trong app Android SpeakIT.",
    };
  }

  try {
    await localNotifications.cancel({
      notifications: [{ id: REMINDER_NOTIFICATION_ID }],
    });

    if (!enabled) {
      return { ok: true, message: "Đã tắt nhắc nhở hằng ngày trên thiết bị." };
    }

    const perm = await localNotifications.requestPermissions();
    if (perm?.display === "denied") {
      return {
        ok: false,
        message: "Ứng dụng chưa được cấp quyền Thông báo trên Android.",
      };
    }

    await localNotifications.schedule({
      notifications: [
        {
          id: REMINDER_NOTIFICATION_ID,
          title: "SpeakIT — Luyện nói 5 phút mỗi ngày",
          body: "Đến giờ luyện phản xạ tiếng Anh CNTT rồi! Vào giữ streak hôm nay nhé.",
          schedule: {
            on: { hour, minute },
            repeats: true,
            allowWhileIdle: true,
          },
        },
      ],
    });

    const hh = String(hour).padStart(2, "0");
    const mm = String(minute).padStart(2, "0");
    return { ok: true, message: `Đã đặt lịch nhắc mỗi ngày lúc ${hh}:${mm}.` };
  } catch {
    return { ok: false, message: "Không thể đặt lịch thông báo trên thiết bị." };
  }
}

export async function testLocalReminderNow(): Promise<{ ok: boolean; message: string }> {
  const localNotifications = getCapacitor()?.Plugins?.LocalNotifications;
  if (!isCapacitorAndroid() || !localNotifications) {
    return {
      ok: false,
      message: "Tính năng này chỉ chạy trực tiếp trong app Android (.apk).",
    };
  }

  try {
    const perm = await localNotifications.requestPermissions();
    if (perm?.display === "denied") {
      return { ok: false, message: "Chưa cấp quyền Thông báo trên Android." };
    }

    await localNotifications.schedule({
      notifications: [
        {
          id: 1002,
          title: "SpeakIT — Thông báo thử nghiệm",
          body: "Thông báo nhắc nhở trên Android hoạt động bình thường!",
          schedule: { at: new Date(Date.now() + 3000) },
        },
      ],
    });
    return { ok: true, message: "Sẽ hiện thông báo thử sau 3 giây..." };
  } catch {
    return { ok: false, message: "Không thể gửi thông báo thử." };
  }
}

export async function registerAndroidPushToken(guestCode?: string | null): Promise<void> {
  if (pushBootstrapped || !isCapacitorAndroid()) return;
  const push = getCapacitor()?.Plugins?.PushNotifications;
  if (!push) return;
  pushBootstrapped = true;

  try {
    await push.addListener("registration", async (tokenEvent) => {
      const token = tokenEvent?.value?.trim();
      if (!token) return;
      await fetch("/api/push/register-device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          platform: "android",
          guestCode: guestCode ?? null,
        }),
      }).catch(() => null);
    });

    const perm = await push.requestPermissions();
    if (perm?.receive === "granted") {
      await push.register();
    }

    const prefs = getSavedReminderPrefs();
    if (prefs.enabled) {
      await scheduleDailyReminder(prefs.hour, prefs.minute, true);
    }
  } catch {
    pushBootstrapped = false;
  }
}

import { PracticeAttempt, ScenarioId, UserSettings, WeakPoint, StorageAdapter } from "../types";
import { getGamificationState, mirrorTelemetry, resetGamificationState } from "../gamification";

const ATTEMPTS_KEY = "speakit_attempts_v1";
const WEAK_POINTS_KEY = "speakit_weakpoints_v1";
const SETTINGS_KEY = "speakit_settings_v1";

const DEFAULT_SETTINGS: UserSettings = {
  speechRate: 1.0,
  autoPlayAudio: true,
};

function safeGetItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore quota errors
  }
}

export class LocalStorageAdapter implements StorageAdapter {
  async saveAttempt(
    data: Omit<PracticeAttempt, "id" | "created_at">
  ): Promise<PracticeAttempt> {
    const attempts = await this.getAttempts();
    const newAttempt: PracticeAttempt = {
      ...data,
      id: "loc_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 6),
      created_at: new Date().toISOString(),
    };

    // Keep most recent 200 attempts
    attempts.unshift(newAttempt);
    if (attempts.length > 200) {
      attempts.length = 200;
    }

    safeSetItem(ATTEMPTS_KEY, JSON.stringify(attempts));
    mirrorTelemetry("attempt", {
      ...newAttempt,
      role: newAttempt.role ?? getGamificationState().selectedRole,
    });
    return newAttempt;
  }

  async getAttempts(scenario?: ScenarioId): Promise<PracticeAttempt[]> {
    const raw = safeGetItem(ATTEMPTS_KEY);
    if (!raw) return [];
    try {
      const parsed: PracticeAttempt[] = JSON.parse(raw);
      if (scenario) {
        return parsed.filter((a) => a.scenario === scenario);
      }
      return parsed;
    } catch {
      return [];
    }
  }

  async recordWeakPoints(
    missedKeywords: string[],
    grammarIssues: string[]
  ): Promise<void> {
    const existing = await this.getWeakPoints();
    const map = new Map<string, WeakPoint>();

    for (const wp of existing) {
      map.set(`${wp.kind}:${wp.value.toLowerCase()}`, wp);
    }

    const now = new Date().toISOString();

    for (const kw of missedKeywords) {
      const clean = kw.trim().toLowerCase();
      if (!clean) continue;
      const key = `keyword:${clean}`;
      const item = map.get(key);
      if (item) {
        item.miss_count += 1;
        item.updated_at = now;
      } else {
        map.set(key, {
          id: "wp_" + Math.random().toString(36).substring(2, 8),
          kind: "keyword",
          value: clean,
          miss_count: 1,
          updated_at: now,
        });
      }
    }

    for (const gm of grammarIssues) {
      const clean = gm.trim().toLowerCase();
      if (!clean) continue;
      const key = `grammar:${clean}`;
      const item = map.get(key);
      if (item) {
        item.miss_count += 1;
        item.updated_at = now;
      } else {
        map.set(key, {
          id: "wp_" + Math.random().toString(36).substring(2, 8),
          kind: "grammar",
          value: clean,
          miss_count: 1,
          updated_at: now,
        });
      }
    }

    const updated = Array.from(map.values()).sort(
      (a, b) => b.miss_count - a.miss_count
    );
    safeSetItem(WEAK_POINTS_KEY, JSON.stringify(updated.slice(0, 100)));

    const cleanKeywords = missedKeywords
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);
    const cleanGrammar = grammarIssues
      .map((g) => g.trim().toLowerCase())
      .filter(Boolean);
    if (cleanKeywords.length > 0 || cleanGrammar.length > 0) {
      mirrorTelemetry("weak_points", {
        missedKeywords: cleanKeywords,
        grammarIssues: cleanGrammar,
      });
    }
  }

  async getWeakPoints(limit: number = 50): Promise<WeakPoint[]> {
    const raw = safeGetItem(WEAK_POINTS_KEY);
    if (!raw) return [];
    try {
      const parsed: WeakPoint[] = JSON.parse(raw);
      return parsed.slice(0, limit);
    } catch {
      return [];
    }
  }

  getSettings(): UserSettings {
    const raw = safeGetItem(SETTINGS_KEY);
    let settings = { ...DEFAULT_SETTINGS };

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        settings = { ...settings, ...parsed };
      } catch {
        // use default
      }
    }

    return settings;
  }

  saveSettings(updates: Partial<UserSettings>): void {
    const current = this.getSettings();
    const nextSettings = { ...current, ...updates };
    safeSetItem(SETTINGS_KEY, JSON.stringify(nextSettings));
  }

  async resetAll(): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(ATTEMPTS_KEY);
      window.localStorage.removeItem(WEAK_POINTS_KEY);
    } catch {
      // ignore
    }
    resetGamificationState();
  }
}

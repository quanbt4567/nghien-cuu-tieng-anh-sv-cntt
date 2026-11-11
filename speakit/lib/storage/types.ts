import { PracticeAttempt, ScenarioId, UserSettings, WeakPoint } from "../types";

export interface IStorageAdapter {
  saveAttempt(attempt: Omit<PracticeAttempt, "id" | "created_at">): Promise<PracticeAttempt>;
  getAttempts(scenario?: ScenarioId): Promise<PracticeAttempt[]>;
  recordWeakPoints(missedKeywords: string[], grammarIssues: string[]): Promise<void>;
  getWeakPoints(limit?: number): Promise<WeakPoint[]>;
  getSettings(): UserSettings;
  saveSettings(settings: Partial<UserSettings>): void;
  resetAll(): Promise<void>;
}

# Storage Contract: Persistence Layer

**Feature**: `001-workplace-speaking-practice`  
**Date**: 2026-11-11  

---

## 1. Storage Interface (`StorageAdapter`)

To guarantee graceful degradation without unhandled crashes:

```typescript
export interface IStorageAdapter {
  saveAttempt(attempt: Omit<PracticeAttempt, 'id' | 'created_at'>): Promise<PracticeAttempt>;
  getAttempts(scenario?: ScenarioId): Promise<PracticeAttempt[]>;
  recordWeakPoints(missedKeywords: string[], grammarIssues: string[]): Promise<void>;
  getWeakPoints(limit?: number): Promise<WeakPoint[]>;
  resetAll(): Promise<void>;
}
```

---

## 2. Supabase Storage Implementation

- Configured via environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- If environment variables are absent, undefined, or fail with a network error, operations immediately fail over to the `LocalStorageAdapter` with zero user disruption.
- Security boundary: **NEVER** write `geminiApiKey` to Supabase.

---

## 3. LocalStorage Storage Implementation

Keys used in `window.localStorage`:
- `speakit_attempts_v1`: JSON array of `PracticeAttempt` objects (capped at most recent 200 items).
- `speakit_weakpoints_v1`: JSON array of `WeakPoint` objects with aggregated `miss_count`.
- `speakit_settings_v1`: JSON object containing `speechRate`, `autoPlayAudio`, `theme`.
- `speakit_gemini_key`: Isolated string for the user's Gemini API key.

---

## 4. Reset Contract

When the user activates "Làm mới tiến độ" (Reset Progress) in `/settings`:
- Local storage keys `speakit_attempts_v1` and `speakit_weakpoints_v1` are deleted.
- If Supabase is active, a delete query clears `attempts` and `weak_points` for the current device/session.
- The user's `geminiApiKey` and app preferences are preserved unless specifically requested to clear.


export const FEEDBACK_STORAGE_KEY = "speakit_feedback_prompt_v1";
export const FEEDBACK_SESSION_KEY = "speakit_feedback_session_shown_v1";

export const DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const SUBMIT_COOLDOWN_MS = 72 * 60 * 60 * 1000;

export interface FeedbackPromptState {
  lastSubmittedAt?: number | null;
  lastDismissedAt?: number | null;
  shownInSession?: boolean;
}

interface StoredFeedbackState {
  lastSubmittedAt?: number;
  lastDismissedAt?: number;
}

export function shouldShowFeedbackPrompt(
  state: FeedbackPromptState,
  nowMs: number = Date.now()
): boolean {
  if (state.shownInSession) {
    return false;
  }
  if (
    typeof state.lastSubmittedAt === "number" &&
    Number.isFinite(state.lastSubmittedAt) &&
    nowMs - state.lastSubmittedAt < SUBMIT_COOLDOWN_MS
  ) {
    return false;
  }
  if (
    typeof state.lastDismissedAt === "number" &&
    Number.isFinite(state.lastDismissedAt) &&
    nowMs - state.lastDismissedAt < DISMISS_COOLDOWN_MS
  ) {
    return false;
  }
  return true;
}

function readStoredState(): StoredFeedbackState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(FEEDBACK_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredFeedbackState;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredState(next: StoredFeedbackState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(next));
  } catch {
    return;
  }
}

function isShownInSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(FEEDBACK_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function canShowFeedbackPrompt(nowMs: number = Date.now()): boolean {
  if (typeof window === "undefined") return false;
  const stored = readStoredState();
  return shouldShowFeedbackPrompt(
    {
      lastSubmittedAt: stored.lastSubmittedAt ?? null,
      lastDismissedAt: stored.lastDismissedAt ?? null,
      shownInSession: isShownInSession(),
    },
    nowMs
  );
}

export function recordFeedbackPromptShown(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(FEEDBACK_SESSION_KEY, "1");
  } catch {
    return;
  }
}

export function recordFeedbackDismissed(nowMs: number = Date.now()): void {
  const stored = readStoredState();
  writeStoredState({ ...stored, lastDismissedAt: nowMs });
  recordFeedbackPromptShown();
}

export function recordFeedbackSubmitted(nowMs: number = Date.now()): void {
  const stored = readStoredState();
  writeStoredState({ ...stored, lastSubmittedAt: nowMs });
  recordFeedbackPromptShown();
}

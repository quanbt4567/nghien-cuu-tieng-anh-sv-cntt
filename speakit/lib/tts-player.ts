import {
  MAX_TTS_TEXT_LENGTH,
  normalizeVoicePersona,
  speakText,
} from "./speech";
import { VoicePersonaId } from "./types";

export interface PlayTtsOptions {
  text: string;
  rate?: 0.8 | 1.0 | 1.2;
  persona?: VoicePersonaId | string;
  timeoutMs?: number;
  onEnd?: () => void;
  onError?: (message: string) => void;
  deps?: {
    fetchFn?: typeof fetch;
    createAudio?: (url: string) => HTMLAudioElement;
    createObjectUrl?: (blob: Blob) => string;
    revokeObjectUrl?: (url: string) => void;
    fallbackSpeak?: typeof speakText;
  };
}

let activeStop: (() => void) | null = null;

export function stopActiveTts(): void {
  if (activeStop) {
    const stop = activeStop;
    activeStop = null;
    stop();
  }
}

export function playTtsAudio(options: PlayTtsOptions): () => void {
  const {
    text,
    rate = 1.0,
    persona,
    timeoutMs = 3000,
    onEnd,
    onError,
    deps,
  } = options;

  stopActiveTts();

  const normalizedPersona = normalizeVoicePersona(persona);
  const fallbackSpeak = deps?.fallbackSpeak ?? speakText;
  const trimmed = text.trim();

  if (!trimmed) {
    onEnd?.();
    return () => {};
  }

  if (trimmed.length > MAX_TTS_TEXT_LENGTH || typeof window === "undefined") {
    const cancelFallback = fallbackSpeak(
      trimmed,
      rate,
      onEnd,
      onError,
      normalizedPersona
    );
    activeStop = cancelFallback;
    return cancelFallback;
  }

  const fetchFn = deps?.fetchFn ?? window.fetch.bind(window);
  const createAudio =
    deps?.createAudio ?? ((url: string) => new window.Audio(url));
  const createObjectUrl =
    deps?.createObjectUrl ??
    ((blob: Blob) => window.URL.createObjectURL(blob));
  const revokeObjectUrl =
    deps?.revokeObjectUrl ??
    ((url: string) => window.URL.revokeObjectURL(url));

  let canceled = false;
  let objectUrl: string | null = null;
  let audio: HTMLAudioElement | null = null;
  let cancelFallback: (() => void) | null = null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  const cleanupAudio = () => {
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      try {
        audio.pause();
      } catch {
      }
      audio = null;
    }
    if (objectUrl) {
      try {
        revokeObjectUrl(objectUrl);
      } catch {
      }
      objectUrl = null;
    }
  };

  const triggerFallback = () => {
    if (canceled) return;
    cleanupAudio();
    cancelFallback = fallbackSpeak(
      trimmed,
      rate,
      () => {
        if (activeStop === cancel) activeStop = null;
        onEnd?.();
      },
      (err) => {
        if (activeStop === cancel) activeStop = null;
        onError?.(err);
      },
      normalizedPersona
    );
  };

  const cancel = () => {
    if (canceled) return;
    canceled = true;
    clearTimeout(timeoutId);
    controller.abort();
    cleanupAudio();
    if (cancelFallback) {
      cancelFallback();
      cancelFallback = null;
    }
    if (activeStop === cancel) {
      activeStop = null;
    }
  };

  activeStop = cancel;

  const params = new URLSearchParams({
    text: trimmed,
    persona: normalizedPersona,
    rate: String(rate),
  });

  fetchFn(`/api/tts?${params.toString()}`, {
    method: "GET",
    signal: controller.signal,
  })
    .then(async (response) => {
      clearTimeout(timeoutId);
      if (canceled) return;
      if (!response.ok) {
        triggerFallback();
        return;
      }

      const blob = await response.blob();
      if (canceled || blob.size === 0) {
        if (!canceled) triggerFallback();
        return;
      }

      objectUrl = createObjectUrl(blob);
      audio = createAudio(objectUrl);

      audio.onended = () => {
        cleanupAudio();
        if (activeStop === cancel) activeStop = null;
        if (!canceled) onEnd?.();
      };

      audio.onerror = () => {
        triggerFallback();
      };

      await audio.play();
    })
    .catch(() => {
      clearTimeout(timeoutId);
      triggerFallback();
    });

  return cancel;
}

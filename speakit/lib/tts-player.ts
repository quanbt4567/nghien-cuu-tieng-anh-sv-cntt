import {
  MAX_TTS_TEXT_LENGTH,
  normalizeVoicePersona,
  resolveVoiceForPersona,
  speakText,
} from "./speech";
import { VoicePersonaId } from "./types";

export type VoicePersona = "google_clear" | VoicePersonaId;

export interface TtsVoicePersonaOption {
  id: VoicePersona;
  label: string;
  lang: string;
  neuralVoice?: string;
}

export const DEFAULT_VOICE_PERSONA: VoicePersona = "google_clear";

export const TTS_VOICE_PERSONAS: TtsVoicePersonaOption[] = [
  {
    id: "google_clear",
    label: "Giọng Google — Rõ từng từ, dễ nghe nhất",
    lang: "en-US",
  },
  {
    id: "beginner_sg",
    label: "Dễ nghe - Chuẩn châu Á",
    lang: "en-SG",
    neuralVoice: "en-SG-LunaNeural",
  },
  {
    id: "hr_us_female",
    label: "US Female - HR",
    lang: "en-US",
    neuralVoice: "en-US-JennyNeural",
  },
  {
    id: "lead_us_male",
    label: "US English - Tech Lead",
    lang: "en-US",
    neuralVoice: "en-US-AndrewNeural",
  },
  {
    id: "client_uk",
    label: "UK English - Client",
    lang: "en-GB",
    neuralVoice: "en-GB-SoniaNeural",
  },
];

export function normalizeTtsPersona(value?: string | null): VoicePersona {
  if (!value || value === "auto" || value === "google_clear") {
    return DEFAULT_VOICE_PERSONA;
  }
  if (
    value === "beginner_sg" ||
    value === "hr_us_female" ||
    value === "lead_us_male" ||
    value === "client_uk" ||
    value === "us-hr-female" ||
    value === "us-tech-lead" ||
    value === "uk-client"
  ) {
    return normalizeVoicePersona(value);
  }
  return DEFAULT_VOICE_PERSONA;
}

export interface PlayTtsOptions {
  text: string;
  rate?: 0.8 | 1.0 | 1.2;
  persona?: VoicePersona | string;
  slowMode?: boolean;
  timeoutMs?: number;
  onEnd?: () => void;
  onError?: (message: string) => void;
  onProgress?: (ratio: number) => void;
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

function speakWithProgressFallback(
  text: string,
  rate: number,
  persona: VoicePersona,
  onEnd?: () => void,
  onError?: (message: string) => void,
  onProgress?: (ratio: number) => void,
  injectedFallback?: typeof speakText
): () => void {
  const speechPersona = (
    persona === "google_clear" ? "beginner_sg" : persona
  ) as VoicePersonaId;

  if (
    injectedFallback ||
    typeof window === "undefined" ||
    !("speechSynthesis" in window) ||
    typeof SpeechSynthesisUtterance === "undefined"
  ) {
    const fallback = injectedFallback ?? speakText;
    const cancel = fallback(
      text,
      rate as 0.8 | 1.0 | 1.2,
      () => {
        onProgress?.(-1);
        onEnd?.();
      },
      (err) => {
        onProgress?.(-1);
        onError?.(err);
      },
      speechPersona
    );
    return () => {
      onProgress?.(-1);
      cancel();
    };
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const resolved = resolveVoiceForPersona(
    speechPersona,
    window.speechSynthesis.getVoices()
  );
  if (resolved.voice) {
    utterance.voice = resolved.voice;
  }
  utterance.lang = resolved.lang;
  utterance.pitch = resolved.pitch;
  utterance.rate = rate;

  let finished = false;
  let boundarySeen = false;
  const wordCount = Math.max(1, text.split(/\s+/).filter(Boolean).length);
  const estimatedMs = Math.max(1200, (wordCount / (2.4 * Math.max(0.5, rate))) * 1000);
  const startedAt = Date.now();

  const intervalId = setInterval(() => {
    if (finished || boundarySeen) return;
    const ratio = Math.min(0.95, Math.max(0, (Date.now() - startedAt) / estimatedMs));
    onProgress?.(ratio);
  }, 100);

  const cleanup = () => {
    if (finished) return;
    finished = true;
    clearInterval(intervalId);
    onProgress?.(-1);
  };

  utterance.onboundary = (event) => {
    if (finished) return;
    if (typeof event.charIndex === "number" && text.length > 0) {
      boundarySeen = true;
      onProgress?.(Math.min(1, Math.max(0, event.charIndex / text.length)));
    }
  };

  utterance.onend = () => {
    cleanup();
    onEnd?.();
  };

  utterance.onerror = (event) => {
    cleanup();
    if (event.error === "canceled" || event.error === "interrupted") return;
    onError?.("Không thể phát âm thanh. Vui lòng kiểm tra lại thiết bị loa của bạn.");
  };

  onProgress?.(0);
  window.speechSynthesis.speak(utterance);

  return () => {
    cleanup();
    window.speechSynthesis.cancel();
  };
}

export function playTtsAudio(options: PlayTtsOptions): () => void {
  const {
    text,
    rate = 1.0,
    persona,
    slowMode = false,
    timeoutMs = 3000,
    onEnd,
    onError,
    onProgress,
    deps,
  } = options;

  stopActiveTts();

  const normalizedPersona = normalizeTtsPersona(persona);
  const effectiveFallbackRate = slowMode ? 0.72 : rate;
  const trimmed = text.trim();

  if (!trimmed) {
    onProgress?.(-1);
    onEnd?.();
    return () => {};
  }

  if (trimmed.length > MAX_TTS_TEXT_LENGTH || typeof window === "undefined") {
    const cancelFallback = speakWithProgressFallback(
      trimmed,
      effectiveFallbackRate,
      normalizedPersona,
      onEnd,
      onError,
      onProgress,
      deps?.fallbackSpeak
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
  let rafId: number | null = null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  const stopRaf = () => {
    if (rafId !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(rafId);
    }
    rafId = null;
  };

  const cleanupAudio = () => {
    stopRaf();
    if (audio) {
      audio.ontimeupdate = null;
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
    onProgress?.(-1);
    cancelFallback = speakWithProgressFallback(
      trimmed,
      effectiveFallbackRate,
      normalizedPersona,
      () => {
        if (activeStop === cancel) activeStop = null;
        onEnd?.();
      },
      (err) => {
        if (activeStop === cancel) activeStop = null;
        onError?.(err);
      },
      onProgress,
      deps?.fallbackSpeak
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
    onProgress?.(-1);
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
  if (slowMode) {
    params.set("slowMode", "true");
  }

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
      audio.playbackRate =
        normalizedPersona === "google_clear" && !slowMode ? 0.88 : 1;

      const emitAudioProgress = () => {
        if (!audio || canceled) return;
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          const ratio = Math.min(
            1,
            Math.max(0, audio.currentTime / audio.duration)
          );
          onProgress?.(ratio);
        }
      };

      const tick = () => {
        if (!audio || canceled) return;
        emitAudioProgress();
        if (typeof requestAnimationFrame === "function") {
          rafId = requestAnimationFrame(tick);
        }
      };

      audio.ontimeupdate = emitAudioProgress;

      audio.onended = () => {
        cleanupAudio();
        onProgress?.(-1);
        if (activeStop === cancel) activeStop = null;
        if (!canceled) onEnd?.();
      };

      audio.onerror = () => {
        onProgress?.(-1);
        triggerFallback();
      };

      onProgress?.(0);
      if (onProgress && typeof requestAnimationFrame === "function") {
        rafId = requestAnimationFrame(tick);
      }

      await audio.play();
    })
    .catch(() => {
      clearTimeout(timeoutId);
      triggerFallback();
    });

  return cancel;
}

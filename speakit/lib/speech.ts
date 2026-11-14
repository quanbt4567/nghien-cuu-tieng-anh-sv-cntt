import { VoicePersonaId } from "./types";

interface IWindowSpeechRecognition extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export interface VoicePersonaOption {
  id: VoicePersonaId;
  label: string;
  shortLabel: string;
  lang: string;
  pitch: number;
  keywords: string[];
}

export const VOICE_PERSONAS: VoicePersonaOption[] = [
  {
    id: "auto",
    label: "Auto (Default English)",
    shortLabel: "Auto",
    lang: "en-US",
    pitch: 1.0,
    keywords: [],
  },
  {
    id: "us-tech-lead",
    label: "US English - Tech Lead",
    shortLabel: "US Tech Lead",
    lang: "en-US",
    pitch: 0.92,
    keywords: ["david", "mark", "guy", "andrew", "alex", "daniel", "male", "google us english"],
  },
  {
    id: "us-hr-female",
    label: "US Female - HR",
    shortLabel: "US Female HR",
    lang: "en-US",
    pitch: 1.1,
    keywords: ["zira", "aria", "jenny", "samantha", "victoria", "ava", "female", "google us english"],
  },
  {
    id: "uk-client",
    label: "UK English - Client",
    shortLabel: "UK Client",
    lang: "en-GB",
    pitch: 1.0,
    keywords: ["libby", "ryan", "sonia", "george", "hazel", "kate", "serena", "google uk english", "en-gb", "en_gb"],
  },
];

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const win = window as unknown as IWindowSpeechRecognition;
  return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
}

export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "speechSynthesis" in window;
}

export function getAvailableEnglishVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSynthesisSupported()) return [];
  return window.speechSynthesis
    .getVoices()
    .filter((voice) => voice.lang.toLowerCase().startsWith("en"));
}

export function resolveVoiceForPersona(
  personaId: VoicePersonaId,
  voices: SpeechSynthesisVoice[]
): { voice: SpeechSynthesisVoice | null; lang: string; pitch: number } {
  const persona =
    VOICE_PERSONAS.find((item) => item.id === personaId) ?? VOICE_PERSONAS[0];
  const englishVoices = voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith("en")
  );
  if (englishVoices.length === 0) {
    return { voice: null, lang: persona.lang, pitch: persona.pitch };
  }

  const targetLangPrefix = persona.lang.toLowerCase().replace("_", "-");
  const langMatches = englishVoices.filter((voice) =>
    voice.lang.toLowerCase().replace("_", "-").startsWith(targetLangPrefix)
  );
  const pool = langMatches.length > 0 ? langMatches : englishVoices;

  for (const kw of persona.keywords) {
    const matched = pool.find((voice) =>
      `${voice.name} ${voice.lang}`.toLowerCase().includes(kw)
    );
    if (matched) {
      return { voice: matched, lang: matched.lang || persona.lang, pitch: persona.pitch };
    }
  }

  return { voice: pool[0], lang: pool[0].lang || persona.lang, pitch: persona.pitch };
}

function readStoredVoicePersona(): VoicePersonaId {
  if (typeof window === "undefined") return "auto";
  try {
    const raw = window.localStorage.getItem("speakit_settings_v1");
    if (!raw) return "auto";
    const parsed = JSON.parse(raw) as { voicePersona?: string };
    if (
      parsed.voicePersona === "us-tech-lead" ||
      parsed.voicePersona === "us-hr-female" ||
      parsed.voicePersona === "uk-client" ||
      parsed.voicePersona === "auto"
    ) {
      return parsed.voicePersona;
    }
  } catch {
  }
  return "auto";
}

export function speakText(
  text: string,
  rate: 0.8 | 1.0 | 1.2 = 1.0,
  onEnd?: () => void,
  onError?: (err: string) => void,
  voicePersona?: VoicePersonaId
): () => void {
  if (!isSpeechSynthesisSupported()) {
    if (onError) onError("Trình duyệt không hỗ trợ phát âm thanh tổng hợp.");
    return () => {};
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const activePersona = voicePersona ?? readStoredVoicePersona();
  const resolved = resolveVoiceForPersona(
    activePersona,
    window.speechSynthesis.getVoices()
  );
  if (resolved.voice) {
    utterance.voice = resolved.voice;
  }
  utterance.lang = resolved.lang;
  utterance.pitch = resolved.pitch;
  utterance.rate = rate;

  utterance.onend = () => {
    if (onEnd) onEnd();
  };

  utterance.onerror = (event) => {
    if (event.error === "canceled" || event.error === "interrupted") return;
    if (onError) {
      onError("Không thể phát âm thanh. Vui lòng kiểm tra lại thiết bị loa của bạn.");
    }
  };

  window.speechSynthesis.speak(utterance);

  return () => {
    window.speechSynthesis.cancel();
  };
}

export interface SpeechRecognitionCallbacks {
  onStart?: () => void;
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onEnd?: () => void;
  onError?: (messageVI: string, code?: string) => void;
}

export interface SpeechController {
  stop: () => void;
  abort: () => void;
}

/**
 * Speech recognition wrapper with Vietnamese error messages and automatic fallback handling
 */
export function startSpeechRecognition(
  callbacks: SpeechRecognitionCallbacks
): SpeechController | null {
  if (!isSpeechRecognitionSupported()) {
    callbacks.onError?.(
      "Trình duyệt không hỗ trợ Web Speech API. Hệ thống sẽ tự động mở ô gõ văn bản để bạn tiếp tục.",
      "NOT_SUPPORTED"
    );
    return null;
  }

  const win = window as unknown as IWindowSpeechRecognition;
  const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

  try {
    const recognition = new SpeechRecognitionClass();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    let hasReceivedTranscript = false;
    let finalTranscript = "";

    recognition.onstart = () => {
      callbacks.onStart?.();
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          finalTranscript += item[0].transcript;
        } else {
          interim += item[0].transcript;
        }
      }

      const current = (finalTranscript + " " + interim).trim();
      if (current.length > 0) {
        hasReceivedTranscript = true;
        callbacks.onTranscript?.(current, Boolean(event.results[0]?.isFinal));
      }
    };

    recognition.onerror = (event: any) => {
      const err = event.error;
      if (err === "no-speech") {
        callbacks.onError?.(
          "Không nhận diện được giọng nói, vui lòng thử lại hoặc gõ câu trả lời.",
          "NO_SPEECH"
        );
      } else if (err === "not-allowed" || err === "permission-denied") {
        callbacks.onError?.(
          "Quyền truy cập microphone bị từ chối. Bạn có thể gõ câu trả lời bằng bàn phím.",
          "PERMISSION_DENIED"
        );
      } else if (err === "network") {
        callbacks.onError?.(
          "Lỗi kết nối giọng nói mạng. Vui lòng kiểm tra kết nối hoặc chuyển sang gõ chữ.",
          "NETWORK_ERROR"
        );
      } else if (err !== "aborted") {
        callbacks.onError?.(
          "Có sự cố khi nhận diện giọng nói. Vui lòng thử lại hoặc nhập câu trả lời trực tiếp.",
          err
        );
      }
    };

    recognition.onend = () => {
      if (!hasReceivedTranscript && finalTranscript.trim().length === 0) {
        // Did not capture anything
        callbacks.onError?.(
          "Không nhận diện được giọng nói, vui lòng thử lại hoặc gõ câu trả lời.",
          "EMPTY_TRANSCRIPT"
        );
      }
      callbacks.onEnd?.();
    };

    recognition.start();

    return {
      stop: () => {
        try {
          recognition.stop();
        } catch {
          // ignore already stopped
        }
      },
      abort: () => {
        try {
          recognition.abort();
        } catch {
          // ignore
        }
      },
    };
  } catch (error) {
    callbacks.onError?.(
      "Không thể khởi chạy micro ghi âm. Vui lòng kiểm tra quyền thiết bị.",
      "INIT_ERROR"
    );
    return null;
  }
}

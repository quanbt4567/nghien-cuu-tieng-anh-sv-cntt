// Web Speech API interfaces for SpeechRecognition across browsers
interface IWindowSpeechRecognition extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const win = window as unknown as IWindowSpeechRecognition;
  return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
}

export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "speechSynthesis" in window;
}

/**
 * Text-to-speech helper with configurable rate and cancellation
 */
export function speakText(
  text: string,
  rate: 0.8 | 1.0 | 1.2 = 1.0,
  onEnd?: () => void,
  onError?: (err: string) => void
): () => void {
  if (!isSpeechSynthesisSupported()) {
    if (onError) onError("Trình duyệt không hỗ trợ phát âm thanh tổng hợp.");
    return () => {};
  }

  // Cancel any ongoing utterance
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = rate;

  utterance.onend = () => {
    if (onEnd) onEnd();
  };

  utterance.onerror = (event) => {
    // If canceled manually, do not treat as error
    if (event.error === "canceled" || event.error === "interrupted") return;
    if (onError) {
      onError("Không thể phát âm thanh. Vui lòng kiểm tra lại thiết bị loa của bạn.");
    }
  };

  window.speechSynthesis.speak(utterance);

  // Return cancel function
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

const SFX_MUTE_STORAGE_KEY = "speakit_arena_sfx_muted_v1";

let mutedFallback = false;
let cachedAudioContext: AudioContext | null = null;

type AudioWindow = Window & {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

export function isSfxMuted(): boolean {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(SFX_MUTE_STORAGE_KEY);
      if (stored === "1" || stored === "true") return true;
      if (stored === "0" || stored === "false") return false;
    } catch {
      return mutedFallback;
    }
  }
  return mutedFallback;
}

export function setSfxMuted(muted: boolean): void {
  mutedFallback = Boolean(muted);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(SFX_MUTE_STORAGE_KEY, mutedFallback ? "1" : "0");
    } catch {
      return;
    }
  }
}

function acquireAudioContext(): AudioContext | null {
  if (typeof window === "undefined" || isSfxMuted()) {
    return null;
  }

  const audioWin = window as AudioWindow;
  const Ctor = audioWin.AudioContext ?? audioWin.webkitAudioContext;
  if (!Ctor) {
    return null;
  }

  try {
    if (!cachedAudioContext || cachedAudioContext.state === "closed") {
      cachedAudioContext = new Ctor();
    }
    if (cachedAudioContext.state === "suspended") {
      void cachedAudioContext.resume().catch(() => {});
    }
    return cachedAudioContext;
  } catch {
    return null;
  }
}

function scheduleTone(
  ctx: AudioContext,
  options: {
    type: OscillatorType;
    startFreq: number;
    endFreq?: number;
    startTime: number;
    duration: number;
    peakGain: number;
  }
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = options.type;
  osc.frequency.setValueAtTime(Math.max(20, options.startFreq), options.startTime);
  if (typeof options.endFreq === "number") {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, options.endFreq),
      options.startTime + options.duration
    );
  }

  gain.gain.setValueAtTime(0.0001, options.startTime);
  gain.gain.linearRampToValueAtTime(
    Math.max(0.001, options.peakGain),
    options.startTime + Math.min(0.012, options.duration * 0.2)
  );
  gain.gain.exponentialRampToValueAtTime(0.0001, options.startTime + options.duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(options.startTime);
  osc.stop(options.startTime + options.duration + 0.01);
}

export function playTick(urgency = 0): void {
  const ctx = acquireAudioContext();
  if (!ctx) return;

  try {
    const clamped = Number.isFinite(urgency) ? Math.max(0, Math.min(1, urgency)) : 0;
    const now = ctx.currentTime;
    const freq = 620 + clamped * 680;
    const duration = 0.05 - clamped * 0.018;
    scheduleTone(ctx, {
      type: clamped > 0.65 ? "square" : "triangle",
      startFreq: freq,
      endFreq: freq * 0.72,
      startTime: now,
      duration,
      peakGain: 0.09 + clamped * 0.07,
    });
  } catch {
    return;
  }
}

export function playBuzzerFoul(): void {
  const ctx = acquireAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    scheduleTone(ctx, {
      type: "sawtooth",
      startFreq: 145,
      endFreq: 96,
      startTime: now,
      duration: 0.36,
      peakGain: 0.16,
    });
    scheduleTone(ctx, {
      type: "sawtooth",
      startFreq: 153,
      endFreq: 102,
      startTime: now,
      duration: 0.36,
      peakGain: 0.14,
    });
  } catch {
    return;
  }
}

export function playCriticalHit(): void {
  const ctx = acquireAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    scheduleTone(ctx, {
      type: "sawtooth",
      startFreq: 260,
      endFreq: 1180,
      startTime: now,
      duration: 0.1,
      peakGain: 0.16,
    });
    const notes = [880, 1174.66, 1567.98];
    notes.forEach((freq, idx) => {
      scheduleTone(ctx, {
        type: "triangle",
        startFreq: freq,
        endFreq: freq * 1.03,
        startTime: now + 0.06 + idx * 0.055,
        duration: 0.14,
        peakGain: 0.15,
      });
    });
  } catch {
    return;
  }
}

export function playExplosion(): void {
  const ctx = acquireAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const duration = 0.65;
    const sampleRate = ctx.sampleRate || 44100;
    const frameCount = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i += 1) {
      const decay = 1 - i / frameCount;
      data[i] = (Math.random() * 2 - 1) * decay;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(75, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + duration);

    scheduleTone(ctx, {
      type: "sine",
      startFreq: 135,
      endFreq: 30,
      startTime: now,
      duration: 0.45,
      peakGain: 0.24,
    });
  } catch {
    return;
  }
}

export function playComboChime(streak = 1): void {
  const ctx = acquireAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const safeStreak = Number.isFinite(streak) ? Math.max(1, Math.min(10, Math.floor(streak))) : 1;
    const baseFreq = 523.25 * Math.pow(1.06, safeStreak - 1);
    const ratios = [1, 1.25, 1.5];
    ratios.forEach((ratio, idx) => {
      scheduleTone(ctx, {
        type: "sine",
        startFreq: baseFreq * ratio,
        startTime: now + idx * 0.055,
        duration: 0.18,
        peakGain: 0.14,
      });
    });
  } catch {
    return;
  }
}

export function playVictoryFanfare(): void {
  const ctx = acquireAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const steps: Array<{ freq: number; offset: number; duration: number }> = [
      { freq: 523.25, offset: 0, duration: 0.12 },
      { freq: 659.25, offset: 0.1, duration: 0.12 },
      { freq: 783.99, offset: 0.2, duration: 0.12 },
      { freq: 1046.5, offset: 0.32, duration: 0.48 },
    ];
    for (const step of steps) {
      scheduleTone(ctx, {
        type: "triangle",
        startFreq: step.freq,
        startTime: now + step.offset,
        duration: step.duration,
        peakGain: 0.16,
      });
    }
    scheduleTone(ctx, {
      type: "sine",
      startFreq: 783.99,
      startTime: now + 0.32,
      duration: 0.48,
      peakGain: 0.1,
    });
  } catch {
    return;
  }
}

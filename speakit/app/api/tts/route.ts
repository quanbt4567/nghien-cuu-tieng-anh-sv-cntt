import { NextRequest, NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { getAllAudioBase64 } from "google-tts-api";
import {
  formatTtsRate,
  getNeuralVoiceForPersona,
  validateTtsInput,
} from "../../../lib/speech";

export const runtime = "nodejs";

const PAUSE_INJECTED_VOICES = new Set([
  "en-SG-LunaNeural",
  "en-US-JennyNeural",
  "en-US-AndrewNeural",
]);

function escapeSsmlText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildEdgeSsmlInput(text: string, voiceName: string): string {
  const escaped = escapeSsmlText(text);
  if (!PAUSE_INJECTED_VOICES.has(voiceName)) {
    return escaped;
  }
  return escaped.replace(/([,;:])(\s+)/g, '$1<break time="200ms"/>$2');
}

async function synthesizeGoogleSpeechBuffer(
  text: string,
  slowMode: boolean
): Promise<Buffer> {
  const results = await getAllAudioBase64(text, {
    lang: "en",
    slow: slowMode,
    host: "https://translate.google.com",
    timeout: 10000,
  });
  const chunks = results
    .map((item) => Buffer.from(item.base64, "base64"))
    .filter((buf) => buf.length > 0);
  const audioBuffer = Buffer.concat(chunks);
  if (audioBuffer.length === 0) {
    throw new Error("Empty audio output from Google TTS.");
  }
  return audioBuffer;
}

async function synthesizeSpeechBuffer(
  text: string,
  persona?: string | null,
  rate?: string | number | null,
  slowMode = false
): Promise<Buffer> {
  const voiceName = getNeuralVoiceForPersona(persona);
  const formattedRate = formatTtsRate(rate);
  const effectiveRate =
    formattedRate ??
    (voiceName === "en-SG-LunaNeural" || slowMode ? "-15%" : undefined);
  const ssmlInput = buildEdgeSsmlInput(text, voiceName);
  const tts = new MsEdgeTTS({
    connectionTimeoutMs: 5000,
    synthesisTimeoutMs: 10000,
  });

  try {
    await tts.setMetadata(
      voiceName,
      OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
    );
    const { audioStream } = tts.toStream(
      ssmlInput,
      effectiveRate ? { rate: effectiveRate } : undefined
    );

    return await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      audioStream.on("data", (chunk: Buffer | Uint8Array | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      audioStream.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
      audioStream.on("error", (err: Error) => {
        reject(err);
      });
    });
  } finally {
    try {
      tts.close();
    } catch {
    }
  }
}

async function handleTtsRequest(
  rawText?: string | null,
  persona?: string | null,
  rate?: string | number | null,
  slowMode = false
) {
  const validation = validateTtsInput(rawText);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  if (persona === "google_clear" || slowMode) {
    try {
      const audioBuffer = await synthesizeGoogleSpeechBuffer(
        validation.text,
        Boolean(slowMode)
      );
      return new NextResponse(new Uint8Array(audioBuffer), {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "no-store",
        },
      });
    } catch {
    }
  }

  try {
    const audioBuffer = await synthesizeSpeechBuffer(
      validation.text,
      persona,
      rate,
      slowMode
    );
    if (audioBuffer.length === 0) {
      return NextResponse.json(
        { error: "Empty audio output from TTS service." },
        { status: 502 }
      );
    }

    return new NextResponse(new Uint8Array(audioBuffer), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "TTS synthesis failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slowParam = searchParams.get("slowMode");
  const slowMode = slowParam === "true" || slowParam === "1";
  return handleTtsRequest(
    searchParams.get("text"),
    searchParams.get("persona"),
    searchParams.get("rate"),
    slowMode
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      text?: string;
      persona?: string;
      rate?: string | number;
      slowMode?: boolean;
    };
    return handleTtsRequest(
      body.text,
      body.persona,
      body.rate,
      Boolean(body.slowMode)
    );
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
}

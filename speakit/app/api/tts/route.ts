import { NextRequest, NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import {
  formatTtsRate,
  getNeuralVoiceForPersona,
  validateTtsInput,
} from "../../../lib/speech";

export const runtime = "nodejs";

async function synthesizeSpeechBuffer(
  text: string,
  persona?: string | null,
  rate?: string | number | null
): Promise<Buffer> {
  const voiceName = getNeuralVoiceForPersona(persona);
  const formattedRate = formatTtsRate(rate);
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
      text,
      formattedRate ? { rate: formattedRate } : undefined
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
  rate?: string | number | null
) {
  const validation = validateTtsInput(rawText);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const audioBuffer = await synthesizeSpeechBuffer(
      validation.text,
      persona,
      rate
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
  return handleTtsRequest(
    searchParams.get("text"),
    searchParams.get("persona"),
    searchParams.get("rate")
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      text?: string;
      persona?: string;
      rate?: string | number;
    };
    return handleTtsRequest(body.text, body.persona, body.rate);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
}

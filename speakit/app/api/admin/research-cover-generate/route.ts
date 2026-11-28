import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../../../lib/adminAuth";

export const dynamic = "force-dynamic";

const XKIRO_ENDPOINT = "https://api.xkiro.com/v1/images/generations";
const XKIRO_MODEL = "sensenova/sensenova-u1.5-lite";
const PROMPT_SUFFIX =
  " tươi sáng, năng động, hiện đại. Tuyệt đối không vẽ chữ, số hay logo lên ảnh.";
const MAX_PROMPT_LENGTH = 500;
const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 30;

interface XkiroImageDataItem {
  url?: string;
  b64_json?: string;
}

interface XkiroGenerationResponse {
  id?: string;
  jobId?: string;
  job_id?: string;
  status?: string;
  url?: string;
  b64_json?: string;
  data?: XkiroImageDataItem[];
  output?: XkiroImageDataItem[];
  error?: { message?: string; code?: string } | string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractImageSource(payload: XkiroGenerationResponse): {
  url?: string;
  b64?: string;
} {
  const firstData = Array.isArray(payload.data) ? payload.data[0] : undefined;
  const firstOutput = Array.isArray(payload.output) ? payload.output[0] : undefined;
  const url = firstData?.url ?? firstOutput?.url ?? payload.url;
  const b64 = firstData?.b64_json ?? firstOutput?.b64_json ?? payload.b64_json;
  return {
    url: typeof url === "string" && url.trim() ? url.trim() : undefined,
    b64: typeof b64 === "string" && b64.trim() ? b64.trim() : undefined,
  };
}

function extensionFromContentType(contentType: string): string {
  const lower = contentType.toLowerCase();
  if (lower.includes("webp")) return "webp";
  if (lower.includes("jpeg") || lower.includes("jpg")) return "jpg";
  return "png";
}

async function resolveImageBuffer(
  source: { url?: string; b64?: string }
): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (source.b64) {
    const match = source.b64.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    const contentType = match ? match[1] : "image/png";
    const rawBase64 = match ? match[2] : source.b64;
    return { buffer: Buffer.from(rawBase64, "base64"), contentType };
  }
  if (source.url) {
    const imgRes = await fetch(source.url, { cache: "no-store" });
    if (!imgRes.ok) return null;
    const contentType = imgRes.headers.get("content-type") || "image/png";
    const arrayBuffer = await imgRes.arrayBuffer();
    return { buffer: Buffer.from(arrayBuffer), contentType };
  }
  return null;
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.XKIRO_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "Chưa cấu hình key ảnh, hãy kiểm tra XKIRO_API_KEY" },
      { status: 503 }
    );
  }

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!blobToken) {
    return NextResponse.json(
      { ok: false, error: "Chưa cấu hình BLOB_READ_WRITE_TOKEN để lưu ảnh lên Vercel Blob." },
      { status: 503 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Dữ liệu yêu cầu không hợp lệ." },
      { status: 400 }
    );
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json(
      { ok: false, error: "Vui lòng nhập mô tả (prompt) để tạo ảnh." },
      { status: 400 }
    );
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json(
      { ok: false, error: "Prompt tối đa 500 ký tự." },
      { status: 400 }
    );
  }

  try {
    const createRes = await fetch(XKIRO_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: XKIRO_MODEL,
        prompt: `${prompt}${PROMPT_SUFFIX}`,
        n: 1,
        size: "1024x1024",
      }),
      cache: "no-store",
    });

    if (createRes.status === 401 || createRes.status === 403) {
      return NextResponse.json(
        { ok: false, error: "Chưa cấu hình key ảnh, hãy kiểm tra XKIRO_API_KEY" },
        { status: 502 }
      );
    }

    const createData = (await createRes.json().catch(() => ({}))) as XkiroGenerationResponse;
    if (!createRes.ok) {
      if (createData.status === "blocked") {
        return NextResponse.json(
          { ok: false, error: "Prompt bị từ chối, hãy diễn đạt lại" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { ok: false, error: "Không thể khởi tạo tác vụ tạo ảnh AI. Vui lòng thử lại." },
        { status: 502 }
      );
    }

    let finalPayload = createData;
    let source = extractImageSource(finalPayload);

    if (!source.url && !source.b64) {
      const jobId = finalPayload.id ?? finalPayload.jobId ?? finalPayload.job_id;
      if (!jobId) {
        return NextResponse.json(
          { ok: false, error: "Không nhận được mã tác vụ tạo ảnh từ AI." },
          { status: 502 }
        );
      }

      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
        await sleep(POLL_INTERVAL_MS);
        const pollRes = await fetch(`${XKIRO_ENDPOINT}/${encodeURIComponent(jobId)}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${apiKey}` },
          cache: "no-store",
        });

        if (pollRes.status === 401 || pollRes.status === 403) {
          return NextResponse.json(
            { ok: false, error: "Chưa cấu hình key ảnh, hãy kiểm tra XKIRO_API_KEY" },
            { status: 502 }
          );
        }

        const pollData = (await pollRes.json().catch(() => ({}))) as XkiroGenerationResponse;
        const status = typeof pollData.status === "string" ? pollData.status.toLowerCase() : "";

        if (status === "blocked") {
          return NextResponse.json(
            { ok: false, error: "Prompt bị từ chối, hãy diễn đạt lại" },
            { status: 400 }
          );
        }

        if (status === "failed") {
          return NextResponse.json(
            { ok: false, error: "Tạo ảnh thất bại. Vui lòng thử lại với mô tả khác." },
            { status: 502 }
          );
        }

        const candidate = extractImageSource(pollData);
        if (status === "succeeded" || candidate.url || candidate.b64) {
          finalPayload = pollData;
          source = candidate;
          break;
        }
      }
    }

    if (!source.url && !source.b64) {
      return NextResponse.json(
        { ok: false, error: "Hết thời gian chờ tạo ảnh AI. Vui lòng thử lại." },
        { status: 504 }
      );
    }

    const resolved = await resolveImageBuffer(source);
    if (!resolved || resolved.buffer.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Không thể tải dữ liệu ảnh sau khi tạo." },
        { status: 502 }
      );
    }

    const ext = extensionFromContentType(resolved.contentType);
    const pathname = `research-covers/ai-${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
    const blob = await put(pathname, resolved.buffer, {
      access: "public",
      contentType: resolved.contentType,
      token: blobToken,
    });

    return NextResponse.json({ ok: true, url: blob.url });
  } catch (err) {
    console.error("[research-cover-generate] Failed:", err);
    return NextResponse.json(
      { ok: false, error: "Lỗi kết nối khi tạo ảnh AI. Vui lòng thử lại." },
      { status: 502 }
    );
  }
}

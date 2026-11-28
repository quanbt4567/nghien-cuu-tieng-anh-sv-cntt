import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../../../../lib/adminAuth";
import { requestAiWaterfallText } from "../../../../../lib/ai-waterfall";

export const dynamic = "force-dynamic";

function extractJsonPayload(raw: string): {
  title?: string;
  summary?: string;
  contentMarkdown?: string;
} | null {
  const cleaned = raw.replace(/```json|```/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as {
      title?: string;
      summary?: string;
      contentMarkdown?: string;
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const direction = body.direction === "en_to_vi" ? "en_to_vi" : "vi_to_en";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const summary = typeof body.summary === "string" ? body.summary.trim() : "";
  const contentMarkdown =
    typeof body.contentMarkdown === "string" ? body.contentMarkdown.trim() : "";

  if (!title && !summary && !contentMarkdown) {
    return NextResponse.json(
      { ok: false, error: "Vui lòng nhập nội dung nguồn trước khi dịch." },
      { status: 400 }
    );
  }

  const targetLang = direction === "vi_to_en" ? "English" : "Vietnamese";
  const systemPrompt = `You are a bilingual IT technical editor. Translate the provided article fields accurately into ${targetLang}. Preserve all Markdown structure (##, ###, -, *) and technical terms cleanly. Return ONLY valid JSON with keys: "title", "summary", "contentMarkdown".`;

  const result = await requestAiWaterfallText({
    systemInstruction: systemPrompt,
    userPrompt: JSON.stringify({ title, summary, contentMarkdown }),
    jsonMode: true,
    temperature: 0.25,
    maxTokens: 2800,
    timeoutMs: 25000,
  });

  if (!result) {
    return NextResponse.json(
      { ok: false, error: "Không thể kết nối AI để dịch lúc này. Vui lòng thử lại." },
      { status: 503 }
    );
  }

  const parsed = extractJsonPayload(result.text);
  if (!parsed || (!parsed.title && !parsed.summary && !parsed.contentMarkdown)) {
    return NextResponse.json(
      { ok: false, error: "AI trả về định dạng không hợp lệ. Vui lòng thử lại." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    provider: result.provider,
    title: (parsed.title ?? title).trim(),
    summary: (parsed.summary ?? summary).trim(),
    contentMarkdown: (parsed.contentMarkdown ?? contentMarkdown).trim(),
  });
}

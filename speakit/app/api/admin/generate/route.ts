import { NextRequest, NextResponse } from "next/server";
import {
  generateAdminContentDraft,
  validateAdminGenerateInput,
} from "../../../../lib/adminAiGenerator";
import { isAdminRequest } from "../../../../lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json(
      { ok: false, error: "Chưa đăng nhập phiên quản trị." },
      { status: 401 }
    );
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Nội dung JSON gửi lên không hợp lệ." },
      { status: 400 }
    );
  }

  const validated = validateAdminGenerateInput(body);
  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, error: validated.error },
      { status: 400 }
    );
  }

  try {
    const result = await generateAdminContentDraft(validated.value);
    return NextResponse.json({
      ok: true,
      kind: result.kind,
      mode: result.mode,
      provider: result.provider,
      draft: result.draft,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Không thể tạo bản nháp nội dung lúc này." },
      { status: 500 }
    );
  }
}

import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../../../lib/adminAuth";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function extensionForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!blobToken) {
    return NextResponse.json(
      { ok: false, error: "Chưa cấu hình BLOB_READ_WRITE_TOKEN để lưu ảnh lên Vercel Blob." },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Dữ liệu tải lên không hợp lệ." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { ok: false, error: "Vui lòng chọn một tệp ảnh hợp lệ." },
      { status: 400 }
    );
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { ok: false, error: "Chỉ hỗ trợ ảnh định dạng PNG, JPEG hoặc WebP." },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Ảnh vượt quá dung lượng tối đa 8MB." },
      { status: 400 }
    );
  }

  try {
    const ext = extensionForMime(file.type);
    const pathname = `research-covers/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
    const blob = await put(pathname, file, {
      access: "public",
      contentType: file.type,
      token: blobToken,
    });
    return NextResponse.json({ ok: true, url: blob.url });
  } catch (err) {
    console.error("[research-cover-upload] Vercel Blob upload failed:", err);
    return NextResponse.json(
      { ok: false, error: "Không thể tải ảnh lên Vercel Blob. Vui lòng thử lại." },
      { status: 502 }
    );
  }
}

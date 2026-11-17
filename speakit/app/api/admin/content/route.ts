import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../../../lib/adminAuth";
import {
  createEmptyContentOverrides,
  normalizeContentOverrides,
} from "../../../../lib/contentStore";
import { ensureSchema, getNeonSql } from "../../../../lib/db/neon";
import {
  clearDbVocabularyItems,
  deleteDbVocabularyItems,
} from "../../../../lib/vocabulary-db";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest) {
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

  const rawOverrides =
    body &&
    typeof body === "object" &&
    "overrides" in (body as Record<string, unknown>)
      ? (body as Record<string, unknown>).overrides
      : body;
  const overrides = normalizeContentOverrides(rawOverrides);

  const sql = getNeonSql();
  if (!sql || !(await ensureSchema())) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Chưa cấu hình hoặc không thể kết nối Neon Postgres (DATABASE_URL) để lưu nội dung.",
      },
      { status: 503 }
    );
  }

  try {
    const existingRows = await sql`
      SELECT payload
      FROM speakit_custom_content
      WHERE key = 'main'
      LIMIT 1
    `;
    const prevOverrides = normalizeContentOverrides(existingRows[0]?.payload);
    const nextVocabIds = new Set(overrides.customVocabulary.map((v) => v.id));
    const removedVocab = prevOverrides.customVocabulary.filter(
      (v) => !nextVocabIds.has(v.id)
    );
    const newlyHiddenIds = overrides.deletedVocabIds.map((id) => ({ id }));

    await sql`
      INSERT INTO speakit_custom_content (key, payload, updated_at)
      VALUES ('main', ${JSON.stringify(overrides)}::jsonb, NOW())
      ON CONFLICT (key) DO UPDATE SET
        payload = EXCLUDED.payload,
        updated_at = NOW()
    `;

    if (removedVocab.length > 0 || newlyHiddenIds.length > 0) {
      await deleteDbVocabularyItems([
        ...removedVocab.map((v) => ({ id: v.id, term: v.term })),
        ...newlyHiddenIds,
      ]);
    }
    return NextResponse.json({ ok: true, overrides });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Lỗi lưu nội dung tùy chỉnh lên Neon Postgres." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json(
      { ok: false, error: "Chưa đăng nhập phiên quản trị." },
      { status: 401 }
    );
  }

  const sql = getNeonSql();
  if (!sql || !(await ensureSchema())) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Chưa cấu hình hoặc không thể kết nối Neon Postgres (DATABASE_URL) để khôi phục mặc định.",
      },
      { status: 503 }
    );
  }

  try {
    await sql`DELETE FROM speakit_custom_content WHERE key = 'main'`;
    await clearDbVocabularyItems();
    return NextResponse.json({
      ok: true,
      overrides: createEmptyContentOverrides(),
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Lỗi khôi phục nội dung mặc định trên Neon Postgres." },
      { status: 500 }
    );
  }
}

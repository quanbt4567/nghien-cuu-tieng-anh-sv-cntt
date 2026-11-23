import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  createAdminSessionToken,
  isAdminRequest,
  isUsingDefaultPasscode,
  verifyAdminPasscode,
} from "../../../../lib/adminAuth";

export const dynamic = "force-dynamic";

function isHttpsRequest(req: NextRequest): boolean {
  return (
    req.nextUrl.protocol === "https:" ||
    req.headers.get("x-forwarded-proto") === "https"
  );
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    authenticated: isAdminRequest(req),
    isDefaultPasscode: isUsingDefaultPasscode(),
  });
}

export async function POST(req: NextRequest) {
  let body: { passcode?: unknown } | null = null;
  try {
    body = (await req.json()) as { passcode?: unknown };
  } catch {
    return NextResponse.json(
      { authenticated: false, error: "Dữ liệu yêu cầu không hợp lệ." },
      { status: 400 }
    );
  }

  const passcode = typeof body?.passcode === "string" ? body.passcode : "";
  if (!verifyAdminPasscode(passcode)) {
    return NextResponse.json(
      { authenticated: false, error: "Mã truy cập quản trị không chính xác." },
      { status: 401 }
    );
  }

  const res = NextResponse.json({
    authenticated: true,
    isDefaultPasscode: isUsingDefaultPasscode(),
  });
  res.cookies.set(ADMIN_COOKIE_NAME, createAdminSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 86400,
    secure: isHttpsRequest(req),
  });
  return res;
}

export async function DELETE(req: NextRequest) {
  const res = NextResponse.json({ authenticated: false });
  res.cookies.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: isHttpsRequest(req),
  });
  return res;
}

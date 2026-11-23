import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

// Server-only HMAC session helper for /admin routes (zero extra deps).
export const ADMIN_COOKIE_NAME = "speakit_admin_session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function getConfiguredPasscode(): string {
  const raw = process.env.ADMIN_PASSCODE?.trim();
  return raw && raw.length > 0 ? raw : "admin2025";
}

function getSessionSecret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET?.trim() ||
    process.env.ADMIN_PASSCODE?.trim() ||
    "speakit-local-admin-secret"
  );
}

function signPayload(payload: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
}

export function isUsingDefaultPasscode(): boolean {
  return !process.env.ADMIN_PASSCODE || process.env.ADMIN_PASSCODE.trim() === "";
}

export function verifyAdminPasscode(passcode: string): boolean {
  if (typeof passcode !== "string" || passcode.length === 0) return false;
  const expected = getConfiguredPasscode();
  const actualHash = createHash("sha256").update(passcode).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

export function createAdminSessionToken(): string {
  const payload = Buffer.from(
    JSON.stringify({
      exp: Date.now() + SESSION_TTL_MS,
      n: randomBytes(8).toString("hex"),
    }),
    "utf8"
  ).toString("base64url");
  return `${payload}.${signPayload(payload)}`;
}

export function verifyAdminSessionToken(token?: string): boolean {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;

  const [payload, sig] = parts;
  const expectedSig = signPayload(payload);
  const sigBuf = Buffer.from(sig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return false;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as { exp?: unknown };
    return (
      typeof parsed.exp === "number" &&
      Number.isFinite(parsed.exp) &&
      parsed.exp > Date.now()
    );
  } catch {
    return false;
  }
}

export function isAdminRequest(req: NextRequest): boolean {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminSessionToken(token);
}

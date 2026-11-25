import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { cleanupExpiredZeroCoinGuests } from "@/lib/neon-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const hasCronAuth =
    Boolean(cronSecret) &&
    request.headers.get("authorization") === `Bearer ${cronSecret}`;

  if (!hasCronAuth && !isAdminRequest(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const deletedCount = await cleanupExpiredZeroCoinGuests({ force: true });
    return NextResponse.json({ ok: true, deletedCount });
  } catch {
    return NextResponse.json(
      { ok: false, deletedCount: 0, error: "Cleanup failed" },
      { status: 500 }
    );
  }
}

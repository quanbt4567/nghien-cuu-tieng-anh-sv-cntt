import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../../../lib/adminAuth";
import {
  getAiHealthSummary,
  isValidAiProviderId,
  pingAllAiProviders,
  updateAiProviderConfig,
} from "../../../../lib/ai-telemetry";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const summary = await getAiHealthSummary();
  return NextResponse.json({ ok: true, ...summary });
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const pings = await pingAllAiProviders();
  const summary = await getAiHealthSummary();
  return NextResponse.json({ ok: true, pings, ...summary });
}

export async function PATCH(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!isValidAiProviderId(body.provider)) {
    return NextResponse.json({ ok: false, error: "Invalid provider" }, { status: 400 });
  }

  const dailyLimitCap =
    typeof body.dailyLimitCap === "number" && Number.isFinite(body.dailyLimitCap)
      ? body.dailyLimitCap
      : undefined;
  const isEnabled =
    typeof body.isEnabled === "boolean" ? body.isEnabled : undefined;

  if (dailyLimitCap === undefined && isEnabled === undefined) {
    return NextResponse.json(
      { ok: false, error: "dailyLimitCap or isEnabled is required" },
      { status: 400 }
    );
  }

  const result = await updateAiProviderConfig(body.provider, {
    dailyLimitCap,
    isEnabled,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error ?? "Update failed" },
      { status: 500 }
    );
  }

  const summary = await getAiHealthSummary();
  return NextResponse.json({ ok: true, ...summary });
}

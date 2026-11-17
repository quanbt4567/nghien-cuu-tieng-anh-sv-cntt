import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../../../lib/adminAuth";
import { extractDeleteIdsFromPayload } from "../../../../lib/adminBulkDelete";
import {
  COSMETIC_CATEGORIES,
  parseDiscordEffectJson,
  type CosmeticBlendMode,
  type CosmeticCategory,
  type CosmeticItem,
  type CosmeticRarity,
} from "../../../../lib/cosmetics";
import {
  deleteCustomCosmetics,
  listCustomCosmetics,
  saveCustomCosmetic,
} from "../../../../lib/custom-cosmetics";

export const dynamic = "force-dynamic";

const VALID_RARITIES: CosmeticRarity[] = ["Common", "Rare", "Epic", "Legendary"];

function applyOverrides(
  item: CosmeticItem,
  overrides: Record<string, unknown> | null
): CosmeticItem {
  if (!overrides) return item;
  const next: CosmeticItem = { ...item };

  if (
    typeof overrides.category === "string" &&
    COSMETIC_CATEGORIES.includes(overrides.category as CosmeticCategory)
  ) {
    next.category = overrides.category as CosmeticCategory;
    next.kind = overrides.category as CosmeticCategory;
  }

  if (
    typeof overrides.rarity === "string" &&
    VALID_RARITIES.includes(overrides.rarity as CosmeticRarity)
  ) {
    next.rarity = overrides.rarity as CosmeticRarity;
  }

  if (
    typeof overrides.price === "number" &&
    Number.isFinite(overrides.price) &&
    overrides.price >= 0
  ) {
    next.price = Math.round(overrides.price);
  }

  if (
    typeof overrides.scale === "number" &&
    Number.isFinite(overrides.scale) &&
    overrides.scale > 0
  ) {
    next.scale = overrides.scale;
  }

  if (overrides.blendMode === "normal" || overrides.blendMode === "screen") {
    next.blendMode = overrides.blendMode as CosmeticBlendMode;
  }

  if (typeof overrides.assetUrl === "string" && overrides.assetUrl.trim()) {
    next.assetUrl = overrides.assetUrl.trim();
  }

  if (typeof overrides.introAssetUrl === "string") {
    const trimmed = overrides.introAssetUrl.trim();
    if (trimmed) {
      next.introAssetUrl = trimmed;
    } else {
      delete next.introAssetUrl;
    }
  }

  if (typeof overrides.name === "string" && overrides.name.trim()) {
    next.name = overrides.name.trim();
  }

  if (typeof overrides.description === "string" && overrides.description.trim()) {
    next.description = overrides.description.trim();
  }

  if (typeof overrides.fallbackGlowColor === "string" && overrides.fallbackGlowColor.trim()) {
    next.fallbackGlowColor = overrides.fallbackGlowColor.trim();
    next.previewAccent = overrides.fallbackGlowColor.trim();
  }

  return next;
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const items = await listCustomCosmetics();
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
  }

  let parsedItems: CosmeticItem[] = [];
  let overrides: Record<string, unknown> | null = null;

  if (body && typeof body === "object" && !Array.isArray(body)) {
    const record = body as Record<string, unknown>;
    if (record.overrides && typeof record.overrides === "object" && !Array.isArray(record.overrides)) {
      overrides = record.overrides as Record<string, unknown>;
    }

    if (typeof record.rawJson === "string") {
      parsedItems = parseDiscordEffectJson(record.rawJson);
    } else if (record.item && typeof record.item === "object") {
      parsedItems = parseDiscordEffectJson(JSON.stringify(record.item));
    } else {
      parsedItems = parseDiscordEffectJson(JSON.stringify(record));
    }
  } else {
    parsedItems = parseDiscordEffectJson(JSON.stringify(body));
  }

  if (parsedItems.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No valid Discord effect or cosmetic item found." },
      { status: 400 }
    );
  }

  const savedItems: CosmeticItem[] = [];
  for (const draft of parsedItems) {
    const finalItem = applyOverrides(draft, parsedItems.length === 1 ? overrides : null);
    const saved = await saveCustomCosmetic(finalItem);
    if (!saved) {
      return NextResponse.json(
        { ok: false, error: "Database unavailable or failed to save cosmetic." },
        { status: 500 }
      );
    }
    savedItems.push(saved);
  }

  revalidatePath("/shop");
  revalidatePath("/profile");

  return NextResponse.json({ ok: true, items: savedItems });
}

export async function DELETE(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const ids = extractDeleteIdsFromPayload(req.nextUrl.searchParams, body);
  if (ids.length === 0) {
    return NextResponse.json({ ok: false, error: "Cosmetic ID is required." }, { status: 400 });
  }

  const deletedIds = await deleteCustomCosmetics(ids);
  if (deletedIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Cosmetic not found or database unavailable." },
      { status: 404 }
    );
  }

  revalidatePath("/shop");
  revalidatePath("/profile");

  return NextResponse.json({
    ok: true,
    id: deletedIds[0],
    deletedIds,
    deletedCount: deletedIds.length,
  });
}

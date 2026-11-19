import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const jiti = require("jiti")(__filename);

const {
  COSMETIC_CATEGORIES,
  COSMETIC_CATALOG,
  DEFAULT_EQUIPPED_COSMETICS,
  getCosmeticsByCategory,
  normalizeEquippedCosmetics,
} = jiti(resolve(__dirname, "../lib/cosmetics.ts"));

const {
  purchaseAndEquipCosmetic,
  equipOwnedCosmetic,
  unequipCosmeticSlot,
} = jiti(resolve(__dirname, "../app/actions/leaderboard.ts"));

test("COSMETIC_CATALOG has 112 items across all 6 categories priced 15..100 IT-Coins", () => {
  assert.equal(COSMETIC_CATALOG.length, 112);

  const expectedCategories = [
    "avatar_decoration",
    "profile_theme",
    "cursor_effect",
    "leaderboard_fx",
    "nameplate",
    "victory_finisher",
  ];
  assert.deepEqual(COSMETIC_CATEGORIES, expectedCategories);

  const seenIds = new Set();
  const seenRarities = new Set();

  for (const category of expectedCategories) {
    const items = getCosmeticsByCategory(category);
    const expectedCount = category === "nameplate" ? 22 : 18;
    assert.equal(items.length, expectedCount, `expected ${expectedCount} items in ${category}`);
    assert.ok(items.some((item) => item.id.includes("-rb-")), `expected React Bits items in ${category}`);
    assert.ok(items.some((item) => item.id.includes("-magic-")), `expected Magic UI items in ${category}`);
  }

  for (const item of COSMETIC_CATALOG) {
    assert.ok(item.id && !seenIds.has(item.id), `duplicate or empty id: ${item.id}`);
    seenIds.add(item.id);
    assert.ok(expectedCategories.includes(item.category));
    assert.ok(item.price >= 15 && item.price <= 100, `price out of 15..100 range: ${item.id}=${item.price}`);
    assert.ok(["Common", "Rare", "Epic", "Legendary"].includes(item.rarity));
    seenRarities.add(item.rarity);
    assert.ok(item.effectClass.startsWith("cosmetic-"));
    assert.match(item.previewAccent, /^#[0-9A-F]{6}$/i);
  }

  assert.deepEqual(
    Array.from(seenRarities).sort(),
    ["Common", "Epic", "Legendary", "Rare"]
  );
});

test("normalizeEquippedCosmetics handles all 6 slots, JSON strings, and invalid inputs", () => {
  assert.deepEqual(normalizeEquippedCosmetics(null), DEFAULT_EQUIPPED_COSMETICS);
  assert.deepEqual(normalizeEquippedCosmetics(undefined), DEFAULT_EQUIPPED_COSMETICS);
  assert.deepEqual(normalizeEquippedCosmetics("not-json"), DEFAULT_EQUIPPED_COSMETICS);
  assert.deepEqual(normalizeEquippedCosmetics(["bad"]), DEFAULT_EQUIPPED_COSMETICS);

  const fullPayload = {
    avatar_decoration: "avatar-quantum-holo-visor",
    profile_theme: "theme-electric-storm-surge",
    cursor_effect: "cursor-tactical-cyber-crosshair",
    leaderboard_fx: "lb-inferno-rank-aura",
    nameplate: "nameplate-cyber-glitch",
    victory_finisher: "finisher-matrix-override",
    unknown_slot: "should-be-ignored",
  };

  assert.deepEqual(normalizeEquippedCosmetics(fullPayload), {
    avatar_decoration: "avatar-quantum-holo-visor",
    profile_theme: "theme-electric-storm-surge",
    cursor_effect: "cursor-tactical-cyber-crosshair",
    leaderboard_fx: "lb-inferno-rank-aura",
    nameplate: "nameplate-cyber-glitch",
    victory_finisher: "finisher-matrix-override",
  });

  const fromJson = normalizeEquippedCosmetics(
    JSON.stringify({
      avatar_decoration: "  avatar-matrix-code-halo ",
      nameplate: "",
      victory_finisher: "finisher-lgtm-neon-confetti",
    })
  );

  assert.deepEqual(fromJson, {
    avatar_decoration: "avatar-matrix-code-halo",
    profile_theme: null,
    cursor_effect: null,
    leaderboard_fx: null,
    nameplate: null,
    victory_finisher: "finisher-lgtm-neon-confetti",
  });
});

test("purchaseAndEquipCosmetic, equipOwnedCosmetic, and unequipCosmeticSlot validate inputs and handle offline fallback", async () => {
  const prevDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  try {
    const unknownItem = await purchaseAndEquipCosmetic("non-existent-item", 25);
    assert.equal(unknownItem.ok, false);
    assert.match(unknownItem.error ?? "", /not found/i);

    const negativePrice = await purchaseAndEquipCosmetic(
      "avatar-cyberpunk-overclock-ring",
      -5
    );
    assert.equal(negativePrice.ok, false);
    assert.match(negativePrice.error ?? "", /invalid cosmetic price/i);

    const offlinePurchase = await purchaseAndEquipCosmetic(
      "avatar-cyberpunk-overclock-ring",
      25
    );
    assert.equal(offlinePurchase.ok, false);
    assert.equal(offlinePurchase.mode, "offline");
    assert.equal(offlinePurchase.player, null);
    assert.match(offlinePurchase.error ?? "", /Neon DB/i);

    const invalidEquipCat = await equipOwnedCosmetic(
      "invalid_slot",
      "avatar-cyberpunk-overclock-ring"
    );
    assert.equal(invalidEquipCat.ok, false);
    assert.match(invalidEquipCat.error ?? "", /invalid cosmetic category/i);

    const mismatchedEquip = await equipOwnedCosmetic(
      "profile_theme",
      "avatar-cyberpunk-overclock-ring"
    );
    assert.equal(mismatchedEquip.ok, false);
    assert.match(mismatchedEquip.error ?? "", /does not match category/i);

    const offlineEquip = await equipOwnedCosmetic(
      "avatar_decoration",
      "avatar-cyberpunk-overclock-ring"
    );
    assert.equal(offlineEquip.ok, false);
    assert.equal(offlineEquip.mode, "offline");
    assert.equal(offlineEquip.player, null);

    const invalidUnequipCat = await unequipCosmeticSlot("invalid_slot");
    assert.equal(invalidUnequipCat.ok, false);
    assert.match(invalidUnequipCat.error ?? "", /invalid cosmetic category/i);

    const offlineUnequip = await unequipCosmeticSlot("victory_finisher");
    assert.equal(offlineUnequip.ok, false);
    assert.equal(offlineUnequip.mode, "offline");
    assert.equal(offlineUnequip.player, null);
  } finally {
    if (prevDatabaseUrl !== undefined) {
      process.env.DATABASE_URL = prevDatabaseUrl;
    }
  }
});

test("mobile cursor trails support touch events, burst event, and shop live preview bar", () => {
  const cursorTrailSrc = readFileSync(
    resolve(__dirname, "../components/cosmetics/CustomCursorTrail.tsx"),
    "utf8"
  );
  const shopClientSrc = readFileSync(
    resolve(__dirname, "../components/cosmetics/CosmeticShopClient.tsx"),
    "utf8"
  );

  for (const token of ["pointerdown", "touchstart", "touchmove", "speakit-cursor-burst"]) {
    assert.ok(
      cursorTrailSrc.includes(token),
      `CustomCursorTrail.tsx missing ${token} handler`
    );
  }

  for (const token of [
    "SPEAKIT_CURSOR_BURST_EVENT",
    'data-tour="shop-sandbox-preview"',
    "Đang xem thử:",
    "Chạm/vuốt màn hình để xem hiệu ứng",
    "Xem Sandbox ↑",
    "Đặt lại",
  ]) {
    assert.ok(
      shopClientSrc.includes(token),
      `CosmeticShopClient.tsx missing ${token}`
    );
  }
});

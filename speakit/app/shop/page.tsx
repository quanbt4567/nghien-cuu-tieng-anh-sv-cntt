import type { Metadata } from "next";
import { CosmeticShopClient } from "../../components/cosmetics/CosmeticShopClient";
import { listCustomCosmetics } from "../../lib/custom-cosmetics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "IT-Coin Live Try-On Studio — SpeakIT",
  description:
    "Mở khóa và dùng thử trực tiếp Avatar Frame, Profile Theme, Cursor Trail, Leaderboard FX, Nameplate và Victory Finisher bằng IT-Coin.",
};

export default async function ShopPage() {
  const extraItems = await listCustomCosmetics();
  return <CosmeticShopClient extraItems={extraItems} />;
}

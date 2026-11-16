"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Check,
  Coins,
  ExternalLink,
  Eye,
  FileJson,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  COSMETIC_CATEGORIES,
  parseDiscordEffectJson,
  type CosmeticBlendMode,
  type CosmeticCategory,
  type CosmeticItem,
  type CosmeticRarity,
} from "../../lib/cosmetics";

interface AdminCosmeticsTabProps {
  onUnauthorized: () => void;
}

const CATEGORY_LABELS: Record<CosmeticCategory, string> = {
  avatar_decoration: "Avatar Decoration",
  profile_theme: "Profile Theme",
  cursor_effect: "Cursor Effect",
  leaderboard_fx: "Leaderboard FX",
  nameplate: "Nameplate",
  victory_finisher: "Victory Finisher",
};

const RARITY_OPTIONS: CosmeticRarity[] = ["Common", "Rare", "Epic", "Legendary"];

const SAMPLE_DISCORD_JSON = JSON.stringify(
  {
    title: "Cyber Sakura Frame",
    category: "avatar_decoration",
    rarity: "Epic",
    price: 75,
    scale: 1.22,
    blendMode: "normal",
    accent: "#E5484D",
    assets: {
      frame: "/discord-fx/avatar-cyberpunk-overclock-ring.png",
    },
  },
  null,
  2
);

function isVideoAsset(url?: string): boolean {
  if (!url) return false;
  const clean = url.split("?")[0].toLowerCase();
  return clean.endsWith(".webm") || clean.endsWith(".mp4");
}

function isLottieAsset(url?: string): boolean {
  if (!url) return false;
  return url.split("?")[0].toLowerCase().endsWith(".json");
}

function LiveAssetLayer({
  url,
  alt,
  className,
  blendMode = "normal",
}: {
  url?: string;
  alt: string;
  className: string;
  blendMode?: CosmeticBlendMode;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  if (!url || failed) return null;

  if (isLottieAsset(url)) {
    return (
      <div
        className={`${className} flex items-center justify-center border-2 border-dashed border-accent/60 rounded-full`}
      >
        <span className="px-2 py-0.5 rounded-pill bg-ink/80 text-white text-[10px] font-mono">
          Lottie JSON
        </span>
      </div>
    );
  }

  if (isVideoAsset(url)) {
    return (
      <video
        src={url}
        autoPlay
        loop
        muted
        playsInline
        onError={() => setFailed(true)}
        style={{ mixBlendMode: blendMode }}
        className={className}
      />
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      onError={() => setFailed(true)}
      style={{ mixBlendMode: blendMode }}
      className={className}
    />
  );
}

export function AdminCosmeticsTab({ onUnauthorized }: AdminCosmeticsTabProps) {
  const [items, setItems] = useState<CosmeticItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [rawJson, setRawJson] = useState("");
  const [name, setName] = useState("Discord Cyber Aura");
  const [description, setDescription] = useState(
    "Custom transparent Discord community effect imported via Admin Studio."
  );
  const [category, setCategory] = useState<CosmeticCategory>("avatar_decoration");
  const [rarity, setRarity] = useState<CosmeticRarity>("Epic");
  const [price, setPrice] = useState<number>(60);
  const [assetUrl, setAssetUrl] = useState("/discord-fx/avatar-cyberpunk-overclock-ring.png");
  const [introAssetUrl, setIntroAssetUrl] = useState("");
  const [scale, setScale] = useState<number>(1.22);
  const [blendMode, setBlendMode] = useState<CosmeticBlendMode>("normal");
  const [accentColor, setAccentColor] = useState("#E5484D");
  const [previewMode, setPreviewMode] = useState<"avatar" | "profile">("avatar");

  const parsedPack = useMemo(() => {
    if (!rawJson.trim()) return [];
    return parseDiscordEffectJson(rawJson);
  }, [rawJson]);

  const loadCustomCosmetics = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/cosmetics", { cache: "no-store" });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      if (res.ok) {
        const data = (await res.json()) as { items?: CosmeticItem[] };
        setItems(Array.isArray(data.items) ? data.items : []);
      } else {
        setErrorMessage("Không thể tải danh sách hiệu ứng tùy chỉnh.");
      }
    } catch {
      setErrorMessage("Lỗi kết nối khi tải danh sách hiệu ứng.");
    } finally {
      setIsLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    void loadCustomCosmetics();
  }, [loadCustomCosmetics]);

  const handleApplyParsedDraft = (draft: CosmeticItem) => {
    setName(draft.name);
    setDescription(draft.description);
    setCategory(draft.category);
    setRarity(draft.rarity);
    setPrice(draft.price);
    setAssetUrl(draft.assetUrl ?? "");
    setIntroAssetUrl(draft.introAssetUrl ?? "");
    setScale(draft.scale ?? (draft.category === "avatar_decoration" ? 1.22 : 1));
    setBlendMode(draft.blendMode ?? (draft.category === "profile_theme" ? "screen" : "normal"));
    setAccentColor(draft.fallbackGlowColor ?? draft.previewAccent ?? "#E5484D");
    setPreviewMode(draft.category === "profile_theme" ? "profile" : "avatar");
    setStatusMessage(`Đã nạp cấu hình từ JSON: ${draft.name}`);
    setErrorMessage(null);
  };

  const handleJsonChange = (value: string) => {
    setRawJson(value);
    const parsed = parseDiscordEffectJson(value);
    if (parsed.length === 1) {
      handleApplyParsedDraft(parsed[0]);
    }
  };

  const handlePublishSingle = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    if (!name.trim() || !assetUrl.trim()) {
      setErrorMessage("Vui lòng nhập tên hiệu ứng và Asset URL (APNG/WebM/Lottie).");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/cosmetics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item: {
            name: name.trim(),
            description: description.trim() || `Imported Discord FX: ${name.trim()}`,
            category,
            rarity,
            price: Math.max(0, Math.round(Number(price) || 0)),
            assetUrl: assetUrl.trim(),
            introAssetUrl: introAssetUrl.trim() || undefined,
            scale: Number(scale) > 0 ? Number(scale) : 1.22,
            blendMode,
            fallbackGlowColor: accentColor.trim() || "#E5484D",
          },
        }),
      });

      if (res.status === 401) {
        onUnauthorized();
        return;
      }

      const data = (await res.json()) as {
        ok?: boolean;
        items?: CosmeticItem[];
        error?: string;
      };

      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "Không thể xuất bản hiệu ứng lên /shop.");
        return;
      }

      setStatusMessage(
        `Đã xuất bản "${data.items?.[0]?.name ?? name}" lên /shop thành công!`
      );
      await loadCustomCosmetics();
    } catch {
      setErrorMessage("Lỗi kết nối khi lưu hiệu ứng.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishPack = async () => {
    if (parsedPack.length === 0) {
      setErrorMessage("JSON chưa hợp lệ hoặc không có hiệu ứng nào.");
      return;
    }
    setIsSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/admin/cosmetics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawJson }),
      });

      if (res.status === 401) {
        onUnauthorized();
        return;
      }

      const data = (await res.json()) as {
        ok?: boolean;
        items?: CosmeticItem[];
        error?: string;
      };

      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "Không thể import gói hiệu ứng.");
        return;
      }

      setStatusMessage(
        `Đã import và xuất bản ${data.items?.length ?? parsedPack.length} hiệu ứng lên /shop!`
      );
      setRawJson("");
      await loadCustomCosmetics();
    } catch {
      setErrorMessage("Lỗi kết nối khi import gói JSON.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/admin/cosmetics?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      if (!res.ok) {
        setErrorMessage("Không thể xóa hiệu ứng.");
        return;
      }
      setItems((prev) => prev.filter((entry) => entry.id !== id));
      setStatusMessage(`Đã xóa hiệu ứng "${id}" khỏi /shop.`);
    } catch {
      setErrorMessage("Lỗi kết nối khi xóa hiệu ứng.");
    } finally {
      setDeletingId(null);
    }
  };

  const previewScalePercent = Math.round((Number(scale) > 0 ? Number(scale) : 1.22) * 100);
  const previewInsetPercent = -Math.round((previewScalePercent - 100) / 2);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill bg-accent-light border border-accent/30 text-[11px] font-mono font-semibold text-ink mb-2">
            <Sparkles className="w-3 h-3 text-accent" aria-hidden="true" />
            <span>DISCORD FX IMPORTER</span>
          </div>
          <h2 className="text-lg font-bold tracking-tight text-ink">
            Kho Hiệu Ứng (Discord JSON Importer)
          </h2>
          <p className="text-xs text-ink/70 mt-0.5">
            Dán JSON từ Wick Studio / Discord Effects hoặc nhập URL APNG/WebM trong suốt, xem
            trước trực tiếp và xuất bản ngay lên /shop.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadCustomCosmetics()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white border border-ink/15 text-xs font-mono font-medium text-ink hover:bg-paper-muted transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Tải lại</span>
          </button>
          <Link
            href="/shop"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-pill bg-ink text-white text-xs font-semibold hover:bg-ink/90 transition-colors"
          >
            <span>Mở /shop</span>
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {statusMessage && (
        <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-900">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs font-medium text-red-800">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="discord-json-input"
                className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold uppercase tracking-wide text-ink"
              >
                <FileJson className="w-4 h-4 text-accent" aria-hidden="true" />
                <span>Discord / Wick Studio JSON Snippet</span>
              </label>
              <button
                type="button"
                onClick={() => handleJsonChange(SAMPLE_DISCORD_JSON)}
                className="text-[11px] font-mono font-semibold text-accent hover:underline"
              >
                Chèn JSON mẫu
              </button>
            </div>

            <textarea
              id="discord-json-input"
              rows={6}
              value={rawJson}
              onChange={(e) => handleJsonChange(e.target.value)}
              placeholder='{ "title": "Neon Frame", "assets": { "frame": "https://.../frame.png" } }'
              className="w-full rounded-xl border border-ink/15 bg-paper p-3 text-xs font-mono text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
            />

            {parsedPack.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-xs font-mono text-ink/80">
                  Nhận diện được <strong>{parsedPack.length}</strong> hiệu ứng từ JSON.
                </span>
                {parsedPack.length > 1 && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void handlePublishPack()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-pill bg-accent text-white text-xs font-semibold hover:bg-accent/90 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <UploadCloud className="w-3.5 h-3.5" />
                    )}
                    <span>Xuất bản cả gói ({parsedPack.length})</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => void handlePublishSingle(e)}
            className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft space-y-4"
          >
            <h3 className="text-sm font-bold text-ink">Cấu hình chi tiết & Xuất bản</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-mono font-semibold text-ink/75 mb-1">
                  Tên hiệu ứng
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-xs text-ink"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono font-semibold text-ink/75 mb-1">
                  Danh mục (/shop)
                </label>
                <select
                  value={category}
                  onChange={(e) => {
                    const nextCat = e.target.value as CosmeticCategory;
                    setCategory(nextCat);
                    setPreviewMode(nextCat === "profile_theme" ? "profile" : "avatar");
                  }}
                  className="w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-xs text-ink"
                >
                  {COSMETIC_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-semibold text-ink/75 mb-1">
                  Giá IT-Coin
                </label>
                <div className="relative">
                  <Coins className="w-3.5 h-3.5 text-amber-500 absolute left-3 top-2.5" />
                  <input
                    type="number"
                    min={0}
                    step={5}
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full rounded-xl border border-ink/15 bg-paper pl-8 pr-3 py-2 text-xs font-mono text-ink"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-semibold text-ink/75 mb-1">
                  Độ hiếm (Rarity)
                </label>
                <select
                  value={rarity}
                  onChange={(e) => setRarity(e.target.value as CosmeticRarity)}
                  className="w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-xs text-ink"
                >
                  {RARITY_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono font-semibold text-ink/75 mb-1">
                Asset URL (APNG `.png` / `.webp` / `.webm` / Lottie `.json`)
              </label>
              <input
                type="text"
                required
                value={assetUrl}
                onChange={(e) => setAssetUrl(e.target.value)}
                placeholder="https://... hoặc /discord-fx/..."
                className="w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-xs font-mono text-ink"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono font-semibold text-ink/75 mb-1">
                Intro Burst URL (tùy chọn cho Profile Effect)
              </label>
              <input
                type="text"
                value={introAssetUrl}
                onChange={(e) => setIntroAssetUrl(e.target.value)}
                placeholder="https://.../intro.png"
                className="w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-xs font-mono text-ink"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-[11px] font-mono font-semibold text-ink/75 mb-1">
                  Scale ({scale})
                </label>
                <input
                  type="number"
                  step={0.02}
                  min={0.8}
                  max={2}
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  className="w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-xs font-mono text-ink"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono font-semibold text-ink/75 mb-1">
                  Blend Mode
                </label>
                <select
                  value={blendMode}
                  onChange={(e) => setBlendMode(e.target.value as CosmeticBlendMode)}
                  className="w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-xs font-mono text-ink"
                >
                  <option value="normal">normal</option>
                  <option value="screen">screen</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-semibold text-ink/75 mb-1">
                  Glow Accent
                </label>
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-xs font-mono text-ink"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono font-semibold text-ink/75 mb-1">
                Mô tả ngắn
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-xs text-ink"
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-pill bg-ink text-white text-xs font-semibold hover:bg-ink/90 transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>Xuất bản lên /shop</span>
            </button>
          </form>
        </div>

        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft space-y-4">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold uppercase tracking-wide text-ink">
                <Eye className="w-4 h-4 text-accent" aria-hidden="true" />
                <span>Live Transparent Preview</span>
              </div>
              <div className="inline-flex rounded-pill border border-ink/15 bg-paper p-0.5">
                <button
                  type="button"
                  onClick={() => setPreviewMode("avatar")}
                  className={`px-2.5 py-1 rounded-pill text-[11px] font-mono font-medium transition-colors ${
                    previewMode === "avatar" ? "bg-ink text-white" : "text-ink/70"
                  }`}
                >
                  Avatar
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("profile")}
                  className={`px-2.5 py-1 rounded-pill text-[11px] font-mono font-medium transition-colors ${
                    previewMode === "profile" ? "bg-ink text-white" : "text-ink/70"
                  }`}
                >
                  Profile Card
                </button>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-ink/15 bg-zinc-950 p-6 min-h-[260px] flex flex-col items-center justify-center text-white">
              <div
                className="absolute inset-0 opacity-30 pointer-events-none"
                style={{
                  background: `radial-gradient(circle at 50% 35%, ${accentColor}, transparent 68%)`,
                }}
              />

              {previewMode === "profile" ? (
                <>
                  <LiveAssetLayer
                    url={introAssetUrl}
                    alt={`${name} intro`}
                    blendMode={blendMode}
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none z-10"
                  />
                  <LiveAssetLayer
                    url={assetUrl}
                    alt={`${name} loop`}
                    blendMode={blendMode}
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none z-10"
                  />
                  <div className="relative z-20 w-full max-w-xs rounded-2xl bg-zinc-900/75 backdrop-blur-md border border-white/15 p-4 text-center space-y-2">
                    <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-accent to-amber-500 flex items-center justify-center font-bold text-lg">
                      IT
                    </div>
                    <div className="text-sm font-bold">{name || "Sample Developer"}</div>
                    <div className="text-[11px] font-mono text-white/70">
                      {CATEGORY_LABELS[category]} • {price} IT-Coin
                    </div>
                  </div>
                </>
              ) : (
                <div className="relative z-20 flex flex-col items-center gap-4">
                  <div className="relative w-28 h-28 flex items-center justify-center">
                    <div
                      className="w-full h-full rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/20 flex items-center justify-center text-2xl font-bold text-white shadow-lg"
                      style={{ boxShadow: `0 0 28px ${accentColor}55` }}
                    >
                      IT
                    </div>
                    <div
                      className="absolute pointer-events-none select-none"
                      style={{
                        inset: `${previewInsetPercent}%`,
                        width: `${previewScalePercent}%`,
                        height: `${previewScalePercent}%`,
                      }}
                    >
                      <LiveAssetLayer
                        url={assetUrl}
                        alt={name}
                        blendMode={blendMode}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-bold">{name || "Sample Effect"}</div>
                    <div className="text-[11px] font-mono text-white/70 mt-0.5">
                      {rarity} • {price} IT-Coin • scale {scale}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">
                Hiệu ứng đã xuất bản ({items.length})
              </h3>
            </div>

            {isLoading ? (
              <div className="py-8 flex items-center justify-center text-xs text-ink/60">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                <span>Đang tải...</span>
              </div>
            ) : items.length === 0 ? (
              <p className="text-xs text-ink/65 py-4">
                Chưa có hiệu ứng tùy chỉnh nào trong Neon DB. Hãy dán JSON hoặc nhập URL ở bên
                trái để xuất bản.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-ink/10 bg-paper"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-ink truncate">{item.name}</div>
                      <div className="text-[11px] font-mono text-ink/65 truncate">
                        {CATEGORY_LABELS[item.category]} • {item.price} IT-Coin • {item.rarity}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={deletingId === item.id}
                      onClick={() => void handleDelete(item.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-pill border border-red-200 bg-red-50 text-red-700 text-[11px] font-semibold hover:bg-red-100 disabled:opacity-50 shrink-0"
                    >
                      {deletingId === item.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                      <span>Xóa</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

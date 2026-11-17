"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  ExternalLink,
  Eye,
  FileJson,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  COSMETIC_CATALOG,
  COSMETIC_CATEGORIES,
  parseDiscordEffectJson,
  type CosmeticBlendMode,
  type CosmeticCategory,
  type CosmeticItem,
  type CosmeticRarity,
} from "../../lib/cosmetics";
import {
  AdminBulkActionBar,
  AdminDeleteConfirmModal,
  type DeleteConfirmRequest,
} from "./AdminDeleteConfirmModal";

interface AdminCosmeticsTabProps {
  onUnauthorized: () => void;
}

const PAGE_SIZE = 9;

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteRequest, setDeleteRequest] = useState<DeleteConfirmRequest | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [activeSubTab, setActiveSubTab] = useState<"catalog" | "import">("catalog");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | CosmeticCategory>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "custom" | "builtin">("all");
  const [currentPage, setCurrentPage] = useState(1);

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

  const customIds = useMemo(() => new Set(items.map((i) => i.id)), [items]);

  const catalogItems = useMemo(() => {
    const map = new Map<string, CosmeticItem>();
    for (const item of items) {
      map.set(item.id, item);
    }
    for (const item of COSMETIC_CATALOG) {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    }
    return Array.from(map.values());
  }, [items]);

  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return catalogItems.filter((item) => {
      const isCustom = customIds.has(item.id);
      if (sourceFilter === "custom" && !isCustom) return false;
      if (sourceFilter === "builtin" && isCustom) return false;
      if (categoryFilter !== "all" && item.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.rarity.toLowerCase().includes(q)
      );
    });
  }, [catalogItems, categoryFilter, customIds, searchQuery, sourceFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCatalog.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedCatalog = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredCatalog.slice(start, start + PAGE_SIZE);
  }, [filteredCatalog, safePage]);

  const selectableFilteredCustom = useMemo(
    () => filteredCatalog.filter((item) => customIds.has(item.id)),
    [filteredCatalog, customIds]
  );

  const selectablePageCustom = useMemo(
    () => paginatedCatalog.filter((item) => customIds.has(item.id)),
    [paginatedCatalog, customIds]
  );

  const selectedCustomItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds]
  );

  const toggleSelectId = (id: string) => {
    if (!customIds.has(id)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allPageSelected =
    selectablePageCustom.length > 0 &&
    selectablePageCustom.every((item) => selectedIds.has(item.id));

  const toggleSelectPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const item of selectablePageCustom) next.delete(item.id);
      } else {
        for (const item of selectablePageCustom) next.add(item.id);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const item of selectableFilteredCustom) next.add(item.id);
      return next;
    });
  };

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
    setStatusMessage(`Đã nạp cấu hình hiệu ứng: ${draft.name}`);
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
      setActiveSubTab("catalog");
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
      setActiveSubTab("catalog");
    } catch {
      setErrorMessage("Lỗi kết nối khi import gói JSON.");
    } finally {
      setIsSaving(false);
    }
  };

  const executeDeleteCosmetics = async (idsToDelete: string[], okText: string) => {
    if (idsToDelete.length === 0) return false;
    setDeletingId(idsToDelete.length === 1 ? idsToDelete[0] : "__bulk__");
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/admin/cosmetics", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: idsToDelete }),
      });
      if (res.status === 401) {
        onUnauthorized();
        return false;
      }
      if (!res.ok) {
        setErrorMessage("Không thể xóa hiệu ứng.");
        return false;
      }
      const deletedSet = new Set(idsToDelete);
      setItems((prev) => prev.filter((entry) => !deletedSet.has(entry.id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        idsToDelete.forEach((id) => next.delete(id));
        return next;
      });
      setStatusMessage(okText);
      return true;
    } catch {
      setErrorMessage("Lỗi kết nối khi xóa hiệu ứng.");
      return false;
    } finally {
      setDeletingId(null);
    }
  };

  const handleDelete = (item: CosmeticItem) => {
    setDeleteRequest({
      title: `Bạn có chắc chắn muốn xóa hiệu ứng "${item.name}"?`,
      description:
        "Hiệu ứng tùy chỉnh này sẽ bị xóa vĩnh viễn khỏi cửa hàng /shop và Neon DB.",
      itemCount: 1,
      itemPreviewLabels: [item.name],
      confirmButtonLabel: "Xóa hiệu ứng",
      onConfirm: () =>
        executeDeleteCosmetics(
          [item.id],
          `Đã xóa hiệu ứng "${item.name}" khỏi /shop.`
        ),
    });
  };

  const handleBulkDelete = () => {
    if (selectedCustomItems.length === 0) return;
    const count = selectedCustomItems.length;
    setDeleteRequest({
      title: `Bạn có chắc chắn muốn xóa ${count} hiệu ứng tùy chỉnh đã chọn?`,
      description:
        "Toàn bộ hiệu ứng tùy chỉnh được chọn sẽ bị xóa khỏi cửa hàng /shop và Neon DB.",
      itemCount: count,
      itemPreviewLabels: selectedCustomItems.map((i) => i.name),
      confirmButtonLabel: `Xóa ${count} hiệu ứng`,
      onConfirm: () =>
        executeDeleteCosmetics(
          selectedCustomItems.map((i) => i.id),
          `Đã xóa hàng loạt ${count} hiệu ứng tùy chỉnh khỏi /shop.`
        ),
    });
  };

  const previewScalePercent = Math.round((Number(scale) > 0 ? Number(scale) : 1.22) * 100);
  const previewInsetPercent = -Math.round((previewScalePercent - 100) / 2);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-ink/15 rounded-2xl p-4 shadow-soft flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-accent shrink-0" aria-hidden="true" />
          <div>
            <h2 className="text-base font-bold tracking-tight text-ink">
              Kho Hiệu Ứng & Discord FX Studio ({catalogItems.length})
            </h2>
            <p className="text-xs text-ink/70">
              Quản lý danh mục hiệu ứng /shop, xem thử trực tiếp và import JSON từ Discord / Wick Studio.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-pill bg-paper p-1 border border-ink/15">
            <button
              type="button"
              onClick={() => setActiveSubTab("catalog")}
              className={`px-3.5 py-1.5 rounded-pill text-xs font-semibold transition-colors ${
                activeSubTab === "catalog"
                  ? "bg-ink text-white shadow-soft"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              Kho hiệu ứng hiện có ({catalogItems.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("import")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-pill text-xs font-semibold transition-colors ${
                activeSubTab === "import"
                  ? "bg-accent text-white shadow-soft"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>+ Import Discord JSON / Thêm hiệu ứng</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => void loadCustomCosmetics()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white border border-ink/15 text-xs font-mono font-medium text-ink hover:bg-paper-muted transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
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
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-900">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-800">
          {errorMessage}
        </div>
      )}

      {activeSubTab === "import" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white border border-ink/15 rounded-2xl p-4 shadow-soft space-y-2.5">
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
                rows={4}
                value={rawJson}
                onChange={(e) => handleJsonChange(e.target.value)}
                placeholder='{ "title": "Cyber Sakura Frame", "assets": { "frame": "/discord-fx/avatar-cyberpunk-overclock-ring.png" } }'
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
              className="bg-white border border-ink/15 rounded-2xl p-4 shadow-soft space-y-3.5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink">Cấu hình chi tiết & Xuất bản</h3>
                <button
                  type="button"
                  onClick={() => setActiveSubTab("catalog")}
                  className="text-xs font-mono text-ink-muted hover:text-ink"
                >
                  Quay lại danh sách
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono font-semibold text-ink/75 mb-1">
                    Tên hiệu ứng
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-ink/15 bg-paper px-3 py-1.5 text-xs text-ink"
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
                    className="w-full rounded-xl border border-ink/15 bg-paper px-3 py-1.5 text-xs text-ink"
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
                    <Coins className="w-3.5 h-3.5 text-amber-500 absolute left-3 top-2" />
                    <input
                      type="number"
                      min={0}
                      step={5}
                      value={price}
                      onChange={(e) => setPrice(Number(e.target.value))}
                      className="w-full rounded-xl border border-ink/15 bg-paper pl-8 pr-3 py-1.5 text-xs font-mono text-ink"
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
                    className="w-full rounded-xl border border-ink/15 bg-paper px-3 py-1.5 text-xs text-ink"
                  >
                    {RARITY_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono font-semibold text-ink/75 mb-1">
                    Asset URL (`.png` / `.webp` / `.webm` / `.json`)
                  </label>
                  <input
                    type="text"
                    required
                    value={assetUrl}
                    onChange={(e) => setAssetUrl(e.target.value)}
                    placeholder="/discord-fx/..."
                    className="w-full rounded-xl border border-ink/15 bg-paper px-3 py-1.5 text-xs font-mono text-ink"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-semibold text-ink/75 mb-1">
                    Intro Burst URL (tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={introAssetUrl}
                    onChange={(e) => setIntroAssetUrl(e.target.value)}
                    placeholder="/discord-fx/intro.png"
                    className="w-full rounded-xl border border-ink/15 bg-paper px-3 py-1.5 text-xs font-mono text-ink"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                    className="w-full rounded-xl border border-ink/15 bg-paper px-3 py-1.5 text-xs font-mono text-ink"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-semibold text-ink/75 mb-1">
                    Blend Mode
                  </label>
                  <select
                    value={blendMode}
                    onChange={(e) => setBlendMode(e.target.value as CosmeticBlendMode)}
                    className="w-full rounded-xl border border-ink/15 bg-paper px-3 py-1.5 text-xs font-mono text-ink"
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
                    className="w-full rounded-xl border border-ink/15 bg-paper px-3 py-1.5 text-xs font-mono text-ink"
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
                  className="w-full rounded-xl border border-ink/15 bg-paper px-3 py-1.5 text-xs text-ink"
                />
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-pill bg-ink text-white text-xs font-semibold hover:bg-ink/90 transition-colors disabled:opacity-50"
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

          <div className="lg:col-span-5">
            <div className="bg-white border border-ink/15 rounded-2xl p-4 shadow-soft space-y-3 sticky top-6">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold uppercase tracking-wide text-ink">
                  <Eye className="w-4 h-4 text-accent" aria-hidden="true" />
                  <span>Live Try-On Preview</span>
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

              <div className="relative overflow-hidden rounded-2xl border border-ink/15 bg-zinc-950 p-6 min-h-[250px] flex flex-col items-center justify-center text-white">
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
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-white border border-ink/15 rounded-2xl p-3.5 shadow-soft flex flex-col gap-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
              <div className="relative flex-1 max-w-md">
                <Search
                  className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Tìm hiệu ứng theo tên, ID, mô tả hoặc độ hiếm..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-paper border border-ink/15 rounded-pill text-ink focus:outline-none focus:border-ink"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSourceFilter("all");
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-pill text-xs font-semibold transition-colors ${
                    sourceFilter === "all"
                      ? "bg-ink text-white"
                      : "bg-paper border border-ink/15 text-ink-muted hover:text-ink"
                  }`}
                >
                  Tất cả ({catalogItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSourceFilter("custom");
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-pill text-xs font-semibold transition-colors ${
                    sourceFilter === "custom"
                      ? "bg-accent text-white"
                      : "bg-paper border border-ink/15 text-ink-muted hover:text-ink"
                  }`}
                >
                  Tùy chỉnh ({items.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSourceFilter("builtin");
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-pill text-xs font-semibold transition-colors ${
                    sourceFilter === "builtin"
                      ? "bg-ink text-white"
                      : "bg-paper border border-ink/15 text-ink-muted hover:text-ink"
                  }`}
                >
                  Mặc định ({COSMETIC_CATALOG.length})
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter("all");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-pill text-[11px] font-mono font-semibold transition-colors ${
                  categoryFilter === "all"
                    ? "bg-ink text-white"
                    : "bg-paper border border-ink/15 text-ink-muted hover:text-ink"
                }`}
              >
                Tất cả danh mục
              </button>
              {COSMETIC_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(cat);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1 rounded-pill text-[11px] font-mono font-semibold transition-colors ${
                    categoryFilter === cat
                      ? "bg-ink text-white"
                      : "bg-paper border border-ink/15 text-ink-muted hover:text-ink"
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          <AdminBulkActionBar
            selectedCount={selectedCustomItems.length}
            totalFilteredCount={selectableFilteredCustom.length}
            allPageSelected={allPageSelected}
            pageCount={selectablePageCustom.length}
            itemUnitLabel="hiệu ứng tùy chỉnh"
            disabled={deletingId !== null}
            onToggleSelectPage={toggleSelectPage}
            onSelectAllFiltered={selectAllFiltered}
            onClearSelection={() => setSelectedIds(new Set())}
            onBulkDelete={handleBulkDelete}
          />

          {paginatedCatalog.length === 0 ? (
            <div className="bg-white border border-ink/15 rounded-2xl p-8 text-center text-xs text-ink-muted">
              Không tìm thấy hiệu ứng nào khớp bộ lọc.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {paginatedCatalog.map((item) => {
                const isCustom = customIds.has(item.id);
                const isSelected = isCustom && selectedIds.has(item.id);
                const accent = item.fallbackGlowColor ?? item.previewAccent ?? "#E5484D";

                return (
                  <div
                    key={item.id}
                    className={`bg-white border rounded-xl p-3.5 shadow-soft flex flex-col justify-between gap-2.5 transition-colors ${
                      isSelected ? "border-accent ring-1 ring-accent/30" : "border-ink/15"
                    }`}
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {isCustom && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectId(item.id)}
                              aria-label={`Chọn hiệu ứng ${item.name}`}
                              className="w-4 h-4 rounded accent-[#E5484D] cursor-pointer shrink-0"
                            />
                          )}
                          <span
                            className="w-3 h-3 rounded-full shrink-0 border border-ink/20"
                            style={{ backgroundColor: accent }}
                          />
                          <span className="text-xs font-bold text-ink truncate">
                            {item.name}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-pill text-[10px] font-mono font-semibold shrink-0 ${
                            isCustom
                              ? "bg-accent-light border border-accent/30 text-ink"
                              : "bg-paper border border-ink/15 text-ink-muted"
                          }`}
                        >
                          {isCustom ? "Tùy chỉnh" : "Mặc định"}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-ink-muted">
                        <span>{CATEGORY_LABELS[item.category]}</span>
                        <span>•</span>
                        <span className="font-semibold text-ink">{item.price} Coin</span>
                        <span>•</span>
                        <span>{item.rarity}</span>
                      </div>

                      <p className="text-[11px] text-ink/70 line-clamp-1">
                        {item.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-ink/10">
                      <button
                        type="button"
                        onClick={() => {
                          handleApplyParsedDraft(item);
                          setActiveSubTab("import");
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill bg-paper border border-ink/15 text-[11px] font-semibold text-ink hover:bg-paper-muted"
                      >
                        <Eye className="w-3 h-3 text-accent" />
                        <span>Thử / Tùy biến</span>
                      </button>

                      {isCustom ? (
                        <button
                          type="button"
                          disabled={deletingId === item.id || deletingId === "__bulk__"}
                          onClick={() => handleDelete(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill border border-red-200 bg-red-50 text-red-700 text-[11px] font-semibold hover:bg-red-100 disabled:opacity-50 shrink-0"
                        >
                          {deletingId === item.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                          <span>Xóa</span>
                        </button>
                      ) : (
                        <span className="text-[10px] font-mono text-ink-faint truncate max-w-[110px]">
                          {item.id}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="bg-white border border-ink/15 rounded-2xl px-4 py-2.5 shadow-soft flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-ink-muted font-mono">
              Hiển thị {paginatedCatalog.length} / {filteredCatalog.length} hiệu ứng · Trang{" "}
              {safePage} / {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-pill bg-paper border border-ink/15 font-semibold text-ink hover:bg-paper-muted disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Trước</span>
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-pill bg-paper border border-ink/15 font-semibold text-ink hover:bg-paper-muted disabled:opacity-40"
              >
                <span>Sau</span>
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminDeleteConfirmModal
        request={deleteRequest}
        onClose={() => setDeleteRequest(null)}
      />
    </div>
  );
}

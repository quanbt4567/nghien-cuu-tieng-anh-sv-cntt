export type CosmeticCategory =
  | "avatar_decoration"
  | "profile_theme"
  | "cursor_effect"
  | "leaderboard_fx"
  | "nameplate"
  | "victory_finisher";

export type CosmeticRarity = "Common" | "Rare" | "Epic" | "Legendary";

export type CosmeticKind = "title" | "ring" | CosmeticCategory;

export type EquippedCosmetics = Record<CosmeticCategory, string | null>;

export interface CosmeticItem {
  id: string;
  kind: CosmeticKind;
  category: CosmeticCategory;
  rarity: CosmeticRarity;
  name: string;
  value: string;
  price: number;
  description: string;
  effectClass: string;
  previewAccent: string;
}

export const COSMETIC_CATEGORIES: CosmeticCategory[] = [
  "avatar_decoration",
  "profile_theme",
  "cursor_effect",
  "leaderboard_fx",
  "nameplate",
  "victory_finisher",
];

export const DEFAULT_EQUIPPED_COSMETICS: EquippedCosmetics = {
  avatar_decoration: null,
  profile_theme: null,
  cursor_effect: null,
  leaderboard_fx: null,
  nameplate: null,
  victory_finisher: null,
};

export const COSMETIC_CATALOG: CosmeticItem[] = [
  {
    id: "avatar-cyberpunk-overclock-ring",
    kind: "avatar_decoration",
    category: "avatar_decoration",
    rarity: "Rare",
    name: "Cyberpunk Overclock Ring",
    value: "avatar-cyberpunk-overclock-ring",
    price: 25,
    description: "Rotating crimson-amber tactical ring around your developer avatar.",
    effectClass: "cosmetic-avatar-overclock",
    previewAccent: "#E5484D",
  },
  {
    id: "avatar-matrix-code-halo",
    kind: "avatar_decoration",
    category: "avatar_decoration",
    rarity: "Epic",
    name: "Matrix Code Halo",
    value: "avatar-matrix-code-halo",
    price: 45,
    description: "Animated binary orbital halo pulsing above your profile avatar.",
    effectClass: "cosmetic-avatar-matrix-halo",
    previewAccent: "#16A34A",
  },
  {
    id: "avatar-inferno-hotfix-horns",
    kind: "avatar_decoration",
    category: "avatar_decoration",
    rarity: "Epic",
    name: "Inferno Hotfix Horns",
    value: "avatar-inferno-hotfix-horns",
    price: 60,
    description: "Blazing geometric twin horns forged for emergency hotfix responders.",
    effectClass: "cosmetic-avatar-inferno-horns",
    previewAccent: "#EA580C",
  },
  {
    id: "avatar-quantum-holo-visor",
    kind: "avatar_decoration",
    category: "avatar_decoration",
    rarity: "Legendary",
    name: "Quantum Holo-Visor",
    value: "avatar-quantum-holo-visor",
    price: 95,
    description: "Prismatic scanning visor frame with kinetic telemetry sweep.",
    effectClass: "cosmetic-avatar-quantum-visor",
    previewAccent: "#0284C7",
  },
  {
    id: "theme-neon-meteor-shower",
    kind: "profile_theme",
    category: "profile_theme",
    rarity: "Rare",
    name: "Neon Meteor Shower",
    value: "theme-neon-meteor-shower",
    price: 30,
    description: "Diagonal meteor streaks sweeping across your /profile backdrop.",
    effectClass: "cosmetic-theme-meteor-shower",
    previewAccent: "#E5484D",
  },
  {
    id: "theme-digital-matrix-rain",
    kind: "profile_theme",
    category: "profile_theme",
    rarity: "Epic",
    name: "Digital Matrix Rain",
    value: "theme-digital-matrix-rain",
    price: 55,
    description: "Cascading terminal glyph columns layered behind your profile cards.",
    effectClass: "cosmetic-theme-matrix-rain",
    previewAccent: "#15803D",
  },
  {
    id: "theme-aurora-cyber-grid",
    kind: "profile_theme",
    category: "profile_theme",
    rarity: "Epic",
    name: "Aurora Cyber Grid",
    value: "theme-aurora-cyber-grid",
    price: 70,
    description: "Animated perspective blueprint grid with warm amber-teal bands.",
    effectClass: "cosmetic-theme-aurora-grid",
    previewAccent: "#0D9488",
  },
  {
    id: "theme-electric-storm-surge",
    kind: "profile_theme",
    category: "profile_theme",
    rarity: "Legendary",
    name: "Electric Storm Surge",
    value: "theme-electric-storm-surge",
    price: 100,
    description: "High-voltage arc pulses framing your entire profile showcase.",
    effectClass: "cosmetic-theme-electric-storm",
    previewAccent: "#CA8A04",
  },
  {
    id: "cursor-pixel-sparkle-trail",
    kind: "cursor_effect",
    category: "cursor_effect",
    rarity: "Common",
    name: "Pixel Sparkle Trail",
    value: "cursor-pixel-sparkle-trail",
    price: 15,
    description: "Crisp 8-bit square sparkles trailing every pointer movement.",
    effectClass: "cosmetic-cursor-pixel-sparkle",
    previewAccent: "#D97706",
  },
  {
    id: "cursor-binary-01-stream",
    kind: "cursor_effect",
    category: "cursor_effect",
    rarity: "Rare",
    name: "Binary 0-1 Stream",
    value: "cursor-binary-01-stream",
    price: 25,
    description: "Floating monospace 0 and 1 bits emitted from your cursor.",
    effectClass: "cosmetic-cursor-binary-stream",
    previewAccent: "#16A34A",
  },
  {
    id: "cursor-neon-laser-ribbon",
    kind: "cursor_effect",
    category: "cursor_effect",
    rarity: "Epic",
    name: "Neon Laser Ribbon",
    value: "cursor-neon-laser-ribbon",
    price: 50,
    description: "High-contrast crimson ribbon vector following rapid cursor sweeps.",
    effectClass: "cosmetic-cursor-laser-ribbon",
    previewAccent: "#E5484D",
  },
  {
    id: "cursor-tactical-cyber-crosshair",
    kind: "cursor_effect",
    category: "cursor_effect",
    rarity: "Legendary",
    name: "Tactical Cyber Crosshair",
    value: "cursor-tactical-cyber-crosshair",
    price: 85,
    description: "Precision HUD reticle with dynamic lock-on ticks on hover.",
    effectClass: "cosmetic-cursor-cyber-crosshair",
    previewAccent: "#0284C7",
  },
  {
    id: "lb-border-beam-sweep",
    kind: "leaderboard_fx",
    category: "leaderboard_fx",
    rarity: "Common",
    name: "Border Beam Sweep",
    value: "lb-border-beam-sweep",
    price: 20,
    description: "Animated light beam racing along your Global Leaderboard row border.",
    effectClass: "cosmetic-lb-border-beam",
    previewAccent: "#E5484D",
  },
  {
    id: "lb-royal-gold-shimmer",
    kind: "leaderboard_fx",
    category: "leaderboard_fx",
    rarity: "Rare",
    name: "Royal Gold Shimmer",
    value: "lb-royal-gold-shimmer",
    price: 35,
    description: "Metallic gold sheen sweeping across your leaderboard rank card.",
    effectClass: "cosmetic-lb-gold-shimmer",
    previewAccent: "#D97706",
  },
  {
    id: "lb-hologram-glitch",
    kind: "leaderboard_fx",
    category: "leaderboard_fx",
    rarity: "Epic",
    name: "Hologram Glitch",
    value: "lb-hologram-glitch",
    price: 65,
    description: "Periodic chromatic scanline slice across your leaderboard row.",
    effectClass: "cosmetic-lb-hologram-glitch",
    previewAccent: "#0284C7",
  },
  {
    id: "lb-inferno-rank-aura",
    kind: "leaderboard_fx",
    category: "leaderboard_fx",
    rarity: "Legendary",
    name: "Inferno Rank Aura",
    value: "lb-inferno-rank-aura",
    price: 90,
    description: "Ember border pulse signaling top-tier arena dominance.",
    effectClass: "cosmetic-lb-inferno-aura",
    previewAccent: "#EA580C",
  },
  {
    id: "nameplate-mesh-nebula",
    kind: "nameplate",
    category: "nameplate",
    rarity: "Common",
    name: "Mesh Nebula",
    value: "nameplate-mesh-nebula",
    price: 15,
    description: "Layered warm-coral and slate animated banner behind your display name.",
    effectClass: "cosmetic-nameplate-mesh-nebula",
    previewAccent: "#E5484D",
  },
  {
    id: "nameplate-terminal-pulse",
    kind: "nameplate",
    category: "nameplate",
    rarity: "Rare",
    name: "Terminal Pulse",
    value: "nameplate-terminal-pulse",
    price: 30,
    description: "Dark-ink terminal header banner with blinking green status cursor.",
    effectClass: "cosmetic-nameplate-terminal-pulse",
    previewAccent: "#16A34A",
  },
  {
    id: "nameplate-supernova-gold",
    kind: "nameplate",
    category: "nameplate",
    rarity: "Epic",
    name: "Supernova Gold",
    value: "nameplate-supernova-gold",
    price: 55,
    description: "Radiant solar-amber shimmer banner for seasoned speakers.",
    effectClass: "cosmetic-nameplate-supernova-gold",
    previewAccent: "#D97706",
  },
  {
    id: "nameplate-cyber-glitch",
    kind: "nameplate",
    category: "nameplate",
    rarity: "Legendary",
    name: "Cyber Glitch",
    value: "nameplate-cyber-glitch",
    price: 80,
    description: "High-speed kinetic scan banner with crisp ink-edge jitter.",
    effectClass: "cosmetic-nameplate-cyber-glitch",
    previewAccent: "#0284C7",
  },
  {
    id: "finisher-lgtm-neon-confetti",
    kind: "victory_finisher",
    category: "victory_finisher",
    rarity: "Common",
    name: "LGTM! Neon Confetti",
    value: "finisher-lgtm-neon-confetti",
    price: 20,
    description: "Burst of LGTM! approval stamps and crisp geometric confetti on wins.",
    effectClass: "cosmetic-finisher-lgtm-confetti",
    previewAccent: "#16A34A",
  },
  {
    id: "finisher-system-restored-shockwave",
    kind: "victory_finisher",
    category: "victory_finisher",
    rarity: "Rare",
    name: "System Restored Shockwave",
    value: "finisher-system-restored-shockwave",
    price: 40,
    description: "Expanding emerald status shockwave celebrating outage resolution.",
    effectClass: "cosmetic-finisher-shockwave",
    previewAccent: "#0D9488",
  },
  {
    id: "finisher-cyber-lightning-strike",
    kind: "victory_finisher",
    category: "victory_finisher",
    rarity: "Epic",
    name: "Cyber Lightning Strike",
    value: "finisher-cyber-lightning-strike",
    price: 75,
    description: "Crisp angular lightning flash across the victory summary banner.",
    effectClass: "cosmetic-finisher-lightning",
    previewAccent: "#CA8A04",
  },
  {
    id: "finisher-matrix-override",
    kind: "victory_finisher",
    category: "victory_finisher",
    rarity: "Legendary",
    name: "Matrix Override",
    value: "finisher-matrix-override",
    price: 100,
    description: "Full-screen green terminal override cascade on high-score finishes.",
    effectClass: "cosmetic-finisher-matrix-override",
    previewAccent: "#15803D",
  },
];

const LEGACY_COSMETIC_ITEMS: CosmeticItem[] = [
  {
    id: "title-bug-whisperer",
    kind: "title",
    category: "nameplate",
    rarity: "Common",
    name: "Bug Whisperer",
    value: "Bug Whisperer",
    price: 1,
    description: "Title badge for rapid bug resolution",
    effectClass: "cosmetic-nameplate-mesh-nebula",
    previewAccent: "#E5484D",
  },
  {
    id: "title-standup-ninja",
    kind: "title",
    category: "nameplate",
    rarity: "Common",
    name: "Standup Ninja",
    value: "Standup Ninja",
    price: 2,
    description: "Title badge for fast daily standup delivery",
    effectClass: "cosmetic-nameplate-terminal-pulse",
    previewAccent: "#16A34A",
  },
  {
    id: "title-cloud-architect",
    kind: "title",
    category: "nameplate",
    rarity: "Common",
    name: "Cloud Architect",
    value: "Cloud Architect",
    price: 4,
    description: "Title badge for senior technical speakers",
    effectClass: "cosmetic-nameplate-supernova-gold",
    previewAccent: "#D97706",
  },
  {
    id: "ring-crimson",
    kind: "ring",
    category: "avatar_decoration",
    rarity: "Common",
    name: "Crimson Pulse",
    value: "ring-crimson",
    price: 1,
    description: "Recording-red avatar highlight ring",
    effectClass: "cosmetic-avatar-overclock",
    previewAccent: "#E5484D",
  },
  {
    id: "ring-amber",
    kind: "ring",
    category: "avatar_decoration",
    rarity: "Common",
    name: "Amber Sprint",
    value: "ring-amber",
    price: 2,
    description: "Warm amber rank ring",
    effectClass: "cosmetic-avatar-inferno-horns",
    previewAccent: "#D97706",
  },
  {
    id: "ring-emerald",
    kind: "ring",
    category: "avatar_decoration",
    rarity: "Common",
    name: "Emerald Flow",
    value: "ring-emerald",
    price: 3,
    description: "Verified emerald status ring",
    effectClass: "cosmetic-avatar-matrix-halo",
    previewAccent: "#16A34A",
  },
];

export const ALL_COSMETIC_ITEMS: CosmeticItem[] = [
  ...COSMETIC_CATALOG,
  ...LEGACY_COSMETIC_ITEMS,
];

export function findCosmeticById(itemId: string): CosmeticItem | undefined {
  return ALL_COSMETIC_ITEMS.find((item) => item.id === itemId);
}

export function getCosmeticsByCategory(category: CosmeticCategory): CosmeticItem[] {
  return COSMETIC_CATALOG.filter((item) => item.category === category);
}

export function normalizeEquippedCosmetics(raw: unknown): EquippedCosmetics {
  const result: EquippedCosmetics = { ...DEFAULT_EQUIPPED_COSMETICS };
  let parsed: Record<string, unknown> | null = null;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    parsed = raw as Record<string, unknown>;
  } else if (typeof raw === "string") {
    try {
      const json: unknown = JSON.parse(raw);
      if (json && typeof json === "object" && !Array.isArray(json)) {
        parsed = json as Record<string, unknown>;
      }
    } catch {
      parsed = null;
    }
  }
  if (!parsed) return result;
  for (const category of COSMETIC_CATEGORIES) {
    const val = parsed[category];
    if (typeof val === "string" && val.trim().length > 0) {
      result[category] = val.trim();
    }
  }
  return result;
}

export function getRingBadgeClass(ring: string): string {
  switch (ring) {
    case "ring-crimson":
    case "avatar-cyberpunk-overclock-ring":
      return "ring-2 ring-accent ring-offset-2 ring-offset-white border-accent";
    case "ring-amber":
    case "avatar-inferno-hotfix-horns":
      return "ring-2 ring-amber-500 ring-offset-2 ring-offset-white border-amber-500";
    case "ring-emerald":
    case "avatar-matrix-code-halo":
      return "ring-2 ring-emerald-600 ring-offset-2 ring-offset-white border-emerald-600";
    case "avatar-quantum-holo-visor":
      return "ring-2 ring-sky-600 ring-offset-2 ring-offset-white border-sky-600";
    default:
      return "border-ink/20";
  }
}

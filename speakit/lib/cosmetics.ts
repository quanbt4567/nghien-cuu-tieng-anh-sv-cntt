export type CosmeticKind = "title" | "ring";

export interface CosmeticItem {
  id: string;
  kind: CosmeticKind;
  name: string;
  value: string;
  price: number;
  description: string;
}

export const COSMETIC_CATALOG: CosmeticItem[] = [
  {
    id: "title-bug-whisperer",
    kind: "title",
    name: "Bug Whisperer",
    value: "Bug Whisperer",
    price: 1,
    description: "Title badge for rapid bug resolution",
  },
  {
    id: "title-standup-ninja",
    kind: "title",
    name: "Standup Ninja",
    value: "Standup Ninja",
    price: 2,
    description: "Title badge for fast daily standup delivery",
  },
  {
    id: "title-cloud-architect",
    kind: "title",
    name: "Cloud Architect",
    value: "Cloud Architect",
    price: 4,
    description: "Title badge for senior technical speakers",
  },
  {
    id: "ring-crimson",
    kind: "ring",
    name: "Crimson Pulse",
    value: "ring-crimson",
    price: 1,
    description: "Recording-red avatar highlight ring",
  },
  {
    id: "ring-amber",
    kind: "ring",
    name: "Amber Sprint",
    value: "ring-amber",
    price: 2,
    description: "Warm amber rank ring",
  },
  {
    id: "ring-emerald",
    kind: "ring",
    name: "Emerald Flow",
    value: "ring-emerald",
    price: 3,
    description: "Verified emerald status ring",
  },
];

export function findCosmeticById(itemId: string): CosmeticItem | undefined {
  return COSMETIC_CATALOG.find((item) => item.id === itemId);
}

export function getRingBadgeClass(ring: string): string {
  switch (ring) {
    case "ring-crimson":
      return "ring-2 ring-accent ring-offset-2 ring-offset-white border-accent";
    case "ring-amber":
      return "ring-2 ring-amber-500 ring-offset-2 ring-offset-white border-amber-500";
    case "ring-emerald":
      return "ring-2 ring-emerald-600 ring-offset-2 ring-offset-white border-emerald-600";
    default:
      return "border-ink/20";
  }
}

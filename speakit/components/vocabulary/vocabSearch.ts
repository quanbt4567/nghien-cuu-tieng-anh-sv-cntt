import { VocabularyItem } from "../../lib/types";

function getMatchTier(item: VocabularyItem, normalizedQuery: string): number {
  const term = item.term.toLowerCase();
  if (term === normalizedQuery) return 0;
  if (term.startsWith(normalizedQuery)) return 1;
  if (term.includes(normalizedQuery)) return 2;
  if (
    item.meaningVI.toLowerCase().includes(normalizedQuery) ||
    item.exampleSentenceEN.toLowerCase().includes(normalizedQuery)
  ) {
    return 3;
  }
  return -1;
}

export function filterAndRankVocabulary(
  items: VocabularyItem[],
  query: string
): VocabularyItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return items;

  const matched: Array<{ item: VocabularyItem; tier: number; index: number }> = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const tier = getMatchTier(item, normalizedQuery);
    if (tier !== -1) {
      matched.push({ item, tier, index });
    }
  }

  matched.sort((a, b) => (a.tier !== b.tier ? a.tier - b.tier : a.index - b.index));
  return matched.map((entry) => entry.item);
}

import type {
  AdminContentOverrides,
  BugBusterChallenge,
  Scenario,
  VocabularyItem,
} from "./types";

export const DELETE_CONFIRM_KEYWORD = "delete";

/**
 * Step 2 gate: only unlocks destructive deletion after user types "delete" (case-insensitive, trimmed).
 */
export function isDeleteConfirmationMatch(value: string): boolean {
  return value.trim().toLowerCase() === DELETE_CONFIRM_KEYWORD;
}

export function extractDeleteIdsFromPayload(
  searchParams: URLSearchParams,
  body: unknown
): string[] {
  const seen = new Set<string>();
  const addId = (raw: unknown) => {
    if (typeof raw !== "string") return;
    for (const part of raw.split(",")) {
      const clean = part.trim();
      if (clean && !seen.has(clean)) {
        seen.add(clean);
      }
    }
  };

  addId(searchParams.get("id"));
  addId(searchParams.get("ids"));

  if (body && typeof body === "object") {
    const obj = body as { id?: unknown; ids?: unknown };
    addId(obj.id);
    if (Array.isArray(obj.ids)) {
      for (const entry of obj.ids) {
        addId(entry);
      }
    }
  }

  return Array.from(seen);
}

export function computeVocabularyBulkDeleteOverrides(
  overrides: AdminContentOverrides,
  selectedItems: VocabularyItem[],
  baseIds: Set<string>
): AdminContentOverrides {
  const targetIds = new Set(selectedItems.map((item) => item.id));
  const nextDeleted = new Set(overrides.deletedVocabIds);
  for (const item of selectedItems) {
    if (baseIds.has(item.id)) {
      nextDeleted.add(item.id);
    }
  }
  return {
    ...overrides,
    customVocabulary: overrides.customVocabulary.filter((v) => !targetIds.has(v.id)),
    deletedVocabIds: Array.from(nextDeleted),
  };
}

export function computeScenarioBulkDeleteOverrides(
  overrides: AdminContentOverrides,
  selectedScenarios: Scenario[],
  baseIds: Set<string>
): AdminContentOverrides {
  const customDeleteIds = new Set(
    selectedScenarios.filter((s) => !baseIds.has(s.id)).map((s) => s.id)
  );
  return {
    ...overrides,
    customScenarios: overrides.customScenarios.filter((s) => !customDeleteIds.has(s.id)),
    hiddenScenarioIds: overrides.hiddenScenarioIds.filter(
      (id) => !customDeleteIds.has(id)
    ),
  };
}

export function computeArenaBulkDeleteOverrides(
  overrides: AdminContentOverrides,
  selectedChallenges: BugBusterChallenge[],
  baseIds: Set<string>
): AdminContentOverrides {
  const targetIds = new Set(selectedChallenges.map((c) => c.id));
  const nextDeleted = new Set(overrides.deletedChallengeIds);
  for (const challenge of selectedChallenges) {
    if (baseIds.has(challenge.id)) {
      nextDeleted.add(challenge.id);
    }
  }
  return {
    ...overrides,
    customBugChallenges: overrides.customBugChallenges.filter(
      (c) => !targetIds.has(c.id)
    ),
    deletedChallengeIds: Array.from(nextDeleted),
  };
}

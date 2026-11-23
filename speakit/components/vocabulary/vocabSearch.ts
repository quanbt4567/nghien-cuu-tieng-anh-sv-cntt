import { VocabularyItem } from "../../lib/types";

export type VocabWorkContext =
  | "all"
  | "standup"
  | "code_review"
  | "system_cloud"
  | "bug_outage"
  | "hr_interview";

export const VOCAB_CONTEXT_PILLS: Array<{
  id: VocabWorkContext;
  label: string;
}> = [
  { id: "all", label: "Tất cả" },
  { id: "standup", label: "Daily Standup" },
  { id: "code_review", label: "Code Review & Git" },
  { id: "system_cloud", label: "System & Cloud" },
  { id: "bug_outage", label: "Bug & Outage" },
  { id: "hr_interview", label: "HR Interview" },
];

const CONTEXT_TERM_RULES: Array<{
  context: Exclude<VocabWorkContext, "all">;
  terms: string[];
}> = [
  {
    context: "standup",
    terms: [
      "standup",
      "blocker",
      "backlog",
      "sprint",
      "scrum",
      "agile",
      "retrospective",
      "velocity",
      "ticket",
    ],
  },
  {
    context: "code_review",
    terms: [
      "pull request",
      "merge conflict",
      "refactor",
      "commit",
      "branch",
      "git",
      "rebase",
      "lint",
      "code review",
      "merge",
      "diff",
    ],
  },
  {
    context: "bug_outage",
    terms: [
      "bug",
      "reproduce",
      "severity",
      "outage",
      "incident",
      "crash",
      "hotfix",
      "rollback",
      "exception",
      "vulnerability",
      "debug",
    ],
  },
  {
    context: "system_cloud",
    terms: [
      "deploy",
      "deployment",
      "cloud",
      "server",
      "database",
      "api",
      "endpoint",
      "docker",
      "kubernetes",
      "pipeline",
      "ci/cd",
      "latency",
      "cache",
      "microservice",
      "staging",
      "production",
    ],
  },
  {
    context: "hr_interview",
    terms: [
      "deadline",
      "stakeholder",
      "interview",
      "onboarding",
      "leadership",
      "mentor",
      "career",
      "teamwork",
      "prioritize",
    ],
  },
];

export function getVocabWorkContext(
  item: VocabularyItem
): Exclude<VocabWorkContext, "all"> {
  const term = item.term.toLowerCase();
  for (const rule of CONTEXT_TERM_RULES) {
    if (rule.terms.some((kw) => term.includes(kw))) {
      return rule.context;
    }
  }

  const haystack = `${item.meaningVI} ${item.exampleSentenceEN}`.toLowerCase();
  for (const rule of CONTEXT_TERM_RULES) {
    if (rule.terms.some((kw) => haystack.includes(kw))) {
      return rule.context;
    }
  }

  return "standup";
}

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
  query: string,
  context: VocabWorkContext = "all"
): VocabularyItem[] {
  const contextFiltered =
    context === "all"
      ? items
      : items.filter((item) => getVocabWorkContext(item) === context);

  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return contextFiltered;

  const matched: Array<{ item: VocabularyItem; tier: number; index: number }> = [];
  for (let index = 0; index < contextFiltered.length; index += 1) {
    const item = contextFiltered[index];
    const tier = getMatchTier(item, normalizedQuery);
    if (tier !== -1) {
      matched.push({ item, tier, index });
    }
  }

  matched.sort((a, b) => (a.tier !== b.tier ? a.tier - b.tier : a.index - b.index));
  return matched.map((entry) => entry.item);
}

export interface VocabularyClusterGroup {
  clusterTitle: string;
  items: VocabularyItem[];
}

const CONTEXT_LABEL_MAP: Record<Exclude<VocabWorkContext, "all">, string> = {
  standup: "Daily Standup",
  code_review: "Code Review & Git",
  system_cloud: "System & Cloud",
  bug_outage: "Bug & Outage",
  hr_interview: "HR Interview",
};

export function getVocabClusterTitle(item: VocabularyItem): string {
  const customTitle = (item as VocabularyItem & { clusterTitle?: string }).clusterTitle?.trim();
  if (customTitle) return customTitle;
  return CONTEXT_LABEL_MAP[getVocabWorkContext(item)];
}

export function groupVocabularyByCluster(
  items: VocabularyItem[]
): VocabularyClusterGroup[] {
  const groups = new Map<string, VocabularyItem[]>();
  for (const item of items) {
    const clusterTitle = getVocabClusterTitle(item);
    const existing = groups.get(clusterTitle);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(clusterTitle, [item]);
    }
  }
  return Array.from(groups.entries()).map(([clusterTitle, groupItems]) => ({
    clusterTitle,
    items: groupItems,
  }));
}

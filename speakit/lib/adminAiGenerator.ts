import { extractFirstJsonObject, requestAiWaterfallText } from "./ai-waterfall";
import type {
  BugBusterChallenge,
  ITRole,
  ScenarioTurn,
  ScoringProvider,
} from "./types";

export type AdminGenerateKind = "scenario" | "vocabulary" | "bug_challenge";
export type BugChallengeCategory = BugBusterChallenge["category"];
export type VocabularyPartOfSpeech =
  | "noun"
  | "verb"
  | "adjective"
  | "phrase"
  | "adverb";

export interface AdminGenerateInput {
  kind: AdminGenerateKind;
  topic: string;
  role?: ITRole | "";
  category?: BugChallengeCategory;
}

export interface AdminScenarioDraft {
  id: string;
  titleEN: string;
  titleVI: string;
  roleVI: string;
  descriptionVI: string;
  targetRoles: ITRole[];
  turns: ScenarioTurn[];
}

export interface AdminVocabularyDraft {
  term: string;
  phonetic: string;
  partOfSpeech: VocabularyPartOfSpeech;
  meaningVI: string;
  exampleSentenceEN: string;
  exampleTranslationVI: string;
}

export interface AdminBugChallengeDraft {
  category: BugChallengeCategory;
  promptEN: string;
  targetWord: string;
  acceptedVariants: string[];
  contextVI: string;
  phonetic: string;
}

export type AdminGenerateDraft =
  | AdminScenarioDraft
  | AdminVocabularyDraft
  | AdminBugChallengeDraft;

export interface AdminGenerateResult {
  kind: AdminGenerateKind;
  mode: "ai" | "template";
  provider: ScoringProvider;
  draft: AdminGenerateDraft;
}

export interface AdminAiGeneratorDeps {
  requestText?: typeof requestAiWaterfallText;
  env?: Record<string, string | undefined>;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

export class AdminGenerateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminGenerateValidationError";
  }
}

export class AdminGenerateRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminGenerateRejectedError";
  }
}

const INVALID_CONTENT_MESSAGE =
  "Nội dung không phù hợp hoặc không liên quan đến tiếng Anh chuyên ngành CNTT. Vui lòng nhập thuật ngữ, mô tả chức năng hoặc lỗi kỹ thuật liên quan.";

const GIBBERISH_WORDS = new Set([
  "hihi",
  "haha",
  "hehe",
  "huhu",
  "kaka",
  "kkk",
  "alo",
  "asdf",
  "asdfg",
  "qwer",
  "qwerty",
  "zxcv",
  "hjkl",
  "abc",
  "abcd",
  "xyz",
  "test",
  "testing",
  "dummy",
  "spam",
  "blah",
  "bruh",
  "lol",
  "lmao",
  "ok",
  "oke",
  "okay",
  "bayba",
  "taolao",
  "linhtinh",
  "vovien",
]);

function isLikelyGibberishTopic(topic: string): boolean {
  if (topic.length < 2) return true;

  const asciiFolded = topic
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (/(.)\1{4,}/i.test(asciiFolded)) return true;

  const letters = asciiFolded.match(/[a-z]/g) ?? [];
  if (letters.length < 2) return true;

  const tokens = asciiFolded
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);

  if (tokens.length === 0) return true;

  const wordTokens = tokens.filter((token) => /[a-z]/.test(token));
  if (wordTokens.length === 0) return true;

  if (wordTokens.every((token) => GIBBERISH_WORDS.has(token))) {
    return true;
  }

  if (
    wordTokens.length === 1 &&
    wordTokens[0].length <= 10 &&
    /^([a-z]{2})\1+$/i.test(wordTokens[0])
  ) {
    return true;
  }

  if (
    wordTokens.length === 1 &&
    wordTokens[0].length >= 7 &&
    !/[aeiouy]/.test(wordTokens[0])
  ) {
    return true;
  }

  return false;
}

const VALID_KINDS = new Set<AdminGenerateKind>([
  "scenario",
  "vocabulary",
  "bug_challenge",
]);
const VALID_ROLES = new Set<ITRole>(["frontend", "backend", "qa", "devops"]);
const VALID_BUG_CATEGORIES = new Set<BugChallengeCategory>([
  "error-log",
  "code-review",
  "incident",
]);
const VALID_POS = new Set<VocabularyPartOfSpeech>([
  "noun",
  "verb",
  "adjective",
  "phrase",
  "adverb",
]);

const ROLE_LABELS: Record<ITRole, string> = {
  frontend: "Frontend Engineer",
  backend: "Backend Engineer",
  qa: "QA Engineer",
  devops: "DevOps Engineer",
};

const TOPIC_STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "into",
  "about",
  "how",
  "when",
  "cho",
  "cua",
  "cac",
  "voi",
  "trong",
  "khi",
  "lam",
  "mot",
]);

function normalizeBugCategory(raw: unknown): BugChallengeCategory | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().toLowerCase().replace(/[_\s]+/g, "-");
  return VALID_BUG_CATEGORIES.has(cleaned as BugChallengeCategory)
    ? (cleaned as BugChallengeCategory)
    : null;
}

export function validateAdminGenerateInput(
  raw: unknown
): { ok: true; value: AdminGenerateInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      error: "Dữ liệu yêu cầu phải là đối tượng JSON hợp lệ.",
    };
  }

  const record = raw as Record<string, unknown>;
  const rawKind = typeof record.kind === "string" ? record.kind.trim() : "";
  if (!VALID_KINDS.has(rawKind as AdminGenerateKind)) {
    return {
      ok: false,
      error:
        "Loại nội dung (kind) không hợp lệ. Chỉ hỗ trợ scenario, vocabulary hoặc bug_challenge.",
    };
  }

  const topic = typeof record.topic === "string" ? record.topic.trim() : "";
  if (!topic) {
    return {
      ok: false,
      error: "Vui lòng nhập chủ đề hoặc mô tả chức năng trước khi tạo nội dung.",
    };
  }
  if (isLikelyGibberishTopic(topic)) {
    return {
      ok: false,
      error: INVALID_CONTENT_MESSAGE,
    };
  }

  let role: ITRole | undefined;
  if (record.role !== undefined && record.role !== null && record.role !== "") {
    if (typeof record.role !== "string") {
      return { ok: false, error: "Vai trò (role) không hợp lệ." };
    }
    const normalizedRole = record.role.trim().toLowerCase();
    if (normalizedRole) {
      if (!VALID_ROLES.has(normalizedRole as ITRole)) {
        return { ok: false, error: "Vai trò (role) không hợp lệ." };
      }
      role = normalizedRole as ITRole;
    }
  }

  let category: BugChallengeCategory | undefined;
  if (
    record.category !== undefined &&
    record.category !== null &&
    record.category !== ""
  ) {
    const normalizedCategory = normalizeBugCategory(record.category);
    if (!normalizedCategory) {
      return {
        ok: false,
        error: "Danh mục thử thách (category) không hợp lệ.",
      };
    }
    category = normalizedCategory;
  }

  return {
    ok: true,
    value: {
      kind: rawKind as AdminGenerateKind,
      topic: topic.slice(0, 400),
      ...(role ? { role } : {}),
      ...(category ? { category } : {}),
    },
  };
}

function slugifyId(value: string): string {
  return value
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}

function toUniqueStringList(value: unknown): string[] {
  const items = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    const key = trimmed.toLowerCase();
    if (trimmed && !seen.has(key)) {
      seen.add(key);
      out.push(trimmed);
    }
  }
  return out;
}

function extractAsciiKeywords(topic: string): string[] {
  const words = topic
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[a-z0-9-]{3,}/g);

  if (!words) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    if (TOPIC_STOPWORDS.has(w) || seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= 3) break;
  }
  return out;
}

function ensureKeywordCount(
  rawKeywords: unknown,
  fallbackKeywords: string[]
): string[] {
  const out = toUniqueStringList(rawKeywords).slice(0, 5);
  const seen = new Set(out.map((kw) => kw.toLowerCase()));

  for (const candidate of fallbackKeywords) {
    if (out.length >= 3) break;
    const key = candidate.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(candidate);
    }
  }
  return out.slice(0, 5);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Guarantees promptEN contains the exact 4-underscore blank "____" for Bug Buster.
 */
export function ensurePromptBlank(promptEN: string, targetWord: string): string {
  const normalizedBlank = promptEN.trim().replace(/_{3,}/g, "____");
  if (!normalizedBlank) return "____";
  if (normalizedBlank.includes("____")) {
    return normalizedBlank;
  }

  const word = targetWord.trim();
  if (word) {
    const escaped = escapeRegExp(word);
    const startsAlnum = /^[a-zA-Z0-9]/.test(word);
    const endsAlnum = /[a-zA-Z0-9]$/.test(word);
    const matchRegex =
      startsAlnum && endsAlnum
        ? new RegExp(`(?<![a-zA-Z0-9])${escaped}(?![a-zA-Z0-9])`, "i")
        : new RegExp(escaped, "i");

    if (matchRegex.test(normalizedBlank)) {
      return normalizedBlank.replace(matchRegex, "____");
    }
  }

  return `${normalizedBlank} (____)`;
}

function normalizePartOfSpeech(raw: unknown): VocabularyPartOfSpeech {
  if (typeof raw !== "string") return "noun";
  const cleaned = raw.trim().toLowerCase().replace(/\.$/, "");
  if (VALID_POS.has(cleaned as VocabularyPartOfSpeech)) {
    return cleaned as VocabularyPartOfSpeech;
  }
  if (cleaned === "n") return "noun";
  if (cleaned === "v") return "verb";
  if (cleaned === "adj") return "adjective";
  if (cleaned === "adv") return "adverb";
  if (cleaned.includes("phrase") || cleaned === "idiom") return "phrase";
  return "noun";
}

function buildFallbackScenario(
  topic: string,
  role?: ITRole
): AdminScenarioDraft {
  const topicKeywords = extractAsciiKeywords(topic);
  const roleTitle = role ? ROLE_LABELS[role] : "Senior Engineer";

  const makeTurnKeywords = (defaults: string[]) =>
    ensureKeywordCount([...topicKeywords, ...defaults].slice(0, 4), defaults);

  return {
    id: slugifyId(topic) || "custom-scenario",
    titleEN: topic,
    titleVI: `Tình huống: ${topic}`,
    roleVI: `Tech Lead / ${roleTitle}`,
    descriptionVI: `Thực hành giao tiếp tiếng Anh chuyên ngành về chủ đề "${topic}"${
      role ? ` dành cho vai trò ${ROLE_LABELS[role]}` : ""
    }.`,
    targetRoles: role ? [role] : ["frontend", "backend"],
    turns: [
      {
        turnIndex: 0,
        questionEN: `Could you walk me through the current situation and requirements for ${topic}?`,
        keywords: makeTurnKeywords([
          "requirement",
          "scope",
          "module",
          "workflow",
        ]),
        sampleAnswerEN: `Sure. For ${topic}, we reviewed the technical requirements and prioritized the core workflow for this sprint.`,
        hintVI: `Tóm tắt bối cảnh chính của ${topic}, nêu rõ yêu cầu và phạm vi xử lý.`,
      },
      {
        turnIndex: 1,
        questionEN: `What technical approach or troubleshooting steps did you apply to ${topic}?`,
        keywords: makeTurnKeywords([
          "investigate",
          "approach",
          "testing",
          "solution",
        ]),
        sampleAnswerEN: `First, I reproduced the behavior and checked the logs. Then I implemented a targeted fix and verified it with automated tests.`,
        hintVI:
          "Dùng từ nối tuần tự (First, Then, Finally) để mô tả hướng giải quyết kỹ thuật.",
      },
      {
        turnIndex: 2,
        questionEN: `Are there any remaining risks, trade-offs, or next steps for ${topic}?`,
        keywords: makeTurnKeywords([
          "trade-off",
          "monitor",
          "deploy",
          "follow-up",
        ]),
        sampleAnswerEN: `The main trade-off is slightly higher latency during validation, so we will monitor metrics after deployment and follow up tomorrow.`,
        hintVI:
          "Nêu rủi ro hoặc đánh đổi (trade-off), cách giám sát (monitor) và bước tiếp theo.",
      },
    ],
  };
}

function buildFallbackVocabulary(topic: string): AdminVocabularyDraft {
  const term = topic.slice(0, 60);
  const isPhrase = /\s+/.test(term);

  return {
    term,
    phonetic: "",
    partOfSpeech: isPhrase ? "phrase" : "noun",
    meaningVI: `Thuật ngữ kỹ thuật liên quan đến "${term}" trong giao tiếp phát triển phần mềm.`,
    exampleSentenceEN: `During our sprint review, the team discussed how to apply ${term} in production.`,
    exampleTranslationVI: `Trong buổi sprint review, nhóm đã thảo luận cách áp dụng ${term} trên môi trường production.`,
  };
}

function buildFallbackBugChallenge(
  topic: string,
  category?: BugChallengeCategory
): AdminBugChallengeDraft {
  const resolvedCategory: BugChallengeCategory = category ?? "incident";
  const asciiWords = extractAsciiKeywords(topic);
  const targetWord = asciiWords[0] ?? "hotfix";

  const templateByCategory: Record<BugChallengeCategory, string> = {
    "error-log": `[ERROR] Service logged an unexpected ____ failure while processing ${topic}; inspect the stack trace.`,
    "code-review": `Code Review: Please refine the ____ handling for ${topic} before merging this pull request.`,
    incident: `[INCIDENT] Production alert triggered for ${topic}; coordinate the ____ steps with the on-call team.`,
  };

  const variants = new Set<string>();
  if (targetWord.includes("-")) {
    variants.add(targetWord.replace(/-/g, " "));
    variants.add(targetWord.replace(/-/g, ""));
  } else if (!targetWord.endsWith("s")) {
    variants.add(`${targetWord}s`);
  }

  return {
    category: resolvedCategory,
    promptEN: ensurePromptBlank(templateByCategory[resolvedCategory], targetWord),
    targetWord,
    acceptedVariants: Array.from(variants),
    contextVI: `Từ khóa chuyên ngành (${resolvedCategory}) cho chủ đề "${topic}". Hãy kiểm tra lại câu hỏi và đáp án trước khi lưu.`,
    phonetic: "",
  };
}

/**
 * Deterministic local draft builder used when AI providers fail or are unconfigured.
 */
export function buildFallbackAdminDraft(
  input: AdminGenerateInput
): AdminGenerateDraft {
  const validated = validateAdminGenerateInput(input);
  if (!validated.ok) {
    throw new AdminGenerateValidationError(validated.error);
  }
  const { kind, topic, role, category } = validated.value;
  const resolvedRole = role || undefined;

  if (kind === "scenario") {
    return buildFallbackScenario(topic, resolvedRole);
  }
  if (kind === "vocabulary") {
    return buildFallbackVocabulary(topic);
  }
  return buildFallbackBugChallenge(topic, category);
}

function normalizeScenarioDraft(
  record: Record<string, unknown>,
  input: AdminGenerateInput
): AdminScenarioDraft | null {
  const titleEN = typeof record.titleEN === "string" ? record.titleEN.trim() : "";
  if (!titleEN) return null;

  const fallback = buildFallbackScenario(
    input.topic,
    input.role ? (input.role as ITRole) : undefined
  );

  const rawTurns = Array.isArray(record.turns) ? record.turns : [];
  const validTurns = rawTurns
    .map((item, idx) => {
      if (!item || typeof item !== "object") return null;
      const t = item as Record<string, unknown>;
      const questionEN =
        typeof t.questionEN === "string" ? t.questionEN.trim() : "";
      if (!questionEN) return null;
      const sortOrder =
        typeof t.turnIndex === "number" && Number.isFinite(t.turnIndex)
          ? t.turnIndex
          : idx;
      return { t, sortOrder };
    })
    .filter(
      (
        entry
      ): entry is { t: Record<string, unknown>; sortOrder: number } =>
        entry !== null
    )
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, 3);

  if (validTurns.length === 0) return null;

  const turns: ScenarioTurn[] = [0, 1, 2].map((index) => {
    const fallbackTurn = fallback.turns[index];
    const picked = validTurns[index]?.t;
    if (!picked) {
      return fallbackTurn;
    }

    const questionEN = (picked.questionEN as string).trim();
    const sampleAnswerEN =
      typeof picked.sampleAnswerEN === "string" && picked.sampleAnswerEN.trim()
        ? picked.sampleAnswerEN.trim()
        : fallbackTurn.sampleAnswerEN;
    const hintVI =
      typeof picked.hintVI === "string" && picked.hintVI.trim()
        ? picked.hintVI.trim()
        : fallbackTurn.hintVI;
    const keywords = ensureKeywordCount(picked.keywords, fallbackTurn.keywords);

    return {
      turnIndex: index,
      questionEN,
      keywords,
      sampleAnswerEN,
      hintVI,
    };
  });

  const rawRoles = Array.isArray(record.targetRoles) ? record.targetRoles : [];
  const validRoles: ITRole[] = [];
  const seenRoles = new Set<ITRole>();
  for (const r of rawRoles) {
    if (typeof r !== "string") continue;
    const normalized = r.trim().toLowerCase() as ITRole;
    if (VALID_ROLES.has(normalized) && !seenRoles.has(normalized)) {
      seenRoles.add(normalized);
      validRoles.push(normalized);
    }
  }

  const rawId = typeof record.id === "string" ? record.id : "";
  const id = slugifyId(rawId) || slugifyId(titleEN) || fallback.id;

  return {
    id,
    titleEN,
    titleVI:
      typeof record.titleVI === "string" && record.titleVI.trim()
        ? record.titleVI.trim()
        : fallback.titleVI,
    roleVI:
      typeof record.roleVI === "string" && record.roleVI.trim()
        ? record.roleVI.trim()
        : fallback.roleVI,
    descriptionVI:
      typeof record.descriptionVI === "string" && record.descriptionVI.trim()
        ? record.descriptionVI.trim()
        : fallback.descriptionVI,
    targetRoles: validRoles.length > 0 ? validRoles : fallback.targetRoles,
    turns,
  };
}

function normalizeVocabularyDraft(
  record: Record<string, unknown>,
  input: AdminGenerateInput
): AdminVocabularyDraft | null {
  const term = typeof record.term === "string" ? record.term.trim() : "";
  const meaningVI =
    typeof record.meaningVI === "string" ? record.meaningVI.trim() : "";
  if (!term || !meaningVI) return null;

  const fallback = buildFallbackVocabulary(term);

  return {
    term,
    phonetic: typeof record.phonetic === "string" ? record.phonetic.trim() : "",
    partOfSpeech: normalizePartOfSpeech(record.partOfSpeech),
    meaningVI,
    exampleSentenceEN:
      typeof record.exampleSentenceEN === "string" &&
      record.exampleSentenceEN.trim()
        ? record.exampleSentenceEN.trim()
        : fallback.exampleSentenceEN,
    exampleTranslationVI:
      typeof record.exampleTranslationVI === "string" &&
      record.exampleTranslationVI.trim()
        ? record.exampleTranslationVI.trim()
        : `Ví dụ minh họa cho thuật ngữ "${input.topic.trim()}".`,
  };
}

function normalizeBugChallengeDraft(
  record: Record<string, unknown>,
  input: AdminGenerateInput
): AdminBugChallengeDraft | null {
  const rawPrompt =
    typeof record.promptEN === "string" ? record.promptEN.trim() : "";
  const targetWord =
    typeof record.targetWord === "string" ? record.targetWord.trim() : "";
  if (!rawPrompt || !targetWord) return null;

  const category =
    normalizeBugCategory(record.category) ?? input.category ?? "incident";
  const promptEN = ensurePromptBlank(rawPrompt, targetWord);
  const targetLower = targetWord.toLowerCase();
  const acceptedVariants = toUniqueStringList(record.acceptedVariants).filter(
    (variant) => variant.toLowerCase() !== targetLower
  );

  return {
    category,
    promptEN,
    targetWord,
    acceptedVariants,
    contextVI:
      typeof record.contextVI === "string" && record.contextVI.trim()
        ? record.contextVI.trim()
        : `Từ khóa "${targetWord}" trong ngữ cảnh ${category} về chủ đề "${input.topic.trim()}".`,
    phonetic: typeof record.phonetic === "string" ? record.phonetic.trim() : "",
  };
}

type ParsedAiOutcome =
  | { kind: "draft"; draft: AdminGenerateDraft }
  | { kind: "rejected"; reason: string };

function parseAiOutcome(
  input: AdminGenerateInput,
  rawText: string
): ParsedAiOutcome | null {
  const parsed = extractFirstJsonObject(rawText);
  if (!parsed) return null;

  if (parsed.rejected === true) {
    const rawReason =
      typeof parsed.reason === "string" ? parsed.reason.trim() : "";
    return {
      kind: "rejected",
      reason: rawReason || INVALID_CONTENT_MESSAGE,
    };
  }

  let draft: AdminGenerateDraft | null = null;
  if (input.kind === "scenario") {
    draft = normalizeScenarioDraft(parsed, input);
  } else if (input.kind === "vocabulary") {
    draft = normalizeVocabularyDraft(parsed, input);
  } else {
    draft = normalizeBugChallengeDraft(parsed, input);
  }

  return draft ? { kind: "draft", draft } : null;
}

function buildAdminPrompts(input: AdminGenerateInput): {
  systemInstruction: string;
  userPrompt: string;
} {
  const systemInstruction = [
    "You are an expert IT workplace English curriculum designer for Vietnamese software engineering students.",
    "First, verify the admin input is coherent, appropriate, and related to software engineering, IT systems, developer workflows, or workplace technical communication (it may be a technical term, feature/bug description, or Vietnamese instruction).",
    `If the input is gibberish, random noise, profane/inappropriate, casual chitchat, or completely unrelated to IT / workplace English, output ONLY: {"rejected":true,"reason":"${INVALID_CONTENT_MESSAGE}"}`,
    "Otherwise read the functional context carefully and output ONLY one valid JSON object matching the exact schema, with no markdown fences or extra commentary.",
  ].join(" ");

  if (input.kind === "scenario") {
    const roleHint = input.role
      ? `Target IT role focus: ${input.role} (${ROLE_LABELS[input.role]}).`
      : "Target IT role focus: choose 1-2 relevant roles from frontend, backend, qa, devops.";

    return {
      systemInstruction,
      userPrompt: `Create a 3-turn workplace English speaking role-play scenario for Vietnamese IT students based on this functional topic / instruction:
"${input.topic}"
${roleHint}

Return STRICT JSON matching this schema (or {"rejected":true,"reason":"..."} if off-topic/inappropriate):
{
  "id": "kebab-case-slug",
  "titleEN": "Concise English title",
  "titleVI": "Tiêu đề tiếng Việt ngắn gọn",
  "roleVI": "Interviewer or colleague role in Vietnamese/English",
  "descriptionVI": "Mô tả ngắn bằng tiếng Việt về mục tiêu hội thoại",
  "targetRoles": ["frontend" | "backend" | "qa" | "devops"],
  "turns": [
    {
      "turnIndex": 0,
      "questionEN": "Realistic English question for turn 0",
      "keywords": ["3 to 5 technical English keywords"],
      "sampleAnswerEN": "Natural senior-level English sample answer using those keywords",
      "hintVI": "Gợi ý ngắn bằng tiếng Việt"
    },
    {
      "turnIndex": 1,
      "questionEN": "Follow-up technical question for turn 1",
      "keywords": ["3 to 5 technical English keywords"],
      "sampleAnswerEN": "Natural sample answer",
      "hintVI": "Gợi ý tiếng Việt"
    },
    {
      "turnIndex": 2,
      "questionEN": "Wrap-up/trade-off/next-step question for turn 2",
      "keywords": ["3 to 5 technical English keywords"],
      "sampleAnswerEN": "Natural sample answer",
      "hintVI": "Gợi ý tiếng Việt"
    }
  ]
}
Requirements: exactly 3 sequential turns (turnIndex 0, 1, 2), each with 3 to 5 keywords.`,
    };
  }

  if (input.kind === "vocabulary") {
    return {
      systemInstruction,
      userPrompt: `Create one practical IT workplace English vocabulary entry for Vietnamese software engineering students based on this term, functional description, or instruction:
"${input.topic}"

Return STRICT JSON matching this schema (or {"rejected":true,"reason":"..."} if off-topic/inappropriate):
{
  "term": "English IT term or short phrase matching the requested topic/function",
  "phonetic": "REQUIRED US/UK IPA pronunciation wrapped in slashes, e.g. /mɜːrdʒ/ or /ˌaɪ.dɛmˈpoʊ.tən.si/",
  "partOfSpeech": "noun | verb | adjective | phrase | adverb",
  "meaningVI": "Nghĩa tiếng Việt rõ ràng trong ngữ cảnh CNTT",
  "exampleSentenceEN": "Natural workplace English sentence using the term",
  "exampleTranslationVI": "Bản dịch tiếng Việt tự nhiên của câu ví dụ"
}`,
    };
  }

  const preferredCategory = input.category ?? "incident";
  return {
    systemInstruction,
    userPrompt: `Create one spoken Bug Buster fill-in-the-blank IT English challenge for Vietnamese software engineering students based on this topic / functional description:
"${input.topic}"
Preferred category: "${preferredCategory}" (must be one of "error-log", "code-review", "incident").

Return STRICT JSON matching this schema (or {"rejected":true,"reason":"..."} if off-topic/inappropriate):
{
  "category": "error-log | code-review | incident",
  "promptEN": "One realistic developer error log, code review comment, or incident update containing exact blank ____ where targetWord belongs",
  "targetWord": "single speakable English IT term missing from ____",
  "acceptedVariants": ["2 to 4 close spoken or inflected variants"],
  "contextVI": "Giải thích ngắn bằng tiếng Việt về ngữ cảnh và từ cần điền",
  "phonetic": "REQUIRED IPA pronunciation of targetWord wrapped in slashes, e.g. /ˈtaɪmˌaʊt/"
}
CRITICAL: promptEN MUST include the exact 4-underscore blank ____ representing targetWord.`,
  };
}

/**
 * Generates an Admin content draft using the 6-provider AI waterfall,
 * rejecting gibberish/off-topic prompts and falling back deterministically
 * to a local template only when AI providers are unavailable.
 */
export async function generateAdminContentDraft(
  input: AdminGenerateInput,
  deps: AdminAiGeneratorDeps = {}
): Promise<AdminGenerateResult> {
  const validated = validateAdminGenerateInput(input);
  if (!validated.ok) {
    throw new AdminGenerateValidationError(validated.error);
  }
  const cleanInput = validated.value;

  const { systemInstruction, userPrompt } = buildAdminPrompts(cleanInput);
  const requestText = deps.requestText ?? requestAiWaterfallText;

  let outcome: ParsedAiOutcome | null = null;
  let aiProvider: Exclude<ScoringProvider, "local"> | null = null;

  try {
    const aiResponse = await requestText({
      systemInstruction,
      userPrompt,
      temperature: 0.4,
      maxTokens: cleanInput.kind === "scenario" ? 1600 : 800,
      jsonMode: true,
      timeoutMs: deps.timeoutMs ?? 6000,
      ...(deps.env !== undefined ? { env: deps.env } : {}),
      ...(deps.fetchFn !== undefined ? { fetchFn: deps.fetchFn } : {}),
      validate: (raw) => parseAiOutcome(cleanInput, raw) !== null,
    });

    if (aiResponse) {
      outcome = parseAiOutcome(cleanInput, aiResponse.text);
      aiProvider = aiResponse.provider;
    }
  } catch {
    // Fall back deterministically to local template below if transport throws.
  }

  if (outcome?.kind === "rejected") {
    throw new AdminGenerateRejectedError(outcome.reason);
  }

  if (outcome?.kind === "draft" && aiProvider) {
    return {
      kind: cleanInput.kind,
      mode: "ai",
      provider: aiProvider,
      draft: outcome.draft,
    };
  }

  return {
    kind: cleanInput.kind,
    mode: "template",
    provider: "local",
    draft: buildFallbackAdminDraft(cleanInput),
  };
}

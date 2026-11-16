import { extractFirstJsonObject, requestAiWaterfallText } from "./ai-waterfall";
import type { VocabularyItem } from "./types";

const BATCH_SIZE = 15;
const FORBIDDEN_CLUSTER_TITLE = "Tùy chỉnh";
const FORBIDDEN_PHONETIC = "/.../";

const DEFAULT_IT_CLUSTERS = [
  "System & Cloud",
  "Bug & Outage",
  "Code Review & Git",
  "Daily Standup",
  "HR Interview",
  "Database & Concurrency",
  "Security & Auth",
  "Frontend & UI",
  "Testing & QA",
  "DevOps & CI/CD",
] as const;

const VALID_POS = new Set(["noun", "verb", "adjective", "phrase", "adverb"]);

interface DeterministicTermSeed {
  phonetic: string;
  partOfSpeech: string;
  meaningVI: string;
  exampleSentenceEN: string;
  exampleTranslationVI: string;
  clusterTitle: string;
  careerLevel: "Fresher" | "Junior" | "Senior";
  relatedTerms: string[];
}

const KNOWN_IT_VOCAB_SEEDS: Record<string, DeterministicTermSeed> = {
  deadlock: {
    phonetic: "/ˈded.lɑːk/",
    partOfSpeech: "noun",
    meaningVI:
      "Tình trạng khóa chéo khi hai hoặc nhiều tiến trình chờ giải phóng tài nguyên của nhau vô thời hạn",
    exampleSentenceEN:
      "Two concurrent transactions updating rows in opposite order caused a database deadlock.",
    exampleTranslationVI:
      "Hai giao dịch đồng thời cập nhật các dòng theo thứ tự ngược nhau đã gây ra khóa chéo cơ sở dữ liệu.",
    clusterTitle: "Database & Concurrency",
    careerLevel: "Junior",
    relatedTerms: ["race condition", "concurrency", "mutex"],
  },
  latency: {
    phonetic: "/ˈleɪ.tən.si/",
    partOfSpeech: "noun",
    meaningVI:
      "Độ trễ thời gian từ khi gửi yêu cầu đến khi nhận được phản hồi từ hệ thống",
    exampleSentenceEN:
      "Adding a Redis caching layer reduced our API tail latency by forty percent.",
    exampleTranslationVI:
      "Việc bổ sung tầng bộ nhớ đệm Redis đã giảm 40% độ trễ phản hồi API của chúng tôi.",
    clusterTitle: "System & Cloud",
    careerLevel: "Junior",
    relatedTerms: ["throughput", "cache", "bottleneck"],
  },
  idempotency: {
    phonetic: "/ˌaɪ.dəmˈpoʊ.tən.si/",
    partOfSpeech: "noun",
    meaningVI:
      "Tính chất đảm bảo thực thi cùng một yêu cầu nhiều lần vẫn cho ra kết quả trạng thái duy nhất",
    exampleSentenceEN:
      "We require an idempotency key on payment endpoints to prevent duplicate charges during retries.",
    exampleTranslationVI:
      "Chúng tôi yêu cầu khóa idempotency trên các endpoint thanh toán để ngăn trừ tiền trùng lặp khi thử lại.",
    clusterTitle: "System & Cloud",
    careerLevel: "Senior",
    relatedTerms: ["retry", "webhook", "api"],
  },
  "rate limiting": {
    phonetic: "/ˈreɪt ˌlɪm.ɪ.tɪŋ/",
    partOfSpeech: "phrase",
    meaningVI:
      "Cơ chế giới hạn số lượng yêu cầu tối đa mà một client được phép gửi trong một khoảng thời gian",
    exampleSentenceEN:
      "We enabled rate limiting at the API gateway to protect downstream microservices from traffic spikes.",
    exampleTranslationVI:
      "Chúng tôi đã bật giới hạn lưu lượng tại API gateway để bảo vệ các microservice phía sau khỏi đột biến truy cập.",
    clusterTitle: "System & Cloud",
    careerLevel: "Junior",
    relatedTerms: ["throttling", "api gateway", "quota"],
  },
  "zero-downtime deployment": {
    phonetic: "/ˌzɪr.oʊ ˈdaʊn.taɪm dɪˈplɔɪ.mənt/",
    partOfSpeech: "phrase",
    meaningVI:
      "Chiến lược triển khai phiên bản mới lên môi trường production mà không làm gián đoạn dịch vụ của người dùng",
    exampleSentenceEN:
      "Blue-green routing allowed our team to achieve a zero-downtime deployment during peak hours.",
    exampleTranslationVI:
      "Định tuyến blue-green đã giúp nhóm chúng tôi triển khai không gián đoạn ngay trong giờ cao điểm.",
    clusterTitle: "DevOps & CI/CD",
    careerLevel: "Senior",
    relatedTerms: ["blue-green", "canary", "rollback"],
  },
  throughput: {
    phonetic: "/ˈθruː.pʊt/",
    partOfSpeech: "noun",
    meaningVI:
      "Lưu lượng tác vụ hoặc yêu cầu mà hệ thống xử lý thành công trong một đơn vị thời gian",
    exampleSentenceEN:
      "Batching database writes significantly increased our worker throughput under heavy load.",
    exampleTranslationVI:
      "Việc gom nhóm các thao tác ghi cơ sở dữ liệu đã làm tăng đáng kể thông lượng xử lý khi tải nặng.",
    clusterTitle: "System & Cloud",
    careerLevel: "Junior",
    relatedTerms: ["latency", "scalability", "concurrency"],
  },
  scalability: {
    phonetic: "/ˌskeɪ.ləˈbɪl.ə.t̬i/",
    partOfSpeech: "noun",
    meaningVI:
      "Khả năng mở rộng của hệ thống để đáp ứng khối lượng tải tăng lên mà không suy giảm hiệu năng",
    exampleSentenceEN:
      "Stateless services improve horizontal scalability across multiple cloud availability zones.",
    exampleTranslationVI:
      "Các dịch vụ phi trạng thái giúp cải thiện khả năng mở rộng ngang trên nhiều vùng đám mây.",
    clusterTitle: "System & Cloud",
    careerLevel: "Senior",
    relatedTerms: ["load balancer", "autoscale", "sharding"],
  },
  rollback: {
    phonetic: "/ˈroʊl.bæk/",
    partOfSpeech: "noun",
    meaningVI:
      "Thao tác khôi phục hệ thống hoặc cơ sở dữ liệu về phiên bản ổn định trước đó khi phát hiện lỗi",
    exampleSentenceEN:
      "We triggered an immediate rollback after monitoring alerted us to elevated 500 error rates.",
    exampleTranslationVI:
      "Chúng tôi đã kích hoạt khôi phục tức thì sau khi hệ thống giám sát cảnh báo tỷ lệ lỗi 500 tăng cao.",
    clusterTitle: "Bug & Outage",
    careerLevel: "Fresher",
    relatedTerms: ["hotfix", "outage", "deploy"],
  },
  hotfix: {
    phonetic: "/ˈhɑːt.fɪks/",
    partOfSpeech: "noun",
    meaningVI:
      "Bản vá lỗi khẩn cấp được triển khai trực tiếp lên môi trường production để khắc phục sự cố nghiêm trọng",
    exampleSentenceEN:
      "The on-call engineer shipped a hotfix to resolve the authentication token expiration bug.",
    exampleTranslationVI:
      "Kỹ sư trực sự cố đã phát hành bản vá khẩn cấp để xử lý lỗi hết hạn token xác thực.",
    clusterTitle: "Bug & Outage",
    careerLevel: "Fresher",
    relatedTerms: ["bug", "rollback", "incident"],
  },
  standup: {
    phonetic: "/ˈstænd.ʌp/",
    partOfSpeech: "noun",
    meaningVI:
      "Cuộc họp ngắn hàng ngày của đội ngũ phát triển để cập nhật tiến độ và nêu vướng mắc",
    exampleSentenceEN:
      "In our daily standup, we update the team on our progress and flag any blockers.",
    exampleTranslationVI:
      "Trong cuộc họp standup hàng ngày, chúng tôi cập nhật tiến độ và báo cáo các vướng mắc.",
    clusterTitle: "Daily Standup",
    careerLevel: "Fresher",
    relatedTerms: ["blocker", "sprint", "backlog"],
  },
  blocker: {
    phonetic: "/ˈblɑː.kɚ/",
    partOfSpeech: "noun",
    meaningVI:
      "Vấn đề hoặc trở ngại kỹ thuật ngăn cản không cho công việc tiếp tục triển khai",
    exampleSentenceEN:
      "The missing staging credentials are a major blocker for our integration testing.",
    exampleTranslationVI:
      "Việc thiếu thông tin xác thực staging là trở ngại lớn cho quá trình kiểm thử tích hợp của chúng tôi.",
    clusterTitle: "Daily Standup",
    careerLevel: "Fresher",
    relatedTerms: ["standup", "dependency", "deadline"],
  },
};

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function canonicalTermKey(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}

function slugifyClusterValue(value: string): string {
  const slug = value
    .replace(/[đĐ]/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || "system-cloud";
}

function isValidPhonetic(value: string | undefined): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return Boolean(
    trimmed.length > 0 &&
      trimmed !== FORBIDDEN_PHONETIC &&
      trimmed !== "..." &&
      trimmed !== "//"
  );
}

function isValidClusterTitle(value: string | undefined): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return Boolean(trimmed.length > 0 && trimmed !== FORBIDDEN_CLUSTER_TITLE);
}

export function isVocabularyItemComplete(item: VocabularyItem): boolean {
  if (!item || typeof item !== "object") return false;
  const term = (item.term ?? "").trim();
  const phonetic = (item.phonetic ?? "").trim();
  const meaningVI = (item.meaningVI ?? "").trim();
  const exampleSentenceEN = (item.exampleSentenceEN ?? "").trim();
  const clusterTitle = (item.clusterTitle ?? "").trim();

  return (
    term.length > 0 &&
    phonetic.length > 0 &&
    phonetic !== FORBIDDEN_PHONETIC &&
    meaningVI.length > 0 &&
    exampleSentenceEN.length > 0 &&
    clusterTitle.length > 0 &&
    clusterTitle !== FORBIDDEN_CLUSTER_TITLE
  );
}

function sanitizeExistingClusters(existingClusters: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of [...existingClusters, ...DEFAULT_IT_CLUSTERS]) {
    if (typeof raw !== "string") continue;
    const cleaned = normalizeWhitespace(raw);
    if (!isValidClusterTitle(cleaned)) continue;
    const lower = cleaned.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      out.push(cleaned);
    }
  }
  return out;
}

function wordToFallbackIpa(word: string): string {
  const lower = word.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!lower) return "tɝːm";

  const exactSyllables: Record<string, string> = {
    api: "ˌeɪ.piːˈaɪ",
    ui: "ˌjuːˈaɪ",
    ux: "ˌjuːˈeks",
    sql: "ˌes.kjuːˈel",
    ci: "ˌsiːˈaɪ",
    cd: "ˌsiːˈdiː",
    qa: "ˌkjuːˈeɪ",
    pr: "ˌpiːˈɑːr",
    jwt: "ˌdʒeɪ.dʌb.əl.juːˈtiː",
    dns: "ˌdiː.enˈes",
    cpu: "ˌsiː.piːˈjuː",
    gpu: "ˌdʒiː.piːˈjuː",
    ram: "ræm",
    ssh: "ˌes.esˈeɪtʃ",
    http: "ˌeɪtʃ.tiː.tiːˈpiː",
    https: "ˌeɪtʃ.tiː.tiː.piːˈes",
    json: "ˈdʒeɪ.sɑːn",
    yaml: "ˈjæm.əl",
    bug: "bʌɡ",
    code: "koʊd",
    sync: "sɪŋk",
    async: "ˈeɪ.sɪŋk",
    cache: "kæʃ",
    queue: "kjuː",
    cloud: "klaʊd",
    load: "loʊd",
    lock: "lɑːk",
    dead: "ded",
    rate: "reɪt",
    limit: "ˈlɪm.ɪt",
    limiting: "ˈlɪm.ɪ.tɪŋ",
    deploy: "dɪˈplɔɪ",
    deployment: "dɪˈplɔɪ.mənt",
    test: "test",
    testing: "ˈtes.tɪŋ",
    merge: "mɝːdʒ",
    branch: "bræntʃ",
    commit: "kəˈmɪt",
    pull: "pʊl",
    request: "rɪˈkwest",
    server: "ˈsɝː.vɚ",
    client: "ˈklaɪ.ənt",
    status: "ˈsteɪ.t̬əs",
    error: "ˈer.ɚ",
    trace: "treɪs",
    stack: "stæk",
    leak: "liːk",
    memory: "ˈmem.ər.i",
    thread: "θred",
    query: "ˈkwɪr.i",
    index: "ˈɪn.deks",
    schema: "ˈskiː.mə",
    token: "ˈtoʊ.kən",
    auth: "ɔːθ",
    sprint: "sprɪnt",
    agile: "ˈædʒ.əl",
    scrum: "skrʌm",
  };

  if (exactSyllables[lower]) {
    return exactSyllables[lower];
  }

  let ipa = lower
    .replace(/tion$/g, "ʃən")
    .replace(/sion$/g, "ʒən")
    .replace(/ment$/g, "mənt")
    .replace(/ness$/g, "nəs")
    .replace(/ity$/g, "ə.t̬i")
    .replace(/ing$/g, "ɪŋ")
    .replace(/ed$/g, "d")
    .replace(/er$/g, "ɚ")
    .replace(/or$/g, "ɚ")
    .replace(/al$/g, "əl")
    .replace(/ive$/g, "ɪv")
    .replace(/ous$/g, "əs")
    .replace(/cy$/g, "si")
    .replace(/ph/g, "f")
    .replace(/sh/g, "ʃ")
    .replace(/ch/g, "tʃ")
    .replace(/th/g, "θ")
    .replace(/ck/g, "k")
    .replace(/qu/g, "kw")
    .replace(/ee/g, "iː")
    .replace(/ea/g, "iː")
    .replace(/oo/g, "uː")
    .replace(/ou/g, "aʊ")
    .replace(/ai/g, "eɪ")
    .replace(/ay/g, "eɪ")
    .replace(/oa/g, "oʊ")
    .replace(/c(?=[eiy])/g, "s")
    .replace(/c/g, "k")
    .replace(/x/g, "ks")
    .replace(/y$/g, "i")
    .replace(/y/g, "ɪ")
    .replace(/a/g, "æ")
    .replace(/e/g, "e")
    .replace(/i/g, "ɪ")
    .replace(/o/g, "ɑː")
    .replace(/u/g, "ʌ");

  if (!ipa) {
    ipa = "tɝːm";
  }
  return ipa.length > 3 ? `ˈ${ipa}` : ipa;
}

export function generateDeterministicPhonetic(term: string): string {
  const key = canonicalTermKey(term);
  const seed = KNOWN_IT_VOCAB_SEEDS[key];
  if (seed) return seed.phonetic;

  const words = normalizeWhitespace(term)
    .split(/[\s/-]+/)
    .filter(Boolean);
  if (words.length === 0) return "/ˈtɝːm/";

  const transcribed = words.map(wordToFallbackIpa).join(" ");
  return `/${transcribed}/`;
}

function normalizePhoneticString(raw: unknown, term: string): string {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (isValidPhonetic(trimmed)) {
      const stripped = trimmed.replace(/^\/+|\/+$/g, "").trim();
      if (stripped && stripped !== "...") {
        return `/${stripped}/`;
      }
    }
  }
  return generateDeterministicPhonetic(term);
}

function normalizePosString(raw: unknown, term: string): string {
  if (typeof raw === "string") {
    const cleaned = raw.trim().toLowerCase().replace(/\.$/, "");
    if (VALID_POS.has(cleaned)) return cleaned;
    if (cleaned === "n") return "noun";
    if (cleaned === "v") return "verb";
    if (cleaned === "adj") return "adjective";
    if (cleaned === "adv") return "adverb";
    if (cleaned.includes("phrase") || cleaned === "idiom") return "phrase";
  }
  const seed = KNOWN_IT_VOCAB_SEEDS[canonicalTermKey(term)];
  if (seed) return seed.partOfSpeech;
  return /\s+/.test(normalizeWhitespace(term)) ? "phrase" : "noun";
}

function normalizeCareerLevel(
  raw: unknown,
  term: string
): "Fresher" | "Junior" | "Senior" {
  if (typeof raw === "string") {
    const lower = raw.trim().toLowerCase();
    if (lower === "fresher" || lower === "beginner" || lower === "entry") {
      return "Fresher";
    }
    if (lower === "junior" || lower === "intermediate" || lower === "mid") {
      return "Junior";
    }
    if (lower === "senior" || lower === "advanced" || lower === "lead") {
      return "Senior";
    }
  }
  const seed = KNOWN_IT_VOCAB_SEEDS[canonicalTermKey(term)];
  if (seed) return seed.careerLevel;
  return "Junior";
}

function inferDeterministicClusterTitle(
  term: string,
  meaningVI: string,
  exampleSentenceEN: string,
  existingClusters: string[]
): string {
  const validExisting = sanitizeExistingClusters(existingClusters);
  const seed = KNOWN_IT_VOCAB_SEEDS[canonicalTermKey(term)];
  if (seed) {
    const matchedSeed = validExisting.find(
      (c) => c.toLowerCase() === seed.clusterTitle.toLowerCase()
    );
    return matchedSeed ?? seed.clusterTitle;
  }

  const haystack = `${term} ${meaningVI} ${exampleSentenceEN}`.toLowerCase();

  const rules: Array<{ cluster: string; keywords: string[] }> = [
    {
      cluster: "Database & Concurrency",
      keywords: [
        "deadlock",
        "lock",
        "mutex",
        "transaction",
        "sql",
        "query",
        "index",
        "shard",
        "replica",
        "database",
        "concurrency",
        "race condition",
        "acid",
      ],
    },
    {
      cluster: "Bug & Outage",
      keywords: [
        "bug",
        "outage",
        "incident",
        "crash",
        "error",
        "exception",
        "rollback",
        "hotfix",
        "severity",
        "reproduce",
        "postmortem",
        "debug",
        "leak",
      ],
    },
    {
      cluster: "Code Review & Git",
      keywords: [
        "git",
        "pull request",
        "merge",
        "branch",
        "rebase",
        "commit",
        "refactor",
        "lint",
        "review",
        "diff",
        "clean code",
      ],
    },
    {
      cluster: "DevOps & CI/CD",
      keywords: [
        "deploy",
        "pipeline",
        "docker",
        "kubernetes",
        "container",
        "ci/cd",
        "canary",
        "blue-green",
        "terraform",
        "monitoring",
        "downtime",
      ],
    },
    {
      cluster: "Security & Auth",
      keywords: [
        "auth",
        "token",
        "jwt",
        "oauth",
        "encryption",
        "vulnerability",
        "xss",
        "csrf",
        "permission",
        "credential",
        "security",
      ],
    },
    {
      cluster: "Testing & QA",
      keywords: [
        "test",
        "qa",
        "assertion",
        "mock",
        "regression",
        "coverage",
        "e2e",
        "cypress",
        "playwright",
      ],
    },
    {
      cluster: "Frontend & UI",
      keywords: [
        "render",
        "component",
        "dom",
        "hydration",
        "css",
        "layout",
        "responsive",
        "accessibility",
        "state",
        "frontend",
      ],
    },
    {
      cluster: "Daily Standup",
      keywords: [
        "standup",
        "blocker",
        "sprint",
        "backlog",
        "scrum",
        "agile",
        "ticket",
        "velocity",
        "retrospective",
      ],
    },
    {
      cluster: "HR Interview",
      keywords: [
        "interview",
        "stakeholder",
        "deadline",
        "onboarding",
        "mentor",
        "career",
        "salary",
        "teamwork",
        "leadership",
      ],
    },
    {
      cluster: "System & Cloud",
      keywords: [
        "latency",
        "throughput",
        "scalability",
        "cache",
        "redis",
        "queue",
        "webhook",
        "api",
        "endpoint",
        "microservice",
        "cloud",
        "server",
        "idempotency",
        "rate limit",
        "load balancer",
      ],
    },
  ];

  for (const rule of rules) {
    if (rule.keywords.some((kw) => haystack.includes(kw))) {
      const matched = validExisting.find(
        (c) => c.toLowerCase() === rule.cluster.toLowerCase()
      );
      return matched ?? rule.cluster;
    }
  }

  return validExisting[0] ?? "System & Cloud";
}

function resolveValidClusterTitle(
  existingOnItem: string | undefined,
  aiCandidate: unknown,
  term: string,
  meaningVI: string,
  exampleSentenceEN: string,
  existingClusters: string[]
): string {
  const validExisting = sanitizeExistingClusters(existingClusters);

  if (isValidClusterTitle(existingOnItem)) {
    const cleaned = normalizeWhitespace(existingOnItem!);
    const matched = validExisting.find(
      (c) => c.toLowerCase() === cleaned.toLowerCase()
    );
    return matched ?? cleaned;
  }

  if (typeof aiCandidate === "string" && isValidClusterTitle(aiCandidate)) {
    const cleaned = normalizeWhitespace(aiCandidate);
    const matched = validExisting.find(
      (c) => c.toLowerCase() === cleaned.toLowerCase()
    );
    return matched ?? cleaned;
  }

  return inferDeterministicClusterTitle(
    term,
    meaningVI,
    exampleSentenceEN,
    validExisting
  );
}

function generateDeterministicMeaningVI(term: string, clusterTitle: string): string {
  const seed = KNOWN_IT_VOCAB_SEEDS[canonicalTermKey(term)];
  if (seed) return seed.meaningVI;
  return `Thuật ngữ kỹ thuật "${term}" thuộc nhóm ${clusterTitle} trong phát triển và vận hành hệ thống phần mềm.`;
}

function generateDeterministicExampleEN(term: string, clusterTitle: string): string {
  const seed = KNOWN_IT_VOCAB_SEEDS[canonicalTermKey(term)];
  if (seed) return seed.exampleSentenceEN;
  return `Our engineering team evaluated ${term} during the ${clusterTitle.toLowerCase()} review to keep the production service reliable.`;
}

function generateDeterministicExampleVI(term: string, clusterTitle: string): string {
  const seed = KNOWN_IT_VOCAB_SEEDS[canonicalTermKey(term)];
  if (seed) return seed.exampleTranslationVI;
  return `Đội ngũ kỹ thuật đã đánh giá ${term} trong buổi rà soát ${clusterTitle} nhằm đảm bảo dịch vụ production vận hành ổn định.`;
}

function normalizeRelatedTerms(
  existingOnItem: string[] | undefined,
  aiCandidate: unknown,
  term: string,
  clusterTitle: string
): string[] {
  const collect = (raw: unknown): string[] => {
    const list = Array.isArray(raw)
      ? raw
      : typeof raw === "string"
        ? raw.split(/[;|,]/)
        : [];
    const seen = new Set<string>([canonicalTermKey(term)]);
    const out: string[] = [];
    for (const entry of list) {
      if (typeof entry !== "string") continue;
      const cleaned = normalizeWhitespace(entry);
      const key = cleaned.toLowerCase();
      if (cleaned && !seen.has(key)) {
        seen.add(key);
        out.push(cleaned);
      }
    }
    return out;
  };

  const fromExisting = collect(existingOnItem);
  if (fromExisting.length > 0) return fromExisting.slice(0, 5);

  const fromAi = collect(aiCandidate);
  if (fromAi.length > 0) return fromAi.slice(0, 5);

  const seed = KNOWN_IT_VOCAB_SEEDS[canonicalTermKey(term)];
  if (seed && seed.relatedTerms.length > 0) {
    return seed.relatedTerms;
  }

  const clusterLower = clusterTitle.toLowerCase();
  if (clusterLower.includes("database")) {
    return ["transaction", "concurrency", "query"];
  }
  if (clusterLower.includes("bug") || clusterLower.includes("outage")) {
    return ["hotfix", "rollback", "incident"];
  }
  if (clusterLower.includes("git") || clusterLower.includes("review")) {
    return ["pull request", "branch", "refactor"];
  }
  if (clusterLower.includes("standup")) {
    return ["sprint", "blocker", "backlog"];
  }
  return ["architecture", "production", "deployment"];
}

export function buildDeterministicVocabularyFallback(
  item: VocabularyItem,
  existingClusters: string[] = [],
  aiRecord?: Record<string, unknown>
): VocabularyItem {
  const term = normalizeWhitespace(item.term || "technical term");
  const id = item.id?.trim() || `vocab-${slugifyClusterValue(term)}`;

  const aiMeaning =
    typeof aiRecord?.meaningVI === "string" && aiRecord.meaningVI.trim()
      ? aiRecord.meaningVI.trim()
      : typeof aiRecord?.meaning_vi === "string" && aiRecord.meaning_vi.trim()
        ? aiRecord.meaning_vi.trim()
        : "";

  const aiExampleEN =
    typeof aiRecord?.exampleSentenceEN === "string" &&
    aiRecord.exampleSentenceEN.trim()
      ? aiRecord.exampleSentenceEN.trim()
      : typeof aiRecord?.example_sentence_en === "string" &&
          aiRecord.example_sentence_en.trim()
        ? aiRecord.example_sentence_en.trim()
        : "";

  const aiExampleVI =
    typeof aiRecord?.exampleTranslationVI === "string" &&
    aiRecord.exampleTranslationVI.trim()
      ? aiRecord.exampleTranslationVI.trim()
      : typeof aiRecord?.example_translation_vi === "string" &&
          aiRecord.example_translation_vi.trim()
        ? aiRecord.example_translation_vi.trim()
        : "";

  const clusterTitle = resolveValidClusterTitle(
    item.clusterTitle,
    aiRecord?.clusterTitle ?? aiRecord?.cluster_title ?? aiRecord?.category,
    term,
    item.meaningVI?.trim() || aiMeaning,
    item.exampleSentenceEN?.trim() || aiExampleEN,
    existingClusters
  );

  const phonetic = isValidPhonetic(item.phonetic)
    ? normalizePhoneticString(item.phonetic, term)
    : normalizePhoneticString(
        aiRecord?.phonetic ?? aiRecord?.ipa ?? aiRecord?.pronunciation,
        term
      );

  const hasExplicitPos =
    typeof item.partOfSpeech === "string" &&
    item.partOfSpeech.trim().length > 0 &&
    (item.meaningVI?.trim().length > 0 || item.partOfSpeech.trim() !== "noun");

  const partOfSpeech = hasExplicitPos
    ? normalizePosString(item.partOfSpeech, term)
    : normalizePosString(
        aiRecord?.partOfSpeech ?? aiRecord?.part_of_speech ?? item.partOfSpeech,
        term
      );

  const meaningVI =
    item.meaningVI?.trim() ||
    aiMeaning ||
    generateDeterministicMeaningVI(term, clusterTitle);

  const exampleSentenceEN =
    item.exampleSentenceEN?.trim() ||
    aiExampleEN ||
    generateDeterministicExampleEN(term, clusterTitle);

  const exampleTranslationVI =
    item.exampleTranslationVI?.trim() ||
    aiExampleVI ||
    generateDeterministicExampleVI(term, clusterTitle);

  const existingValidSlug =
    isValidClusterTitle(item.clusterTitle) &&
    item.clusterSlug?.trim() &&
    item.clusterSlug.trim() !== "tuy-chinh"
      ? item.clusterSlug.trim()
      : "";

  const aiSlugRaw =
    typeof aiRecord?.clusterSlug === "string"
      ? aiRecord.clusterSlug.trim()
      : typeof aiRecord?.cluster_slug === "string"
        ? aiRecord.cluster_slug.trim()
        : "";

  const clusterSlug =
    existingValidSlug ||
    (aiSlugRaw && aiSlugRaw !== "tuy-chinh"
      ? slugifyClusterValue(aiSlugRaw)
      : slugifyClusterValue(clusterTitle));

  const hasExplicitLevel =
    (item.careerLevel === "Fresher" ||
      item.careerLevel === "Junior" ||
      item.careerLevel === "Senior") &&
    isValidClusterTitle(item.clusterTitle);

  const careerLevel = hasExplicitLevel
    ? item.careerLevel!
    : normalizeCareerLevel(
        aiRecord?.careerLevel ?? aiRecord?.career_level ?? item.careerLevel,
        term
      );

  const relatedTerms = normalizeRelatedTerms(
    item.relatedTerms,
    aiRecord?.relatedTerms ?? aiRecord?.related_terms,
    term,
    clusterTitle
  );

  return {
    id,
    term,
    phonetic,
    partOfSpeech,
    meaningVI,
    exampleSentenceEN,
    exampleTranslationVI,
    clusterTitle,
    clusterSlug,
    careerLevel,
    relatedTerms,
  };
}

function parseAiBatchItems(rawText: string): Record<string, unknown>[] | null {
  if (!rawText || typeof rawText !== "string") return null;

  const trimmed = rawText.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidateText = fenced?.[1]?.trim() ?? trimmed;

  try {
    const direct: unknown = JSON.parse(candidateText);
    if (Array.isArray(direct)) {
      const records = direct.filter(
        (row): row is Record<string, unknown> =>
          Boolean(row && typeof row === "object" && !Array.isArray(row))
      );
      if (records.length > 0) return records;
    }
  } catch {}

  const obj = extractFirstJsonObject(rawText);
  if (obj) {
    for (const key of ["items", "vocabulary", "data", "results"]) {
      const val = obj[key];
      if (Array.isArray(val)) {
        const records = val.filter(
          (row): row is Record<string, unknown> =>
            Boolean(row && typeof row === "object" && !Array.isArray(row))
        );
        if (records.length > 0) return records;
      }
    }
    if (typeof obj.term === "string") {
      return [obj];
    }
  }

  const startBracket = candidateText.indexOf("[");
  const endBracket = candidateText.lastIndexOf("]");
  if (startBracket !== -1 && endBracket > startBracket) {
    try {
      const sliced: unknown = JSON.parse(
        candidateText.slice(startBracket, endBracket + 1)
      );
      if (Array.isArray(sliced)) {
        const records = sliced.filter(
          (row): row is Record<string, unknown> =>
            Boolean(row && typeof row === "object" && !Array.isArray(row))
        );
        if (records.length > 0) return records;
      }
    } catch {}
  }

  return null;
}

function buildBatchRepairPrompts(
  batch: VocabularyItem[],
  existingClusters: string[]
): { systemInstruction: string; userPrompt: string } {
  const validClusters = sanitizeExistingClusters(existingClusters);

  const systemInstruction = [
    "You are an expert English-Vietnamese IT lexicographer and software engineering curriculum designer.",
    "Given a batch of partial or incomplete IT vocabulary items and a list of existing semantic clusters, repair and complete every item.",
    "Return ONLY a strict JSON object with the shape: {\"items\": [ ... ]}.",
    "Rules for each item in \"items\":",
    "1. Preserve any non-empty valid fields already provided on the input item.",
    "2. \"phonetic\": valid IPA transcription enclosed in slashes (e.g. \"/ˈded.lɑːk/\"). Never empty and never \"/.../\".",
    "3. \"partOfSpeech\": one of \"noun\", \"verb\", \"adjective\", \"phrase\", \"adverb\".",
    "4. \"meaningVI\": concise, accurate Vietnamese software engineering definition.",
    "5. \"exampleSentenceEN\": realistic workplace English sentence in a software team context using the term naturally.",
    "6. \"exampleTranslationVI\": natural Vietnamese translation of exampleSentenceEN.",
    "7. \"clusterTitle\": assign to the best matching cluster from existingClusters when appropriate, or a concise 2-4 word English IT cluster title. NEVER use \"Tùy chỉnh\".",
    "8. \"clusterSlug\": kebab-case slug of clusterTitle.",
    "9. \"careerLevel\": one of \"Fresher\", \"Junior\", \"Senior\".",
    "10. \"relatedTerms\": array of 2 to 4 related English IT terms.",
  ].join("\n");

  const inputPayload = {
    existingClusters: validClusters,
    items: batch.map((item, index) => ({
      index,
      id: item.id,
      term: item.term,
      phonetic: isValidPhonetic(item.phonetic) ? item.phonetic : "",
      partOfSpeech: item.partOfSpeech || "",
      meaningVI: item.meaningVI || "",
      exampleSentenceEN: item.exampleSentenceEN || "",
      exampleTranslationVI: item.exampleTranslationVI || "",
      clusterTitle: isValidClusterTitle(item.clusterTitle)
        ? item.clusterTitle
        : "",
      careerLevel: item.careerLevel || "",
      relatedTerms: item.relatedTerms ?? [],
    })),
  };

  return {
    systemInstruction,
    userPrompt: JSON.stringify(inputPayload),
  };
}

export interface RepairVocabularyAiOptions {
  requestText?: typeof requestAiWaterfallText;
  timeoutMs?: number;
}

export async function repairVocabularyItemsWithAi(
  items: VocabularyItem[],
  existingClusters: string[] = [],
  options: RepairVocabularyAiOptions = {}
): Promise<{ repairedItems: VocabularyItem[]; aiRepairedCount: number }> {
  const completeItems: VocabularyItem[] = [];
  const needsAiRepairItems: VocabularyItem[] = [];
  const repairIndices: number[] = [];
  const repairedOutput = new Array<VocabularyItem>(items.length);

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (isVocabularyItemComplete(item)) {
      const normalizedComplete: VocabularyItem = {
        ...item,
        term: normalizeWhitespace(item.term),
        phonetic: item.phonetic.trim(),
        meaningVI: item.meaningVI.trim(),
        exampleSentenceEN: item.exampleSentenceEN.trim(),
        exampleTranslationVI: (item.exampleTranslationVI ?? "").trim(),
        clusterTitle: item.clusterTitle!.trim(),
        clusterSlug:
          item.clusterSlug?.trim() || slugifyClusterValue(item.clusterTitle!),
        careerLevel: normalizeCareerLevel(item.careerLevel, item.term),
        relatedTerms: normalizeRelatedTerms(
          item.relatedTerms,
           undefined,
          item.term,
          item.clusterTitle!
        ),
      };
      completeItems.push(normalizedComplete);
      repairedOutput[i] = normalizedComplete;
    } else {
      needsAiRepairItems.push(item);
      repairIndices.push(i);
    }
  }

  if (needsAiRepairItems.length === 0) {
    return {
      repairedItems: completeItems,
      aiRepairedCount: 0,
    };
  }

  const requestFn = options.requestText ?? requestAiWaterfallText;
  const sanitizedClusters = sanitizeExistingClusters(existingClusters);
  const dynamicClusters = [...sanitizedClusters];

  for (
    let batchStart = 0;
    batchStart < needsAiRepairItems.length;
    batchStart += BATCH_SIZE
  ) {
    const batch = needsAiRepairItems.slice(batchStart, batchStart + BATCH_SIZE);
    const { systemInstruction, userPrompt } = buildBatchRepairPrompts(
      batch,
      dynamicClusters
    );

    let aiRecords: Record<string, unknown>[] | null = null;
    try {
      const aiResponse = await requestFn({
        systemInstruction,
        userPrompt,
        temperature: 0.2,
        jsonMode: true,
        timeoutMs: options.timeoutMs ?? 8000,
        validate: (text) => parseAiBatchItems(text) !== null,
      });
      if (aiResponse?.text) {
        aiRecords = parseAiBatchItems(aiResponse.text);
      }
    } catch {
      aiRecords = null;
    }

    const byTerm = new Map<string, Record<string, unknown>>();
    const byId = new Map<string, Record<string, unknown>>();
    const byIndex = new Map<number, Record<string, unknown>>();

    if (aiRecords) {
      aiRecords.forEach((rec, idx) => {
        byIndex.set(idx, rec);
        if (typeof rec.index === "number" && Number.isInteger(rec.index)) {
          byIndex.set(rec.index, rec);
        }
        if (typeof rec.term === "string" && rec.term.trim()) {
          byTerm.set(canonicalTermKey(rec.term), rec);
        }
        if (typeof rec.id === "string" && rec.id.trim()) {
          byId.set(rec.id.trim(), rec);
        }
      });
    }

    for (let j = 0; j < batch.length; j += 1) {
      const sourceItem = batch[j];
      const matchedAi =
        byTerm.get(canonicalTermKey(sourceItem.term)) ??
        (sourceItem.id ? byId.get(sourceItem.id) : undefined) ??
        byIndex.get(j);

      const repaired = buildDeterministicVocabularyFallback(
        sourceItem,
        dynamicClusters,
        matchedAi
      );

      if (
        repaired.clusterTitle &&
        !dynamicClusters.some(
          (c) => c.toLowerCase() === repaired.clusterTitle!.toLowerCase()
        )
      ) {
        dynamicClusters.push(repaired.clusterTitle);
      }

      const targetIdx = repairIndices[batchStart + j];
      repairedOutput[targetIdx] = repaired;
    }
  }

  return {
    repairedItems: repairedOutput,
    aiRepairedCount: needsAiRepairItems.length,
  };
}

import { ITRole, ScenarioId } from "../lib/types";

export interface ITRoleConfig {
  id: ITRole;
  label: string;
  taglineVI: string;
  recommendedScenarioId: ScenarioId;
}

export interface BugBusterChallenge {
  id: string;
  category: "error-log" | "code-review" | "incident";
  promptEN: string;
  targetWord: string;
  acceptedVariants: string[];
  contextVI: string;
  phonetic: string;
}

export interface StandupSpeedQuestion {
  id: string;
  phase: "yesterday" | "today" | "blockers";
  labelVI: string;
  questionEN: string;
  hintVI: string;
  expectedKeywords: string[];
  timeLimitSec: number;
}

export const IT_ROLES: ITRoleConfig[] = [
  {
    id: "frontend",
    label: "Frontend",
    taglineVI: "UI/UX, React, tối ưu giao diện & demo sản phẩm",
    recommendedScenarioId: "tech-demo",
  },
  {
    id: "backend",
    label: "Backend",
    taglineVI: "API, database, tối ưu truy vấn & code review",
    recommendedScenarioId: "code-review",
  },
  {
    id: "qa",
    label: "QA",
    taglineVI: "Kiểm thử, tái hiện lỗi & báo cáo mức độ sự cố",
    recommendedScenarioId: "bug-report",
  },
  {
    id: "devops",
    label: "DevOps",
    taglineVI: "CI/CD, triển khai production & xử lý hạ tầng",
    recommendedScenarioId: "daily-standup",
  },
];

export const BUG_BUSTER_CHALLENGES: BugBusterChallenge[] = [
  {
    id: "bb-01",
    category: "incident",
    promptEN:
      "Production CPU spiked to 99% after v2.4.1 release; trigger an immediate ____ to the previous stable build.",
    targetWord: "rollback",
    acceptedVariants: ["roll back", "roll-back", "rolled back", "rolling back"],
    contextVI:
      "Khôi phục hệ thống về phiên bản ổn định trước đó khi bản mới gặp sự cố.",
    phonetic: "/ˈroʊl.bæk/",
  },
  {
    id: "bb-02",
    category: "error-log",
    promptEN:
      "[WARN] HTTP 404 Not Found: The client called a deprecated API ____ at /api/v1/users.",
    targetWord: "endpoint",
    acceptedVariants: ["end point", "endpoints", "end points"],
    contextVI:
      "Địa chỉ URL cụ thể mà API cung cấp để client gửi request tới.",
    phonetic: "/ˈend.pɔɪnt/",
  },
  {
    id: "bb-03",
    category: "incident",
    promptEN:
      "[ALERT] Database queries are slow and p95 network ____ exceeded 2,500ms in ap-southeast-1.",
    targetWord: "latency",
    acceptedVariants: ["latencies"],
    contextVI:
      "Độ trễ thời gian từ lúc gửi yêu cầu đến khi nhận được phản hồi.",
    phonetic: "/ˈleɪ.tən.si/",
  },
  {
    id: "bb-04",
    category: "incident",
    promptEN:
      "Missing staging credentials is a critical ____ preventing the team from testing payments.",
    targetWord: "blocker",
    acceptedVariants: ["blockers", "blocked", "blocking"],
    contextVI:
      "Trở ngại nghiêm trọng làm công việc của nhóm không thể tiếp tục.",
    phonetic: "/ˈblɑː.kɚ/",
  },
  {
    id: "bb-05",
    category: "code-review",
    promptEN:
      "Code Review: This function is 180 lines long; please ____ it into smaller, reusable helpers.",
    targetWord: "refactor",
    acceptedVariants: ["re factor", "refactored", "refactoring"],
    contextVI:
      "Tái cấu trúc mã nguồn cho gọn sạch hơn mà không đổi hành vi chức năng.",
    phonetic: "/ˌriːˈfæk.tɚ/",
  },
  {
    id: "bb-06",
    category: "error-log",
    promptEN:
      "[ERROR] Upstream gateway failed to respond within 30s and threw a connection ____ exception.",
    targetWord: "timeout",
    acceptedVariants: ["time out", "time-out", "timed out", "timeouts"],
    contextVI:
      "Lỗi hết thời gian chờ phản hồi từ máy chủ hoặc dịch vụ bên ngoài.",
    phonetic: "/ˈtaɪm.aʊt/",
  },
  {
    id: "bb-07",
    category: "error-log",
    promptEN:
      "[400 Bad Request] Invalid JSON body: the webhook ____ is missing the required signature field.",
    targetWord: "payload",
    acceptedVariants: ["pay load", "payloads"],
    contextVI:
      "Phần dữ liệu thực tế được gửi kèm trong body của HTTP request.",
    phonetic: "/ˈpeɪ.loʊd/",
  },
  {
    id: "bb-08",
    category: "code-review",
    promptEN:
      "Code Review: Before adding the email column, update the database migration ____ and validation rules.",
    targetWord: "schema",
    acceptedVariants: ["schemas", "skema"],
    contextVI:
      "Cấu trúc định nghĩa các bảng, cột và kiểu dữ liệu của cơ sở dữ liệu.",
    phonetic: "/ˈskiː.mə/",
  },
  {
    id: "bb-09",
    category: "code-review",
    promptEN:
      "Git aborted the rebase because of a merge ____ in package.json; resolve it before pushing.",
    targetWord: "conflict",
    acceptedVariants: ["conflicts", "merge conflict"],
    contextVI:
      "Xung đột mã nguồn khi hai nhánh cùng chỉnh sửa tại một vị trí.",
    phonetic: "/ˈkɑːn.flɪkt/",
  },
  {
    id: "bb-10",
    category: "incident",
    promptEN:
      "Checkout is broken for iOS users right now; ship an urgent ____ branch straight to production.",
    targetWord: "hotfix",
    acceptedVariants: ["hot fix", "hot-fix", "hotfixes"],
    contextVI:
      "Bản vá lỗi khẩn cấp được đưa thẳng lên môi trường production.",
    phonetic: "/ˈhɑːt.fɪks/",
  },
  {
    id: "bb-11",
    category: "incident",
    promptEN:
      "All integration tests passed on staging, so we are ready to ____ the release to production.",
    targetWord: "deploy",
    acceptedVariants: ["deployed", "deploying", "deployment"],
    contextVI:
      "Triển khai phiên bản phần mềm mới lên môi trường máy chủ chạy thật.",
    phonetic: "/dɪˈplɔɪ/",
  },
  {
    id: "bb-12",
    category: "error-log",
    promptEN:
      "QA Note: Please attach exact steps to ____ this crash consistently on a clean browser session.",
    targetWord: "reproduce",
    acceptedVariants: ["reproduced", "reproducing", "repro"],
    contextVI:
      "Tái hiện lại đúng lỗi đã xảy ra theo các bước cụ thể để dev kiểm tra.",
    phonetic: "/ˌriː.prəˈduːs/",
  },
];

export const STANDUP_SPEED_QUESTIONS: StandupSpeedQuestion[] = [
  {
    id: "standup-yesterday",
    phase: "yesterday",
    labelVI: "Hôm qua (Yesterday)",
    questionEN: "What did you complete yesterday?",
    hintVI:
      "Dùng thì quá khứ đơn (completed, fixed, implemented, tested) và nêu task hoặc pull request.",
    expectedKeywords: [
      "yesterday",
      "completed",
      "fixed",
      "implemented",
      "tested",
      "pull request",
      "merged",
      "finished",
    ],
    timeLimitSec: 25,
  },
  {
    id: "standup-today",
    phase: "today",
    labelVI: "Hôm nay (Today)",
    questionEN: "What are you working on today?",
    hintVI:
      "Dùng 'Today I will...' hoặc 'I plan to...' kèm đầu việc kỹ thuật (API, database, UI, tests).",
    expectedKeywords: [
      "today",
      "will",
      "plan",
      "working",
      "integrate",
      "develop",
      "api",
      "database",
      "test",
      "deploy",
    ],
    timeLimitSec: 25,
  },
  {
    id: "standup-blockers",
    phase: "blockers",
    labelVI: "Vướng mắc (Blockers)",
    questionEN: "Do you have any blockers slowing you down?",
    hintVI:
      "Nói 'No blockers' nếu thuận lợi, hoặc nêu rõ lý do đang chờ (waiting for, access, dependency, issue).",
    expectedKeywords: [
      "blocker",
      "blockers",
      "blocked",
      "no",
      "none",
      "clear",
      "waiting",
      "access",
      "dependency",
      "issue",
    ],
    timeLimitSec: 25,
  },
];

function normalizeSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function checkBugBusterAnswer(
  spoken: string,
  challenge: BugBusterChallenge
): boolean {
  const normalized = normalizeSpeech(spoken);
  if (!normalized) return false;

  const padded = ` ${normalized} `;
  const candidates = [challenge.targetWord, ...challenge.acceptedVariants];

  return candidates.some((candidate) => {
    const clean = normalizeSpeech(candidate);
    return clean.length > 0 && padded.includes(` ${clean} `);
  });
}

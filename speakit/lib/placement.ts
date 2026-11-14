import { CoreScenarioId, Scenario, ScenarioDifficulty } from "./types";

export const PLACEMENT_STORAGE_KEY = "speakit_placement_level_v1";
export const PLACEMENT_UPDATED_EVENT = "speakit-placement-updated";

export interface PlacementQuestion {
  id: string;
  contextVI: string;
  questionEN: string;
  options: Array<{ id: string; label: string }>;
  correctOptionId: string;
}

export interface PlacementResult {
  level: ScenarioDifficulty;
  score: number;
  recommendedScenarioId: CoreScenarioId;
  summaryVI: string;
  completedAt: string;
}

export const PLACEMENT_MCQS: PlacementQuestion[] = [
  {
    id: "mcq-standup",
    contextVI: "Trong buổi Daily Standup, bạn muốn báo cáo mình đang bị kẹt vì chưa có quyền truy cập API staging.",
    questionEN: "Which phrasing sounds most natural and professional?",
    options: [
      { id: "a", label: "I cannot work because nobody give me password yet." },
      { id: "b", label: "I am currently blocked waiting for access to the staging API credentials." },
      { id: "c", label: "Today I stop coding because staging is broken maybe." },
    ],
    correctOptionId: "b",
  },
  {
    id: "mcq-review",
    contextVI: "Khi nhận được góp ý tối ưu truy vấn cơ sở dữ liệu trong Pull Request, bạn muốn phản hồi chuyên nghiệp.",
    questionEN: "How should you respond to the reviewer?",
    options: [
      { id: "a", label: "Good catch! I will add a composite index and benchmark the query latency." },
      { id: "b", label: "My code already runs fine on localhost, so no need to change." },
      { id: "c", label: "Database slow is normal when many users click together." },
    ],
    correctOptionId: "a",
  },
];

const PLACEMENT_SPEAKING_KEYWORDS = [
  "bug",
  "api",
  "database",
  "fix",
  "fixed",
  "deploy",
  "test",
  "tested",
  "pull request",
  "refactor",
  "latency",
  "issue",
  "feature",
  "endpoint",
  "component",
  "production",
  "staging",
  "error",
  "performance",
  "cache",
];

const DEFAULT_DIFFICULTY_BY_ID: Record<string, ScenarioDifficulty> = {
  "daily-standup": "Fresher",
  "fresher-interview": "Fresher",
  "bug-report": "Junior",
  "code-review": "Junior",
  "client-meeting": "Senior",
  "tech-demo": "Senior",
};

export function getScenarioDifficulty(scenario: Pick<Scenario, "id" | "difficulty">): ScenarioDifficulty {
  if (scenario.difficulty) return scenario.difficulty;
  return DEFAULT_DIFFICULTY_BY_ID[scenario.id] ?? "Junior";
}

export function evaluatePlacementLevel(
  mcqAnswers: Record<string, string>,
  speakingTranscript: string
): PlacementResult {
  const mcqCorrectCount = PLACEMENT_MCQS.reduce((count, q) => {
    return mcqAnswers[q.id] === q.correctOptionId ? count + 1 : count;
  }, 0);
  const mcqPoints = mcqCorrectCount * 30;

  const cleaned = speakingTranscript.trim().toLowerCase();
  const words = cleaned ? cleaned.split(/\s+/).filter(Boolean) : [];
  const wordScore = Math.min(20, words.length * 2);
  const keywordHits = PLACEMENT_SPEAKING_KEYWORDS.filter((kw) =>
    cleaned.includes(kw)
  ).length;
  const keywordScore = Math.min(20, keywordHits * 5);
  const totalScore = Math.min(100, mcqPoints + wordScore + keywordScore);

  if (totalScore >= 75) {
    return {
      level: "Senior",
      score: totalScore,
      recommendedScenarioId: "client-meeting",
      summaryVI:
        "Bạn có nền tảng từ vựng kỹ thuật và phản xạ giao tiếp tốt. Hãy bắt đầu với các tình huống thuyết trình & làm việc cùng khách hàng.",
      completedAt: new Date().toISOString(),
    };
  }

  if (totalScore >= 45) {
    return {
      level: "Junior",
      score: totalScore,
      recommendedScenarioId: "code-review",
      summaryVI:
        "Bạn đã nắm được mẫu câu công việc cơ bản. Hãy luyện sâu hơn về mô tả lỗi kỹ thuật và trao đổi Code Review.",
      completedAt: new Date().toISOString(),
    };
  }

  return {
    level: "Fresher",
    score: totalScore,
    recommendedScenarioId: "daily-standup",
    summaryVI:
      "Bạn nên bắt đầu từ các tình huống nền tảng như Daily Standup và Phỏng vấn Fresher để xây phản xạ tự tin.",
    completedAt: new Date().toISOString(),
  };
}

export function getSavedPlacementResult(): PlacementResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PLACEMENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlacementResult;
    if (
      parsed &&
      (parsed.level === "Fresher" || parsed.level === "Junior" || parsed.level === "Senior")
    ) {
      return parsed;
    }
  } catch {
  }
  return null;
}

export function savePlacementResult(result: PlacementResult): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PLACEMENT_STORAGE_KEY, JSON.stringify(result));
    window.dispatchEvent(new Event(PLACEMENT_UPDATED_EVENT));
  } catch {
  }
}

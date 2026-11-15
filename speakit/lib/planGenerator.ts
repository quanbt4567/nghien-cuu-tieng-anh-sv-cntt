import { ScenarioId, WeakPoint, PracticeAttempt } from "./types";
import { SCENARIOS } from "../data/scenarios";

export interface PlanDay {
  dayNumber: number;
  dayLabel: string;
  scenarioId: ScenarioId;
  scenarioTitleVI: string;
  focusKeywords: string[];
  grammarFocusVI?: string;
  isCompleted: boolean;
  priorityNoteVI?: string;
}

export function isValidKeywordTerm(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 40) return false;
  if (/[.!?]/.test(trimmed)) return false;
  return trimmed.split(/\s+/).length <= 4;
}

export function generate7DayPlan(
  weakPoints: WeakPoint[],
  attempts: PracticeAttempt[]
): PlanDay[] {
  const weakKeywords = weakPoints
    .filter((w) => w.kind === "keyword" && isValidKeywordTerm(w.value))
    .map((w) => w.value.trim());

  const weakGrammar = weakPoints
    .filter((w) => w.kind === "grammar")
    .map((w) => w.value);

  // Group attempts by scenario to check completed days
  const attemptedScenarios = new Set(attempts.map((a) => a.scenario));

  const planSequence: Array<{ dayNumber: number; scenarioId: ScenarioId }> = [
    { dayNumber: 1, scenarioId: "daily-standup" },
    { dayNumber: 2, scenarioId: "bug-report" },
    { dayNumber: 3, scenarioId: "code-review" },
    { dayNumber: 4, scenarioId: "fresher-interview" },
    { dayNumber: 5, scenarioId: "client-meeting" },
    { dayNumber: 6, scenarioId: "tech-demo" },
    { dayNumber: 7, scenarioId: "daily-standup" }, // Repetition of core standup
  ];

  return planSequence.map(({ dayNumber, scenarioId }) => {
    const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;
    const isCompleted = attemptedScenarios.has(scenarioId);

    // Pick top weak keywords relevant or prioritized
    const dayWeakKeywords = weakKeywords.slice((dayNumber - 1) * 2, dayNumber * 2);
    const focusKeywords =
      dayWeakKeywords.length > 0
        ? dayWeakKeywords
        : scenario.turns[0].keywords.slice(0, 3);

    const hasCustomPriority = dayWeakKeywords.length > 0;

    return {
      dayNumber,
      dayLabel: `Ngày ${dayNumber}`,
      scenarioId,
      scenarioTitleVI: scenario.titleVI,
      focusKeywords,
      grammarFocusVI:
        weakGrammar[dayNumber - 1] ||
        "Luyện phát âm dứt khoát âm đuôi và dùng cấu trúc câu chủ động.",
      isCompleted,
      priorityNoteVI: hasCustomPriority
        ? "Ưu tiên ôn tập từ khóa bạn đã từng bỏ sót"
        : undefined,
    };
  });
}


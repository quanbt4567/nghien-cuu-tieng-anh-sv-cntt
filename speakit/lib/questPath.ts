import type { GamificationState } from "./types";

export const QUEST_CLAIMED_STORAGE_KEY = "speakit_claimed_quests_v1";

export interface QuestProgressInput {
  gamification: GamificationState;
  hasPlacement: boolean;
  masteredVocabCount: number;
  attemptScenarios?: string[];
  attemptDates?: string[];
  todayIso?: string;
}

export interface StoryNodeDefinition {
  id: string;
  order: number;
  title: string;
  subtitle: string;
  durationLabel: string;
  href: string;
  isCompleted: (ctx: ComputedProgressStats) => boolean;
}

export interface StoryChapterDefinition {
  id: string;
  chapterNumber: number;
  title: string;
  subtitle: string;
  rewardCoins: number;
  achievementTitle: string;
  nodes: StoryNodeDefinition[];
}

export interface DailyQuestDefinition {
  id: string;
  title: string;
  href: string;
  rewardCoins: number;
  target: number;
  getCurrent: (ctx: ComputedProgressStats) => number;
}

export interface ComputedProgressStats {
  totalPoints: number;
  streakDays: number;
  hasPlacement: boolean;
  masteredVocabCount: number;
  scenariosDoneCount: number;
  scenarioIds: Set<string>;
  speakingTurnsCount: number;
  arenaRunsCount: number;
  todaySpeakingCount: number;
  todayArenaCount: number;
}

function getLocalIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function computeQuestStats(input: QuestProgressInput): ComputedProgressStats {
  const today = input.todayIso ?? getLocalIsoDate();
  const history = Array.isArray(input.gamification.history)
    ? input.gamification.history
    : [];

  const scenarioIds = new Set<string>(
    (input.attemptScenarios ?? []).filter(
      (s): s is string => typeof s === "string" && s.length > 0
    )
  );
  const attemptDates = input.attemptDates ?? [];
  const speakingTurnsCount = attemptDates.length;
  const todaySpeakingCount = attemptDates.filter(
    (d) => typeof d === "string" && d.startsWith(today)
  ).length;
  const arenaRunsCount = history.length;
  const todayArenaCount = history.filter(
    (entry) =>
      typeof entry.createdAt === "string" && entry.createdAt.startsWith(today)
  ).length;

  return {
    totalPoints: Math.max(0, input.gamification.totalPoints || 0),
    streakDays: Math.max(0, input.gamification.streakDays || 0),
    hasPlacement: input.hasPlacement,
    masteredVocabCount: Math.max(0, input.masteredVocabCount),
    scenariosDoneCount: scenarioIds.size,
    scenarioIds,
    speakingTurnsCount,
    arenaRunsCount,
    todaySpeakingCount,
    todayArenaCount,
  };
}

export const STORY_CHAPTERS: StoryChapterDefinition[] = [
  {
    id: "chapter-1",
    chapterNumber: 1,
    title: "Ngày đầu Onboarding (Fresher)",
    subtitle: "Xác định trình độ, làm quen Daily Standup và từ vựng cốt lõi.",
    rewardCoins: 3,
    achievementTitle: "Fresher Sẵn Sàng",
    nodes: [
      {
        id: "c1-placement",
        order: 1,
        title: "Kiểm tra trình độ đầu vào",
        subtitle: "Làm bài test nhanh để hệ thống gợi ý bài phù hợp",
        durationLabel: "2 phút",
        href: "/placement",
        isCompleted: (s) => s.hasPlacement || s.speakingTurnsCount >= 1,
      },
      {
        id: "c1-standup",
        order: 2,
        title: "Daily Standup đầu tiên",
        subtitle: "Tập báo cáo tiến độ công việc hằng ngày bằng tiếng Anh",
        durationLabel: "3 phút",
        href: "/practice/daily-standup",
        isCompleted: (s) =>
          s.scenarioIds.has("daily-standup") || s.scenariosDoneCount >= 1,
      },
      {
        id: "c1-vocab",
        order: 3,
        title: "Nạp từ vựng IT cốt lõi",
        subtitle: "Đánh dấu thuộc tối thiểu 3 thuật ngữ thường gặp khi đi làm",
        durationLabel: "3 phút",
        href: "/vocabulary",
        isCompleted: (s) => s.masteredVocabCount >= 3 || s.speakingTurnsCount >= 2,
      },
    ],
  },
  {
    id: "chapter-2",
    chapterNumber: 2,
    title: "Thực chiến Sprint (Junior Dev)",
    subtitle: "Báo cáo lỗi, phản biện Code Review và thi đấu phản xạ.",
    rewardCoins: 5,
    achievementTitle: "Sprint Runner",
    nodes: [
      {
        id: "c2-bug",
        order: 4,
        title: "Báo cáo Bug rõ ràng",
        subtitle: "Mô tả nguyên nhân và cách tái hiện lỗi cho team",
        durationLabel: "3 phút",
        href: "/practice/bug-report",
        isCompleted: (s) =>
          s.scenarioIds.has("bug-report") || s.scenariosDoneCount >= 2,
      },
      {
        id: "c2-review",
        order: 5,
        title: "Phản biện Code Review",
        subtitle: "Trao đổi góp ý code lịch sự và đúng thuật ngữ kỹ thuật",
        durationLabel: "3 phút",
        href: "/practice/code-review",
        isCompleted: (s) =>
          s.scenarioIds.has("code-review") || s.speakingTurnsCount >= 4,
      },
      {
        id: "c2-arena",
        order: 6,
        title: "Thử sức Đấu trường Arena",
        subtitle: "Hoàn thành ít nhất 1 vòng chơi phản xạ để kiếm IT-Coin",
        durationLabel: "2 phút",
        href: "/arena",
        isCompleted: (s) => s.arenaRunsCount >= 1,
      },
    ],
  },
  {
    id: "chapter-3",
    chapterNumber: 3,
    title: "Sự cố & Phỏng vấn (Tech Lead)",
    subtitle: "Làm chủ tình huống áp lực cao và phỏng vấn kỹ thuật.",
    rewardCoins: 8,
    achievementTitle: "Tech Lead Giao Tiếp",
    nodes: [
      {
        id: "c3-outage",
        order: 7,
        title: "Trực chiến Outage At 3AM",
        subtitle: "Phối hợp xử lý sự cố production khẩn cấp trong Arena",
        durationLabel: "3 phút",
        href: "/arena/party",
        isCompleted: (s) => s.arenaRunsCount >= 2 || s.totalPoints >= 1500,
      },
      {
        id: "c3-interview",
        order: 8,
        title: "Phỏng vấn Kỹ thuật",
        subtitle: "Trả lời câu hỏi kiến trúc & kinh nghiệm dự án thực tế",
        durationLabel: "4 phút",
        href: "/practice/technical-interview",
        isCompleted: (s) => s.speakingTurnsCount >= 7 || s.totalPoints >= 2500,
      },
      {
        id: "c3-progress",
        order: 9,
        title: "Giữ chuỗi & Tổng kết 7 ngày",
        subtitle: "Duy trì chuỗi luyện nói >= 2 ngày và xem điểm yếu cần vá",
        durationLabel: "2 phút",
        href: "/progress",
        isCompleted: (s) => s.streakDays >= 2 || s.totalPoints >= 3000,
      },
    ],
  },
];

export const DAILY_QUESTS: DailyQuestDefinition[] = [
  {
    id: "daily-speak",
    title: "Nói 1 lượt tình huống hôm nay",
    href: "/scenarios",
    rewardCoins: 1,
    target: 1,
    getCurrent: (s) => Math.min(1, s.todaySpeakingCount),
  },
  {
    id: "daily-vocab",
    title: "Thuộc 3 từ vựng IT trong kho từ",
    href: "/vocabulary",
    rewardCoins: 1,
    target: 3,
    getCurrent: (s) => Math.min(3, s.masteredVocabCount),
  },
  {
    id: "daily-arena",
    title: "Chơi 1 trận Đấu trường Arena hôm nay",
    href: "/arena",
    rewardCoins: 2,
    target: 1,
    getCurrent: (s) => Math.min(1, s.todayArenaCount),
  },
];

export function readClaimedQuestIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUEST_CLAIMED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function saveClaimedQuestIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(QUEST_CLAIMED_STORAGE_KEY, JSON.stringify(ids));
  } catch {}
}

export type CoreScenarioId =
  | "daily-standup"
  | "bug-report"
  | "code-review"
  | "fresher-interview"
  | "client-meeting"
  | "tech-demo";

export type ScenarioId = CoreScenarioId | (string & {});

export interface ScenarioTurn {
  turnIndex: number; // 0, 1, 2
  questionEN: string;
  keywords: string[];
  sampleAnswerEN: string;
  hintVI: string;
}

export interface Scenario {
  id: ScenarioId;
  titleEN: string;
  titleVI: string;
  roleVI: string;
  descriptionVI: string;
  turns: ScenarioTurn[];
  isHidden?: boolean;
  isCustom?: boolean;
  targetRoles?: ITRole[];
}

export interface VocabularyItem {
  id: string;
  term: string;
  phonetic: string;
  partOfSpeech: string;
  meaningVI: string;
  exampleSentenceEN: string;
  exampleTranslationVI: string;
}

export interface GrammarCorrection {
  original: string;
  corrected: string;
  explanationVI: string;
}

export type AiProviderId =
  | "cerebras"
  | "inception"
  | "groq"
  | "xkiro"
  | "openrouter"
  | "gemini";

export type ScoringProvider = AiProviderId | "local";

export interface AiProviderSpec {
  id: AiProviderId;
  label: string;
  envVar: string;
  priority: number;
}

export const AI_PROVIDER_SPECS: readonly AiProviderSpec[] = [
  { id: "cerebras", label: "Cerebras", envVar: "CEREBRAS_API_KEY", priority: 1 },
  { id: "inception", label: "Inception Labs", envVar: "INCEPTION_API_KEY", priority: 2 },
  { id: "groq", label: "Groq", envVar: "GROQ_API_KEY", priority: 3 },
  { id: "xkiro", label: "xKiro", envVar: "XKIRO_API_KEY", priority: 4 },
  { id: "openrouter", label: "OpenRouter", envVar: "OPENROUTER_API_KEY", priority: 5 },
  { id: "gemini", label: "Gemini", envVar: "GEMINI_API_KEY", priority: 6 },
];

export interface ScoreResponse {
  score: number; // 0 - 100
  keywordsUsed: string[];
  keywordsMissed: string[];
  grammarCorrections: GrammarCorrection[];
  betterSentence: string;
  pronunciationNote: string;
  nextQuestion?: string;
  evaluationMode: "ai" | "local_rules";
  provider?: ScoringProvider;
}

export interface ScoreRequestPayload {
  transcript: string;
  scenario: ScenarioId;
  turnIndex: number;
  expectedKeywords: string[];
  history?: Array<{ role: "assistant" | "user"; content: string }>;
}

export interface PracticeAttempt {
  id: string;
  scenario: ScenarioId;
  turn_index: number;
  transcript: string;
  score: number;
  keywords_used: string[];
  role?: string | null;
  created_at: string;
}

export type WeakPointKind = "keyword" | "grammar";

export interface WeakPoint {
  id: string;
  kind: WeakPointKind;
  value: string;
  miss_count: number;
  updated_at: string;
}

export interface UserSettings {
  speechRate: 0.8 | 1.0 | 1.2;
  autoPlayAudio: boolean;
}

export interface StorageAdapter {
  saveAttempt(attempt: Omit<PracticeAttempt, "id" | "created_at">): Promise<PracticeAttempt>;
  getAttempts(scenario?: ScenarioId): Promise<PracticeAttempt[]>;
  recordWeakPoints(missedKeywords: string[], grammarIssues: string[]): Promise<void>;
  getWeakPoints(limit?: number): Promise<WeakPoint[]>;
  getSettings(): UserSettings;
  saveSettings(settings: Partial<UserSettings>): void;
  resetAll(): Promise<void>;
}

export type IStorageAdapter = StorageAdapter;

export type ITRole = "frontend" | "backend" | "qa" | "devops";

export type DevTitle =
  | "Junior Speaker"
  | "Mid-level Communicator"
  | "Lead Tech Speaker";

export type MinigameId = "bug-buster" | "standup-speed-run";

export interface GameScoreEntry {
  id: string;
  gameId: MinigameId;
  score: number;
  accuracyOrWords: number;
  durationSec: number;
  role: ITRole;
  createdAt: string;
}

export interface GamificationState {
  totalPoints: number;
  streakDays: number;
  lastPracticeDate: string | null;
  selectedRole: ITRole;
  personalBests: Record<MinigameId, number>;
  history: GameScoreEntry[];
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

export interface ArenaRunRecord {
  id: string;
  game_id: MinigameId | string;
  score: number;
  accuracy_or_words: number;
  duration_sec: number;
  role: string | null;
  created_at: string;
}

export interface AdminContentOverrides {
  customScenarios: Scenario[];
  hiddenScenarioIds: string[];
  customVocabulary: VocabularyItem[];
  deletedVocabIds: string[];
  customBugChallenges: BugBusterChallenge[];
  deletedChallengeIds: string[];
}



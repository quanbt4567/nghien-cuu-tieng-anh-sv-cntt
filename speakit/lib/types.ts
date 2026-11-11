export type ScenarioId =
  | "daily-standup"
  | "bug-report"
  | "code-review"
  | "fresher-interview"
  | "client-meeting"
  | "tech-demo";

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
  turns: [ScenarioTurn, ScenarioTurn, ScenarioTurn];
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

export interface ScoreResponse {
  score: number; // 0 - 100
  keywordsUsed: string[];
  keywordsMissed: string[];
  grammarCorrections: GrammarCorrection[];
  betterSentence: string;
  pronunciationNote: string;
  nextQuestion?: string;
  evaluationMode: "ai" | "local_rules";
}

export interface ScoreRequestPayload {
  transcript: string;
  scenario: ScenarioId;
  turnIndex: number;
  expectedKeywords: string[];
  history?: Array<{ role: "assistant" | "user"; content: string }>;
  apiKey?: string;
}

export interface PracticeAttempt {
  id: string;
  scenario: ScenarioId;
  turn_index: number;
  transcript: string;
  score: number;
  keywords_used: string[];
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
  geminiApiKey: string;
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



# Data Model: SpeakIT

**Feature**: `001-workplace-speaking-practice`  
**Date**: 2026-11-11  
**Status**: Completed  

---

## 1. Domain Entities & TypeScript Definitions

```typescript
// --- Scenarios & Turns ---
export type ScenarioId =
  | 'daily-standup'
  | 'bug-report'
  | 'code-review'
  | 'fresher-interview'
  | 'client-meeting'
  | 'tech-demo';

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
  descriptionVI: string;
  turns: [ScenarioTurn, ScenarioTurn, ScenarioTurn]; // exactly 3 turns
}

// --- Vocabulary ---
export interface VocabularyItem {
  id: string;
  term: string;
  phonetic: string;
  partOfSpeech: string;
  meaningVI: string;
  exampleSentenceEN: string;
  exampleTranslationVI: string;
}

// --- Evaluation & Scoring ---
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
  pronunciationNote: string; // explicitly notes "estimated from transcript"
  nextQuestion?: string; // contextual follow-up or next turn question
  evaluationMode: 'ai' | 'local_rules';
}

// --- Persistence Records ---
export interface PracticeAttempt {
  id: string;
  scenario: ScenarioId;
  turn_index: number;
  transcript: string;
  score: number;
  keywords_used: string[];
  created_at: string; // ISO 8601
}

export type WeakPointKind = 'keyword' | 'grammar';

export interface WeakPoint {
  id: string;
  kind: WeakPointKind;
  value: string;
  miss_count: number;
  updated_at: string; // ISO 8601
}

// --- Settings ---
export interface UserSettings {
  geminiApiKey: string;
  speechRate: 0.8 | 1.0 | 1.2;
  autoPlayAudio: boolean;
  theme: 'system' | 'light' | 'dark';
}
```

---

## 2. Supabase SQL Schema (`supabase/schema.sql`)

```sql
-- SpeakIT Prototype Database Schema
-- Prototype Scope: Open student access, no authentication, anonymous RLS.

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Attempts Table: Tracks every practice turn submitted
create table if not exists public.attempts (
    id uuid primary key default uuid_generate_v4(),
    scenario text not null,
    turn_index integer not null check (turn_index between 0 and 2),
    transcript text not null,
    score integer not null check (score between 0 and 100),
    keywords_used text[] not null default '{}',
    created_at timestamp with time zone default now()
);

-- Index for analytics and streak calculation
create index if not exists idx_attempts_scenario on public.attempts(scenario);
create index if not exists idx_attempts_created_at on public.attempts(created_at desc);

-- 2. Weak Points Table: Aggregates recurring missed keywords and grammar difficulties
create table if not exists public.weak_points (
    id uuid primary key default uuid_generate_v4(),
    kind text not null check (kind in ('keyword', 'grammar')),
    value text not null,
    miss_count integer not null default 1 check (miss_count >= 0),
    updated_at timestamp with time zone default now(),
    constraint uq_weak_points_kind_value unique (kind, value)
);

create index if not exists idx_weak_points_miss_count on public.weak_points(miss_count desc);

-- Row Level Security (RLS) Configuration:
-- Constitution Principle IV: No login, no auth. Prototype allows public insert & select.
alter table public.attempts enable row level security;
alter table public.weak_points enable row level security;

create policy "Allow public read access to attempts"
    on public.attempts for select
    using (true);

create policy "Allow public insert access to attempts"
    on public.attempts for insert
    with check (true);

create policy "Allow public read access to weak_points"
    on public.weak_points for select
    using (true);

create policy "Allow public insert and update access to weak_points"
    on public.weak_points for all
    using (true)
    with check (true);
```

---

## 3. Storage Fallback & Local Storage Schema

When Supabase is unconfigured (`NEXT_PUBLIC_SUPABASE_URL` is empty or unreachable):
- **Attempts Key**: `speakit_attempts_v1` $\rightarrow$ `PracticeAttempt[]`
- **Weak Points Key**: `speakit_weakpoints_v1` $\rightarrow$ `WeakPoint[]`
- **Settings Key**: `speakit_settings_v1` $\rightarrow$ `UserSettings`
- **Gemini Key Key**: `speakit_gemini_key` $\rightarrow$ raw string (isolated, never bundled into attempts)

---

## 4. State Transitions

```
[Idle / Turn Selected]
       │
       ▼
[Audio Prompt Plays (TTS)]
       │
       ├──(Mic Clicked)──────► [Listening State (Animated Wave)]
       │                                │
       │                        (Speech End / Mic Stop)
       │                                ▼
       │                        [Transcript Populated]
       │
       └──(Mic Denied / Fallback)──► [Typed Input Active]
                                        │
                                (Text Entered)
                                        ▼
                                [Response Ready]
                                        │
                                (Submit Answer)
                                        ▼
                            [Evaluating / Scoring]
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
            (AI Key Present)                        (No Key / Offline)
          [Call Gemini 1.5/2.0]                    [Local Regex Engine]
                    │                                       │
                    └───────────────────┬───────────────────┘
                                        ▼
                            [Score & Feedback Rendered]
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
             (Turn < 2)                                (Turn == 2)
       [Advance to Next Turn]                  [Scenario Complete Summary]
                                                            │
                                                            ▼
                                                [Update 7-Day Plan & Stats]
```


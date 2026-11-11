# Implementation Plan: Workplace English Speaking Practice (SpeakIT)

**Branch**: `001-workplace-speaking-practice` | **Date**: 2026-11-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-workplace-speaking-practice/spec.md`

---

## Summary

SpeakIT is a focused, zero-friction web application designed to help Vietnamese IT students and junior developers practice authentic workplace English speaking. The system provides 6 realistic workplace scenarios (3 turns each, 18 turns total), a 12-term IT vocabulary drill module, and an adaptive 7-day study plan. 

Technical delivery uses **Next.js 14+ (App Router)** with **TypeScript** and **Tailwind CSS**, deployed on **Vercel**. The user interface adheres strictly to **locked physical-paper design tokens**: warm paper background (`#FAF6EF`), ink text and crisp outlines (`#1A1714`), exactly ONE recording-red accent (`#E5484D`), typography driven by **`Be Vietnam Pro`** (display and body, full Vietnamese diacritics support) and **`JetBrains Mono`** (numeric scores, code terms, and badges), 16px cards (`rounded-2xl`), pill buttons (`rounded-full`), and exactly ONE signature hard offset shadow (`4px 4px 0 #1A1714`). Generic AI tropes (purple/blue gradients, glow, glassmorphism, sparkle pills, emoji icons, centered hero + 3-column feature grids) are strictly forbidden.

Speech input leverages the browser's native **Web Speech API (`SpeechRecognition`)** with an automatic **typed-text fallback** when microphone access is denied. Speech output uses **`speechSynthesis`** with selectable playback speeds (0.8x, 1.0x, 1.2x). Intelligent evaluation operates through a **hybrid scoring engine** (`/api/score`): when a user provides a Google Gemini API key on `/settings`, the system delivers context-aware grammar feedback, natural sentence upgrades, and dynamic conversational follow-up questions; when no key is set or offline, it gracefully degrades to deterministic **local keyword scoring** accompanied by an `"AI mode off"` banner. Persistence targets **Supabase (PostgreSQL)** with an automatic, zero-crash fallback to **`localStorage`**.

---

## Technical Context

**Language/Version**: TypeScript 5.0+, Node.js 18+ (verified on Node 22.19.0).  
**Primary Dependencies**: Next.js 14+ (App Router), React 18/19, Tailwind CSS, Lucide React (zero decorative animation libraries).  
**Design Identity & Tokens**:
- Background: Warm paper `#FAF6EF`
- Text / Borders: Ink `#1A1714`
- Accent: Exactly ONE recording-red `#E5484D`
- Typography: `Be Vietnam Pro` (display + body) + `JetBrains Mono` (numbers, keywords, code labels)
- Geometry: `16px` rounded cards (`rounded-2xl`), pill buttons (`rounded-full`), single hard offset shadow `4px 4px 0 #1A1714` (brutalist, zero blur)
- Strictly Forbidden: Purple/blue gradients (including `#4F46E5`), glow, glassmorphism, gradient text, sparkle/AI badge pills, emoji icons, centered hero + 3-column feature grids
**AI Service**: Google Gemini API (`gemini-1.5-flash` / `gemini-2.0-flash`), key stored client-side in `localStorage` / `.env.local`.  
**Storage**: Dual-layer adapter: Supabase (`attempts`, `weak_points`) with automatic transparent fallback to `localStorage`.  
**Testing & Quality**: TypeScript strict type checking (`npm run build` with zero errors), ESLint, unit/contract verification for scoring logic.  
**Target Platform**: Modern desktop and mobile web browsers (Google Chrome, Microsoft Edge, Safari).  
**Project Type**: Full-stack web application (Next.js App Router).  
**Performance Goals**: < 100ms local scoring response, < 3s Gemini streaming/JSON response, 60fps mic wave animation.  
**Constraints**: Zero user login, zero paywalls, zero hardcoded secrets, full resilience when external APIs or mic permissions fail.  
**Scale/Scope**: 6 scenarios × 3 turns = 18 turns, 12 vocabulary terms, 5 primary routes (`/`, `/practice/[scenario]`, `/vocabulary`, `/progress`, `/settings`).

---

## Constitution Check

*GATE: Verified against `.specify/memory/constitution.md` (v1.1.0)*

| Principle | Compliance Strategy | Status |
| :--- | :--- | :---: |
| **I. No Fake Data** | Landing page quotes verified EF EPI 2025 numbers only: Vietnam 500, rank 64/123, rank 7/25 Asia, Speaking 461 weakest skill (adults 18+ nationwide). Strictly no claims that "IUH students score 500" and no fabricated job criteria. | **PASS** |
| **II. Zero Secrets in Code** | Gemini API key is entered solely by user on `/settings` and stored in `localStorage` or `.env.local`. Never hardcoded, never sent to Supabase, never committed. | **PASS** |
| **III. Demo Must Survive Failure** | Missing Gemini key $\rightarrow$ deterministic local keyword scoring + `"AI mode off"` banner. Microphone denied $\rightarrow$ automatic inline text input fallback. Supabase disconnected $\rightarrow$ automatic `localStorage` persistence. | **PASS** |
| **IV. Frictionless Access** | Zero user registration, no login gates, no session tokens, no paywalls. Instant 1-tap practice access. | **PASS** |
| **V. Honest AI Claims** | Pronunciation feedback is explicitly labeled as *"đánh giá phát âm ước lượng từ văn bản"* (estimated from transcript). Keyword scoring is disclosed as local rule-based matching where applicable. Zero sparkle badges or fake phoneme scores. | **PASS** |
| **VI. Locked Design Tokens** | Warm paper background `#FAF6EF`, ink text `#1A1714`, ONE recording-red accent `#E5484D`, `Be Vietnam Pro` (display + body) + `JetBrains Mono`, 16px cards, pill buttons, one hard offset shadow `4px 4px 0 #1A1714`. Strictly forbidden list fully enforced. | **PASS** |
| **VII. Actionable Vietnamese Errors** | 100% of error states, empty states, and toast messages are presented in natural, helpful Vietnamese with clear recovery instructions. Zero raw unhandled crashes. | **PASS** |
| **VIII. Ponytail Discipline** | Minimal code that works: climb 7-rung ladder, stop at first rung. Never cut validation, error handling, security, or accessibility. Report what was deliberately not built after each task. | **PASS** |

---

## Project Structure

### Documentation (this feature)

```text
specs/001-workplace-speaking-practice/
├── plan.md              # Implementation technical plan
├── research.md          # Architecture & technical choices
├── data-model.md        # TypeScript types & Supabase SQL schema
├── quickstart.md        # Runnable verification scenarios
├── contracts/           # API and Storage interface specifications
│   ├── score-api.contract.md
│   └── storage.contract.md
└── checklists/
    └── requirements.md  # Quality validation checklist
```

### Source Code Layout

```text
speakit/
├── app/
│   ├── layout.tsx                     # Root layout (Be Vietnam Pro + JetBrains Mono, warm paper #FAF6EF, ink #1A1714)
│   ├── page.tsx                       # Home (EF EPI 2025 data, 6 scenarios, 7-day plan, 1-tap CTA)
│   ├── practice/
│   │   └── [scenario]/
│   │       └── page.tsx               # Scenario practice (TTS, signature mic, transcript, score, feedback)
│   ├── vocabulary/
│   │   └── page.tsx                   # 12 IT terms drill (pronunciation audio, example sentences)
│   ├── progress/
│   │   └── page.tsx                   # Learning analytics (best scores, total turns, streak, bar chart)
│   ├── settings/
│   │   └── page.tsx                   # Gemini key management, connection test, reset progress
│   └── api/
│       └── score/
│           └── route.ts               # POST /api/score (Gemini evaluation + local fallback)
├── components/
│   ├── ui/                            # Minimal base primitives (Button, Card, Badge, Progress, Toast, Tabs)
│   ├── audio/
│   │   ├── MicButton.tsx              # Signature mic button with recording-red #E5484D pulse animation
│   │   ├── AudioPromptPlayer.tsx      # Speech synthesis controller (0.8x / 1.0x / 1.2x)
│   │   └── FallbackTextInput.tsx      # Automatic typed-text fallback when mic is denied
│   ├── feedback/
│   │   ├── ScoreMeter.tsx             # Hard-shadow score meter (40% keyword, 30% completeness, 30% grammar)
│   │   ├── KeywordBadges.tsx          # Used vs missed keyword pills (JetBrains Mono labels)
│   │   └── AiModeBanner.tsx           # "AI mode off" indicator banner
│   └── layout/
│       ├── Navbar.tsx                 # Minimal paper-styled top navigation
│       └── Footer.tsx                 # Simple attribution & research note
├── data/
│   ├── scenarios.ts                   # 6 scenarios × 3 turns = 18 turns + 12 vocabulary terms
│   └── efEpiData.ts                   # Verified EF EPI 2025 constants
├── lib/
│   ├── gemini.ts                      # Gemini API client with strict JSON schema
│   ├── localScorer.ts                 # Deterministic regex keyword matching & heuristic scoring
│   ├── speech.ts                      # Web Speech API SpeechRecognition & Synthesis wrapper
│   └── storage/
│       ├── types.ts                   # StorageAdapter interface
│       ├── supabaseClient.ts          # Supabase client (optional config)
│       ├── supabaseAdapter.ts         # Attempts & weak_points Supabase operations
│       ├── localStorageAdapter.ts     # Client localStorage fallback implementation
│       └── index.ts                   # Unified resilient storage accessor
├── supabase/
│   └── schema.sql                     # Full SQL DDL with anonymous RLS policies
├── public/                            # Static assets & icons
├── tailwind.config.ts                 # Locked tokens: #FAF6EF, #1A1714, #E5484D, 16px radius, 4px 4px 0 shadow
├── tsconfig.json                      # Strict TypeScript compiler options
└── package.json                       # Next.js 14+, Tailwind, Lucide dependencies
```

---

## Risk Analysis & Mitigation Strategies

| Risk | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **Web Speech API Accuracy** | Accents or background noise may produce imperfect transcripts. | 1. Student can inspect and manually edit the transcript before scoring.<br>2. Automatic fallback to typed input is always one click away.<br>3. Pronunciation guidance explicitly labeled as "estimated from transcript". |
| **Gemini Hallucinations in Scenario** | Model might invent impossible scenario facts or out-of-context questions. | 1. System prompt strictly constrains role-playing context (one question at a time, IT context only).<br>2. Fallback to hardcoded next turn question in `data/scenarios.ts` if model output fails JSON validation. |
| **Supabase Not Configured or Unreachable** | Remote database disconnection could break student demo experience. | 1. Storage layer uses `LocalStorageAdapter` by default whenever credentials are missing or network calls fail.<br>2. Zero blocking error dialogs; data silently and reliably persists in the student's browser. |
| **Secret Leakage via Git or Remote Logs** | Gemini API key exposed in public repository. | 1. `/settings` saves key directly into browser `localStorage`.<br>2. `.env.local` is added to `.gitignore`.<br>3. API route never logs request headers or API tokens. |

---

## Complexity Tracking

No constitutional violations detected. Architecture strictly adheres to minimal, client-first, resilient student prototype design principles and Ponytail discipline (Principle VIII).

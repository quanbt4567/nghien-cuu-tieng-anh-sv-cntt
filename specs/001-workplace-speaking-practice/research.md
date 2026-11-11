# Research & Technical Decisions: SpeakIT

**Feature**: `001-workplace-speaking-practice`  
**Date**: 2026-11-11  
**Status**: Completed  

---

## 1. Architecture & Framework Selection

### Decision
- **Next.js 14+ (App Router)** with **TypeScript** and **Tailwind CSS**, deployed on **Vercel**.
- **Client-First Component Model**: Interactive audio recording, speech synthesis, and state handling run in client components (`'use client'`), while API route handlers (`/api/score`) execute in Edge or Node runtime.

### Rationale
- Next.js App Router provides built-in API routes (`/api/score`), automatic code-splitting, zero-configuration routing (`/`, `/practice/[scenario]`, `/vocabulary`, `/progress`, `/settings`), and instant deployment on Vercel with zero cold-start penalty for static assets.
- TypeScript enforces compile-time safety across scenario turn definitions, evaluation payloads, and storage schemas, satisfying the `npm run build` zero-error requirement.

### Alternatives Considered
- *Vite + React SPA*: Lightweight, but requires manual configuration for serverless API routes or proxying for Gemini calls, complicating local vs. hosted environments.
- *Remix*: Excellent framework, but Vercel ecosystem alignment and shadcn/ui out-of-the-box integration are fastest with Next.js App Router.

---

## 2. Speech Input & Output Strategy

### Decision
- **Speech Input**: Browser **Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`)** configured for `lang = 'en-US'`.
- **Speech Output**: Browser **`window.speechSynthesis`** configured for `en-US` with configurable playback rate (`0.8x`, `1.0x`, `1.2x`).
- **Resilient Fallback**: Automatic inline text input triggers if:
  1. Browser does not support Web Speech API (e.g., non-Chromium browsers).
  2. Microphone permission is denied or dismissed by the user.
  3. No speech is detected after recording activation.

### Rationale
- Zero-cost, zero-latency speech-to-text without requiring external paid STT APIs or heavy client WASM binaries.
- Speech rate control (0.8x) is critical for Vietnamese IT students with developing listening comprehension.

### Risk & Mitigation
- *Risk*: SpeechRecognition accuracy varies across regional accents and microphone noise.
- *Mitigation*: The UI allows students to view their transcript and edit it (or switch to typed mode) before or during evaluation. Pronunciation feedback is explicitly labeled as "estimated from transcript" per Constitution Principle V.

---

## 3. Dual-Engine Evaluation Architecture (/api/score)

### Decision
- **Hybrid Scoring Formula**:
  $$\text{Final Score} = (0.40 \times \text{Keyword Score}) + (0.30 \times \text{Completeness Score}) + (0.30 \times \text{Grammar Score})$$
- **AI Mode (Gemini API configured)**:
  - Calls Google Gemini API (`gemini-1.5-flash` or `gemini-2.0-flash`) using user's key provided via `/settings` (passed via request header or client-side fetch).
  - Enforces strict JSON schema via system prompt and `response_mime_type: "application/json"`.
  - Generates: grammar corrections with Vietnamese explanations, refined natural workplace sentence, estimated pronunciation note, and adaptive follow-up question.
- **Offline / Zero-Key Mode (No Gemini Key)**:
  - Pure deterministic local rule engine executes in browser/runtime.
  - Matches `expectedKeywords` via regex with word boundaries and stemming.
  - Calculates score based on keyword ratio and transcript length heuristic.
  - Returns hardcoded next turn question from `data/scenarios.ts`.
  - Surfaces persistent `"AI mode off"` banner.

### Rationale
- Complies strictly with Constitution Principles II (No secrets in code), III (Demo must survive failure), and V (Honest AI claims).

---

## 4. Storage & Persistence Strategy (Supabase + localStorage Fallback)

### Decision
- **Dual Persistence Architecture**:
  - Primary target: **Supabase (PostgreSQL)** for persisting `attempts` and `weak_points`.
  - Resilient fallback: **`localStorage`** (`speakit_attempts_v1`, `speakit_weakpoints_v1`, `speakit_settings_v1`).
- **Zero-Config Resilience**:
  - The client attempts Supabase operations if environment variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are provided.
  - If unconfigured, disconnected, or failing, the app transparently stores and reads from `localStorage` without displaying blocking error dialogs.
- **Privacy & Security Guarantee**:
  - Gemini API keys are NEVER sent to Supabase or any remote database. Keys reside solely in the user's `localStorage` (`speakit_gemini_key`) or `.env.local`.
  - No user authentication or login is required (Constitution Principle IV).

---

## 5. Locked Design Tokens & Anti-Generic Identity

### Decision
- **Color Palette**:
  - Background: Warm paper `#FAF6EF`
  - Text & Outlines: Ink `#1A1714`
  - Accent: Exactly ONE recording-red accent `#E5484D` for recording states and primary interactive focus
- **Typography** (with full Vietnamese diacritics support):
  - Primary (Display + Body): `Be Vietnam Pro`
  - Numbers & Code Labels: `JetBrains Mono`
- **Geometry & Tactile Depth**:
  - Cards: `16px` border-radius (`rounded-2xl`), crisp `#1A1714` border
  - Buttons: Pill shape (`rounded-full`)
  - Shadows: Exactly ONE hard offset shadow: `4px 4px 0 #1A1714` (brutalist, zero blur)
- **Strictly Forbidden**: Purple/blue gradients (including `#4F46E5`), glow effects, glassmorphism, gradient text, sparkle/AI badge pills, emoji icons, centered hero + 3-column feature grids.
- **Language & Error Copy**: 100% of feedback explanations, empty states, and error alerts are phrased in natural, empathetic Vietnamese.

---

## 6. Curated Content Architecture (`data/scenarios.ts`)

### Decision
- All 6 scenarios (18 turns total) and 12 IT vocabulary terms are statically defined with strict TypeScript typing in `data/scenarios.ts`.
- Each turn contains:
  - `questionEN`: English question read aloud by TTS.
  - `keywords`: Array of target IT keywords required for full credit.
  - `sampleAnswerEN`: Model workplace response.
  - `hintVI`: Contextual tip in Vietnamese explaining what the turn expects.


<!--
Sync Impact Report:
- Version change: 1.0.0 -> 1.1.0
- List of modified principles:
  - PRINCIPLE_6: VI. Locked Design Tokens (Anti-Generic Restraint - Replaced with locked paper/ink/recording-red tokens, Be Vietnam Pro + JetBrains Mono, 16px cards, pill buttons, hard offset shadow 4px 4px 0 #1A1714, explicit forbidden list)
  - PRINCIPLE_8 (ADDED): VIII. Ponytail Discipline (Lazy Senior Dev Mode - climb 7-rung ladder, write only what task needs, never cut validation/error handling/security/accessibility, list what was deliberately not built)
- Governance: Bumped to v1.1.0 (Minor version bump for expanded governance and locked design system definition)
- Follow-up TODOs: None
-->

# SpeakIT Constitution

## Core Principles

### I. No Fake Data (Strict EF EPI 2025 Fidelity)
All macro benchmark figures referenced anywhere in the application, documentation, UI, or research materials MUST derive exclusively from verified EF EPI 2025 data:
- Vietnam score: 500 points (Moderate Proficiency tier).
- Rankings: Rank 64 of 123 countries/regions worldwide; Rank 7 of 25 in Asia.
- Skill breakdown: Speaking 461 (weakest component), Listening 470, Writing 508, Reading 522.
- Target demographic: Adults aged 18+ nationwide.
- **Strict Prohibitions**: NEVER attribute national scores to specific institutional subgroups (e.g., DO NOT write "IUH students score 500"). NEVER fabricate or hallucinate industry/job English benchmark requirements.

### II. Zero Secrets in Code (Client-Side Key Isolation)
API credentials, including the Google Gemini API key, MUST NEVER be hardcoded, baked into build artifacts, committed to version control, or transmitted to any remote backend or database (e.g., Supabase):
- Keys are supplied solely by the user via a `/settings` configuration view.
- Persistence is restricted strictly to local browser storage (`localStorage`) or a local, uncommitted development environment file (`.env.local`).
- Commits and pull requests must be validated against secret leaks.

### III. Demo Must Survive Failure (Graceful Degradation)
The prototype MUST remain operational and interactive under hostile or degraded execution conditions:
- **Missing or Invalid AI Key**: The application MUST continue to function using deterministic local keyword scoring, accompanied by a clear, non-blocking `"AI mode off"` banner.
- **Hardware / Permission Denials**: If the browser or operating system denies or blocks microphone access, the interface MUST automatically reveal an inline typed-text fallback input so the user can continue uninterrupted.
- **Storage Disconnection**: If Supabase is unconfigured or unreachable, the system MUST seamlessly fall back to `localStorage` without showing blocking error modals.

### IV. Frictionless Access (Zero Auth & Zero Paywall)
SpeakIT is an open student research prototype:
- MUST NOT require user registration, login credentials, session authentication, or personal identifiers.
- MUST NOT implement paywalls, usage gates, or gated access tiers.
- Any visitor must be able to test and experience the prototype immediately upon load.

### V. Honest AI Claims (Transparent Evaluation)
All feedback and evaluation surfaced to the user MUST communicate technical reality honestly without overpromising:
- Pronunciation feedback MUST be labeled as "estimated from transcript" (đánh giá phát âm ước lượng từ văn bản) rather than claiming acoustic, phoneme-level precision.
- Keyword evaluation and scoring MUST be explicitly noted in the UI as local, rule-based matching where applicable.
- The UI MUST avoid deceptive AI hype, sparkle badges, or unverified accuracy badges.

### VI. Locked Design Tokens (Anti-Generic Restraint)
The user interface MUST reject generic AI template bloat and adhere strictly to the project's locked physical-paper design tokens:
- **Color Palette**:
  - Background: Warm paper `#FAF6EF`
  - Text & Outlines: Ink text `#1A1714`
  - Accent: Exactly ONE recording-red accent `#E5484D` (for active recording states and primary interactive focus)
- **Typography** (MUST support full Vietnamese diacritics):
  - Primary (Display + Body): `Be Vietnam Pro`
  - Numbers & Code Labels: `JetBrains Mono`
- **Component Geometry & Tactile Depth**:
  - Cards: `16px` border-radius (`rounded-2xl`), crisp `#1A1714` border
  - Buttons: Pill shape (`rounded-full`)
  - Shadows: Exactly ONE hard offset shadow: `4px 4px 0px #1A1714` (brutalist, zero blur)
- **STRICTLY FORBIDDEN**:
  - Purple or blue gradients (including `#4F46E5` Electric Indigo and all generic tech palette tropes)
  - Glow effects or neon drop-shadows
  - Glassmorphism / backdrop-filter blur containers
  - Gradient text fills
  - Sparkle / AI badge pills
  - Emoji icons (use clean monochrome Lucide icons or raw text)
  - Centered generic hero sections paired with standard 3-column feature grids.

### VII. Actionable Vietnamese Error Handling
Every failure state MUST be captured and communicated empathetically and clearly to the user:
- User-facing error notifications and recovery suggestions MUST be written in clear, concise Vietnamese.
- Silent failures, swallowed exceptions, empty white screens, and unhandled promise/unwrap-style crashes are strictly prohibited.
- Every error message must clarify what happened and how the user can proceed or retry.

### VIII. Ponytail Discipline (Lazy Senior Dev Mode)
Write ONLY what the current task needs; the best code is the code never written:
- Climb the 7-rung ladder and stop at the first rung that holds:
  1. *Does it need to exist?* Skip features, options, and flexibility nobody asked for.
  2. *Already in this codebase?* Use it the way surrounding code does.
  3. *Standard library or platform feature?* Use it.
  4. *An installed dependency?* Use it. Never add a dependency for a few lines.
  5. *Can it be one line a reader gets at a glance?* One line.
  6. *Otherwise:* The minimum code that works.
  7. *Verify:* Non-trivial logic leaves a small test or self-check.
- **Non-Negotiables**: NEVER cut validation at trust boundaries, error handling that prevents data loss, security, or accessibility.
- **Reporting Requirement**: After completing each task or response, state clearly in one or two lines what was deliberately NOT built and any risk the user must know.

## Technical Constraints & Operating Boundaries

- **Client-First Architecture**: Speech synthesis, speech recognition fallbacks, local keyword checks, and state storage prioritize client-side execution to ensure instantaneous responsiveness and minimal operational overhead.
- **Local Persistence Boundary**: User preferences and transient session evaluations are persisted locally within the client session; no tracking or cross-device profiling is permitted.
- **Security Boundaries**: No proxy or middleware may intercept or store user-provided Gemini keys. External requests directly target verified API endpoints using user-supplied tokens.

## Quality Standards & Resilience Verification

- **Microphone Fallback Verification**: Integration tests and manual QA checklists must verify that denial of microphone permissions immediately transitions the input state to the text input fallback.
- **No-Key Verification**: Routine testing must verify full evaluation flow completion with an empty API key state, ensuring the "AI mode off" badge is visible and local scoring executes.
- **Vietnamese Copy Audit**: All UI alerts, modals, fallbacks, and validation messages must pass a localized copy review to guarantee natural, respectful Vietnamese phrasing.

## Governance

This Constitution represents the non-negotiable architectural and ethical baseline for SpeakIT. It supersedes individual implementation preferences, provisional drafts, and external feature proposals.

- **Amendment Procedure**: Any amendment or removal of a core principle requires formal documentation of rationale, consensus among the research team, and an updated semantic version.
- **Versioning Policy**:
  - `MAJOR` bump: Fundamental change, removal, or redefinition of core non-negotiable principles.
  - `MINOR` bump: Addition of new principles, structural sections, or material scope expansions.
  - `PATCH` bump: Wording adjustments, typo fixes, or non-semantic clarifications.
- **Compliance Gates**: All code reviews and prototype demonstrations must be audited against the 8 Core Principles prior to public presentation or milestone sign-off.

**Version**: 1.1.0 | **Ratified**: 2026-11-11 | **Last Amended**: 2026-11-11

# Feature Specification: Workplace English Speaking Practice (SpeakIT)

**Feature Branch**: `001-workplace-speaking-practice`

**Created**: 2026-11-11

**Status**: Draft

**Input**: User description: "Build SpeakIT, a web app that helps Vietnamese IT students practice speaking English in real work situations..."

---

## Overview & Background

Vietnamese IT students and junior developers frequently read technical documentation in English with high comprehension, but struggle to speak in workplace settings such as daily standups, bug triage, code reviews, and stakeholder meetings due to the lack of an immersive, non-judgmental environment.

To motivate learners with authentic context, the landing interface surfaces verified national benchmark findings from **EF EPI 2025**:
- Nationwide average score: **500 points** (Moderate Proficiency tier, adults aged 18+ nationwide).
- National ranking: **Rank 64 out of 123** countries/regions globally, and **Rank 7 out of 25** in Asia.
- Skill discrepancy: **Speaking (461)** is the weakest proficiency area, trailing Listening (470), Writing (508), and Reading (522).
- *Strict Benchmark Policy*: The application presents these numbers strictly as verified nationwide data and never invents job criteria or attributes national averages to specific universities.

The prototype provides immediate, zero-friction access (no registration or login) for students at IUH and BCN club members to practice authentic speaking turns, receive instant feedback, expand workplace vocabulary, and follow an adaptive 7-day reinforcement plan.

---

## Clarifications

### Session 2026-11-11
- Q: How should "estimated from transcript" pronunciation feedback be computed? → A: Rule-based phonetic heuristics on transcript targeting known difficult phonemes for Vietnamese speakers (e.g., final consonants /t/, /s/, /d/, consonant clusters /pr/, /st/, /bl/) in missed keywords.
- Q: What should the localStorage fallback store when Supabase is not configured? → A: Full mirror of Supabase schema: persists `attempts` (`id`, `scenario`, `turn_index`, `transcript`, `score`, `keywords_used`, `created_at`) and aggregated `weak_points` (`kind`, `value`, `miss_count`, `updated_at`) in localStorage keys.
- Q: How should /api/score behave when Gemini returns invalid JSON or times out (>8s)? → A: Seamless fallback to local rule scoring: calculate score via keyword regex, return next predefined turn question, set evaluationMode='local_rules', and display a friendly Vietnamese toast notification.
- Q: What should happen when SpeechRecognition returns an empty transcript (silence or noise)? → A: Keep turn active, display a friendly Vietnamese prompt ("Không nhận diện được giọng nói, vui lòng thử lại hoặc gõ câu trả lời"), and automatically reveal/focus the typed fallback textarea.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Workplace Scenario Audio Prompting (Priority: P1)

As a Vietnamese IT student, I want to select a realistic workplace scenario and hear the AI prompt read aloud, so that I understand what question to answer in context.

**Why this priority**: Hearing the spoken prompt establishes the core simulated conversational environment and models authentic workplace interaction.

**Independent Test**: Can be verified independently by navigating to any of the 6 workplace scenarios, selecting Turn 1, and confirming that the English audio prompt plays clearly while displaying Vietnamese guidance hints.

**Acceptance Scenarios**:
1. **Given** a user is on the scenario selection view, **When** they choose "Daily Standup", **Then** the interface opens Turn 1 ("What did you do yesterday?"), highlights recommended IT keywords, shows a Vietnamese context hint, and speaks the prompt aloud.
2. **Given** a prompt audio is playing, **When** the user clicks "Replay Audio", **Then** the speech synthesis plays the prompt again without resetting session state.
3. **Given** audio playback fails or the device is muted, **Then** the complete English question and Vietnamese hint remain fully readable on screen with clear controls.

---

### User Story 2 - Dual-Mode Input with Resilient Fallback (Priority: P1)

As an IT student, I want to deliver my spoken answer via my microphone, or switch automatically to typed text if the microphone is unavailable, so that I can practice anywhere without friction.

**Why this priority**: Microphone input is the primary practice method, but browser permissions or noisy environments must never block the user from completing their practice session.

**Independent Test**: Can be verified by recording speech to produce a transcript, and separately by blocking microphone permissions to confirm immediate display of the typed-text fallback input.

**Acceptance Scenarios**:
1. **Given** microphone permission is granted, **When** the user activates the primary microphone control, **Then** the system visually animates the active recording state, transcribes speech in real time or immediately upon completion, and populates the response field.
2. **Given** the browser or user denies microphone permission, **When** the user attempts to practice, **Then** the interface immediately transitions to a visible text input box with an informative Vietnamese prompt explaining how to continue by typing.
3. **Given** the user is using the typed fallback, **When** they submit their written response, **Then** the response is evaluated through the exact same scoring and feedback pipeline as spoken input.

---

### User Story 3 - Immediate Multi-Dimensional Feedback (Priority: P1)

As an IT student, I want to immediately see my transcript, a 0–100 score, used and missed IT keywords, grammar corrections, a refined sentence, and a concise Vietnamese explanation, so that I can learn actionable improvements instantly.

**Why this priority**: Immediate, actionable feedback closes the learning loop and builds student confidence right after every utterance.

**Independent Test**: Can be verified by submitting an answer and verifying the evaluation card displays transcript, 0–100 score, keyword badges (used vs. missed), grammar fix, refined sentence, and Vietnamese rationale.

**Acceptance Scenarios**:
1. **Given** an answer has been submitted, **When** evaluation completes, **Then** the user sees:
   - Full transcript of their response.
   - Overall score from 0 to 100.
   - Clear indicators of target IT keywords detected versus missed.
   - Identified grammar improvements with concise explanations in Vietnamese.
   - One recommended "Better Sentence" exemplifying natural workplace communication.
2. **Given** the user inspects pronunciation guidance, **When** feedback is displayed, **Then** the UI clearly labels pronunciation notes as "estimated from transcript" to maintain strict honesty.
3. **Given** no external AI key is configured, **When** an answer is submitted, **Then** the system falls back seamlessly to deterministic local keyword scoring, displays the "AI mode off" banner, and provides rule-based feedback without errors.

---

### User Story 4 - Contextual Multi-Turn Conversation (Priority: P2)

As an IT student, I want the system to dynamically ask follow-up questions tailored to my previous answers across the 3 turns of a scenario, so that the interaction feels like an authentic conversation.

**Why this priority**: Dynamic follow-ups simulate real workplace dialogue where coworkers and interviewers react to prior statements rather than reading a static script.

**Independent Test**: Can be verified by completing Turn 1 of a scenario and confirming that Turn 2 references the user's prior input when AI mode is enabled, while smoothly falling back to the standard turn prompt if AI mode is disabled.

**Acceptance Scenarios**:
1. **Given** AI mode is active and the user submits Turn 1 with specific details (e.g., "I fixed the login authentication bug"), **When** Turn 2 is generated, **Then** the follow-up question acknowledges this context while advancing the scenario goals.
2. **Given** AI mode is disabled (or offline), **When** Turn 1 completes, **Then** the scenario smoothly advances to the predefined Turn 2 question ("What will you do today?") without interruption.
3. **Given** all 3 turns of a scenario are completed, **When** the final answer is evaluated, **Then** a comprehensive scenario summary displays aggregated progress, keyword mastery, and an option to retry or pick a new scenario.

---

### User Story 5 - Adaptive Weak-Point Tracking & 7-Day Plan (Priority: P3)

As an IT student, I want the system to remember my missed keywords and recurring grammar mistakes across sessions, so that my personalized 7-day practice plan prioritizes my weakest areas first.

**Why this priority**: Spaced repetition targeting individual weaknesses accelerates learning retention and keeps students engaged over time.

**Independent Test**: Can be verified by intentionally missing specific keywords in a session, visiting the 7-day study plan, and verifying that missed items are placed at the front of subsequent review days.

**Acceptance Scenarios**:
1. **Given** a user completes a scenario missing keywords (e.g., `blocker`, `pull request`), **When** the practice plan is generated or viewed, **Then** Day 1 and Day 2 prioritize practice turns incorporating those exact missed keywords.
2. **Given** all weak-point tracking is stored client-side or in Supabase, **When** the user closes and reopens the browser, **Then** their historical progress, missed vocabulary, and 7-day schedule persist accurately.
3. **Given** a user wishes to reset their study history, **When** they click "Làm mới tiến độ" (Reset Progress) in settings, **Then** all tracked mistakes are cleared with a confirmation dialog in Vietnamese.

---

### User Story 6 - High-Yield IT Vocabulary Drill (Priority: P2)

As an IT student, I want to drill 12 essential workplace IT terms with audio pronunciation models and contextual example sentences, so that I can use them fluently in conversations.

**Why this priority**: Targeted vocabulary drills give hesitant speakers quick wins and foundational terms required for daily standups, code reviews, and deployments.

**Independent Test**: Can be verified by opening the Vocabulary module, reviewing each of the 12 curated IT terms, playing the audio pronunciation model, and reading the accompanying example sentence and Vietnamese definition.

**Acceptance Scenarios**:
1. **Given** the user navigates to the Vocabulary practice area, **When** the module loads, **Then** exactly 12 essential IT terms are presented: `standup`, `blocker`, `deploy`, `pull request`, `merge conflict`, `bug`, `reproduce`, `severity`, `deadline`, `stakeholder`, `refactor`, `backlog`.
2. **Given** a vocabulary card is selected, **When** the user taps the speaker icon, **Then** clear pronunciation audio plays for that term.
3. **Given** a term is displayed, **When** the user views the card, **Then** the card presents: the term, phonetic guide, part of speech, Vietnamese meaning, and one workplace example sentence highlighting the term in action.

---

### Edge Cases

- **Microphone Access Denied or Revoked**: System immediately reveals the text input fallback without displaying raw browser alert modals or breaking the UI flow.
- **Microphone Hardware Failure / Silence**: When SpeechRecognition returns an empty transcript (due to silence or noise), the system keeps the turn active, prompts the user in Vietnamese ("Không nhận diện được giọng nói, vui lòng thử lại hoặc gõ câu trả lời"), and automatically reveals and focuses the inline typed-text textarea fallback without crashing.
- **Missing or Invalid AI Key**: All core flows continue uninterrupted using client-side rule evaluation, clearly signaling `"AI mode off"` in an unobtrusive top banner.
- **External AI Timeout (>8s) or Invalid JSON**: If an external Gemini API request exceeds 8 seconds or fails to return valid JSON, the system automatically degrades seamlessly to local rule-based keyword scoring, populates static next turn question from `data/scenarios.ts`, sets `evaluationMode='local_rules'`, and informs the user via a friendly Vietnamese toast notification.
- **Rapid Multiple Submissions**: Input controls disable immediately upon submission to prevent duplicate evaluation requests or corrupted multi-turn states.
- **Very Short or Garbled Speech**: Responses with fewer than 2 recognizable words yield encouraging guidance in Vietnamese rather than an unhandled error or a 0 score with empty feedback.

---

## Requirements *(mandatory)*

### Functional Requirements

#### Scenario & Content Management
- **FR-001**: System MUST provide 6 predefined workplace scenarios:
  1. *Daily Standup* (Yesterday's work, Today's plan, Blockers)
  2. *Bug Report* (Bug description, Reproduction steps, Severity & suggestions)
  3. *Code Review* (PR overview, Architectural rationale, Performance critique response)
  4. *Fresher Interview* (Self introduction, Key strength, Company motivation)
  5. *Client Meeting* (Delay explanation, Proposed solution, Revised timeline)
  6. *Tech Demo* (Feature overview, Under-the-hood architecture, Audience Q&A)
- **FR-002**: Every scenario MUST contain exactly 3 sequential turns (18 turns total across the library).
- **FR-003**: Each turn MUST specify: English question (`questionEN`), target technical keywords (`keywords[]`), ideal sample answer (`sampleAnswerEN`), and Vietnamese context hint (`hintVI`).
- **FR-004**: System MUST provide a dedicated Vocabulary module containing exactly 12 IT workplace terms (`standup`, `blocker`, `deploy`, `pull request`, `merge conflict`, `bug`, `reproduce`, `severity`, `deadline`, `stakeholder`, `refactor`, `backlog`) with audio pronunciation and workplace example sentences.

#### Speech & Input Capabilities
- **FR-005**: System MUST play audio for scenario questions and vocabulary terms using standard browser speech synthesis.
- **FR-006**: System MUST capture audio through a prominent, signature microphone button featuring an active listening visual state.
- **FR-007**: System MUST detect when microphone permission is blocked or unavailable and automatically reveal a typed-text fallback input box.
- **FR-008**: System MUST support direct text submission as a first-class input method across all turns.

#### Evaluation & Feedback Engine
- **FR-009**: System MUST evaluate every response and output: transcript text, overall score (0–100), detected keywords, missing keywords, grammar suggestions, one better sentence, and an explanatory rationale in Vietnamese.
- **FR-010**: System MUST execute local rule-based keyword matching in all environments, independently of external AI availability, using regex with word boundary detection and length heuristics.
- **FR-011**: When external AI evaluation is available, system MUST augment local results with contextual grammar critique, natural rephrasing, and dynamic follow-up questioning.
- **FR-012**: When external AI is unavailable, unconfigured, times out (>8s), or returns invalid JSON, system MUST complete evaluation via local rules, return static next turn question from `data/scenarios.ts`, and prominently display an `"AI mode off"` banner.
- **FR-013**: System MUST compute pronunciation guidance using rule-based phonetic heuristics on the transcript (targeting common Vietnamese learner pitfalls including final consonants /t/, /s/, /d/ and clusters /pr/, /st/, /bl/ in missed keywords) and explicitly label the note as "estimated from transcript" (đánh giá phát âm ước lượng từ văn bản).

#### Persistence, Tracking & Adaptivity
- **FR-014**: System MUST persist user settings, completed sessions (`attempts`), and weak-point statistics (`weak_points`) in Supabase (if configured) or via a full schema mirror in browser local storage (`localStorage`).
- **FR-015**: System MUST track missed keywords and recurring grammar difficulties per user session.
- **FR-016**: System MUST generate an adaptive 7-day study plan that dynamically schedules turns containing the student's highest-frequency missed items into early review days.
- **FR-017**: System MUST provide a "Reset Progress" option in Settings that purges all local evaluation records upon user confirmation.

#### Non-Functional & Constitutional Guarantees
- **FR-018**: System MUST NOT include user registration, authentication gates, password forms, or paywalls.
- **FR-019**: System MUST NEVER transmit user API keys to any remote database, proxy, or server-side logging endpoint.
- **FR-020**: System MUST display all error notifications, warnings, empty states, and action prompts in natural, clear Vietnamese.
- **FR-021**: System UI MUST strictly adhere to anti-generic design discipline: exactly ONE accent color, ONE display font, ONE body font, and ONE signature interaction (the listening microphone button).
- **FR-022**: Landing page MUST feature the verified EF EPI 2025 benchmark statistics (Vietnam 500, Rank 64/123, Rank 7/25 Asia, Speaking 461 weakest) without misattributing them to specific universities or inventing job requirements.

---

### Key Entities

- **Scenario**: Represents a workplace context (e.g., Daily Standup). Attributes: identifier, title, description, category, turns array.
- **ScenarioTurn**: A single dialogue exchange within a scenario. Attributes: turn number (1–3), English prompt, audio cue, target keywords, sample answer, Vietnamese hint.
- **EvaluationResult**: The assessment generated after an answer is submitted. Attributes: raw transcript, score (0–100), matched keywords, missed keywords, grammar corrections list, refined alternative sentence, Vietnamese explanation, evaluation mode (`ai` or `local_rules`).
- **VocabularyItem**: An IT workplace term. Attributes: term, phonetic transcription, part of speech, Vietnamese definition, example sentence, audio cue.
- **StudentProgress**: Tracks historical practice and spaced learning state. Attributes: completed session count, scenario completion records, weak keywords frequency map, weak grammar patterns, 7-day adaptive schedule.
- **ApplicationSettings**: Client-side preferences. Attributes: user-provided API key, audio rate/pitch preference, high-contrast toggle.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: **First-Practice Velocity**: A first-time visitor can launch the application, pick a scenario, and begin their first speaking or typing turn within 15 seconds of landing (zero login required).
- **SC-002**: **End-to-End Turn Completion**: 100% of standard practice turns can be completed from question prompt playback through speech recording (or typing) to full feedback display in under 5 seconds on standard broadband/mobile connections.
- **SC-003**: **Zero-Key Resilience**: 100% of core scenario turns and vocabulary exercises remain fully usable when no external API key is provided, successfully producing local keyword scores and displaying the `"AI mode off"` banner.
- **SC-004**: **Fault-Tolerant Input**: In 100% of instances where microphone permissions are denied or unavailable, the typed-text fallback becomes interactive in less than 500 milliseconds without user page refresh.
- **SC-005**: **Benchmark & Data Integrity**: 100% of benchmark citations across the application strictly align with EF EPI 2025 verified figures (Vietnam 500, Rank 64/123, Speaking 461) with zero fictitious institutional claims.
- **SC-006**: **Error Recovery Clarity**: 100% of application error states display an actionable diagnostic message in Vietnamese explaining how to recover.

---

## Assumptions

- **Target Audience**: Vietnamese information technology students and junior developers who have basic reading knowledge of English but lack conversational speaking confidence.
- **Client Execution**: The application runs within modern standard web browsers (Google Chrome, Microsoft Edge, Safari) supporting Web Speech API or typed fallback.
- **Storage Model**: Because this is a research prototype without account infrastructure, student progress persists within the browser's local origin storage.
- **Speech Recognition Scope**: Speech-to-text utilizes available browser speech recognition engines where available, with typed text serving as the ubiquitous zero-dependency fallback.
- **Out of Scope**: Real-time human-to-human audio/video calls, peer chat rooms, user account management, payment processing, administrative management consoles, and automated phone dialing.

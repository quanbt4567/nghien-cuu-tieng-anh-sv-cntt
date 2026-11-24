# SpeakIT Design System & 2-Pass Studio Plan

## 1. Product Identity & Audience
- **Product**: SpeakIT, a voice-first workplace IT English speaking coach.
- **Audience**: Vietnamese CS students and Fresher/Junior software engineers closing the gap between reading English documentation and speaking fluently in Daily Standups, Bug Reports, Code Reviews, Technical Interviews, and Arena drills.
- **Aesthetic Direction**: **Arctic Studio & Ocean Midnight** — a calm, high-legibility frosted glass studio anchored on cool arctic mist in Light Mode and deep ocean-midnight slate in Dark Mode.
- **Motion & Transparency Posture**: Tactile state feedback (`transition-colors`, `transition-transform`, `transition-opacity`), genuine frosted liquid glass translucency (`rgba` + `backdrop-filter` + `inset` specular edge + layered depth shadow), and strict `prefers-reduced-motion` / `prefers-reduced-transparency` fallbacks.

---

## 2. Theme Factory Evaluation (10 Themes -> Custom Studio Synthesis)

All 10 themes in `.agents/skills/theme-factory/themes/` were evaluated against SpeakIT's domain (Vietnamese developer ergonomics, long reading/speaking sessions, semantic red/amber/green telemetry, and light/dark glass translucency):

| Theme | Verdict | Fit & Friction Analysis |
| --- | --- | --- |
| **Arctic Frost** (`#d4e4f7`, `#4a6fa5`, `#fafafa`) | **Synthesized (Light Canvas)** | Crisp cool-white clarity and steel-blue precision fit Vietnamese diacritics and long study sessions without warm glare. |
| **Ocean Depths** (`#1a2332`, `#2d8b8b`, `#a8dadc`, `#f1faee`) | **Synthesized (Dark Base + Secondary Accent)** | Deep maritime navy (`#1a2332` family) calms eye strain during late-night practice; muted teal adds a grounded technical secondary accent. |
| **Tech Innovation** (`#0066ff`, `#00ffff`, `#1e1e1e`, `#ffffff`) | **Synthesized (Primary Cobalt)** | High-contrast cobalt action clarity (`#1D4ED8` / `#2563EB`) anchors primary CTAs; `#00FFFF` neon cyan is intentionally dropped to avoid AI-template glare. |
| **Midnight Galaxy** (`#2b1e3e`, `#4a4e8f`, `#a490c2`, `#e6e6fa`) | **Synthesized (Dark Mesh Depth)** | Cosmic slate-indigo depth informs the subtle ambient radial mesh behind dark glass panels without turning the UI purple-heavy. |
| **Modern Minimalist** (`#36454f`, `#708090`, `#d3d3d3`, `#ffffff`) | Rejected | Too monochrome; lacks clear visual hierarchy between passive content, active mic state, and gamified Arena/Coin feedback. |
| **Forest Canopy** (`#2d4a2b`, `#7d8471`, `#a4ac86`, `#faf9f6`) | Rejected | Organic olive/earth palette fights semantic green success states and feels disconnected from software engineering workflows. |
| **Botanical Garden** (`#4a7c59`, `#f9a620`, `#b7472a`, `#f5f3ed`) | Rejected | Marigold/terracotta editorial tone reads like hospitality or lifestyle rather than an engineering studio. |
| **Sunset Boulevard** (`#e76f51`, `#f4a261`, `#e9c46a`, `#264653`) | Rejected | Warm coral/sand washes compete with SpeakIT's recording-active danger/mic signal (`#DC2626`). |
| **Golden Hour** (`#f4a900`, `#c1666b`, `#d4b896`, `#4a403a`) | Rejected | Heavy autumnal contrast reduces crispness for inline code, IPA transcription, and tabular scoreboards. |
| **Desert Rose** (`#d4a5a5`, `#b87d6d`, `#e8d5c4`, `#5d2e46`) | Rejected | Soft dusty mauve lacks contrast discipline for dense technical tables and rapid-fire Arena controls. |

---

## 3. Custom Studio Theme Color Tokens (WCAG AA Verified)

### Light Mode (`:root`)

| Role | Token | Value | Contrast / Spec |
| --- | --- | --- | --- |
| **Canvas** | `--bg-canvas` | `#F4F8FC` | Cool arctic-mist base with subtle Cobalt/Teal/Sky/Amber ambient mesh |
| **Elevated Glass Card** | `--surface-glass` | `rgba(255, 255, 255, 0.72)` | `blur(18px) saturate(165%)`, border `rgba(148, 163, 184, 0.34)`, `inset 0 1px 0 rgba(255, 255, 255, 0.94)`, shadow `0 12px 30px -12px rgba(15, 23, 42, 0.12)` |
| **Glass Pill / Floating Dock** | `--surface-dock` | `rgba(255, 255, 255, 0.74)` | `blur(20px) saturate(175%)`, border `rgba(148, 163, 184, 0.38)`, `inset 0 1px 0 rgba(255, 255, 255, 0.96)`, shadow `0 14px 34px -10px rgba(15, 23, 42, 0.16)` |
| **Inputs & Controls** | `--surface-input` | `#EEF3F9` | Border `#CBD5E1`; focus `#FFFFFF`, border `#1D4ED8`, ring `rgba(29, 78, 216, 0.22)` |
| **Primary Accent** | `--accent-primary` | `#1D4ED8` | Hover `#1E40AF`; white text `#FFFFFF` achieves **6.7:1** (AA/AAA) |
| **Secondary Ocean Accent** | `--accent-ocean` | `#0F766E` | Inspired by `ocean-depths`; **5.4:1** on white/glass surfaces |
| **Semantic Success** | `--color-success` | `#15803D` | Soft tint `#F0FDF4`, border `#BBF7D0`; **5.1:1** on white |
| **Semantic Warning** | `--color-warning` | `#B45309` | Soft tint `#FFFBEB`, border `#FDE68A`; **5.0:1** on white |
| **Semantic Danger / Mic Live** | `--color-danger` | `#DC2626` | Button fill **4.83:1** with `#FFFFFF`; text `#B91C1C` (**6.5:1**), tint `#FEF2F2` |
| **Text Primary** | `--text-primary` | `#0F172A` | **17.8:1** on `#FFFFFF` / **16.5:1** on `#F4F8FC` |
| **Text Secondary** | `--text-secondary` | `#475569` | **7.1:1** on `#FFFFFF` / **6.5:1** on `#F4F8FC` (passes WCAG AA) |
| **Text Muted / Placeholder** | `--text-muted` | `#526075` | **5.8:1** on `#FFFFFF` (passes WCAG AA) |

### Dark Mode (`html.dark`)

| Role | Token | Value | Contrast / Spec |
| --- | --- | --- | --- |
| **Canvas** | `--bg-canvas` | `#0A111F` | Deep ocean-midnight base with Cobalt/Cosmic-Slate/Teal/Amber ambient mesh |
| **Elevated Glass Card** | `--surface-glass` | `rgba(20, 31, 51, 0.64)` | `blur(18px) saturate(165%)`, border `rgba(255, 255, 255, 0.14)`, `inset 0 1px 0 rgba(255, 255, 255, 0.14)`, shadow `0 16px 36px -12px rgba(2, 6, 23, 0.72)` |
| **Glass Pill / Floating Dock** | `--surface-dock` | `rgba(15, 23, 42, 0.68)` | `blur(20px) saturate(175%)`, border `rgba(255, 255, 255, 0.17)`, `inset 0 1px 0 rgba(255, 255, 255, 0.16)`, shadow `0 16px 38px -10px rgba(2, 6, 23, 0.78)` |
| **Inputs & Controls** | `--surface-input` | `#1E2C45` | Border `rgba(255, 255, 255, 0.16)`; focus `#0F172A`, border `#60A5FA`, ring `rgba(96, 165, 250, 0.30)` |
| **Primary Accent** | `--accent-primary` | `#2563EB` | Hover `#1D4ED8`; interactive text `#60A5FA` achieves **7.4:1** on `#141F33` |
| **Secondary Ocean Accent** | `--accent-ocean` | `#2DD4BF` | Seafoam-teal highlight; **9.8:1** on `#141F33` |
| **Semantic Success** | `--color-success` | `#4ADE80` | Fill `#15803D`, tint `rgba(22, 163, 74, 0.20)`; **9.6:1** on `#141F33` |
| **Semantic Warning** | `--color-warning` | `#FBBF24` | Tint `rgba(245, 158, 11, 0.20)`; **10.1:1** on `#141F33` |
| **Semantic Danger / Mic Live** | `--color-danger` | `#F87171` | Fill `#DC2626`, tint `rgba(239, 68, 68, 0.20)`; **6.4:1** on `#141F33` |
| **Text Primary** | `--text-primary` | `#F8FAFC` | **15.4:1** on `#141F33` / **18.1:1** on `#0A111F` |
| **Text Secondary** | `--text-secondary` | `#CBD5E1` | **10.8:1** on `#141F33` |
| **Text Muted / Placeholder** | `--text-muted` | `#A8B3C2` | **7.3:1** on `#141F33` (passes WCAG AA) |

---

## 4. Intentional Font Pairing & Typography Scale

- **Display (`--font-plus-jakarta`)**: `Plus Jakarta Sans` (`latin`, `vietnamese`, weights `500–800`) — geometric studio voice for `h1`–`h4` headings with `text-wrap: balance` to eliminate orphan words on Vietnamese headlines.
- **Body & UI (`--font-be-vietnam-pro`)**: `Be Vietnam Pro` (`latin`, `vietnamese`, weights `400–700`) — designed specifically for Vietnamese diacritic stacking and clear 14px+ legibility.
- **Technical & Telemetry (`--font-jetbrains-mono`)**: `JetBrains Mono` (`latin`, `vietnamese`, weights `400–600`) — reserved for `DEV-XXXXXX` IDs, IPA/code tokens, and numeric telemetry paired with `font-variant-numeric: tabular-nums`.
- **Measure & Sizing Floor**: Prose blocks constrained to `< 80ch` (`max-w-[68ch]` / `.measure-prose`); body copy and interactive descriptions never drop below `14px` (`text-sm`).

| Role | Font Family | Size / Line-Height | Tracking / Variant |
| --- | --- | --- | --- |
| **Hero H1** | `Plus Jakarta Sans` | `30px–36px` / `1.2` (`leading-tight`) | `-0.02em`, `text-wrap: balance`, weight `700` |
| **Page H1** | `Plus Jakarta Sans` | `24px–30px` / `1.25` | `-0.015em`, `text-wrap: balance`, weight `700` |
| **Section H2** | `Plus Jakarta Sans` | `18px–20px` / `1.35` | `-0.01em`, `text-wrap: balance`, weight `700` |
| **Body Copy** | `Be Vietnam Pro` | `14px–16px` / `1.6` | Normal, `< 72ch` measure |
| **UI Control / Pill** | `Be Vietnam Pro` | `14px` / `1.25` | Weight `600`, explicit `focus-visible` ring |
| **Telemetry / Stats** | `JetBrains Mono` | `12px–16px` / `1.4` | `font-variant-numeric: tabular-nums` |

---

## 5. Frontend-Design 2-Pass Design Plan & Self-Critique

### Pass 1: Initial Architecture, Focal Hero & Page Hierarchies

- **Memorable Focal Hero Treatment (Home `/`)**:
  Instead of a generic centered marketing banner with floating feature badges, the Home hero is an **Asymmetric Studio Launchpad (`7:5` split)** grounded in SpeakIT's core problem: the **EF EPI 2025 Reading-vs-Speaking Gap**. The left column states the Vietnamese developer promise in left-aligned plain language with a single dominant primary CTA (`Bắt đầu luyện nói ngay`) and secondary text link (`Chọn kịch bản trực tiếp`). The right column renders a live, tabular-aligned **Speaking Gap Telemetry Panel** comparing Reading (`Reading`) vs Speaking (`Speaking`) bars in crisp cobalt vs signal coral.
- **Page-by-Page Layout Hierarchy**:
  1. **`/` (Home)**: Asymmetric `7:5` Hero & EF EPI Telemetry -> 3-column horizontal workflow strip (`Nghe`, `Tập nói`, `Shadowing`) -> compact 3-column Top Arena Leaders strip -> 3-column desktop quick-tool launchpad (`2x3` compact grid on mobile).
  2. **`/scenarios`**: Left-aligned header with live scenario count -> horizontal role filter (`Frontend`, `Backend`, `DevOps`, `QA`) and difficulty tabs -> clean scenario grid with Vietnamese helper preview and single launch action.
  3. **`/arena`**: Top Arena status console (IT-Coin progress bar, streak, title pill, role selector) -> 6-mode arena showcase grid (distinguishing live room routes vs inline instant modes) -> inline active game stage directly beneath.
  4. **`/vocabulary`**: 4-mode workspace switcher (`Từ điển & Phát âm`, `Flashcard`, `Quiz 60s`, `Nói Theo Cụm`) -> sticky search + context filter strip -> 3-column IPA/audio vocab grid.
  5. **`/shop`**: Live Try-On Studio preview stage + current IT-Coin balance bar -> category tabs (`Avatar Frame`, `Profile Theme`, `Cursor Trail`, `Leaderboard FX`, `Nameplate`, `Victory Finisher`) -> unlock/equip item grid.
  6. **`/leaderboard`**: Left-aligned header -> Top-3 podium spotlight -> full tabular-numeral ranking table (`#`, avatar + `DEV-XXXXXX`, title, streak, IT-Coin).
  7. **`/profile`**: Zero-Login identity banner (`DEV-XXXXXX` backup transfer code + role editor) -> tabular career stats strip -> equipped cosmetics showcase & recent practice attempt log.
  8. **`/settings`**: Single-column focused settings stack (`max-w-3xl`, `<=68ch` descriptions) covering Voice Persona & Speech Rate live preview, Daily Reminder time picker, and JSON export / local reset danger zone.

### Pass 2: Self-Critique & Anti-Slop Revisions

Reviewing Pass 1 against `frontend-design` anti-template standards surfaced five concrete weaknesses to eliminate across Stage 2 implementation:

1. **Remove decorative ALL-CAPS micro-eyebrows**:
   - *Critique*: Repeated uppercase tracked labels (e.g., `ARENA LIVE STANDINGS`, `BƯỚC 01`, uppercase subtitles on shortcut tiles) add visual noise without aiding comprehension.
   - *Revision*: Keep headings in natural Vietnamese sentence case; use uppercase only for real acronyms (`IT`, `IPA`, `API`, `EF EPI`) and genuine sequential step indices.
2. **Cut repetitive `->` arrows on secondary buttons & cards**:
   - *Critique*: Appending `ArrowRight` to every card footer, shortcut, and secondary link reads as a generated SaaS template.
   - *Revision*: Reserve directional arrows strictly for the primary forward CTA (`Bắt đầu luyện nói ngay`); keep secondary links and cards clean.
3. **Break identical boxed-card monotony**:
   - *Critique*: Wrapping every stat, list item, and empty state in identical rounded bordered glass boxes flattens hierarchy.
   - *Revision*: Reserve `.liquid-glass-card` for primary interactive containers; use `divide-y` / `divide-x` hairlines inside a single shared glass frame for podiums, tables, and checklists, and render empty states as lightweight hairline callouts.
4. **Replace generic filler copy & em dashes**:
   - *Critique*: Vague adjectives and `—` separators clutter Vietnamese developer copy.
   - *Revision*: Use active-voice verbs matching exact outcomes (`Lưu thay đổi`, `Bắt đầu luyện nói`, `Thử giọng đọc`), replace `—` with `:`, `,`, or parentheses, and lead with concrete engineering scenarios (`Daily Standup`, `Bug Report`, `Code Review`).
5. **Enforce Baseline Craft Without Announcing It**:
   - *Revision*: Bake `text-wrap: balance` on headings, `tabular-nums` on all numeric telemetry, `<80ch` prose measure, explicit `focus-visible:ring-2` keyboard indicators on interactive controls, and `@media (prefers-reduced-motion: reduce)` + `@media (prefers-reduced-transparency: reduce)` directly into `globals.css`.

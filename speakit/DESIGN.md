# SpeakIT Design System (UI/UX Pro Max + Anti-Slop)

## Product Identity
- **Product**: SpeakIT — Workplace IT English Speaking Coach for Vietnamese CS Students & Engineers
- **Character**: Crisp Editorial Studio & Focused Practice Workspace. Calm paper canvas in Light Mode, deep architectural slate in Dark Mode. High legibility, zero generic AI neon/cyberpunk/rainbow glassmorphism.
- **Dials**: ENERGY 3 / RHYTHM 3 / MOTION 1 (discrete state & hover transitions only, zero endless loops or layout animations).

## Strict Color Tokens (2 Core + 1 Action Accent)
- **Light Mode (Default)**:
  - Canvas Background: `#F8FAFC` (clean slate paper, zero radial orbs or gradient meshes)
  - Primary Card Surface: `#FFFFFF` with `1px solid #E2E8F0`
  - Subtle Surface / Input: `#F1F5F9` with `1px solid #CBD5E1`
  - Primary Text: `#0F172A`
  - Secondary / Body Text: `#475569` (all body copy minimum `text-sm` / `14px`)
  - Core Brand Color (Cobalt): `#1D4ED8` (hover `#1E40AF`) — crisp solid fill or clean tint `#EFF6FF` / border `#BFDBFE` / text `#1E40AF`
  - Deliberate Action Accent (Signal Coral/Red): `#DC2626` — reserved strictly for Mic active/recording, Outage Party Mode urgent alert, and Destructive actions
  - Semantic Status (functional only, muted): Success `#15803D` (`#F0FDF4`), Warning `#B45309` (`#FFFBEB`), Danger `#B91C1C` (`#FEF2F2`)
- **Dark Mode (`html.dark`)**:
  - Canvas Background: `#0B0F17`
  - Primary Card Surface: `#111827` with `1px solid #1F2937`
  - Subtle Surface / Input: `#1E293B` with `1px solid #334155`
  - Primary Text: `#F8FAFC`
  - Secondary Text: `#CBD5E1`
  - Core Brand Color: `#2563EB` (text `#60A5FA` on dark surfaces)

## Forbidden Patterns (Zero Tolerance)
- **NO** purple, violet, fuchsia, indigo, or neon cyan/teal palettes (`bg-cyan-*`, `bg-violet-*`, `bg-fuchsia-*`, `bg-purple-*`, `bg-indigo-*`, `from-cyan-*`, etc.).
- **NO** colored glowing `box-shadow` or `drop-shadow` (`shadow-[0_0_...]`). Use flat borders and neutral `shadow-sm` only on floating nav/modals.
- **NO** gradient text (`bg-clip-text text-transparent`).
- **NO** nested rounded cards inside cards (use `border-t` / `border-l` / flat list dividers inside a container).
- **NO** `transition-all` or animating `width` / `height`. Use `transition-colors`, `transition-transform`, or `transition-opacity` ONLY.
- **NO** em dashes (`—`) in UI copy; use `:`, `,`, or parentheses.
- **NO** `backdrop-blur` on cards or list tiles (keep glass blur strictly limited to floating Navbar and Mobile Bottom Dock per `R-10`).
- **Typography**: Minimum `text-sm` (`14px`) for all body copy, card descriptions, and feature chips. Radius discipline: `rounded-xl` (`12px`) for cards, `rounded-lg` (`8px`) for buttons/inputs, `rounded-full` ONLY for compact nav pills & avatar frames.

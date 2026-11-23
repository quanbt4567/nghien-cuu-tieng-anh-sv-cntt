# Quickstart & Validation Guide: SpeakIT

**Feature**: `001-workplace-speaking-practice`  
**Date**: 2026-11-11  

This document details runnable validation scenarios to prove that SpeakIT works end-to-end and strictly respects all 7 Constitutional Principles.

---

## 1. Prerequisites & Setup

```bash
# Verify Node.js environment
node -v   # >= 18.x
npm -v    # >= 9.x

# Install dependencies
npm install

# Run development server
npm run dev

# Verify clean production build
npm run build
```

---

## 2. Validation Scenarios

### Scenario A: End-to-End Daily Standup Turn with AI Mode (Happy Path)
1. Open Chrome and navigate to `http://localhost:3000`.
2. Observe landing page: Verify EF EPI 2025 verified figures (Vietnam 500, Rank 64/123, Speaking 461 weakest).
3. Navigate to `/settings`, input a valid Google Gemini API key, click "Kiểm tra kết nối" (Test Connection), and verify success toast in Vietnamese.
4. Return to Home, click "Daily Standup" or "Thử một lượt Daily Standup".
5. **Verify TTS**: Turn 1 plays "What did you do yesterday?" aloud via Web Speech API.
6. **Verify Signature Mic Button**: Click the prominent microphone button. Observe the animated multi-ring listening wave.
7. Speak: *"Yesterday I fixed the authentication token bug and created a pull request."*
8. Stop recording: Observe real-time transcript population. Click "Gửi câu trả lời" (Submit Answer).
9. **Verify Feedback**:
   - Score displayed between 0–100.
   - Target keywords `fixed` and `pull request` marked green (used).
   - Vietnamese grammar explanation displayed.
   - "Better Sentence" displayed.
   - Pronunciation note displays explicit disclaimer ("ước lượng từ văn bản").
   - Follow-up question generated contextually for Turn 2.

---

### Scenario B: Zero-Key Resilience ("AI mode off")
1. In `/settings`, clear the Gemini API key and save.
2. Return to `/practice/daily-standup`.
3. Verify persistent top banner: `"Chế độ AI đang tắt — Chấm điểm bằng từ khóa cục bộ"` (AI mode off).
4. Type or speak an answer: *"Yesterday I worked on unit tests and resolved the blocker."*
5. Submit answer.
6. **Verify Local Scoring**:
   - Evaluation succeeds instantly without network errors.
   - Keywords `blocker` recognized and scored locally.
   - Next predefined turn question ("What will you do today?") loads smoothly.

---

### Scenario C: Microphone Denied / Typed Fallback
1. In Chrome, set microphone permissions for `localhost:3000` to "Block" (or click "Block" in permission prompt).
2. Start any practice turn.
3. **Verify Automatic Fallback**:
   - The microphone button gracefully disables or shifts to typed mode.
   - A clear textarea appears with placeholder: *"Microphone chưa được cấp quyền. Bạn có thể gõ câu trả lời tiếng Anh tại đây..."*
4. Type an answer and submit.
5. Verify evaluation executes and scores the typed response identically.

---

### Scenario D: Vocabulary Drill & Audio Pronunciation
1. Navigate to `/vocabulary`.
2. Verify all 12 IT terms are present: `standup`, `blocker`, `deploy`, `pull request`, `merge conflict`, `bug`, `reproduce`, `severity`, `deadline`, `stakeholder`, `refactor`, `backlog`.
3. Click the speaker button on `pull request`.
4. Verify audio pronunciation plays via `window.speechSynthesis`.
5. Verify definition, phonetic guide, and example sentence are displayed.

---

### Scenario E: Adaptive 7-Day Plan & Weak-Point Prioritization
1. In practice, deliberately omit required keywords (e.g., miss `blocker` and `reproduce`).
2. Navigate to `/progress` or Home 7-day schedule.
3. Verify that Day 1 and Day 2 of the adaptive schedule dynamically prioritize exercises emphasizing the missed keywords.
4. Verify progress persists after browser refresh.

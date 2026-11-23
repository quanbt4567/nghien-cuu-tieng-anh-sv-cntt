# API Contract: Score Endpoint (`POST /api/score`)

**Endpoint**: `/api/score`  
**Method**: `POST`  
**Content-Type**: `application/json`  

---

## 1. Request Payload

```json
{
  "transcript": "Yesterday I fixed the authentication token bug and created a pull request.",
  "scenario": "daily-standup",
  "turnIndex": 0,
  "expectedKeywords": ["yesterday", "fixed", "pull request", "token"],
  "history": [
    {
      "role": "assistant",
      "content": "What did you do yesterday?"
    }
  ],
  "apiKey": "optional_client_provided_gemini_key"
}
```

### Request Headers
- `Content-Type: application/json`
- `x-gemini-key: <string>` *(optional alternative to body `apiKey`)*

### Field Validation Rules
| Field | Type | Required | Constraints |
|---|---|---|---|
| `transcript` | string | Yes | Min length 1 char, trimmed. Max 2000 chars. |
| `scenario` | string | Yes | Must be one of the 6 scenario IDs. |
| `turnIndex` | number | Yes | Integer `0`, `1`, or `2`. |
| `expectedKeywords` | string[] | Yes | Non-empty array of keywords. |
| `history` | array | No | Previous conversation turns for context. |
| `apiKey` | string | No | Optional. If omitted or empty, triggers local scoring fallback. |

---

## 2. Response Payload (Success `200 OK`)

Strict JSON returned regardless of whether evaluation mode is AI or local:

```json
{
  "score": 85,
  "keywordsUsed": ["fixed", "pull request"],
  "keywordsMissed": ["yesterday", "token"],
  "grammarCorrections": [
    {
      "original": "Yesterday I fixed the authentication token bug",
      "corrected": "Yesterday, I resolved the authentication token issue",
      "explanationVI": "Dùng 'resolved' và 'issue' tự nhiên hơn trong môi trường kỹ thuật chuyên nghiệp."
    }
  ],
  "betterSentence": "Yesterday, I resolved the authentication token issue and submitted a pull request for team review.",
  "pronunciationNote": "Đánh giá phát âm ước lượng từ văn bản nhận diện: âm đuôi /t/ trong 'fixed' và cụm 'pull request' cần bật rõ ràng hơn.",
  "nextQuestion": "Great job on the fix! What specific tasks will you focus on today?",
  "evaluationMode": "ai"
}
```

### Response Field Guarantees
- `score`: Integer between `0` and `100`.
  $$\text{score} = \text{round}(0.40 \times K + 0.30 \times C + 0.30 \times G)$$
- `pronunciationNote`: MUST always contain the disclaimer phrase indicating it is estimated from transcript.
- `evaluationMode`: `'ai'` if evaluated by Gemini; `'local_rules'` if executed without Gemini key or during fallback.
- `nextQuestion`: String. When in AI mode, contextual follow-up question; when in local mode, the next predefined scenario question from `data/scenarios.ts`.

---

## 3. Gemini System Prompt & Guidelines

When invoking Gemini API (`gemini-1.5-flash` or `gemini-2.0-flash`):
```text
You are an expert IT workplace English coach for Vietnamese software engineering students.
Role-play authentically according to the scenario (e.g., Tech Lead in Standup, Senior Reviewer in Code Review, Hiring Manager in Fresher Interview, Client in Meeting).

STRICT RULES:
1. Always evaluate in an encouraging, constructive manner.
2. Provide concise grammar explanations in Vietnamese (explanationVI).
3. Always include one natural, idiomatic "betterSentence" used by senior engineers.
4. Provide a pronunciationNote that clarifies: "Đánh giá phát âm ước lượng từ văn bản: ..."
5. Formulate a short, relevant follow-up question (nextQuestion) that builds directly on what the student just answered, keeping within the scenario's IT context. NEVER hallucinate impossible scenario facts.
6. Return STRICT JSON matching the schema with no extra conversational text or markdown code fences outside JSON.
```

---

## 4. Error Responses

All error responses return user-friendly Vietnamese messages:

```json
{
  "error": "Nội dung câu trả lời quá ngắn. Vui lòng nói hoặc gõ ít nhất 2 từ tiếng Anh.",
  "code": "INPUT_TOO_SHORT"
}
```

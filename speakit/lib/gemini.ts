import { ScoreResponse, ScenarioId } from "./types";

interface GeminiEvaluationOptions {
  transcript: string;
  scenario: ScenarioId;
  turnIndex: number;
  expectedKeywords: string[];
  history?: Array<{ role: "assistant" | "user"; content: string }>;
  apiKey: string;
}

export async function evaluateWithGemini({
  transcript,
  scenario,
  turnIndex,
  expectedKeywords,
  history = [],
  apiKey,
}: GeminiEvaluationOptions): Promise<ScoreResponse | null> {
  if (!apiKey || apiKey.trim() === "") return null;

  const systemInstruction = `You are an expert IT workplace English coach for Vietnamese software engineering students.
Role-play authentically according to the workplace scenario:
- daily-standup: Scrum Master / Tech Lead
- bug-report: QA Lead / Senior Developer
- code-review: Senior Peer Reviewer
- fresher-interview: Technical Hiring Manager
- client-meeting: Client Representative / Product Owner
- tech-demo: Senior Engineering Audience

STRICT RULES:
1. Always evaluate constructively and factually.
2. Calculate score: 40% keywords used + 30% completeness + 30% grammar (0 to 100).
3. Provide grammar corrections with clear explanations in Vietnamese (explanationVI).
4. Provide ONE natural, idiomatic "betterSentence" used by senior IT engineers.
5. In "pronunciationNote", you MUST include the exact Vietnamese phrase: "Đánh giá phát âm ước lượng từ văn bản" and give 1-2 practical tips for Vietnamese speakers (e.g. final sounds /t/, /d/, /s/ or consonant clusters).
6. Formulate a short, relevant follow-up question ("nextQuestion") that builds directly on what the student just answered in this IT context. Never hallucinate impossible scenario facts.
7. Return STRICT JSON with this schema and NO markdown code fences outside JSON:
{
  "score": number,
  "keywordsUsed": string[],
  "keywordsMissed": string[],
  "grammarCorrections": [
    {
      "original": string,
      "corrected": string,
      "explanationVI": string
    }
  ],
  "betterSentence": string,
  "pronunciationNote": string,
  "nextQuestion": string
}`;

  const prompt = `Student transcript: "${transcript}"
Scenario: ${scenario}
Turn index: ${turnIndex}
Expected technical keywords: ${JSON.stringify(expectedKeywords)}
Previous context: ${JSON.stringify(history)}`;

  // Abort controller with 8-second timeout per Clarification Q3
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) return null;

    const parsed = JSON.parse(candidateText);

    // Validate parsed fields
    return {
      score: typeof parsed.score === "number" ? Math.min(100, Math.max(0, parsed.score)) : 70,
      keywordsUsed: Array.isArray(parsed.keywordsUsed) ? parsed.keywordsUsed : [],
      keywordsMissed: Array.isArray(parsed.keywordsMissed) ? parsed.keywordsMissed : [],
      grammarCorrections: Array.isArray(parsed.grammarCorrections) ? parsed.grammarCorrections : [],
      betterSentence: parsed.betterSentence || transcript,
      pronunciationNote:
        parsed.pronunciationNote ||
        "Đánh giá phát âm ước lượng từ văn bản: Chú ý phát âm rõ âm đuôi của các thuật ngữ chuyên ngành.",
      nextQuestion: parsed.nextQuestion,
      evaluationMode: "ai",
    };
  } catch (error) {
    clearTimeout(timeoutId);
    return null;
  }
}


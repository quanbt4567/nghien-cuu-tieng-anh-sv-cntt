import { NextRequest, NextResponse } from "next/server";
import { rewardPracticePoints } from "../../../actions/leaderboard";
import {
  extractFirstJsonObject,
  requestAiWaterfallText,
} from "../../../../lib/ai-waterfall";

type ScenarioType = "Standup" | "Code Review" | "Incident call";

interface GeneratePayload {
  action: "generate";
  clusterTitle?: string;
  terms?: string[];
}

interface EvaluatePayload {
  action: "evaluate";
  clusterTitle?: string;
  promptEN?: string;
  targetTerms?: string[];
  transcript?: string;
  backupTransferCode?: string;
}

function normalizeTerms(rawTerms: unknown): string[] {
  if (!Array.isArray(rawTerms)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of rawTerms) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
    if (result.length >= 8) break;
  }
  return result;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isTermUsedInTranscript(transcript: string, term: string): boolean {
  const normalizedTranscript = normalizeText(transcript);
  const normalizedTerm = normalizeText(term);
  if (!normalizedTranscript || !normalizedTerm) return false;
  if (normalizedTranscript.includes(normalizedTerm)) return true;
  const termWords = normalizedTerm.split(" ").filter(Boolean);
  const transcriptWords = new Set(normalizedTranscript.split(" ").filter(Boolean));
  return termWords.length > 0 && termWords.every((word) => transcriptWords.has(word));
}

function pickScenarioType(clusterTitle: string, rawType?: unknown): ScenarioType {
  if (
    rawType === "Standup" ||
    rawType === "Code Review" ||
    rawType === "Incident call"
  ) {
    return rawType;
  }
  const lower = clusterTitle.toLowerCase();
  if (lower.includes("bug") || lower.includes("outage") || lower.includes("incident")) {
    return "Incident call";
  }
  if (lower.includes("code review") || lower.includes("git") || lower.includes("refactor")) {
    return "Code Review";
  }
  return "Standup";
}

function buildLocalPromptFallback(clusterTitle: string, targetTerms: string[]) {
  const scenarioType = pickScenarioType(clusterTitle);
  const termPreview = targetTerms.slice(0, 4).join(", ");

  if (scenarioType === "Incident call") {
    return {
      scenarioType,
      promptEN: `Hey, we just got paged on the ${clusterTitle} alert. Can you give us a quick status update covering ${termPreview} and what our next step is?`,
      promptVI: `Này, chúng ta vừa nhận cảnh báo về ${clusterTitle}. Bạn có thể cập nhật nhanh tình hình bằng các từ (${termPreview}) và bước xử lý tiếp theo không?`,
      targetTerms,
    };
  }

  if (scenarioType === "Code Review") {
    return {
      scenarioType,
      promptEN: `I'm reviewing your latest PR for ${clusterTitle}. Could you walk me through your changes and explain how you handled ${termPreview}?`,
      promptVI: `Mình đang review PR mới nhất của bạn cho phần ${clusterTitle}. Bạn giải thích nhanh các thay đổi và cách xử lý liên quan đến (${termPreview}) được không?`,
      targetTerms,
    };
  }

  return {
    scenarioType,
    promptEN: `Good morning! For today's ${clusterTitle} update, what did you ship yesterday, what's the plan today, and how do ${termPreview} fit in?`,
    promptVI: `Chào buổi sáng! Trong buổi cập nhật ${clusterTitle} hôm nay, hôm qua bạn làm xong gì, kế hoạch hôm nay ra sao, và các thuật ngữ (${termPreview}) liên quan thế nào?`,
    targetTerms,
  };
}

function buildLocalEvaluationFallback(
  targetTerms: string[],
  matchedTerms: string[],
  missedTerms: string[],
  transcript: string
) {
  const ratio = targetTerms.length > 0 ? matchedTerms.length / targetTerms.length : 0;
  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
  const fluencyBonus = Math.min(25, Math.round(wordCount * 1.1));
  const score = Math.min(100, Math.max(10, Math.round(ratio * 75 + fluencyBonus)));

  const feedbackVI =
    ratio >= 0.75
      ? `Tuyệt vời! Bạn đã dùng tự nhiên ${matchedTerms.length}/${targetTerms.length} thuật ngữ mục tiêu trong ngữ cảnh kỹ thuật.`
      : `Bạn đã dùng ${matchedTerms.length}/${targetTerms.length} thuật ngữ mục tiêu. Hãy thử lồng ghép thêm: ${missedTerms.join(", ")}.`;

  const naturalnessFeedback =
    wordCount >= 18
      ? "Câu trả lời có độ dài tốt, mạch lạc như một lượt trao đổi thực tế trong team kỹ thuật."
      : "Câu trả lời hơi ngắn; hãy thêm 1-2 câu giải thích nguyên nhân hoặc bước tiếp theo để nghe tự nhiên hơn.";

  return {
    score,
    feedbackVI,
    naturalnessFeedback,
  };
}

export async function POST(req: NextRequest) {
  let body: GeneratePayload | EvaluatePayload;
  try {
    body = (await req.json()) as GeneratePayload | EvaluatePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (body.action === "generate") {
    const clusterTitle =
      typeof body.clusterTitle === "string" && body.clusterTitle.trim()
        ? body.clusterTitle.trim().slice(0, 120)
        : "IT Engineering";
    const targetTerms = normalizeTerms(body.terms);
    if (targetTerms.length === 0) {
      return NextResponse.json(
        { error: "At least one target term is required." },
        { status: 400 }
      );
    }

    const fallback = buildLocalPromptFallback(clusterTitle, targetTerms);
    const aiResult = await requestAiWaterfallText({
      systemInstruction:
        "You are an engineering manager creating a concise 1-turn English speaking drill for Vietnamese IT students. Return ONLY a JSON object with keys: scenarioType (one of 'Standup', 'Code Review', 'Incident call'), promptEN (1-2 natural spoken sentences asking the engineer a question), promptVI (accurate Vietnamese translation of promptEN), targetTerms (array of the exact target terms).",
      userPrompt: `Cluster: "${clusterTitle}"\nTarget terms: ${JSON.stringify(
        targetTerms
      )}\nGenerate a realistic 1-turn engineering prompt that encourages the speaker to naturally use these target terms.`,
      temperature: 0.4,
      jsonMode: true,
    });

    if (aiResult) {
      const parsed = extractFirstJsonObject(aiResult.text);
      if (
        parsed &&
        typeof parsed.promptEN === "string" &&
        parsed.promptEN.trim() &&
        typeof parsed.promptVI === "string" &&
        parsed.promptVI.trim()
      ) {
        return NextResponse.json({
          scenarioType: pickScenarioType(clusterTitle, parsed.scenarioType),
          promptEN: parsed.promptEN.trim(),
          promptVI: parsed.promptVI.trim(),
          targetTerms,
          provider: aiResult.provider,
        });
      }
    }

    return NextResponse.json({
      ...fallback,
      provider: "local",
    });
  }

  if (body.action === "evaluate") {
    const clusterTitle =
      typeof body.clusterTitle === "string" && body.clusterTitle.trim()
        ? body.clusterTitle.trim().slice(0, 120)
        : "IT Engineering";
    const promptEN =
      typeof body.promptEN === "string" ? body.promptEN.trim() : "";
    const transcript =
      typeof body.transcript === "string" ? body.transcript.trim() : "";
    const targetTerms = normalizeTerms(body.targetTerms);
    const backupTransferCode =
      typeof body.backupTransferCode === "string" && body.backupTransferCode.trim()
        ? body.backupTransferCode.trim()
        : undefined;

    if (!transcript || targetTerms.length === 0) {
      return NextResponse.json(
        { error: "Transcript and targetTerms are required." },
        { status: 400 }
      );
    }

    const matchedTerms = targetTerms.filter((term) =>
      isTermUsedInTranscript(transcript, term)
    );
    const missedTerms = targetTerms.filter((term) => !matchedTerms.includes(term));
    const coverageRatio = matchedTerms.length / targetTerms.length;

    const fallbackEval = buildLocalEvaluationFallback(
      targetTerms,
      matchedTerms,
      missedTerms,
      transcript
    );

    let score = fallbackEval.score;
    let feedbackVI = fallbackEval.feedbackVI;
    let naturalnessFeedback = fallbackEval.naturalnessFeedback;
    let provider: string = "local";

    const aiResult = await requestAiWaterfallText({
      systemInstruction:
        "You are an English communication coach for Vietnamese software engineers. Evaluate how naturally and accurately the user used the target IT vocabulary in response to the prompt. Return ONLY JSON with keys: score (integer 0-100), feedbackVI (concise Vietnamese feedback on accuracy and context), naturalnessFeedback (concise Vietnamese feedback on phrasing naturalness and grammar).",
      userPrompt: `Cluster: "${clusterTitle}"\nPrompt: "${promptEN}"\nTarget terms: ${JSON.stringify(
        targetTerms
      )}\nMatched terms detected: ${JSON.stringify(
        matchedTerms
      )}\nMissed terms: ${JSON.stringify(
        missedTerms
      )}\nUser transcript: "${transcript}"`,
      temperature: 0.2,
      jsonMode: true,
    });

    if (aiResult) {
      const parsed = extractFirstJsonObject(aiResult.text);
      if (parsed) {
        if (typeof parsed.score === "number" && Number.isFinite(parsed.score)) {
          score = Math.max(0, Math.min(100, Math.round(parsed.score)));
        }
        if (typeof parsed.feedbackVI === "string" && parsed.feedbackVI.trim()) {
          feedbackVI = parsed.feedbackVI.trim();
        }
        if (
          typeof parsed.naturalnessFeedback === "string" &&
          parsed.naturalnessFeedback.trim()
        ) {
          naturalnessFeedback = parsed.naturalnessFeedback.trim();
        }
        provider = aiResult.provider;
      }
    }

    let awardedCoins = 0;
    let player = null;

    if (coverageRatio >= 0.75) {
      const reward = await rewardPracticePoints(
        "vocab-cluster-challenge",
        3000,
        backupTransferCode
      );
      if (reward.ok) {
        awardedCoins = 3;
        player = reward.player;
      }
    }

    return NextResponse.json({
      score,
      matchedTerms,
      missedTerms,
      feedbackVI,
      naturalnessFeedback,
      awardedCoins,
      player,
      provider,
    });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}

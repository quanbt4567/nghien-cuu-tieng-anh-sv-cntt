import { NextRequest, NextResponse } from "next/server";
import { SCENARIOS } from "../../../data/scenarios";
import { evaluateWithWaterfall } from "../../../lib/ai-waterfall";
import {
  detectSensitiveLanguage,
  recordModerationIncident,
} from "../../../lib/content-moderation";
import {
  detectInvalidEnglishInput,
  matchesKeyword,
  normalizeTextForMatching,
  scoreLocally,
} from "../../../lib/localScorer";
import { readExistingGuestPlayer } from "../../../lib/neon-auth";
import { ScoreRequestPayload } from "../../../lib/types";

export async function POST(req: NextRequest) {
  let body: ScoreRequestPayload;
  try {
    body = (await req.json()) as ScoreRequestPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  try {
    const { transcript, scenario, turnIndex, expectedKeywords, history } = body;

    if (!transcript || transcript.trim().length === 0) {
      return NextResponse.json(
        { error: "Vui lòng nói hoặc gõ câu trả lời tiếng Anh trước khi gửi chấm điểm." },
        { status: 400 }
      );
    }

    const currentScenario = SCENARIOS.find((s) => s.id === scenario);
    const currentTurn = currentScenario?.turns?.[turnIndex];
    const nextTurn = currentScenario?.turns?.[turnIndex + 1];
    const defaultNextQuestion = nextTurn ? nextTurn.questionEN : undefined;
    const safeExpectedKeywords = Array.isArray(expectedKeywords) ? expectedKeywords : [];

    const guard = detectInvalidEnglishInput(transcript);
    if (guard.invalid) {
      const blocked = scoreLocally({
        transcript,
        expectedKeywords: safeExpectedKeywords,
        sampleAnswerEN: currentTurn?.sampleAnswerEN,
        hintVI: currentTurn?.hintVI,
      });
      return NextResponse.json({
        ...blocked,
        score: 0,
        keywordsUsed: [],
        keywordsMissed: safeExpectedKeywords,
        nextQuestion: defaultNextQuestion,
      });
    }

    const result = await evaluateWithWaterfall({
      transcript,
      scenario,
      turnIndex,
      expectedKeywords: safeExpectedKeywords,
      history,
      sampleAnswerEN: currentTurn?.sampleAnswerEN,
      hintVI: currentTurn?.hintVI,
      defaultNextQuestion,
    });

    const localSensitive = detectSensitiveLanguage(transcript);
    const aiSensitive =
      typeof result.pronunciationNote === "string" &&
      result.pronunciationNote.includes("[SENSITIVE]");
    const aiOffTopic =
      Array.isArray(result.grammarCorrections) &&
      result.grammarCorrections.some((item) =>
        `${item?.explanationVI ?? ""} ${item?.corrected ?? ""}`.includes(
          "[OFF_TOPIC]"
        )
      );

    if (localSensitive.flagged || aiSensitive || aiOffTopic) {
      const player = await readExistingGuestPlayer().catch(() => null);
      void recordModerationIncident({
        playerId: player?.id ?? null,
        playerName: player?.displayName ?? "Khách luyện nói",
        transferCode: player?.transferCode ?? null,
        source: "practice",
        roomOrTopic: `${scenario} (Turn ${turnIndex + 1})`,
        content: transcript,
        category: localSensitive.flagged || aiSensitive ? "sensitive" : "off_topic",
        severity: localSensitive.flagged || aiSensitive ? "high" : "medium",
        reason: localSensitive.flagged
          ? localSensitive.reason
          : aiSensitive
            ? "AI phát hiện ngôn từ nhạy cảm trong bài nói."
            : "AI đánh giá câu trả lời lạc đề / chưa đúng trọng tâm câu hỏi.",
        aiProvider: result.provider,
      });
    }

    if (result.score <= 0) {
      return NextResponse.json({
        ...result,
        score: 0,
        keywordsUsed: [],
        keywordsMissed:
          safeExpectedKeywords.length > 0 ? safeExpectedKeywords : result.keywordsMissed,
      });
    }

    if (safeExpectedKeywords.length > 0) {
      const words = normalizeTextForMatching(transcript).split(" ").filter(Boolean);
      const keywordsUsed: string[] = [];
      const keywordsMissed: string[] = [];
      for (const kw of safeExpectedKeywords) {
        if (matchesKeyword(words, kw)) {
          keywordsUsed.push(kw);
        } else {
          keywordsMissed.push(kw);
        }
      }
      return NextResponse.json({
        ...result,
        keywordsUsed,
        keywordsMissed,
      });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Đã xảy ra lỗi xử lý câu trả lời. Vui lòng thử lại." },
      { status: 500 }
    );
  }
}


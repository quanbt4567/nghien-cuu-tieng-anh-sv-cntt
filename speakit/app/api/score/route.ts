import { NextRequest, NextResponse } from "next/server";
import { SCENARIOS } from "../../../data/scenarios";
import { evaluateWithWaterfall } from "../../../lib/ai-waterfall";
import {
  detectInvalidEnglishInput,
  matchesKeyword,
  normalizeTextForMatching,
  scoreLocally,
} from "../../../lib/localScorer";
import { ScoreRequestPayload } from "../../../lib/types";

export async function POST(req: NextRequest) {
  try {
    const body: ScoreRequestPayload = await req.json();
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


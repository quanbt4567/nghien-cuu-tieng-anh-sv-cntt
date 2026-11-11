import { NextRequest, NextResponse } from "next/server";
import { evaluateWithGemini } from "../../../lib/gemini";
import { scoreLocally } from "../../../lib/localScorer";
import { SCENARIOS } from "../../../data/scenarios";
import { ScoreRequestPayload, ScoreResponse } from "../../../lib/types";

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

    // Determine target scenario & next turn
    const currentScenario = SCENARIOS.find((s) => s.id === scenario);
    const nextTurn = currentScenario?.turns?.[turnIndex + 1];
    const defaultNextQuestion = nextTurn ? nextTurn.questionEN : undefined;

    // Resolve server-side API key cleanly without requiring user keys
    const effectiveApiKey = process.env.GEMINI_API_KEY || "";

    let result: ScoreResponse | null = null;

    // Try Gemini AI evaluation if key is present
    if (effectiveApiKey && effectiveApiKey.trim().length > 0) {
      result = await evaluateWithGemini({
        transcript,
        scenario,
        turnIndex,
        expectedKeywords,
        history,
        apiKey: effectiveApiKey,
      });
    }

    // Fallback to local rule engine if no key or Gemini fails/times out
    if (!result) {
      const localResult = scoreLocally({
        transcript,
        expectedKeywords,
        sampleAnswerEN: currentScenario?.turns?.[turnIndex]?.sampleAnswerEN,
        hintVI: currentScenario?.turns?.[turnIndex]?.hintVI,
      });

      result = {
        ...localResult,
        nextQuestion: defaultNextQuestion,
        evaluationMode: "local_rules",
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "Đã xảy ra lỗi xử lý câu trả lời. Vui lòng thử lại." },
      { status: 500 }
    );
  }
}


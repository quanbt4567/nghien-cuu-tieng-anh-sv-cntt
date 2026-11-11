import { NextRequest, NextResponse } from "next/server";
import { SCENARIOS } from "../../../data/scenarios";
import { evaluateWithWaterfall } from "../../../lib/ai-waterfall";
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
    const nextTurn = currentScenario?.turns?.[turnIndex + 1];
    const defaultNextQuestion = nextTurn ? nextTurn.questionEN : undefined;

    const result = await evaluateWithWaterfall({
      transcript,
      scenario,
      turnIndex,
      expectedKeywords,
      history,
      sampleAnswerEN: currentScenario?.turns?.[turnIndex]?.sampleAnswerEN,
      hintVI: currentScenario?.turns?.[turnIndex]?.hintVI,
      defaultNextQuestion,
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Đã xảy ra lỗi xử lý câu trả lời. Vui lòng thử lại." },
      { status: 500 }
    );
  }
}


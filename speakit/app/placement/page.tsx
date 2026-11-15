"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  Keyboard,
  Sparkles,
} from "lucide-react";
import { MicButton } from "../../components/audio/MicButton";
import { FeedbackPromptModal } from "../../components/feedback/FeedbackPromptModal";
import { SCENARIOS } from "../../data/scenarios";
import {
  PLACEMENT_MCQS,
  PlacementResult,
  evaluatePlacementLevel,
  savePlacementResult,
} from "../../lib/placement";
import { startSpeechRecognition, SpeechController } from "../../lib/speech";
import { useRef } from "react";

export default function PlacementPage() {
  const [step, setStep] = useState<number>(0);
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, string>>({});
  const [speakingTranscript, setSpeakingTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [result, setResult] = useState<PlacementResult | null>(null);
  const speechControllerRef = useRef<SpeechController | null>(null);

  const handleSelectOption = (questionId: string, optionId: string) => {
    setMcqAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const handleStartMic = () => {
    setSpeechError(null);
    const controller = startSpeechRecognition({
      onStart: () => setIsRecording(true),
      onTranscript: (text) => setSpeakingTranscript(text),
      onEnd: () => setIsRecording(false),
      onError: (msg) => {
        setIsRecording(false);
        setSpeechError(msg);
      },
    });
    if (controller) {
      speechControllerRef.current = controller;
    }
  };

  const handleStopMic = () => {
    if (speechControllerRef.current) {
      speechControllerRef.current.stop();
      speechControllerRef.current = null;
    }
    setIsRecording(false);
  };

  const handleFinishPlacement = () => {
    if (isRecording) {
      handleStopMic();
    }
    const evaluated = evaluatePlacementLevel(mcqAnswers, speakingTranscript);
    savePlacementResult(evaluated);
    setResult(evaluated);
  };

  const recommendedScenario = result
    ? SCENARIOS.find((s) => s.id === result.recommendedScenarioId) ?? SCENARIOS[0]
    : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="space-y-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white text-ink text-xs font-medium border border-ink/15 shadow-soft hover:bg-paper-muted transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Trang chủ</span>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2 pt-1">
          <Compass className="w-6 h-6 text-sky-600 shrink-0" />
          <span>Kiểm Tra Trình Độ Nhanh (2 Phút)</span>
        </h1>
        <p className="text-xs sm:text-sm text-ink-muted">
          Trả lời 2 câu tình huống và nói ngắn 15 giây để SpeakIT gợi ý cấp độ Fresher, Junior hoặc Senior phù hợp nhất.
        </p>
      </div>

      {result && recommendedScenario ? (
        <div className="bg-white border border-ink/15 rounded-2xl p-6 shadow-soft space-y-5">
          <div className="flex items-center gap-2 text-emerald-700 font-mono text-xs font-bold uppercase">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Hoàn tất đánh giá đầu vào</span>
          </div>

          <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/30 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono text-sky-700 font-semibold">
                Cấp độ đề xuất của bạn:
              </span>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-pill bg-white border border-sky-500/30 text-sky-700 text-xs font-mono font-bold">
                  {result.score}/100 điểm
                </span>
                <span className="px-3 py-0.5 rounded-pill bg-ink text-white text-xs font-mono font-bold">
                  {result.level}
                </span>
              </div>
            </div>
            <p className="text-sm text-ink leading-relaxed">{result.summaryVI}</p>
          </div>

          <div className="p-4 rounded-xl bg-paper border border-ink/15 space-y-1.5">
            <span className="text-[11px] font-mono font-bold uppercase text-ink-muted">
              Tình huống khởi đầu phù hợp:
            </span>
            <h2 className="text-base font-bold text-ink">
              {recommendedScenario.titleEN}{" "}
              <span className="text-xs font-normal text-ink-muted">
                ({recommendedScenario.titleVI})
              </span>
            </h2>
            <p className="text-xs text-ink-muted">
              {recommendedScenario.descriptionVI}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <Link
              href={`/practice/${recommendedScenario.id}`}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-pill bg-accent hover:bg-accent-hover text-white text-sm font-bold shadow-card transition-all"
            >
              <span>Bắt đầu bài {result.level} ngay</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-pill bg-paper border border-ink/15 text-xs font-semibold text-ink hover:bg-paper-muted transition-all"
            >
              <span>Về trang chủ</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-6">
          <div className="flex items-center justify-between border-b border-paper-muted pb-3">
            <span className="text-xs font-mono font-bold text-sky-700 uppercase">
              Bước {step + 1}/3
            </span>
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map((idx) => (
                <span
                  key={idx}
                  className={`h-2 w-8 rounded-pill transition-colors ${
                    idx <= step ? "bg-ink" : "bg-paper-muted"
                  }`}
                />
              ))}
            </div>
          </div>

          {step < 2 ? (
            (() => {
              const q = PLACEMENT_MCQS[step];
              const selected = mcqAnswers[q.id];
              return (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <p className="text-xs text-ink-muted leading-relaxed">
                      {q.contextVI}
                    </p>
                    <h2 className="text-base sm:text-lg font-bold text-ink">
                      {q.questionEN}
                    </h2>
                  </div>

                  <div className="space-y-2.5">
                    {q.options.map((opt) => {
                      const isChosen = selected === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSelectOption(q.id, opt.id)}
                          className={`w-full text-left p-3.5 rounded-xl border text-xs sm:text-sm transition-all ${
                            isChosen
                              ? "bg-sky-500/10 border-sky-500/40 text-ink font-semibold"
                              : "bg-paper border-ink/15 text-ink hover:bg-paper-muted"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      disabled={step === 0}
                      onClick={() => setStep((s) => Math.max(0, s - 1))}
                      className="px-4 py-2.5 rounded-pill bg-paper border border-ink/15 text-xs font-medium text-ink-muted hover:bg-paper-muted hover:text-ink disabled:opacity-40 transition-all"
                    >
                      Quay lại
                    </button>
                    <button
                      type="button"
                      disabled={!selected}
                      onClick={() => setStep((s) => s + 1)}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-pill bg-accent hover:bg-accent-hover text-white text-sm font-bold shadow-card disabled:opacity-40 disabled:pointer-events-none transition-all"
                    >
                      <span>Tiếp tục</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-sky-700">
                  <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                  <span>Phản xạ nói ngắn (15 giây)</span>
                </span>
                <h2 className="text-base sm:text-lg font-bold text-ink">
                  "Briefly explain a technical task or bug you worked on recently."
                </h2>
                <p className="text-xs text-ink-muted">
                  Nói 1–2 câu bằng tiếng Anh (hoặc gõ nhanh nếu không dùng micro).
                </p>
              </div>

              <MicButton
                isRecording={isRecording}
                onStart={handleStartMic}
                onStop={handleStopMic}
                maxSeconds={15}
                error={speechError}
              />

              <div className="space-y-2 pt-2 border-t border-paper-muted">
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
                  <Keyboard className="w-3.5 h-3.5 text-ink-muted" />
                  <span>Nội dung câu trả lời tiếng Anh:</span>
                </label>
                <textarea
                  value={speakingTranscript}
                  onChange={(e) => setSpeakingTranscript(e.target.value)}
                  disabled={isRecording}
                  rows={2}
                  placeholder="Ví dụ: Yesterday I fixed an API timeout bug in our staging database..."
                  className="w-full p-3 text-sm bg-paper border border-ink/15 rounded-xl text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 rounded-pill bg-paper border border-ink/15 text-xs font-medium text-ink-muted hover:bg-paper-muted hover:text-ink transition-all"
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  onClick={handleFinishPlacement}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-pill bg-accent hover:bg-accent-hover text-white text-sm font-bold shadow-card transition-all"
                >
                  <span>Xem kết quả xếp lớp</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      <FeedbackPromptModal trigger={Boolean(result)} context="placement-test" />
    </div>
  );
}

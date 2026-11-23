"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  Keyboard,
  Mic,
} from "lucide-react";
import { MicButton } from "../../components/audio/MicButton";
import { FeedbackPromptModal } from "../../components/feedback/FeedbackPromptModal";
import { InteractiveEnglishText } from "../../components/common/EnglishWordTooltip";
import { SCENARIOS } from "../../data/scenarios";
import {
  PLACEMENT_MCQS,
  PlacementResult,
  evaluatePlacementLevel,
  savePlacementResult,
} from "../../lib/placement";
import { startSpeechRecognition, SpeechController } from "../../lib/speech";

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
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 hover:border-blue-700 dark:hover:border-blue-500 text-xs font-semibold transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
          <span>Trang chủ</span>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2 pt-1">
          <Compass className="w-6 h-6 text-blue-700 dark:text-blue-400 shrink-0" />
          <span>Kiểm Tra Trình Độ Nhanh (2 Phút)</span>
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          Trả lời 2 câu tình huống và nói ngắn 15 giây để SpeakIT gợi ý cấp độ Fresher, Junior hoặc Senior phù hợp nhất.
        </p>
      </div>

      {result && recommendedScenario ? (
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-mono text-xs font-bold uppercase">
            <CheckCircle2 className="w-4 h-4 text-green-700 dark:text-green-400" />
            <span>Hoàn tất đánh giá đầu vào</span>
          </div>

          <div className="border-l-2 border-blue-700 dark:border-blue-500 pl-4 py-1 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-mono text-blue-700 dark:text-blue-400 font-semibold">
                Cấp độ đề xuất của bạn:
              </span>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs font-mono font-bold">
                  {result.score}/100 điểm
                </span>
                <span className="px-3 py-0.5 rounded-full bg-blue-700 dark:bg-blue-600 text-white text-xs font-mono font-bold">
                  {result.level}
                </span>
              </div>
            </div>
            <p className="text-sm text-slate-900 dark:text-slate-100 leading-relaxed">
              {result.summaryVI}
            </p>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-1.5">
            <span className="text-xs font-mono font-bold uppercase text-blue-700 dark:text-blue-400">
              Tình huống khởi đầu phù hợp:
            </span>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
              {recommendedScenario.titleEN}{" "}
              <span className="text-sm font-normal text-slate-600 dark:text-slate-300">
                ({recommendedScenario.titleVI})
              </span>
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {recommendedScenario.descriptionVI}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <Link
              href={`/practice/${recommendedScenario.id}`}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold text-sm active:scale-[0.98] transition-colors"
            >
              <span>Bắt đầu bài {result.level} ngay</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:border-blue-700 text-sm font-semibold transition-colors"
            >
              <span>Về trang chủ</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <span className="text-xs font-mono font-bold text-blue-700 dark:text-blue-400 uppercase">
              Bước {step + 1}/3
            </span>
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map((idx) => (
                <span
                  key={idx}
                  className={`h-2 w-8 rounded-full transition-colors ${
                    idx <= step
                      ? "bg-blue-700 dark:bg-blue-500"
                      : "bg-slate-200 dark:bg-slate-800"
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
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {q.contextVI}
                    </p>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-50">
                      <InteractiveEnglishText text={q.questionEN} />
                    </h2>
                    <p className="text-sm text-blue-700 dark:text-blue-400 font-medium">
                      Mẹo cho người mới: Chạm vào từ tiếng Anh có gạch chân để xem nghĩa tiếng Việt.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {q.options.map((opt) => {
                      const isChosen = selected === opt.id;
                      return (
                        <div
                          key={opt.id}
                          onClick={(e) => {
                            if (!(e.target as HTMLElement).closest("button")) {
                              handleSelectOption(q.id, opt.id);
                            }
                          }}
                          className={`flex items-start gap-3 w-full text-left p-3.5 rounded-lg border text-sm cursor-pointer transition-colors ${
                            isChosen
                              ? "bg-blue-50 dark:bg-blue-950/40 border-blue-700 dark:border-blue-500 text-slate-900 dark:text-slate-50 font-semibold"
                              : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 hover:border-blue-700 dark:hover:border-blue-500"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleSelectOption(q.id, opt.id)}
                            aria-pressed={isChosen}
                            className={`mt-0.5 px-2 py-0.5 rounded-full border text-xs font-mono font-bold shrink-0 transition-colors ${
                              isChosen
                                ? "bg-blue-700 text-white border-blue-700 dark:bg-blue-600 dark:border-blue-600"
                                : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-blue-700"
                            }`}
                          >
                            {isChosen ? `✓ ${opt.id.toUpperCase()}` : opt.id.toUpperCase()}
                          </button>
                          <div className="flex-1 leading-relaxed">
                            <InteractiveEnglishText text={opt.label} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      disabled={step === 0}
                      onClick={() => setStep((s) => Math.max(0, s - 1))}
                      className="px-4 py-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:border-blue-700 text-sm font-medium disabled:opacity-40 disabled:pointer-events-none transition-colors"
                    >
                      Quay lại
                    </button>
                    <button
                      type="button"
                      disabled={!selected}
                      onClick={() => setStep((s) => s + 1)}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold text-sm disabled:opacity-40 disabled:pointer-events-none transition-colors"
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
                <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase text-blue-700 dark:text-blue-400">
                  <Mic className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                  <span>Phản xạ nói ngắn (15 giây)</span>
                </span>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-50">
                  &ldquo;<InteractiveEnglishText text="Briefly explain a technical task or bug you worked on recently." />&rdquo;
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Nói 1-2 câu bằng tiếng Anh (hoặc gõ nhanh nếu không dùng micro).
                </p>
              </div>

              <MicButton
                isRecording={isRecording}
                onStart={handleStartMic}
                onStop={handleStopMic}
                maxSeconds={15}
                error={speechError}
              />

              <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <label className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <Keyboard className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                  <span>Nội dung câu trả lời tiếng Anh:</span>
                </label>
                <textarea
                  value={speakingTranscript}
                  onChange={(e) => setSpeakingTranscript(e.target.value)}
                  disabled={isRecording}
                  rows={2}
                  placeholder="Ví dụ: Yesterday I fixed an API timeout bug in our staging database..."
                  className="w-full p-3 text-sm rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-50 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:border-blue-700 dark:focus:border-blue-500 resize-none transition-colors"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:border-blue-700 text-sm font-medium transition-colors"
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  onClick={handleFinishPlacement}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold text-sm active:scale-[0.98] transition-colors"
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

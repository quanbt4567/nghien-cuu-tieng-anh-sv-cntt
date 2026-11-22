"use client";

import { useRef, useState } from "react";
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
          className="liquid-glass-btn inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-sky-600" />
          <span>Trang chủ</span>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2 pt-1">
          <Compass className="w-6 h-6 text-sky-600 shrink-0" />
          <span>Kiểm Tra Trình Độ Nhanh (2 Phút)</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-600">
          Trả lời 2 câu tình huống và nói ngắn 15 giây để SpeakIT gợi ý cấp độ Fresher, Junior hoặc Senior phù hợp nhất.
        </p>
      </div>

      {result && recommendedScenario ? (
        <div className="liquid-glass-card p-6 space-y-5">
          <div className="flex items-center gap-2 text-emerald-700 font-mono text-xs font-bold uppercase">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Hoàn tất đánh giá đầu vào</span>
          </div>

          <div className="p-4 rounded-2xl bg-sky-50/85 border border-sky-200/90 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono text-sky-700 font-semibold">
                Cấp độ đề xuất của bạn:
              </span>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-white/85 border border-sky-300/80 text-sky-700 text-xs font-mono font-bold">
                  {result.score}/100 điểm
                </span>
                <span className="px-3 py-0.5 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs font-mono font-bold shadow-sm">
                  {result.level}
                </span>
              </div>
            </div>
            <p className="text-sm text-slate-900 leading-relaxed">{result.summaryVI}</p>
          </div>

          <div className="liquid-glass-card-lite p-4 space-y-1.5">
            <span className="text-[11px] font-mono font-bold uppercase text-sky-600">
              Tình huống khởi đầu phù hợp:
            </span>
            <h2 className="text-base font-bold text-slate-900">
              {recommendedScenario.titleEN}{" "}
              <span className="text-xs font-normal text-slate-600">
                ({recommendedScenario.titleVI})
              </span>
            </h2>
            <p className="text-xs text-slate-600">
              {recommendedScenario.descriptionVI}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <Link
              href={`/practice/${recommendedScenario.id}`}
              className="liquid-btn-primary flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm active:scale-[0.98] transition-all"
            >
              <span>Bắt đầu bài {result.level} ngay</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/"
              className="liquid-glass-btn inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-full text-xs font-semibold transition-all"
            >
              <span>Về trang chủ</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="liquid-glass-card p-5 sm:p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200/85 pb-3">
            <span className="text-xs font-mono font-bold text-sky-600 uppercase">
              Bước {step + 1}/3
            </span>
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map((idx) => (
                <span
                  key={idx}
                  className={`h-2 w-8 rounded-full transition-colors ${
                    idx <= step
                      ? "bg-gradient-to-r from-sky-500 to-blue-600 shadow-[0_0_10px_rgba(14,165,233,0.4)]"
                      : "bg-slate-200/85"
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
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {q.contextVI}
                    </p>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">
                      <InteractiveEnglishText text={q.questionEN} />
                    </h2>
                    <p className="text-[11px] text-sky-600 font-medium">
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
                          className={`flex items-start gap-3 w-full text-left p-3.5 rounded-2xl border text-xs sm:text-sm cursor-pointer transition-all ${
                            isChosen
                              ? "bg-sky-50/90 border-sky-400/80 text-slate-900 font-semibold shadow-[0_6px_18px_rgba(14,165,233,0.14)]"
                              : "bg-white/75 border-slate-200/85 text-slate-700 hover:bg-white hover:border-sky-300/75"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleSelectOption(q.id, opt.id)}
                            aria-pressed={isChosen}
                            className={`mt-0.5 px-2 py-0.5 rounded-full border text-[11px] font-mono font-bold shrink-0 transition-colors ${
                              isChosen
                                ? "bg-sky-600 text-white border-sky-500"
                                : "bg-slate-100/90 text-slate-700 border-slate-200/90 hover:border-sky-300"
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
                      className="liquid-glass-btn px-4 py-2.5 rounded-full text-xs font-medium disabled:opacity-40 disabled:pointer-events-none transition-all"
                    >
                      Quay lại
                    </button>
                    <button
                      type="button"
                      disabled={!selected}
                      onClick={() => setStep((s) => s + 1)}
                      className="liquid-btn-primary inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm disabled:opacity-40 disabled:pointer-events-none transition-all"
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
                <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-sky-600">
                  <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                  <span>Phản xạ nói ngắn (15 giây)</span>
                </span>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  &ldquo;<InteractiveEnglishText text="Briefly explain a technical task or bug you worked on recently." />&rdquo;
                </h2>
                <p className="text-xs text-slate-600">
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

              <div className="space-y-2 pt-2 border-t border-slate-200/85">
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                  <Keyboard className="w-3.5 h-3.5 text-sky-600" />
                  <span>Nội dung câu trả lời tiếng Anh:</span>
                </label>
                <textarea
                  value={speakingTranscript}
                  onChange={(e) => setSpeakingTranscript(e.target.value)}
                  disabled={isRecording}
                  rows={2}
                  placeholder="Ví dụ: Yesterday I fixed an API timeout bug in our staging database..."
                  className="liquid-glass-input w-full p-3 text-sm rounded-xl resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="liquid-glass-btn px-4 py-2.5 rounded-full text-xs font-medium transition-all"
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  onClick={handleFinishPlacement}
                  className="liquid-btn-primary inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm active:scale-[0.98] transition-all"
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

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  Mic,
  MicOff,
  RotateCcw,
  XCircle,
  Zap,
} from "lucide-react";
import { VocabularyItem } from "../../lib/types";
import {
  buildVocabQuizQuestions,
  isVoiceQuizMatch,
  VocabQuizQuestion,
} from "../../lib/vocab-quiz";
import { reportGuestPracticePoints } from "../../lib/guestClient";
import {
  isSpeechRecognitionSupported,
  SpeechController,
  startSpeechRecognition,
} from "../../lib/speech";

interface VocabContextQuizProps {
  items: VocabularyItem[];
}

type QuizPhase = "idle" | "playing" | "finished";

interface AnswerFeedback {
  selected: string;
  isCorrect: boolean;
}

const QUIZ_DURATION_SEC = 60;
const QUIZ_QUESTION_COUNT = 5;
const PASSING_ACCURACY = 80;
const REWARD_POINTS = 2000;

export function VocabContextQuiz({ items }: VocabContextQuizProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [phase, setPhase] = useState<QuizPhase>("idle");
  const [questions, setQuestions] = useState<VocabQuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(QUIZ_DURATION_SEC);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [spokenText, setSpokenText] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [rewardGranted, setRewardGranted] = useState(false);

  const speechRef = useRef<SpeechController | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rewardClaimedRef = useRef(false);
  const lockedRef = useRef(false);

  useEffect(() => {
    setSpeechSupported(isSpeechRecognitionSupported());
  }, []);

  const stopSpeech = useCallback(() => {
    if (speechRef.current) {
      speechRef.current.abort();
      speechRef.current = null;
    }
    setIsListening(false);
  }, []);

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopSpeech();
      clearAdvanceTimer();
    };
  }, [stopSpeech, clearAdvanceTimer]);

  const finishQuiz = useCallback(
    (finalCorrect: number, totalQuestions: number) => {
      stopSpeech();
      clearAdvanceTimer();
      setPhase("finished");

      const accuracy =
        totalQuestions > 0 ? Math.round((finalCorrect / totalQuestions) * 100) : 0;
      if (accuracy >= PASSING_ACCURACY && !rewardClaimedRef.current) {
        rewardClaimedRef.current = true;
        setRewardGranted(true);
        void reportGuestPracticePoints("vocab-context-quiz", REWARD_POINTS);
      }
    },
    [stopSpeech, clearAdvanceTimer]
  );

  useEffect(() => {
    if (phase !== "playing") return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (phase === "playing" && timeLeft === 0) {
      finishQuiz(correctCount, questions.length);
    }
  }, [phase, timeLeft, correctCount, questions.length, finishQuiz]);

  const startQuiz = useCallback(() => {
    if (items.length === 0) return;
    stopSpeech();
    clearAdvanceTimer();
    rewardClaimedRef.current = false;
    lockedRef.current = false;

    const generated = buildVocabQuizQuestions(items, QUIZ_QUESTION_COUNT);
    setQuestions(generated);
    setCurrentIndex(0);
    setCorrectCount(0);
    setTimeLeft(QUIZ_DURATION_SEC);
    setFeedback(null);
    setSpokenText("");
    setVoiceError(null);
    setRewardGranted(false);
    setIsExpanded(true);
    setPhase("playing");
  }, [items, stopSpeech, clearAdvanceTimer]);

  const collapseQuiz = useCallback(() => {
    stopSpeech();
    clearAdvanceTimer();
    setIsExpanded(false);
    if (phase === "playing") {
      setPhase("idle");
    }
  }, [phase, stopSpeech, clearAdvanceTimer]);

  const handleToggleBanner = () => {
    if (isExpanded) {
      collapseQuiz();
    } else if (phase === "idle") {
      startQuiz();
    } else {
      setIsExpanded(true);
    }
  };

  const submitAnswer = useCallback(
    (selectedTerm: string, isCorrect: boolean) => {
      if (phase !== "playing" || lockedRef.current) return;
      lockedRef.current = true;
      stopSpeech();

      const nextCorrect = isCorrect ? correctCount + 1 : correctCount;
      if (isCorrect) {
        setCorrectCount(nextCorrect);
      }
      setFeedback({ selected: selectedTerm, isCorrect });

      const isLast = currentIndex + 1 >= questions.length;
      advanceTimerRef.current = setTimeout(() => {
        if (isLast) {
          finishQuiz(nextCorrect, questions.length);
        } else {
          setCurrentIndex((prev) => prev + 1);
          setFeedback(null);
          setSpokenText("");
          setVoiceError(null);
          lockedRef.current = false;
        }
      }, 700);
    },
    [phase, correctCount, currentIndex, questions.length, stopSpeech, finishQuiz]
  );

  const handleVoiceAnswer = () => {
    if (phase !== "playing" || lockedRef.current) return;
    if (isListening) {
      stopSpeech();
      return;
    }

    const currentQuestion = questions[currentIndex];
    if (!currentQuestion) return;

    setVoiceError(null);
    setSpokenText("");

    speechRef.current = startSpeechRecognition({
      onStart: () => {
        setIsListening(true);
      },
      onTranscript: (transcript, isFinal) => {
        setSpokenText(transcript);
        if (isVoiceQuizMatch(transcript, currentQuestion.targetTerm)) {
          submitAnswer(currentQuestion.targetTerm, true);
          return;
        }
        if (isFinal) {
          setVoiceError(`Nghe được "${transcript}" — chưa khớp thuật ngữ cần điền.`);
        }
      },
      onEnd: () => {
        setIsListening(false);
        speechRef.current = null;
      },
      onError: (message) => {
        setIsListening(false);
        speechRef.current = null;
        setVoiceError(message);
      },
    });
  };

  if (items.length === 0) return null;

  const currentQuestion = questions[currentIndex];
  const accuracy =
    questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

  return (
    <div className="bg-white border border-ink/15 rounded-2xl shadow-soft overflow-hidden">
      <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-paper/60">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-ink">
                60-Second Context Recall Quiz
              </h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-pill bg-amber-100 text-amber-800 border border-amber-300/60">
                <Coins className="w-3 h-3" />
                +2 IT-Coins (≥80%)
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              Điền nhanh thuật ngữ IT vào ngữ cảnh kỹ thuật bằng cách chọn hoặc nói qua micro.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          {!isExpanded && (
            <button
              type="button"
              onClick={startQuiz}
              className="px-3.5 py-1.5 rounded-pill bg-accent text-white text-xs font-semibold shadow-soft hover:opacity-95 transition-opacity"
            >
              Bắt đầu Quiz
            </button>
          )}
          <button
            type="button"
            onClick={handleToggleBanner}
            aria-label={isExpanded ? "Thu gọn quiz" : "Mở rộng quiz"}
            className="w-8 h-8 rounded-full bg-white border border-ink/15 flex items-center justify-center text-ink-muted hover:text-ink transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {isExpanded && phase === "playing" && currentQuestion && (
        <div className="p-5 border-t border-ink/10 space-y-4">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-ink-muted">
              Câu {currentIndex + 1}/{questions.length} · Đúng: {correctCount}
            </span>
            <span
              className={`inline-flex items-center gap-1 font-semibold px-2.5 py-0.5 rounded-pill border ${
                timeLeft <= 10
                  ? "bg-red-50 text-red-600 border-red-200"
                  : "bg-paper text-ink border-ink/15"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              {timeLeft}s
            </span>
          </div>

          <div className="bg-paper rounded-xl p-4 border border-ink/10 space-y-2">
            <p className="text-sm font-medium text-ink leading-relaxed">
              {currentQuestion.prompt.split("____").map((part, idx, arr) => (
                <span key={idx}>
                  {part}
                  {idx < arr.length - 1 && (
                    <span className="inline-block mx-1 px-2.5 py-0.5 rounded-md bg-white border border-dashed border-accent text-accent font-mono text-xs font-semibold">
                      {feedback ? currentQuestion.targetTerm : "____"}
                    </span>
                  )}
                </span>
              ))}
            </p>
            <p className="text-xs text-ink-muted">
              <span className="font-semibold text-ink">Gợi ý:</span>{" "}
              {currentQuestion.meaningHint}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {currentQuestion.choices.map((choice) => {
              const isSelected = feedback?.selected === choice;
              const isTarget = choice === currentQuestion.targetTerm;
              let buttonStyle =
                "bg-white border-ink/15 text-ink hover:border-accent hover:bg-accent/5";
              if (feedback) {
                if (isTarget) {
                  buttonStyle =
                    "bg-emerald-50 border-emerald-400 text-emerald-800";
                } else if (isSelected && !feedback.isCorrect) {
                  buttonStyle = "bg-red-50 border-red-400 text-red-700";
                } else {
                  buttonStyle = "bg-paper border-ink/10 text-ink-muted opacity-60";
                }
              }

              return (
                <button
                  key={choice}
                  type="button"
                  disabled={Boolean(feedback)}
                  onClick={() =>
                    submitAnswer(choice, choice === currentQuestion.targetTerm)
                  }
                  className={`px-4 py-2.5 rounded-xl border text-left font-mono text-xs font-semibold transition-all flex items-center justify-between ${buttonStyle}`}
                >
                  <span>{choice}</span>
                  {feedback && isTarget && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                  {feedback && isSelected && !feedback.isCorrect && (
                    <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {speechSupported && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                disabled={Boolean(feedback)}
                onClick={handleVoiceAnswer}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-pill text-xs font-medium border transition-colors ${
                  isListening
                    ? "bg-red-50 border-red-300 text-red-600"
                    : "bg-paper border-ink/15 text-ink hover:border-accent"
                }`}
              >
                {isListening ? (
                  <>
                    <MicOff className="w-3.5 h-3.5" />
                    <span>Đang nghe... (Nhấn để dừng)</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5 text-accent" />
                    <span>Nói thuật ngữ (Web Speech)</span>
                  </>
                )}
              </button>

              {(spokenText || voiceError) && (
                <span className="text-xs text-ink-muted">
                  {voiceError ? voiceError : `Đã nghe: "${spokenText}"`}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {isExpanded && phase === "finished" && (
        <div className="p-5 border-t border-ink/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-ink">
                Kết quả: {correctCount}/{questions.length} ({accuracy}%)
              </span>
              {rewardGranted && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-pill bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Coins className="w-3.5 h-3.5" />
                  +2 IT-Coins đã được cộng!
                </span>
              )}
            </div>
            <p className="text-xs text-ink-muted">
              {accuracy >= PASSING_ACCURACY
                ? "Xuất sắc! Bạn đã nắm vững ngữ cảnh sử dụng các thuật ngữ IT."
                : "Đạt từ 80% trở lên trong 60 giây để nhận thưởng +2 IT-Coins."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={startQuiz}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-pill bg-accent text-white text-xs font-semibold shadow-soft hover:opacity-95 transition-opacity"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Chơi lại</span>
            </button>
            <button
              type="button"
              onClick={collapseQuiz}
              className="px-3.5 py-1.5 rounded-pill bg-paper border border-ink/15 text-ink text-xs font-medium hover:bg-paper-muted transition-colors"
            >
              Thu gọn
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

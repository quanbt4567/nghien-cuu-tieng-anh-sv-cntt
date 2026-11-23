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
import { awardPracticePoints, getGamificationState } from "../../lib/gamification";
import { storageAdapter } from "../../lib/storage";
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

const QUIZ_DURATION_SEC = 90;
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
      const passed = accuracy >= PASSING_ACCURACY;
      if (totalQuestions > 0) {
        void storageAdapter.saveAttempt({
          scenario: "vocab-quiz-60s",
          turn_index: 0,
          transcript: `Vocab Quiz 60s: ${finalCorrect}/${totalQuestions} (${accuracy}%)${passed ? ` (+${REWARD_POINTS} pts)` : ""}`,
          score: accuracy,
          keywords_used: [],
          role: getGamificationState().selectedRole,
        });
      }
      if (passed && !rewardClaimedRef.current) {
        rewardClaimedRef.current = true;
        setRewardGranted(true);
        awardPracticePoints(REWARD_POINTS);
        void reportGuestPracticePoints("vocab-quiz-60s", REWARD_POINTS);
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
          setVoiceError(`Nghe Ä‘Æ°á»£c "${transcript}", chÆ°a khá»›p thuáº­t ngá»¯ cáº§n Ä‘iá»n.`);
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
    <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#262626] rounded-xl overflow-hidden">
      <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
                90-Second Context Recall Quiz
              </h2>
              <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <Coins className="w-3 h-3" />
                +2 IT-Coins (â‰¥80%)
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
              Äiá»n nhanh thuáº­t ngá»¯ IT vÃ o ngá»¯ cáº£nh ká»¹ thuáº­t báº±ng cÃ¡ch chá»n hoáº·c nÃ³i qua micro.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          {!isExpanded && (
            <button
              type="button"
              onClick={startQuiz}
              className="bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              Báº¯t Ä‘áº§u Quiz
            </button>
          )}
          <button
            type="button"
            onClick={handleToggleBanner}
            aria-label={isExpanded ? "Thu gá»n quiz" : "Má»Ÿ rá»™ng quiz"}
            className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
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
        <div className="p-5 border-t border-slate-200 dark:border-[#262626] space-y-4">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-600 dark:text-slate-300">
              CÃ¢u {currentIndex + 1}/{questions.length} Â· ÄÃºng: {correctCount}
            </span>
            <span
              className={`inline-flex items-center gap-1 font-semibold px-2.5 py-0.5 rounded-full border ${
                timeLeft <= 10
                  ? "bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800 animate-pulse"
                  : "bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              {timeLeft}s
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-[#141414] rounded-xl p-4 space-y-2">
            <p className="text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
              {currentQuestion.prompt.split("____").map((part, idx, arr) => (
                <span key={idx}>
                  {part}
                  {idx < arr.length - 1 && (
                    <span className="inline-block mx-1 px-2.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 border border-dashed border-blue-400 dark:border-blue-600 text-blue-800 dark:text-blue-300 font-mono text-sm font-semibold">
                      {feedback ? currentQuestion.targetTerm : "____"}
                    </span>
                  )}
                </span>
              ))}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-slate-100">Gá»£i Ã½:</span>{" "}
              {currentQuestion.meaningHint}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {currentQuestion.choices.map((choice) => {
              const isSelected = feedback?.selected === choice;
              const isTarget = choice === currentQuestion.targetTerm;
              let buttonStyle =
                "bg-slate-50 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40";
              if (feedback) {
                if (isTarget) {
                  buttonStyle =
                    "bg-green-50 dark:bg-green-950/50 border-green-300 dark:border-green-700 text-green-800 dark:text-green-300";
                } else if (isSelected && !feedback.isCorrect) {
                  buttonStyle =
                    "bg-red-50 dark:bg-red-950/50 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300";
                } else {
                  buttonStyle =
                    "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-500 opacity-60";
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
                  className={`px-4 py-2.5 rounded-lg border text-left font-mono text-sm font-semibold transition-colors flex items-center justify-between ${buttonStyle}`}
                >
                  <span>{choice}</span>
                  {feedback && isTarget && (
                    <CheckCircle2 className="w-4 h-4 text-green-700 dark:text-green-400 shrink-0" />
                  )}
                  {feedback && isSelected && !feedback.isCorrect && (
                    <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
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
                className={`text-white inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  isListening
                    ? "bg-red-600 hover:bg-red-700 animate-pulse"
                    : "bg-green-700 hover:bg-green-800"
                }`}
              >
                {isListening ? (
                  <>
                    <MicOff className="w-4 h-4" />
                    <span>Äang nghe... (Nháº¥n Ä‘á»ƒ dá»«ng)</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    <span>NÃ³i thuáº­t ngá»¯ (Web Speech)</span>
                  </>
                )}
              </button>

              {(spokenText || voiceError) && (
                <span
                  className={`text-sm ${
                    voiceError
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {voiceError ? voiceError : `ÄÃ£ nghe: "${spokenText}"`}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {isExpanded && phase === "finished" && (
        <div className="p-5 border-t border-slate-200 dark:border-[#262626] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-slate-900 dark:text-slate-50">
                Káº¿t quáº£: {correctCount}/{questions.length} ({accuracy}%)
              </span>
              {rewardGranted && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-green-50 dark:bg-green-950/50 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800">
                  <Coins className="w-3.5 h-3.5" />
                  +2 IT-Coins Ä‘Ã£ Ä‘Æ°á»£c cá»™ng!
                </span>
              )}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {accuracy >= PASSING_ACCURACY
                ? "Xuáº¥t sáº¯c! Báº¡n Ä‘Ã£ náº¯m vá»¯ng ngá»¯ cáº£nh sá»­ dá»¥ng cÃ¡c thuáº­t ngá»¯ IT."
                : "Äáº¡t tá»« 80% trá»Ÿ lÃªn trong 60 giÃ¢y Ä‘á»ƒ nháº­n thÆ°á»Ÿng +2 IT-Coins."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={startQuiz}
              className="bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>ChÆ¡i láº¡i</span>
            </button>
            <button
              type="button"
              onClick={collapseQuiz}
              className="px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium transition-colors"
            >
              Thu gá»n
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

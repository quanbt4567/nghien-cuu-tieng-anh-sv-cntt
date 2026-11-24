"use client";

import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { PlanDay } from "../../lib/planGenerator";

interface SevenDayPlanProps {
  days: PlanDay[];
}

export function SevenDayPlan({ days }: SevenDayPlanProps) {
  const completedCount = days.filter((d) => d.isCompleted).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Kế Hoạch Luyện Tập 7 Ngày Thích Ứng
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
            Tự động đưa các từ khóa bạn thường quên lên các ngày đầu để lặp lại ngắt quãng
          </p>
        </div>
        <span
          className={`text-xs font-mono font-bold px-3 py-1 rounded-full border shrink-0 ${
            completedCount > 0
              ? "bg-green-50 dark:bg-green-950/50 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800"
              : "bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800"
          }`}
        >
          {completedCount}/7 Ngày đã luyện
        </span>
      </div>

      <div className="space-y-4">
        {days.map((day) => (
          <div
            key={day.dayNumber}
            className={`rounded-xl border p-5 sm:p-6 transition-colors ${
              day.isCompleted
                ? "bg-green-50/40 dark:bg-green-950/20 border-green-300 dark:border-green-800"
                : "bg-white dark:bg-[#1E293B] border-slate-200 dark:border-[#334155] hover:border-blue-300 dark:hover:border-blue-700"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center border shrink-0 font-mono font-bold text-xs ${
                    day.isCompleted
                      ? "bg-green-100 dark:bg-green-950/60 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700"
                      : "bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                  }`}
                >
                  {day.dayNumber}
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-base text-slate-900 dark:text-slate-50">
                      {day.dayLabel}: {day.scenarioTitleVI}
                    </span>
                    {day.isCompleted && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 text-xs font-mono text-green-800 dark:text-green-300 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-700 dark:text-green-400" />
                        Đã luyện
                      </span>
                    )}
                    {day.priorityNoteVI && (
                      <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-semibold">
                        {day.priorityNoteVI}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-sm text-slate-600 dark:text-slate-300">
                      Trọng tâm:
                    </span>
                    {day.focusKeywords.map((kw) => (
                      <span
                        key={kw}
                        className="px-2.5 py-0.5 text-xs font-mono rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="shrink-0 pt-2 sm:pt-0 flex justify-end">
                <Link
                  href={`/practice/${day.scenarioId}`}
                  className={`text-white inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    day.isCompleted
                      ? "bg-green-700 hover:bg-green-800"
                      : "bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700"
                  }`}
                >
                  <span>{day.isCompleted ? "Luyện lại" : "Bắt đầu"}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

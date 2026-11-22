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
          <h2 className="text-xl font-bold tracking-tight text-white">
            Kế Hoạch Luyện Tập 7 Ngày Thích Ứng
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Tự động đưa các từ khóa bạn thường quên lên các ngày đầu để lặp lại ngắt quãng
          </p>
        </div>
        <span
          className={`text-xs font-mono font-bold px-3 py-1 rounded-full border shrink-0 ${
            completedCount > 0
              ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/50"
              : "bg-cyan-500/20 text-cyan-200 border-cyan-400/45"
          }`}
        >
          {completedCount}/7 Ngày đã luyện
        </span>
      </div>

      <div className="space-y-4">
        {days.map((day) => (
          <div
            key={day.dayNumber}
            className={`liquid-glass-card-lite rounded-3xl p-5 sm:p-6 transition-all ${
              day.isCompleted
                ? "!bg-emerald-500/15 !border-emerald-400/45"
                : "hover:!border-white/30"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center border shrink-0 font-mono font-bold text-xs ${
                    day.isCompleted
                      ? "bg-emerald-500/30 text-emerald-100 border-emerald-400/60"
                      : "bg-cyan-500/20 text-cyan-200 border-cyan-400/45"
                  }`}
                >
                  {day.dayNumber}
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-white">
                      {day.dayLabel}: {day.scenarioTitleVI}
                    </span>
                    {day.isCompleted && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-[11px] font-mono text-emerald-200 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                        Đã luyện
                      </span>
                    )}
                    {day.priorityNoteVI && (
                      <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/45">
                        {day.priorityNoteVI}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-slate-400">Trọng tâm:</span>
                    {day.focusKeywords.map((kw) => (
                      <span
                        key={kw}
                        className="px-2.5 py-0.5 text-[11px] font-mono rounded-full bg-slate-950/60 border border-white/15 text-slate-200"
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
                  className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    day.isCompleted ? "liquid-btn-success" : "liquid-btn-primary"
                  }`}
                >
                  <span>{day.isCompleted ? "Luyện lại" : "Bắt đầu"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


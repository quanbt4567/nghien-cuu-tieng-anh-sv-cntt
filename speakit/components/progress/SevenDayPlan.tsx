"use client";

import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight, Tag, AlertCircle } from "lucide-react";
import { PlanDay } from "../../lib/planGenerator";

interface SevenDayPlanProps {
  days: PlanDay[];
}

export function SevenDayPlan({ days }: SevenDayPlanProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-ink">
            Kế Hoạch Luyện Tập 7 Ngày Thích Ứng
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Tự động đưa các từ khóa bạn thường quên lên các ngày đầu để lặp lại ngắt quãng
          </p>
        </div>
        <span className="text-xs font-mono font-bold text-accent bg-accent-light px-3 py-1 rounded-pill border border-accent/30">
          {days.filter((d) => d.isCompleted).length}/7 Ngày đã luyện
        </span>
      </div>

      <div className="space-y-4">
        {days.map((day) => (
          <div
            key={day.dayNumber}
            className={`bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft hover:shadow-card transition-all ${
              day.isCompleted ? "opacity-90" : ""
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-9 h-9 rounded-pill flex items-center justify-center border border-ink/20 shrink-0 font-mono font-bold text-xs ${
                    day.isCompleted
                      ? "bg-accent text-white border-accent"
                      : "bg-paper text-ink"
                  }`}
                >
                  {day.dayNumber}
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-ink">
                      {day.dayLabel}: {day.scenarioTitleVI}
                    </span>
                    {day.isCompleted && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-accent font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Đã luyện
                      </span>
                    )}
                    {day.priorityNoteVI && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-pill bg-accent-light text-accent border border-accent">
                        {day.priorityNoteVI}
                      </span>
                    )}
                  </div>

                  {/* Target keywords */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-ink-muted">Trọng tâm:</span>
                    {day.focusKeywords.map((kw) => (
                      <span
                        key={kw}
                        className="px-2 py-0.5 text-[11px] font-mono rounded-pill bg-paper border border-ink text-ink"
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
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-pill bg-paper-card text-ink text-xs font-semibold border border-ink/15 shadow-soft hover:bg-paper-muted transition-all"
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


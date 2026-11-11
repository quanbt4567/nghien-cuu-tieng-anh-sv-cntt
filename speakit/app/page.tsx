import Link from "next/link";
import { Mic, ArrowRight, Play, Terminal, Sparkles, BookOpen, Clock } from "lucide-react";
import { EF_EPI_2025 } from "../data/efEpiData";
import { SCENARIOS } from "../data/scenarios";

export default function HomePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">
      {/* 1. Research Problem & EF EPI 2025 Evidence Banner */}
      <section className="bg-white border-2 border-ink rounded-2xl p-6 shadow-hard space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-paper-muted pb-3">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            Báo cáo Nghiên cứu Thực tế • EF EPI 2025
          </span>
          <span className="text-[11px] font-mono text-ink-muted">
            {EF_EPI_2025.targetDemographic}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2">
          <div className="bg-paper p-3 rounded-xl border border-ink text-center">
            <div className="text-2xl sm:text-3xl font-mono font-bold text-ink">
              {EF_EPI_2025.score}
            </div>
            <div className="text-[11px] text-ink-muted mt-1">Điểm VN trung bình</div>
          </div>
          <div className="bg-paper p-3 rounded-xl border border-ink text-center">
            <div className="text-2xl sm:text-3xl font-mono font-bold text-ink">
              {EF_EPI_2025.globalRank}
              <span className="text-xs text-ink-muted">/{EF_EPI_2025.totalCountries}</span>
            </div>
            <div className="text-[11px] text-ink-muted mt-1">Hạng toàn cầu</div>
          </div>
          <div className="bg-paper p-3 rounded-xl border border-ink text-center">
            <div className="text-2xl sm:text-3xl font-mono font-bold text-ink">
              {EF_EPI_2025.asiaRank}
              <span className="text-xs text-ink-muted">/{EF_EPI_2025.totalAsiaCountries}</span>
            </div>
            <div className="text-[11px] text-ink-muted mt-1">Hạng châu Á</div>
          </div>
          <div className="bg-accent-light p-3 rounded-xl border-2 border-accent text-center">
            <div className="text-2xl sm:text-3xl font-mono font-bold text-accent">
              {EF_EPI_2025.skills.speaking}
            </div>
            <div className="text-[11px] font-bold text-accent mt-1">Nói (Yếu nhất)</div>
          </div>
        </div>

        <div className="text-xs sm:text-sm text-ink-muted leading-relaxed space-y-2 pt-1">
          <p>
            <strong className="text-ink">Vấn đề cốt lõi:</strong> Sinh viên CNTT thường đọc tài liệu kỹ thuật tốt (kỹ năng Đọc: {EF_EPI_2025.skills.reading} điểm), nhưng gặp rào cản lớn khi nói (kỹ năng Nói: {EF_EPI_2025.skills.speaking} điểm) trong các buổi họp Daily Standup, Bug Triage, Code Review hoặc phỏng vấn vì thiếu môi trường giao tiếp thực tế.
          </p>
          <p className="text-[11px] font-mono text-ink-faint">
            * {EF_EPI_2025.sourceCitation}. Mở miễn phí cho sinh viên IUH & thành viên CLB BCN. Không cần đăng nhập.
          </p>
        </div>
      </section>

      {/* 2. Direct CTA Banner: Try One Standup Turn */}
      <section className="bg-paper-card border-2 border-ink rounded-2xl p-6 shadow-hard flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-1.5 text-center sm:text-left">
          <span className="inline-block px-2.5 py-0.5 text-[11px] font-mono font-semibold bg-accent-light text-accent rounded-pill border border-accent">
            Khởi động nhanh trong 1 lượt
          </span>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
            Thử một lượt Daily Standup ngay
          </h2>
          <p className="text-xs sm:text-sm text-ink-muted">
            Nghe câu hỏi tiếng Anh, bật micro nói câu trả lời và xem điểm số từ khóa tức thì.
          </p>
        </div>
        <Link
          href="/practice/daily-standup"
          className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-6 py-3 rounded-pill bg-accent text-white font-semibold text-sm border-2 border-ink shadow-hard shadow-hard-press hover:bg-accent-hover transition-all"
        >
          <Play className="w-4 h-4 fill-white" />
          <span>Luyện tập ngay</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      {/* 3. Scenario Setlist Layout (Linear Hierarchy - Anti-Grid) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-ink">
              Kịch Bản Tình Huống Công Việc (6)
            </h2>
            <p className="text-xs text-ink-muted">
              Mỗi kịch bản gồm đúng 3 lượt hội thoại phản xạ công việc thực tế
            </p>
          </div>
          <span className="text-xs font-mono text-ink-muted bg-paper-muted px-2.5 py-1 rounded-pill border border-ink">
            18 Lượt luyện
          </span>
        </div>

        <div className="space-y-3">
          {SCENARIOS.map((scenario, index) => (
            <Link
              key={scenario.id}
              href={`/practice/${scenario.id}`}
              className="block group bg-white border-2 border-ink rounded-2xl p-4 sm:p-5 shadow-hard-sm hover:shadow-hard transition-all shadow-hard-press"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="w-9 h-9 rounded-pill bg-paper flex items-center justify-center border-2 border-ink shrink-0 font-mono font-bold text-sm text-ink group-hover:bg-accent group-hover:text-white transition-colors">
                    0{index + 1}
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-base text-ink group-hover:text-accent transition-colors">
                        {scenario.titleEN}
                      </h3>
                      <span className="text-xs text-ink-faint">
                        ({scenario.titleVI})
                      </span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-pill bg-paper border border-ink text-ink-muted">
                        Vai: {scenario.roleVI}
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted line-clamp-2">
                      {scenario.descriptionVI}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end sm:justify-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-paper-muted">
                  <span className="text-xs font-mono text-ink-muted">3 lượt</span>
                  <div className="w-7 h-7 rounded-pill bg-paper flex items-center justify-center border border-ink group-hover:translate-x-1 transition-transform">
                    <ArrowRight className="w-3.5 h-3.5 text-ink" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 4. Quick Links to Vocabulary & 7-Day Plan */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/vocabulary"
          className="bg-paper-card border-2 border-ink rounded-2xl p-5 shadow-hard-sm hover:shadow-hard transition-all shadow-hard-press flex items-start gap-3"
        >
          <div className="w-10 h-10 rounded-pill bg-paper flex items-center justify-center border-2 border-ink shrink-0 text-ink">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-ink">12 Thuật Ngữ IT Thiết Yếu</h3>
            <p className="text-xs text-ink-muted">
              Luyện phát âm mẫu và học câu ví dụ chuẩn: standup, blocker, PR, deploy...
            </p>
          </div>
        </Link>

        <Link
          href="/progress"
          className="bg-paper-card border-2 border-ink rounded-2xl p-5 shadow-hard-sm hover:shadow-hard transition-all shadow-hard-press flex items-start gap-3"
        >
          <div className="w-10 h-10 rounded-pill bg-paper flex items-center justify-center border-2 border-ink shrink-0 text-ink">
            <Clock className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-ink">Kế Hoạch Ôn Tập 7 Ngày</h3>
            <p className="text-xs text-ink-muted">
              Hệ thống tự động gom từ khóa và điểm ngữ pháp bạn hay quên để lặp lại trước.
            </p>
          </div>
        </Link>
      </section>
    </div>
  );
}

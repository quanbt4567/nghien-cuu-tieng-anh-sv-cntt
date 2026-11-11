import Link from "next/link";
import { BookOpen, Clock, Gamepad2 } from "lucide-react";
import { HomeOnboardingClient } from "../components/home/HomeOnboardingClient";
import { EF_EPI_2025 } from "../data/efEpiData";

export default function HomePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-10 space-y-10">
      {/* Compact Page Intro */}
      <header className="space-y-2">
        <p className="text-xs font-mono font-semibold uppercase tracking-wider text-accent">
          SpeakIT • Luyện nói tiếng Anh CNTT • Không cần đăng nhập
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
          Luyện phản xạ nói tiếng Anh theo tình huống công việc
        </h1>
        <p className="text-xs sm:text-sm text-ink-muted">
          Chọn vai trò chuyên môn để bắt đầu nhanh trong ~3 phút, nhận phản hồi từ khóa tức thì và tích lũy IT-Coin.
        </p>
      </header>

      {/* Interactive 3-Step Onboarding & 6 Scenarios */}
      <HomeOnboardingClient />

      {/* Quick Links: Vocabulary (12), 7-Day Plan, IT Speaking Arena */}
      <section aria-label="Công cụ ôn tập nhanh" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/vocabulary"
          className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft hover:shadow-card hover:-translate-y-0.5 transition-all flex items-start gap-3.5"
        >
          <div className="w-9 h-9 rounded-pill bg-paper flex items-center justify-center border border-ink/15 shrink-0">
            <BookOpen className="w-4 h-4 text-accent" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-ink">Từ vựng IT (12)</h3>
            <p className="text-xs text-ink-muted">
              Phát âm IPA và câu ví dụ: standup, blocker, PR, deploy...
            </p>
          </div>
        </Link>

        <Link
          href="/progress"
          className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft hover:shadow-card hover:-translate-y-0.5 transition-all flex items-start gap-3.5"
        >
          <div className="w-9 h-9 rounded-pill bg-paper flex items-center justify-center border border-ink/15 shrink-0">
            <Clock className="w-4 h-4 text-accent" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-ink">Kế hoạch 7 ngày</h3>
            <p className="text-xs text-ink-muted">
              Tự động gom từ khóa và lỗi ngữ pháp hay quên để ôn lại.
            </p>
          </div>
        </Link>

        <Link
          href="/arena"
          className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft hover:shadow-card hover:-translate-y-0.5 transition-all flex items-start gap-3.5"
        >
          <div className="w-9 h-9 rounded-pill bg-paper flex items-center justify-center border border-ink/15 shrink-0">
            <Gamepad2 className="w-4 h-4 text-accent" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-ink">IT Speaking Arena</h3>
            <p className="text-xs text-ink-muted">
              Bug Buster 60s &amp; Standup Speed Run kiếm IT-Coin.
            </p>
          </div>
        </Link>
      </section>

      {/* Compact Verified EF EPI 2025 Benchmark */}
      <section
        aria-label="Số liệu tham chiếu EF EPI 2025"
        className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-paper-muted pb-3">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-ink">
            Số liệu tham chiếu • EF EPI {EF_EPI_2025.year} ({EF_EPI_2025.country})
          </span>
          <span className="text-[11px] font-mono text-ink-muted">
            {EF_EPI_2025.targetDemographic}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-paper p-3 rounded-xl border border-ink/10 text-center">
            <div className="text-xl sm:text-2xl font-mono font-bold text-ink">
              {EF_EPI_2025.score}
            </div>
            <div className="text-[11px] text-ink-muted mt-0.5">
              Điểm toàn quốc VN
            </div>
          </div>
          <div className="bg-paper p-3 rounded-xl border border-ink/10 text-center">
            <div className="text-xl sm:text-2xl font-mono font-bold text-ink">
              {EF_EPI_2025.globalRank}/{EF_EPI_2025.totalCountries}
            </div>
            <div className="text-[11px] text-ink-muted mt-0.5">
              Hạng toàn cầu
            </div>
          </div>
          <div className="bg-paper p-3 rounded-xl border border-ink/10 text-center">
            <div className="text-xl sm:text-2xl font-mono font-bold text-ink">
              {EF_EPI_2025.asiaRank}/{EF_EPI_2025.totalAsiaCountries}
            </div>
            <div className="text-[11px] text-ink-muted mt-0.5">
              Hạng châu Á
            </div>
          </div>
          <div className="bg-accent-light p-3 rounded-xl border border-accent/25 text-center">
            <div className="text-xl sm:text-2xl font-mono font-bold text-accent">
              Speaking {EF_EPI_2025.skills.speaking}
            </div>
            <div className="text-[11px] font-semibold text-accent mt-0.5">
              Yếu nhất (Reading {EF_EPI_2025.skills.reading})
            </div>
          </div>
        </div>

        <p className="text-[11px] font-mono text-ink-muted leading-relaxed">
          Nguồn: {EF_EPI_2025.sourceCitation}. Dữ liệu phản ánh mặt bằng toàn quốc ({EF_EPI_2025.targetDemographic}); SpeakIT mở miễn phí phục vụ luyện tập phản xạ nói tình huống CNTT.
        </p>
      </section>
    </div>
  );
}

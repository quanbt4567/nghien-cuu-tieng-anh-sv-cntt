import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Compass,
  Headphones,
  Mic,
  Sparkles,
  Volume2,
} from "lucide-react";
import { EF_EPI_2025 } from "../../data/efEpiData";

function buildHowItWorksSteps(scenarioCount: number) {
  return [
    {
      step: "01",
      title: "Nghe giọng AI Neural",
      description:
        "Nghe prompt từ 4 persona Microsoft Edge Neural TTS rõ ràng, tự nhiên theo ngữ cảnh kỹ thuật.",
      icon: Volume2,
    },
    {
      step: "02",
      title: "Nói phản xạ tình huống thật",
      description:
        `Trả lời trực tiếp qua micro cho Daily Standup, Code Review, Phỏng vấn với ${scenarioCount} tình huống công việc IT chia theo 3 cấp độ Fresher / Junior / Senior.`,
      icon: Mic,
    },
    {
      step: "03",
      title: "Nhận điểm & Shadowing",
      description:
        "AI chấm Pronunciation, Fluency, Vocabulary kèm câu mẫu chuẩn để luyện Shadowing và lưu lộ trình 7 ngày.",
      icon: Sparkles,
    },
  ];
}

function buildFeatureHighlights(scenarioCount: number) {
  return [
    `${scenarioCount} tình huống công việc IT`,
    "4 giọng Microsoft Edge Neural TTS",
    "Chấm điểm Pronunciation · Fluency · Vocabulary",
    "IT Speaking Arena & Kế hoạch 7 ngày",
  ];
}

export function HomeIntroHero({ scenarioCount }: { scenarioCount: number }) {
  const howItWorksSteps = buildHowItWorksSteps(scenarioCount);
  const featureHighlights = buildFeatureHighlights(scenarioCount);
  const speakingVsReadingGap =
    EF_EPI_2025.skills.reading - EF_EPI_2025.skills.speaking;
  const speakingPercent = Math.round((EF_EPI_2025.skills.speaking / 600) * 100);
  const readingPercent = Math.round((EF_EPI_2025.skills.reading / 600) * 100);

  return (
    <section aria-label="Giới thiệu SpeakIT" className="space-y-6">
      <div className="bg-white border border-ink/15 rounded-2xl p-6 sm:p-8 shadow-card">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          <div className="lg:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 rounded-pill px-3.5 py-1.5 bg-paper border border-ink/15 text-xs font-mono font-semibold text-[#B91C1C]">
              <Headphones className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>SpeakIT · AI IT English Coach</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink leading-[3rem]">
                Luyện phản xạ nói tiếng Anh CNTT theo tình huống công việc thật
              </h1>
              <p className="text-sm sm:text-base text-ink-muted leading-relaxed max-w-2xl">
                Dành riêng cho sinh viên CNTT và lập trình viên Fresher/Junior muốn bứt phá khả năng
                giao tiếp trong Daily Standup, Code Review, Technical Interview và IT Speaking Arena.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href="/scenarios"
                className="interactive-btn-accent inline-flex items-center gap-2 rounded-pill px-5 py-2.5 bg-accent hover:bg-accent-hover text-white border border-ink text-sm font-semibold shadow-soft"
              >
                <span>Bắt đầu luyện nói ngay</span>
                <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </Link>

              <Link
                href="/placement"
                className="interactive-btn inline-flex items-center gap-2 rounded-pill px-5 py-2.5 bg-paper text-ink border border-ink/25 text-sm font-semibold"
              >
                <Compass className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Kiểm tra trình độ (2 phút)</span>
              </Link>

              <Link
                href="/research"
                className="interactive-btn inline-flex items-center gap-1.5 rounded-pill px-3.5 py-2 bg-paper/60 border border-ink/15 text-xs font-mono font-semibold text-ink-muted hover:text-ink"
              >
                <BarChart3 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Số liệu &amp; Nghiên cứu</span>
              </Link>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {featureHighlights.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center rounded-pill px-3 py-1 bg-paper border border-ink/15 text-[11px] font-mono text-ink-muted"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <aside
            aria-label="Số liệu thống kê — Bối cảnh tiếng Anh CNTT"
            className="lg:col-span-5 bg-paper border border-ink/15 rounded-2xl p-5 shadow-soft space-y-4"
          >
            <div className="space-y-1.5">
              <p className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#B91C1C]">
                EF EPI {EF_EPI_2025.year} · {EF_EPI_2025.country}
              </p>
              <h2 className="text-base font-bold text-ink">
                Số liệu thống kê — Bối cảnh tiếng Anh CNTT
              </h2>
              <p className="text-xs text-ink-muted leading-relaxed">
                Chỉ số EF EPI 2025 toàn quốc cho thấy người Việt đọc hiểu khá tốt nhưng phản xạ nói còn yếu — lý do bạn cần luyện nói mỗi ngày.
              </p>
            </div>

            <div className="border-t border-ink/10 pt-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono text-ink-muted">
                  Điểm tổng EF EPI toàn quốc
                </span>
                <span className="font-mono text-sm font-bold text-ink shrink-0">
                  {EF_EPI_2025.score} điểm
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-ink/10 text-xs">
                <div className="space-y-0.5">
                  <div className="text-[11px] font-mono text-ink-muted">Xếp hạng toàn cầu</div>
                  <div className="text-sm font-mono font-bold text-ink">
                    <span className="whitespace-nowrap">
                      Hạng #{EF_EPI_2025.globalRank}/{EF_EPI_2025.totalCountries}
                    </span>{" "}
                    <span className="whitespace-nowrap">quốc gia</span>
                  </div>
                </div>
                <div className="space-y-0.5 border-l border-ink/10 pl-3">
                  <div className="text-[11px] font-mono text-ink-muted">
                    Xếp hạng <span className="whitespace-nowrap">châu Á</span>
                  </div>
                  <div className="text-sm font-mono font-bold text-ink">
                    <span className="whitespace-nowrap">
                      Hạng #{EF_EPI_2025.asiaRank}/{EF_EPI_2025.totalAsiaCountries}
                    </span>{" "}
                    <span className="whitespace-nowrap">quốc gia</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 border-t border-ink/10 pt-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-ink font-semibold">Kỹ năng Đọc tài liệu (Reading)</span>
                  <span className="text-ink font-bold">{EF_EPI_2025.skills.reading} điểm</span>
                </div>
                <div className="h-2 rounded-pill bg-ink/10 overflow-hidden">
                  <div
                    className="h-full w-full origin-left bg-ink rounded-pill transition-transform duration-500"
                    style={{ transform: `scaleX(${readingPercent / 100})` }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-[#B91C1C] font-semibold">Kỹ năng Nói — yếu nhất (Speaking)</span>
                  <span className="text-[#B91C1C] font-bold">{EF_EPI_2025.skills.speaking} điểm</span>
                </div>
                <div className="h-2 rounded-pill bg-ink/10 overflow-hidden">
                  <div
                    className="h-full w-full origin-left bg-accent rounded-pill transition-transform duration-500"
                    style={{ transform: `scaleX(${speakingPercent / 100})` }}
                  />
                </div>
              </div>
            </div>

            <p className="text-xs text-ink-muted leading-relaxed border-t border-ink/10 pt-3">
              Kỹ năng Nói tại Việt Nam thấp hơn Đọc tới{" "}
              <span className="font-mono font-semibold text-ink">
                {speakingVsReadingGap} điểm
              </span>{" "}
              do quen đọc docs nhưng thiếu môi trường phản xạ miệng. SpeakIT thu hẹp khoảng cách
              này bằng hội thoại voice-first, chấm điểm AI theo lượt nói và luyện Shadowing mỗi ngày.
            </p>
          </aside>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {howItWorksSteps.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.step}
              className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft flex items-start gap-3.5"
            >
              <div className="w-10 h-10 rounded-pill bg-paper border border-ink/15 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-accent" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <div className="text-[11px] font-mono font-bold text-[#B91C1C]">
                  BƯỚC {item.step}
                </div>
                <h3 className="text-sm font-bold text-ink">{item.title}</h3>
                <p className="text-xs text-ink-muted leading-relaxed">{item.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

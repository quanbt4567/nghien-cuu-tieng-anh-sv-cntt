import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock,
  Compass,
  Gamepad2,
  MessageSquare,
  Mic,
  Settings,
  ShoppingBag,
  Volume2,
} from "lucide-react";
import { EF_EPI_2025 } from "../../data/efEpiData";

function buildHowItWorksSteps(scenarioCount: number) {
  return [
    {
      step: "01",
      title: "Nghe câu hỏi chậm rõ bằng tiếng Anh",
      description:
        "Nghe 4 giọng đọc AI tự nhiên theo tình huống đi làm (có nút nghe chậm từng từ cho người mới).",
      icon: Volume2,
    },
    {
      step: "02",
      title: "Tập nói theo mẫu câu dễ dùng",
      description:
        `Luyện trả lời qua micro với ${scenarioCount} tình huống từ mới bắt đầu (Fresher) đến đi làm thật (Junior / Senior), có gợi ý tiếng Việt chi tiết.`,
      icon: Mic,
    },
    {
      step: "03",
      title: "Chấm điểm & nghe nhại lại (Shadowing)",
      description:
        "AI góp ý cách phát âm, độ trôi chảy và từ vựng, kèm câu mẫu để bạn nghe và nói nhại lại theo nhịp.",
      icon: CheckCircle2,
    },
  ];
}

function buildFeatureHighlights(scenarioCount: number) {
  return [
    `${scenarioCount} tình huống công việc IT (kèm gợi ý cho người mất gốc)`,
    "Chạm bất kỳ từ tiếng Anh nào để xem nghĩa tiếng Việt ngay",
    "Chấm điểm Phát âm · Độ trôi chảy · Từ vựng",
    "Đấu trường phản xạ & Kế hoạch ôn tập 7 ngày",
  ];
}

function buildMobileShortcuts(scenarioCount: number) {
  return [
    {
      href: "/scenarios",
      title: "Kịch bản",
      subtitle: `${scenarioCount} tình huống IT`,
      icon: MessageSquare,
    },
    {
      href: "/arena",
      title: "Đấu trường Arena",
      subtitle: "Thử thách 60s",
      icon: Gamepad2,
    },
    {
      href: "/vocabulary",
      title: "Từ vựng IT",
      subtitle: "Phát âm IPA",
      icon: BookOpen,
    },
    {
      href: "/shop",
      title: "Shop IT-Coin",
      subtitle: "Đổi hiệu ứng",
      icon: ShoppingBag,
    },
    {
      href: "/progress",
      title: "Tiến độ 7 ngày",
      subtitle: "Lộ trình ôn tập",
      icon: Clock,
    },
    {
      href: "/settings",
      title: "Cài đặt",
      subtitle: "Giọng đọc & AI",
      icon: Settings,
    },
  ];
}

export function HomeIntroHero({ scenarioCount }: { scenarioCount: number }) {
  const howItWorksSteps = buildHowItWorksSteps(scenarioCount);
  const featureHighlights = buildFeatureHighlights(scenarioCount);
  const mobileShortcuts = buildMobileShortcuts(scenarioCount);
  const speakingVsReadingGap =
    EF_EPI_2025.skills.reading - EF_EPI_2025.skills.speaking;
  const speakingPercent = Math.round((EF_EPI_2025.skills.speaking / 600) * 100);
  const readingPercent = Math.round((EF_EPI_2025.skills.reading / 600) * 100);

  return (
    <section aria-label="Giới thiệu SpeakIT" className="space-y-6">
      <div className="md:hidden space-y-4">
        <div className="liquid-glass-card p-5 space-y-4">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 leading-snug">
              Luyện phản xạ tiếng Anh CNTT
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Daily Standup · Code Review · Technical Interview
            </p>
          </div>

          <div className="space-y-2.5">
            <Link
              href="/scenarios"
              className="w-full flex items-center justify-center gap-2 rounded-lg px-5 py-3.5 bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-sm font-semibold active:scale-[0.98] transition-colors"
            >
              <span>Bắt đầu luyện nói ngay</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </Link>

            <Link
              href="/placement"
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm font-semibold active:scale-[0.98] transition-colors"
            >
              <Compass className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" aria-hidden="true" />
              <span>Kiểm tra trình độ</span>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {mobileShortcuts.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="liquid-glass-card-lite active:scale-[0.98] hover:!border-blue-700 dark:hover:!border-blue-400 transition-colors p-3.5 flex flex-col gap-2.5"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-blue-700 dark:text-blue-400" aria-hidden="true" />
                </div>
                <div className="space-y-0.5">
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-50 leading-tight">
                    {item.title}
                  </div>
                  <div className="text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    {item.subtitle}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <details className="group liquid-glass-card-lite overflow-hidden">
          <summary className="list-none cursor-pointer flex items-center justify-between gap-2 px-4 py-3 text-sm font-mono font-semibold text-slate-900 dark:text-slate-50 select-none">
            <span className="flex items-center gap-2 min-w-0">
              <BarChart3 className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" aria-hidden="true" />
              <span className="truncate">
                Số liệu EF EPI {EF_EPI_2025.year} · {EF_EPI_2025.country} {EF_EPI_2025.score} điểm
              </span>
            </span>
            <ChevronDown
              className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>

          <div className="px-4 pb-4 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-2 font-mono text-xs">
              <span className="text-slate-600 dark:text-slate-400">
                Toàn cầu #{EF_EPI_2025.globalRank}/{EF_EPI_2025.totalCountries}
              </span>
              <span className="text-slate-600 dark:text-slate-400">
                Châu Á #{EF_EPI_2025.asiaRank}/{EF_EPI_2025.totalAsiaCountries}
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-700 dark:text-slate-300 font-semibold">
                    Đọc (Reading)
                  </span>
                  <span className="text-slate-900 dark:text-slate-50 font-bold">
                    {EF_EPI_2025.skills.reading} điểm
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full w-full origin-left bg-blue-700 dark:bg-blue-500 rounded-full"
                    style={{ transform: `scaleX(${readingPercent / 100})` }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-red-600 dark:text-red-400 font-semibold">
                    Nói (Speaking)
                  </span>
                  <span className="text-red-600 dark:text-red-400 font-bold">
                    {EF_EPI_2025.skills.speaking} điểm
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full w-full origin-left bg-red-600 dark:bg-red-500 rounded-full"
                    style={{ transform: `scaleX(${speakingPercent / 100})` }}
                  />
                </div>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Kỹ năng Nói thấp hơn Đọc {speakingVsReadingGap} điểm: luyện nói mỗi ngày giúp thu hẹp khoảng cách này.
            </p>

            <Link
              href="/research"
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs font-mono font-semibold transition-colors"
            >
              <span>Đọc thêm số liệu &amp; nghiên cứu</span>
              <ArrowRight className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" aria-hidden="true" />
            </Link>
          </div>
        </details>
      </div>

      <div className="hidden md:block liquid-glass-card p-6 sm:p-8">
        <div className="hidden md:grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          <div className="lg:col-span-7 space-y-5">
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50 leading-[3rem]">
                Luyện phản xạ nói tiếng Anh CNTT theo tình huống công việc thật
              </h1>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                Dành riêng cho sinh viên CNTT và lập trình viên Fresher/Junior muốn bứt phá khả năng
                giao tiếp trong Daily Standup, Code Review, Technical Interview và IT Speaking Arena.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href="/placement"
                className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold text-sm active:scale-[0.98] transition-colors"
              >
                <span>Bắt đầu luyện nói ngay</span>
                <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </Link>

              <Link
                href="/scenarios"
                className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400 underline-offset-4 hover:underline px-1.5 py-1 transition-colors"
              >
                <span>Hoặc chọn kịch bản trực tiếp</span>
              </Link>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {featureHighlights.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center rounded-lg px-3.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <aside
            aria-label="Số liệu thống kê: Bối cảnh tiếng Anh CNTT"
            className="lg:col-span-5 lg:border-l lg:border-slate-200 dark:lg:border-slate-800 lg:pl-8 space-y-4"
          >
            <div className="space-y-1.5">
              <p className="text-xs font-mono font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                EF EPI {EF_EPI_2025.year} · {EF_EPI_2025.country}
              </p>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
                Số liệu thống kê: Bối cảnh tiếng Anh CNTT
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Chỉ số EF EPI 2025 toàn quốc cho thấy người Việt đọc hiểu khá tốt nhưng phản xạ nói còn yếu, đó là lý do bạn cần luyện nói mỗi ngày.
              </p>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-mono text-slate-600 dark:text-slate-300">
                  Điểm tổng EF EPI toàn quốc
                </span>
                <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-50 shrink-0">
                  {EF_EPI_2025.score} điểm
                </span>
              </div>

              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-sm">
                <div className="space-y-0.5">
                  <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
                    Xếp hạng toàn cầu
                  </div>
                  <div className="text-sm font-mono font-bold text-slate-900 dark:text-slate-50">
                    Hạng #{EF_EPI_2025.globalRank}/{EF_EPI_2025.totalCountries} quốc gia
                  </div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
                    Xếp hạng châu Á
                  </div>
                  <div className="text-sm font-mono font-bold text-slate-900 dark:text-slate-50">
                    Hạng #{EF_EPI_2025.asiaRank}/{EF_EPI_2025.totalAsiaCountries} quốc gia
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 border-t border-slate-200 dark:border-slate-800 pt-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-700 dark:text-slate-300 font-semibold">
                    Kỹ năng Đọc tài liệu (Reading)
                  </span>
                  <span className="text-slate-900 dark:text-slate-50 font-bold">
                    {EF_EPI_2025.skills.reading} điểm
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full w-full origin-left bg-blue-700 dark:bg-blue-500 rounded-full transition-transform duration-500"
                    style={{ transform: `scaleX(${readingPercent / 100})` }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-red-600 dark:text-red-400 font-semibold">
                    Kỹ năng Nói: yếu nhất (Speaking)
                  </span>
                  <span className="text-red-600 dark:text-red-400 font-bold">
                    {EF_EPI_2025.skills.speaking} điểm
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full w-full origin-left bg-red-600 dark:bg-red-500 rounded-full transition-transform duration-500"
                    style={{ transform: `scaleX(${speakingPercent / 100})` }}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Kỹ năng Nói tại Việt Nam thấp hơn Đọc tới{" "}
                <span className="font-mono font-bold text-slate-900 dark:text-slate-50">
                  {speakingVsReadingGap} điểm
                </span>{" "}
                do quen đọc docs nhưng thiếu môi trường phản xạ miệng. SpeakIT thu hẹp khoảng cách
                này bằng hội thoại voice-first, chấm điểm AI theo lượt nói và luyện Shadowing mỗi ngày.
              </p>

              <Link
                href="/research"
                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs font-mono font-semibold transition-colors"
              >
                <BarChart3 className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" aria-hidden="true" />
                <span>Đọc thêm số liệu &amp; nghiên cứu</span>
                <ArrowRight className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" aria-hidden="true" />
              </Link>
            </div>
          </aside>
        </div>
      </div>

      <div className="hidden md:grid md:grid-cols-3 gap-4">
        {howItWorksSteps.map((item) => {
          const Icon = item.icon;
          const stepTone =
            item.step === "01"
              ? {
                  box: "bg-sky-50 dark:bg-sky-500/20 border-sky-200 dark:border-sky-400/35",
                  icon: "text-sky-700 dark:text-sky-300",
                  label: "text-sky-700 dark:text-sky-300",
                }
              : item.step === "02"
                ? {
                    box: "bg-violet-50 dark:bg-violet-500/20 border-violet-200 dark:border-violet-400/35",
                    icon: "text-violet-700 dark:text-violet-300",
                    label: "text-violet-700 dark:text-violet-300",
                  }
                : {
                    box: "bg-emerald-50 dark:bg-emerald-500/20 border-emerald-200 dark:border-emerald-400/35",
                    icon: "text-emerald-700 dark:text-emerald-300",
                    label: "text-emerald-700 dark:text-emerald-300",
                  };
          return (
            <div
              key={item.step}
              className="liquid-glass-card-lite p-5 flex items-start gap-3.5"
            >
              <div className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${stepTone.box}`}>
                <Icon className={`w-4 h-4 ${stepTone.icon}`} aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <div className={`text-xs font-mono font-bold ${stepTone.label}`}>
                  BƯỚC {item.step}
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50">{item.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

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
      title: "Nghe cÃ¢u há»i cháº­m rÃµ báº±ng tiáº¿ng Anh",
      description:
        "Nghe 4 giá»ng Ä‘á»c AI tá»± nhiÃªn theo tÃ¬nh huá»‘ng Ä‘i lÃ m (cÃ³ nÃºt nghe cháº­m tá»«ng tá»« cho ngÆ°á»i má»›i).",
      icon: Volume2,
    },
    {
      step: "02",
      title: "Táº­p nÃ³i theo máº«u cÃ¢u dá»… dÃ¹ng",
      description:
        `Luyá»‡n tráº£ lá»i qua micro vá»›i ${scenarioCount} tÃ¬nh huá»‘ng tá»« má»›i báº¯t Ä‘áº§u (Fresher) Ä‘áº¿n Ä‘i lÃ m tháº­t (Junior / Senior), cÃ³ gá»£i Ã½ tiáº¿ng Viá»‡t chi tiáº¿t.`,
      icon: Mic,
    },
    {
      step: "03",
      title: "Cháº¥m Ä‘iá»ƒm & nghe nháº¡i láº¡i (Shadowing)",
      description:
        "AI gÃ³p Ã½ cÃ¡ch phÃ¡t Ã¢m, Ä‘á»™ trÃ´i cháº£y vÃ  tá»« vá»±ng, kÃ¨m cÃ¢u máº«u Ä‘á»ƒ báº¡n nghe vÃ  nÃ³i nháº¡i láº¡i theo nhá»‹p.",
      icon: CheckCircle2,
    },
  ];
}

function buildFeatureHighlights(scenarioCount: number) {
  return [
    `${scenarioCount} tÃ¬nh huá»‘ng cÃ´ng viá»‡c IT (kÃ¨m gá»£i Ã½ cho ngÆ°á»i máº¥t gá»‘c)`,
    "Cháº¡m báº¥t ká»³ tá»« tiáº¿ng Anh nÃ o Ä‘á»ƒ xem nghÄ©a tiáº¿ng Viá»‡t ngay",
    "Cháº¥m Ä‘iá»ƒm PhÃ¡t Ã¢m Â· Äá»™ trÃ´i cháº£y Â· Tá»« vá»±ng",
    "Äáº¥u trÆ°á»ng pháº£n xáº¡ & Káº¿ hoáº¡ch Ã´n táº­p 7 ngÃ y",
  ];
}

function buildMobileShortcuts(scenarioCount: number) {
  return [
    {
      href: "/scenarios",
      title: "Ká»‹ch báº£n",
      subtitle: `${scenarioCount} tÃ¬nh huá»‘ng IT`,
      icon: MessageSquare,
    },
    {
      href: "/arena",
      title: "Äáº¥u trÆ°á»ng Arena",
      subtitle: "Thá»­ thÃ¡ch 60s",
      icon: Gamepad2,
    },
    {
      href: "/vocabulary",
      title: "Tá»« vá»±ng IT",
      subtitle: "PhÃ¡t Ã¢m IPA",
      icon: BookOpen,
    },
    {
      href: "/shop",
      title: "Shop IT-Coin",
      subtitle: "Äá»•i hiá»‡u á»©ng",
      icon: ShoppingBag,
    },
    {
      href: "/progress",
      title: "Tiáº¿n Ä‘á»™ 7 ngÃ y",
      subtitle: "Lá»™ trÃ¬nh Ã´n táº­p",
      icon: Clock,
    },
    {
      href: "/settings",
      title: "CÃ i Ä‘áº·t",
      subtitle: "Giá»ng Ä‘á»c & AI",
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
    <section aria-label="Giá»›i thiá»‡u SpeakIT" className="space-y-6">
      <div className="md:hidden space-y-4">
        <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 leading-snug">
              Luyá»‡n pháº£n xáº¡ tiáº¿ng Anh CNTT
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Daily Standup Â· Code Review Â· Technical Interview
            </p>
          </div>

          <div className="space-y-2.5">
            <Link
              href="/scenarios"
              className="w-full flex items-center justify-center gap-2 rounded-lg px-5 py-3.5 bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-sm font-semibold active:scale-[0.98] transition-colors"
            >
              <span>Báº¯t Ä‘áº§u luyá»‡n nÃ³i ngay</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </Link>

            <Link
              href="/placement"
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm font-semibold active:scale-[0.98] transition-colors"
            >
              <Compass className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" aria-hidden="true" />
              <span>Kiá»ƒm tra trÃ¬nh Ä‘á»™</span>
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
                className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-slate-800 rounded-xl active:scale-[0.98] hover:border-blue-700 dark:hover:border-blue-500 transition-colors p-3.5 flex flex-col gap-2.5"
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

        <details className="group bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <summary className="list-none cursor-pointer flex items-center justify-between gap-2 px-4 py-3 text-sm font-mono font-semibold text-slate-900 dark:text-slate-50 select-none">
            <span className="flex items-center gap-2 min-w-0">
              <BarChart3 className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" aria-hidden="true" />
              <span className="truncate">
                Sá»‘ liá»‡u EF EPI {EF_EPI_2025.year} Â· {EF_EPI_2025.country} {EF_EPI_2025.score} Ä‘iá»ƒm
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
                ToÃ n cáº§u #{EF_EPI_2025.globalRank}/{EF_EPI_2025.totalCountries}
              </span>
              <span className="text-slate-600 dark:text-slate-400">
                ChÃ¢u Ã #{EF_EPI_2025.asiaRank}/{EF_EPI_2025.totalAsiaCountries}
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-700 dark:text-slate-300 font-semibold">
                    Äá»c (Reading)
                  </span>
                  <span className="text-slate-900 dark:text-slate-50 font-bold">
                    {EF_EPI_2025.skills.reading} Ä‘iá»ƒm
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
                    NÃ³i (Speaking)
                  </span>
                  <span className="text-red-600 dark:text-red-400 font-bold">
                    {EF_EPI_2025.skills.speaking} Ä‘iá»ƒm
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
              Ká»¹ nÄƒng NÃ³i tháº¥p hÆ¡n Äá»c {speakingVsReadingGap} Ä‘iá»ƒm: luyá»‡n nÃ³i má»—i ngÃ y giÃºp thu háº¹p khoáº£ng cÃ¡ch nÃ y.
            </p>

            <Link
              href="/research"
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs font-mono font-semibold transition-colors"
            >
              <span>Äá»c thÃªm sá»‘ liá»‡u &amp; nghiÃªn cá»©u</span>
              <ArrowRight className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" aria-hidden="true" />
            </Link>
          </div>
        </details>
      </div>

      <div className="hidden md:block bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8">
        <div className="hidden md:grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          <div className="lg:col-span-7 space-y-5">
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50 leading-[3rem]">
                Luyá»‡n pháº£n xáº¡ nÃ³i tiáº¿ng Anh CNTT theo tÃ¬nh huá»‘ng cÃ´ng viá»‡c tháº­t
              </h1>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                DÃ nh riÃªng cho sinh viÃªn CNTT vÃ  láº­p trÃ¬nh viÃªn Fresher/Junior muá»‘n bá»©t phÃ¡ kháº£ nÄƒng
                giao tiáº¿p trong Daily Standup, Code Review, Technical Interview vÃ  IT Speaking Arena.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href="/placement"
                className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold text-sm active:scale-[0.98] transition-colors"
              >
                <span>Báº¯t Ä‘áº§u luyá»‡n nÃ³i ngay</span>
                <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </Link>

              <Link
                href="/scenarios"
                className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400 underline-offset-4 hover:underline px-1.5 py-1 transition-colors"
              >
                <span>Hoáº·c chá»n ká»‹ch báº£n trá»±c tiáº¿p</span>
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
            aria-label="Sá»‘ liá»‡u thá»‘ng kÃª: Bá»‘i cáº£nh tiáº¿ng Anh CNTT"
            className="lg:col-span-5 lg:border-l lg:border-slate-200 dark:lg:border-slate-800 lg:pl-8 space-y-4"
          >
            <div className="space-y-1.5">
              <p className="text-xs font-mono font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                EF EPI {EF_EPI_2025.year} Â· {EF_EPI_2025.country}
              </p>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
                Sá»‘ liá»‡u thá»‘ng kÃª: Bá»‘i cáº£nh tiáº¿ng Anh CNTT
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Chá»‰ sá»‘ EF EPI 2025 toÃ n quá»‘c cho tháº¥y ngÆ°á»i Viá»‡t Ä‘á»c hiá»ƒu khÃ¡ tá»‘t nhÆ°ng pháº£n xáº¡ nÃ³i cÃ²n yáº¿u, Ä‘Ã³ lÃ  lÃ½ do báº¡n cáº§n luyá»‡n nÃ³i má»—i ngÃ y.
              </p>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-mono text-slate-600 dark:text-slate-300">
                  Äiá»ƒm tá»•ng EF EPI toÃ n quá»‘c
                </span>
                <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-50 shrink-0">
                  {EF_EPI_2025.score} Ä‘iá»ƒm
                </span>
              </div>

              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-sm">
                <div className="space-y-0.5">
                  <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
                    Xáº¿p háº¡ng toÃ n cáº§u
                  </div>
                  <div className="text-sm font-mono font-bold text-slate-900 dark:text-slate-50">
                    Háº¡ng #{EF_EPI_2025.globalRank}/{EF_EPI_2025.totalCountries} quá»‘c gia
                  </div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
                    Xáº¿p háº¡ng chÃ¢u Ã
                  </div>
                  <div className="text-sm font-mono font-bold text-slate-900 dark:text-slate-50">
                    Háº¡ng #{EF_EPI_2025.asiaRank}/{EF_EPI_2025.totalAsiaCountries} quá»‘c gia
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 border-t border-slate-200 dark:border-slate-800 pt-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-700 dark:text-slate-300 font-semibold">
                    Ká»¹ nÄƒng Äá»c tÃ i liá»‡u (Reading)
                  </span>
                  <span className="text-slate-900 dark:text-slate-50 font-bold">
                    {EF_EPI_2025.skills.reading} Ä‘iá»ƒm
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
                    Ká»¹ nÄƒng NÃ³i: yáº¿u nháº¥t (Speaking)
                  </span>
                  <span className="text-red-600 dark:text-red-400 font-bold">
                    {EF_EPI_2025.skills.speaking} Ä‘iá»ƒm
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
                Ká»¹ nÄƒng NÃ³i táº¡i Viá»‡t Nam tháº¥p hÆ¡n Äá»c tá»›i{" "}
                <span className="font-mono font-bold text-slate-900 dark:text-slate-50">
                  {speakingVsReadingGap} Ä‘iá»ƒm
                </span>{" "}
                do quen Ä‘á»c docs nhÆ°ng thiáº¿u mÃ´i trÆ°á»ng pháº£n xáº¡ miá»‡ng. SpeakIT thu háº¹p khoáº£ng cÃ¡ch
                nÃ y báº±ng há»™i thoáº¡i voice-first, cháº¥m Ä‘iá»ƒm AI theo lÆ°á»£t nÃ³i vÃ  luyá»‡n Shadowing má»—i ngÃ y.
              </p>

              <Link
                href="/research"
                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs font-mono font-semibold transition-colors"
              >
                <BarChart3 className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" aria-hidden="true" />
                <span>Äá»c thÃªm sá»‘ liá»‡u &amp; nghiÃªn cá»©u</span>
                <ArrowRight className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" aria-hidden="true" />
              </Link>
            </div>
          </aside>
        </div>
      </div>

      <div className="hidden md:grid md:grid-cols-3 gap-4">
        {howItWorksSteps.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.step}
              className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex items-start gap-3.5"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-blue-700 dark:text-blue-400" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-mono font-bold text-blue-700 dark:text-blue-400">
                  BÆ¯á»šC {item.step}
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

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Coins,
  Compass,
  Gamepad2,
  HelpCircle,
  Mic,
  Settings,
  Sparkles,
  TrendingUp,
  User,
  X,
} from "lucide-react";
import { getMergedScenarios } from "../../lib/serverScenarios";

export const dynamic = "force-dynamic";

function buildSectionGuides(scenarioCount: number) {
  return [
    {
      href: "/scenarios",
      title: "Ká»‹ch báº£n",
      icon: Mic,
      description:
        `Luyá»‡n nÃ³i theo ${scenarioCount} tÃ¬nh huá»‘ng cÃ´ng viá»‡c CNTT thá»±c táº¿ (Standup, Bug Report, Code Review, Phá»ng váº¥n, KhÃ¡ch hÃ ng, Demo) chia theo 3 cáº¥p Ä‘á»™ Fresher / Junior / Senior.`,
    },
    {
      href: "/arena",
      title: "Arena",
      icon: Gamepad2,
      description:
        "ChÆ¡i minigame pháº£n xáº¡ nhanh (Bug Buster, Standup Speed Run) Ä‘á»ƒ tÃ­ch lÅ©y Ä‘iá»ƒm thÆ°á»Ÿng, giá»¯ chuá»—i ngÃ y há»c vÃ  Ä‘ua báº£ng xáº¿p háº¡ng.",
    },
    {
      href: "/vocabulary",
      title: "Tá»« vá»±ng IT",
      icon: BookOpen,
      description:
        "Tra cá»©u thuáº­t ngá»¯ CNTT cá»‘t lÃµi kÃ¨m phiÃªn Ã¢m IPA, nghÄ©a tiáº¿ng Viá»‡t, cÃ¢u vÃ­ dá»¥ thá»±c táº¿ vÃ  phÃ¡t Ã¢m chuáº©n.",
    },
    {
      href: "/progress",
      title: "Tiáº¿n Ä‘á»™ & 7 ngÃ y",
      icon: TrendingUp,
      description:
        "Theo dÃµi Ä‘iá»ƒm trung bÃ¬nh, danh sÃ¡ch tá»« khÃ³a cÃ²n yáº¿u vÃ  nháº­n lá»™ trÃ¬nh Ã´n táº­p 7 ngÃ y cÃ¡ nhÃ¢n hÃ³a.",
    },
    {
      href: "/profile",
      title: "Há»“ sÆ¡",
      icon: User,
      description:
        "Äá»•i tÃªn hiá»ƒn thá»‹ trÃªn báº£ng xáº¿p háº¡ng, láº¥y mÃ£ khÃ´i phá»¥c thiáº¿t bá»‹ DEV-XXXXXX vÃ  dÃ¹ng IT-Coin má»Ÿ khÃ³a danh hiá»‡u & khung viá»n.",
    },
    {
      href: "/settings",
      title: "CÃ i Ä‘áº·t",
      icon: Settings,
      description:
        "TÃ¹y chá»‰nh tá»‘c Ä‘á»™ Ä‘á»c (0.8x / 1.0x / 1.2x), chá»n giá»ng AI phá»ng váº¥n (US Tech Lead, US Female HR, UK Client) vÃ  quáº£n lÃ½ dá»¯ liá»‡u.",
    },
  ];
}

export default async function GuidePage() {
  const scenarios = await getMergedScenarios();
  const sectionGuides = buildSectionGuides(scenarios.length);
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="space-y-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Trang chá»§</span>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2.5 pt-1">
          <HelpCircle className="w-6 h-6 text-blue-700 dark:text-blue-400 shrink-0" />
          <span>HÆ°á»›ng Dáº«n Sá»­ Dá»¥ng SpeakIT (1 PhÃºt)</span>
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          TÃ³m táº¯t nhanh cÃ¡c tÃ­nh nÄƒng chÃ­nh, cÃ¡ch há»‡ thá»‘ng cháº¥m Ä‘iá»ƒm vÃ  cÃ¡ch tÃ­ch lÅ©y IT-Coin trÃªn SpeakIT.
        </p>
      </div>

      <section className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#262626] rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase text-blue-700 dark:text-blue-400">
            <Compass className="w-4 h-4 text-blue-700 dark:text-blue-400" />
            <span>ChÆ°a biáº¿t báº¯t Ä‘áº§u tá»« Ä‘Ã¢u?</span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-50">
            LÃ m bÃ i kiá»ƒm tra xáº¿p lá»›p nhanh (2 phÃºt)
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            2 cÃ¢u tráº¯c nghiá»‡m tÃ¬nh huá»‘ng + 1 cÃ¢u nÃ³i 15 giÃ¢y Ä‘á»ƒ há»‡ thá»‘ng gá»£i Ã½ Ä‘Ãºng cáº¥p Ä‘á»™ Fresher / Junior / Senior.
          </p>
        </div>
        <Link
          href="/placement"
          className="bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-colors"
        >
          <span>Kiá»ƒm tra trÃ¬nh Ä‘á»™ ngay</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
          1. Báº£n Ä‘á»“ 6 khu vá»±c trÃªn thanh Ä‘iá»u hÆ°á»›ng
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sectionGuides.map(({ href, title, icon: Icon, description }) => (
            <Link
              key={href}
              href={href}
              className="group bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#262626] rounded-xl p-5 hover:border-blue-300 dark:hover:border-blue-700 transition-colors space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2.5 font-bold text-base text-slate-900 dark:text-slate-50 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                  <span className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                  </span>
                  <span>{title}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-blue-700 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#262626] rounded-xl p-5 sm:p-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
            2. CÃ¡ch cháº¥m Ä‘iá»ƒm &amp; Ã nghÄ©a 3 mÃ u pháº£n há»“i
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 font-mono">
            CÃ´ng thá»©c cháº¥m: 40% Tá»« khÃ³a ká»¹ thuáº­t Â· 30% Má»©c Ä‘á»™ Ä‘áº§y Ä‘á»§ Ã½ Â· 30% Ngá»¯ phÃ¡p tá»± nhiÃªn
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-200 dark:border-[#262626] pt-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-sm font-bold text-green-800 dark:text-green-300">
              <Check className="w-4 h-4 text-green-700 dark:text-green-400 stroke-[3]" />
              <span>Xanh lÃ¡ (Green): Äáº¡t chuáº©n</span>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              Tá»« khÃ³a ká»¹ thuáº­t báº¡n Ä‘Ã£ nÃ³i Ä‘Ãºng, Ä‘iá»ƒm cao (&ge; 80) vÃ  pháº§n cÃ¢u Ä‘Ã£ sá»­a chuáº©n ngá»¯ phÃ¡p.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-800 dark:text-blue-300">
              <Sparkles className="w-4 h-4 text-blue-700 dark:text-blue-400" />
              <span>Xanh dÆ°Æ¡ng (Blue): NÃ¢ng cáº¥p tá»± nhiÃªn</span>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              CÃ¢u máº«u diá»…n Ä‘áº¡t tá»± nhiÃªn hÆ¡n (Pro Phrasing) kÃ¨m nÃºt Nghe máº«u Ä‘á»ƒ báº¡n táº­p Ä‘á»c theo (Shadowing).
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-sm font-bold text-red-700 dark:text-red-300">
              <X className="w-4 h-4 text-red-600 dark:text-red-400 stroke-[2.5]" />
              <span>Äá» (Red): Cáº§n bá»• sung</span>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              Tá»« khÃ³a quan trá»ng báº¡n cÃ²n thiáº¿u hoáº·c lá»—i ngá»¯ phÃ¡p cáº§n chá»‰nh láº¡i á»Ÿ lÆ°á»£t nÃ³i tiáº¿p theo.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#262626] rounded-xl p-5 sm:p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-amber-700 dark:text-amber-400" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
            3. CÃ¡ch kiáº¿m &amp; sá»­ dá»¥ng IT-Coin
          </h2>
        </div>
        <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-2 list-disc pl-5">
          <li>
            Má»—i lÆ°á»£t luyá»‡n nÃ³i hoáº·c chÆ¡i minigame trong{" "}
            <strong className="text-slate-900 dark:text-slate-100">Arena</strong> Ä‘á»u cá»™ng Ä‘iá»ƒm tÃ­ch lÅ©y. Cá»© má»—i{" "}
            <strong className="text-amber-700 dark:text-amber-400 font-mono">1,000 Ä‘iá»ƒm = 1 IT-Coin</strong>.
          </li>
          <li>
            VÃ o trang{" "}
            <Link
              href="/profile"
              className="text-blue-700 dark:text-blue-400 font-semibold hover:underline"
            >
              Há»“ sÆ¡ (/profile)
            </Link>{" "}
            Ä‘á»ƒ dÃ¹ng IT-Coin má»Ÿ khÃ³a khung viá»n (Ring) vÃ  danh hiá»‡u Developer ná»•i báº­t trÃªn báº£ng xáº¿p háº¡ng.
          </li>
        </ul>
      </section>
    </div>
  );
}

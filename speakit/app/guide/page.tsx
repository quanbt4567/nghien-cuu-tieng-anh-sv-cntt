import Link from "next/link";
import {
  ArrowLeft,
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
      title: "Kịch bản",
      icon: Mic,
      description:
        `Luyện nói theo ${scenarioCount} tình huống công việc CNTT thực tế (Standup, Bug Report, Code Review, Phỏng vấn, Khách hàng, Demo) chia theo 3 cấp độ Fresher / Junior / Senior.`,
    },
    {
      href: "/arena",
      title: "Arena",
      icon: Gamepad2,
      description:
        "Chơi minigame phản xạ nhanh (Bug Buster, Standup Speed Run) để tích lũy điểm thưởng, giữ chuỗi ngày học và đua bảng xếp hạng.",
    },
    {
      href: "/vocabulary",
      title: "Từ vựng IT",
      icon: BookOpen,
      description:
        "Tra cứu thuật ngữ CNTT cốt lõi kèm phiên âm IPA, nghĩa tiếng Việt, câu ví dụ thực tế và phát âm chuẩn.",
    },
    {
      href: "/progress",
      title: "Tiến độ & 7 ngày",
      icon: TrendingUp,
      description:
        "Theo dõi điểm trung bình, danh sách từ khóa còn yếu và nhận lộ trình ôn tập 7 ngày cá nhân hóa.",
    },
    {
      href: "/profile",
      title: "Hồ sơ",
      icon: User,
      description:
        "Đổi tên hiển thị trên bảng xếp hạng, lấy mã khôi phục thiết bị DEV-XXXXXX và dùng IT-Coin mở khóa danh hiệu & khung viền.",
    },
    {
      href: "/settings",
      title: "Cài đặt",
      icon: Settings,
      description:
        "Tùy chỉnh tốc độ đọc (0.8x / 1.0x / 1.2x), chọn giọng AI phỏng vấn (US Tech Lead, US Female HR, UK Client) và quản lý dữ liệu.",
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
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-blue-600 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Trang chủ</span>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2.5 pt-1 text-balance">
          <HelpCircle className="w-6 h-6 text-blue-700 dark:text-blue-400 shrink-0" aria-hidden="true" />
          <span>Hướng Dẫn Sử Dụng SpeakIT (1 Phút)</span>
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Tóm tắt nhanh các tính năng chính, cách hệ thống chấm điểm và cách tích lũy IT-Coin trên SpeakIT.
        </p>
      </div>

      <section className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-blue-700 dark:text-blue-400">
            <Compass className="w-4 h-4 text-blue-700 dark:text-blue-400" aria-hidden="true" />
            <span>Chưa biết bắt đầu từ đâu?</span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-50 text-balance">
            Làm bài kiểm tra xếp lớp nhanh (2 phút)
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            2 câu trắc nghiệm tình huống + 1 câu nói 15 giây để hệ thống gợi ý đúng cấp độ Fresher / Junior / Senior.
          </p>
        </div>
        <Link
          href="/placement"
          className="bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 text-white shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-colors"
        >
          <span>Kiểm tra trình độ ngay</span>
        </Link>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50 text-balance">
          1. Bản đồ 6 khu vực trên thanh điều hướng
        </h2>
        <div className="bg-slate-200 dark:bg-[#334155] border border-slate-200 dark:border-[#334155] rounded-xl overflow-hidden grid grid-cols-1 sm:grid-cols-2 gap-px">
          {sectionGuides.map(({ href, title, icon: Icon, description }) => (
            <Link
              key={href}
              href={href}
              className="group bg-white dark:bg-[#1E293B] p-5 hover:bg-slate-50 dark:hover:bg-slate-800/80 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 transition-colors space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2.5 font-bold text-base text-slate-900 dark:text-slate-50 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                  <span className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-blue-700 dark:text-blue-400" aria-hidden="true" />
                  </span>
                  <span>{title}</span>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-xl p-5 sm:p-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50 text-balance">
            2. Cách chấm điểm &amp; Ý nghĩa 3 màu phản hồi
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 font-mono tabular-nums">
            Công thức chấm: 40% Từ khóa kỹ thuật, 30% Mức độ đầy đủ ý, 30% Ngữ pháp tự nhiên
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-200 dark:border-[#334155] pt-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-sm font-bold text-green-800 dark:text-green-300">
              <Check className="w-4 h-4 text-green-700 dark:text-green-400 stroke-[3]" aria-hidden="true" />
              <span>Xanh lá (Green): Đạt chuẩn</span>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              Từ khóa kỹ thuật bạn đã nói đúng, điểm cao (&ge; 80) và phần câu đã sửa chuẩn ngữ pháp.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-800 dark:text-blue-300">
              <Sparkles className="w-4 h-4 text-blue-700 dark:text-blue-400" aria-hidden="true" />
              <span>Xanh dương (Blue): Nâng cấp tự nhiên</span>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              Câu mẫu diễn đạt tự nhiên hơn (Pro Phrasing) kèm nút Nghe mẫu để bạn tập đọc theo (Shadowing).
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-sm font-bold text-red-700 dark:text-red-300">
              <X className="w-4 h-4 text-red-600 dark:text-red-400 stroke-[2.5]" aria-hidden="true" />
              <span>Đỏ (Red): Cần bổ sung</span>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              Từ khóa quan trọng bạn còn thiếu hoặc lỗi ngữ pháp cần chỉnh lại ở lượt nói tiếp theo.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-xl p-5 sm:p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-amber-700 dark:text-amber-400" aria-hidden="true" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50 text-balance">
            3. Cách kiếm &amp; sử dụng IT-Coin
          </h2>
        </div>
        <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-2 list-disc pl-5">
          <li>
            Mỗi lượt luyện nói hoặc chơi minigame trong{" "}
            <strong className="text-slate-900 dark:text-slate-100">Arena</strong> đều cộng điểm tích lũy. Cứ mỗi{" "}
            <strong className="text-amber-700 dark:text-amber-400 font-mono tabular-nums">1,000 điểm = 1 IT-Coin</strong>.
          </li>
          <li>
            Vào trang{" "}
            <Link
              href="/profile"
              className="text-blue-700 dark:text-blue-400 font-semibold hover:underline focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
            >
              Hồ sơ
            </Link>{" "}
            để dùng IT-Coin mở khóa khung viền (Ring) và danh hiệu Developer nổi bật trên bảng xếp hạng.
          </li>
        </ul>
      </section>
    </div>
  );
}

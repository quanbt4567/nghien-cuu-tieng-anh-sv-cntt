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
          className="liquid-glass-btn inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Trang chủ</span>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5 pt-1">
          <HelpCircle className="w-6 h-6 text-sky-600 shrink-0" />
          <span>Hướng Dẫn Sử Dụng SpeakIT (1 Phút)</span>
        </h1>
        <p className="text-sm text-slate-600">
          Tóm tắt nhanh các tính năng chính, cách hệ thống chấm điểm và cách tích lũy IT-Coin trên SpeakIT.
        </p>
      </div>

      <section className="liquid-glass-card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase text-sky-700">
            <Compass className="w-4 h-4 text-sky-600" />
            <span>Chưa biết bắt đầu từ đâu?</span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            Làm bài kiểm tra xếp lớp nhanh (2 phút)
          </h2>
          <p className="text-xs text-slate-600">
            2 câu trắc nghiệm tình huống + 1 câu nói 15 giây để hệ thống gợi ý đúng cấp độ Fresher / Junior / Senior.
          </p>
        </div>
        <Link
          href="/placement"
          className="liquid-btn-primary text-white shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-bold transition-all"
        >
          <span>Kiểm tra trình độ ngay</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">
          1. Bản đồ 6 khu vực trên thanh điều hướng
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sectionGuides.map(({ href, title, icon: Icon, description }) => (
            <Link
              key={href}
              href={href}
              className="group liquid-glass-card-lite rounded-3xl p-5 hover:!border-sky-300 transition-all space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2.5 font-bold text-sm text-slate-900 group-hover:text-sky-700 transition-colors">
                  <span className="w-8 h-8 rounded-full bg-sky-100/90 border border-sky-300 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-sky-700" />
                  </span>
                  <span>{title}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-sky-600 group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="liquid-glass-card p-5 sm:p-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900">
            2. Cách chấm điểm & Ý nghĩa 3 màu phản hồi
          </h2>
          <p className="text-xs text-slate-600 font-mono">
            Công thức chấm: 40% Từ khóa kỹ thuật • 30% Mức độ đầy đủ ý • 30% Ngữ pháp tự nhiên
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-300 space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-900">
              <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
              <span>Xanh lá (Green) — Đạt chuẩn</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              Từ khóa kỹ thuật bạn đã nói đúng, điểm cao (&ge; 80) và phần câu đã sửa chuẩn ngữ pháp.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-sky-50/90 border border-sky-300 space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-900">
              <Sparkles className="w-4 h-4 text-sky-600" />
              <span>Xanh dương (Blue) — Nâng cấp tự nhiên</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              Câu mẫu diễn đạt tự nhiên hơn (Pro Phrasing) kèm nút Nghe mẫu để bạn tập đọc theo (Shadowing).
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-rose-50/90 border border-rose-300 space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-900">
              <X className="w-4 h-4 text-rose-600 stroke-[2.5]" />
              <span>Đỏ hồng (Red) — Cần bổ sung</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              Từ khóa quan trọng bạn còn thiếu hoặc lỗi ngữ pháp cần chỉnh lại ở lượt nói tiếp theo.
            </p>
          </div>
        </div>
      </section>

      <section className="liquid-glass-card p-5 sm:p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-amber-600" />
          <h2 className="text-lg font-bold text-slate-900">
            3. Cách kiếm & sử dụng IT-Coin
          </h2>
        </div>
        <ul className="text-xs sm:text-sm text-slate-700 space-y-2 list-disc pl-5">
          <li>
            Mỗi lượt luyện nói hoặc chơi minigame trong <strong className="text-slate-900">Arena</strong> đều cộng điểm tích lũy. Cứ mỗi <strong className="text-amber-700 font-mono">1,000 điểm = 1 IT-Coin</strong>.
          </li>
          <li>
            Vào trang <Link href="/profile" className="text-sky-700 font-semibold hover:underline">Hồ sơ (/profile)</Link> để dùng IT-Coin mở khóa khung viền (Ring) và danh hiệu Developer nổi bật trên bảng xếp hạng.
          </li>
        </ul>
      </section>
    </div>
  );
}

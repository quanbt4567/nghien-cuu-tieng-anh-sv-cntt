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

const SECTION_GUIDES = [
  {
    href: "/scenarios",
    title: "Kịch bản",
    icon: Mic,
    description:
      "Luyện nói theo 6 tình huống công việc CNTT thực tế (Standup, Bug Report, Code Review, Phỏng vấn, Khách hàng, Demo) chia theo 3 cấp độ Fresher / Junior / Senior.",
  },
  {
    href: "/arena",
    title: "Arena",
    icon: Gamepad2,
    description:
      "Chơi minigame phản xạ nhanh (Bug Buster, Standup Speed Run) để tích lũy điểm thưởng, giữ chuỗi ngày học và đua bảng xếp hạng toàn cầu.",
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

export default function GuidePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="space-y-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white text-ink text-xs font-medium border border-ink/15 shadow-soft hover:bg-paper-muted transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Trang chủ</span>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink flex items-center gap-2.5 pt-1">
          <HelpCircle className="w-6 h-6 text-sky-600 shrink-0" />
          <span>Hướng Dẫn Sử Dụng SpeakIT (1 Phút)</span>
        </h1>
        <p className="text-sm text-ink-muted">
          Tóm tắt nhanh các tính năng chính, cách hệ thống chấm điểm và cách tích lũy IT-Coin trên SpeakIT.
        </p>
      </div>

      <section className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase text-sky-700">
            <Compass className="w-4 h-4 text-sky-500" />
            <span>Chưa biết bắt đầu từ đâu?</span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-ink">
            Làm bài kiểm tra xếp lớp nhanh (2 phút)
          </h2>
          <p className="text-xs text-ink-muted">
            2 câu trắc nghiệm tình huống + 1 câu nói 15 giây để hệ thống gợi ý đúng cấp độ Fresher / Junior / Senior.
          </p>
        </div>
        <Link
          href="/placement"
          className="shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-pill bg-accent hover:bg-accent-hover text-white text-sm font-bold shadow-card transition-all"
        >
          <span>Kiểm tra trình độ ngay</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-ink">
          1. Bản đồ 6 khu vực trên thanh điều hướng
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SECTION_GUIDES.map(({ href, title, icon: Icon, description }) => (
            <Link
              key={href}
              href={href}
              className="group bg-white border border-ink/15 hover:border-ink/35 rounded-2xl p-5 shadow-soft hover:shadow-card transition-all space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 font-bold text-sm text-ink">
                  <span className="w-8 h-8 rounded-pill bg-paper border border-ink/15 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-sky-600" />
                  </span>
                  <span>{title}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-ink-muted group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">{description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-ink">
            2. Cách chấm điểm & Ý nghĩa 3 màu phản hồi
          </h2>
          <p className="text-xs text-ink-muted font-mono">
            Công thức chấm: 40% Từ khóa kỹ thuật • 30% Mức độ đầy đủ ý • 30% Ngữ pháp tự nhiên
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
              <Check className="w-4 h-4 text-emerald-500 stroke-[3]" />
              <span>Xanh lá (Green) — Đạt chuẩn</span>
            </div>
            <p className="text-xs text-ink leading-relaxed">
              Từ khóa kỹ thuật bạn đã nói đúng, điểm cao (&ge; 80) và phần câu đã sửa chuẩn ngữ pháp.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/30 space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700">
              <Sparkles className="w-4 h-4 text-sky-500" />
              <span>Xanh dương (Blue) — Nâng cấp tự nhiên</span>
            </div>
            <p className="text-xs text-ink leading-relaxed">
              Câu mẫu diễn đạt tự nhiên hơn (Pro Phrasing) kèm nút Nghe mẫu để bạn tập đọc theo (Shadowing).
            </p>
          </div>

          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700">
              <X className="w-4 h-4 text-rose-400 stroke-[2.5]" />
              <span>Đỏ hồng (Red) — Cần bổ sung</span>
            </div>
            <p className="text-xs text-ink leading-relaxed">
              Từ khóa quan trọng bạn còn thiếu hoặc lỗi ngữ pháp cần chỉnh lại ở lượt nói tiếp theo.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-3">
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-sky-600" />
          <h2 className="text-lg font-bold text-ink">
            3. Cách kiếm & sử dụng IT-Coin
          </h2>
        </div>
        <ul className="text-xs sm:text-sm text-ink-muted space-y-2 list-disc pl-5">
          <li>
            Mỗi lượt luyện nói hoặc chơi minigame trong <strong className="text-ink">Arena</strong> đều cộng điểm tích lũy. Cứ mỗi <strong className="text-ink font-mono">1,000 điểm = 1 IT-Coin</strong>.
          </li>
          <li>
            Vào trang <Link href="/profile" className="text-sky-700 font-semibold hover:underline">Hồ sơ (/profile)</Link> để dùng IT-Coin mở khóa khung viền (Ring) và danh hiệu Developer nổi bật trên bảng xếp hạng.
          </li>
        </ul>
      </section>
    </div>
  );
}

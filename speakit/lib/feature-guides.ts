export interface FeatureGuide {
  id: string;
  routePrefix: string;
  title: string;
  subtitle: string;
  rewardBadge?: string;
  steps: string[];
  tips: string[];
}

export interface GuideStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export const GUIDE_DISMISSED_STORAGE_KEY = "speakit_feature_guides_dismissed_v1";
export const GUIDE_DISABLED_STORAGE_KEY = "speakit_feature_guides_disabled_v1";

export const FEATURE_GUIDES: readonly FeatureGuide[] = [
  {
    id: "practice",
    routePrefix: "/practice/",
    title: "Luyện Nói Tình Huống AI",
    subtitle: "Hội thoại 3 lượt cùng AI Interviewer với chấm điểm và Shadowing",
    rewardBadge: "+Điểm & Streak mỗi lượt",
    steps: [
      "Kiểm tra vai trò của bạn và chọn giọng AI Interviewer cùng tốc độ phát (0.8x / 1.0x / 1.2x) ở thanh đầu trang.",
      "Bấm Nghe lại để nghe câu hỏi mẫu theo hiệu ứng Karaoke từng từ, hoặc chọn Nghe chậm từng từ (Slow) khi cần nghe kỹ hơn.",
      "Nhấn nút Mic để ghi âm câu trả lời bằng tiếng Anh (hoặc gõ văn bản bên dưới) rồi bấm Gửi câu trả lời.",
      "Xem bảng chấm điểm (40% Từ khóa • 30% Đầy đủ • 30% Ngữ pháp) và bấm nghe câu mẫu để luyện đọc đuổi (Shadowing).",
    ],
    tips: [
      "Bấm Xem gợi ý & từ khóa (Hint) nếu cần định hướng ý trả lời — dùng đúng từ khóa kỹ thuật giúp tăng điểm rất nhanh.",
      "Hoàn thành đủ 3 lượt để xem tổng kết từ khóa đã dùng, từ còn thiếu và danh sách từ vựng gợi ý ôn tập.",
    ],
  },
  {
    id: "scenarios",
    routePrefix: "/scenarios",
    title: "Thư Viện Tình Huống CNTT",
    subtitle: "Chọn 12+ tình huống thực tế theo vai trò và cấp độ năng lực",
    steps: [
      "Chọn vai trò chuyên môn (Frontend, Backend, QA hoặc DevOps) để hệ thống gợi ý kịch bản sát công việc của bạn.",
      "Duyệt 12+ tình huống thực tế được chia theo 3 cấp độ Fresher, Junior và Senior (Daily Standup, Bug Report, Code Review, Phỏng vấn...).",
      "Nhấn vào thẻ tình huống bất kỳ để mở phòng luyện nói 3 lượt cùng AI.",
    ],
    tips: [
      "Nếu chưa biết nên chọn cấp độ nào, hãy làm bài Kiểm tra trình độ nhanh (/placement) để được đề xuất kịch bản phù hợp.",
    ],
  },
  {
    id: "vocabulary",
    routePrefix: "/vocabulary",
    title: "Từ Vựng CNTT & Luyện Nói",
    subtitle: "4 chế độ học thuật ngữ chuyên ngành gắn liền với ngữ cảnh làm việc",
    rewardBadge: "+2 đến +3 IT-Coin",
    steps: [
      "Từ điển & Phát âm: tìm kiếm hoặc lọc từ theo ngữ cảnh (Standup, Code Review, Outage...), xem phiên âm IPA và bấm nghe phát âm chuẩn.",
      "Flashcard Lật Thẻ: lật thẻ để tự kiểm tra nghĩa tiếng Việt, câu ví dụ thực tế và đánh dấu mức độ ghi nhớ.",
      "Quiz 60 Giây: trả lời nhanh trắc nghiệm thuật ngữ theo ngữ cảnh trong 60 giây để nhận thưởng +2 IT-Coin.",
      "Luyện Nói Theo Cụm: chọn một cụm chủ đề để đặt câu nói tiếng Anh chứa nhiều từ khóa và nhận +3 IT-Coin.",
    ],
    tips: [
      "Các từ khóa bạn từng bỏ sót trong các buổi luyện nói AI sẽ tự động xuất hiện ở mục cần ôn lại.",
    ],
  },
  {
    id: "arena-party",
    routePrefix: "/arena/party",
    title: "Outage At 3AM",
    subtitle: "Phối hợp xử lý sự cố Production khẩn cấp theo nhóm 3 vai trò",
    rewardBadge: "+15–25 IT-Coin",
    steps: [
      "Tạo phòng mới để nhận mã 6 ký tự mời đồng đội hoặc nhập mã để vào phòng; bấm thêm 2 AI teammates nếu muốn ghép đội tự động.",
      "Chọn vai trò Frontend, Backend hoặc DevOps để nhận bảng manh mối log/metrics riêng, sau đó bấm Start Incident Call.",
      "Ở mỗi lượt nói, hãy báo cáo manh mối theo vai trò hoàn toàn bằng tiếng Anh (nói tiếng Việt sẽ bị phạt trừ 15 giây!).",
      "Phối hợp qua nhiều lượt để đưa tiến độ xử lý sự cố lên 100% trước khi hết giờ và nhận +15–25 IT-Coin.",
    ],
    tips: [
      "Nhắc đúng các từ khóa kỹ thuật trong manh mối vai trò giúp tăng mạnh điểm đóng góp để giành danh hiệu MVP (+10 Coin thưởng).",
    ],
  },
  {
    id: "arena-duel",
    routePrefix: "/arena/duel",
    title: "Code Review Duel",
    subtitle: "Tranh luận bảo vệ PR hoặc phản biện code 1v1 theo lượt 30 giây",
    rewardBadge: "+12 IT-Coin",
    steps: [
      "Chọn đề tài tranh luận kỹ thuật và chọn phe Author (tác giả PR) hoặc Reviewer (người review code).",
      "Tạo/vào phòng bằng mã 6 ký tự để đấu PvP với bạn bè hoặc bấm Đấu với AI Bot để vào trận ngay.",
      "Trong mỗi lượt 30 giây, bật Mic nói (hoặc gõ) lập luận tiếng Anh sắc bén để đẩy thanh thế trận về phía bạn.",
      "Sử dụng chuẩn thuật ngữ kỹ thuật để kích hoạt đòn CRITICAL HIT! và giành chiến thắng nhận +12 IT-Coin.",
    ],
    tips: [
      "Giữ toàn bộ câu phản biện bằng tiếng Anh để tránh bị phạt foul mất lợi thế thanh máu.",
    ],
  },
  {
    id: "arena-taboo",
    routePrefix: "/arena/taboo",
    title: "Explain It Like I'm 5",
    subtitle: "Diễn giải khái niệm IT thật dễ hiểu mà không chạm 3 từ cấm đỏ",
    rewardBadge: "+10 IT-Coin",
    steps: [
      "Tạo/vào phòng 6 ký tự hoặc bấm Chơi với AI Guesser Bot để AI đoán lời mô tả của bạn.",
      "Đọc khái niệm IT ở thẻ giữa màn hình và tuyệt đối KHÔNG nói 3 từ cấm màu đỏ (Taboo words).",
      "Dùng Mic hoặc gõ câu giải thích bằng tiếng Anh đơn giản, dễ hiểu để đồng đội hoặc AI đoán đúng khái niệm.",
      "Đạt chuỗi 3 câu đúng liên tiếp sẽ kích hoạt FEVER MODE 2x nhân đôi điểm và giúp bạn thắng +10 IT-Coin.",
    ],
    tips: [
      "Hãy mô tả bằng ví dụ đời thường hoặc công dụng thực tế thay vì nhắc gần giống từ khóa trong danh sách cấm đỏ.",
    ],
  },
  {
    id: "arena-word-chain",
    routePrefix: "/arena/word-chain",
    title: "Syntax Bomb",
    subtitle: "Nối từ tiếng Anh theo chữ cái cuối trước khi bom server nổ 0.0s",
    rewardBadge: "+8 IT-Coin",
    steps: [
      "Tạo/vào phòng 6 ký tự hoặc bấm Đấu với Syntax Bot để bắt đầu ván đấu nối từ tốc độ.",
      "Nói hoặc gõ một từ tiếng Anh bắt đầu bằng chữ cái cuối của từ trước đó trước khi đồng hồ bom đếm ngược về 0.0s.",
      "Đáp đúng từ vựng CNTT để nhận combo x2 và ép thời gian bom của đối thủ xuống chỉ còn 5 giây.",
      "Ép đối thủ bị nổ bom SEGFAULT! ở 0.0s để giành chiến thắng và nhận +8 IT-Coin.",
    ],
    tips: [
      "Chuẩn bị sẵn các từ IT ngắn gọn quen thuộc như api, index, schema, async, cache để giữ nhịp combo liên tục.",
    ],
  },
  {
    id: "arena",
    routePrefix: "/arena",
    title: "IT Speaking Arena",
    subtitle: "Đấu trường phản xạ tiếng Anh CNTT solo & phòng đấu Realtime/AI",
    rewardBadge: "+1–25 IT-Coin",
    steps: [
      "Chọn vai trò CNTT của bạn ở thẻ hồ sơ nhanh để ghi nhận điểm và danh hiệu đúng chuyên ngành.",
      "Chơi ngay Bug Buster 280s và Standup Speed Run tại các tab chính, hoặc mở 4 phòng đấu Realtime/AI (Outage At 3AM, Code Review Duel, Explain It Like I'm 5, Syntax Bomb).",
      "Tích lũy điểm thưởng (1,000 điểm = 1 IT-Coin), giữ chuỗi Streak mỗi ngày và đua top trên Bảng xếp hạng.",
    ],
    tips: [
      "Đổi IT-Coin tại Cửa hàng Hiệu ứng (/shop) để mở khóa khung viền, nameplate và hiệu ứng chiến thắng.",
    ],
  },
  {
    id: "placement",
    routePrefix: "/placement",
    title: "Kiểm Tra Trình Độ Nhanh",
    subtitle: "Đánh giá nhanh trong 2 phút để chọn cấp độ luyện tập phù hợp",
    steps: [
      "Trả lời 2 câu trắc nghiệm tình huống giao tiếp trong công việc CNTT.",
      "Ở bước nói 15 giây, nhấn Mic để giới thiệu ngắn công việc/dự án bằng tiếng Anh (hoặc nhập văn bản).",
      "Hoàn thành bài kiểm tra để nhận gợi ý cấp độ Fresher / Junior / Senior và mở ngay kịch bản phù hợp.",
    ],
    tips: [
      "Đừng lo nói chưa hoàn hảo — hệ thống đánh giá dựa trên phản xạ thực tế để đề xuất điểm bắt đầu hợp lý nhất.",
    ],
  },
  {
    id: "progress",
    routePrefix: "/progress",
    title: "Tiến Độ & Lộ Trình 7 Ngày",
    subtitle: "Theo dõi điểm luyện nói, từ khóa còn yếu và kế hoạch 7 ngày",
    steps: [
      "Xem tổng hợp số lượt đã luyện, điểm trung bình, IT-Coin và chuỗi ngày học liên tục ở phần đầu trang.",
      "Kiểm tra bảng Từ khóa & Ngữ pháp cần cải thiện được tổng hợp tự động từ các buổi luyện nói trước.",
      "Thực hiện lần lượt Lộ trình 7 Ngày để luyện lại các kịch bản trọng tâm và hoàn thành mục tiêu tuần.",
    ],
    tips: [
      "Kết hợp ôn lại từ khóa yếu ở trang Từ vựng IT (/vocabulary) trước khi quay lại kịch bản để tăng điểm rõ rệt.",
    ],
  },
  {
    id: "shop",
    routePrefix: "/shop",
    title: "Cửa Hàng Hiệu Ứng IT-Coin",
    subtitle: "Dùng thử trực tiếp và mở khóa phụ kiện hồ sơ bằng IT-Coin",
    steps: [
      "Kiểm tra số dư IT-Coin hiện có ở thanh thông tin trên cùng (tích lũy từ Arena và Từ vựng).",
      "Duyệt qua 6 nhóm hiệu ứng: Avatar Frame, Profile Theme, Cursor Trail, Leaderboard FX, Nameplate và Victory Finisher.",
      "Bấm Dùng thử để xem hiệu ứng trực tiếp, sau đó bấm Mở khóa & Trang bị bằng IT-Coin của bạn.",
    ],
    tips: [
      "Phụ kiện đã trang bị sẽ tự động hiển thị trên Bảng xếp hạng, Hồ sơ cá nhân và màn hình chiến thắng trong Arena.",
    ],
  },
  {
    id: "leaderboard",
    routePrefix: "/leaderboard",
    title: "Bảng Xếp Hạng Cộng Đồng",
    subtitle: "Theo dõi thứ hạng điểm luyện nói và số dư IT-Coin toàn hệ thống",
    steps: [
      "Xem danh sách học viên dẫn đầu cùng điểm số, chuỗi Streak và số dư IT-Coin.",
      "Kiểm tra thứ hạng hiện tại của bạn cùng khung viền và danh hiệu đã trang bị.",
      "Bạn có thể đổi tên hiển thị hoặc khôi phục tài khoản bằng mã DEV-XXXXXX ngay tại đây.",
    ],
    tips: [
      "Hoàn thành đầy đủ 3 lượt kịch bản và thắng phòng đấu Arena là cách tăng điểm và thứ hạng nhanh nhất.",
    ],
  },
  {
    id: "profile",
    routePrefix: "/profile",
    title: "Hồ Sơ & Mã Khôi Phục",
    subtitle: "Quản lý tên hiển thị, mã DEV-XXXXXX, vai trò và vật phẩm đã mở khóa",
    steps: [
      "Cập nhật tên hiển thị, ảnh đại diện và vai trò CNTT yêu thích của bạn.",
      "Sao chép và lưu giữ mã chuyển thiết bị DEV-XXXXXX để đồng bộ tiến độ, IT-Coin khi sang máy hoặc trình duyệt khác.",
      "Xem lại lịch sử luyện nói, kỷ lục minigame và tùy chỉnh trang bị phụ kiện đã sở hữu.",
    ],
    tips: [
      "Hãy lưu mã DEV-XXXXXX ở nơi an toàn để không mất dữ liệu tích lũy khi đổi thiết bị.",
    ],
  },
  {
    id: "research",
    routePrefix: "/research",
    title: "Nghiên Cứu & Xu Hướng CNTT",
    subtitle: "Tổng hợp số liệu tiếng Anh IT, góc nhìn phỏng vấn HR và từ vựng thực tế",
    steps: [
      "Chọn thẻ chuyên mục để lọc bài viết: Benchmark, Phỏng vấn HR, Tin Tech & AI hoặc Case Study.",
      "Mở bài viết chi tiết để đọc phân tích số liệu và tiêu chí đánh giá tiếng Anh khi phỏng vấn kỹ thuật.",
      "Dùng tính năng AI Trích Xuất Từ Vựng trong bài viết để lưu và luyện nói ngay theo chủ đề đó.",
    ],
    tips: [
      "Đọc mục Phỏng vấn HR giúp bạn tránh những lỗi diễn đạt phổ biến khi trả lời nhà tuyển dụng.",
    ],
  },
  {
    id: "settings",
    routePrefix: "/settings",
    title: "Cài Đặt Luyện Tập",
    subtitle: "Tùy chỉnh giọng đọc AI, tốc độ phát âm và sao lưu dữ liệu cục bộ",
    steps: [
      "Chọn tốc độ đọc mặc định (0.8x Chậm, 1.0x Chuẩn, 1.2x Nhanh) và nghe thử từng giọng AI phỏng vấn.",
      "Bấm Xuất dữ liệu JSON để tải về bản sao lưu lịch sử luyện nói và danh sách từ khóa yếu.",
      "Dùng Làm mới tiến độ (có xác nhận hai bước) nếu bạn muốn đặt lại toàn bộ dữ liệu luyện tập trên máy này.",
    ],
    tips: [
      "Giọng đọc và tốc độ chọn tại đây sẽ tự động áp dụng cho toàn bộ các phiên luyện nói tình huống.",
    ],
  },
];

function normalizePathname(pathname: string): string {
  const withoutQuery = pathname.split(/[?#]/)[0]?.trim() ?? "";
  if (!withoutQuery) return "/";
  const withSlash = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  if (withSlash.length > 1 && withSlash.endsWith("/")) {
    return withSlash.slice(0, -1);
  }
  return withSlash;
}

export function resolveGuideForPath(pathname: string): FeatureGuide | null {
  const cleanPath = normalizePathname(pathname);
  if (
    cleanPath === "/" ||
    cleanPath === "/admin" ||
    cleanPath.startsWith("/admin/")
  ) {
    return null;
  }

  let bestMatch: FeatureGuide | null = null;
  let bestPrefixLength = -1;

  for (const guide of FEATURE_GUIDES) {
    const cleanPrefix = normalizePathname(guide.routePrefix);
    if (cleanPath === cleanPrefix || cleanPath.startsWith(`${cleanPrefix}/`)) {
      if (cleanPrefix.length > bestPrefixLength) {
        bestMatch = guide;
        bestPrefixLength = cleanPrefix.length;
      }
    }
  }

  return bestMatch;
}

function resolveStorage(storage?: GuideStorageLike | null): GuideStorageLike | null {
  if (storage !== undefined) {
    return storage;
  }
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readDismissedGuideIds(store: GuideStorageLike): string[] {
  try {
    const raw = store.getItem(GUIDE_DISMISSED_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  } catch {
    return [];
  }
}

export function isGuideDismissed(
  guideId: string,
  storage?: GuideStorageLike | null
): boolean {
  const cleanId = guideId.trim();
  if (!cleanId) return false;
  const store = resolveStorage(storage);
  if (!store) return false;
  return readDismissedGuideIds(store).includes(cleanId);
}

export function dismissGuide(
  guideId: string,
  storage?: GuideStorageLike | null
): void {
  const cleanId = guideId.trim();
  if (!cleanId) return;
  const store = resolveStorage(storage);
  if (!store) return;
  try {
    const current = readDismissedGuideIds(store);
    if (current.includes(cleanId)) return;
    store.setItem(GUIDE_DISMISSED_STORAGE_KEY, JSON.stringify([...current, cleanId]));
  } catch {
  }
}

export function areAllGuidesDisabled(
  storage?: GuideStorageLike | null
): boolean {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    return store.getItem(GUIDE_DISABLED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAllGuidesDisabled(
  disabled: boolean,
  storage?: GuideStorageLike | null
): void {
  const store = resolveStorage(storage);
  if (!store) return;
  try {
    if (disabled) {
      store.setItem(GUIDE_DISABLED_STORAGE_KEY, "1");
    } else if (typeof store.removeItem === "function") {
      store.removeItem(GUIDE_DISABLED_STORAGE_KEY);
    } else {
      store.setItem(GUIDE_DISABLED_STORAGE_KEY, "0");
    }
  } catch {
  }
}

export function resetAllGuideDismissals(
  storage?: GuideStorageLike | null
): void {
  const store = resolveStorage(storage);
  if (!store) return;
  try {
    if (typeof store.removeItem === "function") {
      store.removeItem(GUIDE_DISMISSED_STORAGE_KEY);
    } else {
      store.setItem(GUIDE_DISMISSED_STORAGE_KEY, "[]");
    }
  } catch {
  }
}

export function shouldAutoOpenGuide(
  pathname: string,
  storage?: GuideStorageLike | null
): boolean {
  const guide = resolveGuideForPath(pathname);
  if (!guide) return false;
  const store = resolveStorage(storage);
  if (!store) return false;
  if (areAllGuidesDisabled(store)) return false;
  if (isGuideDismissed(guide.id, store)) return false;
  return true;
}

export type TourStopPlacement = "top" | "bottom" | "left" | "right";

export interface FeatureTourStop {
  title: string;
  description: string;
  selectors?: string[];
  matchTexts?: string[];
  placement?: TourStopPlacement;
}

export interface FeatureGuide {
  id: string;
  routePrefix: string;
  title: string;
  subtitle: string;
  rewardBadge?: string;
  steps: string[];
  tips: string[];
  tourStops: FeatureTourStop[];
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
    tourStops: [
      {
        title: "Chọn giọng AI Interviewer",
        description:
          "Đổi giọng đọc AI (Mỹ, Anh...) phù hợp với bạn và bấm nút loa nhỏ ngay bên cạnh để nghe thử trước khi trả lời.",
        selectors: [
          'select[aria-label="AI Voice Persona"]',
          'button[aria-label="Nghe thử giọng"]',
        ],
        matchTexts: ["AI Voice Persona", "Nghe thử giọng"],
        placement: "bottom",
      },
      {
        title: "Nghe lại & chỉnh tốc độ đọc",
        description:
          "Bấm Nghe lại để nghe câu hỏi theo hiệu ứng Karaoke từng từ, chuyển sang Nghe chậm (Slow) hoặc chọn tốc độ 0.8x / 1.0x / 1.2x.",
        selectors: [
          'button[title="Nghe lại câu hỏi"]',
          'button[title="Dừng phát âm"]',
          'button[title="Nghe chậm từng từ"]',
        ],
        matchTexts: ["Nghe lại", "Dừng nghe", "Nghe chậm từng từ (Slow)"],
        placement: "bottom",
      },
      {
        title: "Xem gợi ý & từ khóa kỹ thuật",
        description:
          "Mở bảng gợi ý để xem các từ khóa CNTT nên đưa vào câu nói và hướng trả lời bằng tiếng Việt.",
        matchTexts: ["Xem gợi ý & từ khóa (Hint)", "Ẩn gợi ý & từ khóa"],
        placement: "top",
      },
      {
        title: "Ghi âm Mic hoặc gõ câu trả lời",
        description:
          "Nhấn nút Mic để nói trực tiếp bằng tiếng Anh (Web Speech STT) hoặc chỉnh sửa trong khung văn bản bên dưới rồi bấm Gửi câu trả lời.",
        selectors: [
          'button[aria-label="Bắt đầu nói"]',
          'button[aria-label="Dừng ghi âm"]',
          "textarea",
        ],
        matchTexts: ["Ghi âm câu trả lời", "Gửi câu trả lời"],
        placement: "right",
      },
      {
        title: "Bảng chấm điểm & câu mẫu Shadowing",
        description:
          "Sau khi gửi, khu vực này chấm điểm theo 40% Từ khóa • 30% Đầy đủ • 30% Ngữ pháp và hiển thị câu mẫu để bạn luyện đọc đuổi.",
        selectors: [".lg\\:col-span-6 > div", ".lg\\:col-span-6"],
        matchTexts: ["Điểm đánh giá câu trả lời"],
        placement: "left",
      },
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
    tourStops: [
      {
        title: "Chọn vai trò chuyên môn (IT Role)",
        description:
          "Chọn Frontend, Backend, QA hoặc DevOps để hệ thống ưu tiên xếp các kịch bản sát công việc thực tế của bạn lên đầu.",
        selectors: [
          'section[aria-label="Bắt đầu luyện nói nhanh"] button[aria-pressed]',
          'section[aria-label="Bắt đầu luyện nói nhanh"]',
        ],
        matchTexts: ["Frontend", "Backend"],
        placement: "bottom",
      },
      {
        title: "Bắt đầu nhanh bài đề xuất",
        description:
          "Nhấn nút này để vào thẳng tình huống được gợi ý phù hợp nhất theo vai trò hoặc kết quả test xếp lớp của bạn.",
        selectors: [
          'section[aria-label="Bắt đầu luyện nói nhanh"] a[href^="/practice/"]',
        ],
        matchTexts: ["Bắt đầu luyện ngay"],
        placement: "bottom",
      },
      {
        title: "Lọc tình huống theo cấp độ",
        description:
          "Chuyển nhanh giữa Tất cả, Fresher, Junior hoặc Senior để chọn đúng độ khó giao tiếp cần rèn luyện.",
        selectors: ['div[aria-label="Lọc theo cấp độ"]'],
        matchTexts: ["Tất cả", "Fresher"],
        placement: "bottom",
      },
      {
        title: "Chọn thẻ tình huống để luyện nói",
        description:
          "Mỗi thẻ hiển thị vai trò, số lượt hội thoại và mô tả ngắn. Bấm Thực hành để mở phòng nói 3 lượt cùng AI Interviewer.",
        selectors: ['#scenarios a[href^="/practice/"]', 'a[href="/placement"]'],
        matchTexts: ["Thực hành"],
        placement: "top",
      },
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
    tourStops: [
      {
        title: "4 Chế độ học từ vựng",
        description:
          "Chuyển đổi giữa Từ điển & Phát âm, Flashcard Lật Thẻ, Quiz 60 Giây (+2 Coin) và Luyện Nói Theo Cụm (+3 Coin).",
        selectors: ['div[role="tablist"][aria-label="Chế độ học từ vựng"]'],
        matchTexts: ["Từ điển & Phát âm", "Flashcard Lật Thẻ"],
        placement: "bottom",
      },
      {
        title: "Lọc theo ngữ cảnh làm việc",
        description:
          "Chọn nhanh ngữ cảnh như Daily Standup, Code Review & Git, Bug & Outage hoặc HR Interview để thu gọn nhóm từ vựng.",
        matchTexts: ["Daily Standup", "Code Review & Git", "Tất cả"],
        placement: "bottom",
      },
      {
        title: "Tìm kiếm thuật ngữ tức thì",
        description:
          "Gõ thuật ngữ tiếng Anh hoặc nghĩa tiếng Việt vào ô tìm kiếm để tra phiên âm IPA và câu ví dụ công việc.",
        selectors: ['input[placeholder="Tìm kiếm thuật ngữ..."]'],
        matchTexts: ["Tìm kiếm thuật ngữ..."],
        placement: "bottom",
      },
      {
        title: "Kiểm tra phát âm Mic & nghe mẫu",
        description:
          "Bấm biểu tượng Micro để đọc thử thuật ngữ cho hệ thống chấm khớp phát âm, hoặc bấm Loa để nghe giọng chuẩn.",
        selectors: [
          'button[aria-label^="Kiểm tra phát âm"]',
          'button[aria-label^="Dừng kiểm tra phát âm"]',
          'button[aria-label^="Phát âm từ"]',
        ],
        matchTexts: ["Nghe câu mẫu"],
        placement: "top",
      },
      {
        title: "Đánh dấu Cần ôn lại & Đã thuộc",
        description:
          "Lưu từ khó vào danh sách Cần ôn lại hoặc bấm Đánh dấu đã thuộc để cập nhật thanh tiến độ phía trên.",
        matchTexts: ["Cần ôn lại", "Đang trong Cần ôn lại", "Đánh dấu đã thuộc"],
        placement: "top",
      },
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
    tourStops: [
      {
        title: "Chọn vai trò kỹ thuật (FE / BE / SRE)",
        description:
          "Mỗi vai trò nắm giữ manh mối Telemetry và từ khóa riêng (Frontend, Backend hoặc DevOps/SRE) để cùng giải quyết sự cố.",
        matchTexts: [
          "Frontend Engineer",
          "1. Choose Your Engineering Role",
          "YOUR EXCLUSIVE CLUE",
        ],
        placement: "bottom",
      },
      {
        title: "Chọn sự cố & Tạo War Room",
        description:
          "Chọn kịch bản outage SEV-1/SEV-2 rồi bấm Create War Room để nhận mã mời 6 ký tự cho đồng đội.",
        matchTexts: ["Create War Room", "Submit Status Report"],
        placement: "top",
      },
      {
        title: "Nhập mã 6 ký tự để vào phòng",
        description:
          "Nếu đồng đội đã tạo phòng trước, nhập mã 6 ký tự vào ô này và bấm Join Room để tham gia cùng ca trực.",
        selectors: ['input[placeholder="ABC123"]'],
        matchTexts: ["Join Room", "WAR ROOM CODE"],
        placement: "left",
      },
      {
        title: "Ghép AI Teammates & Báo cáo Mic",
        description:
          "Trong phòng chờ, bấm Fill with AI Teammates nếu thiếu người. Khi gọi sự cố, dùng Record Voice (STT) và nói hoàn toàn bằng tiếng Anh (nói tiếng Việt bị trừ 15 giây!).",
        matchTexts: [
          "Fill with AI Teammates",
          "Record Voice (STT)",
          "Stop Mic",
        ],
        placement: "top",
      },
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
    tourStops: [
      {
        title: "Chọn phe: PR Author vs Staff Reviewer",
        description:
          "Chọn bảo vệ tốc độ merge code (PR Author) hoặc phản biện rủi ro bảo trì/production (Staff Reviewer).",
        matchTexts: ["PR Author", "Staff Reviewer", "AUTHOR MOMENTUM"],
        placement: "bottom",
      },
      {
        title: "Chọn đề tài PR & Đấu với AI Bot",
        description:
          "Chọn 1 trong 10 chủ đề Code Review thực tế, sau đó bấm Đấu với AI Bot để vào trận ngay hoặc Create 6-Char Duel Room đấu PvP.",
        matchTexts: ["Đấu với AI Bot", "Create 6-Char Duel Room"],
        placement: "top",
      },
      {
        title: "Vào phòng đối đầu qua mã 6 ký tự",
        description:
          "Nhập mã phòng của đối thủ vào đây và bấm Join Duel Room để nhận phe còn lại và bắt đầu tranh luận.",
        selectors: ['input[placeholder="ABC123"]'],
        matchTexts: ["Join Duel Room", "DUEL ROOM CODE"],
        placement: "left",
      },
      {
        title: "Âm thanh Arcade & Phản biện Mic 30s",
        description:
          "Bật/tắt hiệu ứng âm thanh CRITICAL HIT ở góc trên; trong trận đấu, bấm Speak Argument (STT) để tung lập luận tiếng Anh trong 30 giây.",
        selectors: ['button[aria-label*="arcade sound effects"]'],
        matchTexts: ["SFX On", "SFX Off", "Speak Argument (STT)"],
        placement: "bottom",
      },
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
    tourStops: [
      {
        title: "Chọn số lượng thẻ bài mỗi trận",
        description:
          "Chọn độ dài ván đấu (3, 5, 7 hoặc 10 thẻ khái niệm IT) phù hợp với thời gian luyện tập của bạn.",
        matchTexts: ["5 Cards", "3 Cards", "SOLVED"],
        placement: "bottom",
      },
      {
        title: "Chơi ngay với AI Guesser Bot",
        description:
          "Bấm Chơi với AI Guesser Bot để AI đóng vai người đoán câu mô tả của bạn, hoặc tạo mã phòng 6 ký tự chơi cùng bạn bè.",
        matchTexts: ["Chơi với AI Guesser Bot", "Create 6-Char Room"],
        placement: "top",
      },
      {
        title: "Tham gia phòng bằng mã TABOO",
        description:
          "Nhập mã phòng 6 ký tự từ đồng đội để cùng tham gia thử thách giải thích và đoán thuật ngữ.",
        selectors: ['input[placeholder="TAB123"]'],
        matchTexts: ["Join Room", "TABOO ROOM CODE"],
        placement: "left",
      },
      {
        title: "Bật/tắt âm thanh hiệu ứng SFX",
        description:
          "Điều chỉnh âm thanh còi báo lỗi từ cấm và hiệu ứng combo FEVER MODE 2x khi đạt chuỗi 3 thẻ liên tiếp.",
        selectors: [
          'button[aria-label="Mute SFX"]',
          'button[aria-label="Unmute SFX"]',
        ],
        matchTexts: ["SFX On", "SFX Muted"],
        placement: "bottom",
      },
      {
        title: "Mic nói gợi ý & Lật thẻ trợ giúp",
        description:
          "Trong ván đấu, bấm Speak Clue (STT) để diễn giải bằng tiếng Anh tránh 3 từ cấm đỏ, hoặc bấm Flip Hint để xem gợi ý tiếng Việt.",
        matchTexts: ["Speak Clue (STT)", "Flip Hint", "Skip Card"],
        placement: "top",
      },
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
    tourStops: [
      {
        title: "Chọn giới hạn lượt đối đầu (Turns)",
        description:
          "Thiết lập ngưỡng số lượt trước khi Bot quá tải (8–20 lượt) để điều chỉnh độ dài ván đấu.",
        matchTexts: ["12 Turns", "8 Turns", "TURN"],
        placement: "bottom",
      },
      {
        title: "Đấu với Syntax Bot hoặc tạo phòng",
        description:
          "Nhấn Đấu với Syntax Bot để giao đấu ngay với AI hoặc tạo phòng 6 ký tự để mời bạn bè đấu nối từ.",
        matchTexts: ["Đấu với Syntax Bot", "Create 6-Char Room"],
        placement: "top",
      },
      {
        title: "Vào phòng qua mã 6 ký tự",
        description:
          "Nhập mã phòng của người khác tại đây để tham gia màn truyền bom nối từ theo thời gian thực.",
        selectors: ['input[placeholder="BOMB99"]'],
        matchTexts: ["Join Room", "BOMB ROOM CODE"],
        placement: "left",
      },
      {
        title: "Kiểm soát âm thanh đồng hồ bom",
        description:
          "Bật hoặc tắt tiếng tích tắc đếm ngược và tiếng nổ SEGFAULT! trong suốt quá trình chơi.",
        selectors: [
          'button[aria-label="Mute SFX"]',
          'button[aria-label="Unmute SFX"]',
        ],
        matchTexts: ["SFX On", "SFX Muted"],
        placement: "bottom",
      },
      {
        title: "Nối từ bằng Mic để kích hoạt Combo 5s",
        description:
          "Trong lượt của bạn, bấm Speak Word (STT) hoặc nhập từ tiếng Anh bắt đầu bằng chữ cái cuối; nối 2 từ IT liên tiếp sẽ ép bom đối thủ còn 5 giây.",
        matchTexts: ["Speak Word (STT)", "Send Word"],
        placement: "top",
      },
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
    tourStops: [
      {
        title: "Chọn vai trò CNTT & theo dõi IT-Coin",
        description:
          "Chọn chuyên ngành của bạn (Frontend, Backend, QA, DevOps) để nhận bộ câu hỏi đúng vai trò; mỗi 1,000 điểm sẽ quy đổi thành +1 IT-Coin.",
        selectors: ['select[aria-label="Chọn vai trò CNTT"]'],
        matchTexts: ["Số dư IT-Coin:"],
        placement: "bottom",
      },
      {
        title: "4 Phòng đấu Realtime & AI Bot",
        description:
          "Khám phá 4 đấu trường tương tác: Outage At 3AM (Party), Code Review Duel (1v1), Explain It Like I'm 5 (Taboo) và Syntax Bomb (Word Chain).",
        selectors: [
          'a[href="/arena/party"]',
          'a[href="/arena/duel"]',
          'a[href="/arena/taboo"]',
          'a[href="/arena/word-chain"]',
        ],
        matchTexts: ["Outage At 3AM (Party Mode)", "Mở Party Mode"],
        placement: "top",
      },
      {
        title: "Chế độ Solo nhanh & Bảng xếp hạng",
        description:
          "Chuyển tab ngay bên dưới để chơi Bug Buster 280s, Standup Speed Run, xem Danh hiệu cá nhân hoặc Bảng xếp hạng toàn hệ thống.",
        selectors: ['div[role="tablist"][aria-label="Chế độ IT Speaking Arena"]'],
        matchTexts: ["Bug Buster 280s", "Standup Speed Run", "Bảng xếp hạng"],
        placement: "bottom",
      },
      {
        title: "Đổi IT-Coin tại Cửa hàng Hiệu ứng",
        description:
          "Dùng IT-Coin kiếm được từ Arena để mở khóa Avatar Frame, Nameplate và hiệu ứng Victory Finisher.",
        selectors: ['a[href="/shop"]'],
        matchTexts: ["Cửa hàng Hiệu ứng", "Đổi quà tại Shop"],
        placement: "left",
      },
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
    tourStops: [
      {
        title: "Bài đánh giá nhanh 3 bước",
        description:
          "Hoàn thành 2 câu tình huống giao tiếp IT và 1 lượt nói ngắn 15 giây để hệ thống đề xuất cấp độ Fresher, Junior hoặc Senior.",
        matchTexts: ["Kiểm Tra Trình Độ Nhanh (2 Phút)"],
        placement: "bottom",
      },
      {
        title: "Chọn phương án phản xạ tự nhiên nhất",
        description:
          "Ở bước 1 và bước 2, nhấn chọn câu trả lời tiếng Anh bạn thường dùng khi làm việc trong nhóm kỹ thuật.",
        selectors: [
          ".space-y-2\\.5 button",
          'button[aria-label="Bắt đầu nói"]',
        ],
        matchTexts: ["Ghi âm câu trả lời"],
        placement: "bottom",
      },
      {
        title: "Chuyển bước & nhận gợi ý kịch bản",
        description:
          "Bấm Tiếp tục sau khi chọn đáp án, hoặc Xem kết quả xếp lớp ở bước cuối để mở ngay bài luyện phù hợp.",
        matchTexts: ["Tiếp tục", "Xem kết quả xếp lớp", "Bắt đầu bài"],
        placement: "top",
      },
      {
        title: "Bước nói 15 giây (Mic hoặc gõ chữ)",
        description:
          "Ở bước 3/3, nhấn nút Mic nói 1–2 câu tiếng Anh về task hoặc bug bạn vừa xử lý (có thể gõ bổ sung vào ô văn bản bên dưới).",
        selectors: ['button[aria-label="Bắt đầu nói"]', "textarea"],
        matchTexts: ["Ghi âm câu trả lời"],
        placement: "top",
      },
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
    tourStops: [
      {
        title: "Tổng hợp chỉ số luyện nói & Streak",
        description:
          "Theo dõi tổng lượt đã luyện, điểm cao nhất, điểm trung bình và chuỗi ngày học liên tục của bạn.",
        matchTexts: ["Tiến Độ Học Tập & Kế Hoạch 7 Ngày"],
        placement: "bottom",
      },
      {
        title: "Thống kê hoạt động IT Speaking Arena",
        description:
          "Xem kỷ lục Bug Buster, Standup Speed Run, số dư IT-Coin và biểu đồ điểm cao nhất từng tình huống bên dưới.",
        matchTexts: [
          "Hoạt Động IT Speaking Arena",
          "Điểm Cao Nhất Từng Tình Huống",
        ],
        placement: "bottom",
      },
      {
        title: "Kế hoạch 7 Ngày thích ứng",
        description:
          "Hệ thống tự động xếp các từ khóa bạn từng bỏ sót vào 7 ngày luyện tập; bấm Bắt đầu ở từng ngày để ôn lại ngay.",
        matchTexts: ["Kế Hoạch Luyện Tập 7 Ngày Thích Ứng"],
        placement: "top",
      },
      {
        title: "Xuất dữ liệu nghiên cứu (.json)",
        description:
          "Tải xuống toàn bộ lịch sử lượt nói, điểm số và từ khóa yếu dưới dạng tệp JSON để sao lưu hoặc phục vụ báo cáo NCKH.",
        matchTexts: ["Xuất dữ liệu (.json)"],
        placement: "left",
      },
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
    tourStops: [
      {
        title: "Số dư IT-Coin & nút kiếm thêm Coin",
        description:
          "Kiểm tra số IT-Coin hiện có tại đây hoặc nhấn Kiếm thêm Coin để sang Arena cày điểm nhanh.",
        selectors: ['a[href="/arena"]'],
        matchTexts: ["Kiếm thêm Coin"],
        placement: "bottom",
      },
      {
        title: "Phòng thử hiệu ứng trực tiếp (Sandbox)",
        description:
          "Mọi vật phẩm bạn nhấn chọn sẽ hiển thị xem trước ngay trên thẻ hồ sơ, khung Mic Pulse và hiệu ứng Victory Finisher.",
        selectors: ['section[aria-label="Live Try-On Sandbox"]'],
        matchTexts: ["Mic Pulse", "Trigger Finisher"],
        placement: "bottom",
      },
      {
        title: "6 Nhóm phụ kiện tùy biến",
        description:
          "Chuyển qua lại giữa Avatar Frames, Profile Themes, Cursor Trails, Leaderboard FX, Nameplates và Victory Finishers.",
        selectors: ['div[role="tablist"][aria-label="Cosmetic Categories"]'],
        matchTexts: ["Avatar Frames"],
        placement: "bottom",
      },
      {
        title: "Mở khóa & Trang bị bằng IT-Coin",
        description:
          "Nhấn lên thẻ bất kỳ để thử trước, sau đó bấm Unlock / Owned • Equip để gắn vĩnh viễn vào hồ sơ và Bảng xếp hạng.",
        matchTexts: ["Unlock for", "Owned • Equip", "Unequip"],
        placement: "top",
      },
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
    tourStops: [
      {
        title: "Danh sách Top 50 & nút làm mới",
        description:
          "Bảng xếp hạng sắp xếp theo tổng điểm tích lũy và IT-Coin; bấm Refresh để cập nhật thứ hạng mới nhất.",
        matchTexts: ["Refresh", "Bảng xếp hạng"],
        placement: "left",
      },
      {
        title: "Đổi tên hiển thị & sao chép mã DEV",
        description:
          "Nhấn biểu tượng bút chì để đổi nickname của bạn trên bảng xếp hạng và sao chép mã DEV-XXXXXX để dự phòng.",
        selectors: [
          'button[aria-label="Edit display name"]',
          'input[placeholder="DEV-XXXXXX"]',
        ],
        matchTexts: ["Copy", "Bảng xếp hạng"],
        placement: "bottom",
      },
      {
        title: "Khôi phục tiến độ giữa các thiết bị",
        description:
          "Nhập mã DEV-XXXXXX của bạn từ máy hoặc trình duyệt khác rồi bấm Restore để đồng bộ lại điểm, Coin và vật phẩm.",
        selectors: ['input[placeholder="DEV-XXXXXX"]'],
        matchTexts: ["Restore"],
        placement: "bottom",
      },
      {
        title: "Mở khóa hiệu ứng nổi bật trên Bảng xếp hạng",
        description:
          "Truy cập Cửa hàng Hiệu ứng để trang bị Nameplate và Leaderboard FX giúp tên bạn nổi bật trong Top 50.",
        selectors: ['a[href="/shop"]'],
        matchTexts: ["Xem thêm tại Cửa hàng →"],
        placement: "top",
      },
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
    tourStops: [
      {
        title: "Cập nhật tên hiển thị & Avatar",
        description:
          "Bấm Đổi tên hoặc Đổi Avatar để chọn icon IT yêu thích, tải ảnh đại diện và xem khung viền đang trang bị.",
        selectors: [
          'button[aria-label="Chỉnh sửa tên hiển thị"]',
          'button[title="Đổi Avatar"]',
          'section[aria-label="Thông tin định danh người học"]',
        ],
        matchTexts: ["Đổi tên", "Đổi Avatar"],
        placement: "bottom",
      },
      {
        title: "Vai trò CNTT đồng bộ toàn ứng dụng",
        description:
          "Chọn Frontend, Backend, QA hoặc DevOps để cá nhân hóa tình huống gợi ý và lộ trình luyện tập.",
        selectors: [
          'div[aria-label="Danh sách vai trò CNTT"]',
          'section[aria-label="Chọn vai trò CNTT"]',
        ],
        matchTexts: ["Vai trò CNTT của bạn"],
        placement: "right",
      },
      {
        title: "Sao chép & khôi phục mã DEV-XXXXXX",
        description:
          "Sao chép mã chuyển thiết bị để lưu giữ tiến độ không cần đăng nhập, hoặc nhập mã từ máy cũ để khôi phục dữ liệu.",
        selectors: [
          'section[aria-label="Mã chuyển thiết bị và khôi phục hồ sơ"]',
          "input#restore-transfer-code",
        ],
        matchTexts: ["Mã chuyển thiết bị", "Sao chép"],
        placement: "left",
      },
      {
        title: "Kệ hiệu ứng IT-Coin & Lịch sử luyện tập",
        description:
          "Trang bị nhanh các phụ kiện đã sở hữu tại Cosmetic Armory hoặc sang Cửa hàng Hiệu ứng để mở khóa thêm.",
        selectors: [
          'section[aria-label="Kệ Danh hiệu và Viền Avatar"]',
          'section[aria-label="Tổng quan hoạt động luyện nói và Arena"]',
        ],
        matchTexts: ["IT-Coin Cosmetic Armory"],
        placement: "top",
      },
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
    tourStops: [
      {
        title: "Lọc bài viết theo chuyên mục",
        description:
          "Chọn nhanh Benchmark, Phỏng vấn HR, Tin Tech & AI hoặc Case Study để tìm đúng tài liệu nghiên cứu bạn cần.",
        selectors: ['div[aria-label="Lọc chuyên mục nghiên cứu"]'],
        matchTexts: ["Tất cả", "Phỏng vấn HR", "Tất cả bài nghiên cứu"],
        placement: "bottom",
      },
      {
        title: "Xem số liệu & đọc phân tích chi tiết",
        description:
          "Mở bài viết để xem các thẻ thống kê nổi bật, góc nhìn nhà tuyển dụng và nguồn tham khảo gốc.",
        matchTexts: [
          "Đọc chi tiết",
          "Đọc phân tích đầy đủ",
          "Dữ liệu thống kê chính",
        ],
        placement: "top",
      },
      {
        title: "AI Trích Xuất Từ Vựng từ bài viết",
        description:
          "Bấm nút này để AI rút trích các thuật ngữ tiếng Anh đắt giá trong bài và lưu thẳng vào kho luyện nói của bạn.",
        matchTexts: ["AI Trích Xuất Từ Vựng"],
        placement: "top",
      },
      {
        title: "Thực hành nói ngay theo kịch bản",
        description:
          "Sau khi nắm insight từ bài viết, chuyển sang Thư viện Kịch bản để áp dụng ngay vào hội thoại thực tế.",
        selectors: ['a[href="/scenarios"]'],
        matchTexts: ["Thực hành nói ngay"],
        placement: "left",
      },
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
    tourStops: [
      {
        title: "Chọn tốc độ phát âm mặc định",
        description:
          "Chọn 0.8x (Chậm), 1.0x (Chuẩn) hoặc 1.2x (Nhanh) để tự động áp dụng cho mọi câu hỏi của AI Interviewer.",
        matchTexts: ["1.0x (Chuẩn)", "0.8x (Chậm)"],
        placement: "bottom",
      },
      {
        title: "Chọn & nghe thử giọng AI phỏng vấn",
        description:
          "Chọn giọng AI mặc định và bấm nút Loa bên phải mỗi thẻ để nghe thử trước khi bắt đầu luyện tập.",
        selectors: ['button[aria-label^="Nghe thử"]'],
        matchTexts: ["Cấu hình giọng đọc câu hỏi (TTS)"],
        placement: "bottom",
      },
      {
        title: "Sao lưu lịch sử luyện tập ra JSON",
        description:
          "Tải tệp JSON chứa cài đặt, các lượt đã nói và danh sách từ khóa yếu để lưu trữ cục bộ an toàn.",
        matchTexts: ["Xuất dữ liệu JSON"],
        placement: "top",
      },
      {
        title: "Làm mới dữ liệu cục bộ",
        description:
          "Đặt lại toàn bộ lịch sử và từ khóa yếu trên trình duyệt hiện tại (có hộp thoại xác nhận trước khi xóa).",
        matchTexts: ["Làm mới tiến độ"],
        placement: "top",
      },
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

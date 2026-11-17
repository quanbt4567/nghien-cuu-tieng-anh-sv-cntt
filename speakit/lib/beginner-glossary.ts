import { VOCABULARY_LIST } from "../data/scenarios";

const BEGINNER_GLOSSARY: Record<string, string> = {
  yesterday: "hôm qua",
  today: "hôm nay",
  completed: "đã hoàn thành",
  fixed: "đã sửa lỗi",
  implemented: "đã cài đặt / làm xong",
  tested: "đã kiểm thử",
  submitted: "đã gửi lên",
  "pull request": "đề nghị gộp code (PR)",
  pull: "kéo code về / gộp",
  request: "yêu cầu / đề nghị",
  review: "kiểm tra / đánh giá",
  plan: "dự định",
  "plan to": "dự định sẽ",
  integrate: "tích hợp / kết nối",
  develop: "phát triển / viết",
  api: "cổng kết nối dữ liệu (API)",
  database: "cơ sở dữ liệu",
  payment: "thanh toán",
  gateway: "cổng trung gian",
  checkout: "thanh toán giỏ hàng / chuyển nhánh code",
  blocker: "vướng mắc đang chặn việc",
  blockers: "các vướng mắc",
  blocked: "bị chặn / kẹt",
  issue: "vấn đề / lỗi",
  "waiting for": "đang chờ",
  access: "quyền truy cập",
  dependency: "phần phụ thuộc vào người/bên khác",
  dependencies: "các phần phụ thuộc",
  clear: "thuận lợi / không vướng gì",
  staging: "môi trường thử nghiệm trước khi lên bản thật",
  credentials: "thông tin đăng nhập / mật khẩu kết nối",
  bug: "lỗi phần mềm",
  error: "lỗi",
  crash: "sập / đứng app",
  crashes: "bị sập",
  "fails to": "không thể / bị lỗi khi",
  unexpected: "bất ngờ / sai mong đợi",
  button: "nút bấm",
  screen: "màn hình",
  exception: "lỗi ngoại lệ chưa được xử lý",
  steps: "các bước",
  reproduce: "tái hiện lại lỗi",
  first: "đầu tiên",
  navigate: "đi tới / mở trang",
  click: "bấm vào",
  input: "nhập vào",
  observe: "quan sát thấy",
  proceed: "tiếp tục",
  severity: "mức độ nghiêm trọng",
  critical: "nghiêm trọng nhất (cần sửa ngay)",
  high: "cao",
  suggest: "đề xuất",
  hotfix: "bản vá lỗi khẩn cấp",
  validation: "kiểm tra dữ liệu hợp lệ",
  patch: "bản vá lỗi",
  refactor: "viết lại code cho gọn sạch hơn",
  refactors: "viết lại gọn hơn",
  feature: "tính năng",
  endpoint: "địa chỉ API cụ thể",
  optimized: "đã tối ưu tốc độ",
  codebase: "toàn bộ mã nguồn dự án",
  pagination: "chia trang dữ liệu",
  performance: "hiệu năng / tốc độ chạy",
  approach: "cách làm / hướng giải quyết",
  because: "bởi vì",
  maintainable: "dễ bảo trì / dễ sửa sau này",
  reusable: "tái sử dụng được nhiều chỗ",
  scalable: "dễ mở rộng khi đông người dùng",
  caching: "lưu tạm để tải nhanh hơn",
  memory: "bộ nhớ RAM",
  stream: "xử lý theo luồng từng phần nhỏ",
  chunk: "từng mảnh / từng lô nhỏ",
  chunks: "từng lô nhỏ",
  buffer: "bộ đệm dữ liệu",
  limit: "giới hạn",
  graduate: "sinh viên sắp/mới tốt nghiệp",
  student: "sinh viên",
  technology: "công nghệ",
  experience: "kinh nghiệm",
  built: "đã xây dựng / làm ra",
  stack: "bộ công nghệ sử dụng",
  passionate: "đam mê",
  specialize: "chuyên về",
  strength: "điểm mạnh",
  "problem solving": "khả năng giải quyết vấn đề",
  debugging: "tìm và sửa lỗi code",
  "learn quickly": "học hỏi nhanh",
  "clean code": "code viết rõ ràng, dễ đọc",
  system: "hệ thống",
  present: "trình bày",
  "allows users to": "cho phép người dùng",
  "real-time": "theo thời gian thực (ngay lập tức)",
  dashboard: "bảng điều khiển / thống kê",
  interface: "giao diện",
  "under the hood": "cơ chế chạy bên dưới",
  architecture: "kiến trúc hệ thống",
  websocket: "kết nối 2 chiều tức thì (WebSocket)",
  worker: "tiến trình chạy nền",
  queue: "hàng đợi xử lý",
  event: "sự kiện",
  latency: "độ trễ phản hồi",
  reconnection: "kết nối lại",
  retry: "thử lại",
  backoff: "giãn thời gian trước khi thử lại",
  resilient: "chịu lỗi tốt / khó sập",
  offline: "mất mạng / ngoại tuyến",
  cache: "bộ nhớ tạm",
  fallback: "phương án dự phòng khi lỗi",
  branch: "nhánh code",
  main: "nhánh code chính",
  "merge conflict": "xung đột code khi gộp nhánh",
  rebase: "cập nhật lại gốc nhánh code",
  compare: "so sánh",
  resolve: "giải quyết / xử lý xong",
  commit: "lưu một mốc thay đổi code",
  push: "đẩy code lên server (GitHub)",
  tests: "các bài kiểm thử tự động",
  build: "đóng gói chạy thử dự án",
  lint: "kiểm tra lỗi cú pháp / chuẩn viết code",
  pipeline: "luồng kiểm tra & triển khai tự động",
  ready: "sẵn sàng",
  local: "trên máy cá nhân",
  environment: "môi trường chạy code",
  setup: "cài đặt ban đầu",
  config: "tệp cấu hình",
  documentation: "tài liệu hướng dẫn",
  folder: "thư mục",
  structure: "cấu trúc",
  module: "khối chức năng",
  flow: "luồng xử lý",
  understand: "hiểu rõ",
  "entry point": "điểm khởi đầu của chương trình",
  starter: "nhiệm vụ khởi đầu nhẹ nhàng",
  small: "nhỏ / đơn giản",
  "unit test": "bài test từng hàm nhỏ",
  component: "thành phần giao diện",
  familiar: "làm quen",
  estimate: "ước lượng công việc",
  "story points": "điểm đo độ khó/khối lượng task",
  complexity: "độ phức tạp",
  effort: "công sức cần bỏ ra",
  include: "bao gồm",
  testing: "việc kiểm thử",
  risk: "rủi ro",
  backend: "phía máy chủ / xử lý dữ liệu",
  frontend: "phía giao diện người dùng",
  devops: "vận hành & triển khai hệ thống",
  schema: "cấu trúc bảng dữ liệu",
  clarify: "làm rõ thêm",
  "edge case": "tình huống hiếm gặp dễ gây lỗi",
  "break down": "chia nhỏ ra",
  subtask: "việc nhỏ tách ra từ việc lớn",
  prioritize: "ưu tiên làm trước",
  core: "phần cốt lõi quan trọng nhất",
  deliver: "hoàn thành và bàn giao",
  sprint: "chu kỳ làm việc ngắn (thường 1–2 tuần)",
  "next sprint": "chu kỳ làm việc tiếp theo",
  rollback: "quay lại phiên bản ổn định trước đó",
  deprecated: "phiên bản cũ sắp bỏ",
  deadlock: "hai tiến trình khóa chéo nhau gây treo",
  idempotency: "gửi trùng nhiều lần vẫn chỉ tính 1 lần",
  timeout: "hết thời gian chờ phản hồi",
  microservice: "dịch vụ tách nhỏ độc lập",
  container: "gói chạy ứng dụng độc lập (Docker)",
  deployment: "đưa ứng dụng lên chạy thật",
  throughput: "lưu lượng xử lý mỗi giây",
  bottleneck: "nút thắt cổ chai làm chậm hệ thống",
  outage: "sự cố sập dịch vụ diện rộng",
  incident: "sự cố hệ thống",
  mitigation: "giảm nhẹ / khắc phục tạm thời sự cố",
  telemetry: "dữ liệu đo lường & theo dõi hệ thống",
  audit: "kiểm tra nhật ký / rà soát bảo mật",
  rotation: "xoay vòng / đổi khóa mới",
  breach: "rò rỉ / xâm nhập bảo mật",
  payload: "dữ liệu gửi đi trong yêu cầu",
  token: "mã xác thực người dùng",
  authentication: "xác thực danh tính đăng nhập",
  authorization: "phân quyền truy cập",
  middleware: "lớp xử lý trung gian",
  webhook: "tín hiệu tự động báo khi có sự kiện",
  deadline: "hạn chót phải xong",
  prototype: "bản làm thử ban đầu",
  stakeholder: "người liên quan / đặt hàng dự án",
  backlog: "danh sách việc chờ làm",
  production: "môi trường chạy thật cho người dùng",
  merge: "gộp nhánh code lại với nhau",
  transaction: "giao dịch dữ liệu (trọn vẹn hoặc hủy)",
  lock: "khóa truy cập tạm để tránh đụng độ",
  retryable: "có thể thử lại an toàn",
  duplicate: "bị trùng lặp",
};

const COMBINED_MAP: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const [k, v] of Object.entries(BEGINNER_GLOSSARY)) {
    map.set(k.toLowerCase(), v);
  }
  for (const item of VOCABULARY_LIST) {
    const key = item.term.trim().toLowerCase();
    if (key && item.meaningVI && !map.has(key)) {
      map.set(key, item.meaningVI);
    }
  }
  return map;
})();

export function getVietnameseGloss(rawWord: string): string | null {
  if (typeof rawWord !== "string") return null;
  const cleaned = rawWord
    .trim()
    .toLowerCase()
    .replace(/^[^a-z0-9-]+|[^a-z0-9-]+$/g, "");
  if (!cleaned) return null;

  const direct = COMBINED_MAP.get(cleaned);
  if (direct) return direct;

  if (cleaned.endsWith("s") && cleaned.length > 3) {
    const singular = COMBINED_MAP.get(cleaned.slice(0, -1));
    if (singular) return singular;
  }
  if (cleaned.endsWith("ed") && cleaned.length > 4) {
    const base =
      COMBINED_MAP.get(cleaned.slice(0, -2)) ??
      COMBINED_MAP.get(cleaned.slice(0, -1));
    if (base) return base;
  }
  if (cleaned.endsWith("ing") && cleaned.length > 5) {
    const base =
      COMBINED_MAP.get(cleaned.slice(0, -3)) ??
      COMBINED_MAP.get(`${cleaned.slice(0, -3)}e`);
    if (base) return base;
  }
  return null;
}

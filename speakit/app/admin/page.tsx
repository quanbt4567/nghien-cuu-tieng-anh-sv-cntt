import type { Metadata } from "next";
import { AdminLoginGate } from "../../components/admin/AdminLoginGate";
import { AdminShell } from "../../components/admin/AdminShell";

export const metadata: Metadata = {
  title: "Cổng Quản Trị — SpeakIT",
  description:
    "Khu vực quản trị nghiên cứu SpeakIT: thống kê thực tế, xuất dữ liệu CSV/JSON và quản lý kịch bản, từ vựng, Arena.",
};

export default function AdminPage() {
  return (
    <AdminLoginGate>
      <AdminShell />
    </AdminLoginGate>
  );
}

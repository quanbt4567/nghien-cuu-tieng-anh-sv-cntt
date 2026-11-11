import type { Metadata } from "next";
import { ProfileView } from "../../components/profile/ProfileView";

export const metadata: Metadata = {
  title: "Hồ sơ người dùng — SpeakIT",
  description:
    "Quản lý danh tính Zero-Login, mã chuyển thiết bị DEV-XXXXXX, vai trò CNTT, danh hiệu và lịch sử luyện nói tiếng Anh CNTT trên SpeakIT.",
};

export default function ProfilePage() {
  return <ProfileView />;
}

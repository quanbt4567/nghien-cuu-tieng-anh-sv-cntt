import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "../components/layout/Navbar";
import { Footer } from "../components/layout/Footer";
import { WelcomeNameModal } from "../components/layout/WelcomeNameModal";
import { FeatureGuideDock } from "../components/common/FeatureGuideDock";

const beVietnamPro = Be_Vietnam_Pro({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-be-vietnam-pro",
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
});

const jetbrainsMono = JetBrains_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-jetbrains-mono",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#050811",
};

export const metadata: Metadata = {
  title: "SpeakIT — Luyện nói tiếng Anh tình huống CNTT",
  description:
    "Ứng dụng nghiên cứu hỗ trợ sinh viên CNTT luyện nói tiếng Anh trong các tình huống làm việc thực tế: Daily Standup, Bug Report, Code Review.",
  icons: {
    icon: "/logo-icon.png",
    apple: "/logo-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={`${beVietnamPro.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-[#0b1530] text-slate-100 min-h-screen antialiased flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-100">
        <div
          aria-hidden="true"
          className="fixed inset-0 -z-10 pointer-events-none overflow-hidden"
          style={{
            background:
              "radial-gradient(85% 65% at 88% 12%, rgba(14, 165, 233, 0.34) 0%, transparent 62%), radial-gradient(80% 65% at 12% 88%, rgba(139, 92, 246, 0.34) 0%, transparent 64%), radial-gradient(70% 55% at 50% 45%, rgba(30, 64, 175, 0.24) 0%, transparent 70%), linear-gradient(135deg, #0d1b3e 0%, #111838 48%, #1e1342 100%)",
          }}
        />
        <Navbar />
        <WelcomeNameModal />
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
        <Footer />
        <FeatureGuideDock />
      </body>
    </html>
  );
}

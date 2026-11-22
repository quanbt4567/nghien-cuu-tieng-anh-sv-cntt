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
      <body className="bg-[#050811] text-slate-100 min-h-screen antialiased flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-100">
        <div
          aria-hidden="true"
          className="fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-[#050811]"
        >
          <div
            className="liquid-orb-drift absolute -top-36 -left-32 w-[560px] h-[560px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(37, 99, 235, 0.30) 0%, rgba(37, 99, 235, 0.10) 42%, transparent 72%)",
            }}
          />
          <div
            className="liquid-orb-drift-slow absolute top-[18%] -right-36 w-[540px] h-[540px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(6, 182, 212, 0.24) 0%, rgba(6, 182, 212, 0.08) 42%, transparent 72%)",
            }}
          />
          <div
            className="liquid-orb-drift-delayed absolute -bottom-40 left-[22%] w-[600px] h-[600px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(124, 58, 237, 0.28) 0%, rgba(124, 58, 237, 0.09) 42%, transparent 72%)",
            }}
          />
        </div>
        <Navbar />
        <WelcomeNameModal />
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
        <Footer />
        <FeatureGuideDock />
      </body>
    </html>
  );
}

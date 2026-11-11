import type { Metadata } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "../components/layout/Navbar";
import { Footer } from "../components/layout/Footer";

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

export const metadata: Metadata = {
  title: "SpeakIT — Luyện nói tiếng Anh tình huống CNTT",
  description:
    "Ứng dụng nghiên cứu hỗ trợ sinh viên CNTT luyện nói tiếng Anh trong các tình huống làm việc thực tế: Daily Standup, Bug Report, Code Review.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={`${beVietnamPro.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-paper text-ink min-h-screen antialiased flex flex-col font-sans">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}


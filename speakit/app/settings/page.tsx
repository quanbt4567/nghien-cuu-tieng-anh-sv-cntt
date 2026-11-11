"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Key, CheckCircle2, AlertCircle, RotateCcw, Volume2, ShieldCheck, Trash2 } from "lucide-react";
import { storageAdapter } from "../../lib/storage";
import { UserSettings } from "../../lib/types";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [speechRate, setSpeechRate] = useState<0.8 | 1.0 | 1.2>(1.0);
  const [autoPlayAudio, setAutoPlayAudio] = useState(true);

  // Status message
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Reset confirmation modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStatus, setResetStatus] = useState<string | null>(null);

  useEffect(() => {
    const settings = storageAdapter.getSettings();
    setApiKey(settings.geminiApiKey || "");
    setSpeechRate(settings.speechRate || 1.0);
    setAutoPlayAudio(settings.autoPlayAudio ?? true);
  }, []);

  const handleSaveSettings = () => {
    storageAdapter.saveSettings({
      geminiApiKey: apiKey.trim(),
      speechRate,
      autoPlayAudio,
    });
    setSaveStatus("Đã lưu cài đặt thành công vào trình duyệt!");
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      setTestResult({
        success: false,
        message: "Vui lòng nhập Google Gemini API key trước khi kiểm tra.",
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "ping" }] }],
        }),
      });

      if (res.ok) {
        setTestResult({
          success: true,
          message: "Kết nối thành công! Khóa Gemini API hoạt động chuẩn xác.",
        });
        // Auto-save key if test passes
        storageAdapter.saveSettings({ geminiApiKey: apiKey.trim() });
      } else {
        const errorData = await res.json().catch(() => null);
        const errMsg = errorData?.error?.message || "Khóa API không hợp lệ.";
        setTestResult({
          success: false,
          message: `Lỗi kết nối Gemini: ${errMsg}`,
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: "Không thể kết nối đến máy chủ Google Gemini. Vui lòng kiểm tra lại mạng.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleResetProgress = async () => {
    await storageAdapter.resetAll();
    setShowResetModal(false);
    setResetStatus("Đã làm mới toàn bộ tiến độ và điểm số!");
    setTimeout(() => setResetStatus(null), 3500);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      {/* Top Header */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white text-ink text-xs font-medium border border-ink/15 shadow-soft hover:bg-paper-muted transition-all mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Trang chủ</span>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Cài Đặt Hệ Thống & Khóa AI
        </h1>
        <p className="text-xs text-ink-muted mt-1">
          Quản lý khóa API, cấu hình giọng đọc câu hỏi và quản lý bộ nhớ cục bộ.
        </p>
      </div>

      {/* 1. Gemini API Key Configuration Card */}
      <section className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
        <div className="flex items-center gap-2 border-b border-ink/10 pb-3">
          <Key className="w-5 h-5 text-accent" />
          <h2 className="text-sm font-bold uppercase font-mono text-ink">
            Khóa Google Gemini API (Tùy chọn)
          </h2>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-ink block">
            API Key:
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full p-3 text-sm font-mono bg-paper border border-ink/15 rounded-xl text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent"
          />
          <div className="flex items-start gap-1.5 text-[11px] font-mono text-ink-muted leading-relaxed">
            <ShieldCheck className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
            <span>
              <strong>Bảo mật tuyệt đối (Nguyên tắc II):</strong> Khóa API được lưu độc quyền tại bộ nhớ cục bộ (`localStorage`) trình duyệt của bạn. Hệ thống tuyệt đối không gửi khóa lên Supabase hoặc lưu trữ trên máy chủ.
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || !apiKey.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-paper-card text-ink text-xs font-semibold border border-ink/15 shadow-soft hover:bg-paper-muted disabled:opacity-50 transition-all"
          >
            {isTesting ? "Đang thử nghiệm..." : "Kiểm tra kết nối"}
          </button>

          <button
            type="button"
            onClick={handleSaveSettings}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-pill bg-ink text-white text-xs font-semibold border border-ink shadow-soft hover:bg-ink-muted transition-all"
          >
            <span>Lưu cài đặt</span>
          </button>
        </div>

        {/* Test Result Message */}
        {testResult && (
          <div
            className={`p-3 rounded-xl border text-xs font-medium flex items-start gap-2 ${
              testResult.success
                ? "bg-paper text-ink border-ink/20"
                : "bg-accent-light text-accent border-accent/30"
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}

        {/* Save Status Banner */}
        {saveStatus && (
          <div className="p-3 bg-paper rounded-xl border border-ink/20 text-xs text-ink font-medium">
            {saveStatus}
          </div>
        )}
      </section>

      {/* 2. Audio & Speech Settings */}
      <section className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
        <div className="flex items-center gap-2 border-b border-ink/10 pb-3">
          <Volume2 className="w-5 h-5 text-accent" />
          <h2 className="text-sm font-bold uppercase font-mono text-ink">
            Cấu hình giọng đọc câu hỏi (TTS)
          </h2>
        </div>

        <div className="space-y-3">
          <label className="text-xs font-semibold text-ink block">
            Tốc độ phát âm mặc định:
          </label>
          <div className="flex items-center gap-2">
            {([0.8, 1.0, 1.2] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setSpeechRate(r);
                  storageAdapter.saveSettings({ speechRate: r });
                }}
                className={`px-4 py-1.5 rounded-pill text-xs font-mono font-bold border transition-all ${
                  speechRate === r
                    ? "bg-accent text-white border-accent shadow-soft"
                    : "bg-paper-card text-ink border-ink/15 hover:bg-paper"
                }`}
              >
                {r}x {r === 0.8 ? "(Chậm)" : r === 1.0 ? "(Chuẩn)" : "(Nhanh)"}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Reset Progress (Data Hygiene) */}
      <section className="bg-paper-card border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-3">
        <div className="flex items-center gap-2 border-b border-ink/10 pb-3">
          <Trash2 className="w-5 h-5 text-accent" />
          <h2 className="text-sm font-bold uppercase font-mono text-ink">
            Quản Lý Dữ Liệu Luyện Tập
          </h2>
        </div>

        <p className="text-xs text-ink-muted leading-relaxed">
          Xóa toàn bộ lịch sử các lượt nói, điểm số và danh sách từ khóa yếu trong bộ nhớ máy này. Khóa Gemini API sẽ được giữ nguyên.
        </p>

        <button
          type="button"
          onClick={() => setShowResetModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-paper border border-ink/15 text-accent hover:bg-accent-light text-xs font-semibold shadow-soft transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Làm mới tiến độ</span>
        </button>

        {resetStatus && (
          <div className="p-3 bg-accent-light text-accent rounded-xl border border-accent text-xs font-medium">
            {resetStatus}
          </div>
        )}
      </section>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-ink/15 rounded-2xl p-6 max-w-sm w-full shadow-card space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-accent-light text-accent flex items-center justify-center mx-auto border border-ink/15">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-ink">Xác nhận làm mới tiến độ?</h3>
            <p className="text-xs text-ink-muted">
              Hành động này sẽ xóa vĩnh viễn toàn bộ lịch sử các lượt luyện nói và từ khóa yếu đã lưu.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 rounded-pill bg-paper-card border border-ink/15 text-xs font-medium shadow-soft"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleResetProgress}
                className="px-4 py-2 rounded-pill bg-accent text-white border border-accent text-xs font-bold shadow-soft"
              >
                Đồng ý xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, AlertCircle, RotateCcw, Volume2, Trash2 } from "lucide-react";
import { storageAdapter } from "../../lib/storage";

export default function SettingsPage() {
  const [speechRate, setSpeechRate] = useState<0.8 | 1.0 | 1.2>(1.0);

  // Reset confirmation modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStatus, setResetStatus] = useState<string | null>(null);

  useEffect(() => {
    const settings = storageAdapter.getSettings();
    setSpeechRate(settings.speechRate || 1.0);
  }, []);

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
          Cài Đặt Luyện Tập
        </h1>
        <p className="text-xs text-ink-muted mt-1">
          Cấu hình giọng đọc câu hỏi và quản lý bộ nhớ cục bộ.
        </p>
      </div>

      {/* 1. Audio & Speech Settings */}
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

      {/* 2. Reset Progress (Data Hygiene) */}
      <section className="bg-paper-card border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-3">
        <div className="flex items-center gap-2 border-b border-ink/10 pb-3">
          <Trash2 className="w-5 h-5 text-accent" />
          <h2 className="text-sm font-bold uppercase font-mono text-ink">
            Quản Lý Dữ Liệu Luyện Tập
          </h2>
        </div>

        <p className="text-xs text-ink-muted leading-relaxed">
          Xóa toàn bộ lịch sử các lượt nói, điểm số và danh sách từ khóa yếu trong bộ nhớ máy này.
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


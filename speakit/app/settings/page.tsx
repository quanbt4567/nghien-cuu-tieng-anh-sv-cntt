"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, AlertCircle, Bell, Download, RotateCcw, Volume2, VolumeX, Trash2 } from "lucide-react";
import { storageAdapter } from "../../lib/storage";
import {
  getSavedReminderPrefs,
  saveReminderPrefs,
} from "../../lib/mobile-notifications";
import {
  DEFAULT_VOICE_PERSONA,
  TTS_VOICE_PERSONAS,
  VoicePersona,
  normalizeTtsPersona,
  playTtsAudio,
  stopActiveTts,
} from "../../lib/tts-player";
import { VoicePersonaId } from "../../lib/types";

export default function SettingsPage() {
  const [speechRate, setSpeechRate] = useState<0.8 | 1.0 | 1.2>(1.0);
  const [voicePersona, setVoicePersona] =
    useState<VoicePersona>(DEFAULT_VOICE_PERSONA);
  const [previewingPersonaId, setPreviewingPersonaId] =
    useState<VoicePersona | null>(null);

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStatus, setResetStatus] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("20:00");
  const [reminderStatus, setReminderStatus] = useState<string | null>(null);
  const [showPreviewBanner, setShowPreviewBanner] = useState(false);

  useEffect(() => {
    const settings = storageAdapter.getSettings();
    setSpeechRate(settings.speechRate || 1.0);
    setVoicePersona(normalizeTtsPersona(settings.voicePersona));
    const prefs = getSavedReminderPrefs();
    setReminderEnabled(prefs.enabled);
    setReminderTime(
      `${String(prefs.hour).padStart(2, "0")}:${String(prefs.minute).padStart(2, "0")}`
    );
  }, []);

  const handleExportJson = async () => {
    const [attempts, weakPoints] = await Promise.all([
      storageAdapter.getAttempts(),
      storageAdapter.getWeakPoints(),
    ]);
    const payload = {
      exportedAt: new Date().toISOString(),
      settings: storageAdapter.getSettings(),
      attempts,
      weakPoints,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "speakit-data.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExportStatus("Đã xuất dữ liệu JSON thành công!");
    setTimeout(() => setExportStatus(null), 3500);
  };

  const handleResetProgress = async () => {
    await storageAdapter.resetAll();
    setShowResetModal(false);
    setResetStatus("Đã làm mới toàn bộ tiến độ và điểm số!");
    setTimeout(() => setResetStatus(null), 3500);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <div>
        <Link
          href="/"
          className="liquid-glass-btn inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Trang chủ</span>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Cài Đặt Luyện Tập
        </h1>
        <p className="text-xs text-slate-300 mt-1">
          Cấu hình giọng đọc câu hỏi và quản lý bộ nhớ cục bộ.
        </p>
      </div>

      <section className="liquid-glass-card p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <Volume2 className="w-5 h-5 text-cyan-400" />
          <h2 className="text-sm font-bold uppercase font-mono text-white">
            Cấu hình giọng đọc câu hỏi (TTS)
          </h2>
        </div>

        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-200 block">
            Tốc độ phát âm mặc định:
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {([0.8, 1.0, 1.2] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setSpeechRate(r);
                  storageAdapter.saveSettings({ speechRate: r });
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-mono font-bold border transition-all ${
                  speechRate === r
                    ? "bg-cyan-500/25 border-cyan-400/55 text-cyan-100 shadow-[0_0_16px_rgba(6,182,212,0.28)]"
                    : "bg-white/[0.06] text-slate-300 border-white/15 hover:bg-white/[0.14] hover:text-white"
                }`}
              >
                {r}x {r === 0.8 ? "(Chậm)" : r === 1.0 ? "(Chuẩn)" : "(Nhanh)"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 pt-3 border-t border-white/10">
          <label className="text-xs font-semibold text-slate-200 block">
            Giọng AI phỏng vấn mặc định:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {TTS_VOICE_PERSONAS.map((persona) => {
              const isSelected = voicePersona === persona.id;
              const isPreviewing = previewingPersonaId === persona.id;
              return (
                <div
                  key={persona.id}
                  className={`flex items-center justify-between gap-2 p-3 rounded-2xl border transition-all ${
                    isSelected
                      ? "bg-cyan-500/20 text-white border-cyan-400/55 shadow-[0_0_20px_rgba(6,182,212,0.22)]"
                      : "bg-slate-950/55 text-slate-200 border-white/12 hover:bg-white/[0.08] hover:border-white/25"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setVoicePersona(persona.id);
                      storageAdapter.saveSettings({
                        voicePersona: persona.id as VoicePersonaId,
                      });
                    }}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="font-semibold text-xs truncate">
                      {persona.label}
                    </div>
                    <div
                      className={`text-[11px] font-mono ${
                        isSelected ? "text-cyan-200" : "text-slate-400"
                      }`}
                    >
                      {persona.lang}
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label={
                      isPreviewing
                        ? `Dừng nghe thử ${persona.label}`
                        : `Nghe thử ${persona.label}`
                    }
                    title={
                      isPreviewing
                        ? `Dừng nghe thử ${persona.label}`
                        : `Nghe thử ${persona.label}`
                    }
                    onClick={() => {
                      if (isPreviewing) {
                        stopActiveTts();
                        setPreviewingPersonaId(null);
                        return;
                      }
                      setPreviewingPersonaId(persona.id);
                      playTtsAudio({
                        text: "Hi, can you walk me through your pull request and deployment plan?",
                        rate: speechRate,
                        persona: persona.id,
                        onEnd: () =>
                          setPreviewingPersonaId((curr) =>
                            curr === persona.id ? null : curr
                          ),
                        onError: () =>
                          setPreviewingPersonaId((curr) =>
                            curr === persona.id ? null : curr
                          ),
                      });
                    }}
                    className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition-colors ${
                      isPreviewing
                        ? "liquid-btn-primary"
                        : "bg-cyan-500/20 border border-cyan-400/45 text-cyan-200 hover:bg-cyan-500/35 hover:text-white"
                    }`}
                  >
                    {isPreviewing ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="liquid-glass-card p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold uppercase font-mono text-white">
              Nhắc Nhở Học Tập Trong App
            </h2>
          </div>
          <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 text-emerald-200">
            In-App
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Hiển thị nhắc nhở luyện nói mỗi ngày ngay trong chuông thông báo khi bạn mở SpeakIT.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <label
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
              reminderEnabled
                ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-100"
                : "bg-white/[0.05] border-white/15 text-slate-200 hover:bg-white/[0.1]"
            }`}
          >
            <input
              type="checkbox"
              checked={reminderEnabled}
              onChange={(e) => setReminderEnabled(e.target.checked)}
              className="w-4 h-4 accent-emerald-400"
            />
            <span>Bật nhắc nhở mỗi ngày</span>
          </label>

          <input
            type="time"
            value={reminderTime}
            onChange={(e) => setReminderTime(e.target.value)}
            aria-label="Giờ nhắc nhở hằng ngày"
            className="liquid-glass-input px-3 py-1.5 rounded-xl text-xs font-mono font-semibold"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              const [hStr, mStr] = reminderTime.split(":");
              const parsedHour = Number.parseInt(hStr ?? "20", 10);
              const parsedMinute = Number.parseInt(mStr ?? "0", 10);
              const hour = Number.isFinite(parsedHour) ? parsedHour : 20;
              const minute = Number.isFinite(parsedMinute) ? parsedMinute : 0;
              saveReminderPrefs({ enabled: reminderEnabled, hour, minute });
              const hh = String(hour).padStart(2, "0");
              const mm = String(minute).padStart(2, "0");
              setReminderStatus(
                reminderEnabled
                  ? `Đã lưu lịch nhắc nhở trong app lúc ${hh}:${mm}.`
                  : "Đã tắt nhắc nhở học tập trong app."
              );
            }}
            className="liquid-btn-success inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Lưu lịch nhắc</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPreviewBanner((prev) => !prev)}
            className="liquid-glass-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all"
          >
            <span>Xem thử thông báo trong app</span>
          </button>
        </div>

        {showPreviewBanner && (
          <div
            role="status"
            className="p-3.5 rounded-2xl bg-cyan-500/15 border border-cyan-400/40 flex items-start justify-between gap-3"
          >
            <div className="flex items-start gap-2.5">
              <Bell className="w-4 h-4 text-cyan-300 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-white">
                  SpeakIT — Đến giờ luyện nói 5 phút!
                </div>
                <p className="text-xs text-slate-200">
                  Dành 5 phút luyện phản xạ tiếng Anh CNTT để giữ streak hôm nay nhé.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowPreviewBanner(false)}
              className="text-[11px] font-semibold text-cyan-200 hover:text-white shrink-0"
            >
              Đóng
            </button>
          </div>
        )}

        {reminderStatus && (
          <div
            role="status"
            className="p-3 bg-emerald-500/15 rounded-xl border border-emerald-400/40 text-xs font-medium text-emerald-200"
          >
            {reminderStatus}
          </div>
        )}
      </section>

      <section className="liquid-glass-card p-5 sm:p-6 space-y-3">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <Trash2 className="w-5 h-5 text-rose-400" />
          <h2 className="text-sm font-bold uppercase font-mono text-white">
            Quản Lý Dữ Liệu Luyện Tập
          </h2>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Xóa toàn bộ lịch sử các lượt nói, điểm số và danh sách từ khóa yếu trong bộ nhớ máy này.
        </p>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportJson}
            className="liquid-btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất dữ liệu JSON</span>
          </button>

          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            className="liquid-btn-danger inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Làm mới tiến độ</span>
          </button>
        </div>

        {exportStatus && (
          <div
            role="status"
            className="p-3 bg-emerald-500/15 text-emerald-200 rounded-xl border border-emerald-400/40 text-xs font-medium"
          >
            {exportStatus}
          </div>
        )}

        {resetStatus && (
          <div className="p-3 bg-rose-500/15 text-rose-200 rounded-xl border border-rose-400/40 text-xs font-medium">
            {resetStatus}
          </div>
        )}
      </section>

      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-950/90 backdrop-blur-2xl border border-white/20 rounded-3xl p-6 max-w-sm w-full shadow-[0_24px_64px_rgba(0,0,0,0.75)] space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-300 flex items-center justify-center mx-auto border border-rose-400/45">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Xác nhận làm mới tiến độ?</h3>
            <p className="text-xs text-slate-300">
              Hành động này sẽ xóa vĩnh viễn toàn bộ lịch sử các lượt luyện nói và từ khóa yếu đã lưu.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="liquid-glass-btn px-4 py-2 rounded-full text-xs font-medium"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleResetProgress}
                className="liquid-btn-danger px-4 py-2 rounded-full text-xs font-bold"
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


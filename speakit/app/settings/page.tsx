"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  AlertCircle,
  Bell,
  Download,
  RotateCcw,
  Volume2,
  VolumeX,
  Trash2,
} from "lucide-react";
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

  useEffect(() => {
    if (!showResetModal) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowResetModal(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showResetModal]);

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
          className="liquid-glass-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors mb-2 focus-visible:ring-2 focus-visible:ring-blue-600/50"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Trang chủ</span>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 text-balance">
          Cài đặt luyện tập
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 measure-prose">
          Cấu hình giọng đọc câu hỏi và quản lý bộ nhớ cục bộ.
        </p>
      </div>

      <section className="liquid-glass-card p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#334155] pb-3">
          <Volume2 className="w-5 h-5 text-blue-700 dark:text-blue-400" aria-hidden="true" />
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
            Cấu hình giọng đọc câu hỏi (TTS)
          </h2>
        </div>

        <div className="space-y-3" role="group" aria-labelledby="speech-rate-heading">
          <p id="speech-rate-heading" className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Tốc độ phát âm mặc định:
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {([0.8, 1.0, 1.2] as const).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={speechRate === r}
                onClick={() => {
                  setSpeechRate(r);
                  storageAdapter.saveSettings({ speechRate: r });
                }}
                className={`px-4 py-2 rounded-lg text-sm font-mono tabular-nums font-bold border transition-colors focus-visible:ring-2 focus-visible:ring-blue-600/50 ${
                  speechRate === r
                    ? "bg-blue-50 dark:bg-blue-500/20 border-blue-300 dark:border-blue-400/60 text-blue-800 dark:text-blue-200"
                    : "bg-slate-100 dark:bg-[#263349] text-slate-700 dark:text-slate-100 border-slate-300 dark:border-white/20 hover:bg-blue-50/70 dark:hover:bg-[#334155]"
                }`}
              >
                {r}x {r === 0.8 ? "(Chậm)" : r === 1.0 ? "(Chuẩn)" : "(Nhanh)"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-[#334155]" role="group" aria-labelledby="voice-persona-heading">
          <p id="voice-persona-heading" className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Giọng AI phỏng vấn mặc định:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {TTS_VOICE_PERSONAS.map((persona) => {
              const isSelected = voicePersona === persona.id;
              const isPreviewing = previewingPersonaId === persona.id;
              return (
                <div
                  key={persona.id}
                  className={`flex items-center justify-between gap-2 p-3 rounded-lg border transition-colors ${
                    isSelected
                      ? "bg-blue-50 dark:bg-blue-500/20 text-slate-900 dark:text-white border-blue-300 dark:border-blue-400/60"
                      : "bg-slate-50 dark:bg-[#263349] text-slate-800 dark:text-slate-100 border-slate-200 dark:border-white/15 hover:border-blue-400 dark:hover:border-blue-400/50"
                  }`}
                >
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      setVoicePersona(persona.id);
                      storageAdapter.saveSettings({
                        voicePersona: persona.id as VoicePersonaId,
                      });
                    }}
                    className="flex-1 text-left min-w-0 rounded focus-visible:ring-2 focus-visible:ring-blue-600/50"
                  >
                    <div className="font-semibold text-sm truncate">
                      {persona.label}
                    </div>
                    <div
                      className={`text-xs font-mono ${
                        isSelected
                          ? "text-blue-700 dark:text-blue-400"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {persona.lang}
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-pressed={isPreviewing}
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
                    className={`w-9 h-9 shrink-0 rounded-lg border flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-blue-600/50 ${
                      isPreviewing
                        ? "bg-blue-700 dark:bg-blue-600 border-blue-700 dark:border-blue-600 text-white"
                        : "bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60"
                    }`}
                  >
                    {isPreviewing ? (
                      <VolumeX className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <Volume2 className="w-4 h-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="liquid-glass-card p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 dark:border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-green-700 dark:text-green-400" aria-hidden="true" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
              Nhắc nhở học tập trong app
            </h2>
          </div>
          <span className="text-xs font-mono px-2.5 py-0.5 rounded-full border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/50 text-green-800 dark:text-green-300 font-semibold">
            In-App
          </span>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed measure-prose">
          Hiển thị nhắc nhở luyện nói mỗi ngày ngay trong chuông thông báo khi bạn mở SpeakIT.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor="settings-reminder-enabled"
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold cursor-pointer transition-colors ${
              reminderEnabled
                ? "bg-green-50 dark:bg-green-950/50 border-green-300 dark:border-green-700 text-green-800 dark:text-green-300"
                : "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <input
              id="settings-reminder-enabled"
              name="reminderEnabled"
              type="checkbox"
              checked={reminderEnabled}
              onChange={(e) => setReminderEnabled(e.target.checked)}
              className="w-4 h-4 accent-blue-700 dark:accent-blue-500 focus-visible:ring-2 focus-visible:ring-blue-600/50"
            />
            <span>Bật nhắc nhở mỗi ngày</span>
          </label>

          <input
            id="settings-reminder-time"
            name="reminderTime"
            type="time"
            autoComplete="off"
            value={reminderTime}
            onChange={(e) => setReminderTime(e.target.value)}
            aria-label="Giờ nhắc nhở hằng ngày"
            className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm font-mono tabular-nums font-semibold focus-visible:ring-2 focus-visible:ring-blue-600/50"
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
            className="bg-green-700 hover:bg-green-800 text-white inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-blue-600/50"
          >
            <Bell className="w-4 h-4" aria-hidden="true" />
            <span>Lưu lịch nhắc</span>
          </button>

          <button
            type="button"
            aria-pressed={showPreviewBanner}
            onClick={() => setShowPreviewBanner((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-blue-600/50"
          >
            <span>Xem thử thông báo trong app</span>
          </button>
        </div>

        {showPreviewBanner && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 p-3.5 flex items-start justify-between gap-3"
          >
            <div className="flex items-start gap-2.5">
              <Bell
                className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="space-y-0.5">
                <div className="text-sm font-bold text-slate-900 dark:text-slate-50">
                  SpeakIT: Đến giờ luyện nói 5 phút!
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Dành 5 phút luyện phản xạ tiếng Anh CNTT để giữ streak hôm nay nhé.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowPreviewBanner(false)}
              className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 shrink-0 rounded focus-visible:ring-2 focus-visible:ring-blue-600/50"
            >
              Đóng
            </button>
          </div>
        )}

        {reminderStatus && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/50 p-3 text-sm font-medium text-green-900 dark:text-green-200"
          >
            {reminderStatus}
          </div>
        )}
      </section>

      <section className="liquid-glass-card p-5 sm:p-6 space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-white/10 pb-3">
          <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" aria-hidden="true" />
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
            Quản lý dữ liệu luyện tập
          </h2>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed measure-prose">
          Xóa toàn bộ lịch sử các lượt nói, điểm số và danh sách từ khóa yếu trong bộ nhớ máy này.
        </p>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportJson}
            className="bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-blue-600/50"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>Xuất dữ liệu JSON</span>
          </button>

          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            className="bg-red-600 hover:bg-red-700 text-white inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-blue-600/50"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            <span>Làm mới tiến độ</span>
          </button>
        </div>

        {exportStatus && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/50 p-3 text-green-900 dark:text-green-200 text-sm font-medium"
          >
            {exportStatus}
          </div>
        )}

        {resetStatus && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 p-3 text-red-900 dark:text-red-200 text-sm font-medium"
          >
            {resetStatus}
          </div>
        )}
      </section>

      {showResetModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overscroll-contain"
        >
          <button
            type="button"
            aria-label="Đóng hộp thoại xác nhận"
            onClick={() => setShowResetModal(false)}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
          />
          <div className="relative z-10 liquid-glass-card p-6 max-w-sm w-full space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto border border-red-200 dark:border-red-800">
              <AlertCircle className="w-6 h-6" aria-hidden="true" />
            </div>
            <h3 id="reset-modal-title" className="text-lg font-bold text-slate-900 dark:text-slate-50">
              Xác nhận làm mới tiến độ?
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Hành động này sẽ xóa vĩnh viễn toàn bộ lịch sử các lượt luyện nói và từ khóa yếu đã lưu.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-600/50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleResetProgress}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:ring-blue-600/50"
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

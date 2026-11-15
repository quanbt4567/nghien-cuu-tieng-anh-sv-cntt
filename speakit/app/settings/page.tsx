"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, AlertCircle, Download, RotateCcw, Volume2, VolumeX, Trash2 } from "lucide-react";
import { storageAdapter } from "../../lib/storage";
import {
  DEFAULT_VOICE_PERSONA,
  VOICE_PERSONAS,
  normalizeVoicePersona,
} from "../../lib/speech";
import { playTtsAudio, stopActiveTts } from "../../lib/tts-player";
import { VoicePersonaId } from "../../lib/types";

export default function SettingsPage() {
  const [speechRate, setSpeechRate] = useState<0.8 | 1.0 | 1.2>(1.0);
  const [voicePersona, setVoicePersona] =
    useState<VoicePersonaId>(DEFAULT_VOICE_PERSONA);
  const [previewingPersonaId, setPreviewingPersonaId] =
    useState<VoicePersonaId | null>(null);

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStatus, setResetStatus] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  useEffect(() => {
    const settings = storageAdapter.getSettings();
    setSpeechRate(settings.speechRate || 1.0);
    setVoicePersona(normalizeVoicePersona(settings.voicePersona));
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
          <div className="flex flex-wrap items-center gap-2">
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
                    ? "bg-ink text-white border-ink shadow-soft"
                    : "bg-paper-card text-ink border-ink/15 hover:bg-paper"
                }`}
              >
                {r}x {r === 0.8 ? "(Chậm)" : r === 1.0 ? "(Chuẩn)" : "(Nhanh)"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t border-ink/10">
          <label className="text-xs font-semibold text-ink block">
            Giọng AI phỏng vấn mặc định:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {VOICE_PERSONAS.map((persona) => {
              const isSelected = voicePersona === persona.id;
              const isPreviewing = previewingPersonaId === persona.id;
              return (
                <div
                  key={persona.id}
                  className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border transition-all ${
                    isSelected
                      ? "bg-ink text-white border-ink shadow-soft"
                      : "bg-paper text-ink border-ink/15 hover:bg-paper-muted"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setVoicePersona(persona.id);
                      storageAdapter.saveSettings({ voicePersona: persona.id });
                    }}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="font-semibold text-xs truncate">
                      {persona.label}
                    </div>
                    <div
                      className={`text-[11px] font-mono ${
                        isSelected ? "text-white/75" : "text-ink-muted"
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
                    className="w-9 h-9 shrink-0 rounded-full bg-paper border border-ink/20 flex items-center justify-center text-ink hover:bg-accent hover:text-white shadow-soft shadow-hard-press transition-colors"
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

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-white border border-ink/15 text-ink hover:bg-paper text-xs font-semibold shadow-soft transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất dữ liệu JSON</span>
          </button>

          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-paper border border-ink/15 text-accent hover:bg-accent-light text-xs font-semibold shadow-soft transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Làm mới tiến độ</span>
          </button>
        </div>

        {exportStatus && (
          <div
            role="status"
            className="p-3 bg-emerald-500/10 text-emerald-700 rounded-xl border border-emerald-500/30 text-xs font-medium"
          >
            {exportStatus}
          </div>
        )}

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


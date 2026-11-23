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
    setExportStatus("ÄÃ£ xuáº¥t dá»¯ liá»‡u JSON thÃ nh cÃ´ng!");
    setTimeout(() => setExportStatus(null), 3500);
  };

  const handleResetProgress = async () => {
    await storageAdapter.resetAll();
    setShowResetModal(false);
    setResetStatus("ÄÃ£ lÃ m má»›i toÃ n bá»™ tiáº¿n Ä‘á»™ vÃ  Ä‘iá»ƒm sá»‘!");
    setTimeout(() => setResetStatus(null), 3500);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium transition-colors mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Trang chá»§</span>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          CÃ i Äáº·t Luyá»‡n Táº­p
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
          Cáº¥u hÃ¬nh giá»ng Ä‘á»c cÃ¢u há»i vÃ  quáº£n lÃ½ bá»™ nhá»› cá»¥c bá»™.
        </p>
      </div>

      <section className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#262626] rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#262626] pb-3">
          <Volume2 className="w-5 h-5 text-blue-700 dark:text-blue-400" />
          <h2 className="text-sm font-bold uppercase font-mono text-slate-900 dark:text-slate-50">
            Cáº¥u hÃ¬nh giá»ng Ä‘á»c cÃ¢u há»i (TTS)
          </h2>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 block">
            Tá»‘c Ä‘á»™ phÃ¡t Ã¢m máº·c Ä‘á»‹nh:
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
                className={`px-4 py-2 rounded-lg text-sm font-mono font-bold border transition-colors ${
                  speechRate === r
                    ? "bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-blue-50/70 dark:hover:bg-slate-700"
                }`}
              >
                {r}x {r === 0.8 ? "(Cháº­m)" : r === 1.0 ? "(Chuáº©n)" : "(Nhanh)"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-[#262626]">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 block">
            Giá»ng AI phá»ng váº¥n máº·c Ä‘á»‹nh:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {TTS_VOICE_PERSONAS.map((persona) => {
              const isSelected = voicePersona === persona.id;
              const isPreviewing = previewingPersonaId === persona.id;
              return (
                <div
                  key={persona.id}
                  className={`flex items-center justify-between gap-2 p-3 rounded-lg border transition-colors ${
                    isSelected
                      ? "bg-blue-50 dark:bg-blue-950/60 text-slate-900 dark:text-slate-50 border-blue-300 dark:border-blue-700"
                      : "bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700"
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
                    aria-label={
                      isPreviewing
                        ? `Dá»«ng nghe thá»­ ${persona.label}`
                        : `Nghe thá»­ ${persona.label}`
                    }
                    title={
                      isPreviewing
                        ? `Dá»«ng nghe thá»­ ${persona.label}`
                        : `Nghe thá»­ ${persona.label}`
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
                    className={`w-9 h-9 shrink-0 rounded-lg border flex items-center justify-center transition-colors ${
                      isPreviewing
                        ? "bg-blue-700 dark:bg-blue-600 border-blue-700 dark:border-blue-600 text-white"
                        : "bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60"
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

      <section className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#262626] rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-[#262626] pb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-green-700 dark:text-green-400" />
            <h2 className="text-sm font-bold uppercase font-mono text-slate-900 dark:text-slate-50">
              Nháº¯c Nhá»Ÿ Há»c Táº­p Trong App
            </h2>
          </div>
          <span className="text-xs font-mono px-2.5 py-0.5 rounded-full border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/50 text-green-800 dark:text-green-300 font-semibold">
            In-App
          </span>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          Hiá»ƒn thá»‹ nháº¯c nhá»Ÿ luyá»‡n nÃ³i má»—i ngÃ y ngay trong chuÃ´ng thÃ´ng bÃ¡o khi báº¡n má»Ÿ SpeakIT.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <label
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold cursor-pointer transition-colors ${
              reminderEnabled
                ? "bg-green-50 dark:bg-green-950/50 border-green-300 dark:border-green-700 text-green-800 dark:text-green-300"
                : "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <input
              type="checkbox"
              checked={reminderEnabled}
              onChange={(e) => setReminderEnabled(e.target.checked)}
              className="w-4 h-4 accent-blue-700 dark:accent-blue-500"
            />
            <span>Báº­t nháº¯c nhá»Ÿ má»—i ngÃ y</span>
          </label>

          <input
            type="time"
            value={reminderTime}
            onChange={(e) => setReminderTime(e.target.value)}
            aria-label="Giá» nháº¯c nhá»Ÿ háº±ng ngÃ y"
            className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600/40"
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
                  ? `ÄÃ£ lÆ°u lá»‹ch nháº¯c nhá»Ÿ trong app lÃºc ${hh}:${mm}.`
                  : "ÄÃ£ táº¯t nháº¯c nhá»Ÿ há»c táº­p trong app."
              );
            }}
            className="bg-green-700 hover:bg-green-800 text-white inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            <Bell className="w-4 h-4" />
            <span>LÆ°u lá»‹ch nháº¯c</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPreviewBanner((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-semibold transition-colors"
          >
            <span>Xem thá»­ thÃ´ng bÃ¡o trong app</span>
          </button>
        </div>

        {showPreviewBanner && (
          <div
            role="status"
            className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 p-3.5 flex items-start justify-between gap-3"
          >
            <div className="flex items-start gap-2.5">
              <Bell
                className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="space-y-0.5">
                <div className="text-sm font-bold text-slate-900 dark:text-slate-50">
                  SpeakIT: Äáº¿n giá» luyá»‡n nÃ³i 5 phÃºt!
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  DÃ nh 5 phÃºt luyá»‡n pháº£n xáº¡ tiáº¿ng Anh CNTT Ä‘á»ƒ giá»¯ streak hÃ´m nay nhÃ©.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowPreviewBanner(false)}
              className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 shrink-0"
            >
              ÄÃ³ng
            </button>
          </div>
        )}

        {reminderStatus && (
          <div
            role="status"
            className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/50 p-3 text-sm font-medium text-green-900 dark:text-green-200"
          >
            {reminderStatus}
          </div>
        )}
      </section>

      <section className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#262626] rounded-xl p-5 sm:p-6 space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#262626] pb-3">
          <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
          <h2 className="text-sm font-bold uppercase font-mono text-slate-900 dark:text-slate-50">
            Quáº£n LÃ½ Dá»¯ Liá»‡u Luyá»‡n Táº­p
          </h2>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          XÃ³a toÃ n bá»™ lá»‹ch sá»­ cÃ¡c lÆ°á»£t nÃ³i, Ä‘iá»ƒm sá»‘ vÃ  danh sÃ¡ch tá»« khÃ³a yáº¿u trong bá»™ nhá»› mÃ¡y nÃ y.
        </p>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportJson}
            className="bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Xuáº¥t dá»¯ liá»‡u JSON</span>
          </button>

          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            className="bg-red-600 hover:bg-red-700 text-white inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>LÃ m má»›i tiáº¿n Ä‘á»™</span>
          </button>
        </div>

        {exportStatus && (
          <div
            role="status"
            className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/50 p-3 text-green-900 dark:text-green-200 text-sm font-medium"
          >
            {exportStatus}
          </div>
        )}

        {resetStatus && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 p-3 text-red-900 dark:text-red-200 text-sm font-medium">
            {resetStatus}
          </div>
        )}
      </section>

      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#262626] rounded-xl p-6 max-w-sm w-full shadow-sm space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto border border-red-200 dark:border-red-800">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">
              XÃ¡c nháº­n lÃ m má»›i tiáº¿n Ä‘á»™?
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              HÃ nh Ä‘á»™ng nÃ y sáº½ xÃ³a vÄ©nh viá»…n toÃ n bá»™ lá»‹ch sá»­ cÃ¡c lÆ°á»£t luyá»‡n nÃ³i vÃ  tá»« khÃ³a yáº¿u Ä‘Ã£ lÆ°u.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium transition-colors"
              >
                Há»§y bá»
              </button>
              <button
                type="button"
                onClick={handleResetProgress}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
              >
                Äá»“ng Ã½ xÃ³a
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
